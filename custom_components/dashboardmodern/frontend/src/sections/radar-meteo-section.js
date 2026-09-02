/* Il radar meteo accanto alle previsioni (#266).
 *
 * «Visualizzare il radar meteo riferito alla zona prescelta… metterlo o con un
 * widget nella home oppure assieme al meteo, affianco al meteo dei 7 giorni.
 * Radar offerto dalla protezione civile, magari si può prendere da lì.»
 *
 * Due cose, e vanno dette tutte e due.
 *
 * La prima e' dove sta il radar. Prenderlo «da lì» vorrebbe dire che questa
 * pagina, aperta dentro Home Assistant, va a bussare da sola a un servizio di
 * terzi: e' la cosa che la politica di sicurezza di Home Assistant blocca piu'
 * spesso, e quando non la blocca manda l'indirizzo di casa di chi guarda a un
 * server che non e' il suo. Tutto il resto di questa plancia legge da Home
 * Assistant, e il radar non fa eccezione: si sceglie l'entita' — una
 * `camera.*` o una `image.*` — e la si guarda. Chi vuole il radar della
 * Protezione Civile lo porta dentro con la sua integrazione, come porta dentro
 * tutto il resto; chi sta in Francia o in Olanda usa la sua, e la casella e'
 * la stessa. Cosi' il fotogramma arriva dal proprio Home Assistant, con il
 * proprio token, e non esce niente da casa.
 *
 * La seconda e' cosa mostra un radar. La segnalazione chiede che «parta dal
 * momento in cui si apre fino a 12/24 ore dopo»: quello e' un modello di
 * previsione, non un radar. Il radar dice dove sta piovendo *adesso* e dove
 * stava piovendo poco fa. Le prossime ore le dicono le previsioni, che stanno
 * gia' nella stessa finestra, due dita piu' sotto. Mettere le due cose vicine
 * e' la risposta migliore che si possa dare senza raccontare che un'immagine
 * sa il futuro.
 *
 * Il fotogramma si riprende finche' la finestra e' aperta, e non un secondo di
 * piu': un radar chiuso in un cassetto non serve a nessuno e continuerebbe a
 * chiedere immagini a Home Assistant per tutto il giorno.
 */
