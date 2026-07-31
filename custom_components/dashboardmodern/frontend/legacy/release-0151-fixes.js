/* DashboardModern 0.14.11: final room, appliance, report and Energy stabilization. */
const RELEASE_0151_FLAG = "__DASHBOARDMODERN_RELEASE_0151__";
const ENERGY_REFRESH_EVENT = "dashboardmodern:energy-statistics";

const PERIOD_SOURCES = Object.freeze([
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

const MDI_GLYPHS_0151 = Object.freeze({
  "mdi:stove": "♨️",
  "mdi:fire": "🔥",
  "mdi:fridge-outline": "❄️",
  "mdi:fridge-bottom": "🧊",
  "mdi:snowflake": "❄️",
  "mdi:washing-machine": "🧺",
  "mdi:dishwasher": "🍽️",
  "mdi:tumble-dryer": "💨",
  "mdi:microwave": "〰️",
  "mdi:water-boiler": "🚿",
  "mdi:television": "📺",
  "mdi:air-conditioner": "❄️",
  "mdi:fan": "🌀",
  "mdi:robot-vacuum": "🤖",
  "mdi:vacuum": "🧹",
  "mdi:coffee-maker": "☕",
  "mdi:kettle": "🫖",
  "mdi:toaster": "🍞",
  "mdi:power-plug": "🔌",
  "mdi:flash": "⚡",
  "mdi:devices": "🔌",
  "mdi:home": "🏠",
  "mdi:sofa": "🛋️",
  "mdi:bed": "🛏️",
  "mdi:silverware-fork-knife": "🍽️",
  "mdi:shower": "🚿",
  "mdi:desk": "🖥️",
});

function isEnglish() {
  return document.documentElement.lang === "en";
}

function copy(it, en) {
  return isEnglish() ? en : it;
}

function normalized(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function mdiGlyph0151(icon) {
  const value = String(icon || "").trim().toLowerCase();
  if (!value.startsWith("mdi:")) return String(icon || "");
  if (MDI_GLYPHS_0151[value]) return MDI_GLYPHS_0151[value];
  if (/fridge|freezer|snow|ice/.test(value)) return "❄️";
  if (/stove|oven|fire/.test(value)) return "♨️";
  if (/washing|laundry/.test(value)) return "🧺";
  if (/dish/.test(value)) return "🍽️";
  if (/dryer|wind|fan/.test(value)) return "💨";
  if (/water|boiler|shower/.test(value)) return "🚿";
  if (/television|monitor|desk/.test(value)) return "📺";
  if (/bed/.test(value)) return "🛏️";
  if (/sofa|living/.test(value)) return "🛋️";
  if (/home|room/.test(value)) return "🏠";
  return "⚡";
}

export function periodDelta(samples = []) {
  const rows = Array.isArray(samples) ? samples : [];
  const changes = rows
    .map((row) => Number(row?.change))
    .filter((value) => Number.isFinite(value));
  if (changes.length) return Math.max(0, changes.reduce((sum, value) => sum + value, 0));

  for (const key of ["sum", "state", "mean"]) {
    const values = rows
      .map((row) => Number(row?.[key]))
      .filter((value) => Number.isFinite(value));
    if (!values.length) continue;
    if (values.length === 1) return Math.max(0, values[0]);
    const direct = values.at(-1) - values[0];
    if (direct >= 0) return direct;
    // total_increasing can reset. Sum every positive segment instead of
    // returning a negative period when the meter restarted.
    let total = 0;
    for (let index = 1; index < values.length; index += 1) {
      const difference = values[index] - values[index - 1];
      total += difference >= 0 ? difference : Math.max(0, values[index]);
    }
    return Math.max(0, total);
  }
  return 0;
}

export function periodRange(kind, selected = new Date(), now = new Date()) {
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

function dataStore() {
  return globalThis.DashboardModernModules?.store;
}

function canonicalRooms() {
  return dataStore()?.getSection?.("rooms") || [];
}

function findRoomForCard(card, rooms = canonicalRooms()) {
  const id = String(card.dataset.roomId || "").trim();
  if (id) {
    const byId = rooms.find((room) => String(room.id || "") === id);
    if (byId) return byId;
  }
  const name = String(card.querySelector(".cp-name")?.textContent || "").trim().toLowerCase();
  return rooms.find((room) => String(room.name || "").trim().toLowerCase() === name) || null;
}

function stableRoomIconMarkup(room) {
  const icon = String(room?.icon || "mdi:home").trim();
  try {
    const markup = globalThis.cdIconMarkup?.(icon, 30);
    if (markup) return markup;
  } catch (_error) {}
  return `<span aria-hidden="true">${mdiGlyph0151(icon)}</span>`;
}

function stabilizeTemperatureCards() {
  const rooms = canonicalRooms();
  document.querySelectorAll("#temp-grid .temp-card").forEach((card) => {
    const room = findRoomForCard(card, rooms);
    if (!room) return;
    card.dataset.roomId = room.id || "";
    card.classList.add("dm-temperature-stable-0151");

    const legacyIcon = card.querySelector(".cp-icon:not(.dm-room-icon-0151)");
    if (legacyIcon) {
      legacyIcon.hidden = true;
      legacyIcon.setAttribute("aria-hidden", "true");
      legacyIcon.dataset.dmLegacyRoomIcon = "true";
    }

    const title = card.querySelector(".cp-title-wrap") || card.querySelector(".temp-card-header") || card;
    let stable = card.querySelector(".dm-room-icon-0151");
    if (!stable) {
      stable = document.createElement("span");
      stable.className = "dm-room-icon-0151";
      title.prepend(stable);
    }
    const signature = `${room.id || room.name}|${room.icon || "mdi:home"}`;
    if (stable.dataset.signature !== signature) {
      stable.innerHTML = stableRoomIconMarkup(room);
      stable.dataset.signature = signature;
      stable.setAttribute("aria-label", room.name || copy("Stanza", "Room"));
    }
    card.querySelectorAll(".dm-room-icon-0151").forEach((node, index) => {
      if (index) node.remove();
    });
  });
}

function lockTemperatureEditorToRooms() {
  const root = document.querySelector('[data-temperature-editor]')?.closest("#ed-body") ||
    document.querySelector(".dm-temperature-form")?.parentElement;
  if (!root) return;
  const form = root.querySelector("[data-temperature-form]");
  if (!form) return;

  const iconInput = form.querySelector("#dm-temperature-icon");
  const iconField = iconInput?.closest("label.ed-slot") || iconInput?.closest("[data-icon-field]");
  if (iconInput) {
    iconInput.type = "hidden";
    iconInput.tabIndex = -1;
    iconInput.dataset.dmCanonicalRoomIcon = "true";
  }
  if (iconField) {
    iconField.hidden = true;
    iconField.dataset.dmTemperatureIconLocked = "true";
  }

  const intro = root.querySelector("[data-temperature-editor]");
  if (intro) {
    intro.textContent = copy(
      "Seleziona una stanza già creata e associa soltanto i sensori di temperatura e umidità. Nome e icona si modificano esclusivamente nella sezione Stanze.",
      "Select an existing room and associate only temperature and humidity sensors. Name and icon are edited exclusively in Rooms.",
    );
  }
  const title = form.querySelector("[data-temperature-form-title]");
  if (title && !/modifica|edit/i.test(title.textContent || "")) {
    title.textContent = copy("＋ Associa sensori alla stanza", "＋ Associate sensors with room");
  }
  const submit = form.querySelector("[data-temperature-submit]");
  if (submit && !/salva|save/i.test(submit.textContent || "")) {
    submit.textContent = copy("ASSOCIA", "ASSOCIATE");
  }

  if (form.dataset.dmRoomOnlyMounted === "true") return;
  form.dataset.dmRoomOnlyMounted = "true";
  form.addEventListener(
    "submit",
    () => {
      const roomId = form.querySelector("#dm-temperature-room")?.value || "";
      const room = canonicalRooms().find((item) => String(item.id) === String(roomId));
      if (iconInput) iconInput.value = room?.icon || "mdi:home";
    },
    true,
  );
}

function applianceItems() {
  const store = dataStore();
  return [
    ...(store?.getSection?.("appliances") || []),
    ...(store?.getSection?.("loads") || []),
  ];
}

function reportItemForRow(row) {
  const items = applianceItems();
  const id = String(row.dataset.reportId || row.dataset.deviceId || "");
  if (id) {
    const match = items.find((item) => String(item.id || "") === id);
    if (match) return match;
  }
  const name = String(
    row.querySelector("[data-report-name]")?.value ||
      row.querySelector(".ed-row-name,.g-name,.appl-wide-name")?.textContent ||
      "",
  )
    .trim()
    .toLowerCase();
  return items.find((item) => String(item.name || "").trim().toLowerCase() === name) || null;
}

function reportGlyph(item, row) {
  const iconInput = row.querySelector(
    '.dm-icon-field input,[data-icon-field] input,[data-report-icon],input[name*="icon"]',
  );
  const explicit = String(
    iconInput?.value || item?.report_icon || item?.emoji_icon || item?.icon || "",
  ).trim();
  if (explicit) return mdiGlyph0151(explicit);
  const token = normalized(
    item?.visual_key || item?.device_type || item?.type || item?.category || item?.name || "",
  );
  if (/forno|oven|stove/.test(token)) return "♨️";
  if (/frigo|fridge|refriger|freezer|congel/.test(token)) return "❄️";
  if (/lavatrice|washer|washing/.test(token)) return "🧺";
  if (/lavastoviglie|dishwasher/.test(token)) return "🍽️";
  if (/asciugatrice|dryer/.test(token)) return "💨";
  if (/microonde|microwave/.test(token)) return "〰️";
  if (/boiler|scaldabagno/.test(token)) return "🚿";
  if (/television|\btv\b/.test(token)) return "📺";
  return "⚡";
}

function decorateReportRows() {
  document
    .querySelectorAll(".dm-report-row,[data-report-id],[data-device-report]")
    .forEach((row) => {
      const item = reportItemForRow(row);
      const glyph = reportGlyph(item, row);
      let preview = row.querySelector(".dm-report-icon-preview");
      if (!preview) {
        preview = document.createElement("span");
        preview.className = "dm-report-icon-preview";
        row.prepend(preview);
      }
      const image = String(item?.image || item?.image_url || "").trim();
      const signature = `${item?.id || ""}|${image}|${glyph}`;
      if (preview.dataset.dm0151Signature === signature) return;
      preview.replaceChildren();
      if (image) {
        const img = document.createElement("img");
        img.src = image;
        img.alt = "";
        img.addEventListener(
          "error",
          () => {
            preview.replaceChildren();
            const fallback = document.createElement("span");
            fallback.className = "dm-report-glyph-0151";
            fallback.textContent = glyph;
            preview.append(fallback);
          },
          { once: true },
        );
        preview.append(img);
      } else {
        const span = document.createElement("span");
        span.className = "dm-report-glyph-0151";
        span.textContent = glyph;
        preview.append(span);
      }
      preview.dataset.dm0151Signature = signature;
      preview.setAttribute(
        "aria-label",
        item?.name || copy("Icona elettrodomestico", "Appliance icon"),
      );
    });
}

function localConnection() {
  try {
    return JSON.parse(localStorage.getItem("cd_connection") || "{}");
  } catch (_error) {
    return {};
  }
}

class StatisticsClient {
  constructor() {
    this.socket = null;
    this.ready = null;
    this.nextId = 151000;
    this.pending = new Map();
  }

  connect() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const connection = localConnection();
      const url = connection.ws_url || "ws://dashboardmodern-bridge/api/websocket";
      let settled = false;
      const socket = new WebSocket(url);
      this.socket = socket;
      const timeout = setTimeout(() => {
        if (!settled) reject(new Error(copy("Timeout statistiche", "Statistics timeout")));
      }, 10000);
      const finish = () => {
        settled = true;
        clearTimeout(timeout);
        resolve(socket);
      };
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_error) {
          return;
        }
        if (message.type === "auth_required") {
          // The hosted integration uses BridgeSocket and never reaches this
          // branch. Standalone mode may authenticate with its configured token.
          const token = connection.token || connection.access_token || "";
          if (token) socket.send(JSON.stringify({ type: "auth", access_token: token }));
          else reject(new Error(copy("Connessione Home Assistant non autenticata", "Home Assistant connection is not authenticated")));
          return;
        }
        if (message.type === "auth_ok") {
          finish();
          return;
        }
        if (message.type === "auth_invalid") {
          reject(new Error(copy("Credenziali Home Assistant non valide", "Invalid Home Assistant credentials")));
          return;
        }
        if (message.type !== "result" || !message.id) return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.success === false) pending.reject(new Error(message.error?.message || "Statistics error"));
        else pending.resolve(message.result || {});
      };
      socket.onerror = () => reject(new Error(copy("Errore canale statistiche", "Statistics channel error")));
      socket.onclose = () => {
        this.socket = null;
        this.ready = null;
      };
    });
    return this.ready;
  }

  async request(payload) {
    const socket = await this.connect();
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(copy("Timeout risposta statistiche", "Statistics response timeout")));
      }, 15000);
      this.pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, ...payload }));
    });
  }
}

