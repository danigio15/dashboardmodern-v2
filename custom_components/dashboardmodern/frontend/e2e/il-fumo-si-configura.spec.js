/* I rilevatori di fumo si rilevano da soli, si vedono in Sicurezza e si
 * possono togliere (#238).
 *
 * Il rilevamento e' continuo: un sensore che compare dopo l'avvio entra da
 * solo nel gruppo, e uno tolto col cestino resta tolto anche se il sensore
 * esiste ancora — il registro dei gia' visti se lo ricorda. Il blocco della
 * pagina Sicurezza sta fra le Aperture e le Telecamere, e quando un sensore
 * suona la sua riga passa in allarme.
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
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const STATI = {
  "binary_sensor.fumo_cucina": {
    entity_id: "binary_sensor.fumo_cucina",
    state: "off",
    attributes: { device_class: "smoke", friendly_name: "Fumo cucina" },
  },
  "binary_sensor.fumo_taverna": {
    entity_id: "binary_sensor.fumo_taverna",
    state: "on",
    attributes: { device_class: "smoke", friendly_name: "Fumo taverna" },
  },
};

async function seminaStati(page, valori) {
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, valori);
}

async function apriAvvisi(page) {
  await page.evaluate(() => {
    globalThis.apriConfigEntita?.();
    globalThis.editorSwitch?.("avvisi");
  });
}

test("il fumo si rileva, si vede in Sicurezza e si puo' togliere", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await seminaStati(page, STATI);

  await apriAvvisi(page);

  // La fisarmonica del fumo c'e', con dentro i due sensori rilevati.
  const acc = page.locator("[data-dm-smoke-acc]");
  await expect(acc).toHaveCount(1, { timeout: 20_000 });
  await expect(acc.locator("[data-dm-smoke-row]")).toHaveCount(2);
  await expect(acc).toContainText("Fumo cucina");
  await expect(acc).toContainText("Fumo taverna");

  // Il gruppo si sceglie anche quando se ne aggiunge uno a mano.
  await expect(page.locator('#ed-avv-grp option[value="fumo"]')).toHaveCount(1);

  // Nella pagina Sicurezza il blocco sta prima delle telecamere, e il sensore
  // che suona ha la riga in allarme.
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await page
    .locator('.tab[data-tab="security"]')
    .first()
    .evaluate((n) => n.click());
  const blocco = page.locator("#page-security .dm-sec-smoke");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });
  await expect(blocco.locator(".dm-smoke-row")).toHaveCount(2);
  await expect(blocco.locator('[data-dm-smoke="binary_sensor.fumo_taverna"]')).toHaveClass(
    /is-alarm/,
  );
  await expect(blocco.locator('[data-dm-smoke="binary_sensor.fumo_cucina"]')).not.toHaveClass(
    /is-alarm/,
  );
  const posizione = await page.evaluate(() => {
    const blocco = document.querySelector("#page-security .dm-sec-smoke");
    const cctv = document.querySelector("#page-security .dm-sec-cctv");
    return Boolean(blocco && cctv && blocco.nextElementSibling === cctv);
  });
  expect(posizione, "il blocco sta subito prima delle telecamere").toBe(true);

  // Il rilevamento e' continuo: un sensore montato dopo entra da solo.
  await seminaStati(page, {
    "binary_sensor.fumo_garage": {
      entity_id: "binary_sensor.fumo_garage",
      state: "off",
      attributes: { device_class: "smoke", friendly_name: "Fumo garage" },
    },
  });
  await apriAvvisi(page);
  await expect(acc.locator("[data-dm-smoke-row]")).toHaveCount(3, { timeout: 20_000 });

  // Il cestino toglie davvero. La fisarmonica nasce chiusa: prima si apre.
  await acc.locator("summary").click();
  await acc.locator('[data-dm-smoke-del="binary_sensor.fumo_cucina"]').click();
  await apriAvvisi(page);
  await expect(page.locator("[data-dm-smoke-row]")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator("[data-dm-smoke-acc]")).not.toContainText("Fumo cucina");

  // E resta tolto anche ricaricando: il registro dei visti se lo ricorda.
  await page.reload();
  await seminaStati(page, STATI);
  await apriAvvisi(page);
  await expect(page.locator("[data-dm-smoke-row]")).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator("[data-dm-smoke-acc]")).not.toContainText("Fumo cucina");
});
