/* DashboardModern configuration/runtime fixes shared by the Italian and English builds. */
(() => {
  "use strict";

  const EN = document.documentElement.lang.toLowerCase().startsWith("en");
  const text = EN
    ? { off: "Off", on: "On", running: "Running", total: "Total", daily: "Daily consumption", monthly: "Monthly consumption" }
    : { off: "Spento", on: "Acceso", running: "In funzione", total: "Totale", daily: "Consumo giornaliero", monthly: "Consumo mensile" };
  const validEntity = (value) => /^[a-z_]+\.[a-z0-9_]+$/i.test(String(value || "").trim());
  const states = () => (typeof STATES === "undefined" ? {} : STATES);

  function persist(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    try { window.cdMarkDirty?.(); window.cdSyncPush?.(); } catch (_) {}
  }

  function migrateEnergyObject(value) {
    if (Array.isArray(value)) return value.map(migrateEnergyObject);
    if (!value || typeof value !== "object") return value;
    const out = {};
    Object.entries(value).forEach(([key, child]) => {
      const normalized = /^(annual|yearly|anno|annuale)$/i.test(key) ? "total" : key;
      if (normalized !== "total" || out.total == null) out[normalized] = migrateEnergyObject(child);
    });
    return out;
  }

  function migrateEnergyConfiguration() {
    ["cd_energy_views", "cd_devices"].forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const oldValue = JSON.parse(raw);
        const newValue = migrateEnergyObject(oldValue);
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) persist(key, newValue);
      } catch (_) {}
    });
  }

  // Persistent day/month baselines for cumulative energy sensors. Explicit
  // period sensors always win; this helper is only the missing-sensor fallback.
  window.dmEnergyDelta = function dmEnergyDelta(totalEntity, explicitEntity, period) {
    const explicit = explicitEntity && states()[explicitEntity];
    if (explicit && !["unknown", "unavailable", "null"].includes(String(explicit.state).toLowerCase())) {
      const n = Number(explicit.state);
      if (Number.isFinite(n)) return { value: n, unit: explicit.attributes?.unit_of_measurement || "" };
    }
    const state = totalEntity && states()[totalEntity];
    const current = Number(state?.state);
    if (!Number.isFinite(current) || ["unknown", "unavailable", "null"].includes(String(state?.state).toLowerCase())) return null;
    const now = new Date();
    const stamp = period === "month"
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const key = `cd_energy_baseline:${totalEntity}:${period}`;
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { saved = null; }
    const unit = state.attributes?.unit_of_measurement || saved?.unit || "";
    if (!saved || saved.stamp !== stamp || !Number.isFinite(saved.value) || current < saved.value) {
      saved = { stamp, value: current, unit };
      localStorage.setItem(key, JSON.stringify(saved));
    }
    return { value: Math.max(0, current - saved.value), unit };
  };

  const sectionStores = {
    security: ["cd_cameras"], appliances: ["cd_appliances"], clima: ["cd_clima_units"],
    temp: ["cd_stanze"], tapparelle: ["cd_tapparelle"], irrigazione: ["cd_irrigazione"],
    piscina: ["cd_piscina"], ev: ["cd_ev_cars"], energy: ["cd_energy_views"]
  };
  function containsEntity(value) {
    if (typeof value === "string") return validEntity(value);
    if (Array.isArray(value)) return value.some(containsEntity);
    return value && typeof value === "object" && Object.values(value).some(containsEntity);
  }
  function revealConfiguredSections() {
    let sections;
    try { sections = JSON.parse(localStorage.getItem("cd_sections") || "{}"); } catch (_) { sections = {}; }
    let changed = false;
    Object.entries(sectionStores).forEach(([section, keys]) => {
      const populated = keys.some((key) => {
        try { return containsEntity(JSON.parse(localStorage.getItem(key) || "null")); } catch (_) { return false; }
      });
      if (populated && sections[section] === false) { sections[section] = true; changed = true; }
    });
    if (changed) persist("cd_sections", sections);
    try { window.cdApplyNavVis?.(); window.render?.(); } catch (_) {}
  }

  function invalidateSecurity() {
    const grid = document.getElementById("cam-grid");
    if (grid) grid._sig = "";
    try { window.buildCamCards?.(); window.refreshCameras?.(); window.render?.(); } catch (_) {}
  }

  let cameraEditIndex = null;
  function editCamera(index) {
    const camera = window.getCameras?.()[index];
    if (!camera) return;
    cameraEditIndex = index;
    [["ed-cam-name", camera.name], ["ed-cam-ent", camera.entity], ["ed-cam-stream", camera.stream]].forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value || "";
    });
    const room = document.getElementById("ed-cam-room");
    if (room) room.value = camera.room || "";
    document.getElementById("ed-cam-ent")?.focus();
  }

  function enhanceCameraEditor(root = document) {
    const entityInput = root.querySelector("#ed-cam-ent");
    const details = entityInput?.closest("details");
    if (!details) return;
    details.querySelectorAll(".ed-list > .ed-row").forEach((row, index) => {
      if (row.querySelector(".dm-camera-edit")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dm-camera-edit";
      button.textContent = "✏️";
      button.title = EN ? "Edit camera" : "Modifica telecamera";
      button.addEventListener("click", () => editCamera(index));
      row.insertBefore(button, row.querySelector(".ed-del"));
    });
  }

  function enhanceEntityFields(root = document) {
    root.querySelectorAll("input.ed-input").forEach((input) => {
      const hint = `${input.id} ${input.placeholder || ""} ${input.dataset.ref || ""}`;
      if (!/(entity|entità|sensor\.|switch\.|light\.|camera\.|climate\.|cover\.|weather\.|dm\.)/i.test(hint)) return;
      const parent = input.parentElement;
      if (!parent || parent.querySelector(":scope > .dm-entity-picker")) return;
      if (getComputedStyle(parent).display !== "flex") {
        const wrap = document.createElement("div");
        wrap.className = "dm-entity-field";
        parent.insertBefore(wrap, input);
        wrap.appendChild(input);
      }
      const host = input.parentElement;
      if (host.querySelector(":scope > button") || host.querySelector(":scope > .dm-entity-picker")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dm-entity-picker";
      button.textContent = "🔍";
      button.title = EN ? "Choose entity" : "Scegli entità";
      button.addEventListener("click", () => window.wzPickEntity?.(input));
      host.appendChild(button);
    });
    enhanceCameraEditor(root);
  }

  function applianceStatus(appliance) {
    const entities = [].concat(appliance?.entities || [], appliance?.power || [], appliance?.power_entity || [], appliance?.switch || [], appliance?.switch_entity || [])
      .map((entry) => typeof entry === "string" ? entry : entry?.entity).filter(validEntity);
    let watts = null;
    let powered = false;
    entities.forEach((entity) => {
      const state = states()[entity];
      if (!state) return;
      const raw = Number(state.state);
      const unit = String(state.attributes?.unit_of_measurement || "").toLowerCase();
      if (Number.isFinite(raw) && /(^w$|kw|watt)/.test(unit)) watts = Math.max(watts ?? 0, unit === "kw" ? raw * 1000 : raw);
      if (["on", "playing", "heat", "cool", "home", "open"].includes(String(state.state).toLowerCase())) powered = true;
    });
    const run = Number.isFinite(Number(appliance?.threshold_run)) ? Number(appliance.threshold_run) : 5;
    const standby = Number.isFinite(Number(appliance?.threshold_standby)) ? Math.max(0, Number(appliance.threshold_standby)) : 0.5;
    if (watts != null && watts >= run) return { label: text.running, cls: "run", w: watts };
    if (powered || (watts != null && watts >= standby)) return { label: text.on, cls: "on", w: watts };
    return { label: text.off, cls: "off", w: watts };
  }

  function applianceCard(appliance) {
    const status = applianceStatus(appliance);
    const name = String(appliance?.name || "Appliance").replace(/[<>]/g, "");
    const power = status.w == null ? "—" : `${Math.round(status.w * 10) / 10} W`;
    const program = appliance?.program || appliance?.cycle || "";
    const icon = typeof cdApplianceIcon === "function" ? cdApplianceIcon(appliance?.icon, 88) : "⚙️";
    const history = typeof cdApplEntity === "function" ? cdApplEntity(appliance, ["history", "history_entity", "power", "power_entity"]) : "";
    return `<div class="appl-wide-card dm-appliance-card ${status.cls}">
      <div class="dm-appliance-art">${icon}</div>
      <div class="dm-appliance-info"><div class="appl-wide-name">${name}</div><span class="appl-st ${status.cls}">${status.label}</span>
      ${program ? `<div class="dm-appliance-program">${String(program).replace(/[<>]/g, "")}</div>` : ""}
      <div class="dm-appliance-power"><small>${EN ? "Current consumption" : "Consumo attuale"}</small><strong>${power}</strong></div></div>
      <button class="dm-appliance-history ${history ? "" : "disabled"}" ${history ? `onclick="apriStorico(event,'${history}','${name.replace(/'/g, "&#39;")}')"` : "disabled"} aria-label="${EN ? "History" : "Storico"}">
        <svg viewBox="0 0 240 36" preserveAspectRatio="none"><path d="M0 27 C25 25 35 29 58 20 S95 28 118 17 S158 21 178 12 S216 17 240 7"/></svg>
      </button></div>`;
  }

  function install() {
    migrateEnergyConfiguration();
    revealConfiguredSections();
    window.cdApplStatus = applianceStatus;
    window.cdApplMainCard = applianceCard;

    window.dmEditCamera = editCamera;
    window.edAddCamera = function () {
      const name = document.getElementById("ed-cam-name")?.value.trim() || "";
      const entity = document.getElementById("ed-cam-ent")?.value.trim() || "";
      const stream = document.getElementById("ed-cam-stream")?.value.trim() || "";
      const room = document.getElementById("ed-cam-room")?.value || "";
      if (!name || !validEntity(entity) || !entity.startsWith("camera.")) {
        alert(EN ? "Enter a name and a valid camera entity" : "Inserisci nome ed entità camera valida");
        return;
      }
      const cameras = (window.getCameras?.() || []).slice();
      const camera = { name, entity, room };
      if (stream) camera.stream = stream;
      if (cameraEditIndex == null) cameras.push(camera); else cameras[cameraEditIndex] = camera;
      cameraEditIndex = null;
      persist("cd_cameras", cameras);
      revealConfiguredSections();
      invalidateSecurity();
      window.editorSwitch?.("sezioni");
    };
    window.edDelCamera = function (index) {
      const cameras = (window.getCameras?.() || []).slice();
      if (index < 0 || index >= cameras.length) return;
      cameras.splice(index, 1);
      cameraEditIndex = null;
      persist("cd_cameras", cameras);
      invalidateSecurity();
      window.editorSwitch?.("sezioni");
    };

    const observer = new MutationObserver(() => enhanceEntityFields());
    observer.observe(document.body, { childList: true, subtree: true });
    enhanceEntityFields();
    document.addEventListener("click", (event) => {
      if (event.target.closest(".ed-btn-add,.ed-del")) setTimeout(() => { revealConfiguredSections(); enhanceEntityFields(); invalidateSecurity(); }, 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
