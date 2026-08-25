/* Accendere e spegnere un termostato, qualunque impianto ci sia sotto.
 *
 * `climate.turn_off` sembra la cosa ovvia, ma in Home Assistant esiste solo se
 * l'integrazione dichiara di saperlo fare: quelle piu' vecchie — OpenWebNet e
 * Bticino MyHome fra le altre — non lo dichiarano, e la chiamata cade nel
 * vuoto. Da fuori si vede una zona che resta accesa per sempre e un pulsante
 * che non fa niente.
 *
 * Quello che ogni termostato sa fare e' cambiare modalita': se fra le sue c'e'
 * "off", spegnerlo vuol dire metterlo in "off". Qui si decide quale delle due
 * strade prendere, guardando cosa l'entita' dichiara di sapere. Niente DOM e
 * niente WebSocket: solo la scelta, che cosi' si puo' provare.
 */

const clean = (value) => String(value ?? "").trim();

/* I bit con cui Home Assistant dichiara di saper accendere e spegnere. Si
 * leggono per prudenza: se mancano non si conclude niente, perche' un'entita'
 * che non li espone puo' comunque avere la modalita' "off". */
export const CLIMATE_TURN_OFF = 128;
export const CLIMATE_TURN_ON = 256;

/* Con quale modalita' riaccendere, quando non sappiamo com'era prima. "auto" e
 * "heat_cool" lasciano decidere al termostato, che e' la scelta piu' prudente;
 * dopo vengono le due esplicite. */
const PREFERITE = Object.freeze(["auto", "heat_cool", "heat", "cool", "dry", "fan_only"]);

function modalita(state) {
  const elenco = state?.attributes?.hvac_modes;
  return Array.isArray(elenco) ? elenco.map(clean).filter(Boolean) : [];
}

function supporta(state, bit) {
  const dichiarate = Number(state?.attributes?.supported_features);
  return Number.isFinite(dichiarate) ? (dichiarate & bit) === bit : false;
}

/** La modalita' con cui riaccendere questa entita'.
 *
 * `richiesta` e' la modalita' che il contesto chiede adesso — la pompa di
 * calore accesa dal tab Caldo vuole "heat", dal tab Freddo "cool" (#195) — e
 * vince anche sulla modalita' ricordata: chi tocca il tasto in quel tab sta
 * dicendo cosa vuole ora, non com'era ieri. Se il termostato non la offre, si
 * torna alla scala di sempre. */
export function modalitaDiAccensione(state, precedente = "", richiesta = "") {
  const disponibili = modalita(state);
  const voluta = clean(richiesta);
  if (voluta && voluta !== "off" && disponibili.includes(voluta)) return voluta;
  const ricordata = clean(precedente);
  if (ricordata && ricordata !== "off" && disponibili.includes(ricordata)) return ricordata;
  for (const preferita of PREFERITE) {
    if (disponibili.includes(preferita)) return preferita;
  }
  return disponibili.find((voce) => voce !== "off") || "";
}

/* La chiamata da fare per accendere o spegnere.
 *
 * Torna il nome del servizio e i dati, senza il bersaglio: quello lo mette chi
 * chiama, che sa a quale entita' sta parlando. */
export function climatePowerCall(state, acceso, precedente = "", richiesta = "") {
  if (!acceso) {
    if (modalita(state).includes("off")) {
      return { service: "set_hvac_mode", data: { hvac_mode: "off" } };
    }
    return { service: "turn_off", data: {} };
  }
  const scelta = modalitaDiAccensione(state, precedente, richiesta);
  // Una modalita' chiesta esplicitamente dal contesto va impostata anche quando
  // l'entita' saprebbe fare `turn_on`: quel servizio riaccende com'era, e la
  // pompa di calore accesa dal tab Caldo tornerebbe a raffrescare.
  if (scelta && (clean(richiesta) === scelta || !supporta(state, CLIMATE_TURN_ON))) {
    return { service: "set_hvac_mode", data: { hvac_mode: scelta } };
  }
  if (supporta(state, CLIMATE_TURN_ON)) return { service: "turn_on", data: {} };
  if (scelta) return { service: "set_hvac_mode", data: { hvac_mode: scelta } };
  return { service: "turn_on", data: {} };
}

/** E' spenta? Lo stato di un termostato spento e' la modalita' "off". */
export function climateIsOff(state) {
  return clean(state?.state).toLowerCase() === "off";
}
