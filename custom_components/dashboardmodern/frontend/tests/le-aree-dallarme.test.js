/* «Nella sezione sicurezza si può inserire soltanto un alarm_control_panel, ma
 * se si hanno 2 aree la pagina ne gestisce una sola. Anche se c'è perimetrale e
 * totale non le comanda. Sarebbe funzionale poter mettere più pannelli, come
 * l'inserimento di telecamere» (#285).
 *
 * Le due cose sono la stessa. Una centrale che spezza la casa in aree, in Home
 * Assistant, è due entità distinte: ognuna con i suoi inserimenti dichiarati e
 * il suo stato. Leggendone una sola non si comandava l'altra — e nemmeno i suoi
 * inserimenti, che sono i suoi e non quelli della prima.
 *
 * Vale la regola di `piu-di-uno.js`, che a questo punto serve per la terza
 * volta: NON SI SPOSTA NIENTE. Quella che si comanda è sempre quella scritta
 * nella mappatura di sempre, e passare a un'altra area vuol dire scriverci la
 * sua — così il tastierino, il servizio che parte e la tessera della Home
 * continuano a leggere l'unico posto che hanno sempre letto.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CHIAVE_CENTRALE_SCELTA,
  CHIAVE_CENTRALI,
  PRIMA_CENTRALE,
  RIF_CENTRALE,
  alarmModes,
  centraleCorrente,
  centraliAllarme,
  entitaDellaCentrale,
  nomeDellaCentrale,
  overridesPerCentrale,
} from "../src/core/alarm-panel.js";

const MAPPATURE = {
  [RIF_CENTRALE]: "alarm_control_panel.giorno",
  "dm.ev_soc": "sensor.auto",
};

test("chi ha una centrale sola non ha un elenco, e non ha niente da migrare", () => {
  const lista = centraliAllarme([], MAPPATURE);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, PRIMA_CENTRALE);
  assert.equal(lista[0].corrente, true);
  assert.equal(entitaDellaCentrale(lista[0]), "alarm_control_panel.giorno");
  /* E chi non ha nemmeno quella non ha una centrale vuota: non ne ha. */
  assert.deepEqual(centraliAllarme([], {}), []);
});

test("quella che si comanda è quella scritta nella mappatura", () => {
  const elenco = [
    { id: "centrale", nome: "Giorno", caselle: { [RIF_CENTRALE]: "alarm_control_panel.vecchia" } },
    { id: "centrale-2", nome: "Notte", caselle: { [RIF_CENTRALE]: "alarm_control_panel.notte" } },
  ];
  /* La copia in elenco può essere vecchia: il rilevamento automatico e la
   * casella del guscio scrivono negli override, non in lista. Vince la
   * mappatura, che è quella da cui parte il comando. */
  const lista = centraliAllarme(elenco, MAPPATURE, "centrale");
  assert.equal(entitaDellaCentrale(lista[0]), "alarm_control_panel.giorno");
  assert.equal(centraleCorrente(lista).nome, "Giorno");
  const altra = centraliAllarme(elenco, MAPPATURE, "centrale-2");
  assert.equal(centraleCorrente(altra).nome, "Notte");
  assert.equal(entitaDellaCentrale(altra[1]), "alarm_control_panel.giorno");
  /* Una scelta che non esiste più non lascia la pagina senza centrale. */
  assert.equal(centraleCorrente(centraliAllarme(elenco, MAPPATURE, "sparita")).id, "centrale");
});

test("passare area riscrive la mappatura, e non tocca il resto", () => {
  const prossime = overridesPerCentrale(MAPPATURE, {
    caselle: { [RIF_CENTRALE]: "alarm_control_panel.notte" },
  });
  assert.equal(prossime[RIF_CENTRALE], "alarm_control_panel.notte");
  assert.equal(prossime["dm.ev_soc"], "sensor.auto", "l'auto non c'entra con l'antifurto");
  /* Un'area senza entità toglie la mappatura invece di lasciare quella di
   * prima: meglio un quadrante che dice «non configurata» di uno che comanda
   * la centrale sbagliata. */
  assert.equal(RIF_CENTRALE in overridesPerCentrale(MAPPATURE, { caselle: {} }), false);
});

test("ogni area porta i SUOI inserimenti, che è la seconda metà della richiesta", () => {
  /* «Anche se c'è perimetrale e totale non le comanda»: i tasti li dichiara la
   * centrale con `supported_features`, e leggendo una centrale sola si
   * mostravano i tasti di quella anche guardando l'altra. */
  const giorno = { attributes: { supported_features: 3 } };
  const notte = { attributes: { supported_features: 7 } };
  assert.deepEqual(
    alarmModes(giorno).map((voce) => voce.mode),
    ["home", "away", "disarm"],
  );
  assert.deepEqual(
    alarmModes(notte).map((voce) => voce.mode),
    ["home", "away", "night", "disarm"],
  );
  /* E il parziale — la «perimetrale» di molte centrali italiane — è un bit
   * come gli altri: `armed_custom_bypass`. */
  assert.ok(
    alarmModes({ attributes: { supported_features: 16 } }).some((voce) => voce.mode === "custom"),
  );
});

test("un'area ha sempre un nome", () => {
  assert.equal(nomeDellaCentrale({ nome: "Zona notte" }, 1), "Zona notte");
  assert.equal(nomeDellaCentrale({}, 0, "Area"), "Area");
  assert.equal(nomeDellaCentrale({}, 1, "Area"), "Area 2");
});

test("l'elenco e la scelta viaggiano insieme", () => {
  const persistenza = readFileSync(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  assert.match(persistenza, new RegExp(`"${CHIAVE_CENTRALI}"`));
  assert.match(persistenza, new RegExp(`"${CHIAVE_CENTRALE_SCELTA}"`));
});

test("la fila delle aree dice come sta ognuna, non cosa premere", () => {
  const pagina = readFileSync(
    new URL("../src/sections/security-showcase-section.js", import.meta.url),
    "utf8",
  );
  /* Con due aree si vuole sapere se l'altra è inserita senza passare di là. E
   * sotto il nome ci va uno STATO: «Sblocca» è l'etichetta del tasto che
   * disinserisce, e letta lì diceva di premere invece di dire come sta. */
  assert.match(pagina, /areaSpenta: t\("Disinserita", "Disarmed"\)/);
  assert.match(pagina, /areaAccesa: \(modo\) =>/);
  assert.match(pagina, /if \(lista\.length < 2\) return "";/);
  /* E il passaggio riscrive la mappatura, senza intercettare niente. */
  assert.match(pagina, /writeJsonIfChanged\("cd_entity_overrides", prossime\)/);
  assert.match(pagina, /root\.cdApplyCanonicalOverrides\?\.\(prossime\)/);
});
