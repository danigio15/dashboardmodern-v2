/* La pagina delle batterie: tutte, non solo quelle da cambiare (#398).
 *
 * «Le batterie quelle cariche non le fa vedere?»
 *
 * No, e non c'era nemmeno un posto dove guardarle: la plancia mostrava una
 * tessera in Home soltanto quando una scendeva sotto soglia, e sparita quella
 * spariva l'argomento. Chi ha la casa in ordine non aveva modo di sapere
 * quante batterie ha, né quale sarà la prossima a chiedere una pila — che è
 * l'unica cosa utile da sapere PRIMA che si scarichi.
 *
 * In cima la risposta grande: quante sono da cambiare, o «Tutte cariche».
 * Sotto una carta per batteria, dalla più scarica alla più piena, con l'arco
 * che si riempie e il colore che cambia sulla soglia scritta in
 * configurazione. Quelle che non rispondono restano in fondo e smorte: una
 * batteria che ha smesso di parlare è spesso una batteria finita, e toglierla
 * dall'elenco vorrebbe dire far sparire proprio quella che sta per lasciarti
 * a piedi.
 *
 * Qui non si comanda niente: una batteria si guarda. È il motivo per cui
 * questa pagina si può aprire cento volte senza paura di toccare qualcosa.
 */
import {
  CHIAVE_BATTERIE,
  batterieLette,
  riepilogoBatterie,
  sogliaDelleBatterie,
} from "../core/batterie-di-casa.js";
import {
  allStates,
  clean,
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
import { batterieSorvegliate } from "./batterie-elenco-section.js";

const KEY = "__DASHBOARDMODERN_BATTERIE__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const BATTERIE_PAGE_ID = "page-batterie";
export const BATTERIE_TAB = "batterie";

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

/** La soglia di casa: sotto questa una batteria è da cambiare. */
export function sogliaDiCasa() {
  return sogliaDelleBatterie(readJson(CHIAVE_BATTERIE, {}));
}

/** Le batterie di casa, lette adesso e messe in ordine. */
export function batterieInPlancia() {
  const states = allStates();
  return batterieLette(batterieSorvegliate(), states, {
    soglia: sogliaDiCasa(),
    nome: (entity) => nomeDaHomeAssistant(entity, states),
  });
}

/** Se c'è almeno una batteria da mostrare. */
export const ciSonoBatterie = () => batterieSorvegliate().length > 0;

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureBatteriePage() {
  if (!doc) return null;
  let pagina = doc.getElementById(BATTERIE_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = BATTERIE_PAGE_ID;
  pagina.innerHTML = `<div class="dm-batt-wrap" id="batterie-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureBatterieTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${BATTERIE_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* In fondo, accanto al MiniPC: le batterie non sono una stanza né un
   * impianto, sono la manutenzione della casa — si guardano ogni tanto, non
   * ogni giorno. */
  const dopo =
    barra.querySelector('.tab[data-tab="server"]') || barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = BATTERIE_TAB;
  voce.id = `tab-${BATTERIE_TAB}`;
  voce.innerHTML = `<span class="icon">🔋</span><span class="text">${esc(t("Batterie", "Batteries"))}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureBatteriePage()?.classList.add("active");
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

/* La voce si governa da sé, come i Varchi e i Rifiuti. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[BATTERIE_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureBatterieTab();
  if (!voce) return;
  const serve = ciSonoBatterie() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(BATTERIE_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── le parole ────────────────────────────────────────────────────────── */

/** La risposta grande in cima: quante sono da cambiare, o che stanno bene. */
export function titoloDelleBatterie(conto) {
  if (!conto?.quante) return t("Nessuna batteria trovata", "No battery found");
  if (!conto.lette) return t("Nessuna risponde", "None answering");
  if (!conto.scariche) return t("Tutte cariche", "All charged");
  /* Il numero sta FUORI dalla frase da tradurre: dentro, la chiave sarebbe
   * diversa per ogni casa — «3 da cambiare», «4 da cambiare» — e nessuna di
   * quelle si troverebbe mai nel catalogo. */
  return conto.scariche === 1
    ? t("1 da cambiare", "1 to replace")
    : `${conto.scariche} ${t("da cambiare", "to replace")}`;
}

/* Il glifo segue il livello, come lo segue una batteria vera: piena, mezza,
 * quasi finita. Muta è muta, e si vede che lo è. */
function glifoDelLivello(riga) {
  if (riga.muta) return "❔";
  if (riga.scarica) return "🪫";
  return "🔋";
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function rigaMarkup(riga) {
  const stato = riga.muta ? "muta" : riga.scarica ? "scarica" : "carica";
  const quanto = riga.muta ? 0 : Math.max(0, Math.min(100, riga.level));
  return `<article class="dm-batt" data-batt="${esc(stato)}" data-dm-entita="${esc(riga.entity)}">
    <span class="dm-batt-ic" aria-hidden="true">${esc(glifoDelLivello(riga))}</span>
    <div class="dm-batt-testo">
      <strong>${esc(riga.name)}</strong>
      <small class="mono">${esc(riga.entity)}</small>
      <span class="dm-batt-barra"><i style="width:${esc(String(quanto))}%"></i></span>
    </div>
    <b class="dm-batt-livello">${esc(riga.muta ? "—" : `${Math.round(riga.level)}%`)}</b>
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-batt-vuoto">
    <strong>${esc(t("Nessuna batteria trovata", "No battery found"))}</strong>
    <span>${esc(
      t(
        "Una batteria la dichiara Home Assistant da sé — un sensore in percentuale — e compare qui senza configurare niente. Se la tua non viene trovata, aggiungila dalla scheda Batterie della configurazione.",
        "Home Assistant declares a battery itself — a sensor in percent — and it appears here with nothing to configure. If yours is not found, add it from the Batteries tab in the settings.",
      ),
    )}</span>
  </div>`;
}

function testaMarkup(conto, soglia) {
  const stato = conto.scariche ? "scariche" : conto.quante ? "cariche" : "vuoto";
  /* La didascalia dice la cosa che serve PRIMA che una si scarichi: qual è la
   * più bassa. È il motivo per cui questa pagina si guarda quando tutto va
   * bene, invece che solo quando è tardi. */
  const sotto = [
    conto.minima ? `${conto.minima.name} ${Math.round(conto.minima.level)}%` : "",
    conto.mute
      ? conto.mute === 1
        ? t("1 non risponde", "1 not answering")
        : `${conto.mute} ${t("non rispondono", "not answering")}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="dm-batt-testa" data-stato="${esc(stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(titoloDelleBatterie(conto))}</strong>
    ${sotto ? `<span class="dm-batt-sotto">${esc(sotto)}</span>` : ""}
    <span class="dm-batt-soglia">${esc(t("Da cambiare sotto il", "To replace below"))} ${esc(String(soglia))}%</span>
  </div>`;
}

function dipingi() {
  const pagina = ensureBatteriePage();
  const dove = pagina?.querySelector?.("#batterie-wrap");
  if (!dove) return;
  /* A pagina chiusa non si disegna: la voce nella barra si accende comunque,
   * ed è l'unica cosa che si vede da fuori. */
  if (!paginaVisibile(BATTERIE_PAGE_ID)) return;
  const righe = batterieInPlancia();
  if (!righe.length) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      dove.innerHTML = vuotoMarkup();
    }
    return;
  }
  const soglia = sogliaDiCasa();
  const conto = riepilogoBatterie(righe);
  const firma = `${soglia}|${righe.map((riga) => `${riga.entity}:${riga.level}`).join(",")}`;
  if (state.firma === firma) return;
  state.firma = firma;
  dove.innerHTML = `${testaMarkup(conto, soglia)}
    <div class="dm-batt-elenco">${righe.map(rigaMarkup).join("")}</div>`;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] batterie", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Ridisegna adesso, saltando la firma: la usa chi cambia la configurazione. */
export function renderBatterie() {
  state.firma = "";
  schedule();
}

function installStyles() {
  const P = `#${BATTERIE_PAGE_ID}`;
  installStyle(
    "dm-batterie-style",
    `
    ${P} .dm-batt-wrap{display:grid;gap:14px;padding:14px 14px 26px}
    ${P} .dm-batt-testa{
      display:grid;gap:3px;padding:16px 18px;border-radius:20px;
      border:1px solid var(--card-border,rgba(0,0,0,.08));background:var(--card-bg,#fff)}
    ${P} .dm-batt-testa small{font-size:10px;font-weight:900;letter-spacing:.09em;
      text-transform:uppercase;color:var(--text-dim,#94a3b8)}
    ${P} .dm-batt-testa strong{font-size:24px;font-weight:900;letter-spacing:-.02em;
      color:var(--text,#0f172a)}
    ${P} .dm-batt-testa[data-stato="scariche"] strong{color:#b45309}
    ${P} .dm-batt-testa[data-stato="cariche"] strong{color:#047857}
    ${P} .dm-batt-sotto,${P} .dm-batt-soglia{font-size:11.5px;font-weight:750;
      color:var(--text-dim,#64748b)}
    ${P} .dm-batt-soglia{opacity:.75}
    ${P} .dm-batt-elenco{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
    ${P} .dm-batt{
      --dm-batt:#10b981;
      display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;
      padding:12px 14px;border-radius:18px;
      border:1px solid color-mix(in srgb,var(--dm-batt) 34%,var(--card-border,rgba(0,0,0,.08)));
      background:var(--card-bg,#fff)}
    ${P} .dm-batt[data-batt="scarica"]{--dm-batt:#f59e0b}
    ${P} .dm-batt[data-batt="muta"]{--dm-batt:#94a3b8;opacity:.72}
    ${P} .dm-batt-ic{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;
      font-size:19px;background:color-mix(in srgb,var(--dm-batt) 20%,transparent)}
    ${P} .dm-batt-testo{display:grid;gap:3px;min-width:0}
    ${P} .dm-batt-testo strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-batt-testo small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-batt-barra{display:block;height:5px;border-radius:999px;margin-top:2px;
      background:color-mix(in srgb,var(--dm-batt) 16%,transparent);overflow:hidden}
    ${P} .dm-batt-barra i{display:block;height:100%;border-radius:999px;background:var(--dm-batt)}
    ${P} .dm-batt-livello{font-size:15px;font-weight:900;font-variant-numeric:tabular-nums;
      color:color-mix(in srgb,var(--dm-batt) 78%,var(--text,#0f172a))}
    ${P} .dm-batt-vuoto{display:grid;gap:6px;padding:22px;border-radius:20px;
      border:1px dashed var(--card-border,rgba(0,0,0,.14));background:var(--card-bg,#fff)}
    ${P} .dm-batt-vuoto strong{font-size:16px;font-weight:900}
    ${P} .dm-batt-vuoto span{font-size:12.5px;color:var(--text-dim,#64748b);line-height:1.45}
    @media(max-width:520px){${P} .dm-batt-elenco{grid-template-columns:1fr}}
    `,
  );
}

export function installBatterie() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureBatteriePage();
  ensureBatterieTab();
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmBatterie) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmBatterie = true;
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

installBatterie();
