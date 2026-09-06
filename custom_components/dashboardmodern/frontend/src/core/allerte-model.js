/* Le allerte (#296).
 *
 * «Presenza di allerte varie: terremoti INGV, thermal comfort zona,
 * concentrazione pollini, concentrazione fulmini zona, avvisi protezione
 * civile, Flightradar24 di zona.»
 *
 * Sei fonti, e nessuna parla la lingua dell'altra: un terremoto e' una
 * magnitudo e una distanza, un avviso della protezione civile e' un colore, i
 * fulmini sono un conteggio e una distanza, i pollini un indice, il comfort
 * una parola, i voli un elenco. La plancia non deve saperle tutte e sei: deve
 * sapere se c'e' qualcosa per cui alzare la testa. Percio' questo modulo le
 * riduce tutte a un LIVELLO — quiete, nota, attenzione, allarme — e a poche
 * righe che dicono il perche'.
 *
 * Nessuna di queste fonti e' un servizio chiamato da qui: sono entita' di Home
 * Assistant, portate dentro dalle loro integrazioni (INGV, Meteoalarm,
 * Blitzortung, Thermal Comfort, Flightradar24, quel che si ha). Il modulo
 * legge stati e attributi nei dialetti in cui quelle integrazioni li scrivono,
 * e non chiede niente a nessuno. E' puro: entrano la configurazione e gli
 * stati, esce la lettura. Le parole per dirlo a schermo stanno nella sezione.
 */

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

