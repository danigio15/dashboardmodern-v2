/* Il modello di una grandezza nel tempo.
 *
 * Cosa fa. Prende una serie di letture — quando, quanto — e ne ricava le
 * quattro cose che servono per dire qualcosa di sensato su un numero: da che
 * parte sta andando, quando arrivera' dove deve arrivare, quale sia il suo
 * valore abituale, e se quello di adesso sia normale o no.
 *
 * Perche' esiste. La finestra di una sezione sapeva dire «574 W» e nient'altro.
 * Un numero da solo non si sa se e' tanto o poco: 574 watt sono normali per una
 * casa e tantissimi per un frigorifero. Per dirlo bisogna sapere cosa fa di
 * solito quel numero, ed e' esattamente cio' che questo modulo calcola.
 *
 * Perche' non c'e' un modello di linguaggio. Perche' non si puo' chiedere a
 * chi installa una plancia per la propria casa di installare anche un'AI, di
 * pagarla a ogni finestra che apre e di mandare fuori casa le letture dei
 * propri sensori. E perche' su questo mestiere — contare — un modello di
 * linguaggio e' lo strumento sbagliato: sbaglia i conti, e li sbaglia in modo
 * plausibile, che e' il peggiore dei modi. Qui i conti sono conti.
 *
 * Le tre scelte di modello che vale la pena conoscere.
 *
 * 1. Il tempo pesa. Home Assistant registra una lettura quando il valore
 *    cambia, non a intervalli regolari: un sensore che sta a zero per sei ore
 *    e poi fa tre picchi in un minuto lascia una lettura per le sei ore e tre
 *    per il minuto. Contando le letture, quel sensore «di solito» e' al picco;
 *    contando il tempo che ha passato a ciascun valore, di solito e' a zero —
 *    che e' la verita'. Ogni lettura pesa quanto e' durata.
 *
 * 2. Si usa la mediana, non la media. Un fotovoltaico che per due secondi
 *    legge 60000 W per un difetto dell'inverter sposta la media di un'ora
 *    intera; la mediana non la sposta. In casa i valori sballati non sono
 *    l'eccezione, sono il mercoledi'.
 *
 * 3. Una tendenza si annuncia solo se c'e'. La retta che meglio segue i punti
 *    si puo' tracciare sempre, anche su una nuvola di rumore: quanto quella
 *    retta spieghi davvero i punti lo dice la sua bonta', e sotto una certa
 *    bonta' qui si risponde «ferma» invece di inventare una salita.
 *
 * Dove si usa. Le letture delle sezioni in `analisi-sezione.js`, per adesso.
 * Ma non sa niente di sezioni, di finestre e di documento: prende numeri e
 * restituisce numeri. Va bene per una soglia di avviso, per una previsione
 * nella pagina di una sezione, per decidere se una scheda debba colorarsi.
 */

/* ── attrezzi ──────────────────────────────────────────────────────────── */

const ORA = 3600_000;

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/* Quanti punti servono prima di dire qualcosa. Sotto questi non si e' prudenti:
 * si e' zitti. Tre letture in un'ora non sono una tendenza, sono tre letture. */
const PUNTI_MINIMI = 5;
const ARCO_MINIMO = 10 * 60_000;

/* La retta si annuncia solo se spiega almeno questa parte dei punti. Sotto,
 * quello che si vede e' rumore con una retta disegnata sopra. */
const BONTA_MINIMA = 0.35;

/* ── la serie ──────────────────────────────────────────────────────────── */

/**
 * Mette in ordine una serie di letture e butta quello che non e' un numero.
 *
 * Accetta `{quando, valore}`, `{when, value}` e `{t, v}`: le tre forme che
 * girano gia' nel progetto, cosi' chi ha una serie non deve rimodellarla per
 * darla qui.
 */
