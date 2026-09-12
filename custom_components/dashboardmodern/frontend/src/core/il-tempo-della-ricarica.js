/* Quanto manca alla fine della carica.
 *
 * «Sezione EV non calcola il tempo di fine»: la casella diceva IN ATTESA con
 * 1,61 kW che passavano davvero nel cavo.
 *
 * Il guscio il conto lo sapeva fare, ma partiva da una domanda sbagliata: «sta
 * caricando?» gliela rispondeva una riga sola — `codeEV === 'C' || codeEV ===
 * 'D'` — cioe' l'alfabeto delle colonnine, maiuscolo ed esatto. Una colonnina
 * che dice `charging`, un `binary_sensor` che dice `on`, evcc che dice
 * `charging_solar`: per quella riga non stanno caricando, e la casella resta
 * IN ATTESA finche' la carica non finisce da sola. La lettera la sa dare il
 * nucleo della ricarica, che parla tutti i dialetti, e da li' il conto viene.
 *
 * L'altra meta' e' la capacita' della batteria. Il guscio dava settanta
 * kilowattora a tutte le auto del mondo: su una batteria da quaranta il tempo
 * usciva quasi doppio. Qui la capacita' entra come numero, e chi la chiama la
 * legge dalla vettura — che adesso ha la sua casella.
 *
 * Puro: entrano la lettera, le percentuali, la potenza e la capacita'; esce
 * quanto manca, in minuti, e perche' non c'e' un numero quando non c'e'.
 */

/* La capacita' che si assume quando la vettura non l'ha dichiarata. E' la
 * stessa che assumeva il guscio: cambiarla di nascosto vorrebbe dire far
 * ballare il tempo a chi non ha toccato niente. */
export const CAPACITA_DI_SERIE = 70;

/* Un numero, o niente. `null`, `undefined` e la stringa vuota NON sono zero:
 * `Number(null)` fa zero, e uno zero preso per buono qui vorrebbe dire un
 * tempo di fine calcolato su una batteria che nessuno ha dichiarato. */
const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
};

/**
 * La potenza in kilowatt, qualunque unita' usi la colonnina.
 *
 * Home Assistant lascia scegliere fra W e kW. Senza unita' si guarda la
 * grandezza — sopra i cento e' in watt, perche' nessuna colonnina domestica
 * eroga cento kilowatt e nessuna carica utile sta sotto i cento watt — che e'
 * la stessa regola del guscio, scritta dove si puo' leggere.
 */
export function inKilowatt(potenza, unita = "") {
  const letto = numero(potenza);
  if (letto === null) return null;
  const nome = String(unita || "")
    .trim()
    .toLowerCase();
  if (nome === "kw") return letto;
  if (nome === "w") return letto / 1000;
  return letto > 100 ? letto / 1000 : letto;
}

/**
 * Quanto manca.
 *
 * Torna `{ stato, minuti }`:
 *   - "completa"   la batteria e' piena;
 *   - "raggiunto"  si e' arrivati al limite chiesto;
 *   - "carica"     sta caricando, e `minuti` dice quanti ne mancano;
 *   - "attesa"     non sta caricando, o non c'e' abbastanza per dirlo.
 *
 * `minuti` e' un numero solo nel caso "carica".
 */
export function tempoDellaRicarica({
  codice = "",
  soc = null,
  target = null,
  kilowatt = null,
  capacita = CAPACITA_DI_SERIE,
} = {}) {
  const adesso = numero(soc);
  const limite = numero(target);
  const potenza = numero(kilowatt);
  const pacco = numero(capacita) || CAPACITA_DI_SERIE;
  if (adesso !== null && adesso >= 100) return { stato: "completa", minuti: null };
  if (adesso !== null && limite !== null && adesso >= limite)
    return { stato: "raggiunto", minuti: null };
  /* Si conta solo quando sta caricando davvero: con la carica ferma il numero
   * sarebbe una promessa che nessuno sta mantenendo. */
  if (codice !== "C" || potenza === null || potenza <= 0 || adesso === null || limite === null)
    return { stato: "attesa", minuti: null };
  const kwh = ((limite - adesso) / 100) * pacco;
  if (kwh <= 0) return { stato: "raggiunto", minuti: null };
  return { stato: "carica", minuti: Math.max(1, Math.round((kwh / potenza) * 60)) };
}

/** I minuti in ore e minuti, come li scrive la plancia: «2H 15M». */
export function oreEMinuti(minuti) {
  const totale = numero(minuti);
  if (totale === null || totale < 0) return "";
  return `${Math.floor(totale / 60)}H ${totale % 60}M`;
}

/** L'ora a cui si arriva, partendo da adesso. */
export function oraDiArrivo(minuti, adesso = Date.now()) {
  const totale = numero(minuti);
  if (totale === null || totale < 0) return null;
  return new Date(adesso + totale * 60000);
}
