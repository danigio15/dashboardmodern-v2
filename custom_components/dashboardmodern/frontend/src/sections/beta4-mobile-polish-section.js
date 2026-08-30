import { catalogLabel, ROOM_CATALOG, roomVisual } from "../core/personalization-catalog.js";
import { clean, doc, esc, formatNumber, installStyle, root, t, wrapFunction } from "./shared.js";

// Kept in the beta4 entry filename for release compatibility, but this module is
// now the final root-cause owner for the regressions reported after beta.4.
globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_BETA5_ROOT_CAUSES__";
const state = (root[KEY] ||= { installed: false, frame: 0, listeners: false, dailyChart: null });

const TAB_ICONS = Object.freeze({
  visib: "⚙️",
  sez0: "🏠",
  sez1: "⚡",
  sez2: "🚗",
  sez3: "🌞",
  sez4: "🛡️",
  sez6: "🖥️",
  sez7: "🌡️",
  sez8: "⚡",
  sez9: "❄️",
  appliances: "🧺",
  luci: "💡",
  /* Il divano, non la porta: la porta e' delle Aperture (`doors`, qui
   * sotto), e da telefono — dove della linguetta resta il solo simbolo —
   * due porte affiancate non si distinguono. */
  stanze: "🛋️",
  avvisi: "🔔",
  tapp: "🪟",
  irr: "💧",
  pool: "🏊",
  /* Le schede nate dopo questa tabella. Senza il loro nome qui la linguetta
   * restava tutta intera — simbolo e parola insieme — e da telefono, dove la
   * colonna si stringe a un simbolo solo, quelle quattro uscivano fuori misura
   * col nome accavallato. Il simbolo e' lo stesso che ognuna si scrive. */
  todo: "🧩",
  backup: "💾",
  people: "👥",
  robot: "🤖",
  doors: "🚪",
});

const FLOW_LOADS = Object.freeze({
  boiler: { day: "dm.energy_boiler_oggi", month: "dm.energy_boiler_mese" },
  wb: { day: "dm.ev_energia_wallbox_oggi", month: "dm.ev_energia_wallbox_mese" },
  clima: { day: "dm.energy_condizionatori_oggi", month: "dm.energy_condizionatori_mese" },
  lav: { day: "dm.energy_somma_lavanderia_oggi", month: "dm.energy_somma_lavanderia_mese" },
  cuc: { day: "dm.energy_somma_cucina_oggi", month: "dm.energy_somma_cucina_mese" },
});

