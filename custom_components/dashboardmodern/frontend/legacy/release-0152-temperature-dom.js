/* DashboardModern 0.14.12: remove the duplicate Temperature icon editor at its DOM boundary. */
const TEMPERATURE_DOM_FLAG = "__DASHBOARDMODERN_RELEASE_0152_TEMPERATURE_DOM__";

function isEnglish() {
  return document.documentElement.lang === "en";
}

function copy(it, en) {
  return isEnglish() ? en : it;
}

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

function cleanTemperatureLabels(form) {
  form.querySelectorAll(".ed-slot-lbl").forEach((label) => {
    label.childNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !/[✏️🖉]/u.test(node.nodeValue || "")) return;
      node.nodeValue = String(node.nodeValue || "").replace(/[✏️🖉]/gu, "").trimEnd();
    });
  });

  const intro = form.parentElement?.querySelector("[data-temperature-editor]");
  const message = copy(
    "Seleziona una stanza già creata e associa i sensori di temperatura e umidità. Nome e icona si modificano esclusivamente nella sezione Stanze.",
    "Select an existing room and associate its temperature and humidity sensors. Name and icon are edited exclusively in Rooms.",
  );
  if (intro && intro.textContent !== message) intro.textContent = message;

  const submit = form.querySelector("[data-temperature-submit]");
  const submitLabel = copy("ASSOCIA SENSORI", "ASSOCIATE SENSORS");
  if (submit && submit.textContent !== submitLabel) submit.textContent = submitLabel;
}

function removeDuplicateIconEditor() {
  const form = document.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return;
  cleanTemperatureLabels(form);

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

  // Keep the original input object because the legacy submit closure references
  // it. The input is nested inside .dm-icon-field, not a direct child of the
  // label, so detach it through its actual parent before removing the row.
  if (field && field !== form) {
    iconInput.remove();
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
