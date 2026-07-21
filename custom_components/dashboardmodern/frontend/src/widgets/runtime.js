import { DEFAULT_WIDGET_REGISTRY, defaultWidgetContract, validateWidgetContract } from "./registry.js";
import { el, emptyState, safeDomId } from "../render/dom.js";

const SIZES = new Set(["small", "medium", "large", "full"]);
export function normalizeWidgetSize(widget = {}) { const size = widget?.layout?.size || widget?.size || "medium"; return SIZES.has(size) ? size : "medium"; }
export function renderUnknownWidget(widget = {}) {
  const node = el("article", { className: "dm-widget dm-widget-unknown", attrs: { id: safeDomId("widget", widget.id), "data-widget-id": widget.id || "", "data-widget-type": widget.type || "", "data-widget-size": normalizeWidgetSize(widget), "data-unsupported-widget": "" } });
  node.append(el("h3", { text: widget.title || "Unsupported widget" }));
  node.append(emptyState(`Unsupported widget type: ${widget.type || "missing"}. It remains safe to edit and save.`));
  return node;
}
export function renderWidget(widget, context = {}, registry = DEFAULT_WIDGET_REGISTRY) {
  const normalized = defaultWidgetContract(widget || {});
  const errors = validateWidgetContract(normalized);
  const definition = registry.get(normalized.type);
  if (errors.length || !definition?.renderer) return renderUnknownWidget(normalized);
  const merged = { ...normalized, config: { ...(typeof definition.defaultConfig === "function" ? definition.defaultConfig() : {}), ...normalized.config } };
  const validation = definition.validator?.(merged.config, merged) || [];
  if (validation.length) return renderUnknownWidget(merged);
  const node = definition.renderer(merged, context);
  node.dataset.widgetId = merged.id; node.dataset.widgetType = merged.type; node.dataset.widgetSize = normalizeWidgetSize(merged);
  return node;
}
export function renderWidgetLayout(widgets = [], context = {}, registry = DEFAULT_WIDGET_REGISTRY) {
  const grid = el("div", { className: "dm-widget-grid", attrs: { "data-widget-layout": "" } });
  for (const widget of widgets.filter((w) => w?.enabled !== false && w?.visibility?.enabled !== false)) grid.append(renderWidget(widget, context, registry));
  if (!grid.children.length) grid.append(emptyState("No widgets configured."));
  return grid;
}
