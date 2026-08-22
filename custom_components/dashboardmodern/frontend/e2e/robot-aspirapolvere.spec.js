import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Il robot aspirapolvere.
 *
 * La plancia non aveva una sezione per lui: un robot finiva fra gli
 * elettrodomestici, dove si accende e si spegne, e non si vedeva ne' cosa
 * stesse facendo, ne' quanta batteria gli restasse, ne' dove fosse arrivato.
 */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const stati = {
  "vacuum.piano_terra": {
    entity_id: "vacuum.piano_terra",
    state: "cleaning",
    attributes: {
      friendly_name: "Robottino",
      battery_level: 64,
      fan_speed: "Turbo",
      fan_speed_list: ["Silent", "Standard", "Turbo"],
      // start + pause + stop + torna alla base + potenza + batteria + trovalo
      supported_features: 8192 + 4 + 8 + 16 + 32 + 64 + 512,
    },
  },
  "camera.piano_terra_map": {
    entity_id: "camera.piano_terra_map",
    state: "idle",
    attributes: { entity_picture: "/api/camera_proxy/camera.piano_terra_map?token=abc" },
  },
};

const seme = {
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
    robots: [
      {
        id: "robot-1",
        name: "Piano terra",
        entity: "vacuum.piano_terra",
        mapEntity: "camera.piano_terra_map",
        room: "Casa",
      },
    ],
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, robot: true },
};

async function semina(page) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
}

async function fingiMappa(page) {
  await page.route("**/api/camera_proxy/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );
}

test.describe("robot aspirapolvere", () => {
  test("ha la sua voce, la sua pagina e la sua mappa", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await fingiMappa(page);
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
    await semina(page);

    // La voce nella barra non esiste nel documento: si aggiunge accanto alle altre.
    const voce = page.locator('nav.tabs .tab[data-tab="robot"]');
    await expect(voce).toHaveCount(1);
    /* Sul computer la barra sta a riposo fuori dallo schermo: il tocco si manda
     * alla voce, che e' cio' che questa prova vuole vedere funzionare. */
    await voce.dispatchEvent("click");

    const pagina = page.locator("#page-robot");
    await expect(pagina).toHaveClass(/active/);
    // Una pagina sola attiva: due sarebbero due sezioni sovrapposte.
    await expect(page.locator(".page.active")).toHaveCount(1);

    const scheda = page.locator("[data-dm-robot='vacuum.piano_terra']");
    await expect(scheda).toHaveCount(1);
    await expect(scheda).toHaveAttribute("data-dm-robot-state", "cleaning");
    await expect(scheda.locator("[data-dm-robot-label]")).toHaveText("Sta pulendo");
    await expect(scheda.locator(".dm-robot-batt-num")).toHaveText("64%");
    await expect(scheda.locator("[data-dm-robot-fan]")).toHaveValue("Turbo");

    // I comandi sono quelli che il robot dichiara di saper fare, non tutti.
    const comandi = await scheda
      .locator("[data-dm-robot-act]")
      .evaluateAll((nodi) => nodi.map((nodo) => nodo.dataset.dmRobotAct));
    expect(comandi.sort()).toEqual(["locate", "pause", "return", "start", "stop"]);

    // La mappa arriva da una telecamera e si vede.
    await expect
      .poll(() => scheda.locator("[data-dm-robot-map]").getAttribute("data-dm-map-state"))
      .toBe("ready");
  });

  test("i pulsanti chiamano il servizio giusto su quel robot", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await fingiMappa(page);
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
    await semina(page);
    await page.locator('nav.tabs .tab[data-tab="robot"]').dispatchEvent("click");

    const chiamate = [];
    await page.exposeFunction("registraServizio", (dominio, servizio, dati) =>
      chiamate.push(`${dominio}.${servizio} ${JSON.stringify(dati)}`),
    );
    await page.evaluate(() => {
      window.cdCallServiceJson = (dominio, servizio, dati) =>
        window.registraServizio(dominio, servizio, dati);
    });

    const scheda = page.locator("[data-dm-robot='vacuum.piano_terra']");
    await scheda.locator('[data-dm-robot-act="return"]').click();
    await expect
      .poll(() => chiamate)
      .toEqual(['vacuum.return_to_base {"entity_id":"vacuum.piano_terra"}']);

    await scheda.locator("[data-dm-robot-fan]").selectOption("Silent");
    await expect
      .poll(() => chiamate.at(-1))
      .toBe('vacuum.set_fan_speed {"entity_id":"vacuum.piano_terra","fan_speed":"Silent"}');
  });

  test("dalla configurazione si aggiunge un robot, e compare", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await fingiMappa(page);
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
      ...seme,
      sections: { ...seme.sections, robots: [] },
    });
    await semina(page);
    await page.evaluate(() => {
      window.apriConfigEntita();
    });

    // La scheda della configurazione non esiste nel documento: si aggiunge.
    const scheda = page.locator('.ed-tab[data-tab="robot"]');
    await expect(scheda).toHaveCount(1);
    await scheda.click();

    const corpo = page.locator("#ed-body");
    await expect(corpo.locator(".dm-robot-list")).toHaveCount(1);
    await corpo.locator("[data-robot-add]").click();

    const riga = corpo.locator("[data-robot-index]");
    await expect(riga).toHaveCount(1);
    await page.evaluate(() => {
      const scrivi = (campo, valore) => {
        const input = document.querySelector(`[data-robot-index] [data-robot-field="${campo}"]`);
        input.value = valore;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      scrivi("name", "Piano terra");
      scrivi("entity", "vacuum.piano_terra");
      scrivi("mapEntity", "camera.piano_terra_map");
    });
    await page.locator("#ed-body .dm-save-footer-btn").click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.DashboardModernModules?.store?.getSection?.("robots")?.map((r) => r.entity),
        ),
      )
      .toEqual(["vacuum.piano_terra"]);

    await page.locator('nav.tabs .tab[data-tab="robot"]').dispatchEvent("click");
    await semina(page);
    await expect(page.locator("[data-dm-robot='vacuum.piano_terra']")).toHaveCount(1);
  });

  test("un'entita' che non e' un robot non si salva, e lo dice", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
      ...seme,
      sections: { ...seme.sections, robots: [] },
    });
    await page.evaluate(() => {
      window.apriConfigEntita();
    });
    await page.locator('.ed-tab[data-tab="robot"]').click();
    await page.locator("#ed-body [data-robot-add]").click();
    await expect(page.locator("[data-robot-index]")).toHaveCount(1);
    await page.evaluate(() => {
      const input = document.querySelector('[data-robot-index] [data-robot-field="entity"]');
      input.value = "light.salotto";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.locator("#ed-body .dm-save-footer-btn").click();
    await expect(page.locator("[data-robot-error]")).not.toBeEmpty();
  });
});
