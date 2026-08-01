/* DashboardModern: final appliance media lock loaded after legacy layout themes. */
import { applianceArtwork0152 } from "./release-0152-runtime.js";

const STYLE_ID = "dm-appliance-media-layout-lock-0153";
const DOM_OBSERVER_KEY = "__DASHBOARDMODERN_MEDIA_DOM_OBSERVER_0153__";

function canonicalArtworkType0153(value) {
  const token = String(value || "").toLowerCase();
  if (/frigo|fridge|refriger|frigorifero/.test(token)) return "fridge";
  if (/scaldabagno|boiler|water[_ -]?heater/.test(token)) return "boiler";
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

function restoreGeneratedArtwork0153() {
  const doc = globalThis.document;
  if (!doc) return false;
  const items = applianceItems0153();
  if (!items.length) return false;
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  const cards = doc.querySelectorAll(
    "#appl-grid-overview .appl-wide-card[data-appliance-id], #page-appliances-main .appl-wide-card[data-appliance-id]",
  );

  cards.forEach((card, index) => {
    const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
    if (!item) return;
    const visual = applianceVisual0153(item);
    if (visual?.kind !== "asset") return;

    const type = canonicalArtworkType0153(
      visual.value || item.visual_key || item.device_type || item.type || item.name,
    );
    if (!type) return;

    const media = card.querySelector(".appl-visual .appl-ic");
    if (!media) return;
    card.dataset.dmArtwork = type;
    media.classList.add("dm-appliance-media-0153");
    card.querySelector(".appl-visual")?.classList.add("dm-appliance-viewport-0153");

    if (!media.querySelector(`[data-dm-art="${type}"]`)) {
      const markup = applianceArtwork0152(type, 76);
      if (markup) media.innerHTML = markup;
    }
  });
  return true;
}

function installApplianceMediaLayoutLock0153() {
  const doc = globalThis.document;
  if (!doc?.head) return false;

  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html body #page-appliances-main #appl-grid-overview
        .appl-wide-card .appl-visual img,
      html body #appl-grid-overview
        .appl-wide-card .appl-visual img,
      html body #page-appliances-main
        .appl-wide-card .appl-visual img {
        display: block !important;
        box-sizing: border-box !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        object-position: center !important;
        border-radius: 12px !important;
        transform: none !important;
      }

      html body #page-appliances-main #appl-grid-overview
        .appl-wide-card.dm-control-device[data-dm-artwork]
        .appl-visual
        .appl-ic.dm-appliance-media-0153
        [data-dm-art]
        > svg,
      html body #appl-grid-overview
        .appl-wide-card.dm-control-device[data-dm-artwork]
        .appl-visual.dm-appliance-viewport-0153
        .appl-ic.dm-appliance-media-0153
        [data-dm-art]
        > svg,
      html body #page-appliances-main
        .appl-wide-card [data-dm-art] > svg,
      html body #appl-grid-overview
        .appl-wide-card [data-dm-art] > svg {
        display: block !important;
        box-sizing: border-box !important;
        width: 76% !important;
        height: 76% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: 76% !important;
        max-height: 76% !important;
        object-fit: contain !important;
        object-position: center !important;
        transform: none !important;
        overflow: visible !important;
        flex: 0 0 76% !important;
      }
    `;
  }

  if (doc.head.lastElementChild !== style) doc.head.append(style);
  return true;
}

function keepLayoutLockLast0153() {
  const doc = globalThis.document;
  if (!doc?.head || globalThis.__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__) return;
  let scheduled = false;
  const observer = new MutationObserver(() => {
    const style = doc.getElementById(STYLE_ID);
    if (!style || doc.head.lastElementChild === style || scheduled) return;
    scheduled = true;
    globalThis.queueMicrotask?.(() => {
      scheduled = false;
      installApplianceMediaLayoutLock0153();
    });
  });
  observer.observe(doc.head, { childList: true });
  globalThis.__DASHBOARDMODERN_MEDIA_STYLE_OBSERVER_0153__ = observer;
}

function observeApplianceDom0153() {
  const doc = globalThis.document;
  if (!doc?.documentElement || globalThis[DOM_OBSERVER_KEY]) return;
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      restoreGeneratedArtwork0153();
    };
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(run);
    } else {
      globalThis.setTimeout?.(run, 0);
    }
  };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.addedNodes.length || record.removedNodes.length)) schedule();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  globalThis[DOM_OBSERVER_KEY] = observer;
  schedule();
}

function install0153() {
  installApplianceMediaLayoutLock0153();
  keepLayoutLockLast0153();
  observeApplianceDom0153();
  restoreGeneratedArtwork0153();
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
