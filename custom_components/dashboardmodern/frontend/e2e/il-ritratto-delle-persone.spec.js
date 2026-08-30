/* Il ritratto delle persone, dalla scelta allo schermo.
 *
 * Il modello si prova a tavolino — dice quali immagini servono e quali
 * ritocchi restano — ma la catena intera no: i file che arrivano davvero, la
 * testa incollata sul busto, le tinte e gli accessori dipinti sulla tela, la
 * card in Home, e il costruttore in configurazione con le sue file nuove —
 * barba, colori, occhi, occhiali, collana, colore del vestito. Qui si prova
 * quella, sul documento vero.
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
  /* La faccia salvata prima della v7: `capelli: "barba"` deve tradursi in
   * lisci + barba corta, senza che Giovanni cambi faccia. */
  {
    id: "p1",
    name: "Giovanni",
    entity: "person.giovanni",
    avatar: {
      color: "#3a6fb0",
      face: { persona: "uomo", capelli: "barba", carnagione: "media", vestito: "ufficio" },
    },
  },
  /* Una faccia v7 piena: ricci tinti, occhiali, collana, busto ricolorato. */
  {
    id: "p2",
    name: "Giulia",
    entity: "person.giulia",
    avatar: {
      color: "#c94a3e",
      face: {
        persona: "donna",
        capelli: "ricci",
        coloreCapelli: "biondo",
        occhi: "verde",
        carnagione: "chiara",
        vestito: "casual",
        coloreVestito: "verde",
        occhiali: "tondi",
        collana: "catenina",
      },
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

test("i ritratti arrivano in Home, e il costruttore ha le file della v7", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate((elenco) => {
    window.localStorage.setItem("cd_people", JSON.stringify(elenco));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, persone);

  /* Tre tele: anche le facce vecchie ne hanno una, tradotte. */
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

  /* Il costruttore: le file della v7, nell'ordine del design. Giovanni ha la
   * barba (tradotta in corta) e l'ufficio (ricolorabile), quindi si vedono
   * anche «Colore barba» e «Colore vestito». */
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="people"]').click();
  await page.locator("#ed-body [data-person-edit]").first().click();
  const riga = page.locator('#ed-body .dm-people-row[data-open="true"]');
  await expect(
    riga.locator(".dm-face-row .dm-face-row-lbl"),
    "le undici file del ritratto, nell'ordine approvato",
  ).toHaveText(
    [
      /Persona7/,
      /Capelli3/,
      /Barba4/,
      /Colore capelli8/,
      /Colore barba5/,
      /Colore occhi5/,
      /Occhiali4/,
      /Collana3/,
      /Carnagione5/,
      /Vestito35/,
      /Colore vestito6/,
    ],
    { timeout: 20000 },
  );

  /* Il colore degli occhi e' una fila di cerchi, non di ritratti. */
  await expect(riga.locator(".dm-face-dot")).toHaveCount(5);

  /* Ottanta pastiglie composte — 7+3+4+8+5+4+3+5+35+6 — e ognuna e' un
   * ritratto vero, quindi si aspettano. */
  const pastiglie = riga.locator(".dm-face-opt-img img");
  await expect(pastiglie).toHaveCount(80, { timeout: 120000 });

  /* Le file si seguono: senza barba il suo colore sparisce... */
  await riga.locator('[data-face-k="barba"][data-face-v="nessuna"]').click();
  await expect(riga.locator(".dm-face-row", { hasText: "Colore barba" })).toHaveCount(0, {
    timeout: 20000,
  });
  await expect(riga.locator(".dm-face-row")).toHaveCount(10);

  /* ...e il colore del vestito vale solo per i busti ricolorabili: il cuoco
   * lo toglie, il casual lo riporta. */
  await riga.locator('[data-face-k="vestito"][data-face-v="cuoco"]').click();
  await expect(riga.locator('[data-face-k="vestito"][data-face-v="cuoco"]')).toHaveClass(/on/);
  await expect(riga.locator(".dm-face-row")).toHaveCount(9);
  await riga.locator('[data-face-k="vestito"][data-face-v="casual"]').click();
  await expect(riga.locator('[data-face-k="coloreVestito"][data-face-v="verde"]')).toBeVisible();
  await riga.locator('[data-face-k="coloreVestito"][data-face-v="verde"]').click();
  await expect(riga.locator('[data-face-k="coloreVestito"][data-face-v="verde"]')).toHaveClass(
    /on/,
  );

  /* E un accessorio si sceglie come tutto il resto. */
  await riga.locator('[data-face-k="occhiali"][data-face-v="tondi"]').click();
  await expect(riga.locator('[data-face-k="occhiali"][data-face-v="tondi"]')).toHaveClass(/on/);
});
