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
  Object.freeze({
    chiave: "lettiera_riempimento",
    gruppo: "lettiera",
    domini: ["sensor"],
    numero: true,
    deve: /litter|lettiera|sand|sabbia|waste|rifiut|drawer|cassett|deodor/,
    poi: /level|livell|percent|full|pien|weight|peso|capacit|riempim/,
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
  Object.freeze({
    chiave: "peso",
    gruppo: "animale",
    domini: ["sensor"],
    classe: "weight",
    deve: /weight|peso|gewicht|poids/,
  }),
]);

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
  lettiera_ore: 24,
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
  const presi = new Set();
  const proposta = {};
  for (const campo of CAMPI) {
    const scelta = elenco
      .filter((voce) => !presi.has(pulito(voce.entity_id)))
      .filter((voce) => campo.domini.includes(dominioDi(voce)))
      .filter((voce) => !campo.classe || classeDi(voce, states) === campo.classe)
      .filter((voce) => {
        const parole = paroleDi(voce, states);
        return campo.deve.test(parole) && (!campo.poi || campo.poi.test(parole));
      })
      .sort((a, b) => pulito(a.entity_id).length - pulito(b.entity_id).length)[0];
    if (!scelta) continue;
    presi.add(pulito(scelta.entity_id));
    proposta[campo.chiave] = pulito(scelta.entity_id);
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
  };
  if (voce.muto) return voce;
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

  /* Il riempimento della lettiera e' l'unica quota che allarma da sopra: piena
   * e' il guaio, vuota e' come dev'essere. Vale solo quando l'entita' parla in
   * centesimi — un cassetto pesato in chili non ha un ottanta per cento. */
  const lettiera = letture.lettiera_riempimento;
  if (lettiera && !lettiera.muto && lettiera.unita === "%" && lettiera.valore !== null)
    if (lettiera.valore >= soglie.lettiera) alza("lettiera_piena", "attenzione");

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
