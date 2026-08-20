/* Che ora e' fuori dalla finestra.
 *
 * La tapparella si guarda da dentro casa, e dietro c'e' il cielo. Un cielo
 * sempre uguale a mezzogiorno stona alle sette di sera: qui si decide, dal solo
 * orologio, in che fascia del giorno siamo. Niente DOM e niente entita' di Home
 * Assistant, cosi' la regola si prova senza aprire un browser — e chi disegna
 * deve solo scegliere i colori della fascia.
 *
 * Le fasce sono cinque, quelle che si nominano parlando: alba, mattina,
 * pomeriggio, tramonto, sera. La sera copre anche la notte, perche' a notte
 * fonda il cielo e' quello della sera, solo piu' fermo.
 */

export const DAYLIGHT_PHASES = Object.freeze(["alba", "mattina", "pomeriggio", "tramonto", "sera"]);

/* Gli orari di stacco, in ore locali. Sono i confini che una persona userebbe
 * raccontando la giornata, non un calcolo astronomico: l'alba vera si sposta di
 * due ore fra giugno e dicembre, ma nessuno guarda una card per sapere
 * l'effemeride. */
const CONFINI = Object.freeze([
  { da: 5, fase: "alba" },
  { da: 8, fase: "mattina" },
  { da: 13, fase: "pomeriggio" },
  { da: 18, fase: "tramonto" },
  { da: 21, fase: "sera" },
]);

/** La fascia del giorno di un momento. Fuori orario riconoscibile: "sera". */
export function daylightPhase(when = new Date()) {
  const data = when instanceof Date ? when : new Date(when);
  const ora = data?.getHours?.();
  if (!Number.isInteger(ora) || Number.isNaN(data.getTime())) return "sera";
  let fase = "sera";
  for (const confine of CONFINI) {
    if (ora >= confine.da) fase = confine.fase;
  }
  // Prima delle cinque e' ancora la sera di ieri.
  return ora < CONFINI[0].da ? "sera" : fase;
}

/** Fra quanti millisecondi cambia la fascia. Chi ridisegna non deve indovinare. */
export function millisToNextPhase(when = new Date()) {
  const data = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(data.getTime())) return 60_000;
  const ora = data.getHours();
  const prossima = CONFINI.find((confine) => confine.da > ora)?.da ?? 24 + CONFINI[0].da;
  const stacco = new Date(data);
  stacco.setHours(prossima, 0, 0, 0);
  return Math.max(60_000, stacco.getTime() - data.getTime());
}
