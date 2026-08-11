/* v1 beta UI entrypoint. Imported by generated build-info so legacy and hosted dashboards share it. */
import "./config-persistence-section.js";
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

    // v0.15.25 Quick Actions used readable colour emoji/glyphs. The beta9
    // catalog normalizer intentionally strips non-ASCII characters, so a
    // persisted emoji can otherwise compare as an empty token and resolve to
    // the first catalog item (Home). Reconcile from the canonical MDI token
    // already attached to each rendered icon. This is finite/event-driven and
    // deliberately runs after the beta9 renderer instead of adding polling.
    const actionGlyphs = Object.freeze({
      "mdi:home": "🏠",
      "mdi:lightbulb": "💡",
      "mdi:lightbulb-group": "💡",
      "mdi:snowflake": "❄️",
      "mdi:radiator": "🔥",
      "mdi:shield-home": "🛡️",
      "mdi:gate": "🚪",
      "mdi:window-shutter": "🪟",
      "mdi:movie-open": "🎬",
      "mdi:script-text-play": "▶️",
      "mdi:toggle-switch-outline": "🔀",
      "mdi:washing-machine": "🧺",
      "mdi:flash": "⚡",
      "mdi:car-electric": "🚗",
      "mdi:water-boiler": "♨️",
      "mdi:water": "💧",
      "mdi:cctv": "📷",
      "mdi:bell": "🔔",
      "mdi:star": "⭐",
    });
    const repairV01525QuickActionGlyphs = () => {
      document.querySelectorAll("#qa-grid .qa-btn .icon").forEach((icon) => {
        const raw = String(icon.dataset.dmBeta7IconToken || "");
        const [mdiToken, persistedGlyph] = raw.split("|");
        const glyph = actionGlyphs[mdiToken] || (persistedGlyph && !persistedGlyph.startsWith("mdi:") ? persistedGlyph : "");
        const target = icon.querySelector(".dm-v01525-action-glyph");
        if (target && glyph) target.textContent = glyph;
      });
    };
    const scheduleV01525QuickActionRepair = () => {
      requestAnimationFrame?.(repairV01525QuickActionGlyphs);
      setTimeout(repairV01525QuickActionGlyphs, 0);
      setTimeout(repairV01525QuickActionGlyphs, 90);
    };
    const installQuickActionRepairOwner = () => {
      const current = globalThis.buildQuickActions;
      if (typeof current !== "function" || current.__dmV01525GlyphRepair) return;
      const wrapped = function (...args) {
        const result = current.apply(this, args);
        scheduleV01525QuickActionRepair();
        return result;
      };
      wrapped.__dmV01525GlyphRepair = true;
      wrapped.__dmWrappedOriginal = current;
      globalThis.buildQuickActions = wrapped;
    };
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
    ]) globalThis.addEventListener?.(eventName, () => {
      installQuickActionRepairOwner();
      scheduleV01525QuickActionRepair();
    });
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("#dm-action-editor-modal,#dm-beta9-action-picker,.dm-beta6-qa-icon-trigger"))
        scheduleV01525QuickActionRepair();
    }, true);
    installQuickActionRepairOwner();
    scheduleV01525QuickActionRepair();
  }
}