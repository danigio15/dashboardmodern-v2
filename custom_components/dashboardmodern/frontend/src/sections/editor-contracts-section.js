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

function normalizeReportManualPanel() {
  const panel = doc?.querySelector('#editor-modal [data-energy-panel="report"]');
  const button = panel?.querySelector("[data-report-add]");
  const form = panel?.querySelector("[data-report-manual]");
  if (!button || !form) return false;

  if (button.dataset.dmReportToggleBound !== "true") {
    button.dataset.dmReportToggleBound = "true";
    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const next = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(next));
        form.hidden = !next;
      },
      true,
    );
  }
  if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
  form.hidden = button.getAttribute("aria-expanded") !== "true";
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

function normalizeEnergyHelp() {
  const overview = doc?.querySelector("#editor-modal .dm-energy-help-compact");
  if (overview) {
    const markup = t(
      "<strong>Storico consumi</strong><span>Seleziona il contatore totale kWh per calcolare anche i mesi precedenti.</span>",
      "<strong>Consumption history</strong><span>Select the total kWh meter to calculate previous months too.</span>",
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
  normalizeReportManualPanel();
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
      #editor-modal [data-report-manual][hidden]{display:none!important}
      #editor-modal .dm-energy-help-compact{
        display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;align-items:center!important;
        gap:8px 12px!important;margin:0 0 12px!important;padding:10px 12px!important;border-radius:14px!important;
        background:color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 8%,transparent)!important;
        color:var(--primary-text-color,var(--text,#0f172a))!important
      }
      #editor-modal .dm-energy-help-compact strong{white-space:nowrap!important}
      #editor-modal .dm-energy-help-compact span{color:var(--secondary-text-color,var(--text-dim,#64748b))!important;font-size:12px!important;line-height:1.35!important}
      #editor-modal .dm-energy-total-note{display:block!important;margin-top:4px!important;font-size:10px!important;line-height:1.2!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
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
      }
    `,
  );
}

function installObserver() {
  if (!doc || state.observer || typeof root.MutationObserver !== "function") return;
  state.observer = new root.MutationObserver(schedule);
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
    doc.addEventListener("click", schedule, true);
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEditorContractsSection, { once: true });
else installEditorContractsSection();
