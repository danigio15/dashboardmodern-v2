/* Il locale caldaia ha tre macchine, e nessuna pretende le sonde (#253).
 *
 * «Non lo farei solo nella sezione widget: lo creerei nella sezione con una
 * scelta fra solare termico, solo boiler oppure caldaia, e in base alla scelta
 * la sezione prende forma. Possono essere selezionate anche due o tutte e tre.»
 * E poi: «Prevedi sia per la caldaia che per lo scaldabagno anche il semplice
 * utilizzo senza sonde di temperatura: deve essere libero di scelta.»
 *
 * Queste prove tengono ferme le due cose insieme: la scelta, e il fatto che una
 * casella non compilata non e' un errore ma un'assenza — e un'assenza non si
 * disegna come un numero mancante.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  BRICIOLA_SEZIONE,
  CASELLE_CALDAIA,
  CHIAVE_CALDAIA,
  CHIAVE_IMPIANTI,
  NOME_SEZIONE,
  TIPI_TERMICI,
  accesoCaldaia,
  entitaDellaCaldaia,
  impiantiScelti,
  letturaCaldaia,
  normalizzaCaldaia,
  normalizzaScelta,
  servonoLinguette,
  tabAttiva,
  verdettoPressione,
  normalizzaCaldaie,
  entitaDelleCaldaie,
  lettureCaldaie,
} from "../src/core/impianti-termici.js";
import { letturaScaldabagno, statoScaldabagno } from "../src/core/scaldabagno-model.js";

test("si sceglie quello che si ha, uno o tutti e tre", () => {
  assert.deepEqual(impiantiScelti({ solare: true, scaldabagno: false, caldaia: false }, {}), [
    "solare",
  ]);
  assert.deepEqual(impiantiScelti({ solare: true, scaldabagno: true, caldaia: true }, {}), [
    "solare",
    "scaldabagno",
    "caldaia",
  ]);
  assert.deepEqual(impiantiScelti({ solare: false, scaldabagno: true, caldaia: true }, {}), [
    "scaldabagno",
    "caldaia",
  ]);
  /* L'ordine non e' alfabetico: e' quello in cui il calore arriva in casa —
   * prima quello gratis, poi quello a corrente, poi quello a gas. */
  assert.deepEqual([...TIPI_TERMICI], ["solare", "scaldabagno", "caldaia"]);
});

test("chi non ha ancora scelto non perde la pagina che vedeva ieri", () => {
  /* La domanda e' nuova: una plancia gia' configurata col solare deve
   * continuare a mostrarlo senza che nessuno vada a mettere una spunta. */
  assert.deepEqual(impiantiScelti(null, { solare: true }), ["solare"]);
  assert.deepEqual(impiantiScelti(null, { scaldabagno: true }), ["scaldabagno"]);
  assert.deepEqual(impiantiScelti(null, { solare: true, caldaia: true }), ["solare", "caldaia"]);
  // Nessuna scelta e nessun indizio: resta quello che la pagina ha sempre mostrato.
  assert.deepEqual(impiantiScelti(null, {}), ["solare"]);
  assert.deepEqual(impiantiScelti(undefined, {}), ["solare"]);
  /* Tolte tutte le spunte, invece, la sezione resta vuota: e' una scelta, e
   * riempirla sarebbe disobbedire. */
  assert.deepEqual(impiantiScelti({ solare: false, scaldabagno: false, caldaia: false }, { solare: true }), []);
  assert.equal(normalizzaScelta({ solare: false, scaldabagno: false, caldaia: false }).vuota, true);
  assert.equal(normalizzaScelta(null), null);
});

test("le linguette compaiono solo quando c'e' da scegliere", () => {
  assert.equal(servonoLinguette(["solare"]), false);
  assert.equal(servonoLinguette([]), false);
  assert.equal(servonoLinguette(["solare", "caldaia"]), true);
  // Una linguetta che non esiste piu' non lascia la pagina su niente.
  assert.equal(tabAttiva(["solare", "caldaia"], "scaldabagno"), "solare");
  assert.equal(tabAttiva(["solare", "caldaia"], "caldaia"), "caldaia");
  assert.equal(tabAttiva([], "solare"), "");
});

test("la sezione si chiama Gestione termica, non come una delle tre macchine", () => {
  assert.equal(NOME_SEZIONE[0], "Gestione termica");
  assert.ok(BRICIOLA_SEZIONE[0].includes("Solare"));
  assert.ok(BRICIOLA_SEZIONE[0].includes("Caldaia"));
});

