/* Gli animali di casa (#358).
 *
 * «Sarebbe utile ed interessante avere una nuova sezione per chi ha animali
 * domestici, magari in grado di collegarsi a varie integrazioni come ad
 * esempio PetKit, in modo da tenere sotto controllo cio' che li riguarda:
 * lettiera, livello del distributore di cibo e cosi' via.»
 *
 * Un animale non e' un apparecchio: e' un nome, una foto e un pugno di cose
 * che lo riguardano sparse su piu' dispositivi — il distributore del cibo, la
 * lettiera, la fontanella, la porta col microchip, il collare. Le integrazioni
 * che le portano sono tante e nessuna parla come le altre: PetKit chiama
 * «food level» il cibo, SurePetcare pubblica un `binary_sensor` che dice
 * dentro o fuori, Tractive un `device_tracker` e una batteria, Litter-Robot il
 * peso del cassetto. Non c'e' un dominio che dica «questo e' un animale» come
 * `vacuum.` dice «questo e' un robot».
 *
 * Qui sta la parte che ragiona, e ragiona su indizi: dato un dispositivo con
 * le sue entita', dire quale fa da livello del cibo e quale da ultima pulizia
 * della lettiera; e, dati gli stati, dire cosa c'e' da sapere adesso — cibo in
 * esaurimento, lettiera da pulire, filtro dell'acqua a fine corsa.
 *
 * E' puro: entrano la configurazione, gli stati e l'istante, esce la lettura.
 * L'istante entra perche' «ultima pulizia due ore fa» e' un conto sull'ora, e
 * un modulo che guarda l'orologio da se' non si prova a secco. Le parole per
 * dirlo a schermo stanno nella sezione, non qui.
 */

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();
/* Gli stati con cui Home Assistant dice «non lo so». */
const MUTI = /^(unknown|unavailable|none|null|)$/i;

/** La chiave in cui vive la configurazione degli animali. */
export const CHIAVE_ANIMALI = "cd_animali";

/* Un tetto alle schede: dodici animali sono gia' un canile, e una pagina che
 * scorre all'infinito non aiuta nessuno. */
export const MASSIMO_ANIMALI = 12;

/* Le specie che si sanno riconoscere. Il simbolo e' un dato, non una parola:
 * le parole stanno nella sezione. */
export const SPECIE = Object.freeze([
  Object.freeze({ chiave: "gatto", icona: "🐱" }),
  Object.freeze({ chiave: "cane", icona: "🐶" }),
  Object.freeze({ chiave: "altro", icona: "🐾" }),
]);

export function specieDiSerie(chiave) {
  return SPECIE.find((voce) => voce.chiave === pulito(chiave)) || SPECIE[SPECIE.length - 1];
}

/* Che bestia e', letto da come si chiamano il dispositivo e le sue entita'. */
const INDIZI_SPECIE = Object.freeze([
  ["cane", /cane\b|cani\b|dog\b|dogs\b|hund|chien|perro|cagnol|puppy/],
  ["gatto", /gatt|cat\b|cats\b|feline|katze|chat\b|micio|kitty|litter|lettiera/],
]);

export function specieDalNome(testo) {
  const parole = ` ${minuscolo(testo).replaceAll(/[_\-./]+/g, " ")} `;
  for (const [chiave, indizio] of INDIZI_SPECIE) if (indizio.test(parole)) return chiave;
  return "altro";
}

/* ── le caselle di un animale ─────────────────────────────────────────────
 *
 * Ogni casella dice tre cose: dove puo' vivere (`domini`), quali parole la
 * riconoscono (`deve`, e `poi` quando ne servono due), e a che famiglia
 * appartiene sulla scheda (`gruppo`). L'ordine e' quello in cui si assegnano:
 * un'entita' presa da una casella non viene piu' offerta alle successive, e le
 * caselle piu' strette stanno prima — «ultima erogazione» prima di «porzioni»,
 * altrimenti la seconda si prende anche la prima.
 *
 * `numero` dice che quella casella e' una quota: e' l'unica cosa che decide se
 * una lettura si disegna come barra o come parola.
 */
