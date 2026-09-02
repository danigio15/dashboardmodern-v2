/* Le pagine delle sezioni che si fa l'utente (#262).
 *
 * «Una sezione chiamata Custom che permette di creare N sezioni con un titolo
 * e posizionarvi delle entità.»
 *
 * Non una sola sezione «Custom» che le contiene tutte, ma una voce nella barra
 * per ognuna, col titolo e l'icona che le ha dato chi l'ha fatta: e' quello
 * che l'esempio della segnalazione chiede — «avrei potuto inserire le entita'
 * dell'UPS» — e la Continuita', quando e' arrivata, si e' presa la sua voce
 * come tutte le altre.
 *
 * La pagina e' onesta su quello che sa: mette le righe in fila, dice come
 * stanno, e mette l'interruttore solo dove c'e' qualcosa da accendere. Un
 * sensore si legge; una luce si tocca. Non prova a indovinare un disegno per
 * entita' che non conosce — quello e' il lavoro delle sezioni disegnate, e
 * fingerlo qui vorrebbe dire promettere un grafico della carica a chi ha
 * incollato un sensore di umidita'.
 *
 * Le voci nella barra le crea questo modulo, quindi e' questo modulo a
 * spegnerle: legge `cd_sections` con la stessa chiave che scrive la fascia
 * verde della configurazione, come fanno l'Agenda e la Continuita'.
 */
import {
  chiaveDellaSezione,
  contoDellaSezione,
  lettureDellaSezione,
  sezioniDaMostrare,
} from "../core/sezioni-mie.js";
import { registraPaginaARuntime } from "./page-masthead-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  readJson,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SEZIONI_MIE__";
const state = (root[KEY] ||= { installed: false, frame: 0, firme: new Map() });

export const CHIAVE_SEZIONI_MIE = "cd_sezioni_mie";
/* La chiave con cui si spegne l'intera funzione: le singole sezioni hanno il
 * loro «mostra nella barra» dentro la riga, che e' una proprieta' della
 * sezione e non una preferenza di visibilita' del guscio. */
export const SEZIONI_MIE_TAB = "mie";
const PAGINA = (id) => `page-${chiaveDellaSezione(id)}`;

/* Le tinte dell'intestazione, a giro. Due sezioni proprie una dopo l'altra si
 * distinguono anche prima di leggerne il titolo, che e' il lavoro che fa il
 * colore su tutte le altre pagine. */
const TINTE = Object.freeze([
  ["245,158,11", "239,68,68"],
  ["99,102,241", "14,165,233"],
  ["16,185,129", "14,165,233"],
  ["236,72,153", "168,85,247"],
]);

function configurazione() {
  return readJson(CHIAVE_SEZIONI_MIE, []);
}

/** Le sezioni con qualcosa da mostrare: senza, niente voce e niente pagina. */
export function sezioniMie() {
  return sezioniDaMostrare(configurazione());
}

/* Come per l'Agenda e la Continuita': `cdApplyNavVis` del guscio TOGLIE la
 * riga di stile alle voci che conosce, e insegnargli anche le nostre vorrebbe
 * dire lui che la cancella ogni tre secondi e noi che la riscriviamo al giro
 * dopo. Queste voci le abbiamo create noi e le governiamo noi, leggendo la
 * stessa configurazione che legge lui. */
function funzioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[SEZIONI_MIE_TAB] === false);
}

