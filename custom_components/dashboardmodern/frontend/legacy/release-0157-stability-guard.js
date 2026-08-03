/* DashboardModern 0.14.17: stop observer/timer churn after the UI hooks are installed. */
const UI_KEY_0157 = "__DASHBOARDMODERN_RELEASE_0157_UI_STABILITY__";

function removeDuplicateRoomNavigation0157() {
  const page = globalThis.document?.getElementById?.("page-appliances-main");
  if (!page) return;
  const navigations = [...page.querySelectorAll(".dm-appliance-room-nav-0157")];
  navigations.slice(1).forEach((navigation) => navigation.remove());
}

function settleUiRuntime0157() {
  const runtime = globalThis[UI_KEY_0157];
  if (!runtime?.installed) return false;

  runtime.pageObserver?.disconnect?.();
  runtime.pageObserver = null;

  if (runtime.wrapperTimer) {
    globalThis.clearInterval?.(runtime.wrapperTimer);
    runtime.wrapperTimer = 0;
  }

  removeDuplicateRoomNavigation0157();
  runtime.decorateAppliances?.();
  runtime.decorateTemperatures?.();
  return true;
}

if (typeof globalThis.document !== "undefined") {
  if (!settleUiRuntime0157()) {
    let attempts = 0;
    const timer = globalThis.setInterval?.(() => {
      attempts += 1;
      if (settleUiRuntime0157() || attempts >= 40) globalThis.clearInterval?.(timer);
    }, 50);
  }

  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
    globalThis.setTimeout?.(settleUiRuntime0157, 0);
  });
  globalThis.addEventListener?.("pageshow", () => {
    globalThis.setTimeout?.(settleUiRuntime0157, 0);
  });
}