const BRAND_LOGOS = Object.freeze({
  abarth: "<path d='M20 5h24l-3 9-9 4 6 5-4 12-8 5-8-5-4-12 6-5-9-4z' fill='none' stroke='currentColor' stroke-width='2.8'/><path d='M27 13l-5 8 6 1-4 8 11-11-7-1 4-5z' fill='currentColor'/>",
  "alfa-romeo": "<circle cx='32' cy='22' r='16' fill='none' stroke='currentColor' stroke-width='2.7'/><path d='M24 10v24M17 17h14' stroke='currentColor' stroke-width='2.3'/><path d='M38 11c-7 6-2 9-7 13 8 0 10 5 5 11 9-4 12-13 2-24z' fill='currentColor' opacity='.78'/>",
  audi: "<g fill='none' stroke='currentColor' stroke-width='3'><circle cx='17' cy='22' r='9'/><circle cx='27' cy='22' r='9'/><circle cx='37' cy='22' r='9'/><circle cx='47' cy='22' r='9'/></g>",
  bmw: "<circle cx='32' cy='22' r='18' fill='none' stroke='currentColor' stroke-width='3'/><circle cx='32' cy='22' r='11' fill='none' stroke='currentColor' stroke-width='2'/><path d='M32 11v11H21A11 11 0 0 1 32 11zm0 11h11a11 11 0 0 1-11 11z' fill='currentColor' opacity='.8'/>",
  byd: "<ellipse cx='32' cy='22' rx='25' ry='13' fill='none' stroke='currentColor' stroke-width='2.6'/><text x='32' y='27' text-anchor='middle' font-size='14' font-weight='900' font-family='system-ui'>BYD</text>",
  citroen: "<path d='M17 24l15-10 15 10M17 33l15-10 15 10' fill='none' stroke='currentColor' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/>",
  cupra: "<path d='M12 15l13 4 7 12 7-12 13-4-9 11 7 8-14-5-4 8-4-8-14 5 7-8z' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linejoin='round'/>",
  dacia: "<path d='M10 11h44v10c0 11-9 18-22 18S10 32 10 21z' fill='none' stroke='currentColor' stroke-width='2.8'/><path d='M20 18h24M25 18v11h14V18' fill='none' stroke='currentColor' stroke-width='3'/>",
  ds: "<path d='M11 30l14-17 8 9-8 8H11zm42-16H37l-7 8 8 8h15l-8-8z' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linejoin='round'/>",
  fiat: "<circle cx='32' cy='22' r='18' fill='none' stroke='currentColor' stroke-width='3'/><text x='32' y='27' text-anchor='middle' font-size='14' font-weight='900' font-family='system-ui'>FIAT</text>",
  ford: "<ellipse cx='32' cy='22' rx='27' ry='14' fill='none' stroke='currentColor' stroke-width='3'/><text x='32' y='27' text-anchor='middle' font-size='14' font-weight='800' font-style='italic' font-family='serif'>Ford</text>",
  honda: "<rect x='10' y='6' width='44' height='32' rx='10' fill='none' stroke='currentColor' stroke-width='2.7'/><path d='M21 13l3 18M43 13l-3 18M23 24h18' fill='none' stroke='currentColor' stroke-width='4' stroke-linecap='round'/>",
  hyundai: "<ellipse cx='32' cy='22' rx='25' ry='15' fill='none' stroke='currentColor' stroke-width='2.8'/><path d='M20 30l8-17M36 31l8-18M26 24l12-4' fill='none' stroke='currentColor' stroke-width='3.5' stroke-linecap='round'/>",
  jeep: "<text x='32' y='27' text-anchor='middle' font-size='18' font-weight='900' font-family='system-ui'>Jeep</text><path d='M16 31h32' stroke='currentColor' stroke-width='2'/>",
  kia: "<ellipse cx='32' cy='22' rx='27' ry='14' fill='none' stroke='currentColor' stroke-width='2.4'/><path d='M15 28V16m0 6l9-6m-9 6l10 6M29 28l6-12 6 12m-9-5h6M45 28V16' fill='none' stroke='currentColor' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'/>",
  lancia: "<path d='M32 4l20 8-4 20-16 8-16-8-4-20z' fill='none' stroke='currentColor' stroke-width='2.5'/><path d='M22 25h20M32 11v22M27 14h10' stroke='currentColor' stroke-width='2.5'/>",
  leapmotor: "<circle cx='32' cy='22' r='17' fill='none' stroke='currentColor' stroke-width='3'/><path d='M21 25c6-1 10-5 12-13 2 8 5 12 11 14-6 0-10 3-12 7-2-4-5-7-11-8z' fill='currentColor'/>",
  lexus: "<ellipse cx='32' cy='22' rx='25' ry='15' fill='none' stroke='currentColor' stroke-width='2.7'/><path d='M34 10L22 32h22' fill='none' stroke='currentColor' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/>",
  mazda: "<ellipse cx='32' cy='22' rx='25' ry='15' fill='none' stroke='currentColor' stroke-width='2.7'/><path d='M15 17c7 0 12 3 17 10 5-7 10-10 17-10-4 9-9 14-17 14s-13-5-17-14z' fill='none' stroke='currentColor' stroke-width='2.8'/>",
  "mercedes-benz": "<circle cx='32' cy='22' r='18' fill='none' stroke='currentColor' stroke-width='2.5'/><path d='M32 7v15L17 31M32 22l15 9' fill='none' stroke='currentColor' stroke-width='2.8' stroke-linejoin='round'/>",
  mg: "<path d='M20 5h24l12 12v10L44 39H20L8 27V17z' fill='none' stroke='currentColor' stroke-width='2.6'/><text x='32' y='28' text-anchor='middle' font-size='16' font-weight='900' font-family='system-ui'>MG</text>",
  mini: "<circle cx='32' cy='22' r='11' fill='none' stroke='currentColor' stroke-width='2.6'/><path d='M21 15H5m16 5H9m12 5H5m38-10h16m-16 5h12m-12 5h16' stroke='currentColor' stroke-width='2.5'/><text x='32' y='25' text-anchor='middle' font-size='6' font-weight='900' font-family='system-ui'>MINI</text>",
  nissan: "<circle cx='32' cy='22' r='17' fill='none' stroke='currentColor' stroke-width='2.5'/><rect x='8' y='17' width='48' height='10' rx='2' fill='var(--card-background-color,#fff)' stroke='currentColor' stroke-width='2'/><text x='32' y='24.5' text-anchor='middle' font-size='8' font-weight='900' font-family='system-ui'>NISSAN</text>",
  opel: "<circle cx='32' cy='22' r='18' fill='none' stroke='currentColor' stroke-width='2.5'/><path d='M8 24h20l-4 7 32-12H36l4-7z' fill='currentColor'/>",
  peugeot: "<path d='M16 6h32v28L32 40 16 34z' fill='none' stroke='currentColor' stroke-width='2.6'/><path d='M35 12c-7 1-11 5-9 10-5 2-5 8 1 10l5-5 5 4 5-6-5-4 3-6z' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linejoin='round'/>",
  polestar: "<path d='M32 4l5 13 13 5-13 5-5 13-5-13-13-5 13-5z' fill='none' stroke='currentColor' stroke-width='2.3'/><path d='M32 10v24M20 22h24' stroke='currentColor' stroke-width='1.6' opacity='.55'/>",
  porsche: "<path d='M17 4h30l4 12-5 17-14 8-14-8-5-17z' fill='none' stroke='currentColor' stroke-width='2.5'/><path d='M22 8v27M42 8v27M18 17h28M18 27h28' stroke='currentColor' stroke-width='1.8'/><path d='M28 13h8l4 8-8 9-8-9z' fill='currentColor' opacity='.7'/>",
  renault: "<path d='M32 3l17 19-17 19-17-19zM32 9L22 22l10 13 10-13z' fill='none' stroke='currentColor' stroke-width='3'/>",
  seat: "<path d='M19 8h31L44 15H25l-4 5h24l-5 7H16l-5 6h30l-5 7H8l-4-7 7-8-4-7z' fill='currentColor'/>",
  skoda: "<circle cx='32' cy='22' r='18' fill='none' stroke='currentColor' stroke-width='2.6'/><path d='M19 24c9-11 19-12 27-7l-6 4 5 4-9 1-5 8-3-8z' fill='currentColor'/><circle cx='25' cy='18' r='2.5' fill='var(--card-background-color,#fff)'/>",
  smart: "<circle cx='23' cy='22' r='14' fill='none' stroke='currentColor' stroke-width='4'/><path d='M34 12h20v20M34 12l20 20' fill='none' stroke='currentColor' stroke-width='3.5' stroke-linecap='round'/>",
  subaru: "<ellipse cx='32' cy='22' rx='25' ry='15' fill='none' stroke='currentColor' stroke-width='2.5'/><g fill='currentColor'><path d='M18 22l2-2 2 2-2 2z'/><path d='M28 15l3-3 3 3-3 3z'/><path d='M39 19l2-2 2 2-2 2z'/><path d='M32 27l2-2 2 2-2 2z'/><path d='M44 27l1.5-1.5L47 27l-1.5 1.5z'/><path d='M25 31l1.5-1.5L28 31l-1.5 1.5z'/></g>",
  suzuki: "<path d='M40 7L20 7l-7 8 17 8-11 7 6 7h21l7-8-17-8 11-7z' fill='none' stroke='currentColor' stroke-width='3' stroke-linejoin='round'/>",
  tesla: "<path d='M13 11c13-6 25-6 38 0l-5 5c-6-2-10-3-14-3v24l-5-6V13c-4 0-8 1-14 3z' fill='currentColor'/>",
  toyota: "<ellipse cx='32' cy='22' rx='25' ry='15' fill='none' stroke='currentColor' stroke-width='2.5'/><ellipse cx='32' cy='18' rx='10' ry='14' fill='none' stroke='currentColor' stroke-width='2.2'/><ellipse cx='32' cy='17' rx='18' ry='7' fill='none' stroke='currentColor' stroke-width='2.2'/>",
  volkswagen: "<circle cx='32' cy='22' r='18' fill='none' stroke='currentColor' stroke-width='2.8'/><path d='M17 10l15 24 15-24M22 10l10 15 10-15M17 28h30' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linejoin='round'/>",
  volvo: "<circle cx='29' cy='24' r='14' fill='none' stroke='currentColor' stroke-width='3'/><path d='M39 14L54 3m-9 1h9v9' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/><path d='M16 24h26' stroke='currentColor' stroke-width='2'/>",
  xpeng: "<path d='M8 11l17 6 7 10 7-10 17-6-12 14 11 8-17-4-6 10-6-10-17 4 11-8z' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linejoin='round'/>",
});

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* Il simbolo con cui una linguetta comincia, se ne ha uno. */
function primoSimbolo(button) {
  const gia = clean(button.querySelector(":scope > .dm-beta4-tab-icon")?.textContent);
  if (gia) return gia;
  const testo = clean(button.textContent);
  const trovato = testo.match(/^[^\p{L}\p{N}\s]+/u);
  return trovato ? trovato[0].trim() : "";
}

