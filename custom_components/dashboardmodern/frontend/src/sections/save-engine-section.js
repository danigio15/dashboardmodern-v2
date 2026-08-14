import { hasConfiguredData, VISIBILITY_SECTION } from "../core/dashboard-store.js";
import { sectionForEditorSlot } from "../core/editor-slots.js";
import { SECTION_KEYS } from "../core/migrations.js";
import { clean, dashboardStore, doc, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SAVE_ENGINE__";
const state = (root[KEY] ||= {
  installed: false,
  saveOwner: null,
  visibilityRepairing: false,
});

const pauseTurn = () =>
  new Promise((resolve) => {
    if (typeof root.setTimeout === "function") root.setTimeout(resolve, 0);
    else queueMicrotask(resolve);
  });

function activeEditorTab() {
  return clean(doc?.querySelector?.("#editor-modal .ed-tab.active,.ed-tab.active")?.dataset?.tab);
}

function editorBody() {
  return doc?.getElementById?.("ed-body") || null;
}

function pendingApplianceDraft(body = editorBody()) {
  if (!body) return false;
  const name = clean(body.querySelector("#appl-name")?.value);
  const entityInput = clean(body.querySelector("#appl-ent")?.value);
  const entityChip = [...body.querySelectorAll("span,button,div")].some((node) => {
    if (node.children.length) return false;
    const value = clean(node.textContent);
    return /^(?:sensor|binary_sensor|switch|light|fan|input_boolean)\.[a-z0-9_]+$/i.test(value);
  });
  return Boolean(name || entityInput || entityChip);
}

function applianceCommitButton(body = editorBody()) {
  if (!body) return null;
  return (
    [...body.querySelectorAll("button.ed-btn-add,button")].find((button) => {
      const label = clean(button.textContent).toLowerCase();
      return (
        /(?:aggiungi\s+elettrodomestico|add\s+appliance)/i.test(label) &&
        !/(?:questa\s+entit|this\s+entity|salva\s+sezione|save\s+section)/i.test(label)
      );
    }) || null
  );
}

async function reconcileLegacyKey(key) {
  const store = dashboardStore();
  if (!store?.reconcileLegacyWrite || !root.localStorage) return false;
  const serialized = root.localStorage.getItem(key);
  if (serialized === null || serialized === undefined) return false;
  await store.reconcileLegacyWrite(key, serialized);
  return true;
}

async function reconcileAllLegacyConfig() {
  const store = dashboardStore();
  if (!store) return false;

  // Reconcile data first. A section transaction may auto-enable its navbar
  // visibility and rewrite cd_sections; reading cd_sections only afterwards
  // prevents a stale hidden flag from undoing that automatic visibility.
  for (const key of Object.values(SECTION_KEYS)) await reconcileLegacyKey(key);
  await reconcileLegacyKey("cd_sections");
  return true;
}

async function commitPendingAppliance() {
  if (activeEditorTab() !== "appliances") return false;
  const body = editorBody();
  if (!pendingApplianceDraft(body)) return false;

  const button = applianceCommitButton(body);
  if (!button)
    throw new Error(
      t("Pulsante Aggiungi elettrodomestico non trovato", "Add appliance button not found"),
    );

  const store = dashboardStore();
  const before = JSON.stringify(store?.getSection?.("appliances") || []);
  button.click();

  // The legacy Add action writes cd_appliances synchronously; its bridge back to
  // DashboardStore is queued in a microtask. Wait for that bridge, then reconcile
  // explicitly as a safety net before any remote snapshot is pushed.
  await Promise.resolve();
  await pauseTurn();
  await reconcileLegacyKey(SECTION_KEYS.appliances);
  await Promise.resolve();

  const after = JSON.stringify(store?.getSection?.("appliances") || []);
  if (after === before && pendingApplianceDraft(editorBody())) {
    throw new Error(t("L'elettrodomestico non è entrato nello store", "Appliance did not enter the store"));
  }
  return after !== before;
}

function entityReference(value) {
  return typeof value === "string" && value.trim().includes(".");
}

async function repairConfiguredVisibility() {
  const store = dashboardStore();
  if (!store?.getState || !store?.getSection || !store?.transact || state.visibilityRepairing)
    return false;

  state.visibilityRepairing = true;
  let changed = false;
  try {
    for (const section of Object.keys(SECTION_KEYS)) {
      if (section === "entityOverrides") continue;
      const value = store.getSection(section);
      const visibilityKey = VISIBILITY_SECTION[section] || section;
      if (
        !hasConfiguredData(section, value) ||
        store.getState().visibility?.[visibilityKey] === true
      )
        continue;
      await store.transact(section, "visibility-reconcile", () => null);
      changed = true;
    }

    // Entity overrides own several legacy sections (security/server/boiler/etc.).
    // Reconcile only when at least one populated slot maps to a currently-hidden
    // section, otherwise startup remains a no-op and performs no extra sync.
    const overrides = store.getSection("entityOverrides");
    const visibility = store.getState().visibility || {};
    const needsOverrideVisibility = Object.entries(overrides || {}).some(([slot, entity]) => {
      if (!entityReference(entity)) return false;
      const mapped = sectionForEditorSlot(slot);
      return mapped && visibility[mapped] !== true;
    });
    if (needsOverrideVisibility) {
      await store.transact("entityOverrides", "visibility-reconcile", () => null);
      changed = true;
    }
  } finally {
    state.visibilityRepairing = false;
  }
  return changed;
}

async function saveCurrentSection() {
  const tab = activeEditorTab();
  const applianceDraft = tab === "appliances" && pendingApplianceDraft();
  let applianceCommitted = false;

  if (applianceDraft) applianceCommitted = await commitPendingAppliance();
  await reconcileAllLegacyConfig();
  await repairConfiguredVisibility();

  const store = dashboardStore();
  root.cdMarkDirty?.();
  if (store?.sync) await store.sync();
  else await root.cdSyncPush?.();

  if (applianceDraft && !applianceCommitted) {
    throw new Error(t("Salvataggio elettrodomestico non riuscito", "Appliance save failed"));
  }

  root.edToast?.(t("Sezione salvata", "Section saved"));
  return true;
}

function installSectionSaveOwner() {
  const current = root.edSecSave;
  if (typeof current !== "function") return false;
  if (current.__dmCanonicalSaveEngine) return true;

  state.saveOwner ||= current;
  async function canonicalSaveSection() {
    try {
      return await saveCurrentSection();
    } catch (error) {
      root.console?.error?.("[DashboardModern] section save failed", error);
      root.edToast?.(
        `${t("Salvataggio fallito", "Save failed")}: ${clean(error?.message || error)}`,
      );
      return false;
    }
  }
  canonicalSaveSection.__dmCanonicalSaveEngine = true;
  canonicalSaveSection.__dmPrevious = current;
  root.edSecSave = canonicalSaveSection;
  return true;
}

function markEnergyDirty(target) {
  const editor = target?.closest?.('[data-editor="energy"]');
  if (!editor) return;
  const actions = editor.querySelector("[data-energy-actions]");
  const save = actions?.querySelector("[data-energy-save]");
  const status = actions?.querySelector("[data-energy-status]");
  if (actions) actions.dataset.state = "dirty";
  if (save) save.disabled = false;
  if (status) status.textContent = t("Modifiche non salvate", "Unsaved changes");
}

function synchronizeEnergyDraftBeforeSave(save) {
  const editor = save?.closest?.('[data-editor="energy"]');
  if (!editor) return;
  // The canonical Energy renderer updates its draft on `change`. Entity pickers
  // may assign input.value programmatically, so dispatch a final synchronous
  // change for every live field before the renderer's own Save click handler.
  editor
    .querySelectorAll('[data-energy-panel="flows"] input[name]')
    .forEach((input) => input.dispatchEvent(new Event("change", { bubbles: true })));
}

function installDomContracts() {
  if (!doc || state.installed) return;
  state.installed = true;

  doc.addEventListener(
    "input",
    (event) => {
      if (event.target?.matches?.('[data-editor="energy"] input[name]')) markEnergyDirty(event.target);
    },
    true,
  );
  doc.addEventListener(
    "change",
    (event) => {
      if (event.target?.matches?.('[data-editor="energy"] input[name]')) markEnergyDirty(event.target);
    },
    true,
  );
  doc.addEventListener(
    "click",
    (event) => {
      const save = event.target?.closest?.("[data-energy-save]");
      if (save) synchronizeEnergyDraftBeforeSave(save);
    },
    true,
  );
}

function installOwners() {
  installSectionSaveOwner();
  installDomContracts();
}

export async function reconcileSaveEngine() {
  installOwners();
  await reconcileAllLegacyConfig();
  return repairConfiguredVisibility();
}

export function installSaveEngineSection() {
  installOwners();
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow"])
    root.addEventListener?.(event, () => {
      installOwners();
      root.queueMicrotask?.(() =>
        reconcileSaveEngine().catch((error) =>
          root.console?.warn?.("[DashboardModern] save engine reconcile", error),
        ),
      );
    });
}

installSaveEngineSection();
