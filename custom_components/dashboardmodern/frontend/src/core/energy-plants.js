/* Piu' di un impianto sotto lo stesso tetto.
 *
 * «Io ho una casa che e' l'unione di due appartamenti, quindi ho 2 misuratori
 * di consumo nei due appartamenti e ogni appartamento ha i rispettivi carichi.
 * Nella pagina energia nativa di HA e' fattibile, qui mi pare che non si possa
 * fare.»
 *
 * Non si poteva: l'energia e' costruita attorno a una casa sola — una rete, un
 * fotovoltaico, una batteria, otto carichi — e sopra a quella non c'era niente.
 *
 * Qui c'e' quel livello, e c'e' con una regola sola davanti a tutte: NON SI
 * SPOSTA NIENTE. L'impianto che c'e' gia' resta esattamente dov'e', al primo
 * livello dell'oggetto, con le stesse chiavi che il runtime legge da sempre.
 * Chi ha una casa sola non migra un bel niente e non si accorge che questo
 * modulo esiste. Gli impianti in piu' stanno in un elenco accanto — la stessa
 * forma con cui le piscine sono diventate piu' d'una, che ha funzionato.
 *
 * E c'e' una seconda regola, che nasce da come sono andate le auto.
 *
 * Un profilo auto aveva una chiave ricavata dal nome e dalla marca, e
 * ricalcolata a ogni salvataggio: rinominare un'auto voleva dire cambiarle
 * identita', e quello che le apparteneva — la foto col cavo, il logo — restava
 * attaccato a una chiave che non esisteva piu'. Da li' e' nato il perdere la
 * testa sulle foto.
 *
 * L'id di un impianto quindi: nasce una volta sola, quando l'impianto nasce; non
 * si ricava dal nome e non si ricalcola mai; non si riusa nemmeno quando
 * l'impianto che lo portava viene cancellato. Rinominare «Casa Giovanni» in
 * «Casa di sopra» non tocca l'id, e tutto quello che a quell'id e' appeso —
 * carichi, tariffa, storico — resta appeso.
 *
 * Il modulo e' puro: entra un oggetto, esce un oggetto.
 */

const clean = (value) => String(value ?? "").trim();

/* L'id del primo impianto non e' scelto: e' quello, sempre.
 *
 * Serve a due cose. La prima: chi ha una casa sola e non ha mai visto questa
 * schermata ha comunque un impianto con un id, senza che nessuno glielo abbia
 * scritto. La seconda: le chiavi di runtime del primo impianto restano quelle
 * di sempre — `cd_costo_kwh` e non `cd_costo_kwh_qualcosa` — e lo storico di
 * chi c'era prima non riparte da zero. */
export const PRIMO_IMPIANTO = "impianto";

/** I quattro gruppi di cui un impianto e' fatto. */
export const PLANT_GROUPS = Object.freeze(["house", "grid", "solar", "battery"]);

/* Cosa appartiene all'impianto e non al giro di salvataggio.
 *
 * E' la lezione delle auto messa per iscritto: quando un impianto viene
 * riscritto, questi campi si rimettono. Un salvataggio che ne conosce solo
 * alcuni non deve poter cancellare gli altri. */
export const PLANT_IDENTITY_FIELDS = Object.freeze(["id", "name", "metadata"]);

const oggetto = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

function normalizzato(source = {}, index = 0) {
  const base = oggetto(source);
  const impianto = {
    /* L'id non si inventa qui a partire dal nome: se manca, il primo prende
     * quello di sempre e gli altri il loro numero d'ordine — ma un impianto
     * nato da `nuovoImpiantoId` un id ce l'ha gia', e quello resta. */
    id: clean(base.id) || (index === 0 ? PRIMO_IMPIANTO : `${PRIMO_IMPIANTO}-${index + 1}`),
    name: clean(base.name),
    metadata: { ...oggetto(base.metadata) },
  };
  for (const gruppo of PLANT_GROUPS) impianto[gruppo] = { ...oggetto(base[gruppo]) };
  return impianto;
}

/** Se in questo impianto e' stata scritta almeno una entita'. */
export function plantIsConfigured(plant = {}) {
  return PLANT_GROUPS.some((gruppo) =>
    Object.values(oggetto(plant[gruppo])).some((valore) => clean(valore)),
  );
}

/**
 * Tutti gli impianti, il primo per primo.
 *
 * Il primo sta in cima all'oggetto salvato — dove il runtime lo cerca — e gli
 * altri nell'elenco `plants` accanto.
 */
