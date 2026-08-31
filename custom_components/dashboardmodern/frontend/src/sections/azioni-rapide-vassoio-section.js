/* Il vassoio delle Azioni rapide.
 *
 * Sulla Home c'erano due idee di card una sotto l'altra: le tessere dei widget
 * — orizzontali, con la pastiglia, il numero e la misura — e le azioni rapide,
 * quadrate, bianche e spoglie, col simbolo che galleggiava sopra il vuoto.
 * Erano due forme diverse, e si vedeva.
 *
 * La risposta non e' fare le azioni uguali alle tessere: fanno due mestieri
 * diversi. La tessera racconta (un numero, una didascalia, una proporzione),
 * l'azione fa (un tocco, nessuno stato). Quindi le azioni restano tasti
 * quadrati, ma entrano in un ripiano solo, leggermente incavato: le tessere
 * sporgono dalla pagina, i tasti ci sprofondano dentro. Sopra c'e' quello che
 * si legge, sotto quello che si preme.
 *
 * Da qui in poi la geometria del tasto ha un padrone solo. Prima la scriveva
 * la guardia del marchio con il peso massimo, e chi voleva cambiarla doveva
 * andare a cercarla la'. Le misure del simbolo restano dove stanno — le
 * governa il motore delle icone — e qui non si toccano.
 */
