import { applianceArtwork } from "../core/appliance-artwork.js";
import {
  APPLIANCE_CATALOG,
  applianceCatalogLabel,
  canonicalApplianceVisualKey,
  applianceVisualKey,
} from "../core/device-model.js";
import { apriIlFoglioDiScelta, chiudiIlFoglioDiScelta } from "./foglio-di-scelta-section.js";
import { iconGlyph } from "./icon-engine-section.js";
import {
  activeLocale,
  allStates,
  clean,
  dashboardStore,
  doc,
  esc,
  readJson,
  root,
  section,
  t,
  writeJsonIfChanged,
} from "./shared.js";
import { catalogLabel } from "../core/personalization-catalog.js";
import { bindApplianceToDevice, bindingLabel } from "../core/appliance-device-binding.js";
import { APPLIANCE_BINDING_FIELDS } from "../core/device-model.js";
/* Le regole dei comandi a parte sono quelle del robot (#306), e non se ne
 * scrive un secondo elenco per gli elettrodomestici (#338): quali domini
 * possono fare da comando, come si chiama un comando senza ripetere il nome
 * dell'apparecchio, quali entita' gli stanno accanto. Sono nate li' perche' li'
 * e' arrivata la domanda per prima; sono le stesse. */
import {
  comandiSuggeriti as comandiVicini,
  elencoComandi,
  genereDelComando,
  nomeDelComando,
} from "../core/robot-model.js";
import { apriMenuIntegrazioni } from "./appliance-integration-section.js";
import { CAMPI_SCELTI } from "../core/energy-loads-config.js";
import {
  eDiUnAltroApparecchio,
  paroleDegliAltri,
  paroleDellApparecchio,
} from "../core/entita-di-questo-apparecchio.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_APPLIANCE_EDITOR_SECTION__";
const state = (root[KEY] ||= { installed: false, previousEdit: null, previousPicker: null });

function locale() {
  return activeLocale();
}

function appliances() {
  const stored = dashboardStore()?.getSection?.("appliances");
  return Array.isArray(stored) ? stored.slice() : readJson("cd_appliances", []);
}

/* L'unico posto della sezione dove l'emoji resta, e non e' una scelta.
 *
 * «Non voglio vedere icone che non sono nostre»: giusto, e dappertutto qui
 * intorno adesso c'e' il disegno del catalogo. Qui no, e non per dimenticanza:
 * questa e' la tendina delle stanze, e dentro un `<option>` il browser disegna
 * TESTO — nessun elemento, nessun disegno, nemmeno un'immagine. Per mettercelo
 * bisognerebbe rifare la tendina come menu nostro, che e' un'altra cosa e un
 * altro lavoro. Finche' e' un `<select>`, l'emoji e' quello che si puo'. */
function roomIconEmoji(icon) {
  return iconGlyph("room", clean(icon) || "mdi:home") || "🏠";
}

function roomOptions(selected) {
  const rooms = section("rooms", readJson("cd_stanze", []));
  return [
    `<option value="">— ${t("Nessuna stanza", "No room")} —</option>`,
    ...rooms.map((room) => {
      const value = clean(room.id || room.name);
      const active = [room.id, room.name].map(clean).includes(clean(selected));
      return `<option value="${esc(value)}" ${active ? "selected" : ""}>${roomIconEmoji(room.icon)} ${esc(room.name || value)}</option>`;
    }),
  ].join("");
}

/* The flow circles an appliance can be filed under. Picking one here is the
 * whole configuration: the circle's value starts including this appliance, the
 * popup behind the circle starts listing it, and nothing has to be typed a
 * second time in the Loads editor. */
function flowLoadOptions(selected) {
  const loads = section("loads", readJson("cd_loads", []));
  const circles = (Array.isArray(loads) ? loads : []).filter(
    (item) =>
      item && item.category !== "manual-report" && !clean(item?.metadata?.beta27_subload_group),
  );
  return [
    `<option value="">— ${t("Nessuno", "None")} —</option>`,
    ...circles.map((load) => {
      const value = clean(load?.metadata?.flow_group) || clean(load.id);
      const label = clean(load.name) || value;
      const icon = clean(load.emoji_icon || load.icon) || "🔌";
      return `<option value="${esc(value)}" ${value === clean(selected) ? "selected" : ""}>${esc(icon)} ${esc(label)}</option>`;
    }),
  ].join("");
}

function editorVisualKey(value) {
  return canonicalApplianceVisualKey(value) || "";
}

/* La domanda «che disegno ha questo apparecchio» ha un proprietario solo, in
 * `core/device-model.js`: la faceva anche la tessera della Home, in un altro
 * modo, e lo stesso apparecchio usciva diverso nei due posti. */
const deviceVisualKey = applianceVisualKey;

function catalogItem(value) {
  const key = editorVisualKey(value) || "generico";
  return APPLIANCE_CATALOG.find((item) => item.key === key) || APPLIANCE_CATALOG.at(-1);
}

function typeIconMarkup(value, size = 42) {
  const key = editorVisualKey(value) || "generico";
  const legacy = root.cdApplianceIcon?.(key, size);
  if (legacy) return legacy;
  const artwork = applianceArtwork(key, size);
  if (artwork) return artwork;
  return `<span class="dm-appliance-editor-fallback">🔌</span>`;
}

function typeLabel(value) {
  return applianceCatalogLabel(value, locale());
}

/* La cornice — sfondo, scheda, titolo, Chiudi — e' quella condivisa: la stessa
 * che usa la tendina dei dispositivi del Report. Qui dentro ci va solo cosa si
 * sceglie, che e' una griglia di piastrelle. */
function openTypePicker({ selected = "generico", onSelect } = {}) {
  const selectedKey = editorVisualKey(selected) || "generico";
  const corpo = apriIlFoglioDiScelta({
    titolo: t("Scegli l'elettrodomestico", "Choose appliance"),
    id: "dm-applpick",
  });
  if (!corpo) return null;
  const grid = doc.createElement("div");
  grid.className = "dm-appliance-type-grid";
  grid.setAttribute("role", "listbox");
  APPLIANCE_CATALOG.forEach((item) => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-appliance-type-option";
    button.dataset.applianceType = item.key;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(item.key === selectedKey));
    button.innerHTML = `<span class="dm-appliance-type-option-icon">${typeIconMarkup(item.key, 30)}</span><span>${esc(catalogLabel(item))}</span>`;
    button.addEventListener("click", () => {
      chiudiIlFoglioDiScelta();
      onSelect?.(item.key);
    });
    grid.append(button);
  });
  corpo.append(grid);
  return corpo;
}