const statisticsClient = new StatisticsClient();
let refreshTimer = 0;
let refreshGeneration = 0;

function monthNames() {
  return isEnglish()
    ? ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
    : ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
}

function selectLabel(select) {
  return `${select.id} ${select.name} ${select.className} ${select.getAttribute("aria-label") || ""} ${select.previousElementSibling?.textContent || ""}`.toLowerCase();
}

function selectedReportDate() {
  const scope = document.getElementById("page-energy") || document.getElementById("page-energia") || document;
  const selects = [...scope.querySelectorAll("select")].filter((select) => !select.closest("#editor-modal"));
  const monthSelect = selects.find((select) => /month|mese/.test(selectLabel(select))) ||
    selects.find((select) => [...select.options].some((option) => monthNames().includes(normalized(option.textContent).replace(/_/g, ""))));
  const yearSelect = selects.find((select) => /year|anno/.test(selectLabel(select))) ||
    selects.find((select) => [...select.options].some((option) => /^20\d{2}$/.test(String(option.value || option.textContent).trim())));
  const now = new Date();
  let month = now.getMonth();
  if (monthSelect) {
    const raw = Number(monthSelect.value);
    if (Number.isInteger(raw) && raw >= 1 && raw <= 12) month = raw - 1;
    else if (Number.isInteger(raw) && raw >= 0 && raw <= 11) month = raw;
    else {
      const token = normalized(monthSelect.selectedOptions?.[0]?.textContent || "").replace(/_/g, "");
      const found = monthNames().indexOf(token);
      if (found >= 0) month = found;
      else if (monthSelect.selectedIndex >= 0 && monthSelect.options.length === 12) month = monthSelect.selectedIndex;
    }
  }
  const parsedYear = Number(yearSelect?.value || yearSelect?.selectedOptions?.[0]?.textContent);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 ? parsedYear : now.getFullYear();
  return new Date(year, month, 1);
}

