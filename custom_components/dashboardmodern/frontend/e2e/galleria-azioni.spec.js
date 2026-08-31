/* SPEC TEMPORANEA DI DIAGNOSI — NON COMMITTARE. */
import { test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r1", name: "Cucina", icon: "mdi:stove" },
      { id: "r2", name: "Salone", icon: "mdi:sofa" },
      { id: "r3", name: "Bagno", icon: "mdi:shower" },
      { id: "r4", name: "Camera da Letto", icon: "mdi:bed" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      { id: "c1", name: "Salone", entity: "climate.salone", room: "r2", type: "clima" },
      { id: "c2", name: "Bagno", entity: "input_boolean.termo_bagno", room: "r3", type: "termo" },
      { id: "c3", name: "Camera da Letto", entity: "input_boolean.termo_camera", type: "termo" },
      { id: "c4", name: "Taverna", entity: "input_boolean.termo_taverna", type: "termo" },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

test("azioni rapide: vassoio largo, cancello e popup clima", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1248, height: 900 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(() => {
    document.querySelector("#setup-wizard")?.remove();
    window.localStorage.setItem(
      "cd_quick_actions",
      JSON.stringify([
        { type: "builtin", builtin: "luci", name: "Luci" },
        { type: "builtin", builtin: "clima", name: "Clima" },
        { type: "toggle", name: "Cancello", entity: "switch.cancello", icon: "mdi:gate" },
      ]),
    );
    window.buildQuickActions?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await page.waitForTimeout(600);

  const vassoio = page.locator("#page-home .dm-vassoio");
  await vassoio.screenshot({ path: testInfo.outputPath("azioni-vassoio.png") });

  const misure = await page.evaluate(() => {
    const tasti = [...document.querySelectorAll("#qa-grid .qa-btn")];
    return tasti.map((tasto) => {
      const r = tasto.getBoundingClientRect();
      const icona = tasto.querySelector(".icon");
      return {
        nome: tasto.textContent.trim().slice(0, 16),
        w: Math.round(r.width),
        h: Math.round(r.height),
        iconaHtml: (icona?.innerHTML || "").slice(0, 90),
      };
    });
  });
  console.log(JSON.stringify(misure, null, 1));

  /* Il popup dell'azione rapida Clima. */
  await page.evaluate(() => window.qaRun?.(1));
  await page.waitForTimeout(900);
  await page.screenshot({ path: testInfo.outputPath("azioni-popup-clima.png") });
  /* La scheda CALDO, dove il campo vede le fiamme giganti. */
  await page.evaluate(() => {
    const caldo = [...document.querySelectorAll("button,.d-btn,[role=tab],.qa-cl-tab")].find(
      (n) =>
        /caldo/i.test(n.textContent || "") &&
        n.closest(".modal-wrapper,.dm-section-modal,[class*=modal]"),
    );
    caldo?.click();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath("azioni-popup-clima-caldo.png") });
  const stanze = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".modal-wrapper [class*=room], .modal-wrapper [class*=stanza], .modal-wrapper button",
      ),
    ]
      .slice(0, 12)
      .map((n) => ({
        cls: n.className.toString().slice(0, 40),
        testo: (n.textContent || "").trim().slice(0, 24),
        html: n.innerHTML.slice(0, 80),
      })),
  );
  console.log(JSON.stringify(stanze, null, 1));
});
