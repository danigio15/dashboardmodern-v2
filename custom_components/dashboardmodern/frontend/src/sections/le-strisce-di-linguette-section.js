/* Le strisce di linguette che scorrono di lato, con un padrone solo.
 *
 * Nella plancia ce ne sono tre — i periodi dell'Energia e degli
 * Elettrodomestici (`.sub-tabs-container`), gli impianti dell'Energia
 * (`.dm-imp-tabs`) e le stanze (`.dm-stanze-tabs`) — e sono la stessa cosa
 * disegnata tre volte: una fila di pillole in un contenitore che scorre in
 * orizzontale con la barra nascosta. Ne veniva anche lo stesso difetto tre
 * volte, corretto una volta sola.
 *
 * PRIMO: chi scorre di lato taglia anche in alto e in basso. Basta che un
 * asse non sia `visible` perche' il browser ritagli pure l'altro, e queste
 * pillole hanno un bordo, un'ombra che scende e — quella attiva — due pixel
 * di sollevamento. Il nastro dei periodi aveva quattro pixel di spazio contro
 * un'ombra da ventotto: la pillola accesa si vedeva mozzata contro la testata
 * della sezione. Lo spazio si fa qui dentro, non fuori: fuori sposterebbe il
 * disegno, dentro allarga solo la finestra che taglia.
 *
 * SECONDO: col mouse quel nastro e' una trappola. Lo scorrimento laterale col
 * dito e' il gesto giusto, e la barra sarebbe sporcizia; ma la rotella sopra
 * una fila orizzontale scorre la pagina in giu', e la barra non c'e' da
 * afferrare. Con quattro periodi o quattordici stanze, le ultime restavano
 * oltre il bordo destro: visibili a meta' e irraggiungibili. Dove si punta
 * con precisione la fila va a capo — lo spazio in verticale c'e' — e ogni
 * linguetta sta a schermo senza nessun gesto da scoprire.
 *
 * Le Stanze questo giro ce l'avevano gia', scritto in casa loro. Adesso e'
 * qui per tutt'e tre: una regola sola, un padrone solo.
 */
import { installStyle, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_STRISCE_LINGUETTE__";
const state = (root[KEY] ||= { installed: false });

/* I tre nastri, con lo spazio che serve a ciascuno.
 *
 * Non e' lo stesso numero per tutti perche' non sono la stessa pillola: quella
 * dei periodi si solleva di due e porta un'ombra da ventotto, quelle degli
 * impianti e delle stanze stanno ferme e ne portano una da venti. */
const NASTRI = Object.freeze([
  { nastro: ".sub-tabs-container", fila: ".sub-tabs-energy", sopra: 10, sotto: 20 },
  { nastro: "#page-energy .dm-imp-tabs", fila: null, sopra: 8, sotto: 14 },
  { nastro: "#page-stanze .dm-stanze-tabs", fila: null, sopra: 8, sotto: 12 },
]);

function stile() {
  const righe = [];
  for (const voce of NASTRI) {
    righe.push(
      `${voce.nastro}{padding-top:${voce.sopra}px!important;padding-bottom:${voce.sotto}px!important}`,
    );
  }
  /* `hover:hover` e `pointer:fine` insieme vogliono dire «c'e' un mouse»: un
   * telefono non li ha, un tablet col dito nemmeno, e li' il nastro resta
   * quello che si spinge col dito. */
  const conMouse = [];
  for (const voce of NASTRI) {
    conMouse.push(`${voce.nastro}{overflow-x:visible!important;flex-wrap:wrap!important}`);
    if (voce.fila) {
      conMouse.push(
        `${voce.nastro} ${voce.fila}{flex-wrap:wrap!important;justify-content:center!important;` +
          `flex-shrink:1!important;row-gap:10px!important}`,
      );
    }
  }
  return `${righe.join("\n")}\n@media (hover:hover) and (pointer:fine){\n${conMouse.join("\n")}\n}`;
}

export function installStrisceDiLinguette() {
  if (state.installed) return true;
  state.installed = true;
  installStyle("dm-strisce-linguette-style", stile());
  return true;
}
