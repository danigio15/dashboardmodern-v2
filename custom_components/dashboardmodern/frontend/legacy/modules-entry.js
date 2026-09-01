// DM-FIX-20260815A
/* Canonical runtime helpers consumed directly by both vendored dashboards. */
import {
  applianceGroups,
  applianceEnergyReport,
  applianceMedia,
  applianceName,
  applianceRoomId,
  applianceState,
  controllableEntity,
  normalizeCamera,
  normalizeCameras,
  normalizeRooms,
  isConfiguredRoom,
  removeCamera,
  saveCamera,
  stableRoomId,
} from "../src/legacy/dashboard-data.js";
import { runSteps, stepReporter } from "../src/core/runtime-steps.js";
import { DashboardStore } from "../src/core/dashboard-store.js";
import { daProvare, diagnosi, siSveglia, strategieDellaTelecamera } from "../src/core/strategie-telecamera.js";
import { renderPreseEditor } from "../src/sections/prese-section.js";
import { getDeviceDisplayName, getDeviceVisual, normalizeDevice } from "../src/core/device-model.js";
import { createEnergyReportRows, createEntityPickerField, createRenderCoordinator, loadPopupMetrics, renderDeviceCard, renderEnergyEditor } from "../src/core/renderers.js";
import { energyWriteInFlight, flushEnergyWrites, persistEnergyField, persistSignedSource } from "../src/core/energy-writer.js";
import { IMPIANTO_SCELTO_KEY, plantModel } from "../src/core/energy-plants.js";
import { SCHEMA_VERSION } from "../src/core/device-model.js";
import { BUILD_INFO } from "./build-info.js";
import { getLocale, pick } from "../src/core/i18n.js";
import { canonicalReportDevices, reportEntityForDevice, reportIconForDevice } from "../src/core/energy-projection.js";

export const MODULES_VERSION = 14;
/*
 * The copy this entry point owns, authored as [Italian, English] pairs.
 *
 * It used to be two parallel objects picked by a `lang === "en"` test, which
 * meant a French user read Italian. The pairs feed `pick()` instead, so the
 * English side is the catalog key and any locale with a catalog gets its own
 * words. The shape is also what `scripts/extract-i18n-keys.mjs` reads, so
 * these strings are part of the corpus the catalogs are held to.
 */
const COPY_SOURCE = Object.freeze({
  optional: ["Facoltativo", "Optional"],
  select: ["Seleziona", "Select"],
  saveReport: ["Salva Report", "Save Report"],
  saved: ["Report salvato", "Report saved"],
  energySaved: ["Energia salvata", "Energy saved"],
  dirty: ["Modifiche non salvate", "Unsaved changes"],
  saving: ["Salvataggio…", "Saving…"],
  addManual: ["Aggiungi voce manuale", "Add manual entry"],
  empty: ["Nessun elemento configurato.", "No configured items."],
  reportIntro: ["Seleziona e ordina il Report senza modificare l'ordine della dashboard.", "Select and order Report entries without changing dashboard order."],
  reportLabel: ["Etichetta", "Label"],
  reportEntity: ["Entità Report", "Report entity"],
  history: ["Storico", "History"],
  name: ["Nome", "Name"],
  entity: ["Entità", "Entity"],
  add: ["Aggiungi", "Add"],
  required: ["Nome ed entità sono obbligatori", "Name and entity are required"],
  moveUp: ["Sposta su", "Move up"],
  moveDown: ["Sposta giù", "Move down"],
  remove: ["Elimina", "Delete"],
  energyCost: ["Costo energia", "Energy cost"],
  energyRates: ["Tariffe usate dal Report Energia.", "Rates used by the Energy Report."],
  saveCosts: ["Salva costi", "Save costs"],
  rateNumber: ["Numero", "Number"],
  rateEntity: ["Entità", "Entity"],
  rateAutoNote: ["si aggiorna da solo", "updates by itself"],
  ratePickHint: ["Scegli l'entità del prezzo: il valore si aggiornerà da solo.", "Pick the price entity: the value will update by itself."],
  loadsIntro: ["Carichi e Report condividono il modello canonico senza duplicati.", "Loads and Report share the canonical model without duplicates."],
  appliances: ["Elettrodomestici / dispositivi", "Appliances / devices"],
  secondaryLoads: ["Carichi secondari", "Secondary loads"],
  noLoads: ["Nessun carico configurato", "No configured loads"],
  editLoad: ["Modifica carico", "Edit load"],
  newLoad: ["Nuovo carico", "New load"],
  visibleReport: ["Visibile nel report", "Visible in Report"],
  visibleDashboard: ["Visibile nella dashboard", "Visible on dashboard"],
  addLoad: ["Aggiungi carico", "Add load"],
  saveChanges: ["Salva modifiche", "Save changes"],
  powerEntity: ["Entità potenza", "Power entity"],
  dailyEnergy: ["Energia giornaliera", "Daily energy"],
  monthlyEnergy: ["Energia mensile", "Monthly energy"],
  totalEnergy: ["Energia totale", "Total energy"],
  state: ["Stato", "State"],
  control: ["Comando ON/OFF", "On/off control"],
  diagnostics: ["Diagnostica runtime", "Runtime diagnostics"],
  languageVariant: ["Lingua / variante", "Language / variant"],
  activeRenderer: ["Renderer attivo", "Active renderer"],
  loadNameRequired: ["Inserisci il nome del carico", "Enter a load name"],
  energySaveFailed: ["Salvataggio Energia fallito", "Energy save failed"],
  coolingTitle: ["Temperature e raffreddamento", "Temperatures & cooling"],
  coolingHint: ["Sensori della scheda Temperature di Energia: inverter, batteria e ventola. Ogni campo si salva appena lo cambi.", "Sensors for the Energy Temperatures tab: inverter, battery and fan. Every field saves as soon as you change it."],
  coolingAcTemp: ["Temperatura inverter AC", "Inverter AC temperature"],
  coolingDcTemp: ["Temperatura inverter DC", "Inverter DC temperature"],
  coolingBatTemp: ["Temperatura batteria", "Battery temperature"],
  coolingFanPower: ["Potenza ventola", "Fan power"],
  coolingFanSwitch: ["Interruttore ventola", "Fan switch"],
});
const t = (key) => {
  const entry = COPY_SOURCE[key];
  return entry ? pick(entry[0], entry[1]) : key;
};

const store = new DashboardStore({
  sync: async () => {
    globalThis.cdMarkDirty?.();
    return globalThis.cdSyncPush?.();
  },
  onStatus: (status) => globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:status", { detail: status })),
});
store.migrate();
store.installLegacyWriteBridge();
const applyRuntimeProjection = () =>
  globalThis.cdApplyCanonicalOverrides?.(store.getSection("entityOverrides"));
applyRuntimeProjection();
store.subscribe((change) => {
  if (change.status === "optimistic" || change.status === "rollback") applyRuntimeProjection();
});

