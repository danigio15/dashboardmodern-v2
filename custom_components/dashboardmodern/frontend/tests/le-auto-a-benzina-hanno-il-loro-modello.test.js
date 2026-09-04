/* Le auto a carburante hanno il loro modello in tendina (dal campo, dopo la #208).
 *
 * «Aggiungi tutti i modelli auto con la selezione delle auto normali non
 * elettriche: adesso se seleziono Jeep mi da' solo veicoli ibridi ed
 * elettrici.» La pagina Auto e' nata elettrica e il catalogo con lei. Adesso
 * ogni marca ha anche le sue famiglie a benzina, diesel e GPL, in un gruppo a
 * parte della tendina, e il gruppo del motore dichiarato sta in cima.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sorgente = await readFile(
  new URL("../src/sections/personalization-section.js", import.meta.url),
  "utf8",
);

/* Il catalogo si legge dal sorgente: la sezione tocca il documento appena la
 * si importa, e qui basta la tabella. */
function tabella(nome) {
  const inizio = sorgente.indexOf(`const ${nome} = Object.freeze({`);
  assert.ok(inizio >= 0, `${nome} c'e'`);
  const corpo = sorgente.slice(inizio + `const ${nome} = Object.freeze(`.length);
  const fine = corpo.indexOf("\n});");
  // eslint-disable-next-line no-new-func
  return new Function(`return (${corpo.slice(0, fine + 2)});`)();
}

test("ogni marca del catalogo elettrico ha la sua riga fra le termiche, e Jeep ha le sue", () => {
  const elettriche = tabella("CAR_MODELS");
  const termiche = tabella("CAR_MODELS_TERMICI");
  assert.deepEqual(Object.keys(termiche).sort(), Object.keys(elettriche).sort());
  for (const [marca, modelli] of Object.entries(termiche)) {
    assert.ok(Array.isArray(modelli), marca);
    /* Nessun doppione dentro la stessa marca. */
    assert.equal(new Set(modelli).size, modelli.length, `${marca}: doppioni`);
  }
  for (const modello of ["Avenger", "Renegade", "Compass", "Wrangler", "Grand Cherokee", "Gladiator"])
    assert.ok(termiche.Jeep.includes(modello), `Jeep ${modello}`);
  assert.ok(termiche.Fiat.includes("Panda"));
  assert.ok(termiche.Volkswagen.includes("Golf"));
  assert.ok(termiche.Toyota.includes("Yaris"));
  /* Chi e' solo elettrico non ha niente da aggiungere. */
  for (const marca of ["Tesla", "Polestar", "BYD", "XPeng", "Leapmotor"])
    assert.deepEqual(termiche[marca], [], marca);
  /* Le marche sono tante quante prima: il catalogo termico non ne inventa. */
  assert.ok(Object.keys(elettriche).length >= 35, "le marche sono quelle di prima");
});

test("la tendina ha due gruppi, e il gruppo del motore dichiarato sta in cima", () => {
  const modale = sorgente.slice(sorgente.indexOf("function modelOptions("));
  assert.match(modale, /function modelOptions\(brand, selected = "", tipo = ""\)/);
  assert.match(modale, /<optgroup label="\$\{esc\(etichetta\)\}">/);
  assert.match(modale, /t\("Benzina, diesel, GPL", "Petrol, diesel, LPG"\)/);
  assert.match(modale, /t\("Elettriche e ibride", "Electric and hybrid"\)/);
  assert.match(
    modale,
    /tipoMotore\(tipo\) === "termica" \? \[aCarburante, aBatteria\] : \[aBatteria, aCarburante\]/,
  );
  /* Un modello salvato fuori catalogo resta scelto. */
  assert.match(modale, /const fuoriCatalogo = current && !elettriche\.includes\(current\) && !termiche\.includes\(current\)/);
  /* E la tendina si riempie col motore della vettura, al primo disegno e al cambio marca. */
  assert.match(sorgente, /modelOptions\(brand, model, motoreDichiarato\(visual\)\)/);
  assert.match(sorgente, /motoreDichiarato\(visual\),\s*\);\s*refreshPreview\(\);/);
  /* L'appartenenza guarda tutti e due i gruppi: una Renegade e' una Jeep. */
  assert.match(sorgente, /function modelsForBrand\(brand\) \{\s*const \{ elettriche, termiche \} = gruppiPerMarca\(brand\);\s*return \[\.\.\.elettriche, \.\.\.termiche\];/);
  assert.match(sorgente, /for \(const brand of Object\.keys\(CAR_MODELS\)\) \{\s*if \(modelsForBrand\(brand\)\.some/);
  /* Il salvataggio non pretende piu' un modello elettrico o ibrido. */
  assert.equal(/elettrico o ibrido/.test(sorgente), false);
  assert.match(sorgente, /t\("Seleziona un modello\.", "Choose a model\."\)/);
  assert.match(sorgente, /t\("Modello", "Model"\)/);
});

test("un modello e' lo stesso solo per parole intere: una 5008 non e' una 500 (revisione)", async () => {
  const { stessoModello, normalizzaModello } = await import("../src/core/vehicle-model.js");
  assert.equal(normalizzaModello("  Škoda Octavia e-TEC "), "skoda octavia e tec");
  assert.equal(stessoModello("5008", "500"), false);
  assert.equal(stessoModello("500", "5008"), false);
  assert.equal(stessoModello("Avenger Electric", "Avenger"), true);
  assert.equal(stessoModello("ID.3", "id 3"), true);
  assert.equal(stessoModello("Model 3 Performance", "Model 3"), true);
  assert.equal(stessoModello("911", "911"), true);
  assert.equal(stessoModello("", "500"), false);
  /* La scheda usa questo confronto, e non piu' la sottostringa. */
  assert.match(sorgente, /modelsForBrand\(brand\)\.some\(\(model\) => stessoModello\(value, model\)\)/);
  assert.equal(/token\.includes\(candidate\)/.test(sorgente), false);
});

test("il motore lo dice la tendina aperta, e cambiandola i gruppi si riordinano (revisione)", () => {
  const motore = sorgente.slice(sorgente.indexOf("function motoreDichiarato("));
  assert.match(motore, /const tendina = doc\?\.querySelector\?\.\("#ed-body select\[data-ev-tipo\]"\);\s*if \(tendina\) return tipoMotore\(tendina\.value\);\s*return tipoMotore\(vehicle\?\.tipo\);/);
  assert.match(sorgente, /function riordinaIModelli\(\)/);
  assert.match(sorgente, /if \(event\.target\?\.matches\?\.\("select\[data-ev-tipo\]"\)\) riordinaIModelli\(\);/);
});
