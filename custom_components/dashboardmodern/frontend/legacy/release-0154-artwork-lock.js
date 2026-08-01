/* DashboardModern 0.14.14: final canonical artwork lock after every legacy observer. */
import {
  applianceArtwork0154,
  canonicalArtworkType0154,
} from "./release-0154-runtime.js";

const LOCK_KEY = "__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__";
const STYLE_ID = "dm-release-0154-final-artwork-lock";

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

    card.dataset.applianceThemeAware = "true";
    viewport.dataset.applianceCover = "true";
    card.dataset.dmArtStyle = "panel";
    viewport.classList.add("dm-appliance-viewport-0154");
    media.classList.add("dm-appliance-media-0154");

    if (visual?.kind === "image" && visual.value) {
      card.dataset.dmArtwork = "custom";
      card.dataset.dmMediaKind = "image";
      let image = media.querySelector("img");
      if (!image) {
        image = doc.createElement("img");
        media.replaceChildren(image);
      }
      if (image.getAttribute("src") !== visual.value) image.src = visual.value;
      image.alt = String(item.name || "");
      image.classList.add("dm-appliance-image", "dm-appliance-image-0153", "dm-appliance-custom-image-0154");
      return;
    }

    if (visual?.kind !== "asset") return;
    const source = sourceToken0154(item, visual, card);
    const canonical = canonicalArtworkType0154(source);
    if (!canonical) return;

    if (card.dataset.dmArtwork !== canonical) card.dataset.dmArtwork = canonical;
    card.dataset.dmMediaKind = "asset";
    card.dataset.dmMediaType = canonical;

    let artwork = media.querySelector(`.dm-appliance-art-0154[data-dm-art="${canonical}"]`);
    if (!artwork) {
      const markup = applianceArtwork0154(canonical, 96);
      if (markup) media.innerHTML = markup;
      artwork = media.querySelector(`.dm-appliance-art-0154[data-dm-art="${canonical}"]`);
    }
    if (!artwork) return;
    artwork.dataset.dmArtStyle = "panel";
    artwork.dataset.applianceAsset = source;
    artwork.dataset.applianceAssetKey = source;
  });
  return true;
}

function installStyles0154() {
  const doc = globalThis.document;
  if (!doc?.head) return false;
  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html body #page-appliances-main #appl-grid-overview
        .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
      html body #appl-grid-overview
        .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
      html body #page-appliances-main
        .appl-wide-card[data-dm-art-style="panel"] .appl-visual {
        display:grid!important;
        place-items:center!important;
        overflow:hidden!important;
        padding:0!important;
        background:var(--dm-art-tile)!important;
        border-color:var(--dm-art-panel-stroke)!important;
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
        display:grid!important;
        place-items:center!important;
        box-sizing:border-box!important;
        width:100%!important;
        height:100%!important;
        min-width:0!important;
        min-height:0!important;
        max-width:100%!important;
        max-height:100%!important;
        padding:0!important;
        margin:0!important;
        overflow:hidden!important;
        transform:none!important;
      }

      html body #page-appliances-main #appl-grid-overview
        .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 > svg,
      html body #appl-grid-overview
        .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 > svg,
      html body #page-appliances-main
        .appl-wide-card[data-dm-art-style="panel"] .dm-appliance-art-0154 > svg {
        display:block!important;
        box-sizing:border-box!important;
        width:100%!important;
        height:100%!important;
        min-width:0!important;
        min-height:0!important;
        max-width:100%!important;
        max-height:100%!important;
        object-fit:contain!important;
        object-position:center!important;
        transform:none!important;
        overflow:visible!important;
        flex:0 0 100%!important;
        filter:drop-shadow(0 8px 12px rgba(15,41,66,.16));
      }

      html body #page-appliances-main #appl-grid-overview
        .appl-wide-card[data-dm-artwork="custom"][data-dm-art-style="panel"] .appl-visual img,
      html body #appl-grid-overview
        .appl-wide-card[data-dm-artwork="custom"][data-dm-art-style="panel"] .appl-visual img,
      html body #page-appliances-main
        .appl-wide-card[data-dm-artwork="custom"][data-dm-art-style="panel"] .appl-visual img {
        display:block!important;
        box-sizing:border-box!important;
        width:100%!important;
        height:100%!important;
        min-width:0!important;
        min-height:0!important;
        max-width:100%!important;
        max-height:100%!important;
        padding:0!important;
        border:0!important;
        border-radius:12px!important;
        box-shadow:none!important;
        object-fit:contain!important;
        object-position:center!important;
        transform:none!important;
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
  }
  if (doc.head.lastElementChild !== style) doc.head.append(style);
  return true;
}

function schedule0154() {
  const state = globalThis[LOCK_KEY];
  if (!state || state.scheduled) return;
  state.scheduled = true;
  const run = () => {
    state.scheduled = false;
    installStyles0154();
    enforceArtwork0154();
  };
  globalThis.requestAnimationFrame?.(run) || globalThis.setTimeout?.(run, 0);
}

function installLock0154() {
  const doc = globalThis.document;
  if (!doc?.documentElement) return false;
  const state = (globalThis[LOCK_KEY] ||= { observer: null, styleObserver: null, scheduled: false });
  installStyles0154();
  enforceArtwork0154();

  if (!state.observer && typeof MutationObserver === "function") {
    state.observer = new MutationObserver(schedule0154);
    state.observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-dm-artwork", "data-dm-art-style", "class", "src"],
    });
  }
  if (!state.styleObserver && typeof MutationObserver === "function" && doc.head) {
    state.styleObserver = new MutationObserver(() => {
      if (doc.head.lastElementChild?.id !== STYLE_ID) installStyles0154();
    });
    state.styleObserver.observe(doc.head, { childList: true });
  }
  return true;
}

if (typeof globalThis.document !== "undefined") {
  installLock0154();
  globalThis.queueMicrotask?.(installLock0154);
  globalThis.setTimeout?.(installLock0154, 0);
  globalThis.setTimeout?.(installLock0154, 200);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", installLock0154);
}