export const CAMPI = Object.freeze([
  Object.freeze({
    chiave: "cibo_livello",
    gruppo: "ciotola",
    domini: ["sensor"],
    numero: true,
    deve: /food|cibo|crocchett|kibble|feed|hopper|granul|futter|nourriture/,
    poi: /level|livell|left|remain|riman|percent|stock|quantit|amount|residu|storage|serbatoi/,
  }),
  Object.freeze({
    chiave: "cibo_ultima",
    gruppo: "ciotola",
    domini: ["sensor"],
    deve: /food|cibo|feed|erogaz|pasto|meal|dispens/,
    poi: /last|ultim|previous|timestamp|when/,
  }),
  Object.freeze({
    chiave: "cibo_porzioni",
    gruppo: "ciotola",
    domini: ["sensor"],
    deve: /portion|porzion|dispens|erogat|eaten|mangiat|ration|serving|feeding|pasti/,
  }),
  /* La sabbia che RESTA, e il cassetto che si RIEMPIE: due numeri che si
   * somigliano e vogliono dire il contrario (#373).
   *
   * «L'avviso della lettiera deve essere quando questa scende sotto una
   * percentuale, attualmente e' sopra: petkit espone un sensor con una
   * percentuale, se questa scende sotto un valore stabilito dall'utente allora
   * puo' mandare l'avviso che la lettiera sta per finire.»
   *
   * Erano una casella sola, e non potevano esserlo: su un Litter-Robot il
   * numero e' il cassetto dei rifiuti — novanta per cento vuol dire da
   * svuotare — su un Petkit e' la sabbia rimasta, e novanta per cento vuol
   * dire che va benissimo. La stessa soglia diceva il contrario a due case
   * diverse. Adesso sono due caselle, e chi ne ha una sola non ha l'altra.
   *
   * La sabbia sta PRIMA perche' e' la piu' stretta: un'entita' presa da una
   * casella non viene piu' offerta alle successive. */
  Object.freeze({
    chiave: "lettiera_sabbia",
    gruppo: "lettiera",
    domini: ["sensor"],
    numero: true,
    deve: /sand|sabbia|litter|lettiera/,
    poi: /level|livell|left|remain|riman|percent|residu|quantit|stock/,
    maNon: /waste|rifiut|drawer|cassett|deodor|bin\b|trash|garbage/,
  }),
  Object.freeze({
    chiave: "lettiera_riempimento",
    gruppo: "lettiera",
    domini: ["sensor"],
    numero: true,
    deve: /waste|rifiut|drawer|cassett|litter|lettiera/,
    poi: /level|livell|percent|full|pien|weight|peso|capacit|riempim/,
    maNon: /sand|sabbia|deodor/,
  }),
  Object.freeze({
    chiave: "lettiera_ultima",
    gruppo: "lettiera",
    domini: ["sensor"],
    deve: /litter|lettiera|clean|puliz|scoop|cycle|ciclo|toilet/,
    poi: /last|ultim|previous|timestamp|when/,
  }),
  Object.freeze({
    chiave: "lettiera_visite",
    gruppo: "lettiera",
    domini: ["sensor"],
    deve: /visit|visite|uses|usage|utilizz|times|conteggi|count|entries|ingressi/,
  }),
  /* I consumabili con la data di scadenza: l'essiccante del distributore e il
   * deodorante della lettiera. «Petkit espone un sensore che dice quanti
   * giorni restano e un button per resettare il valore una volta sostituito,
   * sarebbe comodo avere entrambi.» */
  Object.freeze({
    chiave: "lettiera_deodorante",
    gruppo: "lettiera",
    domini: ["sensor"],
    numero: true,
    giorni: true,
    deve: /deodor|odor|freshener|profum|purific/,
    maNon: /reset|azzera/,
  }),
  /* Il cestino dei rifiuti della lettiera: «esiste anche un binary_sensor che
   * indica se il cestino dei rifiuti ha problemi o meno: poterlo visualizzare
   * sarebbe comodo per capire quando sostituire il sacco». */
  Object.freeze({
    chiave: "lettiera_cestino",
    gruppo: "lettiera",
    domini: ["binary_sensor"],
    guasto: true,
    deve: /waste|rifiut|bin\b|cestin|trash|garbage|sacchett|bag\b|box/,
  }),
  Object.freeze({
    chiave: "acqua_filtro",
    gruppo: "acqua",
    domini: ["sensor"],
    numero: true,
    deve: /filter|filtro|cartucc|cartridge/,
  }),
  Object.freeze({
    chiave: "acqua_livello",
    gruppo: "acqua",
    domini: ["sensor"],
    numero: true,
    deve: /water|acqua|fountain|fontanel|drink|bever|abbevera/,
    poi: /level|livell|left|remain|riman|percent|quantit|residu|serbatoi/,
  }),
  Object.freeze({
    chiave: "porta",
    gruppo: "porta",
    domini: ["binary_sensor", "device_tracker", "sensor"],
    deve: /inside|outside|dentro|fuori|indoor|outdoor|flap|door|gattaiol|presence|presenza|location|posizion/,
  }),
  Object.freeze({
    chiave: "collare_batteria",
    gruppo: "collare",
    domini: ["sensor"],
    numero: true,
    classe: "battery",
    deve: /batter|carica|charge|akku/,
  }),
  Object.freeze({
    chiave: "collare_posizione",
    gruppo: "collare",
    domini: ["device_tracker"],
    deve: /./,
  }),
  /* L'essiccante del distributore, con la stessa regola del deodorante. */
  Object.freeze({
    chiave: "cibo_essiccante",
    gruppo: "ciotola",
    domini: ["sensor"],
    numero: true,
    giorni: true,
    deve: /desiccant|essiccant|dry(er|ing)?\b|deumidif|silica|assorb/,
    maNon: /reset|azzera/,
  }),
  Object.freeze({
    chiave: "peso",
    gruppo: "animale",
    domini: ["sensor"],
    classe: "weight",
    deve: /weight|peso|gewicht|poids/,
  }),
]);

