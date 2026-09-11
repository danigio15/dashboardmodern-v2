/* Cos'e' un'auto, e chi comanda.
 *
 * La sezione EV non aveva bug: aveva sei padroni. `cd_ev_cars` era letta e
 * riscritta da nove posti diversi — la sezione, la personalizzazione, tre
 * moduli di rattoppo, la persistenza, e il runtime vendorizzato in due lingue —
 * e ogni correzione fatta negli anni e' stata un argine contro uno di loro. Per
 * questo continuava a sfuggire: si tappava un lato e l'acqua usciva dall'altro.
 *
 * Qui c'e' un padrone solo. Questo modulo dice cos'e' un'auto, come si
 * riconosce, cosa le appartiene e come si scrive; nessuno tocca un profilo se
 * non passando di qui. E' puro: entra un oggetto, esce un oggetto — niente DOM,
 * niente archiviazione, niente stati letti di nascosto.
 *
 * Tre regole, e sono le stesse che hanno appena messo in riga gli impianti.
 *
 * La prima: l'identita' non e' il nome. La chiave di un'auto si ricavava dal
 * nome e dalla marca, e si ricalcolava: due auto chiamate quasi uguale ne
 * ricavavano una sola, e sceglierne una apriva l'altra. Qui l'uid nasce una
 * volta, non si ricava da niente e non si riusa nemmeno quando l'auto che lo
 * portava viene cancellata.
 *
 * La seconda: le foto appartengono all'auto. Vivevano anche in due caselle
 * sciolte — `cd_ev_image` e `cd_ev_image_plugged` — che mostravano l'auto
 * attiva: due verita' sulla stessa cosa, e bastava configurare la vettura
 * sbagliata perche' si scambiassero. Qui la foto sta dentro il profilo e basta.
 *
 * La terza: attiva e' un'auto, non una posizione. `cd_ev_car_active` teneva un
 * indice, e ogni riordino dell'elenco spostava l'auto in uso sotto i piedi di
 * chi la stava guardando. Si tiene l'uid.
 */

import { prossimoIdentificativo, segnoPiuAlto } from "./segno-progressivo.js";

const clean = (value) => String(value ?? "").trim();

/** Il campo in cui l'auto tiene la sua identita'. */
export const VEHICLE_KEY_FIELD = "uid";

/** Da dove nasce un uid, e il segno che dice a che numero siamo arrivati. */
export const VEHICLE_ID_PREFIX = "auto";
export const VEHICLE_SEQ_FIELD = "vehicle_seq";

/* La mappatura delle entita' di un'auto: sedici riferimenti `dm.ev_*` che
 * dicono, per QUESTA vettura, quale sensore risponde a cosa. E' il pezzo che il
 * runtime vendorizzato risalvava per intero buttando via tutto il resto. */
export const VEHICLE_OVERRIDES_FIELD = "ov";

/* Le due foto: l'auto ferma, e l'auto col cavo attaccato. Solo la prima serve;
 * senza la seconda la card continua a mostrare la prima, che e' esattamente
 * cio' che fa ogni configurazione esistente. */
export const VEHICLE_PHOTO_FIELDS = Object.freeze({ idle: "img", plugged: "imgPlugged" });

/* Tutto cio' che appartiene a un'auto, oltre alla mappatura.
 *
 * Serviva un elenco perche' il runtime risalvava il profilo sostituendolo con
 * `{ name, ov, img }`: la marca scelta nella Personalizzazione, il modello, la
 * foto col cavo e la chiave sparivano senza che nessuno le avesse toccate.
 * Resta scritto qui anche adesso che quel risalvataggio non c'e' piu': e'
 * l'elenco di cosa una vettura E', e serve a chi un domani riscrivera' un
 * profilo per un'altra ragione. */
export const VEHICLE_FIELDS = Object.freeze([
  VEHICLE_KEY_FIELD,
  "name",
  "brand",
  "model",
  "icon",
  "tipo",
  VEHICLE_PHOTO_FIELDS.idle,
  VEHICLE_PHOTO_FIELDS.plugged,
]);

