import { ACTION_ICON_CATALOG, actionVisual } from "../core/personalization-catalog.js";
import { clean, doc, esc, installStyle, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA7_REGRESSIONS__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  listeners: false,
  shutterSignature: "",
});

const ACTION_DEFAULTS = Object.freeze({
  luci_group: "mdi:lightbulb-group",
  builtin_luci: "mdi:lightbulb-group",
  builtin_clima: "mdi:snowflake",
  builtin_antifurto: "mdi:shield-home",
  builtin_lavatrice: "mdi:washing-machine",
  toggle: "mdi:toggle-switch-outline",
  script: "mdi:script-text-play",
  scene: "mdi:movie-open",
});

const BRAND_FALLBACKS = Object.freeze({
  abarth: "<path d='M20 5h24l-3 9-9 4 6 5-4 12-8 5-8-5-4-12 6-5-9-4z' fill='none' stroke='currentColor' stroke-width='2.8'/><path d='M27 13l-5 8 6 1-4 8 11-11-7-1 4-5z' fill='currentColor'/>",
  "alfa-romeo": "<circle cx='32' cy='22' r='16' fill='none' stroke='currentColor' stroke-width='2.7'/><path d='M24 10v24M17 17h14' stroke='currentColor' stroke-width='2.3'/><path d='M38 11c-7 6-2 9-7 13 8 0 10 5 5 11 9-4 12-13 2-24z' fill='currentColor' opacity='.78'/>",
  byd: "<ellipse cx='32' cy='22' rx='25' ry='13' fill='none' stroke='currentColor' stroke-width='2.6'/><text x='32' y='27' text-anchor='middle' font-size='14' font-weight='900' font-family='system-ui'>BYD</text>",
  cupra: "<path d='M12 15l13 4 7 12 7-12 13-4-9 11 7 8-14-5-4 8-4-8-14 5 7-8z' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linejoin='round'/>",
});

function actionType(action = {}) {
  return action.type === "builtin" ? `builtin_${clean(action.builtin)}` : clean(action.type);
}

function actionToken(action = {}) {
  const raw = clean(action.icon);
  if (raw) return raw;
  return ACTION_DEFAULTS[actionType(action)] || "mdi:star";
}

function visibleActionMarkup(action = {}, size = 34) {
  const token = actionToken(action);
  const matched = ACTION_ICON_CATALOG.find((item) => item.mdi === token || item.glyph === token);
  return actionVisual(matched?.mdi || token, size) || `<span class="dm-action-glyph dm-beta7-action-fallback" style="font-size:${Math.max(20, Math.round(size * .58))}px">${esc(matched?.glyph || "⭐")}</span>`;
}