/* ── i tasti: quello che si puo' CHIEDERE a un dispositivo (#373) ─────────
 *
 * «Potrebbe essere utile inserire un bottone che permetta di effettuare
 * l'erogazione di una porzione manuale… sarebbe utile avere i bottoni per
 * avviare la pulizia manuale della lettiera, il livellamento e la manutenzione
 * (distinta in due bottoni: avvia ed esci, petkit li espone cosi').»
 *
 * Stanno in un elenco a parte e non fra le caselle di sopra perche' non sono
 * la stessa cosa: una casella si LEGGE e vive nella colonna dei numeri, un
 * tasto si PREME e vive in fondo alla scheda. Mescolarli avrebbe voluto dire
 * una riga «Pulizia lettiera: —» che non si capisce se e' un dato o un
 * comando.
 *
 * Il dominio dice gia' come si preme: `button.press`, `script.turn_on`,
 * `switch.turn_on`. Qui si dice solo quale entita' fa cosa.
 */
export const AZIONI = Object.freeze([
  Object.freeze({
    chiave: "cibo_eroga",
    gruppo: "ciotola",
    glifo: "🍽️",
    domini: ["button", "script", "switch"],
    deve: /feed|eroga|dispens|porzion|portion|pasto|meal|snack|manual/,
    maNon: /reset|azzera|desiccant|essiccant/,
  }),
  Object.freeze({
    chiave: "cibo_essiccante_reset",
    gruppo: "ciotola",
    glifo: "♻️",
    domini: ["button"],
    deve: /desiccant|essiccant|dry(er|ing)?\b|silica|deumidif/,
    poi: /reset|azzera|replace|sostitu|cambi/,
  }),
  Object.freeze({
    chiave: "lettiera_pulisci",
    gruppo: "lettiera",
    glifo: "🧹",
    domini: ["button", "script", "switch"],
    deve: /clean|puliz|scoop|cycle|ciclo/,
    maNon: /reset|azzera|deodor|maintenance|manutenz/,
  }),
  Object.freeze({
    chiave: "lettiera_livella",
    gruppo: "lettiera",
    glifo: "🪄",
    domini: ["button", "script", "switch"],
    deve: /level(l)?ing|livell|spiana|flatten|even/,
  }),
  /* La manutenzione e' DUE tasti e non uno: «petkit li espone cosi'», e sono
   * due gesti diversi — si entra in manutenzione e prima o poi si esce. Un
   * interruttore solo avrebbe voluto dire indovinare in quale dei due stati
   * si trova la macchina, che e' proprio quello che non si sa. */
  Object.freeze({
    chiave: "lettiera_manutenzione_avvia",
    gruppo: "lettiera",
    glifo: "🛠️",
    domini: ["button", "script", "switch"],
    deve: /maintenance|manutenz/,
    maNon: /exit|esci|end|fine|stop|quit|termina/,
  }),
  Object.freeze({
    chiave: "lettiera_manutenzione_esci",
    gruppo: "lettiera",
    glifo: "🚪",
    domini: ["button", "script", "switch"],
    deve: /maintenance|manutenz/,
    poi: /exit|esci|end|fine|stop|quit|termina/,
  }),
  Object.freeze({
    chiave: "lettiera_deodorante_reset",
    gruppo: "lettiera",
    glifo: "♻️",
    domini: ["button"],
    deve: /deodor|odor|freshener|profum|purific/,
    poi: /reset|azzera|replace|sostitu|cambi/,
  }),
]);

