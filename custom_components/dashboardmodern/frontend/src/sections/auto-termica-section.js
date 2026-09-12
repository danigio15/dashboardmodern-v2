/* L'auto che va a benzina, nella pagina Auto (#208).
 *
 * «Ho la mia auto che ha i sensori di livello carburante, odometro, autonomia
 * e portiere: e' possibile scegliere a monte se visualizzare un'auto elettrica
 * o classica con i sensori disponibili?» E dal campo: «anche lo stato dei
 * finestrini e la pressione dei pneumatici».
 *
 * Tre cose, e nessuna rifa' quello che la pagina Auto sa gia' fare.
 *
 * La prima e' la scelta «a monte»: nella scheda dell'auto, sotto il nome, una
 * tendina dice se il motore e' elettrico, termico o ibrido. Vale per QUELLA
 * vettura — in un garage possono starci tutte e due — e la salva la stessa
 * mano che salva il resto della scheda.
 *
 * La seconda sono le caselle: carburante, motore, portiere, finestrini,
 * allarme, batteria di servizio, olio, temperatura esterna, ultimo viaggio,
 * carburante consumato, pneumatici. Sono `dm.ev_*` come tutte le altre della
 * pagina Auto, e si aggiungono all'elenco che il guscio gia' disegna: entrano
 * nel profilo per la stessa strada, con la stessa lente e lo stesso cestino.
 *
 * La terza e' il quadro. Con un'auto termica la pagina non mostra piu' la
 * ricarica — batteria, wallbox, sessione, target — che per lei non vuol dire
 * niente, e al loro posto c'e' il serbatoio, con intorno le cose che uno
 * guarda di un'auto ferma in garage: se e' chiusa, se il motore gira, quanto
 * puo' fare. Un'ibrida tiene tutti e due i quadri, perche' li ha tutti e due.
 */
import { CAPACITA_DI_SERIE } from "../core/il-tempo-della-ricarica.js";
import {
  CASELLE_TERMICHE,
  RIFERIMENTI_TERMICI,
  RUOTE,
  letturaTermica,
  ruoteDellAuto,
} from "../core/auto-termica.js";
import {
  CAPACITA_DI_CASA_KEY,
  MOTORE_DI_CASA_KEY,
  TIPI_MOTORE,
  VEHICLE_CAPACITY_FIELD,
  VEHICLE_KEY_FIELD,
  capacitaDellaBatteria,
  motoreDellaVettura,
  siRicarica,
  tipoMotore,
  updateVehicle,
} from "../core/vehicle-model.js";
import {
  activeVehicle,
  bozzaAperta,
  editedVehicle,
  profiles,
  salvaAuto,
  vehicleBatteryEntity,
} from "./ev-section.js";
import { registraTitoloDiPagina, renderPageMastheads } from "./page-masthead-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  lexicalGlobal,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AUTO_TERMICA__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

const ARC_RADIUS = 50;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

/* ── di che motore parla la pagina (#326) ─────────────────────────────── */

/* «Rientrando nella configurazione il Motore risulta Elettrica», e insieme la
 * batteria e la SESSIONE RICARICA che restavano in pagina su un'auto a
 * benzina: un guasto solo, visto da tre parti. Il tipo di motore lo leggeva e
 * lo scriveva soltanto il tasto «Salva auto», e quel tasto salva un PROFILO —
 * che chi ha una macchina sola non ha, perche' le caselle `dm.ev_*` le compila
 * nella mappatura generale della plancia. La scelta non aveva dove andare.
 *
 * Adesso la casa ce l'ha: la vettura se ne ha una, la plancia altrimenti. E
 * non si aspetta piu' nessun tasto — la tendina scrive appena la si muove,
 * cosi' nessun salvataggio puo' portarsela via. */
export function motoreDiCasa() {
  return tipoMotore(readJson(MOTORE_DI_CASA_KEY, ""));
}

/** La capacita' scritta per la plancia, o `null` se non c'e'. */
export function capacitaDiCasa() {
  return capacitaDellaBatteria({ [VEHICLE_CAPACITY_FIELD]: readJson(CAPACITA_DI_CASA_KEY, "") });
}

export function motoreInPagina() {
  return motoreDellaVettura(activeVehicle(), motoreDiCasa());
}

/* ── le parole ────────────────────────────────────────────────────────── */

/* L'intestazione della pagina dice di che auto parla: «Carica · Autonomia ·
 * Wallbox» sopra un serbatoio sarebbe una bugia. */
export function titoloDellaPagina(tipo = motoreInPagina()) {
  if (tipo === "termica")
    return {
      title: t("Auto", "Car"),
      subtitle: t("Carburante · Autonomia · Portiere", "Fuel · Range · Doors"),
    };
  if (tipo === "ibrida")
    return {
      title: t("Auto ibrida", "Hybrid car"),
      subtitle: t("Carica · Carburante · Autonomia", "Charge · Fuel · Range"),
    };
  return null;
}

export function nomeDelMotore(tipo) {
  if (tipo === "termica") return t("Termica (benzina, diesel, GPL)", "Combustion (petrol, diesel, LPG)");
  if (tipo === "ibrida") return t("Ibrida plug-in", "Plug-in hybrid");
  return t("Elettrica", "Electric");
}

/* L'etichetta di ogni casella, come compare nella scheda. Il riferimento e'
 * la chiave, cosi' chi la rinomina dalla scheda la ritrova con il suo nome. */
