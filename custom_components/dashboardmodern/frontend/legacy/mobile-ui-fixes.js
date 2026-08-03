/* DashboardModern 0.15.0 — pure compatibility helpers, no DOM observer or timer. */

export function isGeneratedRoomName(value = "") {
  return /^room[-_][a-z0-9]{6,}$/i.test(String(value).trim());
}

export function inferApplianceEntity(device = {}, states = {}, kind = "energy") {
  const candidates = [
    device[`${kind}_entity`],
    device[`${kind}_today`],
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    ...(device.entities || []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  const expected = kind === "power" ? /^(w|kw)$/i : /^(wh|kwh)$/i;
  const named =
    kind === "power"
      ? /power|potenza|watt/i
      : /energy|energia|kwh|consum|total|totale|mese|month/i;
  return (
    candidates.find((entityId) =>
      expected.test(String(states?.[entityId]?.attributes?.unit_of_measurement || "").trim()),
    ) ||
    candidates.find((entityId) => named.test(entityId)) ||
    ""
  );
}

// Compatibility flag: the old document-wide MutationObserver and 150 ms interval
// were intentionally removed in 0.15.0.
globalThis.__DASHBOARDMODERN_MOBILE_FOLLOWUP__ = {
  installed: true,
  version: "0.15.0",
  observer: null,
  timer: 0,
};