export const CHIAVI_AZIONI = Object.freeze(AZIONI.map((voce) => voce.chiave));

/* Il servizio con cui si preme un tasto, dal dominio dell'entita'.
 *
 * Si descrive, non si esegue: chi ha la connessione la chiama, e cosi' «cosa
 * succede se premo» si prova a tavolino. */
export function pressioneDellAzione(entita) {
  const id = pulito(entita);
  const punto = id.indexOf(".");
  if (punto <= 0) return null;
  const dominio = id.slice(0, punto).toLowerCase();
  const servizio =
    dominio === "button" || dominio === "input_button"
      ? "press"
      : ["script", "switch", "scene", "automation", "input_boolean"].includes(dominio)
        ? "turn_on"
        : "";
  if (!servizio) return null;
  return { dominio, servizio, dati: { entity_id: id } };
}

export const CHIAVI_CAMPI = Object.freeze(CAMPI.map((campo) => campo.chiave));

/* Le soglie oltre le quali la scheda alza la voce. Sono di casa, non di
 * laboratorio: sotto un quinto di cibo si ricompra, un filtro sotto il decimo
 * e' finito, una lettiera piena all'ottanta per cento si svuota, e una non
 * pulita da un giorno intero si pulisce. Ognuna si puo' cambiare per animale;
 * qui c'e' cosa succede quando nessuno l'ha cambiata. */
export const SOGLIE_DI_SERIE = Object.freeze({
  cibo: 20,
  acqua: 20,
  filtro: 10,
  lettiera: 80,
  /* La sabbia RESTA, quindi allarma da sotto: sotto un quinto se ne ricompra.
   * E' la stessa cifra del cibo perche' e' la stessa domanda — quanto ne resta
   * prima di dover uscire a comprarne. */
  sabbia: 20,
  lettiera_ore: 24,
  /* I consumabili contati in giorni — l'essiccante, il deodorante: una
   * settimana e' il tempo che serve per ordinarne un altro. */
  giorni: 7,
  collare: 20,
});

export const CHIAVI_SOGLIE = Object.freeze(Object.keys(SOGLIE_DI_SERIE));

/* ── la configurazione ────────────────────────────────────────────────── */

const numero = (valore) => {
  const letto = Number.parseFloat(valore);
  return Number.isFinite(letto) ? letto : null;
};

/** Una soglia scritta a mano: un numero, oppure niente e vale quella di serie. */
function sogliaScritta(valore, difetto) {
  const letto = numero(valore);
  if (letto === null || letto < 0) return difetto;
  return letto;
}

export function normalizzaAnimale(input = {}, indice = 0) {
  const grezzo = input && typeof input === "object" ? input : {};
  const animale = {
    id: pulito(grezzo.id) || `animale-${indice + 1}`,
    nome: pulito(grezzo.nome ?? grezzo.name),
    specie: specieDiSerie(grezzo.specie ?? grezzo.species).chiave,
    foto: pulito(grezzo.foto ?? grezzo.photo),
    stanza: pulito(grezzo.stanza ?? grezzo.room ?? grezzo.room_id),
    nascosto: grezzo.nascosto === true,
  };
  for (const campo of CAMPI) animale[campo.chiave] = pulito(grezzo[campo.chiave]);
  for (const azione of AZIONI) animale[azione.chiave] = pulito(grezzo[azione.chiave]);
  /* Chi aveva la sabbia nella casella del cassetto se la ritrova al posto suo.
   *
   * Fino a ieri erano una casella sola, e su un Petkit ci finiva la sabbia
   * rimasta: la soglia allarmava «piena» quando invece stava per finire. Il
   * verso lo dice l'entita' stessa — «litter level» non e' «waste drawer» — e
   * spostarla e' l'unico modo perche' l'avviso torni giusto senza chiedere a
   * chi la plancia ce l'ha gia' configurata di rifare il giro. */
  if (animale.lettiera_riempimento && !animale.lettiera_sabbia) {
    const nome = minuscolo(animale.lettiera_riempimento).replaceAll(/[_\-./]+/g, " ");
    if (!/waste|rifiut|drawer|cassett/.test(nome) && /sand|sabbia|litter|lettiera/.test(nome)) {
      animale.lettiera_sabbia = animale.lettiera_riempimento;
      animale.lettiera_riempimento = "";
    }
  }
  const soglie = grezzo.soglie && typeof grezzo.soglie === "object" ? grezzo.soglie : {};
  animale.soglie = {};
  for (const chiave of CHIAVI_SOGLIE)
    animale.soglie[chiave] = sogliaScritta(soglie[chiave], SOGLIE_DI_SERIE[chiave]);
  /* I dispositivi collegati: un animale ne ha spesso piu' d'uno — il
   * distributore, la lettiera, il collare — e ognuno arriva da un giro suo del
   * menu delle integrazioni. Restano scritti per poter dire da dove viene una
   * scheda, e per non ricollegare due volte lo stesso. */
  animale.dispositivi = (Array.isArray(grezzo.dispositivi) ? grezzo.dispositivi : [])
    .map((voce) => ({
      id: pulito(voce?.id),
      nome: pulito(voce?.nome ?? voce?.name),
      integrazione: pulito(voce?.integrazione ?? voce?.integration),
      integrazione_nome: pulito(voce?.integrazione_nome ?? voce?.integration_name),
      marca: pulito(voce?.marca ?? voce?.manufacturer),
      modello: pulito(voce?.modello ?? voce?.model),
    }))
    .filter((voce) => voce.id);
  return animale;
}

