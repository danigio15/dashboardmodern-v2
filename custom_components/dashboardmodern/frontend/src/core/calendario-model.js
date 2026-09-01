/* Gli appuntamenti che Home Assistant ha gia' (#259).
 *
 * «Possibilita' di visualizzare gli eventi del calendario che ho gia'
 * configurato in HA. Magari visualizzando gli ultimi 2 eventi su widget che
 * cliccandoci si apre una lista giorni/giorno e un elenco tipo come gia'
 * esistente "Da Fare".»
 *
 * Lo stato di un'entita' `calendar.*` non basta a fare quell'elenco: e'
 * `on`/`off` — c'e' un evento in corso oppure no — e negli attributi porta un
 * evento solo, quello adesso o il prossimo. Gli altri arrivano dal servizio
 * `calendar.get_events` con `return_response`, esattamente come le voci delle
 * liste ToDo arrivano da `todo.get_items`.
 *
 * Due cose vanno dette bene, o l'elenco mente:
 *
 *   - un evento che dura tutto il giorno Home Assistant lo scrive come DATA
 *     («2026-09-02»), gli altri come data e ora. Trattare la data secca come
 *     una mezzanotte locale e' l'unico modo perche' finisca nel giorno giusto:
 *     letta come istante UTC, a ovest di Greenwich scivola al giorno prima.
 *   - un evento IN CORSO non e' passato. Buttare via tutto quello che e'
 *     cominciato prima di adesso vorrebbe dire nascondere proprio la riunione
 *     dentro cui si sta guardando la plancia.
 *
 * Qui non c'e' DOM e non si chiama nessun servizio: solo la lettura, l'ordine
 * e il raggruppamento per giorno.
 */

/** La chiave in cui vivono i calendari scelti. */
export const CALENDARI_KEY = "cd_calendari";

/* Quanto avanti si guarda.
 *
 * Trenta giorni sono una richiesta sola per calendario e coprono il «cosa ho
 * questo mese» senza che nessuno debba scegliere una finestra. Piu' in la' non
 * serve: questa e' una plancia di casa, non un gestionale. */
export const GIORNI_AVANTI = 30;

const clean = (value) => String(value ?? "").trim();

export const CALENDAR_ENTITY_RE = /^calendar\.[a-z0-9_]+$/i;

export function isCalendarEntity(value) {
  return CALENDAR_ENTITY_RE.test(clean(value));
}

/** I calendari scelti, ripuliti. */
export function normalizzaCalendari(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((voce, indice) => ({
      id: clean(voce?.id) || `cal-${indice + 1}`,
      entity: clean(voce?.entity || voce?.entity_id),
      name: clean(voce?.name),
      /* Il colore serve a distinguerli quando ce n'e' piu' d'uno: «lavoro» e
       * «famiglia» nello stesso giorno, senza dover leggere il nome. */
      colore: clean(voce?.colore),
    }))
    .filter((voce) => isCalendarEntity(voce.entity));
}

/** I calendari che Home Assistant ha gia' e la configurazione ancora no. */
export function suggerisciCalendari(states = {}, esistenti = []) {
  const noti = new Set(normalizzaCalendari(esistenti).map((voce) => voce.entity.toLowerCase()));
  return Object.entries(states)
    .filter(([entity]) => isCalendarEntity(entity) && !noti.has(entity.toLowerCase()))
    .map(([entity, state]) => ({
      entity,
      name: clean(state?.attributes?.friendly_name) || entity.split(".")[1].replaceAll("_", " "),
    }));
}

/* ── il tempo, letto come lo intende chi guarda ───────────────────────── */

const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * L'istante di un capo dell'evento, e se quel capo e' una data secca.
 *
 * «2026-09-02» non e' mezzanotte UTC: e' l'inizio del 2 settembre di CHI
 * GUARDA. Costruirlo con `new Date("2026-09-02")` lo mette a mezzanotte di
 * Greenwich, e a Chicago quell'evento comparirebbe la sera del primo.
 */
