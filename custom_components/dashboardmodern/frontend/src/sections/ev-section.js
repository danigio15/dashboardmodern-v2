import { carBrandVisual } from "../core/personalization-catalog.js";
import { allStates, clean, doc, esc, installStyle, readJson, root, section, t, wrapFunction } from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_EV_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  lastUrl: "",
  frame: 0,
  previousRefresh: null,
  previousApply: null,
  legacyRefreshSignature: "",
  selectorSignature: "",
});
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;
/* Paths Home Assistant already serves; anything else absolute lives under /local. */
const HA_ROOTS = ["/local/", "/api/", "/media/", "/hacsfiles/", "/static/", "/frontend_latest/", "/auth/"];

function integrationAssetRoot(base) {
  try {
    const url = new URL(base);
    const match = url.pathname.match(/^(.*\/api\/dashboardmodern\/[^/]+\/)/);
    return match ? `${url.origin}${match[1]}` : "";
  } catch (_error) { return ""; }
}

export function resolveVehicleAsset(value, base = doc?.baseURI || root.location?.href || "") {
  let raw = typeof value === "string" ? value : value?.url || value?.path || "";
  raw = clean(raw).replaceAll("\\", "/");
  if (!raw) return "";
  if (/^(?:data:|blob:|https?:)/i.test(raw)) return raw;
  if (/^(?:file:|[a-z]:\/)/i.test(raw)) return "";
  if (raw.startsWith("/loca/")) raw = `/local/${raw.slice(6)}`;
  else if (raw.startsWith("loca/")) raw = `/local/${raw.slice(5)}`;
  else if (raw.startsWith("/config/www/")) raw = `/local/${raw.slice(12)}`;
  else if (raw.startsWith("config/www/")) raw = `/local/${raw.slice(11)}`;
  else if (raw.startsWith("www/")) raw = `/local/${raw.slice(4)}`;
  else if (raw.startsWith("local/")) raw = `/${raw}`;
  const prefixes = ["/config/custom_components/dashboardmodern/frontend/","config/custom_components/dashboardmodern/frontend/","/custom_components/dashboardmodern/frontend/","custom_components/dashboardmodern/frontend/"];
  const prefix = prefixes.find((candidate) => raw.startsWith(candidate));
  if (prefix) {
    const assetRoot = integrationAssetRoot(base);
    return assetRoot ? new URL(raw.slice(prefix.length), assetRoot).href : "";
  }
  if (raw.startsWith("/")) {
    const absolute = raw.replace(/^\/local\/\/+/, "/local/");
    // Home Assistant serves /config/www as /local. A bare absolute path like
    // "/ev/idle.png" is a www file missing that prefix, and 404s without it.
    return HA_ROOTS.some((prefix) => absolute.startsWith(prefix)) ? absolute : `/local${absolute}`;
  }
  try { return new URL(raw.replace(/^\.\//, ""), base).href; } catch (_error) { return ""; }
}

/* The two photos of the car.
 *
 * `cd_ev_image` has always been the car as it sits there, cable unplugged.
 * `cd_ev_image_plugged` is the same car with the cable in — the picture worth
 * looking at while it charges. Only the first is required: with no second photo
 * configured the hero simply keeps showing the first one, which is exactly what
 * every existing configuration does today. */
export const EV_PHOTO_KEYS = Object.freeze({ idle: "cd_ev_image", plugged: "cd_ev_image_plugged" });

function storedPhoto(key) {
  const stored = root.localStorage?.getItem(key) || "";
  try { const parsed = JSON.parse(stored); return typeof parsed === "string" ? parsed : parsed?.url || parsed?.path || ""; }
  catch (_error) { return stored.replace(/^"|"$/g, ""); }
}

export function configuredPhotos() {
  return { idle: storedPhoto(EV_PHOTO_KEYS.idle), plugged: storedPhoto(EV_PHOTO_KEYS.plugged) };
}

function liveState(reference) {
  const id = clean(reference); if (!id) return null;
  let resolved = id;
  try { resolved = clean(root.resolveEntity?.(id)) || id; } catch (_error) {}
  const states = allStates();
  return states[resolved] || states[id] || null;
}

/* What a wallbox says when the cable is out. The negatives are read first and
 * the two that contain a positive inside them — "disconnected" contains
 * "connected", "scollegato" contains "collegato" — are what make the order
 * matter. */
const UNPLUGGED_WORDS = /(disconnect|scollegat|staccat|unplug|not[_ ]?connected|no[_ ]?vehicle)/i;
const UNPLUGGED_STATES = /^(off|idle|unknown|unavailable|none|available|free|libero|nessuno|standby|ready)$/i;
const PLUGGED_WORDS = /(charg|ricaric|in carica|connect|collegat|plug|attacc|occupied|preparing|suspended)/i;

/** Is the cable in? Read from the wallbox the configuration already maps. */
export function vehiclePlugged() {
  const status = clean(liveState("dm.ev_stato_ricarica")?.state);
  if (status) {
    if (UNPLUGGED_STATES.test(status) || UNPLUGGED_WORDS.test(status)) return false;
    if (PLUGGED_WORDS.test(status)) return true;
  }
  // No usable text: a wallbox drawing power has a cable in it.
  for (const reference of ["dm.ev_potenza_wallbox", "dm.ev_charge_power"]) {
    const power = Number(liveState(reference)?.state);
    if (Number.isFinite(power) && power > 10) return true;
  }
  return false;
}

/** The photo the hero should be showing right now. */
export function activeVehiclePhoto(photos = configuredPhotos(), plugged = vehiclePlugged()) {
  const chosen = plugged ? photos.plugged || photos.idle : photos.idle || photos.plugged;
  return clean(chosen);
}

export function applyVehicleAsset() {
  if (!doc) return false;
  const photos = configuredPhotos();
  const plugged = vehiclePlugged();
  const original = activeVehiclePhoto(photos, plugged);
  const url = resolveVehicleAsset(original);
  /* La correzione torna solo dov'era il valore corretto.
   *
   * Un percorso scritto a mano puo' arrivare storto — "/loca/..." invece di
   * "/local/...", o il percorso su disco invece di quello che il browser sa
   * servire — e riscriverlo nella sua forma buona evita di ripetere la
   * correzione a ogni disegno. La chiave in cui finiva pero' la sceglieva il
   * cavo: con la sola foto "col cavo" impostata e il cavo staccato, la foto
   * attiva veniva da quella chiave ma veniva riscritta in quella "senza cavo".
   * Da li' le due foto diventavano la stessa, da sole, poco dopo averle
   * inserite — e con due profili la stessa coppia finiva su entrambe le auto.
   *
   * La correzione va adesso nelle caselle che quel valore lo contengono
   * davvero, e in nessun'altra: una foto non puo' piu' passare da una casella
   * all'altra da sola. */
  if (url && clean(original) && clean(original) !== url) {
    for (const [name, key] of Object.entries(EV_PHOTO_KEYS)) {
      if (clean(photos[name]) !== clean(original)) continue;
      root.localStorage?.setItem(key, JSON.stringify(url));
    }
  }
  state.lastUrl = url;
  let mounted = false;
  for (const id of ["ev-mod-car-img", "ev-new-car-img"]) {
    const image = doc.getElementById(id); if (!image) continue;
    if (!url) { image.removeAttribute("src"); image.style.display = "none"; continue; }
    image.onerror = () => { image.dataset.evImageError = url; image.style.display = "none"; };
    image.onload = () => { delete image.dataset.evImageError; delete image.dataset.evFailed; image.style.display = "block"; image.style.visibility = "visible"; image.style.opacity = "1"; };
    const resolved = new URL(url, doc.baseURI).href;
    if (image.src !== resolved || image.dataset.evFailed === "1") { delete image.dataset.evFailed; delete image.dataset.evImageError; image.src = url; }
    image.dataset.evPhoto = plugged ? "plugged" : "idle";
    image.style.display = "block"; mounted = true;
  }
  const hero = doc.getElementById("lm-hero-card");
  if (hero) {
    hero.dataset.evImage = url ? "configured" : "missing";
    hero.dataset.evCable = plugged ? "plugged" : "unplugged";
  }
  return mounted;
}

/* ── the two photos, in the configuration ──────────────────────────────── */

/* The vendored EV form has one field for one photo. It stays in the document —
 * it is what a very old build reads — but it is folded away and this panel
 * takes over the row, because there are two photos now and they are easier to
 * get right side by side, each with the picture it points at underneath. */
function evEditorBody() {
  const body = doc?.getElementById("ed-body");
  if (!body) return null;
  const active = clean(doc.querySelector(".ed-tab.active")?.dataset?.tab);
  if (active !== "sez2") return null;
  return [...body.querySelectorAll(".ed-acc-body")].find((node) =>
    node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
  ) || null;
}

function legacyPhotoRow(body) {
  return [...body.querySelectorAll(".ed-slot")].find((slot) =>
    /immagine auto|car image/i.test(clean(slot.querySelector(".ed-slot-lbl")?.textContent)),
  ) || null;
}

function photoFieldMarkup(kind, label, hint, value) {
  return `<label class="dm-ev-photo" data-ev-photo="${kind}">
    <span class="dm-ev-photo-lbl">${esc(label)}</span>
    <span class="dm-ev-photo-row"><input class="ed-input mono" data-ev-photo-input value="${esc(value)}" placeholder="/local/auto-${kind}.png" autocomplete="off" spellcheck="false"></span>
    <small class="dm-ev-photo-hint">${esc(hint)}</small>
    <span class="dm-ev-photo-preview" data-ev-photo-preview></span>
  </label>`;
}

function paintPhotoPreview(field) {
  const preview = field.querySelector("[data-ev-photo-preview]");
  const value = clean(field.querySelector("[data-ev-photo-input]")?.value);
  const url = resolveVehicleAsset(value);
  if (!preview) return;
  if (!url) { preview.replaceChildren(); field.dataset.evPhotoState = "empty"; return; }
  let image = preview.querySelector("img");
  if (!image) { image = doc.createElement("img"); image.alt = ""; image.decoding = "async"; preview.replaceChildren(image); }
  image.onload = () => { field.dataset.evPhotoState = "ok"; };
  image.onerror = () => { field.dataset.evPhotoState = "broken"; };
  if (image.getAttribute("src") !== url) { field.dataset.evPhotoState = "loading"; image.src = url; }
}

function savePhotos(panelNode) {
  for (const field of panelNode.querySelectorAll("[data-ev-photo]")) {
    const kind = field.dataset.evPhoto === "plugged" ? "plugged" : "idle";
    const value = clean(field.querySelector("[data-ev-photo-input]")?.value);
    const stored = value ? resolveVehicleAsset(value) || value : "";
    root.localStorage?.setItem(EV_PHOTO_KEYS[kind], JSON.stringify(stored));
    // Written: what is on screen and what is stored say the same thing again.
    delete field.dataset.evPhotoEdited;
  }
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
  applyVehicleAsset();
}

export function ensureVehiclePhotoEditor() {
  const body = evEditorBody();
  if (!body) return false;
  const legacyRow = legacyPhotoRow(body);
  legacyRow?.setAttribute("hidden", "hidden");
  let panelNode = body.querySelector(":scope > [data-ev-photos]");
  const photos = configuredPhotos();
  if (!panelNode) {
    panelNode = doc.createElement("section");
    panelNode.className = "ed-form dm-ev-photos";
    panelNode.dataset.evPhotos = "true";
    panelNode.innerHTML = `<div class="ed-sec-title">📸 ${t("Foto dell'auto", "Vehicle photos")}</div>
      <div class="ed-intro">${t(
        "Due scatti della stessa auto: la plancia mostra quello con il cavo attaccato mentre è in ricarica e l'altro nel resto del tempo. Basta la prima: senza la seconda resta sempre quella.",
        "Two shots of the same car: the dashboard shows the plugged-in one while it charges and the other one the rest of the time. The first is enough — without the second it simply stays.",
      )}</div>
      <div class="dm-ev-photo-grid">
        ${photoFieldMarkup("idle", t("Cavo staccato", "Cable unplugged"), t("Percorso sotto /local, es. /local/auto.png", "Path under /local, e.g. /local/car.png"), photos.idle)}
        ${photoFieldMarkup("plugged", t("Cavo attaccato", "Cable plugged in"), t("Facoltativa: mostrata durante la ricarica", "Optional: shown while charging"), photos.plugged)}
      </div>
      <button type="button" class="ed-save-btn" data-ev-photos-save>💾 ${t("Salva foto", "Save photos")}</button>`;
    (legacyRow || body.lastElementChild)?.insertAdjacentElement?.("beforebegin", panelNode) ||
      body.append(panelNode);
    panelNode.addEventListener("input", (event) => {
      const field = event.target?.closest?.("[data-ev-photo]");
      if (!field) return;
      // Typed and not saved yet: from here on this field belongs to the person
      // at the keyboard, and no later pass writes over it.
      field.dataset.evPhotoEdited = "true";
      paintPhotoPreview(field);
    });
    panelNode.querySelector("[data-ev-photos-save]").addEventListener("click", () => {
      savePhotos(panelNode);
      panelNode.dataset.saved = "true";
    });
  } else {
    for (const field of panelNode.querySelectorAll("[data-ev-photo]")) {
      const input = field.querySelector("[data-ev-photo-input]");
      if (!input || input === doc.activeElement) continue;
      // A path typed into the other field and not yet saved must survive this:
      // moving from the first photo to the second used to blank the first,
      // because the panel is refreshed while the tab settles.
      if (field.dataset.evPhotoEdited === "true") continue;
      input.value = photos[field.dataset.evPhoto] || "";
    }
  }
  for (const field of panelNode.querySelectorAll("[data-ev-photo]")) paintPhotoPreview(field);
  return true;
}

function legacyProfiles() { const cars = readJson("cd_ev_cars", []); return Array.isArray(cars) ? cars : []; }
function canonicalProfiles() { const cars = section("ev", []); return Array.isArray(cars) ? cars : []; }
function profiles() { const legacy = legacyProfiles(); return legacy.length ? legacy : canonicalProfiles(); }
function collectEntityIds(value, output, depth = 0) {
  if (depth > 10 || value == null) return;
  if (typeof value === "string") { const id = clean(value); if (ENTITY_ID.test(id)) output.add(id); return; }
  if (Array.isArray(value)) { value.forEach((entry) => collectEntityIds(entry, output, depth + 1)); return; }
  if (typeof value === "object") Object.values(value).forEach((entry) => collectEntityIds(entry, output, depth + 1));
}
function eventEntityIds(event) { const values = event?.detail?.entity_ids || [event?.detail?.entity_id]; return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean)); }
function configuredEvEntityIds() { const ids = new Set(); collectEntityIds(legacyProfiles(), ids); collectEntityIds(canonicalProfiles(), ids); return ids; }
export function stateChangeAffectsEv(event) {
  const changed = eventEntityIds(event); if (!changed.size) return false;
  const configured = configuredEvEntityIds(); if (!configured.size) return false;
  return [...changed].some((id) => configured.has(id));
}

function activeIndex() { const index = Number.parseInt(root.localStorage?.getItem("cd_ev_car_active") || "-1", 10); return Number.isFinite(index) ? index : -1; }
function profileMeta(car = {}) {
  const overrides = car.ov || car.overrides || {};
  const batteryEntity = overrides["dm.ev_batteria_auto"] || overrides["dm.ev_battery"] || overrides["dm.ev_soc"] || car.battery_entity || car.soc_entity || "";
  const current = batteryEntity && (root.STATES?.[batteryEntity] || root._RAW_STATES?.[batteryEntity]);
  const value = Number(current?.state);
  return Number.isFinite(value) ? `${Math.round(value)}%` : t("Profilo EV", "EV profile");
}
function vehicleProfileVisual(car = {}) {
  const brand = clean(car.brand); if (brand) return carBrandVisual(brand, 28);
  const icon = clean(car.icon || "mdi:car-electric");
  try { return root.cdIconMarkup?.(icon, 26) || "🚗"; } catch (_error) { return "🚗"; }
}
function nativeHost() { return doc?.getElementById("ev-car-picker") || null; }
function nativeSelect() { return doc?.getElementById("ev-car-sel") || nativeHost()?.querySelector("select") || null; }
function chooseProfile(index) {
  const select = nativeSelect(); if (select) select.value = String(index);
  if (typeof root.cdEvApplyCar === "function") root.cdEvApplyCar(index);
  else if (select) { select.dispatchEvent(new Event("input", { bubbles:true })); select.dispatchEvent(new Event("change", { bubbles:true })); }
  else root.localStorage?.setItem("cd_ev_car_active", String(index));
  root.queueMicrotask?.(scheduleEvSync);
}

function selectorStructureSignature(cars) {
  return cars.map((car,index)=>[index,clean(car.name),clean(car.brand),clean(car.icon)].join("~")).join("|");
}
function bindProfileNav(nav) {
  if (nav.dataset.dmEvBound === "true") return;
  nav.dataset.dmEvBound = "true";
  nav.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".dm-vehicle-profile-card[data-vehicle-index]");
    if (!button || !nav.contains(button)) return;
    const index = Number.parseInt(button.dataset.vehicleIndex, 10); if (Number.isFinite(index)) chooseProfile(index);
  });
}
function buildProfileButtons(nav, cars) {
  nav.innerHTML = cars.map((car,index)=>`<button type="button" class="dm-vehicle-profile-card" data-vehicle-index="${index}"><span class="dm-vehicle-profile-icon">${vehicleProfileVisual(car)}</span><span class="dm-vehicle-profile-copy"><strong>${esc(car.name || `${t("Auto","Vehicle")} ${index+1}`)}</strong><small></small></span><span class="dm-vehicle-profile-check" aria-hidden="true"></span></button>`).join("");
  bindProfileNav(nav);
}

