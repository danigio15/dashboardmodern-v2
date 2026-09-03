// DM-FIX-20260817C
/* Security section redesign.
 *
 * Rebuilds the Sicurezza page as an operations console: a masthead, one alarm
 * console with a radar-style status orb, and the cameras as light cards that
 * match the rest of the dashboard. Only the video area itself stays dark, which
 * is the letterbox of the frame rather than a panel behind the cards.
 *
 * Contracts preserved on purpose — the legacy runtime keeps owning behaviour:
 * - the alarm console is still `#alarm-stage`, so the legacy render loop keeps
 *   toggling `.armed` / `.triggered`, writing `--al-col` / `--al-rgb` /
 *   `--al-soft` and hiding the block when the alarm is not mapped;
 * - `#alarm-icon-new`, `#alarm-state-text-new` and `#alarm-state-timer` (with
 *   its `.show` class) keep the same ids, and the mode buttons keep the
 *   `.alarm-mode-btn[data-mode]` contract plus their `promptPinAndSet()` calls,
 *   so the PIN keypad flow is untouched;
 * - camera tiles stay `.cam-card` inside `#cam-grid` with `<img id="cam-…">`
 *   and `.cam-time`, which is what `refreshCameras()` / the live-ui camera
 *   owner / `updateCamClocks()` write into;
 * - opening a camera still goes through `apriCamera(slug, title)`, so WebRTC →
 *   HLS → MJPEG → polling, the audio panel and `toggleFullScreenCam()` behave
 *   exactly as before.
 *
 * "Protetto / Intrusione" is rendered from the legacy `.armed` / `.triggered`
 * classes in pure CSS, so no alarm logic is duplicated here. The three words
 * are the only copy this file keeps in a stylesheet, and they are written into
 * it in the active language: text that lives in `content:` produces no text
 * node, so neither the catalog nor the DOM pass can reach it afterwards. The
 * stylesheet is therefore rebuilt when the language changes.
 */
