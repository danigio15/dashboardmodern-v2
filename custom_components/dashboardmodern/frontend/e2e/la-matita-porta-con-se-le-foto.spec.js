/* «Le foto si mischiano di nuovo se sono piu' di una vettura configurata.»
 *
 * Con due auto, la matita apre la seconda per configurarla. Il pannello delle
 * foto pero' restava indietro: titolo e campi continuavano a dire la PRIMA, e
 * «Salva foto» scriveva quei percorsi sulla vettura appena aperta. La foto del
 * cavo attaccato della B10 finiva sulla T03 — misurata, non supposta — e il
 * titolo sbagliato faceva da alibi.
 *
 * Qui si guarda quello che vede chi configura: aprire un'auto porta con se' le
 * SUE foto, salvare tocca solo lei, riaprire la configurazione ricomincia
 * dall'auto in uso, e la scheda di una vettura che non esiste ancora non porta
 * il nome di nessuna.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
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
  visibility: { home: true, ev: true },
};

const DUE_AUTO = [
  {
    name: "B10",
    uid: "b10",
    brand: "Leapmotor",
    model: "B10",
    ov: { "dm.ev_batteria_auto": "sensor.b10_battery" },
    img: "/local/ev/b10-idle.png",
    imgPlugged: "/local/ev/b10-cavo.png",
  },
  {
    name: "T03",
    uid: "t03",
    brand: "Leapmotor",
    model: "T03",
    ov: { "dm.ev_batteria_auto": "sensor.t03_battery" },
    img: "/local/ev/t03-idle.png",
    imgPlugged: "/local/ev/t03-cavo.png",
  },
];

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 40_000,
  });
  await page.evaluate((elenco) => {
    localStorage.setItem("cd_ev_cars", JSON.stringify(elenco));
    /* La B10 e' quella in uso: la seconda si apre solo con la matita, ed e'
     * proprio quella la differenza che si prova qui. */
    window.cdEvApplyCar(0);
  }, DUE_AUTO);
  await page.waitForTimeout(800);
}

async function apriLaScheda(page) {
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await page.evaluate(() => {
    const accordion = [...document.querySelectorAll("#ed-body details.ed-acc")].find((node) =>
      node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
    );
    if (accordion) accordion.open = true;
  });
  await expect(page.locator("#ed-body [data-ev-photos]")).toHaveCount(1);
  /* E si lascia posare, come fa chi la scheda la legge prima di toccarla.
   *
   * Non e' un'attesa di comodo: e' la differenza fra le due facce del difetto.
   * Aprire la configurazione mette in coda qualche passata di assestamento —
   * l'ultima quasi due secondi dopo — e una matita premuta dentro quella
   * finestra si faceva ridisegnare il pannello di rimbalzo, per caso. Fuori
   * dalla finestra, cioe' appena qualcuno si prende il tempo di guardare la
   * scheda, non lo ridisegnava piu' nessuno: misurato, il pannello restava
   * sull'auto sbagliata per sempre. E' li' che vive la segnalazione. */
  await page.waitForTimeout(2500);
}

const campo = (page, kind) =>
  page.locator(`#ed-body [data-ev-photos] [data-ev-photo="${kind}"] [data-ev-photo-input]`);

/* Due fotogrammi, e poi si guarda.
 *
 * Non e' pignoleria sui millisecondi: e' il tempo che passa fra il tocco sulla
 * matita e il dito che comincia a scrivere nel campo. Aspettare che il
 * pannello si riprenda — cinque secondi, come farebbe una prova qualunque —
 * nasconde proprio il difetto, perche' prima o poi una passata lo rimetteva a
 * posto: la finestra in cui le foto passavano da un'auto all'altra e' questa,
 * e va guardata qui dentro. */
const dueFotogrammi = (page) =>
  page.evaluate(
    () => new Promise((fatto) => requestAnimationFrame(() => requestAnimationFrame(fatto))),
  );

const valori = (page) =>
  page.evaluate(() => {
    const leggi = (kind) =>
      document.querySelector(
        `#ed-body [data-ev-photos] [data-ev-photo="${kind}"] [data-ev-photo-input]`,
      )?.value ?? null;
    return {
      titolo: document.querySelector("[data-ev-photos-title]")?.textContent || "",
      idle: leggi("idle"),
      plugged: leggi("plugged"),
    };
  });

const profiliSalvati = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((car) => ({
      name: car.name,
      img: car.img,
      imgPlugged: car.imgPlugged,
    })),
  );

