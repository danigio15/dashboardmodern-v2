/* «Le TV dove vanno messe?» (#451)
 *
 * Nella scheda dei lettori: per Home Assistant una TV è un `media_player` come
 * uno speaker, e i comandi del brano — accendi, volume, sorgente — la scheda
 * li copriva già. Quello che non copriva è il resto che un'integrazione porta
 * con sé, ed è quello che chi ha segnalato ha visto sul forno Samsung: «prende
 * tutte le entità come elettrodomestico».
 *
 * Gli entity_id qui sotto sono i suoi, come li ha incollati: una TV Samsung
 * via SmartThings. Sette sensori fra energia e potenza, e in mezzo le quattro
 * cose che di una TV si guardano davvero.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  bindLettoreToDevice,
  letturaDelLettore,
  normalizzaLettore,
} from "../src/core/media-player.js";
import { lettureRiconosciute, lettureVicine } from "../src/core/letture-accanto.js";

const stato = (state, attributes = {}) => ({ state, attributes });
const TV = "media_player.50_crystal_uhd_bubba_3";

const CASA = {
  [TV]: stato("playing", {
    friendly_name: "50 Crystal UHD bubba",
    supported_features: 152461,
    media_title: "Rai 1",
  }),
  "switch.50_crystal_uhd_bubba": stato("on", { friendly_name: "50 Crystal UHD bubba" }),
  "sensor.50_crystal_uhd_bubba_tv_channel": stato("1", {
    friendly_name: "50 Crystal UHD bubba TV channel",
  }),
  "sensor.50_crystal_uhd_bubba_tv_channel_name": stato("Rai 1", {
    friendly_name: "50 Crystal UHD bubba TV channel name",
  }),
  "sensor.50_crystal_uhd_bubba_media_input_source": stato("HDMI1", {
    friendly_name: "50 Crystal UHD bubba Media input source",
  }),
  "sensor.50_crystal_uhd_bubba_media_playback_status": stato("play", {
    friendly_name: "50 Crystal UHD bubba Media playback status",
  }),
  "sensor.50_crystal_uhd_bubba_volume": stato("12", {
    friendly_name: "50 Crystal UHD bubba Volume",
    unit_of_measurement: "%",
  }),
  "sensor.50_crystal_uhd_bubba_energy": stato("12.3", {
    friendly_name: "50 Crystal UHD bubba Energy",
    unit_of_measurement: "kWh",
  }),
  "sensor.50_crystal_uhd_bubba_powerenergy": stato("0.4", {
    friendly_name: "50 Crystal UHD bubba Powerenergy",
    unit_of_measurement: "kWh",
  }),
  "sensor.50_crystal_uhd_bubba_deltaenergy": stato("0.1", {
    friendly_name: "50 Crystal UHD bubba Deltaenergy",
    unit_of_measurement: "kWh",
  }),
  "sensor.50_crystal_uhd_bubba_energy_meter": stato("120", {
    friendly_name: "50 Crystal UHD bubba Energy meter",
    unit_of_measurement: "kWh",
  }),
  "sensor.50_crystal_uhd_bubba_energysaved": stato("2", {
    friendly_name: "50 Crystal UHD bubba Energysaved",
    unit_of_measurement: "kWh",
  }),
  "sensor.50_crystal_uhd_bubba_power": stato("85", {
    friendly_name: "50 Crystal UHD bubba Power",
    unit_of_measurement: "W",
  }),
  "sensor.50_crystal_uhd_bubba_power_meter": stato("85", {
    friendly_name: "50 Crystal UHD bubba Power meter",
    unit_of_measurement: "W",
  }),
};

const ENTITA = Object.keys(CASA).map((entity_id) => ({ entity_id }));

test("dal dispositivo SmartThings esce la TV, col suo interruttore e le sue letture", () => {
  const nato = bindLettoreToDevice({
    device: { name: "50 Crystal UHD bubba" },
    entities: ENTITA,
    states: CASA,
  });
  assert.equal(nato.entity, TV);
  assert.equal(nato.nome, "50 Crystal UHD bubba");
  /* L'interruttore dell'alimentazione è un comando: si tocca. */
  assert.deepEqual(nato.comandi, ["switch.50_crystal_uhd_bubba"]);
  /* Le quattro cose che di una TV si guardano, più il numero del canale. */
  for (const attesa of [
    "sensor.50_crystal_uhd_bubba_tv_channel_name",
    "sensor.50_crystal_uhd_bubba_media_input_source",
    "sensor.50_crystal_uhd_bubba_media_playback_status",
    "sensor.50_crystal_uhd_bubba_volume",
  ])
    assert.ok(nato.letture.includes(attesa), `manca ${attesa}`);
});