// The vendored UI keeps its established markup/CSS. This is the single bridge
// that translates canonical store changes into its existing partial renderers.
createRenderCoordinator(store, {
  renderSection(section) {
    if (section === "appliances") {
      globalThis.renderAppliances?.(); globalThis.renderApplianceSection?.(true);
    } else if (section === "cameras") {
      const grid = globalThis.document?.getElementById?.("cam-grid"); if (grid) grid._sig = "";
      globalThis.buildCamCards?.(); globalThis.refreshCameras?.();
    } else if (section === "rooms") {
      globalThis.buildTempCards?.(); globalThis.renderTemperature?.();
    }
  },
  renderEnergyReport() {
    globalThis.cdRebuildReportDevices?.();
    globalThis.buildReportSelect?.();
  },
  renderNavbar() { globalThis.cdApplyNavVis?.(); },
  renderRoomSelectors() { globalThis.cdFillRoomSelects?.(); },
  renderCurrentEditor(section) {
    const tab = globalThis.document?.querySelector?.(".ed-tab.active")?.dataset?.tab;
    const sectionTabs = {
      appliances: "appliances", loads: "sez1", report: "sez1", energy: "sez1", cameras: "sezioni", rooms: "stanze",
      ev: "sezioni", lights: "luci", climate: "sezioni", covers: "tapp",
      pool: "pool", irrigation: "irr",
    };
    const expected = section === "rooms" && tab === "sez7" ? "sez7" : sectionTabs[section];
    const matches = expected === tab || (expected === "sezioni" && tab?.startsWith("sez"));
    if (!globalThis.document?.getElementById?.("ed-body") || !matches) return;
    // Re-render the active body directly; editorSwitch is navigation and was
    // the accidental refresh mechanism that left confirmed deletes visible.
    const body = globalThis.document.getElementById("ed-body");
    if (tab === "sez7" && section === "rooms") {
      renderEditorTab("sez7", body);
      return;
    }
    if (tab === "sez1" && section === "energy") {
      // Il cambio che arriva dalla maschera stessa non la ridisegna: sarebbe
      // cancellare il campo che si sta compilando mentre lo si compila.
      if (!energyWriteInFlight()) renderEditorTab("sez1", body);
      return;
    }
    if (tab === "sez1" && section === "loads") {
      const panel = body.querySelector('[data-energy-panel="loads"]');
      if (panel) { mountLoadsEditor(panel); mountCurrentEditor("loads", panel); panel.hidden = false; }
      return;
    }
    if (tab === "sez1" && section === "report") {
      const panel = body.querySelector('[data-energy-panel="report"]');
      if (panel) { renderReportEditor(panel); mountReportEditor("report", panel); panel.hidden = false; }
      return;
    }
    if (tab === "appliances") {
      body.innerHTML = globalThis.cdSecToggleHtml("appliances") + globalThis.editorRenderAppliances() + '<button class="ed-btn-add" style="width:100%; margin-top:10px;" onclick="edSecSave()">💾 Salva sezione</button>';
      globalThis.edApplRenderEnts?.();
    } else if (tab === "load") mountLoadsEditor(body);
    else if (tab === "stanze") body.innerHTML = globalThis.editorRenderStanze();
    else if (tab === "luci") body.innerHTML = globalThis.editorRenderLuci();
    else if (tab === "tapp") body.innerHTML = globalThis.cdSecToggleHtml("tapparelle") + globalThis.editorRenderTapparelle();
    else if (tab === "pool") body.innerHTML = globalThis.cdSecToggleHtml("piscina") + globalThis.editorRenderPiscina();
    else if (tab === "irr") body.innerHTML = globalThis.cdSecToggleHtml("irrigazione") + globalThis.editorRenderIrrigazione();
    else if (tab?.startsWith("sez") && tab !== "sezioni" && tab !== "sez1") {
      body.innerHTML = globalThis.editorRenderSezioni();
      globalThis.edFilterSez?.(body, Number(tab.slice(3)));
    }
    mountCurrentEditor(tab, body);
  },
  renderDropdowns() { globalThis.cdFillRoomSelects?.(); },
  renderDashboard() { globalThis.render?.(); },
});

let activeEnergyPanel = "flows";
/* L'impianto che si sta configurando: la maschera mostra I SUOI campi e ogni
 * scrittura torna a lui. Senza, il secondo impianto era una quinta di teatro:
 * la scheda mostrava le entita' del primo, e quello che si scriveva finiva
 * addosso al primo — «ho configurato due impianti ma non legge i dati il
 * secondo». Con un impianto solo esce la stringa vuota, cioe' il primo, cioe'
 * esattamente com'era prima. */
