/* La faccia che si costruisce, pezzo per pezzo.
 *
 * L'avatar delle persone non e' un'emoji scelta da un elenco: e' una faccia
 * composta — carnagione, taglio e colore dei capelli, occhi, bocca, barba,
 * occhiali — come i Memoji. Questo modulo la disegna: prende una scelta per
 * ogni pezzo e restituisce l'SVG, sempre lo stesso per le stesse scelte,
 * cosi' la card e l'anteprima dell'editor mostrano la stessa persona.
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
export const FACE_MOUTHS = Object.freeze(["sorriso", "risata", "neutra", "sorrisetto"]);
export const FACE_BEARDS = Object.freeze(["nessuna", "baffi", "pizzetto", "piena"]);
export const FACE_GLASSES = Object.freeze(["nessuno", "tondi", "sole"]);

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
    mouth: pickKey(input.mouth, FACE_MOUTHS),
    beard: pickKey(input.beard, FACE_BEARDS),
    glasses: pickKey(input.glasses, FACE_GLASSES),
  };
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

/* ── I pezzi. Il viso sta in un viewBox 120x120: testa sull'asse di 60,
 * occhi a y=52, bocca a y=69. Ogni taglio di capelli ha due meta': quella
 * dietro la testa e quella davanti alla fronte. ── */

function hairPaths(style, color) {
  const front = (d) => `<path d="${d}" fill="${color}"/>`;
  const back = (d) => `<path d="${d}" fill="${darken(color, 0.85)}"/>`;
  switch (style) {
    case "rasato":
      return {
        back: "",
        front: `<path d="M35 40 C35 25 45 17 60 17 C75 17 85 25 85 40 C85 32 76 25 60 25 C44 25 35 32 35 40 Z" fill="${color}" opacity=".55"/>`,
      };
    case "ciuffo":
      return {
        back: "",
        front:
          front(
            "M33 46 C31 22 46 13 60 13 C76 13 89 22 87 46 C86 36 82 28 72 27 C60 26 48 30 43 36 C39 40 35 42 33 46 Z",
          ) + front("M42 32 C50 20 70 19 80 28 C72 25 60 27 52 33 C47 36 43 35 42 32 Z"),
      };
    case "spettinato":
      return {
        back: "",
        front: front(
          "M33 45 C33 38 34 30 38 25 L41 15 L46 24 C48 20 51 15 55 12 L58 21 C61 17 66 13 71 13 L70 21 C75 19 80 21 84 26 L79 28 C84 32 87 38 87 45 C84 36 77 29 68 28 C56 26 44 30 39 36 C36 39 34 42 33 45 Z",
        ),
      };
    case "riccio":
      return {
        back: "",
        front: front(
          "M33 46 C30 38 33 30 39 27 C36 20 42 13 49 15 C50 8 60 6 65 11 C71 6 80 10 80 17 C87 18 90 27 85 32 C89 37 87 43 84 46 C82 38 76 31 68 29 C56 26 45 30 40 36 C37 39 34 42 33 46 Z",
        ),
      };
    case "lungo":
      return {
        back: back(
          "M30 92 C26 58 30 22 60 20 C90 22 94 58 90 92 C86 96 80 96 78 92 C81 62 78 40 60 38 C42 40 39 62 42 92 C40 96 34 96 30 92 Z",
        ),
        front: front(
          "M34 44 C33 24 46 14 60 14 C74 14 87 24 86 44 C84 34 78 27 68 26 C56 25 45 29 40 35 C37 38 35 41 34 44 Z",
        ),
      };
    case "caschetto":
      return {
        back: back(
          "M31 76 C27 42 40 16 60 16 C80 16 93 42 89 76 C87 81 81 81 79 77 C82 52 76 32 60 32 C44 32 38 52 41 77 C39 81 33 81 31 76 Z",
        ),
        front: front(
          "M37 38 C39 22 50 15 60 15 C70 15 81 22 83 38 L78 42 C74 32 66 29 60 29 C54 29 46 32 42 42 Z",
        ),
      };
    case "chignon":
      return {
        back: back("M49 13 A11 11 0 1 1 71 13 A11 11 0 1 1 49 13 Z"),
        front: front(
          "M33 46 C31 24 46 14 60 14 C74 14 89 24 87 46 C85 36 80 28 70 27 C58 25 46 29 41 36 C37 40 34 42 33 46 Z",
        ),
      };
    case "corto":
    default:
      return {
        back: "",
        front: front(
          "M33 47 C31 23 46 13 60 13 C74 13 89 23 87 47 C85 37 81 28 72 27 C60 25 47 29 42 35 C38 40 34 42 33 47 Z",
        ),
      };
  }
}

