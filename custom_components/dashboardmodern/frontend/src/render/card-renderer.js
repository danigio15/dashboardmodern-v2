import { getCardType, renderUnknownCard } from "../cards/registry.js";
import { registerLegacyPanelCard } from "../cards/legacy-panel.js";
import { el, emptyState, safeDomId } from "./dom.js";

try { registerLegacyPanelCard(); } catch (error) { if (!/already registered/.test(error.message)) throw error; }

function cardShell(card, kind = "generic") { return el("article", { className: "dashboardmodern-card legacy-card", attrs: { id: safeDomId("card", card?.id), "data-card-id": card?.id ?? "", "data-card-kind": kind } }); }
function renderCardTitle(shell, card) { shell.append(el("h4", { text: card?.title || "Untitled card" })); }

export function renderGenericCard(card) { return renderUnknownCard(card); }

export function renderCard(card, context = {}) {
  try {
    if (!card || typeof card !== "object" || typeof card.type !== "string" || !card.config || typeof card.config !== "object" || Array.isArray(card.config)) {
      const fallback = cardShell(card, "malformed"); fallback.append(el("h4", { text: "Malformed card" })); fallback.append(emptyState("This card could not be rendered because its payload is malformed.")); return fallback;
    }
    const definition = getCardType(card.type);
    if (!definition) return renderUnknownCard(card);
    return definition.renderer(card, context);
  } catch (error) {
    const fallback = cardShell(card, "error"); fallback.append(el("h4", { text: card?.title || "Card rendering error" })); fallback.append(emptyState(`This card could not be rendered: ${error.message}`)); return fallback;
  }
}
export function cardRendererTypes() { return []; }
