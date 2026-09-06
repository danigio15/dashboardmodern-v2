/* «Il nome dell'UPS viene coperto dall'effetto dello sfondo» (#343).
 *
 * Il nome del gruppo stava DENTRO il palco, come titolo nel flusso, e sopra di
 * lui la scena — position:absolute, inset:0 — che il palco lo copre da bordo a
 * bordo: tutto quello che la scena disegna sta più in alto di lui per il solo
 * fatto di essere posizionato.
 *
 * Che il posto giusto fosse fuori lo diceva già il foglio di stile, che parla
 * del titolo come fratello del palco. Il modulo si installa da sé appena
 * importato, quindi qui si legge il sorgente.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(
  new URL("../src/sections/ups-section.js", import.meta.url),
  "utf8",
);

test("il nome del gruppo è fratello del palco, non figlio", () => {
  const disegno = sorgente.slice(sorgente.indexOf("dove.innerHTML = scene"));
  const titolo = disegno.indexOf('<h3 class="dm-ups-titolo">');
  const palco = disegno.indexOf('<div class="dm-ups-stage">');
  assert.ok(titolo > 0 && palco > 0, "servono tutti e due");
  assert.ok(titolo < palco, "il nome viene prima del palco, e fuori");
});

test("il foglio di stile e il disegno parlano della stessa parentela", () => {
  /* Queste regole valgono solo fra fratelli: finché il titolo stava dentro non
   * si applicavano mai, ed è la prova che il markup si era allontanato dal
   * foglio senza che nessuno se ne accorgesse. */
  assert.match(sorgente, /\.dm-ups-stage \+ \.dm-ups-titolo\{margin-top:22px\}/);
  assert.match(sorgente, /\.dm-ups-stage \+ \.dm-ups-stage\{margin-top:22px\}/);
});

test("le targhette di lato non escono dal palco", () => {
  /* Il palco taglia quello che gli esce dai bordi: su un telefono il dodici
   * per cento sono quarantasette pixel, e mezza pastiglia finiva fuori. */
  assert.match(sorgente, /rete: `left:max\(12%,\$\{RIENTRO\}\)/);
  assert.match(sorgente, /casa: `left:min\(88%,100% - \$\{RIENTRO\}\)/);
  /* E dove lo schermo si stringe, le parole vanno a capo invece di allargarsi
   * oltre il telaio. */
  assert.match(sorgente, /\.dm-ups-nome\{\s*max-width:min\(40vw,150px\);white-space:normal/);
});
