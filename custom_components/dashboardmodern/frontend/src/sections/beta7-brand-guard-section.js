import { ACTION_ICON_CATALOG, actionVisual } from "../core/personalization-catalog.js";
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

function closeStableActionPicker() {
  doc?.getElementById("dm-beta9-action-picker")?.remove();
  // Also remove the beta6 picker if an old handler managed to mount it first.
  doc?.getElementById("dm-beta6-quick-icon-picker")?.remove();
}

function openStableActionPicker(input) {
  if (!input || !doc) return false;
  closeStableActionPicker();
  const english = clean(doc.documentElement?.lang).toLowerCase().startsWith("en");
  const modal = doc.createElement("div");
  modal.id = "dm-beta9-action-picker";
  modal.className = "dm-section-modal dm-visual-picker";
  modal.innerHTML = `<section class="dm-section-dialog dm-picker-dialog" role="dialog" aria-modal="true"><header><strong>⚡ ${english ? "Choose action icon" : "Scegli icona azione"}</strong><button type="button" data-close aria-label="Close">✕</button></header><div class="dm-picker-search"><input class="ed-input" type="search" placeholder="🔎 ${english ? "Search…" : "Cerca…"}" data-search></div><div class="dm-picker-grid dm-beta9-action-icon-grid">${ACTION_ICON_CATALOG.map((item, index) => `<button type="button" class="dm-picker-option" data-index="${index}" data-search-text="${esc(`${item.it} ${item.en} ${item.id} ${item.mdi}`.toLowerCase())}"><span class="dm-picker-visual">${actionVisual(item.mdi, 40)}</span><b>${esc(english ? item.en : item.it)}</b></button>`).join("")}</div></section>`;
  doc.body.append(modal);
  modal.querySelector("[data-close]")?.addEventListener("click", closeStableActionPicker);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeStableActionPicker(); });
  modal.querySelector("[data-search]")?.addEventListener("input", (event) => {
    const query = clean(event.target.value).toLowerCase();
    modal.querySelectorAll(".dm-picker-option").forEach((button) => {
      button.hidden = Boolean(query) && !button.dataset.searchText.includes(query);
    });
  });
  modal.querySelectorAll(".dm-picker-option").forEach((button) => button.addEventListener("click", () => {
    const item = ACTION_ICON_CATALOG[Number(button.dataset.index)];
    if (!item) return;
    // Persist MDI tokens, not platform-dependent emoji. Every surface then uses
    // the same local SVG renderer from personalization-catalog.
    input.value = item.mdi;
    input.dataset.dmBeta7DefaultGlyph = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const trigger = input.closest?.(".ed-form-row")?.querySelector?.(".dm-beta6-qa-icon-trigger");
    if (trigger) trigger.innerHTML = actionVisual(item.mdi, 30);
    closeStableActionPicker();
  }));
  root.setTimeout?.(() => modal.querySelector("[data-search]")?.focus(), 20);
  return true;
}

function resetShutterSignature() {
  const regression = root.__DASHBOARDMODERN_BETA7_REGRESSIONS__;
  if (regression) regression.shutterSignature = "";
}

