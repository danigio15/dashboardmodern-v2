/* L'elettrodomestico si prende da un'integrazione, intero.
 *
 * Dal campo: «la sezione elettrodomestici la possiamo rivedere e far in modo
 * che le persone possano integrare i loro elettrodomestici sfruttando le
 * integrazioni? Non solo switch on/off ma proprio le integrazioni, sia
 * ufficiali che presenti su HACS, creando un menu. Io ho la lavatrice Hoover
 * con hOn e mi espone tutti i dati: dalla sezione voglio prendere tutte le
 * integrazioni, cosi' ogni elettrodomestico avra' tutte le sue informazioni.»
 *
 * Questo modulo e' il menu. Chiede al backend il catalogo — integrazioni,
 * dispositivi, entita' — e lo mette in una finestra a due colonne: a sinistra
 * le integrazioni installate, con scritto se sono di Home Assistant o messe
 * con HACS; a destra i dispositivi di quella scelta, con marca, modello,
 * stanza e quante entita' portano. Scelto un dispositivo, l'apparecchio nasce
 * gia' compilato: il modulo puro in `core/appliance-device-binding.js` dice
 * che tipo e', in che stanza va e quale entita' fa da potenza, da tempo
 * rimanente, da fase. Le caselle gia' scritte a mano non si toccano.
 *
 * Il menu si apre da due posti: dal tasto «Aggiungi da un'integrazione» in
 * cima alla scheda degli elettrodomestici, che crea l'apparecchio, e dal
 * blocco «Integrazione» nella finestra di modifica, che collega — o scollega —
 * uno gia' esistente. La finestra del dettaglio, per un apparecchio collegato,
 * mostra poi tutte le entita' del dispositivo: e' in
 * `appliance-detail-popup-section.js`, che legge di qui il catalogo.
 */
