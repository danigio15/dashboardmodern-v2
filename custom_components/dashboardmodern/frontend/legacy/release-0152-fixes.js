/* DashboardModern 0.14.12: real-runtime fixes for Temperature, appliance artwork and Energy periods. */
const RELEASE_0152_FLAG = "__DASHBOARDMODERN_RELEASE_0152__";
const ENERGY_EVENT = "dashboardmodern:energy-statistics";
const REQUEST_TIMEOUT = 15000;

export const PERIOD_SOURCES_0152 = Object.freeze([
  {
    group: "house",
    totalKey: "total_energy",
    periods: {
      day: { explicitKey: "daily_energy", slot: "dm.energy_consumo_casa_oggi" },
      month: { explicitKey: "monthly_energy", slot: "dm.energy_consumo_casa_mese" },
      year: { explicitKey: "annual_energy", slot: "dm.energy_consumo_casa_anno" },
    },
  },
  {
    group: "grid",
    totalKey: "total_import_energy",
    periods: {
      day: { explicitKey: "daily_import_energy", slot: "dm.energy_energia_prelevata_oggi" },
      month: { explicitKey: "monthly_import_energy", slot: "dm.energy_rete_acquistata_mese" },
      year: { explicitKey: "annual_import_energy", slot: "dm.energy_rete_acquistata_anno" },
    },
  },
  {
    group: "grid",
    totalKey: "total_export_energy",
    periods: {
      day: { explicitKey: "daily_export_energy", slot: "dm.energy_energia_immessa_oggi" },
      month: { explicitKey: "monthly_export_energy", slot: "dm.energy_rete_venduta_mese" },
      year: { explicitKey: "annual_export_energy", slot: "dm.energy_rete_venduta_anno" },
    },
  },
  {
    group: "solar",
    totalKey: "total_energy",
    periods: {
      day: { explicitKey: "daily_energy", slot: "dm.energy_produzione_solare_oggi" },
      month: { explicitKey: "monthly_energy", slot: "dm.energy_produzione_solare_mese" },
      year: { explicitKey: "annual_energy", slot: "dm.energy_produzione_solare_anno" },
    },
  },
  {
    group: "battery",
    totalKey: "total_charged_energy",
    periods: {
      day: { explicitKey: "daily_charged_energy", slot: "dm.energy_batteria_caricata_oggi" },
      month: { explicitKey: "monthly_charged_energy", slot: "dm.energy_batteria_caricata_mese" },
      year: { explicitKey: "annual_charged_energy", slot: "dm.energy_batteria_caricata_anno" },
    },
  },
  {
    group: "battery",
    totalKey: "total_discharged_energy",
    periods: {
      day: { explicitKey: "daily_discharged_energy", slot: "dm.energy_batteria_scaricata_oggi" },
      month: { explicitKey: "monthly_discharged_energy", slot: "dm.energy_batteria_usata_mese" },
      year: { explicitKey: "annual_discharged_energy", slot: "dm.energy_batteria_usata_anno" },
    },
  },
]);

function isEnglish() {
  return globalThis.document?.documentElement?.lang === "en";
}

