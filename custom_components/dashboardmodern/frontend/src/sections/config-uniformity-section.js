// DM-FIX-20260818B
/* One Configuration, one set of gestures.
 *
 * The editor grew a tab at a time and each tab ended up answering the same
 * questions differently. Opening every tab and counting what is on screen says
 * it plainly:
 *
 * - five tabs had no way to save at all (Temperatura, Tapparelle, Stanze, Luci,
 *   Avvisi) while the others had one — and Sicurezza and EV had two, in
 *   different places, with eight different wordings for the same act between
 *   them: "Salva sezione", "Salva Energia", "Salva server", "Salva piscina",
 *   "Salva impostazioni", "Salva generali", "Salva costi", "Salva Report";
 * - the green "sezione visibile in dashboard" banner was on nine tabs and
 *   missing from Temperatura, which has exactly the same kind of switch as the
 *   others — its tab is simply drawn by a different renderer;
 * - every section tab carried the whole form: thirteen accordions and 104
 *   entity fields, twelve of them hidden. Every decorator in the editor walked
 *   all of them on every pass, and a stray `display` from anywhere put another
 *   section's form on screen.
 *
 * This owns those three things, and only those three. It never renders a
 * section's content and never saves anything itself: the save it offers is the
 * tab's own save buttons, pressed for the panels that are on screen, and the
 * visibility banner is the runtime's own `cdSecToggleHtml` markup with the
 * runtime's own `edSecTog` handler.
 */
