/* Canonical Alerts projection shared by the legacy editor and the root runtime. */
const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_ALERTS_RUNTIME__";

const state = (root[KEY] ||= { installed: true, applying: false });
const clean = (value) => String(value ?? "").trim();
const esc = (value) =>
  clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const text = (it, en) => (doc?.documentElement?.lang === "en" ? en : it);

function readJson(key, fallback) {
  try {
    return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function configuredGroups() {
  const extras = readJson("cd_gruppi_extra", {});
  const removed = readJson("cd_gruppi_removed", {});
  const lights = Object.keys(readJson("cd_luci", {})).filter((id) => id.includes("."));
  const names = readJson("cd_avvisi_names_extra", {});
  extras.luci = [...new Set([...(extras.luci || []), ...lights])].filter(
    (id) => !(removed.luci || []).includes(id),
  );
  root.localStorage?.setItem("cd_gruppi_extra", JSON.stringify(extras));
  return { extras, names };
}

function rowFor(entity, group, names) {
  const friendly =
    clean(names[entity]) ||
    clean(root.STATES?.[entity]?.attributes?.friendly_name) ||
    clean(root._RAW_STATES?.[entity]?.attributes?.friendly_name) ||
    entity;
  const row = doc.createElement("div");
  row.className = "ed-row dm-alert-row";
  row.dataset.alertEntity = entity;
  row.dataset.alertGroup = group;
  row.innerHTML = `<div class="ed-row-main"><div class="ed-row-new">${esc(friendly)}</div><div class="ed-row-old mono">${esc(entity)}</div></div><button type="button" class="ed-del dm-alert-edit" data-dm-alert-edit aria-label="${text("Modifica", "Edit")}">✏️</button><button type="button" class="ed-del" data-dm-alert-delete aria-label="${text("Elimina", "Delete")}">🗑️</button>`;
  row.querySelector("[data-dm-alert-edit]").addEventListener("click", () => beginEdit(row));
  row.querySelector("[data-dm-alert-delete]").addEventListener("click", () => {
    root.edDelAvviso?.(group, entity);
    schedule();
  });
  return row;
}

function beginEdit(row) {
  const group = clean(row.dataset.alertGroup);
  const entity = clean(row.dataset.alertEntity);
  const name = clean(row.querySelector(".ed-row-new")?.textContent);
  const groupInput = doc.getElementById("ed-avv-grp");
  const entityInput = doc.getElementById("ed-avv-ent");
  const nameInput = doc.getElementById("ed-avv-name");
  if (groupInput) groupInput.value = group;
  if (entityInput) {
    entityInput.value = entity;
    entityInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (nameInput) {
    nameInput.value = name;
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  nameInput?.focus();
}

function locateOrCreateList(group) {
  const body = doc.getElementById("ed-body");
  if (!body) return null;
  const existing = [...body.querySelectorAll("details.ed-acc")].find((details) => {
    const summary = clean(details.querySelector("summary")?.textContent).toLowerCase();
    return group === "luci" ? /luci|lights/.test(summary) : false;
  });
  if (existing) {
    const list = existing.querySelector(".ed-list") || existing.querySelector(".ed-acc-body");
    if (list) return list;
  }
  const details = doc.createElement("details");
  details.className = "ed-acc dm-alert-group";
  details.open = true;
  details.dataset.alertGroup = group;
  details.innerHTML = `<summary class="ed-acc-head">💡 ${text("Luci", "Lights")} <span class="ed-acc-n">0</span></summary><div class="ed-acc-body"><div class="ed-list"></div></div>`;
  const firstForm = body.querySelector(".ed-form");
  body.insertBefore(details, firstForm || body.firstChild);
  return details.querySelector(".ed-list");
}

function normalizeExistingRows() {
  const body = doc.getElementById("ed-body");
  if (!body) return;
  body.querySelectorAll(".ed-row").forEach((row) => {
    const entity = clean(row.querySelector(".ed-row-old")?.textContent);
    const label = clean(row.querySelector(".ed-row-new")?.textContent);
    if (!entity && !label) row.remove();
  });
}

export function applyCanonicalAlerts() {
  if (!doc || state.applying) return false;
  if (doc.querySelector(".ed-tab.active")?.dataset?.tab !== "avvisi") return false;
  state.applying = true;
  try {
    const { extras, names } = configuredGroups();
    normalizeExistingRows();
    const list = locateOrCreateList("luci");
    if (!list) return false;
    const expected = extras.luci || [];
    list.replaceChildren(...expected.map((entity) => rowFor(entity, "luci", names)));
    const details = list.closest("details");
    const count = details?.querySelector(".ed-acc-n");
    if (count) count.textContent = String(expected.length);
    if (!expected.length && details) details.remove();
    return true;
  } finally {
    state.applying = false;
  }
}

function schedule() {
  root.queueMicrotask?.(applyCanonicalAlerts);
  root.setTimeout?.(applyCanonicalAlerts, 40);
}

function install() {
  if (!doc || doc.documentElement.dataset.dmAlertsRuntime === "1") return;
  doc.documentElement.dataset.dmAlertsRuntime = "1";
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('.ed-tab[data-tab="avvisi"]')) schedule();
    },
    true,
  );
  root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
  root.addEventListener?.("pageshow", schedule);
}

state.apply = applyCanonicalAlerts;
state.schedule = schedule;
if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();
