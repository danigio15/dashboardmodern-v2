/* DashboardModern 0.14.14: final canonical artwork lock without observer feedback. */
import {
  applianceArtwork0154,
  canonicalArtworkType0154,
} from "./release-0154-runtime.js";

const LOCK_KEY = "__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__";
const STYLE_ID = "dm-release-0154-final-artwork-lock";
const LEGACY_STYLE_DISABLED_KEY = "__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__";
const LEGACY_STYLE_OBSERVER_KEY = "__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__";
const LEGACY_DOM_OBSERVER_KEY = "__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__";

function setData0154(node, key, value) {
  if (node?.dataset && node.dataset[key] !== value) node.dataset[key] = value;
}

function setAttribute0154(node, name, value) {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function disableLegacyObservers0154() {
  globalThis[LEGACY_STYLE_DISABLED_KEY] = true;
  globalThis[LEGACY_STYLE_OBSERVER_KEY]?.disconnect?.();
  globalThis[LEGACY_DOM_OBSERVER_KEY]?.disconnect?.();
  globalThis[LEGACY_STYLE_OBSERVER_KEY] = null;
  globalThis[LEGACY_DOM_OBSERVER_KEY] = null;
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

function classifyImage0154(image) {
  const source = image.currentSrc || image.getAttribute("src") || "";
  const apply = () => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    setData0154(image, "dmImageFit", ratio >= 0.92 && ratio <= 1.08 ? "cover" : "contain");
    setData0154(image, "dmImageFitSource", source);
  };
  if (image.complete && image.naturalWidth) apply();
  else if (image.dataset.dmImageFitPending !== source) {
    setData0154(image, "dmImageFitPending", source);
    image.addEventListener("load", apply, { once: true });
  }
}

function enforceArtwork0154() {
  const doc = globalThis.document;
  if (!doc) return false;
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
    viewport.classList.add("dm-appliance-viewport-0154");
    media.classList.add("dm-appliance-media-0154");

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
      image.classList.add(
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
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual .appl-ic,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual .appl-ic,
    html body #page-appliances-main
      .appl-wide-card[data-dm-art-style="panel"] .appl-visual .appl-ic,
    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 {
      display:grid!important;place-items:center!important;box-sizing:border-box!important;
      width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
      max-width:100%!important;max-height:100%!important;padding:0!important;margin:0!important;
      overflow:hidden!important;transform:none!important;
    }
    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 > svg,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 > svg,
    html body #page-appliances-main
      .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 > svg {
      display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;
      min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;
      object-fit:contain!important;object-position:center!important;transform:none!important;
      overflow:visible!important;flex:0 0 100%!important;filter:drop-shadow(0 8px 12px rgba(15,41,66,.16));
    }
    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-artwork="custom"][data-dm-art-style="panel"] .appl-visual img,
    html body #appl-grid-overview
      .appl-wide-card[data-dm-artwork="custom"][data-dm-art-style="panel"] .appl-visual img,
    html body #page-appliances-main
      .appl-wide-card[data-dm-artwork="custom"][data-dm-art-style="panel"] .appl-visual img {
      display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;
      min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;
      padding:0!important;border:0!important;border-radius:12px!important;box-shadow:none!important;
      object-fit:contain!important;object-position:center!important;transform:none!important;
    }
    html body #page-appliances-main #appl-grid-overview
      .appl-wide-card[data-dm-artwork="custom"] .appl-visual img[data-dm-image-fit="cover"],
    html body #appl-grid-overview
      .appl-wide-card[data-dm-artwork="custom"] .appl-visual img[data-dm-image-fit="cover"],
    html body #page-appliances-main
      .appl-wide-card[data-dm-artwork="custom"] .appl-visual img[data-dm-image-fit="cover"] {
      object-fit:cover!important;
    }
  `;
  doc.head.append(style);
  return style;
}

function settleStyleOrder0154() {
  const state = globalThis[LOCK_KEY];
  const doc = globalThis.document;
  if (!state || state.styleSettled || !doc?.head) return;
  const style = installStyles0154();
  if (style && doc.head.lastElementChild !== style) doc.head.append(style);
  state.styleSettled = true;
}

function nodeTouchesAppliances0154(node) {
  if (!node || node.nodeType !== 1) return false;
  return Boolean(
    node.matches?.("#appl-grid-overview, #page-appliances-main, .appl-wide-card, .appl-visual, .appl-ic") ||
      node.closest?.("#appl-grid-overview, #page-appliances-main") ||
      node.querySelector?.("#appl-grid-overview, #page-appliances-main, .appl-wide-card"),
  );
}

function mutationTouchesAppliances0154(record) {
  if (record.type === "attributes") return nodeTouchesAppliances0154(record.target);
  if (nodeTouchesAppliances0154(record.target)) return true;
  return [...record.addedNodes, ...record.removedNodes].some(nodeTouchesAppliances0154);
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
  if (state.observerVersion === 2 && state.observer) return true;
  state.observer?.disconnect?.();
  state.styleObserver?.disconnect?.();
  state.styleObserver = null;
  state.observer = new MutationObserver((records) => {
    if (records.some(mutationTouchesAppliances0154)) schedule0154();
  });
  state.observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-dm-artwork", "data-dm-art-style", "class", "src"],
  });
  state.observerVersion = 2;
  return true;
}

function installLock0154() {
  const doc = globalThis.document;
  if (!doc?.documentElement) return false;
  const state = (globalThis[LOCK_KEY] ||= {
    observer: null,
    styleObserver: null,
    observerVersion: 0,
    scheduled: false,
    styleSettled: false,
  });
  disableLegacyObservers0154();
  installStyles0154();
  enforceArtwork0154();
  installObserver0154();
  return true;
}

if (typeof globalThis.document !== "undefined") {
  installLock0154();
  globalThis.queueMicrotask?.(installLock0154);
  globalThis.setTimeout?.(() => {
    installLock0154();
    settleStyleOrder0154();
  }, 0);
  globalThis.setTimeout?.(installLock0154, 200);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installLock0154();
    settleStyleOrder0154();
  });
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", installLock0154, { once: true });
  }
}
