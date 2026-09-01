import { oggettoWidget } from "../core/oggetti-widget.js";
import { clean, doc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_NAVIGATION_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  scroller: null,
  autoHide: 0,
  behaviour: false,
});

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
      /* Quanto si prende il sistema in fondo allo schermo (#249).
       *
       * «Nello smartphone la barra inferiore e' parzialmente coperta dai tasti
       * Android»: la barra sta a diciotto pixel dal fondo della pagina, e su un
       * telefono coi tre tasti quel fondo e' sotto di loro. Alzarla di un tanto
       * fisso avrebbe solo spostato il problema: su un telefono a gesti, su un
       * tablet o su un computer sarebbe rimasta sospesa per niente.
       *
       * Quanto alzarla lo dice il dispositivo, schermo per schermo, ed e' zero
       * dove non c'e' niente da scansare: la barra si alza esattamente di
       * quello che il sistema si e' preso e non di un pixel di piu'. Il valore
       * passa da una variabile cosi' che una prova possa fingere un telefono
       * coi tasti e guardare la barra spostarsi davvero. */
      :root{--dm-fondo-di-sistema:env(safe-area-inset-bottom,0px)}
      /* La barra a riposo, quella tirata fuori e quella tenuta ferma: tutte e
       * tre misurano dal fondo, e tutte e tre devono scansare i tasti. */
      nav.tabs.bottom-nav-bar.visible,
      body.cd-nav-fixed nav.tabs.bottom-nav-bar{
        bottom:calc(18px + var(--dm-fondo-di-sistema))!important
      }
      /* E la maniglia che tira fuori la barra, che sta ancora piu' in basso:
       * se resta sotto i tasti non la si prende nemmeno. */
      .bottom-nav-handle{bottom:calc(6px + var(--dm-fondo-di-sistema))!important}
      nav.tabs.bottom-nav-bar.visible ~ .bottom-nav-handle,
      body.nav-visible .bottom-nav-handle{
        bottom:calc(90px + var(--dm-fondo-di-sistema))!important
      }
      .bottom-nav-bar{isolation:isolate!important}
      .bottom-nav-bar .tab{color:var(--secondary-text-color,var(--text-dim,#64748b))!important}
      .bottom-nav-bar .tab .icon,.bottom-nav-bar .tab .text{opacity:.78!important;transition:opacity .16s ease,color .16s ease!important}
      /* Il disegno di casa sta nella casella del simbolo, alla sua misura.
       *
       * Il guscio spegneva i simboli con grayscale(1) e opacita' a meta': era una
       * regola scritta per le emoji, e sui disegni li sbiadiva fino a farli
       * sparire. Le voci a riposo restano spente — e' cosi' che si vede
       * qual e' quella aperta — ma abbastanza da riconoscerle; quella aperta
       * torna a colori pieni. */
      .bottom-nav-bar .tab .icon>.dm-oggetto{width:24px;height:24px;display:block;margin:0 auto}
      nav.tabs.bottom-nav-bar .tab .icon:has(>.dm-oggetto){filter:grayscale(.85) opacity(.72)!important}
      nav.tabs.bottom-nav-bar .tab.active .icon:has(>.dm-oggetto){filter:none!important}
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
        nav.tabs.bottom-nav-bar:has(:focus-visible){bottom:calc(20px + var(--dm-fondo-di-sistema))!important;opacity:1!important}
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

export const NAVBAR_MODE_KEY = "cd_navbar_mode";
export const NAVBAR_MODES = Object.freeze(["auto", "fixed"]);
export const NAVBAR_MODE_DEFAULT = "fixed";

/* La barra parte fissa, e la scelta segue chi la fa.
 *
 * Prima partiva a scomparsa dappertutto e la scelta restava sul dispositivo che
 * l'aveva fatta. Sul computer le due cose insieme chiudevano la porta a chiave:
 * la barra a riposo sta fuori dallo schermo e si chiama avvicinando il mouse al
 * fondo, ma il comando per tenerla ferma sta nella pagina Config, e a quella
 * pagina ci si arriva dalla barra. Chi non riusciva a chiamarla non poteva
 * nemmeno dirle di restare, e metterla fissa dal telefono non serviva a niente
 * perche' quella preferenza non viaggiava.
 *
 * Adesso parte ferma, e chi preferisce il dock lo sceglie una volta sola. */
export function navbarMode(storage = root.localStorage) {
  try {
    const scritta = clean(storage?.getItem?.(NAVBAR_MODE_KEY));
    return NAVBAR_MODES.includes(scritta) ? scritta : NAVBAR_MODE_DEFAULT;
  } catch (_error) {
    return NAVBAR_MODE_DEFAULT;
  }
}

/* Il valore di partenza va scritto, non solo inteso: la pagina Config e il
 * vecchio runtime lo rileggono per conto loro, in punti che non passano di qui,
 * e una casella vuota la leggerebbero come "a scomparsa" — la barra ferma e il
 * bottone che dice il contrario.
 *
 * Si scrive pero' senza far scattare la spinta della configurazione: e' un
 * valore di partenza, non una scelta di nessuno, e se ne partisse una copia
 * arriverebbe a sovrascrivere il "a scomparsa" scelto davvero su un altro
 * dispositivo prima ancora di averlo ricevuto. */
export function seedNavbarMode(storage = root.localStorage, view = root) {
  try {
    if (NAVBAR_MODES.includes(clean(storage?.getItem?.(NAVBAR_MODE_KEY)))) return false;
    const prima = view?.__DASHBOARDMODERN_PERSIST_RESTORE__;
    if (view) view.__DASHBOARDMODERN_PERSIST_RESTORE__ = true;
    try {
      storage?.setItem?.(NAVBAR_MODE_KEY, NAVBAR_MODE_DEFAULT);
    } finally {
      if (view) {
        if (prima === undefined) delete view.__DASHBOARDMODERN_PERSIST_RESTORE__;
        else view.__DASHBOARDMODERN_PERSIST_RESTORE__ = prima;
      }
    }
    return true;
  } catch (_error) {
    return false;
  }
}

/** Scrive il valore di partenza se manca e lo fa applicare al documento. */
export function applyNavbarMode() {
  const scritto = seedNavbarMode();
  try {
    root.cdApplyNavFixedBody?.();
  } catch (_error) {}
  return scritto;
}

function navFixed() {
  return navbarMode() === "fixed";
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

/* ── Config resta l'ultima ─────────────────────────────────────────────────
 *
 * L'ordine della barra si salva in `cd_navbar_order`, e chi lo applica mette
 * in coda ogni scheda che quell'elenco non nomina. Una sezione nuova — il
 * robot aspirapolvere — nell'elenco salvato mesi fa non c'e', e le sezioni
 * che nascono a runtime la loro scheda se la attaccano in fondo: in tutti e
 * due i casi finiscono dopo Config, che invece e' il posto dove si va quando
 * si ha finito di guardare la casa e sta bene in fondo.
 *
 * Non si tocca l'ordine scelto: si sposta soltanto Config in coda.
 */
export const CONFIG_TAB = "config";

/** L'elenco delle chiavi con Config in fondo, senza cambiare il resto. */
export function ordineConConfigInFondo(chiavi = [], config = CONFIG_TAB) {
  const elenco = [...chiavi];
  const posto = elenco.indexOf(config);
  if (posto < 0 || posto === elenco.length - 1) return elenco;
  elenco.splice(posto, 1);
  elenco.push(config);
  return elenco;
}

/** Sposta la scheda Config in fondo alla barra, se non ci e' gia'. */
export function configSempreUltima(scope = doc) {
  const schede = scope?.querySelectorAll?.(".tab[data-tab]");
  if (!schede?.length) return false;
  const config = [...schede].find((scheda) => scheda.dataset.tab === CONFIG_TAB);
  if (!config) return false;
  const barra = config.parentElement;
  if (!barra) return false;
  const sorelle = [...barra.querySelectorAll(":scope > .tab[data-tab]")];
  if (sorelle.at(-1) === config) return false;
  barra.appendChild(config);
  return true;
}

/* Chi rimette in ordine la barra lo fa piu' volte: all'avvio, quando arriva la
 * configurazione condivisa, e a intervalli finche' la pagina vive. Invece di
 * inseguirli si avvolgono le loro funzioni: cosi' Config torna in fondo subito
 * dopo, qualunque sia stata la ragione del riordino. */
/* Quale disegno di casa porta ogni pagina, nella barra in basso.
 *
 * La barra era rimasta l'ultimo posto — e il piu' guardato di tutti — con le
 * emoji del sistema: la casa di Samsung accanto al fiocco di Apple, e su ogni
 * telefono una faccia diversa. «Ti avevo chiesto di inserire icone nostre su
 * tutta la dashboard e continuo a vedere icone che non sono nostre.» Sono gli
 * stessi oggetti delle tessere e del menu della configurazione: una famiglia
 * sola, dal primo all'ultimo angolo della plancia. */
const OGGETTO_DELLA_PAGINA = Object.freeze({
  home: "home",
  energy: "energia",
  "appliances-main": "elettrodomestici",
  ev: "ev",
  boiler: "solare",
  clima: "clima",
  temp: "temperatura",
  tapparelle: "tapparelle",
  security: "sicurezza",
  server: "minipc",
  piscina: "piscina",
  irrigazione: "irrigazione",
  luci: "luci",
  prese: "prese",
  robot: "robot",
  stanze: "stanze",
  aperture: "aperture",
  doors: "aperture",
  telecamere: "telecamere",
  config: "impostazioni",
});

/** Mette il disegno di casa al posto del simbolo, su ogni voce della barra. */
export function disegniNellaBarra(scope = doc) {
  const schede = scope?.querySelectorAll?.("nav.tabs .tab[data-tab]");
  if (!schede?.length) return 0;
  let messi = 0;
  for (const scheda of schede) {
    const pagina = clean(scheda.dataset.tab);
    const disegno = OGGETTO_DELLA_PAGINA[pagina];
    if (!disegno) continue;
    const casella = scheda.querySelector(":scope > .icon");
    if (!casella || casella.dataset.dmOggetto === disegno) continue;
    const marchio = oggettoWidget(disegno);
    if (!marchio) continue;
    casella.innerHTML = marchio;
    casella.dataset.dmOggetto = disegno;
    messi += 1;
  }
  return messi;
}

function accodaDopo(nome) {
  const originale = root[nome];
  if (typeof originale !== "function" || originale.__dmConfigUltima) return false;
  const avvolta = function (...argomenti) {
    const esito = originale.apply(this, argomenti);
    try {
      configSempreUltima();
      disegniNellaBarra();
    } catch (_error) {}
    return esito;
  };
  avvolta.__dmConfigUltima = true;
  root[nome] = avvolta;
  return true;
}

export function installNavigationSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  applyNavbarMode();
  configSempreUltima();
  accodaDopo("cdApplyNavOrder");
  accodaDopo("cdApplyNavVis");
  /* La configurazione condivisa, arrivando, riscrive le chiavi: se quella
   * dell'altro dispositivo non la porta, qui resterebbe vuota e la barra
   * tornerebbe a scomparsa da sola. */
  root.addEventListener?.("dashboardmodern:persistence-restored", () => {
    applyNavbarMode();
    configSempreUltima();
    disegniNellaBarra();
  });
  /* La barra la riscrive il guscio a ogni giro di visibilita': i disegni si
   * rimettono quando succede, non una volta sola all'avvio. */
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"])
    root.addEventListener?.(evento, () => disegniNellaBarra());
  /* La barra la rifa' il guscio: a ogni giro di visibilita' e di ordine — che
   * sono le due funzioni avvolte qui sopra — e al primo disegno. Ci si aggancia
   * a quelle, senza sorveglianti ne' timer: e' la stessa regola con cui questo
   * modulo tiene il resto della barra. */
  disegniNellaBarra();
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