function installShutterEditOwner() {
  const current = root.edTappAdd;
  if (typeof current !== "function" || current.__dmBeta7ShutterConfigOwner) return false;

  function configAwareShutterSave(...args) {
    // A saved room/name/entity change must reach the existing beta7 stable
    // renderer even when Home Assistant state and position did not change.
    resetShutterSignature();
    return current.apply(this, args);
  }

  Object.assign(configAwareShutterSave, current);
  configAwareShutterSave.__dmBeta7ShutterConfigOwner = true;
  configAwareShutterSave.__dmPrevious = current;
  root.edTappAdd = configAwareShutterSave;
  return true;
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

function installOwners() {
  installVehicleOwner();
  installShutterEditOwner();
}

function scan() {
  state.frame = 0;
  installOwners();
  guardAll();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(scan) || root.setTimeout?.(scan, 0) || 0;
}

function installStyles() {
  installStyle("dm-beta7-brand-guard-style", `
    img[data-dm-brand-image][data-dm-beta7-broken="true"]{display:none!important}
    .dm-beta7-brand-guard-fallback{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;color:var(--primary-text-color,var(--text,#0f172a))!important}
    .dm-beta7-brand-guard-fallback svg{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;overflow:visible!important}
    .dm-car-brand[data-brand-source="inline-fallback"]{display:grid!important;place-items:center!important}

    /* The regression owner creates a fixed four-column action row. Pin the
       readable label to column two so a pre-existing emoji/icon can never push
       it into an implicit clipped fifth column. */
    #editor-modal .ed-row.dm-beta7-action-row>.ed-row-main{
      grid-column:2!important;
      grid-row:1!important;
      min-width:0!important;
      max-width:100%!important;
      overflow:hidden!important;
    }
    #editor-modal .ed-row.dm-beta7-action-row>.ed-row-main .ed-row-new,
    #editor-modal .ed-row.dm-beta7-action-row>.ed-row-main .ed-row-old{
      display:block!important;
      min-width:0!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }

    /* beta9: restore compact Home quick actions. One configured action must not
       grow into a full-width empty billboard, and its vector icon stays small. */
    html body #page-home #qa-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(150px,210px))!important;justify-content:start!important;align-items:stretch!important;gap:14px!important;width:100%!important}
    html body #page-home #qa-grid .qa-btn{box-sizing:border-box!important;width:100%!important;max-width:210px!important;min-height:116px!important;height:auto!important;padding:16px 14px!important;border-radius:22px!important;justify-content:center!important;gap:9px!important;background:var(--card-background-color,var(--card-bg,#fff))!important;box-shadow:var(--shadow-sculpted,0 5px 18px rgba(15,23,42,.08))!important}
    html body #page-home #qa-grid .qa-btn .icon{display:grid!important;place-items:center!important;width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;padding:9px!important;border-radius:14px!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 10%,var(--card-background-color,#fff))!important;color:var(--accent,#0ea5e9)!important;box-shadow:none!important}
    html body #page-home #qa-grid .qa-btn .icon .dm-action-glyph{display:grid!important;place-items:center!important;width:28px!important;height:28px!important;max-width:28px!important;max-height:28px!important;color:inherit!important}
    html body #page-home #qa-grid .qa-btn .icon .dm-action-glyph svg{display:block!important;width:28px!important;height:28px!important;max-width:28px!important;max-height:28px!important}
    #dm-beta9-action-picker{z-index:100030!important}#dm-beta9-action-picker .dm-beta9-action-icon-grid .dm-picker-option{min-height:106px!important}#dm-beta9-action-picker .dm-picker-visual{display:grid!important;place-items:center!important;width:46px!important;height:46px!important;color:var(--accent,#0ea5e9)!important}#dm-beta9-action-picker .dm-action-glyph,#dm-beta9-action-picker .dm-action-glyph svg{display:block!important;width:40px!important;height:40px!important;max-width:40px!important;max-height:40px!important}
    @media(max-width:560px){html body #page-home #qa-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;justify-content:stretch!important}html body #page-home #qa-grid .qa-btn{max-width:none!important;min-height:108px!important}}
  `);
}

export function installBeta7BrandGuardSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installOwners();
  doc.addEventListener("error", (event) => {
    if (event.target?.matches?.("img[data-dm-brand-image]")) {
      guardImage(event.target);
      schedule();
    }
  }, true);
  for (const name of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"])
    root.addEventListener?.(name, () => {
      installOwners();
      schedule();
    });
  root.addEventListener?.("dashboardmodern:states-ready", schedule);
  doc.addEventListener("click", (event) => {
    const actionTrigger = event.target?.closest?.(".dm-beta6-qa-icon-trigger");
    if (actionTrigger) {
      const input = doc.getElementById("ed-qa-icon");
      if (input) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openStableActionPicker(input);
        return;
      }
    }
    if (event.target?.closest?.('[data-brand-preview],.tab[data-tab="ev"],.ed-tab[data-tab="sez2"]'))
      root.setTimeout?.(schedule, 0);
  }, true);
  schedule();
}

installBeta7BrandGuardSection();