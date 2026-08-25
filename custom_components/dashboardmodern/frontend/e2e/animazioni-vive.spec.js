/* Il movimento deve durare piu' di un aggiornamento.
 *
 * La scheda di un elettrodomestico si ridisegna a ogni cambio di stato — e la
 * potenza di uno acceso cambia di continuo — e la si buttava via intera per
 * rifarla. Il disegno dentro ne usciva ogni volta nuovo, e un'animazione su un
 * elemento appena nato riparte da zero: il cestello non arrivava mai a fare un
 * giro. A occhio l'illustrazione sembrava ferma.
 *
 * E un avviso il cui nome non rientra nel vocabolario delle categorie restava
 * immobile accanto a uno che si muoveva.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [
      {
        id: "appliance-dishwasher",
        name: "Lavastoviglie",
        device_type: "lavastoviglie",
        icon: "lavastoviglie",
        power_entity: "sensor.dishwasher_power",
        entities: ["sensor.dishwasher_power"],
        show_in_dashboard: true,
      },
    ],
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
  visibility: { home: true, appliances: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
}

test("il disegno dell'elettrodomestico continua a muoversi mentre la potenza cambia", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await avvia(page, testInfo);

  await page.evaluate(() => {
    const states =
      window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") || window._RAW_STATES;
    states["sensor.dishwasher_power"] = {
      entity_id: "sensor.dishwasher_power",
      state: "1800",
      attributes: { unit_of_measurement: "W", device_class: "power" },
    };
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-appliances-main")?.classList.add("active");
    window.renderAppliances?.();
    window.renderApplianceSection?.(true);
  });

  const card = page.locator('[data-appliance-id="appliance-dishwasher"].dm-ap-card');
  await expect(card).toHaveClass(/is-run/);
  await expect(page.locator(".dm-ap-hero .dm-hero-art")).toHaveCount(1);

  // Tre giri di potenza nuova, come sulla plancia vera.
  const tempi = [];
  for (let giro = 0; giro < 3; giro += 1) {
    await page.evaluate(
      (watt) => {
        const states =
          window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") ||
          window._RAW_STATES;
        states["sensor.dishwasher_power"] = {
          entity_id: "sensor.dishwasher_power",
          state: String(watt),
          attributes: { unit_of_measurement: "W", device_class: "power" },
        };
        window.renderApplianceSection?.();
      },
      1700 + giro * 37,
    );
    await page.waitForTimeout(450);
    tempi.push(
      await page.evaluate(() => {
        const parte = document.querySelector(".dm-ap-hero .dm-hero-art [class^='dmh-']");
        const anim = parte?.getAnimations?.()[0];
        return anim ? Math.round(Number(anim.currentTime)) : -1;
      }),
    );
  }

  // Il tempo dell'animazione va avanti invece di ripartire da zero a ogni
  // ridisegno: e' questo che distingue un disegno vivo da uno che sussulta.
  expect(tempi.every((t) => t > 0)).toBe(true);
  expect(tempi[2]).toBeGreaterThan(tempi[0] + 400);
});

test("un avviso che non si sa leggere si muove lo stesso", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await avvia(page, testInfo);

  await page.evaluate(() => {
    localStorage.setItem(
      "cd_avvisi_custom",
      JSON.stringify([
        {
          name: "Garage",
          icon: "🧰",
          entities: ["binary_sensor.garage"],
          op: "eq",
          val: "on",
        },
      ]),
    );
    const states = window.eval("typeof STATES !== 'undefined' ? STATES : null") || {};
    states["binary_sensor.garage"] = {
      entity_id: "binary_sensor.garage",
      state: "on",
      attributes: {},
    };
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-home")?.classList.add("active");
    window.cdRenderCustomAvvisi?.();
  });

  /* L'avviso personalizzato vive nella tessera del ponte dei widget: entra
   * con la sua animazione e, da avviso, respira col ping dell'accento. */
  const tessera = page.locator('#dm-widgets [data-dm-widget="custom-0"]');
  await expect(tessera).toBeVisible();
  await expect(tessera).toHaveAttribute("data-alert", "true");
  await expect(tessera).toContainText("Garage");
  await expect
    .poll(() =>
      tessera.evaluate((nodo) =>
        nodo
          .getAnimations({ subtree: true })
          .some((animazione) => animazione.animationName === "dmWidgetPing"),
      ),
    )
    .toBe(true);
});
