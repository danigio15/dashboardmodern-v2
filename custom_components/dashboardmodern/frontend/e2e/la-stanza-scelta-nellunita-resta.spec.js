/* «Quando entro in modifica, scambio la stanza in "climatizzazione", premo
 * salva. Sembra che ha salvato ma se esco e rientro nella dashboard mi ritrovo
 * "termostati".»
 *
 * Il salvataggio era giusto: scriveva `room` con l'id preso dalla tendina. Ma
 * un dispositivo porta la stanza in DUE campi — `room_id` e `room` — e chi
 * normalizza le sezioni da' la precedenza a `room_id`, che l'editor non
 * toccava. Un istante dopo il salvataggio il magazzino rispecchiava la sua
 * copia, con la stanza vecchia, sopra quella appena scritta.
 *
 * Qui si guarda quello che conta: cosa c'e' scritto su disco dopo il salva,
 * dopo che tutte le passate hanno girato, e dopo aver ricaricato la pagina.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STANZE = [
  { id: "termostati", name: "Termostati", icon: "mdi:thermostat" },
  { id: "climatizzazione", name: "Climatizzazione", icon: "mdi:snowflake" },
];
/* Le unita' portano la stanza in tutti e due i campi, che e' come le scrive il
 * magazzino appena una stanza gliela si e' data — e come le fa nascere il
 * rilevamento automatico dalle aree di Home Assistant. Senza `room_id` scritto
 * il guasto non si vede: e' proprio il campo che l'editor non toccava. */
const UNITA = [
  {
    name: "A.C. Camera",
    entity: "climate.camera",
    type: "clima",
    room: "Termostati",
    room_id: "termostati",
  },
  {
    name: "A.C. Salone",
    entity: "climate.salone",
    type: "clima",
    room: "Termostati",
    room_id: "termostati",
  },
];
const SEME = {
  schema_version: 4,
  sections: {
    rooms: STANZE,
    climate: UNITA,
    cameras: [],
    appliances: [],
    lights: [],
    covers: [],
    ev: [],
    loads: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const stanzeSuDisco = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_clima_units") || "[]").map((unita) => ({
      nome: unita.name,
      room: unita.room,
      room_id: unita.room_id,
    })),
  );

test("la stanza scelta per un'unita' clima non torna quella di prima", async ({
  page,
}, testInfo) => {
  test.setTimeout(140_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));

  await page.evaluate(() => {
    globalThis.apriConfigEntita?.();
    globalThis.editorSwitch?.("sez9");
  });
  const matita = page
    .locator('#ed-body [data-dm-edit-kind="climate"][data-dm-edit-index="0"]')
    .first();
  await expect(matita).toBeVisible({ timeout: 20_000 });
  await matita.click();

  const tendina = page.locator("#dm-climate-editor-modal select[name='room']");
  await expect(tendina).toBeVisible({ timeout: 10_000 });
  await tendina.selectOption("climatizzazione");
  await page.locator("#dm-climate-editor-modal button[type='submit']").click();

  /* Subito dopo il salva. */
  await expect
    .poll(async () => (await stanzeSuDisco(page))[0]?.room_id, { timeout: 10_000 })
    .toBe("climatizzazione");

  /* E dopo che tutte le passate periodiche hanno girato: e' li' che la copia
   * del magazzino tornava a scrivere la stanza vecchia. */
  await page.waitForTimeout(4000);
  const dopo = await stanzeSuDisco(page);
  expect(dopo[0].room_id).toBe("climatizzazione");
  expect(["climatizzazione", "Climatizzazione"]).toContain(dopo[0].room);
  /* E l'altra unita' non si e' spostata per simpatia. */
  expect(dopo[1].room_id).toBe("termostati");

  /* «Se esco e rientro nella dashboard». */
  await page.reload();
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.waitForTimeout(2500);
  const ricaricato = await stanzeSuDisco(page);
  expect(ricaricato[0].room_id).toBe("climatizzazione");
  expect(ricaricato[1].room_id).toBe("termostati");
});