/* L'elenco degli animali, senza doppioni di identificativo.
 *
 * Mettere in ordine non e' scegliere: un animale appena aggiunto non ha ancora
 * una casella piena, e buttarlo via qui vorrebbe dire che premere «Aggiungi»
 * non fa niente. Chi disegna decide da se' cosa vale la pena mostrare. */
export function normalizzaAnimali(input = []) {
  const elenco = Array.isArray(input) ? input : input && typeof input === "object" ? [input] : [];
  const visti = new Set();
  const fuori = [];
  for (const [indice, voce] of elenco.entries()) {
    const animale = normalizzaAnimale(voce, indice);
    let id = animale.id;
    let scarto = 2;
    while (visti.has(id)) id = `${animale.id}-${scarto++}`;
    visti.add(id);
    fuori.push({ ...animale, id });
    if (fuori.length >= MASSIMO_ANIMALI) break;
  }
  return fuori;
}

/** Gli animali che una scheda ce l'hanno: un nome, o almeno una casella. */
export function animaliDisegnabili(input = []) {
  return normalizzaAnimali(input).filter(
    (animale) =>
      !animale.nascosto && (animale.nome || CHIAVI_CAMPI.some((chiave) => pulito(animale[chiave]))),
  );
}

/* ── il legame con un dispositivo ─────────────────────────────────────── */

/** Le parole con cui un'entita' si presenta: id, nome, chiave di traduzione. */
function paroleDi(voce, states) {
  const id = pulito(voce?.entity_id);
  return minuscolo(
    [
      id,
      voce?.name,
      voce?.original_name,
      voce?.translation_key,
      states?.[id]?.attributes?.friendly_name,
    ]
      .map(pulito)
      .join(" ")
      .replaceAll(/[_\-./]+/g, " "),
  );
}

const dominioDi = (voce) => pulito(voce?.entity_id).split(".")[0];

function classeDi(voce, states) {
  return minuscolo(
    voce?.device_class || states?.[pulito(voce?.entity_id)]?.attributes?.device_class,
  );
}

/**
 * Propone, casella per casella, l'entita' del dispositivo che la riempie.
 *
 * Restituisce solo le caselle trovate. Un'entita' serve una casella sola; a
 * pari merito vince quella con l'id piu' corto, che di solito e' la piu'
 * semplice — «food_level» prima di «food_level_warning».
 */
