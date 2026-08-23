import { carBrandVisual } from "../core/personalization-catalog.js";
import { carKey, restoreCarIdentities } from "../core/vehicle-identity.js";
import { adoptLoosePhotos, photosForProfile, withProfilePhotos } from "../core/vehicle-photos.js";
import { pickMediaImage } from "./media-picker-section.js";
import { allStates, clean, dashboardStore, doc, esc, installStyle, onEditorRedraw, readJson, root, section, t, wrapFunction, writeJsonIfChanged } from "./shared.js";

globalThis.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_EV_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  lastUrl: "",
  frame: 0,
  previousRefresh: null,
  previousApply: null,
  legacyRefreshSignature: "",
  // L'ultimo verdetto valido su "il cavo e' attaccato": un wallbox vero perde
  // la connessione un istante e torna, e in quell'istante ne' il testo di
  // stato ne' la potenza dicono niente di utilizzabile. Senza questo, ogni
  // sparizione veniva letta come "cavo staccato" e la foto tornava a quella
  // di riposo per poi ricambiare al giro successivo -- la stessa auto, ferma,
  // con la fotografia che va avanti e indietro da sola.
  lastPlugged: false,
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
const UNPLUGGED_STATES = /^(off|idle|none|available|free|libero|nessuno|standby|ready)$/i;
const PLUGGED_WORDS = /(charg|ricaric|in carica|connect|collegat|plug|attacc|occupied|preparing|suspended)/i;
/* "unknown"/"unavailable" sono il modo in cui Home Assistant dice "questa
 * entita' in questo momento non risponde", non un modo in cui un wallbox
 * dice "il cavo e' fuori": erano nella lista sopra insieme a "off" e
 * "standby", e un sensore che sparisce un istante durante una riconnessione
 * WiFi — capita spesso, e capita anche con l'auto attaccata e in carica —
 * veniva letto come cavo staccato tanto quanto uno davvero spento. Qui non
 * si decide niente: si passa oltre, alla potenza o a quello che si sapeva
 * prima. */
const HA_SILENT_STATES = /^(unknown|unavailable)$/i;

/* Un verdetto, non tre.
 *
 * Sotto ci sono due fonti — il testo dello stato, la potenza letta dal
 * wallbox — e quando nessuna delle due dice niente di utilizzabile in questo
 * istante non vuol dire "cavo staccato": vuol dire che non si e' saputo
 * chiedere. Un sensore vero riporta "unavailable" durante una riconnessione
 * WiFi anche con l'auto attaccata e in carica, e quella finestra si ripete
 * piu' volte al minuto su certi wallbox. Prendere quel silenzio come una
 * risposta faceva tornare la foto a quella di riposo a ogni buco, e tornare
 * indietro appena il sensore si faceva risentire: la stessa auto, ferma,
 * con la fotografia che cambiava da sola senza che nessuno la toccasse.
 *
 * Quando ne' il testo ne' la potenza rispondono, resta il verdetto di prima. */
export function vehiclePlugged() {
  const status = clean(liveState("dm.ev_stato_ricarica")?.state);
  if (status && !HA_SILENT_STATES.test(status)) {
    if (UNPLUGGED_STATES.test(status) || UNPLUGGED_WORDS.test(status)) return (state.lastPlugged = false);
    if (PLUGGED_WORDS.test(status)) return (state.lastPlugged = true);
  }
  for (const reference of ["dm.ev_potenza_wallbox", "dm.ev_charge_power"]) {
    const raw = liveState(reference)?.state;
    const power = Number(raw);
    if (Number.isFinite(power)) return (state.lastPlugged = power > 10);
  }
  return state.lastPlugged;
}

/** The photo the hero should be showing right now. */
export function activeVehiclePhoto(photos = configuredPhotos(), plugged = vehiclePlugged()) {
  const chosen = plugged ? photos.plugged || photos.idle : photos.idle || photos.plugged;
  return clean(chosen);
}

