// Field regression: on a desktop plancia with every section enabled the dock
// is wider than the screen. It is fixed and centered, so the page scroll never
// moves it and the tabs past the viewport edge were unreachable — there was no
// way to scroll the bar itself. The tabs now live in their own scroll port.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/sections/navigation-section.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const { navCenterTarget, navPageStep, navScrollState, navTabIsVisible, navWheelDelta } =
  await import(sourceUrl.href);

test("the dock is capped to the viewport and its tabs keep their own scroll port", () => {
  assert.match(source, /width:max-content!important;min-width:0!important;max-width:calc\(100% - 48px\)/);
  assert.match(source, /overflow-x:auto!important;overflow-y:hidden!important/);
  // The tabs must not shrink to fit the port, otherwise they squash instead of
  // overflowing and there is nothing left to scroll.
  assert.match(source, /\.tab\{flex:0 0 auto!important\}/);
  // The port clips vertically, so the Mac-dock bubble needs room inside it that
  // the negative margin takes back out of the layout.
  assert.match(source, /padding:34px 12px 26px!important;margin:-34px -12px -26px!important/);
  assert.match(source, /scrollbar-width:none!important/);
});

test("mobile keeps the bar it already had", () => {
  // Outside the desktop media query the port is display:contents, so the nav
  // stays the scroll container the touch layout has always used.
  assert.match(source, /\.bottom-nav-bar \.\$\{SCROLLER_CLASS\}\{display:contents\}/);
  assert.match(source, /\.bottom-nav-bar \.\$\{ARROW_CLASS\}\{display:none\}/);
  const desktop = source.slice(source.indexOf("@media(min-width:769px)"));
  assert.match(desktop, /\$\{CAN_SCROLL_CLASS\} \.\$\{ARROW_CLASS\}\{display:flex/);
});

test("the scroll port stays event driven", () => {
  assert.doesNotMatch(source, /setInterval|MutationObserver/);
  // Enabling or disabling a section resizes the bar: that is the signal that
  // says when the arrows are needed, with no polling behind it.
  assert.match(source, /new root\.ResizeObserver\(sync\)\.observe\(scroller\)/);
  for (const listener of ["wheel", "pointerdown", "pointermove", "scroll", "keydown"]) {
    assert.match(source, new RegExp(`"${listener}"`));
  }
});

test("arrow state follows the scroll position", () => {
  const idle = navScrollState({ scrollLeft: 0, scrollWidth: 900, clientWidth: 900 });
  assert.deepEqual({ ...idle }, { max: 0, scrollable: false, atStart: true, atEnd: true });

  const start = navScrollState({ scrollLeft: 0, scrollWidth: 1414, clientWidth: 1138 });
  assert.equal(start.max, 276);
  assert.equal(start.scrollable, true);
  assert.equal(start.atStart, true);
  assert.equal(start.atEnd, false);

  const middle = navScrollState({ scrollLeft: 120, scrollWidth: 1414, clientWidth: 1138 });
  assert.equal(middle.atStart, false);
  assert.equal(middle.atEnd, false);

  const end = navScrollState({ scrollLeft: 276, scrollWidth: 1414, clientWidth: 1138 });
  assert.equal(end.atStart, false);
  assert.equal(end.atEnd, true);
});

test("one arrow press moves close to a full port without ever standing still", () => {
  assert.equal(navPageStep(1138), 819);
  assert.equal(navPageStep(0), 120);
  assert.equal(navPageStep(100), 120);
});

test("the vertical wheel of a plain mouse scrolls the dock sideways", () => {
  assert.equal(navWheelDelta({ deltaX: 0, deltaY: 120 }), 120);
  assert.equal(navWheelDelta({ deltaX: -40, deltaY: 6 }), -40);
  assert.equal(navWheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 }), 54);
  assert.equal(navWheelDelta({}), 0);
  assert.equal(navWheelDelta({ deltaY: Number.NaN }), 0);
});

test("the open section is recentred only when it is off screen", () => {
  assert.equal(
    navTabIsVisible({ portLeft: 100, portRight: 900, tabLeft: 120, tabRight: 220 }),
    true,
  );
  assert.equal(
    navTabIsVisible({ portLeft: 100, portRight: 900, tabLeft: 860, tabRight: 980 }),
    false,
  );
  assert.equal(navTabIsVisible({ portLeft: 100, portRight: 900, tabLeft: 20, tabRight: 140 }), false);

  assert.equal(
    navCenterTarget({
      scrollLeft: 0,
      portLeft: 100,
      portWidth: 800,
      tabLeft: 1000,
      tabWidth: 120,
      max: 600,
    }),
    560,
  );
  // Never past the ends of the track.
  assert.equal(
    navCenterTarget({ scrollLeft: 0, portLeft: 100, portWidth: 800, tabLeft: 120, tabWidth: 120, max: 600 }),
    0,
  );
  assert.equal(
    navCenterTarget({ scrollLeft: 500, portLeft: 100, portWidth: 800, tabLeft: 1400, tabWidth: 120, max: 600 }),
    600,
  );
});
