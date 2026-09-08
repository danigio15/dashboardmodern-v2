/* Il NAS entra fra le macchine anche senza dichiarare l'acceso (#411).
 *
 * «Fra le vm riconoscere in automatico il synology — per evitare la
 * configurazione manuale.»
 *
 * La sezione Server adotta per integrazione, ed e' giusto cosi': a dire se una
 * cosa e' roba del server e' chi ha creato l'entita', non il suo nome. Ma la
 * strada per arrivarci passava dalle due classi — `running` e `connectivity` —
 * e Synology DSM non ne pubblica nessuna: CPU, memoria, dischi, volumi,
 * temperatura, e basta. Senza candidati l'integrazione non compariva nemmeno
 * fra quelle da spuntare, quindi non c'era proprio modo di farla entrare se non
 * aggiungendo un'entita' alla volta a mano. Cioe' la configurazione manuale che
 * la segnalazione chiede di evitare.
 *
 * Per queste l'adozione e' per dispositivo: il registro di Home Assistant i
 * dispositivi ce li ha, e dice anche chi dipende da chi. Il NAS non dipende da
 * nessuno ed e' la macchina; la telecamera appesa al NAS e' un suo accessorio,
 * e in un elenco di macchine sarebbe rumore.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SERVER_PER_DISPOSITIVO,
  integrazioniDaScegliere,
  integrazioniPerDispositivo,
  macchineDeiDispositivi,
  macchineERete,
} from "../src/core/macchine-e-rete.js";

const NAS = {
  id: "nas-1",
  name: "Synology NAS",
  integration: "synology_dsm",
  integrations: ["synology_dsm"],
  via_device: "",
  entities: 22,
};
const TELECAMERA = {
  id: "cam-1",
  name: "Telecamera ingresso",
  integration: "synology_dsm",
  integrations: ["synology_dsm"],
  via_device: "nas-1",
  entities: 4,
};
const ENTITA = {
  "nas-1": ["sensor.nas_cpu_utilization_total", "sensor.nas_volume_1_status"],
  "cam-1": ["camera.ingresso"],
};
const ACCESO = {
  "sensor.nas_cpu_utilization_total": { state: "12" },
  "sensor.nas_volume_1_status": { state: "normal" },
};
const SPENTO = {
  "sensor.nas_cpu_utilization_total": { state: "unavailable" },
  "sensor.nas_volume_1_status": { state: "unavailable" },
};
const SCELTA = { integrazioni: ["synology_dsm"] };

test("Synology sta fra le integrazioni che si adottano per dispositivo", () => {
  assert.ok(SERVER_PER_DISPOSITIVO.has("synology_dsm"));
  assert.deepEqual(integrazioniPerDispositivo(ACCESO, {}, SCELTA), ["synology_dsm"]);
});

test("si offre da spuntare anche senza portare nessun candidato", () => {
  const righe = integrazioniDaScegliere(
    ACCESO,
    {},
    { integrazioni: [] },
    { synology_dsm: "Synology DSM" },
    [NAS, TELECAMERA],
  );
  assert.deepEqual(righe, [
    {
      dominio: "synology_dsm",
      nome: "Synology DSM",
      macchine: 1,
      rete: 0,
      totale: 1,
      scelta: false,
    },
  ]);
});

test("il NAS e' una macchina, la telecamera appesa al NAS no", () => {
  const righe = macchineDeiDispositivi({
    dispositivi: [NAS, TELECAMERA],
    entita: ENTITA,
    states: ACCESO,
    config: SCELTA,
  });
  assert.deepEqual(
    righe.map((riga) => [riga.name, riga.entity, riga.stato]),
    [["Synology NAS", "sensor.nas_volume_1_status", "su"]],
  );
});

test("un NAS che non risponde non e' un NAS fermo", () => {
  const [riga] = macchineDeiDispositivi({
    dispositivi: [NAS],
    entita: ENTITA,
    states: SPENTO,
    config: SCELTA,
  });
  assert.equal(riga.stato, "", "unavailable vuol dire che non risponde, non che e' spento");
});

test("nessun tasto: un NAS non si accende da remoto", () => {
  const [riga] = macchineDeiDispositivi({
    dispositivi: [NAS],
    entita: ENTITA,
    states: { ...ACCESO, "switch.nas_volume_1": { state: "on" } },
    config: SCELTA,
  });
  assert.equal(riga.comandi, null);
});

test("finche' non si spunta, il NAS resta fuori", () => {
  assert.deepEqual(
    macchineDeiDispositivi({
      dispositivi: [NAS],
      entita: ENTITA,
      states: ACCESO,
      config: { integrazioni: [] },
    }),
    [],
  );
});

test("un'integrazione qualsiasi non si adotta per dispositivo", () => {
  const lampadina = { ...NAS, id: "hue-1", integration: "hue", integrations: ["hue"] };
  assert.deepEqual(
    macchineDeiDispositivi({
      dispositivi: [lampadina],
      entita: { "hue-1": ["light.salone"] },
      states: { "light.salone": { state: "on" } },
      config: { integrazioni: ["hue", "synology_dsm"] },
    }),
    [],
  );
});

test("chi ha la casa puo' togliere il NAS e rinominarlo, come ogni altra riga", () => {
  const config = {
    integrazioni: ["synology_dsm"],
    nomi: { "sensor.nas_volume_1_status": "Il disco di casa" },
  };
  const [riga] = macchineDeiDispositivi({
    dispositivi: [NAS],
    entita: ENTITA,
    states: ACCESO,
    config,
  });
  assert.equal(riga.name, "Il disco di casa");
  assert.deepEqual(
    macchineDeiDispositivi({
      dispositivi: [NAS],
      entita: ENTITA,
      states: ACCESO,
      config: { ...config, escluse: ["sensor.nas_volume_1_status"] },
    }),
    [],
  );
});

test("il NAS finisce nella fascia delle macchine insieme ai container", () => {
  const states = {
    ...ACCESO,
    "binary_sensor.pve_lxc_101_status": {
      state: "on",
      attributes: { device_class: "running", friendly_name: "HomeAssistant" },
    },
  };
  const elenchi = macchineERete(
    states,
    { integrazioni: ["synology_dsm", "proxmoxve"] },
    (entity) => entity,
    { "binary_sensor.pve_lxc_101_status": "proxmoxve" },
    { dispositivi: [NAS, TELECAMERA], entita: ENTITA },
  );
  assert.deepEqual(elenchi.macchine.map((riga) => riga.name).sort(), [
    "Synology NAS",
    "binary_sensor.pve_lxc_101_status",
  ]);
  assert.deepEqual(elenchi.rete, []);
});

test("se un domani Synology dichiarasse i suoi «running», vince la classe", () => {
  const states = {
    ...ACCESO,
    "binary_sensor.nas_running": {
      state: "on",
      attributes: { device_class: "running", friendly_name: "NAS" },
    },
  };
  const piattaforme = { "binary_sensor.nas_running": "synology_dsm" };
  assert.deepEqual(integrazioniPerDispositivo(states, piattaforme, SCELTA), []);
  const elenchi = macchineERete(states, SCELTA, (entity) => entity, piattaforme, {
    dispositivi: [NAS],
    entita: ENTITA,
  });
  assert.deepEqual(
    elenchi.macchine.map((riga) => riga.entity),
    ["binary_sensor.nas_running"],
    "una riga sola: la classe la racconta meglio, e quella per dispositivo si fa da parte",
  );
});
