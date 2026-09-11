/* L'interruttore del modo chiosco, dentro ⚙️ Impostazioni (#480).
 *
 * «Da smartphone non me la propone, su tablet e pc ho la barra laterale, è
 *  possibile toglierla?» — «Ma non vorrei disattivarla per tutte le plance,
 *  sarebbe possibile avere una funzione tipo kiosk mode?»
 *
 * La barra laterale la nasconde Home Assistant, ed è una preferenza del
 * profilo: vale per tutto quello che quell'utente apre, non per una dashboard
 * sola. Spegnerla da lì è la risposta sbagliata alla domanda giusta.
 *
 * Il modo chiosco la risposta giusta ce l'aveva già: manda la plancia a tutto
 * schermo — sopra la barra laterale, sopra l'intestazione — e riguarda questa
 * plancia e basta. Su un telefono si accende da solo; su un computer no,
 * perché lì la barra degli indirizzi c'è e toglierla non serve. Il guaio è che
 * per accenderlo a mano bisognava sapere due cose che non sta scritto da
 * nessuna parte: tenere premuto l'hamburger della plancia, oppure scrivere
 * `?kiosk=1` nell'indirizzo. Una funzione che c'è ma non si trova, per chi la
 * cerca, non c'è.
 *
 * Qui c'è il suo interruttore, dov'era andato a cercarlo chi l'ha chiesto. Non
 * è un secondo modo chiosco: è lo stesso — `setKioskMode` — visto da un posto
 * dove si arriva.
 *
 * La scelta vale per QUESTO apparecchio, come il tema e la barra in basso: la
 * plancia a tutto schermo sul tablet appeso al muro e con la barra laterale sul
 * computer è esattamente il caso della segnalazione, e sincronizzarla lo
 * renderebbe impossibile.
 */
import { kioskAttivo, setKioskMode } from "./beta12-room-color-lock-section.js";
import {
  ORDINE_IMPOSTAZIONI,
  clean,
  doc,
  dopoIGenerali,
  esc,
  inserisciInOrdine,
  installStyle,
  onEditorRedraw,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_MODO_CHIOSCO__";
const state = (root[KEY] ||= { installed: false });

const SCHEDA = "visib";
const BLOCCO = "dm-chiosco";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function corpoMarkup() {
  const acceso = kioskAttivo();
  return `<div class="ed-form dm-chiosco" id="${BLOCCO}">
    <div class="dm-chiosco-riga">
      <span class="dm-chiosco-glifo" aria-hidden="true">🖥️</span>
      <span class="dm-chiosco-testo">
        <b>${esc(t("Modo chiosco", "Kiosk mode"))}</b>
        <small>${esc(
          t(
            "La plancia a tutto schermo, sopra la barra laterale di Home Assistant. Vale solo per questa plancia e solo su questo apparecchio: sul telefono si accende da sola.",
            "The dashboard full screen, over the Home Assistant sidebar. It applies to this dashboard only and on this device only: on a phone it turns itself on.",
          ),
        )}</small>
      </span>
      <button type="button" class="dm-chiosco-int" role="switch"
        aria-checked="${acceso ? "true" : "false"}"
        aria-label="${esc(t("Modo chiosco", "Kiosk mode"))}"
        data-dm-chiosco-int><i></i></button>
    </div>
  </div>`;
}

/** Ridisegna il blocco se è già a video, senza toccare il resto della scheda. */
function ridipingi() {
  const gia = doc?.getElementById(BLOCCO);
  if (!gia) return false;
  const foglio = doc.createElement("div");
  foglio.innerHTML = corpoMarkup();
  const nuovo = foglio.firstElementChild;
  if (!nuovo) return false;
  nuovo.setAttribute("data-dm-ordine", gia.getAttribute("data-dm-ordine") || "");
  gia.replaceWith(nuovo);
  return true;
}

export function ensureModoChiosco() {
  if (!doc || schedaAttiva() !== SCHEDA) return false;
  const corpo = doc.getElementById("ed-body");
  if (!corpo) return false;
  if (doc.getElementById(BLOCCO)) return true;
  const foglio = doc.createElement("div");
  foglio.innerHTML = corpoMarkup();
  const riga = foglio.firstElementChild;
  if (!riga) return false;
  inserisciInOrdine(corpo, riga, ORDINE_IMPOSTAZIONI.chiosco, dopoIGenerali);
  return true;
}

function onClick(evento) {
  const interruttore = evento.target?.closest?.("[data-dm-chiosco-int]");
  if (!interruttore) return;
  evento.preventDefault();
  /* Lo stato vero lo sa il chiosco: si chiede a lui com'è andata invece di
   * dare per scontato che il tocco abbia fatto quello che chiedeva. */
  setKioskMode(!kioskAttivo());
  ridipingi();
}

function installStili() {
  installStyle(
    "dm-chiosco-style",
    `
    #${BLOCCO} .dm-chiosco-riga{
      display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px}
    #${BLOCCO} .dm-chiosco-glifo{font-size:19px;line-height:1}
    #${BLOCCO} .dm-chiosco-testo{display:grid;gap:3px;min-width:0}
    #${BLOCCO} .dm-chiosco-testo b{font-size:13px;font-weight:800}
    #${BLOCCO} .dm-chiosco-testo small{font-size:11px;line-height:1.35;color:var(--text-dim,#94a3b8)}
    #${BLOCCO} .dm-chiosco-int{
      position:relative;width:38px;height:22px;flex:0 0 auto;padding:0;cursor:pointer;
      border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);transition:background .18s ease}
    #${BLOCCO} .dm-chiosco-int[aria-checked="true"]{background:var(--success-color,#10b981)}
    #${BLOCCO} .dm-chiosco-int i{
      position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;
      background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}
    #${BLOCCO} .dm-chiosco-int[aria-checked="true"] i{transform:translateX(16px)}
    #${BLOCCO} .dm-chiosco-int:focus-visible{
      outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 40%,transparent);outline-offset:2px}
    `,
  );
}

export function installModoChiosco() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStili();
  doc.addEventListener("click", onClick);
  /* Il chiosco si accende anche da fuori — il dito tenuto premuto
   * sull'hamburger, un indirizzo con ?kiosk=1, il telefono che parte cosi' — e
   * l'interruttore deve dire quello che e' vero adesso, non quello che era
   * vero quando si e' aperta la scheda. */
  root.addEventListener?.("dashboardmodern:kiosk", ridipingi);
  onEditorRedraw("__dmModoChiosco", () => root.queueMicrotask?.(ensureModoChiosco));
  ensureModoChiosco();
  return true;
}

installModoChiosco();