function installPickerOverride() {
  const current = root.dmAppliancePicker;
  if (typeof current !== "function" || current.__dmCanonicalAppliancePicker) return false;
  state.previousPicker ||= current;
  function canonicalAppliancePicker() {
    const hidden = doc.getElementById("appl-icon");
    const button = doc.getElementById("appl-icon-btn");
    const name = doc.getElementById("appl-name");
    openTypePicker({
      selected: hidden?.value || "generico",
      onSelect(key) {
        if (hidden) hidden.value = key;
        if (button) {
          button.innerHTML = typeIconMarkup(key, 30);
          button.dataset.applianceType = key;
          button.setAttribute("aria-label", typeLabel(key));
        }
        if (name && !clean(name.value)) name.value = typeLabel(key);
      },
    });
  }
  canonicalAppliancePicker.__dmCanonicalAppliancePicker = true;
  canonicalAppliancePicker.__dmPrevious = current;
  root.dmAppliancePicker = canonicalAppliancePicker;
  return true;
}

function entityCandidates(device = {}) {
  return [
    ...new Set(
      [
        device.control_entity,
        device.switch_entity,
        device.switch,
        device.light,
        device.fan,
        device.power_entity,
        device.power,
        device.power_sensor,
        ...(device.entities || []).map((entry) =>
          clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id),
        ),
      ]
        .map(clean)
        .filter(Boolean),
    ),
  ];
}

function inferredControlEntity(device) {
  return (
    entityCandidates(device).find((entity) =>
      /^(switch|light|input_boolean|fan)\./i.test(entity),
    ) || ""
  );
}

function inferredPowerEntity(device) {
  const candidates = entityCandidates(device);
  const states = allStates();
  return (
    candidates.find((entity) => {
      const current = states[entity];
      const unit = clean(current?.attributes?.unit_of_measurement).toLowerCase();
      return ["w", "kw", "mw"].includes(unit);
    }) || ""
  );
}

/* Se accanto al select «Carico energia» va acceso il suggerimento.
 *
 * Un elettrodomestico con la potenza mappata è esattamente quello che un
 * cerchio del flusso sa sommare: se non è ancora dentro nessun carico, vale la
 * pena dirlo lì dove si sceglie. Appena un gruppo è scelto il suggerimento non
 * ha più niente da suggerire, e sparisce. */
export function flowGroupSuggested(device = {}) {
  if (clean(device?.metadata?.beta27_subload_group)) return false;
  return Boolean(
    clean(device?.power_entity || device?.power || device?.power_sensor) ||
    inferredPowerEntity(device),
  );
}

function cumulativeEntity(value) {
  const entity = clean(value);
  if (!entity) return false;
  const current = allStates()[entity];
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  if (current && stateClass) return false;
  return /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(entity);
}

function entityField(name, label, value, help = "") {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${label}</span><span class="ed-form-row"><input class="ed-input mono" name="${name}" value="${esc(value)}"><button type="button" class="dm-entity-picker" data-pick="${name}" aria-label="${t("Seleziona entità", "Select entity")}">🔍</button></span>${help ? `<small>${help}</small>` : ""}</label>`;
}

function numberField(name, label, value, help = "", { step = "0.1", placeholder = "" } = {}) {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${label}</span><input class="ed-input" type="number" step="${step}" name="${name}" value="${esc(value ?? "")}" placeholder="${esc(placeholder)}">${help ? `<small>${help}</small>` : ""}</label>`;
}

function textField(name, label, value, help = "", placeholder = "") {
  return `<label class="ed-slot"><span class="ed-slot-lbl">${label}</span><input class="ed-input" name="${name}" value="${esc(value ?? "")}" placeholder="${esc(placeholder)}" autocomplete="off">${help ? `<small>${help}</small>` : ""}</label>`;
}

const CARD_FIELD_KEYS = [
  "state_entity",
  "remaining_entity",
  "cycle_duration_entity",
  "cycle_minutes",
  "off_delay_minutes",
  "temperature_entity",
  "temperature_entity_2",
  "temp_min",
  "temp_max",
  "max_power",
  "price_kwh",
  "door_entity",
  "alert_entity",
  "last_start_entity",
  "last_duration_entity",
  "last_energy_entity",
  "last_cost_entity",
];

function cardFieldsMarkup(device = {}) {
  const value = (key) => (device[key] == null ? "" : device[key]);
  const configured =
    clean(device.image || device.image_url) ||
    CARD_FIELD_KEYS.some((key) => clean(device[key]) !== "");
  return `<details class="dm-appliance-card-fields"${configured ? " open" : ""}>
    <summary>🧩 ${t("Card avanzata — immagine, ciclo, temperatura, costi", "Advanced card — image, cycle, temperature, costs")}</summary>
    <div class="dm-appliance-card-fields-intro">${t(
      "Tutti i campi sono facoltativi: la card mostra automaticamente ciò che è disponibile. Avvio, durata, consumo e costo dell'ultimo ciclo vengono calcolati da soli dalle transizioni di potenza se non indichi entità dedicate.",
      "Every field is optional: the card automatically shows what is available. Start, duration, energy and cost of the last cycle are computed automatically from power transitions unless you provide dedicated entities.",
    )}</div>
    <section class="dm-appliance-entity-grid">
      ${textField("image_url", t("Immagine personalizzata (URL)", "Custom image (URL)"), device.image || device.image_url, t("Foto reale del tuo elettrodomestico mostrata al posto dell'illustrazione.", "Real photo of your appliance shown instead of the artwork."), "https://…/lavatrice.png")}
      ${entityField("state_entity", t("Entità stato programma", "Program state entity"), device.state_entity, t("Sensore con lo stato del programma (running, idle…): ha priorità sulle soglie in watt.", "Sensor with the program state (running, idle…): takes priority over the watt thresholds."))}
      ${entityField("remaining_entity", t("Tempo rimanente", "Remaining time"), device.remaining_entity, t("Sensore minuti, hh:mm o timestamp di fine: alimenta l'anello del conto alla rovescia.", "Minutes, hh:mm or end timestamp sensor: feeds the countdown ring."))}
      ${entityField("cycle_duration_entity", t("Durata programma", "Program duration"), device.cycle_duration_entity, t("Facoltativa: durata totale del programma per la percentuale dell'anello.", "Optional: total program duration for the ring percentage."))}
      ${numberField("cycle_minutes", t("Durata ciclo fissa (minuti)", "Fixed cycle duration (minutes)"), value("cycle_minutes"), t("Alternativa semplice alla durata da entità.", "Simple alternative to the duration entity."), { step: "1", placeholder: "es. 120" })}
      ${entityField("temperature_entity", t("Entità temperatura", "Temperature entity"), device.temperature_entity, t("Per frigo e congelatore: mostra la barra temperatura al posto della potenza.", "For fridge and freezer: shows the temperature strip instead of the power bar."))}
      ${entityField("temperature_entity_2", t("Seconda temperatura (facoltativa)", "Second temperature (optional)"), device.temperature_entity_2, t("Un frigorifero con il congelatore sono due vani: qui il secondo. Con due caselle piene la card disegna due barre.", "A fridge with a freezer is two compartments: the second one goes here. With both boxes filled the card draws two strips."))}
      ${numberField("temp_min", t("Temperatura min (barra)", "Min temperature (bar)"), value("temp_min"), "", { step: "0.5", placeholder: "0" })}
      ${numberField("temp_max", t("Temperatura max (barra)", "Max temperature (bar)"), value("temp_max"), "", { step: "0.5", placeholder: "10" })}
      ${numberField("max_power", t("Potenza massima (W)", "Maximum power (W)"), value("max_power"), t("Scala della barra Potenza attuale. Vuoto = valore tipico per il tipo.", "Scale of the current power bar. Empty = typical value for the type."), { step: "50", placeholder: "es. 2200" })}
      ${numberField("price_kwh", t("Costo energia (€/kWh)", "Energy cost (€/kWh)"), value("price_kwh"), t("Vuoto = tariffa della sezione Energia.", "Empty = tariff from the Energy section."), { step: "0.001", placeholder: "es. 0.25" })}
      ${numberField("threshold_standby", t("Soglia standby (W)", "Standby threshold (W)"), value("threshold_standby") === "" ? (device.metadata?.threshold_standby ?? "") : value("threshold_standby"), t("Sotto la soglia In funzione e sopra questa = Standby.", "Below the running threshold and above this = Standby."), { step: "0.1", placeholder: "1" })}
      ${numberField("off_delay_minutes", t("Ritardo fine ciclo (minuti)", "End-of-cycle delay (minutes)"), value("off_delay_minutes"), t("La card resta In funzione per questi minuti dopo l'ultima potenza sopra soglia: copre l'asciugatura a 0 W della lavastoviglie e le pause del ciclo.", "The card stays Running for these minutes after the last power reading above the threshold: it covers the dishwasher's 0 W drying phase and mid-cycle pauses."), { step: "1", placeholder: "es. 30" })}
      ${entityField("door_entity", t("Entità porta", "Door entity"), device.door_entity, t("Il classico sensore porta: la card dice «Porta aperta» quando resta aperta. Su un frigorifero è l'unica cosa che vale la pena sapere di sfuggita.", "The usual door contact: the card says “Door open” while it stays open. On a fridge that is the one thing worth knowing at a glance."))}
      ${entityField("alert_entity", t("Entità allarme/anomalia", "Alarm/problem entity"), device.alert_entity, t("binary_sensor di problema: accende il contatore Allarme.", "Problem binary_sensor: feeds the Alarm counter."))}
      ${entityField("last_start_entity", t("Ultimo ciclo · avvio", "Last cycle · start"), device.last_start_entity, t("Timestamp di avvio fornito dall'integrazione (es. Home Connect).", "Start timestamp provided by the integration (e.g. Home Connect)."))}
      ${entityField("last_duration_entity", t("Ultimo ciclo · durata", "Last cycle · duration"), device.last_duration_entity)}
      ${entityField("last_energy_entity", t("Ultimo ciclo · consumo (kWh)", "Last cycle · energy (kWh)"), device.last_energy_entity)}
      ${entityField("last_cost_entity", t("Ultimo ciclo · costo (€)", "Last cycle · cost (€)"), device.last_cost_entity)}
    </section>
  </details>`;
}

