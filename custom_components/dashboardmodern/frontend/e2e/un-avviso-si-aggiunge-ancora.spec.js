/* Un avviso si aggiunge sempre, e con la sua icona (#229) — e la tessera lo
 * chiama col nome scelto, non con quello di fabbrica (#231).
 *
 * «Ne ho inserita una giorni fa, se provo ad aggiungerne altre non me le
 * salva.» Il salvataggio moriva in silenzio quando la lista salvata non era
 * piu' una lista — un salvataggio corrotto, un backup di un'altra versione — e
 * il tasto sembrava non fare niente. E l'icona si poteva scegliere solo per
 * gli avvisi personalizzati.
 *
 * Le due prove nascevano sul gruppo delle aperture, che non c'e' piu': «viene
 * gia' gestito da Finestre, se li si mette il sensore finestra dice quale e'
 * aperto, quindi e' un duplicato». Quello che difendevano pero' non era il
 * gruppo — era il salvataggio, che e' uno solo per tutti, e la regola sul nome,
 * che sta in `friendlyName` e vale per ogni tessera d'avviso. Perche' restino
 * difese si spostano sulle Batterie, che quel salvataggio e quella tessera
 * ce li hanno ancora: sarebbe stato piu' comodo cancellarle, ed e' esattamente
 * il motivo per cui non si fa.
 *
 * La prima parte dallo stato peggiore — lista corrotta E un'entita' tolta in
 * passato che si riaggiunge — e pretende che due aggiunte di fila entrino,
 * sopravvivano al ricaricamento, e portino l'icona scelta.
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
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: {},
};

test("due avvisi di fila entrano anche partendo da uno stato sporco", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    /* Il passato sporco: una tolta ieri che oggi si riaggiunge, e una lista
     * che non e' piu' una lista. */
    localStorage.setItem(
      "cd_gruppi_removed",
      JSON.stringify({ batt: ["binary_sensor.pila_2", "binary_sensor.pila_vecchia"] }),
    );
    localStorage.setItem("cd_gruppi_extra", JSON.stringify({ batt: { rotta: true } }));
  });

  const aggiungi = async (ent, nome) => {
    await page.evaluate(() => {
      if (!document.getElementById("editor-modal")?.classList.contains("show"))
        window.apriConfigEntita();
      window.editorSwitch("avvisi");
    });
    await page.waitForTimeout(350);
    return page.evaluate(
      ({ ent, nome }) => {
        document.getElementById("ed-avv-grp").value = "batt";
        document.getElementById("ed-avv-ent").value = ent;
        document.getElementById("ed-avv-name").value = nome;
        const icona = document.getElementById("ed-avv-icon");
        const iconaVisibile = Boolean(icona && icona.offsetParent !== null);
        if (icona) icona.value = "🔋";
        window.edAddAvviso();
        return { iconaVisibile };
      },
      { ent, nome },
    );
  };

  const prima = await aggiungi("binary_sensor.pila_1", "Pila del salotto");
  /* L'icona si sceglie per ogni avviso, non solo per i personalizzati. */
  expect(prima.iconaVisibile).toBe(true);
  await page.waitForTimeout(300);
  await aggiungi("binary_sensor.pila_2", "Pila dello studio");
  await page.waitForTimeout(500);

  await page.reload();
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  const dopo = await page.evaluate(() => ({
    extra: JSON.parse(localStorage.getItem("cd_gruppi_extra") || "{}"),
    icone: JSON.parse(localStorage.getItem("cd_avvisi_icone") || "{}"),
    nomi: JSON.parse(localStorage.getItem("cd_avvisi_names_extra") || "{}"),
    vive: window.eval("typeof GRUPPI_MONITORAGGIO!=='undefined' ? GRUPPI_MONITORAGGIO.batt : null"),
  }));
  expect(dopo.extra.batt).toEqual(["binary_sensor.pila_1", "binary_sensor.pila_2"]);
  expect(dopo.vive).toContain("binary_sensor.pila_1");
  expect(dopo.vive).toContain("binary_sensor.pila_2");
  expect(dopo.icone["binary_sensor.pila_1"]).toBe("🔋");
  /* E il nome scelto e' rimasto: e' quello che i widget devono mostrare. */
  expect(dopo.nomi["binary_sensor.pila_1"]).toBe("Pila del salotto");
});

test("la tessera di un avviso usa il nome scelto, non quello di fabbrica", async ({
  page,
}, testInfo) => {
  /* #231: in Home compariva «Sensore Porta/finestra Camera matrimoniale
   * Batteria» — il nome di fabbrica dell'entita' — anche a chi quella riga
   * l'aveva battezzata in configurazione. Il nome scelto sta in
   * `cd_avvisi_names_extra`, ed e' lui che si legge. */
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...SEME,
    visibility: { home: true },
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    /* Sotto il venti per cento: e' la soglia a cui la tessera si accende, e
     * senza una pila scarica non c'e' niente da nominare. */
    stati["sensor.sensore_porta_finestra_camera_batteria"] = {
      entity_id: "sensor.sensore_porta_finestra_camera_batteria",
      state: "8",
      attributes: {
        friendly_name: "Sensore Porta/finestra Camera matrimoniale Batteria",
        device_class: "battery",
        unit_of_measurement: "%",
      },
      last_changed: new Date().toISOString(),
    };
    localStorage.setItem(
      "cd_gruppi_extra",
      JSON.stringify({ batt: ["sensor.sensore_porta_finestra_camera_batteria"] }),
    );
    localStorage.setItem(
      "cd_avvisi_names_extra",
      JSON.stringify({ "sensor.sensore_porta_finestra_camera_batteria": "Porta camera" }),
    );
    /* La prova legge la didascalia della tessera piena: sul telefono la
     * modalita' compatta (Auto) la nasconderebbe, e qui non e' lei l'imputata. */
    localStorage.setItem("cd_widgets", JSON.stringify({ compatto: "mai" }));
    /* La lista viva del guscio si costruisce all'avvio e qui NON si tocca: la
     * pila sta solo in configurazione, come dopo un salvataggio dalla finestra
     * di modifica degli avvisi o una sincronizzazione da un altro apparecchio.
     * E' il caso «la batteria e' al 1% e non compare il widget»: la tessera
     * deve leggere la configurazione, non solo la memoria. */
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1600);

  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="batterie"]');
  await expect(tessera).toBeVisible();
  /* Gia' la tessera: la didascalia e' il nome della piu' scarica. */
  expect(await tessera.innerText()).toContain("Porta camera");

  await tessera.click();
  await page.waitForTimeout(400);
  const finestra = page.locator('#dm-widget-popup [data-dm-widget-detail="batterie"]');
  await expect(finestra).toBeVisible();
  const testo = await finestra.innerText();
  expect(testo).toContain("Porta camera");
  expect(testo).not.toContain("Sensore Porta/finestra Camera matrimoniale Batteria");
});
