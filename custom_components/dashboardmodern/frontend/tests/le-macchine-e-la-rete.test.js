/* Il server e la rete, guardati dalla plancia (#382).
 *
 * «Volevo chiedere se si può aggiungere i controlli del server proxmox dove
 * gira HA con tutti i suoi container e controllare lo stato del fritbox e i
 * suoi ripeter.»
 *
 * Sono due elenchi che Home Assistant dichiara da sé: le VM e i container di
 * Proxmox sono i `binary_sensor` con `device_class: running`, il router e i
 * suoi ripetitori quelli con `connectivity`. Niente da compilare per
 * cominciare; la configurazione serve solo a correggere.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  comandiDellaMacchina,
  comeSta,
  contoDelleMacchine,
  famigliaDi,
  macchineConfigurate,
  macchineERete,
  normalizzaMacchine,
} from "../src/core/macchine-e-rete.js";

const STATI = {
  "binary_sensor.pve_lxc_101_status": {
    state: "on",
    attributes: { device_class: "running", friendly_name: "HomeAssistant" },
  },
  "binary_sensor.pve_qemu_103_status": {
    state: "off",
    attributes: { device_class: "running", friendly_name: "NAS" },
  },
  "switch.pve_qemu_103": { state: "off", attributes: {} },
  "binary_sensor.fritzbox_connection": {
    state: "on",
    attributes: { device_class: "connectivity", friendly_name: "FRITZ!Box" },
  },
  "binary_sensor.ripetitore_salotto_connection": {
    state: "off",
    attributes: { device_class: "connectivity", friendly_name: "Ripetitore salotto" },
  },
  "binary_sensor.porta": { state: "on", attributes: { device_class: "door" } },
};

const nomeDi = (entity) => STATI[entity]?.attributes?.friendly_name || entity;

test("le due famiglie le dichiara Home Assistant, non un elenco scritto a mano", () => {
  assert.equal(
    famigliaDi("binary_sensor.pve_lxc_101_status", STATI["binary_sensor.pve_lxc_101_status"]),
    "macchine",
  );
  assert.equal(
    famigliaDi("binary_sensor.fritzbox_connection", STATI["binary_sensor.fritzbox_connection"]),
    "rete",
  );
  /* Una porta è un binary_sensor come gli altri, ma non è né una macchina né
   * un pezzo di rete. */
  assert.equal(famigliaDi("binary_sensor.porta", STATI["binary_sensor.porta"]), "");
});

test("chi ha la casa corregge: toglie, aggiunge, rinomina", () => {
  const senza = { escluse: ["binary_sensor.pve_lxc_101_status"] };
  assert.equal(
    famigliaDi("binary_sensor.pve_lxc_101_status", STATI["binary_sensor.pve_lxc_101_status"], senza),
    "",
  );
  const con = { aggiunte: { "binary_sensor.mio_nas": "macchine" } };
  assert.equal(famigliaDi("binary_sensor.mio_nas", { state: "on" }, con), "macchine");
  /* Una famiglia che non esiste non si salva: sarebbe un elenco che nessuno
   * disegna. */
  assert.deepEqual(normalizzaMacchine({ aggiunte: { "binary_sensor.x": "fantasia" } }).aggiunte, {});
});

test("prima quello che è giù, e i muti non contano né su né giù", () => {
  const elenchi = macchineERete(
    { ...STATI, "binary_sensor.pve_lxc_102_status": { state: "unavailable", attributes: { device_class: "running" } } },
    {},
    nomeDi,
  );
  assert.deepEqual(
    elenchi.macchine.map((riga) => riga.stato),
    ["giu", "", "su"],
  );
  const conto = contoDelleMacchine(elenchi.macchine);
  assert.deepEqual(
    { su: conto.su, giu: conto.giu, muti: conto.muti, totale: conto.totale },
    { su: 1, giu: 1, muti: 1, totale: 3 },
  );
  assert.deepEqual(conto.fermi, ["NAS"]);
});

test("il tasto esce solo dove c'è davvero qualcosa da premere", () => {
  /* L'interruttore che si chiama come il sensore, senza la coda «_status». */
  assert.deepEqual(comandiDellaMacchina("binary_sensor.pve_qemu_103_status", STATI), {
    tipo: "switch",
    entity: "switch.pve_qemu_103",
  });
  /* Niente interruttore, niente pulsanti: nessun tasto. Un tasto che non fa
   * niente è peggio di nessun tasto. */
  assert.equal(comandiDellaMacchina("binary_sensor.pve_lxc_101_status", STATI), null);
  /* La coppia di pulsanti dell'integrazione Proxmox vale come comando. */
  const conPulsanti = {
    "button.pve_lxc_101_start": { state: "unknown" },
    "button.pve_lxc_101_stop": { state: "unknown" },
  };
  assert.deepEqual(comandiDellaMacchina("binary_sensor.pve_lxc_101_status", conPulsanti), {
    tipo: "button",
    avvia: "button.pve_lxc_101_start",
    ferma: "button.pve_lxc_101_stop",
  });
  /* Con un pulsante solo non si offre mezza coppia. */
  assert.equal(
    comandiDellaMacchina("binary_sensor.pve_lxc_101_status", {
      "button.pve_lxc_101_start": { state: "unknown" },
    }),
    null,
  );
});

test("uno che non risponde non è uno fermo", () => {
  assert.equal(comeSta({ state: "on" }), "su");
  assert.equal(comeSta({ state: "off" }), "giu");
  assert.equal(comeSta({ state: "unavailable" }), "");
  assert.equal(comeSta({ state: "unknown" }), "");
  assert.equal(comeSta(), "");
});

test("senza niente da mostrare non si mostra niente", () => {
  assert.equal(macchineConfigurate({ "binary_sensor.porta": STATI["binary_sensor.porta"] }), false);
  assert.equal(macchineConfigurate(STATI), true);
  assert.deepEqual(contoDelleMacchine(), { su: 0, giu: 0, muti: 0, totale: 0, fermi: [] });
});
