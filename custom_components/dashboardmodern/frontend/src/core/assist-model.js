/* Assist: chiedere le cose a casa, scrivendo o parlando (#360).
 *
 * «Vorrei avere la possibilita di aprire assist per chiedere delle cose sia
 * scrivendo che parlando.»
 *
 * Assist e' l'assistente di Home Assistant: capisce le frasi, accende le luci,
 * risponde alle domande. La plancia non ne rifa' uno — sarebbe un secondo
 * assistente da tenere allineato al primo — ma gli parla: la frase parte da
 * qui, la capisce Home Assistant, la risposta torna indietro.
 *
 * La divisione del lavoro e' quella onesta:
 *
 *   la voce      → la ascolta il BROWSER, che ha il microfono e sa trascrivere;
 *   la frase     → la capisce HOME ASSISTANT, che conosce la casa;
 *   la risposta  → la dice il browser, se glielo si chiede.
 *
 * Mandare l'audio a Home Assistant sarebbe la strada «giusta» sulla carta, e
 * infatti e' quella dell'app: vuole una pipeline, un formato, un pezzo di
 * protocollo binario e un microfono aperto in continuazione. Questa e' una
 * plancia dentro una cornice, e la trascrizione ce l'ha gia' il browser.
 *
 * Qui c'e' solo la regola: cosa si manda, cosa torna, e quando una
 * conversazione e' finita. Niente presa e niente microfono — quelli stanno
 * nella sezione, e questa parte si prova a tavolino.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** La chiave in cui vive la configurazione di Assist. */
export const CHIAVE_ASSIST = "cd_assist";

/** Come si chiama Assist nell'elenco delle sezioni accese: `cd_sections`. */
export const SEZIONE_ASSIST = "assist";

/** Il comando con cui Home Assistant capisce una frase. */
export const TIPO_CONVERSAZIONE = "conversation/process";

/** Il comando che elenca gli assistenti configurati in casa. */
export const TIPO_AGENTI = "conversation/agent/info";

/* Cinque minuti: e' il tempo che Home Assistant stesso tiene aperta una
 * conversazione. Oltre, «e quella di prima?» non ha piu' un prima — e
 * ricominciare e' meglio che rispondere a una domanda che nessuno ricorda. */
export const CONVERSAZIONE_MS = 5 * 60 * 1000;

/**
 * La configurazione, ripulita.
 *
 * `agente` vuoto vuol dire «quello di serie»: quasi nessuno ne ha due, e
 * chiedere di sceglierne uno prima di poter parlare sarebbe un ostacolo messo
 * davanti alla prima domanda.
 */
export function normalizzaAssist(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  return {
    agente: pulito(dato.agente ?? dato.agent_id),
    lingua: pulito(dato.lingua ?? dato.language),
    /* La risposta letta ad alta voce: spenta di serie. Chi apre Assist di
     * notte, o in ufficio, non deve sentirsi rispondere dal tablet. */
    voce: dato.voce === true,
    /* Il tasto in Home: acceso di serie, perche' una funzione che c'e' ma non
     * si trova e' una funzione che non c'e'. */
    tasto: dato.tasto !== false,
  };
}

/**
 * Se Assist e' acceso.
 *
 * «Assist non e' possibile disattivare da nessuna parte.» Un interruttore
 * c'era — la casella «il tasto in basso a destra» — ma non si chiamava
 * spegnere e non stava dove si cercano gli interruttori: in questa plancia una
 * sezione si accende e si spegne dalla fascia verde in cima alla sua scheda,
 * che scrive in `cd_sections`. Assist adesso fa lo stesso, con la stessa
 * fascia e la stessa chiave, e la casella di prima sparisce: due modi di dire
 * la stessa cosa sono due modi di tenerli allineati.
 *
 * `sezioni` e' `cd_sections`, `config` la configurazione di Assist. La scelta
 * nuova vince; dove non c'e' — chi aveva gia' spento il tasto e non ha ancora
 * toccato la fascia — vale ancora quella vecchia, che diceva la stessa cosa.
 */
