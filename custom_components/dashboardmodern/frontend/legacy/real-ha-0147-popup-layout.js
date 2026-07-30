/* Compact, dashboard-consistent shutter popup layout. */
function installShutterPopupLayout() {
  if (document.getElementById("dm-real-ha-0147-popup-layout")) return;
  const style = document.createElement("style");
  style.id = "dm-real-ha-0147-popup-layout";
  style.textContent = `
    html body .dm-shutter-popup {
      width: min(520px, 100%) !important;
      padding: 16px !important;
      border-radius: 22px !important;
    }
    html body .dm-shutter-popup > header {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 42px !important;
      align-items: center !important;
      gap: 12px !important;
      margin-bottom: 12px !important;
    }
    html body .dm-shutter-popup > header h2 {
      min-width: 0 !important;
      margin: 0 !important;
      font-size: 20px !important;
      line-height: 1.2 !important;
      letter-spacing: .5px !important;
    }
    html body .dm-shutter-popup > header [data-shutter-popup-close] {
      grid-column: 2 !important;
      justify-self: end !important;
      align-self: center !important;
      width: 42px !important;
      height: 42px !important;
      margin: 0 !important;
      border: 1px solid var(--card-border, #dbe4ee) !important;
      border-radius: 50% !important;
      background: var(--surface-3, #f1f5f9) !important;
      color: var(--text, #0f172a) !important;
      font-size: 24px !important;
      line-height: 1 !important;
    }
    html body .dm-shutter-popup-row {
      display: grid !important;
      grid-template-columns: 52px minmax(0, 1fr) !important;
      grid-template-areas: "icon details" "actions actions" !important;
      align-items: center !important;
      gap: 10px 12px !important;
      padding: 12px !important;
      border-radius: 16px !important;
    }
    html body .dm-shutter-popup-row > .g-icon-wrap {
      grid-area: icon !important;
      width: 52px !important;
      height: 52px !important;
      margin: 0 !important;
    }
    html body .dm-shutter-popup-row > .dm-shutter-details {
      grid-area: details !important;
    }
    html body .dm-shutter-popup-row > .dm-shutter-actions {
      grid-area: actions !important;
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
      width: 100% !important;
    }
    html body .dm-shutter-popup-row > .dm-shutter-actions button {
      width: 100% !important;
      min-width: 0 !important;
      min-height: 42px !important;
      padding: 8px 6px !important;
      white-space: nowrap !important;
    }
    @media (max-width: 430px) {
      html body .dm-shutter-popup {
        padding: 14px !important;
      }
      html body .dm-shutter-popup > header h2 {
        font-size: 18px !important;
      }
      html body .dm-shutter-popup-row {
        grid-template-columns: 46px minmax(0, 1fr) !important;
        padding: 11px !important;
      }
      html body .dm-shutter-popup-row > .g-icon-wrap {
        width: 46px !important;
        height: 46px !important;
      }
      html body .dm-shutter-popup-row > .dm-shutter-actions button {
        font-size: 12px !important;
      }
    }
  `;
  document.head.append(style);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installShutterPopupLayout, { once: true });
  else installShutterPopupLayout();
  window.addEventListener("dashboardmodern:legacy-ready", installShutterPopupLayout);
}
