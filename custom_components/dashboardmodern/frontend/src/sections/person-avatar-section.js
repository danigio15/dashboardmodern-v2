/* Il ritratto appeso al documento, e la vita che ci si mette dentro.
 *
 * Il modello dice quali due immagini servono e come incastrarle; qui si
 * incastrano davvero, su una tela, e poi si fa respirare la persona.
 *
 * Tre regole, e sono quelle che tengono la plancia leggera:
 *
 *  - si compone UNA volta per faccia. La stessa faccia da' sempre lo stesso
 *    ritratto: si tiene in memoria e non si rifa';
 *  - il respiro e l'oscillazione sono CSS. Costano zero perche' li fa il
 *    compositore, non il filo principale;
 *  - il battito di ciglia NON e' un ciclo continuo. Sta fermo, si sveglia
 *    per i trecento millisecondi del battito e torna a dormire. Una plancia
 *    con quattro persone, ferma, non disegna niente.
 *
 * Le palpebre si disegnano sopra gli occhi, che lo script di build ha gia'
 * trovato e misurato, col colore preso dalla guancia della persona stessa —
 * cosi' combaciano con qualunque carnagione senza saperla.
 */
import { AVATAR_LATO, BARBA_LUNGA_EXTRA, risolviAvatar3d } from "../core/avatar-3d.js";
import { doc, installStyle, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_AVATAR_3D__";
const state = (root[KEY] ||= { immagini: new Map(), composti: new Map(), tele: new Set(), sveglia: 0 });

/* Le immagini stanno fuori dal grafo dei moduli — sono file, non codice — e
 * quindi non hanno un `import.meta.url` da cui dedurre l'indirizzo. Si
 * ricava dal nostro, togliendo la versione: le figure non cambiano da un
 * rilascio all'altro, e tenerle fuori dalla versione vuol dire non
 * riscaricarle a ogni aggiornamento. */
function cartella() {
  const qui = import.meta.url;
  const taglio = qui.indexOf("/dashboardmodern_static/");
  if (taglio < 0) return "../../avatars/";
  return `${qui.slice(0, taglio)}/dashboardmodern_static/avatars/`;
}

function immagine(nome) {
  const avuta = state.immagini.get(nome);
  if (avuta) return avuta;
  const attesa = new Promise((risolvi) => {
    const img = new Image();
    img.onload = () => risolvi(img);
    img.onerror = () => risolvi(null);
    img.src = `${cartella()}${nome}.webp`;
  });
  state.immagini.set(nome, attesa);
  return attesa;
}

/* ── Le operazioni sui pixel ──────────────────────────────────────────────
 *
 * Il modello dichiara i ritocchi — tinte, barba, iridi, occhiali, abiti —
 * come dati; qui ognuno diventa lavoro su una tela. Le formule sono quelle
 * del laboratorio che le ha provate a occhio, e non si reinterpretano:
 * stessa luminanza preservata nelle tinte, stesso confine a mandibola per
 * la barba, stessa finestra di tinta per gli abiti.
 */

/* Un pixel e' pelo quando e' scuro: la stessa soglia del laboratorio. */
const PELO = 110;

/* La tinta a luminanza preservata: il colore pieno va sul pixel scalato
 * dalla sua luce (`k`, con `lift` che schiarisce la resa complessiva), e il
 * peso cresce quanto piu' il pixel e' scuro — cioe' quanto piu' e' pelo. */
function tingiPixel(dati, i, [tr, tg, tb], lift) {
  const r = dati[i],
    g = dati[i + 1],
    b = dati[i + 2];
  const m = Math.max(r, g, b);
  if (m >= PELO) return;
  const lum = (r + g + b) / 3;
  const k = 0.35 + lift + (0.65 - lift * 0.5) * (lum / PELO);
  const peso = Math.min(1, (PELO - m) / 60);
  dati[i] = r + (Math.min(255, tr * k) - r) * peso;
  dati[i + 1] = g + (Math.min(255, tg * k) - g) * peso;
  dati[i + 2] = b + (Math.min(255, tb * k) - b) * peso;
}

/* La chioma: i pixel scuri nella parte alta (capelli e sopracciglia). */
function tintaCapelli(dati, lato, rgb, lift) {
  for (let y = 0; y < lato * 0.52; y += 1)
    for (let x = 0; x < lato; x += 1) {
      const i = (y * lato + x) * 4;
      if (dati[i + 3] >= 40) tingiPixel(dati, i, rgb, lift);
    }
}

/* Il confine capelli/barba: una parabola alta al centro del viso (per
 * prendere i baffi) e piu' bassa ai lati (per non mangiare i capelli sopra
 * le orecchie). La barba e' l'insieme dei pixel scuri sotto quel confine —
 * basette comprese. */
const confine = (x, lato, centro = 0.46, alzata = 0.09) =>
  lato * (centro + alzata * ((x - lato / 2) / (lato / 2)) ** 2);

/* La campana della barba: quanto puo' allargarsi dal centro del viso, riga
 * per riga. Al livello della bocca arriva alle guance, verso il mento si
 * stringe. Dal campo: «la barba sul viso non e' precisa» — senza questo
 * limite le ciocche lunghe ai lati del viso (la donna, il neutro coi capelli
 * sciolti) finivano nella maschera e diventavano barba, e il pelo saliva
 * sulle guance fino agli occhi. */
function dentroLaCampana(x, y, lato) {
  const dalCentro = Math.abs(x - lato / 2) / (lato / 2);
  const quota = y / lato;
  /* Da 0.62 di semi-larghezza alla bocca a 0.34 sotto il mento. */
  const semiLarghezza = quota < 0.68 ? 0.62 : 0.62 - ((quota - 0.68) / 0.29) * 0.28;
  return dalCentro <= semiLarghezza;
}

function mascheraBarba(dati, lato) {
  const maschera = new Uint8Array(lato * lato);
  for (let y = Math.floor(lato * 0.36); y < lato * 0.97; y += 1)
    for (let x = 0; x < lato; x += 1) {
      const i = (y * lato + x) * 4;
      if (
        dati[i + 3] > 40 &&
        Math.max(dati[i], dati[i + 1], dati[i + 2]) < PELO &&
        y > confine(x, lato) &&
        dentroLaCampana(x, y, lato)
      )
        maschera[y * lato + x] = 1;
    }
  return maschera;
}

/* Colore pelle: la fronte, l'unico punto sicuramente nudo su una faccia
 * barbuta. */
function guancia(dati, lato) {
  const i = (Math.round(lato * 0.34) * lato + Math.round(lato * 0.5)) * 4;
  return [dati[i], dati[i + 1], dati[i + 2]];
}

/* Lo strato-barba: una tela con i soli pixel della maschera, e l'alfa
 * ammorbidita con una piccola sfocatura — due passate di media mobile, che
 * di una gaussiana stretta sono la sorella povera e indistinguibile. */
function stratoBarba(dati, maschera, lato) {
  const strato = doc.createElement("canvas");
  strato.width = strato.height = lato;
  const pennello = strato.getContext("2d");
  const uscita = pennello.createImageData(lato, lato);
  const fuori = uscita.data;
  for (let p = 0; p < maschera.length; p += 1)
    if (maschera[p]) {
      const i = p * 4;
      fuori[i] = dati[i];
      fuori[i + 1] = dati[i + 1];
      fuori[i + 2] = dati[i + 2];
      fuori[i + 3] = dati[i + 3];
    }
  for (let passata = 0; passata < 2; passata += 1) {
    const prima = new Uint8ClampedArray(lato * lato);
    for (let p = 0; p < prima.length; p += 1) prima[p] = fuori[p * 4 + 3];
    for (let y = 1; y < lato - 1; y += 1)
      for (let x = 1; x < lato - 1; x += 1) {
        const p = y * lato + x;
        fuori[p * 4 + 3] =
          (prima[p] * 2 + prima[p - 1] + prima[p + 1] + prima[p - lato] + prima[p + lato]) / 6;
      }
  }
  pennello.putImageData(uscita, 0, 0);
  return strato;
}

/* La barba, in tutte le sue vesti: tinta, rasata, corta, lunga; sulla testa
 * stessa quando il render la porta gia', trapiantata da una donatrice della
 * stessa carnagione quando no. `innesto` — scala e angolo con cui la tela
 * della donatrice atterra su questa — lo ha gia' calcolato il modello. */
function applicaBarba(telaTesta, op, donatrice) {
  const lato = AVATAR_LATO;
  const pennello = telaTesta.getContext("2d");
  let dati;
  if (donatrice) {
    const appoggio = doc.createElement("canvas");
    appoggio.width = appoggio.height = lato;
    const suo = appoggio.getContext("2d");
    suo.drawImage(donatrice, 0, 0, lato, lato);
    dati = suo.getImageData(0, 0, lato, lato).data;
  } else {
    dati = pennello.getImageData(0, 0, lato, lato).data;
  }
  const maschera = mascheraBarba(dati, lato);
  if (op.rgb)
    for (let p = 0; p < maschera.length; p += 1) if (maschera[p]) tingiPixel(dati, p * 4, op.rgb, op.lift || 0);
  if (op.foggia === "rasata") {
    /* Barba dissolta verso la pelle: l'ombra corta del rasato. */
    const [sr, sg, sb] = guancia(dati, lato);
    for (let p = 0; p < maschera.length; p += 1)
      if (maschera[p]) {
        const i = p * 4;
        dati[i] += (sr - dati[i]) * 0.62;
        dati[i + 1] += (sg - dati[i + 1]) * 0.62;
        dati[i + 2] += (sb - dati[i + 2]) * 0.62;
      }
  }

  /* La coda della barba lunga: il pezzo basso dello strato, stirato in giu'
   * su una tela che si e' gia' allungata apposta. */
  const coda = (destinazione, strato) => {
    let y0 = lato,
      y1 = 0;
    for (let p = 0; p < maschera.length; p += 1)
      if (maschera[p]) {
        const y = (p / lato) | 0;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    if (y1 <= y0) return;
    const meta = y0 + Math.floor(((y1 - y0) * 3) / 5);
    destinazione.drawImage(
      strato,
      0,
      meta,
      lato,
      y1 - meta,
      lato * 0.05,
      meta,
      lato * 0.9,
      (y1 - meta) * 2.1,
    );
  };

  if (donatrice) {
    const strato = stratoBarba(dati, maschera, lato);
    const { scala, x, y } = op.innesto || { scala: 1, x: 0, y: 0 };
    /* Il pelo trapiantato aderisce al viso che lo riceve: `source-atop`
     * disegna solo dove la testa ha gia' pixel, e la barba di una donatrice
     * piu' larga non sborda piu' oltre le guance e il mento («la barba sul
     * viso non e' precisa»). Solo la coda della lunga resta libera: deve
     * pendere SOTTO il mento, fuori dalla sagoma. */
    if (op.foggia === "lunga") {
      /* Prima si allunga nello spazio della donatrice, poi si innesta. */
      const pieno = doc.createElement("canvas");
      pieno.width = lato;
      pieno.height = Math.round(lato * (1 + BARBA_LUNGA_EXTRA));
      const suo = pieno.getContext("2d");
      coda(suo, strato);
      pennello.drawImage(pieno, x, y, lato * scala, pieno.height * scala);
      pennello.save();
      pennello.globalCompositeOperation = "source-atop";
      pennello.drawImage(strato, x, y, lato * scala, lato * scala);
      pennello.restore();
    } else {
      pennello.save();
      pennello.globalCompositeOperation = "source-atop";
      pennello.drawImage(strato, x, y, lato * scala, lato * scala);
      pennello.restore();
    }
  } else {
    const ritocco = pennello.createImageData(lato, lato);
    ritocco.data.set(dati);
    pennello.putImageData(ritocco, 0, 0);
    if (op.foggia === "lunga") {
      const strato = stratoBarba(dati, maschera, lato);
      coda(pennello, strato);
      pennello.drawImage(strato, 0, 0);
    }
  }
}

/* L'iride tinta, dentro i riquadri degli occhi misurati in build: si spostano
 * i pixel che non sono ne' chiari (la sclera) ne' scurissimi (la pupilla),
 * conservando la luce e con la mano leggera — un'iride e' un cerchio di due
 * millimetri, non un faro. */
function tintaIride(telaTesta, occhi, [tr, tg, tb]) {
  const lato = AVATAR_LATO;
  const pennello = telaTesta.getContext("2d");
  const riferimento = (tr + tg + tb) / 3 || 1;
  for (const occhio of occhi || []) {
    const x0 = Math.max(0, Math.round(occhio.cx - occhio.w * 0.55));
    const y0 = Math.max(0, Math.round(occhio.cy - occhio.h * 0.75));
    const larghezza = Math.min(lato - x0, Math.round(occhio.w * 1.1));
    const altezza = Math.min(lato - y0, Math.round(occhio.h * 1.5));
    if (larghezza <= 0 || altezza <= 0) continue;
    const zona = pennello.getImageData(x0, y0, larghezza, altezza);
    const dati = zona.data;
    for (let i = 0; i < dati.length; i += 4) {
      if (dati[i + 3] < 200) continue;
      const m = Math.max(dati[i], dati[i + 1], dati[i + 2]);
      if (m > 200 || m < 45) continue;
      const k = (dati[i] + dati[i + 1] + dati[i + 2]) / 3 / riferimento;
      dati[i] += (Math.min(255, tr * k) - dati[i]) * 0.55;
      dati[i + 1] += (Math.min(255, tg * k) - dati[i + 1]) * 0.55;
      dati[i + 2] += (Math.min(255, tb * k) - dati[i + 2]) * 0.55;
    }
    pennello.putImageData(zona, x0, y0);
  }
}

/* Un rettangolo dagli angoli tondi disegnato a mano: `roundRect` c'e' quasi
 * ovunque, ma un ritratto che dipende dal «quasi» e' un ritratto rotto. */
function percorsoTondo(pennello, x0, y0, x1, y1, raggio) {
  const r = Math.min(raggio, (x1 - x0) / 2, (y1 - y0) / 2);
  pennello.beginPath();
  pennello.moveTo(x0 + r, y0);
  pennello.arcTo(x1, y0, x1, y1, r);
  pennello.arcTo(x1, y1, x0, y1, r);
  pennello.arcTo(x0, y1, x0, y0, r);
  pennello.arcTo(x0, y0, x1, y0, r);
  pennello.closePath();
}

/* Gli occhiali: montatura centrata sugli occhi misurati, cosi' seguono
 * qualunque faccia; le stanghette corrono fino al bordo della testa. */
function disegnaOcchiali(telaTesta, misura, stile, colore = [45, 48, 56]) {
  if (!misura?.occhi || misura.occhi.length < 2) return;
  const pennello = telaTesta.getContext("2d");
  const [o1, o2] = misura.occhi;
  const pieno = `rgb(${colore[0]},${colore[1]},${colore[2]})`;
  const spessore = Math.max(2, AVATAR_LATO / 64);
  const raggio = (o1.w * 1.55) / 2; /* semi-lato della lente */
  pennello.save();
  pennello.strokeStyle = pieno;
  pennello.lineWidth = spessore;
  for (const occhio of [o1, o2]) {
    if (stile === "tondi") {
      pennello.beginPath();
      pennello.ellipse(occhio.cx, occhio.cy, raggio, raggio * 0.92, 0, 0, Math.PI * 2);
      pennello.stroke();
    } else {
      percorsoTondo(
        pennello,
        occhio.cx - raggio,
        occhio.cy - raggio * 0.92,
        occhio.cx + raggio,
        occhio.cy + raggio * 0.92,
        raggio * (stile === "sole" ? 0.45 : 0.35),
      );
      if (stile === "sole") {
        pennello.fillStyle = `rgba(${colore[0]},${colore[1]},${colore[2]},0.84)`;
        pennello.fill();
        pennello.lineWidth = spessore / 2;
      }
      pennello.stroke();
      pennello.lineWidth = spessore;
    }
  }
  /* Ponte e stanghette. */
  const ym = o1.cy;
  pennello.beginPath();
  pennello.moveTo(o1.cx + raggio, ym - raggio * 0.35);
  pennello.lineTo(o2.cx - raggio, ym - raggio * 0.35);
  pennello.stroke();
  const sinistra = misura.testa.cx - misura.testa.w / 2;
  const destra = misura.testa.cx + misura.testa.w / 2;
  pennello.beginPath();
  pennello.moveTo(o1.cx - raggio, ym - raggio * 0.2);
  pennello.lineTo(sinistra + 2, ym - raggio * 0.45);
  pennello.moveTo(o2.cx + raggio, ym - raggio * 0.2);
  pennello.lineTo(destra - 2, ym - raggio * 0.45);
  pennello.stroke();
  pennello.restore();
}

/* ── Gli abiti ──────────────────────────────────────────────────────────
 * La ricolorazione lavora per finestra di tinta: i pixel del tessuto — nella
 * parte bassa, saturi, dentro la fascia di tinta del tessuto originale — si
 * spostano sul colore voluto conservando la luce, cosi' pieghe e ombre
 * restano. `desatura` fissa la saturazione per i tessuti spenti. */
function daRgbAHsv(r, g, b) {
  const massimo = Math.max(r, g, b) / 255;
  const minimo = Math.min(r, g, b) / 255;
  const delta = massimo - minimo;
  let tinta = 0;
  if (delta > 0) {
    if (massimo === r / 255) tinta = (((g - b) / 255 / delta) % 6) / 6;
    else if (massimo === g / 255) tinta = ((b - r) / 255 / delta + 2) / 6;
    else tinta = ((r - g) / 255 / delta + 4) / 6;
    if (tinta < 0) tinta += 1;
  }
  return [tinta, massimo ? delta / massimo : 0, massimo];
}

function daHsvARgb(tinta, saturazione, valore) {
  const settore = tinta * 6;
  const c = valore * saturazione;
  const x = c * (1 - Math.abs((settore % 2) - 1));
  const base = valore - c;
  const [r, g, b] =
    settore < 1
      ? [c, x, 0]
      : settore < 2
        ? [x, c, 0]
        : settore < 3
          ? [0, c, x]
          : settore < 4
            ? [0, x, c]
            : settore < 5
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + base) * 255, (g + base) * 255, (b + base) * 255];
}

