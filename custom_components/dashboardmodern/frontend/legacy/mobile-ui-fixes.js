/* DashboardModern 0.15.4 — bounded compatibility helpers and editor completion. */

export function isGeneratedRoomName(value = "") {
  return /^room[-_][a-z0-9]{6,}$/i.test(String(value).trim());
}

export function inferApplianceEntity(device = {}, states = {}, kind = "energy") {
  const candidates = [
    device[`${kind}_entity`],
    device[`${kind}_today`],
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    ...(device.entities || []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  const expected = kind === "power" ? /^(w|kw)$/i : /^(wh|kwh|mwh)$/i;
  const named =
    kind === "power"
      ? /power|potenza|watt/i
      : /energy|energia|kwh|consum|total|totale|mese|month/i;
  return (
    candidates.find((entityId) =>
      expected.test(String(states?.[entityId]?.attributes?.unit_of_measurement || "").trim()),
    ) ||
    candidates.find((entityId) => named.test(entityId)) ||
    ""
  );
}

export function normalizeVehiclePath(value = "") {
  let path = String(value || "").trim().replaceAll("\\", "/");
  if (path.startsWith("/loca/")) path = `/local/${path.slice(6)}`;
  else if (path.startsWith("loca/")) path = `/local/${path.slice(5)}`;
  else if (path.startsWith("/config/www/")) path = `/local/${path.slice(12)}`;
  else if (path.startsWith("config/www/")) path = `/local/${path.slice(11)}`;
  else if (path.startsWith("www/")) path = `/local/${path.slice(4)}`;
  else if (path.startsWith("local/")) path = `/${path}`;
  return path.replace(/^\/local\/\/+/, "/local/");
}

const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_MOBILE_FOLLOWUP__";
const state = (root[KEY] ||= {
  installed: true,
  version: "0.15.4",
  timer: 0,
  attempts: 0,
  listeners: false,
  wrappers: new Set(),
  editing: null,
});

const clean = (value) => String(value ?? "").trim();
const english = () => {
  const lang = clean(doc?.documentElement?.lang).toLowerCase();
  return lang.startsWith("en") || /dashboard-en\.html$/i.test(root.location?.pathname || "");
};
const read = (key, fallback) => {
  try {
    return JSON.parse(root.localStorage?.getItem(key) || "") ?? fallback;
  } catch (_error) {
    return fallback;
  }
};
const write = (key, value) => {
  const serialized = JSON.stringify(value);
  if (root.localStorage?.getItem(key) === serialized) return false;
  root.localStorage?.setItem(key, serialized);
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
  return true;
};

function installStyles() {
  if (!doc?.head || doc.getElementById("dm-mobile-contracts-0154")) return;
  const style = doc.createElement("style");
  style.id = "dm-mobile-contracts-0154";
  style.textContent = `
    #ev-mod-car-img[data-ev-failed="1"],#ev-new-car-img[data-ev-failed="1"],
    #ev-mod-car-img[data-ev-image-error],#ev-new-car-img[data-ev-image-error]{display:none!important}

    #temp-grid .temp-comfort-badge{
      display:inline-flex!important;align-items:center!important;justify-content:center!important;
      min-width:64px!important;max-width:100%!important;height:auto!important;padding:4px 9px!important;
      border-radius:999px!important;font-size:10px!important;line-height:1.1!important;
      font-weight:900!important;letter-spacing:.45px!important;text-transform:uppercase!important
    }
    #temp-grid .temp-comfort-badge.dm-temp-cold{background:rgba(37,99,235,.14)!important;color:#1d4ed8!important}
    #temp-grid .temp-comfort-badge.dm-temp-cool{background:rgba(14,165,233,.14)!important;color:#0369a1!important}
    #temp-grid .temp-comfort-badge.dm-temp-comfort{background:rgba(22,163,74,.14)!important;color:#15803d!important}
    #temp-grid .temp-comfort-badge.dm-temp-warm{background:rgba(245,158,11,.17)!important;color:#b45309!important}
    #temp-grid .temp-comfort-badge.dm-temp-hot{background:rgba(239,68,68,.15)!important;color:#b91c1c!important}
    #temp-grid .temp-comfort-badge.dm-temp-unavailable{background:rgba(100,116,139,.14)!important;color:var(--text-dim,#64748b)!important}

    #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{
      background:var(--card-bg,var(--card-background-color,#fff))!important;
      color:var(--text,var(--primary-text-color,#0f172a))!important;
      border-color:var(--card-border,var(--divider-color,#dbe4ee))!important
    }
    #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name,
    #page-appliances-main .appl-wide-title,#appl-grid-overview .appl-wide-title,
    #page-appliances-main .appl-wide-card strong,#appl-grid-overview .appl-wide-card strong{
      color:var(--text,var(--primary-text-color,#0f172a))!important;opacity:1!important
    }
    #page-appliances-main .appl-wide-cat,#appl-grid-overview .appl-wide-cat,
    #page-appliances-main .appl-wide-stat,#appl-grid-overview .appl-wide-stat,
    #page-appliances-main .appl-wide-card small,#appl-grid-overview .appl-wide-card small{
      color:var(--text-dim,var(--secondary-text-color,#475569))!important;opacity:1!important
    }
    #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .appl-visual{
      background:color-mix(in srgb,var(--accent,#0ea5e9) 13%,var(--card-bg,var(--card-background-color,#fff)))!important
    }
    html[data-theme="dark"] #page-appliances-main .appl-wide-card,
    html[data-theme="dark"] #appl-grid-overview .appl-wide-card,
    body.dark #page-appliances-main .appl-wide-card,body.dark #appl-grid-overview .appl-wide-card{
      background:var(--card-bg,var(--card-background-color,#162033))!important;
      color:var(--text,var(--primary-text-color,#f8fafc))!important
    }
    html[data-theme="dark"] #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    html[data-theme="dark"] #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    body.dark #page-appliances-main .appl-wide-card[data-dm-art-style="panel"] .appl-visual,
    body.dark #appl-grid-overview .appl-wide-card[data-dm-art-style="panel"] .appl-visual{
      background:color-mix(in srgb,var(--accent,#38bdf8) 20%,var(--card-bg,var(--card-background-color,#162033)))!important
    }

    #editor-modal .dm-energy-total-help,#editor-modal .dm-energy-total-overview{
      display:block;margin-top:7px;padding:9px 11px;border-radius:12px;
      background:color-mix(in srgb,var(--accent,#0ea5e9) 9%,var(--surface-2,var(--card-bg,#fff)));
      color:var(--text-dim,var(--secondary-text-color,#475569));font-size:11px;line-height:1.45
    }
    #editor-modal .dm-energy-total-overview{margin:0 0 12px;border:1px solid color-mix(in srgb,var(--accent,#0ea5e9) 22%,transparent)}
    #editor-modal [data-dm-total-warning="same-period"] .dm-energy-total-help{background:rgba(245,158,11,.13);color:#92400e}

    #editor-modal [data-energy-panel="report"]{--dm-report-gap:10px}
    #editor-modal [data-energy-panel="report"]>.ed-intro{margin-bottom:12px}
    #editor-modal [data-energy-panel="report"] .dm-report-row{
      display:grid!important;grid-template-columns:minmax(110px,.72fr) minmax(150px,1.35fr) minmax(104px,.58fr) minmax(220px,2fr) auto!important;
      gap:var(--dm-report-gap)!important;align-items:end!important;padding:14px!important;
      border:1px solid var(--card-border,var(--divider-color,#dbe4ee))!important;
      border-radius:16px!important;background:var(--card-bg,var(--card-background-color,#fff))!important
    }
    #editor-modal [data-energy-panel="report"] .dm-report-row>label{align-self:center;font-weight:800;color:var(--text,var(--primary-text-color,#0f172a))}
    #editor-modal [data-energy-panel="report"] .dm-report-row .dm-entity-field{margin:0!important;min-width:0}
    #editor-modal [data-energy-panel="report"] .dm-report-row>span:last-of-type{display:flex;gap:5px;align-self:center}
    #editor-modal [data-energy-panel="report"] [data-report-up],
    #editor-modal [data-energy-panel="report"] [data-report-down],
    #editor-modal [data-energy-panel="report"] [data-report-delete]{
      width:36px;height:36px;border:0;border-radius:10px;cursor:pointer;
      background:var(--surface-3,#eef3f8);color:var(--text,var(--primary-text-color,#0f172a));font-weight:900
    }
    #editor-modal .dm-report-history-help{grid-column:1/-1;margin-top:-2px;color:var(--text-dim,var(--secondary-text-color,#64748b));font-size:11px;line-height:1.4}
    #editor-modal .dm-report-row[data-history-valid="false"] .dm-report-history-help{color:#b45309;font-weight:800}

    #editor-modal .dm-edit-existing{background:rgba(14,165,233,.13)!important;color:#0369a1!important}
    #editor-modal .dm-edit-cancel{width:100%;margin-top:7px;background:var(--surface-3,#e8eef5)!important;color:var(--text,#0f172a)!important}
    #editor-modal [data-dm-editing="true"]{outline:2px solid color-mix(in srgb,var(--accent,#0ea5e9) 45%,transparent);outline-offset:2px}

    @media(max-width:900px){
      #editor-modal [data-energy-panel="report"] .dm-report-row{grid-template-columns:1fr 1fr!important;align-items:start!important}
      #editor-modal [data-energy-panel="report"] .dm-report-row .dm-entity-field,
      #editor-modal [data-energy-panel="report"] .dm-report-history-help{grid-column:1/-1}
    }
    @media(max-width:560px){#editor-modal [data-energy-panel="report"] .dm-report-row{grid-template-columns:1fr!important}.dm-report-row>*{grid-column:1!important}}
  `;
  doc.head.append(style);
}

function temperatureStatus(value) {
  if (!Number.isFinite(value)) return { key: "unavailable", it: "Non disponibile", en: "Unavailable" };
  if (value < 16) return { key: "cold", it: "Freddo", en: "Cold" };
  if (value < 19) return { key: "cool", it: "Fresco", en: "Cool" };
  if (value <= 24) return { key: "comfort", it: "Comfort", en: "Comfort" };
  if (value <= 27) return { key: "warm", it: "Tiepido", en: "Warm" };
  return { key: "hot", it: "Caldo", en: "Hot" };
}

function normalizeTemperatureStatus() {
  doc?.querySelectorAll("#temp-grid .temp-card").forEach((card) => {
    const text = clean(card.querySelector(".temp-value")?.textContent || card.querySelector("[id^='tv_']")?.textContent);
    const value = Number.parseFloat(text.replace(",", "."));
    const status = temperatureStatus(value);
    const badge = card.querySelector(".temp-comfort-badge,[id^='tc_']");
    if (!badge) return;
    badge.classList.remove(
      "dm-temp-cold",
      "dm-temp-cool",
      "dm-temp-comfort",
      "dm-temp-warm",
      "dm-temp-hot",
      "dm-temp-unavailable",
    );
    badge.classList.add(`dm-temp-${status.key}`);
    badge.textContent = english() ? status.en : status.it;
    badge.title = badge.textContent;
    badge.setAttribute("aria-label", badge.textContent);
  });
}

function energyHelpFor(group, key) {
  const subject = {
    house: english() ? "home consumption" : "consumo della casa",
    solar: english() ? "solar production" : "produzione fotovoltaica",
    grid: key.includes("export")
      ? english() ? "energy exported to the grid" : "energia immessa in rete"
      : english() ? "energy imported from the grid" : "energia prelevata dalla rete",
    battery: key.includes("discharged")
      ? english() ? "battery discharge" : "energia scaricata dalla batteria"
      : english() ? "battery charge" : "energia caricata nella batteria",
  }[group] || (english() ? "energy" : "energia");
  return english()
    ? `Use the lifetime cumulative kWh meter for ${subject}, with device_class: energy and state_class: total or total_increasing. DashboardModern calculates day, month, year and previous periods from Home Assistant Long-Term Statistics. Do not use a sensor that resets every month.`
    : `Usa il contatore cumulativo totale in kWh per ${subject}, con device_class: energy e state_class: total o total_increasing. DashboardModern calcola giorno, mese, anno e periodi precedenti dalle Long-Term Statistics di Home Assistant. Non usare un sensore che si azzera ogni mese.`;
}

function normalizeEnergyHelp() {
  const editor = doc?.querySelector('#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]');
  if (!editor) return;
  if (!editor.querySelector(".dm-energy-total-overview")) {
    const overview = doc.createElement("div");
    overview.className = "dm-energy-total-overview";
    overview.innerHTML = english()
      ? "<b>Total entities and historical periods</b><br>Period entities are optional. A lifetime total meter lets the Report derive the selected day, month and year, including previous months, from Recorder statistics."
      : "<b>Entità totali e periodi storici</b><br>Le entità giornaliera, mensile e annuale sono facoltative. Un contatore totale lifetime permette al Report di ricavare giorno, mese e anno selezionati, compresi i mesi precedenti, dalle statistiche del Recorder.";
    editor.prepend(overview);
  }
  editor.querySelectorAll("[data-dm-injected-energy-total='true']").forEach((field) => {
    const group = field.dataset.energyGroup || "";
    const key = field.dataset.energyKey || "";
    let help = field.querySelector(".dm-energy-total-help");
    if (!help) {
      help = doc.createElement("small");
      help.className = "dm-energy-total-help";
      field.append(help);
    }
    help.textContent = energyHelpFor(group, key);
    const input = field.querySelector("input");
    const body = field.closest(".ed-acc-body");
    const periodInput = body?.querySelector(
      key.includes("import")
        ? "input[name='grid.annual_import_energy']"
        : key.includes("export")
          ? "input[name='grid.annual_export_energy']"
          : key.includes("charged") && !key.includes("discharged")
            ? "input[name='battery.annual_charged_energy']"
            : key.includes("discharged")
              ? "input[name='battery.annual_discharged_energy']"
              : `input[name='${group}.annual_energy']`,
    );
    field.dataset.dmTotalWarning = input?.value && input.value === periodInput?.value ? "same-period" : "";
    if (field.dataset.dmTotalWarning === "same-period") {
      help.textContent += english()
        ? " The same entity is also entered as Annual: leave Annual empty when you want it derived from the total meter."
        : " La stessa entità è inserita anche in Annuale: lascia Annuale vuota quando vuoi ricavarla dal contatore totale.";
    }
  });
}

function stateFor(entity) {
  const id = clean(entity);
  if (!id) return null;
  return root.STATES?.[id] || root._RAW_STATES?.[id] || null;
}

function cumulativeEntity(entity) {
  const id = clean(entity);
  const current = stateFor(id);
  const stateClass = clean(current?.attributes?.state_class).toLowerCase();
  return (
    stateClass === "total" ||
    stateClass === "total_increasing" ||
    /(?:^|[._-])(total|totale|lifetime|meter|contatore)(?:[._-]|$)/i.test(id)
  );
}

function normalizeReportEditor() {
  const panel = doc?.querySelector("#editor-modal [data-energy-panel='report']");
  if (!panel) return;
  panel.dataset.dmReportEditor = "canonical";
  panel.querySelectorAll(".dm-report-row").forEach((row) => {
    const fields = [...row.querySelectorAll("[data-entity-field]")];
    const primary = fields[0];
    if (!primary) return;
    const label = primary.querySelector(".ed-slot-lbl");
    if (label) label.childNodes[0].nodeValue = english() ? "Lifetime total entity " : "Entità totale per lo storico ";
    const input = primary.querySelector("input");
    let helper = row.querySelector(".dm-report-history-help");
    if (!helper) {
      helper = doc.createElement("div");
      helper.className = "dm-report-history-help";
      row.append(helper);
    }
    const valid = !input?.value || cumulativeEntity(input.value);
    row.dataset.historyValid = String(valid);
    helper.textContent = valid
      ? english()
        ? "Use a cumulative kWh entity (state_class total/total_increasing) to calculate the selected and previous months."
        : "Usa un’entità kWh cumulativa (state_class total/total_increasing) per calcolare il mese selezionato e quelli precedenti."
      : english()
        ? "This entity does not look cumulative: previous months may be unavailable. Select the appliance lifetime total meter."
        : "Questa entità non sembra cumulativa: i mesi precedenti potrebbero non essere disponibili. Seleziona il contatore totale lifetime dell’elettrodomestico.";
    input?.addEventListener("input", () => schedule(0), { once: true });
  });
}

function listFor(kind) {
  if (kind === "action") return root.getQuickActions?.().slice?.() || read("cd_quick_actions", []);
  if (kind === "climate") return root.getClimaUnits?.().slice?.() || read("cd_clima_units", []);
  if (kind === "shutter") return root.getTapparelle?.().slice?.() || read("cd_tapparelle", []);
  if (kind === "room") return root.getStanze?.().slice?.() || read("cd_stanze", []);
  return [];
}

function editButton(kind, index) {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "ed-del dm-edit-existing";
  button.dataset.dmEditKind = kind;
  button.dataset.dmEditIndex = String(index);
  button.textContent = "✏️";
  button.title = english() ? "Edit" : "Modifica";
  button.setAttribute("aria-label", button.title);
  return button;
}

function rowsBeforeForm(container, formSelector) {
  const form = container?.querySelector(formSelector);
  if (!container || !form) return [];
  return [...container.querySelectorAll(".ed-row")].filter(
    (row) => !form.contains(row) && row.querySelector(".ed-del") && row.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function ensureEditButtons() {
  const body = doc?.getElementById("ed-body");
  if (!body) return;
  const definitions = [
    ["action", body.querySelector("#ed-qa-type")?.closest("details") || body, "#ed-qa-type"],
    ["climate", body.querySelector("#ed-cl-type")?.closest("details") || body, "#ed-cl-type"],
    ["shutter", body, "#ed-tp-name"],
    ["room", body, "#ed-room-name"],
  ];
  definitions.forEach(([kind, container, selector]) => {
    if (!container?.querySelector(selector)) return;
    rowsBeforeForm(container, selector).forEach((row, index) => {
      if (row.querySelector(`[data-dm-edit-kind='${kind}']`)) return;
      const remove = [...row.querySelectorAll(".ed-del")].at(-1);
      remove?.before(editButton(kind, index));
    });
  });
}

function formFor(kind) {
  const selectors = {
    action: "#ed-qa-type",
    climate: "#ed-cl-type",
    shutter: "#ed-tp-name",
    room: "#ed-room-name",
  };
  return doc?.querySelector(selectors[kind])?.closest(".ed-form") || doc?.querySelector(selectors[kind])?.parentElement;
}

function addCancel(kind) {
  const form = formFor(kind);
  if (!form || form.querySelector(".dm-edit-cancel")) return;
  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.className = "ed-btn-add dm-edit-cancel";
  cancel.textContent = english() ? "Cancel edit" : "Annulla modifica";
  cancel.addEventListener("click", () => {
    state.editing = null;
    root.editorSwitch?.(doc.querySelector(".ed-tab.active")?.dataset?.tab || "sezioni");
  });
  form.append(cancel);
}

function setField(id, value) {
  const field = doc?.getElementById(id);
  if (!field) return;
  field.value = value ?? "";
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function beginEdit(kind, index) {
  const item = listFor(kind)[index];
  if (!item) return;
  if (kind === "action" && item.type === "luci_group" && typeof root.edEditLightGroup === "function") {
    root.edEditLightGroup(index);
    return;
  }
  state.editing = { kind, index };
  formFor(kind)?.setAttribute("data-dm-editing", "true");
  if (kind === "action") {
    setField("ed-qa-type", item.type === "builtin" ? `builtin_${item.builtin}` : item.type || "toggle");
    setField("ed-qa-icon", item.icon || "");
    setField("ed-qa-name", item.name || "");
    setField("ed-qa-ent", item.entity || "");
    setField("ed-qa-confirm", item.confirm || item.confirmation || "");
    root.edQaTypeChanged?.();
  } else if (kind === "climate") {
    setField("ed-cl-type", item.type || "clima");
    setField("ed-cl-name", item.name || "");
    setField("ed-cl-ent", item.entity || "");
    setField("ed-cl-room", item.room || "");
  } else if (kind === "shutter") {
    setField("ed-tp-name", item.name || "");
    setField("ed-tp-ent", item.entity || "");
    setField("ed-tp-room", item.room || "");
  } else if (kind === "room") {
    setField("ed-room-name", item.name || "");
    setField("ed-room-icon", item.icon || "🏠");
    setField("ed-room-floor", item.floor || "");
    const preview = doc.getElementById("ed-room-icon-preview");
    if (preview) preview.innerHTML = root.cdIconMarkup?.(item.icon || "🏠", 26) || item.icon || "🏠";
  }
  const add = formFor(kind)?.querySelector(".ed-btn-add:not(.dm-edit-cancel)");
  if (add) add.textContent = english() ? "💾 Save changes" : "💾 Salva modifiche";
  addCancel(kind);
}

function finishEdit(kind) {
  state.editing = null;
  const rerender = { action: "sezioni", climate: "sezioni", shutter: "tapp", room: "stanze" }[kind];
  root.editorSwitch?.(rerender);
}

function installAddWrappers() {
  const wrap = (name, kind, saveEdit) => {
    const current = root[name];
    if (typeof current !== "function" || current.__dmEditable0154) return;
    function editableOwner(...args) {
      if (state.editing?.kind !== kind) return current.apply(this, args);
      saveEdit(state.editing.index);
      finishEdit(kind);
    }
    editableOwner.__dmEditable0154 = true;
    editableOwner.__dmPrevious = current;
    root[name] = editableOwner;
  };

  wrap("edAddQA", "action", (index) => {
    const list = listFor("action");
    const previous = list[index] || {};
    const selected = clean(doc.getElementById("ed-qa-type")?.value);
    const next = {
      ...previous,
      icon: clean(doc.getElementById("ed-qa-icon")?.value),
      name: clean(doc.getElementById("ed-qa-name")?.value),
      confirm: clean(doc.getElementById("ed-qa-confirm")?.value),
    };
    if (selected.startsWith("builtin_")) {
      next.type = "builtin";
      next.builtin = selected.slice(8);
      delete next.entity;
      delete next.lights;
    } else {
      next.type = selected;
      next.entity = clean(doc.getElementById("ed-qa-ent")?.value);
      delete next.builtin;
    }
    list[index] = next;
    write("cd_quick_actions", list);
    root.buildQuickActions?.();
  });

  wrap("edAddClima", "climate", (index) => {
    const list = listFor("climate");
    list[index] = {
      ...(list[index] || {}),
      type: clean(doc.getElementById("ed-cl-type")?.value) || "clima",
      name: clean(doc.getElementById("ed-cl-name")?.value),
      entity: clean(doc.getElementById("ed-cl-ent")?.value),
      room: clean(doc.getElementById("ed-cl-room")?.value),
    };
    write("cd_clima_units", list);
    root.buildClimaCards?.();
    root.buildDeviceCards?.();
  });

  wrap("edTappAdd", "shutter", (index) => {
    const list = listFor("shutter");
    list[index] = {
      ...(list[index] || {}),
      name: clean(doc.getElementById("ed-tp-name")?.value),
      entity: clean(doc.getElementById("ed-tp-ent")?.value),
      room: clean(doc.getElementById("ed-tp-room")?.value),
    };
    write("cd_tapparelle", list);
    root.renderTapparelle?.();
  });

  wrap("edStanzaRoomAdd", "room", (index) => {
    const list = listFor("room");
    list[index] = {
      ...(list[index] || {}),
      name: clean(doc.getElementById("ed-room-name")?.value),
      icon: clean(doc.getElementById("ed-room-icon")?.value) || "🏠",
      floor: clean(doc.getElementById("ed-room-floor")?.value),
    };
    if (!list[index].floor) delete list[index].floor;
    write("cd_stanze", list);
    root.buildTempCards?.();
  });
}

function normalizeVehicleInput() {
  const input = doc?.querySelector("#editor-modal input[value*='/loca/'],#editor-modal input[placeholder*='/local/']");
  if (!input) return;
  const normalized = normalizeVehiclePath(input.value);
  if (normalized && normalized !== input.value) {
    input.value = normalized;
    const stored = read("cd_ev_image", "");
    const raw = typeof stored === "string" ? stored : stored?.url || stored?.path || "";
    if (normalizeVehiclePath(raw) === normalized) write("cd_ev_image", normalized);
  }
}

function runContracts() {
  installStyles();
  installAddWrappers();
  normalizeTemperatureStatus();
  normalizeEnergyHelp();
  normalizeReportEditor();
  normalizeVehicleInput();
  ensureEditButtons();
}

function schedule(delay = 0) {
  if (state.timer) return;
  state.timer = root.setTimeout?.(() => {
    state.timer = 0;
    state.attempts += 1;
    runContracts();
    if (state.attempts < 180 && doc?.getElementById("editor-modal")) schedule(80);
  }, delay);
}

function install() {
  if (!doc) return;
  runContracts();
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener(
      "click",
      (event) => {
        const edit = event.target?.closest?.("[data-dm-edit-kind]");
        if (edit) {
          event.preventDefault();
          event.stopPropagation();
          beginEdit(edit.dataset.dmEditKind, Number(edit.dataset.dmEditIndex));
          return;
        }
        if (event.target?.closest?.(".ed-tab,.sub-tab-btn,[data-energy-tab],[data-report-add],[data-report-save],[data-energy-save]")) {
          state.attempts = 0;
          schedule(0);
        }
      },
      true,
    );
    doc.addEventListener("change", (event) => {
      if (event.target?.matches?.("[data-entity-field] input,[data-dm-injected-energy-total] input")) schedule(0);
    });
    root.addEventListener?.("dashboardmodern:legacy-ready", () => schedule(0));
    root.addEventListener?.("dashboardmodern:runtime-ready", () => schedule(0));
    root.addEventListener?.("dashboardmodern:state-changed", () => schedule(0));
    root.addEventListener?.("dashboardmodern:period-bundle", () => schedule(0));
    root.addEventListener?.("pageshow", () => schedule(0));
  }
  state.attempts = 0;
  schedule(0);
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", install, { once: true });
else install();

state.observer = null;
