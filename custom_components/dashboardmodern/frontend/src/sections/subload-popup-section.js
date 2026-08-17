// DM-FIX-20260817C
/* The popup a flow circle opens, rendered from the same loads the stage uses.
 *
 * The legacy renderer built its cards from a parallel runtime object and gave
 * every idle appliance the same alert red it used for problems, so a quiet
 * kitchen looked like a fault and the group total was nowhere on screen. This
 * owner re-renders the list after the legacy one runs: same modal, same open
 * and close, same click-through to history — a card that says what the
 * appliance is doing, how much of the group it is drawing, and a header
 * carrying the total the bubble shows.
 *
 * Event driven: it wraps the popup opener, with no polling and no observer.
 */
import { subloadPopupModel } from "../core/subload-popup-model.js";
import { subloadsOf } from "../core/energy-flow-topology.js";
import { allStates, clean, doc, english, installStyle, readJson, root, section } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SUBLOAD_POPUP__";
const state = (root[KEY] ||= { installed: false, group: "" });
const LIST = "subloads-list";
const TITLE = "subloads-title";
const t = (it, en) => (english() ? en : it);

function configuredLoads() {
  const value = section("loads", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_loads", []);
  return Array.isArray(stored) ? stored : [];
}

/* The circle the popup was opened from. Legacy passes the group id, which for
 * a migrated load is still "cucina" and for a new one is the load id; period
 * views append the period, exactly as the stage's click target builds it. */
function loadForGroup(groupId) {
  const group = clean(groupId).replace(/_(day|month)$/, "");
  if (!group) return null;
  const loads = configuredLoads();
  return (
    loads.find(
      (item) =>
        !clean(item?.metadata?.beta27_subload_group) &&
        (clean(item?.id) === group ||
          clean(item?.metadata?.beta27_subload_group) === group ||
          clean(item?.name).toLowerCase() === group.toLowerCase()),
    ) || null
  );
}

/* Which period the circle was clicked in, so the title reads like the rest of
 * the dashboard: "CUCINA · ISTANTANEO". */
function periodLabel(groupId) {
  const match = /_(day|month)$/.exec(clean(groupId));
  if (match?.[1] === "day") return t("GIORNO", "DAY");
  if (match?.[1] === "month") return t("MESE", "MONTH");
  return t("ISTANTANEO", "INSTANT");
}

/* The modal keeps its static "CARICHI" heading otherwise, which says nothing
 * about which circle was opened. */
function writeTitle(model, groupId) {
  const title = doc?.getElementById?.(TITLE);
  if (!title) return false;
  title.replaceChildren();
  const icon = element("span", "dm-subload-title-icon", model.icon);
  const name = element("span", "dm-subload-title-name", model.name.toUpperCase());
  const period = element("small", "dm-subload-title-period", periodLabel(groupId));
  title.append(icon, name, period);
  title.dataset.dmSubloadTitle = model.id || model.name;
  return true;
}

function element(tag, className = "", text = "") {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function card(item, model) {
  const node = element("article", "dm-subload-card hist-clickable");
  node.dataset.dmSubloadCard = item.id;
  node.dataset.dmSubloadState = item.state;
  node.style.setProperty("--dm-subload-color", item.color);
  node.style.setProperty("--dm-subload-tint", item.tint);
  if (item.entity)
    node.addEventListener("click", (event) => root.apriStorico?.(event, item.entity, item.name));

  const head = element("div", "dm-subload-head");
  head.append(element("span", "dm-subload-icon", item.icon));
  const title = element("div", "dm-subload-title");
  title.append(
    element("b", "", item.name),
    element(
      "small",
      "",
      {
        running: t("IN FUNZIONE", "RUNNING"),
        standby: t("STANDBY", "STANDBY"),
        off: t("SPENTO", "OFF"),
        unknown: t("NON DISPONIBILE", "UNAVAILABLE"),
      }[item.state],
    ),
  );
  head.append(title);
  node.append(head);

  const value = element("div", "dm-subload-value");
  value.append(element("span", "dm-subload-power", item.powerText));
  if (item.dailyText) value.append(element("small", "dm-subload-daily", `${item.dailyText} oggi`));
  node.append(value);

  const meter = element("div", "dm-subload-meter");
  const fill = element("span", "dm-subload-meter-fill");
  fill.style.setProperty("width", `${Math.round(item.share * 100)}%`);
  meter.append(fill);
  node.append(meter);

  // The share is only meaningful when something in the group is drawing.
  meter.hidden = !model.total;
  return node;
}

function header(model) {
  const node = element("div", "dm-subload-summary");
  node.style.setProperty("--dm-subload-color", model.color);
  const total = element("div", "dm-subload-total");
  total.append(
    element("span", "dm-subload-total-value", model.totalText),
    element(
      "small",
      "",
      model.count
        ? `${model.running}/${model.count} ${t("in funzione", "running")}`
        : t("nessun dispositivo", "no appliance"),
    ),
  );
  node.append(element("span", "dm-subload-summary-icon", model.icon), total);
  return node;
}

export function renderSubloadPopup(groupId = state.group) {
  const list = doc?.getElementById?.(LIST);
  if (!list) return false;
  const load = loadForGroup(groupId);
  if (!load) return false;
  const loads = configuredLoads();
  const appliances = Array.isArray(section("appliances", null))
    ? section("appliances", [])
    : readJson("cd_appliances", []);
  const model = subloadPopupModel({
    load: {
      id: load.id,
      name: load.name,
      icon: load.emoji_icon || load.icon,
      color: load.color || load.metadata?.flow_color,
    },
    children: subloadsOf(load, loads, Array.isArray(appliances) ? appliances : []),
    states: allStates(),
    locale: english() ? "en-GB" : "it-IT",
  });

  writeTitle(model, groupId);
  list.dataset.dmSubloadOwner = "beta30";
  list.dataset.dmSubloadCount = String(model.count);
  list.replaceChildren();
  list.append(header(model));
  const grid = element("div", "dm-subload-grid");
  if (!model.count)
    grid.append(
      element(
        "div",
        "dm-subload-empty",
        t(
          "Nessun dispositivo in questo carico. Aggiungili dall'editor Carichi.",
          "No appliance in this load yet. Add them from the Loads editor.",
        ),
      ),
    );
  for (const item of model.items) grid.append(card(item, model));
  list.append(grid);
  return true;
}

function installStyles() {
  installStyle(
    "dm-subload-popup-style",
    `
    #subloads-list[data-dm-subload-owner="beta30"]{display:block!important}
    #subloads-title[data-dm-subload-title]{display:flex!important;align-items:center;gap:10px;flex-wrap:wrap}
    .dm-subload-title-icon{font-size:26px;line-height:1}
    .dm-subload-title-name{color:var(--text,#0f172a);font-weight:900;letter-spacing:.5px}
    .dm-subload-title-period{color:var(--muted,#64748b);font-size:11px;font-weight:800;letter-spacing:1.4px}
    .dm-subload-summary{display:flex;align-items:center;gap:14px;margin:0 0 16px;padding:14px 18px;border-radius:22px;border:1px solid color-mix(in srgb,var(--dm-subload-color,#0ea5e9) 24%,transparent);background:color-mix(in srgb,var(--dm-subload-color,#0ea5e9) 10%,var(--card-bg,#fff))}
    .dm-subload-summary-icon{font-size:30px;line-height:1}
    .dm-subload-total{display:flex;flex-direction:column;min-width:0}
    .dm-subload-total-value{font-family:'Oswald',sans-serif;font-size:30px;font-weight:700;line-height:1.05;color:var(--text,#0f172a)}
    .dm-subload-total small{color:var(--muted,#64748b);font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
    .dm-subload-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:14px}
    .dm-subload-empty{grid-column:1/-1;padding:26px;text-align:center;color:var(--muted,#64748b);font-weight:700}
    .dm-subload-card{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:22px;border:1px solid var(--card-border,rgba(15,23,42,.10));background:var(--card-bg,#fff);box-shadow:var(--shadow-glass,0 10px 30px rgba(15,23,42,.06));cursor:pointer;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
    .dm-subload-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover,0 18px 44px rgba(15,23,42,.12));border-color:color-mix(in srgb,var(--dm-subload-color,#64748b) 42%,transparent)}
    .dm-subload-card[data-dm-subload-state="running"]{border-color:color-mix(in srgb,var(--dm-subload-color) 46%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--dm-subload-tint) 60%,var(--card-bg,#fff)),var(--card-bg,#fff))}
    .dm-subload-card[data-dm-subload-state="off"],.dm-subload-card[data-dm-subload-state="unknown"]{opacity:.86}
    .dm-subload-head{display:flex;align-items:center;gap:11px;min-width:0}
    .dm-subload-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:14px;background:color-mix(in srgb,var(--dm-subload-tint) 70%,transparent);font-size:23px}
    .dm-subload-title{display:flex;flex-direction:column;min-width:0}
    .dm-subload-title b{color:var(--text,#0f172a);font-size:15px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-subload-title small{color:var(--dm-subload-color,#64748b);font-size:10px;font-weight:900;letter-spacing:1.1px}
    .dm-subload-value{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
    .dm-subload-power{font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;line-height:1;color:var(--text,#0f172a)}
    .dm-subload-daily{color:var(--muted,#64748b);font-size:12px;font-weight:700}
    .dm-subload-meter{height:6px;border-radius:999px;background:color-mix(in srgb,var(--divider-color,#e2e8f0) 80%,transparent);overflow:hidden}
    .dm-subload-meter[hidden]{display:none}
    .dm-subload-meter-fill{display:block;height:100%;border-radius:999px;background:var(--dm-subload-color,#0ea5e9);transition:width .3s ease}
    @media(max-width:520px){.dm-subload-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:11px}.dm-subload-power{font-size:23px}}
    @media(prefers-reduced-motion:reduce){.dm-subload-card,.dm-subload-meter-fill{transition:none}}
  `,
  );
}

function wrapOpener(name) {
  const current = root[name];
  const marker = `__dmSubloadPopup_${name}`;
  if (typeof current !== "function" || current[marker]) return false;
  const wrapped = function (group, ...rest) {
    state.group = clean(group);
    const result = current.call(this, group, ...rest);
    // The legacy renderer paints first; this owner replaces its list once the
    // modal is on screen, so open/close and history clicks stay untouched.
    root.queueMicrotask?.(() => renderSubloadPopup(state.group));
    root.setTimeout?.(() => renderSubloadPopup(state.group), 60);
    return result;
  };
  wrapped[marker] = true;
  wrapped.__dmWrappedOriginal = current;
  root[name] = wrapped;
  return true;
}

function bindOpeners() {
  for (const name of ["apriSubLoads", "openSubLoads", "renderSubLoads"]) wrapOpener(name);
}

export function installSubloadPopupSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  bindOpeners();
  root.dmRenderSubloadPopup = renderSubloadPopup;
  for (const name of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(name, () => {
      bindOpeners();
      if (state.group) renderSubloadPopup(state.group);
    });
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installSubloadPopupSection, { once: true });
else installSubloadPopupSection();
