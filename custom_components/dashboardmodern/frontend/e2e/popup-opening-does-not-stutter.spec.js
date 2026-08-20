/* All'apertura di una finestra si vedeva un tremolio.
 *
 * Le finestre chiuse non tengono piu' il vetro smerigliato: e' quello che le
 * rendeva care da tenere in giro su un telefono. Il prezzo pero' si era
 * spostato all'apertura — il browser deve costruire la sfocatura a schermo
 * intero tutta dentro lo stesso disegno, e su quel disegno il telefono perde un
 * fotogramma. Misurato su una macchina scarica: il disegno piu' lungo passava
 * da 36ms a 23ms una volta curato.
 *
 * La cura e' far salire la sfocatura insieme alla dissolvenza invece che di
 * scatto. Vale per ogni cosa che il modulo spegne da chiusa, non solo per le
 * finestre: la barra in basso fa lo stesso mestiere ed era rimasta indietro —
 * il tremolio si vedeva anche li'.
 *
 * Qui si controlla la cura, non la misura. Quanto dura un disegno dipende da
 * cosa sta facendo la macchina in quel momento — sullo stesso computer lo
 * stesso identico codice ha dato 23ms da solo e 90ms con la suite intorno — e
 * un numero cosi' non e' un contratto, e' il meteo.
 */
import { expect, test } from "@playwright/test";
import { PRIMARY } from "./helpers/variants.js";

/* Cio' che viene spento da chiuso, e la classe che lo riapre. */
const SPENTI = [
  [".modal-wrapper", "show"],
  [".clima-popup-overlay", "show"],
  [".hist-overlay", "show"],
  ["#srv-hist-overlay", "show"],
  [".srv-history-overlay", "show"],
  ["nav.tabs.bottom-nav-bar", "visible"],
];

for (const variant of PRIMARY) {
  test(`${variant}: niente si sfoca di scatto quando si apre`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(() => Boolean(document.getElementById("weather-modal")), null, {
      timeout: 15000,
    });

    const esito = await page.evaluate((spenti) => {
      const colpevoli = [];
      const visti = new Set();
      let controllati = 0;
      for (const [selector, className] of spenti) {
        for (const element of document.querySelectorAll(selector)) {
          if (visti.has(element)) continue;
          visti.add(element);
          controllati += 1;
          const eraAperto = element.classList.contains(className);
          element.classList.add(className);
          const style = getComputedStyle(element);
          const blur = style.backdropFilter || style.webkitBackdropFilter || "none";
          const proprieta = style.transitionProperty;
          const sfuma = /backdrop-filter/.test(proprieta) || /\ball\b/.test(proprieta);
          if (!eraAperto) element.classList.remove(className);
          if (blur !== "none" && !sfuma) {
            colpevoli.push({
              chi: (element.id || element.className || element.tagName).toString().slice(0, 34),
              sfuma: proprieta.slice(0, 70),
            });
          }
        }
      }
      return { colpevoli, controllati };
    }, SPENTI);

    // La prova deve avere qualcosa da provare.
    expect(esito.controllati).toBeGreaterThan(8);
    // Chi si sfoca da aperto deve sfumare anche la sfocatura: altrimenti la
    // costruisce tutta in un disegno solo, ed e' li' che il telefono inciampa.
    expect(esito.colpevoli).toEqual([]);

    // E la sfocatura sale insieme alla dissolvenza, non su un tempo suo.
    const tempi = await page.evaluate(() => {
      const modal = document.getElementById("weather-modal");
      modal.classList.add("show");
      const style = getComputedStyle(modal);
      const proprieta = style.transitionProperty.split(",").map((value) => value.trim());
      const durate = style.transitionDuration.split(",").map((value) => value.trim());
      modal.classList.remove("show");
      const at = (name) => durate[proprieta.indexOf(name)] || "";
      return { opacity: at("opacity"), backdrop: at("backdrop-filter") };
    });
    expect(tempi.backdrop).toBe(tempi.opacity);
  });
}
