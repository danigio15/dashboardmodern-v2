/* La faccia che si costruisce, pezzo per pezzo — nello stile dei personaggi
 * 3D da cartone, ma con l'anatomia al posto giusto: la forma del cranio, gli
 * zigomi in luce e la mascella in ombra, le orecchie con la loro conca, il
 * naso col dorso e le narici, gli occhi con la piega della palpebra e l'iride
 * a raggi, le labbra con volume.
 *
 * L'avatar delle persone non e' un'emoji scelta da un elenco: e' una faccia
 * composta. Ogni tratto e' una scelta a se' — forma del viso, carnagione,
 * eta', orecchie, nei e lentiggini, occhi e loro colore, sopracciglia, taglio
 * e colore dei capelli, barba e suo colore, naso, bocca e colore delle
 * labbra, corporatura, vestito e suo colore, occhiali, copricapo — cosi' due
 * persone di casa non si somigliano per forza.
 *
 * Questo modulo la disegna: prende una scelta per ogni pezzo e restituisce
 * l'SVG, sempre lo stesso per le stesse scelte, cosi' la card e l'anteprima
 * dell'editor mostrano la stessa persona.
 *
 * Le animazioni non stanno qui: l'SVG porta le classi (`f-all`, `f-eyes`,
 * `f-mouth`) e il respiro, il battito di palpebre e lo sguardo li mette il
 * foglio di stile della sezione. Il modulo e' puro: scelte dentro, testo SVG
 * fuori.
 */

const clean = (value) => String(value ?? "").trim();

/* ── I cataloghi. Ogni pezzo ha un elenco chiuso di scelte: una scelta fuori
 * elenco torna alla prima, cosi' una configurazione scritta a mano o vecchia
 * disegna comunque una faccia intera. La prima voce di ogni elenco e' anche
 * quella che si eredita: chi aveva gia' costruito la sua faccia la ritrova
 * com'era, e i tratti nuovi partono da com'erano disegnati prima. ── */

export const FACE_SKINS = Object.freeze({
  f1: { base: "#ffe3c8", shade: "#eec4a2" },
  f2: { base: "#f6cfa8", shade: "#dfae83" },
  f3: { base: "#e8b88a", shade: "#c99566" },
  f4: { base: "#c98f5e", shade: "#a86f42" },
  f5: { base: "#9a6b43", shade: "#7a4f2e" },
  f6: { base: "#6b4a2e", shade: "#513520" },
});

/* La forma del cranio: e' il tratto che piu' di tutti fa «un'altra persona».
 * Ogni forma porta anche dove stanno le orecchie, che seguono la larghezza. */
export const FACE_SHAPES = Object.freeze({
  ovale: {
    head: "M60 16 C81 16 90 33 90 53 C90 74 77 88 60 88 C43 88 30 74 30 53 C30 33 39 16 60 16 Z",
    ear: 30.5,
    earY: 56,
  },
  tondo: {
    head: "M60 16 C83 16 94 31 94 53 C94 73 81 86 60 86 C39 86 26 73 26 53 C26 31 37 16 60 16 Z",
    ear: 27,
    earY: 56,
  },
  squadrato: {
    head: "M60 15 C79 15 89 25 89 43 L89 63 C89 74 85 82 78 86 L42 86 C35 82 31 74 31 63 L31 43 C31 25 41 15 60 15 Z",
    ear: 31,
    earY: 54,
  },
  cuore: {
    head: "M60 15 C82 15 91 30 90 50 C89 64 82 74 72 81 C67 85 63 89 60 91 C57 89 53 85 48 81 C38 74 31 64 30 50 C29 30 38 15 60 15 Z",
    ear: 30.5,
    earY: 53,
  },
  affilato: {
    head: "M60 17 C74 17 82 26 85 42 C87 54 82 68 71 79 C66 84 62 88 60 90 C58 88 54 84 49 79 C38 68 33 54 35 42 C38 26 46 17 60 17 Z",
    ear: 34.5,
    earY: 53,
  },
  lungo: {
    head: "M60 13 C77 13 87 30 87 54 C87 78 74 92 60 92 C46 92 33 78 33 54 C33 30 43 13 60 13 Z",
    ear: 33.5,
    earY: 57,
  },
});

export const FACE_HAIR_COLORS = Object.freeze({
  nero: "#2a221e",
  blu: "#2f4f7a",
  rosa: "#c96a8f",
  moro: "#463024",
  castano: "#6b4a2f",
  cioccolato: "#8b5e3c",
  biondo: "#d9a441",
  rame: "#b5502c",
  grigio: "#9b958f",
  bianco: "#e9e4da",
});

export const FACE_HAIRS = Object.freeze([
  "rasato",
  "corto",
  "ciuffo",
  "spettinato",
  "riccio",
  "lungo",
  "caschetto",
  "chignon",
  "coda",
  "afro",
  "pettinato",
  "calvo",
]);

export const FACE_EYES = Object.freeze(["normali", "sorridenti", "grandi", "assonnati", "stretti"]);
/* Il colore dell'iride: e' quello a dare vita agli occhi grandi. */
export const FACE_EYE_COLORS = Object.freeze({
  azzurro: "#3f8fd8",
  verde: "#3f9e63",
  nocciola: "#a3762e",
  marrone: "#6f4522",
  grigio: "#7d8a99",
  ambra: "#c9852b",
  ghiaccio: "#8fbcd6",
});
/* Le sopracciglia: due dita sopra gli occhi, e cambiano l'espressione piu'
 * della bocca. Si disegna la sinistra e la destra e' il suo specchio. */
export const FACE_BROWS = Object.freeze([
  "naturali",
  "folte",
  "sottili",
  "arcuate",
  "dritte",
  "corrucciate",
]);
export const FACE_MOUTHS = Object.freeze([
  "sorriso",
  "risata",
  "neutra",
  "sorrisetto",
  "imbronciata",
  "aperta",
]);
/* Il colore delle labbra: «naturale» e' la carnagione un po' piu' calda, gli
 * altri sono rossetti. */
export const FACE_LIP_COLORS = Object.freeze({
  naturale: "#b3573b",
  corallo: "#e2725b",
  rosa: "#de7a8f",
  rosso: "#c0392b",
  prugna: "#8e3d5c",
  nude: "#c08d78",
});
export const FACE_NOSES = Object.freeze(["dritto", "piccolo", "pronunciato", "largo", "allinsu"]);
export const FACE_EARS = Object.freeze(["normali", "sporgenti", "piccole"]);
export const FACE_BEARDS = Object.freeze(["nessuna", "incolta", "baffi", "pizzetto", "piena"]);
/* La barba non ha per forza il colore dei capelli: si ingrigisce prima. La
 * prima scelta e' «come i capelli», che e' come si e' sempre disegnata. */
export const FACE_BEARD_COLORS = Object.freeze({ capelli: "", ...FACE_HAIR_COLORS });
export const FACE_GLASSES = Object.freeze([
  "nessuno",
  "tondi",
  "squadrati",
  "sole",
  "lettura",
  "aviatore",
]);
/* Il copricapo: prende il colore del vestito, cosi' la persona resta
 * riconoscibile dal suo colore anche col cappello in testa. */
export const FACE_HATS = Object.freeze(["nessuno", "berretto", "cappello", "bandana", "fascia"]);
/* L'eta' non cambia i tratti: cambia i segni che gli anni lasciano — la piega
 * naso-bocca, le righe sulla fronte, le zampe di gallina. */
export const FACE_AGES = Object.freeze(["giovane", "adulto", "maturo"]);
/* I dettagli della pelle: quelli che in una foto si notano subito. */
export const FACE_MARKS = Object.freeze(["nessuno", "lentiggini", "neo", "fossette"]);
/* La corporatura: cambia la larghezza del viso e delle spalle. La prima e' il
 * default, cosi' le facce gia' costruite restano identiche a com'erano. */
export const FACE_BUILDS = Object.freeze(["normale", "magra", "robusta"]);
/* I vestiti del busto: la maglietta col colore della persona, la camicia col
 * colletto e i bottoni, la felpa col cappuccio, la giacca col completo — la
 * camicia bianca e la cravatta che prende il colore della persona. */
export const FACE_OUTFITS = Object.freeze([
  "maglietta",
  "polo",
  "camicia",
  "maglione",
  "felpa",
  "giacca",
  "gilet",
  "canotta",
  "tuta",
  "abito",
  "cardigan",
]);
/* Il colore del vestito: «persona» e' il colore scelto per la card — com'e'
 * sempre stato — e gli altri sono un vestito che se ne infischia. */
export const FACE_OUTFIT_COLORS = Object.freeze({
  persona: "",
  bianco: "#eef2f7",
  nero: "#2b3240",
  grigio: "#8b98a8",
  blu: "#2f6fb5",
  verde: "#3d9970",
  rosso: "#c04a3f",
  giallo: "#e0a83c",
  viola: "#7c5cc4",
  sabbia: "#c9ab86",
});

/* Come si disegna il ritratto: a mano, in SVG — leggero, immediato, lo
 * stesso da sempre — oppure in tre dimensioni vere, con la testa costruita
 * in geometria e illuminata da tre luci. Il 3D costa un decimo di secondo la
 * prima volta e poi resta in memoria; il disegno non costa niente. La scelta
 * e' della persona, e la prima voce e' quella di sempre. */
export const FACE_RENDERS = Object.freeze(["disegno", "3d"]);

const pickKey = (value, catalog) => {
  const keys = Array.isArray(catalog) ? catalog : Object.keys(catalog);
  const wanted = clean(value);
  return keys.includes(wanted) ? wanted : keys[0];
};

/**
 * Le scelte come si possono disegnare: ogni pezzo dentro il suo catalogo.
 * `null` per «nessuna faccia»: chi non ne ha costruita una resta con
 * l'emoji o le iniziali.
 */