import { clean, doc, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CONFIG_UNIFORMITY__";
const STYLE_ID = "dm-config-uniformity-style";
const state = (root[KEY] ||= { installed: false, frame: 0, watched: null, observer: null });

/* The tab of a dashboard section, and the visibility key that section has.
 *
 * The `sez*` ordinals are the runtime's own (`cdSecKeyByOrd`); the rest are the
 * keys `editorSwitch` already passes to `cdSecToggleHtml` when it prints those
 * tabs. Temperature is in the list for the same reason as all the others — it
 * has a switch — and it is the one the editor forgot. */
export const TAB_SECTION_KEYS = Object.freeze({
  sez0: "home",
  sez1: "energy",
  sez2: "ev",
  sez3: "boiler",
  sez4: "security",
  sez6: "server",
  sez7: "temp",
  sez9: "clima",
  tapp: "tapparelle",
  pool: "piscina",
  irr: "irrigazione",
  appliances: "appliances",
});

/* Tabs that hold no configuration to save: diagnostics is read-only, and the
 * visibility tab has its own single control. */
const NO_SAVE_TABS = new Set(["runtime", "visib", "export", "rileva"]);

/* What counts as "save this section". Add buttons, profile buttons and the
 * visibility banner are not saves, however much their label looks like one:
 * they are matched by the handler they carry, never by their wording. */
const SAVE_SELECTOR = [
  ".ed-save-btn",
  "[data-energy-save]",
  "[data-report-save]",
  "[data-dm-loads-save]",
  // Matched on any element: some of these controls are a div with an onclick,
  // not a button.
  '[onclick*="edSaveSezione"]',
  '[onclick*="edSecSave"]',
  '[onclick*="edSaveCosti"]',
  '[onclick*="edPoolSaveCfg"]',
  '[onclick*="edIrrSaveCfg"]',
].join(",");

export function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function editorBody() {
  return doc?.getElementById("ed-body") || null;
}

/* ── one section per tab ──────────────────────────────────────────────────── */

/* `edFilterSez` leaves every other section in the document with `display:none`.
 * Hidden is not gone: the fields are still decorated, the save buttons are
 * still there to be found, and one stray rule puts another section's form on
 * screen. The tab keeps exactly what the runtime chose to show. */
export function pruneHiddenSections(body = editorBody(), tab = activeTab()) {
  if (!body || !/^sez\d+$/.test(tab)) return 0;
  const accordions = [...body.querySelectorAll("details.ed-acc")];
  // Never empty the tab: if the runtime hid all of them, something upstream
  // has not finished, and removing the lot would leave a blank page.
  const visible = accordions.filter((node) => node.style.display !== "none");
  if (!visible.length) return 0;
  let removed = 0;
  for (const node of accordions) {
    if (node.style.display !== "none") continue;
    node.remove();
    removed += 1;
  }
  return removed;
}

/* ── the same switch, on every section ────────────────────────────────────── */

function bannerMarkup(key) {
  try {
    return clean(root.cdSecToggleHtml?.(key));
  } catch (_error) {
    return "";
  }
}

/* The runtime prints this banner itself on most tabs. Where it does not — the
 * tabs a canonical renderer draws — it is printed here, from the same markup
 * and the same handler, so the switch behaves identically wherever it is. */
export function ensureVisibilityBanner(body = editorBody(), tab = activeTab()) {
  if (!body) return false;
  const key = TAB_SECTION_KEYS[tab];
  const existing = [...body.querySelectorAll("[data-key][onclick*='edSecTog']")];
  if (!key) {
    // Only ever a banner this module printed. The Visibilità tab is made of
    // these very switches, one per section — taking them away there would empty
    // the tab, and the runtime would print them again on the next pass, which is
    // a fight with no end.
    existing.filter((node) => node.dataset.dmSectionSwitch === "true").forEach((n) => n.remove());
    return false;
  }
  // More than one is the runtime's and ours together: keep the first.
  existing.slice(1).forEach((node) => node.remove());
  let banner = existing[0];
  if (!banner) {
    const markup = bannerMarkup(key);
    if (!markup) return false;
    const holder = doc.createElement("div");
    holder.innerHTML = markup;
    banner = holder.firstElementChild;
    if (!banner) return false;
    banner.dataset.dmSectionSwitch = "true";
    body.prepend(banner);
  } else if (!body.firstElementChild?.contains(banner)) {
    // Always in the block that opens the tab. Where the runtime already prints
    // it inside its own wrapper — the EV tab wraps the switch together with the
    // vehicle profiles — it is left in that wrapper rather than torn out of it.
    body.prepend(banner);
  }
  banner.classList.add("dm-section-switch");
  return true;
}

/* ── one save, in one place, on every tab ─────────────────────────────────── */

function sectionSaves(body) {
  return [...body.querySelectorAll(SAVE_SELECTOR)].filter(
    (button) => !button.closest("[data-dm-save-footer]"),
  );
}

/* A save belongs to a panel; the panel is what tells us whether the user is
 * looking at it. The button itself is hidden by this module, so it is never the
 * thing measured. */
function panelOnScreen(button) {
  const panel =
    button.closest("[data-energy-panel],details.ed-acc,.ed-form,.ed-list") || button.parentElement;
  return !panel || panel.getClientRects().length > 0;
}

function pressTabSaves(body) {
  const buttons = sectionSaves(body).filter(panelOnScreen);
  if (!buttons.length) {
    // Tabs whose rows are written as they are edited still answer the gesture,
    // with the runtime's own "section saved" acknowledgement.
    try {
      root.edSecSave?.();
    } catch (_error) {}
    return 0;
  }
  let pressed = 0;
  for (const button of buttons) {
    try {
      button.click();
      pressed += 1;
    } catch (_error) {}
  }
  return pressed;
}

export function ensureSaveFooter(body = editorBody(), tab = activeTab()) {
  if (!body) return false;
  if (NO_SAVE_TABS.has(tab)) {
    body.querySelector(":scope > [data-dm-save-footer]")?.remove();
    return false;
  }
  let footer = body.querySelector(":scope > [data-dm-save-footer]");
  if (!footer) {
    footer = doc.createElement("div");
    footer.className = "dm-save-footer";
    footer.dataset.dmSaveFooter = "true";
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "ed-save-btn dm-save-footer-btn";
    button.dataset.dmSaveAll = "true";
    button.textContent = `💾 ${t("Salva sezione", "Save section")}`;
    footer.append(button);
    // The acknowledgement is the runtime's own toast, the one every save in the
    // editor has always raised. A second status of our own would be one more
    // thing that behaves differently from tab to tab.
    button.addEventListener("click", () => pressTabSaves(body));
  }
  // Always the last thing on the tab, whatever the tab appended after it.
  if (body.lastElementChild !== footer) body.append(footer);
  return true;
}

/* ── pass ─────────────────────────────────────────────────────────────────── */

export function uniformConfiguration(body = editorBody(), tab = activeTab()) {
  if (!body || !tab) return false;
  pruneHiddenSections(body, tab);
  ensureVisibilityBanner(body, tab);
  ensureSaveFooter(body, tab);
  body.dataset.dmConfigUniform = tab;
  return true;
}

/* A tab does not finish drawing in one frame.
 *
 * Several panels of the configuration are printed by their own owner after the
 * tab has switched — the vehicle's brand and model, the server parameters, the
 * energy panels. A single pass would run before those exist and leave their
 * save buttons on screen next to the tab's own, and a panel printed at the top
 * would push the section switch out of the opening block. Waiting a fixed
 * number of milliseconds only moves the race: on a loaded machine the owner
 * still arrives late. What the pass answers to instead is the tab itself
 * changing — every time the block list of the tab changes, whoever changed it,
 * the pass runs again on the next frame. The two delays are kept for the panels
 * that arrive without touching that list. */
const SETTLE_DELAYS = Object.freeze([120, 420, 900, 1800]);

/* Scoped to `#ed-body`: the blocks of the tab, and the inline `display` the
 * runtime writes on them.
 *
 * Both matter. The switch and the save are placed among the blocks, so the
 * block list is one half; the other half is `edFilterSez`, which chooses the
 * tab's section by hiding the other twelve with an inline style and changes no
 * block at all. On a slow device that filtering lands after the tab has
 * switched — on the WebKit runner it landed after every timer this module had
 * — and a pass that only heard about blocks never learned the tab had been
 * narrowed. Nothing deeper than the inline style is observed, and the document
 * never is. This module writes no inline styles itself, so it cannot wake
 * itself. */
function watchEditorBody() {
  const body = editorBody();
  if (!body || state.watched === body) return;
  if (typeof root.MutationObserver !== "function") return;
  state.observer?.disconnect?.();
  state.observer = new root.MutationObserver(() => schedule({ settle: false }));
  state.observer.observe(body, {
    childList: true,
    attributes: true,
    attributeFilter: ["style"],
    subtree: true,
  });
  state.watched = body;
}

function schedule({ settle = true } = {}) {
  watchEditorBody();
  if (settle) {
    for (const delay of SETTLE_DELAYS) {
      root.setTimeout?.(() => schedule({ settle: false }), delay);
    }
  }
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    uniformConfiguration();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
    /* the section switch: same block, same place, on every tab that has one */
    #ed-body > .dm-section-switch{
      display:block!important;box-sizing:border-box!important;width:100%!important;
      margin:0 0 12px!important;order:-1!important
    }

    /* The save: one control, at the end of the tab, the same everywhere.
     *
     * The tab's own save buttons are hidden by the rule itself rather than by a
     * marker this module writes: a panel that redraws itself after the pass —
     * Irrigazione does, and so do the vehicle and server panels — would come
     * back with an unmarked button and a second save on screen. A selector
     * cannot go stale. The buttons stay in the document and stay the thing that
     * actually saves; the footer presses them. */
    /* The id is repeated to outweigh the per-tab rules that pin these same
     * buttons to display:flex — the Irrigazione one is
     * #editor-modal #ed-body:has(#ed-irr-ent) .ed-btn-add, three ids' worth.
     * Same element set, enough weight to be the one that decides. */
    #ed-body#ed-body#ed-body[data-dm-config-uniform]:not([data-dm-config-uniform="visib"]):not([data-dm-config-uniform="runtime"]) :is(
      .ed-save-btn,
      [data-energy-save],
      [data-report-save],
      [data-dm-loads-save],
      [onclick*="edSaveSezione"],
      [onclick*="edSecSave"],
      [onclick*="edSaveCosti"],
      [onclick*="edPoolSaveCfg"],
      [onclick*="edIrrSaveCfg"]
    ):not(.dm-save-footer-btn){display:none!important}
    #ed-body > .dm-save-footer{
      display:flex!important;align-items:center!important;gap:12px!important;flex-wrap:wrap!important;
      box-sizing:border-box!important;width:100%!important;margin:18px 0 4px!important;padding:14px 0 0!important;
      border-top:1px solid var(--divider-color,#dbe4ee)!important
    }
    #ed-body > .dm-save-footer > .dm-save-footer-btn{
      flex:1 1 220px!important;min-height:48px!important;margin:0!important
    }
    @media(max-width:600px){
      #ed-body > .dm-save-footer > .dm-save-footer-btn{flex:1 1 100%!important}
    }
  `,
  );
}

function bindLegacyEntryPoints() {
  wrapFunction("editorSwitch", "__dmConfigUniform_editorSwitch", schedule);
  wrapFunction("apriConfigEntita", "__dmConfigUniform_apriConfigEntita", schedule);
  wrapFunction("edFilterSez", "__dmConfigUniform_edFilterSez", schedule);
}

export function installConfigUniformitySection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(eventName, () => {
      bindLegacyEntryPoints();
      schedule();
    });
  }
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(".ed-tab,[data-tab],[data-energy-tab],.ed-btn-add,.ed-del")) {
        root.setTimeout?.(schedule, 0);
      }
    },
    true,
  );
  bindLegacyEntryPoints();
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installConfigUniformitySection, { once: true });
} else {
  installConfigUniformitySection();
}
