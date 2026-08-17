// DM-FIX-20260817B
/* One config for the Energy loads, shaped like the stage it draws.
 *
 * What it replaces: a load used to be described in two places that did not
 * line up. Five fixed "circles under Home" lived in `cd_flow_nodes` with a
 * name, an icon, a colour and a dropdown pointing at a group; the groups and
 * their appliances lived in `cd_subload_groups` and `cd_subloads_extra`; and
 * the canonical `loads` section held a third copy of the child entities. The
 * circle and the group it showed were only linked by that dropdown, so the two
 * halves could — and did — drift apart.
 *
 * Now the stage is drawn from the loads themselves, so the config is the same
 * single list: an ordered set of loads, each one a circle under Home, each one
 * carrying its own appliances. There is no separate circle to bind, and no
 * dropdown to get wrong.
 *
 * The canonical `loads` section stays the only source of truth. The three
 * legacy keys are still written, as a derived mirror, because the hosted
 * subload popup reads them directly; nothing reads them back into the model.
 *
 * Pure: no DOM, no storage. The section around it does the reading, writing
 * and rendering.
 */

export const MAX_FLOW_LOADS = 8;
export const MAX_SUBLOADS = 12;

/* Loads that came from the old five fixed circles keep their group id, so the
 * appliances already stored under "cucina" or "lavanderia" stay where they
 * are. Everything created from now on groups under its own load id. */
const LEGACY_SLOT_KEYS = Object.freeze(["boiler", "wb", "clima", "lav", "cuc"]);

const PALETTE = Object.freeze([
  "#ea580c",
  "#06b6d4",
  "#0ea5e9",
  "#7c3aed",
  "#e11d48",
  "#16a34a",
  "#f59e0b",
  "#6366f1",
]);

const clean = (value) => String(value ?? "").trim();
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const array = (value) => (Array.isArray(value) ? value : []);

function slug(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueId(base, used) {
  const seed = clean(base) || "carico";
  let id = seed;
  let counter = 2;
  while (used.has(id)) id = `${seed}-${counter++}`;
  used.add(id);
  return id;
}

/* A load's group id: the popup key its appliances are stored under. */
export function loadGroupId(load = {}) {
  return clean(load?.metadata?.beta27_subload_group) || clean(load.id);
}

function subloadOf(parentId) {
  return (item) => clean(item?.metadata?.beta27_subload_group) === clean(parentId);
}

function normalizeChild(child = {}, index = 0) {
  return {
    id: clean(child.id) || `${slug(child.name) || "sottocarico"}-${index + 1}`,
    name: clean(child.name) || `Carico ${index + 1}`,
    icon: clean(child.icon) || "🔌",
    // Appliances arrive either as canonical loads (`power_entity`) or as legacy
    // popup rows (`pwr`/`pwrLive`); one shape comes out.
    power: clean(child.power ?? child.pwrLive ?? child.pwr ?? child.power_entity),
    state: clean(child.state ?? child.bin ?? child.control_entity),
    daily: clean(child.daily ?? child.daily_energy_entity),
    monthly: clean(child.monthly ?? child.monthly_energy_entity),
    total: clean(child.total ?? child.total_energy_entity),
  };
}

/* The saved circle customization for the load that used to sit in slot N.
 * Only values the user actually stored count: the normalized editor model
 * filled every field with a legacy default, and adopting those would rename a
 * load the user had already named. */
function slotOverride(flowNodes, index) {
  const key = LEGACY_SLOT_KEYS[index];
  if (!key || !isPlainObject(flowNodes)) return null;
  const saved = flowNodes[key];
  return isPlainObject(saved) ? saved : null;
}

function eligible(load) {
  return (
    load &&
    load.category !== "manual-report" &&
    !clean(load?.metadata?.beta27_subload_group) &&
    (clean(load.name) ||
      clean(load.power_entity) ||
      clean(load.daily_energy_entity) ||
      clean(load.monthly_energy_entity) ||
      clean(load.total_energy_entity) ||
      clean(load.history_entity))
  );
}

/* The whole Loads config, in the order the bubbles appear under Home.
 *
 * `loads` is the canonical section; the other three are the legacy keys, read
 * once so an existing configuration lands in the new shape without the user
 * retyping it. */
export function loadsConfigModel({
  loads = [],
  flowNodes = null,
  groups = [],
  subloads = null,
} = {}) {
  const all = array(loads);
  const parents = all
    .filter(eligible)
    .slice()
    .sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0))
    .slice(0, MAX_FLOW_LOADS);

  const groupById = new Map(
    array(groups)
      .filter(isPlainObject)
      .map((group) => [clean(group.id), group]),
  );
  const extras = isPlainObject(subloads) ? subloads : {};
  const used = new Set();

  return parents.map((load, index) => {
    const override = slotOverride(flowNodes, index);
    const id = uniqueId(clean(load.id) || slug(load.name) || `carico-${index + 1}`, used);
    const group = loadGroupId({ ...load, id });
    const groupMeta = groupById.get(group);
    // Appliances live in the canonical section; the legacy extras are only
    // consulted for the ones a previous release never mirrored across.
    const canonical = all.filter(subloadOf(group)).map(normalizeChild);
    const known = new Set(canonical.map((child) => child.id));
    const legacy = array(extras[group])
      .map(normalizeChild)
      .filter((child) => !known.has(child.id));

    return {
      id,
      order: index,
      name:
        clean(override?.name) ||
        clean(load.name) ||
        clean(groupMeta?.name) ||
        `Carico ${index + 1}`,
      icon:
        clean(override?.icon) ||
        clean(load.emoji_icon || load.icon) ||
        clean(groupMeta?.icon) ||
        "🔌",
      // `color` is not part of the canonical device schema, so the persisted
      // copy lives in metadata; the plain field is still read for a load that
      // never went through a save.
      color:
        clean(override?.color) ||
        clean(load.color) ||
        clean(load.metadata?.flow_color) ||
        clean(groupMeta?.color) ||
        PALETTE[index % PALETTE.length],
      visible: override?.enabled === false ? false : load.show_in_dashboard !== false,
      group,
      power: clean(override?.pwr) || clean(load.power_entity),
      total: clean(load.total_energy_entity || load.history_entity),
      daily: clean(load.daily_energy_entity),
      monthly: clean(load.monthly_energy_entity),
      children: [...canonical, ...legacy].slice(0, MAX_SUBLOADS),
    };
  });
}