/* ── gli altri comandi dell'apparecchio (#338) ─────────────────────────────
 *
 * «Sto provando ad integrare l'asciugatrice con hOn. Non ha un'entita'
 * comando, ma da documentazione posso far partire il comando con
 * `hon.start_program` e `program: rapid_30`. Come posso integrare questo nella
 * sezione dell'asciugatrice?»
 *
 * Fino a qui un apparecchio sapeva premere solo entita': interruttori, menu,
 * numeri, tasti. Una chiamata di servizio con i suoi parametri non e'
 * nessuna di quelle — ma avvolta in uno script di tre righe diventa
 * `script.asciugatrice_rapido_30`, che e' un'entita' come le altre. Il robot
 * aveva gia' questo campo (#306) e le regole stanno in un posto solo: qui si
 * scelgono le entita', di la' si disegnano.
 *
 * Non si salva niente finche' non si preme il tasto in fondo: l'elenco vive in
 * un campo nascosto del modulo, come il collegamento all'integrazione. */
function chipComandoMarkup(entity, azione, segno, apparecchio, states) {
  return `<button type="button" class="dm-appl-cmd-chip" data-${azione}="${esc(entity)}" data-genere="${esc(genereDelComando(entity))}" title="${esc(entity)}"><span>${esc(nomeDelComando(entity, apparecchio, states))}</span><i aria-hidden="true">${segno}</i></button>`;
}

/* L'apparecchio come lo vede il vocabolario dei comandi: la sua entita' e i
 * comandi gia' scelti. L'entita' serve a due cose — togliere il suo nome
 * davanti a quello dei comandi, e riconoscere quelli che gli stanno accanto. */
function apparecchioDeiComandi(values, scelti) {
  return {
    entity: clean(values.control_entity || values.state_entity || values.power_entity),
    /* Il nome scritto nella scheda: serve a togliere «Asciugatrice» davanti a
     * «Asciugatrice Rapido 30», anche quando l'apparecchio non ha nessuna
     * entita' comando — che e' proprio il caso di chi ha aperto #338. */
    name: clean(values.name),
    comandi: scelti,
  };
}

/* Quello che sta accanto all'apparecchio e potrebbe essere un suo comando: le
 * entita' comandabili del dispositivo collegato, piu' quelle che portano il
 * suo nome o il suo id. Sono proposte, non scelte. */
function comandiProposti(values, snapshot, scelti) {
  const states = allStates();
  const gia = new Set(scelti);
  const dalDispositivo = (Array.isArray(snapshot) ? snapshot : []).filter(
    (id) => genereDelComando(id) && !gia.has(id),
  );
  const accanto = comandiVicini(apparecchioDeiComandi(values, scelti), states);
  return [...new Set([...dalDispositivo, ...accanto])].slice(0, 18);
}

function comandiExtraMarkup(device) {
  const scelti = elencoComandi(device.comandi);
  return `<section class="ed-slot dm-appl-comandi" data-appl-comandi>
    <span class="ed-slot-lbl">${t("Altri comandi", "Other commands")}</span>
    <input type="hidden" name="comandi" value="${esc(scelti.join(","))}">
    <div class="dm-appl-cmd-chips" data-appl-comandi-scelti></div>
    <!-- La lente non si disegna qui: il campo dichiara di volere un'entita' —
         col suo placeholder — e la scheda di casa gli mette addosso la SUA
         pastiglia «Scegli entità», con la matita per scriverla a mano. Averne
         una nostra accanto vorrebbe dire due lenti per lo stesso campo. -->
    <span class="ed-form-row">
      <input id="dm-appl-comando" class="ed-input mono" data-appl-comando-nuovo placeholder="script.asciugatrice_rapido_30" autocomplete="off" spellcheck="false">
      <button type="button" class="dm-appl-cmd-add" data-appl-cmd-add aria-label="${t("Aggiungi comando", "Add command")}" title="${t("Aggiungi comando", "Add command")}">＋</button>
    </span>
    <output class="dm-appl-cmd-error" data-appl-cmd-error></output>
    <small class="dm-appl-cmd-proposte-lbl" data-appl-comandi-proposti-lbl hidden>${t("Trovati accanto all'apparecchio — un tocco li aggiunge:", "Found next to the appliance — one tap adds them:")}</small>
    <div class="dm-appl-cmd-chips dm-appl-cmd-proposte" data-appl-comandi-proposti></div>
    <small>${t(
      "I programmi e le regolazioni che non hanno un interruttore: entità button.*, select.*, switch.* (e input_*, script.*, scene.*, automation.*). Compaiono come tasti nella finestra dell'apparecchio. Un servizio con parametri — hon.start_program con il suo programma — si avvolge in uno script di tre righe e da lì in poi è un'entità come le altre.",
      "The programs and settings without a switch of their own: button.*, select.*, switch.* entities (plus input_*, script.*, scene.*, automation.*). They show up as buttons in the appliance window. A service with parameters — hon.start_program with its program — goes into a three-line script, and from then on it is an entity like any other.",
    )}</small>
  </section>`;
}

