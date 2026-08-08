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

function replaceCameraObjectUrl(entity, nextUrl) {
  const previous = state.cameraUrls.get(entity);
  if (previous && previous !== nextUrl && previous.startsWith("blob:")) {
    try {
      root.URL?.revokeObjectURL?.(previous);
    } catch (_error) {}
  }
  state.cameraUrls.set(entity, nextUrl);
}

async function loadCameraImage(camera) {
  const image = doc?.getElementById(cameraSlug(camera));
  if (!image) return false;
  const current = allStates()?.[camera.entity];
  const picture = clean(current?.attributes?.entity_picture);
  if (!picture) {
    image.dataset.dmCameraState = "unavailable";
    return false;
  }

  const url = cacheBusted(picture);
  image.dataset.dmCameraEntity = camera.entity;
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
          replaceCameraObjectUrl(camera.entity, objectUrl);
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
  replaceCameraObjectUrl(camera.entity, url);
  image.src = url;
  return true;
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
    root.buildCamCards();
  }
  await Promise.all(cameras.map(loadCameraImage));
  return true;
}

function installCameraOwner() {
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

  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.('[data-tab="security"]')) {
        root.queueMicrotask?.(() => {
          installCameraOwner();
          refreshCameraThumbnails({ force: true });
        });
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
