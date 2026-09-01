/* Il gruppo di continuita' (#256).
 *
 * «Chiedo se c'e' la possibilita' di gestire un UPS: vedere se c'e' tensione o
 * no, lo stato della batteria e il carico.»
 *
 * Tre domande, e la prima comanda le altre due. A rete presente la carica
 * della batteria e' una conferma tranquilla — sta al cento per cento perche'
 * non e' successo niente — e il carico dice quanto sta reggendo. Quando la
 * rete cade quelle stesse due cifre diventano un conto alla rovescia: quanto
 * resta prima che si spenga tutto. Percio' la tessera non mostra sempre lo
 * stesso numero: mostra quello che serve nel momento in cui lo si guarda.
 *
 * Le sigle le scrivono NUT, APC ed Eaton e non le deve tradurre chi configura:
 * `OL` e' in linea, `OB` a batteria, `LB` batteria scarica, e arrivano spesso
 * accoppiate — «OL CHRG» e' in linea mentre carica, «OB DISCHRG» a batteria
 * mentre si scarica.
 *
 * Qui non c'e' DOM e non si chiama nessun servizio: solo la lettura e il conto.
 */

/** La chiave in cui vive la configurazione. */
export const CHIAVE_UPS = "cd_ups";

/* Sotto questa carica un UPS non e' piu' una rete di sicurezza: e' un timer.
 * Venti per cento e' la soglia a cui quasi tutti i gruppi cominciano a
 * suonare, ed e' il momento in cui vale la pena dirlo in Home. */
export const BATTERIA_BASSA = 20;

/* Cosa si guarda di un gruppo di continuita', e in che ordine.
 *
 * La rete per prima: senza quella le altre due cifre non si sa nemmeno come
 * leggerle. Poi la batteria, poi il carico — che e' la domanda «quanto sto
 * chiedendo a questa scatola» e serve a capire perche' l'autonomia e' quella
 * che e'. */
export const CASELLE_UPS = Object.freeze([
  { campo: "stato", tipo: "stato" },
  { campo: "rete", tipo: "acceso" },
  { campo: "batteria", tipo: "percento" },
  { campo: "carico", tipo: "percento" },
  { campo: "autonomia", tipo: "minuti" },
  { campo: "tensione", tipo: "volt" },
  { campo: "potenza", tipo: "watt" },
  { campo: "temperatura", tipo: "gradi" },
]);

const clean = (value) => String(value ?? "").trim();

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const dato = Number(valore);
  return Number.isFinite(dato) ? dato : null;
};

/* Le sigle di NUT, spezzate: arrivano accoppiate — «OL CHRG», «OB DISCHRG» —
 * e leggere la stringa intera vorrebbe dire non riconoscerne nessuna. */
const IN_LINEA = new Set(["ol", "online", "on_line", "mains", "utility"]);
const A_BATTERIA = new Set(["ob", "onbatt", "onbattery", "on_battery", "battery", "backup"]);
const SCARICA = new Set(["lb", "lowbatt", "low_battery"]);

function sigle(state) {
  return clean(state)
    .toLowerCase()
    .split(/[\s,|/]+/)
    .filter(Boolean);
}

/**
 * Cosa dice lo stato dell'UPS: rete presente, assente, o non si sa.
 *
 * Vale sia per la stringa di NUT sia per un `binary_sensor` acceso/spento,
 * perche' chi ha l'uno non ha l'altro e la casella e' una sola.
 */
export function reteDalloStato(state) {
  const pezzi = sigle(state);
  if (!pezzi.length) return null;
  if (pezzi.some((pezzo) => A_BATTERIA.has(pezzo))) return false;
  if (pezzi.some((pezzo) => IN_LINEA.has(pezzo))) return true;
  /* Un binary_sensor della rete: acceso vuol dire che la corrente c'e'. Chi ha
   * un sensore che dice il contrario — «power failure» — lo gira con la
   * casella apposta, che e' l'unico modo onesto: dallo stato non si capisce. */
  if (pezzi.includes("on") || pezzi.includes("true")) return true;
  if (pezzi.includes("off") || pezzi.includes("false")) return false;
  return null;
}

/** Se lo stato dichiara la batteria scarica, comunque sia scritto. */
export function batteriaScaricaDalloStato(state) {
  return sigle(state).some((pezzo) => SCARICA.has(pezzo));
}

