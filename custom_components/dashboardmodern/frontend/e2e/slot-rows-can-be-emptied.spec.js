/* Il cestino sulla riga, in tutte le sezioni.
 *
 * Le righe che chiedono un'entita' esistono in due forme. Quelle in piedi da
 * sole hanno accanto alla scelta due comandi scritti, "Modifica" e "Elimina".
 * Quelle delle sezioni — Home, Energia, Solare termico, MiniPC, Azioni —
 * avevano solo la pastiglia per scegliere: un'entita' sbagliata non si poteva
 * togliere se non riaprendo il campo a mano e cancellandolo a memoria.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEED = {
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
  visibility: { home: true, energy: true, ev: true, boiler: true, server: true },
};

async function openEditor(page, testInfo) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEED);
  await page.waitForFunction(
    () => Boolean(document.getElementById("dm-editor-slots-style")),
    null,
    {
      timeout: 15000,
    },
  );
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    raw["sensor.p1"] = {
      entity_id: "sensor.p1",
      state: "500",
      attributes: { friendly_name: "Potenza casa", unit_of_measurement: "W" },
    };
  });
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await page.waitForTimeout(1500);
}

async function openTab(page, tab) {
  await page.evaluate((name) => {
    document.querySelector(`#editor-modal .ed-tab[data-tab="${name}"]`)?.click();
  }, tab);
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    for (const node of document.querySelectorAll("#ed-body details")) node.open = true;
  });
  await page.waitForTimeout(400);
}

test("ogni riga di sezione porta il proprio cestino", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await openEditor(page, testInfo);
  const report = [];
  for (const tab of ["sez0", "sez1", "sez3", "sez6", "sez8", "sez9"]) {
    await openTab(page, tab);
    report.push(
      await page.evaluate((name) => {
        const slots = [...document.querySelectorAll("#ed-body .dm-slot")];
        return {
          tab: name,
          slots: slots.length,
          senzaCestino: slots.filter((slot) => !slot.querySelector(":scope > .dm-slot-clear"))
            .length,
        };
      }, tab),
    );
  }
  // Almeno una scheda deve avere righe, altrimenti la prova non prova niente.
  expect(report.reduce((total, entry) => total + entry.slots, 0)).toBeGreaterThan(0);
  for (const entry of report) {
    expect(entry.senzaCestino, `${entry.tab} ha righe senza cestino`).toBe(0);
  }
});

test("il cestino compare quando c'e' qualcosa da togliere, e lo toglie", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await openEditor(page, testInfo);
  await openTab(page, "sez3");
  const round = await page.evaluate(async () => {
    const slot = document.querySelector("#ed-body .dm-slot");
    const input = slot.querySelector(".ed-slot-in[data-ref]");
    const clear = slot.querySelector(":scope > .dm-slot-clear");
    const stored = () => JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}");
    const ref = input.dataset.ref;
    const empty = clear.hidden;

    input.value = "sensor.p1";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    const filled = { hidden: clear.hidden, stored: stored()[ref] };

    clear.click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      empty,
      filled,
      cleared: { hidden: clear.hidden, value: input.value, stored: stored()[ref] },
    };
  });
  // Non si toglie quello che non c'e'.
  expect(round.empty).toBe(true);
  expect(round.filled).toEqual({ hidden: false, stored: "sensor.p1" });
  // E quando si toglie, si toglie davvero: il campo si svuota e l'associazione
  // sparisce da dove il runtime la legge.
  expect(round.cleared).toEqual({ hidden: true, value: "", stored: undefined });
});
