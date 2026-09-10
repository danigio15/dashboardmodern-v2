/* La pagina del citofono e della cassetta della posta (#449).
 *
 * «Avendo un intercom ho un button.cancello per aprire, inoltre volevo chiedere
 * una sezione per la cassetta della posta: all'interno c'è un Vallhorn di IKEA
 * che espone un pir per segnalare la presenza posta e un sensore luminosità
 * che, quando rileva luce (apertura cassetta), segnala il ritiro della posta.»
 *
 * In cima la risposta grande — c'è qualcuno alla porta, c'è posta in cassetta,
 * o niente di nuovo — e sotto due file di carte: i citofoni, con il tasto che
 * apre davvero, e le cassette, con quando è arrivata e quando è stata svuotata.
 *
 * È l'unica pagina di questa famiglia dove si comanda qualcosa: aprire il
 * cancello è l'unica cosa che si fa da qui, e il tasto è verde per quello. Il
 * resto sono sensori, che dicono come stanno e basta — la stessa forma dei
 * Varchi e della Presenza, perché chi ha imparato una pagina non deve
 * impararne tre.
 */
import {
  CHIAVE_CITOFONO,
  lettureDellIngresso,
  riassuntoDellIngresso,
} from "../core/citofono-e-posta.js";
import { quantoTempoInParole } from "../core/da-quanto.js";
import {
  allStates,
  chiamaServizio,
  doc,
  esc,
  installStyle,
  paginaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CITOFONO__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "", sveglia: 0 });

export const CITOFONO_PAGE_ID = "page-citofono";
export const CITOFONO_TAB = "citofono";

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_CITOFONO, {});
}

/** Il citofono e le cassette di casa, letti adesso. */
export function ingressoInPlancia(states = allStates()) {
  return lettureDellIngresso(configurazione(), states);
}

