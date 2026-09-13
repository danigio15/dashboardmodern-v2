/* «Quando si parte da zero le sezioni sotto non devono rilevare
 *  automaticamente le cose e inserirle, per questo c'è la funzione in config
 *  che rileva automaticamente. Tutto deve partire senza nulla e le sezioni che
 *  non hanno entità valorizzate devono essere nascoste.»
 *
 * Su una plancia appena installata la barra mostrava HOME, VARCHI, PRESENZA,
 * BATTERIE e CONFIG — con la Home che diceva ancora «la dashboard è quasi
 * pronta». Le tre in mezzo non le aveva chieste nessuno: sono le uniche
 * sezioni il cui elenco non lo scrive l'utente ma lo dichiara Home Assistant
 * col `device_class`, e una casa le porte, i sensori di movimento e le pile
 * ce li ha dal primo minuto, anche sopra una plancia vuota.
 *
 * Adesso nascono spente. Le tre cose da difendere sono tutte e tre modi di
 * rompere qualcosa che funzionava:
 *
 * La prima, ed è il motivo per cui questa regola sta nella semina e non nello
 * spegnimento: **chi ha già la plancia in uso non perde niente aggiornando.**
 * Nascere è una cosa che succede una volta, e succede alla plancia mai
 * configurata; quella di chi ha i varchi in barra da mesi non nasce.
 *
 * La seconda: **da spente si riaccendono**, altrimenti sarebbero sparite. La
 * porta è la loro scheda del Config — un contatto tolto, uno aggiunto, un
 * nome, una soglia — che è lo stesso gesto con cui si accende ogni altra
 * sezione: dirci dentro qualcosa.
 *
 * La terza: **prima che gli stati arrivino non si semina.** Appena aperta la
 * pagina la casa sembra senza porte e senza pile anche a chi ne ha cinquanta,
 * e seminare su quella risposta vorrebbe dire spegnere tre sezioni piene.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  SEZIONI_CHE_LEGGONO_LA_CASA,
  planciaGiaConfigurata,
  sceltaSullaSezione,
} from "../src/core/contenuto-delle-sezioni.js";
import {
  ensureConfiguredSectionsVisible,
  seedModernSectionVisibility,
} from "../src/sections/beta26-real-device-stability-section.js";

const magazzino = (roba) => (chiave) => (chiave in roba ? roba[chiave] : null);

/* Una casa vera, e cioè il caso che rompeva tutto: le porte, il movimento e
 * le pile ci sono, perché sono di Home Assistant e non della plancia. */
const CASA_PIENA = Object.freeze({
  "binary_sensor.porta_ingresso": { state: "off", attributes: { device_class: "door" } },
  "binary_sensor.movimento_salone": { state: "off", attributes: { device_class: "motion" } },
  "sensor.telecomando_batteria": {
    state: "84",
    attributes: { device_class: "battery", unit_of_measurement: "%" },
  },
});

function magazzinoFinto(iniziale = {}) {
  const valori = new Map(
    Object.entries(iniziale).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]),
  );
  return {
    getItem: (k) => (valori.has(k) ? valori.get(k) : null),
    setItem: (k, v) => valori.set(k, String(v)),
    removeItem: (k) => valori.delete(k),
  };
}

