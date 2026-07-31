/* Preserve the Energy editor save result across canonical store re-renders. */
const ENERGY_SAVE_STATE_FLAG = "__DASHBOARDMODERN_ENERGY_SAVE_STATE_FIX__";

function energyEditorRoot() {
  return document.querySelector('[data-editor="energy"]');
}

function setEnergySuccessState() {
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

  actions.dataset.state = "success";
  if (save) save.disabled = true;
  if (status) {
    status.textContent = english
      ? "Energy saved. Period totals will be calculated from Home Assistant statistics."
      : "Energia salvata. I periodi saranno calcolati dalle statistiche di Home Assistant.";
  }
}

function patchEnergyStore() {
  const store = globalThis.DashboardModernModules?.store;
  if (!store?.replaceSection) return false;
  if (store[ENERGY_SAVE_STATE_FLAG]) return true;

  const replaceSection = store.replaceSection.bind(store);
  store.replaceSection = async function patchedReplaceSection(section, value) {
    const result = await replaceSection(section, value);
    if (section === "energy") {
      // replaceSection notifies the render coordinator before resolving. Querying
      // the document here therefore targets the new editor DOM, not the detached
      // action bar that initiated the save.
      setEnergySuccessState();
      queueMicrotask(setEnergySuccessState);
      requestAnimationFrame(setEnergySuccessState);
    }
    return result;
  };
  store[ENERGY_SAVE_STATE_FLAG] = true;
  return true;
}

function installEnergySaveStateFix() {
  if (globalThis[ENERGY_SAVE_STATE_FLAG]) return;
  globalThis[ENERGY_SAVE_STATE_FLAG] = true;

  if (patchEnergyStore()) return;
  const timer = setInterval(() => {
    if (patchEnergyStore()) clearInterval(timer);
  }, 50);
  setTimeout(() => clearInterval(timer), 15000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installEnergySaveStateFix();
}
