import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { PRIMARY } from "./helpers/variants.js";

const base = {
  rooms: [],
  cameras: [],
  appliances: [],
  loads: [],
  lights: [],
  ev: [],
  covers: [],
  pool: {},
  irrigation: { zones: [] },
  energy: {},
  entityOverrides: {},
};

async function openTab(page, label) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.evaluate((text) => {
    const tab = [...document.querySelectorAll("#editor-modal .ed-tab")].find((node) =>
      new RegExp(text, "i").test(node.textContent),
    );
    tab?.click();
  }, label);
  await expect(page.locator("#editor-modal .ed-tab.active")).toHaveCount(1);
}

function rowNames(page) {
  return page
    .locator("#ed-body .ed-row")
    .evaluateAll((rows) =>
      rows.map((row) => row.querySelector(".ed-row-new")?.textContent.trim().split(" (")[0]),
    );
}

/* Il cestino lasciava l'elenco sfasato.
 *
 * L'editor aveva una sola scheda Sezioni; adesso ce n'e' una per sezione e il
 * nome "sezioni" non corrisponde piu' a niente. Il runtime lo chiama ancora
 * dopo ogni eliminazione: l'elenco non veniva ridisegnato, il ridisegno
 * parziale che segue lasciava l'ultima riga duplicata, e la scheda in alto
 * perdeva l'evidenziazione. */
for (const variant of PRIMARY) {
  test(`${variant}: deleting a climate unit redraws the list where you are looking`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await bootNamespacedDashboard(page, variant, testInfo, {
      schema_version: 4,
      sections: {
        ...base,
        climate: [
          { entity: "climate.salone", name: "Salone", type: "clima" },
          { entity: "climate.cucina", name: "Cucina", type: "clima" },
          { entity: "climate.bagno", name: "Bagno", type: "termosifone" },
        ],
      },
      visibility: { clima: true },
    });

    await openTab(page, "clima");
    await expect.poll(() => rowNames(page)).toEqual(["Salone", "Cucina", "Bagno"]);
    const tab = await page.locator("#editor-modal .ed-tab.active").getAttribute("data-tab");

    await page.locator("#ed-body .ed-row .ed-del").filter({ hasText: "🗑" }).first().click();

    // The row is gone, the others keep their order, nothing is duplicated.
    await expect.poll(() => rowNames(page)).toEqual(["Cucina", "Bagno"]);
    // And we are still on the tab we were on.
    await expect(page.locator("#editor-modal .ed-tab.active")).toHaveAttribute("data-tab", tab);

    const stored = await page.evaluate(() =>
      (window.DashboardModernModules?.store?.getSection?.("climate") || []).map((unit) => unit.name),
    );
    expect(stored).toEqual(["Cucina", "Bagno"]);
  });
}
