import { actionCatalogMatch } from "../core/personalization-catalog.js";
import { clean, doc, installStyle, root } from "./shared.js";

// The beta11 compatibility layer intentionally performs one last room-row repair
// 80ms after the editor renders. It preserves data-room-icon, so beta12 can use
// that stable semantic token as the visual owner and cannot regress to a blue
// outline even when the delayed compatibility pass rewrites the child markup.
//
// This final compatibility owner also resolves quick-action artwork from the
// actual legacy config source. In the hosted/namespaced runtime the legacy
// renderer reads browser localStorage while shared readJson() is intentionally
// scoped to the injected runtime root. Reading both sources here prevents the
// beta12 same-turn repair from falling back to a star before first paint.
const STYLE_ID = "dm-beta12-room-color-lock-style";
const OWNER_FLAG = "__dmBeta12ConfigAwareQuickActions";

const ACTION_BUILTINS = Object.freeze({
  luci: "mdi:lightbulb",
  luci_group: "mdi:lightbulb-group",
  clima: "mdi:snowflake",
  antifurto: "mdi:shield-home",
  lavatrice: "mdi:washing-machine",
  toggle: "mdi:toggle-switch-outline",
  script: "mdi:script-text-play",
  scene: "mdi:movie-open",
});

function directEmoji(value) {
  const token = clean(value);
  if (!token || token.startsWith("mdi:")) return "";
  return /[^\p{L}\p{N}\s:_-]/u.test(token) && token.length <= 12 ? token : "";
}

function actionGlyph(value) {
  const token = clean(value);
  const direct = directEmoji(token);
  if (direct) return direct;
  return actionCatalogMatch(token)?.glyph || "⭐";
}

function parseActionList(raw) {
  if (!raw) return [];
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
}

function quickActionsFromRuntime() {
  const candidates = [];
  for (const host of [globalThis, root]) {
    if (!host) continue;
    try { candidates.push(host.localStorage?.getItem?.("cd_quick_actions")); } catch (_error) {}
    candidates.push(host._CD_CFG?.quickActions);
    candidates.push(host.CD_BAKED_CONFIG?.cd_quick_actions);
    candidates.push(host.CD_BAKED_CONFIG?.quickActions);
  }
  for (const candidate of candidates) {
    const actions = parseActionList(candidate);
    if (actions.length) return actions;
  }
  return [];
}

function tokenForAction(action = {}, target = null) {
  const configured = clean(action.icon);
  if (configured) return configured;
  const builtin = clean(action.builtin).toLowerCase();
  const type = clean(action.type).toLowerCase();
  const builtinToken = ACTION_BUILTINS[builtin]
    || ACTION_BUILTINS[type.replace(/^builtin_/, "")];
  if (builtinToken) return builtinToken;

  // The legacy renderer writes the icon token/emoji as the icon node's text.
  // Preserve that source when no canonical action array is visible yet.
  const rendered = clean(target?.textContent);
  if (rendered && rendered !== "⭐" && rendered !== "★") return rendered;
  return "mdi:star";
}

function repairQuickActionsFromRuntime() {
  const nodes = [...(doc?.querySelectorAll?.("#qa-grid .qa-btn .icon") || [])];
  if (!nodes.length) return false;
  const actions = quickActionsFromRuntime();

  nodes.forEach((target, index) => {
    const action = actions[index] || {};
    const token = tokenForAction(action, target);
    const glyph = actionGlyph(token);
    const signature = `${token}|${glyph}`;
    if (target.dataset.dmBeta12ConfigAction === signature
      && target.querySelector(".dm-beta12-action-glyph")) return;

    const holder = doc.createElement("span");
    holder.className = "dm-beta12-action-glyph";
    holder.dataset.token = token;
    const visual = doc.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    visual.textContent = glyph;
    holder.appendChild(visual);
    target.replaceChildren(holder);
    target.dataset.dmBeta12ConfigAction = signature;
    target.dataset.dmActionStyle = "beta12-color";
  });
  return true;
}

function wrapQuickActionOwner() {
  const current = root.buildQuickActions;
  if (typeof current !== "function" || current[OWNER_FLAG]) return false;

  function wrapped(...args) {
    const result = current.apply(this, args);
    const repair = () => repairQuickActionsFromRuntime();
    if (result && typeof result.finally === "function") result.finally(repair);
    else repair();
    return result;
  }
  Object.assign(wrapped, current);
  wrapped[OWNER_FLAG] = true;
  // Beta12's earlier owner detector uses this marker; retaining it keeps this
  // config-aware wrapper outermost rather than letting a later ready event put
  // the generic fallback back on top.
  wrapped.__dmBeta12SynchronousPolish = true;
  wrapped.__dmPrevious = current;
  root.buildQuickActions = wrapped;
  return true;
}

function installQuickActionOwner() {
  wrapQuickActionOwner();
  repairQuickActionsFromRuntime();
}

for (const eventName of [
  "dashboardmodern:legacy-ready",
  "dashboardmodern:runtime-ready",
  "dashboardmodern:states-ready",
]) root.addEventListener?.(eventName, installQuickActionOwner);

installStyle(STYLE_ID, `
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]{
    position:relative!important;display:grid!important;place-items:center!important;
    color:initial!important;overflow:visible!important
  }
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]>*{display:none!important}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]::before{
    content:"🏠";display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
    font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:31px!important;
    font-style:normal!important;font-weight:400!important;line-height:1!important;color:initial!important;
    filter:drop-shadow(0 5px 8px rgba(15,23,42,.12))!important
  }
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:sofa"]::before{content:"🛋️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:stove"]::before{content:"🍳"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:bed-king-outline"]::before{content:"🛏️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:teddy-bear"]::before{content:"🧸"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:baby-face-outline"]::before{content:"👶"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:shower"]::before{content:"🚿"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:toilet"]::before{content:"🚽"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:table-chair"]::before{content:"🍽️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:desk"]::before{content:"💻"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:account-group-outline"]::before{content:"🛏️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:door-open"]::before,
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:door"]::before{content:"🚪"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:washing-machine"]::before{content:"🧺"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:food-variant"]::before{content:"🥫"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:hanger"]::before{content:"👗"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:archive-outline"]::before{content:"📦"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:balcony"]::before{content:"🌇"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:patio-heater"]::before{content:"🌤️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:garage"]::before{content:"🚗"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:glass-wine"]::before{content:"🍷"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:home-roof"]::before{content:"🏠"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:tools"]::before{content:"🛠️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:dumbbell"]::before{content:"🏋️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:movie-open-outline"]::before{content:"🎬"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:flower"]::before{content:"🌿"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:pool"]::before{content:"🏊"}
`);

installQuickActionOwner();