const impiantoAperto = () => String(globalThis.localStorage?.getItem(IMPIANTO_SCELTO_KEY) ?? "").trim();
function renderEnergyEditorTab(target) {
  const model = plantModel(store.getSection("energy"), impiantoAperto());
  renderEnergyEditor(globalThis.document, target, model, store.getSection("appliances"), globalThis.STATES || {},
    getLocale(),
    {
      onPick: (input) => globalThis.wzPickEntity?.(input),
      renderLoads: (loads) => { if (renderLoadsPanel(loads)) return; mountLoadsEditor(loads); mountCurrentEditor("loads", loads); },
      renderReport: (report) => { renderReportEditor(report); mountReportEditor("report", report); },
      renderSettings: (settings) => {
        /* Il prezzo di acquisto puo' venire da un'entita' (#217): il
         * segmentato Numero | Entita' sceglie la sorgente. La scelta abita
         * nel modello energia canonico — sopravvive alla normalizzazione — e
         * il salvataggio resta quello di sempre: edSaveCosti, che oggi e' il
         * padrone canonico delle tariffe. */
        const entitaPrezzo = String(store.getSection("energy")?.rates?.import_entity ?? "").trim();
        settings.innerHTML = `${globalThis.cdEnViewsHtml?.() || ""}
          <div class="ed-form dm-energy-cost-card" data-dm-import-rate-mode="${entitaPrezzo ? "entity" : "number"}"><div class="ed-sec-title">💶 ${t("energyCost")}</div>
          <div class="ed-hint">${t("energyRates")}</div>
          <div class="dm-rate-mode" role="group"><button type="button" class="dm-rate-mode-btn" data-dm-rate-mode="number">${t("rateNumber")}</button><button type="button" class="dm-rate-mode-btn" data-dm-rate-mode="entity">${t("rateEntity")}</button></div>
          <div class="ed-form-row"><input id="ed-costo-kwh" class="ed-input" type="number" step="0.001" min="0" placeholder="€/kWh prelevato" value="${globalThis.cdCfg?.("cd_costo_kwh") || ""}"><input id="ed-prezzo-imm" class="ed-input" type="number" step="0.001" min="0" placeholder="€/kWh immesso" value="${globalThis.cdCfg?.("cd_prezzo_immissione") || ""}"></div>
          <span data-dm-rate-entity-slot hidden></span><small class="dm-rate-entity-note" data-dm-rate-entity-note hidden></small>
          <button class="ed-save-btn" onclick="edSaveCosti()">💾 ${t("saveCosts")}</button></div>`;
        const card = settings.querySelector(".dm-energy-cost-card");
        const slot = card.querySelector("[data-dm-rate-entity-slot]");
        const nota = card.querySelector("[data-dm-rate-entity-note]");
        const aggiornaNota = () => {
          if (card.dataset.dmImportRateMode !== "entity") return;
          const id = String(card.querySelector("#ed-costo-kwh-entita")?.value ?? "").trim();
          if (!id) { nota.textContent = t("ratePickHint"); return; }
          const valore = Number((globalThis._RAW_STATES || globalThis.STATES || {})[id]?.state);
          const prezzo = Number.isFinite(valore) ? valore.toLocaleString(getLocale(), { maximumFractionDigits: 4 }) : "—";
          nota.textContent = `${prezzo} €/kWh · ${t("rateAutoNote")}`;
        };
        /* Il campo entita' vero, lo stesso dell'editor Carichi. */
        const { field } = createEntityPickerField(globalThis.document, {
          id: "ed-costo-kwh-entita",
          value: entitaPrezzo,
          placeholder: "sensor.prezzo_kwh",
          label: t("entity"),
          locale: getLocale(),
          onPick: (input) => globalThis.wzPickEntity?.(input),
          onChange: aggiornaNota,
        });
        slot.append(field);
        const applicaModalita = (modalita) => {
          card.dataset.dmImportRateMode = modalita;
          const numero = card.querySelector("#ed-costo-kwh");
          if (numero) numero.hidden = modalita === "entity";
          slot.hidden = modalita !== "entity";
          nota.hidden = modalita !== "entity";
          card.querySelectorAll("[data-dm-rate-mode]").forEach((bottone) => {
            bottone.dataset.active = bottone.dataset.dmRateMode === modalita ? "true" : "false";
          });
          aggiornaNota();
        };
        card.querySelectorAll("[data-dm-rate-mode]").forEach((bottone) =>
          bottone.addEventListener("click", () => applicaModalita(bottone.dataset.dmRateMode)),
        );
        applicaModalita(card.dataset.dmImportRateMode);
        /* La scheda Temperature di Energia si collega da qui («manca la
         * parte nel config per configurare le entita' di questa parte»):
         * temperature dell'inverter e della batteria, potenza e
         * interruttore della ventola. Il gruppo e' uno solo, fuori dagli
         * impianti — la pagina che lo legge e' una — e ogni campo si salva
         * appena cambia, come i contatori totali della maschera Flussi. */
        const raffreddamento = globalThis.document.createElement("div");
        raffreddamento.className = "ed-form dm-energy-cooling-card";
        raffreddamento.dataset.energyCooling = "";
        raffreddamento.innerHTML = `<div class="ed-sec-title">🌡️ ${t("coolingTitle")}</div><div class="ed-hint">${t("coolingHint")}</div>`;
        const campiRaffreddamento = [
          ["inverter_ac_temperature", t("coolingAcTemp"), "°C", "sensor.inverter_temp_ac"],
          ["inverter_dc_temperature", t("coolingDcTemp"), "°C", "sensor.inverter_temp_dc"],
          ["battery_temperature", t("coolingBatTemp"), "°C", "sensor.batteria_temp"],
          ["fan_power", t("coolingFanPower"), "W", "sensor.ventola_potenza"],
          ["fan_switch", t("coolingFanSwitch"), "", "switch.ventola_inverter"],
        ];
        const statiRaffreddamento = globalThis.STATES || {};
        const modelloRaffreddamento = store.getSection("energy")?.cooling || {};
        for (const [campo, etichetta, unita, esempio] of campiRaffreddamento) {
          const slotCampo = globalThis.document.createElement("label");
          slotCampo.className = "ed-slot";
          slotCampo.innerHTML = `<span class="ed-slot-lbl">${etichetta}${unita ? ` <span class="ed-acc-n">${unita}</span>` : ""} <span class="ed-acc-n">${t("optional")}</span></span><span class="ed-hint">${t("entity")}: ${esempio}</span>`;
          const valore = String(modelloRaffreddamento[campo] || "").trim();
          const { field } = createEntityPickerField(globalThis.document, {
            id: `dm-energy-cooling-${campo}`,
            value: valore,
            placeholder: esempio,
            label: etichetta,
            locale: getLocale(),
            state: statiRaffreddamento[valore]?.state,
            unit: unita,
            onPick: (input) => globalThis.wzPickEntity?.(input),
            /* Fuori dagli impianti: qualunque linguetta sia aperta, il
             * campo scrive al primo livello del modello Energia. */
            onChange: (nuovo) => persistEnergyField(store, "cooling", campo, nuovo, ""),
          });
          slotCampo.append(field);
          raffreddamento.append(slotCampo);
        }
        settings.append(raffreddamento);
      },
      /* Ogni campo scrive dove scrivono gli altri.
       * La bozza presa all'apertura rimetteva a posto i valori che i campi
       * aggiunti dopo (contatori totali, SOC) avevano gia' salvato, e le
       * modifiche non ancora salvate sparivano cambiando sezione. */
      onChange: (group, key, value) => persistEnergyField(store, group, key, value, impiantoAperto()),
      onSignedChange: (group, signed) => persistSignedSource(store, group, signed, impiantoAperto()),
      /* Dichiarare la sorgente unica spegne le caselle dei due versi: la
       * maschera va ridisegnata dal modello appena salvato, non indovinata. */
      onSignedRerender: async () => {
        await flushEnergyWrites();
        renderEnergyEditorTab(target);
        mountCurrentEditor("energy", target);
        globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:energy-editor-rendered"));
      },
      initialTab: activeEnergyPanel,
      onTabChange: (tab) => { activeEnergyPanel = tab; },
      onSave: async ({ actions, save, status }) => {
        actions.dataset.state = "loading"; save.disabled = true; status.textContent = t("saving");
        /* La barra viva, non quella di prima: aspettare la scrittura vuol dire
         * lasciare il tempo al pannello di rifarsi dal modello appena salvato,
         * e la barra che aveva ricevuto il clic a quel punto e' gia' staccata
         * dalla pagina. Scriverci sopra "Salvato" non lo direbbe a nessuno. */
        const barraViva = () =>
          document.querySelector('[data-editor="energy"] [data-energy-actions]') ||
          target.querySelector("[data-energy-actions]") ||
          actions;
        try {
          await flushEnergyWrites();
          const current = barraViva();
          if (current) { current.dataset.state = "success"; current.querySelector("[data-energy-status]").textContent = t("energySaved"); }
        } catch (error) {
          const current = barraViva();
          if (current) { current.dataset.state = "error"; current.querySelector("[data-energy-status]").textContent = `${t("energySaveFailed")}: ${error.message}`; }
        }
      },
    });
}

/* Cambiare impianto rifa' la maschera, se la maschera c'e'.
 *
 * Le linguette scrivono la scelta e la annunciano; la maschera mostra i campi
 * dell'impianto scelto, quindi al cambio va ridisegnata dal modello nuovo —
 * lasciarla com'era voleva dire compilare il secondo impianto guardando le
 * entita' del primo, e scriverci sopra. Il ridisegno che parte dal magazzino
 * non copre questo caso: scatta al salvataggio dell'impianto, PRIMA che la
 * scelta sia scritta. */
globalThis.addEventListener?.("dashboardmodern:energy-plant-changed", async () => {
  const trovaMaschera = () => {
    const body = globalThis.document?.getElementById?.("ed-body");
    return body && body.dataset.editor === "energy" ? body : null;
  };
  if (!trovaMaschera()) return;
  /* Una scrittura in corso non annulla il ridisegno: lo fa aspettare.
   *
   * Scrivere in un campo e toccare subito la linguetta dell'altro impianto fa
   * partire prima il salvataggio del campo (sul suo impianto, letto al
   * momento del cambio) e poi il clic: rinunciare al ridisegno qui lasciava
   * la maschera vecchia sotto la linguetta nuova — e il prossimo campo
   * toccato sarebbe finito sull'impianto sbagliato. */
  if (energyWriteInFlight()) {
    try { await flushEnergyWrites(); } catch (_error) {}
  }
  const body = trovaMaschera();
  if (!body) return;
  renderEnergyEditorTab(body);
  mountCurrentEditor("energy", body);
});

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export function createEntityField({ id, label, value = "", placeholder = "sensor.entity", domain = "", optional = true } = {}) {
  const domainAttr = domain ? ` data-domain="${esc(domain)}"` : "";
  const opt = optional ? ` <span class="ed-acc-n">${t("optional")}</span>` : "";
  return `<label class="ed-slot dm-entity-field" data-entity-field><span class="ed-slot-lbl">${esc(label)}${opt}</span><span class="ed-form-row"><input id="${esc(id)}" class="ed-input ed-slot-in mono" value="${esc(value)}" placeholder="${esc(placeholder)}"${domainAttr}><button type="button" class="dm-entity-picker" data-entity-target="${esc(id)}" aria-label="${t("select")} ${esc(label)}">🔍</button></span></label>`;
}
function createIconField(id, value = "", category = "") {
  const categoryAttr = category ? ` data-icon-category="${esc(category)}"` : "";
  return `<span class="ed-form-row dm-icon-field" data-icon-field><input id="${esc(id)}" class="ed-input ed-icon-input" value="${esc(value)}"${categoryAttr}><button type="button" class="dm-icon-picker" data-icon-target="${esc(id)}"${categoryAttr} aria-label="${t("select")} icon">🎨</button></span>`;
}
const entityField = (id, label, value, placeholder) => createEntityField({ id, label, value, placeholder });

