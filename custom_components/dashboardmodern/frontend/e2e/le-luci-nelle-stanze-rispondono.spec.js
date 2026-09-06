/* Nelle Stanze la luce cambia stato davvero.
 *
 * «Nella sezione Stanze se accendo una luce non cambia stato, non c'e' il
 * refresh stato quindi il problema continua.» Era vero, e il comando partiva
 * benissimo: Home Assistant accendeva la luce e la card restava «SPENTA».
 *
 * La card e' quella della pagina Luci — le Stanze se la prendono da li',
 * perche' due card per la stessa luce vorrebbe dire mantenerne due — ma il
 * riallineamento era rimasto chiuso dentro la pagina Luci, e per giunta si
 * fermava subito quando quella pagina non era quella aperta. Il giro veloce
 * delle Stanze riscriveva le letture e i testi di stato, e le card della luce
 * non le guardava; il giro lungo parte solo quando cambia la struttura, che
 * accendendo una luce non cambia.
 *
 * Qui si pretendono quattro momenti, e sono quattro difetti diversi se
 * mancano: com'e' prima, che si muova al tocco senza aspettare la risposta,
 * che la conferma tenga, e che uno spegnimento arrivato da fuori la corregga.
 * L'ultimo e' quello che tiene onesto l'ottimismo: una card che si muove al
 * tocco e poi non torna indietro quando il comando fallisce mente, ed e'
 * peggio di una che non si muove.
 */
import { test, expect } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", entity: "light.salone", room: "r1" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: { rooms: true, lights: true },
};
test("la luce cambia stato quando Home Assistant risponde", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const g = eval("_RAW_STATES");
    g["light.salone"] = {
      entity_id: "light.salone",
      state: "off",
      attributes: { friendly_name: "Salone" },
    };
    window.applyStates?.();
    window.render?.();
  });
  /* Si va sulle Stanze come ci si va davvero, con un tocco sulla linguetta.
   *
   * Prima bastava chiedere a `window.showPage`, che pero' non esiste: la
   * pagina restava chiusa e le sue card si disegnavano lo stesso, perche' la
   * sezione ridisegnava a ogni cambio di stato anche le pagine che nessuno
   * aveva davanti. Adesso si dipinge per chi guarda, quindi la pagina va
   * aperta — che e' anche l'unico modo in cui una persona vede quella card. */
  await page.locator('.tab[data-tab="stanze"]').first().click();
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);
  await page.waitForTimeout(700);

  const carta = '#page-stanze [data-dm-lucip="light.salone"]';
  await page.waitForSelector(carta, { timeout: 15000, state: "attached" });
  const leggi = () =>
    page.evaluate((c) => {
      const n = document.querySelector(c);
      return n
        ? {
            classe: n.className,
            premuto: n.querySelector("[data-dm-lucip-toggle]")?.getAttribute("aria-pressed"),
            stato: n.querySelector("[data-dm-lucip-state]")?.textContent?.trim(),
          }
        : null;
    }, carta);
  console.log("prima:", JSON.stringify(await leggi()));

  await page.evaluate((c) => document.querySelector(c + " [data-dm-lucip-toggle]")?.click(), carta);
  await page.waitForTimeout(200);
  console.log("dopo il tocco (ottimismo):", JSON.stringify(await leggi()));

  // Home Assistant conferma: la luce e' accesa
  await page.evaluate(() => {
    const g = eval("_RAW_STATES");
    g["light.salone"] = {
      entity_id: "light.salone",
      state: "on",
      attributes: { friendly_name: "Salone" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    window.applyStates?.();
    window.render?.();
  });
  await page.waitForTimeout(600);
  console.log("dopo la conferma:", JSON.stringify(await leggi()));

  // ora il caso che rompe: lo stato torna a spento (comando fallito, o spenta da altrove)
  await page.evaluate(() => {
    const g = eval("_RAW_STATES");
    g["light.salone"] = {
      entity_id: "light.salone",
      state: "off",
      attributes: { friendly_name: "Salone" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    window.applyStates?.();
    window.render?.();
  });
  await page.waitForTimeout(600);
  const finale = await leggi();
  console.log("dopo lo spegnimento da fuori:", JSON.stringify(finale));
  expect(finale.premuto, "l'interruttore deve seguire lo stato vero").toBe("false");
});
