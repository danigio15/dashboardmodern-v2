/* Il server e la rete, guardati dalla plancia (#382).
 *
 * «Volevo chiedere se si può aggiungere i controlli del server proxmox dove
 * gira HA con tutti i suoi container e controllare lo stato del fritbox e i
 * suoi ripeter.»
 *
 * Sono due elenchi che Home Assistant dichiara da sé: le VM e i container di
 * Proxmox sono i `binary_sensor` con `device_class: running`, il router e i
 * suoi ripetitori quelli con `connectivity`.
 *
 * Ma la classe da sola prende mezza casa — «la sezione mini pc porta in
 * automatico tutte queste entità sotto che non si eliminano e che non
 * c'entrano nulla con quella sezione» — perché `running` ce l'ha anche la
 * lavatrice e `connectivity` ogni telefono. Quello che distingue un container
 * dal ferro da stiro non è nello stato: è nell'integrazione che ha creato
 * l'entità, e la si sceglie una volta. Questa prova tiene ferme tutte e due le
 * condizioni: senza la classe non si entra, e senza l'integrazione nemmeno.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateDaChiedere,
  comandiDellaMacchina,
  comeSta,
  contoDelleMacchine,
  famigliaDi,
  integrazioniDaScegliere,
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
  /* La lavatrice: `running` come un container, e non c'entra niente. */
  "binary_sensor.lavatrice_in_funzione": {
    state: "on",
    attributes: { device_class: "running", friendly_name: "Lavatrice" },
  },
  /* Il telefono: `connectivity` come il router, e non c'entra niente. */
  "binary_sensor.telefono_online": {
    state: "on",
    attributes: { device_class: "connectivity", friendly_name: "Telefono" },
  },
};

/* Di chi è ognuna, come lo direbbe il registro di Home Assistant. */
const PIATTAFORME = {
  "binary_sensor.pve_lxc_101_status": "proxmoxve",
  "binary_sensor.pve_qemu_103_status": "proxmoxve",
  "binary_sensor.fritzbox_connection": "fritz",
  "binary_sensor.ripetitore_salotto_connection": "fritz",
  "binary_sensor.lavatrice_in_funzione": "hon",
  "binary_sensor.telefono_online": "mobile_app",
  "binary_sensor.porta": "zha",
};

/* La casa configurata bene: si prendono Proxmox e il FritzBox, e basta. */
const SCELTE = { integrazioni: ["proxmoxve", "fritz"] };

const nomeDi = (entity) => STATI[entity]?.attributes?.friendly_name || entity;

const famiglia = (entity, config = SCELTE, piattaforme = PIATTAFORME) =>
  famigliaDi(entity, STATI[entity], config, piattaforme);

test("ci vogliono tutte e due: la classe giusta e l'integrazione scelta", () => {
  assert.equal(famiglia("binary_sensor.pve_lxc_101_status"), "macchine");
  assert.equal(famiglia("binary_sensor.fritzbox_connection"), "rete");
  /* Una porta è un binary_sensor come gli altri, ma non è né una macchina né
   * un pezzo di rete: la classe non è quella, e non basta l'integrazione. */
  assert.equal(famiglia("binary_sensor.porta", { integrazioni: ["zha"] }), "");
  /* E questo è il difetto segnalato: la classe giusta, l'integrazione no. */
  assert.equal(famiglia("binary_sensor.lavatrice_in_funzione"), "");
  assert.equal(famiglia("binary_sensor.telefono_online"), "");
});

test("finché non si è scelta un'integrazione non si adotta niente", () => {
  /* Meglio una sezione vuota da riempire in un gesto che una piena di roba
   * d'altri da svuotare in trenta. */
  for (const entity of Object.keys(STATI))
    assert.equal(famiglia(entity, {}), "", `${entity} è entrato senza che nessuno lo scegliesse`);
  assert.deepEqual(macchineERete(STATI, {}, nomeDi, PIATTAFORME), { macchine: [], rete: [] });
});

test("senza sapere di chi è, un'entità non entra", () => {
  /* Il registro non ha ancora risposto: non si tira a indovinare. Meglio una
   * fascia che compare un attimo dopo che una piena di roba da togliere. */
  const container = "binary_sensor.pve_lxc_101_status";
  assert.equal(famiglia(container, SCELTE, {}), "");
  assert.equal(famigliaDi(container, STATI[container], SCELTE, undefined), "");
  assert.equal(famigliaDi(container, STATI[container], SCELTE, { [container]: "" }), "");
});

