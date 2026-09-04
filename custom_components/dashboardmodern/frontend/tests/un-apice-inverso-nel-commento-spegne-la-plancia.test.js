/* Un apice inverso in un commento CSS spegne la plancia.
 *
 * Gli stili delle sezioni vivono in template literal, e i commenti CSS li'
 * dentro sono testo: un «`nome`» scritto per abitudine dentro uno di quei
 * commenti CHIUDE la stringa, e quello che segue diventa codice — «data is
 * not defined», il bootstrap dei moduli si ferma, e ogni sezione installata
 * dopo quella non nasce. esbuild non se ne accorge, perche' il pezzo che
 * resta e' JavaScript valido; le prove sui sorgenti nemmeno, perche' leggono
 * il testo e non lo eseguono. E' successo due volte in una versione sola.
 *
 * Questa prova scorre ogni modulo come farebbe il motore — stringhe, commenti,
 * template e le loro espressioni — e pretende che nessun template literal si
 * chiuda mentre un commento CSS aperto al suo interno non e' ancora finito.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const SRC = join(QUI, "..", "src");

/* Una barra apre una regex quando quello che la precede non puo' chiudere un
 * valore: una parentesi aperta, una virgola, un operatore, l'inizio di una
 * istruzione, `return`. Dopo un valore — un nome, un numero, una parentesi
 * chiusa — e' una divisione. */
function iniziaUnaRegex(source, at) {
  let dietro = at - 1;
  while (dietro >= 0 && /\s/.test(source[dietro])) dietro -= 1;
  if (dietro < 0) return true;
  const prima = source[dietro];
  if ("(,=:[!&|?{};+-*%<>~^".includes(prima)) return true;
  const parola = /([A-Za-z_$][\w$]*)$/.exec(source.slice(Math.max(0, dietro - 12), dietro + 1));
  return Boolean(parola && /^(return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/.test(parola[1]));
}

function fineDellaRegex(source, at) {
  let classe = false;
  for (let i = at + 1; i < source.length; i += 1) {
    const c = source[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === "\n") return i - 1;
    if (classe) {
      if (c === "]") classe = false;
      continue;
    }
    if (c === "[") classe = true;
    else if (c === "/") {
      let fine = i;
      while (/[a-z]/.test(source[fine + 1] || "")) fine += 1;
      return fine;
    }
  }
  return source.length;
}

/** Le righe dove un template si chiude dentro un commento CSS ancora aperto. */
export function apiciInversiNeiCommenti(source) {
  const trovati = [];
  /* Lo stato e' una pila: un template puo' contenere `${}` che contiene un
   * altro template. In cima c'e' quello che si sta leggendo adesso. */
  const pila = [{ tipo: "codice", graffe: 0 }];
  let riga = 1;
  for (let at = 0; at < source.length; at += 1) {
    const c = source[at];
    const prossimo = source[at + 1];
    if (c === "\n") riga += 1;
    const cima = pila[pila.length - 1];
    if (cima.tipo === "commento-riga") {
      if (c === "\n") pila.pop();
      continue;
    }
    if (cima.tipo === "commento-blocco") {
      if (c === "*" && prossimo === "/") {
        pila.pop();
        at += 1;
      }
      continue;
    }
    if (cima.tipo === "stringa") {
      if (c === "\\") at += 1;
      else if (c === cima.apice) pila.pop();
      else if (c === "\n") pila.pop();
      continue;
    }
    if (cima.tipo === "template") {
      if (c === "\\") {
        at += 1;
        continue;
      }
      /* Un commento CSS comincia con «/* » e uno spazio: `accept="image/*"` in
       * un template HTML non e' un commento. */
      if (c === "/" && prossimo === "*" && /\s/.test(source[at + 2] || "")) {
        cima.commentoCss = riga;
        at += 1;
        continue;
      }
      if (c === "*" && prossimo === "/") {
        cima.commentoCss = 0;
        at += 1;
        continue;
      }
      if (c === "$" && prossimo === "{") {
        pila.push({ tipo: "codice", graffe: 0, espressione: true });
        at += 1;
        continue;
      }
      if (c === "`") {
        if (cima.commentoCss) trovati.push({ riga, apertoAlla: cima.commentoCss, templateAlla: cima.apertoAlla });
        pila.pop();
      }
      continue;
    }
    /* codice */
    if (c === "/" && prossimo === "/") pila.push({ tipo: "commento-riga" });
    else if (c === "/" && prossimo === "*") {
      pila.push({ tipo: "commento-blocco" });
      at += 1;
    } else if (c === "/" && iniziaUnaRegex(source, at)) {
      /* Una regex puo' portare apici e apici inversi — /["\\]/g — e non sono
       * stringhe: si salta fino alla barra che la chiude, classi comprese. */
      at = fineDellaRegex(source, at);
    } else if (c === '"' || c === "'") pila.push({ tipo: "stringa", apice: c });
    else if (c === "`") pila.push({ tipo: "template", commentoCss: 0, apertoAlla: riga });
    else if (c === "{") cima.graffe += 1;
    else if (c === "}") {
      if (cima.espressione && cima.graffe === 0) pila.pop();
      else cima.graffe -= 1;
    }
  }
  return trovati;
}

test("il rilevatore riconosce l'apice inverso nel commento, e lascia in pace il resto", () => {
  const rotto = "const css = `\n  .a{color:red}\n  /* vedi `x` */\n  .b{}\n`;";
  assert.deepEqual(
    apiciInversiNeiCommenti(rotto).map((v) => v.riga),
    [3],
  );
  const sano = "const css = `\n  /* vedi «x» */\n  .b{content:${JSON.stringify(`ok`)}}\n`; // fine `qui`\n/* e `qui` */";
  assert.deepEqual(apiciInversiNeiCommenti(sano), []);
  const annidato = "const a = `x ${cond ? `/* ${y} */` : \"\"} /* aperto ${z} chiuso */ fine`;";
  assert.deepEqual(apiciInversiNeiCommenti(annidato), []);
  /* Una regex con apici dentro non e' una stringa: /["\\]/g non apre niente. */
  const conRegex =
    "const s = `[a=\"${x.replace(/[\"\\\\]/g, \"\\\\$&\")}\"]`;\nconst d = a / b / c;\n/* `dopo` */\nconst t = `\n/* `x` */\n`;";
  assert.deepEqual(apiciInversiNeiCommenti(conRegex).map((v) => v.riga), [5]);
});

test("nessun modulo chiude un template dentro un commento CSS", () => {
  const cartelle = ["sections", "core"];
  const colpevoli = [];
  for (const cartella of cartelle)
    for (const nome of readdirSync(join(SRC, cartella)).filter((f) => f.endsWith(".js"))) {
      const trovati = apiciInversiNeiCommenti(readFileSync(join(SRC, cartella, nome), "utf8"));
      for (const voce of trovati)
        colpevoli.push(
          `${cartella}/${nome}:${voce.riga} (commento aperto alla ${voce.apertoAlla}, template aperto alla ${voce.templateAlla})`,
        );
    }
  assert.deepEqual(colpevoli, []);
});