test("la caldaia si legge, e il salto e' la misura che conta", () => {
  const stati = {
    "sensor.m": { state: "62.4" },
    "sensor.r": { state: "48.1" },
    "binary_sensor.f": { state: "on" },
    "sensor.p": { state: "1.8" },
  };
  const lettura = letturaCaldaia(
    { mandata: "sensor.m", ritorno: "sensor.r", fiamma: "binary_sensor.f", pressione: "sensor.p" },
    stati,
  );
  assert.equal(lettura.mandata, 62.4);
  assert.equal(lettura.ritorno, 48.1);
  assert.equal(lettura.salto, 14.3);
  assert.equal(lettura.fiamma, true);
  /* La fiamma accesa e' gia' una caldaia accesa: chi mappa solo il bruciatore
   * non deve mappare anche uno stato per vedere la sua macchina viva. */
  assert.equal(lettura.acceso, true);
});

test("la pressione dice quando chiede attenzione", () => {
  assert.equal(verdettoPressione(0.8), "bassa");
  assert.equal(verdettoPressione(1.8), "buona");
  assert.equal(verdettoPressione(2.8), "alta");
  // Nessuna pressione mappata non e' una pressione sbagliata.
  assert.equal(verdettoPressione(null), "");
  assert.equal(verdettoPressione(undefined), "");
});

test("le parole con cui una caldaia dice acceso e spento", () => {
  for (const parola of ["on", "heating", "burning", "flame", "dhw"])
    assert.equal(accesoCaldaia(parola), true, parola);
  for (const parola of ["off", "idle", "standby"]) assert.equal(accesoCaldaia(parola), false, parola);
  assert.equal(accesoCaldaia("unavailable"), null);
});

/* ── il caso spartano: nessuna sonda ──────────────────────────────────── */

test("una caldaia col solo stato e' una configurazione valida", () => {
  const lettura = letturaCaldaia(
    { stato: "binary_sensor.caldaia" },
    { "binary_sensor.caldaia": { state: "on" } },
  );
  assert.equal(lettura.acceso, true);
  // Nessun numero inventato: quello che non c'e' resta assente.
  assert.equal(lettura.mandata, null);
  assert.equal(lettura.ritorno, null);
  assert.equal(lettura.salto, null);
  assert.equal(lettura.pressione, null);
  // E la riga vale: ha un'entita' da guardare.
  assert.deepEqual(entitaDellaCaldaia({ stato: "binary_sensor.caldaia" }), [
    "binary_sensor.caldaia",
  ]);
  assert.deepEqual(entitaDellaCaldaia({}), []);
});

test("uno scaldabagno col solo interruttore e' una configurazione valida", () => {
  const acceso = letturaScaldabagno(
    { id: "a", interruttore: "switch.scaldabagno" },
    { "switch.scaldabagno": { state: "on" } },
  );
  assert.equal(acceso.acceso, true);
  assert.equal(acceso.temperatura, null);
  assert.equal(acceso.obiettivo, null);
  /* Senza obiettivo non c'e' una corsa da misurare: `null`, non zero. Zero
   * sarebbe «serbatoio vuoto», che e' un'affermazione. */
  assert.equal(acceso.quota, null);
  assert.equal(acceso.stato, "scalda");

  const spento = letturaScaldabagno(
    { id: "b", interruttore: "switch.scaldabagno" },
    { "switch.scaldabagno": { state: "off" } },
  );
  assert.equal(spento.stato, "spento");
  assert.equal(statoScaldabagno({ acceso: true }), "scalda");
  assert.equal(statoScaldabagno({ acceso: false }), "spento");
});

test("una targhetta senza numero non si disegna", async () => {
  const source = await readFile(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  /* Cinque targhette con «--» non sono una scheda spoglia: sono cinque
   * promesse non mantenute. Il nodo non nasce proprio. */
  assert.match(source, /function nodoTarghetta\([^)]*\)\s*\{\s*if \(valore == null\) return "";/);
  // E la scena dichiara se le sonde ci sono, cosi' il disegno puo' cambiare.
  assert.match(source, /data-sonde="\$\{conSonde\}"/);
  /* Senza sonde il serbatoio si riempie tutto e parla il colore: disegnarlo
   * vuoto direbbe «non c'e' acqua calda», che e' un'affermazione. */
  assert.match(source, /data-sonde="false"\] \.dm-it-tank-acqua/);
  assert.match(source, /const quota = conSonde \? Math\.round\(unita\.quota \* 100\) : 100/);
});