export function renderVehicleSelector() {
  const host = nativeHost(), cars = profiles(); if (!host) return false;
  host.classList.add("dm-vehicle-profile-host");
  const select = nativeSelect(); if (select) { select.classList.add("dm-vehicle-native-select"); select.setAttribute("aria-hidden","true"); select.tabIndex=-1; }
  let nav = host.querySelector(".dm-vehicle-profile-tabs");
  if (!nav) { nav=doc.createElement("nav"); nav.className="dm-vehicle-profile-tabs"; nav.setAttribute("aria-label",t("Seleziona auto","Select vehicle")); host.append(nav); bindProfileNav(nav); }
  if (!cars.length) {
    if (nav.childElementCount) nav.replaceChildren();
    host.dataset.profileCount="0"; host.style.display="none"; state.selectorSignature=""; return false;
  }
  host.style.display=""; host.dataset.profileCount=String(cars.length);
  const structure = selectorStructureSignature(cars);
  if (state.selectorSignature !== structure || nav.children.length !== cars.length) { buildProfileButtons(nav,cars); state.selectorSignature=structure; }
  const selected = Math.max(0,Math.min(cars.length-1,activeIndex()));
  nav.querySelectorAll(".dm-vehicle-profile-card").forEach((button,index)=>{
    const active=index===selected; button.classList.toggle("active",active); button.setAttribute("aria-pressed",String(active));
    const small=button.querySelector("small"), check=button.querySelector(".dm-vehicle-profile-check");
    const meta=profileMeta(cars[index]); if (small && small.textContent!==meta) small.textContent=meta;
    if (check) check.textContent=active?"✓":"";
  });
  return true;
}

