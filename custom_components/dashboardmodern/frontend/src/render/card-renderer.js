import { DEFAULT_CARD_REGISTRY, getCardType, registerCardType, renderUnknownCard } from "../cards/registry.js";
import { el, emptyState, safeDomId } from "./dom.js";

function cardShell(card, kind = "generic") {
  return el("article", { className: "dashboardmodern-card legacy-card", attrs: { id: safeDomId("card", card?.id), "data-card-id": card?.id ?? "", "data-card-kind": kind } });
}

export function renderGenericCard(card) { return renderUnknownCard(card); }

export function renderCard(card, context = {}, { registry = DEFAULT_CARD_REGISTRY } = {}) {
  const { cardRegistry: _cardRegistry, ...pluginContext } = context || {};
  try {
    if (!card || typeof card !== "object" || typeof card.type !== "string" || !card.config || typeof card.config !== "object" || Array.isArray(card.config)) {
      const fallback = cardShell(card, "malformed");
      fallback.append(el("h4", { text: "Malformed card" }));
      fallback.append(emptyState("This card could not be rendered because its payload is malformed."));
      return fallback;
    }
    const definition = getCardType(card.type, registry);
    if (!definition) return renderUnknownCard(card);
    return definition.renderer(card, pluginContext);
  } catch (error) {
    const fallback = cardShell(card, "error");
    fallback.append(el("h4", { text: card?.title || "Card rendering error" }));
    fallback.append(emptyState(`This card could not be rendered: ${error.message}`));
    return fallback;
  }
}

export function registerCardRenderer(type, renderer, registry = DEFAULT_CARD_REGISTRY) {
  return registerCardType({ type, displayName: type, renderer }, registry);
}

export function cardRendererTypes(registry = DEFAULT_CARD_REGISTRY) { return registry.types(); }
