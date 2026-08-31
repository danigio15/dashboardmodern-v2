import {
  flowPeriodEntity,
  flowRecorderEntity,
  flowStageModel,
} from "../core/energy-flow-topology.js";
import { allocateSourceFlows, batteryReadout } from "../core/energy-flow-truth.js";
import { wattsFromState } from "../core/signed-energy.js";
import { vehicleBatteryEntity } from "./ev-section.js";
import { IMPIANTO_SCELTO_KEY, plantAt, plantLoads, plantModel } from "../core/energy-plants.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  installStyle,
  locale,
  readJson,
  root,
  scriviTestoSeCambia,
  section,
  wrapFunction,
  writeIconGlyph,
} from "./shared.js";

root.__DM_20260817A__ = true;
const KEY = "__DASHBOARDMODERN_ENERGY_FLOW_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

const COLORS = Object.freeze({
  solar: "#ff9f0a",
  grid: "#2563eb",
  battery: "#14b8a6",
  home: "#2563eb",
});

/* Beta 30 owns every load bubble below Home. The five hand-authored circles in
 * the legacy stage stay in the document — other owners still address them — but
 * they are hidden and replaced by one computed bubble per configured Load. */
const FLOW_VIEWS = Object.freeze([
  { period: "instant", id: "view-ist", suffix: "" },
  { period: "day", id: "view-day", suffix: "-day" },
  { period: "month", id: "view-month", suffix: "-month" },
]);

const LEGACY_LOAD_SELECTOR = ".node.n-load,[id^='line-home-'],[id^='m-line-home-']";
const SVG_NS = "http://www.w3.org/2000/svg";

function stateNumber(states, entity) {
  const value = states?.[entity]?.state ?? states?.[entity];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* Lo stato di carica della batteria ha un padrone solo, ed e' questo.
 *
 * Ne aveva quattro. Il guscio scriveva `75 %` col suo formattatore; questo
 * modulo scriveva `75%`; `beta22-load-slots-hotfix` scriveva `SOC 75%`; e
 * `beta24-energy-recovery` teneva un MutationObserver sul nodo che rimetteva
 * il prefisso «SOC» addosso a quello che scrivevano gli altri. Quattro mani
 * sullo stesso numero, con tre forme diverse: quello che si vedeva era il
 * numero che cambiava faccia a ogni cambio di stato — «▼ 1796 W / SOC 75%» e
 * poi «-1796 W / 75 %», avanti e indietro. Era lo sfarfallio della sezione
 * Energia, e non era un difetto di disegno: erano due testi che si
 * alternavano.
 *
 * Adesso scrive solo questo. Il prefisso «SOC» che avevano scelto gli altri
 * due se n'e' andato su richiesta: sotto la freccia e i watt della batteria
 * la percentuale si spiega da sola, e la sigla la sporcava. Passa dal
 * delegato, che lascia il cartello `data-dm-padrone`: e' quel cartello che
 * ferma la mano del guscio.
 */
export function renderBatterySoc(targetDocument, energy = {}, states = {}) {
  const node = nodoDelSoc(targetDocument);
  if (!node) return "—";
  const entity = clean(
    energy?.battery?.soc || energy?.battery?.battery_soc_entity || energy?.battery?.battery_soc,
  );
  /* Senza entita' configurata la casella non si mostra vuota: si toglie.
   * Il comportamento arriva da beta22, che qui dentro non c'e' piu'. */
  if (!entity) {
    node.hidden = true;
    scriviTestoSeCambia(node, "");
    node.removeAttribute("data-entity");
    return "—";
  }
  const value = stateNumber(states, entity);
  const text = value === null ? "—" : `${Math.round(value)}%`;
  node.hidden = false;
  scriviTestoSeCambia(node, text);
  if (node.dataset.entity !== entity) node.dataset.entity = entity;
  return text;
}

/* La casella nasce qui se il guscio non l'ha disegnata: prima la creava
 * beta22, ed e' l'unica ragione per cui quel modulo toccava questo nodo. */
function nodoDelSoc(targetDocument) {
  const gia = targetDocument?.getElementById?.("v-battery-soc");
  if (gia) return gia;
  const bolla = targetDocument?.querySelector?.("#view-ist #n-battery,#n-battery");
  if (!bolla) return null;
  const nuovo = targetDocument.createElement("small");
  nuovo.id = "v-battery-soc";
  nuovo.className = "dm-battery-soc";
  bolla.append(nuovo);
  return nuovo;
}

function parseNumber(node) {
  const source = String(node?.textContent || "").trim();
  const match = source.match(/-?\d[\d.,]*/);
  if (!match) return 0;
  let token = match[0];
  const comma = token.lastIndexOf(",");
  const dot = token.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) token = token.replaceAll(".", "").replace(",", ".");
    else token = token.replaceAll(",", "");
  } else if (comma >= 0) token = token.replace(",", ".");
  const value = Number(token);
  return Number.isFinite(value) ? value : 0;
}

function numberFrom(node) {
  return Math.abs(parseNumber(node));
}

