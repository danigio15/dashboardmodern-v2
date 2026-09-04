/* La raccolta differenziata (#293).
 *
 * «Sarebbe carino anche integrare un sistema per la raccolta differenziata
 * rifiuti.»
 *
 * La domanda della sera e' una: cosa metto fuori stasera? E la risposta sta
 * gia' in Home Assistant, nei dialetti delle integrazioni che la portano — un
 * sensore per materiale con la data del prossimo ritiro, o un calendario con
 * un evento per giorno. Questo modulo sa leggere quelle date come le scrivono
 * tutti (una data ISO, «domani», «in 3 giorni», un attributo `date`, un
 * `start_time` di calendario) e ridurle a quello che serve: fra quanti giorni,
 * e quindi che parola dire.
 *
 * I giorni si contano sul calendario, non sui millisecondi: un ritiro alle
 * sei del mattino di domani e' «domani» anche alle undici di sera, e nel
 * giorno in cui cambia l'ora sottrarre ventiquattr'ore sbaglia di uno.
 *
 * E' puro: entrano la configurazione e gli stati, esce la lettura. Le parole
 * per dirlo a schermo stanno nella sezione.
 */

const pulito = (valore) => String(valore ?? "").trim();
/* Gli stati con cui Home Assistant dice «non lo so»: chi li porta non risponde. */
const STATI_MUTI = /^(unknown|unavailable|none|)$/i;
const minuscolo = (valore) => pulito(valore).toLowerCase();

/** La chiave in cui vive la configurazione. */
export const CHIAVE_RIFIUTI = "cd_rifiuti";

/* Un tetto alle righe: dodici materiali sono gia' piu' di quanti ne separi
 * qualunque comune, e una pagina che scorre all'infinito non aiuta. */
export const MASSIMO_RIGHE = 12;

/* I materiali che si conoscono, ciascuno col suo colore e il suo simbolo: sono
 * i colori dei bidoni, quelli che uno ha gia' in testa. Le parole per dirli
 * stanno nella sezione. */
export const MATERIALI = Object.freeze([
  Object.freeze({ chiave: "plastica", icona: "🧴", colore: "#eab308" }),
  Object.freeze({ chiave: "carta", icona: "📦", colore: "#3b82f6" }),
  Object.freeze({ chiave: "vetro", icona: "🍾", colore: "#22c55e" }),
  Object.freeze({ chiave: "organico", icona: "🍎", colore: "#a16207" }),
  Object.freeze({ chiave: "indifferenziato", icona: "🗑️", colore: "#64748b" }),
  Object.freeze({ chiave: "metalli", icona: "🥫", colore: "#94a3b8" }),
  Object.freeze({ chiave: "verde", icona: "🌿", colore: "#16a34a" }),
  Object.freeze({ chiave: "ingombranti", icona: "🛋️", colore: "#8b5cf6" }),
  Object.freeze({ chiave: "oli", icona: "🛢️", colore: "#f97316" }),
  Object.freeze({ chiave: "pannolini", icona: "🧷", colore: "#ec4899" }),
  Object.freeze({ chiave: "altro", icona: "♻️", colore: "#0ea5e9" }),
]);

export function materialeDiSerie(chiave) {
  return (
    MATERIALI.find((voce) => voce.chiave === pulito(chiave)) || MATERIALI[MATERIALI.length - 1]
  );
}

/* Indovina il materiale da un testo libero: il nome di un evento del
 * calendario («Raccolta plastica e lattine»), o quello scritto da chi
 * configura. Serve a dare un colore e un simbolo a una riga che non li ha. */
const INDIZI = Object.freeze([
  ["plastica", /plastic|imballagg/],
  ["carta", /carta|cartone|paper|cardboard/],
  ["vetro", /vetro|glass/],
  ["organico", /organic|umido|bio|food|compost/],
  ["indifferenziato", /indifferenziat|secco|residu|general|restm|rest\b|non ricicl/],
  ["metalli", /metal|lattin|alluminio|aluminium|can\b|cans\b/],
  ["verde", /verde|sfalci|garden|green|ramagli|potatur/],
  ["ingombranti", /ingombrant|bulky/],
  ["oli", /\boli[oi]?\b|oil/],
  ["pannolini", /pannolin|diaper|nappy/],
]);

