/* The entity picker, made fast and made to guess.
 *
 * The canonical dialog (`wzPickEntity` in the vendored runtime) stays exactly
 * where it is: same `#cd-entpick` overlay, same `#cd-ep-search` field, same
 * `cdEpChoose` on a row. What this section replaces is the part that got slow
 * and the part that was blind.
 *
 * Slow: `cdEpFilter` rescanned every entity on every keystroke, lowercasing and
 * concatenating two strings per entity as it went, then rebuilt up to 300 rows
 * as one HTML string and handed it to `innerHTML`. On a house with a few
 * thousand entities that is the list visibly trailing the keyboard. Now the
 * scan runs over a prebuilt index (`core/entity-search-index.js`), it only
 * rescans the previous matches while a query grows, and the list paints one
 * page of recycled rows and extends on scroll — so what it costs no longer
 * depends on how many entities the instance has.
 *
 * Blind: every field opened the same alphabetical list, so configuring the room
 * temperature slot meant scrolling past every `automation.` in the house. The
 * field already says what it wants — its slot reference carries a domain, its
 * label and placeholder carry the words "temperatura", "kWh", "tapparella" —
 * and the index turns that into expected domains, device classes and units. The
 * entities that satisfy them are ranked first and marked, with an empty query
 * too, which is the auto-detection the wizard does for a whole configuration
 * brought down to the single field being edited.
 *
 * Anything this section cannot do falls back to the runtime's own filter, so a
 * picker opened before the index is warm still works.
 */
import {
  buildEntityIndex,
  createSearchSession,
  fieldHints,
  rankMatches,
  searchEntityIndex,
} from "../core/entity-search-index.js";
import { allStates, clean, doc, installStyle, lexicalGlobal, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENTITY_SEARCH__";
const PAGE = 60;
const SCROLL_MARGIN = 240;

const state = (root[KEY] ||= {
  installed: false,
  index: null,
  signature: "",
  session: null,
  hints: null,
  hintsRef: null,
  sourceRef: null,
  domain: "",
  hintedOnly: false,
  query: "",
  rendered: 0,
  matched: 0,
  filtered: 0,
  active: -1,
  nodes: [],
  list: null,
  rendering: false,
  warmed: false,
});

const entryId = (entry) => clean(entry?.id || entry?.entity_id);

/* ── Entity sources ───────────────────────────────────────────────────────── */

/* Resolved once per index build, never per entity: reaching the runtime's
 * script scope costs an `eval`, and paying that for every entity in the house
 * is exactly the kind of per-item cost this index exists to remove. */
function areaResolver() {
  const wiz = lexicalGlobal("WIZ");
  if (!wiz?.entReg) return () => "";
  return (id) => {
    const registry = wiz.entReg[id];
    if (!registry) return "";
    const areaId = registry.a || (registry.d && wiz.devArea?.[registry.d]) || "";
    return clean(areaId && wiz.areaNames?.[areaId]);
  };
}

/* The picker list and the live state map each know something the other does
 * not: the list is the complete inventory fetched from Home Assistant, the
 * state map carries device classes, units and current values. The index is
 * built from the union so a search can rank on all of it. */
function composeEntries() {
  const provided = Array.isArray(root._cdEpAll) ? root._cdEpAll : [];
  const states = allStates();
  const entries = [];
  const seen = new Set();
  for (const entry of provided) {
    const id = entryId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    entries.push(entry);
  }
  for (const id of Object.keys(states)) {
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, name: clean(states[id]?.attributes?.friendly_name) || id });
  }
  return { entries, states };
}

/* Composing the entity universe means walking the live state map, which is not
 * something a keystroke should do. The composition is refreshed when the picker
 * opens, when the runtime hands over a different inventory, and when the warm-up
 * runs — never in between. */
