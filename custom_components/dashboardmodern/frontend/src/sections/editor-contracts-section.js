import {
  clean,
  doc,
  english,
  installStyle,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_CONTRACTS_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  observer: null,
  frame: 0,
});

function installExplicitReportSaveContract() {
  const store = root.DashboardModernModules?.store;
  const current = store?.saveReport;
  if (!store || typeof current !== "function" || current.__dmExplicitReportSave) return false;

  function explicitReportSave(items) {
    const existingById = new Map(
      [
        ...(this.getSection?.("appliances") || []),
        ...(this.getSection?.("loads") || []),
      ].map((item) => [item.id, item]),
    );
    const marked = (Array.isArray(items) ? items : []).map((item) => {
      const existing = existingById.get(item.id);
      const selected = clean(item.report_entity);
      const previous = clean(existing?.report_entity);
      const metadata = {
        ...(existing?.metadata || {}),
        ...(item.metadata || {}),
      };
      if (
        selected &&
        (existing?.metadata?.report_entity_explicit === true || !existing || selected !== previous)
      ) {
        metadata.report_entity_explicit = true;
      } else if (!selected) {
        delete metadata.report_entity_explicit;
      }
      return { ...item, metadata };
    });
    return current.call(this, marked);
  }

  explicitReportSave.__dmExplicitReportSave = true;
  explicitReportSave.__dmPrevious = current;
  store.saveReport = explicitReportSave;
  return true;
}

function normalizeReportManualPanel() {
  const panel = doc?.querySelector('#editor-modal [data-energy-panel="report"]');
  const button = panel?.querySelector("[data-report-add]");
  const form = panel?.querySelector("[data-report-manual]");
  if (!button || !form) return false;

  if (!form.id) form.id = `dm-report-manual-${Math.random().toString(36).slice(2, 9)}`;
  button.setAttribute("aria-controls", form.id);
  button.dataset.dmClosedLabel ||= clean(button.textContent);

  if (button.dataset.dmReportToggleBound !== "true") {
    button.dataset.dmReportToggleBound = "true";
    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        form.hidden = !form.hidden;
        const open = !form.hidden;
        button.setAttribute("aria-expanded", String(open));
        button.textContent = open
          ? english()
            ? "− Close manual entry"
            : "− Chiudi voce manuale"
          : button.dataset.dmClosedLabel;
        if (open) panel.querySelector("[data-manual-name]")?.focus();
      },
      true,
    );
  }

  if (!button.hasAttribute("aria-expanded")) {
    form.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
  const open = button.getAttribute("aria-expanded") === "true";
  form.hidden = !open;
  button.textContent = open
    ? english()
      ? "− Close manual entry"
      : "− Chiudi voce manuale"
    : button.dataset.dmClosedLabel;
  return true;
}

