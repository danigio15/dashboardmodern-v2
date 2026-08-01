/* Responsive Report editor and runtime regression fixes. */
import "./release-0147-fixes.js";
import "./release-0147-store-fixes.js";
import "./release-0147-dom-compat.js";
import "./release-0147-appliance-store.js";
import "./release-0147-appliance-theme.js";
import "./release-0147-report-polish.js";
import "./release-0147-editor-theme.js";
import "./real-ha-0147-fixes.js";
import "./real-ha-0147-stability.js";
import "./real-ha-0147-layout-lock.js";
import "./real-ha-0147-data-repair.js";
import "./real-ha-0147-alert-compat.js";
import "./real-ha-0147-popup-layout.js";
import "./release-0149-fixes.js";
import "./release-0150-fixes.js";
import "./release-0150-save-state-fix.js";
import "./release-0150-runtime-state-fixes.js";
import "./release-0152-fixes.js";
import "./release-0152-compat.js";

function installReportCompatibilityMarker() {
  if (document.getElementById("dm-report-mobile-fixes")) return;
  const marker = document.createElement("style");
  marker.id = "dm-report-mobile-fixes";
  marker.textContent = `
    /* Keep every primary editor action at the established 44 px touch target. */
    #editor-modal .dm-unified-action { min-height: 44px !important; }

    /* The vendored dashboards can render the Temperature card with the newer
       header/body markup. Give those two regions explicit grid rows so the room
       name can never overlap temperature and humidity values. */
    #temp-grid .temp-card > .temp-card-header {
      position: static !important;
      inset: auto !important;
      grid-column: 1 / -1 !important;
      grid-row: 1 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 10px !important;
      width: 100% !important;
      min-width: 0 !important;
      margin: 0 !important;
      transform: none !important;
    }
    #temp-grid .temp-card > .temp-card-header .cp-title-wrap {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      flex: 1 1 auto !important;
      min-width: 0 !important;
    }
    #temp-grid .temp-card > .temp-card-header .cp-icon {
      position: static !important;
      inset: auto !important;
      display: grid !important;
      place-items: center !important;
      width: 48px !important;
      height: 48px !important;
      min-width: 48px !important;
      margin: 0 !important;
      transform: none !important;
    }
    #temp-grid .temp-card > .temp-card-header .cp-name {
      min-width: 0 !important;
      margin: 0 !important;
    }
    #temp-grid .temp-card > .temp-card-header .cp-badge {
      position: static !important;
      inset: auto !important;
      flex: 0 0 auto !important;
      margin: 0 !important;
      transform: none !important;
    }
    #temp-grid .temp-card > .temp-card-body {
      position: static !important;
      inset: auto !important;
      grid-column: 1 / -1 !important;
      grid-row: 2 !important;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      align-items: end !important;
      gap: 14px !important;
      width: 100% !important;
      min-width: 0 !important;
      margin: 0 !important;
      transform: none !important;
    }
    #temp-grid .temp-card > .temp-card-body .cp-temp-current-wrap,
    #temp-grid .temp-card > .temp-card-body .cp-temp-target {
      position: static !important;
      inset: auto !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-start !important;
      justify-content: flex-end !important;
      min-width: 0 !important;
      margin: 0 !important;
      transform: none !important;
    }
    #temp-grid .temp-card > .temp-card-body .cp-temp-current-lbl,
    #temp-grid .temp-card > .temp-card-body .cp-temp-target .lbl {
      display: block !important;
      max-width: 100% !important;
      margin: 0 0 4px !important;
      font-size: 9px !important;
      line-height: 1.15 !important;
      font-weight: 900 !important;
      letter-spacing: .08em !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    #temp-grid .temp-card > .temp-card-body .cp-temp-current,
    #temp-grid .temp-card > .temp-card-body .cp-temp-target .val {
      position: static !important;
      display: block !important;
      margin: 0 !important;
      font-size: clamp(30px, 4vw, 42px) !important;
      line-height: .9 !important;
      font-weight: 950 !important;
      white-space: nowrap !important;
      transform: none !important;
    }
    @media (max-width: 420px) {
      #temp-grid .temp-card > .temp-card-header .cp-icon {
        width: 42px !important;
        height: 42px !important;
        min-width: 42px !important;
      }
      #temp-grid .temp-card > .temp-card-body { gap: 8px !important; }
      #temp-grid .temp-card > .temp-card-body .cp-temp-current,
      #temp-grid .temp-card > .temp-card-body .cp-temp-target .val {
        font-size: 31px !important;
      }
    }
  `;
  document.head.append(marker);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installReportCompatibilityMarker, { once: true });
  } else {
    installReportCompatibilityMarker();
  }
}
