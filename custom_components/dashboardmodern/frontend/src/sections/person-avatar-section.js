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
import { AVATAR_LATO, risolviAvatar3d } from "../core/avatar-3d.js";
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

/* ── La composizione ──────────────────────────────────────────────────── */

/**
 * Il ritratto composto: il busto vestito, e sopra la testa scelta —
 * riscalata sulla misura della testa che quel busto ha gia'.
 * @returns {Promise<{tela:HTMLCanvasElement,occhi:Array}|null>}
 */
export async function componiRitratto(face) {
  const risolto = risolviAvatar3d(face);
  if (!risolto || !doc?.createElement) return null;
  const chiave = `${risolto.testa}|${risolto.busto || ""}`;
  const gia = state.composti.get(chiave);
  if (gia) return gia;
  const attesa = (async () => {
    const [testa, busto] = await Promise.all([immagine(risolto.testa), risolto.busto ? immagine(risolto.busto) : null]);
    if (!testa) return null;
    const tela = doc.createElement("canvas");
    tela.width = tela.height = AVATAR_LATO;
    const pennello = tela.getContext("2d");
    if (!pennello) return null;
    if (busto) {
      pennello.drawImage(busto, 0, 0, AVATAR_LATO, AVATAR_LATO);
      pennello.drawImage(testa, risolto.x, risolto.y, AVATAR_LATO * risolto.scala, AVATAR_LATO * risolto.scala);
    } else {
      pennello.drawImage(testa, 0, 0, AVATAR_LATO, AVATAR_LATO);
    }
    return { tela, occhi: risolto.occhi };
  })();
  state.composti.set(chiave, attesa);
  if (state.composti.size > 40) state.composti.delete(state.composti.keys().next().value);
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
  /* Occhi socchiusi all'insu': e' la faccia di chi e' contento. */
  contento: { chiusura: 0.52, curva: 0.42, battito: false },
  /* Palpebre pesanti, che respirano piano. */
  assonnato: { chiusura: 0.6, curva: 0.05, battito: false },
});

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
      /* Il respiro: lo fa il compositore, non il filo principale. Ogni
       * persona parte da un punto diverso del ciclo, cosi' in una fila di
       * card non respirano all'unisono. */
      .dm-avatar-3d{animation:dmAvatarRespiro 5.4s ease-in-out infinite;transform-origin:50% 92%}
      .dm-person-card:nth-child(2n) .dm-avatar-3d{animation-delay:-1.5s}
      .dm-person-card:nth-child(3n) .dm-avatar-3d{animation-delay:-3s}
      .dm-person-card:nth-child(4n) .dm-avatar-3d{animation-delay:-4.3s}
      @keyframes dmAvatarRespiro{
        0%,100%{transform:translateY(0) scale(1) rotate(0deg)}
        32%{transform:translateY(-2px) scale(1.02) rotate(-1deg)}
        66%{transform:translateY(-.8px) scale(1.01) rotate(.9deg)}
      }
      @media(prefers-reduced-motion:reduce){.dm-avatar-3d{animation:none}}
    `,
  );
}
