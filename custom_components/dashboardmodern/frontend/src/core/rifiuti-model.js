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

/** Il materiale scritto negli attributi del sensore, se c'e'; `null` se no. */
export function materialeDalSensore(stato) {
  const attributi = stato?.attributes || {};
  for (const nome of ["types", "waste_type", "waste_types", "type", "fraction", "kind"]) {
    const valore = attributi[nome];
    const testo = Array.isArray(valore) ? valore.join(" ") : pulito(valore);
    if (!testo) continue;
    const chiave = materialeDalNome(testo);
    if (chiave !== "altro") return chiave;
  }
  const nome = pulito(attributi.friendly_name);
  const dalNome = nome ? materialeDalNome(nome) : "altro";
  return dalNome !== "altro" ? dalNome : null;
}

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

/* ── il calendario di casa: due settimane, scritte a mano (#366) ──────── */

/* «Vorrei che ci fosse la possibilita' di un menu a tendina per le 2 settimane
 * cosi uno sceglie il rifiuto, senza dover creare o modificare il calendario
 * di home assistant.»
 *
 * Quasi tutti i comuni girano su due settimane: lunedi' l'organico, martedi'
 * la plastica, e la settimana dopo cambia. Chi ha quel foglietto sul frigo non
 * ha nessun sensore da collegare — e finora la pagina dei rifiuti gli chiedeva
 * di costruirsi un calendario in Home Assistant per scriverci dentro una cosa
 * che sa a memoria.
 *
 * Quattordici caselle, una per giorno, ognuna con i materiali di quel giorno
 * (che possono essere piu' d'uno: capita che escano insieme). Si ripetono a
 * partire da una data, e quella data e' l'unica cosa che serve sapere per dire
 * in che giorno del turno siamo oggi — anche fra tre anni. */
export const GIORNI_DEL_TURNO = 14;

/** Una data come `2026-09-07`, o `""` se non e' una data. */
function dataScritta(valore) {
  const data = leggiData(valore);
  if (!data) return "";
  const due = (numero) => String(numero).padStart(2, "0");
  return `${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}`;
}

/**
 * Il turno, ripulito.
 *
 * Torna sempre quattordici caselle, anche quando ne sono state scritte meno o
 * di piu': chi disegna la griglia non deve difendersi da una configurazione
 * storta. Senza una data d'inizio valida il turno non si puo' collocare nel
 * tempo, e allora non c'e'.
 */
export function normalizzaTurno(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const inizio = dataScritta(dato.inizio ?? dato.start);
  const grezzi = Array.isArray(dato.giorni)
    ? dato.giorni
    : Array.isArray(dato.days)
      ? dato.days
      : [];
  const giorni = [];
  for (let indice = 0; indice < GIORNI_DEL_TURNO; indice += 1) {
    const voce = grezzi[indice];
    const elenco = Array.isArray(voce) ? voce : voce ? [voce] : [];
    const visti = [];
    for (const materiale of elenco) {
      const chiave = pulito(materiale);
      /* Solo i materiali che si conoscono: uno scritto a mano che non esiste
       * diventerebbe «altro» e la casella direbbe il falso. */
      if (!MATERIALI.some((noto) => noto.chiave === chiave)) continue;
      if (!visti.includes(chiave)) visti.push(chiave);
    }
    giorni.push(visti);
  }
  return { inizio, giorni };
}

/** Se il turno dice qualcosa: una data d'inizio e almeno un materiale. */
export function turnoConfigurato(turno) {
  const dato = normalizzaTurno(turno);
  return Boolean(dato.inizio) && dato.giorni.some((giorno) => giorno.length > 0);
}

/**
 * In quale casella del turno cade quel giorno.
 *
 * Il resto della divisione si porta dentro il segno in JavaScript, e un giorno
 * PRIMA dell'inizio darebbe una casella negativa: si rimette dentro. Cosi' il
 * turno vale anche all'indietro — chi scrive come inizio il lunedi' della
 * settimana prossima vede comunque il turno di oggi.
 */
