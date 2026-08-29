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

/* La lingua non e' «italiano o inglese».
 *
 * Prima queste funzioni prendevano un booleano `inglese`: vero l'inglese,
 * falso l'italiano. Ma le lingue della plancia sono quindici, e per tutte le
 * altre quel booleano era falso — cioe' uno spagnolo si trovava «Tutto
 * regolare» in mezzo a comandi tradotti. Adesso si passa la funzione che
 * traduce, la stessa del resto della plancia: chi non ha la sua parola nel
 * catalogo vede l'inglese, che e' il ripiego dichiarato del progetto, non
 * l'italiano. */
const IN_ITALIANO = (italiano) => italiano;

const PAROLE_VERDETTO = Object.freeze({
  bene: ["Tutto regolare", "All clear"],
  corso: ["In corso", "Running"],
  guarda: ["Da guardare", "Needs a look"],
});

/* La parola che accompagna un tono.
 *
 * Serve a chi il tono lo decide altrove: il motore di analisi puo' dire «da
 * guardare» per una piscina col pH fuori norma, dove il conteggio delle righe
 * direbbe «tutto regolare» perche' non c'e' niente di acceso. La pillola
 * dev'essere quella del tono vero, non quella del conteggio. */
export function parolaDelVerdetto(tono, traduci = IN_ITALIANO) {
  const parole = PAROLE_VERDETTO[tono] || PAROLE_VERDETTO.bene;
  return traduci(parole[0], parole[1]);
}

/* Il verdetto di una tessera.
 *
 * L'ordine conta: se c'e' qualcosa da guardare lo si dice, anche se nel
 * frattempo qualcos'altro sta lavorando. Una finestra aperta batte una
 * lavatrice in funzione. */
export function verdettoDellaTessera(tessera, traduci = IN_ITALIANO) {
  const chiave = tessera?.alert ? "guarda" : tesseraInMoto(tessera) ? "corso" : "bene";
  const parole = PAROLE_VERDETTO[chiave];
  return { tono: chiave, testo: traduci(parole[0], parole[1]) };
}

/* Quando una tessera sta lavorando.
 *
 * La regola e' quella della tessera stessa — `tesseraAccesa` — e va detta uguale
 * qui, se no la finestra contraddice la mattonella da cui si e' arrivati: luci,
 * clima, tapparelle ed elettrodomestici non scrivono `attiva`, e dicono di
 * essere in moto con l'anello acceso. Senza guardarlo, aprire una casa con
 * mezze luci accese dava «tutto regolare». */
export function tesseraInMoto(tessera) {
  if (typeof tessera?.attiva === "boolean") return tessera.attiva;
  return Number(tessera?.ring) > 0;
}

/* Quanto tempo, detto come lo direbbe una persona.
 *
 * «Da 40 minuti», non «da 2400 secondi»; «da un'ora e venti», non «da 80
 * minuti»; e oltre il giorno si smette di contare le ore. Il minuto singolo e
 * l'ora singola hanno la loro forma, che in italiano non e' quella del plurale
 * con l'uno davanti. */
export function daQuanto(minuti, traduci = IN_ITALIANO) {
  const quanti = Math.max(0, Math.round(Number(minuti) || 0));
  if (quanti < 1) return traduci("da poco", "just now");
  if (quanti < 60)
    return traduci(`da ${quanti} minut${quanti === 1 ? "o" : "i"}`, `for ${quanti} min`);
  const ore = Math.floor(quanti / 60);
  const resto = quanti % 60;
  if (ore < 24) {
    if (!resto) return traduci(ore === 1 ? "da un'ora" : `da ${ore} ore`, `for ${ore}h`);
    const testaOre = ore === 1 ? "un'ora" : `${ore} ore`;
    return traduci(`da ${testaOre} e ${resto}`, `for ${ore}h ${resto}m`);
  }
  const giorni = Math.floor(ore / 24);
  return traduci(
    `da ${giorni} giorn${giorni === 1 ? "o" : "i"}`,
    `for ${giorni} day${giorni === 1 ? "" : "s"}`,
  );
}

/* Lo stesso tempo, ma davanti invece che dietro.
 *
 * `daQuanto` porta la preposizione dentro — «da 40 minuti» — perche' quasi
 * sempre si racconta qualcosa che dura da un po'. Per una previsione la
 * preposizione e' un'altra: «fra un'ora e venti». Tenere due funzioni invece di
 * incollare le parole a mano evita il difetto che questa e' nata per togliere:
 * «La pompa gira da da 40 minuti», che e' quello che usciva incollando. */
