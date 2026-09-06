/* Al Recorder si chiede una cosa per volta, e dopo un timeout si respira.
 *
 * «Energia giornaliera e mensile fa capricci: resta il velo, o 0 kWh e
 * timeout.» Un aggiornamento lancia sette letture delle statistiche insieme,
 * e su un server piccolo si contendono il disco: tutte rallentano, qualcuna
 * scade. In fila la spesa e' la stessa ma nessuna aspetta le altre mentre il
 * suo cronometro corre; e dopo un timeout la prossima ripresa aspetta cinque
 * minuti, non uno.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AFFANNO_DEL_RECORDER_MS,
  HomeAssistantBroker,
  PESANTI_PER_IL_RECORDER,
} from "../src/core/period-service.js";
import {
  RIPOSO_ENERGIA_DI_SPALLE_MS,
  RIPOSO_ENERGIA_MS,
  riposoDeiPeriodi,
} from "../src/sections/energy-section.js";

/* Un socket che si ricorda cosa gli e' stato mandato e risponde a comando. */
function socketFinto(broker) {
  const inviati = [];
  const socket = {
    send(raw) {
      inviati.push(JSON.parse(raw));
    },
  };
  broker.connect = async () => socket;
  const rispondi = (indice, result = {}) =>
    broker.handleMessage(
      JSON.stringify({ type: "result", id: inviati[indice].id, success: true, result }),
      () => {},
      () => {},
    );
  return { inviati, rispondi };
}

const domanda = (giorno) => ({
  type: "recorder/statistics_during_period",
  start_time: `2026-09-0${giorno}T00:00:00.000Z`,
  end_time: `2026-09-0${giorno}T23:00:00.000Z`,
  statistic_ids: ["sensor.casa"],
  period: "hour",
});

const unGiro = () => new Promise((r) => setTimeout(r, 0));

test("due domande al Recorder partono una dopo l'altra, non insieme", async () => {
  const broker = new HomeAssistantBroker({ timeout: 5000 });
  const { inviati, rispondi } = socketFinto(broker);
  const prima = broker.request(domanda(1));
  const seconda = broker.request(domanda(2));
  await unGiro();
  assert.equal(inviati.length, 1, "la seconda aspetta che la prima sia risposta");
  rispondi(0, { "sensor.casa": [] });
  await prima;
  await unGiro();
  assert.equal(inviati.length, 2);
  rispondi(1, { "sensor.casa": [] });
  assert.deepEqual(await seconda, { "sensor.casa": [] });
  assert.equal(broker.recorderInAffanno(), false);
});

test("quello che non pesa sul Recorder non si mette in fila", async () => {
  const broker = new HomeAssistantBroker({ timeout: 5000 });
  const { inviati, rispondi } = socketFinto(broker);
  const pesante = broker.request(domanda(1));
  const leggera = broker.request({ type: "get_states" });
  await unGiro();
  assert.equal(inviati.length, 2);
  rispondi(0, {});
  rispondi(1, []);
  await Promise.all([pesante, leggera]);
  assert.equal(PESANTI_PER_IL_RECORDER.has("recorder/statistics_during_period"), true);
  assert.equal(PESANTI_PER_IL_RECORDER.has("history/history_during_period"), true);
  assert.equal(PESANTI_PER_IL_RECORDER.has("get_states"), false);
});

test("un timeout non blocca la fila, e segna il Recorder in affanno", async () => {
  const broker = new HomeAssistantBroker({ timeout: 20 });
  const { inviati, rispondi } = socketFinto(broker);
  const prima = broker.request(domanda(1));
  const seconda = broker.request(domanda(2));
  await assert.rejects(prima, /timeout/);
  /* Il cronometro della seconda parte adesso, non quando si e' messa in fila:
   * e' partita solo dopo la scadenza della prima. */
  await unGiro();
  assert.equal(inviati.length, 2);
  rispondi(1, { "sensor.casa": [{ sum: 1 }] });
  assert.deepEqual(await seconda, { "sensor.casa": [{ sum: 1 }] });
  assert.equal(broker.recorderInAffanno(), true);
  /* E passati i cinque minuti si torna a chiedere col passo di prima. */
  assert.equal(broker.recorderInAffanno(Date.now() + AFFANNO_DEL_RECORDER_MS + 1), false);
  assert.equal(AFFANNO_DEL_RECORDER_MS, 5 * 60_000);
});

test("il riposo vale anche a freddo, quando non c'e' ancora un pacchetto", () => {
  const energia = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "src", "sections", "energy-section.js"),
    "utf8",
  );
  const ripresa = energia.indexOf("const inAffanno = Boolean(broker?.recorderInAffanno?.())");
  assert.ok(ripresa > 0);
  assert.match(energia.slice(ripresa, ripresa + 400), /inAffanno\s*\?\s*RIPOSO_ENERGIA_DI_SPALLE_MS/);
});

test("col Recorder in affanno l'Energia riposa cinque minuti anche a pagina aperta", () => {
  const finta = {
    visibilityState: "visible",
    getElementById: (id) => (id === "page-energy" ? { classList: { contains: () => true } } : null),
  };
  assert.equal(riposoDeiPeriodi(finta, false), RIPOSO_ENERGIA_MS);
  assert.equal(riposoDeiPeriodi(finta, true), RIPOSO_ENERGIA_DI_SPALLE_MS);
});
