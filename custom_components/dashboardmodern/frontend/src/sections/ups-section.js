/* La pagina del gruppo di continuita' (#256).
 *
 * «Chiedo se c'e' la possibilita' di gestire un UPS: vedere se c'e' tensione o
 * no, lo stato della batteria e il carico.»
 *
 * Una tessera in Home dice come sta adesso; ma un UPS e' una macchina della
 * casa come la caldaia o l'auto, e ognuna di quelle ha la sua pagina. Qui c'e'
 * il quadro intero, disegnato: la rete che entra da sinistra, la scatola nel
 * mezzo con dentro la batteria, e a destra quello che sta tenendo acceso. Le
 * frecce corrono nel verso in cui la corrente sta andando davvero — dalla rete
 * quando c'e', dalla batteria quando manca — e quel verso e' l'unica cosa che
 * di un UPS si vuole capire in un colpo d'occhio.
 *
 * Il linguaggio e' quello delle altre scene: assonometria, condotti con
 * l'anima chiara, targhette scure coi numeri. Non e' un vezzo — e' che due
 * lingue nella stessa plancia si leggono come due applicazioni.
 *
 * La voce nella barra compare solo quando un UPS e' configurato: portare a una
 * pagina vuota e' peggio che non offrirla. Qui non si scrive niente in Home
 * Assistant: si legge e si disegna.
 */
import {
  BATTERIA_BASSA,
  CHIAVE_UPS,
  daQuandoUps,
  entitaDellUps,
  letturaUps,
} from "../core/ups-model.js";
import { daQuanto } from "../core/racconto-tessera.js";
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

const KEY = "__DASHBOARDMODERN_UPS_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const UPS_PAGE_ID = "page-ups";
export const UPS_TAB = "ups";

/* ── cosa c'e' da guardare ────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_UPS, {});
}

/** Se un UPS e' stato dichiarato: senza, la pagina non ha niente da dire. */
export function upsConfigurato() {
  return entitaDellUps(configurazione()).length > 0;
}

