/* DashboardModern 0.15.0 — bounded compatibility helpers. */

export function isGeneratedRoomName(value = "") {
  return /^room[-_][a-z0-9]{6,}$/i.test(String(value).trim());
}

export function inferApplianceEntity(device = {}, states = {}, kind = "energy") {
  const candidates = [
    device[`${kind}_entity`],
    device[`${kind}_today`],
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    ...(device.entities || []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  const expected = kind === "power" ? /^(w|kw)$/i : /^(wh|kwh)$/i;
  const named =
    kind === "power"
      ? /power|potenza|watt/i
      : /energy|energia|kwh|consum|total|totale|mese|month/i;
  return (
    candidates.find((entityId) =>
      expected.test(String(states?.[entityId]?.attributes?.unit_of_measurement || "").trim()),
    ) ||
    candidates.find((entityId) => named.test(entityId)) ||
    ""
  );
}

function installEvImageFallback() {
  const root = globalThis;
  const doc = root.document;
  const key = "__DASHBOARDMODERN_EV_IMAGE_FALLBACK__";
  if (!doc || root[key]?.installed) return;

  const state = (root[key] = { installed: true });
  const ids = new Set(["ev-mod-car-img", "ev-new-car-img"]);
  const style = doc.createElement("style");
  style.id = "dm-ev-image-fallback-0152";
  style.textContent = `
    #ev-mod-car-img[data-ev-failed="1"],
    #ev-new-car-img[data-ev-failed="1"],
    #ev-mod-car-img[data-ev-image-error],
    #ev-new-car-img[data-ev-image-error] {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: min(78vw, 520px) !important;
      min-width: 120px !important;
      height: clamp(90px, 20vw, 210px) !important;
      min-height: 80px !important;
      object-fit: contain !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 260'%3E%3Cpath fill='%2394a3b8' d='M112 174h28l28-72c7-18 24-30 44-30h205c23 0 44 12 56 32l39 70h20c22 0 40 18 40 40v10H80v-10c0-22 14-40 32-40Zm93-68-25 68h274l-35-62c-2-4-7-6-12-6H205Zm-37 132a34 34 0 1 0 68 0 34 34 0 0 0-68 0Zm272 0a34 34 0 1 0 68 0 34 34 0 0 0-68 0Z'/%3E%3C/svg%3E") !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      background-size: contain !important;
    }
  `;
  (doc.head || doc.documentElement).append(style);

  const configuredSource = (image) => {
    const direct = String(image?.getAttribute?.("src") || "").trim();
    if (direct) return direct;
    try {
      const raw = root.localStorage?.getItem("cd_ev_image") || "";
      const parsed = JSON.parse(raw);
      const value = typeof parsed === "string" ? parsed : parsed?.url || parsed?.path || "";
      return String(value).replace(/^\/config\/www\//, "/local/");
    } catch (_error) {
      return "";
    }
  };

  const reveal = (image) => {
    const source = configuredSource(image);
    if (!image || !source) return;
    image.removeAttribute("onerror");
    image.dataset.evFailed = "1";
    image.dataset.evImageError = source;
    image.style.setProperty("display", "block", "important");
    image.style.setProperty("visibility", "visible", "important");
    image.style.setProperty("opacity", "1", "important");
  };

  const arm = () => {
    ids.forEach((id) => doc.getElementById(id)?.removeAttribute("onerror"));
  };

  doc.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (image?.tagName !== "IMG" || !ids.has(image.id)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      reveal(image);
    },
    true,
  );

  doc.addEventListener("DOMContentLoaded", arm, { once: true });
  root.addEventListener?.("dashboardmodern:runtime-ready", arm);
  root.addEventListener?.("pageshow", arm);
  state.arm = arm;
  arm();
}

installEvImageFallback();

// Compatibility flag: the old document-wide MutationObserver and 150 ms interval
// remain intentionally removed.
globalThis.__DASHBOARDMODERN_MOBILE_FOLLOWUP__ = {
  installed: true,
  version: "0.15.2",
  observer: null,
  timer: 0,
};
