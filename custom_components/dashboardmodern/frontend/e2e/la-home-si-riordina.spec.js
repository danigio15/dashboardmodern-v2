/* «Riordinare a piacere la Home.»
 *
 * Le tessere si riordinavano già; le persone no. Qui si fa il gesto vero:
 * dalla scheda Persone si sposta una card e se ne spegne un'altra, e si va a
 * guardare la Home — che è l'unico posto dove quel gesto vuol dire qualcosa.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [], cameras: [], appliances: [], loads: [], lights: [], climate: [], ev: [], covers: [],
    pool: {}, irrigation: { zones: [] }, energy: {}, entityOverrides: {},
  },
  visibility: { home: true },
};

const PERSONE = [
  { id: "person-anna", name: "Anna", entity: "person.anna" },
  { id: "person-bruno", name: "Bruno", entity: "person.bruno" },
  { id: "person-carla", name: "Carla", entity: "person.carla" },
];

const nomiInHome = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#dm-people .dm-people-grid .dm-person-name")].map((n) =>
      (n.textContent || "").trim(),
    ),
  );

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }).catch(() => {}));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((persone) => {
    const raw = eval("_RAW_STATES");
    for (const persona of persone)
      raw[persona.entity] = {
        entity_id: persona.entity,
        state: "home",
        attributes: { friendly_name: persona.name },
      };
    localStorage.setItem("cd_people", JSON.stringify(persone));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, PERSONE);
  await expect.poll(() => nomiInHome(page), { timeout: 20_000 }).toEqual(["Anna", "Bruno", "Carla"]);
}

async function apriLaScheda(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  /* La linguetta si preme: e' il click che accende `.ed-tab.active`, e il
   * modulo guarda quella per sapere se la scheda e' la sua. */
  await page.locator('.ed-tab[data-tab="people"]').first().click();
  await expect(page.locator("#ed-body .dm-people-row").first()).toBeVisible({ timeout: 15_000 });
}

test("una persona si sposta, e la Home la mostra dove è stata messa", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await apriLaScheda(page);
  /* Carla sale di un posto: la freccia della sua riga. */
  await page.locator('#ed-body .dm-people-row[data-person-index="2"] [data-person-up]').click();
  await expect
    .poll(() => page.evaluate(() => (localStorage.getItem("cd_people") || "").indexOf("Carla")))
    .toBeLessThan(await page.evaluate(() => (localStorage.getItem("cd_people") || "").indexOf("Bruno")));

  await page.evaluate(() => window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed")));
  await expect.poll(() => nomiInHome(page), { timeout: 15_000 }).toEqual([
    "Anna",
    "Carla",
    "Bruno",
  ]);
  /* La prima freccia in su è spenta: non porta da nessuna parte. */
  await expect(
    page.locator('#ed-body .dm-people-row[data-person-index="0"] [data-person-up]'),
  ).toBeDisabled();
});

test("una persona spenta esce dalla Home e resta nella scheda", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaScheda(page);
  await page.locator('#ed-body .dm-people-row[data-person-index="1"] [data-person-shown]').click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed")));
  await expect.poll(() => nomiInHome(page), { timeout: 15_000 }).toEqual(["Anna", "Carla"]);
  /* Spenta, non cancellata: la riga c'è ancora, e lo dice. */
  await expect(page.locator("#ed-body .dm-people-row")).toHaveCount(3);
  await expect(
    page.locator('#ed-body .dm-people-row[data-person-index="1"] [data-person-shown]'),
  ).toHaveAttribute("data-on", "false");
  const salvate = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_people") || "[]"));
  expect(salvate).toHaveLength(3);
  expect(salvate[1].nascosta).toBe(true);
});
