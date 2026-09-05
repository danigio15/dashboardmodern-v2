/* «Verifica perché dopo gli aggiornamenti si perdono entità di alcune sezioni.
 * Le entità configurate non si devono mai perdere.»
 *
 * Il modello canonico tiene solo i campi che conosce, e per la forma va bene:
 * e' quello che impedisce a una configurazione scritta a mano di portarsi
 * dietro spazzatura. Ma vuol dire che un campo che quell'elenco non nomina
 * sparisce alla prima normalizzazione — e la normalizzazione gira a ogni
 * salvataggio, cioe' subito dopo ogni aggiornamento che tocca una sezione.
 *
 * In `device-model.js` la storia e' scritta nei commenti, una riga per volta:
 * il contatto dell'infisso, il tipo di copertura, l'inferriata, il rele' di
 * discesa della seconda tenda, l'indirizzo RTSP, l'impianto del carico. Sei
 * campi, sei segnalazioni, sei righe aggiunte dopo. Ogni volta qualcuno aveva
 * perso quello che aveva configurato.
 *
 * La regola adesso e' un'altra: la forma resta un elenco chiuso, ma un valore
 * che e' un'entita' di Home Assistant si tiene comunque. Un campo nuovo
 * sopravvive all'aggiornamento che lo introduce, e uno vecchio sopravvive a
 * quello che lo dimentica.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  conservaIlConfigurato,
  normalizeDevice,
  sembraUnEntita,
} from "../src/core/device-model.js";
import { migrateRooms, normalizeEnergyLoads, normalizeSection } from "../src/core/migrations.js";
import { SOGLIA_CHIUSA_MASSIMA } from "../src/core/cover-kind.js";
import { normalizeRobots } from "../src/core/robot-model.js";

test("un'entita' si riconosce dalla forma, un nome di file no", () => {
  assert.equal(sembraUnEntita("sensor.forno_potenza"), true);
  assert.equal(sembraUnEntita("binary_sensor.oblo"), true);
  assert.equal(sembraUnEntita("input_boolean.x2"), true);
  /* Quello che entita' non e'. */
  assert.equal(sembraUnEntita("Lavatrice"), false);
  assert.equal(sembraUnEntita("mdi:gate"), false);
  assert.equal(sembraUnEntita("1.5"), false);
  assert.equal(sembraUnEntita("https://casa.lan/foto.png"), false);
  /* Un nome di file ha la stessa forma di un'entita', e non lo e'. */
  assert.equal(sembraUnEntita("ritratto.png"), false);
  assert.equal(sembraUnEntita("config.yaml"), false);
  assert.equal(sembraUnEntita(""), false);
  assert.equal(sembraUnEntita(null), false);
});

test("quello che il modello non conosce si tiene, entita' o no", () => {
  const uscita = conservaIlConfigurato(
    { id: "x", name: "Tenda" },
    {
      id: "x",
      name: "Un altro nome",
      casella_di_domani: "cover.tenda_terrazzo",
      elenco_di_domani: ["sensor.uno", "sensor.due"],
      colore_preferito: "rosso",
      numero: 12,
      acceso: false,
      dentro: { annidato: "sensor.tre" },
    },
    "covers",
  );
  /* Il campo nuovo con dentro un'entita' resta. */
  assert.equal(uscita.casella_di_domani, "cover.tenda_terrazzo");
  assert.deepEqual(uscita.elenco_di_domani, ["sensor.uno", "sensor.due"]);
  /* E anche quello che entita' non e': un colore, un numero, un no, un
   * oggetto. La soglia di chiusura di una finestra e' un numero, e finche' la
   * rete prendeva le sole entita' cadeva di qui. */
  assert.equal(uscita.colore_preferito, "rosso");
  assert.equal(uscita.numero, 12);
  assert.equal(uscita.acceso, false);
  assert.deepEqual(uscita.dentro, { annidato: "sensor.tre" });
  /* Quello che il modello sa gia' dire lo dice lui: non si sovrascrive. */
  assert.equal(uscita.name, "Tenda");
});

test("il vuoto non e' una configurazione, e non passa", () => {
  const uscita = conservaIlConfigurato(
    {},
    { niente: "", spazi: "   ", nullo: null, mancante: undefined, vuoto: [], oggettoVuoto: {} },
    "covers",
  );
  assert.deepEqual(uscita, {});
});

test("l'opinione del modello vale nella sua sezione, non dappertutto", () => {
  /* `soglia` la decide il ramo delle coperture, e la' non deve arrivare
   * grezza. In una sezione dove quel ramo non gira, quella stessa parola e'
   * un campo di chi configura come un altro: buttarla via per una regola
   * scritta per le tapparelle vorrebbe dire riaprire il difetto dalla porta
   * di servizio. */
  const tapparella = normalizeDevice(
    { id: "c1", entity: "cover.camera", soglia: "12" },
    "covers",
  );
  assert.equal(tapparella.soglia, 12);
  const apparecchio = normalizeDevice(
    { id: "a1", entity: "switch.forno", soglia: "una cosa mia" },
    "appliances",
  );
  assert.equal(apparecchio.soglia, "una cosa mia");
});

