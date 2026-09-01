/* La plancia non si ricarica da sola.
 *
 * Nel filmato, quattro secondi dopo l'apertura, lo schermo diventa bianco, il
 * velo di avvio torna su, e dopo altri quattro secondi la plancia riparte —
 * sulla Home, buttando via la pagina Energia che si stava guardando. Non e' un
 * disegno che sfarfalla: e' `location.reload()`.
 *
 * A chiamarlo era il tiraggio della configurazione da Home Assistant. All'avvio
 * la plancia chiede a HA la configurazione dell'utente; se il timbro dell'ora
 * di HA e' piu' recente di quello di qui, la applicava e RICARICAVA la pagina.
 * Cioe': ogni volta che si e' toccata la configurazione da un'altra parte —
 * il computer, un'altra plancia — la prima apertura sul telefono costava due
 * avvii invece di uno, e chi stava guardando qualcosa se lo vedeva sparire.
 *
 * Il ricaricamento non serve: applicare dal vivo e' la stessa cosa che fa
 * l'editor a ogni salvataggio. Lo store riceve il fotogramma e avvisa le
 * sezioni, `cdApplyNavVis()` rilegge quali sezioni vanno nella barra, `render()`
 * ridisegna il guscio. La prova su documento vero
 * (`e2e/la-configurazione-nuova-arriva-senza-ricaricare.spec.js`) mostra che lo
 * schermo che ne esce e' lo stesso di un avvio pulito con quella
 * configurazione.
 *
 * Qui si guarda la sorgente, perche' e' l'unico posto dove si vede che il
 * ricaricamento NON c'e' piu': dentro `ws.onmessage` non ci si arriva da fuori.
 * I ricaricamenti rimasti sono sei, tutti chiesti da una persona che ha
 * appena premuto qualcosa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const RUNTIME = ["dashboard-runtime-it.js", "dashboard-runtime-en.js"];
const sorgente = (nome) => readFileSync(new URL(`../legacy/${nome}`, import.meta.url), "utf8");

/* I ricaricamenti leciti stanno tutti dentro sei funzioni, e sono sei tasti:
 * auto-rilevamento, salva generale, importa, azzera tutto, prova il token del
 * wizard, chiudi il wizard. Nessuno parte da solo. */
const CHIESTI_DA_UNA_PERSONA = Object.freeze([
  "edAutoRileva",
  "edSaveGeneral",
  "edImport",
  "edResetAll",
  "wzTestToken",
  "wzFinish",
]);

/* La funzione dentro cui cade una posizione: l'ultima `function nome(` che
 * viene prima. Il guscio e' un file solo, tutto a funzioni di primo livello. */
function funzioneCheContiene(testo, posto) {
  let nome = "?";
  for (const trovata of testo.slice(0, posto).matchAll(/function (\w+)\s*\(/g)) nome = trovata[1];
  return nome;
}

for (const nome of RUNTIME) {
  test(`${nome}: il tiraggio da HA applica e basta, non ricarica`, () => {
    const testo = sorgente(nome);
    const inizio = testo.indexOf("m.id === window._cdSyncReqId");
    assert.ok(inizio > 0, "il ramo del tiraggio non si trova piu': la prova va riscritta");
    const ramo = testo.slice(inizio, testo.indexOf("\n      return;\n", inizio));

    assert.doesNotMatch(
      ramo,
      /location\.reload\(\)/,
      "il tiraggio ricarica ancora la pagina: e' il salto bianco del filmato",
    );
    assert.match(ramo, /cdApplyNavVis\(\)/, "senza rileggere la barra restano linguette di prima");
    assert.match(ramo, /render\(\)/, "senza ridisegnare il guscio resta la configurazione vecchia");
  });

  test(`${nome}: gli unici ricaricamenti rimasti li ha chiesti una persona`, () => {
    const testo = sorgente(nome);
    const dove = [];
    for (
      let i = testo.indexOf("location.reload()");
      i >= 0;
      i = testo.indexOf("location.reload()", i + 1)
    )
      dove.push(funzioneCheContiene(testo, i));
    assert.deepEqual(
      dove,
      CHIESTI_DA_UNA_PERSONA,
      "un ricaricamento e' comparso, sparito o si e' spostato: se e' automatico e' il salto bianco che torna",
    );
  });

  test(`${nome}: applicare la configurazione conta cio' che cambia, non cio' che arriva`, () => {
    /* Contando ogni chiave del carico, il conto era sempre maggiore di zero
     * anche quando la configurazione era identica a quella gia' qui — e quel
     * numero era la ragione per rifare tutto. */
    const testo = sorgente(nome);
    const inizio = testo.indexOf("function cdSyncApply(");
    assert.ok(inizio > 0);
    const corpo = testo.slice(inizio, testo.indexOf("\n}", inizio));
    assert.match(
      corpo,
      /data\.dm_dashboard_state !== localStorage\.getItem\('dm_dashboard_state'\)/,
      "il fotogramma si riapplica anche quando e' lo stesso",
    );
    assert.match(
      corpo,
      /data\[k\] !== localStorage\.getItem\(k\)/,
      "le chiavi si riscrivono anche quando sono le stesse",
    );
  });
}
