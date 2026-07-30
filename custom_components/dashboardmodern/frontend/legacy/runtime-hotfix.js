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

  let originalApplianceCard = null;
  let originalApplianceSectionRenderer = null;
  let originalLightRenderer = null;
  let originalLightRoom = null;
  let originalEditorSwitch = null;
  let bodyObserver = null;
  let observedBody = null;
  let documentObserver = null;
  let installTimer = null;
  let passScheduled = false;
  let shutterTimer = null;

  function dashboardStates() {
    try {
      if (typeof STATES !== "undefined") return STATES;
    } catch (_error) {}
    return window.STATES || {};
  }

  function openShutters() {
    const rooms = roomCatalog();
    const states = dashboardStates();
    const configured = typeof window.getTapparelle === "function" ? window.getTapparelle() : [];
    return configured.flatMap(function (cover) {
      const entity = String(cover?.entity || cover?.entities?.[0] || "");
      const stateObject = states[entity];
      const state = String(stateObject?.state || "unknown").toLowerCase();
      if (!stateObject || state === "unknown" || state === "unavailable") return [];
      const rawPosition = stateObject.attributes?.current_position;
      const position = rawPosition == null ? null : Number(rawPosition);
      const open =
        state === "open" ||
        state === "opening" ||
        (Number.isFinite(position) && position > 0);
      if (!open) return [];
      const room = resolveRoom(cover.room_id || cover.room, rooms);
      return [{ ...cover, entity, state, position: Number.isFinite(position) ? position : null, room }];
    });
  }

  function shutterStateLabel(item) {
    const en = document.documentElement.lang === "en";
    if (item.state === "opening") return en ? "Opening" : "In apertura";
    if (item.state === "open") return en ? "Open" : "Aperta";
    return en ? "Partially open" : "Parzialmente aperta";
  }

  function closeShutterPopup() {
    document.getElementById("dm-shutter-popup")?.remove();
  }

  function renderShutterPopup(items) {
    const popup = document.getElementById("dm-shutter-popup");
    if (!popup) return;
    if (!items.length) return closeShutterPopup();
    const list = popup.querySelector("[data-shutter-popup-list]");
    list.replaceChildren(...items.map(function (item) {
      const row = document.createElement("article");
      row.className = "dm-shutter-popup-row";
      row.innerHTML = `<span class="g-icon-wrap">🪟</span><span><strong>${String(item.name || item.entity).replace(/</g, "&lt;")}</strong><small>${item.room ? `${String(item.room.name).replace(/</g, "&lt;")} · ` : ""}${shutterStateLabel(item)}${item.position == null ? "" : ` · ${Math.round(item.position)}%`}</small></span>`;
      return row;
    }));
  }

  function showShutterPopup() {
    const en = document.documentElement.lang === "en";
    const popup = document.createElement("div");
    popup.id = "dm-shutter-popup";
    popup.className = "dm-shutter-popup-backdrop";
    popup.innerHTML = `<section class="dm-shutter-popup" role="dialog" aria-modal="true" aria-labelledby="dm-shutter-popup-title"><header><h2 id="dm-shutter-popup-title">🪟 ${en ? "Open shutters" : "Tapparelle aperte"}</h2><button type="button" data-shutter-popup-close aria-label="${en ? "Close" : "Chiudi"}">×</button></header><div data-shutter-popup-list></div></section>`;
    popup.addEventListener("click", (event) => { if (event.target === popup || event.target.closest("[data-shutter-popup-close]")) closeShutterPopup(); });
    document.body.append(popup);
    renderShutterPopup(openShutters());
  }

  function renderShutterAlert() {
    const host = document.getElementById("glance-custom-wrap");
    if (!host) return;
    const items = openShutters();
    let wrapper = document.getElementById("tapp-avvisi");
    if (!items.length) {
      wrapper?.remove();
      closeShutterPopup();
      return;
    }
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "tapp-avvisi";
      host.append(wrapper);
    }
    const en = document.documentElement.lang === "en";
    const title = items.length === 1 ? (en ? "SHUTTER OPEN" : "TAPPARELLA APERTA") : (en ? "SHUTTERS OPEN" : "TAPPARELLE APERTE");
    wrapper.innerHTML = `<button type="button" class="glance-card dm-shutter-alert" style="--g-rgb:245,158,11;display:flex" aria-haspopup="dialog"><span class="g-info"><span class="g-name">${title}</span><span class="g-val">${items.length}</span></span><span class="g-icon-wrap">🪟</span></button>`;
    wrapper.querySelector("button").addEventListener("click", showShutterPopup);
    renderShutterPopup(items);
  }

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

    const byIdentity = new Map();
    sources.forEach(function (source, index) {
      const room = normalizeRoom(source, index);
      if (!room) return;
      const key = `${room.id.toLowerCase()}|${room.name.toLowerCase()}`;
      if (!byIdentity.has(key)) byIdentity.set(key, room);
    });
    return Array.from(byIdentity.values());
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

  function knownLightEntities(root) {
    const entities = new Set(Object.keys(readJson("cd_luci", {})));
    (root || document).querySelectorAll?.(".ed-lrow select, select[data-light-entity]").forEach(function (select) {
      const entityId = lightEntityFromSelect(select);
      if (entityId) entities.add(entityId);
    });
    return entities;
  }

  function migrateLightRoomIds(root) {
    const rooms = roomCatalog();
    if (!rooms.length) return false;

    const assigned = readJson("cd_luci_rooms", {});
    const entities = knownLightEntities(root);
    Object.keys(assigned).forEach((entityId) => entities.add(entityId));
    let changed = false;

    entities.forEach(function (entityId) {
      const wanted = exactRoomFromEntity(entityId, rooms) || resolveRoom(assigned[entityId], rooms);
      if (wanted && assigned[entityId] !== wanted.id) {
        assigned[entityId] = wanted.id;
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem("cd_luci_rooms", JSON.stringify(assigned));
      try {
        window.cdMarkDirty?.();
      } catch (_error) {}
    }
    return changed;
  }

  function rebuildLightSelect(select, entityId) {
    if (!select || !entityId) return;
    const rooms = roomCatalog();
    const assigned = readJson("cd_luci_rooms", {});
    const current = exactRoomFromEntity(entityId, rooms) || resolveRoom(assigned[entityId], rooms);
    const selectedId = current?.id || "";
    const signature = `${entityId}|${selectedId}|${rooms
      .map((room) => `${room.id}:${room.name}:${room.icon || ""}`)
      .join("|")}`;

    if (select.dataset.dmRoomSignature === signature && select.value === selectedId) return;

    const fragment = document.createDocumentFragment();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = document.documentElement.lang === "en" ? "— Other areas —" : "— Altre zone —";
    empty.selected = !selectedId;
    fragment.append(empty);

    rooms.forEach(function (room) {
      const option = document.createElement("option");
      option.value = room.id;
      option.textContent = `${room.icon && !String(room.icon).startsWith("mdi:") ? `${room.icon} ` : ""}${room.name}`;
      option.selected = selectedId === room.id;
      fragment.append(option);
    });

    select.replaceChildren(fragment);
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
    migrateLightRoomIds(template.content);
    template.content.querySelectorAll(".ed-lrow select, select[data-light-entity]").forEach(function (select) {
      const entityId = lightEntityFromSelect(select);
      if (entityId) rebuildLightSelect(select, entityId);
    });
    return template.innerHTML;
  }

  function repairRenderedLightEditor(root) {
    const body = root || document.getElementById("ed-body");
    if (!body) return;
    migrateLightRoomIds(body);
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
    const room = applianceRoom(appliance);
    const type = applianceType(appliance);
    const roomText = room
      ? `🏠 ${room.name}`
      : document.documentElement.lang === "en"
        ? "No room"
        : "Nessuna stanza";
    const configuredVisual = window.DashboardModernModules?.data?.getDeviceVisual?.(appliance);
    const signature = `${appliance.id || ""}|${room?.id || ""}|${roomText}|${type}|${configuredVisual?.kind || ""}|${configuredVisual?.value || ""}`;
    const visual = card.querySelector(".appl-ic");
    const existingImage = visual?.querySelector("img");
    const imageExpected = configuredVisual?.kind === "image" && Boolean(configuredVisual.value);
    const imageNormalized =
      !imageExpected ||
      Boolean(
        existingImage?.classList.contains("dm-appliance-image") &&
          existingImage.getAttribute("src") === configuredVisual.value,
      );
    if (card.dataset.dmApplianceSignature === signature && imageNormalized) return;

    card.dataset.applianceId = String(appliance.id || "");
    const roomLabel = card.querySelector(".appl-wide-cat");
    if (roomLabel) {
      roomLabel.classList.add("dm-room-label");
      if (roomLabel.textContent !== roomText) roomLabel.textContent = roomText;
    }

    if (visual) {
      const glyph = GLYPHS[type] || GLYPHS.generico;
      visual.dataset.applianceType = type;
      if (configuredVisual?.kind === "image" && configuredVisual.value) {
        let image = visual.querySelector("img");
        if (!image) image = document.createElement("img");
        visual.replaceChildren(image);
        image.classList.add("dm-appliance-image");
        image.src = configuredVisual.value;
        image.alt = appliance.name || "";
        if (image.dataset.dmFallbackBound !== "true") {
          image.dataset.dmFallbackBound = "true";
          image.addEventListener(
            "error",
            function () {
              visual.innerHTML = `<span class="dm-appliance-glyph" aria-hidden="true">${glyph}</span>`;
            },
            { once: true },
          );
        }
      } else if (configuredVisual?.kind === "asset" && configuredVisual.value) {
        visual.innerHTML = window.cdApplianceVisual?.(appliance, 96) || `<span class="dm-appliance-glyph" aria-hidden="true">${glyph}</span>`;
      } else if (configuredVisual?.kind === "icon" && configuredVisual.value) {
        visual.innerHTML = window.cdIconMarkup?.(configuredVisual.value, 64) || `<span class="dm-appliance-glyph" aria-hidden="true">${glyph}</span>`;
      } else {
        visual.innerHTML = `<span class="dm-appliance-glyph" aria-hidden="true">${glyph}</span>`;
      }
    }
    card.dataset.dmApplianceSignature = signature;
  }

  function repairApplianceMarkup(html, appliance) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    const card = template.content.firstElementChild;
    if (!card) return html;
    repairApplianceCard(card, appliance);
    return card.outerHTML;
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
    if (
      typeof window.renderApplianceSection === "function" &&
      !window.renderApplianceSection.__dmRealFix
    ) {
      originalApplianceSectionRenderer = window.renderApplianceSection;
      const wrappedSection = function () {
        const result = originalApplianceSectionRenderer.apply(this, arguments);
        repairRenderedAppliances();
        return result;
      };
      wrappedSection.__dmRealFix = true;
      window.renderApplianceSection = wrappedSection;
    }
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
      migrateLightRoomIds(document);
      return repairLightEditorMarkup(originalLightRenderer());
    };
    wrapped.__dmRealFix = true;
    window.editorRenderLuci = wrapped;
    migrateLightRoomIds(document);
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
      if (button.dataset.entityTarget !== input.id) button.dataset.entityTarget = input.id;
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

  function installEditorSwitch() {
    if (window.editorSwitch?.__dmRealFix) return true;
    if (typeof window.editorSwitch !== "function") return false;
    originalEditorSwitch = window.editorSwitch;
    const wrapped = function () {
      const result = originalEditorSwitch.apply(this, arguments);
      schedulePass();
      return result;
    };
    wrapped.__dmRealFix = true;
    window.editorSwitch = wrapped;
    return true;
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
      #page-appliances-main .appl-visual { min-height: 150px; padding: 14px; overflow: hidden; }
      #page-appliances-main .dm-appliance-image { display:block; width:100%; height:100%; min-height:120px; max-height:190px; object-fit:contain; object-position:center; }
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
      #tapp-avvisi { display: contents; }
      .dm-shutter-alert { border: 0; width: 100%; text-align: left; cursor: pointer; font: inherit; }
      .dm-shutter-popup-backdrop { position: fixed; inset: 0; z-index: 100004; display: grid; place-items: center; padding: 18px; background: rgba(15,23,42,.58); backdrop-filter: blur(5px); }
      .dm-shutter-popup { width: min(520px,100%); max-height: min(680px,90vh); overflow: auto; padding: 20px; border-radius: 24px; color: var(--text,#0f172a); background: var(--card-bg,#fff); box-shadow: 0 24px 70px rgba(15,23,42,.3); }
      .dm-shutter-popup header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
      .dm-shutter-popup h2 { margin:0; font-size:20px; }
      .dm-shutter-popup header button { border:0; border-radius:50%; width:40px; height:40px; font-size:26px; cursor:pointer; }
      .dm-shutter-popup-row { display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--card-border,#e2e8f0); border-radius:16px; margin-top:8px; }
      .dm-shutter-popup-row span:last-child { display:grid; gap:3px; min-width:0; }
      .dm-shutter-popup-row small { color:var(--text-dim,#64748b); }
      .dm-temperature-card-icon { flex:0 0 42px; display:grid; place-items:center; font-size:28px; }
      .dm-temperature-form { display:grid; gap:10px; }
      .dm-temperature-form .ed-slot { display:grid; gap:5px; }
      .dm-temperature-actions { display:flex; gap:8px; }
      .dm-temperature-actions .ed-btn-add { flex:1; }
      .dm-temperature-no-rooms .ed-btn-add { margin-top:12px; }
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

  function attachBodyObserver() {
    const body = document.getElementById("ed-body");
    if (!body || body === observedBody) return;
    bodyObserver?.disconnect();
    observedBody = body;
    bodyObserver = new MutationObserver(schedulePass);
    bodyObserver.observe(body, { childList: true, subtree: true });
  }

  function installAll() {
    const appliancesReady = installApplianceRenderer();
    const lightsReady = installLightRuntime();
    const editorReady = installEditorSwitch();
    attachBodyObserver();
    if (appliancesReady && lightsReady && editorReady && installTimer) {
      clearInterval(installTimer);
      installTimer = null;
    }
  }

  function runPass() {
    passScheduled = false;
    installAll();
    repairRenderedLightEditor();
    mountEntityPickers();
    repairRenderedAppliances();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    setTimeout(runPass, 0);
  }

  function start() {
    injectStyles();
    document.addEventListener("click", delegatedPickerClick, true);
    documentObserver = new MutationObserver(function () {
      attachBodyObserver();
      schedulePass();
    });
    documentObserver.observe(document.documentElement, { childList: true, subtree: true });

    try {
      const store = window.DashboardModernModules?.store;
      if (typeof store?.subscribe === "function") store.subscribe(schedulePass);
    } catch (_error) {}

    installAll();
    schedulePass();
    renderShutterAlert();
    shutterTimer = setInterval(renderShutterAlert, 500);
    window.addEventListener(
      "pagehide",
      function () {
        if (shutterTimer) clearInterval(shutterTimer);
        shutterTimer = null;
        bodyObserver?.disconnect();
        documentObserver?.disconnect();
      },
      { once: true },
    );
    installTimer = setInterval(installAll, 100);
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
