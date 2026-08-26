/* La testa, costruita davvero in tre dimensioni.
 *
 * Non e' un disegno: e' una maglia di triangoli. Si parte da un ellissoide —
 * il cranio — e lo si scolpisce spostando i vertici: l'arcata sopraccigliare
 * sporge, le orbite rientrano, il naso esce dal piano del viso, gli zigomi si
 * alzano, il mento si allunga, la mascella si stringe. Ogni tratto scelto in
 * configurazione e' un parametro di questa scultura, non un disegno diverso.
 *
 * Il modulo e' puro aritmetica: entra una faccia normalizzata, esce una
 * maglia (posizioni, normali, colori, materiali, triangoli). Chi la disegna
 * — il rasterizzatore — non sa niente di facce, e chi sceglie i tratti non sa
 * niente di triangoli.
 *
 * Il sistema di riferimento: x a destra, y in alto, z in avanti (verso chi
 * guarda). La testa sta fra y = -1 (mento) e y = +1 (calotta).
 */

/* I materiali: non un colore soltanto, ma come quel colore reagisce alla
 * luce. La pelle e' opaca e diffonde; l'occhio bagnato ha un riflesso stretto
 * e durissimo; i capelli hanno la lucentezza larga di una ciocca. */
export const MAT = Object.freeze({
  PELLE: 0,
  CAPELLI: 1,
  SCLERA: 2,
  IRIDE: 3,
  PUPILLA: 4,
  LABBRA: 5,
  SOPRACCIGLIA: 6,
  VESTITO: 7,
  BOCCA: 8,
  DENTI: 9,
});

export const MATERIALI = Object.freeze([
  /* pelle: speculare basso e largo, piu' il rosso che filtra sotto pelle */
  { spec: 0.24, lucido: 22, sub: 0.55 },
  { spec: 0.42, lucido: 34, sub: 0 },
  { spec: 0.9, lucido: 140, sub: 0 },
  { spec: 1, lucido: 190, sub: 0.15 },
  { spec: 1, lucido: 220, sub: 0 },
  { spec: 0.5, lucido: 46, sub: 0.5 },
  { spec: 0.2, lucido: 20, sub: 0 },
  { spec: 0.18, lucido: 16, sub: 0 },
  { spec: 0.3, lucido: 30, sub: 0.4 },
  { spec: 0.7, lucido: 90, sub: 0 },
]);

const TAU = Math.PI * 2;

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const mix = (a, b, t) => a + (b - a) * t;
/* La campana: vale 1 al centro e si spegne dolcemente. E' con questa che si
 * scolpisce — un naso e' una campana stretta, uno zigomo una larga. */
const campana = (d) => Math.exp(-d * d);

/** Un colore #rrggbb come tre numeri fra 0 e 1. */
export function rgb(hex) {
  const raw = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return [0.8, 0.7, 0.62];
  return [
    Number.parseInt(raw.slice(0, 2), 16) / 255,
    Number.parseInt(raw.slice(2, 4), 16) / 255,
    Number.parseInt(raw.slice(4, 6), 16) / 255,
  ];
}

/* ── La scultura ──────────────────────────────────────────────────────────
 *
 * `sculpisci` prende un punto sull'ellissoide di partenza e restituisce dove
 * quel punto finisce davvero. Tutte le deformazioni si sommano: e' cosi' che
 * un naso pronunciato su un viso affilato resta un naso pronunciato su un
 * viso affilato, invece di essere un terzo disegno da mantenere.
 */

/* Ogni forma del viso e' un pugno di numeri, non un contorno da ridisegnare:
 * quanto e' largo il cranio, quanto stretta la mascella, quanto lungo il
 * mento, quanto sporgono gli zigomi. */