function copy(it, en) {
  return isEnglish() ? en : it;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowTime(row) {
  const value = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const parsed = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cumulativeValue(row) {
  for (const key of ["sum", "state"]) {
    const value = numberOrNull(row?.[key]);
    if (value != null) return value;
  }
  return null;
}

/** Calculate period use without ever mistaking one lifetime reading for a period. */
export function periodConsumption0152(samples = [], baseline = null) {
  const rows = (Array.isArray(samples) ? samples : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => rowTime(left) - rowTime(right));

  const changes = rows
    .map((row) => numberOrNull(row?.change))
    .filter((value) => value != null);
  if (changes.length) {
    return Math.max(0, changes.reduce((total, value) => total + value, 0));
  }

  const values = rows.map(cumulativeValue).filter((value) => value != null);
  const base = cumulativeValue(baseline);
  if (base != null && values.length) values.unshift(base);
  if (values.length < 2) return null;

  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    const current = values[index];
    const previous = values[index - 1];
    const difference = current - previous;
    total += difference >= 0 ? difference : Math.max(0, current);
  }
  return Math.max(0, total);
}

export function periodRange0152(kind, selected = new Date(), now = new Date()) {
  const date = new Date(selected);
  const current = new Date(now);
  let start;
  let end;
  let period;
  if (kind === "day") {
    start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    end = new Date(start);
    end.setDate(end.getDate() + 1);
    period = "hour";
  } else if (kind === "year") {
    start = new Date(date.getFullYear(), 0, 1);
    end = new Date(date.getFullYear() + 1, 0, 1);
    period = "month";
  } else {
    start = new Date(date.getFullYear(), date.getMonth(), 1);
    end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    period = "day";
  }
  if (end > current) end = current;
  return { start, end, period };
}

function baselineRange(kind, start) {
  const baselineStart = new Date(start);
  if (kind === "day") baselineStart.setHours(baselineStart.getHours() - 1);
  else if (kind === "year") baselineStart.setMonth(baselineStart.getMonth() - 1);
  else baselineStart.setDate(baselineStart.getDate() - 1);
  return { start: baselineStart, end: new Date(start) };
}

function dashboardStore() {
  return globalThis.DashboardModernModules?.store || null;
}

function canonicalRooms() {
  return dashboardStore()?.getSection?.("rooms") || [];
}

function periodRegistry() {
  try {
    if (typeof CD_PERIOD !== "undefined" && CD_PERIOD) return CD_PERIOD;
  } catch (_error) {}
  globalThis.CD_PERIOD ||= {};
  return globalThis.CD_PERIOD;
}

function runtimeStateRegistries() {
  const registries = [];
  try {
    if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) registries.push(_RAW_STATES);
  } catch (_error) {}
  try {
    if (typeof STATES !== "undefined" && STATES) registries.push(STATES);
  } catch (_error) {}
  if (globalThis._RAW_STATES) registries.push(globalThis._RAW_STATES);
  if (globalThis.STATES) registries.push(globalThis.STATES);
  if (!registries.length) {
    globalThis._RAW_STATES = {};
    registries.push(globalThis._RAW_STATES);
  }
  return [...new Set(registries)];
}

function setDerivedPeriod(slot, value, entity, kind, selected) {
  if (!slot || !Number.isFinite(value)) return;
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000;
  periodRegistry()[slot] = rounded;
  const timestamp = new Date().toISOString();
  const state = {
    entity_id: slot,
    state: String(rounded),
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "measurement",
      friendly_name: slot,
      dashboardmodern_derived: true,
      dashboardmodern_source: entity,
      dashboardmodern_period: kind,
      dashboardmodern_selected: selected.toISOString(),
    },
    last_updated: timestamp,
    last_changed: timestamp,
  };
  runtimeStateRegistries().forEach((registry) => {
    registry[slot] = state;
  });
}

function clearDerivedPeriod(slot) {
  if (!slot) return;
  try {
    delete periodRegistry()[slot];
  } catch (_error) {}
}

function totalDefinitions(energy = {}) {
  return PERIOD_SOURCES_0152.map((definition) => {
    const group = energy?.[definition.group] || {};
    const entity = String(group[definition.totalKey] || "").trim();
    return { definition, group, entity };
  }).filter((item) => item.entity);
}

class StatisticsSocket0152 {
  constructor() {
    this.socket = null;
    this.connection = null;
    this.pending = new Map();
    this.nextId = 152000;
  }

  token() {
    const candidates = [
      globalThis.LONG_LIVED_TOKEN,
      globalThis.DASHBOARDMODERN_AUTH_TOKEN,
      globalThis.HA_TOKEN,
    ];
    try {
      const configured = JSON.parse(localStorage.getItem("cd_connection") || "{}");
      candidates.push(configured.token, configured.access_token);
    } catch (_error) {}
    return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
  }

