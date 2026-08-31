/* La pagina Stanze, sulla plancia vera.
 *
 * Il modello si prova senza browser; qui si prova che la pagina esce, che le
 * pillole cambiano stanza, che dentro ci finiscono le card vere delle sezioni —
 * la luce e' la card della pagina Luci, non una copia — e che la scena della
 * stanza tocca le luci di QUELLA stanza e nessun'altra.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LUCI = {
  "light.faretti_dx": "Salone - Faretti destra",
  "light.faretti_sx": "Salone - Faretti sinistra",
  "light.lampadario_cucina": "Lampadario Cucina",
  "light.orfana": "Luce senza stanza",
};
const STANZE_LUCI = {
  "light.faretti_dx": "Salone",
  "light.faretti_sx": "Salone",
  "light.lampadario_cucina": "Cucina",
};

const seme = {
  schema_version: 4,
  sections: {
    rooms: [
      { name: "Salone", icon: "🛋️", temp: "sensor.t_salone", hum: "sensor.h_salone" },
      { name: "Cucina", icon: "🍴" },
      { name: "Cameretta", icon: "🛏️" },
    ],
    cameras: [{ name: "Salone", entity: "camera.salone", room: "Salone" }],
    appliances: [{ name: "Lavastoviglie", entity: "sensor.lavastoviglie", room: "Cucina" }],
    loads: [],
    climate: [{ name: "Condizionatore salone", entity: "climate.salone", room: "Salone" }],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
    covers: [{ name: "Tapparella salone", entity: "cover.tapp_salone", room: "Salone" }],
    prese: [{ name: "TV Salotto", entity: "switch.tv_salotto", room: "Salone" }],
  },
  visibility: { home: true, stanze: true },
};

const stati = {
  "sensor.t_salone": { state: "29.2", attributes: {} },
  "sensor.h_salone": { state: "56", attributes: {} },
  "light.faretti_dx": { state: "off", attributes: { supported_color_modes: ["brightness"] } },
  "light.faretti_sx": { state: "off", attributes: { supported_color_modes: ["brightness"] } },
  "light.lampadario_cucina": { state: "off", attributes: {} },
  "light.orfana": { state: "off", attributes: {} },
  "climate.salone": { state: "cool", attributes: {} },
  "cover.tapp_salone": { state: "open", attributes: { current_position: 60 } },
  "camera.salone": { state: "idle", attributes: {} },
  "switch.tv_salotto": { state: "on", attributes: {} },
};

async function apri(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s, luci, stanze }) => {
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.__DM_CHIAMATE__ = [];
      window.cdCallServiceJson = (domain, service, data) =>
        window.__DM_CHIAMATE__.push({ domain, service, data });
      window.localStorage.setItem("cd_luci", JSON.stringify(luci));
      window.localStorage.setItem("cd_luci_rooms", JSON.stringify(stanze));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: stati, luci: LUCI, stanze: STANZE_LUCI },
  );
  await page.locator('.tab[data-tab="stanze"]').first().click();
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);
}

test("ogni stanza porta quello che le appartiene, e le sue luci sono le card vere", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo);
  const salone = page.locator('#page-stanze [data-dm-stanza="room-salone"]');
  await expect(salone).toHaveClass(/active/);

  // La luce non e' una card nuova: e' quella della pagina Luci, col suo
  // cursore. E la presa della TV sta qui con la stessa card, senza cursore:
  // «la sezione Prese non viene riportata dentro Stanze».
  await expect(page.locator("#page-stanze .dm-lucip-card")).toHaveCount(3);
  await expect(page.locator("#page-stanze [data-dm-lucip-brightness]")).toHaveCount(2);
  await expect(page.locator("#page-stanze")).toContainText("TV Salotto");
  await expect(page.locator("#page-stanze")).toContainText(/Prese|Plugs/);
  // E il clima parla italiano, non `cool`.
  await expect(page.locator("#page-stanze")).toContainText(/Raffredda|Cooling/);
  await expect(page.locator("#page-stanze")).toContainText("29.2°");

  // Un'altra stanza, un altro contenuto: la cucina ha una luce e un elettrodomestico.
  await page.locator('#page-stanze [data-dm-stanza="room-cucina"]').click();
  await expect(page.locator("#page-stanze .dm-lucip-card")).toHaveCount(1);
  await expect(page.locator("#page-stanze")).toContainText("Lavastoviglie");

  /* La luce che non ha stanza non sparisce: sta sotto la sua pillola, che e'
   * la sola occasione di accorgersi di aver dimenticato un'assegnazione. */
  await page.locator('#page-stanze [data-dm-stanza="dm-senza-stanza"]').click();
  await expect(page.locator("#page-stanze")).toContainText("Luce senza stanza");
});