/* Che motore ha (#208).
 *
 * «E' possibile scegliere a monte se visualizzare un'auto elettrica o classica
 * con i sensori disponibili?» La pagina Auto era nata elettrica e basta:
 * batteria, wallbox, sessione di ricarica. Chi ha un'auto a benzina aveva gli
 * stessi sensori di tutti — carburante, autonomia, odometro, portiere — e
 * nessun posto dove metterli. Il tipo si sceglie per vettura, perche' in un
 * garage possono starci tutte e due.
 *
 * Vuoto vuol dire elettrica: e' quello che ogni auto configurata finora e', e
 * non le si chiede di dichiararlo. */
export const TIPI_MOTORE = Object.freeze(["elettrica", "termica", "ibrida"]);

export function tipoMotore(valore) {
  const voce = clean(valore).toLowerCase();
  if (voce === "termica" || voce === "ibrida") return voce;
  return "";
}

/* Il motore dichiarato da chi non ha nessun profilo auto (#326).
 *
 * «Rientrando nella configurazione il Motore risulta Elettrica»; e insieme:
 * la batteria e la SESSIONE RICARICA restavano in pagina su un'auto a
 * benzina. E' lo stesso guasto visto da tre parti, e la causa e' una: il tipo
 * di motore viveva SOLO dentro il profilo di una vettura, e un profilo non e'
 * obbligatorio. Chi ha una macchina sola compila le caselle `dm.ev_*` nella
 * mappatura generale della plancia — e' quello che la scheda gli dice di fare
 * — e non preme mai «Salva auto»: la sua scelta non aveva dove andare, quindi
 * spariva, e la pagina continuava a raccontare un'elettrica.
 *
 * Qui c'e' la casa che le mancava: una casella della plancia, come le
 * `dm.ev_*` a cui appartiene, letta SOLO quando in garage non c'e' nessun
 * profilo. Con dei profili comanda la vettura, perche' in un garage possono
 * starci una benzina e un'elettrica e una risposta sola per tutte e due
 * sarebbe falsa per una delle due. */
export const MOTORE_DI_CASA_KEY = "cd_ev_motore";

/**
 * Che motore ha l'auto di cui si sta parlando.
 *
 * Con una vettura vale quello che la vettura dichiara — anche il silenzio,
 * che vuol dire elettrica. Senza nessuna vettura vale quello dichiarato per
 * la plancia.
 */
export function motoreDellaVettura(car, diCasa = "") {
  return car ? tipoMotore(car.tipo) : tipoMotore(diCasa);
}

/** Se questa vettura va (anche) a carburante: termica o ibrida. */
export const vaACarburante = (car = {}) => tipoMotore(car?.tipo) !== "";

/** Se questa vettura ha (anche) una batteria da ricaricare: elettrica o ibrida. */
export const siRicarica = (car = {}) => tipoMotore(car?.tipo) !== "termica";

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const array = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const richiestaDelSegno = (list, metadata) => ({
  elenco: array(list),
  metadata: isObject(metadata) ? metadata : {},
  prefisso: VEHICLE_ID_PREFIX,
  identificativo: (car) => car?.[VEHICLE_KEY_FIELD],
  campoSegno: VEHICLE_SEQ_FIELD,
  minimo: 0,
});

/** Il numero piu' alto mai distribuito a un'auto. La regola sta in un posto solo. */
export function altoSegnoVeicoli(list = [], metadata = {}) {
  return segnoPiuAlto(richiestaDelSegno(list, metadata));
}

/** L'uid di un'auto che sta per nascere. Non si ricava dal nome e non si riusa. */
export function nuovoVeicoloId(list = [], metadata = {}) {
  return prossimoIdentificativo(richiestaDelSegno(list, metadata));
}

