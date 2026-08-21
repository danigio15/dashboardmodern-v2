import { clean, doc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_NAVIGATION_SECTION__";
const state = (root[KEY] ||= { installed: false, scroller: null, autoHide: 0, behaviour: false });

/* The dock is sized on its content (`width:max-content`), so with every section
 * enabled the thirteen tabs are wider than the screen and the ones past the
 * viewport edge were simply unreachable: the bar is centered and fixed, so the
 * page scroll never moves it. The tabs now live in their own scroll port with
 * wheel, drag, arrows and keyboard, and the port is capped to the viewport. */
const SCROLLER_CLASS = "dm-nav-scroll";
const ARROW_CLASS = "dm-nav-arrow";
const CAN_SCROLL_CLASS = "dm-nav-can-scroll";
const DRAGGING_CLASS = "dm-nav-dragging";
const DRAG_THRESHOLD = 6;
const EDGE = 2;

function installStyles() {
  installStyle(
    "dm-navigation-section-style",
    `
      .bottom-nav-bar{isolation:isolate!important}
      .bottom-nav-bar .tab{color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
      .bottom-nav-bar .tab .icon,.bottom-nav-bar .tab .text{opacity:.78!important;transition:opacity .16s ease,color .16s ease!important}
      .bottom-nav-bar .tab.active{color:var(--text,#0f172a)!important}
      .bottom-nav-bar .tab.active .icon,.bottom-nav-bar .tab.active .text{opacity:1!important}
      html[data-theme="dark"] .bottom-nav-bar,html.dark .bottom-nav-bar,body[data-theme="dark"] .bottom-nav-bar,body.dark .bottom-nav-bar,.dark .bottom-nav-bar{background:rgba(19,28,48,.94)!important;border-color:#40506f!important;box-shadow:0 14px 38px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.07)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
      html[data-theme="dark"] .bottom-nav-bar .tab,html.dark .bottom-nav-bar .tab,body[data-theme="dark"] .bottom-nav-bar .tab,body.dark .bottom-nav-bar .tab,.dark .bottom-nav-bar .tab{color:#cbd5e1!important}
      html[data-theme="dark"] .bottom-nav-bar .tab .text,html.dark .bottom-nav-bar .tab .text,body[data-theme="dark"] .bottom-nav-bar .tab .text,body.dark .bottom-nav-bar .tab .text,.dark .bottom-nav-bar .tab .text{color:#cbd5e1!important;opacity:.92!important;text-shadow:0 1px 2px rgba(0,0,0,.35)!important}
      html[data-theme="dark"] .bottom-nav-bar .tab .icon,html.dark .bottom-nav-bar .tab .icon,body[data-theme="dark"] .bottom-nav-bar .tab .icon,body.dark .bottom-nav-bar .tab .icon,.dark .bottom-nav-bar .tab .icon{opacity:.96!important;filter:none!important}
      html[data-theme="dark"] .bottom-nav-bar .tab.active,html.dark .bottom-nav-bar .tab.active,body[data-theme="dark"] .bottom-nav-bar .tab.active,body.dark .bottom-nav-bar .tab.active,.dark .bottom-nav-bar .tab.active{background:#25324b!important;color:#fff!important;border-color:#52627f!important;box-shadow:0 8px 20px rgba(0,0,0,.28)!important}
      html[data-theme="dark"] .bottom-nav-bar .tab.active .text,html.dark .bottom-nav-bar .tab.active .text,body[data-theme="dark"] .bottom-nav-bar .tab.active .text,body.dark .bottom-nav-bar .tab.active .text,.dark .bottom-nav-bar .tab.active .text{color:#fff!important;opacity:1!important}
      @media(max-width:640px){.bottom-nav-bar .tab .text{font-weight:800!important}.bottom-nav-bar .tab{min-width:54px!important}}
      /* La barra deve essere raggiungibile con il mouse.
       *
       * Sul computer la barra sta a riposo fuori dallo schermo — e' un dock:
       * compare quando ci si avvicina col mouse. Misurata su una finestra alta
       * 900, pero', la barra comincia a 908, e l'unica zona sensibile era la
       * striscia di quattordici pixel che il suo bordo invisibile sporgeva in
       * alto. Da un browser ci si arriva per un pelo; dall'app di Home
       * Assistant sul Mac, dove il fondo della finestra e' occupato, non ci si
       * arriva affatto: la barra non usciva in nessun modo, e chi entrava dal
       * web la vedeva funzionare.
       *
       * La striscia adesso e' alta abbastanza da poterla prendere senza
       * inseguirla: il dock si comporta come prima, ma si lascia trovare. */
      @media(min-width:769px) and (hover:hover) and (pointer:fine){
        html body nav.tabs.bottom-nav-bar::before{
          top:-72px!important;left:-48px!important;right:-48px!important;bottom:-20px!important
        }
      }

      /* Il contenitore è trasparente al layout finché non serve scorrere: su
       * mobile la barra scorre già da sé e resta esattamente com'era. */
      .bottom-nav-bar .${SCROLLER_CLASS}{display:contents}
      .bottom-nav-bar .${ARROW_CLASS}{display:none}
      @media(min-width:769px) and (hover:hover) and (pointer:fine){
        nav.tabs.bottom-nav-bar{width:max-content!important;min-width:0!important;max-width:calc(100% - 48px)!important}
        nav.tabs.bottom-nav-bar:has(:focus-visible){bottom:20px!important;opacity:1!important}
        nav.tabs.bottom-nav-bar .${SCROLLER_CLASS}{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:12px!important;flex:0 1 auto!important;min-width:0!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain!important;scrollbar-width:none!important;-ms-overflow-style:none!important;scroll-padding-inline:28px!important}
        /* Il padding fa spazio alla gobba del dock dentro il riquadro che
         * ritaglia lo scroll; i margini negativi lo tolgono dal layout, così
         * la pillola resta alta come prima. */
        nav.tabs.bottom-nav-bar .${SCROLLER_CLASS}{padding:34px 12px 26px!important;margin:-34px -12px -26px!important}
        nav.tabs.bottom-nav-bar .${SCROLLER_CLASS}::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}
        nav.tabs.bottom-nav-bar .${SCROLLER_CLASS} .tab{flex:0 0 auto!important}
        nav.tabs.bottom-nav-bar .${SCROLLER_CLASS} .tab .text{white-space:nowrap!important}
        nav.tabs.bottom-nav-bar.${DRAGGING_CLASS} .${SCROLLER_CLASS}{cursor:grabbing!important;user-select:none!important}
        nav.tabs.bottom-nav-bar.${DRAGGING_CLASS} .tab{pointer-events:none!important}
        nav.tabs.bottom-nav-bar.${CAN_SCROLL_CLASS} .${ARROW_CLASS}{display:flex!important;align-items:center!important;justify-content:center!important;align-self:center!important;flex:0 0 auto!important;width:34px!important;height:34px!important;padding:0!important;margin:0!important;border-radius:50%!important;border:1px solid rgba(15,23,42,.10)!important;background:rgba(255,255,255,.78)!important;color:#0f172a!important;cursor:pointer!important;box-shadow:0 4px 12px rgba(15,23,42,.14)!important;transition:opacity .2s ease,transform .2s ease,background .2s ease!important}
        nav.tabs.bottom-nav-bar.${CAN_SCROLL_CLASS} .${ARROW_CLASS}:hover:not([disabled]){background:#fff!important;transform:scale(1.08)!important}
        nav.tabs.bottom-nav-bar.${CAN_SCROLL_CLASS} .${ARROW_CLASS}[disabled]{opacity:.2!important;cursor:default!important;box-shadow:none!important}
        nav.tabs.bottom-nav-bar .${ARROW_CLASS}::before{content:''!important;width:9px!important;height:9px!important;border-right:2px solid currentColor!important;border-bottom:2px solid currentColor!important}
        nav.tabs.bottom-nav-bar .${ARROW_CLASS}-prev::before{transform:rotate(135deg)!important;margin-left:3px!important}
        nav.tabs.bottom-nav-bar .${ARROW_CLASS}-next::before{transform:rotate(-45deg)!important;margin-right:3px!important}
        html[data-theme="dark"] nav.tabs.bottom-nav-bar .${ARROW_CLASS},html.dark nav.tabs.bottom-nav-bar .${ARROW_CLASS},body[data-theme="dark"] nav.tabs.bottom-nav-bar .${ARROW_CLASS},body.dark nav.tabs.bottom-nav-bar .${ARROW_CLASS},.dark nav.tabs.bottom-nav-bar .${ARROW_CLASS}{background:#25324b!important;border-color:#52627f!important;color:#cbd5e1!important;box-shadow:0 6px 16px rgba(0,0,0,.32)!important}
        html[data-theme="dark"] nav.tabs.bottom-nav-bar .${ARROW_CLASS}:hover:not([disabled]),html.dark nav.tabs.bottom-nav-bar .${ARROW_CLASS}:hover:not([disabled]),body[data-theme="dark"] nav.tabs.bottom-nav-bar .${ARROW_CLASS}:hover:not([disabled]),body.dark nav.tabs.bottom-nav-bar .${ARROW_CLASS}:hover:not([disabled]),.dark nav.tabs.bottom-nav-bar .${ARROW_CLASS}:hover:not([disabled]){background:#31415f!important;color:#fff!important}
      }
    `,
  );
}

/* Pure geometry, so the scroll rules are testable without a browser. */
export function navScrollState({ scrollLeft = 0, scrollWidth = 0, clientWidth = 0 } = {}) {
  const max = Math.max(0, Math.round(scrollWidth - clientWidth));
  const scrollable = max > EDGE;
  const position = Math.max(0, Math.min(scrollLeft, max));
  return Object.freeze({
    max,
    scrollable,
    atStart: !scrollable || position <= EDGE,
    atEnd: !scrollable || position >= max - EDGE,
  });
}

export function navPageStep(clientWidth = 0) {
  return Math.max(120, Math.round(clientWidth * 0.72));
}

export function navWheelDelta(event = {}) {
  const horizontal = Math.abs(event.deltaX || 0) > Math.abs(event.deltaY || 0);
  const raw = horizontal ? event.deltaX : event.deltaY;
  const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? 320 : 1;
  return Number.isFinite(raw) ? raw * unit : 0;
}

export function navCenterTarget({
  scrollLeft = 0,
  portLeft = 0,
  portWidth = 0,
  tabLeft = 0,
  tabWidth = 0,
  max = 0,
} = {}) {
  const target = scrollLeft + (tabLeft - portLeft) - (portWidth - tabWidth) / 2;
  return Math.max(0, Math.min(Math.round(target), Math.max(0, max)));
}

export function navTabIsVisible({ portLeft = 0, portRight = 0, tabLeft = 0, tabRight = 0 } = {}) {
  return tabLeft >= portLeft - EDGE && tabRight <= portRight + EDGE;
}

function navigationBar() {
  return doc?.querySelector("nav.tabs.bottom-nav-bar") || null;
}

/* The tabs are the only children the vendored markup puts in the bar, and the
 * legacy reorder appends into `.tab`'s parent, so moving them into the port
 * keeps both the DOM order and that reorder working. */
function buildScroller(nav) {
  const existing = nav.querySelector(`.${SCROLLER_CLASS}`);
  if (existing) return existing;
  const tabs = [...nav.querySelectorAll(".tab")];
  if (!tabs.length) return null;
  const scroller = doc.createElement("div");
  scroller.className = SCROLLER_CLASS;
  nav.insertBefore(scroller, tabs[0]);
  for (const tab of tabs) scroller.append(tab);
  return scroller;
}

function buildArrow(direction) {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = `${ARROW_CLASS} ${ARROW_CLASS}-${direction}`;
  button.setAttribute(
    "aria-label",
    direction === "prev"
      ? t("Sezioni precedenti", "Previous sections")
      : t("Sezioni successive", "Next sections"),
  );
  return button;
}

function installScroller() {
  const nav = navigationBar();
  if (!nav || state.scroller) return Boolean(state.scroller);
  const scroller = buildScroller(nav);
  if (!scroller) return false;
  state.scroller = scroller;

  const previous = buildArrow("prev");
  const next = buildArrow("next");
  nav.insertBefore(previous, scroller);
  nav.append(next);

  const reduced = Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const behavior = reduced ? "auto" : "smooth";

  const sync = () => {
    const status = navScrollState(scroller);
    nav.classList.toggle(CAN_SCROLL_CLASS, status.scrollable);
    previous.disabled = status.atStart;
    next.disabled = status.atEnd;
    return status;
  };

  const stepBy = (direction) => {
    scroller.scrollBy({ left: direction * navPageStep(scroller.clientWidth), behavior });
  };

  /* Chi ha scorso la barra con le frecce, la rotella, le freccette della
   * tastiera o trascinandola l'ha portata dove voleva. Da quel momento il dock
   * non si riporta piu' da solo sulla sezione aperta: prima bastava rientrare
   * col puntatore sulla barra e questa scattava indietro sotto il dito, cosi'
   * il click seguente cadeva sull'icona sbagliata. La barra torna a seguirla
   * quando la sezione aperta cambia — allora e' il dock a sapere meglio. */
  let steered = false;
  let lastActive = null;
  const steer = () => {
    steered = true;
  };

  /* Ogni volta che il dock ricompare la sezione aperta deve essere sotto gli
   * occhi, ma senza rimbalzare via da dove l'utente aveva scorso. */
  const revealActive = () => {
    const status = sync();
    if (!status.scrollable) return;
    const active = scroller.querySelector(".tab.active");
    if (!active) return;
    if (active !== lastActive) {
      lastActive = active;
      steered = false;
    } else if (steered) {
      return;
    }
    const port = scroller.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    if (
      navTabIsVisible({
        portLeft: port.left,
        portRight: port.right,
        tabLeft: box.left,
        tabRight: box.right,
      })
    ) {
      return;
    }
    scroller.scrollTo({
      left: navCenterTarget({
        scrollLeft: scroller.scrollLeft,
        portLeft: port.left,
        portWidth: scroller.clientWidth,
        tabLeft: box.left,
        tabWidth: box.width,
        max: status.max,
      }),
      behavior,
    });
  };

  previous.addEventListener("click", () => {
    steer();
    stepBy(-1);
  });
  next.addEventListener("click", () => {
    steer();
    stepBy(1);
  });
  scroller.addEventListener("scroll", sync, { passive: true });
  /* Accendere o spegnere una sezione cambia la larghezza della barra: è il
   * segnale che dice quando le frecce servono, senza nessun giro a vuoto. */
  if (typeof root.ResizeObserver === "function") new root.ResizeObserver(sync).observe(scroller);
  nav.addEventListener("pointerenter", revealActive);
  nav.addEventListener("focusin", revealActive);
  root.addEventListener?.("resize", sync);
  root.addEventListener?.("dashboardmodern:legacy-ready", revealActive);

  nav.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!navScrollState(scroller).scrollable) return;
    steer();
    stepBy(event.key === "ArrowLeft" ? -1 : 1);
    event.preventDefault();
  });

  /* La rotella verticale del mouse è l'unico gesto di scorrimento che un PC
   * fisso ha sempre: sopra il dock diventa orizzontale. */
  nav.addEventListener(
    "wheel",
    (event) => {
      const status = navScrollState(scroller);
      if (!status.scrollable) return;
      const delta = navWheelDelta(event);
      if (!delta) return;
      const target = Math.max(0, Math.min(scroller.scrollLeft + delta, status.max));
      if (target === scroller.scrollLeft) return;
      steer();
      scroller.scrollLeft = target;
      event.preventDefault();
      sync();
    },
    { passive: false },
  );

  /* Trascinare la barra come si trascina il dock: il puntatore viene catturato
   * solo dopo la soglia, così un click fermo su una scheda resta un click. */
  let drag = null;
  let swallowClick = false;

  const dragMove = (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      drag.moved = true;
      nav.classList.add(DRAGGING_CLASS);
      scroller.setPointerCapture?.(drag.pointerId);
    }
    scroller.scrollLeft = drag.left - dx;
  };

  const dragEnd = () => {
    if (!drag) return;
    const { pointerId, moved } = drag;
    drag = null;
    swallowClick = moved;
    if (moved) steer();
    nav.classList.remove(DRAGGING_CLASS);
    if (moved) scroller.releasePointerCapture?.(pointerId);
    root.removeEventListener?.("pointermove", dragMove);
    root.removeEventListener?.("pointerup", dragEnd);
    root.removeEventListener?.("pointercancel", dragEnd);
    sync();
  };

  scroller.addEventListener("pointerdown", (event) => {
    swallowClick = false;
    if (drag || event.button !== 0 || event.pointerType === "touch") return;
    if (!navScrollState(scroller).scrollable) return;
    drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      left: scroller.scrollLeft,
      moved: false,
    };
    root.addEventListener?.("pointermove", dragMove);
    root.addEventListener?.("pointerup", dragEnd);
    root.addEventListener?.("pointercancel", dragEnd);
  });

  /* Trascinare finisce sempre con un click: quello che chiude il trascinamento
   * non deve cambiare sezione. */
  scroller.addEventListener(
    "click",
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  sync();
  return true;
}

