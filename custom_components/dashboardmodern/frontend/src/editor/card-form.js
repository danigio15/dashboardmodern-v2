import { fieldError, textInput, textareaInput } from "./dashboard-form.js";

function errorFor(errors, field) {
  return (errors || []).find((error) => error.field === field || error.field?.endsWith(`:${field}`));
}

export function renderCardForm(documentRef, card, controller, validationErrors = []) {
  const form = documentRef.createElement("section");
  form.setAttribute("aria-label", "Card fields");
  const heading = documentRef.createElement("h3");
  heading.textContent = card ? `Selected card: ${card.title || card.id}` : "No card selected";
  form.append(heading);
  if (!card) return form;

  form.append(textInput(documentRef, "Card title", card.title || "", (title) => controller.updateCard(card.id, { title })));
  form.append(textInput(documentRef, "Card type", card.type || "", (type) => controller.updateCard(card.id, { type })));
  form.append(textareaInput(documentRef, "Card config JSON", JSON.stringify(card.config || {}, null, 2), (configText) => controller.updateCardConfig(card.id, configText)));
  const configError = errorFor(validationErrors, "config");
  if (configError) form.append(fieldError(documentRef, configError.message));
  return form;
}
