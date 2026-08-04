/* DashboardModern 0.15.0 compatibility entry: one runtime, no patch cascade. */
import "./release-0152-fixes.js";

if (typeof document !== "undefined" && !document.getElementById("dm-report-responsive-0150")) {
  const style = document.createElement("style");
  style.id = "dm-report-responsive-0150";
  style.textContent = `
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
