/* Di chi è questa entità.
 *
 * `device_class: connectivity` ce l'hanno il router, la stampante, il telefono
 * e la presa Wi-Fi: guardando lo stato sono la stessa cosa. Guardando
 * l'integrazione sono un pezzo di rete e tre elettrodomestici — ed è per
 * questo che la sezione delle macchine si riempiva di mezza casa.
 *
 * La risposta ce l'ha solo il registro di Home Assistant. Qui si prova la
 * memoria di quelle risposte: chiedere una volta sola, non richiedere quello
 * che si sa già, e non restare per sempre senza dopo un socket chiuso.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  TIPO_CATALOGO,
  piattaformeConosciute,
  scopriLePiattaforme,
  scordaLePiattaforme,
  siSaDiChiE,
} from "../src/sections/di-chi-e-unentita-section.js";

/* Il socket vero non c'è: `chiediAHomeAssistant` rifiuta subito con «socket» e
 * la domanda passa al broker, che qui è finto. È la stessa strada che la
 * plancia prende quando il guscio non ha ancora aperto la sua presa. */
function registro(righe, { rompi = false } = {}) {
  const chiamate = [];
  globalThis.DashboardModernEnergyService = {
    broker: {
      request(payload) {
        chiamate.push(payload);
        if (rompi) return Promise.reject(new Error("socket chiuso"));
        const chieste = new Set(payload.entity_ids || []);
        return Promise.resolve({
          entities: righe.filter((riga) => chieste.has(riga.entity_id)),
        });
      },
    },
  };
  return chiamate;
}

const CASA = [
  { entity_id: "binary_sensor.pve_lxc_101_status", platform: "proxmoxve" },
  { entity_id: "binary_sensor.fritzbox_connection", platform: "fritz" },
  { entity_id: "binary_sensor.lavatrice_in_funzione", platform: "hon" },
];

test("il registro dice di chi sono, e lo si chiede una volta sola", async () => {
  scordaLePiattaforme();
  const chiamate = registro(CASA);

  const primo = await scopriLePiattaforme([
    "binary_sensor.pve_lxc_101_status",
    "binary_sensor.fritzbox_connection",
  ]);
  assert.equal(primo["binary_sensor.pve_lxc_101_status"], "proxmoxve");
  assert.equal(primo["binary_sensor.fritzbox_connection"], "fritz");
  assert.equal(chiamate.length, 1, "due entità, una domanda sola");
  assert.equal(chiamate[0].type, TIPO_CATALOGO);

  // Le stesse due non si richiedono: la risposta è già in mano.
  await scopriLePiattaforme(["binary_sensor.pve_lxc_101_status"]);
  assert.equal(chiamate.length, 1);

  // Una terza sì, e da sola: si chiede quello che manca, non tutto da capo.
  await scopriLePiattaforme([
    "binary_sensor.pve_lxc_101_status",
    "binary_sensor.lavatrice_in_funzione",
  ]);
  assert.equal(chiamate.length, 2);
  assert.deepEqual(chiamate[1].entity_ids, ["binary_sensor.lavatrice_in_funzione"]);
  assert.equal(piattaformeConosciute()["binary_sensor.lavatrice_in_funzione"], "hon");
});

test("quello che il registro non conosce non si richiede a ogni giro", async () => {
  scordaLePiattaforme();
  const chiamate = registro(CASA);

  /* Un template scritto a mano nel `configuration.yaml` non sta nel registro:
   * non è un errore, è un'entità che non è di nessuna integrazione. Chiederlo
   * di nuovo sarebbe una domanda che non ha mai risposta. */
  await scopriLePiattaforme(["binary_sensor.inventata"]);
  assert.equal(piattaformeConosciute()["binary_sensor.inventata"], "");
  assert.equal(siSaDiChiE("binary_sensor.inventata"), true);

  await scopriLePiattaforme(["binary_sensor.inventata"]);
  assert.equal(chiamate.length, 1);
});

test("un socket chiuso non è una risposta: il giro dopo si riprova", async () => {
  scordaLePiattaforme();
  const rotte = registro(CASA, { rompi: true });

  // Non esplode in faccia a chi disegna: torna quello che sa, cioè niente.
  const dopo = await scopriLePiattaforme(["binary_sensor.pve_lxc_101_status"]);
  assert.deepEqual(dopo, {});
  assert.equal(siSaDiChiE("binary_sensor.pve_lxc_101_status"), false);
  assert.equal(rotte.length, 1);

  const chiamate = registro(CASA);
  await scopriLePiattaforme(["binary_sensor.pve_lxc_101_status"]);
  assert.equal(chiamate.length, 1, "la domanda si è dimenticata, quindi si rifà");
  assert.equal(piattaformeConosciute()["binary_sensor.pve_lxc_101_status"], "proxmoxve");
});

test("chiedere niente non chiede niente", async () => {
  scordaLePiattaforme();
  const chiamate = registro(CASA);
  assert.deepEqual(await scopriLePiattaforme([]), {});
  assert.deepEqual(await scopriLePiattaforme(["", "  "]), {});
  assert.equal(chiamate.length, 0);
});
