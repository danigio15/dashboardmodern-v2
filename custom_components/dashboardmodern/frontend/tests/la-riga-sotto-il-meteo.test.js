/* La riga sotto il meteo dice solo quello che ha qualcosa da dire (#356).
 *
 * «Una barra sotto la parte meteo che mostra le indicazioni principali. Icona
 * + organico. Lampadina con luci accese. Tapparella con tapparelle aperte
 * ecc.»
 *
 * Il conto non si rifa': arriva dai modelli delle tessere della Home, quelli
 * veri. Queste prove passano modelli fatti come li fa la Home e pretendono le
 * pastiglie giuste — nessuna quando non c'e' niente da dire, che e' la meta'
 * della richiesta: una riga che dice «0 luci accese» occupa spazio per non
 * dire niente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  VOCI_DELLA_BARRA,
  normalizzaBarra,
  pastiglieDellaCasa,
} from "../src/core/come-sta-la-casa.js";

const luci = (accese, spente = 0) => ({
  key: "luci",
  icon: "💡",
  on: Array.from({ length: accese }, (_, i) => ({ name: `Luce ${i + 1}`, on: true })),
  rows: Array.from({ length: accese + spente }, (_, i) => ({ name: `Luce ${i + 1}` })),
});

const tapparelle = (aperte) => ({
  key: "tapparelle",
  icon: "🪟",
  open: Array.from({ length: aperte }, (_, i) => ({ name: `Finestra ${i + 1}`, open: true })),
});

const rifiuti = (quando) => ({
  key: "rifiuti",
  icon: "♻️",
  rows: [
    { glyph: "🍎", name: "Organico", quando, giorni: quando === "oggi" ? 0 : 1 },
    { glyph: "🧴", name: "Plastica", quando: "settimana", giorni: 6 },
  ],
});

test("una casa a riposo non disegna nessuna pastiglia", () => {
  const pastiglie = pastiglieDellaCasa([luci(0, 4), tapparelle(0)], {});
  assert.deepEqual(pastiglie, []);
});

test("quello che e' acceso si conta dal modello della tessera, non a mano", () => {
  const pastiglie = pastiglieDellaCasa([luci(3, 5), tapparelle(2)], {});
  assert.deepEqual(
    pastiglie.map((voce) => [voce.chiave, voce.conto]),
    [
      ["luci", 3],
      ["tapparelle", 2],
    ],
  );
  // I nomi viaggiano con la pastiglia: sono quelli che finiscono nel titolo.
  assert.deepEqual(pastiglie[0].nomi, ["Luce 1", "Luce 2", "Luce 3"]);
  assert.equal(pastiglie[0].icona, "💡");
});

test("il ritiro si annuncia oggi e domani, non fra sei giorni", () => {
  for (const quando of ["oggi", "domani"]) {
    const [pastiglia] = pastiglieDellaCasa([rifiuti(quando)], {});
    assert.equal(pastiglia.chiave, "rifiuti");
    assert.equal(pastiglia.quando, quando);
    assert.equal(pastiglia.nome, "Organico");
    // Il disegno e' quello del bidone, non il simbolo generico della tessera.
    assert.equal(pastiglia.icona, "🍎");
  }
  assert.deepEqual(pastiglieDellaCasa([rifiuti("settimana")], {}), []);
});

test("l'antifurto parla quando e' inserito o suona, non quando e' spento", () => {
  const centrale = (stato) => ({
    key: "sicurezza",
    icon: "🛡️",
    value: stato.value,
    armed: stato.armed,
    triggered: stato.triggered,
  });
  assert.deepEqual(pastiglieDellaCasa([centrale({ value: "Disinserito" })], {}), []);
  const [inserito] = pastiglieDellaCasa([centrale({ value: "Inserito", armed: true })], {});
  assert.equal(inserito.valore, "Inserito");
  assert.equal(inserito.avviso, false);
  const [suona] = pastiglieDellaCasa([centrale({ value: "Allarme!", triggered: true })], {});
  assert.equal(suona.avviso, true);
});

test("una voce spenta nella configurazione non esce, anche se ha da dire", () => {
  const pastiglie = pastiglieDellaCasa([luci(2), tapparelle(1)], {
    barra: { voci: { luci: false } },
  });
  assert.deepEqual(
    pastiglie.map((voce) => voce.chiave),
    ["tapparelle"],
  );
});

test("le pastiglie escono nell'ordine delle voci, non in quello dei modelli", () => {
  const pastiglie = pastiglieDellaCasa(
    [tapparelle(1), luci(1), rifiuti("oggi")],
    { posta: { arrivata: true } },
  );
  assert.deepEqual(
    pastiglie.map((voce) => voce.chiave),
    ["posta", "rifiuti", "luci", "tapparelle"],
  );
});

test("di serie ci sono tutte le voci, e una salvata a meta' non ne perde nessuna", () => {
  const serie = normalizzaBarra(null);
  assert.deepEqual(
    Object.keys(serie.voci).sort(),
    VOCI_DELLA_BARRA.map((voce) => voce.chiave).sort(),
  );
  assert.equal(
    Object.values(serie.voci).every(Boolean),
    true,
    "una voce senza niente da dire non si vede comunque: partire con tutte accese non riempie niente",
  );
  // Una configurazione vecchia, scritta quando una voce non esisteva ancora.
  const vecchia = normalizzaBarra({ voci: { luci: false }, posta: " binary_sensor.posta " });
  assert.equal(vecchia.voci.luci, false);
  assert.equal(vecchia.voci.tapparelle, true);
  assert.equal(vecchia.posta, "binary_sensor.posta");
});

test("una tessera che non c'e' non lascia buchi, e un modello storto non fa cadere niente", () => {
  assert.deepEqual(pastiglieDellaCasa(null, {}), []);
  assert.deepEqual(pastiglieDellaCasa([null, { key: "luci" }, { key: "boh", on: [1] }], {}), []);
});
