/* La faccia che si costruisce, pezzo per pezzo — nello stile dei personaggi
 * 3D da cartone: occhi grandi con l'iride colorata e le luci dentro, capelli
 * a ciocche con volume, il viso morbido con la luce sulla fronte e l'ombra
 * sulla mascella, il sorriso coi denti.
 *
 * L'avatar delle persone non e' un'emoji scelta da un elenco: e' una faccia
 * composta — carnagione, taglio e colore dei capelli, occhi e loro colore,
 * bocca, barba, corporatura, occhiali. Questo modulo la disegna: prende una
 * scelta per ogni pezzo e restituisce l'SVG, sempre lo stesso per le stesse
 * scelte, cosi' la card e l'anteprima dell'editor mostrano la stessa persona.
 *
 * Le animazioni non stanno qui: l'SVG porta le classi (`f-all`, `f-eyes`,
 * `f-mouth`) e il respiro, il battito di palpebre e lo sguardo li mette il
 * foglio di stile della sezione. Il modulo e' puro: scelte dentro, testo SVG
 * fuori.
 */

const clean = (value) => String(value ?? "").trim();

/* ── I cataloghi. Ogni pezzo ha un elenco chiuso di scelte: una scelta fuori
 * elenco torna alla prima, cosi' una configurazione scritta a mano o vecchia
 * disegna comunque una faccia intera. ── */

export const FACE_SKINS = Object.freeze({
  f1: { base: "#ffe3c8", shade: "#eec4a2" },
  f2: { base: "#f6cfa8", shade: "#dfae83" },
  f3: { base: "#e8b88a", shade: "#c99566" },
  f4: { base: "#c98f5e", shade: "#a86f42" },
  f5: { base: "#9a6b43", shade: "#7a4f2e" },
  f6: { base: "#6b4a2e", shade: "#513520" },
});

export const FACE_HAIR_COLORS = Object.freeze({
  nero: "#2a221e",
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
]);

export const FACE_EYES = Object.freeze(["normali", "sorridenti", "grandi"]);
/* Il colore dell'iride: e' quello a dare vita agli occhi grandi. */
export const FACE_EYE_COLORS = Object.freeze({
  azzurro: "#3f8fd8",
  verde: "#3f9e63",
  nocciola: "#a3762e",
  marrone: "#6f4522",
  grigio: "#7d8a99",
});
export const FACE_MOUTHS = Object.freeze(["sorriso", "risata", "neutra", "sorrisetto"]);
export const FACE_BEARDS = Object.freeze(["nessuna", "baffi", "pizzetto", "piena"]);
export const FACE_GLASSES = Object.freeze(["nessuno", "tondi", "sole"]);
/* La corporatura: cambia la larghezza del viso e delle spalle. La prima e' il
 * default, cosi' le facce gia' costruite restano identiche a com'erano. */
export const FACE_BUILDS = Object.freeze(["normale", "magra", "robusta"]);

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
    hair: pickKey(input.hair, FACE_HAIRS),
    hairColor: pickKey(input.hairColor, FACE_HAIR_COLORS),
    eyes: pickKey(input.eyes, FACE_EYES),
    eyeColor: pickKey(input.eyeColor, FACE_EYE_COLORS),
    mouth: pickKey(input.mouth, FACE_MOUTHS),
    beard: pickKey(input.beard, FACE_BEARDS),
    glasses: pickKey(input.glasses, FACE_GLASSES),
    build: pickKey(input.build, FACE_BUILDS),
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
          `<path d="M33 48 C33 68 34 80 36 90 M87 48 C87 68 86 80 84 90" stroke="${scuro}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".45"/>` +
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

/* Gli occhi grandi del cartone: la sclera bianca, l'iride col suo colore e la
 * sua sfumatura, la pupilla, due luci — e le ciglia sopra. */
