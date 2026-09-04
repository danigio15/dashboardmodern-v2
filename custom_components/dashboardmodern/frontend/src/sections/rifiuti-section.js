/* La pagina della raccolta differenziata (#293).
 *
 * «Sarebbe carino anche integrare un sistema per la raccolta differenziata
 * rifiuti.»
 *
 * La pagina risponde alla domanda della sera — cosa metto fuori stasera? — e
 * lo fa in cima, grande: il prossimo ritiro col suo materiale e la sua parola
 * («Domani», «Oggi», «Giovedì»). Sotto, un bidone per materiale, col colore
 * che ha davvero in strada e la data del suo ritiro. Le date le legge il
 * modello in `core/rifiuti-model.js`, nei dialetti delle integrazioni.
 *
 * La voce nella barra compare solo quando qualcosa e' configurato. Qui non si
 * scrive niente in Home Assistant: si legge e si disegna.
 */
import {
  CHIAVE_RIFIUTI,
  letturaRifiuti,
  materialeDiSerie,
  rifiutiConfigurati,
} from "../core/rifiuti-model.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  locale,
  readJson,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_RIFIUTI__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const RIFIUTI_PAGE_ID = "page-rifiuti";
export const RIFIUTI_TAB = "rifiuti";

/* ── cosa c'e' da guardare ────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_RIFIUTI, {});
}

export function rifiutiInPlancia() {
  return rifiutiConfigurati(configurazione());
}

export function letturaDeiRifiuti(adesso = Date.now()) {
  return letturaRifiuti(configurazione(), allStates(), root.resolveEntity || ((value) => value), adesso);
}

/* ── le parole ────────────────────────────────────────────────────────── */

/** Il nome di un materiale, nella lingua di chi guarda. */
export function nomeDelMateriale(chiave) {
  const voci = {
    plastica: t("Plastica", "Plastic"),
    carta: t("Carta e cartone", "Paper and cardboard"),
    vetro: t("Vetro", "Glass"),
    organico: t("Organico", "Organic waste"),
    indifferenziato: t("Indifferenziato", "General waste"),
    metalli: t("Metalli e lattine", "Metal and cans"),
    verde: t("Verde e sfalci", "Garden waste"),
    ingombranti: t("Ingombranti", "Bulky items"),
    oli: t("Oli esausti", "Used oil"),
    pannolini: t("Pannolini", "Nappies"),
    altro: t("Altro", "Other"),
  };
  return voci[clean(chiave)] || voci.altro;
}

/** Come si chiama una riga: il nome scritto, o quello del suo materiale. */
export function nomeDellaRiga(riga) {
  return clean(riga?.nome) || nomeDelMateriale(riga?.materiale);
}

/** La parola di «fra quanto», dalla riga letta. */
export function parolaDelQuando(riga) {
  switch (riga?.quando) {
    case "oggi":
      return t("Oggi", "Today");
    case "domani":
      return t("Domani", "Tomorrow");
    case "dopodomani":
      return t("Dopodomani", "Day after tomorrow");
    case "giorni":
      return t(`Fra ${riga.giorni} giorni`, `In ${riga.giorni} days`);
    case "settimana":
      return giornoDellaData(riga.data);
    case "passato":
      return t("Passato", "Past");
    default:
      return riga?.muto
        ? t("Il sensore non risponde", "The sensor is not answering")
        : t("Data non trovata", "Date not found");
  }
}

function giornoDellaData(data) {
  if (!(data instanceof Date) || !Number.isFinite(data.getTime())) return "";
  try {
    return data.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "short" });
  } catch (_error) {
    return data.toDateString();
  }
}

