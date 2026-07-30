/* Theme-consistent editor surfaces for the 0.14.7 corrective release. */
const FLAG = "__DASHBOARDMODERN_0147_EDITOR_THEME__";

function installEditorThemeCss() {
  if (document.getElementById("dm-0147-editor-theme")) return;

  const style = document.createElement("style");
  style.id = "dm-0147-editor-theme";
  style.textContent = `
    #editor-modal[data-dm-editor-theme="dark"] {
      --dm-editor-field: #0c1322;
      --dm-editor-shell: #161f36;
      --dm-editor-panel: #1b2540;
      --dm-editor-control: #212d4c;
      --dm-editor-border: #263453;
      --dm-editor-text: #e6edf7;
      --dm-editor-muted: #92a4c2;
      --dm-editor-accent: var(--accent, var(--primary-color, #0ea5e9));
      --dm-editor-accent-text: #7dd3fc;
      background: rgba(3, 7, 18, 0.76) !important;
      color-scheme: dark;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-shell {
      background: var(--dm-editor-shell) !important;
      color: var(--dm-editor-text) !important;
      border: 1px solid var(--dm-editor-border) !important;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.48) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-head,
    #editor-modal[data-dm-editor-theme="dark"] .ed-body {
      background: var(--dm-editor-shell) !important;
      color: var(--dm-editor-text) !important;
      border-color: var(--dm-editor-border) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-tabs,
    #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tabs,
    #editor-modal[data-dm-editor-theme="dark"] .sub-tabs-energy {
      background: var(--dm-editor-panel) !important;
      border-color: var(--dm-editor-border) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-tab,
    #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tab,
    #editor-modal[data-dm-editor-theme="dark"] .sub-tab-btn {
      color: var(--dm-editor-muted) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-tab:hover,
    #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tab:hover,
    #editor-modal[data-dm-editor-theme="dark"] .sub-tab-btn:hover {
      background: var(--dm-editor-control) !important;
      color: var(--dm-editor-text) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-tab.active,
    #editor-modal[data-dm-editor-theme="dark"] .ed-inner-tab.active,
    #editor-modal[data-dm-editor-theme="dark"] .sub-tab-btn.active {
      background: rgba(14, 165, 233, 0.18) !important;
      color: var(--dm-editor-accent-text) !important;
      border: 1px solid rgba(56, 189, 248, 0.38) !important;
      box-shadow: 0 6px 18px rgba(2, 132, 199, 0.16) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-row,
    #editor-modal[data-dm-editor-theme="dark"] .dm-report-row,
    #editor-modal[data-dm-editor-theme="dark"] .ed-acc,
    #editor-modal[data-dm-editor-theme="dark"] .ed-acc-body,
    #editor-modal[data-dm-editor-theme="dark"] .dm-energy-cost-card,
    #editor-modal[data-dm-editor-theme="dark"] .dm-light-add-form,
    #editor-modal[data-dm-editor-theme="dark"] [data-report-manual]:not([hidden]) {
      background: var(--dm-editor-panel) !important;
      color: var(--dm-editor-text) !important;
      border-color: var(--dm-editor-border) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-note,
    #editor-modal[data-dm-editor-theme="dark"] .ed-empty,
    #editor-modal[data-dm-editor-theme="dark"] .ed-acc-head,
    #editor-modal[data-dm-editor-theme="dark"] .ed-head-close,
    #editor-modal[data-dm-editor-theme="dark"] .ed-btn-secondary,
    #editor-modal[data-dm-editor-theme="dark"] .dm-report-actions button,
    #editor-modal[data-dm-editor-theme="dark"] .dm-icon-picker {
      background: var(--dm-editor-control) !important;
      color: var(--dm-editor-text) !important;
      border-color: var(--dm-editor-border) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-input,
    #editor-modal[data-dm-editor-theme="dark"] .ed-export,
    #editor-modal[data-dm-editor-theme="dark"] input,
    #editor-modal[data-dm-editor-theme="dark"] select,
    #editor-modal[data-dm-editor-theme="dark"] textarea {
      background-color: var(--dm-editor-control) !important;
      color: var(--dm-editor-text) !important;
      border-color: var(--dm-editor-border) !important;
      caret-color: var(--dm-editor-accent-text);
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-input:focus,
    #editor-modal[data-dm-editor-theme="dark"] input:focus,
    #editor-modal[data-dm-editor-theme="dark"] select:focus,
    #editor-modal[data-dm-editor-theme="dark"] textarea:focus {
      border-color: rgba(56, 189, 248, 0.72) !important;
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] input::placeholder,
    #editor-modal[data-dm-editor-theme="dark"] textarea::placeholder {
      color: var(--dm-editor-muted) !important;
      opacity: 0.78;
    }

    #editor-modal[data-dm-editor-theme="dark"] select option {
      background: var(--dm-editor-control);
      color: var(--dm-editor-text);
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-head-title,
    #editor-modal[data-dm-editor-theme="dark"] .ed-row-new,
    #editor-modal[data-dm-editor-theme="dark"] .ed-sec-title,
    #editor-modal[data-dm-editor-theme="dark"] .ed-acc-head,
    #editor-modal[data-dm-editor-theme="dark"] [data-report-status] {
      color: var(--dm-editor-text) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-intro,
    #editor-modal[data-dm-editor-theme="dark"] .ed-note,
    #editor-modal[data-dm-editor-theme="dark"] .ed-hint,
    #editor-modal[data-dm-editor-theme="dark"] .ed-row-old,
    #editor-modal[data-dm-editor-theme="dark"] .ed-slot-lbl,
    #editor-modal[data-dm-editor-theme="dark"] .ed-acc-n,
    #editor-modal[data-dm-editor-theme="dark"] .ed-empty,
    #editor-modal[data-dm-editor-theme="dark"] .dm-temperature-card-icon + .ed-row-main .ed-row-old {
      color: var(--dm-editor-muted) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-head-icon {
      background: rgba(14, 165, 233, 0.18) !important;
      color: var(--dm-editor-accent-text) !important;
      border: 1px solid rgba(56, 189, 248, 0.32);
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-btn-add {
      background: rgba(14, 165, 233, 0.18) !important;
      color: var(--dm-editor-accent-text) !important;
      border: 1px solid rgba(56, 189, 248, 0.38) !important;
      box-shadow: none !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-btn-add:hover {
      background: rgba(14, 165, 233, 0.28) !important;
      filter: none !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] .dm-report-row > label:first-child {
      background: rgba(14, 165, 233, 0.16) !important;
      color: var(--dm-editor-accent-text) !important;
      border: 1px solid rgba(56, 189, 248, 0.30) !important;
    }

    #editor-modal[data-dm-editor-theme="dark"] input[type="checkbox"],
    #editor-modal[data-dm-editor-theme="dark"] input[type="radio"] {
      accent-color: var(--dm-editor-accent);
    }

    #editor-modal[data-dm-editor-theme="dark"] .ed-del {
      background: rgba(239, 68, 68, 0.14) !important;
      border-color: rgba(248, 113, 113, 0.32) !important;
      color: #fca5a5 !important;
    }
  `;
  document.head.append(style);
}