test("la matita apre l'altra auto e il pannello porta le SUE foto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaScheda(page);

  /* Senza matita si parla dell'auto in uso. */
  await expect(page.locator("[data-ev-photos-title]")).toHaveText(/B10/);
  await expect(campo(page, "idle")).toHaveValue("/local/ev/b10-idle.png");

  await page.locator("#ed-body [data-ev-edit]").nth(1).click();

  /* E due fotogrammi dopo parla della T03 — titolo E campi. Il titolo da solo
   * non basterebbe: erano proprio i campi a restare indietro, ed e' da li' che
   * le foto passavano da una vettura all'altra. */
  await dueFotogrammi(page);
  const dopo = await valori(page);
  expect(dopo.titolo).toMatch(/T03/);
  expect(dopo).toMatchObject({
    idle: "/local/ev/t03-idle.png",
    plugged: "/local/ev/t03-cavo.png",
  });
});

test("salvare le foto della seconda auto non porta addosso quelle della prima", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await apriLaScheda(page);
  await page.locator("#ed-body [data-ev-edit]").nth(1).click();

  /* Come fa una persona: apre l'auto e scrive subito, senza aspettare che la
   * scheda si riprenda. Si cambia SOLO la foto a cavo staccato. Quella col
   * cavo attaccato non la si tocca — e prima usciva di qui col percorso della
   * B10, perche' il campo teneva ancora il suo. */
  await dueFotogrammi(page);
  await campo(page, "idle").fill("/local/ev/t03-nuova.png");
  await page
    .locator("#ed-body [data-ev-photos] [data-ev-photos-save]")
    .evaluate((bottone) => bottone.click());

  await expect
    .poll(() => profiliSalvati(page))
    .toEqual([
      { name: "B10", img: "/local/ev/b10-idle.png", imgPlugged: "/local/ev/b10-cavo.png" },
      { name: "T03", img: "/local/ev/t03-nuova.png", imgPlugged: "/local/ev/t03-cavo.png" },
    ]);
});

test("un percorso battuto e non salvato non segue chi cambia auto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaScheda(page);

  /* Si comincia a scrivere sulla B10 e poi ci si pente, aprendo la T03: il
   * segno «questo campo l'ha battuto una persona» appartiene alla B10, e con
   * lei se ne va. Restando, sarebbe finito nel profilo della T03 al primo
   * salvataggio. */
  await campo(page, "idle").fill("/local/ev/scritto-a-meta.png");
  await page.locator("#ed-body [data-ev-edit]").nth(1).click();
  await dueFotogrammi(page);
  expect(await valori(page)).toMatchObject({ idle: "/local/ev/t03-idle.png" });

  await page
    .locator("#ed-body [data-ev-photos] [data-ev-photos-save]")
    .evaluate((bottone) => bottone.click());
  await expect
    .poll(() => profiliSalvati(page))
    .toEqual([
      { name: "B10", img: "/local/ev/b10-idle.png", imgPlugged: "/local/ev/b10-cavo.png" },
      { name: "T03", img: "/local/ev/t03-idle.png", imgPlugged: "/local/ev/t03-cavo.png" },
    ]);
});

test("riaprire la configurazione ricomincia dall'auto in uso", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaScheda(page);
  await page.locator("#ed-body [data-ev-edit]").nth(1).click();
  await expect(page.locator("[data-ev-photos-title]")).toHaveText(/T03/);

  /* Il guscio, chiudendo, la finestra la butta via: la seduta di scrittura
   * pero' viveva in memoria e sopravviveva. Chi rientrava per sistemare la
   * vettura che aveva davanti stava configurando quella di prima. */
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await apriLaScheda(page);
  await expect(page.locator("[data-ev-photos-title]")).toHaveText(/B10/);
  await expect(campo(page, "idle")).toHaveValue("/local/ev/b10-idle.png");
});

test("la scheda di un'auto che non esiste ancora non porta il nome di nessuna", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await apriLaScheda(page);
  await page.locator("#ed-body [data-ev-edit]").nth(1).click();
  await expect(page.locator("[data-ev-photos-title]")).toHaveText(/T03/);

  await page.locator("#ed-body [data-ev-add-new]").first().click();
  /* Nessun nome accanto al titolo, e campi vuoti: la vettura sta nascendo, e
   * vestirla coi panni della T03 e' il difetto da cui si viene. */
  await dueFotogrammi(page);
  const bozza = await valori(page);
  expect(bozza.titolo).not.toMatch(/T03|B10/);
  expect(bozza).toMatchObject({ idle: "", plugged: "" });
});
