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

/* La porta: un tasto che apre la finestra, non il collegamento nudo. «Non
 * rimandare direttamente a PayPal: mostra una pagina che spiega il progetto e
 * poi un pulsante». Chi tocca «Sostieni» prima legge, poi decide. */
function portaMarkup(classe, testo) {
  return `<button type="button" class="${classe}" data-dm-sostieni-apri>${testo}</button>`;
}

/* ─── La finestra che racconta ──────────────────────────────────────────── */

const FINESTRA_ID = "dm-sostieni-modal";

const TESTO_DEL_PERCHE = () =>
  t(
    "DashboardModern è indipendente e open source, fatta nel tempo libero: niente sponsor, niente abbonamenti, niente dati raccolti. Una donazione tiene vive le correzioni, le risposte alle segnalazioni e le prove sui dispositivi veri.",
    "DashboardModern is independent and open source, made in spare time: no sponsors, no subscriptions, no data collected. A donation keeps the fixes, the issue replies and the tests on real devices coming.",
  );

function finestra() {
  let modale = doc?.getElementById?.(FINESTRA_ID);
  if (modale) return modale;
  if (!doc?.body) return null;
  modale = doc.createElement("div");
  modale.className = "modal-wrapper";
  modale.id = FINESTRA_ID;
  modale.innerHTML = `
    <div class="modal-card dm-sostieni-pannello" role="dialog" aria-modal="true" aria-labelledby="dm-sostieni-titolo">
      <div class="cfg-hero dm-sostieni-hero">
        <div class="cfg-hero-ico" aria-hidden="true">💙</div>
        <div class="cfg-hero-txt">
          <div class="cfg-hero-title" id="dm-sostieni-titolo">${esc(t("Sostieni il progetto", "Support the project"))}</div>
          <div class="cfg-hero-sub">${esc(t("Perché, e come", "Why, and how"))}</div>
        </div>
        <button class="ev-waw-close" type="button" data-dm-sostieni-chiudi>${esc(t("Chiudi", "Close"))}</button>
      </div>
      <div class="dm-sostieni-corpo">
        <p>${esc(TESTO_DEL_PERCHE())}</p>
        <p>${esc(
          t(
            "Ogni versione porta sezioni nuove, correzioni viste sul campo e prove su telefoni, tablet e schermi a muro. Il tempo per farlo è quello che le donazioni aiutano a tenere libero.",
            "Every release brings new sections, fixes seen in the field and tests on phones, tablets and wall screens. The time to do it is what donations help keep free.",
          ),
        )}</p>
        <p>${esc(
          t(
            "Una donazione è libera nell'importo e non sblocca niente: la plancia resta la stessa per tutti. È un grazie, e un modo di dire «continua».",
            "A donation is any amount you like and unlocks nothing: the dashboard stays the same for everyone. It is a thank-you, and a way of saying «keep going».",
          ),
        )}</p>
        <div class="dm-sostieni-azioni">
          ${linkMarkup("dm-sostieni-tasto", `<span aria-hidden="true">💙</span><span>${esc(t("Dona con PayPal", "Donate with PayPal"))}</span>`)}
          <small>${esc(t("Il pagamento avviene su PayPal, in una scheda nuova.", "Payment happens on PayPal, in a new tab."))}</small>
        </div>
      </div>
    </div>`;
  modale.addEventListener("click", (event) => {
    if (event.target === modale || event.target.closest("[data-dm-sostieni-chiudi]")) chiudi();
  });
  doc.body.append(modale);
  return modale;
}

export function apri() {
  const modale = finestra();
  if (!modale) return false;
  modale.classList.add("show");
  return true;
}

export function chiudi() {
  doc?.getElementById?.(FINESTRA_ID)?.classList.remove("show");
}

/* La pastiglia in fondo alla colonna delle schede: c'e' da ogni scheda. */
export function ensurePastiglia() {
  const linguette = doc?.querySelector?.(".ed-tab")?.parentElement;
  if (!linguette) return false;
  if (linguette.querySelector(".dm-sostieni-pastiglia")) return true;
  const guscio = doc.createElement("div");
  guscio.innerHTML = portaMarkup(
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
      <p>${esc(TESTO_DEL_PERCHE())}</p>
    </div>
    ${portaMarkup("dm-sostieni-tasto", `<span aria-hidden="true">💙</span><span>${esc(t("Scopri come", "Find out how"))}</span>`)}`;
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
    #editor-modal .dm-sostieni-pastiglia,#ed-body .dm-sostieni-tasto{border:0;cursor:pointer;font:inherit}
    #dm-sostieni-modal .dm-sostieni-pannello{max-width:560px}
    #dm-sostieni-modal .dm-sostieni-corpo{padding:18px 22px 22px}
    #dm-sostieni-modal .dm-sostieni-corpo p{margin:0 0 12px;font-size:13.5px;line-height:1.6;color:var(--text,#0f172a)}
    #dm-sostieni-modal .dm-sostieni-azioni{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:16px}
    #dm-sostieni-modal .dm-sostieni-azioni small{font-size:11px;color:var(--text-dim,#64748b)}
    #dm-sostieni-modal .dm-sostieni-tasto{
      display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:999px;text-decoration:none;
      font-size:13.5px;font-weight:900;color:#fff;background:linear-gradient(135deg,#0070ba,#003087);
      box-shadow:0 8px 20px rgba(0,48,135,.28)}
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
  /* La porta si apre da qualunque tasto porti il suo segno: la pastiglia
   * nella colonna e il tasto nella card di Impostazioni. */
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-dm-sostieni-apri]")) {
      event.preventDefault();
      apri();
    }
  });
  metti();
  root.DashboardModernSostieni = Object.freeze({ apri, chiudi });
  return true;
}

installSostieniIlProgetto();
