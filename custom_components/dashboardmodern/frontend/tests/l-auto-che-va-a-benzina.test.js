/* L'auto che va a benzina (#208).
 *
 * «Ho la mia auto che ha i sensori di livello carburante, odometro, autonomia
 * e portiere: e' possibile scegliere a monte se visualizzare un'auto elettrica
 * o classica con i sensori disponibili?» E dal campo: «anche lo stato dei
 * finestrini e la pressione dei pneumatici».
 *
 * Queste prove tengono fermi i dialetti — «Spento» e «off», «locked» e
 * «bloccato», l'allarme che e' «in esecuzione» — la lettura che non inventa
 * uno zero dove una casella non c'e', e la strada per cui le caselle nuove
 * entrano nella scheda e il quadro prende il posto della ricarica.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CASELLE_TERMICHE,
  RIFERIMENTI_TERMICI,
  accesoDalloStato,
  allarmeDalloStato,
  aperturaDalloStato,
  letturaTermica,
  pneumaticiDalloStato,
  serraturaDalloStato,
} from "../src/core/auto-termica.js";
import { TIPI_MOTORE, normalizeVehicle, siRicarica, tipoMotore, vaACarburante } from "../src/core/vehicle-model.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");
const stato = (state, attributes = {}) => ({ state, attributes });

test("il tipo di motore: elettrica e' il silenzio, termica e ibrida hanno un nome", () => {
  assert.deepEqual([...TIPI_MOTORE], ["elettrica", "termica", "ibrida"]);
  assert.equal(tipoMotore("termica"), "termica");
  assert.equal(tipoMotore(" Ibrida "), "ibrida");
  assert.equal(tipoMotore("elettrica"), "");
  assert.equal(tipoMotore(undefined), "");
  assert.equal(tipoMotore("diesel"), "");
  assert.equal(vaACarburante({ tipo: "termica" }), true);
  assert.equal(vaACarburante({ tipo: "ibrida" }), true);
  assert.equal(vaACarburante({}), false);
  assert.equal(siRicarica({ tipo: "termica" }), false);
  assert.equal(siRicarica({ tipo: "ibrida" }), true);
  assert.equal(siRicarica({}), true);
});

test("il profilo salva il motore, e chi arriva da prima resta elettrico", () => {
  const termica = normalizeVehicle({ name: "Panda", tipo: "termica" });
  assert.equal(termica.tipo, "termica");
  const vecchia = normalizeVehicle({ name: "Tesla" });
  assert.equal(vecchia.tipo, "");
  const sporca = normalizeVehicle({ name: "X", tipo: "boh" });
  assert.equal(sporca.tipo, "");
});

test("le caselle termiche sono dm.ev_* e ognuna sa che tipo di lettura e'", () => {
  assert.ok(CASELLE_TERMICHE.length >= 11);
  for (const voce of CASELLE_TERMICHE) {
    assert.match(voce.ref, /^dm\.ev_/);
    assert.ok(voce.campo && voce.tipo && voce.glifo);
  }
  assert.deepEqual(
    RIFERIMENTI_TERMICI,
    CASELLE_TERMICHE.map((v) => v.ref),
  );
  for (const ref of [
    "dm.ev_carburante",
    "dm.ev_motore",
    "dm.ev_portiere",
    "dm.ev_finestrini",
    "dm.ev_allarme",
    "dm.ev_batteria_servizio",
    "dm.ev_temperatura_olio",
    "dm.ev_temperatura_esterna",
    "dm.ev_ultimo_viaggio",
    "dm.ev_carburante_totale",
    "dm.ev_pneumatici",
  ])
    assert.ok(RIFERIMENTI_TERMICI.includes(ref), ref);
});

test("i dialetti: acceso e spento, comunque lo dica l'integrazione", () => {
  for (const voce of ["on", "running", "Acceso", "true", "1", "started"]) assert.equal(accesoDalloStato(voce), true, voce);
  for (const voce of ["off", "Spento", "stopped", "false", "0", "parked"]) assert.equal(accesoDalloStato(voce), false, voce);
  assert.equal(accesoDalloStato(""), null);
  assert.equal(accesoDalloStato("unknown"), null);
});

test("i dialetti: le portiere, i finestrini, l'allarme", () => {
  assert.equal(serraturaDalloStato("locked"), "bloccate");
  assert.equal(serraturaDalloStato("Bloccato"), "bloccate");
  assert.equal(serraturaDalloStato("unlocked"), "sbloccate");
  assert.equal(serraturaDalloStato("open"), "aperte");
  assert.equal(serraturaDalloStato("closed"), "chiuse");
  assert.equal(serraturaDalloStato("boh"), null);

  assert.equal(aperturaDalloStato("on"), "aperti");
  assert.equal(aperturaDalloStato("Aperti"), "aperti");
  assert.equal(aperturaDalloStato("closed"), "chiusi");
  assert.equal(aperturaDalloStato("off"), "chiusi");
  assert.equal(aperturaDalloStato(""), null);

  /* «In esecuzione» e' come Stellantis scrive un allarme inserito. */
  assert.equal(allarmeDalloStato("In esecuzione"), "inserito");
  assert.equal(allarmeDalloStato("armed_away"), "inserito");
  assert.equal(allarmeDalloStato("triggered"), "scattato");
  assert.equal(allarmeDalloStato("disarmed"), "disinserito");
  assert.equal(allarmeDalloStato("off"), "disinserito");
  assert.equal(allarmeDalloStato("?"), null);
});

