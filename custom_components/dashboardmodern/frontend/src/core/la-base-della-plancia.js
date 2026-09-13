/* Da dove si carica la plancia: la base VIVA, non quella che uno ha in mano.
 *
 * «L'integrazione portava 1.4.24 ma la plancia 1.4.23.»
 *
 * Gli asset della plancia si servono su due prefissi. Quello versionato porta
 * la firma degli asset nell'indirizzo — cambia a ogni aggiornamento, quindi il
 * browser non puo' riusare niente di vecchio. Quello stabile e' sempre lo
 * stesso indirizzo, e serve come strada di recupero quando un browser ha in
 * mano una firma che non esiste piu'.
 *
 * La card della dashboard ricavava la base dal proprio indirizzo, con scritto
 * accanto che il suo modulo arriva dal prefisso versionato. Non e' piu' vero:
 * il modulo della card e' stato spostato sul prefisso STABILE apposta (#372),
 * perche' l'app companion tiene in cache l'avvio della pagina e con una firma
 * vecchia nell'indirizzo l'elemento non veniva mai definito. Il commento e'
 * rimasto indietro, e da allora la card monta l'intera plancia dal prefisso
 * stabile.
 *
 * E il prefisso stabile e' servito senza `Cache-Control`. Senza quell'header
 * un browser non chiede se il file e' cambiato: se lo tiene per una frazione
 * della sua eta' — giorni, per file di settimane — e lo serve dalla cache. Da
 * li' la plancia che resta indietro di una versione mentre l'integrazione e'
 * gia' avanti: il pannello nella barra laterale, che si carica dal prefisso
 * versionato, e' nuovo; la dashboard di appoggio, che passa dalla card, e'
 * vecchia. Due strade, due eta'.
 *
 * Quindi la base non si indovina piu' dall'indirizzo di chi la chiede: si
 * chiede a chi la sa. L'elenco dei pannelli arriva a ogni pagina dal
 * websocket, sempre aggiornato, e ogni plancia ci scrive dentro la sua base di
 * adesso. Quella e' la verita'; l'indirizzo del modulo e' solo il ripiego per
 * quando un pannello non si vede.
 *
 * Il modulo e' puro: entrano i pannelli, esce un indirizzo.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Una voce dei pannelli e' nostra se porta le due cose che scriviamo noi: la
 * base degli asset e l'elenco delle voci che quel pannello serve. Guardare la
 * sola base vorrebbe dire prendere per buono il pannello di chiunque altro
 * usasse quel nome. */
function nostra(voce) {
  const config = voce?.config;
  if (!config || typeof config !== "object") return null;
  if (!pulito(config.static_base) || !Array.isArray(config.entry_ids)) return null;
  return config;
}

/**
 * La base da cui montare, per la plancia di questa voce.
 *
 * Si preferisce il pannello di QUESTA voce: con due plance in casa sono due
 * pannelli, e montare dall'altra vorrebbe dire farsi servire i file da una
 * base che non e' la sua — oggi sono la stessa, domani chissa'. Se il suo
 * pannello non si vede — un utente a cui non e' stato dato — vale quello di
 * un'altra plancia, che gli asset li ha uguali. Se non se ne vede nessuno,
 * resta il ripiego di chi chiama.
 */
export function baseDellaPlancia(panels, entryId = "", ripiego = "") {
  const mappa = panels && typeof panels === "object" ? panels : {};
  const nostre = Object.values(mappa).map(nostra).filter(Boolean);
  const id = pulito(entryId);
  const sua = id ? nostre.find((config) => config.entry_ids.includes(id)) : null;
  return pulito((sua || nostre[0])?.static_base) || pulito(ripiego);
}
