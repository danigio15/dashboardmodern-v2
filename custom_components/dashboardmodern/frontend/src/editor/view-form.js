import { textInput } from "./dashboard-form.js";

export function renderViewForm(documentRef, view, controller) {
  const form = documentRef.createElement("section");
  form.setAttribute("aria-label", "View fields");
  const heading = documentRef.createElement("h3");
  heading.textContent = view ? `Selected view: ${view.title || view.id}` : "No view selected";
  form.append(heading);
  if (!view) return form;
  form.append(textInput(documentRef, "View title", view.title || "", (title) => controller.updateView(view.id, { title }), `view:${view.id}:title`));
  form.append(textInput(documentRef, "View description", view.description || "", (description) => controller.updateView(view.id, { description }), `view:${view.id}:description`));
  return form;
}
