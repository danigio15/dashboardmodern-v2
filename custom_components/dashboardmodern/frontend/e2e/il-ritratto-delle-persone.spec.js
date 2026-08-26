/* Il ritratto delle persone, dalla scelta allo schermo.
 *
 * Il modello si prova a tavolino — dice quali due immagini servono — ma la
 * catena intera no: i file che arrivano davvero, la testa incollata sul busto,
 * la tela nella card, e il costruttore in configurazione che mostra la faccia
 * vera dentro ogni pastiglia. Qui si prova quella, sul documento vero.
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

const persone = [
  {
    id: "p1",
    name: "Giovanni",
    entity: "person.giovanni",
    avatar: {
      color: "#3a6fb0",
      face: { persona: "uomo", capelli: "barba", carnagione: "media", vestito: "ufficio" },
    },
  },
  {
    id: "p2",
    name: "Giulia",
    entity: "person.giulia",
    avatar: {
      color: "#c94a3e",
      face: { persona: "donna", capelli: "rossi", carnagione: "chiara", vestito: "medico" },
    },
  },
  /* La faccia disegnata a mano della 1.2: non deve sparire, deve tradursi. */
  {
    id: "p3",
    name: "Nonno",
    entity: "person.nonno",
    avatar: {
      color: "#c9ab86",
      face: {
        skin: "f3",
        hair: "calvo",
        hairColor: "bianco",
        beard: "piena",
        outfit: "camicia",
        build: "normale",
      },
    },
  },
];

test("i ritratti arrivano in Home, e il costruttore mostra la faccia vera", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate((elenco) => {
    window.localStorage.setItem("cd_people", JSON.stringify(elenco));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, persone);

  /* Tre tele: anche la faccia vecchia ne ha una, tradotta. */
  await expect(page.locator("#dm-people canvas.dm-avatar-3d")).toHaveCount(3, { timeout: 20000 });

  /* La testa incollata sul busto e' composta davvero: la tela non e' vuota. */
  const dipinta = await page.evaluate(() => {
    const tela = document.querySelector("#dm-people canvas.dm-avatar-3d");
    const px = tela.getContext("2d").getImageData(0, 0, tela.width, tela.height).data;
    let opachi = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 30) opachi += 1;
    return opachi / (tela.width * tela.height);
  });
  expect(dipinta).toBeGreaterThan(0.15);

  /* Il costruttore: ogni pastiglia e' la faccia con quel pezzo addosso. */
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="people"]').click();
  await page.locator("#ed-body [data-person-edit]").first().click();
  /* Sei persone, sei capelli, cinque carnagioni, sedici vestiti: trentatre
   * pastiglie, e ognuna e' un ritratto composto — quindi si aspettano. */
  const pastiglie = page.locator("#ed-body .dm-people-row[data-open='true'] .dm-face-opt-img img");
  await expect(pastiglie).toHaveCount(33, { timeout: 30000 });

  /* E si sceglie: cambiando vestito il ritratto salvato cambia con lui. */
  const riga = page.locator('#ed-body .dm-people-row[data-open="true"]');
  await riga.locator('[data-face-k="vestito"][data-face-v="cuoco"]').click();
  await expect(riga.locator('[data-face-k="vestito"][data-face-v="cuoco"]')).toHaveClass(/on/);
});