export const CRANI = Object.freeze({
  ovale: { largo: 1, mascella: 0.93, mento: 0.02, zigomi: 0.05, fronte: 0.99, alto: 0.97 },
  tondo: { largo: 1.12, mascella: 1.04, mento: -0.06, zigomi: 0.09, fronte: 1.02, alto: 0.9 },
  squadrato: { largo: 1.08, mascella: 1.12, mento: 0, zigomi: 0.03, fronte: 1.06, alto: 0.96 },
  cuore: { largo: 1.04, mascella: 0.76, mento: 0.08, zigomi: 0.12, fronte: 1.09, alto: 0.98 },
  affilato: { largo: 0.96, mascella: 0.68, mento: 0.13, zigomi: 0.15, fronte: 0.94, alto: 1.02 },
  lungo: { largo: 0.92, mascella: 0.88, mento: 0.1, zigomi: 0.04, fronte: 0.95, alto: 1.1 },
});

/* Il naso: lunghezza del dorso, quanto esce, quanto e' largo alla base, e se
 * la punta guarda in su. */
export const NASI = Object.freeze({
  dritto: { fuori: 0.2, largo: 1, punta: -0.34, su: 0 },
  piccolo: { fuori: 0.15, largo: 0.86, punta: -0.28, su: 0.02 },
  pronunciato: { fuori: 0.28, largo: 1.04, punta: -0.4, su: -0.03 },
  largo: { fuori: 0.19, largo: 1.3, punta: -0.35, su: 0 },
  allinsu: { fuori: 0.2, largo: 1.02, punta: -0.3, su: 0.06 },
});

export const CORPI = Object.freeze({
  normale: { spalle: 1, faccia: 1 },
  magra: { spalle: 0.88, faccia: 0.93 },
  robusta: { spalle: 1.16, faccia: 1.1 },
});

/**
 * Dove finisce un punto del cranio dopo la scultura.
 * @param {{x:number,y:number,z:number}} p punto sull'ellissoide di partenza
 * @param {object} t i parametri dei tratti
 */
