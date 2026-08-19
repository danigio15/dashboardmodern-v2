/* Un telefono paga il vetro smerigliato anche quando non si vede.
 *
 * Sopra la Home stanno dodici finestre chiuse — meteo, clima, allarme,
 * carichi, lavatrice, auto, dettagli, tastierino, storico, conferma e i due
 * storici del server. Sono nascoste, ma restano larghe quanto lo schermo e
 * ognuna chiedeva al browser di sfocare tutto quello che aveva dietro: dodici
 * livelli a schermo intero che la GPU tiene in memoria e ricompone a ogni
 * scorrimento. Dentro due di quelle finestre girava anche una rotella di
 * caricamento, per sempre, senza che nessuno la stesse guardando.
 */
import { expect, test } from "@playwright/test";
import { PRIMARY } from "./helpers/variants.js";

function idleCost(page) {
  return page.evaluate(() => {
    const blurred = [];
    const spinning = [];
    for (const element of document.querySelectorAll("*")) {
      const box = element.getBoundingClientRect();
      if (!(box.width > 0 && box.height > 0)) continue;
      const style = getComputedStyle(element);
      const closed = element.closest(
        ".modal-wrapper:not(.show),.clima-popup-overlay:not(.show),.hist-overlay:not(.show),#srv-hist-overlay:not(.show)",
      );
      if (!closed) continue;
      const backdrop = style.backdropFilter || style.webkitBackdropFilter || "none";
      if (backdrop && backdrop !== "none") blurred.push(element.id || element.className);
      if (
        style.animationName !== "none" &&
        style.animationIterationCount === "infinite" &&
        style.animationPlayState !== "paused"
      ) {
        spinning.push(element.id || element.className);
      }
    }
    return { blurred, spinning };
  });
}

for (const variant of PRIMARY) {
  test(`${variant}: a closed overlay costs nothing to keep around`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.goto(`/legacy/${variant}`);
    await page.waitForFunction(() => Boolean(document.getElementById("weather-modal")), null, {
      timeout: 15000,
    });

    // Every overlay on the page is closed: none of them may blur or animate.
    await expect.poll(() => idleCost(page)).toEqual({ blurred: [], spinning: [] });

    // The frosted background is what makes a modal read as a modal: it comes
    // back the moment one opens, which is the only time anybody sees it.
    await page.evaluate(() => document.getElementById("weather-modal")?.classList.add("show"));
    const backdrop = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById("weather-modal"));
      return style.backdropFilter || style.webkitBackdropFilter;
    });
    expect(backdrop).toMatch(/blur/);
  });
}
