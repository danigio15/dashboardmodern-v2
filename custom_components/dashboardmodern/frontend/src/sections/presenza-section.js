/* La pagina della presenza: dove c'è qualcuno adesso, e da quanto (#432).
 *
 * «Ci vorrebbe una sezione con i sensori presenza o movimento.»
 *
 * In cima c'è la risposta, grande: in quante stanze c'è qualcuno — o «Casa
 * libera», che a casa vuota è la cosa che si vuole leggere in mezzo secondo.
 * Sotto, una carta per rilevatore: blu quella che rileva qualcuno, verde quella
 * libera, e smorta quella che non risponde, perché un rilevatore muto non è una
 * stanza vuota — è una sorveglianza che manca.
 *
 * Ogni carta dice anche da quanto sta così, che è il pezzo di informazione per
 * cui questa pagina serve davvero: «libera da tre minuti» e «libera da otto ore»
 * sono due case diverse, e il pallino acceso non le distingue.
 *
 * Qui non si comanda niente: un rilevatore dice come sta e basta. È la stessa
 * forma della pagina dei Varchi, perché è la stessa domanda fatta su un'altra
 * famiglia di sensori, e chi ha imparato una pagina non deve impararne due.
 */
import {
  CHIAVE_PRESENZA,
  contoDellaPresenza,
  presenzaConfigurata,
  presenzaDiCasa,
  ultimoMovimento,
} from "../core/presenza-in-casa.js";
import { prossimoCambioDelDaQuando, quantoTempoInParole } from "../core/da-quanto.js";
import {
  allStates,
  doc,
  esc,
  installStyle,
  paginaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  t,
} from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_PRESENZA__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "", sveglia: 0 });

export const PRESENZA_PAGE_ID = "page-presenza";
export const PRESENZA_TAB = "presenza";

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_PRESENZA, {});
}

/** I rilevatori di casa, letti adesso. */
export function presenzaInPlancia() {
  const states = allStates();
  return presenzaDiCasa(states, configurazione(), (entity) => nomeDaHomeAssistant(entity, states));
}

