/* DashboardModern 0.15.1 — bounded real Home Assistant regression owner. */
(function installRealHomeAssistantHotfixV2(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_REAL_HA_HOTFIX_0151__";
  if (!root.document || root[KEY]?.version === "0.15.1-v2") return;

  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.1-v2",
    applying: false,
    scheduled: false,
    alertEdit: null,
    brokerIngest: null,
    dispatch: null,
  });

  const clean = (value) => String(value ?? "").trim();
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const copy = (it, en) => (english() ? en : it);
  const store = () => root.DashboardModernModules?.store || null;

  function clone(value) {
    try {
      return structuredClone(value);
    } catch (_error) {
      return JSON.parse(JSON.stringify(value ?? {}));
    }
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    root.localStorage?.setItem(key, JSON.stringify(value));
  }

  function lexical(name, fallback = null) {
    try {
      const value = root.eval?.(`typeof ${name} !== "undefined" ? ${name} : null`);
      if (value != null) return value;
    } catch (_error) {}
    return root[name] ?? fallback;
  }

  function setImportant(node, property, value) {
    if (!node?.style) return;
    node.style.setProperty(property, value, "important");
  }

  function rgb(value) {
    const raw = clean(value).toLowerCase();
    const hex = /^#([0-9a-f]{6})$/i.exec(raw);
    if (hex) return [0, 2, 4].map((index) => Number.parseInt(hex[1].slice(index, index + 2), 16));
    const short = /^#([0-9a-f]{3})$/i.exec(raw);
    if (short) return short[1].split("").map((token) => Number.parseInt(token + token, 16));
    const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(raw);
    return match ? match.slice(1, 4).map(Number) : null;
  }

  function luminance(value) {
    const channels = rgb(value);
    if (!channels) return null;
    const linear = channels.map((channel) => {
      const normalized = Math.max(0, Math.min(255, channel)) / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function dashboardIsDark() {
    const explicit = clean(doc.documentElement.dataset.theme || doc.body?.dataset?.theme).toLowerCase();
    if (explicit === "dark") return true;
    if (explicit === "light") return false;
    const styles = root.getComputedStyle?.(doc.documentElement);
    for (const token of ["--dm-bg", "--bg-sculpted", "--bg-1"]) {
      const lightness = luminance(styles?.getPropertyValue(token));
      if (lightness != null) return lightness < 0.35;
    }
    return false;
  }

  function installStyles() {
    if (doc.getElementById("dm-real-ha-hotfix-0151-v2-styles")) return;
    const style = doc.createElement("style");
    style.id = "dm-real-ha-hotfix-0151-v2-styles";
    style.textContent = `
      html body #page-appliances-main .appl-wide-card{
        background:var(--dm-real-card-bg)!important;color:var(--dm-real-text)!important;
        border-color:var(--dm-real-border)!important
      }
      html body #page-appliances-main .appl-wide-card .appl-info,
      html body #page-appliances-main .appl-wide-card .appl-wide-name,
      html body #page-appliances-main .appl-wide-card .appl-primary strong{
        color:var(--dm-real-text)!important
      }
      html body #page-appliances-main .appl-wide-card .appl-wide-cat,
      html body #page-appliances-main .appl-wide-card .appl-mini{
        color:var(--dm-real-text-dim)!important
      }
      html body #page-appliances-main .appl-wide-card .appl-visual,
      html body #page-appliances-main .appl-wide-card .appl-mini,
      html body #page-appliances-main .appl-wide-card .appl-st,
      html body #page-appliances-main .appl-wide-card .appl-action-btn{
        background:var(--dm-real-surface)!important;border-color:var(--dm-real-border)!important
      }
      html body #page-appliances-main .dm-appliance-power-toggle,
      html body #page-appliances-main [data-dm-power-toggle="true"]{
        appearance:none!important;min-width:86px!important;min-height:38px!important;
        padding:8px 14px!important;border:0!important;border-radius:12px!important;
        background:linear-gradient(135deg,#0ea5e9,#0369a1)!important;color:#fff!important;
        font:inherit!important;font-size:12px!important;font-weight:850!important;line-height:1!important;
        box-shadow:0 7px 16px rgba(2,132,199,.2)!important
      }
      #v-grid-month .dm-flow-value-line,#v-battery-month .dm-flow-value-line{
        display:block;white-space:nowrap
      }
      #v-grid-month .dm-flow-import,#v-battery-month .dm-flow-discharge{color:#e11d48}
      #v-grid-month .dm-flow-export,#v-battery-month .dm-flow-charge{color:#10b981}
      #editor-modal [data-dm-final-alert-list],
      #editor-modal [data-dm-standard-alert-list]{display:block!important}
      #editor-modal .dm-alert-edit-0151,
      #editor-modal .dm-alert-cancel-0151{
        width:38px!important;height:38px!important;display:inline-grid!important;place-items:center!important;
        border:1px solid var(--card-border,#dbe4ee)!important;border-radius:11px!important
      }
    `;
    (doc.head || doc.documentElement).append(style);
  }

  function applyDashboardPalette() {
    const dark = dashboardIsDark();
    const palette = dark
      ? { card: "#0f172a", surface: "#172033", text: "#f8fafc", dim: "#a8b4c6", border: "#334155" }
      : { card: "#ffffff", surface: "#f8fafc", text: "#0f172a", dim: "#64748b", border: "#dbe4ee" };
    doc.documentElement.dataset.dmDashboardTheme = dark ? "dark" : "light";
    doc.documentElement.style.setProperty("--dm-real-card-bg", palette.card);
    doc.documentElement.style.setProperty("--dm-real-surface", palette.surface);
    doc.documentElement.style.setProperty("--dm-real-text", palette.text);
    doc.documentElement.style.setProperty("--dm-real-text-dim", palette.dim);
    doc.documentElement.style.setProperty("--dm-real-border", palette.border);

    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card) => {
      setImportant(card, "background", palette.card);
      setImportant(card, "background-color", palette.card);
      setImportant(card, "color", palette.text);
      setImportant(card, "border-color", palette.border);
      card.querySelectorAll(".appl-info,.appl-wide-name,.appl-primary strong").forEach((node) =>
        setImportant(node, "color", palette.text),
      );
      card.querySelectorAll(".appl-wide-cat,.appl-mini").forEach((node) =>
        setImportant(node, "color", palette.dim),
      );
      card.querySelectorAll(".appl-visual,.appl-mini,.appl-st,.appl-action-btn").forEach((node) => {
        setImportant(node, "background", palette.surface);
        setImportant(node, "background-color", palette.surface);
        setImportant(node, "border-color", palette.border);
      });
      card.querySelectorAll('[data-dm-power-toggle="true"],.dm-appliance-power-toggle').forEach((button) =>
        button.classList.add("dm-appliance-power-toggle"),
      );
    });
  }

  function removeTemperatureFlames() {
    doc.querySelectorAll("#temp-grid .temp-card").forEach((card) => {
      const walker = doc.createTreeWalker(card, root.NodeFilter?.SHOW_TEXT || 4);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        if (node.nodeValue?.includes("🔥")) {
          node.nodeValue = node.nodeValue.replaceAll("🔥", "").replace(/\s{2,}/g, " ");
        }
      });
      card.dataset.dmNoFlame = "true";
    });
  }

  function meaningfulMonth(month) {
    return Boolean(
      month &&
        ["house", "solar", "gridImport", "gridExport", "batteryCharged", "batteryDischarged"]
          .map((key) => Number(month[key]))
          .some((value) => Number.isFinite(value) && value > 0),
    );
  }

  function formatEnergy(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString(english() ? "en-US" : "it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  function setFlowText(id, value) {
    const node = doc.getElementById(id);
    if (!node) return;
    node.textContent = value;
    node.dataset.dmCanonicalBundle = "true";
  }

  function setFlowPair(id, firstClass, firstValue, secondClass, secondValue) {
    const node = doc.getElementById(id);
    if (!node) return;
    const first = doc.createElement("span");
    first.className = `dm-flow-value-line ${firstClass}`;
    first.textContent = firstValue;
    const second = doc.createElement("span");
    second.className = `dm-flow-value-line ${secondClass}`;
    second.textContent = secondValue;
    node.replaceChildren(first, second);
    node.dataset.dmCanonicalBundle = "true";
  }

  function applyCanonicalFlow(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    const month = bundle?.month;
    if (!meaningfulMonth(month)) return false;
    setFlowText("v-solar-month", `${formatEnergy(month.solar)} kWh`);
    setFlowText("v-home-month", `${formatEnergy(month.house)} kWh`);
    setFlowPair(
      "v-grid-month",
      "dm-flow-import",
      `↓ ${formatEnergy(month.gridImport)} kWh`,
      "dm-flow-export",
      `↑ ${formatEnergy(month.gridExport)} kWh`,
    );
    setFlowPair(
      "v-battery-month",
      "dm-flow-charge",
      `↓ ${formatEnergy(month.batteryCharged)} kWh`,
      "dm-flow-discharge",
      `↑ ${formatEnergy(month.batteryDischarged)} kWh`,
    );
    const guard = root.__DASHBOARDMODERN_RUNTIME_REGRESSION_GUARD_0150__;
    if (guard) guard.currentFlowText = Object.create(null);
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__?.merge?.({
      "dm.energy_produzione_solare_mese": month.solar,
      "dm.energy_consumo_casa_mese": month.house,
      "dm.energy_rete_acquistata_mese": month.gridImport,
      "dm.energy_rete_venduta_mese": month.gridExport,
      "dm.energy_batteria_caricata_mese": month.batteryCharged,
      "dm.energy_batteria_usata_mese": month.batteryDischarged,
    });
    return true;
  }

  function updateEnergyCounters() {
    const editor = doc.querySelector('[data-editor="energy"]');
    if (!editor) return;
    editor.querySelectorAll("details.ed-acc").forEach((details) => {
      const inputs = [...details.querySelectorAll('input[name*="."]')].filter(
        (input) => !input.disabled && input.type !== "hidden",
      );
      if (!inputs.length) return;
      const configured = inputs.filter((input) => clean(input.value)).length;
      const counter = details.querySelector("summary small,summary .ed-acc-n");
      if (counter) counter.textContent = `${configured}/${inputs.length} ${copy("configurati", "configured")}`;
    });
  }

  function markEnergySuccess() {
    const actions = doc.querySelector('[data-editor="energy"] [data-energy-actions]');
    const save = actions?.querySelector("[data-energy-save]");
    const status = actions?.querySelector("[data-energy-status]");
    if (actions) actions.dataset.state = "success";
    if (save) save.disabled = false;
    if (status) {
      status.textContent = copy(
        "Energia salvata. I contatori totali sono applicati ai periodi Recorder.",
        "Energy saved. Total meters are applied to Recorder periods.",
      );
    }
    updateEnergyCounters();
  }

  async function saveEnergy(button) {
    const editor = button.closest('[data-editor="energy"]') || doc.querySelector('[data-editor="energy"]');
    const dashboardStore = store();
    if (!editor || !dashboardStore?.replaceSection) return false;
    const model = clone(dashboardStore.getSection?.("energy") || {});
    editor.querySelectorAll('input[name*="."]').forEach((input) => {
      const [group, key] = clean(input.name).split(".");
      if (!group || !key) return;
      model[group] ||= {};
      model[group][key] = clean(input.value);
    });
    model.metadata = { ...(model.metadata || {}), semantics_version: 4, cumulative_statistics: true };
    const actions = editor.querySelector("[data-energy-actions]");
    if (actions) actions.dataset.state = "loading";
    button.disabled = true;
    try {
      await dashboardStore.replaceSection("energy", model);
      const runtime = root.__DASHBOARDMODERN_RUNTIME_0150__;
      if (runtime) runtime.pendingEnergy = {};
      root.DashboardModernRuntime0150?.broker?.cache?.clear?.();
      root.DashboardModernRuntime0150?.broker?.inflight?.clear?.();
      markEnergySuccess();
      [0, 80, 240].forEach((delay) => root.setTimeout?.(markEnergySuccess, delay));
      Promise.resolve(root.DashboardModernRuntime0150?.refreshSelectedPeriod?.())
        .then(() => applyCanonicalFlow())
        .catch(() => {});
      return true;
    } catch (error) {
      const current = doc.querySelector('[data-editor="energy"] [data-energy-actions]');
      if (current) current.dataset.state = "error";
      const status = current?.querySelector("[data-energy-status]");
      if (status) status.textContent = `${copy("Salvataggio fallito", "Save failed")}: ${error.message}`;
      button.disabled = false;
      return false;
    }
  }

  function synchronizeAlerts() {
    const groups = lexical("GRUPPI_MONITORAGGIO", {}) || {};
    const names = lexical("AVVISI_NAMES", {}) || {};
    const extras = readJson("cd_gruppi_extra", {});
    const removed = readJson("cd_gruppi_removed", {});
    const extraNames = readJson("cd_avvisi_names_extra", {});
    new Set([...Object.keys(groups), ...Object.keys(extras), ...Object.keys(removed)]).forEach((group) => {
      const blocked = new Set(Array.isArray(removed[group]) ? removed[group] : []);
      const merged = [
        ...(Array.isArray(groups[group]) ? groups[group] : []),
        ...(Array.isArray(extras[group]) ? extras[group] : []),
      ].filter((entity, index, all) => entity && !blocked.has(entity) && all.indexOf(entity) === index);
      if (Array.isArray(groups[group])) groups[group].splice(0, groups[group].length, ...merged);
      else groups[group] = merged;
    });
    Object.assign(names, extraNames);
    return { groups, names };
  }

  function alertName(entity) {
    const configured = readJson("cd_avvisi_names_extra", {})[entity];
    if (configured) return configured;
    const states = { ...(lexical("_RAW_STATES", {}) || {}), ...(lexical("STATES", {}) || {}) };
    return clean(states[entity]?.attributes?.friendly_name) || entity;
  }

  function inferAlertGroup(row) {
    const explicit = clean(row.closest("details")?.dataset?.alertGroup);
    if (explicit) return explicit;
    const text = clean(row.closest("details")?.querySelector("summary")?.textContent).toLowerCase();
    if (/apert|contact|door|window/.test(text)) return "win";
    if (/batter/.test(text)) return "batt";
    if (/luc|light/.test(text)) return "luci";
    if (/clima|climate/.test(text)) return "clima";
    if (/riscald|heating/.test(text)) return "risc";
    return "";
  }

  function decorateAlertEditor() {
    const body = doc.getElementById("ed-body");
    if (!body || !doc.querySelector('.ed-tab.active[data-tab="avvisi"]')) return false;
    synchronizeAlerts();
    body.querySelectorAll("[data-dm-final-alert-list],[data-dm-standard-alert-list]").forEach((list) => {
      list.hidden = false;
      list.style.setProperty("display", "block", "important");
    });
    body.querySelectorAll(".ed-row").forEach((row) => {
      const entity =
        clean(row.querySelector(".ed-row-old.mono")?.textContent) ||
        /\b(?:binary_sensor|sensor|light|switch|climate)\.[a-z0-9_]+/i.exec(clean(row.textContent))?.[0] ||
        "";
      if (!entity) return;
      let edit = row.querySelector("[data-alert-edit-0151]");
      if (!edit) {
        edit = doc.createElement("button");
        edit.type = "button";
        edit.className = "ed-del dm-edit-button dm-alert-edit-0151";
        edit.dataset.alertEdit0151 = "";
        edit.textContent = "✏️";
        const remove = [...row.querySelectorAll("button")].find((candidate) =>
          /🗑|elimina|delete/i.test(clean(candidate.textContent) + clean(candidate.title)),
        );
        if (remove) remove.before(edit);
        else row.append(edit);
      }
      edit.dataset.alertGroup = clean(row.querySelector("[data-alert-group]")?.dataset?.alertGroup) || inferAlertGroup(row);
      edit.dataset.alertEntity = entity;
      edit.title = copy("Modifica", "Edit");
      edit.setAttribute("aria-label", edit.title);
    });
    return true;
  }

  function startAlertEdit(button) {
    const group = clean(button.dataset.alertGroup);
    const entity = clean(button.dataset.alertEntity);
    if (!group || !entity) return false;
    state.alertEdit = { group, entity };
    const groupInput = doc.getElementById("ed-avv-grp");
    const entityInput = doc.getElementById("ed-avv-ent");
    const nameInput = doc.getElementById("ed-avv-name");
    if (groupInput) groupInput.value = group;
    if (entityInput) entityInput.value = entity;
    if (nameInput) nameInput.value = alertName(entity);
    return true;
  }

  function saveAlertEdit() {
    if (!state.alertEdit) return false;
    const previous = state.alertEdit;
    const group = clean(doc.getElementById("ed-avv-grp")?.value) || previous.group;
    const entity = clean(doc.getElementById("ed-avv-ent")?.value);
    const name = clean(doc.getElementById("ed-avv-name")?.value);
    if (!entity.includes(".")) return true;
    const extras = readJson("cd_gruppi_extra", {});
    const removed = readJson("cd_gruppi_removed", {});
    const names = readJson("cd_avvisi_names_extra", {});
    if (Array.isArray(extras[previous.group]) && extras[previous.group].includes(previous.entity)) {
      extras[previous.group] = extras[previous.group].filter((item) => item !== previous.entity);
    } else {
      removed[previous.group] ||= [];
      if (!removed[previous.group].includes(previous.entity)) removed[previous.group].push(previous.entity);
    }
    extras[group] ||= [];
    if (!extras[group].includes(entity)) extras[group].push(entity);
    delete names[previous.entity];
    if (name) names[entity] = name;
    writeJson("cd_gruppi_extra", extras);
    writeJson("cd_gruppi_removed", removed);
    writeJson("cd_avvisi_names_extra", names);
    root.cdMarkDirty?.();
    Promise.resolve(root.cdSyncPush?.()).catch(() => {});
    state.alertEdit = null;
    synchronizeAlerts();
    root.editorSwitch?.("avvisi");
    return true;
  }

  function refreshAlerts() {
    synchronizeAlerts();
    const renderers = [root.updateAlerts, root.renderAlerts, root.updateAvvisi, root.renderAvvisi, root.buildAlerts]
      .filter((renderer) => typeof renderer === "function");
    if (renderers.length) {
      [...new Set(renderers)].forEach((renderer) => {
        try {
          renderer.call(root);
        } catch (_error) {}
      });
    }
  }

  function installBrokerHook() {
    const broker = root.DashboardModernRuntime0150?.broker;
    const current = broker?.ingestState;
    if (!broker || typeof current !== "function" || current.__dmRealHa0151V2) return;
    function ingestState0151V2() {
      const result = current.apply(this, arguments);
      scheduleApply();
      root.setTimeout?.(refreshAlerts, 40);
      return result;
    }
    ingestState0151V2.__dmRealHa0151V2 = true;
    state.brokerIngest = ingestState0151V2;
    broker.ingestState = ingestState0151V2;
  }

  function installDispatchGate() {
    const current = root.dispatchEvent;
    if (typeof current !== "function" || current.__dmRealHa0151V2) return;
    function dispatch0151V2(event) {
      if (
        event?.type === "dashboardmodern:energy-periods-0154" &&
        meaningfulMonth(root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle?.month)
      ) {
        root.queueMicrotask?.(() => applyCanonicalFlow());
        return true;
      }
      const result = current.call(this, event);
      if (event?.type === "dashboardmodern:period-bundle" && meaningfulMonth(event.detail?.month)) {
        root.queueMicrotask?.(() => applyCanonicalFlow(event.detail));
      }
      return result;
    }
    dispatch0151V2.__dmRealHa0151V2 = true;
    state.dispatch = dispatch0151V2;
    root.dispatchEvent = dispatch0151V2;
  }

  function applyAll() {
    if (state.applying) return;
    state.applying = true;
    try {
      installStyles();
      installBrokerHook();
      installDispatchGate();
      synchronizeAlerts();
      applyDashboardPalette();
      removeTemperatureFlames();
      applyCanonicalFlow();
      updateEnergyCounters();
      decorateAlertEditor();
    } finally {
      state.applying = false;
    }
  }

  function scheduleApply() {
    if (state.scheduled) return;
    state.scheduled = true;
    root.queueMicrotask?.(() => {
      state.scheduled = false;
      applyAll();
    });
  }

  function handleClick(event) {
    const energySave = event.target?.closest?.("[data-energy-save]");
    if (energySave) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveEnergy(energySave).catch((error) => root.console?.warn?.("Energy save 0.15.1", error));
      return;
    }
    const alertEdit = event.target?.closest?.("[data-alert-edit-0151]");
    if (alertEdit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startAlertEdit(alertEdit);
      return;
    }
    const alertSave = event.target?.closest?.('button[onclick="edAddAvviso()"]');
    if (alertSave && state.alertEdit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAlertEdit();
      return;
    }
    scheduleApply();
    root.setTimeout?.(applyAll, 60);
  }

  doc.addEventListener("click", handleClick, true);
  doc.addEventListener("input", (event) => {
    if (event.target?.closest?.('[data-editor="energy"]')) updateEnergyCounters();
  }, true);
  doc.addEventListener("change", () => {
    scheduleApply();
    root.setTimeout?.(applyAll, 60);
  }, true);
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    if (meaningfulMonth(event.detail?.month)) applyCanonicalFlow(event.detail);
    scheduleApply();
  });
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    refreshAlerts();
    scheduleApply();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleApply);
  root.addEventListener?.("pageshow", () => {
    refreshAlerts();
    scheduleApply();
  });

  state.apply = applyAll;
  state.applyCanonicalFlow = applyCanonicalFlow;
  state.refreshAlerts = refreshAlerts;
  state.synchronizeAlertRegistries = synchronizeAlerts;

  installStyles();
  installBrokerHook();
  installDispatchGate();
  synchronizeAlerts();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", applyAll, { once: true });
  else applyAll();
  [80, 280, 760, 1500].forEach((delay) => root.setTimeout?.(applyAll, delay));
})(globalThis);
