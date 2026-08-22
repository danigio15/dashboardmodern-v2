/* Con tutti e tre i tipi insieme, ognuno ha il suo cursore e conta nel totale.
 *
 * Tapparella, tenda e tenda da sole si muovono in modi diversi e si disegnano
 * in modi diversi, ma per chi guarda la pagina sono tre coperture uguali: tre
 * cursori con la loro percentuale, e un conteggio in cima che le tiene tutte.
 * Il disegno non deve portarsi dietro il comando.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const stati = {
  "cover.tapparella": {
    entity_id: "cover.tapparella",
    state: "open",
    attributes: { device_class: "shutter", current_position: 70, supported_features: 15 },
  },
  "cover.tenda": {
    entity_id: "cover.tenda",
    state: "open",
    attributes: { device_class: "curtain", current_position: 35, supported_features: 15 },
  },
  "cover.tenda_sole": {
    entity_id: "cover.tenda_sole",
    state: "closed",
    attributes: { device_class: "awning", current_position: 0, supported_features: 15 },
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
    covers: [
      { id: "t1", name: "Tapparella", entity: "cover.tapparella" },
      { id: "t2", name: "Tenda", entity: "cover.tenda" },
      { id: "t3", name: "Tenda da sole", entity: "cover.tenda_sole" },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

async function apri(page, testInfo) {
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
  await page.locator("[data-dm-shutter-card]").first().waitFor();
}

const carta = (page, entity) => page.locator(`[data-dm-shutter-card][data-tapp="${entity}"]`);

test("tre tipi, tre cursori, tre percentuali", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await apri(page, testInfo);

  await expect(page.locator("[data-dm-shutter-card]")).toHaveCount(3);

  /* Il cursore c'e' su tutti e tre, e porta la posizione di quello li'. */
  for (const [entity, posizione] of [
    ["cover.tapparella", "70"],
    ["cover.tenda", "35"],
    ["cover.tenda_sole", "0"],
  ]) {
    const cursore = carta(page, entity).locator("[data-dm-position]");
    await expect(cursore).toHaveCount(1);
    await expect.poll(() => cursore.inputValue()).toBe(posizione);
    await expect(carta(page, entity).locator("[data-dm-readout]")).toHaveText(`${posizione}%`);
  }
});

test("il conteggio in cima tiene dentro anche tende e tende da sole", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await apri(page, testInfo);

  /* Due aperte — la tapparella al 70 e la tenda al 35 — e una chiusa, che e'
   * la tenda da sole: se il conteggio guardasse solo le tapparelle direbbe
   * «1 aperta». */
  await expect.poll(() => page.locator("[data-dm-tapp-summary]").innerText()).toMatch(/2 aperte/);
  await expect.poll(() => page.locator("[data-dm-tapp-summary]").innerText()).toMatch(/1 chiusa/);
});

test("ognuna e' disegnata per quello che e'", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await apri(page, testInfo);

  await expect(carta(page, "cover.tapparella")).toHaveAttribute("data-dm-cover-kind", "tapparella");
  await expect(carta(page, "cover.tenda")).toHaveAttribute("data-dm-cover-kind", "tenda");
  await expect(carta(page, "cover.tenda_sole")).toHaveAttribute("data-dm-cover-kind", "tenda_sole");

  // Il telo della tenda da sole non e' quello della tapparella.
  await expect(carta(page, "cover.tapparella").locator(".tapp-shutter")).toHaveCount(1);
  await expect(carta(page, "cover.tenda").locator(".dm-tenda")).toHaveCount(1);
  await expect(carta(page, "cover.tenda_sole").locator(".dm-tendasole")).toHaveCount(1);
  await expect(carta(page, "cover.tenda_sole").locator(".tapp-shutter")).toHaveCount(0);
});
