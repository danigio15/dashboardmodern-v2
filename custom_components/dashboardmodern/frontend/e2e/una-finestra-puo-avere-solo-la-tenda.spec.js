import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «Su una finestra ci stanno tutte e tre: compila le caselle che hai.»
 *
 * Lo dice la scheda, sotto le caselle. Poi si compilava la sola tenda, si
 * premeva «Aggiungi tapparella», e usciva «Inserisci una entità cover valida»:
 * il runtime guarda la sua casella, quella della tapparella, e di tenda e tenda
 * da sole non sa niente. La riga la scriveva comunque il nostro giro un istante
 * dopo — quindi si finiva con un errore in faccia *e* la riga creata lo stesso,
 * che è il modo peggiore di dire che ha funzionato.
 */
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
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

test("una finestra con la sola tenda si aggiunge, e senza errori in faccia", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  const avvisi = [];
  page.on("dialog", (finestra) => {
    avvisi.push(finestra.message());
    finestra.accept();
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("tapp");
  });
  await expect(page.locator("#ed-tp-tenda")).toHaveCount(1);

  await page.evaluate(() => {
    const scrivi = (id, valore) => {
      const campo = document.getElementById(id);
      campo.value = valore;
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    };
    scrivi("ed-tp-name", "Bagno");
    scrivi("ed-tp-tenda", "cover.tenda_bagno");
    window.edTappAdd();
  });

  await expect.poll(() => page.evaluate(() => window.getTapparelle().length)).toBe(1);
  expect(avvisi, "il runtime ha rifiutato quello che la scheda invita a fare").toEqual([]);
  expect(await page.evaluate(() => window.getTapparelle()[0].tenda)).toBe("cover.tenda_bagno");

  // E la matita la riapre: si salva anche senza la casella della tapparella.
  const matita = page.locator('[data-dm-edit-kind="shutter"][data-dm-edit-index="0"]');
  await expect(matita).toHaveCount(1);
  await matita.first().click();
  const modale = page.locator("#dm-shutter-editor-modal");
  await expect(modale).toBeVisible();
  await expect(modale.locator("input[name=entity]")).toHaveValue("");
  await modale.locator("form").evaluate((form) => form.requestSubmit());
  await expect(modale).toHaveCount(0, { timeout: 5000 });
});

/* La pastiglia dice quello che si vede.
 *
 * Il riquadro in cima conta le chiuse dalla posizione, la card disegna la
 * finestra dalla posizione, e la pastiglia diceva invece lo stato che manda
 * Home Assistant. Certe coperture restano su `open` anche a zero per cento: si
 * leggeva «1 chiusa» in cima e «Aperta» sulla card, con la tapparella disegnata
 * tutta giù.
 */
test("a zero per cento la pastiglia dice chiusa, come il conteggio", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...seme,
    sections: {
      ...seme.sections,
      covers: [{ id: "c1", name: "Bagno", entity: "cover.tapparella_bagno" }],
    },
  });

  await page.evaluate(() => {
    const valori = {
      "cover.tapparella_bagno": {
        entity_id: "cover.tapparella_bagno",
        // Lo stato dice aperta, la posizione dice chiusa: succede.
        state: "open",
        attributes: { device_class: "shutter", current_position: 0, supported_features: 15 },
      },
    };
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    document.querySelectorAll(".page").forEach((nodo) => nodo.classList.remove("active"));
    document.getElementById("page-tapparelle")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

  const carta = page.locator('[data-dm-shutter-card][data-tapp="cover.tapparella_bagno"]');
  await expect(carta).toHaveCount(1);
  await expect(carta.locator(".tapp-state").first()).toHaveText(/chiusa/i);
});