test("la caldaia col solo stato accende l'oblo' e si nomina per quello che legge", async () => {
  const source = await readFile(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  /* Chi ha mappato solo lo stato non ha un bruciatore da leggere: l'oblo'
   * spento sopra una caldaia accesa direbbe il contrario di quel che si sa. */
  assert.match(
    source,
    /const brucia = lettura\.fiamma === true \|\| \(lettura\.fiamma == null && lettura\.acceso === true\)/,
  );
  // E la pastiglia nomina quello che si sta leggendo davvero.
  assert.match(source, /lettura\.fiamma != null/);
  assert.ok(source.includes("Caldaia accesa"));
});

test("le due chiavi nuove viaggiano con la configurazione", async () => {
  const persistenza = await readFile(
    new URL("../src/sections/config-persistence-section.js", import.meta.url),
    "utf8",
  );
  assert.match(persistenza, /"cd_impianti_termici"/);
  assert.match(persistenza, /"cd_caldaia"/);
  assert.equal(CHIAVE_IMPIANTI, "cd_impianti_termici");
  assert.equal(CHIAVE_CALDAIA, "cd_caldaia");
});

test("la configurazione della caldaia si ripulisce da sola", () => {
  const pulita = normalizzaCaldaia({ name: "  Vaillant  ", mandata: " sensor.m ", strano: "x" });
  assert.equal(pulita.name, "Vaillant");
  assert.equal(pulita.mandata, "sensor.m");
  assert.equal(pulita.strano, undefined);
  for (const { campo } of CASELLE_CALDAIA) assert.equal(typeof pulita[campo], "string");
  assert.equal(normalizzaCaldaia(null).mandata, "");
});

/* ── due caldaie, una per zona (#281) ─────────────────────────────────────
 *
 * «Avendo una casa composta da due appartamenti uniti ho due caldaie, una per
 * la zona giorno e una per la zona notte.» */

test("la chiave della caldaia accetta l'oggetto di prima e la lista di adesso", () => {
  /* Chi ne ha una la ritrova dov'era, senza migrare niente: e' la stessa
   * chiave, e la forma vecchia continua a leggersi. */
  const sola = normalizzaCaldaie({ name: "Caldaia", stato: "binary_sensor.c" });
  assert.equal(sola.length, 1);
  assert.equal(sola[0].name, "Caldaia");
  assert.equal(sola[0].id, "caldaia-1");

  const due = normalizzaCaldaie([
    { id: "giorno", name: "Zona giorno", stato: "binary_sensor.g" },
    { name: "Zona notte", mandata: "sensor.n" },
  ]);
  assert.deepEqual(
    due.map((riga) => [riga.id, riga.name]),
    [
      ["giorno", "Zona giorno"],
      ["caldaia-2", "Zona notte"],
    ],
  );
});

test("una riga senza nessuna entità non è una caldaia", () => {
  /* Quella appena aggiunta vive nell'editor finche' non si compila: in pagina
   * sarebbe una macchina che non dice niente. */
  assert.equal(normalizzaCaldaie([{ name: "Nuova" }]).length, 0);
  assert.equal(normalizzaCaldaie({}).length, 0);
  assert.equal(normalizzaCaldaie(null).length, 0);
});

test("le entità e le letture arrivano da tutte e due", () => {
  const config = [
    { id: "g", name: "Giorno", mandata: "sensor.g_m", ritorno: "sensor.g_r" },
    { id: "n", name: "Notte", mandata: "sensor.n_m", ritorno: "sensor.n_r" },
  ];
  assert.deepEqual(entitaDelleCaldaie(config), [
    "sensor.g_m",
    "sensor.g_r",
    "sensor.n_m",
    "sensor.n_r",
  ]);
  const letture = lettureCaldaie(config, {
    "sensor.g_m": { state: "62.4" },
    "sensor.g_r": { state: "48.1" },
    "sensor.n_m": { state: "34" },
    "sensor.n_r": { state: "32.5" },
  });
  assert.deepEqual(
    letture.map((riga) => [riga.id, riga.salto]),
    [
      ["g", 14.3],
      ["n", 1.5],
    ],
  );
});

test("la pagina mostra una macchina alla volta, con la fila per cambiare", async () => {
  const sezione = await readFile(
    new URL("../src/sections/impianti-termici-section.js", import.meta.url),
    "utf8",
  );
  /* La fila non compare con una macchina sola: un selettore fra una cosa sola
   * e' un tasto che non sceglie niente. */
  assert.match(sezione, /if \(righe\.length < 2\) return "";/);
  assert.match(sezione, /data-dm-it-quale=/);
  /* E vale per tutti e due i tipi: gli scaldabagni erano gia' una lista in
   * configurazione, ma la pagina ne disegnava uno. */
  assert.match(sezione, /const quali = attiva === "caldaia" \? caldaie : letture;/);
});
