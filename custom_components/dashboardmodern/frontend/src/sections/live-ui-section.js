import {
  allStates,
  clean,
  doc,
  readJson,
  root,
  section,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_LIVE_UI_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  previousCameraRefresh: null,
  cameraUrls: new Map(),
  cameraTimer: 0,
  building: false,
});

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

export function configuredLightIds() {
  const named = Object.keys(readJson("cd_luci", {}));
  const extra = readJson("cd_gruppi_extra", {});
  const removed = new Set(readJson("cd_gruppi_removed", {})?.luci || []);
  return unique([...(extra?.luci || []), ...named]).filter((id) => !removed.has(id));
}

export function lightIsOn(entityId, states = allStates()) {
  const value = clean(states?.[entityId]?.state).toLowerCase();
  return ["on", "open", "opening", "home", "active"].includes(value);
}

export function activeLightIds(states = allStates()) {
  return configuredLightIds().filter((id) => lightIsOn(id, states));
}

function configuredCameras() {
  const canonical = section("cameras", []);
  const legacy = readJson("cd_cameras", []);
  const values = Array.isArray(canonical) && canonical.length ? canonical : legacy;
  return (Array.isArray(values) ? values : [])
    .map((camera, index) => ({
      ...camera,
      index,
      entity: clean(camera?.entity || camera?.camera_entity || camera?.cam),
    }))
    .filter((camera) => camera.entity);
}

