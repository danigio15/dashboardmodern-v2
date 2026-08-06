import { createLegacySectionAdapter } from "./legacy-section-adapter.js";

let installed;
export function installSecuritySection() {
  installed ||= createLegacySectionAdapter({
    key: "security",
    pageId: "page-security",
    renderers: ["renderSecurity", "buildCamCards", "refreshCameras"],
    refreshers: ["refreshCameras", "buildCamCards", "renderSecurity"],
    state: ["STATES", "cd_cameras", "cd_security"],
  });
  return installed;
}