export function serie(punti) {
  /* La chiamano tutte le funzioni di qui, sempre, anche quando la serie sembra
   * gia' a posto. Il primo tentativo aveva una scorciatoia — «se il primo punto
   * ha gia' la forma giusta, salta» — e su una serie in ordine inverso le
   * durate venivano negative e il solito spariva. Una funzione che ordina non
   * puo' dare per scontato l'ordine. */
  if (!Array.isArray(punti)) return [];
  const puliti = [];
  for (const punto of punti) {
    const quando = numero(punto?.quando ?? punto?.when ?? punto?.t ?? punto?.[0]);
    const valore = numero(punto?.valore ?? punto?.value ?? punto?.v ?? punto?.[1]);
    if (quando == null || valore == null) continue;
    puliti.push({ quando, valore });
  }
  puliti.sort((a, b) => a.quando - b.quando);
  return puliti;
}

/** L'arco di tempo coperto, in millisecondi. */
export function arco(letture) {
  if (letture.length < 2) return 0;
  return letture[letture.length - 1].quando - letture[0].quando;
}

const abbastanza = (letture) => letture.length >= PUNTI_MINIMI && arco(letture) >= ARCO_MINIMO;

/* ── da che parte sta andando ──────────────────────────────────────────── */

/**
 * La retta che meglio segue i punti.
 *
 * Torna la pendenza in unita' all'ora, il verso a parole, e la bonta' — quanto
 * quella retta spieghi davvero i punti, da 0 a 1. Il verso e' «ferma» quando la
 * bonta' non basta: una retta la si puo' tracciare anche sul rumore, e
 * annunciare una salita che non c'e' e' peggio che tacere.
 *
 * Torna `null` quando i punti sono troppo pochi o troppo ravvicinati.
 */
export function tendenza(punti) {
  const letture = serie(punti);
  if (!abbastanza(letture)) return null;

  const inizio = letture[0].quando;
  const ore = letture.map((l) => (l.quando - inizio) / ORA);
  const valori = letture.map((l) => l.valore);
  const n = letture.length;
  const mediaOre = ore.reduce((s, v) => s + v, 0) / n;
  const mediaValori = valori.reduce((s, v) => s + v, 0) / n;

  let sopra = 0;
  let sotto = 0;
  for (let i = 0; i < n; i += 1) {
    sopra += (ore[i] - mediaOre) * (valori[i] - mediaValori);
    sotto += (ore[i] - mediaOre) ** 2;
  }
  if (sotto === 0) return null;
  const pendenza = sopra / sotto;
  const quota = mediaValori - pendenza * mediaOre;

  let residui = 0;
  let totale = 0;
  for (let i = 0; i < n; i += 1) {
    residui += (valori[i] - (quota + pendenza * ore[i])) ** 2;
    totale += (valori[i] - mediaValori) ** 2;
  }
  const bonta = totale === 0 ? 0 : Math.max(0, 1 - residui / totale);
  const seguita = bonta >= BONTA_MINIMA;

  return {
    perOra: pendenza,
    quota,
    bonta,
    verso: !seguita ? "ferma" : pendenza > 0 ? "sale" : pendenza < 0 ? "scende" : "ferma",
    primo: letture[0],
    ultimo: letture[n - 1],
  };
}

/**
 * Quando la tendenza incontrera' un valore.
 *
 * Torna il momento in millisecondi, oppure `null` — e i «null» qui sono la
 * parte importante: si tace quando la tendenza non c'e', quando va dalla parte
 * sbagliata, e quando il momento cade oltre l'orizzonte. Dire «la batteria
 * sara' piena fra ventisei ore» e' un modo raffinato di non dire niente: da
 * qui a ventisei ore succede tutt'altro.
 */
export function quandoTocca(punti, bersaglio, { adesso = Date.now(), orizzonteOre = 12 } = {}) {
  const meta = numero(bersaglio);
  const linea = tendenza(punti);
  if (meta == null || !linea || linea.verso === "ferma") return null;
  const ultimo = linea.ultimo.valore;
  const distanza = meta - ultimo;
  if (distanza === 0) return adesso;
  /* La pendenza deve puntare verso il bersaglio, non allontanarsene. */
  if (Math.sign(distanza) !== Math.sign(linea.perOra)) return null;
  const ore = distanza / linea.perOra;
  if (!Number.isFinite(ore) || ore <= 0 || ore > orizzonteOre) return null;
  return adesso + ore * ORA;
}

