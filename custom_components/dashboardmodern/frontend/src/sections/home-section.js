import { createLegacySectionAdapter } from "./legacy-section-adapter.js";

let installed;
export function installHomeSection() {
  installed ||= createLegacySectionAdapter({
    key: "home",
    pageId: "page-home",
    renderers: ["renderHome", "render", "buildHome"],
    refreshers: ["renderHome", "render", "refreshWeather"],
    state: ["STATES", "cd_rooms", "cd_devices"],
  });
  return installed;
}
