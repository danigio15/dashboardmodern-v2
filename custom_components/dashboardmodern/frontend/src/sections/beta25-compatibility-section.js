// Beta 25/26 compatibility owner: keep the real-device fixes while preserving
// the stable DOM/runtime contracts used by the existing dashboard renderers.
import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import { preferredApplianceVisual } from "./beta25-real-device-fixes-section.js";
import {
  clean,
  dashboardStore,
  doc,
  english,
  esc,
  installStyle,
  root,
  section,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA25_COMPATIBILITY__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  storeUnsubscribe: null,
  storeWritesWrapped: false,
});

function appliances() {
  const value = section("appliances", []);
  return Array.isArray(value) ? value : [];
}

function schedule(callback) {
  root.queueMicrotask?.(callback);
  root.requestAnimationFrame?.(callback);
  root.setTimeout?.(callback, 0);
  root.setTimeout?.(callback, 60);
  root.setTimeout?.(callback, 250);
}

function restoreTemperatureEntityPickers(form) {
  if (!form) return false;
  let changed = false;
  form.querySelectorAll("#ed-pl-temp,#dm-humidity-new").forEach((input) => {
    input.dataset.entityInput = "true";
  });

  // Beta25 originally attached its own anonymous click handler before the
  // canonical entity-picker mount also attached one. Clone only those buttons
  // once to drop the first handler, then let the canonical mount own the click.
  form.querySelectorAll(".dm-entity-picker[data-beta25-pick]").forEach((button) => {
    const target = clean(button.dataset.beta25Pick);
    if (!target) return;
    const clone = button.cloneNode(true);
    clone.dataset.entityTarget = target;
    clone.dataset.dmBeta25PickerCompat = "true";
    clone.removeAttribute("data-beta25-pick");
    clone.removeAttribute("data-picker-mounted");
    button.replaceWith(clone);
    changed = true;
  });

  try {
    root.DashboardModernModules?.render?.mountEntityPickers?.(form);
  } catch (_error) {}
  return changed;
}

function restoreHiddenTemperatureIcon(form) {
  if (!form || form.querySelector("#dm-temperature-icon")) return false;
  const input = doc.createElement("input");
  input.type = "hidden";
  input.id = "dm-temperature-icon";
  input.hidden = true;
  const roomId = clean(form.querySelector("#dm-temperature-room")?.value);
  const room = section("rooms", []).find?.((item) => clean(item.id) === roomId);
  input.value = clean(room?.icon || "🌡️");
  form.append(input);
  return true;
}

/**
 * A configured room remains a valid target for a second Beta25 association.
 * The legacy mount can restore disabled attributes after the Beta25 form has
 * rendered, including immediately before Android/iOS opens its native select.
 */
export function enableTemperatureRoomOptions(
  select = doc?.getElementById?.("dm-temperature-room"),
) {
  if (!select) return false;
  const form = select.closest?.("[data-beta25-temperature-form]");
  if (!form) return false;

  select.disabled = false;
  select.removeAttribute("disabled");
  select.removeAttribute("aria-disabled");
  select.tabIndex = 0;
  select.dataset.dmRealDeviceEditable = "true";
  select.dataset.dmBeta26RoomReuse = "true";
  select.style.setProperty("pointer-events", "auto", "important");
  select.style.setProperty("opacity", "1", "important");
  select.style.setProperty("cursor", "pointer", "important");
  for (const option of select.options || []) {
    option.disabled = false;
    option.removeAttribute("disabled");
    option.removeAttribute("aria-disabled");
  }
  return true;
}

/**
 * Beta 25 supports more than one temperature association per room. Keep the
 * pre-Beta25 selectors/markers as aliases so older editor/layout owners do not
 * fight the new renderer.
 */
