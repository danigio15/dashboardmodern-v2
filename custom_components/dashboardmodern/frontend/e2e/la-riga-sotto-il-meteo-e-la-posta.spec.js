/* La riga sotto il meteo, e la posta che si fa notare (#356, #357).
 *
 * «Una barra sotto la parte meteo che mostra le indicazioni principali. Icona
 * + organico. Lampadina con luci accese. Tapparella con tapparelle aperte
 * ecc.» — e, dallo stesso utente, «animazione quando arriva Posta attivato da
 * un sensore contact».
 *
 * Qui si guarda quello che vede una persona: la riga sta attaccata sotto il
 * meteo, conta le luci accese e le corregge quando una si spegne, sparisce
 * quando non c'e' piu' niente da dire. Poi si configura la cassetta dalla
 * scheda Home, si fa arrivare la posta, e si controlla che la pastiglia si
 * muova e resti li' finche' non la si tocca.
 */
import { expect, test } from "@playwright/test";
import { fillEntityFieldByHand, saveSection } from "./helpers/entity-field.js";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa" }],
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
    people: [],
  },
  visibility: { home: true },
};

/* La cassetta e' ferma da ieri: al primo sguardo non c'e' nessuna notizia. */
const IERI = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

const STATI = [
  { entity_id: "light.salone", state: "on", attributes: { friendly_name: "Salone" } },
  { entity_id: "light.cucina", state: "off", attributes: { friendly_name: "Cucina" } },
  {
    entity_id: "binary_sensor.cassetta_posta",
    state: "off",
    last_changed: IERI,
    last_updated: IERI,
    attributes: { friendly_name: "Cassetta della posta", device_class: "opening" },
  },
];

const pastiglia = (page, chiave) => page.locator(`#dm-casa-riga [data-dm-casa="${chiave}"]`);

/* La configurazione si chiude dalla sua ✕, come la chiude una persona: quella
 * finestra il guscio la toglie dal documento, e togliere la classe da fuori la
 * lascerebbe addosso alla pagina a mangiarsi i tocchi sulla Home. */
async function chiudiLEditor(page) {
  await page.locator("#editor-modal .ed-head-close").click();
  await expect(page.locator("#editor-modal")).toHaveCount(0);
}

/* Gli stati come li vede il runtime: si scrivono nelle due tavole e si batte
 * un colpo, che e' quello che fa girare il disegno della Home. */
