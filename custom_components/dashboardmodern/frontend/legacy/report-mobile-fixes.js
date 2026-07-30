/* Responsive Report editor and 0.14.7 regression fixes. */
import "./release-0147-fixes.js";
import "./release-0147-store-fixes.js";

function installReportCompatibilityMarker() {
  if (document.getElementById("dm-report-mobile-fixes")) return;
  const marker = document.createElement("style");
  marker.id = "dm-report-mobile-fixes";
  marker.textContent = "/* Layout rules are installed by release-0147-fixes.js. */";
  document.head.append(marker);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installReportCompatibilityMarker, { once: true });
  } else {
    installReportCompatibilityMarker();
  }
}
