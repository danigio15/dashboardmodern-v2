/* «Le entità configurate diverse sui due impianti, soprattutto i carichi, poi
 * si mescolano con i due impianti.»
 *
 * Lo specchio `cd_flow_nodes` ha cinque caselle posizionali — «boiler», «wb»,
 * «clima», «lav», «cuc» — nate quando gli impianti erano uno solo, e portano
 * il nome, l'icona E l'entità della potenza. Con due impianti i cerchi del
 * secondo occupano le stesse caselle del primo: la maschera dei carichi della
 * casa di sopra mostrava il boiler della casa di sotto, col suo sensore.
 *
 * Il flusso disegnato aveva già smesso di leggerle; questa è la maschera da
 * cui si SALVA, ed è lì che il travaso diventava permanente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [], cameras: [], appliances: [], lights: [], climate: [], ev: [], covers: [],
    pool: {}, irrigation: { zones: [] },
    loads: [
      { id: "boiler", name: "Boiler", icon: "🔥", power_entity: "sensor.boiler1_w", order: 0 },
      {
        id: "pompa",
        name: "Pompa di calore",
        icon: "❄️",
        power_entity: "sensor.pompa2_w",
        order: 0,
        plant: "impianto-2",
      },
    ],
    energy: {
      name: "Casa sotto",
      grid: { power: "sensor.rete_w" },
      solar: { power: "sensor.fv_w" },
      house: { power: "sensor.casa_w" },
      plants: [
        {
          id: "impianto-2",
          name: "Casa sopra",
          grid: { power: "sensor.rete2_w" },
          solar: { power: "sensor.fv2_w" },
          house: { power: "sensor.casa2_w" },
        },
      ],
      metadata: { plant_seq: 2 },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* Lo specchio della casa di sotto, scritto da una versione in cui l'impianto
 * era uno solo: è la configurazione vera di chi segnala. */
const SPECCHIO = {
  boiler: { name: "Boiler casa sotto", icon: "🔥", color: "#ea580c", pwr: "sensor.boiler1_w" },
};

test("i carichi della casa di sopra portano i loro sensori, non quelli di sotto", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }).catch(() => {}));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((specchio) => {
    localStorage.setItem("cd_flow_nodes", JSON.stringify(specchio));
    /* La casa di sopra è quella aperta: è il caso della segnalazione. */
    localStorage.setItem("cd_energy_plant", "impianto-2");
  }, SPECCHIO);

  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    try {
      editorSwitch("energy");
    } catch (_errore) {}
  });
  const linguetta = page
    .locator("#editor-modal .ed-inner-tab")
    .filter({ hasText: /CARICHI E DISPOSITIVI|LOADS & DEVICES/i })
    .first();
  await linguetta.waitFor({ state: "visible", timeout: 20_000 });
  await linguetta.click();
  await expect(page.locator('#editor-modal [data-energy-panel="loads"]')).toHaveAttribute(
    "data-dm-loads-editor",
    "true",
    { timeout: 20_000 },
  );

  /* Il cerchio che si sta configurando è quello della casa di sopra, con il
   * SUO sensore nella sua casella. */
  await expect(page.locator("#dm-loads-pompa-power")).toHaveValue("sensor.pompa2_w", {
    timeout: 20_000,
  });

  /* E il boiler della casa di sotto non è entrato: né il suo nome né il suo
   * sensore, che è la metà che «Salva carichi» scriveva addosso. */
  const dentro = await page.evaluate(() => {
    const pannello = document.querySelector('#editor-modal [data-energy-panel="loads"]');
    const valori = [...pannello.querySelectorAll("input")].map((campo) => campo.value);
    return { valori, testo: (pannello.textContent || "").replace(/\s+/g, " ") };
  });
  expect(dentro.valori).not.toContain("sensor.boiler1_w");
  expect(dentro.valori).not.toContain("Boiler casa sotto");
  expect(dentro.testo).not.toContain("Boiler casa sotto");
});
