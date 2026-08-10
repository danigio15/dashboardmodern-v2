/* v1 beta UI entrypoint. Imported by generated build-info so legacy and hosted dashboards share it. */
import "./config-persistence-section.js";
import "./beta-compat-section.js";
import "./entity-picker-guard-section.js";
import "./energy-report-polish-section.js";
import "./personalization-section.js";
import "./editor-polish-section.js";
import "./beta4-mobile-polish-section.js";

// First insert keeps the new direct icon trigger, but delegates the actual
// catalog to the mature multilingual picker already used by the legacy editor.
// Capture phase prevents the superseded beta picker from opening as a second
// modal without reintroducing a visible palette button.
if (typeof document !== "undefined") {
  const marker = "__DASHBOARDMODERN_BETA5_ENTRY_BRIDGE__";
  if (!globalThis[marker]) {
    globalThis[marker] = true;
    document.addEventListener(
      "click",
      (event) => {
        const trigger = event.target?.closest?.(".dm-beta5-room-icon-trigger");
        if (!trigger || typeof globalThis.dmIconPicker !== "function") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        globalThis.dmIconPicker("#ed-room-icon", "rooms");
      },
      true,
    );

    // The canonical period renderer may mark a secondary load as unmapped and
    // hide its SVG connector inline. Keep the topology complete: a load with no
    // current sample is still represented and its value remains zero/blank.
    const style = document.createElement("style");
    style.id = "dm-beta5-complete-flow-links";
    style.textContent = ["day", "month"]
      .flatMap((period) => ["boiler", "wb", "clima", "lav", "cuc"].map((load) => `#line-home-${load}-${period}`))
      .map((selector) => `${selector}{display:block!important}`)
      .join("");
    document.head?.append(style);
  }
}
