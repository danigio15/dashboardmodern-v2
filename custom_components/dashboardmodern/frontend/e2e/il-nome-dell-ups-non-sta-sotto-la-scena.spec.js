/* «Il nome dell'UPS viene coperto dall'effetto dello sfondo» (#343).
 *
 * Il nome del gruppo stava dentro il palco, e la scena — che il palco lo copre
 * da bordo a bordo — gli passava sopra. Qui si guarda proprio quello che si
 * vede: si punta il centro del nome e si chiede alla pagina chi c'è lì. Se
 * risponde il nome, il nome si legge; se risponde un pezzo della scena, no.
 *
 * E le due targhette di lato — «Rete elettrica», «Sotto protezione» — devono
 * stare dentro il telaio anche sul telefono, che le tagliava.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ups: true },
};

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const STATI = [
  stato("light.salotto", "on", { friendly_name: "Salotto" }),
  stato("sensor.rack_stato", "OL", { friendly_name: "Stato rack" }),
  stato("sensor.rack_batteria", "96", { friendly_name: "Batteria rack", unit_of_measurement: "%" }),
  stato("sensor.studio_stato", "OB", { friendly_name: "Stato studio" }),
  stato("sensor.studio_batteria", "41", {
    friendly_name: "Batteria studio",
    unit_of_measurement: "%",
  }),
];

const GRUPPI = [
  {
    uid: "ups-1",
    name: "Gruppo di continuità sala rack",
    stato: "sensor.rack_stato",
    batteria: "sensor.rack_batteria",
  },
  {
    uid: "ups-2",
    name: "Studio",
    stato: "sensor.studio_stato",
    batteria: "sensor.studio_batteria",
  },
];

async function avvia(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await page.evaluate(
    ({ haStati, gruppi }) => {
      for (const voce of haStati) _RAW_STATES[voce.entity_id] = structuredClone(voce);
      if (typeof STATES !== "undefined")
        for (const [id, voce] of Object.entries(_RAW_STATES)) STATES[id] = structuredClone(voce);
      localStorage.setItem("cd_ups", JSON.stringify(gruppi));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { haStati: STATI, gruppi: GRUPPI },
  );
  await page.evaluate(() => document.querySelector('.tab[data-tab="ups"]')?.click());
  await expect(page.locator("#page-ups .dm-ups-stage")).toHaveCount(2, { timeout: 20_000 });
}

test("il nome del gruppo si legge: sopra non c'è la scena", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const titoli = page.locator("#page-ups .dm-ups-titolo");
  await expect(titoli).toHaveCount(2);
  await expect(titoli.first()).toHaveText("Gruppo di continuità sala rack");

  const risposta = await page.evaluate(() =>
    [...document.querySelectorAll("#page-ups .dm-ups-titolo")].map((titolo) => {
      const r = titolo.getBoundingClientRect();
      /* Il testo comincia a sinistra: si punta lì, non a metà di una riga che
       * può essere lunga quanto la pagina. */
      const sopra = document.elementFromPoint(r.x + 8, r.y + r.height / 2);
      return {
        dentroIlPalco: Boolean(titolo.closest(".dm-ups-stage")),
        suo: sopra === titolo || titolo.contains(sopra),
        chi: sopra ? sopra.tagName : "",
      };
    }),
  );
  for (const voce of risposta) {
    expect(voce.dentroIlPalco).toBe(false);
    expect(voce.suo, `sopra il nome c'era ${voce.chi}`).toBe(true);
  }
});

test("le targhette dei nodi stanno dentro il telaio, anche sul telefono", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const fuori = await page.evaluate(() => {
    const palco = document.querySelector("#page-ups .dm-ups-stage");
    const sr = palco.getBoundingClientRect();
    return [...palco.querySelectorAll(".dm-ups-nome")]
      .map((nome) => {
        const r = nome.getBoundingClientRect();
        return { testo: nome.textContent.trim(), sx: sr.x - r.x, dx: r.right - sr.right };
      })
      .filter((voce) => voce.sx > 0.5 || voce.dx > 0.5);
  });
  expect(fuori, "queste targhette escono dal palco e vengono tagliate").toEqual([]);
});
