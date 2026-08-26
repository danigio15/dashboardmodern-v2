/* I venti tratti, tradotti in geometria.
 *
 * Il costruttore della faccia parla di tagli, nasi e corporature; il motore
 * 3D parla di ellissoidi e di spessori con segno. Questo modulo e' il
 * traduttore: prende la faccia normalizzata — la stessa che disegna l'SVG,
 * senza una chiave in piu' — e ne fa i parametri della scultura, le maschere
 * dei capelli e della barba, i colori dei materiali.
 *
 * Cosi' le due rappresentazioni restano una sola scelta: chi passa dal
 * disegno al 3D ritrova la sua faccia, non un'altra persona.
 */
import {
  buildHeadMesh,
  CORPI,
  CRANI,
  MAT,
  NASI,
  OCCHIO,
  Maglia,
  campana,
  clamp,
  finisci,
  rgb,
  superficie,
} from "./face-mesh.js";
import { renderMesh } from "./face-raster.js";
import {
  FACE_BEARD_COLORS,
  FACE_EYE_COLORS,
  FACE_HAIR_COLORS,
  FACE_LIP_COLORS,
  FACE_OUTFIT_COLORS,
  FACE_SKINS,
  normalizeFace,
} from "./person-avatar.js";

const morbido = (bordo0, bordo1, x) => {
  const t = clamp((x - bordo0) / (bordo1 - bordo0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ── I capelli ────────────────────────────────────────────────────────────
 *
 * Ogni taglio e' una funzione che dice, in ogni punto del cranio, quanto
 * capello c'e'. Il numero e' con segno: negativo vuol dire che li' la buccia
 * sprofonda dentro la testa e non si vede — ed e' cosi' che l'attaccatura
 * viene liscia invece che a sega.
 */

/* L'attaccatura: scende curva sulla fronte e risale alle tempie, come quella
 * vera. Dietro e ai lati il capello arriva molto piu' giu'. */
function attaccatura(x, y, z, { fronte = 0.4, tempie = 0.34, dietro = -0.16 } = {}) {
  const ax = Math.abs(x);
  const alto = fronte + tempie * Math.min(1, (ax / 0.62) ** 2.6);
  const davanti = clamp((z - 0.05) / 0.35, 0, 1);
  return alto * davanti + dietro * (1 - davanti);
}

/* Un'onda: serve ai ricci e allo spettinato per non essere un casco liscio. */
const onda = (a, b, c) => Math.sin(a * 7.3) * Math.sin(b * 6.1) * Math.sin(c * 5.7);

export const CAPELLI_3D = Object.freeze({
  calvo: null,
  rasato: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.3, tempie: 0.2, dietro: -0.28 })) / 0.14;
    return 0.016 * clamp(d * 1.6, -3, 1);
  },
  corto: (x, y, z) => {
    const d = (y - attaccatura(x, y, z)) / 0.16;
    const volume = 0.05 + 0.1 * morbido(0.3, 0.8, y);
    return volume * clamp(d * 1.4, -3, 1);
  },
  ciuffo: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.36 })) / 0.16;
    const volume =
      0.05 +
      0.1 * morbido(0.3, 0.8, y) +
      0.13 * campana(x / 0.28) * campana((y - 0.78) / 0.24) * clamp(z, 0, 1);
    return volume * clamp(d * 1.4, -3, 1);
  },
  spettinato: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.38 })) / 0.16;
    const volume = 0.06 + 0.11 * morbido(0.3, 0.8, y) + 0.045 * onda(x, y, z);
    return volume * clamp(d * 1.3, -3, 1);
  },
  riccio: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.4, dietro: -0.24 })) / 0.18;
    const volume = 0.11 + 0.07 * morbido(0.2, 0.8, y) + 0.05 * onda(x * 1.6, y * 1.6, z * 1.6);
    return volume * clamp(d * 1.3, -3, 1);
  },
  lungo: (x, y, z) => {
    const dietro = clamp((0.1 - z) / 0.5, 0, 1);
    const d = (y - attaccatura(x, y, z, { fronte: 0.4, dietro: -1.1 - 0.2 * dietro })) / 0.2;
    const volume = 0.07 + 0.09 * morbido(0.1, 0.8, y) + 0.06 * dietro;
    return volume * clamp(d * 1.2, -3, 1);
  },
  caschetto: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.42, tempie: 0.1, dietro: -0.62 })) / 0.16;
    const volume = 0.08 + 0.07 * morbido(0.2, 0.8, y);
    return volume * clamp(d * 1.5, -3, 1);
  },
  chignon: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.42, tempie: 0.12, dietro: -0.32 })) / 0.14;
    const volume = 0.035 + 0.04 * morbido(0.2, 0.8, y);
    return volume * clamp(d * 1.6, -3, 1);
  },
  coda: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.42, tempie: 0.12, dietro: -0.3 })) / 0.14;
    const volume = 0.04 + 0.045 * morbido(0.2, 0.8, y);
    return volume * clamp(d * 1.6, -3, 1);
  },
  afro: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.4, tempie: 0.22, dietro: -0.3 })) / 0.2;
    const volume = 0.3 + 0.05 * onda(x * 2.2, y * 2.2, z * 2.2);
    return volume * clamp(d * 1.2, -3, 1);
  },
  pettinato: (x, y, z) => {
    const d = (y - attaccatura(x, y, z, { fronte: 0.42, tempie: 0.3 })) / 0.16;
    /* La riga: da un lato il capello e' alto, dall'altro schiacciato. */
    const riga = campana((x + 0.16) / 0.05);
    const volume = 0.055 + 0.12 * morbido(0.3, 0.85, y) * (1 - 0.5 * riga) + 0.02 * clamp(-x, 0, 1);
    return volume * clamp(d * 1.4, -3, 1) - riga * 0.02;
  },
});

