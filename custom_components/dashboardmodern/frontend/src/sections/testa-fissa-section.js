/* La parte in alto che resta ferma mentre il resto scorre (#521).
 *
 * «Valutare se mettere un'opzione che tiene fissa tutta la parte iniziale, e
 * se uno scorre verso il basso vede il resto.»
 *
 * La parte iniziale e' l'intestazione: l'hamburger, il nome della casa, il
 * meteo e l'ora quando sta li'. E' la riga che si guarda per sapere che ore
 * sono e che tempo fa, ed e' anche la riga da cui si esce dalla plancia —
 * scorrendo in fondo a una Home lunga se ne va, e per tornarci si risale tutto.
 *
 * Non e' pero' una cosa da dare a tutti: su un telefono quella striscia e' un
 * quinto dello schermo, e tenerla ferma vuol dire leggere il resto da una
 * feritoia. Per questo e' un interruttore, sta spento, e sta accanto al modo
 * chiosco: sono la stessa famiglia di scelte — come si vede la plancia SU
 * QUESTO VETRO, non come e' configurata la casa. Il tablet appeso al muro la
 * vuole ferma, il telefono no, e sincronizzarla renderebbe impossibile averle
 * tutt'e due.
 *
 * Si tiene ferma con `position:sticky`, non con `fixed`: sticky resta dentro il
 * flusso — la pagina sotto non ci va a finire dietro e non serve compensare
 * l'altezza a mano, che e' il modo in cui queste cose si rompono al primo
 * schermo di dimensione diversa.
 */
