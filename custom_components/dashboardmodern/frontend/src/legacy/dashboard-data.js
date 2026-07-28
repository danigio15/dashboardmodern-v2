/** Canonical data model shared by the vendored Italian and English dashboards. */
export function stableRoomId(room, index = 0) {
  if (room?.id || room?.room_id) return String(room.id || room.room_id);
  const slug = String(room?.name || `room-${index + 1}`)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `room-${slug || index + 1}`;
}

export function normalizeRooms(input = []) {
  const used = new Set();
  return (Array.isArray(input) ? input : []).filter(Boolean).map((room, index) => {
    let id = stableRoomId(room, index);
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return { ...room, id };
  });
}

export function applianceRoomId(appliance, rooms) {
  const explicit = appliance?.room_id || appliance?.roomId;
  if (explicit && rooms.some((room) => room.id === String(explicit))) return String(explicit);
  const legacy = String(appliance?.room || "");
  return rooms.find((room) => room.name === legacy)?.id || "";
}

export function applianceGroups(appliances = [], roomInput = []) {
  const rooms = normalizeRooms(roomInput);
  const groups = rooms
    .map((room) => ({
      room,
      appliances: appliances.filter((item) => applianceRoomId(item, rooms) === room.id),
    }))
    .filter((group) => group.appliances.length);
  const unassigned = appliances.filter((item) => !applianceRoomId(item, rooms));
  return { rooms, all: appliances.slice(), groups, unassigned };
}

export function controllableEntity(appliance) {
  const candidates = [appliance?.switch_entity, appliance?.switch, appliance?.light]
    .concat(appliance?.entities || [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
    .filter(Boolean);
  return (
    candidates.find((entity) => /^(switch|light|input_boolean|fan)\.[a-z0-9_]+$/i.test(entity)) ||
    ""
  );
}

export function applianceState(appliance, states = {}) {
  const entities = [appliance?.power, appliance?.power_entity]
    .concat(appliance?.entities || [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
    .filter(Boolean);
  let watts = null;
  let powered = false;
  for (const entity of entities) {
    const state = states[entity];
    if (!state) continue;
    const unit = String(state.attributes?.unit_of_measurement || "").toLowerCase();
    const value = Number(state.state);
    if (Number.isFinite(value) && /^(w|kw|watt|watts)$/.test(unit)) {
      const normalized = unit === "kw" ? value * 1000 : value;
      watts = Math.max(watts ?? 0, normalized);
    }
    if (["on", "playing", "heat", "cool", "open"].includes(String(state.state).toLowerCase())) {
      powered = true;
    }
  }
  const run = Number.isFinite(Number(appliance?.threshold_run))
    ? Number(appliance.threshold_run)
    : 5;
  const standby = Number.isFinite(Number(appliance?.threshold_standby))
    ? Number(appliance.threshold_standby)
    : 1;
  if (watts != null && watts >= run) return { state: "running", watts };
  if (powered || (watts != null && watts >= standby)) return { state: "on", watts };
  return { state: "off", watts };
}

export function normalizeCamera(camera = {}, index = 0) {
  const entity = String(camera.entity || camera.camera_entity || camera.cam || "").trim();
  const stream = String(camera.stream || camera.stream_url || camera.url || "").trim();
  return {
    ...camera,
    id: String(camera.id || `camera-${index + 1}`),
    name: String(camera.name || entity || `camera-${index + 1}`),
    entity,
    stream,
    room_id: String(camera.room_id || camera.roomId || ""),
  };
}

export function normalizeCameras(input = []) {
  return (Array.isArray(input) ? input : []).map(normalizeCamera);
}

export function saveCamera(input, camera, editIndex = null) {
  const cameras = normalizeCameras(input);
  const normalized = normalizeCamera(camera, editIndex ?? cameras.length);
  if (editIndex == null) cameras.push(normalized);
  else if (editIndex >= 0 && editIndex < cameras.length)
    cameras[editIndex] = { ...normalized, id: camera.id || cameras[editIndex].id };
  return cameras;
}

export function removeCamera(input, index) {
  return normalizeCameras(input).filter((_camera, cameraIndex) => cameraIndex !== index);
}
