/* La sezione EV, dal principio alla fine, senza doverci tornare.
 *
 * Due auto configurate, ognuna con le sue foto. Si passa dall'una all'altra
 * dalle linguette in cima alla pagina — piu' volte, avanti e indietro, come fa
 * una persona vera — e a ogni passo le caselle da cui il disegno legge dicono
 * l'auto scelta. Poi la configurazione: il pannello delle foto dichiara a
 * quale auto sta scrivendo, e una coppia di foto salvata su un'auto viene
 * tolta a chi la portava identica — che e' la firma del vecchio difetto che
 * le mescolava.
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

async function avvia(page, testInfo, cars = DUE_AUTO) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 30_000,
  });
  await page.evaluate((elenco) => {
    localStorage.setItem("cd_ev_cars", JSON.stringify(elenco));
    window.cdEvApplyCar(0);
  }, cars);
}

const caselle = (page) =>
  page.evaluate(() => {
    const read = (k) => {
      try {
        return JSON.parse(localStorage.getItem(k) || '""');
      } catch (_e) {
        return localStorage.getItem(k) || "";
      }
    };
    return {
      active: localStorage.getItem("cd_ev_car_active"),
      idle: read("cd_ev_image"),
      plugged: read("cd_ev_image_plugged"),
    };
  });

test("le linguette in cima reggono dieci cambi di fila", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);

  await page.evaluate(() => {
    document.querySelector('.tab[data-tab="ev"]')?.click();
  });
  /* La stessa tendina esiste due volte per disegno — in cima alla pagina e
   * dentro il popup dell'auto. Qui si prova quella della pagina. */
  const linguette = page.locator("#ev-car-picker .dm-vehicle-profile-card");
  await expect(linguette).toHaveCount(2);

  /* Avanti e indietro, come col dito: a ogni passo la spunta e le caselle
   * raccontano la stessa auto — e ci restano anche dopo una pausa. */
  for (const indice of [1, 0, 1, 1, 0, 1, 0, 0, 1, 0]) {
    await linguette.nth(indice).click();
    const attesa =
      indice === 0
        ? { active: "0", idle: "/local/ev/b10-idle.png", plugged: "/local/ev/b10-cavo.png" }
        : { active: "1", idle: "/local/ev/t03-idle.png", plugged: "/local/ev/t03-cavo.png" };
    await expect.poll(() => caselle(page)).toEqual(attesa);
    await expect(linguette.nth(indice)).toHaveClass(/active/);
  }

  // E dopo tre secondi di passate della plancia niente e' tornato indietro.
  await page.waitForTimeout(3000);
  expect(await caselle(page)).toEqual({
    active: "0",
    idle: "/local/ev/b10-idle.png",
    plugged: "/local/ev/b10-cavo.png",
  });
});

test("il pannello foto dice a quale auto sta scrivendo, e segue il cambio", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);

  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  const titolo = page.locator("[data-ev-photos-title]");
  await expect(titolo).toHaveCount(1);
  await expect(titolo).toHaveText(/B10/);

  // Cambiata l'auto attiva, il pannello cambia intestazione: niente piu' foto
  // caricate "da qualche parte".
  await page.evaluate(() => window.cdEvApplyCar(1));
  await expect(titolo).toHaveText(/T03/);
});

