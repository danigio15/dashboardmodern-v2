/* DashboardModern: keep the Report observer one-way and deterministic. */
import { refreshReportHooks0153 } from "./energy-report-runtime-hooks.js";

const HOOK_FLAG = "__DASHBOARDMODERN_ENERGY_REPORT_HOOKS__";
const BUILDER_GUARD = "__DASHBOARDMODERN_REPORT_BUILDER_GUARD_0153__";

function reportPageActive() {
  const doc = globalThis.document;
  const page = doc?.getElementById?.("page-energy") || doc?.getElementById?.("page-energia");
  if (!page || page.hidden || page.getAttribute("aria-hidden") === "true") return false;
  if (!page.classList.contains("active")) return false;
  const style = globalThis.getComputedStyle?.(page);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function installReportBuilderGuard() {
  const data = globalThis.DashboardModernModules?.data;
  const original = data?.canonicalReportDevices;
  if (!data || typeof original !== "function") return false;
  if (original[BUILDER_GUARD]) return true;

  function canonicalReportDevicesVisible0153(...args) {
    if (!reportPageActive()) return [];
    return original.apply(this, args);
  }
  canonicalReportDevicesVisible0153[BUILDER_GUARD] = true;
  canonicalReportDevicesVisible0153.__dmPrevious = original;
  data.canonicalReportDevices = canonicalReportDevicesVisible0153;
  return true;
}

function freshReportRows(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.matches?.(".ed-device-row")) return !node.hasAttribute("data-dm-period-value");
  return Boolean(node.querySelector?.(".ed-device-row:not([data-dm-period-value])"));
}

function scheduleSafeRefresh(delay = 30) {
  const state = globalThis[HOOK_FLAG];
  if (!state || !reportPageActive()) return;
  globalThis.clearTimeout?.(state.safeTimer);
  state.safeTimer = globalThis.setTimeout?.(() => {
    if (reportPageActive()) refreshReportHooks0153();
  }, delay);
}

function installSafeObserver() {
  const doc = globalThis.document;
  const state = globalThis[HOOK_FLAG];
  installReportBuilderGuard();
  if (!doc?.documentElement || !state || state.safeObserverInstalled) return false;

  state.observer?.disconnect?.();
  if (typeof globalThis.MutationObserver !== "function") return false;

  const observer = new globalThis.MutationObserver((mutations) => {
    if (state.refreshing || !reportPageActive()) return;
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

function install0153() {
  installReportBuilderGuard();
  installSafeObserver();
}

if (typeof globalThis.document !== "undefined") {
  install0153();
  globalThis.queueMicrotask?.(install0153);
  globalThis.setTimeout?.(install0153, 0);
  globalThis.setTimeout?.(install0153, 150);
  const timer = globalThis.setInterval?.(() => {
    if (installReportBuilderGuard() && installSafeObserver()) globalThis.clearInterval?.(timer);
  }, 100);
  globalThis.setTimeout?.(() => globalThis.clearInterval?.(timer), 15000);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0153, { once: true });
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", install0153, { once: true });
  }
}
