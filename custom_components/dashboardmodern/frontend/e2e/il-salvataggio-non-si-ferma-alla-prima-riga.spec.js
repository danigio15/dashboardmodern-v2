/* «Sono riuscito a modificare solo la prima: le altre le modifico, salvo, e
 * tornano come erano.»
 *
 * Il tasto unico in fondo alla scheda preme i salvataggi delle righe: li
 * cercava una volta sola e poi li premeva tutti. Solo che parecchie schede,
 * dopo aver salvato una riga, si ridisegnano — e' cosi' che l'intestazione
 * prende il nome appena scritto — e ridisegnandosi staccano dal documento
 * tutti i bottoni non ancora premuti. Un bottone staccato riceve il clic ma
 * non lo fa arrivare a nessuno: l'ascolto sta sul documento, e quel nodo dal
 * documento e' uscito. Si salvava la prima riga e nessun'altra.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
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

const PERSONE = [
  { id: "person-andrea", name: "Andrea", entity: "person.andrea" },
  { id: "person-puma", name: "Puma", entity: "person.puma" },
  { id: "person-raffy", name: "Raffy", entity: "person.raffy" },
];

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((persone) => {
    window.localStorage.setItem("cd_people", JSON.stringify(persone));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, PERSONE);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="people"]').click();
  await expect(page.locator("#ed-body .dm-people-row")).toHaveCount(3);
}

/* Apre una riga e le riscrive l'entita', come si fa a mano. */
async function riscrivi(page, indice, entita) {
  const riga = page.locator(`#ed-body .dm-people-row[data-person-index="${indice}"]`);
  await riga.locator("[data-person-edit]").evaluate((nodo) => nodo.click());
  /* La casella dell'id sta dietro la matita — la veste che l'editor mette a
     tutti i campi entita' — quindi si scrive dentro come farebbe il selettore
     quando si sceglie un'entita' dal catalogo. */
  const casella = riga.locator('[data-person-field="entity"]');
  await expect(casella).toHaveCount(1);
  await casella.evaluate((nodo, valore) => {
    const scrivi = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    scrivi ? scrivi.call(nodo, valore) : (nodo.value = valore);
    nodo.dispatchEvent(new Event("input", { bubbles: true }));
    nodo.dispatchEvent(new Event("change", { bubbles: true }));
  }, entita);
}

test("il tasto in fondo salva anche le righe dopo la prima", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);

  /* Si riscrive la TERZA, che e' quella che il vecchio giro non raggiungeva
     mai: dopo il salvataggio della prima il suo bottone era gia' staccato. */
  await riscrivi(page, 2, "person.raffaella");
  await page.locator("#ed-body .dm-save-footer-btn").evaluate((nodo) => nodo.click());

  const salvate = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("cd_people") || "[]"),
  );
  expect(salvate).toHaveLength(3);
  expect(salvate[2].entity).toBe("person.raffaella");
  // E le altre restano quelle che erano: si salva, non si riscrive tutto.
  expect(salvate[0].entity).toBe("person.andrea");
  expect(salvate[1].entity).toBe("person.puma");
});

test("due righe cambiate insieme si salvano tutte e due", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await riscrivi(page, 1, "device_tracker.puma_telefono");
  await riscrivi(page, 2, "device_tracker.raffy_telefono");
  await page.locator("#ed-body .dm-save-footer-btn").evaluate((nodo) => nodo.click());
  const salvate = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("cd_people") || "[]"),
  );
  expect(salvate.map((persona) => persona.entity)).toEqual([
    "person.andrea",
    "device_tracker.puma_telefono",
    "device_tracker.raffy_telefono",
  ]);
});
