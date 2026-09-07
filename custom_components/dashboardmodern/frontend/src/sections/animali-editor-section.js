/* La configurazione degli animali di casa (#358).
 *
 * La scheda non esiste nel documento vendorizzato: si aggiunge qui, accanto
 * alle altre, e si comporta come le altre — l'interruttore verde della sezione
 * in cima, l'elenco di cio' che c'e', un salvataggio per riga.
 *
 * La strada buona per riempire una scheda e' una sola, ed e' quella che gia'
 * usano gli elettrodomestici e il robot: «Aggiungi da un'integrazione» apre il
 * menu dei dispositivi di Home Assistant — PetKit, SurePetcare, Tractive,
 * Litter-Robot, qualunque cosa ci sia — e la scheda si compila da sola. Le
 * caselle restano scritte e si aggiustano a mano, perche' nessun indovino
 * indovina sempre, e chi non ha nessuna di quelle integrazioni puo' riempirle
 * una per una con le sue entita' fatte in casa.
 *
 * Un animale sta spesso su piu' dispositivi — la ciotola di una marca, la
 * lettiera di un'altra, il collare di una terza — e per questo dentro la riga
 * c'e' un secondo tasto che collega un dispositivo IN PIU', sommandosi a
 * quello che c'e' gia' invece di sostituirlo.
 */
import {
  AZIONI,
  CAMPI,
  CHIAVE_ANIMALI,
  CHIAVI_SOGLIE,
  SOGLIE_DI_SERIE,
  SPECIE,
  collegaAnimaleAlDispositivo,
  normalizzaAnimali,
  proponiCaselle,
  specieDiSerie,
} from "../core/animali-model.js";
import { roomForArea } from "../core/appliance-device-binding.js";
import { apriMenuIntegrazioni } from "./appliance-integration-section.js";
import { pickMediaImage } from "./media-picker-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  roomOptionsMarkup,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ANIMALI_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

export const ANIMALI_EDITOR_TAB = "animali";

function lista() {
  return normalizzaAnimali(readJson(CHIAVE_ANIMALI, []));
}

