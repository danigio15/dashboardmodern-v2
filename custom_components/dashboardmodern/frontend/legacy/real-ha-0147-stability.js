/* Stability layer for the real Home Assistant 0.14.7 acceptance fixes. */
const STABILITY_FLAG = "__DASHBOARDMODERN_REAL_HA_0147_STABILITY__";
const isEnglish = () => document.documentElement.lang === "en";

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch (_error) {
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

function addClass(node, token) {
  if (!node?.classList || node.classList.contains(token)) return false;
  node.classList.add(token);
  return true;
}

function removeClass(node, token) {
  if (!node?.classList?.contains(token)) return false;
  node.classList.remove(token);
  return true;
}

function setText(node, value) {
  if (!node || node.textContent === value) return false;
  node.textContent = value;
  return true;
}

function setStyle(node, property, value) {
  if (!node?.style || node.style[property] === value) return false;
  node.style[property] = value;
  return true;
}

/*
 * runtime-hotfix.js and real-ha-0147-fixes.js use different wrapper markers.
 * Mark the current implementation for both layers before either retry loop can
 * wrap it again. This prevents A -> B -> A recursion regardless of load order.
 */
function markCurrentWrappers() {
  [
    "editorRenderAppliances",
    "editorRenderAvvisi",
    "editorRenderLuci",
    "edApplSave",
    "edAddAvviso",
    "cdLuceAdd",
    "dmCallHaService",
  ].forEach((name) => {
    const value = globalThis[name];
    if (typeof value !== "function") return;
    try {
      value.__dmRealHa0147 = true;
      value.__dmRealFix = true;
    } catch (_error) {}
  });
}

function stabilizePowerButtons(root = document) {
  root.querySelectorAll("#page-appliances-main .appl-wide-card.dm-control-device").forEach((card) => {
    const button = [...card.querySelectorAll(".appl-action-btn, .dm-appliance-power-toggle")].find(
      (candidate) =>
        candidate.classList.contains("dm-appliance-power-toggle") ||
        candidate.textContent.trim() === "⏻" ||
        candidate.dataset.dmPowerToggle === "true",
    );
    if (!button) return;
    const on = button.classList.contains("on");
    const label = on
      ? isEnglish()
        ? "Turn off"
        : "Spegni"
      : isEnglish()
        ? "Turn on"
        : "Accendi";
    setText(button, label);
    setData(button, "dmPowerToggle", "true");
    removeClass(button, "appl-action-btn");
    addClass(button, "dm-appliance-power-toggle");
    setAttribute(button, "aria-label", label);
  });
}

function alertGroupForEntity(entity, row) {
  const extras = readJson("cd_gruppi_extra", {});
  const explicit = Object.entries(extras).find(([, ids]) => Array.isArray(ids) && ids.includes(entity));
  if (explicit) return explicit[0];
  const text = row.closest("details")?.querySelector("summary")?.textContent?.toLowerCase() || "";
  if (/apert|contact|door|window/.test(text)) return "win";
  if (/batter/.test(text)) return "batt";
  if (/luc|light/.test(text)) return "luci";
  if (/clima|climate/.test(text)) return "clima";
  if (/riscald|heating/.test(text)) return "risc";
  return "";
}

function bindStableAlertEditButton(button, group, entity) {
  if (button.hasAttribute("onclick")) button.removeAttribute("onclick");
  if (button.type !== "button") button.type = "button";
  addClass(button, "ed-del");
  addClass(button, "dm-edit-button");
  setData(button, "standardAlertEdit", "");
  setData(button, "realAlertEdit", "");
  setData(button, "standardAlertGroup", group);
  setData(button, "standardAlertEntity", entity);
  setData(button, "alertGroup", group);
  setData(button, "alertEntity", entity);
  setText(button, "✏️");
  const title = isEnglish() ? "Edit" : "Modifica";
  if (button.title !== title) button.title = title;
  setAttribute(button, "aria-label", title);
  if (button.dataset.alertEditMounted !== "true") {
    button.dataset.alertEditMounted = "true";
    button.addEventListener("click", () => {
      const edit = globalThis.dmRealEditAlert || globalThis.edEditAvvisoStandard;
      edit?.(button.dataset.alertGroup, button.dataset.alertEntity);
    });
  }
}

function stabilizeAlertEditButtons(root = document) {
  root.querySelectorAll("#editor-modal .ed-row").forEach((row) => {
    const entity = row.querySelector(".ed-row-old.mono")?.textContent?.trim();
    if (!entity || !entity.includes(".")) return;
    const group = alertGroupForEntity(entity, row);
    if (!group) return;

    const candidates = [
      ...row.querySelectorAll("[data-real-alert-edit], [data-standard-alert-edit]"),
    ];
    let editButton = candidates.find((button) => button.hasAttribute("data-real-alert-edit"));
    editButton ||= candidates[0] || null;

    if (!editButton) {
      const removeButton = [...row.querySelectorAll(".ed-del")].find(
        (button) =>
          /edDelAvviso/.test(button.getAttribute("onclick") || "") ||
          button.textContent.includes("🗑️"),
      );
      if (!removeButton) return;
      editButton = document.createElement("button");
      removeButton.before(editButton);
    }

    bindStableAlertEditButton(editButton, group, entity);
    candidates.forEach((candidate) => {
      if (candidate !== editButton && candidate.isConnected) candidate.remove();
    });
  });
}

function stabilizeReportRows(root = document) {
  root.querySelectorAll("#editor-modal [data-energy-panel='report'] .dm-report-row").forEach((row) => {
    setData(row, "realReportStable", "true");
    const fields = row.querySelector(":scope > .dm-report-fields");
    if (!fields) return;
    fields.querySelectorAll(".dm-config-field, [data-entity-field], [data-icon-field]").forEach((field) => {
      setStyle(field, "gridArea", "auto");
      setStyle(field, "width", "100%");
      setStyle(field, "minWidth", "0px");
    });
  });
}

function stabilize(root = document) {
  markCurrentWrappers();
  stabilizePowerButtons(root);
  stabilizeAlertEditButtons(root);
  stabilizeReportRows(root);
}

function installCss() {
  if (document.getElementById("dm-real-ha-0147-stability-css")) return;
  const style = document.createElement("style");
  style.id = "dm-real-ha-0147-stability-css";
  style.textContent = `
    #page-appliances-main .dm-appliance-power-toggle {
      min-width: 86px;
      min-height: 38px;
      padding: 8px 12px;
      border: 1px solid var(--card-border, #dbe4ee);
      border-radius: 11px;
      background: var(--surface-3, #f1f5f9);
      color: var(--text, #0f172a);
      font: inherit;
      font-size: 12px;
      font-weight: 850;
      cursor: pointer;
    }
    #page-appliances-main .dm-appliance-power-toggle.on {
      background: rgba(239,68,68,.12);
      border-color: rgba(239,68,68,.24);
      color: #b91c1c;
    }

    #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"] {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      grid-template-areas: "toggle actions" "fields fields" !important;
      gap: 12px !important;
      align-items: center !important;
    }
    #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"] > .dm-report-toggle {
      grid-area: toggle !important;
    }
    #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"] > .dm-report-fields {
      grid-area: fields !important;
      display: grid !important;
      grid-template-columns: minmax(150px,.75fr) minmax(130px,.45fr) minmax(240px,1.3fr) !important;
      gap: 10px !important;
      align-items: end !important;
      width: 100% !important;
      min-width: 0 !important;
    }
    #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"] > .dm-report-actions {
      grid-area: actions !important;
    }
    #editor-modal [data-energy-panel="report"] .dm-report-fields > .dm-config-field,
    #editor-modal [data-energy-panel="report"] .dm-report-fields > [data-entity-field],
    #editor-modal [data-energy-panel="report"] .dm-report-fields > [data-icon-field],
    #editor-modal [data-energy-panel="report"] .dm-report-fields [data-report-label] {
      grid-area: auto !important;
      width: 100% !important;
      min-width: 0 !important;
      margin: 0 !important;
    }
    #editor-modal [data-energy-panel="report"] .dm-report-fields [data-entity-field] .ed-form-row {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) 42px !important;
      gap: 8px !important;
      width: 100% !important;
    }

    @media (max-width: 700px) {
      #page-appliances-main .dm-appliance-power-toggle {
        min-width: 78px;
        min-height: 38px;
        padding-inline: 9px;
        font-size: 11px;
      }
      #editor-modal [data-energy-panel="report"] .dm-report-row[data-real-report-layout="true"] > .dm-report-fields {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.append(style);
}

function install() {
  installCss();
  stabilize();
  if (globalThis[STABILITY_FLAG]?.installed) return;
  globalThis[STABILITY_FLAG] = { installed: true };

  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => stabilize());
  }).observe(document.documentElement, { childList: true, subtree: true });

  let attempts = 0;
  const guardTimer = setInterval(() => {
    attempts += 1;
    stabilize();
    if (attempts >= 300) clearInterval(guardTimer);
  }, 50);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
  window.addEventListener("dashboardmodern:legacy-ready", install);
}
