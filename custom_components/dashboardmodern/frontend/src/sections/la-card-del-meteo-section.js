/* Il meteo sceso in pagina diventa una card.
 *
 * «Nel caso in cui il meteo viene spostato da sotto all'intestazione crea una
 * card più bella: la striscia così piccola e sottile non mi piace.»
 *
 * Nell'intestazione la striscia resta com'e': sta sotto il nome della casa,
 * accanto all'orologio, e il suo mestiere e' non prendere spazio — e' proprio
 * la ragione per cui il meteo e' salito lassu'. Ma il riquadro puo' scendere in
 * pagina (#492), e li' e' un blocco come le persone, le tessere e le stanze:
 * una riga alta trenta pixel in mezzo a delle card non e' discreta, e' un
 * avanzo.
 *
 * Qui non nasce un secondo meteo. I nodi del guscio sono gli stessi — l'icona,
 * i gradi, la condizione, l'umidita', il vento — e li aggiorna lui come
 * sempre: di quelli questo modulo non e' il padrone e non ne scrive nemmeno
 * uno. Cambia la taglia, che e' tutto CSS acceso da un attributo sul riquadro,
 * e aggiunge quello che una card puo' permettersi e una striscia no: la
 * massima e la minima di oggi, e i giorni che vengono.
 *
 * Le previsioni Home Assistant le da' solo a chi le chiede
 * (`weather.get_forecasts`), e si chiedono una volta ogni mezz'ora: sono
 * previsioni, non misure, e chiederle a ogni notizia della casa vorrebbe dire
 * un giro sul socket ogni pochi secondi per un numero che cambia due volte al
 * giorno.
 */
import { giorniCheVengono, oggiFraMassimaEMinima, segnoDelTempo } from "../core/la-card-del-meteo.js";
import {
  FONDO_DELLA_CARTA,
  GRANA_DELLA_CARTA,
  OMBRA_DELLA_CARTA,
  tokenDellaCarta,
} from "../core/le-vesti-della-carta.js";
import { rigaDellaTestata } from "./weather-in-masthead-section.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  locale,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CARD_DEL_METEO__";
const state = (root[KEY] ||= {
  installed: false,
  previsioni: [],
  chieste: 0,
  /* Di CHI sono le previsioni che teniamo. Il riposo era uno solo per tutti, e
   * cambiando l'entita' del meteo le condizioni di adesso passavano subito
   * mentre i quattro giorni restavano quelli di prima per mezz'ora: due meteo
   * diversi nella stessa card. */
  chiestePer: "",
  inVolo: false,
  /* Il tempo che aspetta di riprovare, quando una domanda non e' arrivata. */
  riprova: 0,
});

/* Mezz'ora fra una domanda e l'altra: le previsioni del giorno cambiano due
 * volte, non due volte al minuto. */
const RIPOSO = 30 * 60 * 1000;
/* E un minuto quando la domanda non e' arrivata: quasi sempre e' la presa con
 * Home Assistant che non e' ancora aperta. */
const RIPROVA = 60 * 1000;

/* ── l'entita' del meteo ─────────────────────────────────────────────────── */

/* La stessa catena del guscio: la casella mappata, poi `weather.home`. Chi ha
 * configurato il meteo l'ha configurato una volta, e questa card legge quella
 * configurazione, non una sua. */
export function entitaDelMeteo(states = allStates()) {
  for (const riferimento of ["dm.home_meteo", "dm.core_055"]) {
    let risolta = "";
    try {
      risolta = clean(root.resolveEntity?.(riferimento));
    } catch (_errore) {}
    if (risolta && risolta !== riferimento && states?.[risolta]) return risolta;
  }
  return states?.["weather.home"] ? "weather.home" : "";
}

/* ── le previsioni ───────────────────────────────────────────────────────── */