function synchronizeReportFields() {
  doc?.querySelectorAll('#editor-modal [data-energy-panel="report"] .dm-report-row').forEach((row) => {
    row.querySelectorAll("input,select,textarea").forEach((field) => {
      if (field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type)) {
        field.toggleAttribute("checked", field.checked);
      } else {
        field.setAttribute("value", field.value);
      }
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function normalizeLightEditCompatibility() {
  let changed = false;
  doc?.querySelectorAll('#editor-modal [data-light-entity] button[onclick^="dmOpenLightEditor"]').forEach((button) => {
    const entity = clean(button.closest("[data-light-entity]")?.dataset?.lightEntity);
    if (!entity) return;
    button.setAttribute("onclick", `cdLuceRen(${JSON.stringify(entity)})`);
    changed = true;
  });
  return changed;
}

function normalizeAlertsEditor() {
  if (doc?.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return false;
  root.__DASHBOARDMODERN_ALERTS_RUNTIME__?.apply?.();
  return true;
}

function normalizeTemperatureEditor() {
  const form = doc?.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return false;
  const submit = form.querySelector("[data-temperature-submit]");
  if (submit) {
    const label = english() ? "ASSOCIATE SENSORS" : "ASSOCIA SENSORI";
    if (clean(submit.textContent) !== label) submit.textContent = label;
    submit.classList.add("dm-temperature-submit");
  }
  return true;
}

function energyEditorActive() {
  const tab = clean(doc?.querySelector("#editor-modal .ed-tab.active")?.dataset?.tab).toLowerCase();
  return tab === "sez1" || tab === "energy";
}

function normalizeEnergyHelp() {
  const active = energyEditorActive();
  doc?.querySelectorAll("#editor-modal .dm-energy-help-compact").forEach((overview) => {
    overview.hidden = !active;
  });
  if (!active) return false;
  const overview = doc?.querySelector("#editor-modal .dm-energy-help-compact");
  if (overview) {
    const markup = t(
      "<strong>Storico consumi</strong><span>Seleziona i contatori totali kWh per Recorder e mesi precedenti; il consumo Casa viene riconciliato con i flussi come in Home Assistant.</span>",
      "<strong>Consumption history</strong><span>Select total kWh meters for Recorder and previous months; Home consumption is reconciled from flows like Home Assistant.</span>",
    );
    if (overview.innerHTML !== markup) overview.innerHTML = markup;
  }
  doc?.querySelectorAll("#editor-modal .dm-energy-total-note").forEach((note) => {
    const label = t("Totale kWh · total_increasing", "Total kWh · total_increasing");
    if (clean(note.textContent) !== label) note.textContent = label;
  });
  return Boolean(overview);
}

function removeBatteryGlyphs() {
  let changed = false;
  doc
    ?.querySelectorAll(
      "#page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card",
    )
    .forEach((card) => {
      const walker = doc.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        if (!node.nodeValue?.includes("🔋")) return;
        node.nodeValue = node.nodeValue.replaceAll("🔋", "").replace(/\s{2,}/g, " ");
        changed = true;
      });
    });
  return changed;
}

export function applyEditorContracts() {
  installExplicitReportSaveContract();
  normalizeReportManualPanel();
  normalizeLightEditCompatibility();
  normalizeAlertsEditor();
  normalizeTemperatureEditor();
  normalizeEnergyHelp();
  removeBatteryGlyphs();
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    applyEditorContracts();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installStyles() {
  installStyle(
    "dm-editor-contracts-style",
    `
      #editor-modal[data-dm-editor-theme="dark"] .ed-shell{
        background:var(--card-bg,#161f36)!important;color:var(--text,#e6edf7)!important
      }
      #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,
      #editor-modal[data-dm-editor-theme="dark"] .dm-report-row{
        background:var(--surface-2,#1b2540)!important
      }
      #editor-modal[data-dm-editor-theme="dark"] .ed-input,
      #editor-modal[data-dm-editor-theme="dark"] input,
      #editor-modal[data-dm-editor-theme="dark"] select,
      #editor-modal[data-dm-editor-theme="dark"] textarea{
        background:var(--surface-3,#212d4c)!important;color:var(--text,#e6edf7)!important;
        border-color:var(--card-border,#263453)!important
      }
      #editor-modal[data-dm-editor-theme="dark"] .ed-slot-lbl{
        color:var(--text-dim,#92a4c2)!important
      }
      #editor-modal [data-energy-panel="report"] [data-report-manual][hidden]{display:none!important}
      #editor-modal [data-energy-panel="report"] [data-report-manual]:not([hidden]){
        display:grid!important;gap:10px!important;margin-top:10px!important
      }
      #editor-modal .dm-energy-help-compact[hidden]{display:none!important}
      #editor-modal .dm-energy-help-compact{
        display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;align-items:center!important;
        gap:8px 12px!important;margin:0 0 12px!important;padding:10px 12px!important;border-radius:14px!important;
        background:color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 8%,transparent)!important;
        color:var(--primary-text-color,var(--text,#0f172a))!important
      }
      #editor-modal .dm-energy-help-compact strong{white-space:nowrap!important}
      #editor-modal .dm-energy-help-compact span{color:var(--secondary-text-color,var(--text-dim,#64748b))!important;font-size:12px!important;line-height:1.35!important}
      #editor-modal .dm-energy-total-note{display:block!important;margin-top:4px!important;font-size:10px!important;line-height:1.2!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}

      /* One modal contract for Appliances, Alerts, Actions, Climate, Shutters and Rooms. */
      .dm-section-modal{position:fixed!important;inset:0!important;z-index:100040!important;display:grid!important;place-items:center!important;padding:16px!important;background:rgba(15,23,42,.58)!important;backdrop-filter:blur(5px)!important}
      .dm-section-modal .dm-section-dialog{box-sizing:border-box!important;width:min(880px,calc(100vw - 24px))!important;max-height:min(92dvh,920px)!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;overflow:hidden!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:26px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--primary-text-color,var(--text,#0f172a))!important;box-shadow:0 28px 80px rgba(15,23,42,.3)!important}
      .dm-section-modal .dm-section-dialog>header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;padding:18px 22px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important;font-size:18px!important}
      .dm-section-modal .dm-section-dialog>header [data-close]{display:grid!important;place-items:center!important;width:42px!important;height:42px!important;border:0!important;border-radius:50%!important;background:var(--secondary-background-color,#f1f5f9)!important;color:var(--secondary-text-color,#64748b)!important;font-size:20px!important;cursor:pointer!important}
      .dm-section-modal .dm-section-dialog>form{box-sizing:border-box!important;min-height:0!important;overflow:auto!important;display:grid!important;align-content:start!important;gap:14px!important;padding:20px 22px 0!important}
      .dm-section-modal .dm-section-dialog .ed-slot{display:grid!important;gap:6px!important;min-width:0!important}
      .dm-section-modal .dm-section-dialog .ed-slot-lbl{font-size:12px!important;font-weight:800!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-section-modal .dm-section-dialog .ed-form-row{display:grid!important;grid-template-columns:minmax(0,1fr) 48px!important;gap:10px!important;align-items:center!important}
      .dm-section-modal .dm-section-dialog .ed-input{box-sizing:border-box!important;width:100%!important;min-height:48px!important;padding:10px 14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:13px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:inherit!important}
      .dm-section-modal .dm-section-dialog .dm-entity-picker{min-width:48px!important;height:48px!important;border:0!important;border-radius:13px!important;background:var(--primary-color,#0284c7)!important;color:#fff!important;cursor:pointer!important}
      .dm-section-modal .dm-section-dialog>form>footer{position:sticky!important;bottom:0!important;z-index:2!important;display:flex!important;justify-content:flex-end!important;gap:10px!important;margin:2px -22px 0!important;padding:14px 22px 18px!important;border-top:1px solid var(--divider-color,#e2e8f0)!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      .dm-section-modal .dm-section-dialog>form>footer button{min-height:44px!important;padding:10px 16px!important;border:0!important;border-radius:12px!important;font-weight:900!important;cursor:pointer!important}
      .dm-section-modal .dm-section-dialog>form>footer .ed-save-btn{background:var(--success-color,#059669)!important;color:#fff!important}
      #dm-appliance-editor-modal .dm-appliance-editor-dialog{overflow:hidden!important}

      #page-appliances-main .appl-wide-card .appl-wide-stat,
      #appl-grid-overview .appl-wide-card .appl-wide-stat,
      #page-appliances-main .appl-wide-card .appl-energy,
      #appl-grid-overview .appl-wide-card .appl-energy,
      #page-appliances-main .appl-wide-card .appl-kwh,
      #appl-grid-overview .appl-wide-card .appl-kwh{
        color:var(--primary-text-color,var(--text,#0f172a))!important;opacity:1!important
      }
      #page-appliances-main .appl-wide-status,#appl-grid-overview .appl-wide-status,
      #page-appliances-main .appl-status,#appl-grid-overview .appl-status{
        align-self:center!important;vertical-align:middle!important
      }
      @media(max-width:620px){
        #editor-modal .dm-energy-help-compact{grid-template-columns:1fr!important}
        .dm-section-modal{padding:0!important;place-items:stretch!important}.dm-section-modal .dm-section-dialog{width:100%!important;max-height:100dvh!important;height:100dvh!important;border-radius:0!important}.dm-section-modal .dm-section-dialog>form{padding-left:16px!important;padding-right:16px!important}.dm-section-modal .dm-section-dialog>form>footer{margin-left:-16px!important;margin-right:-16px!important;padding-left:16px!important;padding-right:16px!important}
      }
    `,
  );
}

function mutationTouchesEditor(records = []) {
  return records.some((record) => {
    const target = record.target;
    if (target?.nodeType === 1 && target.closest?.("#editor-modal,.dm-section-modal")) return true;
    return [...(record.addedNodes || []), ...(record.removedNodes || [])].some((node) => {
      if (node?.nodeType !== 1) return false;
      return node.matches?.("#editor-modal,.dm-section-modal") || node.querySelector?.("#editor-modal,.dm-section-modal");
    });
  });
}

function installObserver() {
  if (!doc || state.observer || typeof root.MutationObserver !== "function") return;
  state.observer = new root.MutationObserver((records) => {
    if (mutationTouchesEditor(records)) schedule();
  });
  state.observer.observe(doc.body, { childList: true, subtree: true });
}

export function installEditorContractsSection() {
  if (!doc) return;
  installStyles();
  installObserver();
  schedule();
  if (!state.installed) {
    state.installed = true;
    for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow"]) {
      root.addEventListener?.(event, schedule);
    }
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("[data-report-save]")) synchronizeReportFields();
        if (event.target?.closest?.("#editor-modal,.dm-section-modal")) schedule();
      },
      true,
    );
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEditorContractsSection, { once: true });
else installEditorContractsSection();