function ricoloraAbito(telaBusto, op) {
  const lato = AVATAR_LATO;
  const yMin = op.yMin ?? 0.38;
  const satMin = op.satMin ?? 0.18;
  const hueLo = op.hueLo ?? 0.5;
  const hueHi = op.hueHi ?? 0.75;
  const pennello = telaBusto.getContext("2d");
  const partenza = Math.floor(lato * yMin);
  const zona = pennello.getImageData(0, partenza, lato, lato - partenza);
  const dati = zona.data;
  const [th, ts, tv] = daRgbAHsv(op.rgb[0], op.rgb[1], op.rgb[2]);
  for (let i = 0; i < dati.length; i += 4) {
    if (dati[i + 3] < 40) continue;
    const [tinta, saturazione, valore] = daRgbAHsv(dati[i], dati[i + 1], dati[i + 2]);
    if (saturazione < satMin || tinta < hueLo || tinta > hueHi) continue;
    const ns = op.desatura == null ? ts * (0.55 + 0.45 * saturazione) : op.desatura;
    const [nr, ng, nb] = daHsvARgb(th, ns, valore * (0.75 + 0.25 * tv));
    dati[i] = nr;
    dati[i + 1] = ng;
    dati[i + 2] = nb;
  }
  pennello.putImageData(zona, 0, partenza);
}