function eventEntityIds(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

export function liveUiEventTargets(event) {
  const changed = eventEntityIds(event);
  if (!changed.size) return Object.freeze({ lights: false, cameras: false });
  const lights = configuredLightIds();
  const cameras = configuredCameras().map((camera) => camera.entity);
  return Object.freeze({
    lights: lights.some((id) => changed.has(id)),
    cameras: cameras.some((id) => changed.has(id)),
  });
}

export function syncLightsAlert() {
  if (!doc) return 0;
  const active = activeLightIds();
  const card = doc.getElementById("glance-luci");
  const value = doc.getElementById("g-val-luci");
  if (value) value.textContent = String(active.length);
  if (card) {
    card.style.display = active.length ? "" : "none";
    card.hidden = active.length === 0;
    card.dataset.dmLiveCount = String(active.length);
  }
  return active.length;
}

function syncOpenLightsPopup() {
  try {
    root.updateGestioneLuci?.();
  } catch (error) {
    root.console?.warn?.("[DashboardModern] live lights popup update", error);
  }
}

function cameraSlug(camera) {
  const suffix = camera.entity.includes(".") ? camera.entity.split(".")[1] : `x${camera.index}`;
  return `cam-${suffix}`;
}

function cacheBusted(path) {
  const raw = clean(path);
  if (!raw) return "";
  try {
    const url = new URL(raw, doc?.baseURI || root.location?.href || "http://dashboardmodern.invalid/");
    url.searchParams.set("dm_t", String(Date.now()));
    return url.href;
  } catch (_error) {
    const separator = raw.includes("?") ? "&" : "?";
    return `${raw}${separator}dm_t=${Date.now()}`;
  }
}

function authToken() {
  const values = [
    root.DASHBOARDMODERN_AUTH_TOKEN,
    root.__DASHBOARDMODERN_REAL_TOKEN__,
    root.LONG_LIVED_TOKEN,
    root.HA_TOKEN,
  ];
  try {
    const connection = readJson("cd_connection", {});
    values.push(connection.token, connection.access_token);
  } catch (_error) {}
  return values.map(clean).find((value) => value && value !== "__dashboardmodern_hosted__") || "";
}

function replaceCameraObjectUrl(chiave, nextUrl, registry = state.cameraUrls) {
  const previous = registry.get(chiave);
  if (previous && previous !== nextUrl && previous.startsWith("blob:")) {
    try {
      root.URL?.revokeObjectURL?.(previous);
    } catch (_error) {}
  }
  registry.set(chiave, nextUrl);
}

/* Il registro degli URL si tiene per IMMAGINE, non per telecamera.
 *
 * La stessa inquadratura sta a schermo in due posti nello stesso momento: la
 * miniatura nella tessera della Home e quella grande dentro il popup che ci si
 * apre sopra. Con un registro per telecamera le due si davano il cambio sulla
 * stessa casella: la seconda che finiva di scaricare revocava il blob della
 * prima — che pero' era ancora appeso al suo <img> — e quel riquadro diventava
 * nero. Al giro dopo toccava all'altra, e cosi' via: e' il «refresh continuo e
 * schermo nero» che si vedeva solo da quando il dettaglio e' passato nel
 * popup, cioe' da quando le immagini sono diventate due.
 *
 * Ogni <img> si porta la sua chiave, e revoca soltanto quello che stava
 * mostrando lei. */
let contatoreImmagini = 0;

/* Le chiavi di immagini che non ci sono piu' si restituiscono.
 *
 * Tenere il registro per immagine risolve il fotogramma nero, ma sposta un
 * problema: quando un muro di telecamere si rifa' da capo — una telecamera
 * aggiunta, una tolta — i vecchi elementi spariscono e i nuovi prendono chiavi
 * nuove. Le voci vecchie non venivano piu' toccate da nessuno, e i loro blob
 * restavano in memoria per tutta la vita della pagina. Prima di scrivere la
 * chiave nuova si fa un giro: quello che non e' piu' nel documento si revoca. */
/* La spazzata costa un `querySelector` per voce, e girava per OGNI immagine:
 * con sei telecamere erano trentasei interrogazioni del documento a ogni
 * giro. Le voci morte non nascono a raffica — nascono quando il muro si rifa'
 * — quindi basta passare ogni tanto. */
let ultimaSpazzata = 0;
const SPAZZATA_OGNI_MS = 5000;

function ripulisciChiaviMorte(registry, adesso = Date.now()) {
  if (adesso - ultimaSpazzata < SPAZZATA_OGNI_MS) return false;
  ultimaSpazzata = adesso;
  for (const [chiave, url] of [...registry.entries()]) {
    if (!chiave.includes("#")) continue;
    if (doc?.querySelector?.(`[data-dm-camera-key="${CSS.escape(chiave)}"]`)) continue;
    if (typeof url === "string" && url.startsWith("blob:")) {
      try {
        root.URL?.revokeObjectURL?.(url);
      } catch (_error) {}
    }
    registry.delete(chiave);
  }
  return true;
}

function chiaveImmagine(image, entity) {
  if (!image.dataset.dmCameraKey) {
    contatoreImmagini += 1;
    image.dataset.dmCameraKey = `${entity}#${contatoreImmagini}`;
  }
  return image.dataset.dmCameraKey;
}

/* Un fotogramma su UNA immagine, di chiunque sia l'immagine.
 *
 * Il muro della Sicurezza e la tessera delle telecamere in Home mostrano le
 * stesse inquadrature: l'autenticazione, il cache-busting e la contabilita'
 * degli object URL stanno qui una volta sola. Ogni chiamante porta il SUO
 * registro degli URL: revocare il blob dell'altro mentre e' ancora sullo
 * schermo lo farebbe diventare un rettangolo grigio. */
export async function loadCameraFrame(camera, image, registry = state.cameraUrls) {
  if (!image) return false;
  const current = allStates()?.[camera.entity];
  const picture = clean(current?.attributes?.entity_picture);
  if (!picture) {
    image.dataset.dmCameraState = "unavailable";
    return false;
  }

  const url = cacheBusted(picture);
  const chiave = chiaveImmagine(image, camera.entity);
  ripulisciChiaviMorte(registry);
  const stessaTelecamera = image.dataset.dmCameraEntity === camera.entity;
  image.dataset.dmCameraEntity = camera.entity;
  /* Il fotogramma di prima resta a schermo finche' non arriva quello nuovo.
   *
   * Qui si dichiarava «loading» a ogni giro, e il foglio di stile porta a zero
   * l'opacita' di un'immagine che non e' pronta: sopra un fondo quasi nero,
   * ogni aggiornamento diventava un lampo di buio e poi l'immagine — «va in
   * continuo refresh nero e poi immagine». Una telecamera che sta gia'
   * mostrando qualcosa continua a mostrarlo mentre si scarica il seguito. */
  if (!stessaTelecamera || image.dataset.dmCameraState !== "ready")
    image.dataset.dmCameraState = "loading";

  // entity_picture normally carries its own camera token. Use the current
  // dashboard origin instead of the legacy HA_HTTP_URL so hosted/Nabu Casa
  // dashboards cannot accidentally request a different host.
  const token = authToken();
  if (typeof root.fetch === "function" && token) {
    try {
      const response = await root.fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = root.URL?.createObjectURL?.(blob);
        if (objectUrl) {
          replaceCameraObjectUrl(chiave, objectUrl, registry);
          image.src = objectUrl;
          image.dataset.dmCameraState = "ready";
          return true;
        }
      }
    } catch (_error) {}
  }

  image.onload = () => {
    image.dataset.dmCameraState = "ready";
  };
  image.onerror = () => {
    image.dataset.dmCameraState = "unavailable";
  };
  replaceCameraObjectUrl(chiave, url, registry);
  image.src = url;
  return true;
}

function loadCameraImage(camera) {
  return loadCameraFrame(camera, doc?.getElementById(cameraSlug(camera)));
}

