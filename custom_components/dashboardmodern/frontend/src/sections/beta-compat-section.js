import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA_COMPAT__";
const state = (root[KEY] ||= { installed: false });

function install() {
  if (!doc || state.installed) return;
  state.installed = true;

  // The legacy KPI updater still reads this historical global flag. The value
  // is false because v1 beta no longer fabricates/estimates Overview history.
  // Defining the global keeps the old updater safe until it is fully retired.
  if (typeof root.consStimato === "undefined") root.consStimato = false;

  // Keep the shipped icon picker contract for canonical Rooms/Temperature.
  // Personalization adds a richer picker inside the room edit modal, but must
  // never replace the existing #dm-icon-grid selector used by add/config flows.
  // Register first (beta-entry imports this before personalization) so this
  // capture handler wins deterministically.
  doc.addEventListener("click", (event) => {
    const button = event.target?.closest?.(
      '.dm-icon-picker[data-icon-category="rooms"],.dm-icon-picker[data-dm-room-catalog="true"],button[onclick*="dmIconPicker"][onclick*="rooms"]',
    );
    if (!button) return;
    const targetId = button.dataset.iconTarget || button.closest(".dm-icon-field")?.querySelector("input")?.id;
    if (!targetId || typeof root.dmIconPicker !== "function") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    root.dmIconPicker(`#${targetId}`, "rooms");
  }, true);
}

install();