/* Colletto e abbottonatura, dipinti: polo e camicia a monte non esistono,
 * si cuciono sulla maglietta. Due falde aperte a V in una tonalita' appena
 * diversa dal tessuto, la righina verticale, i bottoni. */
function disegnaColletto(telaBusto, op) {
  const lato = AVATAR_LATO;
  const pennello = telaBusto.getContext("2d");
  const [r, g, b] = op.rgb;
  const scuro = `rgb(${(r * 0.62) | 0},${(g * 0.62) | 0},${(b * 0.62) | 0})`;
  const medio = `rgb(${Math.min(255, (r * 1.12) | 0)},${Math.min(255, (g * 1.12) | 0)},${Math.min(255, (b * 1.12) | 0)})`;
  const cx = 0.485 * lato;
  const cy = 0.6 * lato;
  const fw = 0.115 * lato;
  const fh = 0.115 * 1.05 * lato;
  const falda = (verso) => {
    pennello.beginPath();
    pennello.moveTo(cx + verso * fw * 1.6, cy - fh * 0.45);
    pennello.lineTo(cx + verso * fw * 0.08, cy - fh * 0.12);
    pennello.lineTo(cx + verso * fw * 0.85, cy + fh * 0.62);
    pennello.lineTo(cx + verso * fw * 1.75, cy + fh * 0.05);
    pennello.closePath();
    pennello.fillStyle = medio;
    pennello.fill();
    pennello.strokeStyle = scuro;
    pennello.lineWidth = 1;
    pennello.stroke();
  };
  falda(-1);
  falda(1);
  pennello.strokeStyle = scuro;
  pennello.lineWidth = Math.max(1, lato / 140);
  pennello.beginPath();
  pennello.moveTo(cx, cy - fh * 0.05);
  pennello.lineTo(cx, cy + fh * 1.45);
  pennello.stroke();
  pennello.fillStyle = scuro;
  const bottone = Math.max(1, lato / 128);
  for (let i = 0; i < (op.bottoni || 2); i += 1) {
    const by = cy + fh * (0.42 + 0.5 * i);
    pennello.beginPath();
    pennello.ellipse(cx, by, bottone, bottone, 0, 0, Math.PI * 2);
    pennello.fill();
  }
}

