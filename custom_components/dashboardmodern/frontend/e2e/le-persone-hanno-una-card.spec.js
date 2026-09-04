import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Le persone di casa hanno una card in cima alla Home e una scheda in
 * configurazione.
 *
 * Qui si prova il giro intero sul documento vero: `cd_people` scritto, le card
 * compaiono sotto le pillole di stato — ritratto con le iniziali o con
 * l'emoji scelta — e la scheda «Persone» dell'editor elenca le stesse persone
 * e sa aggiungerne una nuova.
 */
const seme = {
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

const persone = [
  { id: "person-giovanni", name: "Giovanni Daniello", entity: "person.giovanni" },
  {
    id: "person-anna",
    name: "Anna",
    entity: "person.anna",
    avatar: { emoji: "👩", color: "#ec4899" },
  },
];

test("le card compaiono in Home e l'editor le elenca", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate((people) => {
    window.localStorage.setItem("cd_people", JSON.stringify(people));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, persone);

  // Le card, sotto le pillole di stato e prima del Quadro Avvisi.
  const cards = page.locator("#dm-people .dm-person-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("GD"); // le iniziali, senza foto ne' emoji
  await expect(cards.nth(1)).toContainText("👩"); // l'emoji scelta come avatar
  await expect(page.locator("#dm-people .dm-people-title")).toHaveText("Persone");

  // Senza Home Assistant collegata la zona non si inventa.
  await expect(cards.first().locator(".dm-person-zone")).toContainText("Sconosciuto");

  /* Il ritratto e chi e' stanno su una riga sola: la faccia a sinistra, il
   * nome e la pastiglia della zona accanto. Non lo si chiede alle classi ma
   * ai rettangoli, che sono quello che si vede: le due caselle si
   * sovrappongono in verticale e il nome sta a destra del ritratto. */
  const ritratto = await cards.first().locator(".dm-person-portrait").boundingBox();
  const nome = await cards.first().locator(".dm-person-name").boundingBox();
  expect(nome.x).toBeGreaterThan(ritratto.x + ritratto.width - 1);
  expect(nome.y).toBeLessThan(ritratto.y + ritratto.height);
  expect(nome.y + nome.height).toBeGreaterThan(ritratto.y);

  /* E la pastiglia della zona si legge per intero: sta sotto il nome, non
   * stretta sulla sua larghezza. */
  await expect(cards.nth(1).locator(".dm-person-zone")).toContainText("Sconosciuto");

  // La scheda dell'editor: le stesse persone, e il tasto che ne aggiunge una.
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="people"]').click();
  const righe = page.locator("#ed-body .dm-people-row");
  await expect(righe).toHaveCount(2);
  await expect(righe.first()).toContainText("Giovanni Daniello");

  await page.locator("#ed-body [data-person-add]").click();
  await expect(page.locator("#ed-body .dm-people-row")).toHaveCount(3);
  const salvate = await page.evaluate(() => JSON.parse(window.localStorage.getItem("cd_people")));
  expect(salvate).toHaveLength(3);
  expect(salvate[2].name).toMatch(/Persona 3/);

  // La riga nuova nasce aperta: si vede subito dove scrivere nome ed entita'.
  await expect(
    page.locator('#ed-body .dm-people-row[data-open="true"] [data-person-field="name"]'),
  ).toBeVisible();
  // Il salvataggio della riga lo preme la barra unica in fondo, come in ogni
  // altra scheda: il bottone per-riga c'e' ma non si mostra.
  await expect(page.locator("#ed-body .dm-save-footer-btn")).toBeVisible();
  await expect(
    page.locator('#ed-body .dm-people-row[data-open="true"] [data-person-save]'),
  ).toBeHidden();
});
