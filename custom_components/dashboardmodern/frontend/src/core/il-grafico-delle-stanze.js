/* Cosa disegna il grafico della sezione Temperature, e chi ci sta dentro.
 *
 * Due richieste sullo stesso disegno, ed è per questo che stanno insieme:
 *
 * «All'interno della sezione temperatura, oltre che mostrare il grafico
 *  relativo all'andamento della temperatura di tutte le stanze, potrebbe essere
 *  interessante avere anche quello relativo all'umidità in modo da poterla
 *  tenere d'occhio.» (#427)
 *
 * «Sarebbe utile poter togliere dal grafico alcune entità/stanze cliccandoci
 *  sopra in modo tale che diventi più leggibile la variazione. Nel mio caso il
 *  vano tecnico.» (#433)
 *
 * ── La misura ───────────────────────────────────────────────────────────
 *
 * Le stanze la sonda dell'umidità ce l'hanno già, accanto a quella della
 * temperatura: mancava solo di poterla guardare. Non è però un secondo grafico
 * sotto il primo — gradi e per cento non stanno sulla stessa altezza, e due
 * disegni impilati vogliono dire una sezione lunga il doppio per una domanda
 * che si fa una alla volta. È lo stesso grafico che cambia misura, come le
 * linguette del periodo cambiano quanto indietro si guarda.
 *
 * Ogni misura si porta dietro quello che la riguarda: da quale casella della
 * stanza si legge, con che unità si scrive, e dove sta la fascia in cui si sta
 * bene. Per la temperatura è fra i diciotto e i ventisei gradi; per l'umidità
 * fra il quaranta e il sessanta per cento, che è la fascia in cui non si
 * formano né muffa né elettricità statica. Quella fascia il grafico la disegna
 * già dietro le linee: senza una per misura, guardando l'umidità si sarebbe
 * vista la banda dei gradi distesa in mezzo alle percentuali.
 *
 * ── Chi si spegne ───────────────────────────────────────────────────────
 *
 * Una stanza fuori scala schiaccia tutte le altre: il vano tecnico a otto gradi
 * fa sì che la differenza fra il salone a ventuno e la camera a ventitré
 * diventi due pixel. Spegnerla la toglie dal disegno *e dalla scala*, che è
 * tutto il punto della richiesta — nasconderla soltanto avrebbe lasciato il
 * grafico schiacciato com'era.
 *
 * Una regola sola, ed è quella dei tasti della centrale: l'ultima accesa non si
 * spegne. Un grafico vuoto non è una preferenza, è un gesto sbagliato.
 *
 * È puro: nessun DOM, nessuna memoria, nessun orologio.
 */

export const CHIAVE_GRAFICO_STANZE = "cd_grafico_stanze";

const pulito = (valore) => String(valore ?? "").trim();

/**
 * Le misure che il grafico sa disegnare.
 *
 * `campo` è la casella della stanza da cui si legge — le stesse che
 * `temperatureEntries` mette in fila — e `comfort` la fascia in cui si sta
 * bene, quella che il disegno colora dietro le linee.
 */
export const MISURE = Object.freeze([
  Object.freeze({
    chiave: "temperatura",
    campo: "temp",
    glifo: "🌡️",
    it: "Temperatura",
    en: "Temperature",
    unita: "°",
    decimali: 1,
    comfort: Object.freeze({ basso: 18, alto: 26 }),
  }),
  Object.freeze({
    chiave: "umidita",
    campo: "hum",
    glifo: "💧",
    it: "Umidità",
    en: "Humidity",
    unita: "%",
    decimali: 0,
    comfort: Object.freeze({ basso: 40, alto: 60 }),
  }),
]);

/** La misura che si sta guardando, o quella di partenza. */
export function misuraDelGrafico(chiave) {
  return MISURE.find((misura) => misura.chiave === pulito(chiave)) || MISURE[0];
}

/**
 * Un valore scritto come lo vuole la sua misura.
 *
 * La virgola la passa chi disegna, perché dipende dalla lingua di chi guarda e
 * qui dentro non si sa che lingua si parla.
 */
export function scriviIlValore(valore, misura = MISURE[0], virgola = ",") {
  const numero = Number(valore);
  if (!Number.isFinite(numero)) return "—";
  return `${numero.toFixed(misura.decimali).replace(".", virgola)}${misura.unita}`;
}

/* ── chi è acceso e chi no ─────────────────────────────────────────────── */

/** Le serie spente, come insieme, da quello che c'è scritto in configurazione. */
export function serieSpente(stored) {
  const elenco = Array.isArray(stored?.spente) ? stored.spente : [];
  return new Set(elenco.map(pulito).filter(Boolean));
}

/** Quelle che si disegnano: tutte, meno le spente. */
export function serieAccese(serie = [], spente = new Set()) {
  const fuori = spente instanceof Set ? spente : serieSpente({ spente });
  const dentro = serie.filter((voce) => !fuori.has(pulito(voce?.id)));
  /* Se sono spente tutte — una configurazione vecchia, una stanza rinominata —
   * si torna a mostrarle tutte: un grafico vuoto non racconta niente, e chi lo
   * apre non ha modo di capire che quel vuoto è una sua scelta di mesi fa. */
  return dentro.length ? dentro : serie;
}

/** Se questa si può spegnere: sì, a meno che non resti l'unica accesa. */
export function laSiPuoSpegnere(serie = [], spente = new Set(), id = "") {
  const fuori = spente instanceof Set ? spente : serieSpente({ spente });
  const quale = pulito(id);
  if (!quale || fuori.has(quale)) return true;
  return serieAccese(serie, fuori).some((voce) => pulito(voce?.id) !== quale);
}

/**
 * L'elenco delle spente dopo aver toccato una voce, o `null` se non si tocca.
 *
 * Torna `null` quando si sta spegnendo l'ultima accesa: chi chiama lo dice a
 * chi ha toccato, invece di scrivere una configurazione che poi va ignorata.
 */
export function conLaSerieGirata(stored, serie = [], id = "") {
  const quale = pulito(id);
  if (!quale) return null;
  const fuori = serieSpente(stored);
  if (fuori.has(quale)) {
    fuori.delete(quale);
    return [...fuori].sort();
  }
  if (!laSiPuoSpegnere(serie, fuori, quale)) return null;
  fuori.add(quale);
  return [...fuori].sort();
}