/* La collana: un arco d'oro sotto il girocollo del busto, con o senza
 * pendente. La testa arriva dopo, e il mento le passa sopra com'e' giusto. */
function disegnaCollana(telaBusto, stile, oro = [212, 168, 83]) {
  const lato = AVATAR_LATO;
  const pennello = telaBusto.getContext("2d");
  const cx = 0.485 * lato;
  const cy = 0.615 * lato;
  const aw = 0.155 * lato;
  const ah = 0.1 * lato;
  const pieno = `rgb(${oro[0]},${oro[1]},${oro[2]})`;
  pennello.save();
  pennello.strokeStyle = pieno;
  pennello.lineWidth = Math.max(1.5, lato / 120);
  pennello.beginPath();
  pennello.ellipse(cx, cy, aw, ah, 0, (15 * Math.PI) / 180, (165 * Math.PI) / 180);
  pennello.stroke();
  if (stile === "pendente") {
    const py = cy + ah;
    const pr = 0.028 * lato;
    pennello.fillStyle = pieno;
    pennello.beginPath();
    pennello.ellipse(cx, py + pr * 0.7, pr, pr, 0, 0, Math.PI * 2);
    pennello.fill();
    pennello.fillStyle = "rgb(240,214,150)";
    pennello.beginPath();
    pennello.ellipse(cx, py + pr * 0.7, pr * 0.45, pr * 0.45, 0, 0, Math.PI * 2);
    pennello.fill();
  }
  pennello.restore();
}