function brandFallbackMarkup(img) {
  const key = clean(img?.dataset?.dmBrandImage).toLowerCase();
  const name = clean(img?.alt || key || "Auto");
  const initials = name
    .split(/[\s-]+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const body = BRAND_FALLBACKS[key] || `<rect x='7' y='5' width='50' height='34' rx='12' fill='none' stroke='currentColor' stroke-width='2.4'/><text x='32' y='27' text-anchor='middle' font-size='13' font-weight='900' font-family='system-ui'>${esc(initials || "EV")}</text>`;
  return `<span class="dm-beta7-brand-fallback" data-dm-brand-fallback="${esc(key)}" title="${esc(name)}"><svg viewBox="0 0 64 44" role="img" aria-label="${esc(name)}">${body}</svg></span>`;
}

function repairBrandImage(img) {
  if (!img?.matches?.("img[data-dm-brand-image]") || img.dataset.dmBeta7Repaired === "true") return false;
  const failed = img.complete && Number(img.naturalWidth) === 0;
  if (!failed) return false;
  img.dataset.dmBeta7Repaired = "true";
  const parent = img.parentElement;
  if (!parent) return false;
  parent.innerHTML = brandFallbackMarkup(img);
  parent.closest?.(".dm-car-brand")?.setAttribute("data-brand-source", "inline-fallback");
  return true;
}

function repairBrandImages() {
  let changed = false;
  doc?.querySelectorAll?.("img[data-dm-brand-image]").forEach((img) => {
    changed = repairBrandImage(img) || changed;
  });
  return changed;
}

function polishQuickActionCards() {
  const grid = doc?.getElementById?.("qa-grid");
  if (!grid) return false;
  const actions = typeof root.getQuickActions === "function" ? root.getQuickActions() : readJson("cd_quick_actions", []);
  grid.querySelectorAll(".qa-btn").forEach((button, index) => {
    const action = actions?.[index] || {};
    const target = button.querySelector(".icon");
    if (!target) return;
    const token = `${actionType(action)}|${actionToken(action)}`;
    if (target.dataset.dmBeta7VisibleIcon === token) return;
    target.dataset.dmBeta7VisibleIcon = token;
    target.innerHTML = visibleActionMarkup(action, 42);
  });
  return true;
}

function hideRawMdiText(row, token) {
  row?.querySelectorAll?.("span,div,b,strong,small").forEach((node) => {
    if (node.children.length) return;
    const text = clean(node.textContent);
    if (/^mdi:[a-z0-9-]+$/i.test(text) || (token && text === token)) {
      node.textContent = "";
      node.classList.add("dm-beta7-hidden-mdi-text");
    }
  });
}

function polishQuickActionRows() {
  const actions = typeof root.getQuickActions === "function" ? root.getQuickActions() : readJson("cd_quick_actions", []);
  doc?.querySelectorAll?.('#ed-body [data-dm-edit-kind="action"]').forEach((edit) => {
    const row = edit.closest?.(".ed-row");
    if (!row) return;
    row.classList.add("dm-beta7-action-row");
    const index = Number.parseInt(edit.dataset.dmEditIndex || "-1", 10);
    const action = Number.isFinite(index) && index >= 0 ? actions?.[index] || {} : {};
    let icon = row.querySelector(".dm-beta7-existing-action-icon");
    if (!icon) {
      icon = doc.createElement("span");
      icon.className = "dm-beta7-existing-action-icon";
      row.prepend(icon);
    }
    icon.innerHTML = visibleActionMarkup(action, 32);
    hideRawMdiText(row, clean(action.icon));
  });
}

function polishQuickActionForm() {
  const type = doc?.getElementById?.("ed-qa-type");
  const iconInput = doc?.getElementById?.("ed-qa-icon");
  if (!type || !iconInput) return false;
  const row = iconInput.closest?.(".ed-form-row") || type.closest?.(".ed-form-row");
  if (!row) return false;
  row.classList.add("dm-beta7-action-form-row");
  const trigger = row.querySelector(".dm-beta6-qa-icon-trigger");
  if (trigger) {
    const current = {
      type: type.value.startsWith("builtin_") ? "builtin" : type.value,
      builtin: type.value.startsWith("builtin_") ? type.value.slice(8) : "",
      icon: iconInput.value,
    };
    trigger.innerHTML = visibleActionMarkup(current, 34);
    trigger.title = t("Scegli icona", "Choose icon");
  }
  return true;
}

function shutterSignature() {
  const list = readJson("cd_tapparelle", []);
  if (!Array.isArray(list)) return "";
  return list.map((item) => {
    const entity = clean(item?.entity);
    const current = root.STATES?.[entity] || root._RAW_STATES?.[entity] || {};
    return [entity, clean(item?.name), current.state, current.attributes?.current_position ?? ""].join("|");
  }).join(";");
}

function installShutterRenderGuard() {
  const current = root.renderTapparelle;
  if (typeof current !== "function" || current.__dmBeta7StableShutters) return false;
  function stableShutters(...args) {
    const signature = shutterSignature();
    const grid = doc?.getElementById?.("tapp-grid");
    if (signature && signature === state.shutterSignature && grid?.childElementCount) return undefined;
    state.shutterSignature = signature;
    return current.apply(this, args);
  }
  Object.assign(stableShutters, current);
  stableShutters.__dmBeta7StableShutters = true;
  stableShutters.__dmPrevious = current;
  root.renderTapparelle = stableShutters;
  return true;
}

function installPostRenderOwner(name, marker) {
  const current = root[name];
  if (typeof current !== "function" || current[marker]) return false;
  function owned(...args) {
    const result = current.apply(this, args);
    schedule();
    return result;
  }
  Object.assign(owned, current);
  owned[marker] = true;
  owned.__dmPrevious = current;
  root[name] = owned;
  return true;
}

function installOwners() {
  installShutterRenderGuard();
  installPostRenderOwner("buildQuickActions", "__dmBeta7VisibleQuickActions");
  installPostRenderOwner("editorSwitch", "__dmBeta7EditorLayout");
  installPostRenderOwner("edQaTypeChanged", "__dmBeta7ActionTypeLayout");
  installPostRenderOwner("edAddQA", "__dmBeta7ActionSaveLayout");
  installPostRenderOwner("dmRenderVehicleSelector", "__dmBeta7BrandFallbacks");
  installPostRenderOwner("buildClimaCards", "__dmBeta7ClimateLayout");
  installPostRenderOwner("renderTapparelle", "__dmBeta7ShutterLayout");
}

function run() {
  state.frame = 0;
  installOwners();
  repairBrandImages();
  polishQuickActionCards();
  polishQuickActionRows();
  polishQuickActionForm();
  root.dmRefreshEnergyFlows?.();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installStyles() {
  installStyle("dm-beta7-regression-style", `
    /* Brand auto: nessun riquadro rotto. Se il CDN non risponde viene mostrato
       immediatamente un marchio SVG locale e stabile. */
    .dm-beta7-brand-fallback{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;color:var(--primary-text-color,var(--text,#0f172a))!important}
    .dm-beta7-brand-fallback svg{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;overflow:visible!important}
    .dm-car-brand[data-brand-source="inline-fallback"]{display:grid!important;place-items:center!important}

    /* Azioni rapide Home: icona sempre visibile anche quando ha-icon non viene
       definito nel WebView di Home Assistant. */
    #qa-grid .qa-btn .icon{display:grid!important;place-items:center!important;min-width:54px!important;min-height:54px!important;line-height:1!important;color:var(--accent,#0ea5e9)!important}
    #qa-grid .qa-btn .dm-action-glyph,.dm-beta7-existing-action-icon .dm-action-glyph,.dm-beta6-qa-icon-trigger .dm-action-glyph{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;line-height:1!important}
    #qa-grid .qa-btn .dm-action-glyph>span{display:block!important;line-height:1!important}

    /* Riga azione già configurata: icona, testo, modifica e cestino leggibili. */
    #editor-modal .ed-row.dm-beta7-action-row{display:grid!important;grid-template-columns:46px minmax(0,1fr) 42px 42px!important;align-items:center!important;gap:9px!important;min-height:72px!important;padding:10px 12px!important;overflow:hidden!important}
    #editor-modal .dm-beta7-existing-action-icon{display:grid!important;place-items:center!important;width:42px!important;height:42px!important;border-radius:13px!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 10%,var(--card-background-color,#fff))!important;color:var(--accent,#0ea5e9)!important;grid-column:1!important;grid-row:1!important}
    #editor-modal .dm-beta7-action-row>.dm-beta7-existing-action-icon~:not(.ed-del):not([data-dm-edit-kind]){min-width:0!important}
    #editor-modal .dm-beta7-action-row [data-dm-edit-kind="action"]{grid-column:3!important;width:42px!important;height:42px!important;margin:0!important}
    #editor-modal .dm-beta7-action-row .ed-del:not([data-dm-edit-kind]){grid-column:4!important;width:42px!important;height:42px!important;margin:0!important}
    #editor-modal .dm-beta7-hidden-mdi-text{display:none!important}

    /* Form Azioni: tipo + icona sulla prima riga, nome a tutta larghezza. */
    #editor-modal .ed-form-row.dm-beta7-action-form-row{display:grid!important;grid-template-columns:minmax(0,1fr) 64px!important;grid-template-areas:"type icon" "name name"!important;align-items:stretch!important;gap:10px!important;width:100%!important}
    #editor-modal .dm-beta7-action-form-row #ed-qa-type{grid-area:type!important;display:block!important;width:100%!important;min-width:0!important;min-height:54px!important;margin:0!important;padding:0 14px!important;font-size:14px!important;color:var(--primary-text-color,var(--text,#0f172a))!important;background:var(--card-background-color,var(--card-bg,#fff))!important}
    #editor-modal .dm-beta7-action-form-row #ed-qa-name{grid-area:name!important;display:block!important;width:100%!important;min-width:0!important;min-height:54px!important;margin:0!important;padding:0 14px!important}
    #editor-modal .dm-beta7-action-form-row #ed-qa-icon{display:none!important}
    #editor-modal .dm-beta7-action-form-row .dm-beta6-qa-icon-trigger{grid-area:icon!important;display:grid!important;place-items:center!important;width:64px!important;min-width:64px!important;max-width:64px!important;height:54px!important;min-height:54px!important;margin:0!important;padding:8px!important;border-radius:16px!important;background:var(--card-background-color,var(--card-bg,#fff))!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;color:var(--accent,#0ea5e9)!important;overflow:hidden!important}

    /* Clima: su telefono due card compatte per riga, senza aspect-ratio quadrato
       che dilata target, temperatura ambiente e barra comandi. */
    #page-clima .clima-premium-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
    #page-clima .cp-card{aspect-ratio:auto!important;min-height:248px!important;height:auto!important;padding:18px!important;gap:14px!important;border-radius:22px!important;justify-content:space-between!important}
    #page-clima .cp-header{gap:10px!important}
    #page-clima .cp-title-wrap{min-width:0!important;gap:10px!important}
    #page-clima .cp-name{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:15px!important}
    #page-clima .cp-badge{flex:0 0 auto!important}
    #page-clima .cp-body{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:end!important;gap:16px!important;padding:2px 2px 4px!important}
    #page-clima .cp-temp-target .val{font-size:46px!important;line-height:.95!important}
    #page-clima .cp-temp-current-wrap{align-items:flex-end!important;text-align:right!important}
    #page-clima .cp-temp-current{font-size:23px!important;line-height:1!important}
    #page-clima .cp-controls{min-height:58px!important;padding:6px!important;border-radius:17px!important}
    #page-clima .cp-btn{height:46px!important;font-size:20px!important}

    /* Tapparella: finestra moderna, cassonetto e lamelle metalliche continue.
       La funzione legacy viene anche protetta dai rerender identici ogni 2 s. */
    #page-tapparelle .tapp-card{padding:16px!important;gap:12px!important;border-radius:24px!important;overflow:hidden!important}
    #page-tapparelle .tapp-head{padding:0 2px!important}
    #page-tapparelle .tapp-name{font-size:16px!important}
    #page-tapparelle .tapp-win{position:relative!important;height:180px!important;border:1px solid rgba(100,116,139,.22)!important;border-radius:22px!important;overflow:hidden!important;background:linear-gradient(180deg,#dff4ff 0%,#cce9f7 45%,#eef7fb 100%)!important;box-shadow:inset 0 0 0 9px rgba(255,255,255,.82),inset 0 -28px 42px rgba(30,64,175,.08),0 10px 26px rgba(15,23,42,.08)!important}
    #page-tapparelle .tapp-glass{position:absolute!important;inset:10px!important;border-radius:15px!important;background:linear-gradient(135deg,rgba(255,255,255,.72),rgba(255,255,255,.12) 42%,rgba(14,165,233,.08))!important;box-shadow:inset 0 0 0 1px rgba(100,116,139,.12)!important}
    #page-tapparelle .tapp-glass::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;transform:translateX(-1px);background:rgba(148,163,184,.32)!important}
    #page-tapparelle .tapp-glass::after{content:"";position:absolute;left:0;right:0;top:50%;height:2px;transform:translateY(-1px);background:rgba(148,163,184,.24)!important}
    #page-tapparelle .tapp-shutter{left:9px!important;right:9px!important;top:9px!important;width:auto!important;border-radius:14px 14px 9px 9px!important;overflow:hidden!important;background:repeating-linear-gradient(180deg,#edf3f8 0 9px,#cbd6e0 9px 11px,#aab9c8 11px 13px)!important;box-shadow:0 10px 18px rgba(15,23,42,.18),inset 0 -1px 0 rgba(51,65,85,.28)!important;transition:height .58s cubic-bezier(.22,.82,.28,1)!important;will-change:height,background-position!important}
    #page-tapparelle .tapp-shutter::before{content:"";position:absolute;left:0;right:0;top:0;height:12px;background:linear-gradient(180deg,#f8fbfd,#b9c7d4)!important;box-shadow:0 2px 4px rgba(15,23,42,.18)!important;z-index:2}
    #page-tapparelle .tapp-shutter::after{content:"";position:absolute;left:5px;right:5px;bottom:0;height:7px;border-radius:0 0 7px 7px;background:linear-gradient(180deg,#9baabb,#718296)!important;box-shadow:0 2px 5px rgba(15,23,42,.2)!important}
    #page-tapparelle .tapp-shutter i{opacity:0!important;flex:0 0 11px!important;height:11px!important;border:0!important;background:transparent!important}
    #page-tapparelle .tapp-shutter.opening,#page-tapparelle .tapp-shutter.closing{animation:dmBeta7ShutterRoll .55s linear infinite!important}
    @keyframes dmBeta7ShutterRoll{to{background-position:0 26px}}
    #page-tapparelle .tapp-pos{font-size:15px!important;font-weight:900!important;opacity:1!important;color:var(--primary-text-color,var(--text,#0f172a))!important}
    #page-tapparelle .tapp-ctl{gap:9px!important}
    #page-tapparelle .tapp-btn{height:46px!important;border-radius:14px!important;font-weight:850!important;box-shadow:0 6px 14px rgba(14,165,233,.18)!important}

    @media(max-width:760px){
      #page-clima .clima-premium-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
      #page-clima .cp-card{min-height:0!important;padding:18px 20px!important;gap:16px!important}
      #page-clima .cp-temp-target .val{font-size:43px!important}
      #page-tapparelle #tapp-grid{grid-template-columns:1fr!important;padding:10px 0!important;gap:14px!important}
      #page-tapparelle .tapp-win{height:190px!important}
      #editor-modal .ed-row.dm-beta7-action-row{grid-template-columns:44px minmax(0,1fr) 40px 40px!important;gap:7px!important;padding:9px!important}
    }

    @media(hover:none){
      #page-clima .cp-card:hover,#page-tapparelle .tapp-card:hover,#qa-grid .qa-btn:hover{transform:none!important}
    }
  `);
}

export function installBeta7RegressionSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installOwners();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("error", (event) => {
      const target = event.target;
      if (target?.matches?.("img[data-dm-brand-image]")) {
        repairBrandImage(target);
        schedule();
      }
    }, true);
    doc.addEventListener("click", (event) => {
      if (event.target?.closest?.('.ed-tab[data-tab="sez8"],.tab[data-tab="clima"],.tab[data-tab="tapparelle"],.tab[data-tab="ev"]'))
        root.setTimeout?.(schedule, 0);
    }, true);
    doc.addEventListener("change", (event) => {
      if (event.target?.id === "ed-qa-type" || event.target?.id === "ed-qa-icon") schedule();
    }, true);
  }
  root.addEventListener?.("dashboardmodern:legacy-ready", () => { installOwners(); schedule(); });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => { installOwners(); schedule(); });
  root.addEventListener?.("dashboardmodern:states-ready", schedule);
  schedule();
}

installBeta7RegressionSection();
