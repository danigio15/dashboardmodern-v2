const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ENERGY_LEGACY_GUARD__";
const FRESH_BUNDLE_MS = 15000;
const BETA27_SUBLOAD_KEY = "__DASHBOARDMODERN_BETA27_SUBLOAD_PRESERVE__";
const BETA27_PICKER_KEY = "__DASHBOARDMODERN_BETA27_PICKER_CONTRACT__";

/**
 * Legacy DashboardModern still calls cdTotalsRun() once after Home Assistant
 * authentication. That compatibility hook resolves to
 * DashboardModernEnergyService.refresh(), but the canonical Energy section has
 * already loaded the same Recorder bundle by then. Suppress only that redundant
 * public refresh while the current bundle is fresh; canonical store/editor and
 * state-change refresh scheduling remains owned by energy-section.js.
 */
export function installEnergyLegacyGuardSection() {
  if (root[KEY]?.installed) return root[KEY];

  const current = root.DashboardModernEnergyService;
  if (!current?.refresh) return false;
  const originalRefresh = current.refresh;

  const guarded = Object.freeze({
    ...current,
    refresh(...args) {
      const runtime = root.__DASHBOARDMODERN_RUNTIME_ROOT__;
      const lastRefreshAt = Number(runtime?.lastRefreshAt) || 0;
      const fresh =
        Boolean(runtime?.bundle) &&
        lastRefreshAt > 0 &&
        Date.now() - lastRefreshAt < FRESH_BUNDLE_MS;
      if (fresh) return false;
      return originalRefresh(...args);
    },
  });

  // DashboardModernEnergyService is an accessor while state-event-gate is
  // armed. Reassignment is intentional: the broker object is unchanged and
  // the gate remains installed, while future legacy lookups receive the guard.
  root.DashboardModernEnergyService = guarded;
  root[KEY] = Object.freeze({ installed: true, freshBundleMs: FRESH_BUNDLE_MS });
  return root[KEY];
}

function cleanSubloadValue(value) {
  return String(value ?? "").trim();
}

function subloadIdentity(item = {}) {
  return [
    cleanSubloadValue(item.id),
    cleanSubloadValue(item.name),
    cleanSubloadValue(item.pwrLive || item.pwr),
    cleanSubloadValue(item.daily),
    cleanSubloadValue(item.monthly),
    cleanSubloadValue(item.total),
  ].join("|");
}

function configuredSubloadIdentities(groupId) {
  try {
    const parsed = JSON.parse(root.localStorage?.getItem?.("cd_subloads_extra") || "{}");
    const items = Array.isArray(parsed?.[groupId]) ? parsed[groupId] : [];
    return new Set(items.map(subloadIdentity));
  } catch (_error) {
    return new Set();
  }
}

/**
 * Beta 27 projects the configurable Energy hierarchy into the legacy popup
 * contract. Keep the baked/previously configured children and append only new
 * custom children, so opening Cucina/Lavanderia never loses existing devices.
 */
