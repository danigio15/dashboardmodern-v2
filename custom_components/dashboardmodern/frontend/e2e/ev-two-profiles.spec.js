/* Due auto configurate devono restare due.
 *
 * Si mappano le entita' della prima auto, le si salva come profilo, si rimappa
 * per la seconda e si salva di nuovo: nella pagina Auto compaiono due schede
 * fra cui scegliere. Il percorso passa da localStorage, dal negozio e da tre
 * rifiniture diverse, e finora nessuna prova lo copriva dall'inizio alla fine.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { ev: true },
};

for (const variant of PRIMARY) {
  test(`${variant}: two saved car profiles both reach the Auto page`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await bootNamespacedDashboard(page, variant, testInfo, seed);
    await page.evaluate(() => {
      if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
      const tab = [...document.querySelectorAll("#editor-modal .ed-tab")].find((node) =>
        /\bEV\b/i.test(node.textContent),
      );
      tab?.click();
    });
    await expect(page.locator('#ed-body input[placeholder*="Nome auto"]')).toBeVisible();

    const saveProfile = async (name, battery) => {
      await page.evaluate((entity) => {
        const input = document.querySelector(
          '#ed-body .ed-slot-in[data-ref="dm.ev_batteria_auto"]',
        );
        if (!input) throw new Error("the battery slot is missing from the EV editor");
        input.value = entity;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, battery);
      await page.locator('#ed-body input[placeholder*="Nome auto"]').fill(name);
      await page.locator("#ed-body button", { hasText: "SALVA ATTUALE" }).first().click();
    };

    await saveProfile("Zoe", "sensor.zoe_soc");
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").length))
      .toBe(1);

    // The second save adds a profile; it does not overwrite the first.
    await saveProfile("Tesla", "sensor.tesla_soc");
    await expect
      .poll(() =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((car) => [
            car.name,
            car.ov?.["dm.ev_batteria_auto"],
          ]),
        ),
      )
      .toEqual([
        ["Zoe", "sensor.zoe_soc"],
        ["Tesla", "sensor.tesla_soc"],
      ]);

    // And the Auto page offers both, not just the one saved last.
    await page.evaluate(() => {
      document.getElementById("editor-modal")?.classList.remove("show");
      document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
      document.getElementById("page-ev")?.classList.add("active");
      window.cdEvCarsRefresh?.();
      window.render?.();
    });

    const picker = page.locator("#ev-car-picker");
    await expect(picker).toBeVisible();
    await expect(picker).toHaveAttribute("data-profile-count", "2");
    await expect(picker.locator(".dm-vehicle-profile-card")).toHaveCount(2);
    await expect(picker).toContainText("Zoe");
    await expect(picker).toContainText("Tesla");
  });
}
