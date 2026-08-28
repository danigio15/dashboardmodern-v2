/* Una finestra col solo sensore si inseriva ma non si poteva piu' modificare.
 *
 * «Le tapparelle ora posso inserire anche solo il sensore finestra, ma poi se
 * voglio modificarlo — avevo dimenticato il nome — non me lo salva perche'
 * vuole l'entita' della tapparella.»
 *
 * Era la stessa regola scritta in due posti che dicevano due cose. Chi
 * INSERISCE la riga il contatto da solo lo accetta gia': persiane, scuri, una
 * maniglia — cose che non si comandano ma che si sa se sono aperte. Chi la
 * RIAPRE per modificarla contava soltanto le tre coperture — tapparella, tenda,
 * tenda da sole — e rifiutava la riga che l'altro aveva appena creato.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEED = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-bagno", name: "Bagno", icon: "🛁", floor: "Piano terra", metadata: {} }],
    covers: [
      { name: "Finestra Bagno", contact: "binary_sensor.finestra_bagno", room: "room-bagno" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    energyLoads: [],
    entityOverrides: {},
  },
  visibility: { home: true, covers: true },
};

test("la finestra col solo sensore si riapre, si rinomina e si salva", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 20_000,
  });
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch("tapp");
  });
  await expect(page.locator('[data-dm-edit-kind="shutter"]').first()).toBeVisible({
    timeout: 15_000,
  });
  await page.locator('[data-dm-edit-kind="shutter"]').first().click();

  const finestra = page.locator("#dm-shutter-editor-modal");
  await expect(finestra).toBeVisible({ timeout: 10_000 });
  // Il sensore c'e', e le caselle delle coperture sono vuote: e' il caso.
  await expect(finestra.locator('[name="contact"]')).toHaveValue("binary_sensor.finestra_bagno");
  await expect(finestra.locator('[name="entity"]')).toHaveValue("");

  await finestra.locator('[name="name"]').fill("Finestra Bagno Grande");
  await finestra.locator('button[type="submit"]').click();

  // Salvata: niente errore a schermo, e il nome nuovo e' nella configurazione.
  await expect(finestra).toBeHidden({ timeout: 10_000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cd_tapparelle")), { timeout: 10_000 })
    .toContain("Finestra Bagno Grande");
  // E il sensore non si e' perso per strada.
  const salvato = await page.evaluate(() => localStorage.getItem("cd_tapparelle"));
  expect(salvato).toContain("binary_sensor.finestra_bagno");
});
