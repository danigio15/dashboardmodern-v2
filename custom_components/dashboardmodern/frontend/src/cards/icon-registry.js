import { el } from "../render/dom.js";

export const ICONS = Object.freeze({
  sun: { label: "Sole", path: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  moon: { label: "Notte serena", path: "M21 14.7A8 8 0 0 1 9.3 3 7 7 0 1 0 21 14.7Z" },
  cloud: { label: "Nuvoloso", path: "M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 2A3 3 0 0 0 7 18Z" },
  rain: { label: "Pioggia", path: "M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 2A3 3 0 0 0 7 15Zm1 4v2m4-3v2m4-3v2" },
  storm: { label: "Temporale", path: "M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 2A3 3 0 0 0 7 15Zm5 1-2 4h3l-1 3 4-5h-3l1-2Z" },
  snow: { label: "Neve", path: "M12 3v18m-7-4 14-10M5 7l14 10m-3-12-4 4-4-4m8 14-4-4-4 4" },
  fog: { label: "Nebbia", path: "M5 9h14M3 13h18M5 17h14" },
  wind: { label: "Vento", path: "M4 8h11a3 3 0 1 0-3-3M4 13h16M4 18h9a3 3 0 1 1-3 3" },
  lights: { label: "Luci", path: "M9 21h6m-5-4h4m-6-6a4 4 0 1 1 8 0c0 2-2 3-2 5h-4c0-2-2-3-2-5Z" },
  climate: { label: "Clima", path: "M12 3v18m-7-4 14-10M5 7l14 10" },
  heating: { label: "Riscaldamento", path: "M8 14c-2-3 1-5 2-7 0 3 4 4 4 8 2-1 2-3 2-4 3 4 1 10-4 10-4 0-6-3-4-7Z" },
  door: { label: "Aperture", path: "M7 21V3h10v18M10 12h.01" },
  battery: { label: "Batteria", path: "M3 8h16v8H3V8Zm16 3h2v2h-2" },
  alert: { label: "Avviso", path: "M12 3 2 21h20L12 3Zm0 6v5m0 3h.01" },
  grid: { label: "Rete", path: "M4 20h16M6 20V8h12v12M9 8V4h6v4m-6 5h.01m3 0h.01m3 0h.01m-6 4h.01m3 0h.01m3 0h.01" },
});

export const ICON_IDS = Object.freeze(Object.keys(ICONS));
export function isIconId(value) { return ICON_IDS.includes(value); }
export function renderIcon(iconId, { className = "dm-icon", label } = {}) {
  const meta = ICONS[isIconId(iconId) ? iconId : "alert"];
  const svg = el("svg", { className, attrs: { viewBox: "0 0 24 24", role: "img", "aria-label": label || meta.label, focusable: "false" } });
  const path = el("path", { attrs: { d: meta.path, fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" } });
  svg.append(path);
  return svg;
}