export function renderTemperatureEditor(target) {
  const allRooms = store.getSection("rooms");
  const configured = allRooms.filter((room) => room.temp || room.hum);
  const rows = configured.map((room) => {
    const label = String(room.name || "").trim() || String(room.id || "").trim() || (pick("Stanza", "Room"));
    return `<article class="ed-row dm-temperature-card" data-temperature-room data-room-id="${esc(room.id)}" data-room-name="${esc(label)}">
    <div class="dm-temperature-card-icon">${globalThis.cdIconMarkup?.(room.icon || "🌡️", 28) || esc(room.icon || "🌡️")}</div>
    <div class="ed-row-main"><div class="ed-row-new">${esc(label)}</div><div class="ed-row-old">${room.floor ? `🏢 ${esc(room.floor)} · ` : ""}<span class="mono">${esc(room.temp)}</span>${room.hum ? ` · <span class="mono">${esc(room.hum)}</span>` : ""}</div></div>
    <button type="button" class="ed-del dm-temperature-edit" data-temperature-edit aria-label="${pick("Modifica", "Edit")}">✏️</button>
    <button type="button" class="ed-del" data-temperature-delete aria-label="${t("remove")}">🗑️</button>
  </article>`;
  }).join("");
  const options = allRooms.map((room) => `<option value="${esc(room.id)}" ${(room.temp || room.hum) ? "disabled" : ""}>${esc(room.name)}${(room.temp || room.hum) ? (pick(" — configurata", " — configured")) : ""}</option>`).join("");
  const empty = pick("Configura prima almeno una stanza nella sezione Stanze.", "Configure at least one room first in the Rooms section.");
  target.innerHTML = `<div class="ed-intro" data-temperature-editor>${pick("Temperatura usa le stanze canoniche: aggiunge i sensori senza creare stanze duplicate.", "Temperature uses canonical rooms: it adds sensors without creating duplicate rooms.")}</div><div class="ed-list" data-temperature-list>${rows || `<div class="ed-empty">${t("empty")}</div>`}</div>
    ${allRooms.length ? `<form class="ed-form dm-temperature-form" data-temperature-form><div class="ed-sec-title" data-temperature-form-title>＋ ${pick("Aggiungi temperatura", "Add temperature")}</div><label class="ed-slot"><span class="ed-slot-lbl">${pick("Stanza", "Room")}</span><select id="dm-temperature-room" class="ed-input" required><option value="">— ${pick("Seleziona stanza", "Select room")} —</option>${options}</select></label><label class="ed-slot"><span class="ed-slot-lbl">${pick("Simbolo", "Icon")}</span>${createIconField("dm-temperature-icon", "mdi:home", "rooms")}</label><output class="ed-row-old dm-temperature-floor" data-temperature-floor></output>${createEntityField({ id: "ed-pl-temp", label: pick("Entità temperatura", "Temperature entity"), optional: false })}${createEntityField({ id: "dm-humidity-new", label: pick("Entità umidità", "Humidity entity") })}<div class="dm-temperature-actions"><button type="submit" class="ed-btn-add" data-temperature-submit>${t("add")}</button><button type="button" class="ed-btn-secondary" data-temperature-cancel hidden>${pick("Annulla", "Cancel")}</button></div></form>` : `<div class="ed-empty dm-temperature-no-rooms">${empty}<button type="button" class="ed-btn-add" data-temperature-go-rooms>${pick("Configura stanze", "Configure rooms")}</button></div>`}`;
}

export function mountTemperatureEditor(_section, target) {
  globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:temperature-editor-rendered"));
  mountEntityPickers(target);
  const select = target.querySelector("#dm-temperature-room");
  const form = target.querySelector("[data-temperature-form]");
  let editingId = "";
  let selectedRoomId = "";
  const refreshOptions = () => {
    const configuredIds = new Set(
      store
        .getSection("rooms")
        .filter((room) => room.temp || room.hum)
        .map((room) => room.id),
    );
    [...(select?.options || [])].forEach((option) => {
      option.disabled = configuredIds.has(option.value) && option.value !== editingId;
    });
  };
  const selectRoomForAdd = (room) => {
    editingId = "";
    selectedRoomId = room?.id || "";
    if (!select) return;
    refreshOptions();
    select.disabled = false;
    select.value = selectedRoomId;
    const iconInput = target.querySelector("#dm-temperature-icon");
    if (!iconInput.value || iconInput.value === "🌡️") iconInput.value = room?.icon || "🌡️";
    target.querySelector("[data-temperature-floor]").textContent = room?.floor ? `🏢 ${room.floor}` : "";
    target.querySelector("[data-temperature-form-title]").textContent = `＋ ${pick("Aggiungi temperatura", "Add temperature")}`;
    target.querySelector("[data-temperature-submit]").textContent = t("add");
    target.querySelector("[data-temperature-cancel]").hidden = true;
  };
  const populateEdit = (room) => {
    editingId = room?.id || "";
    selectedRoomId = "";
    if (!select) return;
    refreshOptions();
    select.value = editingId;
    select.disabled = true;
    target.querySelector("#dm-temperature-icon").value = room?.icon || "🌡️";
    target.querySelector("#ed-pl-temp").value = room?.temp || "";
    target.querySelector("#dm-humidity-new").value = room?.hum || "";
    target.querySelector("[data-temperature-floor]").textContent = room?.floor ? `🏢 ${room.floor}` : "";
    target.querySelector("[data-temperature-form-title]").textContent = `${pick("Modifica", "Edit")} ${room.name}`;
    target.querySelector("[data-temperature-submit]").textContent = pick("Salva modifiche", "Save changes");
    target.querySelector("[data-temperature-cancel]").hidden = false;
  };
  refreshOptions();
  select?.addEventListener("change", () =>
    selectRoomForAdd(store.getSection("rooms").find((room) => room.id === select.value)),
  );
  target.querySelectorAll("[data-temperature-edit]").forEach((button) =>
    button.addEventListener("click", () =>
      populateEdit(
        store
          .getSection("rooms")
          .find((room) => room.id === button.closest("[data-room-id]").dataset.roomId),
      ),
    ),
  );
  target
    .querySelector("[data-temperature-cancel]")
    ?.addEventListener("click", () => selectRoomForAdd(null));
  target.querySelectorAll("[data-temperature-delete]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.closest("[data-room-id]").dataset.roomId;
    await store.updateItem("rooms", id, { temp: "", hum: "" });
  }));
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editingId || selectedRoomId;
    const temp = target.querySelector("#ed-pl-temp").value.trim();
    if (!id || !temp.includes(".")) return globalThis.alert?.(t("required"));
    await store.updateItem("rooms", id, { icon: target.querySelector("#dm-temperature-icon").value.trim() || "🌡️", temp, hum: target.querySelector("#dm-humidity-new").value.trim() });
  });
  target.querySelector("[data-temperature-go-rooms]")?.addEventListener("click", () => globalThis.editorSwitch?.("stanze"));
}

