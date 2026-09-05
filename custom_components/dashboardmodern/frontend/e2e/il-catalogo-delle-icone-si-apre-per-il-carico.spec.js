/* «Non si può cambiare icona del carico, non esce il catalogo.»
 *
 * Il riquadro accanto al nome apre il catalogo delle icone dei carichi — lo
 * stesso che si apre per le stanze e per gli elettrodomestici. Qui si tocca
 * quel riquadro come lo tocca un dito, e si pretende che il catalogo compaia,
 * che si possa scegliere, e che la scelta resti scritta nella casella.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [{ id: "carico-1", name: "Carico 1", icon: "🔌", order: 0 }],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { name: "Casa", grid: { power: "sensor.rete_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

async function apriCarichi(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    try {
      editorSwitch("energy");
    } catch (_errore) {}
  });
  const linguetta = page
    .locator("#editor-modal .ed-inner-tab")
    .filter({ hasText: /CARICHI E DISPOSITIVI|LOADS & DEVICES/i })
    .first();
  await linguetta.waitFor({ state: "visible", timeout: 20_000 });
  await linguetta.click();
  await expect(page.locator('#editor-modal [data-energy-panel="loads"]')).toHaveAttribute(
    "data-dm-loads-editor",
    "true",
    { timeout: 20_000 },
  );
}

test("il riquadro dell'icona apre il catalogo dei carichi", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await apriCarichi(page);

  /* La scheda del carico e' una fisarmonica: si apre toccandone la testa. */
  const scheda = page.locator("#editor-modal .dm-loads-card").first();
  await expect(scheda).toBeVisible({ timeout: 20_000 });
  await scheda.locator("summary").first().click();

  const riquadro = page.locator("#editor-modal [data-dm-load-icon-pick]").first();
  await expect(riquadro).toBeVisible({ timeout: 20_000 });
  /* Niente lo copre: se qualcosa gli sta sopra, il dito non lo trova mai. */
  await riquadro.click({ timeout: 10_000 });

  const catalogo = page.locator("#dm-visual-picker");
  await expect(catalogo).toBeVisible({ timeout: 10_000 });
  /* Ed e' il catalogo dei carichi, non un altro. */
  await expect(catalogo).toHaveAttribute("data-kind", "load");
  await expect(catalogo.locator(".dm-picker-option").first()).toBeVisible();

  /* Si sceglie, e la scelta resta nella casella del carico. */
  const scelta = catalogo.locator(".dm-picker-option").first();
  await scelta.click();
  await expect(catalogo).toHaveCount(0);
  /* Qualcosa e' stato scelto, e sta nella casella del carico. */
  await expect(page.locator("#editor-modal [data-dm-load-icon]").first()).toHaveValue(/.+/);
});

test("sul telefono l'icona e il colore non si accavallano", async ({ page }, testInfo) => {
  /* Dalla segnalazione, con la schermata: sotto «Icona» il riquadro
   * dell'icona e la pastiglia del colore finivano uno sopra l'altro, e il
   * dito che cercava l'icona trovava il colore — «non si può cambiare icona,
   * non esce il catalogo». La riga non e' rotta di suo: si rompe quando lo
   * schermo e' stretto, ed e' li' che va guardata. */
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await apriCarichi(page);
  await page.locator("#editor-modal .dm-loads-card").first().locator("summary").first().click();

  const riquadro = page.locator("#editor-modal [data-dm-load-icon-pick]").first();
  await expect(riquadro).toBeVisible({ timeout: 20_000 });

  /* Niente lo copre: quello che sta al centro del riquadro dev'essere il
   * riquadro. E' la domanda che si fa il dito, non il foglio di stile. */
  const sotto = await riquadro.evaluate((nodo) => {
    const r = nodo.getBoundingClientRect();
    const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      suo: nodo.contains(centro),
      chi: centro ? `${centro.tagName.toLowerCase()}.${centro.className}` : "(niente)",
      largo: Math.round(r.width),
      alto: Math.round(r.height),
    };
  });
  expect(sotto.suo, `sopra il riquadro c'e' ${sotto.chi}`).toBe(true);
  /* E' grande abbastanza da essere il bersaglio ovvio: sullo stretto sta
   * sopra la casella, largo quanto la riga, invece di essere un quadratino
   * schiacciato contro la pastiglia del colore. */
  expect(sotto.largo).toBeGreaterThan(200);
  expect(sotto.alto).toBeGreaterThanOrEqual(44);

  /* E il tocco vero arriva al catalogo. */
  await riquadro.click({ timeout: 10_000 });
  await expect(page.locator("#dm-visual-picker")).toBeVisible({ timeout: 10_000 });
});

test("anche il dispositivo dentro il carico sceglie la sua icona", async ({ page }, testInfo) => {
  /* «E' quando faccio aggiungi dispositivi che non fa scegliere icona.»
   *
   * Il carico aveva il riquadro del catalogo; il dispositivo dentro il carico
   * aveva una casella di testo e basta — un posto dove scrivere «mdi:» a
   * memoria. E' la stessa domanda, e adesso e' lo stesso campo.
   */
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await apriCarichi(page);
  await page.locator("#editor-modal .dm-loads-card").first().locator("summary").first().click();

  await page.locator("#editor-modal [data-dm-subload-add]").first().click();

  /* La maschera del dispositivo, col suo riquadro dell'icona. */
  const modulo = page.locator("#editor-modal .dm-loads-subload-form").first();
  await expect(modulo).toBeVisible({ timeout: 20_000 });
  const riquadro = modulo.locator("[data-dm-load-icon-pick]").first();
  await expect(riquadro).toBeVisible();
  await riquadro.click();

  const catalogo = page.locator("#dm-visual-picker");
  await expect(catalogo).toBeVisible({ timeout: 10_000 });
  await expect(catalogo).toHaveAttribute("data-kind", "load");
  await catalogo.locator(".dm-picker-option").first().click();
  await expect(modulo.locator("[data-dm-load-icon]").first()).toHaveValue(/.+/);

  /* E il tasto che chiude ha la forma degli altri, non il rettangolo grigio
   * del browser: nessun foglio di stile dava una forma a `ed-btn-secondary`,
   * e si vedeva che era finito li' per sbaglio. */
  const chiudi = modulo.locator("[data-dm-subload-done]").first();
  await expect(chiudi).toBeVisible();
  const veste = await chiudi.evaluate((nodo) => {
    const stile = getComputedStyle(nodo);
    return { raggio: Number.parseFloat(stile.borderRadius), peso: Number(stile.fontWeight) };
  });
  expect(veste.raggio).toBeGreaterThanOrEqual(10);
  expect(veste.peso).toBeGreaterThanOrEqual(700);
});
