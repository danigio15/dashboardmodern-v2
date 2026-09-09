/* Chi galleggia in fondo alla pagina si porta dietro il suo spazio.
 *
 * Su un iPad il tasto «Storico» del microonde finiva dentro il cerchio di
 * Assist: premerlo apriva Assist. Il tasto galleggiante sta a novantasei pixel
 * dal fondo ed è alto cinquantadue — arriva a centoquarantotto — mentre la
 * pagina di spazio in fondo ne riservava centododici, quelli della barra. La
 * differenza era la fascia in cui una card poteva fermarsi sotto il tasto.
 *
 * E lo spazio da solo non bastava, perché non è dove finisce la pagina: è dove
 * finisce la parte UTILE della finestra. Senza dirlo al browser, qualunque
 * cosa portata in vista — da un salto, dalla tastiera, da un giro di
 * scrollIntoView — si fermava all'ultima riga di pixel disponibile, cioè
 * proprio sotto il tasto: si vedeva e non si premeva. La proprietà
 * scroll-padding-bottom è quella che lo dice, e va messa dove sta già il
 * padding, insieme a lui.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (nome) => readFileSync(new URL(`../src/sections/${nome}`, import.meta.url), "utf8");

test("la barra riserva lo spazio e dice dove finisce la parte utile", () => {
  const sorgente = leggi("navigation-section.js");
  assert.match(sorgente, /padding-bottom:calc\(112px \+ var\(--dm-fondo-di-sistema\)\)!important/);
  assert.match(
    sorgente,
    /scroll-padding-bottom:calc\(112px \+ var\(--dm-fondo-di-sistema\)\)!important/,
    "senza questo, quello che si porta in vista si ferma sotto la barra",
  );
});

test("Assist chiede il suo spazio in più, e solo mentre galleggia", () => {
  const sorgente = leggi("assist-section.js");
  /* Novantasei dal fondo più cinquantadue di tasto fanno centoquarantotto: la
   * riserva sta sopra, non sotto. */
  assert.match(sorgente, /bottom:calc\(96px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(sorgente, /width:52px;height:52px/);
  for (const regola of ["padding-bottom", "scroll-padding-bottom"])
    assert.match(
      sorgente,
      new RegExp(`${regola}:calc\\(160px \\+ var\\(--dm-fondo-di-sistema,0px\\)\\)!important`),
      `manca ${regola} nella riserva di Assist`,
    );
  /* La classe la mette e la toglie chi mette e toglie il tasto: spento Assist,
   * la pagina torna a finire dove è sempre finita. */
  assert.match(sorgente, /segnaCheGalleggia\(false\);/);
  assert.match(sorgente, /segnaCheGalleggia\(true\);/);
  assert.match(sorgente, /classList\?\.toggle\("dm-assist-galleggia"/);
  /* Due classi battono una: la riserva di Assist vince su quella della barra
   * senza che nessuno debba contare l'ordine dei fogli. */
  assert.match(sorgente, /body\.dm-assist-galleggia\.cd-nav-fixed\{/);
});