export function mergePreservedSubloadItems(baseItems = [], incomingItems = []) {
  const merged = [];
  const seen = new Set();
  for (const item of [
    ...(Array.isArray(baseItems) ? baseItems : []),
    ...(Array.isArray(incomingItems) ? incomingItems : []),
  ]) {
    if (!item || typeof item !== "object") continue;
    const key = subloadIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function beta27SubloadRuntimeConfig() {
  try {
    const value = root.eval?.(
      "typeof SUBLOADS_CONFIG !== 'undefined' ? SUBLOADS_CONFIG : null",
    );
    return value && typeof value === "object" ? value : null;
  } catch (_error) {
    return null;
  }
}

function protectBeta27SubloadGroup(groupId, group, state) {
  if (!group || typeof group !== "object") return false;
  const descriptor = Object.getOwnPropertyDescriptor(group, "items");
  if (descriptor?.get?.__dmBeta27Preserved) return true;
  if (descriptor && !descriptor.configurable) return false;

  const configured = configuredSubloadIdentities(groupId);
  const preserved = Array.isArray(group.items)
    ? group.items.filter((item) => !configured.has(subloadIdentity(item)))
    : [];
  const record = state.groups.get(groupId) || { preserved, current: preserved };
  if (!state.groups.has(groupId)) state.groups.set(groupId, record);

  function getItems() {
    return record.current;
  }
  getItems.__dmBeta27Preserved = true;
  Object.defineProperty(group, "items", {
    configurable: true,
    enumerable: true,
    get: getItems,
    set(value) {
      record.current = mergePreservedSubloadItems(record.preserved, value);
    },
  });
  group.items = preserved;
  return true;
}

export function installBeta27SubloadPreservation() {
  const runtime = beta27SubloadRuntimeConfig();
  if (!runtime) return false;
  const state = (root[BETA27_SUBLOAD_KEY] ||= {
    installed: false,
    groups: new Map(),
  });
  let protectedAny = false;
  for (const [groupId, group] of Object.entries(runtime)) {
    if (!group || typeof group !== "object" || !Array.isArray(group.items)) continue;
    if (protectBeta27SubloadGroup(groupId, group, state)) protectedAny = true;
  }
  state.installed ||= protectedAny;
  return protectedAny;
}

/**
 * Keep every Beta 27 entity field on the same DOM contract used by the shipped
 * entity-picker guard. The hierarchical Loads renderer owns the click handler;
 * this bridge only declares the canonical input/target relationship so the
 * global guard never creates a second lens/dialog and E2E/runtime diagnostics
 * can verify a strict 1:1 picker invariant.
 */
export function reconcileBeta27EntityPickerContract(scope = doc) {
  if (!scope?.querySelectorAll) return 0;
  let count = 0;
  scope
    .querySelectorAll(".dm-beta27-load-editor .dm-entity-picker[data-beta27-entity-target]")
    .forEach((button) => {
      const targetId = cleanSubloadValue(button.dataset.beta27EntityTarget);
      if (!targetId) return;
      const input = doc?.getElementById?.(targetId);
      if (!input) return;
      input.dataset.entityInput = "true";
      button.dataset.entityTarget = targetId;
      count += 1;
    });
  return count;
}

function scheduleBeta27EntityPickerContract() {
  root.queueMicrotask?.(() => reconcileBeta27EntityPickerContract());
}

function installBeta27EditorContractBridge() {
  const state = (root[BETA27_PICKER_KEY] ||= { installed: false, wrapped: new Set() });

  for (const name of ["editorSwitch", "apriConfigEntita"]) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmBeta27PickerContract) continue;
    function beta27PickerContractOwner(...args) {
      const result = current.apply(this, args);
      scheduleBeta27EntityPickerContract();
      return result;
    }
    beta27PickerContractOwner.__dmBeta27PickerContract = true;
    beta27PickerContractOwner.__dmPrevious = current;
    root[name] = beta27PickerContractOwner;
    state.wrapped.add(name);
  }

  if (!state.installed) {
    state.installed = true;
    doc?.addEventListener?.(
      "click",
      (event) => {
        if (
          event.target?.closest?.(
            ".ed-tab,.ed-inner-tab,[data-energy-panel],[data-beta27-child-add],[data-beta27-child-edit]",
          )
        )
          scheduleBeta27EntityPickerContract();
      },
      true,
    );
  }
  scheduleBeta27EntityPickerContract();
  return true;
}

installEnergyLegacyGuardSection();
installBeta27SubloadPreservation();
installBeta27EditorContractBridge();
root.addEventListener?.("dashboardmodern:legacy-ready", () => {
  installBeta27SubloadPreservation();
  installBeta27EditorContractBridge();
});
root.addEventListener?.("dashboardmodern:runtime-ready", () => {
  installBeta27SubloadPreservation();
  installBeta27EditorContractBridge();
});
