/* v1 beta UI entrypoint. Imported by generated build-info so legacy and hosted dashboards share it. */
import "./config-persistence-section.js";
import "./beta-compat-section.js";
import "./entity-picker-guard-section.js";
import "./energy-report-polish-section.js";
import "./personalization-section.js";
import "./editor-polish-section.js";
import "./beta4-mobile-polish-section.js";
import "./beta6-feedback-section.js";
import "./beta7-regression-section.js";

// Keep only compatibility/layout bridges that belong at the entrypoint. The
// beta7 hardening module is the final visible fallback for WebView-only UI
// regressions; it runs after the mature beta6 editor/quick-action owner.
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
      .flatMap((period) =>
        ["boiler", "wb", "clima", "lav", "cuc"].map(
          (load) => `#line-home-${load}-${period}`,
        ),
      )
      .map((selector) => `${selector}{display:block!important}`)
      .join("");
    document.head?.append(style);

    // EV config: the real manufacturer mark belongs above the brand label. The
    // old horizontal box let wide wordmarks overflow beneath the text on phones.
    const evBrandStyle = document.createElement("style");
    evBrandStyle.id = "dm-beta7-ev-brand-layout";
    evBrandStyle.textContent = `
      .dm-ev-appearance-grid .dm-brand-preview{
        display:flex!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
        gap:5px!important;
        min-height:82px!important;
        padding:10px 12px!important;
        overflow:hidden!important;
      }
      .dm-ev-appearance-grid .dm-brand-preview .dm-car-brand{
        order:-1!important;
        display:grid!important;
        place-items:center start!important;
        width:min(132px,100%)!important;
        max-width:132px!important;
        height:34px!important;
        margin:0!important;
      }
      .dm-ev-appearance-grid .dm-brand-preview .dm-car-brand img{
        display:block!important;
        width:100%!important;
        height:100%!important;
        object-fit:contain!important;
        object-position:left center!important;
      }
      .dm-ev-appearance-grid .dm-brand-preview b{display:block!important;line-height:1.1!important}
      @media(hover:none){
        .dm-visual-trigger:hover,.dm-icon-preview-button:hover,.dm-picker-option:hover{transform:none!important}
      }
    `;
    document.head?.append(evBrandStyle);
  }
}