/* Two cars, two pairs of photos.
 *
 * A car profile carries that car's entity map and one picture: the runtime
 * captures `cd_ev_image` into `profile.img` and writes it back when the car is
 * picked. The second photo — the same car with the cable in — is this module's
 * and was never part of the profile, so both cars shared it. And a profile
 * saved before its picture was chosen carries an empty `img`, which picking
 * that car then wrote over the photo the other car had just set: with two cars
 * configured both pictures disappeared from the dashboard, while the editor,
 * reading the field and not the store, still previewed them.
 *
 * A profile now carries both photos, and picking a car never clears a photo the
 * profile does not have — it keeps what was showing, which is what a single-car
 * configuration has always done.
 */
function storePhoto(key, url) {
  const next=clean(url);
  if (clean(storedPhoto(key)) === next) return;
  root.localStorage?.setItem(key, JSON.stringify(next));
}

function restoreProfilePhotos(car, before) {
  storePhoto(EV_PHOTO_KEYS.idle, clean(car?.img) || before.idle);
  storePhoto(EV_PHOTO_KEYS.plugged, clean(car?.imgPlugged) || before.plugged);
}

function legacyRefreshSignature() {
  const cars=legacyProfiles(); return `${activeIndex()}|${cars.map((car)=>`${clean(car.name)}:${clean(car.brand)}:${clean(car.icon)}`).join("|")}`;
}
function installLegacyWrappers() {
  if (typeof root.cdEvCarsRefresh === "function" && !root.cdEvCarsRefresh.__dmEvSection) {
    state.previousRefresh ||= root.cdEvCarsRefresh; const previous=root.cdEvCarsRefresh;
    function refreshProfiles(...args) {
      const signature=legacyRefreshSignature();
      if (signature===state.legacyRefreshSignature) return undefined;
      state.legacyRefreshSignature=signature; const result=previous.apply(this,args); root.queueMicrotask?.(scheduleEvSync); return result;
    }
    refreshProfiles.__dmEvSection=true; refreshProfiles.__dmPrevious=previous; root.cdEvCarsRefresh=refreshProfiles;
  }
  if (typeof root.cdEvApplyCar === "function" && !root.cdEvApplyCar.__dmEvSection) {
    state.previousApply ||= root.cdEvApplyCar; const previous=root.cdEvApplyCar;
    function applyProfile(index, ...rest) {
      const before=configuredPhotos();
      const car=legacyProfiles()[Number(index)] || {};
      const result=previous.call(this,index,...rest);
      restoreProfilePhotos(car, before);
      state.legacyRefreshSignature=""; root.queueMicrotask?.(scheduleEvSync); return result;
    }
    applyProfile.__dmEvSection=true; applyProfile.__dmPrevious=previous; root.cdEvApplyCar=applyProfile;
  }
  if (typeof root.cdEvCaptureProfile === "function" && !root.cdEvCaptureProfile.__dmEvSection) {
    const previous=root.cdEvCaptureProfile;
    function captureProfile(...args) {
      const profile=previous.apply(this,args) || {};
      const photos=configuredPhotos();
      // The runtime reads the first photo through its own config helper, which
      // returns "" for a value this module wrote as JSON. Both are read here.
      if (!clean(profile.img)) profile.img=photos.idle;
      profile.imgPlugged=photos.plugged;
      return profile;
    }
    captureProfile.__dmEvSection=true; captureProfile.__dmPrevious=previous; root.cdEvCaptureProfile=captureProfile;
  }
  return Boolean(root.cdEvCarsRefresh || root.cdEvApplyCar);
}

