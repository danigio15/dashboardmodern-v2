import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Una sola entita' con segno per la rete e una per la batteria.
 *
 * Chi ha un inverter che pubblica un solo sensore — positivo quando preleva,
 * negativo quando immette — non aveva modo di dirlo: la maschera chiedeva i due
 * versi in due pagine, e mettendo la stessa entita' in tutte e due la mappa
 * sommava il prelievo all'immissione. Qui si verifica che dichiararla una volta
 * basti, e che il verso segua il segno. */
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
    energy: {
      grid: { signed: { power: "sensor.rete_w", daily: "sensor.rete_oggi", positive: "import" } },
      battery: { signed: { power: "sensor.batt_w", positive: "charge" } },
      solar: { power: "sensor.fv_w" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

async function pubblicaStati(page, valori) {
  await page.evaluate((letture) => {
    const stati = Object.fromEntries(
      Object.entries(letture).map(([id, [valore, unita]]) => [
        id,
        { entity_id: id, state: String(valore), attributes: { unit_of_measurement: unita } },
      ]),
    );
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, valori);
}

function letturaSlot(page, slot) {
  return page.evaluate((riferimento) => {
    const stato = window.eval(
      `typeof STATES !== "undefined" ? STATES[${JSON.stringify(riferimento)}] : null`,
    );
    return stato ? String(stato.state) : null;
  }, slot);
}

test.describe("energia con una sola entita' con segno", () => {
  test("il segno decide il verso, senza una seconda entita' da configurare", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);

    // Positivo: la rete sta prelevando, l'immissione e' ferma a zero.
    await pubblicaStati(page, {
      "sensor.rete_w": [1800, "W"],
      "sensor.rete_oggi": [7.4, "kWh"],
      "sensor.batt_w": [900, "W"],
      "sensor.fv_w": [0, "W"],
    });
    await expect.poll(() => letturaSlot(page, "dm.energy_energia_prelevata_oggi")).toBe("7.4");
    await expect.poll(() => letturaSlot(page, "dm.energy_energia_immessa_oggi")).toBe("0");
    // La potenza di rete arriva dall'entita' cosi' com'e': il verso e' gia' quello giusto.
    await expect.poll(() => letturaSlot(page, "dm.energy_potenza_scambio_rete")).toBe("1800");
    // La batteria ha i positivi in carica: il runtime li vuole al contrario.
    await expect.poll(() => letturaSlot(page, "dm.energy_potenza_batteria")).toBe("-900");

    // Negativo: la stessa entita', senza toccare la configurazione, diventa immissione.
    await pubblicaStati(page, {
      "sensor.rete_w": [-2400, "W"],
      "sensor.rete_oggi": [-3.2, "kWh"],
      "sensor.batt_w": [-450, "W"],
    });
    await expect.poll(() => letturaSlot(page, "dm.energy_energia_prelevata_oggi")).toBe("0");
    await expect.poll(() => letturaSlot(page, "dm.energy_energia_immessa_oggi")).toBe("3.2");
    await expect.poll(() => letturaSlot(page, "dm.energy_potenza_scambio_rete")).toBe("-2400");
    await expect.poll(() => letturaSlot(page, "dm.energy_potenza_batteria")).toBe("450");
  });

  test("la maschera dichiara la sorgente una volta e spegne le caselle dei due versi", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("energy");
    });

    // La sorgente unica sta nella prima delle due pagine della rete: si apre
    // quella, come farebbe chi va a configurarla.
    await page.evaluate(() => {
      document
        .querySelector('[data-energy-signed="grid"]')
        ?.closest("details.ed-acc")
        ?.setAttribute("open", "");
    });

    const card = page.locator('[data-energy-signed="grid"]');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-state", "on");
    await expect(card.locator("#dm-energy-signed-grid-power")).toHaveValue("sensor.rete_w");
    await expect(card.locator("#dm-energy-signed-grid-daily")).toHaveValue("sensor.rete_oggi");

    // Le caselle dei due versi restano visibili ma spente: chi le guarda deve
    // capire da dove arriva il valore, non credere che manchi la configurazione.
    const prelievo = page.locator("#dm-energy-grid-daily_import_energy");
    await expect(prelievo).toBeDisabled();
    await expect(page.locator("#dm-energy-grid-daily_export_energy")).toBeDisabled();
    await expect(page.locator(".ed-slot[data-energy-signed-managed]").first()).toBeVisible();

    // Il contatore totale non e' governato dalla sorgente unica: resta scrivibile.
    await expect(page.locator("#dm-energy-grid-total_import_energy")).toBeEnabled();
  });

  /* Il configuratore che non voleva saperne di tenere i sensori giusti.
   *
   * Le entita' scritte nella maschera finivano in una bozza presa all'apertura
   * e ci restavano finche' non si premeva "Salva Energia". Chi le compilava e
   * poi passava a un'altra sezione della configurazione — per tornare subito
   * dopo, o per finire un altro pezzo — ritrovava i campi vuoti: la maschera si
   * ridisegna dal modello, e nel modello non era mai arrivato niente. Adesso
   * ogni campo si salva quando lo si lascia. */
  test("i sensori scritti restano anche cambiando sezione senza premere Salva", async ({
    page,
  }, testInfo) => {
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
      ...seed,
      sections: { ...seed.sections, energy: {} },
    });
    await page.evaluate(() => {
      window.apriConfigEntita();
      window.editorSwitch("energy");
    });

    await page.evaluate(() => {
      const input = document.querySelector("#dm-energy-grid-daily_import_energy");
      input.value = "sensor.prelievo_oggi";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Via e ritorno, senza passare dal bottone Salva.
    await page.evaluate(() => window.editorSwitch("sez0"));
    await page.evaluate(() => window.editorSwitch("energy"));

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.DashboardModernModules?.store?.getSection?.("energy")?.grid
              ?.daily_import_energy || "",
        ),
      )
      .toBe("sensor.prelievo_oggi");
    await expect(page.locator("#dm-energy-grid-daily_import_energy")).toHaveValue(
      "sensor.prelievo_oggi",
    );
  });
});