function lettura() {
  return letturaUps(configurazione(), allStates(), root.resolveEntity || ((value) => value));
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureUpsPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(UPS_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = UPS_PAGE_ID;
  pagina.innerHTML = `<div class="dm-ups-wrap" id="ups-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureUpsTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${UPS_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto a Energia: un gruppo di continuita' e' la corrente di casa, e chi
   * lo cerca lo cerca dove cerca i consumi. */
  const dopo = barra.querySelector('.tab[data-tab="energy"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = UPS_TAB;
  voce.id = `tab-${UPS_TAB}`;
  voce.innerHTML = `<span class="icon">🔌</span><span class="text">${esc(t("Continuità", "Backup power"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da se'.
   * Fa la stessa identica cosa, perche' due modi di cambiare pagina sarebbero
   * due pagine attive quando non tornano. */
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureUpsPage()?.classList.add("active");
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

/* Quando la voce si vede, e chi lo decide.
 *
 * `cdApplyNavVis` del guscio scorre una mappa sua e, per ogni voce che ci
 * trova, o scrive `display:none` o TOGLIE la riga di stile — «questa sezione
 * e' accesa». Insegnargli anche la nostra vorrebbe dire due padroni sulla
 * stessa dichiarazione: lui la cancella ogni tre secondi, noi la riscriviamo
 * al giro dopo, e nel mezzo la voce lampeggia. Percio' non gliela si insegna:
 * questa voce l'abbiamo creata noi e la governiamo noi, leggendo la stessa
 * configurazione che legge lui.
 *
 * Due ragioni per nasconderla, e bastano da sole: la sezione spenta a mano —
 * che e' una scelta di chi guarda — e l'UPS non configurato, che e' una
 * pagina senza niente da dire. Portarci in quel caso vorrebbe dire aprire una
 * stanza vuota. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[UPS_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureUpsTab();
  if (!voce) return;
  const serve = upsConfigurato() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  /* Se la pagina era aperta e l'UPS e' stato tolto, si torna in Home: restare
   * su una pagina che non c'e' piu' e' peggio che cambiarla sotto le dita. */
  const pagina = doc.getElementById(UPS_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── la scena ─────────────────────────────────────────────────────────── */

const NUMERO = (valore, cifre = 1) => formatNumber(valore, cifre);

/* Dove sta ogni cosa sul palco.
 *
 * Le coordinate stanno qui e non dentro il disegno: chi sposta una targhetta
 * la sposta in un posto solo, e il disegno resta la forma della scena invece
 * di essere anche il suo righello. */
const POSTI = Object.freeze({
  rete: "left:12%;top:50%",
  scatola: "left:50%;top:50%",
  casa: "left:88%;top:50%",
  carico: "left:50%;top:12%",
  autonomia: "left:50%;top:88%",
  tensione: "left:14%;top:18%",
  potenza: "left:86%;top:18%",
  temperatura: "left:86%;top:82%",
  verdetto: "left:14%;top:82%",
});

/* Una targhetta senza numero non si disegna: chi non ha mappato la potenza non
 * deve trovarsi un «--» al posto suo, che e' una promessa non mantenuta. */
function targhetta(posizione, etichetta, valore, unita, colore, cifre = 1) {
  if (valore == null) return "";
  return `<div class="dm-ups-nodo dm-ups-nodo-plate" style="${posizione}">
    <div class="dm-ups-plate">
      <span class="dm-ups-plate-lbl">${esc(etichetta)}</span>
      <b class="dm-ups-plate-val" style="color:${colore}">${esc(NUMERO(valore, cifre))}<i>${esc(unita)}</i></b>
    </div>
  </div>`;
}

/* Quanto della cella si disegna pieno.
 *
 * Chi non ha mappato la carica non ha un livello da mostrare: la cella si
 * riempie tutta e parla il colore — verde a rete presente, ambra a batteria.
 * Disegnarla vuota direbbe «non c'e' riserva», che e' un'affermazione e non
 * un'assenza di dati. */
function quotaBatteria(dato) {
  if (dato.batteria == null) return 100;
  return Math.max(4, Math.min(100, Math.round(dato.batteria)));
}

function scena(dato, da) {
  const rete = dato.rete === true;
  const buio = dato.rete === false;
  const quota = quotaBatteria(dato);
  const conCarica = dato.batteria != null;
  const bassa = dato.batteria != null && dato.batteria < BATTERIA_BASSA;
  return `<div class="dm-ups-scena" data-rete="${rete}" data-buio="${buio}"
      data-carica="${conCarica}" data-bassa="${bassa}">
    <svg class="dm-ups-cavi" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
      <path class="dm-ups-cavo" d="M 176 300 L 420 300"/>
      <path class="dm-ups-cavo-int" d="M 176 300 L 420 300"/>
      <path class="dm-ups-corrente dm-ups-corrente-rete" d="M 176 300 L 420 300"/>
      <path class="dm-ups-cavo" d="M 580 300 L 828 300"/>
      <path class="dm-ups-cavo-int" d="M 580 300 L 828 300"/>
      <path class="dm-ups-corrente dm-ups-corrente-uscita" d="M 580 300 L 828 300"/>
    </svg>

    <div class="dm-ups-nodo" style="${POSTI.rete}">
      <div class="dm-ups-traliccio" aria-hidden="true">
        <svg viewBox="0 0 120 180" class="dm-ups-pilone">
          <g class="dm-ups-pilone-tratti">
            <path d="M18 178 L44 22 M102 178 L76 22"/>
            <path d="M44 22 h32"/>
            <path d="M30 130 h60 M35 96 h50 M40 62 h40"/>
            <path d="M30 130 L60 96 L90 130 M35 96 L60 62 L85 96 M40 62 L60 34 L80 62"/>
            <path d="M8 40 h104 M16 62 h88"/>
          </g>
          <g class="dm-ups-pilone-isolatori">
            <circle cx="8" cy="40" r="5"/><circle cx="112" cy="40" r="5"/><circle cx="60" cy="18" r="5"/>
          </g>
        </svg>
        <span class="dm-ups-taglio">✕</span>
      </div>
      <span class="dm-ups-nome">${esc(t("Rete elettrica", "Mains power"))}</span>
    </div>

    <div class="dm-ups-nodo dm-ups-nodo-box" style="${POSTI.scatola}">
      <div class="dm-ups-box" aria-hidden="true">
        <span class="dm-ups-lcd">
          <span class="dm-ups-cella"><i style="height:${quota}%"></i></span>
          ${conCarica ? `<b>${esc(NUMERO(dato.batteria, 0))}<em>%</em></b>` : ""}
        </span>
        <span class="dm-ups-spie">
          <i class="dm-ups-spia-rete"></i>
          <i class="dm-ups-spia-batt"></i>
        </span>
        <span class="dm-ups-prese"><i></i><i></i><i></i></span>
      </div>
      <span class="dm-ups-nome">${esc(clean(dato.name) || t("Continuità", "Backup power"))}</span>
    </div>

    <div class="dm-ups-nodo" style="${POSTI.casa}">
      <div class="dm-ups-casa" aria-hidden="true">
        <span class="dm-ups-tetto"></span>
        <span class="dm-ups-muro"><i></i><i></i></span>
      </div>
      <span class="dm-ups-nome">${esc(t("Sotto protezione", "Protected load"))}</span>
    </div>

    ${targhetta(POSTI.carico, t("Carico", "Load"), dato.carico, "%", "#38bdf8", 0)}
    ${targhetta(
      POSTI.autonomia,
      t("Autonomia residua", "Runtime left"),
      dato.autonomia,
      " min",
      buio ? "#f43f5e" : "#34d399",
      0,
    )}
    ${targhetta(POSTI.tensione, t("Tensione", "Voltage"), dato.tensione, " V", "#a78bfa", 0)}
    ${targhetta(POSTI.potenza, t("Potenza", "Power"), dato.potenza, " W", "#fb923c", 0)}
    ${targhetta(POSTI.temperatura, t("Temperatura", "Temperature"), dato.temperatura, "°C", "#f59e0b")}

    <div class="dm-ups-nodo dm-ups-nodo-verdetto" style="${POSTI.verdetto}">
      <span class="dm-ups-verdetto">${esc(riassunto(dato, da))}</span>
    </div>
  </div>`;
}

/* La frase in un angolo della scena: quello che sta succedendo, in una riga. */
function riassunto(dato, da) {
  if (dato.rete === false) {
    const quando = Number.isFinite(da) ? ` ${daQuanto((Date.now() - da) / 60000, t)}` : "";
    return t(`Manca la corrente${quando}`, `Mains is out${quando}`);
  }
  if (dato.rete === true)
    return dato.scarica
      ? t("Rete presente, batteria scarica", "Mains on, battery low")
      : t("Rete presente", "Mains present");
  return t("L'UPS non risponde", "The UPS is not answering");
}

function vuotoMarkup() {
  return `<div class="dm-ups-vuoto">
    <strong>${esc(t("Nessun gruppo di continuità configurato", "No UPS configured"))}</strong>
    <span>${esc(
      t(
        "Aggiungilo dalla scheda Energia della configurazione: con il solo stato di NUT la pagina sa già dire se c'è tensione.",
        "Add it from the Energy tab in the settings: with the NUT status alone this page already knows whether there is power.",
      ),
    )}</span>
  </div>`;
}

function dipingi() {
  const pagina = ensureUpsPage();
  const dove = pagina?.querySelector?.("#ups-wrap");
  if (!dove) return;
  if (!upsConfigurato()) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      dove.innerHTML = vuotoMarkup();
    }
    return;
  }
  const dato = lettura();
  const da = daQuandoUps(configurazione(), allStates(), root.resolveEntity || ((value) => value));
  /* Si ridisegna quando cambia cio' che si vede, e mai a vuoto: il «da 14
   * minuti» si riscrive al prossimo cambio di stato, e ridipingere ogni
   * secondo per far scorrere quel numero vorrebbe dire una pagina che trema
   * sotto le dita. */
  const firma = JSON.stringify([dato, da]);
  if (state.firma === firma && dove.firstElementChild) return;
  state.firma = firma;
  dove.innerHTML = `<div class="dm-ups-stage">${scena(dato, da)}</div>`;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] ups", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderUpsSection() {
  state.firma = "";
  schedule();
}

function installStyles() {
  const P = `#${UPS_PAGE_ID}`;
  installStyle(
    "dm-ups-section-style",
    `
    ${P} .dm-ups-wrap{display:grid;gap:18px;padding:0 0 24px}
    ${P} .dm-ups-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-ups-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-ups-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* Il palco: stessa misura, stesso raggio e stessa ombra delle altre scene
       della plancia — e' la stessa stanza vista da un'altra porta. */
    ${P} .dm-ups-stage{
      position:relative;width:100%;height:600px;overflow:hidden;border-radius:32px;
      border:1px solid var(--card-border,#e2e8f0);
      background:
        radial-gradient(120% 90% at 88% 6%,rgba(56,189,248,.16),transparent 58%),
        radial-gradient(90% 80% at 6% 96%,rgba(52,211,153,.14),transparent 60%),
        var(--card-bg,#fff);
      box-shadow:inset 0 0 35px rgba(0,0,0,.03),var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    /* A corrente caduta la stanza cambia luce: non e' decorazione, e' la sola
       differenza che si deve vedere da lontano. */
    ${P} .dm-ups-stage:has(.dm-ups-scena[data-buio="true"]){
      background:
        radial-gradient(120% 90% at 88% 6%,rgba(244,63,94,.18),transparent 58%),
        radial-gradient(90% 80% at 6% 96%,rgba(251,146,60,.16),transparent 60%),
        var(--card-bg,#fff)}
    ${P} .dm-ups-scena{position:absolute;inset:0}

    /* I cavi: fondo spesso e anima chiara, come i tubi del locale caldaia. */
    ${P} .dm-ups-cavi{position:absolute;inset:0;width:100%;height:100%}
    ${P} .dm-ups-cavo{fill:none;stroke:#e2e8f0;stroke-width:20;stroke-linecap:round}
    ${P} .dm-ups-cavo-int{fill:none;stroke:#f8fafc;stroke-width:12;stroke-linecap:round}
    ${P} .dm-ups-corrente{
      fill:none;stroke-width:9;stroke-linecap:round;opacity:0;
      stroke-dasharray:26 190;transition:opacity .5s ease}
    ${P} .dm-ups-corrente-rete{stroke:#22c55e}
    ${P} .dm-ups-corrente-uscita{stroke:#38bdf8}
    /* Le frecce corrono nel verso in cui la corrente sta andando davvero: dalla
       rete quando c'e', dalla batteria quando manca. Il cavo di monte spento e'
       tutta la notizia. */
    ${P} .dm-ups-scena[data-rete="true"] .dm-ups-corrente{
      opacity:.92;animation:dmUpsFlusso 2.4s linear infinite}
    ${P} .dm-ups-scena[data-buio="true"] .dm-ups-corrente-uscita{
      stroke:#fbbf24;opacity:.95;animation:dmUpsFlusso 1.5s linear infinite}
    @keyframes dmUpsFlusso{from{stroke-dashoffset:216}to{stroke-dashoffset:0}}

    ${P} .dm-ups-nodo{
      position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;
      align-items:center;gap:10px;z-index:4}
    ${P} .dm-ups-nome{
      font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
      color:var(--text-dim,#64748b);background:rgba(255,255,255,.95);padding:5px 12px;
      border-radius:12px;box-shadow:0 5px 12px rgba(0,0,0,.06);white-space:nowrap}

    ${P} .dm-ups-plate{
      display:grid;gap:2px;padding:10px 16px;border-radius:14px;min-width:112px;
      background:linear-gradient(160deg,#1e293b,#0b1220);
      box-shadow:0 14px 30px -14px rgba(15,23,42,.8),inset 0 1px 0 rgba(255,255,255,.09)}
    ${P} .dm-ups-plate-lbl{
      font-size:9.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8}
    ${P} .dm-ups-plate-val{
      font-family:'Oswald',sans-serif;font-size:27px;font-weight:500;line-height:1;
      font-variant-numeric:tabular-nums}
    ${P} .dm-ups-plate-val i{font-style:normal;font-size:.52em;margin-left:2px;opacity:.85}

    /* ── il traliccio: la rete che entra ──────────────────────────────── */
    ${P} .dm-ups-traliccio{position:relative;width:120px;height:180px}
    ${P} .dm-ups-pilone{
      display:block;width:100%;height:100%;
      transition:opacity .5s ease,filter .5s ease}
    ${P} .dm-ups-pilone-tratti{
      fill:none;stroke:#94a3b8;stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round}
    ${P} .dm-ups-pilone-isolatori{fill:#cbd5e1;stroke:#94a3b8;stroke-width:2}
    /* La croce sul traliccio: quando la rete manca lo si vede da lontano,
       senza leggere una parola. */
    ${P} .dm-ups-taglio{
      position:absolute;inset:0;display:grid;place-items:center;font-size:64px;font-weight:900;
      color:#f43f5e;opacity:0;transform:scale(.7);transition:opacity .4s ease,transform .4s ease}
    ${P} .dm-ups-scena[data-buio="true"] .dm-ups-pilone{opacity:.28;filter:grayscale(1)}
    ${P} .dm-ups-scena[data-buio="true"] .dm-ups-taglio{opacity:.92;transform:scale(1)}

    /* ── la scatola: l'LCD, le spie, le prese ─────────────────────────── */
    ${P} .dm-ups-box{
      position:relative;width:206px;height:236px;border-radius:20px;
      background:linear-gradient(150deg,#475569,#1e293b 56%,#0b1220);
      box-shadow:0 28px 50px -22px rgba(15,23,42,.65),inset 0 1px 0 rgba(255,255,255,.12)}
    ${P} .dm-ups-lcd{
      position:absolute;top:20px;left:20px;right:20px;height:86px;border-radius:12px;
      display:flex;align-items:center;justify-content:center;gap:14px;
      background:linear-gradient(180deg,#0f172a,#020617);
      box-shadow:inset 0 0 0 1px rgba(148,163,184,.4),inset 0 2px 10px rgba(0,0,0,.7)}
    ${P} .dm-ups-lcd b{
      font-family:'Oswald',sans-serif;font-size:40px;font-weight:500;line-height:1;color:#4ade80;
      font-variant-numeric:tabular-nums;text-shadow:0 0 14px rgba(74,222,128,.5)}
    ${P} .dm-ups-lcd b em{font-style:normal;font-size:.45em;margin-left:2px;opacity:.8}
    ${P} .dm-ups-scena[data-buio="true"] .dm-ups-lcd b{
      color:#fbbf24;text-shadow:0 0 14px rgba(251,191,36,.55)}
    ${P} .dm-ups-scena[data-bassa="true"] .dm-ups-lcd b{
      color:#f87171;text-shadow:0 0 14px rgba(248,113,113,.55)}
    /* La cella: il livello si disegna, non solo si scrive — e senza carica
       mappata si riempie tutta, perche' una cella vuota direbbe «niente
       riserva» invece di «non lo so». */
    ${P} .dm-ups-cella{
      position:relative;width:34px;height:56px;border-radius:5px;
      box-shadow:inset 0 0 0 2px rgba(148,163,184,.75)}
    ${P} .dm-ups-cella::before{
      content:"";position:absolute;top:-7px;left:50%;transform:translateX(-50%);
      width:15px;height:5px;border-radius:2px;background:rgba(148,163,184,.75)}
    ${P} .dm-ups-cella i{
      position:absolute;left:4px;right:4px;bottom:4px;border-radius:3px;display:block;
      background:linear-gradient(to top,#16a34a,#4ade80);
      transition:height 1.2s cubic-bezier(.16,1,.3,1),background .8s ease}
    ${P} .dm-ups-scena[data-buio="true"] .dm-ups-cella i{
      background:linear-gradient(to top,#d97706,#fbbf24)}
    ${P} .dm-ups-scena[data-bassa="true"] .dm-ups-cella i{
      background:linear-gradient(to top,#b91c1c,#f87171)}

    ${P} .dm-ups-spie{position:absolute;top:122px;left:22px;display:flex;gap:12px}
    ${P} .dm-ups-spie i{
      display:block;width:13px;height:13px;border-radius:50%;background:rgba(148,163,184,.28)}
    ${P} .dm-ups-scena[data-rete="true"] .dm-ups-spia-rete{
      background:#22c55e;box-shadow:0 0 12px 2px rgba(34,197,94,.75)}
    /* La spia della batteria lampeggia solo mentre la casa ci sta sopra: una
       spia fissa direbbe «c'e' una batteria», che si sapeva gia'. */
    ${P} .dm-ups-scena[data-buio="true"] .dm-ups-spia-batt{
      background:#fbbf24;box-shadow:0 0 12px 2px rgba(251,191,36,.8);
      animation:dmUpsBattito 1.3s ease-in-out infinite}
    @keyframes dmUpsBattito{0%,100%{opacity:1}50%{opacity:.35}}

    ${P} .dm-ups-prese{position:absolute;bottom:22px;left:22px;right:22px;display:flex;gap:14px}
    ${P} .dm-ups-prese i{
      position:relative;display:block;flex:1;height:28px;border-radius:8px;
      background:rgba(15,23,42,.6);box-shadow:inset 0 0 0 1px rgba(148,163,184,.35)}
    /* I due fori: una pillola vuota non e' una presa, e la scatola si
       riconosce proprio da quelle. */
    ${P} .dm-ups-prese i::before,${P} .dm-ups-prese i::after{
      content:"";position:absolute;top:50%;width:4px;height:9px;border-radius:2px;
      transform:translateY(-50%);background:rgba(148,163,184,.55)}
    ${P} .dm-ups-prese i::before{left:calc(50% - 7px)}
    ${P} .dm-ups-prese i::after{left:calc(50% + 3px)}

    /* ── la casa: quello che sta tenendo acceso ───────────────────────── */
    ${P} .dm-ups-casa{position:relative;width:150px;height:150px}
    ${P} .dm-ups-tetto{
      position:absolute;top:0;left:50%;transform:translateX(-50%);width:0;height:0;
      border-left:75px solid transparent;border-right:75px solid transparent;
      border-bottom:56px solid #94a3b8}
    ${P} .dm-ups-muro{
      position:absolute;top:56px;left:18px;right:18px;bottom:0;border-radius:0 0 12px 12px;
      display:flex;align-items:center;justify-content:center;gap:16px;
      background:linear-gradient(180deg,#e2e8f0,#cbd5e1)}
    ${P} .dm-ups-muro i{
      display:block;width:26px;height:26px;border-radius:5px;background:rgba(15,23,42,.22);
      transition:background .6s ease,box-shadow .6s ease}
    /* Le finestre accese: la casa e' viva in tutti e due i casi — e' proprio il
       senso di questa scatola — ma di che luce lo dice chi la sta dando. */
    ${P} .dm-ups-scena[data-rete="true"] .dm-ups-muro i{
      background:#fde68a;box-shadow:0 0 14px 3px rgba(253,230,138,.7)}
    ${P} .dm-ups-scena[data-buio="true"] .dm-ups-muro i{
      background:#fbbf24;box-shadow:0 0 14px 3px rgba(251,191,36,.6)}

    ${P} .dm-ups-verdetto{
      font-size:12px;font-weight:800;letter-spacing:.3px;padding:8px 14px;border-radius:14px;
      background:rgba(255,255,255,.95);color:var(--text-dim,#475569);
      box-shadow:0 6px 16px rgba(0,0,0,.08);white-space:nowrap}
    ${P} .dm-ups-scena[data-buio="true"] .dm-ups-verdetto{
      background:linear-gradient(135deg,#f43f5e,#e11d48);color:#fff;
      box-shadow:0 10px 24px -10px rgba(244,63,94,.85)}

    @media (max-width:820px){
      ${P} .dm-ups-stage{height:520px;border-radius:24px}
      ${P} .dm-ups-box{width:158px;height:186px}
      ${P} .dm-ups-lcd{height:66px}
      ${P} .dm-ups-lcd b{font-size:30px}
      ${P} .dm-ups-spie{top:96px}
      ${P} .dm-ups-traliccio{width:84px;height:132px}
      ${P} .dm-ups-casa{width:110px;height:112px}
      ${P} .dm-ups-tetto{border-left-width:55px;border-right-width:55px;border-bottom-width:42px}
      ${P} .dm-ups-muro{top:42px}
      ${P} .dm-ups-plate{min-width:88px;padding:8px 12px}
      ${P} .dm-ups-plate-val{font-size:21px}
    }
    `,
  );
}

export function installUpsSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureUpsPage();
  ensureUpsTab();
  /* Il guscio ridisegna la Home a ogni giro e riapplica la visibilita' delle
   * voci ogni tre secondi: agganciarsi li' vuol dire seguire la plancia invece
   * di interrogarla con un timer nostro. */
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmUpsSection) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmUpsSection = true;
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

installUpsSection();
