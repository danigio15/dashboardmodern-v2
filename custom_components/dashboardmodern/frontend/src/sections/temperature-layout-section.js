// Compatibility shim retained while section-runtime still imports this module.
// Temperature layout and rendering are now owned entirely by temperature-section.js.
// Keeping this export temporarily avoids a second renderer/style owner without
// widening this Beta12 fix into an unrelated runtime bootstrap rewrite.
export function installTemperatureLayoutSection() {
  return false;
}