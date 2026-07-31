/* Preserve the Energy editor save result across canonical store re-renders. */
const ENERGY_SAVE_STATE_FLAG = "__DASHBOARDMODERN_ENERGY_SAVE_STATE_FIX__";
const ENERGY_SAVE_SUCCESS_WINDOW_MS = 6000;
let energySuccessUntil = 0;
let energySuccessFrame = 0;

function energyEditorRoot() {
  return document.querySelector('[data-editor="energy"]');
}

function energySaveSucceededRecently() {
  return Date.now() < energySuccessUntil;
}

function setEnergySuccessState() {
  if (!energySaveSucceededRecently()) return;

  const root = energyEditorRoot();
  if (!root) return;

  const actions = root.querySelector("[data-energy-actions]");
  if (!actions) return;

  const save = actions.querySelector("[data-energy-save]");
  const status =
    actions.querySelector("[data-energy-status]") ||
    root.querySelector("#ed-energy-status");
  const copySource = `${save?.textContent || ""} ${status?.textContent || ""}`;
  const english = /save energy|no unsaved|unsaved changes|energy saved/i.test(copySource);
  const message = english
    ? "Energy saved. Period totals will be calculated from Home Assistant statistics."
    : "Energia salvata. I periodi saranno calcolati dalle statistiche di Home Assistant.";

  if (actions.dataset.state !== "success") actions.dataset.state = "success";
  if (save && !save.disabled) save.disabled = true;
  if (status && status.textContent !== message) status.textContent = message;
}

function preserveEnergySuccess() {
  energySuccessUntil = Date.now() + ENERGY_SAVE_SUCCESS_WINDOW_MS;
  setEnergySuccessState();
  queueMicrotask(setEnergySuccessState);
  cancelAnimationFrame(energySuccessFrame);
  energySuccessFrame = requestAnimationFrame(setEnergySuccessState);
  for (const delay of [50, 200, 750, 1500, 3000, 5500]) {
    setTimeout(setEnergySuccessState, delay);
  }
}

function clearEnergySuccessOnEdit(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest('[data-editor="energy"]')) return;
  if (target.closest("[data-energy-save]")) return;
  energySuccessUntil = 0;
}

function handleStoreStatus(event) {
  const detail = event.detail || {};
  if (detail.section !== "energy") return;
  if (detail.status === "success") preserveEnergySuccess();
  else if (detail.status === "error" || detail.status === "rollback") energySuccessUntil = 0;
}

function patchEnergyStore() {
  const store = globalThis.DashboardModernModules?.store;
  if (!store?.replaceSection) return false;
  if (store[ENERGY_SAVE_STATE_FLAG]) return true;

  const replaceSection = store.replaceSection.bind(store);
  store.replaceSection = async function patchedReplaceSection(section, value) {
    const result = await replaceSection(section, value);
    if (section === "energy") preserveEnergySuccess();
    return result;
  };
  store[ENERGY_SAVE_STATE_FLAG] = true;
  return true;
}

function installEnergySaveStateFix() {
  if (globalThis[ENERGY_SAVE_STATE_FLAG]) return;
  globalThis[ENERGY_SAVE_STATE_FLAG] = true;

  globalThis.addEventListener("dashboardmodern:status", handleStoreStatus);
  document.addEventListener("input", clearEnergySuccessOnEdit, true);
  document.addEventListener("change", clearEnergySuccessOnEdit, true);

  new MutationObserver(() => {
    if (!energySaveSucceededRecently()) return;
    cancelAnimationFrame(energySuccessFrame);
    energySuccessFrame = requestAnimationFrame(setEnergySuccessState);
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-state"],
  });

  if (patchEnergyStore()) return;
  const timer = setInterval(() => {
    if (patchEnergyStore()) clearInterval(timer);
  }, 50);
  setTimeout(() => clearInterval(timer), 15000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installEnergySaveStateFix();
}