function chiediLePrevisioni() {
  if (state.inVolo) return;
  const entita = entitaDelMeteo();
  if (!entita) return;
  const adesso = Date.now();
  const stessa = state.chiestePer === entita;
  if (stessa && state.chieste && adesso - state.chieste < RIPOSO) return;
  state.inVolo = true;
  state.chieste = adesso;
  if (!stessa) {
    state.chiestePer = entita;
    state.previsioni = [];
  }
  chiediAHomeAssistant({
    type: "call_service",
    domain: "weather",
    service: "get_forecasts",
    service_data: { type: "daily" },
    target: { entity_id: entita },
    return_response: true,
  })
    .then((risposta) => {
      const previsioni = risposta?.response?.[entita]?.forecast;
      state.previsioni = Array.isArray(previsioni) ? previsioni : [];
      vestiLaCard();
    })
    .catch(() => {
      /* Nessuna previsione: la card resta quella che era, con l'adesso. Un
       * socket chiuso o un'integrazione che non le pubblica non e' un guasto
       * da scrivere addosso al meteo.
       *
       * Si riprova fra un minuto, non fra mezz'ora: la prima domanda cade
       * quasi sempre perche' la presa con Home Assistant non e' ancora aperta,
       * e mezz'ora di card senza previsioni per un socket che si apre due
       * secondi dopo sarebbe mezz'ora buttata. */
      state.previsioni = [];
      state.chieste = Date.now() - RIPOSO + RIPROVA;
      /* E la riprova si PROGRAMMA, non si aspetta.
       *
       * Qui si spostava solo il momento a partire dal quale una domanda nuova
       * sarebbe stata lecita, e poi si stava a vedere: la domanda la rifaceva
       * il prossimo disegno della card, cioe' la prossima notizia della casa.
       * In una casa tranquilla quella notizia puo' non arrivare, e il minuto
       * promesso qui sopra diventava «quando capita». Un'ora di card senza
       * previsioni per una presa che si e' aperta due secondi dopo.
       *
       * Il tempo lo tiene chi l'ha promesso, e lo tiene per l'ULTIMO
       * fallimento: quella in attesa si butta e se ne mette una nuova.
       *
       * Tenere la prima e scartare le successive sembrava la cosa prudente —
       * una sola riprova alla volta — e invece le mangiava. Cade una domanda,
       * si programma la riprova; si cambia l'entita' del meteo e cade anche la
       * seconda, che pero' non puo' programmare niente perche' la prima e'
       * ancora appesa; quando la prima scade, la seconda ha appena rimesso il
       * riposo da capo e `chiediLePrevisioni` esce senza chiedere e senza
       * riprogrammare. Da li' in poi, nessuna previsione finche' non passa un
       * disegno per conto suo — cioe' esattamente il difetto che questa
       * riprova esiste per chiudere. */
      clearTimeout(state.riprova);
      state.riprova = setTimeout(() => {
        state.riprova = 0;
        chiediLePrevisioni();
      }, RIPROVA);
    })
    .finally(() => {
      state.inVolo = false;
    });
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

/** Il riquadro e' sceso in pagina? Allora e' una card. */
function scesoInPagina(riga) {
  return Boolean(riga && riga.parentElement?.id === "page-home");
}

const gradi = (valore) => (valore == null ? "" : `${Math.round(valore)}°`);

/* Un numero fra gli attributi, oppure niente.
 *
 * `Number(null)` fa zero, e zero passa il controllo di finitezza: un meteo che
 * la pressione non la pubblica — o la pubblica vuota — si vedeva scritto
 * «Pressione 0 hPa», che non e' una misura mancante, e' una misura sbagliata.
 * Il vuoto si riconosce prima di convertire, come fa `gradi` qui sopra. */
function misura(valore) {
  if (valore == null || valore === "") return null;
  const numero = Number(valore);
  return Number.isFinite(numero) ? numero : null;
}

/* Il nome corto del giorno, nella lingua della plancia: lo scrive `Intl`,
 * perche' tredici lingue accorciano «martedì» in tredici modi. */
function nomeDelGiorno(quando) {
  try {
    return new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(new Date(quando));
  } catch (_errore) {
    return "";
  }
}

function rigaDiOggi(riquadro) {
  const misure = oggiFraMassimaEMinima(state.previsioni);
  let nodo = riquadro.querySelector(":scope .dm-meteo-oggi");
  if (!misure) {
    nodo?.remove();
    return;
  }
  if (!nodo) {
    nodo = doc.createElement("div");
    nodo.className = "dm-meteo-oggi";
    riquadro.querySelector(".w-temp-wrap")?.append(nodo);
  }
  const testo = `${t("Oggi", "Today")} <b>${esc(gradi(misure.alta))}</b> ${esc(
    gradi(misure.bassa) ? `/ ${gradi(misure.bassa)}` : "",
  )}`.trim();
  if (nodo.innerHTML !== testo) nodo.innerHTML = testo;
}

function strisciaDeiGiorni(riquadro) {
  const giorni = giorniCheVengono(state.previsioni, 4);
  let nastro = riquadro.querySelector(":scope > .dm-meteo-giorni");
  if (!giorni.length) {
    nastro?.remove();
    return;
  }
  if (!nastro) {
    nastro = doc.createElement("div");
    nastro.className = "dm-meteo-giorni";
    riquadro.append(nastro);
  }
  const disegno = giorni
    .map(
      (giorno) => `<div class="dm-meteo-giorno">
        <span class="dm-meteo-giorno-nome">${esc(nomeDelGiorno(giorno.quando))}</span>
        <span class="dm-meteo-giorno-ic">${esc(segnoDelTempo(giorno.condizione))}</span>
        <span class="dm-meteo-giorno-gradi">${esc(gradi(giorno.alta))} <i>${esc(
          gradi(giorno.bassa),
        )}</i></span>
      </div>`,
    )
    .join("");
  if (nastro.innerHTML !== disegno) nastro.innerHTML = disegno;
}

/* Quello che la striscia non aveva spazio di dire e una card si': la pressione,
 * che il meteo pubblica gia' fra i suoi attributi, e il tramonto, che lo dice
 * il sole di Home Assistant. Nessuna casella da riempire: o ci sono, o la
 * pastiglia non c'e'. */
function misureInPiu(riquadro) {
  const destra = riquadro.querySelector(":scope > .w-right");
  if (!destra) return;
  const states = allStates() || {};
  const meteo = states[entitaDelMeteo(states)];
  const pressione = misura(meteo?.attributes?.pressure);
  const unita = clean(meteo?.attributes?.pressure_unit) || "hPa";
  const tramonto = Date.parse(clean(states["sun.sun"]?.attributes?.next_setting));
  const voci = [];
  if (pressione !== null)
    voci.push(["pressione", "🧭", t("Pressione", "Pressure"), `${Math.round(pressione)} ${unita}`]);
  if (Number.isFinite(tramonto)) {
    let ora = "";
    try {
      ora = new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit" }).format(
        new Date(tramonto),
      );
    } catch (_errore) {}
    if (ora) voci.push(["tramonto", "🌅", t("Tramonto", "Sunset"), ora]);
  }
  const vive = new Set(voci.map(([chiave]) => chiave));
  for (const nodo of destra.querySelectorAll(":scope > [data-dm-meteo-extra]"))
    if (!vive.has(nodo.dataset.dmMeteoExtra)) nodo.remove();
  for (const [chiave, segno, etichetta, valore] of voci) {
    let nodo = destra.querySelector(`:scope > [data-dm-meteo-extra="${chiave}"]`);
    if (!nodo) {
      nodo = doc.createElement("div");
      nodo.className = "w-detail";
      nodo.dataset.dmMeteoExtra = chiave;
      destra.append(nodo);
    }
    const testo = `${segno} <span class="dm-meteo-parola">${esc(etichetta)}</span> <b>${esc(
      valore,
    )}</b>`;
    if (nodo.innerHTML !== testo) nodo.innerHTML = testo;
  }
}