  url() {
    const protocol = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${globalThis.location?.host || "dashboardmodern-bridge"}/api/websocket`;
  }

  connect() {
    if (this.socket?.readyState === 1 && this.connection) return this.connection;
    if (this.connection) return this.connection;
    this.connection = new Promise((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(this.url());
      this.socket = socket;
      const timer = setTimeout(() => {
        if (!settled) reject(new Error(copy("Timeout canale statistiche", "Statistics channel timeout")));
      }, REQUEST_TIMEOUT);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      };
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_error) {
          return;
        }
        if (message.type === "auth_required") {
          const token = this.token();
          if (!token) {
            finish(
              reject,
              new Error(copy("Bridge Home Assistant non autenticato", "Home Assistant bridge is not authenticated")),
            );
          } else {
            socket.send(JSON.stringify({ type: "auth", access_token: token }));
          }
          return;
        }
        if (message.type === "auth_ok") {
          finish(resolve, socket);
          return;
        }
        if (message.type === "auth_invalid") {
          finish(reject, new Error(copy("Autenticazione Home Assistant non valida", "Invalid Home Assistant authentication")));
          return;
        }
        if (message.type !== "result" || message.id == null) return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.success === false) {
          pending.reject(new Error(message.error?.message || "Statistics error"));
        } else {
          pending.resolve(message.result || {});
        }
      };
      socket.onerror = () => finish(reject, new Error(copy("Canale statistiche non disponibile", "Statistics channel unavailable")));
      socket.onclose = () => {
        this.socket = null;
        this.connection = null;
      };
    }).catch((error) => {
      this.connection = null;
      throw error;
    });
    return this.connection;
  }

  async request(payload) {
    const socket = await this.connect();
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(copy("Timeout risposta Recorder", "Recorder response timeout")));
      }, REQUEST_TIMEOUT);
      this.pending.set(id, { resolve, reject, timer });
      // Do not send `change` in `types`: Home Assistant validates that list and
      // returns `change` automatically in statistics rows when it is available.
      socket.send(JSON.stringify({ id, ...payload }));
    });
  }
}

const statisticsSocket = new StatisticsSocket0152();
let refreshGeneration = 0;
let refreshTimer = 0;

function selectedReportDate() {
  const scope =
    document.getElementById("page-energy") || document.getElementById("page-energia") || document;
  const selects = [...scope.querySelectorAll("select")].filter(
    (select) => !select.closest("#editor-modal"),
  );
  const description = (select) =>
    `${select.id} ${select.name} ${select.className} ${select.getAttribute("aria-label") || ""} ${select.previousElementSibling?.textContent || ""}`.toLowerCase();
  const monthSelect = selects.find((select) => /month|mese/.test(description(select)));
  const yearSelect = selects.find((select) => /year|anno/.test(description(select)));
  const now = new Date();
  const rawMonth = Number(monthSelect?.value);
  const month =
    Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12
      ? rawMonth - 1
      : Number.isInteger(rawMonth) && rawMonth >= 0 && rawMonth <= 11
        ? rawMonth
        : now.getMonth();
  const rawYear = Number(yearSelect?.value || yearSelect?.selectedOptions?.[0]?.textContent);
  const year = Number.isInteger(rawYear) && rawYear >= 2000 ? rawYear : now.getFullYear();
  return new Date(year, month, 1);
}

function ensureStatus() {
  const page = document.getElementById("page-energy") || document.getElementById("page-energia");
  if (!page) return null;
  let output = page.querySelector("[data-dm-energy-statistics-status]");
  if (!output) {
    output = document.createElement("output");
    output.dataset.dmEnergyStatisticsStatus = "";
    output.className = "dm-energy-statistics-status-0152";
    (page.querySelector("#ed-pane-analisi") || page).append(output);
  }
  return output;
}

function setStatus(state, message) {
  const output = ensureStatus();
  if (!output) return;
  output.dataset.state = state;
  output.textContent = message;
  output.hidden = !message;
}

async function statisticsForRange(ids, range) {
  return statisticsSocket.request({
    type: "recorder/statistics_during_period",
    start_time: range.start.toISOString(),
    end_time: range.end.toISOString(),
    statistic_ids: ids,
    period: range.period,
    units: { energy: "kWh" },
  });
}

async function requestPeriod(kind, selected, definitions, generation) {
  const range = periodRange0152(kind, selected);
  if (range.end <= range.start) return;
  const ids = [...new Set(definitions.map((item) => item.entity))];
  const result = await statisticsForRange(ids, range);
  if (generation !== refreshGeneration) return;

  const needsBaseline = definitions.filter(({ entity }) => {
    const rows = result?.[entity] || [];
    return periodConsumption0152(rows) == null;
  });
  let baselineResult = {};
  if (needsBaseline.length) {
    const baseline = baselineRange(kind, range.start);
    baselineResult = await statisticsForRange(
      [...new Set(needsBaseline.map((item) => item.entity))],
      { ...baseline, period: range.period },
    );
  }
  if (generation !== refreshGeneration) return;

  definitions.forEach(({ definition, group, entity }) => {
    const target = definition.periods[kind];
    if (!target) return;
    const explicit = String(group[target.explicitKey] || "").trim();
    if (explicit) {
      clearDerivedPeriod(target.slot);
      return;
    }
    const baselineRows = baselineResult?.[entity] || [];
    const baseline = baselineRows.slice().sort((a, b) => rowTime(a) - rowTime(b)).at(-1) || null;
    const value = periodConsumption0152(result?.[entity] || [], baseline);
    if (value == null) {
      clearDerivedPeriod(target.slot);
      return;
    }
    setDerivedPeriod(target.slot, value, entity, kind, selected);
  });
}

export async function refreshEnergyStatistics0152(selected = selectedReportDate()) {
  const store = dashboardStore();
  if (!store?.getSection) return false;
  const definitions = totalDefinitions(store.getSection("energy") || {});
  if (!definitions.length) return false;
  const generation = ++refreshGeneration;
  setStatus(
    "loading",
    copy(
      "Calcolo giorno, mese e anno dai contatori totali…",
      "Calculating day, month and year from total meters…",
    ),
  );
  try {
    await Promise.all([
      requestPeriod("day", new Date(), definitions, generation),
      requestPeriod("month", selected, definitions, generation),
      requestPeriod("year", selected, definitions, generation),
    ]);
    if (generation !== refreshGeneration) return false;
    setStatus("success", "");
    globalThis.render?.();
    globalThis.renderEnergy?.();
    globalThis.renderEnergyDashboard?.();
    globalThis.renderReport?.();
    globalThis.dispatchEvent?.(
      new CustomEvent(ENERGY_EVENT, {
        detail: { selected: selected.toISOString(), version: "0.14.12" },
      }),
    );
    return true;
  } catch (error) {
    if (generation !== refreshGeneration) return false;
    // Historical/statistics errors remain local to Energy and never alter the
    // global Home Assistant connection indicator.
    setStatus(
      "error",
      `${copy("Statistiche del periodo non disponibili", "Period statistics unavailable")}: ${error.message}`,
    );
    console.warn("[DashboardModern 0.14.12] Energy statistics", error);
    return false;
  }
}

function scheduleEnergyRefresh(delay = 80) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshEnergyStatistics0152(), delay);
}

export function applianceArtwork0152(type, size = 76) {
  const token = String(type || "").toLowerCase();
  const common = `width="${size}" height="${size}" viewBox="0 0 96 96" role="img" aria-hidden="true"`;
  if (/frigo|fridge|refriger|frigorifero/.test(token)) {
    return `<span class="dm-appliance-art dm-appliance-art-0152" data-dm-art="fridge"><svg ${common}><defs><linearGradient id="dm-fridge-0152" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eff6ff"/><stop offset="1" stop-color="#bfdbfe"/></linearGradient></defs><rect x="18" y="6" width="60" height="84" rx="14" fill="#0f2942"/><rect x="25" y="13" width="46" height="31" rx="8" fill="url(#dm-fridge-0152)"/><rect x="25" y="50" width="46" height="33" rx="8" fill="url(#dm-fridge-0152)"/><rect x="31" y="20" width="7" height="17" rx="3.5" fill="#22b8f0"/><rect x="31" y="57" width="7" height="19" rx="3.5" fill="#22b8f0"/><circle cx="64" cy="22" r="4" fill="#22b8f0"/></svg></span>`;
  }
  if (/scaldabagno|boiler|water[_ -]?heater/.test(token)) {
    return `<span class="dm-appliance-art dm-appliance-art-0152" data-dm-art="boiler"><svg ${common}><defs><linearGradient id="dm-boiler-0152" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eff6ff"/><stop offset="1" stop-color="#bae6fd"/></linearGradient></defs><rect x="20" y="5" width="56" height="82" rx="28" fill="#0f2942"/><rect x="27" y="12" width="42" height="68" rx="21" fill="url(#dm-boiler-0152)"/><path d="M37 86v5M59 86v5" stroke="#0f2942" stroke-width="7" stroke-linecap="round"/><path d="M48 27c10 12 13 19 13 25a13 13 0 1 1-26 0c0-6 3-13 13-25Z" fill="#22b8f0"/><path d="M48 45c4 5 6 9 6 12a6 6 0 0 1-12 0c0-3 2-7 6-12Z" fill="#eff6ff"/><circle cx="48" cy="70" r="5" fill="#0f2942"/></svg></span>`;
  }
  return "";
}

