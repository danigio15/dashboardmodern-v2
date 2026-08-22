/* Chi e' un'auto, e cosa le appartiene.
 *
 * Un profilo auto tiene il nome, la marca, il modello, le entita' mappate e le
 * sue due foto. Il runtime pero' lo risalva sostituendolo per intero: quando si
 * preme «Salva attuale» cerca un profilo con lo stesso nome e ci scrive sopra
 * un oggetto nuovo di zecca, `{ name, ov, img }`. Tutto il resto se ne andava
 * senza che nessuno l'avesse chiesto — la marca scelta nella Personalizzazione,
 * il modello, la foto col cavo attaccato — e chi rimappava un'entita' si
 * ritrovava l'auto senza logo e senza la seconda foto.
 *
 * Qui sta scritto cosa appartiene all'auto e come si riconosce una vettura da
 * un'altra: una chiave che nasce dal nome e dalla marca, e che il profilo puo'
 * portarsi scritta addosso per non cambiare piu' nemmeno se l'auto viene
 * rinominata. Serve a ritrovare la stessa auto quando l'elenco viene riscritto
 * — che e' esattamente il momento in cui le cose si perdono.
 *
 * Il modulo e' puro: niente DOM, niente localStorage. Chi legge e chi scrive
 * sta nella sezione.
 */

const clean = (value) => String(value ?? "").trim();

/** Il campo in cui l'auto tiene la sua chiave. */
export const CAR_KEY_FIELD = "uid";

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

/**
 * La chiave di un'auto.
 *
 * Se il profilo se la porta gia' scritta vale quella, e non cambia piu' nemmeno
 * se l'auto viene rinominata. Se non ce l'ha si ricava da come si chiama, e non
 * c'e' niente da scrivere da nessuna parte.
 *
 * Quel «niente da scrivere» e' il punto. Il primo giro assegnava le chiavi
 * all'avvio e salvava l'elenco per renderle durevoli, e quel salvataggio
 * partiva da una fotografia presa quando era stato chiamato: se nel frattempo
 * qualcuno cambiava la marca di un'auto, il salvataggio atterrava dopo e la
 * riportava indietro. Si sceglieva MINI e un istante dopo tornava Leapmotor.
 * Una chiave che si ricava non ha bisogno di essere salvata, quindi non puo'
 * riportare indietro niente.
 */
export function carKey(car = {}) {
  return clean(car?.[CAR_KEY_FIELD]) || carSlug(car);
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
  /* Si guarda solo la chiave *scritta*, non quella ricavata: ricavata ce l'hanno
   * tutte, e prendendo quella non ci sarebbe mai niente da assegnare. */
  const scritta = (car) => clean(car?.[CAR_KEY_FIELD]);
  const prese = new Set(cars.map(scritta).filter(Boolean));
  let cambiato = false;
  const uscita = cars.map((car, posto) => {
    if (scritta(car)) return car;
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
