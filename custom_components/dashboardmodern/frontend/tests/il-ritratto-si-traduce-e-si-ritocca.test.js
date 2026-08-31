/* Il ritratto v7: le facce vecchie si traducono, le combinazioni si risolvono.
 *
 * La faccia e' diventata un guardaroba intero — taglio, barba, colori,
 * occhi, occhiali, collana, colore del vestito — ma i render a monte non
 * coprono tutto: il modello deve scegliere il render nativo quando esiste
 * (lisci biondi sono «blonde hair», non una tinta) e dichiarare i ritocchi
 * quando no. E le facce salvate prima — quando barba e colori vivevano
 * dentro la fila dei capelli, o quando erano un disegno della 1.2 — devono
 * tradursi senza che nessuno riapra la plancia e trovi un'altra faccia.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  BARBE,
  CAPELLI,
  COLLANE,
  COLORI_BARBA,
  COLORI_CAPELLI,
  COLORI_OCCHI,
  COLORI_VESTITO,
  OCCHIALI,
  PERSONE,
  VESTITI,
  avatar3dACaso,
  fileAvatar3d,
  normalizeAvatar3d,
  risolviAvatar3d,
  vestitoRicolorabile,
} from "../src/core/avatar-3d.js";
import { normalizePeople } from "../src/core/person-model.js";

const tipi = (risolto, dove = "testa") => risolto.operazioni[dove].map((op) => op.tipo);

test("le facce della fase intermedia si traducono: barba, rossi, bianchi", () => {
  assert.partialDeepStrictEqual(normalizeAvatar3d({ persona: "uomo", capelli: "barba" }), {
    capelli: "lisci",
    barba: "corta",
    coloreCapelli: "naturale",
  });
  assert.partialDeepStrictEqual(normalizeAvatar3d({ persona: "donna", capelli: "rossi" }), {
    capelli: "lisci",
    barba: "nessuna",
    coloreCapelli: "rosso",
  });
  assert.partialDeepStrictEqual(normalizeAvatar3d({ persona: "neutro", capelli: "bianchi" }), {
    capelli: "lisci",
    coloreCapelli: "bianco",
  });
});

test("il normalizzatore completa ogni faccia con tutte le voci nuove", () => {
  const faccia = normalizeAvatar3d({});
  for (const [campo, elenco] of [
    ["persona", PERSONE],
    ["capelli", CAPELLI],
    ["barba", BARBE],
    ["coloreCapelli", COLORI_CAPELLI],
    ["coloreBarba", COLORI_BARBA],
    ["occhi", COLORI_OCCHI],
    ["vestito", VESTITI],
    ["coloreVestito", COLORI_VESTITO],
    ["occhiali", OCCHIALI],
    ["collana", COLLANE],
  ])
    assert.equal(faccia[campo], elenco[0], `${campo} parte dal default`);
});

test("la faccia disegnata a mano della 1.2 arriva fino allo schema nuovo", () => {
  const [persona] = normalizePeople([
    {
      name: "Nonno",
      entity: "person.nonno",
      avatar: {
        face: { skin: "f3", hair: "calvo", hairColor: "bianco", beard: "piena", outfit: "camicia" },
      },
    },
  ]);
  assert.partialDeepStrictEqual(persona.avatar.face, {
    persona: "uomo",
    capelli: "calvo",
    barba: "corta",
    carnagione: "media",
    vestito: "ufficio",
  });
});

test("il render nativo vince: biondi, rossi e barbuti lisci non si ritoccano", () => {
  for (const [faccia, testa] of [
    [{ persona: "uomo", capelli: "lisci", coloreCapelli: "biondo" }, "man_blonde_hair_chiara"],
    [{ persona: "donna", capelli: "lisci", coloreCapelli: "rosso" }, "woman_red_hair_chiara"],
    [{ persona: "uomo", capelli: "lisci", coloreCapelli: "bianco" }, "man_white_hair_chiara"],
    [{ persona: "uomo", capelli: "lisci", barba: "corta" }, "man_beard_chiara"],
  ]) {
    const risolto = risolviAvatar3d({ ...faccia, carnagione: "chiara" });
    assert.match(risolto.testa, new RegExp(testa.replace("_chiara", "_light")));
    assert.deepEqual(tipi(risolto), [], `${risolto.testa} non ha ritocchi`);
  }
});

test("quando il render non c'e' si dichiara la tinta, ma mai sul calvo", () => {
  const ricci = risolviAvatar3d({ persona: "uomo", capelli: "ricci", coloreCapelli: "biondo" });
  assert.equal(ricci.testa, "man_curly_hair_light");
  assert.partialDeepStrictEqual(ricci.operazioni.testa[0], {
    tipo: "tintaCapelli",
    rgb: [236, 190, 100],
  });
  const calvo = risolviAvatar3d({ persona: "uomo", capelli: "calvo", coloreCapelli: "rosa" });
  assert.deepEqual(tipi(calvo), [], "sul calvo non c'e' niente da tingere");
});

test("la barba sugli altri tagli e' un trapianto, con la donatrice nel precarico", () => {
  const faccia = { persona: "uomo", capelli: "ricci", barba: "lunga", carnagione: "scura" };
  const risolto = risolviAvatar3d(faccia);
  const barba = risolto.operazioni.testa.find((op) => op.tipo === "barba");
  assert.partialDeepStrictEqual(barba, { foggia: "lunga", donatrice: "man_beard_dark" });
  assert.ok(barba.innesto?.scala > 0, "l'innesto sa come atterrare sull'altra testa");
  assert.ok(fileAvatar3d(faccia).includes("man_beard_dark"), "chi precarica carica anche lei");
  /* Sul render gia' barbuto, invece, la barba e' la sua: nessuna donatrice. */
  const rasata = risolviAvatar3d({ persona: "uomo", capelli: "lisci", barba: "rasata" });
  assert.partialDeepStrictEqual(rasata.operazioni.testa[0], {
    tipo: "barba",
    foggia: "rasata",
    donatrice: null,
  });
});

