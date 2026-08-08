import { doc, installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-appliance-layout-section-style",
    `
      #appl-grid-overview,#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),400px))!important;justify-content:start!important;align-items:stretch!important;gap:16px!important}
      #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{display:grid!important;box-sizing:border-box!important;width:100%!important;max-width:400px!important;min-width:0!important;min-height:154px!important;height:auto!important;padding:0!important;gap:0!important;border:1px solid color-mix(in srgb,var(--primary-color,#0284c7) 16%,var(--divider-color,#e2e8f0))!important;border-radius:22px!important;overflow:hidden!important;grid-template-columns:108px minmax(0,1fr)!important;background:var(--ha-card-background,var(--card-background-color,#fff))!important;color:var(--primary-text-color,#0f172a)!important;box-shadow:0 12px 28px color-mix(in srgb,#0f172a 12%,transparent)!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-card,html[data-theme="dark"] #appl-grid-overview .appl-wide-card,body.dark #page-appliances-main .appl-wide-card,body.dark #appl-grid-overview .appl-wide-card{background:#172033!important;color:#f8fafc!important;border-color:#2b3a58!important}
      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{display:grid!important;place-items:center!important;box-sizing:border-box!important;min-width:108px!important;height:100%!important;min-height:154px!important;padding:10px!important;border-right:1px solid color-mix(in srgb,var(--primary-color,#0284c7) 11%,var(--divider-color,#e2e8f0))!important;background:color-mix(in srgb,var(--primary-color,#0284c7) 6%,var(--ha-card-background,#fff))!important}
      html[data-theme="dark"] #page-appliances-main .appl-visual,html[data-theme="dark"] #appl-grid-overview .appl-visual,body.dark #page-appliances-main .appl-visual,body.dark #appl-grid-overview .appl-visual{background:#202c43!important;border-color:#2b3a58!important}
      #page-appliances-main .appl-wide-card .appl-ic,#appl-grid-overview .appl-wide-card .appl-ic{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:86px!important;height:86px!important;min-width:86px!important;min-height:86px!important;margin:0!important;padding:0!important;border:0!important;border-radius:20px!important;background:color-mix(in srgb,var(--primary-color,#0284c7) 7%,transparent)!important;box-shadow:none!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image-wrap,#appl-grid-overview .appl-wide-card .dm-appliance-image-wrap{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;overflow:hidden!important;border-radius:15px!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image,#appl-grid-overview .appl-wide-card .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;object-fit:cover!important;object-position:center!important}
      #page-appliances-main .appl-wide-card .appl-ic svg,#appl-grid-overview .appl-wide-card .appl-ic svg,#page-appliances-main .appl-wide-card .appl-ic ha-icon,#appl-grid-overview .appl-wide-card .appl-ic ha-icon{display:block!important;width:72px!important;height:72px!important;max-width:100%!important;max-height:100%!important;--mdc-icon-size:72px}
      #page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{display:grid!important;box-sizing:border-box!important;grid-template-rows:auto auto minmax(24px,1fr) auto!important;gap:5px!important;min-width:0!important;min-height:154px!important;height:auto!important;padding:13px 12px 12px!important;align-content:stretch!important;color:inherit!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:inherit!important;font-size:17px!important;font-weight:900!important;line-height:1.15!important}
      #page-appliances-main .appl-wide-meta,#appl-grid-overview .appl-wide-meta,#page-appliances-main .appl-mini,#appl-grid-overview .appl-mini{min-width:0!important;margin:0!important;color:var(--secondary-text-color,#64748b)!important;font-size:11px!important;font-weight:750!important;line-height:1.25!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-meta,html[data-theme="dark"] #appl-grid-overview .appl-wide-meta,html[data-theme="dark"] #page-appliances-main .appl-mini,html[data-theme="dark"] #appl-grid-overview .appl-mini,body.dark #page-appliances-main .appl-wide-meta,body.dark #appl-grid-overview .appl-wide-meta,body.dark #page-appliances-main .appl-mini,body.dark #appl-grid-overview .appl-mini{color:#cbd5e1!important}
      #page-appliances-main .appl-wide-stat,#appl-grid-overview .appl-wide-stat,#page-appliances-main .appl-energy,#appl-grid-overview .appl-energy,#page-appliances-main .appl-kwh,#appl-grid-overview .appl-kwh{display:flex!important;align-items:center!important;gap:5px!important;min-width:0!important;font-size:14px!important;line-height:1.25!important}
      #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions,#page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{display:grid!important;grid-template-columns:auto minmax(82px,1fr)!important;align-self:end!important;align-items:stretch!important;gap:7px!important;min-width:0!important;margin-top:4px!important}
      #page-appliances-main .appl-wide-actions button,#appl-grid-overview .appl-wide-actions button,#page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;min-width:0!important;min-height:38px!important;margin:0!important;padding:7px 9px!important;border-radius:11px!important;opacity:1!important;visibility:visible!important;font-size:11px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #page-appliances-main .appl-wide-actions .appl-action-btn,#appl-grid-overview .appl-wide-actions .appl-action-btn{background:color-mix(in srgb,var(--primary-color,#0284c7) 12%,transparent)!important;color:var(--primary-color,#0369a1)!important;border:0!important}
      #page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{width:100%!important;background:var(--success-color,#059669)!important;color:#fff!important;border:0!important}
      #page-appliances-main .appl-wide-status,#appl-grid-overview .appl-wide-status,#page-appliances-main .appl-status,#appl-grid-overview .appl-status{display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;min-height:22px!important;padding:3px 7px!important;border-radius:8px!important;font-size:10px!important;font-weight:900!important;line-height:1!important;color:inherit!important}
      @media(max-width:520px){
        #appl-grid-overview,#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{grid-template-columns:1fr!important;gap:13px!important}
        #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{grid-template-columns:98px minmax(0,1fr)!important;max-width:400px!important;min-height:148px!important;border-radius:18px!important}
        #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{min-width:98px!important;min-height:148px!important;padding:7px!important}
        #page-appliances-main .appl-wide-card .appl-ic,#appl-grid-overview .appl-wide-card .appl-ic{width:84px!important;height:84px!important;min-width:84px!important;min-height:84px!important;padding:0!important;border-radius:18px!important}
        #page-appliances-main .appl-wide-card .appl-ic svg,#appl-grid-overview .appl-wide-card .appl-ic svg,#page-appliances-main .appl-wide-card .appl-ic ha-icon,#appl-grid-overview .appl-wide-card .appl-ic ha-icon{width:70px!important;height:70px!important;--mdc-icon-size:70px}
        #page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{min-height:148px!important;padding:11px 10px 10px!important}
        #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{font-size:16px!important}
        #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions,#page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{grid-template-columns:minmax(70px,.65fr) minmax(82px,1fr)!important;gap:6px!important}
        #page-appliances-main .appl-wide-actions button,#appl-grid-overview .appl-wide-actions button{min-height:36px!important;padding:6px 7px!important;font-size:10.5px!important}
      }
    `,
  );
}

export function installApplianceLayoutSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
}

if (doc?.readyState === "loading") doc.addEventListener("DOMContentLoaded", installApplianceLayoutSection, { once: true });
else installApplianceLayoutSection();