function applianceType(item = {}) {
  return String(
    item.visual_key || item.device_type || item.type || item.icon || item.name || "",
  ).toLowerCase();
}

function installApplianceArtwork() {
  const previous = globalThis.cdApplianceIcon;
  if (typeof previous !== "function" || previous.__dm0152) return typeof previous === "function";
  const wrapped = function cdApplianceIcon0152(type, size) {
    return applianceArtwork0152(type, size) || previous.call(this, type, size);
  };
  wrapped.__dm0152 = true;
  wrapped.__dmPrevious = previous;
  globalThis.cdApplianceIcon = wrapped;
  globalThis.renderApplianceSection?.(true);
  return true;
}

function decorateApplianceCards() {
  const items = dashboardStore()?.getSection?.("appliances") || [];
  const byId = new Map(items.map((item) => [String(item.id || ""), item]));
  document
    .querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]")
    .forEach((card) => {
      const item = byId.get(String(card.dataset.applianceId || ""));
      const type = applianceType(item);
      if (/frigo|fridge|refriger|frigorifero/.test(type)) card.dataset.dmArtwork = "fridge";
      else if (/scaldabagno|boiler|water[_ -]?heater/.test(type)) card.dataset.dmArtwork = "boiler";
      else delete card.dataset.dmArtwork;
    });
}

