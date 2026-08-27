/* Tutte le finestre della plancia si presentano allo stesso modo.
 *
 * Ogni sezione apre la sua, e tutte passano per `.modal-wrapper` e
 * `.modal-card`: erano nate una alla volta e si vedeva. La veste sta in un
 * posto solo, in coda al foglio, ed e' li' che si guarda se qualcosa cambia.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const fogli = ["dashboard-runtime-it.css", "dashboard-runtime-en.css"];
const leggi = (file) => readFileSync(join(QUI, "..", "legacy", file), "utf8");

for (const file of fogli) {
  test(`${file}: la veste dei popup c'e' ed e' una sola`, () => {
    const foglio = leggi(file);
    const coda = foglio.slice(foglio.indexOf("I popup, tutti con la stessa veste"));
    assert.ok(coda, "il blocco della veste esiste");

    /* Il filo colorato in cima e' dipinto nello sfondo: la finestra e' lei
     * stessa il contenitore che scorre, e un elemento appoggiato sopra
     * scorrerebbe via col contenuto lasciando il bordo nudo. */
    assert.match(coda, /background-size: 100% 3px;/);
    assert.doesNotMatch(coda, /\.modal-card:not\(\.ed-shell\)::before/);

    /* La scheda della configurazione resta fuori dalla parte geometrica: ha
     * una forma sua, e imporle questa sarebbero due padroni sulla stessa
     * misura. */
    for (const regola of coda.match(/^\.modal-card[^{\n]*\{/gm) || [])
      if (/border-radius|padding/.test(coda.slice(coda.indexOf(regola), coda.indexOf(regola) + 400)))
        assert.match(regola, /:not\(\.ed-shell\)/, `${regola} deve lasciar stare l'editor`);

    /* Chi ha chiesto meno movimento non lo riceve. */
    assert.match(coda, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(coda, /\.modal-card \{ transform: none !important; \}/);

    /* E il tema scuro non riceve un anello bianco cucito nel bordo. */
    assert.doesNotMatch(coda, /inset 0 0 0 1px #fff/);
    assert.match(coda, /html\[data-theme="dark"\] \.modal-wrapper/);
  });
}
