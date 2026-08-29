/* Nessuna decisione di stile ha due padroni che dicono cose diverse.
 *
 * Il difetto e' silenzioso finche' non morde. Due fogli che non si parlano
 * dichiarano la stessa proprieta' sullo stesso selettore: finche' i valori
 * coincidono non si vede niente, il giorno che uno dei due cambia vince quello
 * che capita di caricare per ultimo, e la modifica «non fa effetto». E' cosi'
 * che la scheda del Clima e' rimasta per mesi con quattordici misure decise da
 * due fogli in disaccordo — la card alta 248px o senza minimo, il numero
 * grande 46px o 28px — su un markup che nel frattempo nessuno disegnava piu'.
 *
 * Cosa conta come conflitto, e cosa no. Una regola dentro
 * `@media(max-width:760px)` non contende quella fuori: e' l'override del
 * telefono, ed e' esattamente il modo in cui si scrive una pagina responsiva.
 * Per questo la chiave porta con se' il contesto della at-rule. Senza quella
 * distinzione il conto diceva trentasette conflitti dove ce n'erano tre, e un
 * numero gonfiato e' peggio di nessun numero: si smette di guardarlo.
 *
 * Due fogli che dichiarano lo stesso valore restano ammessi. Sono peso morto,
 * non un difetto: nessuno vede niente di sbagliato, e stringere anche su
 * quelli renderebbe questa prova un ostacolo invece di una rete.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const QUI = dirname(fileURLToPath(import.meta.url));
const CARTELLE = [join(QUI, "..", "src", "sections"), join(QUI, "..", "src", "core")];

function sorgenti() {
  const fuori = [];
  for (const cartella of CARTELLE)
    for (const nome of readdirSync(cartella).filter((n) => n.endsWith(".js")))
      fuori.push({ nome, testo: readFileSync(join(cartella, nome), "utf8") });
  return fuori;
}

/* Spezza il CSS in pezzi, ognuno col contesto della at-rule che lo contiene. */
function pezziConContesto(css) {
  const pezzi = [];
  const re = /@(media|supports|container)([^{]*)\{/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(css))) {
    pezzi.push({ ctx: "", corpo: css.slice(ultimo, m.index) });
    let livello = 1;
    let i = m.index + m[0].length;
    for (; i < css.length && livello > 0; i++) {
      if (css[i] === "{") livello += 1;
      else if (css[i] === "}") livello -= 1;
    }
    pezzi.push({
      ctx: `@${m[1]}${m[2].replace(/\s+/g, " ").trim()}`,
      corpo: css.slice(m.index + m[0].length, i - 1),
    });
    ultimo = i;
    re.lastIndex = i;
  }
  pezzi.push({ ctx: "", corpo: css.slice(ultimo) });
  return pezzi;
}

/* I passi di un'animazione non sono contesi: ogni modulo ha i suoi fotogrammi,
 * col proprio nome, e `50%` dentro l'uno non c'entra con `50%` dentro l'altro. */
const PASSO_DI_ANIMAZIONE = /^(?:\d+(?:\.\d+)?%|from|to)$/i;

function censimento() {
  const decisioni = new Map();
  for (const { nome, testo } of sorgenti()) {
    for (const blocco of testo.matchAll(/`([^`\\]|\\.)*`/g)) {
      const css = blocco[0].slice(1, -1).replace(/\/\*[\s\S]*?\*\//g, "");
      if (!/[.#:\w][^{}]*\{[^{}]*:[^{}]*\}/.test(css)) continue;
      for (const { ctx, corpo } of pezziConContesto(css)) {
        for (const regola of corpo.matchAll(/([^{}@][^{}]*)\{([^{}]*)\}/g)) {
          const selettori = regola[1]
            .split(",")
            .map((s) => s.replace(/\s+/g, " ").trim())
            .filter(Boolean);
          for (const dichiarazione of regola[2].split(";")) {
            const taglio = dichiarazione.indexOf(":");
            if (taglio < 0) continue;
            const proprieta = dichiarazione.slice(0, taglio).trim().toLowerCase();
            if (!/^[-a-z]+$/.test(proprieta)) continue;
            const valore = dichiarazione
              .slice(taglio + 1)
              .replace(/!\s*important/i, "")
              .replace(/\s+/g, " ")
              .trim();
            for (const selettore of selettori) {
              if (PASSO_DI_ANIMAZIONE.test(selettore)) continue;
              const chiave = `${ctx}§${selettore}|${proprieta}`;
              if (!decisioni.has(chiave)) decisioni.set(chiave, new Map());
              const padroni = decisioni.get(chiave);
              const suo = padroni.get(nome) || new Set();
              suo.add(valore);
              padroni.set(nome, suo);
            }
          }
        }
      }
    }
  }
  return decisioni;
}

test("nessuna regola e' decisa da due fogli che dicono cose diverse", () => {
  const decisioni = censimento();
  assert.ok(
    decisioni.size > 10_000,
    `il censimento dovrebbe vedere migliaia di decisioni, ne ha viste ${decisioni.size}`,
  );
  const discordi = [];
  for (const [chiave, padroni] of decisioni) {
    if (padroni.size < 2) continue;
    const valori = new Set([...padroni.values()].flatMap((v) => [...v]));
    if (valori.size < 2) continue;
    const dettaglio = [...padroni]
      .map(([nome, v]) => `      ${[...v].join(" / ")}   <- ${nome}`)
      .join("\n");
    discordi.push(`  ${chiave}\n${dettaglio}`);
  }
  assert.deepEqual(
    discordi,
    [],
    "queste decisioni hanno due padroni con valori diversi: vince chi carica per " +
      "ultimo, e chi cambia il valore nel foglio che perde non vede succedere " +
      `niente.\n${discordi.join("\n")}`,
  );
});