/* ── La composizione ──────────────────────────────────────────────────── */

/**
 * Il ritratto composto: il busto vestito coi suoi ritocchi, e sopra la
 * testa scelta coi suoi — riscalata sulla misura della testa che quel busto
 * ha gia'. La tela della testa si allunga quando la barba e' lunga: la coda
 * scende sul busto, o la testa si stringe per farla stare nel quadrato.
 * @returns {Promise<{tela:HTMLCanvasElement,occhi:Array}|null>}
 */
export async function componiRitratto(face) {
  const risolto = risolviAvatar3d(face);
  if (!risolto || !doc?.createElement) return null;
  /* La firma comprende le operazioni: la stessa coppia di immagini con una
   * tinta diversa e' un altro ritratto. */
  const chiave = `${risolto.testa}|${risolto.busto || ""}|${JSON.stringify(risolto.operazioni)}`;
  const gia = state.composti.get(chiave);
  if (gia) return gia;
  const attesa = (async () => {
    const donatrici = risolto.operazioni.testa
      .filter((op) => op.tipo === "barba" && op.donatrice)
      .map((op) => op.donatrice);
    const [testa, busto, ...donate] = await Promise.all([
      immagine(risolto.testa),
      risolto.busto ? immagine(risolto.busto) : null,
      ...donatrici.map((nome) => immagine(nome)),
    ]);
    if (!testa) return null;

    const lunga = risolto.operazioni.testa.some(
      (op) => op.tipo === "barba" && op.foggia === "lunga",
    );
    const telaTesta = doc.createElement("canvas");
    telaTesta.width = AVATAR_LATO;
    telaTesta.height = Math.round(AVATAR_LATO * (lunga ? 1 + BARBA_LUNGA_EXTRA : 1));
    const suPennello = telaTesta.getContext("2d");
    if (!suPennello) return null;
    suPennello.drawImage(testa, 0, 0, AVATAR_LATO, AVATAR_LATO);
    for (const op of risolto.operazioni.testa) {
      if (op.tipo === "tintaCapelli") {
        const zona = suPennello.getImageData(0, 0, AVATAR_LATO, AVATAR_LATO);
        tintaCapelli(zona.data, AVATAR_LATO, op.rgb, op.lift || 0);
        suPennello.putImageData(zona, 0, 0);
      } else if (op.tipo === "barba") {
        applicaBarba(telaTesta, op, op.donatrice ? donate[donatrici.indexOf(op.donatrice)] : null);
      } else if (op.tipo === "iride") {
        tintaIride(telaTesta, risolto.misura?.occhi, op.rgb);
      } else if (op.tipo === "occhiali") {
        disegnaOcchiali(telaTesta, risolto.misura, op.stile);
      }
    }

    const tela = doc.createElement("canvas");
    tela.width = tela.height = AVATAR_LATO;
    const pennello = tela.getContext("2d");
    if (!pennello) return null;
    if (busto) {
      const telaBusto = doc.createElement("canvas");
      telaBusto.width = telaBusto.height = AVATAR_LATO;
      const giuPennello = telaBusto.getContext("2d");
      giuPennello.drawImage(busto, 0, 0, AVATAR_LATO, AVATAR_LATO);
      for (const op of risolto.operazioni.busto) {
        if (op.tipo === "ricoloraAbito") ricoloraAbito(telaBusto, op);
        else if (op.tipo === "colletto") disegnaColletto(telaBusto, op);
        else if (op.tipo === "collana") disegnaCollana(telaBusto, op.stile);
      }
      pennello.drawImage(telaBusto, 0, 0);
    }
    pennello.drawImage(
      telaTesta,
      risolto.x,
      risolto.y,
      AVATAR_LATO * risolto.scala,
      telaTesta.height * risolto.scala,
    );
    return { tela, occhi: risolto.occhi };
  })();
  state.composti.set(chiave, attesa);
  /* La memoria e' cresciuta con l'editor: la scheda aperta compone una
   * pastiglia per ogni casella, e sono piu' di ottanta. */
  if (state.composti.size > 200) state.composti.delete(state.composti.keys().next().value);
  return attesa;
}

