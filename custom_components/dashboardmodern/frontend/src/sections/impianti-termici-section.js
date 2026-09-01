/* Il locale caldaia ha tre macchine, non una (#253).
 *
 * La pagina si chiamava «Solare termico» e disegnava un impianto solo:
 * pannello sul tetto, pompa, accumulo. Ma l'acqua calda in casa la fanno tre
 * macchine diverse, e quasi nessuno ne ha una sola. Chi ha il fotovoltaico e
 * lo scaldabagno apriva questa pagina e ci trovava un pannello che non ha; chi
 * ha solare e caldaia insieme — il caso piu' comune — ne vedeva una sola.
 *
 * Adesso in configurazione si spunta quello che si ha: solare termico,
 * scaldabagno, caldaia, uno o tutti e tre. Con uno solo la pagina e' quella di
 * sempre, senza niente in piu' da capire. Con due o tre compare in alto la
 * fila delle linguette, la stessa che la pagina Clima usa per Freddo e Caldo:
 * un gesto che chi usa la plancia conosce gia'.
 *
 * Il disegno del solare NON si tocca: e' del suo modulo, ed e' un pixel che ha
 * gia' un padrone. Le due scene nuove nascono accanto, nello stesso linguaggio
 * — assonometria a 2:1, tubi con l'anima chiara, targhette scure coi numeri —
 * e si accendono a turno. Ognuna e' un fratello della scena vecchia, mai un
 * suo inquilino.
 *
 * Qui non si scrive niente in Home Assistant: si legge, si disegna, e
 * l'interruttore chiama il servizio che chiamava gia' la tessera.
 */
import {
  BRICIOLE_TERMICHE,
  CHIAVE_CALDAIA,
  CHIAVE_IMPIANTI,
  ETICHETTE_TERMICHE,
  TITOLI_TERMICI,
  entitaDellaCaldaia,
  impiantiScelti,
  letturaCaldaia,
  servonoLinguette,
  tabAttiva,
  verdettoPressione,
} from "../core/impianti-termici.js";
import {
  SCALDABAGNI_KEY,
  lettureScaldabagni,
  quotaVersoObiettivo,
} from "../core/scaldabagno-model.js";
import { registraTitoloDiPagina, renderPageMastheads } from "./page-masthead-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  readJson,
  root,
  siComanda,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_IMPIANTI_TERMICI__";
const STYLE_ID = "dm-impianti-termici-style";
const state = (root[KEY] ||= { installed: false, frame: 0, tab: "", firma: "" });

const PAGINA = "page-boiler";

/* ── cosa c'e' in casa ─────────────────────────────────────────────────── */

function scaldabagniConfigurati() {
  const stored = readJson(SCALDABAGNI_KEY, []);
  return Array.isArray(stored) && stored.length > 0;
}

function caldaiaConfigurata() {
  return entitaDellaCaldaia(readJson(CHIAVE_CALDAIA, {})).length > 0;
}

/* Il solare risulta configurato se qualcuna delle sue caselle e' mappata: e'
 * l'indizio che serve a chi arriva da una plancia in cui questa domanda non
 * esisteva ancora, e che non deve perdere la pagina che vedeva ieri. */
function solareConfigurato() {
  const mappature = readJson("cd_entity_overrides", {});
  if (!mappature || typeof mappature !== "object") return false;
  return Object.keys(mappature).some(
    (chiave) => chiave.startsWith("dm.boiler_") && clean(mappature[chiave]),
  );
}

export function impiantiDiCasa() {
  return impiantiScelti(readJson(CHIAVE_IMPIANTI, null), {
    solare: solareConfigurato(),
    scaldabagno: scaldabagniConfigurati(),
    caldaia: caldaiaConfigurata(),
  });
}

/* ── le linguette ──────────────────────────────────────────────────────── */

function stripMarkup(scelti, attiva) {
  return scelti
    .map(
      (tipo) => `<button type="button" class="dm-it-tab" data-dm-it-tab="${esc(tipo)}"
        aria-pressed="${tipo === attiva}"${tipo === attiva ? ' data-on="true"' : ""}>
        <span class="dm-it-tab-ic" aria-hidden="true">${ICONE[tipo] || ""}</span>
        <span>${esc(t(...ETICHETTE_TERMICHE[tipo]))}</span>
      </button>`,
    )
    .join("");
}

