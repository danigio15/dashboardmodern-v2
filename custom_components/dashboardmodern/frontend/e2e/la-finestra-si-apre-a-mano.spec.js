/* Una finestra che non si comanda arriva fino alla pagina.
 *
 * «Io non ho le tapparelle, ho le persiane e sono manuali, pero' ho sensori di
 * apertura, volevo inserirli ma chiede obbligatoriamente l'entita' tapparella».
 * Il modello lo prova senza browser; qui si prova che la card esce davvero,
 * senza comandi e con lo stato che viene dal contatto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const INFISSI = [
  {
    name: "Camera",
    entity: "cover.tapparella_camera",
    room: "Camera",
    contact: "binary_sensor.finestra_camera",
  },
  { name: "Persiana salone", room: "Salone", contact: "binary_sensor.persiana_salone" },
  { name: "Persiana cucina", room: "Salone", contact: "binary_sensor.persiana_cucina" },
];

const seme = {
  schema_version: 4,
  sections: {
    rooms: [{ name: "Camera" }, { name: "Salone" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
    covers: INFISSI,
  },
  visibility: { home: true, tapparelle: true },
};

const stati = {
  "cover.tapparella_camera": {
    state: "open",
    attributes: { current_position: 60, supported_features: 15 },
  },
  "binary_sensor.finestra_camera": { state: "off", attributes: { device_class: "window" } },
  "binary_sensor.persiana_salone": { state: "on", attributes: { device_class: "window" } },
  "binary_sensor.persiana_cucina": { state: "off", attributes: { device_class: "window" } },
};

test("una persiana manuale col solo sensore arriva sulla pagina, e non promette comandi", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s, righe }) => {
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.localStorage.setItem("cd_tapparelle", JSON.stringify(righe));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: stati, righe: INFISSI },
  );
  await page.locator('.tab[data-tab="tapparelle"]').first().click();

  const salone = page.locator('[data-tapp="binary_sensor.persiana_salone"]');
  await expect(salone).toHaveAttribute("data-dm-solo-infisso", "true");
  // La pastiglia viene dal contatto: acceso vuol dire aperta.
  await expect(salone.locator("[data-dm-state]")).toHaveText(/Aperta/i);
  // Nessun comando: sarebbe una promessa che non arriva da nessuna parte.
  await expect(salone.locator("[data-svc]")).toHaveCount(0);
  await expect(salone.locator("[data-dm-position]")).toHaveCount(0);
  // E una pastiglia sola: «Aperta» qui e' gia' la finestra.
  await expect(salone.locator(".tapp-state")).toHaveCount(1);

  const cucina = page.locator('[data-tapp="binary_sensor.persiana_cucina"]');
  await expect(cucina.locator("[data-dm-state]")).toHaveText(/Chiusa/i);

  // La tapparella vera resta quella di sempre, coi suoi comandi.
  const camera = page.locator('[data-tapp="cover.tapparella_camera"]');
  await expect(camera.locator("[data-svc='open_cover']")).toHaveCount(1);

  /* Il conteggio in cima non spaccia una finestra per una tapparella su: la
   * tapparella aperta e' una, e la finestra aperta e' contata a parte. */
  await expect(page.locator("#page-tapparelle")).toContainText("1 aperta");
  await expect(page.locator("#page-tapparelle")).toContainText("1 finestra aperta");
});
