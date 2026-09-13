/* Cosa c'e' da aggiornare, in casa.
 *
 * «Creare un avviso che segnali gli aggiornamenti presenti da effettuare,
 * compresi quelli della fantastica dashmodern» (#498).
 *
 * Home Assistant lo sa gia': ogni integrazione, ogni add-on e il sistema
 * stesso pubblicano un'entita' `update.`, che sta a ON quando c'e' una
 * versione nuova e porta addosso quella installata e quella disponibile. Non
 * c'e' niente da andare a chiedere fuori e niente da configurare: la casa lo
 * dichiara, qui si legge.
 *
 * Per questo la tessera non ha una casella in cui scrivere entita': quello che
 * c'e' da aggiornare e' quello che Home Assistant dice, e un elenco scritto a
 * mano invecchierebbe al primo add-on installato.
 *
 * Il modulo e' puro: riceve gli stati e risponde. Non chiama niente e non
 * aggiorna niente — a chiamare il servizio ci pensa la sezione. Qui si dice
 * soltanto se quell'aggiornamento si puo' far partire da fuori, e dove stanno
 * le sue note.
 *
 * Perche' il tasto ci vuole: «gli aggiornamenti vengono segnalati ma non e'
 * possibile avviarli, e' necessario andarli a fare dall'interfaccia di HA»
 * (#540). Un avviso che dice solo «vai da un'altra parte» fa fare due volte la
 * stessa strada. Le note di rilascio non si perdono per questo: viaggiano con
 * la riga, accanto al tasto, ed e' li' che si leggono prima di premerlo.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Il dominio delle entita' che dicono se c'e' una versione nuova. */
const DOMINIO = "update.";

/* La plancia si riconosce dal suo `title`, che l'entita' dichiara e che non
 * cambia col nome che uno da' alla propria plancia. */
const NOSTRA = "dashboardmodern";

/** Se questa entita' e' un aggiornamento che aspetta di essere fatto. */
export function aspettaDiEssereFatto(stato) {
  if (!stato || !pulito(stato.entity_id).startsWith(DOMINIO)) return false;
  /* «on» vuol dire «c'e' una versione nuova». Le entita' non disponibili non
   * si contano: un'integrazione che non risponde non e' un aggiornamento da
   * fare, e' un'integrazione che non risponde. */
  return pulito(stato.state).toLowerCase() === "on";
}

/* Quello che un'entita' `update.` sa fare, come lo numera Home Assistant: il
 * primo bit e' «si installa chiamando un servizio». Chi non ce l'ha si aggiorna
 * altrove — un firmware che si porta col cacciavite non ha un tasto, e
 * mostrarglielo sarebbe una promessa che non si mantiene. */
const SI_INSTALLA = 1;

function numero(valore) {
  const quanto = Number(valore);
  return Number.isFinite(quanto) ? quanto : 0;
}

/** Se questo aggiornamento si puo' far partire da qui. */
function siInstalla(attributi) {
  return (numero(attributi?.supported_features) & SI_INSTALLA) !== 0;
}

/* Se sta gia' andando.
 *
 * Home Assistant lo dice in due modi, e nel tempo li ha cambiati: `in_progress`
 * oggi e' un si' o un no, ieri era la percentuale — e uno zero li' vuol dire
 * «fermo», non «allo zero per cento». La percentuale, quando c'e', arriva a
 * parte. Vanno letti tutt'e due: una versione sola lascia indietro meta' delle
 * case. */
function staAndando(attributi) {
  if (attributi?.in_progress === true) return true;
  if (numero(attributi?.in_progress) > 0) return true;
  return numero(attributi?.update_percentage) > 0;
}

/** Il nome da mostrare: quello che l'utente legge nella pagina Aggiornamenti. */
function nomeDi(stato) {
  const attributi = stato?.attributes || {};
  return (
    pulito(attributi.title) || pulito(attributi.friendly_name) || pulito(stato?.entity_id) || ""
  );
}

/** Se questo aggiornamento e' della plancia. */
function eLaNostra(stato) {
  const attributi = stato?.attributes || {};
  return (
    pulito(attributi.title).toLowerCase().replace(/\s+/g, "").includes(NOSTRA) ||
    pulito(stato?.entity_id).toLowerCase().includes(NOSTRA)
  );
}

/**
 * Gli aggiornamenti che aspettano, in ordine di chi si guarda per primo.
 *
 * La plancia va davanti quando c'e': chi ha chiesto questa tessera l'ha
 * chiesta anche — e soprattutto — per quella. Gli altri seguono in ordine
 * alfabetico, che e' l'unico ordine stabile fra una lettura e l'altra: per
 * data non si puo', perche' un'entita' `update.` non dice da quando aspetta.
 *
 * @param {object} states gli stati di Home Assistant
 * @returns {Array<{entity:string,nome:string,da:string,a:string,nostra:boolean,
 *   installabile:boolean,inCorso:boolean,note:string}>}
 */
export function aggiornamentiDaFare(states) {
  const dentro = states && typeof states === "object" ? Object.values(states) : [];
  return dentro
    .filter(aspettaDiEssereFatto)
    .map((stato) => ({
      entity: pulito(stato.entity_id),
      nome: nomeDi(stato),
      da: pulito(stato.attributes?.installed_version),
      a: pulito(stato.attributes?.latest_version),
      nostra: eLaNostra(stato),
      installabile: siInstalla(stato.attributes),
      inCorso: staAndando(stato.attributes),
      /* Dove sono scritte le note di questa versione: e' l'indirizzo che Home
       * Assistant si porta dietro, non uno che indoviniamo noi. */
      note: pulito(stato.attributes?.release_url),
    }))
    .sort((una, altra) => {
      if (una.nostra !== altra.nostra) return una.nostra ? -1 : 1;
      return una.nome.localeCompare(altra.nome);
    });
}
