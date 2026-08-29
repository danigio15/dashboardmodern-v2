/* Un'apertura si aggiunge sempre, e con la sua icona (#229).
 *
 * «Ne ho inserita una giorni fa, se provo ad aggiungerne altre non me le
 * salva.» Il salvataggio moriva in silenzio quando la lista salvata non era
 * piu' una lista — un salvataggio corrotto, un backup di un'altra versione — e
 * il tasto sembrava non fare niente. E l'icona si poteva scegliere solo per
 * gli avvisi personalizzati: per le Aperture il campo non c'era proprio.
 *
 * La prova parte dallo stato peggiore — lista corrotta E un'entita' tolta in
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

test("due aperture di fila entrano anche partendo da uno stato sporco", async ({
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
      JSON.stringify({ win: ["binary_sensor.porta_2", "binary_sensor.contatto_vecchio"] }),
    );
    localStorage.setItem("cd_gruppi_extra", JSON.stringify({ win: { rotta: true } }));
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
        document.getElementById("ed-avv-grp").value = "win";
        document.getElementById("ed-avv-ent").value = ent;
        document.getElementById("ed-avv-name").value = nome;
        const icona = document.getElementById("ed-avv-icon");
        const iconaVisibile = Boolean(icona && icona.offsetParent !== null);
        if (icona) icona.value = "🚪";
        window.edAddAvviso();
        return { iconaVisibile };
      },
      { ent, nome },
    );
  };

  const prima = await aggiungi("binary_sensor.porta_1", "Portoncino");
  /* L'icona si sceglie anche per un'apertura, non solo per i personalizzati. */
  expect(prima.iconaVisibile).toBe(true);
  await page.waitForTimeout(300);
  await aggiungi("binary_sensor.porta_2", "Finestra studio");
  await page.waitForTimeout(500);

  await page.reload();
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  const dopo = await page.evaluate(() => ({
    extra: JSON.parse(localStorage.getItem("cd_gruppi_extra") || "{}"),
    icone: JSON.parse(localStorage.getItem("cd_avvisi_icone") || "{}"),
    nomi: JSON.parse(localStorage.getItem("cd_avvisi_names_extra") || "{}"),
    vive: window.eval("typeof GRUPPI_MONITORAGGIO!=='undefined' ? GRUPPI_MONITORAGGIO.win : null"),
  }));
  expect(dopo.extra.win).toEqual(["binary_sensor.porta_1", "binary_sensor.porta_2"]);
  expect(dopo.vive).toContain("binary_sensor.porta_1");
  expect(dopo.vive).toContain("binary_sensor.porta_2");
  expect(dopo.icone["binary_sensor.porta_1"]).toBe("🚪");
  /* E il nome scelto e' rimasto: e' quello che i widget devono mostrare. */
  expect(dopo.nomi["binary_sensor.porta_1"]).toBe("Portoncino");
});

test("il widget delle aperture usa il nome scelto, non quello di fabbrica", async ({
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
    stati["binary_sensor.sensore_porta_finestra_camera"] = {
      entity_id: "binary_sensor.sensore_porta_finestra_camera",
      state: "on",
      attributes: { friendly_name: "Sensore Porta/finestra Camera matrimoniale" },
      last_changed: new Date().toISOString(),
    };
    localStorage.setItem(
      "cd_gruppi_extra",
      JSON.stringify({ win: ["binary_sensor.sensore_porta_finestra_camera"] }),
    );
    localStorage.setItem(
      "cd_avvisi_names_extra",
      JSON.stringify({ "binary_sensor.sensore_porta_finestra_camera": "Porta camera" }),
    );
    /* Il gruppo vivo si costruisce all'avvio: qui si semina dopo, quindi si
     * aggiorna anche lui — e' quello che fa il salvataggio vero. */
    window.eval(
      "if (typeof GRUPPI_MONITORAGGIO!=='undefined' && !GRUPPI_MONITORAGGIO.win.includes('binary_sensor.sensore_porta_finestra_camera')) GRUPPI_MONITORAGGIO.win.push('binary_sensor.sensore_porta_finestra_camera')",
    );
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1600);

  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="aperture"]');
  await expect(tessera).toBeVisible();
  /* Gia' la tessera: la didascalia e' il nome della prima aperta. */
  expect(await tessera.innerText()).toContain("Porta camera");

  await tessera.click();
  await page.waitForTimeout(400);
  const finestra = page.locator('#dm-widget-popup [data-dm-widget-detail="aperture"]');
  await expect(finestra).toBeVisible();
  const testo = await finestra.innerText();
  expect(testo).toContain("Porta camera");
  expect(testo).not.toContain("Sensore Porta/finestra Camera matrimoniale");
});
