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
/* Stretto sul serio: il meteo prende una riga tutta sua sotto al nome. */
@media(max-width:860px){
  header.dm-testata-col-meteo{flex-wrap:wrap}
  header.dm-testata-col-meteo .weather-widget{
    order:3;flex:1 0 100%;margin-right:0;justify-content:space-between}
  header.dm-testata-col-meteo .w-state{display:block}
}
/* Sul telefono il nome si tiene la sua riga e lo stato del ponte con la
   rotellina si tengono la loro: altrimenti la rotellina finiva da sola in
   mezzo, spinta giu' dalla pastiglia dello stato. */
@media(max-width:560px){
  header.dm-testata-col-meteo .header-left-wrap{flex:1 0 100%}
}
/* Il telefono: l'intestazione e' gia' in colonna e centrata, e il meteo le si
   accoda come una riga sua, larga quanto la fascia. */
@media(max-width:768px){
  header.dm-testata-col-meteo .weather-widget{padding:8px 12px;gap:8px}
  header.dm-testata-col-meteo .w-icon{font-size:26px}
  header.dm-testata-col-meteo .w-temp{font-size:22px}
  header.dm-testata-col-meteo .w-detail{padding:4px 9px;font-size:10.5px}
  /* Il cielo a parole qui non ci sta: veniva fuori «PO…», che non dice
     niente. L'icona lo dice gia'. */
  header.dm-testata-col-meteo .w-state{display:none}
}
`;

/* L'intestazione della plancia, non quella di una pagina: ogni sezione ne ha
 * una sua — le monta il modulo delle intestazioni di pagina — e si riconoscono
 * dalla classe. */
function testata() {
  return doc?.querySelector?.("header:not(.dm-page-mast)");
}

/** Porta la striscia del meteo dentro l'intestazione, dopo il nome della casa. */
function sposta() {
  const header = testata();
  const meteo = doc?.querySelector?.(".weather-widget");
  if (!header || !meteo) return false;
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
