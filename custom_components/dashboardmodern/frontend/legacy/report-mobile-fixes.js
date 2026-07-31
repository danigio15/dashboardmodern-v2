/* Responsive Report editor and runtime regression fixes. */
import "./release-0147-fixes.js";
import "./release-0147-store-fixes.js";
import "./release-0147-dom-compat.js";
import "./release-0147-appliance-store.js";
import "./release-0147-appliance-theme.js";
import "./release-0147-report-polish.js";
import "./release-0147-editor-theme.js";
import "./real-ha-0147-fixes.js";
import "./real-ha-0147-stability.js";
import "./real-ha-0147-layout-lock.js";
import "./real-ha-0147-data-repair.js";
import "./real-ha-0147-alert-compat.js";
import "./real-ha-0147-popup-layout.js";
import "./release-0149-fixes.js";
import "./release-0150-fixes.js";
import "./release-0150-save-state-fix.js";

function installReportCompatibilityMarker() {
  if (document.getElementById("dm-report-mobile-fixes")) return;
  const marker = document.createElement("style");
  marker.id = "dm-report-mobile-fixes";
  marker.textContent = "/* Layout rules are installed by the release compatibility modules. */";
  document.head.append(marker);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installReportCompatibilityMarker, { once: true });
  } else {
    installReportCompatibilityMarker();
  }
}
