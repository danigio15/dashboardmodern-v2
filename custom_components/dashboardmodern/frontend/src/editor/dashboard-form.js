function labeledControl(documentRef, labelText, control) {
  const label = documentRef.createElement("label");
  label.textContent = labelText;
  label.append(control);
  return label;
}

export function textInput(documentRef, labelText, value, onInput) {
  const input = documentRef.createElement("input");
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  return labeledControl(documentRef, labelText, input);
}

export function textareaInput(documentRef, labelText, value, onInput) {
  const textarea = documentRef.createElement("textarea");
  textarea.value = value || "";
  textarea.addEventListener("input", () => onInput(textarea.value));
  return labeledControl(documentRef, labelText, textarea);
}

export function fieldError(documentRef, message) {
  const error = documentRef.createElement("p");
  error.dataset.kind = "error";
  error.textContent = message;
  return error;
}

export function renderDashboardForm(documentRef, dashboard, controller) {
  const form = documentRef.createElement("section");
  form.setAttribute("aria-label", "Dashboard fields");
  form.append(textInput(documentRef, "Dashboard title", dashboard?.title || "", (title) => controller.updateDashboard({ title })));
  form.append(textInput(documentRef, "Dashboard description", dashboard?.description || "", (description) => controller.updateDashboard({ description })));
  return form;
}