/** Una vettura normalizzata: quello che c'e', nella forma che il resto si aspetta. */
export function normalizeVehicle(input = {}, index = 0) {
  const source = isObject(input) ? input : {};
  const overrides = isObject(source[VEHICLE_OVERRIDES_FIELD])
    ? source[VEHICLE_OVERRIDES_FIELD]
    : {};
  const car = {
    /* Quello che non conosciamo resta.
     *
     * Un profilo porta anche campi che non appartengono a questo modello: l'id
     * canonico con cui lo store lo indicizza, l'interruttore che dice se e'
     * attiva, e domani chissa'. Riscrivendo l'oggetto da zero sparivano — e lo
     * store, non trovando piu' l'id, gliene assegnava uno nuovo: la stessa auto
     * diventava un'altra a ogni salvataggio. Un padrone che scarta cio' che non
     * capisce non e' meglio dei sei che c'erano prima. */
    ...source,
    /* Un profilo scritto prima che gli uid esistessero ne riceve uno qui, dalla
     * sua posizione — e da quel momento se lo tiene, perche' viene scritto. */
    [VEHICLE_KEY_FIELD]: clean(source[VEHICLE_KEY_FIELD]) || `${VEHICLE_ID_PREFIX}-${index + 1}`,
    name: clean(source.name),
    brand: clean(source.brand),
    model: clean(source.model),
    icon: clean(source.icon),
    tipo: tipoMotore(source.tipo),
    [VEHICLE_OVERRIDES_FIELD]: Object.fromEntries(
      Object.entries(overrides)
        .map(([chiave, valore]) => [clean(chiave), clean(valore)])
        .filter(([chiave, valore]) => chiave.startsWith("dm.ev_") && valore),
    ),
  };
  for (const campo of Object.values(VEHICLE_PHOTO_FIELDS)) {
    const valore = source[campo];
    car[campo] = clean(typeof valore === "string" ? valore : valore?.url || valore?.path || "");
  }
  return car;
}

/** Come si chiama, anche quando chi l'ha fatta non le ha dato un nome. */
export function vehicleLabel(car = {}, index = 0, fallback = "Auto") {
  return clean(car?.name) || `${fallback} ${index + 1}`;
}

/** Tutte le auto salvate, normalizzate, con gli uid resi unici. */
export function vehicleList(stored = []) {
  const prese = new Set();
  return array(stored).map((car, index) => {
    const normalizzata = normalizeVehicle(car, index);
    /* Due profili con lo stesso uid sarebbero la stessa auto: sceglierne uno
     * aprirebbe l'altro, che e' esattamente il guasto da cui si viene. Il
     * doppione se ne prende uno nuovo, e da li' in poi resta suo. */
    let uid = normalizzata[VEHICLE_KEY_FIELD];
    for (let numero = 2; prese.has(uid); numero += 1)
      uid = `${normalizzata[VEHICLE_KEY_FIELD]}-${numero}`;
    prese.add(uid);
    return uid === normalizzata[VEHICLE_KEY_FIELD]
      ? normalizzata
      : { ...normalizzata, [VEHICLE_KEY_FIELD]: uid };
  });
}

/** L'elenco da salvare, e il segno che sale e non scende mai. */
export function storedVehicles(list = [], metadata = {}) {
  const auto = vehicleList(list);
  return {
    cars: auto,
    metadata: {
      ...(isObject(metadata) ? metadata : {}),
      [VEHICLE_SEQ_FIELD]: altoSegnoVeicoli(auto, metadata),
    },
  };
}

/** Un'auto nuova, vuota, con la sua identita' gia' addosso. */
export function nuovoVeicolo(list = [], nome = "", metadata = {}) {
  return normalizeVehicle({
    [VEHICLE_KEY_FIELD]: nuovoVeicoloId(list, metadata),
    name: clean(nome),
  });
}

/** Dove sta, nell'elenco, l'auto con questo uid. `-1` se non c'e' piu'. */
export function vehicleIndex(list = [], uid = "") {
  const cercato = clean(uid);
  if (!cercato) return -1;
  return array(list).findIndex((car) => clean(car?.[VEHICLE_KEY_FIELD]) === cercato);
}

/**
 * L'auto in uso.
 *
 * Si accetta anche un numero, perche' `cd_ev_car_active` per anni ha tenuto una
 * posizione: chi arriva da li' non deve perdere l'auto che stava guardando. Da
 * qui in avanti si scrive l'uid, e un riordino dell'elenco non sposta piu'
 * niente sotto i piedi di nessuno.
 */
export function pickVehicle(list = [], scelta = "") {
  const auto = array(list);
  const riferimento = clean(scelta);
  if (!riferimento) return auto[0] || null;
  const perUid = auto.find((car) => clean(car?.[VEHICLE_KEY_FIELD]) === riferimento);
  if (perUid) return perUid;
  const posizione = Number.parseInt(riferimento, 10);
  if (Number.isInteger(posizione) && posizione >= 0 && posizione < auto.length)
    return auto[posizione];
  return auto[0] || null;
}

