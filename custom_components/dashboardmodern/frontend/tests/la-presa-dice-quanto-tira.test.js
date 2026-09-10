/* «Le prese che hanno anche la lettura dei consumi: è possibile mettere oltre
 * lo switch anche l'entità del consumo?» (#465)
 *
 * Una presa smart pubblica due entità — l'interruttore e il wattmetro — e sono
 * due entità distinte, non due letture della stessa: la seconda va indicata,
 * non indovinata. Chi non ce l'ha non compila niente e la card resta identica
 * a prima, che è la ragione per cui la casella è facoltativa.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizzaPrese, preseConfigurate } from "../src/core/prese-model.js";
import { consumoDellaPresa } from "../src/sections/prese-section.js";

const leggi = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const watt = (valore, unita = "W") => ({
  state: String(valore),
  attributes: { unit_of_measurement: unita },
});

test("il wattmetro sta sulla presa, comunque fosse scritto", () => {
  const [presa] = normalizzaPrese([
    { name: "TV Salotto", entity: "switch.tv_salotto", power: "sensor.tv_salotto_power" },
  ]);
  assert.equal(presa.power, "sensor.tv_salotto_power");
  /* Le due forme che una configurazione scritta a mano può avere. */
  assert.equal(
    normalizzaPrese([{ entity: "switch.a", power_entity: "sensor.a_w" }])[0].power,
    "sensor.a_w",
  );
  assert.equal(
    normalizzaPrese([{ entity: "switch.b", consumo: "sensor.b_w" }])[0].power,
    "sensor.b_w",
  );
  /* Chi non ce l'ha non ha una casella a metà: ha una casella vuota. */
  assert.equal(normalizzaPrese([{ entity: "switch.c" }])[0].power, "");
});

test("il wattmetro non decide se la presa è configurata", () => {
  /* Quello che rende una riga disegnabile resta l'interruttore: un wattmetro
   * da solo non è una presa, e una presa senza wattmetro lo è eccome. */
  const prese = preseConfigurate([
    { entity: "switch.tv", power: "sensor.tv_w" },
    { entity: "switch.modem" },
    { entity: "sensor.solo_watt", power: "sensor.solo_watt" },
  ]);
  assert.deepEqual(
    prese.map((presa) => presa.entity),
    ["switch.tv", "switch.modem"],
  );
});

test("i watt si leggono nella lingua del sensore", () => {
  const presa = { power: "sensor.tv_w" };
  assert.equal(consumoDellaPresa(presa, { "sensor.tv_w": watt(42) }), "42 W");
  /* Un sensore in kilowatt non vale mille volte tanto. */
  assert.equal(consumoDellaPresa(presa, { "sensor.tv_w": watt(1.2, "kW") }), "1.2 kW");
  /* Sopra il chilowatt la card lo scrive in chilowatt anche se il sensore
   * parla in watt: è la stessa forma degli elettrodomestici. */
  assert.equal(consumoDellaPresa(presa, { "sensor.tv_w": watt(2400) }), "2.4 kW");
  /* Zero watt è una notizia — non sta consumando — e si scrive. */
  assert.equal(consumoDellaPresa(presa, { "sensor.tv_w": watt(0) }), "0 W");
});

test("quello che non si sa non si scrive, e zero non è «non si sa»", () => {
  const presa = { power: "sensor.tv_w" };
  /* Un wattmetro che non risponde non deve dire «0 W»: sarebbe una casa che
   * non consuma niente detta da un sensore rotto. */
  for (const stato of [{ state: "unavailable" }, { state: "unknown" }, undefined]) {
    assert.equal(consumoDellaPresa(presa, { "sensor.tv_w": stato }), "");
  }
  /* E senza casella compilata non si va nemmeno a cercare. */
  assert.equal(consumoDellaPresa({ power: "" }, { "sensor.tv_w": watt(42) }), "");
  assert.equal(consumoDellaPresa({}, {}), "");
});

test("la card scrive i watt accanto allo stato, e solo se ci sono", async () => {
  const sorgente = await leggi("../src/sections/lights-page-section.js");
  assert.match(
    sorgente,
    /\$\{view\.consumo \? `<span class="dm-lucip-badge" data-kind="consumo">⚡ \$\{esc\(view\.consumo\)\}<\/span>` : ""\}/,
  );
  /* Una luce un wattmetro non ce l'ha: la pastiglia esiste solo dove il campo
   * arriva, e la scheda delle luci resta quella di sempre. */
  assert.match(sorgente, /\.dm-lucip-badge\[data-kind="consumo"\]/);
});

test("i watt entrano nella firma, o la card resterebbe ferma sul primo numero", async () => {
  const sorgente = await leggi("../src/sections/prese-section.js");
  const dentro = sorgente.slice(
    sorgente.indexOf("function firma("),
    sorgente.indexOf("function dipingi("),
  );
  assert.match(dentro, /consumoDellaPresa\(presa, states\)/);
});

test("la casella sta nella scheda, e si salva", async () => {
  const sorgente = await leggi("../src/sections/prese-section.js");
  assert.match(sorgente, /id="ed-presa-power"/);
  assert.match(sorgente, /t\("Consumo \(facoltativo\)", "Power draw \(optional\)"\)/);
  assert.match(sorgente, /power: clean\(doc\?\.getElementById\("ed-presa-power"\)\?\.value\)/);
  assert.match(sorgente, /power: modulo\.power,/);
  /* Il selettore delle entità, come per l'interruttore: scrivere a mano un
   * entity_id è il modo più veloce di sbagliarlo. */
  assert.match(sorgente, /data-presa-power-pick/);
});

test("le prese stanno in griglia come le luci, non una per riga (#474)", async () => {
  /* «Sarebbe piu bella come la sezione luci (sul desktop).»
   *
   * La regola della griglia esiste da sempre e nomina anche la pagina delle
   * prese — ma le card uscivano nude sotto il titolo della stanza, e senza il
   * contenitore la regola non aveva su cosa applicarsi: su un monitor le prese
   * restavano una per riga mentre le luci accanto stavano su tre colonne. */
  const prese = await readFile(
    new URL("../src/sections/prese-section.js", import.meta.url),
    "utf8",
  );
  assert.ok(
    prese.includes('<div class="dm-lucip-grid">'),
    "le card delle prese non stanno nella griglia delle luci",
  );
  const luci = await readFile(
    new URL("../src/sections/lights-page-section.js", import.meta.url),
    "utf8",
  );
  assert.ok(luci.includes('<div class="dm-lucip-grid">'), "la griglia delle luci e' cambiata nome");
});
