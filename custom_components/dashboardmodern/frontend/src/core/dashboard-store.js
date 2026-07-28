import { cloneValue, SCHEMA_VERSION, normalizeDevice } from "./device-model.js";
import { migrateState, normalizeSection, readLegacyState, SECTION_KEYS } from "./migrations.js";

export const VISIBILITY_SECTION = Object.freeze({
  cameras: "security",
  lights: "home",
  appliances: "appliances",
  loads: "energy",
  climate: "clima",
  ev: "ev",
  energy: "energy",
  covers: "tapparelle",
  pool: "piscina",
  irrigation: "irrigazione",
});

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
    const result = migrateState(source);
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
      if (!store.projecting && (key === "cd_sections" || Object.values(SECTION_KEYS).includes(key)))
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
    if (key === "cd_sections")
      return this.transact(
        "visibility",
        "legacy-reconcile",
        () => (this.state.visibility = { ...value }),
      );
    const section = Object.entries(SECTION_KEYS).find(([, storageKey]) => storageKey === key)?.[0];
    if (!section) return Promise.resolve();
    return this.replaceSection(section, value);
  }
  ensureSectionVisibleForData(section) {
    const key = VISIBILITY_SECTION[section] || section;
    const value = this.state.sections[section];
    const hasData = Array.isArray(value)
      ? value.some((item) => item?.enabled !== false)
      : Boolean(
          value &&
          Object.keys(value).some(
            (name) => name !== "metadata" && Object.keys(value[name] || {}).length,
          ),
        );
    if (hasData && this.state.visibility[key] === false) {
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
  addItem(section, item) {
    return this.transact(section, "add", () => {
      const value = normalizeDevice(item, section, {
        rooms: this.state.sections.rooms || [],
        index: (this.state.sections[section] || []).length,
      });
      (this.state.sections[section] ||= []).push(value);
      return cloneValue(value);
    });
  }
  updateItem(section, id, patch) {
    return this.transact(section, "update", () => {
      const list = this.state.sections[section] || [];
      const index = list.findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`Unknown ${section} item: ${id}`);
      list[index] = normalizeDevice({ ...list[index], ...patch, id }, section, {
        rooms: this.state.sections.rooms || [],
        index,
      });
      return cloneValue(list[index]);
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
    return this.transact(
      section,
      "replace",
      () =>
        (this.state.sections[section] = normalizeSection(section, value, {
          rooms: this.state.sections.rooms || [],
        })),
    );
  }
  sync() {
    return this.syncAdapter(this.getState(), { operation: "sync" });
  }
}
