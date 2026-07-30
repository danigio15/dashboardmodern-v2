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

function installAlertEditButtons(root = document) {
  root.querySelectorAll("#editor-modal .ed-row").forEach((row) => {
    const entity = entityFromRow(row);
    const group = entity && groupForEntity(entity, row);
    if (!entity || !group || typeof globalThis.dmRealEditAlert !== "function") return;

    row.querySelectorAll("[data-standard-alert-edit]").forEach((button) => button.remove());
    if (row.querySelector("[data-real-alert-edit]")) return;

    const remove = [...row.querySelectorAll(".ed-del")].find((button) =>
      /edDelAvviso/.test(button.getAttribute("onclick") || ""),
    );
    if (!remove) return;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ed-del dm-edit-button";
    edit.dataset.realAlertEdit = "";
    edit.textContent = "✏️";
    edit.title = document.documentElement.lang === "en" ? "Edit" : "Modifica";
    edit.setAttribute("aria-label", edit.title);
    edit.addEventListener("click", () => globalThis.dmRealEditAlert(group, entity));
    remove.before(edit);
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
