// DM-FIX-20260812B
import { cloneValue, SCHEMA_VERSION, normalizeDevice } from "./device-model.js";

/* Frozen so a shared read-only copy cannot be edited by mistake: a caller that
 * changed one would otherwise change what every other reader sees, without
 * changing anything in the store. */
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}
import { migrateState, normalizeSection, readLegacyState, SECTION_KEYS } from "./migrations.js";
import { sectionForEditorSlot } from "./editor-slots.js";
import { projectEnergySlots } from "./energy-projection.js";
import { applySignedSources } from "./signed-energy.js";

export const VISIBILITY_SECTION = Object.freeze({
  rooms: "temp",
  cameras: "security",
  lights: "home",
  appliances: "appliances",
  loads: "energy",
  climate: "clima",
  ev: "ev",
  energy: "energy",
  energyLoads: "energy",
  entityOverrides: "entityOverrides",
  covers: "tapparelle",
  pool: "piscina",
  irrigation: "irrigazione",
  robots: "robot",
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

/* The legacy shape of the lights section: `{ "light.salone": "Salone" }`.
 *
 * Two things used to go wrong here. A section that is not an array — an older
 * document, or a half-written one — threw on `.map`, and because this runs
 * inside `persist()` the exception took the whole bootstrap with it: the
 * dashboard came back blank. And a light with no entity produced the key
 * `"undefined"`, which the runtime then showed as a nameless quick action that
 * no editor could delete, because there was no entity behind it to delete.
 *
 * A light is a light when it has an entity. Anything else is dropped here
 * rather than written back into the legacy document. */
export function legacyLights(value) {
  const entries = Array.isArray(value) ? value : Object.values(value || {});
  const lights = {};
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const entity = String(item.entity || item.entities?.[0] || "").trim();
    if (!entity || !entity.includes(".")) continue;
    lights[entity] = String(item.name || "").trim() || entity;
  }
  return lights;
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
    this.persistedLegacyDigests = new Map();
    this.state = { schema_version: SCHEMA_VERSION, sections: {}, visibility: {} };
    this.revision = 0;
    this.snapshots = new Map();
  }

  /* A read-only view of a section, built once per revision.
   *
   * `getSection` hands out a deep copy so nobody can reach into the store by
   * accident, and the sections ask for one constantly — every renderer, several
   * times per pass, a few passes a second. On an idle dashboard that was the
   * single most repeated piece of work in the page, copying the same unchanged
   * lists over and over. This copies once and freezes the result, so the copy
   * can be shared: a caller that means to change something still goes through
   * `getSection` and the setters. */
  peekSection(name) {
    const cached = this.snapshots.get(name);
    if (cached && cached.revision === this.revision) return cached.value;
    const value = deepFreeze(cloneValue(this.state.sections[name] ?? []));
    this.snapshots.set(name, { revision: this.revision, value });
    return value;
  }

  touch() {
    this.revision += 1;
    if (this.snapshots.size) this.snapshots.clear();
  }
  /* Forget the configuration held in memory.
   *
   * The reset clears storage, but this object keeps a complete copy of the
   * plancia in `this.state`, and every legacy write that follows projects that
   * copy straight back onto disk. That is how a reset used to come back with
   * half a configuration — a quick action with nothing behind it, a light with
   * no entity — in the seconds before the dashboard restarted. */
  reset() {
    this.state = { schema_version: SCHEMA_VERSION, sections: {}, visibility: {} };
    this.persistedLegacyDigests.clear();
    return this.state;
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
    /* All'avvio la lista delle auto la detta `cd_ev_cars`, non la copia.
     *
     * Il documento canonico e' una fotografia scritta dall'ultimo `persist`, e
     * puo' restare indietro di un giro: chi salva le foto dell'auto e ricarica
     * subito — il messaggio in plancia dice proprio "ricarica per applicare" —
     * chiude la pagina fra la scrittura di `cd_ev_cars` e quella della copia.
     * Alla riapertura questa riga ricostruiva lo stato DALLA COPIA e il
     * `persist` qui sotto la riscriveva sopra `cd_ev_cars`: le foto appena
     * scelte sparivano, e tornavano le vecchie. E' la stessa riconciliazione
     * che il ripristino della configurazione condivisa gia' fa; qui vale per
     * ogni avvio. Le auto cancellate restano cancellate per la stessa strada:
     * una lista vuota ma presente e' una scelta, non un'assenza. */
    try {
      const raw = this.storage.getItem("cd_ev_cars");
      if (raw !== null && raw !== undefined) {
        const legacyCars = JSON.parse(raw);
        if (Array.isArray(legacyCars)) this.state.sections.ev = normalizeSection("ev", legacyCars);
      }
    } catch {
      /* Una lista illeggibile non insegna niente: resta la copia. */
    }
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
    this.touch();
    const legacyKeys = ["cd_sections", ...Object.values(SECTION_KEYS)];
    for (const key of legacyKeys) {
      if (this.canonicalWriteKeys?.has(key)) continue;
      if (!this.persistedLegacyDigests.has(key)) continue;
      const current = this.storage.getItem(key);
      if (current === this.persistedLegacyDigests.get(key)) continue;
      let value;
      try {
        value = JSON.parse(current);
      } catch {
        continue;
      }
      if (key === "cd_sections") {
        if (value && typeof value === "object" && !Array.isArray(value))
          this.state.visibility = { ...value };
        continue;
      }
      const section = Object.entries(SECTION_KEYS).find(
        ([, storageKey]) => storageKey === key,
      )?.[0];
      if (section)
        this.state.sections[section] = normalizeSection(section, value, {
          rooms: this.state.sections.rooms || [],
        });
    }
    /* Le sorgenti uniche con segno si risolvono qui, prima della proiezione:
     * da questo punto in giu' i due versi hanno un riferimento ciascuno come
     * se l'utente avesse configurato due sensori separati. */
    this.state.sections.entityOverrides = projectEnergySlots(
      applySignedSources(this.state.sections.energy || {}),
      this.state.sections.entityOverrides || {},
    );
    this.projecting = true;
    this.storage.__dashboardStoreProjecting = (this.storage.__dashboardStoreProjecting || 0) + 1;
    try {
      this.storage.setItem("dm_dashboard_state", JSON.stringify(this.state));
      this.storage.setItem("dm_schema_version", String(SCHEMA_VERSION));
      const writeLegacy = (key, value) => {
        const serialized = JSON.stringify(value);
        this.storage.setItem(key, serialized);
        this.persistedLegacyDigests.set(key, serialized);
      };
      writeLegacy("cd_sections", this.state.visibility);
      for (const [section, key] of Object.entries(SECTION_KEYS)) {
        let value = this.state.sections[section] || [];
        if (section === "lights") value = legacyLights(value);
        writeLegacy(key, value);
      }
    } finally {
      this.storage.__dashboardStoreProjecting--;
      this.projecting = false;
    }
  }
  installLegacyWriteBridge() {
    if (this.storage.__dashboardStoreBridge) return;
    const original = this.storage.setItem.bind(this.storage);
    const store = this;
    this.storage.setItem = function (key, value) {
      const result = original(key, value);
      if (
        !store.projecting &&
        !store.storage.__dashboardStoreProjecting &&
        !globalThis.__DASHBOARDMODERN_PERSIST_RESTORE__ &&
        (key === "cd_sections" || Object.values(SECTION_KEYS).includes(key))
      )
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
  /* Le sezioni su cui la persona si e' espressa di persona.
   *
   * Nella mappa delle visibilita' un `false` puo' voler dire due cose opposte:
   * "non l'ho ancora configurata", che ci scrive la procedura iniziale, oppure
   * "non la voglio vedere", che ci scrive chi preme il pulsante. Questa e'
   * l'unica cosa che le distingue, e senza di essa una sezione nascosta a mano
   * tornava accesa alla prima entita' mappata. */
  manualVisibility() {
    try {
      const raw = this.storage?.getItem?.("cd_sections_manual");
      if (!raw) return {};
      const value = JSON.parse(raw);
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (_error) {
      return {};
    }
  }
  ensureSectionVisibleForData(section) {
    const manual = this.manualVisibility();
    const shouldShow = (key) =>
      Boolean(key) && manual[key] !== true && this.state.visibility[key] !== true;
    if (section === "entityOverrides") {
      let changed = false;
      for (const [slot, entity] of Object.entries(this.state.sections.entityOverrides || {})) {
        if (!configured(entity)) continue;
        const mapped = sectionForEditorSlot(slot);
        if (shouldShow(mapped)) {
          this.state.visibility[mapped] = true;
          changed = true;
        }
      }
      return changed;
    }
    const key = VISIBILITY_SECTION[section] || section;
    const value = this.state.sections[section];
    if (hasConfiguredData(section, value) && shouldShow(key)) {
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
      this.canonicalWriteKeys = new Set(
        [
          section === "visibility" ? "cd_sections" : SECTION_KEYS[section],
          ...(visibilityChanged ? ["cd_sections"] : []),
        ].filter(Boolean),
      );
      try {
        this.persist();
      } finally {
        this.canonicalWriteKeys = null;
      }
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
    return this.transact(section, "replace", () => (this.state.sections[section] = normalized));
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