export function etichettaDellaCasella(ref) {
  switch (ref) {
    case "dm.ev_carburante":
      return t("Livello carburante (%)", "Fuel level (%)");
    case "dm.ev_motore":
      return t("Motore (acceso/spento)", "Engine (running/off)");
    case "dm.ev_portiere":
      return t("Portiere (bloccate/aperte)", "Doors (locked/open)");
    case "dm.ev_finestrini":
      return t("Finestrini (aperti/chiusi)", "Windows (open/closed)");
    case "dm.ev_bagagliaio":
      return t("Bagagliaio (chiuso/aperto)", "Boot (closed/open)");
    case "dm.ev_cofano":
      return t("Cofano motore (chiuso/aperto)", "Bonnet (closed/open)");
    case "dm.ev_posizione":
      return t("Posizione (device_tracker)", "Location (device_tracker)");
    case "dm.ev_allarme":
      return t("Allarme dell'auto", "Car alarm");
    case "dm.ev_batteria_servizio":
      return t("Batteria di servizio 12 V (% o V)", "Service battery 12 V (% or V)");
    case "dm.ev_temperatura_olio":
      return t("Temperatura olio", "Oil temperature");
    case "dm.ev_temperatura_esterna":
      return t("Temperatura esterna", "Outside temperature");
    case "dm.ev_ultimo_viaggio":
      return t("Ultimo viaggio (km)", "Last trip (km)");
    case "dm.ev_carburante_totale":
      return t("Carburante consumato in totale (L)", "Total fuel used (L)");
    case "dm.ev_pneumatici":
      return t("Pressione pneumatici", "Tyre pressure");
    case "dm.ev_pneumatico_ant_sx":
      return `${t("Pressione pneumatici", "Tyre pressure")} — ${parolaDellaRuota("antSx")}`;
    case "dm.ev_pneumatico_ant_dx":
      return `${t("Pressione pneumatici", "Tyre pressure")} — ${parolaDellaRuota("antDx")}`;
    case "dm.ev_pneumatico_post_sx":
      return `${t("Pressione pneumatici", "Tyre pressure")} — ${parolaDellaRuota("postSx")}`;
    case "dm.ev_pneumatico_post_dx":
      return `${t("Pressione pneumatici", "Tyre pressure")} — ${parolaDellaRuota("postDx")}`;
    default:
      return clean(ref);
  }
}

/* Il nome che una lettura ha ricevuto in configurazione (#326).
 *
 * «Le etichette possono essere modificabili? Nel mio caso tutto quello che
 * inizia con TUCSON.» Rinominarle si poteva gia': ogni casella della scheda
 * Auto ha la sua riga con la scritta modificabile — «Tocca per rinominare
 * l'etichetta» — e quello che ci si scrive finisce in `cd_slot_labels`,
 * viaggia con la configurazione condivisa e si ritrova su ogni dispositivo.
 * Solo che non arrivava fin qui: la pagina stampava le sue parole di serie e
 * il nome scelto restava a decorare l'editor. Rinominare non cambiava niente
 * dove si guarda, che dal di fuori e' come non poter rinominare.
 *
 * Adesso il nome scritto vince, e vale per la casella, per il quadretto delle
 * gomme e per il titolo dello storico che si apre toccandola: un nome dato
 * una volta vale ovunque quella lettura compaia. */
export function etichettaScelta(ref, predefinita) {
  const scelte = readJson("cd_slot_labels", {});
  const suo = scelte && typeof scelte === "object" ? clean(scelte[clean(ref)]) : "";
  return suo || predefinita;
}

/* Come si chiama ogni ruota, guardando l'auto dall'alto con il muso in su. */
export function parolaDellaRuota(ruota) {
  if (ruota === "antSx") return t("Anteriore sinistro", "Front left");
  if (ruota === "antDx") return t("Anteriore destro", "Front right");
  if (ruota === "postSx") return t("Posteriore sinistro", "Rear left");
  return t("Posteriore destro", "Rear right");
}

function parolaDellePortiere(codice) {
  if (codice === "bloccate") return t("Portiere bloccate", "Doors locked");
  if (codice === "sbloccate") return t("Portiere sbloccate", "Doors unlocked");
  if (codice === "aperte") return t("Portiere aperte", "Doors open");
  return t("Portiere chiuse", "Doors closed");
}

function parolaDellAllarme(codice) {
  if (codice === "scattato") return t("Allarme scattato", "Alarm triggered");
  if (codice === "inserito") return t("Allarme inserito", "Alarm armed");
  return t("Allarme disinserito", "Alarm disarmed");
}

/* ── le caselle nella scheda ──────────────────────────────────────────── */

/* Le caselle entrano nell'elenco del guscio, che e' `const` nel suo script:
 * si raggiunge con l'eval indiretto e si allunga. Da li' in poi il guscio le
 * disegna, le salva col profilo e le rilegge come tutte le altre — e il
 * modulo delle caselle mette loro la lente e il cestino. */
export function mettiLeCaselle() {
  const slots = lexicalGlobal("CD_SLOTS");
  if (!slots || typeof slots !== "object") return false;
  const sezione = Object.values(slots).find(
    (voce) => Array.isArray(voce?.slots) && voce.slots.some((slot) => slot?.ref === "dm.ev_batteria_auto"),
  );
  if (!sezione) return false;
  /* La scheda si chiama «Auto», non «Auto elettrica»: da qui passano anche
   * le vetture a benzina, e il titolo della pagina dice la stessa cosa. */
  if (/auto elettrica|electric/i.test(String(sezione.label || ""))) sezione.label = `🚗 ${t("Auto", "Car")}`;
  let aggiunte = 0;
  for (const voce of CASELLE_TERMICHE) {
    if (sezione.slots.some((slot) => slot?.ref === voce.ref)) continue;
    sezione.slots.push({ ref: voce.ref, lbl: etichettaDellaCasella(voce.ref) });
    aggiunte += 1;
  }
  const refs = lexicalGlobal("CD_SLOT_REFS");
  if (refs && typeof refs.add === "function") for (const ref of RIFERIMENTI_TERMICI) refs.add(ref);
  return aggiunte > 0;
}