function eyesMarkup(style) {
  const ink = "#241a12";
  if (style === "sorridenti")
    return (
      `<path d="M42 53 C45 48 51 48 54 53" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none"/>` +
      `<path d="M66 53 C69 48 75 48 78 53" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none"/>`
    );
  if (style === "grandi")
    return (
      `<ellipse cx="48" cy="52" rx="4.6" ry="5.8" fill="${ink}"/><circle cx="49.6" cy="50" r="1.6" fill="#fff"/>` +
      `<ellipse cx="72" cy="52" rx="4.6" ry="5.8" fill="${ink}"/><circle cx="73.6" cy="50" r="1.6" fill="#fff"/>`
    );
  return (
    `<ellipse cx="48" cy="52" rx="3.4" ry="4.6" fill="${ink}"/><circle cx="49.2" cy="50.4" r="1.1" fill="#fff"/>` +
    `<ellipse cx="72" cy="52" rx="3.4" ry="4.6" fill="${ink}"/><circle cx="73.2" cy="50.4" r="1.1" fill="#fff"/>`
  );
}

function mouthMarkup(style) {
  const lip = "#a4563a";
  if (style === "risata")
    return (
      `<path d="M48 66 C55 79 65 79 72 66 C64 69 56 69 48 66 Z" fill="#7c2f22"/>` +
      `<path d="M53 72 C57 77 63 77 67 72 C63 74 57 74 53 72 Z" fill="#e2766a"/>`
    );
  if (style === "neutra")
    return `<path d="M52 70 L68 70" stroke="${lip}" stroke-width="3" stroke-linecap="round"/>`;
  if (style === "sorrisetto")
    return `<path d="M53 70 C59 74 66 72 69 66" stroke="${lip}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  return `<path d="M50 67 C55 74 65 74 70 67" stroke="${lip}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`;
}

function beardMarkup(style, color) {
  if (style === "baffi")
    return `<path d="M47 64 C52 58 68 58 73 64 C67 61 53 61 47 64 Z" fill="${color}"/>`;
  if (style === "pizzetto")
    return `<path d="M51 78 C53 86 67 86 69 78 C64 82 56 82 51 78 Z" fill="${color}"/>`;
  if (style === "piena")
    return (
      `<path d="M32 52 C33 82 47 92 60 92 C73 92 87 82 88 52 C86 76 74 84 60 84 C46 84 34 76 32 52 Z" fill="${color}"/>` +
      `<path d="M47 64 C52 58 68 58 73 64 C67 61 53 61 47 64 Z" fill="${color}"/>`
    );
  return "";
}

function glassesMarkup(style) {
  if (style === "tondi")
    return (
      `<g stroke="#243244" stroke-width="2.6" fill="none">` +
      `<circle cx="48" cy="52" r="9"/><circle cx="72" cy="52" r="9"/>` +
      `<path d="M57 52 C58.5 50 61.5 50 63 52"/><path d="M39 51 L33 48"/><path d="M81 51 L87 48"/></g>`
    );
  if (style === "sole")
    return (
      `<g><circle cx="48" cy="52" r="9" fill="#1f2733" opacity=".92"/><circle cx="72" cy="52" r="9" fill="#1f2733" opacity=".92"/>` +
      `<path d="M57 52 C58.5 50 61.5 50 63 52" stroke="#1f2733" stroke-width="2.6" fill="none"/>` +
      `<path d="M44 48 L50 46" stroke="#5c6c80" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M39 51 L33 48 M81 51 L87 48" stroke="#1f2733" stroke-width="2.6"/></g>`
    );
  return "";
}

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
  const brow = darken(hairColor, 0.7);
  const hair = hairPaths(face.hair, hairColor);
  const shirtFill = clean(shirt) || "var(--dm-person-color,#0ea5e9)";
  return (
    `<svg class="dm-face-svg${animated ? "" : " dm-face-still"}" viewBox="0 0 120 120" aria-hidden="true">` +
    `<g class="f-all">` +
    hair.back +
    `<path d="M16 124 C22 96 40 87 60 87 C80 87 98 96 104 124 Z" fill="${shirtFill}"/>` +
    `<path d="M52 72 h16 v12 a8 8 0 0 1 -16 0 Z" fill="${skin.shade}"/>` +
    `<g class="f-head">` +
    `<circle cx="33" cy="56" r="6" fill="${skin.base}"/><circle cx="87" cy="56" r="6" fill="${skin.base}"/>` +
    `<path d="M60 20 C79 20 88 35 88 54 C88 74 76 86 60 86 C44 86 32 74 32 54 C32 35 41 20 60 20 Z" fill="${skin.base}"/>` +
    `<path d="M41 42 C45 39 51 39 54 42" stroke="${brow}" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
    `<path d="M66 42 C69 39 75 39 79 42" stroke="${brow}" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
    `<g class="f-eyes">${eyesMarkup(face.eyes)}</g>` +
    `<path d="M60 54 C62 58 62 60 59 61" stroke="${skin.shade}" stroke-width="2.2" stroke-linecap="round" fill="none"/>` +
    `<circle cx="41" cy="61" r="3.4" fill="#e58a74" opacity=".35"/><circle cx="79" cy="61" r="3.4" fill="#e58a74" opacity=".35"/>` +
    `<g class="f-mouth">${mouthMarkup(face.mouth)}</g>` +
    beardMarkup(face.beard, hairColor) +
    hair.front +
    glassesMarkup(face.glasses) +
    `</g></g></svg>`
  );
}