function syncTemperatureIcon(form) {
  const select = form.querySelector("#dm-temperature-room");
  const icon = form.querySelector("#dm-temperature-icon");
  if (!icon) return;
  const room = canonicalRooms().find((item) => String(item.id) === String(select?.value || ""));
  if (room?.icon) icon.value = room.icon;
}

function normalizeTemperatureEditor() {
  const form = document.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return;
  form.dataset.dmTemperatureCanonical = "true";
  const iconInput = form.querySelector("#dm-temperature-icon");
  const iconField = iconInput?.closest("label.ed-slot") || iconInput?.closest("[data-icon-field]");
  if (iconInput) {
    iconInput.type = "hidden";
    iconInput.tabIndex = -1;
    iconInput.setAttribute("aria-hidden", "true");
  }
  if (iconField) {
    iconField.hidden = true;
    iconField.setAttribute("aria-hidden", "true");
    iconField.style.setProperty("display", "none", "important");
  }
  const intro = form.parentElement?.querySelector("[data-temperature-editor]");
  if (intro) {
    intro.textContent = copy(
      "Seleziona una stanza già creata e associa soltanto i sensori di temperatura e umidità. Nome e icona si modificano esclusivamente nella sezione Stanze.",
      "Select an existing room and associate only temperature and humidity sensors. Name and icon are edited exclusively in Rooms.",
    );
  }
  form.querySelectorAll(".ed-slot-lbl").forEach((label) => {
    for (const node of label.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) node.nodeValue = node.nodeValue.replace(/[✏️🖉]/g, "").trimEnd();
    }
  });
  const title = form.querySelector("[data-temperature-form-title]");
  if (title && !/modifica|edit/i.test(title.textContent || "")) {
    title.textContent = copy("＋ Associa sensori alla stanza", "＋ Associate sensors with room");
  }
  const submit = form.querySelector("[data-temperature-submit]");
  if (submit && !/salva|save/i.test(submit.textContent || "")) {
    submit.textContent = copy("ASSOCIA SENSORI", "ASSOCIATE SENSORS");
  }
  if (form.dataset.dmTemperatureListeners !== "true") {
    form.dataset.dmTemperatureListeners = "true";
    form.querySelector("#dm-temperature-room")?.addEventListener("change", () => syncTemperatureIcon(form));
    form.addEventListener("submit", () => syncTemperatureIcon(form), true);
  }
  syncTemperatureIcon(form);
}