/* ── il valore abituale ────────────────────────────────────────────────── */

/**
 * Il solito: la mediana pesata sul tempo, e di quanto ci si allontana.
 *
 * «Pesata sul tempo» e' la scelta che conta. Ogni lettura vale quanto e'
 * durata, cioe' fino alla lettura dopo: un sensore fermo a zero per sei ore e
 * poi con tre picchi in un minuto ha come solito lo zero, non il picco. Senza
 * questo peso, «di solito» diventa «di solito quando cambia», che di una casa
 * non dice niente.
 *
 * Lo scarto e' quello assoluto mediano — la mediana di quanto le letture
 * distano dalla mediana. Non e' la deviazione standard, ed e' apposta: un solo
 * valore sballato gonfia la deviazione standard e con lei la soglia di
 * «insolito», che e' il modo in cui una guardia smette di suonare.
 */
export function ilSolito(punti, { adesso = Date.now() } = {}) {
  const letture = serie(punti);
  if (letture.length < 2) return null;

  const pesate = [];
  for (let i = 0; i < letture.length - 1; i += 1) {
    const durata = letture[i + 1].quando - letture[i].quando;
    if (durata > 0) pesate.push({ valore: letture[i].valore, peso: durata });
  }
  /* L'ultima lettura dura fino ad adesso, e va pesata come le altre.
   *
   * Pesando solo gli intervalli fra letture consecutive, l'ultima non ne
   * aveva nessuno e valeva zero. Su una casa e' il caso normale: un sensore
   * passa da 100 a 200 un'ora fa e poi non cambia piu': con l'ultima a peso
   * zero, il solito resta 100 e il 200 di adesso risulta fortemente insolito —
   * cioe' si annuncia una stranezza a un sensore che sta fermo da un'ora. */
  const ultima = letture[letture.length - 1];
  const codaFinoAOra = adesso - ultima.quando;
  if (codaFinoAOra > 0) pesate.push({ valore: ultima.valore, peso: codaFinoAOra });
  if (!pesate.length) return null;

  const centro = medianaPesata(pesate);
  const distanze = pesate.map((p) => ({ valore: Math.abs(p.valore - centro), peso: p.peso }));
  const scarto = medianaPesata(distanze);
  const valori = letture.map((l) => l.valore);
  return {
    centro,
    scarto,
    minimo: Math.min(...valori),
    massimo: Math.max(...valori),
    arco: arco(letture),
  };
}

function medianaPesata(pesate) {
  const ordinate = [...pesate].sort((a, b) => a.valore - b.valore);
  const totale = ordinate.reduce((s, p) => s + p.peso, 0);
  let corso = 0;
  for (const punto of ordinate) {
    corso += punto.peso;
    if (corso >= totale / 2) return punto.valore;
  }
  return ordinate[ordinate.length - 1].valore;
}

/**
 * Il solito a quest'ora del giorno.
 *
 * Una casa non e' uguale a se stessa alle tre di notte e alle otto di sera: il
 * consumo abituale delle otto e' fuori norma alle tre. Si guardano quindi le
 * letture cadute nella stessa fascia oraria, e si pretendono almeno due giorni
 * distinti — con un giorno solo non e' un'abitudine, e' quello che e'
 * successo ieri.
 */
export function ilSolitoAQuestOra(punti, { adesso = Date.now(), larghezzaOre = 1 } = {}) {
  const letture = serie(punti);
  if (letture.length < PUNTI_MINIMI) return null;
  const oraDi = (istante) => new Date(istante).getHours();
  const bersaglio = oraDi(adesso);
  const vicine = letture.filter((l) => {
    const distanza = Math.abs(oraDi(l.quando) - bersaglio);
    return Math.min(distanza, 24 - distanza) <= larghezzaOre;
  });
  if (vicine.length < PUNTI_MINIMI) return null;
  const giorni = new Set(vicine.map((l) => new Date(l.quando).toDateString()));
  if (giorni.size < 2) return null;
  const solito = ilSolito(vicine, { adesso });
  return solito ? { ...solito, giorni: giorni.size, ora: bersaglio } : null;
}

