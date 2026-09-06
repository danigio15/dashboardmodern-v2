/* «Mi sposti il pulsante donazioni qua sotto ad assistenza invece che dentro
 * configurazione.»
 *
 * La porta stava dentro l'editor delle entita' — una pastiglia nella colonna
 * delle linguette e una card nella scheda Impostazioni — cioe' nel posto dove
 * si va per lavorare. Adesso e' una tessera della pagina Configurazione, in
 * fondo, dove stanno gia' Segnalazioni e Assistenza: le due porte che parlano
 * col progetto invece che con la casa. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: { rooms: [], lights: [], appliances: [], loads: [], covers: [] },
  visibility: { home: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
}

test("la tessera del sostegno sta in fondo alla pagina Configurazione, e apre la finestra", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await avvia(page, testInfo);

  await page.locator('.tab[data-tab="config"]').first().click();
  const pagina = page.locator("#page-config");
  await expect(pagina).toHaveClass(/active/);

  const tessera = page.locator("#dm-sostieni-card");
  await expect(tessera).toBeVisible({ timeout: 15_000 });
  /* Dopo le altre: e' l'ultima della griglia, anche se qualcuna nasce dopo. */
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector("#page-config .cfg-grid")?.lastElementChild?.id || "",
      ),
    )
    .toBe("dm-sostieni-card");
  /* Ha la veste delle altre due: icona, nome, spiegazione, freccina. */
  for (const pezzo of [".cfg-card-ico", ".cfg-card-nm", ".cfg-card-ds", ".cfg-card-arrow"])
    await expect(tessera.locator(pezzo)).toHaveCount(1);

  /* Il tocco apre la finestra che racconta il progetto, e li' c'e' il tasto
   * che porta a PayPal in una scheda nuova. */
  await tessera.click();
  const finestra = page.locator("#dm-sostieni-modal");
  await expect(finestra).toHaveClass(/show/);
  const tasto = finestra.locator("a.dm-sostieni-tasto");
  await expect(tasto).toHaveAttribute("target", "_blank");
  await expect(tasto).toHaveAttribute("href", "https://www.paypal.com/paypalme/giovannidaniello15");
  await page.evaluate(() => window.DashboardModernSostieni?.chiudi());
  await expect(finestra).not.toHaveClass(/show/);

  /* E dentro l'editor delle entita' non c'e' piu' niente: ne' la pastiglia
   * nella colonna delle linguette, ne' la card in «Impostazioni». */
  await page.evaluate(() => apriConfigEntita());
  await expect(page.locator("#editor-modal")).toBeVisible();
  await expect(page.locator(".dm-sostieni-pastiglia")).toHaveCount(0);
  await expect(page.locator("#ed-body .dm-sostieni-card")).toHaveCount(0);
});
