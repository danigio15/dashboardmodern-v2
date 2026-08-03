/* DashboardModern 0.15.0 compatibility facade: one production runtime. */
import "./runtime-regression-guard.js";
import "./runtime-consolidated.js";
import "./runtime-canonical-readiness.js";
import "./runtime-final-owner.js";
import "./runtime-residual-fixes.js";
import "./runtime-compatibility.js";

if (
  typeof document !== "undefined" &&
  !globalThis.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__ &&
  !document.querySelector('script[data-dm-legacy-period-bridge-v2="true"]')
) {
  const bridge = document.createElement("script");
  bridge.src = new URL("./runtime-legacy-period-bridge-v2.js", import.meta.url).href;
  bridge.async = false;
  bridge.dataset.dmLegacyPeriodBridgeV2 = "true";
  (document.head || document.documentElement).append(bridge);
}

export {
  refreshEnergyStatistics0152,
  refreshSelectedPeriod,
} from "./runtime-consolidated.js";

export {
  PERIOD_SOURCES as PERIOD_SOURCES_0152,
  isCumulativeEnergyEntity as isCumulativeEnergyEntity0154,
  periodConsumption as periodConsumption0152,
  periodRange as periodRange0152,
  sourcePlans as periodPlans0154,
} from "../src/core/period-service.js";

export {
  applianceArtwork0152,
  applianceArtwork0154,
  canonicalArtworkType0154,
} from "../src/core/appliance-artwork.js";