test("salvare le foto di un'auto non tocca mai l'altra", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* La configurazione corrotta dal vecchio difetto: due auto, la stessa
   * identica coppia di foto — quelle della B10, copiate sulla T03. */
  const corrotte = JSON.parse(JSON.stringify(DUE_AUTO));
  corrotte[1].img = corrotte[0].img;
  corrotte[1].imgPlugged = corrotte[0].imgPlugged;
  await avvia(page, testInfo, corrotte);

  // Si rende attiva la T03 e le si danno le SUE foto dal pannello.
  await page.evaluate(() => {
    window.cdEvApplyCar(1);
    window.apriConfigEntita();
    window.editorSwitch("sez2");
    const accordion = [...document.querySelectorAll("#ed-body details.ed-acc")].find((node) =>
      node.querySelector('.ed-slot-in[data-ref^="dm.ev_"]'),
    );
    if (accordion) accordion.open = true;
  });
  const pannello = page.locator("#ed-body [data-ev-photos]");
  await expect(pannello).toHaveCount(1);
  await expect(page.locator("[data-ev-photos-title]")).toHaveText(/T03/);

  await pannello
    .locator('[data-ev-photo="idle"] [data-ev-photo-input]')
    .fill("/local/ev/t03-idle.png");
  await pannello
    .locator('[data-ev-photo="plugged"] [data-ev-photo-input]')
    .fill("/local/ev/t03-cavo.png");
  // Il click diretto: il modale della configurazione tiene strati sopra.
  await pannello.locator("[data-ev-photos-save]").evaluate((bottone) => bottone.click());

  await expect
    .poll(() =>
      page.evaluate(() => {
        const cars = JSON.parse(localStorage.getItem("cd_ev_cars") || "[]");
        return cars.map((c) => ({ name: c.name, img: c.img, imgPlugged: c.imgPlugged }));
      }),
    )
    .toEqual([
      /* La B10 tiene le SUE foto, identiche o no: salvare la T03 riguarda la
       * T03 e basta. Chi ha i profili mescolati risistema ciascuna auto dal
       * suo pannello — che ora dichiara a chi sta scrivendo — e la foto non
       * risorge piu' dagli alias. */
      { name: "B10", img: "/local/ev/b10-idle.png", imgPlugged: "/local/ev/b10-cavo.png" },
      { name: "T03", img: "/local/ev/t03-idle.png", imgPlugged: "/local/ev/t03-cavo.png" },
    ]);

  /* E una bozza scritta per un'auto non finisce sull'altra.
   *
   * Percorso digitato senza salvare, poi cambio d'auto: il pannello segue il
   * cambio e la bozza dell'auto di prima si scarta — salvarla adesso la
   * scriverebbe sul profilo sbagliato col titolo nuovo a fare da alibi. */
  await pannello
    .locator('[data-ev-photo="idle"] [data-ev-photo-input]')
    .fill("/local/ev/bozza-mai-salvata.png");
  await page.evaluate(() => window.cdEvApplyCar(0));
  await expect(page.locator("[data-ev-photos-title]")).toHaveText(/B10/);
  await expect(pannello.locator('[data-ev-photo="idle"] [data-ev-photo-input]')).toHaveValue(
    "/local/ev/b10-idle.png",
  );
});

test("un'auto nuova non nasce con la foto di quella attiva", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* Il giro incriminato, col runtime vero: B10 attiva con le sue foto, e si
   * crea la T03 dalla scheda. Il runtime battezzava la nuova con le due
   * caselle piatte — le foto di B10 — e nessuna protezione se ne accorgeva:
   * un'auto che prima non c'era non ha un "prima" da ripristinare. */
  await avvia(page, testInfo, [DUE_AUTO[0]]);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await page.waitForFunction(() => Boolean(document.getElementById("ed-evcar-name")), null, {
    timeout: 15_000,
  });

  await page.evaluate(() => {
    const campo = document.getElementById("ed-evcar-name");
    campo.value = "T03";
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    /* Il nome nuovo ha appena svuotato le caselle dm.ev_* — e' il suo lavoro:
     * l'auto nuova non eredita la mappatura dell'attiva. Il runtime pero'
     * esige almeno un'entita' per creare la scheda, quindi si mappa la SUA. */
    const batteria = document.querySelector(
      '#ed-body input.ed-slot-in[data-ref="dm.ev_batteria_auto"]',
    );
    if (batteria) batteria.value = "sensor.t03_battery";
    window.edEvCarAdd();
  });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const cars = JSON.parse(localStorage.getItem("cd_ev_cars") || "[]");
        return cars.map((c) => ({
          name: c.name,
          img: c.img || "",
          imgPlugged: c.imgPlugged || "",
        }));
      }),
    )
    .toEqual([
      { name: "B10", img: "/local/ev/b10-idle.png", imgPlugged: "/local/ev/b10-cavo.png" },
      // Nata adesso, senza foto: le sue si scelgono dal pannello.
      { name: "T03", img: "", imgPlugged: "" },
    ]);

  /* Salvare non cambia l'auto che la sezione sta mostrando: resta la B10, con
   * la sua foto. La T03 e' nata senza — le sue si scelgono dal pannello, che
   * intanto dichiara di parlare con lei. */
  await expect
    .poll(() =>
      page.evaluate(() => ({
        active: localStorage.getItem("cd_ev_car_active"),
        idle: JSON.parse(localStorage.getItem("cd_ev_image") || '""'),
      })),
    )
    .toEqual({ active: "0", idle: "/local/ev/b10-idle.png" });
  /* E la scheda resta aperta sull'auto appena salvata: e' lei che il pannello
   * dichiara, ed e' su di lei che «Salva foto» scrivera'. */
  await expect(page.locator("[data-ev-photos-title]")).toHaveText(/T03/);
  await expect(
    page.locator('#ed-body [data-ev-photos] [data-ev-photo="idle"] [data-ev-photo-input]'),
  ).toHaveValue("");
});