/* The EV tab of the configuration is printed over a few frames: the accordion
 * that holds the vehicle's fields — and the single legacy photo row this panel
 * replaces — arrives after the tab has switched. One pass at switch time would
 * find no accordion, leave the panel out of the tab and the old row on screen,
 * which is what a run that never clicked the tab by hand showed. */
export function scheduleEvSyncSettled() {
  scheduleEvSync();
  for (const delay of [120, 420, 900, 1800]) root.setTimeout?.(scheduleEvSync, delay);
}

export function scheduleEvSync() {
  if (state.frame) return;
  const run=()=>{state.frame=0;installLegacyWrappers();renderVehicleSelector();applyVehicleAsset();ensureVehiclePhotoEditor();};
  state.frame=root.requestAnimationFrame?.(run)||root.setTimeout?.(run,0)||0;
}

function installStyles() {
  installStyle("dm-ev-photos-style",`
.dm-ev-photos .dm-ev-photo-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:12px!important}
.dm-ev-photos .dm-ev-photo{display:grid!important;gap:6px!important;margin:0!important;padding:11px 12px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--card-background-color,#fff)!important}
.dm-ev-photos .dm-ev-photo[data-ev-photo-state="ok"]{border-color:color-mix(in srgb,#16a34a 32%,var(--divider-color,#dbe4ee))!important}
.dm-ev-photos .dm-ev-photo[data-ev-photo-state="broken"]{border-color:color-mix(in srgb,#dc2626 38%,var(--divider-color,#dbe4ee))!important}
.dm-ev-photos .dm-ev-photo-lbl{font-size:13px!important;font-weight:800!important;color:var(--text,#0f172a)!important}
.dm-ev-photos .dm-ev-photo-row{display:flex!important;gap:8px!important;min-width:0!important}
.dm-ev-photos .dm-ev-photo-row>input{flex:1 1 auto!important;min-width:0!important}
.dm-ev-photos .dm-ev-photo-hint{color:var(--secondary-text-color,#64748b)!important;font-size:11px!important;font-weight:650!important}
.dm-ev-photos .dm-ev-photo-preview{display:block!important;min-height:0!important}
.dm-ev-photos .dm-ev-photo-preview img{display:block!important;width:100%!important;max-height:112px!important;object-fit:contain!important;border-radius:11px!important;background:var(--secondary-background-color,#f6f8fb)!important}
.dm-ev-photos .dm-ev-photo[data-ev-photo-state="broken"] .dm-ev-photo-preview img{display:none!important}
.dm-ev-photos .dm-ev-photo[data-ev-photo-state="broken"] .dm-ev-photo-preview::after{content:"⚠️";display:block;text-align:center;font-size:20px}
/* The single legacy photo field this panel replaces is marked hidden when the
 * panel goes in. The editor's own layout pins .ed-slot to display:grid, which
 * outweighs the browser's meaning of the attribute and left the old field on
 * screen under the two new ones. */
#ed-body#ed-body .ed-slot[hidden]{display:none!important}
  `);
  installStyle("dm-ev-section-style",`
#ev-mod-car-img[data-ev-image-error],#ev-new-car-img[data-ev-image-error],#ev-mod-car-img[data-ev-failed="1"],#ev-new-car-img[data-ev-failed="1"]{display:none!important}
#ev-car-picker.dm-vehicle-profile-host{box-sizing:border-box!important;width:fit-content!important;max-width:calc(100% - 28px)!important;margin:12px auto 10px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}#ev-car-picker.dm-vehicle-profile-host>.dm-vehicle-native-select{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important}
.dm-vehicle-profile-tabs{display:flex!important;align-items:stretch!important;justify-content:center!important;flex-wrap:wrap!important;gap:8px!important;width:auto!important;max-width:100%!important}.dm-vehicle-profile-card{display:grid!important;grid-template-columns:58px minmax(0,max-content) 20px!important;align-items:start!important;gap:8px!important;box-sizing:border-box!important;width:max-content!important;max-width:min(100%,340px)!important;min-height:54px!important;margin:0!important;padding:8px 9px!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;border-radius:15px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--text,#0f172a)!important;box-shadow:0 6px 16px rgba(15,23,42,.07)!important;text-align:left!important;cursor:pointer!important;transition:border-color .12s ease,box-shadow .12s ease!important}.dm-vehicle-profile-card.active{border-color:var(--accent,#0ea5e9)!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 10%,var(--ha-card-background,#fff))!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent,#0ea5e9) 18%,transparent),0 8px 20px rgba(14,165,233,.13)!important}
.dm-vehicle-profile-icon{display:grid!important;place-items:start center!important;align-self:start!important;width:58px!important;height:34px!important;min-width:58px!important;overflow:hidden!important;border-radius:10px!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 10%,transparent)!important}.dm-vehicle-profile-icon .dm-car-brand{display:grid!important;place-items:center!important;width:54px!important;max-width:54px!important;height:28px!important;margin:2px auto 0!important}.dm-vehicle-profile-icon .dm-car-brand img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}.dm-vehicle-profile-icon ha-icon{margin:3px auto 0!important}.dm-vehicle-profile-copy{display:grid!important;gap:2px!important;min-width:0!important;padding-top:1px!important}.dm-vehicle-profile-copy strong,.dm-vehicle-profile-copy small{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-vehicle-profile-copy strong{max-width:210px!important;font-size:13px!important;font-weight:900!important;line-height:1.1!important}.dm-vehicle-profile-copy small{font-size:9px!important;font-weight:750!important;line-height:1.1!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}.dm-vehicle-profile-check{display:grid!important;place-items:center!important;width:20px!important;height:20px!important;border-radius:50%!important;background:var(--accent,#0ea5e9)!important;color:#fff!important;font-size:11px!important;font-weight:900!important;opacity:0!important}.dm-vehicle-profile-card.active .dm-vehicle-profile-check{opacity:1!important}
.dm-ev-brand-badge .dm-car-brand{display:grid!important;place-items:center!important;max-width:105px!important;height:34px!important}.dm-ev-brand-badge .dm-car-brand img{width:100%!important;height:100%!important;object-fit:contain!important}
@media(max-width:620px){#ev-car-picker.dm-vehicle-profile-host{width:auto!important;max-width:calc(100% - 20px)!important;margin:8px auto!important}.dm-vehicle-profile-tabs{justify-content:flex-start!important;flex-wrap:nowrap!important;gap:7px!important;max-width:calc(100vw - 20px)!important;overflow-x:auto!important;padding:2px 2px 5px!important;scrollbar-width:none!important}.dm-vehicle-profile-tabs::-webkit-scrollbar{display:none!important}.dm-vehicle-profile-card{flex:0 0 auto!important;max-width:76vw!important;min-height:50px!important;padding:7px 8px!important;grid-template-columns:52px minmax(0,max-content) 18px!important;gap:7px!important}.dm-vehicle-profile-icon{width:52px!important;min-width:52px!important;height:32px!important}.dm-vehicle-profile-icon .dm-car-brand{width:48px!important;max-width:48px!important;height:25px!important}.dm-vehicle-profile-copy strong{max-width:44vw!important;font-size:12px!important}.dm-vehicle-profile-copy small{font-size:8.5px!important}.dm-vehicle-profile-check{width:18px!important;height:18px!important;font-size:10px!important}}
  `);
}

