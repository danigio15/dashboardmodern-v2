import { ATTESA_COL_VELO } from "./energy-section.js";
import { clean, doc, root, section } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENERGY_STABILITY_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
});

function configuredEnergy() {
  const model = section("energy", {});
  return ["house", "grid", "solar", "battery"].some((group) =>
    Object.values(model?.[group] || {}).some((value) => clean(value)),
  );
}

function views() {
  return [...(doc?.querySelectorAll("#view-day,#view-month,#view-panoramica") || [])];
}

/* Il velo dell'avvio ha la stessa scadenza di quello dei tentativi.
 *
 * «Energia giornaliera e mensile: resta il velo Caricamento dati Energia.»
 * Qui il velo si METTE quando non c'e' ancora un pacchetto, e si TOGLIE solo
 * quando un pacchetto arriva. Se non arriva mai — un Recorder che non risponde
 * e una promessa che non si chiude — non lo toglieva piu' nessuno: la scadenza
 * che `energy-section` si e' data valeva per il velo dei suoi tentativi, non
 * per questo, e bastava questo a tenere la pagina coperta per sempre.
 *
 * Una pagina scoperta con la riga che dice perche' e' sempre meglio di un velo
 * che non dice niente. La scadenza e' quella, una sola, e viene da li'. */
function scopriAllaScadenza() {
  /* La scadenza e' UNA, e non si ricompra.
   *
   * `holdEnergyUntilStable` lo chiamano anche `runtime-ready`, `bridge-ready` e
   * `pageshow`: rimettendo il conto a zero a ogni evento, un ponte che si
   * riconnette o una pagina ripresa dalla cache si ricomprava dodici secondi
   * di velo, e con un pacchetto che non arriva mai bastavano quegli eventi a
   * tenerla coperta per sempre. Il conto parte al primo velo e finisce quando
   * arriva un pacchetto. */
  if (state.scadenza) return;
  const scaduto = state.veloDalle ? Date.now() - state.veloDalle : 0;
  if (!state.veloDalle) state.veloDalle = Date.now();
  state.scadenza = root.setTimeout?.(
    () => {
      state.scadenza = 0;
      if (root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) return;
      views().forEach((node) => {
        node.classList.remove("dm-energy-awaiting");
        node.removeAttribute("aria-busy");
      });
    },
    Math.max(0, ATTESA_COL_VELO - scaduto),
  );
}

export function holdEnergyUntilStable() {
  if (!configuredEnergy() || root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) return false;
  /* Scaduta una volta, il velo non torna: un evento di sincronizzazione dopo
   * la scadenza rimetteva la pagina sotto, e chi guardava vedeva il velo
   * riapparire da solo su una pagina che aveva gia' i numeri. */
  if (state.veloDalle && Date.now() - state.veloDalle >= ATTESA_COL_VELO) return false;
  views().forEach((node) => {
    node.classList.add("dm-energy-awaiting", "dm-energy-loading");
    node.setAttribute("aria-busy", "true");
  });
  scopriAllaScadenza();
  return true;
}

export function releaseStableEnergy() {
  if (!root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle) return false;
  if (state.scadenza) {
    root.clearTimeout?.(state.scadenza);
    state.scadenza = 0;
  }
  /* Col pacchetto in mano l'attesa e' finita: se un giorno ricominciasse a
   * mancare, il velo si ricompra la sua scadenza da capo — quella si'. */
  state.veloDalle = 0;
  views().forEach((node) => {
    node.classList.remove("dm-energy-awaiting", "dm-energy-loading");
    node.removeAttribute("aria-busy");
  });
  return true;
}

function synchronizeStability() {
  return releaseStableEnergy() || holdEnergyUntilStable();
}

export function installEnergyStabilitySection() {
  if (!doc || state.installed) return;
  state.installed = true;

  // energy-section.js is the sole owner of Recorder requests, retries and
  // refresh scheduling. This module only reflects that canonical state in the
  // UI; it must never start a second refresh pipeline during bootstrap.
  synchronizeStability();
  root.addEventListener?.("dashboardmodern:energy-stable", releaseStableEnergy);
  root.addEventListener?.("dashboardmodern:period-bundle", releaseStableEnergy);
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:bridge-ready",
    "pageshow",
  ]) {
    root.addEventListener?.(event, synchronizeStability);
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyStabilitySection, { once: true });
else installEnergyStabilitySection();
