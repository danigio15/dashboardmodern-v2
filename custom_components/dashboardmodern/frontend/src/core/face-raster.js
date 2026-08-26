/* Il rasterizzatore: da una maglia di triangoli a dei pixel.
 *
 * Non c'e' WebGL. Sei card in Home vorrebbero sei contesti GPU, che i browser
 * contano e limitano, e per un cerchietto da novanta pixel accendere la
 * scheda video e' sproporzionato. Qui si fa quello che fa una scheda video,
 * in aritmetica: si proietta, si scartano i triangoli di spalle, si riempie
 * con lo z-buffer, e per ogni pixel si interpolano posizione e normale e si
 * calcola la luce.
 *
 * Il ritratto si disegna UNA volta e resta: non e' una scena che gira, e' una
 * fotografia. Per questo si puo' permettere il costo per pixel — e per questo
 * si campiona al doppio e si riduce, che e' l'antialiasing dei poveri e in
 * una faccia si vede tutta la differenza.
 *
 * Il modulo e' puro: entra una maglia, esce un buffer RGBA. Non tocca il
 * documento, cosi' si puo' provare senza un browser.
 */

import { MATERIALI } from "./face-mesh.js";

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/* Le luci. Tre, come in uno studio vero: la chiave calda in alto a sinistra,
 * lo schiarimento freddo e debole a destra che apre le ombre, e il contorno
 * dietro-destra che stacca la testa dal fondo. */
export const LUCI = Object.freeze({
  chiave: { dir: [-0.44, 0.5, 0.74], colore: [1, 0.93, 0.84], forza: 1.18 },
  riempi: { dir: [0.78, 0.05, 0.46], colore: [0.6, 0.72, 0.95], forza: 0.3 },
  contorno: { dir: [0.55, 0.3, -0.72], colore: [0.86, 0.94, 1], forza: 0.9 },
  ambiente: [0.13, 0.135, 0.17],
});

