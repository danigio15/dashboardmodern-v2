/* «Apri la finestra per arieggiare» (#330), sulla finestra vera.
 *
 * La logica sta nel nucleo e ha le sue prove; qui si guarda la cosa che uno
 * vede: la riga con l'umidita' della stanza sotto la card della finestra, che
 * diventa il consiglio quando la stanza supera la soglia — quella della riga
 * o quella di casa. «L'umidita' si prende solo da quella legata al sensore
 * della stanza, non fuori»: il fuori si dice accanto e non decide.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-bagno",
        name: "Bagno",
        icon: "🚿",
        temp: "sensor.bagno_temperatura",
        hum: "sensor.bagno_umidita",
      },
      {
        id: "room-salone",
        name: "Salone",
        icon: "🛋️",
        temp: "sensor.salone_temperatura",
        hum: "sensor.salone_umidita",
      },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [
      { id: "c1", name: "Finestra bagno", entity: "cover.bagno", room_id: "room-bagno" },
      { id: "c2", name: "Finestra salone", entity: "cover.salone", room_id: "room-salone" },
      /* La finestra piccola del bagno: solo il contatto, ed e' aperta. */
      {
        id: "c3",
        name: "Vasistas bagno",
        contact: "binary_sensor.bagno_vasistas",
        room_id: "room-bagno",
      },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.home_meteo_umidita": "sensor.meteo_umidita" },
  },
  visibility: { home: true, tapparelle: true, temp: true },
};

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

/* Il bagno dopo una doccia: fradicio. Il salone: normale. */
const STATI = [
  stato("cover.bagno", "closed", { friendly_name: "Finestra bagno", current_position: 0 }),
  stato("cover.salone", "closed", { friendly_name: "Finestra salone", current_position: 0 }),
  stato("binary_sensor.bagno_vasistas", "on", {
    friendly_name: "Vasistas bagno",
    device_class: "window",
  }),
  stato("sensor.bagno_umidita", "78", {
    friendly_name: "Umidità bagno",
    device_class: "humidity",
    unit_of_measurement: "%",
  }),
  stato("sensor.salone_umidita", "48", {
    friendly_name: "Umidità salone",
    device_class: "humidity",
    unit_of_measurement: "%",
  }),
  stato("sensor.bagno_temperatura", "23", {
    friendly_name: "Temperatura bagno",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
  stato("sensor.salone_temperatura", "21", {
    friendly_name: "Temperatura salone",
    device_class: "temperature",
    unit_of_measurement: "°C",
  }),
];

async function avvia(page, testInfo, umiditaFuori) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ haStati, fuori }) => {
      for (const voce of haStati) _RAW_STATES[voce.entity_id] = structuredClone(voce);
      _RAW_STATES["sensor.meteo_umidita"] = {
        entity_id: "sensor.meteo_umidita",
        state: String(fuori),
        attributes: {
          friendly_name: "Umidità esterna",
          device_class: "humidity",
          unit_of_measurement: "%",
        },
      };
      if (typeof STATES !== "undefined")
        for (const [id, voce] of Object.entries(_RAW_STATES)) STATES[id] = structuredClone(voce);
      document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
      document.getElementById("page-tapparelle")?.classList.add("active");
      window.renderTapparelle?.();
      /* Il modulo delle finestre ridisegna sugli eventi di stato: annunciarli
       * e' quello che fa il runtime quando Home Assistant parla. */
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { haStati: STATI, fuori: umiditaFuori },
  );
  const bagno = page.locator('#page-tapparelle .tapp-card[data-tapp="cover.bagno"]');
  await expect(bagno).toBeVisible();
  return bagno;
}

const consiglio = (card) => card.locator("[data-dm-arieggia]");

