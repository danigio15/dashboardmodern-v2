/* «Come si aggiunge l'entità per la porta? Non ci sono riuscito nemmeno
 * nell'ultima versione» (#471, dopo la chiusura).
 *
 * E, nello stesso filo: «in generale, se su ogni elettrodomestico si potesse
 * aggiungere un'entità dandole un nome — io nell'asciugatrice monitoro
 * temperatura aria e umidità residua per evitare che me li stropicci troppo —
 * e sul frigorifero uso sensori zigbee su entrambe le porte».
 *
 * Questa prova fa il gesto intero, sulla scheda vera: apre l'apparecchio,
 * guarda che il cassetto dica dov'è la porta, aggiunge una lettura, salva, e
 * poi apre la finestra dell'apparecchio e pretende di ritrovarcela — col suo
 * nome e la sua unità, non con l'entity_id e non con «on».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STATI = [
  {
    entity_id: "switch.asciugatrice",
    state: "on",
    attributes: { friendly_name: "Asciugatrice", device_class: "outlet" },
  },
  {
    entity_id: "sensor.asciugatrice_power",
    state: "1400",
    attributes: { friendly_name: "Asciugatrice power", unit_of_measurement: "W" },
  },
  {
    entity_id: "sensor.asciugatrice_umidita_residua",
    state: "12",
    attributes: {
      friendly_name: "Asciugatrice Umidità residua",
      unit_of_measurement: "%",
      device_class: "humidity",
    },
  },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-lavanderia", name: "Lavanderia", icon: "mdi:washing-machine" }],
    appliances: [
      {
        id: "appliance-asciugatrice",
        name: "Asciugatrice",
        device_type: "generico",
        icon: "generico",
        visual_type: "asset",
        visual_key: "generico",
        room_id: "room-lavanderia",
        control_entity: "switch.asciugatrice",
        power_entity: "sensor.asciugatrice_power",
        entities: ["switch.asciugatrice", "sensor.asciugatrice_power"],
        threshold_run: 5,
      },
    ],
    loads: [],
  },
  visibility: { appliances: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60_000,
  });
  await page.evaluate((stati) => {
    for (const voce of stati) {
      eval("_RAW_STATES")[voce.entity_id] = structuredClone(voce);
      if (typeof STATES !== "undefined") STATES[voce.entity_id] = structuredClone(voce);
    }
    window.applyStates?.();
  }, STATI);
}

test("la lettura si aggiunge, si salva e si rivede nella finestra", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);

  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("appliances");
    window.edApplEdit(0);
  });
  const modulo = page.locator("#dm-appliance-editor-modal");
  await expect(modulo).toBeVisible({ timeout: 20_000 });

  /* 1. Il cassetto dice dov'è la porta: era li' anche prima, e il suo titolo
   *    elencava quattro cose fra cui la porta non c'era. */
  await expect(modulo.locator(".dm-appliance-card-fields > summary")).toContainText(/porta|door/i);

  /* 2. La fila delle letture c'è, ed è vuota: lo dice con una frase, non con
   *    il nulla. */
  const letture = modulo.locator("[data-appl-letture]");
  await expect(letture).toHaveCount(1);
  await expect(letture.locator(".dm-appl-cmd-vuoto")).toHaveCount(1);

  /* 3. Si aggiunge. La casella dell'id sta dietro la matita, come in tutti i
   *    campi che vogliono un'entità: la scheda di casa mette la sua pastiglia
   *    «Scegli entità» e la matita per scriverla a mano. */
  await letture.locator(".dm-chip-manual").first().click();
  const casellaId = letture.locator("[data-appl-lettura-nuova]");
  await expect(casellaId).toBeVisible({ timeout: 10_000 });

  /* Un'entità che non si legge viene rifiutata con il suo perché, invece di
   * entrare e non dire niente. */
  await casellaId.fill("switch.asciugatrice");
  await letture.locator("[data-appl-let-add]").click();
  await expect(letture.locator("[data-appl-let-error]")).not.toBeEmpty();
  await expect(letture.locator("[data-appl-let-del]")).toHaveCount(0);

  await casellaId.fill("sensor.asciugatrice_umidita_residua");
  await letture.locator("[data-appl-let-add]").click();
  const pastiglia = letture.locator("[data-appl-let-del]");
  await expect(pastiglia).toHaveCount(1);
  /* La pastiglia porta il nome senza «Asciugatrice» davanti: la scheda è già
   * la sua. */
  await expect(pastiglia).toContainText(/Umidità residua/i);

  /* 4. Si salva, e quello che resta scritto è l'entità, non la pastiglia. */
  await modulo.locator("button[type=submit]").click();
  await expect(modulo).toHaveCount(0, { timeout: 20_000 });
  const salvato = await page.evaluate(() => {
    const stato = JSON.parse(window.localStorage.getItem("dm_dashboard_state") || "{}");
    return stato?.sections?.appliances?.[0]?.letture || null;
  });
  expect(salvato).toEqual(["sensor.asciugatrice_umidita_residua"]);

  /* 5. E si rivede nella finestra dell'apparecchio, col nome e l'unità: non
   *    l'entity_id, non «on», non un numero nudo. */
  await page.evaluate(() => {
    document.querySelectorAll(".ed-modal, #dm-appliance-editor-modal").forEach((n) => n.remove());
    window.apriApplianceDetail?.(0);
  });
  const elenco = page.locator("#details-list");
  const casella = elenco.locator(".dm-apde-casella", { hasText: "Umidità residua" });
  await expect(casella).toHaveCount(1, { timeout: 20_000 });
  await expect(casella).toContainText("12 %");
  /* Sotto il titoletto giusto, che è quello che chi configura ha scelto. */
  await expect(elenco).toContainText(/Altre letture|Other readings/);
});
