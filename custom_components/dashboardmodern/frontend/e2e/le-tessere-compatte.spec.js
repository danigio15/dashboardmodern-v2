/* La modalita' compatta dei widget (#224) e la tessera «In evidenza» (#236).
 *
 * La preferenza `cd_widgets.compatto` — mai, auto, sempre — arriva sull'ospite
 * come attributo `data-dm-compatto`, e il foglio fa il resto: in «auto» le
 * pillole da quarantotto pixel escono solo sotto i 520 pixel di larghezza, in
 * «sempre» ovunque, con «mai» l'attributo non c'e' proprio. La prova gira su
 * tutti i progetti: sul telefono controlla le pillole, sullo schermo largo
 * controlla che «auto» NON stringa — che e' l'altra meta' della promessa.
 *
 * E gia' che la Home e' in piedi: due entita' in `cd_evidenza` fanno comparire
 * la tessera «In evidenza» col loro numero.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Salone", icon: "mdi:sofa" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { id: "l1", name: "Lampadario Salone", entity: "light.salone" },
      { id: "l2", name: "Faretti Cucina", entity: "light.cucina" },
    ],
    climate: [{ id: "cl1", name: "Termosifone Salone", entity: "climate.salone" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, climate: true, lights: true },
};

const VALORI = {
  "light.salone": "on",
  "light.cucina": "off",
  "sensor.quadro_temp": "34.2",
  "sensor.rack_temp": "41.8",
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((valori) => {
    const grezzi = eval("_RAW_STATES");
    for (const [entity, state] of Object.entries(valori))
      grezzi[entity] = {
        entity_id: entity,
        state,
        attributes: {
          friendly_name: entity.split(".")[1].replaceAll("_", " "),
          ...(entity.startsWith("climate.")
            ? { current_temperature: 20.5, temperature: 21.5 }
            : {}),
          ...(entity.startsWith("sensor.") ? { unit_of_measurement: "°C" } : {}),
        },
      };
    grezzi["climate.salone"] = {
      entity_id: "climate.salone",
      state: "heat",
      attributes: {
        friendly_name: "Termosifone Salone",
        current_temperature: 20.5,
        temperature: 21.5,
      },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, VALORI);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator("#dm-widgets .dm-tile").first()).toBeVisible();
}

/* Scrive la modalita' e sveglia il disegnatore, come farebbe il segmented. */
async function scegli(page, modo) {
  await page.evaluate((valore) => {
    const attuale = JSON.parse(localStorage.getItem("cd_widgets") || "{}") || {};
    localStorage.setItem("cd_widgets", JSON.stringify({ ...attuale, compatto: valore }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, modo);
  await page.waitForTimeout(150);
}

function stretto(page) {
  return page.viewportSize().width <= 520;
}

async function misuraTessera(page) {
  return page.evaluate(() => {
    const tessera = document.querySelector("#dm-widgets .dm-tile");
    const fondo = tessera.querySelector(".dm-tile-fondo");
    return {
      altezza: tessera.getBoundingClientRect().height,
      fondoVisibile: Boolean(fondo && getComputedStyle(fondo).display !== "none"),
      cima: getComputedStyle(tessera.querySelector(".dm-tile-cima")).display,
      tacca: getComputedStyle(tessera, "::after").width,
    };
  });
}

test("auto e' il difetto: pillole sul telefono, tessere piene sullo schermo largo", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await expect(page.locator("#dm-widgets")).toHaveAttribute("data-dm-compatto", "auto");
  const misura = await misuraTessera(page);
  if (stretto(page)) {
    expect(misura.altezza).toBeLessThanOrEqual(64);
    expect(misura.fondoVisibile).toBe(false);
    expect(misura.cima).toBe("contents");
    expect(misura.tacca).toBe("4px");
  } else {
    expect(misura.altezza).toBeGreaterThan(90);
    expect(misura.fondoVisibile).toBe(true);
  }
});

test("«sempre» stringe ovunque, «mai» non stringe nemmeno sul telefono", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);

  await scegli(page, "sempre");
  await expect(page.locator("#dm-widgets")).toHaveAttribute("data-dm-compatto", "sempre");
  const compatta = await misuraTessera(page);
  expect(compatta.altezza).toBeLessThanOrEqual(64);
  expect(compatta.fondoVisibile).toBe(false);

  await scegli(page, "mai");
  await expect(page.locator("#dm-widgets")).not.toHaveAttribute("data-dm-compatto", /./);
  const piena = await misuraTessera(page);
  expect(piena.altezza).toBeGreaterThan(90);
  expect(piena.fondoVisibile).toBe(true);
});

test("due entita' in cd_evidenza fanno la tessera «In evidenza»", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_evidenza",
      JSON.stringify([
        { name: "quadro", entity: "sensor.quadro_temp" },
        { name: "rack", entity: "sensor.rack_temp" },
      ]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  const tessera = page.locator('#dm-widgets [data-dm-widget="evidenza"]');
  await expect(tessera).toBeVisible();
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("2");
});
