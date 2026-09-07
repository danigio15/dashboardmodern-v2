/* Quando un clima e' di stagione, e quando non lo e' (#365).
 *
 * «Vorrei fosse possibile con un flag magari di mesi dell'anno selezionare i
 * periodi in cui vengono mostrate le card di un clima, esempio: condizionatore
 * solo maggio-settembre, termosifoni ottobre-aprile.»
 *
 * A giugno la pagina del Clima mostra otto termosifoni che nessuno accendera'
 * per quattro mesi, e i due condizionatori che servono stanno in fondo. Non e'
 * una configurazione sbagliata: e' che meta' di quello che c'e' scritto non
 * riguarda oggi.
 *
 * Qui c'e' solo la regola. Nessun orologio: l'ora la porta chi chiama, cosi'
 * «siamo di stagione?» si prova a tavolino per tutti e dodici i mesi invece di
 * aspettare ottobre.
 *
 * Un intervallo che scavalca l'anno — ottobre-aprile — non e' un caso
 * particolare da trattare a parte: e' l'intervallo normale di un termosifone,
 * ed e' il primo che qualcuno scrivera'. I mesi si tengono come insieme, non
 * come «da / a», cosi' scavalcare l'anno non e' nemmeno una domanda.
 */

/* Tutto l'anno si scrive con l'elenco VUOTO, non con dodici mesi.
 *
 * Sono la stessa cosa da fuori, ma non da dentro: «non ho scelto» e «ho scelto
 * tutti e dodici» devono restare distinguibili, o riaprendo la scheda non si
 * saprebbe se le pastiglie accese le ha accese una persona. Vuoto vuol dire
 * «sempre», ed e' anche quello che c'era prima di questa funzione. */
export const SEMPRE = Object.freeze([]);

const NOMI = Object.freeze([
  ["gennaio", "January"],
  ["febbraio", "February"],
  ["marzo", "March"],
  ["aprile", "April"],
  ["maggio", "May"],
  ["giugno", "June"],
  ["luglio", "July"],
  ["agosto", "August"],
  ["settembre", "September"],
  ["ottobre", "October"],
  ["novembre", "November"],
  ["dicembre", "December"],
]);

const SIGLE = Object.freeze([
  ["gen", "Jan"],
  ["feb", "Feb"],
  ["mar", "Mar"],
  ["apr", "Apr"],
  ["mag", "May"],
  ["giu", "Jun"],
  ["lug", "Jul"],
  ["ago", "Aug"],
  ["set", "Sep"],
  ["ott", "Oct"],
  ["nov", "Nov"],
  ["dic", "Dec"],
]);

const inglese = (locale) =>
  !String(locale ?? "it")
    .toLowerCase()
    .startsWith("it");
const scegli = (it, en, locale) => (inglese(locale) ? en : it);

/** Il nome del mese, da 1 a 12. Fuori scala torna `""`. */
export function nomeDelMese(mese, locale = "it") {
  const voce = NOMI[Number(mese) - 1];
  return voce ? scegli(voce[0], voce[1], locale) : "";
}

/** La sigla di tre lettere, per le pastiglie della configurazione. */
export function siglaDelMese(mese, locale = "it") {
  const voce = SIGLE[Number(mese) - 1];
  return voce ? scegli(voce[0], voce[1], locale) : "";
}

/** L'elenco dei dodici mesi, gia' pronto da disegnare. */
export function iDodiciMesi(locale = "it") {
  return NOMI.map((_voce, indice) => ({
    mese: indice + 1,
    nome: nomeDelMese(indice + 1, locale),
    sigla: siglaDelMese(indice + 1, locale),
  }));
}

/**
 * I mesi scritti in configurazione, ripuliti da qualunque cosa ci sia.
 *
 * Torna sempre un elenco ordinato e senza doppioni. Dodici mesi su dodici
 * valgono «sempre», quindi tornano vuoti: e' la stessa cosa detta piu' corta,
 * e cosi' chi legge non deve chiederselo.
 */