export function istanteDi(valore) {
  const testo = clean(valore);
  if (!testo) return { istante: null, tuttoIlGiorno: false };
  if (SOLO_DATA.test(testo)) {
    const [anno, mese, giorno] = testo.split("-").map(Number);
    return { istante: new Date(anno, mese - 1, giorno).getTime(), tuttoIlGiorno: true };
  }
  const istante = Date.parse(testo);
  return { istante: Number.isFinite(istante) ? istante : null, tuttoIlGiorno: false };
}

/** Il giorno di un istante, come chiave: «2026-09-02» nel fuso di chi guarda. */
export function chiaveDelGiorno(istante) {
  const quando = new Date(istante);
  const mese = String(quando.getMonth() + 1).padStart(2, "0");
  const giorno = String(quando.getDate()).padStart(2, "0");
  return `${quando.getFullYear()}-${mese}-${giorno}`;
}

/* ── la risposta del servizio ─────────────────────────────────────────── */

/**
 * La risposta di `calendar.get_events`: `response[entity].events`, ogni voce
 * con `start`, `end`, `summary` e forse `description` e `location`.
 *
 * Una risposta storta — servizio mancante, entita' sbagliata — torna elenco
 * vuoto, mai un errore a meta' disegno.
 */
export function parseCalendarEventsResponse(result, entity) {
  const eventi = result?.response?.[clean(entity)]?.events;
  if (!Array.isArray(eventi)) return [];
  return eventi
    .map((evento) => {
      const inizio = istanteDi(evento?.start);
      const fine = istanteDi(evento?.end);
      if (inizio.istante === null) return null;
      return {
        entity: clean(entity),
        summary: clean(evento?.summary),
        description: clean(evento?.description),
        location: clean(evento?.location),
        inizio: inizio.istante,
        /* Senza una fine dichiarata l'evento dura quanto il suo inizio: meglio
         * un istante che una durata inventata. */
        fine: fine.istante === null ? inizio.istante : fine.istante,
        tuttoIlGiorno: inizio.tuttoIlGiorno,
      };
    })
    .filter(Boolean);
}

/**
 * La risposta di `/api/calendars/<entita>`: la stessa che legge il pannello
 * Calendario di Home Assistant.
 *
 * Si chiede questa e non solo il servizio perche' e' l'unica che porta l'`uid`
 * — e senza `uid` un evento si puo' guardare ma non toccare: non c'e' modo di
 * dire a Home Assistant QUALE modificare. Il servizio `calendar.get_events`
 * restituisce soltanto inizio, fine, titolo, descrizione e luogo.
 *
 * I capi arrivano avvolti: `{"dateTime": "..."}` per un'ora, `{"date": "..."}`
 * per un giorno intero — e la seconda forma e' proprio quella che dice «tutto
 * il giorno», senza doverla indovinare dalla durata.
 */
export function parseCalendarApiEvents(righe, entity) {
  if (!Array.isArray(righe)) return [];
  const capo = (valore) => {
    if (valore && typeof valore === "object")
      return istanteDi(valore.dateTime || valore.date || "");
    return istanteDi(valore);
  };
  return righe
    .map((evento) => {
      const inizio = capo(evento?.start);
      const fine = capo(evento?.end);
      if (inizio.istante === null) return null;
      return {
        entity: clean(entity),
        summary: clean(evento?.summary),
        description: clean(evento?.description),
        location: clean(evento?.location),
        inizio: inizio.istante,
        fine: fine.istante === null ? inizio.istante : fine.istante,
        tuttoIlGiorno: inizio.tuttoIlGiorno,
        /* Le chiavi con cui si torna a parlare di QUESTO evento. `recurrence_id`
         * distingue una ripetizione dalle sue sorelle: senza, modificare il
         * martedi' vorrebbe dire modificare tutti i martedi'. */
        uid: clean(evento?.uid),
        recurrenceId: clean(evento?.recurrence_id),
        rrule: clean(evento?.rrule),
      };
    })
    .filter(Boolean);
}

/* ── cosa si puo' fare, e cosa no ─────────────────────────────────────────
 *
 * Non tutti i calendari si lasciano scrivere: quello delle festivita' e' di
 * sola lettura, Google accetta eventi nuovi ma non li lascia cancellare da
 * qui, il calendario locale fa tutto. Home Assistant lo dichiara nei bit di
 * `supported_features`, e mostrare un tasto che poi risponde «non supportato»
 * e' peggio che non mostrarlo. */
