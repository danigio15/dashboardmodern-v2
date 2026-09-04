/* L'auto che va a benzina (#208).
 *
 * «Ho la mia auto che ha i sensori di livello carburante, odometro, autonomia
 * e portiere: e' possibile scegliere a monte se visualizzare un'auto
 * elettrica o classica con i sensori disponibili?» E, dal campo: «anche lo
 * stato dei finestrini e la pressione dei pneumatici».
 *
 * La pagina Auto era nata elettrica: batteria, wallbox, sessione di ricarica.
 * Un'auto a benzina ha un altro quadro — quanto carburante, quanti chilometri,
 * se e' chiusa, se il motore gira — e quello che le integrazioni dicono lo
 * dicono ognuna a modo suo: «locked» e «bloccato», «on» e «running», un
 * allarme che e' «in esecuzione». Questo modulo legge quei dialetti e li
 * riduce a numeri e a codici; le parole per dirli stanno nella sezione.
 *
 * Le caselle sono `dm.ev_*` come le altre della pagina Auto: entrano nel
 * profilo della vettura per la stessa strada, e il salvataggio non deve
 * imparare niente di nuovo.
 */

const pulito = (valore) => String(valore ?? "").trim();
const minuscolo = (valore) => pulito(valore).toLowerCase();

const numero = (valore) => {
  if (valore === null || valore === undefined || pulito(valore) === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

/* Le caselle dell'auto termica, con il tipo di lettura di ognuna. Il glifo e'
 * quello che la tessera in Home e la pagina usano: una famiglia sola.
 *
 * `autonomia` e `odometro` non stanno qui: sono `dm.ev_autonomia` e
 * `dm.ev_odometro`, che la pagina ha gia' e che valgono per qualunque motore. */
export const CASELLE_TERMICHE = Object.freeze([
  Object.freeze({ ref: "dm.ev_carburante", campo: "carburante", tipo: "percento", glifo: "⛽" }),
  Object.freeze({ ref: "dm.ev_motore", campo: "motore", tipo: "acceso", glifo: "🔑" }),
  Object.freeze({ ref: "dm.ev_portiere", campo: "portiere", tipo: "serratura", glifo: "🚪" }),
  Object.freeze({ ref: "dm.ev_finestrini", campo: "finestrini", tipo: "apertura", glifo: "🪟" }),
  Object.freeze({ ref: "dm.ev_allarme", campo: "allarme", tipo: "allarme", glifo: "🚨" }),
  Object.freeze({
    ref: "dm.ev_batteria_servizio",
    campo: "batteriaServizio",
    tipo: "percento",
    glifo: "🔋",
  }),
  Object.freeze({ ref: "dm.ev_temperatura_olio", campo: "olio", tipo: "gradi", glifo: "🛢️" }),
  Object.freeze({ ref: "dm.ev_temperatura_esterna", campo: "esterna", tipo: "gradi", glifo: "🌡️" }),
  Object.freeze({ ref: "dm.ev_ultimo_viaggio", campo: "ultimoViaggio", tipo: "km", glifo: "🧭" }),
  Object.freeze({
    ref: "dm.ev_carburante_totale",
    campo: "carburanteTotale",
    tipo: "litri",
    glifo: "⛽",
  }),
  Object.freeze({ ref: "dm.ev_pneumatici", campo: "pneumatici", tipo: "pressione", glifo: "🛞" }),
]);

/** I riferimenti, per chi deve sapere se uno stato riguarda un'auto termica. */
export const RIFERIMENTI_TERMICI = Object.freeze(CASELLE_TERMICHE.map((voce) => voce.ref));

/* ── i dialetti ───────────────────────────────────────────────────────── */

/* Acceso o spento, comunque lo dica l'integrazione: il motore di una
 * Stellantis e' «Spento», quello di una Hyundai «off», un binary_sensor «on». */
const ACCESO = /^(on|true|1|running|started|acceso|acceso[_ ]?motore|in[_ ]moto|on_running)$/;
const SPENTO = /^(off|false|0|stopped|spento|fermo|idle|parked)$/;

export function accesoDalloStato(stato) {
  const voce = minuscolo(stato);
  if (!voce) return null;
  if (ACCESO.test(voce)) return true;
  if (SPENTO.test(voce)) return false;
  return null;
}

/* Le portiere: bloccate, sbloccate, aperte, chiuse. Un `lock.*` dice
 * «locked»; un sensore di apertura dice «open». */
export function serraturaDalloStato(stato) {
  const voce = minuscolo(stato);
  if (!voce) return null;
  if (/^(locked|bloccat[oae]|chius[oae]\s+a\s+chiave|closed_locked)$/.test(voce)) return "bloccate";
  if (/^(unlocked|sbloccat[oae]|unlocking|locking)$/.test(voce)) return "sbloccate";
  if (/^(open|aperta|aperte|aperto|on|opening)$/.test(voce)) return "aperte";
  if (/^(closed|chius[oae]|off)$/.test(voce)) return "chiuse";
  return null;
}

/* I finestrini: aperti o chiusi, da un binary_sensor o da una parola. */
export function aperturaDalloStato(stato) {
  const voce = minuscolo(stato);
  if (!voce) return null;
  if (/^(open|on|true|apert[oaie]|opened|partially_open|semi)$/.test(voce)) return "aperti";
  if (/^(closed|off|false|chius[oaie])$/.test(voce)) return "chiusi";
  return null;
}

/* L'allarme: inserito, disinserito, scattato. «In esecuzione» e' come lo
 * scrive Stellantis quando e' inserito. */
export function allarmeDalloStato(stato) {
  const voce = minuscolo(stato);
  if (!voce) return null;
  if (/^(triggered|scattat[oa]|alarm|allarme)$/.test(voce)) return "scattato";
  if (
    /^(armed|armed_away|armed_home|on|true|1|attiv[oa]|inserit[oa]|in[_ ]esecuzione|running|enabled)$/.test(
      voce,
    )
  )
    return "inserito";
  if (/^(disarmed|off|false|0|spent[oa]|disinserit[oa]|disabled)$/.test(voce)) return "disinserito";
  return null;
}

/* I pneumatici: una pressione con la sua unita', oppure un avviso si'/no. */
export function pneumaticiDalloStato(stato, unita = "") {
  const voce = minuscolo(stato);
  if (!voce) return null;
  const n = numero(voce);
  if (n !== null) return { pressione: n, unita: pulito(unita) || "bar", avviso: null };
  if (/^(on|true|low|bass[ao]|warning|avviso|problem)$/.test(voce))
    return { pressione: null, unita: "", avviso: true };
  if (/^(off|false|ok|normal|normale|good)$/.test(voce))
    return { pressione: null, unita: "", avviso: false };
  return null;
}

/* ── la lettura ───────────────────────────────────────────────────────── */

/**
 * Il quadro dell'auto termica, adesso.
 *
 * `mappa` e' la mappatura della vettura — `{ "dm.ev_carburante": "sensor.x" }`
 * — come sta nel suo profilo; `resolve` e' il ripiego per chi legge le chiavi
 * globali. Quello che manca resta `null`, e chi disegna non lo disegna: una
 * casella non mappata non e' un valore a zero.
 */
export function letturaTermica(mappa = {}, states = {}, resolve = null) {
  const statoDi = (ref) => {
    let entity = pulito(mappa?.[ref]);
    if (!entity && typeof resolve === "function") {
      try {
        const risolto = pulito(resolve(ref));
        if (risolto && risolto !== ref) entity = risolto;
      } catch (_error) {
        entity = "";
      }
    }
    if (!entity) return { entity: "", stato: null };
    return { entity, stato: states?.[entity] || null };
  };
  const fuori = { caselle: {} };
  for (const voce of CASELLE_TERMICHE) {
    const { entity, stato } = statoDi(voce.ref);
    if (!entity) continue;
    const grezzo = stato ? pulito(stato.state) : "";
    const unita = pulito(stato?.attributes?.unit_of_measurement);
    const muto = !stato || /^(unknown|unavailable|none|)$/i.test(grezzo);
    let valore = null;
    if (!muto)
      switch (voce.tipo) {
        case "percento": {
          const n = numero(grezzo);
          valore = n === null ? null : Math.max(0, Math.min(100, n));
          break;
        }
        case "gradi":
        case "km":
        case "litri":
          valore = numero(grezzo);
          break;
        case "acceso":
          valore = accesoDalloStato(grezzo);
          break;
        case "serratura":
          valore = serraturaDalloStato(grezzo);
          break;
        case "apertura":
          valore = aperturaDalloStato(grezzo);
          break;
        case "allarme":
          valore = allarmeDalloStato(grezzo);
          break;
        case "pressione":
          valore = pneumaticiDalloStato(grezzo, unita);
          break;
        default:
          valore = grezzo;
      }
    fuori.caselle[voce.campo] = {
      ref: voce.ref,
      entity,
      grezzo,
      unita,
      muto,
      valore,
      tipo: voce.tipo,
      glifo: voce.glifo,
    };
    fuori[voce.campo] = valore;
  }
  /* Le due caselle che la pagina ha gia' e che valgono per ogni motore. */
  const autonomia = statoDi("dm.ev_autonomia");
  const odometro = statoDi("dm.ev_odometro");
  fuori.autonomia = autonomia.entity ? numero(autonomia.stato?.state) : null;
  fuori.autonomiaUnita = pulito(autonomia.stato?.attributes?.unit_of_measurement) || "km";
  fuori.odometro = odometro.entity ? numero(odometro.stato?.state) : null;
  fuori.odometroUnita = pulito(odometro.stato?.attributes?.unit_of_measurement) || "km";
  /* Quando l'auto chiede attenzione: l'allarme scattato, le portiere aperte
   * col motore spento, i pneumatici in avviso, il carburante in riserva. */
  fuori.attenzione =
    fuori.allarme === "scattato" ||
    (fuori.portiere === "aperte" && fuori.motore === false) ||
    fuori.pneumatici?.avviso === true ||
    (fuori.carburante !== null && fuori.carburante !== undefined && fuori.carburante <= 10);
  fuori.qualcosa = Object.keys(fuori.caselle).length > 0;
  return fuori;
}