export function fraQuanto(minuti, traduci = IN_ITALIANO) {
  const quanti = Math.max(0, Math.round(Number(minuti) || 0));
  if (quanti < 1) return traduci("a momenti", "any moment");
  if (quanti < 60)
    return traduci(`fra ${quanti} minut${quanti === 1 ? "o" : "i"}`, `in ${quanti} min`);
  const ore = Math.floor(quanti / 60);
  const resto = quanti % 60;
  if (ore < 24) {
    if (!resto) return traduci(ore === 1 ? "fra un'ora" : `fra ${ore} ore`, `in ${ore}h`);
    const testaOre = ore === 1 ? "un'ora" : `${ore} ore`;
    return traduci(`fra ${testaOre} e ${resto}`, `in ${ore}h ${resto}m`);
  }
  const giorni = Math.floor(ore / 24);
  return traduci(
    `fra ${giorni} giorn${giorni === 1 ? "o" : "i"}`,
    `in ${giorni} day${giorni === 1 ? "" : "s"}`,
  );
}

/* Il numero come si scrive qui: virgola decimale in italiano, punto in
 * inglese, e il punto delle migliaia solo dove serve. */
export function numero(valore, decimali = 0, lingua = "it-IT") {
  const n = Number(valore);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(lingua, {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  });
}

const conta = (righe, prova) => (Array.isArray(righe) ? righe.filter(prova).length : 0);

/* Quando una riga sta lavorando.
 *
 * Non tutte lo dicono con `on`. Un elettrodomestico dice `mode: "running"`, una
 * tapparella dice `open`, un aspirapolvere dice il suo stato. Guardando solo
 * `on` una lavastoviglie in funzione risultava ferma, e la frase diceva
 * «nessuna in funzione» mentre la tessera accanto era accesa. */
const MODI_IN_MOTO = new Set([
  "running",
  "cleaning",
  "on",
  "heat",
  "cool",
  "heat_cool",
  "auto",
  "dry",
  "fan_only",
  "open",
  "opening",
  "returning",
  "charging",
  "washing",
  "drying",
]);
const acceso = (riga) => {
  if (typeof riga?.on === "boolean") return riga.on;
  if (typeof riga?.open === "boolean") return riga.open;
  const modo = String(riga?.mode ?? riga?.state ?? "")
    .trim()
    .toLowerCase();
  return modo ? MODI_IN_MOTO.has(modo) : false;
};
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
  luci: (tr, righe) => {
    const accese = conta(righe, acceso);
    if (!accese) return tr("Sono tutte spente.", "Every light is off.");
    const nomi = righe.filter(acceso).map(nomeDi).filter(Boolean);
    const elenco = nomi.slice(0, 2).join(tr(" e ", " and "));
    if (accese === 1) return tr(`${elenco} e' l'unica accesa.`, `${elenco} is the only one on.`);
    const altre = nomi.length > 2 ? tr(" e altre", " and others") : "";
    return tr(
      `${accese} luci accese su ${righe.length}: ${elenco}${altre}.`,
      `${accese} lights on out of ${righe.length}: ${elenco}${altre}.`,
    );
  },
  clima: (tr, righe) => {
    const accese = conta(righe, acceso);
    if (!accese) return tr("Sono tutte spente.", "Every zone is off.");
    const ambiente = media(numeriDi(righe.filter(acceso), "ambient"));
    const obiettivo = media(numeriDi(righe.filter(acceso), "target"));
    const testa = tr(
      `${accese} zon${accese === 1 ? "a accesa" : "e accese"} su ${righe.length}.`,
      `${accese} zone${accese === 1 ? "" : "s"} on out of ${righe.length}.`,
    );
    if (ambiente == null || obiettivo == null) return testa;
    const scarto = Math.abs(obiettivo - ambiente);
    if (scarto < 0.15)
      return tr(`${testa} Sono gia' all'obiettivo.`, `${testa} Already at target.`);
    return tr(
      `${testa} Manca${scarto < 1 ? "" : "no"} ${numero(scarto, 1)}° all'obiettivo.`,
      `${testa} ${numero(scarto, 1, "en-US")}° to go.`,
    );
  },
  /* Una tapparella dice di essere aperta con `open`, non con la posizione: il
   * contatto di una finestra la posizione non ce l'ha, e quella dietro un rele'
   * nemmeno. Contando la posizione, `Number(null)` fa zero e una finestra
   * spalancata risultava chiusa. */
  tapparelle: (tr, righe) => {
    const aperte = conta(righe, (riga) =>
      typeof riga?.open === "boolean" ? riga.open : Number(riga?.position) > 0,
    );
    if (!aperte) return tr("Sono tutte chiuse.", "All shutters are down.");
    if (aperte === righe.length) return tr("Sono tutte aperte.", "All shutters are up.");
    return tr(
      `${aperte} aperte su ${righe.length}, le altre chiuse.`,
      `${aperte} of ${righe.length} are up.`,
    );
  },
  /* «La finestra della cucina e' aperta da 14 minuti»: il progetto chiede di
   * dire da quanto, e per un contatto lo si puo' dire senza inventarlo — Home
   * Assistant sa da quando sta cosi', e quel momento cambia solo quando la
   * finestra si apre o si chiude. */
  aperture: (tr, righe, _tessera, adesso = Date.now()) => {
    const aperte = righe.filter(acceso);
    if (!aperte.length) return tr("E' tutto chiuso.", "Everything is closed.");
    const nomi = aperte.map(nomeDi).filter(Boolean);
    const elenco = nomi.slice(0, 2).join(tr(" e ", " and "));
    const altre = nomi.length > 2 ? tr(" e altre", " and others") : "";
    const testa = tr(
      `${aperte.length} apert${aperte.length === 1 ? "a" : "e"} su ${righe.length}: ${elenco}${altre}.`,
      `${aperte.length} open out of ${righe.length}: ${elenco}${altre}.`,
    );
    const momenti = aperte
      .map((riga) => Number(riga?.daQuando))
      .filter((quando) => Number.isFinite(quando) && quando <= adesso);
    if (!momenti.length) return testa;
    // la piu' vecchia: e' quella che conta se qualcuno se n'e' dimenticata
    const quanto = daQuanto((adesso - Math.min(...momenti)) / 60000, tr);
    return tr(`${testa} La piu' vecchia ${quanto}.`, `${testa} The oldest one ${quanto}.`);
  },
  batterie: (tr, righe) => {
    const livelli = numeriDi(righe, "level");
    if (!livelli.length) return tr("Nessuna batteria risponde.", "No battery is reporting.");
    const piuBassa = Math.min(...livelli);
    const quale = righe.find((riga) => Number(riga?.level) === piuBassa);
    const nome = nomeDi(quale);
    return tr(
      `La piu' bassa e' ${nome || "un sensore"} al ${numero(piuBassa, 0)}%, su ${livelli.length}.`,
      `The lowest is ${nome || "one sensor"} at ${numero(piuBassa, 0, "en-US")}%, out of ${livelli.length}.`,
    );
  },
  allagamenti: (tr, righe) => {
    const bagnate = conta(righe, acceso);
    if (!bagnate)
      return tr(
        `Nessuna perdita. Tutte e ${righe.length} le sonde hanno risposto.`,
        `No leak. All ${righe.length} probes have answered.`,
      );
    const nomi = righe
      .filter(acceso)
      .map(nomeDi)
      .filter(Boolean)
      .slice(0, 2)
      .join(tr(" e ", " and "));
    return tr(`C'e' acqua: ${nomi}.`, `Water at ${nomi}.`);
  },
  /* Le cose da fare non stanno in `rows`: quella tessera tiene le liste in
   * `blocks`, e contando le righe usciva sempre zero — «non c'e' niente da
   * fare» anche col numero della mattonella a tre. Si contano le voci ancora
   * aperte, che e' quello che il numero grande dice gia'. */
  todo: (tr, _righe, tessera) => {
    const quante = vociDaFare(tessera);
    if (!quante) return tr("Non c'e' niente da fare.", "Nothing left to do.");
    return tr(
      `${quante} cos${quante === 1 ? "a" : "e"} ancora da fare.`,
      `${quante} thing${quante === 1 ? "" : "s"} still to do.`,
    );
  },
});