/**
 * Le due foto di un'auto.
 *
 * Vivevano anche in due caselle sciolte che mostravano l'auto attiva: due
 * verita' sulla stessa cosa, e bastava configurare la vettura sbagliata perche'
 * si scambiassero. Adesso la fonte e' il profilo, e una sola.
 */
export function vehiclePhotos(car = {}) {
  return {
    idle: clean(car?.[VEHICLE_PHOTO_FIELDS.idle]),
    plugged: clean(car?.[VEHICLE_PHOTO_FIELDS.plugged]),
  };
}

/** Quale delle due si guarda adesso: col cavo attaccato vince la seconda, se c'e'. */
export function vehiclePhoto(car = {}, plugged = false) {
  const foto = vehiclePhotos(car);
  return (plugged && foto.plugged) || foto.idle || foto.plugged || "";
}

/** Lo stesso elenco, con un campo riscritto su UNA vettura e nient'altro toccato. */
export function updateVehicle(list = [], uid, patch = {}) {
  const cercato = clean(uid);
  /* Nessuna identita' non vuol dire «tutte le identita'».
   *
   * Un uid vuoto combaciava con OGNI riga che l'uid non ce l'ha — e le righe
   * senza uid sono la forma di ogni configurazione scritta prima che gli uid
   * esistessero, e di ogni ripristino, finche' qualcuno non apre la lista auto
   * e gliene fa scrivere uno. Una patch chiesta per una vettura le prendeva
   * tutte: la foto della prima finiva su tutte le altre. E' il «si mischiano
   * le foto» che tornava.
   *
   * La lettura questa difesa ce l'aveva gia' — `vehicleIndex` su un uid vuoto
   * risponde -1 — e mancava solo di qua. Chiedere di cambiare un'auto che non
   * si sa quale sia non cambia niente. */
  if (!cercato) return array(list);
  return array(list).map((car) =>
    clean(car?.[VEHICLE_KEY_FIELD]) === cercato
      ? /* L'uid non si riscrive mai da qui: e' l'intera ragione per cui esiste. */
        { ...car, ...patch, [VEHICLE_KEY_FIELD]: car[VEHICLE_KEY_FIELD] }
      : car,
  );
}

/** Lo stesso elenco senza quell'auto. L'ultima non si toglie: resterebbe niente. */
export function removeVehicle(list = [], uid) {
  const auto = array(list);
  if (auto.length < 2) return auto;
  const cercato = clean(uid);
  return auto.filter((car) => clean(car?.[VEHICLE_KEY_FIELD]) !== cercato);
}

/* L'auto che arriva da un'integrazione entra nell'elenco senza farne nascere
 * una seconda.
 *
 * «La foto dell'auto si e' persa con gli aggiornamenti: l'ho riassociata e
 * funziona.» Chi collegava la vettura dal menu delle integrazioni la
 * consegnava sempre come auto NUOVA — senza foto, senza marca — anche quando
 * in elenco c'era gia' una B10 con la sua foto: da li' in poi ce n'erano due
 * con lo stesso nome, e quella in mostra era la nuda. La foto non l'aveva
 * cancellata nessuno: stava sull'altra.
 *
 * Adesso il dispositivo si versa nell'auto aperta con la matita, o in quella
 * che gia' porta quel nome, e le lascia tutto il suo: le foto, la marca, il
 * modello, il motore dichiarato. Le caselle che l'integrazione riconosce si
 * riscrivono, quelle che non conosce restano. Solo senza nessuna delle due
 * nasce una vettura nuova.
 *
 * Torna l'elenco da salvare, l'uid dell'auto toccata, e se e' nata adesso. */
