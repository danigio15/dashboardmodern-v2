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
    button.addEventListener("click", () =>
      globalThis.edEditAvvisoStandard?.(
        button.dataset.standardAlertGroup,
        button.dataset.standardAlertEntity,
      ),
    );
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
