import { createLegacySectionAdapter } from "./legacy-section-adapter.js";

let installed;
export function installClimateSection() {
  installed ||= createLegacySectionAdapter({
    key: "climate",
    pageId: "page-clima",
    renderers: ["renderClimate", "renderClima", "buildClimateCards"],
    refreshers: ["renderClimate", "renderClima", "refreshClimate"],
    state: ["STATES", "cd_climate", "cd_rooms"],
  });
  return installed;
}
