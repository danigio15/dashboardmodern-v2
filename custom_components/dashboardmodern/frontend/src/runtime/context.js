export function createCardRuntimeContext({ hass = null, locale = "en-US", theme = "auto", connectionStatus = "unknown", callService = null } = {}) {
  return Object.freeze({ hass, locale, theme, connectionStatus, getEntityState(entityId) { return hass?.states?.[entityId] || null; }, callService(domain, service, data = {}) { if (typeof callService !== "function") return Promise.reject(new Error("No Home Assistant service-call adapter is available.")); return callService(domain, service, data); } });
}
