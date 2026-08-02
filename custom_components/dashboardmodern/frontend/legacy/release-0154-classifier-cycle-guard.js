/* DashboardModern 0.14.14: prevent mobile inference from re-wrapping the final classifier. */
const CLASSIFIER_MARKER_0154 = "__dm0154EntityClassifier";
const MOBILE_MARKER_0154 = "__dmUnitInference";

function markFinalClassifier0154() {
  const classifier = globalThis.cdApplEntity;
  if (typeof classifier !== "function" || !classifier[CLASSIFIER_MARKER_0154]) return false;
  classifier[MOBILE_MARKER_0154] = true;
  return true;
}

function installClassifierCycleGuard0154() {
  if (markFinalClassifier0154()) return true;
  globalThis.queueMicrotask?.(markFinalClassifier0154);
  globalThis.setTimeout?.(markFinalClassifier0154, 0);
  globalThis.setTimeout?.(markFinalClassifier0154, 80);
  globalThis.setTimeout?.(markFinalClassifier0154, 250);
  return false;
}

installClassifierCycleGuard0154();
globalThis.addEventListener?.("dashboardmodern:legacy-ready", installClassifierCycleGuard0154);
globalThis.addEventListener?.("pageshow", installClassifierCycleGuard0154);