/* La linguetta della configurazione si chiama «Auto», non «EV» (#326).
 *
 * «Nel menu di configurazione l'etichetta dell'auto e' piu' corretto che sia
 * "Auto" e non "EV".» Ha ragione, e per due motivi: «EV» e' una sigla inglese
 * che meta' di chi apre la plancia non riconosce, e da quella scheda passano
 * anche le auto a benzina — chiamarla «EV» dice il falso da quando esiste
 * questo modulo. La pagina si chiama gia' «Auto» nella barra in basso e il
 * titolo della sezione pure: mancava solo qui.
 *
 * La linguetta la scrive il documento vendorizzato, e su schermo stretto
 * un'altra rifinitura le spezza disegno e parola in due caselle: si riscrive
 * la parola dove c'e' la casella, la linguetta intera dove non c'e', o si
 * porterebbe via il disegno. E' la stessa mano della sezione solare. */
export function rinominaLaLinguettaDellAuto() {
  const nome = t("Auto", "Car");
  let fatto = false;
  const parola = doc?.querySelector?.('.ed-tab[data-tab="sez2"] .dm-beta4-tab-label');
  if (parola && clean(parola.textContent) !== nome) {
    parola.textContent = nome;
    fatto = true;
  }
  const nuda = doc?.querySelector?.('.ed-tab[data-tab="sez2"]:not(:has(.dm-beta4-tab-label))');
  if (nuda && !clean(nuda.textContent).includes(nome)) {
    nuda.textContent = `🚗 ${nome}`;
    fatto = true;
  }
  return fatto;
}

/* ── la tendina del motore, nella scheda dell'auto ────────────────────── */

function tendina() {
  return doc?.querySelector?.("#ed-body select[data-ev-tipo]") || null;
}

/* Di chi parla la tendina, adesso.
 *
 * Tre casi, ed e' la stessa domanda che si fa il resto della scheda: la bozza
 * del «＋» non e' nessuna vettura; con dei profili e' quello aperto con la
 * matita (o quello in uso); senza nessun profilo e' la plancia, che il motore
 * lo dichiara per conto suo perche' non c'e' nessuna vettura a cui
 * appenderlo. */
function diChiParlaLaTendina() {
  if (bozzaAperta()) return { chiave: "bozza", auto: null, casa: false };
  const auto = editedVehicle();
  if (auto) return { chiave: clean(auto[VEHICLE_KEY_FIELD]) || "senza-uid", auto, casa: false };
  return { chiave: "casa", auto: null, casa: true };
}

/* La tendina dice dell'auto aperta: alla matita si riallinea, al «＋» torna
 * elettrica. Una scelta fatta e non ancora salvata non si riscrive sotto le
 * dita: si riallinea solo quando cambia l'auto di cui si parla. */
function sincronizzaTendina() {
  const select = tendina();
  if (!select) return false;
  const { chiave, auto, casa } = diChiParlaLaTendina();
  if (select.dataset.dmPer === chiave) return true;
  select.dataset.dmPer = chiave;
  select.value = casa ? motoreDiCasa() : tipoMotore(auto?.tipo);
  return true;
}

/* Muovere la tendina SCRIVE (#326).
 *
 * «Rientrando nella configurazione il Motore risulta Elettrica.» Il tipo lo
 * leggeva soltanto «Salva auto», nel momento in cui salva un PROFILO: chi
 * preme il tasto verde «Salva sezione» in fondo — quello che si preme dopo
 * aver mappato le entita' — salvava le caselle e buttava via la scelta, e chi
 * un profilo non ce l'ha non aveva nemmeno dove metterla. Una tendina che
 * scrive appena la si muove non ha questo problema per nessuna delle due
 * strade, e non ne apre altre: la bozza resta l'unica che aspetta il tasto,
 * perche' l'auto di cui parla non esiste ancora. */
export function scriviIlMotore(valore) {
  const tipo = tipoMotore(valore);
  const { auto, casa } = diChiParlaLaTendina();
  if (casa) {
    writeJsonIfChanged(MOTORE_DI_CASA_KEY, tipo);
  } else if (auto) {
    const uid = clean(auto[VEHICLE_KEY_FIELD]);
    if (!uid) return false;
    if (tipoMotore(auto.tipo) !== tipo) salvaAuto(updateVehicle(profiles(), uid, { tipo }));
  } else {
    /* La bozza: nessuna vettura dietro, e la scelta se la prende «Salva la
     * nuova auto» leggendo la tendina, com'e' sempre stato. */
    return false;
  }
  renderAutoTermica();
  return true;
}

export function ensureTendinaMotore() {
  const nome = doc?.getElementById?.("ed-evcar-name");
  const riga = nome?.parentElement;
  if (!riga) return false;
  let casella = doc.querySelector("#ed-body [data-ev-tipo-riga]");
  if (!casella) {
    casella = doc.createElement("label");
    casella.className = "ed-slot dm-termica-tipo";
    casella.dataset.evTipoRiga = "true";
    casella.innerHTML = `<span class="ed-slot-lbl">${esc(t("Motore", "Engine"))}</span>
      <select class="ed-input" data-ev-tipo>${TIPI_MOTORE.map(
        (tipo) =>
          `<option value="${tipo === "elettrica" ? "" : esc(tipo)}">${esc(nomeDelMotore(tipo))}</option>`,
      ).join("")}</select>
      <small>${esc(
        t(
          "Termica: la pagina mostra il serbatoio, le portiere e il motore al posto della ricarica. Ibrida: tutti e due. Le caselle del carburante stanno qui sotto, fra le entità dell'auto.",
          "Combustion: the page shows the tank, the doors and the engine instead of charging. Hybrid: both. The fuel fields are below, among the car's entities.",
        ),
      )}</small>`;
    riga.after(casella);
  }
  sincronizzaTendina();
  ensureCasellaCapacita(casella);
  return true;
}

