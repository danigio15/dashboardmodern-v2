/* Lo scaldabagno elettrico, che non e' un pannello solare (#253).
 *
 * «Ho sfruttato uno scaldabagno per l'acqua calda sanitaria. La card attuale e'
 * fantastica ma pensata per il solare termico. Le entita' potrebbero essere
 * switch di accensione, temperatura attuale dell'acqua, target e consumo?»
 *
 * La misura che conta non e' una temperatura qualunque: e' quanto manca
 * all'acqua calda. Queste prove la tengono ferma, insieme al caso di chi ha un
 * `water_heater.*` e non deve compilare niente.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  BASE_ACQUA,
  SCALDABAGNI_KEY,
  accesoDalloStato,
  entitaDiUnoScaldabagno,
  isWaterHeaterEntity,
  letturaScaldabagno,
  lettureScaldabagni,
  normalizeScaldabagni,
  quotaVersoObiettivo,
  statoScaldabagno,
  suggerisciScaldabagni,
} from "../src/core/scaldabagno-model.js";

const STATI = {
  "water_heater.boiler": {
    state: "eco",
    attributes: {
      friendly_name: "Boiler",
      current_temperature: 52.4,
      temperature: 60,
      min_temp: 15,
      max_temp: 75,
    },
  },
  "switch.resistenza": { state: "on" },
  "sensor.acqua": { state: "40" },
  "sensor.target": { state: "60" },
  "climate.termostato": { state: "heat", attributes: { temperature: 55 } },
  "sensor.potenza": { state: "1800" },
  "sensor.energia": { state: "4.3" },
};

test("con un water_heater non c'e' niente da compilare", () => {
  const lettura = letturaScaldabagno({ id: "a", entity: "water_heater.boiler" }, STATI);
  assert.equal(lettura.temperatura, 52.4);
  assert.equal(lettura.obiettivo, 60);
  assert.equal(lettura.acceso, true);
  assert.equal(lettura.stato, "scalda");
  // Si accende e si spegne da se': non serve un interruttore accanto.
  assert.equal(lettura.comandabile, "water_heater.boiler");
});

test("e con un rele' e due sonde funziona uguale", () => {
  /* E' il caso di chi ha scritto: niente entita' intera, solo le caselle. */
  const lettura = letturaScaldabagno(
    {
      id: "b",
      interruttore: "switch.resistenza",
      temperatura: "sensor.acqua",
      obiettivo: "sensor.target",
      potenza: "sensor.potenza",
      energia: "sensor.energia",
    },
    STATI,
  );
  assert.equal(lettura.acceso, true);
  assert.equal(lettura.temperatura, 40);
  assert.equal(lettura.obiettivo, 60);
  assert.equal(lettura.potenza, 1800);
  assert.equal(lettura.energia, 4.3);
  assert.equal(lettura.stato, "scalda");
  assert.equal(lettura.comandabile, "switch.resistenza");
});

test("l'obiettivo si legge anche dall'attributo di un termostato", () => {
  /* «Target preso dall'entita' del termostato»: li' l'obiettivo non e' lo
   * stato — lo stato e' la modalita' — ma un attributo. */
  const lettura = letturaScaldabagno(
    { id: "c", interruttore: "switch.resistenza", obiettivo: "climate.termostato" },
    STATI,
  );
  assert.equal(lettura.obiettivo, 55);
});

test("quanto manca all'acqua calda", () => {
  // Da 15 (l'acqua di rete) a 60: a 52,4 si e' all'83%.
  assert.equal(Math.round(quotaVersoObiettivo(52.4, 60, 15) * 1000), 831);
  assert.equal(quotaVersoObiettivo(15, 60, 15), 0);
  assert.equal(quotaVersoObiettivo(60, 60, 15), 1);
  // Oltre l'obiettivo non si va sopra il pieno, sotto il fondo non si va sotto zero.
  assert.equal(quotaVersoObiettivo(80, 60, 15), 1);
  assert.equal(quotaVersoObiettivo(5, 60, 15), 0);
  // Senza obiettivo non c'e' una corsa: meglio niente barra che una a caso.
  assert.equal(quotaVersoObiettivo(52, null, 15), null);
  assert.equal(quotaVersoObiettivo(null, 60, 15), null);
  // Il fondo di serie e' l'acqua di rete, e sta scritto una volta sola.
  assert.equal(BASE_ACQUA, 15);
  assert.equal(quotaVersoObiettivo(15, 60), 0);
  /* Un obiettivo sotto il fondo non e' una corsa: e' un fondo sbagliato, e la
   * sola risposta onesta e' «o ci sei o non ci sei». */
  assert.equal(quotaVersoObiettivo(20, 10, 15), 1);
  assert.equal(quotaVersoObiettivo(5, 10, 15), 0);
});

test("spento, scalda, pronto, o non lo sappiamo", () => {
  assert.equal(statoScaldabagno({ acceso: false, temperatura: 20, obiettivo: 60 }), "spento");
  assert.equal(statoScaldabagno({ acceso: true, temperatura: 40, obiettivo: 60 }), "scalda");
  assert.equal(statoScaldabagno({ acceso: true, temperatura: 60, obiettivo: 60 }), "pronto");
  /* Mezzo grado di tolleranza: sotto quella soglia la resistenza si sta gia'
   * spegnendo da sola, e dire «scalda» su un'acqua calda sarebbe falso. */
  assert.equal(statoScaldabagno({ acceso: true, temperatura: 59.7, obiettivo: 60 }), "pronto");
  assert.equal(statoScaldabagno({ acceso: true, temperatura: 59.0, obiettivo: 60 }), "scalda");
  // Niente numeri e nessuno stato: non si inventa.
  assert.equal(statoScaldabagno({}), "ignoto");
  assert.equal(statoScaldabagno({ acceso: null, temperatura: null }), "ignoto");
});

