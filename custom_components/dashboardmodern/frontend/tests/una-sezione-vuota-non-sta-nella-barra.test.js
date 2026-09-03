/* «tutte le sezioni devono nascere come nascoste, solo se si inserisce entita'
 * in una sezione diventa visibile.»
 *
 * Meta' della regola c'era: alla prima accensione il guscio deriva le voci dal
 * contenuto, e salvare in una scheda riaccende quella sezione. Mancava
 * l'altra meta', perche' la derivazione corre una volta sola per chiave: una
 * sezione svuotata — o accesa da una versione che accendeva tutto — restava
 * nella barra per sempre, pagina vuota compresa.
 *
 * Il pericolo di questa regola non e' lasciare in barra una sezione vuota:
 * quella si vede e si toglie. E' spegnere una sezione PIENA perche' il suo
 * contenuto sta in una chiave che l'elenco non conosce — e la persona si
 * ritrova sparita una pagina che aveva configurato. La prima prova qui sotto
 * e' quella: riga per riga della mappa, una configurazione fatta di quella
 * chiave sola deve tenere accesa la sua sezione.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MAGAZZINO_DELLE_SEZIONI,
  contenutoDelleSezioni,
  giudizio,
  sezioniGovernate,
} from "../src/core/contenuto-delle-sezioni.js";
import {
  ensureConfiguredSectionsVisible,
  seedModernSectionVisibility,
} from "../src/sections/beta26-real-device-stability-section.js";

/** Un magazzino finto: si passa quello che c'è dentro, il resto non esiste. */
const magazzino = (roba) => (chiave) => (chiave in roba ? roba[chiave] : null);

/* Come si riempie ogni chiave, per la prova che nessuna sezione piena si
 * spegne. Una entità dentro, nella forma che quella chiave usa davvero. */
const ESEMPI = {
  cd_loads: [{ name: "Forno", entity: "sensor.forno" }],
  cd_energy_model: { grid: "sensor.rete" },
  cd_flow_nodes: { solare: { pwr: "sensor.fv" } },
  cd_subloads_extra: { forno: { entity: "sensor.forno" } },
  cd_subload_groups: [{ id: "cucina", entity: "sensor.cucina" }],
  cd_gruppi_extra: [{ id: "extra", entity: "sensor.extra" }],
  cd_report_devices: [{ entity: "sensor.report" }],
  cd_appliances: [{ name: "Lavatrice", entity: "sensor.lav" }],
  cd_lavatrice_programmi: [{ name: "Cotone", entity: "script.cotone" }],
  cd_ev_cars: [{ name: "Auto", soc: "sensor.soc" }],
  cd_ev_visual: { image: "sensor.foto" },
  cd_ev_meta: { plate: "sensor.targa" },
  cd_ev_image: "data:image/png;base64,AAAA",
  cd_caldaia: { temperatura: "sensor.caldaia" },
  cd_scaldabagni: [{ name: "Boiler", entity: "water_heater.b" }],
  cd_impianti_termici: [{ name: "Pompa", entity: "climate.pompa" }],
  cd_cameras: [{ name: "Ingresso", entity: "camera.ingresso" }],
  cd_security_doors: [{ name: "Porta", entity: "binary_sensor.porta" }],
  cd_clima_units: [{ entity: "climate.salone" }],
  cd_termico_caldo: [{ name: "Caldaia", entity: "climate.caldaia" }],
  cd_tapparelle: [{ name: "Salone", entity: "cover.salone" }],
  cd_piscina: { tempEnt: "sensor.acqua" },
  cd_irrigazione: { zones: [{ entity: "switch.zona1" }] },
  cd_stanze_entita: { salone: ["sensor.uno"] },
  cd_luci: { "light.salone": "Salone" },
  cd_prese: [{ name: "TV", entity: "switch.tv" }],
  cd_robot: [{ name: "Rosie", entity: "vacuum.rosie" }],
};

