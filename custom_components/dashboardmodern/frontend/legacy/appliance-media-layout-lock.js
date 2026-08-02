/* DashboardModern: appliance media compatibility layer. */
import { applianceArtwork0152 } from "./release-0152-runtime.js";

const STYLE_ID = "dm-appliance-media-layout-lock-0153";
const DOM_OBSERVER_KEY = "__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__";
const STYLE_OBSERVER_KEY = "__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__";
const STYLE_LOCK_DISABLED_KEY = "__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__";

function setData0153(node, key, value) {
  if (node?.dataset && node.dataset[key] !== value) node.dataset[key] = value;
}

function canonicalArtworkType0153(value) {
  const token = String(value || "").toLowerCase();
  if (/microonde|microwave/.test(token)) return "microwave";
  if (/forno|oven|stove/.test(token)) return "oven";
  if (/frigo|fridge|refriger|frigorifero|freezer|congelatore/.test(token)) return "fridge";
  if (/scaldabagno|boiler|water[_ -]?heater/.test(token)) return "boiler";
  if (/lavatrice|washing[_ -]?machine|washer/.test(token)) return "washer";
  if (/asciugatrice|tumble[_ -]?dryer|dryer/.test(token)) return "dryer";
  if (/lavastoviglie|dishwasher/.test(token)) return "dishwasher";
  if (/piano[_ -]?cottura|cooktop|hob/.test(token)) return "cooktop";
  if (/televis|\btv\b|monitor/.test(token)) return "television";
  return "";
}

function applianceItems0153() {
  try {
    const items = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    return Array.isArray(items) ? items : [];
  } catch (_error) {
    return [];
  }
}

function applianceVisual0153(item) {
  try {
    return globalThis.DashboardModernModules?.data?.getDeviceVisual?.(item) || null;
  } catch (_error) {
    return null;
  }
}

function classifyApplianceImages0153() {
  const doc = globalThis.document;
  if (!doc) return;
  doc
    .querySelectorAll("#appl-grid-overview .appl-visual img, #page-appliances-main .appl-visual img")
    .forEach((image) => {
      const source = image.currentSrc || image.getAttribute("src") || "";
      const apply = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        const ratio = image.naturalWidth / image.naturalHeight;
        setData0153(image, "dmImageFit", ratio >= 0.92 && ratio <= 1.08 ? "cover" : "contain");
        setData0153(image, "dmImageFitSource", source);
      };
      if (image.complete && image.naturalWidth) apply();
      else if (image.dataset.dmImageFitPending !== source) {
        setData0153(image, "dmImageFitPending", source);
        image.addEventListener("load", apply, { once: true });
      }
    });
}

function restoreGeneratedArtwork0153() {
  if (globalThis[STYLE_LOCK_DISABLED_KEY]) return false;
  const doc = globalThis.document;
  if (!doc) return false;
  const items = applianceItems0153();
  if (!items.length) {
    classifyApplianceImages0153();
    return false;
  }
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  const cards = doc.querySelectorAll(
    "#appl-grid-overview .appl-wide-card[data-appliance-id], #page-appliances-main .appl-wide-card[data-appliance-id]",
  );

  cards.forEach((card, index) => {
    const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
    if (!item) return;
    const visual = applianceVisual0153(item);
    if (visual?.kind !== "asset") return;

    const sourceToken = String(
      visual.value || item.visual_key || item.device_type || item.type || item.name || "",
    );
    const type = canonicalArtworkType0153(sourceToken);
    if (!type) return;

    const viewport = card.querySelector(".appl-visual");
    const media = viewport?.querySelector(".appl-ic");
    if (!media) return;
    setData0153(card, "dmArtwork", type);
    setData0153(card, "dmArtStyle", "panel");
    media.classList.add("dm-appliance-media-0153", "dm-appliance-media-0154");
    viewport.classList.add("dm-appliance-viewport-0153", "dm-appliance-viewport-0154");

    const existing = media.querySelector(`[data-dm-art="${type}"]`);
    if (!existing || !existing.classList.contains("dm-appliance-art-0154")) {
      const markup = globalThis.cdApplianceIcon?.(type, 96) || applianceArtwork0152(type, 88);
      if (markup) media.innerHTML = markup;
    }

    const artwork = media.querySelector(`[data-dm-art="${type}"]`);
    if (artwork) {
      setData0153(artwork, "dmArtStyle", "panel");
      setData0153(artwork, "applianceAsset", sourceToken);
      setData0153(artwork, "applianceAssetKey", sourceToken);
    }
  });
  classifyApplianceImages0153();
  return true;
}