export function restoreTemperatureContracts() {
  const grid = doc?.getElementById?.("temp-grid");
  if (grid?.dataset.dmTemperatureRenderer === "beta25-multi") {
    grid.dataset.beta25TemperatureRenderer = "multi";
    grid.dataset.dmTemperatureRenderer = "canonical";
  }

  const body = doc?.getElementById?.("ed-body");
  if (!body) return Boolean(grid);
  if (body.dataset.renderer === "temperature-beta25") {
    body.dataset.beta25Renderer = "temperature-beta25";
    body.dataset.renderer = "temperature";
  }

  body.querySelectorAll("[data-beta25-temperature-row]").forEach((row) => {
    row.setAttribute("data-temperature-room", "");
    row.querySelector("[data-beta25-temperature-edit]")?.setAttribute("data-temperature-edit", "");
    row.querySelector("[data-beta25-temperature-delete]")?.setAttribute("data-temperature-delete", "");
  });

  const form = body.querySelector("[data-beta25-temperature-form]");
  if (!form) return Boolean(grid);
  form.setAttribute("data-temperature-form", "");
  restoreHiddenTemperatureIcon(form);
  restoreTemperatureEntityPickers(form);

  const submit = form.querySelector("[data-beta25-temperature-submit]");
  const cancel = form.querySelector("[data-beta25-temperature-cancel]");
  const roomSelect = form.querySelector("#dm-temperature-room");
  submit?.setAttribute("data-temperature-submit", "");
  cancel?.setAttribute("data-temperature-cancel", "");
  const editing = Boolean(cancel && !cancel.hidden);
  form.dataset.dmTemperatureMode = editing ? "edit" : "add";
  enableTemperatureRoomOptions(roomSelect);
  if (submit) {
    submit.style.minHeight = "44px";
    submit.textContent = editing
      ? english()
        ? "SAVE CHANGES"
        : "SALVA MODIFICHE"
      : english()
        ? "ASSOCIATE SENSORS"
        : "ASSOCIA SENSORI";
  }
  if (cancel) cancel.style.minHeight = "44px";
  return true;
}

function withVisualIntent(item = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const hasType = Object.prototype.hasOwnProperty.call(item, "visual_type");
  const hasKey = Object.prototype.hasOwnProperty.call(item, "visual_key");
  const hasImage =
    Object.prototype.hasOwnProperty.call(item, "image") ||
    Object.prototype.hasOwnProperty.call(item, "image_url");
  if (!hasType && !hasKey && !hasImage) return item;

  const visualType = clean(item.visual_type).toLowerCase();
  const visualKey = clean(item.visual_key);
  const image = clean(item.image || item.image_url);
  const explicitCatalog = Boolean(visualType && visualKey);
  const metadata = { ...(item.metadata || {}) };
  let markMetadata = false;
  if (explicitCatalog) {
    metadata.visual_selection_explicit = true;
    markMetadata = true;
  } else if (hasImage && image) {
    metadata.visual_selection_explicit = false;
    markMetadata = true;
  }
  return {
    ...item,
    ...(image && !explicitCatalog ? { visual_type: "image" } : {}),
    ...(markMetadata ? { metadata } : {}),
  };
}

function wrapApplianceStoreWrites() {
  const store = dashboardStore();
  if (!store || state.storeWritesWrapped) return false;
  state.storeWritesWrapped = true;

  const originalReplace = store.replaceSection?.bind(store);
  if (originalReplace)
    store.replaceSection = (name, value) =>
      originalReplace(
        name,
        name === "appliances" && Array.isArray(value) ? value.map(withVisualIntent) : value,
      );

  const originalAdd = store.addItem?.bind(store);
  if (originalAdd)
    store.addItem = (name, item) =>
      originalAdd(name, name === "appliances" ? withVisualIntent(item) : item);

  const originalUpdate = store.updateItem?.bind(store);
  if (originalUpdate)
    store.updateItem = (name, id, patch) =>
      originalUpdate(name, id, name === "appliances" ? withVisualIntent(patch) : patch);
  return true;
}

/**
 * Old configurations can legitimately have a custom image and no explicit
 * visual selection. New writes should identify those records as image before
 * the Beta25 stale-image cleanup runs.
 */
