import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [
      { id: "ev-uno", name: "Prima", brand: "Leapmotor", icon: "mdi:car-electric" },
      { id: "ev-due", name: "Seconda", brand: "Leapmotor", icon: "mdi:car-electric" },
    ],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true, ev: true },
};

async function openEvPage(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
}

test.describe("chi non gestisce evcc non vede la console", () => {
  test("target, autonomia al target e modalita' spariscono insieme", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await openEvPage(page);

    // Nessuna entita' di evcc mappata: il target fermo su "—" e i quattro tasti
    // che non fanno niente non devono occupare posto.
    await expect(page.locator(".lm-target-card")).toBeHidden();
    await expect(page.locator(".lm-evcc-card")).toBeHidden();
    await expect(page.locator("#page-ev .lm-stat-card:has(.v-auto-limite)")).toBeHidden();

    // Mappate: tornano, perche' adesso c'e' qualcosa dietro.
    await page.evaluate(() => {
      const stati = {
        "number.target": { state: "80", attributes: {} },
        "select.modo": { state: "pv", attributes: {} },
      };
      const mappa = {
        "dm.ev_target_soc": "number.target",
        "dm.ev_modalita_ricarica_evcc": "select.modo",
      };
      const precedente = window.resolveEntity;
      window.resolveEntity = (riferimento) =>
        mappa[riferimento] || precedente?.(riferimento) || riferimento;
      // Gli stati arrivano da dove li legge la plancia ospitata.
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    });

    await expect(page.locator(".lm-target-card")).toBeVisible();
    await expect(page.locator(".lm-evcc-card")).toBeVisible();
  });
});