function ensureIndex({ refresh = false } = {}) {
  if (!refresh && state.index && state.sourceRef === root._cdEpAll) return state.index;
  const { entries, states } = composeEntries();
  const signature = `${entries.length}|${entryId(entries[0])}|${entryId(entries[entries.length - 1])}`;
  state.sourceRef = root._cdEpAll;
  if (state.index && state.signature === signature) return state.index;
  const areaOf = areaResolver();
  const enrich = (id) => {
    const live = states[id];
    const area = areaOf(id);
    if (!live) return area ? { area } : null;
    return {
      dc: live.attributes?.device_class || "",
      unit: live.attributes?.unit_of_measurement || "",
      sc: live.attributes?.state_class || "",
      state: live.state,
      area,
    };
  };
  state.index = buildEntityIndex(entries, { enrich, version: signature });
  state.signature = signature;
  state.session = createSearchSession();
  /* The full inventory can land from Home Assistant while the dialog is
   * already open. The rows on screen then belong to an index that no longer
   * exists, and paging them would page nothing, so the open picker is repainted
   * against the new one. */
  if (!state.rendering && doc?.getElementById("cd-ep-list")?.dataset.dmFastPicker === "true") {
    root.queueMicrotask?.(() => render(state.query));
  }
  return state.index;
}

/* ── Field auto-detection ─────────────────────────────────────────────────── */

function fieldElement(ref) {
  if (ref?.nodeType === 1) return ref;
  const value = clean(ref);
  if (!value) return null;
  if (value.startsWith("#")) return doc?.getElementById(value.slice(1)) || null;
  if (value === "__qa__") return doc?.getElementById("wz-qa-ent") || null;
  if (value === "__ed_qa__") return doc?.getElementById("ed-qa-ent") || null;
  try {
    return doc?.querySelector(`input[data-ref="${CSS.escape(value)}"]`) || null;
  } catch (_error) {
    return null;
  }
}

function fieldLabel(element) {
  if (!element) return "";
  const slot = element.closest?.(".ed-slot,.wz-slot,label,[data-entity-field]");
  if (!slot) return "";
  const editable = slot.querySelector?.(".ed-slot-lbl input,.wz-lbl-edit");
  if (editable) return clean(editable.value);
  const label = slot.querySelector?.(".ed-slot-lbl,.wz-lbl,.ed-lbl");
  return clean(label?.textContent || "");
}

/* Rebuilt only when the picker points at a different field: the hint table it
 * feeds is precomputed over the whole index, and recomputing it per keystroke
 * would give back everything the index saves. */
function currentHints() {
  const ref = root._cdEpRef;
  if (state.hints && state.hintsRef === ref) return state.hints;
  const element = fieldElement(ref);
  const descriptor = {
    ref: clean(element?.dataset?.ref || (typeof ref === "string" ? ref : "")),
    id: clean(element?.id),
    placeholder: clean(element?.placeholder),
    domain: clean(element?.dataset?.domain),
    label: fieldLabel(element),
    value: clean(element?.value),
  };
  state.hints = fieldHints(descriptor);
  state.hintsRef = ref;
  return state.hints;
}

/* ── Rendering ────────────────────────────────────────────────────────────── */

function dialogParts(list) {
  const dialog = list.parentElement;
  if (!dialog) return null;
  if (list.dataset.dmFastPicker === "true") {
    return {
      dialog,
      status: dialog.querySelector("#dm-ep-status"),
      chips: dialog.querySelector("#dm-ep-chips"),
    };
  }
  const status = doc.createElement("div");
  status.id = "dm-ep-status";
  status.className = "dm-ep-status";
  const chips = doc.createElement("div");
  chips.id = "dm-ep-chips";
  chips.className = "dm-ep-chips";
  dialog.insertBefore(status, list);
  dialog.insertBefore(chips, list);
  list.dataset.dmFastPicker = "true";
  list.setAttribute("role", "listbox");
  list.addEventListener("scroll", () => {
    if (list.scrollTop + list.clientHeight < list.scrollHeight - SCROLL_MARGIN) return;
    appendPage();
  });
  chips.addEventListener("click", (event) => {
    const chip = event.target?.closest?.("[data-dm-domain],[data-dm-suggested]");
    if (!chip) return;
    if (chip.dataset.dmSuggested) state.hintedOnly = !state.hintedOnly;
    else {
      state.domain = chip.dataset.dmDomain === "*" ? "" : chip.dataset.dmDomain;
      state.hintedOnly = false;
    }
    render(state.query);
  });
  const search = dialog.querySelector("#cd-ep-search");
  search?.addEventListener("keydown", onSearchKeydown);
  return { dialog, status, chips };
}

