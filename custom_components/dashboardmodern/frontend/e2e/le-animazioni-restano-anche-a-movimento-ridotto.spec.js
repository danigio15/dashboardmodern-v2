/* «Continuo a non vedere animazioni da desktop con Chrome.»
 *
 * Su molti desktop Windows «Effetti animazione» e' disattivato a livello di
 * sistema — spesso senza che nessuno l'abbia mai scelto — e Chrome lo passa
 * alle pagine come prefers-reduced-motion: reduce. I rami CSS che rispettavano
 * quell'impostazione spegnevano il cestello che gira, il vapore, il led, la
 * goccia dell'allagamento: da desktop gli elettrodomestici in funzione
 * sembravano fermi, e gli avvisi pure. Segnalato tre volte.
 *
 * Questi movimenti sono informazione, non decorazione: dicono che la macchina
 * sta lavorando in questo momento. La prova emula esattamente quel desktop.
 */
import { expect, test } from "@playwright/test";
import { bootConsolidatedDashboard } from "./helpers/consolidated-runtime.js";

test.use({ contextOptions: { reducedMotion: "reduce" } });

test("con movimento ridotto gli elettrodomestici in funzione si muovono lo stesso", async ({
  page,
}, testInfo) => {
  await bootConsolidatedDashboard(page, "dashboard.html", testInfo);
  const emulato = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(emulato, "la prova deve girare sul desktop che riduce il movimento").toBe(true);

  await page.locator('.tab[data-tab="appliances-main"]').evaluate((button) => button.click());
  const inFunzione = page.locator(
    '#page-appliances-main .appl-main-view.active .appl-wide-card[data-appliance-state="running"]',
  );
  await expect(inFunzione).toHaveCount(1);

  // Il frigo in funzione ha la luce interna che pulsa e il led che respira.
  await expect
    .poll(() =>
      inFunzione.evaluate((card) => {
        const luce = card.querySelector(".dmh-light");
        const led = card.querySelector(".dmh-led");
        return {
          luce: luce ? getComputedStyle(luce).animationName : "manca",
          led: led ? getComputedStyle(led).animationName : "manca",
        };
      }),
    )
    .toEqual({ luce: "dmGlowPulse", led: "dmDotBreathe" });
});