function parseColor(value) {
  const match = String(value || "").trim().match(/^rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/i);
  if (match) return match.slice(1, 4).map(Number);

  const hex = String(value || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return null;
  const raw = hex[1].length === 3 ? hex[1].split("").map((part) => part + part).join("") : hex[1];
  return [0, 2, 4].map((offset) => Number.parseInt(raw.slice(offset, offset + 2), 16));
}

function relativeLuminance(rgb) {
  if (!rgb) return null;
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function resolvedCssColor(value) {
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.position = "fixed";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  document.documentElement.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function isDarkTheme() {
  const root = document.documentElement;
  const body = document.body;
  const explicit = String(root.dataset.theme || body?.dataset.theme || "").toLowerCase();
  if (explicit === "dark") return true;
  if (explicit === "light") return false;

  const rootStyle = getComputedStyle(root);
  const colorScheme = String(rootStyle.colorScheme || "").toLowerCase();
  if (colorScheme.includes("dark") && !colorScheme.includes("light")) return true;

  const candidates = [
    rootStyle.getPropertyValue("--card-bg"),
    rootStyle.getPropertyValue("--ha-card-background"),
    rootStyle.getPropertyValue("--primary-background-color"),
    body ? getComputedStyle(body).backgroundColor : "",
  ];

  for (const candidate of candidates) {
    if (!String(candidate || "").trim()) continue;
    const luminance = relativeLuminance(parseColor(resolvedCssColor(candidate)));
    if (luminance != null) return luminance < 0.32;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
}

function syncEditorTheme() {
  const theme = isDarkTheme() ? "dark" : "light";
  document.querySelectorAll("#editor-modal").forEach((modal) => {
    modal.dataset.dmEditorTheme = theme;
  });
}

function install() {
  installEditorThemeCss();
  syncEditorTheme();

  if (globalThis[FLAG]?.installed) return;
  globalThis[FLAG] = { installed: true };

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncEditorTheme);
  };

  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
    childList: true,
    subtree: true,
  });

  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", schedule);
  window.addEventListener("dashboardmodern:legacy-ready", schedule);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
}
