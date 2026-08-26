import { carBrandVisual } from "../core/personalization-catalog.js";
import { adoptLoosePhotos, photosForProfile, withProfilePhotos } from "../core/vehicle-photos.js";
import {
  VEHICLE_KEY_FIELD,
  VEHICLE_OVERRIDES_FIELD,
  nuovoVeicolo,
  pickVehicle,
  storedVehicles,
  updateVehicle,
  vehicleIndex,
  vehicleList,
} from "../core/vehicle-model.js";
import { pickMediaImage } from "./media-picker-section.js";
import { allStates, clean, dashboardStore, doc, esc, installStyle, onEditorRedraw, readJson, root, section, setLexicalGlobal, t, wrapFunction, writeJsonIfChanged } from "./shared.js";

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
  /* Le due foto sono DATI dell'auto: il disegno le legge e basta.
   *
   * Qui viveva una riscrittura «correttiva» che rimetteva nella
   * configurazione il percorso sistemato. Correggeva una volta e sbagliava
   * per sempre: la casella in cui finiva la sceglieva il cavo, quindi la foto
   * col cavo attaccato poteva finire in quella senza — e da li' le due
   * diventavano la stessa da sole, su tutte e due le auto. Il percorso storto
   * si sistema per il disegno, ogni volta, e non risale mai alla fonte:
   * scollegato e collegato di ogni vettura restano quelli che sono stati
   * scelti, e nessun giro di disegno li tocca. */
  state.lastUrl = url;
  /* Il runtime storico tiene la sua copia della foto in una variabile presa
   * all'avvio e la rimette sull'eroe a ogni giro: con due auto, o col cavo
   * che cambia, quella copia e' vecchia e le due scritture si alternavano —
   * la foto tremolava e mostrava l'altra macchina. La copia si allinea a
   * quello che disegniamo, e la guerra finisce. */
  if (url) setLexicalGlobal("CD_EV_IMAGE", url);
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

/* Rimette in uso l'auto che era in uso, entita' comprese.
 *
 * Il runtime storico, quando salva un profilo, lo rende anche attivo: chi
 * apriva la seconda vettura con la matita e premeva «Salva auto» si ritrovava
 * la plancia cambiata sotto le mani. Salvare e' un gesto della
 * configurazione; scegliere quale auto si vede e' «Usa». Qui si rimette a
 * posto quello che il salvataggio ha spostato: l'indice attivo e la mappa
 * delle entita' globali, che il giro di cattura riempie con quelle della
 * vettura appena salvata. */
function rimettiInUso(auto, indice) {
  if (!auto || !Number.isInteger(indice) || indice < 0) return false;
  const mappa = (auto.ov || auto.overrides || {});
  try {
    const salvate = readJson("cd_entity_overrides", {}) || {};
    const prossime = {};
    for (const [chiave, valore] of Object.entries(salvate))
      if (!String(chiave).startsWith("dm.ev_")) prossime[chiave] = valore;
    for (const [chiave, valore] of Object.entries(mappa)) prossime[chiave] = valore;
    writeJsonIfChanged("cd_entity_overrides", prossime);
    root.cdApplyCanonicalOverrides?.(prossime);
  } catch (_error) {}
  root.localStorage?.setItem("cd_ev_car_active", String(indice));
  return true;
}

/* I campi entita' della scheda, riempiti con quelli dell'auto aperta.
 *
 * E' quello che faceva `cdEvApplyCar` come effetto secondario del mettere in
 * uso; qui si fa solo la parte che riguarda il modulo di configurazione, e
 * nessuna chiave globale viene toccata. Un campo lasciato vuoto dall'auto
 * torna vuoto: e' cosi' che si vede che quella vettura quella entita' non ce
 * l'ha. */
