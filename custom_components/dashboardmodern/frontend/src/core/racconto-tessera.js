/* Cosa sta succedendo, detto in italiano.
 *
 * La finestra di una tessera era un elenco: undici righe con un nome e un
 * numero, e toccava a chi guarda mettere insieme il senso. Il progetto
 * approvato dice un'altra cosa — «il popup smette di essere un elenco e dice
 * cosa sta facendo l'impianto, da quanto, e dove va a finire» — e una forma
 * sola per tutte le sezioni, sempre nello stesso ordine: il verdetto, la
 * frase, la misura con la sua corsa, le caselle, i comandi.
 *
 * Qui stanno le prime due, che sono quelle che si ragionano: il verdetto —
 * tutto regolare, in corso, da guardare — e la frase. Sono funzioni pure: si
 * provano senza browser e senza Home Assistant, che e' l'unico modo di tenere
 * onesta una frase che dice «da 40 minuti» o «finisce alle 19:20».
 */

/* I tre verdetti, e il loro tono.
 *
 * `bene` e' verde e vuol dire che non c'e' niente da fare. `corso` e' ambra e
 * vuol dire che qualcosa sta lavorando adesso — non e' un problema, e' una
 * cosa in movimento. `guarda` e' rosso e vuol dire che qualcuno deve
 * guardarci: una finestra aperta, una batteria che scende, una perdita. */
export const VERDETTI = Object.freeze({
  bene: "bene",
  corso: "corso",
  guarda: "guarda",
});

const PAROLE_VERDETTO = Object.freeze({
  bene: ["Tutto regolare", "All clear"],
  corso: ["In corso", "Running"],
  guarda: ["Da guardare", "Needs a look"],
});

/* Il verdetto di una tessera.
 *
 * L'ordine conta: se c'e' qualcosa da guardare lo si dice, anche se nel
 * frattempo qualcos'altro sta lavorando. Una finestra aperta batte una
 * lavatrice in funzione. */
export function verdettoDellaTessera(tessera, inglese = false) {
  const chiave = tessera?.alert ? "guarda" : tessera?.attiva ? "corso" : "bene";
  const parole = PAROLE_VERDETTO[chiave];
  return { tono: chiave, testo: inglese ? parole[1] : parole[0] };
}

/* Quanto tempo, detto come lo direbbe una persona.
 *
 * «Da 40 minuti», non «da 2400 secondi»; «da un'ora e venti», non «da 80
 * minuti»; e oltre il giorno si smette di contare le ore. Il minuto singolo e
 * l'ora singola hanno la loro forma, che in italiano non e' quella del plurale
 * con l'uno davanti. */
export function daQuanto(minuti, inglese = false) {
  const quanti = Math.max(0, Math.round(Number(minuti) || 0));
  if (quanti < 1) return inglese ? "just now" : "da poco";
  if (quanti < 60)
    return inglese ? `for ${quanti} min` : `da ${quanti} minut${quanti === 1 ? "o" : "i"}`;
  const ore = Math.floor(quanti / 60);
  const resto = quanti % 60;
  if (ore < 24) {
    if (!resto) return inglese ? `for ${ore}h` : ore === 1 ? "da un'ora" : `da ${ore} ore`;
    if (inglese) return `for ${ore}h ${resto}m`;
    const testaOre = ore === 1 ? "un'ora" : `${ore} ore`;
    return `da ${testaOre} e ${resto}`;
  }
  const giorni = Math.floor(ore / 24);
  return inglese
    ? `for ${giorni} day${giorni === 1 ? "" : "s"}`
    : `da ${giorni} giorn${giorni === 1 ? "o" : "i"}`;
}

/* Il numero come si scrive qui: virgola decimale in italiano, punto in
 * inglese, e il punto delle migliaia solo dove serve. */
export function numero(valore, decimali = 0, inglese = false) {
  const n = Number(valore);
  if (!Number.isFinite(n)) return "—";
  const testo = n.toLocaleString(inglese ? "en-US" : "it-IT", {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  });
  return testo;
}

const conta = (righe, prova) => (Array.isArray(righe) ? righe.filter(prova).length : 0);
const acceso = (riga) => Boolean(riga?.on);
const numeriDi = (righe, campo) =>
  (Array.isArray(righe) ? righe : [])
    .map((riga) => Number(riga?.[campo]))
    .filter((valore) => Number.isFinite(valore));
const media = (valori) =>
  valori.length ? valori.reduce((somma, valore) => somma + valore, 0) / valori.length : null;

