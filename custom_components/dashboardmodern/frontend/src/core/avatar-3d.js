/* Il ritratto della persona: quali pezzi, e quali file.
 *
 * Il modulo e' puro. Non sa cos'e' una canvas ne' cos'e' una pagina: prende
 * le scelte — chi sei, che capelli hai, che carnagione, com'e' vestito — e
 * dice quali due immagini servono e come vanno incastrate. Chi disegna sta
 * di la'.
 *
 * Le immagini sono i render 3D di Fluent Emoji (Microsoft, licenza MIT),
 * preparati da `scripts/costruisci-avatar-3d.mjs`. Le misure che quello
 * script ha preso — dove sta la testa, dove stanno gli occhi — arrivano da
 * `avatar-catalog.js` e sono la ragione per cui una testa qualunque sta su
 * un busto qualunque: si riscala la prima sulla seconda.
 */
import {
  AVATAR_CAPELLI,
  AVATAR_CARNAGIONI,
  AVATAR_LATO,
  AVATAR_MISURE,
  AVATAR_BUSTI,
  AVATAR_PERSONE,
  AVATAR_TESTE,
  AVATAR_VESTITI,
} from "./avatar-catalog.js";

export { AVATAR_LATO };

const chiavi = (elenco) => elenco.map((voce) => voce.key);

export const PERSONE = Object.freeze(chiavi(AVATAR_PERSONE));
export const CAPELLI = Object.freeze(chiavi(AVATAR_CAPELLI));
export const CARNAGIONI = Object.freeze(chiavi(AVATAR_CARNAGIONI));
/* «nessuno» non e' un vestito: e' il ritratto della sola testa. */
export const VESTITI = Object.freeze(["nessuno", ...chiavi(AVATAR_VESTITI)]);

/* Ragazzo, ragazza e anziani non hanno le varianti di capelli: a monte non
 * sono state renderizzate. Per loro la fila «Capelli» non si applica, e
 * dirlo qui evita che l'editor la mostri per finta. */
const CON_CAPELLI = new Set(AVATAR_PERSONE.filter((voce) => voce.capelli).map((voce) => voce.key));
export const personaHaCapelli = (persona) => CON_CAPELLI.has(persona);

/* Il busto e' disegnato su un corpo maschile o femminile: la persona scelta
 * decide quale, e per quelle senza un genere si prende il maschile — che nei
 * ritratti Fluent e' anche il piu' neutro dei due. */
const FEMMINILI = new Set(["donna", "ragazza", "anziana"]);
export const genereDi = (persona) => (FEMMINILI.has(persona) ? "donna" : "uomo");

const dentro = (valore, elenco) => (elenco.includes(valore) ? valore : elenco[0]);

/** Le scelte, riportate dentro i cataloghi. `null` per chi non ha un ritratto. */
export function normalizeAvatar3d(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const persona = dentro(String(input.persona ?? ""), [...PERSONE]);
  return {
    persona,
    capelli: personaHaCapelli(persona)
      ? dentro(String(input.capelli ?? ""), [...CAPELLI])
      : CAPELLI[0],
    carnagione: dentro(String(input.carnagione ?? ""), [...CARNAGIONI]),
    vestito: dentro(String(input.vestito ?? ""), [...VESTITI]),
  };
}

const nomeTesta = (a) =>
  AVATAR_TESTE[`${a.persona}|${personaHaCapelli(a.persona) ? a.capelli : ""}|${a.carnagione}`];
const nomeBusto = (a) =>
  a.vestito === "nessuno"
    ? null
    : AVATAR_BUSTI[`${a.vestito}|${genereDi(a.persona)}|${a.carnagione}`];

/**
 * Le due immagini e il modo di incastrarle.
 *
 * Senza busto c'e' solo la testa, com'e'. Col busto la testa va riscalata:
 * i ritratti di sola testa sono inquadrati piu' grandi di quelli che stanno
 * sopra un corpo vestito, e `scala` e' il rapporto fra le due larghezze.
 * `x` e `y` sono l'angolo da cui disegnarla.
 *
 * @returns {null|{testa:string,busto:string|null,scala:number,x:number,y:number,occhi:Array}}
 */
export function risolviAvatar3d(input) {
  const scelte = normalizeAvatar3d(input);
  if (!scelte) return null;
  const testa = nomeTesta(scelte);
  if (!testa) return null;
  const misuraTesta = AVATAR_MISURE[testa];
  const busto = nomeBusto(scelte);
  const misuraBusto = busto ? AVATAR_MISURE[busto] : null;
  if (!busto || !misuraBusto || !misuraTesta) {
    return { testa, busto: null, scala: 1, x: 0, y: 0, occhi: misuraTesta?.occhi || [] };
  }
  const scala = misuraBusto.testa.w / misuraTesta.testa.w;
  const x = misuraBusto.testa.cx - misuraTesta.testa.cx * scala;
  const y = misuraBusto.testa.alto - misuraTesta.testa.alto * scala;
  /* Gli occhi si spostano con la testa: e' li' che andranno le palpebre. */
  const occhi = (misuraTesta.occhi || []).map((occhio) => ({
    cx: occhio.cx * scala + x,
    cy: occhio.cy * scala + y,
    w: occhio.w * scala,
    h: occhio.h * scala,
    pelle: occhio.pelle,
  }));
  return { testa, busto, scala, x, y, occhi };
}

/** Il nome del file di un pezzo, per chi deve precaricarlo. */
export function fileAvatar3d(input) {
  const risolto = risolviAvatar3d(input);
  return risolto ? [risolto.testa, risolto.busto].filter(Boolean) : [];
}

/** Una faccia a caso: e' da li' che si parte, invece che dal solito uomo. */
export function avatar3dACaso(sorteggio = Math.random) {
  const uno = (elenco) => elenco[Math.floor(sorteggio() * elenco.length)];
  const persona = uno([...PERSONE]);
  return normalizeAvatar3d({
    persona,
    capelli: uno([...CAPELLI]),
    carnagione: uno([...CARNAGIONI]),
    vestito: uno([...VESTITI]),
  });
}