async function scrivi(page, voci) {
  await page.evaluate((elenco) => {
    for (const voce of elenco) {
      _RAW_STATES[voce.entity_id] = structuredClone(voce);
      STATES[voce.entity_id] = structuredClone(voce);
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, voci);
}

async function avvia(page, testInfo) {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
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
        if (messaggio.type === "get_states") risultato = haStates;
        else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
        else if (messaggio.type === "call_service") risultato = {};
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
      close() {
        this.readyState = 3;
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  /* Le luci vivono nella loro casella, come in una casa vera. */
  await page.evaluate(() =>
    localStorage.setItem(
      "cd_luci",
      JSON.stringify({ "light.salone": "Salone", "light.cucina": "Cucina" }),
    ),
  );
  await scrivi(page, STATI);
}

test("la riga conta le luci accese, e sta attaccata sotto il meteo", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  await expect(pastiglia(page, "luci")).toContainText("1", { timeout: 20_000 });

  /* Il posto: sotto il meteo, e sopra le pastiglie del guscio — quelle sono il
   * punto da cui l'ordine dei blocchi riparte a impaginare la Home, e una riga
   * infilata sotto di loro finirebbe spinta in fondo alla pagina.
   *
   * «Sotto il meteo» sono due posti che sono lo stesso posto: col meteo ancora
   * nella pagina, subito dopo di lui; col meteo salito nella testata, il primo
   * posto della Home. */
  expect(
    await page.evaluate(() => {
      const riga = document.getElementById("dm-casa-riga");
      const prima = riga?.previousElementSibling;
      return {
        sottoIlMeteo: !prima || prima.classList.contains("weather-widget"),
        dopo: riga?.nextElementSibling?.id,
      };
    }),
  ).toEqual({ sottoIlMeteo: true, dopo: "dashboard-pills-row" });

  /* Si accende la seconda luce: il conto la segue. */
  await scrivi(page, [{ entity_id: "light.cucina", state: "on", attributes: {} }]);
  await expect(pastiglia(page, "luci")).toContainText("2", { timeout: 15_000 });

  /* Si spengono tutte: una riga che dice «0 luci accese» occuperebbe spazio
   * per non dire niente, quindi se ne va del tutto. */
  await scrivi(page, [
    { entity_id: "light.salone", state: "off", attributes: {} },
    { entity_id: "light.cucina", state: "off", attributes: {} },
  ]);
  await expect(page.locator("#dm-casa-riga")).toHaveCount(0, { timeout: 15_000 });
});

test("la posta arriva mentre non si guarda, e resta finche' non la si tocca", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await expect(pastiglia(page, "luci")).toBeVisible({ timeout: 20_000 });

  /* La cassetta si dichiara dalla scheda Home dell'editor, dove si configura
   * il resto della Home. */
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  await expect(page.locator("#ed-body [data-dm-casa-posta]")).toHaveCount(1, { timeout: 15_000 });
  /* La casella dell'entita' sta dietro la matita, come in tutta la
   * configurazione: si fa il gesto che farebbe una persona. */
  await fillEntityFieldByHand(
    page,
    "#ed-body [data-dm-casa-posta]",
    "binary_sensor.cassetta_posta",
  );
  await saveSection(page);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("cd_barra_casa") || "{}").posta),
    )
    .toBe("binary_sensor.cassetta_posta");
  await chiudiLEditor(page);

  /* Appena configurata la cassetta e' chiusa da ieri: nessuna notizia. Chi
   * finisce di configurare il sensore non deve essere accolto da «e' arrivata
   * la posta». */
  await scrivi(page, STATI);
  await expect(pastiglia(page, "posta")).toHaveCount(0);
  /* E la plancia si e' segnata com'era: e' quello scatto che le permettera' di
   * accorgersi dell'apertura di dopo, che nessuno stara' a guardare. */
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("cd_posta_stato") || "{}").cambiatoIl),
    )
    .toBe(Date.parse(IERI));

  /* Il postino apre lo sportello e lo richiude: nessuno stava guardando. Il
   * momento in cui e' tornata chiusa e' piu' recente di quello che la plancia
   * si ricordava, e questo basta a riconoscere che in mezzo c'e' stata
   * un'apertura. */
  await scrivi(page, [
    {
      entity_id: "binary_sensor.cassetta_posta",
      state: "off",
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      attributes: { friendly_name: "Cassetta della posta" },
    },
  ]);
  await expect(pastiglia(page, "posta")).toBeVisible({ timeout: 15_000 });

  /* Si muove: un avviso che non si nota e' un avviso che nessuno vede. */
  expect(
    await pastiglia(page, "posta").evaluate((nodo) => getComputedStyle(nodo).animationName),
  ).toBe("dmPostaChiama");

  /* E resta li' giro dopo giro: la posta non se ne va da sola. */
  for (let giro = 0; giro < 3; giro += 1) {
    await scrivi(page, [{ entity_id: "light.cucina", state: giro % 2 ? "on" : "off" }]);
    await expect(pastiglia(page, "posta")).toBeVisible();
  }

  /* «L'ho ritirata»: si tocca, e torna a riposo. */
  await pastiglia(page, "posta").click();
  await expect(pastiglia(page, "posta")).toHaveCount(0);
  await scrivi(page, [{ entity_id: "light.salone", state: "on", attributes: {} }]);
  await expect(pastiglia(page, "luci")).toBeVisible({ timeout: 15_000 });
  await expect(pastiglia(page, "posta")).toHaveCount(0);
});

test("una voce spenta nella scheda Home sparisce dalla riga", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await expect(pastiglia(page, "luci")).toBeVisible({ timeout: 20_000 });

  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  const casella = page.locator('#ed-body [data-dm-casa-voce="luci"]');
  await expect(casella).toBeVisible({ timeout: 15_000 });
  await casella.uncheck();
  await saveSection(page);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("cd_barra_casa") || "{}").voci?.luci),
    )
    .toBe(false);
  await chiudiLEditor(page);

  await scrivi(page, STATI);
  await expect(page.locator("#dm-casa-riga")).toHaveCount(0, { timeout: 15_000 });
});
