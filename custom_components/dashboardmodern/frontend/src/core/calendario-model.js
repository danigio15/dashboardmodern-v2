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

/** L'ora di un evento, o la parola che dice che l'ora non ce l'ha. */
export function oraDellEvento(evento, parole = PAROLE_CALENDARIO, lingua) {
  if (!evento) return "";
  const dette = { ...PAROLE_CALENDARIO, ...(parole || {}) };
  if (evento.tuttoIlGiorno) return dette.tuttoIlGiorno;
  const orario = (istante) => {
    try {
      return new Date(istante).toLocaleTimeString(lingua || undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_error) {
      return "";
    }
  };
  const dalle = orario(evento.inizio);
  /* Un evento che finisce quando comincia non ha una durata da mostrare: e'
   * un promemoria, e «14:30 – 14:30» sarebbe una riga che si prende in giro. */
  if (evento.fine <= evento.inizio) return dalle;
  return `${dalle} – ${orario(evento.fine)}`;
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
