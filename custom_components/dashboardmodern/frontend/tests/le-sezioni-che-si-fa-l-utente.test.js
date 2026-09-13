/* «Dare la possibilità di creare sezioni custom, dove poter inserire le proprie
 * entità a piacimento. Per esempio con questa feature avrei potuto inserire le
 * entità dell'UPS senza necessariamente attendere lo sviluppo della sezione
 * apposita» (#262).
 *
 * Qui si prova la parte pura — cosa e' una sezione, cosa se ne legge — e le
 * due cose che una pagina nuova nella barra deve rispettare in questa
 * plancia: si deve poter spegnere, e la sua configurazione deve viaggiare.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  FORMATI_SEZIONE,
  MASSIMO_SEZIONI,
  chiaveDellaSezione,
  contoDellaSezione,
  entitaDelleSezioni,
  lettureDellaSezione,
  formatoDellaSezione,
  normalizzaSezioni,
  sezioniDaMostrare,
} from "../src/core/sezioni-mie.js";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

/* Il caso della segnalazione, scritto come lo scriverebbe l'editor. */
const UPS = {
  id: "ups",
  titolo: "Gruppo di continuità",
  icona: "🔌",
  voci: [
    { nome: "Stato", entity: "sensor.ups_stato", icona: "🔋" },
    { nome: "Carica", entity: "sensor.ups_carica" },
    { nome: "Bypass", entity: "switch.ups_bypass" },
  ],
};

test("una sezione appena creata sopravvive alla normalizzazione", () => {
  /* E' il primo momento di ogni sezione: senza titolo, senza entita'. Buttarla
   * via mentre la si compila sarebbe il modo piu' rapido di rendere la
   * funzione inservibile. */
  const [nuova] = normalizzaSezioni([{}]);
  assert.equal(nuova.voci.length, 0);
  assert.equal(nuova.titolo, "");
  assert.equal(nuova.icona, "⭐");
  assert.equal(nuova.mostra, true);
  assert.ok(nuova.id, "una sezione senza id ne prende uno");
  /* Ma nella barra non ci va: portare a una pagina vuota e' peggio che non
   * offrirla. */
  assert.deepEqual(sezioniDaMostrare([{}]), []);
});

test("le righe senza entità non passano, quelle buone restano", () => {
  const [sezione] = normalizzaSezioni([
    { ...UPS, voci: [...UPS.voci, { nome: "Senza", entity: "" }, { nome: "Storta", entity: "nondominio" }] },
  ]);
  assert.deepEqual(
    sezione.voci.map((voce) => voce.entity),
    ["sensor.ups_stato", "sensor.ups_carica", "switch.ups_bypass"],
  );
});

test("la barra non è infinita: oltre otto sezioni non si va", () => {
  const troppe = Array.from({ length: MASSIMO_SEZIONI + 4 }, (_, i) => ({
    id: `s${i}`,
    voci: [{ entity: "sensor.x" }],
  }));
  assert.equal(normalizzaSezioni(troppe).length, MASSIMO_SEZIONI);
});

test("chi non vuole una sezione nella barra la tiene fuori, senza cancellarla", () => {
  const config = [{ ...UPS, mostra: false }];
  assert.equal(normalizzaSezioni(config).length, 1, "resta configurata");
  assert.deepEqual(sezioniDaMostrare(config), [], "ma fuori dalla barra");
});

test("le letture dicono come sta ogni riga, e chi si può toccare", () => {
  const states = {
    "sensor.ups_stato": { state: "OL" },
    "sensor.ups_carica": { state: "97", attributes: { unit_of_measurement: "%" } },
    "switch.ups_bypass": { state: "on", attributes: { friendly_name: "Bypass automatico" } },
  };
  const [sezione] = normalizzaSezioni([UPS]);
  const letture = lettureDellaSezione(sezione, states);

  /* Un numero con la sua unita' esce come numero; una sigla resta una sigla. */
  assert.equal(letture[0].numero, null);
  assert.equal(letture[0].stato, "OL");
  assert.equal(letture[1].numero, 97);
  assert.equal(letture[1].unita, "%");

  /* Chiamare `toggle` su un sensore non fa niente, e un interruttore che non fa
   * niente e' peggio di nessun interruttore. */
  assert.equal(letture[0].comandabile, false);
  assert.equal(letture[2].comandabile, true);
  assert.equal(letture[2].acceso, true);

  const conto = contoDellaSezione(letture);
  assert.deepEqual(conto, { quante: 3, vive: 3, accese: 1, mute: 0 });
});

test("un'entità che non risponde si vede che non risponde, e non conta", () => {
  const [sezione] = normalizzaSezioni([UPS]);
  const letture = lettureDellaSezione(sezione, { "sensor.ups_stato": { state: "unavailable" } });
  assert.equal(letture[0].muto, true);
  assert.equal(letture[0].acceso, false);
  /* Le altre due non stanno proprio negli stati: mute anche loro. */
  assert.deepEqual(contoDellaSezione(letture), { quante: 3, vive: 0, accese: 0, mute: 3 });
});