function totalDefinitions(energy) {
  return PERIOD_SOURCES.map((definition) => {
    const group = energy?.[definition.group] || {};
    const entity = String(group[definition.totalKey] || "").trim();
    return { definition, group, entity };
  }).filter((item) => item.entity);
}

function rawStateTarget() {
  if (!globalThis._RAW_STATES) globalThis._RAW_STATES = {};
  return globalThis._RAW_STATES;
}

function injectPeriodValue(slot, value, entity, kind, selected) {
  if (!slot || !Number.isFinite(value)) return;
  const state = {
    entity_id: slot,
    state: Math.max(0, value).toFixed(1),
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
    last_updated: new Date().toISOString(),
    last_changed: new Date().toISOString(),
  };
  rawStateTarget()[slot] = state;
  try {
    if (globalThis.STATES && globalThis.STATES !== globalThis._RAW_STATES) globalThis.STATES[slot] = state;
  } catch (_error) {}
}

function ensureStatisticsStatus() {
  const page = document.getElementById("page-energy") || document.getElementById("page-energia");
  if (!page) return null;
  let output = page.querySelector("[data-dm-energy-statistics-status]");
  if (!output) {
    output = document.createElement("output");
    output.dataset.dmEnergyStatisticsStatus = "";
    output.className = "dm-energy-statistics-status-0151";
    const report = page.querySelector("#ed-pane-analisi") || page.querySelector(".energy-report") || page;
    report.append(output);
  }
  return output;
}

