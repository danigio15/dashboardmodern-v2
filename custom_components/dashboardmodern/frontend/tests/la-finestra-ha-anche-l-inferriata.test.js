/* Due contatti su un serramento solo (#254).
 *
 * «Non ho le tapparelle. Sarebbe possibile una card che consideri due sensori
 * di contatto, uno per le inferriate esterne e uno per gli infissi interni?
 * Un'immagine che consideri i vari stati.» Gli stati sono quattro, e queste
 * prove li tengono fermi tutti — compreso quello che non si puo' evitare: un
 * sensore che non risponde.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  INFERRIATA_KEYS,
  STATI_SERRAMENTO,
  contactEntity,
  inferriataEntity,
  isWindowOnly,
  serramentoModel,
  shutterWindowModel,
  statoDelSerramento,
} from "../src/core/shutter-window.js";

const acceso = (nome) => ({ [nome]: { state: "on" } });
const spento = (nome) => ({ [nome]: { state: "off" } });

test("i quattro stati che si volevano distinguere", () => {
  assert.equal(statoDelSerramento(false, false), "chiuso");
  assert.equal(statoDelSerramento(true, false), "grata");
  assert.equal(statoDelSerramento(false, true), "infisso");
  assert.equal(statoDelSerramento(true, true), "aperto");
  // Tutti e quattro sono nomi dichiarati: chi disegna non deve indovinarli.
  for (const stato of ["chiuso", "grata", "infisso", "aperto"]) {
    assert.ok(STATI_SERRAMENTO.includes(stato));
  }
});

test("un sensore muto non diventa una finestra chiusa", () => {
  // Se non risponde nessuno dei due non si sa niente, e si dice cosi'.
  assert.equal(statoDelSerramento(null, null), "ignoto");
  // Se ne risponde uno solo, quello parla: la grata muta non zittisce la
  // finestra aperta, che e' proprio la cosa che si vuole sapere.
  assert.equal(statoDelSerramento(null, true), "infisso");
  assert.equal(statoDelSerramento(null, false), "chiuso");
  assert.equal(statoDelSerramento(true, null), "grata");
  assert.equal(statoDelSerramento(false, null), "chiuso");
});

test("la casella dell'inferriata si legge coi nomi che la gente usa", () => {
  assert.equal(inferriataEntity({ inferriata: "binary_sensor.grata" }), "binary_sensor.grata");
  assert.equal(inferriataEntity({ grate_entity: "binary_sensor.g" }), "binary_sensor.g");
  assert.equal(inferriataEntity({ outer_contact: "binary_sensor.o" }), "binary_sensor.o");
  assert.equal(inferriataEntity({}), "");
  // E non si confonde con quella dell'infisso: sono due caselle diverse.
  assert.equal(inferriataEntity({ contact: "binary_sensor.finestra" }), "");
  assert.equal(contactEntity({ inferriata: "binary_sensor.grata" }), "");
  for (const chiave of INFERRIATA_KEYS) {
    assert.equal(inferriataEntity({ [chiave]: "binary_sensor.x" }), "binary_sensor.x");
  }
});

test("il serramento intero: grata davanti, infisso dietro", () => {
  const riga = { inferriata: "binary_sensor.grata", contact: "binary_sensor.finestra" };
  const tuttoChiuso = serramentoModel(riga, {
    ...spento("binary_sensor.grata"),
    ...spento("binary_sensor.finestra"),
  });
  assert.equal(tuttoChiuso.stato, "chiuso");
  assert.equal(tuttoChiuso.inferriata.configured, true);
  assert.equal(tuttoChiuso.infisso.configured, true);

  assert.equal(
    serramentoModel(riga, { ...acceso("binary_sensor.grata"), ...spento("binary_sensor.finestra") })
      .stato,
    "grata",
  );
  assert.equal(
    serramentoModel(riga, { ...spento("binary_sensor.grata"), ...acceso("binary_sensor.finestra") })
      .stato,
    "infisso",
  );
  assert.equal(
    serramentoModel(riga, { ...acceso("binary_sensor.grata"), ...acceso("binary_sensor.finestra") })
      .stato,
    "aperto",
  );
});

test("chi ha una casella sola non ne vede due", () => {
  const soloFinestra = serramentoModel(
    { contact: "binary_sensor.finestra" },
    acceso("binary_sensor.finestra"),
  );
  assert.equal(soloFinestra.inferriata.configured, false);
  assert.equal(soloFinestra.stato, "infisso");

  const soloGrata = serramentoModel(
    { inferriata: "binary_sensor.grata" },
    acceso("binary_sensor.grata"),
  );
  assert.equal(soloGrata.infisso.configured, false);
  assert.equal(soloGrata.stato, "grata");
});

test("il verso girato vale per tutti e due i contatti", () => {
  /* Il #244: certi contatti stanno a ON quando l'infisso e' CHIUSO. Il verso
   * e' un fatto del filo, non del tipo di apertura: se vale per la finestra
   * deve valere per la grata. */
  const riga = { inferriata: "binary_sensor.grata", contact: "binary_sensor.finestra" };
  const stati = { ...acceso("binary_sensor.grata"), ...acceso("binary_sensor.finestra") };
  const dritto = serramentoModel(riga, stati, (v) => v, new Set());
  assert.equal(dritto.stato, "aperto");

  const grataGirata = serramentoModel(riga, stati, (v) => v, new Set(["binary_sensor.grata"]));
  assert.equal(grataGirata.stato, "infisso");

  const entrambeGirate = serramentoModel(
    riga,
    stati,
    (v) => v,
    new Set(["binary_sensor.grata", "binary_sensor.finestra"]),
  );
  assert.equal(entrambeGirate.stato, "chiuso");
});

