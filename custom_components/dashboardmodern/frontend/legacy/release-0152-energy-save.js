/* DashboardModern 0.14.12: non-blocking Energy editor save boundary. */
const ENERGY_SAVE_FLAG = "__DASHBOARDMODERN_RELEASE_0152_ENERGY_SAVE__";

function isEnglish() {
  return document.documentElement.lang === "en";
}

function copy(it, en) {
  return isEnglish() ? en : it;
}

function collectEnergyModel(root, store) {
  const model = store.getSection("energy") || {};
  root.querySelectorAll('input[name*="."]').forEach((input) => {
    const [group, key] = input.name.split(".");
    if (!group || !key) return;
    model[group] ||= {};
    model[group][key] = String(input.value || "").trim();
  });
  model.metadata = {
    ...(model.metadata || {}),
    semantics_version: 3,
    cumulative_statistics: true,
  };
  return model;
}

function invalidTotalInputs(root) {
  return [...root.querySelectorAll("[data-energy-total-field] input")].filter(
    (input) => input.dataset.validation === "invalid",
  );
}

function patchEnergySave() {
  const root = document.querySelector('[data-editor="energy"]');
  const current = root?.querySelector("[data-energy-save]");
  if (!root || !current || current.dataset.dm0152Save === "true") return;

  // Replace the node to detach the legacy capture listener. Preserve its
  // classes, copy and mounted marker so older decorators do not reattach it.
  const save = current.cloneNode(true);
  save.dataset.dm0152Save = "true";
  save.dataset.dmTotalSaveMounted = "true";
  current.replaceWith(save);

  save.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const store = globalThis.DashboardModernModules?.store;
      if (!store?.getSection || !store?.replaceSection) return;
      const actions = root.querySelector("[data-energy-actions]");
      const status = actions?.querySelector("[data-energy-status]");
      if (!actions) return;

      const invalid = invalidTotalInputs(root);
      if (invalid.length) {
        actions.dataset.state = "error";
        save.disabled = false;
        if (status)
          status.textContent = copy(
            "Correggi i contatori totali evidenziati.",
            "Fix the highlighted total meters.",
          );
        invalid[0].focus();
        return;
      }

      const model = collectEnergyModel(root, store);
      actions.dataset.state = "loading";
      save.disabled = true;
      if (status) status.textContent = copy("Salvataggio Energia…", "Saving Energy…");

      // Leave the pointer/click task before persisting, syncing and requesting
      // Recorder statistics. This keeps mobile/WebKit responsive and prevents
      // a statistics refresh from holding the physical Save button press.
      setTimeout(async () => {
        try {
          await store.replaceSection("energy", model);
          actions.dataset.state = "success";
          if (status)
            status.textContent = copy(
              "Energia salvata. I periodi saranno calcolati dalle statistiche di Home Assistant.",
              "Energy saved. Period totals will be calculated from Home Assistant statistics.",
            );

          // The 0.14.12 store subscriber schedules the Recorder refresh. Render
          // the visible map only after the successful transaction has settled.
          requestAnimationFrame(() => globalThis.renderEnergyDashboard?.());
        } catch (error) {
          actions.dataset.state = "error";
          save.disabled = false;
          if (status)
            status.textContent = `${copy("Salvataggio fallito", "Save failed")}: ${error.message}`;
        }
      }, 0);
    },
    true,
  );
}

function containsEnergyEditor(node) {
  return (
    node instanceof Element &&
    (node.matches('[data-editor="energy"]') || Boolean(node.querySelector('[data-editor="energy"]')))
  );
}

function install() {
  if (globalThis[ENERGY_SAVE_FLAG]?.installed) return;
  globalThis[ENERGY_SAVE_FLAG] = { installed: true, version: "0.14.12" };

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(patchEnergySave);
  };
  new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes].some(containsEnergyEditor))) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
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
