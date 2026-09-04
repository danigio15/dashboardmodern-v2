/* «Sostieni il progetto», dentro la configurazione.
 *
 * «Nella dashboard nella sezione config possiamo mettere un tag con link
 * donazioni?» Il progetto e' indipendente e vive di tempo libero: il README
 * lo dice in fondo, con il tasto PayPal, ma chi usa la plancia il README non
 * lo riapre. La configurazione e' il posto dove uno passa quando gli serve
 * qualcosa dal progetto — una casella nuova, una correzione — ed e' dove il
 * grazie ha senso: una pastiglia in fondo alla colonna delle schede, che si
 * vede da ogni scheda, e una card in «Impostazioni» con due righe di perche'.
 *
 * Il collegamento e' UNO, lo stesso del README e di FUNDING.yml, e si apre in
 * una scheda nuova: la plancia vive in un riquadro dentro Home Assistant, e
 * navigare via da li' vorrebbe dire perdere la plancia.
 */
import { clean, doc, esc, installStyle, onEditorRedraw, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SOSTIENI__";
const state = (root[KEY] ||= { installed: false });

/** Il solo canale, quello del README. */
export const LINK_DONAZIONI = "https://www.paypal.com/paypalme/giovannidaniello15";
const SCHEDA_IMPOSTAZIONI = "visib";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function linkMarkup(classe, testo) {
  return `<a class="${classe}" href="${LINK_DONAZIONI}" target="_blank" rel="noopener noreferrer" data-dm-sostieni>${testo}</a>`;
}

/* La pastiglia in fondo alla colonna delle schede: c'e' da ogni scheda. */
export function ensurePastiglia() {
  const linguette = doc?.querySelector?.(".ed-tab")?.parentElement;
  if (!linguette) return false;
  if (linguette.querySelector(".dm-sostieni-pastiglia")) return true;
  const guscio = doc.createElement("div");
  guscio.innerHTML = linkMarkup(
    "dm-sostieni-pastiglia",
    `<span aria-hidden="true">💙</span><span>${esc(t("Sostieni il progetto", "Support the project"))}</span>`,
  );
  const pastiglia = guscio.firstElementChild;
  if (!pastiglia) return false;
  linguette.append(pastiglia);
  return true;
}

/* La card in «Impostazioni»: il perche', in due righe, e il tasto. */
export function ensureCard() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || schedaAttiva() !== SCHEDA_IMPOSTAZIONI) return false;
  if (corpo.querySelector(".dm-sostieni-card")) return true;
  const card = doc.createElement("section");
  card.className = "ed-list dm-sostieni-card";
  card.innerHTML = `<div class="dm-sostieni-testo">
      <strong>💙 ${esc(t("Sostieni il progetto", "Support the project"))}</strong>
      <p>${esc(
        t(
          "DashboardModern è indipendente e open source, fatta nel tempo libero: niente sponsor, niente abbonamenti, niente dati raccolti. Una donazione tiene vive le correzioni, le risposte alle segnalazioni e le prove sui dispositivi veri.",
          "DashboardModern is independent and open source, made in spare time: no sponsors, no subscriptions, no data collected. A donation keeps the fixes, the issue replies and the tests on real devices coming.",
        ),
      )}</p>
    </div>
    ${linkMarkup("dm-sostieni-tasto", `<span aria-hidden="true">💙</span><span>${esc(t("Dona con PayPal", "Donate with PayPal"))}</span>`)}`;
  corpo.append(card);
  return true;
}

function installStyles() {
  installStyle(
    "dm-sostieni-style",
    `
    /* Sta in una colonna larga quanto una linguetta: il testo va a capo e sta
       al centro, invece di uscire dalla pillola. Sul telefono in piedi la
       colonna e' un simbolo solo, e resta solo il cuore. */
    #editor-modal .dm-sostieni-pastiglia{
      display:flex;align-items:center;justify-content:center;gap:6px;margin:10px 4px 8px;padding:8px 10px;
      border-radius:14px;min-width:0;font-size:11px;font-weight:900;letter-spacing:.02em;line-height:1.2;
      text-align:center;text-decoration:none;color:#fff;background:linear-gradient(135deg,#0070ba,#003087);
      box-shadow:0 6px 16px rgba(0,48,135,.28);flex:0 0 auto;white-space:normal;overflow-wrap:anywhere}
    #editor-modal .dm-sostieni-pastiglia:hover{filter:brightness(1.06)}
    #editor-modal .dm-sostieni-pastiglia span[aria-hidden]{font-size:13px;flex:0 0 auto}
    @media (orientation: portrait) and (max-width: 640px){
      #editor-modal .dm-sostieni-pastiglia{padding:9px 0;margin:8px 2px;gap:0}
      #editor-modal .dm-sostieni-pastiglia span:not([aria-hidden]){display:none}
    }
    #ed-body .dm-sostieni-card{
      display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;
      margin:18px 0 6px;padding:14px 16px;border-radius:18px;
      border:1px solid rgba(0,112,186,.25);background:linear-gradient(135deg,rgba(0,112,186,.08),rgba(0,48,135,.04))}
    #ed-body .dm-sostieni-testo{flex:1 1 260px;min-width:0}
    #ed-body .dm-sostieni-testo strong{display:block;font-size:13px;font-weight:900;color:var(--text,#0f172a);margin-bottom:4px}
    #ed-body .dm-sostieni-testo p{margin:0;font-size:12px;line-height:1.5;color:var(--text-dim,#64748b)}
    #ed-body .dm-sostieni-tasto{
      display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;text-decoration:none;
      font-size:12.5px;font-weight:900;color:#fff;background:linear-gradient(135deg,#0070ba,#003087);
      box-shadow:0 8px 20px rgba(0,48,135,.28);flex:0 0 auto}
    #ed-body .dm-sostieni-tasto:hover{filter:brightness(1.06)}
    `,
  );
}

export function installSostieniIlProgetto() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  const metti = () => {
    ensurePastiglia();
    ensureCard();
  };
  wrapFunction("apriConfigEntita", "__dmSostieni", metti);
  onEditorRedraw("__dmSostieni", () => root.queueMicrotask?.(metti));
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(metti));
  metti();
  return true;
}

installSostieniIlProgetto();
