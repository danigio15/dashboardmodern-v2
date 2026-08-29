/* Le prese hanno una sezione loro.
 *
 * «Cosa ne pensi di inserire una sezione dedicata a prese generiche, tipo TV
 * Salotto, TV letto, Presa Firestick?»
 *
 * Si potevano già configurare: la scheda Luci accetta anche `switch.`, e una
 * presa messa lì si accende benissimo. Solo che si chiama luce — finisce
 * nell'elenco delle luci, si conta nel «3 accese» del salone, e «spegni tutte
 * le luci» la spegne. Per la TV può anche andare; per il modem no.
 *
 * La prova fa il giro intero: si configura una presa dalla sua scheda, compare
 * nella sua pagina raggruppata per stanza, si accende toccandola, e — la parte
 * che conta — NON compare fra le luci.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salone", name: "Salone", icon: "mdi:sofa", order: 0 }],
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
  visibility: { prese: true, lights: true },
};

test("una presa si configura, si vede nella sua pagina e non finisce fra le luci", async ({
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
    const stati = eval("_RAW_STATES");
    for (const id of ["switch.tv_salotto", "switch.firestick"])
      stati[id] = { entity_id: id, state: "off", attributes: { friendly_name: id } };
    window.__comandi = [];
    window.cdCallServiceJson = (dominio, servizio, dati) =>
      window.__comandi.push(`${dominio}.${servizio} ${dati?.entity_id || ""}`);
    window.applyStates?.();
  });

  /* La scheda esiste, e ci si arriva. */
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show"))
      window.apriConfigEntita();
    window.editorSwitch("prese");
  });
  await page.waitForTimeout(400);
  await expect(page.locator("[data-dm-prese-editor]")).toBeVisible();

  /* I campi si riempiono dal documento e non col dito: l'entita' grezza sta
   * dietro la matita — e' il vestito che la plancia mette a ogni casella di
   * entita' — e qui interessa cosa succede al salvataggio, non come ci si
   * arriva. */
  const aggiungi = async (nome, entity, stanza) => {
    await page.evaluate(
      ({ nome, entity, stanza }) => {
        const scrivi = (id, valore) => {
          const campo = document.getElementById(id);
          if (!campo) return;
          campo.value = valore;
          campo.dispatchEvent(new Event("input", { bubbles: true }));
          campo.dispatchEvent(new Event("change", { bubbles: true }));
        };
        scrivi("ed-presa-name", nome);
        scrivi("ed-presa-ent", entity);
        scrivi("ed-presa-room", stanza || "");
      },
      { nome, entity, stanza },
    );
    await page.locator("[data-presa-save]").click();
    await page.waitForTimeout(300);
  };
  await aggiungi("TV Salotto", "switch.tv_salotto", "room-salone");
  await aggiungi("Firestick", "switch.firestick", "");

  const salvate = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("cd_prese") || "[]");
    } catch (errore) {
      return [];
    }
  });
  expect(salvate.map((presa) => presa.entity)).toEqual(["switch.tv_salotto", "switch.firestick"]);

  /* Un'entità già configurata non entra due volte. */
  await aggiungi("Doppione", "switch.tv_salotto", "");
  await expect(page.locator("[data-presa-error]")).not.toBeEmpty();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("cd_prese") || "[]").length),
  ).toBe(2);

  await page.evaluate(() => document.querySelector("#editor-modal .ed-head-close")?.click());
  await page.waitForTimeout(200);

  /* La pagina: c'è la voce nella barra, e le prese stanno sotto la loro stanza. */
  await page.evaluate(() => document.querySelector('.tab[data-tab="prese"]')?.click());
  await page.waitForTimeout(500);
  const pagina = page.locator("#page-prese");
  await expect(pagina).toHaveClass(/active/);
  await expect(pagina.locator('[data-dm-lucip="switch.tv_salotto"]')).toBeVisible();
  await expect(pagina.locator('[data-dm-lucip="switch.firestick"]')).toBeVisible();
  await expect(pagina.locator("[data-dm-prese-group]")).toHaveCount(2);
  /* Le intestazioni di gruppo sono in maiuscoletto, come nella pagina Luci. */
  expect(await pagina.locator("[data-dm-prese-group]").first().innerText()).toContain("SALONE");

  /* Si accende toccandola: il comando è quello di sempre, non uno nuovo. */
  await pagina.locator('[data-dm-lucip="switch.tv_salotto"] [data-dm-lucip-toggle]').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__comandi)).toEqual(["switch.turn_on switch.tv_salotto"]);

  /* E la parte che conta: nell'elenco delle luci non c'è finito niente. */
  const luci = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("cd_luci") || "{}");
    } catch (errore) {
      return {};
    }
  });
  expect(Object.keys(luci)).toEqual([]);
});