/* ── la capacita' della batteria ──────────────────────────────────────── */

/* «Sezione EV non calcola il tempo di fine.»
 *
 * Il conto del tempo che manca ha bisogno di due cose: quanta potenza passa
 * nel cavo — quella la dice la colonnina — e quanti kilowattora tiene la
 * batteria, che non la dice nessuno. Il guscio ne assumeva settanta per tutte
 * le auto del mondo: su una batteria da quaranta il tempo usciva quasi
 * doppio, su una da cento quasi meta'.
 *
 * La casella sta qui, accanto alla tendina del motore, e non e' un caso: sono
 * le due cose che si sanno della VETTURA e non delle sue entita', si scrivono
 * nello stesso posto e si salvano per la stessa strada. Si vede solo per le
 * auto che si ricaricano — a una a benzina la batteria di trazione non
 * interessa — e lasciarla vuota non rompe niente: restano i settanta di
 * prima, detti invece che nascosti. */
function ensureCasellaCapacita(dopo) {
  const { auto, casa } = diChiParlaLaTendina();
  const visibile = casa || !auto || siRicarica(auto);
  let casella = doc.querySelector("#ed-body [data-ev-kwh-riga]");
  if (!visibile) {
    casella?.remove();
    return false;
  }
  if (!casella) {
    casella = doc.createElement("label");
    casella.className = "ed-slot dm-termica-kwh";
    casella.dataset.evKwhRiga = "true";
    casella.innerHTML = `<span class="ed-slot-lbl">${esc(
      t("Capacità della batteria (kWh)", "Battery capacity (kWh)"),
    )}</span>
      <input class="ed-input" type="number" min="1" max="300" step="0.1" inputmode="decimal"
        data-ev-kwh placeholder="${esc(String(CAPACITA_DI_SERIE))}" autocomplete="off">
      <small>${esc(
        t(
          "Serve solo a dire quanto manca alla fine della carica: dalla percentuale che manca e dalla potenza della colonnina. Lasciandola vuota si contano 70 kWh, che è quello che la plancia ha sempre assunto — con una batteria diversa il tempo esce sbagliato in proporzione.",
          "It is only used to say how long is left to charge: from the missing percentage and the charger's power. Left empty it counts 70 kWh, which is what the dashboard has always assumed — with a different battery the time comes out wrong in proportion.",
        ),
      )}</small>`;
    dopo.after(casella);
  }
  sincronizzaCapacita(casella);
  return true;
}

/* Come la tendina: si riallinea solo quando cambia l'auto di cui si parla, o
 * un campo che si sta scrivendo si cancellerebbe sotto le dita. */
function sincronizzaCapacita(casella) {
  const campo = casella?.querySelector("[data-ev-kwh]");
  if (!campo) return false;
  const { chiave, auto, casa } = diChiParlaLaTendina();
  if (campo.dataset.dmPer === chiave) return true;
  campo.dataset.dmPer = chiave;
  /* Senza vettura la casella non e' muta: legge quella della plancia, che e'
   * il posto in cui la scrive chi non ha profili. */
  campo.value = auto
    ? clean(auto[VEHICLE_CAPACITY_FIELD])
    : clean(readJson(CAPACITA_DI_CASA_KEY, ""));
  return true;
}

/**
 * Scrive la capacita' dove appartiene. Vuoto vuol dire «non la so».
 *
 * Sulla vettura aperta, se c'e'. Senza vettura sulla plancia: la casella si
 * vede anche li' — chi ha una macchina sola e le sue mappature non ha nessun
 * profilo da aprire — e prima si rifiutava di salvare, quindi si ripuliva da
 * sola e il tempo di fine carica restava sui settanta assunti.
 */
export function scriviLaCapacita(valore) {
  const { auto } = diChiParlaLaTendina();
  const scritto = clean(valore).replace(",", ".");
  const numero = Number(scritto);
  /* Un numero che non sta in piedi non si salva e non cancella quello che
   * c'era: chi sta ancora scrivendo «4» di «48» non deve perdere niente. */
  const nuovo = scritto === "" ? "" : Number.isFinite(numero) && numero > 0 ? scritto : null;
  if (nuovo === null) return false;
  if (!auto) {
    writeJsonIfChanged(CAPACITA_DI_CASA_KEY, nuovo);
    return true;
  }
  const uid = clean(auto[VEHICLE_KEY_FIELD]);
  if (!uid) return false;
  if (clean(auto[VEHICLE_CAPACITY_FIELD]) === nuovo) return true;
  salvaAuto(updateVehicle(profiles(), uid, { [VEHICLE_CAPACITY_FIELD]: nuovo }));
  return true;
}

/**
 * Quanti kilowattora tiene la batteria dell'auto in uso.
 *
 * La vettura se l'ha dichiarata, altrimenti quella della plancia, altrimenti i
 * settanta di serie — che restano l'assunzione di sempre, detta invece che
 * nascosta.
 */
export function capacitaDellAutoInUso() {
  return capacitaDellaBatteria(activeVehicle() || {}) ?? capacitaDiCasa() ?? CAPACITA_DI_SERIE;
}

/* ── il quadro nella pagina ───────────────────────────────────────────── */

function arco(percentuale) {
  const valore = Number.isFinite(percentuale) ? Math.max(0, Math.min(100, percentuale)) : 0;
  const pieno = (valore / 100) * ARC_LENGTH;
  return `${pieno.toFixed(1)} ${(ARC_LENGTH - pieno).toFixed(1)}`;
}

function pillola(glifo, testo, tono) {
  return `<span class="dm-termica-pillola" data-tono="${esc(tono)}"><i aria-hidden="true">${glifo}</i>${esc(testo)}</span>`;
}

