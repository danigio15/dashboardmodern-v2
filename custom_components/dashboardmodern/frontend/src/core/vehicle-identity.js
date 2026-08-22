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
export function keepCarIdentity(nuova = {}, precedente = {}, eraAttiva = true) {
  const rimessi = {};
  for (const campo of CAR_IDENTITY_FIELDS) {
    if (campo === "imgPlugged") continue; // le foto si decidono sotto, insieme a "img".
    if (clean(nuova?.[campo])) continue;
    const valore = precedente?.[campo];
    if (clean(valore)) rimessi[campo] = valore;
  }
  /* Le due foto sono un caso a parte da tutto il resto.
   *
   * Il runtime le cattura dalle due caselle piatte della plancia — quella
   * senza cavo e quella con — che pero' mostrano l'auto *attiva*, non
   * necessariamente quella che si sta risalvando: la configurazione lascia
   * aprire l'accordion di un'auto e modificarne la mappatura delle entita'
   * senza prima averla resa attiva. Se era davvero lei l'auto attiva, quello
   * che le caselle mostravano era suo, ed e' giusto che vinca — e' il motivo
   * per cui si stava risalvando. Se non lo era, quello che le caselle
   * mostravano era dell'altra: non e' una scelta fatta su questa vettura, e'
   * un caso, e non deve sostituire la foto che questa vettura aveva davvero
   * — foto che vince anche quando e' vuota, perche' un caso non e' meglio di
   * niente. */
  for (const campo of ["img", "imgPlugged"]) {
    if (eraAttiva) {
      if (clean(nuova?.[campo])) continue;
      const valore = precedente?.[campo];
      if (clean(valore)) rimessi[campo] = valore;
    } else {
      rimessi[campo] = clean(precedente?.[campo]);
    }
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
export function restoreCarIdentities(cars, precedenti, indiceAttivoPrima = null) {
  if (!Array.isArray(cars) || !cars.length || !Array.isArray(precedenti) || !precedenti.length)
    return assignCarKeys(cars);
  /* Si riconosce per la chiave *scritta*, non per quella ricavata.
   *
   * Una chiave ricavata ce l'hanno tutte, e nasce dal nome: un'auto nuova
   * chiamata quasi come una vecchia ne ricava la stessa, e cosi' si sarebbe
   * presa la sua identita' — due profili con la stessa chiave, e sceglierne
   * uno apriva l'altro. Una chiave scritta invece l'ha solo chi l'ha gia'
   * ricevuta: e' un'identita', non una somiglianza. */
  const perChiave = new Map();
  const perNome = new Map();
  precedenti.forEach((car, indice) => {
    const chiave = clean(car?.[CAR_KEY_FIELD]);
    if (chiave && !perChiave.has(chiave)) perChiave.set(chiave, { car, indice });
    /* Il nome si confronta esatto, com'e' scritto.
     *
     * Il runtime cerca il profilo da sostituire con `cars[ci].name === n`, cioe'
     * distinguendo le maiuscole: «Tesla» e «tesla» per lui sono due auto. Qui si
     * confrontava a maiuscole appiattite, e una seconda auto chiamata quasi come
     * la prima si prendeva la chiave di quella — due profili con la stessa
     * chiave, e sceglierne uno apriva l'altro. */
    const nome = clean(car?.name);
    if (nome && !perNome.has(nome)) perNome.set(nome, { car, indice });
  });
  const uscita = cars.map((car) => {
    const trovato = perChiave.get(clean(car?.[CAR_KEY_FIELD])) || perNome.get(clean(car?.name));
    if (!trovato) return car;
    /* Chi non passa l'indice di prima (i chiamanti di sempre, e le prove di
     * sempre) ottiene il comportamento di sempre: si assume che l'auto
     * risalvata fosse quella attiva, perche' e' cosi' che ha sempre
     * funzionato con un'auto sola. */
    const eraAttiva = indiceAttivoPrima === null || trovato.indice === indiceAttivoPrima;
    return keepCarIdentity(car, trovato.car, eraAttiva);
  });
  return assignCarKeys(uscita);
}
