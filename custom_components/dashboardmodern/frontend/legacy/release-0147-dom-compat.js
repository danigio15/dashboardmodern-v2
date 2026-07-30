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

function decorateStandardAlerts() {
  const groups = readJson("cd_gruppi_extra", {});
  document.querySelectorAll("[data-standard-alert-edit]").forEach((button) => {
    const row = button.closest(".ed-row");
    const entity = row?.querySelector(".ed-row-old.mono")?.textContent?.trim() || "";
    const group = Object.entries(groups).find(([, entities]) =>
      Array.isArray(entities) && entities.includes(entity),
    )?.[0];
    if (!group || !entity) return;
    button.removeAttribute("onclick");
    button.dataset.standardAlertGroup = group;
    button.dataset.standardAlertEntity = entity;
    if (button.dataset.standardAlertMounted !== "true") {
      button.dataset.standardAlertMounted = "true";
      button.addEventListener("click", () =>
        globalThis.edEditAvvisoStandard?.(
          button.dataset.standardAlertGroup,
          button.dataset.standardAlertEntity,
        ),
      );
    }
    const accordion = button.closest("details.ed-acc");
    if (accordion) accordion.open = true;
  });
}

function decorateAll() {
  decorateShutterRows();
  decorateStandardAlerts();
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
  new MutationObserver(decorate).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}
