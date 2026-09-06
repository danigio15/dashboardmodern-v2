// Le entita' chieste nello stesso giro partono in una richiesta sola.
//
// All'apertura la plancia chiede le entita' di ogni elettrodomestico
// collegato, e le chiedeva una alla volta: dieci apparecchi, dieci richieste,
// e per ognuna il backend rileggeva i registri di Home Assistant. Qui si
// pretende che chi chiede nello stesso giro finisca in un lotto solo, che
// ognuno riceva la propria parte, e che un lotto oltre il tetto del backend
// si spezzi invece di farsi rifiutare.
import assert from "node:assert/strict";
import test from "node:test";

const TYPE = "dashboardmodern/integrations/catalog";

async function loadSection() {
  return import(`../src/sections/appliance-integration-section.js?fix=${Date.now()}`);
}

/* Senza una presa aperta, la sezione ripiega sul broker dell'energia: e' la
 * porta da cui si contano le richieste. */
function fintoBackend(richieste) {
  globalThis.DashboardModernEnergyService = {
    broker: {
      async request(payload) {
        richieste.push(payload);
        return {
          entities: (payload.device_ids || []).map((id) => ({
            entity_id: `sensor.${id}_power`,
            device_id: id,
          })),
        };
      },
    },
  };
}

test("le entita' di piu' dispositivi chieste insieme viaggiano in una richiesta sola", async () => {
  const richieste = [];
  fintoBackend(richieste);
  const { caricaEntita, dimenticaCatalogo } = await loadSection();
  dimenticaCatalogo();

  const [a, b, ancoraA] = await Promise.all([
    caricaEntita("dev-a"),
    caricaEntita("dev-b"),
    caricaEntita("dev-a"),
  ]);

  assert.equal(richieste.length, 1);
  assert.deepEqual(richieste[0], { type: TYPE, device_ids: ["dev-a", "dev-b"] });
  assert.deepEqual(
    a.map((entity) => entity.entity_id),
    ["sensor.dev-a_power"],
  );
  assert.deepEqual(
    b.map((entity) => entity.entity_id),
    ["sensor.dev-b_power"],
  );
  assert.equal(ancoraA, a);

  // Dalla memoria: nessuna richiesta nuova.
  assert.equal(await caricaEntita("dev-b"), b);
  assert.equal(richieste.length, 1);

  // Un giro dopo e' un lotto nuovo.
  await caricaEntita("dev-c");
  assert.equal(richieste.length, 2);
  assert.deepEqual(richieste[1].device_ids, ["dev-c"]);
});

test("un lotto oltre il tetto del backend si spezza in piu' richieste", async () => {
  const richieste = [];
  fintoBackend(richieste);
  const { caricaEntita, dimenticaCatalogo } = await loadSection();
  dimenticaCatalogo();

  const ids = Array.from({ length: 201 }, (_, index) => `lotto-${index}`);
  const liste = await Promise.all(ids.map((id) => caricaEntita(id)));

  assert.deepEqual(
    richieste.map((richiesta) => richiesta.device_ids.length),
    [200, 1],
  );
  assert.ok(liste.every((lista, index) => lista.length === 1 && lista[0].device_id === ids[index]));
});

test("un lotto che fallisce lo dice a tutti quelli che ci stavano dentro", async () => {
  const richieste = [];
  globalThis.DashboardModernEnergyService = {
    broker: {
      async request(payload) {
        richieste.push(payload);
        throw new Error("socket");
      },
    },
  };
  const { caricaEntita, dimenticaCatalogo } = await loadSection();
  dimenticaCatalogo();

  const esiti = await Promise.allSettled([caricaEntita("rotto-a"), caricaEntita("rotto-b")]);

  assert.equal(richieste.length, 1);
  assert.deepEqual(
    esiti.map((esito) => esito.status),
    ["rejected", "rejected"],
  );
});
