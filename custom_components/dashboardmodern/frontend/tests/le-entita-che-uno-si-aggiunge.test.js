/* «In alcune schede non è possibile inserire entità o sensori personalizzati.
 * Sarebbe carino avere la possibilità d'aggiungere le entità o sensori
 * personalizzati in ogni scheda del progetto, modificando il nome, icona,
 * stanza di destinazione» (#271).
 *
 * Alcune schede sono elenchi — Luci, Prese, Telecamere, Robot — e lì un'entità
 * in più si è sempre potuta aggiungere: l'elenco è la sezione. Altre sono
 * fatte di caselle con un ruolo preciso — l'Energia ha una rete e un
 * fotovoltaico, la Sicurezza una centrale, il MiniPC una CPU — e lì non c'era
 * posto per un sensore in più: quello che non ha un ruolo restava fuori dalla
 * plancia anche se in casa c'era.
 *
 * Una voce dice quattro cose: quale entità, in quale scheda farla comparire,
 * come chiamarla e con che icona — più la stanza. Il modello è puro, e queste
 * prove lo tengono onesto; le altre difendono le due regole che si perdono
 * facilmente: quello che non risponde non è «spento», e il salvataggio a
 * catena della fascia in fondo scrive per tutte le righe, non solo la prima.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CHIAVE_ENTITA_MIE,
  MASSIMO_PER_SEZIONE,
  entitaDaGuardare,
  entitaDellaSezione,
  entitaMie,
  letturaDellaVoce,
  lettureDellaSezione,
  normalizzaVoce,
  sezioniConEntita,
} from "../src/core/entita-mie.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

const VOCI = [
  {
    id: "a",
    entity: "sensor.pressione",
    nome: "Pressione impianto",
    icona: "🧭",
    sezione: "energy",
  },
  { entity: "switch.pompa", sezione: "energy" },
  { entity: "sensor.modulazione", nome: "Modulazione", sezione: "security", room_id: "centrale" },
  /* Una riga appena aggiunta, ancora senza entità: nell'elenco non c'è. */
  { id: "vuota", entity: "", sezione: "security" },
];

test("una voce è quattro cose, e senza entità non è una voce", () => {
  const voce = normalizzaVoce({ entity: " sensor.x ", name: "Nome", icon: "🌿", tab: "energy" });
  /* I nomi inglesi si leggono lo stesso: le voci arrivano anche da un backup
   * scritto da una versione che li chiamava così. */
  assert.deepEqual(voce, {
    id: "mia-1",
    entity: "sensor.x",
    nome: "Nome",
    icona: "🌿",
    sezione: "energy",
    room_id: "",
  });
  assert.equal(normalizzaVoce(null, 4).id, "mia-5", "un id ce l'ha sempre, anche da niente");
  assert.equal(entitaMie(VOCI).length, 3, "la riga senza entità resta fuori");
  assert.equal(entitaMie("non è una lista").length, 0);
});

test("ogni voce sa su quale scheda va, e le schede sanno chi hanno", () => {
  assert.deepEqual(
    entitaDellaSezione(VOCI, "energy").map((v) => v.entity),
    ["sensor.pressione", "switch.pompa"],
    "nell'ordine in cui sono scritte",
  );
  assert.deepEqual(sezioniConEntita(VOCI), ["energy", "security"]);
  /* Senza scheda non si sa dove metterla, e non si indovina. */
  assert.deepEqual(entitaDellaSezione(VOCI, ""), []);
  assert.deepEqual(entitaDaGuardare(VOCI), [
    "sensor.pressione",
    "switch.pompa",
    "sensor.modulazione",
  ]);
});

test("su una scheda ce ne stanno dodici: oltre è un elenco, e per quello c'è un'altra strada", () => {
  const tante = Array.from({ length: 20 }, (_, i) => ({
    entity: `sensor.n${i}`,
    sezione: "energy",
  }));
  assert.equal(MASSIMO_PER_SEZIONE, 12);
  assert.equal(entitaDellaSezione(tante, "energy").length, 12);
});

test("quello che non risponde non è spento: è muto, e lo dice", () => {
  const stati = {
    "sensor.pressione": { state: "1.8", attributes: { unit_of_measurement: "bar" } },
    "switch.pompa": { state: "on", attributes: { friendly_name: "Pompa solare" } },
    "sensor.rotto": { state: "unavailable" },
  };
  const misura = letturaDellaVoce({ entity: "sensor.pressione" }, stati);
  assert.equal(misura.numero, 1.8);
  assert.equal(misura.unita, "bar");
  assert.equal(misura.muto, false);
  assert.equal(misura.comandabile, false, "un sensore non ha un tasto");

  const leva = letturaDellaVoce({ entity: "switch.pompa" }, stati);
  assert.equal(leva.acceso, true);
  assert.equal(leva.comandabile, true);
  /* Senza nome scritto vale quello di Home Assistant, e solo in ultimo
   * l'entity_id: un identificatore in mezzo alle parole non è un nome. */
  assert.equal(leva.nome, "Pompa solare");

  for (const id of ["sensor.rotto", "sensor.mai_vista"]) {
    const muta = letturaDellaVoce({ entity: id }, stati);
    assert.equal(muta.muto, true, `${id} deve risultare muta`);
    assert.equal(muta.acceso, false, "muta non vuol dire spenta, e non si accende");
    assert.equal(muta.numero, null);
  }
});

