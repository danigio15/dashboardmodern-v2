/* Keep configured EV artwork usable even when the local file is temporarily unavailable. */
const root = globalThis;
const doc = root.document;
const KEY = "__DASHBOARDMODERN_EV_IMAGE_FALLBACK__";

if (doc && !root[KEY]?.installed) {
  const state = (root[KEY] = { installed: true, observer: null });
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

  function configuredSource(image) {
    const direct = String(image?.getAttribute("src") || "").trim();
    if (direct) return direct;
    try {
      const raw = root.localStorage?.getItem("cd_ev_image") || "";
      const parsed = JSON.parse(raw);
      const value = typeof parsed === "string" ? parsed : parsed?.url || parsed?.path || "";
      return String(value).replace(/^\/config\/www\//, "/local/");
    } catch (_error) {
      return "";
    }
  }

  function reveal(image, source = configuredSource(image)) {
    if (!image || !source) return;
    image.dataset.evFailed = "1";
    image.dataset.evImageError = source;
    image.style.setProperty("display", "block", "important");
    image.style.setProperty("visibility", "visible", "important");
    image.style.setProperty("opacity", "1", "important");
  }

  function arm(image) {
    if (!(image instanceof root.HTMLImageElement) || !ids.has(image.id)) return;
    image.removeAttribute("onerror");
    if (image.dataset.dmEvFallbackArmed === "1") return;
    image.dataset.dmEvFallbackArmed = "1";
    image.addEventListener(
      "error",
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        reveal(image);
      },
      true,
    );
  }

  function scan() {
    ids.forEach((id) => arm(doc.getElementById(id)));
  }

  doc.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof root.HTMLImageElement) || !ids.has(image.id)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      image.removeAttribute("onerror");
      reveal(image);
    },
    true,
  );

  state.observer = new MutationObserver(scan);
  state.observer.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["onerror"],
  });
  doc.addEventListener("DOMContentLoaded", scan, { once: true });
  root.addEventListener?.("dashboardmodern:runtime-ready", scan);
  root.addEventListener?.("pageshow", scan);
  scan();
}
