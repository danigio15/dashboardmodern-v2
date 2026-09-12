/* «Devi cambiare popup dei dispositivi accesi che sono nella barra sotto al
 *  menu. Devi mostrare solo quelli accesi e non una replica del popup widget.»
 *
 * La pastiglia «2 LUCI ACCESE» inoltrava il tocco alla tessera delle luci, che
 * le mostra TUTTE — accese e spente, per zone, coi cursori. Chi tocca una
 * pastiglia che dice DUE vuole quelle due: e' il motivo per cui la tocca.
 *
 * Qui si tiene fermo quello che serve perche' l'elenco sia possibile: la
 * pastiglia si porta dietro le entita' accese, e per ognuna si sa come si
 * spegne — che non e' sempre «spegni»: una tapparella si chiude, una cassa si
 * mette in pausa, un contatto sull'anta non si comanda affatto.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { comandoPerSpegnere, dominioDi } from "../src/core/come-si-spegne.js";
import { pastiglieDellaCasa } from "../src/core/come-sta-la-casa.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

test("la pastiglia che conta si porta dietro le entita' accese", () => {
  const [pastiglia] = pastiglieDellaCasa(
    [
      {
        key: "luci",
        icon: "💡",
        on: [
          { entity: "light.cucina", name: "Cucina" },
          { entity: "light.salone", name: "Salone" },
        ],
        rows: [
          { entity: "light.cucina", name: "Cucina" },
          { entity: "light.salone", name: "Salone" },
          { entity: "light.bagno", name: "Bagno" },
        ],
      },
    ],
    {},
  );
  assert.equal(pastiglia.conto, 2);
  /* Solo le accese: la terza sta nelle righe della tessera e non nell'elenco. */
  assert.deepEqual(pastiglia.voci, [
    { entity: "light.cucina", name: "Cucina" },
    { entity: "light.salone", name: "Salone" },
  ]);
});

test("le pastiglie che raccontano una cosa sola non portano un elenco", () => {
  const pastiglie = pastiglieDellaCasa(
    [
      { key: "sicurezza", icon: "🛡️", armed: true, value: "Inserito", accent: "#be123c" },
      {
        key: "rifiuti",
        icon: "♻️",
        rows: [{ glyph: "🍎", name: "Organico", quando: "oggi", giorni: 0 }],
      },
    ],
    {},
  );
  for (const pastiglia of pastiglie)
    assert.equal(pastiglia.voci, undefined, `${pastiglia.chiave} non ha un elenco da aprire`);
});

test("ogni dominio si spegne come sa spegnersi lui", () => {
  assert.deepEqual(comandoPerSpegnere("light.cucina"), {
    dominio: "homeassistant",
    servizio: "turn_off",
    parola: "spegni",
  });
  assert.deepEqual(comandoPerSpegnere("switch.presa"), {
    dominio: "homeassistant",
    servizio: "turn_off",
    parola: "spegni",
  });
  /* Una tapparella non si spegne. */
  assert.deepEqual(comandoPerSpegnere("cover.tapparella_cucina"), {
    dominio: "cover",
    servizio: "close_cover",
    parola: "chiudi",
  });
  /* Una cassa che suona si mette in pausa: spegnerla vorrebbe dire spegnere
     anche la TV a cui e' attaccata. */
  assert.deepEqual(comandoPerSpegnere("media_player.soggiorno"), {
    dominio: "media_player",
    servizio: "media_pause",
    parola: "pausa",
  });
  assert.deepEqual(comandoPerSpegnere("lock.portone"), {
    dominio: "lock",
    servizio: "lock",
    parola: "chiudi",
  });
});

test("un contatto si guarda e basta: non c'e' niente da comandare", () => {
  assert.equal(comandoPerSpegnere("binary_sensor.finestra_cucina"), null);
  assert.equal(comandoPerSpegnere("sensor.temperatura"), null);
  assert.equal(comandoPerSpegnere(""), null);
  assert.equal(comandoPerSpegnere("senzapunto"), null);
  assert.equal(dominioDi("Light.Cucina"), "light");
});

test("l'elenco e' una finestra sua, non quella del guscio", () => {
  const sorgente = leggi("sections/come-sta-la-casa-section.js");
  /* Il `#details-modal` del guscio ha un tipo attivo che il suo giro di
     disegno ridisegna da solo: un elenco nostro dentro casa sua sarebbe
     cancellato al primo cambio di stato. */
  assert.doesNotMatch(sorgente, /["']details-modal["']/);
  assert.match(sorgente, /const POPUP = "dm-casa-popup"/);
  /* E il tocco prova prima l'elenco: la tessera resta per le pastiglie che
     dicono una cosa sola. */
  const tocco = sorgente.slice(sorgente.indexOf("function onClick(event)"));
  assert.ok(
    tocco.indexOf("apriLElenco(chiave)") < tocco.indexOf('data-dm-widget="${CSS.escape(tessera)}"'),
    "l'elenco viene prima della tessera",
  );
});
