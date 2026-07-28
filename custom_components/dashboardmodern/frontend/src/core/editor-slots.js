import { ENERGY_SLOT_MAP } from "./energy-projection.js";

/** Canonical editor slot ownership. Rendering, persistence and visibility share this map. */
export const EDITOR_SLOT_SECTIONS = Object.freeze({
  "dm.ev_batteria_auto": "ev",
  "dm.ev_soc": "ev",
  "dm.ev_charge_power": "ev",
  ...Object.fromEntries(Object.values(ENERGY_SLOT_MAP).map((slot) => [slot, "energy"])),
  "dm.server_cpu": "server",
  "dm.server_ram": "server",
  "dm.server_temperature": "server",
  "dm.boiler_temperatura": "boiler",
  "dm.boiler_potenza": "boiler",
  "dm.security_centrale_allarme": "security",
  "dm.security_camera_principale": "security",
  "dm.home_interruttore_antifurto": "security",
});

export function sectionForEditorSlot(slot) {
  if (EDITOR_SLOT_SECTIONS[slot]) return EDITOR_SLOT_SECTIONS[slot];
  // Families are declared once here for installations with additional slots.
  const family = Object.freeze({
    "dm.ev_": "ev",
    "dm.energy_": "energy",
    "dm.server_": "server",
    "dm.boiler_": "boiler",
    "dm.security_": "security",
  });
  return Object.entries(family).find(([prefix]) => slot.startsWith(prefix))?.[1] || null;
}

export const editorSlotsForSection = (section) =>
  Object.keys(EDITOR_SLOT_SECTIONS).filter((slot) => EDITOR_SLOT_SECTIONS[slot] === section);