/* Chignon e coda hanno un pezzo in piu' dietro la testa: la maschera da sola
 * non basta a fare un nodo di capelli. */
export const CAPELLI_EXTRA = Object.freeze({
  chignon: { centro: [0, 0.62, -0.72], raggi: [0.24, 0.24, 0.22] },
  coda: { centro: [0, 0.16, -0.86], raggi: [0.17, 0.34, 0.18] },
});

/* ── La barba ─────────────────────────────────────────────────────────────
 * Non e' geometria: e' colore dipinto sulla pelle, con la forza che cambia
 * fra l'ombra di due giorni e la barba piena. */
const zonaBaffi = (x, y) => campana((y + 0.36) / 0.055) * campana(x / 0.17);
const zonaMento = (x, y) => campana((y + 0.72) / 0.18) * campana(x / 0.24);
const zonaMascella = (x, y, z) =>
  clamp(1 - Math.hypot(x / 0.62, (y + 0.55) / 0.52), 0, 1) ** 0.6 * clamp((z + 0.1) / 0.4, 0, 1);

export const BARBE_3D = Object.freeze({
  nessuna: null,
  incolta: {
    zona: (x, y, z) => Math.max(zonaMascella(x, y, z) * 0.8, zonaBaffi(x, y)),
    forza: 0.34,
  },
  baffi: { zona: (x, y) => zonaBaffi(x, y), forza: 0.92 },
  pizzetto: { zona: (x, y) => Math.max(zonaBaffi(x, y), zonaMento(x, y)), forza: 0.92 },
  piena: { zona: (x, y, z) => Math.max(zonaMascella(x, y, z), zonaBaffi(x, y)), forza: 0.95 },
});

/* Gli occhi non si aprono tutti uguali. */
const APERTURA = Object.freeze({
  normali: 1,
  sorridenti: 0.45,
  grandi: 1.22,
  assonnati: 0.6,
  stretti: 0.62,
});

const SOPRACCIGLIA = Object.freeze({
  naturali: { alto: 0, largo: 1, spesso: 1 },
  folte: { alto: -0.005, largo: 1.08, spesso: 1.5 },
  sottili: { alto: 0.01, largo: 0.96, spesso: 0.62 },
  arcuate: { alto: 0.03, largo: 0.94, spesso: 0.9 },
  dritte: { alto: 0, largo: 1.1, spesso: 1.05 },
  corrucciate: { alto: -0.02, largo: 1, spesso: 1.15 },
});

const ORECCHIE = Object.freeze({
  normali: { fuori: 1, grande: 1 },
  sporgenti: { fuori: 1.9, grande: 1.12 },
  piccole: { fuori: 0.75, grande: 0.78 },
});

/* L'eta': non cambia i tratti, cambia quanto la pelle e' tesa e quanto e'
 * spenta — e le pieghe che restano. */
const ETA = Object.freeze({
  giovane: { pieghe: 0, spento: 0 },
  adulto: { pieghe: 0.4, spento: 0.05 },
  maturo: { pieghe: 1, spento: 0.13 },
});

