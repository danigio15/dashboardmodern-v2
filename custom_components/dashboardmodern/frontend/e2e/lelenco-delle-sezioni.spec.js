/* «Per cortesia mi organizzi le sezioni del config con criterio.»
 * «Dove posso inserire i binary sensor di porte e finestre? Non trovo più la
 *  sezione dove inserirli.» (#399)
 *
 * L'interruttore di ogni sezione stava dentro la scheda di quella sezione:
 * ventiquattro schede da aprire per rispondere a «cosa c'è», che è la domanda
 * che si fa per prima. Qui si guarda l'elenco nel Config vero — che ci siano
 * tutte, che l'interruttore scriva dove scrive il guscio, e che la scritta
 * «Configura» porti davvero alla scheda di quella sezione.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
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

async function apriLeImpostazioni(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="visib"]').first().click();
  await expect(page.locator("#dm-elenco-sezioni")).toBeVisible({ timeout: 15_000 });
}

test("l'elenco c'è, con tutte le sezioni e le loro insegne", async ({ page }, testInfo) => {
  await apriLeImpostazioni(page, testInfo);

  const righe = page.locator("#dm-elenco-sezioni [data-dm-sezione]");
  await expect(righe).toHaveCount(24);
  /* I Varchi — la sezione che in #399 non si trovava — ci sono, e stanno sotto
   * l'insegna della Sicurezza. */
  await expect(page.locator('#dm-elenco-sezioni [data-dm-sezione="varchi"]')).toBeVisible();
  const insegne = await page.evaluate(() =>
    [...document.querySelectorAll("#dm-elenco-sezioni .dm-elenco-insegna")].map((n) =>
      n.textContent.trim(),
    ),
  );
  expect(insegne.length).toBe(7);
});

test("l'interruttore scrive dove il guscio legge, e la riga si spegne", async ({
  page,
}, testInfo) => {
  await apriLeImpostazioni(page, testInfo);

  const interruttore = page.locator('#dm-elenco-sezioni [data-dm-sezione-int="varchi"]');
  await expect(interruttore).toHaveAttribute("aria-checked", "true");
  await interruttore.click();

  /* Quello che conta non è il colore: è che la preferenza finisca dove la
   * legge il guscio, che è `cd_sections`. Scriverne un'altra vorrebbe dire
   * una preferenza che nessuno legge — è già successo. */
  const scritto = await page.evaluate(() => (window.cdCfg?.("cd_sections") || {}).varchi);
  expect(scritto).toBe(false);
  await expect(page.locator('#dm-elenco-sezioni [data-dm-sezione-int="varchi"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("«Configura» porta alla scheda di quella sezione", async ({ page }, testInfo) => {
  await apriLeImpostazioni(page, testInfo);

  await page.locator('#dm-elenco-sezioni [data-dm-sezione-vai="varchi"]').click();
  await expect(page.locator('#editor-modal .ed-tab[data-tab="varchi"]')).toHaveClass(/active/);
});

test("il conto in cima segue gli interruttori", async ({ page }, testInfo) => {
  await apriLeImpostazioni(page, testInfo);

  /* Il totale è quante ne conosce la plancia; il primo numero quante se ne
   * vedono, e su questa casa non sono tutte — che è appunto l'informazione per
   * cui l'elenco esiste. Quindi non si guarda un valore: si guarda che dopo un
   * tocco quel numero si muova di uno, e nel verso giusto. */
  const conto = page.locator("#dm-elenco-sezioni .dm-elenco-conto");
  const prima = await conto.textContent();
  const [accese, tutte] = prima.split("/").map(Number);
  expect(tutte).toBe(24);

  const interruttore = page.locator('#dm-elenco-sezioni [data-dm-sezione-int="rifiuti"]');
  const eraAccesa = (await interruttore.getAttribute("aria-checked")) === "true";
  await interruttore.click();

  const atteso = eraAccesa ? accese - 1 : accese + 1;
  await expect(page.locator("#dm-elenco-sezioni .dm-elenco-conto")).toHaveText(
    `${atteso}/${tutte}`,
  );
});
