import { doc, installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TEMPERATURE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-temperature-layout-section-style",
    `
      #page-temp #temp-grid,.temp-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(250px,300px))!important;justify-content:start!important;align-items:start!important;gap:18px!important;width:100%!important;margin:18px 0 0!important;padding:0 18px 28px!important}
      #page-temp .temp-card,#temp-grid .temp-card{box-sizing:border-box!important;width:100%!important;min-height:170px!important;margin:0!important;padding:20px 22px!important;border-radius:22px!important;gap:18px!important;overflow:hidden!important}
      #page-temp .temp-card-header,#temp-grid .temp-card-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;min-height:44px!important;margin:0!important;padding:0!important}
      #page-temp .cp-title-wrap,#temp-grid .cp-title-wrap,#page-temp .temp-room-icon-wrap,#temp-grid .temp-room-icon-wrap{display:flex!important;align-items:center!important;gap:11px!important;min-width:0!important;flex:1 1 auto!important}
      #page-temp .cp-icon,#temp-grid .cp-icon,#page-temp .temp-room-icon,#temp-grid .temp-room-icon{display:grid!important;place-items:center!important;flex:0 0 42px!important;width:42px!important;height:42px!important;margin:0!important;border-radius:13px!important}
      #page-temp .cp-name,#temp-grid .cp-name,#page-temp .temp-room-name,#temp-grid .temp-room-name{min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:16px!important;font-weight:900!important;line-height:1.2!important}
      #page-temp .temp-comfort-badge,#temp-grid .temp-comfort-badge{position:static!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;min-width:54px!important;max-width:96px!important;min-height:28px!important;padding:5px 9px!important;border-radius:10px!important;font-size:10px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;transform:none!important}
      #page-temp .temp-card-body,#temp-grid .temp-card-body{display:grid!important;grid-template-columns:minmax(0,1.25fr) minmax(82px,.75fr)!important;align-items:end!important;gap:18px!important;width:100%!important;margin:0!important;padding:0!important}
      #page-temp .cp-temp-current-wrap,#temp-grid .cp-temp-current-wrap{display:grid!important;gap:3px!important;min-width:0!important}.cp-temp-current-lbl{margin:0!important;font-size:9px!important;font-weight:900!important;letter-spacing:.1em!important;line-height:1.2!important;text-transform:uppercase!important}
      #page-temp .cp-temp-current,#temp-grid .cp-temp-current,#page-temp .temp-value,#temp-grid .temp-value{display:block!important;margin:0!important;font-size:48px!important;font-weight:800!important;line-height:.95!important;letter-spacing:-1px!important;white-space:nowrap!important}
      #page-temp .cp-temp-target,#temp-grid .cp-temp-target{display:grid!important;align-content:end!important;gap:5px!important;min-width:0!important;margin:0!important;padding:8px 0 3px 18px!important;border-left:1px solid var(--divider-color,#dbe4ee)!important;text-align:left!important}.cp-temp-target .lbl{font-size:9px!important;font-weight:900!important;letter-spacing:.07em!important;text-transform:uppercase!important;white-space:nowrap!important}.cp-temp-target .val,.temp-hum-val{font-size:30px!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important}
      #page-temp .temp-floor-tabs,#page-temp .temp-floor-bar,#page-temp [data-temp-floor-tabs]{display:flex!important;justify-content:center!important;flex-wrap:wrap!important;gap:10px!important;margin:4px 18px 12px!important}
      @media(max-width:680px){#page-temp #temp-grid,.temp-grid{grid-template-columns:1fr!important;gap:14px!important;padding:0 12px 24px!important}#page-temp .temp-card,#temp-grid .temp-card{min-height:156px!important;padding:18px!important;border-radius:19px!important;gap:15px!important}#page-temp .temp-card-body,#temp-grid .temp-card-body{gap:12px!important}#page-temp .cp-temp-current,#temp-grid .cp-temp-current,#page-temp .temp-value,#temp-grid .temp-value{font-size:42px!important}#page-temp .cp-temp-target,#temp-grid .cp-temp-target{padding-left:13px!important}.cp-temp-target .val,.temp-hum-val{font-size:26px!important}}
      @media(min-width:1200px){#page-temp #temp-grid,.temp-grid{padding-inline:24px!important}}
    `,
  );
}

export function installTemperatureLayoutSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installTemperatureLayoutSection, { once: true });
else installTemperatureLayoutSection();