test("l'entità si legge dove la mappatura la manda", () => {
  /* La plancia rinomina le entità con le proprie mappature: la voce può
   * nominare un riferimento `dm.*`, e la lettura deve seguire chi lo risolve. */
  const stati = { "sensor.vero": { state: "42", attributes: { unit_of_measurement: "%" } } };
  const letto = letturaDellaVoce({ entity: "dm.finto" }, stati, () => "sensor.vero");
  assert.equal(letto.numero, 42);
  /* E se chi risolve inciampa, si legge il nome scritto invece di rompersi. */
  const rotto = letturaDellaVoce({ entity: "sensor.vero" }, stati, () => {
    throw new Error("no");
  });
  assert.equal(rotto.numero, 42);
});

test("le letture di una scheda arrivano pronte, nell'ordine scritto", () => {
  const stati = { "sensor.pressione": { state: "1.8" }, "switch.pompa": { state: "off" } };
  const righe = lettureDellaSezione(VOCI, "energy", stati);
  assert.deepEqual(
    righe.map((r) => [r.nome, r.acceso]),
    [
      ["Pressione impianto", false],
      ["switch.pompa", false],
    ],
  );
});

test("il blocco nasce dove nasce l'intestazione della pagina, non appeso alla scheda", () => {
  /* Alcune pagine tengono le card dentro un contenitore che ne fissa la
   * larghezza, altre no: un blocco appeso sempre alla pagina restava largo il
   * doppio del resto su metà della plancia. La domanda l'ha già risolta chi
   * disegna le intestazioni, e si va dove è nata lei. */
  const sorgente = leggi("sections/entita-mie-section.js");
  assert.match(sorgente, /const fascia = pagina\.querySelector\("\.dm-page-mast"\);/);
  assert.match(sorgente, /casa && casa\.lastElementChild !== nodo/);
  /* E il disegno è di casa: l'emoji la sceglie chi configura, il ripiego no. */
  assert.match(sorgente, /oggettoWidget\("mie"\)/);
  assert.match(sorgente, /oggettoWidget\(riga\.comandabile \? "azioni" : "evidenza"\)/);
});

test("la scheda che le compila è una sola, e la pagina è un campo della voce", () => {
  const editor = leggi("sections/entita-mie-editor-section.js");
  /* Una scheda per tutte le pagine: chi ha tre sensori sparsi li vede insieme
   * invece di cercarsi tre schede diverse. */
  assert.match(editor, /export const ENTITA_MIE_EDITOR_TAB = "entita";/);
  assert.match(editor, /data-mia-ent-campo="sezione"/);
  /* Il salvataggio a catena della fascia in fondo: il primo tasto scrive e
   * ridisegna, e il ridisegno stacca gli altri dal documento. Chi scrive per
   * primo scrive per tutti — è la regola nata da #288. */
  assert.match(editor, /righeDelDocumento\(body, "data-mia-ent", voci\(\)/);
  /* L'elenco delle schede si legge dalla barra, non da una tabella scritta a
   * mano: così porta i nomi dati dall'utente e non invecchia. */
  assert.match(editor, /querySelectorAll\?\.\("nav\.tabs \.tab\[data-tab\]"\)/);
});

test("le schede fra cui scegliere sono quelle che esistono, tranne la configurazione", async () => {
  const { sezioniDisponibili } = await import("../src/sections/entita-mie-editor-section.js");
  const scheda = (tab, nome) => ({
    dataset: { tab },
    querySelector: () => (nome === null ? null : { textContent: nome }),
  });
  const pagine = new Set(["page-home", "page-energy", "page-security"]);
  const finto = {
    querySelectorAll: () => [
      scheda("home", "Casa mia"),
      scheda("energy", "Energia"),
      /* Una voce della barra senza pagina dietro non è una destinazione. */
      scheda("nessuna", "Fantasma"),
      /* La configurazione è il posto da cui si sta guardando. */
      scheda("config", "Config"),
      /* Ripetuta: la barra ne può avere due copie, l'elenco no. */
      scheda("energy", "Energia"),
      /* Senza scritta vale il nome tecnico, invece di una riga vuota. */
      scheda("security", null),
    ],
    getElementById: (id) => (pagine.has(id) ? {} : null),
  };
  assert.deepEqual(sezioniDisponibili(finto), [
    { tab: "home", nome: "Casa mia" },
    { tab: "energy", nome: "Energia" },
    { tab: "security", nome: "security" },
  ]);
});

test("la scelta viaggia con la plancia, come le sezioni proprie", () => {
  /* Chi la fa dal tablet la vuole anche sul telefono: l'elenco è una scelta
   * sulla plancia, non su questo dispositivo. */
  const persistenza = leggi("sections/config-persistence-section.js");
  assert.equal(CHIAVE_ENTITA_MIE, "cd_entita_mie");
  assert.match(persistenza, /"cd_entita_mie",/);
  assert.match(persistenza, /CONFIG_KEYS_REVISION = 24/);
  /* E la plancia le installa: senza questo non le disegnerebbe nessuno. */
  const runtime = leggi("sections/section-runtime.js");
  assert.match(runtime, /installEntitaMie\(\);/);
  assert.match(runtime, /installEntitaMieEditor\(\);/);
});
