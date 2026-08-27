/* Le rifiniture chieste subito dopo la 1.3.0, provate sul documento vero.
 *
 * Sono difetti che si vedono solo a plancia accesa: un'icona ripetuta nella
 * barra, un'icona che esce scritta invece che disegnata, una linguetta che si
 * spegne quando un'altra si accende, e una colonna di linguette che prima era
 * una fila.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-salone", name: "Salone", icon: "mdi:sofa" },
      { id: "room-cucina", name: "Cucina", icon: "mdi:chef-hat" },
    ],
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
      name: "Casa Giovanni",
      grid: { power: "sensor.rete_w" },
      plants: [{ id: "imp2", name: "Casa Donato", grid: { power: "sensor.rete2_w" } }],
      metadata: { plant_seq: 2 },
    },
    entityOverrides: { "dm.security_centrale_allarme": "alarm_control_panel.casa" },
  },
  visibility: { home: true, energy: true, security: true, stanze: true },
};

const STATI = [
  {
    entity_id: "sensor.rete_w",
    state: "1200",
    attributes: { friendly_name: "Rete", unit_of_measurement: "W", device_class: "power" },
  },
  {
    entity_id: "sensor.rete2_w",
    state: "300",
    attributes: { friendly_name: "Rete 2", unit_of_measurement: "W", device_class: "power" },
  },
  /* Una centrale che accetta tutto: e' quella che offre piu' tasti da spuntare. */
  {
    entity_id: "alarm_control_panel.casa",
    state: "armed_home",
    attributes: { friendly_name: "Antifurto", supported_features: 1 | 2 | 4 | 16 | 32 },
  },
];

async function boot(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((stati) => {
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        let risultato = null;
        if (messaggio.type === "get_states") risultato = stati;
        if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: risultato,
            }),
          }),
        );
      }
      close() {}
    }
    window.__DASHBOARDMODERN_HOSTED__ = true;
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect
    .poll(() => page.evaluate(() => Boolean(eval("_RAW_STATES")["alarm_control_panel.casa"])))
    .toBe(true);
}

test("nella barra Home e Stanze non portano la stessa icona", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  // La voce Stanze nasce dal modulo, non dal documento: si aspetta che ci sia.
  await expect(page.locator('nav.tabs .tab[data-tab="stanze"]')).toHaveCount(1);
  const icone = await page.$$eval("nav.tabs .tab", (voci) =>
    Object.fromEntries(
      voci.map((b) => [b.dataset.tab, (b.querySelector(".icon")?.textContent || "").trim()]),
    ),
  );
  expect(icone.home).toBeTruthy();
  expect(icone.stanze).toBeTruthy();
  expect(icone.stanze).not.toBe(icone.home);
});

test("le linguette delle stanze disegnano l'icona, non la scrivono", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await page
    .locator('.tab[data-tab="stanze"]')
    .first()
    .evaluate((n) => n.click());
  const linguette = page.locator("#page-stanze .dm-stanze-tab");
  await expect(linguette.first()).toBeVisible();
  const icone = await linguette.evaluateAll((voci) =>
    voci.map((b) => (b.querySelector(".dm-stanze-tab-icon")?.textContent || "").trim()),
  );
  expect(icone.length).toBeGreaterThan(1);
  for (const icona of icone) expect(icona.startsWith("mdi:")).toBe(false);
});

test("scegliere una vista dell'Energia non spegne l'impianto scelto", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((n) => n.click());
  const impianti = page.locator("#dm-impianti-tabs [data-dm-impianto]");
  await expect(impianti).toHaveCount(2);
  await impianti.nth(1).evaluate((n) => n.click());
  await expect(impianti.nth(1)).toHaveClass(/active/);
  // La vista «Giornaliera»: e' il gesto che spegneva tutto.
  await page
    .locator("#page-energy .sub-tabs-container .sub-tab-btn")
    .nth(2)
    .evaluate((n) => n.click());
  await expect(impianti.nth(1)).toHaveClass(/active/);
});