/* ── la voce nella barra e la pagina ──────────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

function ensurePagina(sezione) {
  if (!doc) return null;
  const id = PAGINA(sezione.id);
  let pagina = doc.getElementById(id);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = id;
  pagina.innerHTML = `<div class="dm-mia-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

function apri(sezione, voce) {
  for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
  voce.classList.add("active");
  ensurePagina(sezione)?.classList.add("active");
  const testata = doc.querySelector("header");
  if (testata) testata.style.display = "none";
  root.scrollTo?.({ top: 0, behavior: "instant" });
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  schedule();
}

function ensureVoce(sezione) {
  if (!doc) return null;
  const chiave = chiaveDellaSezione(sezione.id);
  let voce = doc.querySelector(`.tab[data-tab="${chiave}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = chiave;
  voce.dataset.dmMia = sezione.id;
  voce.id = `tab-${chiave}`;
  /* Il gestore che il guscio lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo e il suo tocco se lo gestisce da se'. */
  voce.addEventListener("click", () => apri(sezione, voce));
  barra.append(voce);
  return voce;
}

function scriviLaVoce(voce, sezione) {
  const titolo = sezione.titolo || t("Senza titolo", "Untitled");
  const atteso = `${sezione.icona} ${titolo}`;
  if (voce.dataset.dmMiaFirma === atteso) return;
  voce.dataset.dmMiaFirma = atteso;
  voce.innerHTML =
    `<span class="icon">${esc(sezione.icona)}</span>` +
    `<span class="text">${esc(titolo)}</span>`;
}

/* Le voci e le pagine di sezioni che non esistono piu' se ne vanno: una
 * sezione cancellata che lascia la sua voce nella barra e' una voce che porta
 * a una pagina vuota, ed e' il modo in cui una funzione sembra rotta. */
function toglieteLeVecchie(vive) {
  if (!doc) return;
  for (const voce of doc.querySelectorAll(".tab[data-dm-mia]")) {
    if (vive.has(clean(voce.dataset.dmMia))) continue;
    if (voce.classList.contains("active")) doc.querySelector('.tab[data-tab="home"]')?.click();
    voce.remove();
  }
  for (const pagina of doc.querySelectorAll(".page[data-dm-mia]")) {
    if (vive.has(clean(pagina.dataset.dmMia))) continue;
    registraPaginaARuntime(pagina.id, null);
    pagina.remove();
  }
}

/* ── il disegno ───────────────────────────────────────────────────────── */

/* Le parole di stato piu' comuni, dette qui e non nel nucleo: il raccoglitore
 * delle traduzioni guarda le sezioni, e una `t()` scritta dentro `src/core`
 * non finirebbe nei cataloghi. Quelle che non stanno in questa tabella si
 * mostrano come Home Assistant le manda — meglio una parola inglese vera che
 * un trattino al posto di un'informazione che c'e'. */
function parolaDiStato(grezzo) {
  const tabella = {
    on: t("Acceso", "On"),
    off: t("Spento", "Off"),
    open: t("Aperto", "Open"),
    closed: t("Chiuso", "Closed"),
    home: t("In casa", "Home"),
    not_home: t("Fuori", "Away"),
    idle: t("Fermo", "Idle"),
    playing: t("In riproduzione", "Playing"),
    paused: t("In pausa", "Paused"),
    docked: t("Alla base", "Docked"),
    cleaning: t("Al lavoro", "Cleaning"),
    charging: t("In carica", "Charging"),
    heat: t("Riscalda", "Heating"),
    cool: t("Raffresca", "Cooling"),
    locked: t("Chiuso a chiave", "Locked"),
    unlocked: t("Aperto", "Unlocked"),
  };
  return tabella[clean(grezzo).toLowerCase()] || clean(grezzo);
}

function valoreMarkup(riga) {
  if (riga.muto) return `<b class="dm-mia-muta">${esc(t("Non risponde", "Not reporting"))}</b>`;
  if (riga.numero !== null)
    return (
      `<b>${esc(formatNumber(riga.numero, Number.isInteger(riga.numero) ? 0 : 1))}` +
      `${riga.unita ? `<small> ${esc(riga.unita)}</small>` : ""}</b>`
    );
  return `<b>${esc(parolaDiStato(riga.stato))}</b>`;
}