/* ── Le palpebre ──────────────────────────────────────────────────────── */

/**
 * Disegna le palpebre sopra gli occhi.
 * @param {number} quanto 0 = aperti, 1 = chiusi
 * @param {number} curva quanto la palpebra sorride: e' la differenza fra un
 *   occhio socchiuso e un occhio che ride
 */
export function disegnaPalpebre(pennello, occhi, quanto, curva = 0) {
  if (!(quanto > 0)) return;
  for (const occhio of occhi) {
    const [r, g, b] = occhio.pelle || [220, 180, 150];
    const larghezza = occhio.w * 1.3;
    const altezza = occhio.h * 1.5;
    const cima = occhio.cy - altezza / 2;
    const bordo = cima + altezza * Math.min(1, quanto);
    pennello.save();
    pennello.beginPath();
    pennello.ellipse(occhio.cx, occhio.cy, larghezza / 2, altezza / 2, 0, 0, Math.PI * 2);
    pennello.clip();
    pennello.fillStyle = `rgb(${r},${g},${b})`;
    pennello.beginPath();
    pennello.moveTo(occhio.cx - larghezza, cima - altezza);
    pennello.lineTo(occhio.cx + larghezza, cima - altezza);
    pennello.lineTo(occhio.cx + larghezza, bordo);
    pennello.quadraticCurveTo(occhio.cx, bordo + altezza * (0.18 + curva), occhio.cx - larghezza, bordo);
    pennello.closePath();
    pennello.fill();
    /* Il ciglio: una riga appena piu' scura sul bordo della palpebra. Senza,
     * l'occhio chiuso e' una macchia di pelle. */
    pennello.strokeStyle = `rgba(${(r * 0.45) | 0},${(g * 0.4) | 0},${(b * 0.4) | 0},${0.5 + 0.45 * quanto})`;
    pennello.lineWidth = Math.max(1.2, altezza * 0.11);
    pennello.beginPath();
    pennello.moveTo(occhio.cx - larghezza / 2, bordo);
    pennello.quadraticCurveTo(occhio.cx, bordo + altezza * (0.18 + curva), occhio.cx + larghezza / 2, bordo);
    pennello.stroke();
    pennello.restore();
  }
}

