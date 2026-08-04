import {
  applianceArtwork,
  canonicalArtworkType,
} from "../src/core/appliance-artwork.js";

/* DashboardModern 0.15.0 — transport and deterministic UI regression guard. */
(function installRuntimeRegressionGuard0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RUNTIME_REGRESSION_GUARD_0150__";
  if (root[KEY]?.installed) return;

  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    bridgeAligned: false,
    store: null,
    unsubscribe: null,
  });

  const clean = (value) => String(value ?? "").trim();
  const store = () => root.DashboardModernModules?.store || null;

  function installSocketConstants(Socket) {
    if (typeof Socket !== "function") return false;
    [
      ["CONNECTING", 0],
      ["OPEN", 1],
      ["CLOSING", 2],
      ["CLOSED", 3],
    ].forEach(([name, value]) => {
      if (Socket[name] != null) return;
      try {
        Object.defineProperty(Socket, name, { value, configurable: true });
      } catch (_error) {}
    });
    return true;
  }

  function alignBridge() {
    const current = root.WebSocket;
    const explicitBridge =
      typeof root.__DASHBOARDMODERN_BRIDGE_WS__ === "function"
        ? root.__DASHBOARDMODERN_BRIDGE_WS__
        : null;
    const preloaded =
      typeof root.__DASHBOARDMODERN_PRELUDE_WS__ === "function"
        ? root.__DASHBOARDMODERN_PRELUDE_WS__
        : null;
    const candidate = explicitBridge || preloaded;

    installSocketConstants(current);
    installSocketConstants(explicitBridge);
    installSocketConstants(preloaded);

    // bridge-prelude intentionally installs an asynchronous/deferred adapter.
    // Never replace an already usable constructor with the raw preloaded one:
    // synchronous mock replies would re-enter both the legacy and canonical
    // state machines and the dashboard would fall back to zero values.
    if (typeof current !== "function" && candidate) root.WebSocket = candidate;
    if (!explicitBridge && candidate) root.__DASHBOARDMODERN_BRIDGE_WS__ = candidate;

    state.bridgeAligned = typeof root.WebSocket === "function";
    const reconnect = root.__DASHBOARDMODERN_LEGACY_RECONNECT__;
    if (state.bridgeAligned && reconnect?.timer) {
      root.clearTimeout?.(reconnect.timer);
      reconnect.timer = 0;
      reconnect.cancelled = true;
    }
    return state.bridgeAligned;
  }

  function installStyles() {
    if (!doc || doc.getElementById("dm-runtime-regression-guard-0150")) return;
    const style = doc.createElement("style");
    style.id = "dm-runtime-regression-guard-0150";
    style.textContent = `
      #page-appliances-main .appl-ic,
      #page-appliances-main .appl-visual,
      #page-appliances-main .dm-appliance-image-wrap {
        overflow: hidden !important;
      }
      #page-appliances-main .dm-appliance-image-wrap {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
      }
      #page-appliances-main img.dm-appliance-image,
      #page-appliances-main img.dm-appliance-image-0153 {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 100% !important;
        min-height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        object-fit: cover !important;
        object-position: 50% 50% !important;
      }
      #page-appliances-main .dm-appliance-art,
      #page-appliances-main .dm-appliance-art-0154,
      #page-appliances-main [data-dm-art] {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 100% !important;
        min-height: 100% !important;
      }
      #page-appliances-main .dm-appliance-art > svg,
      #page-appliances-main .dm-appliance-art-0154 > svg,
      #page-appliances-main [data-dm-art] > svg {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 100% !important;
        min-height: 100% !important;
        max-width: none !important;
        max-height: none !important;
      }
    `;
    (doc.head || doc.documentElement).append(style);
  }

  function legacyArtworkKey(type) {
    return {
      oven: "forno",
      fridge: "frigo",
      microwave: "microonde",
      boiler: "boiler",
      washer: "lavatrice",
      dryer: "asciugatrice",
      dishwasher: "lavastoviglie",
      cooktop: "piano-cottura",
      television: "televisione",
    }[type] || type;
  }

  function artworkMarkup(value, size = 96) {
    const type = canonicalArtworkType(value);
    if (!type) return "";
    const key = legacyArtworkKey(type);
    return applianceArtwork(type, size).replace(
      '<span class="dm-appliance-art dm-appliance-art-0154"',
      `<span class="dm-appliance-art dm-appliance-art-0154" data-appliance-asset="${key}" data-appliance-asset-key="${key}"`,
    );
  }

  function installArtworkFacade() {
    const current = root.cdApplianceIcon;
    if (current?.__dmRuntime0150Artwork) return true;
    const original = typeof current === "function" ? current : null;

    function patchedApplianceIcon(value, size = 96) {
      return artworkMarkup(value, size) || original?.apply(this, arguments) || "";
    }

    patchedApplianceIcon.__dmRuntime0150Artwork = true;
    patchedApplianceIcon.__dmOriginal = original;
    root.cdApplianceIcon = patchedApplianceIcon;
    return true;
  }

  function normalizeApplianceArtwork() {
    if (!doc) return false;
    installStyles();
    installArtworkFacade();

    const devices = store()?.getSection?.("appliances") || [];
    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card, index) => {
      const device =
        devices.find((item) => clean(item?.id) === clean(card.dataset.applianceId)) ||
        devices[index] ||
        {};
      const holder = card.querySelector(".appl-ic, .appl-visual");
      if (!holder) return;

      const token = clean(
        device.visual_key || device.device_type || device.icon || device.name || card.textContent,
      );
      const type = canonicalArtworkType(token);
      const explicitImage = clean(device.image || device.image_url);

      if (type && !explicitImage) {
        const markup = artworkMarkup(token, 96);
        if (markup && (!holder.querySelector("[data-dm-art]") || holder.querySelector("img"))) {
          holder.innerHTML = markup;
        }
        card.dataset.dmArtwork = type;
        card.dataset.dmArtStyle = "panel";
      }

      holder.querySelectorAll("img").forEach((image) => {
        image.classList.add("dm-appliance-image", "dm-appliance-image-0153");
        let wrapper = image.closest(".dm-appliance-image-wrap");
        if (!wrapper) {
          wrapper = doc.createElement("span");
          wrapper.className = "dm-appliance-image-wrap";
          image.replaceWith(wrapper);
          wrapper.append(image);
        }
      });
    });
    return true;
  }

  function apply() {
    alignBridge();
    normalizeApplianceArtwork();
    bindStore();
  }

  function scheduleApply() {
    root.queueMicrotask?.(apply);
    root.setTimeout?.(apply, 0);
    root.setTimeout?.(normalizeApplianceArtwork, 40);
  }

  function bindStore() {
    const current = store();
    if (!current || state.store === current) return Boolean(current);
    state.unsubscribe?.();
    state.store = current;
    state.unsubscribe = current.subscribe?.((change) => {
      if (["appliances", "rooms", "snapshot"].includes(change?.section)) scheduleApply();
    });
    return true;
  }

  alignBridge();
  installStyles();
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:energy-statistics", scheduleApply);
  root.addEventListener?.("dashboardmodern:period-bundle", scheduleApply);
  root.addEventListener?.("pageshow", scheduleApply);
  doc?.addEventListener?.("click", scheduleApply, true);

  scheduleApply();
  [50, 180, 500, 900].forEach((delay) => root.setTimeout?.(apply, delay));
})(globalThis);
