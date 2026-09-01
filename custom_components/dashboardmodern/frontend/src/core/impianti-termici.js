/* Cosa c'e' davvero nel locale caldaia (#253).
 *
 * La sezione si chiamava «Solare termico» e disegnava una cosa sola: pannello,
 * pompa, accumulo. Ma l'acqua calda in casa la fanno tre macchine diverse, e
 * quasi nessuno ne ha una sola:
 *
 *   - il SOLARE TERMICO, che scalda col sole e si guarda per sapere se
 *     conviene far girare la pompa;
 *   - lo SCALDABAGNO elettrico, che scalda con una resistenza che si paga e si
 *     guarda per sapere quando ci sara' l'acqua calda;
 *   - la CALDAIA, che scalda a gas e serve anche i termosifoni, quindi si
 *     guarda la mandata, il ritorno e la pressione del circuito.
 *
 * Chi ha il fotovoltaico e lo scaldabagno non ha il solare termico, e la
 * sezione gli mostrava un pannello che non ha. Chi ha solare e caldaia insieme
 * — che e' il caso piu' comune — ne vedeva una sola.
 *
 * Qui c'e' solo la scelta: quali dei tre ci sono, e quale si sta guardando. La
 * regola sta fuori dal disegno perche' la stessa risposta serve alla pagina,
 * alla scheda di configurazione e alla barra di navigazione, e tre copie della
 * stessa domanda sono tre occasioni di rispondere diverso.
 */

/** La chiave in cui vive la scelta. */
export const CHIAVE_IMPIANTI = "cd_impianti_termici";

/* L'ordine e' quello in cui si presentano le linguette, e non e' alfabetico:
 * e' l'ordine in cui il calore arriva in casa — prima quello che e' gratis,
 * poi quello che si paga a corrente, poi quello che si paga a gas. */
export const TIPI_TERMICI = Object.freeze(["solare", "scaldabagno", "caldaia"]);

export const ETICHETTE_TERMICHE = Object.freeze({
  solare: ["Solare termico", "Solar thermal"],
  scaldabagno: ["Scaldabagno", "Water heater"],
  caldaia: ["Caldaia", "Boiler"],
});

/* Come si chiama la sezione, adesso che non e' piu' una macchina sola.
 *
 * «La sezione non si deve chiamare piu' Solare termico ma Gestione termica»:
 * ha ragione — il nome vecchio era quello di uno dei tre impianti, e chi ha
 * solo la caldaia si trovava la sua macchina dentro una voce che parlava di
 * pannelli solari. */
export const NOME_SEZIONE = Object.freeze(["Gestione termica", "Thermal management"]);
export const BRICIOLA_SEZIONE = Object.freeze([
  "Solare · Scaldabagno · Caldaia",
  "Solar · Water heater · Boiler",
]);

/* Il titolo della pagina segue quello che si sta guardando quando c'e' una
 * macchina sola: senza linguette, il titolo e' l'unica cosa che dice cosa si
 * sta guardando. Con due o tre lo dicono le linguette, e allora il titolo
 * torna a essere il nome della sezione. */
export const TITOLI_TERMICI = Object.freeze({
  solare: ["Impianto solare termico", "Solar thermal plant"],
  scaldabagno: ["Scaldabagno elettrico", "Electric water heater"],
  caldaia: ["Caldaia", "Boiler"],
});

export const BRICIOLE_TERMICHE = Object.freeze({
  solare: [
    "Circuito primario · Boiler · Ricircolo sanitario",
    "Primary loop · Tank · Recirculation",
  ],
  scaldabagno: ["Acqua calda · Resistenza · Consumo", "Hot water · Element · Consumption"],
  caldaia: ["Mandata · Ritorno · Pressione", "Flow · Return · Pressure"],
});

const clean = (value) => String(value ?? "").trim();

const vero = (valore) => valore === true || valore === "true" || valore === 1 || valore === "1";

/**
 * La scelta salvata, ripulita.
 *
 * `null` non e' «nessuno»: e' «non ha ancora scelto nessuno», e le due cose
 * vanno distinte — la prima e' una pagina vuota voluta, la seconda e' una
 * plancia che sta per essere aggiornata e non deve perdere quello che vede.
 */
export function normalizzaScelta(stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const scelta = {};
  let almenoUna = false;
  for (const tipo of TIPI_TERMICI) {
    const acceso = vero(stored[tipo]);
    scelta[tipo] = acceso;
    if (acceso) almenoUna = true;
  }
  /* Una scelta salvata con tutti e tre spenti e' una scelta: chi ha tolto ogni
   * spunta vuole la sezione vuota, e riempirgliela sarebbe disobbedire. Si
   * distingue dal «non ha mai scelto» perche' l'oggetto in memoria c'e'. */
  return { ...scelta, vuota: !almenoUna };
}

/**
 * Quali impianti ha questa casa, in ordine di linguetta.
 *
 * `indizi` dice cosa risulta gia' configurato — le caselle del solare mappate,
 * un elenco di scaldabagni, le caselle della caldaia — e serve solo a chi non
 * ha ancora scelto: la sezione esiste da prima di questa domanda, e chi ci
 * arriva con l'impianto solare gia' mappato deve continuare a vederlo senza
 * dover andare a mettere una spunta che ieri non c'era.
 */
