/* L'ordine dei blocchi della Home.
 *
 * «Riordinare a piacere la Home» voleva dire tre cose, e finora ne erano state
 * fatte due e mezzo: le tessere si riordinano, le persone si riordinano, le
 * azioni rapide si riordinano — ma sempre DENTRO il loro blocco. L'ordine dei
 * blocchi fra loro era scritto nel codice: prima le persone, poi i widget, poi
 * le azioni rapide, poi i dispositivi. Chi entra in casa e vuole i tasti per
 * primi non poteva averli.
 *
 * Qui c'e' solo la lista e come si mette in fila. Chi sposta i nodi nella
 * pagina sta altrove; questo si prova senza un documento.
 */

/* Dove si scrive l'ordine scelto. Sta qui e non nella sezione che disegna le
 * frecce: da qui lo legge anche chi deve sapere se l'intestazione col meteo e'
 * rimasta al suo posto, e quella e' un'altra sezione ancora. */
export const CHIAVE_ORDINE_BLOCCHI = "cd_home_blocchi";

/* Il riquadro col meteo e l'ora, che di serie sta nell'intestazione. */
export const BLOCCO_DEL_METEO = "meteo";

/* L'intestazione intera: l'hamburger, il nome della casa, la pastiglia della
 * connessione. «Prevedi di spostare anche intestazione della home, quindi la
 * prima sezione compresa di hamburger.»
 *
 * E' la striscia che sta SOPRA la pagina, e non e' solo della Home: le altre
 * pagine la usano per lo stesso menu. Per questo il posto di serie e' il primo,
 * e per questo chi la sposta la sposta soltanto dentro la Home — fuori di li'
 * torna dov'e' sempre stata, o le altre pagine si troverebbero senza menu. */
export const BLOCCO_INTESTAZIONE = "intestazione";

/* I blocchi che la Home sa spostare, nell'ordine in cui sono sempre stati.
 *
 * Le pastiglie di stato — caldaia accesa, antifurto inserito — non sono un
 * blocco: compaiono da sole quando hanno qualcosa da dire e stanno in cima
 * perche' sono un avviso. Metterle in fila con gli altri vorrebbe dire poterle
 * mandare in fondo, cioe' non vederle. */
export const BLOCCHI_DELLA_HOME = Object.freeze([
  /* L'intestazione, hamburger compreso. E' la prima cosa che si vede, quindi
   * nella lista sta per prima: finche' e' li' non si muove niente e la
   * striscia resta sopra la pagina, com'e' sempre stata. */
  BLOCCO_INTESTAZIONE,
  /* L'intestazione col meteo (#492): «in configurazione home e' possibile
   * cambiare la posizione dei blocchi, sarebbe bello poter cambiare anche la
   * posizione dell'header contenente il meteo». Il riquadro col meteo e l'ora
   * nasce nell'intestazione, che sta SOPRA la pagina: in una lista, «sopra
   * tutto» si scrive mettendolo per primo. Finche' e' primo resta dov'e'
   * sempre stato; appena qualcuno lo scavalca, il riquadro scende in pagina e
   * si mette in fila con gli altri. */
  BLOCCO_DEL_METEO,
  "persone",
  /* Il flusso dell'energia (#415) qui c'e' stato, e non c'e' piu'. La
   * segnalazione lo voleva «accanto alle card delle persone», e adesso lo e'
   * davvero: e' una card DENTRO la griglia delle persone, non un blocco suo.
   * Spostarlo per conto proprio quindi non vuol dire piu' niente — si muove
   * con le persone, che e' la cosa a cui e' accanto. Chi l'aveva messo in fila
   * non perde nulla: `ordineDeiBlocchi` butta via i nomi che non esistono
   * piu', ed e' proprio per questo che sa farlo. */
  "widget",
  "azioni",
  /* Le stanze (#493): «una fila di stanze in plancia, e poter scegliere quali».
   * Nasce in coda perche' arriva dopo, e chi aveva gia' un ordine salvato non
   * se lo vede scombinare: `ordineDeiBlocchi` mette i nomi nuovi al loro posto
   * di serie, non per primi. Il blocco compare solo quando una stanza e' stata
   * scelta — senza, di ordine non c'e' niente da mettere. */
  "stanze",
  "dispositivi",
]);

const NOTI = new Set(BLOCCHI_DELLA_HOME);

/**
 * L'ordine da usare, ripulito da quello salvato.
 *
 * Regge tre cose che capitano davvero: un blocco scritto due volte, un nome
 * che non esiste piu' (una versione che toglie un blocco), e un blocco NUOVO
 * che nella configurazione salvata non c'e' ancora — quello va in coda, non
 * perso e non messo per primo. L'unico che va davanti e' il meteo, e il
 * perche' sta scritto dov'e' scritta la regola.
 */
