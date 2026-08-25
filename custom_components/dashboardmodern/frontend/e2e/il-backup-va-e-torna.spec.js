/* La scheda «💾 Backup»: la configurazione va in un file e torna.
 *
 * Qui si prova il giro dal vivo: la scheda compare fra le altre, un testo
 * che non e' un backup viene rifiutato con le parole giuste, uno valido
 * apre la conferma inline — e il ripristino scrive davvero le chiavi. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: { rooms: [], lights: [], appliances: [], loads: [], covers: [] },
  visibility: { home: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    window.apriConfigEntita();
  });
  const tab = page.locator('.ed-tab[data-tab="backup"]');
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.locator("#ed-body .dm-backup-card")).toHaveCount(2);
}

test("un testo qualsiasi non passa, un backup vero apre la conferma e scrive", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);

  const paste = page.locator("[data-backup-paste]");
  await paste.fill("questo non e' un backup");
  await paste.dispatchEvent("change");
  await expect(page.locator("[data-backup-error]")).not.toHaveText("");
  await expect(page.locator("[data-backup-confirm]")).toBeHidden();

  const payload = await page.evaluate(() => {
    return JSON.stringify({
      format: "dashboardmodern-config-backup",
      revision: 99,
      created: "2026-08-25T00:00:00.000Z",
      values: {
        cd_branding: JSON.stringify({ title: "Casa ripristinata" }),
        chiave_estranea: "non deve arrivare",
      },
    });
  });
  await paste.fill(payload);
  await paste.dispatchEvent("change");
  await expect(page.locator("[data-backup-error]")).toHaveText("");
  await expect(page.locator("[data-backup-confirm]")).toBeVisible();
  await expect(page.locator("[data-backup-summary]")).toContainText("1");

  await page.locator("[data-backup-apply]").click();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("cd_branding")))
    .toBe(JSON.stringify({ title: "Casa ripristinata" }));
  const estranea = await page.evaluate(() => window.localStorage.getItem("chiave_estranea"));
  expect(estranea).toBeNull();
});

test("il backup scaricabile e' un JSON che il ripristino riconosce", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  // Il giro build→parse e' provato a fondo nei test unitari; dal vivo basta
  // che il payload costruito dalla scheda sia uno che la scheda stessa accetta.
  await page.evaluate(() => {
    window.localStorage.setItem("cd_branding", JSON.stringify({ title: "Casa" }));
  });
  const testo = await page.evaluate(async () => {
    const { buildBackupPayload } = await import("../src/sections/backup-editor-section.js");
    return JSON.stringify(buildBackupPayload((key) => window.localStorage.getItem(key)));
  });
  const paste = page.locator("[data-backup-paste]");
  await paste.fill(testo);
  await paste.dispatchEvent("change");
  await expect(page.locator("[data-backup-confirm]")).toBeVisible();
});
