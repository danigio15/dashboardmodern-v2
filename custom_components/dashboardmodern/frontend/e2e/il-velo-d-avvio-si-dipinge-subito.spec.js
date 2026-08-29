/* Al primo avvio non si resta su uno schermo bianco.
 *
 * Segnalato con una schermata: la plancia, appena installata, restava bianca
 * per tutto il tempo del download. Il velo d'avvio c'era gia', ma stava sotto
 * uno script sincrono e il primo dipinto era comunque bloccato dai fogli di
 * stile esterni: finche' non arrivavano tutti — 264KB di CSS, i caratteri, due
 * script in testa — non si dipingeva NIENTE, nemmeno il velo.
 *
 * Adesso il velo e' la prima cosa del body, vestito da regole inline che non
 * aspettano nessuno, e i fogli grandi non bloccano piu' il dipinto: sotto il
 * velo non si vede niente comunque, finche' la plancia non e' pronta.
 */
import { expect, test } from "@playwright/test";

test("il velo si dipinge anche con la rete lenta", async ({ page }) => {
  test.setTimeout(90_000);
  /* La rete lenta di un primo avvio: il runtime e i fogli grandi non arrivano.
   * Il velo deve esserci lo stesso, dipinto dalle regole inline. */
  await page.route("**/dashboard-runtime-it.js", (r) => new Promise(() => {}));
  await page.route("**/dashboard-runtime-it.css", (r) => new Promise(() => {}));
  await page.goto("/legacy/dashboard.html?dmi=prova-velo-lento", { waitUntil: "commit" });
  const velo = page.locator("#cd-boot-overlay");
  await expect(velo).toBeVisible({ timeout: 10000 });
  expect(await velo.innerText()).toMatch(/DashboardModern/i);
  const stile = await velo.evaluate((n) => {
    const s = getComputedStyle(n);
    return { sfondo: s.backgroundColor, posizione: s.position, colonna: s.flexDirection };
  });
  expect(stile.posizione).toBe("fixed");
  expect(stile.colonna).toBe("column");
  expect(stile.sfondo).not.toBe("rgba(0, 0, 0, 0)");
});

test("quando la plancia e' pronta il velo se ne va, e la plancia e' vestita", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/legacy/dashboard.html?dmi=prova-velo");
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0, { timeout: 15000 });
  const vestita = await page.evaluate(() =>
    Boolean(document.getElementById("dm-page-masthead-style") || document.styleSheets.length > 3),
  );
  expect(vestita).toBe(true);
});