export function applyVehicleAsset() {
  if (!doc) return false;
  /* Il disegno legge il PROFILO, non le caselle piatte.
   *
   * Le due caselle sono per-dispositivo e dalla 1.1.7 non viaggiano piu' con
   * la configurazione: sul telefono che riceve la config restano quelle di
   * mesi fa, e questo giro — che e' l'unico a mettere la foto sull'eroe — le
   * disegnava cosi' com'erano. Il pannello leggeva il profilo e mostrava le
   * foto giuste, la plancia mostrava quella vecchia: due fonti, due verita'.
   * La fonte adesso e' una: il profilo attivo, lo stesso del pannello. Le
   * caselle si riseminano qui a ogni disegno, cosi' chi ancora le legge — il
   * runtime storico, la procedura iniziale — vede la stessa foto. */
  const photos = fotoDelProfiloAttivo();
  storePhoto(EV_PHOTO_KEYS.idle, photos.idle);
  storePhoto(EV_PHOTO_KEYS.plugged, photos.plugged);
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
    /* La foto adesso abita nel profilo, e la correzione deve arrivarci: se si
     * fermasse alle caselle, la risemina del giro dopo le riporterebbe al
     * valore storto e la correzione ripartirebbe a ogni disegno, per sempre. */
    saveProfilePhotos({
      idle: clean(photos.idle) === clean(original) ? url : photos.idle,
      plugged: clean(photos.plugged) === clean(original) ? url : photos.plugged,
    });
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
  /* Il campo resta, per chi il percorso lo sa gia'; accanto c'e' il tasto per
   * sfogliare le cartelle di Home Assistant, che e' il modo in cui la foto si
   * sceglie senza sapere che /config/www si chiama /local. */
  return `<div class="dm-ev-photo" data-ev-photo="${kind}">
    <span class="dm-ev-photo-lbl">${esc(label)}</span>
    <span class="dm-ev-photo-row"><input class="ed-input mono" data-ev-photo-input value="${esc(value)}" placeholder="/local/auto-${kind}.png" autocomplete="off" spellcheck="false" aria-label="${esc(label)}"><button type="button" class="dm-ev-photo-browse" data-ev-photo-browse aria-label="${esc(t("Sfoglia le cartelle di Home Assistant", "Browse the Home Assistant folders"))}" title="${esc(t("Sfoglia le cartelle di Home Assistant", "Browse the Home Assistant folders"))}">📁</button></span>
    <small class="dm-ev-photo-hint">${esc(hint)}</small>
    <span class="dm-ev-photo-preview" data-ev-photo-preview></span>
  </div>`;
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
  const salvate = { idle: "", plugged: "" };
  for (const field of panelNode.querySelectorAll("[data-ev-photo]")) {
    const kind = field.dataset.evPhoto === "plugged" ? "plugged" : "idle";
    const value = clean(field.querySelector("[data-ev-photo-input]")?.value);
    const stored = value ? resolveVehicleAsset(value) || value : "";
    salvate[kind] = stored;
    root.localStorage?.setItem(EV_PHOTO_KEYS[kind], JSON.stringify(stored));
    // Written: what is on screen and what is stored say the same thing again.
    delete field.dataset.evPhotoEdited;
  }
  saveProfilePhotos(salvate);
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
  applyVehicleAsset();
  /* Salvare le foto cambia i profili, e chi tiene l'editor allineato al
   * modello ridisegna la scheda: il riquadro delle foto se ne andava con lei e
   * tornava solo al prossimo aggiornamento di stato, cioe' quando capitava.
   * Il riquadro si rimette da solo, adesso. */
  scheduleEvSyncSettled();
}

function fotoDelProfiloAttivo() {
  const elenco = profiles();
  if (!elenco.length) return configuredPhotos();
  const indice = Math.max(0, Math.min(elenco.length - 1, activeIndex()));
  return photosForProfile(elenco[indice], configuredPhotos(), elenco.length);
}

