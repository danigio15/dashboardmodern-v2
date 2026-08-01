/* DashboardModern: keep the Report observer one-way and deterministic. */
import { refreshReportHooks0153 } from "./energy-report-runtime-hooks.js";

const HOOK_FLAG = "__DASHBOARDMODERN_ENERGY_REPORT_HOOKS__";

function reportPageActive() {
  const doc = globalThis.document;
  const page = doc?.getElementById?.("page-energy") || doc?.getElementById?.("page-energia");
  if (!page || page.hidden || page.getAttribute("aria-hidden") === "true") return false;
  if (!page.classList.contains("active")) return false;
  const style = globalThis.getComputedStyle?.(page);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function bypassHiddenReport0153(name) {
  const current = globalThis[name];
  if (typeof current !== "function" || current.__dm0153VisibilityGuard) return false;
  const previous = current.__dmPrevious;

  function visibleReportGuard0153(...args) {
    if (!reportPageActive() && typeof previous === "function") {
      return previous.apply(this, args);
    }
    return current.apply(this, args);
  }

  visibleReportGuard0153.__dm0153VisibilityGuard = true;
  visibleReportGuard0153.__dm0153ReportPeriods = true;
  visibleReportGuard0153.__dmPrevious = current;
  globalThis[name] = visibleReportGuard0153;
  return true;
}

function installReportFunctionGuards() {
  const list = bypassHiddenReport0153("renderEdDeviceList");
  const detail = bypassHiddenReport0153("edCaricaDettaglio");
  return list || detail || Boolean(
    globalThis.renderEdDeviceList?.__dm0153VisibilityGuard &&
      globalThis.edCaricaDettaglio?.__dm0153VisibilityGuard,
  );
}

function syncReportAvailability() {
  const state = globalThis[HOOK_FLAG];
  if (!state) return false;
  if (!reportPageActive()) {
    globalThis.clearTimeout?.(state.timer);
    globalThis.clearTimeout?.(state.safeTimer);
    state.hiddenBlocked = true;
    state.refreshing = true;
    return false;
  }
  if (state.hiddenBlocked) {
    state.hiddenBlocked = false;
    state.refreshing = false;
  }
  return true;
}

function freshReportRows(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.matches?.(".ed-device-row")) return !node.hasAttribute("data-dm-period-value");
  return Boolean(node.querySelector?.(".ed-device-row:not([data-dm-period-value])"));
}

function scheduleSafeRefresh(delay = 30) {
  const state = globalThis[HOOK_FLAG];
  if (!state || !syncReportAvailability()) return;
  globalThis.clearTimeout?.(state.safeTimer);
  state.safeTimer = globalThis.setTimeout?.(() => {
    if (syncReportAvailability()) refreshReportHooks0153();
  }, delay);
}

function installSafeObserver() {
  const doc = globalThis.document;
  const state = globalThis[HOOK_FLAG];
  installReportFunctionGuards();
  if (!doc?.documentElement || !state || state.safeObserverInstalled) {
    syncReportAvailability();
    return false;
  }

  state.observer?.disconnect?.();
  if (typeof globalThis.MutationObserver !== "function") return false;

  const observer = new globalThis.MutationObserver((mutations) => {
    if (!syncReportAvailability()) return;
    if (state.refreshing) return;
    const relevant = mutations.some((mutation) => {
      if (mutation.type === "attributes") {
        return mutation.target?.id === "page-energy" || mutation.target?.id === "page-energia";
      }
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
  observer.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "aria-hidden", "style"],
  });
  state.observer = observer;
  state.safeObserverInstalled = true;
  syncReportAvailability();
  scheduleSafeRefresh(80);
  return true;
}

function install0153() {
  installReportFunctionGuards();
  installSafeObserver();
  syncReportAvailability();
}

if (typeof globalThis.document !== "undefined") {
  install0153();
  globalThis.queueMicrotask?.(install0153);
  globalThis.setTimeout?.(install0153, 0);
  globalThis.setTimeout?.(install0153, 150);
  const timer = globalThis.setInterval?.(() => {
    install0153();
    if (
      globalThis.renderEdDeviceList?.__dm0153VisibilityGuard &&
      globalThis.edCaricaDettaglio?.__dm0153VisibilityGuard &&
      globalThis[HOOK_FLAG]?.safeObserverInstalled
    ) {
      globalThis.clearInterval?.(timer);
    }
  }, 100);
  globalThis.setTimeout?.(() => globalThis.clearInterval?.(timer), 15000);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0153, { once: true });
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", install0153, { once: true });
  }
}
