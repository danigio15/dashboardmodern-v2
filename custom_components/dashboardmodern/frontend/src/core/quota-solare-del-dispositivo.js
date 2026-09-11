/* Quanto di quello che ha consumato un apparecchio veniva dal sole.
 *
 * «Wallbox sempre sbagliato»: la card diceva 49,4 kWh dal fotovoltaico e 18,7
 * dalla rete, e i numeri veri erano 22,8 e 45,3. Non un errore di misura: il
 * rovescio esatto della realta'.
 *
 * ── Il conto di prima, e perche' non poteva funzionare ──────────────────────
 *
 * Si prendeva la quota di rete di TUTTA LA CASA nel mese e la si incollava sui
 * kWh dell'apparecchio:
 *
 *     gridShare = rete_della_casa / consumo_della_casa
 *     rete = suoi_kWh * gridShare
 *
 * Sui numeri di quella segnalazione: 18,7 / 68,1 = 0,2746, che e' esattamente
 * la quota di rete della casa. La plancia non stava misurando niente — stava
 * copiando una percentuale da un'altra domanda.
 *
 * Per un frigorifero, che tira uguale giorno e notte, quella copia e' quasi
 * giusta. Per un'auto e' quasi sempre sbagliata, e piu' e' grossa la ricarica
 * piu' sbaglia: una macchina si attacca la sera e stacca la mattina, cioe'
 * nelle ore in cui il sole non c'e'. Il mese le da' il 72% di sole perche' la
 * CASA, nelle sue ore, il sole ce l'ha.
 *
 * ── Il conto giusto ─────────────────────────────────────────────────────────
 *
 * La quota di sole di un consumo si sa solo sapendo QUANDO e' avvenuto. Ora per
 * ora: in quest'ora l'apparecchio ha preso tanto, e in quest'ora la casa stava
 * prendendo dalla rete questa frazione di quello che consumava. Il resto e'
 * una somma.
 *
 * Il dato per farlo c'e' gia': sono le stesse statistiche a lungo termine da
 * cui esce il grafico del mese. Cambia la grana con cui si chiedono — a ore
 * invece che a mesi — e la grana e' proprio l'informazione che serviva.
 *
 * ── Cosa NON fa ─────────────────────────────────────────────────────────────
 *
 * Non inventa. Se le ore non ci sono — un Recorder che non le tiene, un
 * apparecchio senza statistiche — lo dice, e chi chiama decide se ripiegare
 * sulla vecchia stima dicendo che e' una stima, o non scrivere niente. Una
 * percentuale inventata scritta come se fosse misurata e' il difetto che
 * questo modulo esiste per non rifare.
 */

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

const positivo = (valore) => {
  const n = numero(valore);
  return n != null && n > 0 ? n : 0;
};

/* Il momento di un secchiello, in millisecondi.
 *
 * Le statistiche di Home Assistant lo danno come `start`, che puo' essere una
 * stringa ISO o un numero: le due forme arrivano dalla stessa risposta a
 * seconda di chi l'ha letta, e distinguerle qui e' meno lavoro che ricordarsi
 * di normalizzarle in tre chiamanti. */
function quando(riga) {
  const grezzo = riga?.inizio ?? riga?.start ?? riga?.quando;
  if (grezzo == null) return null;
  const n = Number(grezzo);
  if (Number.isFinite(n) && n > 0) return n;
  const data = new Date(grezzo);
  const tempo = data.getTime();
  return Number.isFinite(tempo) ? tempo : null;
}

const quanti = (riga) => positivo(riga?.kwh ?? riga?.valore ?? riga?.change ?? riga?.value);

/** Una serie di secchielli in una mappa momento → kWh. */
export function perMomento(serie = []) {
  const mappa = new Map();
  for (const riga of Array.isArray(serie) ? serie : []) {
    const momento = quando(riga);
    if (momento == null) continue;
    mappa.set(momento, (mappa.get(momento) || 0) + quanti(riga));
  }
  return mappa;
}

/**
 * La quota di rete della casa in un secchiello.
 *
 * Senza consumo di casa non c'e' una frazione da calcolare, e la risposta
 * onesta e' «tutto dalla rete»: e' l'unica che non regala sole che non si sa
 * se c'era. La frazione si tiene fra zero e uno perche' una casa che esporta
 * puo' avere prelievo maggiore del consumo per un'ora storta di
 * arrotondamenti, e una quota del 130% non vuol dire niente.
 */
export function quotaDiRete(consumoDiCasa, preloDallaRete) {
  const casa = positivo(consumoDiCasa);
  if (casa <= 0) return 1;
  const rete = positivo(preloDallaRete);
  return Math.max(0, Math.min(1, rete / casa));
}