/* Le pastiglie si ridisegnano da sole: quello che c'e' scritto nel campo
 * nascosto E' l'elenco, e le proposte cambiano con lui. */
function disegnaComandi(modal, form) {
  const blocco = modal.querySelector("[data-appl-comandi]");
  if (!blocco) return;
  const states = allStates();
  const values = Object.fromEntries(new FormData(form).entries());
  const scelti = elencoComandi(values.comandi);
  const apparecchio = apparecchioDeiComandi(values, scelti);
  const cassetto = blocco.querySelector("[data-appl-comandi-scelti]");
  if (cassetto)
    cassetto.innerHTML = scelti.length
      ? scelti
          .map((entity) => chipComandoMarkup(entity, "appl-cmd-del", "✕", apparecchio, states))
          .join("")
      : `<small class="dm-appl-cmd-vuoto">${esc(t("Nessun comando in più: la finestra ha quelli dell'apparecchio e basta.", "No extra command: the window carries the appliance's own and nothing else."))}</small>`;
  const proposte = comandiProposti(values, bindingSnapshot(values), scelti);
  const cassettoProposte = blocco.querySelector("[data-appl-comandi-proposti]");
  const etichettaProposte = blocco.querySelector("[data-appl-comandi-proposti-lbl]");
  if (cassettoProposte)
    cassettoProposte.innerHTML = proposte
      .map((entity) => chipComandoMarkup(entity, "appl-cmd-sug", "＋", apparecchio, states))
      .join("");
  if (etichettaProposte) etichettaProposte.hidden = proposte.length === 0;
}

function wireComandi(modal, form) {
  const blocco = modal.querySelector("[data-appl-comandi]");
  if (!blocco) return;
  const nascosto = form.elements.comandi;
  const errore = blocco.querySelector("[data-appl-cmd-error]");
  const scrivi = (elenco) => {
    nascosto.value = elencoComandi(elenco).join(",");
    disegnaComandi(modal, form);
  };
  blocco.addEventListener("click", (event) => {
    const togli = event.target.closest("[data-appl-cmd-del]");
    const proposta = event.target.closest("[data-appl-cmd-sug]");
    const aggiungi = event.target.closest("[data-appl-cmd-add]");
    if (!togli && !proposta && !aggiungi) return;
    event.preventDefault();
    const casella = blocco.querySelector("[data-appl-comando-nuovo]");
    const scelti = elencoComandi(nascosto.value);
    if (togli) {
      if (errore) errore.textContent = "";
      scrivi(scelti.filter((entity) => entity !== clean(togli.dataset.applCmdDel)));
      return;
    }
    const nuovo = proposta ? clean(proposta.dataset.applCmdSug) : clean(casella?.value);
    if (!genereDelComando(nuovo)) {
      if (errore)
        errore.textContent = t(
          "Serve un'entità button.*, select.* o switch.* — oppure input_button, input_select, input_boolean, script, scene.",
          "A button.*, select.* or switch.* entity is required — or input_button, input_select, input_boolean, script, scene.",
        );
      return;
    }
    if (errore) errore.textContent = "";
    if (casella && !proposta) casella.value = "";
    scrivi([...scelti, nuovo]);
  });
  disegnaComandi(modal, form);
}

/* Le entita' dell'apparecchio dopo un salvataggio: le caselle della maschera,
 * piu' quelle che aveva gia' e che non sono di un altro apparecchio (#417).
 *
 * Il setaccio serve perche' l'elenco `entities` non lo scrive nessuno a mano:
 * lo riempiva la passata che indovina dai nomi, e quando sbagliava ci lasciava
 * dentro i sensori del frigorifero accanto. Da qui in poi le caselle sono
 * scelte — `dm_campi_scelti` le blocca — quindi quello che resta nell'elenco
 * resta per sempre: se non si toglie adesso non si toglie piu'. */
function normalizeEntities(device, values, elenco = []) {
  const parole = paroleDellApparecchio(device);
  const altrui = paroleDegliAltri(device, elenco);
  return [
    ...new Set(
      [
        values.control_entity,
        values.power_entity,
        values.energy_entity,
        values.daily_energy_entity,
        values.monthly_energy_entity,
        values.total_energy_entity,
        values.history_entity,
        values.report_entity,
        ...(device.entities || [])
          .map((entry) =>
            clean(typeof entry === "string" ? entry : entry?.entity || entry?.entity_id),
          )
          .filter((entity) => !eDiUnAltroApparecchio(entity, parole, altrui)),
      ].filter(Boolean),
    ),
  ];
}

