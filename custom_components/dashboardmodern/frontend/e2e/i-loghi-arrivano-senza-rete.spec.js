/* I loghi dei marchi arrivano anche senza rete.
 *
 * Venivano da un CDN. Una plancia di Home Assistant sta su una rete di casa, e
 * molte non escono su internet: li' non arrivavano MAI — tutti, non alcuni — e
 * nessuno se ne accorgeva, perche' un'immagine che non arriva non fa rumore.
 *
 * Questa prova stacca la rete e conta le immagini rotte. Zero, o non e' vero.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
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

test("con la rete staccata i loghi dei marchi si vedono lo stesso", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.abort());
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);

  const esito = await page.evaluate(async () => {
    /* Il catalogo si prende dai sorgenti, e la strada si conta dal DOCUMENTO.
     *
     * Prima si partiva dal tag dello script d'ingresso, che pero' cambia casa:
     * impacchettata la plancia lo carica da `legacy/pacco/legacy/`, e togliere
     * `/legacy/modules-entry...` da li' lasciava una radice dentro il
     * pacchetto, dove i sorgenti non stanno. Il documento invece e' sempre
     * `legacy/dashboard*.html`, col pacchetto e senza. */
    const catalogo = await import(
      new URL("../src/core/personalization-catalog.js", location.href).href
    );
    const box = document.createElement("div");
    box.id = "dm-prova-loghi";
    document.body.append(box);
    for (const marchio of catalogo.CAR_BRANDS) {
      const cella = document.createElement("span");
      cella.innerHTML = catalogo.carBrandVisual(marchio.name, 40);
      box.append(cella);
    }
    /* Il logo non e' piu' un `<img>`: e' una maschera, cioe' la forma presa dal
     * file e il colore messo dalla plancia. Un SVG dentro un `<img>` e' un
     * documento a parte e il colore non ci entra: erano tutti neri. */
    const segni = [...box.querySelectorAll("[data-dm-brand-image]")];
    const stili = segni.map((segno) => getComputedStyle(segno));
    return {
      marchi: catalogo.CAR_BRANDS.length,
      segni: segni.length,
      senzaForma: stili.filter(
        (stile) => !/url\(/.test(stile.maskImage || stile.webkitMaskImage || ""),
      ).length,
      /* Il browser normalizza l'indirizzo ad assoluto, quindi «comincia per
       * http» non vuol dire «viene da fuori»: si guarda l'origine, che e'
       * l'unica cosa che distingue un file nostro da uno di qualcun altro. */
      remoti: stili.filter((stile) => {
        const dentro = (stile.maskImage || stile.webkitMaskImage || "").match(/url\("?([^")]+)/);
        if (!dentro) return false;
        try {
          return new URL(dentro[1], location.href).origin !== location.origin;
        } catch (_errore) {
          return false;
        }
      }).length,
      colorati: new Set(stili.map((stile) => stile.backgroundColor)).size,
    };
  });

  // Niente va a prendersi qualcosa fuori: i file sono nostri.
  expect(esito.remoti).toBe(0);
  // Ogni marchio ha la sua forma: nessuno resta un riquadro vuoto.
  expect(esito.senzaForma).toBe(0);
  expect(esito.segni).toBeGreaterThanOrEqual(35);
  /* E non sono tutti dello stesso colore: ognuno porta la sua tinta, e chi ha
   * il marchio nero segue il tema. Un colore solo vorrebbe dire che la tinta
   * non arriva — ed e' esattamente com'era. */
  expect(esito.colorati).toBeGreaterThan(5);
});

test("nel catalogo ogni marchio porta il SUO colore, non un inchiostro solo", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  /* «perche' leapmotor e' blu, devono essere tutti dello stesso colore — e se
   * riesci a metterci il loro colore vero, meglio». Il colore vero c'era, nel
   * disegno: ma una regola marcata importante — dell'epoca in cui i loghi
   * arrivavano da un CDN come immagini da normalizzare — li ridipingeva tutti
   * dello stesso grigio prima che si vedessero. Il colore giusto scritto e
   * mai mostrato e' come non averlo. */
  await page.route("https://**", (route) => route.abort());
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...seme,
    sections: {
      ...seme.sections,
      ev: [
        {
          name: "B10",
          uid: "b10",
          brand: "Leapmotor",
          model: "B10",
          ov: { "dm.ev_batteria_auto": "sensor.b" },
        },
      ],
    },
  });
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("sez2");
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    document
      .querySelector("#ed-body [data-ev-appearance]")
      ?.closest("details")
      ?.setAttribute("open", "");
  });
  await page
    .locator("#ed-body [data-brand-preview]")
    .first()
    .evaluate((n) => n.click());
  await expect(page.locator('#dm-visual-picker[data-kind="car"]')).toBeVisible();

  const colori = await page.evaluate(() =>
    [...document.querySelectorAll("#dm-visual-picker .dm-picker-option")]
      .map((opzione) => {
        const marchio = opzione.querySelector(".dm-car-brand");
        if (!marchio) return null;
        const scritto = (marchio.getAttribute("style") || "").match(/color:\s*(#[0-9a-f]{3,8})/i);
        return scritto
          ? {
              nome: opzione.querySelector("b")?.textContent,
              calcolato: getComputedStyle(marchio).color,
            }
          : null;
      })
      .filter(Boolean),
  );
  expect(colori.length, "ci sono marchi con un colore dichiarato").toBeGreaterThan(10);
  /* Nessuno di quelli che un colore ce l'ha finisce dell'inchiostro unico. */
  const spenti = colori.filter((voce) => voce.calcolato === "rgb(17, 24, 39)");
  expect(spenti, "nessun marchio viene ridipinto dell'inchiostro unico").toEqual([]);
  /* E non sono tutti uguali fra loro: e' il punto. */
  expect(new Set(colori.map((voce) => voce.calcolato)).size).toBeGreaterThan(5);
});