function rowNode(position) {
  const existing = state.nodes[position];
  if (existing) return existing;
  const row = doc.createElement("div");
  row.className = "dm-ep-row";
  row.setAttribute("role", "option");
  /* A constant handler string: the row is recycled, so the attribute is set
   * once and only the dataset changes. The picker's own `cdEpChoose` still does
   * the writing back into the field. */
  row.setAttribute("onclick", "cdEpChoose(this.dataset.entity)");
  row.innerHTML =
    '<span class="dm-ep-main"><b class="dm-ep-name"></b><span class="dm-ep-id mono"></span></span>' +
    '<span class="dm-ep-meta"><span class="dm-ep-badge"></span><span class="dm-ep-value"></span><span class="dm-ep-area"></span></span>';
  row.__parts = {
    name: row.querySelector(".dm-ep-name"),
    id: row.querySelector(".dm-ep-id"),
    badge: row.querySelector(".dm-ep-badge"),
    value: row.querySelector(".dm-ep-value"),
    area: row.querySelector(".dm-ep-area"),
  };
  state.nodes[position] = row;
  return row;
}

function paintRow(row, entry) {
  const record = entry.record;
  const parts = row.__parts;
  row.dataset.entity = record.id;
  row.dataset.hinted = entry.hinted ? "true" : "false";
  parts.name.textContent = record.name;
  parts.id.textContent = record.id;
  parts.badge.textContent = entry.hinted ? "✨" : "";
  const value = clean(record.state);
  parts.value.textContent = value && value !== "unknown" && value !== "unavailable"
    ? `${value}${record.unit ? ` ${record.unit}` : ""}`
    : "";
  parts.area.textContent = record.area ? `🏠 ${record.area}` : "";
  row.classList.remove("is-active");
}

function paintRows(list, rows, { append = false } = {}) {
  const offset = append ? state.rendered : 0;
  if (!append) {
    state.active = -1;
    list.textContent = "";
  }
  const fragment = doc.createDocumentFragment();
  rows.forEach((entry, position) => {
    const row = rowNode(offset + position);
    paintRow(row, entry);
    fragment.append(row);
  });
  list.append(fragment);
  state.rendered = offset + rows.length;
  if (!state.rendered) {
    const empty = doc.createElement("div");
    empty.className = "dm-ep-empty";
    empty.textContent = t("Nessun risultato", "No results");
    list.append(empty);
  }
}

function paintStatus(status, result) {
  if (!status) return;
  const parts = [t(`${result.total} entità`, `${result.total} entities`)];
  if (result.plan.folded || state.domain || state.hintedOnly) {
    parts.push(t(`${result.filtered} risultati`, `${result.filtered} results`));
  }
  if (result.hinted && !result.plan.folded && !state.hintedOnly) {
    parts.push(t(`${result.hinted} suggerite per questo campo`, `${result.hinted} suggested for this field`));
  }
  status.textContent = parts.join(" · ");
}

function chipNode(label, on) {
  const chip = doc.createElement("button");
  chip.type = "button";
  chip.className = on ? "dm-ep-chip is-on" : "dm-ep-chip";
  chip.textContent = label;
  return chip;
}

function paintChips(chips, counts, suggested) {
  if (!chips) return;
  const entries = counts ? [...counts.entries()].sort((left, right) => right[1] - left[1]) : [];
  if (entries.length < 2 && !suggested) {
    chips.textContent = "";
    chips.hidden = true;
    return;
  }
  chips.hidden = false;
  chips.textContent = "";
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const all = chipNode(t("Tutte", "All") + ` ${total}`, !state.domain && !state.hintedOnly);
  all.dataset.dmDomain = "*";
  chips.append(all);
  /* The auto-detection as a filter: one tap to see only what fits this field,
   * which is the fastest path on an instance where the right entity is one of
   * three thousand. */
  if (suggested) {
    const chip = chipNode(`✨ ${t("Suggerite", "Suggested")} ${suggested}`, state.hintedOnly);
    chip.dataset.dmSuggested = "true";
    chips.append(chip);
  }
  const domains = entries.slice(0, 6);
  if (state.domain && !domains.some(([domain]) => domain === state.domain)) {
    domains.push([state.domain, counts.get(state.domain) || 0]);
  }
  for (const [domain, count] of domains) {
    const chip = chipNode(`${domain} ${count}`, domain === state.domain);
    chip.dataset.dmDomain = domain;
    chips.append(chip);
  }
}

