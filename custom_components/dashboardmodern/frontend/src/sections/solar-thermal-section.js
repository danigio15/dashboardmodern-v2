import { createLegacySectionAdapter } from "./legacy-section-adapter.js";

let installed;
export function installSolarThermalSection() {
  installed ||= createLegacySectionAdapter({
    key: "solar-thermal",
    pageId: "page-boiler",
    renderers: ["renderSolarThermal", "renderBoiler", "buildBoiler"],
    refreshers: ["renderSolarThermal", "renderBoiler", "refreshBoiler"],
    state: ["STATES", "cd_boiler", "cd_solar"],
  });
  return installed;
}
