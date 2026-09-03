/* Le aperture nella pagina Sicurezza (#195).
 *
 * Il portone del condominio e la porta di casa stanno fra la centrale
 * d'allarme e le telecamere: una card per porta, il tocco chiede conferma, e
 * chi ha configurato un PIN si vede chiedere il PIN — con lo stesso tastierino
 * della centrale, perche' un codice si scrive sempre allo stesso modo.
 *
 * Il PIN e' un cancello locale contro le aperture accidentali (le parole della
 * richiesta): la verifica sta in `security-door-model.js`, il comando parte
 * solo dopo. Nessun polling: si ridisegna dopo ogni render della sezione e a
 * ogni cambio di stato mentre la pagina e' visibile.
 */
import {
  doorOpenCall,
  doorPinMatches,
  doorsSenzaOccupate,
  normalizeSecurityDoors,
} from "../core/security-door-model.js";
import { normalizzaPrese } from "../core/prese-model.js";
import { registraPaginaARuntime, renderPageMastheads } from "./page-masthead-section.js";
import {
  activeLocale,
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SECURITY_DOORS__";
const STYLE_ID = "dm-security-doors-style";
const KEYPAD_ID = "dm-door-keypad";
export const SECURITY_DOORS_CONFIG_KEY = "cd_security_doors";

/* Chiedere conferma prima di aprire, o no (#275).
 *
 * «Sarebbe carino la possibilità in configurazione di decidere se attivare la
 * doppia conferma d'apertura o meno, per essere più celeri all'apertura.»
 *
 * Di serie la conferma c'è: un cancello che si apre al primo tocco sbagliato è
 * un cancello aperto, e chi tocca per sbaglio se ne accorge dopo. Ma chi apre
 * il proprio portone dieci volte al giorno la conferma la conosce a memoria, e
 * per lui è solo un tocco in più.
 *
 * Il PIN non è una conferma e non si spegne da qui: quella è una chiave, e una
 * porta protetta continua a chiederla. */
export const SECURITY_DOORS_CONFIRM_KEY = "cd_porte_conferma";

/** Se il tocco su un'apertura chiede conferma. Spento solo se lo si è detto. */
export function siChiedeConferma() {
  return readJson(SECURITY_DOORS_CONFIRM_KEY, true) !== false;
}

const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  signature: "",
  typed: "",
  doorId: "",
  busy: new Set(),
});

/* Le entita' gia' occupate dalle Prese: una presa non e' una porta.
 * La lista si NORMALIZZA prima di leggerla: le voci storiche portano
 * l'entita' anche come `entita` o `entity_id`, e lette grezze quelle prese
 * restavano fra le porte. */
export function entitaDellePrese() {
  return new Set(
    normalizzaPrese(readJson("cd_prese", []))
      .map((presa) => clean(presa.entity).toLowerCase())
      .filter(Boolean),
  );
}

export function configuredSecurityDoors() {
  return doorsSenzaOccupate(
    normalizeSecurityDoors(readJson(SECURITY_DOORS_CONFIG_KEY, [])),
    entitaDellePrese(),
  );
}

/* ── model ────────────────────────────────────────────────────────────── */

function doorById(id) {
  return configuredSecurityDoors().find((door) => door.id === clean(id)) || null;
}

function doorStateLabel(door, states) {
  const current = states[door.entity];
  const raw = clean(current?.state).toLowerCase();
  if (raw === "locked") return t("Chiusa a chiave", "Locked");
  if (raw === "unlocked") return t("Sbloccata", "Unlocked");
  if (raw === "open") return t("Aperta", "Open");
  if (raw === "opening") return t("In apertura", "Opening");
  if (raw === "closing") return t("In chiusura", "Closing");
  if (raw === "closed") return t("Chiusa", "Closed");
  return t("Tocca per aprire", "Tap to open");
}

/* ── markup ───────────────────────────────────────────────────────────── */

/* L'icona di una porta. Il catalogo di casa scrive token `mdi:*`: stampati
 * come testo l'icona «spariva» (si leggeva mdi:gate al posto del disegno).
 * Chi sa disegnare il token e' il motore; l'emoji passa com'e'. */