function misura(glifo, etichetta, valore, unita, ref, cifre = 0) {
  if (valore === null || valore === undefined) return "";
  const nome = etichettaScelta(ref, etichetta);
  return `<button type="button" class="dm-termica-misura" data-dm-storico="${esc(ref)}" data-dm-nome="${esc(nome)}">
    <i aria-hidden="true">${glifo}</i>
    <span class="dm-termica-misura-testo"><small>${esc(nome)}</small><b>${esc(formatNumber(valore, cifre))}<em>${esc(unita)}</em></b></span>
  </button>`;
}

/* Le quattro ruote come stanno sull'auto: due davanti, due dietro.
 *
 * «E' possibile inserire un solo pneumatico, spero al prossimo rilascio sia
 * possibile inserirne 4» (#319). Chi ne ha mappata una sola vede la casella di
 * sempre, identica; chi ne ha mappate due o piu' vede il quadretto, e quelle
 * che non ha mappato restano vuote invece di sparire — una gomma che manca si
 * vede meglio di una che non c'e'. */
function gomma(voce) {
  const nome = etichettaScelta(voce?.ref, parolaDellaRuota(voce?.ruota));
  if (!voce) return "";
  if (voce.pressione !== null)
    return `<button type="button" class="dm-termica-gomma" data-dm-storico="${esc(voce.ref)}" data-dm-nome="${esc(nome)}">
      <small>${esc(nome)}</small><b>${esc(formatNumber(voce.pressione, 1))}<em>${esc(voce.unita ? ` ${voce.unita}` : "")}</em></b>
    </button>`;
  return `<span class="dm-termica-gomma" data-tono="${voce.avviso ? "attento" : "bene"}">
    <small>${esc(nome)}</small><b>${esc(voce.avviso ? t("Da controllare", "Check it") : "OK")}</b>
  </span>`;
}

function gommeMarkup(lettura) {
  const ruote = ruoteDellAuto(lettura);
  const riepilogo = lettura.pneumatici;
  const riassunto = !riepilogo
    ? ""
    : riepilogo.pressione !== null
      ? misura("🛞", t("Pneumatici", "Tyres"), riepilogo.pressione, ` ${riepilogo.unita}`, "dm.ev_pneumatici", 1)
      : pillola("🛞", riepilogo.avviso ? t("Pneumatici da controllare", "Check the tyres") : t("Pneumatici a posto", "Tyres fine"), riepilogo.avviso ? "attento" : "bene");
  if (!ruote.length) return { riassunto, quadretto: "" };
  const perRuota = new Map(ruote.map((voce) => [voce.ruota, voce]));
  const cella = (ruota) => {
    const voce = perRuota.get(ruota);
    /* Anche la ruota non mappata porta il nome che le e' stato dato: il posto
     * vuoto e' quello di QUELLA gomma, e chiamarla in due modi a seconda che
     * il sensore ci sia o no la farebbe sembrare un'altra. */
    const posto = RUOTE.find((riga) => riga.ruota === ruota);
    return voce
      ? gomma(voce)
      : `<span class="dm-termica-gomma" data-vuota="true"><small>${esc(etichettaScelta(posto?.ref, parolaDellaRuota(ruota)))}</small><b>—</b></span>`;
  };
  const quadretto = `<div class="dm-termica-gomme">
      <span class="dm-termica-gomme-titolo"><i aria-hidden="true">🛞</i>${esc(t("Pneumatici", "Tyres"))}</span>
      <div class="dm-termica-gomme-quadro">
        ${cella("antSx")}${cella("antDx")}${cella("postSx")}${cella("postDx")}
      </div>
    </div>`;
  return { riassunto, quadretto };
}

/* Sull'auto elettrica il blocco porta solo le gomme, con la sua testata. */
function gommeSoleMarkup(gomme) {
  return `<div class="dm-termica-testa">
      <span class="dm-termica-titolo">${esc(t("Pneumatici", "Tyres"))}</span>
    </div>
    ${gomme.quadretto}
    ${gomme.riassunto ? `<div class="dm-termica-griglia">${gomme.riassunto}</div>` : ""}`;
}

