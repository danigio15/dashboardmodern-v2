import { DEFAULT_CARD_REGISTRY } from "../cards/registry.js";
import { validateCardLayout } from "../layout.js";

function normalizePluginField(cardId, field = "config") {
  if (field === "config" || !field) return `card:${cardId}:config`;
  if (field.startsWith("config.")) return `card:${cardId}:config.${field.slice("config.".length)}`;
  return `card:${cardId}:config.${field}`;
}

export function validateRegisteredCardConfigs(dashboard, registry = DEFAULT_CARD_REGISTRY) {
  const errors = [];
  for (const card of dashboard?.cards || []) {
    const definition = registry.get(card?.type);
    if (!definition?.validateConfig) continue;
    for (const error of definition.validateConfig(card?.config || {})) {
      errors.push({ field: normalizePluginField(card.id, error.field), message: error.message });
    }
  }
  for (const card of dashboard?.cards || []) errors.push(...validateCardLayout(card?.layout, { cardId: card?.id }));
  return errors.sort((a, b) => String(a.field).localeCompare(String(b.field)));
}

export function replaceCardConfigErrors(validationErrors = [], cardId, nextErrors = []) {
  const prefix = `card:${cardId}:config`;
  return [...validationErrors.filter((error) => !error.field?.startsWith(prefix)), ...nextErrors];
}
