export const LAYOUT_BREAKPOINTS = Object.freeze({
  desktop: Object.freeze({ columns: 12, rows: 12, defaultColumns: 4, defaultRows: 1 }),
  tablet: Object.freeze({ columns: 8, rows: 12, defaultColumns: 4, defaultRows: 1 }),
  mobile: Object.freeze({ columns: 4, rows: 12, defaultColumns: 4, defaultRows: 1 }),
});

export const BREAKPOINT_NAMES = Object.freeze(Object.keys(LAYOUT_BREAKPOINTS));

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export function parseInteger(value) {
  if (value === null || value === undefined || value === "") return { ok: false, missing: true };
  if (typeof value !== "number" || !Number.isInteger(value)) return { ok: false, missing: false };
  return { ok: true, value };
}

export function defaultCardLayout() {
  return Object.fromEntries(BREAKPOINT_NAMES.map((name) => [name, { columns: LAYOUT_BREAKPOINTS[name].defaultColumns, rows: LAYOUT_BREAKPOINTS[name].defaultRows }]));
}

function validateSpan(value, breakpoint, field, path) {
  const parsed = parseInteger(value);
  if (parsed.missing) return { missing: true };
  const max = field === "columns" ? LAYOUT_BREAKPOINTS[breakpoint].columns : LAYOUT_BREAKPOINTS[breakpoint].rows;
  if (!parsed.ok || parsed.value < 1 || parsed.value > max) return { error: { field: path, message: `${path} must be an integer from 1 to ${max}.` } };
  return { value: parsed.value };
}

export function validateCardLayout(layout, { cardId = null } = {}) {
  const prefix = cardId ? `card:${cardId}:` : "";
  if (layout === undefined || layout === null) return [];
  if (!isPlainObject(layout)) return [{ field: `${prefix}layout`, message: "layout must be an object." }];
  const errors = [];
  for (const breakpoint of BREAKPOINT_NAMES) {
    const bp = layout[breakpoint];
    if (bp === undefined || bp === null) continue;
    const bpPath = `${prefix}layout.${breakpoint}`;
    if (!isPlainObject(bp)) { errors.push({ field: bpPath, message: `${bpPath} must be an object.` }); continue; }
    for (const field of ["columns", "rows"]) {
      const result = validateSpan(bp[field], breakpoint, field, `${bpPath}.${field}`);
      if (result.error) errors.push(result.error);
    }
  }
  return errors;
}

export function normalizeCardLayout(cardOrLayout) {
  const hasLayoutProperty = isPlainObject(cardOrLayout) && Object.hasOwn(cardOrLayout, "layout");
  const hasBreakpointShape = isPlainObject(cardOrLayout) && BREAKPOINT_NAMES.some((name) => Object.hasOwn(cardOrLayout, name));
  const layout = hasLayoutProperty ? cardOrLayout.layout : hasBreakpointShape ? cardOrLayout : undefined;
  const defaults = defaultCardLayout();
  const errors = validateCardLayout(layout);
  const status = layout === undefined || layout === null ? "legacy" : errors.length ? "malformed" : "valid";
  if (status === "malformed") return { layout: defaults, errors, status, derived: true };
  if (status === "legacy") return { layout: defaults, errors: [], status, derived: true };
  const normalized = defaultCardLayout();
  for (const breakpoint of BREAKPOINT_NAMES) {
    const bp = isPlainObject(layout[breakpoint]) ? layout[breakpoint] : {};
    normalized[breakpoint] = {
      columns: parseInteger(bp.columns).value ?? defaults[breakpoint].columns,
      rows: parseInteger(bp.rows).value ?? defaults[breakpoint].rows,
    };
  }
  const complete = BREAKPOINT_NAMES.every((name) => isPlainObject(layout[name]) && parseInteger(layout[name].columns).ok && parseInteger(layout[name].rows).ok);
  return { layout: normalized, errors: [], status: complete ? "valid" : "partial", derived: !complete };
}

export function layoutPatch(currentLayout, breakpoint, field, value) {
  const result = validateSpan(value, breakpoint, field, `layout.${breakpoint}.${field}`);
  if (result.error || result.missing) return { error: result.error || { field: `layout.${breakpoint}.${field}`, message: `layout.${breakpoint}.${field} is required.` } };
  const base = isPlainObject(currentLayout) ? currentLayout : {};
  const bp = isPlainObject(base[breakpoint]) ? base[breakpoint] : {};
  return { patch: { layout: { ...base, [breakpoint]: { ...bp, [field]: result.value } } } };
}