test("i pneumatici: una pressione con l'unita', oppure un avviso", () => {
  assert.deepEqual(pneumaticiDalloStato("2.4", "bar"), { pressione: 2.4, unita: "bar", avviso: null });
  assert.deepEqual(pneumaticiDalloStato("33", "psi"), { pressione: 33, unita: "psi", avviso: null });
  assert.equal(pneumaticiDalloStato("2.2").unita, "bar");
  assert.deepEqual(pneumaticiDalloStato("on"), { pressione: null, unita: "", avviso: true });
  assert.deepEqual(pneumaticiDalloStato("ok"), { pressione: null, unita: "", avviso: false });
  assert.equal(pneumaticiDalloStato(""), null);
});

test("la lettura: quello che c'e' si legge, quello che manca resta null", () => {
  const mappa = {
    "dm.ev_carburante": "sensor.panda_fuel",
    "dm.ev_motore": "binary_sensor.panda_engine",
    "dm.ev_portiere": "lock.panda_doors",
    "dm.ev_finestrini": "binary_sensor.panda_windows",
    "dm.ev_allarme": "sensor.panda_alarm",
    "dm.ev_autonomia": "sensor.panda_range",
    "dm.ev_odometro": "sensor.panda_odometer",
    "dm.ev_pneumatici": "sensor.panda_tyres",
    "dm.ev_temperatura_olio": "sensor.panda_oil",
  };
  const states = {
    "sensor.panda_fuel": stato("62.4", { unit_of_measurement: "%" }),
    "binary_sensor.panda_engine": stato("off"),
    "lock.panda_doors": stato("locked"),
    "binary_sensor.panda_windows": stato("off"),
    "sensor.panda_alarm": stato("In esecuzione"),
    "sensor.panda_range": stato("412", { unit_of_measurement: "km" }),
    "sensor.panda_odometer": stato("120345", { unit_of_measurement: "km" }),
    "sensor.panda_tyres": stato("2.3", { unit_of_measurement: "bar" }),
    "sensor.panda_oil": stato("unavailable", { unit_of_measurement: "°C" }),
  };
  const lettura = letturaTermica(mappa, states);
  assert.equal(lettura.carburante, 62.4);
  assert.equal(lettura.motore, false);
  assert.equal(lettura.portiere, "bloccate");
  assert.equal(lettura.finestrini, "chiusi");
  assert.equal(lettura.allarme, "inserito");
  assert.equal(lettura.autonomia, 412);
  assert.equal(lettura.odometro, 120345);
  assert.equal(lettura.odometroUnita, "km");
  assert.deepEqual(lettura.pneumatici, { pressione: 2.3, unita: "bar", avviso: null });
  /* L'olio e' mappato ma muto: la casella c'e', il valore no. */
  assert.equal(lettura.olio, null);
  assert.equal(lettura.caselle.olio.muto, true);
  /* Le caselle non mappate non compaiono: non sono uno zero. */
  assert.equal("esterna" in lettura.caselle, false);
  assert.equal(lettura.esterna, undefined);
  assert.equal(lettura.attenzione, false);
  assert.equal(lettura.qualcosa, true);
});

