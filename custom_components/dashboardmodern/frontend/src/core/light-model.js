/* What a configured light is, what it can do and what to ask Home Assistant.
 *
 * A "light" on this dashboard is not necessarily a `light.` entity: a lamp
 * behind a relay is a `switch.`, and the user configures it in the Luci tab
 * exactly like any other. Everything downstream — the popup, the cards, the
 * alerts group — therefore has to reason about capabilities rather than about
 * the domain: an on/off relay, a dimmer, a tunable white and an RGB strip are
 * four different control surfaces, and only the entity itself knows which one
 * it is.
 *
 * This module is the single place that answers those questions. It holds no
 * DOM, no storage and no locale: it turns a Home Assistant state object into a
 * view, and a requested change into the service call that performs it.
 */

/* Domains that may be configured as a light. `light` and `switch` are what a
 * real installation uses — a lamp behind a relay is a switch — and the last
 * three are the ones the legacy wizard has always written into `cd_luci`, so
 * rejecting them here would make a light added years ago uneditable. Every one
 * of them answers turn_on/turn_off/toggle. */
export const LIGHT_DOMAINS = Object.freeze(["light", "switch", "input_boolean", "fan", "group"]);

/** Colour modes that carry a full colour, as opposed to a white point. */
const COLOR_MODES = new Set(["hs", "xy", "rgb", "rgbw", "rgbww"]);

/** Colour modes that carry a brightness. `onoff` is the only one that cannot. */
const DIMMABLE_MODES = new Set([
  "brightness",
  "color_temp",
  "hs",
  "xy",
  "rgb",
  "rgbw",
  "rgbww",
  "white",
]);

/* Pre-2021 integrations report no `supported_color_modes` at all, only the
 * legacy feature bitmask. A real installation still has a few of them, and
 * without this fallback their dimmer would be hidden. */
const LEGACY_BRIGHTNESS = 1;
const LEGACY_COLOR_TEMP = 2;
const LEGACY_EFFECT = 4;
const LEGACY_COLOR = 16;

export const DEFAULT_MIN_KELVIN = 2000;
export const DEFAULT_MAX_KELVIN = 6535;

/* The white point a colour-only light is given when the user asks for white,
 * and the fallback shown for a tunable light that is off and reports nothing. */
export const NEUTRAL_KELVIN = 4000;

const clean = (value) => String(value ?? "").trim();

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function entityDomain(id) {
  const value = clean(id);
  const index = value.indexOf(".");
  return index > 0 ? value.slice(0, index).toLowerCase() : "";
}

/** True for an entity id this dashboard accepts in the Luci tab. */
export function isLightEntity(id) {
  const value = clean(id);
  return LIGHT_DOMAINS.some((domain) => new RegExp(`^${domain}\\.[a-z0-9_]+$`, "i").test(value));
}

function colorModes(attributes = {}) {
  const raw = attributes.supported_color_modes;
  return new Set(
    (Array.isArray(raw) ? raw : []).map((mode) => clean(mode).toLowerCase()).filter(Boolean),
  );
}

function kelvinRange(attributes = {}) {
  const min =
    numberOrNull(attributes.min_color_temp_kelvin) ??
    (numberOrNull(attributes.max_mireds) ? Math.round(1e6 / Number(attributes.max_mireds)) : null);
  const max =
    numberOrNull(attributes.max_color_temp_kelvin) ??
    (numberOrNull(attributes.min_mireds) ? Math.round(1e6 / Number(attributes.min_mireds)) : null);
  const low = min ?? DEFAULT_MIN_KELVIN;
  const high = max ?? DEFAULT_MAX_KELVIN;
  return high > low
    ? { min: low, max: high }
    : { min: DEFAULT_MIN_KELVIN, max: DEFAULT_MAX_KELVIN };
}

/* 0-255 is what Home Assistant reports and 0-100 is what the user sets, so the
 * conversion rounds up: a lamp reporting brightness 1 is on, and showing 0%
 * next to a lit lamp reads as a bug. */
export function brightnessToPercent(brightness) {
  const value = numberOrNull(brightness);
  if (value === null || value <= 0) return null;
  return clamp(Math.round((value / 255) * 100) || 1, 1, 100);
}

