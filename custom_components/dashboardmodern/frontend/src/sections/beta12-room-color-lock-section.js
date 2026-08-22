// DM-FIX-20260817A
import { clean, doc, installStyle, root, t } from "./shared.js";

// Beta18: all room/action icons are owned by icon-engine-section. This historical
// module keeps only the kiosk contract; it must never observe or repaint icon DOM.
//
// Beta30.6: the kiosk used to require a hand written ?kiosk=1 on the URL. Nobody
// can type a query string inside the Home Assistant companion app, so on a real
// iPhone the plancia always rendered under the Lovelace toolbar. The contract is
// now: an explicit request always wins, the last explicit choice is remembered,
// and a phone that hosts the plancia inside Home Assistant starts in kiosk.
//
// Il chiosco era nato guardando l'iPhone e chiedeva iOS per accendersi da solo.
// Su Android il problema e' lo stesso — dentro l'app di Home Assistant non c'e'
// barra degli indirizzi dove scrivere ?kiosk=1 — ma non si accendeva mai, e
// restava solo il dito tenuto premuto sull'hamburger, che bisognava scoprire.
// Adesso conta il dito, non la marca.
const KEY = "__DASHBOARDMODERN_BETA12_FINAL_LOCK__";
const KIOSK_ATTR = "data-dm-ios-kiosk";
const KIOSK_STORE_KEY = "dm_kiosk";
const KIOSK_KEYS = ["kiosk", "dm_kiosk"];
const KIOSK_OFF_VALUES = ["0", "false", "off", "no"];
const KIOSK_Z_INDEX = "2147483000";
const NARROW_VIEWPORT = "(max-width: 870px)";
const LONG_PRESS_MS = 650;
// A fixed overlay resolves against the closest ancestor that owns a containing
// block. Home Assistant paints some surfaces through these properties, and any
// of them would pin the plancia inside the panel box instead of over the app.
const TRAP_PROPERTIES = Object.freeze([
  "transform",
  "filter",
  "backdrop-filter",
  "perspective",
  "contain",
  "will-change",
]);

const state = (root[KEY] ||= {
  listeners: false,
  gestureBound: false,
  kioskViewportBound: false,
});
state.active ||= false;
state.override ??= null;
state.kioskHost ||= null;
state.kioskHostCss ||= [];
state.kioskFrame ||= null;
state.kioskFrameCss ||= [];
state.ancestors ||= [];
state.scrollLock ||= [];
state.drawer ||= null;
state.drawerFrame ||= null;
state.drawerBound ||= false;

export function isIosDevice(nav = root.navigator) {
  const ua = clean(nav?.userAgent);
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return clean(nav?.platform) === "MacIntel" && Number(nav?.maxTouchPoints || 0) > 1;
}

/* Il dito: e' questo che separa un telefono da una finestra stretta col mouse.
 *
 * Non basta chiedere `maxTouchPoints`. La plancia decide da dentro la sua
 * cornice, e li' quel numero non e' sempre quello del dispositivo: dove tornava
 * zero il chiosco non partiva su un telefono che il dito ce l'ha. Si chiede in
 * tre modi, e ne basta uno; l'ultimo — "il puntatore e' grosso" — e' proprio la
 * domanda che vogliamo fare: comanda un dito o comanda un mouse. */
export function isTouchDevice(nav = root.navigator, view = root) {
  if (Number(nav?.maxTouchPoints || 0) > 0) return true;
  try {
    if (view && "ontouchstart" in view) return true;
  } catch (_error) {}
  try {
    return Boolean(view?.matchMedia?.("(pointer: coarse)")?.matches);
  } catch (_error) {
    return false;
  }
}

function booleanFromValue(value) {
  return !KIOSK_OFF_VALUES.includes(clean(value).toLowerCase());
}