export function proponiCaselle(entities = [], states = {}) {
  const elenco = (Array.isArray(entities) ? entities : [])
    .filter((voce) => voce && !voce.disabled && pulito(voce.entity_id).includes("."))
    /* Le impostazioni del dispositivo non sono cose che riguardano l'animale:
     * su un distributore PetKit sono la maggioranza delle entita'. */
    .filter((voce) => !["config", "diagnostic"].includes(minuscolo(voce.category)));
  /* I tasti stanno spesso fra le entita' di configurazione — su un Petkit
   * «reset essiccante» e' un `button` marcato `config` — e quelle qui sopra
   * sono state tolte apposta: sul distributore sono la maggioranza, e nessuna
   * riguarda l'animale. Per i tasti si guarda l'elenco intero: un comando
   * marcato «configurazione» resta un comando. */
  const tutte = (Array.isArray(entities) ? entities : []).filter(
    (voce) => voce && !voce.disabled && pulito(voce.entity_id).includes("."),
  );
  const presi = new Set();
  const proposta = {};
  for (const campo of CAMPI) {
    const scelta = elenco
      .filter((voce) => !presi.has(pulito(voce.entity_id)))
      .filter((voce) => campo.domini.includes(dominioDi(voce)))
      .filter((voce) => !campo.classe || classeDi(voce, states) === campo.classe)
      .filter((voce) => {
        const parole = paroleDi(voce, states);
        if (!campo.deve.test(parole)) return false;
        if (campo.poi && !campo.poi.test(parole)) return false;
        /* Le parole che ESCLUDONO: senza, «litter level» e «waste drawer
         * level» finivano nella stessa casella, e sono il contrario. */
        return !campo.maNon || !campo.maNon.test(parole);
      })
      .sort((a, b) => pulito(a.entity_id).length - pulito(b.entity_id).length)[0];
    if (!scelta) continue;
    presi.add(pulito(scelta.entity_id));
    proposta[campo.chiave] = pulito(scelta.entity_id);
  }
  for (const azione of AZIONI) {
    const scelta = tutte
      .filter((voce) => !presi.has(pulito(voce.entity_id)))
      .filter((voce) => azione.domini.includes(dominioDi(voce)))
      .filter((voce) => {
        const parole = paroleDi(voce, states);
        if (!azione.deve.test(parole)) return false;
        if (azione.poi && !azione.poi.test(parole)) return false;
        return !azione.maNon || !azione.maNon.test(parole);
      })
      .sort((a, b) => pulito(a.entity_id).length - pulito(b.entity_id).length)[0];
    if (!scelta) continue;
    presi.add(pulito(scelta.entity_id));
    proposta[azione.chiave] = pulito(scelta.entity_id);
  }
  return proposta;
}

/**
 * Collega un animale a un dispositivo: scrive il legame e riempie le caselle
 * rimaste vuote, senza toccare quello che chi configura ha gia' scritto.
 *
 * E' la stessa strada degli elettrodomestici e del robot — si sceglie
 * l'integrazione, si sceglie il dispositivo — con una differenza che viene
 * dall'animale e non dal codice: le sue cose stanno su piu' dispositivi, e
 * collegarne un secondo deve sommarsi al primo invece di sostituirlo.
 */
export function collegaAnimaleAlDispositivo({
  device = {},
  entities = [],
  states = {},
  indice = 0,
  precedente = {},
} = {}) {
  const animale = normalizzaAnimale(precedente, indice);
  const proposta = proponiCaselle(entities, states);
  const riempite = [];
  for (const [chiave, entita] of Object.entries(proposta)) {
    if (animale[chiave]) continue;
    animale[chiave] = entita;
    riempite.push(chiave);
  }
  if (!animale.nome) animale.nome = pulito(device.name);
  const specie = specieDalNome(
    [device.name, device.model, device.manufacturer, ...entities.map((voce) => voce?.entity_id)]
      .map(pulito)
      .join(" "),
  );
  if (animale.specie === "altro" && specie !== "altro") animale.specie = specie;
  const id = pulito(device.id);
  if (id && !animale.dispositivi.some((voce) => voce.id === id))
    animale.dispositivi = [
      ...animale.dispositivi,
      {
        id,
        nome: pulito(device.name),
        integrazione: pulito(device.integration),
        integrazione_nome: pulito(device.integration_name) || pulito(device.integration),
        marca: pulito(device.manufacturer),
        modello: pulito(device.model),
      },
    ];
  return { animale, riempite };
}

/* ── quello che si vede ────────────────────────────────────────────────── */

/* Le parole con cui un'integrazione dice «vuoto» o «quasi vuoto» senza dare un
 * numero: PetKit scrive «Low», altre «Empty», e in italiano «esaurito».
 * Valgono quanto una percentuale sotto soglia, perche' dicono la stessa cosa. */
const SCARSO = /^(low|empty|vuoto|esaurit|scarso|basso|critical|critico|niedrig|leer)/i;
const PIENO = /^(full|pien|ok|normal|normale|good|buono|high|alto)/i;

/** Dentro o fuori, come lo dicono le integrazioni delle porte col microchip. */
const DENTRO = /^(on|home|inside|indoor|dentro|casa|present|true)$/i;
const FUORI = /^(off|not_home|away|outside|outdoor|fuori|absent|false)$/i;

export function dentroOFuori(stato) {
  const valore = pulito(stato?.state);
  if (MUTI.test(valore)) return null;
  if (DENTRO.test(valore)) return true;
  if (FUORI.test(valore)) return false;
  return null;
}

/* Da quanto tempo, in minuti.
 *
 * Un'ultima erogazione la si trova scritta in tre modi: una data ISO, un
 * numero di secondi dall'epoca, o gia' un conto in minuti. Tutti e tre
 * rispondono alla stessa domanda, e chi disegna non deve saperlo. */