export function accogliAutoDalDispositivo(
  list = [],
  { name = "", mappa = {}, tipo = "", aperta = "", metadata = {} } = {},
) {
  const auto = vehicleList(list);
  const nome = clean(name);
  const chiaveAperta = clean(aperta);
  const caselle = Object.fromEntries(
    Object.entries(isObject(mappa) ? mappa : {})
      .map(([chiave, valore]) => [clean(chiave), clean(valore)])
      .filter(([chiave, valore]) => chiave.startsWith("dm.ev_") && valore),
  );
  const bersaglio =
    (chiaveAperta && auto.find((car) => clean(car?.[VEHICLE_KEY_FIELD]) === chiaveAperta)) ||
    (nome && auto.find((car) => clean(car?.name) === nome)) ||
    null;
  if (bersaglio) {
    const uid = clean(bersaglio[VEHICLE_KEY_FIELD]);
    const mappatura = { ...(bersaglio[VEHICLE_OVERRIDES_FIELD] || {}), ...caselle };
    return {
      cars: updateVehicle(auto, uid, {
        [VEHICLE_OVERRIDES_FIELD]: mappatura,
        overrides: mappatura,
        /* Il motore lo dice chi l'ha dichiarato; l'integrazione parla solo
         * dove nessuno ha ancora detto niente. */
        ...(tipoMotore(bersaglio.tipo) || !tipoMotore(tipo) ? {} : { tipo: tipoMotore(tipo) }),
      }),
      uid,
      nuova: false,
    };
  }
  const nata = {
    ...nuovoVeicolo(auto, nome, metadata),
    tipo: tipoMotore(tipo),
    [VEHICLE_OVERRIDES_FIELD]: caselle,
    overrides: caselle,
  };
  return { cars: [...auto, nata], uid: clean(nata[VEHICLE_KEY_FIELD]), nuova: true };
}

/** Tutte le entita' mappate da tutte le auto: serve a sapere se uno stato ci riguarda. */
export function vehicleEntities(list = []) {
  const ids = new Set();
  for (const car of array(list))
    for (const valore of Object.values(car?.[VEHICLE_OVERRIDES_FIELD] || {}))
      if (clean(valore).includes(".")) ids.add(clean(valore));
  return ids;
}

/**
 * L'elenco con le caselle di un'auto rimesse d'accordo con quelle scritte.
 *
 * «Nella sezione km residui ho visto che in automatico prendeva l'entita' dei
 *  km residui dell'AdBlue e non del gasolio. Per cui ho modificato a mano
 *  l'entita' e salvato. Purtroppo a schermo compaiono ancora i km residui
 *  dell'AdBlue ma se clicco sopra prende il grafico corretto» (#444).
 *
 * Le caselle di una vettura vivono in due posti, e per disegno: nel profilo,
 * che e' il loro padrone, e nella mappa di casa, che e' quella che il guscio
 * legge con `resolveEntity`. Mettere in uso un'auto versa il profilo nella
 * mappa; salvare l'auto rilegge la mappa nel profilo. Finche' si passa da uno
 * di quei due gesti i due posti dicono la stessa cosa.
 *
 * Correggere una casella a mano non e' nessuno dei due. La correzione andava
 * nella mappa di casa e li' restava: il grafico che si apre toccando la
 * misura la usava — passa da `resolveEntity` — e la card e la tessera no,
 * perche' leggono il profilo. Da fuori si vede come una sola cosa: lo schermo
 * dice AdBlue, il grafico dietro dice gasolio.
 *
 * Qui si chiude il giro dalla parte che mancava: quello che si e' scritto
 * entra nel profilo dell'auto di cui sono le caselle. Solo un valore SCRITTO
 * sovrascrive — una chiave che non c'e' non vuol dire «cancellala», vuol dire
 * che quel gesto non parlava di lei — e `eDiCasa` tiene fuori quello che alla
 * vettura non appartiene: la colonnina e' della casa, e il limite di carica
 * comandabile pure.
 *
 * Torna l'elenco da salvare e se c'era davvero qualcosa da cambiare. Il
 * secondo serve: una casella si salva sul `change` del suo campo, e salvare
 * l'elenco a ogni battito vorrebbe dire una spinta di sincronizzazione per
 * ogni lettera scritta.
 */
export function conLeCaselleScritte(list = [], uid, caselle = {}, eDiCasa = () => false) {
  const auto = array(list);
  const cercato = clean(uid);
  const posto = cercato ? vehicleIndex(auto, cercato) : -1;
  if (posto < 0) return { cars: auto, cambiato: false };
  const sue = auto[posto]?.[VEHICLE_OVERRIDES_FIELD];
  const mappa = sue && typeof sue === "object" && !Array.isArray(sue) ? sue : {};
  const prossime = { ...mappa };
  let cambiato = false;
  for (const [chiave, valore] of Object.entries(caselle || {})) {
    const ref = clean(chiave);
    /* Solo le caselle di un'auto: la mappa di casa ne porta centinaia. */
    if (!ref.startsWith("dm.ev_")) continue;
    if (eDiCasa(ref, valore)) continue;
    const scritto = clean(valore);
    if (!scritto || clean(mappa[ref]) === scritto) continue;
    prossime[ref] = scritto;
    cambiato = true;
  }
  if (!cambiato) return { cars: auto, cambiato: false };
  return {
    cars: updateVehicle(auto, cercato, { [VEHICLE_OVERRIDES_FIELD]: prossime }),
    cambiato: true,
  };
}

