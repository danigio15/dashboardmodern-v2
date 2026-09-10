/* La pagina delle stampanti: se sono pronte, e quanto inchiostro resta (#469).
 *
 * «Volevo chiedere se c'era la possibilita' del controllo delle tv e
 * stampanti.»
 *
 * Della stampante non si vuole il controllo — non si stampa dalla plancia — si
 * vogliono sapere due cose, sempre le stesse due: se e' pronta, e quanto
 * inchiostro le resta. Sono le domande che uno si fa PRIMA di mandare in
 * stampa, e di solito la risposta arriva quando la stampante e' gia' ferma a
 * meta' foglio.
 *
 * In cima c'e' la risposta, grande: «Tutte pronte», oppure quella che si e'
 * fermata, oppure la cartuccia agli sgoccioli. Sotto, una carta per stampante
 * col disegno, la pastiglia dello stato e una barra per cartuccia, del colore
 * vero della cartuccia — nero, ciano, magenta, giallo — perche' quello lo si
 * riconosce prima del nome.
 *
 * E' la stessa forma della pagina della Presenza e dei Varchi: chi ha imparato
 * una pagina non deve impararne un'altra.
 */
import {
  CHIAVE_STAMPANTI,
  lettureDelleStampanti,
  riassuntoDelleStampanti,
  stampantiConfigurate,
} from "../core/stampanti-model.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
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

const KEY = "__DASHBOARDMODERN_STAMPANTI__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const STAMPANTI_PAGE_ID = "page-stampanti";
export const STAMPANTI_TAB = "stampanti";

/* ── cosa c'e' da guardare ────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_STAMPANTI, []);
}

/** Le stampanti di casa, lette adesso. */
export function stampantiInPlancia() {
  return lettureDelleStampanti(configurazione(), allStates(), root.resolveEntity);
}

