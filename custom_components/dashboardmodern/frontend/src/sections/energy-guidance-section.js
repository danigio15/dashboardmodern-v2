import { clean, dashboardStore, doc, energyPeriodConflicts, english, esc, installStyle, onEditorRedraw, root, section, t, wrapFunction } from "./shared.js";
import { scriviNellImpianto } from "../core/energy-writer.js";
import { plantModel } from "../core/energy-plants.js";
import { impiantoScelto } from "./energy-section.js";

globalThis.__DM_20260815C__ = true;
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

const CLASH_LABELS = Object.freeze({
  "house:total_energy": ["Casa", "Home"],
  "solar:total_energy": ["Fotovoltaico", "Solar"],
  "grid:total_import_energy": ["Rete prelevata", "Grid import"],
  "grid:total_export_energy": ["Rete immessa", "Grid export"],
  "battery:total_charged_energy": ["Batteria caricata", "Battery charged"],
  "battery:total_discharged_energy": ["Batteria scaricata", "Battery discharged"],
});

const PERIOD_ORDER = Object.freeze(["daily", "monthly", "annual"]);

function periodLabel(key) {
  if (key.startsWith("daily")) return t("Giornaliera", "Daily");
  if (key.startsWith("monthly")) return t("Mensile", "Monthly");
  return t("Annuale", "Annual");
}

/* La configurazione com'e' stata scritta, non come viene letta.
 *
 * section("energy") passa dal filtro che toglie i campi di periodo quando c'e'
 * un totale: leggerla qui mostrerebbe una maschera gia' pulita e non ci sarebbe
 * piu' niente da segnalare. L'avviso deve nascere dai valori grezzi.
 *
 * Grezzi si', ma dell'impianto che si sta guardando. Il salvataggio tiene la
 * prima casa al primo livello e le altre in un elenco: leggere solo il primo
 * livello voleva dire segnalare i conflitti della casa numero uno anche a chi
 * aveva davanti la seconda — e poi svuotare i campi della seconda, che non
 * erano quelli elencati. Chi legge e chi scrive adesso guardano lo stesso
 * impianto. */
function configuredEnergy() {
  const store = dashboardStore();
  try {
    const grezzo = store?.peekSection?.("energy") ?? store?.getSection?.("energy") ?? {};
    return plantModel(grezzo, impiantoScelto());
  } catch (_error) {
    return {};
  }
}

function energyClashes() {
  try {
    return energyPeriodConflicts(configuredEnergy());
  } catch (_error) {
    return [];
  }
}

function clashNotice(clashes) {
  if (!clashes.length) return "";
  const rows = clashes
    .map((clash) => {
      const label = CLASH_LABELS[`${clash.group}:${clash.totalKey}`] || [clash.group, clash.group];
      const ignored = clash.ignored
        .slice()
        .sort(
          (left, right) =>
            PERIOD_ORDER.findIndex((name) => left.key.startsWith(name)) -
            PERIOD_ORDER.findIndex((name) => right.key.startsWith(name)),
        )
        .map((field) => `${esc(periodLabel(field.key))} <code>${esc(field.entity)}</code>`)
        .join(", ");
      return `<li><strong>${esc(t(label[0], label[1]))}</strong> — ${t("legge", "reads")} <code>${esc(
        clash.total,
      )}</code>; ${t("ignora", "ignores")} ${ignored}</li>`;
    })
    .join("");
  return `<div class="dm-energy-source-clash" role="status">
    <strong>${t(
      "Il contatore totale comanda: questi campi non vengono letti",
      "The total meter wins: these fields are not read",
    )}</strong>
    <span>${t(
      "Con un contatore totale configurato la dashboard ricava giorno, mese e anno da quello con Recorder, cosi' i numeri restano coerenti tra loro. Le entita' scritte nei campi di periodo restano salvate ma non vengono usate: svuotale, oppure togli il contatore totale se preferisci leggere i periodi direttamente.",
      "With a total meter configured the dashboard derives day, month and year from it through Recorder, so the numbers agree with each other. Entities written in the period fields stay saved but are not used: clear them, or remove the total meter if you would rather read the periods directly.",
    )}</span>
    <ul>${rows}</ul>
    <button type="button" class="dm-energy-clash-clear">${t(
      "Svuota i campi di periodo",
      "Clear the period fields",
    )}</button>
  </div>`;
}