/* Il nome di un modello come si confronta: minuscolo, senza accenti, una
 * parola per pezzo. E' la stessa pulizia che fa la scheda dell'auto. */
export function normalizzaModello(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
}

/* Due nomi dicono lo stesso modello se sono uguali o se uno contiene l'altro
 * PER PAROLE INTERE (revisione della 1.4.7). Il confronto per sottostringa
 * faceva di una Peugeot «5008» una «500» Abarth, e di ogni sigla corta un
 * modello di chiunque; «Avenger Electric» resta un'«Avenger». */
export function stessoModello(a, b) {
  const uno = normalizzaModello(a);
  const due = normalizzaModello(b);
  if (!uno || !due) return false;
  if (uno === due) return true;
  return ` ${uno} `.includes(` ${due} `) || ` ${due} `.includes(` ${uno} `);
}

/**
 * Di quale vettura sono le caselle che si stanno salvando.
 *
 * La domanda ha una risposta sola quando si salva, e questa e' la regola che
 * la da'. Stava dentro la sezione, in mezzo al documento, e per questo non si
 * poteva provare con i numeri: e' logica pura — un elenco, una chiave, un nome
 * — e adesso sta dove sta la logica pura.
 *
 * Torna l'auto e, quando non ce n'e' una, il MOTIVO. Il motivo non e' un
 * ornamento: prima questa decisione rifiutava in quattro punti diversi senza
 * dire niente a nessuno, e un salvataggio che non arriva nel profilo si vedeva
 * solo dall'esterno, come «lo schermo dice AdBlue e il grafico dice gasolio»
 * (#444). Un rifiuto che non si sa spiegare costa un'indagine ogni volta.
 *
 * Le regole, in ordine:
 *
 *  - `chiave` vuota e' il gesto «＋ Nuova auto»: i campi sono di una vettura
 *    che sta nascendo e non sono di nessuno finche' non la si salva.
 *  - `chiave` piena e' la matita: quelle caselle sono di QUELL'auto, e di
 *    nessun'altra. Se l'auto che la chiave nomina non c'e' piu' — cancellata,
 *    o un elenco riletto che le ha dato un'altra identita' — non si ripiega
 *    sull'auto in uso. Ci avevo provato, ed e' un modo per rifare il difetto
 *    che questa regola esiste per impedire: cancellare la vettura aperta con
 *    la matita non azzera la chiave, quindi il «Salva sezione» dopo avrebbe
 *    versato le caselle di quella cancellata dentro un'altra macchina. Sono
 *    caselle che descrivono un'auto che non esiste, e la risposta giusta e'
 *    nessuno. La sessione si rimette a posto da sola al primo ridisegno, che
 *    la chiave la riscrive su una vettura vera.
 *  - Senza chiave comanda il NOME scritto: un nome gia' in elenco sceglie
 *    l'auto che lo porta; un nome nuovo e' una vettura che nasce, e le sue
 *    caselle aspettano. Nessun nome vuol dire l'auto in uso.
 *
 * Versare le caselle nell'auto in uso quando un nome NUOVO e' scritto sarebbe
 * il modo in cui due auto si mescolano: si mappa la Zoe, si salva, si rimappa
 * per la Tesla, e la Zoe si prende la batteria della Tesla prima che la Tesla
 * esista.
 */
