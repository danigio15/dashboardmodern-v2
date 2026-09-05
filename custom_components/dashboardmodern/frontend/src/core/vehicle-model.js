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

/** Tutte le entita' mappate da tutte le auto: serve a sapere se uno stato ci riguarda. */
export function vehicleEntities(list = []) {
  const ids = new Set();
  for (const car of array(list))
    for (const valore of Object.values(car?.[VEHICLE_OVERRIDES_FIELD] || {}))
      if (clean(valore).includes(".")) ids.add(clean(valore));
  return ids;
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
