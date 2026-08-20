/* La tapparella sta fuori, l'infisso si vede da dentro.
 *
 * La card mostrava un rettangolo azzurro con delle stecche che scendevano
 * davanti: una tapparella senza finestra. Si guarda invece dalla stanza — che e'
 * da dove uno guarda una tapparella — e allora in primo piano c'e' sempre
 * l'infisso, con il suo telaio, le due ante e la maniglia; dietro il vetro
 * scende la tapparella; dietro ancora c'e' il fuori.
 *
 * E un infisso puo' essere aperto. Un contatto sull'anta lo dice, e quando lo
 * dice le ante rientrano verso i loro cardini e scoprono il vano.
 *
 * Il movimento delle ante e' uno `scaleX`, non un `rotateY`. Sono la stessa
 * cosa sullo schermo — l'anta si stringe verso il cardine e torna — ma la
 * rotazione aprirebbe un contesto tridimensionale su ogni card, ed e'
 * esattamente quello che aveva ucciso WebKit sulle icone degli avvisi.
 *
 * Niente qui scrive dati: la posizione della tapparella resta di chi la
 * disegnava, il contatto si legge e basta.
 */
import { shutterWindowModel } from "../core/shutter-window.js";
import { allStates, clean, dashboardStore, doc, installStyle, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SHUTTER_WINDOW__";
const STYLE_ID = "dm-shutter-window-style";
const state = (root[KEY] ||= { installed: false, frame: 0 });

/* Le tapparelle configurate: dal modello canonico, con la copia in
 * localStorage come rete di sicurezza per la plancia ospitata, che puo'
 * disegnare prima che il modello esista. */
function covers() {
  try {
    const stored = dashboardStore()?.getSection?.("covers");
    if (Array.isArray(stored) && stored.length) return stored;
  } catch (_error) {}
  const legacy = readJson("cd_tapparelle", []);
  return Array.isArray(legacy) ? legacy : [];
}

function coverForCard(card) {
  const entity = clean(card.getAttribute("data-tapp"));
  if (!entity) return null;
  return covers().find((item) => clean(item?.entity) === entity) || null;
}

/* I pezzi che si aggiungono al vano, una volta sola.
 *
 * Il runtime ridisegna tutta la griglia a ogni cambio di stato, quindi questa
 * passata gira di continuo: costruisce solo dove non ha ancora costruito, e
 * riconosce il proprio lavoro dal segno che lascia. */
function build(windowNode) {
  if (windowNode.dataset.dmInfisso === "true") return false;
  windowNode.dataset.dmInfisso = "true";

  /* Solo cio' che manca.
   *
   * Il vano ha gia' un padrone: cielo, colline, sole, cassonetto e guide sono
   * disegnati dal modulo della scena, e le stecche sono uno sfondo ripetuto
   * sulla tapparella stessa. Rifarli qui vorrebbe dire due padroni sullo stesso
   * pixel, che e' il difetto che questa plancia ha passato mesi a togliersi.
   * Quello che davvero non c'era e' l'infisso: il telaio, le due ante, la
   * maniglia. */
  const spalla = doc.createElement("div");
  spalla.className = "dm-tw-spalla";
  const infisso = doc.createElement("div");
  infisso.className = "dm-tw-infisso";
  infisso.innerHTML =
    '<div class="dm-tw-anta dm-tw-anta-sx"></div>' +
    '<div class="dm-tw-anta dm-tw-anta-dx"><span class="dm-tw-maniglia"></span></div>' +
    '<div class="dm-tw-telaio"></div>';
  windowNode.append(spalla, infisso);
  return true;
}

/** Cosa dice il contatto di questa card, adesso. */
export function paintCard(card, states = allStates()) {
  const windowNode = card.querySelector(".tapp-win");
  if (!windowNode) return false;
  build(windowNode);
  const cover = coverForCard(card);
  const model = shutterWindowModel(cover || {}, states, root.resolveEntity || ((value) => value));
  // Aperto solo quando il contatto lo dice: un sensore che non risponde non e'
  // una finestra chiusa, ma il disegno di riposo e' quello, e non si inventa
  // un'apertura che nessuno ha misurato.
  const aperto = model.open === true ? "aperto" : "chiuso";
  if (windowNode.dataset.dmInfissoStato !== aperto) windowNode.dataset.dmInfissoStato = aperto;
  ensurePill(card, model.open === true);
  return true;
}

/* La pastiglia "Finestra aperta" accanto a quella della tapparella.
 *
 * Sta accanto, non al posto: la tapparella continua a dire a che punto e', e
 * l'infisso aggiunge la sua riga solo quando c'e' qualcosa da aggiungere. */
function ensurePill(card, aperto) {
  const head = card.querySelector(".tapp-head");
  if (!head) return;
  let pill = head.querySelector(".dm-tw-pill");
  if (!aperto) {
    if (pill) pill.remove();
    return;
  }
  if (!pill) {
    pill = doc.createElement("span");
    pill.className = "tapp-state dm-tw-pill";
    head.append(pill);
  }
  const label = t("Finestra aperta", "Window open");
  if (pill.textContent !== label) pill.textContent = label;
}

export function paintShutterWindows(scope = doc?.getElementById("page-tapparelle")) {
  if (!scope?.querySelectorAll) return 0;
  const states = allStates();
  let painted = 0;
  for (const card of scope.querySelectorAll(".tapp-card[data-tapp]")) {
    if (paintCard(card, states)) painted += 1;
  }
  return painted;
}

/* ── il campo in Config ─────────────────────────────────────────────────── */

/* Il contatto si configura dove si configura la tapparella.
 *
 * Il modulo delle righe di sezione veste da solo i campi che chiedono
 * un'entita' — pastiglia, matita, cestino — e li riconosce dalla lente accanto
 * all'input. Qui basta quindi stampare la stessa coppia che stampa il runtime,
 * e il resto arriva. */
export function ensureContactField(body = doc?.getElementById("ed-body")) {
  const room = body?.querySelector?.("#ed-tp-room");
  if (!room) return false;
  if (body.querySelector("#ed-tp-contact")) return false;
  const holder = doc.createElement("label");
  holder.className = "ed-slot dm-tw-contact-slot";
  holder.innerHTML =
    `<span class="ed-slot-lbl">${t("Sensore apertura infisso", "Window contact sensor")}</span>` +
    '<span class="ed-form-row">' +
    '<input id="ed-tp-contact" class="ed-input mono" autocomplete="off" data-entity-input="true"' +
    ' placeholder="binary_sensor.finestra_camera">' +
    `<button type="button" class="dm-entity-picker" data-entity-target="ed-tp-contact"` +
    ` aria-label="${t("Seleziona entità", "Choose entity")}">🔍</button>` +
    "</span>";
  room.closest("label, .ed-slot, div")?.after?.(holder) || room.after(holder);
  return true;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    paintShutterWindows();
    ensureContactField();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
    /* L'infisso, sempre in primo piano: sta sopra le guide del vano, che sono
       l'ultimo strato che disegna il modulo della scena. */
    html body #page-tapparelle#page-tapparelle .dm-tw-infisso{
      position:absolute!important;inset:0!important;z-index:7!important;pointer-events:none!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-telaio{
      position:absolute!important;inset:0!important;border:8px solid #e8edf3!important;border-radius:13px!important;
      box-shadow:inset 0 0 0 1px #b6c2d1,inset 0 2px 5px rgba(15,23,42,.16)!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-anta{
      position:absolute!important;top:8px!important;bottom:8px!important;width:calc(50% - 8px)!important;
      border:6px solid #e8edf3!important;border-radius:7px!important;background:transparent!important;
      box-shadow:inset 0 0 0 1px #b6c2d1!important;
      transition:transform 1s cubic-bezier(.3,.7,.2,1),filter 1s ease!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-anta-sx{left:8px!important;transform-origin:left center!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-anta-dx{right:8px!important;transform-origin:right center!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-maniglia{
      position:absolute!important;left:-9px!important;top:50%!important;width:7px!important;height:22px!important;
      border-radius:3px!important;background:linear-gradient(180deg,#cbd5e1,#94a3b8)!important;
      transform:translateY(-50%)!important;box-shadow:0 1px 2px rgba(15,23,42,.3)!important}
    html body #page-tapparelle#page-tapparelle .dm-tw-maniglia::after{
      content:""!important;position:absolute!important;left:-9px!important;top:7px!important;width:12px!important;height:5px!important;
      border-radius:3px!important;background:linear-gradient(180deg,#cbd5e1,#8fa0b3)!important}

    /* Aperta: le ante rientrano verso il cardine e fanno ombra su cio' che
       hanno dietro.
     *
     * Con la tapparella alzata bastava vedere il cielo scoperto. Con la
     * tapparella giu' no: le ante rientravano su un fondo dello stesso colore e
     * non si capiva piu' niente — la card diceva "finestra aperta" e mostrava
     * una tapparella chiusa qualunque.
     *
     * Adesso l'anta aperta resta un'anta: prende corpo, si stacca dal fondo, e
     * getta ombra su quello che ha dietro. E' l'ombra a dire che li' c'e' un
     * buco, e funziona sia sulla tapparella chiara sia sul cielo — senza
     * coprire ne' l'una ne' l'altro. Da chiusa l'anta resta trasparente, se no
     * si perderebbe il vetro. */
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-infisso-stato="aperto"] .dm-tw-anta{
      transform:scaleX(.28)!important;
      background:linear-gradient(135deg,#f7fafc,#dbe3ec)!important;
      box-shadow:inset 0 0 0 1px #b6c2d1,6px 0 14px -4px rgba(15,23,42,.55)!important}
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-infisso-stato="aperto"] .dm-tw-anta-dx{
      box-shadow:inset 0 0 0 1px #b6c2d1,-6px 0 14px -4px rgba(15,23,42,.55)!important}
    /* Lo spessore del muro attorno al buco. */
    html body #page-tapparelle#page-tapparelle .dm-tw-spalla{
      position:absolute!important;top:8px!important;bottom:8px!important;left:8px!important;right:8px!important;
      border-radius:7px!important;z-index:6!important;opacity:0!important;transition:opacity .9s ease!important;
      pointer-events:none!important;
      background:linear-gradient(90deg,rgba(15,23,42,.62) 0,rgba(15,23,42,.22) 9%,rgba(15,23,42,0) 22%,
                 rgba(15,23,42,0) 78%,rgba(15,23,42,.22) 91%,rgba(15,23,42,.62) 100%),
                 linear-gradient(180deg,rgba(15,23,42,.30),rgba(15,23,42,0) 26%)!important}
    html body #page-tapparelle#page-tapparelle .tapp-win[data-dm-infisso-stato="aperto"] .dm-tw-spalla{opacity:1!important}

    /* La pastiglia dell'infisso vive accanto a quella della tapparella, e la
       forma la da' gia' chi possiede .tapp-state: qui si cambia solo il colore. */
    html body #page-tapparelle#page-tapparelle .dm-tw-pill{
      background:rgba(245,158,11,.18)!important;border-color:rgba(245,158,11,.34)!important;color:#b45309!important}

    #ed-body .dm-tw-contact-slot{display:block!important;margin-top:10px!important}
  `,
  );
}

export function installShutterWindowSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:state-changed",
    // Quando arriva una configurazione condivisa il modulo della scena rifa' la
    // griglia da capo con innerHTML, e con lei sparisce ogni infisso: senza
    // questo, le card restavano senza finestra fino al primo cambio di stato.
    "dashboardmodern:persistence-restored",
    "pageshow",
  ]) {
    root.addEventListener?.(eventName, schedule);
  }
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-tab],[data-page],.ed-tab,.tapp-btn")) {
        root.setTimeout?.(schedule, 0);
      }
    },
    true,
  );
  schedule();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installShutterWindowSection, { once: true });
} else {
  installShutterWindowSection();
}