/**
 * Everything the controls need to know about one configured light.
 *
 * `state` is the Home Assistant state object, or nothing at all when the entity
 * is not in the registry — a configured light whose integration is down still
 * has to appear, marked unavailable, instead of silently vanishing.
 */
export function lightView(
  id,
  { name = "", state = null, room = "", floor = "", comandabile = true } = {},
) {
  const entity = clean(id);
  const domain = entityDomain(entity);
  const attributes = state?.attributes || {};
  const status = clean(state?.state).toLowerCase();
  const available = Boolean(state) && status !== "unavailable" && status !== "unknown";
  const modes = colorModes(attributes);
  const features = Number(attributes.supported_features) || 0;
  const light = domain === "light";
  const legacyOnly = light && modes.size === 0;

  const dimmable =
    light &&
    ([...modes].some((mode) => DIMMABLE_MODES.has(mode)) ||
      (legacyOnly && (Boolean(features & LEGACY_BRIGHTNESS) || attributes.brightness != null)));
  const colorful =
    light &&
    ([...modes].some((mode) => COLOR_MODES.has(mode)) ||
      (legacyOnly && (Boolean(features & LEGACY_COLOR) || Array.isArray(attributes.rgb_color))));
  const tunable =
    light &&
    (modes.has("color_temp") ||
      (legacyOnly &&
        (Boolean(features & LEGACY_COLOR_TEMP) || attributes.color_temp_kelvin != null)));

  const effects = Array.isArray(attributes.effect_list)
    ? attributes.effect_list.map(clean).filter(Boolean)
    : [];
  const range = kelvinRange(attributes);
  const kelvin =
    numberOrNull(attributes.color_temp_kelvin) ??
    (numberOrNull(attributes.color_temp) ? Math.round(1e6 / Number(attributes.color_temp)) : null);
  const mode = clean(attributes.color_mode).toLowerCase();
  const rgb = Array.isArray(attributes.rgb_color) ? attributes.rgb_color.slice(0, 3) : null;

  return {
    id: entity,
    domain,
    name: clean(name) || clean(attributes.friendly_name) || entity,
    room: clean(room),
    floor: clean(floor),
    available,
    on: status === "on",
    dimmable: Boolean(dimmable),
    colorful: Boolean(colorful),
    tunable: Boolean(tunable),
    effects: light && (effects.length || features & LEGACY_EFFECT) ? effects : [],
    effect: clean(attributes.effect),
    colorMode: mode,
    brightness: dimmable ? brightnessToPercent(attributes.brightness) : null,
    rgb: colorful ? rgb : null,
    kelvin: tunable ? (kelvin === null ? null : clamp(kelvin, range.min, range.max)) : null,
    minKelvin: range.min,
    maxKelvin: range.max,
    /* Se questa si comanda.
     *
     * Certe cose in casa si guardano e basta: la presa del frigo, quella del
     * modem, il congelatore in garage. Il tasto c'e' perche' l'entita' e' un
     * interruttore, ma premerlo non e' mai una cosa che si voleva fare — e chi
     * lo preme spesso non e' chi ha configurato la plancia. Chi disegna legge
     * questo per fare il tasto spento; chi comanda non deve nemmeno guardarlo,
     * ci pensa `lightCommand`. */
    comandabile: comandabile !== false,
  };
}

/**
 * The colour the card and the orb are painted with: what the lamp is actually
 * emitting when it says so, the white point when it is in tunable mode, and the
 * dashboard's amber when the entity reports nothing — an on/off relay included.
 */
export function lightColorHex(view, fallback = "#f59e0b") {
  if (!view?.on) return fallback;
  if (view.colorMode === "color_temp" && view.kelvin) return kelvinToHex(view.kelvin);
  if (Array.isArray(view.rgb) && view.rgb.length === 3) return rgbToHex(view.rgb);
  if (view.kelvin) return kelvinToHex(view.kelvin);
  return fallback;
}

