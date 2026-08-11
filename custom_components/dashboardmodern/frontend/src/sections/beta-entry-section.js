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
    // catalog normalizer can transiently rebuild those icons with the wrong
    // fallback. Keep this one grid authoritative without polling the page: a
    // scoped observer repairs only mutations inside #qa-grid.
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
    const actionBuiltinGlyphs = Object.freeze({
      luci: "💡",
      luci_group: "💡",
      builtin_luci: "💡",
      clima: "❄️",
      builtin_clima: "❄️",
      antifurto: "🛡️",
      builtin_antifurto: "🛡️",
      lavatrice: "🧺",
      builtin_lavatrice: "🧺",
    });
    const actionBuiltinColors = Object.freeze({
      luci: "#f59e0b",
      luci_group: "#f59e0b",
      builtin_luci: "#f59e0b",
      clima: "#0ea5e9",
      builtin_clima: "#0ea5e9",
      antifurto: "#7c3aed",
      builtin_antifurto: "#7c3aed",
      lavatrice: "#0ea5e9",
      builtin_lavatrice: "#0ea5e9",
    });
    const configuredQuickActions = () => {
      // Persisted Quick Actions are authoritative. getQuickActions() can still
      // expose the pre-render snapshot for one turn immediately after an edit.
      try {
        const actions = JSON.parse(globalThis.localStorage?.getItem("cd_quick_actions") || "[]");
        if (Array.isArray(actions) && actions.length) return actions;
      } catch (_error) {}
      try {
        const actions = globalThis.getQuickActions?.();
        return Array.isArray(actions) ? actions : [];
      } catch (_error) {
        return [];
      }
    };
    const repairV01525QuickActionGlyphs = () => {
      const actions = configuredQuickActions();
      document.querySelectorAll("#qa-grid .qa-btn .icon").forEach((icon, index) => {
        const action = actions[index] || {};
        const builtin = String(action.builtin || "").trim().toLowerCase();
        const configured = String(action.icon || "").trim();
        const configuredMdi = configured.toLowerCase().startsWith("mdi:") ? configured : "";
        const configuredGlyph = configured && !configuredMdi ? configured : "";
        const raw = String(icon.dataset.dmBeta7IconToken || "");
        const [mdiToken, persistedGlyph] = raw.split("|");
        const glyph =
          configuredGlyph ||
          actionGlyphs[configuredMdi] ||
          actionBuiltinGlyphs[builtin] ||
          actionGlyphs[mdiToken] ||
          (persistedGlyph && !persistedGlyph.startsWith("mdi:") ? persistedGlyph : "") ||
          "⭐";
        const color = String(action.color || actionBuiltinColors[builtin] || "#0ea5e9").trim();
        let target = icon.querySelector(".dm-v01525-action-glyph");
        if (!target) {
          target = document.createElement("span");
          target.className = "dm-v01525-action-glyph";
          target.setAttribute("aria-hidden", "true");
          icon.replaceChildren(target);
        }
        if (target.textContent !== glyph) target.textContent = glyph;
        icon.dataset.dmActionStyle = "v01525";
        icon.style.setProperty("color", color, "important");
        icon.style.setProperty("filter", `drop-shadow(0 6px 12px ${color}66)`, "important");
      });
    };
    const scheduleV01525QuickActionRepair = () => {
      requestAnimationFrame?.(repairV01525QuickActionGlyphs);
      setTimeout(repairV01525QuickActionGlyphs, 0);
      setTimeout(repairV01525QuickActionGlyphs, 90);
      setTimeout(repairV01525QuickActionGlyphs, 320);
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
    let quickActionObservedGrid = null;
    let quickActionObserver = null;
    const installQuickActionGridObserver = () => {
      const grid = document.getElementById("qa-grid");
      if (!grid || grid === quickActionObservedGrid) return;
      quickActionObserver?.disconnect?.();
      quickActionObservedGrid = grid;
      quickActionObserver = new MutationObserver(() => repairV01525QuickActionGlyphs());
      quickActionObserver.observe(grid, { childList: true, subtree: true, characterData: true });
      repairV01525QuickActionGlyphs();
    };
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
    ]) globalThis.addEventListener?.(eventName, () => {
      installQuickActionRepairOwner();
      installQuickActionGridObserver();
      scheduleV01525QuickActionRepair();
    });
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("#dm-action-editor-modal,#dm-beta9-action-picker,.dm-beta6-qa-icon-trigger"))
        scheduleV01525QuickActionRepair();
    }, true);

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

    installQuickActionRepairOwner();
    installQuickActionGridObserver();
    scheduleV01525QuickActionRepair();
  }
}
