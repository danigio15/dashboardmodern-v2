import { createLegacySectionAdapter } from "./legacy-section-adapter.js";

let installed;
export function installIrrigationSection() {
  installed ||= createLegacySectionAdapter({
    key: "irrigation",
    pageId: "page-irrigazione",
    renderers: ["renderIrrigation", "renderIrrigazione", "buildIrrigation"],
    refreshers: ["renderIrrigation", "renderIrrigazione", "refreshIrrigation"],
    state: ["STATES", "cd_irrigation"],
  });
  return installed;
}
