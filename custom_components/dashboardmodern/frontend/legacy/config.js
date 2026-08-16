// DashboardModern hosted bootstrap coordinator.
// The vendored legacy runtime owns the initial DOM/functions. Modern sections
// are installed only after legacy-ready and after modules-entry has exposed the
// canonical store/API, avoiding a second bootstrap racing during HTML parsing.
(function bootstrapDashboardModernRuntime() {
  const KEY = "__DASHBOARDMODERN_RUNTIME_BOOTSTRAP__";
  const state = (globalThis[KEY] ||= {
    started: false,
    promise: null,
    unloading: false,
    applianceObserver: null,
  });

  const markUnloading = () => {
    state.unloading = true;
  };
  // WebKit can reject pending dynamic module imports as soon as navigation
  // starts, before pagehide is dispatched. beforeunload marks that same real
  // document teardown earlier; genuine bootstrap failures while the document
  // remains active are still reported below.
  globalThis.addEventListener?.("beforeunload", markUnloading, { once: true });
  globalThis.addEventListener?.("pagehide", markUnloading, { once: true });

  // Beta 27 keeps the large, interactive artwork inside .appl-visual. The
  // compact artwork copied into the card heading is decorative only: strip the
  // interactive selector classes from that copy so click targets and strict
  // E2E locators continue to resolve to exactly one real appliance artwork.
  const sanitizeApplianceHeaderArtwork = (scope) => {
    if (!scope) return;
    const sanitize = (node) => {
      if (!node?.matches?.(".dm-appliance-head-icon > .appl-ic, .dm-appliance-head-icon > .appliance-icon-card"))
        return;
      node.classList.remove("appl-ic", "appliance-icon-card", "appl-ic-emoji");
      node.classList.add("dm-appliance-head-art");
      node.setAttribute("aria-hidden", "true");
    };
    sanitize(scope);
    scope
      .querySelectorAll?.(
        ".dm-appliance-head-icon > .appl-ic, .dm-appliance-head-icon > .appliance-icon-card",
      )
      .forEach(sanitize);
  };

  const installApplianceCompatibility = () => {
    const document = globalThis.document;
    if (!document) return;

    sanitizeApplianceHeaderArtwork(document);
    if (!state.applianceObserver && globalThis.MutationObserver && document.documentElement) {
      state.applianceObserver = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes || []) sanitizeApplianceHeaderArtwork(node);
        }
      });
      state.applianceObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    if (!document.getElementById("dm-beta27-appliance-runtime-fixes")) {
      const style = document.createElement("style");
      style.id = "dm-beta27-appliance-runtime-fixes";
      style.textContent = `
        #page-appliances-main .appl-wide-card[data-dm-beta27-appliance-card="true"],
        #appl-grid-overview .appl-wide-card[data-dm-beta27-appliance-card="true"] {
          background-color: rgb(248, 250, 252) !important;
        }
        html[data-theme="dark"] #page-appliances-main .appl-wide-card[data-dm-beta27-appliance-card="true"],
        html[data-theme="dark"] #appl-grid-overview .appl-wide-card[data-dm-beta27-appliance-card="true"],
        body.dark #page-appliances-main .appl-wide-card[data-dm-beta27-appliance-card="true"],
        body.dark #appl-grid-overview .appl-wide-card[data-dm-beta27-appliance-card="true"] {
          background-color: rgb(17, 24, 39) !important;
        }
        #page-appliances-main .appl-wide-card .appl-visual > .appl-ic,
        #appl-grid-overview .appl-wide-card .appl-visual > .appl-ic {
          background-color: rgba(240, 249, 255, .92) !important;
        }
        html[data-theme="dark"] #page-appliances-main .appl-wide-card .appl-visual > .appl-ic,
        html[data-theme="dark"] #appl-grid-overview .appl-wide-card .appl-visual > .appl-ic,
        body.dark #page-appliances-main .appl-wide-card .appl-visual > .appl-ic,
        body.dark #appl-grid-overview .appl-wide-card .appl-visual > .appl-ic {
          background-color: rgba(15, 23, 42, .82) !important;
        }
        #page-appliances-main .dm-appliance-head-icon > .dm-appliance-head-art,
        #appl-grid-overview .dm-appliance-head-icon > .dm-appliance-head-art {
          display: grid !important;
          place-items: center !important;
          width: 48px !important;
          height: 48px !important;
          min-width: 48px !important;
          min-height: 48px !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          overflow: hidden !important;
        }
      `;
      (document.head || document.documentElement).append(style);
    }
  };

  const start = () => {
    if (state.started || state.unloading) return true;
    const modules = globalThis.DashboardModernModules;
    if (
      !globalThis.__DASHBOARDMODERN_LEGACY_READY__ ||
      !modules ||
      globalThis.document?.readyState === "loading"
    ) {
      return false;
    }

    const releaseVersion = modules.diagnostics?.BUILD_INFO?.dashboardVersion;
    if (releaseVersion) globalThis.DASHBOARD_VERSION = releaseVersion;

    state.started = true;
    state.promise = import("../src/sections/section-runtime.js")
      .then((runtime) => {
        installApplianceCompatibility();
        return runtime;
      })
      .catch((error) => {
        state.started = false;
        state.promise = null;
        if (state.unloading) return null;
        globalThis.__DASHBOARDMODERN_RUNTIME_BOOTSTRAP_ERROR__ = String(
          error?.message || error || "runtime bootstrap failed",
        );
        globalThis.console?.error?.("[DashboardModern] modular runtime bootstrap failed", error);
        return null;
      });
    return true;
  };

  globalThis.addEventListener?.("dashboardmodern:legacy-ready", start, { once: true });
  if (globalThis.document?.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    queueMicrotask(start);
  }
})();
