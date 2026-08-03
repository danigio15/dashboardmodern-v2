/* DashboardModern 0.15.0 compatibility facade: one production runtime. */
import "./runtime-regression-guard.js";
import {
  refreshEnergyStatistics0152 as refreshEnergyStatisticsCore0152,
  refreshSelectedPeriod,
} from "./runtime-consolidated.js";
import "./runtime-canonical-readiness.js";
import "./runtime-residual-contracts.js";
import "./runtime-compatibility.js";
import "./runtime-release-owner-v3.js";

function loadClassicRuntime(id, path, readyKey) {
  if (typeof document === "undefined" || globalThis[readyKey]) return Promise.resolve(true);
  const current = document.getElementById(id);
  if (current) {
    return new Promise((resolve) => {
      if (globalThis[readyKey]) resolve(true);
      else {
        current.addEventListener("load", () => resolve(true), { once: true });
        current.addEventListener("error", () => resolve(false), { once: true });
      }
    });
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = new URL(path, import.meta.url).href;
    script.async = false;
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    (document.head || document.documentElement).append(script);
  });
}

const classicRuntimeReady =
  typeof document === "undefined"
    ? Promise.resolve(true)
    : loadClassicRuntime(
        "dm-runtime-legacy-period-bridge-v2",
        "./runtime-legacy-period-bridge-v2.js",
        "__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE_V2__",
      );

function statisticsStatus(result) {
  if (typeof document === "undefined") return;
  let status = document.querySelector("[data-dm-energy-statistics-status]");
  if (!status) {
    status = document.createElement("output");
    status.hidden = true;
    status.dataset.dmEnergyStatisticsStatus = "";
    status.setAttribute("aria-live", "polite");
    (document.getElementById("page-energy") || document.body || document.documentElement).append(status);
  }
  status.textContent = result
    ? ""
    : document.documentElement.lang === "en"
      ? "Energy statistics unavailable"
      : "Statistiche energia non disponibili";
}

export { refreshSelectedPeriod };

export async function refreshEnergyStatistics0152(selected = new Date()) {
  await classicRuntimeReady;
  const broker = globalThis.DashboardModernRuntime0150?.broker;
  broker?.cache?.clear?.();
  broker?.inflight?.clear?.();
  const result = await refreshEnergyStatisticsCore0152(selected);
  globalThis.__DASHBOARDMODERN_LEGACY_PERIOD_BRIDGE__?.project?.();
  globalThis.__DASHBOARDMODERN_RESIDUAL_CONTRACTS_0150__?.apply?.();
  globalThis.__DASHBOARDMODERN_RELEASE_OWNER_0150__?.apply?.();
  statisticsStatus(result);
  return result;
}

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
