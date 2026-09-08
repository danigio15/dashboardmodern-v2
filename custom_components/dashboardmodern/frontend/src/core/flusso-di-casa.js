/* Il flusso dell'energia, come si disegna in Home (#415, #416).
 *
 * «Sarebbe veramente perfetta se sulla home, accanto magari alle card delle
 * persone, potessimo mettere un'immagine con il flusso dal fotovoltaico alla
 * casa, dalla casa alle batterie, dalla casa all'auto ecc ecc.»
 *
 * Il disegno c'e' gia' nella sezione Energia, ma vive attaccato al documento
 * storico: e' quello, non il conto, a non poter uscire da li'. Il conto invece
 * e' un modulo puro — `core/energy-flow-truth.js` — e questo gli sta sopra
 * senza rifarlo: prende i quattro numeri di casa, gli chiede come si spartisce
 * l'energia fra le sorgenti, e ci aggiunge l'unico arco che quella non
 * conosce, la casa che carica l'auto.
 *
 * Che sia lo STESSO conto conta piu' del disegno: due mappe della stessa casa
 * che dicono cose diverse sono peggio di una mappa sola. Chi guarda la Home e
 * poi apre l'Energia deve vedere le stesse frecce.
 *
 * La colonnina non e' una sorgente: e' un carico di casa, e quello che eroga e'
 * gia' dentro il consumo di casa. L'arco casa → auto quindi non si somma, si
 * ritaglia — e non puo' essere piu' grande di quello che la casa sta usando,
 * perche' una casa non puo' mandare all'auto piu' corrente di quanta ne prende.
 */

import { allocateSourceFlows } from "./energy-flow-truth.js";

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};
const positivo = (valore) => (Number.isFinite(valore) && valore > 0 ? valore : 0);

/** I nodi del disegno, nell'ordine in cui si leggono. */
export const NODI_DEL_FLUSSO = Object.freeze(["solare", "rete", "batteria", "casa", "auto"]);

/* Gli archi possibili, con il nome che `allocateSourceFlows` gli da'. Sono
 * scritti qui una volta perche' l'ordine di disegno e' anche l'ordine in cui si
 * leggono: prima quello che entra in casa, poi quello che ne esce. */
const ARCHI = Object.freeze([
  Object.freeze({ da: "solare", a: "casa", campo: "solarToHome" }),
  Object.freeze({ da: "solare", a: "batteria", campo: "solarToBattery" }),
  Object.freeze({ da: "solare", a: "rete", campo: "solarToGrid" }),
  Object.freeze({ da: "rete", a: "casa", campo: "gridToHome" }),
  Object.freeze({ da: "rete", a: "batteria", campo: "gridToBattery" }),
  Object.freeze({ da: "batteria", a: "casa", campo: "batteryToHome" }),
  Object.freeze({ da: "batteria", a: "rete", campo: "batteryToGrid" }),
]);

/* Il verso di un nodo, per la freccia e per il colore.
 *
 * La batteria e la rete hanno un segno che e' una convenzione del modello, non
 * qualcosa che si legge su un pannello: qui diventa una parola. */
function versoDellaBatteria(watt) {
  if (watt == null || watt === 0) return "";
  return watt > 0 ? "fuori" : "dentro";
}

function versoDellaRete(watt) {
  if (watt == null || watt === 0) return "";
  return watt > 0 ? "fuori" : "dentro";
}

/**
 * Il modello del disegno: i nodi con quello che dicono, e gli archi accesi.
 *
 * `rete` positiva = prelievo, `batteria` positiva = scarica: sono le stesse
 * convenzioni del resto della plancia, e cambiarle qui vorrebbe dire avere due
 * verita' sulla stessa casa.
 *
 * @param {{solare?:number, rete?:number, batteria?:number, casa?:number,
 *          auto?:number, soc?:number}} letture
 */
export function flussoDiCasa(letture = {}) {
  const solare = numero(letture.solare);
  const rete = numero(letture.rete);
  const batteria = numero(letture.batteria);
  const casa = numero(letture.casa);
  const auto = numero(letture.auto);
  const soc = numero(letture.soc);

  const spartizione = allocateSourceFlows({
    solar: positivo(solare),
    grid: rete ?? 0,
    battery: batteria ?? 0,
  });

  /* Quanto di quello che la casa sta usando finisce nell'auto. Senza il numero
   * della casa si crede alla colonnina: e' l'unica cosa che si sa. */
  const inCasa = positivo(casa);
  const allAuto = inCasa ? Math.min(positivo(auto), inCasa) : positivo(auto);

  const archi = ARCHI.map((arco) => ({
    da: arco.da,
    a: arco.a,
    watt: positivo(spartizione[arco.campo]),
  })).filter((arco) => arco.watt > 0);
  if (allAuto > 0) archi.push({ da: "casa", a: "auto", watt: allAuto });

  const nodi = {
    solare: { chiave: "solare", watt: solare == null ? null : positivo(solare), verso: "" },
    rete: {
      chiave: "rete",
      watt: rete == null ? null : Math.abs(rete),
      verso: versoDellaRete(rete),
    },
    batteria: {
      chiave: "batteria",
      watt: batteria == null ? null : Math.abs(batteria),
      verso: versoDellaBatteria(batteria),
      soc,
    },
    casa: { chiave: "casa", watt: casa == null ? null : positivo(casa), verso: "" },
    auto: { chiave: "auto", watt: auto == null ? null : positivo(auto), verso: "" },
  };

  /* Che nodi si disegnano: quelli che un numero ce l'hanno. Un riquadro vuoto
   * in una mappa dei flussi non dice «zero», dice «non lo so», e nella Home —
   * dove ci si passa davanti — e' peggio del riquadro che non c'e'. */
  const presenti = NODI_DEL_FLUSSO.filter((chiave) => nodi[chiave].watt != null);

  return Object.freeze({
    nodi: Object.freeze(nodi),
    presenti: Object.freeze(presenti),
    archi: Object.freeze(archi.map((arco) => Object.freeze(arco))),
    /* Con un nodo solo non c'e' nessun flusso da raccontare: e' un numero, e
     * quello la tessera dell'energia lo dice gia'. */
    disegnabile: presenti.length >= 2,
  });
}

/**
 * Quanto e' «forte» un arco rispetto al piu' grande: da 0 a 1.
 *
 * Serve allo spessore della linea e alla velocita' del tratteggio. Con un arco
 * solo vale 1: e' il piu' grande di se stesso.
 */
export function forzaDellArco(watt, massimo) {
  const valore = positivo(Number(watt));
  const cima = positivo(Number(massimo));
  if (!cima) return 0;
  return Math.min(1, valore / cima);
}

/** Il piu' grande degli archi accesi, per il paragone. */
export function arcoPiuGrande(archi = []) {
  return archi.reduce((massimo, arco) => Math.max(massimo, positivo(Number(arco?.watt))), 0);
}
