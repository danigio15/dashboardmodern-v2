// DM-FIX-20260816A
/* Automatic appliance cycle tracker.
 *
 * The showcase card shows "ULTIMO CICLO · avvio / durata / consumo / costo"
 * even for appliances whose integration exposes nothing beyond a power
 * sensor. This tracker watches the running/standby/off transitions computed
 * by the view model and reconstructs each cycle locally:
 *
 * - avvio     → timestamp of the off/standby → running transition
 * - durata    → running → off/standby wall time
 * - consumo   → daily-energy delta when a daily sensor exists (reset-safe),
 *               otherwise the trapezoid integral of the power samples
 * - costo     → consumo × tariffa (resolved by the caller)
 *
 * State is persisted in the dashboard's namespaced localStorage only: cycles
 * are per-browser diagnostics, not configuration, so they are deliberately
 * kept out of the sync push. Storage and clock are injected for tests.
 */

const STORAGE_KEY = "dm_appliance_cycles";
const MAX_SAMPLE_GAP_MS = 5 * 60 * 1000;
const MIN_CYCLE_MS = 60 * 1000;
const MIN_CYCLE_KWH = 0.005;

const finiteOrNull = (value) => {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export function createCycleTracker({
  storage = globalThis.localStorage,
  key = STORAGE_KEY,
  now = () => Date.now(),
} = {}) {
  const readAll = () => {
    try {
      const parsed = JSON.parse(storage?.getItem?.(key) || "");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  };

  let records = readAll();

  const persist = () => {
    try {
      const serialized = JSON.stringify(records);
      if (storage?.getItem?.(key) !== serialized) storage?.setItem?.(key, serialized);
    } catch (_error) {}
  };

  /* Un ciclo finisce dove finisce quello che si e' visto.
   *
   * «Certi segnano tante ore in piu'» (#363). La chiusura prendeva l'istante
   * di ADESSO come fine del ciclo. Ma fra l'ultimo campione e adesso puo'
   * esserci un buco — la plancia chiusa, il telefono in tasca, il browser
   * addormentato — e quel buco finiva dentro la durata: una lavatrice da
   * un'ora e mezza diventava di cinque, perche' nessuno ha guardato fino a
   * sera.
   *
   * Dell'apparecchio, in quel buco, non si sa niente. L'unica cosa onesta e'
   * chiudere dove si e' smesso di guardare: oltre il salto massimo, la fine
   * e' l'ultimo campione visto davvero. Sotto il salto — il giro normale — le
   * due cose coincidono e non cambia niente. */
  const finePrudente = (active, timestamp) => {
    const ultimo = finiteOrNull(active?.lastMs);
    if (ultimo == null) return timestamp;
    return timestamp - ultimo > MAX_SAMPLE_GAP_MS ? ultimo : timestamp;
  };

  const closeCycle = (record, timestamp, finalDailyKwh) => {
    const active = record.active;
    delete record.active;
    if (!active) return;
    const fine = finePrudente(active, timestamp);
    const durationMs = fine - active.startMs;
    const startDaily = finiteOrNull(active.startDailyKwh);
    const lastDaily = finiteOrNull(active.lastDailyKwh);
    const endDaily = finiteOrNull(finalDailyKwh);
    // The closing sample usually carries the freshest daily reading: accept it
    // unless it dropped (midnight reset between the last two samples).
    const effectiveDaily =
      endDaily != null && (lastDaily == null || endDaily >= lastDaily) ? endDaily : lastDaily;
    const dailyDelta =
      effectiveDaily != null && startDaily != null ? effectiveDaily - startDaily : null;
    const kwh =
      dailyDelta != null && dailyDelta >= MIN_CYCLE_KWH
        ? dailyDelta
        : finiteOrNull(active.kwhIntegral) >= MIN_CYCLE_KWH
          ? active.kwhIntegral
          : null;
    if (durationMs < MIN_CYCLE_MS && kwh == null) return;
    record.last = {
      startMs: active.startMs,
      endMs: fine,
      durationMinutes: Math.round(durationMs / 60000),
      kwh: kwh != null ? Math.round(kwh * 1000) / 1000 : null,
      totalSeconds: finiteOrNull(active.maxRemainingSeconds),
    };
  };

  return {
    /** Snapshot of every tracked record, keyed by appliance id. */
    records: () => records,
    record: (id) => records[String(id)] || null,
    /**
     * entries: [{ id, mode, watts, dailyKwh, remainingSeconds }]
     * Returns the updated records map.
     */
    update(entries = []) {
      const timestamp = now();
      let changed = false;
      const seen = new Set();
      for (const entry of entries) {
        const id = String(entry?.id || "");
        if (!id) continue;
        seen.add(id);
        const mode = String(entry?.mode || "off");
        const record = (records[id] ||= {});
        const active = record.active;
        if (mode === "running") {
          if (!active) {
            record.active = {
              startMs: timestamp,
              lastMs: timestamp,
              kwhIntegral: 0,
              lastWatts: finiteOrNull(entry.watts) ?? 0,
              startDailyKwh: finiteOrNull(entry.dailyKwh),
              lastDailyKwh: finiteOrNull(entry.dailyKwh),
              maxRemainingSeconds: finiteOrNull(entry.remainingSeconds),
            };
            changed = true;
            continue;
          }
          const gap = timestamp - (finiteOrNull(active.lastMs) ?? timestamp);
          const dt = Math.max(0, Math.min(gap, MAX_SAMPLE_GAP_MS));
          const watts = finiteOrNull(entry.watts);
          if (dt > 0) {
            const previous = finiteOrNull(active.lastWatts) ?? watts ?? 0;
            const current = watts ?? previous ?? 0;
            active.kwhIntegral =
              (finiteOrNull(active.kwhIntegral) ?? 0) +
              (((previous + current) / 2) * (dt / 3600000)) / 1000;
            changed = true;
          }
          active.lastMs = timestamp;
          if (watts != null) active.lastWatts = watts;
          const daily = finiteOrNull(entry.dailyKwh);
          if (daily != null) {
            if (finiteOrNull(active.startDailyKwh) == null) active.startDailyKwh = daily;
            // Midnight reset: the daily sensor dropped → restart the baseline
            // so the delta never goes negative.
            if (daily < (finiteOrNull(active.lastDailyKwh) ?? daily)) {
              active.startDailyKwh = daily - (finiteOrNull(active.kwhIntegral) ?? 0);
            }
            active.lastDailyKwh = daily;
          }
          const remaining = finiteOrNull(entry.remainingSeconds);
          if (remaining != null && remaining > (finiteOrNull(active.maxRemainingSeconds) ?? -1)) {
            active.maxRemainingSeconds = remaining;
          }
          continue;
        }
        if (mode === "unavailable") {
          // Freeze the cycle: no integration across an unavailable gap.
          if (active) {
            active.lastMs = timestamp;
            changed = true;
          }
          continue;
        }
        if (active) {
          closeCycle(record, timestamp, entry.dailyKwh);
          changed = true;
        }
      }
      for (const id of Object.keys(records)) {
        if (!seen.has(id) && records[id]?.active) {
          closeCycle(records[id], timestamp);
          changed = true;
        }
      }
      if (changed) persist();
      return records;
    },
    reset() {
      records = {};
      persist();
    },
  };
}