function rigaMarkup(riga) {
  const icona = riga.icona || (riga.comandabile ? "💡" : "📈");
  return `<article class="dm-mia-riga" data-on="${riga.acceso}" data-muta="${riga.muto}">
    <span class="dm-mia-ic" aria-hidden="true">${esc(icona)}</span>
    <span class="dm-mia-nome">
      <strong>${esc(riga.nome)}</strong>
      <small class="mono">${esc(riga.entity)}</small>
    </span>
    <span class="dm-mia-val">${valoreMarkup(riga)}</span>
    ${
      riga.comandabile && !riga.muto
        ? `<button type="button" class="dm-mia-lev" data-dm-mia-tocca="${esc(riga.entity)}"
             role="switch" aria-checked="${riga.acceso}"
             aria-label="${esc(riga.nome)}"><i></i></button>`
        : `<span class="dm-mia-vuoto" aria-hidden="true"></span>`
    }
  </article>`;
}

/* Il sottotitolo dell'intestazione: quante rispondono e quante sono accese.
 * Il titolo e' quello che ha scritto l'utente, e non si traduce — sono parole
 * sue, non nostre. */
function sottotitolo(letture) {
  const conto = contoDellaSezione(letture);
  const vive = conto.vive
    ? `${conto.accese} ${t("accese su", "on out of")} ${conto.vive}`
    : t("Nessuna risponde", "None reporting");
  return conto.mute ? `${vive} · ${conto.mute} ${t("mute", "silent")}` : vive;
}

/* L'intestazione la disegna chi disegna tutte le altre: e' lo stesso pezzo di
 * pagina, e averne una nostra vorrebbe dire due padroni per quei pixel — e una
 * sezione dell'utente che si vede diversa da quelle di serie. */
function annunciaLaPagina(sezione, indice, letture) {
  const titolo = sezione.titolo || t("Senza titolo", "Untitled");
  const sotto = sottotitolo(letture);
  registraPaginaARuntime(PAGINA(sezione.id), {
    tint: TINTE[indice % TINTE.length],
    it: [titolo, sotto],
    en: [titolo, sotto],
  });
}

function paginaMarkup(letture) {
  return `<div class="dm-mia-lista">${letture.map(rigaMarkup).join("")}</div>`;
}

function dipingi() {
  if (!doc) return;
  const accesa = funzioneAccesa();
  const sezioni = accesa ? sezioniMie() : [];
  const vive = new Set(sezioni.map((sezione) => sezione.id));
  toglieteLeVecchie(vive);
  for (const [id] of state.firme) if (!vive.has(id)) state.firme.delete(id);

  const states = allStates();
  const resolve = root.resolveEntity || ((valore) => valore);
  for (const [indice, sezione] of sezioni.entries()) {
    const voce = ensureVoce(sezione);
    if (voce) scriviLaVoce(voce, sezione);
    const pagina = ensurePagina(sezione);
    if (!pagina) continue;
    pagina.dataset.dmMia = sezione.id;
    const dove = pagina.querySelector(".dm-mia-wrap");
    if (!dove) continue;
    const letture = lettureDellaSezione(sezione, states, resolve);
    annunciaLaPagina(sezione, indice, letture);
    /* Si ridisegna solo quando qualcosa e' cambiato davvero: la pagina la
     * ripassa il guscio a ogni giro, e rifare il documento sotto le dita di
     * chi sta toccando un interruttore glielo fa mancare. */
    const firma = JSON.stringify([sezione.titolo, sezione.icona, letture]);
    if (state.firme.get(sezione.id) === firma) continue;
    state.firme.set(sezione.id, firma);
    dove.innerHTML = paginaMarkup(letture);
  }
}

/* ── il tocco ─────────────────────────────────────────────────────────── */

async function chiamaHa(dominio, servizio, payload) {
  try {
    if (typeof root.dmCallHaService === "function")
      return await root.dmCallHaService(dominio, servizio, payload);
    if (typeof root.callService === "function")
      return await root.callService(dominio, servizio, payload);
    return await (root.hass || root._hass)?.callService?.(dominio, servizio, payload);
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] sezioni mie", errore);
    return undefined;
  }
}

