// DM-FIX-20260817C
/* What the popup behind a flow circle shows.
 *
 * Clicking a circle opens the appliances configured inside that load. The list
 * is built from the same canonical loads the stage is drawn from, so the total
 * in the popup header and the value in the bubble are the same number by
 * construction rather than by coincidence.
 *
 * Pure: no DOM. The section renders what this returns.
 *
 * «Per costruzione e non per combinazione» era una promessa non mantenuta: la
 * casella della potenza la sceglievano in due, ognuno col suo ordine, e con un
 * apparecchio che ne ha scritte due la stessa schermata diceva due numeri.
 * Adesso la sceglie una funzione sola, e sceglie quella che risponde.
 */
import { campoDiPotenza } from "./energy-flow-topology.js";
import { createApplianceViewModel } from "./appliance-view-model.js";
import { wattsFromState } from "./signed-energy.js";

const clean = (value) => String(value ?? "").trim();
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/* Off is not an error. The legacy popup painted every idle appliance in the
 * same alert red it used for problems, which made a quiet kitchen look like a
 * fault; idle is now a neutral surface and only running gets an accent. */
export const SUBLOAD_STATES = Object.freeze({
  running: { key: "running", color: "#059669", tint: "#d1fae5" },
  standby: { key: "standby", color: "#b45309", tint: "#fef3c7" },
  off: { key: "off", color: "#64748b", tint: "#e2e8f0" },
  unknown: { key: "unknown", color: "#94a3b8", tint: "#f1f5f9" },
});

function finiteOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stateNumber(states, entity) {
  if (!entity) return null;
  const source = states?.[entity];
  return finiteOrNull(source?.state ?? source);
}

/* I watt della casella scelta, con l'unita' che dichiara.
 *
 * Qui si leggeva il numero e basta: un contatore in kW diceva «0,27 W» dove la
 * carta dell'elettrodomestico dice 270. `wattsFromState` e' la risposta unica
 * alla domanda «quanti watt sono», ed e' quella che usa il resto della
 * plancia. */
function wattDi(states, entity) {
  if (!entity) return null;
  const source = states?.[entity];
  if (source && typeof source === "object" && source.state !== undefined)
    return finiteOrNull(wattsFromState(source));
  return finiteOrNull(source?.state ?? source);
}

/* L'apparecchio come lo vede la sezione Elettrodomestici.
 *
 * Due adattamenti, e nessuno dei due aggiunge un parere:
 *
 *   - la casella della potenza e' quella che ha gia' scelto `campoDiPotenza`,
 *     cioe' la stessa che stampa il numero sulla carta. Cosi' lo stato e il
 *     numero vengono dalla stessa lettura e non possono dire due cose diverse;
 *   - i watt si dichiarano in watt. Il modello canonico la casella la riconosce
 *     dall'unita', e un sensore che l'unita' non la scrive verrebbe scartato —
 *     mentre `campoDiPotenza` quel sensore lo legge lo stesso, com'e' sempre
 *     stato. Le letture si passano dentro un velo (`Object.create`) che
 *     ridichiara quella sola casella: costa un oggetto, non una copia della
 *     casa, e la casa qui ha migliaia di entita'.
 *
 * E i campi del mondo vecchio si traducono in quelli canonici: `bin` e `state`
 * sono la casella dello stato, non l'interruttore. */
function comeInElettrodomestici(child, states) {
  const potenza = campoDiPotenza(child, states);
  const watt = wattDi(states, potenza);
  const device = {
    ...child,
    power_entity: potenza,
    state_entity: clean(child.state_entity || child.status_entity || child.state || child.bin),
    control_entity: clean(child.control_entity || child.switch_entity || child.switch),
  };
  if (!potenza || watt === null) return { device, letture: states || {}, watt };
  const letture = Object.create(states || null);
  letture[potenza] = {
    ...(states?.[potenza] || {}),
    state: String(watt),
    attributes: { ...(states?.[potenza]?.attributes || {}), unit_of_measurement: "W" },
  };
  return { device, letture, watt };
}

