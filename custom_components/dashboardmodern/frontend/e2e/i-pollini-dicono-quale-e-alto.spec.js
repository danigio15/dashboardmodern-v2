/* I pollini presi uno per uno, e il disagio termico con i suoi indici (#428).
 *
 * Questa casa ha il bollettino della giornata tranquillo — indice 1 — e le
 * graminacee a 4: è il caso in cui la richiesta serve, perché a chi è allergico
 * alle graminacee la media della giornata non dice niente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    lights: [],
    climate: [],
    covers: [],
    ev: [],
    loads: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, allerte: true },
};

const STATI = {
  "sensor.pollini_oggi": { state: "1", attributes: { friendly_name: "Pollini oggi" } },
  "sensor.polline_graminacee": {
    state: "4",
    attributes: {
      friendly_name: "Polline graminacee",
      Category: "Alto",
      Advice: "Tieni le finestre chiuse nelle ore centrali.",
      Description: "Il caldo secco di questi giorni favorisce la dispersione.",
    },
  },
  "sensor.polline_alberi": { state: "1", attributes: { friendly_name: "Polline alberi" } },
  "sensor.percezione": { state: "Leggermente caldo", attributes: { friendly_name: "Percezione" } },
  "sensor.gelo": { state: "high", attributes: { friendly_name: "Rischio gelo" } },
  "sensor.humidex": { state: "some_discomfort", attributes: { friendly_name: "Humidex" } },
};

const ALLERTE = {
  pollini: {
    entity: "sensor.pollini_oggi",
    erba: "sensor.polline_graminacee",
    albero: "sensor.polline_alberi",
  },
  comfort: { entity: "sensor.percezione", humidex: "sensor.humidex", gelo: "sensor.gelo" },
};

async function avvia(page, testInfo) {
  await page.setViewportSize({ width: 1200, height: 950 });
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate(
    ({ stati, allerte }) => {
      localStorage.setItem("cd_allerte", JSON.stringify(allerte));
      const raw = eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      for (const [id, voce] of Object.entries(stati)) {
        const stato = { entity_id: id, ...voce };
        if (raw) raw[id] = stato;
        if (typeof STATES !== "undefined") STATES[id] = stato;
      }
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, allerte: ALLERTE },
  );
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-allerte")?.classList.add("active");
    window.render?.();
  });
  await page.waitForTimeout(900);
}

test("la sezione nomina il polline alto e apre le sue frasi", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const pagina = page.locator("#page-allerte");
  await expect(pagina).toBeVisible();
  /* La frase nomina il peggiore: un «1» del bollettino non dice niente a chi è
   * allergico, «Graminacee: alto» sì. */
  await expect(pagina).toContainText("Graminacee: alto");
  // E il disagio scrive la parola del sensore, in italiano, non «leggermente_caldo».
  await expect(pagina).toContainText("Leggermente caldo");
  await testInfo.attach("sezione-allerte", {
    body: await pagina.screenshot(),
    contentType: "image/png",
  });

  // Aprendo i pollini si leggono le frasi dell'integrazione.
  await pagina.locator("[data-dm-allerta-apri][data-chiave='pollini']").first().click();
  const dettaglio = page.locator("#dm-allerta-dettaglio").first();
  await expect(dettaglio).toBeVisible();
  await expect(dettaglio).toContainText("Graminacee");
  await expect(dettaglio).toContainText("Alto · 4/4");
  await expect(dettaglio).toContainText("Tieni le finestre chiuse nelle ore centrali.");
  await expect(dettaglio).toContainText(
    "Il caldo secco di questi giorni favorisce la dispersione.",
  );
  await testInfo.attach("dettaglio-pollini", {
    body: await dettaglio.screenshot(),
    contentType: "image/png",
  });
});

test("il comfort elenca i suoi indici, e il gelo alza il livello", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  const pagina = page.locator("#page-allerte");
  await pagina.locator("[data-dm-allerta-apri][data-chiave='comfort']").first().click();
  const dettaglio = page.locator("#dm-allerta-dettaglio").first();
  await expect(dettaglio).toBeVisible();
  await expect(dettaglio).toContainText("Humidex");
  await expect(dettaglio).toContainText("Un po' di disagio");
  await expect(dettaglio).toContainText("Rischio gelo");
  await expect(dettaglio).toContainText("Rischio di gelo alto");
  await testInfo.attach("dettaglio-comfort", {
    body: await dettaglio.screenshot(),
    contentType: "image/png",
  });
});