export function caselleDelTurno(turno, quando) {
  const dato = normalizzaTurno(turno);
  if (!dato.inizio) return -1;
  const partenza = leggiData(dato.inizio);
  if (!partenza) return -1;
  const distanza = giorniFra(partenza, quando);
  return ((distanza % GIORNI_DEL_TURNO) + GIORNI_DEL_TURNO) % GIORNI_DEL_TURNO;
}

/**
 * I ritiri che il turno annuncia da oggi in avanti.
 *
 * Si guardano quattordici giorni e non di piu': il turno si ripete, quindi
 * oltre non c'e' niente di nuovo da dire — solo le stesse righe una seconda
 * volta. Ogni materiale esce UNA volta, alla sua prima occasione: un elenco
 * che ripete la plastica fra due giorni e fra nove non risponde alla domanda
 * della sera, la annacqua.
 */
export function ritiriDalTurno(turno, adesso = Date.now()) {
  const dato = normalizzaTurno(turno);
  if (!turnoConfigurato(dato)) return [];
  const oggi = inizioDelGiorno(adesso);
  const visti = new Set();
  const fuori = [];
  for (let avanti = 0; avanti < GIORNI_DEL_TURNO; avanti += 1) {
    const quando = new Date(oggi.getTime() + avanti * 86400000 + 12 * 3600000);
    const casella = caselleDelTurno(dato, quando);
    if (casella < 0) break;
    for (const materiale of dato.giorni[casella]) {
      if (visti.has(materiale)) continue;
      visti.add(materiale);
      const voce = materialeDiSerie(materiale);
      fuori.push({
        id: `turno-${materiale}`,
        materiale: voce.chiave,
        nome: "",
        icona: voce.icona,
        colore: voce.colore,
        entity: "",
        muto: false,
        dalTurno: true,
        data: quando,
        giorni: avanti,
        quando: quandoCodice(avanti),
      });
    }
  }
  return fuori.sort((a, b) => a.giorni - b.giorni);
}

/* ── un sensore solo che porta tutto il calendario (#443) ─────────────── */

/* «Molte integrazioni non forniscono un calendario vero e proprio ma dei
 *  sensori sensor.xxx. Sarebbe bello poterli usare.»
 *
 * Un sensore per materiale la plancia lo legge da sempre: e' la riga, con la
 * sua data. Quello che mancava e' l'altro modo, che in Italia e' il piu'
 * diffuso: UN sensore che porta l'intero elenco dei prossimi ritiri negli
 * attributi — il SAVNO di Conegliano, per dirne uno segnalato dal campo — dove
 * ogni voce ha una data e il nome della frazione.
 *
 * Non si puo' pretendere un dialetto solo, perche' non ce n'e' uno: chi scrive
 * queste integrazioni mette un elenco di oggetti, o un elenco di frasi, o una
 * mappa frazione → data. Qui si accettano tutte e tre, e la regola e' la
 * stessa che vale per le righe: una data la si riconosce nei modi in cui la
 * scrivono tutti, e il materiale lo si indovina dal nome, che e' quello che fa
 * gia' `materialeDalNome` per gli eventi del calendario.
 *
 * Quello che NON si fa e' inventare: una voce da cui non esce una data non
 * diventa una riga muta, sparisce. Un elenco da cui non esce niente lascia il
 * campo al modo di prima — lo stato del sensore letto come data unica — che
 * per molti sensori e' gia' la risposta giusta.
 */

/* Dove le integrazioni tengono l'elenco. Si guardano prima questi nomi e poi
 * tutti gli altri attributi: il nome giusto e' quello che porta delle date. */
const NOMI_DELL_ELENCO = Object.freeze([
  "prossimi_ritiri",
  "ritiri",
  "raccolte",
  "prossime_raccolte",
  "upcoming",
  "collections",
  "next_collections",
  "schedule",
  "events",
  "days",
  "dates",
  "calendar",
]);

/* Dentro una voce dell'elenco: dove sta la data e dove sta la frazione. */
const NOMI_DELLA_DATA = Object.freeze([
  "date",
  "data",
  "day",
  "giorno",
  "start",
  "start_time",
  "next",
  "when",
  "quando",
  "collection_date",
  "pickup_date",
]);

