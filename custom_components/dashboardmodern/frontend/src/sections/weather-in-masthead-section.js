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
import { doc, installStyle, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_WEATHER_MASTHEAD__";
const STYLE_ID = "dm-weather-masthead-style";
const state = (root[KEY] ||= { installed: false, observer: null });

const STILE = `
/* L'intestazione diventa tre parti: il nome, il meteo, lo stato del ponte.
   Il meteo si prende lo spazio che avanza in mezzo. */
header.dm-testata-col-meteo{gap:14px}
header.dm-testata-col-meteo .header-left-wrap{flex:0 0 auto;min-width:0}
/* Larga quanto le serve, non quanto avanza: una fascia tirata fino allo stato
   del ponte sarebbe mezzo schermo di vuoto attorno a quattro numeri. */
header.dm-testata-col-meteo .weather-widget{
  flex:0 1 auto;min-width:0;order:0;margin-right:auto;
  margin:0;padding:8px 14px;border-radius:20px;gap:12px;
  box-shadow:none;background:var(--surface-2,#f8fafc);
  border:1px solid var(--card-border,#e8edf3);
  transition:border-color .2s ease,background .2s ease}
header.dm-testata-col-meteo .weather-widget:hover{
  transform:none;box-shadow:none;
  border-color:color-mix(in srgb,var(--accent,#0ea5e9) 38%,var(--card-border,#e8edf3));
  background:color-mix(in srgb,var(--accent,#0ea5e9) 6%,var(--surface-2,#f8fafc))}
/* Il cerchio che ruotava dietro la card aveva trecento pixel di diametro:
   dentro una fascia alta sessanta e' solo una macchia. */
header.dm-testata-col-meteo .weather-widget::before{display:none}
header.dm-testata-col-meteo .w-left{gap:11px;flex:0 1 auto;min-width:0}
header.dm-testata-col-meteo .w-icon{font-size:30px;animation:none;filter:none}
/* Temperatura e cielo su una riga sola: in colonna la fascia cresceva in
   altezza, che e' esattamente quello che si voleva togliere. */
header.dm-testata-col-meteo .w-temp-wrap{
  flex-direction:row;align-items:baseline;gap:9px;min-width:0}
header.dm-testata-col-meteo .w-temp{font-size:26px}
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
  padding:5px 10px;font-size:11px;gap:5px;box-shadow:none;
  background:var(--card-bg,#fff);border-color:var(--card-border,#e8edf3)}
/* Stretto: il cielo a parole e la percepita sono le prime a cedere il posto,
   i numeri restano. */
@media(max-width:1100px){
  header.dm-testata-col-meteo .w-state{display:none}
  header.dm-testata-col-meteo #w-feel-row{display:none!important}
}
/* Il telefono, tenuto in piedi: una riga sola, e ci sta tutto.
 *
 * Ci sta perche' ogni pezzo dice la stessa cosa con meno: il sottotitolo
 * ripeteva il titolo, il cielo a parole lo dice gia' l'icona, «Umidita'» e
 * «Vento» li dicono la goccia e il soffio, e i due valori vanno uno sopra
 * l'altro invece che uno accanto all'altro — in verticale il meteo costa la
 * meta' in larghezza e non costa niente in altezza, perche' la fascia e' gia'
 * alta quanto il tasto del menu. */
@media(max-width:768px){
  header.dm-testata-col-meteo{flex-wrap:nowrap;gap:7px;padding:10px 12px;text-align:left}
  header.dm-testata-col-meteo .header-left-wrap{flex:1 1 auto;min-width:0;gap:7px}
  header.dm-testata-col-meteo .ha-menu-btn{
    flex:0 0 auto;width:34px;height:34px;padding:0;border-radius:12px}
  header.dm-testata-col-meteo .brand-text{min-width:0}
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
  header.dm-testata-col-meteo .weather-widget{
    flex:0 0 auto;max-width:138px;flex-wrap:wrap;row-gap:0;column-gap:6px;
    padding:4px 9px;border-radius:14px}
  header.dm-testata-col-meteo .w-left{flex:1 0 100%;gap:5px}
  header.dm-testata-col-meteo .w-icon{font-size:18px}
  header.dm-testata-col-meteo .w-temp{font-size:15px}
  header.dm-testata-col-meteo .w-state{display:none}
  header.dm-testata-col-meteo .w-right{
    flex:1 0 100%;flex-direction:row;align-items:center;gap:8px;flex-wrap:nowrap}
  header.dm-testata-col-meteo .w-detail{
    padding:0;font-size:10px;gap:3px;background:none;border:0;line-height:1.3;
    white-space:nowrap}
  /* «Umidita'» e «Vento» le dicono gia' la goccia e il soffio. */
  header.dm-testata-col-meteo .dm-meteo-parola{display:none}
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
 * dalla classe. */
function testata() {
  return doc?.querySelector?.("header:not(.dm-page-mast)");
}

/* «💧 Umidita' 38%» e' un'icona, una parola e un numero, ma la parola nel
 * documento e' un nodo di testo nudo: il CSS su quello non puo' niente. Qui la
 * si avvolge, una volta sola, cosi' sul telefono si puo' togliere di mezzo
 * lasciando l'icona e il numero — che e' tutto quello che serve leggere. */
function avvolgiLeParole(meteo) {
  for (const misura of meteo.querySelectorAll(".w-detail")) {
    if (misura.querySelector(".dm-meteo-parola")) continue;
    for (const pezzo of [...misura.childNodes]) {
      if (pezzo.nodeType !== 3) continue;
      /* Il pezzo e' «💧 Umidita' »: l'icona davanti resta com'e' — e' lei che
       * dice di che misura si tratta quando la parola non c'e' piu' — e si
       * avvolge soltanto la parola. */
      const parti = pezzo.textContent.match(/^([^\p{L}]*)(\p{L}[\s\S]*?)(\s*)$/u);
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
function sposta() {
  const header = testata();
  const meteo = doc?.querySelector?.(".weather-widget");
  if (!header || !meteo) return false;
  avvolgiLeParole(meteo);
  if (meteo.parentElement === header) return false;
  const nome = header.querySelector(".header-left-wrap");
  if (nome) nome.after(meteo);
  else header.prepend(meteo);
  header.classList.add("dm-testata-col-meteo");
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
   * suo posto senza ridisegnare niente. */
  const page = doc.getElementById?.("page-home");
  if (page && typeof root.MutationObserver === "function") {
    state.observer = new root.MutationObserver(() => sposta());
    state.observer.observe(page, { childList: true });
  }
  state.installed = true;
  return true;
}
