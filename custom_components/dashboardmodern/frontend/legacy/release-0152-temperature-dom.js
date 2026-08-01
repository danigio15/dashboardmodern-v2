/* DashboardModern 0.14.12: remove the duplicate Temperature icon editor at its DOM boundary. */
const TEMPERATURE_DOM_FLAG = "__DASHBOARDMODERN_RELEASE_0152_TEMPERATURE_DOM__";

function canonicalRooms() {
  return globalThis.DashboardModernModules?.store?.getSection?.("rooms") || [];
}

function syncCanonicalIcon(form, iconInput) {
  const select = form.querySelector("#dm-temperature-room");
  const room = canonicalRooms().find(
    (item) => String(item.id || "") === String(select?.value || ""),
  );
  if (room?.icon) iconInput.value = String(room.icon);
}

function installStyles() {
  if (document.getElementById("dm-release-0152-temperature-dom-styles")) return;
  const style = document.createElement("style");
  style.id = "dm-release-0152-temperature-dom-styles";
  style.textContent = `
    #editor-modal [data-temperature-form] .dm-temperature-actions button,
    #editor-modal [data-temperature-form] [data-temperature-submit],
    #editor-modal [data-temperature-form] [data-temperature-cancel] {
      min-height: 44px !important;
    }
  `;
  document.head.append(style);
}

function removeDuplicateIconEditor() {
  const form = document.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return;

  const iconInput = form.querySelector("#dm-temperature-icon");
  if (!iconInput) return;

  iconInput.type = "hidden";
  iconInput.tabIndex = -1;
  iconInput.hidden = true;
  iconInput.setAttribute("aria-hidden", "true");

  const field =
    iconInput.closest("label.ed-slot") ||
    iconInput.closest("[data-icon-field]") ||
    iconInput.parentElement;

  // Keep the original input node because the legacy submit closure references
  // that exact object. Move it out of the visible label, then remove the whole
  // duplicate row so "Simbolo/Icon" no longer exists in the editor DOM.
  if (field && field !== form) {
    field.removeChild(iconInput);
    field.remove();
    form.append(iconInput);
  }

  if (form.dataset.dmCanonicalIconBinding !== "true") {
    form.dataset.dmCanonicalIconBinding = "true";
    const sync = () => syncCanonicalIcon(form, iconInput);
    form.querySelector("#dm-temperature-room")?.addEventListener("change", sync);
    form.addEventListener("submit", sync, true);
  }
  syncCanonicalIcon(form, iconInput);
}

function install() {
  if (globalThis[TEMPERATURE_DOM_FLAG]?.installed) return;
  globalThis[TEMPERATURE_DOM_FLAG] = { installed: true, version: "0.14.12" };
  installStyles();

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(removeDuplicateIconEditor);
  };
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  globalThis.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  schedule();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
}
