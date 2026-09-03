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
  /* Le due che il guscio offre davvero nella scheda MiniPC e che qui
   * mancavano: il disco e la temperatura della CPU col suo nome vero. Senza,
   * finivano nella sezione giusta solo per somiglianza del prefisso. */
  "dm.server_disco": "server",
  "dm.server_temperatura_cpu": "server",
  "dm.boiler_temperatura": "boiler",
  "dm.boiler_potenza": "boiler",
  "dm.security_centrale_allarme": "security",
  "dm.security_camera_principale": "security",
  "dm.home_interruttore_antifurto": "security",
});

/* Slots the configuration no longer offers.
 *
 * Both of these were Home rows that asked a second time for something the
 * plancia already knows. The alarm panel slot right above them carries the
 * state of the alarm, and the gate is a quick action like any other, configured
 * where quick actions are configured. Keeping them in the Home form meant two
 * places to map the same thing and two answers when they disagreed.
 *
 * Whatever is already mapped to them keeps working: this list only takes them
 * out of the editor, it never clears a stored override. The vendored runtime
 * tries to hide these same two rows itself, with an inline `display:none` that
 * the current row skin overrides — so the rows are removed here instead.
 */
export const RETIRED_EDITOR_SLOTS = Object.freeze([
  "dm.home_interruttore_antifurto",
  "dm.home_script_apertura_cancello",
]);

const RETIRED = new Set(RETIRED_EDITOR_SLOTS);

export const isRetiredEditorSlot = (slot) => RETIRED.has(String(slot || "").trim());

export function sectionForEditorSlot(slot) {
  if (EDITOR_SLOT_SECTIONS[slot]) return EDITOR_SLOT_SECTIONS[slot];
  // Families are declared once here for installations with additional slots.
  const family = Object.freeze({
    "dm.ev_": "ev",
    "dm.energy_": "energy",
    "dm.server_": "server",
    "dm.boiler_": "boiler",
    "dm.security_": "security",
    /* Le caselle della lavatrice: programma, fase, tempo rimanente, gli
     * script dei programmi rapidi. Sono la scheda di un elettrodomestico, e
     * finche' questa mappa serviva solo ad accendere una sezione la loro
     * assenza non si vedeva. Adesso che una sezione senza contenuto si spegne
     * anche, la loro assenza vorrebbe dire togliere gli Elettrodomestici a chi
     * la lavatrice l'ha mappata di li'. */
    "dm.lavatrice_": "appliances",
  });
  return Object.entries(family).find(([prefix]) => slot.startsWith(prefix))?.[1] || null;
}

export const editorSlotsForSection = (section) =>
  Object.keys(EDITOR_SLOT_SECTIONS).filter((slot) => EDITOR_SLOT_SECTIONS[slot] === section);