export function emptyLoad(model = [], locale = "it") {
  const index = model.length;
  const used = new Set(model.map((item) => clean(item.id)));
  const id = uniqueId(`carico-${index + 1}`, used);
  return {
    id,
    order: index,
    name: locale === "en" ? `Load ${index + 1}` : `Carico ${index + 1}`,
    icon: "🔌",
    color: PALETTE[index % PALETTE.length],
    visible: true,
    group: id,
    power: "",
    total: "",
    daily: "",
    monthly: "",
    children: [],
  };
}

export function emptySubload(load = {}, locale = "it") {
  const index = array(load.children).length;
  const used = new Set(array(load.children).map((child) => clean(child.id)));
  return {
    id: uniqueId(`${clean(load.id) || "carico"}-sub-${index + 1}`, used),
    name: locale === "en" ? `Load ${index + 1}` : `Carico ${index + 1}`,
    icon: "🔌",
    power: "",
    state: "",
    daily: "",
    monthly: "",
    total: "",
  };
}

export function moveLoad(model = [], id, delta) {
  const values = array(model).slice();
  const from = values.findIndex((item) => clean(item.id) === clean(id));
  const to = from + Number(delta || 0);
  if (from < 0 || to < 0 || to >= values.length) return values;
  const [moved] = values.splice(from, 1);
  values.splice(to, 0, moved);
  return values.map((item, index) => ({ ...item, order: index }));
}

/* What to persist. The canonical section carries the loads and their
 * appliances; the three legacy objects are a one-way mirror so the hosted
 * subload popup keeps opening on configuration it can already read.
 *
 * `previous` is the section as stored: fields this editor does not manage —
 * report options, thresholds, per-device pricing — are carried over untouched
 * rather than dropped on save. */
