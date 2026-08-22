import { ACTIVE_CAR_KEY, carKey, resolveActiveIndex } from "../core/vehicle-identity.js";
import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA_COMPAT__";
const state = (root[KEY] ||= { installed: false });

const ROOM_PICKER = Object.freeze([
  ["🏠", "casa home ingresso entrance"],
  ["🛏️", "camera bedroom letto bed matrimoniale"],
  ["🛋️", "salone soggiorno living lounge sofa"],
  ["🍳", "cucina kitchen cook stove"],
  ["🛁", "bagno bathroom bath doccia shower"],
  ["💻", "studio office ufficio smartworking"],
  ["🚗", "garage box auto car"],
  ["🌇", "balcone terrazza balcony terrace"],
  ["🧺", "lavanderia laundry washing"],
  ["🧸", "cameretta bambini kids child nursery"],
  ["🍽️", "sala pranzo dining table"],
  ["🚪", "corridoio disimpegno hallway corridor"],
  ["👗", "cabina armadio guardaroba wardrobe closet"],
  ["📦", "ripostiglio dispensa storage pantry"],
  ["🍷", "cantina cellar wine"],
  ["🏡", "mansarda soffitta attic loft"],
  ["🌳", "giardino garden yard"],
  ["🏊", "piscina pool"],
  ["🛠️", "locale tecnico utility tools server"],
]);

function closeCanonicalRoomPicker() {
  doc.getElementById("dm-icon-picker")?.remove();
}

function openCanonicalRoomPicker(input) {
  return Boolean(
    root.DashboardModernIconEngine?.openPicker?.(input, "room", { autofocus: false }),
  );
}

function activeVehicleSignature() {
  let cars = [];
  try {
    const legacy = JSON.parse(root.localStorage?.getItem("cd_ev_cars") || "[]");
    if (Array.isArray(legacy) && legacy.length) cars = legacy;
  } catch (_error) {}
  if (!cars.length) {
    try {
      const canonical = root.DashboardModernModules?.store?.getSection?.("ev");
      if (Array.isArray(canonical)) cars = canonical;
    } catch (_error) {}
  }
  if (!cars.length) return "";
  const raw = Number.parseInt(root.localStorage?.getItem("cd_ev_car_active") || "0", 10);
  const index = resolveActiveIndex(cars, root.localStorage?.getItem(ACTIVE_CAR_KEY) || "", raw);
  const car = cars[index] || {};
  const brand = String(car.brand || "").trim();
  const model = String(car.model || car.vehicle_model || car.name || "").trim();
  // La chiave dell'auto viene per prima: e' l'unica parte della firma che non
  // cambia quando l'elenco si accorcia o si riordina.
  const identity = String(carKey(car) || car.id || car.entity || car.name || index).trim();
  return `${index}|${identity}|${brand}|${model}`;
}