test("una sezione piena non si spegne, qualunque chiave la riempia", () => {
  for (const [sezione, regola] of Object.entries(MAGAZZINO_DELLE_SEZIONI)) {
    for (const chiave of [...regola.chiavi, ...(regola.testi || [])]) {
      const esempio = ESEMPI[chiave];
      assert.ok(
        esempio !== undefined,
        `${chiave} è nella mappa di ${sezione} ma questa prova non sa come riempirla`,
      );
      const { piene } = contenutoDelleSezioni(magazzino({ [chiave]: esempio }));
      assert.ok(
        piene.has(sezione),
        `configurando solo ${chiave} la sezione "${sezione}" risulta vuota: verrebbe nascosta a chi l'ha configurata`,
      );
    }
  }
});

test("le due sezioni senza chiave propria si riempiono dalle caselle dell'editor", () => {
  /* Il MiniPC non ha una chiave sua: si configura solo dalle caselle. E
   * Temperature vive delle stanze che misurano. */
  const conMiniPc = contenutoDelleSezioni(
    magazzino({ cd_entity_overrides: { "dm.server_cpu": "sensor.cpu" } }),
  );
  assert.ok(conMiniPc.piene.has("server"), "il MiniPC configurato risulterebbe vuoto");

  const conTemp = contenutoDelleSezioni(
    magazzino({ cd_stanze: [{ name: "Salone", temp: "sensor.t" }] }),
  );
  assert.ok(conTemp.piene.has("temp"), "una stanza che misura non accende Temperature");
  assert.ok(conTemp.piene.has("stanze"), "una stanza non accende le Stanze");
});

test("le caselle dell'editor accendono la sezione a cui appartengono", () => {
  /* Il vecchio giudizio smistava le caselle a naso, cercando parole nel loro
   * nome: la temperatura della batteria dell'inverter, quella della CPU e
   * quella della lavatrice finivano tutte e tre in Temperature. Finché serviva
   * solo ad accendere si vedeva poco; adesso che una sezione vuota si spegne,
   * sbagliare sezione vuol dire spegnere quella giusta. */
  const dove = (casella) => {
    const { piene } = contenutoDelleSezioni(
      magazzino({ cd_entity_overrides: { [casella]: "sensor.x" } }),
    );
    return [...piene];
  };
  assert.deepEqual(dove("dm.energy_temperatura_batteria"), ["energy"]);
  assert.deepEqual(dove("dm.server_temperatura_cpu"), ["server"]);
  assert.deepEqual(dove("dm.lavatrice_temperatura"), ["appliances"]);
  assert.deepEqual(dove("dm.boiler_sonda_temperatura_1"), ["boiler"]);
  /* Il meteo della Home non ha una pagina fra quelle governate: nessuna si
   * accende, e soprattutto nessuna si spegne per colpa sua. */
  assert.deepEqual(dove("dm.home_meteo_temperatura"), []);
});

test("una stanza di solo nome accende le Stanze e non Temperature", () => {
  /* Una stanza può vivere di nome e icona: è una riga della pagina Stanze, ma
   * non ha niente da dire alla pagina Temperature. */
  const { piene } = contenutoDelleSezioni(magazzino({ cd_stanze: [{ name: "Ripostiglio" }] }));
  assert.ok(piene.has("stanze"));
  assert.ok(!piene.has("temp"));
});

test("su una plancia appena installata sono vuote tutte", () => {
  const { piene, vuote } = contenutoDelleSezioni(magazzino({}));
  assert.equal(piene.size, 0);
  assert.deepEqual([...vuote].sort(), sezioniGovernate().sort());
});

test("le sezioni che si governano da sé non stanno in questa mappa", () => {
  /* Agenda, Continuità, Cruscotto e le sezioni che si fa l'utente nascondono
   * già da sole la propria voce quando non hanno niente dentro. Metterle anche
   * qui vorrebbe dire due padroni sulla stessa voce. E Home è la pagina dove
   * si atterra: spegnerla lascerebbe una plancia senza nessun posto dove
   * arrivare. */
  for (const chiave of ["home", "calendario", "ups", "mie", "cruscotto", "config"])
    assert.equal(
      giudizio(chiave, magazzino({})),
      null,
      `"${chiave}" non deve essere governata da questa regola`,
    );
});

