/* Le aperture della sezione Sicurezza (#195).
 *
 * «Una sezione dove aprire portone del condominio e porta di casa, protetta
 * anche questa da codice per evitare aperture accidentali»: ogni riga e' una
 * porta — la serratura, il pulsante del citofono, il rele' del portone, il
 * cancello — con un nome, un'icona e un PIN facoltativo.
 *
 * Il PIN e' un cancello locale contro il tocco accidentale, non una serratura
 * crittografica: la centrale d'allarme verifica il suo codice in Home
 * Assistant, ma `button.press` e `switch.turn_on` un codice non lo accettano,
 * quindi l'unico posto dove chiederlo e' qui, prima di mandare il comando.
 *
 * Il modulo e' puro: guarda una riga e uno stato, non legge nient'altro.
 */

const clean = (value) => String(value ?? "").trim();

/** I domini che sanno aprire qualcosa. */
export const SECURITY_DOOR_DOMAINS = Object.freeze([
  "lock",
  "button",
  "input_button",
  "switch",
  "input_boolean",
  "cover",
  "script",
  "scene",
]);

export function isDoorEntity(value) {
  const entity = clean(value).toLowerCase();
  const domain = entity.split(".")[0];
  return entity.includes(".") && SECURITY_DOOR_DOMAINS.includes(domain);
}

/* Un PIN e' una sequenza di 4-8 cifre, come quello della centrale. Qualunque
 * altra cosa scritta nella casella non diventa un PIN a meta': sparisce. */
export function normalizeDoorPin(value) {
  const pin = clean(value);
  return /^\d{4,8}$/.test(pin) ? pin : "";
}

export function normalizeSecurityDoors(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item, index) => {
      const entity = clean(item?.entity || item?.entity_id);
      return {
        id: clean(item?.id) || `door-${index + 1}`,
        name: clean(item?.name),
        entity,
        icon: clean(item?.icon) || "🚪",
        pin: normalizeDoorPin(item?.pin),
        gesto: gestoDellaPorta(item),
      };
    })
    .filter((item) => isDoorEntity(item.entity));
}

/* Lo stesso rele' puo' essere una presa E un'apertura, e lo decide chi vive
 * in quella casa.
 *
 * Qui c'era una regola che scartava dalle aperture ogni entita' che comparisse
 * anche fra le Prese, e l'editor con quella regola RIPULIVA la lista salvata.
 * Nasceva per un macello di prese finite fra le aperture, ma la lista delle
 * aperture la scrive solo l'editor delle aperture: nessun altro ci mette
 * niente, quindi ogni riga li' dentro l'ha battuta qualcuno.
 *
 * Il risultato, dal campo (#378): «ho un cancelletto che si apre tramite un
 * sonoff mini d, ma quando cerco di inserire l'entita' switch.sonoff_...
 * non viene salvata». Ed era vero: la riga si salvava e il ridisegno
 * successivo la cancellava in silenzio, perche' quello stesso interruttore
 * stava anche fra le prese. Un cancello mosso da un rele' e' esattamente
 * questo — la stessa entita', due mestieri — e la plancia non e' chi decide
 * che di mestieri se ne fa uno solo.
 *
 * Cancellare in silenzio quello che uno ha configurato e' il peggiore dei
 * modi di avere ragione. */

/* Il bit con cui una serratura dichiara di sapersi APRIRE, oltre che
 * sbloccare: e' la differenza fra il chiavistello e il pulsante del portone. */
export const LOCK_SUPPORT_OPEN = 1;

/** Se questa serratura sa aprire, e non solo sbloccare. */
export function serraturaSaAprire(state) {
  const features = Number(state?.attributes?.supported_features);
  return Number.isFinite(features) && (features & LOCK_SUPPORT_OPEN) === LOCK_SUPPORT_OPEN;
}

