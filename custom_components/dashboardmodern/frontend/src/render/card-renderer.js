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
  if (card?.config && typeof card.config === "object") {
    const keys = Object.keys(card.config).sort();
    shell.append(el("p", { text: keys.length ? `Configuration keys: ${keys.join(", ")}` : "No card configuration." }));
  }
  return shell;
}

export function renderTextCard(card) {
  const shell = cardShell(card, "text");
  renderCardTitle(shell, card);
  const config = card?.config && typeof card.config === "object" ? card.config : {};
  shell.append(el("p", { text: config.text || config.message || card?.description || "No text configured." }));
  return shell;
}

export function renderEntityStateCard(card, { hass } = {}) {
  const shell = cardShell(card, "entity-state");
  renderCardTitle(shell, card);
  const entityId = card?.config?.entity_id || card?.config?.entity;
  if (!entityId) {
    shell.append(emptyState("Entity card is missing an entity id."));
    return shell;
  }
  const entity = hass?.states?.[entityId];
  shell.append(el("div", { className: "dashboardmodern-entity-id", text: entityId }));
  shell.append(el("div", {
    className: "dashboardmodern-entity-state",
    text: entity ? `${entity.state}${entity.attributes?.unit_of_measurement ? ` ${entity.attributes.unit_of_measurement}` : ""}` : "Entity state unavailable",
  }));
  if (entity?.attributes?.friendly_name) shell.append(el("p", { text: entity.attributes.friendly_name }));
  return shell;
}

registerCardRenderer("text", renderTextCard);
registerCardRenderer("markdown", renderTextCard);
registerCardRenderer("info", renderTextCard);
registerCardRenderer("entity", renderEntityStateCard);
registerCardRenderer("entity_state", renderEntityStateCard);

export function renderCard(card, context = {}) {
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