function salva(animali) {
  writeJsonIfChanged(CHIAVE_ANIMALI, normalizzaAnimali(animali));
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function nomeDi(animale, indice) {
  return clean(animale.nome) || `${t("Animale", "Pet")} ${indice + 1}`;
}

/* ── le parole delle caselle ─────────────────────────────────────────────
 *
 * Le chiavi arrivano dal modulo puro, che di lingue non sa niente. Qui
 * diventano etichetta, esempio e spiegazione, scritte per esteso: e' l'unica
 * forma che il raccoglitore delle traduzioni sa leggere. */
function etichettaCampo(chiave) {
  switch (chiave) {
    case "cibo_livello":
      return t("Livello del cibo", "Food level");
    case "cibo_ultima":
      return t("Ultima erogazione", "Last meal");
    case "cibo_porzioni":
      return t("Porzioni erogate", "Portions dispensed");
    case "lettiera_riempimento":
      return t("Cassetto dei rifiuti (si riempie)", "Waste drawer (fills up)");
    case "lettiera_sabbia":
      return t("Sabbia rimasta (si svuota)", "Litter left (runs out)");
    case "lettiera_deodorante":
      return t("Deodorante — giorni rimasti", "Deodorizer — days left");
    case "lettiera_cestino":
      return t("Cestino dei rifiuti (problema sì/no)", "Waste bin (problem yes/no)");
    case "cibo_essiccante":
      return t("Essiccante — giorni rimasti", "Desiccant — days left");
    case "cibo_eroga":
      return t("Eroga una porzione", "Feed a portion");
    case "cibo_essiccante_reset":
      return t("Azzera l'essiccante", "Reset the desiccant");
    case "lettiera_pulisci":
      return t("Pulisci la lettiera", "Clean the litter box");
    case "lettiera_livella":
      return t("Livella la sabbia", "Level the litter");
    case "lettiera_manutenzione_avvia":
      return t("Entra in manutenzione", "Enter maintenance");
    case "lettiera_manutenzione_esci":
      return t("Esci dalla manutenzione", "Exit maintenance");
    case "lettiera_deodorante_reset":
      return t("Azzera il deodorante", "Reset the deodorizer");
    case "lettiera_ultima":
      return t("Ultima pulizia della lettiera", "Litter box last cleaned");
    case "lettiera_visite":
      return t("Visite alla lettiera", "Litter box visits");
    case "acqua_livello":
      return t("Livello dell'acqua", "Water level");
    case "acqua_filtro":
      return t("Filtro della fontanella", "Fountain filter");
    case "porta":
      return t("Porta col microchip", "Microchip pet door");
    case "collare_batteria":
      return t("Batteria del collare", "Collar battery");
    case "collare_posizione":
      return t("Posizione del collare", "Collar location");
    case "peso":
      return t("Peso dell'animale", "Pet weight");
    default:
      return chiave;
  }
}

function esempioCampo(chiave) {
  switch (chiave) {
    case "cibo_livello":
      return "sensor.petkit_food_level";
    case "cibo_ultima":
      return "sensor.petkit_last_feed";
    case "cibo_porzioni":
      return "sensor.petkit_portions_today";
    case "lettiera_riempimento":
      return "sensor.litter_robot_waste_drawer";
    case "lettiera_sabbia":
      return "sensor.petkit_litter_level";
    case "lettiera_deodorante":
      return "sensor.petkit_deodorant_days";
    case "lettiera_cestino":
      return "binary_sensor.petkit_waste_bin";
    case "cibo_essiccante":
      return "sensor.petkit_desiccant_days";
    case "cibo_eroga":
      return "button.petkit_manual_feed";
    case "cibo_essiccante_reset":
      return "button.petkit_reset_desiccant";
    case "lettiera_pulisci":
      return "button.petkit_start_cleaning";
    case "lettiera_livella":
      return "button.petkit_start_leveling";
    case "lettiera_manutenzione_avvia":
      return "button.petkit_start_maintenance";
    case "lettiera_manutenzione_esci":
      return "button.petkit_exit_maintenance";
    case "lettiera_deodorante_reset":
      return "button.petkit_reset_deodorant";
    case "lettiera_ultima":
      return "sensor.litter_robot_last_seen";
    case "lettiera_visite":
      return "sensor.litter_robot_uses_today";
    case "acqua_livello":
      return "sensor.fontanella_acqua";
    case "acqua_filtro":
      return "sensor.fontanella_filtro";
    case "porta":
      return "binary_sensor.micio_dentro";
    case "collare_batteria":
      return "sensor.tractive_batteria";
    case "collare_posizione":
      return "device_tracker.tractive_micio";
    default:
      return "sensor.micio_peso";
  }
}

function aiutoCampo(chiave) {
  switch (chiave) {
    case "lettiera_sabbia":
      return t(
        "La sabbia che RESTA, in percentuale: quando scende sotto la soglia la scheda avvisa che sta per finire. È l'opposto del cassetto dei rifiuti, che invece si riempie.",
        "The litter that is LEFT, as a percentage: when it drops below the threshold the card warns you it is running out. It is the opposite of the waste drawer, which fills up.",
      );
    case "lettiera_cestino":
      return t(
        "Il binary_sensor che dice se il cestino dei rifiuti ha problemi: acceso vuol dire da controllare — di solito è il momento di cambiare il sacco.",
        "The binary_sensor that says whether the waste bin has a problem: on means it needs checking — usually time to change the bag.",
      );
    case "cibo_essiccante":
    case "lettiera_deodorante":
      return t(
        "Quanti giorni restano prima di sostituirlo. Sotto la soglia la scheda lo dice, e il tasto qui sotto azzera il conto una volta cambiato.",
        "How many days are left before replacing it. Below the threshold the card says so, and the button below resets the count once you have changed it.",
      );
    case "cibo_eroga":
    case "cibo_essiccante_reset":
    case "lettiera_pulisci":
    case "lettiera_livella":
    case "lettiera_manutenzione_avvia":
    case "lettiera_manutenzione_esci":
    case "lettiera_deodorante_reset":
      return t(
        "Un tasto che compare sulla scheda dell'animale. Va bene un button.*, uno script.* o uno switch.*: la plancia lo preme con il servizio giusto per il suo dominio.",
        "A button that appears on the pet card. A button.*, a script.* or a switch.* all work: the dashboard presses it with the right service for its domain.",
      );
    case "cibo_livello":
      return t(
        "Quanto cibo resta nel distributore. In percentuale la scheda ne fa una barra; chi scrive «Low» o «Empty» vale lo stesso, e sotto soglia la scheda avvisa.",
        "How much food is left in the feeder. As a percentage the card draws a bar; a sensor saying “Low” or “Empty” counts the same, and below the threshold the card warns.",
      );
    case "lettiera_ultima":
      return t(
        "Quando la lettiera è stata pulita l'ultima volta: una data, o i minuti passati. Oltre le ore indicate qui sotto la scheda lo dice.",
        "When the litter box was last cleaned: a date, or the minutes gone by. Past the hours set below the card says so.",
      );
    case "acqua_filtro":
      return t(
        "La vita che resta al filtro della fontanella, in percentuale: sotto soglia la scheda dice che è a fine corsa.",
        "The fountain filter's remaining life, as a percentage: below the threshold the card says it is worn out.",
      );
    case "porta":
      return t(
        "L'entità che dice se l'animale è dentro o fuori: la porta col microchip (SureFlap e simili) la pubblica come binary_sensor.",
        "The entity telling whether the pet is in or out: microchip pet doors (SureFlap and the like) publish it as a binary_sensor.",
      );
    default:
      return "";
  }
}

function etichettaSoglia(chiave) {
  switch (chiave) {
    case "cibo":
      return t("Avvisa sotto il cibo (%)", "Warn below food (%)");
    case "acqua":
      return t("Avvisa sotto l'acqua (%)", "Warn below water (%)");
    case "filtro":
      return t("Avvisa sotto il filtro (%)", "Warn below filter (%)");
    case "lettiera":
      return t("Avvisa sopra il cassetto dei rifiuti (%)", "Warn above waste drawer (%)");
    case "sabbia":
      return t("Avvisa sotto la sabbia (%)", "Warn below litter left (%)");
    case "giorni":
      return t("Avvisa sotto i giorni rimasti", "Warn below days left");
    case "lettiera_ore":
      return t("Lettiera da pulire dopo (ore)", "Clean the litter box after (hours)");
    default:
      return t("Avvisa sotto il collare (%)", "Warn below collar (%)");
  }
}

/* ── il disegno della scheda ─────────────────────────────────────────── */

function campoMarkup(animale, indice, campo) {
  const id = `dm-animale-${indice}-${campo.chiave}`;
  const aiuto = aiutoCampo(campo.chiave);
  return `<label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${esc(etichettaCampo(campo.chiave))}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" data-animale-field="${esc(campo.chiave)}" value="${esc(animale[campo.chiave])}" placeholder="${esc(esempioCampo(campo.chiave))}" autocomplete="off" spellcheck="false"><button type="button" class="dm-animale-pick" data-animale-pick="${esc(id)}" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>
    ${aiuto ? `<small>${esc(aiuto)}</small>` : ""}</label>`;
}

function gruppiMarkup(animale, indice) {
  const gruppi = new Map();
  /* Le caselle che si leggono e i tasti che si premono stanno nella stessa
   * fascia del loro dispositivo: chi configura la lettiera vuole trovare
   * insieme il livello della sabbia e il tasto che la livella (#373). */
  for (const campo of [...CAMPI, ...AZIONI]) {
    if (!gruppi.has(campo.gruppo)) gruppi.set(campo.gruppo, []);
    gruppi.get(campo.gruppo).push(campo);
  }
  return [...gruppi.entries()]
    .map(
      ([gruppo, campi]) => `<div class="dm-animale-gruppo">
        <span class="dm-animale-gruppo-lbl">${esc(titoloGruppo(gruppo))}</span>
        ${campi.map((campo) => campoMarkup(animale, indice, campo)).join("")}
      </div>`,
    )
    .join("");
}

function titoloGruppo(gruppo) {
  switch (gruppo) {
    case "ciotola":
      return t("🍽️ Ciotola e distributore", "🍽️ Bowl and feeder");
    case "lettiera":
      return t("🚽 Lettiera", "🚽 Litter box");
    case "acqua":
      return t("💧 Acqua", "💧 Water");
    case "porta":
      return t("🚪 Porta col microchip", "🚪 Microchip pet door");
    case "collare":
      return t("📡 Collare", "📡 Collar");
    default:
      return t("🐾 L'animale", "🐾 The pet");
  }
}

function soglieMarkup(animale, indice) {
  return `<div class="dm-animale-gruppo dm-animale-soglie">
    <span class="dm-animale-gruppo-lbl">${esc(t("⚠️ Quando avvisare", "⚠️ When to warn"))}</span>
    ${CHIAVI_SOGLIE.map(
      (chiave) =>
        `<label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${esc(etichettaSoglia(chiave))}</span>
        <span class="ed-form-row"><input id="dm-animale-${indice}-soglia-${esc(chiave)}" class="ed-input" type="number" min="0" step="1" data-animale-soglia="${esc(chiave)}" value="${esc(String(animale.soglie[chiave]))}" placeholder="${esc(String(SOGLIE_DI_SERIE[chiave]))}"></span></label>`,
    ).join("")}
    <small>${esc(t("Vuoto vale il valore di serie scritto nel campo.", "Empty means the default shown in the field."))}</small>
  </div>`;
}

function dispositiviMarkup(animale) {
  if (!animale.dispositivi.length) return "";
  return `<div class="dm-animale-legami">${animale.dispositivi
    .map(
      (voce) =>
        `<span class="dm-animale-legame" title="${esc(voce.id)}">🔗 ${esc([voce.nome, voce.integrazione_nome].filter(Boolean).join(" · "))}</span>`,
    )
    .join("")}</div>`;
}

function rigaMarkup(animale, indice) {
  const aperto = state.aperto === indice;
  return `<article class="ed-row dm-animale-row" data-animale-index="${indice}" data-open="${aperto}">
    <div class="dm-animale-row-head">
      <span class="dm-animale-row-icon" aria-hidden="true">${specieDiSerie(animale.specie).icona}</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nomeDi(animale, indice))}</strong><small class="ed-row-old mono">${esc(clean(animale.cibo_livello) || clean(animale.lettiera_ultima) || clean(animale.porta) || t("nessuna entità", "no entity"))}</small></span>
      <button type="button" class="ed-del dm-animale-edit" data-animale-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-animale-del" data-animale-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-animale-row-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-animale-${indice}-nome" class="ed-input" data-animale-field="nome" value="${esc(animale.nome)}" placeholder="${t("Micio", "Whiskers")}"></span></label>
      <label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${t("Specie", "Species")}</span><span class="ed-form-row"><select id="dm-animale-${indice}-specie" class="ed-input" data-animale-field="specie">${SPECIE.map(
        (voce) =>
          `<option value="${esc(voce.chiave)}"${voce.chiave === animale.specie ? " selected" : ""}>${voce.icona} ${esc(nomeSpecie(voce.chiave))}</option>`,
      ).join("")}</select></span></label>
      <div class="ed-slot dm-animale-field">
        <span class="ed-slot-lbl">${t("Foto", "Photo")}</span>
        <input type="hidden" data-animale-field="foto" value="${esc(animale.foto)}">
        <span class="ed-form-row dm-animale-foto-riga">
          <button type="button" class="ed-btn-add dm-animale-foto-btn" data-animale-foto>📁 ${t("Scegli la foto", "Choose the photo")}</button>
          <button type="button" class="ed-btn-add dm-animale-foto-btn dm-animale-foto-togli" data-animale-foto-togli${animale.foto ? "" : " hidden"}>✕ ${t("Togli la foto", "Remove the photo")}</button>
        </span>
        <small>${t("Senza foto la scheda mostra il simbolo della specie.", "Without a photo the card shows the species symbol.")}</small>
      </div>
      <label class="ed-slot dm-animale-field"><span class="ed-slot-lbl">${t("Stanza", "Room")}</span><span class="ed-form-row"><select id="dm-animale-${indice}-stanza" class="ed-input" data-animale-field="stanza">${roomOptionsMarkup(animale.stanza, t("Nessuna stanza", "No room"))}</select></span></label>
      ${dispositiviMarkup(animale)}
      <button type="button" class="ed-btn-add dm-animale-integ-riga" data-animale-integ-riga>🔗 ${t("Collega un altro dispositivo", "Link another device")}</button>
      ${gruppiMarkup(animale, indice)}
      ${soglieMarkup(animale, indice)}
      <output class="dm-animale-error" data-animale-error></output>
      <button type="button" class="ed-save-btn" data-animale-save>💾 ${t("Salva animale", "Save pet")}</button>
    </div>
  </article>`;
}

function nomeSpecie(chiave) {
  if (chiave === "gatto") return t("Gatto", "Cat");
  if (chiave === "cane") return t("Cane", "Dog");
  return t("Altro", "Other");
}

function bodyMarkup(animali) {
  const fascia = (() => {
    try {
      return root.cdSecToggleHtml?.("animali") || "";
    } catch (_error) {
      return "";
    }
  })();
  return `${fascia}
    <div class="ed-intro">${t(
      "Gli animali di casa: una scheda per ognuno, con la sua foto e quello che lo riguarda — la ciotola, la lettiera, l'acqua, la porta col microchip, il collare.",
      "The pets of the house: one card each, with its photo and what concerns it — the bowl, the litter box, the water, the microchip door, the collar.",
    )}</div>
    <div class="ed-list dm-animale-list">${
      animali.length
        ? animali.map((animale, indice) => rigaMarkup(animale, indice)).join("")
        : `<div class="ed-empty">${t("Nessun animale configurato", "No pet configured")}</div>`
    }</div>
    <div class="dm-animale-invito">
      <button type="button" class="ed-btn-add dm-animale-integ" data-animale-integ>🔗 ${t("Aggiungi da un'integrazione", "Add from an integration")}</button>
      <small>${t(
        "PetKit, SurePetcare, Tractive, Litter-Robot… scegli il dispositivo e la scheda arriva già fatta: il livello del cibo, la lettiera, il filtro dell'acqua, il collare. Oppure, qui sotto, una casella alla volta.",
        "PetKit, SurePetcare, Tractive, Litter-Robot… pick the device and the card arrives ready-made: the food level, the litter box, the water filter, the collar. Or, below, one field at a time.",
      )}</small>
    </div>
    <button type="button" class="ed-btn-add" data-animale-add>＋ ${t("Aggiungi animale", "Add pet")}</button>`;
}

function leggiRiga(riga, animale) {
  const next = { ...animale, soglie: { ...animale.soglie } };
  for (const input of riga.querySelectorAll("[data-animale-field]"))
    next[clean(input.dataset.animaleField)] = clean(input.value);
  for (const input of riga.querySelectorAll("[data-animale-soglia]")) {
    const chiave = clean(input.dataset.animaleSoglia);
    const scritto = clean(input.value);
    next.soglie[chiave] = scritto === "" ? SOGLIE_DI_SERIE[chiave] : scritto;
  }
  return next;
}

/* Cosa il dispositivo ha lasciato capire, prima di confermare.
 *
 * La finestra delle integrazioni e' la stessa degli elettrodomestici — le
 * integrazioni, i dispositivi, la ricerca sono uguali per chiunque colleghi
 * qualcosa — e questo e' l'unico pezzo che sa di animali. */
function anteprimaAnimale({ device, entities }) {
  const proposta = proponiCaselle(entities, allStates());
  const chiavi = Object.keys(proposta);
  const riga = (etichetta, valore) =>
    `<div class="dm-integ-casella"><span>${esc(etichetta)}</span><b class="mono">${esc(valore) || "—"}</b></div>`;
  return {
    etichetta: chiavi.length
      ? t("Cose dell'animale", "Pet things")
      : t("Niente per un animale", "Nothing for a pet"),
    corpo: `<div class="dm-integ-caselle">${
      chiavi.length
        ? chiavi.map((chiave) => riga(etichettaCampo(chiave), proposta[chiave])).join("")
        : riga(
            t("Caselle riconosciute", "Recognised fields"),
            t("nessuna", "none"),
          )
    }</div>
    <p class="dm-animale-anteprima-nota">${esc(clean(device?.name))}</p>`,
  };
}

/* L'animale nuovo, nato dal dispositivo scelto: si salva e si apre, cosi' chi
 * l'ha appena creato vede subito cosa gli e' stato assegnato. */
function creaDaDispositivo({ device, entities, integration }) {
  const animali = lista();
  const { animale, riempite } = collegaAnimaleAlDispositivo({
    device: { ...device, integration_name: integration?.name },
    entities,
    states: allStates(),
    indice: animali.length,
  });
  /* La stanza la sa gia' Home Assistant: se l'area del dispositivo porta il
   * nome di una stanza configurata, l'animale ci va dentro da solo. La
   * conversione area→stanza sta in un posto solo, quello degli
   * elettrodomestici: due modi di rispondere alla stessa domanda finirebbero
   * per rispondere diverso. */
  if (!animale.stanza) animale.stanza = roomForArea(device?.area, readJson("cd_stanze", []) || []);
  /* Un dispositivo che di animali non parla non diventa un animale.
   *
   * La finestra mostra TUTTI i dispositivi — e' la stessa degli
   * elettrodomestici — quindi da li' puo' arrivare un termostato. Senza
   * nemmeno una casella riconosciuta la riga si salverebbe vuota, il
   * messaggio direbbe «aggiunto» e in pagina non comparirebbe niente. */
  if (!riempite.length) {
    root.alert?.(
      t(
        "Da questo dispositivo non si riconosce niente di un animale: serve una ciotola, una lettiera, una fontanella, una porta col microchip o un collare.",
        "Nothing about a pet can be recognised from this device: a bowl, a litter box, a fountain, a microchip door or a collar is needed.",
      ),
    );
    return;
  }
  state.aperto = animali.length;
  salva([...animali, animale]);
  ridisegna();
  const daChi = clean(integration?.name) || t("un'integrazione", "an integration");
  root.edToast?.(`${animale.nome || device.name} — ${t("aggiunto da", "added from")} ${daChi}`);
}

/* Un dispositivo IN PIU' su un animale che c'e' gia': la ciotola di una marca
 * e la lettiera di un'altra sono lo stesso gatto. Riempie solo il vuoto. */
function aggiungiDispositivo(indice) {
  apriMenuIntegrazioni({
    titolo: t("Collega un dispositivo all'animale", "Link a device to the pet"),
    intro: t(
      "Un animale sta spesso su più dispositivi: la ciotola di una marca, la lettiera di un'altra, il collare di una terza. Quello che scegli si somma a quello che c'è già: le caselle piene restano come sono.",
      "A pet often lives across several devices: the bowl from one brand, the litter box from another, the collar from a third. What you pick adds to what is already there: filled fields stay as they are.",
    ),
    anteprima: anteprimaAnimale,
    onScelto: ({ device, entities, integration }) => {
      const animali = lista();
      const precedente = animali[indice];
      if (!precedente) return;
      const { animale, riempite } = collegaAnimaleAlDispositivo({
        device: { ...device, integration_name: integration?.name },
        entities,
        states: allStates(),
        indice,
        precedente,
      });
      const next = animali.slice();
      next[indice] = animale;
      salva(next);
      ridisegna();
      root.edToast?.(
        riempite.length
          ? `${riempite.length} ${t("caselle compilate", "fields filled in")}`
          : t("Niente da aggiungere: le caselle erano già piene.", "Nothing to add: the fields were already filled."),
      );
    },
  });
}

export function ensureAnimaliEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== ANIMALI_EDITOR_TAB) return false;
  const animali = lista();
  /* La fascia della visibilita' fa parte della scheda: toccando «Sezione
   * visibile in dashboard» la preferenza cambia, e se non entrasse nella firma
   * la fascia resterebbe verde fino a un giro fuori e dentro la linguetta. */
  const nascosta = (() => {
    try {
      return root.cdCfg?.("cd_sections")?.animali === false;
    } catch (_error) {
      return false;
    }
  })();
  const firma = [
    state.aperto,
    nascosta,
    ...animali.map((animale) =>
      [
        animale.id,
        animale.nome,
        animale.specie,
        animale.foto ? "foto" : "",
        animale.dispositivi.map((voce) => voce.id).join("+"),
        [...CAMPI, ...AZIONI].map((campo) => animale[campo.chiave]).join(","),
      ].join("~"),
    ),
  ].join("|");
  if (body.dataset.dmAnimaliEditor === firma && body.querySelector(".dm-animale-list")) return true;
  body.dataset.dmAnimaliEditor = firma;
  body.innerHTML = bodyMarkup(animali);
  body.dataset.renderer = "animali";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmAnimaliEditor;
  ensureAnimaliEditor();
}