export function sculpisci(p, t) {
  let { x, y, z } = p;
  const cranio = t.cranio;
  const naso = t.naso;

  /* 1. Le proporzioni generali: larghezza del cranio, altezza, e la fronte
   *    che nelle facce a cuore e' piu' larga del resto. */
  x *= cranio.largo * t.faccia;
  y *= cranio.alto;
  if (y > 0.15) x *= mix(1, cranio.fronte, clamp((y - 0.15) / 0.6, 0, 1));

  /* 2. La mascella: sotto gli zigomi il viso si stringe verso il mento, e
   *    quanto lo fa e' quello che distingue un viso squadrato da uno
   *    affilato. */
  if (y < 0.05) {
    const giu = clamp((0.05 - y) / 0.95, 0, 1);
    const stretta = mix(1, cranio.mascella, giu * giu);
    x *= stretta;
    z *= mix(1, mix(1, cranio.mascella, 0.55), giu * giu);
  }

  /* 3. Il mento: si allunga in basso e sporge un poco in avanti. */
  const alMento = campana((y + 0.86) / 0.34) * clamp(z + 0.4, 0, 1);
  y -= alMento * cranio.mento;
  z += alMento * cranio.mento * 0.7;

  /* 4. La nuca: il cranio non e' una palla, dietro e' piu' lungo. */
  if (z < 0) z *= mix(1.16, 1, clamp((y + 0.4) / 1.4, 0, 1));

  /* 5. L'arcata sopraccigliare: la sporgenza sopra gli occhi, quella che da'
   *    sola distingue una faccia adulta da una di plastica. */
  const arcata = campana((y - 0.26) / 0.15) * campana(x / 0.62) * clamp(z, 0, 1);
  z += arcata * 0.11 * t.arcata;

  /* 6. Le orbite: due conche, e dentro ci staranno i bulbi. */
  const orbita =
    campana((Math.abs(x) - 0.3) / 0.19) * campana((y - 0.08) / 0.17) * clamp(z - 0.2, 0, 1);
  z -= orbita * 0.155;

  /* 7. Gli zigomi e le guance: il rilievo alto e la conca sotto. */
  const zigomo = campana((Math.abs(x) - 0.45) / 0.24) * campana((y + 0.06) / 0.2) * clamp(z, 0, 1);
  z += zigomo * (0.07 + cranio.zigomi);
  const guancia = campana((Math.abs(x) - 0.4) / 0.22) * campana((y + 0.36) / 0.22) * clamp(z, 0, 1);
  z -= guancia * 0.055 * (1 - t.guance);

  /* 8. Il naso: il dorso che scende dalla radice alla punta, le ali che si
   *    allargano in basso, e la punta che puo' guardare in su. */
  const lungoNaso = clamp((0.28 - y) / 0.52, 0, 1);
  const dorso = campana(x / (0.085 * naso.largo)) * campana((y - naso.punta - 0.14) / 0.26);
  const punta = campana(x / (0.15 * naso.largo)) * campana((y - naso.punta) / 0.09);
  const ali =
    campana((Math.abs(x) - 0.13 * naso.largo) / (0.07 * naso.largo)) *
    campana((y - naso.punta + 0.01) / 0.07);
  const davanti = clamp((z - 0.3) / 0.7, 0, 1);
  z += (dorso * 0.135 + punta * 0.2 + ali * 0.06) * naso.fuori * 5 * davanti * lungoNaso;
  y += punta * naso.su * davanti;
  /* Le narici: due fossette sotto le ali, e il solco che le separa dalla
   * guancia. Senza, il naso e' un pomello appiccicato. */
  const narice =
    campana((Math.abs(x) - 0.085 * naso.largo) / (0.035 * naso.largo)) *
    campana((y - naso.punta + 0.048) / 0.028);
  z -= narice * 0.055 * davanti;
  const solcoAla =
    campana((Math.abs(x) - 0.155 * naso.largo) / (0.045 * naso.largo)) *
    campana((y - naso.punta + 0.015) / 0.055);
  z -= solcoAla * 0.03 * davanti;

  /* 9. Le labbra: il rilievo di sopra e quello di sotto, col solco in mezzo. */
  const bocca = campana(x / 0.24) * clamp(z - 0.2, 0, 1);
  const sopra = campana((y + 0.4) / 0.05) * bocca;
  const sotto = campana((y + 0.52) / 0.062) * bocca;
  const solco = campana((y + 0.46) / 0.02) * bocca;
  z += sopra * 0.05 * t.labbra + sotto * 0.062 * t.labbra - solco * 0.045;
  /* Il filtro, la valletta fra naso e labbro. */
  z -= campana(x / 0.05) * campana((y + 0.33) / 0.045) * 0.026 * clamp(z - 0.2, 0, 1);

  /* 10. Le tempie: una leggera conca, altrimenti il cranio e' un pallone. */
  z -= campana((Math.abs(x) - 0.62) / 0.16) * campana((y - 0.34) / 0.2) * 0.03 * clamp(z, 0, 1);

  return { x, y, z };
}

/* ── La maglia ────────────────────────────────────────────────────────── */

class Maglia {
  constructor() {
    this.pos = [];
    this.col = [];
    this.mat = [];
    this.tri = [];
  }

  vertice(x, y, z, colore, materiale) {
    this.pos.push(x, y, z);
    this.col.push(colore[0], colore[1], colore[2]);
    this.mat.push(materiale);
    return this.pos.length / 3 - 1;
  }

  triangolo(a, b, c) {
    this.tri.push(a, b, c);
  }

  /** Una griglia di vertici gia' creati diventa triangoli. */
  griglia(indici, righe, colonne, chiudi) {
    for (let i = 0; i < righe - 1; i += 1)
      for (let j = 0; j < colonne - (chiudi ? 0 : 1); j += 1) {
        const j2 = (j + 1) % colonne;
        const a = indici[i * colonne + j];
        const b = indici[i * colonne + j2];
        const c = indici[(i + 1) * colonne + j];
        const d = indici[(i + 1) * colonne + j2];
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;
        /* L'ordine dei vertici e' quello che dice al rasterizzatore da che
         * parte guarda il triangolo: sbagliarlo vuol dire disegnare la testa
         * vista da dentro — un uovo liscio, con la luce dalla parte sbagliata. */
        this.triangolo(a, b, c);
        this.triangolo(b, d, c);
      }
  }
}

