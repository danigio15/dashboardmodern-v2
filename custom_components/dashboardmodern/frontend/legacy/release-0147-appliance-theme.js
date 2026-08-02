/* Theme-aware appliance cards retained as an idempotent compatibility layer. */
const FLAG = "__DASHBOARDMODERN_0147_APPLIANCE_THEME__";

function installApplianceThemeCss() {
  if (document.getElementById("dm-0147-appliance-theme")) return;

  const style = document.createElement("style");
  style.id = "dm-0147-appliance-theme";
  style.textContent = `
    #page-appliances-main .appl-wide-card.dm-control-device {
      background: var(--card-bg, var(--ha-card-background, var(--primary-background-color, #fff))) !important;
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
      background: var(--secondary-background-color, var(--card-bg, var(--ha-card-background, #fff))) !important;
      border-right: 1px solid var(--card-border, var(--divider-color, #dbe4ee)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-visual::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
      background: linear-gradient(145deg, rgba(14,165,233,.08), transparent 48%, rgba(14,165,233,.04));
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
    #page-appliances-main .appl-wide-card.dm-control-device .appl-st,
    #page-appliances-main .appl-wide-card.dm-control-device .appl-action-btn {
      background: var(--secondary-background-color, var(--card-bg, var(--ha-card-background, #fff))) !important;
      border: 1px solid var(--card-border, var(--divider-color, #dbe4ee)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-action-btn {
      color: var(--text, var(--primary-text-color, #0f172a)) !important;
    }

    #page-appliances-main .appl-wide-card.dm-control-device .appl-spark {
      border-bottom-color: var(--card-border, var(--divider-color, #dbe4ee)) !important;
    }

    @media (max-width: 760px) {
      #page-appliances-main .appl-wide-card.dm-control-device {
        grid-template-columns: 112px minmax(0, 1fr) !important;
      }
    }
  `;
  document.head.append(style);
}

function setData(node, key, value) {
  if (!node?.dataset || node.dataset[key] === value) return false;
  node.dataset[key] = value;
  return true;
}

function decorateApplianceCards() {
  document
    .querySelectorAll("#page-appliances-main .appl-wide-card.dm-control-device")
    .forEach((card) => {
      setData(card, "applianceThemeAware", "true");
      setData(card.querySelector(".appl-visual"), "applianceCover", "true");
    });
}

function installRenderHook() {
  const renderer = globalThis.renderApplianceSection;
  if (typeof renderer !== "function") return false;
  if (renderer.__dmApplianceThemeAware === true) return true;

  const wrapped = function renderApplianceSection0147Theme(...args) {
    const result = renderer.apply(this, args);
    if (result && typeof result.finally === "function") {
      return result.finally(decorateApplianceCards);
    }
    decorateApplianceCards();
    return result;
  };
  wrapped.__dmApplianceThemeAware = true;
  wrapped.__dmPrevious = renderer;
  globalThis.renderApplianceSection = wrapped;
  return true;
}

function install() {
  installApplianceThemeCss();
  installRenderHook();
  decorateApplianceCards();

  const state = (globalThis[FLAG] ||= { installed: true, attempts: 0 });
  if (state.timer) return;
  state.timer = globalThis.setInterval?.(() => {
    state.attempts += 1;
    if (installRenderHook() || state.attempts >= 100) {
      globalThis.clearInterval?.(state.timer);
      state.timer = 0;
    }
  }, 100);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
  window.addEventListener("dashboardmodern:legacy-ready", install);
}
