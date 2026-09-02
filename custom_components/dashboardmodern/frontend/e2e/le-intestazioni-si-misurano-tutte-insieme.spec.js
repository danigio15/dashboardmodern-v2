/* Le intestazioni di pagina si misurano tutte insieme.
 *
 * Il giro era per pagina: guarda dove va, scrivila, rileggi quanto e' larga.
 * Ogni scrittura invalida lo stile, ogni lettura che le viene dietro obbliga il
 * browser a ricalcolarlo tutto prima di rispondere. Nove pagine, nove ricalconi
 * completi: cinquanta millisecondi l'uno, quasi ottocento in un modulo che
 * scrive tre variabili CSS — un quarto del tempo di avvio su un telefono.
 *
 * Quello che si sorveglia qui non e' il tempo (che cambia da macchina a
 * macchina) ma la sua causa: quante volte, in un solo passaggio, una lettura
 * viene dietro a una scrittura. Se i quattro tempi restano separati il
 * passaggio ne ha una sola, e la spesa non cresce col numero delle pagine.
 */
import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("un passaggio sulle intestazioni non alterna letture e scritture", async ({ page }) => {
  await page.addInitScript(() => {
    const stato = { sequenza: [], acceso: false };
    globalThis.__DM_SEQUENZA__ = stato;
    const nostra = () => String(new Error().stack || "").includes("page-masthead-section.js");
    const segna = (tipo) => {
      if (!stato.acceso || !nostra()) return;
      if (stato.sequenza[stato.sequenza.length - 1] !== tipo) stato.sequenza.push(tipo);
    };

    const gcs = globalThis.getComputedStyle.bind(globalThis);
    globalThis.getComputedStyle = function (...a) {
      segna("lettura");
      return gcs(...a);
    };
    for (const nome of ["getBoundingClientRect", "getClientRects"]) {
      const vero = Element.prototype[nome];
      Element.prototype[nome] = function (...a) {
        segna("lettura");
        return vero.apply(this, a);
      };
    }
    for (const nome of ["setProperty", "removeProperty"]) {
      const vero = CSSStyleDeclaration.prototype[nome];
      CSSStyleDeclaration.prototype[nome] = function (...a) {
        segna("scrittura");
        return vero.apply(this, a);
      };
    }
    const insertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function (...a) {
      segna("scrittura");
      return insertBefore.apply(this, a);
    };
  });

  await page.goto("/legacy/dashboard.html");
  await page.waitForFunction(
    () => globalThis.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed === true,
    null,
    { timeout: 60_000 },
  );
  // Le intestazioni esistono: e' un passaggio vero quello che si sta misurando.
  await expect(page.locator(".dm-page-mast").first()).toBeAttached();

  const sequenza = await page.evaluate(() => {
    const stato = globalThis.__DM_SEQUENZA__;
    stato.sequenza = [];
    stato.acceso = true;
    /* Quello che costa e' il PRIMO passaggio: quello che le costruisce, cioe'
     * l'unico in cui si scrive davvero. Un passaggio successivo non tocca
     * niente — i valori sono gia' quelli giusti e ogni scrittura e' protetta da
     * un confronto — e non direbbe niente sul costo dell'avvio. Si tolgono
     * quindi le intestazioni e si fa ricostruire tutto da capo. */
    for (const nodo of document.querySelectorAll(".dm-page-mast")) nodo.remove();
    globalThis.__DASHBOARDMODERN_PAGE_MASTHEADS__();
    stato.acceso = false;
    return stato.sequenza;
  });

  // Quante volte una lettura viene dietro a una scrittura: ognuna di queste e'
  // un ricalcolo completo dello stile che il browser deve fare per rispondere.
  const rilettura = sequenza.filter(
    (voce, i) => voce === "lettura" && sequenza[i - 1] === "scrittura",
  ).length;

  expect(sequenza.length).toBeGreaterThan(0);
  expect(rilettura, `sequenza osservata: ${sequenza.join(" → ")}`).toBeLessThanOrEqual(1);
});