import {
  ALARM_DISARM,
  ALARM_MODE_CHOICE_KEY,
  CHIAVE_CENTRALE_SCELTA,
  CHIAVE_CENTRALI,
  RIF_CENTRALE,
  alarmActiveMode,
  alarmCodeNeeded,
  alarmModes,
  alarmVisibleModes,
  centraliAllarme,
  entitaDellaCentrale,
  nomeDellaCentrale,
  overridesPerCentrale,
} from "../core/alarm-panel.js";
import {
  activeLocale,
  allStates,
  clean,
  doc,
  english,
  esc,
  installStyle,
  readJson,
  restyleOnLocaleChange,
  root,
  section,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SECURITY_SHOWCASE__";
const STYLE_ID = "dm-security-showcase-style";
const state = (root[KEY] ||= { installed: false, listeners: false, requestingFrames: false });

const OFFLINE_STATES = new Set(["", "unavailable", "unknown", "none", "null"]);

const ICONS = Object.freeze({
  shield:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2 5 6v5.3c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V6l-7-2.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9.2 12.1 2 2 3.6-3.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  camera:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 8.6 17 5.2l1.5 5.2L5 13.8 3.5 8.6Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.5 10.4 21.4 9l.9 3.2-2.9.9" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M6.6 13.4 8 18.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="19.4" r="1.6" stroke="currentColor" stroke-width="1.7"/></svg>',
  expand:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 4.5H4.5V9.5M14.5 4.5h5v5M9.5 19.5h-5v-5M14.5 19.5h5v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  signal:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.8 4.8 19.2 19.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 15.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="currentColor"/><path d="M7.6 12.4a6.2 6.2 0 0 1 3-1.7M16.4 12.4a6.2 6.2 0 0 0-2.3-1.5M4.6 9.2a10.6 10.6 0 0 1 3.6-2.2M19.4 9.2a10.6 10.6 0 0 0-4.6-2.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
});

const copy = () => ({
  title: sectionName(),
  subtitle: t("Antifurto e videosorveglianza", "Alarm system and video surveillance"),
  alarmCap: t("Stato antifurto", "Alarm status"),
  /* Il nome di ripiego di un'area senza nome, e come si dice come sta.
   *
   * Sotto il nome ci va uno STATO, non un comando: «Sblocca» è l'etichetta del
   * tasto che disinserisce, e letta lì diceva a chi guarda di premere invece
   * di dirgli che quell'area è a riposo. */
  area: t("Area", "Area"),
  /* Un trattino non è una parola: chiedere a tredici traduttori come si dice
   * «—» è il modo di avere tredici trattini diversi. */
  areaMuta: "—",
  areaSpenta: t("Disinserita", "Disarmed"),
  areaAccesa: (modo) => t(`Inserita · ${modo}`, `Armed · ${modo}`),
  loading: t("CARICAMENTO", "LOADING"),
  modes: {
    home: { label: t("Casa", "Home"), hint: t("Solo perimetro", "Perimeter only") },
    away: { label: t("Fuori", "Away"), hint: t("Inserimento totale", "Full arm") },
    night: { label: t("Notte", "Night"), hint: t("Perimetro attivo", "Perimeter") },
    vacation: { label: t("Vacanza", "Vacation"), hint: t("Assenza lunga", "Extended away") },
    custom: { label: t("Parziale", "Partial"), hint: t("Con esclusioni", "With bypass") },
    disarm: { label: t("Sblocca", "Disarm"), hint: t("Disinserisci", "Turn off") },
  },
  cctv: t("Videosorveglianza", "Video surveillance"),
  rec: "REC",
  live: "LIVE",
  noSignal: t("Nessun segnale", "No signal"),
  channelsOne: t("1 canale", "1 channel"),
  channels: (value) => t(`${value} canali`, `${value} channels`),
  activeCount: (value) => t(`${value} attivi`, `${value} live`),
  offlineCount: (value) => t(`${value} offline`, `${value} offline`),
  cctvOn: t("TVCC attivo", "CCTV live"),
  cctvOff: t("TVCC offline", "CCTV offline"),
  cctvNone: t("TVCC non configurato", "CCTV not configured"),
  empty: t("Nessuna telecamera configurata", "No camera configured"),
  emptyHint: t(
    "Aggiungi le tue telecamere dalla Configurazione: appariranno qui con anteprima live.",
    "Add your cameras from Configuration: they will show up here with a live preview.",
  ),
  emptyCta: t("Apri configurazione", "Open configuration"),
  openCamera: t("Apri la telecamera", "Open camera"),
});

function sectionName() {
  const names = readJson("cd_section_names", {});
  const custom = clean(names?.security);
  return custom || t("Sicurezza", "Security");
}

/* ── data ─────────────────────────────────────────────────────────────── */

export function securityCameras() {
  if (typeof root.getCameras === "function") {
    try {
      const values = root.getCameras();
      if (Array.isArray(values)) return values;
    } catch (_error) {}
  }
  const canonical = section("cameras", null);
  const values =
    Array.isArray(canonical) && canonical.length ? canonical : readJson("cd_cameras", []);
  return Array.isArray(values) ? values : [];
}

export function cameraSlug(camera, index) {
  if (typeof root.camSlug === "function") {
    try {
      const value = clean(root.camSlug(camera, index));
      if (value) return value;
    } catch (_error) {}
  }
  const entity = clean(camera?.entity || camera?.camera_entity || camera?.cam);
  return `cam-${entity.includes(".") ? entity.split(".")[1] : `x${index}`}`;
}

export function cameraOffline(entity, states = allStates()) {
  const value = clean(states?.[clean(entity)]?.state).toLowerCase();
  return OFFLINE_STATES.has(value);
}

function cameraModels(cameras = securityCameras()) {
  return cameras.map((camera, index) => {
    const entity = clean(camera?.entity || camera?.camera_entity || camera?.cam);
    const name = clean(camera?.name) || entity || `CAM ${index + 1}`;
    const channel = String(index + 1).padStart(2, "0");
    return {
      slug: cameraSlug(camera, index),
      entity,
      name,
      channel,
      // Keep the legacy popup heading so the detail modal title is unchanged.
      title: `CAM ${channel} // ${name.toUpperCase()}`,
    };
  });
}

/* ── markup ───────────────────────────────────────────────────────────── */

/* ── le aree: più di una centrale (#285) ──────────────────────────────── */

/* «Se si hanno 2 aree la pagina ne gestisce una sola. Sarebbe funzionale poter
 * mettere più pannelli, come l'inserimento di telecamere.»
 *
 * Quella che si comanda è sempre quella scritta nella mappatura di sempre:
 * passare a un'altra area vuol dire scriverci la sua, e il tastierino, il
 * servizio che parte e la tessera della Home continuano a leggere l'unico posto
 * che hanno sempre letto. Vale la regola di `piu-di-uno.js`. */
function centraliDiCasa() {
  return centraliAllarme(
    readJson(CHIAVE_CENTRALI, []),
    readJson("cd_entity_overrides", {}),
    clean(root.localStorage?.getItem?.(CHIAVE_CENTRALE_SCELTA)),
  );
}

function passaAllAreaAllarme(id) {
  const lista = centraliDiCasa();
  const scelta = lista.find((riga) => riga.id === clean(id));
  if (!scelta || scelta.corrente) return false;
  /* Quella che esce di scena si porta via la sua mappatura: è quella che sta
   * negli override adesso, e senza rimetterla in elenco andrebbe persa alla
   * prima scrittura di quella che entra. */
  writeJsonIfChanged(
    CHIAVE_CENTRALI,
    lista.map((riga) => ({ id: riga.id, nome: riga.nome, caselle: riga.caselle })),
  );
  root.localStorage?.setItem?.(CHIAVE_CENTRALE_SCELTA, scelta.id);
  const prossime = overridesPerCentrale(readJson("cd_entity_overrides", {}), scelta);
  writeJsonIfChanged("cd_entity_overrides", prossime);
  try {
    root.cdApplyCanonicalOverrides?.(prossime);
  } catch (_error) {}
  try {
    root.render?.();
  } catch (_error) {}
  return true;
}

/* La fila delle aree, sopra il quadrante. Ogni area porta il suo nome e come
 * sta adesso: con due aree si vuole sapere se l'altra è inserita senza dover
 * passare di là, e un selettore che dice solo i nomi non lo direbbe. */
function filaDelleAree(lista, labels) {
  if (lista.length < 2) return "";
  const states = allStates();
  return `<div class="dm-sec-aree" role="tablist">${lista
    .map((riga, indice) => {
      const stato = states?.[entitaDellaCentrale(riga)];
      const modo = alarmActiveMode(stato?.state);
      const acceso = clean(stato?.state).toLowerCase().startsWith("armed");
      const testi = labels.modes[modo] || null;
      let come = labels.areaMuta;
      if (acceso) come = testi ? labels.areaAccesa(testi.label) : labels.areaSpenta;
      else if (stato) come = labels.areaSpenta;
      return `<button type="button" class="dm-sec-area" data-dm-area="${esc(riga.id)}"
        role="tab" aria-selected="${riga.corrente === true}"${riga.corrente ? ' data-on="true"' : ""}
        data-armata="${acceso}">
        <b>${esc(nomeDellaCentrale(riga, indice, labels.area))}</b>
        <small>${esc(come)}</small>
      </button>`;
    })
    .join("")}</div>`;
}

function syncAree(shell, labels) {
  const lista = centraliDiCasa();
  const stage = shell.querySelector("#alarm-stage");
  if (!stage) return false;
  let fila = shell.querySelector("[data-dm-sec-aree]");
  if (lista.length < 2) {
    fila?.remove();
    return false;
  }
  if (!fila) {
    fila = doc.createElement("div");
    fila.dataset.dmSecAree = "true";
    stage.before(fila);
  }
  const markup = filaDelleAree(lista, labels);
  if (fila.innerHTML !== markup) fila.innerHTML = markup;
  return true;
}

/* Lo stato della centrale, con l'entita' risolta come la risolve il runtime. */
function alarmStateObject() {
  const riferimento = RIF_CENTRALE;
  let risolto = riferimento;
  try {
    risolto = clean(root.resolveEntity?.(riferimento)) || riferimento;
  } catch (_error) {}
  const states = allStates();
  return states[risolto] || states[riferimento] || null;
}

/* La fila dei tasti: uno per ogni inserimento che la centrale accetta davvero,
 * piu' lo sblocco. Un tasto che chiama un servizio che la centrale non ha e'
 * un tasto che non fa niente — e non deve stare li'. */
/* I tasti scelti: quelli che la centrale accetta, meno quelli che si e' detto
 * di non voler vedere. La scelta sta in configurazione, sotto Antifurto. */
function modiVisibili(stateObj = alarmStateObject()) {
  return alarmVisibleModes(stateObj, readJson(ALARM_MODE_CHOICE_KEY, []));
}

function modeRow(labels, stateObj = alarmStateObject()) {
  return modiVisibili(stateObj)
    .map((voce) => {
      const testi = labels.modes[voce.mode] || labels.modes[ALARM_DISARM.mode];
      return modeButton({ ...voce, label: testi.label, hint: testi.hint });
    })
    .join("");
}

/* Quali tasti ci sono adesso: si riscrive la fila solo quando cambiano, non a
 * ogni evento di stato — riscriverla sempre spegnerebbe l'animazione del tasto
 * acceso due volte al secondo. */
function modeSignature(stateObj) {
  return modiVisibili(stateObj)
    .map((voce) => voce.mode)
    .join(",");
}

function syncModes(shell, labels) {
  const fila = shell.querySelector("[data-dm-alarm-modes]");
  if (!fila) return false;
  const stateObj = alarmStateObject();
  const firma = modeSignature(stateObj);
  if (fila.dataset.dmModes === firma) return false;
  fila.dataset.dmModes = firma;
  fila.innerHTML = modeRow(labels, stateObj);
  /* Il tasto acceso lo marca il giro di disegno storico, ed era marcato su un
   * tasto che adesso non c'e' piu': rifare la fila lo spegne. Gli si chiede di
   * ripassare — succede solo quando i tasti cambiano davvero, cioe' una volta
   * all'avvio, e il differita evita di rientrare in questo stesso giro. */
  root.setTimeout?.(() => {
    try {
      root.render?.();
    } catch (_error) {}
  }, 0);
  return true;
}

function modeButton({ mode, service, icon, label, hint }) {
  return `<button type="button" class="alarm-mode-btn dm-sec-mode" data-mode="${mode}" onclick="promptPinAndSet('${service}')">
      <span class="dm-sec-mode-ic" aria-hidden="true">${icon}</span>
      <span class="dm-sec-mode-tx">${esc(label)}</span>
      <span class="dm-sec-mode-hint">${esc(hint)}</span>
    </button>`;
}

function skeletonMarkup(labels) {
  return `<div class="dm-sec-shell" data-dm-lang="${activeLocale()}">
  <div class="dm-sec-mast">
    <span class="dm-sec-mast-ic" aria-hidden="true">${ICONS.shield}</span>
    <div class="dm-sec-mast-copy">
      <h2>${esc(labels.title)}</h2>
      <p>${esc(labels.subtitle)}</p>
    </div>
    <span class="dm-sec-pill" data-dm-cctv-pill data-live="0"><i aria-hidden="true"></i><b>${esc(labels.cctvNone)}</b></span>
  </div>

  <section class="dm-sec-alarm" id="alarm-stage">
    <span class="dm-sec-ridge" aria-hidden="true"></span>
    <span class="dm-sec-mesh" aria-hidden="true"></span>
    <div class="dm-sec-readout">
      <span class="dm-sec-orb" aria-hidden="true">
        <span class="dm-sec-orb-track"></span>
        <span class="dm-sec-orb-sweep"></span>
        <span class="dm-sec-orb-core"><span id="alarm-icon-new">🛡️</span></span>
        <span class="dm-sec-beacon" id="alarm-status-dot"></span>
      </span>
      <div class="dm-sec-readout-copy">
        <span class="dm-sec-cap">${esc(labels.alarmCap)}</span>
        <strong id="alarm-state-text-new">${esc(labels.loading)}</strong>
        <span class="dm-sec-readout-meta">
          <span class="dm-sec-chip"></span>
          <span class="dm-sec-timer" id="alarm-state-timer"></span>
        </span>
      </div>
    </div>
    <div class="dm-sec-modes" data-dm-alarm-modes>${modeRow(labels)}</div>
  </section>

  <section class="dm-sec-cctv">
    <div class="dm-sec-cctv-head">
      <span class="dm-sec-cctv-ic" aria-hidden="true">${ICONS.camera}</span>
      <h3>${esc(labels.cctv)}</h3>
      <span class="dm-sec-rec"><i aria-hidden="true"></i>${esc(labels.rec)}</span>
      <span class="dm-sec-cctv-meta" data-dm-cam-meta></span>
      <span class="dm-sec-clock cam-time">--:--:--</span>
    </div>
    <div class="cam-grid dm-sec-grid" id="cam-grid"></div>
    <div class="dm-sec-empty" data-dm-cam-empty hidden>
      <span class="dm-sec-empty-ic" aria-hidden="true">${ICONS.camera}</span>
      <strong>${esc(labels.empty)}</strong>
      <p>${esc(labels.emptyHint)}</p>
      <button type="button" class="dm-sec-empty-cta" data-dm-open-config>${esc(labels.emptyCta)}</button>
    </div>
  </section>
</div>`;
}

function cardMarkup(model, labels) {
  return `<article class="cam-card dm-cam" data-dm-cam="${esc(model.slug)}" data-dm-entity="${esc(model.entity)}" data-dm-title="${esc(model.title)}" role="button" tabindex="0" aria-label="${esc(labels.openCamera)}: ${esc(model.name)}">
      <div class="dm-cam-feed">
        <img id="${esc(model.slug)}" alt="" decoding="async">
        <span class="dm-cam-frame" aria-hidden="true"></span>
        <div class="dm-cam-top">
          <span class="dm-cam-live"><i aria-hidden="true"></i>${esc(labels.live)}</span>
          <span class="dm-cam-ch">CH${esc(model.channel)}</span>
        </div>
        <span class="dm-cam-open" aria-hidden="true">${ICONS.expand}</span>
        <div class="dm-cam-off">
          <span class="dm-cam-off-ic" aria-hidden="true">${ICONS.signal}</span>
          <b>${esc(labels.noSignal)}</b>
        </div>
      </div>
      <footer class="dm-cam-foot">
        <span class="dm-cam-name">${esc(model.name)}</span>
        <span class="dm-cam-time cam-time" id="time-${esc(model.slug.replace(/^cam-/, ""))}">--:--:--</span>
      </footer>
    </article>`;
}

/* ── rendering ────────────────────────────────────────────────────────── */

function ensureSkeleton(host, labels) {
  if (host.querySelector(":scope > .dm-sec-shell")) return false;
  const backButton = host.querySelector(":scope > .back-home-btn");
  host.innerHTML = skeletonMarkup(labels);
  if (backButton) host.insertBefore(backButton, host.firstChild);
  return true;
}

/* The frames belong to the live owner in live-ui-section.js: it holds the
 * object URLs, the auth fallback and the refresh timer. This is the one call
 * that asks it to paint, deferred so the wall is in the document first, and
 * guarded so a wall the owner itself just asked to be built does not ask back. */
function requestCameraFrames() {
  if (state.requestingFrames) return;
  state.requestingFrames = true;
  root.setTimeout?.(() => {
    state.requestingFrames = false;
    try {
      root.refreshCameras?.();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] camera frames", error);
    }
  }, 0);
}