/** Se c'e' almeno una stampante da mostrare. */
export function ciSonoStampanti() {
  return stampantiConfigurate(configurazione());
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureStampantiPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(STAMPANTI_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = STAMPANTI_PAGE_ID;
  pagina.innerHTML = `<div class="dm-stampanti-wrap" id="stampanti-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureStampantiTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${STAMPANTI_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto al server e alle macchine: e' la famiglia delle cose con una spina
   * e un indirizzo, non quella delle stanze. */
  const dopo =
    barra.querySelector('.tab[data-tab="server"]') ||
    barra.querySelector('.tab[data-tab="robot"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = STAMPANTI_TAB;
  voce.id = `tab-${STAMPANTI_TAB}`;
  voce.innerHTML = `<span class="icon">${disegnoDelCatalogo("printer", 20)}</span><span class="text">${esc(
    t("Stampanti", "Printers"),
  )}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureStampantiPage()?.classList.add("active");
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

function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[STAMPANTI_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureStampantiTab();
  if (!voce) return;
  const serve = ciSonoStampanti() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(STAMPANTI_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── le parole ────────────────────────────────────────────────────────── */

/** La parola di stato di una stampante. */
export function parolaDellaStampante(lettura) {
  if (lettura?.stato === "stampa") return t("In stampa", "Printing");
  if (lettura?.stato === "ferma") return t("Ferma", "Stopped");
  if (lettura?.stato === "pronta") return t("Pronta", "Ready");
  if (lettura?.stato === "spenta") return t("Spenta", "Off");
  if (lettura?.stato === "muta") return t("Non risponde", "Not answering");
  /* Uno stato che non conosciamo si dice com'e': tradurlo sarebbe
   * inventarselo, e chi ha quella stampante quella parola la riconosce. */
  return lettura?.parola || t("Sconosciuto", "Unknown");
}

/** La risposta grande in cima. */
export function titoloDelleStampanti(riassunto) {
  if (!riassunto?.quante) return t("Nessuna stampante", "No printer");
  if (riassunto.verdetto === "ferma")
    return riassunto.ferme.length === 1
      ? t(`${riassunto.ferme[0].nome} è ferma`, `${riassunto.ferme[0].nome} is stopped`)
      : t(`${riassunto.ferme.length} stampanti ferme`, `${riassunto.ferme.length} printers stopped`);
  if (riassunto.verdetto === "inchiostro") {
    const prima = riassunto.sgoccioli[0];
    return t(
      `${prima.piuScarica.nome} agli sgoccioli`,
      `${prima.piuScarica.nome} almost out`,
    );
  }
  if (riassunto.verdetto === "stampa")
    return riassunto.stampano.length === 1
      ? t(`${riassunto.stampano[0].nome} sta stampando`, `${riassunto.stampano[0].nome} is printing`)
      : t(`${riassunto.stampano.length} stanno stampando`, `${riassunto.stampano.length} printing`);
  if (riassunto.verdetto === "muta") return t("Nessuna risponde", "None answering");
  return riassunto.quante === 1
    ? t("Pronta", "Ready")
    : t("Tutte pronte", "All ready");
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function cartucciaMarkup(cartuccia) {
  const quanta = cartuccia.quanta === null ? 0 : cartuccia.quanta;
  return `<div class="dm-stampante-cart" data-scarsa="${cartuccia.agliSgoccioli ? "molto" : cartuccia.scarsa ? "si" : "no"}"
    style="--dm-cart:${esc(cartuccia.colore)}">
    <span class="dm-stampante-cart-nome">${esc(cartuccia.nome)}</span>
    <span class="dm-stampante-cart-barra"><i style="width:${quanta}%"></i></span>
    <b class="dm-stampante-cart-val">${cartuccia.quanta === null ? "—" : `${quanta}%`}</b>
  </div>`;
}

function sottoIlNome(lettura) {
  const pezzi = [];
  if (lettura.motivo) pezzi.push(lettura.motivo);
  if (lettura.pagine !== null && lettura.pagine !== undefined)
    pezzi.push(t(`${lettura.pagine} pagine stampate`, `${lettura.pagine} pages printed`));
  if (!pezzi.length) pezzi.push(lettura.entity);
  return pezzi.join(" · ");
}

function cartaMarkup(lettura) {
  return `<article class="dm-stampante" data-stato="${esc(lettura.stato)}">
    <div class="dm-stampante-testa">
      <span class="dm-stampante-ic" aria-hidden="true">${disegnoDelCatalogo("printer", 44)}</span>
      <div class="dm-stampante-testo">
        <strong>${esc(lettura.nome)}</strong>
        <small>${esc(sottoIlNome(lettura))}</small>
      </div>
      <b class="dm-stampante-stato">${esc(parolaDellaStampante(lettura))}</b>
    </div>
    ${
      lettura.cartucce.length
        ? `<div class="dm-stampante-cartucce">${lettura.cartucce.map(cartucciaMarkup).join("")}</div>`
        : `<div class="dm-stampante-senza">${esc(
            t(
              "Nessuna cartuccia trovata: se la tua stampante le dice, scrivile nella scheda Stampanti.",
              "No cartridge found: if your printer reports them, write them in the Printers tab.",
            ),
          )}</div>`
    }
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-stampanti-vuoto">
    <strong>${esc(t("Nessuna stampante configurata", "No printer configured"))}</strong>
    <span>${esc(
      t(
        "Aggiungi la stampante dalla scheda Stampanti della configurazione: basta l'entità che dice se è pronta, le cartucce si cercano da sole.",
        "Add the printer from the Printers tab in the settings: the entity that says whether it is ready is enough, the cartridges are found on their own.",
      ),
    )}</span>
  </div>`;
}

function testaMarkup(riassunto) {
  const sotto = [
    riassunto.quante === 1
      ? t("1 stampante", "1 printer")
      : t(`${riassunto.quante} stampanti`, `${riassunto.quante} printers`),
    riassunto.mute.length
      ? riassunto.mute.length === 1
        ? t("1 non risponde", "1 not answering")
        : t(`${riassunto.mute.length} non rispondono`, `${riassunto.mute.length} not answering`)
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="dm-stampanti-testa" data-verdetto="${esc(riassunto.verdetto)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(titoloDelleStampanti(riassunto))}</strong>
    <span class="dm-stampanti-sotto">${esc(sotto)}</span>
  </div>`;
}

function dipingi() {
  const pagina = ensureStampantiPage();
  const dove = pagina?.querySelector?.("#stampanti-wrap");
  if (!dove) return;
  if (!paginaVisibile(STAMPANTI_PAGE_ID)) return;
  const letture = stampantiInPlancia();
  if (!letture.length) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      dove.innerHTML = vuotoMarkup();
    }
    return;
  }
  const riassunto = riassuntoDelleStampanti(letture);
  const firma = JSON.stringify([letture, t("Pronta", "Ready")]);
  if (state.firma !== firma || !dove.firstElementChild) {
    state.firma = firma;
    dove.innerHTML = `${testaMarkup(riassunto)}
      <div class="dm-stampanti-elenco">${letture.map(cartaMarkup).join("")}</div>`;
  }
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] stampanti", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderStampanti() {
  state.firma = "";
  schedule();
}

function installStyles() {
  const P = `#${STAMPANTI_PAGE_ID}`;
  installStyle(
    "dm-stampanti-section-style",
    `
    ${P} .dm-stampanti-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-stampanti-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-stampanti-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-stampanti-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    ${P} .dm-stampanti-testa{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-stampanti-testa small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-stampanti-testa strong{font-size:28px;font-weight:900;line-height:1.08;color:var(--text,#0f172a)}
    ${P} .dm-stampanti-testa[data-verdetto="ferma"] strong{color:#b91c1c}
    ${P} .dm-stampanti-testa[data-verdetto="inchiostro"] strong{color:#b45309}
    ${P} .dm-stampanti-testa[data-verdetto="stampa"] strong{color:#0369a1}
    ${P} .dm-stampanti-testa[data-verdetto="pronta"] strong{color:#15803d}
    ${P} .dm-stampanti-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}

    ${P} .dm-stampanti-elenco{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
    ${P} .dm-stampante{
      display:grid;gap:12px;padding:16px 18px;border-radius:20px;
      border:1px solid color-mix(in srgb,var(--dm-st,#94a3b8) 42%,transparent);
      background:color-mix(in srgb,var(--dm-st,#94a3b8) 8%,var(--card-bg,#fff))}
    ${P} .dm-stampante[data-stato="pronta"]{--dm-st:#16a34a}
    ${P} .dm-stampante[data-stato="stampa"]{--dm-st:#0ea5e9}
    ${P} .dm-stampante[data-stato="ferma"]{--dm-st:#dc2626}
    ${P} .dm-stampante[data-stato="muta"],${P} .dm-stampante[data-stato="spenta"]{--dm-st:#94a3b8}
    ${P} .dm-stampante-testa{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px}
    ${P} .dm-stampante-ic{display:grid;place-items:center;width:44px;height:44px}
    ${P} .dm-stampante-ic .dm-appliance-art{display:block;line-height:0}
    ${P} .dm-stampante-testo{display:grid;gap:2px;min-width:0}
    ${P} .dm-stampante-testo strong{font-size:14.5px;font-weight:900;color:var(--text,#0f172a);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-stampante-testo small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-stampante-stato{
      font-size:11px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;
      color:color-mix(in srgb,var(--dm-st,#94a3b8) 80%,var(--text,#0f172a))}

    /* Le cartucce: una riga per colore, con la barra del colore vero. */
    ${P} .dm-stampante-cartucce{display:grid;gap:7px}
    ${P} .dm-stampante-cart{display:grid;grid-template-columns:minmax(64px,88px) minmax(0,1fr) 42px;
      align-items:center;gap:10px}
    ${P} .dm-stampante-cart-nome{font-size:11px;font-weight:800;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-stampante-cart-barra{display:block;height:9px;border-radius:999px;overflow:hidden;
      background:color-mix(in srgb,var(--dm-cart,#0ea5e9) 16%,var(--surface-3,#f1f5f9))}
    ${P} .dm-stampante-cart-barra i{display:block;height:100%;border-radius:999px;
      background:var(--dm-cart,#0ea5e9)}
    ${P} .dm-stampante-cart-val{font-size:11.5px;font-weight:900;text-align:right;
      font-variant-numeric:tabular-nums;color:var(--text,#0f172a)}
    ${P} .dm-stampante-cart[data-scarsa="molto"] .dm-stampante-cart-val{color:#b91c1c}
    ${P} .dm-stampante-cart[data-scarsa="si"] .dm-stampante-cart-val{color:#b45309}
    ${P} .dm-stampante-senza{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
    @media(max-width:520px){${P} .dm-stampanti-elenco{grid-template-columns:1fr}}
    `,
  );
}

export function installStampanti() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureStampantiPage();
  ensureStampantiTab();
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmStampanti) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmStampanti = true;
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

installStampanti();