/** La configurazione, ripulita. */
export function normalizzaUps(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const fuori = {
    name: clean(dato.name),
    invertita: dato.invertita === true || dato.invertita === "on",
  };
  for (const { campo } of CASELLE_UPS) fuori[campo] = clean(dato[campo]);
  return fuori;
}

/** Le entita' che l'UPS tiene d'occhio. */
export function entitaDellUps(config) {
  const dato = normalizzaUps(config);
  return CASELLE_UPS.map(({ campo }) => dato[campo]).filter(Boolean);
}

/**
 * Come sta l'UPS adesso.
 *
 * `rete` a `false` e' l'unico caso in cui questa scatola smette di essere un
 * dettaglio: da li' in poi la casa va a batteria e ogni minuto conta.
 */
export function statoUps({ rete, batteria, scarica } = {}) {
  if (rete === false) return scarica === true ? "scarica" : "batteria";
  if (rete === true) {
    const carica = numero(batteria);
    return carica !== null && carica < BATTERIA_BASSA ? "ricarica" : "rete";
  }
  return "ignoto";
}

/**
 * La lettura dell'UPS: cosa dicono adesso le sue caselle.
 *
 * La rete si cerca prima nella casella sua e poi nello stato, perche' chi ha
 * NUT ha una stringa che dice tutto e non ha un sensore separato.
 */
export function letturaUps(config, states = {}, resolve = (value) => value) {
  const dato = normalizzaUps(config);
  const leggi = (riferimento) => {
    const chiave = clean(riferimento);
    if (!chiave) return null;
    let entity = chiave;
    try {
      entity = clean(resolve(chiave)) || chiave;
    } catch (_error) {
      entity = chiave;
    }
    return states?.[entity] || states?.[chiave] || null;
  };

  const statoEntita = leggi(dato.stato);
  const reteEntita = leggi(dato.rete);
  const dallaCasella = reteEntita ? reteDalloStato(reteEntita.state) : null;
  /* Il verso girato: chi ha un sensore «mancanza rete» ha l'acceso che vuol
   * dire il contrario, e dallo stato non si puo' indovinare — lo si dichiara. */
  const dallaCasellaGirata =
    dallaCasella === null ? null : dato.invertita ? !dallaCasella : dallaCasella;
  const rete = dallaCasellaGirata ?? (statoEntita ? reteDalloStato(statoEntita.state) : null);

  const batteria = numero(leggi(dato.batteria)?.state);
  const scarica =
    (statoEntita ? batteriaScaricaDalloStato(statoEntita.state) : false) ||
    (batteria !== null && batteria < BATTERIA_BASSA);

  return {
    name: dato.name,
    rete,
    batteria,
    carico: numero(leggi(dato.carico)?.state),
    autonomia: numero(leggi(dato.autonomia)?.state),
    tensione: numero(leggi(dato.tensione)?.state),
    potenza: numero(leggi(dato.potenza)?.state),
    temperatura: numero(leggi(dato.temperatura)?.state),
    scarica,
    stato: statoUps({ rete, batteria, scarica }),
    /* Quando la scatola chiede attenzione: la rete caduta, o la batteria sotto
     * la soglia anche a rete presente — perche' allora vuol dire che non ha
     * finito di ricaricarsi da un guasto di prima, e il prossimo la trova
     * impreparata. */
    allarme: rete === false || scarica === true,
  };
}

/* Da quanto tempo l'UPS sta nello stato in cui e'.
 *
 * A rete caduta e' la prima cosa che si vuole sapere — «da quanto siamo al
 * buio» — e il momento del cambio lo porta l'entita' stessa. */
export function daQuandoUps(config, states = {}, resolve = (value) => value) {
  const dato = normalizzaUps(config);
  const chiave = clean(dato.rete) || clean(dato.stato);
  if (!chiave) return null;
  let entity = chiave;
  try {
    entity = clean(resolve(chiave)) || chiave;
  } catch (_error) {
    entity = chiave;
  }
  const snapshot = states?.[entity] || states?.[chiave] || null;
  const quando = Date.parse(snapshot?.last_changed ?? snapshot?.last_updated ?? "");
  return Number.isFinite(quando) ? quando : null;
}