function setStatisticsStatus(state, message) {
  const output = ensureStatisticsStatus();
  if (!output) return;
  output.dataset.state = state;
  output.textContent = message;
  output.hidden = !message;
}

async function requestPeriod(kind, selected, definitions, generation) {
  const range = periodRange(kind, selected);
  if (range.end <= range.start) return;
  const ids = [...new Set(definitions.map((item) => item.entity))];
  const result = await statisticsClient.request({
    type: "recorder/statistics_during_period",
    start_time: range.start.toISOString(),
    end_time: range.end.toISOString(),
    statistic_ids: ids,
    period: range.period,
    types: ["change", "sum", "state"],
  });
  if (generation !== refreshGeneration) return;
  definitions.forEach(({ definition, group, entity }) => {
    const target = definition.periods[kind];
    if (!target || String(group[target.explicitKey] || "").trim()) return;
    const value = periodDelta(result?.[entity] || []);
    injectPeriodValue(target.slot, value, entity, kind, selected);
  });
}

export async function refreshEnergyStatistics0151(selected = selectedReportDate()) {
  const store = dataStore();
  if (!store?.getSection) return false;
  const energy = store.getSection("energy") || {};
  const definitions = totalDefinitions(energy);
  if (!definitions.length) return false;
  const generation = ++refreshGeneration;
  setStatisticsStatus("loading", copy("Calcolo dei periodi dalle statistiche di Home Assistant…", "Calculating periods from Home Assistant statistics…"));
  try {
    await Promise.all([
      requestPeriod("day", new Date(), definitions, generation),
      requestPeriod("month", selected, definitions, generation),
      requestPeriod("year", selected, definitions, generation),
    ]);
    if (generation !== refreshGeneration) return false;
    setStatisticsStatus("success", "");
    try {
      globalThis.render?.();
      globalThis.renderEnergy?.();
      globalThis.renderReport?.();
    } catch (_error) {}
    globalThis.dispatchEvent?.(
      new CustomEvent(ENERGY_REFRESH_EVENT, { detail: { selected: selected.toISOString() } }),
    );
    return true;
  } catch (error) {
    if (generation !== refreshGeneration) return false;
    // A failed historical query is local to the Report. Never turn the global
    // Home Assistant connection indicator red and never retry through REST.
    setStatisticsStatus(
      "error",
      `${copy("Statistiche del periodo non disponibili", "Period statistics unavailable")}: ${error.message}`,
    );
    console.warn("[DashboardModern] Energy statistics", error);
    return false;
  }
}

