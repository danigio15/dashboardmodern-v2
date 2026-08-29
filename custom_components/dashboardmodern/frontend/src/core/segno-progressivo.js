/* Il numero piu' alto mai distribuito, e il prossimo.
 *
 * La regola e' una sola, e vale per gli impianti dell'energia come per le auto:
 * un identificativo non si riusa mai. Guardare solo quelli vivi non basta —
 * chi cancella l'ultimo e ne aggiunge un altro si ritroverebbe lo stesso
 * numero, e con esso quello che apparteneva al cancellato: i carichi e la
 * tariffa di un impianto che non c'e' piu', le foto di un'auto che non c'e'
 * piu'. Per questo il segno resta scritto anche quando chi l'ha alzato se n'e'
 * andato.
 *
 * Era scritta due volte, con lo stesso nome e in due moduli diversi. Finche' le
 * due copie dicono la stessa cosa non si vede niente; ma e' proprio il genere
 * di regola che non deve poter divergere, perche' quando diverge si perdono
 * dati di qualcuno e non si capisce perche'.
 *
 * Puro: entrano un elenco e un oggetto, esce un numero. Niente DOM, niente
 * archiviazione, niente stati letti di nascosto.
 */

const testo = (valore) => String(valore ?? "").trim();
const oggetto = (valore) =>
  valore && typeof valore === "object" && !Array.isArray(valore) ? valore : {};

/**
 * Il numero piu' alto fra quelli in uso e quello annotato.
 *
 * @param {object} richiesta
 * @param {Array} richiesta.elenco       gli elementi vivi
 * @param {object} richiesta.metadata    dove il segno resta scritto
 * @param {string} richiesta.prefisso    la parte fissa dell'identificativo
 * @param {Function} richiesta.identificativo  come si estrae l'id da un elemento
 * @param {string} richiesta.campoSegno  la chiave del segno nei metadata
 * @param {number} richiesta.minimo      da dove parte il conto
 */
export function segnoPiuAlto({
  elenco = [],
  metadata = {},
  prefisso = "",
  identificativo = (voce) => voce?.id,
  campoSegno = "seq",
  minimo = 0,
} = {}) {
  const numeroDi = (valore) => {
    const trovato = new RegExp(`^${prefisso}-(\\d+)$`).exec(testo(valore));
    return trovato ? Number(trovato[1]) : minimo;
  };
  const daiVivi = (Array.isArray(elenco) ? elenco.filter(Boolean) : []).reduce(
    (massimo, voce) => Math.max(massimo, numeroDi(identificativo(voce))),
    minimo,
  );
  const scritto = Number(oggetto(metadata)[campoSegno]);
  return Math.max(daiVivi, Number.isFinite(scritto) ? scritto : minimo, minimo);
}

/** L'identificativo che sta per nascere: il segno piu' alto, piu' uno. */
export function prossimoIdentificativo(richiesta = {}) {
  return `${richiesta.prefisso}-${segnoPiuAlto(richiesta) + 1}`;
}