function cardsSignature(models) {
  return JSON.stringify(
    models.map((model) => [model.slug, model.entity, model.name, model.channel]),
  );
}

/**
 * Rebuild the camera wall only when the configured cameras really changed.
 * A blind innerHTML rewrite would drop every `<img>` already holding a live
 * frame, so the wall would flash grey on every Home Assistant state event.
 */
function syncCards(grid, models, labels) {
  const legacyCards = grid.querySelector(":scope > .cam-card:not(.dm-cam)");
  const signature = cardsSignature(models);
  if (!legacyCards && grid._sig === signature) return false;
  grid.innerHTML = models.map((model) => cardMarkup(model, labels)).join("");
  grid._sig = signature;
  return true;
}

export function renderSecurity() {
  const host = doc?.getElementById?.("page-security");
  if (!host) return false;
  const labels = copy();
  ensureSkeleton(host, labels);
  const shell = host.querySelector(":scope > .dm-sec-shell");
  const grid = doc.getElementById("cam-grid");
  if (!shell || !grid) return false;

  /* I tasti seguono la centrale: cambiare integrazione — o mapparla per la
   * prima volta — cambia quello che accetta, e la fila si rifa'. */
  syncModes(shell, labels);
  /* E la fila delle aree, quando ce n'è più d'una. */
  syncAree(shell, labels);

  const models = cameraModels();
  // A rebuilt wall is a wall of empty <img> elements: whatever frame the live
  // owner had already written is gone with the markup it lived in, and nothing
  // in a camera's Home Assistant state changes to ask for another one. So the
  // wall asks for it itself, right after it rebuilds.
  if (syncCards(grid, models, labels) && models.length) requestCameraFrames();

  const states = allStates();
  let online = 0;
  for (const card of grid.querySelectorAll(":scope > .dm-cam")) {
    const offline = cameraOffline(card.dataset.dmEntity, states);
    card.classList.toggle("is-off", offline);
    if (!offline) online += 1;
  }

  const total = models.length;
  const empty = shell.querySelector("[data-dm-cam-empty]");
  if (empty) empty.hidden = total > 0;
  grid.hidden = total === 0;
  shell.querySelector(".dm-sec-cctv")?.classList.toggle("is-empty", total === 0);

  const meta = shell.querySelector("[data-dm-cam-meta]");
  if (meta) {
    const channels = total === 1 ? labels.channelsOne : labels.channels(total);
    const detail =
      online === total ? labels.activeCount(online) : labels.offlineCount(total - online);
    meta.textContent = total ? `${channels} · ${detail}` : "";
  }

  const pill = shell.querySelector("[data-dm-cctv-pill]");
  if (pill) {
    const live = total > 0 && online > 0;
    pill.dataset.live = live ? "1" : "0";
    const text = pill.querySelector("b");
    if (text)
      text.textContent = total === 0 ? labels.cctvNone : live ? labels.cctvOn : labels.cctvOff;
  }
  return true;
}

