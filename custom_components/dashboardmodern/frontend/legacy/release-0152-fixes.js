/* DashboardModern 0.14.12 compatibility entry point. */
export * from "./release-0152-runtime.js";
import "./release-0152-runtime.js";

function installArtworkLayoutFix0152() {
  const doc = globalThis.document;
  if (!doc || doc.getElementById("dm-release-0152-artwork-layout-fix")) return;

  const artworkSelector = `
    html body #page-appliances-main
      .appl-wide-card.dm-control-device[data-dm-artwork]
      .appl-visual
      .appl-ic
      .dm-appliance-media
      > .dm-appliance-art
      > .dm-appliance-art.dm-appliance-art-0152[data-dm-art]
  `;

  const style = doc.createElement("style");
  style.id = "dm-release-0152-artwork-layout-fix";
  style.textContent = `
    ${artworkSelector} {
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
      margin: 0 !important;
      overflow: hidden !important;
      transform: none !important;
    }

    ${artworkSelector} > svg {
      display: block !important;
      box-sizing: border-box !important;
      width: 76% !important;
      height: 76% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 76% !important;
      max-height: 76% !important;
      object-fit: contain !important;
      object-position: center !important;
      transform: none !important;
      overflow: visible !important;
      flex: 0 0 76% !important;
    }
  `;
  doc.head.append(style);
}

function restoreExplicitBridge0152() {
  const bridge = globalThis.__DASHBOARDMODERN_BRIDGE_WS__;
  if (typeof bridge !== "function") return false;
  globalThis.WebSocket = bridge;
  return true;
}

installArtworkLayoutFix0152();
restoreExplicitBridge0152();

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener(
    "dashboardmodern:legacy-ready",
    () => {
      restoreExplicitBridge0152();
    },
    { once: true },
  );
}
