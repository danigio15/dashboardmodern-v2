/* Il disegno vero dell'elettrodomestico dentro la finestra dei consumi.
 *
 * Il nome del file dice «layout» perche' una volta questo modulo disegnava per
 * intero la scheda di un elettrodomestico: quella alta, con l'illustrazione
 * grande sopra e i numeri sotto. Quella scheda non esiste piu' — la sezione
 * Elettrodomestici si costruisce le proprie, con le proprie animazioni — e le
 * regole erano rimaste qui, duecentodieci selettori che non trovavano niente,
 * a litigare col foglio arrivato dopo che ne imponeva un'altra copia.
 *
 * Quello che resta e' l'unica cosa che serviva davvero: quando si apre la
 * finestra dei consumi di giornata, ogni riga si porta dentro il disegno che
 * quell'elettrodomestico ha nella sua scheda, invece del fulmine uguale per
 * tutti. */
import { clean, doc, installStyle, root, section } from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_APPLIANCE_LAYOUT_SECTION__";
const state = (globalThis[KEY] ||= { installed: false, listeners: false });

function configuredEntity(value) {
  return clean(typeof value === "string" ? value : value?.entity || value?.entity_id);
}

function applianceEntities(device = {}) {
  return new Set(
    [
      device.daily_energy_entity,
      device.energy_today,
      device.daily_energy,
      device.total_energy_entity,
      device.history_entity,
      device.report_entity,
      device.energy_entity,
      device.energy,
      ...(device.entities || []),
    ]
      .map(configuredEntity)
      .filter(Boolean),
  );
}

function popupDeviceForRow(row, appliances) {
  const entity = clean(row?.dataset?.dmDailyEntity);
  if (entity) {
    const direct = appliances.find((device) => applianceEntities(device).has(entity));
    if (direct) return direct;
  }
  const name = clean(
    row?.querySelector?.(".dm-appliance-daily-row-main strong")?.textContent,
  ).toLowerCase();
  if (!name) return null;
  return appliances.find((device) => clean(device?.name).toLowerCase() === name) || null;
}

function cardArtworkForDevice(device) {
  const id = clean(device?.id);
  const cards = [
    ...(doc?.querySelectorAll?.(
      "#page-appliances-main .appl-wide-card[data-appliance-id],#appl-grid-overview .appl-wide-card[data-appliance-id]",
    ) || []),
  ];
  let card = id ? cards.find((candidate) => clean(candidate.dataset.applianceId) === id) : null;
  if (!card) {
    const name = clean(device?.name).toLowerCase();
    card = cards.find(
      (candidate) =>
        clean(candidate.querySelector(".appl-wide-name")?.textContent).toLowerCase() === name,
    );
  }
  return (
    card?.querySelector?.(".appl-visual .appl-ic") ||
    // Showcase card: the artwork lives in the hero — the photorealistic hero
    // SVG, the shared flat artwork or the user's custom image.
    card?.querySelector?.(
      ".dm-ap-hero > .dm-hero-art, .dm-ap-hero > .dm-appliance-art, .dm-ap-hero > .dm-ap-img",
    ) ||
    null
  );
}

function syncDailyPopupArtwork() {
  const list = doc?.querySelector?.(
    "#dm-appliance-daily-popup [data-dm-daily-popup-list]",
  );
  if (!list) return false;
  const appliances = section("appliances", []);
  if (!Array.isArray(appliances) || !appliances.length) return false;

  list.querySelectorAll(".dm-appliance-daily-row").forEach((row) => {
    const device = popupDeviceForRow(row, appliances);
    if (!device) return;
    const source = cardArtworkForDevice(device);
    if (!source) return;

    let visual = row.querySelector(":scope > .dm-appliance-daily-visual");
    if (!visual) {
      visual = doc.createElement("span");
      visual.className = "dm-appliance-daily-visual";
      row.prepend(visual);
    }
    const deviceId = clean(device.id);
    if (visual.dataset.applianceId === deviceId && visual.firstElementChild) return;
    const clone = source.cloneNode(true);
    clone.removeAttribute("id");
    visual.replaceChildren(clone);
    visual.dataset.applianceId = deviceId;
  });
  return true;
}