test("a infisso aperto la card non consiglia di aprire, ma la misura resta", async ({
  page,
}, testInfo) => {
  /* «Non consiglia di aprire se l'infisso e' chiuso; se e' aperto, ovviamente,
   * non deve dire nulla.» Stessa stanza fradicia, due finestre: quella chiusa
   * consiglia, il vasistas aperto no. */
  const bagno = await avvia(page, testInfo, 41);
  await expect(consiglio(bagno)).toBeVisible({ timeout: 15_000 });
  const vasistas = page
    .locator("#page-tapparelle .tapp-card")
    .filter({ hasText: "Vasistas bagno" });
  await expect(vasistas).toHaveCount(1);
  await expect(consiglio(vasistas)).toHaveCount(0);
  const misura = vasistas.locator("[data-dm-umidita]");
  await expect(misura).toHaveAttribute("data-dm-umidita", "aperta");
  await expect(misura).toContainText("78%");
  await expect(misura).not.toContainText(/Apri|Open/);
  /* Chiuso il vasistas, il consiglio arriva anche a lui. */
  await page.evaluate(() => {
    for (const registro of [_RAW_STATES, STATES])
      registro["binary_sensor.bagno_vasistas"].state = "off";
    window.dispatchEvent(
      new CustomEvent("dashboardmodern:state-changed", {
        detail: { entity_id: "binary_sensor.bagno_vasistas" },
      }),
    );
  });
  await expect(consiglio(vasistas)).toBeVisible({ timeout: 15_000 });
});

test("col bagno fradicio la finestra dice di aprire, e il salone mostra la sua umidita'", async ({
  page,
}, testInfo) => {
  const bagno = await avvia(page, testInfo, 41);
  await expect(consiglio(bagno)).toBeVisible({ timeout: 15_000 });
  await expect(consiglio(bagno)).toContainText("78%");
  // Fuori e' piu' asciutto: non c'e' niente da avvertire.
  await expect(consiglio(bagno)).not.toContainText(/più umido|wetter/i);

  /* Il salone e' al quarantotto: sotto la soglia, e li' non c'e' niente da
   * suggerire — ma la card dice lo stesso che umidita' c'e', perche' «nella
   * sezione non esce nessun avviso» era anche questo: una stanza con
   * l'igrometro appena collegato e una card che non lo faceva vedere. */
  const salone = page.locator('#page-tapparelle .tapp-card[data-tapp="cover.salone"]');
  await expect(consiglio(salone)).toHaveCount(0);
  const misura = salone.locator("[data-dm-umidita]");
  await expect(misura).toHaveAttribute("data-dm-umidita", "sotto");
  await expect(misura).toContainText("48%");
});

test("con l'aria di fuori peggio di quella di dentro, la finestra dice di aprire e avverte", async ({
  page,
}, testInfo) => {
  /* La giornata di pioggia: la stanza sta male lo stesso. Il fuori non decide
   * — «si prende solo l'umidita' della stanza» — ma lo si dice accanto. */
  const bagno = await avvia(page, testInfo, 88);
  await expect(consiglio(bagno)).toBeVisible({ timeout: 15_000 });
  await expect(consiglio(bagno)).toContainText("78%");
  await expect(consiglio(bagno)).toContainText(/più umido|wetter/i);
  await expect(consiglio(bagno)).toContainText("88%");
});