export function ordineDeiBlocchi(salvato) {
  const scritto = Array.isArray(salvato) ? salvato : [];
  const fila = [];
  for (const voce of scritto) {
    const nome = String(voce ?? "").trim();
    if (NOTI.has(nome) && !fila.includes(nome)) fila.push(nome);
  }
  const mancanti = BLOCCHI_DELLA_HOME.filter((nome) => !fila.includes(nome));
  /* I mancanti vanno in coda, tranne il meteo, che va davanti.
   *
   * Non e' un'eccezione di comodo. Il posto di serie del meteo e'
   * l'intestazione, cioe' SOPRA la pagina, e in una lista quel posto si scrive
   * «per primo»: mandarlo in coda vorrebbe dire che chi si era gia' riordinato
   * la Home, aggiornando, si ritrova il riquadro staccato dall'intestazione e
   * buttato in fondo alla pagina — un cambiamento che non ha chiesto a
   * nessuno. Gli altri in coda ci stanno bene: un blocco nuovo che nasce in
   * mezzo alla pagina, comparendo in fondo, non sposta niente di quello che
   * c'era. */
  /* Davanti ci vanno il meteo e l'intestazione, nell'ordine in cui stanno
   * sopra la pagina: prima la striscia col menu, poi il riquadro del tempo.
   * Mandarle in coda vorrebbe dire che chi si era gia' riordinato la Home,
   * aggiornando, si ritrova l'hamburger in fondo alla pagina — un cambiamento
   * che non ha chiesto a nessuno, e per il menu sarebbe anche peggio che per
   * il meteo. */
  const DAVANTI = [BLOCCO_INTESTAZIONE, BLOCCO_DEL_METEO];
  const [inTesta, inCoda] = [
    DAVANTI.filter((nome) => mancanti.includes(nome)),
    mancanti.filter((nome) => !DAVANTI.includes(nome)),
  ];
  return [...inTesta, ...fila, ...inCoda];
}

/* I due blocchi che nascono SOPRA la pagina: la striscia col menu e il riquadro
 * del tempo. Gli altri nascono dentro la Home. */
const SOPRA_LA_PAGINA = [BLOCCO_INTESTAZIONE, BLOCCO_DEL_METEO];

/**
 * Questo blocco e' rimasto sopra la pagina?
 *
 * Non basta chiedere «e' il primo»: sopra la pagina ce ne stanno due, e il
 * meteo resta in testata anche con la striscia del menu davanti — sono
 * entrambe fuori dalla Home, e l'ordine fra loro dice solo quale si vede
 * prima. Quello che lo fa scendere e' un blocco della PAGINA che lo scavalca.
 *
 * Chiederlo male non e' un dettaglio: con «e' il primo», il giorno in cui la
 * striscia e' diventata spostabile il riquadro del meteo sarebbe sceso in
 * pagina a tutti quelli che non avevano mai toccato niente.
 */
function staSopraLaPagina(nome, salvato) {
  const fila = ordineDeiBlocchi(salvato);
  const posto = fila.indexOf(nome);
  if (posto < 0) return false;
  return fila.slice(0, posto).every((prima) => SOPRA_LA_PAGINA.includes(prima));
}

/**
 * Il riquadro col meteo e' rimasto nell'intestazione?
 *
 * Li' resta figlio della testata e non tocca la pagina. Appena un blocco della
 * pagina lo scavalca, scende e si mette in fila con gli altri.
 *
 * E non basta che sia sopra la pagina LUI: deve esserci anche la TESTATA che
 * lo contiene. Con una fila come «meteo, persone, intestazione» il meteo
 * restava figlio della testata mentre la testata scendeva dentro la Home sotto
 * le persone — e il riquadro ci scendeva insieme, portato a rimorchio in un
 * posto che l'ordine non aveva chiesto per lui. Quando la testata scende, il
 * meteo diventa un blocco della pagina e va dove dice la fila.
 */
export function ilMeteoStaInTestata(salvato) {
  return staSopraLaPagina(BLOCCO_DEL_METEO, salvato) && lIntestazioneStaInCima(salvato);
}

/**
 * L'intestazione e' rimasta sopra la pagina?
 *
 * Prima nella fila vuol dire «sopra tutto», ed e' il posto in cui la striscia
 * nasce: li' resta fuori dalla Home e le altre pagine se la trovano com'e'
 * sempre stata. Da qualunque altro posto scende dentro la Home e si mette in
 * fila con i blocchi — ma solo finche' la Home e' quella aperta.
 */
export function lIntestazioneStaInCima(salvato) {
  return staSopraLaPagina(BLOCCO_INTESTAZIONE, salvato);
}

/** Se questo ordine e' gia' quello di serie: allora non c'e' niente da salvare. */
export function eLOrdineDiSerie(ordine) {
  const fila = ordineDeiBlocchi(ordine);
  return fila.every((nome, indice) => nome === BLOCCHI_DELLA_HOME[indice]);
}
