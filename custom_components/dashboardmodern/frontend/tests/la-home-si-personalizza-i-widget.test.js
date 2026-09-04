/* La Home si personalizza i widget (#303), e le icone non spariscono (#304).
 *
 * «Il widget temperatura come il clima visualizzano la temperatura media, si
 * potrebbe far scegliere cosa visualizzare»; «anche quelle in evidenza di
 * potere scegliere se vederle raggruppate oppure come widget una ad una»;
 * «mettere entita' come si vuole in modo widget e cliccarci sopra e aprire
 * l'entita'». E, da un'altra segnalazione: «icone spariscono, e riappaiono se
 * ci clicco sopra».
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const {
  NON_SI_FERMANO,
  animazioniDaFermare,
  applyWidgetPreferences,
  eUnaTesseraSola,
  evidenzaModel,
  evidenzaModels,
  evidenzeSingole,
  sorgenteDelWidget,
  widgetPreferences,
} = await import("../src/sections/home-widgets-section.js");
const { conRipiegoDiColore, oggettoWidget } = await import("../src/core/oggetti-widget.js");

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const leggi = (relativo) => readFileSync(join(SRC, relativo), "utf8");
const scrivi = (chiave, valore) => magazzino.set(chiave, JSON.stringify(valore));

const STATI = {
  "sensor.quadro_temp": { entity_id: "sensor.quadro_temp", state: "34.2", attributes: { friendly_name: "Quadro", unit_of_measurement: "°C" } },
  "switch.pompa": { entity_id: "switch.pompa", state: "on", attributes: { friendly_name: "Pompa" } },
};

test("la sorgente di una tessera si legge da cd_widgets, ripulita", () => {
  scrivi("cd_widgets", { sorgenti: { temperatura: " sensor.sala ", clima: "climate.sala", boh: "" } });
  const prefs = widgetPreferences();
  assert.deepEqual(prefs.sorgenti, { temperatura: "sensor.sala", clima: "climate.sala" });
  assert.equal(sorgenteDelWidget("temperatura"), "sensor.sala");
  assert.equal(sorgenteDelWidget("clima"), "climate.sala");
  assert.equal(sorgenteDelWidget("luci"), "");
  scrivi("cd_widgets", { sorgenti: ["no"] });
  assert.deepEqual(widgetPreferences().sorgenti, {});
  scrivi("cd_widgets", {});
  assert.deepEqual(widgetPreferences().sorgenti, {});
});

test("la temperatura e il clima mostrano la stanza o l'unita' scelta al posto della media", () => {
  const home = leggi("sections/home-widgets-section.js");
  assert.match(home, /const scelta = sorgenteDelWidget\("temperatura"\);\s*const sola = scelta \? rows\.find\(\(row\) => row\.entity === scelta\) : null;/);
  assert.match(home, /value: `\$\{formatNumber\(sola \? sola\.temperature : average, 1\)\}°`,/);
  assert.match(home, /const scelta = sorgenteDelWidget\("clima"\);/);
});

test("una voce in evidenza puo' avere la tessera sua, che si apre su di lei", () => {
  scrivi("cd_widgets", {});
  scrivi("cd_stanze", [{ id: "room-q", name: "Quadro elettrico" }]);
  scrivi("cd_evidenza", [
    { name: "Quadro", icon: "🌡️", entity: "sensor.quadro_temp", room_id: "room-q", sola: true },
    { name: "Pompa", icon: "💧", entity: "switch.pompa" },
  ]);
  assert.equal(eUnaTesseraSola({ sola: true }), true);
  assert.equal(eUnaTesseraSola({ sola: "true" }), true);
  assert.equal(eUnaTesseraSola({}), false);
  /* Il riassunto tiene solo chi non ha la tessera sua. */
  const riassunto = evidenzaModel(STATI);
  assert.equal(riassunto.value, "1");
  assert.match(riassunto.caption, /Pompa/);
  assert.doesNotMatch(riassunto.caption, /Quadro/);
  /* La tessera a se': chiave con l'indice, valore dell'entita', stanza sotto. */
  const singole = evidenzeSingole(STATI);
  assert.equal(singole.length, 1);
  assert.equal(singole[0].key, "evidenza-0");
  assert.equal(singole[0].label, "Quadro");
  assert.match(singole[0].value, /^34[.,]2 °C$/);
  assert.equal(singole[0].caption, "Quadro elettrico");
  assert.equal(singole[0].rows.length, 1);
  assert.deepEqual(
    evidenzaModels(STATI).map((w) => w.key),
    ["evidenza", "evidenza-0"],
  );
  /* Nascondere «In evidenza» nasconde anche le tessere a se'; l'ordine le
   * tiene insieme, come gli avvisi personalizzati. */
  const nascoste = applyWidgetPreferences(evidenzaModels(STATI), { hidden: ["evidenza"], order: [], excluded: [] });
  assert.deepEqual(nascoste, []);
  const ordinate = applyWidgetPreferences(
    [{ key: "luci" }, ...evidenzaModels(STATI)],
    { hidden: [], order: ["evidenza", "luci"], excluded: [] },
  );
  assert.deepEqual(ordinate.map((w) => w.key), ["evidenza", "evidenza-0", "luci"]);
  /* Con tutte le voci a se' il riassunto non c'e'. */
  scrivi("cd_evidenza", [{ name: "Quadro", entity: "sensor.quadro_temp", sola: true }]);
  assert.equal(evidenzaModel(STATI), null);
  assert.equal(evidenzeSingole(STATI).length, 1);
  /* E la tessera a se' si disegna a caselle come la madre. */
  const home = leggi("sections/home-widgets-section.js");
  assert.match(home, /const chiave = clean\(widget\.key\)\.startsWith\("evidenza-"\) \? "evidenza" : clean\(widget\.key\);/);
  assert.match(home, /\.\.\.evidenzaModels\(states\),/);
});