/** Il giro completo: un magazzino finto e una casa finta, poi si rimette tutto. */
function conPlancia(iniziale, stati, prova) {
  const primaMagazzino = globalThis.localStorage;
  const primaCasa = globalThis.__HASS__;
  globalThis.localStorage = magazzinoFinto(iniziale);
  globalThis.__HASS__ = { states: stati };
  try {
    return prova(() => JSON.parse(globalThis.localStorage.getItem("cd_sections") || "{}"));
  } finally {
    if (primaMagazzino === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = primaMagazzino;
    if (primaCasa === undefined) delete globalThis.__HASS__;
    else globalThis.__HASS__ = primaCasa;
  }
}

/* ─── La regola, da sola ─────────────────────────────────────────────────── */

test("sono tre, e sono quelle il cui elenco lo fa Home Assistant", () => {
  assert.deepEqual([...SEZIONI_CHE_LEGGONO_LA_CASA], ["varchi", "presenza", "batterie"]);
});

test("una plancia mai configurata non risulta configurata", () => {
  assert.equal(planciaGiaConfigurata(magazzino({})), false);
  /* Nemmeno per le chiavi che il magazzino si scrive da sé: `metadata` c'è
   * anche quando dentro non c'è niente. */
  assert.equal(planciaGiaConfigurata(magazzino({ cd_loads: [], cd_stanze: [] })), false);
});

test("basta una cosa qualsiasi perché la plancia risulti in uso", () => {
  /* Tre strade diverse, perché una plancia si può configurare da tre posti
   * che questa regola guarda separatamente: una sezione governata, le luci
   * della Home, una casella dell'editor. */
  assert.equal(planciaGiaConfigurata(magazzino({ cd_luci: { "light.salone": "Salone" } })), true);
  assert.equal(
    planciaGiaConfigurata(magazzino({ cd_tapparelle: [{ name: "S", entity: "cover.s" }] })),
    true,
  );
  assert.equal(
    planciaGiaConfigurata(magazzino({ cd_entity_overrides: { "dm.server_cpu": "sensor.cpu" } })),
    true,
  );
  /* E anche aver detto la propria su una delle tre: chi ha già battezzato un
   * contatto la plancia l'ha configurata, per quel poco che gli serviva. */
  assert.equal(
    planciaGiaConfigurata(magazzino({ cd_varchi: { nomi: { "binary_sensor.p": "Ingresso" } } })),
    true,
  );
});

test("dire la propria nella scheda vale come configurare la sezione", () => {
  const varchi = (dato) => sceltaSullaSezione("varchi", magazzino({ cd_varchi: dato }));
  /* I tre modi di correggere un elenco rilevato, e sono i tre che la scheda
   * offre: togliere, aggiungere, dare un nome. */
  assert.equal(varchi({ escluse: ["binary_sensor.frigo"] }), true);
  assert.equal(varchi({ aggiunte: ["binary_sensor.cantina"] }), true);
  assert.equal(varchi({ nomi: { "binary_sensor.p4b": "Cucina" } }), true);
  /* Una scheda aperta e chiusa senza toccare niente non è una scelta. */
  assert.equal(varchi({ escluse: [], aggiunte: [], nomi: {} }), false);
  assert.equal(varchi(null), false);

  const presenza = (dato) => sceltaSullaSezione("presenza", magazzino({ cd_presenza: dato }));
  assert.equal(presenza({ aggiunte: ["binary_sensor.pir_corridoio"] }), true);
  assert.equal(presenza(null), false);
});

test("le batterie si correggono dove si correggevano già", () => {
  /* Aggiunte e tolte stanno nei gruppi degli avvisi: è lì che stavano prima
   * che le batterie avessero una sezione, e un secondo elenco per la stessa
   * casa si sarebbe scollato dal primo. La soglia invece è tutta loro. */
  const batterie = (roba) => sceltaSullaSezione("batterie", magazzino(roba));
  assert.equal(batterie({ cd_gruppi_extra: { batt: ["sensor.serratura_batteria"] } }), true);
  assert.equal(batterie({ cd_gruppi_removed: { batt: ["sensor.telecomando_batteria"] } }), true);
  assert.equal(batterie({ cd_batterie: { soglia: 30 } }), true);
  /* Un gruppo che non è il loro non le riguarda. */
  assert.equal(batterie({ cd_gruppi_extra: { luci: ["light.salone"] } }), false);
  assert.equal(batterie({}), false);
});

test("di ogni altra sezione questa regola non parla", () => {
  for (const chiave of ["energy", "tapparelle", "home", "ups", "sezione-che-non-esiste"])
    assert.equal(
      sceltaSullaSezione(chiave, magazzino({ cd_varchi: { aggiunte: ["x.y"] } })),
      false,
    );
});

/* ─── La regola in funzione, sulla plancia ───────────────────────────────── */

test("la plancia appena installata fa nascere spente le tre sezioni", () =>
  /* Il difetto, per intero: magazzino vuoto, casa piena. Prima di questa
   * regola erano tre voci accese in una barra dove c'erano solo Home e
   * Configurazione. */
  conPlancia({}, CASA_PIENA, (leggi) => {
    seedModernSectionVisibility();
    const visibilita = leggi();
    for (const chiave of SEZIONI_CHE_LEGGONO_LA_CASA)
      assert.equal(visibilita[chiave], false, `"${chiave}" nasce accesa su una plancia vuota`);
  }));

test("chi ha già la plancia in uso non le perde aggiornando", () =>
  /* La stessa casa, ma una plancia che qualcuno ha configurato: le tre voci
   * c'erano ieri e ci sono oggi. È il caso che rende questa regola una semina
   * e non uno spegnimento. */
  conPlancia({ cd_luci: { "light.salone": "Salone" } }, CASA_PIENA, (leggi) => {
    seedModernSectionVisibility();
    const visibilita = leggi();
    for (const chiave of SEZIONI_CHE_LEGGONO_LA_CASA)
      assert.equal(visibilita[chiave], true, `"${chiave}" sparisce a chi ce l'aveva`);
  }));

test("in una casa che non le ha restano spente anche sulla plancia in uso", () =>
  /* La casa parla — quindi si semina — ma di altro: né porte, né movimento,
   * né pile. Non è la casa muta, che è la prova qui sotto. */
  conPlancia(
    { cd_luci: { "light.salone": "Salone" } },
    { "light.salone": { state: "on", attributes: {} } },
    (leggi) => {
      seedModernSectionVisibility();
      const visibilita = leggi();
      for (const chiave of SEZIONI_CHE_LEGGONO_LA_CASA)
        assert.equal(visibilita[chiave], false, `"${chiave}" accesa senza niente da mostrare`);
    },
  ));

test("finché gli stati non arrivano non si semina", () =>
  /* Il freno. Appena aperta la pagina la casa non ha ancora risposto, e a
   * quel punto sembra senza porte anche a chi ne ha cinquanta: seminare lì
   * vorrebbe dire spegnere tre sezioni piene a chi le aveva. Chi non sa non
   * semina, e la chiave resta da scrivere per il giro dopo. */
  conPlancia({ cd_luci: { "light.salone": "Salone" } }, {}, (leggi) => {
    seedModernSectionVisibility();
    const visibilita = leggi();
    for (const chiave of SEZIONI_CHE_LEGGONO_LA_CASA)
      assert.ok(!(chiave in visibilita), `"${chiave}" decisa prima di sapere com'è la casa`);
  }));

test("la semina non ridecide una voce già scritta", () =>
  conPlancia({ cd_sections: { varchi: true } }, CASA_PIENA, (leggi) => {
    seedModernSectionVisibility();
    assert.equal(leggi().varchi, true);
  }));

test("un contatto aggiunto nella scheda riaccende la sezione", () =>
  /* L'altro verso, e senza di lui la sezione sarebbe sparita e basta: la
   * porta per riaverla è la sua scheda del Config. */
  conPlancia(
    {
      cd_sections: { varchi: false, presenza: false, batterie: false },
      cd_varchi: { aggiunte: ["binary_sensor.cantina"] },
      cd_presenza: { nomi: { "binary_sensor.pir": "Corridoio" } },
      cd_batterie: { soglia: 30 },
    },
    CASA_PIENA,
    (leggi) => {
      ensureConfiguredSectionsVisible({ sync: false, render: false, spegni: true });
      const visibilita = leggi();
      for (const chiave of SEZIONI_CHE_LEGGONO_LA_CASA)
        assert.equal(visibilita[chiave], true, `"${chiave}" non torna dopo averla configurata`);
    },
  ));

test("lo spegnimento automatico non tocca mai le tre", () =>
  /* Per loro «vuota» non vuol dire niente: l'elenco lo fa Home Assistant, e
   * una scheda mai aperta non è una sezione svuotata. Spegnerle qui vorrebbe
   * dire toglierle a tutti quelli che non hanno mai avuto bisogno di
   * correggere il rilevamento — cioè quasi tutti. */
  conPlancia(
    { cd_sections: { varchi: true, presenza: true, batterie: true, piscina: true } },
    CASA_PIENA,
    (leggi) => {
      ensureConfiguredSectionsVisible({ sync: false, render: false, spegni: true });
      const visibilita = leggi();
      for (const chiave of SEZIONI_CHE_LEGGONO_LA_CASA)
        assert.equal(
          visibilita[chiave],
          true,
          `"${chiave}" spenta da una regola che non la governa`,
        );
      assert.equal(visibilita.piscina, false, "la regola di prima deve funzionare ancora");
    },
  ));

test("una scelta fatta a mano vale più della semina", () =>
  /* Chi ha premuto la fascia verde ha detto la sua: la semina non la
   * ridiscute, perché la voce c'è già scritta. */
  conPlancia(
    { cd_sections: { varchi: false }, cd_sections_manual: { varchi: true } },
    CASA_PIENA,
    (leggi) => {
      seedModernSectionVisibility();
      assert.equal(leggi().varchi, false, "la semina ha riscritto una voce già decisa");
    },
  ));

test("e le tre sezioni guardano davvero la voce che la semina scrive", () => {
  /* La semina scrive in `cd_sections`; se una delle tre leggesse un'altra
   * chiave — o la leggesse col nome sbagliato — nascerebbe spenta nella
   * configurazione e accesa sullo schermo, che e' il difetto di partenza
   * travestito. Sono tre righe uguali, ed e' apposta: la stessa forma degli
   * altri nove che si governano da se'. */
  for (const [sezione, file] of [
    ["varchi", "varchi-section.js"],
    ["presenza", "presenza-section.js"],
    ["batterie", "batterie-section.js"],
  ]) {
    const sorgente = readFileSync(new URL(`../src/sections/${file}`, import.meta.url), "utf8");
    const tab = sorgente.match(/export const ([A-Z]+_TAB) = "([a-z]+)";/);
    assert.ok(tab, `${file} non dichiara la sua voce nella barra`);
    assert.equal(tab[2], sezione, `${file} governa "${tab[2]}" invece di "${sezione}"`);
    assert.match(sorgente, /const sezioni = readJson\("cd_sections", \{\}\);/);
    assert.ok(
      sorgente.includes(`sezioni[${tab[1]}] === false`),
      `${file} non spegne la sua voce quando la semina scrive false`,
    );
  }
});