function syncAfterDailyPopupRefresh() {
  syncDailyPopupArtwork();
  const pending = root.__DASHBOARDMODERN_APPLIANCES_SECTION__?.dailyPromise;
  if (pending?.then) pending.then(() => syncDailyPopupArtwork()).catch(() => {});
}

function installPopupArtworkBridge() {
  if (!doc || state.listeners) return;
  state.listeners = true;
  doc.addEventListener("click", (event) => {
    if (
      !event.target?.closest?.(
        '#appl-kpi-grid [data-dm-appliance-daily-total="true"]',
      )
    )
      return;
    root.queueMicrotask?.(syncAfterDailyPopupRefresh);
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (
      !event.target?.closest?.(
        '#appl-kpi-grid [data-dm-appliance-daily-total="true"]',
      )
    )
      return;
    root.queueMicrotask?.(syncAfterDailyPopupRefresh);
  });
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    const popup = doc.getElementById("dm-appliance-daily-popup");
    if (!popup || popup.hidden) return;
    root.requestAnimationFrame?.(syncAfterDailyPopupRefresh);
  });
}

function installStyles() {
  installStyle(
    "dm-appliance-layout-section-style",
    `
      /* Qui resta soltanto la finestra dei consumi di giornata.
       *
       * Fino a ieri questo foglio disegnava anche la scheda di un
       * elettrodomestico: quella alta, con l'illustrazione grande sopra e i
       * numeri sotto. Quella scheda non la disegna piu' nessuno da quando la
       * sezione si costruisce le proprie, e le regole erano rimaste qui a
       * litigare con chi arrivava dopo: due disegni completi per una scheda
       * che non esiste, duecentodieci selettori che non trovavano niente.
       *
       * La finestra dei consumi invece esiste, e porta dentro il disegno vero
       * dell'elettrodomestico, ripreso dalla sua scheda, al posto del fulmine
       * uguale per tutti. */
      html #dm-appliance-daily-popup .dm-appliance-daily-row::before{content:none!important;display:none!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual{position:absolute!important;left:18px!important;top:50%!important;width:54px!important;height:54px!important;transform:translateY(-50%)!important;display:grid!important;place-items:center!important;overflow:hidden!important;border-radius:18px!important;background:linear-gradient(145deg,#e0f2fe,#f0f9ff)!important;box-shadow:inset 0 0 0 1px rgba(14,165,233,.12),0 8px 22px rgba(14,165,233,.09)!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual>.appl-ic{display:grid!important;place-items:center!important;width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;margin:0!important;padding:0!important;border:0!important;border-radius:17px!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual .dm-appliance-image-wrap,#dm-appliance-daily-popup .dm-appliance-daily-visual .dm-appliance-image{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;border-radius:15px!important;object-fit:cover!important;object-position:center!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual svg,#dm-appliance-daily-popup .dm-appliance-daily-visual ha-icon{display:block!important;width:50px!important;height:50px!important;max-width:50px!important;max-height:50px!important;--mdc-icon-size:50px}
      #dm-appliance-daily-popup .dm-appliance-daily-visual .dm-appliance-art,#dm-appliance-daily-popup .dm-appliance-daily-visual .dm-hero-art{display:grid!important;place-items:center!important;width:100%!important;height:100%!important}
      #dm-appliance-daily-popup .dm-appliance-daily-visual .dm-ap-img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;border-radius:15px!important;object-fit:cover!important;object-position:center!important;padding:0!important}

      @media(max-width:520px){
        #dm-appliance-daily-popup .dm-appliance-daily-visual{left:14px!important;width:50px!important;height:50px!important;border-radius:17px!important}
        #dm-appliance-daily-popup .dm-appliance-daily-visual>.appl-ic{width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important}
        #dm-appliance-daily-popup .dm-appliance-daily-visual svg,#dm-appliance-daily-popup .dm-appliance-daily-visual ha-icon{width:46px!important;height:46px!important;max-width:46px!important;max-height:46px!important;--mdc-icon-size:46px}
      }
    `,
  );
}

export function installApplianceLayoutSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installPopupArtworkBridge();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installApplianceLayoutSection, { once: true });
else installApplianceLayoutSection();
