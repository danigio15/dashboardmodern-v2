function labeledControl(documentRef, labelText, control) {
  const label = documentRef.createElement("label");
  label.textContent = labelText;
  label.append(control);
  return label;
}

export function textInput(documentRef, labelText, value, onInput, fieldId = "") {
  const input = documentRef.createElement("input");
  if (fieldId) input.dataset.editorField = fieldId;
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  return labeledControl(documentRef, labelText, input);
}

export function textareaInput(documentRef, labelText, value, onInput, fieldId = "") {
  const textarea = documentRef.createElement("textarea");
  if (fieldId) textarea.dataset.editorField = fieldId;
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

const SAFE_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const SAFE_LOGO_PATTERN = /^(|\/[^<>]*|https:\/\/[^<>]+)$/i;
const THEME_MODES = ["auto", "light", "dark"];
const NAV_VISIBILITY = ["fixed", "auto-hide"];
const NAV_OVERFLOW = ["scroll", "more-menu"];
const NAV_ITEM_SIZES = ["small", "medium", "large"];

function clearFieldError(controller, field) {
  if (!controller?.store?.setState || !controller.state) return;
  const { [field]: _cleared, ...fieldText } = controller.state.fieldText || {};
  controller.store.setState({
    editor: {
      ...controller.state,
      fieldText,
      validationErrors: (controller.state.validationErrors || []).filter((error) => error.field !== field),
    },
  });
}

function setFieldError(controller, field, value, message) {
  if (!controller?.store?.setState || !controller.state) return;
  controller.store.setState({
    editor: {
      ...controller.state,
      dirty: true,
      fieldText: { ...(controller.state.fieldText || {}), [field]: value },
      validationErrors: [
        ...(controller.state.validationErrors || []).filter((error) => error.field !== field),
        { field, message },
      ],
    },
  });
}

function dashboardConfigPatch(dashboard, path, value) {
  const config = dashboard?.config || {};
  const keys = path.split(".");
  const update = (source, remaining) => {
    const [head, ...tail] = remaining;
    if (!tail.length) return { ...(source || {}), [head]: value };
    return { ...(source || {}), [head]: update(source?.[head] || {}, tail) };
  };
  return { config: update(config, keys) };
}

function updateDashboardConfig(controller, dashboard, path, value, field) {
  controller.updateDashboard(dashboardConfigPatch(dashboard, path, value));
  clearFieldError(controller, field);
}

function colorInput(documentRef, labelText, value, onValid, fieldId, controller) {
  const input = documentRef.createElement("input");
  input.type = "text";
  input.placeholder = "#22c55e";
  input.dataset.editorField = fieldId;
  input.value = controller?.state?.fieldText?.[fieldId] ?? value ?? "";
  input.addEventListener("input", () => {
    const next = input.value.trim();
    if (!SAFE_COLOR_PATTERN.test(next)) {
      setFieldError(controller, fieldId, input.value, "Use a hex color such as #22c55e.");
      return;
    }
    onValid(next);
  });
  return labeledControl(documentRef, labelText, input);
}

function logoInput(documentRef, labelText, value, onValid, fieldId, controller) {
  const input = documentRef.createElement("input");
  input.type = "text";
  input.placeholder = "/local/dashboard-logo.png";
  input.dataset.editorField = fieldId;
  input.value = controller?.state?.fieldText?.[fieldId] ?? value ?? "";
  input.addEventListener("input", () => {
    if (!SAFE_LOGO_PATTERN.test(input.value.trim())) {
      setFieldError(controller, fieldId, input.value, "Use an empty value, a local / path, or an https:// URL.");
      return;
    }
    onValid(input.value.trim());
  });
  return labeledControl(documentRef, labelText, input);
}

function selectInput(documentRef, labelText, value, options, onChange, fieldId) {
  const label = documentRef.createElement("label");
  label.textContent = labelText;
  const select = documentRef.createElement("select");
  select.dataset.editorField = fieldId;
  for (const optionValue of options) {
    const option = documentRef.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = optionValue === value;
    select.append(option);
  }
  select.addEventListener("change", () => onChange(select.value));
  label.append(select);
  return label;
}


function checkboxInput(documentRef, labelText, checked, onChange, fieldId) { const label = documentRef.createElement("label"); const input = documentRef.createElement("input"); input.type = "checkbox"; input.checked = Boolean(checked); input.dataset.editorField = fieldId; input.addEventListener("change", () => onChange(input.checked)); label.textContent = labelText; label.append(input); return label; }
function numberInput(documentRef, labelText, value, onInput, fieldId, attrs = {}) { const input = documentRef.createElement("input"); input.type = "number"; input.value = String(value ?? 0); input.dataset.editorField = fieldId; for (const [key, val] of Object.entries(attrs)) input.setAttribute(key, String(val)); input.addEventListener("input", () => onInput(Number(input.value), input.value)); return labeledControl(documentRef, labelText, input); }
function updateNav(controller, dashboard, key, value, field) { updateDashboardConfig(controller, dashboard, `navigation.${key}`, value, field); }
function renderNavigationSettingsPanel(documentRef, dashboard, controller) { const nav = { placement:"bottom", visibilityMode:"fixed", overflowMode:"scroll", showLabels:true, compactMode:false, itemSize:"medium", autoHideDelay:2500, edgeIndicators:true, ...(dashboard?.config?.navigation || {}) }; const section = documentRef.createElement("section"); section.className = "dashboardmodern-settings-panel dashboardmodern-navigation-settings"; section.setAttribute("aria-label", "Navigation"); section.append(Object.assign(documentRef.createElement("h3"), { textContent: "Navigation" })); section.append(selectInput(documentRef, "Visibility mode", nav.visibilityMode, NAV_VISIBILITY, (value) => updateNav(controller, dashboard, "visibilityMode", value, "dashboard.config.navigation.visibilityMode"), "dashboard.config.navigation.visibilityMode")); section.append(selectInput(documentRef, "Overflow mode", nav.overflowMode, NAV_OVERFLOW, (value) => updateNav(controller, dashboard, "overflowMode", value, "dashboard.config.navigation.overflowMode"), "dashboard.config.navigation.overflowMode")); section.append(checkboxInput(documentRef, "Show labels", nav.showLabels, (value) => updateNav(controller, dashboard, "showLabels", value, "dashboard.config.navigation.showLabels"), "dashboard.config.navigation.showLabels")); section.append(checkboxInput(documentRef, "Compact mode", nav.compactMode, (value) => updateNav(controller, dashboard, "compactMode", value, "dashboard.config.navigation.compactMode"), "dashboard.config.navigation.compactMode")); section.append(selectInput(documentRef, "Item size", nav.itemSize, NAV_ITEM_SIZES, (value) => updateNav(controller, dashboard, "itemSize", value, "dashboard.config.navigation.itemSize"), "dashboard.config.navigation.itemSize")); section.append(numberInput(documentRef, "Auto-hide delay", nav.autoHideDelay, (value, raw) => { if (!Number.isFinite(value) || value < 500 || value > 10000) return setFieldError(controller, "dashboard.config.navigation.autoHideDelay", raw, "Use 500–10000 milliseconds."); updateNav(controller, dashboard, "autoHideDelay", value, "dashboard.config.navigation.autoHideDelay"); }, "dashboard.config.navigation.autoHideDelay", { min: 500, max: 10000, step: 100 })); section.append(checkboxInput(documentRef, "Edge indicators", nav.edgeIndicators, (value) => updateNav(controller, dashboard, "edgeIndicators", value, "dashboard.config.navigation.edgeIndicators"), "dashboard.config.navigation.edgeIndicators")); section.append(Object.assign(documentRef.createElement("h4"), { textContent: "Section navigation" })); for (const item of dashboard?.sections || []) { const row = documentRef.createElement("fieldset"); row.dataset.sectionNavEditor = item.id; row.append(Object.assign(documentRef.createElement("legend"), { textContent: item.title || item.id })); row.append(checkboxInput(documentRef, "Enabled", item.enabled !== false, (value) => controller.updateSection(item.id, { enabled: value }), `section:${item.id}:enabled`)); row.append(checkboxInput(documentRef, "Visible in navbar", item.visibleInNavbar !== false, (value) => controller.updateSection(item.id, { visibleInNavbar: value }), `section:${item.id}:visibleInNavbar`)); row.append(textInput(documentRef, "Title", item.title || "", (title) => controller.updateSection(item.id, { title }), `section:${item.id}:navTitle`)); row.append(textInput(documentRef, "Icon", item.icon || "", (icon) => controller.updateSection(item.id, { icon }), `section:${item.id}:navIcon`)); row.append(colorInput(documentRef, "Accent", item.accent || "#22c55e", (accent) => controller.updateSection(item.id, { accent }), `section:${item.id}:accent`, controller)); row.append(numberInput(documentRef, "Order", item.order ?? 0, (order) => controller.updateSection(item.id, { order }), `section:${item.id}:order`)); row.append(textInput(documentRef, "Badge label", item.badge?.label || "", (label) => controller.updateSection(item.id, { badge: { ...(item.badge || {}), label } }), `section:${item.id}:badge`)); section.append(row); } for (const error of controller?.state?.validationErrors || []) if (error.field?.startsWith("dashboard.config.navigation")) section.append(fieldError(documentRef, error.message)); return section; }

function renderDashboardSettingsPanel(documentRef, dashboard, controller) {
  const config = dashboard?.config || {};
  const branding = config.branding || {};
  const theme = config.theme || {};
  const section = documentRef.createElement("section");
  section.className = "dashboardmodern-settings-panel";
  section.setAttribute("aria-label", "Dashboard settings");
  const heading = documentRef.createElement("h3");
  heading.textContent = "Dashboard settings";
  section.append(heading);
  section.append(textInput(documentRef, "Brand title", branding.title || "", (title) => updateDashboardConfig(controller, dashboard, "branding.title", title, "dashboard.config.branding.title"), "dashboard.config.branding.title"));
  section.append(textInput(documentRef, "Brand subtitle", branding.subtitle || "", (subtitle) => updateDashboardConfig(controller, dashboard, "branding.subtitle", subtitle, "dashboard.config.branding.subtitle"), "dashboard.config.branding.subtitle"));
  section.append(logoInput(documentRef, "Logo reference", branding.logoRef || "", (logoRef) => updateDashboardConfig(controller, dashboard, "branding.logoRef", logoRef, "dashboard.config.branding.logoRef"), "dashboard.config.branding.logoRef", controller));
  section.append(colorInput(documentRef, "Brand accent color", branding.accentColor || "#22c55e", (accentColor) => updateDashboardConfig(controller, dashboard, "branding.accentColor", accentColor, "dashboard.config.branding.accentColor"), "dashboard.config.branding.accentColor", controller));
  section.append(selectInput(documentRef, "Theme mode", theme.mode || "auto", THEME_MODES, (mode) => updateDashboardConfig(controller, dashboard, "theme.mode", mode, "dashboard.config.theme.mode"), "dashboard.config.theme.mode"));
  section.append(colorInput(documentRef, "Theme accent color", theme.accentColor || "#22c55e", (accentColor) => updateDashboardConfig(controller, dashboard, "theme.accentColor", accentColor, "dashboard.config.theme.accentColor"), "dashboard.config.theme.accentColor", controller));
  for (const error of controller?.state?.validationErrors || []) {
    if (error.field?.startsWith("dashboard.config.")) section.append(fieldError(documentRef, error.message));
  }
  return section;
}

export function renderDashboardForm(documentRef, dashboard, controller) {
  const form = documentRef.createElement("section");
  form.setAttribute("aria-label", "Dashboard fields");
  form.append(textInput(documentRef, "Dashboard title", dashboard?.title || "", (title) => controller.updateDashboard({ title }), "dashboard.title"));
  form.append(textInput(documentRef, "Dashboard description", dashboard?.description || "", (description) => controller.updateDashboard({ description }), "dashboard.description"));
  form.append(renderDashboardSettingsPanel(documentRef, dashboard, controller));
  form.append(renderNavigationSettingsPanel(documentRef, dashboard, controller));
  return form;
}
