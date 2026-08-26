/* Il ritratto in tre dimensioni arriva davvero fino allo schermo.
 *
 * Il motore si prova a tavolino — e' aritmetica — ma la catena intera no: la
 * faccia scelta, i pixel, la tela, l'immagine al posto del disegno, e la
 * seconda passata che non ridisegna niente perche' la fotografia e' gia' in
 * memoria. Qui si prova quella, sul documento vero.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
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

const facce = [
  {
    id: "p1",
    name: "Marco",
    entity: "person.marco",
    avatar: {
      color: "#2f6fb5",
      face: {
        render: "3d",
        skin: "f2",
        shape: "squadrato",
        hair: "corto",
        hairColor: "moro",
        beard: "incolta",
        eyeColor: "nocciola",
        brows: "folte",
        nose: "pronunciato",
        build: "robusta",
        outfitColor: "blu",
        age: "adulto",
      },
    },
  },
  {
    id: "p2",
    name: "Giulia",
    entity: "person.giulia",
    avatar: {
      color: "#c04a3f",
      face: {
        render: "3d",
        skin: "f1",
        shape: "cuore",
        hair: "lungo",
        hairColor: "rame",
        eyes: "grandi",
        eyeColor: "verde",
        brows: "arcuate",
        nose: "piccolo",
        lips: "corallo",
        build: "magra",
        outfitColor: "rosso",
      },
    },
  },
  {
    id: "p3",
    name: "Yara",
    entity: "person.yara",
    avatar: {
      color: "#7c5cc4",
      face: {
        render: "3d",
        skin: "f6",
        shape: "tondo",
        hair: "afro",
        hairColor: "nero",
        eyes: "grandi",
        eyeColor: "ghiaccio",
        lips: "rosa",
        outfitColor: "viola",
      },
    },
  },
];
test("ritratti 3D in Home e nell'editor", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate((p) => {
    window.localStorage.setItem("cd_people", JSON.stringify(p));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, facce);
  const img = page.locator("#dm-people .dm-person-avatar img.dm-face-3d");
  await expect(img).toHaveCount(3, { timeout: 8000 });
  const t = await page.evaluate(() => {
    const a = performance.now();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    return performance.now() - a;
  });
  /* La seconda passata deve costare quanto niente: se ridisegnasse, una
   * plancia con quattro persone si fermerebbe a ogni cambio di stato. */
  expect(t).toBeLessThan(60);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="people"]').click();
  await page.locator("#ed-body [data-person-edit]").first().click();
  await expect(
    page.locator("#ed-body .dm-people-row[data-open='true'] .dm-face-preview img"),
  ).toBeVisible({ timeout: 8000 });
});