test("il nome scritto vince, poi quello di Home Assistant, poi l'entità nuda", () => {
  const [sezione] = normalizzaSezioni([
    { id: "x", voci: [{ entity: "sensor.uno", nome: "Il mio" }, { entity: "sensor.due" }, { entity: "sensor.tre" }] },
  ]);
  const letture = lettureDellaSezione(sezione, {
    "sensor.due": { state: "1", attributes: { friendly_name: "Quello di HA" } },
  });
  assert.deepEqual(
    letture.map((riga) => riga.nome),
    ["Il mio", "Quello di HA", "sensor.tre"],
  );
});

test("le entità di tutte le sezioni, senza doppioni", () => {
  const config = [UPS, { id: "b", voci: [{ entity: "sensor.ups_stato" }, { entity: "sensor.orto" }] }];
  assert.deepEqual(entitaDelleSezioni(config), [
    "sensor.ups_stato",
    "sensor.ups_carica",
    "switch.ups_bypass",
    "sensor.orto",
  ]);
});

test("la voce di ogni sezione ha la sua chiave, e la chiave è sua", () => {
  assert.equal(chiaveDellaSezione("ups"), "mia-ups");
  assert.notEqual(chiaveDellaSezione("ups"), "ups", "non deve pestare i piedi all'UPS");
});

test("la pagina si spegne con la stessa chiave che la fascia scrive", () => {
  /* Il difetto da cui nasce la prova sorella (#l'Agenda e l'UPS): una
   * voce nella barra e nessun posto dove spegnerla. */
  const pagina = leggi("sections/sezioni-mie-section.js");
  assert.match(pagina, /SEZIONI_MIE_TAB = "mie"/);
  assert.match(pagina, /readJson\("cd_sections"/);
  const editor = leggi("sections/sezioni-mie-editor-section.js");
  assert.match(editor, /cdSecToggleHtml\?\.\(CHIAVE_SEZIONE\)/);
});

test("la configurazione viaggia, come tutte le altre", () => {
  /* Le sezioni le disegna l'utente: non viaggiare vorrebbe dire rifarle su
   * ogni dispositivo. */
  const persistenza = leggi("core/chiavi-di-configurazione.js");
  assert.match(persistenza, /"cd_sezioni_mie"/);
});

test("l'intestazione la disegna chi disegna tutte le altre", () => {
  /* Una pagina senza intestazione sarebbe l'unica senza — cioè l'unica che si
   * vede come una pagina di serie B. */
  const pagina = leggi("sections/sezioni-mie-section.js");
  assert.match(pagina, /registraPaginaARuntime\(/);
  const masthead = leggi("sections/page-masthead-section.js");
  assert.match(masthead, /export function registraPaginaARuntime/);
});

/* ── il formato delle voci (#515) ──────────────────────────────────────── */

test("una sezione senza formato scritto sta a righe, come è sempre stata", () => {
  /* «Si potrebbe poter scegliere il tipo di scheda? Magari averle più piccole»
   * (#515). Chi non sceglie niente non deve accorgersi di niente: tutte le
   * sezioni che esistono oggi non hanno il campo, e devono restare com'erano. */
  assert.equal(normalizzaSezioni([UPS])[0].formato, "righe");
  assert.equal(formatoDellaSezione(""), "righe");
  assert.equal(formatoDellaSezione("gigante"), "righe");
  assert.equal(formatoDellaSezione(undefined), "righe");
});

test("il formato scelto si tiene, e sono due", () => {
  assert.deepEqual([...FORMATI_SEZIONE], ["righe", "piccole"]);
  assert.equal(normalizzaSezioni([{ ...UPS, formato: "piccole" }])[0].formato, "piccole");
  assert.equal(formatoDellaSezione("piccole"), "piccole");
});

test("il formato lo porta la pagina in un attributo, non un secondo disegno", () => {
  /* La riga disegnata resta una sola — stessa icona, stesso nome, stesso
   * valore, stessa leva — e cambia come si dispone. Due disegni per la stessa
   * voce sarebbero due disegni da tenere allineati. */
  const sezione = leggi("sections/sezioni-mie-section.js");
  assert.match(sezione, /data-formato="\$\{esc\(formato\)\}"/);
  assert.match(sezione, /\.dm-mia-lista\[data-formato="piccole"\]\{/);
  assert.equal((sezione.match(/function rigaMarkup\(/g) || []).length, 1);
  /* E il ridisegno lo vede: senza il formato nella firma, cambiarlo non
   * avrebbe ridipinto niente finché non cambiava anche uno stato. */
  assert.match(sezione, /JSON\.stringify\(\[sezione\.titolo, sezione\.icona, sezione\.formato, letture\]\)/);
});

test("la scelta sta nell'editor della sezione, accanto a quella della barra", () => {
  const editor = leggi("sections/sezioni-mie-editor-section.js");
  assert.match(editor, /data-mia-formato="\$\{esc\(formato\)\}"/);
  assert.match(editor, /letto\.formato = formatoDellaSezione\(/);
  /* Una sezione nuova nasce a righe: è il formato che hanno tutte le altre. */
  assert.match(editor, /formato: FORMATI_SEZIONE\[0\]/);
});
