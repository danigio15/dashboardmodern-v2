import { doc, installStyle, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_NAVIGATION_SECTION__";
const state = (root[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-navigation-section-style",
    `
      .bottom-nav-bar{isolation:isolate!important}
      .bottom-nav-bar .tab{color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
      .bottom-nav-bar .tab .icon,.bottom-nav-bar .tab .text{opacity:.78!important;transition:opacity .16s ease,color .16s ease!important}
      .bottom-nav-bar .tab.active{color:var(--primary-text-color,var(--text,#0f172a))!important}
      .bottom-nav-bar .tab.active .icon,.bottom-nav-bar .tab.active .text{opacity:1!important}
      html[data-theme="dark"] .bottom-nav-bar,html.dark .bottom-nav-bar,body[data-theme="dark"] .bottom-nav-bar,body.dark .bottom-nav-bar,.dark .bottom-nav-bar{background:rgba(19,28,48,.94)!important;border-color:#40506f!important;box-shadow:0 14px 38px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.07)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
      html[data-theme="dark"] .bottom-nav-bar .tab,html.dark .bottom-nav-bar .tab,body[data-theme="dark"] .bottom-nav-bar .tab,body.dark .bottom-nav-bar .tab,.dark .bottom-nav-bar .tab{color:#cbd5e1!important}
      html[data-theme="dark"] .bottom-nav-bar .tab .text,html.dark .bottom-nav-bar .tab .text,body[data-theme="dark"] .bottom-nav-bar .tab .text,body.dark .bottom-nav-bar .tab .text,.dark .bottom-nav-bar .tab .text{color:#cbd5e1!important;opacity:.92!important;text-shadow:0 1px 2px rgba(0,0,0,.35)!important}
      html[data-theme="dark"] .bottom-nav-bar .tab .icon,html.dark .bottom-nav-bar .tab .icon,body[data-theme="dark"] .bottom-nav-bar .tab .icon,body.dark .bottom-nav-bar .tab .icon,.dark .bottom-nav-bar .tab .icon{opacity:.96!important;filter:none!important}
      html[data-theme="dark"] .bottom-nav-bar .tab.active,html.dark .bottom-nav-bar .tab.active,body[data-theme="dark"] .bottom-nav-bar .tab.active,body.dark .bottom-nav-bar .tab.active,.dark .bottom-nav-bar .tab.active{background:#25324b!important;color:#fff!important;border-color:#52627f!important;box-shadow:0 8px 20px rgba(0,0,0,.28)!important}
      html[data-theme="dark"] .bottom-nav-bar .tab.active .text,html.dark .bottom-nav-bar .tab.active .text,body[data-theme="dark"] .bottom-nav-bar .tab.active .text,body.dark .bottom-nav-bar .tab.active .text,.dark .bottom-nav-bar .tab.active .text{color:#fff!important;opacity:1!important}
      @media(max-width:640px){.bottom-nav-bar .tab .text{font-weight:800!important}.bottom-nav-bar .tab{min-width:54px!important}}
    `,
  );
}

export function installNavigationSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installNavigationSection, { once: true });
} else {
  installNavigationSection();
}