function appendPage() {
  const list = state.list;
  if (!list?.isConnected || state.rendered >= state.filtered) return;
  if (state.session?.signature !== state.index?.signature) {
    render(state.query);
    return;
  }
  const rows = rankMatches(state.index, state.session, {
    offset: state.rendered,
    limit: PAGE,
    domain: state.domain,
    hints: currentHints(),
    query: state.query,
    hintedOnly: state.hintedOnly,
  });
  if (!rows.length) return;
  paintRows(list, rows, { append: true });
}

function render(query) {
  const list = doc?.getElementById("cd-ep-list");
  if (!list) return false;
  // A different list element means a freshly opened dialog: that is the moment
  // to look at the entity universe again.
  const opened = state.list !== list;
  state.list = list;
  // A filter belongs to the picker it was set in: carrying it into the next
  // field would hide most of the list for no visible reason.
  if (opened) {
    state.domain = "";
    state.hintedOnly = false;
  }
  state.rendering = true;
  try {
    const index = ensureIndex({ refresh: opened });
    if (!index?.size) return false;
    const parts = dialogParts(list);
    state.query = clean(query);
    const result = searchEntityIndex(index, state.query, {
      limit: PAGE,
      domain: state.domain,
      hints: currentHints(),
      session: state.session,
      withDomains: true,
      hintedOnly: state.hintedOnly,
    });
    state.matched = result.matched;
    state.filtered = result.filtered;
    paintRows(list, result.rows);
    paintStatus(parts?.status, result);
    paintChips(parts?.chips, result.domains, result.hinted);
    list.scrollTop = 0;
    return true;
  } finally {
    state.rendering = false;
  }
}

/* ── Keyboard ─────────────────────────────────────────────────────────────── */

function moveActive(delta) {
  const rows = state.list?.querySelectorAll?.(".dm-ep-row");
  if (!rows?.length) return;
  const next = Math.min(rows.length - 1, Math.max(0, state.active + delta));
  rows[state.active]?.classList.remove("is-active");
  state.active = next;
  const row = rows[next];
  row.classList.add("is-active");
  row.scrollIntoView?.({ block: "nearest" });
  if (next >= rows.length - 3) appendPage();
}

function onSearchKeydown(event) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveActive(state.active < 0 ? 0 : 1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveActive(-1);
    return;
  }
  if (event.key === "Enter") {
    const rows = state.list?.querySelectorAll?.(".dm-ep-row");
    const row = rows?.[state.active >= 0 ? state.active : 0];
    if (!row) return;
    event.preventDefault();
    root.cdEpChoose?.(row.dataset.entity);
    return;
  }
  if (event.key === "Escape") {
    doc?.getElementById("cd-entpick")?.remove();
  }
}

/* ── Installation ─────────────────────────────────────────────────────────── */

function installFilter() {
  const legacy = root.cdEpFilter;
  if (typeof legacy === "function" && legacy.__dmFastEntitySearch) return false;
  const fast = function cdEpFilter(query) {
    state.calls = (state.calls || 0) + 1;
    try {
      if (render(query)) return;
      state.lastError = "empty-index";
    } catch (error) {
      /* Kept for support: a picker that quietly fell back to the vendored list
       * should be able to say why it did. */
      state.lastError = String(error?.message || error);
    }
    /* Never leave the picker without a list: if anything above fails the
     * vendored filter still paints exactly what it always did. */
    try {
      legacy?.call(this, query);
    } catch (_ignore) {}
  };
  fast.__dmFastEntitySearch = true;
  fast.__dmPrevious = legacy;
  root.cdEpFilter = fast;
  /* On a slow first load the dialog can be open before this module is: the
   * runtime painted its own list and will not call the filter again until the
   * user types. Repainting the open picker here is what makes the fast list
   * appear anyway, instead of waiting for it to be closed and reopened. */
  const open = doc?.getElementById("cd-ep-list");
  if (open && open.dataset.dmFastPicker !== "true") {
    const search = doc.getElementById("cd-ep-search");
    root.queueMicrotask?.(() => fast(search?.value || ""));
  }
  return true;
}

