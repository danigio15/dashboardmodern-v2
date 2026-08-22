import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Gli avvisi delle Aperture, dopo la matita.
 *
 * La finestra di modifica di un avviso offriva gruppi suoi — Sicurezza,
 * Elettrodomestici, Altro — che nel Quadro Avvisi non esistono. Un avviso delle
 * Aperture non trovava quindi il proprio gruppo, veniva salvato sotto "Altro" e
 * al ricaricamento spariva, perche' all'avvio nessuno legge un gruppo che non
 * c'e'. Chi ne aggiungeva parecchi e ne ritoccava qualcuno si ritrovava con
 * meno sensori di quanti ne avesse messi. */
const seed = {
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
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const nomi = ["porta_ingresso", "finestra_cucina", "finestra_bagno"];
const stati = Object.fromEntries(
  nomi.map((nome) => [
    `binary_sensor.${nome}`,
    {
      entity_id: `binary_sensor.${nome}`,
      state: "off",
      attributes: { device_class: "door", friendly_name: nome },
    },
  ]),
);

async function seminaStati(page) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
}

const apriAvvisi = (page) =>
  page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("avvisi");
  });

const entitaElencate = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#ed-body .ed-row-old.mono")]
      .map((node) => node.textContent.trim())
      .filter((testo) => testo.startsWith("binary_sensor."))
      .sort(),
  );

test.describe("avvisi delle Aperture", () => {
  test("modificare un avviso non lo toglie dalle Aperture", async ({ page }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await seminaStati(page);
    await apriAvvisi(page);

    for (const nome of nomi) {
      await page.evaluate((entita) => {
        document.getElementById("ed-avv-grp").value = "win";
        document.getElementById("ed-avv-ent").value = entita;
        document.getElementById("ed-avv-name").value = "";
        window.edAddAvviso();
      }, `binary_sensor.${nome}`);
    }
    const attesi = nomi.map((nome) => `binary_sensor.${nome}`).sort();
    await expect.poll(() => entitaElencate(page)).toEqual(attesi);

    // La matita su una riga delle Aperture: il gruppo giusto deve essere gia'
    // scelto, e i gruppi offerti sono quelli che il Quadro Avvisi sorveglia.
    await page.evaluate(() => {
      const riga = [...document.querySelectorAll("#ed-body .ed-row")].find((nodo) =>
        /porta_ingresso/.test(nodo.textContent),
      );
      riga.querySelector("[data-dm-alert-edit]").click();
    });
    const gruppo = page.locator("#dm-alert-editor-modal select[name=group]");
    await expect(gruppo).toHaveValue("win");
    await expect(gruppo.locator("option")).toHaveCount(5);
    await page.evaluate(() =>
      document.querySelector("#dm-alert-editor-modal form").requestSubmit(),
    );

    // Ricaricando, l'avviso ritoccato e' ancora fra le Aperture.
    await page.reload();
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_LEGACY_READY__ && window.DashboardModernModules,
    );
    await seminaStati(page);
    await apriAvvisi(page);
    await expect.poll(() => entitaElencate(page)).toEqual(attesi);
  });
});
