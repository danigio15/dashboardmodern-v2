import { doc, installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-appliance-layout-section-style",
    `
      #appl-grid-overview,#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),408px))!important;justify-content:start!important;align-items:stretch!important;gap:18px!important}
      #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{display:grid!important;box-sizing:border-box!important;width:100%!important;max-width:408px!important;height:188px!important;min-width:0!important;min-height:0!important;padding:0!important;gap:0!important;border:1px solid color-mix(in srgb,var(--primary-color,#0284c7) 18%,transparent)!important;border-radius:22px!important;overflow:hidden!important;grid-template-columns:112px minmax(0,1fr)!important;background:var(--ha-card-background,var(--card-background-color,#fff))!important;color:var(--primary-text-color,#0f172a)!important;box-shadow:0 14px 30px color-mix(in srgb,#0f172a 14%,transparent)!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-card,html[data-theme="dark"] #appl-grid-overview .appl-wide-card,body.dark #page-appliances-main .appl-wide-card,body.dark #appl-grid-overview .appl-wide-card{background:#172033!important;color:#f8fafc!important}
      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{display:grid!important;place-items:center!important;box-sizing:border-box!important;min-width:112px!important;height:188px!important;border-right:1px solid color-mix(in srgb,var(--primary-color,#0284c7) 12%,transparent)!important;background:color-mix(in srgb,var(--primary-color,#0284c7) 8%,var(--ha-card-background,#fff))!important}
      html[data-theme="dark"] #page-appliances-main .appl-visual,html[data-theme="dark"] #appl-grid-overview .appl-visual,body.dark #page-appliances-main .appl-visual,body.dark #appl-grid-overview .appl-visual{background:#202c43!important}
      #page-appliances-main .appl-wide-card .appl-ic,#appl-grid-overview .appl-wide-card .appl-ic{display:grid!important;place-items:center!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:84px!important;min-height:84px!important;margin:0!important;padding:8px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image-wrap,#appl-grid-overview .appl-wide-card .dm-appliance-image-wrap{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:84px!important;min-height:84px!important;max-width:none!important;max-height:none!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-card .dm-appliance-image,#appl-grid-overview .appl-wide-card .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;min-width:84px!important;min-height:84px!important;object-fit:cover!important;object-position:center!important}
      #page-appliances-main .appl-wide-card .appl-ic svg,#appl-grid-overview .appl-wide-card .appl-ic svg,#page-appliances-main .appl-wide-card .appl-ic ha-icon,#appl-grid-overview .appl-wide-card .appl-ic ha-icon{display:block!important;width:76px!important;height:76px!important;max-width:100%!important;max-height:100%!important;--mdc-icon-size:76px}
      #page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{display:grid!important;box-sizing:border-box!important;grid-template-rows:auto auto minmax(0,1fr) auto!important;gap:4px!important;min-width:0!important;height:188px!important;padding:10px 12px!important;align-content:stretch!important;color:inherit!important;overflow:hidden!important}
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name{color:inherit!important;font-weight:900!important;line-height:1.15!important}
      #page-appliances-main .appl-wide-meta,#appl-grid-overview .appl-wide-meta,#page-appliances-main .appl-mini,#appl-grid-overview .appl-mini{color:var(--secondary-text-color,#64748b)!important;line-height:1.15!important}
      html[data-theme="dark"] #page-appliances-main .appl-wide-meta,html[data-theme="dark"] #appl-grid-overview .appl-wide-meta,html[data-theme="dark"] #page-appliances-main .appl-mini,html[data-theme="dark"] #appl-grid-overview .appl-mini,body.dark #page-appliances-main .appl-wide-meta,body.dark #appl-grid-overview .appl-wide-meta,body.dark #page-appliances-main .appl-mini,body.dark #appl-grid-overview .appl-mini{color:#cbd5e1!important}
      #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions,#page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{display:flex!important;align-self:end!important;align-items:stretch!important;flex-wrap:nowrap!important;gap:6px!important;min-width:0!important;margin-top:2px!important}
      #page-appliances-main .appl-wide-actions button,#appl-grid-overview .appl-wide-actions button,#page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;min-width:0!important;min-height:42px!important;padding:7px 9px!important;border-radius:11px!important;opacity:1!important;visibility:visible!important;color:#fff!important;background:var(--primary-color,#0284c7)!important;font-size:12px!important;font-weight:900!important;white-space:nowrap!important;overflow:visible!important}
      #page-appliances-main [data-dm-power-toggle="true"],#appl-grid-overview [data-dm-power-toggle="true"]{flex:1 1 auto!important;background:var(--success-color,#059669)!important}
      #page-appliances-main .appl-wide-status,#appl-grid-overview .appl-wide-status,#page-appliances-main .appl-status,#appl-grid-overview .appl-status{border-radius:9px!important;color:inherit!important}
      @media(max-width:520px){#appl-grid-overview,#page-appliances-main .appl-page-grid,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{grid-template-columns:1fr!important}#page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{grid-template-columns:92px minmax(0,1fr)!important;max-width:none!important;height:188px!important;border-radius:18px!important}#page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{min-width:92px!important;height:188px!important}#page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{height:188px!important;padding:9px 10px!important}#page-appliances-main .appl-wide-actions button,#appl-grid-overview .appl-wide-actions button{padding:7px!important;font-size:11px!important}}
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
