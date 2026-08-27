/* L'ordine delle stanze lo decide chi ci abita.
 *
 * L'elenco della scheda Stanze e' l'ordine in cui le stanze sono state
 * aggiunte, e quello stesso ordine si ritrova in ogni tendina che chiede «in
 * che stanza sta questa cosa». L'unico modo di spostarne una era cancellarla e
 * riscriverla, perdendo tutto quello che le era stato attribuito.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STANZE = [
  { id: "room_a", name: "Soggiorno", icon: "🛋️" },
  { id: "room_b", name: "Cucina", icon: "🍳" },
  { id: "room_c", name: "Sala Cinema", icon: "🎬" },
  { id: "room_d", name: "Bagnetto", icon: "🚿" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: STANZE,
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
  visibility: { home: true, stanze: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((stanze) => {
    window.localStorage.setItem("cd_stanze", JSON.stringify(stanze));
  }, STANZE);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="stanze"]').click();
  await expect(page.locator("#ed-body .ed-list > .ed-row")).toHaveCount(4);
}

const nomiSalvati = (page) =>
  page.evaluate(() =>
    (JSON.parse(window.localStorage.getItem("cd_stanze") || "[]") || []).map((r) => r.name),
  );

test("ogni riga porta le sue frecce, e la prima e l'ultima non vanno oltre", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const righe = page.locator("#ed-body .ed-list > .ed-row");
  await expect(righe.first().locator("[data-dm-room-move]")).toHaveCount(2);
  // La prima non puo' salire, l'ultima non puo' scendere.
  await expect(righe.first().locator('[data-dm-room-move="-1"]')).toBeDisabled();
  await expect(righe.last().locator('[data-dm-room-move="1"]')).toBeDisabled();
  await expect(righe.first().locator('[data-dm-room-move="1"]')).toBeEnabled();
});

test("la freccia sposta la stanza, e l'elenco salvato la segue", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  expect(await nomiSalvati(page)).toEqual(["Soggiorno", "Cucina", "Sala Cinema", "Bagnetto"]);

  // Il Bagnetto, aggiunto per ultimo, sale di un posto.
  await page
    .locator('#ed-body .ed-list > .ed-row:nth-child(4) [data-dm-room-move="-1"]')
    .evaluate((nodo) => nodo.click());
  await expect
    .poll(() => nomiSalvati(page))
    .toEqual(["Soggiorno", "Cucina", "Bagnetto", "Sala Cinema"]);

  // E la scheda si e' ridisegnata nell'ordine nuovo, con le frecce al loro posto.
  const righe = page.locator("#ed-body .ed-list > .ed-row");
  await expect(righe.nth(2)).toContainText("Bagnetto");
  await expect(righe.nth(2).locator("[data-dm-room-move]")).toHaveCount(2);
});

test("scendere e' l'inverso di salire", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page
    .locator('#ed-body .ed-list > .ed-row:nth-child(1) [data-dm-room-move="1"]')
    .evaluate((nodo) => nodo.click());
  await expect
    .poll(() => nomiSalvati(page))
    .toEqual(["Cucina", "Soggiorno", "Sala Cinema", "Bagnetto"]);
});
