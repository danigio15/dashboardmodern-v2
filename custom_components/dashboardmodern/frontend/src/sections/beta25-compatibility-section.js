// Beta 25 compatibility owner: keep the new real-device fixes while preserving
// the stable DOM/runtime contracts used by the existing dashboard renderers.
import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import { clean, dashboardStore, doc, english, root, section, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA25_COMPATIBILITY__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  storeUnsubscribe: null,
});

function appliances() {
  const value = section("appliances", []);
  return Array.isArray(value) ? value : [];
}

function schedule(callback) {
  root.queueMicrotask?.(callback);
  root.setTimeout?.(callback, 0);
  root.setTimeout?.(callback, 60);
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
  const submit = form.querySelector("[data-beta25-temperature-submit]");
  const cancel = form.querySelector("[data-beta25-temperature-cancel]");
  submit?.setAttribute("data-temperature-submit", "");
  cancel?.setAttribute("data-temperature-cancel", "");
  const editing = Boolean(cancel && !cancel.hidden);
  form.dataset.dmTemperatureMode = editing ? "edit" : "add";
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

/**
 * Old configurations can legitimately have a custom image and no explicit
 * visual_key. Device normalization may infer visual_type=asset from device_type;
 * mark those entries as image before the Beta25 stale-image cleanup runs.
 */
export function protectLegacyCustomImages() {
  const store = dashboardStore();
  const list = store?.state?.sections?.appliances;
  if (!Array.isArray(list)) return false;
  let changed = false;
  for (const device of list) {
    const image = clean(device?.image || device?.image_url);
    const explicitKey = clean(device?.visual_key);
    if (!image || explicitKey || clean(device?.visual_type).toLowerCase() === "image") continue;
    device.visual_type = "image";
    changed = true;
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
      if (!current || current.dataset.dmArt !== artwork) media.innerHTML = applianceArtwork(artwork, 96);
      card.dataset.dmArtwork = artwork;
      card.dataset.dmMediaKind = "asset";
      repaired = true;
    });
  return repaired;
}

function reconcileAppliances() {
  protectLegacyCustomImages();
  repairExplicitCatalogArtwork();
}

function bindRuntimeOwners() {
  for (const name of ["buildTempCards", "renderTemperature"])
    wrapFunction(name, "__dmBeta25CompatTemperature", restoreTemperatureContracts);
  for (const name of ["renderAppliances", "renderApplianceSection"])
    wrapFunction(name, "__dmBeta25CompatAppliances", reconcileAppliances);
}

function subscribeStore() {
  const store = dashboardStore();
  if (state.storeUnsubscribe || !store?.subscribe) return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.section === "appliances" || change?.section === "snapshot") {
      // This runs synchronously while Beta25's stale-image repair is queued as a
      // microtask, so valid legacy custom images are protected first.
      protectLegacyCustomImages();
      schedule(repairExplicitCatalogArtwork);
    }
    if (change?.section === "rooms" || change?.section === "snapshot")
      schedule(restoreTemperatureContracts);
  });
}

export function installBeta25Compatibility() {
  if (!doc) return false;
  bindRuntimeOwners();
  subscribeStore();
  protectLegacyCustomImages();
  schedule(restoreTemperatureContracts);
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
        subscribeStore();
        protectLegacyCustomImages();
        schedule(restoreTemperatureContracts);
        schedule(repairExplicitCatalogArtwork);
      });
    doc.addEventListener("click", (event) => {
      if (
        event.target?.closest?.(
          "[data-beta25-temperature-edit],[data-beta25-temperature-cancel],.ed-tab[data-tab='sez7'],[data-tab='temperature'],[data-tab='temp']",
        )
      )
        schedule(restoreTemperatureContracts);
      if (event.target?.closest?.("#page-appliances-main,.appl-section-tab"))
        schedule(repairExplicitCatalogArtwork);
    });
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
  protectLegacyCustomImages,
  repairExplicitCatalogArtwork,
});