test("le caselle stantie di un altro giro non battono il profilo", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* Il segnalato, alla lettera: le foto nel profilo sono quelle nuove — il
   * pannello le mostra — ma le due caselle piatte del dispositivo portano
   * ancora la foto di mesi fa, e la plancia disegnava QUELLA. Le caselle sono
   * per-dispositivo e non viaggiano con la configurazione: nessun salvataggio
   * altrui puo' ripulirle, deve pensarci il disegno. */
  await avvia(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem("cd_ev_image", JSON.stringify("/local/ev/scia-vecchia.png"));
    localStorage.setItem("cd_ev_image_plugged", JSON.stringify("/local/ev/scia-vecchia.png"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await expect
    .poll(() => caselle(page))
    .toEqual({
      active: "0",
      idle: "/local/ev/b10-idle.png",
      plugged: "/local/ev/b10-cavo.png",
    });
  await expect
    .poll(() => page.evaluate(() => document.getElementById("ev-mod-car-img")?.getAttribute("src")))
    .toContain("b10-idle.png");
});

test("cancellata l'ultima auto non resta niente di suo", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* «quando cancello non cancella tutto»: sparita l'ultima vettura, le
   * caselle del disegno tenevano le sue foto e l'indice il suo posto — la
   * fotografia del fantasma restava sull'eroe per sempre. */
  await avvia(page, testInfo, [DUE_AUTO[0]]);
  await expect.poll(() => caselle(page)).toMatchObject({ idle: "/local/ev/b10-idle.png" });
  await page.evaluate(() => {
    const btn = document.createElement("button");
    btn.setAttribute("data-act", "del");
    btn.setAttribute("data-idx", "0");
    window.cdEvCarBtn(btn);
  });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        cars: JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").length,
        active: localStorage.getItem("cd_ev_car_active"),
        idle: JSON.parse(localStorage.getItem("cd_ev_image") || '""'),
        plugged: JSON.parse(localStorage.getItem("cd_ev_image_plugged") || '""'),
      })),
    )
    .toEqual({ cars: 0, active: null, idle: "", plugged: "" });
});

test("il bottone verde della sezione salva anche le foto scritte", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* Il percorso scritto nel campo, l'anteprima giusta sotto, e poi «SALVA
   * SEZIONE» — il bottone in fondo, quello che chiunque preme. Salvava solo
   * le entita': il percorso restava a video e spariva alla riapertura. */
  await avvia(page, testInfo, [DUE_AUTO[0]]);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  const campo = page.locator(
    '#ed-body [data-ev-photos] [data-ev-photo="idle"] [data-ev-photo-input]',
  );
  await campo.waitFor({ timeout: 15_000 });
  await campo.fill("/local/ev/b10-nuova.png");
  await campo.dispatchEvent("input");
  await page.evaluate(() => {
    const bottone = [...document.querySelectorAll("#ed-body .ed-acc-body .ed-save-btn")].find(
      (nodo) => nodo.closest(".ed-acc-body")?.querySelector("[data-ev-photos]"),
    );
    window.edSaveSezione(bottone);
  });
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_ev_cars") || "[]")[0]?.img))
    .toBe("/local/ev/b10-nuova.png");
});

