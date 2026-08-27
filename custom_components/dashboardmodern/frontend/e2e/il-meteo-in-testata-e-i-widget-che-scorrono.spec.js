/* Le tre cose chieste a fine 1.3.1, provate sul documento vero.
 *
 * Sono tutte e tre questioni di spazio: il meteo che si prendeva una card
 * intera per dire quattro numeri, la finestra di una tessera che tagliava la
 * lista invece di lasciarla scorrere, e la barra ferma che con un rettangolo
 * invisibile si prendeva i clic della seconda fila di tessere.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Tanti termostati quanti ne ha una casa vera con le valvole: e' il numero che
 * fa uscire la lista dalla finestra. */
const CLIMI = Array.from({ length: 16 }, (_, indice) => ({
  id: `cl${indice}`,
  name: `Termostato ${indice + 1}`,
  entity: `climate.t${indice}`,
}));

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { id: "l1", name: "Salone", entity: "light.salone" },
      { id: "l2", name: "Cucina", entity: "light.cucina" },
    ],
    climate: CLIMI,
    ev: [],
    covers: [{ id: "c1", name: "Tapparella salone", entity: "cover.uno" }],
    pool: { entity: "switch.pompa" },
    irrigation: { zones: [{ id: "z1", name: "Prato", entity: "switch.prato" }] },
    energy: { grid: { power: "sensor.rete_w" } },
    entityOverrides: { "dm.home_meteo": "weather.casa" },
  },
  visibility: {
    home: true,
    climate: true,
    lights: true,
    covers: true,
    pool: true,
    irrigation: true,
    energy: true,
  },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  // La barra ferma e' una scelta salvata: si mette prima che la plancia parta.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("cd_navbar_mode", "fixed");
    } catch (_errore) {}
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((climi) => {
    const grezzi = eval("_RAW_STATES");
    climi.forEach((unita, indice) => {
      grezzi[unita.entity] = {
        entity_id: unita.entity,
        state: indice % 3 ? "heat" : "off",
        attributes: {
          friendly_name: unita.name,
          current_temperature: 19 + (indice % 7),
          temperature: 21,
        },
      };
    });
    grezzi["light.salone"] = { entity_id: "light.salone", state: "on", attributes: {} };
    grezzi["light.cucina"] = { entity_id: "light.cucina", state: "off", attributes: {} };
    grezzi["cover.uno"] = { entity_id: "cover.uno", state: "open", attributes: {} };
    grezzi["switch.pompa"] = { entity_id: "switch.pompa", state: "on", attributes: {} };
    grezzi["switch.prato"] = { entity_id: "switch.prato", state: "off", attributes: {} };
    grezzi["sensor.rete_w"] = {
      entity_id: "sensor.rete_w",
      state: "817",
      attributes: { unit_of_measurement: "W", device_class: "power" },
    };
    grezzi["weather.casa"] = {
      entity_id: "weather.casa",
      state: "partlycloudy",
      attributes: { friendly_name: "Meteo", temperature: 35.8, humidity: 38, wind_speed: 15.1 },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CLIMI);
  await page.waitForTimeout(2000);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

test("il meteo sta nell'intestazione, accanto al nome della casa", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const meteo = page.locator("header:not(.dm-page-mast) .weather-widget");
  await expect(meteo).toBeVisible();
  // E dice ancora tutto quello che diceva: e' lo stesso blocco, spostato.
  await expect(page.locator("#w-temp")).toHaveText("35.8°C");
  await expect(page.locator("#w-hum")).toHaveText("38%");
  // Umidita' e vento vicini: prima erano incolonnati all'estremita' opposta.
  const distanza = await page.evaluate(() => {
    const [umido, vento] = [...document.querySelectorAll("header .w-detail")].filter(
      (nodo) => nodo.id !== "w-feel-row",
    );
    if (!umido || !vento) return null;
    const a = umido.getBoundingClientRect();
    const b = vento.getBoundingClientRect();
    return Math.round(Math.max(b.top - a.bottom, b.left - a.right));
  });
  expect(distanza).not.toBeNull();
  expect(distanza).toBeLessThanOrEqual(12);
});

test("la finestra di una tessera lunga si scorre invece di tagliare", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page
    .locator('#dm-widgets .dm-tile[data-dm-widget="clima"]')
    .evaluate((nodo) => nodo.click());
  const corpo = page.locator("#dm-widget-popup .dm-w-body");
  await expect(corpo).toBeVisible();
  const lettura = await corpo.evaluate((nodo) => {
    nodo.scrollTop = 99_999;
    return { alto: nodo.scrollHeight, visto: nodo.clientHeight, sceso: nodo.scrollTop };
  });
  expect(lettura.alto).toBeGreaterThan(lettura.visto);
  expect(lettura.sceso).toBeGreaterThan(0);
  // La finestra resta dentro lo schermo: e' il corpo che si accorcia.
  const dentro = await page
    .locator("#dm-widget-popup .dm-widget-detail")
    .evaluate((nodo) => nodo.getBoundingClientRect().bottom <= innerHeight + 1);
  expect(dentro).toBe(true);
});

test("a barra ferma niente si prende i clic sopra la barra", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const sensore = await page.evaluate(() => {
    const barra = document.querySelector("nav.tabs.bottom-nav-bar");
    return {
      ferma: document.body.classList.contains("cd-nav-fixed"),
      sensore: barra ? getComputedStyle(barra, "::before").display : null,
    };
  });
  expect(sensore.ferma).toBe(true);
  expect(sensore.sensore).toBe("none");
  // E ogni tessera risponde al clic nel punto in cui la si vede.
  const coperte = await page.evaluate(() => {
    return [...document.querySelectorAll("#dm-widgets .dm-tile")]
      .map((tessera) => {
        const riquadro = tessera.getBoundingClientRect();
        if (riquadro.bottom > innerHeight) return null;
        const sopra = document.elementFromPoint(
          riquadro.left + riquadro.width / 2,
          riquadro.bottom - 4,
        );
        return sopra && !tessera.contains(sopra) ? tessera.dataset.dmWidget : null;
      })
      .filter(Boolean);
  });
  expect(coperte).toEqual([]);
});

test("la fascia delle tessere si chiama Widget", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await expect(page.locator("#dm-widgets .dm-widgets-title")).toHaveText("Widget");
});
