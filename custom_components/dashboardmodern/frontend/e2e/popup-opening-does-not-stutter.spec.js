/* All'apertura di una finestra si vedeva un tremolio.
 *
 * Le finestre chiuse non tengono piu' il vetro smerigliato: e' quello che le
 * rendeva care da tenere in giro su un telefono. Il prezzo pero' si era
 * spostato all'apertura — il browser deve costruire la sfocatura a schermo
 * intero tutta dentro lo stesso disegno, e su quel disegno il telefono perde un
 * fotogramma.
 *
 * La cura e' far salire la sfocatura insieme alla dissolvenza invece che di
 * scatto: la stessa mezza dozzina di disegni che il browser fa comunque per
 * sfumare l'opacita' portano su anche lo sfondo, un pezzo per volta.
 */
import { expect, test } from "@playwright/test";
import { PRIMARY } from "./helpers/variants.js";

/* Apre la finestra e misura quanto ha atteso ogni disegno. */
function openAndTime(page) {
  return page.evaluate(async () => {
    const modal = document.getElementById("weather-modal");
    modal.classList.remove("show");
    await new Promise((resolve) => setTimeout(resolve, 450));

    const waits = [];
    let previous = performance.now();
    let running = true;
    const tick = () => {
      const now = performance.now();
      waits.push(Math.round(now - previous));
      previous = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Qualche disegno a vuoto prima di aprire, per non contare l'avvio del giro.
    await new Promise((resolve) => setTimeout(resolve, 120));
    modal.classList.add("show");
    await new Promise((resolve) => setTimeout(resolve, 700));
    running = false;

    const opening = waits.slice(7);
    return Math.max(...opening);
  });
}

for (const variant of PRIMARY) {
  test(`${variant}: aprire una finestra non salta un fotogramma`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(() => Boolean(document.getElementById("weather-modal")), null, {
      timeout: 15000,
    });

    // Lo sfondo sfocato deve essere fra le cose che sfumano, aperta e chiusa:
    // e' questo che spalma il lavoro su tutta la dissolvenza.
    const transitions = await page.evaluate(() => {
      const modal = document.getElementById("weather-modal");
      const closed = getComputedStyle(modal).transitionProperty;
      modal.classList.add("show");
      const open = getComputedStyle(modal).transitionProperty;
      modal.classList.remove("show");
      return { closed, open };
    });
    expect(transitions.closed).toMatch(/backdrop-filter/);
    expect(transitions.open).toMatch(/backdrop-filter/);

    // E il conto si vede: nessun disegno deve durare piu' di due fotogrammi.
    // Il migliore di tre aperture, perche' una macchina condivisa puo' sempre
    // inciampare una volta; senza la cura inciampano tutte e tre.
    const times = [];
    for (let attempt = 0; attempt < 3; attempt += 1) times.push(await openAndTime(page));
    expect(Math.min(...times)).toBeLessThan(32);
  });
}
