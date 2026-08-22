/* Ogni auto ha un nome suo, e da qui in avanti anche una chiave sua.
 *
 * Un profilo auto si e' sempre indicato con la sua posizione nell'elenco:
 * `cd_ev_car_active` e' il numero della riga. Finche' le auto sono una sola la
 * posizione e' un'identita' accettabile; da due in su non lo e' piu', perche'
 * cambia sotto i piedi. Si cancella la prima e la seconda diventa la prima:
 * chi si era segnato «la seconda» adesso indica un'altra vettura. Si riordina,
 * e succede lo stesso. E quella posizione viaggia nella configurazione
 * condivisa: il numero salvato da un dispositivo arriva su un altro e li'
 * indica quello che capita.
 *
 * Da qui si vedeva la cosa che e' stata segnalata: la plancia si apriva
 * sull'auto giusta — l'aveva scelta chi stava davanti — e poco dopo passava
 * all'altra, quando arrivava la configurazione condivisa con dentro un numero
 * scritto altrove.
 *
 * La chiave e' dell'auto: nasce dal nome e dalla marca, si scrive dentro al
 * profilo la prima volta che la si vede, e da li' non cambia piu' — nemmeno se
 * l'auto viene rinominata, perche' e' lei la stessa auto. Tutto quello che si
 * configura per una vettura — le entita' mappate, le due foto, la marca, il
 * modello — sta dentro quel profilo, e ci si arriva per chiave, mai per
 * posizione.
 *
 * Il modulo e' puro: niente DOM, niente localStorage. Chi legge e chi scrive
 * sta nella sezione.
 */

const clean = (value) => String(value ?? "").trim();

/** Il campo in cui l'auto tiene la sua chiave. */
export const CAR_KEY_FIELD = "uid";

/** La casella in cui la plancia si segna quale auto sta guardando. */
export const ACTIVE_CAR_KEY = "cd_ev_car_key";

/* Quello che si perde quando il runtime risalva un profilo.
 *
 * `edEvCarAdd` cerca un profilo con lo stesso nome e, trovandolo, ci scrive
 * sopra un oggetto nuovo di zecca: `{ name, ov, img }`. Tutto il resto — la
 * marca scelta nella Personalizzazione, il modello, la foto col cavo attaccato,
 * e adesso la chiave — spariva senza che nessuno lo chiedesse. Sono i campi che
 * appartengono all'auto e non al giro di mappatura, e vanno rimessi. */
export const CAR_IDENTITY_FIELDS = Object.freeze([
  CAR_KEY_FIELD,
  "brand",
  "model",
  "icon",
  "imgPlugged",
]);

/** Il pezzo di chiave che si ricava da come l'auto si chiama. */
export function carSlug(car = {}) {
  const parole = [clean(car.brand), clean(car.name)].filter(Boolean).join("-");
  const slug = parole
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug;
}

/** La chiave che questa auto si porta gia' dietro, se ce l'ha. */
export function carKey(car = {}) {
  return clean(car?.[CAR_KEY_FIELD]);
}

/**
 * L'elenco con una chiave su ogni auto che ancora non ne ha.
 *
 * Si assegna una volta e non si tocca piu': una chiave che cambia non e' una
 * chiave. Chi ne ha gia' una se la tiene anche se nel frattempo il nome e'
 * cambiato — e' sempre quella vettura.
 *
 * Restituisce lo stesso elenco quando non c'e' niente da assegnare, cosi' chi
 * scrive puo' fermarsi senza confrontare.
 */
export function assignCarKeys(cars) {
  if (!Array.isArray(cars) || !cars.length) return cars;
  const prese = new Set(cars.map(carKey).filter(Boolean));
  let cambiato = false;
  const uscita = cars.map((car, posto) => {
    if (carKey(car)) return car;
    const base = carSlug(car) || `auto-${posto + 1}`;
    let chiave = base;
    // Due auto possono chiamarsi uguale: la seconda prende un numero, e da li'
    // in poi resta sua.
    for (let numero = 2; prese.has(chiave); numero += 1) chiave = `${base}-${numero}`;
    prese.add(chiave);
    cambiato = true;
    return { ...car, [CAR_KEY_FIELD]: chiave };
  });
  return cambiato ? uscita : cars;
}

/** Dove sta, nell'elenco, l'auto con questa chiave. `-1` se non c'e' piu'. */
export function carIndexByKey(cars, key) {
  const cercata = clean(key);
  if (!cercata || !Array.isArray(cars)) return -1;
  return cars.findIndex((car) => carKey(car) === cercata);
}

/**
 * Quale auto sta guardando la plancia.
 *
 * La chiave viene prima, perche' e' l'unica che indica una vettura e non una
 * riga. La posizione resta come ripiego per chi arriva da una configurazione
 * in cui le chiavi non c'erano ancora, e per il runtime che continua a
 * scriversi il numero. Se non regge ne' l'una ne' l'altra si torna alla prima:
 * una plancia senz'auto scelta ne mostra comunque una.
 */
export function resolveActiveIndex(cars, key, fallbackIndex = -1) {
  if (!Array.isArray(cars) || !cars.length) return -1;
  const perChiave = carIndexByKey(cars, key);
  if (perChiave >= 0) return perChiave;
  const numero = Number(fallbackIndex);
  if (Number.isInteger(numero) && numero >= 0 && numero < cars.length) return numero;
  return 0;
}

/**
 * Rimette all'auto i campi che le appartengono.
 *
 * Serve dopo che il runtime ha risalvato un profilo sostituendolo per intero:
 * l'auto e' la stessa — stesso nome, stessa riga — e tutto quello che non
 * riguarda la mappatura delle entita' deve ritrovarsi dov'era.
 */
export function keepCarIdentity(nuova = {}, precedente = {}) {
  const rimessi = {};
  for (const campo of CAR_IDENTITY_FIELDS) {
    if (clean(nuova?.[campo])) continue;
    const valore = precedente?.[campo];
    if (clean(valore)) rimessi[campo] = valore;
  }
  return Object.keys(rimessi).length ? { ...nuova, ...rimessi } : nuova;
}

/**
 * L'elenco appena risalvato, con addosso le identita' di quello di prima.
 *
 * Le auto si riconoscono per chiave; quelle nate adesso — che una chiave non
 * ce l'hanno — si riconoscono per nome, che e' esattamente il modo in cui il
 * runtime ha deciso di sovrascriverle.
 */
export function restoreCarIdentities(cars, precedenti) {
  if (!Array.isArray(cars) || !cars.length || !Array.isArray(precedenti) || !precedenti.length)
    return assignCarKeys(cars);
  const perChiave = new Map();
  const perNome = new Map();
  for (const car of precedenti) {
    const chiave = carKey(car);
    if (chiave) perChiave.set(chiave, car);
    const nome = clean(car?.name).toLowerCase();
    if (nome && !perNome.has(nome)) perNome.set(nome, car);
  }
  const uscita = cars.map((car) => {
    const prima = perChiave.get(carKey(car)) || perNome.get(clean(car?.name).toLowerCase());
    return prima ? keepCarIdentity(car, prima) : car;
  });
  return assignCarKeys(uscita);
}
