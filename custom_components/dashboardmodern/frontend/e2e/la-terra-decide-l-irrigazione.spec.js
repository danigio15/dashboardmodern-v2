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

/* Piu' momenti nella stessa giornata (#325).
 *
 * «Una alle 05:30 e alle 20:30, se la % del sensore umidita' terreno e'
 * inferiore ad una certa % parte una seconda irrigazione di tot minuti
 * definiti dall'utente.» Le righe si aggiungono sotto l'ora del programma e
 * si salvano da sole: chi ne toglie una e cambia idea non deve indovinare
 * dove sia finita. */
test("gli altri orari si aggiungono dall'editor e restano scritti", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await boot(page, testInfo);
  await page.evaluate(() => apriConfigEntita());
  await expect(page.locator("#editor-modal")).toBeVisible();
  await page.locator('.ed-tab[data-tab="irr"]').click();
  await expect(page.locator("[data-dm-irr-orari-fields]")).toBeVisible();

  await page.locator("[data-dm-irr-ora-piu]").click();
  const riga = page.locator("[data-dm-irr-ora]:not(.dm-irr-ora-testa)").first();
  await riga.locator('[data-campo="ora"]').fill("20:30");
  await riga.locator('[data-campo="minuti"]').fill("12");
  await riga.locator('[data-campo="seSottoA"]').fill("40");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const salvato = JSON.parse(window.localStorage.getItem("cd_irrigazione") || "{}");
        return JSON.stringify(salvato.orari || []);
      }),
    )
    .toBe(JSON.stringify([{ ora: "20:30", minuti: 12, seSottoA: 40 }]));

  /* Il salvataggio del runtime riscrive la configurazione coi soli campi che
   * conosce: gli orari devono sopravvivergli, come le soglie del terreno. */
  await page.evaluate(() => edIrrSaveCfg());
  await page.locator('.ed-tab[data-tab="irr"]').click();
  await expect(page.locator('[data-dm-irr-ora] [data-campo="ora"]').first()).toHaveValue("20:30");
  await expect(page.locator('[data-dm-irr-ora] [data-campo="minuti"]').first()).toHaveValue("12");

  /* E la pastiglia della card li nomina tutti, non solo il primo. */
  await page.evaluate(() => {
    document.getElementById("editor-modal")?.classList.remove("show");
    document.querySelectorAll(".page").forEach((node) => node.classList.remove("active"));
    document.getElementById("page-irrigazione")?.classList.add("active");
    renderIrrigazione();
  });
  await expect(page.locator("[data-dm-irr-schedule]")).toContainText("06:30");
  await expect(page.locator("[data-dm-irr-schedule]")).toContainText("20:30");

  /* Tolta la riga, sparisce anche dalla configurazione. */
  await page.evaluate(() => apriConfigEntita());
  await page.locator('.ed-tab[data-tab="irr"]').click();
  await page.locator("[data-dm-irr-ora-via]").first().click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const salvato = JSON.parse(window.localStorage.getItem("cd_irrigazione") || "{}");
        return Array.isArray(salvato.orari) ? salvato.orari.length : 0;
      }),
    )
    .toBe(0);
});

/* La durata dell'orario vale per tutta la corsa: il runtime rimette
 * `CD_IRR.until` a ogni passo e chi ha fatto partire la corsa lo corregge
 * subito dopo. Senza questo la zona da cinque minuti ne farebbe cinque anche
 * quando l'orario ne chiede dodici. */
test("l'orario con i suoi minuti comanda la durata della corsa", async ({ page }, testInfo) => {
  await boot(page, testInfo);

  const conDurata = await page.evaluate(() => {
    const stato = window.__DASHBOARDMODERN_POOL_IRRIGATION_SCENE__;
    stato.durataDaImporre = 12;
    window.cdIrrProgram(true);
    stato.durataDaImporre = null;
    const minuti = Math.round((window.CD_IRR.until - Date.now()) / 60000);
    window.cdIrrStopAll();
    return { minuti, dopoLoStop: stato.durataDellaCorsa };
  });
  expect(conDurata.minuti).toBe(12);
  /* Fermata a mano, la durata imposta se ne va con lei. */
  expect(conDurata.dopoLoStop).toBe(null);

  // E senza orario che la imponga, comandano i minuti della zona.
  const sueMinuti = await page.evaluate(() => {
    window.cdIrrProgram(true);
    const minuti = Math.round((window.CD_IRR.until - Date.now()) / 60000);
    window.cdIrrStopAll();
    return minuti;
  });
  expect(sueMinuti).toBe(5);
});