export function minutiDa(stato, adesso) {
  const valore = pulito(stato?.state);
  if (MUTI.test(valore)) return null;
  const riferimento = Number(adesso);
  if (!Number.isFinite(riferimento) || riferimento <= 0) return null;
  /* I numeri si guardano PRIMA delle date: `Date.parse("45")` non fallisce —
   * legge l'anno 2045 — e «quarantacinque minuti fa» diventava «fra
   * diciannove anni», cioe' zero. Un valore fatto di sole cifre e' un numero,
   * qualunque cosa ne pensi il lettore di date. */
  if (/^-?\d+(?:[.,]\d+)?$/.test(valore)) {
    const letto = numero(valore.replace(",", "."));
    if (letto === null) return null;
    /* Un numero grande e' un istante dall'epoca: in millisecondi o in secondi,
     * come lo scrive chi lo scrive. Un numero piccolo sono minuti gia'
     * contati. */
    if (letto > 1e12) return Math.max(0, Math.round((riferimento - letto) / 60000));
    if (letto > 1e9) return Math.max(0, Math.round((riferimento - letto * 1000) / 60000));
    return Math.max(0, Math.round(letto));
  }
  const istante = Date.parse(valore);
  if (Number.isFinite(istante)) return Math.max(0, Math.round((riferimento - istante) / 60000));
  return null;
}

/** Una lettura: cosa dice quell'entita', ridotta a quello che serve disegnarla. */
function lettura(campo, entita, states, adesso) {
  const id = pulito(entita);
  if (!id) return null;
  const stato = states?.[id];
  const grezzo = pulito(stato?.state);
  const voce = {
    chiave: campo.chiave,
    gruppo: campo.gruppo,
    quota: campo.numero === true,
    entita: id,
    nome: pulito(stato?.attributes?.friendly_name),
    unita: pulito(stato?.attributes?.unit_of_measurement),
    stato: grezzo,
    muto: !stato || MUTI.test(grezzo),
    valore: null,
    minuti: null,
    dentro: null,
    scarso: false,
    /* Un binary_sensor di guasto non ha un numero: ha un si' e un no, ed e'
     * quello che la scheda deve leggere. */
    acceso: null,
    /* I consumabili si contano in giorni, non in centesimi: la barra non ci
     * va, e la parola nemmeno — «12 giorni» si scrive cosi'. */
    giorni: campo.giorni === true,
  };
  if (voce.muto) return voce;
  if (campo.guasto === true) {
    voce.acceso = /^(on|true|problem|guasto|si|yes)$/i.test(grezzo);
    return voce;
  }
  if (campo.chiave === "porta" || campo.chiave === "collare_posizione") {
    voce.dentro = dentroOFuori(stato);
    return voce;
  }
  if (campo.chiave.endsWith("_ultima")) {
    voce.minuti = minutiDa(stato, adesso);
    return voce;
  }
  const letto = numero(grezzo);
  if (letto !== null) voce.valore = letto;
  else if (SCARSO.test(grezzo)) voce.scarso = true;
  else if (!PIENO.test(grezzo)) voce.scarso = false;
  return voce;
}

/* Sotto soglia: col numero si guarda il numero, con la parola si guarda la
 * parola. `false` vuol dire «no» e `null` «non lo so»: chi non sa non allarma. */
function sottoSoglia(voce, soglia) {
  if (!voce || voce.muto) return null;
  if (voce.valore !== null) return voce.valore <= soglia;
  return voce.scarso === true ? true : null;
}

/**
 * Quello che una scheda deve dire, letto dagli stati.
 *
 * `adesso` e' l'istante in millisecondi: entra da fuori perche' «lettiera da
 * pulire da ventisei ore» e' un conto sull'ora, e un modulo che guarda
 * l'orologio da se' non si prova a secco.
 */
