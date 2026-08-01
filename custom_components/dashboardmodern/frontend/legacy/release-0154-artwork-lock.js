/* DashboardModern 0.14.14: authoritative appliance artwork and media renderer. */
import {
  applianceArtwork0154,
  canonicalArtworkType0154,
} from "./release-0154-runtime.js";

const LOCK_KEY = "__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__";
const STYLE_ID = "dm-release-0154-final-artwork-lock";
const LEGACY_STYLE_DISABLED_KEY = "__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__";
const LEGACY_STYLE_OBSERVER_KEY = "__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__";
const LEGACY_DOM_OBSERVER_KEY = "__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__";
const MEDIA_FIX_KEY = "__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__";
const DISABLED_OBSERVER = Object.freeze({ disabled: true, disconnect() {} });
const LEGACY_GEOMETRY_STYLE_IDS = new Set([
  "dm-appliance-media-layout-lock-0153",
  "dm-release-0152-artwork-layout-fix",
  "dm-energy-report-media-fixes-0153",
]);

function setData0154(node, key, value) {
  if (node?.dataset && node.dataset[key] !== value) node.dataset[key] = value;
}

function setAttribute0154(node, name, value) {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function addClass0154(node, ...tokens) {
  tokens.forEach((token) => {
    if (node && !node.classList.contains(token)) node.classList.add(token);
  });
}

function important0154(node, properties) {
  if (!node?.style) return;
  Object.entries(properties).forEach(([name, value]) => {
    if (node.style.getPropertyValue(name) !== value || node.style.getPropertyPriority(name) !== "important") {
      node.style.setProperty(name, value, "important");
    }
  });
}

function retireObserverSlot0154(owner, key, truthy = false) {
  if (!owner) return;
  owner[key]?.disconnect?.();
  try {
    Object.defineProperty(owner, key, {
      configurable: true,
      enumerable: false,
      get: () => (truthy ? DISABLED_OBSERVER : null),
      set: (observer) => observer?.disconnect?.(),
    });
  } catch (_error) {
    owner[key] = truthy ? DISABLED_OBSERVER : null;
  }
}

function removeLegacyGeometryStyles0154(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  LEGACY_GEOMETRY_STYLE_IDS.forEach((id) => root.querySelector(`#${id}`)?.remove());
}

function disableLegacyObservers0154() {
  globalThis[LEGACY_STYLE_DISABLED_KEY] = true;
  retireObserverSlot0154(globalThis, LEGACY_STYLE_OBSERVER_KEY);
  retireObserverSlot0154(globalThis, LEGACY_DOM_OBSERVER_KEY);
  const mediaState = globalThis[MEDIA_FIX_KEY];
  if (mediaState) retireObserverSlot0154(mediaState, "observer", true);
  removeLegacyGeometryStyles0154();
}

function items0154() {
  try {
    const value = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
}

function visual0154(item) {
  try {
    return globalThis.DashboardModernModules?.data?.getDeviceVisual?.(item) || null;
  } catch (_error) {
    return null;
  }
}

function sourceToken0154(item, visual, card) {
  return String(
    visual?.value ||
      item?.visual_key ||
      item?.device_type ||
      item?.type ||
      item?.icon ||
      card?.dataset?.dmArtwork ||
      item?.name ||
      "",
  );
}

function applyImageFit0154(image, fit) {
  setData0154(image, "dmImageFit", fit);
  important0154(image, {
    display: "block",
    "box-sizing": "border-box",
    width: "100%",
    height: "100%",
    "min-width": "0px",
    "min-height": "0px",
    "max-width": "100%",
    "max-height": "100%",
    padding: "0px",
    border: "0px",
    "border-radius": "12px",
    "box-shadow": "none",
    "object-fit": fit,
    "object-position": "center",
    transform: "none",
  });
}

function classifyImage0154(image) {
  const source = image.currentSrc || image.getAttribute("src") || "";
  const apply = () => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const fit = ratio >= 0.92 && ratio <= 1.08 ? "cover" : "contain";
    applyImageFit0154(image, fit);
    setData0154(image, "dmImageFitSource", source);
  };
  applyImageFit0154(image, image.dataset.dmImageFit || "cover");
  if (image.complete && image.naturalWidth) apply();
  else if (image.dataset.dmImageFitPending !== source) {
    setData0154(image, "dmImageFitPending", source);
    image.addEventListener("load", apply, { once: true });
  }
}

function enforceArtwork0154() {
  const doc = globalThis.document;
  if (!doc) return false;
  disableLegacyObservers0154();
  const appliances = items0154();
  const byId = new Map(appliances.map((item) => [String(item.id || ""), item]));
  const cards = doc.querySelectorAll(
    "#appl-grid-overview .appl-wide-card[data-appliance-id], #page-appliances-main .appl-wide-card[data-appliance-id]",
  );

  cards.forEach((card, index) => {
    const item = byId.get(String(card.dataset.applianceId || "")) || appliances[index];
    if (!item) return;
    const visual = visual0154(item);
    const viewport = card.querySelector(".appl-visual");
    const media = viewport?.querySelector(".appl-ic");
    if (!viewport || !media) return;

    setData0154(card, "applianceThemeAware", "true");
    setData0154(viewport, "applianceCover", "true");
    setData0154(card, "dmArtStyle", "panel");
    addClass0154(viewport, "dm-appliance-viewport-0154");
    addClass0154(media, "dm-appliance-media-0154");
    important0154(viewport, { overflow: "hidden", padding: "0px" });
    important0154(media, {
      display: "grid",
      "place-items": "center",
      "box-sizing": "border-box",
      width: "100%",
      height: "100%",
      "min-width": "0px",
      "min-height": "0px",
      "max-width": "100%",
      "max-height": "100%",
      padding: "0px",
      margin: "0px",
      overflow: "hidden",
      transform: "none",
    });

    if (visual?.kind === "image" && visual.value) {
      setData0154(card, "dmArtwork", "custom");
      setData0154(card, "dmMediaKind", "image");
      let image = media.querySelector("img");
      if (!image) {
        image = doc.createElement("img");
        media.replaceChildren(image);
      }
      setAttribute0154(image, "src", visual.value);
      setAttribute0154(image, "alt", String(item.name || ""));
      addClass0154(
        image,
        "dm-appliance-image",
        "dm-appliance-image-0153",
        "dm-appliance-custom-image-0154",
      );
      classifyImage0154(image);
      return;
    }

    if (visual?.kind !== "asset") return;
    const source = sourceToken0154(item, visual, card);
    const canonical = canonicalArtworkType0154(source);
    if (!canonical) return;

    setData0154(card, "dmArtwork", canonical);
    setData0154(card, "dmMediaKind", "asset");
    setData0154(card, "dmMediaType", canonical);

    let artwork = media.querySelector(`.dm-appliance-art-0154[data-dm-art="${canonical}"]`);
    if (!artwork) {
      const markup = applianceArtwork0154(canonical, 96);
      if (markup) media.innerHTML = markup;
      artwork = media.querySelector(`.dm-appliance-art-0154[data-dm-art="${canonical}"]`);
    }
    if (!artwork) return;
    setData0154(artwork, "dmArtStyle", "panel");
    setData0154(artwork, "applianceAsset", source);
    setData0154(artwork, "applianceAssetKey", source);
    important0154(artwork, {
      display: "grid",
      "place-items": "center",
      "box-sizing": "border-box",
      width: "100%",
      height: "100%",
      "min-width": "0px",
      "min-height": "0px",
      "max-width": "100%",
      "max-height": "100%",
      padding: "0px",
      margin: "0px",
      overflow: "hidden",
      transform: "none",
    });
    const svg = artwork.querySelector("svg");
    important0154(svg, {
      display: "block",
      "box-sizing": "border-box",
      width: "100%",
      height: "100%",
      "min-width": "0px",
      "min-height": "0px",
      "max-width": "100%",
      "max-height": "100%",
      "object-fit": "contain",
      "object-position": "center",
      transform: "none",
      overflow: "visible",
      flex: "0 0 100%",
    });
  });
  return true;
}

function installStyles0154() {
  const doc = globalThis.document;
  if (!doc?.head) return null;
  const existing = doc.getElementById(STYLE_ID);
  if (existing) return existing;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    html body #page-appliances-main
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual {
      display:grid!important;place-items:center!important;overflow:hidden!important;padding:0!important;
      background:var(--dm-art-tile)!important;border-color:var(--dm-art-panel-stroke)!important;
    }
    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual img,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual img,
    html body #page-appliances-main
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual img {
      object-fit:cover!important;object-position:center!important;
    }
    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual img[data-dm-image-fit="contain"],
    html body #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual img[data-dm-image-fit="contain"],
    html body #page-appliances-main
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual img[data-dm-image-fit="contain"] {
      object-fit:contain!important;
    }
  `;
  doc.head.append(style);
  return style;
}

function installLegacyStyleCleanup0154() {
  const doc = globalThis.document;
  const state = globalThis[LOCK_KEY];
  if (!doc?.head || !state || typeof MutationObserver !== "function") return false;
  if (state.legacyStyleCleanupObserver) return true;
  state.legacyStyleCleanupObserver = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && LEGACY_GEOMETRY_STYLE_IDS.has(node.id)) node.remove();
      });
    });
  });
  state.legacyStyleCleanupObserver.observe(doc.head, { childList: true });
  return true;
}

function nodeTouchesAppliances0154(node) {
  if (!node || node.nodeType !== 1) return false;
  return Boolean(
    node.matches?.("#appl-grid-overview, #page-appliances-main, .appl-wide-card") ||
      node.closest?.("#appl-grid-overview, #page-appliances-main") ||
      node.querySelector?.("#appl-grid-overview, #page-appliances-main, .appl-wide-card"),
  );
}

function schedule0154() {
  const state = globalThis[LOCK_KEY];
  if (!state || state.scheduled) return;
  state.scheduled = true;
  const run = () => {
    state.scheduled = false;
    enforceArtwork0154();
  };
  globalThis.requestAnimationFrame?.(run) || globalThis.setTimeout?.(run, 0);
}

function installObserver0154() {
  const doc = globalThis.document;
  const state = globalThis[LOCK_KEY];
  if (!doc?.body || !state || typeof MutationObserver !== "function") return false;
  if (state.observerVersion === 3 && state.observer) return true;
  state.observer?.disconnect?.();
  state.observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          nodeTouchesAppliances0154(record.target) ||
          [...record.addedNodes, ...record.removedNodes].some(nodeTouchesAppliances0154),
      )
    ) {
      schedule0154();
    }
  });
  state.observer.observe(doc.body, { childList: true, subtree: true });
  state.observerVersion = 3;
  return true;
}

function installRenderHook0154() {
  const original = globalThis.renderApplianceSection;
  if (typeof original !== "function" || original.__dm0154ArtworkHook) return false;
  function renderApplianceSection0154(...args) {
    const result = original.apply(this, args);
    globalThis.queueMicrotask?.(enforceArtwork0154);
    globalThis.requestAnimationFrame?.(enforceArtwork0154);
    return result;
  }
  renderApplianceSection0154.__dm0154ArtworkHook = true;
  renderApplianceSection0154.__dmPrevious = original;
  globalThis.renderApplianceSection = renderApplianceSection0154;
  return true;
}

function installLock0154() {
  const doc = globalThis.document;
  if (!doc?.documentElement) return false;
  const state = (globalThis[LOCK_KEY] ||= {
    observer: null,
    observerVersion: 0,
    scheduled: false,
    legacyStyleCleanupObserver: null,
  });
  disableLegacyObservers0154();
  installStyles0154();
  installLegacyStyleCleanup0154();
  installRenderHook0154();
  enforceArtwork0154();
  installObserver0154();
  return true;
}

if (typeof globalThis.document !== "undefined") {
  installLock0154();
  globalThis.queueMicrotask?.(installLock0154);
  globalThis.setTimeout?.(installLock0154, 0);
  globalThis.setTimeout?.(installLock0154, 200);
  globalThis.setTimeout?.(installLock0154, 650);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installLock0154);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installLock0154, { once: true });
  }
}
