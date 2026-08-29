/* Una raffica di cambi di stato fa un disegno solo.
 *
 * Home Assistant manda un evento per ogni entita' che cambia, e in una casa
 * vera sono decine al secondo. La plancia rispondeva ridisegnando tutto ogni
 * volta: settecento righe di render piu' sedici moduli agganciati, per ogni
 * singolo sensore che si muoveva. Misurato prima di questa correzione:
 * centosettanta cambi di stato facevano centosettanta disegni e 1125
 * millisecondi dentro render, su una plancia quasi vuota e su un computer. Su
 * un telefono, con una casa vera, e' la sezione che si impasta mentre la si
 * guarda.
 *
 * Adesso la risposta agli eventi si mette in coda e disegna una volta per
 * fotogramma. Chi chiama render() a mano — un salvataggio, un cambio di pagina
 * — continua ad averlo subito: quella meta' della prova conta quanto la prima,
 * perche' rimandare anche quelli vorrebbe dire vedere il vecchio valore per un
 * fotogramma dopo aver premuto.
 */
import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";

test("una raffica di eventi fa un disegno solo, e la chiamata a mano resta subito", async ({
  page,
}, testInfo) => {
  await bootConsolidatedDashboard(page, "dashboard.html", testInfo);
  await expect
    .poll(() => page.evaluate(() => typeof window.cdRenderSoon), { timeout: 20_000 })
    .toBe("function");

  const esito = await page.evaluate(async () => {
    const originale = window.render;
    let disegni = 0;
    window.render = function contato(...args) {
      disegni += 1;
      return originale.apply(this, args);
    };
    try {
      // Cento eventi come li manda Home Assistant durante un giro di sensori.
      for (let evento = 0; evento < 100; evento += 1) window.cdRenderSoon();
      const durante = disegni;
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const dopoLaRaffica = disegni;

      // E una chiamata diretta non aspetta nessun fotogramma.
      window.render();
      return { durante, dopoLaRaffica, dopoLaChiamata: disegni };
    } finally {
      window.render = originale;
    }
  });

  // Durante la raffica non si disegna: si prende nota e basta.
  expect(esito.durante).toBe(0);
  // Alla fine del fotogramma si disegna una volta sola, non cento.
  expect(esito.dopoLaRaffica).toBe(1);
  // Chi chiama render() lo ottiene subito, sincrono.
  expect(esito.dopoLaChiamata).toBe(2);
});