test("il nome e' un dato: digitarlo non tocca i campi, e la rinomina conserva l'auto", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  /* Di chi sono i campi lo decide la SESSIONE — la matita apre un'auto, ＋
   * apre la bozza — e il nome scritto e' solo il nome. Prima digitare qui
   * ricaricava o svuotava le caselle a seconda che il nome fosse di
   * qualcuno: rinominare era impossibile e i dati cambiavano padrone. */
  await avvia(page, testInfo);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  const nome = page.locator("#ed-evcar-name");
  await nome.waitFor({ timeout: 15_000 });
  const batteria = page.locator('#ed-body input.ed-slot-in[data-ref="dm.ev_batteria_auto"]');
  await batteria.evaluate((input) => {
    input.value = "sensor.b10_battery";
  });
  // Digitare qualunque nome — nuovo o di un'altra auto — non tocca i campi.
  await nome.fill("Auto nuova di zecca");
  await nome.dispatchEvent("input");
  await expect(batteria).toHaveValue("sensor.b10_battery");
  await nome.fill("T03");
  await nome.dispatchEvent("input");
  await expect(batteria).toHaveValue("sensor.b10_battery");

  // La matita apre la T03: sessione, nome e campi diventano i suoi.
  await page.locator("#ed-body [data-ev-edit]").nth(1).click();
  await expect(nome).toHaveValue("T03", { timeout: 15_000 });
  await expect(batteria.first()).toHaveValue("sensor.t03_battery");

  // Rinominare e salvare NON crea una riga nuova: e' sempre lei, stessa
  // chiave, stesse entita', stesso posto in lista.
  const chiavePrima = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cd_ev_cars") || "[]")[1]?.uid,
  );
  await nome.fill("T03 Berlina");
  await nome.dispatchEvent("input");
  await page.locator('#ed-body button[onclick*="edEvCarAdd"]').first().click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((car) => car.name),
      ),
    )
    .toEqual(["B10", "T03 Berlina"]);
  const dopo = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_ev_cars") || "[]")[1]);
  expect(dopo.uid).toBe(chiavePrima);
  expect(dopo.ov["dm.ev_batteria_auto"]).toBe("sensor.t03_battery");

  // Il nome di UN'ALTRA auto non si salva: era il gesto del furto di dati.
  await nome.fill("B10");
  await nome.dispatchEvent("input");
  await page.locator('#ed-body button[onclick*="edEvCarAdd"]').first().click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((car) => car.name),
      ),
    )
    .toEqual(["B10", "T03 Berlina"]);
});

test("la lista auto ha la matita, niente distintivo, e il + svuota la scheda", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  /* «per aggiungere un'auto devi mettere un + con un campo per il nome; per
   * modificare deve esserci la matita come in tutte le sezioni; togli il
   * distintivo attiva: attive lo sono tutte». */
  await avvia(page, testInfo);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  const matite = page.locator("#ed-body [data-ev-edit]");
  await expect(matite).toHaveCount(2, { timeout: 15_000 });
  await expect(page.locator("#ed-body .ed-row .pool-badge")).toHaveCount(0);
  await expect(page.locator('#ed-body button[onclick*="edEvCarAdd"]')).toHaveText(
    /Salva (auto|le modifiche a|la nuova auto)/,
  );

  /* La matita APRE quell'auto nella scheda — nome compreso — e non tocca
   * nient'altro: quale vettura la sezione stia mostrando non e' affare della
   * configurazione, e aprirne una per modificarla non deve cambiarla. */
  const inUsoPrima = await page.evaluate(() => localStorage.getItem("cd_ev_car_active"));
  await matite.nth(1).click();
  await expect(page.locator("#ed-evcar-name")).toHaveValue("T03", { timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem("cd_ev_car_active"))).toBe(inUsoPrima);
  await expect(page.locator("#ed-evcar-name")).toHaveValue("T03", { timeout: 15_000 });
  await expect(
    page.locator('#ed-body .ed-slot-in[data-ref="dm.ev_batteria_auto"]').first(),
  ).toHaveValue("sensor.t03_battery");

  // «＋ Aggiungi auto»: la scheda si svuota, la vettura nuova parte da zero —
  // marca e modello compresi, non quelli della vettura precedente.
  await page.locator("#ed-body [data-ev-add-new]").click();
  await expect(page.locator("#ed-evcar-name")).toHaveValue("");
  await expect(
    page.locator('#ed-body .ed-slot-in[data-ref="dm.ev_batteria_auto"]').first(),
  ).toHaveValue("");
  await expect(page.locator("#ed-body [data-ev-appearance] select[data-model]")).toHaveValue("");
});