export function mountEntityPickers(target) {
  if (!target?.querySelectorAll) return;

  const lightAddEntityIds = /^(?:luce|light)-add-ent$/;
  const explicitLegacyIds = /^(?:ed-(?:pl-(?:temp|ph|cl|pump|heat|light)|irr-(?:ent|rain|weather)|tp-ent|luce-ent|cam-ent)|(?:luce|light)-add-ent|appl-ent-new|ed-avv-ent)$/;
  const inputs = new Set(target.querySelectorAll(
    "[data-entity-input], [data-entity-field] input, input.ed-slot-in[data-ref], input[data-domain]",
  ));

  target.querySelectorAll("input").forEach((input) => {
    const next = input.nextElementSibling;
    if (explicitLegacyIds.test(input.id) || next?.matches?.(".dm-entity-picker, button[onclick*='wzPickEntity']")) {
      inputs.add(input);
    }
  });

  inputs.forEach((input) => {
    input.dataset.entityInput = "true";
    if (!input.id) input.id = `dm-entity-${[...target.querySelectorAll("input")].indexOf(input)}`;
    if (lightAddEntityIds.test(input.id)) {
      input.dataset.lightAddEntity = "";
    }
    let button = input.parentElement?.querySelector?.(`.dm-entity-picker[data-entity-target="${CSS.escape(input.id)}"]`);
    const adjacent = input.nextElementSibling;
    if (!button && adjacent?.matches?.(".dm-entity-picker, button[onclick*='wzPickEntity']")) {
      button = adjacent;
      button.classList.add("dm-entity-picker");
    }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "dm-entity-picker";
      button.textContent = "🔍";
      input.insertAdjacentElement("afterend", button);
    }
    button.dataset.entityTarget = input.id;
    button.setAttribute("aria-label", `${t("select")} entity_id`);
    button.onclick = null;
    if (button.dataset.pickerMounted !== "true") {
      button.dataset.pickerMounted = "true";
      button.addEventListener("click", () => globalThis.wzPickEntity?.(input));
    }
  });

  target.querySelectorAll(".dm-icon-picker[data-icon-target]").forEach((button) => {
    if (button.dataset.pickerMounted === "true") return;
    button.dataset.pickerMounted = "true";
    button.addEventListener("click", () => globalThis.dmIconPicker?.(`#${button.dataset.iconTarget}`, button.dataset.iconCategory || undefined));
  });
}


export function renderReportRow(item, index) {
  const fieldToken = String(item.id || index).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `<div class="ed-row dm-report-row" data-report-id="${esc(item.id)}" data-section="${esc(item.section || "loads")}">
    <label><input type="checkbox" data-report-toggle ${item.show_in_report !== false ? "checked" : ""}> Report</label>
    <input class="ed-input" data-report-label placeholder="${t("reportLabel")}" value="${esc(item.report_label || item.name)}">
    ${createIconField(`dm-report-icon-${fieldToken}`, item.report_icon || reportIconForDevice(item))}
    ${createEntityField({ id: `dm-report-entity-${fieldToken}`, label: t("reportEntity"), value: reportEntityForDevice(item, globalThis.STATES || {}), optional: false })}
    ${item.category === "manual-report" ? createEntityField({ id: `dm-report-history-${fieldToken}`, label: t("history"), value: item.history_entity }) : ""}
    <span><button type="button" data-report-up aria-label="${t("moveUp")}">▲</button><button type="button" data-report-down aria-label="${t("moveDown")}">▼</button>${item.category === "manual-report" ? `<button type="button" data-report-delete aria-label="${t("remove")}">🗑️</button>` : ""}</span>
    <input type="hidden" data-report-name value="${esc(item.name)}"><input type="hidden" data-report-category value="${esc(item.category)}">
  </div>`;
}

function renderReportEditor(target) {
  const items = [...store.getSection("appliances"), ...store.getSection("loads")]
    .filter((item) => item.category !== "manual-report" || item.show_in_dashboard === false)
    .sort((a, b) => (a.report_order ?? a.order ?? 0) - (b.report_order ?? b.order ?? 0));
  target.innerHTML = `<div class="ed-intro">${t("reportIntro")}</div><div class="ed-list" data-report-list>${items.map(renderReportRow).join("") || `<div class="ed-empty">${t("empty")}</div>`}</div>
    <button type="button" class="ed-btn-add" data-report-add>＋ ${t("addManual")}</button>
    <div class="ed-form" data-report-manual hidden><input class="ed-input" data-manual-name placeholder="${t("name")}">${createIconField("dm-manual-report-icon")}${createEntityField({ id: "dm-manual-report-entity", label: t("entity"), optional: false })}${createEntityField({ id: "dm-manual-report-history", label: t("history") })}<button type="button" class="ed-btn-add" data-manual-confirm>${t("add")}</button></div>
    <div class="ed-action-bar" data-report-actions data-state="clean"><button type="button" class="ed-save-btn" data-report-save disabled>💾 ${t("saveReport")}</button><output data-report-status>${t("saved")}</output></div>`;
}

function mountReportRowControls(row, list, dirty) {
  mountEntityPickers(row);
  row.querySelector("[data-report-up]")?.addEventListener("click", () => {
    const sibling = row.previousElementSibling;
    if (sibling?.matches?.("[data-report-id]")) list.insertBefore(row, sibling);
    dirty();
  });
  row.querySelector("[data-report-down]")?.addEventListener("click", () => {
    const sibling = row.nextElementSibling;
    if (sibling?.matches?.("[data-report-id]")) list.insertBefore(sibling, row);
    dirty();
  });
  row.querySelector("[data-report-delete]")?.addEventListener("click", () => {
    row.remove();
    dirty();
  });
}

function mountReportEditor(_tab, target) {
  const list = target.querySelector("[data-report-list]");
  const save = target.querySelector("[data-report-save]");
  const status = target.querySelector("[data-report-status]");
  const actions = target.querySelector("[data-report-actions]");
  const dirty = () => { actions.dataset.state = "dirty"; save.disabled = false; status.textContent = t("dirty"); };
  target.oninput = dirty;
  target.onchange = dirty;
  target.querySelectorAll("[data-report-id]").forEach((row) =>
    mountReportRowControls(row, list, dirty),
  );
  target.querySelector("[data-report-add]")?.addEventListener("click", () => { target.querySelector("[data-report-manual]").hidden = false; });
  target.querySelector("[data-manual-confirm]")?.addEventListener("click", () => {
    const name = target.querySelector("[data-manual-name]").value.trim();
    const entity = target.querySelector("#dm-manual-report-entity").value.trim();
    if (!name || !entity.includes(".")) return globalThis.alert?.(t("required"));
    const id = `load-manual-${Date.now().toString(36)}`;
    const wrapper = globalThis.document.createElement("div");
    wrapper.innerHTML = renderReportRow({ id, section: "loads", category: "manual-report", name, report_entity: entity, history_entity: target.querySelector("#dm-manual-report-history").value.trim(), report_icon: target.querySelector("#dm-manual-report-icon").value.trim(), show_in_dashboard: false }, list.querySelectorAll("[data-report-id]").length);
    const added = wrapper.firstElementChild;
    list.querySelector(".ed-empty")?.remove();
    list.append(added);
    mountReportRowControls(added, list, dirty);
    dirty();
  });
  save?.addEventListener("click", async () => {
    const before = store.getState(); actions.dataset.state = "loading"; save.disabled = true; status.textContent = t("saving");
    const draft = [...list.querySelectorAll("[data-report-id]")].map((rowElement, report_order) => ({
      id: rowElement.dataset.reportId, section: rowElement.dataset.section, category: rowElement.querySelector("[data-report-category]").value,
      name: rowElement.querySelector("[data-report-name]").value, show_in_report: rowElement.querySelector("[data-report-toggle]").checked,
      report_label: rowElement.querySelector("[data-report-label]").value.trim(), report_icon: rowElement.querySelector("[data-icon-field] input").value.trim(),
      report_entity: rowElement.querySelectorAll("[data-entity-field] input")[0]?.value || "",
      history_entity: rowElement.querySelectorAll("[data-entity-field] input")[1]?.value || "", report_order,
    }));
    try { await store.saveReport(draft); const currentActions = target.querySelector("[data-report-actions]"); currentActions.dataset.state = "success"; target.querySelector("[data-report-status]").textContent = t("saved"); }
    catch (error) { globalThis.console?.error?.("[Report] rollback", error, before); renderReportEditor(target); mountReportEditor("report", target); const rolled = target.querySelector("[data-report-actions]"); rolled.dataset.state = "error"; target.querySelector("[data-report-status]").textContent = `Error: ${error.message}`; }
  });
  mountEntityPickers(target);
  const entityInputs = target.querySelectorAll("[data-entity-field] input").length;
  const pickers = target.querySelectorAll("[data-entity-field] .dm-entity-picker").length;
  if (entityInputs !== pickers) throw new Error(`Entity picker invariant failed: ${entityInputs} inputs / ${pickers} pickers`);
}