/* Il nome della prima riga che conta, per poterla nominare nella frase: «il
 * salotto e' a un decimo dall'obiettivo» dice piu' di «una zona». */
const nomeDi = (riga) => String(riga?.name || "").trim();

/* ─────────────────────────── le frasi, una per sezione ───────────────────── */

const FRASI = Object.freeze({
  luci: (t, righe, ing) => {
    const accese = conta(righe, acceso);
    if (!accese) return ing ? "Every light is off." : "Sono tutte spente.";
    const nomi = righe.filter(acceso).map(nomeDi).filter(Boolean);
    const elenco = nomi.slice(0, 2).join(ing ? " and " : " e ");
    if (accese === 1) return ing ? `${elenco} is the only one on.` : `${elenco} e' l'unica accesa.`;
    return ing
      ? `${accese} lights on out of ${righe.length}: ${elenco}${nomi.length > 2 ? " and others" : ""}.`
      : `${accese} luci accese su ${righe.length}: ${elenco}${nomi.length > 2 ? " e altre" : ""}.`;
  },
  clima: (t, righe, ing) => {
    const accese = conta(righe, acceso);
    if (!accese) return ing ? "Every zone is off." : "Sono tutte spente.";
    const ambiente = media(numeriDi(righe.filter(acceso), "ambient"));
    const obiettivo = media(numeriDi(righe.filter(acceso), "target"));
    const testa = ing
      ? `${accese} zone${accese === 1 ? "" : "s"} on out of ${righe.length}.`
      : `${accese} zon${accese === 1 ? "a accesa" : "e accese"} su ${righe.length}.`;
    if (ambiente == null || obiettivo == null) return testa;
    const scarto = Math.abs(obiettivo - ambiente);
    if (scarto < 0.15)
      return ing ? `${testa} Already at target.` : `${testa} Sono gia' all'obiettivo.`;
    return ing
      ? `${testa} ${numero(scarto, 1, ing)}° to go.`
      : `${testa} Manca${scarto < 1 ? "" : "no"} ${numero(scarto, 1, ing)}° all'obiettivo.`;
  },
  tapparelle: (t, righe, ing) => {
    const aperte = conta(righe, (riga) => Number(riga?.position) > 0);
    if (!aperte) return ing ? "All shutters are down." : "Sono tutte chiuse.";
    if (aperte === righe.length) return ing ? "All shutters are up." : "Sono tutte aperte.";
    return ing
      ? `${aperte} of ${righe.length} are up.`
      : `${aperte} aperte su ${righe.length}, le altre chiuse.`;
  },
  aperture: (t, righe, ing) => {
    const aperte = righe.filter(acceso);
    if (!aperte.length) return ing ? "Everything is closed." : "E' tutto chiuso.";
    const nomi = aperte.map(nomeDi).filter(Boolean);
    const elenco = nomi.slice(0, 2).join(ing ? " and " : " e ");
    return ing
      ? `${aperte.length} open out of ${righe.length}: ${elenco}${nomi.length > 2 ? " and others" : ""}.`
      : `${aperte.length} apert${aperte.length === 1 ? "a" : "e"} su ${righe.length}: ${elenco}${nomi.length > 2 ? " e altre" : ""}.`;
  },
  batterie: (t, righe, ing) => {
    const livelli = numeriDi(righe, "level");
    if (!livelli.length) return ing ? "No battery is reporting." : "Nessuna batteria risponde.";
    const piuBassa = Math.min(...livelli);
    const quale = righe.find((riga) => Number(riga?.level) === piuBassa);
    const nome = nomeDi(quale);
    return ing
      ? `The lowest is ${nome || "one sensor"} at ${numero(piuBassa, 0, ing)}%, out of ${livelli.length}.`
      : `La piu' bassa e' ${nome || "un sensore"} al ${numero(piuBassa, 0, ing)}%, su ${livelli.length}.`;
  },
  allagamenti: (t, righe, ing) => {
    const bagnate = conta(righe, acceso);
    if (!bagnate)
      return ing
        ? `No leak. All ${righe.length} probes have answered.`
        : `Nessuna perdita. Tutte e ${righe.length} le sonde hanno risposto.`;
    const nomi = righe
      .filter(acceso)
      .map(nomeDi)
      .filter(Boolean)
      .slice(0, 2)
      .join(ing ? " and " : " e ");
    return ing ? `Water at ${nomi}.` : `C'e' acqua: ${nomi}.`;
  },
  todo: (t, righe, ing) => {
    const quante = Array.isArray(righe) ? righe.length : 0;
    if (!quante) return ing ? "Nothing left to do." : "Non c'e' niente da fare.";
    return ing
      ? `${quante} thing${quante === 1 ? "" : "s"} still to do.`
      : `${quante} cos${quante === 1 ? "a" : "e"} ancora da fare.`;
  },
});