/* Writing a style property that already holds that value is not free: it is a
 * mutation record for every observer on the page and a style invalidation for
 * the engine. This stage rewrites a dozen properties per line on every pass,
 * several passes a second, and almost all of them are unchanged. */
function setStyleProperty(node, name, value, priority = "") {
  if (!node?.style) return;
  if (
    node.style.getPropertyValue(name) === value &&
    node.style.getPropertyPriority(name) === priority
  )
    return;
  node.style.setProperty(name, value, priority);
}

/* Is this node on screen?
 *
 * The answer costs a style resolution, and the stage asks it for every value
 * node and every span inside it, on every pass — around two hundred times a
 * second on an idle dashboard, which is the single busiest thing the plancia
 * does when nothing is happening. Within one pass the answer cannot change, so
 * it is asked once per node and remembered until the next pass. */
const visibility = { token: 0, cache: new WeakMap() };

function beginVisibilityPass() {
  visibility.token += 1;
}

function nodeVisible(node) {
  if (!node || node.hidden) return false;
  const cached = visibility.cache.get(node);
  if (cached && cached.token === visibility.token) return cached.value;
  const style = root.getComputedStyle?.(node);
  const value = !(
    style &&
    (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)
  );
  visibility.cache.set(node, { token: visibility.token, value });
  return value;
}

/* Saved per-slot flow-node customization (Beta 26/27). Only the values the user
 * actually stored are read: the normalized editor model would otherwise hand
 * back legacy defaults and rename the canonical Load. */
function flowNodeOverrides() {
  const raw = readJson("cd_flow_nodes", null);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}

/* The hosted dashboard can render before the store exists; the legacy mirror in
 * localStorage is the same document. */
function tuttiICarichi() {
  const value = section("loads", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_loads", []);
  return Array.isArray(stored) ? stored : [];
}

/* I cerchi sotto Casa sono quelli dell'impianto scelto.
 *
 * Chi ha due contatori — «casa Giovanni» e «casa Donato» — sceglie l'impianto
 * dalle linguette in cima alla sezione, e da li' in giu' tutto parla di
 * quello: il misuratore, il fotovoltaico, la batteria. I carichi restavano
 * fuori dal patto, ed erano gli unici a comparire in tutti e due i flussi —
 * la lavatrice dell'altra casa in mezzo alla propria.
 *
 * Con un impianto solo non cambia niente: un carico senza impianto scritto
 * appartiene al primo, che e' il caso di chiunque non abbia mai chiesto il
 * secondo. */
function configuredLoads() {
  const carichi = tuttiICarichi();
  const scelto = clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));
  const { plant, index } = plantAt(section("energy", {}) || {}, scelto);
  return plant ? plantLoads(carichi, plant, index) : carichi;
}

/* The Recorder bundle is keyed by the meter entity, not by load id. Resolve it
 * once here so the pure model keeps taking a plain id -> value map. Day and
 * month are both available: a load metered only by its lifetime counter gets a
 * real figure for today, not just for the month. */
function recorderValuesFor(loads, period) {
  const bundle = period === "day" ? state.bundle?.deviceDay : state.bundle?.deviceMonth;
  const devices = bundle?.devices || [];
  const values = bundle?.values;
  if (!values?.get || !devices.length) return null;
  const resolved = {};
  for (const load of loads) {
    const device = devices.find(
      (item) =>
        clean(item.id) === clean(load.id) ||
        clean(item.key) === clean(load.id) ||
        clean(item.name) === clean(load.name),
    );
    const source =
      clean(device?.history || device?.entity) ||
      flowRecorderEntity(load) ||
      flowPeriodEntity(load, period);
    const value = Number(values.get(source));
    if (Number.isFinite(value)) resolved[clean(load.id) || clean(load.name)] = value;
  }
  return Object.keys(resolved).length ? resolved : null;
}

