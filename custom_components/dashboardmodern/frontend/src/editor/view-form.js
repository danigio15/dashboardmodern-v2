export function labeledInput(documentRef, labelText, value, onInput) {
  const label = documentRef.createElement("label");
  label.textContent = labelText;
  const input = documentRef.createElement("input");
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  label.append(input);
  return label;
}