test("la pagina Prese ha l'intestazione, e la Home ha la sua tessera", async ({
  page,
}, testInfo) => {
  /* Segnalato il giorno del rilascio: la sezione era nata senza intestazione e
   * senza tessera fra i widget. Una sezione nuova entra con la stessa logica
   * delle altre — masthead, tessera, finestra — non a pezzi. */
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...SEME,
    visibility: { home: true, prese: true },
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    for (const [id, stato] of [
      ["switch.tv_salotto", "on"],
      ["switch.firestick", "off"],
    ])
      stati[id] = { entity_id: id, state: stato, attributes: { friendly_name: id } };
    localStorage.setItem(
      "cd_prese",
      JSON.stringify([
        { name: "TV Salotto", entity: "switch.tv_salotto", room_id: "room-salone" },
        { name: "Firestick", entity: "switch.firestick" },
      ]),
    );
    window.__comandi = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__comandi.push(`${dominio}.${servizio} ${dati?.entity_id || ""}`);
      return Promise.resolve(true);
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1600);

  /* La tessera c'e', conta le accese, e la finestra comanda. */
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="prese"]');
  await expect(tessera).toBeVisible();
  expect(await tessera.innerText()).toContain("1");
  await tessera.click();
  await page.waitForTimeout(400);
  const finestra = page.locator('#dm-widget-popup [data-dm-widget-detail="prese"]');
  await expect(finestra).toBeVisible();
  expect(await finestra.innerText()).toContain("TV Salotto");
  await finestra.locator('[data-dm-w-light="switch.firestick"]').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__comandi)).toEqual(["switch.toggle switch.firestick"]);
  await page.evaluate(() => document.querySelector("[data-dm-widget-close]")?.click());

  /* E la pagina ha l'intestazione come le altre. */
  await page.evaluate(() => document.querySelector('.tab[data-tab="prese"]')?.click());
  await page.waitForTimeout(700);
  const testata = page.locator("#page-prese .dm-page-mast");
  await expect(testata).toBeVisible();
  await expect(testata.locator(".dm-page-mast-title")).toHaveText(/Prese|Sockets/, {
    timeout: 10000,
  });
});

test("l'icona si sceglie dal catalogo di casa, e si disegna col suo tratto", async ({
  page,
}, testInfo) => {
  /* «Nella sezione prese non si puo' scegliere icona: richiama sempre il
   * catalogo creato da noi con lo stile elettrodomestici.» Il campo era testo
   * libero: adesso il bottone apre il selettore dei carichi — lo stesso
   * catalogo, la stessa tavolozza — e il token scelto si disegna col motore
   * delle icone, nella scheda e nella tessera della Home. */
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...SEME,
    visibility: { home: true, prese: true },
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["switch.tv_salotto"] = {
      entity_id: "switch.tv_salotto",
      state: "on",
      attributes: { friendly_name: "switch.tv_salotto" },
    };
    window.applyStates?.();
  });

  /* Dalla scheda: il bottone apre il selettore del catalogo. */
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show"))
      window.apriConfigEntita();
    window.editorSwitch("prese");
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const scrivi = (id, valore) => {
      const campo = document.getElementById(id);
      if (!campo) return;
      campo.value = valore;
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    };
    scrivi("ed-presa-name", "TV Salotto");
    scrivi("ed-presa-ent", "switch.tv_salotto");
  });
  await page.locator("[data-presa-icon-pick]").click();
  const selettore = page.locator("#dm-visual-picker");
  await expect(selettore).toBeVisible();
  /* E' il catalogo dei carichi, con i suoi gruppi. */
  await expect(selettore.locator(".dm-picker-group").first()).toBeVisible();
  await selettore.locator('.dm-picker-option[title="TV"]').first().click();
  await expect(selettore).toBeHidden({ timeout: 5000 });
  /* La scelta si vede subito sul bottone, come disegno e non come scritta. */
  await expect(page.locator("[data-presa-icon-pick] svg")).toBeVisible();

  await page.locator("[data-presa-save]").click();
  await page.waitForTimeout(300);
  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_prese") || "[]"));
  expect(salvata[0]?.icon).toBe("mdi:television");
  /* La riga della scheda porta il disegno del catalogo. */
  await expect(page.locator(".dm-presa-row .dm-presa-icon svg")).toBeVisible();

  /* E la tessera della Home lo porta nella sua riga. */
  await page.evaluate(() => {
    document.querySelector("#editor-modal .ed-head-close")?.click();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1600);
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="prese"]');
  await expect(tessera).toBeVisible();
  await tessera.click();
  await page.waitForTimeout(400);
  const finestra = page.locator('#dm-widget-popup [data-dm-widget-detail="prese"]');
  await expect(finestra).toBeVisible();
  await expect(finestra.locator(".dm-w-row .dm-w-glyph svg").first()).toBeVisible();
});
