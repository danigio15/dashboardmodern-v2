/* DashboardModern 0.15.0 compatibility facade: one production runtime. */
import "./runtime-consolidated.js";

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