function stripLeadingIcon(value) {
  return clean(value).replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

function normalizeBrandKey(value) {
  return clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function brandLogo(brand) {
  const key = normalizeBrandKey(brand);
  const body = BRAND_LOGOS[key] || `<path d='M10 10h44v24H10z' fill='none' stroke='currentColor' stroke-width='2.5'/><text x='32' y='27' text-anchor='middle' font-size='10' font-weight='900' font-family='system-ui'>${esc(clean(brand).slice(0, 8).toUpperCase())}</text>`;
  return `<span class="dm-beta5-brand-logo" data-brand-logo="${esc(key)}" title="${esc(brand)}"><svg viewBox="0 0 64 44" role="img" aria-label="${esc(brand)}">${body}</svg></span>`;
}

function syncConfigTabIcons() {
  doc?.querySelectorAll?.(".ed-tab[data-tab]").forEach((button) => {
    const tab = clean(button.dataset.tab);
    /* Chi non e' in tabella tiene il simbolo che si scrive da solo.
     *
     * Prima si usciva subito, e quella linguetta non veniva divisa in simbolo
     * e nome: la regola che da telefono nasconde il nome cerca proprio quel
     * pezzo, e non trovandolo lasciava la parola attaccata al simbolo dentro
     * una colonna larga quanto un dito. Succedeva a ogni scheda aggiunta dopo
     * che questa tabella e' stata scritta — cioe' sempre alle ultime. Adesso
     * la tabella e' il primo posto dove guardare, non l'unico. */
    const icon = TAB_ICONS[tab] || primoSimbolo(button);
    if (!icon) return;
    const existingLabel = button.querySelector("[data-dm-config-name]");
    const labelText = stripLeadingIcon(existingLabel?.textContent || button.textContent) || tab;
    let iconNode = button.querySelector(":scope > .dm-beta4-tab-icon");
    let labelNode = existingLabel;
    if (!iconNode || !labelNode) {
      const current = labelText;
      button.replaceChildren();
      iconNode = doc.createElement("span");
      iconNode.className = "dm-beta4-tab-icon";
      iconNode.setAttribute("aria-hidden", "true");
      labelNode = doc.createElement("span");
      labelNode.dataset.dmConfigName = "true";
      labelNode.className = "dm-beta4-tab-label";
      labelNode.textContent = current;
      button.append(iconNode, labelNode);
    }
    iconNode.textContent = icon;
    if (!clean(labelNode.textContent)) labelNode.textContent = labelText;
    /* Il nome anche fuori dal pezzo che lo scrive.
     *
     * Da telefono, tenuto in piedi, quel pezzo si nasconde e della linguetta
     * resta il simbolo: senza questo, un simbolo che uno non riconosce non ha
     * piu' nessun modo di dire chi e' — ne' a chi tiene premuto, ne' a chi la
     * pagina se la fa leggere. */
    const nome = clean(labelNode.textContent) || labelText;
    if (button.title !== nome) button.title = nome;
    if (button.getAttribute("aria-label") !== nome) button.setAttribute("aria-label", nome);
  });
}

function normalizeSectionRenameButtons() {
  const body = doc?.getElementById("ed-body");
  if (!body) return false;
  body.querySelectorAll(".ed-row[data-section-key]").forEach((row) => {
    const buttons = [...row.querySelectorAll(".dm-inline-rename[data-rename]")];
    if (!buttons.length) return;
    const primary = buttons.find((button) => button.parentElement?.classList?.contains("ed-row-main")) || buttons[0];
    buttons.forEach((button) => {
      if (button !== primary) button.remove();
    });
    primary.classList.add("dm-beta5-section-rename");
    primary.dataset.dmBeta5Primary = "true";
    primary.removeAttribute("style");
  });
  return true;
}

function polishCarBrandMarks() {
  const hosts = [
    ...(doc?.querySelectorAll?.('#dm-visual-picker[data-kind="car"] .dm-picker-option') || []),
    ...(doc?.querySelectorAll?.("[data-brand-preview],.dm-ev-brand-badge") || []),
  ];
  hosts.forEach((host) => {
    const brand = clean(host.querySelector("b")?.textContent || host.querySelector(".dm-car-brand")?.getAttribute("title"));
    const mark = host.querySelector(".dm-car-brand");
    if (!brand || !mark) return;
    if (mark.dataset.dmBeta5Brand === brand && mark.querySelector("[data-brand-logo]")) return;
    mark.dataset.dmBeta5Brand = brand;
    // This marker also stops the old beta4 wordmark decorator if a stale copy is
    // still in memory during a hot reload.
    mark.dataset.dmBeta4Brand = brand;
    mark.innerHTML = brandLogo(brand);
  });
}

function closeRoomPicker() {
  doc?.getElementById("dm-beta5-room-picker")?.remove();
}

function openRoomPicker(input) {
  if (!input) return;
  closeRoomPicker();
  const modal = doc.createElement("div");
  modal.id = "dm-beta5-room-picker";
  modal.className = "dm-section-modal dm-visual-picker";
  modal.innerHTML = `<section class="dm-section-dialog dm-picker-dialog" role="dialog" aria-modal="true"><header><strong>🏠 ${t("Scegli l'icona stanza", "Choose room icon")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></header><div class="dm-picker-search"><input class="ed-input" type="search" placeholder="🔎 ${t("Cerca…", "Search…")}" data-search></div><div class="dm-picker-grid">${ROOM_CATALOG.map((item, index) => `<button type="button" class="dm-picker-option" data-index="${index}" data-search-text="${esc(`${item.it} ${item.en} ${item.keywords || ""}`.toLowerCase())}"><span class="dm-picker-visual">${roomVisual(item.mdi, 46)}</span><b>${esc(catalogLabel(item))}</b></button>`).join("")}</div></section>`;
  doc.body.append(modal);
  modal.querySelector("[data-close]")?.addEventListener("click", closeRoomPicker);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeRoomPicker(); });
  modal.querySelector("[data-search]")?.addEventListener("input", (event) => {
    const query = clean(event.target.value).toLowerCase();
    modal.querySelectorAll(".dm-picker-option").forEach((button) => {
      button.hidden = Boolean(query) && !button.dataset.searchText.includes(query);
    });
  });
  modal.querySelectorAll(".dm-picker-option").forEach((button) => button.addEventListener("click", () => {
    const item = ROOM_CATALOG[Number(button.dataset.index)];
    if (!item) return;
    input.value = item.mdi;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    closeRoomPicker();
    schedule();
  }));
  root.setTimeout?.(() => modal.querySelector("[data-search]")?.focus(), 20);
}