async function saveAppliance(index, next) {
  const list = appliances();
  list[index] = next;
  const store = dashboardStore();
  if (store?.replaceSection) await store.replaceSection("appliances", list);
  else {
    writeJsonIfChanged("cd_appliances", list);
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  root.renderAppliances?.();
  root.renderApplianceSection?.(true);
  root.cdRebuildReportDevices?.();
  root.buildReportSelect?.();
}

function updateEditType(modal, key) {
  const canonical = editorVisualKey(key) || "generico";
  const hidden = modal.querySelector('input[name="icon"]');
  const preview = modal.querySelector("[data-icon-preview]");
  const trigger = modal.querySelector("[data-type-trigger]");
  if (hidden) hidden.value = canonical;
  if (preview) {
    preview.innerHTML = typeIconMarkup(canonical, 58);
    preview.dataset.dmPreviewSource = "canonical-picker";
    preview.setAttribute("aria-label", typeLabel(canonical));
  }
  if (trigger) {
    trigger.dataset.applianceType = canonical;
    trigger.innerHTML = `<span class="dm-appliance-type-trigger-icon">${typeIconMarkup(canonical, 30)}</span><span class="dm-appliance-type-trigger-label">${esc(typeLabel(canonical))}</span><span class="dm-appliance-type-chevron" aria-hidden="true">⌄</span>`;
    trigger.setAttribute(
      "aria-label",
      `${t("Tipo / immagine", "Type / artwork")}: ${typeLabel(canonical)}`,
    );
  }
}

/* Il blocco «Integrazione» in cima alla finestra di modifica.
 *
 * E' la stessa finestra di prima con, sopra le caselle, il dispositivo da cui
 * l'apparecchio arriva: quale integrazione, quale dispositivo, quante entita'.
 * Da qui si collega un apparecchio nato a mano — e le caselle vuote si
 * compilano da sole — o si cambia dispositivo, o si scollega. Il collegamento
 * viaggia in campi nascosti del modulo e si salva col tasto in fondo, come
 * tutto il resto: niente si scrive prima di quel tasto. */
const ROLE_WORDS = Object.freeze({
  power_entity: ["potenza", "power"],
  daily_energy_entity: ["energia giornaliera", "daily energy"],
  monthly_energy_entity: ["energia mensile", "monthly energy"],
  total_energy_entity: ["energia totale", "total energy"],
  last_energy_entity: ["consumo dell'ultimo ciclo", "last cycle energy"],
  state_entity: ["stato programma", "program state"],
  remaining_entity: ["tempo rimanente", "remaining time"],
  cycle_duration_entity: ["durata programma", "program duration"],
  temperature_entity: ["temperatura", "temperature"],
  temperature_entity_2: ["seconda temperatura", "second temperature"],
  control_entity: ["comando", "control"],
  alert_entity: ["allarme", "alarm"],
  last_start_entity: ["avvio dell'ultimo ciclo", "last cycle start"],
  last_cost_entity: ["costo dell'ultimo ciclo", "last cycle cost"],
});

function roleWord(role) {
  const pair = ROLE_WORDS[role];
  return pair ? t(pair[0], pair[1]) : "";
}

function bindingMarkup(device = {}) {
  const hidden = APPLIANCE_BINDING_FIELDS.map(
    (key) => `<input type="hidden" name="${key}" value="${esc(device[key] ?? "")}">`,
  ).join("");
  const snapshot = Array.isArray(device.device_entities) ? device.device_entities : [];
  return `<section class="dm-appliance-binding" data-binding data-bound="${clean(device.device_id) ? "true" : "false"}">
    ${hidden}<input type="hidden" name="device_entities" value="${esc(JSON.stringify(snapshot))}">
    <div class="dm-appliance-binding-text"><strong data-binding-title></strong><small data-binding-note></small></div>
    <div class="dm-appliance-binding-actions">
      <button type="button" class="ed-btn-add dm-appliance-binding-link" data-binding-link></button>
      <button type="button" class="ed-btn-add dm-appliance-binding-unlink" data-binding-unlink>✂️ ${t("Scollega", "Unlink")}</button>
    </div>
  </section>`;
}

function bindingSnapshot(values) {
  try {
    const parsed = JSON.parse(values.device_entities || "[]");
    return Array.isArray(parsed) ? parsed.map(clean).filter((id) => id.includes(".")) : [];
  } catch (_error) {
    return [];
  }
}

function paintBinding(modal, form, note = "") {
  const box = modal.querySelector("[data-binding]");
  if (!box) return;
  const values = Object.fromEntries(new FormData(form).entries());
  const bound = Boolean(clean(values.device_id));
  box.dataset.bound = String(bound);
  const title = box.querySelector("[data-binding-title]");
  const small = box.querySelector("[data-binding-note]");
  const link = box.querySelector("[data-binding-link]");
  if (bound) {
    const label = bindingLabel(
      { ...values, device_entities: bindingSnapshot(values) },
      activeLocale(),
    );
    title.textContent = `🔗 ${clean(values.device_name) || t("Dispositivo collegato", "Linked device")}${label ? ` · ${label}` : ""}`;
    small.textContent =
      note ||
      t(
        "Nel dettaglio dell'apparecchio escono tutte le entità del dispositivo; qui sotto quelle che disegnano la card.",
        "The appliance detail shows every entity of the device; below, the ones that draw the card.",
      );
    link.textContent = `🔁 ${t("Cambia dispositivo", "Change device")}`;
  } else {
    title.textContent = `🔗 ${t("Collega a un'integrazione", "Link to an integration")}`;
    small.textContent =
      note ||
      t(
        "hOn, Home Connect, Miele, LG ThinQ, una presa Shelly…: scegli il dispositivo e le caselle vuote si compilano da sole. Quelle scritte a mano restano.",
        "hOn, Home Connect, Miele, LG ThinQ, a Shelly plug…: pick the device and the empty fields fill themselves in. The ones written by hand stay.",
      );
    link.textContent = `🔗 ${t("Scegli il dispositivo", "Pick the device")}`;
  }
  /* Collegare o scollegare un dispositivo cambia quali comandi gli stanno
   * accanto (#338): le proposte si rifanno insieme alla fascia. */
  disegnaComandi(modal, form);
}

function wireBinding(modal, form, device) {
  const box = modal.querySelector("[data-binding]");
  if (!box) return;
  paintBinding(modal, form);
  box.querySelector("[data-binding-link]")?.addEventListener("click", () => {
    apriMenuIntegrazioni({
      onScelto({ integration, device: chosen, entities, outside }) {
        const values = Object.fromEntries(new FormData(form).entries());
        const icon = editorVisualKey(values.icon) || deviceVisualKey(device);
        const draft = { ...device, ...values, icon, visual_key: icon, device_type: icon };
        const rooms = section("rooms", readJson("cd_stanze", []));
        const { appliance, filled } = bindApplianceToDevice(draft, {
          integration,
          device: chosen,
          entities,
          outside,
          states: allStates(),
          rooms,
        });
        for (const key of APPLIANCE_BINDING_FIELDS) {
          if (form.elements[key]) form.elements[key].value = appliance[key] ?? "";
        }
        form.elements.device_entities.value = JSON.stringify(appliance.device_entities || []);
        for (const role of filled) {
          const field = form.elements[role];
          if (field && !clean(field.value)) field.value = appliance[role];
        }
        if (form.elements.name && !clean(form.elements.name.value))
          form.elements.name.value = appliance.name;
        if (appliance.visual_key !== icon) updateEditType(modal, appliance.visual_key);
        const room = form.elements.room_id;
        if (room && !clean(room.value) && appliance.room_id) room.value = appliance.room_id;
        if (filled.some((role) => CARD_FIELD_KEYS.includes(role)))
          modal.querySelector(".dm-appliance-card-fields")?.setAttribute("open", "");
        const words = filled.map(roleWord).filter(Boolean);
        const count = words.length;
        const list = words.join(", ");
        paintBinding(
          modal,
          form,
          count
            ? t(`Compilate ${count} caselle: ${list}.`, `Filled ${count} fields: ${list}.`)
            : t(
                "Nessuna casella vuota da compilare: quelle scritte a mano restano.",
                "No empty field to fill in: the ones written by hand stay.",
              ),
        );
      },
    });
  });
  box.querySelector("[data-binding-unlink]")?.addEventListener("click", () => {
    for (const key of APPLIANCE_BINDING_FIELDS) {
      if (form.elements[key]) form.elements[key].value = "";
    }
    form.elements.device_entities.value = "[]";
    paintBinding(
      modal,
      form,
      t(
        "Scollegato: le caselle restano come sono, e si salva col tasto in fondo.",
        "Unlinked: the fields stay as they are, and the button at the bottom saves.",
      ),
    );
  });
}

export function openApplianceEditor(index) {
  const device = appliances()[index];
  if (!device) return false;
  doc?.getElementById("dm-appliance-editor-modal")?.remove();
  const visual = deviceVisualKey(device);
  const totalInitial =
    [device.total_energy_entity, device.history_entity, device.report_entity]
      .map(clean)
      .find(cumulativeEntity) || "";
  const controlInitial =
    clean(device.control_entity || device.switch_entity) || inferredControlEntity(device);
  const powerInitial =
    clean(device.power_entity || device.power || device.power_sensor) ||
    inferredPowerEntity(device);
  const modal = doc.createElement("div");
  modal.id = "dm-appliance-editor-modal";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog dm-appliance-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-appliance-editor-title">
    <header><strong id="dm-appliance-editor-title">🔌 ${t("Modifica elettrodomestico", "Edit appliance")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header>
    <form data-form>
      ${bindingMarkup(device)}
      <div class="dm-modal-grid dm-appliance-main-fields">
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><input class="ed-input" name="name" value="${esc(device.name)}" required></label>
        <label class="ed-slot dm-appliance-icon-field"><span class="ed-slot-lbl">${t("Tipo / immagine", "Type / artwork")}</span><input type="hidden" name="icon" value="${esc(visual)}"><span class="dm-appliance-icon-row"><span class="dm-appliance-icon-preview" data-icon-preview data-dm-preview-source="canonical-picker" aria-hidden="false"></span><button type="button" class="ed-input dm-appliance-type-trigger" data-type-trigger aria-haspopup="listbox"></button></span><small>${t("Usa lo stesso catalogo e la stessa icona azzurra della prima configurazione.", "Uses the same catalog and blue icon as the first configuration.")}</small></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><select class="ed-input" name="room_id">${roomOptions(device.room_id || device.room)}</select></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Carico energia", "Energy load")}</span><select class="ed-input" name="flow_group" data-dm-appliance-flow-group>${flowLoadOptions(device.metadata?.beta27_subload_group)}</select><small class="dm-appliance-flow-suggestion" data-dm-flow-suggestion${flowGroupSuggested(device) ? "" : " hidden"}>✨ ${t("Suggerito: ha una potenza mappata", "Suggested: it has a mapped power sensor")}</small><small>${t("Il cerchio del flusso in cui rientra. Il suo valore diventa la somma dei dispositivi assegnati, e il popup del cerchio lo elenca: non serve riconfigurarlo nei Carichi.", "The flow circle it belongs to. That circle becomes the total of the appliances assigned to it and its popup lists them, with nothing to configure again under Loads.")}</small></label>
        <label class="ed-slot"><span class="ed-slot-lbl">${t("Soglia in funzione", "Running threshold")}</span><input class="ed-input" type="number" step="0.1" min="0" name="threshold_run" value="${esc(device.threshold_run ?? device.metadata?.threshold_run ?? 5)}"><small>${t("Potenza in watt oltre la quale la card risulta accesa.", "Power in watts above which the card is shown as running.")}</small></label>
      </div>
      <section class="dm-appliance-entity-grid">
        ${entityField("control_entity", t("Entità comando", "Control entity"), controlInitial, t("Switch, light, fan o input_boolean usato dal pulsante Accendi/Spegni.", "Switch, light, fan or input_boolean used by the On/Off button."))}
        <label class="ed-check dm-appliance-switch-off"><input type="checkbox" name="switch_disabled"${device.switch_disabled ? " checked" : ""}> ${t("Senza tasto Accendi/Spegni", "Without the On/Off button")}<small>${t("L'entità comando resta per leggere lo stato, ma la card non mostra l'interruttore: il frigo non si spegne per sbaglio.", "The control entity still reads the state, but the card hides the switch: the fridge cannot be turned off by mistake.")}</small></label>
        ${entityField("power_entity", t("Potenza istantanea", "Instant power"), powerInitial, t("Sensore W o kW mostrato nella card.", "W or kW sensor shown on the card."))}
        ${entityField("daily_energy_entity", t("Energia giornaliera", "Daily energy"), device.daily_energy_entity, t("Facoltativa: sostituisce il calcolo del giorno.", "Optional: overrides the daily calculation."))}
        ${entityField("monthly_energy_entity", t("Energia mensile", "Monthly energy"), device.monthly_energy_entity, t("Facoltativa: sostituisce il calcolo del mese corrente.", "Optional: overrides the current-month calculation."))}
        ${entityField("total_energy_entity", t("Energia totale per storico e Report", "Total energy for history and Report"), totalInitial, t("Deve essere un contatore cumulativo kWh con state_class total o total_increasing. Non usare qui il sensore mensile: questo campo serve per ricostruire anche i mesi precedenti.", "This must be a cumulative kWh meter with state_class total or total_increasing. Do not use the monthly sensor here: this field is required to reconstruct previous months."))}
      </section>
      ${comandiExtraMarkup(device)}
      ${cardFieldsMarkup(device)}
      <output data-error></output>
      <footer><button type="button" class="ed-btn-add" data-cancel>${t("Annulla", "Cancel")}</button><button type="submit" class="ed-save-btn">💾 ${t("Salva modifiche", "Save changes")}</button></footer>
    </form>
  </section>`;
  doc.body.append(modal);
  const form = modal.querySelector("[data-form]");
  const close = () => modal.remove();
  updateEditType(modal, visual);
  wireBinding(modal, form, device);
  wireComandi(modal, form);
  modal.querySelector("[data-type-trigger]")?.addEventListener("click", () => {
    openTypePicker({
      selected: form.elements.icon.value,
      onSelect: (key) => updateEditType(modal, key),
    });
  });
  /* Il suggerimento vive e muore col select: appena un gruppo è scelto non c'è
   * più niente da suggerire; tolto il gruppo, se la potenza c'è, riappare. */
  const flowSelect = modal.querySelector("[data-dm-appliance-flow-group]");
  const flowSuggestion = modal.querySelector("[data-dm-flow-suggestion]");
  if (flowSelect && flowSuggestion)
    flowSelect.addEventListener("change", () => {
      flowSuggestion.hidden = Boolean(clean(flowSelect.value)) || !powerInitial;
    });
  modal
    .querySelectorAll("[data-close],[data-cancel]")
    .forEach((button) => button.addEventListener("click", close));
  modal
    .querySelectorAll("[data-pick]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        root.wzPickEntity?.(form.elements[button.dataset.pick]),
      ),
    );
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const name = clean(values.name);
    const total = clean(values.total_energy_entity);
    const totalState = allStates()[total];
    const stateClass = clean(totalState?.attributes?.state_class).toLowerCase();
    if (!name) {
      form.querySelector("[data-error]").textContent = t("Inserisci il nome.", "Enter a name.");
      return;
    }
    if (total && totalState && !["total", "total_increasing"].includes(stateClass)) {
      form.querySelector("[data-error]").textContent = t(
        "Il sensore Energia totale deve avere state_class total o total_increasing.",
        "The Total energy sensor must have state_class total or total_increasing.",
      );
      return;
    }
    const visualKey = editorVisualKey(values.icon) || deviceVisualKey(device);
    const existingReport = clean(device.report_entity);
    const image = clean(values.image_url);
    const next = {
      ...device,
      name,
      icon: visualKey,
      visual_key: visualKey,
      device_type: visualKey,
      visual_type: "asset",
      room_id: clean(values.room_id),
      metadata: { ...(device.metadata || {}), beta27_subload_group: clean(values.flow_group) },
      threshold_run: Number.isFinite(Number(values.threshold_run))
        ? Number(values.threshold_run)
        : 5,
      control_entity: clean(values.control_entity),
      /* Una casella non spuntata non entra nel FormData: qui il silenzio
       * significa «tasto abilitato», che e' il comportamento di sempre. */
      switch_disabled: values.switch_disabled === "on",
      power_entity: clean(values.power_entity),
      daily_energy_entity: clean(values.daily_energy_entity),
      monthly_energy_entity: clean(values.monthly_energy_entity),
      total_energy_entity: total,
      history_entity: total,
      // Report can intentionally use a monthly/current-period sensor. Editing
      // the lifetime meter must not overwrite that independent Report choice.
      report_entity: existingReport || total,
      // Showcase card fields: strings stay as typed, numbers are validated by
      // normalizeDevice (empty values are dropped instead of becoming 0).
      image,
      image_url: image,
      state_entity: clean(values.state_entity),
      remaining_entity: clean(values.remaining_entity),
      cycle_duration_entity: clean(values.cycle_duration_entity),
      cycle_minutes: clean(values.cycle_minutes),
      off_delay_minutes: clean(values.off_delay_minutes),
      temperature_entity: clean(values.temperature_entity),
      temperature_entity_2: clean(values.temperature_entity_2),
      temp_min: clean(values.temp_min),
      temp_max: clean(values.temp_max),
      max_power: clean(values.max_power),
      price_kwh: clean(values.price_kwh),
      threshold_standby: clean(values.threshold_standby),
      alert_entity: clean(values.alert_entity),
      last_start_entity: clean(values.last_start_entity),
      last_duration_entity: clean(values.last_duration_entity),
      last_energy_entity: clean(values.last_energy_entity),
      last_cost_entity: clean(values.last_cost_entity),
    };
    /* Il collegamento all'integrazione, com'e' nei campi nascosti: vuoto
     * vuol dire scollegato, e i campi spariscono invece di restare a meta'. */
    for (const key of APPLIANCE_BINDING_FIELDS) {
      const value = clean(values[key]);
      if (value) next[key] = value;
      else delete next[key];
    }
    const snapshot = bindingSnapshot(values);
    if (clean(values.device_id) && snapshot.length) next.device_entities = snapshot;
    else delete next.device_entities;
    /* Gli altri comandi (#338): quello che c'e' scritto nel campo nascosto,
     * ripulito. Un elenco vuoto non e' una configurazione — il campo se ne va,
     * cosi' un apparecchio senza comandi in piu' resta com'era. */
    const comandi = elencoComandi(values.comandi);
    if (comandi.length) next.comandi = comandi;
    else delete next.comandi;
    if (next.threshold_standby === "") delete next.threshold_standby;
    for (const key of [
      "cycle_minutes",
      "off_delay_minutes",
      "temp_min",
      "temp_max",
      "max_power",
      "price_kwh",
    ]) {
      if (next[key] === "") delete next[key];
    }
    next.energy_entity =
      clean(device.energy_entity) ||
      next.total_energy_entity ||
      next.monthly_energy_entity ||
      next.daily_energy_entity;
    next.entities = normalizeEntities(device, next, appliances());
    /* Da adesso le caselle sono sue: quello che ha lasciato vuoto e' una
     * risposta, non una domanda, e la passata che indovina dai nomi non ci
     * torna sopra (#417). Senza questo segno «anche se cancello l'associazione,
     * quando ritorno in configurazione me la ritrovo sempre»: l'entita' tolta
     * col cestino rientrava un istante dopo il salvataggio. E' lo stesso segno
     * che mette il collegamento a un dispositivo dell'integrazione. */
    next.metadata = { ...(next.metadata || {}), [CAMPI_SCELTI]: true };
    try {
      await saveAppliance(index, next);
      close();
      root.editorSwitch?.("appliances");
    } catch (error) {
      form.querySelector("[data-error]").textContent = error?.message || String(error);
    }
  });
  return true;
}

function installStyles() {
  if (doc.getElementById("dm-appliance-editor-preview-style")) return;
  const style = doc.createElement("style");
  style.id = "dm-appliance-editor-preview-style";
  style.textContent = `
    .dm-appliance-icon-row{display:grid!important;grid-template-columns:84px minmax(0,1fr)!important;gap:12px!important;align-items:center!important}
    .dm-appliance-icon-preview{display:grid!important;place-items:center!important;width:84px!important;height:84px!important;border-radius:18px!important;background:var(--secondary-background-color,#eef3f8)!important;border:1px solid var(--divider-color,#dbe4ee)!important;overflow:hidden!important;color:#0ea5e9!important}
    .dm-appliance-icon-preview svg{display:block!important;width:58px!important;height:58px!important;max-width:58px!important;max-height:58px!important}
    .dm-appliance-editor-fallback{font-size:36px!important;line-height:1!important}
    .dm-appliance-type-trigger{display:grid!important;grid-template-columns:38px minmax(0,1fr) 22px!important;align-items:center!important;gap:10px!important;width:100%!important;min-height:58px!important;padding:8px 12px!important;text-align:left!important;cursor:pointer!important;color:var(--text,#0f172a)!important;background:var(--card-background-color,#fff)!important}
    .dm-appliance-type-trigger-icon{display:grid!important;place-items:center!important;width:36px!important;height:36px!important;color:#0ea5e9!important}.dm-appliance-type-trigger-icon svg{width:30px!important;height:30px!important}.dm-appliance-type-trigger-label{min-width:0!important;font-weight:750!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-appliance-type-chevron{font-size:20px!important;justify-self:end!important}
    .dm-appliance-editor-dialog{max-height:min(92dvh,920px)!important;overflow:hidden!important}
    .dm-appliance-binding{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px 12px!important;align-items:center!important;margin:0 0 12px!important;padding:12px 14px!important;border-radius:16px!important;border:1px dashed color-mix(in srgb,#0ea5e9 45%,transparent)!important;background:color-mix(in srgb,#0ea5e9 7%,transparent)!important}
    .dm-appliance-binding[data-bound="true"]{border-style:solid!important}
    .dm-appliance-binding-text{display:grid!important;gap:3px!important;min-width:0!important}
    .dm-appliance-binding-text strong{font-size:13px!important;font-weight:850!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .dm-appliance-binding-text small{font-size:11px!important;line-height:1.45!important;color:var(--secondary-text-color,#64748b)!important;font-weight:600!important}
    .dm-appliance-binding-actions{display:flex!important;flex-direction:column!important;gap:6px!important;min-width:max-content!important}
    .dm-appliance-binding-actions .ed-btn-add{box-sizing:border-box!important;width:100%!important;margin:0!important;padding:10px 16px!important;font-size:11px!important;letter-spacing:.8px!important;white-space:nowrap!important;overflow:visible!important}
    /* Fondo scuro, scritta chiara: la classe di base porta con se' la scritta
       blu pensata per il celeste, e su questi due fondi non si leggeva. */
    .dm-appliance-binding-link{background:linear-gradient(135deg,#0369a1,#075985)!important;color:#fff!important}
    .dm-appliance-binding-unlink{background:#64748b!important;color:#fff!important}
    .dm-appliance-binding[data-bound="false"] .dm-appliance-binding-unlink{display:none!important}
    @media(max-width:520px){.dm-appliance-binding{grid-template-columns:minmax(0,1fr)!important}.dm-appliance-binding-actions{flex-direction:row!important}.dm-appliance-binding-actions .ed-btn-add{flex:1 1 auto!important}}
    /* Gli altri comandi (#338): pastiglie, quelle scelte con la croce e quelle
       proposte col piu'. Stesso disegno della scheda del robot, che e' la
       stessa cosa: un elenco di entita' che l'apparecchio sa premere. */
    .dm-appl-comandi{display:grid!important;gap:6px!important;margin-top:14px!important}
    .dm-appl-comandi .ed-form-row{display:flex!important;gap:8px!important;min-width:0!important}
    .dm-appl-comandi .ed-form-row>input{flex:1 1 auto!important;min-width:0!important}
    .dm-appl-comandi .dm-appl-cmd-add{flex:0 0 38px!important;height:38px!important;border:none!important;border-radius:10px!important;background:linear-gradient(135deg,#10b981,#047857)!important;color:#fff!important;font-size:14px!important;cursor:pointer!important}
    .dm-appl-comandi small{font-size:11px!important;line-height:1.45!important;color:var(--secondary-text-color,#64748b)!important;font-weight:600!important}
    .dm-appl-cmd-chips{display:flex!important;flex-wrap:wrap!important;gap:6px!important}
    .dm-appl-cmd-chip{display:inline-flex!important;align-items:center!important;gap:6px!important;max-width:100%!important;padding:5px 10px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:999px!important;background:var(--card-background-color,#fff)!important;font:inherit!important;font-size:12px!important;font-weight:800!important;color:var(--text,#0f172a)!important;cursor:pointer!important}
    .dm-appl-cmd-chip>span{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .dm-appl-cmd-chip>i{font-style:normal!important;opacity:.7!important}
    .dm-appl-cmd-chip[data-genere="tendina"]{border-style:dashed!important}
    .dm-appl-cmd-proposte .dm-appl-cmd-chip{border-color:#0ea5e9!important;color:#0369a1!important}
    .dm-appl-cmd-vuoto{opacity:.75!important}
    .dm-appl-cmd-error:not(:empty){color:var(--error-color,#dc2626)!important;font-size:12px!important;font-weight:800!important}
    .dm-appliance-flow-suggestion{display:block!important;margin-top:3px!important;color:#16a34a!important;font-weight:750!important}
    .dm-appliance-flow-suggestion[hidden]{display:none!important}
    .dm-appliance-card-fields{margin-top:14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:color-mix(in srgb,var(--secondary-background-color,#f1f5f9) 45%,transparent)!important;overflow:hidden!important}
    .dm-appliance-card-fields>summary{padding:13px 16px!important;font-size:13px!important;font-weight:850!important;cursor:pointer!important;list-style:none!important;user-select:none!important}
    .dm-appliance-card-fields>summary::-webkit-details-marker{display:none!important}
    .dm-appliance-card-fields>summary::after{content:"⌄";float:right;font-size:16px;transition:transform .2s ease}
    .dm-appliance-card-fields[open]>summary::after{transform:rotate(180deg)}
    .dm-appliance-card-fields-intro{padding:0 16px 10px!important;font-size:11.5px!important;line-height:1.5!important;color:var(--secondary-text-color,#64748b)!important}
    .dm-appliance-card-fields .dm-appliance-entity-grid{padding:0 12px 12px!important}
.dm-appliance-type-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(88px,1fr))!important;gap:8px!important;overflow-y:auto!important;min-height:0!important}
    .dm-appliance-type-option{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;min-height:92px!important;padding:10px 4px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:14px!important;background:color-mix(in srgb,var(--secondary-background-color,#f1f5f9) 70%,transparent)!important;color:inherit!important;cursor:pointer!important}.dm-appliance-type-option[aria-selected="true"]{border-color:#0ea5e9!important;box-shadow:0 0 0 2px color-mix(in srgb,#0ea5e9 18%,transparent)!important}.dm-appliance-type-option-icon{display:grid!important;place-items:center!important;height:34px!important;color:#0ea5e9!important}.dm-appliance-type-option-icon svg{width:30px!important;height:30px!important}.dm-appliance-type-option>span:last-child{font-size:10px!important;font-weight:800!important;line-height:1.15!important;text-align:center!important}
    @media(max-width:520px){.dm-appliance-icon-row{grid-template-columns:84px minmax(0,1fr)!important}.dm-appliance-type-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}.dm-appliance-type-option{min-width:0!important;min-height:92px!important}}
  `;
  doc.head.append(style);
}

function installOverride() {
  if (typeof root.edApplEdit !== "function" || root.edApplEdit.__dmModalEditor) return false;
  state.previousEdit ||= root.edApplEdit;
  function modalApplianceEditor(index) {
    return openApplianceEditor(Number(index));
  }
  modalApplianceEditor.__dmModalEditor = true;
  modalApplianceEditor.__dmPrevious = state.previousEdit;
  root.edApplEdit = modalApplianceEditor;
  return true;
}

function installRuntimeOverrides() {
  installOverride();
  installPickerOverride();
}

export function installApplianceEditorSection() {
  if (!doc) return;
  installStyles();
  installRuntimeOverrides();
  if (!state.installed) {
    state.installed = true;
    root.addEventListener?.("dashboardmodern:legacy-ready", installRuntimeOverrides);
    root.addEventListener?.("dashboardmodern:runtime-ready", installRuntimeOverrides);
    root.addEventListener?.("pageshow", installRuntimeOverrides);
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installApplianceEditorSection, { once: true });
else installApplianceEditorSection();
