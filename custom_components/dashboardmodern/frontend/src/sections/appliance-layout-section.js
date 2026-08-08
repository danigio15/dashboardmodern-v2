import { doc, installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-appliance-layout-section-style",
    `
      #appl-grid-overview,#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),370px))!important;justify-content:start!important;align-items:stretch!important;gap:14px!important}
      #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{display:grid!important;box-sizing:border-box!important;width:100%!important;max-width:370px!important;min-width:0!important;min-height:132px!important;height:auto!important;padding:0!important;gap:0!important;border:1px solid color-mix(in srgb,var(--primary-color,#0284c7) 16%,var(--divider-color,#e2e8f0))!important;border-radius:22px!important;overflow:hidden!important;grid-template-columns:96px minmax(0,1fr)!important;background:var(--ha-card-background,var(--card-background-color,#fff))!important;color:var(--primary-text-color,#0f172a)!important;box-shadow:0 10px 24px color-mix(in srgb,#0f172a 10%,transparent)!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-card,html[data-theme="dark"] #appl-grid-overview .appl-wide-card,body.dark #page-appliances-main .appl-wide-card,body.dark #appl-grid-overview .appl-wide-card{background:#172033!important;color:#f8fafc!important;border-color:#2b3a58!important}
      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{display:grid!important;place-items:center!important;box-sizing:border-box!important;min-width:96px!important;height:100%!important;min-height:132px!important;padding:8px!important;border-right:1px solid color-mix(in srgb,var(--primary-color,#0284c7) 11%,var(--divider-color,#e2e8f0))!important;background:color-mix(in srgb,var(--primary-color,#0284c7) 6%,var(--ha-card-background,#fff))!important}
      html[data-theme="dark"] #page-appliances-main .appl-visual,html[data-theme="dark"] #appl-grid-overview .appl-visual,body.dark #page-appliances-main .appl-visual,body.dark #appl-grid-overview .appl-visual{background:#202c43!important;border-color:#2b3a58!important}
      #page-appliances-main .appl-wide-card .appl-ic,#appl-grid-overview .appl-wide-card .appl-ic{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:80px!important;height:80px!important;min-width:80px!important;min-height:80px!important;margin:0!important;padding:0!important;border:0!important;border-radius:18px!important;background:color-mix(in srgb,var(--primary-color,#0284c7) 7%,transparent)!important;box-shadow:none!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image-wrap,#appl-grid-overview .appl-wide-card .dm-appliance-image-wrap{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;overflow:hidden!important;border-radius:14px!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image,#appl-grid-overview .appl-wide-card .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;object-fit:cover!important;object-position:center!important}
      #page-appliances-main .appl-wide-card .appl-ic svg,#appl-grid-overview .appl-wide-card .appl-ic svg,#page-appliances-main .appl-wide-card .appl-ic ha-icon,#appl-grid-overview .appl-wide-card .appl-ic ha-icon{display:block!important;width:68px!important;height:68px!important;max-width:100%!important;max-height:100%!important;--mdc-icon-size:68px}

      /* The legacy card body is .appl-info (not .appl-wide-body). Target the
         real DOM owner so padding and vertical rhythm cannot be bypassed. */
      #page-appliances-main .appl-wide-card>.appl-info,#appl-grid-overview .appl-wide-card>.appl-info{display:grid!important;box-sizing:border-box!important;grid-template-rows:auto auto minmax(0,1fr) auto!important;align-content:stretch!important;gap:5px!important;min-width:0!important;min-height:132px!important;height:auto!important;margin:0!important;padding:12px 12px 10px!important;overflow:hidden!important;color:inherit!important}
      #page-appliances-main .appl-heading,#appl-grid-overview .appl-heading{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:8px!important;min-width:0!important;margin:0!important;padding:0!important}
      #page-appliances-main .appl-heading>div,#appl-grid-overview .appl-heading>div{min-width:0!important;flex:1 1 auto!important}
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:inherit!important;font-size:15px!important;font-weight:900!important;line-height:1.18!important}
      #page-appliances-main .appl-wide-cat,#appl-grid-overview .appl-wide-cat{min-width:0!important;margin:3px 0 0!important;color:var(--secondary-text-color,#64748b)!important;font-size:10px!important;font-weight:800!important;line-height:1.2!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #page-appliances-main .appl-st,#appl-grid-overview .appl-st{display:inline-flex!important;align-items:center!important;flex:0 0 auto!important;width:max-content!important;max-width:92px!important;min-height:20px!important;margin:0!important;padding:3px 6px!important;border-radius:7px!important;font-size:9px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #page-appliances-main .appl-live,#appl-grid-overview .appl-live{display:flex!important;align-items:center!important;flex-wrap:wrap!important;column-gap:9px!important;row-gap:2px!important;min-width:0!important;margin:0!important;padding:0!important}
      #page-appliances-main .appl-primary,#appl-grid-overview .appl-primary{display:flex!important;align-items:baseline!important;gap:3px!important;min-width:0!important;margin:0!important;font-size:12.5px!important;line-height:1.2!important}
      #page-appliances-main .appl-primary strong,#appl-grid-overview .appl-primary strong{font-weight:900!important}
      #page-appliances-main .appl-mini,#appl-grid-overview .appl-mini{display:inline-flex!important;align-items:center!important;gap:3px!important;min-width:0!important;margin:0!important;color:var(--secondary-text-color,#64748b)!important;font-size:10.5px!important;font-weight:750!important;line-height:1.2!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-cat,html[data-theme="dark"] #appl-grid-overview .appl-wide-cat,html[data-theme="dark"] #page-appliances-main .appl-mini,html[data-theme="dark"] #appl-grid-overview .appl-mini,body.dark #page-appliances-main .appl-wide-cat,body.dark #appl-grid-overview .appl-wide-cat,body.dark #page-appliances-main .appl-mini,body.dark #appl-grid-overview .appl-mini{color:#cbd5e1!important}
      #page-appliances-main .appl-spark,#appl-grid-overview .appl-spark{min-height:8px!important;margin:0!important;align-self:end!important;opacity:.55!important}
      #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{display:grid!important;grid-template-columns:minmax(82px,.78fr) minmax(94px,1fr)!important;align-self:end!important;align-items:stretch!important;gap:6px!important;min-width:0!important;margin:2px 0 0!important;padding:0!important}
      #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,#page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;min-width:0!important;min-height:32px!important;height:32px!important;margin:0!important;padding:5px 8px!important;border-radius:9px!important;opacity:1!important;visibility:visible!important;font-size:10px!important;font-weight:900!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #page-appliances-main .appl-actions .appl-action-btn,#appl-grid-overview .appl-actions .appl-action-btn{background:color-mix(in srgb,var(--primary-color,#0284c7) 12%,transparent)!important;color:var(--primary-color,#0369a1)!important;border:0!important}
      #page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{width:100%!important;background:var(--success-color,#059669)!important;color:#fff!important;border:0!important}

      @media(max-width:520px){
        #appl-grid-overview,#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{grid-template-columns:minmax(0,370px)!important;justify-content:center!important;gap:12px!important;padding-inline:10px!important}
        #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{grid-template-columns:92px minmax(0,1fr)!important;width:100%!important;max-width:370px!important;min-height:126px!important;border-radius:18px!important}
        #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{min-width:92px!important;min-height:126px!important;padding:6px!important}
        #page-appliances-main .appl-wide-card .appl-ic,#appl-grid-overview .appl-wide-card .appl-ic{width:80px!important;height:80px!important;min-width:80px!important;min-height:80px!important;padding:0!important;border-radius:17px!important}
        #page-appliances-main .appl-wide-card>.appl-info,#appl-grid-overview .appl-wide-card>.appl-info{min-height:126px!important;padding:11px 10px 9px!important;gap:4px!important}
        #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{font-size:14.5px!important}
        #page-appliances-main .appl-st,#appl-grid-overview .appl-st{max-width:80px!important;font-size:8.5px!important;padding-inline:5px!important}
        #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{grid-template-columns:minmax(78px,.72fr) minmax(92px,1fr)!important;gap:5px!important}
        #page-appliances-main .appl-actions button,#appl-grid-overview .appl-actions button,#page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{min-height:31px!important;height:31px!important;padding:5px 6px!important;font-size:9.5px!important}
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