/* ── Le espressioni ───────────────────────────────────────────────────────
 * Non toccano la bocca — e' dipinta dentro il render e riscriverla si
 * vedrebbe. Un sorriso vero si vede negli occhi, e li' si puo' fare. */
export const ESPRESSIONI = Object.freeze({
  /* Occhi aperti: si batte e basta. */
  sveglio: { chiusura: 0, curva: 0, battito: true },
  /* Occhi socchiusi all'insu': e' la faccia di chi e' contento.
   *
   * Erano socchiusi a meta' e con la palpebra molto curva, e la curva scende
   * SOTTO il bordo: fra le due, l'occhio di chi era in casa risultava quasi
   * chiuso — «avatar a casa ha occhi chiusi praticamente». E il battito non si
   * vedeva per lo stesso motivo: si disegna il piu' chiuso fra la posa e il
   * battito, quindi tutta la prima meta' del battito spariva sotto la posa.
   * Un sorriso negli occhi e' una strizzatina, non una dormita. */
  contento: { chiusura: 0.26, curva: 0.3, battito: true },
  /* Palpebre pesanti, che respirano piano. */
  assonnato: { chiusura: 0.5, curva: 0.05, battito: true },
});

/* Chi e' in casa porta la faccia contenta, ed era l'unica a non battere le
 * ciglia: in una plancia di persone tutte a casa non si muoveva un occhio, e
 * l'unica cosa viva restava il ritratto che ballava su e giu'. Adesso battono
 * tutte — chi socchiude gli occhi li chiude un po' meno, ma li chiude. */

