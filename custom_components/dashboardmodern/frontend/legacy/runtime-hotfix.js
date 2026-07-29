(function () {
  "use strict";

  if (window.__DASHBOARDMODERN_RUNTIME_HOTFIX__) return;
  window.__DASHBOARDMODERN_RUNTIME_HOTFIX__ = true;

  let editorBody = null;
  let editorObserver = null;
  let pickerPassQueued = false;

  function mountEntityPickers() {
    const body = document.getElementById("ed-body");
    const mount = window.DashboardModernModules?.render?.mountEntityPickers;
    if (!body || typeof mount !== "function") return;
    mount(body);
  }

  function queuePickerPass() {
    if (pickerPassQueued) return;
    pickerPassQueued = true;
    queueMicrotask(function () {
      pickerPassQueued = false;
      mountEntityPickers();
    });
  }

  function attachEditorObserver() {
    const nextBody = document.getElementById("ed-body");
    if (!nextBody) return;

    if (nextBody !== editorBody) {
      editorObserver?.disconnect();
      editorBody = nextBody;
      editorObserver = new MutationObserver(queuePickerPass);
      editorObserver.observe(nextBody, { childList: true, subtree: true });
    }

    queuePickerPass();
  }

  function ensureApplianceVisuals() {
    document.querySelectorAll("#page-appliances-main .appl-ic").forEach(function (visual) {
      const hasGraphic = visual.querySelector("svg, img, ha-icon");
      if (hasGraphic) return;

      const fallback =
        typeof window.cdApplianceIcon === "function"
          ? window.cdApplianceIcon("generico", 52)
          : "⚙️";
      visual.innerHTML = fallback;
    });
  }

  let appliancePassQueued = false;
  function queueAppliancePass() {
    if (appliancePassQueued) return;
    appliancePassQueued = true;
    requestAnimationFrame(function () {
      appliancePassQueued = false;
      ensureApplianceVisuals();
    });
  }

  const documentObserver = new MutationObserver(function () {
    attachEditorObserver();
    queueAppliancePass();
  });

  function start() {
    documentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    attachEditorObserver();
    queueAppliancePass();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
