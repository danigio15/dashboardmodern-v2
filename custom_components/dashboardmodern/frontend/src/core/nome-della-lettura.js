/* Il nome di una lettura, senza la parola detta due volte.
 *
 * Nella finestra del Solare termico si leggeva «Temperatura Pannello solare
 * Temperature», «Temperatura Boiler Temperature», «Boiler temperatura sopra
 * Temperature». La parola c'e' due volte, una per lingua, e la seconda non
 * aggiunge niente: accanto c'e' gia' il termometro, e il valore finisce per «°».
 *
 * Da dove viene. Home Assistant costruisce il nome amichevole di un sensore
 * mettendo insieme il nome del dispositivo e quello dell'entita': un
 * dispositivo chiamato «Temperatura Pannello solare» con dentro un'entita'
 * «Temperature» produce esattamente quella riga. Non e' un difetto della
 * plancia — e' come si chiamano le cose in casa — ma stampato cosi' com'e'
 * sembra un difetto della plancia, ed e' quello che si vede.
 *
 * Cosa fa questo modulo: toglie dalla coda del nome la parola che dice la
 * misura, quando quella misura e' gia' scritta altrove nella riga — l'unita'
 * del valore la dice, e l'icona pure. E accorpa una parola ripetuta due volte
 * di fila, che nasce dallo stesso incastro.
 *
 * Cosa NON fa, ed e' la parte che conta: non tocca un nome che senza quella
 * parola diventerebbe piu' povero. «Delta Solare termico Boiler» resta
 * intero — nessuna delle sue parole e' la misura. «Temperatura» da sola resta
 * «Temperatura», perche' togliendola non resterebbe niente. La regola e' che
 * si toglie solo cio' che e' ridondante, mai cio' che identifica.
 */

const PULITO = (valore) => String(valore ?? "").trim();

/* Le parole che dicono una misura, nelle lingue in cui la plancia si trova a
 * leggerle: l'italiano e l'inglese di Home Assistant, che convivono nella
 * stessa casa perche' l'integrazione parla inglese e chi nomina i dispositivi
 * parla italiano. */
const PAROLE_DI_MISURA = Object.freeze({
  temperatura: ["temperature", "temperatura", "temp"],
  umidita: ["humidity", "umidita", "umidità"],
  potenza: ["power", "potenza"],
  energia: ["energy", "energia"],
  carica: ["battery", "batteria", "charge", "carica"],
  pressione: ["pressure", "pressione"],
});

/* Quale misura dichiara un'unita'. Serve a sapere se la parola in coda al nome
 * e' gia' detta dal numero: «80,9 °C» dice «temperatura» meglio della parola. */
function misuraDellUnita(unita) {
  const u = PULITO(unita).toLowerCase();
  if (!u) return null;
  if (/^°|^(c|f|k)$|celsius|fahrenheit/.test(u)) return "temperatura";
  if (u === "%") return "umidita";
  if (/^k?w$|^m?w$/.test(u)) return "potenza";
  if (/wh$/.test(u)) return "energia";
  if (/^(bar|pa|hpa|kpa|psi)$/.test(u)) return "pressione";
  return null;
}

const normalizza = (parola) =>
  PULITO(parola)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

/* Una parola ripetuta di fila si dice una volta sola: «Boiler Boiler» nasce
 * dallo stesso incastro fra nome del dispositivo e nome dell'entita'. */
function senzaRipetizioni(parole) {
  const fuori = [];
  for (const parola of parole) {
    const precedente = fuori[fuori.length - 1];
    if (precedente && normalizza(precedente) === normalizza(parola)) continue;
    fuori.push(parola);
  }
  return fuori;
}

/**
 * Il nome da mostrare, tolto cio' che e' gia' detto altrove nella riga.
 *
 * `unita` e' l'unita' del valore che sta sulla stessa riga: se c'e', la parola
 * in coda che dice la stessa misura se ne va. Senza unita' si toglie comunque
 * una ripetizione, che e' ridondante in ogni caso.
 */
export function nomeDellaLettura(nome, { unita = "" } = {}) {
  const testo = PULITO(nome);
  if (!testo) return "";
  let parole = senzaRipetizioni(testo.split(/\s+/).filter(Boolean));

  const misura = misuraDellUnita(unita);
  if (misura) {
    const dicono = PAROLE_DI_MISURA[misura] || [];
    /* Si toglie solo dalla coda, e solo se resta qualcosa che identifichi la
     * cosa: un nome che diventa vuoto, o che si riduce a una parola sola gia'
     * presente altrove, non e' piu' un nome. */
    while (parole.length > 1 && dicono.includes(normalizza(parole[parole.length - 1])))
      parole = parole.slice(0, -1);
  }

  /* La stessa parola di misura ripetuta in testa e in coda — «Temperatura
   * Boiler Temperature» — se ne va anche senza unita', perche' e' la stessa
   * parola due volte in due lingue, e questo non aiuta nessuno. */
  if (parole.length > 2) {
    const testa = normalizza(parole[0]);
    const coda = normalizza(parole[parole.length - 1]);
    for (const dicono of Object.values(PAROLE_DI_MISURA))
      if (dicono.includes(testa) && dicono.includes(coda)) {
        parole = parole.slice(0, -1);
        break;
      }
  }

  return parole.join(" ");
}
