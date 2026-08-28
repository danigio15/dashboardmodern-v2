/* Tre cose viste su una casa vera, tutte e tre dello stesso stampo.
 *
 * Ognuna e' una domanda a cui la plancia rispondeva in piu' modi a seconda di
 * chi la faceva:
 *
 *   1. «quale stanza viene prima» — la scheda Stanze lascia ordinarle, ma le
 *      pagine che raggruppano per stanza si riscrivevano l'ordine ognuna a
 *      modo suo: due in ordine alfabetico, una nell'ordine in cui le cose
 *      erano state configurate. L'ordine scelto non arrivava a nessuna;
 *   2. «quanti watt sono» — un contatore che pubblica in kW e' normale quanto
 *      uno in watt, e la tessera leggeva il numero e basta: 0,27 kW
 *      diventavano «0 W», una casa spenta mentre consuma duecentosettanta
 *      watt, col flusso che nella stessa pagina diceva 0,27 kW;
 *   3. «cos'e' una tapparella» — una finestra con le persiane manuali e un
 *      contatto sull'anta non ha coperture da elencare. La pagina la disegna
 *      da tempo; la tessera la saltava, e chi ha solo i sensori di apertura
 *      non vedeva in Home quali infissi ha lasciato aperti.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");

test("l'ordine delle stanze e' quello scelto, e vale per tutti", async () => {
  const { roomOrderRank } = await import("../src/core/room-overview.js");

  // L'ordine e' quello dell'elenco salvato: e' cosi' che le frecce lo scrivono.
  const posto = roomOrderRank([{ name: "Bagnetto" }, { name: "Cucina" }, { name: "Salone" }]);
  assert.ok(posto("Bagnetto") < posto("Cucina"), "il bagnetto messo per primo viene per primo");
  assert.ok(posto("Cucina") < posto("Salone"));
  // Alfabeticamente il salone verrebbe dopo la cucina: qui non conta l'alfabeto.
  const invertito = roomOrderRank([{ name: "Salone" }, { name: "Cucina" }]);
  assert.ok(invertito("Salone") < invertito("Cucina"), "l'ordine scelto batte l'alfabeto");

  // Un campo `order` esplicito comanda sull'ordine dell'elenco.
  const conOrder = roomOrderRank([
    { name: "Cucina", order: 2 },
    { name: "Salone", order: 0 },
    { name: "Bagnetto", order: 1 },
  ]);
  assert.ok(conOrder("Salone") < conOrder("Bagnetto"));
  assert.ok(conOrder("Bagnetto") < conOrder("Cucina"));

  // Chi non e' fra le stanze configurate resta in fondo, dove stava.
  assert.equal(posto("Garage"), Number.MAX_SAFE_INTEGER);
  assert.equal(posto(""), Number.MAX_SAFE_INTEGER);
  assert.equal(posto(null), Number.MAX_SAFE_INTEGER);
  // Il nome si riconosce comunque sia stato scritto.
  assert.equal(posto("  bagnetto  "), posto("Bagnetto"));
});

test("le pagine che raggruppano per stanza chiedono l'ordine a un posto solo", () => {
  // La risposta la da' il nucleo, e le tre pagine gliela chiedono.
  for (const modulo of [
    "sections/shutter-scene-section.js",
    "sections/lights-scene-section.js",
    "sections/appliance-showcase-section.js",
  ]) {
    const testo = leggi(modulo);
    assert.match(
      testo,
      /import \{ roomOrderRank \} from "\.\.\/core\/room-overview\.js"/,
      `${modulo} non chiede l'ordine delle stanze al nucleo`,
    );
    assert.match(testo, /ordineStanze\(\)/, `${modulo} non usa l'ordine delle stanze`);
  }

  /* E `shared` resta senza: e' la base che ogni sezione carica per prima, e
   * farle crescere una dipendenza per comodita' di tre chiamanti sposta
   * l'ordine in cui si avvia tutto il resto — che su WebKit e' bastato a far
   * tornare il pannello foto dell'auto a vestirsi coi panni dell'auto in uso. */
  const condiviso = leggi("sections/shared.js");
  assert.doesNotMatch(condiviso, /room-overview/);

  // E nessuna delle tre ordina piu' le stanze per alfabeto e basta.
  const tapparelle = leggi("sections/shutter-scene-section.js");
  assert.match(tapparelle, /const stanza = ordineStanze\(\)/);
  assert.match(tapparelle, /left !== right\) return left - right/);
  const luci = leggi("sections/lights-scene-section.js");
  assert.match(luci, /stanza\(left\.room\) - stanza\(right\.room\)/);
  const elettro = leggi("sections/appliance-showcase-section.js");
  assert.match(elettro, /stanza\(left\.room\?\.name\) - stanza\(right\.room\?\.name\)/);
});