function configuredAppliances() {
  const value = section("appliances", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_appliances", []);
  return Array.isArray(stored) ? stored : [];
}

/* L'entita' vera dietro un riferimento della configurazione. */
function resolvedEntity(reference) {
  const id = clean(reference);
  if (!id) return "";
  try {
    return clean(root.resolveEntity?.(id)) || id;
  } catch (_error) {
    return id;
  }
}

/* C'e' un'auto da aprire?
 *
 * Il cerchio della Wallbox porta al popup dell'auto solo se un'auto c'e'
 * davvero: serve la batteria del veicolo mappata su un'entita' che Home
 * Assistant conosce, e serve il popup nel documento. Senza queste due cose il
 * cerchio resta com'era, con il suo storico — meglio un grafico che una
 * finestra vuota.
 *
 * Le entita' che tornano indietro sono quelle che la sezione Auto legge dalla
 * wallbox: un carico che punta a una di quelle e' la wallbox, comunque si
 * chiami. */
const WALLBOX_REFS = Object.freeze([
  "dm.ev_potenza_wallbox",
  "dm.ev_charge_power",
  "dm.ev_energia_wallbox_oggi",
  "dm.ev_energia_wallbox_mese",
]);

function vehiclePopupTarget() {
  if (typeof root.apriPopup !== "function") return null;
  if (!doc?.getElementById?.("ev-popup")) return null;
  const states = allStates();
  // La carica dell'auto sta scritta in cinque posti accettati, non in uno:
  // chi decide quale vale e' la sezione Auto, e la risposta arriva da li'.
  const battery = resolvedEntity(vehicleBatteryEntity());
  if (!battery || !states[battery]) return null;
  const entities = [];
  for (const reference of WALLBOX_REFS) {
    const entity = resolvedEntity(reference);
    if (entity && entity !== reference) entities.push(entity);
  }
  return { entities };
}

function stageModel(period) {
  const loads = configuredLoads();
  return flowStageModel({
    loads,
    appliances: configuredAppliances(),
    flowNodes: flowNodeOverrides(),
    states: allStates(),
    period,
    recorderValues: period === "instant" ? null : recorderValuesFor(loads, period),
    locale: locale(),
    wallbox: vehiclePopupTarget(),
  });
}

function rememberConnectorVisibility(node) {
  if (!node || node.dataset.dmFlowVisibilityCaptured === "true") return;
  node.dataset.dmFlowVisibilityCaptured = "true";
  node.dataset.dmFlowWasHidden = node.hidden ? "true" : "false";
  node.dataset.dmFlowDisplay = node.style.getPropertyValue("display") || "";
  node.dataset.dmFlowDisplayPriority = node.style.getPropertyPriority("display") || "";
  node.dataset.dmFlowVisibility = node.style.getPropertyValue("visibility") || "";
  node.dataset.dmFlowVisibilityPriority = node.style.getPropertyPriority("visibility") || "";
}

function restoreConnectorVisibility(node) {
  if (!node || node.dataset.dmFlowVisibilityCaptured !== "true") return;
  node.hidden = node.dataset.dmFlowWasHidden === "true";
  const display = node.dataset.dmFlowDisplay || "";
  const displayPriority = node.dataset.dmFlowDisplayPriority || "";
  const visibility = node.dataset.dmFlowVisibility || "";
  const visibilityPriority = node.dataset.dmFlowVisibilityPriority || "";
  if (display) setStyleProperty(node, "display", display, displayPriority);
  else node.style.removeProperty("display");
  if (visibility) setStyleProperty(node, "visibility", visibility, visibilityPriority);
  else node.style.removeProperty("visibility");
  for (const key of [
    "dmFlowVisibilityCaptured",
    "dmFlowWasHidden",
    "dmFlowDisplay",
    "dmFlowDisplayPriority",
    "dmFlowVisibility",
    "dmFlowVisibilityPriority",
  ])
    delete node.dataset[key];
}

function exposeConnector(node, active) {
  if (!node) return;
  if (active) {
    if (node.dataset.dmFlowForcedVisible !== "true") rememberConnectorVisibility(node);
    node.hidden = false;
    setStyleProperty(node, "display", "inline", "important");
    setStyleProperty(node, "visibility", "visible", "important");
    node.dataset.dmFlowForcedVisible = "true";
  } else if (node.dataset.dmFlowForcedVisible === "true") {
    restoreConnectorVisibility(node);
    node.dataset.dmFlowForcedVisible = "false";
  }
}

function colorNode(node, color, active) {
  if (!node) return;
  exposeConnector(node, active);
  node.classList.toggle("active", active);
  node.classList.toggle("dm-energy-flow-active", active);
  node.classList.toggle("dm-energy-flow-idle", !active);
  setStyleProperty(node, "--dm-flow-color", color);
  // Every write here is an attribute write, and an attribute written with the
  // value it already holds still wakes every observer on the page. The stage
  // does this for each connector a few times a second.
  const animated = active ? "true" : "false";
  if (node.dataset.dmFlowAnimated !== animated) node.dataset.dmFlowAnimated = animated;
  if (/^(path|line|polyline|circle)$/i.test(node.tagName)) {
    const stroke = active ? color : "var(--divider-color,#dbe4ee)";
    if (node.style.stroke !== stroke) node.style.stroke = stroke;
    if (node.getAttribute("fill") && node.getAttribute("fill") !== "none") {
      const fill = active ? color : "var(--divider-color,#dbe4ee)";
      if (node.style.fill !== fill) node.style.fill = fill;
    }
  }
}

function scopeFor(period) {
  if (period === "day") return doc?.getElementById("view-day");
  if (period === "month") return doc?.getElementById("view-month");
  return doc?.getElementById("view-ist");
}

/* Escaping an id for a CSS attribute selector: ids come from persisted config
 * and are not guaranteed to be identifier-safe. */
const cssEscape = (value) => String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');

/* Le bolle vecchie si spengono con un foglio, non nodo per nodo a ogni giro.
 *
 * Misurato: seicentotrenta scritture di `hidden = true` in quaranta passate, su
 * nodi che erano gia' nascosti. Due difetti in uno. Il primo e' lo spreco: ogni
 * scrittura e' una modifica al documento e un ricalcolo di stile, per non
 * cambiare niente. Il secondo e' peggio, ed e' quello che si vede: fra il
 * momento in cui il guscio ridisegna una di quelle bolle e il fotogramma in cui
 * questo modulo la rinasconde c'e' una finestra in cui la bolla e' visibile —
 * un cerchio vuoto che compare e sparisce in fondo al flusso.
 *
 * Una regola di stile non ha quella finestra: vale dall'istante in cui il nodo
 * esiste, senza aspettare nessun giro di disegno. Il marchio sul nodo resta
 * perche' e' lui che dice «questa l'ha sostituita il flusso nuovo», e la
 * regola lo legge. */
/* La regola vale su tutte e tre le viste — Istantaneo, Giorno, Mese — perche'
 * le bolle a posto fisso stanno in tutte e tre, e in tutte e tre c'e' qualcun
 * altro che decide di mostrarle: la scheda dei nodi, e il completatore degli
 * slot che riaccende la linea del Wallbox quando in casa c'e' un'auto. Scritta
 * per la sola vista Istantanea, la difesa copriva un terzo del problema. */
function regolaDelleBolleVecchie() {
  return `${FLOW_VIEWS.flatMap(({ id }) =>
    LEGACY_LOAD_SELECTOR.split(",").map(
      (pezzo) => `#${id} ${pezzo.trim()}:not([data-dm-flow-node]):not([data-dm-flow-arc])`,
    ),
  ).join(",")}{display:none!important}`;
}

function hideLegacyLoadTopology(stage) {
  stage?.querySelectorAll?.(LEGACY_LOAD_SELECTOR).forEach((node) => {
    if (node.dataset.dmFlowNode || node.dataset.dmFlowArc) return;
    /* Gia' fatto: non si riscrive. Il marchio e' il ricordo. */
    if (node.dataset.dmLegacyEnergyLoad === "replaced") return;
    node.hidden = true;
    setStyleProperty(node, "display", "none", "important");
    node.dataset.dmLegacyEnergyLoad = "replaced";
  });
}

function writeIcon(target, icon) {
  if (!target || target.dataset.dmFlowIcon === icon) return;
  target.dataset.dmFlowIcon = icon;
  writeIconGlyph(target, icon, { size: 28, kind: "load" });
}

function bindNodeClick(element, node, period) {
  const click = node.click;
  const signature = click ? `${click.kind}:${click.target || click.entity || ""}` : "";
  if (element.dataset.dmFlowClick === signature) return;
  element.dataset.dmFlowClick = signature;
  element.classList.toggle("hist-clickable", Boolean(click));
  element.onclick = click
    ? (event) => {
        if (click.kind === "ev") root.apriPopup?.();
        else if (click.kind === "subloads") root.apriSubLoads?.(click.target);
        else root.apriStorico?.(event, click.entity, click.title);
      }
    : null;
  if (click) element.dataset.dmFlowClickPeriod = period;
}

function ensureBubble(stage, node, period, scale) {
  let element = stage.querySelector(`[data-dm-flow-node="${cssEscape(node.id)}"]`);
  if (!element) {
    element = doc.createElement("div");
    element.className = "node n-load dm-flow-node";
    element.dataset.dmFlowNode = node.id;
    for (const [tag, className] of [
      ["div", "node-label"],
      ["div", "node-icon"],
      ["span", "dm-flow-value"],
    ]) {
      const child = doc.createElement(tag);
      child.className = className;
      element.append(child);
    }
    stage.append(element);
  }
  element.style.left = `${node.desktop.left}%`;
  element.style.top = `${node.desktop.top}%`;
  setStyleProperty(element, "--n-color", node.color);
  setStyleProperty(element, "--dm-flow-color", node.color);
  setStyleProperty(element, "--dm-flow-scale", String(scale));
  setStyleProperty(element, "--dm-flow-mobile-left", `${node.mobile.left}%`);
  setStyleProperty(element, "--dm-flow-mobile-top", `${node.mobile.top}%`);
  const label = element.querySelector(".node-label");
  scriviTestoSeCambia(label, node.name);
  writeIcon(element.querySelector(".node-icon"), node.icon);
  const value = element.querySelector(".dm-flow-value");
  scriviTestoSeCambia(value, node.text);
  element.dataset.dmCanonicalLoad = node.id;
  element.dataset.dmFlowPeriod = period;
  element.dataset.dmFlowActive = node.active ? "true" : "false";
  bindNodeClick(element, node, period);
  return element;
}

function ensureArc(svg, node, variant) {
  if (!svg) return null;
  let path = svg.querySelector(`[data-dm-flow-arc="${cssEscape(node.id)}"]`);
  if (!path) {
    path = doc.createElementNS(SVG_NS, "path");
    path.dataset.dmFlowArc = node.id;
    path.classList.add("flow-line", "dm-flow-arc");
    svg.append(path);
  }
  const geometry = variant === "mobile" ? node.mobile : node.desktop;
  if (path.getAttribute("d") !== geometry.path) path.setAttribute("d", geometry.path);
  setStyleProperty(path, "--line-color", node.color);
  setStyleProperty(path, "--dm-flow-width", `${node.intensity.width}px`);
  setStyleProperty(path, "--dm-flow-duration", `${node.intensity.duration}s`);
  path.dataset.dmFlowValue = String(node.value ?? "");
  colorNode(path, node.color, node.active);
  return path;
}

function pruneStale(stage, keep) {
  stage.querySelectorAll("[data-dm-flow-node],[data-dm-flow-arc]").forEach((node) => {
    const id = node.dataset.dmFlowNode || node.dataset.dmFlowArc;
    if (!keep.has(id)) node.remove();
  });
}

/* Recovered from the Beta 22 dynamic renderer and adapted: it now replaces the
 * fixed topology instead of doubling it, covers the month view as well, and
 * draws its connectors in both the desktop and the mobile viewBox. */
export function renderDynamicFlowLoads(period, model = stageModel(period)) {
  const view = FLOW_VIEWS.find((entry) => entry.period === period);
  const scope = view ? doc?.getElementById(view.id) : null;
  const stage = scope?.querySelector?.(".flow-stage");
  if (!stage) return 0;
  hideLegacyLoadTopology(stage);
  const desktopSvg = stage.querySelector("svg.desktop-svg") || stage.querySelector("svg");
  const mobileSvg = stage.querySelector("svg.mobile-svg");
  const keep = new Set();
  for (const node of model.nodes) {
    keep.add(node.id);
    ensureBubble(stage, node, period, model.scale);
    ensureArc(desktopSvg, node, "desktop");
    ensureArc(mobileSvg, node, "mobile");
  }
  pruneStale(stage, keep);
  stage.dataset.dmFlowLoads = String(model.count);
  // Beta 5's secondary-flow completer stands down on a stage that already has a
  // canonical owner; keep publishing the count it looks for.
  scope.dataset.dmCanonicalLoadCount = String(model.count);
  scope.dataset.dmFlowOwner = "beta30";
  return model.count;
}

/* ── L'istantanea dice dove va davvero l'energia ─────────────────────────
 *
 * Le linee dell'istantanea si accendevano guardando un numero alla volta:
 * qualunque solare accendeva «solare → casa» anche quando finiva tutto in
 * batteria, la carica era sempre del solare anche di notte, e l'arco
 * «rete → batteria» non esisteva. Segnalato coi video: «il disegno mi indica
 * che rete e batteria stanno alimentando casa; in realta' rete alimenta casa
 * e ricarica batteria». I tre numeri si spartiscono con `allocateSourceFlows`
 * — letti dagli STATI, non dai testi delle bolle, che da qui in poi possono
 * dire grandezza e verso senza mandare in confusione nessun lettore. */

/* L'Energia dell'impianto scelto: il primo livello dell'oggetto salvato E' il
 * primo impianto, e chi legge senza scegliere legge sempre casa sua. */
function energiaDellImpianto() {
  const scelto = clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));
  return plantModel(section("energy", {}), scelto);
}

function potenzaViva(reference) {
  // `null` — non zero — quando lo stato vivo non c'e': «spento» e «non
  // configurato» sono due risposte diverse, e chi chiama deve poterle
  // distinguere per cedere il passo alla lettura dei testi.
  const entity = resolvedEntity(reference);
  const states = allStates();
  const nodo = states[entity] || states[clean(reference)];
  if (!nodo || nodo.state === undefined) return null;
  const raw = String(nodo.state);
  if (raw === "unknown" || raw === "unavailable") return null;
  /* I watt li conta chi sa contarli: qui si guardava solo il kW, e un
   * contatore in MW passava per un contatore in watt. */
  return wattsFromState(nodo);
}

function instantSourceFlows() {
  const fonti = [
    "dm.energy_potenza_fotovoltaico",
    "dm.energy_potenza_scambio_rete",
    "dm.energy_potenza_batteria",
  ].map((ref) => ({
    configurata: resolvedEntity(ref) !== clean(ref),
    valore: potenzaViva(ref),
  }));
  const [sole, rete, batteria] = fonti;
  /* Senza nemmeno una sorgente viva non c'e' niente da spartire: si cede il
   * passo alla lettura dei testi, come prima. E una sorgente CONFIGURATA ma
   * muta — il sensore in `unavailable` per un attimo — non vale zero:
   * spartire le altre due inventerebbe percorsi falsi (la carica sparirebbe
   * e tutto il prelievo finirebbe «verso casa»); anche li' parla il testo.
   * Solo una sorgente davvero non configurata vale zero, che per una casa
   * senza batteria e' la verita'. */
  if (fonti.every((fonte) => fonte.valore === null)) return null;
  if (fonti.some((fonte) => fonte.configurata && fonte.valore === null)) return null;
  return allocateSourceFlows({
    solar: sole.valore ?? 0,
    grid: rete.valore ?? 0,
    battery: batteria.valore ?? 0,
  });
}

function instantEdgeValue(node, flussi) {
  const id = String(node?.id || "").toLowerCase();
  if (id.includes("grid-battery")) return flussi.gridToBattery;
  if (id.includes("battery-grid")) return flussi.batteryToGrid;
  if (id.includes("solar-grid")) return flussi.solarToGrid;
  if (id.includes("solar-battery")) return flussi.solarToBattery;
  if (id.includes("grid-home")) return flussi.gridToHome;
  if (id.includes("battery-home")) return flussi.batteryToHome;
  if (id.includes("solar-home")) return flussi.solarToHome;
  return null;
}

/* L'arco che mancava: dalla bolla della rete a quella della batteria, sotto
 * il sole. Le ancore sono i percorsi disegnati a mano che gli stanno accanto;
 * la scena mobile ha il suo gemello col prefisso della sua. */
const ARCHI_RETE_BATTERIA = Object.freeze([
  { anchor: "line-grid-home", id: "line-grid-battery", d: "M 307 185 Q 500 132 693 185" },
  { anchor: "m-line-grid-home", id: "m-line-grid-battery", d: "M 200 280 Q 500 180 800 280" },
  /* Lo stesso corridoio, percorso al contrario: la batteria che immette in
   * rete. Non si accendono mai insieme — prelievo e immissione sono i due
   * segni dello stesso numero — quindi condividere l'arco non sovrappone
   * niente. Senza questo, l'immissione della batteria si appoggiava alla
   * linea del solare: un'esportazione disegnata da un pannello che non sta
   * producendo. */
  { anchor: "line-grid-home", id: "line-battery-grid", d: "M 693 185 Q 500 132 307 185" },
  { anchor: "m-line-grid-home", id: "m-line-battery-grid", d: "M 800 280 Q 500 180 200 280" },
]);

function ensureGridBatteryPaths() {
  for (const arco of ARCHI_RETE_BATTERIA) {
    if (doc.getElementById(arco.id)) continue;
    const vicino = doc.getElementById(arco.anchor);
    if (!vicino?.parentNode) continue;
    const path = doc.createElementNS(SVG_NS, "path");
    path.id = arco.id;
    path.setAttribute("class", "flow-line");
    path.setAttribute("d", arco.d);
    vicino.parentNode.insertBefore(path, vicino);
  }
}

function mainLineColor(node) {
  const id = String(node?.id || "").toLowerCase();
  if (id.includes("solar")) return COLORS.solar;
  if (id.includes("battery")) return COLORS.battery;
  if (id.includes("grid")) return COLORS.grid;
  if (id.includes("home")) return COLORS.home;
  return "var(--line-color,#64748b)";
}

function isLoadLine(node) {
  if (node?.dataset?.dmFlowArc) return true;
  const id = String(node?.id || "");
  return /line-home-(?:boiler|wb|clima|lav|cuc)(?:-(?:day|month))?$/i.test(id);
}

function mainValueNode(kind, period) {
  const suffix = period ? `-${period}` : "";
  return doc?.getElementById(`v-${kind}${suffix}`) || null;
}

function mainKinds(node) {
  const id = String(node?.id || "").toLowerCase();
  return ["solar", "grid", "battery", "home"].filter((kind) => id.includes(kind));
}

function periodDirectionalValue(node, direction) {
  if (!nodeVisible(node)) return null;
  const parts = [...(node.querySelectorAll?.("span") || [])].filter(nodeVisible);
  const index = direction === "import" || direction === "charge" ? 0 : 1;
  const part = parts[index];
  return part ? numberFrom(part) : null;
}

function directionalEndpointValue(kind, node, period) {
  const valueNode = mainValueNode(kind, period);
  if (!valueNode || !nodeVisible(valueNode)) return null;
  const id = String(node?.id || "").toLowerCase();

  if (kind === "grid") {
    if (period)
      return periodDirectionalValue(valueNode, id.includes("solar-grid") ? "export" : "import");
    const signed = parseNumber(valueNode);
    return id.includes("solar-grid") ? Math.max(0, -signed) : Math.max(0, signed);
  }

  if (kind === "battery") {
    if (period)
      return periodDirectionalValue(
        valueNode,
        id.includes("solar-battery") ? "charge" : "discharge",
      );
    const signed = parseNumber(valueNode);
    return id.includes("solar-battery") ? Math.max(0, -signed) : Math.max(0, signed);
  }

  return numberFrom(valueNode);
}

function directionalMainFlowValue(node, period) {
  const id = String(node?.id || "").toLowerCase();
  if (id.includes("solar-grid")) return directionalEndpointValue("grid", node, period);
  if (id.includes("solar-battery")) return directionalEndpointValue("battery", node, period);
  if (id.includes("grid-home")) return directionalEndpointValue("grid", node, period);
  if (id.includes("battery-home")) return directionalEndpointValue("battery", node, period);
  if (id.includes("solar-home")) return directionalEndpointValue("solar", node, period);

  const kinds = mainKinds(node);
  for (const kind of kinds) {
    if (kind === "home") continue;
    const value = directionalEndpointValue(kind, node, period);
    if (value !== null) return value;
  }
  return kinds.includes("home") ? directionalEndpointValue("home", node, period) : null;
}

function displayedMainFlow(node, period) {
  const threshold = period ? 0.0005 : 0.5;
  const value = directionalMainFlowValue(node, period);
  return value === null ? null : value > threshold;
}

function mirrorLegacyMainFlows(scope, period) {
  if (!scope) return false;
  let touched = false;
  /* L'istantanea si spartisce una volta per passata: gli archi veri valgono
   * per tutte le linee della scena, e si calcolano dagli stati. */
  const flussi = period ? null : instantSourceFlows();
  scope
    .querySelectorAll(".flow-line,path[id*='line-' i],line[id*='line-' i],polyline[id*='line-' i]")
    .forEach((node) => {
      if (!/^(path|line|polyline)$/i.test(node.tagName) || isLoadLine(node)) return;
      const legacyActive = node.classList.contains("active");
      const edge = flussi ? instantEdgeValue(node, flussi) : null;
      const displayedActive = edge === null ? displayedMainFlow(node, period) : edge > 0.5;
      const active = displayedActive === null ? legacyActive : displayedActive;
      colorNode(node, mainLineColor(node), active);
      const kinds = mainKinds(node);
      node.dataset.dmMainFlow = kinds.join("-");
      node.dataset.dmFlowPeriod = period || "instant";
      const value = edge === null ? directionalMainFlowValue(node, period) : edge;
      if (value !== null) node.dataset.dmFlowValue = String(value);
      touched = true;
    });
  return touched;
}

export function refreshEnergyFlows() {
  if (!doc) return false;
  beginVisibilityPass();
  ensureGridBatteryPaths();
  let touched = false;
  for (const view of FLOW_VIEWS) {
    const period = view.period === "instant" ? "" : view.period;
    const scope = scopeFor(period);
    if (!scope) continue;
    touched = mirrorLegacyMainFlows(scope, period) || touched;
    touched = renderDynamicFlowLoads(view.period) > 0 || touched;
    scope.dataset.dmEnergyFlows = "directional-value-bound";
  }
  /* La bolla della batteria diceva il numero grezzo col segno («-201 W»
   * mentre carica): il segno e' una convenzione del modello, non una lettura.
   * Grandezza e verso, con la freccia — e le decisioni sulle linee, qui
   * sopra, ormai leggono gli stati e non questo testo.
   *
   * E si scrive SEMPRE. Il cartello del padrone che questa scrittura pianta
   * sulla bolla ferma la mano del guscio per sempre: tacere quando non c'e'
   * la freccia — sullo zero, o sull'impianto che una batteria non ce l'ha —
   * lasciava inciso il numero di prima, e cambiando impianto si leggeva la
   * carica dell'altra casa. «—» senza lettura, «0 W» da ferma. */
  const batteria = potenzaViva("dm.energy_potenza_batteria");
  const testo = batteria === null ? "—" : (batteryReadout(batteria) ?? "0 W");
  for (const id of ["v-battery", "m-v-battery"]) {
    scriviTestoSeCambia(doc.getElementById(id), testo);
  }
  /* Lo stato di carica e' dell'impianto scelto, non del documento intero: il
   * primo livello dell'oggetto Energia E' il primo impianto, e leggerlo
   * com'e' mostrava il SOC di casa propria dentro la casa dell'altro. */
  renderBatterySoc(doc, energiaDellImpianto(), allStates());
  return touched;
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    refreshEnergyFlows();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function scheduleSettled() {
  schedule();
  root.setTimeout?.(schedule, 80);
}

/* Adding, renaming or removing a Load must redraw the stage immediately: the
 * topology itself changed, not just a reading. */
function bindStore() {
  if (state.storeBound) return;
  const store = dashboardStore();
  if (!store?.subscribe) return;
  state.storeBound = true;
  store.subscribe((change) => {
    if (["loads", "energy"].includes(change?.section)) scheduleSettled();
  });
}

function installStyles() {
  installStyle(
    "dm-energy-flow-section-style",
    `
    ${regolaDelleBolleVecchie()}
    .dm-energy-flow-active{display:inline!important;visibility:visible!important;opacity:1!important;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--dm-flow-color) 52%,transparent))!important;transition:stroke .18s ease,fill .18s ease,opacity .18s ease!important}
    .dm-energy-flow-idle{opacity:.30!important;filter:none!important;transition:stroke .18s ease,fill .18s ease,opacity .18s ease!important}
    .flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{stroke:var(--dm-flow-color)!important;stroke-dasharray:12 9!important;stroke-linecap:round!important;animation-name:dmEnergyFlowDash!important;animation-duration:.8s!important;animation-timing-function:linear!important;animation-iteration-count:infinite!important;animation-play-state:running!important;will-change:stroke-dashoffset!important}
    @keyframes dmEnergyFlowDash{from{stroke-dashoffset:0}to{stroke-dashoffset:-42}}
    /* Nessuna eccezione per "riduci movimento": il tratteggio che scorre non e'
       una decorazione ma l'unico segnale che l'energia sta passando, e la
       plancia deve mostrare le stesse linee su ogni schermo. Quella preferenza
       e' spesso attiva su un computer e quasi mai su un telefono, quindi
       rispettarla qui rendeva il desktop immobile mentre il telefono scorreva:
       stessa plancia, due letture diverse. Le altre sezioni continuano a
       rispettarla, perche' li' il moto e' effettivamente decorativo. */
    /* An mdi icon resolved by the engine sits inside .node-icon, which already
       sizes the emoji of the hand-authored circles at every breakpoint: the
       glyph inherits it so a configured circle matches its neighbours. */
    .dm-flow-node .node-icon .dm-icon-engine-glyph{font-size:inherit!important;height:auto!important}
    /* Computed load bubbles. Width and speed of a connector follow the reading,
       so a wallbox at 7 kW is visibly heavier than a fridge at 60 W. */
    .flow-stage .node.dm-flow-node{display:flex!important;visibility:visible!important;transform:translate(-50%,-50%) scale(var(--dm-flow-scale,1))!important;transition:left .28s ease,top .28s ease,transform .28s ease!important}
    .flow-stage .node.dm-flow-node[data-dm-flow-active="false"]{opacity:.62!important}
    .flow-stage path.dm-flow-arc{stroke-width:var(--dm-flow-width,3px)!important;fill:none!important}
    .flow-stage path.dm-flow-arc.dm-energy-flow-active{animation-duration:var(--dm-flow-duration,.8s)!important}
    @media(max-width:820px){
      .flow-stage .node.dm-flow-node{left:var(--dm-flow-mobile-left,50%)!important;top:var(--dm-flow-mobile-top,83%)!important}
    }
  `,
  );
}

export function installEnergyFlowSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.dmRefreshEnergyFlows = refreshEnergyFlows;
  for (const name of [
    "renderEnergyMonth",
    "renderEnergyDay",
    "renderEnergyDashboard",
    "applyAtomicEnergyBundle",
    "switchEnergyView",
    "render",
  ])
    wrapFunction(name, `__dmEnergyFlow_${name}`, scheduleSettled);
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    state.bundle = event?.detail || null;
    scheduleSettled();
  });
  root.addEventListener?.("dashboardmodern:energy-bundle", scheduleSettled);
  root.addEventListener?.("dashboardmodern:energy-stable", scheduleSettled);
  /* E i cambi di stato, che sono la ragione per cui questa pagina esiste.
   *
   * La scena si ridisegnava solo agli eventi grossi: l'avvio, i pacchetti
   * dello storico, il tocco su una linguetta, un salvataggio. Le potenze
   * istantanee pero' le legge dagli stati vivi, e quelli cambiano di
   * continuo: fra un pacchetto e l'altro il disegno restava fermo a
   * com'era. Se la prima passata capitava mentre un'entita' era ancora
   * «unavailable» — un riavvio di Home Assistant, una riconnessione, un
   * integrazione lenta a partire — le linee e la bolla della batteria
   * restavano vuote finche' non passava un evento grosso, o finche' non si
   * ricaricava la pagina: «i flussi spesso scompaiono e nel mio caso la
   * batteria anche, devo ricaricare spesso la pagina».
   *
   * L'evento e' gia' raccolto a mazzetti dal filtro degli stati — mezzo
   * secondo, e solo per le entita' configurate — e il fotogramma si accoda
   * una volta sola: qui non si aggiunge nessun giro di controllo. */
  root.addEventListener?.("dashboardmodern:state-changed", schedule);
  root.addEventListener?.("dashboardmodern:states-ready", scheduleSettled);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleSettled);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleSettled);
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-energy-tab],.energy-tab,.sub-tab-btn")) scheduleSettled();
    },
    true,
  );
  bindStore();
  rivendicaLeBolleDellaBatteria();
  scheduleSettled();
}

/* Le due caselle della batteria si rivendicano all'installazione, prima che
 * arrivi il primo stato.
 *
 * Il cartello `data-dm-padrone` ferma la mano del guscio, ma solo da quando
 * c'e'. Chi lo lasciava alla prima passata di disegno arrivava tardi: il
 * guscio aveva gia' scritto la sua forma — `-1796 W` — e quella si vedeva per
 * un istante prima che il modulo la coprisse con `▼ 1796 W`. Misurato: due
 * scritture su quaranta cambi di stato, cioe' un lampo solo all'avvio, ma un
 * lampo che si vede. Rivendicare subito lo toglie: il guscio quelle caselle
 * non le scrive mai, nemmeno la prima volta. */
function rivendicaLeBolleDellaBatteria() {
  for (const id of ["v-battery", "m-v-battery", "v-battery-soc"]) {
    const nodo = doc?.getElementById?.(id);
    if (nodo?.dataset && nodo.dataset.dmPadrone !== "moduli") nodo.dataset.dmPadrone = "moduli";
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyFlowSection, { once: true });
else installEnergyFlowSection();