export function kioskValueFromLocation(locationLike) {
  if (!locationLike) return null;
  try {
    const params = new URLSearchParams(locationLike.search || "");
    for (const key of KIOSK_KEYS) {
      if (params.has(key)) return booleanFromValue(params.get(key));
    }
    const hash = clean(locationLike.hash).replace(/^#/, "");
    if (hash.includes("=")) {
      const hashParams = new URLSearchParams(hash.includes("?") ? hash.split("?").pop() : hash);
      for (const key of KIOSK_KEYS) {
        if (hashParams.has(key)) return booleanFromValue(hashParams.get(key));
      }
    }
  } catch (_error) {}
  return null;
}

/** The explicit request carried by this load, or null when there is none. */
export function explicitKioskRequest(candidates = [root.parent, root]) {
  for (const candidate of candidates) {
    try {
      const value = kioskValueFromLocation(candidate?.location);
      if (value !== null) return value;
    } catch (_error) {}
  }
  return null;
}

export function readStoredKiosk(storage = root.localStorage) {
  try {
    const raw = storage?.getItem?.(KIOSK_STORE_KEY);
    if (raw === null || raw === undefined || clean(raw) === "") return null;
    return booleanFromValue(raw);
  } catch (_error) {
    return null;
  }
}

export function writeStoredKiosk(value, storage = root.localStorage) {
  try {
    storage?.setItem?.(KIOSK_STORE_KEY, value ? "1" : "0");
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Resolve the kiosk mode without touching the DOM.
 *
 * `override` is the in-session choice (long press on the plancia hamburger) and
 * outranks everything, so the gesture keeps working on a URL that still carries
 * ?kiosk=1.
 *
 * Senza una scelta esplicita parte a tutto schermo uno schermo da telefono che
 * tiene la plancia dentro Home Assistant. Il telefono, non l'iPhone: la ragione
 * per cui era nato — dentro l'app di Home Assistant nessuno puo' scrivere
 * ?kiosk=1 a mano, e la plancia si ritrovava sotto la barra di Lovelace — su
 * Android e' identica, ma li' il chiosco non si accendeva mai da solo e
 * bisognava scoprire il dito tenuto premuto sull'hamburger. Adesso conta il
 * dito, non la marca: cosi' resta fuori la finestra stretta di un computer, che
 * la barra degli indirizzi ce l'ha eccome.
 *
 * Una plancia installata come app a se' — "aggiungi alla schermata Home" su
 * iOS, una PWA altrove — non ha barra degli indirizzi da nessuna parte, e parte
 * a tutto schermo anche su uno schermo largo, che e' il caso dell'iPad.
 */
export function resolveKioskMode({
  override = null,
  explicit = null,
  stored = null,
  ios = false,
  touch = false,
  hosted = false,
  standalone = false,
  narrow = false,
} = {}) {
  if (override !== null && override !== undefined) return Boolean(override);
  if (explicit !== null && explicit !== undefined) return Boolean(explicit);
  if (stored !== null && stored !== undefined) return Boolean(stored);
  // Un iPhone o un iPad hanno sempre il dito: la regola di prima resta dentro
  // questa, senza eccezioni da ricordare.
  const dito = Boolean(touch || ios);
  if (dito && hosted && narrow) return true;
  return Boolean(standalone && (ios || (dito && narrow)));
}

function parentWindow() {
  try {
    const parent = root.parent;
    if (parent && parent !== root && parent.document) return parent;
  } catch (_error) {}
  return null;
}

function ownerWindow() {
  return parentWindow() || root;
}

export function hostedContext() {
  if (root.__DASHBOARDMODERN_HOSTED__ === true) return true;
  try {
    if (root.frameElement) return true;
  } catch (_error) {
    // A cross origin frameElement still means the plancia is hosted.
    return true;
  }
  return Boolean(parentWindow());
}

function standaloneDisplay() {
  if (root.navigator?.standalone === true) return true;
  try {
    return Boolean(root.matchMedia?.("(display-mode: standalone)")?.matches);
  } catch (_error) {
    return false;
  }
}

function narrowViewport() {
  // The hosting Home Assistant page is the only window that sees the real
  // device width: a frame ignores the viewport meta and can report a legacy
  // 980px layout instead of the phone it is painted on.
  for (const view of [ownerWindow(), root]) {
    try {
      const query = view?.matchMedia?.(NARROW_VIEWPORT);
      if (query) return Boolean(query.matches);
    } catch (_error) {}
  }
  return false;
}

function kioskEnabled() {
  const explicit = explicitKioskRequest();
  // A link opened with ?kiosk=0/1 is also the user's new default: the companion
  // app reopens the plancia without any query string.
  if (explicit !== null && readStoredKiosk() !== explicit) writeStoredKiosk(explicit);
  return resolveKioskMode({
    override: state.override,
    explicit,
    stored: readStoredKiosk(),
    ios: isIosDevice(),
    touch: isTouchDevice(),
    hosted: hostedContext(),
    standalone: standaloneDisplay(),
    narrow: narrowViewport(),
  });
}

function hostForFrame() {
  try {
    const frame = root.frameElement;
    const tree = frame?.getRootNode?.();
    const host = tree?.host;
    return { frame: frame || null, host: host || null };
  } catch (_error) {
    return { frame: null, host: null };
  }
}

function viewportHeightValue(height) {
  // The measured viewport is authoritative: dvh keeps the iOS toolbar space
  // reserved inside the Home Assistant WebView and leaves a dead band.
  return height > 300 ? `${height}px` : "100dvh";
}

function updateKioskViewport() {
  const target = ownerWindow();
  const viewport = target.visualViewport;
  const height = Math.max(1, Math.round(viewport?.height || target.innerHeight || 0));
  const width = Math.max(1, Math.round(viewport?.width || target.innerWidth || 0));
  doc?.documentElement?.style?.setProperty?.("--dm-ios-kiosk-height", `${height}px`);
  doc?.documentElement?.style?.setProperty?.("--dm-ios-kiosk-width", `${width}px`);
  if (state.active && state.kioskHost?.style) {
    const value = viewportHeightValue(height);
    for (const property of ["height", "min-height", "max-height"]) {
      state.kioskHost.style.setProperty(property, value, "important");
    }
  }
  return { height, width };
}

/* Si rimette a posto quello che si e' toccato, non tutto il resto.
 *
 * Il velo del chiosco scriveva `overflow` sul documento di Home Assistant e
 * poi, per togliersi, riassegnava `style.cssText` a com'era prima. Ma
 * `cssText` non e' una proprieta': e' **tutte** le dichiarazioni in linea di
 * quell'elemento. E Home Assistant il tema ce lo tiene esattamente li' —
 * `applyThemesOnElement(document.documentElement, ...)` scrive ogni variabile
 * del tema come stile in linea su `<html>` e si ricorda di averlo fatto in
 * `element.__themes`. Riassegnare `cssText` gliele cancellava tutte insieme, e
 * lui non poteva accorgersene: per lui il tema era ancora applicato, quindi
 * non lo riscriveva. Home Assistant restava senza colori — bianco — finche'
 * non si chiudeva e riapriva l'app.
 *
 * Da qui in avanti si segna proprieta' per proprieta' cosa c'era prima, e si
 * rimette solo quella. Quello che scrive qualcun altro sullo stesso elemento
 * non viene nemmeno sfiorato. */
function ricordaEScrivi(element, dichiarazioni) {
  const prima = [];
  for (const [nome, valore, priorita] of dichiarazioni) {
    prima.push({
      nome,
      valore: element.style.getPropertyValue(nome),
      priorita: element.style.getPropertyPriority(nome),
    });
    element.style.setProperty(nome, valore, priorita || "");
  }
  return prima;
}

function rimetti(element, prima = []) {
  if (!element?.style) return;
  for (const { nome, valore, priorita } of prima) {
    if (valore) element.style.setProperty(nome, valore, priorita || "");
    else element.style.removeProperty(nome);
  }
}

/** Whether a computed value turns an ancestor into a containing block. */
export function trapsFixedPosition(property, value) {
  if (!TRAP_PROPERTIES.includes(property)) return false;
  const normalized = clean(value).toLowerCase();
  if (!normalized || ["none", "auto", "normal"].includes(normalized)) return false;
  if (property === "contain") return /strict|content|paint|layout/.test(normalized);
  if (property === "will-change") return /transform|filter|perspective|contain/.test(normalized);
  return true;
}

/**
 * The inline declaration that lifts the plancia over the Home Assistant chrome.
 * While the native sidebar is open the overlay steps down instead of swallowing
 * it: the drawer lives outside the panel subtree with a small z-index.
 */
export function kioskHostStyles({ height = 0, drawerOpen = false } = {}) {
  const viewport = viewportHeightValue(height);
  return {
    position: "fixed",
    inset: "0",
    "z-index": drawerOpen ? "1" : KIOSK_Z_INDEX,
    width: "100%",
    "max-width": "100%",
    height: viewport,
    "min-height": viewport,
    "max-height": viewport,
    margin: "0",
    padding: "0",
    background: "var(--primary-background-color,#f8fafc)",
    overflow: "hidden",
  };
}

/** Drop every containing block between the plancia host and the app root. */
function releaseAncestors(host) {
  if (host && state.ancestorHost === host) return;
  restoreAncestors();
  const view = ownerWindow();
  if (!host || typeof view.getComputedStyle !== "function") return;
  state.ancestorHost = host;
  let node = host.parentNode || null;
  const touched = [];
  while (node && touched.length < 40) {
    if (node.nodeType === 11) {
      node = node.host || null;
      continue;
    }
    if (node.nodeType !== 1) break;
    let computed = null;
    try {
      computed = view.getComputedStyle(node);
    } catch (_error) {}
    if (
      computed &&
      TRAP_PROPERTIES.some((property) =>
        trapsFixedPosition(property, computed.getPropertyValue(property)),
      )
    ) {
      touched.push({
        element: node,
        prima: ricordaEScrivi(
          node,
          TRAP_PROPERTIES.map((property) => [
            property,
            property === "will-change" ? "auto" : "none",
            "important",
          ]),
        ),
      });
    }
    node = node.parentNode;
  }
  state.ancestors = touched;
}

function restoreAncestors() {
  for (const entry of state.ancestors) {
    rimetti(entry?.element, entry?.prima);
  }
  state.ancestors = [];
  state.ancestorHost = null;
}

/** Stop the Home Assistant document behind the overlay from rubber banding. */
function lockOwnerDocument() {
  if (state.scrollLock.length) return;
  const view = parentWindow();
  const target = view?.document;
  if (!target) return;
  for (const element of [target.documentElement, target.body]) {
    if (!element?.style) continue;
    state.scrollLock.push({
      element,
      prima: ricordaEScrivi(element, [["overflow", "hidden", "important"]]),
    });
    element.setAttribute?.(KIOSK_ATTR, "true");
  }
}

function unlockOwnerDocument() {
  for (const entry of state.scrollLock) {
    if (!entry?.element?.style) continue;
    rimetti(entry.element, entry.prima);
    entry.element.removeAttribute?.(KIOSK_ATTR);
  }
  state.scrollLock = [];
}

function haDrawer() {
  const view = parentWindow();
  if (!view) return null;
  try {
    const app = view.document.querySelector("home-assistant");
    const main = app?.shadowRoot?.querySelector("home-assistant-main");
    return main?.shadowRoot?.querySelector("ha-drawer") || null;
  } catch (_error) {
    return null;
  }
}

/**
 * The plancia hamburger still opens the native Home Assistant sidebar. That
 * sidebar lives outside the panel subtree with a small z-index, so the overlay
 * steps aside while the drawer is open instead of swallowing it.
 *
 * The drawer state is sampled on animation frames for as long as it stays open,
 * never through a DOM observer: this module is forbidden from observing DOM.
 */
function applyDrawerRetraction(open) {
  const host = state.kioskHost;
  if (!host?.style) return;
  host.style.setProperty("z-index", open ? "1" : KIOSK_Z_INDEX, "important");
}

function nextFrame(callback) {
  const view = parentWindow() || root;
  if (typeof view.requestAnimationFrame === "function") return view.requestAnimationFrame(callback);
  return root.setTimeout?.(callback, 100) ?? null;
}

/** Follow the drawer for a few frames after a toggle, then while it stays open. */
function trackDrawer(frames = 20) {
  state.drawer ||= haDrawer();
  if (!state.drawer || state.drawerFrame) return false;
  const step = () => {
    const open = Boolean(state.drawer?.hasAttribute?.("open"));
    applyDrawerRetraction(open);
    frames -= 1;
    state.drawerFrame = state.active && (open || frames > 0) ? nextFrame(step) : null;
  };
  state.drawerFrame = nextFrame(step);
  return true;
}

function bindDrawerToggle() {
  if (state.drawerBound) return false;
  const view = parentWindow();
  if (!view?.addEventListener) return false;
  state.drawerBound = true;
  // Dispatched by the plancia hamburger and by every native sidebar toggle.
  view.addEventListener("hass-toggle-menu", () => trackDrawer(), true);
  return true;
}

function releaseDrawer() {
  state.drawer = null;
  state.drawerFrame = null;
}

function activateIosKiosk() {
  if (!doc) return false;
  doc.documentElement?.setAttribute?.(KIOSK_ATTR, "true");
  doc.body?.setAttribute?.(KIOSK_ATTR, "true");
  const { height } = updateKioskViewport();
  if (!state.kioskViewportBound) {
    state.kioskViewportBound = true;
    root.visualViewport?.addEventListener?.("resize", updateKioskViewport, { passive: true });
    root.visualViewport?.addEventListener?.("scroll", updateKioskViewport, { passive: true });
    root.addEventListener?.("resize", updateKioskViewport, { passive: true });
    root.addEventListener?.("orientationchange", updateKioskViewport, { passive: true });
  }
  const { frame, host } = hostForFrame();
  if (host && state.kioskHost !== host) {
    rimetti(state.kioskHost, state.kioskHostCss);
    state.kioskHost = host;
    state.kioskHostCss = [];
  }
  if (frame && state.kioskFrame !== frame) {
    rimetti(state.kioskFrame, state.kioskFrameCss);
    state.kioskFrame = frame;
    state.kioskFrameCss = [];
  }
  if (host) {
    host.dataset.dmIosKiosk = "true";
    const styles = kioskHostStyles({
      height,
      drawerOpen: Boolean(state.drawer?.hasAttribute?.("open")),
    });
    const scritte = ricordaEScrivi(
      host,
      Object.entries(styles).map(([property, value]) => [property, value, "important"]),
    );
    // Solo il primo giro dice com'era prima: dal secondo in poi rileggerebbe
    // quello che abbiamo scritto noi, e non si tornerebbe piu' indietro.
    if (!state.kioskHostCss?.length) state.kioskHostCss = scritte;
    releaseAncestors(host);
    lockOwnerDocument();
    bindDrawerToggle();
    trackDrawer(1);
  }
  if (frame) {
    frame.dataset.dmIosKiosk = "true";
    const scritte = ricordaEScrivi(frame, [
      ["width", "100%", "important"],
      ["height", "100%", "important"],
      ["min-height", "100%", "important"],
    ]);
    if (!state.kioskFrameCss?.length) state.kioskFrameCss = scritte;
  }
  state.active = true;
  return true;
}

function deactivateIosKiosk() {
  doc?.documentElement?.removeAttribute?.(KIOSK_ATTR);
  doc?.body?.removeAttribute?.(KIOSK_ATTR);
  releaseDrawer();
  unlockOwnerDocument();
  restoreAncestors();
  if (state.kioskHost) {
    rimetti(state.kioskHost, state.kioskHostCss);
    delete state.kioskHost.dataset.dmIosKiosk;
    state.kioskHost = null;
    state.kioskHostCss = [];
  }
  if (state.kioskFrame) {
    rimetti(state.kioskFrame, state.kioskFrameCss);
    delete state.kioskFrame.dataset.dmIosKiosk;
    state.kioskFrame = null;
    state.kioskFrameCss = [];
  }
  state.active = false;
}

/**
 * Everything this module writes outside its own document must survive the frame
 * going away: Home Assistant keeps the page when the plancia panel is replaced.
 */
export function releaseOwnerDocument() {
  unlockOwnerDocument();
  restoreAncestors();
  if (state.kioskHost) {
    rimetti(state.kioskHost, state.kioskHostCss);
    delete state.kioskHost.dataset?.dmIosKiosk;
    state.kioskHost = null;
    state.kioskHostCss = [];
  }
}

function syncIosKiosk() {
  bindKioskGesture();
  if (kioskEnabled()) activateIosKiosk();
  else deactivateIosKiosk();
  return state.active;
}

function kioskToast(message) {
  if (!doc?.body) return;
  let toast = doc.getElementById("dm-kiosk-toast");
  if (!toast) {
    toast = doc.createElement("div");
    toast.id = "dm-kiosk-toast";
    doc.body.append(toast);
  }
  toast.textContent = message;
  toast.dataset.visible = "true";
  root.clearTimeout?.(state.toastTimer);
  state.toastTimer = root.setTimeout?.(() => {
    toast.dataset.visible = "false";
  }, 2200);
}

export function setKioskMode(value) {
  state.override = Boolean(value);
  writeStoredKiosk(state.override);
  syncIosKiosk();
  root.dispatchEvent?.(
    new CustomEvent("dashboardmodern:kiosk", { detail: { active: state.active } }),
  );
  return state.active;
}

/**
 * Long press on the plancia hamburger toggles the kiosk. A short tap keeps its
 * historical behavior (native Home Assistant sidebar when hosted), so this is
 * the only reachable switch on a phone that cannot edit the address bar.
 */
function bindKioskGesture() {
  if (state.gestureBound) return false;
  const button = doc?.querySelector?.(".ha-menu-btn");
  if (!button) return false;
  state.gestureBound = true;
  let timer = null;
  let fired = false;
  const cancel = () => {
    if (timer !== null) root.clearTimeout?.(timer);
    timer = null;
  };
  const start = () => {
    cancel();
    fired = false;
    timer = root.setTimeout?.(() => {
      timer = null;
      fired = true;
      root.navigator?.vibrate?.(15);
      const active = setKioskMode(!state.active);
      kioskToast(
        active
          ? t("Modalità kiosk attiva", "Kiosk mode on")
          : t("Modalità kiosk disattivata", "Kiosk mode off"),
      );
    }, LONG_PRESS_MS);
  };
  button.addEventListener("touchstart", start, { passive: true });
  for (const name of ["touchend", "touchcancel", "touchmove"]) {
    button.addEventListener(name, cancel, { passive: true });
  }
  button.addEventListener("mousedown", start);
  for (const name of ["mouseup", "mouseleave"]) button.addEventListener(name, cancel);
  button.addEventListener("contextmenu", (event) => event.preventDefault?.());
  // The hamburger carries an inline onclick. Capturing on the document is the
  // only hook that runs before it, so the long press never also opens a menu.
  doc?.addEventListener?.(
    "click",
    (event) => {
      if (!fired) return;
      fired = false;
      if (!button.contains?.(event.target)) return;
      event.preventDefault?.();
      event.stopPropagation?.();
    },
    true,
  );
  return true;
}

if (!state.listeners) {
  state.listeners = true;
  for (const eventName of ["popstate", "hashchange", "pageshow", "orientationchange"]) {
    root.addEventListener?.(eventName, syncIosKiosk);
  }
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ]) {
    root.addEventListener?.(eventName, syncIosKiosk);
  }
  doc?.addEventListener?.("visibilitychange", syncIosKiosk);
  for (const eventName of ["pagehide", "unload"]) {
    root.addEventListener?.(eventName, releaseOwnerDocument);
  }
  /* Ma su quei due eventi non ci si puo' appoggiare da soli.
   *
   * Home Assistant e' una pagina sola: quando si lascia la plancia per un'altra
   * dashboard la pagina non si scarica mai, e la cornice tolta dal documento
   * non e' detto che dica niente — `unload` i browser lo stanno togliendo di
   * mezzo. Cosi' quello che avevamo scritto nel documento di Home Assistant
   * restava li': lo scorrimento bloccato, e soprattutto il velo fisso a tutto
   * schermo sopra il pannello, chiarissimo, che copriva le altre plance e
   * faceva sembrare che il tema fosse cambiato da solo e non si potesse piu'
   * toccare. Chi ospita la plancia, invece, sa sempre quando la toglie: gli si
   * lascia questa maniglia e la tira lui, prima di levare la cornice. */
  root.dmReleaseOwnerDocument = releaseOwnerDocument;
}

installStyle("dm-beta12-room-color-lock-style", `
  html[data-dm-ios-kiosk="true"],html[data-dm-ios-kiosk="true"] body{
    width:100%!important;min-width:0!important;height:var(--dm-ios-kiosk-height,100dvh)!important;
    min-height:var(--dm-ios-kiosk-height,100dvh)!important;max-height:none!important;margin:0!important;
    overflow-x:hidden!important;overscroll-behavior:none!important;background:var(--primary-background-color,#f8fafc)!important
  }
  html[data-dm-ios-kiosk="true"] body{
    box-sizing:border-box!important;padding-top:max(env(safe-area-inset-top),0px)!important;
    padding-left:max(env(safe-area-inset-left),0px)!important;padding-right:max(env(safe-area-inset-right),0px)!important;
    -webkit-overflow-scrolling:touch!important
  }
  html[data-dm-ios-kiosk="true"] #bottomNav{padding-bottom:max(env(safe-area-inset-bottom),0px)!important}
  #dm-kiosk-toast{position:fixed;left:50%;bottom:calc(24px + max(env(safe-area-inset-bottom),0px));
    transform:translate(-50%,12px);z-index:2147483001;padding:10px 18px;border-radius:999px;
    background:rgba(15,23,42,.92);color:#f8fafc;font-size:13px;font-weight:800;letter-spacing:.02em;
    pointer-events:none;opacity:0;transition:opacity .2s ease,transform .2s ease}
  #dm-kiosk-toast[data-visible="true"]{opacity:1;transform:translate(-50%,0)}
`);

syncIosKiosk();