function bindEditorEntryPoints() {
  wrapFunction("editorSwitch", "__dmEvSection_editorSwitch", scheduleEvSyncSettled);
  wrapFunction("apriConfigEntita", "__dmEvSection_apriConfigEntita", scheduleEvSyncSettled);
}

export function installEvSection() {
  if (!doc) return;
  root.dmRenderVehicleSelector=renderVehicleSelector; installStyles(); installLegacyWrappers(); bindEditorEntryPoints(); scheduleEvSync();
  if (!state.installed) {
    state.installed=true;
    doc.addEventListener("click",(event)=>{if(event.target?.closest?.('[data-tab="ev"],[data-page="ev"],.ed-tab[data-tab="sez2"],.ed-acc-head'))root.setTimeout?.(scheduleEvSync,0);},true);
    for (const eventName of ["dashboardmodern:legacy-ready","dashboardmodern:runtime-ready","pageshow"]) root.addEventListener?.(eventName,()=>{scheduleEvSyncSettled();bindEditorEntryPoints();});
    root.addEventListener?.("dashboardmodern:state-changed",(event)=>{ if (stateChangeAffectsEv(event)) scheduleEvSync(); });
  }
}
if(doc?.readyState==="loading")doc.addEventListener("DOMContentLoaded",installEvSection,{once:true});else installEvSection();