test("le parole con cui un dispositivo dice acceso o spento", () => {
  for (const parola of ["on", "heat", "eco", "performance", "heat_pump", "electric"])
    assert.equal(accesoDalloStato(parola), true, parola);
  for (const parola of ["off", "standby", "idle"])
    assert.equal(accesoDalloStato(parola), false, parola);
  // «unavailable» non e' «spento»: e' «non lo so», e va detto cosi'.
  assert.equal(accesoDalloStato("unavailable"), null);
  assert.equal(accesoDalloStato(""), null);
});

test("una riga senza nemmeno una casella non entra nell'elenco", () => {
  const righe = normalizeScaldabagni([
    { name: "Vuoto" },
    { name: "Buono", entity: "water_heater.boiler" },
    { name: "Solo sonda", temperatura: "sensor.acqua" },
    "non un oggetto",
  ]);
  assert.deepEqual(
    righe.map((riga) => riga.name),
    ["Buono", "Solo sonda"],
  );
  // Ogni riga si porta un id: le frecce e il cestino hanno bisogno di uno.
  assert.ok(righe.every((riga) => riga.id));
  assert.deepEqual(normalizeScaldabagni(null), []);
});

test("le entita' di una riga: servono all'interruttore «nel widget»", () => {
  const entita = entitaDiUnoScaldabagno({
    entity: "water_heater.boiler",
    interruttore: "switch.resistenza",
    potenza: "sensor.potenza",
  });
  assert.deepEqual(entita, ["water_heater.boiler", "switch.resistenza", "sensor.potenza"]);
  assert.deepEqual(entitaDiUnoScaldabagno({}), []);
});

test("«Rileva da Home Assistant» propone quelli che non sono ancora nell'elenco", () => {
  const trovati = suggerisciScaldabagni(STATI, []);
  assert.deepEqual(
    trovati.map((riga) => riga.entity),
    ["water_heater.boiler"],
  );
  assert.equal(trovati[0].name, "Boiler");
  // Quello gia' presente non si ripropone.
  assert.deepEqual(suggerisciScaldabagni(STATI, [{ entity: "water_heater.boiler" }]), []);
  assert.equal(isWaterHeaterEntity("water_heater.boiler"), true);
  assert.equal(isWaterHeaterEntity("sensor.boiler"), false);
});

test("piu' scaldabagni, una lettura ciascuno", () => {
  const letture = lettureScaldabagni(
    [
      { name: "Bagno", entity: "water_heater.boiler" },
      { name: "Taverna", interruttore: "switch.resistenza", temperatura: "sensor.acqua" },
    ],
    STATI,
  );
  assert.equal(letture.length, 2);
  assert.equal(letture[0].name, "Bagno");
  assert.equal(letture[1].name, "Taverna");
});

test("la tessera esiste, ha la sua chiave e il suo disegno", async () => {
  const ponte = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  assert.match(ponte, /key: "scaldabagno"/);
  // L'anello dice quanto manca all'acqua calda, non una percentuale inventata.
  assert.match(ponte, /testa\.quota == null \? null : Math\.round\(testa\.quota \* 100\)/);
  // La chiave della configurazione e' quella del nucleo, non una copia.
  assert.match(ponte, /SCALDABAGNI_KEY/);
  assert.equal(SCALDABAGNI_KEY, "cd_scaldabagni");

  const oggetti = await readFile(
    new URL("../src/core/oggetti-widget.js", import.meta.url),
    "utf8",
  );
  assert.match(oggetti, /^\s{2}scaldabagno: `/m);

  /* La chiave viaggia con la configurazione: senza, chi la compila su un
   * dispositivo non la ritrova sugli altri ne' nel backup. */
  const persistenza = await readFile(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  assert.match(persistenza, /"cd_scaldabagni"/);
});

test("la finestra non racconta lo scaldabagno contando le caselle", async () => {
  const { fraseDellaTessera } = await import("../src/core/racconto-tessera.js");
  const italiano = (it) => it;
  const tessera = (unita) => ({ key: "scaldabagno", rows: [], unita });

  /* La frase generica direbbe «uno su otto in funzione» contando le righe, che
   * qui sono le caselle. Di uno scaldabagno si vuole sapere l'acqua. */
  const scalda = fraseDellaTessera(
    tessera([{ stato: "scalda", temperatura: 52.4, obiettivo: 60 }]),
    italiano,
  );
  assert.match(scalda, /52,4/);
  assert.match(scalda, /mancano/);
  assert.doesNotMatch(scalda, /in funzione/);

  assert.match(
    fraseDellaTessera(tessera([{ stato: "pronto", temperatura: 60 }]), italiano),
    /pronta/,
  );
  assert.match(
    fraseDellaTessera(tessera([{ stato: "spento", temperatura: 52.4 }]), italiano),
    /Spento/,
  );
  assert.match(
    fraseDellaTessera(
      tessera([{ stato: "scalda", temperatura: 40, obiettivo: 60 }, { stato: "pronto" }]),
      italiano,
    ),
    /1 su 2/,
  );
});