export function normalizeFace(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return {
    skin: pickKey(input.skin, FACE_SKINS),
    shape: pickKey(input.shape, FACE_SHAPES),
    age: pickKey(input.age, FACE_AGES),
    ears: pickKey(input.ears, FACE_EARS),
    marks: pickKey(input.marks, FACE_MARKS),
    hair: pickKey(input.hair, FACE_HAIRS),
    hairColor: pickKey(input.hairColor, FACE_HAIR_COLORS),
    eyes: pickKey(input.eyes, FACE_EYES),
    eyeColor: pickKey(input.eyeColor, FACE_EYE_COLORS),
    brows: pickKey(input.brows, FACE_BROWS),
    nose: pickKey(input.nose, FACE_NOSES),
    mouth: pickKey(input.mouth, FACE_MOUTHS),
    lips: pickKey(input.lips, FACE_LIP_COLORS),
    beard: pickKey(input.beard, FACE_BEARDS),
    beardColor: pickKey(input.beardColor, FACE_BEARD_COLORS),
    glasses: pickKey(input.glasses, FACE_GLASSES),
    hat: pickKey(input.hat, FACE_HATS),
    build: pickKey(input.build, FACE_BUILDS),
    outfit: pickKey(input.outfit, FACE_OUTFITS),
    outfitColor: pickKey(input.outfitColor, FACE_OUTFIT_COLORS),
    render: pickKey(input.render, FACE_RENDERS),
  };
}

