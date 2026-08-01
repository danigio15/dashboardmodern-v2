/* DashboardModern: keep the Report observer one-way and deterministic. */
import { refreshReportHooks0153 } from "./energy-report-runtime-hooks.js";

const HOOK_FLAG = "__DASHBOARDMODERN_ENERGY_REPORT_HOOKS__";

function freshReportRows(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.matches?.(".ed-device-row")) return !node.hasAttribute("data-dm-period-value");
  return Boolean(node.querySelector?.(".ed-device-row:not([data-dm-period-value])"));
}

function scheduleSafeRefresh(delay = 30) {
  const state = globalThis[HOOK_FLAG];
  if (!state) return;
  globalThis.clearTimeout?.(state.safeTimer);
  state.safeTimer = globalThis.setTimeout?.(refreshReportHooks0153, delay);
}

function installSafeObserver() {
  const doc = globalThis.document;
  const state = globalThis[HOOK_FLAG];
  if (!doc?.documentElement || !state || state.safeObserverInstalled) return false;

  state.observer?.disconnect?.();
  if (typeof globalThis.MutationObserver !== "function") return false;

  const observer = new globalThis.MutationObserver((mutations) => {
    if (state.refreshing) return;
    const relevant = mutations.some((mutation) => {
      const target = mutation.target;
      if (target?.id === "ed-device-list") {
        return [...(mutation.addedNodes || [])].some(freshReportRows);
      }
      return [...(mutation.addedNodes || [])].some((node) => {
        if (!node || node.nodeType !== 1) return false;
        if (node.id === "ed-device-list") return true;
        return Boolean(node.querySelector?.("#ed-device-list"));
      });
    });
    if (relevant) scheduleSafeRefresh();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  state.observer = observer;
  state.safeObserverInstalled = true;
  scheduleSafeRefresh(80);
  return true;
}

if (typeof globalThis.document !== "undefined") {
  installSafeObserver();
  globalThis.queueMicrotask?.(installSafeObserver);
  globalThis.setTimeout?.(installSafeObserver, 0);
  globalThis.setTimeout?.(installSafeObserver, 150);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installSafeObserver, { once: true });
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installSafeObserver, { once: true });
  }
}
