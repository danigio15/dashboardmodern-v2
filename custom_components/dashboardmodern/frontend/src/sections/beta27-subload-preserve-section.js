// Beta 27 compatibility bridge: preserve the baked/legacy subload items when
// the hierarchical editor projects custom children into SUBLOADS_CONFIG.
// This module must be imported before beta26-real-device-stability-section.js.

const root = globalThis;
const state = (root.__DASHBOARDMODERN_BETA27_SUBLOAD_PRESERVE__ ||= {
  installed: false,
  groups: new Map(),
});

function clean(value) {
  return String(value ?? "").trim();
}

function itemIdentity(item = {}) {
  return [
    clean(item.id),
    clean(item.name),
    clean(item.pwrLive || item.pwr),
    clean(item.daily),
    clean(item.monthly),
    clean(item.total),
  ].join("|");
}

export function mergePreservedSubloadItems(baseItems = [], incomingItems = []) {
  const merged = [];
  const seen = new Set();
  for (const item of [...(Array.isArray(baseItems) ? baseItems : []), ...(Array.isArray(incomingItems) ? incomingItems : [])]) {
    if (!item || typeof item !== "object") continue;
    const key = itemIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function runtimeConfig() {
  try {
    const value = root.eval?.(
      "typeof SUBLOADS_CONFIG !== 'undefined' ? SUBLOADS_CONFIG : null",
    );
    return value && typeof value === "object" ? value : null;
  } catch (_error) {
    return null;
  }
}

function protectGroup(groupId, group) {
  if (!group || typeof group !== "object") return false;
  const existing = Object.getOwnPropertyDescriptor(group, "items");
  if (existing && !existing.configurable) return false;

  const preserved = Array.isArray(group.items) ? [...group.items] : [];
  const record = state.groups.get(groupId) || { preserved, current: preserved };
  if (!state.groups.has(groupId)) state.groups.set(groupId, record);

  Object.defineProperty(group, "items", {
    configurable: true,
    enumerable: true,
    get() {
      return record.current;
    },
    set(value) {
      record.current = mergePreservedSubloadItems(record.preserved, value);
    },
  });
  group.items = preserved;
  return true;
}

export function installBeta27SubloadPreservation() {
  const runtime = runtimeConfig();
  if (!runtime) return false;
  let protectedAny = false;
  for (const [groupId, group] of Object.entries(runtime)) {
    if (!group || typeof group !== "object" || !Array.isArray(group.items)) continue;
    if (protectGroup(groupId, group)) protectedAny = true;
  }
  state.installed ||= protectedAny;
  return protectedAny;
}

installBeta27SubloadPreservation();

root.addEventListener?.("dashboardmodern:legacy-ready", installBeta27SubloadPreservation);
root.addEventListener?.("dashboardmodern:runtime-ready", installBeta27SubloadPreservation);
