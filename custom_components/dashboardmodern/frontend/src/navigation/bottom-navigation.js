import { elementWidth, navigationEntriesForSections, normalizeNavigationConfig, partitionItemsByMeasuredWidth, reducedMotion, shouldHideOnScroll, revealOnScroll } from "./navigation.js";
import { el } from "../render/dom.js";

function navItem(entry, activeId, menu = false) {
  const selected = entry.sectionId === activeId;
  const button = el("button", { className: "dashboardmodern-bottom-nav-item", attrs: { type: "button", "aria-current": selected ? "page" : "false", tabindex: selected ? "0" : "-1", "data-section-nav-id": entry.sectionId, "data-nav-menu-item": menu ? "true" : "false" } });
  button.append(el("span", { text: entry.icon || "•", attrs: { "aria-hidden": "true" } }));
  button.append(el("span", { text: entry.title, attrs: { "data-nav-label": "" } }));
  if (entry.badge) button.append(el("span", { className: "dashboardmodern-bottom-nav-badge", text: entry.badge.label || "", attrs: { "aria-label": entry.badge.ariaLabel || entry.badge.label || "Navigation badge" } }));
  return button;
}

export function renderBottomNavigation(dashboard, activeSectionId) {
  const config = normalizeNavigationConfig(dashboard?.config);
  const entries = navigationEntriesForSections(dashboard?.sections || []);
  const nav = el("nav", { className: `dashboardmodern-bottom-nav is-${config.visibilityMode} overflow-${config.overflowMode} size-${config.itemSize}`, attrs: { "aria-label": "Dashboard sections", "data-bottom-navigation": "", "data-safe-area-bottom": "true" } });
  nav.dataset.showLabels = String(config.showLabels); nav.dataset.compact = String(config.compactMode); nav.dataset.edgeIndicators = String(config.edgeIndicators); nav.dataset.autoHideDelay = String(config.autoHideDelay);
  nav.append(el("span", { className: "dashboardmodern-bottom-nav-edge dashboardmodern-bottom-nav-edge-left", attrs: { "data-nav-edge": "left", "aria-hidden": "true", hidden: "" } }));
  const scroller = el("div", { className: "dashboardmodern-bottom-nav-scroll", attrs: { "data-nav-scroll": "" } });
  for (const entry of entries) scroller.append(navItem(entry, activeSectionId));
  nav.append(scroller);
  const more = el("details", { className: "dashboardmodern-bottom-nav-more", attrs: { "data-nav-more": "", hidden: "" } });
  more.append(el("summary", { text: "More", attrs: { "data-nav-more-summary": "" } }));
  const list = el("div", { className: "dashboardmodern-bottom-nav-more-list", attrs: { "data-nav-more-list": "" } });
  for (const entry of entries) list.append(navItem(entry, activeSectionId, true));
  more.append(list); nav.append(more);
  nav.append(el("span", { className: "dashboardmodern-bottom-nav-edge dashboardmodern-bottom-nav-edge-right", attrs: { "data-nav-edge": "right", "aria-hidden": "true", hidden: "" } }));
  return nav;
}

