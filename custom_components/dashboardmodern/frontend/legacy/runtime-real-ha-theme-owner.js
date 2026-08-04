/* DashboardModern 0.15.1 — final theme owner for embedded Home Assistant. */
(function installRealHaThemeOwner0151(root) {
  "use strict";
  const KEY = "__DASHBOARDMODERN_REAL_HA_THEME_OWNER_0151__";
  if (!root.document || root[KEY]?.installed) return;
  const doc = root.document;
  const state = (root[KEY] = { installed: true, scheduled: false, render: null });
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
    const dashboardBackground =
      clean(styles?.getPropertyValue("--dm-bg")) ||
      clean(styles?.getPropertyValue("--bg-sculpted")) ||
      clean(styles?.getPropertyValue("--bg-1"));
    const dashboardDark = isDarkColor(dashboardBackground);
    const cardBackground = clean(styles?.getPropertyValue("--card-bg"));
    const inheritedHaBackground = clean(styles?.getPropertyValue("--ha-card-background"));
    const cardDark = isDarkColor(cardBackground);

    // A standalone --card-bg is an explicit DashboardModern theme override.
    // When it matches Home Assistant's own card variable, it is inherited host
    // chrome and must not turn a visibly light DashboardModern page dark.
    if (
      cardDark != null &&
      (!inheritedHaBackground || cardBackground.toLowerCase() !== inheritedHaBackground.toLowerCase())
    ) {
      return cardDark;
    }
    if (dashboardDark != null) return dashboardDark;
    return clean(doc.documentElement.dataset.theme).toLowerCase() === "dark";
  }

  function setImportant(node, property, value) {
    node?.style?.setProperty(property, value, "important");
  }

  function apply() {
    const dark = dashboardIsDark();
    const palette = dark
      ? { card: "#111827", surface: "#1f2937", text: "#f8fafc", dim: "#cbd5e1", border: "#374151" }
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

  function installRenderHook() {
    const current = root.renderApplianceSection;
    if (typeof current !== "function" || current.__dmRealHaThemeOwner0151) return false;
    function themedApplianceRender0151() {
      const result = current.apply(this, arguments);
      const finish = () => {
        root.queueMicrotask?.(apply);
        root.setTimeout?.(apply, 60);
      };
      if (result && typeof result.finally === "function") return result.finally(finish);
      finish();
      return result;
    }
    themedApplianceRender0151.__dmRealHaThemeOwner0151 = true;
    themedApplianceRender0151.__dmPrevious = current;
    state.render = themedApplianceRender0151;
    root.renderApplianceSection = themedApplianceRender0151;
    return true;
  }

  state.apply = apply;
  state.installRenderHook = installRenderHook;
  doc.addEventListener("click", schedule, true);
  doc.addEventListener("change", schedule, true);
  root.addEventListener?.("dashboardmodern:legacy-ready", () => {
    installRenderHook();
    schedule();
  });
  root.addEventListener?.("dashboardmodern:runtime-ready", () => {
    installRenderHook();
    schedule();
  });
  root.addEventListener?.("pageshow", schedule);
  installRenderHook();
  apply();
  [180, 820, 1650].forEach((delay) => root.setTimeout?.(() => {
    installRenderHook();
    apply();
  }, delay));
})(globalThis);
