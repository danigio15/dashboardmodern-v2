(function () {
  "use strict";

  if (window.__DASHBOARDMODERN_RUNTIME_HOTFIX__) return;
  window.__DASHBOARDMODERN_RUNTIME_HOTFIX__ = true;

  const GLYPHS = Object.freeze({
    lavatrice: "🧺",
    lavastoviglie: "🍽️",
    asciugatrice: "💨",
    forno: "♨️",
    microonde: "〰️",
    frigo: "❄️",
    congelatore: "🧊",
    piano_cottura: "🔥",
    cappa: "🌬️",
    ferro: "♨️",
    aspirapolvere: "🧹",
    robot: "🤖",
    condizionatore: "❄️",
    ventilatore: "🌀",
    scaldabagno: "🚿",
    tv: "📺",
    caffe: "☕",
    tostapane: "🍞",
    bollitore: "🫖",
    generico: "🔌",
  });

  let passQueued = false;
  let installTimer = null;
  let originalApplianceCard = null;
  let originalLightRenderer = null;
  let originalLightRoom = null;

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function slug(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normalizeRoom(room, index) {
    if (!room) return null;
    const name = String(room.name || room.id || room.room_id || `Stanza ${index + 1}`);
    return {
      ...room,
      id: String(room.id || room.room_id || `room-${slug(name) || index + 1}`),
      name,
    };
  }

  function roomCatalog() {
    const sources = [];
    const append = (value) => {
      if (Array.isArray(value)) sources.push(...value);
    };

    const saved = readJson("dm_dashboard_state", {});
    append(saved?.sections?.rooms);
    append(readJson("cd_stanze", []));

    try {
      append(window.DashboardModernModules?.store?.getSection?.("rooms"));
    } catch (_error) {}
    try {
      append(typeof window.cdRoomList === "function" ? window.cdRoomList() : []);
    } catch (_error) {}
    try {
      append(typeof window.getStanze === "function" ? window.getStanze() : []);
    } catch (_error) {}

    const byId = new Map();
    const byName = new Map();
    sources.forEach(function (source, index) {
      const room = normalizeRoom(source, index);
      if (!room) return;
      const idKey = room.id.toLowerCase();
      const nameKey = room.name.toLowerCase();
      if (byId.has(idKey) || byName.has(nameKey)) return;
      byId.set(idKey, room);
      byName.set(nameKey, room);
    });
    return Array.from(byId.values());
  }

  function resolveRoom(ref, rooms) {
    const value = String(ref || "").trim();
    if (!value) return null;
    const lower = value.toLowerCase();
    const token = slug(value).replace(/^room-/, "");
    return (
      rooms.find((room) => room.id === value) ||
      rooms.find((room) => room.id.toLowerCase() === lower) ||
      rooms.find((room) => room.name.toLowerCase() === lower) ||
      rooms.find((room) => slug(room.name) === token) ||
      rooms.find((room) => slug(room.id).replace(/^room-/, "") === token) ||
      null
    );
  }

  function exactRoomFromEntity(entityId, rooms) {
    const objectId = String(entityId || "").split(".").pop() || "";
    const token = slug(objectId);
    return (
      rooms.find(function (room) {
        return token === slug(room.name) || token === slug(room.id).replace(/^room-/, "");
      }) || null
    );
  }

  function lightEntityFromSelect(select) {
    if (select?.dataset?.lightEntity) return select.dataset.lightEntity;
    const handler = select?.getAttribute?.("onchange") || "";
    return handler.match(/cdLuciSetRoom\('([^']+)'/)?.[1] || "";
  }

  function knownLightEntities() {
    const entities = new Set(Object.keys(readJson("cd_luci", {})));
    document.querySelectorAll(".ed-lrow select, select[data-light-entity]").forEach(function (select) {
      const entityId = lightEntityFromSelect(select);
      if (entityId) entities.add(entityId);
    });
    return entities;
  }

  function migrateLightRoomIds() {
    const rooms = roomCatalog();
    if (!rooms.length) return false;

    const assigned = readJson("cd_luci_rooms", {});
    let changed = false;
    const entities = knownLightEntities();
    Object.keys(assigned).forEach((entityId) => entities.add(entityId));

    entities.forEach(function (entityId) {
      const exact = exactRoomFromEntity(entityId, rooms);
      const current = resolveRoom(assigned[entityId], rooms);
      const wanted = exact || current;
      if (wanted && assigned[entityId] !== wanted.id) {
        assigned[entityId] = wanted.id;
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem("cd_luci_rooms", JSON.stringify(assigned));
      try {
        window.cdMarkDirty?.();
        window.cdSyncPush?.();
      } catch (_error) {}
    }
    return changed;
  }

  function rebuildLightSelect(select, entityId) {
    if (!select || !entityId) return;
    const rooms = roomCatalog();
    const assigned = readJson("cd_luci_rooms", {});
    const exact = exactRoomFromEntity(entityId, rooms);
    const current = exact || resolveRoom(assigned[entityId], rooms);
    const selectedId = current?.id || "";
    const signature = `${entityId}|${selectedId}|${rooms
      .map((room) => `${room.id}:${room.name}:${room.icon || ""}`)
      .join("|")}`;

    if (select.dataset.dmRoomSignature === signature && select.value === selectedId) return;

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = document.documentElement.lang === "en" ? "— Other areas —" : "— Altre zone —";
    if (!selectedId) empty.setAttribute("selected", "selected");
    select.replaceChildren(empty);

    rooms.forEach(function (room) {
      const option = document.createElement("option");
      option.value = room.id;
      option.textContent = `${room.icon && !String(room.icon).startsWith("mdi:") ? `${room.icon} ` : ""}${room.name}`;
      if (selectedId === room.id) option.setAttribute("selected", "selected");
      select.append(option);
    });

    select.dataset.lightEntity = entityId;
    select.dataset.dmRoomSignature = signature;
    select.value = selectedId;

    if (!select.getAttribute("onchange") && select.dataset.dmRoomChangeBound !== "true") {
      select.dataset.dmRoomChangeBound = "true";
      select.addEventListener("change", function () {
        window.cdLuciSetRoom?.(entityId, select.value);
      });
    }
  }

  function repairLightEditorMarkup(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    template.content.querySelectorAll(".ed-lrow select, select[data-light-entity]").forEach(function (select) {
      const entityId = lightEntityFromSelect(select);
      if (entityId) rebuildLightSelect(select, entityId);
    });
    return template.innerHTML;
  }

  function repairRenderedLightEditor(root) {
    const body = root || document.getElementById("ed-body");
    if (!body) return;
    migrateLightRoomIds();
    body.querySelectorAll(".ed-lrow select, select[data-light-entity]").forEach(function (select) {
      const entityId = lightEntityFromSelect(select);
      if (entityId) rebuildLightSelect(select, entityId);
    });
  }

  function applianceType(appliance) {
    try {
      if (typeof window.cdApplianceType === "function") return window.cdApplianceType(appliance);
    } catch (_error) {}
    return String(appliance?.device_type || appliance?.type || appliance?.icon || "generico").toLowerCase();
  }

  function currentAppliances() {
    try {
      const canonical = window.DashboardModernModules?.store?.getSection?.("appliances");
      if (Array.isArray(canonical) && canonical.length) return canonical;
    } catch (_error) {}
    try {
      const legacy = typeof window.getAppliances === "function" ? window.getAppliances() : [];
      if (Array.isArray(legacy) && legacy.length) return legacy;
    } catch (_error) {}
    return readJson("cd_appliances", []);
  }

  function applianceRoom(appliance) {
    const rooms = roomCatalog();
    let ref = appliance?.room_id || appliance?.room || "";
    try {
      const api = window.DashboardModernModules?.data;
      if (typeof api?.applianceRoomId === "function") ref = api.applianceRoomId(appliance, rooms) || ref;
    } catch (_error) {}
    return resolveRoom(ref, rooms);
  }

  function repairApplianceCard(card, appliance) {
    if (!card || !appliance) return;
    card.dataset.applianceId = String(appliance.id || "");

    const room = applianceRoom(appliance);
    const roomLabel = card.querySelector(".appl-wide-cat");
    if (roomLabel) {
      roomLabel.classList.add("dm-room-label");
      roomLabel.textContent = room
        ? `🏠 ${room.name}`
        : document.documentElement.lang === "en"
          ? "No room"
          : "Nessuna stanza";
    }

    const type = applianceType(appliance);
    const visual = card.querySelector(".appl-ic");
    if (visual) {
      visual.dataset.applianceType = type;
      visual.innerHTML = `<span class="dm-appliance-glyph" aria-hidden="true">${GLYPHS[type] || GLYPHS.generico}</span>`;
    }
  }

  function repairApplianceMarkup(html, appliance) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    const card = template.content.firstElementChild;
    if (!card) return html;
    repairApplianceCard(card, appliance);
    return card.outerHTML;
  }

  function repairRenderedAppliances() {
    const appliances = currentAppliances();
    const cards = Array.from(document.querySelectorAll("#page-appliances-main .appl-wide-card"));
    cards.forEach(function (card, index) {
      const id = card.dataset.applianceId;
      const name = String(card.querySelector(".appl-wide-name")?.textContent || "").trim().toLowerCase();
      const appliance =
        appliances.find((item) => id && String(item.id) === id) ||
        appliances.find((item) => String(item.name || "").trim().toLowerCase() === name) ||
        appliances[index];
      if (appliance) repairApplianceCard(card, appliance);
    });
  }

  function installApplianceRenderer() {
    if (window.cdApplMainCard?.__dmRealFix) return true;
    if (typeof window.cdApplMainCard !== "function") return false;
    originalApplianceCard = window.cdApplMainCard;
    const wrapped = function (appliance) {
      return repairApplianceMarkup(originalApplianceCard(appliance), appliance);
    };
    wrapped.__dmRealFix = true;
    window.cdApplMainCard = wrapped;
    try {
      window.renderApplianceSection?.(true);
    } catch (_error) {}
    return true;
  }

  function installLightRuntime() {
    if (window.editorRenderLuci?.__dmRealFix) return true;
    if (typeof window.editorRenderLuci !== "function" || typeof window.cdLightRoom !== "function") return false;

    originalLightRoom = window.cdLightRoom;
    originalLightRenderer = window.editorRenderLuci;

    window.cdLightRoom = function (entityId) {
      const rooms = roomCatalog();
      const assigned = readJson("cd_luci_rooms", {});
      const room = exactRoomFromEntity(entityId, rooms) || resolveRoom(assigned[entityId], rooms);
      return room?.name || originalLightRoom(entityId);
    };

    window.cdLuciSetRoom = function (entityId, roomRef) {
      const rooms = roomCatalog();
      const assigned = readJson("cd_luci_rooms", {});
      const room = resolveRoom(roomRef, rooms);
      if (room) assigned[entityId] = room.id;
      else delete assigned[entityId];
      localStorage.setItem("cd_luci_rooms", JSON.stringify(assigned));
      try {
        window.cdMarkDirty?.();
        window.cdSyncPush?.();
      } catch (_error) {}
      window.editorSwitch?.("luci");
    };

    const wrapped = function () {
      migrateLightRoomIds();
      return repairLightEditorMarkup(originalLightRenderer());
    };
    wrapped.__dmRealFix = true;
    window.editorRenderLuci = wrapped;
    migrateLightRoomIds();
    return true;
  }

  function mountEntityPickers() {
    const body = document.getElementById("ed-body");
    if (!body) return;
    try {
      window.DashboardModernModules?.render?.mountEntityPickers?.(body);
    } catch (_error) {}

    body.querySelectorAll("#luce-add-ent, #light-add-ent, [data-entity-input]").forEach(function (input) {
      if (!input.id) input.id = `dm-entity-${Math.random().toString(36).slice(2)}`;
      if (/^(?:luce|light)-add-ent$/.test(input.id)) input.dataset.lightAddEntity = "";
      let button = input.nextElementSibling;
      if (!button?.matches?.(".dm-entity-picker")) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "dm-entity-picker";
        button.textContent = "🔍";
        input.insertAdjacentElement("afterend", button);
      }
      button.dataset.entityTarget = input.id;
    });
  }

  function delegatedPickerClick(event) {
    const button = event.target.closest?.(".dm-entity-picker");
    if (!button) return;
    const targetId = button.dataset.entityTarget;
    const input = (targetId && document.getElementById(targetId)) || button.previousElementSibling;
    if (!input) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.wzPickEntity?.(input);
  }

  function injectStyles() {
    if (document.getElementById("dm-runtime-real-fixes")) return;
    const style = document.createElement("style");
    style.id = "dm-runtime-real-fixes";
    style.textContent = `
      #page-appliances-main .appl-page-grid {
        grid-template-columns: repeat(auto-fill, minmax(340px, 520px)) !important;
        justify-content: start !important;
        align-items: stretch;
      }
      #page-appliances-main .appl-wide-card { width: 100%; max-width: 520px; }
      #page-appliances-main .appl-ic .dm-appliance-glyph {
        display: grid !important; place-items: center; width: 52px !important; height: 52px !important;
        font-size: 38px !important; line-height: 1 !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", sans-serif !important;
        visibility: visible !important; opacity: 1 !important; filter: none !important;
      }
      #page-appliances-main .appl-wide-cat.dm-room-label {
        color: var(--text-dim, #64748b); text-transform: none; letter-spacing: .2px;
      }
      .dm-entity-picker {
        display: inline-grid !important; place-items: center !important; flex: 0 0 40px !important;
        width: 40px !important; min-width: 40px !important; min-height: 40px !important;
        visibility: visible !important; opacity: 1 !important; pointer-events: auto !important;
      }
      @media (max-width: 760px) {
        #page-appliances-main .appl-page-grid { grid-template-columns: 1fr !important; }
        #page-appliances-main .appl-wide-card { max-width: none; }
        #page-appliances-main .appl-ic .dm-appliance-glyph {
          width: 42px !important; height: 42px !important; font-size: 31px !important;
        }
      }
    `;
    document.head.append(style);
  }

  function installOverrides() {
    const appliancesReady = installApplianceRenderer();
    const lightsReady = installLightRuntime();
    if (appliancesReady && lightsReady && installTimer) {
      clearInterval(installTimer);
      installTimer = null;
    }
  }

  function runPass() {
    passQueued = false;
    installOverrides();
    repairRenderedLightEditor();
    mountEntityPickers();
    repairRenderedAppliances();
  }

  function queuePass() {
    if (passQueued) return;
    passQueued = true;
    queueMicrotask(runPass);
  }

  function start() {
    injectStyles();
    document.addEventListener("click", delegatedPickerClick, true);
    new MutationObserver(queuePass).observe(document.documentElement, { childList: true, subtree: true });

    try {
      const store = window.DashboardModernModules?.store;
      if (typeof store?.subscribe === "function") store.subscribe(queuePass);
    } catch (_error) {}

    installOverrides();
    queuePass();
    installTimer = setInterval(function () {
      installOverrides();
      queuePass();
    }, 100);
    setTimeout(function () {
      if (installTimer) {
        clearInterval(installTimer);
        installTimer = null;
      }
    }, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