/* Il titolo del blocco, che vive solo mentre il riquadro sta in pagina.
 *
 * Sta FUORI dal riquadro, come nei blocchi del guscio — «Dispositivi» e la sua
 * griglia sono due fratelli — e non dentro, come se lo portano le persone e i
 * widget. La ragione e' che il riquadro non e' nostro: e' quello del guscio,
 * che nell'intestazione ospita anche l'orologio. Infilarci dentro un titolo
 * vorrebbe dire vederlo comparire anche lassu', ed e' proprio quello che non
 * deve succedere: «se e' con etichetta principale non deve uscire».
 *
 * Chi mette i blocchi in fila lo sa: per lui il meteo sceso in pagina e' due
 * pezzi, il titolo e il riquadro, e li sposta insieme. */
export const CLASSE_DEL_TITOLO = "dm-testata-titolo";

function titoloDelMeteo(riga, acceso) {
  const pagina = riga.parentElement;
  let titolo = pagina?.querySelector(`:scope > .${CLASSE_DEL_TITOLO}`) || null;
  if (!acceso) {
    titolo?.remove();
    return;
  }
  if (!titolo) {
    titolo = doc.createElement("h3");
    titolo.className = `section-title ${CLASSE_DEL_TITOLO}`;
    riga.before(titolo);
  }
  const testo = t("Meteo", "Weather");
  if (titolo.textContent !== testo) titolo.textContent = testo;
  /* Il titolo annuncia il riquadro, quindi gli sta sempre attaccato davanti:
   * se qualcuno ha rimesso in fila i blocchi, il titolo lo segue. */
  if (titolo.nextElementSibling !== riga) riga.before(titolo);
}