export function vistaAnimale(animale = {}, states = {}, adesso = 0) {
  const suo = normalizzaAnimale(animale, 0);
  const letture = {};
  for (const campo of CAMPI) {
    const voce = lettura(campo, suo[campo.chiave], states, adesso);
    if (voce) letture[campo.chiave] = voce;
  }
  const soglie = suo.soglie;
  const avvisi = [];
  const alza = (chiave, gravita) => avvisi.push({ chiave, gravita });

  const cibo = letture.cibo_livello;
  if (sottoSoglia(cibo, soglie.cibo))
    alza(
      "cibo_scarso",
      cibo.valore !== null && cibo.valore <= soglie.cibo / 2 ? "urgente" : "attenzione",
    );

  const acqua = letture.acqua_livello;
  if (sottoSoglia(acqua, soglie.acqua))
    alza(
      "acqua_scarsa",
      acqua.valore !== null && acqua.valore <= soglie.acqua / 2 ? "urgente" : "attenzione",
    );

  if (sottoSoglia(letture.acqua_filtro, soglie.filtro)) alza("filtro_finito", "attenzione");

  /* Il CASSETTO dei rifiuti e' l'unica quota che allarma da sopra: pieno e' il
   * guaio, vuoto e' come dev'essere. Vale solo quando l'entita' parla in
   * centesimi — un cassetto pesato in chili non ha un ottanta per cento. */
  const lettiera = letture.lettiera_riempimento;
  if (lettiera && !lettiera.muto && lettiera.unita === "%" && lettiera.valore !== null)
    if (lettiera.valore >= soglie.lettiera) alza("lettiera_piena", "attenzione");

  /* La SABBIA invece resta, e allarma da sotto (#373): «se questa scende sotto
   * un valore stabilito dall'utente allora puo' mandare l'avviso che la
   * lettiera sta per finire». */
  const sabbia = letture.lettiera_sabbia;
  if (sottoSoglia(sabbia, soglie.sabbia))
    alza(
      "sabbia_scarsa",
      sabbia.valore !== null && sabbia.valore <= soglie.sabbia / 2 ? "urgente" : "attenzione",
    );

  /* I consumabili contati in giorni: quando ne restano pochi si ordina il
   * ricambio, e quando sono finiti si cambia. */
  for (const [chiave, avviso] of [
    ["cibo_essiccante", "essiccante_finito"],
    ["lettiera_deodorante", "deodorante_finito"],
  ]) {
    const voce = letture[chiave];
    if (!voce || voce.muto || voce.valore === null) continue;
    if (voce.valore <= soglie.giorni) alza(avviso, voce.valore <= 0 ? "urgente" : "attenzione");
  }

  /* Il cestino della lettiera: «poterlo visualizzare sarebbe comodo per capire
   * quando sostituire il sacco». Un binary_sensor di guasto dice `on` quando
   * c'e' il problema, che e' la convenzione di Home Assistant. */
  const cestino = letture.lettiera_cestino;
  if (cestino && !cestino.muto && cestino.acceso === true) alza("cestino_pieno", "attenzione");

  const pulizia = letture.lettiera_ultima;
  if (pulizia && pulizia.minuti !== null && pulizia.minuti >= soglie.lettiera_ore * 60)
    alza(
      "lettiera_da_pulire",
      pulizia.minuti >= soglie.lettiera_ore * 120 ? "urgente" : "attenzione",
    );

  if (sottoSoglia(letture.collare_batteria, soglie.collare)) alza("collare_scarico", "attenzione");

  const porta = letture.porta;
  return {
    id: suo.id,
    nome: suo.nome,
    specie: suo.specie,
    icona: specieDiSerie(suo.specie).icona,
    foto: suo.foto,
    stanza: suo.stanza,
    dispositivi: suo.dispositivi,
    soglie,
    letture,
    /* I tasti che questa scheda puo' offrire: solo quelli che hanno davvero
     * un'entita' dietro, e solo se quell'entita' risponde. Un tasto che si
     * preme e non fa niente e' peggio di un tasto che non c'e'. */
    azioni: AZIONI.filter((azione) => {
      const entita = suo[azione.chiave];
      if (!entita || !entita.includes(".")) return false;
      const stato = states?.[entita];
      return Boolean(stato) && !MUTI.test(pulito(stato.state));
    }).map((azione) => ({
      chiave: azione.chiave,
      gruppo: azione.gruppo,
      glifo: azione.glifo,
      entita: suo[azione.chiave],
    })),
    /* Dentro, fuori, o non si sa: la porta col microchip lo dice meglio del
     * collare, che dice solo dove il collare crede di essere. */
    dentro:
      porta && !porta.muto && porta.dentro !== null
        ? porta.dentro
        : (letture.collare_posizione?.dentro ?? null),
    avvisi,
    /* Il peggio che c'e': la scheda si colora con questo, e le schede si
     * mettono in fila con questo. */
    gravita: avvisi.some((voce) => voce.gravita === "urgente")
      ? "urgente"
      : avvisi.length
        ? "attenzione"
        : "quiete",
  };
}

/** Se una scheda ha qualcosa da mostrare oltre al nome. */
export function haLetture(vista) {
  return Object.values(vista?.letture || {}).some((voce) => voce && !voce.muto);
}