/** Which control surface this light gets, in the order the popup shows them. */
export function lightControls(view) {
  const controls = ["power"];
  if (view?.dimmable) controls.push("brightness");
  if (view?.colorful) controls.push("color");
  if (view?.tunable) controls.push("white");
  if (view?.effects?.length) controls.push("effect");
  return controls;
}

/* ── Colour maths ─────────────────────────────────────────────────────────── */

const channel = (value) => clamp(Math.round(Number(value) || 0), 0, 255);

export function rgbToHex(rgb) {
  const values = Array.isArray(rgb) ? rgb : [];
  if (values.length < 3) return "#ffffff";
  return `#${values
    .slice(0, 3)
    .map((value) => channel(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToRgb(hex) {
  const value = clean(hex).replace(/^#/, "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((part) => part + part)
          .join("")
      : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return [255, 255, 255];
  return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16));
}

/** h in 0-360, s and v in 0-100. */
export function hsvToRgb(h, s, v) {
  const hue = (((Number(h) || 0) % 360) + 360) % 360;
  const saturation = clamp(Number(s) || 0, 0, 100) / 100;
  const value = clamp(Number(v) || 0, 0, 100) / 100;
  const c = value * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - c;
  const sector = Math.floor(hue / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];
  return [r, g, b].map((part) => channel((part + m) * 255));
}

export function rgbToHsv(rgb) {
  const [r, g, b] = (Array.isArray(rgb) ? rgb : [0, 0, 0]).map((value) => channel(value) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return [Math.round(hue), Math.round(max === 0 ? 0 : (delta / max) * 100), Math.round(max * 100)];
}

/* Tanner Helland's black-body approximation, which is what makes a 2700K
 * preview look like tungsten and a 6500K one look like daylight instead of both
 * looking white. */
export function kelvinToHex(kelvin) {
  const temperature = clamp(Number(kelvin) || NEUTRAL_KELVIN, 1000, 40000) / 100;
  let red;
  let green;
  let blue;
  if (temperature <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661;
    blue = temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * (temperature - 60) ** -0.1332047592;
    green = 288.1221695283 * (temperature - 60) ** -0.0755148492;
    blue = 255;
  }
  return rgbToHex([red, green, blue]);
}

/* Which of black or white stays readable on this colour.
 *
 * The controls paint themselves in the lamp's own colour — the power button,
 * the glyph inside the orb — and a lamp can be deep blue as easily as pale
 * amber, so the ink cannot be a constant. This is the WCAG relative luminance,
 * with the usual 0.5 split. */
/** Quanto e' chiaro un colore, da 0 (nero) a 1 (bianco). Scritto una volta. */
export function luminanza(hex) {
  const canali = hexToRgb(hex).map((value) => {
    const ratio = value / 255;
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canali[0] + 0.7152 * canali[1] + 0.0722 * canali[2];
}

export function readableInk(hex, dark = "#0f172a", light = "#ffffff") {
  return luminanza(hex) > 0.4 ? dark : light;
}

/* Sopra questa chiarezza un colore, su una card chiara, non si vede piu'. */
const TROPPO_CHIARO = 0.62;
/* E sotto questa tinta non c'e' un colore da scurire: c'e' del bianco. La
 * saturazione qui si conta in centesimi, come la rende `rgbToHsv`. */
const SENZA_TINTA = 14;

/**
 * Il colore con cui una luce dice «sono accesa».
 *
 * Dal campo (#327): «il colore dell'alone e' quello della lampada, quindi se la
 * lampada e' sul bianco non si vede — ma in realta' c'e'». Aveva ragione su
 * tutto, ed e' proprio per questo che era un difetto: l'alone c'era, ed era
 * bianco su bianco. Una lampada accesa che si vede identica a una spenta e'
 * rotta anche quando il colore che mostra e' quello giusto.
 *
 * Il colore vero resta dov'e' informazione — la sfera dice che luce fa la
 * lampada, e una lampada bianca fa luce bianca. Qui si ricava quello con cui la
 * card lo DICE: la stessa tinta, scurita quanto basta per staccarsi dal fondo.
 * Un bianco puro una tinta da scurire non ce l'ha, e allora prende l'ambra di
 * casa — il colore con cui questa plancia scrive «acceso» da sempre.
 */
export function coloreDelSegno(hex, ambra = "#f59e0b") {
  const [h, s, v] = rgbToHsv(hexToRgb(hex));
  if (luminanza(hex) <= TROPPO_CHIARO) return clean(hex) || ambra;
  if (s < SENZA_TINTA) return ambra;
  /* Si scende finche' non si vede: la tinta e' sua, la profondita' gliela
   * diamo noi. Il valore non e' una scelta di gusto — e' il punto in cui un
   * colore saturo passa la soglia qui sopra su un fondo bianco. */
  return rgbToHex(hsvToRgb(h, Math.max(s, 55), 72));
}

/* ── Commands ─────────────────────────────────────────────────────────────── */

/**
 * The single service call that performs one requested change.
 *
 * A switch only knows turn_on/turn_off/toggle, so every colour or brightness
 * field is dropped for it rather than sent and rejected. A light takes the
 * whole change in one `light.turn_on`: asking for a colour on a lamp that is
 * off turns it on with that colour, which is what a user tapping a swatch
 * expects to happen.
 */
export function lightCommand(view, change = {}) {
  const entity = clean(view?.id);
  const domain = view?.domain === "light" ? "light" : entityDomain(entity) || "homeassistant";
  if (!entity) return null;
  /* Il rifiuto sta qui, non nelle pagine.
   *
   * Un tasto disegnato grigio che poi funziona lo stesso e' peggio di un tasto
   * normale: chi lo guarda crede di non poterlo premere e chi lo preme scopre
   * di si'. Le pagine che comandano una luce sono quattro — Luci, Stanze, i
   * riquadri della Home, le Prese — e tutte e quattro passano di qui. Chi
   * dimenticasse il grigio farebbe una cosa brutta; chi dimenticasse il
   * controllo, senza questa riga, farebbe una cosa pericolosa. */
  if (view?.comandabile === false) return null;

  const power = change.power;
  const wantsOff = power === false || change.brightnessPct === 0;
  if (wantsOff) return { domain, service: "turn_off", data: { entity_id: entity } };
  if (domain !== "light") {
    return {
      domain,
      service: power === true ? "turn_on" : "toggle",
      data: { entity_id: entity },
    };
  }

  const data = { entity_id: entity };
  if (view?.dimmable && change.brightnessPct != null) {
    data.brightness_pct = clamp(Math.round(Number(change.brightnessPct) || 0), 1, 100);
  }
  if (view?.colorful && change.hex) data.rgb_color = hexToRgb(change.hex);
  if (view?.tunable && change.kelvin != null) {
    data.color_temp_kelvin = clamp(
      Math.round(Number(change.kelvin) || NEUTRAL_KELVIN),
      view.minKelvin || DEFAULT_MIN_KELVIN,
      view.maxKelvin || DEFAULT_MAX_KELVIN,
    );
  }
  if (view?.effects?.length && change.effect) data.effect = clean(change.effect);

  const onlyEntity = Object.keys(data).length === 1;
  if (onlyEntity && power !== true) return { domain, service: "toggle", data };
  return { domain, service: "turn_on", data };
}

/** Header counters for a popup or a room heading. */
export function lightSummary(views = []) {
  const list = Array.isArray(views) ? views : [];
  return {
    total: list.length,
    on: list.filter((view) => view.on).length,
    unavailable: list.filter((view) => !view.available).length,
    dimmable: list.filter((view) => view.dimmable).length,
    colorful: list.filter((view) => view.colorful).length,
  };
}

/**
 * What changed in a way that changes the shape of the popup, as opposed to a
 * value inside it. A lamp that starts reporting a colour, a new light, a rename
 * or a room move rebuilds the markup; on/off, brightness and colour do not.
 */
export function lightsSignature(views = []) {
  return (Array.isArray(views) ? views : [])
    .map((view) =>
      [
        view.id,
        view.name,
        view.room,
        view.floor,
        view.dimmable ? "d" : "",
        view.colorful ? "c" : "",
        view.tunable ? "w" : "",
        view.effects.length,
        view.available ? "" : "x",
      ].join("~"),
    )
    .join("|");
}