test("la bozza non veste l'auto attiva, e la vettura nuova nasce col suo brand", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  /* Il difetto: dopo «＋ Aggiungi auto» l'attiva restava attiva, e «Salva
   * brand e modello» scriveva marca e modello della vettura NUOVA addosso a
   * quella VECCHIA. In bozza quel bottone non tocca nessuno; e' «Salva
   * auto» a portare la scelta viva dentro il profilo appena nato. */
  await avvia(page, testInfo);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await page.locator("#ed-body [data-ev-add-new]").click();
  await page.locator("#ed-evcar-name").fill("Kia nuova");
  await page.locator("#ed-evcar-name").dispatchEvent("input");

  // La card Brand vive dentro l'accordion: lo si apre come farebbe un dito.
  await page.evaluate(() => {
    document
      .querySelector("#ed-body [data-ev-appearance]")
      ?.closest("details")
      ?.setAttribute("open", "");
  });
  const marca = page.locator("#ed-body [data-ev-appearance] select[data-brand]");
  await marca.selectOption("Kia");
  await page
    .locator("#ed-body [data-ev-appearance] select[data-model]")
    .locator("option")
    .nth(1)
    .evaluate((option) => {
      option.closest("select").value = option.value;
      option.closest("select").dispatchEvent(new Event("change", { bubbles: true }));
    });
  // Qualche rifinitura di stile lo tiene fuori vista nel collaudo: qui si
  // prova il gestore, non l'affordance.
  await page.locator("#ed-body [data-ev-appearance] button[data-save]").dispatchEvent("click");
  // La vecchia guardia: B10 e T03 restano dei loro marchi.
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((car) => [car.name, car.brand]),
      ),
    )
    .toEqual([
      ["B10", "Leapmotor"],
      ["T03", "Leapmotor"],
    ]);

  // «Salva auto»: la nuova nasce col brand scelto in bozza.
  await page.evaluate(() => {
    const input = document.querySelector('#ed-body .ed-slot-in[data-ref="dm.ev_batteria_auto"]');
    input.value = "sensor.kia_soc";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator('#ed-body button[onclick*="edEvCarAdd"]').first().click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((car) => [car.name, car.brand]),
      ),
    )
    .toEqual([
      ["B10", "Leapmotor"],
      ["T03", "Leapmotor"],
      ["Kia nuova", "Kia"],
    ]);
});

test("in bozza il pannello foto non scrive su nessuno", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* Lo stesso difetto del brand, sull'altro pannello. «＋ Nuova auto» apre
   * una scheda che non appartiene ancora a nessuna vettura: la domanda «di
   * chi sono queste foto» ha una risposta sola — di nessuno, non ancora.
   *
   * Il pannello pero' la chiedeva a un suo conto, e nella bozza ricadeva
   * sull'auto in uso: mostrava le foto della B10 su una scheda vuota, e
   * «Salva foto» gliele riscriveva addosso. Un percorso scritto per la
   * vettura che sta nascendo finiva su quella vecchia. */
  await avvia(page, testInfo);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await page.waitForFunction(() => Boolean(document.getElementById("ed-evcar-name")), null, {
    timeout: 15_000,
  });
  await page.locator("#ed-body [data-ev-add-new]").click();

  /* La scheda e' vuota, e il pannello con lei: nessuna foto ereditata. */
  const campoFoto = page.locator(
    '#ed-body [data-ev-photos] [data-ev-photo="idle"] [data-ev-photo-input]',
  );
  await expect(campoFoto).toHaveValue("");

  /* Si scrive il percorso della vettura nuova e si salva. */
  await campoFoto.fill("/local/ev/kia-idle.png");
  await campoFoto.dispatchEvent("input");
  await page.locator("#ed-body [data-ev-photos-save]").click();

  /* Nessuna delle due auto configurate ha preso quella foto. */
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("cd_ev_cars") || "[]").map((c) => ({
          name: c.name,
          img: c.img || "",
        })),
      ),
    )
    .toEqual([
      { name: "B10", img: "/local/ev/b10-idle.png" },
      { name: "T03", img: "/local/ev/t03-idle.png" },
    ]);
  /* E nemmeno il disegno: in plancia resta la B10, che e' quella in uso. */
  await expect.poll(() => caselle(page)).toEqual({
    active: "0",
    idle: "/local/ev/b10-idle.png",
    plugged: "/local/ev/b10-cavo.png",
  });
});
