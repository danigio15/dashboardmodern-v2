/* La faccia costruita: cataloghi chiusi, disegno deterministico, animazioni
 * per classe e mai dentro il modulo. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  avatarSvg,
  darken,
  FACE_AGES,
  FACE_BEARD_COLORS,
  FACE_BEARDS,
  FACE_BROWS,
  FACE_BUILDS,
  FACE_EARS,
  FACE_EYE_COLORS,
  FACE_EYES,
  FACE_GLASSES,
  FACE_HAIR_COLORS,
  FACE_HAIRS,
  FACE_HATS,
  FACE_LIP_COLORS,
  FACE_MARKS,
  FACE_MOUTHS,
  FACE_NOSES,
  FACE_OUTFIT_COLORS,
  FACE_OUTFITS,
  FACE_SHAPES,
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
    ["shape", Object.keys(FACE_SHAPES)],
    ["age", FACE_AGES],
    ["ears", FACE_EARS],
    ["marks", FACE_MARKS],
    ["hair", FACE_HAIRS],
    ["eyes", FACE_EYES],
    ["brows", FACE_BROWS],
    ["nose", FACE_NOSES],
    ["mouth", FACE_MOUTHS],
    ["lips", Object.keys(FACE_LIP_COLORS)],
    ["beard", FACE_BEARDS],
    ["build", FACE_BUILDS],
    ["glasses", FACE_GLASSES],
    ["hat", FACE_HATS],
    ["outfit", FACE_OUTFITS],
    ["outfitColor", Object.keys(FACE_OUTFIT_COLORS)],
  ]) {
    const disegni = new Set(keys.map((key) => avatarSvg({ ...base, [campo]: key })));
    assert.equal(disegni.size, keys.length, `${campo}: due scelte disegnano la stessa cosa`);
  }
  for (const skin of Object.keys(FACE_SKINS))
    assert.ok(avatarSvg({ ...base, skin }).includes(FACE_SKINS[skin].base));
  for (const hairColor of Object.keys(FACE_HAIR_COLORS))
    assert.ok(avatarSvg({ ...base, hairColor }).includes(FACE_HAIR_COLORS[hairColor]));
  for (const eyeColor of Object.keys(FACE_EYE_COLORS))
    assert.ok(avatarSvg({ ...base, eyeColor }).includes(FACE_EYE_COLORS[eyeColor]));
  const iridi = new Set(Object.keys(FACE_EYE_COLORS).map((eyeColor) => avatarSvg({ ...base, eyeColor })));
  assert.equal(iridi.size, Object.keys(FACE_EYE_COLORS).length, "eyeColor: due scelte disegnano la stessa cosa");
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

test("i tratti nuovi partono da com'era disegnata prima la faccia", () => {
  /* «Il personaggio lo vedo sempre uguale»: i tratti sono venti adesso, ma
   * una faccia salvata mesi fa non deve cambiare da sola — ogni catalogo
   * nuovo ha per prima la scelta che riproduce il disegno di allora. */
  const vecchia = normalizeFace({ skin: "f3", hair: "riccio", hairColor: "nero" });
  assert.equal(vecchia.shape, "ovale");
  assert.equal(vecchia.age, "giovane");
  assert.equal(vecchia.ears, "normali");
  assert.equal(vecchia.marks, "nessuno");
  assert.equal(vecchia.brows, "naturali");
  assert.equal(vecchia.nose, "dritto");
  assert.equal(vecchia.lips, "naturale");
  assert.equal(vecchia.beardColor, "capelli");
  assert.equal(vecchia.hat, "nessuno");
  assert.equal(vecchia.outfitColor, "persona");
});

test("la barba puo' avere un colore suo, o seguire i capelli", () => {
  const base = { ...normalizeFace({}), beard: "piena", hairColor: "nero" };
  const eredita = avatarSvg({ ...base, beardColor: "capelli" });
  assert.ok(eredita.includes(FACE_HAIR_COLORS.nero), "senza scelta la barba prende il colore dei capelli");
  const bianca = avatarSvg({ ...base, beardColor: "bianco" });
  assert.ok(bianca.includes(FACE_BEARD_COLORS.bianco));
  assert.notEqual(eredita, bianca);
  /* E ogni colore dichiarato disegna la sua barba. «Come i capelli» non e' un
   * colore ma un rinvio: con i capelli neri disegna la stessa barba di «nero»,
   * ed e' giusto cosi'. */
  const espliciti = Object.keys(FACE_BEARD_COLORS).filter((key) => key !== "capelli");
  const disegni = new Set(espliciti.map((beardColor) => avatarSvg({ ...base, beardColor })));
  assert.equal(disegni.size, espliciti.length);
  assert.equal(eredita, avatarSvg({ ...base, beardColor: "nero" }));
});

test("il vestito puo' avere un colore suo, o quello della persona", () => {
  const base = normalizeFace({});
  const persona = avatarSvg({ ...base, outfitColor: "persona" }, { shirt: "#ff0055" });
  assert.ok(persona.includes("#ff0055"), "senza scelta il vestito e' il colore della card");
  const rosso = avatarSvg({ ...base, outfitColor: "rosso" }, { shirt: "#ff0055" });
  assert.ok(rosso.includes(FACE_OUTFIT_COLORS.rosso));
  assert.ok(!rosso.includes("#ff0055"), "un colore scelto vince su quello della card");
});

test("il copricapo veste del colore del vestito, non di uno suo", () => {
  const base = { ...normalizeFace({}), hat: "berretto" };
  assert.ok(avatarSvg({ ...base, outfitColor: "verde" }).includes(FACE_OUTFIT_COLORS.verde));
});

test("le due meta' della faccia sono la stessa, ribaltata", () => {
  /* Sopracciglia, orecchie, lentiggini e zampe di gallina si disegnano una
   * volta sola: a mano le due meta' non verrebbero mai uguali, e in una
   * faccia si vede subito. */
  const svg = avatarSvg({ marks: "lentiggini", age: "maturo" });
  const specchi = svg.match(/translate\(120,0\) scale\(-1,1\)/g) || [];
  assert.ok(specchi.length >= 5, `pezzi specchiati: ${specchi.length}`);
});