/* ── wiring ───────────────────────────────────────────────────────────── */

function securityVisible() {
  return Boolean(doc?.getElementById("page-security")?.classList.contains("active"));
}

function openCamera(card) {
  const slug = clean(card?.dataset?.dmCam);
  if (!slug || typeof root.apriCamera !== "function") return;
  root.apriCamera(slug, clean(card.dataset.dmTitle));
}

function onShellClick(event) {
  const target = event.target;
  const area = target?.closest?.("[data-dm-area]");
  if (area) {
    event.preventDefault();
    if (passaAllAreaAllarme(clean(area.dataset.dmArea))) {
      try {
        renderSecurity();
      } catch (_error) {}
    }
    return;
  }
  if (target?.closest?.("[data-dm-open-config]")) {
    event.preventDefault();
    root.apriConfigEntita?.();
    return;
  }
  const card = target?.closest?.(".dm-cam[data-dm-cam]");
  if (card) openCamera(card);
}

function onShellKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target?.closest?.(".dm-cam[data-dm-cam]");
  if (!card) return;
  event.preventDefault();
  openCamera(card);
}

/**
 * The legacy `buildCamCards` is still called by `dmSaveCameras`, by the store
 * render coordinator and by the live-ui camera owner. Route all of them to the
 * redesigned wall so no caller can repaint the legacy markup underneath it.
 */
function installOverrides() {
  const current = root.buildCamCards;
  if (typeof current !== "function" || !current.__dmSecurityShowcase) {
    function buildCamCardsShowcase() {
      return renderSecurity();
    }
    buildCamCardsShowcase.__dmSecurityShowcase = true;
    buildCamCardsShowcase.__dmPrevious = current;
    root.buildCamCards = buildCamCardsShowcase;
  }
  const currentRender = root.renderSecurity;
  if (typeof currentRender !== "function" || !currentRender.__dmSecurityShowcase) {
    function renderSecurityShowcase() {
      return renderSecurity();
    }
    renderSecurityShowcase.__dmSecurityShowcase = true;
    renderSecurityShowcase.__dmPrevious = currentRender;
    root.renderSecurity = renderSecurityShowcase;
  }
}

/* Le due domande sulla centrale, per il runtime vecchio.
 *
 * Il tasto acceso e il tastierino li disegna e li apre la plancia storica, che
 * e' uno script normale e non puo' importare un modulo. La regola pero' deve
 * restare una sola: sta in `core/alarm-panel.js`, e qui le si apre una porta.
 * Se questi non ci sono, il runtime si comporta come si e' sempre comportato. */
function publishAlarmHelpers() {
  root.dmAlarmCodeNeeded = (service) => alarmCodeNeeded(alarmStateObject(), service);
  /* Quale tasto e' acceso, con due domande separate.
   *
   * Il ripiego su «Fuori» dentro `alarmActiveMode` serve per le centrali che
   * un inserimento non lo dichiarano: la casa e' inserita, il tasto giusto non
   * esiste, e accendere quello generico e' meglio di non accenderne nessuno.
   * Non serve per un tasto tolto a mano: li' il tasto giusto la centrale ce
   * l'ha, e' chi guarda che ha scelto di non vederlo, e accendere «Fuori»
   * significherebbe dire che la casa e' inserita fuori quando e' inserita in
   * casa. Su un antifurto e' la bugia peggiore che si possa dire.
   *
   * Quindi il ripiego lo si calcola su quello che la centrale ACCETTA, e poi
   * si spegne tutto se quel tasto non e' fra quelli che si vedono. */
  root.dmAlarmActiveMode = (state) => {
    const acceso = alarmActiveMode(
      state,
      alarmModes(alarmStateObject()).map((voce) => voce.mode),
    );
    if (!acceso) return "";
    return modiVisibili().some((voce) => voce.mode === acceso) ? acceso : "";
  };
  root.dmAlarmModes = () => modiVisibili().map((voce) => voce.mode);
  /* Quelle che la centrale ACCETTA, scelta o non scelta: e' l'elenco che la
   * configurazione deve poter spuntare. */
  root.dmAlarmSupportedModes = () => alarmModes(alarmStateObject()).map((voce) => voce.mode);
}

