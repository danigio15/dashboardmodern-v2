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
 * aggiorna niente — installare e' un gesto che si fa da Home Assistant, dove
 * c'e' il tasto e ci sono le note di rilascio.
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
 * @returns {Array<{entity:string,nome:string,da:string,a:string,nostra:boolean}>}
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
    }))
    .sort((una, altra) => {
      if (una.nostra !== altra.nostra) return una.nostra ? -1 : 1;
      return una.nome.localeCompare(altra.nome);
    });
}