test("la lettura chiede attenzione: riserva, portiere aperte a motore spento, allarme, gomme", () => {
  const base = (extra, states) =>
    letturaTermica({ "dm.ev_carburante": "sensor.fuel", ...extra }, { "sensor.fuel": stato("55"), ...states });
  assert.equal(base({}, {}).attenzione, false);
  assert.equal(letturaTermica({ "dm.ev_carburante": "sensor.fuel" }, { "sensor.fuel": stato("8") }).attenzione, true);
  assert.equal(
    base(
      { "dm.ev_portiere": "sensor.doors", "dm.ev_motore": "sensor.engine" },
      { "sensor.doors": stato("open"), "sensor.engine": stato("off") },
    ).attenzione,
    true,
  );
  assert.equal(
    base(
      { "dm.ev_portiere": "sensor.doors", "dm.ev_motore": "sensor.engine" },
      { "sensor.doors": stato("open"), "sensor.engine": stato("on") },
    ).attenzione,
    false,
  );
  assert.equal(base({ "dm.ev_allarme": "sensor.alarm" }, { "sensor.alarm": stato("triggered") }).attenzione, true);
  assert.equal(base({ "dm.ev_pneumatici": "binary_sensor.tpms" }, { "binary_sensor.tpms": stato("on") }).attenzione, true);
});

test("la lettura senza mappa ripiega su chi risolve le chiavi globali, e non sbaglia mai", () => {
  const resolve = (ref) => (ref === "dm.ev_carburante" ? "sensor.fuel" : ref);
  const lettura = letturaTermica({}, { "sensor.fuel": stato("40") }, resolve);
  assert.equal(lettura.carburante, 40);
  assert.equal(lettura.qualcosa, true);
  const vuota = letturaTermica({}, {}, () => {
    throw new Error("no");
  });
  assert.equal(vuota.qualcosa, false);
  assert.equal(vuota.attenzione, false);
  assert.equal(letturaTermica(null, null).qualcosa, false);
});