function installStyles() {
  if (document.getElementById("dm-release-0152-styles")) return;
  const style = document.createElement("style");
  style.id = "dm-release-0152-styles";
  style.textContent = `
    #editor-modal [data-temperature-form][data-dm-temperature-canonical="true"]{
      display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:14px!important;
      padding:18px!important;border:1px solid var(--card-border,var(--divider-color,#dbe4ee))!important;
      border-radius:22px!important;background:var(--card-bg,var(--ha-card-background,#fff))!important;
    }
    #editor-modal [data-temperature-form] #dm-temperature-icon,
    #editor-modal [data-temperature-form] #dm-temperature-icon + button,
    #editor-modal [data-temperature-form] label:has(#dm-temperature-icon){display:none!important}
    #editor-modal [data-temperature-form] .ed-slot{margin:0!important}
    #editor-modal [data-temperature-form] .ed-slot-lbl{display:block!important;margin-bottom:7px!important}
    #editor-modal [data-temperature-form] .ed-slot-lbl::after{content:none!important;display:none!important}
    #editor-modal [data-temperature-form] .dm-temperature-actions{display:flex!important;gap:10px!important;margin-top:2px!important}
    #editor-modal [data-temperature-form] [data-temperature-submit]{width:100%!important;min-height:48px!important}

    #page-appliances-main .appl-wide-card[data-dm-artwork] .appl-visual{
      background:linear-gradient(145deg,#edf4fa,#dfe9f2)!important;
    }
    #page-appliances-main .appl-wide-card[data-dm-artwork] .dm-appliance-art-0152{
      display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
      max-width:100%!important;max-height:100%!important;padding:6px!important;
    }
    #page-appliances-main .appl-wide-card[data-dm-artwork] .dm-appliance-art-0152 svg{
      display:block!important;width:76%!important;height:76%!important;max-width:76%!important;max-height:76%!important;
      object-fit:contain!important;transform:none!important;overflow:visible!important;
    }

    .dm-energy-statistics-status-0152{
      display:block;width:max-content;max-width:calc(100% - 24px);margin:14px 12px 0;padding:8px 12px;
      border-radius:999px;font-size:11px;font-weight:800;line-height:1.3;
      background:#fff7ed;color:#c2410c;border:1px solid #fdba74;
    }
    .dm-energy-statistics-status-0152[data-state="loading"]{background:#eff6ff;color:#1d4ed8;border-color:#93c5fd}
  `;
  document.head.append(style);
}

function installInteractionHooks() {
  document.addEventListener(
    "change",
    (event) => {
      const select = event.target;
      if (!(select instanceof HTMLSelectElement) || select.closest("#editor-modal")) return;
      const description = `${select.id} ${select.name} ${select.getAttribute("aria-label") || ""}`;
      if (/month|mese|year|anno/i.test(description)) scheduleEnergyRefresh(20);
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest?.("button,.energy-nav-btn,.hist-time-btn");
      if (!button) return;
      if (/report|giornal|daily|mensil|monthly|ann|year|analisi|analysis/i.test(button.textContent || "")) {
        scheduleEnergyRefresh(50);
      }
    },
    true,
  );
  dashboardStore()?.subscribe?.((change) => {
    if (change.section === "energy" && change.status === "success") scheduleEnergyRefresh(0);
  });
}

function decorateAll() {
  normalizeTemperatureEditor();
  installApplianceArtwork();
  decorateApplianceCards();
}

function install() {
  if (globalThis[RELEASE_0152_FLAG]?.installed) return;
  globalThis[RELEASE_0152_FLAG] = { installed: true, version: "0.14.12" };
  installStyles();
  installInteractionHooks();

  // Replace both legacy total derivation entry points. Their existing timers
  // resolve these globals at run time, so they also use the corrected engine.
  try {
    globalThis.cdDeriveFromTotals = () => refreshEnergyStatistics0152();
    globalThis.cdRefreshPeriodDeltas = () => refreshEnergyStatistics0152();
  } catch (_error) {}

  let frame = 0;
  const scheduleDecorate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(decorateAll);
  };
  new MutationObserver(scheduleDecorate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  globalThis.addEventListener("dashboardmodern:legacy-ready", () => {
    scheduleDecorate();
    scheduleEnergyRefresh(120);
  });
  scheduleDecorate();
  scheduleEnergyRefresh(900);
  setInterval(scheduleEnergyRefresh, 5 * 60 * 1000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
}
