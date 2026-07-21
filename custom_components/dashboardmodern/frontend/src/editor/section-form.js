import { textInput } from "./dashboard-form.js";

export function renderSectionForm(documentRef, section, controller) {
  const form = documentRef.createElement("section");
  form.setAttribute("aria-label", "Section fields");
  const heading = documentRef.createElement("h3");
  heading.textContent = section ? `Selected section: ${section.title || section.id}` : "No section selected";
  form.append(heading);
  if (!section) return form;
  form.append(textInput(documentRef, "Section title", section.title || "", (title) => controller.updateSection(section.id, { title }), `section:${section.id}:title`));
  form.append(textInput(documentRef, "Section description", section.description || "", (description) => controller.updateSection(section.id, { description }), `section:${section.id}:description`));
  return form;
}
