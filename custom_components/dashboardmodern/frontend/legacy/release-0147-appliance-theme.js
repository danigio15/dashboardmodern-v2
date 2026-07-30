/* Theme-aware, full-bleed appliance cards for the 0.14.7 corrective release. */
const FLAG = "__DASHBOARDMODERN_0147_APPLIANCE_THEME__";

function installApplianceThemeCss() {
  if (document.getElementById("dm-0147-appliance-theme")) return;

  const style = document.createElement("style");
  style.id = "dm-0147-appliance-theme";
  style.textContent = `
    #page-appliances-main .appl-wide-card.dm-control-device {
      background: var(
        --card-bg,
        var(--ha-card-background, var(--primary-background-color, #fff))
      ) !important;
      color: var(--text, var(--primary-text-color, #0f172a)) !important;
      border-color: var(--card-border, var(--divider-color, #dbe4ee)) !important;
      box-shadow: var(--shadow-sculpted, 0 14px 34px rgba(15, 23, 42, 0.14)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual {
      position: relative;
      display: block !important;
      align-self: stretch;
      min-width: 0 !important;
      width: 100%;
      height: 100%;
      min-height: 100%;
      padding: 0 !important;
      overflow: hidden;
      background: var(
        --secondary-background-color,
        var(--card-bg, var(--ha-card-background, #fff))
      ) !important;
      border-right: 1px solid var(--card-border, var(--divider-color, #dbe4ee)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
      background: linear-gradient(
        145deg,
        rgba(14, 165, 233, 0.08),
        transparent 48%,
        rgba(14, 165, 233, 0.04)
      );
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual .appl-ic,
    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual .dm-appliance-art,
    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual .dm-appliance-image-wrap {
      display: grid !important;
      place-items: center !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 100% !important;
      min-height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      padding: 0 !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      overflow: hidden !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual .dm-appliance-art svg,
    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual .dm-appliance-image,
    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual img {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      min-width: 100% !important;
      min-height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      object-fit: cover !important;
      object-position: center !important;
      border-radius: 0 !important;
      filter: none !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual .dm-appliance-art svg {
      transform: scale(1.32);
      transform-origin: center;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual .dm-appliance-glyph {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      font-size: clamp(58px, 7vw, 96px);
      line-height: 1;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-info {
      color: var(--text, var(--primary-text-color, #0f172a)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-wide-name,
    #page-appliances-main .appl-wide-card.dm-control-device .appl-primary strong {
      color: var(--text, var(--primary-text-color, #0f172a)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-wide-cat,
    #page-appliances-main .appl-wide-card.dm-control-device .appl-mini {
      color: var(--text-dim, var(--secondary-text-color, #64748b)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-primary span {
      color: var(--accent, var(--primary-color, #0ea5e9)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-mini,
    #page-appliances-main .appl-wide-card.dm-control-device .appl-st {
      background: var(
        --secondary-background-color,
        var(--card-bg, var(--ha-card-background, #fff))
      ) !important;
      border: 1px solid var(--card-border, var(--divider-color, #dbe4ee)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-action-btn {
      background: var(
        --secondary-background-color,
        var(--card-bg, var(--ha-card-background, #fff))
      ) !important;
      color: var(--text, var(--primary-text-color, #0f172a)) !important;
      border-color: var(--card-border, var(--divider-color, #dbe4ee)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-spark {
      border-bottom-color: var(--card-border, var(--divider-color, #dbe4ee)) !important;
    }

    #appl-icon-btn .dm-appliance-art {
      width: 34px !important;
      height: 34px !important;
      min-width: 34px !important;
      min-height: 34px !important;
      border-radius: 9px !important;
      overflow: hidden !important;
    }

    #appl-icon-btn .dm-appliance-art svg {
      width: 100% !important;
      height: 100% !important;
      transform: none !important;
    }

    @media (max-width: 760px) {
      #page-appliances-main .appl-wide-card.dm-control-device {
        grid-template-columns: 112px minmax(0, 1fr) !important;
      }
    }
  `;
  document.head.append(style);
}

function decorateApplianceCards() {
  document
    .querySelectorAll("#page-appliances-main .appl-wide-card.dm-control-device")
    .forEach((card) => {
      card.dataset.applianceThemeAware = "true";
      const visual = card.querySelector(".appl-visual");
      if (visual) visual.dataset.applianceCover = "true";
    });
}

function install() {
  if (globalThis[FLAG]?.installed) {
    installApplianceThemeCss();
    decorateApplianceCards();
    return;
  }

  globalThis[FLAG] = { installed: true };
  installApplianceThemeCss();
  decorateApplianceCards();

  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(decorateApplianceCards);
  }).observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
  window.addEventListener("dashboardmodern:legacy-ready", install);
}
