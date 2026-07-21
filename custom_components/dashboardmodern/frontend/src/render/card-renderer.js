import { el, emptyState, safeDomId } from "./dom.js";

const renderers = new Map();

function cardShell(card, kind = "generic") {
  return el("article", {
    className: "dashboardmodern-card",
    attrs: { id: safeDomId("card", card?.id), "data-card-id": card?.id ?? "", "data-card-kind": kind },
  });
}

function renderCardTitle(shell, card) {
  shell.append(el("h4", { text: card?.title || "Untitled card" }));
}

export function registerCardRenderer(type, renderer) {
  if (typeof type === "string" && type.trim() && typeof renderer === "function") {
    renderers.set(type, renderer);
  }
}

export function renderGenericCard(card) {
  const shell = cardShell(card, "generic");
  renderCardTitle(shell, card);
  shell.append(el("p", { className: "dashboardmodern-card-type", text: `Card type: ${card?.type || "unknown"}` }));
  if (card?.config && typeof card.config === "object" && !Array.isArray(card.config)) {
    const keys = Object.keys(card.config).sort();
    shell.append(el("p", { text: keys.length ? `Configuration keys: ${keys.join(", ")}` : "No card configuration." }));
  }
  return shell;
}

export function renderCard(card, context = {}) {
  void context;
  try {
    if (!card || typeof card !== "object" || typeof card.type !== "string") {
      const fallback = cardShell(card, "malformed");
      fallback.append(el("h4", { text: "Malformed card" }));
      fallback.append(emptyState("This card could not be rendered because its payload is malformed."));
      return fallback;
    }
    const renderer = renderers.get(card.type) || renderGenericCard;
    const rendered = renderer(card, context);
    if (renderer === renderGenericCard) rendered.dataset.unsupportedCardType = card.type;
    return rendered;
  } catch (error) {
    const fallback = cardShell(card, "error");
    fallback.append(el("h4", { text: card?.title || "Card rendering error" }));
    fallback.append(emptyState(`This card could not be rendered: ${error.message}`));
    return fallback;
  }
}

export function cardRendererTypes() {
  return [...renderers.keys()].sort();
}
