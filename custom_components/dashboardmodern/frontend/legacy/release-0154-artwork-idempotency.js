/* DashboardModern 0.14.14: replace the broad artwork observer with an idempotent one. */
import {
  applianceArtwork0154,
  canonicalArtworkType0154,
} from "./release-0154-runtime.js";

const PREVIOUS_KEY = "__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__";
const KEY = "__DASHBOARDMODERN_RELEASE_0154_ARTWORK_IDEMPOTENCY__";
const STYLE_ID = "dm-release-0154-final-artwork-lock";
const CARD_SELECTOR =
  "#appl-grid-overview .appl-wide-card[data-appliance-id], #page-appliances-main .appl-wide-card[data-appliance-id]";

function applianceItems0154() {
  try {
    const value = globalThis.DashboardModernModules?.store?.getSection?.("appliances");
    return Array.isArray(value) ? value : [];
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

function assignDataset0154(node, key, value) {
  if (!node?.dataset || node.dataset[key] === value) return false;
  node.dataset[key] = value;
  return true;
}

function addClasses0154(node, ...classes) {
  if (!node?.classList) return false;
  const missing = classes.filter((name) => !node.classList.contains(name));
  if (!missing.length) return false;
  node.classList.add(...missing);
  return true;
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

function normalizeCards0154() {
  const doc = globalThis.document;
  if (!doc) return false;
  const items = applianceItems0154();
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  const cards = doc.querySelectorAll(CARD_SELECTOR);

  cards.forEach((card, index) => {
    const item = byId.get(String(card.dataset.applianceId || "")) || items[index];
    if (!item) return;
    const visual = applianceVisual0154(item);
    const viewport = card.querySelector(".appl-visual");
    const media = viewport?.querySelector(".appl-ic");
    if (!viewport || !media) return;

    assignDataset0154(card, "applianceThemeAware", "true");
    assignDataset0154(viewport, "applianceCover", "true");
    assignDataset0154(card, "dmArtStyle", "panel");
    addClasses0154(viewport, "dm-appliance-viewport-0154");
    addClasses0154(media, "dm-appliance-media-0154");

    if (visual?.kind === "image" && visual.value) {
      assignDataset0154(card, "dmArtwork", "custom");
      assignDataset0154(card, "dmMediaKind", "image");
      let image = media.querySelector("img");
      if (!image) {
        image = doc.createElement("img");
        media.replaceChildren(image);
      }
      if (image.getAttribute("src") !== visual.value) image.src = visual.value;
      const alt = String(item.name || "");
      if (image.alt !== alt) image.alt = alt;
      addClasses0154(
        image,
        "dm-appliance-image",
        "dm-appliance-image-0153",
        "dm-appliance-custom-image-0154",
      );
      return;
    }

    if (visual?.kind !== "asset") return;
    const source = sourceToken0154(item, visual, card);
    const canonical = canonicalArtworkType0154(source);
    if (!canonical) return;

    assignDataset0154(card, "dmArtwork", canonical);
    assignDataset0154(card, "dmMediaKind", "asset");
    assignDataset0154(card, "dmMediaType", canonical);

    let artwork = media.querySelector(`.dm-appliance-art-0154[data-dm-art="${canonical}"]`);
    if (!artwork) {
      const markup = applianceArtwork0154(canonical, 96);
      if (markup) media.innerHTML = markup;
      artwork = media.querySelector(`.dm-appliance-art-0154[data-dm-art="${canonical}"]`);
    }
    if (!artwork) return;
    assignDataset0154(artwork, "dmArtStyle", "panel");
    assignDataset0154(artwork, "applianceAsset", source);
    assignDataset0154(artwork, "applianceAssetKey", source);
  });
  return true;
}

function nodeTouchesCards0154(node, target) {
  if (!(node instanceof Element)) return false;
  if (node.matches?.(".appl-wide-card[data-appliance-id]")) return true;
  if (node.querySelector?.(".appl-wide-card[data-appliance-id]")) return true;
  return Boolean(target?.closest?.(".appl-wide-card[data-appliance-id]"));
}

function relevantMutation0154(record) {
  if (record.type === "attributes") {
    return Boolean(record.target?.closest?.(".appl-wide-card[data-appliance-id]"));
  }
  if (record.target?.closest?.(".appl-wide-card[data-appliance-id]")) return true;
  return [...record.addedNodes, ...record.removedNodes].some((node) =>
    nodeTouchesCards0154(node, record.target),
  );
}

function state0154() {
  return (globalThis[KEY] ||= {
    observer: null,
    styleObserver: null,
    scheduled: false,
  });
}

function keepStyleLast0154() {
  const doc = globalThis.document;
  const style = doc?.getElementById?.(STYLE_ID);
  if (style && doc.head?.lastElementChild !== style) doc.head.append(style);
}

function schedule0154() {
  const state = state0154();
  if (state.scheduled) return;
  state.scheduled = true;
  const run = () => {
    state.scheduled = false;
    keepStyleLast0154();
    normalizeCards0154();
  };
  globalThis.requestAnimationFrame?.(run) || globalThis.setTimeout?.(run, 0);
}

function install0154() {
  const doc = globalThis.document;
  if (!doc?.documentElement) return false;

  const previous = globalThis[PREVIOUS_KEY];
  previous?.observer?.disconnect?.();
  previous?.styleObserver?.disconnect?.();
  if (previous) {
    previous.observer = null;
    previous.styleObserver = null;
  }

  const state = state0154();
  keepStyleLast0154();
  normalizeCards0154();

  if (!state.observer && typeof MutationObserver === "function") {
    state.observer = new MutationObserver((records) => {
      if (records.some(relevantMutation0154)) schedule0154();
    });
    state.observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-dm-artwork", "data-dm-art-style", "src"],
    });
  }

  if (!state.styleObserver && doc.head && typeof MutationObserver === "function") {
    state.styleObserver = new MutationObserver(() => {
      if (doc.head.lastElementChild?.id !== STYLE_ID) keepStyleLast0154();
    });
    state.styleObserver.observe(doc.head, { childList: true });
  }
  return true;
}

if (typeof globalThis.document !== "undefined") {
  install0154();
  globalThis.queueMicrotask?.(install0154);
  globalThis.setTimeout?.(install0154, 0);
  globalThis.setTimeout?.(install0154, 250);
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", install0154);
}
