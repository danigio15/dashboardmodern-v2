/* Language-independent edit controls for saved standard alerts. */
const ALERT_COMPAT_FLAG = "__DASHBOARDMODERN_REAL_HA_0147_ALERT_COMPAT__";

function readGroups() {
  try {
    return JSON.parse(localStorage.getItem("cd_gruppi_extra")) || {};
  } catch (_error) {
    return {};
  }
}

function entityFromRow(row) {
  const text = row.querySelector(".ed-row-old.mono")?.textContent || "";
  return text.match(/\b[a-z_][a-z0-9_]*\.[a-z0-9_]+\b/i)?.[0] || "";
}

function groupForEntity(entity, row) {
  const groups = readGroups();
  const saved = Object.entries(groups).find(([, ids]) => Array.isArray(ids) && ids.includes(entity));
  if (saved) return saved[0];
  const text = `${row.textContent || ""} ${row.closest("details")?.querySelector("summary")?.textContent || ""}`.toLowerCase();
  if (/apert|contact|door|window/.test(text)) return "win";
  if (/batter/.test(text)) return "batt";
  if (/luc|light/.test(text)) return "luci";
  if (/clima|climate/.test(text)) return "clima";
  if (/riscald|heating/.test(text)) return "risc";
  return "";
}

function bindAlertEditButton(button, group, entity) {
  button.removeAttribute("onclick");
  button.type = "button";
  button.classList.add("ed-del", "dm-edit-button");
  button.dataset.standardAlertEdit = "";
  button.dataset.realAlertEdit = "";
  button.dataset.standardAlertGroup = group;
  button.dataset.standardAlertEntity = entity;
  button.dataset.alertGroup = group;
  button.dataset.alertEntity = entity;
  button.textContent = "✏️";
  button.title = document.documentElement.lang === "en" ? "Edit" : "Modifica";
  button.setAttribute("aria-label", button.title);
  if (button.dataset.alertEditMounted !== "true") {
    button.dataset.alertEditMounted = "true";
    button.addEventListener("click", () => {
      const edit = globalThis.dmRealEditAlert || globalThis.edEditAvvisoStandard;
      edit?.(button.dataset.alertGroup, button.dataset.alertEntity);
    });
  }
}

function installAlertEditButtons(root = document) {
  root.querySelectorAll("#editor-modal .ed-row").forEach((row) => {
    const entity = entityFromRow(row);
    const group = entity && groupForEntity(entity, row);
    if (!entity || !group) return;

    let edit = row.querySelector("[data-standard-alert-edit], [data-real-alert-edit]");
    if (!edit) {
      const remove = [...row.querySelectorAll(".ed-del")].find((button) =>
        /edDelAvviso/.test(button.getAttribute("onclick") || "") || button.textContent.includes("🗑️"),
      );
      if (!remove) return;
      edit = document.createElement("button");
      remove.before(edit);
    }
    bindAlertEditButton(edit, group, entity);

    row.querySelectorAll("[data-standard-alert-edit], [data-real-alert-edit]").forEach((candidate) => {
      if (candidate !== edit) candidate.remove();
    });
  });
}

function install() {
  installAlertEditButtons();
  if (globalThis[ALERT_COMPAT_FLAG]?.installed) return;
  globalThis[ALERT_COMPAT_FLAG] = { installed: true };
  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => installAlertEditButtons());
  }).observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
  window.addEventListener("dashboardmodern:legacy-ready", install);
}
