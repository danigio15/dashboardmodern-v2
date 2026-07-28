import { SCHEMA_VERSION, normalizeDevice } from "./device-model.js";
import { migrateState, readLegacyState, SECTION_KEYS } from "./migrations.js";

export const VISIBILITY_SECTION = Object.freeze({ cameras: "security", lights: "home", appliances: "appliances", climate: "clima", ev: "ev", energy: "energy", covers: "tapparelle", pool: "piscina", irrigation: "irrigazione" });

export class DashboardStore {
  constructor({ storage = globalThis.localStorage, sync = async () => {}, onStatus = () => {} } = {}) {
    this.storage = storage || { getItem: () => null, setItem: () => {}, removeItem: () => {} }; this.syncAdapter = sync; this.onStatus = onStatus;
    this.listeners = new Set(); this.queue = Promise.resolve();
    this.state = { schema_version: SCHEMA_VERSION, sections: {}, visibility: {} };
  }
  migrate() {
    const saved = this.storage.getItem("dm_dashboard_state");
    const source = saved ? JSON.parse(saved) : readLegacyState(this.storage);
    if (+source.schema_version < SCHEMA_VERSION) this.storage.setItem(`dm_dashboard_backup_v${source.schema_version || 0}`, JSON.stringify(source));
    const result = migrateState(source); this.state = result.state;
    if (result.changes.length) console.info("[DashboardStore] migration", result.changes);
    this.persist(); return result;
  }
  getState() { return structuredClone(this.state); }
  getSection(section) { return structuredClone(this.state.sections[section] || []); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  persist() {
    this.storage.setItem("dm_dashboard_state", JSON.stringify(this.state));
    this.storage.setItem("dm_schema_version", String(SCHEMA_VERSION));
    this.storage.setItem("cd_sections", JSON.stringify(this.state.visibility));
    for (const [section, key] of Object.entries(SECTION_KEYS)) {
      let value = this.state.sections[section] || [];
      if (section === "lights") value = Object.fromEntries(value.map((item) => [item.entities[0], item.name]));
      this.storage.setItem(key, JSON.stringify(value));
    }
  }
  ensureSectionVisibleForData(section) {
    const key = VISIBILITY_SECTION[section] || section;
    if ((this.state.sections[section] || []).some((item) => item?.enabled !== false) && this.state.visibility[key] === false) {
      this.state.visibility[key] = true; return true;
    }
    return false;
  }
  async transact(section, operation, mutate) {
    const before = this.getState(); this.onStatus({ section, operation, status: "loading" });
    try {
      const detail = mutate(); const visibilityChanged = this.ensureSectionVisibleForData(section);
      this.persist(); await this.syncAdapter(this.getState(), { section, operation, detail });
      const change = { section, operation, detail, visibilityChanged, state: this.getState() };
      this.listeners.forEach((listener) => listener(change)); this.onStatus({ ...change, status: "success" }); return detail;
    } catch (error) {
      this.state = before; this.persist(); this.onStatus({ section, operation, status: "error", error });
      console.error(`[DashboardStore] ${operation} ${section} failed; rolled back`, error); throw error;
    }
  }
  addItem(section, item) { return this.transact(section, "add", () => { const value = normalizeDevice(item, section, { rooms: this.state.sections.rooms || [], index: (this.state.sections[section] || []).length }); (this.state.sections[section] ||= []).push(value); return structuredClone(value); }); }
  updateItem(section, id, patch) { return this.transact(section, "update", () => { const list = this.state.sections[section] || []; const index = list.findIndex((item) => item.id === id); if (index < 0) throw new Error(`Unknown ${section} item: ${id}`); list[index] = normalizeDevice({ ...list[index], ...patch, id }, section, { rooms: this.state.sections.rooms || [], index }); return structuredClone(list[index]); }); }
  removeItem(section, id) { return this.transact(section, "remove", () => { const list = this.state.sections[section] || []; const index = list.findIndex((item) => item.id === id); if (index < 0) throw new Error(`Unknown ${section} item: ${id}`); return structuredClone(list.splice(index, 1)[0]); }); }
  replaceSection(section, items) { return this.transact(section, "replace", () => (this.state.sections[section] = items.map((item, index) => normalizeDevice(item, section, { rooms: this.state.sections.rooms || [], index })))); }
  sync() { return this.syncAdapter(this.getState(), { operation: "sync" }); }
}
