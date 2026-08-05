import {
  applianceArtwork,
  canonicalArtworkType,
} from "../core/appliance-artwork.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  root,
  section,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCES_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  observer: null,
  normalizing: false,
  listeners: false,
  storeUnsubscribe: null,
});

export function inferApplianceEntity(device = {}, states = {}, kind = "energy") {
  const candidates = [
    device[`${kind}_entity`],
    device[`${kind}_today`],
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    ...(device.entities || []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity || entry?.entity_id))
    .map(clean)
    .filter(Boolean);
  const expected = kind === "power" ? /^(w|kw)$/i : /^(wh|kwh|mwh)$/i;
  const named =
    kind === "power"
      ? /power|potenza|watt/i
      : /energy|energia|kwh|consum|total|totale|mese|month/i;
  return (
    candidates.find((entityId) =>
      expected.test(clean(states?.[entityId]?.attributes?.unit_of_measurement)),
    ) ||
    candidates.find((entityId) => named.test(entityId)) ||
    ""
  );
}

function devices() {
  const values = section("appliances", []);
  return Array.isArray(values) ? values : [];
}

function visualFor(device) {
  try {
    const visual = root.DashboardModernModules?.data?.getDeviceVisual?.(device);
    if (visual) return visual;
  } catch (_error) {}
  if (clean(device?.image || device?.image_url))
    return { kind: "image", value: clean(device.image || device.image_url) };
  return {
    kind: "asset",
    value: clean(
      device?.visual_key || device?.device_type || device?.type || device?.icon || device?.name,
    ),
  };
}

function controlEntity(device) {
  return clean(
    device?.control_entity ||
      (device?.entities || []).find((entry) => {
        const id = typeof entry === "string" ? entry : entry?.entity || entry?.entity_id;
        return /^(switch|light|fan|input_boolean)\./.test(clean(id));
      }),
  );
}

function ensurePowerToggle(card, device, states) {
  const entity = controlEntity(device);
  if (!entity) return;
  let button = card.querySelector('[data-dm-power-toggle="true"]');
  if (!button) {
    button = doc.createElement("button");
    button.type = "button";
    button.className = "dm-appliance-power-toggle";
    button.dataset.dmPowerToggle = "true";
    (card.querySelector(".appl-wide-actions,.appl-actions,.appl-wide-body") || card).append(button);
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const id = clean(button.dataset.entity);
      if (!id || button.disabled) return;
      const on = allStates()[id]?.state === "on";
      button.disabled = true;
      try {
        await root.dmCallHaService?.(id.split(".")[0], on ? "turn_off" : "turn_on", {
          entity_id: id,
        });
      } finally {
        root.setTimeout?.(() => {
          button.disabled = false;
          normalizeApplianceCards();
        }, 250);
      }
    });
  }
  const on = states[entity]?.state === "on";
  button.dataset.entity = entity;
  button.dataset.state = on ? "on" : "off";
  button.textContent = on
    ? english()
      ? "Turn off"
      : "Spegni"
    : english()
      ? "Turn on"
      : "Accendi";
  button.setAttribute("aria-pressed", on ? "true" : "false");
}

function normalizeEnergyGlyphs(card) {
  const candidates = card.querySelectorAll(
    ".appl-wide-stat,.appl-stat,.appl-energy,.appl-kwh,[data-appliance-energy],small",
  );
  candidates.forEach((node) => {
    if (!/🔋/.test(node.textContent || "")) return;
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3 && /🔋/.test(child.nodeValue || ""))
        child.nodeValue = String(child.nodeValue || "").replaceAll("🔋", "⚡");
    });
  });
}

function normalizeStatusBadge(card, device, states) {
  const entity = controlEntity(device);
  const on = entity ? states[entity]?.state === "on" : false;
  const badge = card.querySelector(
    ".appl-wide-status,.appl-status,.appl-state,[data-appliance-state],.appl-badge",
  );
  if (!badge) return;
  badge.dataset.state = on ? "on" : "off";
  badge.textContent = on
    ? english()
      ? "ON"
      : "ACCESO"
    : english()
      ? "OFF"
      : "SPENTO";
}

