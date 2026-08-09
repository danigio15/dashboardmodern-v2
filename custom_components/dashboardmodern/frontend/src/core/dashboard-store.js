import { cloneValue, SCHEMA_VERSION, normalizeDevice } from "./device-model.js";
import { migrateState, normalizeSection, readLegacyState, SECTION_KEYS } from "./migrations.js";
import { sectionForEditorSlot } from "./editor-slots.js";
import { projectEnergySlots } from "./energy-projection.js";

export const VISIBILITY_SECTION = Object.freeze({
  rooms: "temp",
  cameras: "security",
  lights: "home",
  appliances: "appliances",
  loads: "energy",
  climate: "clima",
  ev: "ev",
  energy: "energy",
  entityOverrides: "entityOverrides",
  covers: "tapparelle",
  pool: "piscina",
  irrigation: "irrigazione",
});

const configured = (value) =>
  typeof value === "string" ? value.trim().includes(".") : Boolean(value);
const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function hasConfiguredData(section, value) {
  if (section === "rooms" && Array.isArray(value))
    return value.some((room) => configured(room?.temp) || configured(room?.hum));
  if (Array.isArray(value))
    return value.some(
      (item) =>
        item?.enabled !== false &&
        (Boolean(String(item?.name || "").trim()) ||
          Object.entries(item || {}).some(
            ([key, entry]) =>
              /entit|entity|entities|profile/.test(key) &&
              (Array.isArray(entry) ? entry.some(configured) : configured(entry)),
          )),
    );
  if (!value || typeof value !== "object") return false;
  if (section === "irrigation")
    return (
      (value.zones || []).some((zone) => configured(zone?.entity)) ||
      [value.rainEnt, value.weatherEnt].some(configured)
    );
  if (section === "pool")
    return ["tempEnt", "phEnt", "clEnt", "pumpEnt", "heatEnt", "lightEnt"].some((key) =>
      configured(value[key]),
    );
  return Object.entries(value).some(
    ([key, entry]) =>
      key !== "metadata" &&
      (typeof entry === "object"
        ? hasConfiguredData(section, entry)
        : /ent|power|energy|soc|camera|alarm/i.test(key) && configured(entry)),
  );
}

