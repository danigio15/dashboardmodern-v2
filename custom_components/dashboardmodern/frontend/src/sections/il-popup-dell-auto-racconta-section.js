/* L'Auto dice quanto manca, quanto ha caricato, e lo dice in parole.
 *
 * Tre cose che il guscio scriveva male, e che si scrivono nello stesso punto
 * del suo disegno.
 *
 * IL TEMPO CHE MANCA. «Sezione EV non calcola il tempo di fine»: la casella
 * diceva IN ATTESA con 1,61 kW che passavano nel cavo. Il guscio il conto lo
 * sa fare, ma la domanda «sta caricando?» se la rispondeva con una riga sola —
 * la lettera C o D dell'alfabeto delle colonnine, maiuscola ed esatta — e una
 * colonnina che dice `charging`, un `binary_sensor` che dice `on`, evcc che
 * dice `charging_solar` per quella riga non stanno caricando. La lettera la
 * da' il nucleo della ricarica, che parla tutti i dialetti; i kilowattora
 * della batteria li dice la vettura, che adesso ha la sua casella, invece dei
 * settanta che il guscio assumeva per tutte le auto del mondo.
 *
 * L'ORA A CUI SI ARRIVA. Il tempo che manca dice «due ore e un quarto»;
 * accanto, nel popup, c'e' l'ora dell'orologio — «· verso le 10:46» — che e'
 * quella con cui uno decide se aspettare o no.
 *
 * LE PAROLE. Dove il codice IEC del cavo non e' fra quelli previsti — minuscole,
 * parole di evcc — le caselle stampavano il codice cosi' com'e': «C», che non
 * dice niente. E l'energia della sessione si stampava col numero nudo: un
 * contatore in wattora diceva «1610 kWh».
 *
 * La frase d'analisi NON sta qui: «l'analisi non va nel popup auto ma nel
 * popup widget» — e nel popup dei widget c'e' gia'.
 */