/* Opening a picker on a cold list used to mean waiting for a WebSocket round
 * trip, then watching the list swap under the finger when the full inventory
 * arrived. Warming both the inventory and the index while the editor is open
 * moves that work off the interaction. */
function warmUp() {
  if (state.warmed) return;
  state.warmed = true;
  const build = () => {
    try {
      ensureIndex({ refresh: true });
    } catch (_error) {}
  };
  try {
    if (typeof root.cdLoadAllEntitiesForPicker === "function") {
      root.cdLoadAllEntitiesForPicker((full) => {
        if (Array.isArray(full) && full.length && !Array.isArray(root._cdEpAll)) root._cdEpAll = full;
        build();
      });
      return;
    }
  } catch (_error) {}
  build();
}

function scheduleWarmUp() {
  if (state.warmed) return;
  const run = () => warmUp();
  if (typeof root.requestIdleCallback === "function") root.requestIdleCallback(run, { timeout: 4000 });
  else root.setTimeout?.(run, 1200);
}

function installStyles() {
  installStyle(
    "dm-entity-search-style",
    `
    #cd-entpick .dm-ep-status{padding:0 4px 6px;color:var(--text-dim,#64748b);font-size:10.5px;font-weight:700}
    #cd-entpick .dm-ep-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
    #cd-entpick .dm-ep-chips[hidden]{display:none}
    #cd-entpick .dm-ep-chip{padding:4px 10px;border:1px solid rgba(148,163,184,.28);border-radius:999px;background:rgba(148,163,184,.10);color:var(--text-dim,#64748b);font-size:10.5px;font-weight:800;cursor:pointer}
    #cd-entpick .dm-ep-chip.is-on{border-color:rgba(14,165,233,.42);background:rgba(14,165,233,.14);color:#0284c7}
    #cd-entpick .dm-ep-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:12px;background:rgba(148,163,184,.08);color:var(--text,#0f172a);font-size:12.5px;cursor:pointer}
    #cd-entpick .dm-ep-row[data-hinted="true"]{background:rgba(14,165,233,.12);box-shadow:inset 0 0 0 1px rgba(14,165,233,.22)}
    #cd-entpick .dm-ep-row.is-active{background:rgba(14,165,233,.22);box-shadow:inset 0 0 0 2px rgba(14,165,233,.45)}
    #cd-entpick .dm-ep-main{display:flex;flex-direction:column;gap:2px;min-width:0}
    #cd-entpick .dm-ep-name{overflow:hidden;font-weight:800;text-overflow:ellipsis;white-space:nowrap}
    #cd-entpick .dm-ep-id{overflow:hidden;color:var(--text-dim,#64748b);font-family:monospace;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
    #cd-entpick .dm-ep-meta{display:flex;align-items:center;gap:6px;flex:0 0 auto;color:var(--text-dim,#64748b);font-size:10px;font-weight:800;white-space:nowrap}
    #cd-entpick .dm-ep-value{color:#0284c7}
    #cd-entpick .dm-ep-empty{padding:20px;color:var(--text-dim,#64748b);font-weight:700;text-align:center}
  `,
  );
}

export function installEntitySearchSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  installFilter();
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(event, installFilter);
  }
  /* The warm-up asks Home Assistant for the whole entity inventory, so it is
   * tied to the user heading for the configuration — not to opening the
   * dashboard, which most of the time never needs that list at all. */
  doc.addEventListener(
    "click",
    (event) => {
      if (
        !event.target?.closest?.(
          "#cd-app-menu,#editor-modal,.ed-tab,[data-dm-edit-kind],#setup-wizard,.dm-entity-picker",
        )
      ) {
        return;
      }
      installFilter();
      scheduleWarmUp();
    },
    true,
  );
  return true;
}

installEntitySearchSection();
