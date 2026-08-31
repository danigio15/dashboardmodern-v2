/* La cornice della foto dell'auto sta ferma sotto la tempesta.
 *
 * Dal video: gli angoli della foto passavano da tondi a vivi e la foto
 * saltava di scala, da soli, circa una volta al secondo — la cadenza del
 * ridisegno. Non era l'hover: era di nuovo un ping-pong fra il giro del
 * guscio e la ripassata della pelle. Questa prova avvia con un'auto in
 * carica e la sua foto, scatena trenta giri di stati e pretende che raggio
 * degli angoli, rettangolo dell'immagine e sorgente non cambino MAI.
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
    lights: [],
    climate: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    ev: [
      {
        name: "Leapmotor B10",
        ov: {
          "dm.ev_batteria_auto": "sensor.leap_soc",
          "dm.ev_stato_ricarica": "sensor.leap_stato",
          "dm.ev_potenza_ricarica": "sensor.leap_kw",
        },
        img: "/legacy/logo.png",
        imgPlugged: "/legacy/logo.png",
      },
    ],
    entityOverrides: {
      "dm.ev_batteria_auto": "sensor.leap_soc",
      "dm.ev_stato_ricarica": "sensor.leap_stato",
      "dm.ev_potenza_ricarica": "sensor.leap_kw",
    },
  },
  visibility: { home: true, ev: true },
};

function statiDelGiro(giro) {
  return {
    "sensor.leap_soc": {
      entity_id: "sensor.leap_soc",
      state: String(50 + (giro % 3)),
      attributes: { unit_of_measurement: "%" },
    },
    "sensor.leap_stato": { entity_id: "sensor.leap_stato", state: "C", attributes: {} },
    "sensor.leap_kw": {
      entity_id: "sensor.leap_kw",
      state: String(1.6 + giro * 0.01),
      attributes: { unit_of_measurement: "kW" },
    },
  };
}

test("angoli, geometria e sorgente della foto non ballano", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* La foto vera dell'utente vive in /local/ di Home Assistant: qui la serve
   * la prova stessa, cosi' l'immagine si carica davvero e la cornice fa il
   * suo ciclo di vita intero (load, misura, pelle). */
  const { readFileSync } = await import("node:fs");
  const logo = readFileSync(new URL("../legacy/logo.png", import.meta.url));
  await page.route("**/local/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: logo }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, statiDelGiro(0));
  await page.locator('.tab[data-tab="ev"]').click();
  await page.waitForTimeout(1500);

  const fotografa = () =>
    page.evaluate(() => {
      const hero = document.getElementById("lm-hero-card");
      const img = document.getElementById("ev-mod-car-img");
      if (!hero || !img) return null;
      const stile = getComputedStyle(hero);
      const r = img.getBoundingClientRect();
      return {
        raggio: stile.borderRadius,
        overflow: stile.overflow,
        src: img.getAttribute("src") || "",
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(
          ",",
        ),
        opacita: getComputedStyle(img).opacity,
      };
    });

  const prima = await fotografa();
  expect(prima).not.toBeNull();
  console.log("PRIMA:", JSON.stringify(prima));

  for (let giro = 1; giro <= 30; giro += 1) {
    await page.evaluate((stati) => {
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      try {
        window.render?.();
      } catch (_e) {}
    }, statiDelGiro(giro));
    await page.waitForTimeout(120);
    const adesso = await fotografa();
    expect(adesso, `giro ${giro}`).toEqual(prima);
  }
});
