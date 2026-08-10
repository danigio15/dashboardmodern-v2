/* v1 beta UI entrypoint. Imported by generated build-info so legacy and hosted dashboards share it. */
import "./config-persistence-section.js";
import "./beta-compat-section.js";
import "./entity-picker-guard-section.js";
import "./energy-report-polish-section.js";
import "./personalization-section.js";
import "./editor-polish-section.js";
import "./beta4-mobile-polish-section.js";
import "./beta6-feedback-section.js";

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
      .flatMap((period) =>
        ["boiler", "wb", "clima", "lav", "cuc"].map(
          (load) => `#line-home-${load}-${period}`,
        ),
      )
      .map((selector) => `${selector}{display:block!important}`)
      .join("");
    document.head?.append(style);

    // The legacy form class is ed-form-row (not ed-qa-form-row). Lock the
    // quick-action editor to three clean columns so the icon selector keeps a
    // compact square footprint on phone screens instead of stretching the row.
    const quickActionStyle = document.createElement("style");
    quickActionStyle.id = "dm-beta6-quick-action-layout";
    quickActionStyle.textContent = `
      .ed-form-row[data-dm-beta6-quick-action="true"]{
        display:grid!important;
        grid-template-columns:minmax(0,1.15fr) 64px minmax(0,1fr)!important;
        align-items:stretch!important;
        gap:8px!important;
      }
      .ed-form-row[data-dm-beta6-quick-action="true"] #ed-qa-type,
      .ed-form-row[data-dm-beta6-quick-action="true"] #ed-qa-name{
        width:100%!important;
        min-width:0!important;
        margin:0!important;
      }
      .ed-form-row[data-dm-beta6-quick-action="true"] .dm-beta6-qa-icon-trigger{
        width:64px!important;
        min-width:64px!important;
        max-width:64px!important;
      }
    `;
    document.head?.append(quickActionStyle);

    // Legacy quick actions persist their icon as text and inject that value
    // directly into the Home card. The beta6 picker renders MDI artwork, so
    // convert its selected MDI token to the corresponding portable glyph before
    // legacy save code runs, then render the saved glyph back as a HA icon in
    // both the editor preview and the Home card. This avoids storing literal
    // "mdi:..." strings while removing the generic flash fallback.
    const quickActionGlyphByType = Object.freeze({
      luci_group: "💡",
      builtin_luci: "💡",
      builtin_clima: "❄️",
      builtin_antifurto: "🛡️",
      builtin_lavatrice: "🧺",
      toggle: "🔀",
      script: "▶️",
      scene: "🎬",
    });
    const quickActionMdiByType = Object.freeze({
      luci_group: "mdi:lightbulb-group",
      builtin_luci: "mdi:lightbulb-group",
      builtin_clima: "mdi:snowflake",
      builtin_antifurto: "mdi:shield-home",
      builtin_lavatrice: "mdi:washing-machine",
      toggle: "mdi:toggle-switch-outline",
      script: "mdi:script-text-play",
      scene: "mdi:movie-open",
    });
    const quickActionGlyphByMdi = Object.freeze({
      "mdi:home": "🏠",
      "mdi:lightbulb": "💡",
      "mdi:lightbulb-group": "💡",
      "mdi:snowflake": "❄️",
      "mdi:radiator": "🔥",
      "mdi:shield-home": "🛡️",
      "mdi:gate": "🚪",
      "mdi:window-shutter": "🪟",
      "mdi:movie-open": "🎬",
      "mdi:palette-outline": "🎬",
      "mdi:script-text-play": "▶️",
      "mdi:script-text-outline": "▶️",
      "mdi:flash": "⚡",
      "mdi:car-electric": "🚗",
      "mdi:water-boiler": "♨️",
      "mdi:water": "💧",
      "mdi:cctv": "📷",
      "mdi:bell": "🔔",
      "mdi:star": "⭐",
      "mdi:thermostat": "❄️",
    });
    const quickActionMdiByGlyph = Object.freeze({
      "🏠": "mdi:home",
      "💡": "mdi:lightbulb",
      "❄️": "mdi:snowflake",
      "🔥": "mdi:radiator",
      "🛡️": "mdi:shield-home",
      "🚪": "mdi:gate",
      "🪟": "mdi:window-shutter",
      "🎬": "mdi:movie-open",
      "▶️": "mdi:script-text-play",
      "⚡": "mdi:flash",
      "🚗": "mdi:car-electric",
      "♨️": "mdi:water-boiler",
      "💧": "mdi:water",
      "📷": "mdi:cctv",
      "🔔": "mdi:bell",
      "⭐": "mdi:star",
      "🧺": "mdi:washing-machine",
      "🔀": "mdi:toggle-switch-outline",
    });

    const quickActionDefaultGlyph = (type) => quickActionGlyphByType[type] || "⭐";
    const quickActionGlyph = (value, type) => {
      const icon = String(value || "").trim();
      if (!icon || icon === "⚡") return quickActionDefaultGlyph(type);
      if (icon.startsWith("mdi:")) return quickActionGlyphByMdi[icon] || quickActionDefaultGlyph(type);
      return icon;
    };
    const quickActionMdi = (value, type) => {
      const icon = String(value || "").trim();
      if (icon.startsWith("mdi:")) return icon;
      return quickActionMdiByGlyph[icon] || quickActionMdiByType[type] || "";
    };
    const renderQuickActionIcon = (target, value, type, size = 32) => {
      if (!target) return;
      const mdi = quickActionMdi(value, type);
      if (mdi && typeof globalThis.cdIconMarkup === "function") {
        target.innerHTML = globalThis.cdIconMarkup(mdi, size);
        return;
      }
      target.textContent = quickActionGlyph(value, type);
    };
    const normalizeQuickActionEditor = () => {
      const input = document.getElementById("ed-qa-icon");
      const type = document.getElementById("ed-qa-type");
      if (!input || !type) return;
      const current = String(input.value || "").trim();
      const next = quickActionGlyph(current, type.value);
      if (next !== current) {
        input.value = next;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      renderQuickActionIcon(
        input.parentElement?.querySelector?.(".dm-beta6-qa-icon-trigger"),
        next,
        type.value,
        32,
      );
    };
    const polishQuickActionCards = () => {
      const actions =
        typeof globalThis.getQuickActions === "function" ? globalThis.getQuickActions() : [];
      document.querySelectorAll?.("#qa-grid .qa-btn").forEach((button, index) => {
        const action = actions[index] || {};
        const type =
          action.type === "builtin" ? `builtin_${action.builtin || ""}` : action.type || "";
        const icon = quickActionGlyph(action.icon, type);
        renderQuickActionIcon(button.querySelector?.(".icon"), icon, type, 30);
      });
    };
    const installQuickActionRenderer = () => {
      const original = globalThis.buildQuickActions;
      if (typeof original !== "function" || original.__dmBeta6Icons === true) return;
      const wrapped = function dashboardModernQuickActionsWithIcons(...args) {
        const result = original.apply(this, args);
        polishQuickActionCards();
        return result;
      };
      wrapped.__dmBeta6Icons = true;
      globalThis.buildQuickActions = wrapped;
      polishQuickActionCards();
    };
    const scheduleQuickActionPolish = () =>
      globalThis.setTimeout?.(() => {
        installQuickActionRenderer();
        normalizeQuickActionEditor();
        polishQuickActionCards();
      }, 0);

    document.addEventListener(
      "change",
      (event) => {
        if (event.target?.id === "ed-qa-icon" || event.target?.id === "ed-qa-type") {
          scheduleQuickActionPolish();
        }
      },
      false,
    );
    document.addEventListener(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            '.ed-tab,[data-tab="sez8"],.dm-beta6-qa-icon-trigger,#dm-beta6-quick-icon-picker .dm-picker-option',
          )
        ) {
          scheduleQuickActionPolish();
        }
      },
      false,
    );
    globalThis.addEventListener?.("dashboardmodern:legacy-ready", scheduleQuickActionPolish);
    globalThis.addEventListener?.("dashboardmodern:runtime-ready", scheduleQuickActionPolish);
    queueMicrotask(scheduleQuickActionPolish);
  }
}
