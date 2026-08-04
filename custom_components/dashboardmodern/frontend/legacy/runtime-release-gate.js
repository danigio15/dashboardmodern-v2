/* DashboardModern 0.15.0 — release gate for period and editor contracts. */
(function installReleaseGate0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RELEASE_GATE_0150__";
  if (root[KEY]?.installed || !root.document) return;
  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    currentMonth: Object.create(null),
    savingTemperature: false,
  });

  const MONTH_SLOTS = Object.freeze({
    "dm.energy_consumo_casa_mese": "house",
    "dm.energy_produzione_solare_mese": "solar",
    "dm.energy_rete_acquistata_mese": "gridImport",
    "dm.energy_rete_venduta_mese": "gridExport",
    "dm.energy_batteria_caricata_mese": "batteryCharged",
    "dm.energy_batteria_usata_mese": "batteryDischarged",
  });
  const clean = (value) => String(value ?? "").trim();
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const store = () => root.DashboardModernModules?.store || null;

  function publishReadiness() {
    root.__DASHBOARDMODERN_MEDIA_STYLE_LOCK_DISABLED_0153__ = true;
    root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ = {
      ...(root.__DASHBOARDMODERN_ENERGY_REPORT_MEDIA_FIX__ || {}),
      installed: true,
      version: "0.15.0",
      observer: { disabled: true },
    };
    root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ = {
      ...(root.__DASHBOARDMODERN_RELEASE_0154_ARTWORK_LOCK__ || {}),
      installed: true,
      version: "0.15.0",
      observer: null,
      observerVersion: 3,
    };
  }

  function installStyles() {
    if (doc.getElementById("dm-release-gate-0150")) return;
    const style = doc.createElement("style");
    style.id = "dm-release-gate-0150";
    style.textContent = `
      #editor-modal [data-temperature-form] label:has(#dm-temperature-icon){display:none!important}
      #page-appliances-main img.dm-appliance-image-0153[src^="data:image"]{object-fit:contain!important}
      #page-appliances-main img.dm-appliance-image-0153:not([src^="data:image"]){object-fit:cover!important}
    `;
    doc.head.append(style);
  }

  function isCurrent(bundle) {
    if (!bundle?.period) return false;
    const now = new Date();
    return (
      Number(bundle.period.month) === now.getMonth() + 1 &&
      Number(bundle.period.year) === now.getFullYear()
    );
  }

  function lexicalPeriod() {
    try {
      return root.eval?.("typeof CD_PERIOD !== 'undefined' ? CD_PERIOD : null") || null;
    } catch (_error) {
      return null;
    }
  }

  function rememberCurrent(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    if (!isCurrent(bundle) || !bundle?.month) return false;
    Object.entries(MONTH_SLOTS).forEach(([slot, key]) => {
      const value = Number(bundle.month[key]);
      if (Number.isFinite(value)) state.currentMonth[slot] = Math.max(0, value);
    });
    restoreCurrent();
    return true;
  }

  function restoreCurrent() {
    if (!Object.keys(state.currentMonth).length) return false;
    root.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.merge?.(state.currentMonth);
    const registries = [root.CD_PERIOD, lexicalPeriod()].filter(Boolean);
    [...new Set(registries)].forEach((registry) => {
      Object.entries(state.currentMonth).forEach(([slot, value]) => {
        try {
          registry[slot] = value;
        } catch (_error) {}
      });
    });
    return true;
  }

  function onBundle(bundle) {
    if (isCurrent(bundle)) {
      rememberCurrent(bundle);
      return;
    }
    root.queueMicrotask?.(restoreCurrent);
    [20, 60, 140, 300, 620].forEach((delay) => root.setTimeout?.(restoreCurrent, delay));
  }

  function normalizeTemperature() {
    const form = doc.querySelector("#editor-modal [data-temperature-form]");
    if (!form) return false;
    const input = form.querySelector("#dm-temperature-icon");
    if (input) {
      input.type = "hidden";
      input.hidden = true;
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
      if (!clean(input.value)) input.value = "mdi:home";
      const field =
        input.closest("label.ed-slot") ||
        input.closest("label") ||
        input.closest("[data-icon-field]");
      if (field && field !== form) {
        input.remove();
        field.remove();
        form.append(input);
      }
    }
    form.querySelectorAll("label.ed-slot").forEach((label) => {
      if (!/(^|\s)(Simbolo|Icon)(\s|$)/i.test(clean(label.textContent))) return;
      if (label.querySelector("[data-entity-input]")) return;
      label.remove();
    });
    return true;
  }

  function normalizeCards() {
    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card) => {
      card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
      card.querySelectorAll(".appl-mini").forEach((node) => {
        const original = clean(node.textContent);
        if (!/kWh/i.test(original)) return;
        const value = clean(original.replace(/🔋/gu, "").replace(/^(Totale|Total)\s*/i, ""));
        const next = `${english() ? "Total" : "Totale"} ${value}`;
        if (node.textContent !== next) node.textContent = next;
      });
      card.querySelectorAll("img.dm-appliance-image").forEach((image) => {
        image.classList.add("dm-appliance-image-0153");
        image.style.objectFit = /^data:image\//i.test(image.getAttribute("src") || "")
          ? "contain"
          : "cover";
      });
    });
  }

  function apply() {
    publishReadiness();
    installStyles();
    normalizeTemperature();
    normalizeCards();
  }
  state.apply = apply;

  async function saveTemperature() {
    if (state.savingTemperature) return;
    const dashboardStore = store();
    const roomId = clean(doc.getElementById("dm-temperature-room")?.value);
    const temp = clean(doc.getElementById("ed-pl-temp")?.value);
    const hum = clean(doc.getElementById("dm-humidity-new")?.value);
    if (!roomId || !dashboardStore?.updateItem) return;
    state.savingTemperature = true;
    try {
      await dashboardStore.updateItem("rooms", roomId, { temp, hum });
      root.renderTemperature?.();
      root.buildTempCards?.();
      root.editorSwitch?.("sez7");
    } catch (error) {
      root.console?.warn?.("[DashboardModern 0.15.0] temperature save", error);
    } finally {
      state.savingTemperature = false;
    }
  }

  doc.addEventListener(
    "click",
    (event) => {
      const submit = event.target?.closest?.("[data-temperature-submit]");
      if (submit) {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveTemperature();
        return;
      }
      root.queueMicrotask?.(apply);
    },
    true,
  );
  doc.addEventListener(
    "submit",
    (event) => {
      if (!event.target?.matches?.("[data-temperature-form]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      saveTemperature();
    },
    true,
  );

  function wrapAfter(name, after = apply) {
    const current = root[name];
    if (typeof current !== "function" || current.__dmReleaseGateAfter) return false;
    function releaseGateAfter0150(...args) {
      const result = current.apply(this, args);
      const finish = () => root.queueMicrotask?.(after);
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    releaseGateAfter0150.__dmReleaseGateAfter = true;
    releaseGateAfter0150.__dmPrevious = current;
    root[name] = releaseGateAfter0150;
    return true;
  }

  function settle() {
    [
      "editorSwitch",
      "renderApplianceSection",
      "renderAppliances",
      "renderTemperature",
      "buildTempCards",
      "renderEnergy",
      "renderEnergyDashboard",
      "renderEdDeviceList",
    ].forEach((name) => wrapAfter(name));
    apply();
    rememberCurrent();
  }

  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    onBundle(event.detail);
    root.queueMicrotask?.(apply);
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(settle));

  publishReadiness();
  installStyles();
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else root.queueMicrotask?.(settle);
  [50, 160, 360, 760].forEach((delay) => root.setTimeout?.(settle, delay));
})(globalThis);
