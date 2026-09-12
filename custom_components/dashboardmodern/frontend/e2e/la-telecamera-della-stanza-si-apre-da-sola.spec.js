/* «Se vado su stanze e c'è una telecamera e ci clicco sopra dovrebbe aprire
 * solo quella e non puntare sulla scheda dove ci sono tutte le telecamere. Se
 * poi torno indietro non torna sulla stanza dov'ero» (#503).
 *
 * Le due metà sono la stessa cosa: portare nella Sicurezza vuol dire uscire
 * dalla stanza, e chi esce poi deve ritrovarla. Qui si fa il gesto vero — si
 * apre la stanza, si tocca la riga della telecamera — e si guardano tre cose:
 * che si apra UNA telecamera e sia la sua, che la pagina resti la stanza, e
 * che chiudendo la finestra la stanza sia ancora quella.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r1", name: "Salone", icon: "mdi:sofa" },
      { id: "r2", name: "Giardino", icon: "mdi:flower" },
    ],
    cameras: [
      { id: "c1", name: "Ingresso", entity: "camera.ingresso", room: "r1" },
      { id: "c2", name: "Vialetto", entity: "camera.vialetto", room: "r2" },
    ],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: { rooms: true, security: true },
};

test("la telecamera della stanza si apre da sola, e la stanza resta", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });
  /* Nessun negoziato vero: quello che si prova qui è dove finisce il tocco,
   * non come si collega la telecamera. Senza questo la prova aspetterebbe
   * WebRTC e HLS su una telecamera che non esiste. */
  await page.evaluate(() => {
    window.dmStartWebRTCNative = () => new Promise(() => {});
    const g = eval("_RAW_STATES");
    for (const entity of ["camera.ingresso", "camera.vialetto"]) {
      g[entity] = {
        entity_id: entity,
        state: "idle",
        attributes: { friendly_name: entity.split(".")[1], entity_picture: "/api/camera/x" },
      };
    }
    window.applyStates?.();
    window.render?.();
  });

  await page.locator('.tab[data-tab="stanze"]').first().click();
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);

  /* La stanza col giardino, che è la seconda: si sceglie con la sua pastiglia,
   * così si prova anche che la finestra apra la telecamera GIUSTA e non la
   * prima della lista.
   *
   * La pastiglia si ritocca finché la riga non c'è: la pagina si ridisegna da
   * sé a ogni giro di stati, e un tocco capitato in mezzo a un ridisegno va a
   * finire su un nodo che non è più quello — da fuori si vede una stanza che
   * non cambia. */
  const riga = page.locator('#page-stanze [data-dm-stanza-entita="camera.vialetto"]');
  await expect
    .poll(
      async () => {
        await page.locator('#page-stanze [data-dm-stanza="r2"]').first().click({ force: true });
        return riga.count();
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await riga.first().click();

  /* Si apre la finestra del guscio, e dentro c'è quella telecamera sola. */
  await expect(page.locator("#details-modal")).toHaveClass(/show/, { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => document.getElementById("details-title")?.textContent || ""), {
      timeout: 15_000,
    })
    .toMatch(/VIALETTO/i);

  /* E la pagina non si è mossa: è ancora la stanza. Era questa la metà che
   * mancava — si finiva nella Sicurezza, e tornando indietro la stanza di
   * partenza non si ritrovava. */
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);
  expect(await page.evaluate(() => document.querySelector(".page.active")?.id)).toBe("page-stanze");

  /* Chiusa la finestra, si è ancora lì — e nella stessa stanza. */
  await page.evaluate(() => document.getElementById("details-modal")?.classList.remove("show"));
  expect(await page.evaluate(() => document.querySelector(".page.active")?.id)).toBe("page-stanze");
  await expect(riga.first()).toBeVisible();
});
