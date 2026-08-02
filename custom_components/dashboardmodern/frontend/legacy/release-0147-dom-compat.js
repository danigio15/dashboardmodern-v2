/* Stable, idempotent DOM compatibility markers for audited editor flows. */
const OBSERVER_KEY = "__DASHBOARDMODERN_0147_DOM_COMPAT_OBSERVER__";

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function setData(node, key, value) {
  if (!node?.dataset || node.dataset[key] === value) return false;
  node.dataset[key] = value;
  return true;
}

function setAttribute(node, name, value) {
  if (!node || node.getAttribute(name) === value) return false;
  node.setAttribute(name, value);
  return true;
}

function setText(node, value) {
  if (!node || node.textContent === value) return false;
  node.textContent = value;
  return true;
}

function decorateShutterRows() {
  document.querySelectorAll("[data-tapp-id]").forEach((row, index) => {
    const value = String(index);
    setData(row.querySelector("[data-tapp-edit]"), "tappEdit", value);
    setData(row, "tappIndex", value);
  });
}

function bindStandardAlertButton(button, group, entity) {
  if (button.hasAttribute("onclick")) button.removeAttribute("onclick");
  setData(button, "standardAlertEdit", "");
  setData(button, "realAlertEdit", "");
  setData(button, "standardAlertGroup", group);
  setData(button, "standardAlertEntity", entity);
  setData(button, "alertGroup", group);
  setData(button, "alertEntity", entity);
  if (button.type !== "button") button.type = "button";
  button.classList.add("ed-del", "dm-edit-button");
  setText(button, "✏️");
  const title = document.documentElement.lang === "en" ? "Edit" : "Modifica";
  if (button.title !== title) button.title = title;
  setAttribute(button, "aria-label", title);
  if (button.dataset.alertEditMounted !== "true") {
    button.dataset.alertEditMounted = "true";
    button.addEventListener("click", () => {
      const edit = globalThis.dmRealEditAlert || globalThis.edEditAvvisoStandard;
      edit?.(button.dataset.alertGroup, button.dataset.alertEntity);
    });
  }
  const accordion = button.closest("details.ed-acc");
  if (accordion && !accordion.open) accordion.open = true;
}

function standardAlertRow(entity) {
  return [...document.querySelectorAll("#ed-body .ed-row-old.mono")]
    .find((node) => {
      const value = node.textContent.trim();
      return value === entity || value.endsWith(` · ${entity}`) || value.endsWith(entity);
    })
    ?.closest(".ed-row");
}

function decorateStandardAlerts() {
  const groups = readJson("cd_gruppi_extra", {});
  Object.entries(groups).forEach(([group, entities]) => {
    if (!Array.isArray(entities)) return;
    entities.forEach((entity) => {
      const row = standardAlertRow(entity);
      if (!row) return;

      let button = row.querySelector("[data-standard-alert-edit], [data-real-alert-edit]");
      if (!button) {
        button = document.createElement("button");
        const remove = [...row.querySelectorAll(".ed-del")].find(
          (node) => node.textContent.includes("🗑️"),
        );
        if (remove) remove.before(button);
        else row.append(button);
      }
      bindStandardAlertButton(button, group, entity);
      row.querySelectorAll("[data-standard-alert-edit], [data-real-alert-edit]").forEach((candidate) => {
        if (candidate !== button) candidate.remove();
      });
    });
  });
}

function roomGlyph(icon) {
  const value = String(icon || "").toLowerCase();
  if (value && !value.startsWith("mdi:")) return String(icon);
  if (/sofa|living|television/.test(value)) return "🛋️";
  if (/bed/.test(value)) return "🛏️";
  if (/silverware|food|kitchen|stove/.test(value)) return "🍽️";
  if (/shower|bath|toilet/.test(value)) return "🚿";
  if (/baby|crib/.test(value)) return "👶";
  if (/desk|office|monitor/.test(value)) return "🖥️";
  if (/garage|car/.test(value)) return "🚗";
  if (/tree|garden|flower/.test(value)) return "🌳";
  return "🏠";
}

function decorateTemperatureIcons() {
  const rooms = globalThis.DashboardModernModules?.store?.getSection?.("rooms") || [];
  document.querySelectorAll("#temp-grid .temp-card").forEach((card, index) => {
    const name = card.querySelector(".cp-name")?.textContent?.trim() || "";
    const room = rooms.find((item) => item.name === name) || rooms.filter((item) => item.temp)[index];
    const icon = card.querySelector(".cp-icon");
    if (!room || !icon) return;
    icon.classList.add("temp-room-icon");
    const value = room.icon || "mdi:home";
    setData(icon, "roomIcon", value);
    setText(icon, roomGlyph(value));
  });
}

function decorateApplianceAssetMarkers() {
  document.querySelectorAll(".appl-main-view").forEach((view) => {
    const active = view.classList.contains("active");
    view.querySelectorAll(".dm-appliance-art").forEach((asset) => {
      const key = asset.dataset.applianceAsset || asset.dataset.applianceAssetKey || "";
      if (!key) return;
      setData(asset, "applianceAssetKey", key);
      if (active) setData(asset, "applianceAsset", key);
      else if (asset.hasAttribute("data-appliance-asset")) asset.removeAttribute("data-appliance-asset");
    });
  });
}

function installApplianceRenderHook() {
  const render = globalThis.renderApplianceSection;
  if (typeof render !== "function" || render.__dm0147AssetMarkers) return false;
  function renderApplianceSection0147(...args) {
    const result = render.apply(this, args);
    if (result && typeof result.finally === "function") {
      return result.finally(decorateApplianceAssetMarkers);
    }
    decorateApplianceAssetMarkers();
    return result;
  }
  renderApplianceSection0147.__dm0147AssetMarkers = true;
  renderApplianceSection0147.__dmPrevious = render;
  globalThis.renderApplianceSection = renderApplianceSection0147;
  return true;
}

function decorateAll() {
  decorateShutterRows();
  decorateStandardAlerts();
  decorateTemperatureIcons();
  decorateApplianceAssetMarkers();
  installApplianceRenderHook();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  let frame = 0;
  const decorate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(decorateAll);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", decorate, { once: true });
  } else {
    decorate();
  }
  const timer = window.setInterval(() => {
    decorateAll();
    if (globalThis.renderApplianceSection?.__dm0147AssetMarkers) window.clearInterval(timer);
  }, 100);
  if (!globalThis[OBSERVER_KEY]) {
    globalThis[OBSERVER_KEY] = new MutationObserver(decorate);
    globalThis[OBSERVER_KEY].observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }
}
