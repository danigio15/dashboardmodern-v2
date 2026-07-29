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

  let editorBody = null;
  let editorObserver = null;
  let pickerPassQueued = false;
  let appliancePassQueued = false;
  let legacyInstallTimer = null;
  let originalApplianceCard = null;
  let originalLightRenderer = null;
  let originalLightRoom = null;

  function injectRuntimeStyles() {
    if (document.getElementById("dm-runtime-real-fixes")) return;
    const style = document.createElement("style");
    style.id = "dm-runtime-real-fixes";
    style.textContent = `
      #page-appliances-main .appl-page-grid {
        grid-template-columns: repeat(auto-fill, minmax(340px, 520px)) !important;
        justify-content: start !important;
        align-items: stretch;
      }
      #page-appliances-main .appl-wide-card {
        width: 100%;
        max-width: 520px;
      }
      #page-appliances-main .appl-ic .dm-appliance-glyph {
        display: grid !important;
        place-items: center;
        width: 52px !important;
        height: 52px !important;
        font-size: 38px !important;
        line-height: 1 !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", sans-serif !important;
        visibility: visible !important;
        opacity: 1 !important;
        filter: none !important;
      }
      #page-appliances-main .appl-wide-cat.dm-room-label {
        color: var(--text-dim, #64748b);
        text-transform: none;
        letter-spacing: .2px;
      }
      .dm-entity-picker {
        display: inline-grid !important;
        place-items: center !important;
        flex: 0 0 40px !important;
        width: 40px !important;
        min-width: 40px !important;
        min-height: 40px !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
      @media (max-width: 760px) {
        #page-appliances-main .appl-page-grid {
          grid-template-columns: 1fr !important;
        }
        #page-appliances-main .appl-wide-card {
          max-width: none;
        }
        #page-appliances-main .appl-ic .dm-appliance-glyph {
          width: 42px !important;
          height: 42px !important;
          font-size: 31px !important;
        }
      }
    `;
    document.head.append(style);
  }

  function slug(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function roomCatalog() {
    let rooms = [];
    try {
      if (typeof window.cdRoomList === "function") rooms = window.cdRoomList() || [];
      else if (typeof window.getStanze === "function") rooms = window.getStanze() || [];
    } catch (_error) {
      rooms = [];
    }
    return rooms.filter(Boolean).map(function (room, index) {
      return {
        ...room,
        id: String(room.id || room.room_id || `room-${slug(room.name) || index + 1}`),
        name: String(room.name || room.id || `Stanza ${index + 1}`),
      };
    });
  }

  function resolveRoom(ref, rooms) {
    const value = String(ref || "").trim();
    if (!value) return null;
    const lower = value.toLowerCase();
    const token = slug(value).replace(/^room-/, "");
    return (
      rooms.find((room) => room.id === value) ||
      rooms.find((room) => room.name.toLowerCase() === lower) ||
      rooms.find((room) => slug(room.name) === token) ||
      null
    );
  }

  function exactRoomFromEntity(entityId, rooms) {
    const objectId = String(entityId || "").split(".").pop() || "";
    const token = slug(objectId);
    return rooms.find(function (room) {
      const roomToken = slug(room.name);
      const idToken = slug(room.id).replace(/^room-/, "");
      return token === roomToken || token === idToken;
    }) || null;
  }

  function migrateLightRoomIds() {
    const rooms = roomCatalog();
    if (!rooms.length) return false;
    const lights = readJson("cd_luci", {});
    const assigned = readJson("cd_luci_rooms", {});
    let changed = false;

    Object.keys(lights).forEach(function (entityId) {
      const exact = exactRoomFromEntity(entityId, rooms);
      const current = resolveRoom(assigned[entityId], rooms);
      const wanted = exact || current;
      if (wanted && assigned[entityId] !== wanted.id) {
        assigned[entityId] = wanted.id;
        changed = true;
      }
    });

    Object.keys(assigned).forEach(function (entityId) {
      if (!Object.prototype.hasOwnProperty.call(lights, entityId)) return;
      const current = resolveRoom(assigned[entityId], rooms);
      if (current && assigned[entityId] !== current.id) {
        assigned[entityId] = current.id;
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

  function applianceType(appliance) {
    try {
      if (typeof window.cdApplianceType === "function") return window.cdApplianceType(appliance);
    } catch (_error) {}
    return String(appliance?.device_type || appliance?.type || appliance?.icon || "generico").toLowerCase();
  }

  function applianceGlyph(appliance) {
    return GLYPHS[applianceType(appliance)] || GLYPHS.generico;
  }

  function applianceRoom(appliance) {
    const rooms = roomCatalog();
    const api = window.DashboardModernModules?.data;
    let roomId = "";
    try {
      if (typeof api?.applianceRoomId === "function") roomId = api.applianceRoomId(appliance, rooms);
    } catch (_error) {}
    return resolveRoom(roomId || appliance?.room_id || appliance?.room, rooms);
  }

  function repairApplianceMarkup(html, appliance) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    const card = template.content.firstElementChild;
    if (!card) return html;

    card.dataset.applianceId = String(appliance?.id || "");
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

    const visual = card.querySelector(".appl-ic");
    if (visual) {
      visual.dataset.applianceType = applianceType(appliance);
      visual.innerHTML = `<span class="dm-appliance-glyph" aria-hidden="true">${applianceGlyph(appliance)}</span>`;
    }

    return card.outerHTML;
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

  function rebuildLightSelect(select, entityId) {
    const rooms = roomCatalog();
    const assigned = readJson("cd_luci_rooms", {});
    const current = resolveRoom(assigned[entityId], rooms);
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = document.documentElement.lang === "en" ? "— Other areas —" : "— Altre zone —";
    select.replaceChildren(empty);
    rooms.forEach(function (room) {
      const option = document.createElement("option");
      option.value = room.id;
      option.textContent = `${room.icon && !String(room.icon).startsWith("mdi:") ? `${room.icon} ` : ""}${room.name}`;
      option.selected = current?.id === room.id;
      select.append(option);
    });
    select.dataset.lightEntity = entityId;
  }

  function repairLightEditorMarkup(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    template.content.querySelectorAll(".ed-lrow select").forEach(function (select) {
      const handler = select.getAttribute("onchange") || "";
      const match = handler.match(/cdLuciSetRoom\('([^']+)'/);
      if (match) rebuildLightSelect(select, match[1]);
    });
    return template.innerHTML;
  }

  function installLightRoomRuntime() {
    if (window.editorRenderLuci?.__dmRealFix) return true;
    if (typeof window.editorRenderLuci !== "function" || typeof window.cdLightRoom !== "function") return false;

    originalLightRoom = window.cdLightRoom;
    originalLightRenderer = window.editorRenderLuci;

    window.cdLightRoom = function (entityId) {
      const rooms = roomCatalog();
      const assigned = readJson("cd_luci_rooms", {});
      const room = resolveRoom(assigned[entityId], rooms);
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
    const activeTab = document.querySelector(".ed-tab.active")?.dataset?.tab;
    if (activeTab === "luci") {
      try {
        window.editorSwitch("luci");
      } catch (_error) {}
    }
    return true;
  }

  function mountEntityPickers() {
    const body = document.getElementById("ed-body");
    const mount = window.DashboardModernModules?.render?.mountEntityPickers;
    if (!body) return;
    if (typeof mount === "function") mount(body);

    body.querySelectorAll("#luce-add-ent, #light-add-ent, [data-entity-input]").forEach(function (input) {
      if (!input.id) input.id = `dm-entity-${Math.random().toString(36).slice(2)}`;
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

  function queuePickerPass() {
    if (pickerPassQueued) return;
    pickerPassQueued = true;
    queueMicrotask(function () {
      pickerPassQueued = false;
      mountEntityPickers();
    });
  }

  function attachEditorObserver() {
    const nextBody = document.getElementById("ed-body");
    if (!nextBody) return;
    if (nextBody !== editorBody) {
      editorObserver?.disconnect();
      editorBody = nextBody;
      editorObserver = new MutationObserver(queuePickerPass);
      editorObserver.observe(nextBody, { childList: true, subtree: true });
    }
    queuePickerPass();
  }

  function ensureApplianceVisuals() {
    document.querySelectorAll("#page-appliances-main .appl-ic").forEach(function (visual) {
      if (visual.querySelector(".dm-appliance-glyph")) return;
      const type = visual.dataset.applianceType || "generico";
      visual.innerHTML = `<span class="dm-appliance-glyph" aria-hidden="true">${GLYPHS[type] || GLYPHS.generico}</span>`;
    });
  }

  function queueAppliancePass() {
    if (appliancePassQueued) return;
    appliancePassQueued = true;
    requestAnimationFrame(function () {
      appliancePassQueued = false;
      ensureApplianceVisuals();
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

  function installLegacyOverrides() {
    const appliancesReady = installApplianceRenderer();
    const lightsReady = installLightRoomRuntime();
    if (appliancesReady && lightsReady && legacyInstallTimer) {
      clearInterval(legacyInstallTimer);
      legacyInstallTimer = null;
    }
  }

  const documentObserver = new MutationObserver(function () {
    attachEditorObserver();
    queueAppliancePass();
    installLegacyOverrides();
  });

  function start() {
    injectRuntimeStyles();
    document.addEventListener("click", delegatedPickerClick, true);
    documentObserver.observe(document.documentElement, { childList: true, subtree: true });
    attachEditorObserver();
    queueAppliancePass();
    installLegacyOverrides();
    legacyInstallTimer = setInterval(installLegacyOverrides, 100);
    setTimeout(function () {
      if (legacyInstallTimer) {
        clearInterval(legacyInstallTimer);
        legacyInstallTimer = null;
      }
    }, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