/* ── one behaviour for the bar, on every page ─────────────────────────────
 *
 * The dock is shown by a tap on its handle and hidden again by the same three
 * things everywhere: choosing a section, tapping away from it, or leaving it
 * alone. The vendored runtime already does this, but it listens on the bubble
 * phase, and several redesigned pages stop propagation on their own cards — so
 * on Elettrodomestici or Temperature a tap outside the dock never reached the
 * handler that closes it, while on Home it did. Same gesture, different answer
 * depending on which section was open.
 *
 * These listeners run in the capture phase, before any page can swallow them,
 * and they are delegated rather than bound to the tabs that existed at load —
 * a tab reordered or reinserted later behaves like all the others. The
 * "barra fissa" preference still wins: when it is on, nothing auto-hides. */
const AUTO_HIDE_MS = 4000;
const TAB_HIDE_MS = 800;

function navFixed() {
  try {
    return clean(root.localStorage?.getItem("cd_navbar_mode")) === "fixed";
  } catch (_error) {
    return false;
  }
}

/* Touch layouts are the ones with a hideable dock. On a desktop the bar is
 * revealed by the pointer and must never be closed from here. The marker class
 * is the runtime's own answer to the same question; the media query is the
 * fallback for a document that has not been marked yet. */
function touchNavigation() {
  if (doc?.documentElement?.classList.contains("dm-touch-navigation")) return true;
  try {
    return Boolean(root.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches);
  } catch (_error) {
    return false;
  }
}

