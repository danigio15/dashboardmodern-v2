/* La faccia costruita: cataloghi chiusi, disegno deterministico, animazioni
 * per classe e mai dentro il modulo. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  avatarSvg,
  darken,
  FACE_BEARDS,
  FACE_EYES,
  FACE_GLASSES,
  FACE_HAIR_COLORS,
  FACE_HAIRS,
  FACE_MOUTHS,
  FACE_SKINS,
  normalizeFace,
} from "../src/core/person-avatar.js";

test("una faccia si normalizza dentro i cataloghi, e il fuori-elenco torna al default", () => {
  const face = normalizeFace({ skin: "marziano", hair: "riccio", glasses: "sole" });
  assert.equal(face.skin, Object.keys(FACE_SKINS)[0]);
  assert.equal(face.hair, "riccio");
  assert.equal(face.glasses, "sole");
  assert.equal(face.eyes, FACE_EYES[0]);
});

test("niente faccia per chi non ne ha costruita una", () => {
  assert.equal(normalizeFace(null), null);
  assert.equal(normalizeFace("corto"), null);
  assert.equal(normalizeFace([1, 2]), null);
  assert.equal(avatarSvg(null), "");
});

test("stesse scelte, stesso disegno — e ogni variante disegna qualcosa di suo", () => {
  const base = normalizeFace({});
  assert.equal(avatarSvg(base), avatarSvg(base), "il disegno deve essere deterministico");
  for (const [campo, keys] of [
    ["hair", FACE_HAIRS],
    ["eyes", FACE_EYES],
    ["mouth", FACE_MOUTHS],
    ["beard", FACE_BEARDS],
    ["glasses", FACE_GLASSES],
  ]) {
    const disegni = new Set(keys.map((key) => avatarSvg({ ...base, [campo]: key })));
    assert.equal(disegni.size, keys.length, `${campo}: due scelte disegnano la stessa cosa`);
  }
  for (const skin of Object.keys(FACE_SKINS))
    assert.ok(avatarSvg({ ...base, skin }).includes(FACE_SKINS[skin].base));
  for (const hairColor of Object.keys(FACE_HAIR_COLORS))
    assert.ok(avatarSvg({ ...base, hairColor }).includes(FACE_HAIR_COLORS[hairColor]));
});

test("l'SVG porta le classi per le animazioni, e la variante ferma le spegne", () => {
  const vivo = avatarSvg({});
  assert.match(vivo, /class="f-all"/);
  assert.match(vivo, /class="f-eyes"/);
  assert.match(vivo, /class="f-mouth"/);
  assert.doesNotMatch(vivo, /dm-face-still/);
  assert.match(avatarSvg({}, { animated: false }), /dm-face-still/);
});

test("il disegno non contiene mai testo dell'utente", () => {
  /* Tutto cio' che entra passa dai cataloghi: un tentativo di iniettare
   * markup si riduce alla scelta di default. */
  const svg = avatarSvg({ hair: '"><script>alert(1)</script>' });
  assert.doesNotMatch(svg, /script/);
});

test("darken scurisce senza inventare colori", () => {
  assert.equal(darken("#ffffff", 0.5), "#808080");
  assert.equal(darken("boh"), "boh");
});