function quadroMarkup(lettura, tipo) {
  const pillole = [];
  if (lettura.motore === true || lettura.motore === false)
    pillole.push(
      pillola("🔑", lettura.motore ? t("Motore acceso", "Engine running") : t("Motore spento", "Engine off"), lettura.motore ? "acceso" : "spento"),
    );
  if (lettura.portiere)
    pillole.push(
      pillola("🚪", parolaDellePortiere(lettura.portiere), lettura.portiere === "bloccate" || lettura.portiere === "chiuse" ? "bene" : "attento"),
    );
  if (lettura.finestrini)
    pillole.push(
      pillola("🪟", lettura.finestrini === "aperti" ? t("Finestrini aperti", "Windows open") : t("Finestrini chiusi", "Windows closed"), lettura.finestrini === "aperti" ? "attento" : "bene"),
    );
  /* Bagagliaio e cofano (#326): due aperture come i finestrini, e come loro
   * si leggono a colpo d'occhio — aperto e' la cosa che si vuole sapere. */
  if (lettura.bagagliaio)
    pillole.push(
      pillola(
        "🧳",
        lettura.bagagliaio === "aperti"
          ? t("Bagagliaio aperto", "Boot open")
          : t("Bagagliaio chiuso", "Boot closed"),
        lettura.bagagliaio === "aperti" ? "attento" : "bene",
      ),
    );
  if (lettura.cofano)
    pillole.push(
      pillola(
        "🔧",
        lettura.cofano === "aperti"
          ? t("Cofano aperto", "Bonnet open")
          : t("Cofano chiuso", "Bonnet closed"),
        lettura.cofano === "aperti" ? "attento" : "bene",
      ),
    );
  if (lettura.allarme)
    pillole.push(
      pillola("🚨", parolaDellAllarme(lettura.allarme), lettura.allarme === "scattato" ? "male" : lettura.allarme === "inserito" ? "bene" : "spento"),
    );
  /* Dove sta (#326): una parola, quella che dice il device_tracker. Il tono
   * e' neutro — un'auto fuori casa non e' un problema, e' un fatto. */
  if (lettura.posizione)
    pillole.push(
      pillola(
        "📍",
        lettura.posizione === "casa"
          ? t("A casa", "At home")
          : lettura.posizione === "fuori"
            ? t("Fuori casa", "Away")
            : lettura.posizione,
        lettura.posizione === "casa" ? "bene" : "spento",
      ),
    );
  const carburante = lettura.carburante;
  const serbatoio =
    carburante === null || carburante === undefined
      ? ""
      : `<div class="dm-termica-serbatoio" data-riserva="${carburante <= 10}">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="dm-termica-arc-track" cx="60" cy="60" r="${ARC_RADIUS}" fill="none" stroke-width="9"/>
        <circle class="dm-termica-arc" cx="60" cy="60" r="${ARC_RADIUS}" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${arco(carburante)}"/>
      </svg>
      <b>${esc(formatNumber(carburante, 0))}<i>%</i></b>
      <span>${esc(carburante <= 10 ? t("In riserva", "Reserve") : etichettaScelta("dm.ev_carburante", t("Carburante", "Fuel")))}</span>
    </div>`;
  const righe = [
    misura("🛣️", t("Autonomia", "Range"), lettura.autonomia, ` ${lettura.autonomiaUnita}`, "dm.ev_autonomia"),
    misura("🧭", t("Odometro", "Odometer"), lettura.odometro, ` ${lettura.odometroUnita}`, "dm.ev_odometro"),
    misura("🧭", t("Ultimo viaggio", "Last trip"), lettura.ultimoViaggio, " km", "dm.ev_ultimo_viaggio", 1),
  ].join("");
  const gomme = gommeMarkup(lettura);
  const tessere = [
    /* L'unita' e' quella letta dal sensore — percento o volt — e non un «%»
     * scritto qui: «e' a 14 V, mi da' 14%» (#348). I volt vogliono un decimale,
     * perche' fra 12,4 e 12,8 c'e' la differenza fra carica e scarica. */
    misura(
      "🔋",
      t("Batteria 12 V", "12 V battery"),
      lettura.batteriaServizio,
      lettura.batteriaServizioUnita === "%" ? "%" : ` ${lettura.batteriaServizioUnita}`,
      "dm.ev_batteria_servizio",
      lettura.batteriaServizioUnita === "%" ? 0 : 1,
    ),
    misura("🛢️", t("Olio", "Oil"), lettura.olio, "°", "dm.ev_temperatura_olio"),
    misura("🌡️", t("Esterna", "Outside"), lettura.esterna, "°", "dm.ev_temperatura_esterna"),
    misura("⛽", t("Consumato in totale", "Total fuel used"), lettura.carburanteTotale, " L", "dm.ev_carburante_totale"),
    gomme.riassunto,
  ].join("");
  const vuoto =
    !serbatoio && !righe && !tessere && !gomme.quadretto && !pillole.length
      ? `<div class="dm-termica-vuoto">${esc(
          t(
            "Compila le caselle dell'auto — carburante, autonomia, portiere, motore — dalla scheda Auto della configurazione.",
            "Fill in the car's fields — fuel, range, doors, engine — from the Car tab in the settings.",
          ),
        )}</div>`
      : "";
  return `<div class="dm-termica-testa">
      <span class="dm-termica-titolo">${esc(tipo === "ibrida" ? t("Motore termico", "Combustion engine") : t("L'auto", "The car"))}</span>
      <div class="dm-termica-pillole">${pillole.join("")}</div>
    </div>
    <div class="dm-termica-quadro">${serbatoio}<div class="dm-termica-righe">${righe}</div></div>
    ${tessere ? `<div class="dm-termica-griglia">${tessere}</div>` : ""}
    ${gomme.quadretto}
    ${vuoto}`;
}

function dipingi() {
  const page = doc?.getElementById?.("page-ev");
  const hero = doc?.getElementById?.("lm-hero-card");
  if (!page || !hero) return;
  const auto = activeVehicle();
  const tipo = motoreDellaVettura(auto, motoreDiCasa());
  const motore = tipo || "elettrica";
  if (page.dataset.dmMotore !== motore) {
    page.dataset.dmMotore = motore;
    try {
      renderPageMastheads();
    } catch (_error) {}
  }
  /* La batteria di un'auto a benzina (#326).
   *
   * «Con motore termico la scheda batteria dovrebbe mostrare solo la
   * percentuale di carica — nel mio caso e' la batteria del mild-hybrid — e
   * nulla riguardo la ricarica.» La barra dell'eroe e' esattamente quello:
   * una scritta e una percentuale, senza una parola sul cavo. Spariva perche'
   * stava nello stesso mucchio della sessione e del target, che invece
   * parlano di una spina che quest'auto non ha. Adesso resta, ma solo se una
   * batteria e' davvero mappata: un serbatoio con scritto «Batteria —%»
   * sarebbe peggio del niente di prima. */
  const carica = Number(allStates()?.[clean(vehicleBatteryEntity(auto || {}))]?.state);
  page.dataset.dmBatteria = String(Number.isFinite(carica));
  let blocco = page.querySelector(":scope .dm-termica");
  const lettura = letturaTermica(auto?.ov || auto?.overrides || {}, allStates(), root.resolveEntity);
  /* Le gomme non sono del motore.
   *
   * Il quadro termico parla di carburante, olio e scarico, e su un'auto
   * elettrica non si disegna: giusto. Le gomme pero' stavano dentro quel
   * quadro, e sparivano con lui — chi ha un'elettrica compilava le caselle in
   * configurazione e non le vedeva da nessuna parte, e il TPMS ce l'hanno
   * anche loro. Quando il motore non e' termico resta solo il quadretto delle
   * ruote, che vale per qualunque auto. */
  const gomme = gommeMarkup(lettura);
  const soloGomme = !tipo;
  if (soloGomme && !gomme.quadretto && !gomme.riassunto) {
    if (blocco) blocco.remove();
    state.firma = "";
    return;
  }
  /* I nomi scelti stanno nella firma: rinominare una lettura in
   * configurazione e tornare qui deve cambiare quello che si legge, e la
   * lettura in se' non e' cambiata di una virgola. */
  const firma = JSON.stringify([tipo, lettura, readJson("cd_slot_labels", {})]);
  if (state.firma === firma && blocco) return;
  state.firma = firma;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.className = "dm-termica";
    hero.insertAdjacentElement("afterend", blocco);
  }
  blocco.dataset.soloGomme = String(soloGomme);
  blocco.dataset.attenzione = String(Boolean(lettura.attenzione));
  blocco.innerHTML = soloGomme ? gommeSoleMarkup(gomme) : quadroMarkup(lettura, tipo);
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] auto termica", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderAutoTermica() {
  state.firma = "";
  schedule();
}