/* I due gesti di una serratura, e la scelta di averli tutti e due (#387).
 *
 * «Gestire con Nuki separatamente sblocca/blocca e/o apri — evita apertura
 * indesiderata se si vuole solo sblocco.» Sono due cose diverse: `unlock` gira
 * la chiave, `open` tira indietro lo scrocco e la porta si apre. La plancia,
 * su una serratura che dichiara di saper fare tutte e due, ha sempre chiamato
 * `open`: il gesto piu' irreversibile era l'unico disponibile, proprio dove
 * sbagliare costa di piu'.
 *
 * Adesso lo dice chi ha la casa. Chi non ha scelto niente trova quello che ha
 * sempre avuto — cambiare sotto i piedi il tasto del portone a chi lo usa ogni
 * giorno sarebbe un modo di avere ragione a spese sue. */
export const GESTI_PORTA = Object.freeze(["apri", "sblocca", "entrambi"]);

export function gestoDellaPorta(door) {
  const scelto = clean(door?.gesto).toLowerCase();
  return GESTI_PORTA.includes(scelto) ? scelto : "";
}

const CHIAMATA_SBLOCCA = Object.freeze({ domain: "lock", service: "unlock", data: {} });
const CHIAMATA_APRI = Object.freeze({ domain: "lock", service: "open", data: {} });

/**
 * I gesti che questa apertura offre davvero, in ordine: prima quello che si
 * puo' disfare.
 *
 * Torna una voce sola per tutto quello che non e' una serratura — un pulsante
 * non ha due modi di essere premuto — e due solo per una serratura che sa fare
 * tutte e due e a cui e' stato chiesto di mostrarle entrambe.
 */
export function azioniDellaPorta(door, state = null) {
  const entity = clean(door?.entity);
  if (!isDoorEntity(entity)) return [];
  const domain = entity.toLowerCase().split(".")[0];
  const scelto = gestoDellaPorta(door);
  if (domain !== "lock") {
    const call = doorOpenCall(entity, state, scelto);
    return call ? [{ gesto: "apri", call }] : [];
  }
  if (!serraturaSaAprire(state)) return [{ gesto: "sblocca", call: CHIAMATA_SBLOCCA }];
  if (scelto === "sblocca") return [{ gesto: "sblocca", call: CHIAMATA_SBLOCCA }];
  if (scelto === "entrambi")
    return [
      { gesto: "sblocca", call: CHIAMATA_SBLOCCA },
      { gesto: "apri", call: CHIAMATA_APRI },
    ];
  return [{ gesto: "apri", call: CHIAMATA_APRI }];
}

/**
 * La chiamata che apre questa entita'. Torna dominio, servizio e dati; il
 * bersaglio lo mette chi chiama. Un dominio sconosciuto torna null: meglio
 * nessun comando che un comando inventato.
 */
export function doorOpenCall(entity, state = null, gesto = "") {
  const id = clean(entity).toLowerCase();
  const domain = id.split(".")[0];
  if (!isDoorEntity(id)) return null;
  if (domain === "lock") {
    /* Una serratura che non sa aprire ha un gesto solo, qualunque cosa sia
     * stata scelta: offrire `open` a chi non lo espone sarebbe un tasto che
     * non fa niente. */
    if (!serraturaSaAprire(state)) return { domain, service: "unlock", data: {} };
    const scelto = gestoDellaPorta({ gesto });
    /* Con tutti e due i tasti, questa e' la chiamata del primo — quello che si
     * puo' disfare. L'altro lo prende chi disegna, da `azioniDellaPorta`. */
    const sblocca = scelto === "sblocca" || scelto === "entrambi";
    return { domain, service: sblocca ? "unlock" : "open", data: {} };
  }
  if (domain === "button" || domain === "input_button")
    return { domain, service: "press", data: {} };
  if (domain === "cover") return { domain, service: "open_cover", data: {} };
  if (
    domain === "switch" ||
    domain === "input_boolean" ||
    domain === "script" ||
    domain === "scene"
  )
    return { domain, service: "turn_on", data: {} };
  return null;
}

/** Il PIN digitato apre questa porta? Una porta senza PIN e' sempre aperta al tocco confermato. */
export function doorPinMatches(door, typed) {
  const expected = normalizeDoorPin(door?.pin);
  if (!expected) return true;
  return clean(typed) === expected;
}