export const CAPACITA = Object.freeze({ CREA: 1, CANCELLA: 2, MODIFICA: 4 });

export function capacitaDelCalendario(state) {
  const bit = Number(state?.attributes?.supported_features);
  const valore = Number.isFinite(bit) ? bit : 0;
  return Object.freeze({
    crea: (valore & CAPACITA.CREA) !== 0,
    cancella: (valore & CAPACITA.CANCELLA) !== 0,
    modifica: (valore & CAPACITA.MODIFICA) !== 0,
  });
}

/** Se questo evento, cosi' com'e', si puo' toccare. */
export function eventoModificabile(evento, capacita) {
  return Boolean(capacita?.modifica && clean(evento?.uid));
}

export function eventoCancellabile(evento, capacita) {
  return Boolean(capacita?.cancella && clean(evento?.uid));
}

/* ── il modulo: da evento a caselle, e ritorno ────────────────────────────
 *
 * Le caselle di un modulo sono stringhe — «2026-09-02» e «14:30» — perche'
 * quelle sono le forme che `<input type="date">` e `<input type="time">`
 * sanno leggere e scrivere. Il giro da e verso gli istanti sta qui, dove si
 * prova senza browser: e' il pezzo in cui un fuso sbagliato sposta un
 * appuntamento di un giorno senza che nessuno se ne accorga.
 */
const due = (numero) => String(numero).padStart(2, "0");

export function giornoDiCasella(istante) {
  const quando = new Date(istante);
  return `${quando.getFullYear()}-${due(quando.getMonth() + 1)}-${due(quando.getDate())}`;
}

export function oraDiCasella(istante) {
  const quando = new Date(istante);
  return `${due(quando.getHours())}:${due(quando.getMinutes())}`;
}

export function istanteDaCaselle(giorno, ora) {
  const [anno, mese, numero] = clean(giorno).split("-").map(Number);
  if (!Number.isFinite(anno) || !Number.isFinite(mese) || !Number.isFinite(numero)) return null;
  const [ore, minuti] = clean(ora).split(":").map(Number);
  return new Date(
    anno,
    mese - 1,
    numero,
    Number.isFinite(ore) ? ore : 0,
    Number.isFinite(minuti) ? minuti : 0,
    0,
    0,
  ).getTime();
}

/** Le caselle con cui si apre il modulo su un evento che esiste gia'. */
export function bozzaDaEvento(evento) {
  if (!evento) return null;
  const tutto = evento.tuttoIlGiorno === true;
  /* Per un evento di tutto il giorno la fine che arriva da Home Assistant e'
   * ESCLUSIVA — il giorno dopo l'ultimo — e mostrarla cosi' direbbe a chi
   * guarda che le ferie finiscono un giorno piu' tardi di quando finiscono. */
  const fineMostrata = tutto ? evento.fine - 86400000 : evento.fine;
  return {
    entity: clean(evento.entity),
    uid: clean(evento.uid),
    recurrenceId: clean(evento.recurrenceId),
    summary: clean(evento.summary),
    location: clean(evento.location),
    description: clean(evento.description),
    tuttoIlGiorno: tutto,
    giornoInizio: giornoDiCasella(evento.inizio),
    oraInizio: oraDiCasella(evento.inizio),
    giornoFine: giornoDiCasella(Math.max(evento.inizio, fineMostrata)),
    oraFine: oraDiCasella(evento.fine),
  };
}

/* La durata di serie di un impegno nuovo: un'ora, che e' quanto dura quasi
 * tutto quello che si segna al volo. */
export const DURATA_DI_SERIE = 3600000;

/** Le caselle con cui si apre il modulo su un impegno che ancora non c'e'. */
export function bozzaNuova(entity, quando = Date.now()) {
  /* Si parte dalla mezz'ora tonda successiva: nessuno segna una riunione alle
   * 14:37, e proporlo obbliga a correggere due caselle prima di scrivere. */
  const passo = 1800000;
  const inizio = Math.ceil(quando / passo) * passo;
  return {
    entity: clean(entity),
    uid: "",
    recurrenceId: "",
    summary: "",
    location: "",
    description: "",
    tuttoIlGiorno: false,
    giornoInizio: giornoDiCasella(inizio),
    oraInizio: oraDiCasella(inizio),
    giornoFine: giornoDiCasella(inizio + DURATA_DI_SERIE),
    oraFine: oraDiCasella(inizio + DURATA_DI_SERIE),
  };
}