/* Quanta parte del periodo le ore devono spiegare perche' la misura valga.
 *
 * Sotto questa soglia la proporzione misurata verrebbe stirata su un totale
 * molto piu' grande: una notte di ricarica deciderebbe la spartizione di un
 * anno. Meglio la stima di prima, dichiarata per quello che e'. */
export const COPERTURA_MINIMA = 0.75;

/**
 * La spartizione fra sole e rete dei kWh di un apparecchio.
 *
 * `dispositivo`, `casa` e `rete` sono tre serie di secchielli con lo stesso
 * passo — ore, o giorni — e lo stesso momento d'inizio. `totale` e' il numero
 * che la card scrive in grande: quando c'e', la spartizione si riscala su
 * quello, perche' il numero grande e la sua divisione devono sommare alla
 * stessa cosa. Chi possiede il numero possiede la riga.
 *
 * Torna anche `fonte` e `coperto`:
 *
 *  - `fonte` e' `"secchielli"` quando la divisione l'hanno fatta i dati, e `""`
 *    quando non c'era niente da dividere. Un chiamante che riceve `""` non deve
 *    scrivere una percentuale come se fosse misurata.
 *  - `coperto` sono i kWh che i secchielli spiegano. Se il totale e' cento e i
 *    secchielli ne spiegano dieci, la divisione e' una supposizione su un
 *    decimo dei dati e chi legge ha il diritto di saperlo.
 */
export function quotaSolareDelDispositivo({
  dispositivo = [],
  casa = [],
  rete = [],
  totale = null,
} = {}) {
  const suoi = perMomento(dispositivo);
  const diCasa = perMomento(casa);
  const dallaRete = perMomento(rete);

  let quotaRete = 0;
  let quotaSole = 0;
  let coperto = 0;
  let scoperto = 0;
  let secchielli = 0;

  for (const [momento, kwh] of suoi) {
    if (kwh <= 0) continue;
    /* Un'ora si conta solo se TUTTE E TRE le misure ci sono.
     *
     * `quotaDiRete` legge un consumo di casa mancante come «tutto dalla rete»
     * e un prelievo mancante come «tutto dal sole»: sono le due risposte
     * prudenti quando il dato c'e' ed e' zero, e sono due invenzioni quando il
     * dato non c'e' affatto. Un'ora in cui la casa o la rete non hanno un
     * secchiello non dice niente sulla quota di sole, e allora non vota: entra
     * nello scoperto, che e' cio' che decide se la misura vale. */
    if (!diCasa.has(momento) || !dallaRete.has(momento)) {
      scoperto += kwh;
      continue;
    }
    secchielli += 1;
    coperto += kwh;
    const share = quotaDiRete(diCasa.get(momento), dallaRete.get(momento));
    quotaRete += kwh * share;
    quotaSole += kwh * (1 - share);
  }

  const vuota = { grid: 0, solar: 0, quotaRete: 0, coperto: 0, secchielli: 0, fonte: "" };
  if (!secchielli) return vuota;

  const somma = quotaRete + quotaSole;
  if (somma <= 0) return vuota;
  const frazioneDiRete = quotaRete / somma;

  /* La misura vale solo se copre abbastanza del periodo.
   *
   * Il numero grande della card e' il totale del periodo; le ore ne spiegano
   * una parte. Riscalare la proporzione di quella parte su tutto il totale va
   * bene finche' la parte e' il grosso: e' la stessa casa, le stesse abitudini.
   * Non va piu' bene quando le ore sono una manciata — statistiche cominciate
   * da poco, un Recorder che ne tiene per pochi giorni — perche' allora una
   * notte sola deciderebbe la spartizione di un anno intero.
   *
   * Quando non copre, la misura si dichiara non fatta (`fonte: ""`), e chi
   * chiama resta sulla stima di prima. `coperto` e `scoperto` tornano indietro
   * comunque: sono il perche'. */
  const grande = numero(totale);
  const misurabile = coperto + scoperto;
  const riferimento = grande != null && grande > 0 ? grande : misurabile;
  if (riferimento > 0 && coperto / riferimento < COPERTURA_MINIMA)
    return { ...vuota, coperto, secchielli };

  const scala = grande != null && grande > 0 ? grande / somma : 1;

  return {
    grid: quotaRete * scala,
    solar: quotaSole * scala,
    /* La FRAZIONE di rete, oltre ai kWh.
     *
     * I kWh qui dentro valgono per il totale che e' stato passato, e il totale
     * di un mese in corso cresce tutto il giorno. Chi disegna tiene la frazione
     * e la rimoltiplica per il numero che sta scrivendo: cosi' la spartizione
     * somma sempre al totale che si vede, invece di restare indietro di
     * quanto e' cresciuto il mese da quando si e' misurato. */
    quotaRete: frazioneDiRete,
    coperto,
    secchielli,
    fonte: "secchielli",
  };
}
