/* Appliance asset persistence compatibility for 0.14.7. */
const APPLIANCE_STORE_FLAG = "__DASHBOARDMODERN_0147_APPLIANCE_STORE__";

function normalizeAssetAliases() {
  const store = globalThis.DashboardModernModules?.store;
  const appliances = store?.state?.sections?.appliances;
  if (!Array.isArray(appliances)) return false;
  let changed = false;
  appliances.forEach((item) => {
    if (item?.visual_type !== "asset" || !item.visual_key) return;
    if (item.image !== "") {
      item.image = "";
      changed = true;
    }
    if (item.image_url !== "") {
      item.image_url = "";
      changed = true;
    }
  });
  if (changed) store.persist?.();
  return true;
}

function installApplianceStoreCompatibility() {
  if (globalThis[APPLIANCE_STORE_FLAG]) return true;
  const store = globalThis.DashboardModernModules?.store;
  const save = globalThis.edApplSave;
  if (!store || typeof save !== "function" || !globalThis.__DASHBOARDMODERN_0147_FIXES__?.patched)
    return false;

  globalThis[APPLIANCE_STORE_FLAG] = true;
  globalThis.edApplSave = async function edApplSave0147AssetCompatibility(...args) {
    const result = await save.apply(this, args);
    normalizeAssetAliases();
    return result;
  };
  store.subscribe?.((change) => {
    if (change?.section === "appliances" && change.status === "optimistic") {
      queueMicrotask(normalizeAssetAliases);
    }
  });
  normalizeAssetAliases();
  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (installApplianceStoreCompatibility() || attempts > 120) window.clearInterval(timer);
  }, 100);
  window.addEventListener("dashboardmodern:legacy-ready", installApplianceStoreCompatibility);
}
