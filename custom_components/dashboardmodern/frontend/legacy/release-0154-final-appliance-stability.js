/* DashboardModern 0.14.14: single idempotent owner for appliance media. */
import {
  applianceArtwork0154,
  canonicalArtworkType0154,
} from "./release-0154-runtime.js";

const LOCK_KEY = "__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__";
const FINAL_KEY = "__DASHBOARDMODERN_RELEASE_0154_FINAL_APPLIANCE_STABILITY__";
const STYLE_ID = "dm-release-0154-final-artwork-lock";
const LEGACY_STYLE_IDS = [
  "dm-appliance-media-layout-lock-0153",
  "dm-release-0152-artwork-layout-fix",
  "dm-energy-report-media-fixes-0153",
];
const DISABLED_OBSERVER = Object.freeze({
  disabled: true,
  dashboardmodern_disabled: true,
  disconnect() {},
  observe() {},
});

function state0154() {
  const state = (globalThis[LOCK_KEY] ||= {
    observer: null,
    observerRoot: null,
    observerVersion: 0,
    scheduled: false,
    normalizing: false,
  });
  globalThis[FINAL_KEY] = state;
  return state;
}

function disconnect(value) {
  try {
    value?.disconnect?.();
  } catch (_error) {}
}

function retireObserverSlot(owner, key, value = null) {
  if (!owner) return;
  disconnect(owner[key]);
  try {
    Object.defineProperty(owner, key, {
      configurable: true,
      enumerable: false,
      get: () => value,
      set: (next) => disconnect(next),
    });
  } catch (_error) {
    try {
      owner[key] = value;
    } catch (_ignored) {}
  }
}

function disableLegacyOwners0154() {
  globalThis.__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__ = true;
  retireObserverSlot(globalThis, "__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__", null);
  retireObserverSlot(globalThis, "__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__", null);

  const mediaFix = globalThis.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__;
  if (mediaFix) retireObserverSlot(mediaFix, "observer", DISABLED_OBSERVER);

  const release = globalThis.__DASHBOARDMODERN_RELEASE_0154__;
  if (release) retireObserverSlot(release, "domObserver", DISABLED_OBSERVER);

  const idempotency = globalThis.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_IDEMPOTENCY__;
  if (idempotency) {
    retireObserverSlot(idempotency, "observer", DISABLED_OBSERVER);
    retireObserverSlot(idempotency, "styleObserver", DISABLED_OBSERVER);
  }
}

function removeLegacyStyles0154() {
  const doc = globalThis.document;
  if (!doc) return;
  LEGACY_STYLE_IDS.forEach((id) => doc.getElementById(id)?.remove());
}

function setData(node, key, value) {
  if (!node?.dataset || node.dataset[key] === value) return false;
  node.dataset[key] = value;
  return true;
}

function addClasses(node, ...tokens) {
  if (!node?.classList) return false;
  const missing = tokens.filter((token) => !node.classList.contains(token));
  if (!missing.length) return false;
  node.classList.add(...missing);
  return true;
}

function setAttribute(node, name, value) {
  if (!node || node.getAttribute(name) === value) return false;
  node.setAttribute(name, value);
  return true;
}

function setImportant(node, property, value) {
  if (!node?.style) return false;
  if (
    node.style.getPropertyValue(property) === value &&
    node.style.getPropertyPriority(property) === "important"
  ) {
    return false;
  }
  node.style.setProperty(property, value, "important");
  return true;
}

function directChild(node, predicate) {
  return [...(node?.children || [])].find(predicate) || null;
}

function applianceItems0154() {
  try {
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    return Array.isArray(items) ? items : [];
  } catch (_error) {
    return [];
  }
}

