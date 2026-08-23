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

  /* E il runtime ha reso attiva la T03: le caselle da cui il disegno legge e
   * il pannello foto raccontano LEI — vuota — non la B10 di prima. */
  await expect
    .poll(() =>
      page.evaluate(() => ({
        active: localStorage.getItem("cd_ev_car_active"),
        idle: JSON.parse(localStorage.getItem("cd_ev_image") || '""'),
      })),
    )
    .toEqual({ active: "1", idle: "" });
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

test("il nome di un'auto nuova svuota i campi della scheda", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  /* «appena inserisco il nome di un'altra auto deve svuotare i dati»: la
   * scheda mostrava la mappatura dell'auto attiva, e salvare un nome nuovo la
   * catturava tale e quale. Ora un nome che non e' di nessuno azzera le
   * caselle, e il nome di un'auto esistente le ricarica dai dati SUOI. */
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
  await nome.fill("Auto nuova di zecca");
  await nome.dispatchEvent("input");
  await expect(batteria).toHaveValue("");
  await nome.fill("T03");
  await nome.dispatchEvent("input");
  await expect(batteria).toHaveValue("sensor.t03_battery");
});
