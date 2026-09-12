/* Le voci della tendina del limite di carica: quelle dell'entita', non le nostre.
 *
 * «Menu di scelta percentuale non è quello dell'entità, per questo va in errore
 * e non mi cambia la percentuale.»
 *
 * La tendina mandava a Home Assistant un valore che l'entita' non conosce —
 * cinquanta, sessanta, settanta, le sei di serie che la plancia si portava
 * dietro — mentre il limite vero saliva di cinque in cinque da
 * cinquantacinque. Un `select_option` con un'opzione che non esiste viene
 * rifiutato, e da fuori si vede solo la tendina che torna indietro da sola.
 *
 * Chi sa quali valori esistono e' l'entita', e lo dice in due modi: una
 * tendina (`select`, `input_select`) pubblica le sue `options`, un numero
 * (`number`, `input_number`) pubblica minimo, massimo e passo. Qui si legge
 * quello che dice lei e si costruisce l'elenco; quando non dice niente non si
 * inventa un elenco, si lascia stare quello che c'e'.
 *
 * Il modulo e' puro: entra lo stato dell'entita', escono le voci.
 */

const clean = (value) => String(value ?? "").trim();

/* Quante voci ci stanno in una tendina prima che diventi un rotolo. Un limite
 * che va da 0 a 100 col passo di 1 sono centouno voci: si dirada — di cinque
 * in cinque, che e' un multiplo del suo passo, quindi ogni valore proposto
 * resta un valore che l'entita' accetta. */
const QUANTE_AL_MASSIMO = 25;

const numero = (valore) => {
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : null;
};

/* Un'opzione com'e' scritta dall'entita', e come si legge.
 *
 * Il valore si manda a Home Assistant TALE E QUALE: un'opzione «90 %» si
 * rimanda «90 %», non «90». La scritta invece la si abbellisce solo quando
 * l'opzione e' un numero nudo, perche' «90» sotto la voce «limite di carica»
 * e' un novanta per cento e scriverlo aiuta. */
function vocePerOpzione(opzione) {
  const valore = clean(opzione);
  if (!valore) return null;
  return { valore, testo: /^\d+(?:[.,]\d+)?$/.test(valore) ? `${valore}%` : valore };
}

/* Da dove parte la scala diradata: dal primo valore tondo, non dal minimo.
 *
 * «Non esiste 91% e 96%, da dove li stai pescando.» Da qui: un limite che va
 * da 1 a 100 col passo di 1 si dirada di cinque in cinque, e partendo dal
 * minimo la scala diventava 1, 6, 11... 91, 96. Sono tutti valori che
 * l'entita' accetta — il passo e' uno — ma nessuno li ha mai visti scritti su
 * un limite di carica, e uno che apre la tendina non riconosce piu' la sua
 * entita'.
 *
 * Il primo scalino si cerca fra i valori dell'entita' (minimo piu' un numero
 * intero di passi SUOI) e si prende il primo che sia anche un multiplo del
 * passo diradato: con minimo 1 e passo 1 e' il cinque, e la scala diventa
 * 1, 5, 10... 100. Se un valore tondo non esiste — minimo 7 col passo 3, dove
 * i multipli di sei non cadono mai sui valori buoni — si riparte dal minimo,
 * com'era: meglio una scala storta che uno scalino che l'entita' rifiuta. */
function primoScalino(min, suo, max, mio) {
  const quanti = Math.round(mio / suo);
  for (let passi = 0; passi < quanti; passi += 1) {
    const valore = min + passi * suo;
    if (valore > max + 1e-9) break;
    if (Math.abs(valore / mio - Math.round(valore / mio)) < 1e-9) return valore;
  }
  return min;
}