import {
  ORDINE_IMPOSTAZIONI,
  clean,
  doc,
  dopoIGenerali,
  esc,
  inserisciInOrdine,
  installStyle,
  onEditorRedraw,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TESTA_FISSA__";
const state = (root[KEY] ||= { installed: false });

const SCHEDA = "visib";
const BLOCCO = "dm-testa-fissa";

/* Resta su questo vetro, come il tema e il chiosco: non viaggia. */
const CASELLA = "dm_testa_fissa";
const ATTRIBUTO = "data-dm-testa-fissa";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/** Se la testa deve restare ferma su questo apparecchio. */
export function testaFissaAttiva() {
  try {
    return root.localStorage?.getItem?.(CASELLA) === "1";
  } catch (_errore) {
    return false;
  }
}

/** L'accende o la spegne, e lo scrive addosso al documento. */
export function setTestaFissa(accesa) {
  const vera = Boolean(accesa);
  try {
    root.localStorage?.setItem?.(CASELLA, vera ? "1" : "0");
  } catch (_errore) {}
  applicaTestaFissa();
  return vera;
}

/**
 * Porta la scelta sul documento.
 *
 * L'attributo sta sulla radice e non sull'intestazione: quella la ridisegna il
 * guscio a ogni giro, e una classe scritta su un nodo che viene rifatto e' una
 * classe che sparisce da sola.
 */
export function applicaTestaFissa() {
  const radice = doc?.documentElement;
  if (!radice) return false;
  if (testaFissaAttiva()) radice.setAttribute(ATTRIBUTO, "true");
  else radice.removeAttribute(ATTRIBUTO);
  return true;
}

function corpoMarkup() {
  const accesa = testaFissaAttiva();
  return `<div class="ed-form dm-testa" id="${BLOCCO}">
    <div class="dm-testa-riga">
      <span class="dm-testa-glifo" aria-hidden="true">📌</span>
      <span class="dm-testa-testo">
        <b>${esc(t("Intestazione fissa", "Pinned header"))}</b>
        <small>${esc(
          t(
            "La parte in alto — hamburger, nome della casa, meteo — resta ferma e il resto della plancia le scorre sotto. Vale solo su questo apparecchio.",
            "The top strip — hamburger, house name, weather — stays put while the rest of the dashboard scrolls under it. This device only.",
          ),
        )}</small>
      </span>
      <button type="button" class="dm-testa-int" role="switch"
        aria-checked="${accesa ? "true" : "false"}"
        aria-label="${esc(t("Intestazione fissa", "Pinned header"))}"
        data-dm-testa-int><i></i></button>
    </div>
  </div>`;
}

/** Ridisegna il blocco se è già a video, senza toccare il resto della scheda. */
function ridipingi() {
  const gia = doc?.getElementById(BLOCCO);
  if (!gia) return false;
  const foglio = doc.createElement("div");
  foglio.innerHTML = corpoMarkup();
  const nuovo = foglio.firstElementChild;
  if (!nuovo) return false;
  nuovo.setAttribute("data-dm-ordine", gia.getAttribute("data-dm-ordine") || "");
  gia.replaceWith(nuovo);
  return true;
}

export function ensureTestaFissa() {
  if (!doc || schedaAttiva() !== SCHEDA) return false;
  const corpo = doc.getElementById("ed-body");
  if (!corpo) return false;
  if (doc.getElementById(BLOCCO)) return true;
  const foglio = doc.createElement("div");
  foglio.innerHTML = corpoMarkup();
  const riga = foglio.firstElementChild;
  if (!riga) return false;
  inserisciInOrdine(corpo, riga, ORDINE_IMPOSTAZIONI.testaFissa, dopoIGenerali);
  return true;
}

function onClick(evento) {
  const interruttore = evento.target?.closest?.("[data-dm-testa-int]");
  if (!interruttore) return;
  evento.preventDefault();
  setTestaFissa(!testaFissaAttiva());
  ridipingi();
}

function installStili() {
  installStyle(
    "dm-testa-fissa-style",
    `
    #${BLOCCO} .dm-testa-riga{
      display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px}
    #${BLOCCO} .dm-testa-glifo{font-size:19px;line-height:1}
    #${BLOCCO} .dm-testa-testo{display:grid;gap:3px;min-width:0}
    #${BLOCCO} .dm-testa-testo b{font-size:13px;font-weight:800}
    #${BLOCCO} .dm-testa-testo small{font-size:11px;line-height:1.35;color:var(--text-dim,#94a3b8)}
    #${BLOCCO} .dm-testa-int{
      position:relative;width:38px;height:22px;flex:0 0 auto;padding:0;cursor:pointer;
      border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);transition:background .18s ease}
    #${BLOCCO} .dm-testa-int[aria-checked="true"]{background:var(--success-color,#10b981)}
    #${BLOCCO} .dm-testa-int i{
      position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;
      background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}
    #${BLOCCO} .dm-testa-int[aria-checked="true"] i{transform:translateX(16px)}
    #${BLOCCO} .dm-testa-int:focus-visible{
      outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 40%,transparent);outline-offset:2px}

    /* La testa ferma.
     *
     * Il fondo e' quello della plancia e non e' trasparente: sotto ci scorre
     * il contenuto, e una striscia trasparente lo lascerebbe passare attraverso
     * le parole. Il margine che l'intestazione ha sempre avuto diventa
     * riempimento in basso, o fra lei e la prima card si aprirebbe una fessura
     * da cui si vede scorrere quello che passa.
     *
     * Sopra i 900 px di altezza e basta: su uno schermo basso — un telefono
     * coricato, una finestra stretta — una testa ferma alta un quinto lascia
     * per il resto una feritoia, e chi l'ha accesa non voleva quello. */
    @media (min-height:560px){
      html[${ATTRIBUTO}="true"] body > header{
        position:sticky;top:0;z-index:30;
        margin-bottom:0;padding-bottom:18px;
        background:var(--bg-sculpted,#f0f4f8)}
      /* L'intestazione ha il suo riquadro dentro di se': il fondo della
         striscia sta dietro, e la card resta quella di prima. */
      html[${ATTRIBUTO}="true"] body > header::before{
        content:"";position:absolute;inset:-14px -14px 0;z-index:-1;
        background:var(--bg-sculpted,#f0f4f8)}
    }
    `,
  );
}

export function installTestaFissa() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStili();
  applicaTestaFissa();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmTestaFissa", () => root.queueMicrotask?.(ensureTestaFissa));
  ensureTestaFissa();
  return true;
}

installTestaFissa();