import { loadCameraFrame } from "./live-ui-section.js";
import { allStates, clean, doc, esc, installStyle, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_RADAR_METEO__";
const state = (root[KEY] ||= { installed: false, timer: 0, ultima: 0 });

export const CHIAVE_RADAR = "cd_radar_meteo";
const BLOCCO = "dm-radar-blocco";
const IMMAGINE = "dm-radar-img";

/* Ogni quanto si ripiglia il fotogramma. Un radar nazionale si aggiorna ogni
 * cinque o dieci minuti: un minuto e' abbastanza fitto da non far aspettare
 * nessuno e abbastanza largo da non pesare. */
const OGNI = 60_000;

/* I domini che portano un'immagine. `entity_picture` ce l'hanno anche altri —
 * una persona, un media player — ma nessuno di quelli e' un radar, e offrirli
 * nella casella vorrebbe dire invitare a metterci la faccia di qualcuno. */
const CON_IMMAGINE = new Set(["camera", "image"]);

/** Cosa e' stato scelto, ripulito. */
export function radarScelto(stored = readJson(CHIAVE_RADAR, {})) {
  const grezzo = stored && typeof stored === "object" ? stored : {};
  const entity = clean(grezzo.entity);
  if (!entity.includes(".")) return null;
  return {
    entity,
    nome: clean(grezzo.nome),
    dominio: entity.split(".")[0],
    /* Un'entita' di un dominio che non porta immagini non e' un radar: si dice
     * invece di mostrare un rettangolo vuoto per sempre. */
    servibile: CON_IMMAGINE.has(entity.split(".")[0]),
  };
}

/** Se il radar scelto sta rispondendo adesso. */
export function radarVivo(scelto, states = allStates()) {
  if (!scelto?.servibile) return false;
  return Boolean(clean(states?.[scelto.entity]?.attributes?.entity_picture));
}

/* ── il blocco dentro la finestra del meteo ───────────────────────────── */

function finestra() {
  return doc?.getElementById?.("weather-modal") || null;
}

function finestraAperta() {
  const modale = finestra();
  if (!modale) return false;
  /* Il guscio apre le sue finestre con una classe e le chiude togliendola;
   * quando non c'e' nessuna classe, lo dice il fatto che non si vede. */
  if (modale.classList.contains("show") || modale.classList.contains("active")) return true;
  return modale.offsetParent !== null;
}

function blocco() {
  const modale = finestra();
  if (!modale) return null;
  let nodo = modale.querySelector(`.${BLOCCO}`);
  if (nodo) return nodo;
  const elenco = modale.querySelector("#weather-forecast-list");
  if (!elenco) return null;
  nodo = doc.createElement("div");
  nodo.className = BLOCCO;
  nodo.innerHTML = `<div class="dm-radar-testa">
      <span aria-hidden="true">📡</span>
      <strong class="dm-radar-nome"></strong>
      <small class="dm-radar-nota">${esc(t("Dove piove adesso", "Where it is raining now"))}</small>
    </div>
    <div class="dm-radar-quadro">
      <img class="${IMMAGINE}" alt="${esc(t("Radar meteo", "Weather radar"))}" decoding="async">
      <span class="dm-radar-muto">${esc(
        t("Il radar non sta rispondendo.", "The radar is not reporting."),
      )}</span>
    </div>`;
  /* Sopra le previsioni: il radar dice adesso, le previsioni dicono dopo, e si
   * legge nell'ordine in cui il tempo passa. */
  elenco.before(nodo);
  return nodo;
}

async function riprendi(scelto, nodo) {
  const immagine = nodo.querySelector(`.${IMMAGINE}`);
  if (!immagine) return;
  const preso = await loadCameraFrame({ entity: scelto.entity }, immagine);
  nodo.dataset.dmRadar = preso ? "vivo" : "muto";
}

export function disegnaRadar() {
  const scelto = radarScelto();
  const nodo = blocco();
  if (!nodo) return false;
  if (!scelto?.servibile) {
    nodo.hidden = true;
    return false;
  }
  nodo.hidden = false;
  const nome = nodo.querySelector(".dm-radar-nome");
  if (nome) nome.textContent = scelto.nome || t("Radar meteo", "Weather radar");
  riprendi(scelto, nodo);
  return true;
}

/* ── il giro, solo mentre si guarda ───────────────────────────────────── */

function ferma() {
  if (!state.timer) return;
  root.clearInterval?.(state.timer);
  state.timer = 0;
}

function avvia() {
  if (state.timer) return;
  state.timer =
    root.setInterval?.(() => {
      if (!finestraAperta()) {
        ferma();
        return;
      }
      disegnaRadar();
    }, OGNI) || 0;
}

function guarda() {
  if (!finestraAperta()) {
    ferma();
    return;
  }
  disegnaRadar();
  avvia();
}

/* ── la casella dove si sceglie ───────────────────────────────────────── */

/* La casella sta accanto a quelle del meteo, dentro la stessa fisarmonica: e'
 * la stessa domanda — che tempo fa — e chiederla in due schede diverse
 * vorrebbe dire farla cercare. */
function montaLaCasella() {
  const slotMeteo = doc?.querySelector?.('input[data-ref="dm.home_meteo"]');
  const riquadro = slotMeteo?.closest?.(".ed-slot");
  if (!riquadro) return false;
  const fisarmonica = riquadro.closest("details.ed-acc");
  if (!fisarmonica || fisarmonica.querySelector("[data-dm-radar-campo]")) return false;
  const scelto = readJson(CHIAVE_RADAR, {});
  const casella = doc.createElement("label");
  casella.className = "ed-slot dm-radar-ed";
  casella.innerHTML = `<span class="ed-slot-lbl">${esc(
    t("Radar meteo (entità camera o image)", "Weather radar (camera or image entity)"),
  )}</span>
    <span class="ed-form-row"><input id="dm-radar-entita" class="ed-input mono"
      data-dm-radar-campo="entity" value="${esc(clean(scelto?.entity))}"
      placeholder="camera.radar" autocomplete="off" spellcheck="false"><button type="button"
      class="dm-entity-picker" data-dm-radar-pick="dm-radar-entita"
      aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
    <small>${esc(
      t(
        "Il radar arriva dal tuo Home Assistant, non da un servizio esterno: porta dentro quello che vuoi — la Protezione Civile, il servizio del tuo paese — e scegli qui l'entità che ne esce. Compare in questa finestra, sopra le previsioni.",
        "The radar comes from your own Home Assistant, not from an outside service: bring in whichever one you want and pick the entity it creates here. It shows up in this window, above the forecast.",
      ),
    )}</small>`;
  riquadro.after(casella);
  return true;
}

function onInput(event) {
  const campo = event.target?.closest?.("[data-dm-radar-campo]");
  if (!campo) return;
  const entity = clean(campo.value);
  try {
    root.localStorage?.setItem?.(CHIAVE_RADAR, JSON.stringify({ entity }));
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_errore) {}
  disegnaRadar();
}

function onClick(event) {
  const pick = event.target?.closest?.("[data-dm-radar-pick]");
  if (pick) {
    event.preventDefault();
    const input = doc?.getElementById?.(clean(pick.dataset.dmRadarPick));
    if (input) root.wzPickEntity?.(input);
    return;
  }
  /* Un tocco qualunque puo' essere quello che apre la finestra del meteo: si
   * riguarda dopo, che e' meno di un timer acceso tutto il giorno. */
  root.setTimeout?.(guarda, 120);
}

function installStyles() {
  installStyle(
    "dm-radar-meteo",
    `
      #weather-modal .dm-radar-blocco{display:grid;gap:8px;margin-bottom:14px}
      #weather-modal .dm-radar-testa{display:flex;align-items:baseline;gap:8px}
      #weather-modal .dm-radar-testa strong{
        font-size:13px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;
        color:var(--text,#0f172a)}
      #weather-modal .dm-radar-nota{font-size:11px;color:var(--text-dim,#64748b)}
      #weather-modal .dm-radar-quadro{
        position:relative;display:grid;place-items:center;min-height:180px;overflow:hidden;
        border-radius:16px;background:var(--bg-sculpted,#0b1220);
        border:1px solid var(--card-border,#1e293b)}
      #weather-modal .dm-radar-img{width:100%;height:auto;display:block}
      /* Finche' il primo fotogramma non c'e', l'immagine non occupa spazio: il
         riquadro resta della sua altezza minima invece di saltare. */
      #weather-modal .dm-radar-blocco[data-dm-radar="muto"] .dm-radar-img{display:none}
      #weather-modal .dm-radar-muto{
        font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
      #weather-modal .dm-radar-blocco[data-dm-radar="vivo"] .dm-radar-muto{display:none}
      #ed-body .dm-radar-ed small{
        display:block;margin:3px 2px 0;font-size:11px;line-height:1.45;
        color:var(--text-dim,#64748b)}
    `,
  );
}

export function installRadarMeteo() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("input", onInput);
  doc.addEventListener("click", onClick);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:editor-rendered",
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(evento, () => {
      montaLaCasella();
      guarda();
    });
  montaLaCasella();
  guarda();
  return true;
}