function eyesMarkup(style, eyeGradId) {
  const ink = "#22303f";
  const lash = "#2b1f16";
  if (style === "sorridenti")
    return (
      `<path d="M40 54 C44 47 52 47 56 54" stroke="${lash}" stroke-width="3.6" stroke-linecap="round" fill="none"/>` +
      `<path d="M64 54 C68 47 76 47 80 54" stroke="${lash}" stroke-width="3.6" stroke-linecap="round" fill="none"/>` +
      `<path d="M38.5 52 L36 50.4 M81.5 52 L84 50.4" stroke="${lash}" stroke-width="2" stroke-linecap="round"/>`
    );
  const big = style === "grandi";
  const rx = big ? 9.4 : 8.2;
  const ry = big ? 10.4 : 9;
  const iris = big ? 5.6 : 4.9;
  const pupil = big ? 2.7 : 2.4;
  const eye = (cx, flip) =>
    `<ellipse cx="${cx}" cy="54" rx="${rx}" ry="${ry}" fill="#fff" stroke="rgba(34,48,63,.16)" stroke-width=".8"/>` +
    /* L'ombra della palpebra dentro il bianco: e' lei a rendere l'occhio
     * una sfera invece di un cerchio. */
    `<path d="M${cx - rx + 1} 51 Q${cx} ${46.4} ${cx + rx - 1} 51 Q${cx} ${50.4} ${cx - rx + 1} 51 Z" fill="#22303f" opacity=".13"/>` +
    `<circle cx="${cx}" cy="${54.8}" r="${iris}" fill="url(#${eyeGradId})"/>` +
    `<circle cx="${cx}" cy="${54.8}" r="${pupil}" fill="${ink}"/>` +
    `<circle cx="${cx - 1.8}" cy="${52.4}" r="${big ? 1.9 : 1.6}" fill="#fff"/>` +
    `<circle cx="${cx + 1.7}" cy="${56.6}" r=".9" fill="#fff" opacity=".85"/>` +
    `<path d="M${cx - rx + 1.6} 48.4 C${cx - 2.6} ${44.8} ${cx + 3.6} ${45} ${cx + rx - 1.6} 48.2" stroke="${lash}" stroke-width="1.9" stroke-linecap="round" fill="none" opacity=".85"/>` +
    `<path d="M${cx + (flip ? -1 : 1) * (rx - 1.2)} 48 L${cx + (flip ? -1 : 1) * (rx + 1.2)} 46.9" stroke="${lash}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
  return eye(46.5, true) + eye(73.5, false);
}

/* La bocca: il sorriso ha i denti, la risata anche la lingua — e' quello a
 * dare l'aria da personaggio invece che da faccina. */
function mouthMarkup(style) {
  const lip = "#b3573b";
  if (style === "risata")
    return (
      `<path d="M46 69 C53 84 67 84 74 69 C65 72 55 72 46 69 Z" fill="#6d2a1e"/>` +
      `<path d="M48 70 C55 73.4 65 73.4 72 70 C70 73.4 66 75 60 75 C54 75 50 73.4 48 70 Z" fill="#fff"/>` +
      `<path d="M53 78.4 C56 81.4 64 81.4 67 78.4 C64 77 56 77 53 78.4 Z" fill="#e2766a"/>`
    );
  if (style === "neutra")
    return `<path d="M52 72 L68 72" stroke="${lip}" stroke-width="3" stroke-linecap="round"/>`;
  if (style === "sorrisetto")
    return `<path d="M52 72 C58 76.4 66 74.6 70 68.6" stroke="${lip}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`;
  return (
    `<path d="M48 69 C53 78 67 78 72 69 C65 71.6 55 71.6 48 69 Z" fill="#7c2f22"/>` +
    `<path d="M50 69.8 C56 72 64 72 70 69.8 C68 72.2 64 73.4 60 73.4 C56 73.4 52 72.2 50 69.8 Z" fill="#fff"/>`
  );
}

/* La barba non e' una toppa piatta: ha lo strato pieno, un velo piu' chiaro
 * che le da' volume, e qualche pelo disegnato — e' la texture a farla vera. */
