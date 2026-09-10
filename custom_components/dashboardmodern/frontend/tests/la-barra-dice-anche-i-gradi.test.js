/* «Sarebbe possibile inserire temperatura e umidità di sensori personali?
 * Esempio: io ho un sensore esterno all'abitazione con cui mi regolo con i
 * clima interni. Magari inserirli nella top bar.» (#461)
 *
 * Sono due letture, non due notizie: non succedono, ci sono sempre. Per questo
 * stanno in fondo alla fascia, dopo le cose che sono successe, e per questo il
 * sensore lo sceglie chi abita la casa invece di essere una media delle stanze:
 * quello che si guarda per decidere è uno solo, e spesso è fuori.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  TINTA_TEMPERATURA,
  TINTA_UMIDITA,
  VOCI_DELLA_BARRA,
  normalizzaBarra,
  pastiglieDellaCasa,
} from "../src/core/come-sta-la-casa.js";

const misura = (valore, unita, nome) => ({ valore, unita, nome });
const chiavi = (pastiglie) => pastiglie.map((pastiglia) => pastiglia.chiave);

test("le due misure sono voci della barra, e stanno in fondo", () => {
  const elenco = VOCI_DELLA_BARRA.map((voce) => voce.chiave);
  assert.ok(elenco.includes("temperatura"));
  assert.ok(elenco.includes("umidita"));
  /* Chi legge da sinistra deve trovare per prima la cosa che è successa. */
  assert.deepEqual(elenco.slice(-2), ["temperatura", "umidita"]);
  assert.ok(elenco.indexOf("posta") < elenco.indexOf("temperatura"));
});

test("i due sensori si salvano, e di serie non c'è nessuno", () => {
  const vuota = normalizzaBarra({});
  assert.equal(vuota.temperatura, "");
  assert.equal(vuota.umidita, "");
  const scelta = normalizzaBarra({
    temperatura: " sensor.esterno_temp ",
    umidita: "sensor.esterno_umid",
  });
  assert.equal(scelta.temperatura, "sensor.esterno_temp");
  assert.equal(scelta.umidita, "sensor.esterno_umid");
  /* E la casella non è la spunta: si può avere il sensore e spegnere la voce. */
  assert.equal(normalizzaBarra({ voci: { temperatura: false } }).voci.temperatura, false);
  assert.equal(vuota.voci.temperatura, true);
});

test("con la lettura la pastiglia c'è, e porta il colore della cosa che misura", () => {
  const pastiglie = pastiglieDellaCasa([], {
    barra: normalizzaBarra({}),
    misure: {
      temperatura: misura(21.4, "°C", "Temperatura esterna"),
      umidita: misura(63, "%", "Umidità esterna"),
    },
  });
  assert.deepEqual(chiavi(pastiglie), ["temperatura", "umidita"]);
  const [caldo, acqua] = pastiglie;
  assert.equal(caldo.valore, 21.4);
  assert.equal(caldo.unita, "°C");
  assert.equal(caldo.nome, "Temperatura esterna");
  assert.equal(caldo.tinta, TINTA_TEMPERATURA);
  assert.equal(acqua.tinta, TINTA_UMIDITA);
  /* Toccandole si apre la tessera Temperature, che è dove la stessa domanda ha
   * la risposta lunga. */
  assert.equal(caldo.tessera, "temperatura");
  assert.equal(acqua.tessera, "temperatura");
});

test("senza lettura non c'è pastiglia, e zero non è «non si sa»", () => {
  const senza = pastiglieDellaCasa([], { barra: normalizzaBarra({}), misure: {} });
  assert.deepEqual(chiavi(senza), []);
  /* Un sensore che non risponde arriva come null e sparisce: scrivere «—» o
   * «0°» sarebbe inventare una misura. */
  const rotto = pastiglieDellaCasa([], {
    barra: normalizzaBarra({}),
    misure: { temperatura: null, umidita: misura(Number.NaN, "%", "x") },
  });
  assert.deepEqual(chiavi(rotto), []);
  /* Zero gradi invece è una misura, e si vede. */
  const gelo = pastiglieDellaCasa([], {
    barra: normalizzaBarra({}),
    misure: { temperatura: misura(0, "°C", "Esterna") },
  });
  assert.deepEqual(chiavi(gelo), ["temperatura"]);
});

test("la spunta spenta toglie la pastiglia anche col sensore compilato", () => {
  const pastiglie = pastiglieDellaCasa([], {
    barra: normalizzaBarra({ voci: { temperatura: false } }),
    misure: { temperatura: misura(21.4, "°C", "Esterna"), umidita: misura(63, "%", "Esterna") },
  });
  assert.deepEqual(chiavi(pastiglie), ["umidita"]);
});

test("le misure non rubano il posto alle voci che vengono dalle tessere", () => {
  const modelli = [{ key: "luci", icon: "💡", accent: "#f59e0b", on: [{ name: "Cucina" }] }];
  const pastiglie = pastiglieDellaCasa(modelli, {
    barra: normalizzaBarra({}),
    misure: { temperatura: misura(21.4, "°C", "Esterna") },
  });
  assert.deepEqual(chiavi(pastiglie), ["luci", "temperatura"]);
});
