/* DashboardModern: final appliance media lock loaded after legacy layout themes. */
const STYLE_ID = "dm-appliance-media-layout-lock-0153";

function installApplianceMediaLayoutLock0153() {
  const doc = globalThis.document;
  if (!doc?.head) return false;

  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html body #page-appliances-main #appl-grid-overview
        .appl-wide-card.dm-control-device[data-dm-media-kind="image"]
        .appl-visual
        .appl-ic.dm-appliance-media-0153
        img.dm-appliance-image.dm-appliance-image-0153,
      html body #appl-grid-overview
        .appl-wide-card.dm-control-device[data-dm-media-kind="image"]
        .appl-visual.dm-appliance-viewport-0153
        .appl-ic.dm-appliance-media-0153
        img.dm-appliance-image.dm-appliance-image-0153 {
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
        > svg {
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

function install0153() {
  installApplianceMediaLayoutLock0153();
  keepLayoutLockLast0153();
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
