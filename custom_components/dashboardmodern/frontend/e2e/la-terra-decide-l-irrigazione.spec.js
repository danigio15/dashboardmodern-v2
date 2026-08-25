/* La terra decide l'irrigazione, dal vivo.
 *
 * Terreno bagnato → il programma delle ore fisse salta con l'avviso in
 * card, ma il tasto «forza» passa. Terreno sotto la soglia bassa → il
 * programma parte da solo al primo cambio di stato, una volta al giorno. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { showRawEntityFields } from "./helpers/entity-field.js";

const seed = {
  schema_version: 4,
  sections: { rooms: [], lights: [], appliances: [], loads: [], covers: [] },
  visibility: { home: true },
};

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        window.__IRR_CALLS__ = window.__IRR_CALLS__ || [];
        if (message.type === "call_service") window.__IRR_CALLS__.push(message);
        const result =
          message.type === "get_states"
            ? []
            : message.type === "frontend/get_user_data"
              ? { value: null }
              : null;
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_irrigazione",
      JSON.stringify({
        zones: [{ name: "Prato", entity: "switch.irrigazione_prato", mins: 5 }],
        time: "06:30",
        enabled: true,
        soilEnt: "sensor.umidita_terreno",
        soilSkipAbove: 60,
        soilStartBelow: 5,
      }),
    );
  });
}

async function terreno(page, valore) {
  await page.evaluate((v) => {
    _RAW_STATES["sensor.umidita_terreno"] = {
      entity_id: "sensor.umidita_terreno",
      state: String(v),
      attributes: { unit_of_measurement: "%" },
    };
  }, valore);
}

test("terreno bagnato: il programma salta con l'avviso, «forza» passa comunque", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await terreno(page, 80);

  const esito = await page.evaluate(() => {
    window.cdIrrProgram(false);
    return { cur: window.CD_IRR.cur, skip: window.CD_IRR.skip };
  });
  expect(esito.cur).toBeLessThan(0);
  expect(esito.skip).toContain("80%");

  const forzato = await page.evaluate(() => {
    window.cdIrrProgram(true);
    const cur = window.CD_IRR.cur;
    window.cdIrrStopAll();
    return cur;
  });
  expect(forzato).toBeGreaterThanOrEqual(0);
});

test("terreno sotto la soglia bassa: parte da solo al cambio di stato, una volta al giorno", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await terreno(page, 3);

  await page.evaluate(() => {
    window.localStorage.removeItem("cd_irr_soil_lastrun");
    window.dispatchEvent(new Event("dashboardmodern:state-changed"));
  });
  await expect.poll(() => page.evaluate(() => window.CD_IRR.cur)).toBeGreaterThanOrEqual(0);
  const oggi = await page.evaluate(() => window.localStorage.getItem("cd_irr_soil_lastrun"));
  expect(oggi).toBe(await page.evaluate(() => new Date().toDateString()));
  const acceso = await page.evaluate(() =>
    (window.__IRR_CALLS__ || []).some(
      (call) => call.service === "turn_on" && call.target?.entity_id === "switch.irrigazione_prato",
    ),
  );
  expect(acceso).toBe(true);

  // Fermata la sequenza, lo stesso giorno non riparte.
  await page.evaluate(() => {
    window.cdIrrStopAll();
    window.dispatchEvent(new Event("dashboardmodern:state-changed"));
  });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.CD_IRR.cur)).toBeLessThan(0);
});

/* Le caselle del terreno sopravvivono al salvataggio.
 *
 * Il salvataggio del runtime riscrive `cd_irrigazione` coi soli campi che
 * conosce e finisce con `editorSwitch('irr')`, che rifa' la scheda da capo.
 * Chi rimetteva i nostri campi DOPO leggeva caselle appena disegnate col
 * valore vecchio: si scriveva la soglia, si premeva Salva, e la soglia
 * tornava com'era senza dire niente. */
test("la soglia del terreno scritta a mano resta scritta dopo il salvataggio", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await boot(page, testInfo);
  await page.evaluate(() => apriConfigEntita());
  await expect(page.locator("#editor-modal")).toBeVisible();
  await page.locator('.ed-tab[data-tab="irr"]').click();
  await expect(page.locator("#ed-irr-soil")).toBeAttached();
  // La casella dell'entita' vive dietro la matita, come tutte le altre.
  await showRawEntityFields(page);
  await expect(page.locator("#ed-irr-soil")).toBeVisible();

  await page.locator("#ed-irr-soil").fill("sensor.terra_nuova");
  await page.locator("#ed-irr-soil-skip").fill("72");
  await page.locator("#ed-irr-soil-start").fill("8");
  await page.evaluate(() => edIrrSaveCfg());

  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(window.localStorage.getItem("cd_irrigazione") || "{}");
        return [stored.soilEnt, stored.soilSkipAbove, stored.soilStartBelow].join("|");
      }),
    )
    .toBe("sensor.terra_nuova|72|8");

  // E la scheda ridisegnata mostra quello che e' stato salvato, non l'opposto.
  await expect(page.locator("#ed-irr-soil")).toHaveValue("sensor.terra_nuova");
  await expect(page.locator("#ed-irr-soil-skip")).toHaveValue("72");
});
