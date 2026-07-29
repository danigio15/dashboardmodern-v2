/* Mobile layout for the canonical Energy Report editor. */

function installReportMobileFixes() {
  if (document.getElementById("dm-report-mobile-fixes")) return;
  const style = document.createElement("style");
  style.id = "dm-report-mobile-fixes";
  style.textContent = `
    @media (max-width: 760px) {
      #editor-modal [data-energy-panel="report"] .ed-intro {
        margin-bottom: 10px !important;
        padding: 10px 11px !important;
        font-size: 10.5px !important;
        line-height: 1.4 !important;
      }

      #editor-modal [data-energy-panel="report"] [data-report-list] {
        display: grid !important;
        gap: 10px !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row {
        display: grid !important;
        grid-template-columns: auto minmax(0, 1fr) auto !important;
        grid-template-rows: auto auto !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 11px !important;
        border-radius: 15px !important;
        overflow: hidden !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > label:first-child {
        grid-column: 1 !important;
        grid-row: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        min-width: 0 !important;
        font-size: 10.5px !important;
        font-weight: 800 !important;
        white-space: nowrap !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-report-label] {
        grid-column: 2 !important;
        grid-row: 1 !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 38px !important;
        margin: 0 !important;
        padding: 8px 9px !important;
        font-size: 10.5px !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > span:not([data-icon-field]) {
        grid-column: 3 !important;
        grid-row: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 4px !important;
        min-width: 0 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > span:not([data-icon-field]) button {
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        padding: 0 !important;
        border-radius: 8px !important;
        font-size: 11px !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-icon-field] {
        grid-column: 1 !important;
        grid-row: 2 !important;
        display: grid !important;
        grid-template-columns: 42px 32px !important;
        gap: 5px !important;
        width: 79px !important;
        min-width: 79px !important;
        margin: 0 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-icon-field] input {
        width: 42px !important;
        min-width: 42px !important;
        min-height: 38px !important;
        margin: 0 !important;
        padding: 6px 3px !important;
        text-align: center !important;
        font-size: 15px !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-icon-field] button {
        width: 32px !important;
        min-width: 32px !important;
        min-height: 38px !important;
        padding: 0 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-entity-field] {
        grid-column: 2 / 4 !important;
        grid-row: 2 !important;
        min-width: 0 !important;
        width: 100% !important;
        margin: 0 !important;
        gap: 4px !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-entity-field] .ed-slot-lbl {
        font-size: 9.5px !important;
        line-height: 1.2 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-entity-field] .ed-form-row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 38px !important;
        gap: 6px !important;
        min-width: 0 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-entity-field] input {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 38px !important;
        margin: 0 !important;
        padding: 8px 9px !important;
        font-size: 10.5px !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-entity-field] .dm-entity-picker {
        width: 38px !important;
        min-width: 38px !important;
        min-height: 38px !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > input[type="hidden"] {
        display: none !important;
      }

      #editor-modal [data-energy-panel="report"] [data-report-add],
      #editor-modal [data-energy-panel="report"] [data-report-save] {
        min-height: 42px !important;
        font-size: 11px !important;
      }
    }

    @media (max-width: 390px) {
      #editor-modal [data-energy-panel="report"] .dm-report-row {
        grid-template-columns: 1fr auto !important;
        grid-template-rows: auto auto auto !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > label:first-child {
        grid-column: 1 !important;
        grid-row: 1 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > span:not([data-icon-field]) {
        grid-column: 2 !important;
        grid-row: 1 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-report-label] {
        grid-column: 1 / 3 !important;
        grid-row: 2 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-icon-field] {
        grid-column: 1 !important;
        grid-row: 3 !important;
      }

      #editor-modal [data-energy-panel="report"] .dm-report-row > [data-entity-field] {
        grid-column: 1 / 3 !important;
        grid-row: 4 !important;
      }
    }
  `;
  document.head.append(style);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installReportMobileFixes, { once: true });
  } else {
    installReportMobileFixes();
  }
}