export function installSecurityShowcaseSection() {
  if (!doc) return;
  installStyle(STYLE_ID, securityCss());
  publishAlarmHelpers();
  installOverrides();
  if (!state.listeners) {
    state.listeners = true;
    /* The chip words are baked into the stylesheet, so a language change has to
     * rebuild it — nothing else can reach text inside `content:`. */
    restyleOnLocaleChange(STYLE_ID, securityCss);
    doc.addEventListener("click", onShellClick);
    doc.addEventListener("keydown", onShellKeydown);
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "pageshow",
    ]) {
      root.addEventListener?.(eventName, () => {
        installOverrides();
        renderSecurity();
      });
    }
    // The legacy runtime registered its own `buildCamCards` on DOMContentLoaded
    // with a direct function reference, so the override above cannot intercept
    // that one call. Re-render right after it to reclaim the wall.
    if (doc.readyState === "loading") {
      doc.addEventListener("DOMContentLoaded", () => renderSecurity(), { once: true });
    }
    // Event-driven only: the camera frames keep arriving from the live-ui
    // camera owner and the clock from the legacy `updateCamClocks()` timer.
    root.addEventListener?.("dashboardmodern:state-changed", () => {
      if (securityVisible()) renderSecurity();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.('[data-tab="security"]')) {
          root.queueMicrotask?.(() => renderSecurity());
        }
      },
      true,
    );
  }
  state.installed = true;
  renderSecurity();
}

/* ── styles ───────────────────────────────────────────────────────────── */

/* A CSS string literal. The words come from the catalog, so a stray quote or
 * backslash in some language must not be able to end the declaration early. */
