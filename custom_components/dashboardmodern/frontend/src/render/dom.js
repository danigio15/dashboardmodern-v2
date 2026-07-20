export function safeDomId(prefix, value) {
  const safe = String(value ?? "missing")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `${prefix}-${safe || "item"}`;
}

export function el(tag, { className, text, attrs = {}, dataset = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  for (const [name, value] of Object.entries(dataset)) {
    if (value !== undefined && value !== null) node.dataset[name] = String(value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

export function emptyState(message) {
  return el("p", { className: "dashboardmodern-empty", text: message });
}
