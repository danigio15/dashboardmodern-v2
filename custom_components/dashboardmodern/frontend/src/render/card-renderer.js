import { DEFAULT_CARD_REGISTRY, getCardType, registerCardType, renderUnknownCard } from "../cards/registry.js";
import { normalizeCardLayout } from "../layout.js";
import { el, emptyState, safeDomId } from "./dom.js";
import { REORDER_INSTRUCTIONS } from "../editor/reorder.js";

function applyLayout(element, card) {
  const normalized = normalizeCardLayout(card);
  element.dataset.layoutStatus = normalized.status;
  for (const [breakpoint, span] of Object.entries(normalized.layout)) {
    if (!element.style) element.style = {};
    if (typeof element.style.setProperty === "function") {
      element.style.setProperty(`--dm-card-columns-${breakpoint}`, String(span.columns));
      element.style.setProperty(`--dm-card-rows-${breakpoint}`, String(span.rows));
    } else {
      element.style[`--dm-card-columns-${breakpoint}`] = String(span.columns);
      element.style[`--dm-card-rows-${breakpoint}`] = String(span.rows);
    }
  }
  if (normalized.errors.length) {
    const message = el("p", { className: "dashboardmodern-layout-error", text: `Layout uses safe defaults: ${normalized.errors.map((error) => error.message).join(" ")}` });
    message.dataset.kind = "error";
    element.prepend ? element.prepend(message) : element.append(message);
  }
  return element;
}

function withDragHandle(shell, card, context = {}) {
  if (!context.editMode) return shell;
  const title = card?.title || card?.id || "Untitled card";
  const handle = el("button", { className: "dashboardmodern-drag-handle", text: "Move", attrs: { type: "button", "data-reorder-handle": "", "data-card-id": card?.id ?? "", "aria-label": `Move card: ${title}`, "aria-describedby": "dashboardmodern-reorder-instructions" } });
  shell.prepend ? shell.prepend(handle) : shell.append(handle);
  return shell;
}

function cardShell(card, kind = "generic", context = {}) {
  return withDragHandle(applyLayout(el("article", { className: "dashboardmodern-card legacy-card", attrs: { id: safeDomId("card", card?.id), "data-card-id": card?.id ?? "", "data-card-kind": kind } }), card), card, context);
}

export function renderGenericCard(card) { return renderUnknownCard(card); }

export function renderCard(card, context = {}, { registry = DEFAULT_CARD_REGISTRY } = {}) {
  const { cardRegistry: _cardRegistry, ...pluginContext } = context || {};
  try {
    if (!card || typeof card !== "object" || typeof card.type !== "string" || !card.config || typeof card.config !== "object" || Array.isArray(card.config)) {
      const fallback = cardShell(card, "malformed", context);
      fallback.append(el("h4", { text: "Malformed card" }));
      fallback.append(emptyState("This card could not be rendered because its payload is malformed."));
      return fallback;
    }
    const definition = getCardType(card.type, registry);
    if (!definition) return withDragHandle(applyLayout(renderUnknownCard(card), card), card, context);
    return withDragHandle(applyLayout(definition.renderer(card, pluginContext), card), card, context);
  } catch (error) {
    const fallback = cardShell(card, "error", context);
    fallback.append(el("h4", { text: card?.title || "Card rendering error" }));
    fallback.append(emptyState(`This card could not be rendered: ${error.message}`));
    return fallback;
  }
}

export function registerCardRenderer(type, renderer, registry = DEFAULT_CARD_REGISTRY) {
  return registerCardType({ type, displayName: type, renderer }, registry);
}

export function cardRendererTypes(registry = DEFAULT_CARD_REGISTRY) { return registry.types(); }