function polishRoomFirstInsert() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "stanze") return false;
  body.dataset.dmBeta5Rooms = "true";
  const input = body.querySelector("#ed-room-icon");
  const name = body.querySelector("#ed-room-name");
  if (!input || !name) return false;
  const row = input.parentElement;
  if (!row) return false;
  row.classList.add("dm-beta5-room-add-row");
  const legacyPreview = body.querySelector("#ed-room-icon-preview");
  if (legacyPreview) legacyPreview.hidden = true;
  const trigger = [...row.querySelectorAll("button")].find((button) => /dmIconPicker|wzPickIcon/i.test(button.getAttribute("onclick") || "") || clean(button.textContent) === "🎨" || button.classList.contains("dm-beta4-room-icon-trigger"));
  if (!trigger) return false;
  trigger.removeAttribute("onclick");
  trigger.removeAttribute("style");
  trigger.className = "dm-beta5-room-icon-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-label", t("Scegli icona stanza", "Choose room icon"));
  const refresh = () => {
    const value = clean(input.value) || "mdi:home";
    /* La stessa icona che si vedra' dopo il salvataggio: l'anteprima diceva
     * l'emoji (🚿) mentre il catalogo e le righe salvate dicono il disegno di
     * casa — «prima si mostra un'icona poi se ne vede un'altra». Chi disegna
     * l'anteprima e' lo stesso motore che disegna il resto. */
    trigger.innerHTML =
      root.DashboardModernIconEngine?.markup?.("room", value, { size: 40 }) ||
      roomVisual(value, 46) ||
      `<span aria-hidden="true">🏠</span>`;
  };
  if (trigger.dataset.dmBeta5Bound !== "true") {
    trigger.dataset.dmBeta5Bound = "true";
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openRoomPicker(input);
    });
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
  }
  if (row.firstElementChild !== trigger) row.prepend(trigger);
  refresh();
  return true;
}

function removeAlertFlash(form, customMode) {
  if (!form || customMode) return;
  form.querySelectorAll("button,.dm-action-glyph").forEach((node) => {
    const text = clean(node.textContent);
    const powerGlyph = node.matches?.('.dm-action-glyph[data-action="power"]') || node.querySelector?.('.dm-action-glyph[data-action="power"]');
    if ((text === "⚡" || powerGlyph) && !node.closest(".ed-row")) node.remove();
  });
}

function polishAlertIconField(contenitore) {
  const input = contenitore?.querySelector?.("#ed-avv-icon");
  if (!input) return;
  const row = input.parentElement;
  if (!row) return;
  row.classList.add("dm-beta5-alert-icon-row");
  const button = [...row.querySelectorAll("button")].at(-1);
  if (!button) return;
  button.removeAttribute("style");
  button.classList.add("dm-beta5-alert-icon-trigger");
  button.setAttribute("aria-label", t("Scegli icona avviso", "Choose alert icon"));
}

function polishAlertsFirstInsert() {
  const body = doc?.getElementById("ed-body");
  // La scheda degli avvisi sta in fondo a quella dei widget: la si riconosce
  // dai suoi campi, non dalla linguetta.
  if (!body || !body.querySelector("#ed-avv-grp")) return false;
  body.dataset.dmBeta5Alerts = "true";
  const group = body.querySelector("#ed-avv-grp");
  const entity = body.querySelector("#ed-avv-ent");
  const custom = body.querySelector("#ed-avv-custom");
  if (!group || !entity) return false;
  const form = group.closest(".ed-form") || group.parentElement;
  entity.parentElement?.classList.add("dm-beta5-alert-entity-row");
  const syncCustom = () => {
    const visible = clean(group.value) === "custom";
    if (custom) {
      custom.hidden = !visible;
      custom.style.display = visible ? "grid" : "none";
      custom.setAttribute("aria-hidden", String(!visible));
    }
    /* La riga dell'icona non vive piu' dentro il blocco custom: l'icona vale
     * per OGNI avviso (#229), quindi la sua riga e' sempre visibile e si
     * veste sempre — cercandola nel blocco custom non la si trovava piu' e il
     * tasto restava nudo. */
    polishAlertIconField(form || body);
    removeAlertFlash(form, visible);
  };
  if (group.dataset.dmBeta5Bound !== "true") {
    group.dataset.dmBeta5Bound = "true";
    group.addEventListener("change", () => root.queueMicrotask?.(syncCustom));
  }
  syncCustom();
  return true;
}

function polishLightsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== "luci") return false;
  body.dataset.dmBeta5Lights = "true";
  body.querySelectorAll(".dm-light-row").forEach((row) => {
    row.dataset.dmBeta5LightRow = "true";
    row.querySelector(".ed-row-main")?.setAttribute("data-dm-light-main", "true");
    const deleteButton = [...row.children].find((node) => node.matches?.("button.ed-del:not(.dm-light-edit)"));
    deleteButton?.classList.add("dm-light-delete");
  });
  const addEntity = body.querySelector("#luce-add-ent,[data-light-add-entity]");
  addEntity?.parentElement?.classList.add("dm-beta5-light-entity-row");
  return true;
}

function polishClimateCards() {
  const page = doc?.getElementById("page-clima");
  if (!page) return false;
  page.dataset.dmBeta5Climate = "canonical";
  page.querySelectorAll(".cp-card").forEach((card) => card.dataset.dmBeta5ClimateCard = "true");
  return true;
}

function numericState(reference) {
  const id = clean(reference);
  if (!id) return null;
  const resolved = clean(root.resolveEntity?.(id) || id);
  const registries = [root.STATES, root._RAW_STATES];
  for (const registry of registries) {
    const raw = registry?.[resolved]?.state ?? registry?.[id]?.state;
    const value = Number(raw);
    if (Number.isFinite(value)) return Math.max(0, value);
  }
  const projected = Number(root.CD_PERIOD?.[id]);
  return Number.isFinite(projected) ? Math.max(0, projected) : null;
}

function keepSecondaryEnergyFlowsComplete() {
  for (const [load, references] of Object.entries(FLOW_LOADS)) {
    for (const period of ["day", "month"]) {
      const view = doc?.getElementById(`view-${period}`);
      if (view?.hasAttribute?.("data-dm-canonical-load-count")) continue;
      const node = doc?.getElementById(`n-${load}-${period}`);
      const valueNode = doc?.getElementById(`v-${load}-${period}`);
      if (node) {
        node.hidden = false;
        node.style.display = "";
        node.dataset.dmBeta5FlowComplete = "true";
      }
      if (valueNode) {
        const value = numericState(references[period]);
        if (value != null) valueNode.textContent = `${formatNumber(value, value < 10 ? 2 : 1)} kWh`;
        else if (!clean(valueNode.textContent)) valueNode.textContent = "—";
      }
    }
  }
  return true;
}

