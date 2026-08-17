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
      /* Keep the animated appliance design compact on desktop/tablet as well as
         phones. The main artwork remains the single large visual owner; the
         header copy is text-only so cards never grow into a second poster.
         Showcase cards (.dm-ap-card) own their layout and are excluded. */
      #page-appliances-main .appl-wide-card:not(.dm-ap-card),#appl-grid-overview .appl-wide-card:not(.dm-ap-card){
        width:100%!important;max-width:370px!important;min-height:150px!important;height:auto!important;
        grid-template-columns:96px minmax(0,1fr)!important;
        grid-template-rows:auto minmax(0,1fr) auto!important;
        grid-template-areas:"visual head" "visual live" "visual actions"!important;
        background-color:var(--ha-card-background,var(--card-background-color,#fff))!important;
        background-image:radial-gradient(circle at 18% 8%,rgba(125,211,252,.14),transparent 31%),linear-gradient(180deg,rgba(255,255,255,.99),rgba(248,250,252,.98))!important;
      }
      html[data-theme="dark"] #page-appliances-main .appl-wide-card:not(.dm-ap-card),html[data-theme="dark"] #appl-grid-overview .appl-wide-card:not(.dm-ap-card),body.dark #page-appliances-main .appl-wide-card:not(.dm-ap-card),body.dark #appl-grid-overview .appl-wide-card:not(.dm-ap-card){
        background-color:#172033!important;
        background-image:radial-gradient(circle at 16% 8%,rgba(14,165,233,.14),transparent 30%),linear-gradient(180deg,#172033,#111827)!important;
      }
      #page-appliances-main .appl-heading,#appl-grid-overview .appl-heading{
        grid-template-columns:minmax(0,1fr) auto!important;gap:7px!important;padding:12px 12px 4px!important;
      }
      #page-appliances-main .dm-appliance-head-icon,#appl-grid-overview .dm-appliance-head-icon{display:none!important}
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{font-size:15px!important;letter-spacing:-.15px!important}
      #page-appliances-main .appl-st,#appl-grid-overview .appl-st{max-width:86px!important;min-height:24px!important;padding:4px 6px!important;font-size:8.5px!important}
      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{
        width:96px!important;min-width:96px!important;height:100%!important;min-height:150px!important;padding:6px!important;
        border-right:1px solid rgba(148,163,184,.12)!important;overflow:hidden!important;
      }
      #page-appliances-main .appl-wide-card .appl-visual>.appl-ic,#appl-grid-overview .appl-wide-card .appl-visual>.appl-ic{
        width:84px!important;height:84px!important;min-width:84px!important;min-height:84px!important;border-radius:18px!important;
      }
      #page-appliances-main .appl-wide-card .appl-visual .dm-appliance-art,#appl-grid-overview .appl-wide-card .appl-visual .dm-appliance-art,
      #page-appliances-main .appl-wide-card .dm-appliance-image-wrap,#appl-grid-overview .appl-wide-card .dm-appliance-image-wrap{
        width:84px!important;height:84px!important;min-width:84px!important;min-height:84px!important;border-radius:17px!important;
      }
      #page-appliances-main .appl-wide-card .appl-visual svg,#appl-grid-overview .appl-wide-card .appl-visual svg{
        width:78px!important;height:78px!important;max-width:78px!important;max-height:78px!important;
      }
      #page-appliances-main .appl-wide-card .dm-appliance-image,#appl-grid-overview .appl-wide-card .dm-appliance-image{
        width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;
      }
      #page-appliances-main .appl-live,#appl-grid-overview .appl-live{
        min-height:0!important;padding:4px 8px 4px 12px!important;border-top:0!important;background:transparent!important;
      }
      #page-appliances-main .appl-primary,#appl-grid-overview .appl-primary{font-size:12px!important}
      #page-appliances-main .appl-primary strong,#appl-grid-overview .appl-primary strong,#page-appliances-main .appl-pwr,#appl-grid-overview .appl-pwr{font-size:20px!important}
      #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{
        min-height:0!important;padding:4px 12px 10px 8px!important;border-top:0!important;background:transparent!important;
      }
      #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,#page-appliances-main [data-dm-power-toggle="true"]:not(.dm-ap-power),#appl-grid-overview [data-dm-power-toggle="true"]:not(.dm-ap-power){
        min-height:32px!important;height:32px!important;border-radius:10px!important;padding:5px 8px!important;font-size:9.5px!important;
      }
      #page-appliances-main [data-dm-power-toggle="true"]:not(.dm-ap-power),#appl-grid-overview [data-dm-power-toggle="true"]:not(.dm-ap-power){min-width:88px!important}
      #page-appliances-main .appl-actions .appl-action-btn,#appl-grid-overview .appl-actions .appl-action-btn{width:32px!important;max-width:32px!important}

      @media(max-width:520px){
        #page-appliances-main .appl-wide-card:not(.dm-ap-card),#appl-grid-overview .appl-wide-card:not(.dm-ap-card){min-height:126px!important}
        #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{height:126px!important;min-height:126px!important}
      }
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