export function assistAcceso(sezioni, config) {
  const scelta = sezioni?.[SEZIONE_ASSIST];
  if (scelta === false) return false;
  if (scelta === true) return true;
  return normalizzaAssist(config).tasto;
}

/**
 * La domanda, nella forma che Home Assistant si aspetta.
 *
 * `conversazione` e' il filo: mandarlo indietro fa capire «accendila» dopo
 * «quale luce c'e' in salone». Torna `null` quando non c'e' niente da chiedere
 * — una frase vuota non e' una domanda.
 */
export function domandaPerHomeAssistant({
  testo,
  lingua = "",
  agente = "",
  conversazione = "",
} = {}) {
  const frase = pulito(testo);
  if (!frase) return null;
  const richiesta = { type: TIPO_CONVERSAZIONE, text: frase };
  const parlata = pulito(lingua);
  if (parlata) richiesta.language = parlata;
  const chi = pulito(agente);
  if (chi) richiesta.agent_id = chi;
  const filo = pulito(conversazione);
  if (filo) richiesta.conversation_id = filo;
  return richiesta;
}

/* Dove Home Assistant scrive la risposta: sempre lo stesso posto, da anni. */
function frase(risultato) {
  const risposta = risultato?.response;
  return pulito(risposta?.speech?.plain?.speech || risposta?.speech?.ssml?.speech);
}

/**
 * Cosa ha risposto la casa.
 *
 * `tipo` distingue le tre cose che Assist sa dire, e non sono la stessa cosa:
 * ha FATTO qualcosa, ha RISPOSTO a una domanda, oppure non ha capito. La terza
 * si disegna diversa, perche' e' l'unica in cui vale la pena riprovare.
 */
export function rispostaDi(risultato) {
  const tipo = pulito(risultato?.response?.response_type) || "action_done";
  const testo = frase(risultato);
  return {
    testo,
    tipo,
    errore: tipo === "error",
    conversazione: pulito(risultato?.conversation_id),
    /* Senza parole non c'e' niente da mostrare: capita che un comando riesca
     * in silenzio, e allora lo si dice invece di lasciare una riga vuota. */
    muta: !testo,
  };
}

/**
 * Se il filo della conversazione e' da riannodare.
 *
 * Senza un «prima» — o dopo cinque minuti — si ricomincia: mandare un
 * `conversation_id` scaduto vuol dire chiedere a Home Assistant di ricordarsi
 * una cosa che ha gia' buttato.
 */
export function filoDaRiannodare(ultimoMs, adessoMs) {
  const ultimo = Number(ultimoMs);
  const adesso = Number(adessoMs);
  if (!Number.isFinite(ultimo) || !Number.isFinite(adesso)) return true;
  return adesso - ultimo > CONVERSAZIONE_MS;
}

/**
 * Il filo da mandare adesso: quello di prima se e' ancora buono, `""` se no.
 */
export function filoDaMandare(conversazione, ultimoMs, adessoMs) {
  return filoDaRiannodare(ultimoMs, adessoMs) ? "" : pulito(conversazione);
}

/* Le lingue che il riconoscimento vocale del browser vuole per esteso: `it` da
 * solo lo accetta, ma con la variante capisce molto meglio i nomi propri —
 * «Sonoff» detto in italiano non e' «Sonoff» detto in inglese. */
const VARIANTI = Object.freeze({
  it: "it-IT",
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  nl: "nl-NL",
  pt: "pt-PT",
  pl: "pl-PL",
  ru: "ru-RU",
  tr: "tr-TR",
  ar: "ar-SA",
  hi: "hi-IN",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
});

/** La lingua da dare al microfono, dalla lingua della plancia. */
export function linguaPerIlMicrofono(locale) {
  const voce = pulito(locale) || "it";
  if (voce.includes("-")) return voce;
  return VARIANTI[voce.toLowerCase()] || voce;
}