/* Le parole con cui il modulo si lamenta. Stanno qui in italiano e chi
 * disegna passa le sue, per la stessa ragione delle altre: una `t()` scritta
 * dentro `src/core` non finirebbe nei cataloghi. */
export const LAMENTI_CALENDARIO = Object.freeze({
  titolo: "Serve un titolo.",
  quando: "La data non e' valida.",
  ordine: "L'impegno finisce prima di cominciare.",
  calendario: "Scegli un calendario.",
});

/**
 * Dalla bozza al messaggio per Home Assistant, o al motivo per cui non si puo'.
 *
 * `dtstart` e `dtend` devono essere della STESSA forma — o due giorni o due
 * istanti — e per un evento di tutto il giorno la fine e' il giorno DOPO
 * l'ultimo, perche' e' cosi' che la intende il calendario: un evento di un
 * giorno solo va da lunedi' a martedi'.
 */
export function messaggioDellEvento(bozza, lamenti = LAMENTI_CALENDARIO) {
  const dette = { ...LAMENTI_CALENDARIO, ...(lamenti || {}) };
  const titolo = clean(bozza?.summary);
  if (!clean(bozza?.entity)) return { errore: dette.calendario };
  if (!titolo) return { errore: dette.titolo };
  const tutto = bozza?.tuttoIlGiorno === true;
  const inizio = istanteDaCaselle(bozza?.giornoInizio, tutto ? "00:00" : bozza?.oraInizio);
  const fine = istanteDaCaselle(bozza?.giornoFine, tutto ? "00:00" : bozza?.oraFine);
  if (inizio === null || fine === null) return { errore: dette.quando };
  if (fine < inizio) return { errore: dette.ordine };
  const evento = { summary: titolo };
  if (clean(bozza?.location)) evento.location = clean(bozza.location);
  if (clean(bozza?.description)) evento.description = clean(bozza.description);
  if (tutto) {
    evento.dtstart = giornoDiCasella(inizio);
    /* La fine esclusiva: il giorno dopo l'ultimo. Mandare lo stesso giorno
     * darebbe un evento lungo zero, che Home Assistant rifiuta. */
    evento.dtend = giornoDiCasella(fine + 86400000);
  } else {
    if (fine === inizio) return { errore: dette.ordine };
    evento.dtstart = `${giornoDiCasella(inizio)}T${oraDiCasella(inizio)}:00`;
    evento.dtend = `${giornoDiCasella(fine)}T${oraDiCasella(fine)}:00`;
  }
  return { evento };
}

/* ── l'ordine e la scelta ─────────────────────────────────────────────── */

/** Gli eventi in fila, dal primo che comincia. */
export function ordinaEventi(eventi) {
  return (Array.isArray(eventi) ? eventi.filter(Boolean) : [])
    .slice()
    .sort((uno, altro) => uno.inizio - altro.inizio || uno.fine - altro.fine);
}

/** Se un evento sta succedendo adesso. */
export function inCorso(evento, adesso = Date.now()) {
  return Boolean(evento) && evento.inizio <= adesso && evento.fine > adesso;
}

/**
 * Gli eventi che restano: quelli non ancora finiti.
 *
 * Un evento cominciato ma non finito e' il piu' importante di tutti — e'
 * quello dentro cui si sta adesso — e buttarlo via perche' «e' passato»
 * vorrebbe dire nascondere la riunione in corso.
 */
export function eventiDaQui(eventi, adesso = Date.now()) {
  return ordinaEventi(eventi).filter((evento) => evento.fine > adesso);
}

/** I primi `quanti`: sulla tessera ce ne stanno due, e sono i due che contano. */
export function prossimiEventi(eventi, adesso = Date.now(), quanti = 2) {
  return eventiDaQui(eventi, adesso).slice(0, Math.max(0, quanti));
}