function scheduleStatisticsRefresh(delay = 80) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshEnergyStatistics0151(), delay);
}

function disableLegacyRestDerivation() {
  const replacement = () => refreshEnergyStatistics0151();
  replacement.__dm0151 = true;
  try {
    globalThis.cdDeriveFromTotals = replacement;
  } catch (_error) {}
}

function installInteractionHooks() {
  document.addEventListener(
    "change",
    (event) => {
      const select = event.target;
      if (!(select instanceof HTMLSelectElement) || select.closest("#editor-modal")) return;
      if (/month|mese|year|anno/.test(selectLabel(select))) scheduleStatisticsRefresh(0);
    },
    true,
  );
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button,.energy-nav-btn,.hist-time-btn");
      if (!button) return;
      if (/report|giornal|daily|mensil|monthly|analisi|analysis/i.test(button.textContent || "")) {
        scheduleStatisticsRefresh(60);
      }
    },
    true,
  );
  dataStore()?.subscribe?.((change) => {
    if (change.section === "energy" && change.status === "success") scheduleStatisticsRefresh(0);
  });
}

function installStyles() {
  if (document.getElementById("dm-release-0151-styles")) return;
  const style = document.createElement("style");
  style.id = "dm-release-0151-styles";
  style.textContent = `
    /* One canonical room icon. Legacy render loops may still update their own
       cp-icon, but it is hidden and therefore cannot flicker. */
    #temp-grid .temp-card .cp-icon[data-dm-legacy-room-icon="true"]{display:none!important}
    #temp-grid .dm-room-icon-0151{
      display:grid!important;place-items:center!important;position:static!important;
      width:52px!important;height:52px!important;min-width:52px!important;
      border-radius:17px!important;margin:0!important;transform:none!important;
      animation:none!important;transition:none!important;overflow:hidden!important;
      background:linear-gradient(145deg,#e0f2fe,#dbeafe)!important;color:#0284c7!important;
      box-shadow:inset 0 0 0 1px rgba(14,165,233,.1)!important;
    }
    #temp-grid .dm-room-icon-0151 ha-icon{width:30px!important;height:30px!important;animation:none!important;transform:none!important}
    #temp-grid .dm-room-icon-0151>span{font-size:27px!important;line-height:1!important}
    #temp-grid .temp-card.dm-temperature-stable-0151{height:auto!important;min-height:128px!important}
    #temp-grid .temp-card.dm-temperature-stable-0151>.temp-card-header{
      display:flex!important;align-items:center!important;position:static!important;
      grid-column:1/-1!important;grid-row:1!important;width:100%!important;
      transform:none!important;margin:0!important;
    }
    #temp-grid .temp-card.dm-temperature-stable-0151 .cp-title-wrap{
      display:flex!important;align-items:center!important;gap:12px!important;min-width:0!important;
    }

    /* Every appliance uses the same oven-like shell and media viewport. */
    #page-appliances-main .appl-wide-card{
      display:grid!important;grid-template-columns:94px minmax(0,1fr)!important;
      width:100%!important;min-width:0!important;min-height:144px!important;height:144px!important;
      overflow:hidden!important;border-radius:22px!important;
      background:var(--card-bg,var(--ha-card-background,#fff))!important;
      border:1px solid var(--card-border,var(--divider-color,#dbe4ee))!important;
      box-shadow:0 10px 28px rgba(15,23,42,.11)!important;
    }
    #page-appliances-main .appl-wide-card .appl-visual{
      display:grid!important;place-items:center!important;width:94px!important;height:144px!important;
      min-width:94px!important;min-height:144px!important;padding:8px!important;
      overflow:hidden!important;background:linear-gradient(145deg,#edf4fa,#dfe9f2)!important;
      border-right:1px solid var(--card-border,#dbe4ee)!important;
    }
    #page-appliances-main .appl-wide-card .appl-visual .appl-ic,
    #page-appliances-main .appl-wide-card .appl-visual .dm-appliance-media,
    #page-appliances-main .appl-wide-card .appl-visual .dm-appliance-art,
    #page-appliances-main .appl-wide-card .appl-visual .dm-appliance-image-wrap{
      display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
      min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;
      padding:0!important;margin:0!important;background:transparent!important;overflow:hidden!important;
    }
    #page-appliances-main .appl-wide-card .appl-visual img,
    #page-appliances-main .appl-wide-card .appl-visual svg,
    #page-appliances-main .appl-wide-card .appl-visual .dm-appliance-image{
      display:block!important;width:82%!important;height:82%!important;min-width:0!important;min-height:0!important;
      max-width:82%!important;max-height:82%!important;object-fit:contain!important;object-position:center!important;
      transform:none!important;filter:none!important;border-radius:0!important;
    }
    #page-appliances-main .appl-wide-card .dm-appliance-glyph{font-size:58px!important;line-height:1!important}
    #page-appliances-main .appl-wide-card .appl-info{min-width:0!important;padding:12px 14px!important}

    /* Report editor: the preview is a real, visible first-class column. */
    #editor-modal .dm-report-row{
      display:grid!important;grid-template-columns:54px minmax(130px,.8fr) minmax(150px,.7fr) minmax(240px,1.25fr) auto!important;
      align-items:end!important;gap:10px 12px!important;padding:14px!important;
      border:1px solid var(--card-border,#dbe4ee)!important;border-radius:20px!important;
      background:linear-gradient(145deg,rgba(248,250,252,.96),rgba(241,245,249,.94))!important;
    }
    #editor-modal .dm-report-icon-preview{
      grid-column:1!important;grid-row:1 / span 3!important;align-self:center!important;
      display:grid!important;place-items:center!important;width:50px!important;height:50px!important;
      min-width:50px!important;min-height:50px!important;border-radius:16px!important;
      background:linear-gradient(145deg,#e0f2fe,#dbeafe)!important;color:#0369a1!important;
      border:1px solid rgba(14,165,233,.14)!important;overflow:hidden!important;
      font-size:29px!important;line-height:1!important;opacity:1!important;
    }
    #editor-modal .dm-report-icon-preview img{display:block!important;width:40px!important;height:40px!important;object-fit:contain!important}
    #editor-modal .dm-report-glyph-0151{display:block!important;font-size:29px!important;line-height:1!important;opacity:1!important;color:#0369a1!important}
    #editor-modal .dm-report-row>label,
    #editor-modal .dm-report-row>.dm-icon-field,
    #editor-modal .dm-report-row>.dm-entity-field{min-width:0!important;margin:0!important}

    .dm-energy-statistics-status-0151{
      display:block;width:max-content;max-width:calc(100% - 24px);margin:14px 12px 0;padding:8px 12px;
      border-radius:999px;font-size:11px;font-weight:800;line-height:1.3;
      background:#fff7ed;color:#c2410c;border:1px solid #fdba74;
    }
    .dm-energy-statistics-status-0151[data-state="loading"]{background:#eff6ff;color:#1d4ed8;border-color:#93c5fd}

    @media(max-width:820px){
      #page-appliances-main .appl-wide-card{grid-template-columns:88px minmax(0,1fr)!important;height:138px!important;min-height:138px!important}
      #page-appliances-main .appl-wide-card .appl-visual{width:88px!important;min-width:88px!important;height:138px!important;min-height:138px!important;padding:7px!important}
      #editor-modal .dm-report-row{grid-template-columns:50px minmax(0,1fr)!important;align-items:start!important}
      #editor-modal .dm-report-icon-preview{grid-column:1!important;grid-row:1 / span 4!important;width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important}
      #editor-modal .dm-report-row>label,
      #editor-modal .dm-report-row>.dm-icon-field,
      #editor-modal .dm-report-row>.dm-entity-field,
      #editor-modal .dm-report-row>.dm-report-actions{grid-column:2!important;width:100%!important}
    }
    @media(max-width:420px){
      #temp-grid .dm-room-icon-0151{width:44px!important;height:44px!important;min-width:44px!important;border-radius:14px!important}
      #page-appliances-main .appl-wide-card{grid-template-columns:82px minmax(0,1fr)!important;height:132px!important;min-height:132px!important;border-radius:19px!important}
      #page-appliances-main .appl-wide-card .appl-visual{width:82px!important;min-width:82px!important;height:132px!important;min-height:132px!important}
    }
  `;
  document.head.append(style);
}

function decorateAll() {
  lockTemperatureEditorToRooms();
  stabilizeTemperatureCards();
  decorateReportRows();
  disableLegacyRestDerivation();
}

function install() {
  if (globalThis[RELEASE_0151_FLAG]?.installed) return;
  globalThis[RELEASE_0151_FLAG] = { installed: true, version: "0.14.11" };
  installStyles();
  installInteractionHooks();
  disableLegacyRestDerivation();

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
    scheduleStatisticsRefresh(100);
  });
  scheduleDecorate();
  scheduleStatisticsRefresh(800);
  setInterval(scheduleStatisticsRefresh, 10 * 60 * 1000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
}
