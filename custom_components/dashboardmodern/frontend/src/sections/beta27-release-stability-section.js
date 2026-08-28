// Beta 27 final real-device stability. This layer owns only the last-mile
// responsive contracts that must win after the legacy dashboard and the
// Beta 27 feature sections have both rendered.
import { doc, installStyle, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA27_RELEASE_STABILITY__";
const state = (root[KEY] ||= { installed: false, listeners: false, frame: 0 });

function installReleaseStyles() {
  installStyle(
    "dm-beta27-release-stability-style",
    `
      /* Il nome della plancia deve leggersi anche di notte.
       *
       * Il titolo in alto a sinistra e' un testo riempito da un gradiente, e il
       * gradiente partiva da un blu notte scritto a mano. In tema chiaro si
       * legge benissimo; in tema scuro quella prima parola finisce su un fondo
       * dello stesso colore e sparisce — restava leggibile solo "Home". Tutto
       * il resto dell'intestazione, sottotitolo e pastiglia della connessione,
       * seguiva gia' il tema: era solo quel capo del gradiente a non farlo. */
      .brand-text h1{
        background:linear-gradient(135deg,var(--text,#0f172a),var(--green,#16a34a))!important;
        -webkit-background-clip:text!important;background-clip:text!important;
        -webkit-text-fill-color:transparent!important}
    `,
  );
  // This owner is intentionally last in the cascade even when the module was
  // evaluated as a dependency before the section runtime installed its styles.
  const style = doc?.getElementById?.("dm-beta27-release-stability-style");
  if (style?.parentElement) style.parentElement.append(style);
}

export function reconcileBeta27TemperatureTabs() {
  if (!doc?.querySelectorAll) return 0;
  const owner = doc.getElementById("dm-beta16-temperature-tabs");
  if (!owner) return 0;
  let removed = 0;
  for (const candidate of doc.querySelectorAll(
    'nav[aria-label="Temperature rooms"],nav[aria-label="Stanze temperatura"]',
  )) {
    if (candidate === owner) continue;
    if (!candidate.closest?.("#page-temp") && candidate.parentElement !== owner.parentElement) continue;
    candidate.remove();
    removed += 1;
  }
  return removed;
}

function scheduleTemperatureTabsOwner() {
  if (!doc || state.frame) return;
  const run = () => {
    state.frame = 0;
    reconcileBeta27TemperatureTabs();
  };
  root.queueMicrotask?.(run);
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

export function installBeta27ReleaseStability() {
  if (!doc) return false;
  installReleaseStyles();
  scheduleTemperatureTabsOwner();
  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:state-changed",
    ]) root.addEventListener?.(eventName, scheduleTemperatureTabsOwner);
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("[data-tab='temp'],[data-tab='temperature'],#page-temp .sub-tab-btn"))
          scheduleTemperatureTabsOwner();
      },
      true,
    );
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installBeta27ReleaseStability, { once: true });
else installBeta27ReleaseStability();
