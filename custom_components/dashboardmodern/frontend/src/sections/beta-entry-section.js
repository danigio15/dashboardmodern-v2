/* v1 beta UI entrypoint. Imported by generated build-info so legacy and hosted dashboards share it. */
import "./config-persistence-section.js";
import "./beta-compat-section.js";
import "./entity-picker-guard-section.js";
import "./energy-report-polish-section.js";
import "./personalization-section.js";
import "./editor-polish-section.js";
import "./beta4-mobile-polish-section.js";

// The first-insert Rooms control is now the icon itself, not a separate palette.
// Keep the mature searchable room catalog behind that direct trigger so the
// existing multilingual icon set and search semantics remain unchanged.
if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const trigger = event.target?.closest?.(".dm-beta4-room-icon-trigger");
      if (!trigger || typeof globalThis.dmIconPicker !== "function") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      globalThis.dmIconPicker("#ed-room-icon", "rooms");
    },
    true,
  );
}
