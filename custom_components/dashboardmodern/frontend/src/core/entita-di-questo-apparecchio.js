/* Quali entita' sono di QUESTO apparecchio, e non di quello accanto (#417).
 *
 * «Il frigorifero 1 posto in cucina prende correttamente il sensore di potenza
 * (uno shelly em) ma mi mostra il valore di un sensore di temperatura zigbee
 * che ho messo all'interno di un diverso frigorifero (frigorifero 2) che si
 * trova in un'altra stanza. Se vado in configurazione vedo che mi associa in
 * automatico una presa smart che e' collegata al frigorifero 2. Anche se
 * cancello l'associazione, quando ritorno in configurazione me la ritrovo
 * sempre. Mi ricarica sempre in automatico circa 30 sensori.»
 *
 * C'e' una passata che, per un apparecchio con le caselle vuote, prova a
 * indovinare le sue entita' guardando i nomi di tutta la casa. Serve a chi non
 * ha mai configurato niente, e per una casa con un frigorifero solo funziona.
 * Con due frigoriferi diventa il contrario di un aiuto, per due ragioni che
 * questo modulo toglie.
 *
 * LA PRIMA: fra le parole con cui si cercava c'era anche il TIPO
 * dell'apparecchio — `visual_key`, `device_type`, cioe' «frigo». Ma il tipo
 * dice che cos'e' una cosa, non QUALE: tutti i frigoriferi della casa hanno lo
 * stesso tipo, quindi ognuno si prendeva le entita' di tutti gli altri. La
 * presa del frigorifero 2 finiva sul frigorifero 1 perche' nel suo nome c'e'
 * «frigo», e basta quello.
 *
 * LA SECONDA: bastava che UNA parola combaciasse. «Frigorifero 1» cercava
 * `frigorifero`, e `sensor.frigorifero_2_temperatura` quella parola ce l'ha:
 * dentro. Il numero — l'unica cosa che distingue il primo dal secondo — veniva
 * buttato via perche' corto. Adesso le parole devono combaciare TUTTE, e i
 * numeri contano: sono il modo in cui una casa vera distingue due cose uguali.
 *
 * Il modulo e' puro: entrano l'apparecchio e un nome di entita', esce se e'
 * suo. Chi legge gli stati e chi scrive la configurazione sta altrove.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Parole che non distinguono niente: ci sono su tutto. */
const PAROLE_DI_TUTTI = Object.freeze(
  new Set(["appl", "appliance", "device", "dispositivo", "generic", "generico", "load", "carico"]),
);

/** Il nome ridotto a parole: minuscole, senza accenti, separate dal trattino. */
export function aParole(valore) {
  return pulito(valore)
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Una parola conta se e' lunga almeno tre lettere — «tv» dentro un nome lo
 * trova ovunque — oppure se e' un numero: «1» e «2» sono corti, e sono
 * esattamente quello che distingue il frigorifero 1 dal frigorifero 2. */
function contaComeParola(parola) {
  if (PAROLE_DI_TUTTI.has(parola)) return false;
  return parola.length >= 3 || /^\d+$/.test(parola);
}

/**
 * Le parole con cui riconoscere le entita' di questo apparecchio.
 *
 * Vengono dal NOME, che e' la sua identita'. Non dal tipo: quello dice che
 * cos'e', e due frigoriferi sono tutti e due frigoriferi. L'identificativo si
 * guarda solo quando un nome non c'e', per non lasciare senza chi non l'ha
 * ancora scritto.
 */
export function paroleDellApparecchio(apparecchio = {}) {
  const dal = (valore) =>
    aParole(valore)
      .split("-")
      .filter(
        (parola, indice, tutte) => contaComeParola(parola) && tutte.indexOf(parola) === indice,
      );
  const dalNome = dal(apparecchio?.name);
  if (dalNome.length) return dalNome;
  return dal(pulito(apparecchio?.id).replace(/^(?:appl|load|device)-/i, ""));
}

/**
 * Se questa entita' e' di questo apparecchio, a giudicare dal nome.
 *
 * TUTTE le parole devono esserci. Bastandone una, «Frigorifero 1» si prendeva
 * `sensor.frigorifero_2_temperatura`: la parola «frigorifero» c'e', ed era
 * abbastanza. E' la stessa regola con cui il menu delle integrazioni cerca i
 * parenti di un dispositivo fuori da lui, dove funziona da sempre.
 */
export function eDiQuestoApparecchio(entity, parole = []) {
  if (!parole.length) return false;
  const nome = aParole(pulito(entity).split(".").pop());
  if (!nome) return false;
  const pezzi = new Set(nome.split("-"));
  return parole.every((parola) => pezzi.has(parola));
}

/** Le entita' della casa che sono di questo apparecchio. */
export function entitaDiQuestoApparecchio(apparecchio = {}, nomiDellaCasa = []) {
  const parole = paroleDellApparecchio(apparecchio);
  if (!parole.length) return [];
  return nomiDellaCasa.filter((entity) => eDiQuestoApparecchio(entity, parole));
}

/**
 * Le parole degli ALTRI apparecchi dell'elenco, per sapere di chi e' un'entita'
 * quando non e' nostra.
 *
 * Serve a due cose. La prima: due nomi possono essere uno dentro l'altro —
 * «Frigo» e «Frigo 2» — e allora `sensor.frigo_2_temperatura` le parole di
 * «Frigo» le ha tutte, ma di «Frigo 2» ne ha una in piu'. Vince chi la
 * riconosce con piu' parole: e' l'unico modo di distinguerli.
 *
 * La seconda: un'entita' gia' scritta in configurazione che porta il nome di un
 * altro apparecchio non e' di questo. E' cosi' che si tolgono le associazioni
 * sbagliate rimaste da prima — «anche se cancello l'associazione me la ritrovo
 * sempre» — senza toccare quelle che non sappiamo attribuire a nessuno.
 */
export function paroleDegliAltri(apparecchio = {}, elenco = []) {
  const nostre = paroleDellApparecchio(apparecchio).join("-");
  const viste = new Set([nostre]);
  const fuori = [];
  for (const altro of elenco) {
    if (!altro || altro === apparecchio) continue;
    const parole = paroleDellApparecchio(altro);
    const firma = parole.join("-");
    if (!parole.length || viste.has(firma)) continue;
    viste.add(firma);
    fuori.push(parole);
  }
  return fuori;
}

/**
 * Se questa entita' e' di un altro apparecchio, e non di questo.
 *
 * Vera solo quando qualcun altro la riconosce meglio di noi: se non la
 * riconosce nessuno resta dov'e', perche' non saperla attribuire non e' una
 * prova che sia nel posto sbagliato.
 */
export function eDiUnAltroApparecchio(entity, parole = [], altrui = []) {
  const mia = eDiQuestoApparecchio(entity, parole);
  return altrui.some(
    (altre) => eDiQuestoApparecchio(entity, altre) && (!mia || altre.length > parole.length),
  );
}