/* Quando il velo se ne va, misurato mentre succede.
 *
 * Le richieste sono scese da centosettantanove a tre. I byte da 4,9 MB a 1,2,
 * e la compressione e' confermata dal campo — `content-encoding: br`, 366 kB
 * al posto di 2007. Ed e' ancora lento. Quindi il tempo se ne va in un posto
 * che finora non ho misurato, e ho gia' sbagliato due volte a indovinarlo.
 *
 * Questo lo segna: dal momento in cui la plancia comincia a caricarsi a quando
 * il velo se ne va. Il resto — quando e' arrivato l'ultimo file — si legge a
 * posteriori dai tempi delle risorse, quindi non serve segnarlo. La differenza
 * fra i due dice tutto: se il grosso sta PRIMA, e' la rete; se sta DOPO, e'
 * analisi ed esecuzione, e la compressione non la tocca nemmeno.
 *
 * Niente orologio che guarda: si intercetta l'assegnazione. Chi toglie il velo
 * scrive `__DASHBOARDMODERN_READY__ = true`, e quella scrittura passa di qui —
 * il momento e' esatto invece che arrotondato al giro di sondaggio, e non
 * arriva un `setInterval` in piu' nel grafo di produzione, dove ogni intervallo
 * e' elencato uno per uno apposta perche' non ne entri uno di nascosto.
 *
 * Si arma solo dove c'e' una pagina: le prove che importano questo modulo da
 * Node non devono trovarsi un accessore piantato su un globale. */
let prontaDopo = null;
if (typeof document !== "undefined") {
  if (globalThis.__DASHBOARDMODERN_READY__) prontaDopo = performance.now();
  else {
    let acceso = false;
    try {
      Object.defineProperty(globalThis, "__DASHBOARDMODERN_READY__", {
        configurable: true,
        get: () => acceso,
        set: (nuovo) => {
          acceso = nuovo;
          if (nuovo && prontaDopo === null) prontaDopo = performance.now();
        },
      });
    } catch (_) {
      /* Se il globale non si lascia intercettare, la riga dira' di non averlo
       * misurato: meglio di un numero inventato. */
    }
  }
}

export function tempoDiAvvio() {
  try {
    const casa = `${import.meta.url.split("/legacy/")[0]}/`;
    const nostre = performance
      .getEntriesByType("resource")
      .filter((risorsa) => risorsa.name.startsWith(casa));
    const s = (v) => `${(v / 1000).toFixed(1)} s`;
    const ultimo = nostre.length
      ? Math.max(...nostre.map((risorsa) => risorsa.responseEnd || 0))
      : 0;
    if (!prontaDopo) return ultimo ? `ultimo file a ${s(ultimo)} — velo non misurato` : "?";
    const dopoLaRete = Math.max(0, prontaDopo - ultimo);
    return `pronta in ${s(prontaDopo)} · ultimo file a ${s(ultimo)} · ${s(dopoLaRete)} dopo la rete`;
  } catch (_) {
    return "?";
  }
}

/* Quanti byte sono arrivati davvero, e se sono arrivati compressi.
 *
 * Dal campo, dopo un rilascio che aveva ridotto le richieste da 179 a 3:
 * «nulla e' cambiato». Aveva ragione — e per saperlo e' servito uno scambio di
 * messaggi e una schermata, perche' la plancia non sapeva dire quanto pesava
 * arrivare. Adesso lo dice: chi entra da fuori casa passa da un tunnel, e li'
 * contano i byte, non le richieste.
 *
 * Due cose vanno tenute distinte, e la prima stesura le confondeva.
 *
 * QUANTO HA VIAGGIATO lo dice `transferSize`. QUANTO ERA COMPRESSO lo dicono
 * `encodedBodySize` contro `decodedBodySize` — il corpo come e' arrivato contro
 * il corpo una volta disteso. Prima ricavavo la compressione dal rapporto fra
 * trasferito e disteso, e su un carico mezzo in cache quel rapporto si gonfia
 * da solo: chi era gia' in cache non ha viaggiato — `transferSize` zero — ma
 * pesa lo stesso da disteso, e la riga avrebbe detto «compressi» di una plancia
 * che arrivava in chiaro. Chiesto in revisione, ed era vero.
 *
 * Si contano solo le risorse della plancia. Quando la plancia sta dentro un
 * riquadro l'elenco e' gia' suo, ma non e' detto che sia sempre cosi', e sommare
 * anche cio' che ha scaricato Home Assistant intorno vorrebbe dire dare un
 * numero che non risponde alla domanda. `import.meta.url` dice da dove arriva
 * questo file, e tutto il resto della plancia sta li' sotto — sia coi sorgenti
 * sciolti sia col pacchetto. */
export function pesoScaricato() {
  try {
    const casa = `${import.meta.url.split("/legacy/")[0]}/`;
    const nostre = performance
      .getEntriesByType("resource")
      .filter((risorsa) => risorsa.name.startsWith(casa));
    if (!nostre.length) return "?";
    const somma = (campo) => nostre.reduce((tot, r) => tot + (r[campo] || 0), 0);
    const dalFilo = somma("transferSize");
    const codificato = somma("encodedBodySize");
    const disteso = somma("decodedBodySize");
    if (!disteso) return "?";
    const mb = (v) => `${(v / 1048576).toFixed(1)} MB`;
    /* Senza `encodedBodySize` non si sa: dirlo e' l'unica risposta onesta.
     * Prima un valore mancante — che vale zero — finiva nel ramo «non
     * compressi», e la riga dichiarava una cosa che non aveva misurato. E' il
     * modo in cui questa riga puo' far cercare il guasto dalla parte
     * sbagliata, che e' peggio del non averla. */
    const come = !codificato
      ? "peso codificato non disponibile"
      : codificato / disteso < 0.9
        ? "compressi"
        : "non compressi";
    return dalFilo
      ? `${mb(dalFilo)} di ${mb(disteso)} — ${come}`
      : `${mb(disteso)} dalla cache — ${come}`;
  } catch (_) {
    return "?";
  }
}

