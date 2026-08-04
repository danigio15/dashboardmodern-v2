/* DashboardModern 0.15.1 compatibility entry: consolidated runtime plus bounded real-HA owners. */
import "./release-0152-fixes.js";
import "./runtime-real-ha-hotfix-v2.js";
import "./runtime-real-ha-theme-owner.js";
import "./runtime-real-ha-temperature-stability.js";

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

/* The canonical Alerts renderer and the bounded legacy owner must expose one edit contract. */
if (typeof document !== "undefined") {
  const canonicalAlertSelector =
    "[data-final-alert-edit],[data-real-alert-edit],[data-standard-alert-edit]";

  function normalizeAlertEditContracts() {
    document.querySelectorAll(canonicalAlertSelector).forEach((button) => {
      button.dataset.alertEdit0151 = "";
      const row = button.closest(".ed-row");
      if (!row) return;
      row.querySelectorAll("[data-alert-edit-0151]").forEach((candidate) => {
        if (candidate !== button && !candidate.matches(canonicalAlertSelector)) candidate.remove();
      });
    });
  }

  globalThis.__DASHBOARDMODERN_ALERT_EDIT_CONTRACT_0151__ = {
    installed: true,
    apply: normalizeAlertEditContracts,
  };

  document.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('.ed-tab[data-tab="avvisi"]')) {
        globalThis.queueMicrotask?.(normalizeAlertEditContracts);
        globalThis.setTimeout?.(normalizeAlertEditContracts, 40);
      }
    },
    true,
  );
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", normalizeAlertEditContracts);
  globalThis.addEventListener?.("dashboardmodern:runtime-ready", normalizeAlertEditContracts);
  globalThis.addEventListener?.("pageshow", normalizeAlertEditContracts);
  normalizeAlertEditContracts();
  [80, 280, 760, 1500].forEach((delay) =>
    globalThis.setTimeout?.(normalizeAlertEditContracts, delay),
  );
}