function vociDaiNumeri(attributi) {
  const min = numero(attributi?.min);
  const max = numero(attributi?.max);
  const passo = numero(attributi?.step);
  if (min === null || max === null || max <= min) return [];
  const suo = passo && passo > 0 ? passo : 1;
  /* Il passo si allarga a multipli del suo, mai a qualcosa che lui non
   * accetta: uno, due, cinque, dieci volte — fino a che le voci ci stanno. */
  let mio = suo;
  for (const quante of [1, 2, 5, 10, 20, 50]) {
    mio = suo * quante;
    if ((max - min) / mio <= QUANTE_AL_MASSIMO) break;
  }
  /* I decimali del passo dicono con quante cifre si scrive: un passo di 0,5
   * scrive «57,5», un passo intero scrive «60». */
  const cifre = String(mio).includes(".") ? String(mio).split(".")[1].length : 0;
  const voci = [];
  const aggiungi = (valore) => {
    const scritto = valore.toFixed(cifre);
    if (voci.some((voce) => voce.valore === scritto)) return;
    voci.push({ valore: scritto, testo: `${scritto}%` });
  };
  /* Il minimo e il massimo ci sono sempre: sono gli estremi che l'entita'
   * accetta, e una scala tonda che non ci arriva in pieno li lascerebbe fuori
   * — cioe' toglierebbe proprio il «tutto» e il «niente». */
  aggiungi(min);
  for (let valore = primoScalino(min, suo, max, mio); valore <= max + 1e-9; valore += mio)
    aggiungi(valore);
  aggiungi(max);
  return voci.sort((uno, due) => Number.parseFloat(uno.valore) - Number.parseFloat(due.valore));
}

/**
 * Le voci che questa entita' accetta.
 *
 * Torna `{ voci, padrone }`. `padrone` vero vuol dire «queste voci vengono
 * dall'entita', scrivile»; falso vuol dire «l'entita' non ha detto niente,
 * lascia stare quello che c'e'» — che non e' lo stesso di un elenco vuoto
 * inventato da noi.
 */
export function vociDelTarget(stato) {
  const opzioni = stato?.attributes?.options;
  if (Array.isArray(opzioni) && opzioni.length) {
    const voci = opzioni.map(vocePerOpzione).filter(Boolean);
    if (voci.length) return { voci, padrone: true };
  }
  const voci = conQuellaDiAdesso(vociDaiNumeri(stato?.attributes), stato);
  if (voci.length) return { voci, padrone: true };
  return { voci: [], padrone: false };
}

/* Il valore di adesso c'e' sempre, anche se il passo diradato lo salta.
 *
 * Un limite da 0 a 100 col passo di 1 non ci sta in venticinque voci, e il
 * passo si allarga a cinque: le voci diventano 0, 5, 10... Un target messo a
 * 83 da un'automazione o dall'app della colonnina in quell'elenco non c'e', la
 * tendina non trova la sua voce e mostra la prima — cioe' la plancia scrive
 * «0%» dove Home Assistant dice 83. Il numero che c'e' davvero entra
 * nell'elenco al suo posto, e resta scelto. */
function conQuellaDiAdesso(voci, stato) {
  if (!voci.length || voceDiAdesso(voci, stato?.state)) return voci;
  const scritto = clean(stato?.state).replace(",", ".");
  const adesso = Number.parseFloat(scritto);
  if (!Number.isFinite(adesso)) return voci;
  const min = numero(stato?.attributes?.min);
  const max = numero(stato?.attributes?.max);
  if ((min !== null && adesso < min) || (max !== null && adesso > max)) return voci;
  const suo = { valore: scritto, testo: `${scritto}%` };
  return [...voci, suo].sort(
    (uno, due) => Number.parseFloat(uno.valore) - Number.parseFloat(due.valore),
  );
}

/**
 * Quale voce e' quella di adesso.
 *
 * Lo stato e la voce possono scriversi in modi diversi e valere lo stesso —
 * «95.0» e «95», «90 %» e «90» — e sceglierla per uguaglianza di stringa
 * lasciava la tendina sulla prima voce, cioe' su un valore che nessuno ha
 * scelto. Prima si prova la parola esatta, poi il numero.
 */
export function voceDiAdesso(voci, stato) {
  const elenco = Array.isArray(voci) ? voci : [];
  const grezzo = clean(stato);
  if (!grezzo) return "";
  const esatta = elenco.find((voce) => voce.valore === grezzo);
  if (esatta) return esatta.valore;
  const cercato = Number.parseFloat(grezzo.replace(",", "."));
  if (!Number.isFinite(cercato)) return "";
  const pari = elenco.find(
    (voce) => Math.abs(Number.parseFloat(String(voce.valore).replace(",", ".")) - cercato) < 1e-9,
  );
  return pari ? pari.valore : "";
}
