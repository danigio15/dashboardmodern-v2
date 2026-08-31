/* La matita della telecamera riporta l'entita' anche nella veste.
 *
 * Dal campo: «in modifica sparisce l'entita'». La matita riempiva il campo
 * grezzo in silenzio, e la chip che lo veste — ridipinta solo sul `change` —
 * continuava a dire «Scegli entita'» sopra un campo pieno. Ora la matita
 * annuncia il cambio e la chip dice quello che c'e'.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [{ id: "cam-1", name: "Ingresso", entity: "camera.ingresso", stream: "" }],
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
  visibility: { home: true },
};

test("la matita riempie campo E veste", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll(".ed-tab")].find((v) =>
      /sicurezza|security/i.test(v.textContent || ""),
    );
    tab?.click();
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const acc = [...document.querySelectorAll("details.ed-acc")].find((d) =>
      /Telecamere/.test(d.querySelector(".ed-acc-head")?.textContent || ""),
    );
    if (acc) acc.open = true;
    acc?.querySelector('[onclick^="edEditCamera"]')?.click();
  });
  /* Il campo grezzo si riempie subito... */
  await expect(page.locator("#ed-cam-ent")).toHaveValue("camera.ingresso", { timeout: 10000 });
  /* ...e la VESTE — quella che si vede — dice l'entita', non «Scegli». */
  await expect
    .poll(
      async () =>
        page
          .locator("#ed-cam-ent")
          .evaluate(
            (input) =>
              input.parentElement?.querySelector("[data-chip-name]")?.textContent?.trim() || "",
          ),
      { timeout: 10000 },
    )
    .toContain("camera.ingresso");
});
