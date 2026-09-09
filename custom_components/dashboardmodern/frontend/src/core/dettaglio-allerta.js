/* Cosa c'e' dentro un'allerta quando la si apre (#422).
 *
 * «Non si può interagire con le schede allerte per espandere le informazioni.
 *  Sarebbe molto utile poter cliccare per esempio sulle allerte della
 *  protezione civile per vedere il dettaglio, così come degli scioperi.»
 *
 * La tessera dice il minimo che serve per alzare la testa: icona, nome,
 * livello, una frase e due righe. Il resto c'era gia' e non si vedeva — il
 * testo di un avviso della protezione civile lo si tagliava a centottanta
 * caratteri per farlo stare nel riquadro, e tutto quello che l'integrazione
 * scrive negli attributi non usciva da nessuna parte.
 *
 * Questo modulo decide cosa vale la pena mostrare quando la tessera si apre.
 * Non disegna e non traduce: entra quello che Home Assistant dice dell'entita',
 * esce un elenco di voci in ordine. Le parole per intitolarle e il popup che le
 * ospita stanno nella sezione.
 *
 * La regola su cosa tenere e' «tutto tranne il rumore», non «una lista di cose
 * che conosco»: le integrazioni delle allerte sono tante e ognuna scrive
 * attributi suoi — la protezione civile non scrive come gli scioperi, e gli
 * scioperi non scrivono come i terremoti. Un elenco di campi noti avrebbe
 * mostrato solo le fonti a cui qualcuno aveva pensato, e per le altre il
 * dettaglio sarebbe stato vuoto: cioe' il difetto di adesso, spostato di un
 * passo.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Quello che non si mostra mai.
 *
 * Non sono informazioni sull'allerta: sono il modo in cui Home Assistant tiene
 * insieme un'entita'. `friendly_name` e' gia' il titolo della finestra,
 * `icon` e' gia' disegnata, e il resto non lo si legge — occuperebbe le prime
 * righe con roba che non dice niente proprio dove si e' venuti a leggere. */
export const RUMORE = Object.freeze(
  new Set([
    "assumed_state",
    "attribution",
    "device_class",
    "editable",
    "entity_id",
    "entity_picture",
    "friendly_name",
    "hidden_by",
    "icon",
    "restored",
    "state_class",
    "supported_features",
    "unit_of_measurement",
  ]),
);

/* Un valore che non si puo' leggere non si mostra.
 *
 * Gli attributi di un'allerta arrivano come capita: una stringa, un numero, una
 * lista di zone, a volte un oggetto intero. Le prime tre si leggono; l'ultimo
 * no — stampare un oggetto vuol dire scriverci «[object Object]», che e' peggio
 * di non scrivere niente. Una lista si legge se i suoi pezzi si leggono. */
export function comeSiLegge(valore) {
  if (valore === null || valore === undefined) return "";
  if (typeof valore === "boolean") return valore ? "sì" : "no";
  if (typeof valore === "number") return Number.isFinite(valore) ? String(valore) : "";
  if (typeof valore === "string") return valore.trim();
  if (Array.isArray(valore)) {
    const pezzi = valore.map(comeSiLegge).filter(Boolean);
    return pezzi.length ? pezzi.join(", ") : "";
  }
  return "";
}

/* Il nome di un attributo, scritto come si legge.
 *
 * Arrivano in inglese e con gli underscore, perche' e' cosi' che Home Assistant
 * li chiama: `event_description`. Non si traducono — sono nomi che
 * l'integrazione ha scelto, e tradurli vorrebbe dire indovinare cosa intendeva
 * — ma almeno si scrivono come una frase invece che come una chiave. */
export function titoloDellaVoce(chiave) {
  const nome = pulito(chiave).replace(/[_-]+/g, " ").trim();
  if (!nome) return "";
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/* Quanto e' lungo un valore prima di essere «un testo» invece che «un dato».
 *
 * Sotto, sta su una riga accanto al suo nome. Sopra, e' un paragrafo e vuole
 * una riga sua: e' esattamente il caso dell'avviso della protezione civile, che
 * e' il motivo per cui questa finestra esiste. */
export const TESTO_LUNGO = 90;

/**
 * Le voci da mostrare, in ordine, da quello che Home Assistant dice dell'entita'.
 *
 * Ogni voce porta `lungo` quando e' un paragrafo e non un dato: chi disegna la
 * mette sotto al suo nome invece che accanto, e non deve misurarla lui.
 */
/* Se un valore e' un istante scritto come lo scrive una macchina.
 *
 * «2026-09-09T12:00:00+02:00» e' una data solo per chi sa leggerla. Qui non si
 * formatta — la lingua di chi guarda questo modulo non la sa — si dice
 * soltanto che LO E', cosi' chi disegna la scrive come si scrive una data. */
export function eUnIstante(valore) {
  if (typeof valore !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(valore.trim())) return false;
  return Number.isFinite(new Date(valore).getTime());
}

export function vociDelDettaglio(attributi = {}, salta = RUMORE) {
  if (!attributi || typeof attributi !== "object") return [];
  const voci = [];
  for (const [chiave, grezzo] of Object.entries(attributi)) {
    if (salta.has(chiave)) continue;
    const valore = comeSiLegge(grezzo);
    if (!valore) continue;
    const titolo = titoloDellaVoce(chiave);
    if (!titolo) continue;
    const istante = eUnIstante(valore);
    voci.push(
      Object.freeze({
        chiave,
        titolo,
        valore,
        istante,
        /* Una data non e' mai un paragrafo, per quanto lunga sia scritta. */
        lungo: !istante && valore.length > TESTO_LUNGO,
      }),
    );
  }
  return voci;
}

/**
 * Se una tessera ha qualcosa da far vedere quando la si apre.
 *
 * Una che non ce l'ha non deve sembrare toccabile: un dito che preme e non
 * ottiene niente e' peggio di un riquadro fermo, perche' la seconda volta non
 * si prova piu' nemmeno dove invece funzionava.
 */
export function valeLaPenaAprirla(lettura = {}, attributi = {}) {
  if (vociDelDettaglio(attributi).length) return true;
  /* Il testo intero che la tessera taglia e' gia' un motivo per aprirla. */
  return pulito(lettura?.testo).length > 0;
}