function normalizza(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * Disegna la maglia e restituisce i pixel.
 *
 * @param {object} maglia pos/nor/col/mat/tri
 * @param {object} opzioni size, ss (sovracampionamento), yaw, pitch
 * @returns {{data:Uint8ClampedArray,size:number}}
 */
export function renderMesh(maglia, opzioni = {}) {
  const size = opzioni.size || 256;
  const ss = opzioni.ss || 2;
  const W = size * ss;
  const yaw = opzioni.yaw === undefined ? -0.3 : opzioni.yaw;
  const pitch = opzioni.pitch === undefined ? 0.06 : opzioni.pitch;
  const scala = opzioni.scala === undefined ? 1 : opzioni.scala;
  const alzata = opzioni.alzata === undefined ? 0 : opzioni.alzata;
  const luci = opzioni.luci || LUCI;
  const chiave = normalizza(luci.chiave.dir);
  const riempi = normalizza(luci.riempi.dir);
  const contorno = normalizza(luci.contorno.dir);

  const { pos, nor, col, mat, tri } = maglia;
  const conta = pos.length / 3;

  /* La rotazione della testa, applicata una volta ai vertici: la telecamera
   * resta ferma davanti. */
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const vx = new Float32Array(conta);
  const vy = new Float32Array(conta);
  const vz = new Float32Array(conta);
  const nx = new Float32Array(conta);
  const ny = new Float32Array(conta);
  const nz = new Float32Array(conta);
  for (let i = 0; i < conta; i += 1) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1] + alzata;
    const z = pos[i * 3 + 2];
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    vx[i] = x1;
    vy[i] = y2;
    vz[i] = z2;
    const a = nor[i * 3];
    const b = nor[i * 3 + 1];
    const c = nor[i * 3 + 2];
    const a1 = a * cy + c * sy;
    const c1 = -a * sy + c * cy;
    nx[i] = a1;
    ny[i] = b * cp - c1 * sp;
    nz[i] = b * sp + c1 * cp;
  }

  /* La proiezione: prospettiva vera, con la telecamera abbastanza lontana da
   * non deformare il viso — un ritratto si fa col teleobiettivo, non col
   * grandangolo, e la stessa regola vale qui. */
  const camZ = 6.2;
  const fuoco = 9.6 * scala;
  const px = new Float32Array(conta);
  const py = new Float32Array(conta);
  const pw = new Float32Array(conta);
  for (let i = 0; i < conta; i += 1) {
    const d = camZ - vz[i];
    const k = (fuoco / d) * (W / 4);
    px[i] = W / 2 + vx[i] * k;
    py[i] = W / 2 - vy[i] * k;
    pw[i] = d;
  }

  const zbuf = new Float32Array(W * W).fill(Infinity);
  const out = new Uint8ClampedArray(W * W * 4);

  const luce = (nX, nY, nZ, pX, pY, pZ, r, g, b, materiale) => {
    const m = MATERIALI[materiale] || MATERIALI[0];
    let l = Math.hypot(nX, nY, nZ) || 1;
    const NX = nX / l;
    const NY = nY / l;
    const NZ = nZ / l;
    let ex = -pX;
    let ey = -pY;
    let ez = camZ - pZ;
    l = Math.hypot(ex, ey, ez) || 1;
    ex /= l;
    ey /= l;
    ez /= l;

    const diffusa = (L, forza) => {
      const d = NX * L[0] + NY * L[1] + NZ * L[2];
      /* Mezzo-Lambert: la luce non si spegne di netto al terminatore. Sulla
       * pelle e' quello che imita la luce che entra e riesce poco piu' in
       * la'. */
      return forza * Math.max(0, d * 0.5 + 0.5) ** 2.1;
    };
    const speculare = (L, forza) => {
      const hx = L[0] + ex;
      const hy = L[1] + ey;
      const hz = L[2] + ez;
      const hl = Math.hypot(hx, hy, hz) || 1;
      const d = Math.max(0, (NX * hx + NY * hy + NZ * hz) / hl);
      return forza * m.spec * d ** m.lucido;
    };

    const dK = diffusa(chiave, luci.chiave.forza);
    const dF = diffusa(riempi, luci.riempi.forza);
    let R = luci.ambiente[0] + dK * luci.chiave.colore[0] + dF * luci.riempi.colore[0];
    let G = luci.ambiente[1] + dK * luci.chiave.colore[1] + dF * luci.riempi.colore[1];
    let B = luci.ambiente[2] + dK * luci.chiave.colore[2] + dF * luci.riempi.colore[2];

    /* Il sottopelle: dove la luce e' radente, la carne diventa rossa. E' il
     * trucco che separa una faccia di carne da una di plastica. */
    if (m.sub) {
      const dot = NX * chiave[0] + NY * chiave[1] + NZ * chiave[2];
      const bordo = Math.max(0, 1 - Math.abs(dot)) ** 2.2;
      R += bordo * m.sub * 0.42;
      G += bordo * m.sub * 0.13;
      B += bordo * m.sub * 0.08;
    }

    R *= r;
    G *= g;
    B *= b;

    /* Il contorno: luce che arriva da dietro e accende solo il bordo. */
    const fresnel = (1 - Math.max(0, NX * ex + NY * ey + NZ * ez)) ** 3;
    const dR = Math.max(0, NX * contorno[0] + NY * contorno[1] + NZ * contorno[2]);
    const rim = fresnel * dR * luci.contorno.forza;
    R += rim * luci.contorno.colore[0];
    G += rim * luci.contorno.colore[1];
    B += rim * luci.contorno.colore[2];

    const sK = speculare(chiave, luci.chiave.forza);
    const sF = speculare(riempi, 0.8);
    R += sK * luci.chiave.colore[0] + sF * luci.riempi.colore[0];
    G += sK * luci.chiave.colore[1] + sF * luci.riempi.colore[1];
    B += sK * luci.chiave.colore[2] + sF * luci.riempi.colore[2];

    return [R, G, B];
  };

  for (let t = 0; t < tri.length; t += 3) {
    const i0 = tri[t];
    const i1 = tri[t + 1];
    const i2 = tri[t + 2];
    const x0 = px[i0];
    const y0 = py[i0];
    const x1 = px[i1];
    const y1 = py[i1];
    const x2 = px[i2];
    const y2 = py[i2];
    /* L'area con segno: negativa vuol dire che il triangolo ci mostra il
     * dorso, e un dorso dentro una testa chiusa non si vede mai. */
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area >= -1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(W - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) continue;
    const inv = 1 / area;
    const materiale = mat[i0];
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const cx = x + 0.5;
        const cy2 = y + 0.5;
        const w0 = ((x1 - cx) * (y2 - cy2) - (x2 - cx) * (y1 - cy2)) * inv;
        if (w0 < 0) continue;
        const w1 = ((x2 - cx) * (y0 - cy2) - (x0 - cx) * (y2 - cy2)) * inv;
        if (w1 < 0) continue;
        const w2 = 1 - w0 - w1;
        if (w2 < 0) continue;
        const z = w0 * pw[i0] + w1 * pw[i1] + w2 * pw[i2];
        const at = y * W + x;
        if (z >= zbuf[at]) continue;
        zbuf[at] = z;
        const NX = w0 * nx[i0] + w1 * nx[i1] + w2 * nx[i2];
        const NY = w0 * ny[i0] + w1 * ny[i1] + w2 * ny[i2];
        const NZ = w0 * nz[i0] + w1 * nz[i1] + w2 * nz[i2];
        const PX = w0 * vx[i0] + w1 * vx[i1] + w2 * vx[i2];
        const PY = w0 * vy[i0] + w1 * vy[i1] + w2 * vy[i2];
        const PZ = w0 * vz[i0] + w1 * vz[i1] + w2 * vz[i2];
        const r = w0 * col[i0 * 3] + w1 * col[i1 * 3] + w2 * col[i2 * 3];
        const g = w0 * col[i0 * 3 + 1] + w1 * col[i1 * 3 + 1] + w2 * col[i2 * 3 + 1];
        const b = w0 * col[i0 * 3 + 2] + w1 * col[i1 * 3 + 2] + w2 * col[i2 * 3 + 2];
        const [R, G, B] = luce(NX, NY, NZ, PX, PY, PZ, r, g, b, materiale);
        const o = at * 4;
        /* Da lineare a schermo: senza questa curva i mezzitoni della pelle
         * vengono sporchi e scuri. */
        out[o] = 255 * clamp(R, 0, 1) ** (1 / 2.05);
        out[o + 1] = 255 * clamp(G, 0, 1) ** (1 / 2.05);
        out[o + 2] = 255 * clamp(B, 0, 1) ** (1 / 2.05);
        out[o + 3] = 255;
      }
    }
  }

  if (ss === 1) return { data: out, size: W };

  /* La riduzione: quattro campioni diventano un pixel, e il bordo della
   * testa smette di essere una scala. */
  const fine = new Uint8ClampedArray(size * size * 4);
  const n = ss * ss;
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      let R = 0;
      let G = 0;
      let B = 0;
      let A = 0;
      for (let j = 0; j < ss; j += 1)
        for (let i = 0; i < ss; i += 1) {
          const o = ((y * ss + j) * W + (x * ss + i)) * 4;
          const a = out[o + 3] / 255;
          R += out[o] * a;
          G += out[o + 1] * a;
          B += out[o + 2] * a;
          A += a;
        }
      const o = (y * size + x) * 4;
      /* I colori si mediano pesati per la copertura: altrimenti il bordo
       * sfuma verso il nero invece che verso il trasparente. */
      fine[o] = A ? R / A : 0;
      fine[o + 1] = A ? G / A : 0;
      fine[o + 2] = A ? B / A : 0;
      fine[o + 3] = (A / n) * 255;
    }
  return { data: fine, size };
}
