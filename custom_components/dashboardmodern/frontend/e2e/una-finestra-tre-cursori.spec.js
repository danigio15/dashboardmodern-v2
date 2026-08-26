/* «I 3 cursori, uno per ogni entita', sotto la foto della finestra.»
 *
 * Una riga di configurazione con tapparella, tenda e tenda da sole e' UNA
 * finestra: le tre coperture uscivano invece come tre card separate, e sotto
 * la foto della finestra il cursore restava uno solo. Adesso la card e' una,
 * la finestra disegna tutti i teli insieme, e sotto ci sono tre cursori — uno
 * per copertura, ciascuno con la sua etichetta, la sua percentuale e il suo
 * comando.
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
      {
        id: "w1",
        name: "Camera",
        entity: "cover.tapparella",
        tenda: "cover.tenda",
        tendaSole: "cover.tenda_sole",
      },
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

test("una card sola, tre cursori, e ognuno con la sua percentuale", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await apri(page, testInfo);

  // Una riga, UNA card — non tre.
  await expect(page.locator("[data-dm-shutter-card]")).toHaveCount(1);
  const card = page.locator("[data-dm-shutter-card]");
  await expect(card).toHaveAttribute("data-dm-covers", "3");

  // Tutti e tre i teli dentro la stessa finestra.
  await expect(card.locator(".tapp-win .tapp-shutter")).toHaveCount(1);
  await expect(card.locator(".tapp-win .dm-tenda")).toHaveCount(1);
  await expect(card.locator(".tapp-win .dm-tendasole")).toHaveCount(1);

  // Tre cursori sotto la finestra, ciascuno con etichetta e percentuale sua.
  await expect(card.locator("[data-dm-position]")).toHaveCount(3);
  await expect(card.locator(".dm-tapp-bar-label")).toHaveCount(3);
  for (const [entity, posizione] of [
    ["cover.tapparella", "70"],
    ["cover.tenda", "35"],
    ["cover.tenda_sole", "0"],
  ]) {
    const cursore = card.locator(`[data-dm-position][data-dm-entity="${entity}"]`);
    await expect(cursore).toHaveCount(1);
    await expect.poll(() => cursore.inputValue()).toBe(posizione);
    await expect(card.locator(`[data-dm-readout][data-dm-entity="${entity}"]`)).toHaveText(
      `${posizione}%`,
    );
  }

  /* Ogni barra colora la SUA posizione: il riempimento non e' piu' quello
   * della principale copiato tre volte. */
  await expect
    .poll(() =>
      card
        .locator('[data-dm-bar="cover.tenda"] .dm-tapp-track')
        .evaluate((nodo) => nodo.style.getPropertyValue("--tapp-open")),
    )
    .toBe("0.35");

  // Il conteggio in cima conta le coperture, non le card.
  await expect.poll(() => page.locator("[data-dm-tapp-summary]").innerText()).toMatch(/2 aperte/);
});

test("il cursore della tenda comanda la tenda, non la tapparella", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await apri(page, testInfo);

  const chiamate = [];
  await page.exposeFunction("registraChiamata", (dominio, servizio, dati) => {
    chiamate.push({ dominio, servizio, dati });
  });
  await page.evaluate(() => {
    window.dmCallHaService = async (dominio, servizio, dati) => {
      await window.registraChiamata(dominio, servizio, dati);
    };
  });

  const cursore = page.locator('[data-dm-position][data-dm-entity="cover.tenda"]');
  await cursore.fill("80");
  await cursore.dispatchEvent("change");

  await expect
    .poll(async () => page.evaluate(() => undefined).then(() => chiamate.length))
    .toBeGreaterThan(0);
  expect(chiamate[0]).toEqual({
    dominio: "cover",
    servizio: "set_cover_position",
    dati: { entity_id: "cover.tenda", position: 80 },
  });

  // E la percentuale mostrata e' quella appena chiesta, sulla barra giusta.
  await expect(page.locator('[data-dm-readout][data-dm-entity="cover.tenda"]')).toHaveText("80%");
  await expect(page.locator('[data-dm-readout][data-dm-entity="cover.tapparella"]')).toHaveText(
    "70%",
  );
});

test("la stessa entita' in tre caselle viene fermata, con la spiegazione", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  /* Il test dell'utente, alla lettera: un'unica cover scritta in tutte e tre
   * le caselle "per vedere i 3 cursori". La pagina accorpa i duplicati — una
   * copertura sola — e prima il modale salvava in silenzio: card unica, un
   * cursore, e nessuno che dicesse perche'. Adesso lo dice. */
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...seme,
    sections: {
      ...seme.sections,
      covers: [{ id: "w1", name: "Bagno", entity: "cover.tapparella" }],
    },
  });
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("tapp");
  });
  await page.locator('[data-dm-edit-kind="shutter"][data-dm-edit-index="0"]').first().click();
  const modale = page.locator("#dm-shutter-editor-modal");
  await expect(modale).toBeVisible();
  for (const campo of ["tenda", "tendaSole"]) {
    await modale.locator(`input[name=${campo}]`).evaluate((input) => {
      input.value = "cover.tapparella";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await modale.locator("form").evaluate((form) => form.requestSubmit());
  await expect(modale.locator("[data-error]")).toHaveText(/stessa entità.*una copertura sola/i);
  // E la riga NON e' stata salvata con i duplicati.
  const riga = await page.evaluate(() => window.getTapparelle()[0]);
  expect(riga.tenda || "").toBe("");
});
