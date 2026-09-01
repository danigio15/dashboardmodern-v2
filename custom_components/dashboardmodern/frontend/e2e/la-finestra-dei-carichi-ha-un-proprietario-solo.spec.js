/* La finestra dei sotto-carichi ha un proprietario solo.
 *
 * «guarda, cambia intestazione, quindi c'e' qualcosa di duplicato» — due
 * schermate dello stesso minuto, la stessa finestra, due intestazioni diverse:
 * una col nome in grassetto scuro e ISTANTANEO staccato in grigio, l'altra
 * tutta azzurra in un pezzo solo. Erano due mani sullo stesso nodo.
 *
 * Sotto ce n'era una peggiore. Due sezioni avvolgono `apriSubLoads` — questa
 * finestra e la stabilita' Beta 27 — e nessuna delle due riconosceva il segno
 * dell'altra sulla funzione esterna: a ogni giro di stati ciascuna riavvolgeva
 * quella dell'altra. Misurata, la catena cresceva di due a ogni giro: cinque
 * avvolgimenti all'avvio, venticinque dopo dieci giri, sessantacinque dopo
 * trenta, e cosi' per tutto il tempo che la plancia resta aperta. Aprire la
 * finestra faceva girare decine di volte due disegnatori che si scrivono sopra
 * a vicenda — ed e' per questo che l'intestazione cambiava faccia.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [
      {
        id: "app-0",
        name: "Condizionatori",
        type: "generico",
        power_entity: "sensor.app_0_w",
        metadata: { beta27_subload_group: "elettro" },
      },
    ],
    loads: [{ id: "elettro", name: "Elettrodomestici", icon: "🔌", order: 0 }],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { grid: { power: "sensor.rete_w" }, house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* Quanti avvolgimenti ha addosso una funzione: si scende per i due nomi con
 * cui le sezioni tengono la precedente. */
const quantiAvvolgimenti = (page, nome) =>
  page.evaluate((chiamata) => {
    let funzione = window[chiamata];
    const visti = new Set();
    let quanti = 0;
    while (typeof funzione === "function" && !visti.has(funzione) && quanti < 500) {
      visti.add(funzione);
      quanti += 1;
      funzione = funzione.__dmWrappedOriginal || funzione.__dmPrevious;
    }
    return quanti;
  }, nome);

const battito = async (page, giri) => {
  for (let giro = 0; giro < giri; giro++) {
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} })),
    );
    await page.waitForTimeout(30);
  }
};

async function apparecchiata(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of [
      ["sensor.app_0_w", "701"],
      ["sensor.rete_w", "701"],
      ["sensor.casa_w", "701"],
    ])
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    /* Il gruppo dichiarato anche nel modello della stabilita' Beta 27: senza,
     * la sua mano sull'intestazione non parte nemmeno, e la prova guarderebbe
     * un caso che non e' quello di casa. */
    localStorage.setItem(
      "cd_subload_groups",
      JSON.stringify([{ id: "elettro", name: "Elettrodomestici", icon: "🔌", color: "#0ea5e9" }]),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(600);
}

test("gli avvolgimenti di apriSubLoads non crescono col passare degli stati", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await apparecchiata(page, testInfo);

  const allInizio = await quantiAvvolgimenti(page, "apriSubLoads");
  expect(allInizio).toBeGreaterThan(0);

  await battito(page, 15);
  const dopo = await quantiAvvolgimenti(page, "apriSubLoads");
  expect(
    dopo,
    `la catena e' passata da ${allInizio} a ${dopo}: due sezioni si riavvolgono a vicenda a ogni giro di stati`,
  ).toBe(allInizio);
});

test("un gruppo che non sappiamo disegnare torna al guscio, e il segno di proprieta' se ne va", async ({
  page,
}, testInfo) => {
  /* Il segno `data-dm-subload-owner` restava attaccato alla lista anche quando
   * la finestra tornava al guscio — `innerHTML` cambia i figli, non gli
   * attributi. Aprendo poi un gruppo che noi non sappiamo disegnare, la mano di
   * Beta 27 si tirava indietro credendo che la finestra fosse ancora nostra: il
   * gruppo restava senza periodo e col colore di quello aperto prima. */
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await apparecchiata(page, testInfo);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((nodo) => nodo.click());
  await page.waitForTimeout(1000);

  /* Prima quello nostro: il segno si mette. */
  await page.evaluate(() => window.apriSubLoads?.("elettro"));
  await expect(page.locator(".dm-subload-card")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.getElementById("subloads-list")?.dataset?.dmSubloadOwner || "",
    ),
  ).toBe("beta30");

  /* Poi uno che non e' fra i carichi canonici: la finestra non e' nostra. */
  await page.evaluate(() => {
    const gruppi = JSON.parse(localStorage.getItem("cd_subload_groups") || "[]");
    gruppi.push({ id: "cantina", name: "Cantina", icon: "🍷", color: "#7c3aed" });
    localStorage.setItem("cd_subload_groups", JSON.stringify(gruppi));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.apriSubLoads?.("cantina"));
  await page.waitForTimeout(500);

  expect(
    await page.evaluate(
      () => document.getElementById("subloads-list")?.dataset?.dmSubloadOwner || "",
    ),
    "il segno di proprieta' e' rimasto su una finestra che non e' piu' nostra",
  ).toBe("");
  await expect(page.locator("#subloads-title")).toContainText("Cantina");
});

test("l'intestazione resta quella della finestra, anche dopo un giro di stati", async ({
  page,
}, testInfo) => {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await apparecchiata(page, testInfo);

  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((nodo) => nodo.click());
  await page.waitForTimeout(1000);

  /* Quante volte l'intestazione viene riscritta mentre la finestra si apre.
   * Una mano sola la scrive una volta; due mani se la contendono. */
  await page.evaluate(() => {
    window.__dmTitolo = 0;
    new MutationObserver((mutazioni) => {
      for (const mutazione of mutazioni) if (mutazione.type === "childList") window.__dmTitolo += 1;
    }).observe(document.getElementById("subloads-title"), { childList: true, subtree: true });
  });
  await page.evaluate(() => window.apriSubLoads?.("elettro"));
  await expect(page.locator(".dm-subload-card")).toHaveCount(1);
  await page.waitForTimeout(600);
  const riscritture = await page.evaluate(() => window.__dmTitolo);
  expect(
    riscritture,
    `l'intestazione e' stata riscritta ${riscritture} volte aprendo la finestra: se la contendono in due`,
  ).toBeLessThanOrEqual(3);

  /* Appena aperta: il nome e il periodo sono due pezzi, non una stringa sola. */
  const titolo = page.locator("#subloads-title");
  await expect(titolo.locator(".dm-subload-title-name")).toHaveText("ELETTRODOMESTICI");
  await expect(titolo.locator(".dm-subload-title-period")).toHaveText("ISTANTANEO");

  /* E dopo il battito degli stati e' ancora la stessa: nessun'altra mano l'ha
   * riscritta in un pezzo solo. */
  await battito(page, 5);
  await expect(titolo.locator(".dm-subload-title-name")).toHaveText("ELETTRODOMESTICI");
  await expect(titolo.locator(".dm-subload-title-period")).toHaveText("ISTANTANEO");
  expect(
    await page.evaluate(
      () => document.getElementById("subloads-title")?.querySelectorAll("span,small").length,
    ),
    "l'intestazione ha piu' pezzi del previsto: qualcuno ci ha scritto sopra",
  ).toBe(3);
});