function onClick(event) {
  const leva = event.target?.closest?.("[data-dm-mia-tocca]");
  if (!leva) return;
  event.preventDefault();
  const entity = clean(leva.dataset.dmMiaTocca);
  const dominio = entity.split(".")[0];
  if (!dominio) return;
  if (root.navigator?.vibrate) root.navigator.vibrate(8);
  /* `scene` e `script` non si spengono: si fanno partire. Chiamare `toggle`
   * su una scena non fa niente, ed e' un tocco che sembra rotto. */
  const servizio = dominio === "scene" || dominio === "script" ? "turn_on" : "toggle";
  chiamaHa(dominio, servizio, { entity_id: entity });
}

/* ── il giro ──────────────────────────────────────────────────────────── */

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        dipingi();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] sezioni mie", errore);
      }
    }) || 0;
}

export function ridisegnaSezioniMie() {
  state.firme.clear();
  schedule();
}

function installStyles() {
  installStyle(
    "dm-sezioni-mie",
    `
      .page[id^="page-mia-"] .dm-mia-wrap{display:grid;gap:16px;padding:0 0 24px}
      .dm-mia-lista{display:grid;gap:10px}
      .dm-mia-riga{
        display:grid;grid-template-columns:44px minmax(0,1fr) auto 52px;align-items:center;gap:12px;
        padding:12px 14px;border-radius:18px;
        background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0);
        box-shadow:0 10px 24px -20px rgba(15,23,42,.5)}
      .dm-mia-riga[data-muta="true"]{opacity:.55}
      .dm-mia-ic{
        display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:19px;
        background:var(--bg-sculpted,#f0f4f8)}
      .dm-mia-riga[data-on="true"] .dm-mia-ic{
        background:color-mix(in srgb,#f97316 16%,transparent)}
      .dm-mia-nome{display:grid;min-width:0}
      .dm-mia-nome strong{
        font-size:14px;font-weight:800;color:var(--text,#0f172a);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-mia-nome small{
        font-size:10.5px;color:var(--text-dim,#64748b);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dm-mia-val b{font-size:17px;font-weight:900;color:var(--text,#0f172a);white-space:nowrap}
      .dm-mia-val b small{font-size:11px;font-weight:800;color:var(--text-dim,#64748b)}
      .dm-mia-val .dm-mia-muta{font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
      .dm-mia-riga[data-on="true"] .dm-mia-val b{color:#ea580c}
      .dm-mia-lev{
        position:relative;width:46px;height:26px;border:0;border-radius:999px;cursor:pointer;
        background:var(--bg-sculpted,#cbd5e1);transition:background .25s ease}
      .dm-mia-lev i{
        position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;
        box-shadow:0 2px 6px rgba(15,23,42,.25);transition:transform .25s cubic-bezier(.16,1,.3,1)}
      .dm-mia-riga[data-on="true"] .dm-mia-lev{background:linear-gradient(135deg,#fb923c,#ea580c)}
      .dm-mia-riga[data-on="true"] .dm-mia-lev i{transform:translateX(20px)}
      @media(max-width:560px){
        .dm-mia-riga{grid-template-columns:38px minmax(0,1fr) auto 46px;gap:9px;padding:10px 11px}
        .dm-mia-ic{width:38px;height:38px;font-size:17px}
      }
    `,
  );
}

export function installSezioniMie() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  /* Il guscio ridisegna la Home a ogni giro e riapplica la visibilita' delle
   * voci ogni tre secondi: ci si aggancia li' invece di tenere un timer. */
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmSezioniMie) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    Object.assign(avvolta, precedente);
    avvolta.__dmSezioniMie = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:legacy-ready",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
  return true;
}