function evVisible() {
  return Boolean(doc?.getElementById("page-ev")?.classList.contains("active"));
}

function onClick(event) {
  const misuraToccata = event.target?.closest?.(".dm-termica-misura[data-dm-storico]");
  if (misuraToccata) {
    event.preventDefault();
    try {
      root.apriStorico?.(event, clean(misuraToccata.dataset.dmStorico), clean(misuraToccata.dataset.dmNome));
    } catch (_error) {}
    return;
  }
  /* La matita e il «＋» cambiano l'auto di cui la scheda parla; la tendina si
   * riallinea un istante dopo, quando il modulo dell'auto ha fatto il suo. */
  if (event.target?.closest?.("[data-ev-edit],[data-ev-add-new]"))
    root.queueMicrotask?.(sincronizzaTendina);
  if (event.target?.closest?.('.dm-vehicle-profile-card,[data-tab="ev"],#ev-car-sel'))
    root.queueMicrotask?.(schedule);
}

/* La scelta del motore si scrive quando si fa, non quando si preme un tasto
 * (#326): e' l'unico modo perche' nessun salvataggio possa portarsela via. */
function onChange(event) {
  const campo = event.target?.closest?.("#ed-body [data-ev-kwh]");
  if (campo) {
    try {
      scriviLaCapacita(campo.value);
    } catch (error) {
      root.console?.warn?.("[DashboardModern] capacità della batteria", error);
    }
    return;
  }
  const select = event.target?.closest?.("#ed-body select[data-ev-tipo]");
  if (!select) return;
  try {
    scriviIlMotore(select.value);
  } catch (error) {
    root.console?.warn?.("[DashboardModern] motore dell'auto", error);
  }
}