/* Lo stato e' quello della sezione Elettrodomestici, chiesto alla sua stessa
 * funzione.
 *
 * «tutti e otto dicono IN FUNZIONE anche a 0 W»: qui c'era una seconda regola,
 * piu' corta, in cui un interruttore acceso bastava a dire «in funzione». Nella
 * sezione Elettrodomestici no, e per un motivo: un interruttore generico
 * lasciato acceso a zero watt vuol dire che c'e' corrente, non che l'apparecchio
 * stia lavorando — e' STANDBY. A dire IN FUNZIONE sono i watt sopra soglia, uno
 * stato che lo dice con parole sue (`running`, `active`, `playing`…), o un
 * sensore di attivita' chiamato per quello che e'. Due regole per la stessa
 * domanda erano due risposte diverse sulla stessa casa: adesso e' una.
 *
 * Restano di questa finestra le soglie per apparecchio (`threshold_run`,
 * `threshold_standby`) e il ritardo di fine ciclo (`off_delay_minutes`), che
 * arrivano gratis: e' lo stesso modello, quindi la lavastoviglie che asciuga
 * resta IN FUNZIONE anche qui, non solo sulla sua carta. */
export function subloadState(child = {}, states = {}) {
  const { device, letture, watt } = comeInElettrodomestici(child, states);
  /* Una lettura che non c'e' non e' uno zero. Nella sezione Elettrodomestici un
   * apparecchio senza nemmeno una casella da guardare finisce fra gli spenti;
   * qui la finestra ha sempre detto NON DISPONIBILE — ed e' l'unica delle
   * quattro parole che non fa parte della domanda («in funzione, standby,
   * spento»): un sensore rotto non deve somigliare a un apparecchio spento. */
  if (watt === null && !device.state_entity && !device.control_entity)
    return SUBLOAD_STATES.unknown;
  const modello = createApplianceViewModel(device, letture);
  return SUBLOAD_STATES[modello.mode] || SUBLOAD_STATES.unknown;
}

export function formatWatts(value, locale = "it-IT") {
  if (value === null || value === undefined) return "—";
  const magnitude = Math.abs(value);
  if (magnitude >= 1000)
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 1000)} kW`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} W`;
}

export function formatKwh(value, locale = "it-IT") {
  if (value === null || value === undefined) return "";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} kWh`;
}

/* The popup for one circle: its appliances, heaviest first, each with the share
 * of the group it is drawing, plus the total that the bubble shows. */
export function subloadPopupModel({
  load = {},
  children = [],
  states = {},
  locale = "it-IT",
  dailyValues = null,
} = {}) {
  const items = (Array.isArray(children) ? children : []).map((child, index) => {
    const powerEntity = campoDiPotenza(child, states);
    const power = wattDi(states, powerEntity);
    const status = subloadState(child, states);
    const id = clean(child.id) || `sub-${index + 1}`;
    const daily =
      finiteOrNull(
        typeof dailyValues?.get === "function" ? dailyValues.get(id) : dailyValues?.[id],
      ) ?? stateNumber(states, clean(child.daily ?? child.daily_energy_entity));
    return {
      id,
      name: clean(child.name) || `Carico ${index + 1}`,
      icon: clean(child.icon) || clean(child.emoji_icon) || "🔌",
      entity: powerEntity,
      power,
      powerText: formatWatts(power, locale),
      daily,
      dailyText: formatKwh(daily, locale),
      state: status.key,
      color: status.color,
      tint: status.tint,
    };
  });

  const measured = items.filter((item) => item.power !== null);
  const total = measured.length ? measured.reduce((sum, item) => sum + item.power, 0) : null;
  const peak = items.reduce((top, item) => Math.max(top, Math.abs(item.power ?? 0)), 0);

  const ranked = items
    .slice()
    .sort((left, right) => (right.power ?? -1) - (left.power ?? -1))
    .map((item) => ({
      ...item,
      // Share of the biggest consumer in the group, so the bars compare within
      // the popup instead of against an arbitrary maximum.
      share: peak > 0 && item.power !== null ? clamp01(Math.abs(item.power) / peak) : 0,
    }));

  return {
    id: clean(load.id),
    name: clean(load.name) || "Carico",
    icon: clean(load.icon || load.emoji_icon) || "🔌",
    color: clean(load.color) || "#0ea5e9",
    total,
    totalText: formatWatts(total, locale),
    running: ranked.filter((item) => item.state === "running").length,
    count: ranked.length,
    items: ranked,
  };
}