export function impiantiScelti(stored, indizi = {}) {
  const scelta = normalizzaScelta(stored);
  if (scelta) return TIPI_TERMICI.filter((tipo) => scelta[tipo]);
  const dedotti = TIPI_TERMICI.filter((tipo) => Boolean(indizi[tipo]));
  /* Nessuna scelta e nessun indizio: la sezione mostra il solare, che e'
   * quello che ha sempre mostrato. Non e' un ripiego neutro — e' il
   * comportamento di prima, che nessun aggiornamento deve cambiare da solo. */
  return dedotti.length ? dedotti : ["solare"];
}

/**
 * Quale linguetta e' aperta.
 *
 * La richiesta vale solo se quell'impianto c'e': chi toglie la caldaia mentre
 * la sta guardando non deve restare su una linguetta che non esiste piu'.
 */
export function tabAttiva(scelti, richiesta) {
  const elenco = Array.isArray(scelti) ? scelti.filter(Boolean) : [];
  if (!elenco.length) return "";
  const voluta = clean(richiesta);
  return elenco.includes(voluta) ? voluta : elenco[0];
}

/** Le linguette si mostrano solo quando c'e' da scegliere. */
export function servonoLinguette(scelti) {
  return Array.isArray(scelti) && scelti.length > 1;
}

/* ── la caldaia ────────────────────────────────────────────────────────────
 *
 * Le sue caselle stanno in una chiave sua e non fra quelle del solare: sono
 * un'altra macchina, e mescolarle vorrebbe dire una scheda in cui meta' dei
 * campi non riguarda chi la sta compilando. */
export const CHIAVE_CALDAIA = "cd_caldaia";

/* Cosa si guarda di una caldaia, e in che ordine.
 *
 * Mandata e ritorno prima di tutto: la differenza fra i due dice se
 * l'impianto sta cedendo calore o sta girando a vuoto, ed e' la ragione per
 * cui si apre questa pagina. La pressione subito dopo, perche' e' l'unica
 * cosa che ogni tanto va rabboccata a mano. */
export const CASELLE_CALDAIA = Object.freeze([
  { campo: "stato", tipo: "acceso" },
  { campo: "fiamma", tipo: "acceso" },
  { campo: "mandata", tipo: "gradi" },
  { campo: "ritorno", tipo: "gradi" },
  { campo: "acquaCalda", tipo: "gradi" },
  { campo: "pressione", tipo: "bar" },
  { campo: "modulazione", tipo: "percento" },
]);

const ACCESI = /^(on|true|1|heat|heating|burning|flame|dhw|attiva|attivo)$/i;
const SPENTI = /^(off|false|0|idle|standby|none|ferma|fermo)$/i;

/** Acceso, spento, o non lo sappiamo. */
export function accesoCaldaia(state) {
  const valore = clean(state);
  if (ACCESI.test(valore)) return true;
  if (SPENTI.test(valore)) return false;
  return null;
}

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const dato = Number(valore);
  return Number.isFinite(dato) ? dato : null;
};

/** La configurazione della caldaia, ripulita. */
export function normalizzaCaldaia(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const fuori = { name: clean(dato.name) };
  for (const { campo } of CASELLE_CALDAIA) fuori[campo] = clean(dato[campo]);
  return fuori;
}

/** Le entita' che la caldaia tiene d'occhio. */
export function entitaDellaCaldaia(config) {
  const dato = normalizzaCaldaia(config);
  return CASELLE_CALDAIA.map(({ campo }) => dato[campo]).filter(Boolean);
}

/**
 * La lettura della caldaia: cosa dicono adesso le sue caselle.
 *
 * `salto` e' la differenza fra mandata e ritorno, ed e' la misura che dice se
 * l'impianto sta davvero cedendo calore: due numeri vicini su una caldaia
 * accesa vogliono dire che l'acqua gira senza scaldare niente.
 */
export function letturaCaldaia(config, states = {}, resolve = (value) => value) {
  const dato = normalizzaCaldaia(config);
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
  const mandata = numero(leggi(dato.mandata)?.state);
  const ritorno = numero(leggi(dato.ritorno)?.state);
  const statoEntita = leggi(dato.stato);
  const fiammaEntita = leggi(dato.fiamma);
  const fiamma = accesoCaldaia(fiammaEntita?.state);
  const acceso = accesoCaldaia(statoEntita?.state);
  return {
    name: dato.name,
    /* La fiamma accesa e' gia' una caldaia accesa: chi mappa solo il bruciatore
     * non deve mappare anche uno stato per vedere la sua macchina viva. */
    acceso: acceso ?? (fiamma === true ? true : fiamma === false ? null : null),
    fiamma,
    mandata,
    ritorno,
    salto: mandata != null && ritorno != null ? Math.round((mandata - ritorno) * 10) / 10 : null,
    acquaCalda: numero(leggi(dato.acquaCalda)?.state),
    pressione: numero(leggi(dato.pressione)?.state),
    modulazione: numero(leggi(dato.modulazione)?.state),
  };
}

/* La pressione di un impianto domestico sta fra un bar e mezzo e due e mezzo;
 * sotto l'uno il pressostato blocca la caldaia, ed e' la sola cosa di questa
 * pagina che chiede di alzarsi dal divano. */
export const PRESSIONE_MINIMA = 1;
export const PRESSIONE_MASSIMA = 3;

/** Se la pressione chiede attenzione, e in che verso. */
export function verdettoPressione(bar) {
  const valore = numero(bar);
  if (valore === null) return "";
  if (valore < PRESSIONE_MINIMA) return "bassa";
  if (valore > 2.5) return "alta";
  return "buona";
}
