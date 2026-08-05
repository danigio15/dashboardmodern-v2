import { doc, installStyle } from "./shared.js";

const KEY = "__DASHBOARDMODERN_SHUTTER_ALERT_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false });

function installStyles() {
  installStyle(
    "dm-shutter-alert-layout-section-style",
    `
      .dm-shutter-popup-backdrop{display:grid!important;place-items:center!important;padding:18px!important;background:rgba(15,23,42,.68)!important;backdrop-filter:blur(4px)!important}
      .dm-shutter-popup-dialog{width:min(620px,100%)!important;max-height:min(720px,92dvh)!important;border-radius:24px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--primary-text-color,#0f172a)!important;box-shadow:0 24px 70px rgba(15,23,42,.38)!important}
      .dm-shutter-popup-dialog>header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;min-height:72px!important;padding:14px 18px!important;border-bottom:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      .dm-shutter-popup-dialog>header h2{margin:0!important;font-family:inherit!important;font-size:22px!important;font-weight:900!important;line-height:1.2!important;letter-spacing:0!important;text-transform:none!important;color:var(--primary-text-color,#0f172a)!important}
      .dm-shutter-popup-dialog>header button{display:grid!important;place-items:center!important;flex:0 0 46px!important;width:46px!important;height:46px!important;margin:0!important;border:1px solid color-mix(in srgb,var(--divider-color,#dbe4ee) 75%,transparent)!important;border-radius:50%!important;background:var(--secondary-background-color,var(--surface-2,#f8fafc))!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important;font-size:22px!important}
      .dm-shutter-popup-list{display:grid!important;gap:12px!important;padding:18px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important}
      .dm-shutter-popup-row{display:grid!important;grid-template-columns:minmax(150px,1fr) minmax(270px,330px)!important;align-items:center!important;gap:16px!important;padding:16px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--secondary-background-color,var(--surface-2,#f8fafc))!important;box-shadow:none!important}
      .dm-shutter-details strong{font-size:16px!important;font-weight:900!important;color:var(--primary-text-color,#0f172a)!important}.dm-shutter-details small{font-size:13px!important;line-height:1.35!important;color:var(--secondary-text-color,#64748b)!important}
      .dm-shutter-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}.dm-shutter-actions button{min-height:44px!important;border-radius:11px!important;background:linear-gradient(135deg,var(--accent,#0ea5e9),#0284c7)!important;color:#fff!important;font-size:13px!important;font-weight:900!important}.dm-shutter-actions button[data-shutter-service="stop_cover"]{background:linear-gradient(135deg,#64748b,#475569)!important}.dm-shutter-actions button[data-shutter-service="close_cover"]{background:linear-gradient(135deg,#2563eb,#1d4ed8)!important}
      @media(max-width:640px){.dm-shutter-popup-backdrop{display:grid!important;place-items:center!important;align-items:center!important;padding:12px!important}.dm-shutter-popup-dialog{width:100%!important;max-width:560px!important;max-height:calc(100dvh - 24px)!important;border-radius:20px!important}.dm-shutter-popup-dialog>header{min-height:66px!important;padding:11px 14px!important}.dm-shutter-popup-dialog>header h2{font-size:20px!important}.dm-shutter-popup-list{padding:12px!important}.dm-shutter-popup-row{grid-template-columns:1fr!important;gap:12px!important;padding:14px!important}.dm-shutter-actions{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
    `,
  );
}

export function installShutterAlertLayoutSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installShutterAlertLayoutSection, { once: true });
else installShutterAlertLayoutSection();