/* E poi lo si chiede al server, invece di dedurlo.
 *
 * I conti qui sopra sono una deduzione: dicono quanto pesa quello che e'
 * arrivato, non come e' arrivato. `fetch` invece la risposta ce l'ha scritta —
 * `content-encoding` e' esposto per le risorse di casa propria, verificato con
 * un browser vero — e una risposta letta batte una dedotta.
 *
 * `panel.js` sta in cima alla cartella servita, c'e' sempre, e pesa poco: e'
 * il campione buono. La riga si scrive subito col peso e si completa da sola
 * quando il server ha risposto; se la richiesta non riesce, resta quella che
 * era. */
async function chiediComeArrivano(target) {
  const nodo = target.querySelector('[data-dm-voce="Transfer"]');
  if (!nodo) return;
  try {
    const casa = `${import.meta.url.split("/legacy/")[0]}/`;
    const risposta = await fetch(`${casa}panel.js`, { cache: "reload" });
    if (!risposta.ok) return;
    const come = risposta.headers.get("content-encoding");
    nodo.textContent = `${nodo.textContent} · servito ${come || "in chiaro"}`;
  } catch (_) {
    /* Una diagnostica che non riesce a misurare non rompe la diagnostica. */
  }
}

function renderDiagnostics(target) {
  const rows = {
    "Integration version": BUILD_INFO.integrationVersion,
    "Dashboard version": globalThis.DASHBOARD_VERSION || BUILD_INFO.dashboardVersion,
    "Module version": MODULES_VERSION, "Schema version": store.getState().schema_version,
    "HTML URL": globalThis.location?.href || "", "modules-entry.js URL": import.meta.url,
    "Static asset hash": location.pathname.match(/dashboardmodern_static\/([^/]+)/)?.[1] || BUILD_INFO.assetHash, [t("languageVariant")]: `${document.documentElement.lang || "?"} / ${location.pathname.split("/").pop()}`,
    [t("activeRenderer")]: document.querySelector(".ed-tab.active")?.dataset?.tab || "diagnostics",
    "Git commit": BUILD_INFO.commit, "Build date": BUILD_INFO.date,
    /* Da dove sono arrivate le parti della plancia.
     *
     * Impacchettata sono tre file; sciolta sono centosettantanove, ed e' la
     * differenza che si sente al primo avvio. Il pacchetto ha un ripiego: se
     * manca, la plancia parte lo stesso dai sorgenti — e allora e' bene poterlo
     * vedere a colpo d'occhio invece di indovinarlo dal cronometro. */
    Modules: globalThis.__DASHBOARDMODERN_IMPACCHETTATA__ ? "impacchettati (3 file)" : "sciolti (179 file)",
    Transfer: pesoScaricato(),
    Boot: tempoDiAvvio(),
  };
  target.innerHTML = `<div class="ed-sec-title">🩺 ${t("diagnostics")}</div><div class="ed-list">${Object.entries(rows).map(([key, value]) => `<div class="ed-row"><div class="ed-row-main"><div class="ed-row-new">${esc(key)}</div><div class="ed-row-old mono" data-dm-voce="${esc(key)}">${esc(value)}</div></div></div>`).join("")}</div>`;
  target.dataset.runtimeDiagnostics = "true";
  chiediComeArrivano(target);
}

export const EDITOR_TAB_ALIASES = Object.freeze({
  sez0: "home", sez1: "energy", sez2: "ev", sez3: "solar", sez4: "security",
  sez6: "server", sez7: "temperature", sez8: "actions", sez9: "climate",
  load: "loads", runtime: "diagnostics",
});
export const resolveEditorTab = (tab) => EDITOR_TAB_ALIASES[tab] || tab;

export const EDITOR_REGISTRY = Object.freeze({
  energy: { render: renderEnergyEditorTab, mount: mountCurrentEditor, visibilityKey: "energy" },
  loads: { render: mountLoadsEditor, mount: mountCurrentEditor, visibilityKey: "energy" },
  report: { render: renderReportEditor, mount: mountReportEditor, visibilityKey: "energy" },
  temperature: { render: renderTemperatureEditor, mount: mountTemperatureEditor, visibilityKey: "temp" },
  diagnostics: { render: renderDiagnostics, mount: mountCurrentEditor, visibilityKey: null },
  /* Le prese. La scheda la disegna il modulo che tiene l'elenco: e' lui che sa
   * cosa c'e' dentro, e un secondo posto che lo disegna sarebbe un secondo
   * padrone del formato. */
  prese: { render: renderPreseEditor, mount: mountCurrentEditor, visibilityKey: "prese" },
});

