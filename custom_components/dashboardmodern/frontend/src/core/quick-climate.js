/* Cosa fa il tasto del clima rapido, e chi lo decide.
 *
 * Il popup «Clima» della Home accende una stanza in tre passi — modalita',
 * temperatura, ventola — e quei tre passi erano scritti nel codice: freddo,
 * ventisei gradi, ventola automatica. Va benissimo per chi quei numeri li
 * voleva; per tutti gli altri e' un tasto che fa una cosa che non gli hanno
 * chiesto, e l'unico modo di cambiarla era non usarlo.
 *
 * Qui c'e' solo la regola: cosa vuol dire un'impostazione, e in quali chiamate
 * si traduce. Il modulo e' puro — non tocca il documento e non chiama servizi —
 * cosi' la traduzione si prova a tavolino, che e' l'unico modo di essere sicuri
 * che il tasto faccia esattamente quello che dice la scheda.
 *
 * Una casella lasciata vuota vuol dire «non toccare»: chi ha un condizionatore
 * senza ventola non deve ricevere una chiamata che quel condizionatore non sa
 * eseguire, e chi la temperatura la tiene dal termostato non vuole che il tasto
 * gliela riscriva.
 */

export const QUICK_CLIMATE_KEY = "cd_clima_rapido";

/* I passi di OGNI unita', per entita': «come e' impostato ora viene attribuito
 * quel valore a tutto» — e invece la cameretta puo' volere 24 gradi e il
 * salone 26. La chiave globale resta il ripiego di chi non specifica. */
export const QUICK_CLIMATE_UNITS_KEY = "cd_clima_rapido_unita";

/* Le quattro velocita' che Home Assistant chiama standard: il ripiego di
 * quando NESSUNA unita' dichiara le sue — capita alle integrazioni che
 * rispondono tardi o senza attributi. Stessa regola delle modalita': una
 * scheda senza scelte e' peggio di una scheda con una scelta in piu'. */
export const QUICK_CLIMATE_FAN_FALLBACK = Object.freeze(["auto", "low", "medium", "high"]);

/* Quello che la plancia ha sempre fatto: resta il comportamento di chi non
 * apre mai la configurazione. */
export const QUICK_CLIMATE_DEFAULT = Object.freeze({
  mode: "cool",
  temperature: 26,
  fan: "auto",
});

/* Le modalita' di Home Assistant, meno «off»: il tasto serve ad accendere, e
 * spegnere lo fa gia' premendolo una seconda volta. */
export const QUICK_CLIMATE_MODES = Object.freeze([
  "cool",
  "heat",
  "heat_cool",
  "auto",
  "dry",
  "fan_only",
]);

/* Il ripiego della parte Caldo: il default storico (freddo, ventisei gradi,
 * ventola automatica) e' nato per i condizionatori, e un termosifone acceso
 * cosi' farebbe il contrario di quel che gli si chiede. Chi non specifica
 * niente accende in riscaldamento e non tocca altro. */
export const QUICK_CLIMATE_HEAT_DEFAULT = Object.freeze({
  mode: "heat",
  temperature: null,
  fan: "",
});

/* Sotto i cinque gradi e sopra i trentacinque non c'e' un condizionatore che
 * obbedisca: e' un numero digitato male, non una scelta. */
const MIN = 5;
const MAX = 35;

const pulito = (valore) => String(valore ?? "").trim();

/** L'impostazione, ripulita da qualunque cosa ci sia in memoria. */
export function normalizeQuickClimate(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const mode = pulito(dato.mode).toLowerCase();
  const fan = pulito(dato.fan);
  const gradi = Number(dato.temperature);
  return {
    mode: QUICK_CLIMATE_MODES.includes(mode) ? mode : QUICK_CLIMATE_DEFAULT.mode,
    /* `null` non e' «zero gradi»: e' «la temperatura non la tocco». Si
     * distingue dalla casella vuota, che e' proprio quello che si vuol dire. */
    temperature:
      dato.temperature === null || pulito(dato.temperature) === ""
        ? null
        : Number.isFinite(gradi)
          ? Math.min(MAX, Math.max(MIN, Math.round(gradi * 2) / 2))
          : QUICK_CLIMATE_DEFAULT.temperature,
    fan,
  };
}

/**
 * Il preset di UNA unita': il suo se l'ha detto, altrimenti quello globale.
 *
 * `perUnita` e' il contenuto della chiave per-entita' ({ "climate.cucina":
 * {mode,temperature,fan} }), `globale` quello della chiave storica. Un record
 * per-unita' si salva sempre completo dal suo form, quindi il ripiego e' tutto
 * o niente: niente fusioni campo per campo che nessuno saprebbe prevedere.
 */
export function quickClimateForUnit(entity, perUnita, globale) {
  const chiave = pulito(entity);
  const dato =
    perUnita && typeof perUnita === "object" && !Array.isArray(perUnita) ? perUnita[chiave] : null;
  return normalizeQuickClimate(dato && typeof dato === "object" ? dato : globale);
}

/**
 * Il preset visto dalla zona da cui si preme.
 *
 * La parte Caldo del popup accende per scaldare: un preset che dice «cool» o
 * «dry» li' dentro e' un ripiego pensato per i condizionatori (o una pompa di
 * calore configurata dal lato Freddo), e obbedirgli farebbe raffrescare dal
 * tab che promette il contrario. Le modalita' che scaldano — heat, heat_cool,
 * auto, fan_only — restano come scelte, perche' quelle le ha dette qualcuno.
 */
export function quickClimatePresetForZone(preset, zona) {
  const scelta = normalizeQuickClimate(preset);
  if (pulito(zona).toLowerCase() !== "caldo") return scelta;
  if (scelta.mode === "cool" || scelta.mode === "dry") return { ...scelta, mode: "heat" };
  return scelta;
}

/**
 * Le chiamate da fare per accendere, nell'ordine.
 *
 * Restano tre e restano separate — non una sola con tutto dentro — perche' e'
 * cosi' che le accettano i condizionatori veri: mandare la temperatura a uno
 * che e' ancora spento la fa cadere nel vuoto, ed e' il motivo per cui i tre
 * passi sono distanziati anche nel tempo.
 */
export function quickClimateSteps(preset) {
  const scelta = normalizeQuickClimate(preset);
  const passi = [{ service: "set_hvac_mode", data: { hvac_mode: scelta.mode } }];
  if (scelta.temperature != null)
    passi.push({ service: "set_temperature", data: { temperature: scelta.temperature } });
  if (scelta.fan) passi.push({ service: "set_fan_mode", data: { fan_mode: scelta.fan } });
  return passi;
}

/** Come si legge l'impostazione sotto il titolo del popup. */
export function quickClimateHint(preset, parole) {
  const scelta = normalizeQuickClimate(preset);
  const pezzi = [parole.modes?.[scelta.mode] || scelta.mode];
  if (scelta.temperature != null) pezzi.push(`${scelta.temperature}°C`);
  if (scelta.fan) pezzi.push(`${parole.fan} ${scelta.fan}`);
  return `${parole.tap} · ${pezzi.join(" · ")}`;
}