export function iconaPortaMarkup(icon, size = 22) {
  const token = clean(icon) || "🚪";
  if (/^mdi:/i.test(token)) {
    const disegnata = root.DashboardModernIconEngine?.markup?.("action", token, { size });
    return disegnata || "🚪";
  }
  return esc(token);
}

function doorMarkup(door) {
  return `<button type="button" class="dm-door" data-dm-door="${esc(door.id)}">
      <span class="dm-door-ic" aria-hidden="true">${iconaPortaMarkup(door.icon)}</span>
      <span class="dm-door-copy">
        <strong class="dm-door-name">${esc(door.name || door.entity)}</strong>
        <span class="dm-door-state" data-dm-door-state></span>
      </span>
      ${door.pin ? `<span class="dm-door-pin" title="${esc(t("Protetta da PIN", "PIN protected"))}" aria-hidden="true">🔒</span>` : ""}
    </button>`;
}

function blockMarkup(doors) {
  return `<div class="dm-sec-doors-head">
      <span class="dm-sec-doors-ic" aria-hidden="true">🚪</span>
      <span class="dm-sec-doors-hint">${esc(t("Il tocco chiede conferma; col PIN, il codice.", "A tap asks to confirm; with a PIN, the code."))}</span>
    </div>
    <div class="dm-door-grid">${doors.map(doorMarkup).join("")}</div>`;
}

/* Quante aperture ci sono, detto nell'intestazione della pagina. */
function sottotitolo(doors) {
  if (!doors.length) return t("Nessuna apertura configurata", "No opening configured");
  return doors.length === 1
    ? t("1 apertura", "1 opening")
    : `${doors.length} ${t("aperture", "openings")}`;
}

/* ── la pagina, che è una sezione a sé (#275) ─────────────────────────── */

/* «Si richiede di separare le aperture con la sicurezza.»
 *
 * Le aperture stavano dentro la Sicurezza perché è lì che erano nate, fra
 * l'antifurto e le telecamere. Ma un cancello non è una telecamera: chi apre il
 * portone lo fa dieci volte al giorno e non gli interessa se l'antifurto è
 * inserito, e chi guarda l'antifurto non vuole i comandi di apertura sotto il
 * quadrante. Sono due cose, e adesso sono due pagine.
 *
 * La voce nella barra si spegne come tutte le altre: legge `cd_sections` con la
 * stessa chiave che scrive la fascia della visibilità.
 */
export const APERTURE_TAB = "porte";
const PAGINA_APERTURE = "page-porte";

function funzioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[APERTURE_TAB] === false);
}

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

