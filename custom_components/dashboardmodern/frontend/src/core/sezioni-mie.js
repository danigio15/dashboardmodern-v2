/* Le sezioni che si fa l'utente (#262).
 *
 * «Dare la possibilità di creare sezioni custom, dove poter inserire le
 * proprie entità a piacimento. Per esempio avrei potuto inserire le entità
 * dell'UPS senza attendere lo sviluppo della sezione apposita.»
 *
 * L'esempio dice tutto: fra il momento in cui uno ha in casa una cosa e il
 * momento in cui questa plancia impara a disegnarla passa del tempo, e in
 * quel tempo le sue entità non hanno un posto. Una sezione fatta a mano non
 * sostituisce quella disegnata — non sa cos'e' un gruppo di continuita', non
 * gli fa il grafico della carica — ma sa fare l'unica cosa che serve subito:
 * mettere insieme delle entita' sotto un titolo, dire come stanno, e
 * accenderle se si accendono.
 *
 * Questo modulo e' la parte pura: la forma di una sezione, la sua lettura
 * dagli stati di Home Assistant, e la chiave con cui la sua voce si spegne.
 * Le parole per dirlo a schermo stanno nelle sezioni, che e' dove il
 * raccoglitore delle traduzioni guarda.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Un limite alla barra, non alla fantasia. Otto sezioni proprie stanno in una
 * barra insieme alle sedici del guscio; la trentesima non si vedrebbe piu' e
 * il problema sarebbe piu' difficile da capire che da evitare. */
export const MASSIMO_SEZIONI = 8;

/** La chiave con cui la voce di una sezione si accende e si spegne. */
export const chiaveDellaSezione = (id) => `mia-${pulito(id)}`;

/* Gli stati che significano «non lo so», e che non vanno mostrati come se
 * fossero una lettura. */
const MUTI = new Set(["unavailable", "unknown", "none", ""]);

/* I domini che si accendono e si spengono con un tocco. Fuori da qui una
 * riga si legge e basta: chiamare `toggle` su un sensore non fa niente, e un
 * interruttore che non fa niente e' peggio di nessun interruttore. */
const COMANDABILI = new Set([
  "switch",
  "light",
  "fan",
  "input_boolean",
  "automation",
  "script",
  "scene",
  "siren",
  "humidifier",
]);

/* Gli stati che valgono «acceso». `playing` e `home` ci stanno perche' una
 * riga accesa e' una riga che sta facendo qualcosa, non solo una con un
 * interruttore alzato. */
const ACCESI = new Set(["on", "open", "playing", "home", "heat", "cool", "cleaning", "active"]);

function normalizzaVoce(voce, indice) {
  const entity = pulito(voce?.entity);
  if (!entity.includes(".")) return null;
  return {
    id: pulito(voce?.id) || `voce-${indice + 1}`,
    nome: pulito(voce?.nome ?? voce?.name),
    entity,
    icona: pulito(voce?.icona ?? voce?.icon),
  };
}

/**
 * L'elenco delle sezioni, ripulito.
 *
 * Una sezione senza titolo ne prende uno di serie col suo numero: senza, la
 * voce nella barra sarebbe vuota e non ci si potrebbe nemmeno cliccare sopra
 * per rimediare. Una sezione senza entita' invece resta: e' il primo momento
 * di ogni sezione, e cancellarla mentre la si sta compilando sarebbe il modo
 * piu' rapido di rendere la funzione inservibile. Chi disegna decide se una
 * sezione vuota merita una voce nella barra — qui non si butta via niente.
 */
export function normalizzaSezioni(stored) {
  const righe = Array.isArray(stored)
    ? stored
    : stored && typeof stored === "object"
      ? [stored]
      : [];
  return righe
    .filter((riga) => riga && typeof riga === "object")
    .slice(0, MASSIMO_SEZIONI)
    .map((riga, indice) => ({
      id: pulito(riga.id) || `sezione-${indice + 1}`,
      titolo: pulito(riga.titolo ?? riga.title),
      icona: pulito(riga.icona ?? riga.icon) || "⭐",
      /* Si mostra nella barra a meno che non si sia detto di no: una sezione
       * appena creata deve comparire, o non si capisce che e' stata creata. */
      mostra: riga.mostra !== false,
      voci: (Array.isArray(riga.voci) ? riga.voci : Array.isArray(riga.rows) ? riga.rows : [])
        .map(normalizzaVoce)
        .filter(Boolean),
    }));
}

/** Le sezioni che meritano una voce nella barra: hanno qualcosa da mostrare. */
export function sezioniDaMostrare(stored) {
  return normalizzaSezioni(stored).filter((sezione) => sezione.mostra && sezione.voci.length);
}

/** Tutte le entita' nominate, senza doppioni: serve a chi ascolta gli stati. */
export function entitaDelleSezioni(stored) {
  const viste = new Set();
  for (const sezione of normalizzaSezioni(stored))
    for (const voce of sezione.voci) viste.add(voce.entity);
  return [...viste];
}

/**
 * Come sta una riga, adesso.
 *
 * `resolve` serve ai riferimenti virtuali della configurazione vecchia, che
 * non sono entity_id veri: chi chiama sa come si risolvono, questo modulo no.
 */
export function letturaDellaVoce(voce, states = {}, resolve = (valore) => valore) {
  const entity = resolve(voce.entity) || voce.entity;
  const stato = states?.[entity];
  const grezzo = pulito(stato?.state).toLowerCase();
  const muto = MUTI.has(grezzo);
  const dominio = entity.split(".")[0] || "";
  const numero = Number(stato?.state);
  return {
    id: voce.id,
    entity,
    dominio,
    /* Il nome scritto in configurazione vince, poi quello di Home Assistant,
     * e per ultimo l'entita': un id in mezzo alle parole e' quello che si
     * legge quando nessuno ha avuto niente da dire. */
    nome: voce.nome || pulito(stato?.attributes?.friendly_name) || entity,
    icona: voce.icona,
    muto,
    acceso: !muto && ACCESI.has(grezzo),
    /* Un numero con la sua unita' si mostra com'e'; il resto e' una parola di
     * stato, e la traduce chi disegna. */
    numero: Number.isFinite(numero) && grezzo !== "" && !MUTI.has(grezzo) ? numero : null,
    unita: pulito(stato?.attributes?.unit_of_measurement),
    stato: muto ? "" : pulito(stato?.state),
    comandabile: COMANDABILI.has(dominio),
  };
}

/** Tutte le righe di una sezione, lette. */
export function lettureDellaSezione(sezione, states = {}, resolve = (valore) => valore) {
  return (sezione?.voci || []).map((voce) => letturaDellaVoce(voce, states, resolve));
}

/**
 * Il riassunto di una sezione: quante ne rispondono e quante sono accese.
 *
 * Serve al sottotitolo della pagina, che senza direbbe solo il numero di
 * righe — un dato che si conta anche a occhio guardando la pagina.
 */
export function contoDellaSezione(letture = []) {
  const vive = letture.filter((riga) => !riga.muto);
  return {
    quante: letture.length,
    vive: vive.length,
    accese: vive.filter((riga) => riga.acceso).length,
    mute: letture.length - vive.length,
  };
}
