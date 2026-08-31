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
      };
    })
    .filter((item) => isDoorEntity(item.entity));
}

/* Una presa non e' una porta, anche se il dominio (switch.*) e' lo stesso.
 *
 * Dal campo: entita' delle Prese comparse fra le aperture della Sicurezza —
 * la configurazione condivisa se le porta su ogni dispositivo. Chi disegna
 * passa qui l'insieme delle entita' occupate altrove (le prese) e le porte
 * che le usano si scartano. */
export function doorsSenzaOccupate(doors, occupate) {
  if (!Array.isArray(doors)) return [];
  if (!(occupate instanceof Set) || !occupate.size) return doors;
  return doors.filter((door) => !occupate.has(clean(door?.entity).toLowerCase()));
}

/* Il bit con cui una serratura dichiara di sapersi APRIRE, oltre che
 * sbloccare: e' la differenza fra il chiavistello e il pulsante del portone. */
export const LOCK_SUPPORT_OPEN = 1;

/**
 * La chiamata che apre questa entita'. Torna dominio, servizio e dati; il
 * bersaglio lo mette chi chiama. Un dominio sconosciuto torna null: meglio
 * nessun comando che un comando inventato.
 */
export function doorOpenCall(entity, state = null) {
  const id = clean(entity).toLowerCase();
  const domain = id.split(".")[0];
  if (!isDoorEntity(id)) return null;
  if (domain === "lock") {
    const features = Number(state?.attributes?.supported_features);
    const apre = Number.isFinite(features) && (features & LOCK_SUPPORT_OPEN) === LOCK_SUPPORT_OPEN;
    return { domain, service: apre ? "open" : "unlock", data: {} };
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