test("una chiave sconosciuta non si spegne: chi non sa non tocca", () => {
  assert.equal(giudizio("sezione-che-non-esiste", magazzino({})), null);
});

/* ─── La regola in funzione, sul magazzino vero ──────────────────────────── */

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

function conMagazzino(iniziale, prova) {
  const prima = globalThis.localStorage;
  globalThis.localStorage = magazzinoFinto(iniziale);
  try {
    return prova(() => JSON.parse(globalThis.localStorage.getItem("cd_sections") || "{}"));
  } finally {
    if (prima === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prima;
  }
}

test("la sezione svuotata esce dalla barra", () =>
  conMagazzino(
    {
      /* Una casa vera: le tapparelle ci sono, la piscina è stata tolta ma la
       * sua voce era rimasta accesa da quando c'era. */
      cd_sections: { tapparelle: true, piscina: true, ev: true },
      cd_tapparelle: [{ name: "Salone", entity: "cover.salone" }],
    },
    (leggi) => {
      assert.equal(ensureConfiguredSectionsVisible({ sync: false, render: false }), true);
      const visibilita = leggi();
      assert.equal(visibilita.tapparelle, true, "le tapparelle configurate devono restare");
      assert.equal(visibilita.piscina, false, "la piscina svuotata deve sparire");
      assert.equal(visibilita.ev, false, "l'auto mai configurata deve sparire");
    },
  ));

test("su un magazzino non ancora arrivato non si spegne niente", () => {
  /* Il freno che conta. La configurazione condivisa arriva da Home Assistant
   * qualche istante dopo l'avvio: prima che arrivi ogni sezione sembra vuota,
   * e spegnerle vorrebbe dire scrivere «tutto nascosto» nella configurazione
   * di tutti i dispositivi della casa. */
  conMagazzino({ cd_sections: { energy: true, temp: true, security: true } }, (leggi) => {
    ensureConfiguredSectionsVisible({ sync: false, render: false });
    const visibilita = leggi();
    assert.equal(visibilita.energy, true);
    assert.equal(visibilita.temp, true);
    assert.equal(visibilita.security, true);
  });
});

test("una sezione accesa a mano resta accesa anche se è vuota", () =>
  conMagazzino(
    {
      cd_sections: { piscina: true, tapparelle: true },
      cd_sections_manual: { piscina: true },
      cd_tapparelle: [{ name: "Salone", entity: "cover.salone" }],
    },
    (leggi) => {
      ensureConfiguredSectionsVisible({ sync: false, render: false });
      assert.equal(leggi().piscina, true, "una scelta fatta a mano non si tocca");
    },
  ));

test("la sezione appena salvata non si spegne nello stesso giro", () => {
  /* Salvare è esprimersi: la scheda può aver scritto in un posto che questa
   * regola legge un istante dopo, e spegnerla subito dopo il salvataggio
   * sarebbe la sezione che sparisce mentre la si configura. */
  conMagazzino(
    {
      cd_sections: { piscina: true, tapparelle: true },
      cd_tapparelle: [{ name: "Salone", entity: "cover.salone" }],
    },
    (leggi) => {
      ensureConfiguredSectionsVisible({ sync: false, render: false, espressa: "piscina" });
      assert.equal(leggi().piscina, true);
    },
  );
});

test("la semina fa nascere spente tutte le sezioni governate", () =>
  conMagazzino({}, (leggi) => {
    seedModernSectionVisibility();
    const visibilita = leggi();
    for (const chiave of sezioniGovernate())
      assert.equal(visibilita[chiave], false, `"${chiave}" non nasce nascosta`);
  }));

test("la semina non ridecide una voce già scritta", () =>
  conMagazzino({ cd_sections: { piscina: true } }, (leggi) => {
    seedModernSectionVisibility();
    assert.equal(leggi().piscina, true);
  }));