function securityVisible() {
  return Boolean(doc?.getElementById("page-security")?.classList.contains("active"));
}

export async function refreshCameraThumbnails({ force = false } = {}) {
  if (!doc || (!force && !securityVisible())) return false;
  const cameras = configuredCameras();
  if (!cameras.length) return false;
  const grid = doc.getElementById("cam-grid");
  if (grid && !grid.querySelector(".cam-card") && typeof root.buildCamCards === "function") {
    // Reentrancy guard: the wall owner calls back here as soon as it has built
    // its cards, and building them from inside that call would loop.
    if (!state.building) {
      state.building = true;
      try {
        root.buildCamCards();
      } finally {
        state.building = false;
      }
    }
  }
  await Promise.all(cameras.map(loadCameraImage));
  // However the page was reached — a tab, a card, a restored session — asking
  // for frames is also what arms the timer that keeps them coming.
  syncCameraTimer();
  return true;
}

/* A camera frame is a still picture fetched over and over: nothing in Home
 * Assistant pushes a new one, and the entity state stays "idle" while the view
 * changes completely. Losing the legacy 4s timer therefore left the wall on
 * whatever frame happened to load first — and on a wall rebuilt right after
 * that first load, on no frame at all, which is a grid of black rectangles.
 *
 * The timer is back, but only while the Sicurezza page is actually on screen:
 * off it, and on a hidden tab, nothing is fetched. */
const CAMERA_REFRESH_MS = 4000;

function stopCameraTimer() {
  if (!state.cameraTimer) return;
  root.clearInterval?.(state.cameraTimer);
  state.cameraTimer = 0;
}

export function syncCameraTimer() {
  const wanted = securityVisible() && doc?.visibilityState !== "hidden" && configuredCameras().length > 0;
  if (!wanted) {
    stopCameraTimer();
    return false;
  }
  if (state.cameraTimer) return true;
  state.cameraTimer =
    root.setInterval?.(() => {
      if (!securityVisible() || doc?.visibilityState === "hidden") {
        stopCameraTimer();
        return;
      }
      refreshCameraThumbnails();
    }, CAMERA_REFRESH_MS) || 0;
  return Boolean(state.cameraTimer);
}

function installCameraOwner() {
  // The legacy timer refreshed every camera every 4s whatever page was open and
  // whatever the tab was doing. Ours is armed by visibility instead.
  if (root.camInterval) {
    root.clearInterval?.(root.camInterval);
    root.camInterval = null;
  }
  const current = root.refreshCameras;
  if (typeof current === "function" && !current.__dmLiveUiCameraOwner) {
    state.previousCameraRefresh ||= current;
    function refreshCamerasCanonical() {
      return refreshCameraThumbnails({ force: true });
    }
    refreshCamerasCanonical.__dmLiveUiCameraOwner = true;
    refreshCamerasCanonical.__dmPrevious = current;
    root.refreshCameras = refreshCamerasCanonical;
  }
  return typeof root.refreshCameras === "function";
}

function syncVisibleLiveUi() {
  state.frame = 0;
  syncLightsAlert();
  syncOpenLightsPopup();
  syncCameraTimer();
  if (securityVisible()) refreshCameraThumbnails();
}

export function scheduleLiveUiSync() {
  if (state.frame) return;
  const run = () => syncVisibleLiveUi();
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

export function installLiveUiSection() {
  if (!doc) return;
  installCameraOwner();
  scheduleLiveUiSync();
  if (state.installed) return;
  state.installed = true;

  for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready", "pageshow"]) {
    root.addEventListener?.(eventName, () => {
      installCameraOwner();
      scheduleLiveUiSync();
    });
  }

  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    const targets = liveUiEventTargets(event);
    if (targets.lights) {
      syncLightsAlert();
      syncOpenLightsPopup();
    }
    if (targets.cameras && securityVisible()) refreshCameraThumbnails();
  });

  doc.addEventListener("visibilitychange", () => {
    syncCameraTimer();
    if (doc.visibilityState === "visible" && securityVisible()) refreshCameraThumbnails();
  });

  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="security"]')) {
        // The wall owner rebuilds its cards on the same click, and a frame
        // written into an <img> that is about to be replaced is a frame lost —
        // which is what left every camera black. The refresh is scheduled after
        // that rebuild, and the wall asks for one itself whenever it rebuilds.
        root.setTimeout?.(() => {
          installCameraOwner();
          syncCameraTimer();
          refreshCameraThumbnails({ force: true });
        }, 0);
      }
      if (event.target?.closest?.('[data-tab="home"]')) root.queueMicrotask?.(syncLightsAlert);
    },
    true,
  );
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installLiveUiSection, { once: true });
} else {
  installLiveUiSection();
}
