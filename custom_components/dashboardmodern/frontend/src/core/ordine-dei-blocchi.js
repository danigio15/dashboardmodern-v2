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

/* I blocchi che la Home sa spostare, nell'ordine in cui sono sempre stati.
 *
 * Le pastiglie di stato — caldaia accesa, antifurto inserito — non sono un
 * blocco: compaiono da sole quando hanno qualcosa da dire e stanno in cima
 * perche' sono un avviso. Metterle in fila con gli altri vorrebbe dire poterle
 * mandare in fondo, cioe' non vederle. */
export const BLOCCHI_DELLA_HOME = Object.freeze([
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
  const [inTesta, inCoda] = [
    mancanti.filter((nome) => nome === BLOCCO_DEL_METEO),
    mancanti.filter((nome) => nome !== BLOCCO_DEL_METEO),
  ];
  return [...inTesta, ...fila, ...inCoda];
}

/**
 * Il riquadro col meteo e' rimasto nell'intestazione?
 *
 * Primo nella fila vuol dire «sopra tutto», e sopra tutto e' l'intestazione:
 * li' il riquadro resta figlio della testata e non tocca la pagina. Da
 * qualunque altro posto scende in pagina e si mette in fila con i blocchi.
 */
export function ilMeteoStaInTestata(salvato) {
  return ordineDeiBlocchi(salvato)[0] === BLOCCO_DEL_METEO;
}

/** Se questo ordine e' gia' quello di serie: allora non c'e' niente da salvare. */
export function eLOrdineDiSerie(ordine) {
  const fila = ordineDeiBlocchi(ordine);
  return fila.every((nome, indice) => nome === BLOCCHI_DELLA_HOME[indice]);
}