function energyModel() {
  try { return root.DashboardModernModules?.store?.getSection?.("energy") || {}; } catch (_error) { return {}; }
}

function resolved(reference) {
  const value = clean(reference);
  if (!value) return "";
  try { return clean(root.resolveEntity?.(value) || value); } catch (_error) { return value; }
}

function energyHistoryRefs() {
  const energy = energyModel();
  return Object.freeze({
    solar: resolved(energy.solar?.total_energy),
    house: resolved(energy.house?.total_energy),
    gridImport: resolved(energy.grid?.total_import_energy),
    gridExport: resolved(energy.grid?.total_export_energy),
    batteryCharged: resolved(energy.battery?.total_charged_energy),
    batteryDischarged: resolved(energy.battery?.total_discharged_energy),
  });
}

function bucketChanges(rows, days) {
  const result = Array.from({ length: days }, () => null);
  for (const row of Array.isArray(rows) ? rows : []) {
    const when = new Date(row?.start || row?.end || 0);
    const day = when.getDate();
    const change = Number(row?.change);
    if (!Number.isFinite(change) || day < 1 || day > days) continue;
    if (result[day - 1] == null) result[day - 1] = 0;
    result[day - 1] += Math.max(0, change);
  }
  return result;
}

function currentBundleDay() {
  const day = root.__DASHBOARDMODERN_RUNTIME_ROOT__?.bundle?.day || {};
  const read = (key, slot) => {
    const value = Number(day?.[key]);
    if (Number.isFinite(value)) return Math.max(0, value);
    return numericState(slot);
  };
  return {
    solar: read("solar", "dm.energy_produzione_solare_oggi"),
    house: read("house", "dm.energy_consumo_casa_oggi"),
    gridImport: read("gridImport", "dm.energy_energia_prelevata_oggi"),
    gridExport: read("gridExport", "dm.energy_energia_immessa_oggi"),
    batteryCharged: read("batteryCharged", "dm.energy_batteria_caricata_oggi"),
    batteryDischarged: read("batteryDischarged", "dm.energy_batteria_scaricata_oggi"),
  };
}

function balancedHouse(values, index, refs) {
  const solar = values.solar[index];
  const gridImport = refs.gridImport ? values.gridImport[index] : 0;
  const gridExport = refs.gridExport ? values.gridExport[index] : 0;
  const charged = refs.batteryCharged ? values.batteryCharged[index] : 0;
  const discharged = refs.batteryDischarged ? values.batteryDischarged[index] : 0;
  const hasCore = solar != null && (!refs.gridImport || gridImport != null) && (!refs.gridExport || gridExport != null);
  const hasBattery = (!refs.batteryCharged || charged != null) && (!refs.batteryDischarged || discharged != null);
  if (!hasCore || !hasBattery) return null;
  return Math.max(0, solar - (gridExport || 0) + (gridImport || 0) + (discharged || 0) - (charged || 0));
}

function chartMessage(message) {
  const loading = doc?.getElementById("ed-chart-loading");
  const canvas = doc?.getElementById("ed-daily-canvas");
  if (canvas) canvas.style.display = "none";
  if (loading) {
    loading.style.display = "flex";
    loading.innerHTML = `<span aria-hidden="true">ℹ️</span> ${message}`;
  }
}

function destroyDailyChart(canvas) {
  try { root.Chart?.getChart?.(canvas)?.destroy?.(); } catch (_error) {}
  try { state.dailyChart?.destroy?.(); } catch (_error) {}
  state.dailyChart = null;
}