const numero = (valore) => {
  if (valore === null || valore === undefined || pulito(valore) === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/** La chiave in cui vive la configurazione. */
export const CHIAVE_ALLERTE = "cd_allerte";

/* I livelli, dal piu' tranquillo al piu' grave. «ignoto» sta fuori dalla
 * scala: e' una fonte che non risponde, non una notizia. */
export const LIVELLI = Object.freeze(["quiete", "nota", "attenzione", "allarme"]);
export const IGNOTO = "ignoto";

const PESO = Object.freeze({ quiete: 0, nota: 1, attenzione: 2, allarme: 3 });

/* Le otto categorie, con le caselle che ognuna accetta. La prima casella e'
 * l'entita' principale e da sola basta; le altre servono a chi ha
 * l'informazione spezzata in piu' sensori — Blitzortung tiene il conteggio e
 * la distanza in due entita' diverse. */
export const CATEGORIE = Object.freeze([
  Object.freeze({ chiave: "terremoti", caselle: ["entity", "magnitudo", "distanza"] }),
  Object.freeze({ chiave: "meteo", caselle: ["entity"] }),
  Object.freeze({ chiave: "fulmini", caselle: ["entity", "distanza"] }),
  Object.freeze({ chiave: "pollini", caselle: ["entity"] }),
  Object.freeze({ chiave: "comfort", caselle: ["entity"] }),
  Object.freeze({ chiave: "voli", caselle: ["entity"] }),
  /* «Sarebbe bello inserire una sezione per gli scioperi nazionali e per gli
   * orari dei treni, con la stazione preferita» (#352). Sono due notizie che
   * si guardano prima di uscire di casa, e stanno bene accanto al meteo. */
  Object.freeze({ chiave: "scioperi", caselle: ["entity"] }),
  Object.freeze({ chiave: "treni", caselle: ["entity", "stazione"] }),
]);

/* Gli stati che vogliono dire «non lo so». */
const MUTI = new Set(["unavailable", "unknown", "none", ""]);

/** La configurazione, ripulita: una voce per categoria, con le sue caselle. */
export function normalizzaAllerte(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const fuori = {};
  for (const { chiave, caselle } of CATEGORIE) {
    const voce = dato[chiave] && typeof dato[chiave] === "object" ? dato[chiave] : {};
    fuori[chiave] = { nome: pulito(voce.nome) };
    for (const casella of caselle) fuori[chiave][casella] = pulito(voce[casella]);
  }
  return fuori;
}

/** Le categorie che hanno almeno l'entita' principale. */
export function categorieConfigurate(config) {
  const dato = normalizzaAllerte(config);
  return CATEGORIE.filter(({ chiave }) => dato[chiave].entity.includes(".")).map((c) => c.chiave);
}

/** Tutte le entita' nominate, senza doppioni: serve a chi ascolta gli stati. */
export function entitaDelleAllerte(config) {
  const dato = normalizzaAllerte(config);
  const viste = new Set();
  for (const { chiave, caselle } of CATEGORIE)
    for (const casella of caselle) {
      const entity = dato[chiave][casella];
      if (entity.includes(".")) viste.add(entity);
    }
  return [...viste];
}

/* ── le letture, una per categoria ───────────────────────────────────── */

function attributo(stato, nomi) {
  const attributi = stato?.attributes || {};
  for (const nome of nomi) {
    const valore = attributi[nome];
    if (valore !== null && valore !== undefined && pulito(valore) !== "") return valore;
  }
  return null;
}

/* Una distanza in chilometri, qualunque unita' porti il sensore.
 *
 * Le soglie qui sotto sono in chilometri, e un'integrazione che parla in
 * miglia darebbe 20 per venti miglia: la soglia dei trenta chilometri lo
 * leggerebbe come venti chilometri e alzerebbe un terremoto piccolo ad
 * «attenzione». Miglia e metri si convertono; il resto e' gia' chilometri. */
const MIGLIA_IN_KM = 1.609344;
export function inChilometri(valore, unita) {
  const n = numero(valore);
  if (n == null) return null;
  const u = pulito(unita).toLowerCase();
  if (u === "mi" || u === "mile" || u === "miles" || u === "miglia") return n * MIGLIA_IN_KM;
  if (u === "m" || u === "metri" || u === "meters" || u === "metres") return n / 1000;
  return n;
}

/* Quando lo stato e' cambiato l'ultima volta, in millisecondi, o `null`. */
function daQuando(stato) {
  const quando = Date.parse(stato?.last_changed ?? stato?.last_updated ?? "");
  return Number.isFinite(quando) ? quando : null;
}

const piuAlto = (...livelli) =>
  livelli.reduce(
    (massimo, livello) => (PESO[livello] > PESO[massimo] ? livello : massimo),
    "quiete",
  );

/* Terremoti: una magnitudo e una distanza, da dove le scrive l'integrazione.
 *
 * Un `geo_location.*` porta la distanza nello STATO e la magnitudo negli
 * attributi; un sensore dell'integrazione INGV porta un conteggio nello stato
 * e l'ultimo evento negli attributi. Chi ha magnitudo o distanza in sensori a
 * parte le dichiara nelle caselle apposta, e quelle vincono. */
function leggiTerremoti(voce, stati) {
  const principale = stati.entity;
  const dominio = voce.entity.split(".")[0];
  const conteggio = dominio === "geo_location" ? null : numero(principale?.state);
  const magnitudo =
    numero(stati.magnitudo?.state) ??
    numero(
      attributo(principale, ["magnitude", "magnitudo", "mag", "last_magnitude", "max_magnitude"]),
    );
  const distanza =
    inChilometri(stati.distanza?.state, stati.distanza?.attributes?.unit_of_measurement) ??
    (dominio === "geo_location"
      ? inChilometri(principale?.state, principale?.attributes?.unit_of_measurement)
      : inChilometri(attributo(principale, ["distance", "distanza", "last_distance"]), null));
  const luogo = pulito(
    attributo(principale, [
      "title",
      "place",
      "region",
      "location",
      "last_place",
      "zone",
      "epicentro",
    ]),
  );
  const quando = pulito(attributo(principale, ["publication_date", "time", "last_time", "date"]));
  let livello = "quiete";
  if (magnitudo != null) {
    if (magnitudo >= 5) livello = "allarme";
    else if (magnitudo >= 4) livello = "attenzione";
    else if (magnitudo >= 3) livello = "nota";
    /* Un terremoto piccolo ma sotto casa merita piu' di una nota. */
    if (distanza != null && distanza <= 30 && magnitudo >= 2.5)
      livello = piuAlto(livello, "attenzione");
  } else if (conteggio != null && conteggio > 0) livello = "nota";
  return { livello, magnitudo, distanza, luogo, quando, conteggio };
}

/* Gli avvisi della protezione civile: un colore, comunque sia scritto.
 *
 * Meteoalarm scrive `awareness_level` come «2; yellow; Moderate» — e li' il
 * numero comanda, perche' «Moderate» in quella riga vuol dire GIALLO. I
 * bollettini italiani scrivono «gialla», «arancione», «rossa» oppure
 * «ordinaria», «moderata», «elevata». Un `binary_sensor` acceso senza altro
 * e' almeno una nota. */
const COLORI = Object.freeze([
  [/(^|\b)(4|red|ross[ao]|elevat[ao]|extreme)(\b|$)/, "allarme"],
  [/(^|\b)(3|orange|arancion[ea]|severe)(\b|$)/, "attenzione"],
  [/(^|\b)(2|yellow|giall[ao]|ordinari[ao]|moderat[ao]|moderate|minor)(\b|$)/, "nota"],
  [/(^|\b)(1|0|green|verde|none|nessun[ao]|assente|no[_ ]?warning)(\b|$)/, "quiete"],
]);

export function livelloDalColore(testo) {
  const voce = minuscolo(testo);
  if (!voce) return null;
  /* Il numero davanti comanda: «2; yellow; Moderate» e' giallo, non moderato. */
  const davanti = /^\s*([0-4])\b/.exec(voce);
  if (davanti)
    return livelloDalColore(
      davanti[1] === "0" ? "green" : { 1: "green", 2: "yellow", 3: "orange", 4: "red" }[davanti[1]],
    );
  for (const [prova, livello] of COLORI) if (prova.test(voce)) return livello;
  return null;
}

function leggiMeteo(voce, stati) {
  const principale = stati.entity;
  const grezzo = minuscolo(principale?.state);
  const colore =
    livelloDalColore(
      attributo(principale, ["awareness_level", "level", "livello", "color", "colore", "severity"]),
    ) ?? livelloDalColore(grezzo);
  let livello = "quiete";
  if (colore) livello = colore;
  else if (grezzo === "on" || grezzo === "true") livello = "nota";
  /* Un binary_sensor spento e' quiete anche se gli attributi portano ancora
   * il colore dell'ultimo avviso. */
  if (grezzo === "off" || grezzo === "false") livello = "quiete";
  const evento = pulito(
    attributo(principale, ["event", "headline", "awareness_type", "tipo", "evento", "title"]),
  ).replace(/^\d+;\s*/, "");
  const testo = pulito(
    attributo(principale, ["description", "descrizione", "message", "messaggio"]),
  );
  return { livello, evento, testo };
}

/* I fulmini: un conteggio e una distanza. Un contatore vecchio di un'ora non e'
 * un temporale: si guarda quando si e' mosso. */
const FULMINI_RECENTI_MS = 60 * 60 * 1000;

function leggiFulmini(voce, stati, adesso) {
  const conteggio = numero(stati.entity?.state);
  const distanza =
    inChilometri(stati.distanza?.state, stati.distanza?.attributes?.unit_of_measurement) ??
    inChilometri(attributo(stati.entity, ["distance", "distanza"]), null);
  const quando = daQuando(stati.entity) ?? daQuando(stati.distanza);
  const recente = quando == null || adesso - quando <= FULMINI_RECENTI_MS;
  let livello = "quiete";
  if (recente && conteggio != null && conteggio > 0) {
    livello = "nota";
    if (distanza != null) {
      if (distanza <= 5) livello = "allarme";
      else if (distanza <= 15) livello = "attenzione";
    }
  }
  return { livello, conteggio, distanza, quando, recente };
}

/* I pollini: un indice o una parola. */
const PAROLE_POLLINI = Object.freeze([
  [/very[_ ]?high|molto[_ ]alt[ao]|extreme|estrem[ao]/, "allarme"],
  [/high|alt[ao]|elevat[ao]/, "attenzione"],
  [/moderate|medi[ao]|moderat[ao]/, "nota"],
  [/low|bass[ao]|none|nessun[ao]|assente|no[_ ]?pollen/, "quiete"],
]);

function leggiPollini(voce, stati) {
  const principale = stati.entity;
  const grezzo = minuscolo(principale?.state);
  const unita = pulito(principale?.attributes?.unit_of_measurement);
  const indice = numero(grezzo);
  let livello = "quiete";
  if (indice != null) {
    if (unita === "%")
      livello =
        indice >= 75 ? "allarme" : indice >= 50 ? "attenzione" : indice >= 25 ? "nota" : "quiete";
    else if (indice > 10)
      /* Una concentrazione (granuli per metro cubo): le soglie dei bollettini. */
      livello =
        indice >= 500 ? "allarme" : indice >= 100 ? "attenzione" : indice >= 20 ? "nota" : "quiete";
    else
      livello =
        indice >= 4 ? "allarme" : indice >= 3 ? "attenzione" : indice >= 2 ? "nota" : "quiete";
  } else {
    const parola = grezzo || minuscolo(attributo(principale, ["level", "level_text", "livello"]));
    for (const [prova, esito] of PAROLE_POLLINI)
      if (prova.test(parola)) {
        livello = esito;
        break;
      }
  }
  return { livello, indice, unita, parola: indice == null ? grezzo : "" };
}

/* Il comfort termico: le parole di Thermal Comfort, o un indice di calore in
 * gradi. */
/* Le parole del disagio termico, dalla piu' grave alla piu' tranquilla (#355).
 *
 * «Nelle allerte un discomfort termico dovrebbe essere rilevato come allerta
 * mentre dice tutto OK.» Le fonti che raccontano il caldo afoso sono tante e
 * non parlano la stessa lingua: Thermal Comfort ha la percezione
 * (`quite_uncomfortable`) e la zona del simmer index (`slightly_uncomfortable`,
 * `no_discomfort`), l'humidex conta il disagio (`some_discomfort`,
 * `great_discomfort`), il rischio gelo ha le sue quattro parole, e chi si
 * scrive un sensore in casa mette «Slightly uncomfortable» con lo spazio e la
 * maiuscola, o un `binary_sensor` che sta a `on`. Prima ne conoscevamo una
 * manciata e tutto il resto cadeva su «quiete», cioe' su «tutto OK».
 *
 * La prima riga sono le parole che NEGANO il disagio: si guardano per prime
 * perche' contengono la parola della cosa che negano, e piu' in fondo
 * verrebbero lette al contrario. */
const PAROLE_COMFORT = Object.freeze([
  [/no_discomfort|no_risk|nessun_disagio/, "quiete"],
  [
    /severely_high|extremely_uncomfortable|danger_of_heatstroke|extremely_dangerous|circulatory_collapse|heat[_ ]?stroke|sweltering|^dangerous$|torrido/,
    "allarme",
  ],
  [
    /quite_uncomfortable|great_discomfort|extremely_warm|very_hot|^hot$|oppressive|miserable|^high$|frost.*high|molto_caldo|afoso/,
    "attenzione",
  ],
  [
    /somewhat_uncomfortable|slightly_uncomfortable|some_discomfort|ok_but_humid|increasing_discomfort|uncomfortable|discomfort|probable|humid|muggy|^warm$|disagio|umido|caldo/,
    "nota",
  ],
  [
    /dry|very_comfortable|(^|_)comfortable|slightly_warm|slightly_cool|^cool$|^cold$|unlikely|^ok$|confortevole|secca/,
    "quiete",
  ],
]);

/* La parola come la scrive l'integrazione, ridotta a una forma sola:
 * «Slightly uncomfortable», «slightly-uncomfortable» e
 * `slightly_uncomfortable` sono la stessa cosa, e chi legge non deve saperlo. */
function parolaNormalizzata(stato) {
  return minuscolo(stato).replace(/[\s-]+/g, "_");
}

/* I gradi, sempre nella stessa scala.
 *
 * Un indice di calore in Fahrenheit non si giudica con le soglie di Celsius:
 * 90 °F sono 32 °C — attenzione — e non 90, che sarebbe allarme. E' la stessa
 * regola dell'aria (#340): prima si porta la misura nella sua unita' di
 * riferimento, poi si giudica. */
function gradiInCelsius(valore, unita) {
  if (valore == null) return null;
  const sigla = pulito(unita).replace(/[°\s]/g, "");
  return /^f$/i.test(sigla) ? ((valore - 32) * 5) / 9 : valore;
}

function leggiComfort(voce, stati) {
  const principale = stati.entity;
  const grezzo = parolaNormalizzata(principale?.state);
  const unita = pulito(principale?.attributes?.unit_of_measurement);
  const gradi = gradiInCelsius(numero(minuscolo(principale?.state)), unita);
  let livello = "quiete";
  if (gradi != null) {
    if (gradi >= 41) livello = "allarme";
    else if (gradi >= 32) livello = "attenzione";
    else if (gradi >= 27 || gradi <= 0) livello = "nota";
  } else if (grezzo === "on" || grezzo === "off") {
    /* Un contatto: acceso vuol dire che il disagio c'e'. Chi il sensore se lo
     * scrive in casa fa cosi', e prima non veniva letto affatto. */
    livello = grezzo === "on" ? "attenzione" : "quiete";
  } else {
    for (const [prova, esito] of PAROLE_COMFORT)
      if (prova.test(grezzo)) {
        livello = esito;
        break;
      }
  }
  return { livello, codice: gradi == null ? grezzo : "", gradi, unita };
}

/* I voli sopra casa: quanti, e quali. Flightradar24 tiene l'elenco negli
 * attributi, e ogni voce ha il numero del volo, la compagnia, il modello.
 *
 * «Mi piacerebbe che il widget delle allerte relativo ai voli dia le info del
 * volo: destinazione/tratta, tipo di aereo, compagnia» (#334). C'erano gia',
 * ma dette come le scrive il computer: «AZ1234 · ITA» e «A320 · FCO → CDG».
 * Un codice IATA lo sa leggere chi vola spesso; la tratta la capiscono tutti
 * se e' scritta coi nomi delle citta', che l'integrazione pubblica accanto ai
 * codici. Qui si prende la parola piu' leggibile che c'e' — la citta', se no
 * il nome dell'aeroporto, se no il codice — e la compagnia per esteso quando
 * la sigla non basta. */
const VOLI_MOSTRATI = 5;

/* Il posto, come lo direbbe una persona: la citta' se c'e', se no il nome
 * dell'aeroporto senza la sua coda («Roma Fiumicino Airport» → il codice resta
 * il ripiego onesto). */
function luogoDelVolo(volo, lato) {
  return (
    pulito(volo?.[`airport_${lato}_city`]) ||
    pulito(volo?.[`airport_${lato}_name`]) ||
    pulito(volo?.[`airport_${lato}_code_iata`]) ||
    pulito(volo?.[`airport_${lato}_code`])
  );
}

function leggiVoli(voce, stati) {
  const principale = stati.entity;
  const elenco = Array.isArray(principale?.attributes?.flights)
    ? principale.attributes.flights
    : [];
  const conteggio = numero(principale?.state) ?? elenco.length;
  const voci = elenco.slice(0, VOLI_MOSTRATI).map((volo) => ({
    numero: pulito(volo?.flight_number || volo?.callsign || volo?.id),
    compagnia: pulito(volo?.airline_short || volo?.airline || volo?.airline_iata),
    aereo: pulito(volo?.aircraft_model || volo?.aircraft_code),
    /* La targa dell'aeroplano: chi guarda in su e fotografa la cerca. */
    targa: pulito(volo?.aircraft_registration),
    quota: numero(volo?.altitude),
    distanza: numero(volo?.distance),
    da: luogoDelVolo(volo, "origin"),
    a: luogoDelVolo(volo, "destination"),
  }));
  return { livello: conteggio > 0 ? "nota" : "quiete", conteggio, voci };
}

/* Gli scioperi: quanti, di che settore, e quando cominciano.
 *
 * L'integrazione italiana degli scioperi tiene il conteggio nello stato e
 * l'elenco negli attributi, ognuno con settore, regione, data e distanza da
 * casa; alcuni suoi sensori dicono anche il mezzo e i sindacati. Si legge
 * quello che c'e', coi nomi che ognuna usa: chi pubblica in inglese e chi in
 * italiano. */
const SCIOPERI_MOSTRATI = 5;

function leggiScioperi(voce, stati, adesso) {
  const principale = stati.entity;
  const elenco = Array.isArray(attributo(principale, ["strikes", "scioperi", "events"]))
    ? attributo(principale, ["strikes", "scioperi", "events"])
    : [];
  const conteggio = numero(principale?.state) ?? elenco.length;
  const oggi = new Date(adesso);
  const voci = elenco.slice(0, SCIOPERI_MOSTRATI).map((sciopero) => {
    const quando = Date.parse(
      pulito(
        sciopero?.start_date || sciopero?.start_date_str || sciopero?.data || sciopero?.inizio,
      ),
    );
    const giorno = Number.isFinite(quando) ? new Date(quando) : null;
    return {
      settore: pulito(sciopero?.sector || sciopero?.settore || sciopero?.category),
      zona: pulito(sciopero?.region || sciopero?.regione || sciopero?.province || sciopero?.area),
      mezzo: pulito(sciopero?.modality || sciopero?.mezzo || sciopero?.transport),
      sindacati: pulito(sciopero?.unions || sciopero?.sindacati),
      inizio: Number.isFinite(quando) ? quando : null,
      vicino: sciopero?.in_radius === true,
      /* Oggi vuol dire oggi nel fuso di chi guarda, non nelle ultime
       * ventiquattr'ore: uno sciopero che comincia stasera riguarda la
       * giornata di oggi. */
      oggi: Boolean(
        giorno &&
        giorno.getFullYear() === oggi.getFullYear() &&
        giorno.getMonth() === oggi.getMonth() &&
        giorno.getDate() === oggi.getDate(),
      ),
    };
  });
  let livello = conteggio > 0 ? "nota" : "quiete";
  if (voci.some((v) => v.oggi) || voci.some((v) => v.vicino)) livello = "attenzione";
  return { livello, conteggio, voci };
}

/* Il treno: quanto ritarda, e da dove parte.
 *
 * Le integrazioni dei treni italiani tengono il ritardo in minuti nello stato
 * o in un attributo, e accanto il numero del treno, la destinazione, il
 * binario e l'orario. I nomi cambiano da integrazione a integrazione: si
 * cercano quelli che si usano, in italiano e in inglese, e quello che non
 * c'e' semplicemente non si scrive. */
const RITARDO_NOTA = 5;
const RITARDO_ATTENZIONE = 15;
const RITARDO_ALLARME = 30;
const SOPPRESSO = /(soppress|cancell|cancel)/i;

function leggiTreni(voce, stati) {
  const principale = stati.entity;
  const grezzo = pulito(principale?.state);
  const soppresso =
    SOPPRESSO.test(grezzo) ||
    SOPPRESSO.test(pulito(attributo(principale, ["stato", "status", "state_text"])));
  const ritardo =
    numero(grezzo) ??
    numero(attributo(principale, ["ritardo", "delay", "delay_minutes", "minuti_ritardo"]));
  const treno = pulito(
    attributo(principale, ["treno", "train", "train_number", "numero_treno", "categoria"]),
  );
  const destinazione = pulito(
    attributo(principale, ["destinazione", "destination", "arrivo", "to"]),
  );
  const partenza = pulito(
    attributo(principale, ["partenza", "origin", "departure", "from", "stazione_partenza"]),
  );
  const binario = pulito(attributo(principale, ["binario", "platform", "track"]));
  const orario = pulito(
    attributo(principale, ["orario", "time", "scheduled", "orario_partenza", "departure_time"]),
  );
  const stazione =
    pulito(stati.stazione?.attributes?.friendly_name) ||
    pulito(attributo(principale, ["stazione", "station", "station_name"]));
  let livello = "quiete";
  if (soppresso) livello = "allarme";
  else if (ritardo != null) {
    if (ritardo >= RITARDO_ALLARME) livello = "allarme";
    else if (ritardo >= RITARDO_ATTENZIONE) livello = "attenzione";
    else if (ritardo >= RITARDO_NOTA) livello = "nota";
  }
  return { livello, ritardo, soppresso, treno, destinazione, partenza, binario, orario, stazione };
}

const LETTORI = Object.freeze({
  terremoti: leggiTerremoti,
  meteo: leggiMeteo,
  fulmini: leggiFulmini,
  pollini: leggiPollini,
  comfort: leggiComfort,
  voli: leggiVoli,
  scioperi: leggiScioperi,
  treni: leggiTreni,
});

/**
 * La lettura di tutte le categorie configurate, adesso.
 *
 * Ogni voce porta la categoria, il livello e i dati che lo spiegano. Una
 * categoria la cui entita' principale non risponde esce con livello «ignoto»:
 * non e' quiete — non si sa — e non e' un allarme.
 */
export function letturaAllerte(
  config,
  states = {},
  resolve = (value) => value,
  adesso = Date.now(),
) {
  const dato = normalizzaAllerte(config);
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
  const fuori = [];
  for (const { chiave, caselle } of CATEGORIE) {
    const voce = dato[chiave];
    if (!voce.entity.includes(".")) continue;
    const stati = {};
    for (const casella of caselle) stati[casella] = leggi(voce[casella]);
    const principale = stati.entity;
    const muto = !principale || MUTI.has(minuscolo(principale.state));
    const lettura = muto ? { livello: IGNOTO } : LETTORI[chiave](voce, stati, adesso);
    fuori.push({
      chiave,
      nome: voce.nome,
      entity: voce.entity,
      stato: pulito(principale?.state),
      quando: daQuando(principale),
      ...lettura,
    });
  }
  return fuori;
}

/** Il livello piu' alto fra le letture, ignorando chi non risponde. */
export function livelloMassimo(letture = []) {
  return letture.reduce(
    (massimo, voce) => (PESO[voce?.livello] > PESO[massimo] ? voce.livello : massimo),
    "quiete",
  );
}

/** Le letture che chiedono attenzione: da «nota» in su. */
export function allerteAttive(letture = []) {
  return letture.filter((voce) => PESO[voce?.livello] >= PESO.nota);
}

/** Se un livello vale piu' di un altro. */
export const almeno = (livello, soglia) => (PESO[livello] ?? -1) >= (PESO[soglia] ?? 0);