const ICONE = Object.freeze({
  solare:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.4M12 19v2.4M21.4 12H19M5 12H2.6M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3"/></svg>',
  scaldabagno:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.8" width="10" height="16.4" rx="5"/><path d="M9.4 12.6h5.2"/><path d="M9.2 21.2v1.2M14.8 21.2v1.2"/><path d="M12 6.2v3"/></svg>',
  caldaia:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.4" y="3.4" width="17.2" height="13.2" rx="2.6"/><path d="M7.4 20.4v-3.8M16.6 20.4v-3.8"/><path d="M12 7.2c1.5 1.5 2.2 2.7 2.2 3.8a2.2 2.2 0 0 1-4.4 0c0-.7.3-1.3.8-1.9.1.7.5 1.1 1 1.2-.2-1.1 0-2.2.4-3.1Z"/></svg>',
});

/* ── le due scene nuove ────────────────────────────────────────────────── */

/* Una targhetta: le stesse dei numeri del solare — fondo scuro, cifre grandi,
 * etichetta piccola sopra — perche' e' cosi' che questa pagina dice i numeri e
 * inventarne un'altra forma vorrebbe dire due lingue nella stessa stanza. */
function targhetta(etichetta, valore, unita, colore, extra = "") {
  return `<div class="dm-it-plate"${extra}>
    <span class="dm-it-plate-lbl">${esc(etichetta)}</span>
    <b class="dm-it-plate-val" style="color:${colore}">${esc(valore)}<i>${esc(unita)}</i></b>
  </div>`;
}

const NUMERO = (valore, cifre = 1) =>
  valore == null ? "--" : formatNumber(valore, cifre);

function scenaScaldabagno(letture) {
  if (!letture.length)
    return `<div class="dm-it-vuoto">${esc(
      t(
        "Nessuno scaldabagno configurato: aggiungilo dalla scheda Solare della configurazione.",
        "No water heater configured: add one from the Solar tab in settings.",
      ),
    )}</div>`;
  const unita = letture[0];
  /* Il livello dell'acqua calda nel serbatoio: e' la stessa quota della
   * tessera in Home, e disegnarla qui col riempimento e' il modo piu' diretto
   * di dire «quanto manca» senza scrivere una percentuale. */
  const quota = unita.quota == null ? 0 : Math.round(unita.quota * 100);
  const acceso = unita.acceso === true;
  const comando = clean(unita.comandabile);
  return `<div class="dm-it-scena" data-dm-it-scena="scaldabagno" data-acceso="${acceso}">
    <svg class="dm-it-tubi" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <path class="dm-it-tubo" d="M 548 244 L 640 244 L 700 214 L 700 58"/>
      <path class="dm-it-tubo-int" d="M 548 244 L 640 244 L 700 214 L 700 58"/>
      <path class="dm-it-flusso dm-it-flusso-caldo" d="M 548 244 L 640 244 L 700 214 L 700 58"/>
      <path class="dm-it-tubo" d="M 486 386 L 400 386 L 340 416 L 340 552"/>
      <path class="dm-it-tubo-int" d="M 486 386 L 400 386 L 340 416 L 340 552"/>
      <path class="dm-it-flusso dm-it-flusso-freddo" d="M 340 552 L 340 416 L 400 386 L 486 386"/>
    </svg>

    <div class="dm-it-nodo" style="left:52%;top:52%">
      <div class="dm-it-tank">
        <span class="dm-it-tank-cap" aria-hidden="true"></span>
        <span class="dm-it-tank-acqua" style="height:${quota}%"></span>
        <span class="dm-it-tank-vetro" aria-hidden="true"></span>
        <span class="dm-it-resistenza" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="dm-it-tank-base" aria-hidden="true"></span>
      </div>
      <span class="dm-it-nome">${esc(unita.name || t("Scaldabagno", "Water heater"))}</span>
    </div>

    <div class="dm-it-nodo dm-it-nodo-plate" style="left:16%;top:28%">
      ${targhetta(t("Acqua adesso", "Water now"), NUMERO(unita.temperatura), "°C", "#f97316")}
    </div>
    <div class="dm-it-nodo dm-it-nodo-plate" style="left:16%;top:64%">
      ${targhetta(t("Obiettivo", "Target"), NUMERO(unita.obiettivo), "°C", "#38bdf8")}
    </div>
    <div class="dm-it-nodo dm-it-nodo-plate" style="left:85%;top:28%">
      ${targhetta(t("Consumo", "Power"), NUMERO(unita.potenza, 0), " W", "#a78bfa")}
    </div>
    <div class="dm-it-nodo dm-it-nodo-plate" style="left:85%;top:64%">
      ${targhetta(t("Oggi", "Today"), NUMERO(unita.energia), " kWh", "#34d399")}
    </div>

    <div class="dm-it-nodo" style="left:52%;top:88%">
      ${
        comando && siComanda(comando)
          ? `<button type="button" class="dm-it-interruttore" data-dm-it-toggle="${esc(comando)}"
              data-on="${acceso}" aria-pressed="${acceso}">
              <span class="dm-it-interruttore-ic" aria-hidden="true">⏻</span>
              <span>${esc(acceso ? t("Resistenza accesa", "Element on") : t("Resistenza spenta", "Element off"))}</span>
            </button>`
          : `<span class="dm-it-etichetta" data-on="${acceso}">${esc(
              acceso ? t("Resistenza accesa", "Element on") : t("Resistenza spenta", "Element off"),
            )}</span>`
      }
    </div>
  </div>`;
}