export function plantList(stored = {}) {
  /* Una configurazione scritta gia' come elenco (un'esportazione, un ripristino
   * da un'altra plancia) non deve perdere il primo impianto: qui si riconosce
   * e si riporta nella forma buona. */
  if (Array.isArray(stored)) return stored.map((item, index) => normalizzato(item, index));
  const source = oggetto(stored);
  const extra = Array.isArray(source.plants) ? source.plants : [];
  return [normalizzato(source, 0), ...extra.map((item, index) => normalizzato(item, index + 1))];
}

/** Gli impianti che vale la pena disegnare, con l'indice che avevano. */
export function configuredPlants(stored = {}) {
  const tutti = plantList(stored).map((plant, index) => ({ ...plant, index }));
  const configurati = tutti.filter((plant) => plantIsConfigured(plant));
  /* Se non ne e' configurato nessuno resta il primo: una plancia appena
   * installata deve poter mostrare la sua pagina vuota, non nessuna pagina. */
  return configurati.length ? configurati : tutti.slice(0, 1);
}

/**
 * L'oggetto da salvare, nella forma che il runtime sa gia' leggere.
 *
 * Quello che non appartiene agli impianti — una chiave aggiunta da una versione
 * futura — resta dov'e': riscrivere l'oggetto da zero vorrebbe dire buttare via
 * cio' che non si conosce.
 */
export function storedPlants(list = [], previous = {}) {
  const impianti = (Array.isArray(list) ? list : []).map((item, index) =>
    normalizzato(item, index),
  );
  const base = oggetto(previous);
  const risultato = { ...base };
  delete risultato.plants;
  for (const gruppo of PLANT_GROUPS) delete risultato[gruppo];
  const [primo, ...altri] = impianti;
  if (primo) {
    for (const campo of PLANT_IDENTITY_FIELDS) risultato[campo] = primo[campo];
    for (const gruppo of PLANT_GROUPS) risultato[gruppo] = primo[gruppo];
  }
  if (altri.length) risultato.plants = altri;
  /* Il segno sale e non scende mai, nemmeno quando un impianto viene
   * cancellato: e' cio' che impedisce a un id di tornare buono una seconda
   * volta, con addosso quello che apparteneva a chi non c'e' piu'. */
  risultato.metadata = {
    ...oggetto(risultato.metadata),
    [SEQ_FIELD]: altoSegno(impianti, { ...oggetto(base.metadata), ...oggetto(primo?.metadata) }),
  };
  return risultato;
}

/**
 * L'id di un impianto che sta per nascere.
 *
 * Non si ricava dal nome — un nome cambia, e con lui cambierebbe l'identita' —
 * e non si riusa: se l'impianto 2 viene cancellato, il prossimo e' il 3. Un id
 * riusato erediterebbe in silenzio i carichi e la tariffa di un impianto che
 * non esiste piu'.
 */
/* Il numero piu' alto mai distribuito.
 *
 * Guardare solo gli impianti vivi non basta: chi cancella l'ultimo e ne
 * aggiunge un altro si ritroverebbe lo stesso id, e con esso i carichi e la
 * tariffa dell'impianto cancellato — che e' esattamente il genere di eredita'
 * silenziosa che fa perdere la testa. Il segno resta scritto nell'oggetto anche
 * quando l'impianto che l'ha alzato non c'e' piu'. */
export const SEQ_FIELD = "plant_seq";

const numeroDi = (id) => {
  const match = new RegExp(`^${PRIMO_IMPIANTO}-(\\d+)$`).exec(clean(id));
  return match ? Number(match[1]) : 0;
};

export function altoSegno(list = [], metadata = {}) {
  const daiVivi = (Array.isArray(list) ? list : []).reduce(
    (massimo, plant) => Math.max(massimo, numeroDi(plant?.id)),
    1,
  );
  const scritto = Number(oggetto(metadata)[SEQ_FIELD]);
  return Math.max(daiVivi, Number.isFinite(scritto) ? scritto : 0, 1);
}

export function nuovoImpiantoId(list = [], metadata = {}) {
  return `${PRIMO_IMPIANTO}-${altoSegno(list, metadata) + 1}`;
}

/** Un impianto nuovo, vuoto, pronto a essere configurato da capo. */
export function nuovoImpianto(list = [], nome = "", metadata = {}) {
  return normalizzato({ id: nuovoImpiantoId(list, metadata), name: clean(nome) }, 1);
}

/** Come si chiama un impianto quando chi l'ha fatto non gli ha dato un nome. */
export function plantLabel(plant = {}, index = 0, fallback = "Impianto") {
  return clean(plant.name) || (index === 0 ? fallback : `${fallback} ${index + 1}`);
}

/**
 * Dove si tiene, per QUESTO impianto, una cosa che prima era una sola.
 *
 * La tariffa, le viste, i contatori: il primo impianto continua a usare la
 * chiave di sempre, cosi' chi c'era prima non perde niente; gli altri hanno la
 * loro, col loro id attaccato. E' la stessa regola con cui le piscine hanno
 * moltiplicato il contatore di filtrazione.
 */