/**
 * Gli eventi raccolti per giorno, come l'elenco delle cose da fare.
 *
 * Un evento di piu' giorni compare nel giorno in cui comincia, non in tutti
 * quelli che attraversa: ripeterlo cinque volte farebbe cinque righe uguali
 * per una vacanza sola. Un evento in corso cominciato ieri fa eccezione, e
 * viene messo oggi: e' li' che lo si cerca.
 */
export function perGiorno(eventi, adesso = Date.now()) {
  const giorni = new Map();
  for (const evento of eventiDaQui(eventi, adesso)) {
    const dove = evento.inizio < adesso ? chiaveDelGiorno(adesso) : chiaveDelGiorno(evento.inizio);
    if (!giorni.has(dove)) giorni.set(dove, []);
    giorni.get(dove).push(evento);
  }
  return [...giorni.entries()]
    .sort(([uno], [altro]) => (uno < altro ? -1 : uno > altro ? 1 : 0))
    .map(([giorno, elenco]) => ({ giorno, eventi: ordinaEventi(elenco) }));
}

/* ── le scadenze delle cose da fare ───────────────────────────────────────
 *
 * «Scadenze nell'agenda»: una cosa da fare con una data E' un impegno di quel
 * giorno, e tenerla in un elenco a parte in fondo alla pagina vuol dire
 * guardare l'agenda di giovedi' senza vedere che giovedi' scade la revisione
 * dell'auto.
 *
 * Percio' entra nell'agenda, nel suo giorno, accanto agli appuntamenti — ma
 * NON diventa un appuntamento: resta una cosa da spuntare, tiene la sua
 * casella, e al posto dell'ora dice «da fare». Un appuntamento si sposta, una
 * scadenza si fa.
 *
 * E chi ha una data la mostra qui e non due volte: la lista li' sotto tiene le
 * cose senza data, quelle che un giorno loro non ce l'hanno. Due righe uguali
 * in due posti della stessa pagina sono una riga di troppo.
 */
export function scadenzaDaVoce(voce, lista) {
  const capo = istanteDi(voce?.due);
  if (capo.istante === null) return null;
  return {
    /* Si riconosce da qui: chi disegna deve poterla trattare come quello che
     * e' — una cosa da spuntare — invece che come un evento senza ora. */
    tipo: "scadenza",
    uid: clean(voce?.uid),
    summary: clean(voce?.summary),
    listaId: clean(lista?.id),
    lista: clean(lista?.name) || clean(lista?.entity),
    entity: clean(lista?.entity),
    inizio: capo.istante,
    fine: capo.istante,
    tuttoIlGiorno: capo.tuttoIlGiorno,
  };
}

/** Le scadenze aperte di tutte le liste. Quelle spuntate non scadono piu'. */
export function scadenzeDelleListe(blocchi) {
  const fuori = [];
  for (const blocco of Array.isArray(blocchi) ? blocchi : []) {
    for (const voce of Array.isArray(blocco?.items) ? blocco.items : []) {
      if (clean(voce?.status).toLowerCase() === "completed") continue;
      const scadenza = scadenzaDaVoce(voce, blocco?.list);
      if (scadenza) fuori.push(scadenza);
    }
  }
  return ordinaEventi(fuori);
}

/** Se questa voce ha una data, e quindi vive nell'agenda invece che in fondo. */
export function voceConScadenza(voce) {
  return istanteDi(voce?.due).istante !== null;
}

/**
 * L'agenda intera: appuntamenti e scadenze, giorno per giorno.
 *
 * Quello che e' scaduto esce dai giorni e va in un gruppo suo, in cima: una
 * cosa da fare di martedi' scorso non appartiene a martedi' scorso — nessuno
 * scorre indietro per trovarla — appartiene ad adesso, ed e' proprio la riga
 * per cui si apre l'agenda.
 */