import { doc, installStyle, root, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_AZIONI_VASSOIO__";
const STYLE_ID = "dm-azioni-vassoio-style";
const state = (root[KEY] ||= { installed: false });

const STILE = `
/* Le intestazioni della Home: il titolo, un filo che sfuma fino al bordo, e
   l'aria sopra. Il titolo aveva quindici pixel di margine e la card sopra ne
   butta diciotto di ombra: cominciava dentro l'ombra della card precedente. */
#page-home .section-title{
  display:flex;align-items:center;gap:11px;margin-top:28px}
#page-home .section-title::after{
  content:"";flex:1;height:1px;border-radius:1px;
  background:linear-gradient(90deg,
    var(--card-border,#e2e8f0),
    color-mix(in srgb,var(--card-border,#e2e8f0) 20%,transparent))}
/* La prima intestazione della pagina non ha niente sopra da cui staccarsi. */
#page-home>.section-title:first-child{margin-top:15px}

/* Il vassoio: un ripiano incavato che tiene dentro i tasti.
   Il fondo viene da --bg-sculpted, che e' la variabile vera del tema: qui
   c'era scritto --bg, che non esiste da nessuna parte, e in modalita' scura
   il ripiano restava sul ripiego chiaro — un lenzuolo bianco in mezzo alla
   Home nera, coi tasti scuri sopra. */
#page-home .dm-vassoio{
  padding:12px;border-radius:26px;position:relative;
  background:linear-gradient(180deg,
    color-mix(in srgb,var(--text,#0f172a) 6%,var(--bg-sculpted,#eef2f7)),
    color-mix(in srgb,var(--text,#0f172a) 3%,var(--bg-sculpted,#eef2f7)));
  box-shadow:inset 0 3px 9px rgba(15,23,42,.14),inset 0 -1px 0 var(--dm-vetrino-vassoio,rgba(255,255,255,.75))}
html[data-theme="dark"] #page-home .dm-vassoio,
body.dark-theme #page-home .dm-vassoio{
  --dm-vetrino-vassoio:rgba(255,255,255,.06);
  box-shadow:inset 0 3px 10px rgba(0,0,0,.55),inset 0 -1px 0 rgba(255,255,255,.05)}
/* La cucitura in fondo: e' quella che fa sembrare il ripiano un pezzo solo. */
#page-home .dm-vassoio::after{
  content:"";position:absolute;left:12px;right:12px;bottom:6px;height:1px;border-radius:1px;
  background:var(--dm-vetrino-vassoio,rgba(255,255,255,.75));opacity:.55;pointer-events:none}

/* Dentro il vassoio i tasti hanno un tetto di larghezza.
   Qui c'era scritto il contrario — «senza tetto massimo, un tasto che si
   ferma prima lascia un vuoto» — e il campo ha risposto con la foto: con due
   o tre azioni su uno schermo largo ogni tasto si stirava a mezzo metro,
   «card enormi» che non si renderizzano bene. Un tasto e' un tasto: al
   massimo 220 pixel, e la fila si centra nel ripiano — auto-fit butta via le
   colonne vuote, quindi niente buchi fantasma ai lati. */
html body #page-home .dm-vassoio #qa-grid{
  display:grid!important;grid-template-columns:repeat(auto-fit,minmax(150px,220px))!important;
  justify-content:center!important;align-items:stretch!important;gap:10px!important;width:100%!important}
html body #page-home .dm-vassoio #qa-grid .qa-btn{
  box-sizing:border-box!important;width:100%!important;max-width:none!important;
  min-height:100px!important;height:auto!important;padding:14px 10px!important;
  border:1px solid color-mix(in srgb,var(--text,#0f172a) 8%,transparent)!important;
  border-radius:18px!important;justify-content:center!important;gap:11px!important;
  background:linear-gradient(180deg,
    var(--card-background-color,var(--card-bg,#fff)),
    color-mix(in srgb,var(--card-background-color,var(--card-bg,#fff)) 93%,var(--bg-sculpted,#eef2f7)))!important;
  box-shadow:inset 0 1px 0 var(--dm-vetrino-vassoio,rgba(255,255,255,.75)),
             0 8px 18px -14px rgba(15,23,42,.85)!important;
  transition:transform .13s ease,background .13s ease}
@media(hover:hover){
  html body #page-home .dm-vassoio #qa-grid .qa-btn:hover{transform:translateY(-2px)}
}
html body #page-home .dm-vassoio #qa-grid .qa-btn:active{
  transform:translateY(2px) scale(.975)}
html body #page-home .dm-vassoio #qa-grid .qa-btn:focus-visible{
  outline:2px solid var(--accent,#0ea5e9);outline-offset:3px}
/* Il simbolo diventa un disco di smalto: il colore dell'azione sotto, il
   riflesso sopra. Le misure restano quelle del motore delle icone. */
html body #page-home .dm-vassoio #qa-grid .qa-btn .icon{
  position:relative;overflow:hidden!important;border-radius:18px!important;
  background:linear-gradient(155deg,
    color-mix(in srgb,var(--dm-azione-tinta,var(--accent,#0ea5e9)) 78%,#fff),
    var(--dm-azione-tinta,var(--accent,#0ea5e9)) 58%,
    color-mix(in srgb,var(--dm-azione-tinta,var(--accent,#0ea5e9)) 82%,#000))!important;
  box-shadow:0 13px 22px -15px var(--dm-azione-tinta,var(--accent,#0ea5e9)),
             inset 0 1px 0 rgba(255,255,255,.55)!important;
  color:#fff!important;
  filter:none!important;
  transition:transform .18s cubic-bezier(.2,.9,.25,1)}
html body #page-home .dm-vassoio #qa-grid .qa-btn .icon::after{
  content:"";position:absolute;left:2px;right:2px;top:2px;height:46%;
  border-radius:16px 16px 50% 50%;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,.36),rgba(255,255,255,0))}
html body #page-home .dm-vassoio #qa-grid .qa-btn .icon>*{position:relative;z-index:1}
/* Dentro il disco il simbolo respira: a filo del bordo sembrava una figurina
   incollata sopra un quadrato, non l'anima del tasto. */
html body #page-home .dm-vassoio #qa-grid .qa-btn .icon .dm-v01525-action-glyph,
html body #page-home .dm-vassoio #qa-grid .qa-btn .icon .dm-beta12-action-glyph,
html body #page-home .dm-vassoio #qa-grid .qa-btn .icon .dm-action-glyph{
  font-size:32px!important;filter:drop-shadow(0 2px 3px rgba(15,23,42,.3))!important}
html body #page-home .dm-vassoio #qa-grid .qa-btn:active .icon{transform:scale(.9)}
/* L'onda parte dal punto in cui si preme: la conferma che il comando e'
   partito arriva prima della casa. */
#page-home .dm-vassoio .qa-btn{position:relative;overflow:hidden}
#page-home .dm-vassoio .dm-onda{
  position:absolute;border-radius:50%;pointer-events:none;
  transform:translate(-50%,-50%) scale(0);
  background:radial-gradient(circle,
    color-mix(in srgb,var(--dm-azione-tinta,var(--accent,#0ea5e9)) 34%,transparent),transparent 70%);
  animation:dmOndaAzione .62s ease-out forwards}
@keyframes dmOndaAzione{to{transform:translate(-50%,-50%) scale(1);opacity:0}}
@media(max-width:560px){
  html body #page-home .dm-vassoio #qa-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  html body #page-home .dm-vassoio #qa-grid .qa-btn{min-height:96px!important}
}
@media(prefers-reduced-motion:reduce){
  #page-home .dm-vassoio .dm-onda{animation:none;display:none}
}
`;

/* Il ripiano attorno alla griglia dei tasti.
 *
 * Chi ridisegna le azioni riscrive il contenuto della griglia, non la griglia:
 * il ripiano messo una volta resta al suo posto, e non serve nessuno che
 * stia a guardare la pagina. */
function avvolgi() {
  const griglia = doc?.getElementById?.("qa-grid");
  if (!griglia) return false;
  if (griglia.parentElement?.classList?.contains("dm-vassoio")) return false;
  const vassoio = doc.createElement("div");
  vassoio.className = "dm-vassoio";
  vassoio.dataset.dmVassoio = "azioni";
  griglia.replaceWith(vassoio);
  vassoio.append(griglia);
  return true;
}

/* Ogni tasto porta la propria tinta: il disco la usa per lo smalto e per
 * l'onda. La tinta e' quella che la plancia scrive gia' sul simbolo. */
function tingi() {
  for (const tasto of doc?.querySelectorAll?.("#page-home .dm-vassoio .qa-btn") || []) {
    const simbolo = tasto.querySelector(".icon");
    const tinta = simbolo?.style?.color;
    if (tinta) tasto.style.setProperty("--dm-azione-tinta", tinta);
  }
}

function onda(evento) {
  const tasto = evento.target?.closest?.("#page-home .dm-vassoio .qa-btn");
  if (!tasto) return;
  if (root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const bordo = tasto.getBoundingClientRect();
  const lato = Math.max(bordo.width, bordo.height) * 2.4;
  const cerchio = doc.createElement("span");
  cerchio.className = "dm-onda";
  cerchio.style.cssText = `width:${lato}px;height:${lato}px;left:${evento.clientX - bordo.left}px;top:${evento.clientY - bordo.top}px`;
  tasto.append(cerchio);
  root.setTimeout?.(() => cerchio.remove(), 640);
}

/* Senza azioni configurate la plancia nasconde la griglia e il titolo sopra,
 * e per trovare il titolo guarda chi c'e' prima della griglia. Dentro il
 * ripiano prima della griglia non c'e' piu' nessuno: il nascondere lo fa qui,
 * sul ripiano intero e sul titolo che adesso e' suo vicino. */
function adegua() {
  const griglia = doc?.getElementById?.("qa-grid");
  const vassoio = griglia?.parentElement;
  if (!vassoio?.classList?.contains?.("dm-vassoio")) return;
  const vuoto = griglia.style.display === "none";
  vassoio.hidden = vuoto;
  const titolo = vassoio.previousElementSibling;
  if (titolo && /azioni/i.test(titolo.textContent || ""))
    titolo.style.display = vuoto ? "none" : "";
}

function ripassa() {
  avvolgi();
  tingi();
  adegua();
}

export function installAzioniRapideVassoio() {
  if (state.installed) return false;
  if (!doc?.getElementById) return false;
  installStyle(STYLE_ID, STILE);
  ripassa();
  /* Le azioni si rifanno quando si salva la configurazione: la tinta di ogni
   * tasto e il ripiano vanno ripassati dopo, non prima. */
  wrapFunction("buildQuickActions", "__dmVassoioAzioni", ripassa);
  for (const evento of ["dashboardmodern:editor-rendered", "dashboardmodern:state-changed"])
    root.addEventListener?.(evento, ripassa);
  doc.addEventListener("pointerdown", onda, true);
  state.installed = true;
  return true;
}