async function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== ANIMALI_EDITOR_TAB || !body.contains(event.target)) return;
  const animali = lista();

  if (event.target.closest("[data-animale-integ]")) {
    event.preventDefault();
    apriMenuIntegrazioni({
      titolo: t("Aggiungi un animale da un'integrazione", "Add a pet from an integration"),
      intro: t(
        "Le integrazioni di Home Assistant, ufficiali o da HACS, con i dispositivi che portano. Scegli la ciotola, la lettiera o il collare: le caselle della scheda si compilano da sole.",
        "Home Assistant integrations, official or from HACS, with the devices they bring. Pick the bowl, the litter box or the collar: the card's fields fill themselves in.",
      ),
      anteprima: anteprimaAnimale,
      onScelto: (scelta) => creaDaDispositivo(scelta),
    });
    return;
  }
  if (event.target.closest("[data-animale-add]")) {
    event.preventDefault();
    state.aperto = animali.length;
    salva([...animali, { id: `animale-${animali.length + 1}`, nome: "" }]);
    ridisegna();
    return;
  }
  const pick = event.target.closest("[data-animale-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.animalePick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const riga = event.target.closest("[data-animale-index]");
  if (!riga) return;
  const indice = Number(riga.dataset.animaleIndex);
  if (!Number.isFinite(indice) || !animali[indice]) return;

  if (event.target.closest("[data-animale-edit]")) {
    event.preventDefault();
    state.aperto = state.aperto === indice ? -1 : indice;
    ridisegna();
    return;
  }
  if (event.target.closest("[data-animale-foto-togli]")) {
    event.preventDefault();
    const campo = riga.querySelector('[data-animale-field="foto"]');
    if (campo) campo.value = "";
    event.target.closest("[data-animale-foto-togli]").hidden = true;
    return;
  }
  if (event.target.closest("[data-animale-foto]")) {
    event.preventDefault();
    const url = clean(await pickMediaImage());
    if (!url) return;
    const campo = riga.querySelector('[data-animale-field="foto"]');
    if (campo) campo.value = url;
    const togli = riga.querySelector("[data-animale-foto-togli]");
    if (togli) togli.hidden = false;
    return;
  }
  if (event.target.closest("[data-animale-integ-riga]")) {
    event.preventDefault();
    /* Quello che si sta scrivendo non si perde perche' si collega un secondo
     * dispositivo: si salva la riga com'e', e il legame parte da li'. */
    const next = animali.slice();
    next[indice] = leggiRiga(riga, animali[indice]);
    salva(next);
    aggiungiDispositivo(indice);
    return;
  }
  if (event.target.closest("[data-animale-del]")) {
    event.preventDefault();
    /* Il nome sta fuori da `t()`: una chiamata con un pezzo calcolato dentro
     * diventa una chiave che porta il codice scritto dentro, e tredici
     * traduttori si trovano davanti `${nomeDi(...)}`. */
    const domanda = `${t("Elimino", "Remove")} "${nomeDi(animali[indice], indice)}"?`;
    if (root.confirm && !root.confirm(domanda)) return;
    state.aperto = -1;
    salva(animali.filter((_voce, posizione) => posizione !== indice));
    ridisegna();
    return;
  }
  if (event.target.closest("[data-animale-save]")) {
    event.preventDefault();
    const next = animali.slice();
    next[indice] = leggiRiga(riga, animali[indice]);
    const errore = riga.querySelector("[data-animale-error]");
    /* Un animale senza nome e senza nemmeno una casella non e' una scheda: e'
     * una riga vuota che in pagina non compare, e nessuno direbbe perche'. */
    const vuoto =
      !clean(next[indice].nome) &&
      [...CAMPI, ...AZIONI].every((campo) => !clean(next[indice][campo.chiave]));
    if (vuoto) {
      if (errore)
        errore.textContent = t(
          "Serve almeno il nome, oppure un'entità in una delle caselle.",
          "At least a name is needed, or an entity in one of the fields.",
        );
      return;
    }
    if (errore) errore.textContent = "";
    salva(next);
    ridisegna();
    root.edToast?.(t("💾 Animale salvato", "💾 Pet saved"));
  }
}

