import { DEFAULT_CARD_REGISTRY, getCardType, listCardTypes } from "../cards/registry.js";
import { BREAKPOINT_NAMES, LAYOUT_BREAKPOINTS, normalizeCardLayout } from "../layout.js";
import { fieldError, textInput, textareaInput } from "./dashboard-form.js";

function errorFor(errors, field) { return (errors || []).find((error) => error.field === field || error.field?.endsWith(`:${field}`)); }
function errorsForCardConfig(errors, cardId) { return (errors || []).filter((error) => error.field === `card:${cardId}:config` || error.field?.startsWith(`card:${cardId}:config.`)); }
function errorForField(errors, field) { return (errors || []).find((error) => error.field === field); }
function renderLayoutForm(documentRef, card, controller, validationErrors) {
  const section = documentRef.createElement("fieldset");
  section.className = "dashboardmodern-layout-editor";
  const legend = documentRef.createElement("legend"); legend.textContent = "Layout"; section.append(legend);
  const normalized = normalizeCardLayout(card);
  for (const breakpoint of BREAKPOINT_NAMES) {
    const group = documentRef.createElement("div"); group.className = "dashboardmodern-layout-editor-group";
    const title = documentRef.createElement("h4"); title.textContent = breakpoint[0].toUpperCase() + breakpoint.slice(1); group.append(title);
    for (const [field, labelText] of [["columns", "Width / columns"], ["rows", "Height / rows"]]) {
      const id = `dm-layout-${card.id}-${breakpoint}-${field}`;
      const label = documentRef.createElement("label"); label.setAttribute("for", id); label.textContent = labelText;
      const input = documentRef.createElement("input"); input.id = id; input.type = "number"; input.min = "1"; input.max = String(field === "columns" ? LAYOUT_BREAKPOINTS[breakpoint].columns : LAYOUT_BREAKPOINTS[breakpoint].rows); input.step = "1"; input.value = String(normalized.layout[breakpoint][field]); input.dataset.editorField = `card:${card.id}:layout.${breakpoint}.${field}`;
      const helper = documentRef.createElement("p"); helper.className = "dashboardmodern-layout-help"; helper.textContent = field === "columns" ? `${LAYOUT_BREAKPOINTS[breakpoint].columns} columns available.` : "Up to 12 row units; content may grow if needed.";
      const err = errorForField(validationErrors, input.dataset.editorField);
      if (err) { const e = fieldError(documentRef, err.message); e.id = `${id}-error`; input.setAttribute("aria-describedby", e.id); input.setAttribute("aria-invalid", "true"); label.append(input, helper, e); } else label.append(input, helper);
      input.addEventListener("input", () => controller.updateCardLayoutValue(card.id, breakpoint, field, input.value));
      group.append(label);
    }
    section.append(group);
  }
  if (normalized.errors.length) section.append(fieldError(documentRef, "Persisted layout is malformed; safe defaults are previewed until corrected."));
  return section;
}

export function renderCardForm(documentRef, card, controller, validationErrors = [], fieldText = {}, registry = DEFAULT_CARD_REGISTRY) {
  const form = documentRef.createElement("section"); form.setAttribute("aria-label", "Card fields");
  const heading = documentRef.createElement("h3"); heading.textContent = card ? `Selected card: ${card.title || card.id}` : "No card selected"; form.append(heading); if (!card) return form;
  form.append(textInput(documentRef, "Card title", card.title || "", (title) => controller.updateCard(card.id, { title }), `card:${card.id}:title`));
  form.append(textInput(documentRef, "Card type", card.type || "", (type) => controller.changeCardType(card.id, type), `card:${card.id}:type`));
  const typeLabel = documentRef.createElement("label"); typeLabel.textContent = "Registered card type ";
  const select = documentRef.createElement("select"); select.dataset.editorField = `card:${card.id}:registeredType`;
  const types = listCardTypes(registry); const currentRegistered = Boolean(getCardType(card.type, registry));
  if (!currentRegistered) { const option = documentRef.createElement("option"); option.value = card.type || ""; option.textContent = card.type ? `${card.type} (unregistered)` : "Unregistered"; option.selected = true; select.append(option); }
  for (const definition of types) { const option = documentRef.createElement("option"); option.value = definition.type; option.textContent = definition.displayName; option.selected = definition.type === card.type; select.append(option); }
  select.addEventListener("change", () => controller.changeCardType(card.id, select.value)); typeLabel.append(select); form.append(typeLabel);
  const definition = getCardType(card.type, registry);
  const configErrors = errorsForCardConfig(validationErrors, card.id);
  if (definition?.editor) form.append(definition.editor(documentRef, card, controller, configErrors, fieldText));
  const configField = `card:${card.id}:config`;
  const details = documentRef.createElement("details"); details.open = !definition?.editor || !currentRegistered;
  const summary = documentRef.createElement("summary"); summary.textContent = definition?.editor ? "Advanced JSON fallback" : "Card config JSON"; details.append(summary);
  details.append(textareaInput(documentRef, "Card config JSON", fieldText[configField] ?? JSON.stringify(card.config || {}, null, 2), (configText) => controller.updateCardConfig(card.id, configText), configField));
  form.append(details);
  form.append(renderLayoutForm(documentRef, card, controller, validationErrors));
  const configError = errorFor(validationErrors, "config"); if (configError) form.append(fieldError(documentRef, configError.message));
  return form;
}
