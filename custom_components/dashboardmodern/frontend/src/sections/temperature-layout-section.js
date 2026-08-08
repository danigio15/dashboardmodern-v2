import { doc, installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TEMPERATURE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-temperature-layout-section-style",
    `
      #page-temp #temp-grid,.temp-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(250px,310px))!important;justify-content:start!important;align-items:start!important;gap:14px!important;width:100%!important;margin:14px 0 0!important;padding:0 18px 26px!important}
      #page-temp .temp-card,#temp-grid .temp-card{position:relative!important;display:grid!important;box-sizing:border-box!important;width:100%!important;max-width:310px!important;min-height:126px!important;margin:0!important;padding:14px 15px!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 14%,var(--divider-color,#e2e8f0))!important;border-radius:19px!important;gap:11px!important;overflow:hidden!important;background:linear-gradient(145deg,var(--ha-card-background,var(--card-bg,#fff)) 0%,color-mix(in srgb,var(--primary-color,#0ea5e9) 4%,var(--ha-card-background,#fff)) 100%)!important;box-shadow:0 10px 24px rgba(15,23,42,.08)!important}
      #page-temp .temp-card::before,#temp-grid .temp-card::before{content:""!important;position:absolute!important;inset:0 auto 0 0!important;width:3px!important;background:linear-gradient(180deg,var(--primary-color,#0ea5e9),color-mix(in srgb,var(--primary-color,#0ea5e9) 35%,transparent))!important;opacity:.72!important}
      #page-temp .temp-card-header,#temp-grid .temp-card-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-height:36px!important;margin:0!important;padding:0!important}
      #page-temp .cp-title-wrap,#temp-grid .cp-title-wrap,#page-temp .temp-room-icon-wrap,#temp-grid .temp-room-icon-wrap{display:flex!important;align-items:center!important;gap:9px!important;min-width:0!important;flex:1 1 auto!important}
      #page-temp .cp-icon,#temp-grid .cp-icon,#page-temp .temp-room-icon,#temp-grid .temp-room-icon{display:grid!important;place-items:center!important;flex:0 0 36px!important;width:36px!important;height:36px!important;margin:0!important;border:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 12%,transparent)!important;border-radius:12px!important;background:color-mix(in srgb,var(--primary-color,#0ea5e9) 8%,var(--ha-card-background,#fff))!important;box-shadow:0 4px 12px rgba(15,23,42,.05)!important}
      #page-temp .cp-name,#temp-grid .cp-name,#page-temp .temp-room-name,#temp-grid .temp-room-name{min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:16px!important;font-weight:900!important;line-height:1.15!important;letter-spacing:-.15px!important;color:var(--primary-text-color,var(--text,#0f172a))!important}
      #page-temp .temp-comfort-badge,#temp-grid .temp-comfort-badge{position:static!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;min-width:48px!important;max-width:82px!important;min-height:24px!important;padding:4px 8px!important;border-radius:999px!important;font-size:8.5px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;transform:none!important}
      #page-temp .temp-card-body,#temp-grid .temp-card-body{display:grid!important;grid-template-columns:minmax(0,1.18fr) minmax(82px,.82fr)!important;align-items:end!important;gap:11px!important;width:100%!important;margin:0!important;padding:0!important}
      #page-temp .cp-temp-current-wrap,#temp-grid .cp-temp-current-wrap{display:grid!important;gap:2px!important;min-width:0!important}.cp-temp-current-lbl{margin:0!important;font-size:8px!important;font-weight:900!important;letter-spacing:.10em!important;line-height:1.2!important;text-transform:uppercase!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
      #page-temp .cp-temp-current,#temp-grid .cp-temp-current,#page-temp .temp-value,#temp-grid .temp-value{display:block!important;margin:0!important;font-size:36px!important;font-weight:850!important;line-height:.94!important;letter-spacing:-1px!important;white-space:nowrap!important;color:var(--primary-text-color,var(--text,#0f172a))!important}
      #page-temp .cp-temp-target,#temp-grid .cp-temp-target{display:grid!important;align-content:end!important;gap:4px!important;min-width:0!important;margin:0!important;padding:5px 0 1px 11px!important;border-left:1px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 18%,var(--divider-color,#dbe4ee))!important;text-align:left!important}.cp-temp-target .lbl{font-size:8px!important;font-weight:900!important;letter-spacing:.05em!important;text-transform:uppercase!important;white-space:nowrap!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}.cp-temp-target .val,.temp-hum-val{font-size:22px!important;font-weight:850!important;line-height:1!important;white-space:nowrap!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
      #page-temp .temp-floor-tabs,#page-temp .temp-floor-bar,#page-temp [data-temp-floor-tabs]{display:flex!important;justify-content:center!important;flex-wrap:wrap!important;gap:8px!important;margin:4px 18px 12px!important}
      #editor-modal .dm-temperature-actions{display:flex!important;align-items:stretch!important;flex-wrap:wrap!important;gap:10px!important;width:100%!important}
      #editor-modal .dm-temperature-form .dm-temperature-actions>button{box-sizing:border-box!important;min-height:44px!important}
      html[data-theme="dark"] #page-temp .temp-card,html[data-theme="dark"] #temp-grid .temp-card,body.dark #page-temp .temp-card,body.dark #temp-grid .temp-card{background:linear-gradient(145deg,#172033 0%,#1b2940 100%)!important;border-color:#2b3a58!important;box-shadow:0 12px 28px rgba(0,0,0,.26)!important}
      html[data-theme="dark"] #page-temp .cp-icon,html[data-theme="dark"] #temp-grid .cp-icon,body.dark #page-temp .cp-icon,body.dark #temp-grid .cp-icon{background:#202c43!important;border-color:#2b3a58!important}
      @media(max-width:680px){
        #page-temp #temp-grid,.temp-grid{grid-template-columns:minmax(0,350px)!important;justify-content:center!important;gap:12px!important;margin-top:12px!important;padding:0 14px 22px!important}
        #page-temp .temp-card,#temp-grid .temp-card{width:100%!important;max-width:350px!important;min-height:118px!important;padding:12px 13px!important;border-radius:18px!important;gap:9px!important}
        #page-temp .temp-card-header,#temp-grid .temp-card-header{min-height:34px!important}
        #page-temp .cp-icon,#temp-grid .cp-icon,#page-temp .temp-room-icon,#temp-grid .temp-room-icon{flex-basis:34px!important;width:34px!important;height:34px!important;border-radius:11px!important}
        #page-temp .cp-name,#temp-grid .cp-name,#page-temp .temp-room-name,#temp-grid .temp-room-name{font-size:15.5px!important}
        #page-temp .temp-comfort-badge,#temp-grid .temp-comfort-badge{min-height:23px!important;padding:4px 7px!important;font-size:8px!important}
        #page-temp .temp-card-body,#temp-grid .temp-card-body{grid-template-columns:minmax(0,1.15fr) minmax(78px,.85fr)!important;gap:9px!important}
        #page-temp .cp-temp-current,#temp-grid .cp-temp-current,#page-temp .temp-value,#temp-grid .temp-value{font-size:34px!important}
        #page-temp .cp-temp-target,#temp-grid .cp-temp-target{padding-left:10px!important}.cp-temp-target .val,.temp-hum-val{font-size:21px!important}
      }
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