function ensurePagina() {
  if (!doc) return null;
  let pagina = doc.getElementById(PAGINA_APERTURE);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = PAGINA_APERTURE;
  pagina.innerHTML = `<div class="dm-porte-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

function apri(voce) {
  for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
  voce.classList.add("active");
  ensurePagina()?.classList.add("active");
  try {
    renderPageMastheads();
  } catch (_error) {}
  root.scrollTo?.({ top: 0, behavior: "instant" });
}

function ensureVoce() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${APERTURE_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = APERTURE_TAB;
  voce.id = `tab-${APERTURE_TAB}`;
  voce.innerHTML = `<span class="icon">🚪</span><span class="text">${esc(
    t("Apri porte", "Openers"),
  )}</span>`;
  /* Accanto alla Sicurezza, da cui esce: chi la cercava lì la trova lì
   * accanto. Se un domani il guscio togliesse quella voce, si va prima di
   * Config invece di non comparire. */
  const sicurezza = barra.querySelector('.tab[data-tab="security"]');
  const config = barra.querySelector('.tab[data-tab="config"]');
  if (sicurezza) sicurezza.after(voce);
  else if (config) config.before(voce);
  else barra.append(voce);
  voce.addEventListener("click", () => apri(voce));
  return voce;
}

/* ── rendering ────────────────────────────────────────────────────────── */

function ensureBlock(shell) {
  let block = shell.querySelector(":scope > .dm-sec-doors");
  if (block) return block;
  block = doc.createElement("section");
  block.className = "dm-sec-doors";
  const cctv = shell.querySelector(":scope > .dm-sec-cctv");
  if (cctv) shell.insertBefore(block, cctv);
  else shell.append(block);
  return block;
}

export function renderSecurityDoors() {
  const doors0 = configuredSecurityDoors();
  const accesa = funzioneAccesa();
  /* La voce e la pagina esistono finché ci sono aperture da comandare: senza,
   * sarebbe una voce nella barra che porta a una pagina vuota. */
  const voce =
    doors0.length && accesa
      ? ensureVoce()
      : doc?.querySelector?.(`.tab[data-tab="${APERTURE_TAB}"]`);
  if (voce) voce.style.display = doors0.length && accesa ? "" : "none";
  const pagina = doors0.length ? ensurePagina() : doc?.getElementById?.(PAGINA_APERTURE);
  if (pagina) {
    registraPaginaARuntime(PAGINA_APERTURE, {
      /* Le due tinte della fascia, come le porta ogni altra pagina: azzurro e
       * blu, i colori della Sicurezza da cui questa esce. */
      tint: ["14,165,233", "37,99,235"],
      it: ["Apri porte/cancelli", sottotitolo(doors0)],
      en: ["Door and gate openers", sottotitolo(doors0)],
    });
  }
  const shell = pagina?.querySelector?.(".dm-porte-wrap") || null;
  if (!shell) return false;
  const doors = configuredSecurityDoors();
  if (!doors.length) {
    shell.querySelector(":scope > .dm-sec-doors")?.remove();
    state.signature = "";
    return true;
  }
  const block = ensureBlock(shell);
  const signature = [
    activeLocale(),
    ...doors.map((door) =>
      [door.id, door.name, door.entity, door.icon, Boolean(door.pin)].join("~"),
    ),
  ].join("|");
  if (state.signature !== signature || !block.querySelector(".dm-door-grid")) {
    state.signature = signature;
    block.innerHTML = blockMarkup(doors);
  }
  const states = allStates();
  for (const door of doors) {
    const card = block.querySelector(`[data-dm-door="${CSS.escape(door.id)}"]`);
    const label = card?.querySelector("[data-dm-door-state]");
    if (!label) continue;
    const text = state.busy.has(door.id)
      ? t("Comando inviato…", "Command sent…")
      : doorStateLabel(door, states);
    if (label.textContent !== text) label.textContent = text;
    card.classList.toggle("is-busy", state.busy.has(door.id));
  }
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(paint) || root.setTimeout?.(paint, 0) || 0;
}

function paint() {
  state.frame = 0;
  try {
    renderSecurityDoors();
  } catch (error) {
    root.console?.warn?.("[DashboardModern] security doors", error);
  }
}

/* ── the command ──────────────────────────────────────────────────────── */

async function openDoor(door) {
  if (state.busy.has(door.id)) return;
  const call = doorOpenCall(door.entity, allStates()[door.entity]);
  if (!call) return;
  state.busy.add(door.id);
  schedule();
  try {
    const payload = { entity_id: door.entity, ...call.data };
    if (typeof root.dmCallHaService === "function") {
      await root.dmCallHaService(call.domain, call.service, payload);
    } else if (typeof root.callService === "function") {
      await root.callService(call.domain, call.service, payload);
    } else {
      await (root.hass || root._hass)?.callService?.(call.domain, call.service, payload);
    }
  } catch (error) {
    root.console?.error?.("[DashboardModern] door open", error);
  }
  root.setTimeout?.(() => {
    state.busy.delete(door.id);
    schedule();
  }, 4000);
}

function confirmAndOpen(door) {
  if (typeof root.confermaAzione === "function") {
    try {
      root.confermaAzione({
        /* Il popup di conferma stampa testo: un token mdi li' non si disegna. */
        icon: /^mdi:/i.test(clean(door.icon)) ? "🚪" : door.icon || "🚪",
        title: clean(door.name) || t("Apri", "Open"),
        message: t("Confermi l'apertura?", "Confirm opening?"),
        onConfirm: () => openDoor(door),
      });
      return;
    } catch (_error) {}
  }
  openDoor(door);
}

/* ── the keypad ───────────────────────────────────────────────────────── */

/* Il tastierino riusa le classi del PIN della centrale — .keypad-content,
 * .pin-display, .keypad-btn — cosi' un codice si scrive sempre nello stesso
 * posto disegnato allo stesso modo. La logica pero' e' tutta qui: quello del
 * runtime e' saldato ad `alarm_control_panel` e non puo' aprire una porta. */
function ensureKeypad() {
  let modal = doc.getElementById(KEYPAD_ID);
  if (modal) return modal;
  modal = doc.createElement("div");
  modal.id = KEYPAD_ID;
  modal.className = "modal-wrapper";
  modal.innerHTML = `<div class="modal-card keypad-content" role="dialog" aria-modal="true" aria-labelledby="dm-door-keypad-title">
      <div class="keypad-title" id="dm-door-keypad-title">${esc(t("INSERISCI PIN", "ENTER PIN"))}</div>
      <div class="keypad-sub" data-dm-door-keypad-name></div>
      <div class="pin-display" data-dm-door-dots></div>
      <output class="dm-door-keypad-error" data-dm-door-keypad-error></output>
      <div class="keypad-grid">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => `<button type="button" class="keypad-btn" data-dm-door-digit="${digit}">${digit}</button>`).join("")}
        <button type="button" class="keypad-btn action" data-dm-door-del>DEL</button>
        <button type="button" class="keypad-btn" data-dm-door-digit="0">0</button>
        <button type="button" class="keypad-btn ok" data-dm-door-ok>OK</button>
      </div>
      <button type="button" class="keypad-cancel" data-dm-door-cancel>${esc(t("ANNULLA OPERAZIONE", "CANCEL OPERATION"))}</button>
    </div>`;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeKeypad();
  });
  doc.body.append(modal);
  return modal;
}

function paintDots(modal, expectedLength) {
  const dots = modal.querySelector("[data-dm-door-dots]");
  if (!dots) return;
  const total = Math.max(4, expectedLength || 4);
  if (dots.childElementCount !== total) {
    dots.innerHTML = `<div class="pin-dot"></div>`.repeat(total);
  }
  [...dots.children].forEach((dot, index) => {
    dot.classList.toggle("filled", index < state.typed.length);
  });
}

function openKeypad(door) {
  const modal = ensureKeypad();
  state.doorId = door.id;
  state.typed = "";
  const name = modal.querySelector("[data-dm-door-keypad-name]");
  if (name) name.textContent = clean(door.name) || door.entity;
  const error = modal.querySelector("[data-dm-door-keypad-error]");
  if (error) error.textContent = "";
  paintDots(modal, door.pin.length);
  modal.classList.add("show");
}

function closeKeypad() {
  const modal = doc.getElementById(KEYPAD_ID);
  modal?.classList.remove("show");
  state.doorId = "";
  state.typed = "";
}

function onKeypadClick(event) {
  const modal = doc.getElementById(KEYPAD_ID);
  if (!modal || !modal.classList.contains("show") || !modal.contains(event.target)) return false;
  const door = doorById(state.doorId);
  if (!door) {
    closeKeypad();
    return true;
  }
  const digit = event.target.closest("[data-dm-door-digit]");
  if (digit) {
    if (state.typed.length < 8) state.typed += clean(digit.dataset.dmDoorDigit);
    paintDots(modal, door.pin.length);
    return true;
  }
  if (event.target.closest("[data-dm-door-del]")) {
    state.typed = state.typed.slice(0, -1);
    paintDots(modal, door.pin.length);
    return true;
  }
  if (event.target.closest("[data-dm-door-cancel]")) {
    closeKeypad();
    return true;
  }
  if (event.target.closest("[data-dm-door-ok]")) {
    if (doorPinMatches(door, state.typed)) {
      closeKeypad();
      openDoor(door);
    } else {
      /* PIN sbagliato: si azzera e si resta qui — l'errore va detto dov'e'
       * successo, non con la porta che non si apre e basta. */
      state.typed = "";
      paintDots(modal, door.pin.length);
      const error = modal.querySelector("[data-dm-door-keypad-error]");
      if (error) error.textContent = t("PIN errato, riprova.", "Wrong PIN, try again.");
    }
    return true;
  }
  return true;
}

/* ── wiring ───────────────────────────────────────────────────────────── */

function onClick(event) {
  if (onKeypadClick(event)) return;
  const card = event.target?.closest?.("[data-dm-door]");
  if (!card) return;
  event.preventDefault();
  const door = doorById(card.dataset.dmDoor);
  if (!door || state.busy.has(door.id)) return;
  if (door.pin) openKeypad(door);
  else if (siChiedeConferma()) confirmAndOpen(door);
  /* Senza conferma si apre e basta: è la scelta di chi apre il proprio portone
   * dieci volte al giorno. */
  else openDoor(door);
}

function paginaVisibile() {
  return Boolean(doc?.getElementById?.(PAGINA_APERTURE)?.classList?.contains("active"));
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
.dm-sec-doors{display:flex;flex-direction:column;gap:12px}
.dm-sec-doors-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 4px}
.dm-sec-doors-ic{font-size:20px}
.dm-sec-doors-head h3{
  margin:0;font-family:'Oswald',sans-serif;font-weight:700;font-size:17px;
  letter-spacing:2.2px;text-transform:uppercase}
.dm-sec-doors-hint{font-size:11.5px;font-weight:600;color:var(--dm-sec-dim,#64748b)}
.dm-door-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.dm-door{
  display:flex;align-items:center;gap:12px;padding:14px 16px;min-height:64px;
  border:1px solid var(--dm-sec-border,var(--card-border,#e8edf3));border-radius:18px;
  background:var(--dm-sec-card,var(--card-bg,#fff));color:var(--dm-sec-text,var(--text,#0f172a));
  font:inherit;text-align:left;cursor:pointer;
  box-shadow:0 10px 26px rgba(15,23,42,.07);
  transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}
.dm-door:hover{transform:translateY(-2px);border-color:rgba(6,182,212,.38);box-shadow:0 16px 34px rgba(15,23,42,.12)}
.dm-door:focus-visible{outline:3px solid rgba(6,182,212,.55);outline-offset:3px}
.dm-door.is-busy{opacity:.65;pointer-events:none}
.dm-door-ic{
  width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;font-size:22px;
  border-radius:13px;background:var(--surface-3,#f1f5f9);
  box-shadow:inset 0 0 0 1px var(--dm-sec-border,#e8edf3)}
.dm-door-copy{min-width:0;flex:1;display:grid;gap:2px}
.dm-door-name{
  font-size:13px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-door-state{font-size:11.5px;font-weight:600;color:var(--dm-sec-dim,#64748b)}
.dm-door-pin{flex:0 0 auto;font-size:14px;opacity:.75}
#${KEYPAD_ID} .dm-door-keypad-error:not(:empty){
  display:block;margin:6px 0 0;color:var(--error-color,#dc2626);
  font-size:12px;font-weight:800;text-align:center}
#${KEYPAD_ID} .keypad-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`,
  );
}

export function installSecurityDoorsSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  // Dopo ogni ridisegno della sezione: la vetrina rifa' lo scheletro e questo
  // blocco si rimette al suo posto, fra la centrale e le telecamere.
  /* Il blocco non vive più dentro la Sicurezza: la voce e la pagina nascono
   * col giro generale del disegno, come le altre pagine a runtime. */
  const agganciaRender = () => {
    wrapFunction("renderSecurity", "__dmSecurityDoors", schedule);
    wrapFunction("render", "__dmSecurityDoorsGiro", schedule);
    wrapFunction("cdApplyNavVis", "__dmSecurityDoorsVis", schedule);
  };
  agganciaRender();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
    "pageshow",
  ]) {
    root.addEventListener?.(eventName, () => {
      agganciaRender();
      schedule();
    });
  }
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    if (paginaVisibile()) schedule();
  });
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(`[data-tab="${APERTURE_TAB}"]`)) root.queueMicrotask?.(schedule);
    },
    true,
  );
  if (doc.readyState === "loading")
    doc.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
}

installSecurityDoorsSection();
