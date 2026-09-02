/* Il foglio di ogni finestra sta su un livello suo mentre e' in scena.
 *
 * Il lampo che si vede aprendo un popup sul telefono e' stato guardato
 * fotogramma per fotogramma, a centoventi al secondo. Non e' una banda bianca:
 * per UN fotogramma **lo sfondo del foglio sparisce** e si legge la pagina
 * attraverso, mentre tutto quello che c'e' scritto sopra resta al suo posto.
 *
 * Il momento non e' casuale. Il foglio si apre con `transform: scale(.9)
 * translateY(30px)` che va a `scale(1) translateY(0)` in 0,28 secondi. Mentre
 * una trasformazione e' in corso il browser tiene il foglio su un livello suo;
 * **quando l'animazione finisce quel livello lo smonta** e rifonde il foglio
 * dentro il velo, che ha una sfocatura di venti pixel. In quel singolo
 * fotogramma lo sfondo non e' ancora ridipinto. Misurato: apertura a 6,86 s,
 * lampo a 7,142 s — la transizione dura 0,28.
 *
 * La promozione a livello mentre la finestra e' in scena toglie lo smontaggio,
 * e quindi il fotogramma scoperto. Era stata data alla sola finestra dei
 * carichi; il motivo non era mai stato suo, e qui si sorveglia che valga per
 * tutte.
 *
 * Il lampo in se' non si riproduce in prova — sul banco il disegno lo fa la
 * CPU e non c'e' nessun livello da smontare. Quello che si sorveglia e' la
 * condizione che lo rende possibile: se la promozione manca, il browser il
 * livello lo smonta.
 */
import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("ogni finestra aperta tiene il suo foglio su un livello suo", async ({ page }) => {
  await page.goto("/legacy/dashboard.html");
  await page.waitForFunction(
    () => globalThis.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed === true,
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(1200);

  const esito = await page.evaluate(() => {
    const righe = [];
    for (const modale of document.querySelectorAll(".modal-wrapper")) {
      const card = modale.querySelector(":scope > .modal-card");
      if (!card) continue;
      // Chiusa: nessun livello tenuto vivo per niente — undici fogli a schermo
      // intero promossi a vuoto sono memoria buttata, ed e' il difetto che
      // beta4 aveva gia' corretto.
      modale.classList.remove("show");
      const chiusa = getComputedStyle(card).willChange;
      // In scena: il livello c'e'.
      modale.classList.add("show");
      const aperta = getComputedStyle(card).willChange;
      modale.classList.remove("show");
      righe.push({ id: modale.id, chiusa, aperta });
    }
    return righe;
  });

  expect(esito.length, "le finestre modali sono nel documento").toBeGreaterThan(5);
  for (const riga of esito) {
    expect(riga.aperta, `${riga.id}: in scena il foglio deve stare su un livello suo`).toContain(
      "transform",
    );
    expect(riga.chiusa, `${riga.id}: chiusa non deve tenere vivo nessun livello`).not.toContain(
      "transform",
    );
  }
});