export function ensureVehiclePhotoEditor() {
  const body = evEditorBody();
  if (!body) return false;
  const legacyRow = legacyPhotoRow(body);
  legacyRow?.setAttribute("hidden", "hidden");
  let panelNode = body.querySelector(":scope > [data-ev-photos]");
  /* Il pannello legge dal PROFILO, non dalle caselle piatte.
   *
   * Le caselle sono il disegno di adesso e seguono l'auto attiva con un giro
   * di ritardo: subito dopo un salvataggio o una cancellazione portano ancora
   * le foto della vettura di prima. Il pannello che le mostrava — e che le
   * risalvava — e' il ponte con cui la foto di un'auto finiva sull'altra, col
   * titolo giusto a fare da alibi. La fonte e' il profilo attivo; le caselle
   * restano solo il ripiego di chi ha una vettura sola col formato vecchio. */
  const photos = fotoDelProfiloAttivo();
  if (!panelNode) {
    panelNode = doc.createElement("section");
    panelNode.className = "ed-form dm-ev-photos";
    panelNode.dataset.evPhotos = "true";
    panelNode.innerHTML = `<div class="ed-sec-title" data-ev-photos-title>📸 ${t("Foto dell'auto", "Vehicle photos")}</div>
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
    panelNode.addEventListener("click", async (event) => {
      const button = event.target?.closest?.("[data-ev-photo-browse]");
      if (!button || button.disabled) return;
      event.preventDefault();
      const kind = button.closest("[data-ev-photo]")?.dataset.evPhoto === "plugged" ? "plugged" : "idle";
      button.disabled = true;
      let chosen = "";
      try {
        chosen = await pickMediaImage();
      } finally {
        button.disabled = false;
      }
      if (!chosen) return;
      /* Il riquadro si ridisegna da solo mentre la finestra e' aperta: i nodi
       * presi prima di aprirla possono essere gia' fuori dalla pagina, e
       * scriverci dentro vorrebbe dire salvare un campo vuoto. Si ricercano
       * adesso, a scelta fatta. */
      const panel = evEditorBody()?.querySelector(":scope > [data-ev-photos]");
      const field = panel?.querySelector(`[data-ev-photo="${kind}"]`);
      const input = field?.querySelector("[data-ev-photo-input]");
      if (!panel || !input) return;
      input.value = chosen;
      // Scelta a mano come se fosse scritta a mano: da qui in poi il campo
      // appartiene a chi sta configurando, e nessun giro successivo lo tocca.
      field.dataset.evPhotoEdited = "true";
      paintPhotoPreview(field);
      savePhotos(panel);
      panel.dataset.saved = "true";
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
  /* Il pannello scrive sull'auto attiva, e lo dice.
   *
   * Con due auto configurate le foto caricate qui finivano "da qualche parte":
   * sul profilo attivo, che non e' per forza quello che si sta guardando
   * nell'accordion. Chi apriva la configurazione con la B10 attiva e caricava
   * le foto della T03 se le ritrovava sulla B10 — ed e' esattamente il "si
   * mischiano le foto" segnalato per giorni. Il titolo adesso porta il nome
   * dell'auto a cui le foto verranno salvate, aggiornato a ogni passata. */
  const titolo = panelNode.querySelector("[data-ev-photos-title]");
  if (titolo) {
    const elenco = profiles();
    const attiva = elenco[Math.max(0, Math.min(elenco.length - 1, activeIndex()))];
    const nome = clean(attiva?.name);
    const testo = nome && elenco.length > 1
      ? `📸 ${t("Foto dell'auto", "Vehicle photos")} — ${nome}`
      : `📸 ${t("Foto dell'auto", "Vehicle photos")}`;
    if (titolo.textContent !== testo) titolo.textContent = testo;
    /* La bozza non sopravvive al cambio d'auto.
     *
     * Un percorso scritto e non ancora salvato resta nel campo apposta — il
     * pannello si ridisegna da solo mentre si scrive. Ma se nel frattempo
     * cambia l'AUTO di destinazione, quella bozza apparteneva all'altra:
     * salvarla adesso la scriverebbe sul profilo sbagliato, con il titolo
     * nuovo a fare da alibi. Al cambio si azzera il segno di modifica e i
     * campi si ricaricano dalle foto dell'auto appena scelta. */
    if (titolo.dataset.evPhotosFor !== undefined && titolo.dataset.evPhotosFor !== nome) {
      const foto = fotoDelProfiloAttivo();
      for (const field of panelNode.querySelectorAll("[data-ev-photo]")) {
        delete field.dataset.evPhotoEdited;
        const input = field.querySelector("[data-ev-photo-input]");
        /* Anche sul campo a fuoco: il cambio d'auto e' un gesto dell'utente,
         * non un giro di fondo, e la bozza appartiene all'auto di prima. */
        if (input) {
          input.value = foto[field.dataset.evPhoto] || "";
          paintPhotoPreview(field);
        }
      }
    }
    titolo.dataset.evPhotosFor = nome;
  }
  return true;
}

/* Il nome sulla scheda decide di chi sono i campi.
 *
 * La scheda dell'auto e' un campo nome sopra le caselle delle entita' dm.ev_*,
 * che mostrano la mappatura VIVA — quella dell'auto attiva. Scrivere li' il
 * nome di un'auto nuova e premere «salva scheda» catturava quei campi cosi'
 * com'erano: la nuova nasceva con le entita' dell'altra addosso, e sembrava
 * la stessa macchina con un altro nome. Segnalato alla lettera: «appena
 * inserisco il nome di un'altra auto deve svuotare i dati».
 *
 * Il campo nome adesso governa le caselle: un nome che non e' di nessuno le
 * svuota — l'auto nuova parte da zero — e il nome di un'auto esistente le
 * ricarica dai dati SUOI, cosi' risalvarla non le scrive addosso la mappatura
 * di quella attiva. Si toccano solo i campi a video: le mappature salvate non
 * cambiano finche' non si preme salva, ed e' `edSetSlot` — il giro di sempre —
 * a leggere i campi al salvataggio. */
function ensureCarNameGuard() {
  const campo = doc?.getElementById("ed-evcar-name");
  if (!campo || campo.dataset.dmEvNameGuard === "true") return false;
  campo.dataset.dmEvNameGuard = "true";
  campo.addEventListener("input", () => {
    const nome = clean(campo.value);
    const trovata = profiles().find((car) => clean(car?.name) === nome) || null;
    const possedute = trovata ? trovata.ov || trovata.overrides || {} : {};
    for (const input of doc.querySelectorAll('#ed-body input.ed-slot-in[data-ref^="dm.ev_"]')) {
      const valore = clean(possedute[input.dataset?.ref]);
      if (input.value !== valore) input.value = valore;
    }
  });
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

/* Dove sta scritta la carica dell'auto.
 *
 * Non in un posto solo: la mappatura storica si chiama dm.ev_batteria_auto, le
 * piu' recenti dm.ev_battery e dm.ev_soc, e un profilo puo' portarsela dentro
 * come battery_entity o soc_entity. Sono tutte accettate, quindi chi vuole
 * sapere se un'auto c'e' deve guardarle tutte: bastava fermarsi alla prima per
 * non vedere un'auto configurata benissimo.
 *
 * L'ordine e' quello che usa gia' la tendina dei profili, e resta uno solo:
 * altrove si importa questa. */
const BATTERY_REFS = Object.freeze(["dm.ev_batteria_auto", "dm.ev_battery", "dm.ev_soc"]);

export function vehicleBatteryEntity(car = profiles()[activeIndex()] || profiles()[0] || {}) {
  const overrides = car.ov || car.overrides || {};
  for (const reference of BATTERY_REFS) {
    const own = clean(overrides[reference]);
    if (own) return own;
  }
  const carOwn = clean(car.battery_entity || car.soc_entity);
  if (carOwn) return carOwn;
  // Nessun profilo la porta: resta la mappatura generale della plancia.
  for (const reference of BATTERY_REFS) {
    let resolved = "";
    try { resolved = clean(root.resolveEntity?.(reference)); } catch (_error) {}
    if (resolved && resolved !== reference) return resolved;
  }
  return "";
}

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

/* La stessa tendina, ovunque serva scegliere l'auto.
 *
 * Le linguette dei profili nascono in cima alla pagina Auto. Il popup dell'auto
 * — quello che si apre dal cerchio della Wallbox e dalla pagina — mostrava
 * sempre e solo l'auto attiva, senza modo di passare all'altra: chi ne ha due
 * doveva chiudere, tornare in Auto, cambiare, e riaprire.
 *
 * Non e' una seconda tendina: e' questa, disegnata in un secondo posto. Stesso
 * costruttore, stesso ascoltatore, stesso conteggio; scegliere da qui e'
 * scegliere da li', e la foto la aggiorna `applyVehicleAsset` come ha sempre
 * fatto — nel popup scrive gia'. La firma della struttura sta adesso
 * sull'elemento invece che nel modulo, perche' i posti sono due e un valore
 * solo avrebbe fatto ridisegnare uno a ogni passata dell'altro. */
function paintSelector(host, cars) {
  let nav = host.querySelector(".dm-vehicle-profile-tabs");
  if (!nav) { nav=doc.createElement("nav"); nav.className="dm-vehicle-profile-tabs"; nav.setAttribute("aria-label",t("Seleziona auto","Select vehicle")); host.append(nav); bindProfileNav(nav); }
  if (!cars.length) {
    if (nav.childElementCount) nav.replaceChildren();
    host.dataset.profileCount="0"; host.style.display="none"; host.dataset.dmEvSignature=""; return false;
  }
  host.style.display=""; host.dataset.profileCount=String(cars.length);
  const structure = selectorStructureSignature(cars);
  if (host.dataset.dmEvSignature !== structure || nav.children.length !== cars.length) { buildProfileButtons(nav,cars); host.dataset.dmEvSignature=structure; }
  const selected = Math.max(0,Math.min(cars.length-1,activeIndex()));
  nav.querySelectorAll(".dm-vehicle-profile-card").forEach((button,index)=>{
    const active=index===selected; button.classList.toggle("active",active); button.setAttribute("aria-pressed",String(active));
    const small=button.querySelector("small"), check=button.querySelector(".dm-vehicle-profile-check");
    const meta=profileMeta(cars[index]); if (small && small.textContent!==meta) small.textContent=meta;
    if (check) check.textContent=active?"✓":"";
  });
  return true;
}

/* Dove stanno le linguette dentro al popup: subito sotto l'intestazione, sopra
 * la foto — cosi' si sceglie l'auto e si vede cambiare la sua fotografia. */
function popupSelectorHost() {
  const card = doc?.querySelector?.("#ev-popup .ev-popup-card");
  if (!card) return null;
  let host = card.querySelector(":scope > .dm-vehicle-profile-popup");
  if (!host) {
    host = doc.createElement("div");
    host.className = "dm-vehicle-profile-host dm-vehicle-profile-popup";
    const header = card.querySelector(".ev-waw-header");
    if (header) header.insertAdjacentElement("afterend", host);
    else card.prepend(host);
  }
  return host;
}

export function renderVehicleSelector() {
  const cars = profiles();
  const popup = popupSelectorHost();
  if (popup) paintSelector(popup, cars);
  const host = nativeHost(); if (!host) return false;
  host.classList.add("dm-vehicle-profile-host");
  const select = nativeSelect(); if (select) { select.classList.add("dm-vehicle-native-select"); select.setAttribute("aria-hidden","true"); select.tabIndex=-1; }
  return paintSelector(host, cars);
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

function restoreProfilePhotos(car, before, profileCount = profiles().length) {
  const mostra = photosForProfile(car, before, profileCount);
  storePhoto(EV_PHOTO_KEYS.idle, mostra.idle);
  storePhoto(EV_PHOTO_KEYS.plugged, mostra.plugged);
}

/* Le due caselle da cui la plancia legge la foto seguono l'auto scelta anche
 * quando nessuno sceglie niente.
 *
 * `cd_ev_image` e `cd_ev_image_plugged` sono le caselle che il disegno legge, e
 * si riempivano soltanto quando si toccava un'auto: le riscriveva il giro di
 * `cdEvApplyCar`. A un ricaricamento della pagina pero' nessuno la tocca, e in
 * quelle caselle resta l'ultimo valore che ci e' finito dentro — quello
 * dell'altra auto, o niente. Da qui la foto che cambia da sola aggiornando, e
 * l'immagine generica al posto della vettura.
 *
 * All'avvio le caselle si riportano su quello che dice il profilo attivo. Con
 * una macchina sola non si tocca niente: li' la casella *e'* la fonte, e
 * `photosForProfile` lo sa gia'. */
export function seedActiveProfilePhotos() {
  const elenco = profiles();
  /* Con una macchina sola non si toglie niente: `photosForProfile` lascia in
   * piedi quello che c'e' gia' nelle caselle quando il profilo non porta foto
   * proprie. Serve pero' passarci lo stesso, perche' e' il giro che porta la
   * foto dentro al profilo. */
  if (!elenco.length) return false;
  /* Prima si adotta, poi si semina.
   *
   * Chi arriva dal formato vecchio puo' avere la foto col cavo solo nella
   * casella sciolta, e nessun profilo che la porti: e' quello che
   * `adoptExistingPhotos` esiste per travasare. Seminando per primi la regola
   * multi-profilo svuoterebbe la casella — il profilo attivo quella foto non
   * ce l'ha ancora — e l'adozione poi non troverebbe piu' niente da travasare.
   * La foto dell'auto sparirebbe proprio all'avvio. */
  adoptExistingPhotos();
  /* Lo stesso indice che usano il selettore e l'adozione: con l'auto attiva
   * cancellata, `cd_ev_car_active` resta fuori dall'elenco e senza questo la
   * plancia evidenzierebbe la prima vettura continuando a mostrare la foto di
   * quella che non c'e' piu'. */
  const chiesto = activeIndex();
  const indice = chiesto >= 0 && chiesto < elenco.length ? chiesto : 0;
  const car = elenco[indice];
  if (!car) return false;
  const before = configuredPhotos();
  restoreProfilePhotos(car, before, elenco.length);
  const dopo = configuredPhotos();
  return dopo.idle !== before.idle || dopo.plugged !== before.plugged;
}

/* Le foto appena salvate entrano nell'auto scelta.
 *
 * Le due caselle della plancia restano, perche' e' da li' che il disegno legge,
 * ma non sono piu' il posto dove le foto abitano: quello e' il profilo. Prima
 * ci finivano solo li', e il profilo imparava la sua foto unicamente se si
 * risalvava la scheda dell'auto — cosa che nessuno fa dopo aver scritto un
 * percorso. Da li' in poi cambiare auto non cambiava niente: il profilo nuovo
 * non aveva foto, e teneva quella dell'altro. */
function saveProfilePhotos(photos) {
  const legacy = legacyProfiles();
  const cars = legacy.length ? legacy : canonicalProfiles();
  if (!cars.length) return false;
  /* Con l'attiva appena cancellata l'indice vale -1: il vecchio clamp a zero
   * scriveva le foto della vettura sparita sulla prima della lista. Nessuna
   * auto attiva, nessun salvataggio. */
  if (activeIndex() < 0) return false;
  const posizione = Math.max(0, Math.min(cars.length - 1, activeIndex()));
  /* Niente pulizie d'ufficio sugli altri profili.
   *
   * C'era la tentazione di togliere la coppia appena salvata a chi la portava
   * identica — la firma del vecchio furto. Ma due auto possono portare la
   * stessa foto per scelta legittima, e l'uguaglianza dei percorsi non prova
   * niente: cancellare in silenzio una configurazione valida e' peggio del
   * difetto che si voleva riparare. Chi ha i profili mescolati li risistema
   * risalvando le foto giuste su ciascuna auto, col pannello che adesso
   * dichiara a chi sta scrivendo — e la resurrezione dagli alias e' chiusa
   * alla fonte. */
  const aggiornate = withProfilePhotos(cars, posizione, photos);
  if (aggiornate === cars) return false;
  if (legacy.length) writeJsonIfChanged("cd_ev_cars", aggiornate);
  try {
    dashboardStore()?.replaceSection?.("ev", aggiornate)?.catch?.(() => {});
  } catch (_error) {}
  return true;
}

/* Una volta sola, all'avvio: chi arriva da una versione in cui le foto stavano
 * nella plancia le ritrova sull'auto che le mostrava. */
/* Il travaso si fa una volta sola, e ce ne si segna.
 *
 * Le due caselle sciolte restano — sono il disegno di adesso — ma non sono piu'
 * il posto dove la foto abita. Finche' il travaso poteva ripartire, pero',
 * cancellare una foto non bastava: la si toglieva dal profilo su un
 * dispositivo, la configurazione condivisa arrivava qui, e il giro successivo
 * ritrovava la vecchia casella ancora piena e la rimetteva dentro al profilo
 * vuoto — cancellazione annullata, e magari rispedita agli altri.
 *
 * Il segno si mette solo quando c'era davvero qualcosa da guardare: metterlo
 * prima che le auto siano arrivate vorrebbe dire non travasare mai piu'
 * niente, su nessuna casa. */
const PHOTO_MIGRATION_KEY = "cd_ev_photos_moved";

function adoptExistingPhotos() {
  const legacy = legacyProfiles();
  const cars = legacy.length ? legacy : canonicalProfiles();
  // Anche una macchina sola: e' cosi' che la sua foto smette di vivere solo
  // nelle due caselle e comincia a viaggiare col profilo.
  if (!cars.length) return false;
  if (root.localStorage?.getItem(PHOTO_MIGRATION_KEY) === "1") return false;
  root.localStorage?.setItem(PHOTO_MIGRATION_KEY, "1");
  const aggiornate = adoptLoosePhotos(cars, Math.max(0, activeIndex()), configuredPhotos());
  if (aggiornate === cars) return false;
  if (legacy.length) writeJsonIfChanged("cd_ev_cars", aggiornate);
  try {
    dashboardStore()?.replaceSection?.("ev", aggiornate)?.catch?.(() => {});
  } catch (_error) {}
  return true;
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
      // At this point the runtime has not attached a name yet -- it does not
      // know which car this becomes, so there is nothing to match against.
      // Whether these two flat-key photos actually belong to this car is
      // decided afterwards, in `addProfile` below, once the name is known.
      if (!clean(profile.img)) profile.img=photos.idle;
      profile.imgPlugged=photos.plugged;
      return profile;
    }
    captureProfile.__dmEvSection=true; captureProfile.__dmPrevious=previous; root.cdEvCaptureProfile=captureProfile;
  }
  /* Risalvare un profilo non deve cancellare l'auto, ne' rubarle la foto
   * dell'altra.
   *
   * `edEvCarAdd` cerca un profilo con lo stesso nome e, trovandolo, ci scrive
   * sopra un oggetto nuovo: `{ name, ov, img }`. Tutto il resto se ne andava
   * senza che nessuno l'avesse chiesto — la marca scelta nella
   * Personalizzazione, il modello, la foto col cavo attaccato, e adesso la
   * chiave. Chi rimappava un'entita' si ritrovava l'auto senza logo e senza la
   * seconda foto, e con la chiave persa quell'auto tornava a essere una riga.
   *
   * Il giro del runtime resta quello che e': si guarda com'erano le auto prima,
   * e dopo si rimette a ciascuna quello che le appartiene.
   *
   * Con due auto configurate c'e' pero' un'altra cosa da guardare: l'accordion
   * lascia modificare la mappatura di un'auto senza prima averla resa attiva,
   * e il profilo appena catturato porta le foto delle due caselle piatte —
   * quelle dell'auto *attiva*, non necessariamente di questa. Rimappare
   * un'entita' di T03 mentre B10 e' quella in mostra faceva finire la foto di
   * B10 dentro a T03, e viceversa: si segna qui chi era attiva prima di
   * chiamare il runtime, per poter dire dopo se le foto appena catturate
   * erano davvero sue o solo di passaggio. */
  if (typeof root.edEvCarAdd === "function" && !root.edEvCarAdd.__dmEvSection) {
    const previous=root.edEvCarAdd;
    function addProfile(...args) {
      const prima=legacyProfiles();
      const indiceAttivoPrima=activeIndex();
      const result=previous.apply(this,args);
      const dopo=legacyProfiles();
      let rimesse=restoreCarIdentities(dopo, prima, indiceAttivoPrima);
      /* Un'auto NUOVA nasce senza foto.
       *
       * Il runtime la battezza con le due caselle piatte — che sono le foto
       * dell'auto ATTIVA in quel momento. Con una vettura gia' configurata,
       * la seconda nasceva cosi' con la foto della prima addosso, e nessuna
       * protezione poteva accorgersene: `restoreCarIdentities` restituisce
       * intatta un'auto che prima non c'era. Le foto di un'auto nuova si
       * scelgono dal pannello, non si ereditano. Il primissimo profilo resta
       * fuori: li' il travaso dalle caselle e' l'adozione del formato
       * vecchio, ed e' voluto. */
      if (prima.length) {
        /* Lo stesso confronto esatto del runtime e di restoreCarIdentities:
         * "Tesla" e "tesla" sono due auto per il runtime, e devono esserlo
         * anche qui — o la seconda si terrebbe le foto catturate. */
        const conosciute = new Set(prima.map((car) => clean(car?.name)));
        rimesse = rimesse.map((car) =>
          conosciute.has(clean(car?.name))
            ? car
            : { ...car, img: "", imgPlugged: "", image: "", image_url: "" },
        );
      }
      if (rimesse !== dopo) writeJsonIfChanged("cd_ev_cars", rimesse);
      /* Il runtime ha appena reso attiva l'auto salvata, ma le due caselle da
       * cui il disegno legge portano ancora le foto di quella di prima: senza
       * questa risemina l'eroe mostrava la vettura vecchia sotto la linguetta
       * nuova, e un «Salva foto» in quel momento gliela scriveva addosso. */
      const indiceDopo = activeIndex();
      const attivaDopo = rimesse[indiceDopo];
      if (attivaDopo && indiceDopo !== indiceAttivoPrima)
        restoreProfilePhotos(attivaDopo, configuredPhotos(), rimesse.length);
      root.queueMicrotask?.(scheduleEvSyncSettled);
      return result;
    }
    addProfile.__dmEvSection=true; addProfile.__dmPrevious=previous; root.edEvCarAdd=addProfile;
  }
  /* «SALVA SEZIONE» salva anche le foto.
   *
   * Il bottone verde in fondo alla sezione raccoglie i campi entita' e
   * nient'altro: le due caselle delle foto le salvava soltanto il tasto
   * «Salva foto» del pannello. Chi scriveva un percorso e premeva il bottone
   * grande — che e' quello che chiunque preme, sta in fondo e dice "salva la
   * sezione" — si vedeva il percorso nel campo, l'anteprima giusta sotto, e
   * niente nel profilo: alla riapertura tornava la foto di prima. Un campo
   * toccato e non ancora salvato adesso si salva anche da qui. */
  if (typeof root.edSaveSezione === "function" && !root.edSaveSezione.__dmEvSection) {
    const previous=root.edSaveSezione;
    function saveSection(button, ...rest) {
      const result=previous.call(this, button, ...rest);
      try {
        const body=button?.closest?.(".ed-acc-body");
        const panel=body?.querySelector?.("[data-ev-photos]");
        if (panel && panel.querySelector('[data-ev-photo][data-ev-photo-edited="true"]')) {
          savePhotos(panel);
          panel.dataset.saved="true";
        }
      } catch (_error) {}
      return result;
    }
    saveSection.__dmEvSection=true; saveSection.__dmPrevious=previous; root.edSaveSezione=saveSection;
  }
  /* Cancellare un'auto sposta tutte quelle sotto di lei: e' esattamente il caso
   * in cui una posizione salvata smette di indicare la vettura che indicava. La
   * chiave regge da sola, e se era proprio l'auto attiva a sparire si riparte
   * da quella che la plancia mostra adesso. */
  if (typeof root.cdEvCarBtn === "function" && !root.cdEvCarBtn.__dmEvSection) {
    const previous=root.cdEvCarBtn;
    function carButton(...args) {
      const primaDelTasto=legacyProfiles();
      const result=previous.apply(this,args);
      /* Dopo una cancellazione le caselle piatte portano ancora le foto della
       * vettura sparita: si riseminano da quella che la plancia mostra ora.
       * E se a sparire era proprio l'attiva, l'indice resta -1 mentre tutto
       * il resto mostra la prima della lista come scelta: la si rende attiva
       * DAVVERO, cosi' pannello e salvataggi parlano della stessa auto. */
      const elenco=legacyProfiles();
      if (activeIndex() < 0 && elenco.length) {
        try { root.localStorage?.setItem("cd_ev_car_active", "0"); } catch (_error) {}
      }
      /* L'ultima auto se ne va con tutto quello che era suo.
       *
       * Cancellata l'ultima, le due caselle del disegno portavano ancora le
       * sue foto e `cd_ev_car_active` il suo indice: la vettura spariva
       * dall'elenco ma la sua fotografia restava sull'eroe, per sempre —
       * "quando cancello non cancella tutto", alla lettera. Si pulisce solo
       * quando la lista si e' svuotata ADESSO: una lista vuota da sempre e'
       * una configurazione a caselle sole del formato vecchio, e li' le
       * caselle sono l'unica casa della foto. */
      if (primaDelTasto.length && !elenco.length) {
        storePhoto(EV_PHOTO_KEYS.idle, "");
        storePhoto(EV_PHOTO_KEYS.plugged, "");
        try { root.localStorage?.removeItem("cd_ev_car_active"); } catch (_error) {}
      }
      const indice=Math.max(0, Math.min(elenco.length - 1, activeIndex()));
      const attiva=elenco[indice];
      if (attiva) restoreProfilePhotos(attiva, configuredPhotos(), elenco.length);
      root.queueMicrotask?.(scheduleEvSync);
      return result;
    }
    carButton.__dmEvSection=true; carButton.__dmPrevious=previous; root.cdEvCarBtn=carButton;
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
  /* Il giro per fotogramma disegna, non scrive.
   *
   * Ci passavano anche l'assegnazione delle chiavi e il travaso delle foto
   * sciolte, che sono due migrazioni: succedono una volta e poi non c'e' piu'
   * niente da fare. Ma questo giro adesso riparte a ogni ridisegno della
   * scheda, e un ridisegno arriva a ogni cambio del modello: rimettevano mano
   * all'elenco delle auto proprio mentre qualcun altro lo stava cambiando, e la
   * marca appena scelta tornava indietro da sola. Le migrazioni stanno
   * all'avvio, dove stanno le migrazioni. */
  const run=()=>{state.frame=0;installLegacyWrappers();renderVehicleSelector();applyVehicleAsset();ensureVehiclePhotoEditor();ensureCarNameGuard();};
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
.dm-ev-photos .dm-ev-photo-browse{flex:0 0 40px!important;height:40px!important;border:none!important;border-radius:11px!important;background:linear-gradient(135deg,#0ea5e9,#0369a1)!important;color:#fff!important;font-size:16px!important;cursor:pointer!important}
.dm-ev-photos .dm-ev-photo-browse:disabled{opacity:.5!important;cursor:progress!important}
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
#ev-popup .dm-vehicle-profile-popup{box-sizing:border-box!important;width:100%!important;max-width:100%!important;margin:0 0 12px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
/* La striscia si ferma dentro alla finestra. Sul telefono le linguette
   scorrono di lato invece di andare a capo, e la misura che usa per farlo e'
   quella dello schermo: dentro a una finestra, che e' piu' stretta, quella
   misura la faceva sbordare oltre il bordo della card. */
#ev-popup .dm-vehicle-profile-popup>.dm-vehicle-profile-tabs{max-width:100%!important;flex-wrap:wrap!important;justify-content:center!important;overflow-x:visible!important;padding:0!important}
#ev-popup .dm-vehicle-profile-popup .dm-vehicle-profile-card{max-width:100%!important}
.dm-vehicle-profile-tabs{display:flex!important;align-items:stretch!important;justify-content:center!important;flex-wrap:wrap!important;gap:8px!important;width:auto!important;max-width:100%!important}.dm-vehicle-profile-card{display:grid!important;grid-template-columns:58px minmax(0,max-content) 20px!important;align-items:start!important;gap:8px!important;box-sizing:border-box!important;width:max-content!important;max-width:min(100%,340px)!important;min-height:54px!important;margin:0!important;padding:8px 9px!important;border:1px solid var(--divider-color,var(--card-border,#dbe4ee))!important;border-radius:15px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--text,#0f172a)!important;box-shadow:0 6px 16px rgba(15,23,42,.07)!important;text-align:left!important;cursor:pointer!important;transition:border-color .12s ease,box-shadow .12s ease!important}.dm-vehicle-profile-card.active{border-color:var(--accent,#0ea5e9)!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 10%,var(--ha-card-background,#fff))!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent,#0ea5e9) 18%,transparent),0 8px 20px rgba(14,165,233,.13)!important}
.dm-vehicle-profile-icon{display:grid!important;place-items:start center!important;align-self:start!important;width:58px!important;height:34px!important;min-width:58px!important;overflow:hidden!important;border-radius:10px!important;background:color-mix(in srgb,var(--accent,#0ea5e9) 10%,transparent)!important}.dm-vehicle-profile-icon .dm-car-brand{display:grid!important;place-items:center!important;width:54px!important;max-width:54px!important;height:28px!important;margin:2px auto 0!important}.dm-vehicle-profile-icon .dm-car-brand img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}.dm-vehicle-profile-icon ha-icon{margin:3px auto 0!important}.dm-vehicle-profile-copy{display:grid!important;gap:2px!important;min-width:0!important;padding-top:1px!important}.dm-vehicle-profile-copy strong,.dm-vehicle-profile-copy small{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-vehicle-profile-copy strong{max-width:210px!important;font-size:13px!important;font-weight:900!important;line-height:1.1!important}.dm-vehicle-profile-copy small{font-size:9px!important;font-weight:750!important;line-height:1.1!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important}.dm-vehicle-profile-check{display:grid!important;place-items:center!important;width:20px!important;height:20px!important;border-radius:50%!important;background:var(--accent,#0ea5e9)!important;color:#fff!important;font-size:11px!important;font-weight:900!important;opacity:0!important}.dm-vehicle-profile-card.active .dm-vehicle-profile-check{opacity:1!important}
.dm-ev-brand-badge .dm-car-brand{display:grid!important;place-items:center!important;max-width:105px!important;height:34px!important}.dm-ev-brand-badge .dm-car-brand img{width:100%!important;height:100%!important;object-fit:contain!important}
@media(max-width:620px){#ev-car-picker.dm-vehicle-profile-host{width:auto!important;max-width:calc(100% - 20px)!important;margin:8px auto!important}.dm-vehicle-profile-tabs{justify-content:flex-start!important;flex-wrap:nowrap!important;gap:7px!important;max-width:calc(100vw - 20px)!important;overflow-x:auto!important;padding:2px 2px 5px!important;scrollbar-width:none!important}.dm-vehicle-profile-tabs::-webkit-scrollbar{display:none!important}.dm-vehicle-profile-card{flex:0 0 auto!important;max-width:76vw!important;min-height:50px!important;padding:7px 8px!important;grid-template-columns:52px minmax(0,max-content) 18px!important;gap:7px!important}.dm-vehicle-profile-icon{width:52px!important;min-width:52px!important;height:32px!important}.dm-vehicle-profile-icon .dm-car-brand{width:48px!important;max-width:48px!important;height:25px!important}.dm-vehicle-profile-copy strong{max-width:44vw!important;font-size:12px!important}.dm-vehicle-profile-copy small{font-size:8.5px!important}.dm-vehicle-profile-check{width:18px!important;height:18px!important;font-size:10px!important}}
  `);
}

