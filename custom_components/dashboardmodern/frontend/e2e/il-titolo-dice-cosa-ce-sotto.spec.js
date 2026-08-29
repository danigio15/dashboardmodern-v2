/* Un blocco intitolato «Comandi» ha qualcosa da premere.
 *
 * Nella finestra dell'Energia, sotto «COMANDI», stavano Casa, Solare, Rete e
 * Batteria: quattro letture, senza un tasto. Lo stesso per Telecamere, Solare
 * termico e Piscina. Un titolo che annuncia comandi dove non ce ne sono manda
 * a cercare qualcosa che non c'e', e chi cerca pensa che sia rotto.
 *
 * Il titolo adesso guarda cosa c'e' davvero nel blocco invece di deciderlo a
 * tavolino: se c'e' qualcosa da premere sono comandi, altrimenti sono letture.
 * Qui si apre ogni finestra e si pretende che le due cose vadano d'accordo —
 * in tutt'e due i versi, perche' anche il contrario sarebbe un difetto: un
 * blocco pieno di interruttori intitolato «Letture» direbbe che non si tocca.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [{ id: "c1", name: "Ingresso", entity: "camera.ingresso" }],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", entity: "light.salone", room: "r1" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      house: { power: "sensor.casa_w" },
      solar: { power: "sensor.solare_w" },
      battery: { power: "sensor.batteria_w", soc: "sensor.batteria_soc" },
      grid: { power: "sensor.rete_w" },
    },
  },
  visibility: { energy: true, rooms: true, lights: true, security: true },
};

test("il titolo del blocco dice cosa c'e' sotto", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    const metti = (id, valore, unita) => {
      grezzi[id] = {
        entity_id: id,
        state: String(valore),
        attributes: { friendly_name: id, unit_of_measurement: unita },
      };
    };
    metti("sensor.casa_w", 574, "W");
    metti("sensor.solare_w", 2160, "W");
    metti("sensor.batteria_w", -1470, "W");
    metti("sensor.batteria_soc", 75, "%");
    metti("sensor.rete_w", 41, "W");
    metti("light.salone", "on");
    window.applyStates?.();
    window.render?.();
  });
  await page.waitForTimeout(1000);

  const chiavi = await page.evaluate(() =>
    [...document.querySelectorAll("[data-dm-widget]")].map((n) => n.dataset.dmWidget),
  );
  expect(chiavi.length, "servono delle tessere da aprire").toBeGreaterThan(0);

  for (const chiave of chiavi) {
    await page.evaluate((k) => document.querySelector(`[data-dm-widget="${k}"]`)?.click(), chiave);
    await page.waitForTimeout(450);
    const blocchi = await page.evaluate(() => {
      const finestra = document.getElementById("dm-widget-popup");
      if (!finestra) return [];
      /* Il blocco e' il titolo piu' tutte le righe che lo seguono fino al
       * titolo dopo: si guarda quello che sta sotto ciascuno, non tutta la
       * finestra — altrove ci sono interruttori che non gli appartengono. */
      const fuori = [];
      for (const titolo of finestra.querySelectorAll(".dm-w-titoletto")) {
        let premibili = 0;
        for (let n = titolo.nextElementSibling; n; n = n.nextElementSibling) {
          if (n.classList.contains("dm-w-titoletto")) break;
          premibili += n.querySelectorAll("button,input,select,[role=switch]").length;
        }
        fuori.push({ testo: titolo.textContent.trim(), premibili });
      }
      return fuori;
    });

    for (const blocco of blocchi) {
      const diceComandi = /^(?:Comandi|Controls)$/i.test(blocco.testo);
      const diceLetture = /^(?:Letture|Readings)$/i.test(blocco.testo);
      if (diceComandi)
        expect(
          blocco.premibili,
          `«${chiave}»: il blocco si chiama «${blocco.testo}» ma sotto non c'e' niente da premere`,
        ).toBeGreaterThan(0);
      if (diceLetture)
        expect(
          blocco.premibili,
          `«${chiave}»: il blocco si chiama «${blocco.testo}» ma sotto ci sono ${blocco.premibili} comandi`,
        ).toBe(0);
    }

    await page.evaluate(() =>
      document
        .querySelector("#dm-widget-popup [data-dm-close],#dm-widget-popup .dm-w-chiudi")
        ?.click(),
    );
    await page.waitForTimeout(200);
  }
});