function scenaCaldaia(lettura) {
  const acceso = lettura.acceso === true || lettura.fiamma === true;
  const pressione = verdettoPressione(lettura.pressione);
  const salto = lettura.salto;
  return `<div class="dm-it-scena" data-dm-it-scena="caldaia" data-acceso="${acceso}"
      data-fiamma="${lettura.fiamma === true}">
    <svg class="dm-it-tubi" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <path class="dm-it-tubo" d="M 300 296 L 640 296 L 720 336 L 800 336"/>
      <path class="dm-it-tubo-int" d="M 300 296 L 640 296 L 720 336 L 800 336"/>
      <path class="dm-it-flusso dm-it-flusso-caldo" d="M 300 296 L 640 296 L 720 336 L 800 336"/>
      <path class="dm-it-tubo" d="M 300 384 L 660 384 L 700 364 L 800 364"/>
      <path class="dm-it-tubo-int" d="M 300 384 L 660 384 L 700 364 L 800 364"/>
      <path class="dm-it-flusso dm-it-flusso-freddo" d="M 800 364 L 700 364 L 660 384 L 300 384"/>
    </svg>

    <div class="dm-it-nodo" style="left:26%;top:48%">
      <div class="dm-it-caldaia">
        <span class="dm-it-caldaia-testa" aria-hidden="true"></span>
        <span class="dm-it-oblo" aria-hidden="true"><i class="dm-it-fiamma"></i></span>
        <span class="dm-it-caldaia-display" aria-hidden="true">
          <b>${esc(NUMERO(lettura.mandata, 0))}</b>
        </span>
        <span class="dm-it-caldaia-piede" aria-hidden="true"></span>
      </div>
      <span class="dm-it-nome">${esc(lettura.name || t("Caldaia", "Boiler"))}</span>
    </div>

    <div class="dm-it-nodo" style="left:84%;top:59%">
      <div class="dm-it-radiatore" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <span class="dm-it-nome">${esc(t("Impianto", "Circuit"))}</span>
    </div>

    <div class="dm-it-nodo dm-it-nodo-plate" style="left:64%;top:20%">
      ${targhetta(t("Mandata", "Flow"), NUMERO(lettura.mandata), "°C", "#f43f5e")}
    </div>
    <div class="dm-it-nodo dm-it-nodo-plate" style="left:64%;top:80%">
      ${targhetta(t("Ritorno", "Return"), NUMERO(lettura.ritorno), "°C", "#38bdf8")}
    </div>
    <div class="dm-it-nodo dm-it-nodo-plate" style="left:26%;top:14%">
      ${targhetta(
        t("Pressione", "Pressure"),
        NUMERO(lettura.pressione),
        " bar",
        pressione === "bassa" ? "#f43f5e" : pressione === "alta" ? "#f59e0b" : "#34d399",
        pressione ? ` data-dm-it-pressione="${pressione}"` : "",
      )}
    </div>
    <div class="dm-it-nodo dm-it-nodo-plate" style="left:26%;top:84%">
      ${targhetta(t("Acqua calda", "Hot water"), NUMERO(lettura.acquaCalda), "°C", "#fb923c")}
    </div>

    ${
      salto == null
        ? ""
        : `<div class="dm-it-nodo" style="left:57%;top:41%">
            <span class="dm-it-salto" data-cede="${salto >= 3}">
              ${esc(t("Salto", "Delta"))} <b>${esc(NUMERO(salto))}°</b>
            </span>
          </div>`
    }

    ${
      pressione === "bassa"
        ? `<div class="dm-it-allarme">${esc(
            t(
              "Pressione sotto il minimo: la caldaia puo' bloccarsi.",
              "Pressure below minimum: the boiler may lock out.",
            ),
          )}</div>`
        : ""
    }
  </div>`;
}

