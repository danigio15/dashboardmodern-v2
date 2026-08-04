/* DashboardModern 0.15.1 — safe live Temperature projection for real Home Assistant. */
(function installRealHaTemperatureStability0151(root) {
  "use strict";

  const KEY = "__DASHBOARDMODERN_REAL_HA_TEMPERATURE_STABILITY_0151__";
  if (!root.document || root[KEY]?.installed) return;

  const doc = root.document;
  const state = (root[KEY] = {
    installed: true,
    wrapped: new WeakSet(),
    scheduled: false,
    deleting: new Set(),
  });
  const clean = (value) => String(value ?? "").trim();
  const store = () => root.DashboardModernModules?.store || null;

  function states() {
    let lexicalStates = {};
    let lexicalRaw = {};
    try {
      lexicalStates = root.eval?.('typeof STATES !== "undefined" ? STATES : {}') || {};
      lexicalRaw = root.eval?.('typeof _RAW_STATES !== "undefined" ? _RAW_STATES : {}') || {};
    } catch (_error) {}
    return { ...lexicalRaw, ...lexicalStates, ...(root._RAW_STATES || {}), ...(root.STATES || {}) };
  }

  function valueFor(entity) {
    if (!clean(entity)) return "";
    const value = states()[entity]?.state;
    return ["unknown", "unavailable", "none", "null", "undefined", ""].includes(
      clean(value).toLowerCase(),
    )
      ? ""
      : clean(value);
  }

  function findCard(room, index) {
    const roomId = clean(room.id);
    return (
      [...doc.querySelectorAll("#temp-grid .temp-card")].find(
        (card) => clean(card.dataset.roomId) === roomId,
      ) ||
      [...doc.querySelectorAll("#temp-grid .temp-card")].find(
        (card) => clean(card.querySelector(".cp-name")?.textContent).toLowerCase() === clean(room.name).toLowerCase(),
      ) ||
      doc.querySelectorAll("#temp-grid .temp-card")[index] ||
      null
    );
  }

  function setText(node, value) {
    if (!node || !value) return;
    if (clean(node.textContent).replace(/[%°]/g, "") !== value) node.textContent = value;
  }

  function removeFlame(card) {
    const walker = doc.createTreeWalker(card, root.NodeFilter?.SHOW_TEXT || 4);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      if (node.nodeValue?.includes("🔥")) node.nodeValue = node.nodeValue.replaceAll("🔥", "").trim();
    });
    card.querySelectorAll("[data-heat-state],.temp-heat,.temp-flame,.cp-state").forEach((node) => {
      if (clean(node.textContent) === "🔥") node.remove();
    });
    card.dataset.dmNoFlame = "true";
  }

  function settleCardLayout(card) {
    card.style.removeProperty("display");
    card.style.setProperty("min-height", "110px", "important");
    card.style.setProperty("height", "auto", "important");

    const name = card.querySelector(".cp-name");
    const values = card.querySelector(".temp-values,.temp-card-body");
    if (!name || !values || !card.isConnected) return;

    values.style.removeProperty("margin-top");
    const nameBox = name.getBoundingClientRect();
    const valuesBox = values.getBoundingClientRect();
    if (!nameBox.height || !valuesBox.height) return;
    const overlap = nameBox.bottom - valuesBox.top;
    if (overlap > 1) {
      values.style.setProperty("margin-top", `${Math.ceil(overlap + 4)}px`, "important");
    }
  }

  function applyTemperatureLive() {
    const rooms = (store()?.getSection?.("rooms") || []).filter((room) => clean(room.temp));
    const matched = new Set();

    rooms.forEach((room, index) => {
      const card = findCard(room, index);
      if (!card) return;
      matched.add(card);
      card.dataset.roomId = clean(room.id);
      const temperature = valueFor(room.temp);
      const humidity = valueFor(room.hum);
      const tempId = `tv_${clean(room.temp).replace(/\./g, "_")}`;
      const humId = room.hum ? `hv_${clean(room.hum).replace(/\./g, "_")}` : "";
      const tempNode = doc.getElementById(tempId) || card.querySelector(".temp-value,.cp-temp-current,.temp-number");
      const humNode = (humId && doc.getElementById(humId)) || card.querySelector(".temp-hum-val,.humidity-value");
      setText(tempNode, temperature);
      setText(humNode, humidity);
      if (humNode && humidity) humNode.textContent = `${humidity}%`;
      removeFlame(card);
      settleCardLayout(card);
    });

    doc.querySelectorAll("#temp-grid .temp-card").forEach((card) => {
      if (!matched.has(card)) card.remove();
    });
    return true;
  }

  function wrap(name) {
    const current = root[name];
    if (
      typeof current !== "function" ||
      state.wrapped.has(current) ||
      current.__dmRealHaTemperature0151
    ) {
      return false;
    }
    function safeTemperatureRenderer0151() {
      let result;
      try {
        result = current.apply(this, arguments);
      } catch (error) {
        root.console?.warn?.(`[DashboardModern 0.15.1] ${name}`, error);
      }
      const finish = () => root.queueMicrotask?.(applyTemperatureLive);
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    safeTemperatureRenderer0151.__dmRealHaTemperature0151 = true;
    safeTemperatureRenderer0151.__dmPrevious = current;
    state.wrapped.add(current);
    state.wrapped.add(safeTemperatureRenderer0151);
    root[name] = safeTemperatureRenderer0151;
    return true;
  }

  function installHooks() {
    wrap("buildTempCards");
    wrap("renderTemperature");
  }

  function schedule() {
    if (state.scheduled) return;
    state.scheduled = true;
    root.queueMicrotask?.(() => {
      state.scheduled = false;
      installHooks();
      applyTemperatureLive();
    });
  }

  async function deleteTemperature(button) {
    const roomId = clean(button.closest("[data-room-id]")?.dataset?.roomId);
    const dashboardStore = store();
    if (!roomId || !dashboardStore?.updateItem || state.deleting.has(roomId)) return;
    state.deleting.add(roomId);
    try {
      await dashboardStore.updateItem("rooms", roomId, { temp: "", hum: "" });
      schedule();
    } catch (error) {
      root.console?.warn?.("[DashboardModern 0.15.1] Temperature delete", error);
    } finally {
      state.deleting.delete(roomId);
    }
  }

  function handleClick(event) {
    const remove = event.target?.closest?.("[data-temperature-delete]");
    if (remove) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void deleteTemperature(remove);
      return;
    }
    if (event.target?.closest?.('[data-page="temperature"],[data-tab="temperature"],[data-tab="temp"]')) {
      schedule();
      root.setTimeout?.(applyTemperatureLive, 40);
    }
  }

  state.apply = applyTemperatureLive;
  state.installHooks = installHooks;
  state.deleteTemperature = deleteTemperature;
  root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
  root.addEventListener?.("dashboardmodern:state-changed", schedule);
  root.addEventListener?.("pageshow", schedule);
  doc.addEventListener("click", handleClick, true);

  installHooks();
  schedule();
  [80, 260, 700].forEach((delay) => root.setTimeout?.(schedule, delay));
})(globalThis);