import {
  bindApplianceToDevice,
  cercaFuoriDalDispositivo,
  bindingLabel,
  integrationsWithDevices,
} from "../core/appliance-device-binding.js";
import { applianceCatalogLabel } from "../core/device-model.js";
import {
  activeLocale,
  allStates,
  chiediAHomeAssistant,
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  section,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_INTEGRATION__";
const state = (root[KEY] ||= {
  installed: false,
  catalog: null,
  catalogAt: 0,
  catalogInflight: null,
  catalogError: "",
  entities: new Map(),
  entitiesInflight: new Map(),
});

const TYPE = "dashboardmodern/integrations/catalog";
/* Il catalogo cambia quando si installa un'integrazione: non a ogni tocco. */
const FRESH_MS = 5 * 60 * 1000;
const EVENT = "dashboardmodern:integrations-catalog";

/* La domanda al backend, per la strada che c'e'.
 *
 * Dentro la cornice il guscio ha la sua presa, che e' il ponte; sulla pagina
 * servita da sola e' la presa vera. Se il guscio non l'ha ancora aperta c'e'
 * il broker dell'energia, che ne apre una sua. */
async function chiedi(payload) {
  try {
    return await chiediAHomeAssistant(payload, 15000);
  } catch (error) {
    const broker = root.DashboardModernEnergyService?.broker;
    if (typeof broker?.request !== "function") throw error;
    return broker.request(payload);
  }
}

function annuncia() {
  try {
    root.dispatchEvent?.(new CustomEvent(EVENT));
  } catch (_error) {}
}

/** Il catalogo di integrazioni e dispositivi, dalla memoria o dal backend. */
export async function caricaCatalogo({ force = false } = {}) {
  const now = Date.now();
  if (!force && state.catalog && now - state.catalogAt < FRESH_MS) return state.catalog;
  if (state.catalogInflight) return state.catalogInflight;
  state.catalogInflight = (async () => {
    try {
      const result = await chiedi({ type: TYPE });
      state.catalog = {
        integrations: Array.isArray(result?.integrations) ? result.integrations : [],
        devices: Array.isArray(result?.devices) ? result.devices : [],
      };
      state.catalogAt = Date.now();
      state.catalogError = "";
      annuncia();
      return state.catalog;
    } catch (error) {
      state.catalogError = clean(error?.message) || "socket";
      throw error;
    } finally {
      state.catalogInflight = null;
    }
  })();
  return state.catalogInflight;
}

/** Le entita' di un dispositivo, dal backend, tenute in memoria. */
export async function caricaEntita(deviceId) {
  const id = clean(deviceId);
  if (!id) return [];
  if (state.entities.has(id)) return state.entities.get(id);
  if (state.entitiesInflight.has(id)) return state.entitiesInflight.get(id);
  const promise = (async () => {
    try {
      const result = await chiedi({ type: TYPE, device_ids: [id] });
      const list = (Array.isArray(result?.entities) ? result.entities : []).filter(
        (entity) => clean(entity?.device_id) === id,
      );
      state.entities.set(id, list);
      annuncia();
      return list;
    } finally {
      state.entitiesInflight.delete(id);
    }
  })();
  state.entitiesInflight.set(id, promise);
  return promise;
}

/** Le entita' gia' in memoria, o `null` — e intanto le chiede. */
export function entitaDelDispositivo(deviceId) {
  const id = clean(deviceId);
  if (!id) return null;
  if (state.entities.has(id)) return state.entities.get(id);
  caricaEntita(id).catch(() => {});
  return null;
}

/** Solo per le prove: dimentica quello che si e' letto. */
export function dimenticaCatalogo() {
  state.catalog = null;
  state.catalogAt = 0;
  state.catalogError = "";
  state.entities.clear();
}

function integrazioneDi(catalog, domain) {
  return (catalog?.integrations || []).find((item) => item.domain === domain) || null;
}

function badge(integration) {
  if (integration?.custom === true)
    return `<span class="dm-integ-badge dm-integ-badge-hacs">${t("HACS / personalizzata", "HACS / custom")}</span>`;
  if (integration?.custom === false)
    return `<span class="dm-integ-badge dm-integ-badge-core">${t("Ufficiale", "Official")}</span>`;
  return "";
}

function rigaDispositivo(device) {
  const dettagli = [device.manufacturer, device.model].map(clean).filter(Boolean).join(" ");
  const stanza = clean(device.area);
  const quante =
    device.entities === 1
      ? t("1 entità", "1 entity")
      : `${device.entities} ${t("entità", "entities")}`;
  return `<button type="button" class="dm-integ-device" data-device-id="${esc(device.id)}" data-search="${esc(`${device.name} ${dettagli} ${stanza}`.toLowerCase())}">
    <span class="dm-integ-device-name">${esc(device.name || device.id)}</span>
    <span class="dm-integ-device-meta">${esc(dettagli)}${dettagli && stanza ? " · " : ""}${stanza ? `🏠 ${esc(stanza)}` : ""}</span>
    <span class="dm-integ-device-count">${quante}</span>
  </button>`;
}

function anteprimaEntita(entities) {
  const accese = entities.filter((entity) => !entity.disabled);
  const spente = entities.length - accese.length;
  const nomi = accese
    .slice(0, 14)
    .map((entity) => clean(entity.name) || entity.entity_id.split(".")[1])
    .map((name) => `<span class="dm-integ-chip">${esc(name)}</span>`)
    .join("");
  const altre =
    accese.length > 14
      ? `<span class="dm-integ-chip dm-integ-chip-more">+${accese.length - 14}</span>`
      : "";
  const nota = spente
    ? `<small>${spente === 1 ? t("1 entità è disabilitata in Home Assistant: abilitala da lì per vederla anche qui.", "1 entity is disabled in Home Assistant: enable it there to see it here too.") : t(`${spente} entità sono disabilitate in Home Assistant: abilitale da lì per vederle anche qui.`, `${spente} entities are disabled in Home Assistant: enable them there to see them here too.`)}</small>`
    : "";
  return `<div class="dm-integ-chips">${nomi}${altre}</div>${nota}`;
}

/* Il riquadro dei sensori che stanno fuori dal dispositivo.
 *
 * Una lavatrice puo' essere due dispositivi: l'integrazione che porta il
 * programma e una presa smart che porta i watt. Qui si dice cosa si e'
 * trovato e lo si mostra per nome, perche' un'entita' presa per somiglianza
 * di nome e' un'ipotesi, e un'ipotesi si guarda prima di accettarla. */
function anteprimaFuori(fuori) {
  const voci = Object.values(fuori);
  if (!voci.length) return "";
  const elenco = voci
    .map((record) => `<code>${esc(record.entity_id)}</code>`)
    .join('<span aria-hidden="true"> · </span>');
  return `<label class="dm-integ-fuori">
    <input type="checkbox" data-outside checked>
    <span>
      <b>${voci.length === 1 ? t("Prendi anche 1 sensore che sta fuori dal dispositivo", "Also take 1 sensor that lives outside the device") : t(`Prendi anche ${voci.length} sensori che stanno fuori dal dispositivo`, `Also take ${voci.length} sensors that live outside the device`)}</b>
      <small>${t("Portano il nome di questo apparecchio ma appartengono a un'altra voce del registro: quasi sempre la presa smart sotto la macchina, o un sensore che ti sei costruito.", "They carry this appliance's name but belong to another registry entry: almost always the smart plug under the machine, or a sensor you built yourself.")}</small>
      <small class="dm-integ-fuori-ids">${elenco}</small>
    </span>
  </label>`;
}

/**
 * La finestra: integrazioni a sinistra, dispositivi a destra, anteprima e
 * conferma in fondo. `onScelto` riceve `{ integration, device, entities,
 * outside }`, dove `outside` sono i sensori che stanno fuori dal dispositivo
 * e che chi guarda ha lasciato spuntati.
 */
export function apriMenuIntegrazioni({ onScelto, titolo = "" } = {}) {
  doc?.getElementById("dm-integ-menu")?.remove();
  const modal = doc.createElement("div");
  modal.id = "dm-integ-menu";
  modal.className = "dm-section-modal dm-integ-modal";
  modal.innerHTML = `<section class="dm-section-dialog dm-integ-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-integ-title">
    <header><strong id="dm-integ-title">🔗 ${esc(titolo || t("Collega a un'integrazione", "Link to an integration"))}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <div class="dm-integ-body">
      <p class="dm-integ-intro">${t("Le integrazioni di Home Assistant, ufficiali o da HACS, con i dispositivi che portano. Scegli il tuo elettrodomestico: le sue entità entrano tutte, e le caselle della card si compilano da sole.", "Home Assistant integrations, official or from HACS, with the devices they bring. Pick your appliance: every entity comes along, and the card fields fill themselves in.")}</p>
      <div class="dm-integ-status" data-status>${t("Leggo le integrazioni di Home Assistant…", "Reading Home Assistant integrations…")}</div>
      <div class="dm-integ-columns" data-columns hidden>
        <nav class="dm-integ-list" data-integrations aria-label="${t("Integrazioni", "Integrations")}"></nav>
        <div class="dm-integ-devices">
          <input class="ed-input dm-integ-search" type="search" data-search placeholder="🔎 ${t("Cerca un dispositivo…", "Search a device…")}" autocomplete="off">
          <div class="dm-integ-device-list" data-devices></div>
        </div>
      </div>
      <div class="dm-integ-preview" data-preview hidden></div>
    </div>
  </section>`;
  doc.body.append(modal);
  const stato = modal.querySelector("[data-status]");
  const colonne = modal.querySelector("[data-columns]");
  const navigazione = modal.querySelector("[data-integrations]");
  const elenco = modal.querySelector("[data-devices]");
  const ricerca = modal.querySelector("[data-search]");
  const anteprima = modal.querySelector("[data-preview]");
  const close = () => modal.remove();
  modal.querySelector("[data-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  let menu = [];
  let scelta = null;
  let dispositivo = null;

  const disegnaDispositivi = () => {
    const filtro = clean(ricerca.value).toLowerCase();
    const voci = (scelta?.devices || []).filter(
      (device) =>
        !filtro ||
        [device.name, device.manufacturer, device.model, device.area]
          .map(clean)
          .join(" ")
          .toLowerCase()
          .includes(filtro),
    );
    elenco.innerHTML = voci.length
      ? voci.map(rigaDispositivo).join("")
      : `<div class="dm-integ-empty">${t("Nessun dispositivo con questo nome.", "No device by that name.")}</div>`;
    for (const button of elenco.querySelectorAll("[data-device-id]"))
      button.setAttribute("aria-pressed", String(button.dataset.deviceId === dispositivo?.id));
  };

  const disegnaIntegrazioni = () => {
    navigazione.innerHTML = menu
      .map(
        (
          integration,
        ) => `<button type="button" class="dm-integ-item" data-domain="${esc(integration.domain)}" aria-pressed="${String(integration.domain === scelta?.domain)}">
          <span class="dm-integ-item-name">${esc(integration.name)}</span>
          ${badge(integration)}
          <span class="dm-integ-item-count">${integration.devices.length}</span>
        </button>`,
      )
      .join("");
  };

  const mostraAnteprima = async (device) => {
    dispositivo = device;
    disegnaDispositivi();
    anteprima.hidden = false;
    anteprima.innerHTML = `<div class="dm-integ-status">${t("Leggo le entità del dispositivo…", "Reading the device's entities…")}</div>`;
    let entities = [];
    try {
      entities = await caricaEntita(device.id);
    } catch (error) {
      anteprima.innerHTML = `<div class="dm-integ-status dm-integ-error">${esc(t("Non riesco a leggere le entità: ", "Cannot read the entities: "))}${esc(error?.message || error)}</div>`;
      return;
    }
    if (dispositivo !== device) return;
    const dentro = entities.map((entity) => entity.entity_id);
    const collegato = bindApplianceToDevice(
      {},
      { device, entities, integration: scelta, states: allStates() },
    ).appliance;
    /* Solo le caselle che il dispositivo ha lasciato vuote. */
    const fuori = cercaFuoriDalDispositivo({
      deviceName: device.name,
      states: allStates(),
      escludi: dentro,
      ruoli: [
        "power_entity",
        "daily_energy_entity",
        "monthly_energy_entity",
        "total_energy_entity",
      ].filter((ruolo) => !clean(collegato[ruolo])),
    });
    const tipo = applianceCatalogLabel(collegato.visual_key, activeLocale());
    anteprima.innerHTML = `<div class="dm-integ-preview-head">
        <strong>${esc(device.name)}</strong>
        <span>${esc([device.manufacturer, device.model].map(clean).filter(Boolean).join(" "))}</span>
        <span class="dm-integ-preview-type">${esc(t("Riconosciuto come", "Recognised as"))}: <b>${esc(tipo)}</b></span>
      </div>
      ${anteprimaEntita(entities)}
      ${anteprimaFuori(fuori)}
      <button type="button" class="ed-btn-add dm-integ-confirm" data-confirm>🔗 ${t("Usa questo dispositivo", "Use this device")}</button>`;
    anteprima.querySelector("[data-confirm]")?.addEventListener("click", () => {
      close();
      try {
        const prendiFuori = anteprima.querySelector("[data-outside]")?.checked !== false;
        onScelto?.({
          integration: scelta,
          device,
          entities,
          outside: prendiFuori ? fuori : null,
        });
      } catch (error) {
        root.console?.warn?.("[DashboardModern] integrazione", error);
      }
    });
  };

  navigazione.addEventListener("click", (event) => {
    const item = event.target.closest("[data-domain]");
    if (!item) return;
    scelta = menu.find((integration) => integration.domain === item.dataset.domain) || null;
    dispositivo = null;
    anteprima.hidden = true;
    anteprima.innerHTML = "";
    ricerca.value = "";
    disegnaIntegrazioni();
    disegnaDispositivi();
  });
  elenco.addEventListener("click", (event) => {
    const button = event.target.closest("[data-device-id]");
    if (!button) return;
    const device = (scelta?.devices || []).find((item) => item.id === button.dataset.deviceId);
    if (device) mostraAnteprima(device);
  });
  ricerca.addEventListener("input", disegnaDispositivi);

  caricaCatalogo()
    .then((catalog) => {
      if (!modal.isConnected) return;
      menu = integrationsWithDevices(catalog);
      if (!menu.length) {
        stato.textContent = t(
          "Nessuna integrazione con dispositivi trovata: in Home Assistant non c'è ancora un dispositivo con delle entità.",
          "No integration with devices found: Home Assistant does not have a device with entities yet.",
        );
        return;
      }
      stato.hidden = true;
      colonne.hidden = false;
      scelta = menu[0];
      disegnaIntegrazioni();
      disegnaDispositivi();
    })
    .catch((error) => {
      if (!modal.isConnected) return;
      stato.classList.add("dm-integ-error");
      stato.textContent = `${t("Non riesco a leggere le integrazioni: ", "Cannot read the integrations: ")}${clean(error?.message) || error}`;
    });
  return modal;
}

function appliances() {
  const stored = dashboardStore()?.getSection?.("appliances");
  return Array.isArray(stored) ? stored.slice() : readJson("cd_appliances", []);
}

/* Un apparecchio nuovo, nato dal dispositivo scelto. */
async function creaDaDispositivo({ integration, device, entities, outside }) {
  const rooms = section("rooms", readJson("cd_stanze", []));
  const { appliance, filled } = bindApplianceToDevice(
    {
      id: `appl_${Date.now().toString(36)}`,
      name: "",
      icon: "generico",
      entities: [],
      threshold_run: 5,
      threshold_standby: 1,
    },
    { integration, device, entities, outside, states: allStates(), rooms },
  );
  const store = dashboardStore();
  let indice = -1;
  if (store?.addItem) {
    await store.addItem("appliances", appliance);
    indice = appliances().findIndex((item) => item.id === appliance.id);
  } else {
    const list = appliances();
    list.push(appliance);
    writeJsonIfChanged("cd_appliances", list);
    indice = list.length - 1;
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  root.cdEnsureSectionVisible?.("appliances");
  root.renderAppliances?.();
  root.renderApplianceSection?.(true);
  root.cdRebuildReportDevices?.();
  root.buildReportSelect?.();
  root.editorSwitch?.("appliances");
  const quante = filled.length;
  root.edToast?.(
    quante
      ? t(
          `${appliance.name} aggiunto: ${quante} caselle compilate dall'integrazione`,
          `${appliance.name} added: ${quante} fields filled from the integration`,
        )
      : t(
          `${appliance.name} aggiunto dall'integrazione`,
          `${appliance.name} added from the integration`,
        ),
  );
  if (indice >= 0) root.setTimeout?.(() => root.edApplEdit?.(indice), 120);
}

/* Il tasto in cima alla scheda, e la spilla sulle righe gia' collegate. */
function vesteLaScheda() {
  const body = doc?.getElementById("ed-body");
  const nome = body?.querySelector?.("#appl-name");
  if (!body || !nome) return;
  const form = nome.closest(".ed-form");
  if (form && !form.querySelector(".dm-integ-invito")) {
    const invito = doc.createElement("div");
    invito.className = "dm-integ-invito";
    invito.innerHTML = `<button type="button" class="ed-btn-add dm-integ-add" data-dm-integ-add>🔗 ${t("Aggiungi da un'integrazione", "Add from an integration")}</button>
      <small>${t("hOn, Home Connect, Miele, LG ThinQ, SmartThings, una presa Shelly… scegli il dispositivo e l'apparecchio arriva con tutte le sue entità già al posto giusto. Oppure, qui sotto, una entità alla volta.", "hOn, Home Connect, Miele, LG ThinQ, SmartThings, a Shelly plug… pick the device and the appliance arrives with all its entities in the right place. Or, below, one entity at a time.")}</small>`;
    invito.querySelector("[data-dm-integ-add]")?.addEventListener("click", () => {
      apriMenuIntegrazioni({
        titolo: t("Aggiungi da un'integrazione", "Add from an integration"),
        onScelto: (scelta) =>
          creaDaDispositivo(scelta).catch((error) =>
            root.alert?.(
              `${t("Salvataggio fallito: ", "Save failed: ")}${error?.message || error}`,
            ),
          ),
      });
    });
    form.prepend(invito);
  }
  const lista = appliances();
  const righe = body.querySelectorAll(".ed-list > .ed-row");
  /* Le righe sono quelle degli apparecchi, una per uno, nello stesso ordine:
   * se il conto non torna e' un'altra lista, e si lascia stare. */
  if (righe.length !== lista.length) return;
  righe.forEach((riga, indice) => {
    const appliance = lista[indice];
    const testa = riga.querySelector(".ed-row-new");
    if (!testa || !appliance || !clean(appliance.integration)) return;
    if (testa.querySelector(".dm-integ-pin")) return;
    const pin = doc.createElement("span");
    pin.className = "dm-integ-pin";
    pin.title = bindingLabel(appliance, activeLocale());
    pin.textContent = `🔗 ${clean(appliance.integration_name) || clean(appliance.integration)}`;
    testa.append(" ", pin);
  });
}

function css() {
  return `
    .dm-integ-invito{display:grid;gap:6px;margin:0 0 12px;padding:12px;border-radius:14px;border:1px dashed color-mix(in srgb,#0ea5e9 45%,transparent);background:color-mix(in srgb,#0ea5e9 7%,transparent)}
    .dm-integ-invito .dm-integ-add{margin:0!important;background:linear-gradient(135deg,#0ea5e9,#0369a1)!important}
    .dm-integ-invito small{font-size:11px;line-height:1.45;color:var(--text-dim,#64748b);font-weight:600}
    .dm-integ-pin{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.3px;vertical-align:middle;color:#0369a1;background:rgba(14,165,233,.14)}
    /* La colonna del dialogo e' una sola e non puo' crescere.
       Senza dirlo, la traccia implicita e' larga quanto il contenuto piu'
       largo che non sa stringersi — qui l'intestazione, che tiene titolo e
       chiusura su una riga sola: su un telefono da 390 la finestra usciva a
       424 e il tasto CHIUDI restava mezzo fuori. */
    .dm-integ-modal .dm-integ-dialog{grid-template-rows:auto minmax(0,1fr)!important;grid-template-columns:minmax(0,1fr)!important}
    .dm-integ-modal .dm-integ-dialog>header{min-width:0!important}
    .dm-integ-modal .dm-integ-dialog>header>strong{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .dm-integ-body{display:flex;flex-direction:column;gap:10px;min-height:0;padding:14px 18px 18px;overflow:hidden}
    .dm-integ-intro,.dm-integ-status{flex:0 0 auto}
    .dm-integ-intro{margin:0;font-size:12.5px;line-height:1.5;color:var(--text-dim,#64748b);font-weight:600}
    .dm-integ-status{padding:10px 12px;border-radius:12px;font-size:12.5px;font-weight:700;color:var(--text-dim,#64748b);background:color-mix(in srgb,var(--secondary-background-color,#f1f5f9) 70%,transparent)}
    .dm-integ-status[hidden]{display:none}
    .dm-integ-error{color:#b91c1c;background:rgba(239,68,68,.1)}
    .dm-integ-columns{flex:1 1 auto;display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);gap:12px;min-height:0}
    .dm-integ-columns[hidden]{display:none}
    .dm-integ-list{display:flex;flex-direction:column;gap:4px;min-width:0;min-height:0;overflow-y:auto;padding-right:2px}
    .dm-integ-item{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name count" "badge count";align-items:center;gap:2px 8px;padding:8px 10px;border:1px solid var(--divider-color,#e2e8f0);border-radius:12px;background:var(--card-background-color,#fff);color:inherit;font:inherit;text-align:left;cursor:pointer}
    .dm-integ-item[aria-pressed="true"]{border-color:#0ea5e9;box-shadow:0 0 0 2px color-mix(in srgb,#0ea5e9 18%,transparent);background:color-mix(in srgb,#0ea5e9 8%,var(--card-background-color,#fff))}
    .dm-integ-item-name{grid-area:name;font-size:13px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-integ-item-count{grid-area:count;min-width:22px;padding:2px 7px;border-radius:999px;font-size:10.5px;font-weight:900;text-align:center;color:#0369a1;background:rgba(14,165,233,.14)}
    .dm-integ-badge{grid-area:badge;justify-self:start;padding:1px 7px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.6px;text-transform:uppercase}
    .dm-integ-badge-core{color:#166534;background:rgba(22,163,74,.14)}
    .dm-integ-badge-hacs{color:#6d28d9;background:rgba(139,92,246,.16)}
    .dm-integ-devices{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;min-width:0;min-height:0}
    .dm-integ-search{margin:0!important;width:100%!important;box-sizing:border-box!important}
    .dm-integ-device-list{display:flex;flex-direction:column;gap:6px;min-height:0;overflow-y:auto;padding-right:2px}
    .dm-integ-device{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name count" "meta count";gap:2px 10px;align-items:center;padding:10px 12px;border:1px solid var(--divider-color,#e2e8f0);border-radius:14px;background:var(--card-background-color,#fff);color:inherit;font:inherit;text-align:left;cursor:pointer}
    .dm-integ-device[aria-pressed="true"]{border-color:#0ea5e9;box-shadow:0 0 0 2px color-mix(in srgb,#0ea5e9 18%,transparent)}
    .dm-integ-device-name{grid-area:name;font-size:13.5px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-integ-device-meta{grid-area:meta;font-size:11px;font-weight:650;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-integ-device-count{grid-area:count;font-size:10.5px;font-weight:900;white-space:nowrap;color:#0369a1}
    .dm-integ-empty{padding:14px;font-size:12px;font-weight:700;color:var(--text-dim,#64748b);text-align:center}
    .dm-integ-preview{flex:0 1 auto;display:grid;align-content:start;gap:8px;max-height:46%;overflow-y:auto;padding:12px;border-radius:14px;border:1px solid color-mix(in srgb,#0ea5e9 35%,transparent);background:color-mix(in srgb,#0ea5e9 6%,transparent)}
    .dm-integ-preview[hidden]{display:none}
    .dm-integ-preview-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 10px;font-size:12px;color:var(--text-dim,#64748b);font-weight:650}
    .dm-integ-preview-head strong{font-size:14px;color:var(--text,#0f172a)}
    .dm-integ-preview-type b{color:#0369a1}
    .dm-integ-chips{display:flex;flex-wrap:wrap;align-items:flex-start;align-content:flex-start;gap:4px}
    .dm-integ-chip{padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:750;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#e2e8f0)}
    .dm-integ-chip-more{color:#0369a1;border-color:transparent;background:rgba(14,165,233,.14)}
    .dm-integ-fuori{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;gap:2px 10px!important;align-items:start!important;margin:12px 0 0!important;padding:11px 13px!important;border-radius:14px!important;border:1px solid color-mix(in srgb,#0ea5e9 32%,transparent)!important;background:color-mix(in srgb,#0ea5e9 7%,transparent)!important;cursor:pointer!important}
    .dm-integ-fuori input{margin:3px 0 0!important;width:16px!important;height:16px!important;accent-color:#0ea5e9!important}
    .dm-integ-fuori>span{display:grid!important;gap:3px!important;min-width:0!important}
    .dm-integ-fuori b{font-size:12.5px!important;font-weight:850!important}
    .dm-integ-fuori small{font-size:11px!important;line-height:1.45!important;color:var(--secondary-text-color,#64748b)!important}
    .dm-integ-fuori-ids code{font-size:10.5px!important;color:#0369a1!important;overflow-wrap:anywhere!important}
    .dm-integ-preview small{font-size:11px;font-weight:650;color:var(--text-dim,#64748b)}
    .dm-integ-confirm{margin:2px 0 0!important;padding:12px!important;background:linear-gradient(135deg,#0ea5e9,#0369a1)!important}
    @media(max-width:640px){
      .dm-integ-modal .dm-integ-dialog>header{padding:14px!important}
      .dm-integ-body{padding:12px 14px 14px}
      .dm-integ-columns{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
      /* Una fila che scorre di lato: senza la larghezza minima azzerata, la
         sua larghezza naturale — tutte le integrazioni una accanto all'altra —
         allargava la griglia, e con lei la finestra, oltre lo schermo del
         telefono. */
      .dm-integ-list{flex-direction:row;flex-wrap:nowrap;max-width:100%;overflow-x:auto;overflow-y:hidden;padding-bottom:4px}
      .dm-integ-item{flex:0 0 auto;min-width:150px;max-width:70vw}
    }
  `;
}

export function installApplianceIntegrationSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-appliance-integration-style", css());
  onEditorRedraw("__dmApplIntegrazione", () => root.queueMicrotask?.(vesteLaScheda));
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(vesteLaScheda));
  vesteLaScheda();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installApplianceIntegrationSection, { once: true });
} else {
  installApplianceIntegrationSection();
}
