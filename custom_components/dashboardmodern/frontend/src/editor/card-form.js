import { getCardType, listCardTypes } from "../cards/registry.js";
import { fieldError, textInput, textareaInput } from "./dashboard-form.js";

function errorFor(errors, field) { return (errors || []).find((error) => error.field === field || error.field?.endsWith(`:${field}`)); }
function errorsForCardConfig(errors, cardId) { return (errors || []).filter((error) => error.field === `card:${cardId}:config` || error.field?.startsWith(`card:${cardId}:config.`)); }

export function renderCardForm(documentRef, card, controller, validationErrors = [], fieldText = {}) {
  const form = documentRef.createElement("section"); form.setAttribute("aria-label", "Card fields");
  const heading = documentRef.createElement("h3"); heading.textContent = card ? `Selected card: ${card.title || card.id}` : "No card selected"; form.append(heading); if (!card) return form;
  form.append(textInput(documentRef, "Card title", card.title || "", (title) => controller.updateCard(card.id, { title }), `card:${card.id}:title`));
  form.append(textInput(documentRef, "Card type", card.type || "", (type) => controller.changeCardType(card.id, type), `card:${card.id}:type`));
  const typeLabel = documentRef.createElement("label"); typeLabel.textContent = "Registered card type ";
  const select = documentRef.createElement("select"); select.dataset.editorField = `card:${card.id}:registeredType`;
  const types = listCardTypes(); const currentRegistered = Boolean(getCardType(card.type));
  if (!currentRegistered) { const option = documentRef.createElement("option"); option.value = card.type || ""; option.textContent = card.type ? `${card.type} (unregistered)` : "Unregistered"; option.selected = true; select.append(option); }
  for (const definition of types) { const option = documentRef.createElement("option"); option.value = definition.type; option.textContent = definition.displayName; option.selected = definition.type === card.type; select.append(option); }
  select.addEventListener("change", () => controller.changeCardType(card.id, select.value)); typeLabel.append(select); form.append(typeLabel);
  const definition = getCardType(card.type);
  const configErrors = errorsForCardConfig(validationErrors, card.id);
  if (definition?.editor) form.append(definition.editor(documentRef, card, controller, configErrors));
  const configField = `card:${card.id}:config`;
  const details = documentRef.createElement("details"); details.open = !definition?.editor || !currentRegistered;
  const summary = documentRef.createElement("summary"); summary.textContent = definition?.editor ? "Advanced JSON fallback" : "Card config JSON"; details.append(summary);
  details.append(textareaInput(documentRef, "Card config JSON", fieldText[configField] ?? JSON.stringify(card.config || {}, null, 2), (configText) => controller.updateCardConfig(card.id, configText), configField));
  form.append(details);
  const configError = errorFor(validationErrors, "config"); if (configError) form.append(fieldError(documentRef, configError.message));
  return form;
}