/** Se c'è qualcosa da mostrare: senza configurazione questa pagina non esiste. */
export function ceQualcosaDaMostrare(letture = ingressoInPlancia()) {
  return Boolean(letture.citofoni.length || letture.cassette.length);
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureCitofonoPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(CITOFONO_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = CITOFONO_PAGE_ID;
  pagina.innerHTML = `<div class="dm-citofono-wrap" id="citofono-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureCitofonoTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${CITOFONO_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto alle porte: è la stessa porta vista da fuori. */
  const dopo =
    barra.querySelector('.tab[data-tab="aperture"]') ||
    barra.querySelector('.tab[data-tab="varchi"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = CITOFONO_TAB;
  voce.id = `tab-${CITOFONO_TAB}`;
  voce.innerHTML = `<span class="icon">📮</span><span class="text">${esc(
    t("Citofono", "Intercom"),
  )}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureCitofonoPage()?.classList.add("active");
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

/* La voce si governa da sé, come i Varchi e la Presenza. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[CITOFONO_TAB] === false);
}

function accendiLaVoce(letture) {
  const voce = ensureCitofonoTab();
  if (!voce) return;
  const serve = ceQualcosaDaMostrare(letture) && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(CITOFONO_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── le parole ────────────────────────────────────────────────────────── */

/** Da quanto, in parole. `null` quando non c'è un momento da raccontare. */
export function daQuandoTesto(quando, adesso = Date.now()) {
  if (quando === null || quando === undefined) return "";
  return quantoTempoInParole(Math.max(0, (adesso - quando) / 60000));
}

/** La risposta grande in cima. */
export function titoloDellIngresso(riassunto) {
  if (riassunto.suona) return t("C'è qualcuno alla porta", "Someone is at the door");
  if (riassunto.aperte)
    return riassunto.aperte === 1
      ? t("Cassetta aperta", "Mailbox open")
      : t("Cassette aperte", "Mailboxes open");
  if (riassunto.conPosta)
    /* Il numero sta FUORI dalla frase tradotta: una chiave costruita con un
     * valore dentro cambia col valore, e nessuna di quelle chiavi sta nei
     * tredici cataloghi. */
    return riassunto.conPosta === 1
      ? t("C'è posta", "You have mail")
      : `${riassunto.conPosta} ${t("cassette con posta", "boxes with mail")}`;
  return t("Niente di nuovo", "Nothing new");
}

/** La parola di una cassetta, quella che le sta sopra a caratteri grandi. */
export function parolaDellaCassetta(voce) {
  if (voce.muta) return t("Non risponde", "Not answering");
  if (voce.aperta === true) return t("Aperta", "Open");
  if (voce.ce === true) return t("C'è posta", "Mail inside");
  if (voce.ce === false) return t("Vuota", "Empty");
  return t("Non si sa", "Unknown");
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function citofonoMarkup(voce) {
  const suona = voce.suona === true;
  const tasto = voce.puoAprire
    ? `<button type="button" class="dm-citofono-apri" data-dm-citofono-apri="${esc(voce.id)}">
        ${esc(t("Apri", "Open"))}
      </button>`
    : "";
  const sotto = suona
    ? t("Sta suonando", "Ringing now")
    : voce.squillo
      ? `${t("Ultimo squillo", "Last ring")} · ${daQuandoTesto(voce.squillo)}`
      : voce.campanello
        ? t("Silenzio", "Quiet")
        : t("Nessun campanello indicato", "No doorbell set");
  return `<article class="dm-citofono" data-suona="${suona}" data-dm-citofono="${esc(voce.id)}">
    <span class="dm-citofono-ic" aria-hidden="true">🔔</span>
    <div class="dm-citofono-testo">
      <strong>${esc(voce.nome || t("Citofono", "Intercom"))}</strong>
      <small>${esc(sotto)}</small>
    </div>
    ${tasto}
  </article>`;
}

function cassettaMarkup(voce) {
  const stato = voce.muta
    ? "muta"
    : voce.aperta === true
      ? "aperta"
      : voce.ce === true
        ? "piena"
        : voce.ce === false
          ? "vuota"
          : "ignota";
  const righe = [
    voce.arrivata
      ? `${t("Ultimo movimento", "Last movement")} · ${daQuandoTesto(voce.arrivata)}`
      : "",
    voce.ritirata ? `${t("Ultima apertura", "Last opening")} · ${daQuandoTesto(voce.ritirata)}` : "",
    voce.contatore === null
      ? ""
      : `${t("Lettere", "Letters")} · ${voce.contatore.toLocaleString()}`,
  ].filter(Boolean);
  return `<article class="dm-cassetta" data-stato="${esc(stato)}" data-dm-cassetta="${esc(voce.id)}">
    <span class="dm-cassetta-ic" aria-hidden="true">📬</span>
    <div class="dm-cassetta-testo">
      <strong>${esc(voce.nome || t("Cassetta", "Mailbox"))}</strong>
      ${righe.map((riga) => `<small>${esc(riga)}</small>`).join("")}
    </div>
    <b class="dm-cassetta-stato">${esc(parolaDellaCassetta(voce))}</b>
  </article>`;
}

function testaMarkup(riassunto) {
  const stato = riassunto.suona ? "suona" : riassunto.conPosta ? "posta" : "quiete";
  const sotto = [
    riassunto.citofoni
      ? riassunto.citofoni === 1
        ? t("1 citofono", "1 intercom")
        : `${riassunto.citofoni} ${t("citofoni", "intercoms")}`
      : "",
    riassunto.cassette
      ? riassunto.cassette === 1
        ? t("1 cassetta", "1 mailbox")
        : `${riassunto.cassette} ${t("cassette", "mailboxes")}`
      : "",
    riassunto.arrivata ? `${t("Arrivata", "Arrived")} ${daQuandoTesto(riassunto.arrivata)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="dm-citofono-testa" data-stato="${esc(stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(titoloDellIngresso(riassunto))}</strong>
    ${sotto ? `<span class="dm-citofono-sotto">${esc(sotto)}</span>` : ""}
  </div>`;
}

function vuotoMarkup() {
  return `<div class="dm-citofono-vuoto">
    <strong>${esc(t("Niente da mostrare, per ora", "Nothing to show yet"))}</strong>
    <span>${esc(
      t(
        "Il citofono e la cassetta della posta si dichiarano dalla scheda Citofono e posta della configurazione: il tasto che apre, il campanello, e i due sensori della cassetta.",
        "The intercom and the mailbox are declared in the Intercom and mail tab of the settings: the button that opens, the doorbell, and the two mailbox sensors.",
      ),
    )}</span>
  </div>`;
}

function fascia(titolo, carte) {
  if (!carte.length) return "";
  return `<section class="dm-citofono-fascia">
    <header><strong>${esc(titolo)}</strong></header>
    <div class="dm-citofono-elenco">${carte.join("")}</div>
  </section>`;
}

function dipingi() {
  const letture = ingressoInPlancia();
  accendiLaVoce(letture);
  const pagina = ensureCitofonoPage();
  const dove = pagina?.querySelector?.("#citofono-wrap");
  if (!dove) return;
  /* A pagina chiusa non si disegna: la voce nella barra si accende comunque,
   * ed è l'unica cosa che si vede da fuori. */
  if (!paginaVisibile(CITOFONO_PAGE_ID)) return;
  if (!ceQualcosaDaMostrare(letture)) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      dove.innerHTML = vuotoMarkup();
    }
    return;
  }
  const riassunto = riassuntoDellIngresso(letture);
  /* Nella firma ci va anche quello che si LEGGE: i «da quanto» li scrive
   * l'orologio, e senza metterli qui resterebbero fermi sul primo numero. */
  const firma = JSON.stringify([
    letture,
    letture.citofoni.map((voce) => daQuandoTesto(voce.squillo)),
    letture.cassette.map((voce) => [daQuandoTesto(voce.arrivata), daQuandoTesto(voce.ritirata)]),
    t("Apri", "Open"),
  ]);
  if (state.firma === firma && dove.firstElementChild) return;
  state.firma = firma;
  dove.innerHTML = `${testaMarkup(riassunto)}
    ${fascia(t("Citofono", "Intercom"), letture.citofoni.map(citofonoMarkup))}
    ${fascia(t("Cassetta della posta", "Mailbox"), letture.cassette.map(cassettaMarkup))}`;
}

/* ── il tasto che apre ────────────────────────────────────────────────── */

export function handleCitofonoClick(event) {
  const tasto = event.target?.closest?.("[data-dm-citofono-apri]");
  if (!tasto) return false;
  const id = tasto.dataset.dmCitofonoApri;
  const voce = ingressoInPlancia().citofoni.find((riga) => riga.id === id);
  if (!voce?.comando) return false;
  event.preventDefault?.();
  root.navigator?.vibrate?.(15);
  chiamaServizio(voce.comando);
  /* Un tasto premuto deve rispondere subito, anche prima che Home Assistant
   * dica qualcosa: chi apre un cancello vuole sapere che il dito è arrivato. */
  tasto.classList.add("dm-citofono-apri-premuto");
  root.setTimeout?.(() => tasto.classList.remove("dm-citofono-apri-premuto"), 900);
  return true;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      dipingi();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] citofono", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderCitofono() {
  state.firma = "";
  schedule();
}

function installStyles() {
  const P = `#${CITOFONO_PAGE_ID}`;
  installStyle(
    "dm-citofono-section-style",
    `
    ${P} .dm-citofono-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-citofono-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-citofono-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-citofono-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    ${P} .dm-citofono-testa{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-citofono-testa small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-citofono-testa strong{font-size:28px;font-weight:900;line-height:1.06;color:var(--text,#0f172a)}
    ${P} .dm-citofono-testa[data-stato="suona"] strong{color:#ea580c}
    ${P} .dm-citofono-testa[data-stato="posta"] strong{color:#2563eb}
    ${P} .dm-citofono-testa[data-stato="quiete"] strong{color:#15803d}
    ${P} .dm-citofono-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}

    ${P} .dm-citofono-fascia{display:grid;gap:9px}
    ${P} .dm-citofono-fascia>header>strong{
      font-family:'Oswald',system-ui,sans-serif;font-size:15px;letter-spacing:1.3px;
      text-transform:uppercase;color:var(--text,#0f172a)}
    ${P} .dm-citofono-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}

    ${P} .dm-citofono,${P} .dm-cassetta{
      display:grid;align-items:center;gap:12px;padding:14px 16px;border-radius:18px;
      border:1px solid color-mix(in srgb,var(--dm-ingresso,#94a3b8) 42%,transparent);
      background:color-mix(in srgb,var(--dm-ingresso,#94a3b8) 10%,var(--card-bg,#fff))}
    ${P} .dm-citofono{grid-template-columns:44px minmax(0,1fr) auto;--dm-ingresso:#16a34a}
    ${P} .dm-citofono[data-suona="true"]{--dm-ingresso:#ea580c}
    ${P} .dm-cassetta{grid-template-columns:44px minmax(0,1fr) auto;--dm-ingresso:#94a3b8}
    ${P} .dm-cassetta[data-stato="piena"]{--dm-ingresso:#2563eb}
    ${P} .dm-cassetta[data-stato="aperta"]{--dm-ingresso:#eab308}
    ${P} .dm-cassetta[data-stato="vuota"]{--dm-ingresso:#16a34a}

    ${P} .dm-citofono-ic,${P} .dm-cassetta-ic{
      display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:20px;
      background:color-mix(in srgb,var(--dm-ingresso,#94a3b8) 22%,transparent)}
    ${P} .dm-citofono-testo,${P} .dm-cassetta-testo{display:grid;gap:2px;min-width:0}
    ${P} .dm-citofono-testo strong,${P} .dm-cassetta-testo strong{
      font-size:14px;font-weight:900;color:var(--text,#0f172a);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-citofono-testo small,${P} .dm-cassetta-testo small{
      font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-cassetta-stato{
      font-size:11px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;
      color:color-mix(in srgb,var(--dm-ingresso,#94a3b8) 78%,var(--text,#0f172a))}

    ${P} .dm-citofono-apri{
      flex:0 0 auto;padding:9px 16px;border:0;border-radius:999px;cursor:pointer;
      font-size:12px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;
      color:#fff;background:#16a34a;transition:transform .12s ease,background .2s ease}
    ${P} .dm-citofono-apri:active,${P} .dm-citofono-apri-premuto{transform:scale(.94);background:#15803d}
    @media(max-width:520px){${P} .dm-citofono-elenco{grid-template-columns:1fr}}
    `,
  );
}

export function installCitofono() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureCitofonoPage();
  ensureCitofonoTab();
  doc.addEventListener("click", handleCitofonoClick, true);
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmCitofono) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmCitofono = true;
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
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

installCitofono();