test("i sette sensori del consumo non invadono la scheda, ma restano scegliibili", () => {
  /* Questa TV pubblica energy, powerenergy, deltaenergy, energy_meter,
   * energysaved, power e power_meter: metterli tutti vorrebbe dire una scheda
   * fatta di consumi, e il posto dei consumi sono Carichi ed Energia. */
  const nato = bindLettoreToDevice({
    device: { name: "50 Crystal UHD bubba" },
    entities: ENTITA,
    states: CASA,
  });
  const consumi = nato.letture.filter((id) => /energ|power/.test(id));
  assert.deepEqual(consumi, [], "il consumo non si sceglie da solo");
  /* Ma chi lo vuole lo trova fra le proposte, e non è nascosto. */
  const proposte = lettureVicine(nato, CASA);
  assert.ok(proposte.includes("sensor.50_crystal_uhd_bubba_power"));
  /* E quelle già scelte non si ripropongono. */
  for (const scelta of nato.letture) assert.ok(!proposte.includes(scelta));
  /* Nemmeno l'interruttore: quello è un comando, e ha già la sua riga. */
  assert.ok(!proposte.includes("switch.50_crystal_uhd_bubba"));
});

test("le letture della TV portano il disegno della loro famiglia", () => {
  const voce = normalizzaLettore({
    entity: TV,
    letture: lettureRiconosciute({ entity: TV }, CASA),
  });
  const lettura = letturaDelLettore(voce, CASA);
  const per = Object.fromEntries(lettura.letture.map((riga) => [riga.entity, riga]));
  assert.equal(per["sensor.50_crystal_uhd_bubba_tv_channel_name"].disegno, "tv");
  assert.equal(per["sensor.50_crystal_uhd_bubba_media_input_source"].disegno, "sliders");
  assert.equal(per["sensor.50_crystal_uhd_bubba_volume"].disegno, "speaker");
  assert.equal(per["sensor.50_crystal_uhd_bubba_media_playback_status"].disegno, "play");
  /* Il nome non ripete quello della TV: la scheda ce l'ha già in testa. */
  assert.equal(per["sensor.50_crystal_uhd_bubba_tv_channel_name"].name, "TV channel name");
  assert.equal(per["sensor.50_crystal_uhd_bubba_volume"].testo, "12 %");
});

test("l'interruttore della TV si accende dalla scheda, e sa di essere acceso", () => {
  const voce = normalizzaLettore({ entity: TV, comandi: ["switch.50_crystal_uhd_bubba"] });
  const lettura = letturaDelLettore(voce, CASA);
  assert.equal(lettura.comandi.length, 1);
  assert.equal(lettura.comandi[0].genere, "interruttore");
  assert.equal(lettura.comandi[0].acceso, true);
  assert.equal(lettura.comandi[0].available, true);
  /* Il nome è quello dell'entità senza il nome della TV davanti: quando
   * coincidono resta il nome intero, che è meglio di niente. */
  assert.ok(lettura.comandi[0].name);
});

test("un dispositivo che un lettore non ce l'ha non diventa un lettore", () => {
  const nato = bindLettoreToDevice({
    device: { name: "Termostato" },
    entities: [{ entity_id: "climate.salotto" }, { entity_id: "sensor.salotto_temperatura" }],
    states: {},
  });
  assert.equal(nato.entity, "");
});

test("la scheda dei lettori ha il menù delle integrazioni e le due liste", async () => {
  const editor = await readFile(
    new URL("../src/sections/media-player-editor-section.js", import.meta.url),
    "utf8",
  );
  assert.match(editor, /data-mp-integ/);
  assert.match(editor, /apriMenuIntegrazioni\(/);
  assert.match(editor, /listaMarkup\("comandi", voce, indice\)/);
  assert.match(editor, /listaMarkup\("letture", voce, indice\)/);
  /* Una riga sola, scritta una volta, per tutt'e due le liste. */
  assert.equal(editor.match(/function listaMarkup\(/g).length, 1);
  /* E il tetto si dice, non si tace (#403). */
  assert.match(editor, /togline una per farci stare questa/);

  const sezione = await readFile(
    new URL("../src/sections/media-player-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /data-dm-mp-cmd=/);
  assert.match(sezione, /data-dm-mp-tendina=/);
  assert.match(sezione, /data-dm-mp-lettura=/);
});