/* La frase di una tessera.
 *
 * Le sezioni che non hanno una frase loro cadono su una che vale sempre: dice
 * quante cose ci sono e quante ne stanno lavorando, che e' comunque piu' di un
 * elenco muto. Una sezione senza niente dentro lo dice, invece di far vedere
 * un vuoto. */
export function fraseDellaTessera(tessera, inglese = false) {
  const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
  const suMisura = FRASI[tessera?.key];
  if (suMisura) return suMisura(null, righe, inglese);
  if (!righe.length)
    return inglese ? "Nothing configured here yet." : "Qui non c'e' ancora niente.";
  const attive = conta(righe, acceso);
  if (!attive)
    return inglese
      ? `${righe.length} thing${righe.length === 1 ? "" : "s"}, none running.`
      : `${righe.length} cos${righe.length === 1 ? "a" : "e"}, nessuna in funzione.`;
  return inglese
    ? `${attive} of ${righe.length} running.`
    : `${attive} su ${righe.length} in funzione.`;
}

/* La briciola sotto il titolo: di cosa parla questa sezione, in tre parole.
 *
 * Nel progetto sta sotto il nome, in maiuscoletto — «CIRCUITO PRIMARIO ·
 * BOILER · RICIRCOLO SANITARIO» — e serve a dire subito cosa ci si trova
 * dentro, prima ancora di leggere i numeri. */
const BRICIOLE = Object.freeze({
  todo: [
    ["Promemoria", "Scadenze", "Note"],
    ["Reminders", "Due dates", "Notes"],
  ],
  luci: [
    ["Accese", "Stanze", "Gruppi"],
    ["On", "Rooms", "Groups"],
  ],
  clima: [
    ["Riscaldamento", "Raffrescamento", "Zone"],
    ["Heating", "Cooling", "Zones"],
  ],
  tapparelle: [
    ["Posizione", "Finestre", "Gruppi"],
    ["Position", "Windows", "Groups"],
  ],
  sicurezza: [
    ["Antifurto", "Zone", "Ingressi"],
    ["Alarm", "Zones", "Entries"],
  ],
  telecamere: [
    ["Riprese", "Movimento", "Archivio"],
    ["Feeds", "Motion", "Archive"],
  ],
  energia: [
    ["Produzione", "Consumi", "Report"],
    ["Production", "Use", "Report"],
  ],
  elettrodomestici: [
    ["Cicli", "Consumi", "Stato"],
    ["Cycles", "Use", "State"],
  ],
  temperatura: [
    ["Stanze", "Umidita'", "Andamento"],
    ["Rooms", "Humidity", "Trend"],
  ],
  ev: [
    ["Carica", "Autonomia", "Wallbox"],
    ["Charge", "Range", "Wallbox"],
  ],
  robot: [
    ["Pulizia", "Mappa", "Batteria"],
    ["Cleaning", "Map", "Battery"],
  ],
  solare: [
    ["Circuito primario", "Boiler", "Ricircolo sanitario"],
    ["Primary loop", "Tank", "Recirculation"],
  ],
  piscina: [
    ["Qualita' dell'acqua", "Filtrazione", "Riscaldamento"],
    ["Water quality", "Filtering", "Heating"],
  ],
  irrigazione: [
    ["Zone", "Programmi", "Pioggia"],
    ["Zones", "Schedules", "Rain"],
  ],
  aperture: [
    ["Porte e finestre", "Sorveglianza"],
    ["Doors and windows", "Watch"],
  ],
  batterie: [
    ["Livelli", "Soglie", "Autonomia"],
    ["Levels", "Thresholds", "Runtime"],
  ],
  allagamenti: [
    ["Sonde", "Perdite", "Controllo"],
    ["Probes", "Leaks", "Checks"],
  ],
});

export function bricioleDellaSezione(chiave, inglese = false) {
  const voce = BRICIOLE[String(chiave || "").replace(/^custom-.*/, "")];
  if (!voce) return [];
  return voce[inglese ? 1 : 0];
}
