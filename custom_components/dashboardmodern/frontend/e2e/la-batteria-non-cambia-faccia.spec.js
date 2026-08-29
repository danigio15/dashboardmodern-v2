/* Il numero della batteria non cambia faccia da solo.
 *
 * Nel video si vedeva questo: nel flusso dell'Energia la bolla della batteria
 * diceva «▼ 1796 W / SOC 75%», e due fotogrammi dopo «-1796 W / 75 %», e poi
 * di nuovo la prima. Non era un'animazione: erano quattro mani sullo stesso
 * nodo — il guscio col suo formattatore, questo modulo, un modulo di rattoppo
 * con un terzo formato, e un quarto che teneva un MutationObserver per
 * rimettere il prefisso «SOC» addosso a quello che scrivevano gli altri.
 *
 * Qui si fanno quaranta cambi di stato e si conta quante forme diverse passano
 * dalle due caselle. Una sola: se ne compaiono due, sono due padroni.
 */
import { test, expect } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      house: { power: "sensor.casa_w" },
      solar: { power: "sensor.solare_w" },
      battery: { power: "sensor.batteria_w", soc: "sensor.batteria_soc" },
      grid: { power: "sensor.rete_w" },
    },
  },
  visibility: { energy: true },
};
test("nel flusso la batteria ha una forma sola", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const g = eval("_RAW_STATES");
    const m = (id, v, u) => {
      g[id] = { entity_id: id, state: String(v), attributes: { unit_of_measurement: u } };
    };
    m("sensor.casa_w", 92, "W");
    m("sensor.solare_w", 2257, "W");
    m("sensor.batteria_w", -1796, "W");
    m("sensor.batteria_soc", 75, "%");
    m("sensor.rete_w", -208, "W");
  });
  await page.evaluate(() => {
    window.__F__ = { soc: [], batt: [] };
    for (const [id, k] of [
      ["v-battery-soc", "soc"],
      ["v-battery", "batt"],
    ]) {
      const n = document.getElementById(id);
      if (n)
        new MutationObserver(() => window.__F__[k].push(n.textContent.trim())).observe(n, {
          childList: true,
          characterData: true,
          subtree: true,
        });
    }
  });
  for (let i = 0; i < 40; i++) {
    await page.evaluate((i) => {
      const g = eval("_RAW_STATES");
      g["sensor.casa_w"] = {
        entity_id: "sensor.casa_w",
        state: String(92 + i),
        attributes: { unit_of_measurement: "W" },
      };
      window.dispatchEvent(new CustomEvent("dm-states-updated"));
      window.applyStates?.();
      window.render?.();
      window.refreshAll?.();
    }, i);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(800);
  const f = await page.evaluate(() => window.__F__);
  const forme = (a) => [...new Set(a)];
  console.log("SOC  scritture:", f.soc.length, "forme distinte:", JSON.stringify(forme(f.soc)));
  console.log("BATT scritture:", f.batt.length, "forme distinte:", JSON.stringify(forme(f.batt)));
  expect(forme(f.soc).length, "il SOC deve avere una forma sola").toBeLessThanOrEqual(1);
  expect(forme(f.batt).length, "la potenza deve avere una forma sola").toBeLessThanOrEqual(1);
});
