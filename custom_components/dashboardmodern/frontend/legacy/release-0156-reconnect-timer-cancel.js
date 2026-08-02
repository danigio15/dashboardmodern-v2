/* DashboardModern 0.14.16: cancel only the redundant initial legacy reconnect. */
const RECONNECT_CAPTURE_KEY_0156 = "__DASHBOARDMODERN_LEGACY_RECONNECT__";
const FINAL_RUNTIME_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_FINAL_RUNTIME__";
const CANCEL_STATE_KEY_0156 = "__DASHBOARDMODERN_RELEASE_0156_RECONNECT_CANCEL__";

function reconnectCancelState0156() {
  return (globalThis[CANCEL_STATE_KEY_0156] ||= {
    installed: true,
    timer: 0,
    cancelled: false,
  });
}

function cancelCapturedReconnect0156() {
  const state = reconnectCancelState0156();
  const captured = globalThis[RECONNECT_CAPTURE_KEY_0156];
  const runtime = globalThis[FINAL_RUNTIME_KEY_0156];
  if (
    !captured?.timer ||
    runtime?.ready !== true ||
    runtime?.socket?.readyState !== 1
  ) {
    return false;
  }

  globalThis.clearTimeout?.(captured.timer);
  captured.timer = 0;
  captured.cancelled = true;
  state.cancelled = true;
  return true;
}

function installReconnectCancel0156() {
  const state = reconnectCancelState0156();
  if (cancelCapturedReconnect0156()) return;

  globalThis.clearInterval?.(state.timer);
  let attempts = 0;
  state.timer = globalThis.setInterval?.(() => {
    attempts += 1;
    if (cancelCapturedReconnect0156() || attempts >= 100) {
      globalThis.clearInterval?.(state.timer);
      state.timer = 0;
    }
  }, 50);

  globalThis.addEventListener?.("dashboardmodern:legacy-ready", cancelCapturedReconnect0156);
  globalThis.addEventListener?.("pageshow", cancelCapturedReconnect0156);
}

if (typeof globalThis.document !== "undefined") installReconnectCancel0156();