async function clearClashingPeriods() {
  const store = dashboardStore();
  if (!store?.getSection || !store?.replaceSection) return false;
  const clashes = energyClashes();
  if (!clashes.length) return false;
  /* Si svuota l'impianto APERTO, non sempre il primo.
   *
   * Qui si scriveva al primo livello dell'oggetto salvato, che e' la casa
   * numero uno: chi guardava la seconda e premeva «Svuota i campi di periodo»
   * si vedeva sparire i campi dell'altra, senza che quelli davanti a lui
   * cambiassero di una virgola. Il posatore e' lo stesso che usa il
   * salvataggio dei campi: uno solo sa dove va una scrittura. */
  const model = scriviNellImpianto(
    structuredClone(store.getSection("energy") || {}),
    impiantoScelto(),
    (bersaglio) => {
      for (const clash of clashes) {
        bersaglio[clash.group] = { ...(bersaglio[clash.group] || {}) };
        for (const field of clash.ignored) bersaglio[clash.group][field.key] = "";
      }
    },
  );
  await store.replaceSection("energy", model);
  root.toast?.(t("Campi di periodo svuotati", "Period fields cleared"));
  normalizeEnergyGuidance();
  return true;
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
      "Quando Fotovoltaico e Rete sono configurati, il consumo Casa usa lo stesso bilancio dei flussi di Home Assistant. Il contatore totale kWh comanda: se c'è, giorno, mese e anno si ricavano da quello con Recorder e i campi di periodo non vengono letti. I campi giornaliero, mensile e annuale servono quando un contatore totale non esiste.",
      "When Solar and Grid are configured, Home consumption uses the same flow balance as Home Assistant. The total kWh meter wins: when one is set, day, month and year are derived from it through Recorder and the period fields are not read. The daily, monthly and annual fields are for when no total meter exists.",
    )}</span>
  </div>${clashNotice(energyClashes())}<div class="dm-energy-source-guide-grid">
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
      "Comanda su tutto: giorno, mese, anno, storico e mesi precedenti si ricavano da qui con Recorder. Con questo campo pieno i campi di periodo non vengono letti.",
      "This one wins: day, month, year, history and previous months are all derived from here through Recorder. While it is set, the period fields are not read.",
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
      #editor-modal .dm-energy-source-contract header{display:flex!important;align-items:center!important;gap:8px!important;margin-bottom:8px!important}.dm-energy-source-contract dl{display:grid!important;gap:7px!important;margin:0!important}.dm-energy-source-contract dl>div{display:grid!important;gap:2px!important}.dm-energy-source-contract dt{font-size:10px!important;font-weight:900!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}.dm-energy-source-contract dd{min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;font-size:10px!important;color:var(--text,#0f172a)!important}
      #editor-modal .dm-energy-source-clash{display:grid!important;gap:8px!important;padding:14px 16px!important;border:1px solid color-mix(in srgb,var(--warning-color,#f59e0b) 45%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--warning-color,#f59e0b) 12%,var(--ha-card-background,#fff))!important;line-height:1.45!important}
      #editor-modal .dm-energy-source-clash strong{font-size:14px!important;color:var(--text,#0f172a)!important}
      #editor-modal .dm-energy-source-clash>span{color:var(--secondary-text-color,#64748b)!important;font-size:12px!important}
      #editor-modal .dm-energy-source-clash ul{display:grid!important;gap:4px!important;margin:0!important;padding:0 0 0 18px!important;font-size:12px!important;color:var(--text,#0f172a)!important}
      #editor-modal .dm-energy-source-clash code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace!important;font-size:11px!important;word-break:break-all!important}
      #editor-modal .dm-energy-clash-clear{justify-self:start!important;padding:8px 14px!important;border:0!important;border-radius:999px!important;background:var(--warning-color,#f59e0b)!important;color:#3b2600!important;font-weight:800!important;font-size:12px!important;cursor:pointer!important}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-source-clash{background:var(--dm-editor-panel,#1b2540)!important;border-color:color-mix(in srgb,var(--warning-color,#f59e0b) 55%,var(--dm-editor-border,#31405f))!important}
      #editor-modal[data-dm-editor-theme="dark"] .dm-energy-source-clash strong,#editor-modal[data-dm-editor-theme="dark"] .dm-energy-source-clash ul{color:var(--dm-editor-text,#edf4ff)!important}
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
  onEditorRedraw("__dmEnergyGuidanceSection", normalizeEnergyGuidance);
  normalizeEnergyGuidance();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("#editor-modal .dm-energy-clash-clear")) {
          event.preventDefault();
          clearClashingPeriods();
          return;
        }
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