export function normalizzaIMesi(stored) {
  if (!Array.isArray(stored)) return [];
  const dentro = new Set();
  for (const voce of stored) {
    const numero = Math.trunc(Number(voce));
    if (Number.isFinite(numero) && numero >= 1 && numero <= 12) dentro.add(numero);
  }
  if (dentro.size >= 12) return [];
  return [...dentro].sort((a, b) => a - b);
}

/**
 * Se questa unita' e' di stagione adesso.
 *
 * Senza mesi scritti e' sempre di stagione: chi non ha configurato niente vede
 * quello che ha sempre visto.
 */
export function eDiStagione(mesi, adesso = new Date()) {
  const scelti = normalizzaIMesi(mesi);
  if (!scelti.length) return true;
  const data = adesso instanceof Date ? adesso : new Date(adesso);
  const mese = data.getMonth() + 1;
  if (!Number.isFinite(mese)) return true;
  return scelti.includes(mese);
}

/* Un intervallo, se i mesi sono di fila sul quadrante dell'anno.
 *
 * Sul quadrante dicembre confina con gennaio, quindi ottobre-aprile e' di fila
 * quanto maggio-settembre: si guarda dove c'e' il buco. Un solo buco vuol dire
 * un solo intervallo, e allora si sa dire «da ottobre ad aprile» invece di
 * elencare sette sigle. */
function intervallo(scelti) {
  if (scelti.length < 2 || scelti.length >= 12) return null;
  const dentro = new Set(scelti);
  const inizi = scelti.filter((mese) => !dentro.has(mese === 1 ? 12 : mese - 1));
  if (inizi.length !== 1) return null;
  const primo = inizi[0];
  let ultimo = primo;
  for (let passo = 1; passo < scelti.length; passo += 1) {
    ultimo = ultimo === 12 ? 1 : ultimo + 1;
  }
  return [primo, ultimo];
}

/**
 * Come si legge il periodo scelto: «da maggio a settembre», «gen · mar · lug»,
 * o «tutto l'anno» quando non c'e' niente di scelto.
 */
export function comeSiLeggeIlPeriodo(mesi, locale = "it") {
  const scelti = normalizzaIMesi(mesi);
  if (!scelti.length) return scegli("Tutto l'anno", "All year", locale);
  if (scelti.length === 1) return nomeDelMese(scelti[0], locale);
  const arco = intervallo(scelti);
  if (arco) {
    const da = nomeDelMese(arco[0], locale).toLowerCase();
    const a = nomeDelMese(arco[1], locale).toLowerCase();
    // «a aprile» non si scrive: davanti a una vocale la a prende la d.
    const preposizione = /^[aeiou]/.test(a) ? "ad" : "a";
    return scegli(
      `Da ${da} ${preposizione} ${a}`,
      `${nomeDelMese(arco[0], locale)} to ${nomeDelMese(arco[1], locale)}`,
      locale,
    );
  }
  return scelti.map((mese) => siglaDelMese(mese, locale)).join(" · ");
}

/**
 * Chi si vede e chi no, dato l'elenco delle unita' e cosa stanno facendo.
 *
 * Un'unita' ACCESA non si nasconde mai, per quanto sia fuori stagione: e' la
 * differenza fra «non mi ingombra» e «non la posso piu' spegnere». Se il
 * condizionatore e' rimasto acceso il primo di ottobre, quello e' esattamente
 * il momento in cui serve vederlo — e la card lo dice, invece di sparire.
 *
 * `accesa` risponde per una unita': la porta chi chiama, perche' qui dentro
 * non si guardano gli stati.
 */
export function chiSiVede(unita = [], { adesso = new Date(), accesa = () => false } = {}) {
  const dentro = [];
  const fuori = [];
  for (const voce of Array.isArray(unita) ? unita : []) {
    if (eDiStagione(voce?.mesi, adesso) || accesa(voce)) dentro.push(voce);
    else fuori.push(voce);
  }
  return { dentro, fuori };
}