const NOMI_DEL_MATERIALE = Object.freeze([
  "type",
  "tipo",
  "types",
  "waste_type",
  "waste_types",
  "fraction",
  "frazione",
  "name",
  "nome",
  "summary",
  "title",
  "titolo",
  "description",
  "descrizione",
  "text",
]);

const testoDi = (valore) => (Array.isArray(valore) ? valore.join(" ") : pulito(valore));

/* Una voce dell'elenco, comunque sia scritta: torna la data e il testo da cui
 * si indovina il materiale, oppure `null` se una data non c'e'. */
function voceDellElenco(voce) {
  if (voce && typeof voce === "object" && !Array.isArray(voce)) {
    let data = null;
    for (const nome of NOMI_DELLA_DATA) {
      data = leggiData(voce[nome]);
      if (data) break;
    }
    if (!data) return null;
    const parti = NOMI_DEL_MATERIALE.map((nome) => testoDi(voce[nome])).filter(Boolean);
    return { data, testo: parti.join(" ") };
  }
  /* Una frase: «2026-09-11 Plastica», «Plastica: 11/09», «Plastica il 11 set».
   * La data e' il pezzo che si sa leggere; il resto e' il nome. */
  const frase = pulito(voce);
  if (!frase) return null;
  const pezzi = frase.split(/[\s,;:]+/).filter(Boolean);
  for (let quanti = 3; quanti >= 1; quanti -= 1)
    for (let da = 0; da + quanti <= pezzi.length; da += 1) {
      const data = leggiData(pezzi.slice(da, da + quanti).join(" "));
      if (!data) continue;
      const resto = [...pezzi.slice(0, da), ...pezzi.slice(da + quanti)].join(" ");
      return { data, testo: resto || frase };
    }
  return null;
}

/* L'elenco grezzo, da qualunque attributo lo porti: un array di voci, oppure
 * una mappa frazione → data, che si legge come un elenco di coppie. */
function elencoGrezzo(attributi) {
  const nomi = [
    ...NOMI_DELL_ELENCO.filter((nome) => attributi[nome] !== undefined),
    ...Object.keys(attributi).filter((nome) => !NOMI_DELL_ELENCO.includes(nome)),
  ];
  for (const nome of nomi) {
    const valore = attributi[nome];
    if (Array.isArray(valore)) {
      const voci = valore.map(voceDellElenco).filter(Boolean);
      if (voci.length) return voci;
      continue;
    }
    if (valore && typeof valore === "object") {
      const voci = Object.entries(valore)
        .map(([chiave, quando]) => {
          const data = leggiData(quando);
          return data ? { data, testo: chiave } : null;
        })
        .filter(Boolean);
      if (voci.length) return voci;
    }
  }
  return [];
}

/**
 * I ritiri che UN sensore annuncia con tutto il suo elenco.
 *
 * Torna righe della stessa forma di quelle del turno e dei sensori per
 * materiale: chi disegna non deve sapere da dove viene una riga. I ritiri gia'
 * passati restano fuori, e di ogni materiale si tiene la PRIMA occasione — un
 * elenco che ripete la plastica fra due giorni e fra nove non risponde alla
 * domanda della sera, la annacqua.
 */
export function ritiriDaUnElenco(stato, adesso = Date.now()) {
  const attributi = stato?.attributes;
  if (!attributi || typeof attributi !== "object") return [];
  const visti = new Set();
  return elencoGrezzo(attributi)
    .map((voce) => {
      const giorni = giorniFra(adesso, voce.data);
      const materiale = materialeDiSerie(materialeDalNome(voce.testo));
      return { ...voce, giorni, materiale };
    })
    .filter((voce) => voce.giorni >= 0)
    .sort((sinistra, destra) => sinistra.giorni - destra.giorni)
    .filter((voce) => {
      if (visti.has(voce.materiale.chiave)) return false;
      visti.add(voce.materiale.chiave);
      return true;
    })
    .map((voce) => ({
      id: `elenco-${voce.materiale.chiave}`,
      materiale: voce.materiale.chiave,
      /* Il nome scritto dall'integrazione resta solo quando dice qualcosa in
       * piu' del materiale: «Plastica e lattine» si', «plastica» no. */
      nome: materialeDalNome(voce.testo) === "altro" ? pulito(voce.testo) : "",
      icona: voce.materiale.icona,
      colore: voce.materiale.colore,
      entity: "",
      muto: false,
      dallElenco: true,
      data: voce.data,
      giorni: voce.giorni,
      quando: quandoCodice(voce.giorni),
    }));
}

