/* I carichi si configurano in un posto solo, e non seguono chi cambia pagina.
 *
 * Sotto Elettrodomestici, sotto Aperture e sotto Backup compariva un blocco
 * «CARICHI / + Aggiungi carico» spoglio, che li' non vuol dire niente — i
 * carichi hanno la loro linguetta. Era un secondo editor dei carichi, con lo
 * stesso nome di funzione di quello vero: cercava il pannello dei flussi e, se
 * non lo trovava (cioe' ogni volta che la configurazione era aperta altrove),
 * ripiegava sulla scheda intera. Il blocco restava appeso al corpo della
 * configurazione e da li' ti seguiva ovunque.
 *
 * Bastava aprire Energia una volta per portarselo dietro per il resto della
 * sessione: la prova fa esattamente quello, e poi gira le linguette.
 */
import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";

test("aperta Energia, il blocco dei carichi non segue le altre linguette", async ({
  page,
}, testInfo) => {
  await bootConsolidatedDashboard(page, "dashboard.html", testInfo);
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await expect(page.locator("#editor-modal")).toBeVisible();

  // Il giro che lo faceva comparire: prima Energia, poi tutto il resto.
  const vai = async (linguetta) => {
    await page.evaluate((nome) => {
      try {
        editorSwitch(nome);
      } catch (_errore) {}
    }, linguetta);
    await page.waitForTimeout(400);
  };
  await vai("energy");

  for (const linguetta of ["appliances", "avvisi", "runtime", "stanze", "luci"]) {
    await vai(linguetta);
    const fuoriPosto = await page.evaluate(() => {
      const editor = document.getElementById("editor-modal");
      return [...(editor?.querySelectorAll("[data-energy-loads-editor]") || [])].map(
        (nodo) =>
          `${(nodo.textContent || "").trim().slice(0, 40)} dentro ${nodo.parentElement?.id || nodo.parentElement?.className || "?"}`,
      );
    });
    expect(fuoriPosto, `linguetta ${linguetta}`).toEqual([]);
  }
});

/* E «Carichi e dispositivi» continua a disegnarli, con l'editor giusto: e' la
 * meta' che conta quanto l'altra, perche' togliere il doppione non deve aver
 * portato via anche quello vero. */
test("i carichi restano nella loro pagina", async ({ page }, testInfo) => {
  await bootConsolidatedDashboard(page, "dashboard.html", testInfo);
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

  const pannello = page.locator('#editor-modal [data-energy-panel="loads"]');
  await expect(pannello).toHaveAttribute("data-dm-loads-editor", "true", { timeout: 20_000 });
  await expect(pannello.locator("[data-dm-load-add]")).toHaveCount(1);
});
