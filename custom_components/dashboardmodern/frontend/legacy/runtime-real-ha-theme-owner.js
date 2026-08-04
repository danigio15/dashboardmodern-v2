/* DashboardModern 0.15.1 — final theme owner for embedded Home Assistant. */
(function installRealHaThemeOwner0151(root) {
  "use strict";
  const KEY = "__DASHBOARDMODERN_REAL_HA_THEME_OWNER_0151__";
  if (!root.document || root[KEY]?.installed) return;
  const doc = root.document;
  const state = (root[KEY] = { installed: true, scheduled: false });
  const clean = (value) => String(value ?? "").trim();

  function channels(value) {
    const raw = clean(value).toLowerCase();
    const hex = /^#([0-9a-f]{6})$/i.exec(raw);
    if (hex) return [0, 2, 4].map((index) => Number.parseInt(hex[1].slice(index, index + 2), 16));
    const short = /^#([0-9a-f]{3})$/i.exec(raw);
    if (short) return short[1].split("").map((token) => Number.parseInt(token + token, 16));
    const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(raw);
    return rgb ? rgb.slice(1, 4).map(Number) : null;
  }

  function isDarkColor(value) {
    const rgb = channels(value);
    if (!rgb) return null;
    const linear = rgb.map((channel) => {
      const normalized = Math.max(0, Math.min(255, channel)) / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] < 0.35;
  }

  function dashboardIsDark() {
    const styles = root.getComputedStyle?.(doc.documentElement);
    for (const token of ["--dm-bg", "--bg-sculpted", "--bg-1"]) {
      const result = isDarkColor(styles?.getPropertyValue(token));
      if (result != null) return result;
    }
    return clean(doc.documentElement.dataset.theme).toLowerCase() === "dark";
  }

  function setImportant(node, property, value) {
    node?.style?.setProperty(property, value, "important");
  }

  function apply() {
    const dark = dashboardIsDark();
    const palette = dark
      ? { card: "#0f172a", surface: "#172033", text: "#f8fafc", dim: "#a8b4c6", border: "#334155" }
      : { card: "#f8fafc", surface: "#ffffff", text: "#0f172a", dim: "#64748b", border: "#dbe4ee" };
    doc.documentElement.dataset.dmDashboardTheme = dark ? "dark" : "light";
    doc.documentElement.style.setProperty("--dm-real-card-bg", palette.card);
    doc.documentElement.style.setProperty("--dm-real-surface", palette.surface);
    doc.documentElement.style.setProperty("--dm-real-text", palette.text);
    doc.documentElement.style.setProperty("--dm-real-text-dim", palette.dim);
    doc.documentElement.style.setProperty("--dm-real-border", palette.border);

    doc.querySelectorAll("#page-appliances-main .appl-wide-card").forEach((card) => {
      setImportant(card, "background", palette.card);
      setImportant(card, "background-color", palette.card);
      setImportant(card, "color", palette.text);
      setImportant(card, "border-color", palette.border);
      card.querySelectorAll(".appl-info,.appl-wide-name,.appl-primary strong").forEach((node) =>
        setImportant(node, "color", palette.text),
      );
      card.querySelectorAll(".appl-wide-cat,.appl-mini").forEach((node) =>
        setImportant(node, "color", palette.dim),
      );
      card.querySelectorAll(".appl-visual,.appl-mini,.appl-st,.appl-action-btn").forEach((node) => {
        setImportant(node, "background", palette.surface);
        setImportant(node, "background-color", palette.surface);
        setImportant(node, "border-color", palette.border);
      });
    });
  }

  function schedule() {
    if (state.scheduled) return;
    state.scheduled = true;
    root.queueMicrotask?.(() => {
      state.scheduled = false;
      apply();
    });
    root.setTimeout?.(apply, 90);
  }

  state.apply = apply;
  doc.addEventListener("click", schedule, true);
  doc.addEventListener("change", schedule, true);
  root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  root.addEventListener?.("dashboardmodern:runtime-ready", schedule);
  root.addEventListener?.("pageshow", schedule);
  apply();
  [180, 820, 1650].forEach((delay) => root.setTimeout?.(apply, delay));
})(globalThis);
