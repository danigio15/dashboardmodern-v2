/* L'avviso della chat di assistenza, per la Home.
 *
 * «Gestisci una sorta di widget avviso che, se si ricevono messaggi nella
 *  chat assistenza, compare nella home.»
 *
 * La chat sta dietro una card della Configurazione, e una risposta arrivata
 * mentre nessuno guardava li' restava un pallino su una pagina che non si
 * apre tutti i giorni. Qui c'e' quello che serve a una tessera della Home per
 * comparire quando c'e' qualcosa da leggere e sparire appena e' letto: la
 * lettura dello stato che il backend da' con `chat/state`, e il modello della
 * tessera. Niente DOM: si legge e si decide.
 */
import { pick } from "./i18n.js";

/** L'evento che il backend spara sul bus di casa quando arriva una risposta
 * (`EVENT_CHAT_MESSAGE` in `const.py`): la pagina ci si mette in ascolto. */
export const EVENTO_DI_CASA = "dashboardmodern_chat";

/** L'evento che la sezione della chat spara nella pagina quando il suo stato
 * cambia: la Home lo ascolta per ridisegnare le tessere. */
export const EVENTO_STATO = "dashboardmodern:chat-stato";

/** La chiave della tessera in Home, che e' anche il nome con cui si ordina e
 * si nasconde dalla scheda Widget. */
export const CHIAVE_TESSERA = "assistenza";

/** Quanto dell'ultima risposta sta sulla tessera. */
export const ANTEPRIMA_MAX = 120;

const pulito = (valore) => String(valore ?? "").trim();

/* Una frase lunga su una riga: gli a capo diventano spazi, e oltre il tetto si
 * chiude coi puntini. */
export function anteprima(testo, massimo = ANTEPRIMA_MAX) {
  const piatto = pulito(testo).replace(/\s+/g, " ");
  const tetto = Math.max(1, Math.floor(Number(massimo) || ANTEPRIMA_MAX));
  if (piatto.length <= tetto) return piatto;
  return `${piatto.slice(0, Math.max(1, tetto - 1)).trimEnd()}…`;
}

/* Lo stato come lo da' il backend, ripulito. Senza risposte da leggere non c'e'
 * anteprima e non c'e' ora: sono dell'ultima risposta non letta, e quando non
 * ce n'e' una non vogliono dire niente. */
export function statoDellaChat(grezzo) {
  const unread = Math.max(0, Math.floor(Number(grezzo?.unread) || 0));
  return {
    enabled: Boolean(grezzo?.enabled),
    unread,
    preview: unread ? anteprima(grezzo?.preview) : "",
    writtenAt: unread ? Number(grezzo?.written_at ?? grezzo?.writtenAt) || 0 : 0,
  };
}

/* Un messaggio del socket e' un evento della chat se e' un evento, e se e'
 * il nostro: la stessa sottoscrizione riceve prima la risposta «sottoscritto»,
 * che non e' una risposta dell'assistenza. */
export function eUnEventoDellaChat(messaggio) {
  return messaggio?.type === "event" && pulito(messaggio?.event?.event_type) === EVENTO_DI_CASA;
}

export function paroleDelleRisposte(quante) {
  const n = Math.max(0, Math.floor(Number(quante) || 0));
  if (n === 1) return pick("1 risposta nuova", "1 new reply");
  return pick(`${n} risposte nuove`, `${n} new replies`);
}

/* La tessera: c'e' solo finche' c'e' qualcosa da leggere.
 *
 * Il numero grande e' quante risposte aspettano; la didascalia porta l'ultima
 * frase, che e' la cosa che si vuole sapere prima di aprire. Si accende e
 * chiede attenzione — e' un avviso, e' fatta per farsi notare — e se ne va da
 * sola quando la finestra si apre, perche' aprire la chat e' leggerla. */
export function tesseraDellaChat(stato) {
  const letto = statoDellaChat(stato);
  if (!letto.enabled || !letto.unread) return null;
  return {
    key: CHIAVE_TESSERA,
    accent: "#22c55e",
    icon: "💬",
    label: pick("Assistenza", "Support"),
    value: String(letto.unread),
    caption: letto.preview || paroleDelleRisposte(letto.unread),
    ring: null,
    alert: true,
    attiva: true,
    risposte: letto.unread,
    anteprima: letto.preview,
    scrittoIl: letto.writtenAt,
  };
}
