/* Due rilevatori nella stessa stanza: due card, non una.
 *
 * «Se nella stessa stanza metto più rilevatori di temperature ne fa vedere
 * solo uno, direi il primo.» Le associazioni oltre la prima esistevano gia' —
 * vivono in `metadata.temperature_entries` — ma la pagina Temperatura aveva
 * DUE disegnatori in guerra per `buildTempCards`: quello per associazione e
 * quello per stanza, e vinceva l'ultimo installato — il per-stanza, che
 * disegna solo la prima coppia. Adesso il disegnatore e' uno, e conosce tutte
 * le sonde.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-salone",
        name: "Salone",
        icon: "🛋️",
        temp: "sensor.salone_temperature",
        hum: "sensor.salone_humidity",
        metadata: {
          temperature_entries: [
            {
              id: "temperature-extra-1",
              name: "Comodino",
              temp: "sensor.comodino_temperature",
            },
          ],
        },
      },
      { id: "room-bagno", name: "Bagno", icon: "🛁", temp: "sensor.bagno_temperature" },
    ],
  },
  visibility: { temp: true },
};

const STATI = [
  ["sensor.salone_temperature", "21.4"],
  ["sensor.salone_humidity", "48"],
  ["sensor.comodino_temperature", "24.9"],
  ["sensor.bagno_temperature", "19.2"],
];

test("ogni sonda ha la sua card, col suo valore e il suo nome", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  await page.evaluate((stati) => {
    for (const [id, valore] of stati) {
      const stato = {
        entity_id: id,
        state: valore,
        attributes: { unit_of_measurement: id.includes("humidity") ? "%" : "°C" },
      };
      eval("_RAW_STATES")[id] = stato;
      eval("STATES")[id] = stato;
    }
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-temp")?.classList.add("active");
    window.render?.();
    window.buildTempCards?.();
  }, STATI);

  const cards = page.locator("#temp-grid .temp-card[data-room-id]");
  await expect(cards).toHaveCount(3);

  /* Le due card del Salone si distinguono, e ognuna porta il SUO valore. */
  const salone = page.locator('#temp-grid .temp-card[data-room-id="room-salone"]');
  await expect(salone).toHaveCount(2);
  const titoli = await salone.locator(".temp-room-name").allInnerTexts();
  expect(titoli.some((testo) => /Comodino/.test(testo))).toBe(true);
  const valori = await salone.locator(".temp-value").allInnerTexts();
  expect(valori.sort()).toEqual(["21.4", "24.9"]);

  /* La seconda sonda si aggiorna anche da sola: il cambio di stato deve
   * svegliare pure lei, non solo la prima coppia. */
  await page.evaluate(() => {
    eval("_RAW_STATES")["sensor.comodino_temperature"].state = "26.1";
    eval("STATES")["sensor.comodino_temperature"].state = "26.1";
    window.dispatchEvent(
      new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_ids: ["sensor.comodino_temperature"] },
      }),
    );
  });
  await expect(
    page.locator('#temp-grid .temp-card[data-temperature-id="temperature-extra-1"] .temp-value'),
  ).toHaveText("26.1");
});
