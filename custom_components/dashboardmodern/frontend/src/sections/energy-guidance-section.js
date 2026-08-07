import { clean, doc, english, installStyle, root, section, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_GUIDANCE_SECTION__";
const state = (root[KEY] ||= { installed: false, listeners: false });

function entity(group, key) {
  return clean(section("energy", {})?.[group]?.[key]);
}

function sourceText(group, periodKey, totalKey) {
  const explicit = entity(group, periodKey);
  const total = entity(group, totalKey);
  if (explicit) return explicit;
  if (total) return `${total} · ${t("calcolato da Recorder", "calculated from Recorder")}`;
  return t("Non configurato", "Not configured");
}

function groupContract(group) {
  const totalKey = group === "grid" ? "total_import_energy" : "total_energy";
  return {
    day: sourceText(group, group === "grid" ? "daily_import_energy" : "daily_energy", totalKey),
    month: sourceText(group, group === "grid" ? "monthly_import_energy" : "monthly_energy", totalKey),
    year: sourceText(group, group === "grid" ? "annual_import_energy" : "annual_energy", totalKey),
    history: entity(group, totalKey) || t("Serve un contatore totale kWh", "A total kWh meter is required"),
  };
}

function contractCard(group, title, icon) {
  const contract = groupContract(group);
  return `<article class="dm-energy-source-contract" data-energy-source-group="${group}">
    <header><span>${icon}</span><strong>${title}</strong></header>
    <dl>
      <div><dt>${t("Giorno", "Day")}</dt><dd>${contract.day}</dd></div>
      <div><dt>${t("Mese", "Month")}</dt><dd>${contract.month}</dd></div>
      <div><dt>${t("Anno", "Year")}</dt><dd>${contract.year}</dd></div>
      <div><dt>${t("Report e mesi precedenti", "Report and previous months")}</dt><dd>${contract.history}</dd></div>
    </dl>
  </article>`;
}

function energyEditorActive() {
  const active = doc?.querySelector("#editor-modal .ed-tab.active");
  const tab = clean(active?.dataset?.tab).toLowerCase();
  return tab === "sez1" || tab === "energy";
}

function removeEnergyGuidance() {
  doc?.querySelectorAll("#editor-modal .dm-energy-source-guide").forEach((node) => node.remove());
}

export function normalizeEnergyGuidance() {
  if (!energyEditorActive()) {
    removeEnergyGuidance();
    return false;
  }
  const editor = doc?.querySelector('#editor-modal [data-editor="energy"],#ed-body[data-editor="energy"]');
  if (!editor) return false;
  const flows = editor.querySelector('[data-energy-panel="flows"]') || editor;
  let guide = flows.querySelector(".dm-energy-source-guide");
  if (!guide) {
    guide = doc.createElement("section");
    guide.className = "dm-energy-source-guide";
    flows.prepend(guide);
  }
  guide.innerHTML = `<div class="dm-energy-source-guide-intro">
    <strong>${t("Quale entità usa la dashboard", "Which entity the dashboard uses")}</strong>
    <span>${t(
      "Quando Fotovoltaico e Rete sono configurati, il consumo Casa usa lo stesso bilancio dei flussi di Home Assistant. I contatori totali kWh servono anche per Recorder, storico e mesi precedenti; i campi giornaliero, mensile e annuale restano override facoltativi del singolo periodo.",
      "When Solar and Grid are configured, Home consumption uses the same flow balance as Home Assistant. Total kWh meters also feed Recorder, history and previous months; daily, monthly and annual fields remain optional per-period overrides.",
    )}</span>
  </div><div class="dm-energy-source-guide-grid">
    ${contractCard("house", t("Casa (fallback)", "Home (fallback)"), "🏠")}
    ${contractCard("solar", t("Fotovoltaico", "Solar"), "☀️")}
    ${contractCard("grid", t("Rete prelevata", "Grid import"), "🔌")}
  </div>`;

  editor.querySelectorAll(".dm-energy-total-field").forEach((field) => {
    let purpose = field.querySelector(".dm-energy-total-purpose");
    if (!purpose) {
      purpose = doc.createElement("strong");
      purpose.className = "dm-energy-total-purpose";
      field.append(purpose);
    }
    purpose.textContent = t(
      "Usata per Recorder, storico e mesi precedenti quando non esiste un sensore specifico del periodo.",
      "Used for Recorder, history and previous months when no period-specific sensor exists.",
    );
  });
  return true;
}

function installStyles() {
  installStyle(
    "dm-energy-guidance-section-style",
    `
      #editor-modal .dm-energy-source-guide{display:grid!important;gap:12px!important;margin:0 0 16px!important}
      #editor-modal .dm-energy-source-guide-intro{display:grid!important;gap:6px!important;padding:14px 16px!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 28%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 9%,var(--ha-card-background,#fff))!important;line-height:1.45!important}
      #editor-modal .dm-energy-source-guide-intro strong{font-size:14px!important}.dm-energy-source-guide-intro span{color:var(--secondary-text-color,#64748b)!important;font-size:12px!important}
      #editor-modal .dm-energy-source-guide-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
      #editor-modal .dm-energy-source-contract{min-width:0!important;padding:12px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:14px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      #editor-modal .dm-energy-source-contract header{display:flex!important;align-items:center!important;gap:8px!important;margin-bottom:8px!important}.dm-energy-source-contract dl{display:grid!important;gap:7px!important;margin:0!important}.dm-energy-source-contract dl>div{display:grid!important;gap:2px!important}.dm-energy-source-contract dt{font-size:10px!important;font-weight:900!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}.dm-energy-source-contract dd{min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;font-size:10px!important;color:var(--primary-text-color,#0f172a)!important}
      #editor-modal .dm-energy-total-purpose{display:block!important;margin-top:7px!important;color:var(--info-color,#0369a1)!important;font-size:11px!important;line-height:1.35!important}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-source-guide-intro,#editor-modal[data-dm-editor-theme="dark"] .dm-energy-source-contract{background:var(--dm-editor-panel,#1b2540)!important;border-color:var(--dm-editor-border,#31405f)!important}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-source-contract dd{color:var(--dm-editor-text,#edf4ff)!important}
      @media(max-width:820px){#editor-modal .dm-energy-source-guide-grid{grid-template-columns:1fr!important}}
    `,
  );
}

export function installEnergyGuidanceSection() {
  if (!doc) return;
  installStyles();
  wrapFunction("editorSwitch", "__dmEnergyGuidanceSection", normalizeEnergyGuidance);
  normalizeEnergyGuidance();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("#editor-modal .ed-tab,#editor-modal [data-energy-tab],#editor-modal .sub-tab-btn"))
          root.queueMicrotask?.(normalizeEnergyGuidance);
      },
      true,
    );
    root.addEventListener?.("dashboardmodern:legacy-ready", normalizeEnergyGuidance);
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyGuidanceSection, { once: true });
else installEnergyGuidanceSection();
