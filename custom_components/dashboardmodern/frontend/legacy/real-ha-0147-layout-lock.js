/* Final high-specificity layout lock based on real Home Assistant screenshots. */
function installRealHaLayoutLock() {
  if (document.getElementById("dm-real-ha-0147-layout-lock")) return;
  const style = document.createElement("style");
  style.id = "dm-real-ha-0147-layout-lock";
  style.textContent = `
    html body #page-appliances-main .appl-page-grid {
      grid-template-columns: repeat(auto-fit, minmax(280px, 380px)) !important;
      justify-content: center !important;
      align-items: start !important;
      gap: 14px !important;
    }
    html body #page-appliances-main .appl-wide-card.dm-control-device {
      display: grid !important;
      grid-template-columns: 94px minmax(0, 1fr) !important;
      width: 100% !important;
      max-width: 380px !important;
      min-height: 128px !important;
      border-radius: 20px !important;
      overflow: hidden !important;
    }
    html body #page-appliances-main .appl-wide-card.dm-control-device .appl-visual {
      width: 94px !important;
      min-width: 94px !important;
      min-height: 128px !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    html body #page-appliances-main .appl-wide-card.dm-control-device .appl-ic,
    html body #page-appliances-main .appl-wide-card.dm-control-device .appl-ic.dm-appliance-image-wrap,
    html body #page-appliances-main .appl-wide-card.dm-control-device .dm-appliance-art,
    html body #page-appliances-main .appl-wide-card.dm-control-device .dm-appliance-image-wrap {
      display: block !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      height: 100% !important;
      min-height: 128px !important;
      max-height: none !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }
    html body #page-appliances-main .appl-wide-card.dm-control-device .appl-ic img,
    html body #page-appliances-main .appl-wide-card.dm-control-device .appl-ic svg,
    html body #page-appliances-main .appl-wide-card.dm-control-device .dm-appliance-art svg,
    html body #page-appliances-main .appl-wide-card.dm-control-device .dm-appliance-image {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: none !important;
      max-height: none !important;
      object-fit: cover !important;
      object-position: center !important;
    }
    html body #page-appliances-main .appl-wide-card.dm-control-device .appl-info {
      min-width: 0 !important;
      padding: 12px !important;
      gap: 8px !important;
    }
    html body #page-appliances-main .appl-wide-card.dm-control-device .appl-spark {
      display: none !important;
    }

    html body #page-tapparelle > div {
      max-width: 980px !important;
      padding-inline: 14px !important;
    }
    html body #tapp-grid {
      grid-template-columns: repeat(auto-fit, minmax(270px, 330px)) !important;
      justify-content: center !important;
      align-items: start !important;
      gap: 14px !important;
      padding: 12px 0 70px !important;
    }
    html body #tapp-grid .tapp-card {
      width: 100% !important;
      max-width: 330px !important;
      min-height: 0 !important;
      padding: 14px !important;
      gap: 10px !important;
      border-radius: 20px !important;
    }
    html body #tapp-grid .tapp-win {
      height: 126px !important;
      min-height: 126px !important;
      border-radius: 16px !important;
    }
    html body #tapp-grid .tapp-pos {
      min-height: 22px !important;
      font-size: 17px !important;
      line-height: 22px !important;
    }
    html body #tapp-grid .tapp-btn,
    html body .dm-shutter-popup .dm-shutter-actions button {
      min-height: 42px !important;
      padding: 8px 12px !important;
      border: 1px solid var(--card-border, #dbe4ee) !important;
      border-radius: 12px !important;
      background: var(--surface-3, #f1f5f9) !important;
      color: var(--text, #0f172a) !important;
      box-shadow: none !important;
      font-weight: 800 !important;
    }
    html body #tapp-grid .tapp-btn[data-svc="open_cover"],
    html body .dm-shutter-popup .dm-shutter-actions button[data-shutter-service="open_cover"] {
      background: rgba(16,185,129,.14) !important;
      border-color: rgba(16,185,129,.24) !important;
      color: #047857 !important;
    }
    html body #tapp-grid .tapp-btn[data-svc="close_cover"],
    html body .dm-shutter-popup .dm-shutter-actions button[data-shutter-service="close_cover"] {
      background: rgba(14,165,233,.14) !important;
      border-color: rgba(14,165,233,.24) !important;
      color: #0369a1 !important;
    }
    html body #tapp-grid > .dm-shutter-bulk-actions,
    html body #tapp-grid > div:first-child:has([data-all]) {
      width: min(100%, 680px) !important;
      padding: 8px !important;
      margin: 0 auto 4px !important;
      border: 1px solid var(--card-border, #dbe4ee) !important;
      border-radius: 16px !important;
      background: var(--card-bg, #fff) !important;
      box-shadow: var(--shadow-sculpted) !important;
    }

    @media (max-width: 700px) {
      html body #page-appliances-main .appl-page-grid {
        grid-template-columns: 1fr !important;
      }
      html body #page-appliances-main .appl-wide-card.dm-control-device {
        grid-template-columns: 82px minmax(0, 1fr) !important;
        max-width: none !important;
        min-height: 118px !important;
      }
      html body #page-appliances-main .appl-wide-card.dm-control-device .appl-visual {
        width: 82px !important;
        min-width: 82px !important;
        min-height: 118px !important;
      }
      html body #page-appliances-main .appl-wide-card.dm-control-device .appl-ic,
      html body #page-appliances-main .appl-wide-card.dm-control-device .appl-ic.dm-appliance-image-wrap,
      html body #page-appliances-main .appl-wide-card.dm-control-device .dm-appliance-art,
      html body #page-appliances-main .appl-wide-card.dm-control-device .dm-appliance-image-wrap {
        min-height: 118px !important;
      }
      html body #tapp-grid {
        grid-template-columns: 1fr !important;
      }
      html body #tapp-grid .tapp-card {
        margin-inline: auto !important;
      }
      html body #tapp-grid > .dm-shutter-bulk-actions,
      html body #tapp-grid > div:first-child:has([data-all]) {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
      }
    }
  `;
  document.head.append(style);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installRealHaLayoutLock, { once: true });
  else installRealHaLayoutLock();
  window.addEventListener("dashboardmodern:legacy-ready", installRealHaLayoutLock);
}
