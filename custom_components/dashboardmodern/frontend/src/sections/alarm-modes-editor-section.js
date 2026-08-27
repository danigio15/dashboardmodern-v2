/* Quali tasti dell'antifurto si vogliono vedere.
 *
 * La centrale dichiara cosa accetta, e la plancia da li' in poi mostrava tutto
 * quello che accettava. Una Ring accetta cinque inserimenti: chi in vacanza non
 * ci va mai si ritrova due tasti che non premera' mai, e quello che usa ogni
 * sera in fondo alla fila.
 *
 * Qui la fila si spunta. Le caselle sono solo quelle che la centrale accetta —
 * non si puo' chiedere di vedere un tasto che non farebbe niente — e lo sblocco
 * non compare fra le scelte: quello c'e' sempre.
 *
 * Il blocco vive nella scheda Sicurezza, sotto le caselle dell'antifurto, e
 * scrive in una casella sola. Chi disegna la fila la legge: la regola di cosa
 * si vede sta in `core/alarm-panel.js`, qui c'e' solo il modo di dirla.
 */
import {
  ALARM_MODES,
  ALARM_MODE_CHOICE_KEY,
  alarmHiddenModes,
} from "../core/alarm-panel.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ALARM_MODES_EDITOR__";
const STYLE_ID = "dm-alarm-modes-style";
const BLOCK_ID = "dm-alarm-modes";
const state = (root[KEY] ||= { installed: false, osservato: null, osservatore: null });

const ETICHETTE = () => ({
  home: t("Casa", "Home"),
  away: t("Fuori", "Away"),
  night: t("Notte", "Night"),
  vacation: t("Vacanza", "Vacation"),
  custom: t("Parziale", "Partial"),
});

/* Cosa la centrale accetta davvero. Lo sa gia' la sezione Sicurezza, che ha in
 * mano lo stato dell'entita': si chiede a lei invece di risolverla una seconda
 * volta e rischiare due risposte diverse alla stessa domanda. */
function accettate() {
  let elenco = [];
  try {
    elenco = root.dmAlarmSupportedModes?.() || [];
  } catch (_error) {
    elenco = [];
  }
  const validi = new Set(ALARM_MODES.map((voce) => voce.mode));
  return ALARM_MODES.map((voce) => voce.mode).filter(
    (mode) => validi.has(mode) && elenco.includes(mode),
  );
}

function tolte() {
  return new Set(alarmHiddenModes(readJson(ALARM_MODE_CHOICE_KEY, [])));
}

function scrivi(insieme) {
  writeJsonIfChanged(ALARM_MODE_CHOICE_KEY, [...insieme]);
  try {
    root.render?.();
  } catch (_error) {}
}

function markup(modi) {
  const nomi = ETICHETTE();
  const fuori = tolte();
  const pastiglie = modi
    .map((mode) => {
      const dentro = !fuori.has(mode);
      return `<button type="button" class="dm-alarm-mode" data-dm-alarm-mode="${esc(mode)}"
        data-on="${dentro}" aria-pressed="${dentro}">${esc(nomi[mode] || mode)}</button>`;
    })
    .join("");
  return `<div class="ed-slot dm-alarm-modes-slot">
      <span class="ed-slot-lbl">${esc(t("Modalità da mostrare", "Modes to show"))}</span>
      <p class="ed-intro dm-alarm-modes-intro">${esc(
        t(
          "Ci sono solo le modalità che la centrale accetta davvero. Toglierne una la nasconde dalla sezione e non cambia niente di quello che la centrale sa fare; lo sblocco resta sempre.",
          "Only the modes the panel actually accepts are listed. Removing one hides it from the section and changes nothing about what the panel can do; disarm always stays.",
        ),
      )}</p>
      <div class="dm-alarm-modes-row">${pastiglie}</div>
    </div>`;
}

/* La casella in cui la centrale e' scritta: e' lei a dire che siamo nella
 * scheda giusta. Si guarda quella, non quale linguetta risulta accesa: chi
 * disegna la scheda annuncia di averla rifatta prima di accendere la linguetta,
 * e chi si fidava della linguetta arrivava sempre un giro in anticipo — trovava
 * la scheda vecchia, si toglieva, e non tornava piu'. */
function casellaDellaCentrale() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return null;
  return (
    [...body.querySelectorAll(".ed-slot")].find((slot) =>
      clean(slot.querySelector(".ed-slot-in[data-ref]")?.getAttribute("data-ref")).startsWith(
        "dm.security_centrale",
      ),
    ) || null
  );
}

