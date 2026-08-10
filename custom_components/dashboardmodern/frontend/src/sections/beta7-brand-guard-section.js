import { clean, doc, esc, installStyle, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA7_BRAND_GUARD__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

const INLINE_BRANDS = Object.freeze({
  abarth: "<path d='M20 5h24l-3 9-9 4 6 5-4 12-8 5-8-5-4-12 6-5-9-4z' fill='none' stroke='currentColor' stroke-width='2.8'/><path d='M27 13l-5 8 6 1-4 8 11-11-7-1 4-5z' fill='currentColor'/>",
  "alfa-romeo": "<circle cx='32' cy='22' r='16' fill='none' stroke='currentColor' stroke-width='2.7'/><path d='M24 10v24M17 17h14' stroke='currentColor' stroke-width='2.3'/><path d='M38 11c-7 6-2 9-7 13 8 0 10 5 5 11 9-4 12-13 2-24z' fill='currentColor' opacity='.78'/>",
  byd: "<ellipse cx='32' cy='22' rx='25' ry='13' fill='none' stroke='currentColor' stroke-width='2.6'/><text x='32' y='27' text-anchor='middle' font-size='14' font-weight='900' font-family='system-ui'>BYD</text>",
  cupra: "<path d='M12 15l13 4 7 12 7-12 13-4-9 11 7 8-14-5-4 8-4-8-14 5 7-8z' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linejoin='round'/>",
});

function fallbackMarkup(img) {
  const key = clean(img?.dataset?.dmBrandImage).toLowerCase();
  const name = clean(img?.alt || key || "Auto");
  const initials = name.split(/[\s-]+/).map((part) => part[0] || "").join("").slice(0, 3).toUpperCase();
  const body = INLINE_BRANDS[key] || `<rect x='7' y='5' width='50' height='34' rx='12' fill='none' stroke='currentColor' stroke-width='2.4'/><text x='32' y='27' text-anchor='middle' font-size='13' font-weight='900' font-family='system-ui'>${esc(initials || "EV")}</text>`;
  return `<span class="dm-beta7-brand-guard-fallback" data-dm-brand-fallback="${esc(key)}" title="${esc(name)}"><svg viewBox="0 0 64 44" role="img" aria-label="${esc(name)}">${body}</svg></span>`;
}

function guardImage(img) {
  if (!img?.matches?.("img[data-dm-brand-image]")) return false;

  // Claim the DOM contract immediately, before the remote image has finished
  // loading. The later beta7 polish must never replace the <img> node while a
  // WebView/CDN failure is still pending.
  img.dataset.dmBeta7Repaired = "true";
  if (!(img.complete && Number(img.naturalWidth) === 0)) return false;

  const parent = img.parentElement;
  if (!parent) return false;
  img.dataset.dmBeta7Broken = "true";
  img.style.setProperty("display", "none", "important");
  if (!parent.querySelector(".dm-beta7-brand-guard-fallback"))
    img.insertAdjacentHTML("afterend", fallbackMarkup(img));
  parent.closest?.(".dm-car-brand")?.setAttribute("data-brand-source", "inline-fallback");
  return true;
}

function guardAll() {
  doc?.querySelectorAll?.("img[data-dm-brand-image]").forEach(guardImage);
}

function scan() {
  state.frame = 0;
  installVehicleOwner();
  guardAll();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(scan) || root.setTimeout?.(scan, 0) || 0;
}

function installVehicleOwner() {
  const current = root.dmRenderVehicleSelector;
  if (typeof current !== "function" || current.__dmBeta7BrandContractOwner) return false;

  function ownedVehicleSelector(...args) {
    const result = current.apply(this, args);
    // Protect newly-created brand nodes synchronously. beta7-regression wraps
    // this same renderer and schedules its polish after the call returns.
    guardAll();
    return result;
  }

  Object.assign(ownedVehicleSelector, current);
  ownedVehicleSelector.__dmBeta7BrandContractOwner = true;
  ownedVehicleSelector.__dmPrevious = current;
  root.dmRenderVehicleSelector = ownedVehicleSelector;
  return true;
}

function installStyles() {
  installStyle("dm-beta7-brand-guard-style", `
    img[data-dm-brand-image][data-dm-beta7-broken="true"]{display:none!important}
    .dm-beta7-brand-guard-fallback{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;color:var(--primary-text-color,var(--text,#0f172a))!important}
    .dm-beta7-brand-guard-fallback svg{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;overflow:visible!important}
    .dm-car-brand[data-brand-source="inline-fallback"]{display:grid!important;place-items:center!important}
  `);
}

export function installBeta7BrandGuardSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installVehicleOwner();
  doc.addEventListener("error", (event) => {
    if (event.target?.matches?.("img[data-dm-brand-image]")) {
      guardImage(event.target);
      schedule();
    }
  }, true);
  for (const name of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"])
    root.addEventListener?.(name, () => {
      installVehicleOwner();
      schedule();
    });
  root.addEventListener?.("dashboardmodern:states-ready", schedule);
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.('[data-brand-preview],.tab[data-tab="ev"],.ed-tab[data-tab="sez2"]'))
      root.setTimeout?.(schedule, 0);
  }, true);
  schedule();
}

installBeta7BrandGuardSection();