export function loadsConfigToSections(model = [], previous = []) {
  const before = new Map(array(previous).map((item) => [clean(item.id), item]));
  const loads = [];
  const groups = [];
  const subloads = {};
  const flowNodes = {};

  array(model)
    .slice(0, MAX_FLOW_LOADS)
    .forEach((load, index) => {
      const id = clean(load.id) || `carico-${index + 1}`;
      const group = clean(load.group) || id;
      const kept = before.get(id) || {};
      loads.push({
        ...kept,
        id,
        name: clean(load.name) || `Carico ${index + 1}`,
        icon: clean(load.icon) || "🔌",
        color: clean(load.color) || PALETTE[index % PALETTE.length],
        order: index,
        show_in_dashboard: load.visible !== false,
        power_entity: clean(load.power),
        total_energy_entity: clean(load.total),
        history_entity: clean(load.total),
        daily_energy_entity: clean(load.daily),
        monthly_energy_entity: clean(load.monthly),
        metadata: {
          ...(kept.metadata || {}),
          beta27_subload_group: "",
          flow_color: clean(load.color) || PALETTE[index % PALETTE.length],
        },
      });

      groups.push({
        id: group,
        name: clean(load.name),
        icon: clean(load.icon) || "🔌",
        color: clean(load.color),
      });

      const children = array(load.children).slice(0, MAX_SUBLOADS);
      subloads[group] = children.map((child) => ({
        id: clean(child.id),
        name: clean(child.name),
        icon: clean(child.icon) || "🔌",
        pwr: clean(child.power),
        pwrLive: clean(child.power),
        bin: clean(child.state),
        daily: clean(child.daily),
        monthly: clean(child.monthly),
        total: clean(child.total),
      }));

      for (const child of children) {
        const childKept = before.get(clean(child.id)) || {};
        loads.push({
          ...childKept,
          id: clean(child.id),
          name: clean(child.name),
          icon: clean(child.icon) || "🔌",
          order: index,
          show_in_dashboard: false,
          power_entity: clean(child.power),
          control_entity: clean(childKept.control_entity),
          daily_energy_entity: clean(child.daily),
          monthly_energy_entity: clean(child.monthly),
          total_energy_entity: clean(child.total),
          history_entity: clean(child.total),
          metadata: {
            ...(childKept.metadata || {}),
            beta27_subload_group: group,
            beta27_subload_id: clean(child.id),
          },
        });
      }

      /* The circle customization is now the load itself. The slot mirror is
       * still written so a runtime that has not reloaded yet keeps painting
       * the same colours, but it is derived, never read back. */
      const slot = LEGACY_SLOT_KEYS[index];
      if (slot)
        flowNodes[slot] = {
          name: clean(load.name),
          icon: clean(load.icon) || "🔌",
          color: clean(load.color),
          group,
          pwr: clean(load.power),
          enabled: load.visible !== false,
        };
    });

  // Rows this editor never showed — manual report entries — survive a save.
  for (const item of array(previous))
    if (
      item?.category === "manual-report" &&
      !loads.some((entry) => clean(entry.id) === clean(item.id))
    )
      loads.push(item);

  return { loads, groups, subloads, flowNodes };
}

/* One line under each card in the editor, so a load's binding is readable
 * without opening it. */
export function loadConfigSummary(load = {}, locale = "it") {
  const english = locale === "en";
  const parts = [];
  if (clean(load.power)) parts.push(english ? "power" : "potenza");
  if (clean(load.total)) parts.push(english ? "total meter" : "contatore totale");
  if (clean(load.daily)) parts.push(english ? "day" : "giorno");
  if (clean(load.monthly)) parts.push(english ? "month" : "mese");
  const children = array(load.children).length;
  if (children)
    parts.push(
      children === 1
        ? english
          ? "1 appliance"
          : "1 dispositivo"
        : `${children} ${english ? "appliances" : "dispositivi"}`,
    );
  if (!parts.length) return english ? "no entity yet" : "nessuna entità";
  return parts.join(" · ");
}

/* What the stage will do with this load, said plainly, because the two things
 * users got wrong were reading a lifetime total as a period and expecting a
 * circle to appear with nothing bound to it. */
export function loadConfigWarnings(load = {}, locale = "it") {
  const english = locale === "en";
  const warnings = [];
  const energy = clean(load.total) || clean(load.daily) || clean(load.monthly);
  if (!clean(load.power) && !energy)
    return [
      english
        ? "No entity bound: the circle stays empty in every view."
        : "Nessuna entità collegata: il cerchio resta vuoto in tutte le viste.",
    ];
  if (!clean(load.power) && energy)
    warnings.push(
      english
        ? "No power entity: the Instant view has nothing to show for this load."
        : "Manca la potenza: la vista Istantaneo non ha niente da mostrare per questo carico.",
    );
  if (!clean(load.total) && !clean(load.daily) && !clean(load.monthly))
    warnings.push(
      english
        ? "No energy meter: Day and Month stay empty. A total meter is enough — the period is computed from it."
        : "Nessun contatore energia: Giorno e Mese restano vuoti. Basta il contatore totale, il periodo viene calcolato da lì.",
    );
  return warnings;
}