test("senza il dato di fuori il consiglio c'e' lo stesso", async ({ page }, testInfo) => {
  const bagno = await avvia(page, testInfo, 41);
  await expect(consiglio(bagno)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    for (const registro of [_RAW_STATES, typeof STATES === "undefined" ? {} : STATES])
      if (registro["sensor.meteo_umidita"]) registro["sensor.meteo_umidita"].state = "unavailable";
    window.renderTapparelle?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  /* Chi non ha la stazione meteo vedeva sempre un silenzio: il fuori non e'
   * piu' una condizione. */
  await page.waitForTimeout(600);
  await expect(consiglio(bagno)).toBeVisible();
  await expect(consiglio(bagno)).toContainText("78%");
  await expect(consiglio(bagno)).not.toContainText("41%");
});

/* «La percentuale deve stare sotto alla creazione della singola finestra e
 * legata a ogni finestra» — e «in modifica di quella finestra i dati non
 * escono». Si apre la matita sul bagno, si guarda che la modale porti i dati
 * della riga, si scrive una soglia sua, e la card la rispetta. */
test("ogni finestra ha la sua soglia, scritta nella riga e riletta dalla modale", async ({
  page,
}, testInfo) => {
  const bagno = await avvia(page, testInfo, 41);
  await expect(consiglio(bagno)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="tapp"]').first().click();

  /* Nella creazione della singola finestra c'e' la casella, sotto quella
   * della chiusura. */
  const inForm = page.locator("#ed-body #ed-tp-umidita");
  await expect(inForm).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator("#ed-body #ed-tp-soglia-riga")).toHaveCount(1);

  const matita = page.locator('[data-dm-edit-kind="shutter"][data-dm-edit-index="0"]');
  await expect(matita.first()).toBeVisible({ timeout: 15_000 });
  await matita.first().click();
  const modale = page.locator("#dm-shutter-editor-modal");
  await expect(modale).toBeVisible();
  /* I dati della riga escono: entita', stanza, e le due soglie vuote perche'
   * la riga non le ha scritte — «come la casa». */
  await expect(modale.locator("input[name=entity]")).toHaveValue("cover.bagno");
  await expect(modale.locator("select[name=room]")).toHaveValue("room-bagno");
  await expect(modale.locator("input[name=soglia]")).toHaveValue("");
  await expect(modale.locator("input[name=umidita]")).toHaveValue("");

  /* Il bagno vuole l'ottanta: al settantotto non si apre piu'. */
  await modale.locator("input[name=umidita]").fill("80");
  await modale.locator("button[type=submit]").click();
  await expect(modale).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.getTapparelle()[0]?.umidita)).toBe(80);
  await page.evaluate(() => {
    window.renderTapparelle?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  const bagnoDopo = page.locator('#page-tapparelle .tapp-card[data-tapp="cover.bagno"]');
  await expect(consiglio(bagnoDopo)).toHaveCount(0, { timeout: 15_000 });
  const misura = bagnoDopo.locator("[data-dm-umidita]");
  await expect(misura).toHaveAttribute("data-dm-umidita", "sotto");
  await expect(misura).toContainText("78%");
  await expect(misura).toContainText("80%");

  /* E riaprendo la matita, la soglia scritta si rilegge. */
  await page.locator('.ed-tab[data-tab="tapp"]').first().click();
  await matita.first().click();
  await expect(modale.locator("input[name=umidita]")).toHaveValue("80");
  await expect(modale.locator("select[name=room]")).toHaveValue("room-bagno");
});

/* «Non compare in finestre»: e non compariva, perche' la casella della soglia
 * stava nella scheda Temperature — accanto ai sensori che confronta, che era un
 * ragionamento di chi il codice lo ha scritto, non di chi la plancia la usa. */
