/* Il meteo va a stare nell'intestazione.
 *
 * La striscia del meteo era una card alta trentadue di padding con l'icona a
 * settanta e la temperatura a cinquantadue: da sola si prendeva un quinto
 * dello schermo di un telefono, e diceva quattro numeri. Tutto quello che
 * dice sta comodo accanto al nome della casa — che nell'intestazione ha un
 * mezzo schermo vuoto alla sua destra — e quello che si guadagna e' la prima
 * fila di tessere che si vede senza scorrere.
 *
 * Il blocco non si ridisegna: si sposta. `#w-icon`, `#w-temp`, `#w-state`,
 * `#w-hum` e `#w-wind` restano quelli, li aggiorna la plancia come sempre, e
 * il clic apre lo stesso popup di prima. Qui cambiano solo il posto e la
 * taglia.
 */
import { onLocaleChange } from "../core/i18n.js";
import { translateSource } from "../core/i18n-dom.js";
import { clean, doc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_WEATHER_MASTHEAD__";
const STYLE_ID = "dm-weather-masthead-style";
const state = (root[KEY] ||= { installed: false, observer: null });

const STILE = `
/* L'intestazione diventa tre parti: il nome, il meteo, lo stato del ponte.
   Il meteo si prende lo spazio che avanza in mezzo. */
header.dm-testata-col-meteo{gap:14px}
header.dm-testata-col-meteo .header-left-wrap{flex:0 0 auto;min-width:0}
/* Larga quanto le serve, non quanto avanza: una fascia tirata fino allo stato
   del ponte sarebbe mezzo schermo di vuoto attorno a quattro numeri.
   E staccata dal nome della casa: appiccicata sembrava una parte del nome,
   non un'altra cosa. Il margine cresce con la finestra — su uno schermo largo
   lo spazio c'e', e due blocchi lontani si leggono come due blocchi. */
/* Il nome della casa si prende la sua riga, e il riquadro va a capo sotto:
   e' quello che vuol dire «passa il titolo e sotto fai la riga».
   E il nome sta al centro: il tasto del menu resta a sinistra, lo stato del
   ponte e l'ingranaggio a destra, e in mezzo c'e' il nome — che e' l'unica
   cosa che si legge da lontano. */
header.dm-testata-col-meteo{flex-wrap:wrap;row-gap:8px}
header.dm-testata-col-meteo .header-left-wrap{flex:1 1 auto;min-width:0}
header.dm-testata-col-meteo .brand-text{flex:1 1 auto;min-width:0;text-align:center}
header.dm-testata-col-meteo .dm-testata-riga{
  flex:1 1 100%;order:9;display:flex;align-items:center;gap:10px;min-width:0;
  padding:6px 12px;border-radius:16px;
  background:var(--surface-2,#f8fafc);border:1px solid var(--card-border,#e8edf3);
  transition:border-color .2s ease,background .2s ease}
header.dm-testata-col-meteo .dm-testata-riga:hover{
  border-color:color-mix(in srgb,var(--accent,#0ea5e9) 38%,var(--card-border,#e8edf3));
  background:color-mix(in srgb,var(--accent,#0ea5e9) 6%,var(--surface-2,#f8fafc))}
/* Dentro il riquadro non ci sono altri riquadri: il bordo e il fondo sono del
   riquadro, e il meteo ci sta dentro nudo. */
header.dm-testata-col-meteo .weather-widget{
  flex:1 1 auto;min-width:0;order:0;
  margin:0;padding:0;border:0;border-radius:0;background:none;gap:10px;
  box-shadow:none}
header.dm-testata-col-meteo .weather-widget:hover{
  transform:none;box-shadow:none;background:none}
/* Il cerchio che ruotava dietro la card aveva trecento pixel di diametro:
   dentro una fascia alta sessanta e' solo una macchia. */
header.dm-testata-col-meteo .weather-widget::before{display:none}
header.dm-testata-col-meteo .w-left{gap:11px;flex:0 1 auto;min-width:0}
/* Il simbolo del meteo sta in una casella di misura fissa.
 *
 * Le condizioni non sono tutte emoji della stessa larghezza — «☀️» e «⛅» sono
 * larghe una, «💨» e «🌨️» un'altra — e nebbia e grandine non sono nemmeno
 * emoji: sono un blocchetto animato di cinque righe, che dentro una fascia
 * alta quaranta si prendeva lo spazio di una card. Con la casella fissa il
 * riquadro non cambia forma al cambiare del tempo, che è l'unica cosa che
 * conta qui: la testata non deve saltare perché è arrivata la pioggia. */
header.dm-testata-col-meteo .w-icon{
  flex:0 0 auto;width:26px;height:26px;display:grid;place-items:center;overflow:hidden;
  font-size:22px;line-height:1;animation:none;filter:none}
/* La nebbia e la grandine, in scala: sono cinque righe disegnate, e dentro la
   casella ci stanno rimpicciolite invece che tagliate. */
header.dm-testata-col-meteo .w-icon .w-fog-anim{
  width:22px;height:16px;gap:2px;transform:none}
header.dm-testata-col-meteo .w-icon .fog-line{height:2px;border-radius:2px}
/* Temperatura e cielo su una riga sola: in colonna la fascia cresceva in
   altezza, che e' esattamente quello che si voleva togliere. */
header.dm-testata-col-meteo .w-temp-wrap{
  flex-direction:row;align-items:baseline;gap:9px;min-width:0}
header.dm-testata-col-meteo .w-temp{font-size:19px}
header.dm-testata-col-meteo .w-state{
  margin-top:0;font-size:10.5px;letter-spacing:1px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Umidita' e vento erano incolonnate all'estremita' opposta della card, a due
   spanne di distanza dal numero che commentano: adesso sono una accanto
   all'altra, subito dopo. */
header.dm-testata-col-meteo .w-right{
  flex-direction:row;align-items:center;gap:6px;flex-wrap:wrap;
  justify-content:flex-start}
header.dm-testata-col-meteo .w-detail{
  padding:3px 8px;font-size:10.5px;gap:4px;box-shadow:none;
  background:var(--card-bg,#fff);border-color:var(--card-border,#e8edf3)}
/* La percepita non si nasconde mai.
 *
 * Qui c'era una regola che la toglieva di mezzo sotto i millecento pixel,
 * insieme al cielo a parole, per far stare tutto in larghezza. Il cielo a
 * parole lo dice gia' l'icona; la percepita no: compare soltanto se qualcuno
 * e' andato in configurazione a mappare quel sensore, e nascondere una cosa
 * che e' stata chiesta apposta non e' fare spazio, e' perdere il dato.
 * Se non ci sta in riga, va a capo — e' per questo che la fila dei numeri
 * sa andare a capo. */
/* Il telefono, tenuto in piedi: una riga sola, e ci sta tutto.
 *
 * Ci sta perche' ogni pezzo dice la stessa cosa con meno: il sottotitolo
 * ripeteva il titolo, il cielo a parole lo dice gia' l'icona, «Umidita'» e
 * «Vento» li dicono la goccia e il soffio, e i due valori vanno uno sopra
 * l'altro invece che uno accanto all'altro — in verticale il meteo costa la
 * meta' in larghezza e non costa niente in altezza, perche' la fascia e' gia'
 * alta quanto il tasto del menu. */
@media(max-width:768px){
  header.dm-testata-col-meteo{flex-wrap:wrap;gap:7px;row-gap:6px;padding:10px 12px;text-align:left}
  header.dm-testata-col-meteo .header-left-wrap{flex:1 1 auto;min-width:0;gap:7px}
  header.dm-testata-col-meteo .ha-menu-btn{
    flex:0 0 auto;width:34px;height:34px;padding:0;border-radius:12px}
  header.dm-testata-col-meteo .brand-text{min-width:0;text-align:center}
  header.dm-testata-col-meteo .brand-text p{display:none}
  header.dm-testata-col-meteo .brand-text h1{
    font-size:14px;letter-spacing:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* Il meteo non si stringe: a cedere e' il nome, che sa accorciarsi coi
     puntini. E dentro sta su due righe corte invece che su una lunga — la
     fascia e' gia' alta quanto il tasto del menu, quindi la seconda riga non
     costa niente in altezza e fa risparmiare meta' larghezza. */
  /* Il tetto di larghezza serve: un contenitore flessibile che va a capo, se
     lo si lascia decidere, si misura come se le sue righe stessero tutte su
     una — e si prendeva duecento pixel per starne su due da centotrenta,
     lasciando al nome della casa lo spazio per «SM…». */
  header.dm-testata-col-meteo .dm-testata-riga{padding:5px 10px;gap:8px}
  header.dm-testata-col-meteo .weather-widget{
    flex:1 1 auto;min-width:0;flex-wrap:nowrap;row-gap:0;column-gap:8px;
    margin:0;padding:0;border:0}
  /* Tutto su una riga sola, anche sul telefono.
     «Vista smartphone: metti vento e pioggia affianco a meteo, così diventa
     meno spessa la testata.» Prima la temperatura stava sopra e i numeri
     sotto, e il riquadro veniva alto il doppio — aveva senso quando il meteo
     divideva la riga col nome della casa e aveva centotrenta pixel; adesso il
     riquadro ha tutta la larghezza, e i numeri ci stanno accanto. */
  header.dm-testata-col-meteo .w-left{flex:0 0 auto;gap:6px}
  header.dm-testata-col-meteo .w-icon{width:20px;height:20px;font-size:17px}
  header.dm-testata-col-meteo .w-icon .w-fog-anim{width:17px;height:12px;gap:1.5px}
  header.dm-testata-col-meteo .w-temp{font-size:15px}
  header.dm-testata-col-meteo .w-state{display:none}
  /* I numeri non si stringono: o ci stanno interi o non ci stanno. Tagliarli
     a metà — «💧 41%» e mezzo soffio di vento — è peggio che non averli. */
  header.dm-testata-col-meteo .w-right{
    flex:0 0 auto;flex-direction:row;align-items:center;
    column-gap:8px;row-gap:0;flex-wrap:nowrap}
  header.dm-testata-col-meteo .w-detail{
    flex:0 0 auto;padding:0;font-size:10px;gap:3px;background:none;border:0;line-height:1.3;
    white-space:nowrap}
  /* «Umidita'» e «Vento» le dicono gia' la goccia e il soffio. */
  header.dm-testata-col-meteo .dm-meteo-parola{display:none}
}
/* Sul telefono stretto il nome della casa torna intero.
 *
 * Da quando la plancia tiene davvero la distanza dai bordi, la fascia e'
 * ventotto pixel piu' stretta: se li prendeva il nome, che si accorciava coi
 * puntini — «Smart Home» diventava «Smart Ho…». Il nome e' l'unica parola che
 * dice dove si e', quindi qui a cedere e' il meteo: il suo tetto di larghezza
 * scende di ventisei pixel, quanti ne servono al nome.
 *
 * A cedere e' il tetto, non il contenuto. Il primo tentativo spegneva
 * l'ultimo dettaglio del riquadro per fare spazio, e l'ultimo dettaglio non
 * e' sempre lo stesso: dove c'e' la percepita era lei a sparire, cioe' un
 * dato che il riquadro aveva e non mostrava piu'. Una riga che si accorcia si
 * legge lo stesso; una riga che non c'e' non si legge affatto. */
/* Quel tetto adesso non serve piu', e faceva danno.
 *
 * Serviva quando il meteo divideva la riga col nome della casa: la sua
 * larghezza era quella che mancava al nome. Adesso il nome sta sulla sua riga
 * e il riquadro ha tutta la larghezza sotto — il tetto restava, e a centododici
 * pixel il vento finiva fuori dal riquadro e veniva tagliato via, che e' la
 * riga che non si legge affatto di cui parla il commento qui sopra. */
@media(max-width:560px){
  header.dm-testata-col-meteo .weather-widget{max-width:none;padding:0}
}
/* Lo stato della connessione e' un puntino, non una frase.
 *
 * «Connesso» accanto a un pallino verde e' la stessa cosa detta due volte, e
 * su un telefono quella frase e' la larghezza che manca al meteo. La parola
 * resta scritta per chi la pagina se la fa leggere: sparisce dalla vista, non
 * dal documento. */
header.dm-testata-col-meteo>.status-pill{
  flex:0 0 auto;padding:0;gap:0;border:0;background:none;box-shadow:none}
header.dm-testata-col-meteo>.status-pill>#conn-text{
  position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap}
header.dm-testata-col-meteo>.status-pill .live-dot{width:13px;height:13px}
`;

/* L'intestazione della plancia, non quella di una pagina: ogni sezione ne ha
 * una sua — le monta il modulo delle intestazioni di pagina — e si riconoscono
 * dalla classe. Quella della plancia e' figlia diretta del corpo, e si chiede
 * cosi': senza il `>` ci finiscono dentro anche le intestazioni delle finestre
 * di modifica. */
function testata() {
  return doc?.querySelector?.("body>header:not(.dm-page-mast)");
}

/* «💧 Umidita' 38%» e' un'icona, una parola e un numero, ma la parola nel
 * documento e' un nodo di testo nudo: il CSS su quello non puo' niente. Qui la
 * si avvolge, una volta sola, cosi' sul telefono si puo' togliere di mezzo
 * lasciando l'icona e il numero — che e' tutto quello che serve leggere.
 *
 * Si traduce prima e si taglia dopo, e l'ordine non e' un dettaglio: la chiave
 * del catalogo e' «💧 Umidita'» intera, icona compresa. Tagliando per primi si
 * ottengono due pezzi che non sono chiavi di niente — un'emoji da una parte e
 * una parola dall'altra — e tre stringhe che si traducevano da sempre tornano
 * nella lingua del guscio: in francese si leggeva «Vento», che e' pure la
 * lingua sbagliata due volte, perche' anche la build inglese la scrive cosi'.
 *
 * L'originale si tiene da parte sulla misura. Il catalogo di una lingua si
 * scarica quando serve, quindi la prima passata puo' arrivare prima di lui e
 * scrivere l'inglese: con il testo di partenza ancora a portata di mano si
 * rifa' la parola quando la lingua e' pronta, invece di restare com'era. */
const SORGENTE = "data-dm-meteo-src";

function avvolgiLeParole(meteo) {
  for (const misura of meteo.querySelectorAll(".w-detail")) {
    const gia = misura.querySelector(".dm-meteo-parola");
    if (gia && misura.hasAttribute(SORGENTE)) {
      const parti = translateSource(misura.getAttribute(SORGENTE)).match(
        /^([^\p{L}]*)(\p{L}[\s\S]*?)(\s*)$/u,
      );
      if (parti) {
        if (gia.previousSibling?.nodeType === 3) gia.previousSibling.textContent = parti[1];
        gia.textContent = parti[2];
      }
      continue;
    }
    if (gia) continue;
    for (const pezzo of [...misura.childNodes]) {
      if (pezzo.nodeType !== 3) continue;
      const intero = pezzo.textContent;
      if (!/\p{L}/u.test(intero)) continue;
      misura.setAttribute(SORGENTE, intero.trim());
      const coda = /\s*$/.exec(intero)[0];
      const tradotto = `${translateSource(intero.trim())}${coda}`;
      /* Il pezzo e' «💧 Umidita' »: l'icona davanti resta com'e' — e' lei che
       * dice di che misura si tratta quando la parola non c'e' piu' — e si
       * avvolge soltanto la parola. */
      const parti = tradotto.match(/^([^\p{L}]*)(\p{L}[\s\S]*?)(\s*)$/u);
      if (!parti) continue;
      const gruppo = doc.createDocumentFragment();
      if (parti[1]) gruppo.append(parti[1]);
      const guscio = doc.createElement("span");
      guscio.className = "dm-meteo-parola";
      guscio.textContent = parti[2];
      gruppo.append(guscio, parti[3] || " ");
      pezzo.replaceWith(gruppo);
    }
  }
}

/** Porta la striscia del meteo dentro l'intestazione, dopo il nome della casa. */
/* Il riquadro sotto il titolo.
 *
 * «Passa il titolo dashboard e sotto fai la riga con meteo e orologio, ma
 * devono stare nello stesso quadrato e non deve essere grande.»
 *
 * Prima erano due pastiglie in fila accanto al nome della casa, ognuna col suo
 * bordo: due cornici per due cose che si guardano insieme. Adesso il nome sta
 * sulla sua riga e sotto c'è UN riquadro, che è questo — il bordo e il fondo
 * sono suoi, e quello che ci sta dentro non ne ha più. Chi ci si mette dentro
 * lo chiede qui: averne due che se lo disegnano vorrebbe dire due riquadri
 * sovrapposti al primo giro storto. */
export function rigaDellaTestata() {
  const header = testata();
  if (!header) return null;
  let riga = header.querySelector(":scope > .dm-testata-riga");
  if (riga) return riga;
  riga = doc.createElement("div");
  riga.className = "dm-testata-riga";
  const nome = header.querySelector(".header-left-wrap");
  if (nome) nome.after(riga);
  else header.append(riga);
  return riga;
}

function sposta() {
  const header = testata();
  const meteo = doc?.querySelector?.(".weather-widget");
  if (!header || !meteo) return false;
  avvolgiLeParole(meteo);
  const riga = rigaDellaTestata();
  if (!riga) return false;
  /* La classe si riafferma, non si presuppone: senza, il meteo dentro la
   * fascia torna alla taglia da card intera — icona a settanta, temperatura a
   * cinquantadue — e sfonda i margini. */
  header.classList.add("dm-testata-col-meteo");
  if (meteo.parentElement === riga) return false;
  /* Primo nel riquadro: il meteo prima, l'ora dopo. */
  riga.prepend(meteo);
  return true;
}

/* La testata di Home non resta nascosta sulla Home.
 *
 * Il guscio la nasconde con uno stile inline quando si apre un'altra sezione
 * e la rimostra SOLO al clic sulla linguetta Home: qualunque strada riporti
 * alla Home senza passare da quel clic — un ripristino, un ricaricamento a
 * meta', un giro storto del telefono («scompare la scritta in alto, si vede
 * solo il meteo») — la lascia invisibile per sempre, perche' nessun altro la
 * ripara. Qui la ripara chiunque passi: se la pagina attiva e' la Home e la
 * testata ha il display inline spento, lo si toglie. Sulle altre sezioni non
 * si tocca niente: li' nascosta e' giusta. */
function ripara() {
  const header = testata();
  if (!header) return;
  const attiva = doc?.querySelector?.(".page.active");
  if (attiva?.id === "page-home" && header.style.display === "none") {
    header.style.display = "";
  }
  sposta();
}

/* La mappatura del meteo, sfoltita: «non mostrare tutte le entita'; un flag
 * "usa entita' proprie" mostra i campi, altrimenti default sull'entita'
 * weather». I cinque campi della stazione — temperatura, umidita',
 * percepita, vento, direzione — restano dietro la casella: chi li aveva
 * gia' mappati la trova accesa da sola. */
const FLAG_METEO = "cd_meteo_entita_proprie";

function flagMeteo() {
  try {
    const scritto = root.localStorage?.getItem?.(FLAG_METEO);
    return scritto == null ? null : scritto === "1";
  } catch (_errore) {
    return null;
  }
}

function montaFlagMeteo() {
  const slotMeteo = doc?.querySelector?.('input[data-ref="dm.home_meteo"]');
  const fisarmonica = slotMeteo?.closest?.("details.ed-acc");
  if (!fisarmonica) return false;
  const campi = [...fisarmonica.querySelectorAll('input[data-ref^="dm.home_meteo_"]')]
    .map((input) => input.closest(".ed-slot"))
    .filter(Boolean);
  if (!campi.length) return false;
  let casella = fisarmonica.querySelector("[data-dm-meteo-flag]");
  const scelto = flagMeteo();
  const mappati = campi.some((slot) => clean(slot.querySelector("input[data-ref]")?.value));
  const acceso = scelto == null ? mappati : scelto;
  if (!casella) {
    casella = doc.createElement("label");
    casella.className = "ed-check dm-meteo-flag";
    casella.dataset.dmMeteoFlag = "";
    casella.innerHTML =
      `<input type="checkbox"${acceso ? " checked" : ""}> ` +
      t(
        "Usa entità proprie per la stazione meteo",
        "Use your own entities for the weather station",
      ) +
      `<small>${t(
        "Spenta, basta l'entità weather qui sopra: temperatura, umidità e vento si leggono da lei.",
        "Off, the weather entity above is enough: temperature, humidity and wind come from it.",
      )}</small>`;
    slotMeteo.closest(".ed-slot")?.after(casella);
    casella.querySelector("input").addEventListener("change", (evento) => {
      try {
        root.localStorage?.setItem?.(FLAG_METEO, evento.target.checked ? "1" : "0");
        root.cdMarkDirty?.();
        root.cdSyncPush?.();
      } catch (_errore) {}
      montaFlagMeteo();
    });
  }
  const vivo = casella.querySelector("input")?.checked ?? acceso;
  for (const slot of campi) slot.hidden = !vivo;
  return true;
}

export function installWeatherInMasthead() {
  if (state.installed) return false;
  if (!doc?.querySelector) return false;
  installStyle(STYLE_ID, STILE);
  sposta();
  /* La plancia ridisegna la Home a ogni giro di stati, e chi la ridisegna
   * riscrive `#page-home` per intero: il meteo, che ormai sta altrove, non
   * torna indietro da solo — ma se qualcuno lo rimette li' dentro va ripreso.
   * L'osservatore guarda solo i figli della pagina, e riporta il blocco al
   * suo posto senza ridisegnare niente. Se la pagina non c'e' ancora, si
   * riprova quando il guscio si annuncia: installarsi una volta sola a
   * pagina assente lasciava il meteo orfano per tutta la sessione. */
  const osserva = () => {
    if (state.observer) return;
    const page = doc.getElementById?.("page-home");
    if (page && typeof root.MutationObserver === "function") {
      state.observer = new root.MutationObserver(() => sposta());
      state.observer.observe(page, { childList: true });
    }
  };
  osserva();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
    "pageshow",
  ]) {
    root.addEventListener?.(eventName, () => {
      osserva();
      ripara();
    });
  }
  /* Lo scroll non dovrebbe entrarci, ma e' proprio durante lo scroll veloce
   * che la testata e' stata vista sparire: a fine corsa si controlla. */
  root.addEventListener?.("scrollend", ripara);
  doc.addEventListener?.("visibilitychange", ripara);
  /* La lingua puo' arrivare dopo: il catalogo si scarica, e quando e' pronto
   * le parole del meteo vanno rifatte dal loro originale. */
  for (const eventoEditor of ["dashboardmodern:editor-rendered", "dashboardmodern:legacy-ready"])
    root.addEventListener?.(eventoEditor, () => montaFlagMeteo());
  doc.addEventListener?.(
    "click",
    (evento) => {
      if (evento.target?.closest?.(".ed-tab[data-tab], .ed-acc-head"))
        root.setTimeout?.(montaFlagMeteo, 0);
    },
    true,
  );
  state.stopLocale = onLocaleChange(() => {
    const meteo = doc?.querySelector?.(".weather-widget");
    if (meteo) avvolgiLeParole(meteo);
  });
  state.installed = true;
  return true;
}
