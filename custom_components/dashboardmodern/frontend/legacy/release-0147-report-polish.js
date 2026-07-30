/* Final Report editor visibility and toggle polish for the 0.14.7 corrective release. */
const FLAG = "__DASHBOARDMODERN_0147_REPORT_POLISH__";

function installReportPolishCss() {
  if (document.getElementById("dm-0147-report-polish")) return;
  const style = document.createElement("style");
  style.id = "dm-0147-report-polish";
  style.textContent = `
    #editor-modal [data-energy-panel="report"] [data-report-manual][hidden] {
      display: none !important;
    }

    #editor-modal [data-energy-panel="report"] [data-report-manual]:not([hidden]) {
      display: grid !important;
      gap: 10px !important;
      margin-top: 10px !important;
    }
  `;
  document.head.append(style);
}

function bindManualReportToggle(root = document) {
  root.querySelectorAll('[data-energy-panel="report"]').forEach((panel) => {
    const button = panel.querySelector("[data-report-add]");
    const form = panel.querySelector("[data-report-manual]");
    if (!button || !form || button.dataset.dmManualToggleBound === "true") return;

    button.dataset.dmManualToggleBound = "true";
    if (!form.id) form.id = `dm-report-manual-${Math.random().toString(36).slice(2, 9)}`;
    button.setAttribute("aria-controls", form.id);
    button.setAttribute("aria-expanded", String(!form.hidden));
    button.dataset.dmClosedLabel = button.textContent.trim();

    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        form.hidden = !form.hidden;
        const open = !form.hidden;
        button.setAttribute("aria-expanded", String(open));
        button.textContent = open
          ? document.documentElement.lang === "en"
            ? "− Close manual entry"
            : "− Chiudi voce manuale"
          : button.dataset.dmClosedLabel;
        if (open) panel.querySelector("[data-manual-name]")?.focus();
      },
      { capture: true },
    );
  });
}

function install() {
  installReportPolishCss();
  bindManualReportToggle();

  if (globalThis[FLAG]?.installed) return;
  globalThis[FLAG] = { installed: true };

  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => bindManualReportToggle());
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
