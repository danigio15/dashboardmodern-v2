/* Nella scheda Allerte, i gesti dell'aria salvano subito e ridisegnano tutto.
 *
 * Le sei fonti — terremoti, meteo, fulmini, pollini, comfort, voli — si
 * compilano insieme e si salvano col tasto. I gesti dell'aria no: mettere una
 * misura in copertina, escludere un sensore, aggiungerne uno sono decisioni
 * compiute, e aspettare un tasto vorrebbe dire perderle chiudendo la scheda.
 *
 * Il guaio era che salvavano rileggendo il disco e poi ridisegnavano la scheda
 * da capo: chi aveva appena scritto il sensore dei fulmini e poi metteva una
 * misura in copertina se lo ritrovava cancellato — sul disco non c'era ancora.
 */
import { expect, test } from "@playwright/test";
import { fillEntityFieldByHand } from "./helpers/entity-field.js";
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

test("una casella appena scritta sopravvive a un gesto dell'aria", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show"))
      globalThis.apriConfigEntita?.();
  });
  await page.locator('.ed-tab[data-tab="allerte"]').first().click();

  /* Le caselle delle entità si scrivono a mano dalla matita, come fa una
   * persona: il campo grezzo sta dietro di lei. */
  const fulmini = "#ed-body #dm-allerte-fulmini-entity";
  await page.locator(fulmini).waitFor({ state: "attached", timeout: 20_000 });
  await fillEntityFieldByHand(page, fulmini, "sensor.blitzortung_fulmini");

  /* Il gesto dell'aria: si mette una misura in copertina. Salva da solo e
   * ridisegna la scheda — ed è lì che la casella spariva. */
  await fillEntityFieldByHand(page, "#ed-body #dm-aria-principale", "sensor.centralina_indice");
  await page.locator("#ed-body [data-dm-aria-principale]").first().click();

  await expect(page.locator(fulmini)).toHaveValue("sensor.blitzortung_fulmini");

  /* E non è rimasta solo sullo schermo: è finita nella configurazione, che è
   * quello che il ridisegno rilegge. */
  const salvato = await page.evaluate(() =>
    JSON.parse(globalThis.localStorage.getItem("cd_allerte") || "{}"),
  );
  expect(salvato.fulmini?.entity).toBe("sensor.blitzortung_fulmini");
  expect(salvato.aria?.principale).toBe("sensor.centralina_indice");
});
