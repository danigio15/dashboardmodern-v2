// Beta 26 real-device editor fixes: late temperature ownership, load icon picker,
// and appliance artwork parity between dashboard and configuration.
import { applianceArtwork } from "../core/appliance-artwork.js";
import { preferredApplianceVisual } from "./beta25-real-device-fixes-section.js";
import {
  clean,
  dashboardStore,
  doc,
  english,
  esc,
  installStyle,
  root,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA26_REAL_DEVICE_EDITOR_FIXES__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  storeUnsubscribe: null,
  wrappers: false,
});

function applianceList() {
  const values = dashboardStore()?.getSection?.("appliances");
  return Array.isArray(values) ? values : [];
}

/**
 * A configured room is a valid target for a second Beta25 temperature
 * association. Legacy mountTemperatureEditor can restore disabled attributes
 * after the Beta25 body has already rendered; remove those attributes again,
 * including immediately before a native mobile select opens.
 */
export function enableTemperatureRoomOptions(
  select = doc?.getElementById?.("dm-temperature-room"),
) {
  if (!select) return false;
  const form = select.closest?.("[data-beta25-temperature-form],[data-temperature-form]");
  const beta25 = Boolean(form?.matches?.("[data-beta25-temperature-form]"));
  if (!beta25) return false;

  select.disabled = false;
  select.removeAttribute("disabled");
  select.removeAttribute("aria-disabled");
  select.tabIndex = 0;
  select.style.setProperty("pointer-events", "auto", "important");
  select.style.setProperty("opacity", "1", "important");
  select.style.setProperty("cursor", "pointer", "important");
  for (const option of select.options || []) {
    option.disabled = false;
    option.removeAttribute("disabled");
    option.removeAttribute("aria-disabled");
  }
  select.dataset.dmBeta26RoomReuse = "true";
  return true;
}

function iconPreviewMarkup(token, size = 27) {
  return (
    root.DashboardModernIconEngine?.markup?.("action", clean(token) || "mdi:power-plug", {
      size,
    }) || "🎨"
  );
}

/** Add the canonical searchable icon picker to the existing Loads form. */
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
    button.setAttribute(
      "aria-label",
      english() ? "Choose load icon" : "Scegli icona carico",
    );
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

/** Return the exact visual used by the dashboard for an appliance editor preview. */
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
  const list = applianceList();
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

/** Keep appliance list rows and the edit/add preview on the same canonical art as cards. */
export function syncApplianceEditorVisuals() {
  const button = doc?.getElementById?.("appl-icon-btn");
  if (!button) return false;
  const body = button.closest?.("#ed-body") || doc.getElementById?.("ed-body");
  const list = applianceList();
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

function applyEditorFixes() {
  enableTemperatureRoomOptions();
  ensureLoadIconPicker();
  syncApplianceEditorVisuals();
}

function scheduleEditorFixes() {
  root.queueMicrotask?.(applyEditorFixes);
  root.requestAnimationFrame?.(applyEditorFixes);
  root.setTimeout?.(applyEditorFixes, 0);
  root.setTimeout?.(applyEditorFixes, 120);
  root.setTimeout?.(applyEditorFixes, 280);
}

function wrapAfter(name) {
  const current = root[name];
  const marker = `__dmBeta26Editor_${name}`;
  if (typeof current !== "function" || current[marker]) return false;
  const wrapped = function (...args) {
    const result = current.apply(this, args);
    if (result && typeof result.finally === "function") result.finally(scheduleEditorFixes);
    else scheduleEditorFixes();
    return result;
  };
  Object.assign(wrapped, current);
  wrapped[marker] = true;
  wrapped.__dmPrevious = current;
  root[name] = wrapped;
  return true;
}

function installWrappers() {
  for (const name of ["editorSwitch", "edApplEdit", "dmApplianceChoose"]) wrapAfter(name);
  state.wrappers = true;
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (!store?.subscribe) return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (["rooms", "loads", "appliances", "snapshot"].includes(change?.section))
      scheduleEditorFixes();
  });
}

function installStyles() {
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

export function installBeta26RealDeviceEditorFixes() {
  if (!doc) return false;
  installStyles();
  installWrappers();
  subscribeStore();
  scheduleEditorFixes();
  if (!state.listeners) {
    state.listeners = true;
    for (const name of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:temperature-editor-rendered",
    ])
      root.addEventListener?.(name, () => {
        installWrappers();
        subscribeStore();
        scheduleEditorFixes();
      });

    // Capture before the browser opens Android/iOS native <select> UI. This is
    // intentionally scoped to the Beta25 temperature room selector.
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
            "#editor-modal,.ed-tab,[data-edit-load],[data-beta25-temperature-edit],[data-beta25-temperature-cancel],#appl-icon-btn",
          )
        )
          scheduleEditorFixes();
      },
      true,
    );
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installBeta26RealDeviceEditorFixes, { once: true });
else installBeta26RealDeviceEditorFixes();

export const beta26RealDeviceEditorFixes = Object.freeze({
  enableTemperatureRoomOptions,
  ensureLoadIconPicker,
  applianceEditorVisualMarkup,
  syncApplianceEditorVisuals,
  sync: scheduleEditorFixes,
});