export function dispatchEditorTab(tab, target, registry = EDITOR_REGISTRY) {
  const resolved = resolveEditorTab(tab);
  const descriptor = registry[resolved];
  if (!descriptor || !target) return false;
  globalThis.document?.querySelectorAll?.(".ed-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  descriptor.render(target);
  descriptor.mount?.(resolved, target);
  target.dataset.renderer = resolved;
  return true;
}

export function renderEditorTab(tab, target = globalThis.document?.getElementById?.("ed-body")) {
  return dispatchEditorTab(tab, target);
}

export function registerEditorTabs(root = globalThis.document) {
  const tabs = root?.querySelector?.(".ed-tabs");
  if (!tabs) return;
  /* La scheda Prese sta accanto a quella delle Luci, che e' da dove le prese
   * sono uscite: chi le cerca le cerca li' vicino. Se la fila non ha le Luci
   * — un guscio piu' vecchio — va in fondo, che e' meglio di non esserci. */
  if (!tabs.querySelector('[data-tab="prese"]')) {
    const prese = root.createElement("button");
    prese.type = "button";
    prese.className = "ed-tab";
    prese.dataset.tab = "prese";
    prese.textContent = "🔌 Prese";
    prese.addEventListener("click", () => globalThis.editorSwitch?.("prese"));
    const luci = tabs.querySelector('[data-tab="luci"]');
    if (luci) luci.after(prese);
    else tabs.append(prese);
  }
  if (tabs.querySelector('[data-tab="runtime"]')) return;
  const button = root.createElement("button"); button.type = "button"; button.className = "ed-tab";
  button.dataset.tab = "runtime"; button.textContent = "🩺 Runtime";
  button.addEventListener("click", () => renderEditorTab("runtime")); tabs.append(button);
}

export function mountCurrentEditor(section, target = globalThis.document?.getElementById?.("ed-body")) {
  if (!target) return;
  mountEntityPickers(target);
  globalThis.cdFillRoomSelects?.();
  target.querySelectorAll?.("details.ed-acc").forEach((details) => details.dataset.editorMounted = "true");
  target.dataset.mountedSection = section || "";
  /* La scheda e' stata ridisegnata. Chi ci aggiunge qualcosa di suo lo scopre
   * da qui: prima poteva solo indovinare quando il corpo dell'editor era stato
   * rifatto sotto di lui, e cio' che aveva aggiunto spariva. */
  globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:editor-rendered", { detail: { section } }));
}
/* The Loads panel belongs to the rebuilt editor when that owner is installed.
   This flat A/B list described the same loads a second time, and because it
   writes innerHTML it also wiped whatever the new panel had already drawn. */
function renderLoadsPanel(target) {
  if (globalThis.__DM_20260817B__ !== true) return false;
  if (typeof globalThis.dmRenderEnergyLoadsEditor !== "function") return false;
  return globalThis.dmRenderEnergyLoadsEditor(target) === true;
}

function mountLoadsEditor(target, editId = "") {
  const loads = store.getSection("loads");
  const appliances = store.getSection("appliances");
  const current = loads.find((item) => item.id === editId) || {};
  const cards = (items, readOnly = false) => items.map((item) => `<div class="ed-row" data-load-id="${esc(item.id)}"><div class="ed-row-main"><div class="ed-row-new">${esc(item.emoji_icon || item.icon || "🔌")} ${esc(item.name || t("newLoad"))}</div><div class="ed-row-old">${esc(item.category || "secondary")}</div></div>${readOnly ? "" : `<button class="ed-del" data-edit-load="${esc(item.id)}" title="${t("editLoad")}">✏️</button><button class="ed-del" data-delete-load="${esc(item.id)}" title="${t("remove")}">🗑️</button>`}</div>`).join("") || `<div class="ed-empty">${t("noLoads")}</div>`;
  target.innerHTML = `<div class="ed-intro">${t("loadsIntro")}</div><details class="ed-acc" open><summary class="ed-acc-head">A. ${t("appliances")} <span class="ed-acc-n">${appliances.length}</span></summary><div class="ed-acc-body">${cards(appliances, true)}</div></details>
    <details class="ed-acc" open><summary class="ed-acc-head">B. ${t("secondaryLoads")} <span class="ed-acc-n">${loads.filter((x) => x.category !== "manual-report").length}</span></summary><div class="ed-acc-body">${cards(loads.filter((x) => x.category !== "manual-report"))}</div></details>
    <div class="ed-form" data-load-form><div class="ed-sec-title">${editId ? t("editLoad") : t("newLoad")}</div><div class="ed-form-row"><input id="dm-load-name" class="ed-input" placeholder="${t("name")}" value="${esc(current.name)}"><input id="dm-load-icon" class="ed-input ed-icon-input" placeholder="🔌 / mdi:power-plug" value="${esc(current.emoji_icon || current.icon)}"></div><div class="ed-form-row"><select id="dm-load-room" class="ed-input">${globalThis.cdRoomOptions?.(current.room_id) || ""}</select></div>${entityField("dm-load-power", t("powerEntity"), current.power_entity, "sensor.load_power")}${entityField("dm-load-day", t("dailyEnergy"), current.daily_energy_entity)}${entityField("dm-load-month", t("monthlyEnergy"), current.monthly_energy_entity)}${entityField("dm-load-total", t("totalEnergy"), current.total_energy_entity)}${entityField("dm-load-history", t("history"), current.history_entity)}${entityField("dm-load-state", t("state"), current.state_entity)}${entityField("dm-load-control", t("control"), current.control_entity, "switch.load")}<label class="ed-intro"><input id="dm-load-report" type="checkbox" ${current.show_in_report !== false ? "checked" : ""}> ${t("visibleReport")}</label><label class="ed-intro"><input id="dm-load-dashboard" type="checkbox" ${current.show_in_dashboard !== false ? "checked" : ""}> ${t("visibleDashboard")}</label><button class="ed-btn-add" data-save-load>💾 ${editId ? t("saveChanges") : t("addLoad")}</button></div>`;
  target.querySelectorAll?.("[data-edit-load]").forEach((button) => button.addEventListener("click", () => mountLoadsEditor(target, button.dataset.editLoad)));
  target.querySelectorAll?.("[data-delete-load]").forEach((button) => button.addEventListener("click", async () => { try { await store.removeItem("loads", button.dataset.deleteLoad); } catch (error) { globalThis.alert?.(error.message); } }));
  target.querySelector?.("[data-save-load]")?.addEventListener("click", async () => {
    const value = (id) => target.querySelector(`#${id}`)?.value?.trim() || "";
    const item = { name: value("dm-load-name"), icon: value("dm-load-icon"), category: current.category && current.category !== "manual-report" ? current.category : "secondary", room_id: value("dm-load-room"), power_entity: value("dm-load-power"), daily_energy_entity: value("dm-load-day"), monthly_energy_entity: value("dm-load-month"), total_energy_entity: value("dm-load-total"), history_entity: value("dm-load-history"), state_entity: value("dm-load-state"), control_entity: value("dm-load-control"), show_in_report: !!target.querySelector("#dm-load-report")?.checked, show_in_dashboard: !!target.querySelector("#dm-load-dashboard")?.checked, order: current.order ?? loads.length };
    if (!item.name) return globalThis.alert?.(t("loadNameRequired"));
    try { await (editId ? store.updateItem("loads", editId, item) : store.addItem("loads", item)); }
    catch (error) { globalThis.alert?.(error.message); }
  });
}

const DashboardModernModules = Object.freeze({
  version: MODULES_VERSION,
  data: Object.freeze({
    canonicalReportDevices,
    getDeviceDisplayName,
    getDeviceVisual,
    normalizeDevice,
    stableRoomId,
    normalizeRooms,
    isConfiguredRoom,
    applianceRoomId,
    applianceGroups,
    applianceEnergyReport,
    applianceMedia,
    applianceName,
    applianceState,
    controllableEntity,
    normalizeCamera,
    normalizeCameras,
    saveCamera,
    removeCamera,
  }),
  /* Come si apre una telecamera: la scelta delle strade e delle attese sta in
   * un modulo puro, e il runtime la chiede a lui invece di averla scritta
   * dentro. E' l'unico modo perche' quella scelta si possa provare senza una
   * Ring in casa. */
  telecamere: Object.freeze({ strategieDellaTelecamera, daProvare, diagnosi, siSveglia }),
  store,
  EDITOR_REGISTRY,
  renderEditorTab,
  dispatchEditorTab,
  resolveEditorTab,
  registerEditorTabs,
  hydrateCanonicalRuntime,
  diagnostics: Object.freeze({ BUILD_INFO, MODULES_VERSION, SCHEMA_VERSION, htmlUrl: globalThis.location?.href, modulesUrl: import.meta.url }),
  render: Object.freeze({ createEnergyReportRows, createRenderCoordinator, createEntityField, loadPopupMetrics, mountCurrentEditor, mountEntityPickers, mountLoadsEditor, mountReportEditor, renderEnergyEditorTab, renderReportEditor, renderDeviceCard, renderEnergyEditor }),
});

globalThis.DashboardModernModules = DashboardModernModules;

let canonicalRuntimeHydrated = false;
export function hydrateCanonicalRuntime() {
  if (canonicalRuntimeHydrated) return false;
  if (!globalThis.__DASHBOARDMODERN_LEGACY_READY__ || globalThis.document?.readyState === "loading") {
    globalThis.addEventListener?.("dashboardmodern:legacy-ready", hydrateCanonicalRuntime, {
      once: true,
    });
    return false;
  }
  canonicalRuntimeHydrated = true;
  // Ogni passo per conto suo: se uno cade, la visibilita' delle sezioni e il
  // disegno partono lo stesso, invece di restare indietro con lui.
  runSteps(
    [
      ["applyRuntimeProjection", () => applyRuntimeProjection()],
      ["cdRebuildReportDevices", () => globalThis.cdRebuildReportDevices?.()],
      ["buildReportSelect", () => globalThis.buildReportSelect?.()],
      ["cdApplyNavVis", () => globalThis.cdApplyNavVis?.()],
      ["renderAppliances", () => globalThis.renderAppliances?.()],
      ["renderApplianceSection", () => globalThis.renderApplianceSection?.(true)],
      ["buildDeviceCards", () => globalThis.buildDeviceCards?.()],
      ["render", () => globalThis.render?.()],
    ],
    { onError: stepReporter(globalThis.console, "avvio") },
  );
  return true;
}

hydrateCanonicalRuntime();
export default DashboardModernModules;
