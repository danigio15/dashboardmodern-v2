/* «Sostieni il progetto», nella pagina Configurazione.
 *
 * «Nella dashboard nella sezione config possiamo mettere un tag con link
 * donazioni?» Il progetto e' indipendente e vive di tempo libero: il README
 * lo dice in fondo, con il tasto PayPal, ma chi usa la plancia il README non
 * lo riapre.
 *
 * Stava dentro l'editor delle entita': una pastiglia in fondo alla colonna
 * delle linguette e una card nella scheda Impostazioni. Ma li' ci si va per
 * lavorare — si apre, si configura, si chiude — e un grazie in mezzo alle
 * caselle e' fuori posto. «Mi sposti il pulsante donazioni qua sotto ad
 * assistenza invece che dentro configurazione»: adesso e' una tessera della
 * pagina Configurazione, l'ultima, sotto Segnalazioni e Assistenza — le due
 * porte che parlano col progetto, non con la casa. Una sola, dove le altre.
 *
 * Il collegamento e' UNO, lo stesso del README e di FUNDING.yml, e si apre in
 * una scheda nuova: la plancia vive in un riquadro dentro Home Assistant, e
 * navigare via da li' vorrebbe dire perdere la plancia.
 */
import { doc, esc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SOSTIENI__";
const state = (root[KEY] ||= { installed: false });

/** Il solo canale, quello del README. */
export const LINK_DONAZIONI = "https://www.paypal.com/paypalme/giovannidaniello15";
function linkMarkup(classe, testo) {
  return `<a class="${classe}" href="${LINK_DONAZIONI}" target="_blank" rel="noopener noreferrer" data-dm-sostieni>${testo}</a>`;
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

/* La tessera della pagina Configurazione, dove stanno le altre.
 *
 * Stessa veste di Segnalazioni e Assistenza — icona, nome, una riga di
 * spiegazione, la freccina — perche' fa la stessa cosa: apre una finestra.
 * Chi disegna quelle due tessere le aggiunge in coda alla griglia quando
 * arriva; questa si rimette in fondo a ogni giro, cosi' resta l'ultima anche
 * se una delle altre nasce dopo di lei. */
const TESSERA_ID = "dm-sostieni-card";

function tesseraMarkup() {
  return `<div class="cfg-card-ico" style="--cc-rgb: 59,130,246;">💙</div>
    <div class="cfg-card-txt">
      <div class="cfg-card-nm">${esc(t("Sostieni il progetto", "Support the project"))}</div>
      <div class="cfg-card-ds">${esc(
        t(
          "La plancia è indipendente e senza abbonamenti: qui c'è come darle una mano",
          "The dashboard is independent and subscription-free: here is how to give it a hand",
        ),
      )}</div>
    </div>
    <div class="cfg-card-arrow">›</div>`;
}

export function ensureTessera() {
  const griglia = doc?.querySelector?.("#page-config .cfg-grid");
  if (!griglia) return false;
  let tessera = doc.getElementById(TESSERA_ID);
  if (!tessera) {
    tessera = doc.createElement("div");
    tessera.className = "cfg-card dm-sostieni-tessera";
    tessera.id = TESSERA_ID;
    tessera.dataset.dmSostieniApri = "true";
  }
  // In fondo, sempre: le altre tessere si aggiungono in coda quando arrivano.
  if (griglia.lastElementChild !== tessera) griglia.append(tessera);
  const disegno = tesseraMarkup();
  if (tessera.innerHTML !== disegno) tessera.innerHTML = disegno;
  return true;
}

function installStyles() {
  installStyle(
    "dm-sostieni-style",
    `
    /* La tessera la veste il guscio, come Segnalazioni e Assistenza: qui resta
       solo la finestra che si apre toccandola. */
    #dm-sostieni-modal .dm-sostieni-pannello{max-width:560px}
    #dm-sostieni-modal .dm-sostieni-corpo{padding:18px 22px 22px}
    #dm-sostieni-modal .dm-sostieni-corpo p{margin:0 0 12px;font-size:13.5px;line-height:1.6;color:var(--text,#0f172a)}
    #dm-sostieni-modal .dm-sostieni-azioni{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:16px}
    #dm-sostieni-modal .dm-sostieni-azioni small{font-size:11px;color:var(--text-dim,#64748b)}
    #dm-sostieni-modal .dm-sostieni-tasto{
      display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:999px;text-decoration:none;
      font-size:13.5px;font-weight:900;color:#fff;background:linear-gradient(135deg,#0070ba,#003087);
      box-shadow:0 8px 20px rgba(0,48,135,.28)}
    `,
  );
}

export function installSostieniIlProgetto() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* La pagina Configurazione c'e' dall'inizio nel documento, ma la griglia la
   * riempie il runtime: si riprova quando arriva, e quando la si apre. */
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureTessera));
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.('[data-tab="config"]')) root.setTimeout?.(ensureTessera, 0);
  });
  /* La porta si apre da qualunque cosa porti il suo segno: la tessera, e i
   * tasti dentro la finestra. */
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-dm-sostieni-apri]")) {
      event.preventDefault();
      apri();
    }
  });
  ensureTessera();
  root.DashboardModernSostieni = Object.freeze({ apri, chiudi });
  return true;
}

installSostieniIlProgetto();