export class DashboardStore {
  constructor({
    storage = globalThis.localStorage,
    sync = async () => {},
    onStatus = () => {},
  } = {}) {
    this.storage = storage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    this.syncAdapter = sync;
    this.onStatus = onStatus;
    this.listeners = new Set();
    this.state = { schema_version: SCHEMA_VERSION, sections: {}, visibility: {} };
  }
  migrate() {
    const saved = this.storage.getItem("dm_dashboard_state");
    const source = saved ? JSON.parse(saved) : readLegacyState(this.storage);
    if (saved && +source.schema_version < 3 && !source.sections?.loads?.length) {
      const legacyLoads = readLegacyState(this.storage).sections.loads;
      source.sections ||= {};
      source.sections.loads = legacyLoads;
    }
    if (+source.schema_version < SCHEMA_VERSION)
      this.storage.setItem(
        `dm_dashboard_backup_v${source.schema_version || 0}`,
        JSON.stringify(source),
      );
    const parse = (key, fallback) => {
      try {
        return JSON.parse(this.storage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    };
    const result = migrateState(source, {
      entityOverrides: parse("cd_entity_overrides", {}),
      subloads: parse("cd_subloads_extra", {}),
      reportDevices: parse("cd_report_devices", []),
      washerImage: parse("cd_lavatrice_visual", ""),
    });
    this.state = result.state;
    if (result.changes.length) console.info("[DashboardStore] migration", result.changes);
    this.persist();
    return result;
  }
  getState() {
    return cloneValue(this.state);
  }
  getSection(section) {
    return cloneValue(this.state.sections[section] ?? []);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  persist() {
    this.state.sections.entityOverrides = projectEnergySlots(
      this.state.sections.energy || {},
      this.state.sections.entityOverrides || {},
    );
    this.projecting = true;
    try {
      this.storage.setItem("dm_dashboard_state", JSON.stringify(this.state));
      this.storage.setItem("dm_schema_version", String(SCHEMA_VERSION));
      this.storage.setItem("cd_sections", JSON.stringify(this.state.visibility));
      for (const [section, key] of Object.entries(SECTION_KEYS)) {
        let value = this.state.sections[section] || [];
        if (section === "lights")
          value = Object.fromEntries(value.map((item) => [item.entities[0], item.name]));
        this.storage.setItem(key, JSON.stringify(value));
      }
    } finally {
      this.projecting = false;
    }
  }
  installLegacyWriteBridge() {
    if (this.storage.__dashboardStoreBridge) return;
    const original = this.storage.setItem.bind(this.storage);
    const store = this;
    this.storage.setItem = function (key, value) {
      const result = original(key, value);
      if (!store.projecting && !globalThis.__DASHBOARDMODERN_PERSIST_RESTORE__ && (key === "cd_sections" || Object.values(SECTION_KEYS).includes(key)))
        queueMicrotask(() => store.reconcileLegacyWrite(key, value));
      return result;
    };
    this.storage.__dashboardStoreBridge = true;
  }
  reconcileLegacyWrite(key, serialized) {
    let value;
    try {
      value = JSON.parse(serialized);
    } catch {
      return Promise.resolve();
    }
    if (key === "cd_sections") {
      if (sameValue(this.state.visibility, value)) return Promise.resolve(cloneValue(value));
      return this.transact(
        "visibility",
        "legacy-reconcile",
        () => (this.state.visibility = { ...value }),
      );
    }
    const section = Object.entries(SECTION_KEYS).find(([, storageKey]) => storageKey === key)?.[0];
    if (!section) return Promise.resolve();
    return this.replaceSection(section, value);
  }
  ensureSectionVisibleForData(section) {
    if (section === "entityOverrides") {
      let changed = false;
      for (const [slot, entity] of Object.entries(this.state.sections.entityOverrides || {})) {
        if (!configured(entity)) continue;
        const mapped = sectionForEditorSlot(slot);
        if (mapped && this.state.visibility[mapped] !== true) {
          this.state.visibility[mapped] = true;
          changed = true;
        }
      }
      return changed;
    }
    const key = VISIBILITY_SECTION[section] || section;
    const value = this.state.sections[section];
    const hasData = hasConfiguredData(section, value);
    if (hasData && this.state.visibility[key] !== true) {
      this.state.visibility[key] = true;
      return true;
    }
    return false;
  }
  async transact(section, operation, mutate) {
    const before = this.getState();
    let visibilityChanged = false;
    this.onStatus({ section, operation, status: "loading" });
    try {
      const detail = mutate();
      visibilityChanged = this.ensureSectionVisibleForData(section);
      this.persist();
      const change = {
        section,
        operation,
        detail: cloneValue(detail),
        visibilityChanged,
        state: this.getState(),
        status: "optimistic",
      };
      this.listeners.forEach((listener) => listener(change));
      await this.syncAdapter(this.getState(), { section, operation, detail });
      const success = { ...change, status: "success", state: this.getState() };
      this.listeners.forEach((listener) => listener(success));
      this.onStatus(success);
      return detail;
    } catch (error) {
      this.state = before;
      this.persist();
      const rollback = {
        section,
        operation,
        status: "rollback",
        error,
        visibilityChanged,
        state: this.getState(),
      };
      this.listeners.forEach((listener) => listener(rollback));
      this.onStatus({ ...rollback, status: "error" });
      console.error(`[DashboardStore] ${operation} ${section} failed; rolled back`, error);
      throw error;
    }
  }
  _normalizeItem(section, item, index) {
    if (section === "rooms")
      return normalizeSection("rooms", [item], {
        rooms: this.state.sections.rooms || [],
      })[0];
    return normalizeDevice(item, section, {
      rooms: this.state.sections.rooms || [],
      index,
    });
  }
  addItem(section, item) {
    return this.transact(section, "add", () => {
      const value = this._normalizeItem(section, item, (this.state.sections[section] || []).length);
      (this.state.sections[section] ||= []).push(value);
      return cloneValue(value);
    });
  }
  updateItem(section, id, patch) {
    const list = this.state.sections[section] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return Promise.reject(new Error(`Unknown ${section} item: ${id}`));
    const next = this._normalizeItem(section, { ...list[index], ...patch, id }, index);
    if (sameValue(list[index], next)) return Promise.resolve(cloneValue(next));
    return this.transact(section, "update", () => {
      list[index] = next;
      return cloneValue(next);
    });
  }
  removeItem(section, id) {
    return this.transact(section, "remove", () => {
      const list = this.state.sections[section] || [];
      const index = list.findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`Unknown ${section} item: ${id}`);
      return cloneValue(list.splice(index, 1)[0]);
    });
  }
  replaceSection(section, value) {
    const normalized = normalizeSection(section, value, {
      rooms: this.state.sections.rooms || [],
    });
    if (sameValue(this.state.sections[section] ?? [], normalized)) {
      return Promise.resolve(cloneValue(normalized));
    }
    return this.transact(
      section,
      "replace",
      () => (this.state.sections[section] = normalized),
    );
  }
  saveReport(items) {
    return this.transact("report", "save", () => {
      const bySection = {
        appliances: this.state.sections.appliances || [],
        loads: this.state.sections.loads || [],
      };
      const wantedManual = new Set(
        items.filter((item) => item.category === "manual-report").map((item) => item.id),
      );
      bySection.loads = bySection.loads.filter(
        (item) => item.category !== "manual-report" || wantedManual.has(item.id),
      );
      for (const draft of items) {
        const section = draft.category === "manual-report" ? "loads" : draft.section;
        const list = bySection[section];
        const index = list.findIndex((item) => item.id === draft.id);
        const existing = index >= 0 ? list[index] : {};
        const patch = {
          ...draft,
          report_order: Number(draft.report_order) || 0,
          show_in_dashboard:
            draft.category === "manual-report" ? false : existing.show_in_dashboard !== false,
        };
        if (index < 0)
          list.push(
            normalizeDevice(patch, section, {
              rooms: this.state.sections.rooms || [],
              index: list.length,
            }),
          );
        else
          list[index] = normalizeDevice({ ...list[index], ...patch }, section, {
            rooms: this.state.sections.rooms || [],
            index,
          });
      }
      this.state.sections.appliances = bySection.appliances;
      this.state.sections.loads = bySection.loads;
      return cloneValue(items);
    });
  }
  applySnapshot(serialized) {
    const input = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    const result = migrateState(input);
    this.state = result.state;
    this.persist();
    const change = {
      section: "snapshot",
      operation: "sync-apply",
      status: "optimistic",
      state: this.getState(),
    };
    this.listeners.forEach((listener) => listener(change));
    return this.getState();
  }
  sync() {
    return this.syncAdapter(this.getState(), { operation: "sync" });
  }
}