/* ── il disegno della pagina ───────────────────────────────────────────── */

function pagina() {
  return doc?.getElementById(PAGINA) || null;
}

function contenitore(page) {
  return page.querySelector(".boiler-dashboard") || page;
}

/* Il guscio della scena legacy: si accende solo quando la linguetta aperta e'
 * quella del solare, e non si tocca in nessun altro modo. */
function scenaLegacy(page) {
  return page.querySelector(".synoptic-stage");
}

export function renderImpiantiTermici() {
  const page = pagina();
  if (!page) return false;
  const scelti = impiantiDiCasa();
  const attiva = tabAttiva(scelti, state.tab);
  state.tab = attiva;

  const box = contenitore(page);
  const states = allStates();
  const resolve = root.resolveEntity || ((value) => value);

  /* La firma tiene fuori i ridisegni inutili: questa passata gira a ogni
   * evento di stato, e rifare il markup a ogni giro butterebbe via le
   * transizioni delle scene a meta' corsa. */
  const letture =
    attiva === "scaldabagno"
      ? lettureScaldabagni(readJson(SCALDABAGNI_KEY, []), states, resolve)
      : [];
  const caldaia = attiva === "caldaia" ? letturaCaldaia(readJson(CHIAVE_CALDAIA, {}), states, resolve) : null;
  const firma = JSON.stringify([scelti, attiva, letture, caldaia]);
  if (firma === state.firma) return true;
  state.firma = firma;

  /* ── la fila delle linguette ── */
  const testata = page.querySelector(".boiler-header") || box;
  let strip = box.querySelector(":scope > .dm-it-strip");
  if (servonoLinguette(scelti)) {
    if (!strip) {
      strip = doc.createElement("div");
      strip.className = "dm-it-strip";
      testata.after(strip);
    }
    const nuovo = stripMarkup(scelti, attiva);
    if (strip.innerHTML !== nuovo) {
      strip.innerHTML = nuovo;
      /* La prima volta che compaiono le linguette il titolo va gia' allineato
       * alla macchina aperta, non a quella della tabella. */
      try {
        renderPageMastheads();
      } catch (_error) {}
    }
  } else if (strip) {
    strip.remove();
  }

  /* ── le scene ──
   *
   * Quando si guarda una macchina che non e' il solare, tutto quello che la
   * pagina disegna per il solare esce di scena: non solo il sinottico, ma
   * anche la fascia dello stato in testata, la riga delle misure (ΔT solare,
   * pressione del circuito primario) e la griglia dei nove comandi. Sono
   * numeri e tasti di un impianto che in quel momento non si sta guardando, e
   * lasciarli sotto una caldaia vorrebbe dire attribuirle cose che non ha. */
  const altrove = Boolean(attiva) && attiva !== "solare";
  if (page.dataset.dmItAltrove !== String(altrove)) page.dataset.dmItAltrove = String(altrove);
  const legacy = scenaLegacy(page);
  if (legacy) legacy.hidden = altrove;

  let mia = box.querySelector(":scope > .dm-it-stage");
  if (attiva && attiva !== "solare") {
    if (!mia) {
      mia = doc.createElement("div");
      mia.className = "dm-it-stage";
      if (legacy) legacy.after(mia);
      else box.append(mia);
    }
    mia.hidden = false;
    const markup = attiva === "caldaia" ? scenaCaldaia(caldaia) : scenaScaldabagno(letture);
    if (mia.dataset.dmItTipo !== attiva || mia.innerHTML !== markup) {
      mia.dataset.dmItTipo = attiva;
      mia.innerHTML = markup;
    }
  } else if (mia) {
    mia.hidden = true;
  }
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        renderImpiantiTermici();
      } catch (error) {
        root.console?.warn?.("[DashboardModern] impianti termici", error);
      }
    }) || 0;
}

