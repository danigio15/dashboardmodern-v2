import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Vorrei avere la possibilità di aprire assist per chiedere delle cose sia
 * scrivendo che parlando.» (#360)
 *
 * La strada intera, scrivendo: si apre il tasto, si scrive, la frase parte per
 * Home Assistant e la risposta torna nella finestra.
 */
const seed = {
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

async function apriLaPlancia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  /* La presa del guscio risponde da sola.
   *
   * `ws` e `pendingWsCallbacks` sono variabili lessicali del guscio: si arriva
   * a entrambe con `eval` nello stesso posto in cui le legge la plancia. Qui
   * si mette al posto della presa una che raccoglie le domande e rimanda
   * indietro quello che manderebbe Home Assistant. */
  await page.evaluate(() => {
    window.__CHIESTO__ = [];
    window.eval(`
      ws = {
        readyState: 1,
        send(grezzo) {
          const messaggio = JSON.parse(grezzo);
          if (messaggio.type !== "conversation/process") return;
          window.__CHIESTO__.push(messaggio);
          setTimeout(() => {
            const torna = pendingWsCallbacks[messaggio.id];
            delete pendingWsCallbacks[messaggio.id];
            torna && torna({
              id: messaggio.id,
              success: true,
              result: {
                conversation_id: "filo-1",
                response: {
                  response_type: "query_answer",
                  speech: { plain: { speech: "In camera ci sono 21 gradi." } },
                },
              },
            });
          }, 20);
        },
      };
    `);
  });
}

test("il tasto apre Assist, e la domanda parte per Home Assistant", async ({ page }, testInfo) => {
  await apriLaPlancia(page, testInfo);

  const tasto = page.locator("#dm-assist-tasto");
  await expect(tasto).toHaveCount(1);
  await tasto.click();
  await expect(page.locator("#dm-assist-modal")).toHaveClass(/show/);

  await page.locator("[data-dm-assist-testo]").fill("quanti gradi ci sono in camera");
  await page.locator("[data-dm-assist-form] button[type='submit']").click();

  // La domanda è partita, nella forma che Home Assistant si aspetta.
  await expect
    .poll(() => page.evaluate(() => window.__CHIESTO__?.[0]?.text || ""))
    .toBe("quanti gradi ci sono in camera");
  // E la risposta è nella finestra, sotto la domanda.
  await expect(page.locator("#dm-assist-modal .dm-assist-corpo")).toContainText(/21 gradi/);
  await expect(page.locator('#dm-assist-modal [data-chi="io"]')).toContainText(/quanti gradi/);
});

test("la seconda domanda riannoda il filo della prima", async ({ page }, testInfo) => {
  /* Mandare indietro il conversation_id fa capire «accendila» dopo «quale luce
   * c'è in salone». */
  await apriLaPlancia(page, testInfo);
  await page.locator("#dm-assist-tasto").click();
  const casella = page.locator("[data-dm-assist-testo]");
  const manda = page.locator("[data-dm-assist-form] button[type='submit']");

  await casella.fill("che luci ci sono in salone");
  await manda.click();
  await expect.poll(() => page.evaluate(() => window.__CHIESTO__.length)).toBe(1);

  await casella.fill("accendile");
  await manda.click();
  await expect.poll(() => page.evaluate(() => window.__CHIESTO__.length)).toBe(2);
  await expect
    .poll(() => page.evaluate(() => window.__CHIESTO__[1]?.conversation_id || ""))
    .toBe("filo-1");
});

test("una frase vuota non parte", async ({ page }, testInfo) => {
  await apriLaPlancia(page, testInfo);
  await page.locator("#dm-assist-tasto").click();
  await page.locator("[data-dm-assist-testo]").fill("   ");
  await page.locator("[data-dm-assist-form] button[type='submit']").click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__CHIESTO__.length)).toBe(0);
});

test("spegnendolo in configurazione il tasto se ne va", async ({ page }, testInfo) => {
  await apriLaPlancia(page, testInfo);
  await expect(page.locator("#dm-assist-tasto")).toHaveCount(1);
  await page.evaluate(() => {
    localStorage.setItem("cd_assist", JSON.stringify({ tasto: false }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:config-changed"));
  });
  await expect(page.locator("#dm-assist-tasto")).toHaveCount(0);
});