/** Se c'è almeno un rilevatore da mostrare. */
export function ciSonoRilevatori() {
  return presenzaConfigurata(allStates(), configurazione());
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensurePresenzaPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(PRESENZA_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = PRESENZA_PAGE_ID;
  pagina.innerHTML = `<div class="dm-presenza-wrap" id="presenza-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensurePresenzaTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${PRESENZA_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto ai Varchi: cosa è aperto e dove c'è qualcuno sono le due domande
   * che ci si fa arrivando a casa, e stanno una accanto all'altra. */
  const dopo =
    barra.querySelector(`.tab[data-tab="varchi"]`) ||
    barra.querySelector('.tab[data-tab="security"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = PRESENZA_TAB;
  voce.id = `tab-${PRESENZA_TAB}`;
  voce.innerHTML = `<span class="icon">🏃</span><span class="text">${esc(t("Presenza", "Presence"))}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensurePresenzaPage()?.classList.add("active");
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

/* La voce si governa da sé, come i Varchi e le Allerte. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[PRESENZA_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensurePresenzaTab();
  if (!voce) return;
  const serve = ciSonoRilevatori() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(PRESENZA_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── le parole ────────────────────────────────────────────────────────── */

/** La parola di un rilevatore. Un movimento e una presenza non dicono uguale. */
export function parolaDelRilevatore(riga) {
  if (riga?.stato === "attivo")
    return riga?.stabile ? t("Occupato", "Occupied") : t("Movimento", "Movement");
  if (riga?.stato === "libero") return riga?.stabile ? t("Libero", "Free") : t("Fermo", "Still");
  return t("Non risponde", "Not answering");
}

/** La risposta grande in cima: in quante stanze c'è qualcuno. */
export function titoloDellaPresenza(conto) {
  if (!conto?.totale) return t("Nessun rilevatore trovato", "No detector found");
  if (!conto.attivi) return t("Casa libera", "Nobody around");
  return conto.attivi === 1
    ? t("In 1 stanza c'è qualcuno", "Someone in 1 room")
    : t(`In ${conto.attivi} stanze c'è qualcuno`, `Someone in ${conto.attivi} rooms`);
}

/* ── il disegno ───────────────────────────────────────────────────────── */

/* La scritta «da quanto», in parole. Sta separata dal markup perché la legge
 * anche la firma del ridisegno: è l'unico pezzo di questa pagina che cambia da
 * solo, col passare del tempo, e chi decide se ridisegnare deve poterlo
 * guardare. La scala dei tempi è quella dei Varchi — sta in `da-quanto.js`,
 * perché due copie della stessa scala si sarebbero scollate. */
export function daQuandoTesto(riga) {
  if (riga?.da === null || riga?.da === undefined) return "";
  const minuti = Math.max(0, (Date.now() - riga.da) / 60000);
  /* «appena adesso» non vuole il «da» davanti: sarebbe «occupato da appena
   * adesso», che non lo dice nessuno. */
  if (minuti < 1) return `${parolaDelRilevatore(riga)} ${quantoTempoInParole(0)}`;
  const parola =
    riga.stato === "attivo"
      ? riga.stabile
        ? t("Occupato da", "Occupied for")
        : t("Movimento da", "Movement for")
      : riga.stato === "libero"
        ? riga.stabile
          ? t("Libero da", "Free for")
          : t("Fermo da", "Still for")
        : t("Non risponde da", "Not answering for");
  return `${parola} ${quantoTempoInParole(minuti)}`;
}

function daQuandoMarkup(riga) {
  if (riga.da === null || riga.da === undefined)
    return `<small class="mono">${esc(riga.entity)}</small>`;
  return `<small>${esc(daQuandoTesto(riga))}</small>`;
}

function rigaMarkup(riga) {
  return `<article class="dm-presenza" data-presenza="${esc(riga.stato || "muto")}">
    <span class="dm-presenza-ic" aria-hidden="true">${esc(riga.glifo)}</span>
    <div class="dm-presenza-testo">
      <strong>${esc(riga.name)}</strong>
      ${daQuandoMarkup(riga)}
    </div>
    <b class="dm-presenza-stato">${esc(parolaDelRilevatore(riga))}</b>
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-presenza-vuoto">
    <strong>${esc(t("Nessun rilevatore trovato", "No detector found"))}</strong>
    <span>${esc(
      t(
        "Un sensore di movimento o di presenza lo dichiara Home Assistant da sé e compare qui senza configurare niente. Se il tuo non viene trovato, aggiungilo dalla scheda Presenza della configurazione.",
        "Home Assistant declares a motion or presence sensor itself and it appears here with nothing to configure. If yours is not found, add it from the Presence tab in the settings.",
      ),
    )}</span>
  </div>`;
}

/* Quando non c'è nessuno, la notizia è l'ULTIMA volta che c'è stato.
 *
 * «Casa libera» da sola non distingue «sono uscito adesso» da «non entra
 * nessuno da ieri», e la seconda è la ragione per cui uno guarda questa pagina
 * dal telefono. Il rilevatore che ha cambiato stato per ultimo, a casa tutta
 * libera, è quello che si è appena spento: è l'ultimo movimento. */
function ultimoMovimentoTesto(righe) {
  const quando = ultimoMovimento(righe);
  if (quando == null) return "";
  return `${t("Ultimo movimento", "Last movement")} · ${quantoTempoInParole(Math.max(0, (Date.now() - quando) / 60000))}`;
}

function testaMarkup(conto, righe) {
  const stato = conto.attivi ? "attivi" : conto.totale ? "liberi" : "vuoto";
  const sotto = [
    conto.liberi
      ? conto.liberi === 1
        ? t("1 libera", "1 free")
        : t(`${conto.liberi} libere`, `${conto.liberi} free`)
      : "",
    conto.muti
      ? conto.muti === 1
        ? t("1 non risponde", "1 not answering")
        : t(`${conto.muti} non rispondono`, `${conto.muti} not answering`)
      : "",
    conto.attivi ? "" : ultimoMovimentoTesto(righe),
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="dm-presenza-testa" data-stato="${esc(stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(titoloDellaPresenza(conto))}</strong>
    ${conto.nomi.length ? `<span class="dm-presenza-nomi">${esc(conto.nomi.join(" · "))}</span>` : ""}
    ${sotto ? `<span class="dm-presenza-sotto">${esc(sotto)}</span>` : ""}
  </div>`;
}

function dipingi() {
  const pagina = ensurePresenzaPage();
  const dove = pagina?.querySelector?.("#presenza-wrap");
  if (!dove) return;
  /* A pagina chiusa non si disegna: la voce nella barra si accende comunque,
   * ed è l'unica cosa che si vede da fuori. */
  if (!paginaVisibile(PRESENZA_PAGE_ID)) return;
  const righe = presenzaInPlancia();
  if (!righe.length) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      dove.innerHTML = vuotoMarkup();
    }
    return;
  }
  const conto = contoDellaPresenza(righe);
  /* Nella firma ci va anche quello che si LEGGE, non solo quello che c'è: il
   * «da quanto» lo scrive l'orologio, e senza metterlo nella firma resterebbe
   * fermo sul primo numero per ore. */
  const firma = JSON.stringify([
    righe,
    righe.map(daQuandoTesto),
    ultimoMovimentoTesto(righe),
    t("Occupato", "Occupied"),
  ]);
  if (state.firma !== firma || !dove.firstElementChild) {
    state.firma = firma;
    dove.innerHTML = `${testaMarkup(conto, righe)}
      <div class="dm-presenza-elenco">${righe.map(rigaMarkup).join("")}</div>`;
  }
  svegliamiQuandoCambia(righe);
}

/* Una sveglia sola, al momento in cui la prima scritta cambierà. Non è un
 * battito che gira: è un appuntamento, preso dopo aver disegnato e disdetto a
 * ogni ridisegno. */
function svegliamiQuandoCambia(righe) {
  if (state.sveglia) {
    root.clearTimeout?.(state.sveglia);
    state.sveglia = 0;
  }
  const fra = prossimoCambioDelDaQuando(righe, Date.now());
  if (fra == null) return;
  state.sveglia =
    root.setTimeout?.(() => {
      state.sveglia = 0;
      schedule();
    }, Math.max(1000, fra)) || 0;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] presenza", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderPresenza() {
  state.firma = "";
  schedule();
}

function installStyles() {
  const P = `#${PRESENZA_PAGE_ID}`;
  installStyle(
    "dm-presenza-section-style",
    `
    ${P} .dm-presenza-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-presenza-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-presenza-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-presenza-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* La risposta grande: in quante stanze c'è qualcuno adesso. */
    ${P} .dm-presenza-testa{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-presenza-testa small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-presenza-testa strong{font-size:30px;font-weight:900;line-height:1.05;color:var(--text,#0f172a)}
    ${P} .dm-presenza-testa[data-stato="attivi"] strong{color:#2563eb}
    ${P} .dm-presenza-testa[data-stato="liberi"] strong{color:#15803d}
    ${P} .dm-presenza-nomi{font-size:13px;font-weight:800;color:var(--text,#0f172a)}
    ${P} .dm-presenza-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}

    ${P} .dm-presenza-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}

    /* La carta di un rilevatore: il colore lo dice prima della parola. */
    ${P} .dm-presenza{
      display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px;
      padding:14px 16px;border-radius:18px;
      border:1px solid color-mix(in srgb,var(--dm-presenza,#94a3b8) 42%,transparent);
      background:color-mix(in srgb,var(--dm-presenza,#94a3b8) 10%,var(--card-bg,#fff))}
    ${P} .dm-presenza[data-presenza="attivo"]{--dm-presenza:#2563eb}
    ${P} .dm-presenza[data-presenza="libero"]{--dm-presenza:#16a34a}
    ${P} .dm-presenza[data-presenza="muto"]{--dm-presenza:#94a3b8}
    ${P} .dm-presenza-ic{
      display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:20px;
      background:color-mix(in srgb,var(--dm-presenza,#94a3b8) 22%,transparent)}
    ${P} .dm-presenza-testo{display:grid;gap:2px;min-width:0}
    ${P} .dm-presenza-testo strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-presenza-testo small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-presenza-stato{
      font-size:11px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;
      color:color-mix(in srgb,var(--dm-presenza,#94a3b8) 78%,var(--text,#0f172a))}
    @media(max-width:520px){${P} .dm-presenza-elenco{grid-template-columns:1fr}}
    `,
  );
}

export function installPresenza() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensurePresenzaPage();
  ensurePresenzaTab();
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmPresenza) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmPresenza = true;
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

installPresenza();