export function plantKey(base, plant = {}, index = 0) {
  const id = clean(plant?.id);
  if (index === 0 || !id || id === PRIMO_IMPIANTO) return base;
  return `${base}_${id}`;
}

/** L'impianto scelto, o il primo che c'e'. */
export function pickPlant(list = [], scelto = "") {
  const id = clean(scelto);
  return list.find((plant) => plant.id === id) || list[0] || null;
}

/* ── i carichi, che adesso appartengono a un impianto ──────────────────── */

/* Il campo con cui un carico dice a che impianto appartiene.
 *
 * Vuoto vuol dire il primo, sempre. Non e' una svista: e' cio' che permette a
 * otto carichi gia' configurati di restare dove sono senza che nessuno li
 * tocchi, il giorno in cui questo campo compare. */
/* Dove si tiene l'impianto che si sta guardando.
 *
 * Non e' configurazione: e' l'ultima linguetta toccata, come il periodo scelto
 * o la stanza aperta. Sta fuori dal modello apposta — cambiarla non deve
 * sporcare quello che si salva. Il nome della casella vive qui, col resto di
 * quello che si sa sugli impianti: chi ha bisogno di sapere quale impianto e'
 * aperto non deve tirarsi dietro l'intera sezione Energia per scoprirlo. */
export const IMPIANTO_SCELTO_KEY = "cd_energy_plant";

/* L'impianto scelto e il suo posto nell'elenco, in una domanda sola.
 *
 * Il posto serve quanto l'identita': un carico senza campo impianto appartiene
 * al PRIMO, e per saperlo bisogna sapere se quello scelto e' il primo. Chi
 * chiedeva le due cose separatamente le teneva allineate a mano. */
export function plantAt(stored = {}, scelto = "") {
  const lista = plantList(stored);
  const impianto = pickPlant(lista, scelto);
  if (!impianto) return { list: lista, plant: null, index: 0 };
  const posto = lista.findIndex((voce) => clean(voce?.id) === clean(impianto.id));
  return { list: lista, plant: impianto, index: posto < 0 ? 0 : posto };
}

/* La configurazione vista dall'impianto scelto.
 *
 * Si sostituiscono i quattro gruppi — casa, rete, solare, batteria — e
 * nient'altro: i metadati, e una chiave scritta da una versione futura,
 * restano dove sono. Senza impianto scelto, o con uno solo, esce esattamente
 * l'oggetto che c'era.
 *
 * Questa e' la forma che leggono tutti: la sezione per i suoi numeri, e la
 * proiezione che dice alle caselle storiche quale sensore guardare. Erano due
 * conti separati, e uno dei due non sapeva degli impianti: le linguette
 * cambiavano i carichi e lasciavano i misuratori su quelli della prima casa. */
export function plantModel(stored = {}, scelto = "") {
  const impianto = pickPlant(plantList(stored), scelto);
  if (!impianto) return stored;
  return {
    ...stored,
    ...Object.fromEntries(PLANT_GROUPS.map((gruppo) => [gruppo, impianto[gruppo]])),
  };
}

export const LOAD_PLANT_FIELD = "plant";

/** Se questo carico appartiene a questo impianto. */
export function loadBelongsToPlant(load = {}, plant = {}, index = 0) {
  const scritto = clean(load?.[LOAD_PLANT_FIELD]);
  if (!scritto) return index === 0 || clean(plant?.id) === PRIMO_IMPIANTO;
  return scritto === clean(plant?.id);
}

/** I carichi di un impianto, nell'ordine in cui stavano. */
export function plantLoads(loads = [], plant = {}, index = 0) {
  return (Array.isArray(loads) ? loads : []).filter((load) =>
    loadBelongsToPlant(load, plant, index),
  );
}

/** Lo stesso elenco, col carico assegnato a un impianto. */
export function assignLoadPlant(loads = [], loadId, plantId) {
  const id = clean(loadId);
  const impianto = clean(plantId);
  return (Array.isArray(loads) ? loads : []).map((load) =>
    clean(load?.id) === id
      ? { ...load, [LOAD_PLANT_FIELD]: impianto === PRIMO_IMPIANTO ? "" : impianto }
      : load,
  );
}

/** I carichi che restano quando un impianto se ne va: nessuno dei suoi. */
export function dropPlantLoads(loads = [], plantId) {
  const id = clean(plantId);
  if (!id || id === PRIMO_IMPIANTO) return Array.isArray(loads) ? [...loads] : [];
  return (Array.isArray(loads) ? loads : []).filter(
    (load) => clean(load?.[LOAD_PLANT_FIELD]) !== id,
  );
}
