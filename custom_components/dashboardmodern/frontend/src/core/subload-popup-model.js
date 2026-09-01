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

const RUNNING_WATTS = 5;
const STANDBY_WATTS = 0.4;

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

function rawState(states, entity) {
  if (!entity) return "";
  const source = states?.[entity];
  return clean(typeof source === "object" ? source?.state : source).toLowerCase();
}

/* Running comes from the state entity when there is one, because a washing
 * machine mid-cycle can draw almost nothing between phases. Without it, power
 * decides: above a few watts it is running, a trickle is standby, nothing is
 * off, and no reading at all stays unknown instead of being called off. */
export function subloadState(child = {}, states = {}) {
  const control = clean(child.state ?? child.bin ?? child.control_entity ?? child.state_entity);
  const power = stateNumber(states, campoDiPotenza(child, states));
  if (control) {
    const value = rawState(states, control);
    if (value === "on" || value === "playing" || value === "heating" || value === "cleaning")
      return SUBLOAD_STATES.running;
    if (value === "off" || value === "idle" || value === "standby")
      return power !== null && power > STANDBY_WATTS ? SUBLOAD_STATES.standby : SUBLOAD_STATES.off;
  }
  if (power === null) return SUBLOAD_STATES.unknown;
  if (power > RUNNING_WATTS) return SUBLOAD_STATES.running;
  if (power > STANDBY_WATTS) return SUBLOAD_STATES.standby;
  return SUBLOAD_STATES.off;
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
    const power = stateNumber(states, powerEntity);
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
