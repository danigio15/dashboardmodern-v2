import { createLegacySectionAdapter } from "./legacy-section-adapter.js";

let installed;
export function installPoolSection() {
  installed ||= createLegacySectionAdapter({
    key: "pool",
    pageId: "page-piscina",
    renderers: ["renderPool", "renderPiscina", "buildPool"],
    refreshers: ["renderPool", "renderPiscina", "refreshPool"],
    state: ["STATES", "cd_pool"],
  });
  return installed;
}