export function protectLegacyCustomImages() {
  const store = dashboardStore();
  const list = store?.state?.sections?.appliances;
  if (!Array.isArray(list)) return false;
  let changed = false;
  for (const device of list) {
    const image = clean(device?.image || device?.image_url);
    if (!image || clean(device?.visual_type).toLowerCase() === "image") continue;
    if (device?.metadata?.visual_selection_explicit === true) continue;
    if (device?.metadata?.visual_selection_explicit === false) {
      device.visual_type = "image";
      changed = true;
    }
  }
  if (changed) store.persist?.();
  return changed;
}

/** Catalog selections are explicit only when visual_key is present. Re-apply
 * their artwork after every legacy/modern appliance render so saving a
 * dishwasher can never fall back to the washer/default image. */
export function repairExplicitCatalogArtwork() {
  let repaired = false;
  const configured = appliances();
  const byId = new Map(configured.map((device) => [clean(device.id), device]));
  doc
    ?.querySelectorAll?.(
      "#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]",
    )
    .forEach((card, index) => {
      const device = byId.get(clean(card.dataset.applianceId)) || configured[index];
      const key = clean(device?.visual_key);
      if (!key || clean(device?.visual_type).toLowerCase() !== "asset") return;
      const artwork = canonicalArtworkType(key);
      if (!artwork) return;
      const media = card.querySelector(".appl-visual .appl-ic,.appl-ic");
      if (!media) return;
      const current = media.querySelector(":scope > .dm-appliance-art");
      // Pass the original catalog key to applianceArtwork. Passing the already
      // canonical English token "dishwasher" would be canonicalized a second
      // time and can collide with the substring "washer".
      if (!current || current.dataset.dmArt !== artwork) media.innerHTML = applianceArtwork(key, 96);
      card.dataset.dmArtwork = artwork;
      card.dataset.dmMediaKind = "asset";
      repaired = true;
    });
  return repaired;
}

function iconPreviewMarkup(token, size = 27) {
  return (
    root.DashboardModernIconEngine?.markup?.("action", clean(token) || "mdi:power-plug", {
      size,
    }) || "🎨"
  );
}

/** Beta26: Loads now exposes the same searchable canonical icon picker. */
export function ensureLoadIconPicker() {
  const input = doc?.getElementById?.("dm-load-icon");
  if (!input) return false;
  input.classList.add("ed-icon-input");
  input.dataset.iconCategory = "action";

  let wrapper = input.closest?.(".dm-beta26-load-icon-field");
  if (!wrapper) {
    wrapper = doc.createElement("span");
    wrapper.className = "dm-beta26-load-icon-field";
    input.replaceWith(wrapper);
    wrapper.append(input);
  }

  let button = wrapper.querySelector(".dm-beta26-load-icon-picker");
  if (!button) {
    button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-icon-picker dm-beta26-load-icon-picker";
    button.dataset.iconTarget = "dm-load-icon";
    button.dataset.iconCategory = "action";
    button.setAttribute("aria-label", english() ? "Choose load icon" : "Scegli icona carico");
    wrapper.append(button);
  }

  const paint = () => {
    button.innerHTML = iconPreviewMarkup(input.value);
    button.dataset.dmLoadIcon = clean(input.value) || "mdi:power-plug";
  };
  if (input.dataset.dmBeta26IconPreviewBound !== "true") {
    input.dataset.dmBeta26IconPreviewBound = "true";
    input.addEventListener("input", paint);
    input.addEventListener("change", paint);
  }
  paint();
  input.closest?.(".ed-form-row")?.classList.add("dm-beta26-load-name-icon-row");
  return true;
}

/** Return the same appliance visual already used by the public card. */
export function applianceEditorVisualMarkup(device = {}, size = 48) {
  const visual = preferredApplianceVisual(device) || {
    kind: "asset",
    value: clean(device.icon || device.name || "generic"),
    artwork: "",
  };
  if (visual.kind === "image" && clean(visual.value)) {
    return `<span class="dm-beta26-appliance-image" data-dm-media-kind="image"><img src="${esc(visual.value)}" alt="" loading="lazy"></span>`;
  }
  const token = clean(visual.value || visual.artwork || device.icon || device.name || "generic");
  return applianceArtwork(token, size) || applianceArtwork("generic", size);
}

