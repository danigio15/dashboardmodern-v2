/* Anche un rele' e' una tapparella legittima.
 *
 * Molte tapparelle vere sono comandate da uno switch: on la apre, off la
 * chiude, e una posizione non esiste. La casella la accetta, la card la
 * disegna nella lingua delle coperture — aperta, chiusa — e i bottoni le
 * parlano nella sua: turn_on, turn_off, e lo stop non esiste.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stati = {
  "switch.tapparella_bagno": {
    entity_id: "switch.tapparella_bagno",
    state: "on",
    attributes: {},
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
    covers: [{ id: "s1", name: "Bagno", entity: "switch.tapparella_bagno" }],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

test("lo switch si disegna da copertura e si comanda da switch", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-tapparelle")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

  const card = page.locator('[data-dm-shutter-card][data-tapp="switch.tapparella_bagno"]');
  await card.waitFor();
  // on = aperta, nella lingua delle coperture.
  await expect(card.locator(".tapp-state")).toHaveText(/aperta/i);
  await expect.poll(() => page.locator("[data-dm-tapp-summary]").innerText()).toMatch(/1 aperta/);
  // Nessuna posizione: la barra e' statica, niente cursore trascinabile.
  await expect(card.locator("[data-dm-position]")).toHaveCount(0);
  await expect(card.locator(".dm-tapp-track[data-dm-static]")).toHaveCount(1);

  // I bottoni parlano la lingua dello switch.
  const chiamate = [];
  await page.exposeFunction("registraSwitch", (dominio, servizio, dati) =>
    chiamate.push({ dominio, servizio, dati }),
  );
  await page.evaluate(() => {
    window.dmCallHaService = async (dominio, servizio, dati) => {
      await window.registraSwitch(dominio, servizio, dati);
    };
  });
  await card.locator('[data-svc="close_cover"]').click();
  await expect.poll(() => chiamate.length).toBeGreaterThan(0);
  expect(chiamate[0]).toEqual({
    dominio: "switch",
    servizio: "turn_off",
    dati: { entity_id: "switch.tapparella_bagno" },
  });
  await card.locator('[data-svc="open_cover"]').click();
  await expect.poll(() => chiamate.length).toBeGreaterThan(1);
  expect(chiamate[1]).toEqual({
    dominio: "switch",
    servizio: "turn_on",
    dati: { entity_id: "switch.tapparella_bagno" },
  });
  // Lo stop per un rele' non esiste: nessuna chiamata parte.
  await card.locator('[data-svc="stop_cover"]').click();
  await page.waitForTimeout(400);
  expect(chiamate.length).toBe(2);
});

test("il modale accetta lo switch nelle caselle", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("tapp");
  });
  await page.locator('[data-dm-edit-kind="shutter"][data-dm-edit-index="0"]').first().click();
  const modale = page.locator("#dm-shutter-editor-modal");
  await expect(modale).toBeVisible();
  await modale.locator("form").evaluate((form) => form.requestSubmit());
  // Nessun errore: lo switch e' un'entita' valida per la casella.
  await expect(modale).toHaveCount(0);
});