function installStyles() {
  installStyle(
    "dm-auto-termica-style",
    `
    /* Con un'auto termica la ricarica non si disegna: potenza e tempo alla
       colonnina, sessione, statistiche del wallbox, target, evcc e la
       pastiglia sulla foto parlano di un cavo che quest'auto non ha. */
    #page-ev[data-dm-motore="termica"] .dm-evv-rows,
    #page-ev[data-dm-motore="termica"] .lm-kpi-row,
    #page-ev[data-dm-motore="termica"] .lm-session-card,
    #page-ev[data-dm-motore="termica"] .lm-stats-grid,
    #page-ev[data-dm-motore="termica"] .lm-target-card,
    #page-ev[data-dm-motore="termica"] .lm-evcc-card,
    #page-ev[data-dm-motore="termica"] #lm-charge-badge{display:none!important}
    /* La batteria resta, e dice solo quanto e' carica (#326): su una
       mild-hybrid quella percentuale e' una lettura come le altre, e nessuna
       delle parole intorno parla piu' di ricarica. Senza una batteria mappata
       non c'e' niente da dire, e il blocco non si disegna affatto. */
    #page-ev[data-dm-motore="termica"][data-dm-batteria="false"] .dm-evv-power,
    #page-ev[data-dm-motore="termica"][data-dm-batteria="false"] .lm-batt-section{display:none!important}
    #page-ev[data-dm-motore="termica"] .dm-evv-power{justify-content:center}

    #page-ev .dm-termica{
      display:grid;gap:14px;margin:14px 0 0;padding:16px 18px;border-radius:24px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    #page-ev .dm-termica[data-attenzione="true"]{box-shadow:0 0 0 1px rgba(245,158,11,.4),0 14px 34px -14px rgba(245,158,11,.6)}
    #page-ev .dm-termica-testa{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    #page-ev .dm-termica-titolo{
      font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-pillole{display:flex;flex-wrap:wrap;gap:6px}
    #page-ev .dm-termica-pillola{
      display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;
      font-size:11.5px;font-weight:800;background:var(--surface-3,#f1f5f9);color:var(--text,#0f172a)}
    #page-ev .dm-termica-pillola i{font-style:normal}
    #page-ev .dm-termica-pillola[data-tono="acceso"]{background:#dcfce7;color:#166534}
    #page-ev .dm-termica-pillola[data-tono="bene"]{background:#dcfce7;color:#166534}
    #page-ev .dm-termica-pillola[data-tono="attento"]{background:#fef3c7;color:#b45309}
    #page-ev .dm-termica-pillola[data-tono="male"]{background:#fee2e2;color:#b91c1c}
    #page-ev .dm-termica-pillola[data-tono="spento"]{color:var(--text-dim,#64748b)}

    #page-ev .dm-termica-quadro{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center}
    #page-ev .dm-termica-serbatoio{
      position:relative;width:140px;height:140px;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:2px;text-align:center}
    #page-ev .dm-termica-serbatoio svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
    #page-ev .dm-termica-arc-track{stroke:var(--surface-3,#e2e8f0)}
    #page-ev .dm-termica-arc{stroke:#f59e0b;transition:stroke-dasharray .8s cubic-bezier(.16,1,.3,1)}
    #page-ev .dm-termica-serbatoio[data-riserva="true"] .dm-termica-arc{stroke:#ef4444}
    #page-ev .dm-termica-serbatoio b{
      position:relative;font-family:'Oswald',sans-serif;font-size:32px;font-weight:500;line-height:1;
      color:var(--text,#0f172a);font-variant-numeric:tabular-nums}
    #page-ev .dm-termica-serbatoio b i{font-style:normal;font-size:.5em;margin-left:1px;opacity:.75}
    #page-ev .dm-termica-serbatoio span{
      position:relative;font-size:9.5px;font-weight:900;letter-spacing:.08em;
      text-transform:uppercase;color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-serbatoio[data-riserva="true"] span{color:#dc2626}
    #page-ev .dm-termica-righe{display:grid;gap:6px;min-width:0}
    #page-ev .dm-termica-misura{
      display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;text-align:left;
      border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc);cursor:pointer;
      font:inherit;color:var(--text,#0f172a);min-width:0}
    #page-ev .dm-termica-misura i{font-style:normal;font-size:16px;flex:0 0 auto}
    #page-ev .dm-termica-misura-testo{display:grid;gap:1px;min-width:0}
    #page-ev .dm-termica-misura small{
      font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-misura b{font-size:17px;font-weight:900;line-height:1.1;font-variant-numeric:tabular-nums}
    #page-ev .dm-termica-misura b em{font-style:normal;font-size:.7em;font-weight:800;opacity:.75}
    #page-ev .dm-termica-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}

    /* Le quattro ruote, disposte come stanno sull'auto: due davanti, due
       dietro (#319). La corsia in mezzo e' l'auto, e non serve disegnarla. */
    #page-ev .dm-termica-gomme{display:grid;gap:8px}
    #page-ev .dm-termica-gomme-titolo{
      display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:900;
      letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-gomme-titolo i{font-style:normal;font-size:13px}
    #page-ev .dm-termica-gomme-quadro{
      display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 34px;
      position:relative;padding:2px 0}
    #page-ev .dm-termica-gomme-quadro::before{
      content:"";position:absolute;top:4px;bottom:4px;left:50%;width:2px;
      transform:translateX(-50%);border-radius:2px;background:var(--surface-3,#e2e8f0)}
    #page-ev .dm-termica-gomma{
      display:grid;gap:1px;padding:8px 12px;border-radius:14px;text-align:left;min-width:0;
      border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc);
      font:inherit;color:var(--text,#0f172a)}
    #page-ev button.dm-termica-gomma{cursor:pointer}
    #page-ev .dm-termica-gomma small{
      font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
      color:var(--text-dim,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #page-ev .dm-termica-gomma b{
      font-size:17px;font-weight:900;line-height:1.1;font-variant-numeric:tabular-nums}
    #page-ev .dm-termica-gomma b em{font-style:normal;font-size:.7em;font-weight:800;opacity:.75}
    #page-ev .dm-termica-gomma[data-tono="attento"]{
      border-color:rgba(245,158,11,.5);background:#fef3c7;color:#b45309}
    #page-ev .dm-termica-gomma[data-tono="bene"] b{font-size:13px;color:#166534}
    #page-ev .dm-termica-gomma[data-vuota="true"]{border-style:dashed;background:transparent}
    #page-ev .dm-termica-gomma[data-vuota="true"] b{color:var(--text-dim,#94a3b8)}
    #page-ev .dm-termica-vuoto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b);text-align:center;padding:6px}

    #ed-body .dm-termica-tipo{display:block;margin:0 0 10px}
    #ed-body .dm-termica-tipo small{
      display:block;margin:4px 2px 0;font-size:11px;line-height:1.45;color:var(--text-dim,#64748b)}

    @media (max-width:640px){
      #page-ev .dm-termica-quadro{grid-template-columns:1fr;justify-items:center}
      #page-ev .dm-termica-righe{width:100%}
    }
    `,
  );
}

export function installAutoTermica() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  registraTitoloDiPagina("page-ev", () => titoloDellaPagina());
  mettiLeCaselle();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  wrapFunction("apriConfigEntita", "__dmAutoTermica", () => {
    mettiLeCaselle();
    rinominaLaLinguettaDellAuto();
    ensureTendinaMotore();
  });
  onEditorRedraw("__dmAutoTermica", () => {
    root.queueMicrotask?.(() => {
      rinominaLaLinguettaDellAuto();
      ensureTendinaMotore();
    });
  });
  /* Il cambio d'auto passa da qui: dopo, il quadro e' di un'altra vettura. */
  wrapFunction("cdEvApplyCar", "__dmAutoTermica", () => root.queueMicrotask?.(renderAutoTermica));
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:editor-rendered",
  ])
    root.addEventListener?.(evento, () => {
      mettiLeCaselle();
      root.queueMicrotask?.(() => {
        rinominaLaLinguettaDellAuto();
        ensureTendinaMotore();
      });
      renderAutoTermica();
    });
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    if (evVisible()) schedule();
  });
  rinominaLaLinguettaDellAuto();
  ensureTendinaMotore();
  schedule();
  return true;
}

installAutoTermica();