/** Accende o spegne la card, e la tiene aggiornata mentre e' accesa. */
export function vestiLaCard() {
  const riga = doc?.querySelector?.(".dm-testata-riga");
  if (!riga) return false;
  const riquadro = riga.querySelector(":scope > .weather-widget");
  if (!scesoInPagina(riga)) {
    /* Risalito nell'intestazione: la striscia torna quella di prima, e quello
     * che la card aveva aggiunto se ne va con lei — il titolo compreso. */
    if (riga.dataset.dmMeteo) delete riga.dataset.dmMeteo;
    for (const vecchio of doc?.querySelectorAll?.(`.${CLASSE_DEL_TITOLO}`) || []) vecchio.remove();
    riquadro?.querySelector(":scope .dm-meteo-oggi")?.remove();
    riquadro?.querySelector(":scope > .dm-meteo-giorni")?.remove();
    for (const nodo of riquadro?.querySelectorAll("[data-dm-meteo-extra]") || []) nodo.remove();
    return false;
  }
  if (riga.dataset.dmMeteo !== "card") riga.dataset.dmMeteo = "card";
  titoloDelMeteo(riga, true);
  if (!riquadro) return false;
  rigaDiOggi(riquadro);
  strisciaDeiGiorni(riquadro);
  misureInPiu(riquadro);
  chiediLePrevisioni();
  return true;
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

const STILE = `
/* Tutto quello che segue vale SOLO col riquadro sceso in pagina: nella
   testata la striscia resta quella che e', ed e' giusta li'. */
/* Le vesti della carta, le stesse delle tessere: fondo a carta, i due fili del
   bordo, l'ombra corta attaccata e quella lunga sotto.
 *
 * Qui c'era l'ombra morbida delle persone — un valore solo — e su una card
 * larga tutta la pagina non si vede: «le altre sembrano in rilievo, questa
 * piatta». Non era la ricetta sbagliata: erano DUE ricette per la stessa cosa.
 * Adesso e' una sola, e sta in core/le-vesti-della-carta.js. */
${tokenDellaCarta('body .dm-testata-riga[data-dm-meteo="card"]')}
body .dm-testata-riga[data-dm-meteo="card"]{
  position:relative;overflow:hidden;
  display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;
  gap:10px 16px;padding:18px 20px 16px;border:0;border-radius:22px;
  background:${FONDO_DELLA_CARTA};
  box-shadow:${OMBRA_DELLA_CARTA};
  transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .2s ease;
  cursor:pointer}
body .dm-testata-riga[data-dm-meteo="card"]::before{${GRANA_DELLA_CARTA}}
/* Si alza al passaggio come le altre card. */
body .dm-testata-riga[data-dm-meteo="card"]:hover{
  transform:translateY(-4px);
  box-shadow:var(--shadow-hover,0 10px 25px rgba(15,23,42,.14))}
/* Il titolo sopra, come ogni altra sezione della Home.
 *
 * «Non compare il titolo sopra come le altre sezioni.» Ce l'hanno tutte —
 * PERSONE, WIDGET, AZIONI RAPIDE — e il meteo sceso in pagina no: sembrava una
 * card capitata li' invece di un blocco.
 *
 * Esiste SOLO da sceso in pagina: «se e con etichetta principale non deve
 * uscire». Nell'intestazione il riquadro sta gia' sotto il nome della casa, e
 * li' un secondo titolo sarebbe una scritta di troppo. */
body #page-home>.dm-testata-titolo{margin:0 0 10px}
/* E l'aria da quello che c'e' sopra: «troppo attaccato ad altra sezione». Gli
   altri blocchi se la portano dentro; questo riquadro nasce nell'intestazione,
   dove l'aria la fa la testata, e scendendo non ne aveva. La porta il pezzo
   che viene per primo: col titolo e' il titolo, senza e' la card. */
body #page-home>.dm-testata-titolo,
body #page-home>.dm-testata-riga[data-dm-meteo="card"]{margin-top:26px}
body #page-home>.dm-testata-titolo+.dm-testata-riga[data-dm-meteo="card"]{margin-top:0}
body .dm-testata-riga[data-dm-meteo="card"]>.weather-widget{
  grid-area:1/1;display:grid;gap:14px;min-width:0}
/* L'ora, in alto a destra. Il suo foglio di stile parla solo dentro
   l'intestazione — «header .dm-orologio» — e qui l'intestazione non c'e' piu':
   senza queste righe l'ora e la data uscivano una in fila all'altra, come due
   pezzi di testo nudo. */
body .dm-testata-riga[data-dm-meteo="card"]>.dm-orologio{
  grid-area:1/2;margin:0;padding:0;border:0;
  display:grid;justify-items:end;gap:2px}
body .dm-testata-riga[data-dm-meteo="card"]>.dm-orologio[hidden]{display:none}
body .dm-testata-riga[data-dm-meteo="card"] .dm-orologio-ora{
  font-family:'Oswald',system-ui,sans-serif;font-size:30px;font-weight:700;
  line-height:1;letter-spacing:-.01em;color:var(--text,#0f172a);
  font-variant-numeric:tabular-nums}
body .dm-testata-riga[data-dm-meteo="card"] .dm-orologio-data{
  font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;
  color:var(--text-dim,#64748b);white-space:nowrap}
/* Il capo della card: il segno del tempo grosso, i gradi, la condizione. */
body .dm-testata-riga[data-dm-meteo="card"] .w-left{gap:16px;align-items:center}
body .dm-testata-riga[data-dm-meteo="card"] .w-icon{
  width:auto;height:auto;font-size:52px;line-height:1;
  filter:drop-shadow(0 6px 14px rgba(15,23,42,.14))}
body .dm-testata-riga[data-dm-meteo="card"] .w-icon .w-fog-anim{width:46px;height:32px;gap:4px}
body .dm-testata-riga[data-dm-meteo="card"] .w-icon .fog-line{height:4px;border-radius:4px}
body .dm-testata-riga[data-dm-meteo="card"] .w-temp-wrap{display:grid;gap:3px;min-width:0}
body .dm-testata-riga[data-dm-meteo="card"] .w-temp{
  font-size:42px;font-weight:900;letter-spacing:-2px;line-height:1;
  font-variant-numeric:tabular-nums}
body .dm-testata-riga[data-dm-meteo="card"] .w-state{
  display:block;font-size:12px;font-weight:800;letter-spacing:.09em;
  text-transform:uppercase;color:var(--text-dim,#64748b)}
body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-oggi{
  font-size:12px;font-weight:800;color:var(--text-dim,#64748b);
  font-variant-numeric:tabular-nums}
body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-oggi b{color:var(--text,#0f172a)}
/* Le misure: pastiglie larghe uguali, che riempiono la riga invece di
   accucciarsi a destra come facevano nella striscia. */
body .dm-testata-riga[data-dm-meteo="card"] .w-right{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;
  margin:0;justify-content:stretch}
body .dm-testata-riga[data-dm-meteo="card"] .w-detail{
  display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:12px;
  background:var(--surface-3,#f1f5f9);font-size:12px;font-weight:800;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body .dm-testata-riga[data-dm-meteo="card"] .w-detail .dm-meteo-parola{
  display:inline;color:var(--text-dim,#64748b)}
body .dm-testata-riga[data-dm-meteo="card"] .w-detail span:not(.dm-meteo-parola),
body .dm-testata-riga[data-dm-meteo="card"] .w-detail b{
  font-weight:900;font-variant-numeric:tabular-nums}
/* I giorni che vengono, sotto un filo. */
body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-giorni{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;
  border-top:1px dashed var(--card-border,rgba(15,23,42,.1));padding-top:13px}
body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-giorno{
  display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:9px 4px;border-radius:13px;background:var(--surface-2,#f8fafc)}
body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-giorno-nome{
  font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
  color:var(--text-dim,#64748b)}
body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-giorno-ic{font-size:21px;line-height:1}
body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-giorno-gradi{
  font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-giorno-gradi i{
  font-style:normal;color:var(--text-dim,#64748b)}
/* Sul telefono la card resta una card: si stringe, non si sfascia. */
@media (max-width:640px){
  body .dm-testata-riga[data-dm-meteo="card"]{padding:14px 14px 12px;gap:8px 10px}
  body .dm-testata-riga[data-dm-meteo="card"] .w-icon{font-size:40px}
  body .dm-testata-riga[data-dm-meteo="card"] .w-temp{font-size:32px;letter-spacing:-1.4px}
  body .dm-testata-riga[data-dm-meteo="card"] .w-state{font-size:10.5px}
  body .dm-testata-riga[data-dm-meteo="card"] .dm-orologio-ora{font-size:23px}
  body .dm-testata-riga[data-dm-meteo="card"] .dm-orologio-data{font-size:9px}
  body .dm-testata-riga[data-dm-meteo="card"] .w-right{
    grid-template-columns:repeat(auto-fit,minmax(106px,1fr))}
  body .dm-testata-riga[data-dm-meteo="card"] .w-detail{padding:7px 9px;font-size:11px;gap:5px}
  body .dm-testata-riga[data-dm-meteo="card"] .w-detail .dm-meteo-parola{display:none}
  body .dm-testata-riga[data-dm-meteo="card"] .dm-meteo-giorno-ic{font-size:19px}
}
`;

export function installLaCardDelMeteo() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle("dm-card-del-meteo-style", STILE);
  const ripassa = () => {
    try {
      /* Dove sta il riquadro lo decide chi lo possiede: qui lo si chiede, non
       * lo si sposta. */
      rigaDellaTestata();
      vestiLaCard();
    } catch (_errore) {}
  };
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, ripassa);
  ripassa();
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installLaCardDelMeteo, { once: true });
} else {
  installLaCardDelMeteo();
}