/* La voce nella barra della configurazione.
 *
 * Le voci sono scritte nel documento vendorizzato e questa non c'e': si
 * aggiunge accanto alle altre, con lo stesso gestore, cosi' si comporta come
 * loro senza che nessuno debba sapere che e' arrivata dopo. */
export function ensureAnimaliEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${ANIMALI_EDITOR_TAB}"]`))
    return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = ANIMALI_EDITOR_TAB;
  linguetta.textContent = `🐾 ${t("Animali", "Pets")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(ANIMALI_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-animali-editor-style",
    `
      #ed-body .dm-animale-list{display:grid;gap:8px;margin-bottom:10px}
      #ed-body .dm-animale-row{display:block!important;padding:0!important;overflow:hidden}
      #ed-body .dm-animale-row-head{display:flex;align-items:center;gap:10px;padding:10px 12px}
      #ed-body .dm-animale-row-icon{font-size:18px}
      #ed-body .dm-animale-row-body{display:grid;gap:8px;padding:0 12px 12px}
      #ed-body .dm-animale-row-body[hidden]{display:none!important}
      #ed-body .dm-animale-field{display:grid;gap:4px;margin:0}
      #ed-body .dm-animale-invito{display:grid;gap:6px;margin:0 0 12px;padding:12px;border-radius:14px;border:1px dashed color-mix(in srgb,#0ea5e9 45%,transparent);background:color-mix(in srgb,#0ea5e9 7%,transparent)}
      #ed-body .dm-animale-invito .dm-animale-integ{margin:0!important;background:linear-gradient(135deg,#0369a1,#075985)!important;color:#fff!important}
      #ed-body .dm-animale-invito small{font-size:11px;line-height:1.45;color:var(--text-dim,#64748b);font-weight:600}
      /* Le caselle stanno in famiglie: la ciotola con la ciotola, la lettiera
         con la lettiera. Dodici caselle in fila non si leggono. */
      #ed-body .dm-animale-gruppo{display:grid;gap:6px;padding:10px;border-radius:12px;background:color-mix(in srgb,var(--secondary-background-color,#eef3f8) 60%,transparent)}
      #ed-body .dm-animale-gruppo-lbl{font-size:11px;font-weight:900;letter-spacing:.4px;text-transform:uppercase;color:var(--text-dim,#64748b)}
      #ed-body .dm-animale-soglie small{font-size:11px;color:var(--text-dim,#64748b);font-weight:600}
      #ed-body .dm-animale-legami{display:flex;flex-wrap:wrap;gap:6px}
      #ed-body .dm-animale-legame{display:inline-flex;align-items:center;max-width:100%;padding:5px 10px;border-radius:999px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);font-size:11.5px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #ed-body .dm-animale-integ-riga{margin:0!important}
      #ed-body .dm-animale-foto-riga{flex-wrap:wrap}
      #ed-body .dm-animale-foto-btn{flex:1 1 auto;margin:0}
      #ed-body .dm-animale-foto-togli{background:rgba(148,163,184,.18);color:var(--text,#0f172a)}
      #ed-body .dm-animale-field .ed-form-row{display:flex;gap:8px;min-width:0}
      #ed-body .dm-animale-field .ed-form-row>input,#ed-body .dm-animale-field .ed-form-row>select{flex:1 1 auto;min-width:0}
      #ed-body .dm-animale-pick{flex:0 0 38px;height:38px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;font-size:14px;cursor:pointer}
      #ed-body .dm-animale-error:not(:empty){color:var(--error-color,#dc2626);font-size:12px;font-weight:800}
      .dm-animale-anteprima-nota{margin:6px 0 0;font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
    `,
  );
}

export function installAnimaliEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureAnimaliEditorTab();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmAnimaliEditor", () => {
    root.queueMicrotask?.(() => {
      ensureAnimaliEditorTab();
      ensureAnimaliEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureAnimaliEditorTab();
        ensureAnimaliEditor();
      });
    });
  ensureAnimaliEditor();
}
