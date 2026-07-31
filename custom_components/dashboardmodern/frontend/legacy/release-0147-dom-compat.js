/* Stable DOM compatibility markers for audited 0.14.7 editor flows. */
function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function decorateShutterRows() {
  document.querySelectorAll("[data-tapp-id]").forEach((row, index) => {
    const edit = row.querySelector("[data-tapp-edit]");
    if (edit) edit.dataset.tappEdit = String(index);
    row.dataset.tappIndex = String(index);
  });
}

function bindStandardAlertButton(button, group, entity) {
  button.removeAttribute("onclick");
  button.dataset.standardAlertEdit = "";
  button.dataset.standardAlertGroup = group;
  button.dataset.standardAlertEntity = entity;
  button.type = "button";
  button.classList.add("ed-del");
  button.textContent = "✏️";
  button.title = document.documentElement.lang === "en" ? "Edit" : "Modifica";
  if (button.dataset.standardAlertMounted !== "true") {
    button.dataset.standardAlertMounted = "true";
    button.addEventListener("click", () => {
      const edit = globalThis.dmRealEditAlert || globalThis.edEditAvvisoStandard;
      edit?.(
        button.dataset.standardAlertGroup,
        button.dataset.standardAlertEntity,
      );
    });
  }
  const accordion = button.closest("details.ed-acc");
  if (accordion) accordion.open = true;
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

      // The real-HA compatibility layer owns the final edit control. Once its
      // button exists, never recreate the older standard button: the previous
      // add/remove race caused duplicate controls and occasionally reopened an
      // empty form on slower WebKit devices.
      if (row.querySelector("[data-real-alert-edit]")) {
        row.querySelectorAll("[data-standard-alert-edit]").forEach((button) => button.remove());
        return;
      }

      let button = row.querySelector("[data-standard-alert-edit]");
      if (!button) {
        button = document.createElement("button");
        const remove = [...row.querySelectorAll(".ed-del")].find(
          (node) => node.textContent.includes("🗑️"),
        );
        if (remove) remove.before(button);
        else row.append(button);
      }
      bindStandardAlertButton(button, group, entity);
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
    icon.dataset.roomIcon = room.icon || "mdi:home";
    icon.textContent = roomGlyph(room.icon || "mdi:home");
  });
}

function decorateApplianceAssetMarkers() {
  document.querySelectorAll(".appl-main-view").forEach((view) => {
    const active = view.classList.contains("active");
    view.querySelectorAll(".dm-appliance-art").forEach((asset) => {
      const key = asset.dataset.applianceAsset || asset.dataset.applianceAssetKey || "";
      if (!key) return;
      asset.dataset.applianceAssetKey = key;
      if (active) asset.dataset.applianceAsset = key;
      else asset.removeAttribute("data-appliance-asset");
    });
  });
}

function installApplianceRenderHook() {
  const render = globalThis.renderApplianceSection;
  if (typeof render !== "function" || render.__dm0147AssetMarkers) return;
  function renderApplianceSection0147(...args) {
    const result = render.apply(this, args);
    decorateApplianceAssetMarkers();
    return result;
  }
  renderApplianceSection0147.__dm0147AssetMarkers = true;
  globalThis.renderApplianceSection = renderApplianceSection0147;
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
  new MutationObserver(decorate).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
}