test("i watt si contano leggendo l'unita', non solo il numero", async () => {
  const { wattsFromState } = await import("../src/core/signed-energy.js");
  const lettura = (state, unit) =>
    wattsFromState({ state, attributes: { unit_of_measurement: unit } });

  // Il caso segnalato: 0,27 kW non sono zero watt.
  assert.equal(lettura("0.27", "kW"), 270);
  // La virgola e' un separatore decimale come il punto.
  assert.equal(lettura("0,27", "kW"), 270);
  // Le unita' che una casa puo' pubblicare davvero.
  assert.equal(lettura("270", "W"), 270);
  assert.equal(lettura("12", "kw"), 12000);
  assert.equal(lettura("5", "KW"), 5000);
  assert.equal(lettura("0.001", "MW"), 1000);
  // Senza unita' si assumono i watt, come ha sempre fatto il runtime: cambiare
  // questa regola vorrebbe dire cambiare cosa vedono le case che gia' vanno.
  assert.equal(lettura("270", ""), 270);
  // Chi non ha niente da dire non dice zero.
  assert.equal(lettura("unavailable", "W"), null);
  assert.equal(lettura("abc", "W"), null);
  assert.equal(wattsFromState(null), null);

  // E la tessera legge da li', non piu' dal numero nudo.
  const ponte = leggi("sections/home-widgets-section.js");
  assert.match(ponte, /import \{ wattsFromState \} from "\.\.\/core\/signed-energy\.js"/);
  assert.match(ponte, /watts: wattsOf\(states, clean\(model\?\.\[group\]\?\.\[field\]\) \|\| slot\)/);
  // Anche il flusso, che guardava solo il kW e prendeva un MW per un watt.
  const flusso = leggi("sections/energy-flow-section.js");
  assert.match(flusso, /return wattsFromState\(nodo\)/);
  assert.doesNotMatch(flusso, /unit === "kw" \? value \* 1000 : value/);
});

test("la finestra col solo contatto entra nella tessera delle tapparelle", () => {
  const ponte = leggi("sections/home-widgets-section.js");
  // La tessera conosce le finestre senza motori, con le stesse funzioni con
  // cui le conosce la pagina: una regola sola su cosa sia una finestra.
  assert.match(
    ponte,
    /import \{ contactEntity, isWindowOnly, windowOpenFromState \} from "\.\.\/core\/shutter-window\.js"/,
  );
  assert.match(ponte, /if \(isWindowOnly\(item\)\)/);
  assert.match(ponte, /soloSensore: true/);
  // Il contatto parla la sua lingua, e non ha una posizione da inventare.
  assert.match(ponte, /windowOpenFromState\(current\?\.state\) === true/);
  assert.match(ponte, /position: soloSensore \|\| !Number\.isFinite\(position\) \? null/);
  // E non prende i comandi: `isCover` resta falso, quindi niente frecce.
  assert.match(ponte, /isCover: !soloSensore && \/\^cover\\\.\/i\.test\(entity\)/);
});