export function lighten(hex, amount = 0.16) {
  const raw = clean(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return hex;
  const channel = (at) => {
    const value = Number.parseInt(raw.slice(at, at + 2), 16);
    return Math.min(255, Math.round(value + (255 - value) * amount))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/* Un colore un po' piu' scuro, per sopracciglia e ombre: si calcola dal
 * colore scelto invece di tenere un secondo catalogo da dimenticare. */
export function darken(hex, factor = 0.72) {
  const raw = clean(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return hex;
  const channel = (at) =>
    Math.round(Number.parseInt(raw.slice(at, at + 2), 16) * factor)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/* Lo specchio: si disegna meta' faccia e l'altra meta' e' la stessa, ribaltata
 * attorno all'asse. Due sopracciglia disegnate a mano non sono mai davvero
 * uguali, e in una faccia si vede. */
const specchia = (markup) => `<g transform="translate(120,0) scale(-1,1)">${markup}</g>`;

/* ── I pezzi. Il viso sta in un viewBox 120x120: testa larga sulle guance e
 * morbida sul mento, occhi grandi a y=54, bocca a y=72. Ogni taglio ha due
 * meta': quella dietro la testa e quella davanti alla fronte — e le ciocche
 * di luce che gli danno volume. ── */

function hairPaths(style, color, gradId) {
  const paint = `url(#${gradId})`;
  const scuro = darken(color, 0.78);
  const luce = lighten(color, 0.24);
  const front = (d) => `<path d="${d}" fill="${paint}"/>`;
  const ombra = (d) => `<path d="${d}" fill="${scuro}"/>`;
  const ciocca = (d, o = 0.55) =>
    `<path d="${d}" stroke="${luce}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="${o}"/>`;
  switch (style) {
    case "rasato":
      return {
        back: "",
        front:
          `<path d="M33 42 C33 24 44 15 60 15 C76 15 87 24 87 42 C85 32 76 24 60 24 C44 24 35 32 33 42 Z" fill="${color}" opacity=".5"/>` +
          `<path d="M36 36 C40 27 49 21 60 21 C71 21 80 27 84 36" stroke="${color}" stroke-width="1.4" fill="none" opacity=".35"/>`,
      };
    case "ciuffo":
      // Il ciuffo a onda sopra la fronte, come il biondo del riferimento.
      return {
        back: "",
        front:
          front(
            "M31 46 C29 24 43 12 60 12 C79 12 90 22 89 44 C88 34 84 27 76 25 C79 30 78 35 74 38 C72 30 66 25 58 25 C64 28 66 33 64 38 C56 30 44 31 39 38 C35 41 32 43 31 46 Z",
          ) +
          ombra("M64 38 C66 33 64 28 58 25 C66 25 72 30 74 38 Z") +
          ciocca("M44 22 C51 16 62 15 70 18") +
          ciocca("M48 30 C54 25 62 24 68 27", 0.4),
      };
    case "spettinato":
      return {
        back: "",
        front:
          front(
            "M31 45 C31 37 32 30 36 25 L40 15 L45 23 C47 18 51 13 56 11 L59 20 C62 15 68 11 73 12 L71 21 C77 19 82 23 85 28 L80 30 C85 33 88 39 88 45 C85 36 78 29 68 28 C55 26 43 30 38 36 C35 39 32 42 31 45 Z",
          ) +
          ciocca("M45 24 C52 19 61 18 68 20") +
          ciocca("M50 31 C56 27 63 26 69 28", 0.4),
      };
    case "riccio":
      /* La corona di riccioli: cerchi che si accavallano, con i riccioli
       * scuri sotto e i puntini di luce sopra — come la riccia del video. */
      return {
        back:
          `<circle cx="34" cy="44" r="9" fill="${scuro}"/><circle cx="86" cy="44" r="9" fill="${scuro}"/>` +
          `<circle cx="31" cy="55" r="7" fill="${scuro}"/><circle cx="89" cy="55" r="7" fill="${scuro}"/>`,
        front:
          `<circle cx="41" cy="30" r="10.5" fill="${paint}"/><circle cx="55" cy="23" r="11.5" fill="${paint}"/>` +
          `<circle cx="70" cy="24" r="10.5" fill="${paint}"/><circle cx="81" cy="32" r="9.5" fill="${paint}"/>` +
          `<circle cx="35" cy="39" r="8.5" fill="${paint}"/><circle cx="85" cy="40" r="8" fill="${paint}"/>` +
          `<path d="M33 46 C36 38 44 33 52 33 C58 30 66 30 72 33 C80 33 86 38 87 45 C84 39 76 35 60 35 C44 35 36 40 33 46 Z" fill="${paint}"/>` +
          `<circle cx="48" cy="24" r="2.1" fill="${luce}" opacity=".65"/><circle cx="63" cy="20" r="2.4" fill="${luce}" opacity=".65"/>` +
          `<circle cx="76" cy="27" r="1.9" fill="${luce}" opacity=".6"/><circle cx="38" cy="33" r="1.7" fill="${luce}" opacity=".55"/>`,
      };
    case "lungo":
      /* I capelli lunghi sono una massa morbida che incornicia il viso e
       * scende DIETRO le spalle, con l'orlo che finisce a onde: davanti
       * restano la riga e due ciocche, mai un casco a strisce. */
      return {
        back:
          `<path d="M27 92 C23 54 30 18 60 17 C90 18 97 54 93 92 C90 97 86 96 84 92 C82 96 78 96 76 92 C74 96 70 96 68 92 C66 96 54 96 52 92 C50 96 46 96 44 92 C42 96 38 96 36 92 C34 96 30 97 27 92 Z" fill="${paint}"/>` +
          `<path d="M31 52 C29 70 31 84 35 93 M89 52 C91 70 89 84 85 93" stroke="${scuro}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".4"/>` +
          `<path d="M36 58 C34 74 36 86 39 93" stroke="${luce}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".35"/>` +
          ciocca("M31 60 C31 72 32 82 34 89", 0.35) +
          ciocca("M89 60 C89 72 88 82 86 89", 0.35),
        front:
          front(
            "M32 46 C31 24 45 12 60 12 C75 12 89 24 88 46 C87 31 79 22 68 21 C72 26 73 31 70 35 C66 25 63 22 60 22 C57 22 54 25 50 35 C47 31 48 26 52 21 C41 22 33 31 32 46 Z",
          ) +
          ciocca("M42 22 C49 16 58 14 66 16") +
          ciocca("M70 22 C76 25 79 30 80 38", 0.4),
      };
    case "caschetto":
      /* Il caschetto e' un pezzo solo: la frangia, le due tende che scendono
       * lungo le guance e si chiudono in dentro sulla mascella, il bob
       * scuro dietro il collo. */
      return {
        back: ombra(
          "M33 76 C29 44 42 18 60 18 C78 18 91 44 87 76 C84 81 80 80 79 76 C81 52 74 36 60 36 C46 36 39 52 41 76 C40 80 36 81 33 76 Z",
        ),
        front:
          front(
            "M31 66 C28 34 42 13 60 13 C78 13 92 34 89 66 C90 73 84 76 81 71 C82 60 82 50 79 42 C75 32 68 27 60 27 C52 27 45 32 41 42 C38 50 38 60 39 71 C36 76 30 73 31 66 Z",
          ) +
          ombra(
            "M41 42 C45 32 52 27 60 27 C52 29 46 34 43 44 C41 52 40 60 40 68 L39 68 C38 58 38 49 41 42 Z",
          ) +
          ciocca("M46 21 C52 16 63 15 71 19") +
          ciocca("M36 40 C38 32 43 26 49 23", 0.4) +
          ciocca("M84 44 C83 36 79 29 73 24", 0.4),
      };
    case "coda":
      /* La coda: la massa raccolta all'indietro e il codino che scende dietro
       * la spalla, con l'elastico che si vede. */
      return {
        back:
          `<path d="M74 32 C88 34 95 48 93 66 C92 78 88 88 84 94 C86 82 86 68 82 58 C78 48 74 40 74 32 Z" fill="${paint}"/>` +
          `<ellipse cx="79" cy="38" rx="4.6" ry="3.2" fill="${scuro}"/>`,
        front:
          front(
            "M31 46 C29 23 45 12 60 12 C77 12 90 22 89 44 C86 33 80 26 69 25 C56 23 44 27 39 34 C35 39 32 42 31 46 Z",
          ) +
          ciocca("M40 27 C48 19 60 16 70 19") +
          ciocca("M36 35 C42 28 50 24 58 23", 0.4),
      };
    case "afro":
      /* La corona piena: cerchi grandi che si toccano, con la luce sopra. */
      return {
        back: `<circle cx="60" cy="30" r="31" fill="${scuro}"/>`,
        front:
          `<circle cx="38" cy="30" r="15" fill="${paint}"/><circle cx="60" cy="20" r="17" fill="${paint}"/>` +
          `<circle cx="82" cy="30" r="15" fill="${paint}"/><circle cx="30" cy="45" r="11" fill="${paint}"/>` +
          `<circle cx="90" cy="45" r="11" fill="${paint}"/>` +
          `<path d="M31 47 C34 36 45 30 60 30 C75 30 86 36 89 47 C84 39 74 35 60 35 C46 35 36 39 31 47 Z" fill="${paint}"/>` +
          `<circle cx="48" cy="20" r="2.6" fill="${luce}" opacity=".5"/><circle cx="66" cy="15" r="3" fill="${luce}" opacity=".5"/>`,
      };
    case "pettinato":
      /* La riga di lato, tirata all'indietro: una calotta piena che copre la
       * fronte fino alle tempie, con la scriminatura a sinistra e la luce che
       * corre sull'onda. E' il taglio del personaggio in giacca. */
      return {
        back: `<path d="M30 44 C30 20 44 11 60 11 C77 11 90 20 90 44 C90 34 84 26 74 22 C64 18 46 20 38 28 C33 33 30 38 30 44 Z" fill="${scuro}"/>`,
        front:
          front(
            "M29 47 C28 21 44 10 61 10 C79 10 91 21 91 46 C88 36 84 29 77 25 C70 21 61 20 54 23 C61 27 64 32 63 38 C57 30 48 28 41 32 C35 35 31 41 29 47 Z",
          ) +
          ciocca("M44 22 C53 16 66 15 76 20") +
          ciocca("M40 30 C49 23 62 21 73 25", 0.45) +
          ciocca("M36 38 C43 32 52 29 60 30", 0.3),
      };
    case "calvo":
      /* Niente capelli: solo la luce sulla testa, che senza di loro si vede. */
      return {
        back: "",
        front: `<ellipse cx="52" cy="26" rx="13" ry="6" fill="#fff" opacity=".16"/>`,
      };
    case "chignon":
      return {
        back:
          `<circle cx="60" cy="12" r="10.5" fill="${paint}"/>` +
          `<path d="M52 8 C56 4 64 4 68 8" stroke="${luce}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".55"/>` +
          `<ellipse cx="60" cy="19" rx="7" ry="2.6" fill="${scuro}"/>`,
        front:
          front(
            "M31 46 C29 24 45 14 60 14 C75 14 91 24 89 46 C87 35 81 28 70 27 C58 25 46 28 41 35 C36 39 33 42 31 46 Z",
          ) +
          ciocca("M42 25 C50 19 62 18 71 22") +
          ciocca("M37 34 C42 28 49 25 56 24", 0.4),
      };
    case "corto":
    default:
      return {
        back: "",
        front:
          front(
            "M31 47 C29 22 45 12 60 12 C75 12 91 22 89 47 C87 36 82 28 72 27 C60 25 46 29 41 35 C36 40 33 43 31 47 Z",
          ) +
          ombra("M31 47 C33 41 37 36 43 33 C39 38 36 42 34 47 Z") +
          ciocca("M44 22 C52 16 63 15 71 19") +
          ciocca("M49 29 C55 25 62 24 68 26", 0.4),
      };
  }
}
/* Gli occhi: la sclera con la sua ombra, l'iride col cerchio limbare e i
 * raggi, la pupilla, due luci, la piega della palpebra e le ciglia. Si
 * disegna l'occhio sinistro e il destro e' il suo specchio. */
const EYE_SIZES = Object.freeze({
  normali: { rx: 8.2, ry: 9, iris: 4.9, pupil: 2.4, lid: 0 },
  grandi: { rx: 9.4, ry: 10.4, iris: 5.6, pupil: 2.7, lid: 0 },
  assonnati: { rx: 8.4, ry: 9.2, iris: 5, pupil: 2.4, lid: 4.6 },
  stretti: { rx: 8.8, ry: 6.4, iris: 4.6, pupil: 2.2, lid: 1.2 },
});

function eyesMarkup(style, eyeGradId, skin, eyeColor) {
  const ink = "#22303f";
  const lash = "#2b1f16";
  if (style === "sorridenti") {
    const arco =
      `<path d="M38 55 C42.4 47.2 51.6 47.2 56 55" stroke="${lash}" stroke-width="3.6" stroke-linecap="round" fill="none"/>` +
      `<path d="M39.6 50 C43 46.6 51 46.6 54.4 50" stroke="${lash}" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".4"/>` +
      `<path d="M37 52.6 L34 50.8" stroke="${lash}" stroke-width="2" stroke-linecap="round"/>`;
    return arco + specchia(arco);
  }
  const { rx, ry, iris, pupil, lid } = EYE_SIZES[style] || EYE_SIZES.normali;
  const cx = 46.5;
  const cy = 54;
  const cyIris = cy + 0.8;
  const limbo = darken(eyeColor, 0.52);
  const occhio =
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" stroke="rgba(34,48,63,.16)" stroke-width=".8"/>` +
    /* L'ombra della palpebra dentro il bianco: e' lei a rendere l'occhio
     * una sfera invece di un cerchio. */
    `<path d="M${cx - rx + 1} ${cy - 3} Q${cx} ${cy - 7.6} ${cx + rx - 1} ${cy - 3} Q${cx} ${cy - 3.6} ${cx - rx + 1} ${cy - 3} Z" fill="#22303f" opacity=".15"/>` +
    `<circle cx="${cx}" cy="${cyIris}" r="${iris}" fill="url(#${eyeGradId})"/>` +
    /* I raggi dell'iride: un cerchio tratteggiato spesso quanto il raggio
     * disegna le fibre senza doverle contare a mano. */
    `<circle cx="${cx}" cy="${cyIris}" r="${iris * 0.56}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="${(iris * 0.86).toFixed(2)}" stroke-dasharray="1 1.7"/>` +
    `<circle cx="${cx}" cy="${cyIris}" r="${iris}" fill="none" stroke="${limbo}" stroke-width="1" opacity=".75"/>` +
    `<circle cx="${cx}" cy="${cyIris}" r="${pupil}" fill="${ink}"/>` +
    `<circle cx="${cx - 1.8}" cy="${cyIris - 2.4}" r="${(iris * 0.36).toFixed(2)}" fill="#fff"/>` +
    `<circle cx="${cx + 1.8}" cy="${cyIris + 1.9}" r=".9" fill="#fff" opacity=".8"/>` +
    /* La palpebra che scende: negli occhi assonnati copre mezza iride. */
    (lid
      ? `<path d="M${cx - rx - 1} ${cy - ry - 2} L${cx + rx + 1} ${cy - ry - 2} L${cx + rx + 1} ${cy - ry + lid} C${cx + 2.5} ${cy - ry + lid + 2.4} ${cx - 2.5} ${cy - ry + lid + 2.4} ${cx - rx - 1} ${cy - ry + lid} Z" fill="${skin.base}"/>` +
        `<path d="M${cx - rx - 1} ${cy - ry + lid} C${cx - 2.5} ${cy - ry + lid + 2.4} ${cx + 2.5} ${cy - ry + lid + 2.4} ${cx + rx + 1} ${cy - ry + lid}" fill="none" stroke="${lash}" stroke-width="2.1" stroke-linecap="round"/>`
      : `<path d="M${cx - rx + 1.4} ${cy - ry + 2.6} C${cx - 2.6} ${cy - ry - 1.2} ${cx + 3.6} ${cy - ry - 1} ${cx + rx - 1.4} ${cy - ry + 2.4}" stroke="${lash}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".9"/>`) +
    /* La piega sopra la palpebra e la linea sotto: due segni sottili, ma
     * senza di loro l'occhio resta un adesivo appiccicato sulla faccia. */
    `<path d="M${cx - rx + 1.6} ${cy - ry - 1.6} C${cx - 2} ${cy - ry - 4.6} ${cx + 3} ${cy - ry - 4.4} ${cx + rx - 1} ${cy - ry - 0.4}" stroke="${skin.shade}" stroke-width="1.1" fill="none" opacity=".55"/>` +
    `<path d="M${cx - rx + 2.4} ${cy + ry + 1.2} C${cx - 1} ${cy + ry + 2.6} ${cx + 2} ${cy + ry + 2.4} ${cx + rx - 1.6} ${cy + ry - 0.4}" stroke="${skin.shade}" stroke-width=".9" fill="none" opacity=".45"/>` +
    `<path d="M${cx - rx + 0.4} ${cy - ry + 2.6} L${cx - rx - 2} ${cy - ry + 1.2}" stroke="${lash}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
  return occhio + specchia(occhio);
}

/* Le sopracciglia: sei forme, ognuna un'espressione. Si disegna la sinistra e
 * la destra e' il suo specchio — a mano non verrebbero mai uguali. */
const BROW_PATHS = Object.freeze({
  naturali:
    "M38 42.8 C40.5 38.2 48.5 37 53.8 39.8 C55 40.9 54.6 42.6 53 42.5 C48.2 41.6 43.4 42.2 40.2 44.6 C38.8 45.3 37.6 44.1 38 42.8 Z",
  folte:
    "M36.4 43.8 C39.2 36.8 49.4 35.2 55.2 39.2 C56.8 40.4 56.2 44 54 43.8 C48.4 41.2 42.8 42.2 39.4 46.4 C37.6 47.8 35.4 45.8 36.4 43.8 Z",
  sottili:
    "M38.8 43.6 C42.2 40 49 39.2 53.6 41.2 C54.6 41.7 54.4 43 53.2 42.8 C48.6 41.7 43.8 42.5 40.6 44.8 C39.6 45.4 38.2 44.6 38.8 43.6 Z",
  arcuate:
    "M37.8 45 C39.2 37.2 48.8 34.4 54.6 38.8 C55.9 39.8 55.2 42.6 53.5 42.1 C48.4 39.2 43.6 40.4 40.4 45.8 C39.4 47.2 37.4 46.6 37.8 45 Z",
  dritte:
    "M38.2 40.9 L54 40.4 C55.3 40.4 55.5 43.2 54.2 43.4 L38.9 44.4 C37.4 44.4 37 41 38.2 40.9 Z",
  corrucciate:
    "M38.2 39.8 C41.8 38.9 49.6 41.2 54.6 44.4 C55.9 45.3 54.9 47.6 53.2 46.9 C48 44.1 43 42.5 39.2 43.3 C37.5 43.6 36.7 40.2 38.2 39.8 Z",
});

function browsMarkup(style, color) {
  const d = BROW_PATHS[style] || BROW_PATHS.naturali;
  const uno =
    `<path d="${d}" fill="${color}" opacity=".95"/>` + `<path d="${d}" fill="#fff" opacity=".1"/>`;
  return uno + specchia(uno);
}

/* Il naso: dorso, punta e narici. E' il pezzo che in una faccia disegnata si
 * dimentica sempre, ed e' quello che la fa sembrare vera. */
function noseMarkup(style, skin) {
  const ombra = skin.shade;
  const narice = darken(ombra, 0.72);
  const misure = {
    dritto: { top: 47, tip: 62.8, larga: 3.6, ali: 3.4, su: 0 },
    piccolo: { top: 50, tip: 60.8, larga: 2.8, ali: 2.7, su: 0 },
    pronunciato: { top: 44.5, tip: 65, larga: 4, ali: 3.6, su: 0 },
    largo: { top: 47, tip: 63, larga: 4.8, ali: 4.6, su: 0 },
    allinsu: { top: 48, tip: 61.4, larga: 3.4, ali: 3.6, su: 1.6 },
  }[style] || { top: 47, tip: 62.8, larga: 3.6, ali: 3.4, su: 0 };
  const { top, tip, larga, ali, su } = misure;
  return (
    /* Il dorso: una sola ombra morbida sul lato in penombra. */
    `<path d="M58.4 ${top} C57.2 ${(top + tip) / 2} ${60 - larga - 0.6} ${tip - 3} ${60 - larga} ${tip - 0.6}" stroke="${ombra}" stroke-width="1.7" stroke-linecap="round" fill="none" opacity=".38"/>` +
    /* La punta: una goccia in ombra con la sua luce sopra. */
    `<path d="M${60 - larga} ${tip} C${60 - larga + 0.6} ${tip + 2.8} ${60 + larga - 0.6} ${tip + 2.8} ${60 + larga} ${tip} C${60 + larga - 1.2} ${tip + 1.7} ${60 - larga + 1.2} ${tip + 1.7} ${60 - larga} ${tip} Z" fill="${ombra}" opacity=".9"/>` +
    `<ellipse cx="59.2" cy="${tip - 1.5}" rx="${(larga * 0.5).toFixed(2)}" ry="1" fill="#fff" opacity=".3"/>` +
    /* Le narici: due, e nella versione all'insu' si vedono di piu'. */
    `<ellipse cx="${60 - ali}" cy="${tip + 1.2 - su}" rx="1.1" ry="${(0.7 + su * 0.4).toFixed(2)}" fill="${narice}" opacity=".55" transform="rotate(-18 ${60 - ali} ${tip + 1.2 - su})"/>` +
    `<ellipse cx="${60 + ali}" cy="${tip + 1.2 - su}" rx="1.1" ry="${(0.7 + su * 0.4).toFixed(2)}" fill="${narice}" opacity=".55" transform="rotate(18 ${60 + ali} ${tip + 1.2 - su})"/>`
  );
}

/* Le orecchie: conca, bordo e lobo. Stanno dietro alla testa, cosi' il bordo
 * del viso le taglia come fa una testa vera. */
function earsMarkup(style, skin, shape) {
  const misure = {
    normali: { r: 6.5, dx: 0 },
    sporgenti: { r: 8.4, dx: -2.4 },
    piccole: { r: 4.5, dx: 1.8 },
  };
  const { r, dx } = misure[style] || misure.normali;
  const x = shape.ear + dx;
  const y = shape.earY;
  const uno =
    `<ellipse cx="${x}" cy="${y}" rx="${(r * 0.88).toFixed(2)}" ry="${r}" fill="${skin.base}"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${(r * 0.88).toFixed(2)}" ry="${r}" fill="none" stroke="${skin.shade}" stroke-width=".9" opacity=".5"/>` +
    `<path d="M${x + 1.4} ${(y - r * 0.5).toFixed(2)} C${x - 1.4} ${(y - r * 0.2).toFixed(2)} ${x - 1.4} ${(y + r * 0.3).toFixed(2)} ${x + 1} ${(y + r * 0.52).toFixed(2)}" fill="none" stroke="${skin.shade}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`;
  return uno + specchia(uno);
}

/* La bocca: labbro di sopra e di sotto col loro volume, e il colore che si
 * sceglie — naturale o rossetto. Il sorriso ha i denti, la risata anche la
 * lingua: e' quello a dare l'aria da personaggio invece che da faccina. */
function mouthMarkup(style, lip) {
  const dentro = darken(lip, 0.42);
  const luce = lighten(lip, 0.5);
  const lingua = lighten(lip, 0.22);
  if (style === "risata")
    return (
      `<path d="M46 69 C53 84 67 84 74 69 C65 72 55 72 46 69 Z" fill="${dentro}"/>` +
      `<path d="M48 70 C55 73.4 65 73.4 72 70 C70 73.4 66 75 60 75 C54 75 50 73.4 48 70 Z" fill="#fff"/>` +
      `<path d="M53 78.4 C56 81.4 64 81.4 67 78.4 C64 77 56 77 53 78.4 Z" fill="${lingua}"/>` +
      `<path d="M45.4 68.4 C53 71.6 67 71.6 74.6 68.4" stroke="${lip}" stroke-width="2.2" stroke-linecap="round" fill="none"/>` +
      `<path d="M47.6 80.6 C52 84.6 68 84.6 72.4 80.6" stroke="${lip}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".85"/>`
    );
  if (style === "neutra")
    return (
      `<path d="M50 71.4 C53.4 68.4 56.6 70.6 60 70.6 C63.4 70.6 66.6 68.4 70 71.4 C66.6 72.6 53.4 72.6 50 71.4 Z" fill="${lip}"/>` +
      `<path d="M50 71.8 C54 75.6 66 75.6 70 71.8 C66.6 71 53.4 71 50 71.8 Z" fill="${lip}"/>` +
      `<path d="M53.4 73.6 C56.6 75 63.4 75 66.6 73.6 C63.4 74.4 56.6 74.4 53.4 73.6 Z" fill="${luce}" opacity=".5"/>` +
      `<path d="M50.6 71.6 L69.4 71.6" stroke="${dentro}" stroke-width=".9" stroke-linecap="round" opacity=".7"/>`
    );
  if (style === "sorrisetto")
    return (
      `<path d="M51 72.4 C57.6 77.2 66.4 75 70.4 68.8" stroke="${lip}" stroke-width="3.2" stroke-linecap="round" fill="none"/>` +
      `<path d="M52.4 74.6 C57.8 78 64.4 76.4 68 71.6" stroke="${luce}" stroke-width="1.4" stroke-linecap="round" fill="none" opacity=".45"/>`
    );
  if (style === "imbronciata")
    return (
      `<path d="M51 70.6 C54.4 67.2 57 69.6 60 69.6 C63 69.6 65.6 67.2 69 70.6 C65 72.2 55 72.2 51 70.6 Z" fill="${lip}"/>` +
      `<path d="M51 71.2 C54.6 77 65.4 77 69 71.2 C65 69.8 55 69.8 51 71.2 Z" fill="${lip}"/>` +
      `<path d="M54.6 73.4 C57.4 75.4 62.6 75.4 65.4 73.4 C62.6 74.4 57.4 74.4 54.6 73.4 Z" fill="${luce}" opacity=".55"/>` +
      `<path d="M50.4 70.4 C49.4 68.8 49.6 67.8 50.6 67.2 M69.6 70.4 C70.6 68.8 70.4 67.8 69.4 67.2" stroke="${dentro}" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".55"/>`
    );
  if (style === "aperta")
    return (
      `<ellipse cx="60" cy="73" rx="5.4" ry="6.4" fill="${dentro}"/>` +
      `<ellipse cx="60" cy="73" rx="5.4" ry="6.4" fill="none" stroke="${lip}" stroke-width="2.4"/>` +
      `<path d="M55.4 70.4 C57.4 69 62.6 69 64.6 70.4 C62.6 70 57.4 70 55.4 70.4 Z" fill="#fff" opacity=".9"/>` +
      `<ellipse cx="60" cy="77.6" rx="2.6" ry="1.5" fill="${lingua}" opacity=".9"/>`
    );
  return (
    `<path d="M48 69 C53 78 67 78 72 69 C65 71.6 55 71.6 48 69 Z" fill="${dentro}"/>` +
    `<path d="M50 69.8 C56 72 64 72 70 69.8 C68 72.2 64 73.4 60 73.4 C56 73.4 52 72.2 50 69.8 Z" fill="#fff"/>` +
    `<path d="M47.4 68.4 C53 71.4 67 71.4 72.6 68.4" stroke="${lip}" stroke-width="2.1" stroke-linecap="round" fill="none"/>` +
    `<path d="M49.4 75.4 C53.6 79.2 66.4 79.2 70.6 75.4" stroke="${lip}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".9"/>` +
    `<path d="M54 77.6 C56.8 78.8 63.2 78.8 66 77.6" stroke="${luce}" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".5"/>`
  );
}

/* La barba non e' una toppa piatta: ha lo strato pieno, un velo piu' chiaro
 * che le da' volume, e qualche pelo disegnato — e' la texture a farla vera. */
function beardMarkup(style, color) {
  const chiaro = lighten(color, 0.14);
  const scuro = darken(color, 0.78);
  const pelo = (d) =>
    `<path d="${d}" stroke="${scuro}" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".55"/>`;
  if (style === "incolta")
    /* L'ombra di barba: non un blocco pieno, una velatura fitta di puntini
     * sul mento e sulle guance — quella di chi non si e' rasato da due
     * giorni. */
    return (
      `<path d="M33 54 C34 82 46 92 60 92 C74 92 86 82 87 54 C85 76 73 84 60 84 C47 84 35 76 33 54 Z" fill="${color}" opacity=".34"/>` +
      `<path d="M45 66 C49 60 57 61 60 64 C63 61 71 60 75 66 C71 69 63.5 68 60 65.5 C56.5 68 49 69 45 66 Z" fill="${color}" opacity=".5"/>` +
      pelo("M44 70 C45 74 47 78 50 81") +
      pelo("M76 70 C75 74 73 78 70 81") +
      pelo("M56 84 L56.4 88") +
      pelo("M64 84 L63.6 88")
    );
  if (style === "baffi")
    return (
      `<path d="M45 66 C49 59.5 57 60.5 60 64 C63 60.5 71 59.5 75 66 C71 69.5 63.5 68.5 60 65.5 C56.5 68.5 49 69.5 45 66 Z" fill="${color}"/>` +
      `<path d="M48 64.5 C52 61.5 57 62 60 64.5 C63 62 68 61.5 72 64.5 C68 63 63 63 60 65 C57 63 52 63 48 64.5 Z" fill="${chiaro}" opacity=".5"/>` +
      pelo("M50 63.5 C52 62.6 54 62.5 56 63") +
      pelo("M64 63 C66 62.5 68 62.6 70 63.5")
    );
  if (style === "pizzetto")
    return (
      `<path d="M50 78 C50 89 70 89 70 78 C68 84 52 84 50 78 Z" fill="${color}"/>` +
      `<path d="M56.5 73.5 C57.5 76.5 62.5 76.5 63.5 73.5 C62 74.9 58 74.9 56.5 73.5 Z" fill="${color}"/>` +
      `<path d="M53 80 C55 84 65 84 67 80 C64 82 56 82 53 80 Z" fill="${chiaro}" opacity=".45"/>` +
      pelo("M56 81 L56.6 84") +
      pelo("M60 82 L60 85.2") +
      pelo("M64 81 L63.4 84")
    );
  if (style === "piena")
    return (
      `<path d="M31 52 C32 84 46 95 60 95 C74 95 88 84 89 52 C87 78 74 86 60 86 C46 86 33 78 31 52 Z" fill="${color}"/>` +
      `<path d="M35 62 C38 80 48 89 60 90 C72 89 82 80 85 62 C83 78 72 84 60 84 C48 84 37 78 35 62 Z" fill="${chiaro}" opacity=".35"/>` +
      `<path d="M45 66 C49 59.5 57 60.5 60 64 C63 60.5 71 59.5 75 66 C71 69.5 63.5 68.5 60 65.5 C56.5 68.5 49 69.5 45 66 Z" fill="${color}"/>` +
      pelo("M41 72 C42 76 44 79 47 82") +
      pelo("M79 72 C78 76 76 79 73 82") +
      pelo("M55 86 L55.5 90") +
      pelo("M65 86 L64.5 90")
    );
  return "";
}

function glassesMarkup(style) {
  const riflesso = (d) =>
    `<path d="${d}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".55" fill="none"/>`;
  if (style === "tondi")
    return (
      `<g stroke="#243244" stroke-width="2.6" fill="none">` +
      `<circle cx="46.5" cy="54" r="10.5"/><circle cx="73.5" cy="54" r="10.5"/>` +
      `<path d="M56.5 53 C58.2 51 61.8 51 63.5 53"/><path d="M36.5 52.5 L30.5 49.5"/><path d="M83.5 52.5 L89.5 49.5"/></g>` +
      riflesso("M41 49 L47 46.6")
    );
  if (style === "squadrati")
    return (
      `<g stroke="#243244" stroke-width="2.6" fill="none">` +
      `<rect x="35.5" y="45.5" width="22" height="17" rx="4.5"/><rect x="62.5" y="45.5" width="22" height="17" rx="4.5"/>` +
      `<path d="M57.5 53 C58.6 51.4 61.4 51.4 62.5 53"/><path d="M35.5 51 L30 48.5"/><path d="M84.5 51 L90 48.5"/></g>` +
      riflesso("M38 48 L44 46")
    );
  if (style === "lettura")
    /* Gli occhiali da lettura: mezzelune basse sul naso, quelle da cui si
     * guarda sopra la montatura. */
    return (
      `<g stroke="#8a6a3f" stroke-width="2.2" fill="none">` +
      `<path d="M37 55 L56 55 C56 62.4 51.4 65.6 46.5 65.6 C41.6 65.6 37 62.4 37 55 Z"/>` +
      `<path d="M64 55 L83 55 C83 62.4 78.4 65.6 73.5 65.6 C68.6 65.6 64 62.4 64 55 Z"/>` +
      `<path d="M56 55 C58 53.6 62 53.6 64 55"/><path d="M37 55 L31.5 51.5"/><path d="M83 55 L88.5 51.5"/></g>` +
      riflesso("M40 57.4 L45 56.6")
    );
  if (style === "aviatore")
    return (
      `<g fill="#9fb4cc" fill-opacity=".38" stroke="#5b6c82" stroke-width="2.2">` +
      `<path d="M35.5 47 L57 47 C57.6 57.4 52.6 64.6 46 64.6 C39.6 64.6 35 57.6 35.5 47 Z"/>` +
      `<path d="M84.5 47 L63 47 C62.4 57.4 67.4 64.6 74 64.6 C80.4 64.6 85 57.6 84.5 47 Z"/></g>` +
      `<path d="M57 48.6 C58.6 47.4 61.4 47.4 63 48.6 M35.5 47.6 L30 45.6 M84.5 47.6 L90 45.6" stroke="#5b6c82" stroke-width="2.2" fill="none"/>` +
      riflesso("M39 51 L46 48.6")
    );
  if (style === "sole")
    return (
      `<g><circle cx="46.5" cy="54" r="10.5" fill="#1f2733" opacity=".92"/><circle cx="73.5" cy="54" r="10.5" fill="#1f2733" opacity=".92"/>` +
      `<path d="M56.5 53 C58.2 51 61.8 51 63.5 53" stroke="#1f2733" stroke-width="2.6" fill="none"/>` +
      `<path d="M42 49.5 L49 47.5" stroke="#5c6c80" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M36.5 52.5 L30.5 49.5 M83.5 52.5 L89.5 49.5" stroke="#1f2733" stroke-width="2.6"/></g>`
    );
  return "";
}

/* I segni sulla pelle: le lentiggini, un neo, le fossette. Piccoli, ma sono
 * quelli che si riconoscono da lontano. */
function marksMarkup(style, skin) {
  if (style === "lentiggini") {
    const punto = (cx, cy, r) =>
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${darken(skin.shade, 0.72)}" opacity=".5"/>`;
    const guancia =
      punto(45.4, 63.4, 0.85) +
      punto(41.8, 65.6, 0.7) +
      punto(48.2, 66.4, 0.75) +
      punto(44, 68.2, 0.6) +
      punto(55.4, 60.6, 0.55);
    return guancia + specchia(guancia);
  }
  if (style === "neo")
    return (
      `<circle cx="69.6" cy="70.4" r="1.6" fill="#4e3520" opacity=".92"/>` +
      `<circle cx="69.1" cy="69.9" r=".55" fill="#fff" opacity=".22"/>`
    );
  if (style === "fossette") {
    const uno = `<path d="M46.4 69.4 C44.2 72.4 44.8 76.4 47.2 79" stroke="${darken(skin.shade, 0.86)}" stroke-width="1.7" stroke-linecap="round" fill="none" opacity=".7"/>`;
    return uno + specchia(uno);
  }
  return "";
}

/* Gli anni: la piega fra naso e bocca, le righe sulla fronte, le zampe di
 * gallina. Non cambiano i tratti, cambiano quanto si sono usati. */
function ageMarkup(style, skin) {
  if (style === "giovane") return "";
  const segno = (d, width, opacity) =>
    `<path d="${d}" stroke="${skin.shade}" stroke-width="${width}" stroke-linecap="round" fill="none" opacity="${opacity}"/>`;
  const naso = segno(
    "M54 65 C50.8 68.8 50.2 73.4 51.8 76.8",
    1.4,
    style === "maturo" ? 0.62 : 0.34,
  );
  if (style === "adulto") return naso + specchia(naso);
  const zampe =
    segno("M36.6 51.6 L33 49.8 M36.4 54.4 L32.6 53.8 M36.8 57 L33.4 57.8", 1.1, 0.5) +
    segno("M40.4 64.6 C43.4 66.6 48.6 66.8 52 65.4", 1, 0.35);
  const fronte =
    segno("M43.6 33.4 C50 30.8 70 30.8 76.4 33.4", 1.2, 0.4) +
    segno("M45.4 38.4 C51.4 36.2 68.6 36.2 74.6 38.4", 1.1, 0.32) +
    segno("M57.6 40.6 L57.2 36.2 M62.4 40.6 L62.8 36.2", 1, 0.28);
  return naso + specchia(naso) + zampe + specchia(zampe) + fronte;
}

/* Il copricapo: prende il colore del vestito. Sta sopra ai capelli, come un
 * cappello vero — e la testa sotto resta quella che si e' scelta. */
function hatMarkup(style, fill) {
  const ombra = `<path d="M31 37 C42 32 78 32 89 37 L89 40 C78 35 42 35 31 40 Z" fill="#000" opacity=".16"/>`;
  if (style === "berretto")
    return (
      `<path d="M28 35 C28 14 40 5 60 5 C80 5 92 14 92 35 C78 28 42 28 28 35 Z" fill="${fill}"/>` +
      `<path d="M28 35 C28 14 40 5 60 5 C80 5 92 14 92 35 C78 28 42 28 28 35 Z" fill="url(#dmFaceBust)"/>` +
      `<path d="M44 7.6 C44 20 44 27 44 30.6 M60 5 L60 28.6 M76 7.6 C76 20 76 27 76 30.6" stroke="#000" stroke-width="1.2" opacity=".14" fill="none"/>` +
      `<rect x="26" y="29" width="68" height="11" rx="5.5" fill="${fill}"/>` +
      `<rect x="26" y="29" width="68" height="11" rx="5.5" fill="#fff" opacity=".18"/>` +
      `<circle cx="60" cy="3.4" r="4.6" fill="${fill}"/><circle cx="58.6" cy="2.2" r="1.8" fill="#fff" opacity=".35"/>` +
      ombra
    );
  if (style === "cappello")
    return (
      `<path d="M30 34 C30 15 42 6 60 6 C78 6 90 15 90 34 C78 27 42 27 30 34 Z" fill="${fill}"/>` +
      `<path d="M30 34 C30 15 42 6 60 6 C78 6 90 15 90 34 C78 27 42 27 30 34 Z" fill="url(#dmFaceBust)"/>` +
      `<path d="M60 6 C57 16 56 26 56 30.6" stroke="#000" stroke-width="1.2" opacity=".14" fill="none"/>` +
      `<path d="M31 31.4 C20 33.4 12 38 10.6 43.4 C23 42.4 35 38.8 42.4 34.2 Z" fill="${fill}"/>` +
      `<path d="M31 31.4 C20 33.4 12 38 10.6 43.4 C23 42.4 35 38.8 42.4 34.2 Z" fill="#000" opacity=".2"/>` +
      `<circle cx="60" cy="7.6" r="2.6" fill="#fff" opacity=".3"/>` +
      ombra
    );
  if (style === "bandana")
    return (
      `<path d="M29 36 C29 16 41 7 60 7 C79 7 91 16 91 36 C77 29 43 29 29 36 Z" fill="${fill}"/>` +
      `<path d="M29 36 C29 16 41 7 60 7 C79 7 91 16 91 36 C77 29 43 29 29 36 Z" fill="url(#dmFaceBust)"/>` +
      `<path d="M38 14 C46 9.6 60 8.6 70 11.6 M34 22 C44 16.6 62 15.6 76 19" stroke="#fff" stroke-width="1.6" opacity=".3" fill="none"/>` +
      `<path d="M87 27 L98 23 L94.6 32.6 L102 35 L88.4 37.6 Z" fill="${fill}"/>` +
      `<path d="M87 27 L98 23 L94.6 32.6 L102 35 L88.4 37.6 Z" fill="#000" opacity=".14"/>` +
      ombra
    );
  if (style === "fascia")
    return (
      `<path d="M30.5 32.6 C42 25.4 78 25.4 89.5 32.6 L88.6 40.6 C77 33.4 43 33.4 31.4 40.6 Z" fill="${fill}"/>` +
      `<path d="M30.5 32.6 C42 25.4 78 25.4 89.5 32.6 L88.6 40.6 C77 33.4 43 33.4 31.4 40.6 Z" fill="url(#dmFaceBust)"/>` +
      `<path d="M34 34.6 C45 29 75 29 86 34.6" stroke="#fff" stroke-width="1.4" opacity=".3" fill="none"/>` +
      ombra
    );
  return "";
}

/* Il vestito, in due strati: `base` e' il busto dipinto prima del collo,
 * `front` e' cio' che sta sopra il collo — il colletto, la cravatta, il bordo
 * del cappuccio. La giacca e' il completo del riferimento: giacca scura coi
 * revers, la camicia bianca a V e la cravatta che prende il colore della
 * persona. */
function outfitMarkup(style, fill, shape, skin) {
  const busto = `<path d="${shape.bust}" fill="${fill}"/><path d="${shape.bust}" fill="url(#dmFaceBust)"/>`;
  /* Le spalle scoperte: il busto si dipinge color pelle e il vestito ci si
   * appoggia sopra, invece di ritagliare buchi nella stoffa. */
  const spalle = `<path d="${shape.bust}" fill="${skin.base}"/><path d="${shape.bust}" fill="url(#dmFaceBust)"/>`;
  switch (style) {
    case "camicia":
      return {
        base:
          busto +
          `<path d="M60 100 L60 124" stroke="#000" stroke-width="1.6" opacity=".22"/>` +
          `<circle cx="60" cy="106" r="1.2" fill="#fff" opacity=".8"/><circle cx="60" cy="113" r="1.2" fill="#fff" opacity=".8"/><circle cx="60" cy="120" r="1.2" fill="#fff" opacity=".8"/>`,
        front:
          `<path d="M47 89 L60 97 L54.5 102 L44.5 94 Z" fill="${fill}"/><path d="M47 89 L60 97 L54.5 102 L44.5 94 Z" fill="#fff" opacity=".28"/>` +
          `<path d="M73 89 L60 97 L65.5 102 L75.5 94 Z" fill="${fill}"/><path d="M73 89 L60 97 L65.5 102 L75.5 94 Z" fill="#fff" opacity=".28"/>` +
          `<path d="M47 89 L60 97 L54.5 102 M73 89 L60 97 L65.5 102" stroke="#000" stroke-width="1" fill="none" opacity=".18"/>`,
      };
    case "felpa":
      return {
        base:
          busto +
          `<path d="M46 118 C50 113 70 113 74 118 L74 124 L46 124 Z" fill="#000" opacity=".1"/>`,
        front:
          `<path d="M42 101 C44 88 76 88 78 101 C71 93 49 93 42 101 Z" fill="#000" opacity=".3"/>` +
          `<path d="M42 101 C44 88 76 88 78 101 C71 93 49 93 42 101 Z" fill="${fill}" opacity=".55"/>` +
          `<path d="M54.5 99 L53.5 111 M65.5 99 L66.5 111" stroke="#fff" stroke-width="1.7" stroke-linecap="round" opacity=".7"/>` +
          `<circle cx="53.5" cy="112.4" r="1.1" fill="#fff" opacity=".7"/><circle cx="66.5" cy="112.4" r="1.1" fill="#fff" opacity=".7"/>`,
      };
    case "giacca":
      /* Il completo: giacca scura, camicia bianca aperta a V, cravatta piena
       * col nodo — la stessa che porta il personaggio del riferimento. */
      return {
        base:
          `<path d="${shape.bust}" fill="#2f3a48"/><path d="${shape.bust}" fill="url(#dmFaceBust)"/>` +
          `<path d="M47 90 L60 110 L73 90 L73 124 L47 124 Z" fill="#f6f8fb"/>`,
        front:
          // il colletto della camicia
          `<path d="M48 88 L60 106 L72 88 L74.5 91 L60 111 L45.5 91 Z" fill="#e6eaf1"/>` +
          // i revers della giacca, larghi
          `<path d="M43 87 C42 100 45 113 48 124 L36 124 C33 108 34 95 38 86 Z" fill="#3b4756"/>` +
          `<path d="M77 87 C78 100 75 113 72 124 L84 124 C87 108 86 95 82 86 Z" fill="#3b4756"/>` +
          `<path d="M44 88 C48 98 54 106 59 111 L52 90 Z" fill="#26303c"/>` +
          `<path d="M76 88 C72 98 66 106 61 111 L68 90 Z" fill="#26303c"/>` +
          // la cravatta: nodo e lama
          `<path d="M55.6 92 L64.4 92 L62.6 99 L57.4 99 Z" fill="${fill}"/>` +
          `<path d="M57.4 99 L62.6 99 L65 116 L60 123 L55 116 Z" fill="${fill}"/>` +
          `<path d="M55.6 92 L64.4 92 L62.6 99 L57.4 99 Z" fill="#000" opacity=".12"/>` +
          `<path d="M59 101 L59.6 115" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".28"/>`,
      };
    case "polo":
      /* La polo: il colletto morbido e i due bottoni aperti. */
      return {
        base: busto,
        front:
          `<path d="M50 90 L60 99 L70 90 L67.5 88 L60 95 L52.5 88 Z" fill="#fff" opacity=".55"/>` +
          `<path d="M52 88 L60 96 L54.5 100 L47 92 Z" fill="#000" opacity=".12"/>` +
          `<path d="M68 88 L60 96 L65.5 100 L73 92 Z" fill="#000" opacity=".12"/>` +
          `<circle cx="60" cy="103" r="1.3" fill="#fff" opacity=".75"/><circle cx="60" cy="109" r="1.3" fill="#fff" opacity=".75"/>`,
      };
    case "maglione":
      /* Il maglione: il collo alto a coste e la trama in rilievo. */
      return {
        base: busto + `<path d="M30 112 L90 112" stroke="#000" stroke-width="1" opacity=".08"/>`,
        front:
          `<path d="M46 90 C50 84 70 84 74 90 C74 96 70 99 60 99 C50 99 46 96 46 90 Z" fill="#000" opacity=".16"/>` +
          `<path d="M47 92 C51 87 69 87 73 92" stroke="#fff" stroke-width="1.4" fill="none" opacity=".35"/>` +
          `<path d="M40 104 L44 118 M52 104 L54 118 M68 104 L66 118 M80 104 L76 118"
             stroke="#000" stroke-width="1.2" opacity=".08"/>`,
      };
    case "gilet":
      /* Il gilet sopra la camicia: due lembi scuri e il colletto chiaro. */
      return {
        base: busto + `<path d="M48 92 L60 104 L72 92 L72 124 L48 124 Z" fill="#f4f6f9"/>`,
        front:
          `<path d="M46 89 C40 96 38 110 39 124 L52 124 L58 100 Z" fill="#000" opacity=".26"/>` +
          `<path d="M74 89 C80 96 82 110 81 124 L68 124 L62 100 Z" fill="#000" opacity=".26"/>` +
          `<path d="M49 90 L60 102 L71 90 L69 88 L60 98 L51 88 Z" fill="#fff" opacity=".7"/>` +
          `<circle cx="60" cy="110" r="1.4" fill="#334155" opacity=".55"/>` +
          `<circle cx="60" cy="118" r="1.4" fill="#334155" opacity=".55"/>`,
      };
    case "canotta":
      /* La canottiera: spalle scoperte, due bretelle larghe e lo scollo
       * tondo. */
      return {
        base:
          spalle +
          `<path d="M40 124 C42 105 48 95 56 90 L64 90 C72 95 78 105 80 124 Z" fill="${fill}"/>` +
          `<path d="M40 124 C42 105 48 95 56 90 L64 90 C72 95 78 105 80 124 Z" fill="url(#dmFaceBust)"/>`,
        front:
          `<path d="M50 92 C54 99 66 99 70 92 C67 97 53 97 50 92 Z" fill="#000" opacity=".14"/>` +
          `<path d="M45 96 C48 92 53 90 57 89 M75 96 C72 92 67 90 63 89" stroke="#fff" stroke-width="1.2" opacity=".28" fill="none"/>`,
      };
    case "abito":
      /* L'abito con le spalline sottili e lo scollo dritto, con la sua
       * collanina. */
      return {
        base:
          spalle +
          `<path d="M36 124 C39 106 46 96 54 92 L54 88 L57 88 L57 93 L63 93 L63 88 L66 88 L66 92 C74 96 81 106 84 124 Z" fill="${fill}"/>` +
          `<path d="M36 124 C39 106 46 96 54 92 L54 88 L57 88 L57 93 L63 93 L63 88 L66 88 L66 92 C74 96 81 106 84 124 Z" fill="url(#dmFaceBust)"/>`,
        front:
          `<path d="M54 94 L66 94" stroke="#000" stroke-width="1.2" opacity=".16"/>` +
          `<path d="M52 88 C55 96 65 96 68 88" stroke="#e8c86a" stroke-width="1.3" fill="none" opacity=".9"/>` +
          `<circle cx="60" cy="95.4" r="1.7" fill="#e8c86a"/><circle cx="59.4" cy="94.8" r=".6" fill="#fff" opacity=".6"/>`,
      };
    case "tuta":
      /* La tuta sportiva: zip a tutta lunghezza, colletto in piedi e le due
       * righe sulle spalle. */
      return {
        base: busto,
        front:
          `<path d="M46 92 C50 87 70 87 74 92 L74 97 C70 92 50 92 46 97 Z" fill="#000" opacity=".26"/>` +
          `<path d="M60 96 L60 124" stroke="#000" stroke-width="2.2" opacity=".3"/>` +
          `<path d="M60 96 L60 124" stroke="#fff" stroke-width=".9" opacity=".45"/>` +
          `<circle cx="60" cy="99.4" r="1.5" fill="#e8edf4" opacity=".9"/>` +
          `<path d="M40 102 C44 96 50 93 55 91 M80 102 C76 96 70 93 65 91" stroke="#fff" stroke-width="2" opacity=".55" fill="none"/>`,
      };
    case "cardigan":
      /* Il cardigan aperto sopra la maglietta chiara: due lembi morbidi e le
       * maniche larghe. */
      return {
        base: busto + `<path d="M50 92 L60 102 L70 92 L70 124 L50 124 Z" fill="#f2f5f9"/>`,
        front:
          `<path d="M47 89 C41 97 38 110 39 124 L54 124 L59 100 Z" fill="#000" opacity=".22"/>` +
          `<path d="M73 89 C79 97 82 110 81 124 L66 124 L61 100 Z" fill="#000" opacity=".22"/>` +
          `<path d="M47 89 C43 98 41 111 42 124 M73 89 C77 98 79 111 78 124" stroke="#fff" stroke-width="1.2" opacity=".22" fill="none"/>` +
          `<path d="M50 92 L60 102 L70 92 L68 90 L60 98 L52 90 Z" fill="#fff" opacity=".55"/>` +
          `<circle cx="57" cy="108" r="1.3" fill="#334155" opacity=".5"/>` +
          `<circle cx="57.6" cy="116" r="1.3" fill="#334155" opacity=".5"/>`,
      };
    case "maglietta":
    default:
      return {
        base: busto,
        front: `<path d="M42 96 C48 90 72 90 78 96 C72 93 48 93 42 96 Z" fill="#fff" opacity=".18"/>`,
      };
  }
}
/* La corporatura: il viso si stringe o si allarga attorno al suo centro, le
 * spalle seguono, e la figura robusta prende un accenno di mento pieno. */
const FACE_BUILD_SHAPES = Object.freeze({
  normale: { sx: 1, sy: 1, bust: "M14 124 C20 96 38 88 60 88 C82 88 100 96 106 124 Z" },
  magra: { sx: 0.9, sy: 1.04, bust: "M21 124 C26 98 42 90 60 90 C78 90 94 98 99 124 Z" },
  robusta: { sx: 1.13, sy: 0.98, bust: "M8 124 C15 94 37 86 60 86 C83 86 105 94 112 124 Z" },
});

/* I tagli che lasciano la fronte scoperta non proiettano nessuna ombra. */
const SENZA_OMBRA = new Set(["rasato", "calvo"]);

/* ── La luce ──────────────────────────────────────────────────────────────
 *
 * Un personaggio renderizzato non e' fatto di contorni: e' fatto di luce che
 * cade da una parte sola, di ombra che si accumula dove la forma rientra —
 * le orbite, i lati del naso, sotto la mascella — e di un filo di luce
 * fredda sul bordo opposto, che stacca la testa dal fondo. Sono queste tre
 * cose, e non il numero dei dettagli, a fare la differenza fra un disegno e
 * un render.
 *
 * Qui ci sono per davvero, e sono sfocate: la luce non ha spigoli. Le
 * sfocature costano, pero', e l'editor ne disegna novanta in una schermata:
 * chi chiede il disegno fermo (i campioncini, il ritratto piccolo della
 * riga) riceve le stesse forme senza gli strati di luce.
 */
const LUCE_DEFS =
  `<filter id="dmFaceSoft" x="-45%" y="-45%" width="190%" height="190%"><feGaussianBlur stdDeviation="2.6"/></filter>` +
  `<filter id="dmFaceGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5.5"/></filter>` +
  `<filter id="dmFaceTiny" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation=".85"/></filter>` +
  /* L'occlusione ambientale: il bordo della testa si spegne come su una
   * sfera vera, invece di finire di netto contro il fondo. */
  `<radialGradient id="dmFaceAO" cx="45%" cy="38%" r="62%">` +
  `<stop offset="52%" stop-color="#2b1a0f" stop-opacity="0"/>` +
  `<stop offset="84%" stop-color="#2b1a0f" stop-opacity=".15"/>` +
  `<stop offset="100%" stop-color="#2b1a0f" stop-opacity=".44"/></radialGradient>` +
  /* La luce di contorno: fredda, e solo sul lato lontano dalla chiave. */
  `<linearGradient id="dmFaceRim" x1="0" y1="1" x2="1" y2="0">` +
  `<stop offset="50%" stop-color="#dcefff" stop-opacity="0"/>` +
  `<stop offset="100%" stop-color="#f2faff" stop-opacity=".95"/></linearGradient>` +
  `<linearGradient id="dmFaceSheen" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0%" stop-color="#fff" stop-opacity=".6"/>` +
  `<stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

/* Il riflesso sui capelli: la banda di luce che gira attorno alla calotta, e
 * tre ciocche accese sopra le altre. Senza, i capelli sono una massa piatta
 * col gradiente addosso. */
function hairLightMarkup(style, color) {
  if (SENZA_OMBRA.has(style)) return "";
  const luce = lighten(color, 0.52);
  const ciocca = (d, width, opacity) =>
    `<path d="${d}" stroke="${luce}" stroke-width="${width}" stroke-linecap="round" fill="none" opacity="${opacity}"/>`;
  return (
    `<path d="M37 27 C47 15 73 15 83 27 C72 20 48 20 37 27 Z" fill="url(#dmFaceSheen)" opacity=".55" filter="url(#dmFaceSoft)"/>` +
    `<g filter="url(#dmFaceTiny)">` +
    ciocca("M45 30 C51 22 62 19 71 21", 1.7, 0.5) +
    ciocca("M49 24 C56 19 65 18 72 20", 1.1, 0.35) +
    ciocca("M40 36 C44 29 50 25 57 23", 1.2, 0.3) +
    `</g>`
  );
}

/**
 * La faccia disegnata. Il fondo lo mette chi la ospita (la card ha gia' il suo
 * cerchio col colore scelto); qui c'e' il busto. Con `animated: false` l'SVG
 * porta la classe che spegne le animazioni: e' come si disegnano i campioncini
 * dell'editor, che sono decine e non devono respirare tutti insieme — e con
 * loro si spengono anche gli strati di luce sfocati, che a quaranta pixel non
 * si vedono e a novanta campioncini si sentono.
 */
export function avatarSvg(input, { animated = true, shirt = "", soft } = {}) {
  const face = normalizeFace(input);
  if (!face) return "";
  const luce = soft === undefined ? animated : Boolean(soft);
  const skin = FACE_SKINS[face.skin];
  const hairColor = FACE_HAIR_COLORS[face.hairColor];
  const eyeColor = FACE_EYE_COLORS[face.eyeColor];
  const lip = FACE_LIP_COLORS[face.lips];
  /* «Come i capelli» non e' un colore: e' un rinvio. */
  const beardColor = FACE_BEARD_COLORS[face.beardColor] || hairColor;
  const brow = darken(hairColor, 0.7);
  const personale = clean(shirt) || "var(--dm-person-color,#0ea5e9)";
  const vestito = FACE_OUTFIT_COLORS[face.outfitColor] || personale;
  const shape = FACE_BUILD_SHAPES[face.build] || FACE_BUILD_SHAPES.normale;
  const cranio = FACE_SHAPES[face.shape] || FACE_SHAPES.ovale;
  const ombra = darken(skin.shade, 0.82);
  /* I gradienti stanno nei defs con un id che dipende dalla scelta: due
   * facce con la stessa carnagione condividono la stessa definizione, due
   * carnagioni diverse non si rubano il colore. */
  const skinGradId = `dmFaceSkin-${face.skin}`;
  const hairGradId = `dmFaceHair-${face.hairColor}`;
  const eyeGradId = `dmFaceEye-${face.eyeColor}`;
  const hair = hairPaths(face.hair, hairColor, hairGradId);
  const outfit = outfitMarkup(face.outfit, vestito, shape, skin);
  const testa =
    shape.sx === 1 && shape.sy === 1
      ? ""
      : ` transform="translate(60 56) scale(${shape.sx} ${shape.sy}) translate(-60 -56)"`;
  /* Gli strati di luce, quelli che si accendono solo sul disegno vivo. */
  const occlusione = luce
    ? `<g filter="url(#dmFaceSoft)">` +
      `<ellipse cx="46.5" cy="47.4" rx="10.4" ry="5.4" fill="${ombra}" opacity=".34"/>` +
      `<ellipse cx="73.5" cy="47.4" rx="10.4" ry="5.4" fill="${ombra}" opacity=".34"/>` +
      `<path d="M40 70 C46 82 74 82 80 70 C74 89 46 89 40 70 Z" fill="${ombra}" opacity=".3"/>` +
      `<path d="M33 42 C35 55 37 64 41 71 C34 64 31 54 32 42 Z" fill="${ombra}" opacity=".34"/>` +
      `<path d="M87 42 C85 55 83 64 79 71 C86 64 89 54 88 42 Z" fill="${ombra}" opacity=".34"/>` +
      `</g>`
    : `<path d="M33 44 C35 56 37 64 41 70 C35 64 32 55 33 44 Z" fill="${skin.shade}" opacity=".28"/>` +
      `<path d="M87 44 C85 56 83 64 79 70 C85 64 88 55 87 44 Z" fill="${skin.shade}" opacity=".28"/>` +
      `<path d="M39 72 C45 83 75 83 81 72 C75 87 45 87 39 72 Z" fill="${skin.shade}" opacity=".22"/>`;
  const speculare = luce
    ? `<g filter="url(#dmFaceSoft)">` +
      `<ellipse cx="51" cy="29" rx="15.5" ry="8.4" fill="#fff" opacity=".36"/>` +
      `<ellipse cx="43.5" cy="57" rx="7.4" ry="5.2" fill="#fff" opacity=".2"/>` +
      `<ellipse cx="76" cy="57" rx="5.6" ry="4.2" fill="#fff" opacity=".13"/>` +
      `<ellipse cx="60" cy="82" rx="6.4" ry="3.4" fill="#fff" opacity=".17"/>` +
      `</g>`
    : `<ellipse cx="53" cy="30" rx="16" ry="8.5" fill="#fff" opacity=".14"/>` +
      `<ellipse cx="41" cy="60" rx="6" ry="4" fill="#fff" opacity=".08"/>` +
      `<ellipse cx="79" cy="60" rx="6" ry="4" fill="#fff" opacity=".08"/>`;
  /* Il filo di luce sul bordo, e l'ombra che il naso getta sulla guancia:
   * sono i due segni che dicono «questa faccia sta in una stanza». */
  const contorno = luce
    ? `<path d="${cranio.head}" fill="none" stroke="url(#dmFaceRim)" stroke-width="3.4" filter="url(#dmFaceSoft)"/>` +
      `<path d="${cranio.head}" fill="none" stroke="${skin.shade}" stroke-width="1.8" opacity=".26"/>`
    : `<path d="${cranio.head}" fill="none" stroke="${skin.shade}" stroke-width="2.6" opacity=".4"/>`;
  const ombraNaso = luce
    ? `<path d="M56.4 49 C53.4 57 52.4 63.4 54.6 68.4 C50.6 64 51 55.6 53.4 48.4 Z" fill="${ombra}" opacity=".26" filter="url(#dmFaceSoft)"/>`
    : "";
  return (
    `<svg class="dm-face-svg${animated ? "" : " dm-face-still"}" viewBox="0 0 120 120" aria-hidden="true">` +
    `<defs>` +
    /* La pelle: cinque fermate invece di quattro, e l'ultima piu' scura del
     * bordo — e' quella a dare lo spessore, come la pelle vera che verso il
     * bordo si allontana dalla luce. */
    `<radialGradient id="${skinGradId}" cx="40%" cy="27%" r="80%">` +
    `<stop offset="0%" stop-color="${lighten(skin.base, 0.3)}"/>` +
    `<stop offset="30%" stop-color="${lighten(skin.base, 0.13)}"/>` +
    `<stop offset="62%" stop-color="${skin.base}"/>` +
    `<stop offset="87%" stop-color="${skin.shade}"/>` +
    `<stop offset="100%" stop-color="${darken(skin.shade, 0.88)}"/>` +
    `</radialGradient>` +
    `<linearGradient id="${hairGradId}" x1=".2" y1="0" x2=".8" y2="1">` +
    `<stop offset="0%" stop-color="${lighten(hairColor, 0.42)}"/>` +
    `<stop offset="30%" stop-color="${lighten(hairColor, 0.16)}"/>` +
    `<stop offset="62%" stop-color="${hairColor}"/>` +
    `<stop offset="100%" stop-color="${darken(hairColor, 0.66)}"/>` +
    `</linearGradient>` +
    `<linearGradient id="dmFaceBust" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#fff" stop-opacity=".22"/>` +
    `<stop offset="45%" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="100%" stop-color="#000" stop-opacity=".2"/>` +
    `</linearGradient>` +
    `<radialGradient id="${eyeGradId}" cx="38%" cy="32%" r="80%">` +
    `<stop offset="0%" stop-color="${lighten(eyeColor, 0.35)}"/>` +
    `<stop offset="60%" stop-color="${eyeColor}"/>` +
    `<stop offset="100%" stop-color="${darken(eyeColor, 0.6)}"/>` +
    `</radialGradient>` +
    LUCE_DEFS +
    `</defs>` +
    `<g class="f-all">` +
    hair.back +
    outfit.base +
    /* Il collo: il cilindro in ombra sotto la mascella, e la luce davanti —
     * senza quella luce la testa sembra appoggiata su un tubo. */
    `<path d="M52 74 h16 v12 a8 8 0 0 1 -16 0 Z" fill="${skin.shade}"/>` +
    `<path d="M55 76 h10 v10 a5 5 0 0 1 -10 0 Z" fill="${skin.base}" opacity=".55"/>` +
    `<path d="M46 84 C52 90 68 90 74 84 C68 88 52 88 46 84 Z" fill="#000" opacity=".13"/>` +
    outfit.front +
    /* L'ombra della testa sul petto, e il filo di luce sulla spalla: il busto
     * smette di essere un adesivo dietro il mento. */
    (luce
      ? `<ellipse cx="60" cy="91" rx="17" ry="6" fill="#000" opacity=".22" filter="url(#dmFaceSoft)"/>` +
        `<path d="${shape.bust}" fill="none" stroke="url(#dmFaceRim)" stroke-width="3" opacity=".55" filter="url(#dmFaceSoft)"/>`
      : `<ellipse cx="60" cy="90" rx="14" ry="4.6" fill="#000" opacity=".14"/>`) +
    `<g class="f-head"${testa}>` +
    earsMarkup(face.ears, skin, cranio) +
    `<path d="${cranio.head}" fill="url(#${skinGradId})"/>` +
    `<path d="${cranio.head}" fill="url(#dmFaceAO)"/>` +
    occlusione +
    speculare +
    contorno +
    (face.build === "robusta"
      ? `<path d="M46 84 C52 89 68 89 74 84" stroke="${skin.shade}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".5"/>`
      : "") +
    browsMarkup(face.brows, brow) +
    `<g class="f-eyes">${eyesMarkup(face.eyes, eyeGradId, skin, eyeColor)}</g>` +
    ombraNaso +
    noseMarkup(face.nose, skin) +
    `<ellipse cx="40" cy="64" rx="4.4" ry="3" fill="#e58a74" opacity=".3"/><ellipse cx="80" cy="64" rx="4.4" ry="3" fill="#e58a74" opacity=".3"/>` +
    marksMarkup(face.marks, skin) +
    /* La barba prima della bocca: coi baffi disegnati sopra, le labbra
     * sparivano sotto la peluria e la faccia restava senza espressione. */
    beardMarkup(face.beard, beardColor) +
    `<g class="f-mouth">${mouthMarkup(face.mouth, lip)}${
      luce
        ? `<ellipse cx="62" cy="76.4" rx="5" ry="1.5" fill="#fff" opacity=".3" filter="url(#dmFaceTiny)"/>`
        : ""
    }</g>` +
    ageMarkup(face.age, skin) +
    /* L'ombra che i capelli lasciano sulla fronte: e' quella a staccare la
     * capigliatura dalla pelle invece di incollarcela sopra. */
    (SENZA_OMBRA.has(face.hair)
      ? ""
      : luce
        ? `<path d="M32 36 C44 47 76 47 88 36 C82 52 38 52 32 36 Z" fill="${ombra}" opacity=".26" filter="url(#dmFaceSoft)"/>`
        : `<path d="M33 38 C44 46 76 46 87 38 C82 50 38 50 33 38 Z" fill="#000" opacity=".08"/>`) +
    hair.front +
    (luce ? hairLightMarkup(face.hair, hairColor) : "") +
    glassesMarkup(face.glasses) +
    hatMarkup(face.hat, vestito) +
    `</g></g></svg>`
  );
}