function currentApplianceForForm() {
  const name = clean(doc?.getElementById?.("appl-name")?.value);
  const icon = clean(doc?.getElementById?.("appl-icon")?.value);
  const list = appliances();
  return (
    list.find(
      (item) =>
        name &&
        clean(item.name) === name &&
        (!icon || clean(item.icon || item.visual_key || item.device_type) === icon),
    ) ||
    list.find((item) => name && clean(item.name) === name) ||
    { icon: icon || "generico", name }
  );
}

/** Beta26: editor list/form previews use the exact canonical dashboard artwork. */
export function syncApplianceEditorVisuals() {
  const button = doc?.getElementById?.("appl-icon-btn");
  if (!button) return false;
  const body = button.closest?.("#ed-body") || doc.getElementById?.("ed-body");
  const list = appliances();
  const rows = [...(body?.querySelectorAll?.(".ed-list > .ed-row") || [])];

  rows.slice(0, list.length).forEach((row, index) => {
    const title = row.querySelector(".ed-row-new");
    if (!title) return;
    let visual = title.querySelector(":scope > .dm-beta26-appliance-row-art");
    if (!visual) {
      const first = title.querySelector(":scope > span");
      visual = first || doc.createElement("span");
      visual.className = "dm-beta26-appliance-row-art";
      if (!visual.parentElement) title.prepend(visual, " ");
    }
    visual.innerHTML = applianceEditorVisualMarkup(list[index], 30);
    visual.dataset.applianceId = clean(list[index]?.id);
  });

  button.innerHTML = applianceEditorVisualMarkup(currentApplianceForForm(), 54);
  button.dataset.dmBeta26Artwork = "canonical";
  button.title = english() ? "Choose appliance" : "Scegli elettrodomestico";
  return true;
}

function reconcileAppliances() {
  protectLegacyCustomImages();
  repairExplicitCatalogArtwork();
}

function restoreEditorVisualContracts() {
  restoreTemperatureContracts();
  ensureLoadIconPicker();
  syncApplianceEditorVisuals();
}

function bindRuntimeOwners() {
  for (const name of ["buildTempCards", "renderTemperature"])
    wrapFunction(name, "__dmBeta25CompatTemperature", restoreTemperatureContracts);
  for (const name of ["renderAppliances", "renderApplianceSection"])
    wrapFunction(name, "__dmBeta25CompatAppliances", () => schedule(reconcileAppliances));
  for (const name of ["editorSwitch", "edApplEdit", "dmApplianceChoose"])
    wrapFunction(name, "__dmBeta26CompatEditor", () => schedule(restoreEditorVisualContracts));
}

function subscribeStore() {
  const store = dashboardStore();
  if (state.storeUnsubscribe || !store?.subscribe) return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.section === "appliances" || change?.section === "snapshot") {
      protectLegacyCustomImages();
      schedule(repairExplicitCatalogArtwork);
      schedule(syncApplianceEditorVisuals);
    }
    if (change?.section === "loads" || change?.section === "snapshot")
      schedule(ensureLoadIconPicker);
    if (change?.section === "rooms" || change?.section === "snapshot")
      schedule(restoreTemperatureContracts);
  });
}

