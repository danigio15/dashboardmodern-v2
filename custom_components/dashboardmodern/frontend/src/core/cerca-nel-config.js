/* Cercare una parola dentro tutta la configurazione.
 *
 * «Implementa una funzione cerca che possa cercare all'interno di tutto il
 * config quella parola, così da velocizzare le modifiche e le
 * configurazioni.»
 *
 * La configurazione e' sparsa in una novantina di caselle e diciotto schede, e
 * ogni scheda si disegna solo quando la si apre: per sapere dove sta scritto
 * `sensor.frigo` bisognava aprirle tutte a una a una. Cercare aprendo le
 * schede sarebbe la strada peggiore — ogni apertura ridisegna, e un modulo
 * aperto a meta' perde quello che si stava scrivendo.
 *
 * Qui non si cerca nel disegno: si cerca nel MAGAZZINO. Le caselle sono JSON,
 * si camminano, e ogni foglia che contiene la parola diventa un risultato con
 * la sua strada — «Luci · light.salone: Salone». Il disegno non c'entra, non
 * si apre niente, e il risultato dice esattamente dove andare a metterci le
 * mani.
 *
 * Si guarda sia il valore sia il NOME del campo: `cd_luci` e' fatto
 * `{"light.salone": "Salone"}`, e li' l'entita' e' la chiave. Cercare solo fra
 * i valori vorrebbe dire non trovare mai una luce per entity_id.
 */

/** Senza accenti, senza maiuscole: «Però» trova «pero». */
export function appiattisci(testo) {
  return String(testo ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/* Quanto e' profonda la discesa. Una configurazione e' fatta di oggetti dentro
 * oggetti, ma non di venti livelli: oltre questo c'e' solo un anello o un
 * salvataggio malato, e in tutti e due i casi si smette. */
const FONDO = 12;

/* I nomi di campo che non si mostrano come tali: sono roba di macchina, e
 * scriverli accanto al valore non aiuta nessuno a capire dove si trova. */
const CAMPI_MUTI = new Set(["id", "uid", "key", "__ts", "_savedAt"]);

/** Il valore, scritto come si legge. Gli oggetti non si stampano. */
function foglia(valore) {
  if (valore === null || valore === undefined) return "";
  if (typeof valore === "string") return valore;
  if (typeof valore === "number" || typeof valore === "boolean") return String(valore);
  return "";
}

/* La strada fino a qui, detta a parole.
 *
 * Gli indici degli elenchi diventano il nome della riga quando ce l'ha — «la
 * seconda auto» si legge peggio di «Leapmotor B10» — e i campi di macchina si
 * saltano. */
function strada(pezzi) {
  return pezzi.filter((pezzo) => pezzo !== "" && pezzo !== null && pezzo !== undefined).join(" · ");
}

function nomeDellaRiga(riga, indice) {
  if (riga && typeof riga === "object") {
    for (const campo of ["name", "nome", "titolo", "title", "label", "entity", "entity_id"]) {
      const valore = foglia(riga[campo]);
      if (valore) return valore;
    }
  }
  return `#${indice + 1}`;
}

/* Una passata sola dentro un valore, che raccoglie ogni foglia che combacia.
 *
 * `dentro` e' quello che si sta guardando, `pezzi` la strada fatta finora.
 * Combaciano sia il nome del campo sia il suo contenuto: chi cerca «frigo»
 * vuole trovarlo sia scritto come nome sia come `sensor.frigo`. */
function cammina(dentro, ago, pezzi, chiave, uscita, profondita) {
  if (profondita > FONDO || uscita.length >= 200) return;
  if (Array.isArray(dentro)) {
    dentro.forEach((riga, indice) =>
      cammina(riga, ago, [...pezzi, nomeDellaRiga(riga, indice)], chiave, uscita, profondita + 1),
    );
    return;
  }
  if (dentro && typeof dentro === "object") {
    for (const [campo, valore] of Object.entries(dentro)) {
      const suo = CAMPI_MUTI.has(campo) ? pezzi : [...pezzi, campo];
      /* La chiave puo' essere lei stessa la cosa cercata: `cd_luci` tiene
       * l'entita' nel nome del campo e il nome della luce nel valore. */
      if (appiattisci(campo).includes(ago) && foglia(valore))
        aggiungi(uscita, chiave, pezzi, campo, foglia(valore));
      cammina(valore, ago, suo, chiave, uscita, profondita + 1);
    }
    return;
  }
  const testo = foglia(dentro);
  if (testo && appiattisci(testo).includes(ago))
    aggiungi(uscita, chiave, pezzi.slice(0, -1), pezzi.at(-1) ?? "", testo);
}

function aggiungi(uscita, chiave, pezzi, campo, testo) {
  const dove = strada(pezzi);
  const firma = `${chiave}|${dove}|${campo}|${testo}`;
  if (uscita.some((voce) => voce.firma === firma)) return;
  /* `percorso` e' la strada senza averla ancora scritta: chi disegna deve
   * poterla leggere a pezzi — il primo dice in quale sezione si e' finiti, e
   * da li' si sa quale scheda aprire — mentre `dove` e' la stessa cosa gia'
   * pronta da mostrare. */
  uscita.push({ firma, chiave, percorso: pezzi.slice(), dove, campo: String(campo ?? ""), testo });
}

/**
 * Cerca `parola` dentro tutto il magazzino.
 *
 * `magazzino` e' `{ chiave: valoreGiaInterpretato }` — un oggetto, un elenco o
 * una stringa, come esce da `JSON.parse`. Torna un elenco di
 * `{ chiave, dove, campo, testo }`: dove sta, come si chiama il campo, e cosa
 * c'e' scritto. Sotto i due caratteri non si cerca: un elenco di trecento
 * righe non e' una risposta.
 */
export function cercaNelConfig(parola, magazzino = {}) {
  const ago = appiattisci(parola);
  if (ago.length < 2) return [];
  const uscita = [];
  for (const [chiave, valore] of Object.entries(magazzino || {})) {
    if (valore === null || valore === undefined) continue;
    cammina(valore, ago, [], chiave, uscita, 0);
  }
  /* Prima chi combacia dall'inizio, poi il resto: chi scrive «lav» cerca la
   * lavatrice, non un sensore che finisce per lav. */
  return uscita.sort((sinistra, destra) => {
    const primo = appiattisci(sinistra.testo).indexOf(ago) - appiattisci(destra.testo).indexOf(ago);
    if (primo !== 0) return primo;
    return sinistra.testo.length - destra.testo.length;
  });
}
