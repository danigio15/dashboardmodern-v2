/* Un solo padrone per il modello Energia.
 *
 * La maschera Energia aveva due modi di salvare. I campi stampati dal
 * programma raccoglievano le modifiche in una bozza — una copia del modello
 * presa all'apertura — che il bottone "Salva Energia" riscriveva per intero; i
 * campi aggiunti dopo (i contatori totali, il SOC della batteria) scrivevano
 * invece subito nel modello. Bastava compilare un totale e poi premere Salva
 * perche' la bozza, ferma a com'era prima, rimettesse al suo posto il valore
 * vecchio: la configurazione tornava indietro da sola e sembrava che il
 * configuratore non volesse saperne di tenere i sensori giusti.
 *
 * Qui passa ogni scrittura al modello Energia, una alla volta e sempre
 * ripartendo da cio' che c'e' davvero nello store. Niente bozza, niente
 * secondo padrone.
 */

let queue = Promise.resolve();
let inFlight = 0;

const clean = (value) => String(value ?? "").trim();

/* Vero mentre la maschera sta scrivendo nel modello.
 *
 * Chi tiene allineato l'editor alle modifiche dello store lo ridisegna da capo
 * a ogni cambio della sezione Energia. Va bene quando il cambio arriva da
 * un'altra parte; quando arriva dalla maschera stessa significa cancellare il
 * campo che si sta compilando mentre lo si compila. */
export const energyWriteInFlight = () => inFlight > 0;

async function write(task) {
  inFlight += 1;
  try {
    await task();
  } finally {
    inFlight -= 1;
  }
}

/** Accoda un lavoro sul modello Energia e restituisce la sua promessa. */
export function queueEnergyWrite(task) {
  const run = () => task();
  queue = queue.then(run, run);
  return queue;
}

/** Attende che ogni scrittura in coda sia finita. */
export function flushEnergyWrites() {
  return queue.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Scrive uno o piu' campi del modello Energia.
 *
 * `updates` e' una lista di `[gruppo, campo, valore]`. Ogni scrittura rilegge
 * il modello dallo store: due campi cambiati a poca distanza — cosa che succede
 * compilando la maschera dall'alto in basso — non si sovrascrivono piu' a
 * vicenda.
 */
export function persistEnergyFields(store, updates = []) {
  const changes = (Array.isArray(updates) ? updates : []).filter(
    (entry) => Array.isArray(entry) && clean(entry[0]) && clean(entry[1]),
  );
  if (!changes.length) return Promise.resolve();
  return queueEnergyWrite(() =>
    write(async () => {
      if (!store?.getSection || !store?.replaceSection) return;
      const model = store.getSection("energy") || {};
      for (const [group, key, value] of changes) {
        model[group] = { ...(model[group] || {}) };
        model[group][key] = clean(value);
      }
      model.metadata = { ...(model.metadata || {}), semantics_version: 3 };
      await store.replaceSection("energy", model);
    }),
  );
}

/** Scrive un singolo campo del modello Energia. */
export const persistEnergyField = (store, group, key, value) =>
  persistEnergyFields(store, [[group, key, value]]);

/**
 * Scrive la dichiarazione di sorgente unica di un gruppo.
 *
 * Il sotto-oggetto viene riscritto per intero: togliere l'ultima entita'
 * dichiarata deve lasciare il gruppo come se la sorgente unica non fosse mai
 * stata scelta, non un guscio vuoto che continua a comandare.
 */
export function persistSignedSource(store, group, signed) {
  return queueEnergyWrite(() =>
    write(async () => {
      if (!store?.getSection || !store?.replaceSection) return;
      const model = store.getSection("energy") || {};
      model[group] = { ...(model[group] || {}) };
      const entities = Object.entries(signed || {}).filter(
        ([key, value]) => key !== "positive" && clean(value),
      );
      if (!entities.length) delete model[group].signed;
      else
        model[group].signed = {
          ...Object.fromEntries(entities.map(([key, value]) => [key, clean(value)])),
          positive: clean(signed?.positive),
        };
      model.metadata = { ...(model.metadata || {}), semantics_version: 3 };
      await store.replaceSection("energy", model);
    }),
  );
}