async function renderRealDailyChart(daysInMonth, selMonth, selYear) {
  const loading = doc?.getElementById("ed-chart-loading");
  const canvas = doc?.getElementById("ed-daily-canvas");
  if (!loading || !canvas) return false;
  destroyDailyChart(canvas);
  loading.style.display = "flex";
  loading.textContent = t("Carico i dati reali di Home Assistant…", "Loading real Home Assistant data…");
  canvas.style.display = "none";

  const now = new Date();
  const year = Number(selYear) || now.getFullYear();
  const month = Math.max(1, Math.min(12, Number(selMonth) || now.getMonth() + 1));
  const currentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const monthDays = Number(daysInMonth) || new Date(year, month, 0).getDate();
  const visibleDays = currentMonth ? Math.min(now.getDate(), monthDays) : monthDays;
  const start = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  const end = currentMonth ? now : next;
  const refs = energyHistoryRefs();
  const ids = [...new Set(Object.values(refs).filter(Boolean))];
  const service = root.DashboardModernEnergyService;
  const values = Object.fromEntries(Object.keys(refs).map((key) => [key, Array.from({ length: visibleDays }, () => null)]));

  if (ids.length && typeof service?.statisticsWithGrowth === "function") {
    try {
      const stats = await service.statisticsWithGrowth(ids, start.toISOString(), end.toISOString(), "day");
      Object.entries(refs).forEach(([key, entity]) => {
        if (entity) values[key] = bucketChanges(stats?.[entity] || [], visibleDays);
      });
    } catch (error) {
      root.console?.warn?.("[DashboardModern] Recorder daily chart unavailable", error);
    }
  }

  const production = values.solar.slice();
  const consumption = values.house.slice();
  for (let index = 0; index < visibleDays; index += 1) {
    const balanced = balancedHouse(values, index, refs);
    if (balanced != null) consumption[index] = balanced;
  }

  // Recorder can omit the still-open current bucket. Fill only TODAY from the
  // already committed canonical bundle; never synthesize previous/future days.
  if (currentMonth && visibleDays > 0) {
    const today = currentBundleDay();
    const index = visibleDays - 1;
    if (today.solar != null) production[index] = today.solar;
    if (today.house != null) consumption[index] = today.house;
    if (today.solar != null && today.gridImport != null && today.gridExport != null) {
      consumption[index] = Math.max(
        0,
        today.solar - today.gridExport + today.gridImport + (today.batteryDischarged || 0) - (today.batteryCharged || 0),
      );
    }
  }

  const hasReal = production.some((value) => value != null) || consumption.some((value) => value != null);
  if (!hasReal) {
    chartMessage(t("Nessun dato giornaliero reale disponibile per questo periodo.", "No real daily data is available for this period."));
    return false;
  }
  if (!root.Chart) {
    chartMessage(t("Grafico non disponibile: Chart.js non è caricato.", "Chart unavailable: Chart.js is not loaded."));
    return false;
  }

  const labels = Array.from({ length: visibleDays }, (_, index) => String(index + 1));
  loading.style.display = "none";
  canvas.style.display = "block";
  canvas.dataset.dmBeta5RealHistory = `${year}-${String(month).padStart(2, "0")}`;
  canvas.dataset.dmBeta5LastDay = String(visibleDays);
  state.dailyChart = new root.Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: t("Produzione", "Production"), data: production, borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,.14)", fill: true, tension: .25, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2.5, spanGaps: false },
        { label: t("Consumo", "Consumption"), data: consumption, borderColor: "#0ea5e9", backgroundColor: "rgba(14,165,233,.08)", fill: true, tension: .25, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2.2, spanGaps: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y, 2)} kWh` } },
      },
      scales: { y: { beginAtZero: true, title: { display: true, text: "kWh" } }, x: { grid: { display: false } } },
    },
  });
  return true;
}
renderRealDailyChart.__dmActualHistory = true;
renderRealDailyChart.__dmBeta4CasaSolar = true;
renderRealDailyChart.__dmBeta5RealOnly = true;

function installRealDailyChartOwner() {
  const reportState = root.__DASHBOARDMODERN_ENERGY_REPORT_POLISH__;
  if (reportState) reportState.legacyDailyChart = null;
  if (root.renderEdDailyChart !== renderRealDailyChart) root.renderEdDailyChart = renderRealDailyChart;
  return true;
}

function run() {
  state.frame = 0;
  syncConfigTabIcons();
  normalizeSectionRenameButtons();
  polishCarBrandMarks();
  polishRoomFirstInsert();
  polishAlertsFirstInsert();
  polishLightsEditor();
  polishClimateCards();
  keepSecondaryEnergyFlowsComplete();
  installRealDailyChartOwner();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function installStyles() {
  installStyle("dm-beta5-root-causes-style", `
    /* Un telefono paga il vetro smerigliato anche quando non si vede.
     *
     * Sopra la Home stanno dodici finestre chiuse: meteo, clima, allarme,
     * carichi, lavatrice, auto, dettagli, tastierino, storico, conferma e i due
     * storici del server. Sono nascoste, ma restano larghe quanto lo schermo e
     * ognuna chiede al browser di sfocare tutto quello che ha dietro. Su un
     * computer non si nota; su un telefono sono dodici livelli a schermo intero
     * che la GPU tiene in memoria e ricompone a ogni scorrimento, e la stessa
     * cosa vale per la barra di navigazione mentre e' ritirata.
     *
     * Dentro due di quelle finestre girava anche una rotella di caricamento,
     * per sempre, senza che nessuno la stesse guardando.
     *
     * Lo sfondo sfocato torna appena la finestra si apre, ed e' l'unico momento
     * in cui qualcuno lo vede. */
    .modal-wrapper:not(.show),.modal-wrapper:not(.show) *,.clima-popup-overlay:not(.show),.clima-popup-overlay:not(.show) *,.hist-overlay:not(.show),.hist-overlay:not(.show) *,#srv-hist-overlay:not(.show),#srv-hist-overlay:not(.show) *,nav.tabs.bottom-nav-bar:not(.visible){backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    .modal-wrapper:not(.show) *,.clima-popup-overlay:not(.show) *,.hist-overlay:not(.show) *,#srv-hist-overlay:not(.show) *{animation-play-state:paused!important}
    /* Lo sfondo sfocato deve crescere insieme alla dissolvenza, non comparire
     * di colpo.
     *
     * Le finestre chiuse non tengono piu' il vetro smerigliato, e va bene:
     * nessuno lo guarda. Ma quando la finestra si apre il browser deve
     * costruire la sfocatura a schermo intero tutta nello stesso disegno, e su
     * quel disegno il telefono perde un fotogramma: e' il tremolio che si vede
     * all'apertura di ogni popup.
     *
     * Le altre finestre (clima, storico, storico del server) sfumano gia' ogni
     * proprieta' insieme, quindi il problema non ce l'hanno. Solo .modal-wrapper
     * elenca a mano cosa sfumare, e nell'elenco la sfocatura non c'era: qui la
     * aggiungiamo, con gli stessi 0.4s della dissolvenza. */
    .modal-wrapper{transition:visibility 0s .4s,opacity .4s ease,backdrop-filter .4s ease,-webkit-backdrop-filter .4s ease!important}
    .modal-wrapper.show{transition:opacity .4s ease,backdrop-filter .4s ease,-webkit-backdrop-filter .4s ease!important}
    /* E la stessa cosa vale per la barra in basso.
     *
     * Anche lei non tiene il vetro smerigliato mentre e' ritirata, e anche lei
     * elenca a mano cosa sfumare — movimento, posizione, opacita', ombra — con
     * la sfocatura fuori dall'elenco. Ricompare con un tocco, e in quel tocco la
     * sfocatura si accendeva di colpo: il tremolio si vedeva sulla barra come si
     * vedeva sulle finestre. Sale insieme alla dissolvenza, come la' . */
    nav.tabs.bottom-nav-bar{transition:transform .4s cubic-bezier(0.175,0.885,0.32,1.275),bottom .4s cubic-bezier(0.175,0.885,0.32,1.275),opacity .3s ease,box-shadow .4s ease,backdrop-filter .3s ease,-webkit-backdrop-filter .3s ease!important}
    .ed-tab[data-tab]>.dm-beta4-tab-icon{display:inline-grid!important;place-items:center!important;flex:0 0 auto!important;min-width:1.2em!important;margin-right:5px!important;visibility:visible!important;opacity:1!important}
    .ed-tab[data-tab]>.dm-beta4-tab-label{display:inline!important;white-space:nowrap!important}
    /* Telefono tenuto in piedi: della linguetta resta il simbolo.
     *
     * Le linguette della configurazione stanno in colonna, e su trecentonovanta
     * pixel una colonna che scrive anche i nomi si porta via un terzo dello
     * schermo per dire quello che il simbolo dice gia'. Il nome non sparisce
     * davvero: resta nel titolo del tasto — quindi anche per chi legge a voce —
     * e ricompare da solo appena il telefono si gira, perche' in orizzontale lo
     * schermo e' largo abbastanza e questa regola non vale piu'.
     *
     * Sta qui e non nel foglio della plancia perche' e' qui che quel pezzo di
     * linguetta nasce, e sono queste righe a imporgli di vedersi: nasconderlo
     * da un altro foglio vorrebbe dire due padroni sulla stessa decisione. */
    @media (orientation:portrait) and (max-width:640px){
      #editor-modal .ed-tab[data-tab]>.dm-beta4-tab-label{display:none!important}
      #editor-modal .ed-tab[data-tab]>.dm-beta4-tab-icon{margin-right:0!important;font-size:21px!important}
    }

    #ed-body .ed-row[data-section-key] .ed-row-main{display:grid!important;grid-template-columns:minmax(0,1fr) 44px!important;grid-template-rows:auto!important;align-items:center!important;gap:8px!important;min-width:0!important;padding-right:0!important;position:relative!important}
    #ed-body .ed-row[data-section-key] .ed-row-main>.ed-row-new{grid-column:1!important;grid-row:1!important;min-width:0!important}
    #ed-body .ed-row[data-section-key] .dm-inline-rename[data-dm-beta5-primary="true"]{grid-column:2!important;grid-row:1!important;position:static!important;inset:auto!important;transform:none!important;display:grid!important;place-items:center!important;width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;margin:0!important;padding:0!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 28%,var(--divider-color,#dbe4ee))!important;border-radius:13px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 10%,var(--card-background-color,#fff))!important;color:var(--text,#0f172a)!important;font-size:19px!important;line-height:1!important;box-shadow:none!important;overflow:visible!important}
    /* Only the copies outside the row's main cell are hidden while this module's
     * pass has not run yet. Hiding every unmarked button meant a row printed by
     * another owner after the pass — which happens whenever the tab is redrawn
     * — showed no rename at all until something scheduled another pass. The
     * pass still removes the copies; this rule only covers the window before
     * it. */
    #ed-body .ed-row[data-section-key] :not(.ed-row-main)>.dm-inline-rename[data-rename]:not([data-dm-beta5-primary="true"]){display:none!important}

    /* Il colore del marchio non lo decide questa riga.
     *
     * C'era un color:var(--info-color) con !important, e dipingeva OGNI logo
     * dello stesso azzurro: nato quando i marchi erano sagome monocrome da
     * rendere visibili, e diventato il motivo per cui la tinta d'istituto non
     * arrivava mai a schermo: un !important batte anche lo stile scritto
     * sull'elemento. Adesso il colore lo porta il marchio (Tesla rosso, BMW
     * blu, Renault giallo) e per le case il cui marchio e' nero decide il tema.
     * Qui restano la forma e il fondo, che erano l'altra meta' del lavoro. */
    /* Il «display» lo dichiara personalization-section, che il marchio lo
       disegna: qui c'era un «grid!important» che vinceva sul suo «inline-grid»,
       quindi la riga del padrone non si e' mai vista. Adesso il padrone dice
       «grid» — cioe' quello che si vedeva davvero — e qui resta soltanto lo
       sfondo, che e' la cosa per cui questo foglio esiste. */
    .dm-car-brand{place-items:center!important;background:transparent!important}
    .dm-beta5-brand-logo{display:grid!important;place-items:center!important;width:82px!important;height:54px!important;color:currentColor!important}
    .dm-beta5-brand-logo svg{display:block!important;width:78px!important;height:50px!important;max-width:100%!important;overflow:visible!important}
    /* Il riquadro del marchio e la sua pastiglia li misura beta9: le tre
       misure che stavano qui perdevano tutte, e restavano solo a far numero. */
    [data-brand-preview] .dm-beta5-brand-logo{width:86px!important;height:56px!important}

    /* Il quadratino grezzo dell'icona non si vede MAI: «non voglio vedere
     * doppie icone». Il campo resta nel documento — e' quello che i
     * salvataggi leggono e che il selettore dal catalogo compila — ma a
     * schermo c'e' solo il trigger che apre il catalogo, su ogni misura.
     * Prima si nascondeva solo da telefono, e da desktop uscivano due
     * icone affiancate. */
    #ed-body[data-dm-beta5-rooms="true"] .dm-beta5-room-add-row{display:grid!important;grid-template-columns:58px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;margin-bottom:10px!important}
    #ed-body[data-dm-beta5-rooms="true"] #ed-room-icon{display:none!important}
    #ed-body[data-dm-beta5-rooms="true"] #ed-room-icon-preview{display:none!important}
    /* I due campi devono riempire la loro colonna.
     *
     * La riga nasce dal runtime come una fila flex e i campi si allargavano con
     * il loro flex. Qui sopra la riga diventa una griglia, e in una griglia quel
     * flex non vale piu' niente: un campo di testo tiene la sua larghezza
     * naturale, che senza testo dentro e' zero. Restavano due quadratini larghi
     * quanto la loro cornice, con il resto della riga vuoto. La versione stretta
     * lo aveva gia' risolto per il nome; ora vale anche a schermo largo. */
    #ed-body[data-dm-beta5-rooms="true"] #ed-room-icon,#ed-body[data-dm-beta5-rooms="true"] #ed-room-name{box-sizing:border-box!important;width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta5-rooms="true"] .dm-beta5-room-icon-trigger{display:grid!important;place-items:center!important;width:58px!important;height:58px!important;min-width:58px!important;padding:0!important;border:1px solid color-mix(in srgb,var(--info-color,#0ea5e9) 24%,var(--divider-color,#dbe4ee))!important;border-radius:16px!important;background:color-mix(in srgb,var(--info-color,#0ea5e9) 8%,var(--card-background-color,#fff))!important;cursor:pointer!important;overflow:hidden!important}

    #ed-body[data-dm-beta5-alerts="true"]{display:grid!important;gap:14px!important}
    #ed-body[data-dm-beta5-alerts="true"] #ed-avv-custom[hidden],#ed-body[data-dm-beta5-alerts="true"] #ed-avv-custom[aria-hidden="true"]{display:none!important}
    #ed-body[data-dm-beta5-alerts="true"] #ed-avv-grp,#ed-body[data-dm-beta5-alerts="true"] #ed-avv-name,#ed-body[data-dm-beta5-alerts="true"] #ed-avv-cond,#ed-body[data-dm-beta5-alerts="true"] #ed-avv-val{box-sizing:border-box!important;width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta5-alerts="true"] .dm-beta5-alert-entity-row{display:grid!important;grid-template-columns:minmax(0,1fr) 52px!important;gap:8px!important;width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta5-alerts="true"] .dm-beta5-alert-entity-row>#ed-avv-ent{width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta5-alerts="true"] #ed-avv-custom{grid-template-columns:1fr!important;gap:10px!important;width:100%!important;min-width:0!important;margin-top:10px!important}
    #ed-body[data-dm-beta5-alerts="true"] #ed-avv-custom>.ed-btn-add{display:block!important;width:100%!important;min-height:48px!important;height:auto!important;margin:0!important;padding:12px 16px!important;white-space:normal!important;line-height:1.25!important}
    #ed-body[data-dm-beta5-alerts="true"] #ed-avv-ents{width:100%!important;min-width:0!important;margin:0!important;line-height:1.4!important}
    #ed-body[data-dm-beta5-alerts="true"] .dm-beta5-alert-icon-row{display:grid!important;grid-template-columns:minmax(0,1fr) 54px!important;gap:8px!important;width:100%!important;min-width:0!important}
    #ed-body[data-dm-beta5-alerts="true"] .dm-beta5-alert-icon-row>#ed-avv-icon{width:100%!important;min-width:0!important;margin:0!important}
    #ed-body[data-dm-beta5-alerts="true"] .dm-beta5-alert-icon-trigger{display:grid!important;place-items:center!important;width:54px!important;height:50px!important;min-width:54px!important;padding:0!important;border-radius:14px!important;box-shadow:none!important}

    #page-clima[data-dm-beta5-climate="canonical"] .clima-premium-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))!important;gap:16px!important;align-items:start!important}
    #page-clima[data-dm-beta5-climate="canonical"] .cp-card{box-sizing:border-box!important;aspect-ratio:auto!important;min-height:0!important;height:auto!important;max-height:none!important;justify-content:flex-start!important;padding:16px!important;gap:14px!important;overflow:hidden!important}
    #page-clima[data-dm-beta5-climate="canonical"] .cp-header{flex:0 0 auto!important}
    #page-clima[data-dm-beta5-climate="canonical"] .cp-body{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;align-items:end!important;gap:18px!important;flex:0 0 auto!important;min-height:0!important;padding:8px 4px!important;margin:0!important}
    #page-clima[data-dm-beta5-climate="canonical"] .cp-temp-current-wrap{align-items:flex-end!important;text-align:right!important}
    #page-clima[data-dm-beta5-climate="canonical"] .cp-controls{flex:0 0 auto!important;margin:0!important;min-height:54px!important;height:54px!important;padding:5px!important}
    #page-clima[data-dm-beta5-climate="canonical"] .cp-btn{height:42px!important}
    #page-clima[data-dm-beta5-climate="canonical"] .cp-temp-target .val{font-size:38px!important;line-height:1!important}

    #ed-daily-canvas[data-dm-beta5-real-history]{min-height:250px!important}

    @media(max-width:760px){
      #ed-body .ed-row[data-section-key] .ed-row-main{grid-template-columns:minmax(0,1fr) 42px!important}
      #ed-body .ed-row[data-section-key] .dm-inline-rename[data-dm-beta5-primary="true"]{width:42px!important;min-width:42px!important;height:42px!important;min-height:42px!important}

      #ed-body[data-dm-beta5-rooms="true"] .dm-beta5-room-add-row{grid-template-columns:56px minmax(0,1fr)!important;gap:9px!important}
      #ed-body[data-dm-beta5-rooms="true"] #ed-room-icon{display:none!important}
      #ed-body[data-dm-beta5-rooms="true"] #ed-room-name{grid-column:2!important;min-width:0!important;width:100%!important}

      #ed-body[data-dm-beta5-lights="true"] .dm-light-group>.ed-list{display:grid!important;gap:10px!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-row[data-dm-beta5-light-row="true"]{box-sizing:border-box!important;display:grid!important;grid-template-columns:minmax(0,1fr) 44px 44px!important;grid-template-areas:"main edit delete" "room room room"!important;grid-template-rows:auto auto!important;grid-auto-rows:auto!important;align-items:center!important;gap:8px!important;width:100%!important;min-width:0!important;min-height:0!important;height:auto!important;padding:12px!important;overflow:visible!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-row>.dm-light-order{display:none!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-row>[data-dm-light-main="true"]{grid-area:main!important;display:block!important;position:static!important;width:auto!important;min-width:0!important;min-height:48px!important;padding:3px 4px!important;visibility:visible!important;opacity:1!important;overflow:hidden!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-row>[data-dm-light-main="true"]>.ed-row-new{display:block!important;position:static!important;visibility:visible!important;opacity:1!important;font-size:15px!important;line-height:1.3!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-row>[data-dm-light-main="true"]>.ed-row-old{display:block!important;position:static!important;visibility:visible!important;opacity:1!important;margin-top:4px!important;font-size:11px!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-row>.dm-light-room{grid-area:room!important;grid-column:auto!important;grid-row:auto!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;height:48px!important;margin:0!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-row>.dm-light-edit{grid-area:edit!important;display:grid!important;place-items:center!important;position:static!important;width:44px!important;height:44px!important;margin:0!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-row>.dm-light-delete{grid-area:delete!important;display:grid!important;place-items:center!important;position:static!important;width:44px!important;height:44px!important;margin:0!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-light-add-form{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;width:100%!important;min-width:0!important}
      #ed-body[data-dm-beta5-lights="true"] .dm-beta5-light-entity-row{display:grid!important;grid-template-columns:minmax(0,1fr) 52px!important;gap:8px!important;width:100%!important;min-width:0!important}

      #page-clima[data-dm-beta5-climate="canonical"] .clima-premium-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
      #page-clima[data-dm-beta5-climate="canonical"] .cp-card{min-height:0!important;height:auto!important;max-height:none!important;padding:14px!important;gap:11px!important;border-radius:20px!important}
      #page-clima[data-dm-beta5-climate="canonical"] .cp-body{padding:6px 3px!important;gap:12px!important}
      #page-clima[data-dm-beta5-climate="canonical"] .cp-temp-target .val{font-size:34px!important}
      #page-clima[data-dm-beta5-climate="canonical"] .cp-controls{min-height:52px!important;height:52px!important}
      #page-clima[data-dm-beta5-climate="canonical"] .cp-btn{height:40px!important}
    }
  `);
}

export function installBeta4MobilePolishSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  const afterLegacy = () => {
    installRealDailyChartOwner();
    for (const name of [
      "editorSwitch",
      "edNavMove",
      "editorRenderStanze",
      "editorRenderLuci",
      "editorRenderAvvisi",
      "renderEnergyDashboard",
      "render",
      "buildClimaCards",
    ]) wrapFunction(name, `__dmBeta5_${name}`, schedule);
    schedule();
  };
  root.addEventListener?.("dashboardmodern:legacy-ready", afterLegacy);
  root.addEventListener?.("dashboardmodern:runtime-ready", () => { installRealDailyChartOwner(); schedule(); });
  root.addEventListener?.("dashboardmodern:period-bundle", schedule);
  root.addEventListener?.("dashboardmodern:energy-stable", schedule);
  if (!state.listeners) {
    state.listeners = true;
    doc.addEventListener("click", (event) => {
      if (event.target?.closest?.(".ed-tab,.dm-inline-rename,[data-brand-preview],.dm-picker-option,.ed-btn-add,.dm-entity-picker,.sub-tab-btn")) root.setTimeout?.(schedule, 0);
    }, true);
    doc.addEventListener("change", (event) => {
      if (event.target?.closest?.("#editor-modal,#ed-body,#dm-visual-picker,#page-energy")) root.setTimeout?.(schedule, 0);
    }, true);
  }
  installRealDailyChartOwner();
  schedule();
}

export const installBeta5RootCauseFixes = installBeta4MobilePolishSection;

installBeta4MobilePolishSection();