function clearAutoHide() {
  if (!state.autoHide) return;
  root.clearTimeout?.(state.autoHide);
  state.autoHide = 0;
}

export function hideNavigation() {
  clearAutoHide();
  if (navFixed()) return false;
  const nav = navigationBar();
  if (!nav) return false;
  nav.classList.remove("visible");
  doc.body?.classList.remove("nav-visible");
  return true;
}

export function scheduleNavigationAutoHide(delay = AUTO_HIDE_MS) {
  clearAutoHide();
  if (navFixed() || !touchNavigation()) return false;
  state.autoHide = root.setTimeout?.(() => {
    state.autoHide = 0;
    hideNavigation();
  }, delay) || 0;
  return Boolean(state.autoHide);
}

export function showNavigation() {
  const nav = navigationBar();
  if (!nav) return false;
  nav.classList.add("visible");
  doc.body?.classList.add("nav-visible");
  scheduleNavigationAutoHide();
  return true;
}

function installBarBehaviour() {
  if (state.behaviour) return false;
  state.behaviour = true;

  doc.addEventListener(
    "click",
    (event) => {
      if (!touchNavigation()) return;
      const nav = navigationBar();
      if (!nav) return;
      const target = event.target;
      if (target?.closest?.("#bottomNavHandle")) {
        // The runtime binds its own toggle to the handle whenever it decided
        // this is a touch layout, and it announces that by publishing
        // cdApplyNavMode. Toggling here too would toggle twice on one tap and
        // the dock would never open. Where it did not bind — a layout it
        // decided was a desktop, and a handle that would otherwise do nothing —
        // this is the toggle.
        if (typeof root.cdApplyNavMode !== "function") {
          if (nav.classList.contains("visible")) hideNavigation();
          else showNavigation();
        } else if (nav.classList.contains("visible")) {
          scheduleNavigationAutoHide();
        }
        return;
      }
      if (target?.closest?.(".tab")) {
        // Give the section time to come up, then get out of its way.
        scheduleNavigationAutoHide(TAB_HIDE_MS);
        return;
      }
      if (!nav.contains(target)) {
        if (nav.classList.contains("visible")) hideNavigation();
        return;
      }
      scheduleNavigationAutoHide();
    },
    true,
  );

  for (const eventName of ["pointerdown", "touchstart", "wheel", "keydown"]) {
    doc.addEventListener(
      eventName,
      (event) => {
        const nav = navigationBar();
        if (nav?.classList.contains("visible") && nav.contains(event.target)) {
          scheduleNavigationAutoHide();
        }
      },
      { capture: true, passive: true },
    );
  }

  // The bar sits over the page, so the last row of every section needs the same
  // room underneath it — not only the sections that happened to reserve it.
  installStyle(
    "dm-navigation-room-style",
    `body.nav-visible .page{padding-bottom:calc(76px + env(safe-area-inset-bottom,0px))!important}`,
  );
  return true;
}

export function installNavigationSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  installBarBehaviour();
  if (!installScroller()) {
    doc.addEventListener("DOMContentLoaded", () => installScroller(), { once: true });
  }
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installNavigationSection, { once: true });
} else {
  installNavigationSection();
}
