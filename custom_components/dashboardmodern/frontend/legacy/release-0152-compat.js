/* Compatibility marker for checks and extensions that waited for the 0.14.11 layer. */
import "./release-0152-temperature-dom.js";

if (typeof globalThis !== "undefined") {
  globalThis.__DASHBOARDMODERN_RELEASE_0151__ ||= {
    installed: true,
    version: "0.14.11",
    supersededBy: "0.14.12",
  };
}
