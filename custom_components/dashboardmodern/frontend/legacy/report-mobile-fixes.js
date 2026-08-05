/* DashboardModern 0.15.2 — production entry for the single runtime owner. */
import "./runtime-consolidated.js";
import "../src/core/runtime-startup-coordinator.js";
import "../src/core/alerts-runtime.js";
import "../src/core/energy-total-source.js";
import "../src/core/vehicle-image-runtime.js";

if (typeof document !== "undefined" && !document.getElementById("dm-report-responsive-0152")) {
  const style = document.createElement("style");
  style.id = "dm-report-responsive-0152";
  style.textContent = `
    #dm-light-picker-0152 {
      position: fixed !important;
      inset: 0 !important;
      z-index: 20000 !important;
      pointer-events: auto !important;
    }
    #dm-light-picker-0152 .modal-content {
      position: relative !important;
      z-index: 1 !important;
      pointer-events: auto !important;
    }
    @media (max-width: 720px) {
      .ed-header-period { align-items: stretch; }
      .ed-yoy-chips { display:flex; flex-wrap:wrap; gap:6px; }
      .ed-kpi-banner { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .ed-device-row { min-width:0; }
      .ed-dev-name { min-width:0; }
    }
  `;
  document.head.append(style);
}