function applianceVisual0154(item) {
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

function fillViewport0154(viewport, media, artwork, visualNode) {
  setImportant(viewport, "position", "relative");
  setImportant(viewport, "padding", "0px");
  setImportant(viewport, "border-width", "0px");
  setImportant(viewport, "overflow", "hidden");

  [media, artwork, visualNode].forEach((node) => {
    if (!node) return;
    setImportant(node, "position", "absolute");
    setImportant(node, "inset", "0px");
    setImportant(node, "display", "block");
    setImportant(node, "box-sizing", "border-box");
    setImportant(node, "width", "100%");
    setImportant(node, "height", "100%");
    setImportant(node, "min-width", "0px");
    setImportant(node, "min-height", "0px");
    setImportant(node, "max-width", "100%");
    setImportant(node, "max-height", "100%");
    setImportant(node, "padding", "0px");
    setImportant(node, "margin", "0px");
    setImportant(node, "transform", "none");
  });
}

function normalizeCustomImage0154(card, item, visual, viewport, media) {
  if (visual?.kind !== "image" || !visual.value) return false;
  setData(card, "dmArtwork", "custom");
  setData(card, "dmMediaKind", "image");
  setData(card, "dmArtStyle", "panel");
  setData(card, "applianceThemeAware", "true");
  setData(viewport, "applianceCover", "true");

  let wrapper = directChild(media, (node) =>
    node.classList?.contains("dm-appliance-image-wrap"),
  );
  if (!wrapper) {
    wrapper = globalThis.document.createElement("span");
    wrapper.className = "dm-appliance-image-wrap";
    media.replaceChildren(wrapper);
  } else if (media.children.length !== 1) {
    media.replaceChildren(wrapper);
  }

  let image = directChild(
    wrapper,
    (node) =>
      node.tagName === "IMG" && node.classList?.contains("dm-appliance-custom-image-0154"),
  );
  if (!image) {
    image = globalThis.document.createElement("img");
    image.className =
      "dm-appliance-image dm-appliance-image-0153 dm-appliance-custom-image-0154";
    wrapper.replaceChildren(image);
  }

  setAttribute(image, "src", visual.value);
  setAttribute(image, "alt", String(item.name || ""));
  setAttribute(image, "loading", "eager");
  setAttribute(image, "decoding", "async");
  fillViewport0154(viewport, media, wrapper, image);
  setImportant(wrapper, "overflow", "hidden");
  setImportant(wrapper, "border-radius", "12px");
  setImportant(image, "overflow", "hidden");
  setImportant(image, "object-position", "center");

  const applyFit = () => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const fit = ratio >= 0.92 && ratio <= 1.08 ? "cover" : "contain";
    setData(image, "dmImageFit", fit);
    setImportant(image, "object-fit", fit);
  };
  if (image.complete && image.naturalWidth) {
    applyFit();
  } else if (image.dataset.dmImageFitPending !== visual.value) {
    setData(image, "dmImageFitPending", visual.value);
    image.addEventListener("load", applyFit, { once: true });
    setImportant(image, "object-fit", "contain");
  }
  return true;
}

function normalizeAsset0154(card, item, visual, viewport, media) {
  if (visual?.kind !== "asset") return false;
  const source = sourceToken0154(item, visual, card);
  const canonical = canonicalArtworkType0154(source);
  if (!canonical) return false;

  setData(card, "dmArtwork", canonical);
  setData(card, "dmMediaKind", "asset");
  setData(card, "dmMediaType", canonical);
  setData(card, "dmArtStyle", "panel");
  setData(card, "applianceThemeAware", "true");
  setData(viewport, "applianceCover", "true");

  let artwork = directChild(
    media,
    (node) =>
      node.classList?.contains("dm-appliance-art-0154") &&
      node.dataset?.dmArt === canonical,
  );
  const valid = Boolean(artwork?.querySelector("svg .dm-art-panel"));
  if (!valid || media.children.length !== 1) {
    const markup = applianceArtwork0154(canonical, 96);
    if (!markup) return false;
    media.innerHTML = markup;
    artwork = directChild(
      media,
      (node) =>
        node.classList?.contains("dm-appliance-art-0154") &&
        node.dataset?.dmArt === canonical,
    );
  }
  if (!artwork) return false;

  setData(artwork, "dmArtStyle", "panel");
  setData(artwork, "applianceAsset", source);
  setData(artwork, "applianceAssetKey", source);
  const svg = directChild(artwork, (node) => node.tagName?.toLowerCase() === "svg");
  fillViewport0154(viewport, media, artwork, svg);
  setImportant(artwork, "overflow", "hidden");
  setImportant(svg, "object-fit", "fill");
  setImportant(svg, "object-position", "center");
  setImportant(svg, "overflow", "visible");
  setImportant(svg, "flex", "0 0 100%");
  return true;
}

function observerOptions0154() {
  return { childList: true, subtree: true };
}

function resumeObserver0154(state) {
  if (!state.observer || !state.observerRoot) return;
  state.observer.observe(state.observerRoot, observerOptions0154());
}