export function materialeDalNome(testo) {
  const voce = minuscolo(testo);
  if (!voce) return "altro";
  for (const [chiave, prova] of INDIZI) if (prova.test(voce)) return chiave;
  return "altro";
}

function normalizzaRiga(riga, indice) {
  if (!riga || typeof riga !== "object") return null;
  const materiale = materialeDiSerie(
    riga.materiale || riga.material || materialeDalNome(riga.nome),
  );
  const entity = pulito(riga.entity);
  const nome = pulito(riga.nome ?? riga.name);
  /* Una riga vuota del tutto non e' una riga: chi ha premuto «Aggiungi» e
   * non ha scritto niente non deve ritrovarsela salvata. Ma una riga con il
   * solo materiale scelto resta: e' il primo momento di ogni riga. */
  if (!entity && !nome && !pulito(riga.materiale || riga.material)) return null;
  return {
    id: pulito(riga.id) || `riga-${indice + 1}`,
    materiale: materiale.chiave,
    nome,
    icona: pulito(riga.icona ?? riga.icon) || materiale.icona,
    colore: pulito(riga.colore ?? riga.color) || materiale.colore,
    entity,
  };
}

/** La configurazione, ripulita. */
export function normalizzaRifiuti(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const righe = (Array.isArray(dato.righe) ? dato.righe : Array.isArray(dato.rows) ? dato.rows : [])
    .map(normalizzaRiga)
    .filter(Boolean)
    .slice(0, MASSIMO_RIGHE);
  return { calendario: pulito(dato.calendario), righe };
}

/** Le righe con un'entita' dietro: quelle che si possono leggere. */
export function righeConfigurate(config) {
  return normalizzaRifiuti(config).righe.filter((riga) => riga.entity.includes("."));
}

/** Se c'e' qualcosa da leggere: una riga con la sua entita', o il calendario. */
export function rifiutiConfigurati(config) {
  const dato = normalizzaRifiuti(config);
  return righeConfigurate(dato).length > 0 || dato.calendario.includes(".");
}

/** Tutte le entita' nominate, senza doppioni. */
export function entitaDeiRifiuti(config) {
  const dato = normalizzaRifiuti(config);
  const viste = new Set();
  for (const riga of dato.righe) if (riga.entity.includes(".")) viste.add(riga.entity);
  if (dato.calendario.includes(".")) viste.add(dato.calendario);
  return [...viste];
}

/* ── le date, nei dialetti in cui le scrivono ────────────────────────── */

/** La mezzanotte locale di un istante. */
export function inizioDelGiorno(istante) {
  const quando = istante instanceof Date ? istante : new Date(istante);
  return new Date(quando.getFullYear(), quando.getMonth(), quando.getDate());
}

/** I giorni di calendario fra due istanti, nel fuso di chi guarda. */
export function giorniFra(da, a) {
  const uno = inizioDelGiorno(da);
  const due = inizioDelGiorno(a);
  /* Il conto in UTC toglie di mezzo il giorno da 23 o 25 ore. */
  const utcUno = Date.UTC(uno.getFullYear(), uno.getMonth(), uno.getDate());
  const utcDue = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((utcDue - utcUno) / 86400000);
}

/**
 * Una data scritta come la scrivono le integrazioni: `2026-09-05`,
 * `2026-09-05 06:00:00`, `2026-09-05T06:00:00+02:00`, `05/09/2026`.
 * Torna `null` per tutto il resto: un numero non e' una data.
 */
