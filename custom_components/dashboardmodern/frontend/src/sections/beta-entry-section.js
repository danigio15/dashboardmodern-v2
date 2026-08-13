/* v1 beta UI entrypoint. Imported by generated build-info so legacy and hosted dashboards share it. */
import "./config-persistence-section.js";
import "./icon-engine-section.js";
import "./beta-compat-section.js";
import "./entity-picker-guard-section.js";
import "./energy-report-polish-section.js";
import "./personalization-section.js";
import "./editor-polish-section.js";
import "./beta4-mobile-polish-section.js";
import "./beta6-feedback-section.js";
import "./beta7-brand-guard-section.js";
import "./beta7-regression-section.js";
import "./beta9-real-device-polish-section.js";

// Keep only compatibility/layout bridges that belong at the entrypoint. The
// beta7 guards run after the mature beta6 editor owner; the guard is installed
// first so a broken remote logo keeps its DOM contract while the final beta7
// polish owns the visible mobile regression layout. The beta9 real-device pass
// is intentionally last: it reconciles only conflicts reproduced in the real
// Home Assistant WebView and does not introduce polling or global observers.
if (typeof document !== "undefined") {
  const marker = "__DASHBOARDMODERN_BETA5_ENTRY_BRIDGE__";
  if (!globalThis[marker]) {
    globalThis[marker] = true;
    // Room/action picker activation is owned by icon-engine-section at window capture.

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
    // Shutter layout is also pinned here because this entrypoint style is mounted
    // after all imported section styles. The rules deliberately match fresh
    // legacy shutter DOM too, so a render race cannot briefly restore the old
    // 178/190px window or its page/lamella pulse before beta9 decorates nodes.
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
      html body #page-tapparelle#page-tapparelle.page{
        animation:none!important;
        transform:none!important;
        opacity:1!important;
      }
      html body #page-tapparelle#page-tapparelle #tapp-grid{
        grid-template-columns:repeat(auto-fit,minmax(280px,360px))!important;
        justify-content:center!important;
        align-items:start!important;
        gap:14px!important;
      }
      html body #page-tapparelle#page-tapparelle .tapp-card{
        box-sizing:border-box!important;
        width:100%!important;
        max-width:360px!important;
        min-height:0!important;
        animation:none!important;
        transform:none!important;
      }
      html body #page-tapparelle#page-tapparelle .tapp-win{
        box-sizing:border-box!important;
        height:132px!important;
        min-height:132px!important;
        max-height:132px!important;
        margin:0!important;
        animation:none!important;
        transition:none!important;
        transform:none!important;
      }
      html body #page-tapparelle#page-tapparelle .tapp-shutter{
        animation:none!important;
        filter:none!important;
        transition:height .55s cubic-bezier(.2,.8,.2,1)!important;
      }
      html body #page-tapparelle#page-tapparelle .tapp-shutter i{
        animation:none!important;
        filter:none!important;
        transform:none!important;
      }
      @media(hover:none){
        .dm-visual-trigger:hover,.dm-icon-preview-button:hover,.dm-picker-option:hover{transform:none!important}
      }
    `;
    document.head?.append(evBrandStyle);

    // Personalization creates the EV appearance card only after the legacy EV
    // editor has rendered. On WebKit that first render can land after beta9's
    // own reconciliation frame, leaving Brand/Model below the long entity list
    // or leaving the freshly-created selects before beta9's direct bindings.
    // Reconcile position on the following frame and, when bindings are still
    // absent, issue one ordinary scoped state tick so beta9 runs its existing
    // bindEvAppearance owner. No observer or permanent polling is introduced.
    const repairEvAppearanceTop = () => {
      const body = document.getElementById("ed-body");
      if (!body) return;
      const activeTab = String(document.querySelector(".ed-tab.active")?.dataset?.tab || "");
      if (activeTab !== "sez2") return;
      const panel = body.querySelector("[data-ev-appearance]");
      if (!panel) return;
      if (body.firstElementChild !== panel) body.prepend(panel);
      panel.dataset.dmEvTop = "true";

      const brandSelect = panel.querySelector("select[data-brand]");
      if (brandSelect && brandSelect.dataset.dmRealDeviceBound !== "true") {
        globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: "sensor.dashboardmodern_ev_appearance_sync" },
        }));
      }
    };
    const scheduleEvAppearanceTopRepair = () => {
      const secondFrame = () => {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(repairEvAppearanceTop);
        else setTimeout(repairEvAppearanceTop, 0);
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(secondFrame);
      else setTimeout(secondFrame, 0);
      setTimeout(repairEvAppearanceTop, 70);
    };
    const installEvAppearanceTopOwner = () => {
      const current = globalThis.editorSwitch;
      if (typeof current !== "function" || current.__dmBeta9EvTopRepair) return;
      const wrapped = function (...args) {
        const result = current.apply(this, args);
        if (result && typeof result.finally === "function") result.finally(scheduleEvAppearanceTopRepair);
        else scheduleEvAppearanceTopRepair();
        return result;
      };
      wrapped.__dmBeta9EvTopRepair = true;
      wrapped.__dmWrappedOriginal = current;
      globalThis.editorSwitch = wrapped;
    };

    // Quick Action icon rendering is now owned synchronously by icon-engine-section.
    // No delayed 0/90/320/900 ms repaint is permitted in the public runtime.

    // The legacy Temperature edit handler creates a correctly populated room
    // select and then disables it. The beta9 reconciler runs when the tab opens,
    // but that happens before the edit form exists. Re-enable the select after
    // the actual Edit click, without polling or observing the whole document.
    const repairTemperatureRoomSelect = () => {
      const form = document.querySelector("#editor-modal [data-temperature-form]");
      const select = form?.querySelector("#dm-temperature-room");
      const title = String(form?.querySelector("[data-temperature-form-title]")?.textContent || "").trim();
      if (!select || !/^(modifica|edit)\b/i.test(title)) return;
      select.disabled = false;
      select.removeAttribute("disabled");
      select.removeAttribute("aria-disabled");
      select.tabIndex = 0;
      select.dataset.dmTemperatureRoomEditable = "true";
      select.dataset.dmRealDeviceEditable = "true";
      select.style.setProperty("pointer-events", "auto", "important");
      select.style.setProperty("opacity", "1", "important");
      select.style.setProperty("cursor", "pointer", "important");
    };
    const scheduleTemperatureRoomRepair = () => {
      requestAnimationFrame?.(repairTemperatureRoomSelect);
      setTimeout(repairTemperatureRoomSelect, 0);
      setTimeout(repairTemperatureRoomSelect, 90);
    };
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-temperature-edit]")) scheduleTemperatureRoomRepair();
    }, true);

    installEvAppearanceTopOwner();
    scheduleEvAppearanceTopRepair();
    installQuickActionRepairOwner();
    scheduleV01525QuickActionRepair();
  }
}