/* Le normali si calcolano dai triangoli e si mediano sui vertici: e' la media
 * a rendere la superficie liscia invece che sfaccettata. */
function normali(maglia) {
  const n = new Float32Array(maglia.pos.length);
  const p = maglia.pos;
  for (let t = 0; t < maglia.tri.length; t += 3) {
    const a = maglia.tri[t] * 3;
    const b = maglia.tri[t + 1] * 3;
    const c = maglia.tri[t + 2] * 3;
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a];
    const vy = p[c + 1] - p[a + 1];
    const vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const base of [a, b, c]) {
      n[base] += nx;
      n[base + 1] += ny;
      n[base + 2] += nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

/* Un ellissoide scolpito: e' il pezzo con cui si fanno testa, bulbi e collo. */
function superficie(maglia, righe, colonne, punto, colore, materiale, chiudi = true) {
  const indici = [];
  for (let i = 0; i < righe; i += 1) {
    const v = i / (righe - 1);
    for (let j = 0; j < colonne; j += 1) {
      const u = j / colonne;
      /* Un punto puo' mancare — il taglio degli occhi, il capello dove il
       * taglio non arriva — e allora il quadretto attorno non si chiude. Una
       * buccia appoggiata esattamente sulla pelle non si vede: si vede il
       * litigio fra le due, a puntini. */
      const p = punto(u, v);
      indici.push(
        p ? maglia.vertice(p.x, p.y, p.z, p.c || colore, p.m === undefined ? materiale : p.m) : -1,
      );
    }
  }
  maglia.griglia(indici, righe, colonne, chiudi);
  return indici;
}

/* Quanto un punto e' «dentro» una regione ellittica del viso, da 1 al centro
 * a 0 sul bordo: e' con questo che si dipingono labbra, sopracciglia e ciglia
 * sulla pelle, invece di appiccicarci sopra altri pezzi. */
function dentro(x, y, cx, cy, rx, ry, morbidezza = 0.35) {
  const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
  if (d >= 1) return 0;
  if (d <= 1 - morbidezza) return 1;
  const k = (1 - d) / morbidezza;
  return k * k * (3 - 2 * k);
}

const misto = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/* Dove stanno gli occhi: il centro, e quanto e' aperta la palpebra. Sono le
 * stesse coordinate per il taglio nella pelle e per il bulbo che ci va
 * dentro — un solo posto da cambiare. */
/* La mandorla: un occhio non e' un'ellisse, ha gli angoli appuntiti. Vale 1
 * dentro il taglio e 0 fuori, e i due angoli si chiudono a punta perche'
 * l'altezza va a zero come una radice, non come un cerchio. */
function mandorla(x, y, cx, cy, rx, ry) {
  const d = Math.abs(x - cx) / rx;
  if (d >= 1) return 0;
  const h = ry * (1 - d * d) ** 0.62;
  const q = Math.abs(y - cy) / (h || 1e-6);
  if (q >= 1) return 0;
  /* Non piu' «dentro o fuori»: quanto. Il bordo si spegne in fretta ma non
   * di scatto, ed e' quel poco a dare la palpebra invece di uno scalino. */
  const k = Math.min(1, (1 - q) / 0.34) * Math.min(1, (1 - d) / 0.3);
  return k * k * (3 - 2 * k);
}

export const OCCHIO = Object.freeze({
  x: 0.3,
  y: 0.05,
  rx: 0.152,
  ry: 0.093,
  raggio: 0.125,
  z: 0.452,
});

/**
 * La maglia completa di una testa, dai tratti gia' normalizzati.
 * @returns {{pos:Float32Array,nor:Float32Array,col:Float32Array,mat:Uint8Array,tri:Uint32Array}}
 */
export function buildHeadMesh(tratti, { righe = 84, colonne = 112 } = {}) {
  const maglia = new Maglia();
  const t = tratti;
  const pelle = t.pelle;
  const pelleScura = [pelle[0] * 0.72, pelle[1] * 0.66, pelle[2] * 0.62];
  const labbra = t.labbraColore || [0.72, 0.42, 0.36];
  const capelli = t.capelliColore || [0.25, 0.18, 0.14];
  const apertura = t.apertura === undefined ? 1 : t.apertura;
  /* Le maschere — il taglio degli occhi, le labbra, le sopracciglia, la
   * barba — sono scritte in coordinate canoniche: quelle di un viso ovale.
   * Ma i punti arrivano gia' scolpiti, e su un viso lungo o largo sarebbero
   * in un altro posto. Si torna indietro dividendo per le stesse scale, e
   * cosi' un paio di occhi resta un paio di occhi su tutte e sei le forme. */
  const scalaX = t.cranio.largo * t.faccia;
  const scalaY = t.cranio.alto;
  const occhioX = OCCHIO.x * scalaX;
  const occhioY = OCCHIO.y * scalaY;

  /* ── La testa, col taglio degli occhi ────────────────────────────────── */
  const punti = [];
  const indici = new Int32Array(righe * colonne).fill(-1);
  for (let i = 0; i < righe; i += 1) {
    const theta = (i / (righe - 1)) * Math.PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let j = 0; j < colonne; j += 1) {
      const phi = (j / colonne) * TAU;
      const base = { x: st * Math.cos(phi) * 0.75, y: ct * 0.92, z: st * Math.sin(phi) * 0.8 };
      const p = sculpisci(base, t);
      punti.push(p);
      const qx = p.x / scalaX;
      const qy = p.y / scalaY;
      /* Il taglio: dove ci va l'occhio, la pelle non c'e'. Fuori dal davanti
       * del viso non si taglia niente, o si aprirebbe anche la nuca. */
      const davanti = p.z > 0.15;
      /* La palpebra non si ritaglia: la pelle dell'apertura sprofonda DIETRO
       * il bulbo, e il bordo che si vede e' il punto in cui le due superfici
       * si incrociano — che lo z-buffer trova al pixel, liscio, invece che
       * sul reticolo dei quadretti, a scalini. */
      const occhio = davanti
        ? Math.max(
            mandorla(qx, qy, -OCCHIO.x, OCCHIO.y - 0.006, OCCHIO.rx, OCCHIO.ry * apertura),
            mandorla(qx, qy, OCCHIO.x, OCCHIO.y - 0.006, OCCHIO.rx, OCCHIO.ry * apertura),
          )
        : 0;
      if (occhio > 0) p.z -= occhio * 0.4;

      /* Il colore dipinto sulla pelle: le labbra, le sopracciglia, la linea
       * delle ciglia che borda il taglio, e l'ombra sotto il mento. */
      let c = pelle;
      /* L'occlusione, cotta nel colore. Il rasterizzatore non getta ombre —
       * costerebbe quanto tutto il resto — ma le pieghe dove la luce non
       * entra le sappiamo gia': l'orbita, sotto il naso, l'attaccatura dei
       * capelli, sotto la mascella, dietro l'orecchio. Dipingerle li' costa
       * zero e sono meta' del volume. */
      let ao = 1;
      ao -=
        0.3 *
        dentro(qx, qy, -OCCHIO.x, OCCHIO.y, OCCHIO.rx * 1.9, OCCHIO.ry * 3.4, 0.9) *
        (davanti ? 1 : 0);
      ao -=
        0.3 *
        dentro(qx, qy, OCCHIO.x, OCCHIO.y, OCCHIO.rx * 1.9, OCCHIO.ry * 3.4, 0.9) *
        (davanti ? 1 : 0);
      ao -=
        0.22 * campana((qy - t.naso.punta + 0.045) / 0.05) * campana(qx / 0.14) * (davanti ? 1 : 0);
      ao -= 0.26 * campana((qy + 1.02) / 0.16) * clamp(p.z + 0.2, 0, 1);
      ao -= 0.3 * campana((Math.abs(qx) - 0.66) / 0.09) * campana((qy + 0.02) / 0.26);
      if (t.ombraCapelli) ao -= t.ombraCapelli(qx, qy, p.z);
      ao = clamp(ao, 0.42, 1);
      c = [pelle[0] * ao, pelle[1] * ao, pelle[2] * ao];
      if (davanti) {
        const bocca = dentro(qx, qy, 0, -0.46, 0.245, 0.105, 0.4);
        if (bocca > 0)
          c = misto(
            c,
            [labbra[0] * ao, labbra[1] * ao, labbra[2] * ao],
            bocca * 0.92 * t.labbraForza,
          );
        /* La rima: la fessura fra le due labbra. Senza, la bocca e' una
         * macchia di colore. */
        const rima = dentro(qx, qy, 0, -0.462, 0.2, 0.014, 0.75);
        if (rima > 0)
          c = misto(c, [labbra[0] * 0.3, labbra[1] * 0.2, labbra[2] * 0.2], rima * 0.85);
        const sopracciglio = Math.max(
          dentro(
            qx,
            qy,
            -0.3,
            0.185 + t.sopraccigliaAlto,
            0.2 * t.sopraccigliaLargo,
            0.072 * t.sopraccigliaSpesso,
            0.34,
          ),
          dentro(
            qx,
            qy,
            0.3,
            0.185 + t.sopraccigliaAlto,
            0.2 * t.sopraccigliaLargo,
            0.072 * t.sopraccigliaSpesso,
            0.34,
          ),
        );
        if (sopracciglio > 0)
          c = misto(
            c,
            [
              t.sopraccigliaColore[0] * ao,
              t.sopraccigliaColore[1] * ao,
              t.sopraccigliaColore[2] * ao,
            ],
            sopracciglio,
          );
        const ciglia = Math.max(
          dentro(qx, qy, -OCCHIO.x, OCCHIO.y, OCCHIO.rx * 1.18, OCCHIO.ry * apertura * 1.5, 0.6),
          dentro(qx, qy, OCCHIO.x, OCCHIO.y, OCCHIO.rx * 1.18, OCCHIO.ry * apertura * 1.5, 0.6),
        );
        if (ciglia > 0)
          c = misto(c, [pelleScura[0] * ao, pelleScura[1] * ao, pelleScura[2] * ao], ciglia * 0.6);
        /* La barba, dipinta come ombra sulla pelle: dove c'e', il colore
         * della pelle scende verso quello del pelo. */
        if (t.barba) {
          const zona = t.barba(qx, qy, p.z);
          if (zona > 0) c = misto(c, t.barbaColore, zona * t.barbaForza);
        }
      }
      indici[i * colonne + j] = maglia.vertice(p.x, p.y, p.z, c, MAT.PELLE);
    }
  }
  /* I quadretti si chiudono solo dove ci sono tutti e quattro gli angoli:
   * attorno al taglio degli occhi il bordo resta aperto, ed e' giusto —
   * dietro c'e' il bulbo. */
  for (let i = 0; i < righe - 1; i += 1)
    for (let j = 0; j < colonne; j += 1) {
      const j2 = (j + 1) % colonne;
      const a = indici[i * colonne + j];
      const b = indici[i * colonne + j2];
      const c = indici[(i + 1) * colonne + j];
      const d = indici[(i + 1) * colonne + j2];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      maglia.triangolo(a, b, c);
      maglia.triangolo(b, d, c);
    }

  /* ── I bulbi ─────────────────────────────────────────────────────────── */
  for (const lato of [-1, 1]) {
    superficie(
      maglia,
      28,
      36,
      (u, v) => {
        const theta = v * Math.PI;
        const phi = u * TAU;
        const st = Math.sin(theta);
        const x = st * Math.cos(phi);
        const y = Math.cos(theta);
        const z = st * Math.sin(phi);
        /* L'iride sta sul davanti del bulbo, e la pupilla dentro l'iride. */
        const versoNoi = z;
        const raggio = Math.hypot(x, y);
        let c = [0.9, 0.885, 0.87];
        let m = MAT.SCLERA;
        if (versoNoi > 0.36 && raggio < 0.64) {
          c = t.irideColore;
          m = MAT.IRIDE;
          if (raggio < 0.22) {
            c = [0.04, 0.035, 0.04];
            m = MAT.PUPILLA;
          }
        } else if (versoNoi > 0.2) {
          /* Il velo rossastro agli angoli, che nessun occhio finto ha. */
          c = misto(c, [0.86, 0.7, 0.68], 0.5);
        }
        /* La cornea: una cupoletta sopra l'iride. E' lei a prendere il
         * riflesso che fa «vivo» un occhio. */
        const cornea = versoNoi > 0.36 && raggio < 0.68 ? 1.04 : 1;
        return {
          x: lato * occhioX + x * OCCHIO.raggio * cornea,
          y: occhioY + y * OCCHIO.raggio * cornea,
          z: OCCHIO.z + z * OCCHIO.raggio * cornea,
          c,
          m,
        };
      },
      [0.9, 0.885, 0.87],
      MAT.SCLERA,
    );
  }

  /* ── Le orecchie ─────────────────────────────────────────────────────── */
  const orecchio = t.orecchio;
  for (const lato of [-1, 1]) {
    superficie(
      maglia,
      22,
      26,
      (u, v) => {
        const theta = v * Math.PI;
        const phi = u * TAU;
        const st = Math.sin(theta);
        const x = st * Math.cos(phi);
        const y = Math.cos(theta);
        const z = st * Math.sin(phi);
        /* Un ellissoide schiacciato, con la conca scavata al centro. */
        const conca =
          1 - 0.42 * campana((Math.hypot(y * 1.1, z * 1.6) - 0.15) / 0.55) * (x * lato > 0 ? 1 : 0);
        return {
          x: lato * (0.71 * t.faccia * t.cranio.largo) + x * 0.105 * orecchio.fuori * lato * conca,
          y: -0.02 + y * 0.235 * orecchio.grande,
          z: -0.05 + z * 0.15 * orecchio.grande,
          c: pelle,
          m: MAT.PELLE,
        };
      },
      pelle,
      MAT.PELLE,
    );
  }

  /* ── Il collo e le spalle ────────────────────────────────────────────── */
  superficie(
    maglia,
    16,
    40,
    (u, v) => {
      const phi = u * TAU;
      /* Dal sotto-mento fino alle spalle, allargandosi. */
      const y = mix(-0.62, -1.56, v);
      const largo = mix(0.335, 0.52, v * v);
      return {
        x: Math.cos(phi) * largo,
        y,
        z: Math.sin(phi) * largo * 0.92 - 0.04,
        c: v > 0.72 ? t.vestitoColore : pelle,
        m: v > 0.72 ? MAT.VESTITO : MAT.PELLE,
      };
    },
    pelle,
    MAT.PELLE,
  );
  superficie(
    maglia,
    18,
    44,
    (u, v) => {
      const theta = v * Math.PI;
      const phi = u * TAU;
      const st = Math.sin(theta);
      return {
        x: st * Math.cos(phi) * 1.72 * t.spalle,
        y: -1.95 + Math.cos(theta) * 0.66,
        z: st * Math.sin(phi) * 0.56,
        c: t.vestitoColore,
        m: MAT.VESTITO,
      };
    },
    t.vestitoColore,
    MAT.VESTITO,
  );

  /* ── La barba, come buccia ───────────────────────────────────────────
   * Dipinta e basta, una barba bianca su pelle chiara sparisce. Con un po'
   * di spessore invece prende la sua luce e la sua ombra, come quella vera. */
  if (t.barba && t.barbaSpessore > 0) {
    superficie(
      maglia,
      64,
      80,
      (u, v) => {
        const theta = v * Math.PI;
        const phi = u * TAU;
        const st = Math.sin(theta);
        const base = {
          x: st * Math.cos(phi) * 0.75,
          y: Math.cos(theta) * 0.92,
          z: st * Math.sin(phi) * 0.8,
        };
        const p = sculpisci(base, t);
        if (p.z < 0) return null;
        const zona = t.barba(p.x / scalaX, p.y / scalaY, p.z);
        /* Dove la barba non c'e', la buccia deve sprofondare TANTO: piu' a
         * fondo di quanto sprofondi la pelle dell'apertura degli occhi, o
         * spunterebbe li' dentro come una macchia bianca. Un pelo dentro
         * l'occhio e' il genere di cosa che si nota subito. */
        const oltre = zona - 0.34;
        const spessore = oltre > 0 ? oltre * t.barbaSpessore : oltre * t.barbaSpessore * 34;
        if (spessore < -0.9) return null;
        const l = Math.hypot(p.x, p.y, p.z) || 1;
        const k = Math.max(0.22, 1 + spessore / l);
        return { x: p.x * k, y: p.y * k, z: p.z * k, c: t.barbaColore, m: MAT.CAPELLI };
      },
      t.barbaColore,
      MAT.CAPELLI,
    );
  }

  /* ── I capelli ───────────────────────────────────────────────────────── */
  if (t.capelli) {
    superficie(
      maglia,
      righe,
      colonne,
      (u, v) => {
        const theta = v * Math.PI;
        const phi = u * TAU;
        const st = Math.sin(theta);
        const base = {
          x: st * Math.cos(phi) * 0.75,
          y: Math.cos(theta) * 0.92,
          z: st * Math.sin(phi) * 0.8,
        };
        const p = sculpisci(base, t);
        /* Quanto capello c'e' in questo punto: e' la forma del taglio. Zero
         * vuol dire che la buccia sta appiccicata al cranio e non si vede. */
        /* Lo spessore e' con segno, e questa e' tutta la faccenda: dove il
         * taglio non arriva la buccia non sparisce, sprofonda DENTRO il
         * cranio. Cosi' l'attaccatura non e' il bordo dei quadretti — che a
         * questa risoluzione sarebbe una sega — ma il punto in cui le due
         * superfici si incrociano, e quello lo trova lo z-buffer al pixel. */
        const spessore = t.capelli(p.x / scalaX, p.y / scalaY, p.z);
        /* Il taglio si fa SOLO davanti al viso, dove sotto ci sono i bulbi e
         * la buccia sprofondata li attraverserebbe. Ai lati e dietro non si
         * taglia: e' li' che il bordo dei quadretti si vedrebbe come una
         * sega, e li' invece la buccia puo' sprofondare quanto vuole. */
        /* La zona da proteggere e' solo quella dei bulbi: piu' stretta e'
         * meglio e', perche' fuori di li' il taglio non serve e si vede. */
        const davantiAlViso = p.z > 0.3 && p.y < 0.3 && Math.abs(p.x) < 0.52;
        if (spessore < (davantiAlViso ? -0.03 : -1.4)) return null;
        const l = Math.hypot(p.x, p.y, p.z) || 1;
        /* E mai oltre il centro della testa, o la buccia si rivolterebbe e
         * spunterebbe dall'altra parte. */
        const k = Math.max(0.22, 1 + spessore / l);
        return { x: p.x * k, y: p.y * k, z: p.z * k, c: capelli, m: MAT.CAPELLI };
      },
      capelli,
      MAT.CAPELLI,
    );
  }

  return finisci(maglia);
}

export function finisci(maglia) {
  return {
    pos: Float32Array.from(maglia.pos),
    nor: normali(maglia),
    col: Float32Array.from(maglia.col),
    mat: Uint8Array.from(maglia.mat),
    tri: Uint32Array.from(maglia.tri),
  };
}

export { Maglia, superficie, campana, clamp, mix, TAU };
