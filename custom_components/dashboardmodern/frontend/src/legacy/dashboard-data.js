/** Compatibility adapters for the canonical model used by both vendored dashboards. */
import { getDeviceDisplayName, getDeviceVisual } from "../core/device-model.js";
import { createApplianceViewModel } from "../core/appliance-view-model.js";
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

export function isConfiguredRoom(room) {
  const name = String(room?.name || "").trim();
  if (!name || /^(other|altro|generic|generico|undefined)$/i.test(name)) return false;
  return !/^room[_-][a-z0-9]{5,}$/i.test(name);
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

export function entityLabel(entityId = "") {
  const objectId = String(entityId).split(".").pop() || "";
  return objectId
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function applianceName(appliance = {}, states = {}, fallback = "Appliance") {
  const name = getDeviceDisplayName(
    appliance,
    states,
    fallback === "Elettrodomestico" ? "it" : "en",
  );
  return /^(Device|Dispositivo)$/.test(name) ? fallback : name;
}

export function applianceMedia(appliance = {}) {
  if (appliance.visual_type && appliance.visual_key)
    return { kind: appliance.visual_type, value: appliance.visual_key };
  return getDeviceVisual({ section: "appliances", ...appliance });
}

export function applianceEnergyReport(appliances = [], states = {}, rooms = []) {
  const normalizedRooms = normalizeRooms(rooms);
  return appliances.map((appliance) => {
    const view = createApplianceViewModel(appliance, states, normalizedRooms);
    const entries = [
      appliance.power,
      appliance.power_entity,
      appliance.energy,
      appliance.energy_today,
    ]
      .concat(appliance.entities || [])
      .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
      .filter(Boolean);
    let power = null;
    let energy = null;
    for (const entity of entries) {
      const state = states[entity];
      const value = Number(state?.state);
      const unit = String(state?.attributes?.unit_of_measurement || "").toLowerCase();
      if (!Number.isFinite(value)) continue;
      if (unit === "w" || unit === "kw")
        power = { entity, value: unit === "kw" ? value * 1000 : value, unit: "W" };
      if (unit === "wh" || unit === "kwh")
        energy = { entity, value: unit === "wh" ? value / 1000 : value, unit: "kWh" };
    }
    const roomId = applianceRoomId(appliance, normalizedRooms);
    return {
      appliance,
      name: view.name,
      room: view.room || normalizedRooms.find((room) => room.id === roomId) || null,
      power,
      energy,
      state: { state: view.mode, watts: view.watts, label: view.label },
      badge: view.badge,
      action: view.action,
      historyEntity: view.historyEntity,
    };
  });
}

function applianceEntities(appliance, keys = []) {
  return [
    ...keys.map((key) => appliance?.[key]),
    ...(Array.isArray(appliance?.entities) ? appliance.entities : []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
    .filter(Boolean);
}

export function controllableEntity(appliance) {
  const candidates = applianceEntities(appliance, [
    "control_entity",
    "switch_entity",
    "switch",
    "light",
    "fan",
  ]);
  return (
    candidates.find((entity) => /^(switch|light|input_boolean|fan)\.[a-z0-9_]+$/i.test(entity)) ||
    ""
  );
}

export function applianceState(appliance, states = {}) {
  const model = createApplianceViewModel(appliance, states);
  return { state: model.mode, watts: model.watts };
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