function beardMarkup(style, color) {
  const chiaro = lighten(color, 0.14);
  const scuro = darken(color, 0.78);
  const pelo = (d) =>
    `<path d="${d}" stroke="${scuro}" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".55"/>`;
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
  if (style === "tondi")
    return (
      `<g stroke="#243244" stroke-width="2.6" fill="none">` +
      `<circle cx="46.5" cy="54" r="10.5"/><circle cx="73.5" cy="54" r="10.5"/>` +
      `<path d="M56.5 53 C58.2 51 61.8 51 63.5 53"/><path d="M36.5 52.5 L30.5 49.5"/><path d="M83.5 52.5 L89.5 49.5"/></g>`
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

/* La corporatura: il viso si stringe o si allarga attorno al suo centro, le
 * spalle seguono, e la figura robusta prende un accenno di mento pieno. */
const FACE_BUILD_SHAPES = Object.freeze({
  normale: { sx: 1, sy: 1, bust: "M14 124 C20 96 38 88 60 88 C82 88 100 96 106 124 Z" },
  magra: { sx: 0.9, sy: 1.04, bust: "M21 124 C26 98 42 90 60 90 C78 90 94 98 99 124 Z" },
  robusta: { sx: 1.13, sy: 0.98, bust: "M8 124 C15 94 37 86 60 86 C83 86 105 94 112 124 Z" },
});

/**
 * La faccia disegnata. Il fondo lo mette chi la ospita (la card ha gia' il suo
 * cerchio col colore scelto); qui c'e' il busto. Con `animated: false` l'SVG
 * porta la classe che spegne le animazioni: e' come si disegnano i campioncini
 * dell'editor, che sono decine e non devono respirare tutti insieme.
 */
export function avatarSvg(input, { animated = true, shirt = "" } = {}) {
  const face = normalizeFace(input);
  if (!face) return "";
  const skin = FACE_SKINS[face.skin];
  const hairColor = FACE_HAIR_COLORS[face.hairColor];
  const eyeColor = FACE_EYE_COLORS[face.eyeColor];
  const brow = darken(hairColor, 0.7);
  const shirtFill = clean(shirt) || "var(--dm-person-color,#0ea5e9)";
  const shape = FACE_BUILD_SHAPES[face.build] || FACE_BUILD_SHAPES.normale;
  /* I gradienti stanno nei defs con un id che dipende dalla scelta: due
   * facce con la stessa carnagione condividono la stessa definizione, due
   * carnagioni diverse non si rubano il colore. */
  const skinGradId = `dmFaceSkin-${face.skin}`;
  const hairGradId = `dmFaceHair-${face.hairColor}`;
  const eyeGradId = `dmFaceEye-${face.eyeColor}`;
  const hair = hairPaths(face.hair, hairColor, hairGradId);
  const testa =
    shape.sx === 1 && shape.sy === 1
      ? ""
      : ` transform="translate(60 56) scale(${shape.sx} ${shape.sy}) translate(-60 -56)"`;
  return (
    `<svg class="dm-face-svg${animated ? "" : " dm-face-still"}" viewBox="0 0 120 120" aria-hidden="true">` +
    `<defs>` +
    `<radialGradient id="${skinGradId}" cx="43%" cy="32%" r="76%">` +
    `<stop offset="0%" stop-color="${lighten(skin.base, 0.22)}"/>` +
    `<stop offset="45%" stop-color="${lighten(skin.base, 0.06)}"/>` +
    `<stop offset="78%" stop-color="${skin.base}"/>` +
    `<stop offset="100%" stop-color="${skin.shade}"/>` +
    `</radialGradient>` +
    `<linearGradient id="${hairGradId}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${lighten(hairColor, 0.3)}"/>` +
    `<stop offset="45%" stop-color="${hairColor}"/>` +
    `<stop offset="100%" stop-color="${darken(hairColor, 0.78)}"/>` +
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
    `</defs>` +
    `<g class="f-all">` +
    hair.back +
    `<path d="${shape.bust}" fill="${shirtFill}"/>` +
    `<path d="${shape.bust}" fill="url(#dmFaceBust)"/>` +
    `<path d="M42 96 C48 90 72 90 78 96 C72 93 48 93 42 96 Z" fill="#fff" opacity=".18"/>` +
    `<path d="M52 74 h16 v12 a8 8 0 0 1 -16 0 Z" fill="${skin.shade}"/>` +
    `<ellipse cx="60" cy="90" rx="14" ry="4.6" fill="#000" opacity=".14"/>` +
    `<g class="f-head"${testa}>` +
    `<circle cx="31" cy="56" r="6.5" fill="${skin.base}"/><circle cx="89" cy="56" r="6.5" fill="${skin.base}"/>` +
    `<circle cx="31" cy="56" r="2.6" fill="${skin.shade}" opacity=".55"/><circle cx="89" cy="56" r="2.6" fill="${skin.shade}" opacity=".55"/>` +
    `<path d="M60 16 C81 16 90 33 90 53 C90 74 77 88 60 88 C43 88 30 74 30 53 C30 33 39 16 60 16 Z" fill="url(#${skinGradId})"/>` +
    /* La luce e l'ombra che modellano il viso come un render: il bordo in
     * penombra tutt'attorno, la luce sulla fronte e sugli zigomi, l'ombra
     * lungo la mascella. */
    `<path d="M60 16 C81 16 90 33 90 53 C90 74 77 88 60 88 C43 88 30 74 30 53 C30 33 39 16 60 16 Z" fill="none" stroke="${skin.shade}" stroke-width="2.6" opacity=".4"/>` +
    `<ellipse cx="53" cy="30" rx="16" ry="8.5" fill="#ffffff" opacity=".14"/>` +
    `<ellipse cx="41" cy="60" rx="6" ry="4" fill="#ffffff" opacity=".08"/>` +
    `<ellipse cx="79" cy="60" rx="6" ry="4" fill="#ffffff" opacity=".08"/>` +
    `<path d="M39 72 C45 83 75 83 81 72 C75 87 45 87 39 72 Z" fill="${skin.shade}" opacity=".22"/>` +
    (face.build === "robusta"
      ? `<path d="M46 84 C52 89 68 89 74 84" stroke="${skin.shade}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".5"/>`
      : "") +
    /* Le sopracciglia piene, a forma: e' il tratto dei personaggi renderizzati,
     * non la linea sottile della faccina. */
    `<path d="M38 42.8 C40.5 38.2 48.5 37 53.8 39.8 C55 40.9 54.6 42.6 53 42.5 C48.2 41.6 43.4 42.2 40.2 44.6 C38.8 45.3 37.6 44.1 38 42.8 Z" fill="${brow}" opacity=".95"/>` +
    `<path d="M82 42.8 C79.5 38.2 71.5 37 66.2 39.8 C65 40.9 65.4 42.6 67 42.5 C71.8 41.6 76.6 42.2 79.8 44.6 C81.2 45.3 82.4 44.1 82 42.8 Z" fill="${brow}" opacity=".95"/>` +
    `<g class="f-eyes">${eyesMarkup(face.eyes, eyeGradId)}</g>` +
    /* Il naso col volume: la punta tonda in ombra e la sua piccola luce. */
    `<path d="M56.8 62.8 C57.8 65.6 62.2 65.6 63.2 62.8 C62.2 64.4 57.8 64.4 56.8 62.8 Z" fill="${skin.shade}" opacity=".85"/>` +
    `<ellipse cx="59" cy="61.4" rx="1.7" ry="1" fill="#fff" opacity=".28"/>` +
    `<ellipse cx="40" cy="64" rx="4.4" ry="3" fill="#e58a74" opacity=".3"/><ellipse cx="80" cy="64" rx="4.4" ry="3" fill="#e58a74" opacity=".3"/>` +
    `<g class="f-mouth">${mouthMarkup(face.mouth)}</g>` +
    beardMarkup(face.beard, hairColor) +
    hair.front +
    glassesMarkup(face.glasses) +
    `</g></g></svg>`
  );
}