function normalizeCards0154() {
  const state = state0154();
  const doc = globalThis.document;
  if (state.normalizing || !doc) return false;
  state.normalizing = true;
  disconnect(state.observer);
  try {
    disableLegacyOwners0154();
    removeLegacyStyles0154();
    const items = applianceItems0154();
    const byId = new Map(items.map((item) => [String(item.id || ""), item]));
    const cards = doc.querySelectorAll(
      "#appl-grid-overview .appl-wide-card[data-appliance-id], #page-appliances-main .appl-wide-card[data-appliance-id]",
    );
    cards.forEach((card, index) => {
      const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
      if (!item) return;
      const visual = applianceVisual0154(item);
      const viewport = card.querySelector(".appl-visual");
      const media = viewport?.querySelector(".appl-ic");
      if (!viewport || !media) return;
      addClasses(viewport, "dm-appliance-viewport-0154");
      addClasses(media, "dm-appliance-media-0154");
      if (normalizeCustomImage0154(card, item, visual, viewport, media)) return;
      normalizeAsset0154(card, item, visual, viewport, media);
    });
    return true;
  } finally {
    state.normalizing = false;
    resumeObserver0154(state);
  }
}

function installStyles0154() {
  const doc = globalThis.document;
  if (!doc?.head) return null;
  removeLegacyStyles0154();
  let style = doc.getElementById(STYLE_ID);
  if (style) return style;
  style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html body #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    html body #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .appl-visual {
      display:block!important;
      overflow:hidden!important;
      padding:0!important;
      background:var(--dm-art-tile)!important;
      border-color:var(--dm-art-panel-stroke)!important;
    }
    html body #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .appl-ic,
    html body #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .appl-ic,
    html body #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154,
    html body #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154,
    html body #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 > svg,
    html body #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 > svg {
      box-sizing:border-box!important;
      width:100%!important;
      height:100%!important;
      min-width:0!important;
      min-height:0!important;
      max-width:100%!important;
      max-height:100%!important;
      padding:0!important;
      margin:0!important;
      transform:none!important;
    }
  `;
  doc.head.append(style);
  return style;
}

function mutationTouchesCards0154(record) {
  if (record.target?.closest?.(".appl-wide-card[data-appliance-id]")) return true;
  return [...record.addedNodes, ...record.removedNodes].some((node) => {
    if (node?.nodeType !== 1) return false;
    return Boolean(
      node.matches?.(".appl-wide-card[data-appliance-id]") ||
        node.querySelector?.(".appl-wide-card[data-appliance-id]"),
    );
  });
}

function schedule0154() {
  const state = state0154();
  if (state.scheduled || state.normalizing) return;
  state.scheduled = true;
  const run = () => {
    state.scheduled = false;
    normalizeCards0154();
  };
  globalThis.requestAnimationFrame?.(run) || globalThis.setTimeout?.(run, 0);
}

function installObserver0154() {
  const state = state0154();
  const root =
    globalThis.document?.getElementById?.("page-appliances-main") || globalThis.document?.body;
  if (!root || typeof MutationObserver !== "function") return false;
  if (!state.observer) {
    state.observer = new MutationObserver((records) => {
      if (!state.normalizing && records.some(mutationTouchesCards0154)) schedule0154();
    });
  }
  if (state.observerRoot !== root || state.observerVersion !== 3) {
    disconnect(state.observer);
    state.observerRoot = root;
    state.observerVersion = 3;
  }
  resumeObserver0154(state);
  return true;
}

function installRendererHook0154() {
  const original = globalThis.renderApplianceSection;
  if (typeof original !== "function" || original.__dm0154SingleArtworkOwner) return false;

  function renderApplianceSection0154(...args) {
    const result = original.apply(this, args);
    if (result && typeof result.finally === "function") {
      return result.finally(() => normalizeCards0154());
    }
    normalizeCards0154();
    return result;
  }

  renderApplianceSection0154.__dm0154SingleArtworkOwner = true;
  renderApplianceSection0154.__dmPrevious = original;
  globalThis.renderApplianceSection = renderApplianceSection0154;
  return true;
}

function install0154() {
  if (!globalThis.document?.documentElement) return false;
  disableLegacyOwners0154();
  installStyles0154();
  installRendererHook0154();
  installObserver0154();
  normalizeCards0154();
  return true;
}

if (typeof globalThis.document !== "undefined") {
  install0154();
  globalThis.queueMicrotask?.(install0154);
  globalThis.setTimeout?.(install0154, 0);
  globalThis.setTimeout?.(install0154, 120);
  globalThis.setTimeout?.(install0154, 300);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0154);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", install0154, { once: true });
  }
}
