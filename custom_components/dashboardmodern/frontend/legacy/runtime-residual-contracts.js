/* DashboardModern 0.15.0 — final residual contracts on the real legacy globals. */
import {
  applianceArtwork,
  canonicalArtworkType,
} from "../src/core/appliance-artwork.js";

(function installResidualContracts0150(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_RESIDUAL_CONTRACTS_0150__";
  if (root[KEY]?.installed) return;
  const doc = root.document;
  if (!doc) return;

  const state = (root[KEY] = {
    installed: true,
    version: "0.15.0",
    attempts: 0,
    registries: false,
    broker: false,
    reportCapture: false,
    energyCapture: false,
    switchView: false,
    coverEditor: false,
    lightEditor: false,
    lightEditEntity: "",
    coverEditId: "",
  });

  const clean = (value) => String(value ?? "").trim();
  const english = () =>
    clean(doc.documentElement.lang).toLowerCase().startsWith("en") ||
    /dashboard-en\.html/i.test(root.location?.pathname || "");
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  const dashboardStore = () => root.DashboardModernModules?.store || null;

  function lexical(name) {
    try {
      return root.eval?.(name);
    } catch (_error) {
      return null;
    }
  }

  function aliasLegacyRegistries() {
    const raw = lexical("_RAW_STATES");
    const states = lexical("STATES");
    const period = lexical("CD_PERIOD");
    if (raw && typeof raw === "object") root._RAW_STATES = raw;
    if (states && typeof states === "object") root.STATES = states;
    if (period && typeof period === "object") root.CD_PERIOD = period;
    state.registries = Boolean(raw && states && period);
    return state.registries;
  }

  function periodRegistry() {
    return lexical("CD_PERIOD") || root.CD_PERIOD || (root.CD_PERIOD = {});
  }

  function rawRegistry() {
    return lexical("_RAW_STATES") || root._RAW_STATES || (root._RAW_STATES = {});
  }

  function statesRegistry() {
    return lexical("STATES") || root.STATES || (root.STATES = {});
  }

  function publishDerived(haState) {
    const id = clean(haState?.entity_id);
    if (!id) return false;
    const copy = { ...haState, attributes: { ...(haState.attributes || {}) } };
    rawRegistry()[id] = copy;
    statesRegistry()[id] = copy;
    if (haState?.attributes?.dashboardmodern_derived === true) {
      const value = Number(haState.state);
      if (Number.isFinite(value)) periodRegistry()[id] = Math.max(0, value);
    }
    return true;
  }

  function installBrokerBridge() {
    const broker = root.DashboardModernRuntime0150?.broker;
    const current = broker?.ingestState;
    if (typeof current !== "function") return false;
    if (current.__dmResidualContracts0150) {
      state.broker = true;
      return true;
    }
    function ingestResidual0150(haState) {
      const result = current.call(this, haState);
      publishDerived(haState);
      return result;
    }
    ingestResidual0150.__dmResidualContracts0150 = true;
    ingestResidual0150.__dmPrevious = current;
    broker.ingestState = ingestResidual0150;
    state.broker = true;
    return true;
  }

  function syncBundle(bundle = root.__DASHBOARDMODERN_RUNTIME_0150__?.bundle) {
    if (!bundle) return false;
    const month = bundle.month || {};
    const year = bundle.year || {};
    const monthSlots = {
      "dm.energy_consumo_casa_mese": month.house,
      "dm.energy_produzione_solare_mese": month.solar,
      "dm.energy_rete_acquistata_mese": month.gridImport,
      "dm.energy_rete_venduta_mese": month.gridExport,
      "dm.energy_batteria_caricata_mese": month.batteryCharged,
      "dm.energy_batteria_usata_mese": month.batteryDischarged,
    };
    const yearSlots = {
      "dm.energy_consumo_casa_anno": year.house,
      "dm.energy_produzione_solare_anno": year.solar,
      "dm.energy_rete_acquistata_anno": year.gridImport,
      "dm.energy_rete_venduta_anno": year.gridExport,
      "dm.energy_batteria_caricata_anno": year.batteryCharged,
      "dm.energy_batteria_usata_anno": year.batteryDischarged,
    };
    const registry = periodRegistry();
    Object.entries({ ...monthSlots, ...yearSlots }).forEach(([slot, raw]) => {
      const value = Number(raw);
      if (Number.isFinite(value)) registry[slot] = Math.max(0, value);
    });
    return true;
  }

  function installSafeEnergyView() {
    if (state.switchView && root.switchEnergyView?.__dmResidualContracts0150) return true;
    if (typeof root.switchEnergyView !== "function") return false;
    function switchEnergyViewResidual0150(view) {
      root.navigator?.vibrate?.(5);
      doc.querySelectorAll(".sub-tab-btn").forEach((button) => button.classList.remove("active"));
      doc.querySelectorAll(".flow-view").forEach((node) => node.classList.remove("active"));
      const eventButton = root.event?.currentTarget instanceof root.HTMLElement
        ? root.event.currentTarget
        : null;
      const button =
        eventButton ||
        [...doc.querySelectorAll(".sub-tab-btn")].find((candidate) => {
          const onclick = candidate.getAttribute("onclick") || "";
          return (
            candidate.dataset.view === String(view) ||
            onclick.includes(`switchEnergyView('${view}')`) ||
            onclick.includes(`switchEnergyView(\"${view}\")`)
          );
        });
      button?.classList.add("active");
      doc.getElementById(`view-${view}`)?.classList.add("active");
      try {
        root.scrollTo?.({ top: 0, behavior: "instant" });
      } catch (_error) {}
      if (["panoramica", "overview"].includes(String(view))) root.renderEnergyDashboard?.();
      if (String(view) === "temp") root.renderInverterTemp?.();
      root.queueMicrotask?.(applyAll);
    }
    switchEnergyViewResidual0150.__dmResidualContracts0150 = true;
    switchEnergyViewResidual0150.__dmPrevious = root.switchEnergyView;
    root.switchEnergyView = switchEnergyViewResidual0150;
    state.switchView = true;
    return true;
  }

  function reportManualForm(button) {
    return (
      button.closest('[data-energy-panel="report"]')?.querySelector("[data-report-manual]") ||
      button.parentElement?.querySelector("[data-report-manual]") ||
      doc.querySelector('[data-energy-panel="report"] [data-report-manual]')
    );
  }

  function installReportCapture() {
    if (state.reportCapture) return true;
    state.reportCapture = true;
    doc.addEventListener(
      "click",
      (event) => {
        const button = event.target?.closest?.("[data-report-add]");
        if (!button) return;
        const form = reportManualForm(button);
        if (!form) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!expanded));
        form.hidden = expanded;
        form.style.setProperty("display", expanded ? "none" : "", "important");
      },
      true,
    );
    return true;
  }

  function normalizeReportManual() {
    doc.querySelectorAll("[data-report-add]").forEach((button) => {
      if (!button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", "false");
      const form = reportManualForm(button);
      if (!form) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      form.hidden = !expanded;
      form.style.setProperty("display", expanded ? "" : "none", "important");
    });
  }

  function installEnergyEventLock() {
    if (state.energyCapture) return true;
    state.energyCapture = true;
    root.addEventListener(
      "dashboardmodern:energy-periods-0154",
      (event) => {
        const ids = ["v-solar-month", "v-home-month", "v-grid-month", "v-battery-month"];
        const snapshot = Object.fromEntries(
          ids.map((id) => [id, doc.getElementById(id)?.textContent ?? null]),
        );
        event.stopImmediatePropagation();
        root.queueMicrotask?.(() => {
          Object.entries(snapshot).forEach(([id, value]) => {
            const node = doc.getElementById(id);
            if (node && value != null) node.textContent = value;
          });
        });
      },
      true,
    );
    return true;
  }

  function hideTemperatureIcon() {
    const input = doc.getElementById("dm-temperature-icon");
    if (!input) return false;
    input.type = "hidden";
    input.tabIndex = -1;
    if (!clean(input.value)) input.value = "mdi:home";
    const label = input.closest("label,[data-icon-field]");
    const form = input.closest("[data-temperature-form]") || label?.parentElement;
    if (label) {
      label.removeChild(input);
      label.remove();
      form?.append(input);
    }
    return true;
  }

  function configuredImage(device) {
    return clean(device?.image || device?.image_url);
  }

  function normalizeArtwork() {
    const devices = dashboardStore()?.getSection?.("appliances") || [];
    const byId = new Map(devices.map((device) => [clean(device.id), device]));
    doc.querySelectorAll("#page-appliances-main .appl-wide-card[data-appliance-id]").forEach(
      (card, index) => {
        const device = byId.get(clean(card.dataset.applianceId)) || devices[index];
        if (!device) return;
        const visual = card.querySelector(".appl-visual") || card.querySelector(".appl-ic")?.parentElement;
        if (!visual) return;
        let holder = visual.querySelector(".appl-ic");
        if (!holder) {
          holder = doc.createElement("div");
          holder.className = "appl-ic";
          visual.replaceChildren(holder);
        }
        const imageUrl = configuredImage(device);
        const rawToken = clean(device.visual_key || device.device_type || device.type || device.name).toLowerCase();
        const canonical = canonicalArtworkType(rawToken);
        if (imageUrl) {
          holder.innerHTML = '<span class="dm-appliance-image-wrap"><img class="dm-appliance-image dm-appliance-image-0153" alt=""></span>';
          const image = holder.querySelector("img");
          image.src = imageUrl;
          image.alt = clean(device.name);
          image.loading = "eager";
          image.decoding = "async";
          card.dataset.dmMediaKind = "image";
        } else if (canonical) {
          holder.innerHTML = applianceArtwork(canonical, 96);
          const art = holder.querySelector(".dm-appliance-art-0154");
          if (art) {
            art.dataset.applianceAsset = rawToken;
            art.dataset.applianceAssetKey = rawToken;
          }
          card.dataset.dmMediaKind = "asset";
        }
        card.dataset.dmArtwork = canonical || rawToken || "generic";
        card.dataset.dmArtStyle = "panel";
        card.dataset.applianceThemeAware = "true";
        visual.dataset.applianceCover = "true";
        card.querySelectorAll(".appl-spark").forEach((node) => node.remove());
      },
    );
  }

  function installStyles() {
    if (doc.getElementById("dm-residual-contracts-0150-style")) return;
    const style = doc.createElement("style");
    style.id = "dm-residual-contracts-0150-style";
    style.textContent = `
      :root{--dm-art-panel:#e0f2fe;--dm-art-shell:#0f2942;--dm-art-face:#f8fafc;--dm-art-window:#8be2ff;--dm-art-accent:#0ea5e9}
      :root[data-theme="dark"]{--dm-art-panel:#1e293b;--dm-art-shell:#e2e8f0;--dm-art-face:#334155;--dm-art-window:#38bdf8;--dm-art-accent:#7dd3fc}
      .dm-appliance-art-0154 .dm-art-panel{fill:var(--dm-art-panel)!important}
      #page-appliances-main .appl-wide-card{box-sizing:border-box!important}
      #page-appliances-main .appl-wide-card.dm-control-device{width:100%!important;max-width:390px!important;box-sizing:border-box!important}
      #page-appliances-main .appl-visual,#page-appliances-main .appl-ic,#page-appliances-main .dm-appliance-art-0154,#page-appliances-main .dm-appliance-image-wrap{width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;display:grid!important;place-items:center!important;overflow:hidden!important;box-sizing:border-box!important}
      #page-appliances-main .dm-appliance-art-0154>svg{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;display:block!important}
      #page-appliances-main [data-dm-media-kind="image"] img.dm-appliance-image-0153{width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center!important;display:block!important}
      #editor-modal .dm-temperature-actions>button{min-height:44px!important}
      [data-report-manual][hidden]{display:none!important}
    `;
    doc.head.append(style);
  }

  function roomOptions(selected = "") {
    const rooms = dashboardStore()?.getSection?.("rooms") || [];
    return [
      `<option value="">${english() ? "— No room —" : "— Nessuna stanza —"}</option>`,
      ...rooms.map(
        (room) =>
          `<option value="${escapeHtml(room.id)}" ${clean(room.id) === clean(selected) ? "selected" : ""}>${escapeHtml(room.name)}</option>`,
      ),
    ].join("");
  }

  function installCoverEditor() {
    if (state.coverEditor) return true;
    const store = dashboardStore();
    if (!store?.getSection || !store?.addItem || !store?.updateItem || !store?.removeItem) return false;
    const canonical = () => store.getSection("covers") || [];
    root.getTapparelle = () =>
      canonical().map((item) => {
        const value = {
          name: item.name || item.entity,
          entity: item.entity || item.entities?.[0] || "",
        };
        if (item.room_id) value.room = item.room_id;
        return value;
      });
    root.editorRenderTapparelle = function editorRenderTapparelleResidual0150() {
      const list = canonical();
      const current = list.find((item) => clean(item.id) === state.coverEditId) || null;
      const rows = list.length
        ? list
            .map(
              (item, index) => `<div class="ed-row" data-tapp-id="${escapeHtml(item.id)}"><div class="ed-row-main"><div class="ed-row-new">🪟 ${escapeHtml(item.name || item.entity)}</div><div class="ed-row-old mono">${escapeHtml(item.entity || item.entities?.[0] || "")}</div></div><div class="dm-row-actions"><button type="button" class="ed-del dm-edit-button" data-tapp-edit="${index}" onclick="edTappEdit(${index})">✏️</button><button type="button" class="ed-del" onclick="edTappDel(${index})">🗑️</button></div></div>`,
            )
            .join("")
        : `<div class="ed-empty">${english() ? "No shutters configured." : "Nessuna tapparella configurata."}</div>`;
      return `<div class="ed-intro">${english() ? "Edit an existing shutter or add a Home Assistant cover entity." : "Modifica una tapparella esistente o aggiungi una entità cover di Home Assistant."}</div><div class="ed-list">${rows}</div><div class="ed-form dm-tapp-form" data-tapp-form><div class="ed-sec-title">${current ? (english() ? "Edit shutter" : "Modifica tapparella") : english() ? "Add shutter" : "Aggiungi tapparella"}</div><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Name" : "Nome"}</span><input id="ed-tp-name" class="ed-input" value="${escapeHtml(current?.name || "")}" placeholder="${english() ? "Name" : "Nome"}"></label><label class="ed-slot dm-entity-field" data-entity-field><span class="ed-slot-lbl">${english() ? "Cover entity" : "Entità cover"}</span><span class="ed-form-row"><input id="ed-tp-ent" class="ed-input mono" data-entity-input value="${escapeHtml(current?.entity || current?.entities?.[0] || "")}" placeholder="cover.tapparella_x"><button type="button" class="dm-entity-picker" data-entity-target="ed-tp-ent">🔍</button></span></label><label class="ed-slot"><span class="ed-slot-lbl">${english() ? "Room" : "Stanza"}</span><select id="ed-tp-room" class="ed-input">${roomOptions(current?.room_id || "")}</select></label><div class="dm-temperature-actions"><button type="button" class="ed-btn-add" onclick="edTappAdd()">${current ? (english() ? "💾 Save changes" : "💾 Salva modifiche") : english() ? "＋ Add shutter" : "＋ Aggiungi tapparella"}</button>${current ? `<button type="button" class="ed-btn-secondary" onclick="edTappCancelEdit()">${english() ? "Cancel" : "Annulla"}</button>` : ""}</div></div>`;
    };
    root.edTappEdit = function edTappEditResidual0150(idOrIndex) {
      const list = canonical();
      const index = Number(idOrIndex);
      state.coverEditId = list.some((item) => clean(item.id) === clean(idOrIndex))
        ? clean(idOrIndex)
        : Number.isInteger(index) && list[index]
          ? clean(list[index].id)
          : "";
      root.editorSwitch?.("tapp");
    };
    root.edTappCancelEdit = function edTappCancelEditResidual0150() {
      state.coverEditId = "";
      root.editorSwitch?.("tapp");
    };
    root.edTappAdd = async function edTappAddResidual0150() {
      const name = clean(doc.getElementById("ed-tp-name")?.value);
      const entity = clean(doc.getElementById("ed-tp-ent")?.value);
      const roomId = clean(doc.getElementById("ed-tp-room")?.value);
      if (!/^cover\.[a-z0-9_]+$/i.test(entity)) return;
      const value = {
        name: name || entity,
        entity,
        entities: [entity],
        room_id: roomId,
        enabled: true,
      };
      if (state.coverEditId) await store.updateItem("covers", state.coverEditId, value);
      else await store.addItem("covers", value);
      state.coverEditId = "";
      root.renderTapparelle?.();
      root.render?.();
      root.editorSwitch?.("tapp");
    };
    root.edTappDel = async function edTappDelResidual0150(idOrIndex) {
      const list = canonical();
      const index = Number(idOrIndex);
      const id = list.some((item) => clean(item.id) === clean(idOrIndex))
        ? clean(idOrIndex)
        : Number.isInteger(index) && list[index]
          ? clean(list[index].id)
          : "";
      if (!id) return;
      await store.removeItem("covers", id);
      if (state.coverEditId === id) state.coverEditId = "";
      root.editorSwitch?.("tapp");
    };
    state.coverEditor = true;
    return true;
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
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }

  function installLightEditor() {
    if (state.lightEditor) return true;
    const renderer = root.editorRenderLuci;
    if (typeof renderer !== "function") return false;
    function editLight(entity) {
      state.lightEditEntity = clean(entity);
      root.editorSwitch?.("luci");
    }
    root.dmRealEditLight = editLight;
    root.dmRealCancelLight = () => {
      state.lightEditEntity = "";
      root.editorSwitch?.("luci");
    };
    function editorRenderLuciResidual0150() {
      const template = doc.createElement("template");
      template.innerHTML = renderer.apply(this, arguments);
      template.content.querySelectorAll(".ed-lrow").forEach((row) => {
        const entity = row.querySelector("div[style*='font-family:monospace']")?.textContent?.trim();
        if (!entity) return;
        const button = [...row.querySelectorAll("button")].find((node) =>
          /Rinomina|Rename|Modifica|Edit/i.test(node.title || node.textContent || ""),
        );
        if (!button) return;
        button.title = english() ? "Edit" : "Modifica";
        button.setAttribute("onclick", `dmRealEditLight(${JSON.stringify(entity)})`);
        button.classList.add("dm-edit-button");
      });
      const form = template.content.querySelector("[data-light-add-form],.dm-light-add-form");
      if (form) {
        const lights = readJson("cd_luci", {});
        const rooms = readJson("cd_luci_rooms", {});
        const entity = form.querySelector("#luce-add-ent");
        const name = form.querySelector("#luce-add-name");
        let room = form.querySelector("#luce-add-room");
        if (!room) {
          const label = doc.createElement("label");
          label.className = "ed-slot dm-config-field";
          label.innerHTML = `<span class="ed-slot-lbl">${english() ? "Room" : "Stanza"}</span><select id="luce-add-room" class="ed-input">${roomOptions(state.lightEditEntity ? rooms[state.lightEditEntity] || "" : "")}</select>`;
          name?.insertAdjacentElement("afterend", label);
          room = label.querySelector("select");
        }
        if (state.lightEditEntity) {
          if (entity) entity.value = state.lightEditEntity;
          if (name) name.value = lights[state.lightEditEntity] || "";
          if (room) room.value = rooms[state.lightEditEntity] || "";
        }
      }
      return template.innerHTML;
    }
    editorRenderLuciResidual0150.__dmResidualContracts0150 = true;
    editorRenderLuciResidual0150.__dmPrevious = renderer;
    root.editorRenderLuci = editorRenderLuciResidual0150;
    root.cdLuceAdd = function cdLuceAddResidual0150() {
      const newEntity = clean(doc.getElementById("luce-add-ent")?.value);
      const name = clean(doc.getElementById("luce-add-name")?.value);
      const room = clean(doc.getElementById("luce-add-room")?.value);
      if (!/^(light|switch)\.[a-z0-9_]+$/i.test(newEntity)) return;
      const lights = readJson("cd_luci", {});
      const rooms = readJson("cd_luci_rooms", {});
      if (state.lightEditEntity) {
        delete lights[state.lightEditEntity];
        delete rooms[state.lightEditEntity];
      }
      lights[newEntity] = name || newEntity.split(".")[1];
      if (room) rooms[newEntity] = room;
      writeJson("cd_luci", lights);
      writeJson("cd_luci_rooms", rooms);
      state.lightEditEntity = "";
      root.updateGestioneLuci?.();
      root.editorSwitch?.("luci");
    };
    state.lightEditor = true;
    return true;
  }

  function applyAll() {
    aliasLegacyRegistries();
    installBrokerBridge();
    syncBundle();
    installSafeEnergyView();
    installReportCapture();
    installEnergyEventLock();
    installStyles();
    normalizeReportManual();
    hideTemperatureIcon();
    normalizeArtwork();
    installCoverEditor();
    installLightEditor();
  }

  function settle() {
    state.attempts += 1;
    applyAll();
    if (
      state.attempts < 180 &&
      (!state.registries ||
        !state.broker ||
        !state.switchView ||
        !state.coverEditor ||
        !state.lightEditor)
    ) {
      root.requestAnimationFrame?.(settle);
    }
  }

  doc.addEventListener("click", () => root.queueMicrotask?.(applyAll), true);
  root.addEventListener?.("dashboardmodern:legacy-ready", () => root.queueMicrotask?.(settle));
  root.addEventListener?.("dashboardmodern:runtime-ready", () => {
    root.queueMicrotask?.(settle);
    root.DashboardModernRuntime0150?.refreshSelectedPeriod?.();
  });
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    syncBundle(event.detail);
    root.queueMicrotask?.(applyAll);
  });
  root.addEventListener?.("pageshow", () => root.queueMicrotask?.(settle));
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", settle, { once: true });
  else settle();
})(globalThis);