function caricaCampiDaProfilo(auto) {
  const contenitore = doc?.getElementById("ed-body");
  if (!contenitore) return false;
  const mappa = (auto && typeof auto === "object" && (auto.ov || auto.overrides)) || {};
  refToccati().clear();
  for (const slot of contenitore.querySelectorAll('input.ed-slot-in[data-ref^="dm.ev_"]')) {
    const valore = clean(mappa[clean(slot.dataset.ref)]);
    if (slot.value === valore) continue;
    slot.value = valore;
    slot.dispatchEvent(new Event("input", { bubbles: true }));
    slot.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
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
  /* Le due caselle sciolte sono il DISEGNO di adesso, cioe' l'auto in uso.
   * Configurando un'altra vettura con la matita non si tocca il disegno:
   * scriverci dentro faceva comparire in plancia la foto di un'auto che
   * nessuno aveva scelto — l'altra meta' del «le foto si mischiano». */
  const elenco = profiles();
  const scriveIlDisegno = vehiclePhotoTargetIndex(elenco) === activeIndex();
  for (const field of panelNode.querySelectorAll("[data-ev-photo]")) {
    const kind = field.dataset.evPhoto === "plugged" ? "plugged" : "idle";
    const value = clean(field.querySelector("[data-ev-photo-input]")?.value);
    const stored = value ? resolveVehicleAsset(value) || value : "";
    salvate[kind] = stored;
    if (scriveIlDisegno) root.localStorage?.setItem(EV_PHOTO_KEYS[kind], JSON.stringify(stored));
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

/* L'auto a cui il pannello delle foto sta parlando.
 *
 * NON e' per forza quella in uso. La matita apre una sessione su QUELLA auto,
 * e finche' e' aperta tutto quello che si configura — nome, marca, entita' —
 * appartiene a lei: le foto non possono fare eccezione, o si torna al difetto
 * di sempre («ho aperto la Zoe, la foto e' finita sulla Tesla»). Senza
 * sessione aperta si scrive sull'auto in uso, che e' quella che la plancia
 * sta mostrando. Il -1 resta -1: nessuna auto, nessun salvataggio. */
export function vehiclePhotoTargetIndex(cars = profiles()) {
  if (!Array.isArray(cars) || !cars.length) return -1;
  const chiave = editingKey();
  if (chiave) {
    const risolto = vehicleIndex(cars, chiave);
    if (risolto >= 0) return risolto;
  }
  const attiva = activeIndex();
  if (attiva < 0) return -1;
  return Math.max(0, Math.min(cars.length - 1, attiva));
}

/* Le foto che la PLANCIA disegna: sempre quelle dell'auto in uso. La matita
 * configura, non cambia cio' che si vede — sono due gesti diversi. */
function fotoDelProfiloAttivo() {
  const elenco = profiles();
  if (!elenco.length) return configuredPhotos();
  const indice = Math.max(0, Math.min(elenco.length - 1, activeIndex()));
  return photosForProfile(elenco[indice], configuredPhotos(), elenco.length);
}

/* Le foto che il PANNELLO mostra e salva: quelle dell'auto aperta. */
function fotoDelProfiloInModifica() {
  const elenco = profiles();
  if (!elenco.length) return configuredPhotos();
  const indice = vehiclePhotoTargetIndex(elenco);
  if (indice < 0) return { idle: "", plugged: "" };
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
  const photos = fotoDelProfiloInModifica();
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
    const bersaglio = elenco[vehiclePhotoTargetIndex(elenco)];
    const nome = clean(bersaglio?.name);
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
      const foto = fotoDelProfiloInModifica();
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
 * a leggere i campi al salvataggio.
 *
 * Un campo scritto A MANO in questa seduta pero' non si tocca: chi compila
 * prima le entita' della vettura nuova e per ultimo il nome sta descrivendo
 * proprio lei, e svuotarglielo sarebbe rubargli il lavoro dalle dita — la
 * scheda poi nemmeno si salverebbe, perche' il runtime esige almeno una
 * entita'. E' la stessa regola delle bozze del pannello foto. Il segno vive
 * qui nel modulo, per riferimento: l'editor si ridisegna di continuo e un
 * segno appoggiato sul nodo morirebbe col nodo — il valore no, perche' il
 * cambio l'ha gia' scritto nelle mappature e il ridisegno lo ristampa. Si
 * azzera quando la scheda si salva e quando si cambia auto: da li' i campi
 * tornano a raccontare il modello. */
const refToccati = () => (state.evTouchedRefs ||= new Set());

/* Il segnalibro dei campi toccati deve esserci PRIMA che qualcuno tocchi.
 *
 * Stava dentro ensureCarNameGuard, che parte col primo giro differito della
 * sezione: su un dispositivo lento c'e' una finestra in cui l'editor e' gia'
 * visibile ma il giro non e' ancora passato. Un'entita' digitata li' dentro
 * non veniva marcata; al primo nome scritto il guardiano la prendeva per un
 * residuo dell'auto precedente e la svuotava — e il salvataggio rispondeva
 * «nessuna entita' mappata». Si installa al montaggio della sezione. */
function installSlotTouchTracker() {
  if (!doc || state.evSlotTouchGuard) return;
  state.evSlotTouchGuard = true;
  for (const eventName of ["input", "change"]) {
    doc.addEventListener(
      eventName,
      (event) => {
        const input = event.target;
        if (!input?.matches?.('input.ed-slot-in[data-ref^="dm.ev_"]')) return;
        const ref = clean(input.dataset?.ref);
        if (ref) refToccati().add(ref);
      },
      true,
    );
  }
}

function ensureCarNameGuard() {
  if (!doc) return false;
  installSlotTouchTracker();
  const campo = doc.getElementById("ed-evcar-name");
  if (!campo || campo.dataset.dmEvNameGuard === "true") return false;
  campo.dataset.dmEvNameGuard = "true";
  /* Il nome e' un dato della scheda, non un timone.
   *
   * Prima scrivere qui dentro RICARICAVA o SVUOTAVA le caselle delle entita'
   * a seconda che il nome fosse di qualcuno o di nessuno: rinominare un'auto
   * era impossibile (a meta' digitazione i campi cambiavano padrone) e un
   * prefisso uguale a un'altra auto ne caricava la mappatura. Di chi sono i
   * campi lo decide la SESSIONE — la matita apre un'auto, ＋ apre la bozza —
   * e il nome scritto qui e' semplicemente il nome che quell'auto avra'. */
  return true;
}

/* La lista delle auto parla la lingua delle altre sezioni.
 *
 * Il runtime la stampava col suo vocabolario: un distintivo «✓ attiva» (che
 * non significa niente in configurazione: attive lo sono tutte, quale si
 * MOSTRA lo decide la plancia), una tendina «scegli un profilo da modificare»
 * che nessuno capiva, e un bottone «＋ Salva attuale» che fotografava la
 * mappatura viva — il gesto da cui le auto si rubavano i dati a vicenda.
 * Segnalato alla lettera: «che significa aggiungi attuale? per aggiungere
 * un'auto devi mettere un + con un campo per il nome e sotto marca, modello
 * e tutte le entità; per modificare deve esserci la matita come in tutte le
 * sezioni».
 *
 * Ogni riga prende la matita — che apre QUELLA auto nella scheda sotto, nome
 * compreso — il distintivo sparisce, la tendina pure, e i due bottoni dicono
 * quello che fanno: «＋ Aggiungi auto» svuota la scheda per una vettura
 * nuova, «💾 Salva auto» salva quella che si sta compilando. */
function ensureCarListDecor() {
  const campoNome = doc?.getElementById("ed-evcar-name");
  if (!campoNome) return false;
  // La scheda e' aperta: da qui in poi ogni auto deve avere la sua chiave.
  ensureCarKeys();
  const contenitore = doc.getElementById("ed-body");
  if (!contenitore) return false;

  /* «Usa» non diceva niente.
   *
   * «Continuo a vedere nel config il tasto usa, a che serve»: e' il tasto che
   * sceglie QUALE auto la plancia mostra — una sola alla volta. Adesso lo
   * dice: quella mostrata porta il distintivo pieno e non e' piu' un bottone,
   * le altre invitano a mostrarle. */
  /* Niente da scegliere: c'e' un interruttore, e basta.
   *
   * «Che significa in plancia? A che serve quel tasto? Va abolito: al massimo
   * uno switch se attivarla o meno nella sezione.» Il tasto «Usa» decideva
   * quale auto fosse "quella attiva", ed e' il concetto da cui le foto si
   * spostavano da sola a sola. Sparisce: ogni auto ha il suo interruttore —
   * accesa, compare tra le linguette della sezione EV; spenta, non c'e'. Qual
   * e' quella aperta la sceglie chi guarda, toccando la linguetta. */
  for (const bottone of contenitore.querySelectorAll('[data-act="use"]')) {
    const riga = bottone.closest(".ed-row");
    if (!riga) continue;
    for (const badge of riga.querySelectorAll(".pool-badge"))
      if (/attiv/i.test(clean(badge.textContent))) badge.remove();
    bottone.style.setProperty("display", "none", "important");
    const indiceRiga = Number.parseInt(bottone.dataset.idx || "-1", 10);
    const principale = riga.querySelector(".ed-row-main");
    if (principale) principale.style.cssText = "flex:1 1 auto;min-width:0;";
    if (Number.isFinite(indiceRiga) && !riga.querySelector("[data-ev-enabled]")) {
      const interruttore = doc.createElement("button");
      interruttore.type = "button";
      interruttore.className = "dm-ev-enabled";
      interruttore.dataset.evEnabled = String(indiceRiga);
      interruttore.innerHTML = "<i></i>";
      interruttore.addEventListener("click", () => {
        const indice = Number.parseInt(interruttore.dataset.evEnabled, 10);
        const elenco = ensureCarKeys();
        const auto = elenco[indice];
        if (!auto) return;
        const accesa = auto.enabled !== false;
        const rimesse = elenco.map((car, posto) =>
          posto === indice ? { ...car, enabled: !accesa } : car,
        );
        salvaAuto(rimesse);
        scheduleEvSync();
        ensureCarListDecor();
      });
      bottone.insertAdjacentElement("beforebegin", interruttore);
    }
    const interruttore = riga.querySelector("[data-ev-enabled]");
    if (interruttore) {
      const auto = profiles()[indiceRiga];
      const accesa = auto ? auto.enabled !== false : true;
      interruttore.dataset.on = String(accesa);
      interruttore.setAttribute("aria-pressed", String(accesa));
      interruttore.title = accesa
        ? t("Attiva nella sezione EV — tocca per toglierla", "Active in the EV section — tap to remove it")
        : t("Non compare nella sezione EV — tocca per attivarla", "Not in the EV section — tap to add it");
      interruttore.setAttribute("aria-label", interruttore.title);
    }
    if (!riga.querySelector("[data-ev-edit]")) {
      const matita = doc.createElement("button");
      matita.type = "button";
      matita.className = "ed-btn-add";
      matita.dataset.evEdit = bottone.dataset.idx || "";
      matita.style.cssText = "flex:0 0 auto;margin-right:6px;";
      matita.textContent = "✏️";
      matita.setAttribute("aria-label", t("Modifica questa auto", "Edit this car"));
      matita.addEventListener("click", () => {
        const indice = Number.parseInt(matita.dataset.evEdit, 10);
        if (!Number.isFinite(indice)) return;
        const auto = ensureCarKeys()[indice] || profiles()[indice];
        const nome = clean(auto?.name);
        /* La matita APRE, non mette in uso.
         *
         * Passava per `cdEvCarSelEd`, che chiama `cdEvApplyCar`: aprire
         * un'auto per configurarla la faceva diventare quella della plancia —
         * foto compresa. Chi apriva la seconda vettura vedeva cambiare la
         * macchina in Home senza aver toccato «Usa», ed e' meta' del «le foto
         * si mischiano». Aprire e usare sono due gesti, e la riga ha due
         * bottoni: qui si riempiono solo i campi con le entita' di QUELLA
         * auto, e niente esce da questa scheda. */
        caricaCampiDaProfilo(auto);
        setEditingKey(uidDi(auto || {}));
        /* La matita e' l'unico gesto che dice «sto modificando LEI»: da qui
         * salvare con un nome diverso rinomina, invece di creare una riga. */
        state.evRenameArmed = true;
        /* Il ridisegno ricrea il campo del nome vuoto: lo si riempie con
         * l'auto appena aperta, cosi' «Salva auto» salva proprio lei. */
        const campo = doc.getElementById("ed-evcar-name");
        if (campo && nome) {
          campo.value = nome;
          campo.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      bottone.insertAdjacentElement("beforebegin", matita);
    }
  }

  const tendina = contenitore.querySelector('select[onchange*="cdEvCarSelEd"]');
  if (tendina) tendina.style.setProperty("display", "none", "important");

  const salva = contenitore.querySelector('button[onclick*="edEvCarAdd"]');
  if (salva) {
    /* Un salvataggio solo, e dice cosa salva.
     *
     * «Tasto ＋, tasto salva auto e giu' salva sezione: non si capisce quale
     * aggiunge davvero un'auto». Sono tre bottoni per due gesti. Adesso:
     * ＋ apre una scheda vuota e il salvataggio diventa «Salva la nuova
     * auto»; con un'auto aperta dalla matita diventa «Salva le modifiche a
     * NOME». Il bottone verde in fondo alla sezione fa esattamente questo, e
     * lo dice con le stesse parole — non e' un terzo gesto. */
    const chiaveAperta = editingKey();
    const elencoAuto = profiles();
    const apertaIndice = chiaveAperta ? vehicleIndex(elencoAuto, chiaveAperta) : -1;
    const nomeAperta = clean(elencoAuto[apertaIndice]?.name);
    const nuova = chiaveAperta === "" || (!nomeAperta && apertaIndice < 0);
    const testoSalva = nuova
      ? `💾 ${t("Salva la nuova auto", "Save the new car")}`
      : nomeAperta
        ? `💾 ${t("Salva le modifiche a", "Save changes to")} ${nomeAperta}`
        : `💾 ${t("Salva auto", "Save car")}`;
    if (salva.textContent !== testoSalva) salva.textContent = testoSalva;
    salva.dataset.evSaveCar = "true";
    const rigaNome = salva.parentElement;
    if (rigaNome && !contenitore.querySelector("[data-ev-add-new]")) {
      const aggiungi = doc.createElement("button");
      aggiungi.type = "button";
      aggiungi.className = "ed-btn-add";
      aggiungi.dataset.evAddNew = "true";
      aggiungi.style.cssText = "display:block;width:100%;margin:12px 0 8px;";
      aggiungi.textContent = `＋ ${t("Nuova auto", "New car")}`;
      aggiungi.addEventListener("click", () => {
        const campo = doc.getElementById("ed-evcar-name");
        if (!campo) return;
        setEditingKey("");
        state.evRenameArmed = false;
        campo.value = "";
        // Il ＋ e' il gesto «riparto da zero»: si svuota tutto qui, in modo
        // esplicito — il guardiano del nome protegge i valori scritti a
        // mano, e qui invece anche quelli devono andarsene.
        refToccati().clear();
        for (const slot of contenitore.querySelectorAll('input.ed-slot-in[data-ref^="dm.ev_"]'))
          slot.value = "";
        campo.dispatchEvent(new Event("input", { bubbles: true }));
        // Anche marca e modello: la card Brand non deve mostrare la vettura
        // precedente sulla scheda di una nuova.
        const pannello = doc.querySelector("#ed-body [data-ev-appearance]");
        const marca = pannello?.querySelector?.("select[data-brand]");
        const modello = pannello?.querySelector?.("select[data-model]");
        if (marca && marca.options.length) {
          marca.selectedIndex = 0;
          marca.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (modello) {
          modello.value = "";
          modello.dispatchEvent(new Event("change", { bubbles: true }));
        }
        campo.focus();
      });
      rigaNome.insertAdjacentElement("beforebegin", aggiungi);
    }
  }

  const intro = [...contenitore.querySelectorAll(".ed-intro")].find((nodo) =>
    /salvale come profilo|save them as a profile|Aggiungi auto per crearne/i.test(clean(nodo.textContent)),
  );
  if (intro) {
    const testo = `🚗 ${t(
      "Tre gesti, e basta: ＋ Nuova auto apre una scheda vuota, la ✏️ apre un'auto già salvata, l'interruttore la accende o la spegne nella sezione EV. Sotto si compila nome, marca, modello, entità e le due foto — e il salvataggio è uno solo: dice se sta creando o modificando, e in fondo alla sezione porta le stesse parole. Quale auto guardare si sceglie dalle linguette della sezione, non da qui.",
      "Three gestures, no more: ＋ New car opens an empty card, the ✏️ opens a car you already saved, the switch turns it on or off in the EV section. Below you fill in name, brand, model, entities and both photos — and there is a single save: it says whether it is creating or editing, and the one at the bottom of the section carries the same words. Which car you look at is picked from the section's own tabs, not from here.",
    )}`;
    if (clean(intro.textContent) !== clean(testo)) intro.textContent = testo;
  }
  return true;
}

function legacyProfiles() { const cars = readJson("cd_ev_cars", []); return Array.isArray(cars) ? cars : []; }
function canonicalProfiles() { const cars = section("ev", []); return Array.isArray(cars) ? cars : []; }
/* L'elenco delle auto, in una forma sola.
 *
 * Passa da `vehicleList`: e' li' che un profilo diventa un'auto — con il suo
 * uid, la sua mappatura ripulita e le sue foto dentro invece che sparse. Sei
 * moduli leggevano `cd_ev_cars` grezza, ognuno con la sua idea di cosa ci fosse
 * scritto; da qui in poi la forma la decide un posto solo. */
function profiles() {
  const legacy = legacyProfiles();
  return vehicleList(legacy.length ? legacy : canonicalProfiles());
}
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

/* L'identita' di un'auto, letta dove sta scritta.
 *
 * Era `carKey`, che se non trovava la chiave scritta se la RICAVAVA dal nome e
 * dalla marca: due auto chiamate quasi uguale ne ricavavano una sola, e
 * sceglierne una apriva l'altra. Adesso non si ricava piu' niente — l'uid ce
 * l'hanno tutte perche' `profiles()` passa dal modello, e chi non ce l'aveva se
 * l'e' visto scrivere al primo salvataggio. */
const uidDi = (car) => clean(car?.[VEHICLE_KEY_FIELD]);

/* Quale auto si sta guardando.
 *
 * La casella ha tenuto per anni una POSIZIONE, e ogni riordino dell'elenco
 * spostava l'auto in uso sotto i piedi di chi la stava guardando. Adesso il
 * riferimento e' l'uid; un numero si accetta ancora, perche' chi arriva da
 * prima non deve perdere l'auto che aveva scelto. */
export const VEHICLE_ACTIVE_KEY = "cd_ev_car_active";

function activeVehicle(list = profiles()) {
  return pickVehicle(list, root.localStorage?.getItem(VEHICLE_ACTIVE_KEY) || "");
}

function activeIndex() {
  const list = profiles();
  const scelta = activeVehicle(list);
  return scelta ? vehicleIndex(list, scelta[VEHICLE_KEY_FIELD]) : -1;
}

/* Ogni auto porta la sua chiave, sempre.
 *
 * La chiave nasceva solo premendo «Salva auto» con altre auto in lista: una
 * configurazione mai risalvata non ne aveva nessuna, e tutto il riconoscimento
 * ricadeva sul nome — che e' esattamente il modo in cui le auto si mescolavano.
 * Qui la chiave si assegna appena l'elenco passa di mano, e da li' non cambia
 * piu': rinominare un'auto non la fa diventare un'altra. */
/* Dove sta il segno che dice a che numero di uid siamo arrivati.
 *
 * `cd_ev_cars` e' un elenco e un posto per questo non ce l'ha. Serve perche' un
 * uid non deve tornare buono una seconda volta: chi cancella l'ultima auto e ne
 * aggiunge un'altra si ritroverebbe le foto e la mappatura di quella
 * cancellata. */
const EV_META_KEY = "cd_ev_meta";

const letturaMetadata = () => {
  const salvato = readJson(EV_META_KEY, {});
  return salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
};

/**
 * L'unico modo di scrivere l'elenco delle auto.
 *
 * Erano sette punti di scrittura in questa sezione piu' uno nella
 * Personalizzazione, ognuno con la sua idea di cosa andasse normalizzato e cosa
 * no: e' il motivo per cui un profilo perdeva pezzi a seconda di chi l'aveva
 * toccato per ultimo. Adesso ogni scrittura passa da qui, e da qui passa dal
 * modello — che e' il solo a sapere cos'e' un'auto.
 */
export function salvaAuto(list) {
  const { cars, metadata } = storedVehicles(list, letturaMetadata());
  writeJsonIfChanged("cd_ev_cars", cars);
  writeJsonIfChanged(EV_META_KEY, metadata, { sync: false });
  try { dashboardStore()?.replaceSection?.("ev", cars)?.catch?.(() => {}); } catch (_error) {}
  root.cdMarkDirty?.();
  root.cdSyncPush?.();
  return cars;
}

/* Ogni auto porta il suo uid, scritto.
 *
 * `vehicleList` lo assegna leggendo, ma un uid che vive solo in memoria non e'
 * un'identita': al giro dopo lo riassegna, e se nel frattempo l'elenco e'
 * cambiato di posto non e' piu' lo stesso. Qui si scrive la prima volta che
 * l'elenco passa di mano, e da li' non cambia piu'. */
function ensureCarKeys() {
  const legacy = legacyProfiles();
  if (!legacy.length) return legacy;
  const normalizzate = vehicleList(legacy);
  const uguali =
    normalizzate.length === legacy.length &&
    normalizzate.every((car, posto) => clean(legacy[posto]?.[VEHICLE_KEY_FIELD]) === car[VEHICLE_KEY_FIELD]);
  if (uguali) return normalizzate;
  return salvaAuto(normalizzate);
}

/* Di chi sono i campi della scheda, adesso.
 *
 * null  = nessun gesto esplicito: la scheda racconta l'auto attiva.
 * ""    = bozza («＋ Aggiungi auto»): la scheda e' di una vettura che non
 *         esiste ancora.
 * uid   = la matita ha aperto QUELLA auto, e il nome scritto nel campo e' il
 *         suo nome — anche cambiato: rinominare non apre un'altra scheda. */
function editingKey() { return state.evEditingUid ?? null; }
function setEditingKey(value) { state.evEditingUid = value; }

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
  return cars.map((car,index)=>[index,uidDi(car),clean(car.name),clean(car.brand),clean(car.icon)].join("~")).join("|");
}
function bindProfileNav(nav) {
  if (nav.dataset.dmEvBound === "true") return;
  nav.dataset.dmEvBound = "true";
  nav.addEventListener("click", (event) => {
    const button = event.target?.closest?.(".dm-vehicle-profile-card[data-vehicle-index]");
    if (!button || !nav.contains(button)) return;
    /* Il tab porta la CHIAVE dell'auto e l'indice si risolve adesso,
     * sull'elenco di adesso: fra il disegno e il tocco la lista puo' essere
     * cambiata (una cancellazione, un riordino) e un indice fotografato
     * avrebbe aperto la vettura sbagliata. */
    const key = clean(button.dataset.vehicleKey);
    const risolto = key ? vehicleIndex(profiles(), key) : -1;
    const index = risolto >= 0 ? risolto : Number.parseInt(button.dataset.vehicleIndex, 10);
    if (Number.isFinite(index) && index >= 0) chooseProfile(index);
  });
}
function buildProfileButtons(nav, cars) {
  nav.innerHTML = cars.map((car,index)=>`<button type="button" class="dm-vehicle-profile-card" data-vehicle-index="${index}" data-vehicle-key="${esc(uidDi(car))}"><span class="dm-vehicle-profile-icon">${vehicleProfileVisual(car)}</span><span class="dm-vehicle-profile-copy"><strong>${esc(car.name || `${t("Auto","Vehicle")} ${index+1}`)}</strong><small></small></span><span class="dm-vehicle-profile-check" aria-hidden="true"></span></button>`).join("");
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
/* Le auto che la sezione mostra: quelle accese. Spenta e' spenta — resta in
 * configurazione, con tutto quello che ha, ma fuori dalle linguette. */
export function carsShownInSection(cars = profiles()) {
  const elenco = Array.isArray(cars) ? cars : [];
  const accese = elenco.filter((car) => car?.enabled !== false);
  /* Tutte spente e' quasi sempre una distrazione: meglio mostrarle tutte che
   * lasciare la sezione muta senza spiegare perche'. */
  return accese.length ? accese : elenco;
}

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
  const visibili = carsShownInSection(cars);
  const popup = popupSelectorHost();
  if (popup) paintSelector(popup, visibili);
  const host = nativeHost(); if (!host) return false;
  host.classList.add("dm-vehicle-profile-host");
  const select = nativeSelect(); if (select) { select.classList.add("dm-vehicle-native-select"); select.setAttribute("aria-hidden","true"); select.tabIndex=-1; }
  return paintSelector(host, visibili);
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
   * auto attiva, nessun salvataggio. E con la matita aperta si scrive su
   * QUELLA auto, non su quella in uso: e' la stessa che il pannello legge e
   * che il titolo dichiara. */
  const posizione = vehiclePhotoTargetIndex(cars);
  if (posizione < 0) return false;
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
  salvaAuto(aggiornate);
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
  salvaAuto(aggiornate);
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
      // Cambiare auto chiude la seduta di scrittura: i campi raccontano lei.
      refToccati().clear();
      setEditingKey(uidDi(car));
      // Applicare non e' un mandato di rinomina: quello lo da' solo la matita.
      state.evRenameArmed = false;
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
  /* Salvare un profilo lo scrive questa sezione, non il runtime.
   *
   * `edEvCarAdd` del runtime vendorizzato cercava un profilo con lo stesso nome
   * e ci scriveva sopra un oggetto nuovo di zecca: `{ name, ov, img }`. Tutto
   * il resto se ne andava senza che nessuno l'avesse chiesto — la marca scelta
   * nella Personalizzazione, il modello, la foto col cavo attaccato, la chiave.
   *
   * Per anni ci si e' difesi cosi': lo si lasciava scrivere, si guardava
   * com'erano le auto prima, e dopo si rimetteva a ciascuna quello che le
   * apparteneva. Centotrentacinque righe per riparare i danni di una chiamata,
   * piu' un modulo intero (`vehicle-identity`) che diceva cosa rimettere. Ogni
   * volta che il runtime imparava un modo nuovo di rompere, l'argine cresceva.
   *
   * Adesso non lo si chiama piu'. Il salvataggio e' qui, e passa da
   * `salvaAuto`: si legge la mappatura dalle caselle — quello il runtime lo sa
   * fare, ed e' l'unica cosa che gli si chiede ancora — e si scrive l'auto
   * giusta. Non c'e' niente da rimettere perche' non si toglie niente.
   */
  if (typeof root.edEvCarAdd === "function" && !root.edEvCarAdd.__dmEvSection) {
    const previous = root.edEvCarAdd;
    function addProfile() {
      const elenco = profiles();
      const nomeScritto = clean(doc?.getElementById("ed-evcar-name")?.value);
      const chiaveSessione = editingKey();
      /* La sessione ESPLICITA (matita, applica) dice CHI si sta salvando.
       * Senza un gesto, la scheda si comporta come sempre: il nome dell'auto
       * in uso la risalva, un nome nuovo crea una vettura nuova. */
      const sessioneEsplicita = chiaveSessione
        ? elenco.find((car) => uidDi(car) === chiaveSessione) || null
        : null;
      const sessione =
        sessioneEsplicita || (chiaveSessione === "" ? null : activeVehicle(elenco) || null);

      /* Un nome che appartiene a UN'ALTRA auto non si salva: era il gesto da
       * cui una vettura si prendeva i dati dell'altra. */
      const omonima = nomeScritto
        ? elenco.find(
            (car) => clean(car?.name) === nomeScritto && (!sessione || uidDi(car) !== uidDi(sessione)),
          )
        : null;
      if (omonima) {
        const avviso = t(
          `Esiste già un'auto "${nomeScritto}": usa la matita per modificarla, o scegli un altro nome`,
          `A car named "${nomeScritto}" already exists: use the pencil to edit it, or pick another name`,
        );
        try { root.edToast?.(avviso); } catch (_error) {}
        return undefined;
      }

      /* La mappatura delle entita' la raccoglie il runtime dalle caselle: e'
       * l'unica cosa che gli si chiede ancora, e la sa fare. Restituisce anche
       * una foto — quella delle due caselle piatte, che parlano dell'auto in
       * uso — e quella si butta: le foto di un'auto si scelgono dal suo
       * pannello, non si ereditano da chi era in mostra. */
      let mappatura = {};
      try { mappatura = root.cdEvCaptureProfile?.()?.ov || {}; } catch (_error) {}

      /* La scelta viva di marca e modello si legge ORA: il ridisegno smonta la
       * card Brand, e a cose fatte le tendine non ci sono piu'. */
      const pannello = doc?.querySelector?.("#ed-body [data-ev-appearance]");
      const marcaViva = clean(pannello?.querySelector?.("select[data-brand]")?.value);
      const modelloVivo = clean(pannello?.querySelector?.("select[data-model]")?.value);

      /* Chi si sta salvando.
       *
       * Comanda il NOME scritto, non la sessione: dopo aver salvato «Zoe» la
       * scheda resta aperta su Zoe, e scrivendoci sopra «Tesla» si vuole una
       * seconda auto — non Zoe travestita. Mettendo la sessione davanti, la
       * seconda vettura non nasceva mai e la prima si prendeva le sue entita'.
       *
       * Quindi: il nome scritto sceglie l'auto che gia' lo porta; un nome nuovo
       * ne fa nascere una, tranne quando la matita ha armato una rinomina — e
       * allora quel nome e' il nome nuovo di quella che si stava modificando.
       * Senza nome scritto si risalva quella in uso, com'e' sempre stato. */
      const perNome = nomeScritto
        ? elenco.find((car) => clean(car?.name) === nomeScritto) || null
        : null;
      const bersaglio =
        perNome ||
        (sessioneEsplicita && state.evRenameArmed && nomeScritto ? sessioneEsplicita : null) ||
        (nomeScritto ? null : chiaveSessione === "" ? null : sessione);

      const rinomina =
        sessioneEsplicita && state.evRenameArmed && nomeScritto ? { name: nomeScritto } : {};
      const vestito = marcaViva ? { brand: marcaViva, ...(modelloVivo ? { model: modelloVivo } : {}) } : {};

      let rimesse;
      let salvata;
      if (bersaglio) {
        const patch = {
          [VEHICLE_OVERRIDES_FIELD]: mappatura,
          ...rinomina,
          /* Marca e modello si scrivono solo se l'auto non ne ha gia': la
           * tendina mostra quella in mostra, e non deve vestirne un'altra. */
          ...(clean(bersaglio.brand) ? {} : vestito),
        };
        rimesse = salvaAuto(updateVehicle(elenco, uidDi(bersaglio), patch));
        salvata = rimesse.find((car) => uidDi(car) === uidDi(bersaglio)) || null;
      } else {
        /* Un'auto nuova nasce senza foto e senza eredita': quello che c'era
         * nelle caselle era di chi era in mostra, non suo. */
        const nata = {
          ...nuovoVeicolo(elenco, nomeScritto, letturaMetadata()),
          [VEHICLE_OVERRIDES_FIELD]: mappatura,
          ...vestito,
        };
        rimesse = salvaAuto([...elenco, nata]);
        salvata = rimesse.find((car) => uidDi(car) === nata[VEHICLE_KEY_FIELD]) || null;
      }

      // Scheda salvata: la seduta di scrittura e' chiusa e i segni si azzerano.
      refToccati().clear();
      state.evRenameArmed = false;
      /* La scheda resta aperta su QUELLA auto: quella appena salvata se e' nata
       * adesso, quella che si stava modificando altrimenti. */
      if (salvata) setEditingKey(uidDi(salvata));

      /* Salvare non cambia l'auto che si vede — tranne la primissima, che
       * diventa lei quella in uso perche' prima non c'era niente. */
      if (elenco.length === 0 && salvata) {
        const posto = vehicleIndex(rimesse, uidDi(salvata));
        if (posto >= 0) rimettiInUso(salvata, posto);
      }
      root.dmRenderVehicleSelector?.();
      root.render?.();
      root.queueMicrotask?.(scheduleEvSyncSettled);
      return undefined;
    }
    addProfile.__dmEvSection = true;
    addProfile.__dmPrevious = previous;
    root.edEvCarAdd = addProfile;
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
  const run=()=>{state.frame=0;installLegacyWrappers();renderVehicleSelector();applyVehicleAsset();ensureVehiclePhotoEditor();ensureCarNameGuard();ensureCarListDecor();};
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
#ed-body .dm-ev-enabled{
  flex:0 0 42px;width:42px;height:24px;position:relative;margin-right:8px;border:0;border-radius:999px;
  cursor:pointer;background:color-mix(in srgb,var(--text-dim,#94a3b8) 32%,transparent);
  transition:background .25s ease}
#ed-body .dm-ev-enabled i{
  position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;
  box-shadow:0 2px 6px rgba(15,23,42,.25);transition:transform .25s cubic-bezier(.16,1,.3,1)}
#ed-body .dm-ev-enabled[data-on="true"]{background:#059669}
#ed-body .dm-ev-enabled[data-on="true"] i{transform:translateX(18px)}
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
  root.dmRenderVehicleSelector=renderVehicleSelector; installStyles(); installSlotTouchTracker(); installLegacyWrappers(); bindEditorEntryPoints();
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