import { oraDiArrivo, oreEMinuti, tempoDellaRicarica } from "../core/il-tempo-della-ricarica.js";
import { inKilowattora } from "../core/period-service.js";
import { capacitaDellAutoInUso } from "./auto-termica-section.js";
import { liveState } from "./ev-section.js";
import { codiceDellaRicaricaAdesso, kilowattDellaColonnina } from "./ev-stato-e-target-section.js";
import { clean, doc, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_POPUP_AUTO_RACCONTA__";
const state = (root[KEY] ||= { installed: false });

/** Lo stato del cavo in parole, qualunque dialetto parli il caricatore:
 * codici IEC 61851 (A..F), parole di evcc, maiuscole o no. */
export function statoUmanoEV(codice) {
  const voce = clean(codice).toLowerCase();
  if (!voce || voce === "—") return "";
  if (["a", "disconnected", "idle", "not_connected", "unplugged"].includes(voce))
    return t("Scollegata", "Unplugged");
  if (["b", "connected", "plugged", "plugged_in", "waiting", "wait_for_car"].includes(voce))
    return t("Collegata, in attesa", "Plugged in, waiting");
  if (voce === "c" || voce === "d" || voce.startsWith("charging"))
    return t("In carica", "Charging");
  if (["e", "f", "error", "fault"].includes(voce)) return t("Errore", "Error");
  /* «N» e' la lettera in piu' del nucleo (`codiceDellaRicarica`): non sta
   * caricando, e del cavo nessuno sa niente. Non e' «scollegata» — dirlo
   * sarebbe inventare — ed e' la parola che la tessera in Home usa al posto
   * di quella bugia (#348). */
  if (voce === "n") return t("Non in carica", "Not charging");
  return "";
}

/* ── il tempo che manca ──────────────────────────────────────────────── */

const numero = (valore) => {
  const letto = Number.parseFloat(String(valore ?? "").replace(",", "."));
  return Number.isFinite(letto) ? letto : null;
};

/** L'orologio, nella forma corta con cui lo scrive la plancia. */
function oraInParole(quando) {
  if (!quando) return "";
  return `${quando.getHours()}:${String(quando.getMinutes()).padStart(2, "0")}`;
}

/** L'ora a cui si arriva, letta da un testo come «2H 15M RIM.». */
export function oraDiFineCarica(testo, adesso = Date.now()) {
  const preso = clean(testo).match(/(\d+)\s*H\s+(\d+)\s*M/i);
  if (!preso) return "";
  return oraInParole(oraDiArrivo(Number(preso[1]) * 60 + Number(preso[2]), adesso));
}

/** Quanto manca, adesso, con quello che la casa sa dire. */
export function quantoManca() {
  return tempoDellaRicarica({
    codice: codiceDellaRicaricaAdesso(),
    soc: numero(liveState("dm.ev_batteria_auto")?.state),
    target: numero(liveState("dm.ev_target_soc")?.state),
    kilowatt: kilowattDellaColonnina(),
    capacita: capacitaDellAutoInUso(),
  });
}

/** Le parole di quel verdetto: le stesse che scriveva il guscio. */
export function paroleDelTempo(esito) {
  if (esito?.stato === "completa") return t("CARICA COMPLETA", "FULLY CHARGED");
  if (esito?.stato === "raggiunto") return t("TARGET RAGGIUNTO", "TARGET REACHED");
  if (esito?.stato === "carica" && esito.minuti != null)
    return `${oreEMinuti(esito.minuti)} ${t("RIM.", "LEFT")}`;
  return t("IN ATTESA", "WAITING");
}

/* Il tempo che manca, dove il guscio lo scrive: la casella della pagina e la
 * riga del popup. Nel popup c'e' spazio anche per l'ora dell'orologio, che e'
 * quella con cui uno decide se aspettare. */
function scriviIlTempo() {
  const esito = quantoManca();
  const parole = paroleDelTempo(esito);
  for (const nodo of doc?.querySelectorAll?.(".v-ev-remain") || [])
    if (nodo.textContent !== parole) nodo.textContent = parole;
  const popup = doc?.getElementById?.("v-ev-remain-popup");
  if (!popup) return;
  const ora = esito.stato === "carica" ? oraInParole(oraDiArrivo(esito.minuti)) : "";
  if (popup.firstChild?.nodeType !== 3 || popup.firstChild.textContent !== parole)
    popup.replaceChildren(doc.createTextNode(parole));
  let verso = popup.querySelector(".dm-ev-verso");
  if (!ora) {
    verso?.remove();
    return;
  }
  if (!verso) {
    verso = doc.createElement("span");
    verso.className = "dm-ev-verso";
    popup.append(verso);
  }
  const testo = ` · ${t(`verso le ${ora}`, `around ${ora}`)}`;
  if (verso.textContent !== testo) verso.textContent = testo;
}

/* ── l'energia della sessione ────────────────────────────────────────── */

/* «Non mostra i kWh della sessione pur avendo configurato entità.»
 *
 * Il guscio stampa lo stato e ci appiccica «kWh», qualunque unita' dichiari il
 * contatore: un sensore in wattora diceva «1610 kWh», mille volte tanto. E
 * quando l'entita' non risponde — o non e' mappata — restava un trattino muto,
 * che non dice se manca la casella o manca la risposta. La conversione e' la
 * stessa dell'Energia, una sola in tutta la plancia; il perche' del trattino
 * sta nel titolo della casella, che e' il posto dove si guarda quando un
 * numero non c'e'. */
function scriviLaSessione() {
  const caselle = doc?.querySelectorAll?.(".v-ev-energy-all") || [];
  if (!caselle.length) return;
  const stato = liveState("dm.ev_energia_sessione");
  const grezzo = clean(stato?.state);
  const muto = !grezzo || /^(unknown|unavailable|none)$/i.test(grezzo);
  const kwh = muto ? null : inKilowattora(numero(grezzo), stato?.attributes?.unit_of_measurement);
  const testo =
    kwh === null ? "—" : `${kwh.toFixed(Math.abs(kwh) < 10 ? 2 : 1).replace(/\.?0+$/, "")} kWh`;
  const perche =
    kwh !== null
      ? ""
      : stato
        ? t(
            "Il contatore della sessione non sta rispondendo.",
            "The session meter is not answering.",
          )
        : t(
            "Nessun contatore della sessione: collega la colonnina o evcc nella scheda Auto, oppure scrivi l'entità in «Energia sessione».",
            "No session meter: connect the charger or evcc in the Car tab, or write the entity into “Session energy”.",
          );
  for (const casella of caselle) {
    if (casella.textContent !== testo) casella.textContent = testo;
    const riga = casella.closest(".lm-kpi-card,.lm-sess-kpi,.ev-popup-session-row") || casella;
    if (riga.title !== perche) riga.title = perche;
  }
}

/* Le caselle che mostrano il codice nudo lo ricevono in parole. */
function umanizzaCaselle() {
  const nodi = [
    ...(doc?.querySelectorAll?.(".v-ev-stato-all") || []),
    doc?.getElementById?.("lm-stato-txt"),
  ].filter(Boolean);
  for (const nodo of nodi) {
    const testo = clean(nodo.textContent);
    if (testo.length > 2) continue; /* gia' in parole (o vuoto: «—» resta) */
    const parole = statoUmanoEV(testo);
    if (parole && nodo.textContent !== parole) nodo.textContent = parole;
  }
}

/* Si riscrive anche a pagina chiusa, ed e' voluto: la pagina dell'Auto si apre
 * senza che arrivi nessuna notizia dalla casa — e' un cambio di linguetta — e
 * un giro che si fermasse davanti alla pagina nascosta la lascerebbe con le
 * parole del guscio finche' la casa non muove qualcosa. Costa due domande al
 * documento e quattro letture di stato, dentro un disegno che ne fa centinaia.
 */
function rivesti() {
  try {
    scriviIlTempo();
    scriviLaSessione();
    umanizzaCaselle();
  } catch (_errore) {}
}

const STILE = `
#v-ev-remain-popup .dm-ev-verso{opacity:.75;font-weight:700}
`;

export function installPopupAutoRacconta() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-popup-auto-racconta-style", STILE);
  /* Nello stesso giro in cui il guscio ha scritto, non al fotogramma dopo: fra
   * la sua parola e la nostra non deve esserci un fotogramma che si veda.
   * L'osservatore che stava qui prima guardava proprio il nodo che adesso
   * scriviamo noi, e si sarebbe rincorso da solo. */
  wrapFunction("render", "__dmPopupAutoRacconta", rivesti);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
  ])
    root.addEventListener?.(evento, rivesti);
  rivesti();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installPopupAutoRacconta, { once: true });
} else {
  installPopupAutoRacconta();
}
