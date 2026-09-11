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
  let secchielli = 0;

  for (const [momento, kwh] of suoi) {
    if (kwh <= 0) continue;
    secchielli += 1;
    coperto += kwh;
    const share = quotaDiRete(diCasa.get(momento), dallaRete.get(momento));
    quotaRete += kwh * share;
    quotaSole += kwh * (1 - share);
  }

  if (!secchielli) return { grid: 0, solar: 0, coperto: 0, secchielli: 0, fonte: "" };

  const somma = quotaRete + quotaSole;
  const scala = (() => {
    const grande = numero(totale);
    if (grande == null || grande <= 0 || somma <= 0) return 1;
    return grande / somma;
  })();

  return {
    grid: quotaRete * scala,
    solar: quotaSole * scala,
    coperto,
    secchielli,
    fonte: "secchielli",
  };
}
