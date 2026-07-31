/* Language-independent edit controls for saved standard alerts. */
const ALERT_COMPAT_FLAG = "__DASHBOARDMODERN_REAL_HA_0147_ALERT_COMPAT__";
const ALERT_EDIT_PATCH_FLAG = "__DASHBOARDMODERN_REAL_HA_0147_ALERT_EDIT_PATCH__";

function readGroups() {
  try {
    return JSON.parse(localStorage.getItem("cd_gruppi_extra")) || {};
  } catch (_error) {
    return {};
  }
}

function readNames() {
  try {
    return JSON.parse(localStorage.getItem("cd_avvisi_names_extra")) || {};
  } catch (_error) {
    return {};
  }
}

function runtimeStates() {
  try {
    return globalThis.eval("STATES") || {};
  } catch (_error) {
    return globalThis.STATES || {};
  }
}

function entityFromRow(row) {
  const text = row.querySelector(".ed-row-old.mono")?.textContent || "";
  return text.match(/\b[a-z_][a-z0-9_]*\.[a-z0-9_]+\b/i)?.[0] || "";
}

function groupForEntity(entity, row) {
  const groups = readGroups();
  const saved = Object.entries(groups).find(([, ids]) => Array.isArray(ids) && ids.includes(entity));
  if (saved) return saved[0];
  const text = `${row.textContent || ""} ${row.closest("details")?.querySelector("summary")?.textContent || ""}`.toLowerCase();
  if (/apert|contact|door|window/.test(text)) return "win";
  if (/batter/.test(text)) return "batt";
  if (/luc|light/.test(text)) return "luci";
  if (/clima|climate/.test(text)) return "clima";
  if (/riscald|heating/.test(text)) return "risc";
  return "";
}

function alertName(entity) {
  return readNames()[entity] || runtimeStates()?.[entity]?.attributes?.friendly_name || entity;
}

function applyAlertEditForm(group, entity, force = false) {
  const entityInput = document.getElementById("ed-avv-ent");
  const groupInput = document.getElementById("ed-avv-grp");
  const nameInput = document.getElementById("ed-avv-name");
  if (!entityInput || !groupInput || !nameInput) return false;

  // A later scheduled pass must never overwrite genuine user edits. Forced
  // passes only cover the immediate editor re-render after pressing Edit.
  if (!force && entityInput.value && entityInput.value !== entity) return true;
  if (force || !entityInput.value) entityInput.value = entity;
  if (force || !groupInput.value) groupInput.value = group;
  if (force || !nameInput.value) nameInput.value = alertName(entity);
  return true;
}

function patchAlertEditHandler() {
  const edit = globalThis.dmRealEditAlert;
  if (typeof edit !== "function") return false;
  if (edit[ALERT_EDIT_PATCH_FLAG]) return true;

  const patched = function dmRealEditAlertStable(group, entity) {
    const result = edit.apply(this, arguments);
    const forceApply = () => applyAlertEditForm(group, entity, true);
    const safeApply = () => applyAlertEditForm(group, entity, false);
    queueMicrotask(forceApply);
    requestAnimationFrame(forceApply);
    for (const delay of [50, 150]) setTimeout(forceApply, delay);
    for (const delay of [400, 800]) setTimeout(safeApply, delay);
    return result;
  };
  patched[ALERT_EDIT_PATCH_FLAG] = true;
  patched.__dmPrevious = edit;
  globalThis.dmRealEditAlert = patched;
  return true;
}

function installAlertEditButtons(root = document) {
  root.querySelectorAll("#editor-modal .ed-row").forEach((row) => {
    const entity = entityFromRow(row);
    const group = entity && groupForEntity(entity, row);
    if (!entity || !group || typeof globalThis.dmRealEditAlert !== "function") return;

    row.querySelectorAll("[data-standard-alert-edit]").forEach((button) => button.remove());
    if (row.querySelector("[data-real-alert-edit]")) return;

    const remove = [...row.querySelectorAll(".ed-del")].find((button) =>
      /edDelAvviso/.test(button.getAttribute("onclick") || ""),
    );
    if (!remove) return;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ed-del dm-edit-button";
    edit.dataset.realAlertEdit = "";
    edit.dataset.alertGroup = group;
    edit.dataset.alertEntity = entity;
    edit.textContent = "✏️";
    edit.title = document.documentElement.lang === "en" ? "Edit" : "Modifica";
    edit.setAttribute("aria-label", edit.title);
    edit.addEventListener("click", () => globalThis.dmRealEditAlert(group, entity));
    remove.before(edit);
  });
}

function reconcile() {
  patchAlertEditHandler();
  installAlertEditButtons();
}

function install() {
  reconcile();
  if (globalThis[ALERT_COMPAT_FLAG]?.installed) return;
  globalThis[ALERT_COMPAT_FLAG] = { installed: true };
  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(reconcile);
  }).observe(document.documentElement, { childList: true, subtree: true });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    reconcile();
    if (patchAlertEditHandler() || attempts >= 300) clearInterval(timer);
  }, 50);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
  window.addEventListener("dashboardmodern:legacy-ready", install);
}