/** La configurazione, ripulita. */
export function normalizzaRifiuti(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const righe = (Array.isArray(dato.righe) ? dato.righe : Array.isArray(dato.rows) ? dato.rows : [])
    .map(normalizzaRiga)
    .filter(Boolean)
    .slice(0, MASSIMO_RIGHE);
  return { calendario: pulito(dato.calendario), righe, turno: normalizzaTurno(dato.turno) };
}

/** Le righe con un'entita' dietro: quelle che si possono leggere. */
export function righeConfigurate(config) {
  return normalizzaRifiuti(config).righe.filter((riga) => riga.entity.includes("."));
}

/** Se c'e' qualcosa da leggere: una riga con la sua entita', o il calendario. */
export function rifiutiConfigurati(config) {
  const dato = normalizzaRifiuti(config);
  /* Il turno di casa conta quanto un sensore: chi ha scritto le due settimane
   * ha configurato i rifiuti, e la pagina non deve continuare a chiedergli
   * un'entita' che non avra' mai (#366). */
  return (
    righeConfigurate(dato).length > 0 ||
    dato.calendario.includes(".") ||
    turnoConfigurato(dato.turno)
  );
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

/* I mesi scritti a parole, nelle sei lingue in cui si conoscono gia' i giorni
 * della settimana. Una data cosi' non la scrive un'integrazione: la scrive chi
 * si e' composto lo stato con un template, e per lui e' una data come le
 * altre. */
const MESI = Object.freeze([
  /^(gen|genn|gennaio|jan|january|januar|januari|ene|enero|janv|janvier)$/,
  /^(feb|febb|febbraio|february|februar|februari|feb|febrero|fevr|février|fevrier)$/,
  /^(mar|marzo|march|märz|marz|maart|marzo|mars)$/,
  /^(apr|aprile|april|abr|abril|avr|avril)$/,
  /^(mag|maggio|may|mai|mei|may|mayo)$/,
  /^(giu|giugno|jun|june|juni|jun|junio|juin)$/,
  /^(lug|luglio|jul|july|juli|jul|julio|juil|juillet)$/,
  /^(ago|agosto|aug|august|augustus|ago|agosto|aout|août)$/,
  /^(set|sett|settembre|sep|sept|september|sep|septiembre|septembre)$/,
  /^(ott|ottobre|oct|october|oktober|okt|oct|octubre|octobre)$/,
  /^(nov|novembre|november|nov|noviembre|novembre)$/,
  /^(dic|dicembre|dec|december|dez|dezember|dic|diciembre|déc|decembre)$/,
]);

const meseDaParola = (parola) => {
  const voce = minuscolo(parola).replace(/\.$/, "");
  if (!voce) return -1;
  return MESI.findIndex((prova) => prova.test(voce));
};

/* Le parole che stanno davanti a una data senza aggiungere niente.
 *
 * «on Fri, 18.09.2026» e' lo stato vero di un sensore di Waste Collection
 * Schedule (#383), ed e' due parole di troppo: la preposizione inglese e il
 * giorno della settimana. Il lettore ne toglieva UNA, e solo se era un giorno
 * — quindi su quella riga si fermava sulla prima parola e falliva tutto,
 * mentre «Fri, 18.09.2026» lo leggeva benissimo.
 *
 * Le preposizioni sono quelle delle lingue in cui si conoscono gia' i giorni.
 * `il` e `al` italiane, `on` e `at` inglesi, `am` tedesca, `el` spagnola, `le`
 * francese, `op` olandese. Nessuna di queste e' un mese ne' un numero, quindi
 * toglierla non puo' mangiare un pezzo di data. */
const PREPOSIZIONI = /^(il|lo|al|del|di|on|at|am|el|le|op|den|op de)$/;

/* Due parole al massimo — una preposizione e un giorno — e mai fino a
 * svuotare la riga: se dopo aver tolto non resta una cifra, non era una data
 * con qualcosa davanti, era un'altra cosa e va lasciata com'e'. */
const PAROLE_DA_TOGLIERE = 2;

function senzaIlGiornoDavanti(voce) {
  let resto = voce;
  for (let giro = 0; giro < PAROLE_DA_TOGLIERE; giro += 1) {
    const m = /^([\p{L}]+)[.,]?\s+(.+)$/u.exec(resto);
    if (!m) break;
    const parola = minuscolo(m[1]);
    const inutile =
      PREPOSIZIONI.test(parola) || GIORNI_DELLA_SETTIMANA.some((prova) => prova.test(parola));
    if (!inutile) break;
    const dopo = pulito(m[2]);
    if (!/\d/.test(dopo)) break;
    resto = dopo;
  }
  return resto;
}

/**
 * Una data scritta come la scrivono le integrazioni: `2026-09-05`,
 * `2026-09-05 06:00:00`, `2026-09-05T06:00:00+02:00`, `05/09/2026`; e come la
 * scrive chi si compone lo stato con un template: «mer 10/09/2026», «10
 * settembre», «10 settembre 2026».
 * Torna `null` per tutto il resto: un numero non e' una data.
 */
export function leggiData(testo, { giornoIntero = false, adesso = null } = {}) {
  const voce = senzaIlGiornoDavanti(pulito(testo));
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
  /* `05/09/2026`, `05.09.2026`, e il `05-09-2026` degli olandesi (Afvalwijzer). */
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.exec(voce);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  /* «10 settembre», «10 set 2026», «10 September 2026». Senza anno vale il
   * prossimo che viene: un ritiro scritto a mano guarda avanti, non indietro.
   *
   * Prendere l'anno di oggi e fermarsi li' funziona undici mesi su dodici e
   * sbaglia proprio quando conta: «2 gennaio» letto il 30 dicembre diventava
   * il 2 gennaio di quest'anno — undici mesi fa — e chi conta i giorni lo
   * trovava scaduto e lo toglieva dai prossimi. Il bidone andava fuori fra tre
   * giorni e la tessera non lo diceva. Se la data cosi' composta e' gia'
   * passata, vale quella dell'anno dopo.
   *
   * L'istante di riferimento arriva da chi chiama, che ce l'ha; senza, si
   * ripiega sull'orologio, che e' quello che si faceva prima. */
  m = /^(\d{1,2})\s+([\p{L}]{3,})\.?(?:\s+(\d{4}))?$/u.exec(voce);
  if (m) {
    const mese = meseDaParola(m[2]);
    if (mese < 0) return null;
    const giorno = +m[1];
    if (m[3]) return new Date(+m[3], mese, giorno);
    const riferimento = adesso === null || adesso === undefined ? new Date() : new Date(adesso);
    if (!Number.isFinite(riferimento.getTime())) return null;
    const candidata = new Date(riferimento.getFullYear(), mese, giorno);
    if (candidata.getTime() < inizioDelGiorno(riferimento).getTime())
      return new Date(riferimento.getFullYear() + 1, mese, giorno);
    return candidata;
  }
  return null;
}

/* Un giorno della settimana, come lo scrivono certe integrazioni al posto
 * della data: «Friday», «venerdì», «Vrijdag». Vale il prossimo con quel nome,
 * oggi compreso. */
const GIORNI_DELLA_SETTIMANA = Object.freeze([
  /^(domenica|dom|sunday|sun|sonntag|zondag|domingo|dimanche)$/,
  /^(lunedi|lunedì|lun|monday|mon|montag|maandag|lunes|lundi)$/,
  /^(martedi|martedì|mar|tuesday|tue|dienstag|dinsdag|martes|mardi)$/,
  /^(mercoledi|mercoledì|mer|wednesday|wed|mittwoch|woensdag|miércoles|miercoles|mercredi)$/,
  /^(giovedi|giovedì|gio|thursday|thu|donnerstag|donderdag|jueves|jeudi)$/,
  /^(venerdi|venerdì|ven|friday|fri|freitag|vrijdag|viernes|vendredi)$/,
  /^(sabato|sab|saturday|sat|samstag|zaterdag|sábado|sabado|samedi)$/,
]);

export function giornoDellaSettimana(testo, adesso = Date.now()) {
  const voce = minuscolo(testo);
  if (!voce) return null;
  const indice = GIORNI_DELLA_SETTIMANA.findIndex((prova) => prova.test(voce));
  if (indice < 0) return null;
  const oggi = inizioDelGiorno(adesso);
  const fra = (indice - oggi.getDay() + 7) % 7;
  return new Date(oggi.getTime() + fra * 86400000 + 12 * 3600000);
}

/* Le parole che dicono fra quanto: «domani», «in 3 giorni», «today», «in 2
 * dagen», «in 3 Tagen». */
/* La preposizione e' facoltativa: «fra 3 giorni» e «3 giorni» dicono la stessa
 * cosa, e la seconda e' quella che esce dal template piu' diffuso di Waste
 * Collection Schedule — `{{value.daysTo}} giorni` (#383). */
const FRA_GIORNI =
  /^(?:(?:in|fra|tra|en|dans)\s+)?(\d+)\s+(?:giorn[oi]|days?|d|dagen|tagen?|días?|dias?|jours?)$/;

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
  /* I nomi con cui le integrazioni scrivono la data: Waste Collection Schedule
   * (`date`, `upcoming[0].date`), Garbage Collection (`next_date`), Afvalwijzer
   * e i suoi cugini (`next_pickup`, `pickup_date`), i calendari (`start_time`). */
  /* `all_day` lo dichiara Home Assistant sui calendari; per gli altri lo dice
   * la forma, che e' una mezzanotte tonda. */
  const giornoIntero =
    attributi.all_day === true ||
    attributi.all_day === "true" ||
    /T00:00:00([+-]\d{2}:?\d{2}|Z)$/.test(pulito(attributi.start_time || attributi.start));
  for (const nome of [
    "date",
    "next_date",
    "date_next",
    "next_collection",
    "next_collection_date",
    "collection_date",
    "next_pickup",
    "next_pickup_date",
    "pickup_date",
    "next",
    "due_date",
    "due",
    "start_time",
    "start",
  ]) {
    const data = leggiData(attributi[nome], { giornoIntero, adesso });
    if (!data) continue;
    /* Un evento gia' cominciato e non ancora finito e' il ritiro di adesso.
     * Un ritiro che dura da ieri a domani — capita coi calendari scritti a
     * mano — partiva ieri, e ieri e' passato: la riga finiva fra le scadute e
     * la tessera diceva «nessuna data in vista» mentre il bidone era fuori. */
    const fine = leggiData(attributi.end_time || attributi.end, { giornoIntero, adesso });
    if (fine && data.getTime() <= adesso && adesso < fine.getTime()) return inizioDelGiorno(adesso);
    return data;
  }
  const prossimi = Array.isArray(attributi.upcoming) ? attributi.upcoming : [];
  for (const voce of prossimi) {
    const data = leggiData(voce?.date ?? voce?.start ?? voce, { adesso });
    if (data) return data;
  }
  /* I giorni contati, in tutti i dialetti: `daysTo` (Waste Collection
   * Schedule), `days` (Garbage Collection), `days_until`, `due_in`. */
  for (const nome of [
    "daysTo",
    "days_to",
    "days_until",
    "daysUntil",
    "due_in",
    "days_left",
    "days",
    "giorni",
  ]) {
    const n = Number(attributi[nome]);
    if (
      attributi[nome] !== undefined &&
      attributi[nome] !== null &&
      attributi[nome] !== "" &&
      Number.isFinite(n)
    )
      return new Date(inizioDelGiorno(adesso).getTime() + n * 86400000 + 12 * 3600000);
  }
  const grezzo = pulito(stato.state);
  const dallaData = leggiData(grezzo, { adesso });
  if (dallaData) return dallaData;
  const dalleParole = giorniDalleParole(grezzo);
  if (dalleParole !== null)
    return new Date(inizioDelGiorno(adesso).getTime() + dalleParole * 86400000 + 12 * 3600000);
  const dalGiorno = giornoDellaSettimana(grezzo, adesso);
  if (dalGiorno) return dalGiorno;
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
  /* Il turno di casa (#366) da' righe come le da' un sensore: stesso materiale,
   * stessa data, stessa parola. Chi disegna non deve sapere da dove viene una
   * riga — e infatti non lo sa: la pagina, la tessera e il widget mostrano il
   * turno senza una riga di codice in piu'.
   *
   * Un materiale che ha gia' il suo sensore non si ripete: il sensore sa la
   * data vera, il turno la data prevista, e due righe dello stesso bidone con
   * due date diverse sono peggio di una sola. */
  const daiSensori = new Set(
    dato.righe.filter((riga) => riga.entity.includes(".")).map((riga) => riga.materiale),
  );
  /* Un sensore solo che porta tutto l'elenco (#443): le sue voci diventano
   * righe come le altre. Un materiale che ha gia' il suo sensore per materiale
   * non si ripete — quello e' scelto, questo e' dedotto — e il turno scritto a
   * mano cede il passo a tutti e due: e' la previsione, non la data. */
  const dallElenco = ritiriDaUnElenco(
    dato.calendario.includes(".") ? leggi(dato.calendario) : null,
    adesso,
  ).filter((riga) => !daiSensori.has(riga.materiale));
  const dallElencoMateriali = new Set(dallElenco.map((riga) => riga.materiale));
  const dalTurno = ritiriDalTurno(dato.turno, adesso).filter(
    (riga) => !daiSensori.has(riga.materiale) && !dallElencoMateriali.has(riga.materiale),
  );
  const righe = dato.righe
    .filter((riga) => riga.entity.includes("."))
    .map((riga) => {
      const stato = leggi(riga.entity);
      const data = dataDelRitiro(stato, adesso);
      const giorni = data ? giorniFra(adesso, data) : null;
      /* Il materiale lo dice il sensore, se la riga non l'ha scelto: Waste
       * Collection Schedule scrive `types` (un elenco), altri `waste_type`. */
      const dalSensore = riga.materiale === "altro" ? materialeDalSensore(stato) : null;
      const vestito = dalSensore ? materialeDiSerie(dalSensore) : null;
      return {
        ...riga,
        ...(vestito
          ? { materiale: vestito.chiave, icona: vestito.icona, colore: vestito.colore }
          : {}),
        muto: !risponde(stato),
        data,
        giorni,
        /* Cosa c'era scritto, quando non se n'e' cavata una data.
         *
         * «Non riesce ad elaborare la data anche se e' presente» (#383): la
         * riga restava un trattino muto, e capire quale dialetto parlasse
         * quell'integrazione toccava a chi legge le segnalazioni, due giorni
         * dopo. Detto sulla riga, la diagnosi ce l'ha davanti chi configura —
         * ed e' l'unico che puo' vederla. Si porta solo quando serve: dove la
         * data c'e', non c'e' niente da spiegare. */
        letto: !data && risponde(stato) ? pulito(stato?.state) : "",
        quando: quandoCodice(giorni),
      };
    })
    .concat(dallElenco, dalTurno)
    .sort((a, b) => {
      if (a.giorni === null && b.giorni === null) return 0;
      if (a.giorni === null) return 1;
      if (b.giorni === null) return -1;
      return a.giorni - b.giorni;
    });

  let calendario = null;
  /* Quando l'elenco ha parlato, la riga unica del «Calendario dei ritiri» non
   * ci va: direbbe una seconda volta la prima delle righe qui sopra. */
  if (dato.calendario.includes(".") && !dallElenco.length) {
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