test("i candidati da chiedere sono solo quelli con le due classi", () => {
  assert.deepEqual(candidateDaChiedere(STATI).sort(), [
    "binary_sensor.fritzbox_connection",
    "binary_sensor.lavatrice_in_funzione",
    "binary_sensor.pve_lxc_101_status",
    "binary_sensor.pve_qemu_103_status",
    "binary_sensor.ripetitore_salotto_connection",
    "binary_sensor.telefono_online",
  ]);
});

test("il menù delle integrazioni dice quanto porterebbe ognuna", () => {
  const righe = integrazioniDaScegliere(STATI, PIATTAFORME, SCELTE, {
    proxmoxve: "Proxmox VE",
    fritz: "FRITZ!Box Tools",
  });
  assert.deepEqual(
    righe.map((riga) => [riga.dominio, riga.nome, riga.macchine, riga.rete, riga.scelta]),
    /* A pari conto vince il nome, così l'elenco non balla fra un giro e
     * l'altro; il dominio fa da nome quando il catalogo non l'ha ancora detto. */
    [
      ["fritz", "FRITZ!Box Tools", 0, 2, true],
      ["proxmoxve", "Proxmox VE", 2, 0, true],
      ["hon", "hon", 1, 0, false],
      ["mobile_app", "mobile_app", 0, 1, false],
    ],
  );
  /* Una tolta a mano non si conta: è già stata guardata e messa fuori, e un
   * numero che promette più di quello che arriva è peggio di nessun numero. */
  const dopo = integrazioniDaScegliere(
    STATI,
    PIATTAFORME,
    { ...SCELTE, escluse: ["binary_sensor.pve_qemu_103_status"] },
    {},
  );
  assert.equal(dopo.find((riga) => riga.dominio === "proxmoxve").macchine, 1);
});

test("chi ha la casa corregge: toglie, aggiunge, rinomina", () => {
  const senza = { ...SCELTE, escluse: ["binary_sensor.pve_lxc_101_status"] };
  assert.equal(famiglia("binary_sensor.pve_lxc_101_status", senza), "");
  /* Quello che si aggiunge a mano entra comunque: nessuna classe, nessuna
   * integrazione scelta, e nemmeno una riga nel registro. È il modo di dire
   * «questa la conosco io e Home Assistant no». */
  const con = { aggiunte: { "binary_sensor.mio_nas": "macchine" } };
  assert.equal(famigliaDi("binary_sensor.mio_nas", { state: "on" }, con, {}), "macchine");
  /* Una famiglia che non esiste non si salva: sarebbe un elenco che nessuno
   * disegna. */
  assert.deepEqual(normalizzaMacchine({ aggiunte: { "binary_sensor.x": "fantasia" } }).aggiunte, {});
  /* Le integrazioni scelte si ripuliscono e si ordinano: quello che si salva
   * è un elenco, non quello che è capitato di scrivere. */
  assert.deepEqual(
    normalizzaMacchine({ integrazioni: [" fritz ", "proxmoxve", "fritz", ""] }).integrazioni,
    ["fritz", "proxmoxve"],
  );
  assert.deepEqual(normalizzaMacchine({}).integrazioni, []);
  assert.deepEqual(normalizzaMacchine(null).integrazioni, []);
});

test("prima quello che è giù, e i muti non contano né su né giù", () => {
  const elenchi = macchineERete(
    { ...STATI, "binary_sensor.pve_lxc_102_status": { state: "unavailable", attributes: { device_class: "running" } } },
    SCELTE,
    nomeDi,
    { ...PIATTAFORME, "binary_sensor.pve_lxc_102_status": "proxmoxve" },
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
  assert.equal(
    macchineConfigurate({ "binary_sensor.porta": STATI["binary_sensor.porta"] }, SCELTE, PIATTAFORME),
    false,
  );
  assert.equal(macchineConfigurate(STATI, SCELTE, PIATTAFORME), true);
  assert.deepEqual(contoDelleMacchine(), { su: 0, giu: 0, muti: 0, totale: 0, fermi: [] });
});