test("la soglia di chiusura di UNA finestra sopravvive al salvataggio (#298)", () => {
  /* «La percentuale di chiusura la devi spostare nella configurazione di
   * quella finestra»: la scheda la salvava, il modello la buttava al primo
   * giro, e da li' in poi quella finestra tornava alla soglia di casa. */
  const [riga] = normalizeSection("covers", [
    { id: "c1", name: "Camera", entity: "cover.camera", soglia: 12 },
  ]);
  assert.equal(riga.soglia, 12);
  /* Fuori scala rientra invece di sparire, e vuoto resta vuoto. */
  const [alta] = normalizeSection("covers", [{ id: "c2", entity: "cover.x", soglia: 999 }]);
  assert.equal(alta.soglia, SOGLIA_CHIUSA_MASSIMA);
  const [senza] = normalizeSection("covers", [{ id: "c3", entity: "cover.x", soglia: "" }]);
  assert.equal("soglia" in senza, false);
});

test("anche un robot tiene quello che il suo elenco non nomina", () => {
  /* Sette campi, e l'ottavo spariva: l'icona scelta, l'ordine, il campo che
   * arriva con la versione dopo. */
  const [robot] = normalizeRobots([
    {
      id: "robot-1",
      name: "Robot",
      entity: "vacuum.robot",
      icon: "mdi:robot-vacuum",
      order: 2,
      enabled: false,
    },
  ]);
  assert.equal(robot.entity, "vacuum.robot");
  assert.equal(robot.icon, "mdi:robot-vacuum");
  assert.equal(robot.order, 2);
  assert.equal(robot.enabled, false);
});

test("una casella che questa versione non conosce sopravvive al salvataggio", () => {
  /* La tapparella di domani, con un campo che oggi nessuno legge. */
  const tenda = normalizeDevice(
    {
      id: "cover-1",
      name: "Terrazzo",
      entity: "cover.terrazzo",
      /* Questi due il modello li conosce… */
      contact: "binary_sensor.terrazzo_infisso",
      /* …e questo no: e' la casella che arrivera' con la prossima versione. */
      sensore_vento: "sensor.terrazzo_vento",
    },
    "covers",
  );
  assert.equal(tenda.contact, "binary_sensor.terrazzo_infisso");
  assert.equal(tenda.sensore_vento, "sensor.terrazzo_vento");

  /* E lo stesso passando dalla porta di casa, `normalizeSection`, che e'
   * quella per cui passa un salvataggio vero. */
  const [salvata] = normalizeSection("covers", [
    { id: "cover-1", name: "Terrazzo", entity: "cover.terrazzo", sensore_vento: "sensor.vento" },
  ]);
  assert.equal(salvata.sensore_vento, "sensor.vento");
});

test("le stanze e i carichi dell'energia seguono la stessa regola", () => {
  const [stanza] = migrateRooms([
    { name: "Salotto", temp: "sensor.salotto_t", presenza: "binary_sensor.salotto_presenza" },
  ]);
  assert.equal(stanza.temp, "sensor.salotto_t");
  assert.equal(stanza.presenza, "binary_sensor.salotto_presenza");

  /* Il contatore totale di un carico non era nell'elenco: passando di qui
   * spariva, e con lui il consumo del mese. */
  const [carico] = normalizeEnergyLoads([
    {
      id: "pompa",
      name: "Pompa",
      power_entity: "sensor.pompa_w",
      total_energy_entity: "sensor.pompa_kwh",
    },
  ]);
  assert.equal(carico.power_entity, "sensor.pompa_w");
  assert.equal(carico.total_energy_entity, "sensor.pompa_kwh");
});

test("due giri di normalizzazione non tolgono niente al primo", () => {
  /* E' il caso vero: si salva, si aggiorna, si risalva. Quello che c'era al
   * primo giro dev'esserci al secondo. */
  const grezzo = {
    id: "appl-1",
    name: "Lavatrice",
    power_entity: "sensor.lavatrice_w",
    campo_di_domani: "sensor.lavatrice_domani",
  };
  const uno = normalizeDevice(grezzo, "appliances");
  const due = normalizeDevice(uno, "appliances");
  assert.deepEqual(due, uno);
  assert.equal(due.campo_di_domani, "sensor.lavatrice_domani");
});

test("una casella svuotata apposta resta svuotata", () => {
  /* I nomi vecchi il modello li versa in quelli nuovi: `power` diventa
   * `power_entity`. Tenerli anche com'erano vorrebbe dire che, svuotando la
   * casella, al giro dopo l'alias rimasto pieno la riporterebbe indietro — che
   * e' il difetto per cui «le foto delle auto si mescolano da sole». */
  const primo = normalizeDevice(
    { id: "a1", name: "Forno", power: "sensor.vecchio_w" },
    "appliances",
  );
  assert.equal(primo.power_entity, "sensor.vecchio_w");
  assert.equal("power" in primo, false);

  /* Adesso chi configura la svuota. */
  const svuotato = normalizeDevice({ ...primo, power_entity: "" }, "appliances");
  assert.equal(svuotato.power_entity, "");
});