function onClick(event) {
  const tab = event.target?.closest?.("[data-dm-it-tab]");
  if (tab) {
    event.preventDefault();
    state.tab = clean(tab.dataset.dmItTab);
    /* La firma si azzera a mano: cambiando linguetta cambia tutto, e il
     * confronto di prima direbbe «uguale» finche' non cambia uno stato. */
    state.firma = "";
    renderImpiantiTermici();
    /* E l'intestazione va rifatta subito: il nome della pagina e' cambiato, e
     * lei si ridisegna sui suoi eventi — nessuno dei quali e' un tocco su una
     * linguetta che non esisteva quando li ha scelti. */
    try {
      renderPageMastheads();
    } catch (_error) {}
    return;
  }
  const toggle = event.target?.closest?.("[data-dm-it-toggle]");
  if (toggle) {
    event.preventDefault();
    const entity = clean(toggle.dataset.dmItToggle);
    if (!entity) return;
    /* Lo stesso gesto della tessera in Home: si chiama il servizio che la
     * plancia chiama gia', non uno nuovo. */
    try {
      root.toggle?.(entity) ?? root.cdToggleEntity?.(entity);
    } catch (_error) {}
    state.firma = "";
    root.setTimeout?.(() => renderImpiantiTermici(), 400);
  }
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
    /* ── la fila delle linguette ────────────────────────────────────────
     * Stessa forma del selettore Freddo/Caldo della pagina Clima: chi usa la
     * plancia quel gesto lo conosce gia', e imparare due volte la stessa cosa
     * e' una cosa in piu' da imparare. */
    #${PAGINA} .dm-it-strip{
      display:flex;gap:6px;padding:6px;margin:0 0 20px;border-radius:18px;
      background:var(--bg-sculpted,#f0f4f8);border:1px solid var(--card-border,#e2e8f0)}
    #${PAGINA} .dm-it-tab{
      flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:8px;
      padding:12px 14px;border:0;border-radius:14px;background:transparent;cursor:pointer;
      font:inherit;font-size:12.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
      color:#3d4d66;transition:background .25s ease,color .25s ease,box-shadow .25s ease}
    #${PAGINA} .dm-it-tab-ic{display:grid;place-items:center;flex:0 0 auto}
    #${PAGINA} .dm-it-tab:hover{background:rgba(255,255,255,.7)}
    #${PAGINA} .dm-it-tab[data-on="true"]{
      background:linear-gradient(135deg,#fb923c,#ea580c);color:#fff;
      box-shadow:0 8px 20px -8px rgba(234,88,12,.75)}

    /* ── il palco delle scene nuove ─────────────────────────────────────
     * Stessa misura, stesso raggio e stessa ombra del palco del solare: sono
     * la stessa stanza vista da tre porte. */
    #${PAGINA} .dm-it-stage{
      position:relative;width:100%;height:600px;margin-bottom:20px;overflow:hidden;
      border-radius:32px;border:1px solid var(--card-border,#e2e8f0);
      background:
        radial-gradient(120% 90% at 88% 6%,rgba(251,146,60,.16),transparent 58%),
        radial-gradient(90% 80% at 6% 96%,rgba(56,189,248,.14),transparent 60%),
        var(--card-bg,#fff);
      box-shadow:inset 0 0 35px rgba(0,0,0,.03),var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    #${PAGINA} .dm-it-stage[hidden]{display:none!important}
    /* Fuori dal solare esce di scena tutto quello che il solare si porta
       dietro: la fascia dello stato, le sue misure, i suoi nove comandi. */
    #${PAGINA}[data-dm-it-altrove="true"] .synoptic-stage,
    #${PAGINA}[data-dm-it-altrove="true"] .boiler-stats-row,
    #${PAGINA}[data-dm-it-altrove="true"] .b-controls-grid,
    #${PAGINA}[data-dm-it-altrove="true"] .dm-st-live{display:none!important}
    #${PAGINA} .dm-it-scena{position:absolute;inset:0}
    #${PAGINA} .dm-it-vuoto{
      position:absolute;inset:0;display:grid;place-items:center;padding:40px;text-align:center;
      color:var(--text-dim,#64748b);font-size:14px;font-weight:700}

    /* I tubi: fondo spesso e anima chiara, come quelli del solare. */
    #${PAGINA} .dm-it-tubi{position:absolute;inset:0;width:100%;height:100%}
    #${PAGINA} .dm-it-tubo{fill:none;stroke:#e2e8f0;stroke-width:22;stroke-linecap:round;stroke-linejoin:round}
    #${PAGINA} .dm-it-tubo-int{fill:none;stroke:#f8fafc;stroke-width:14;stroke-linecap:round;stroke-linejoin:round}
    #${PAGINA} .dm-it-flusso{
      fill:none;stroke-width:9;stroke-linecap:round;opacity:0;
      stroke-dasharray:26 210;transition:opacity .5s ease}
    #${PAGINA} .dm-it-flusso-caldo{stroke:#f43f5e}
    #${PAGINA} .dm-it-flusso-freddo{stroke:#3b82f6}
    /* La cometa scorre solo quando la macchina lavora: un tubo che pulsa su un
       impianto fermo direbbe una cosa che non sta succedendo. */
    #${PAGINA} .dm-it-scena[data-acceso="true"] .dm-it-flusso{
      opacity:.9;animation:dmItCometa 2.6s linear infinite}
    @keyframes dmItCometa{from{stroke-dashoffset:236}to{stroke-dashoffset:0}}

    #${PAGINA} .dm-it-nodo{
      position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;
      align-items:center;gap:10px;z-index:4}
    #${PAGINA} .dm-it-nome{
      font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
      color:var(--text-dim,#64748b);background:rgba(255,255,255,.95);padding:5px 12px;
      border-radius:12px;box-shadow:0 5px 12px rgba(0,0,0,.06);white-space:nowrap}

    /* Le targhette: le stesse dei numeri del solare. */
    #${PAGINA} .dm-it-plate{
      display:grid;gap:2px;padding:10px 16px;border-radius:14px;min-width:112px;
      background:linear-gradient(160deg,#1e293b,#0b1220);
      box-shadow:0 14px 30px -14px rgba(15,23,42,.8),inset 0 1px 0 rgba(255,255,255,.09)}
    #${PAGINA} .dm-it-plate-lbl{
      font-size:9.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8}
    #${PAGINA} .dm-it-plate-val{
      font-family:'Oswald',sans-serif;font-size:27px;font-weight:500;line-height:1;
      font-variant-numeric:tabular-nums}
    #${PAGINA} .dm-it-plate-val i{font-style:normal;font-size:.52em;margin-left:2px;opacity:.85}
    #${PAGINA} .dm-it-plate[data-dm-it-pressione="bassa"]{
      box-shadow:0 14px 30px -14px rgba(244,63,94,.8),inset 0 0 0 1.5px rgba(244,63,94,.55);
      animation:dmItBattito 2.4s ease-in-out infinite}
    @keyframes dmItBattito{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}

    /* ── lo scaldabagno: il serbatoio in piedi ──────────────────────────
     * L'acqua calda sale dal fondo, e l'altezza del riempimento e' quanto
     * manca all'obiettivo: la stessa quota dell'anello in Home, disegnata
     * invece che scritta. */
    #${PAGINA} .dm-it-tank{
      position:relative;width:132px;height:216px;border-radius:58px/34px;overflow:hidden;
      background:linear-gradient(100deg,#f8fafc,#dbe3ec 46%,#9aa9bb);
      box-shadow:0 26px 46px -22px rgba(15,23,42,.55),inset 0 0 0 1px rgba(148,163,184,.55)}
    #${PAGINA} .dm-it-tank-acqua{
      position:absolute;left:0;right:0;bottom:0;
      background:linear-gradient(to top,#ea580c,#fb923c 62%,#fbbf24);
      opacity:.92;transition:height 1.4s cubic-bezier(.16,1,.3,1)}
    #${PAGINA} .dm-it-tank-vetro{
      position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(105deg,rgba(255,255,255,.72) 0 16%,rgba(255,255,255,0) 34%,
        rgba(255,255,255,0) 74%,rgba(15,23,42,.14) 100%)}
    #${PAGINA} .dm-it-tank-cap{
      position:absolute;top:0;left:0;right:0;height:26px;border-radius:58px/26px;
      background:linear-gradient(180deg,#f1f5f9,#cbd5e1);box-shadow:inset 0 -2px 4px rgba(15,23,42,.14)}
    #${PAGINA} .dm-it-tank-base{
      position:absolute;bottom:0;left:0;right:0;height:18px;
      background:linear-gradient(180deg,rgba(15,23,42,.16),rgba(15,23,42,.32))}
    /* La resistenza: tre spire che si accendono quando lavora. */
    #${PAGINA} .dm-it-resistenza{
      position:absolute;left:22px;right:22px;bottom:46px;display:grid;gap:7px}
    #${PAGINA} .dm-it-resistenza i{
      display:block;height:5px;border-radius:3px;background:rgba(15,23,42,.32);
      transition:background .6s ease,box-shadow .6s ease}
    #${PAGINA} .dm-it-scena[data-acceso="true"] .dm-it-resistenza i{
      background:#fde68a;box-shadow:0 0 14px 3px rgba(251,191,36,.8)}

    /* ── la caldaia: la scocca a muro, l'oblo' e la fiamma ─────────────── */
    #${PAGINA} .dm-it-caldaia{
      position:relative;width:186px;height:196px;border-radius:20px;
      background:linear-gradient(150deg,#ffffff,#e2e8f0 58%,#c3ccd8);
      box-shadow:0 28px 50px -24px rgba(15,23,42,.55),inset 0 0 0 1px rgba(148,163,184,.5)}
    #${PAGINA} .dm-it-caldaia-testa{
      position:absolute;top:14px;left:16px;right:16px;height:34px;border-radius:11px;
      background:linear-gradient(180deg,#f8fafc,#dbe3ec);box-shadow:inset 0 -2px 4px rgba(15,23,42,.1)}
    #${PAGINA} .dm-it-caldaia-display{
      position:absolute;top:20px;right:26px;padding:3px 9px;border-radius:7px;
      background:#0b1220;color:#38bdf8;font-family:'Oswald',sans-serif;font-size:15px;
      font-variant-numeric:tabular-nums;line-height:1.4}
    #${PAGINA} .dm-it-oblo{
      position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);
      width:96px;height:82px;border-radius:14px;display:grid;place-items:end center;
      background:radial-gradient(120% 120% at 50% 120%,#1f2937,#0b1220);
      box-shadow:inset 0 0 0 3px rgba(148,163,184,.5),inset 0 8px 18px rgba(0,0,0,.6);
      overflow:hidden}
    #${PAGINA} .dm-it-fiamma{
      display:block;width:34px;height:0;margin-bottom:12px;border-radius:50% 50% 44% 44%;
      background:linear-gradient(to top,#f59e0b,#fb923c 46%,#fde68a);
      opacity:0;transition:height .7s ease,opacity .7s ease}
    #${PAGINA} .dm-it-scena[data-fiamma="true"] .dm-it-fiamma{
      height:46px;opacity:1;animation:dmItFiamma 1.5s ease-in-out infinite;
      box-shadow:0 0 26px 8px rgba(251,146,60,.55)}
    @keyframes dmItFiamma{
      0%,100%{transform:scaleY(1) scaleX(1)}50%{transform:scaleY(1.16) scaleX(.92)}}
    #${PAGINA} .dm-it-caldaia-piede{
      position:absolute;bottom:-10px;left:26px;right:26px;height:10px;border-radius:0 0 8px 8px;
      background:linear-gradient(180deg,#cbd5e1,#94a3b8)}

    /* Il radiatore in fondo al circuito: dice dove va a finire il calore. */
    #${PAGINA} .dm-it-radiatore{
      display:flex;gap:5px;padding:12px 11px;border-radius:12px;
      background:linear-gradient(150deg,#f8fafc,#dbe3ec);
      box-shadow:0 18px 34px -18px rgba(15,23,42,.5),inset 0 0 0 1px rgba(148,163,184,.45)}
    #${PAGINA} .dm-it-radiatore i{
      display:block;width:11px;height:74px;border-radius:6px;
      background:linear-gradient(180deg,#e2e8f0,#b6c2d2);transition:background .8s ease}
    #${PAGINA} .dm-it-scena[data-acceso="true"] .dm-it-radiatore i{
      background:linear-gradient(180deg,#fdba74,#f97316)}

    #${PAGINA} .dm-it-salto{
      padding:7px 14px;border-radius:999px;font-size:11.5px;font-weight:800;letter-spacing:.06em;
      text-transform:uppercase;color:#64748b;background:rgba(255,255,255,.96);
      box-shadow:0 8px 20px -10px rgba(15,23,42,.5),inset 0 0 0 1px rgba(148,163,184,.35)}
    #${PAGINA} .dm-it-salto b{font-family:'Oswald',sans-serif;font-size:15px;margin-left:4px}
    #${PAGINA} .dm-it-salto[data-cede="true"]{color:#c2410c;background:#fff7ed;
      box-shadow:0 8px 20px -10px rgba(234,88,12,.55),inset 0 0 0 1px rgba(251,146,60,.5)}

    #${PAGINA} .dm-it-allarme{
      position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:6;
      padding:9px 16px;border-radius:12px;background:#fef2f2;color:#b91c1c;
      font-size:12.5px;font-weight:800;box-shadow:0 10px 24px -12px rgba(185,28,28,.7)}

    #${PAGINA} .dm-it-interruttore{
      display:inline-flex;align-items:center;gap:9px;padding:11px 18px;border-radius:999px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);cursor:pointer;
      font:inherit;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
      color:#3d4d66;box-shadow:0 10px 24px -14px rgba(15,23,42,.6);
      transition:background .3s ease,color .3s ease,box-shadow .3s ease}
    #${PAGINA} .dm-it-interruttore[data-on="true"]{
      background:linear-gradient(135deg,#fb923c,#ea580c);color:#fff;border-color:transparent;
      box-shadow:0 12px 26px -12px rgba(234,88,12,.8)}
    #${PAGINA} .dm-it-etichetta{
      padding:8px 15px;border-radius:999px;background:rgba(255,255,255,.95);
      font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b;
      box-shadow:0 8px 20px -12px rgba(15,23,42,.5)}
    #${PAGINA} .dm-it-etichetta[data-on="true"]{color:#c2410c}

    /* ── tema scuro ─────────────────────────────────────────────────────── */
    html[data-theme="dark"] #${PAGINA} .dm-it-tubo{stroke:#26324b}
    html[data-theme="dark"] #${PAGINA} .dm-it-tubo-int{stroke:#141d31}
    html[data-theme="dark"] #${PAGINA} .dm-it-nome,
    html[data-theme="dark"] #${PAGINA} .dm-it-etichetta,
    html[data-theme="dark"] #${PAGINA} .dm-it-salto{
      background:rgba(20,29,49,.95);color:#93a5c0}
    html[data-theme="dark"] #${PAGINA} .dm-it-tab{color:#b9c7dc}
    html[data-theme="dark"] #${PAGINA} .dm-it-strip{background:#0c1322;border-color:#26324b}

    /* ── telefono: il palco si accorcia e le targhette rientrano ────────── */
    @media (max-width:768px){
      #${PAGINA} .dm-it-stage{height:470px;border-radius:24px}
      #${PAGINA} .dm-it-tank{width:104px;height:168px}
      #${PAGINA} .dm-it-caldaia{width:146px;height:158px}
      #${PAGINA} .dm-it-plate{min-width:88px;padding:8px 12px}
      #${PAGINA} .dm-it-plate-val{font-size:21px}
      #${PAGINA} .dm-it-radiatore i{height:54px;width:8px}
      #${PAGINA} .dm-it-tab{font-size:11px;padding:10px 8px;letter-spacing:.04em}
      #${PAGINA} .dm-it-tab span:last-child{display:none}
      #${PAGINA} .dm-it-tab-ic{transform:scale(1.25)}
    }
    @media (prefers-reduced-motion:reduce){
      #${PAGINA} .dm-it-flusso,#${PAGINA} .dm-it-fiamma,#${PAGINA} .dm-it-plate{animation:none!important}
    }
    `,
  );
}

export function installImpiantiTermiciSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* Il nome della pagina lo scrive l'intestazione, che resta il suo padrone:
   * qui le si dice soltanto quale macchina si sta guardando adesso. */
  registraTitoloDiPagina(PAGINA, () => {
    const attiva = tabAttiva(impiantiDiCasa(), state.tab);
    if (!attiva) return null;
    return {
      title: t(...TITOLI_TERMICI[attiva]),
      subtitle: t(...BRICIOLE_TERMICHE[attiva]),
    };
  });
  doc.addEventListener("click", onClick);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    "pageshow",
  ]) {
    root.addEventListener?.(evento, schedule);
  }
  /* Il cambio pagina passa da un tasto della barra: quando si entra qui la
   * scena va disegnata, e nessun evento di stato lo annuncia. */
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-tab],[data-page],.tab")) root.setTimeout?.(schedule, 0);
    },
    true,
  );
  schedule();
  return true;
}

installImpiantiTermiciSection();
