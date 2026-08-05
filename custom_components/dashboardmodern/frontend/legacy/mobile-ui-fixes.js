/* Compatibility exports retained for existing tests and stored configurations. */
import "../src/sections/section-runtime.js";
export { inferApplianceEntity } from "../src/sections/appliances-section.js";

export function isGeneratedRoomName(value = "") {
  return /^room[-_][a-z0-9]{6,}$/i.test(String(value).trim());
}

export function normalizeVehiclePath(value = "") {
  let path = String(value || "").trim().replaceAll("\\", "/");
  if (path.startsWith("/loca/")) path = `/local/${path.slice(6)}`;
  else if (path.startsWith("loca/")) path = `/local/${path.slice(5)}`;
  else if (path.startsWith("/config/www/")) path = `/local/${path.slice(12)}`;
  else if (path.startsWith("config/www/")) path = `/local/${path.slice(11)}`;
  else if (path.startsWith("www/")) path = `/local/${path.slice(4)}`;
  else if (path.startsWith("local/")) path = `/${path}`;
  return path.replace(/^\/local\/\/+/, "/local/");
}