function cssString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function securityCss() {
  return `
.dm-sec-shell,.dm-sec-shell *,.dm-sec-shell *::before,.dm-sec-shell *::after{box-sizing:border-box}
.dm-sec-shell{
  --dm-sec-cyan:#22d3ee;--dm-sec-cyan-deep:#0284c7;
  --dm-sec-card:var(--card-bg,#fff);--dm-sec-border:var(--card-border,#e8edf3);
  --dm-sec-text:var(--text,#0f172a);--dm-sec-dim:var(--text-dim,#64748b);
  --dm-sec-mono:'Share Tech Mono','Monaco',ui-monospace,monospace;
  display:flex;flex-direction:column;gap:20px;
  width:100%;max-width:1250px;margin:0 auto;padding:2px;color:var(--dm-sec-text)
}

/* ── masthead (a row, not another box) ───────────────────────────────── */
.dm-sec-mast{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:2px 4px 0}
.dm-sec-mast-ic{
  width:50px;height:50px;flex:0 0 50px;display:grid;place-items:center;border-radius:16px;
  background:linear-gradient(140deg,#ffe4e6,#fee2e2 50%,#e0f2fe);color:#be123c;
  box-shadow:inset 0 0 0 1px rgba(190,18,60,.16)
}
.dm-sec-mast-ic svg{width:27px;height:27px}
.dm-sec-mast-copy{min-width:0;flex:1}
.dm-sec-mast-copy h2{
  margin:0;font-family:'Oswald',sans-serif;font-weight:700;
  font-size:clamp(24px,3.2vw,33px);line-height:1.06;letter-spacing:1.4px;text-transform:uppercase
}
.dm-sec-mast-copy p{margin:2px 0 0;font-size:12.5px;font-weight:600;color:var(--dm-sec-dim)}
.dm-sec-pill{
  display:inline-flex;align-items:center;gap:9px;height:36px;padding:0 15px;border-radius:999px;
  border:1px solid var(--dm-sec-border);background:var(--surface-3,#f1f5f9);color:var(--dm-sec-dim);
  font-family:var(--dm-sec-mono);font-size:11px;letter-spacing:1.4px;text-transform:uppercase;white-space:nowrap
}
.dm-sec-pill i{width:8px;height:8px;border-radius:50%;background:currentColor;flex:0 0 8px}
.dm-sec-pill[data-live="1"]{
  border-color:rgba(6,182,212,.32);background:rgba(6,182,212,.10);color:var(--dm-sec-cyan-deep)
}
.dm-sec-pill[data-live="1"] i{background:#06b6d4;animation:dmSecPing 2s ease-out infinite}

/* ── alarm console ───────────────────────────────────────────────────── */
.dm-sec-alarm{
  --al-col:#059669;--al-rgb:5,150,105;
  position:relative;overflow:hidden;isolation:isolate;
  padding:28px;border-radius:28px;
  border:1px solid rgba(var(--al-rgb),.24);
  background:
    radial-gradient(108% 128% at 92% -18%,rgba(var(--al-rgb),.15),transparent 55%),
    radial-gradient(86% 116% at 2% 116%,rgba(var(--al-rgb),.09),transparent 58%),
    var(--dm-sec-card);
  box-shadow:0 18px 46px rgba(15,23,42,.09);
  transition:border-color .6s ease,box-shadow .6s ease,background .6s ease
}
/* state ridge along the top edge */
.dm-sec-ridge{
  position:absolute;top:0;left:0;right:0;height:3px;z-index:3;overflow:hidden;
  background:linear-gradient(90deg,transparent,rgba(var(--al-rgb),.55) 18%,rgb(var(--al-rgb)) 50%,rgba(var(--al-rgb),.55) 82%,transparent)
}
.dm-sec-ridge::after{
  content:"";position:absolute;top:0;bottom:0;width:22%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent);opacity:0
}
.dm-sec-alarm.armed .dm-sec-ridge::after{opacity:.8;animation:dmSecRidge 3.4s linear infinite}
.dm-sec-alarm.triggered .dm-sec-ridge::after{opacity:.9;animation:dmSecRidge 1.1s linear infinite}
/* faint measurement mesh — the console texture */
.dm-sec-mesh{
  position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .6s ease;
  background-image:radial-gradient(rgba(var(--al-rgb),.30) 1px,transparent 1px);
  background-size:17px 17px;
  -webkit-mask-image:linear-gradient(115deg,rgba(0,0,0,.85),transparent 58%);
  mask-image:linear-gradient(115deg,rgba(0,0,0,.85),transparent 58%)
}
.dm-sec-alarm.armed .dm-sec-mesh,.dm-sec-alarm.triggered .dm-sec-mesh{opacity:1}

.dm-sec-readout{position:relative;z-index:1;display:flex;align-items:center;gap:22px}

/* radar orb: dashed perimeter + rotating sweep while the system is armed */
.dm-sec-orb{position:relative;width:106px;height:106px;flex:0 0 106px;display:grid;place-items:center}
.dm-sec-orb-track{
  position:absolute;inset:0;border-radius:50%;
  border:2px dashed rgba(var(--al-rgb),.40);transition:border-color .5s ease
}
.dm-sec-orb-sweep{
  position:absolute;inset:6px;border-radius:50%;opacity:0;transition:opacity .5s ease;
  background:conic-gradient(from 0deg,rgba(var(--al-rgb),.85),rgba(var(--al-rgb),.10) 26%,transparent 44%);
  /* an annulus, so the sweep reads as a radar arm instead of a filled disc */
  -webkit-mask-image:radial-gradient(closest-side,transparent 76%,#000 78%);
  mask-image:radial-gradient(closest-side,transparent 76%,#000 78%)
}
.dm-sec-orb-core{
  position:relative;z-index:2;width:74px;height:74px;border-radius:50%;
  display:grid;place-items:center;font-size:31px;line-height:1;
  background:var(--dm-sec-card);
  box-shadow:0 10px 26px rgba(var(--al-rgb),.26),inset 0 0 0 2px rgba(var(--al-rgb),.34)
}
.dm-sec-orb-core>span{filter:drop-shadow(0 3px 9px rgba(var(--al-rgb),.30))}
.dm-sec-alarm.armed .dm-sec-orb-track{animation:dmSecSpin 22s linear infinite}
.dm-sec-alarm.armed .dm-sec-orb-sweep{opacity:1;animation:dmSecSpin 4.5s linear infinite}
.dm-sec-alarm.triggered .dm-sec-orb-track{border-style:solid;animation:dmSecSpin 4s linear infinite}
.dm-sec-alarm.triggered .dm-sec-orb-sweep{opacity:1;animation:dmSecSpin 1.1s linear infinite}
.dm-sec-alarm.triggered .dm-sec-orb-core{animation:dmSecShout 1.1s ease-in-out infinite}
.dm-sec-beacon{
  position:absolute;top:6px;right:6px;z-index:3;width:15px;height:15px;border-radius:50%;
  background:var(--al-col);border:3px solid var(--dm-sec-card);
  box-shadow:0 0 0 0 rgba(var(--al-rgb),.6);animation:dmSecPing 2s ease-out infinite
}

.dm-sec-readout-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.dm-sec-cap{
  font-family:var(--dm-sec-mono);font-size:11px;letter-spacing:2.2px;
  text-transform:uppercase;color:var(--dm-sec-dim)
}
.dm-sec-readout-copy>strong{
  font-family:'Oswald',sans-serif;font-size:clamp(27px,4.4vw,40px);font-weight:700;
  line-height:1.02;letter-spacing:1px;text-transform:uppercase;color:var(--al-col);
  transition:color .5s ease
}
.dm-sec-readout-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px}
.dm-sec-chip{
  display:inline-flex;align-items:center;gap:7px;height:27px;padding:0 13px;border-radius:999px;
  background:rgba(var(--al-rgb),.12);border:1px solid rgba(var(--al-rgb),.26);color:rgb(var(--al-rgb));
  font-family:var(--dm-sec-mono);font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase
}
.dm-sec-chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 6px}
.dm-sec-chip::after{content:${cssString(t("Non protetto", "Unprotected"))}}
.dm-sec-alarm.armed .dm-sec-chip::after{content:${cssString(t("Protetto", "Protected"))}}
.dm-sec-alarm.triggered .dm-sec-chip::after{content:${cssString(t("Intrusione", "Intrusion"))}}
.dm-sec-timer{
  display:none;align-items:center;font-family:var(--dm-sec-mono);font-size:11.5px;letter-spacing:.9px;
  color:var(--dm-sec-dim);text-transform:uppercase
}
.dm-sec-timer.show{display:inline-flex}

/* Le aree (#285): la fila sopra il quadrante, con lo stato di ognuna.
   Con due aree si vuole sapere se l'altra è inserita senza passare di là. */
.dm-sec-aree{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.dm-sec-area{
  flex:1 1 140px;display:flex;flex-direction:column;gap:2px;align-items:flex-start;
  padding:9px 13px;border-radius:14px;font:inherit;text-align:left;cursor:pointer;
  border:1px solid var(--dm-sec-border);background:var(--surface-2,#f8fafc);color:inherit
}
.dm-sec-area b{font-size:12.5px;font-weight:800;letter-spacing:.01em}
.dm-sec-area small{font-size:11px;font-weight:700;opacity:.68}
.dm-sec-area[data-armata="true"]{border-color:rgba(16,185,129,.55)}
.dm-sec-area[data-armata="true"] small{color:#059669;opacity:1}
.dm-sec-area[data-on="true"]{
  border-color:var(--primary-color,#0ea5e9);
  box-shadow:0 0 0 1px var(--primary-color,#0ea5e9) inset
}

/* keypad — keeps the legacy .alarm-mode-btn contract */
.dm-sec-modes{
  /* Tante colonne quanti sono i tasti: la centrale decide quanti ce ne sono
     — tre erano quelli di prima, non una legge. */
  position:relative;z-index:1;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;
  margin-top:24px;padding:6px;border-radius:20px;
  background:var(--surface-2,#f8fafc);border:1px solid var(--dm-sec-border);
  box-shadow:inset 0 2px 8px rgba(15,23,42,.05)
}
.dm-sec-modes .alarm-mode-btn{
  --btn-rgb:100,116,139;
  display:flex;flex-direction:column;align-items:center;gap:7px;
  padding:15px 8px 13px;border-radius:15px;border:1px solid transparent;background:transparent;
  color:var(--dm-sec-dim);cursor:pointer;transform:none;
  transition:background .28s ease,color .28s ease,border-color .28s ease,box-shadow .28s ease,transform .28s cubic-bezier(.16,1,.3,1)
}
.dm-sec-modes .alarm-mode-btn[data-mode="away"]{--btn-rgb:225,29,72}
.dm-sec-modes .alarm-mode-btn[data-mode="night"]{--btn-rgb:124,58,237}
.dm-sec-modes .alarm-mode-btn[data-mode="disarm"]{--btn-rgb:5,150,105}
.dm-sec-modes .alarm-mode-btn:hover{background:var(--dm-sec-card);color:var(--dm-sec-text)}
.dm-sec-modes .alarm-mode-btn:active{transform:scale(.97)}
.dm-sec-modes .alarm-mode-btn:focus-visible{outline:2px solid rgb(var(--btn-rgb));outline-offset:2px}
.dm-sec-modes .alarm-mode-btn.active{
  background:var(--dm-sec-card);border-color:rgba(var(--btn-rgb),.32);color:rgb(var(--btn-rgb));
  box-shadow:0 10px 24px rgba(var(--btn-rgb),.22);transform:translateY(-2px)
}
.dm-sec-mode-ic{
  width:40px;height:40px;display:grid;place-items:center;border-radius:13px;font-size:20px;line-height:1;
  background:rgba(var(--btn-rgb),.10);filter:grayscale(.5) opacity(.72);transition:.28s ease
}
.dm-sec-modes .alarm-mode-btn.active .dm-sec-mode-ic{
  filter:none;background:rgba(var(--btn-rgb),.17);transform:scale(1.06)
}
.dm-sec-mode-tx{font-size:12.5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase}
.dm-sec-mode-hint{
  font-family:var(--dm-sec-mono);font-size:9.5px;letter-spacing:1px;text-transform:uppercase;
  color:var(--dm-sec-dim);opacity:.85
}

/* ── cameras ─────────────────────────────────────────────────────────── */
.dm-sec-cctv{display:flex;flex-direction:column;gap:14px}
.dm-sec-cctv-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 4px}
.dm-sec-cctv-ic{
  width:32px;height:32px;flex:0 0 32px;display:grid;place-items:center;border-radius:10px;
  background:rgba(6,182,212,.12);color:var(--dm-sec-cyan-deep)
}
.dm-sec-cctv-ic svg{width:19px;height:19px}
.dm-sec-cctv-head h3{
  margin:0;font-family:'Oswald',sans-serif;font-size:17px;font-weight:700;letter-spacing:2px;
  text-transform:uppercase;color:var(--dm-sec-text)
}
.dm-sec-rec{
  display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:7px;
  border:1px solid rgba(225,29,72,.28);background:rgba(225,29,72,.08);color:#be123c;
  font-family:var(--dm-sec-mono);font-size:10px;letter-spacing:1.6px
}
.dm-sec-rec i{width:6px;height:6px;border-radius:50%;background:#e11d48;animation:dmSecBlink 1.6s steps(1) infinite}
.dm-sec-cctv-meta{
  font-family:var(--dm-sec-mono);font-size:11px;letter-spacing:1.4px;text-transform:uppercase;
  color:var(--dm-sec-dim)
}
.dm-sec-clock{
  margin-left:auto;font-family:var(--dm-sec-mono);font-size:12.5px;letter-spacing:1.6px;
  color:var(--dm-sec-dim);padding:4px 11px;border-radius:9px;
  background:var(--surface-3,#f1f5f9);border:1px solid var(--dm-sec-border)
}
.dm-sec-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(288px,1fr));gap:16px}
.dm-sec-grid[hidden]{display:none}
.dm-sec-cctv.is-empty .dm-sec-rec{display:none}

.dm-sec-grid .cam-card.dm-cam{
  position:relative;display:flex;flex-direction:column;overflow:hidden;cursor:pointer;
  border:1px solid var(--dm-sec-border);border-radius:20px;background:var(--dm-sec-card);
  box-shadow:0 12px 30px rgba(15,23,42,.07);
  transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s ease,border-color .35s ease
}
.dm-sec-grid .cam-card.dm-cam:hover{
  transform:translateY(-4px);border-color:rgba(6,182,212,.38);
  box-shadow:0 22px 44px rgba(15,23,42,.14)
}
.dm-sec-grid .cam-card.dm-cam:focus-visible{outline:3px solid rgba(6,182,212,.55);outline-offset:3px}

/* the feed keeps its own dark letterbox: that is the video, not a panel */
.dm-cam-feed{position:relative;width:100%;padding-top:56.25%;overflow:hidden;background:#0b1220}
.dm-cam-feed>img{
  position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;
  transition:transform .6s cubic-bezier(.16,1,.3,1),filter .35s ease
}
.dm-cam:hover .dm-cam-feed>img{transform:scale(1.05)}
.dm-cam-frame{position:absolute;inset:9px;z-index:3;pointer-events:none;opacity:.45;transition:opacity .35s ease}
.dm-cam-frame::before,.dm-cam-frame::after{
  content:"";position:absolute;width:15px;height:15px;border:2px solid rgba(226,238,251,.8)
}
.dm-cam-frame::before{bottom:0;left:0;border-right:0;border-top:0}
.dm-cam-frame::after{bottom:0;right:0;border-left:0;border-top:0}
.dm-cam:hover .dm-cam-frame{opacity:.85}
.dm-cam-top{
  position:absolute;top:0;left:0;right:0;z-index:4;display:flex;align-items:center;
  justify-content:space-between;gap:8px;padding:10px 11px;
  background:linear-gradient(180deg,rgba(2,6,15,.72),transparent)
}
.dm-cam-live{
  display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:6px;
  background:rgba(2,6,15,.5);border:1px solid rgba(248,113,113,.5);color:#fecaca;
  font-family:var(--dm-sec-mono);font-size:9.5px;letter-spacing:1.5px;
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)
}
.dm-cam-live i{width:5px;height:5px;flex:0 0 5px;border-radius:50%;background:#f87171;animation:dmSecBlink 1.6s steps(1) infinite}
.dm-cam-ch{
  font-family:var(--dm-sec-mono);font-size:10.5px;letter-spacing:1.4px;color:rgba(226,238,251,.88);
  padding:3px 8px;border-radius:6px;background:rgba(2,6,15,.45);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)
}
/* labels ride on the frame like a real CCTV overlay instead of a white footer */
.dm-cam-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 15px}
.dm-cam-name{
  min-width:0;font-size:13px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;
  color:var(--dm-sec-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}
.dm-cam-time{
  flex:0 0 auto;font-family:var(--dm-sec-mono);font-size:11px;letter-spacing:1.1px;color:var(--dm-sec-dim);
  padding:4px 9px;border-radius:8px;background:var(--surface-3,#f1f5f9);border:1px solid var(--dm-sec-border)
}
.dm-cam-open{
  position:absolute;top:50%;left:50%;z-index:5;width:52px;height:52px;border-radius:15px;
  display:grid;place-items:center;color:#04121a;background:rgba(34,211,238,.94);
  box-shadow:0 14px 30px rgba(8,145,178,.5);opacity:0;
  transform:translate(-50%,-50%) scale(.82);
  transition:opacity .3s ease,transform .3s cubic-bezier(.16,1,.3,1)
}
.dm-cam-open svg{width:22px;height:22px}
.dm-cam:hover .dm-cam-open,.dm-cam:focus-visible .dm-cam-open{opacity:1;transform:translate(-50%,-50%) scale(1)}
.dm-cam-off{
  position:absolute;inset:0;z-index:6;display:none;flex-direction:column;align-items:center;
  justify-content:center;gap:9px;color:#fca5a5;
  background:
    linear-gradient(180deg,rgba(9,14,24,.86),rgba(9,14,24,.94)),
    repeating-linear-gradient(45deg,rgba(248,113,113,.09) 0 10px,transparent 10px 20px)
}
.dm-cam-off svg{width:25px;height:25px}
.dm-cam-off b{font-family:var(--dm-sec-mono);font-size:11px;letter-spacing:2.2px;text-transform:uppercase}
.dm-cam.is-off .dm-cam-off{display:flex}
.dm-cam.is-off .dm-cam-feed>img{filter:grayscale(1) brightness(.35)}
.dm-cam.is-off .dm-cam-live,.dm-cam.is-off .dm-cam-open{display:none}
.dm-cam.is-off .dm-cam-name{color:var(--dm-sec-dim)}

/* empty state */
.dm-sec-empty{
  display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;
  padding:40px 24px;border-radius:22px;border:1.5px dashed var(--dm-sec-border);
  background:var(--surface-2,#f8fafc);color:var(--dm-sec-dim)
}
.dm-sec-empty[hidden]{display:none}
.dm-sec-empty-ic{
  width:52px;height:52px;display:grid;place-items:center;border-radius:15px;
  background:rgba(6,182,212,.10);color:var(--dm-sec-cyan-deep)
}
.dm-sec-empty-ic svg{width:28px;height:28px}
.dm-sec-empty strong{font-size:15.5px;font-weight:900;color:var(--dm-sec-text);letter-spacing:.3px}
.dm-sec-empty p{margin:0;max-width:430px;font-size:12.5px;font-weight:600;line-height:1.5}
.dm-sec-empty-cta{
  margin-top:6px;padding:11px 22px;border:none;border-radius:13px;cursor:pointer;
  font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;
  color:#fff;background:linear-gradient(135deg,#06b6d4,#0284c7);box-shadow:0 12px 26px rgba(6,182,212,.30);
  transition:transform .28s cubic-bezier(.16,1,.3,1),box-shadow .28s ease
}
.dm-sec-empty-cta:hover{transform:translateY(-2px);box-shadow:0 16px 32px rgba(6,182,212,.40)}
.dm-sec-empty-cta:active{transform:scale(.97)}

/* ── responsive ──────────────────────────────────────────────────────── */
/* Wide screens read better as "state on the left, keypad on the right"
   than as one full-width status line above a very wide keypad. */
@media(min-width:1000px){
  .dm-sec-alarm{
    display:grid;grid-template-columns:minmax(0,1fr) minmax(370px,.82fr);
    align-items:center;gap:30px;padding:30px
  }
  .dm-sec-modes{margin-top:0}
}
@media(max-width:900px){
  .dm-sec-grid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
}
@media(max-width:640px){
  .dm-sec-shell{gap:15px}
  .dm-sec-mast-ic{width:44px;height:44px;flex:0 0 44px;border-radius:14px}
  .dm-sec-mast-ic svg{width:23px;height:23px}
  .dm-sec-pill{height:32px;padding:0 12px;font-size:10px;order:3;flex:0 0 auto}
  .dm-sec-alarm{padding:20px 18px 18px;border-radius:24px}
  .dm-sec-readout{gap:15px}
  .dm-sec-orb{width:78px;height:78px;flex:0 0 78px}
  .dm-sec-orb-core{width:56px;height:56px;font-size:24px}
  .dm-sec-beacon{width:13px;height:13px;top:2px;right:2px}
  .dm-sec-modes{margin-top:18px;gap:5px;padding:5px;border-radius:17px}
  .dm-sec-modes .alarm-mode-btn{padding:11px 3px 10px;gap:6px}
  .dm-sec-mode-ic{width:34px;height:34px;font-size:17px;border-radius:11px}
  .dm-sec-mode-tx{font-size:11px}
  .dm-sec-mode-hint{display:none}
  .dm-sec-cctv-head h3{font-size:15px;letter-spacing:1.6px}
  /* second line: channel count on the left, clock pushed to the right */
  .dm-sec-cctv-meta{order:4;flex:1 1 auto}
  .dm-sec-clock{order:5;font-size:11.5px;padding:3px 9px}
  .dm-sec-grid{grid-template-columns:1fr;gap:12px}
}

/* ── dark theme ──────────────────────────────────────────────────────── */
[data-theme="dark"] .dm-sec-mast-ic{
  background:linear-gradient(140deg,rgba(225,29,72,.24),rgba(14,165,233,.18));color:#fda4af;
  box-shadow:inset 0 0 0 1px rgba(244,63,94,.22)
}
[data-theme="dark"] .dm-sec-alarm{box-shadow:0 20px 48px rgba(0,0,0,.42)}
[data-theme="dark"] .dm-sec-pill[data-live="1"]{background:rgba(6,182,212,.16);color:#7dd3fc;border-color:rgba(6,182,212,.34)}
[data-theme="dark"] .dm-sec-modes{box-shadow:inset 0 2px 10px rgba(0,0,0,.28)}
[data-theme="dark"] .dm-sec-modes .alarm-mode-btn:hover{background:var(--surface-3,#212d4c)}
[data-theme="dark"] .dm-sec-modes .alarm-mode-btn.active{background:var(--surface-3,#212d4c)}
[data-theme="dark"] .dm-sec-grid .cam-card.dm-cam{box-shadow:0 14px 34px rgba(0,0,0,.36)}
[data-theme="dark"] .dm-sec-grid .cam-card.dm-cam:hover{box-shadow:0 24px 50px rgba(0,0,0,.48)}
[data-theme="dark"] .dm-sec-cctv-ic{background:rgba(6,182,212,.18);color:#7dd3fc}
[data-theme="dark"] .dm-sec-rec{border-color:rgba(244,63,94,.34);background:rgba(244,63,94,.12);color:#fda4af}
[data-theme="dark"] .dm-sec-rec i{background:#fb7185}
[data-theme="dark"] .dm-sec-empty-ic{background:rgba(6,182,212,.16);color:#7dd3fc}

/* ── motion ──────────────────────────────────────────────────────────── */
@keyframes dmSecPing{0%{box-shadow:0 0 0 0 rgba(var(--al-rgb,6,182,212),.55)}70%{box-shadow:0 0 0 9px rgba(var(--al-rgb,6,182,212),0)}100%{box-shadow:0 0 0 0 rgba(var(--al-rgb,6,182,212),0)}}
@keyframes dmSecSpin{to{transform:rotate(360deg)}}
@keyframes dmSecShout{0%,100%{box-shadow:0 10px 26px rgba(var(--al-rgb),.26),inset 0 0 0 2px rgba(var(--al-rgb),.34)}50%{box-shadow:0 10px 30px rgba(var(--al-rgb),.5),inset 0 0 0 3px rgba(var(--al-rgb),.7)}}
@keyframes dmSecRidge{0%{transform:translateX(-120%)}100%{transform:translateX(560%)}}
@keyframes dmSecBlink{0%,49%{opacity:1}50%,100%{opacity:.15}}
@media (prefers-reduced-motion:reduce){
  .dm-sec-shell *,.dm-sec-shell *::before,.dm-sec-shell *::after{animation:none!important;transition:none!important}
}
`;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installSecurityShowcaseSection, { once: true });
} else {
  installSecurityShowcaseSection();
}
