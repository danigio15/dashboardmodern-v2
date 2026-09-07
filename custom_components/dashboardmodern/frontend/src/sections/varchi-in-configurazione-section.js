/* La pastiglia aperto/chiuso sulle righe della configurazione (#367).
 *
 * «In verde dovrebbe segnare i sensori contact chiusi e in rosso quelli
 * aperti … almeno a colpo d'occhio so quante finestre sono aperte in questo
 * momento.»
 *
 * In configurazione un contatto porta-finestra e' una riga con dentro un
 * entity_id: dice come si chiama, non come sta. Qui ogni riga che nomina un
 * varco riceve la sua pastiglia — verde chiusa, rossa aperta — e in cima al
 * gruppo, quando i varchi sono piu' d'uno, il conto di quanti sono aperti.
 *
 * Non e' una scheda nuova: e' una decorazione che vale in ogni scheda dove un
 * varco compare — Finestre, le porte della Sicurezza, gli avvisi
 * personalizzati — perche' la domanda «questa e' aperta?» e' la stessa
 * dovunque la si faccia. Il verso girato (#244) lo dice il modello, che e'
 * dove sta gia'.
 */
import { CHIAVE_VERSI, insiemeInvertiti } from "../core/verso-aperture.js";
import { comeStaIlVarco, contaIVarchi, eUnVarco } from "../core/varchi-in-configurazione.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_VARCHI_CONFIG__";
const state = (root[KEY] ||= { installed: false });

const PASTIGLIA = "dm-varco-pastiglia";
const CONTO = "dm-varco-conto";

function installaLoStile() {
  installStyle(
    "dm-varchi-config-style",
    `
    #ed-body .${PASTIGLIA}{display:inline-flex!important;align-items:center!important;gap:5px!important;margin-left:8px!important;padding:2px 9px!important;border-radius:999px!important;font-size:10.5px!important;font-weight:900!important;letter-spacing:.02em!important;white-space:nowrap!important;vertical-align:middle!important}
    #ed-body .${PASTIGLIA}[data-varco="chiuso"]{background:rgba(22,163,74,.14)!important;color:#15803d!important}
    #ed-body .${PASTIGLIA}[data-varco="aperto"]{background:rgba(220,38,38,.14)!important;color:#b91c1c!important}
    #ed-body .${PASTIGLIA}::before{content:""!important;width:7px!important;height:7px!important;border-radius:999px!important;background:currentColor!important}
    #ed-body .${CONTO}{margin-left:8px!important;padding:2px 9px!important;border-radius:999px!important;background:rgba(220,38,38,.14)!important;color:#b91c1c!important;font-size:10.5px!important;font-weight:900!important}
    #ed-body .${CONTO}[data-tutte-chiuse="si"]{background:rgba(22,163,74,.14)!important;color:#15803d!important}
    html[data-theme="dark"] #ed-body .${PASTIGLIA}[data-varco="chiuso"]{color:#4ade80!important}
    html[data-theme="dark"] #ed-body .${PASTIGLIA}[data-varco="aperto"]{color:#f87171!important}
    html[data-theme="dark"] #ed-body .${CONTO}{color:#f87171!important}
    html[data-theme="dark"] #ed-body .${CONTO}[data-tutte-chiuse="si"]{color:#4ade80!important}
    `,
  );
}

/** I contatti girati, come li tiene la plancia. */
function invertiti() {
  return insiemeInvertiti(readJson(CHIAVE_VERSI, []));
}

/* L'entita' che una riga nomina.
 *
 * Le righe della configurazione scrivono l'entity_id in chiaro — nel campo,
 * nella pastiglia della scelta, o nel sottotitolo `.ed-row-old`. Si prende la
 * prima che somiglia a un'entita': una riga ne nomina una sola. */
function entitaDellaRiga(riga) {
  const dal = clean(
    riga.querySelector(".ed-slot-in[data-ref]")?.value ||
      riga.querySelector("input[data-entity-input='true']")?.value ||
      riga.querySelector("[data-chip-id]")?.textContent ||
      riga.querySelector(".ed-row-old")?.textContent,
  );
  return dal.match(/\b[a-z_]+\.[a-z0-9_]+\b/i)?.[0] || "";
}

function vestiLaRiga(riga, states, girati) {
  const entity = entitaDellaRiga(riga);
  const stato = entity ? states?.[entity] : null;
  const vecchia = riga.querySelector(`:scope .${PASTIGLIA}`);
  if (!entity || !eUnVarco(entity, stato)) {
    vecchia?.remove();
    return false;
  }
  const come = comeStaIlVarco(entity, stato, girati);
  if (!come) {
    vecchia?.remove();
    return false;
  }
  const parola = come === "aperto" ? t("Aperta", "Open") : t("Chiusa", "Closed");
  const pastiglia = vecchia || doc.createElement("span");
  if (!vecchia) {
    pastiglia.className = PASTIGLIA;
    /* Dentro la riga del nome, non accanto: le righe sono griglie con le loro
     * colonne, e un figlio in piu' le manderebbe a capo. */
    (riga.querySelector(".ed-row-new") || riga.querySelector(".ed-row-main") || riga).append(
      pastiglia,
    );
  }
  if (pastiglia.dataset.varco !== come) pastiglia.dataset.varco = come;
  if (pastiglia.textContent !== parola) pastiglia.textContent = parola;
  return true;
}

/* Il conto in cima al gruppo: quante ne sono aperte, adesso. */
function vestiIlGruppo(dettaglio, states, girati) {
  const titolo = dettaglio.querySelector(":scope > summary");
  if (!titolo) return;
  const entita = [...dettaglio.querySelectorAll(".ed-row")].map(entitaDellaRiga).filter(Boolean);
  const conto = contaIVarchi(entita, states, girati);
  const vecchio = titolo.querySelector(`:scope > .${CONTO}`);
  if (conto.totale < 2) {
    vecchio?.remove();
    return;
  }
  const testo = conto.aperti
    ? t(`${conto.aperti} aperte`, `${conto.aperti} open`)
    : t("Tutte chiuse", "All closed");
  const nodo = vecchio || doc.createElement("span");
  if (!vecchio) {
    nodo.className = CONTO;
    titolo.append(nodo);
  }
  const tutte = conto.aperti ? "no" : "si";
  if (nodo.dataset.tutteChiuse !== tutte) nodo.dataset.tutteChiuse = tutte;
  if (nodo.textContent !== testo) nodo.textContent = testo;
}

export function vestiIVarchi() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo) return false;
  installaLoStile();
  const states = allStates();
  const girati = invertiti();
  let quanti = 0;
  for (const riga of corpo.querySelectorAll(".ed-row,.ed-slot")) {
    if (vestiLaRiga(riga, states, girati)) quanti += 1;
  }
  for (const dettaglio of corpo.querySelectorAll("details")) {
    vestiIlGruppo(dettaglio, states, girati);
  }
  return quanti > 0;
}

export function installVarchiInConfigurazioneSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  /* Due momenti, e sono quelli che contano: quando la configurazione si
   * ridisegna — si e' cambiata scheda — e quando gli stati cambiano, perche'
   * una finestra si apre mentre la si sta guardando. */
  onEditorRedraw("__dmVarchiInConfig", vestiIVarchi);
  wrapFunction("render", "__dmVarchiInConfig", vestiIVarchi);
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installVarchiInConfigurazioneSection, { once: true });
} else {
  installVarchiInConfigurazioneSection();
}
