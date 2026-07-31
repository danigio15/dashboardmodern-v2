/* DashboardModern 0.14.10: runtime state and save-result compatibility. */
const RUNTIME_STATE_FIX_FLAG = "__DASHBOARDMODERN_RELEASE_0150_RUNTIME_STATE_FIX__";
const REPORT_STORE_PATCH_FLAG = "__DASHBOARDMODERN_REPORT_SAVE_STATE_PATCH__";

function isEnglish() {
  return document.documentElement.lang === "en";
}

function runtimeStates() {
  try {
    if (typeof STATES !== "undefined" && STATES) return STATES;
  } catch (_error) {}
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) return _RAW_STATES;
  } catch (_error) {}
  return globalThis.STATES || globalThis._RAW_STATES || {};
}

export function validateRuntimeTotalEnergyEntity(entityId, states = runtimeStates()) {
  const id = String(entityId || "").trim();
  if (!id) return { valid: true, empty: true, reason: "" };
  const state = states?.[id];
  if (!state) return { valid: true, pending: true, reason: "metadata-unavailable" };

  const attributes = state.attributes || {};
  const unit = String(attributes.unit_of_measurement || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  const deviceClass = String(attributes.device_class || "").toLowerCase();
  const stateClass = String(attributes.state_class || "").toLowerCase();
  const energy = /^(wh|kwh|mwh)$/.test(unit) || deviceClass === "energy";
  const cumulative = stateClass === "total" || stateClass === "total_increasing";

  if (!energy) return { valid: false, reason: "not-energy", unit, stateClass };
  if (!cumulative) return { valid: false, reason: "not-cumulative", unit, stateClass };
  return { valid: true, reason: "", unit, stateClass };
}

function refreshTotalEnergyInput(input) {
  if (!(input instanceof HTMLInputElement)) return;
  if (!input.closest("[data-energy-total-field]")) return;

  const result = validateRuntimeTotalEnergyEntity(input.value);
  input.dataset.validation = result.valid ? (result.pending ? "pending" : "valid") : "invalid";

  const output = input.closest(".ed-slot")?.querySelector("[data-total-validation]");
  if (!output) return;
  if (result.empty) output.textContent = "";
  else if (result.pending)
    output.textContent = isEnglish()
      ? "Entity metadata is not available yet; it will be checked on the next update."
      : "Entità non ancora disponibile: sarà verificata al prossimo aggiornamento.";
  else if (result.reason === "not-energy")
    output.textContent = isEnglish()
      ? "Use an energy meter in Wh/kWh, not a W/kW power sensor."
      : "Serve un contatore energia in Wh/kWh, non un sensore di potenza W/kW.";
  else if (result.reason === "not-cumulative")
    output.textContent = isEnglish()
      ? "The entity must have state_class total_increasing or total."
      : "L'entità deve avere state_class total_increasing oppure total.";
  else
    output.textContent = isEnglish()
      ? "Valid cumulative meter: day, month and year will be calculated from statistics."
      : "Contatore cumulativo valido: giorno, mese e anno saranno calcolati dalle statistiche.";
}

function refreshTotalEnergyInputs(root = document) {
  root.querySelectorAll?.("[data-energy-total-field] input").forEach(refreshTotalEnergyInput);
}

let reportSuccessUntil = 0;

function setReportSuccessState() {
  document.querySelectorAll("[data-report-actions]").forEach((actions) => {
    const save = actions.querySelector("[data-report-save]");
    const status = actions.querySelector("[data-report-status]");
    actions.dataset.state = "success";
    if (save) save.disabled = true;
    if (status) status.textContent = isEnglish() ? "Report saved" : "Report salvato";
  });
}

function preserveReportSuccess() {
  reportSuccessUntil = Date.now() + 1500;
  setReportSuccessState();
  queueMicrotask(setReportSuccessState);
  requestAnimationFrame(setReportSuccessState);
  for (const delay of [50, 200, 750, 1400]) setTimeout(setReportSuccessState, delay);
}

function patchReportStore() {
  const store = globalThis.DashboardModernModules?.store;
  if (!store?.saveReport) return false;
  if (store[REPORT_STORE_PATCH_FLAG]) return true;

  const saveReport = store.saveReport.bind(store);
  store.saveReport = async function patchedSaveReport(...args) {
    const result = await saveReport(...args);
    preserveReportSuccess();
    return result;
  };
  store[REPORT_STORE_PATCH_FLAG] = true;
  return true;
}

function installRuntimeStateFixes() {
  if (globalThis[RUNTIME_STATE_FIX_FLAG]) return;
  globalThis[RUNTIME_STATE_FIX_FLAG] = true;

  document.addEventListener("input", (event) => refreshTotalEnergyInput(event.target));
  document.addEventListener("change", (event) => refreshTotalEnergyInput(event.target));

  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      refreshTotalEnergyInputs();
      if (Date.now() < reportSuccessUntil) setReportSuccessState();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  refreshTotalEnergyInputs();
  if (patchReportStore()) return;
  const timer = setInterval(() => {
    if (patchReportStore()) clearInterval(timer);
  }, 50);
  setTimeout(() => clearInterval(timer), 15000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installRuntimeStateFixes, { once: true });
  } else {
    installRuntimeStateFixes();
  }
}