/**
 * Quanto e' insolito un valore: di quanti scarti si allontana dal solito.
 *
 * Zero vuol dire «e' il solito». Sopra tre, e' una cosa che quel sensore non
 * fa quasi mai. Con lo scarto a zero — un valore che non si e' mai mosso — un
 * qualunque scostamento e' infinitamente insolito, e allora si risponde con
 * una misura del cambiamento invece che con una divisione per zero.
 */
export function quantoInsolito(valore, solito) {
  const v = numero(valore);
  if (v == null || !solito) return null;
  const distanza = Math.abs(v - solito.centro);
  if (solito.scarto > 0) return distanza / solito.scarto;
  if (distanza === 0) return 0;
  const scala = Math.abs(solito.centro) || 1;
  return (distanza / scala) * 10;
}

/* ── chi pesa di piu' ──────────────────────────────────────────────────── */

/**
 * La voce che pesa di piu' in un insieme, e quanto pesa.
 *
 * Serve alla domanda che ci si fa davanti a un totale: «e chi lo sta
 * consumando?». Torna la voce, la sua quota sul totale e se domina davvero —
 * cioe' se vale la pena nominarla invece di elencarle tutte.
 */
export function chiPesaDiPiu(voci, quanto = (voce) => voce?.valore) {
  if (!Array.isArray(voci) || !voci.length) return null;
  const pesate = voci
    .map((voce) => ({ voce, peso: numero(quanto(voce)) ?? 0 }))
    .filter((v) => v.peso > 0)
    .sort((a, b) => b.peso - a.peso);
  if (!pesate.length) return null;
  const totale = pesate.reduce((s, v) => s + v.peso, 0);
  const primo = pesate[0];
  const quota = totale > 0 ? primo.peso / totale : 0;
  return {
    voce: primo.voce,
    peso: primo.peso,
    quota,
    totale,
    quante: pesate.length,
    /* «Domina» vuol dire: da sola vale piu' di tutte le altre messe insieme.
     * E' la soglia oltre la quale nominare quella e basta racconta la cosa
     * meglio di un elenco. */
    domina: quota > 0.5 && pesate.length > 1,
  };
}

/* ── la lettura completa ───────────────────────────────────────────────── */

/**
 * Tutto quello che il modello sa dire di una serie, in un colpo solo.
 *
 * E' la porta comoda: chi ha una serie e un valore di adesso chiede qui e si
 * prende quello che gli serve. Ogni campo puo' essere `null`, e un `null` va
 * letto come «di questo non so dire niente» — non come zero. Chi disegna deve
 * poter distinguere «la batteria e' ferma» da «non so se la batteria si
 * muove», perche' sono due frasi diverse.
 */
export function letturaNelTempo(punti, { adesso = Date.now(), bersaglio = null } = {}) {
  const letture = serie(punti);
  if (!letture.length) return null;
  const adessoValore = letture[letture.length - 1].valore;
  const solito = ilSolito(letture, { adesso });
  const abituale = ilSolitoAQuestOra(letture, { adesso });
  const riferimento = abituale || solito;
  return {
    valore: adessoValore,
    punti: letture.length,
    arco: arco(letture),
    tendenza: tendenza(letture),
    solito,
    abituale,
    insolito: riferimento ? quantoInsolito(adessoValore, riferimento) : null,
    arrivo: bersaglio == null ? null : quandoTocca(letture, bersaglio, { adesso }),
  };
}

/* Le soglie con cui si legge `insolito`, dichiarate una volta sola perche' chi
 * ne scrive una frase e chi ne colora una scheda usino le stesse. */
export const SOGLIE_INSOLITO = Object.freeze({ notevole: 2, forte: 3.5 });