/* La frase di una tessera.
 *
 * Le sezioni che non hanno una frase loro cadono su una che vale sempre: dice
 * quante cose ci sono e quante ne stanno lavorando, che e' comunque piu' di un
 * elenco muto. Una sezione senza niente dentro lo dice, invece di far vedere
 * un vuoto. */
/* Quante cose restano da fare, prese da dove stanno davvero. */
function vociDaFare(tessera) {
  const blocchi = Array.isArray(tessera?.blocks) ? tessera.blocks : [];
  if (blocchi.length) {
    return blocchi.reduce(
      (somma, blocco) =>
        somma +
        (Array.isArray(blocco?.items) ? blocco.items : []).filter(
          (voce) => String(voce?.status || "").toLowerCase() !== "completed",
        ).length,
      0,
    );
  }
  const dallaMattonella = Number(tessera?.value);
  return Number.isFinite(dallaMattonella) ? dallaMattonella : 0;
}

export function fraseDellaTessera(tessera, traduci = IN_ITALIANO, adesso = Date.now()) {
  const righe = Array.isArray(tessera?.rows) ? tessera.rows : [];
  const suMisura = FRASI[tessera?.key];
  if (suMisura) return suMisura(traduci, righe, tessera, adesso);
  if (!righe.length) return traduci("Qui non c'e' ancora niente.", "Nothing configured here yet.");
  const attive = conta(righe, acceso);
  if (!attive)
    return traduci(
      `${righe.length} cos${righe.length === 1 ? "a" : "e"}, nessuna in funzione.`,
      `${righe.length} thing${righe.length === 1 ? "" : "s"}, none running.`,
    );
  return traduci(
    `${attive} su ${righe.length} in funzione.`,
    `${attive} of ${righe.length} running.`,
  );
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

export function bricioleDellaSezione(chiave, traduci = IN_ITALIANO) {
  const voce = BRICIOLE[String(chiave || "").replace(/^custom-.*/, "")];
  if (!voce) return [];
  return voce[0].map((parola, posto) => traduci(parola, voce[1][posto] ?? parola));
}