/** I parametri della scultura, da una faccia normalizzata. */
export function faceToTratti(input, { shirt = "#4f7fb5" } = {}) {
  const face = normalizeFace(input) || normalizeFace({});
  const pelleHex = FACE_SKINS[face.skin].base;
  const capelliHex = FACE_HAIR_COLORS[face.hairColor];
  const barbaHex = FACE_BEARD_COLORS[face.beardColor] || capelliHex;
  const eta = ETA[face.age] || ETA.giovane;
  const barba = BARBE_3D[face.beard];
  const sopracciglia = SOPRACCIGLIA[face.brows] || SOPRACCIGLIA.naturali;
  const vestitoHex = FACE_OUTFIT_COLORS[face.outfitColor] || shirt;
  const pelle = rgb(pelleHex).map((v) => v * (1 - eta.spento));
  const capelliMaschera = CAPELLI_3D[face.hair];
  return {
    face,
    cranio: CRANI[face.shape] || CRANI.ovale,
    naso: NASI[face.nose] || NASI.dritto,
    faccia: (CORPI[face.build] || CORPI.normale).faccia,
    spalle: (CORPI[face.build] || CORPI.normale).spalle,
    pelle,
    labbraColore: rgb(FACE_LIP_COLORS[face.lips]),
    labbraForza: face.lips === "naturale" ? 0.55 : 0.95,
    irideColore: rgb(FACE_EYE_COLORS[face.eyeColor]),
    capelliColore: rgb(capelliHex),
    sopraccigliaColore: rgb(capelliHex).map((v) => v * 0.72),
    sopraccigliaAlto: sopracciglia.alto,
    sopraccigliaLargo: sopracciglia.largo,
    sopraccigliaSpesso: sopracciglia.spesso,
    vestitoColore: rgb(vestitoHex),
    orecchio: ORECCHIE[face.ears] || ORECCHIE.normali,
    arcata: 1 + eta.pieghe * 0.15,
    guance: eta.pieghe * 0.5,
    labbra: 1,
    apertura: APERTURA[face.eyes] === undefined ? 1 : APERTURA[face.eyes],
    barba: barba ? barba.zona : null,
    barbaColore: rgb(barbaHex),
    barbaForza: barba ? barba.forza : 0,
    /* L'ombra di barba resta dipinta; le barbe vere prendono spessore. */
    barbaSpessore: barba ? (face.beard === "incolta" ? 0 : 0.055) : 0,
    capelli: capelliMaschera,
    ombraCapelli: capelliMaschera
      ? (x, y, z) => {
          /* L'ombra che i capelli lasciano sulla fronte: si guarda quanto
           * manca all'attaccatura, e la si dipinge sulla pelle. */
          const s = capelliMaschera(x, y, z);
          return s < 0 && s > -0.06 ? 0.34 * (1 + s / 0.06) : 0;
        }
      : null,
  };
}

/** La maglia completa: testa, e i pezzi che certi tagli si portano dietro. */
export function buildFaceMesh(input, opzioni = {}) {
  const tratti = faceToTratti(input, opzioni);
  const extra = CAPELLI_EXTRA[tratti.face.hair];
  const testa = buildHeadMesh(tratti, opzioni.griglia);
  if (!extra) return testa;
  /* Lo chignon e la coda: un pezzo a parte, dietro la testa. */
  const maglia = new Maglia();
  superficie(
    maglia,
    24,
    30,
    (u, v) => {
      const theta = v * Math.PI;
      const phi = u * 2 * Math.PI;
      const st = Math.sin(theta);
      return {
        x: extra.centro[0] + st * Math.cos(phi) * extra.raggi[0],
        y: extra.centro[1] + Math.cos(theta) * extra.raggi[1],
        z: extra.centro[2] + st * Math.sin(phi) * extra.raggi[2],
        c: tratti.capelliColore,
        m: MAT.CAPELLI,
      };
    },
    tratti.capelliColore,
    MAT.CAPELLI,
  );
  const nodo = finisci(maglia);
  return unisci(testa, nodo);
}

/* Due maglie diventano una: gli indici della seconda scalano di quanti
 * vertici ha la prima. */
export function unisci(a, b) {
  const off = a.pos.length / 3;
  const tri = new Uint32Array(a.tri.length + b.tri.length);
  tri.set(a.tri);
  for (let i = 0; i < b.tri.length; i += 1) tri[a.tri.length + i] = b.tri[i] + off;
  const concat = (x, y, T) => {
    const out = new T(x.length + y.length);
    out.set(x);
    out.set(y, x.length);
    return out;
  };
  return {
    pos: concat(a.pos, b.pos, Float32Array),
    nor: concat(a.nor, b.nor, Float32Array),
    col: concat(a.col, b.col, Float32Array),
    mat: concat(a.mat, b.mat, Uint8Array),
    tri,
  };
}

/**
 * Il ritratto: pixel RGBA, fondo trasparente.
 * @param {object} face la faccia normalizzata
 * @param {object} opzioni size, shirt, yaw
 */
export function renderFace(face, opzioni = {}) {
  const maglia = buildFaceMesh(face, opzioni);
  return renderMesh(maglia, {
    size: opzioni.size || 192,
    ss: opzioni.ss || 2,
    yaw: opzioni.yaw === undefined ? -0.26 : opzioni.yaw,
    pitch: opzioni.pitch === undefined ? 0.05 : opzioni.pitch,
    scala: opzioni.scala === undefined ? 1.16 : opzioni.scala,
    alzata: opzioni.alzata === undefined ? 0.42 : opzioni.alzata,
  });
}
