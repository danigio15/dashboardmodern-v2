/* «Aggiungi persona» mette al sicuro la persona che si stava scrivendo.
 *
 * Dal campo: «se mentre si sta creando una persona si preme Aggiungi
 * persona, deve salvare la persona corrente e crearne una nuova — non
 * crearne una nuova buttando la precedente». Il ridisegno che segue il
 * tasto riscriveva le caselle con quello che c'era in memoria, e il nome
 * appena scritto — su una persona ancora senza entita' — spariva.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
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
  visibility: { home: true },
};

test("il nome scritto a meta' sopravvive al secondo Aggiungi", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => window.apriConfigEntita());
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll(".ed-tab")].find((voce) =>
      /persone|people/i.test(voce.textContent || ""),
    );
    tab?.click();
  });
  const aggiungi = page.locator("#editor-modal [data-person-add]");
  await expect(aggiungi).toBeVisible({ timeout: 20000 });

  /* Prima persona: nasce col nome provvisorio, la si battezza subito. */
  await aggiungi.click();
  const nome = page.locator('#editor-modal [data-person-index="0"] [data-person-field="name"]');
  await expect(nome).toBeVisible({ timeout: 10000 });
  await nome.fill("Marco");

  /* Seconda persona, SENZA aver salvato la prima: il nome resta. */
  await aggiungi.click();
  await expect(
    page.locator('#editor-modal [data-person-index="0"] [data-person-field="name"]'),
  ).toHaveValue("Marco", { timeout: 10000 });
  await expect(page.locator("#editor-modal [data-person-index]")).toHaveCount(2);
});