test("la scena accende le luci di quella stanza, e nessun'altra", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  await expect(page.locator("#page-stanze [data-dm-stanza-scena='on']")).toBeVisible();
  await page.locator("#page-stanze [data-dm-stanza-scena='on']").click();
  const chiamate = await page.evaluate(() => window.__DM_CHIAMATE__);
  const toccate = chiamate.map((chiamata) => chiamata.data?.entity_id).sort();
  assertUguale(toccate, ["light.faretti_dx", "light.faretti_sx"]);
  for (const chiamata of chiamate) expect(chiamata.service).toBe("turn_on");

  function assertUguale(avuto, atteso) {
    expect(avuto).toEqual(atteso);
  }
});

test("una stanza senza luci non offre una scena che non farebbe niente", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo);
  await page.locator('#page-stanze [data-dm-stanza="room-cameretta"]').click();
  await expect(page.locator("#page-stanze [data-dm-stanza-scena]")).toHaveCount(0);
  await expect(page.locator("#page-stanze")).toContainText(/non ha ancora niente|Nothing here yet/);
});

/* La luce si accende da qui, non solo si guarda.
 *
 * La card della luce e' la stessa della pagina Luci — stessa forma, stesso
 * cursore — ma il gesto era rimasto legato a quella pagina: il gestore
 * pretendeva che il tocco venisse da dentro il suo recinto, e qui il recinto
 * non c'e'. Si vedeva l'interruttore, si premeva, e non succedeva niente.
 * Segnalato esattamente cosi'. Il cursore della luminosita' invece ha sempre
 * funzionato, perche' il suo gestore guarda la card: era il recinto a essere
 * di troppo, non la card a essere nel posto sbagliato.
 */
test("l'interruttore della luce comanda anche dalla pagina Stanze", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  const carta = page.locator('#page-stanze [data-dm-lucip="light.faretti_sx"]');
  await expect(carta).toHaveCount(1);
  await carta.locator("[data-dm-lucip-toggle]").click();

  const chiamate = await page.evaluate(() => window.__DM_CHIAMATE__);
  expect(chiamate.length).toBeGreaterThan(0);
  const ultima = chiamate[chiamate.length - 1];
  expect(ultima.data?.entity_id).toBe("light.faretti_sx");
  expect(ultima.service).toBe("turn_on");
});

/* E si comanda anche quello che una stanza si e' presa a mano.
 *
 * Le luci hanno la card vera della pagina Luci, e quella si e' sempre comandata.
 * Tutto il resto — un'entita' assegnata a mano a una stanza, una presa, un
 * ventilatore — era una riga che portava nella sezione e basta: si toccava e
 * non succedeva niente. «Le entita' nelle stanze continuano a non funzionare:
 * non mi dice se dopo clicco la luce e' accesa.» Adesso quello che si accende e
 * si spegne ha il suo interruttore qui, e la riga dice subito com'e' andata.
 */
test("una presa assegnata a mano si accende dalla pagina Stanze", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  await page.evaluate(() => {
    // Il documento aggiunge da solo il prefisso della plancia alle chiavi.
    localStorage.setItem(
      "cd_stanze_entita",
      JSON.stringify({ "switch.presa_salone": "room-salone" }),
    );
    const grezzi = eval("_RAW_STATES");
    grezzi["switch.presa_salone"] = {
      entity_id: "switch.presa_salone",
      state: "off",
      attributes: { friendly_name: "Presa salone" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator('#page-stanze [data-dm-stanza="room-salone"]').click();

  const interruttore = page.locator('#page-stanze [data-dm-stanza-tocca="switch.presa_salone"]');
  await expect(interruttore).toHaveCount(1);
  await expect(interruttore).toHaveAttribute("aria-checked", "false");
  await interruttore.click();

  const chiamate = await page.evaluate(() => window.__DM_CHIAMATE__);
  const ultima = chiamate[chiamate.length - 1];
  expect(ultima.domain).toBe("switch");
  expect(ultima.service).toBe("turn_on");
  expect(ultima.data?.entity_id).toBe("switch.presa_salone");
  await expect(interruttore).toHaveAttribute("aria-checked", "true");
});
