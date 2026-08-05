/* Pure compatibility utilities. Production startup belongs to report-mobile-fixes.js. */

const clean = (value) => String(value ?? "").trim();

export function inferApplianceEntity(device = {}, states = {}, kind = "energy") {
  const candidates = [
    device[`${kind}_entity`],
    device[`${kind}_today`],
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    ...(device.entities || []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity || entry?.entity_id))
    .map(clean)
    .filter(Boolean);
  const expected = kind === "power" ? /^(w|kw)$/i : /^(wh|kwh|mwh)$/i;
  const named =
    kind === "power"
      ? /power|potenza|watt/i
      : /energy|energia|kwh|consum|total|totale|mese|month/i;
  return (
    candidates.find((entityId) =>
      expected.test(clean(states?.[entityId]?.attributes?.unit_of_measurement)),
    ) ||
    candidates.find((entityId) => named.test(entityId)) ||
    ""
  );
}

export function isGeneratedRoomName(value = "") {
  return /^room[-_][a-z0-9]{6,}$/i.test(clean(value));
}

export function normalizeVehiclePath(value = "") {
  let path = clean(value).replaceAll("\\", "/");
  if (path.startsWith("/loca/")) path = `/local/${path.slice(6)}`;
  else if (path.startsWith("loca/")) path = `/local/${path.slice(5)}`;
  else if (path.startsWith("/config/www/")) path = `/local/${path.slice(12)}`;
  else if (path.startsWith("config/www/")) path = `/local/${path.slice(11)}`;
  else if (path.startsWith("www/")) path = `/local/${path.slice(4)}`;
  else if (path.startsWith("local/")) path = `/${path}`;
  return path.replace(/^\/local\/\/+/, "/local/");
}