function preserveManualEvAppearanceEdit(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.matches('#editor-modal [data-ev-appearance] select[data-brand],#editor-modal [data-ev-appearance] select[data-model]')) return;
  const panel = target.closest("[data-ev-appearance]");
  const signature = activeVehicleSignature();
  if (!panel || !signature) return;
  // Mark the current active vehicle as already synchronized before Beta11's
  // document-level change reconciler runs. This protects a user's unsaved
  // Brand/Model choice, while a later cd_ev_car_active change still produces a
  // different signature and therefore triggers the intended active-car sync.
  panel.dataset.dmBeta11VehicleSignature = signature;
  panel.dataset.dmBeta11ManualEdit = "true";
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;

  // The legacy KPI updater still reads this historical global flag. v1 beta
  // does not fabricate estimated Overview history, so the safe value is false.
  if (typeof root.consStimato === "undefined") root.consStimato = false;

  // Run before Beta11's later document-level change reconciler. The handler does
  // not stop propagation: beta9/personalization still rebuild dependent model
  // options and preview artwork normally.
  doc.addEventListener("input", preserveManualEvAppearanceEdit, true);
  doc.addEventListener("change", preserveManualEvAppearanceEdit, true);

  // Preserve the long-standing Rooms/Temperature picker contract while the
  // richer SVG catalog is used by the dedicated room edit modal.
  doc.addEventListener("click", (event) => {
    const button = event.target?.closest?.(
      '.dm-icon-picker[data-icon-category="rooms"],.dm-icon-picker[data-dm-room-catalog="true"],button[title="Selettore icone"],button[title="Icon picker"],button[onclick*="dmIconPicker"]',
    );
    if (!button) return;
    const targetId = button.dataset.iconTarget || button.closest(".dm-icon-field")?.querySelector("input")?.id || button.previousElementSibling?.id;
    const input = targetId ? doc.getElementById(targetId) : button.previousElementSibling;
    if (!(input instanceof HTMLInputElement)) return;
    // Alerts have their own semantic Beta11 catalog. Do not let the historical
    // broad "id contains icon" heuristic steal #ed-avv-icon as a room picker.
    if (input.id === "ed-avv-icon" || button.classList.contains("dm-beta5-alert-icon-trigger") || button.dataset.iconCategory === "alerts") return;
    const category = button.dataset.iconCategory || input.dataset.iconCategory || "";
    const looksLikeRoom = category === "rooms" || /room|stanza|icon/i.test(input.id || "") || button.title === "Selettore icone" || button.title === "Icon picker";
    if (!looksLikeRoom) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openCanonicalRoomPicker(input);
  }, true);

  const style = doc.createElement("style");
  style.id = "dm-beta-room-picker-style";
  style.textContent = `
    .dm-beta-room-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:10px;padding:12px 18px 20px;max-height:55vh;overflow:auto}
    .dm-beta-room-grid button{min-height:62px;border:1px solid var(--divider-color,#dbe4ee);border-radius:15px;background:var(--card-background-color,#fff);font-size:28px;cursor:pointer}
    .dm-beta-room-grid button:hover{border-color:var(--primary-color,#0ea5e9);transform:translateY(-1px)}
    .dm-beta-room-grid button[hidden]{display:none!important}
    /* Brand e modello used to be pinned to the top of the tab from here, for
       the days when it could land anywhere. It now has one home — inside the
       vehicle accordion — so a rule that yanked it to the top whenever it
       happened to be a direct child only made the tab flicker between two
       layouts. */

    /* Beta11 geometry contracts must outrank historical beta4/beta9 visual
       normalizers even if those modules repaint the mark/room row later. */
    html body #editor-modal #ed-body [data-ev-appearance] [data-brand-preview].dm-brand-preview[data-dm-beta11-ev-preview="true"] > .dm-car-brand{
      box-sizing:border-box!important;width:108px!important;max-width:108px!important;min-width:0!important;height:48px!important;max-height:48px!important;min-height:0!important;overflow:hidden!important;transform:none!important
    }
    html body #editor-modal #ed-body [data-ev-appearance] [data-brand-preview].dm-brand-preview[data-dm-beta11-ev-preview="true"] > .dm-car-brand .dm-beta5-brand-logo,
    html body #editor-modal #ed-body [data-ev-appearance] [data-brand-preview].dm-brand-preview[data-dm-beta11-ev-preview="true"] > .dm-car-brand [data-brand-logo]{
      box-sizing:border-box!important;display:grid!important;place-items:center!important;width:100%!important;max-width:100%!important;min-width:0!important;height:100%!important;max-height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;transform:none!important
    }
    html body #editor-modal #ed-body [data-ev-appearance] [data-brand-preview].dm-brand-preview[data-dm-beta11-ev-preview="true"] > .dm-car-brand svg,
    html body #editor-modal #ed-body [data-ev-appearance] [data-brand-preview].dm-brand-preview[data-dm-beta11-ev-preview="true"] > .dm-car-brand img{
      box-sizing:border-box!important;display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;height:100%!important;max-height:100%!important;min-height:0!important;margin:0!important;padding:0!important;object-fit:contain!important;object-position:center!important;overflow:hidden!important;transform:none!important
    }
    html body #editor-modal #ed-body .ed-row.dm-room-config-row.dm-beta11-room-row{
      grid-template-columns:58px minmax(0,1fr) 48px 48px!important
    }
    html body #editor-modal #ed-body .ed-row.dm-room-config-row.dm-beta11-room-row > .dm-room-list-icon{
      box-sizing:border-box!important;width:56px!important;max-width:56px!important;min-width:56px!important;height:56px!important;max-height:56px!important;min-height:56px!important;overflow:hidden!important
    }
    html body #editor-modal #ed-body .ed-row.dm-room-config-row.dm-beta11-room-row > .dm-room-list-icon svg,
    html body #editor-modal #ed-body .ed-row.dm-room-config-row.dm-beta11-room-row > .dm-room-list-icon ha-icon{
      display:block!important;width:38px!important;max-width:38px!important;height:38px!important;max-height:38px!important;transform:none!important
    }
    @media(max-width:560px){
      html body #editor-modal #ed-body [data-ev-appearance] [data-brand-preview].dm-brand-preview[data-dm-beta11-ev-preview="true"] > .dm-car-brand{width:88px!important;max-width:88px!important;height:44px!important;max-height:44px!important}
      html body #editor-modal #ed-body .ed-row.dm-room-config-row.dm-beta11-room-row{grid-template-columns:58px minmax(0,1fr) 46px 46px!important}
    }
  `;
  doc.head?.append(style);
}

install();