test("anziano e anziana hanno i loro render, e la barba resta possibile", () => {
  assert.equal(risolviAvatar3d({ persona: "anziano" }).testa, "old_man_light");
  assert.equal(risolviAvatar3d({ persona: "anziana" }).testa, "old_woman_light");
  const nonno = risolviAvatar3d({ persona: "anziano", barba: "corta", coloreBarba: "grigia" });
  assert.partialDeepStrictEqual(nonno.operazioni.testa[0], {
    tipo: "barba",
    donatrice: "man_beard_light",
    rgb: [176, 178, 184],
  });
});

test("polo e camicia sono il busto casual col colletto dichiarato", () => {
  const polo = risolviAvatar3d({ persona: "uomo", vestito: "polo", coloreVestito: "verde" });
  assert.equal(polo.busto, "man_tipping_hand_light");
  assert.deepEqual(tipi(polo, "busto"), ["ricoloraAbito", "colletto"]);
  const camicia = risolviAvatar3d({ persona: "donna", vestito: "camicia" });
  assert.equal(camicia.busto, "woman_tipping_hand_light");
  assert.partialDeepStrictEqual(camicia.operazioni.busto[1], { tipo: "colletto", bottoni: 3 });
});

test("«In attesa» esiste solo al femminile, e per un uomo ricade su quel busto", () => {
  const lei = risolviAvatar3d({ persona: "donna", vestito: "attesa", carnagione: "media" });
  const lui = risolviAvatar3d({ persona: "uomo", vestito: "attesa", carnagione: "media" });
  assert.equal(lei.busto, "pregnant_woman_medium");
  assert.equal(lui.busto, "pregnant_woman_medium");
});

test("il colore del vestito tocca solo i busti ricolorabili, e «blu» e' la fabbrica", () => {
  assert.ok(vestitoRicolorabile("casual") && vestitoRicolorabile("medico"));
  assert.ok(!vestitoRicolorabile("cuoco") && !vestitoRicolorabile("nessuno"));
  const cuoco = risolviAvatar3d({ persona: "uomo", vestito: "cuoco", coloreVestito: "rosso" });
  assert.deepEqual(tipi(cuoco, "busto"), [], "sul cuoco la scelta non ha effetto");
  /* Chi ha salvato un medico prima di questa fila deve ritrovare il camice
   * bianco: il default «blu» non ritocca nessun render di fabbrica. */
  for (const vestito of ["casual", "saluto", "ufficio", "medico", "attesa"]) {
    const fabbrica = risolviAvatar3d({ persona: "uomo", vestito, coloreVestito: "blu" });
    assert.ok(!tipi(fabbrica, "busto").includes("ricoloraAbito"), `${vestito} blu resta com'e'`);
  }
});

test("accessori: occhiali e collana sono operazioni, e con le lenti scure niente ciglia", () => {
  const tondi = risolviAvatar3d({ persona: "uomo", occhiali: "tondi" });
  assert.partialDeepStrictEqual(tondi.operazioni.testa.at(-1), { tipo: "occhiali", stile: "tondi" });
  assert.ok(tondi.occhi.length === 2, "con le lenti trasparenti gli occhi battono ancora");
  const sole = risolviAvatar3d({ persona: "uomo", occhiali: "sole" });
  assert.deepEqual(sole.occhi, [], "le palpebre sopra le lenti sarebbero pelle sul vetro");
  const collana = risolviAvatar3d({ persona: "donna", vestito: "casual", collana: "pendente" });
  assert.partialDeepStrictEqual(collana.operazioni.busto.at(-1), {
    tipo: "collana",
    stile: "pendente",
  });
  /* Senza un busto non c'e' un collo: la collana non compare. */
  const nuda = risolviAvatar3d({ persona: "donna", vestito: "nessuno", collana: "pendente" });
  assert.deepEqual(tipi(nuda, "busto"), []);
});

test("gli occhi colorati sono una tinta d'iride dichiarata, marrone e' com'e'", () => {
  const verdi = risolviAvatar3d({ persona: "uomo", occhi: "verde" });
  assert.partialDeepStrictEqual(verdi.operazioni.testa[0], { tipo: "iride" });
  assert.deepEqual(tipi(risolviAvatar3d({ persona: "uomo", occhi: "marrone" })), []);
});

test("il sorteggio consegna una faccia completa dentro i cataloghi nuovi", () => {
  let semi = [0.93, 0.11, 0.47, 0.62, 0.05, 0.81, 0.33, 0.99, 0.27, 0.55, 0.71, 0.18];
  const faccia = avatar3dACaso(() => semi[(semi.push(semi.shift()), 0)]);
  assert.deepEqual(faccia, normalizeAvatar3d(faccia), "gia' normale, senza buchi");
  assert.ok(risolviAvatar3d(faccia), "e si risolve in un ritratto vero");
});
