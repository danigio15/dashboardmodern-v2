/* La card del meteo, quando il blocco scende in pagina.
 *
 * «Nel caso in cui il meteo viene spostato da sotto all'intestazione crea una
 * card più bella: la striscia così piccola e sottile non mi piace.»
 *
 * Nell'intestazione la striscia va bene com'e': sta sotto il nome della casa,
 * accanto all'orologio, e il suo mestiere e' non prendere spazio. Scesa in
 * pagina pero' diventa un blocco come gli altri — le persone, le tessere, le
 * stanze — e li' una riga alta trenta pixel non e' discreta: e' sciatta.
 *
 * Quello che la card dice in piu' viene dalle previsioni, che Home Assistant
 * pubblica solo a richiesta (`weather.get_forecasts`). Qui c'e' la parte che
 * si prova senza un documento e senza un socket: il segno del tempo, la
 * massima e la minima di oggi, i giorni che vengono.
 */

const clean = (value) => String(value ?? "").trim();

/* I segni del tempo: gli stessi quattordici che il guscio usa per l'icona
 * grande e per l'elenco delle previsioni. Sono le condizioni che Home
 * Assistant dichiara, non una lista nostra — una condizione in piu' la
 * aggiunge lui, non noi. */
export const SEGNI = Object.freeze({
  "clear-night": "🌙",
  cloudy: "☁️",
  exceptional: "⚠️",
  fog: "🌫️",
  hail: "🌨️",
  lightning: "⛈️",
  "lightning-rainy": "⛈️",
  partlycloudy: "⛅",
  pouring: "🌧️",
  rainy: "🌦️",
  snowy: "❄️",
  "snowy-rainy": "🌨️",
  sunny: "☀️",
  windy: "💨",
  "windy-variant": "💨",
});

/** Il segno di una condizione. Sconosciuta: il sole, come fa il guscio. */
export function segnoDelTempo(condizione) {
  return SEGNI[clean(condizione).toLowerCase()] || "☀️";
}

const numero = (valore) => {
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
};

/* Una voce delle previsioni, ripulita. `temperature` e' la massima del giorno,
 * `templow` la minima: sono i nomi di Home Assistant, e qui diventano i nostri
 * perche' chi disegna non deve sapere l'inglese di un'integrazione. */
function voce(previsione) {
  const quando = Date.parse(clean(previsione?.datetime));
  if (!Number.isFinite(quando)) return null;
  return {
    quando,
    condizione: clean(previsione?.condition),
    alta: numero(previsione?.temperature),
    bassa: numero(previsione?.templow),
  };
}

const stessoGiorno = (uno, due) => {
  const a = new Date(uno);
  const b = new Date(due);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

function ordinate(previsioni) {
  return (Array.isArray(previsioni) ? previsioni : [])
    .map(voce)
    .filter(Boolean)
    .sort((uno, due) => uno.quando - due.quando);
}

/**
 * La massima e la minima di oggi.
 *
 * Se le previsioni partono da domani — capita: alcune integrazioni tolgono il
 * giorno in corso appena passa mezzogiorno — torna `null`, e la card quella
 * riga non la scrive. Meglio una riga in meno di una riga che dice il giorno
 * sbagliato.
 */
export function oggiFraMassimaEMinima(previsioni, adesso = Date.now()) {
  const oggi = ordinate(previsioni).find((riga) => stessoGiorno(riga.quando, adesso));
  if (!oggi || (oggi.alta == null && oggi.bassa == null)) return null;
  return { alta: oggi.alta, bassa: oggi.bassa };
}

/**
 * I giorni che vengono, quelli dopo oggi.
 *
 * Oggi sta gia' in cima alla card — l'icona grande, i gradi, la massima e la
 * minima — e ripeterlo nella striscia sarebbe dire due volte la stessa cosa
 * nello stesso riquadro.
 */
export function giorniCheVengono(previsioni, quanti = 4, adesso = Date.now()) {
  return ordinate(previsioni)
    .filter((riga) => riga.quando > adesso && !stessoGiorno(riga.quando, adesso))
    .slice(0, Math.max(0, quanti));
}