export function laVetturaDelleCaselle({
  elenco = [],
  chiave = null,
  nomeScritto = "",
  inUso = null,
} = {}) {
  const auto = array(elenco);
  if (!auto.length) return { auto: null, motivo: "nessuna-auto" };
  if (chiave === "") return { auto: null, motivo: "auto-che-nasce" };
  const cercata = clean(chiave);
  if (cercata) {
    const trovata = auto.find((car) => clean(car?.[VEHICLE_KEY_FIELD]) === cercata) || null;
    if (trovata) return { auto: trovata, motivo: "" };
    /* La chiave nomina un'auto che non c'e' piu': non si scrive su nessuna, e
     * si dice perche'. Il rumore era quello che mancava, non il ripiego. */
    return { auto: null, motivo: "chiave-sparita" };
  }
  const nome = clean(nomeScritto);
  const omonima = nome ? auto.find((car) => clean(car?.name) === nome) || null : null;
  if (nome && !omonima) return { auto: null, motivo: "nome-nuovo" };
  if (omonima) return { auto: omonima, motivo: "" };
  return inUso ? { auto: inUso, motivo: "" } : { auto: null, motivo: "nessuna-in-uso" };
}

/* Perche' Home Assistant ha rifiutato un comando all'auto.
 *
 * «Continua ad esserci il problema nel cambio percentuale ricarica», con la
 * pastiglia che diceva: «Home Assistant ha rifiutato il target: Leapmotor
 * remote control result failed: Token is invalid».
 *
 * Quel rifiuto non e' nostro, ed e' giusto che si veda: e' il comando che non
 * e' arrivato all'auto. Ma scritto cosi' non si sa da che parte prenderlo. Un
 * gettone scaduto ha un rimedio preciso — si riconnette l'integrazione — e chi
 * legge ha il diritto di sapere che c'e', invece di riprovare la tendina
 * all'infinito.
 *
 * Il modulo e' puro e non traduce: torna una chiave — chi disegna sa in che
 * lingua parlare. Le chiavi sono tre, piu' il silenzio:
 *
 *   · `autenticazione`: l'integrazione non e' piu' collegata all'account
 *     dell'auto. Si riconnette dalle Impostazioni di Home Assistant;
 *   · `permesso`: l'integrazione sta bene, ma Home Assistant non autorizza chi
 *     guarda a comandare quell'entita'. E' un'altra cosa, e ha un altro
 *     rimedio: riconnettere l'integrazione non servirebbe a niente;
 *   · `non-raggiungibile`: l'auto non ha risposto in tempo. Le auto in cloud
 *     dormono, e spesso basta riprovare;
 *   · `""`: non si sa, e allora si dice quello che ha detto Home Assistant
 *     invece di indovinare.
 *
 * Le parole su cui si riconosce sono quelle che scrivono le integrazioni e i
 * server sotto: si guarda il messaggio intero, in qualunque lingua l'abbia
 * scritto chi l'ha scritto, perche' i codici HTTP e le parole inglesi passano
 * comunque.
 */
const PAROLE_DEL_RIFIUTO = Object.freeze([
  Object.freeze({
    /* L'integrazione dell'auto non parla piu' col suo servizio.
     *
     * Si riconosce dalle parole che scrive l'integrazione stessa — gettone,
     * sessione scaduta, credenziali — non da un codice HTTP. Un 401 o un 403
     * nudi sono un'altra cosa (vedi sotto), e confonderli manderebbe chi legge
     * a riconnettere un'integrazione che sta benissimo. */
    chiave: "autenticazione",
    segni:
      /\btoken\b|authenticat|autentic|credential|session (has )?expired|expired session|invalid.{0,12}(login|session|key)|re-?auth/i,
  }),
  Object.freeze({
    /* Home Assistant non autorizza CHI GUARDA a comandare quell'entita'.
     *
     * «Unauthorized», «Forbidden», un 401 o un 403 senza altro: qui
     * l'integrazione dell'auto e' sana, e a mancare e' il permesso dell'utente
     * della plancia — o l'entita' e' esposta in sola lettura. Riconnettere
     * l'integrazione non servirebbe a niente. */
    chiave: "permesso",
    segni: /unauthor|not authorized|forbidden|not allowed|permission|\b401\b|\b403\b/i,
  }),
  Object.freeze({
    chiave: "non-raggiungibile",
    segni:
      /time[ -]?out|timed out|unreachable|unavailable|not responding|no response|offline|connection (refused|reset|error)|\b50[234]\b/i,
  }),
]);

export function ragioneDelRifiuto(messaggio) {
  const testo = String(messaggio ?? "").trim();
  if (!testo) return "";
  return PAROLE_DEL_RIFIUTO.find((voce) => voce.segni.test(testo))?.chiave || "";
}
