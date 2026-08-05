import { doc, installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-appliance-layout-section-style",
    `
      #appl-grid-overview,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),460px))!important;justify-content:start!important;align-items:stretch!important;gap:18px!important}
      #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{box-sizing:border-box!important;width:100%!important;max-width:none!important;min-height:178px!important;max-height:none!important;border-radius:22px!important;overflow:hidden!important;grid-template-columns:128px minmax(0,1fr)!important;box-shadow:0 14px 30px color-mix(in srgb,#0f172a 14%,transparent)!important}
      #page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{border-radius:0!important;min-width:128px!important}
      #page-appliances-main .appl-wide-body,#appl-grid-overview .appl-wide-body{padding:16px!important;align-content:start!important}
      #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions,#page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{align-self:end!important;flex-wrap:wrap!important}
      #page-appliances-main .appl-wide-status,#appl-grid-overview .appl-wide-status,#page-appliances-main .appl-status,#appl-grid-overview .appl-status{border-radius:10px!important}
      @media(max-width:520px){#appl-grid-overview,#page-appliances-main .appl-grid,#page-appliances-main [data-appliance-grid]{grid-template-columns:1fr!important}#page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{grid-template-columns:106px minmax(0,1fr)!important;min-height:166px!important;border-radius:18px!important}#page-appliances-main .appl-visual,#appl-grid-overview .appl-visual{min-width:106px!important}}
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