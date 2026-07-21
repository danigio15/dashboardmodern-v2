export const NAV_DEFAULTS = Object.freeze({ placement: "bottom", visibilityMode: "fixed", overflowMode: "scroll", showLabels: true, compactMode: false, itemSize: "medium", autoHideDelay: 2500, edgeIndicators: true });
const allowed = { placement: ["bottom"], visibilityMode: ["fixed", "auto-hide"], overflowMode: ["scroll", "more-menu"], itemSize: ["small", "medium", "large"] };
export function normalizeNavigationConfig(config = {}) {
  const nav = config?.navigation || config || {};
  return { ...NAV_DEFAULTS, placement: allowed.placement.includes(nav.placement) ? nav.placement : NAV_DEFAULTS.placement, visibilityMode: allowed.visibilityMode.includes(nav.visibilityMode) ? nav.visibilityMode : NAV_DEFAULTS.visibilityMode, overflowMode: allowed.overflowMode.includes(nav.overflowMode) ? nav.overflowMode : NAV_DEFAULTS.overflowMode, showLabels: typeof nav.showLabels === "boolean" ? nav.showLabels : NAV_DEFAULTS.showLabels, compactMode: typeof nav.compactMode === "boolean" ? nav.compactMode : NAV_DEFAULTS.compactMode, itemSize: allowed.itemSize.includes(nav.itemSize) ? nav.itemSize : NAV_DEFAULTS.itemSize, autoHideDelay: Number.isFinite(Number(nav.autoHideDelay)) && Number(nav.autoHideDelay) >= 500 && Number(nav.autoHideDelay) <= 10000 ? Number(nav.autoHideDelay) : NAV_DEFAULTS.autoHideDelay, edgeIndicators: typeof nav.edgeIndicators === "boolean" ? nav.edgeIndicators : NAV_DEFAULTS.edgeIndicators };
}
export function validateNavigationConfig(config = {}) {
  const nav = config?.navigation || config || {}; const errors = [];
  for (const key of ["visibilityMode", "overflowMode", "itemSize"]) if (nav[key] !== undefined && !allowed[key].includes(nav[key])) errors.push({ field: `dashboard.config.navigation.${key}`, message: `Invalid ${key}.` });
  if (nav.autoHideDelay !== undefined && (!Number.isFinite(Number(nav.autoHideDelay)) || Number(nav.autoHideDelay) < 500 || Number(nav.autoHideDelay) > 10000)) errors.push({ field: "dashboard.config.navigation.autoHideDelay", message: "Auto-hide delay must be between 500 and 10000 ms." });
  return errors;
}
export function normalizeSectionNavigation(section, index = 0) {
  const nav = section?.navigation || {};
  const legacy = { enabled: section?.enabled, visibleInNavbar: section?.visibleInNavbar, title: section?.title, icon: section?.icon, accent: section?.accent, order: section?.order, badge: section?.badge, visibility: section?.visibility };
  const merged = { ...legacy, ...nav };
  return { sectionId: section?.id || "", type: section?.type || "custom", title: merged.title ?? section?.id ?? "Section", icon: merged.icon ?? section?.type ?? "section", accent: merged.accent ?? "", enabled: merged.enabled ?? true, visibleInNavbar: merged.visibleInNavbar ?? true, order: Number.isFinite(Number(merged.order)) ? Number(merged.order) : index, badge: merged.badge ?? null, visibility: merged.visibility ?? { enabled: true, condition: "always" } };
}
export const sectionNavigationEntry = normalizeSectionNavigation;
export function navigationEntriesForSections(sections = []) { return (sections || []).map(normalizeSectionNavigation).filter((entry) => entry.enabled !== false && entry.visibleInNavbar !== false && entry.visibility?.enabled !== false).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title) || a.sectionId.localeCompare(b.sectionId)); }
export function selectActiveSectionId(dashboard, activeViewId, requestedSectionId) {
  const entries = navigationEntriesForSections(dashboard?.sections || []); const ids = new Set(entries.map((entry) => entry.sectionId));
  if (requestedSectionId && ids.has(requestedSectionId)) return requestedSectionId;
  const activeView = (dashboard?.views || []).find((view) => view.id === activeViewId) || dashboard?.views?.[0];
  return (activeView?.section_ids || []).find((id) => ids.has(id)) || entries[0]?.sectionId || null;
}
export function measureOverflow(container) { return Boolean(container && container.scrollWidth > container.clientWidth + 1); }
export function elementWidth(element) { if (!element) return 0; const rect = element.getBoundingClientRect?.(); return Math.ceil(rect?.width || element.offsetWidth || element.clientWidth || Number(element.dataset?.testWidth) || 0); }
export function splitMoreMenuItems(entries, availableWidth, itemWidth = 96) { if (!Number.isFinite(availableWidth) || availableWidth <= 0) return { visible: entries, overflow: [] }; if (entries.length * itemWidth <= availableWidth) return { visible: entries, overflow: [] }; const moreWidth = itemWidth; const count = Math.max(0, Math.floor((availableWidth - moreWidth) / itemWidth)); return { visible: entries.slice(0, count), overflow: entries.slice(count) }; }
export function measuredGap(element, fallback = 0) { const value = globalThis.getComputedStyle?.(element)?.columnGap || globalThis.getComputedStyle?.(element)?.gap || ""; const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : fallback; }
export function partitionItemsByMeasuredWidth(items, availableWidth, moreWidth, gap = 0, moreGap = gap) { let used = Math.max(0, moreWidth) + Math.max(0, moreGap); let count = 0; for (const item of items) { const width = elementWidth(item); const next = used + width + (count > 0 ? Math.max(0, gap) : 0); if (next > availableWidth + 0.5) break; used = next; count += 1; } return { visible: items.slice(0, count), overflow: items.slice(count), usedWidth: used }; }
export function revealOnScroll(prevY, nextY, threshold = 8) { return prevY - nextY > threshold; }
export function shouldHideOnScroll(prevY, nextY, threshold = 8) { return nextY - prevY > threshold; }
export function reducedMotion() { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; }
