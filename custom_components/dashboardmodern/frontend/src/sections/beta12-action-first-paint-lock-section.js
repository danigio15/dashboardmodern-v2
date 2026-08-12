import { actionCatalogMatch } from "../core/personalization-catalog.js";
import { clean, doc, installStyle, readJson, root } from "./shared.js";

// Beta12 final owner for Quick Actions. A bounded v0.15.25 compatibility pass
// still repaints child markup at 90/320/900ms on some WebKit runs. The visible
// glyph therefore lives on the stable .icon host as data, while child markup is
// kept only as semantic/fallback content. Late child-only painters cannot cause
// a wrong first/next frame anymore.
const KEY = "__DASHBOARDMODERN_BETA12_ACTION_FIRST_PAINT_LOCK__";
const state = (root[KEY] ||= { installed: false, listeners: false });

const BUILTIN_TOKENS = Object.freeze({
  luci: "mdi:lightbulb",
  luci_group: "mdi:lightbulb-group",
  clima: "mdi:snowflake",
  antifurto: "mdi:shield-home",
  lavatrice: "mdi:washing-machine",
});

function directGlyph(value) {
  const token = clean(value);
  if (!token || token.toLowerCase().startsWith("mdi:")) return "";
  return /[^\p{L}\p{N}\s:_-]/u.test(token) && token.length <= 16 ? token : "";
}

function configuredActions() {
  // Persisted config is authoritative. getQuickActions() is deliberately only
  // a fallback because older compatibility layers can expose a stale snapshot
  // for one render turn after editing or restoring configuration.
  const persisted = readJson("cd_quick_actions", []);
  if (Array.isArray(persisted) && persisted.length) return persisted;
  try {
    const values = root.getQuickActions?.();
    return Array.isArray(values) ? values : [];
  } catch (_error) {
    return [];
  }
}

function tokenFor(action = {}) {
  const configured = clean(action.icon);
  if (configured) return configured;
  const builtin = clean(action.builtin).toLowerCase();
  const type = clean(action.type).toLowerCase().replace(/^builtin_/, "");
  return BUILTIN_TOKENS[builtin] || BUILTIN_TOKENS[type] || "mdi:star";
}

function glyphFor(token) {
  return directGlyph(token) || actionCatalogMatch(token)?.glyph || "⭐";
}

function semanticGlyph(token, glyph) {
  const holder = doc.createElement("span");
  holder.className = "dm-beta12-action-glyph";
  holder.dataset.token = token;
  holder.setAttribute("aria-hidden", "true");
  holder.textContent = glyph;
  return holder;
}

function repair() {
  if (!doc) return false;
  const actions = configuredActions();
  const icons = [...doc.querySelectorAll("#qa-grid .qa-btn .icon")];
  icons.forEach((icon, index) => {
    const token = tokenFor(actions[index] || {});
    const glyph = glyphFor(token);
    const signature = `${token}|${glyph}`;
    icon.dataset.dmBeta12DisplayGlyph = glyph;
    icon.dataset.dmBeta12DisplayToken = token;
    icon.dataset.dmBeta12FirstPaint = signature;
    icon.dataset.dmActionStyle = "beta12-stable";

    const current = icon.querySelector(":scope > .dm-beta12-action-glyph");
    if (!current || current.dataset.token !== token || clean(current.textContent) !== glyph) {
      icon.replaceChildren(semanticGlyph(token, glyph));
    }
  });
  return icons.length > 0;
}

function wrapOwner(name) {
  const current = root[name];
  if (typeof current !== "function" || current.__dmBeta12ActionFirstPaintLock) return false;
  function wrapped(...args) {
    const result = current.apply(this, args);
    const finish = () => {
      // Synchronous after the render owner: the data-backed pseudo glyph is in
      // place before the browser gets a chance to paint the newly built card.
      repair();
      root.queueMicrotask?.(repair);
    };
    if (result && typeof result.finally === "function") result.finally(finish);
    else finish();
    return result;
  }
  Object.assign(wrapped, current);
  wrapped.__dmBeta12ActionFirstPaintLock = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

function installOwners() {
  wrapOwner("buildQuickActions");
  wrapOwner("render");
}

function install() {
  if (!doc) return;
  installOwners();
  repair();
  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
    ]) root.addEventListener?.(eventName, () => {
      installOwners();
      repair();
      root.queueMicrotask?.(repair);
    });

    // Run before Quick Action click handlers. The host data remains stable even
    // if a legacy handler replaces child markup while opening its popup.
    root.addEventListener?.("click", (event) => {
      if (!event.target?.closest?.("#qa-grid .qa-btn")) return;
      repair();
      root.queueMicrotask?.(repair);
    }, true);
  }
}

installStyle("dm-beta12-action-first-paint-lock-style", `
  #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]{
    position:relative!important;display:grid!important;place-items:center!important;
    overflow:visible!important;color:initial!important
  }
  #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]>*{display:none!important}
  #qa-grid .qa-btn .icon[data-dm-beta12-display-glyph]::before{
    content:attr(data-dm-beta12-display-glyph)!important;
    display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
    font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;
    font-size:34px!important;font-style:normal!important;font-weight:400!important;line-height:1!important;
    color:initial!important;filter:drop-shadow(0 5px 8px rgba(15,23,42,.12))!important
  }
`);

if (!state.installed) {
  state.installed = true;
  if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
}
