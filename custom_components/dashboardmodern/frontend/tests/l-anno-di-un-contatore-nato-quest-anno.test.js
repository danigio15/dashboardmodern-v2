/* «L'energia da inizio anno della wallbox non è assolutamente quella.»
 *
 * Dal campo: wallbox installata quest'anno, quindi TUTTO il suo consumo e' del
 * 2026; il contatore di vita — `sensor.wallbox_lifetime_filtered` — segna
 * 1440,76 kWh, e il Report ne mostrava 445,6. L'entita' era giusta e il suo
 * valore pure: sbagliava il conto dell'anno.
 *
 * La crescita di un arco si misura dall'ultima riga PRIMA del confine. Per un
 * contatore che a gennaio non esisteva quella riga non c'e', e si partiva dalla
 * prima riga DENTRO l'anno — buttando via tutto quello che quella riga stessa
 * aveva gia' accumulato, cioe' il primo mese intero.
 *
 * Il difetto si vede solo sull'anno perche' e' l'unico arco che puo' cominciare
 * prima che il contatore esista: il mese e il giorno cadono sempre dentro la
 * sua vita. E infatti nessuna prova lo copriva — la parita' del progetto misura
 * un periodo solo, di sei ore, su un contatore gia' vivo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { crescitaNellArco } from "../src/core/period-service.js";

/* Un contatore acceso a marzo, con la `sum` del Recorder: un totale SUO, che
 * parte da zero alla prima statistica. */
const CONSUMI = Object.freeze({ 2: 300, 3: 220, 4: 180, 5: 150, 6: 140, 7: 160 });
const SETTEMBRE = 222.662;

function righeMensili() {
  const righe = [];
  let cumulata = 0;
  for (const [mese, kwh] of Object.entries(CONSUMI)) {
    cumulata += kwh;
    righe.push({ start: new Date(2026, Number(mese), 1).toISOString(), sum: cumulata });
  }
  cumulata += SETTEMBRE;
  righe.push({ start: new Date(2026, 8, 1).toISOString(), sum: cumulata });
  return { righe, totale: cumulata };
}

const ARCO_MESI_CHIUSI = {
  kind: "year",
  period: "month",
  start: new Date(2026, 0, 1),
  end: new Date(2026, 8, 1),
};
const ARCO_MESE_APERTO = {
  kind: "month",
  period: "day",
  start: new Date(2026, 8, 1),
  end: new Date(2026, 8, 7),
};

test("l'anno di un contatore nato a marzo vale tutto quello che ha consumato", () => {
  const { righe, totale } = righeMensili();
  const anno =
    crescitaNellArco(righe, ARCO_MESI_CHIUSI) + crescitaNellArco(righe, ARCO_MESE_APERTO);
  assert.equal(Number(anno.toFixed(3)), Number(totale.toFixed(3)));
});

test("il primo mese non si perde: e' proprio quello che mancava", () => {
  const { righe } = righeMensili();
  /* Senza la partenza da zero il conto sarebbe la somma dei mesi DOPO il
   * primo: la differenza e' esattamente il primo secchiello. */
  const mesiChiusi = crescitaNellArco(righe, ARCO_MESI_CHIUSI);
  const senzaIlPrimo = Object.entries(CONSUMI)
    .slice(1)
    .reduce((somma, [, kwh]) => somma + kwh, 0);
  assert.equal(mesiChiusi - senzaIlPrimo, CONSUMI[2]);
});

test("un contatore che c'era gia' prima non parte da zero", () => {
  /* Il verso pericoloso e' questo: prendere una cumulata vecchia di anni per il
   * consumo di quest'anno. Con una riga PRIMA del confine si usa quella, e la
   * crescita resta la differenza. */
  const righe = [
    { start: new Date(2025, 11, 1).toISOString(), sum: 5000 },
    { start: new Date(2026, 0, 1).toISOString(), sum: 5100 },
    { start: new Date(2026, 1, 1).toISOString(), sum: 5250 },
  ];
  assert.equal(crescitaNellArco(righe, ARCO_MESI_CHIUSI), 250);
});

test("una prima riga proprio sul confine non si tocca", () => {
  /* Li' non si sa se il contatore e' nato in quell'istante o se le righe di
   * prima non sono state chieste: si lascia com'era, che e' il verso prudente. */
  const righe = [
    { start: new Date(2026, 0, 1).toISOString(), sum: 4000 },
    { start: new Date(2026, 1, 1).toISOString(), sum: 4150 },
  ];
  assert.equal(crescitaNellArco(righe, ARCO_MESI_CHIUSI), 150);
});
