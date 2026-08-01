/* DashboardModern 0.14.12 compatibility entry point. */
export * from "./release-0152-runtime.js";
import "./release-0152-runtime.js";

function installArtworkLayoutFix0152() {
  if (document.getElementById("dm-release-0152-artwork-layout-fix")) return;

  const style = document.createElement("style");
  style.id = "dm-release-0152-artwork-layout-fix";
  style.textContent = `
    html body #page-appliances-main
      .appl-wide-card.dm-control-device[data-dm-artwork]
      .dm-appliance-art.dm-appliance-art-0152 {
      display: grid !important;
      place-items: center !important;
      box-sizing: border-box !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 100% !important;
      max-height: 100% !important;
      padding: 6px !important;
      overflow: hidden !important;
    }

    html body #page-appliances-main
      .appl-wide-card.dm-control-device[data-dm-artwork]
      .dm-appliance-art.dm-appliance-art-0152 svg {
      display: block !important;
      width: 76% !important;
      height: 76% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 76% !important;
      max-height: 76% !important;
      object-fit: contain !important;
      transform: none !important;
      overflow: visible !important;
    }
  `;
  document.head.append(style);
}

installArtworkLayoutFix0152();