export function leggiData(testo, { giornoIntero = false } = {}) {
  const voce = pulito(testo);
  if (!voce) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(voce);
  if (m) {
    /* Con l'ora e il fuso si lascia fare a `Date`; senza fuso la data e'
     * locale, che e' quello che intende chi la scrive.
     *
     * Un evento di tutto il giorno pero' non e' un istante: e' una casella
     * sul calendario, e il fuso scritto accanto non la sposta. Home Assistant
     * lo scrive «2026-09-04T00:00:00+02:00», e chi guardava da un fuso piu'
     * indietro se lo vedeva diventare il 3: il ritiro di oggi finiva nel
     * passato, spariva dal conto e la tessera restava con un trattino il
     * giorno stesso in cui il bidone andava messo fuori (#309). */
    if (!giornoIntero && /[+-]\d{2}:?\d{2}$|Z$/.test(voce) && m[4]) {
      const assoluta = new Date(voce);
      return Number.isFinite(assoluta.getTime()) ? assoluta : null;
    }
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(voce);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

/* Le parole che dicono fra quanto: «domani», «in 3 giorni», «today». */
const FRA_GIORNI = /^(?:in|fra|tra)\s+(\d+)\s+(?:giorn[oi]|days?|d)$/;

function giorniDalleParole(testo) {
  const voce = minuscolo(testo);
  if (!voce) return null;
  if (/^(oggi|today|heute|hoy|aujourd'hui)$/.test(voce)) return 0;
  if (/^(domani|tomorrow|morgen|mañana|demain)$/.test(voce)) return 1;
  if (/^(dopodomani|day after tomorrow|übermorgen)$/.test(voce)) return 2;
  const m = FRA_GIORNI.exec(voce);
  return m ? Number(m[1]) : null;
}

/**
 * La data del prossimo ritiro, da uno stato qualunque.
 *
 * Si guarda prima negli attributi — e' li' che le integrazioni mettono la
 * data vera, mentre lo stato spesso e' una frase — poi nello stato stesso.
 * I giorni contati («daysTo», «in 2 giorni») si sommano a oggi.
 */
export function dataDelRitiro(stato, adesso = Date.now()) {
  if (!stato) return null;
  const attributi = stato.attributes || {};
  /* `all_day` lo dichiara Home Assistant sui calendari; per gli altri lo dice
   * la forma, che e' una mezzanotte tonda. */
  const giornoIntero =
    attributi.all_day === true ||
    attributi.all_day === "true" ||
    /T00:00:00([+-]\d{2}:?\d{2}|Z)$/.test(pulito(attributi.start_time || attributi.start));
  for (const nome of [
    "date",
    "next_date",
    "next_collection",
    "next_collection_date",
    "collection_date",
    "next",
    "due_date",
    "due",
    "start_time",
    "start",
  ]) {
    const data = leggiData(attributi[nome], { giornoIntero });
    if (!data) continue;
    /* Un evento gia' cominciato e non ancora finito e' il ritiro di adesso.
     * Un ritiro che dura da ieri a domani — capita coi calendari scritti a
     * mano — partiva ieri, e ieri e' passato: la riga finiva fra le scadute e
     * la tessera diceva «nessuna data in vista» mentre il bidone era fuori. */
    const fine = leggiData(attributi.end_time || attributi.end, { giornoIntero });
    if (fine && data.getTime() <= adesso && adesso < fine.getTime()) return inizioDelGiorno(adesso);
    return data;
  }
  for (const nome of ["daysTo", "days_to", "days", "giorni"]) {
    const n = Number(attributi[nome]);
    if (attributi[nome] !== undefined && attributi[nome] !== null && Number.isFinite(n))
      return new Date(inizioDelGiorno(adesso).getTime() + n * 86400000 + 12 * 3600000);
  }
  const grezzo = pulito(stato.state);
  const dallaData = leggiData(grezzo);
  if (dallaData) return dallaData;
  const dalleParole = giorniDalleParole(grezzo);
  if (dalleParole !== null)
    return new Date(inizioDelGiorno(adesso).getTime() + dalleParole * 86400000 + 12 * 3600000);
  /* Un numero secco e' «fra N giorni» solo se l'unita' lo dice: senza, potrebbe
   * essere qualunque cosa. */
  const unita = minuscolo(attributi.unit_of_measurement);
  const n = Number(grezzo);
  if (grezzo !== "" && Number.isFinite(n) && /^(d|days?|giorn[oi]|tage?)$/.test(unita))
    return new Date(inizioDelGiorno(adesso).getTime() + n * 86400000 + 12 * 3600000);
  return null;
}

/** La parola giusta per «fra N giorni». */
export function quandoCodice(giorni) {
  if (giorni === null || giorni === undefined || !Number.isFinite(giorni)) return "mai";
  if (giorni < 0) return "passato";
  if (giorni === 0) return "oggi";
  if (giorni === 1) return "domani";
  if (giorni === 2) return "dopodomani";
  if (giorni < 7) return "giorni";
  return "settimana";
}

/**
 * La lettura di tutti i materiali configurati, adesso.
 *
 * Ogni riga porta la data trovata e i giorni che mancano; le righe si
 * ordinano per urgenza, con chi non ha una data in fondo. `prossimi` sono le
 * righe del primo ritiro che viene — piu' d'una quando escono insieme.
 */
export function letturaRifiuti(
  config,
  states = {},
  resolve = (value) => value,
  adesso = Date.now(),
) {
  const dato = normalizzaRifiuti(config);
  const leggi = (riferimento) => {
    const chiave = pulito(riferimento);
    if (!chiave) return null;
    let entity = chiave;
    try {
      entity = pulito(resolve(chiave)) || chiave;
    } catch (_error) {
      entity = chiave;
    }
    return states?.[entity] || states?.[chiave] || null;
  };
  /* Un'entita' che c'e' ma dice «unknown» o «unavailable» non risponde: e'
   * un'integrazione caduta, non un ritiro senza data. Dirlo come «data non
   * trovata» nascondeva il guasto proprio quando poteva far saltare un
   * ritiro vero. */
  const risponde = (stato) => Boolean(stato) && !STATI_MUTI.test(pulito(stato.state));
  const righe = dato.righe
    .filter((riga) => riga.entity.includes("."))
    .map((riga) => {
      const stato = leggi(riga.entity);
      const data = dataDelRitiro(stato, adesso);
      const giorni = data ? giorniFra(adesso, data) : null;
      return {
        ...riga,
        muto: !risponde(stato),
        data,
        giorni,
        quando: quandoCodice(giorni),
      };
    })
    .sort((a, b) => {
      if (a.giorni === null && b.giorni === null) return 0;
      if (a.giorni === null) return 1;
      if (b.giorni === null) return -1;
      return a.giorni - b.giorni;
    });

  let calendario = null;
  if (dato.calendario.includes(".")) {
    const stato = leggi(dato.calendario);
    const data = dataDelRitiro(stato, adesso);
    const giorni = data ? giorniFra(adesso, data) : null;
    const nome = pulito(stato?.attributes?.message);
    const materiale = materialeDiSerie(materialeDalNome(nome));
    calendario = {
      entity: dato.calendario,
      muto: !risponde(stato),
      nome,
      materiale: materiale.chiave,
      icona: materiale.icona,
      colore: materiale.colore,
      data,
      giorni,
      quando: quandoCodice(giorni),
    };
  }

  const future = righe.filter((riga) => riga.giorni !== null && riga.giorni >= 0);
  /* Il calendario concorre al «prossimo»: se un sensore dice la carta fra
   * sette giorni e il calendario l'umido domani, il prossimo e' l'umido — e la
   * pagina e la tessera lo dicevano della carta. Un evento che ripete una riga,
   * stesso materiale e stesso giorno, non si conta due volte. */
  const candidati = [...future];
  if (
    calendario &&
    calendario.giorni !== null &&
    calendario.giorni >= 0 &&
    !future.some(
      (riga) => riga.materiale === calendario.materiale && riga.giorni === calendario.giorni,
    )
  )
    candidati.push({ ...calendario, id: "calendario", dalCalendario: true });
  candidati.sort((a, b) => a.giorni - b.giorni);
  const primo = candidati.length ? candidati[0].giorni : null;
  return {
    righe,
    calendario,
    prossimi: primo === null ? [] : candidati.filter((riga) => riga.giorni === primo),
    oggi: candidati.filter((riga) => riga.giorni === 0),
    domani: candidati.filter((riga) => riga.giorni === 1),
  };
}