function installEditorStyles() {
  installStyle(
    "dm-beta26-real-device-editor-style",
    `
      #ed-body .dm-beta26-load-icon-field{display:flex!important;align-items:stretch!important;gap:8px!important;min-width:0!important;flex:1 1 auto!important}
      #ed-body .dm-beta26-load-icon-field>#dm-load-icon{min-width:0!important;flex:1 1 auto!important}
      #ed-body .dm-beta26-load-icon-picker{display:grid!important;place-items:center!important;flex:0 0 54px!important;width:54px!important;height:54px!important;padding:8px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,var(--ha-card-background,#fff)),var(--ha-card-background,#fff))!important;cursor:pointer!important;overflow:hidden!important}
      #ed-body .dm-beta26-load-icon-picker .dm-icon-engine-glyph{font-size:27px!important}
      #ed-body .dm-beta26-appliance-row-art{display:inline-grid!important;place-items:center!important;width:34px!important;height:34px!important;margin-right:7px!important;vertical-align:middle!important;color:initial!important}
      #ed-body .dm-beta26-appliance-row-art .dm-appliance-art,#ed-body .dm-beta26-appliance-row-art .dm-appliance-art svg{display:block!important;width:32px!important;height:32px!important}
      #ed-body #appl-icon-btn{overflow:hidden!important;padding:4px!important;color:initial!important}
      #ed-body #appl-icon-btn .dm-appliance-art,#ed-body #appl-icon-btn .dm-appliance-art svg,#ed-body #appl-icon-btn .dm-beta26-appliance-image,#ed-body #appl-icon-btn .dm-beta26-appliance-image img{display:block!important;width:52px!important;height:52px!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}
      #ed-body .dm-beta26-appliance-image{display:grid!important;place-items:center!important;overflow:hidden!important;border-radius:10px!important}
      #ed-body .dm-beta26-appliance-image img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}
      #ed-body #dm-temperature-room[data-dm-beta26-room-reuse="true"] option{opacity:1!important;color:var(--text,#0f172a)!important}
      @media(max-width:640px){#ed-body .dm-beta26-load-name-icon-row{align-items:stretch!important}#ed-body .dm-beta26-load-icon-picker{flex-basis:52px!important;width:52px!important;height:52px!important}}
    `,
  );
}

export function installBeta25Compatibility() {
  if (!doc) return false;
  installEditorStyles();
  bindRuntimeOwners();
  wrapApplianceStoreWrites();
  subscribeStore();
  protectLegacyCustomImages();
  schedule(restoreEditorVisualContracts);
  schedule(repairExplicitCatalogArtwork);
  if (!state.listeners) {
    state.listeners = true;
    for (const name of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:temperature-editor-rendered",
    ])
      root.addEventListener?.(name, () => {
        bindRuntimeOwners();
        wrapApplianceStoreWrites();
        subscribeStore();
        protectLegacyCustomImages();
        schedule(restoreEditorVisualContracts);
        schedule(repairExplicitCatalogArtwork);
      });
    root.addEventListener?.("dashboardmodern:state-changed", () =>
      schedule(repairExplicitCatalogArtwork),
    );

    // Capture before Android/iOS opens its native select UI. A late legacy
    // refresh is allowed to run, but it can no longer make configured rooms
    // unavailable to the multi-association editor.
    for (const type of ["pointerdown", "touchstart", "mousedown", "focusin"])
      doc.addEventListener(
        type,
        (event) => {
          const select = event.target?.closest?.("#dm-temperature-room");
          if (select) enableTemperatureRoomOptions(select);
        },
        true,
      );

    doc.addEventListener(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            "[data-beta25-temperature-edit],[data-beta25-temperature-cancel],.ed-tab[data-tab='sez7'],[data-tab='temperature'],[data-tab='temp']",
          )
        )
          schedule(restoreTemperatureContracts);
        if (event.target?.closest?.("#page-appliances-main,.appl-section-tab"))
          schedule(repairExplicitCatalogArtwork);
        if (
          event.target?.closest?.(
            "#editor-modal,.ed-tab,[data-edit-load],#appl-icon-btn",
          )
        )
          schedule(restoreEditorVisualContracts);
      },
      true,
    );
    doc.addEventListener("submit", (event) => {
      if (event.target?.matches?.("[data-beta25-temperature-form]"))
        schedule(restoreTemperatureContracts);
    });
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installBeta25Compatibility, { once: true });
else installBeta25Compatibility();

export const beta25Compatibility = Object.freeze({
  restoreTemperatureContracts,
  enableTemperatureRoomOptions,
  protectLegacyCustomImages,
  repairExplicitCatalogArtwork,
  ensureLoadIconPicker,
  applianceEditorVisualMarkup,
  syncApplianceEditorVisuals,
});
