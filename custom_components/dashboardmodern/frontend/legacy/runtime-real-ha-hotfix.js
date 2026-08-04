/* DashboardModern 0.15.1 — real Home Assistant regression hotfix. */
(function installRealHomeAssistantHotfix0151(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_REAL_HA_HOTFIX_0151__";
  if (!root.document || root[KEY]?.installed) return;

  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.1",
    scheduled: false,
    applying: false,
    alertScheduled: false,
    alertEdit: null,
    wrapped: new WeakSet(),
    ownerApply: null,
    dispatch: null,
    brokerIngest: null,
  });

  const clean = (value) => String(value ?? "").trim();
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const copy = (it, en) => (english() ? en : it);
  const dashboardStore = () => root.DashboardModernModules?.store || null;

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

  function syncStorage() {
    try {
      root.cdMarkDirty?.();
      Promise.resolve(root.cdSyncPush?.()).catch(() => {});
    } catch (_error) {}
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
    if (
      node.style.getPropertyValue(property) === value &&
      node.style.getPropertyPriority(property) === "important"
    ) {
      return;
    }
    node.style.setProperty(property, value, "important");
  }

  function parseColor(value) {
    const raw = clean(value).toLowerCase();
    if (!raw || raw === "transparent") return null;
    const shortHex = /^#([0-9a-f]{3})$/i.exec(raw);
    if (shortHex) {
      return shortHex[1].split("").map((token) => Number.parseInt(token + token, 16));
    }
    const longHex = /^#([0-9a-f]{6})$/i.exec(raw);
    if (longHex) {
      return [0, 2, 4].map((index) => Number.parseInt(longHex[1].slice(index, index + 2), 16));
    }
    const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(raw);
    if (rgb) return rgb.slice(1, 4).map(Number);
    return null;
  }

  function luminance(rgb) {
    if (!rgb) return null;
    const channels = rgb.map((value) => {
      const normalized = Math.max(0, Math.min(255, value)) / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function dashboardIsDark() {
    const explicit = `${doc.documentElement.dataset.theme || ""} ${doc.body?.dataset?.theme || ""} ${doc.documentElement.className || ""} ${doc.body?.className || ""}`.toLowerCase();
    if (/\bdark\b/.test(explicit)) return true;
    if (/\blight\b/.test(explicit)) return false;

    const htmlStyle = root.getComputedStyle?.(doc.documentElement);
    const bodyStyle = doc.body ? root.getComputedStyle?.(doc.body) : null;
    const candidates = [
      bodyStyle?.backgroundColor,
      htmlStyle?.getPropertyValue("--bg-sculpted"),
      htmlStyle?.getPropertyValue("--bg-1"),
    ];
    for (const candidate of candidates) {
      const lightness = luminance(parseColor(candidate));
      if (lightness != null) return lightness < 0.35;
    }
    return Boolean(root.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
  }

  function installStyles() {
    if (doc.getElementById("dm-real-ha-hotfix-0151-styles")) return;
    const style = doc.createElement("style");
    style.id = "dm-real-ha-hotfix-0151-styles";
    style.textContent = `
      html body #page-appliances-main .appl-wide-card{
        background:var(--dm-real-card-bg)!important;
        color:var(--dm-real-text)!important;
        border-color:var(--dm-real-border)!important;
      }
      html body #page-appliances-main .appl-wide-card .appl-info,
      html body #page-appliances-main .appl-wide-card .appl-wide-name,
      html body #page-appliances-main .appl-wide-card .appl-primary strong{
        color:var(--dm-real-text)!important;
      }
      html body #page-appliances-main .appl-wide-card .appl-wide-cat,
      html body #page-appliances-main .appl-wide-card .appl-mini{
        color:var(--dm-real-text-dim)!important;
      }
      html body #page-appliances-main .appl-wide-card .appl-visual{
        background:var(--dm-real-surface)!important;
        border-color:var(--dm-real-border)!important;
      }
      html body #page-appliances-main .appl-wide-card .appl-mini,
      html body #page-appliances-main .appl-wide-card .appl-st,
      html body #page-appliances-main .appl-wide-card .appl-action-btn{
        background:var(--dm-real-surface)!important;
        border:1px solid var(--dm-real-border)!important;
      }
      html body #page-appliances-main .dm-appliance-power-toggle,
      html body #page-appliances-main [data-dm-power-toggle="true"]{
        appearance:none!important;
        min-width:86px!important;
        min-height:38px!important;
        padding:8px 14px!important;
        border:0!important;
        border-radius:12px!important;
        background:linear-gradient(135deg,#0ea5e9,#0369a1)!important;
        color:#fff!important;
        font:inherit!important;
        font-size:12px!important;
        font-weight:850!important;
        line-height:1!important;
        box-shadow:0 7px 16px rgba(2,132,199,.2)!important;
      }
      html[data-dm-dashboard-theme="light"] body #page-appliances-main .appl-st.on{
        background:#e0f2fe!important;color:#0284c7!important;border-color:#bae6fd!important;
      }
      html[data-dm-dashboard-theme="dark"] body #page-appliances-main .appl-st.on{
        background:rgba(14,165,233,.18)!important;color:#7dd3fc!important;border-color:#075985!important;
      }
      #v-grid-month .dm-flow-value-line,
      #v-battery-month .dm-flow-value-line{display:block;white-space:nowrap}
      #v-grid-month .dm-flow-import{color:#e11d48}
      #v-grid-month .dm-flow-export{color:#10b981}
      #v-battery-month .dm-flow-charge{color:#10b981}
      #v-battery-month .dm-flow-discharge{color:#e11d48}
      #editor-modal [data-dm-final-alert-list],
      #editor-modal [data-dm-standard-alert-list]{display:none!important}
      #editor-modal details.ed-acc[data-dm-alert-group]{display:block!important}
      #editor-modal details.ed-acc[data-dm-alert-group]>.ed-acc-body{display:block!important}
      #editor-modal .dm-alert-edit-0151,
      #editor-modal .dm-alert-cancel-0151{
        width:38px!important;height:38px!important;display:inline-grid!important;place-items:center!important;
        border:1px solid var(--card-border,#dbe4ee)!important;border-radius:11px!important;
      }
    `;
    (doc.head || doc.documentElement).append(style);
  }

  function applyDashboardPalette() {
    const dark = dashboardIsDark();
    const palette = dark
      ? {
          card: "#0f172a",
          surface: "#172033",
          text: "#f8fafc",
          dim: "#a8b4c6",
          border: "#334155",
        }
      : {
          card: "#ffffff",
          surface: "#f8fafc",
          text: "#0f172a",
          dim: "#64748b",
          border: "#dbe4ee",
        };
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
      const visual = card.querySelector(".appl-visual");
      if (visual) {
        setImportant(visual, "background", palette.surface);
        setImportant(visual, "background-color", palette.surface);
        setImportant(visual, "border-color", palette.border);
      }
      card.querySelectorAll(".appl-mini,.appl-st,.appl-action-btn").forEach((node) => {
        setImportant(node, "background", palette.surface);
        setImportant(node, "background-color", palette.surface);
        setImportant(node, "border-color", palette.border);
      });
      card.querySelectorAll('[data-dm-power-toggle="true"],.dm-appliance-power-toggle').forEach((button) => {
        button.type = "button";
        button.classList.add("dm-appliance-power-toggle");
      });
    });
    return dark ? "dark" : "light";
  }

  function removeTemperatureFlames() {
    doc.querySelectorAll("#temp-grid .temp-card").forEach((card) => {
      const walker = doc.createTreeWalker(card, root.NodeFilter?.SHOW_TEXT || 4);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        if (!node.nodeValue?.includes("🔥")) return;
        node.nodeValue = node.nodeValue.replaceAll("🔥", "").replace(/\s{2,}/g, " ");
      });
      card.querySelectorAll("span,div,i,b").forEach((node) => {
        if (node.children.length || clean(node.textContent)) return;
        if (/state|status|condition|heat|flame/i.test(node.className || "")) node.remove();
      });
      card.dataset.dmNoFlame = "true";
    });
  }

  function formatEnergy(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString(english() ? "en-US" : "it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  function setFlowText(id, text) {
    const node = doc.getElementById(id);
    if (!node) return;
    if (node.textContent !== text) node.textContent = text;
    node.dataset.dmCanonicalBundle = "true";
  }

  function setFlowPair(id, firstClass, firstValue, secondClass, secondValue) {
    const node = doc.getElementById(id);
    if (!node) return;
    const signature = `${firstValue}|${secondValue}`;
    if (node.dataset.dmCanonicalSignature !== signature) {
      node.replaceChildren();
      const first = doc.createElement("span");
      first.className = `dm-flow-value-line ${firstClass}`;
      first.textContent = firstValue;
      const second = doc.createElement("span");
      second.className = `dm-flow-value-line ${secondClass}`;
      second.textContent = secondValue;
      node.append(first, second);
      node.dataset.dmCanonicalSignature = signature;
    }
    node.dataset.dmCanonicalBundle = "true";
  }

  function applyCanonicalFlow(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    const month = bundle?.month;
    if (!month) return false;
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

    const slots = {
      "dm.energy_produzione_solare_mese": month.solar,
      "dm.energy_consumo_casa_mese": month.house,
      "dm.energy_rete_acquistata_mese": month.gridImport,
      "dm.energy_rete_venduta_mese": month.gridExport,
      "dm.energy_batteria_caricata_mese": month.batteryCharged,
      "dm.energy_batteria_usata_mese": month.batteryDischarged,
    };
    root.__DASHBOARDMODERN_RUNTIME_REGRESSION_GUARD_0150__.currentFlowText = Object.create(null);
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__?.merge?.(slots);
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

  async function saveEnergyEditor(button) {
    const editor = button.closest('[data-editor="energy"]') || doc.querySelector('[data-editor="energy"]');
    const store = dashboardStore();
    if (!editor || !store?.replaceSection) return false;
    const model = clone(store.getSection?.("energy") || {});
    editor.querySelectorAll('input[name*="."]').forEach((input) => {
      const [group, key] = clean(input.name).split(".");
      if (!group || !key) return;
      model[group] ||= {};
      model[group][key] = clean(input.value);
    });
    model.metadata = {
      ...(model.metadata || {}),
      semantics_version: 4,
      cumulative_statistics: true,
    };

    const actions = editor.querySelector("[data-energy-actions]");
    const status = actions?.querySelector("[data-energy-status]");
    if (actions) actions.dataset.state = "loading";
    button.disabled = true;
    if (status) status.textContent = copy("Salvataggio Energia…", "Saving Energy…");
    try {
      await store.replaceSection("energy", model);
      const runtime = root.__DASHBOARDMODERN_RUNTIME_0150__;
      if (runtime) runtime.pendingEnergy = {};
      root.DashboardModernRuntime0150?.broker?.cache?.clear?.();
      root.DashboardModernRuntime0150?.broker?.inflight?.clear?.();
      await root.DashboardModernRuntime0150?.refreshSelectedPeriod?.();
      applyCanonicalFlow();
      updateEnergyCounters();
      if (actions) actions.dataset.state = "success";
      if (status) {
        status.textContent = copy(
          "Energia salvata. I contatori totali sono applicati ai periodi Recorder.",
          "Energy saved. Total meters are applied to Recorder periods.",
        );
      }
      return true;
    } catch (error) {
      button.disabled = false;
      if (actions) actions.dataset.state = "error";
      if (status) status.textContent = `${copy("Salvataggio fallito", "Save failed")}: ${error.message}`;
      return false;
    }
  }

  function inferAlertGroup(details) {
    const text = clean(details?.querySelector("summary")?.textContent).toLowerCase();
    if (/apert|contact|door|window/.test(text)) return "win";
    if (/batter/.test(text)) return "batt";
    if (/luc|light/.test(text)) return "luci";
    if (/clima|climate/.test(text)) return "clima";
    if (/riscald|heating/.test(text)) return "risc";
    return clean(details?.dataset?.alertGroup);
  }

  function synchronizeAlertRegistries() {
    const groups = lexical("GRUPPI_MONITORAGGIO", {}) || {};
    const names = lexical("AVVISI_NAMES", {}) || {};
    const extras = readJson("cd_gruppi_extra", {});
    const removed = readJson("cd_gruppi_removed", {});
    const extraNames = readJson("cd_avvisi_names_extra", {});
    const groupNames = new Set([...Object.keys(groups), ...Object.keys(extras), ...Object.keys(removed)]);
    groupNames.forEach((group) => {
      const blocked = new Set(Array.isArray(removed[group]) ? removed[group] : []);
      const merged = [
        ...(Array.isArray(groups[group]) ? groups[group] : []),
        ...(Array.isArray(extras[group]) ? extras[group] : []),
      ].filter((entity, index, all) => entity && !blocked.has(entity) && all.indexOf(entity) === index);
      if (Array.isArray(groups[group])) groups[group].splice(0, groups[group].length, ...merged);
      else groups[group] = merged;
    });
    Object.assign(names, extraNames);
    return { groups, names, extras, removed, extraNames };
  }

  function alertName(entity) {
    const configured = readJson("cd_avvisi_names_extra", {})[entity];
    if (configured) return configured;
    const states = { ...(lexical("_RAW_STATES", {}) || {}), ...(lexical("STATES", {}) || {}) };
    return clean(states[entity]?.attributes?.friendly_name) || entity;
  }

  function decorateAlertEditor() {
    const body = doc.getElementById("ed-body");
    const active = doc.querySelector('.ed-tab.active[data-tab="avvisi"]');
    if (!body || (!active && !body.querySelector("#ed-avv-ent"))) return false;
    synchronizeAlertRegistries();
    body.querySelectorAll("[data-dm-final-alert-list],[data-dm-standard-alert-list]").forEach((node) => node.remove());
    body.querySelectorAll("details.ed-acc").forEach((details) => {
      const group = inferAlertGroup(details);
      if (!group) return;
      details.dataset.dmAlertGroup = group;
      details.open = true;
      details.querySelectorAll(".ed-row").forEach((row) => {
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
          const remove = [...row.querySelectorAll("button")].find((button) => /🗑|elimina|delete/i.test(clean(button.textContent) + clean(button.title)));
          if (remove) remove.before(edit);
          else row.append(edit);
        }
        edit.dataset.alertGroup = group;
        edit.dataset.alertEntity = entity;
        edit.title = copy("Modifica", "Edit");
        edit.setAttribute("aria-label", edit.title);
      });
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
    const save = doc.querySelector('button[onclick="edAddAvviso()"]');
    if (save) save.textContent = copy("💾 Salva modifiche", "💾 Save changes");
    if (save && !doc.querySelector("[data-alert-cancel-0151]")) {
      const cancel = doc.createElement("button");
      cancel.type = "button";
      cancel.className = "ed-btn-secondary dm-alert-cancel-0151";
      cancel.dataset.alertCancel0151 = "";
      cancel.textContent = copy("Annulla", "Cancel");
      save.after(cancel);
    }
    return true;
  }

  function saveAlertEdit() {
    if (!state.alertEdit) return false;
    const previous = state.alertEdit;
    const group = clean(doc.getElementById("ed-avv-grp")?.value) || previous.group;
    const entity = clean(doc.getElementById("ed-avv-ent")?.value);
    const name = clean(doc.getElementById("ed-avv-name")?.value);
    if (!entity.includes(".")) {
      root.alert?.(copy("Inserisci un'entità valida.", "Enter a valid entity."));
      return true;
    }
    const extras = readJson("cd_gruppi_extra", {});
    const removed = readJson("cd_gruppi_removed", {});
    const names = readJson("cd_avvisi_names_extra", {});
    if (Array.isArray(extras[previous.group]) && extras[previous.group].includes(previous.entity)) {
      extras[previous.group] = extras[previous.group].filter((item) => item !== previous.entity);
      if (!extras[previous.group].length) delete extras[previous.group];
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
    syncStorage();
    state.alertEdit = null;
    synchronizeAlertRegistries();
    refreshAlerts(true);
    root.editorSwitch?.("avvisi");
    root.edToast?.(copy("Avviso aggiornato", "Alert updated"));
    return true;
  }

  function refreshAlerts(forceRender = false) {
    synchronizeAlertRegistries();
    const renderers = [
      root.updateAlerts,
      root.renderAlerts,
      root.updateAvvisi,
      root.renderAvvisi,
      root.buildAlerts,
    ].filter((fn) => typeof fn === "function");
    if (renderers.length) {
      [...new Set(renderers)].forEach((renderer) => {
        try {
          renderer.call(root);
        } catch (_error) {}
      });
    } else if (forceRender || !state.alertScheduled) {
      try {
        root.render?.();
      } catch (_error) {}
    }
    return true;
  }

  function scheduleAlertRefresh() {
    if (state.alertScheduled) return;
    state.alertScheduled = true;
    root.setTimeout?.(() => {
      state.alertScheduled = false;
      refreshAlerts();
      decorateAlertEditor();
    }, 60);
  }

  function installBrokerAlertHook() {
    const broker = root.DashboardModernRuntime0150?.broker;
    const current = broker?.ingestState;
    if (!broker || typeof current !== "function" || current === state.brokerIngest) return false;
    function ingestState0151() {
      const result = current.apply(this, arguments);
      scheduleAlertRefresh();
      return result;
    }
    ingestState0151.__dmRealHa0151 = true;
    ingestState0151.__dmPrevious = current;
    state.brokerIngest = ingestState0151;
    broker.ingestState = ingestState0151;
    return true;
  }

  function installDispatchGate() {
    const current = root.dispatchEvent;
    if (typeof current !== "function" || current === state.dispatch) return false;
    function dispatch0151(event) {
      if (event?.type === "dashboardmodern:energy-periods-0154") {
        root.queueMicrotask?.(() => applyCanonicalFlow());
        return true;
      }
      const result = current.call(this, event);
      if (event?.type === "dashboardmodern:period-bundle") {
        root.queueMicrotask?.(() => applyCanonicalFlow(event.detail));
      }
      return result;
    }
    dispatch0151.__dmRealHa0151 = true;
    dispatch0151.__dmPrevious = current;
    state.dispatch = dispatch0151;
    root.dispatchEvent = dispatch0151;
    return true;
  }

  function wrapFunction(name) {
    const current = root[name];
    if (typeof current !== "function" || state.wrapped.has(current) || current.__dmRealHa0151) return false;
    function wrapped0151() {
      if (name === "editorSwitch" && clean(arguments[0]) === "avvisi") synchronizeAlertRegistries();
      const result = current.apply(this, arguments);
      const finish = () => scheduleApply();
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    wrapped0151.__dmRealHa0151 = true;
    wrapped0151.__dmPrevious = current;
    state.wrapped.add(current);
    state.wrapped.add(wrapped0151);
    root[name] = wrapped0151;
    return true;
  }

  function wrapOwnerApply() {
    const owner = root.__DASHBOARDMODERN_RELEASE_OWNER_0150__;
    const current = owner?.apply;
    if (!owner || typeof current !== "function" || current === state.ownerApply) return false;
    function ownerApply0151() {
      const result = current.apply(this, arguments);
      root.queueMicrotask?.(applyAll);
      return result;
    }
    ownerApply0151.__dmRealHa0151 = true;
    ownerApply0151.__dmPrevious = current;
    state.ownerApply = ownerApply0151;
    owner.apply = ownerApply0151;
    return true;
  }

  function installHooks() {
    [
      "renderApplianceSection",
      "renderTemperature",
      "buildTempCards",
      "renderEnergy",
      "renderEnergyDashboard",
      "switchEnergyView",
      "editorSwitch",
    ].forEach(wrapFunction);
    wrapOwnerApply();
    installDispatchGate();
    installBrokerAlertHook();
  }

  function applyAll() {
    if (state.applying) return;
    state.applying = true;
    try {
      installStyles();
      installHooks();
      synchronizeAlertRegistries();
      applyDashboardPalette();
      removeTemperatureFlames();
      applyCanonicalFlow();
      updateEnergyCounters();
      decorateAlertEditor();
      const guard = root.__DASHBOARDMODERN_RUNTIME_REGRESSION_GUARD_0150__;
      if (guard) guard.currentFlowText = Object.create(null);
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
      saveEnergyEditor(energySave).catch((error) => root.console?.warn?.("Energy save 0.15.1", error));
      return;
    }
    const alertEdit = event.target?.closest?.("[data-alert-edit-0151]");
    if (alertEdit) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startAlertEdit(alertEdit);
      return;
    }
    const alertCancel = event.target?.closest?.("[data-alert-cancel-0151]");
    if (alertCancel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.alertEdit = null;
      root.editorSwitch?.("avvisi");
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
  }

  doc.addEventListener("click", handleClick, true);
  doc.addEventListener("input", (event) => {
    if (event.target?.closest?.('[data-editor="energy"]')) updateEnergyCounters();
  }, true);
  doc.addEventListener("change", (event) => {
    if (event.target?.closest?.('[data-editor="energy"]')) updateEnergyCounters();
    scheduleApply();
  }, true);
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    applyCanonicalFlow(event.detail);
    scheduleApply();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleApply);
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    refreshAlerts(true);
    scheduleApply();
  });
  root.addEventListener?.("pageshow", () => {
    refreshAlerts(true);
    scheduleApply();
  });

  state.apply = applyAll;
  state.applyCanonicalFlow = applyCanonicalFlow;
  state.refreshAlerts = refreshAlerts;
  state.synchronizeAlertRegistries = synchronizeAlertRegistries;

  installStyles();
  installHooks();
  synchronizeAlertRegistries();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", applyAll, { once: true });
  else applyAll();
  [80, 260, 700, 1400].forEach((delay) => root.setTimeout?.(applyAll, delay));
})(globalThis);
