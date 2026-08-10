import { clean, doc, installStyle, readJson, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA7_REVIEW_FIXES__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  shutterConfigSignature: "",
});

function currentShutterConfigSignature() {
  const list = readJson("cd_tapparelle", []);
  try {
    return JSON.stringify(Array.isArray(list) ? list : []);
  } catch (_error) {
    return "";
  }
}

function installShutterConfigOwner() {
  const current = root.renderTapparelle;
  if (typeof current !== "function" || current.__dmBeta7ConfigAwareShutters) return false;

  state.shutterConfigSignature = currentShutterConfigSignature();
  function configAwareShutters(...args) {
    const next = currentShutterConfigSignature();
    if (next !== state.shutterConfigSignature) {
      state.shutterConfigSignature = next;
      // beta7-regression skips identical state/position renders. A persisted
      // configuration change (room, floor, name, ordering, etc.) must bypass
      // that guard so grouping and headers update immediately.
      const regression = root.__DASHBOARDMODERN_BETA7_REGRESSIONS__;
      if (regression) regression.shutterSignature = "";
    }
    return current.apply(this, args);
  }

  Object.assign(configAwareShutters, current);
  configAwareShutters.__dmBeta7ConfigAwareShutters = true;
  configAwareShutters.__dmPrevious = current;
  root.renderTapparelle = configAwareShutters;
  return true;
}

function markLegacyActionIcons() {
  doc?.querySelectorAll?.('#ed-body [data-dm-edit-kind="action"]').forEach((edit) => {
    const row = edit.closest?.(".ed-row");
    if (!row) return;
    const main = row.querySelector(":scope > .ed-row-main");
    if (main) main.classList.add("dm-beta7-action-main");

    [...row.children].forEach((child) => {
      if (
        child === main ||
        child.classList?.contains("dm-beta7-existing-action-icon") ||
        child.classList?.contains("ed-del") ||
        child.hasAttribute?.("data-dm-edit-kind")
      ) return;
      const text = clean(child.textContent);
      if (!child.children.length && text && [...text].length <= 4)
        child.classList.add("dm-beta7-legacy-action-icon");
    });
  });
}

function run() {
  state.frame = 0;
  installShutterConfigOwner();
  markLegacyActionIcons();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installEditorOwner() {
  const current = root.editorSwitch;
  if (typeof current !== "function" || current.__dmBeta7ReviewActionLayout) return false;
  function reviewAwareEditor(...args) {
    const result = current.apply(this, args);
    schedule();
    return result;
  }
  Object.assign(reviewAwareEditor, current);
  reviewAwareEditor.__dmBeta7ReviewActionLayout = true;
  reviewAwareEditor.__dmPrevious = current;
  root.editorSwitch = reviewAwareEditor;
  return true;
}

function installOwners() {
  installShutterConfigOwner();
  installEditorOwner();
}

function installStyles() {
  installStyle("dm-beta7-review-fixes-style", `
    #editor-modal .ed-row.dm-beta7-action-row>.ed-row-main,
    #editor-modal .ed-row.dm-beta7-action-row>.dm-beta7-action-main{
      grid-column:2!important;
      grid-row:1!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    #editor-modal .ed-row.dm-beta7-action-row>.dm-beta7-action-main .ed-row-new,
    #editor-modal .ed-row.dm-beta7-action-row>.dm-beta7-action-main .ed-row-old{
      display:block!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    #editor-modal .ed-row.dm-beta7-action-row>.dm-beta7-legacy-action-icon{display:none!important}
  `);
}

export function installBeta7ReviewFixesSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installOwners();
  for (const name of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"])
    root.addEventListener?.(name, () => {
      installOwners();
      schedule();
    });
  root.addEventListener?.("dashboardmodern:states-ready", schedule);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.('.ed-tab,[data-dm-edit-kind="action"],.ed-del,.ed-btn-add'))
      root.setTimeout?.(schedule, 0);
  }, true);
  schedule();
}

installBeta7ReviewFixesSection();
