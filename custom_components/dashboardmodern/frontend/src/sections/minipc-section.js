import { createLegacySectionAdapter } from "./legacy-section-adapter.js";

let installed;
export function installMiniPcSection() {
  installed ||= createLegacySectionAdapter({
    key: "minipc",
    pageId: "page-server",
    renderers: ["renderMiniPc", "renderServer", "buildServerCards"],
    refreshers: ["renderMiniPc", "renderServer", "refreshServer"],
    state: ["STATES", "cd_server", "cd_minipc"],
  });
  return installed;
}