function installApplianceMediaLayoutLock0153() {
  const doc = globalThis.document;
  if (!doc?.head) return false;
  if (doc.getElementById(STYLE_ID)) return true;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html body #page-appliances-main #appl-grid-overview .appl-wide-card .appl-visual img,
    html body #appl-grid-overview .appl-wide-card .appl-visual img,
    html body #page-appliances-main .appl-wide-card .appl-visual img {
      display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;
      min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;
      object-fit:contain!important;object-position:center!important;border-radius:12px!important;transform:none!important;
    }
    html body #page-appliances-main #appl-grid-overview .appl-wide-card .appl-visual img[data-dm-image-fit="cover"],
    html body #appl-grid-overview .appl-wide-card .appl-visual img[data-dm-image-fit="cover"],
    html body #page-appliances-main .appl-wide-card .appl-visual img[data-dm-image-fit="cover"] {
      object-fit:cover!important;
    }
    html body #page-appliances-main #appl-grid-overview .appl-wide-card.dm-control-device[data-dm-artwork]
      .appl-visual .appl-ic.dm-appliance-media-0153 [data-dm-art] > svg,
    html body #appl-grid-overview .appl-wide-card.dm-control-device[data-dm-artwork]
      .appl-visual.dm-appliance-viewport-0153 .appl-ic.dm-appliance-media-0153 [data-dm-art] > svg,
    html body #page-appliances-main .appl-wide-card [data-dm-art] > svg,
    html body #appl-grid-overview .appl-wide-card [data-dm-art] > svg {
      display:block!important;box-sizing:border-box!important;width:88%!important;height:88%!important;
      min-width:0!important;min-height:0!important;max-width:88%!important;max-height:88%!important;
      object-fit:contain!important;object-position:center!important;transform:none!important;overflow:visible!important;
      flex:0 0 88%!important;
    }
  `;
  doc.head.append(style);
  return true;
}

function stopLegacyStyleObserver0153() {
  const observer = globalThis[STYLE_OBSERVER_KEY];
  observer?.disconnect?.();
  globalThis[STYLE_OBSERVER_KEY] = null;
}

function keepLayoutLockLast0153() {
  /* CSS specificity, not DOM reordering, determines precedence from 0.14.14 onward. */
  stopLegacyStyleObserver0153();
  return false;
}

function observeApplianceDom0153() {
  if (globalThis[STYLE_LOCK_DISABLED_KEY]) {
    globalThis[DOM_OBSERVER_KEY]?.disconnect?.();
    globalThis[DOM_OBSERVER_KEY] = null;
    return false;
  }
  const doc = globalThis.document;
  if (!doc?.body || globalThis[DOM_OBSERVER_KEY]) return false;
  let scheduled = false;
  const schedule = () => {
    if (scheduled || globalThis[STYLE_LOCK_DISABLED_KEY]) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      restoreGeneratedArtwork0153();
    };
    globalThis.requestAnimationFrame?.(run) || globalThis.setTimeout?.(run, 0);
  };
  const observer = new MutationObserver((records) => {
    const relevant = records.some((record) =>
      [...record.addedNodes, ...record.removedNodes].some(
        (node) =>
          node instanceof Element &&
          (node.matches?.("#appl-grid-overview, #page-appliances-main, .appl-wide-card") ||
            node.querySelector?.("#appl-grid-overview, #page-appliances-main, .appl-wide-card")),
      ),
    );
    if (relevant) schedule();
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  globalThis[DOM_OBSERVER_KEY] = observer;
  schedule();
  return true;
}

function install0153() {
  installApplianceMediaLayoutLock0153();
  keepLayoutLockLast0153();
  if (!globalThis[STYLE_LOCK_DISABLED_KEY]) {
    observeApplianceDom0153();
    restoreGeneratedArtwork0153();
  }
}

if (typeof globalThis.document !== "undefined") {
  install0153();
  globalThis.queueMicrotask?.(install0153);
  globalThis.setTimeout?.(install0153, 0);
  globalThis.setTimeout?.(install0153, 120);
  globalThis.setTimeout?.(install0153, 500);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0153);
  if (globalThis.document.readyState === "loading") {
    globalThis.document.addEventListener("DOMContentLoaded", install0153, { once: true });
  }
}