test("la scheda dei widget: la tendina «Cosa mostra» e la spunta «Tessera a se'»", () => {
  const editor = leggi("sections/todo-editor-section.js");
  assert.match(editor, /function sorgenteMarkup\(key\)/);
  assert.match(editor, /data-widget-sorgente="\$\{esc\(key\)\}"/);
  assert.match(editor, /scriviPreferenze\(\{ sorgenti \}\);/);
  assert.match(editor, /doc\.addEventListener\("change", onChange\);/);
  assert.match(editor, /<input type="checkbox" data-evid-field="sola"/);
  assert.match(editor, /campo\.type === "checkbox" \? Boolean\(campo\.checked\) : clean\(campo\.value\)/);
});

test("le animazioni che passano dall'invisibile non si fermano a meta' (#304)", () => {
  assert.ok(NON_SI_FERMANO.test("dmTileIn"));
  assert.ok(!NON_SI_FERMANO.test("dmAlertShutter"));
  assert.ok(!NON_SI_FERMANO.test("dmBoilerBeat"));
  const fuori = { contains: () => false };
  const anim = (animationName) => ({ playState: "running", animationName, effect: { target: {} } });
  const ferme = animazioniDaFermare([anim("dmTileIn"), anim("dmAlertLight"), anim("dmBoilerBeat")], (n) => fuori.contains(n));
  assert.deepEqual(ferme.map((a) => a.animationName), ["dmAlertLight", "dmBoilerBeat"]);
  /* Chi si ferma, si ferma al fotogramma zero: la posa di riposo, non a meta'. */
  const home = leggi("sections/home-widgets-section.js");
  assert.match(home, /anim\.currentTime = 0;\s*anim\.pause\(\);/);
});

test("i disegni portano il colore di ripiego accanto alla sfumatura, e il foglio non si rifa' (#304)", () => {
  assert.equal(conRipiegoDiColore('<path fill="url(#dmoLuceB)" stroke="url(#dmoX)"/>'), '<path fill="url(#dmoLuceB) currentColor" stroke="url(#dmoX) currentColor"/>');
  assert.equal(conRipiegoDiColore('<path fill="#fff"/>'), '<path fill="#fff"/>');
  assert.match(oggettoWidget("luci"), /url\(#[A-Za-z0-9_-]+\) currentColor/);
  const foglio = leggi("sections/icone-leggibili-section.js");
  assert.match(foglio, /if \(gia\) \{\s*body\.prepend\(gia\);\s*return true;\s*\}/);
  const beta17 = leggi("sections/beta17-final-icon-polish-section.js");
  assert.match(beta17, /new root\.MutationObserver\(unGiroPerFotogramma\)/);
});
