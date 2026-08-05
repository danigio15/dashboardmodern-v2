import { doc, installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-appliance-layout-section-style",
    `
      #appl-grid-overview,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),420px))!important;justify-content:start!important;align-items:stretch!important;gap:18px!important}
      #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{box-sizing:border-box!important;width:100%!important;max-width:420px!important;min-height:190px!important;height:auto!important;max-height:none!important;border-radius:22px!important;overflow:hidden!important;grid-template-columns:124px minmax(0,1fr)!important;background:var(--ha-card-background,var(--card-background-color,#fff))!important;color:var(--primary-text-color,#0f172a)!important;border:1px solid var(--divider-color,#dbe4ee)!important;box-shadow:0 12px 28px rgba(15,23,42,.14)!important}
      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{display:grid!important;place-items:center!important;align-self:stretch!important;border-radius:0!important;min-width:124px!important;min-height:190px!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-card .appl-ic,#appl-grid-overview .appl-wide-card .appl-ic{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:96px!important;min-height:120px!important;margin:0!important;padding:10px!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image-wrap,#appl-grid-overview .appl-wide-card .dm-appliance-image-wrap{box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:96px!important;min-height:120px!important;max-width:none!important;max-height:none!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image,#appl-grid-overview .appl-wide-card .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;min-width:96px!important;min-height:120px!important;object-fit:cover!important;object-position:50% 50%!important}
      #page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{display:flex!important;flex-direction:column!important;box-sizing:border-box!important;min-width:0!important;min-height:190px!important;padding:15px 16px!important;color:var(--primary-text-color,#0f172a)!important}
      #page-appliances-main .appl-wide-body *:not(button),#appl-grid-overview .appl-wide-body *:not(button){opacity:1!important}
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name,#page-appliances-main .appl-wide-title,#appl-grid-overview .appl-wide-title,#page-appliances-main .appl-wide-body strong,#appl-grid-overview .appl-wide-body strong{color:var(--primary-text-color,#0f172a)!important;font-weight:900!important}
      #page-appliances-main .appl-wide-stat,#appl-grid-overview .appl-wide-stat,#page-appliances-main .appl-wide-body small,#appl-grid-overview .appl-wide-body small{color:var(--secondary-text-color,#475569)!important;font-weight:750!important}
      #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions,#page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{display:flex!important;align-items:stretch!important;flex-wrap:wrap!important;gap:8px!important;width:100%!important;margin-top:auto!important;padding-top:12px!important;overflow:visible!important}
      #page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{display:inline-flex!important;align-items:center!important;justify-content:center!important;visibility:visible!important;opacity:1!important;position:relative!important;z-index:2!important;flex:1 1 108px!important;min-width:108px!important;min-height:44px!important;padding:10px 14px!important;border:0!important;border-radius:12px!important;background:linear-gradient(135deg,#0ea5e9,#0369a1)!important;color:#fff!important;font-size:14px!important;font-weight:900!important;line-height:1!important;text-shadow:0 1px 1px rgba(0,0,0,.25)!important}
      #page-appliances-main .dm-appliance-power-toggle[data-state="on"],#appl-grid-overview .dm-appliance-power-toggle[data-state="on"]{background:linear-gradient(135deg,#ef4444,#b91c1c)!important}
      #page-appliances-main .appl-wide-status,#appl-grid-overview .appl-wide-status,#page-appliances-main .appl-status,#appl-grid-overview .appl-status{border-radius:10px!important;opacity:1!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-card,html[data-theme="dark"] #appl-grid-overview .appl-wide-card,body.dark #page-appliances-main .appl-wide-card,body.dark #appl-grid-overview .appl-wide-card{background:var(--ha-card-background,#162033)!important;color:var(--primary-text-color,#f8fafc)!important;border-color:var(--divider-color,#334155)!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-body strong,html[data-theme="dark"] #appl-grid-overview .appl-wide-body strong,body.dark #page-appliances-main .appl-wide-body strong,body.dark #appl-grid-overview .appl-wide-body strong{color:#f8fafc!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-stat,html[data-theme="dark"] #appl-grid-overview .appl-wide-stat,body.dark #page-appliances-main .appl-wide-stat,body.dark #appl-grid-overview .appl-wide-stat{color:#cbd5e1!important}
      @media(max-width:520px){#appl-grid-overview,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{grid-template-columns:1fr!important}#page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{max-width:none!important;grid-template-columns:104px minmax(0,1fr)!important;min-height:184px!important;border-radius:18px!important}#page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{min-width:104px!important;min-height:184px!important}#page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{min-height:184px!important;padding:13px 12px!important}#page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{width:100%!important;flex-basis:100%!important}}
    `,
  );
}

export function installApplianceLayoutSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installApplianceLayoutSection, { once: true });
else installApplianceLayoutSection();