export function normalizeApplianceCards() {
  if (!doc || state.normalizing) return false;
  const configured = devices();
  const cards = [
    ...doc.querySelectorAll(
      "#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]",
    ),
  ];
  if (!cards.length || !configured.length) return false;
  state.normalizing = true;
  try {
    const byId = new Map(configured.map((item) => [clean(item.id), item]));
    const states = allStates();
    cards.forEach((card, index) => {
      const device = byId.get(clean(card.dataset.applianceId)) || configured[index];
      if (!device) return;
      card.dataset.dmApplianceSection = "true";
      card.dataset.dmArtStyle = "panel";
      card.dataset.applianceThemeAware = "true";
      card.querySelectorAll(".appl-spark").forEach((node) => node.remove());

      const viewport = card.querySelector(".appl-visual");
      const media = viewport?.querySelector(".appl-ic");
      const visual = visualFor(device);
      if (viewport && media) {
        viewport.dataset.applianceCover = "true";
        if (visual.kind === "image" && clean(visual.value)) {
          let wrapper = media.querySelector(":scope>.dm-appliance-image-wrap");
          let image = wrapper?.querySelector(":scope>img.dm-appliance-image");
          if (!wrapper || !image || media.children.length !== 1) {
            wrapper = doc.createElement("span");
            wrapper.className = "dm-appliance-image-wrap";
            image = doc.createElement("img");
            image.className = "dm-appliance-image";
            wrapper.append(image);
            media.replaceChildren(wrapper);
          }
          const src = clean(visual.value);
          const resolved = new URL(src, doc.baseURI).href;
          if (image.src !== resolved) image.src = src;
          image.alt = clean(device.name);
          image.loading = "eager";
          image.decoding = "async";
          card.dataset.dmArtwork = "custom";
          card.dataset.dmMediaKind = "image";
        } else {
          const source = clean(
            visual.value ||
              device.visual_key ||
              device.device_type ||
              device.type ||
              device.icon ||
              device.name,
          );
          const canonical = canonicalArtworkType(source);
          const markup = canonical && applianceArtwork(canonical, 96);
          if (markup) {
            const current = media.querySelector(":scope>.dm-appliance-art");
            if (!current || current.dataset.dmArt !== canonical || !current.querySelector(".dm-art-panel"))
              media.innerHTML = markup;
            card.dataset.dmArtwork = canonical;
            card.dataset.dmMediaKind = "asset";
          }
        }
      }
      normalizeEnergyGlyphs(card);
      normalizeStatusBadge(card, device, states);
      ensurePowerToggle(card, device, states);
    });
    return true;
  } finally {
    state.normalizing = false;
  }
}