export function ensureAlarmModesBlock() {
  const casella = casellaDellaCentrale();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  const modi = casella ? accettate() : [];
  if (!casella || modi.length < 2) {
    blocco?.remove();
    return false;
  }
  const firma = `${modi.join(",")}§${[...tolte()].sort().join(",")}`;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-alarm-modes";
    casella.after(blocco);
  } else if (blocco.previousElementSibling !== casella) {
    /* La scheda si rifa' da capo: il blocco che era rimasto attaccato alla
     * casella di prima va rimesso sotto quella nuova. */
    casella.after(blocco);
  }
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup(modi);
  return true;
}

function onClick(event) {
  const pastiglia = event.target?.closest?.("[data-dm-alarm-mode]");
  if (!pastiglia || !doc?.getElementById?.(BLOCK_ID)?.contains(pastiglia)) return;
  event.preventDefault();
  event.stopPropagation();
  const mode = clean(pastiglia.getAttribute("data-dm-alarm-mode"));
  if (!mode) return;
  const fuori = tolte();
  if (fuori.has(mode)) fuori.delete(mode);
  else fuori.add(mode);
  /* Toglierli tutti vorrebbe dire una sezione col solo sblocco: chi sceglie di
   * non vederne nessuno sta sbagliando gesto, non esprimendo una preferenza. */
  if (fuori.size >= accettate().length) {
    root.edToast?.(t("Almeno una modalità deve restare", "At least one mode has to stay"));
    return;
  }
  scrivi(fuori);
  ensureAlarmModesBlock();
  root.edToast?.(
    fuori.has(mode)
      ? t("🛡️ Modalità nascosta", "🛡️ Mode hidden")
      : t("🛡️ Modalità mostrata", "🛡️ Mode shown"),
  );
}

function css() {
  return `
      #ed-body .dm-alarm-modes-slot{display:flex;flex-direction:column;gap:6px}
      #ed-body .dm-alarm-modes-intro{margin:0}
      #ed-body .dm-alarm-modes-row{display:flex;flex-wrap:wrap;gap:8px}
      #ed-body .dm-alarm-mode{
        font-family:inherit;cursor:pointer;padding:8px 15px;border-radius:999px;
        border:1.5px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc);
        color:var(--text-dim,#64748b);font-size:12px;font-weight:800;letter-spacing:.6px;
        text-transform:uppercase;transition:border-color .18s ease,background .18s ease,color .18s ease}
      #ed-body .dm-alarm-mode[data-on="true"]{
        border-color:#0ea5e9;color:#0284c7;
        background:color-mix(in srgb,#0ea5e9 12%,var(--surface-2,#f8fafc))}
      #ed-body .dm-alarm-mode[data-on="false"]{opacity:.62;text-decoration:line-through}
      #ed-body .dm-alarm-mode:focus-visible{outline:2px solid var(--primary-color,#0ea5e9);outline-offset:2px}
      @media(prefers-reduced-motion:reduce){#ed-body .dm-alarm-mode{transition:none}}
    `;
}

/* Quando la scheda e' stata rifatta lo dice il corpo della scheda, non un orologio.
 *
 * L'aggancio a `editorSwitch` si prova lo stesso — e' la strada di casa — ma non
 * si puo' dare per fatto: quella funzione e' della plancia storica e quando i
 * moduli si installano puo' non esserci ancora; l'aggancio fallisce in silenzio
 * e da quel momento nessuno avvisa piu' nessuno. E anche riuscito, avvisa quando
 * la linguetta cambia, non quando il corpo e' pronto: il corpo lo monta chi
 * disegna, e puo' arrivare un giro dopo.
 *
 * Il corpo che cambia figli e' l'unico segnale che vuol dire davvero «la scheda
 * e' nuova»: si guarda quello. L'osservatore si attacca al corpo di adesso — la
 * finestra si apre e si chiude, e ogni volta il corpo e' un altro. */
function aggancia() {
  onEditorRedraw("dmAlarmModes", ensureAlarmModesBlock);
  const body = doc?.getElementById?.("ed-body");
  if (!body || state.osservato === body) return;
  state.osservato = body;
  state.osservatore?.disconnect?.();
  if (typeof root.MutationObserver !== "function") return;
  state.osservatore = new root.MutationObserver(() => {
    root.queueMicrotask?.(ensureAlarmModesBlock);
  });
  state.osservatore.observe(body, { childList: true });
}

function onTabClick(event) {
  if (!event.target?.closest?.(".ed-tab")) return;
  aggancia();
  root.queueMicrotask?.(ensureAlarmModesBlock);
}

export function installAlarmModesEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("click", onTabClick, true);
  /* La finestra si apre da un tasto qualunque della plancia: al primo clic il
   * corpo puo' non esserci ancora, al secondo si'. Guardare ogni clic costa una
   * ricerca per id, e smette di costare appena l'osservatore e' attaccato. */
  doc.addEventListener("click", () => root.queueMicrotask?.(aggancia), true);
  aggancia();
  ensureAlarmModesBlock();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installAlarmModesEditorSection, { once: true });
} else {
  installAlarmModesEditorSection();
}