function bindEditorEntryPoints() {
  onEditorRedraw("__dmEvSection_editorSwitch", scheduleEvSyncSettled);
  wrapFunction("apriConfigEntita", "__dmEvSection_apriConfigEntita", scheduleEvSyncSettled);
}

export function installEvSection() {
  if (!doc) return;
  root.dmRenderVehicleSelector=renderVehicleSelector; installStyles(); installLegacyWrappers(); bindEditorEntryPoints();
  /* Gli involucri si prendono appena i giri del runtime esistono.
   *
   * `installLegacyWrappers` non puo' fare niente se il runtime non ha ancora
   * dichiarato le sue funzioni, e il tentativo successivo arrivava col primo
   * disegno. In quella finestra `cdEvCaptureProfile` e `cdEvApplyCar` sono
   * ancora quelli di prima, che della foto col cavo non sanno niente: un
   * profilo catturato li' nasce senza, e un cambio d'auto lascia addosso la
   * foto col cavo dell'altra vettura. Dura poco e ci vuole fortuna per
   * infilarcisi, ma quello che ci si perde dentro non si recupera piu' da se'.
   * Si riprova subito, e poi appena il runtime dice di esserci. */
  root.queueMicrotask?.(installLegacyWrappers);
  root.setTimeout?.(installLegacyWrappers, 0);
  seedActiveProfilePhotos();
  scheduleEvSync();
  if (!state.installed) {
    state.installed=true;
    doc.addEventListener("click",(event)=>{if(event.target?.closest?.('[data-tab="ev"],[data-page="ev"],.ed-tab[data-tab="sez2"],.ed-acc-head'))root.setTimeout?.(scheduleEvSync,0);},true);
    for (const eventName of ["dashboardmodern:legacy-ready","dashboardmodern:runtime-ready","pageshow"]) root.addEventListener?.(eventName,()=>{installLegacyWrappers();seedActiveProfilePhotos();scheduleEvSyncSettled();bindEditorEntryPoints();});
    /* La configurazione condivisa arriva dopo l'avvio e riscrive le caselle
     * con quello che aveva l'altro dispositivo: anche li' vale il profilo. */
    root.addEventListener?.("dashboardmodern:persistence-restored",()=>{seedActiveProfilePhotos();scheduleEvSync();});
    root.addEventListener?.("dashboardmodern:state-changed",(event)=>{ if (stateChangeAffectsEv(event)) scheduleEvSync(); });
  }
}
if(doc?.readyState==="loading")doc.addEventListener("DOMContentLoaded",installEvSection,{once:true});else installEvSection();
