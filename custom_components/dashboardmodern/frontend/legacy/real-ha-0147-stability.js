/* Stability layer for the real Home Assistant 0.14.7 acceptance fixes. */
const STABILITY_FLAG = "__DASHBOARDMODERN_REAL_HA_0147_STABILITY__";
const isEnglish = () => document.documentElement.lang === "en";

function stabilizePowerButtons(root = document) {
  root.querySelectorAll("#page-appliances-main .appl-wide-card.dm-control-device").forEach((card) => {
    const button = [...card.querySelectorAll(".appl-action-btn, .dm-appliance-power-toggle")].find(
      (candidate) =>
        candidate.classList.contains("dm-appliance-power-toggle") ||
        candidate.textContent.trim() === "⏻" ||
        candidate.dataset.dmPowerToggle === "true",
    );
    if (!button) return;
    const on = button.classList.contains("on");
    const label = on
      ? isEnglish()
        ? "Turn off"
        : "Spegni"
      : isEnglish()
        ? "Turn on"
        : "Accendi";
    if (button.textContent.trim() !== label) button.textContent = label;
    button.dataset.dmPowerToggle = "true";
    button.classList.remove("appl-action-btn");
    button.classList.add("dm-appliance-power-toggle");
    button.setAttribute("aria-label", label);
  });
}

function install() {
  if (!document.getElementById("dm-real-ha-0147-stability-css")) {
    const style = document.createElement("style");
    style.id = "dm-real-ha-0147-stability-css";
    style.textContent = `
      #page-appliances-main .dm-appliance-power-toggle {
        min-width: 86px;
        min-height: 38px;
        padding: 8px 12px;
        border: 1px solid var(--card-border, #dbe4ee);
        border-radius: 11px;
        background: var(--surface-3, #f1f5f9);
        color: var(--text, #0f172a);
        font: inherit;
        font-size: 12px;
        font-weight: 850;
        cursor: pointer;
      }
      #page-appliances-main .dm-appliance-power-toggle.on {
        background: rgba(239,68,68,.12);
        border-color: rgba(239,68,68,.24);
        color: #b91c1c;
      }
      #editor-modal .ed-row:has([data-real-alert-edit]) [data-standard-alert-edit] {
        display: none !important;
      }
      @media (max-width: 700px) {
        #page-appliances-main .dm-appliance-power-toggle {
          min-width: 78px;
          min-height: 38px;
          padding-inline: 9px;
          font-size: 11px;
        }
      }
    `;
    document.head.append(style);
  }
  stabilizePowerButtons();
  if (globalThis[STABILITY_FLAG]?.installed) return;
  globalThis[STABILITY_FLAG] = { installed: true };
  new MutationObserver(() => stabilizePowerButtons()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
  window.addEventListener("dashboardmodern:legacy-ready", install);
}