export function agendaPerGiorno(eventi, scadenze, adesso = Date.now()) {
  const oggi = chiaveDelGiorno(adesso);
  const giorni = new Map();
  const metti = (giorno, riga) => {
    if (!giorni.has(giorno)) giorni.set(giorno, []);
    giorni.get(giorno).push(riga);
  };

  for (const evento of eventiDaQui(eventi, adesso))
    metti(evento.inizio < adesso ? oggi : chiaveDelGiorno(evento.inizio), evento);

  const ritardo = [];
  for (const scadenza of Array.isArray(scadenze) ? scadenze : []) {
    const giorno = chiaveDelGiorno(scadenza.inizio);
    /* Il confronto e' fra GIORNI e non fra istanti: una cosa da fare per oggi
     * e' segnata a mezzanotte, e col confronto sugli istanti risulterebbe in
     * ritardo dalle 00:01 in poi. */
    if (giorno < oggi) ritardo.push(scadenza);
    else metti(giorno, scadenza);
  }

  return {
    ritardo: ordinaEventi(ritardo),
    giorni: [...giorni.entries()]
      .sort(([uno], [altro]) => (uno < altro ? -1 : uno > altro ? 1 : 0))
      .map(([giorno, elenco]) => ({ giorno, eventi: ordinaEventi(elenco) })),
  };
}

/* ── la bozza di una cosa da fare ─────────────────────────────────────────
 *
 * Una cosa da fare si scrive al volo — titolo e via — ma la sua DATA e' quella
 * che decide dove finisce nell'agenda, e senza un posto in cui metterla
 * l'agenda mostra soltanto quelle che qualcun altro ha datato altrove. Percio'
 * le cose da fare hanno il loro modulo, con la stessa forma di quello degli
 * impegni: cosa, quando, note.
 *
 * La differenza sta nel «quando»: un impegno DEVE avere un inizio e una fine,
 * una cosa da fare puo' non avere niente — e la casella vuota vuol dire
 * proprio quello, «senza scadenza», non «data mancante».
 */
export function bozzaDaVoce(voce, lista) {
  if (!voce) return null;
  const capo = istanteDi(voce.due);
  return {
    tipo: "cosa",
    entity: clean(lista?.entity),
    listaId: clean(lista?.id),
    /* La chiave con cui Home Assistant ritrova la voce: l'`uid` se ce l'ha,
     * altrimenti il titolo — che e' quello che accetta `todo.update_item`. */
    uid: clean(voce.uid) || clean(voce.summary),
    summary: clean(voce.summary),
    description: clean(voce.description),
    giornoScadenza: capo.istante === null ? "" : giornoDiCasella(capo.istante),
    /* L'ora solo se ce l'ha davvero: una scadenza «entro giovedi'» non e' una
     * scadenza «giovedi' alle 00:00», e proporre mezzanotte la farebbe
     * diventare tale al primo salvataggio. */
    oraScadenza: capo.istante === null || capo.tuttoIlGiorno ? "" : oraDiCasella(capo.istante),
  };
}

/** Le caselle con cui si apre il modulo su una cosa da fare che ancora non c'e'. */
export function bozzaCosaNuova(lista, giorno = "") {
  return {
    tipo: "cosa",
    entity: clean(lista?.entity),
    listaId: clean(lista?.id),
    uid: "",
    summary: "",
    description: "",
    giornoScadenza: clean(giorno),
    oraScadenza: "",
  };
}

/**
 * Dalla bozza di una cosa da fare ai campi del servizio, o al motivo per cui
 * non si puo'.
 *
 * `due_date` e `due_datetime` sono alternativi e Home Assistant ne accetta uno
 * solo; `null` non e' «non toccare», e' «togli la scadenza» — e la differenza
 * conta, perche' e' l'unico modo di cancellarne una senza rifare la voce.
 */
export function campiDellaCosa(bozza, lamenti = LAMENTI_CALENDARIO) {
  const dette = { ...LAMENTI_CALENDARIO, ...(lamenti || {}) };
  const titolo = clean(bozza?.summary);
  if (!clean(bozza?.entity)) return { errore: dette.calendario };
  if (!titolo) return { errore: dette.titolo };
  const giorno = clean(bozza?.giornoScadenza);
  const ora = clean(bozza?.oraScadenza);
  const campi = { item: titolo, description: clean(bozza?.description) || null };
  if (!giorno) {
    /* Senza giorno la scadenza si toglie: `null` e non «campo assente», o una
     * voce che ce l'aveva se la terrebbe. */
    campi.due_date = null;
  } else if (ora) {
    const istante = istanteDaCaselle(giorno, ora);
    if (istante === null) return { errore: dette.quando };
    campi.due_datetime = `${giorno}T${ora}:00`;
  } else {
    if (istanteDaCaselle(giorno, "00:00") === null) return { errore: dette.quando };
    campi.due_date = giorno;
  }
  return { campi };
}