/** La data scritta per esteso sotto la parola. */
export function dataScritta(riga) {
  if (!(riga?.data instanceof Date) || !Number.isFinite(riga.data.getTime())) return "";
  if (riga.quando === "settimana") {
    try {
      return riga.data.toLocaleDateString(locale(), { day: "numeric", month: "long" });
    } catch (_error) {
      return "";
    }
  }
  return giornoDellaData(riga.data);
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureRifiutiPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(RIFIUTI_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = RIFIUTI_PAGE_ID;
  pagina.innerHTML = `<div class="dm-rifiuti-wrap" id="rifiuti-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureRifiutiTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${RIFIUTI_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto all'Agenda: un ritiro e' un impegno con una data, e chi lo cerca
   * lo cerca dove stanno le date. */
  const dopo =
    barra.querySelector('.tab[data-tab="calendario"]') || barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = RIFIUTI_TAB;
  voce.id = `tab-${RIFIUTI_TAB}`;
  voce.innerHTML = `<span class="icon">♻️</span><span class="text">${esc(t("Rifiuti", "Waste"))}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureRifiutiPage()?.classList.add("active");
    const testata = doc.querySelector("header");
    if (testata) testata.style.display = "none";
    root.scrollTo?.({ top: 0, behavior: "instant" });
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

/* La voce si governa da se', come la Continuita' e le Allerte. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[RIFIUTI_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureRifiutiTab();
  if (!voce) return;
  const serve = rifiutiInPlancia() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(RIFIUTI_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function bidoneMarkup(riga, grande = false) {
  const materiale = materialeDiSerie(riga.materiale);
  return `<span class="dm-rifiuti-bidone${grande ? " grande" : ""}" style="--dm-bidone:${esc(riga.colore || materiale.colore)}">
    <span class="dm-rifiuti-bidone-ic" aria-hidden="true">${esc(riga.icona || materiale.icona)}</span>
    <span class="dm-rifiuti-bidone-nome">${esc(nomeDellaRiga(riga))}</span>
  </span>`;
}

function prossimoMarkup(lettura) {
  const prossimi = lettura.prossimi.length
    ? lettura.prossimi
    : lettura.calendario && lettura.calendario.giorni !== null && lettura.calendario.giorni >= 0
      ? [{ ...lettura.calendario, nome: lettura.calendario.nome }]
      : [];
  if (!prossimi.length)
    return `<div class="dm-rifiuti-prossimo" data-quando="mai">
      <small>${esc(t("Prossimo ritiro", "Next collection"))}</small>
      <strong>${esc(t("Nessuna data in vista", "No date in sight"))}</strong>
    </div>`;
  const primo = prossimi[0];
  return `<div class="dm-rifiuti-prossimo" data-quando="${esc(primo.quando)}">
    <small>${esc(t("Prossimo ritiro", "Next collection"))}</small>
    <strong>${esc(parolaDelQuando(primo))}</strong>
    <span class="dm-rifiuti-prossimo-data">${esc(dataScritta(primo))}</span>
    <div class="dm-rifiuti-prossimo-bidoni">${prossimi.map((riga) => bidoneMarkup(riga, true)).join("")}</div>
  </div>`;
}

function rigaMarkup(riga) {
  const materiale = materialeDiSerie(riga.materiale);
  return `<article class="dm-rifiuti-riga" data-quando="${esc(riga.quando)}" style="--dm-bidone:${esc(riga.colore || materiale.colore)}">
    <span class="dm-rifiuti-riga-ic" aria-hidden="true">${esc(riga.icona || materiale.icona)}</span>
    <div class="dm-rifiuti-riga-testo">
      <strong>${esc(nomeDellaRiga(riga))}</strong>
      <small>${esc(dataScritta(riga) || "")}</small>
    </div>
    <b class="dm-rifiuti-riga-quando">${esc(parolaDelQuando(riga))}</b>
  </article>`;
}

function calendarioMarkup(calendario) {
  if (!calendario) return "";
  return `<article class="dm-rifiuti-riga dm-rifiuti-calendario" data-quando="${esc(calendario.quando)}" style="--dm-bidone:${esc(calendario.colore)}">
    <span class="dm-rifiuti-riga-ic" aria-hidden="true">📅</span>
    <div class="dm-rifiuti-riga-testo">
      <strong>${esc(calendario.nome || t("Calendario dei ritiri", "Collection calendar"))}</strong>
      <small>${esc(dataScritta(calendario) || "")}</small>
    </div>
    <b class="dm-rifiuti-riga-quando">${esc(parolaDelQuando(calendario))}</b>
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-rifiuti-vuoto">
    <strong>${esc(t("Nessun ritiro configurato", "No collection configured"))}</strong>
    <span>${esc(
      t(
        "Aggiungi i materiali dalla scheda Rifiuti della configurazione: per ognuno il sensore o il calendario che dice quando passa il ritiro.",
        "Add the materials from the Waste tab in the settings: for each one the sensor or calendar that says when the collection comes.",
      ),
    )}</span>
  </div>`;
}

function dipingi() {
  const pagina = ensureRifiutiPage();
  const dove = pagina?.querySelector?.("#rifiuti-wrap");
  if (!dove) return;
  if (!rifiutiInPlancia()) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      dove.innerHTML = vuotoMarkup();
    }
    return;
  }
  const lettura = letturaDeiRifiuti();
  const firma = JSON.stringify([lettura, locale()]);
  if (state.firma === firma && dove.firstElementChild) return;
  state.firma = firma;
  dove.innerHTML = `${prossimoMarkup(lettura)}
    <div class="dm-rifiuti-elenco">${lettura.righe.map(rigaMarkup).join("")}${calendarioMarkup(lettura.calendario)}</div>`;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] rifiuti", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderRifiuti() {
  state.firma = "";
  schedule();
}

function installStyles() {
  const P = `#${RIFIUTI_PAGE_ID}`;
  installStyle(
    "dm-rifiuti-section-style",
    `
    ${P} .dm-rifiuti-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-rifiuti-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-rifiuti-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-rifiuti-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* Il prossimo ritiro: la risposta grande alla domanda della sera. */
    ${P} .dm-rifiuti-prossimo{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-rifiuti-prossimo small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-rifiuti-prossimo strong{font-size:30px;font-weight:900;line-height:1.05;color:var(--text,#0f172a)}
    ${P} .dm-rifiuti-prossimo[data-quando="oggi"] strong{color:#dc2626}
    ${P} .dm-rifiuti-prossimo[data-quando="domani"] strong{color:#d97706}
    ${P} .dm-rifiuti-prossimo-data{font-size:13px;font-weight:700;color:var(--text-dim,#64748b);text-transform:capitalize}
    ${P} .dm-rifiuti-prossimo-bidoni{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}

    /* Il bidone: una pillola col colore del bidone vero. */
    ${P} .dm-rifiuti-bidone{
      display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:999px;
      background:color-mix(in srgb,var(--dm-bidone,#0ea5e9) 16%,transparent);
      border:1px solid color-mix(in srgb,var(--dm-bidone,#0ea5e9) 45%,transparent);
      font-size:12px;font-weight:900;color:var(--text,#0f172a)}
    ${P} .dm-rifiuti-bidone.grande{font-size:14px;padding:8px 16px 8px 10px}
    ${P} .dm-rifiuti-bidone-ic{
      display:grid;place-items:center;width:26px;height:26px;border-radius:50%;font-size:14px;
      background:var(--dm-bidone,#0ea5e9);box-shadow:0 2px 8px color-mix(in srgb,var(--dm-bidone,#0ea5e9) 50%,transparent)}
    ${P} .dm-rifiuti-bidone.grande .dm-rifiuti-bidone-ic{width:32px;height:32px;font-size:17px}

    ${P} .dm-rifiuti-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
    ${P} .dm-rifiuti-riga{
      position:relative;display:flex;align-items:center;gap:12px;padding:12px 14px 12px 18px;
      border-radius:16px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06));overflow:hidden}
    ${P} .dm-rifiuti-riga::before{
      content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--dm-bidone,#0ea5e9)}
    ${P} .dm-rifiuti-riga-ic{
      display:grid;place-items:center;width:40px;height:40px;border-radius:12px;font-size:20px;flex:0 0 auto;
      background:color-mix(in srgb,var(--dm-bidone,#0ea5e9) 18%,transparent)}
    ${P} .dm-rifiuti-riga-testo{display:grid;gap:2px;min-width:0;flex:1 1 auto}
    ${P} .dm-rifiuti-riga-testo strong{
      font-size:13px;font-weight:900;color:var(--text,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${P} .dm-rifiuti-riga-testo small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b);text-transform:capitalize}
    ${P} .dm-rifiuti-riga-quando{
      flex:0 0 auto;font-size:12px;font-weight:900;padding:5px 10px;border-radius:999px;
      background:var(--surface-3,#f1f5f9);color:var(--text,#0f172a);white-space:nowrap}
    ${P} .dm-rifiuti-riga[data-quando="oggi"] .dm-rifiuti-riga-quando{background:#fee2e2;color:#b91c1c}
    ${P} .dm-rifiuti-riga[data-quando="domani"] .dm-rifiuti-riga-quando{background:#fef3c7;color:#b45309}
    ${P} .dm-rifiuti-riga[data-quando="mai"] .dm-rifiuti-riga-quando,
    ${P} .dm-rifiuti-riga[data-quando="passato"] .dm-rifiuti-riga-quando{color:var(--text-dim,#64748b);font-weight:700}

    @media (max-width:640px){
      ${P} .dm-rifiuti-prossimo strong{font-size:26px}
      ${P} .dm-rifiuti-elenco{grid-template-columns:1fr}
    }
    `,
  );
}

export function installRifiuti() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureRifiutiPage();
  ensureRifiutiTab();
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmRifiuti) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmRifiuti = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
  return true;
}

installRifiuti();
