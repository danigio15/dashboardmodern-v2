/* Le vesti della carta: come si veste una card della plancia.
 *
 * «Le altre sembrano in rilievo, questa piatta.»
 *
 * Il rilievo di una card non e' un'ombra sola: e' il filo chiaro sul bordo di
 * sopra, il filo scuro su quello di sotto, l'ombra corta attaccata alla carta
 * e quella lunga e sfumata sotto. Sono cinque strati, e o ci sono tutti o la
 * card sembra stampata sulla pagina invece che appoggiata sopra.
 *
 * Stavano scritti in un posto solo — le tessere dei widget — e il meteo sceso
 * in pagina si era vestito con l'ombra morbida delle persone, che su una card
 * larga tutta la pagina non si vede. Due ricette per la stessa cosa sono il
 * modo di avere due aspetti diversi, ed e' esattamente quello che si e' visto.
 *
 * Quindi la ricetta sta qui, e la leggono tutti. Chi la usa mette le sue
 * misure — quanto e' alta, quanta aria dentro — e prende da qui quello che la
 * fa sembrare carta.
 */

/* I fili e le ombre. Il velo chiaro in cima lo porta `--dm-vetrino`, che
 * cambia fra chiaro e scuro: chi usa queste vesti dichiara anche quello, con
 * `TOKEN_DELLA_CARTA`. */
export const OMBRA_DELLA_CARTA = `
    inset 0 1px 0 var(--dm-vetrino),
    inset 0 0 0 1px color-mix(in srgb,var(--text,#0f172a) 7%,transparent),
    inset 0 -1px 0 color-mix(in srgb,var(--text,#0f172a) 6%,transparent),
    0 1px 1px rgba(15,23,42,.05),0 14px 28px -18px rgba(15,23,42,.55)`;

/* Il fondo: carta, appena piu' scura verso il basso. E' quello che fa sembrare
 * la luce venire dall'alto, insieme ai fili. */
export const FONDO_DELLA_CARTA = `linear-gradient(180deg,var(--card-bg,#fff),
    color-mix(in srgb,var(--card-bg,#fff) 92%,var(--bg-sculpted,#eef2f7)))`;

/* La grana, perche' la carta vera non e' mai perfettamente liscia: senza quel
 * velo una card sembra vetro stampato. Va su uno pseudo-elemento suo. */
export const GRANA_DELLA_CARTA = `
  content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E");
  background-size:140px 140px;mix-blend-mode:soft-light;opacity:var(--dm-grana)`;

/**
 * I valori che le vesti si aspettano, per il tema chiaro e per quello scuro.
 *
 * `selettore` e' chi le porta. Si scrive una volta per blocco, non per card.
 */
export function tokenDellaCarta(selettore) {
  return `${selettore}{
  --dm-vetrino:rgba(255,255,255,.72);
  --dm-velo:9%;
  --dm-cuscino:15%;
  --dm-grana:.5;
  --dm-alone:.26}
html[data-theme="dark"] ${selettore},
body.dark-theme ${selettore}{
  --dm-vetrino:rgba(255,255,255,.06);
  --dm-velo:14%;
  --dm-cuscino:22%;
  --dm-grana:.34;
  --dm-alone:.55}`;
}
