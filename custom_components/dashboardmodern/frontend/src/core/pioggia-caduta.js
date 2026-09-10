/* Quanta pioggia e' caduta, e se l'irrigazione ha ancora senso (#478).
 *
 * «Per chi ha una stazione meteo sarebbe utile vedere il rain rate e la
 * pioggia caduta nella giornata. Questo potrebbe integrarsi anche su gestione
 * irrigazione.»
 *
 * L'irrigazione una regola sulla pioggia ce l'aveva gia', ma guarda un'altra
 * cosa: la PROBABILITA' di pioggia — quanto e' probabile che piova, in
 * percentuale, secondo le previsioni. Serve a decidere la sera per la mattina
 * dopo. Un pluviometro dice un fatto diverso e piu' forte: quanta acqua e'
 * caduta davvero. Le due non si sostituiscono — una previsione sbagliata
 * capita, un millimetro caduto no — e infatti qui stanno insieme.
 *
 * La soglia e' in millimetri perche' e' in millimetri che si misura
 * l'irrigazione: un impianto da giardino ne mette fra i tre e i sei per giro,
 * quindi cinque millimetri di pioggia sono un giro gia' fatto dal cielo.
 *
 * Il modulo e' puro: entrano due numeri, esce un verdetto con un nome.
 */

const numero = (valore) => {
  const n = Number.parseFloat(String(valore ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/* Cinque millimetri: il giro di un impianto da giardino. Sotto, la pioggia ha
 * bagnato ma non innaffiato; sopra, innaffiare di nuovo e' acqua buttata. */
export const PIOGGIA_CHE_BASTA_MM = 5;

/* Un decimo di millimetro all'ora e' rumore del pluviometro, non pioggia: le
 * stazioni economiche oscillano attorno allo zero quando l'imbuto e' bagnato. */
const PIOGGIA_VERA_MM_H = 0.2;

/** Se in questo momento sta piovendo davvero. */
export function stapiovendo(intensita) {
  const mm = numero(intensita);
  return mm !== null && mm >= PIOGGIA_VERA_MM_H;
}

/**
 * Il verdetto sull'irrigazione, guardando il cielo di oggi.
 *
 * Tre esiti e non due: «sta piovendo» e «ha piovuto abbastanza» sono due
 * ragioni diverse per saltare il giro, e chi legge la pagina vuole sapere
 * quale delle due e'. `null` quando non si sa — nessun sensore indicato — che
 * non e' «asciutto»: dire asciutto senza pluviometro sarebbe inventarselo.
 */
export function verdettoDellaPioggia({ intensita, oggi, soglia = PIOGGIA_CHE_BASTA_MM } = {}) {
  const adesso = numero(intensita);
  const caduta = numero(oggi);
  if (adesso === null && caduta === null) return null;
  const limite = numero(soglia) ?? PIOGGIA_CHE_BASTA_MM;
  if (stapiovendo(adesso))
    return { chiave: "piove", intensita: adesso, oggi: caduta, soglia: limite };
  if (caduta !== null && caduta >= limite)
    return { chiave: "bagnato", intensita: adesso, oggi: caduta, soglia: limite };
  return { chiave: "asciutto", intensita: adesso, oggi: caduta, soglia: limite };
}

/** Se il giro si puo' saltare: sta piovendo, oppure ha gia' piovuto abbastanza. */
export function siPuoSaltare(verdetto) {
  return verdetto?.chiave === "piove" || verdetto?.chiave === "bagnato";
}
