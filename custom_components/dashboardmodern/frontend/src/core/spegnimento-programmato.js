/* «Resta acceso per…»: il clima che si spegne da solo (#364).
 *
 * «Vorrei uno slider per decidere il tempo che un condizionatore debba restare
 * acceso dal momento che gli do l'on, utile spesso di notte o per accensioni a
 * spot.»
 *
 * La parte delicata non e' lo slider: e' DOVE vive il conto alla rovescia. Un
 * timer nel browser muore chiudendo la pagina, e chi accende il condizionatore
 * per due ore prima di dormire la pagina la chiude sempre — resterebbe acceso
 * tutta la notte, che e' esattamente il contrario di quello che ha chiesto.
 * Quindi il conto lo tiene Home Assistant, dentro l'integrazione, e qui c'e'
 * solo la regola: quali durate si offrono, cosa vuol dire una scadenza, e
 * quanto manca.
 *
 * Niente orologio anche qui: l'ora la porta chi chiama. Cosi' «fra un minuto
 * scade» si prova senza aspettare un minuto.
 */

const MINUTO = 60_000;

/* I fermi dello slider.
 *
 * Non e' una scala continua da 1 a 720: nessuno accende il condizionatore per
 * 37 minuti, e uno slider continuo su un telefono ti fa scegliere 37 quando ne
 * volevi 30. Sono i tempi che si scelgono davvero — un quarto d'ora per
 * togliere l'afa, due ore per addormentarsi, otto per la notte intera. */
export const FERMI_DELLO_SLIDER = Object.freeze([
  15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720,
]);

/** Il piu' corto e il piu' lungo che si possano chiedere. */
export const MINIMO_MINUTI = FERMI_DELLO_SLIDER[0];
export const MASSIMO_MINUTI = FERMI_DELLO_SLIDER.at(-1);

/* Un numero, o `null`.
 *
 * `null`, `undefined` e la stringa vuota NON sono zero, per quanto `Number()`
 * dica di si': sono «non c'e' scritto niente». La differenza conta tutta qui —
 * una scadenza che non c'e' letta come lo zero dell'epoca diventa una scadenza
 * passata da cinquantacinque anni, cioe' uno spegnimento inventato da un dato
 * mancante. */
const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/**
 * I minuti chiesti, ripuliti.
 *
 * `0` e' una risposta valida e vuol dire «nessuno spegnimento»: e' come si
 * toglie il timer. Tutto il resto si porta al fermo piu' vicino, cosi' un
 * valore arrivato da una vecchia configurazione — o battuto a mano — cade
 * comunque su una durata che lo slider sa mostrare.
 */
export function normalizzaIMinuti(valore) {
  const grezzo = numero(valore);
  if (grezzo === null || grezzo <= 0) return 0;
  const dentro = Math.min(Math.max(Math.round(grezzo), MINIMO_MINUTI), MASSIMO_MINUTI);
  let scelto = FERMI_DELLO_SLIDER[0];
  for (const fermo of FERMI_DELLO_SLIDER) {
    if (Math.abs(fermo - dentro) < Math.abs(scelto - dentro)) scelto = fermo;
  }
  return scelto;
}

/** Dove sta quel valore fra i fermi: e' la posizione dello slider. */
export function fermoDeiMinuti(minuti) {
  const scelto = normalizzaIMinuti(minuti);
  if (!scelto) return -1;
  return FERMI_DELLO_SLIDER.indexOf(scelto);
}

/** E il contrario: la posizione dello slider diventa minuti. */
export function minutiDelFermo(posizione) {
  const indice = Math.trunc(numero(posizione) ?? -1);
  if (indice < 0) return 0;
  return FERMI_DELLO_SLIDER[Math.min(indice, FERMI_DELLO_SLIDER.length - 1)];
}

const inglese = (locale) =>
  !String(locale ?? "it")
    .toLowerCase()
    .startsWith("it");

/**
 * Una durata scritta come la direbbe una persona: «45 min», «2 h», «1 h 30».
 *
 * Le ore tonde non portano gli zeri dei minuti: «2 h», non «2 h 00».
 */
export function durataScritta(minuti, locale = "it") {
  const totale = Math.max(0, Math.round(numero(minuti) ?? 0));
  if (!totale) return "";
  const ore = Math.floor(totale / 60);
  const resto = totale % 60;
  if (!ore) return `${resto} min`;
  if (!resto) return `${ore} h`;
  return inglese(locale) ? `${ore}h ${resto}m` : `${ore} h ${resto}`;
}

/**
 * Quando scade un'accensione che parte adesso e dura quei minuti.
 *
 * Torna il millisecondo, perche' e' quello che viaggia fino a Home Assistant e
 * torna indietro uguale. Zero minuti, nessuna scadenza: `null`.
 */
export function scadenzaDa(minuti, adessoMs) {
  const durata = normalizzaIMinuti(minuti);
  const partenza = numero(adessoMs);
  if (!durata || partenza === null) return null;
  return partenza + durata * MINUTO;
}

/**
 * Quanto manca a quella scadenza.
 *
 * `scaduto` e' la differenza fra «manca un istante» e «e' passata»: la prima si
 * mostra, la seconda si toglie di mezzo. Una scadenza che non c'e' — o
 * illeggibile — vale come nessun timer, non come uno appena scaduto: uno
 * spegnimento non si inventa da un dato mancante.
 */
export function quantoManca(scadenzaMs, adessoMs) {
  const fine = numero(scadenzaMs);
  const adesso = numero(adessoMs);
  if (fine === null || adesso === null) return { armato: false, scaduto: false, restaMs: 0 };
  const resta = fine - adesso;
  if (resta <= 0) return { armato: true, scaduto: true, restaMs: 0, minuti: 0 };
  return {
    armato: true,
    scaduto: false,
    restaMs: resta,
    /* Si arrotonda PER ECCESSO: a trenta secondi dalla fine la card deve dire
     * «1 min», non «0 min» — zero vuol dire finito, e non e' finito. */
    minuti: Math.ceil(resta / MINUTO),
  };
}

/**
 * Il conto alla rovescia da scrivere sulla card, o `""` se non c'e' niente da
 * scrivere.
 */
export function contoAllaRovescia(scadenzaMs, adessoMs, locale = "it") {
  const quanto = quantoManca(scadenzaMs, adessoMs);
  if (!quanto.armato || quanto.scaduto) return "";
  const durata = durataScritta(quanto.minuti, locale);
  return inglese(locale) ? `${durata} left` : `Ancora ${durata}`;
}

/**
 * I timer che hanno ancora senso, fra quelli che ci ha dato Home Assistant.
 *
 * Arriva una mappa `entity_id -> scadenza`. Quelli gia' scaduti si buttano qui,
 * non si disegnano attenuati: un conto alla rovescia fermo su «0 min» e' peggio
 * di nessun conto alla rovescia. Se la casa non ha ancora spento — riavvio nel
 * mezzo, integrazione ferma — la card torna a dire quello che l'entita' dice
 * davvero, che e' l'unica verita' che abbiamo.
 */
export function timerVivi(mappa, adessoMs) {
  const vivi = {};
  for (const [entita, scadenza] of Object.entries(mappa || {})) {
    const quanto = quantoManca(scadenza, adessoMs);
    if (quanto.armato && !quanto.scaduto) vivi[entita] = numero(scadenza);
  }
  return vivi;
}