test("una riga con le sole grate si puo' salvare", () => {
  /* Era gia' vero per il solo contatto dell'infisso — «ho le persiane manuali,
   * pero' ho i sensori di apertura» — e vale per lo stesso motivo: la riga non
   * comanda niente ma ha qualcosa da dire. */
  assert.equal(isWindowOnly({ inferriata: "binary_sensor.grata" }), true);
  assert.equal(isWindowOnly({ contact: "binary_sensor.finestra" }), true);
  assert.equal(isWindowOnly({}), false);
  // Con un motore non e' piu' una finestra sola: e' una copertura.
  assert.equal(isWindowOnly({ entity: "cover.a", inferriata: "binary_sensor.g" }), false);
});

test("la lettura del solo infisso resta quella di prima", () => {
  /* `shutterWindowModel` la usa ancora chi legge un contatto solo: il modello
   * nuovo non deve averla cambiata sotto i piedi. */
  const model = shutterWindowModel({ contact: "binary_sensor.a" }, acceso("binary_sensor.a"));
  assert.deepEqual(model, { entity: "binary_sensor.a", open: true, configured: true });
  assert.deepEqual(shutterWindowModel({}, {}), { entity: "", open: null, configured: false });
});

test("la pagina disegna la grata, e solo dove qualcuno l'ha dichiarata", async () => {
  const source = await readFile(
    new URL("../src/sections/shutter-window-section.js", import.meta.url),
    "utf8",
  );
  // Il nodo della grata esiste sempre ma resta spento senza il sensore: la
  // card di chi non ha inferriate non deve cambiare di un pixel.
  assert.match(source, /dm-tw-grata/);
  assert.match(source, /\.dm-tw-grata\{[^}]*display:none!important\}/);
  assert.match(source, /tapp-win\[data-dm-grata\] \.dm-tw-grata\{display:block!important\}/);
  // Sta davanti all'infisso, perche' l'inferriata sta fuori.
  assert.match(source, /\.dm-tw-grata\{[^}]*z-index:8!important/);
  // E la casella per dichiararla c'e'.
  assert.match(source, /ed-tp-inferriata/);
});

test("le quattro parole della pastiglia", async () => {
  const { paroleDelSerramento } = await import(
    `../src/sections/shutter-window-section.js?fix=${Date.now()}`
  );
  const con = (stato, grata = true) => ({
    stato,
    inferriata: { configured: grata },
    infisso: { open: stato === "infisso" || stato === "aperto" },
  });
  assert.equal(paroleDelSerramento(con("chiuso")), "");
  assert.ok(paroleDelSerramento(con("grata")).length > 0);
  assert.ok(paroleDelSerramento(con("infisso")).length > 0);
  assert.notEqual(paroleDelSerramento(con("grata")), paroleDelSerramento(con("infisso")));
  assert.notEqual(paroleDelSerramento(con("aperto")), paroleDelSerramento(con("grata")));
  // Senza inferriata dichiarata resta la frase di sempre, e a card chiusa
  // nessuna pastiglia.
  assert.equal(paroleDelSerramento({ stato: "chiuso", inferriata: {}, infisso: {} }), "");
  assert.ok(
    paroleDelSerramento({ stato: "infisso", inferriata: {}, infisso: { open: true } }).length > 0,
  );
});