/* ── La tela viva ─────────────────────────────────────────────────────── */

const CICLO = 300;

function ridisegna(voce, quanto) {
  const pennello = voce.tela.getContext("2d");
  if (!pennello || !voce.ritratto) return;
  pennello.clearRect(0, 0, AVATAR_LATO, AVATAR_LATO);
  pennello.drawImage(voce.ritratto.tela, 0, 0);
  const posa = ESPRESSIONI[voce.espressione] || ESPRESSIONI.sveglio;
  disegnaPalpebre(pennello, voce.ritratto.occhi, Math.max(posa.chiusura, quanto), posa.curva);
}

/* Il battito: chiude in centoquaranta millisecondi e riapre in centosessanta.
 * Fuori da quei trecento millisecondi non si disegna niente. */
function batti(voce) {
  const inizio = root.performance?.now?.() ?? 0;
  const passo = () => {
    const ora = root.performance?.now?.() ?? 0;
    const t = ora - inizio;
    if (t >= CICLO) {
      ridisegna(voce, 0);
      programma(voce);
      return;
    }
    ridisegna(voce, t < 140 ? t / 140 : 1 - (t - 140) / 160);
    root.requestAnimationFrame?.(passo);
  };
  root.requestAnimationFrame?.(passo);
}

/* Ogni persona batte per conto suo: quattro card che sbattono le ciglia
 * all'unisono sono quattro automi, non quattro persone. */
function programma(voce) {
  root.clearTimeout?.(voce.attesa);
  const posa = ESPRESSIONI[voce.espressione] || ESPRESSIONI.sveglio;
  if (!posa.battito || !voce.tela?.isConnected) return;
  voce.attesa = root.setTimeout?.(() => batti(voce), 3200 + Math.random() * 4200);
}

/**
 * Mette il ritratto dentro `host` e lo tiene vivo.
 * @param {Element} host dove va la tela
 * @param {object} face le scelte della persona
 * @param {string} espressione una chiave di ESPRESSIONI
 */
export async function ritrattoVivo(host, face, espressione = "sveglio") {
  if (!host || !doc?.createElement) return;
  const ritratto = await componiRitratto(face);
  if (!ritratto || !host.isConnected) return;
  let voce = [...state.tele].find((v) => v.host === host);
  if (!voce) {
    const tela = doc.createElement("canvas");
    tela.width = tela.height = AVATAR_LATO;
    tela.className = "dm-avatar-3d";
    host.replaceChildren(tela);
    voce = { host, tela };
    state.tele.add(voce);
  } else if (!voce.tela.isConnected) {
    host.replaceChildren(voce.tela);
  }
  voce.ritratto = ritratto;
  voce.espressione = espressione in ESPRESSIONI ? espressione : "sveglio";
  ridisegna(voce, 0);
  programma(voce);
}

/** Il ritratto come immagine ferma: serve ai campioncini dell'editor. */
export async function ritrattoFermo(face) {
  const ritratto = await componiRitratto(face);
  return ritratto ? ritratto.tela.toDataURL("image/webp", 0.9) : "";
}

/** Chi non e' piu' a schermo smette di battere le ciglia. */
export function fermaRitrattiPersi() {
  for (const voce of [...state.tele])
    if (!voce.tela?.isConnected) {
      root.clearTimeout?.(voce.attesa);
      state.tele.delete(voce);
    }
}

export function installAvatar3dStyle() {
  installStyle(
    "dm-avatar-3d-style",
    `
      .dm-avatar-3d{width:100%;height:100%;display:block;object-fit:contain}
      /* Il ritratto sta fermo.
       *
       * Qui c'era un respiro in CSS che alzava e abbassava la tela: da dentro
       * la card si vedeva la persona ballare su e giu', e la faccia — che e'
       * dove la vita si guarda — restava di pietra. La vita adesso e' tutta
       * nelle ciglia, che si battono sulla tela; il riquadro non si muove. */
      .dm-avatar-3d{animation:none;transform:none}
    `,
  );
}