function installStyles() {
  installStyle(
    "dm-appliances-section-style",
    `
      #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{
        --dm-appl-bg:var(--ha-card-background,var(--card-background-color,var(--card-bg,#fff)));
        --dm-appl-text:var(--primary-text-color,var(--text,#0f172a));
        --dm-appl-muted:var(--secondary-text-color,var(--text-dim,#475569));
        display:grid!important;grid-template-columns:minmax(108px,30%) minmax(0,1fr)!important;
        box-sizing:border-box!important;min-height:166px!important;max-height:none!important;overflow:hidden!important;
        background:var(--dm-appl-bg)!important;color:var(--dm-appl-text)!important;
        border-color:var(--divider-color,var(--card-border,#dbe4ee))!important
      }
      html[data-theme="dark"] #page-appliances-main .appl-wide-card,html[data-theme="dark"] #appl-grid-overview .appl-wide-card,body.dark #page-appliances-main .appl-wide-card,body.dark #appl-grid-overview .appl-wide-card{--dm-appl-bg:var(--ha-card-background,var(--card-background-color,#162033));--dm-appl-text:var(--primary-text-color,#f8fafc);--dm-appl-muted:var(--secondary-text-color,#b7c3d4)}
      #page-appliances-main .appl-wide-card .appl-visual,#appl-grid-overview .appl-wide-card .appl-visual{
        position:relative!important;box-sizing:border-box!important;min-width:0!important;height:100%!important;
        overflow:hidden!important;background:color-mix(in srgb,var(--accent-color,var(--accent,#0ea5e9)) 14%,var(--dm-appl-bg))!important
      }
      #page-appliances-main .appl-wide-card .appl-wide-body,#appl-grid-overview .appl-wide-card .appl-wide-body{
        display:grid!important;grid-template-rows:auto auto 1fr auto!important;align-content:stretch!important;
        box-sizing:border-box!important;min-width:0!important;padding:14px 14px 12px!important;color:var(--dm-appl-text)!important
      }
      #page-appliances-main .appl-wide-name,#appl-grid-overview .appl-wide-name,
      #page-appliances-main .appl-wide-title,#appl-grid-overview .appl-wide-title,
      #page-appliances-main .appl-wide-card strong,#appl-grid-overview .appl-wide-card strong{
        color:var(--dm-appl-text)!important;opacity:1!important
      }
      #page-appliances-main .appl-wide-cat,#appl-grid-overview .appl-wide-cat,
      #page-appliances-main .appl-wide-stat,#appl-grid-overview .appl-wide-stat,
      #page-appliances-main .appl-wide-card small,#appl-grid-overview .appl-wide-card small,
      #page-appliances-main .appl-energy,#appl-grid-overview .appl-energy,
      #page-appliances-main .appl-kwh,#appl-grid-overview .appl-kwh{
        color:var(--dm-appl-muted)!important;opacity:1!important;font-weight:750!important
      }
      #page-appliances-main .appl-wide-status,#appl-grid-overview .appl-wide-status,
      #page-appliances-main .appl-status,#appl-grid-overview .appl-status,
      #page-appliances-main .appl-state,#appl-grid-overview .appl-state,
      #page-appliances-main [data-appliance-state],#appl-grid-overview [data-appliance-state]{
        display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;
        min-width:68px!important;min-height:30px!important;margin:0!important;padding:6px 10px!important;border-radius:999px!important;
        line-height:1!important;text-align:center!important;font-weight:900!important
      }
      #page-appliances-main [data-state="on"],#appl-grid-overview [data-state="on"]{
        background:color-mix(in srgb,var(--success-color,#10b981) 14%,transparent)!important;color:var(--success-color,#047857)!important
      }
      #page-appliances-main [data-state="off"],#appl-grid-overview [data-state="off"]{
        background:color-mix(in srgb,var(--secondary-text-color,#64748b) 12%,transparent)!important;color:var(--dm-appl-muted)!important
      }
      #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions,
      #page-appliances-main .appl-actions,#appl-grid-overview .appl-actions{
        display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important;margin-top:10px!important
      }
      #page-appliances-main .dm-appliance-power-toggle,#appl-grid-overview .dm-appliance-power-toggle{
        display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;
        min-width:88px!important;min-height:38px!important;margin:0!important;padding:8px 14px!important;border:0!important;
        border-radius:12px!important;background:linear-gradient(135deg,var(--info-color,#38bdf8),var(--primary-color,#0284c7))!important;
        color:#fff!important;font-weight:900!important;line-height:1!important;cursor:pointer!important
      }
      #page-appliances-main .dm-appliance-power-toggle[data-state="on"],#appl-grid-overview .dm-appliance-power-toggle[data-state="on"]{
        background:linear-gradient(135deg,#38bdf8,#0284c7)!important
      }
      #page-appliances-main .dm-appliance-image-wrap,#appl-grid-overview .dm-appliance-image-wrap,
      #page-appliances-main .dm-appliance-image,#appl-grid-overview .dm-appliance-image,
      #page-appliances-main .dm-appliance-art,#appl-grid-overview .dm-appliance-art,
      #page-appliances-main .dm-appliance-art>svg,#appl-grid-overview .dm-appliance-art>svg{
        position:absolute!important;inset:0!important;display:block!important;box-sizing:border-box!important;
        width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;margin:0!important;padding:0!important
      }
      #page-appliances-main .dm-appliance-image,#appl-grid-overview .dm-appliance-image{object-fit:cover!important;object-position:center!important}
      @media(max-width:560px){
        #page-appliances-main .appl-wide-card,#appl-grid-overview .appl-wide-card{grid-template-columns:96px minmax(0,1fr)!important;min-height:158px!important}
        #page-appliances-main .appl-wide-card .appl-wide-body,#appl-grid-overview .appl-wide-card .appl-wide-body{padding:12px 10px!important}
        #page-appliances-main .appl-wide-actions,#appl-grid-overview .appl-wide-actions{flex-wrap:wrap!important}
      }
    `,
  );
}

function installObserver() {
  if (!doc || state.observer || typeof root.MutationObserver !== "function") return;
  const targets = [doc.getElementById("appl-grid-overview"), doc.getElementById("page-appliances-main")].filter(Boolean);
  if (!targets.length) return;
  state.observer = new root.MutationObserver(() => root.queueMicrotask?.(normalizeApplianceCards));
  targets.forEach((target) => state.observer.observe(target, { childList: true, subtree: true }));
}

function installWrappers() {
  wrapFunction("renderAppliances", "__dmAppliancesSection", normalizeApplianceCards);
  wrapFunction("renderApplianceSection", "__dmAppliancesSection", normalizeApplianceCards);
  wrapFunction("render", "__dmAppliancesRenderSection", normalizeApplianceCards);
}

function subscribeStore() {
  if (state.storeUnsubscribe || !dashboardStore()?.subscribe) return;
  state.storeUnsubscribe = dashboardStore().subscribe((change) => {
    if (change.section === "appliances") root.queueMicrotask?.(normalizeApplianceCards);
  });
}

export function installAppliancesSection() {
  if (!doc) return;
  installStyles();
  installWrappers();
  installObserver();
  subscribeStore();
  normalizeApplianceCards();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", normalizeApplianceCards);
    root.addEventListener?.("dashboardmodern:legacy-ready", () => {
      installWrappers();
      installObserver();
      normalizeApplianceCards();
    });
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.("[data-tab='appliances'],.tab[data-tab='appliances']"))
          root.queueMicrotask?.(normalizeApplianceCards);
      },
      true,
    );
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installAppliancesSection, { once: true });
else installAppliancesSection();