test("la scheda dell'auto: la tendina del motore sotto il nome, salvata con il profilo", async () => {
  const sezione = await leggi("sections/auto-termica-section.js");
  assert.match(sezione, /data-ev-tipo/);
  assert.match(sezione, /getElementById\?\.\("ed-evcar-name"\)/);
  /* Le caselle entrano nell'elenco del guscio: la stessa strada delle altre. */
  assert.match(sezione, /lexicalGlobal\("CD_SLOTS"\)/);
  assert.match(sezione, /lexicalGlobal\("CD_SLOT_REFS"\)/);
  assert.match(sezione, /slot\?\.ref === "dm\.ev_batteria_auto"/);
  /* Con un motore termico la ricarica non si disegna. */
  assert.match(sezione, /#page-ev\[data-dm-motore="termica"\] \.lm-batt-section/);
  assert.match(sezione, /#page-ev\[data-dm-motore="termica"\] #lm-charge-badge\{display:none!important\}/);
  /* Il quadro apre lo storico come le altre misure della pagina. */
  assert.match(sezione, /root\.apriStorico\?\./);

  const ev = await leggi("sections/ev-section.js");
  assert.match(ev, /select\[data-ev-tipo\]/);
  assert.match(ev, /tipo: tipoMotore\(tendinaMotore\.value\)/);
  assert.equal((ev.match(/\.\.\.motore,/g) || []).length, 2, "la bozza e la matita salvano tutte e due il motore");
  /* La tessera dell'auto legge il carburante quando non c'e' una batteria. */
  assert.match(ev, /overrides\["dm\.ev_carburante"\]/);
});

test("la tessera in Home: senza batteria il livello e' il carburante, e lo dice", async () => {
  const home = await leggi("sections/home-widgets-section.js");
  /* Tre letture: per la vettura profilata il serbatoio si legge PRIMA della
   * batteria quando il motore e' dichiarato termico, e dopo altrimenti; per
   * l'auto in uso senza profilo, solo dopo. */
  assert.equal((home.match(/misura\("dm\.ev_carburante"\)/g) || []).length, 3);
  assert.match(home, /const aBenzina = clean\(auto\?\.tipo\) === "termica";/);
  assert.equal((home.match(/carburante: Boolean\(serbatoio\),/g) || []).length, 2);
  assert.match(home, /lettura\.carburante \? "⛽" : "🔋"/);
});

test("il modulo e' installato dal runtime, dopo il vestito della pagina Auto", async () => {
  const runtime = await leggi("sections/section-runtime.js");
  assert.match(runtime, /import \{ installAutoTermica \} from "\.\/auto-termica-section\.js";/);
  const vestito = runtime.indexOf("installEvShowcaseSection();");
  const termica = runtime.indexOf("installAutoTermica();");
  assert.ok(vestito > 0 && termica > vestito);
  assert.match(runtime, /"auto-termica",/);
});

/* ── il bagagliaio, il cofano e dove sta l'auto (#326) ─────────────────── */

test("il bagagliaio e il cofano sono aperture come i finestrini", () => {
  const lettura = letturaTermica(
    { "dm.ev_bagagliaio": "binary_sensor.tucson_boot", "dm.ev_cofano": "binary_sensor.tucson_hood" },
    {
      "binary_sensor.tucson_boot": { state: "on" },
      "binary_sensor.tucson_hood": { state: "off" },
    },
  );
  /* «Allo stesso modo delle portiere e' possibile inserire un binary_sensor
   * per il Bagagliaio e per il Cofano motore (chiuso/aperto)?» Sono aperture,
   * e leggono il dialetto delle aperture: `on` e' aperto. */
  assert.equal(lettura.bagagliaio, "aperti");
  assert.equal(lettura.cofano, "chiusi");
  assert.equal(lettura.qualcosa, true);
});

test("la posizione dell'auto e' una parola, e le parole di Home Assistant si traducono", () => {
  const dove = (stato) =>
    letturaTermica(
      { "dm.ev_posizione": "device_tracker.tucson" },
      { "device_tracker.tucson": { state: stato } },
    ).posizione;
  /* `home` e `not_home` sono parole di Home Assistant, non italiano. */
  assert.equal(dove("home"), "casa");
  assert.equal(dove("not_home"), "fuori");
  /* Il nome di una zona lo ha scritto qualcuno: si lascia com'e'. */
  assert.equal(dove("Lavoro"), "Lavoro");
  /* Uno stato che non dice niente non diventa la parola «sconosciuto»: resta
   * vuoto, e la pillola non si disegna. Il guscio i suoi «muti» li scarta gia'
   * per conto suo — qui conta che dopo non resti niente da scrivere, non con
   * quale sfumatura di niente. */
  for (const muto of ["", "unknown", "unavailable", "none"])
    assert.ok(!dove(muto), `«${muto}» non deve diventare una parola sulla card`);
});

test("le tre caselle nuove entrano nella scheda dell'auto, con la loro etichetta", async () => {
  const sezione = await leggi("sections/auto-termica-section.js");
  assert.match(sezione, /case "dm\.ev_bagagliaio":/);
  assert.match(sezione, /case "dm\.ev_cofano":/);
  assert.match(sezione, /case "dm\.ev_posizione":/);
  /* L'etichetta dice che entita' ci va: chi configura non deve indovinare. */
  assert.match(sezione, /device_tracker/);
  /* E i riferimenti sono quelli che il guscio conosce. */
  assert.ok(RIFERIMENTI_TERMICI.includes("dm.ev_bagagliaio"));
  assert.ok(RIFERIMENTI_TERMICI.includes("dm.ev_cofano"));
  assert.ok(RIFERIMENTI_TERMICI.includes("dm.ev_posizione"));
});

test("la linguetta della configurazione si chiama «Auto», non «EV» (#326)", async () => {
  const sezione = await leggi("sections/auto-termica-section.js");
  /* «Nel menu di configurazione l'etichetta dell'auto e' piu' corretto che sia
   * "Auto" e non "EV"»: da quella scheda passano anche le auto a benzina. */
  assert.match(sezione, /rinominaLaLinguettaDellAuto/);
  assert.match(sezione, /\.ed-tab\[data-tab="sez2"\] \.dm-beta4-tab-label/);
  /* La linguetta intera si riscrive solo dove la parola non ha una casella
   * sua, o si porterebbe via il disegno. */
  assert.match(sezione, /\.ed-tab\[data-tab="sez2"\]:not\(:has\(\.dm-beta4-tab-label\)\)/);
});
