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
    const base = [...document.querySelectorAll("script")]
      .map((nodo) => nodo.src)
      .find((src) => src.includes("modules-entry"));
    const radice = base ? base.replace(/\/legacy\/modules-entry.*$/, "") : "";
    const catalogo = await import(`${radice}/src/core/personalization-catalog.js`);
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
