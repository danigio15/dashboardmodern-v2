/*
 * DOM translation pass for text this codebase does not render itself.
 *
 * The visible dashboard is painted by three different layers: the section
 * modules (which call `t()` and are already locale aware), the vendored legacy
 * shell, and the 600 kB vendored runtime build. The last two exist only as an
 * Italian and an English fork, so no amount of work in the section layer makes
 * them speak Japanese.
 *
 * This pass closes that gap: it walks the rendered document, matches text
 * against the shared catalogs by source string, and rewrites the matches. The
 * original source is remembered per node, so switching locale re-translates
 * from the source rather than from an already translated string.
 */

import { DEFAULT_LOCALE, SOURCE_LOCALE, getLocale, onLocaleChange, translate } from "./i18n.js";
import { pivotKey } from "../i18n/source-index.js";

/** Nodes whose text is markup, code or user input rather than UI copy. */
const SKIPPED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "TEXTAREA",
  "CODE",
  "PRE",
  "SVG",
  "CANVAS",
  "TEMPLATE",
  "NOSCRIPT",
]);
/** Attributes that carry user-visible copy. */
const TRANSLATABLE_ATTRIBUTES = Object.freeze([
  "title",
  "placeholder",
  "aria-label",
  "alt",
  "data-dm-label",
]);
/** Marks a subtree as user data — entity names, room names, free text. */
export const OPT_OUT_ATTRIBUTE = "data-dm-no-i18n";

const originalText = new WeakMap();
const originalAttributes = new WeakMap();

/*
 * The decoration a node carries in front of its words.
 *
 * The runtime prints its own copy and then dresses it: the appliance page paints
 * `🧺 No appliance configured…`, a KPI paints `· Instant power`, a numbered step
 * paints `1. Open HA…`. The catalog is keyed on the sentence, so the whole node
 * matches nothing and stays English while the same sentence, printed bare
 * somewhere else, translates. Peeling what is not a word off both ends and
 * putting it back afterwards costs one extra lookup and closes that gap.
 *
 * Only leading and trailing runs, never anything inside: a string is either a
 * decorated key or it is not, and cutting a sentence apart to find one would
 * translate half of it. The front comes off first and on its own, because a
 * sentence ends in a full stop that belongs to it: taking both ends at once
 * turns `🧺 No appliance configured.` into a key nobody ever wrote.
 */
const LEADING = /^([^\p{L}\p{N}]+)([\s\S]+)$/u;
const TRAILING = /^([\s\S]+?)([^\p{L}\p{N}]+)$/u;

/**
 * Resolve any source string to its translation.
 * Text already in English is looked up directly; Italian text is mapped onto
 * its English pivot key first.
 */
export function translateSource(text, locale = getLocale()) {
  const source = typeof text === "string" ? text : "";
  if (!source.trim()) return source;
  const resolved = resolveWhole(source, locale);
  if (resolved !== source) return resolved;

  /* Front first: a sentence keeps its full stop, and peeling both ends at once
   * would take it and leave a key nobody wrote. */
  const front = LEADING.exec(source);
  if (front) {
    const inner = resolveWhole(front[2], locale);
    if (inner !== front[2]) return `${front[1]}${inner}`;
    const back = TRAILING.exec(front[2]);
    if (back) {
      const middle = resolveWhole(back[1], locale);
      if (middle !== back[1]) return `${front[1]}${middle}${back[2]}`;
    }
  }
  const back = TRAILING.exec(source);
  if (back) {
    const head = resolveWhole(back[1], locale);
    if (head !== back[1]) return `${head}${back[2]}`;
  }
  return source;
}

function resolveWhole(source, locale) {
  if (locale === DEFAULT_LOCALE) {
    const key = pivotKey(source);
    return key || source;
  }
  if (locale === SOURCE_LOCALE) return source;
  const direct = translate(source, locale);
  if (direct !== source) return direct;
  const key = pivotKey(source);
  return key ? translate(key, locale) : source;
}

function skipped(element) {
  for (let node = element; node; node = node.parentElement) {
    if (SKIPPED_TAGS.has(node.tagName)) return true;
    if (node.hasAttribute?.(OPT_OUT_ATTRIBUTE)) return true;
    if (node.getAttribute?.("translate") === "no") return true;
  }
  return false;
}

/**
 * Rewrite one text node in place, preserving its surrounding whitespace so
 * inline layout (` · ` separators, trailing spaces) survives the swap.
 */
function applyTextNode(node, locale) {
  const current = node.nodeValue;
  if (!current || !current.trim()) return false;
  let source = originalText.get(node);
  if (source === undefined) {
    source = current;
    originalText.set(node, source);
  }
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(source);
  const translated = translateSource(match[2], locale);
  const next = `${match[1]}${translated}${match[3]}`;
  if (next === current) return false;
  node.nodeValue = next;
  return true;
}

function applyAttributes(element, locale) {
  let changed = false;
  for (const name of TRANSLATABLE_ATTRIBUTES) {
    if (!element.hasAttribute?.(name)) continue;
    let store = originalAttributes.get(element);
    if (!store) {
      store = new Map();
      originalAttributes.set(element, store);
    }
    if (!store.has(name)) store.set(name, element.getAttribute(name));
    const source = store.get(name);
    if (!source || !source.trim()) continue;
    const translated = translateSource(source.trim(), locale);
    if (translated !== element.getAttribute(name)) {
      element.setAttribute(name, translated);
      changed = true;
    }
  }
  return changed;
}

/**
 * Translate a subtree. Returns how many nodes changed, which the tests assert
 * on and which keeps the observer from re-entering on a no-op pass.
 */