/* ── come si dice ─────────────────────────────────────────────────────── */

/* Le parole che questo modulo mette in mezzo ai numeri.
 *
 * Stanno qui in italiano, e chi disegna passa le sue: il raccoglitore delle
 * traduzioni guarda le SEZIONI, e una `t("Oggi", "Today")` scritta dentro
 * `src/core` non finirebbe nei cataloghi — resterebbe italiana per tutti.
 * Passandole da fuori restano estraibili, e questo modulo resta puro. */
export const PAROLE_CALENDARIO = Object.freeze({
  oggi: "Oggi",
  domani: "Domani",
  tuttoIlGiorno: "Tutto il giorno",
  /* Una scadenza non ha un'ora: al posto suo, nella colonna delle ore, dice
   * cos'e'. «00:00» direbbe mezzanotte, che non e' quando va fatta. */
  daFare: "Da fare",
  inRitardo: "In ritardo",
});

/**
 * Il nome di un giorno: «Oggi», «Domani», e poi la data.
 *
 * Oggi e domani si dicono con la parola perche' e' quella che si usa
 * parlando; dal terzo giorno in poi la parola non c'e' piu' — «dopodomani» in
 * un elenco lungo confonde — e si scrive la data, che e' quello che si
 * cercherebbe su un'agenda.
 */
export function etichettaDelGiorno(
  giorno,
  adesso = Date.now(),
  parole = PAROLE_CALENDARIO,
  lingua,
) {
  const dette = { ...PAROLE_CALENDARIO, ...(parole || {}) };
  const oggi = chiaveDelGiorno(adesso);
  if (giorno === oggi) return dette.oggi;
  const domani = chiaveDelGiorno(adesso + 86400000);
  if (giorno === domani) return dette.domani;
  const [anno, mese, numero] = clean(giorno).split("-").map(Number);
  if (!Number.isFinite(anno)) return clean(giorno);
  const data = new Date(anno, mese - 1, numero);
  try {
    return data.toLocaleDateString(lingua || undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch (_error) {
    return clean(giorno);
  }
}

function orarioDi(istante, lingua) {
  try {
    return new Date(istante).toLocaleTimeString(lingua || undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_error) {
    return "";
  }
}

/** L'ora di un evento, o la parola che dice che l'ora non ce l'ha. */
export function oraDellEvento(evento, parole = PAROLE_CALENDARIO, lingua) {
  if (!evento) return "";
  const dette = { ...PAROLE_CALENDARIO, ...(parole || {}) };
  /* Una scadenza senza ora dice cos'e', non «tutto il giorno»: quella e' la
   * parola delle ferie, e una cosa da fare non dura un giorno — si fa. */
  if (evento.tipo === "scadenza")
    return evento.tuttoIlGiorno ? dette.daFare : orarioDi(evento.inizio, lingua);
  if (evento.tuttoIlGiorno) return dette.tuttoIlGiorno;
  const dalle = orarioDi(evento.inizio, lingua);
  /* Un evento che finisce quando comincia non ha una durata da mostrare: e'
   * un promemoria, e «14:30 – 14:30» sarebbe una riga che si prende in giro. */
  if (evento.fine <= evento.inizio) return dalle;
  return `${dalle} – ${orarioDi(evento.fine, lingua)}`;
}

/**
 * Quanto manca, in minuti: negativo se e' gia' cominciato.
 *
 * Serve a decidere il tono, non a scriverlo: la frase la costruisce chi
 * disegna, con le parole della plancia.
 */
export function minutiAllEvento(evento, adesso = Date.now()) {
  if (!evento) return null;
  return Math.round((evento.inizio - adesso) / 60000);
}