test("le linguette della configurazione stanno in colonna", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  const voci = page.locator("#editor-modal .ed-tab");
  await expect(voci.first()).toBeVisible();
  const inColonna = await voci.evaluateAll((elenco) => {
    const prima = elenco[0].getBoundingClientRect();
    const seconda = elenco[1].getBoundingClientRect();
    return seconda.top > prima.bottom - 2 && Math.abs(seconda.left - prima.left) < 2;
  });
  expect(inColonna).toBe(true);
  // E il corpo della scheda si apre accanto, non sotto.
  const accanto = await page.evaluate(() => {
    const barra = document.querySelector("#editor-modal .ed-tabs").getBoundingClientRect();
    const corpo = document.querySelector("#editor-modal .ed-body").getBoundingClientRect();
    return corpo.left >= barra.right - 2 && corpo.top < barra.bottom;
  });
  expect(accanto).toBe(true);
});

test("si sceglie quali modalità dell'antifurto vedere, e la sezione ubbidisce", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('#editor-modal .ed-tab[data-tab="sez4"]').click();
  const pastiglie = page.locator("#dm-alarm-modes [data-dm-alarm-mode]");
  await expect(pastiglie).toHaveCount(5);
  // Lo sblocco non e' fra le scelte: quello c'e' sempre.
  await expect(page.locator('#dm-alarm-modes [data-dm-alarm-mode="disarm"]')).toHaveCount(0);

  await page.locator('#dm-alarm-modes [data-dm-alarm-mode="vacation"]').click();
  await expect(page.locator('#dm-alarm-modes [data-dm-alarm-mode="vacation"]')).toHaveAttribute(
    "data-on",
    "false",
  );

  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await page
    .locator('.tab[data-tab="security"]')
    .first()
    .evaluate((n) => n.click());
  const tasti = page.locator("#page-security [data-dm-alarm-modes] .dm-sec-mode");
  await expect
    .poll(() => tasti.evaluateAll((voci) => voci.map((b) => b.dataset.mode)))
    .toEqual(["home", "away", "night", "custom", "disarm"]);
});

test("da telefono in piedi la colonna mostra solo i simboli, girato torna il nome", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "e' una regola del telefono");
  await boot(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  const home = page.locator('#editor-modal .ed-tab[data-tab="sez0"]');
  await expect(home).toBeVisible();

  /* Il simbolo e il nome sono due pezzi separati — li divide il modulo delle
     rifiniture da telefono, che di quella linguetta e' il padrone — perche' un
     pezzo di testo solo non si potrebbe dimezzare con un foglio di stile. */
  await expect(home.locator(".dm-beta4-tab-icon")).toHaveCount(1);
  /* Il nome c'e' anche quando non si vede: si legge il testo del nodo, non
     quello dipinto — in verticale quel pezzo e' nascosto apposta. */
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .querySelector('#editor-modal .ed-tab[data-tab="sez0"] .dm-beta4-tab-label')
            ?.textContent?.trim() || "",
      ),
    )
    .toBe("Home");
  // E il nome resta leggibile anche quando non si vede.
  await expect(home).toHaveAttribute("title", "Home");

  const nomeVisibile = () =>
    page.evaluate(() =>
      Boolean(
        document
          .querySelector('#editor-modal .ed-tab[data-tab="sez0"] .dm-beta4-tab-label')
          ?.getBoundingClientRect().width,
      ),
    );
  const larghezzaColonna = () =>
    page.evaluate(() =>
      Math.round(document.querySelector("#editor-modal .ed-tabs").getBoundingClientRect().width),
    );

  // In piedi: solo i simboli, e la colonna si stringe.
  expect(await nomeVisibile()).toBe(false);
  expect(await larghezzaColonna()).toBeLessThan(70);

  // Girato: lo schermo e' largo, il nome torna.
  const schermo = page.viewportSize();
  await page.setViewportSize({ width: schermo.height, height: schermo.width });
  expect(await nomeVisibile()).toBe(true);
  expect(await larghezzaColonna()).toBeGreaterThan(90);
});
