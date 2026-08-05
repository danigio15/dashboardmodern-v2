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
    #ev-mod-car-img[data-ev-failed="1"],
    #ev-new-car-img[data-ev-failed="1"],
    #ev-mod-car-img[data-ev-image-error],
    #ev-new-car-img[data-ev-image-error] {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      min-width: 1px !important;
      min-height: 1px !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 260'%3E%3Cpath fill='%2394a3b8' d='M112 174h28l28-72c7-18 24-30 44-30h205c23 0 44 12 56 32l39 70h20c22 0 40 18 40 40v10H80v-10c0-22 14-40 32-40Zm93-68-25 68h274l-35-62c-2-4-7-6-12-6H205Zm-37 132a34 34 0 1 0 68 0 34 34 0 0 0-68 0Zm272 0a34 34 0 1 0 68 0 34 34 0 0 0-68 0Z'/%3E%3C/svg%3E") !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      background-size: contain !important;
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

  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      if (!new Set(["ev-mod-car-img", "ev-new-car-img"]).has(image.id)) return;
      const configured = image.getAttribute("src");
      if (!configured) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      image.dataset.evFailed = "1";
      image.dataset.evImageError = configured;
      image.style.setProperty("display", "block", "important");
      image.style.setProperty("visibility", "visible", "important");
      image.style.setProperty("opacity", "1", "important");
    },
    true,
  );
}