export function translateTree(rootNode, locale = getLocale()) {
  if (!rootNode) return 0;
  const document = rootNode.ownerDocument || rootNode;
  const view = document?.defaultView || globalThis;
  if (!view.NodeFilter || !document.createTreeWalker) return 0;
  let changed = 0;

  const element = rootNode.nodeType === 1 ? rootNode : rootNode.documentElement || rootNode.body;
  if (element?.nodeType === 1 && !skipped(element))
    changed += applyAttributes(element, locale) ? 1 : 0;

  const walker = document.createTreeWalker(
    rootNode,
    view.NodeFilter.SHOW_TEXT | view.NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (node.nodeType === 1) {
          if (
            SKIPPED_TAGS.has(node.tagName) ||
            node.hasAttribute?.(OPT_OUT_ATTRIBUTE) ||
            node.getAttribute?.("translate") === "no"
          ) {
            return view.NodeFilter.FILTER_REJECT;
          }
          return view.NodeFilter.FILTER_ACCEPT;
        }
        return node.nodeValue && node.nodeValue.trim()
          ? view.NodeFilter.FILTER_ACCEPT
          : view.NodeFilter.FILTER_REJECT;
      },
    },
  );

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 1) changed += applyAttributes(node, locale) ? 1 : 0;
    else changed += applyTextNode(node, locale) ? 1 : 0;
  }
  return changed;
}

/* ------------------------------------------------------------------ */
/* Scheduling                                                          */
/* ------------------------------------------------------------------ */

/*
 * No MutationObserver here, deliberately.
 *
 * A translation pass wants to know "something was drawn", and a subtree
 * observer on the body is the obvious way to hear it — which is exactly the
 * thing this runtime does not allow: the import-graph contract rejects any
 * observer rooted at the document, because a dashboard that repaints on every
 * state push would spend the frame budget answering its own writes.
 *
 * The renders are announced anyway. Home Assistant state arrives through the
 * gated `dashboardmodern:state-changed` event, the store reports through
 * `dashboardmodern:status`, and everything a person triggers begins with a
 * pointer event. Listening to those and coalescing into one pass per animation
 * frame costs nothing when nothing happens, and reaches the same DOM.
 */

const RENDER_EVENTS = Object.freeze([
  "dashboardmodern:state-changed",
  "dashboardmodern:status",
  "dashboardmodern:temperature-editor-rendered",
  /*
   * Boot draws things nothing else announces.
   *
   * The legacy runtime paints the "your dashboard is almost ready" banner and
   * the setup wizard while it comes up, before a single Home Assistant state
   * has arrived and before anyone has touched anything — so the events above
   * never fire, and the first pass has already run against an emptier page.
   * The keys were in the catalog and the banner still read English: the only
   * thing missing was a reason to look again.
   */
  "dashboardmodern:legacy-ready",
  "dashboardmodern:states-ready",
  "pageshow",
]);

/*
 * And once more when the page has settled.
 *
 * Some of that boot painting is announced by nothing at all — a wizard step
 * writing its own placeholder, a card the runtime fills on a timer. A short
 * tail of passes after load costs three walks of a page that is already
 * finished, and is the difference between a first run in the user's language
 * and a first run in English.
 */
const SETTLING_DELAYS = Object.freeze([250, 1000, 3000]);

let scheduledRoot = null;
let frameHandle = null;
let detach = null;

function runPass() {
  frameHandle = null;
  const target = scheduledRoot;
  if (!target) return;
  translateTree(target, getLocale());
}

/** Coalesce every trigger in a frame into a single walk. */
export function scheduleTranslation(rootNode = scheduledRoot) {
  if (!rootNode) return;
  scheduledRoot = rootNode;
  if (frameHandle !== null) return;
  const view = rootNode.ownerDocument?.defaultView || globalThis;
  frameHandle =
    typeof view.requestAnimationFrame === "function"
      ? view.requestAnimationFrame(runPass)
      : setTimeout(runPass, 16);
}

/**
 * Translate `rootNode` now and after every render the runtime announces.
 * Idempotent; returns a stop function.
 */
export function observeTranslations(rootNode = globalThis.document?.body) {
  if (!rootNode) return () => {};
  stopTranslations();
  scheduledRoot = rootNode;
  translateTree(rootNode, getLocale());

  const view = rootNode.ownerDocument?.defaultView || globalThis;
  const document = rootNode.ownerDocument || globalThis.document;
  const onRender = () => scheduleTranslation(rootNode);
  const listeners = [];

  for (const name of RENDER_EVENTS) {
    view.addEventListener?.(name, onRender);
    listeners.push(() => view.removeEventListener?.(name, onRender));
  }
  /* Capture phase, so the pass is queued before the handler that redraws runs;
     the frame callback still fires after it. Passive: this never intervenes. */
  for (const name of ["click", "change"]) {
    document?.addEventListener?.(name, onRender, { capture: true, passive: true });
    listeners.push(() => document?.removeEventListener?.(name, onRender, { capture: true }));
  }
  for (const delay of SETTLING_DELAYS) {
    const handle = view.setTimeout?.(() => scheduleTranslation(rootNode), delay);
    if (handle !== undefined) listeners.push(() => view.clearTimeout?.(handle));
  }

  const unsubscribe = onLocaleChange(() => {
    if (scheduledRoot) translateTree(scheduledRoot, getLocale());
  });

  detach = () => {
    for (const remove of listeners) remove();
    unsubscribe();
  };
  return stopTranslations;
}

export function stopTranslations() {
  detach?.();
  detach = null;
  scheduledRoot = null;
  if (frameHandle !== null) {
    clearTimeout(frameHandle);
    frameHandle = null;
  }
}
