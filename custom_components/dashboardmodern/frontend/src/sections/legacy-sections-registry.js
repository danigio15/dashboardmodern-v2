const root = globalThis;

const DEFINITIONS = Object.freeze([
  {
    key: "home",
    pageId: "page-home",
    renderers: ["renderHome", "render", "buildHome"],
    refreshers: ["renderHome", "render", "refreshWeather"],
    state: ["STATES", "cd_rooms", "cd_devices"],
  },
  {
    key: "climate",
    pageId: "page-clima",
    renderers: ["renderClimate", "renderClima", "buildClimateCards"],
    refreshers: ["renderClimate", "renderClima", "refreshClimate"],
    state: ["STATES", "cd_climate", "cd_rooms"],
  },
  {
    key: "security",
    pageId: "page-security",
    renderers: ["renderSecurity", "buildCamCards", "refreshCameras"],
    refreshers: ["refreshCameras", "buildCamCards", "renderSecurity"],
    state: ["STATES", "cd_cameras", "cd_security"],
  },
  {
    key: "solar-thermal",
    pageId: "page-boiler",
    renderers: ["renderSolarThermal", "renderBoiler", "buildBoiler"],
    refreshers: ["renderSolarThermal", "renderBoiler", "refreshBoiler"],
    state: ["STATES", "cd_boiler", "cd_solar"],
  },
  {
    key: "pool",
    pageId: "page-piscina",
    renderers: ["renderPool", "renderPiscina", "buildPool"],
    refreshers: ["renderPool", "renderPiscina", "refreshPool"],
    state: ["STATES", "cd_pool"],
  },
  {
    key: "irrigation",
    pageId: "page-irrigazione",
    renderers: ["renderIrrigation", "renderIrrigazione", "buildIrrigation"],
    refreshers: ["renderIrrigation", "renderIrrigazione", "refreshIrrigation"],
    state: ["STATES", "cd_irrigation"],
  },
  {
    key: "minipc",
    pageId: "page-server",
    renderers: ["renderMiniPc", "renderServer", "buildServerCards"],
    refreshers: ["renderMiniPc", "renderServer", "refreshServer"],
    state: ["STATES", "cd_server", "cd_minipc"],
  },
]);

function callFirst(names, args = []) {
  for (const name of names) {
    const fn = root[name];
    if (typeof fn === "function") return fn(...args);
  }
  return undefined;
}

function createAdapter(definition) {
  const { key, pageId, renderers, refreshers, state } = definition;
  return Object.freeze({
    key,
    pageId,
    isVisible() {
      const page = root.document?.getElementById?.(pageId);
      return Boolean(page?.classList?.contains("active"));
    },
    render(...args) {
      return callFirst(renderers, args);
    },
    refresh(...args) {
      return callFirst(refreshers.length ? refreshers : renderers, args);
    },
    snapshot() {
      return Object.fromEntries(state.map((name) => [name, root[name]]));
    },
  });
}

export function installLegacySections() {
  root.__DASHBOARDMODERN_SECTIONS__ ||= {};
  for (const definition of DEFINITIONS) {
    root.__DASHBOARDMODERN_SECTIONS__[definition.key] ||= createAdapter(definition);
  }
  return root.__DASHBOARDMODERN_SECTIONS__;
}

export const LEGACY_SECTION_KEYS = Object.freeze(DEFINITIONS.map(({ key }) => key));
