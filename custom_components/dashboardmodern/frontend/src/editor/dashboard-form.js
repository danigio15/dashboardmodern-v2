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
  return form;
}
