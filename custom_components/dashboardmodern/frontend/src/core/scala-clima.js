/* Fin dove arriva la barra del clima, e chi lo decide (#252).
 *
 * «Ho una pompa di calore Samsung e il sensore che uso mi gestisce la
 * temperatura di uscita dell'acqua, dai 40 gradi a salire fino a 70 massimo.
 * Quando vado a inserire nel menu clima l'entita', mi mette in predefinito
 * 10-28 gradi e non sono riuscito a capire come si modifica la scala.»
 *
 * Non c'era modo, ed e' il difetto: la scala era scritta nel codice — sedici
 * e trenta per il Freddo, dieci e ventotto per il Caldo — e valeva per tutti.
 * Una casa con la pompa di calore trovava il pomello incollato al fondo e
 * quarantacinque gradi irraggiungibili, perche' la barra finiva prima.
 *
 * La scala pero' non e' una scelta di chi disegna: e' un fatto della macchina,
 * e Home Assistant lo pubblica gia'. Ogni termostato dichiara `min_temp` e
 * `max_temp`, e quella pompa dice quaranta e settanta. La barra li legge di
 * li'; i due numeri scritti a mano restano il ripiego di chi non li dichiara —
 * cioe' quello che vedono oggi tutti gli altri, che non deve cambiare.
 *
 * Qui non c'e' DOM e non si chiama nessun servizio: solo il conto, cosi' si
 * prova a tavolino che una pompa a quaranta-settanta ottiene la sua scala e
 * un condizionatore muto non perde la propria.
 */

/* Quello che la plancia ha sempre disegnato, per famiglia. Resta la risposta
 * per chi non dichiara niente: cambiarlo sotto i piedi di chi ha gia' tutto
 * configurato sarebbe una sorpresa, non una riparazione. */
export const SCALA_DI_FAMIGLIA = Object.freeze({
  freddo: Object.freeze([16, 30]),
  caldo: Object.freeze([10, 28]),
});

/* Il ripiego di chi la famiglia non ce l'ha: il popup della Home comanda una
 * unita' sola e non sa in che zona sta: da sempre lascia passare da cinque a
 * trentacinque, ed e' abbastanza largo da non fermare nessuno. */
export const SCALA_LARGA = Object.freeze([5, 35]);

/* Sotto un grado di corsa non c'e' una scala: c'e' un attributo scritto male —
 * i due estremi uguali, o invertiti — e obbedirgli vorrebbe dire disegnare una
 * barra su cui non si puo' scegliere niente. */
const CORSA_MINIMA = 1;

/* `Number(null)` fa zero, e `Number("")` pure: due valori che vogliono dire
 * «questa temperatura non c'e'» diventerebbero «zero gradi», cioe' il pomello
 * incollato a fondo scala su una card che invece non deve mostrarlo affatto.
 * L'assenza si riconosce prima di convertire. */
const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const dato = Number(valore);
  return Number.isFinite(dato) ? dato : null;
};

/** La scala che l'unita' dichiara, `null` se non ne dichiara una sensata. */
export function scalaDichiarata(attributi) {
  const min = numero(attributi?.min_temp);
  const max = numero(attributi?.max_temp);
  if (min === null || max === null) return null;
  if (max - min < CORSA_MINIMA) return null;
  return Object.freeze([min, max]);
}

/**
 * La scala di questa unita': la sua se la dichiara, altrimenti il ripiego.
 *
 * Il ripiego si passa da fuori perche' non e' sempre lo stesso: la pagina
 * Clima ha due famiglie con due scale, il popup della Home non ha famiglia.
 */
export function scalaDellUnita(attributi, ripiego = SCALA_LARGA) {
  const dichiarata = scalaDichiarata(attributi);
  if (dichiarata) return dichiarata;
  const sicuro = Array.isArray(ripiego) && ripiego.length === 2 ? ripiego : SCALA_LARGA;
  return Object.freeze([Number(sicuro[0]), Number(sicuro[1])]);
}

/** La scala di questa unita' nella zona da cui la si sta guardando. */
export function scalaDellaZona(attributi, zona) {
  return scalaDellUnita(attributi, SCALA_DI_FAMIGLIA[zona] || SCALA_DI_FAMIGLIA.freddo);
}

/* Di quanto si muove un passo.
 *
 * Un grado alla volta e' quello che la plancia fa da sempre — «una pressione,
 * un grado» — e su una scala da trenta gradi va benissimo. Chi pero' dichiara
 * un passo piu' fine lo dichiara perche' la sua macchina lo accetta, e allora
 * il passo e' quello: mezzo grado su un termostato che lavora a mezzi gradi
 * non e' una finezza, e' l'unico modo di arrivare al numero che si vuole. */
export function passoDellUnita(attributi, ripiego = 1) {
  const passo = numero(attributi?.target_temp_step);
  if (passo === null || passo <= 0) return ripiego;
  return passo;
}

/** Il grado, riportato dentro la scala: mai un comando fuori dai suoi estremi. */
export function dentroLaScala(grado, scala) {
  const [low, high] = scala || SCALA_LARGA;
  const dato = numero(grado);
  if (dato === null) return null;
  return Math.min(high, Math.max(low, dato));
}

/** Dove sta questo grado sulla barra, da 0 a 1. `null` resta `null`. */
export function quotaNellaScala(grado, scala) {
  const [low, high] = scala || SCALA_LARGA;
  const dato = numero(grado);
  if (dato === null) return null;
  const corsa = high - low;
  if (!corsa) return 0;
  return Math.min(1, Math.max(0, (dato - low) / corsa));
}

/**
 * Il grado sotto il dito: la frazione della barra diventa una temperatura,
 * arrotondata al passo dell'unita' e riportata dentro i suoi estremi.
 *
 * L'arrotondamento parte dal minimo e non da zero: su una scala 40-70 col
 * passo da mezzo grado i valori buoni sono 40, 40,5, 41 — non 0, 0,5, 1 —
 * e partendo da zero un minimo dispari avrebbe spostato tutta la griglia.
 */
export function gradoNellaScala(frazione, scala, passo = 1) {
  const [low, high] = scala || SCALA_LARGA;
  const dentro = Math.min(1, Math.max(0, Number(frazione) || 0));
  const grezzo = low + dentro * (high - low);
  const salto = passo > 0 ? passo : 1;
  const scattato = low + Math.round((grezzo - low) / salto) * salto;
  /* Il passo puo' non entrare un numero intero di volte nella corsa (40-70 a
   * passi da 0,4): l'ultimo scatto cadrebbe oltre il massimo, e il comando
   * uscirebbe dalla scala proprio all'estremo che si stava cercando. */
  const fermato = Math.min(high, Math.max(low, scattato));
  /* Gli errori dei numeri in virgola mobile si vedono: 40 + 11*0.5 fa
   * 45.00000000000001, e quel numero finisce scritto sulla card. */
  return Math.round(fermato * 1000) / 1000;
}