test("la soglia si trova nella scheda Finestre, e dice cosa manca", async ({ page }, testInfo) => {
  await avvia(page, testInfo, 41);
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="tapp"]').first().click();

  const soglia = page.locator("#ed-body #ed-umidita-soglia");
  await expect(soglia).toHaveCount(1, { timeout: 15_000 });

  /* E non è più dove stava prima.
   *
   * «Spostarla» vuol dire toglierla di là, non metterla anche qui: la scheda
   * Temperature è il posto in cui la si cercava e non c'era ragione di
   * trovarla. La si apre e si guarda: la linguetta la si riconosce dal modulo
   * che disegna, non dal nome, che cambia con la lingua.
   *
   * Si guardano due schede e non tutte e venti: passarle una per una costava
   * più del tempo che la prova ha, e una prova che scade non dice niente. */
  const temperatura = await page.evaluate(() => {
    for (const bottone of document.querySelectorAll(".ed-tab")) {
      editorSwitch(bottone.dataset.tab);
      if (document.querySelector("#ed-body [data-temperature-form]")) return bottone.dataset.tab;
    }
    return "";
  });
  expect(temperatura).not.toBe("");
  await expect(page.locator("#editor-modal #ed-umidita-soglia")).toHaveCount(0);

  await page.locator('.ed-tab[data-tab="tapp"]').first().click();

  /* Qui c'e' tutto — igrometro in stanza, finestra nella stanza — e la riga
   * lo dice invece di lasciare uno in dubbio. Il fuori non e' fra le cose che
   * servono: tolto, resta tutto a posto. */
  const nota = page.locator("#ed-body [data-dm-umidita-manca]");
  await expect(nota).toHaveAttribute("data-dm-umidita-manca", "pronto", { timeout: 15_000 });
  await page.evaluate(() => {
    for (const registro of [_RAW_STATES, typeof STATES === "undefined" ? {} : STATES])
      if (registro["sensor.meteo_umidita"]) registro["sensor.meteo_umidita"].state = "unavailable";
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await page.locator('.ed-tab[data-tab="tapp"]').first().click();
  await expect(nota).toHaveAttribute("data-dm-umidita-manca", "pronto", { timeout: 15_000 });
  await expect(nota).not.toContainText(/Stazione meteo|Weather station/i);

  /* Levato l'igrometro dalla stanza, invece, manca davvero — ed e' quello
   * che la riga dice. */
  await page.evaluate(() => {
    const stanze = JSON.parse(localStorage.getItem("cd_stanze") || "[]");
    for (const stanza of stanze) delete stanza.hum;
    localStorage.setItem("cd_stanze", JSON.stringify(stanze));
  });
  await page.locator('.ed-tab[data-tab="tapp"]').first().click();
  await expect(nota).toHaveAttribute("data-dm-umidita-manca", "manca", { timeout: 15_000 });
  await expect(nota).toContainText(/Temperature/i);
});

/* «Nelle finestre manca ancora il sensore umidita': deve importarlo in
 * automatico dalla stanza.»
 *
 * Lo importa gia' — l'umidita' di una finestra e' quella della sua stanza, e
 * non c'e' una casella per riscriverla — ma non lo diceva a nessuno: la
 * tendina diceva «Bagno» e non diceva cosa si porta dietro. Adesso sotto la
 * stanza c'e' scritto quale igrometro sta leggendo quella finestra, e cambia
 * insieme alla stanza. */
test("la finestra dice quale igrometro si porta dalla stanza", async ({ page }, testInfo) => {
  await avvia(page, testInfo, 41);
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="tapp"]').first().click();

  const tendina = page.locator("#ed-body #ed-tp-room");
  await expect(tendina).toHaveCount(1, { timeout: 15_000 });
  const nota = page.locator("#ed-body [data-dm-umidita-stanza]");
  await expect(nota).toHaveCount(1, { timeout: 15_000 });

  /* Scelta la stanza, la riga dice il sensore di QUELLA stanza. */
  const valoreDi = (nome) =>
    page.evaluate(
      (cercato) =>
        [...document.querySelectorAll("#ed-body #ed-tp-room option")].find((voce) =>
          voce.textContent.includes(cercato),
        )?.value || "",
      nome,
    );
  await tendina.selectOption(await valoreDi("Bagno"));
  await expect(nota).toHaveAttribute("data-dm-umidita-stanza", "pronto");
  await expect(nota).toContainText("sensor.bagno_umidita");

  /* Cambiata la stanza, cambia l'igrometro: e' la prova che il legame e' la
   * stanza e non una casella copiata a mano. */
  await tendina.selectOption(await valoreDi("Salone"));
  await expect(nota).toContainText("sensor.salone_umidita");

  /* Una stanza senza igrometro lo dice, e dice dove si mette. */
  await page.evaluate(() => {
    const stanze = JSON.parse(localStorage.getItem("cd_stanze") || "[]");
    for (const stanza of stanze) if (stanza.name === "Salone") delete stanza.hum;
    localStorage.setItem("cd_stanze", JSON.stringify(stanze));
  });
  await tendina.selectOption(await valoreDi("Bagno"));
  await tendina.selectOption(await valoreDi("Salone"));
  await expect(nota).toHaveAttribute("data-dm-umidita-stanza", "senza");
  await expect(nota).toContainText(/Temperature/i);
});