export class BottomNavigationController {
  constructor(container, store, { ResizeObserverClass = globalThis.ResizeObserver, setTimer = setTimeout, clearTimer = clearTimeout } = {}) { this.container = container; this.store = store; this.ResizeObserverClass = ResizeObserverClass; this.setTimer = setTimer; this.clearTimer = clearTimer; this.lastY = 0; this.hideTimer = null; this.bound = []; this.resizeObserver = null; this.lastActiveSectionId = null; }
  start() { this.on(this.container, "click", (event) => this.handleClick(event)); this.on(this.container, "keydown", (event) => this.handleKeydown(event)); this.on(this.container, "scroll", () => this.handleScroll(), { passive: true }); this.on(this.container, "focusin", () => this.reveal()); this.on(this.container, "pointermove", (event) => this.handlePointer(event)); if (this.ResizeObserverClass) { this.resizeObserver = new this.ResizeObserverClass(() => this.recalculate()); this.resizeObserver.observe?.(this.container); } }
  on(target, type, fn, options) { target?.addEventListener?.(type, fn, options); this.bound.push([target, type, fn, options]); }
  destroy() { for (const [target, type, fn, options] of this.bound) target?.removeEventListener?.(type, fn, options); this.bound = []; this.resizeObserver?.disconnect?.(); this.cancelHide(); }
  nav() { return this.container?.querySelector?.("[data-bottom-navigation]"); }
  scrollArea() { return this.container?.querySelector?.("[data-nav-scroll]"); }
  activeButton() { const id = this.store?.state?.activeSectionId; return id ? this.container?.querySelector?.(`[data-section-nav-id="${id}"][data-nav-menu-item="false"]`) : null; }
  recalculate() { const nav = this.nav(); const scroller = this.scrollArea(); if (!nav || !scroller) return; const more = nav.querySelector?.("[data-nav-more]"); const items = [...scroller.querySelectorAll?.('[data-nav-menu-item="false"]') || []]; const total = items.reduce((sum, item) => sum + elementWidth(item), 0); const available = elementWidth(scroller) || scroller.clientWidth || nav.clientWidth || 0; const fits = !available || total <= available + 1; nav.dataset.overflowing = String(!fits); scroller.style.overflowX = fits ? "hidden" : "auto"; if (nav.className.includes("overflow-more-menu") && !fits) { more.hidden = false; const moreWidth = elementWidth(more.querySelector?.("summary")) || elementWidth(more) || 64; const parts = partitionItemsByMeasuredWidth(items, available, moreWidth); const visibleIds = new Set(parts.visible.map((item) => item.dataset.sectionNavId)); const overflowIds = new Set(parts.overflow.map((item) => item.dataset.sectionNavId)); for (const item of items) item.hidden = !visibleIds.has(item.dataset.sectionNavId); for (const item of more.querySelectorAll?.("[data-section-nav-id]") || []) item.hidden = !overflowIds.has(item.dataset.sectionNavId); const summary = more.querySelector?.("[data-nav-more-summary]"); if (summary) summary.textContent = parts.overflow.some((item) => item.dataset.sectionNavId === this.store?.state?.activeSectionId) ? "More •" : "More"; } else { more.hidden = true; for (const item of items) item.hidden = false; }
    this.updateEdges(); this.revealActiveItem(); }
  updateEdges() { const nav = this.nav(); const scroller = this.scrollArea(); if (!nav || !scroller) return; const left = nav.querySelector?.('[data-nav-edge="left"]'); const right = nav.querySelector?.('[data-nav-edge="right"]'); const overflowing = scroller.scrollWidth > scroller.clientWidth + 1; const show = nav.dataset.edgeIndicators === "true" && overflowing; if (left) left.hidden = !show || scroller.scrollLeft <= 1; if (right) right.hidden = !show || scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1; }
  revealActiveItem() { const item = this.activeButton(); if (!item) return; item.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" }); }
  syncActive() { const current = this.store?.state?.activeSectionId; if (current !== this.lastActiveSectionId) { this.lastActiveSectionId = current; this.reveal(); this.recalculate(); } }
  scheduleHide() { const nav = this.nav(); if (!nav || !nav.className.includes("is-auto-hide")) return; this.cancelHide(); const delay = Number(nav.dataset.autoHideDelay) || 2500; this.hideTimer = this.setTimer(() => { const latest = this.nav(); if (latest?.matches?.(":focus-within")) return; if (latest) latest.dataset.hidden = "true"; }, delay); }
  cancelHide() { if (this.hideTimer) this.clearTimer(this.hideTimer); this.hideTimer = null; }
  reveal() { const nav = this.nav(); if (nav) nav.dataset.hidden = "false"; this.scheduleHide(); }
  handleScroll() { const y = this.container?.scrollTop || 0; const nav = this.nav(); if (!nav || !nav.className.includes("is-auto-hide")) { this.lastY = y; return; } if (revealOnScroll(this.lastY, y)) this.reveal(); else if (shouldHideOnScroll(this.lastY, y)) { nav.dataset.hidden = "true"; this.scheduleHide(); } this.lastY = y; }
  handlePointer(event) { const height = this.container?.clientHeight || globalThis.innerHeight || 0; if (height && event?.clientY >= height - 80) this.reveal(); }
  handleClick(event) { const button = event.target?.closest?.("[data-section-nav-id]"); if (!button) return; this.cancelHide(); const sectionId = button.dataset.sectionNavId; this.store?.setActiveSection?.(sectionId); this.container.querySelector?.(`#section-${sectionId}`)?.scrollIntoView?.({ block: "start", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" }); }
  handleKeydown(event) { const current = event.target?.closest?.('[data-section-nav-id][data-nav-menu-item="false"]'); if (!current || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return; const tabs = [...this.container.querySelectorAll('[data-section-nav-id][data-nav-menu-item="false"]')].filter((item) => !item.hidden); const index = tabs.indexOf(current); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click(); }
}
export function bindBottomNavigation(container, store, options) { const controller = new BottomNavigationController(container, store, options); controller.start(); return controller; }
