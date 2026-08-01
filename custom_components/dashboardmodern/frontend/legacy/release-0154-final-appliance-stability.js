/* DashboardModern 0.14.14: one isolated, idempotent owner for appliance media. */
import {
  applianceArtwork0154,
  canonicalArtworkType0154,
} from "./release-0154-runtime.js";

const KEY = "__DASHBOARDMODERN_RELEASE_0154_FINAL_APPLIANCE_STABILITY__";
const DISABLED_OBSERVER = Object.freeze({
  dashboardmodern_disabled: true,
  disconnect() {},
  observe() {},
});

function state0154() {
  return (globalThis[KEY] ||= {
    observer: null,
    scheduled: false,
    normalizing: false,
  });
}

function disconnectObserver(value) {
  try {
    value?.disconnect?.();
  } catch (_error) {}
}

function disableObjectObserver(key, ...properties) {
  const value = globalThis[key];
  if (!value || typeof value !== "object") return;
  properties.forEach((property) => {
    disconnectObserver(value[property]);
    try {
      value[property] = DISABLED_OBSERVER;
    } catch (_error) {}
  });
}

function disableLegacyObservers0154() {
  disconnectObserver(globalThis.__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__);
  disconnectObserver(globalThis.__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__);
  globalThis.__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__ = DISABLED_OBSERVER;
  globalThis.__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__ = DISABLED_OBSERVER;

  disableObjectObserver("__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__", "observer");
  disableObjectObserver("__DASHBOARDMODERN_RELEASE_0154__", "domObserver");
  disableObjectObserver(
    "__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__",
    "observer",
    "styleObserver",
  );
  disableObjectObserver(
    "__DASHBOARDMODERN_RELEASE_0154_ARTWORK_IDEMPOTENCY__",
    "observer",
    "styleObserver",
  );
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

function setDataset(node, key, value) {
  if (!node?.dataset || node.dataset[key] === value) return false;
  node.dataset[key] = value;
  return true;
}

function setImportant(node, property, value) {
  if (!node?.style) return;
  if (
    node.style.getPropertyValue(property) === value &&
    node.style.getPropertyPriority(property) === "important"
  ) {
    return;
  }
  node.style.setProperty(property, value, "important");
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

  if (visualNode) {
    setImportant(visualNode, "object-fit", "fill");
    setImportant(visualNode, "object-position", "center");
    setImportant(visualNode, "overflow", "visible");
  }
}

function normalizeCustomImage0154(card, item, visual, viewport, media) {
  if (visual?.kind !== "image" || !visual.value) return false;
  setDataset(card, "dmArtwork", "custom");
  setDataset(card, "dmMediaKind", "image");
  setDataset(card, "dmArtStyle", "panel");
  setDataset(card, "applianceThemeAware", "true");
  setDataset(viewport, "applianceCover", "true");

  let image = media.querySelector(":scope > img.dm-appliance-custom-image-0154");
  if (!image) {
    image = globalThis.document.createElement("img");
    image.className = "dm-appliance-image dm-appliance-image-0153 dm-appliance-custom-image-0154";
    media.replaceChildren(image);
  }
  if (image.getAttribute("src") !== visual.value) image.src = visual.value;
  image.alt = String(item.name || "");
  image.loading = "eager";
  image.decoding = "async";

  const applyFit = () => {
    const ratio = image.naturalHeight ? image.naturalWidth / image.naturalHeight : 0;
    const fit = ratio >= 0.92 && ratio <= 1.08 ? "cover" : "contain";
    setDataset(image, "dmImageFit", fit);
    setImportant(image, "object-fit", fit);
  };
  if (image.complete && image.naturalWidth) applyFit();
  else image.addEventListener("load", applyFit, { once: true });

  fillViewport0154(viewport, media, image, image);
  return true;
}

function normalizeAsset0154(card, item, visual, viewport, media) {
  if (visual?.kind !== "asset") return false;
  const source = sourceToken0154(item, visual, card);
  const canonical = canonicalArtworkType0154(source);
  if (!canonical) return false;

  setDataset(card, "dmArtwork", canonical);
  setDataset(card, "dmMediaKind", "asset");
  setDataset(card, "dmMediaType", canonical);
  setDataset(card, "dmArtStyle", "panel");
  setDataset(card, "applianceThemeAware", "true");
  setDataset(viewport, "applianceCover", "true");

  const selector = `:scope > .dm-appliance-art-0154[data-dm-art="${canonical}"]`;
  let artwork = media.querySelector(selector);
  const valid = Boolean(artwork?.querySelector("svg .dm-art-panel"));
  if (!valid || media.children.length !== 1) {
    const markup = applianceArtwork0154(canonical, 96);
    if (!markup) return false;
    media.innerHTML = markup;
    artwork = media.querySelector(selector);
  }
  if (!artwork) return false;

  setDataset(artwork, "dmArtStyle", "panel");
  setDataset(artwork, "applianceAsset", source);
  setDataset(artwork, "applianceAssetKey", source);
  const svg = artwork.querySelector(":scope > svg");
  fillViewport0154(viewport, media, artwork, svg);
  return true;
}

function normalizeCards0154() {
  const state = state0154();
  if (state.normalizing || !globalThis.document) return false;
  state.normalizing = true;
  try {
    const items = applianceItems0154();
    const byId = new Map(items.map((item) => [String(item.id || ""), item]));
    const cards = globalThis.document.querySelectorAll(
      "#appl-grid-overview .appl-wide-card[data-appliance-id], #page-appliances-main .appl-wide-card[data-appliance-id]",
    );
    cards.forEach((card, index) => {
      const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
      if (!item) return;
      const visual = applianceVisual0154(item);
      const viewport = card.querySelector(".appl-visual");
      const media = viewport?.querySelector(".appl-ic");
      if (!viewport || !media) return;
      viewport.classList.add("dm-appliance-viewport-0154");
      media.classList.add("dm-appliance-media-0154");
      if (normalizeCustomImage0154(card, item, visual, viewport, media)) return;
      normalizeAsset0154(card, item, visual, viewport, media);
    });
    return true;
  } finally {
    state.normalizing = false;
  }
}

function schedule0154() {
  const state = state0154();
  if (state.scheduled) return;
  state.scheduled = true;
  const run = () => {
    state.scheduled = false;
    disableLegacyObservers0154();
    normalizeCards0154();
  };
  globalThis.requestAnimationFrame?.(run) || globalThis.setTimeout?.(run, 0);
}

function installTargetedObserver0154() {
  const state = state0154();
  const page = globalThis.document?.getElementById?.("page-appliances-main");
  if (!page || state.observer || typeof MutationObserver !== "function") return false;
  state.observer = new MutationObserver((records) => {
    if (state.normalizing) return;
    const relevant = records.some((record) =>
      [...record.addedNodes, ...record.removedNodes].some(
        (node) =>
          node instanceof Element &&
          (node.matches?.(".appl-wide-card,.appl-visual,.appl-ic") ||
            node.querySelector?.(".appl-wide-card,.appl-visual,.appl-ic")),
      ),
    );
    if (relevant) schedule0154();
  });
  state.observer.observe(page, { childList: true, subtree: true });
  return true;
}

function install0154() {
  disableLegacyObservers0154();
  normalizeCards0154();
  installTargetedObserver0154();
}

if (typeof globalThis.document !== "undefined") {
  install0154();
  globalThis.queueMicrotask?.(install0154);
  globalThis.setTimeout?.(install0154, 0);
  globalThis.setTimeout?.(install0154, 300);
  globalThis.setTimeout?.(install0154, 700);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0154);
}
