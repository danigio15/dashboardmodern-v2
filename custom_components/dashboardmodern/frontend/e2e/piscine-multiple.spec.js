import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Piu' di una piscina.
 *
 * La configurazione ne teneva una sola, e chi ne ha due non aveva modo di
 * dirlo. La prima resta dov'e' sempre stata — il runtime la legge da li' e non
 * si e' accorto di niente — e le altre si aggiungono accanto: ognuna con i suoi
 * sensori, i suoi comandi e la sua filtrazione.
 */
const stati = {
  "sensor.grande_temp": {
    entity_id: "sensor.grande_temp",
    state: "26",
    attributes: { unit_of_measurement: "°C" },
  },
  "switch.grande_pompa": { entity_id: "switch.grande_pompa", state: "on", attributes: {} },
  "sensor.piccola_temp": {
    entity_id: "sensor.piccola_temp",
    state: "24",
    attributes: { unit_of_measurement: "°C" },
  },
  "switch.piccola_pompa": { entity_id: "switch.piccola_pompa", state: "off", attributes: {} },
  "light.piccola_luce": { entity_id: "light.piccola_luce", state: "off", attributes: {} },
};

function seme(pool) {
  return {
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
      pool,
      irrigation: { zones: [] },
      energy: {},
      entityOverrides: {},
    },
    visibility: { home: true, piscina: true },
  };
}

async function semina(page) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
}

const apriPiscina = (page) =>
  page.evaluate(() => {
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-piscina")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

test.describe("piu' di una piscina", () => {
  test("due vasche, due blocchi, ognuno con i suoi comandi", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(
      page,
      "dashboard.html",
      testInfo,
      seme({
        name: "Grande",
        tempEnt: "sensor.grande_temp",
        pumpEnt: "switch.grande_pompa",
        pools: [
          {
            id: "piscina-2",
            name: "Piccola",
            tempEnt: "sensor.piccola_temp",
            pumpEnt: "switch.piccola_pompa",
            lightEnt: "light.piccola_luce",
          },
        ],
      }),
    );
    await semina(page);
    await apriPiscina(page);

    const blocchi = page.locator("#pool-wrap .dm-pool-block");
    await expect(blocchi).toHaveCount(2);
    // Col nome davanti, perche' con due vasche "Piscina" non basta piu'.
    await expect(blocchi.nth(0).locator(".dm-pool-name")).toHaveText(/Grande/);
    await expect(blocchi.nth(1).locator(".dm-pool-name")).toHaveText(/Piccola/);

    // Ogni vasca legge la sua temperatura, non quella dell'altra.
    await expect
      .poll(() => blocchi.nth(0).locator("[data-dm-pool-temp]").innerText())
      .toContain("26");
    await expect
      .poll(() => blocchi.nth(1).locator("[data-dm-pool-temp]").innerText())
      .toContain("24");

    // E il suo stato: la grande sta filtrando, la piccola no.
    await expect.poll(() => blocchi.nth(0).getAttribute("data-dm-pool-filtering")).toBe("true");
    await expect.poll(() => blocchi.nth(1).getAttribute("data-dm-pool-filtering")).toBe("false");

    // La luce e' solo della seconda vasca: la prima non ha quel comando.
    await expect(blocchi.nth(0).locator('[data-dm-pool-tile="light"]')).toHaveCount(0);
    await expect(blocchi.nth(1).locator('[data-dm-pool-tile="light"]')).toHaveCount(1);

    // Il comando della seconda parla della sua entita', non di quella della prima.
    const chiamate = [];
    await page.exposeFunction("registraChiamata", (entity, service) =>
      chiamate.push(`${service} ${entity}`),
    );
    await page.evaluate(() => {
      window.cdPoolSvc = (entity, service) => window.registraChiamata(entity, service);
    });
    await blocchi.nth(1).locator('[data-dm-pool-tile="pump"]').click();
    await expect.poll(() => chiamate).toEqual(["toggle switch.piccola_pompa"]);
  });

  test("una piscina sola resta esattamente com'era", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(
      page,
      "dashboard.html",
      testInfo,
      seme({ tempEnt: "sensor.grande_temp", pumpEnt: "switch.grande_pompa" }),
    );
    await semina(page);
    await apriPiscina(page);

    const blocchi = page.locator("#pool-wrap .dm-pool-block");
    await expect(blocchi).toHaveCount(1);
    // Nessuna intestazione col nome: sarebbe un titolo che ripete la sezione.
    await expect(blocchi.locator(".dm-pool-name")).toHaveCount(0);
    await expect(page.locator("#pool-wrap [data-dm-pool-stage]")).toHaveCount(1);
  });

  test("dalla configurazione si aggiunge una vasca, e compare", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(
      page,
      "dashboard.html",
      testInfo,
      seme({ tempEnt: "sensor.grande_temp", pumpEnt: "switch.grande_pompa" }),
    );
    await semina(page);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("pool");
    });

    await expect(page.locator("#ed-body")).toHaveCount(1);
    const pannello = page.locator("[data-dm-pool-editor]");
    await expect(pannello).toHaveCount(1);
    await expect(pannello.locator(".ed-empty")).toBeVisible();
    await pannello.locator("[data-pool-add]").click();

    const riga = pannello.locator("[data-pool-index]");
    await expect(riga).toHaveCount(1);
    /* I campi entita' li veste il decoratore comune — pastiglia, lente e
     * matita — come in ogni altra scheda: qui si scrive nel campo sotto, che e'
     * quello che il salvataggio legge. */
    await page.evaluate(() => {
      const scrivi = (campo, valore) => {
        const input = document.querySelector(`[data-pool-index] [data-pool-field="${campo}"]`);
        input.value = valore;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      scrivi("name", "Piccola");
      scrivi("pumpEnt", "switch.piccola_pompa");
    });
    /* Il salvataggio della scheda e' uno solo, in fondo: e' il piede che
     * preme i salvataggi dei pezzi che la compongono, questo compreso. */
    await page.locator("#ed-body .dm-save-footer-btn").click();

    // La prima vasca resta dov'e': il runtime la legge da li'.
    await expect
      .poll(() => page.evaluate(() => window.getPool().tempEnt))
      .toBe("sensor.grande_temp");
    await expect
      .poll(() => page.evaluate(() => window.getPool().pools?.map((p) => p.name)))
      .toEqual(["Piccola"]);

    await page.evaluate(() => window.chiudiConfigEntita?.() ?? window.edClose?.());
    await apriPiscina(page);
    await semina(page);
    await expect(page.locator("#pool-wrap .dm-pool-block")).toHaveCount(2);
  });
});
