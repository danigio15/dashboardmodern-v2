/* Gli altri nodi del cluster (#470).
 *
 * «Sarebbe utile poter configurare più di un mini pc in modo da monitorare più
 * nodi, comodo per chi ha, ad esempio, un cluster proxmox.»
 *
 * La pagina Server ha una scheda grande, ed e' quella del computer su cui gira
 * Home Assistant: le sue barre — processore, memoria, disco — sono cablate nel
 * documento e si riempiono dalle caselle che ci sono da sempre. Quella resta
 * dov'e' e come'e'. Chi ha un cluster pero' ha altri nodi, e di quelli la
 * plancia non sapeva niente: si vedevano le loro macchine (#382) e non si
 * vedeva il ferro che le regge.
 *
 * Qui c'e' l'elenco degli altri nodi. Ognuno e' un nome e cinque entita', tutte
 * facoltative: come sta, quanto processore, quanta memoria, quanto disco,
 * quanti gradi. Nessuna e' obbligatoria perche' non tutte le integrazioni le
 * pubblicano tutte — Proxmox VE da' le percentuali e lo stato, Glances aggiunge
 * i gradi, un ping da' solo il su e giu' — e una casella vuota e' semplicemente
 * una barra che non compare.
 *
 * Il modulo e' puro: non parla con Home Assistant e non tocca il DOM.
 */

import { conservaIlConfigurato } from "./device-model.js";

const clean = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  const n = Number.parseFloat(String(valore ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Dove si scrive l'elenco. */
export const CHIAVE_NODI = "cd_nodi";

/* Otto: un cluster di casa non ne ha di piu', e una pagina non e' un
 * datacenter. */
export const NODI_MASSIMI = 8;

/** Le cinque entita' di un nodo, nell'ordine in cui si leggono sulla scheda. */
export const CAMPI_DEL_NODO = Object.freeze(["stato", "cpu", "ram", "disco", "temperatura"]);

/* Quando un carico smette di essere normale.
 *
 * Settanta per cento e' un nodo che lavora; novanta e' un nodo che non ha piu'
 * margine, ed e' li' che una migrazione fallisce. I gradi hanno le loro:
 * settanta e' caldo per un mini PC in un mobile, ottantacinque e' il punto in
 * cui i processori cominciano a rallentarsi da soli. */
export const SOGLIE = Object.freeze({
  carico: Object.freeze({ alto: 70, critico: 90 }),
  temperatura: Object.freeze({ alto: 70, critico: 85 }),
});

/** Come sta una misura: normale, alta, critica. */
export function livelloDella(valore, soglie = SOGLIE.carico) {
  const n = numero(valore);
  if (n === null) return "";
  if (n >= soglie.critico) return "critico";
  if (n >= soglie.alto) return "alto";
  return "ok";
}

/** Un nodo, coi campi che la configurazione conosce. */
export function normalizzaNodo(input = {}, indice = 0) {
  const dato = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return conservaIlConfigurato(
    {
      id: clean(dato.id) || `nodo-${indice + 1}`,
      nome: clean(dato.nome || dato.name),
      stato: clean(dato.stato),
      cpu: clean(dato.cpu),
      ram: clean(dato.ram),
      disco: clean(dato.disco),
      temperatura: clean(dato.temperatura),
    },
    dato,
    "nodi",
  );
}

/** L'elenco pulito: non piu' di otto, e senza lo stesso nodo due volte. */
export function normalizzaNodi(input = []) {
  const righe = Array.isArray(input) ? input : input && typeof input === "object" ? [input] : [];
  const visti = new Set();
  const fuori = [];
  for (const [indice, riga] of righe.entries()) {
    const nodo = normalizzaNodo(riga, indice);
    /* Un nodo appena aggiunto non ha ancora niente dentro, e buttarlo via qui
     * vorrebbe dire che premere «Aggiungi» non fa niente. */
    const firma = CAMPI_DEL_NODO.map((campo) => nodo[campo]).join("|");
    if (firma !== "||||" && visti.has(firma)) continue;
    if (firma !== "||||") visti.add(firma);
    fuori.push(nodo);
    if (fuori.length >= NODI_MASSIMI) break;
  }
  return fuori;
}

/** Le entita' da tenere d'occhio: serve a chi decide se ridisegnare. */
export function entitaDeiNodi(input = []) {
  const viste = new Set();
  for (const nodo of normalizzaNodi(input))
    for (const campo of CAMPI_DEL_NODO) if (nodo[campo]) viste.add(nodo[campo]);
  return [...viste];
}

/* «unavailable» qui non c'e', ed e' voluto: e' Home Assistant che non riesce a
 * parlare col nodo, non il nodo che qualcuno ha spento. Sta fra i muti, dove
 * la scheda scrive «non risponde». */
const SPENTI = new Set(["off", "false", "disconnected", "not_running"]);
const ACCESI = new Set(["on", "true", "home", "connected", "running", "online", "up"]);

/* Se il nodo risponde: si', no, oppure non si sa.
 *
 * Tre esiti e non due. Un nodo senza entita' di stato non e' un nodo spento —
 * e' un nodo di cui non lo si e' chiesto — e dipingerlo di rosso vorrebbe dire
 * un allarme inventato. */
function acceso(stato) {
  if (!stato) return null;
  const grezzo = clean(stato.state).toLowerCase();
  if (!grezzo || grezzo === "unknown") return null;
  if (ACCESI.has(grezzo)) return true;
  if (SPENTI.has(grezzo)) return false;
  return null;
}

/* Un nodo che non risponde: o l'entita' non c'e' piu' in Home Assistant, o c'e'
 * e vale «unavailable», che vuol dire la stessa cosa — non si riesce a
 * chiedergli come sta. */
function nonRisponde(stato) {
  return !stato || clean(stato.state).toLowerCase() === "unavailable";
}

/* I gradi arrivano anche in Fahrenheit.
 *
 * Le soglie sono in Celsius — settanta e' caldo per un mini PC, ottantacinque
 * e' dove i processori si rallentano da soli — e confrontarci settanta gradi
 * Fahrenheit, che sono ventuno, vorrebbe dire una barra gialla su un nodo
 * freddo. Si converte per il giudizio; il numero e l'unita' restano quelli che
 * il sensore scrive, perche' quello e' cio' che chi guarda si aspetta di
 * leggere. */
function inCelsius(valore, unita) {
  return clean(unita).toLowerCase().replace(/\s+/g, "") === "°f" ? ((valore - 32) * 5) / 9 : valore;
}

function misura(entity, states, soglie) {
  const id = clean(entity);
  if (!id) return null;
  const stato = states?.[id];
  if (!stato) return null;
  const valore = numero(stato.state);
  if (valore === null) return null;
  const unita = clean(stato.attributes?.unit_of_measurement);
  return {
    entity: id,
    valore,
    unita,
    livello: livelloDella(
      soglie === SOGLIE.temperatura ? inCelsius(valore, unita) : valore,
      soglie,
    ),
  };
}

/**
 * Un nodo come sta adesso.
 *
 * Il nome scritto vince su quello di Home Assistant: chi chiama un nodo «pve2»
 * lo chiama cosi' anche sulla scheda. Senza nome scritto si prende quello
 * dell'entita' di stato, che e' la piu' probabile a portarne uno leggibile.
 */
export function letturaDelNodo(nodo = {}, states = {}) {
  const statoDelNodo = states?.[clean(nodo.stato)] || null;
  const risposta = acceso(statoDelNodo);
  return {
    id: clean(nodo.id),
    nome:
      clean(nodo.nome) ||
      clean(statoDelNodo?.attributes?.friendly_name) ||
      clean(nodo.stato).split(".")[1] ||
      clean(nodo.id),
    acceso: risposta,
    /* «Non risponde» e «e' spento» sono due cose diverse, e la scheda le dice
     * diverse: la prima e' un problema di rete o di Home Assistant, la seconda
     * e' un nodo che qualcuno ha fermato. */
    muto: Boolean(clean(nodo.stato)) && nonRisponde(statoDelNodo),
    cpu: misura(nodo.cpu, states, SOGLIE.carico),
    ram: misura(nodo.ram, states, SOGLIE.carico),
    disco: misura(nodo.disco, states, SOGLIE.carico),
    temperatura: misura(nodo.temperatura, states, SOGLIE.temperatura),
  };
}

/** Tutti i nodi configurati, come stanno adesso. */
export function lettureDeiNodi(stored = [], states = {}) {
  return (
    normalizzaNodi(stored)
      /* Un nodo senza nessuna entita' non si disegna: e' una riga aperta e non
       * ancora compilata, e una scheda vuota non dice niente a nessuno. */
      .filter((nodo) => CAMPI_DEL_NODO.some((campo) => nodo[campo]))
      .map((nodo) => letturaDelNodo(nodo, states))
  );
}

/**
 * Come sta il cluster, in una riga.
 *
 * `peggiore` e' il carico piu' alto fra tutti i nodi: e' quello che decide se
 * la fascia si accende, perche' un cluster sta come sta il suo nodo messo
 * peggio.
 */
export function riassuntoDeiNodi(letture = []) {
  const righe = Array.isArray(letture) ? letture : [];
  const carichi = righe.map((riga) => riga?.cpu?.valore).filter((valore) => valore != null);
  return {
    quanti: righe.length,
    accesi: righe.filter((riga) => riga.acceso === true).length,
    spenti: righe.filter((riga) => riga.acceso === false).length,
    muti: righe.filter((riga) => riga.muto).length,
    peggiore: carichi.length ? Math.max(...carichi) : null,
  };
}

/* ── il nodo che nasce da un dispositivo ─────────────────────────────────
 *
 * E' la stessa strada degli elettrodomestici, del robot e dei lettori: si
 * sceglie l'integrazione, si sceglie il dispositivo, e le cinque caselle si
 * compilano da sole. Un nodo Proxmox pubblica `binary_sensor.<nodo>_status` e
 * tre percentuali; Glances aggiunge i gradi. Quello che manca resta vuoto.
 */
const PAROLE = Object.freeze({
  cpu: /\b(cpu|processore|processor|carico|load)\b/,
  ram: /\b(ram|memoria|memory)\b/,
  disco: /\b(disco|disk|storage|hdd|ssd|filesystem)\b/,
  temperatura: /\b(temperatura|temperature|temp|termic)\b/,
  stato: /\b(stato|status|online|acceso|running|up|raggiungibil|reachable)\b/,
});

const parole = (voce, states) =>
  `${clean(voce.entity_id)} ${clean(voce.name)} ${clean(states?.[clean(voce.entity_id)]?.attributes?.friendly_name)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function bindNodoToDevice({
  device = {},
  entities = [],
  states = {},
  indice = 0,
  precedente = {},
} = {}) {
  const elenco = (Array.isArray(entities) ? entities : []).filter(
    (voce) => voce && !voce.disabled && clean(voce.entity_id).includes("."),
  );
  const dominio = (voce) => clean(voce.entity_id).split(".")[0];
  const unita = (voce) =>
    clean(states?.[clean(voce.entity_id)]?.attributes?.unit_of_measurement).toLowerCase();
  const classe = (voce) =>
    clean(voce.device_class || states?.[clean(voce.entity_id)]?.attributes?.device_class);

  /* Solo percentuali, e senza ripiego.
   *
   * Le barre del nodo sono percentuali: la larghezza e' il valore, e le soglie
   * sono settanta e novanta. Un sensore che si chiama «disk» ma scrive 150 GiB
   * non e' una percentuale, e prendendolo lo stesso si disegnava una barra
   * rossa piena su un disco mezzo vuoto. Meglio una casella che resta vuota —
   * si riempie a mano in un secondo — di una barra che mente. */
  const percentuale = (chiave) =>
    elenco.find(
      (voce) =>
        dominio(voce) === "sensor" &&
        unita(voce) === "%" &&
        PAROLE[chiave].test(parole(voce, states)),
    );

  const stato =
    elenco.find(
      (voce) =>
        dominio(voce) === "binary_sensor" &&
        ["connectivity", "running", "power"].includes(classe(voce)),
    ) ||
    elenco.find(
      (voce) => dominio(voce) === "binary_sensor" && PAROLE.stato.test(parole(voce, states)),
    );

  const gradi = elenco.find(
    (voce) =>
      dominio(voce) === "sensor" &&
      (classe(voce) === "temperature" || ["°c", "°f"].includes(unita(voce))) &&
      PAROLE.temperatura.test(parole(voce, states)),
  );

  return {
    ...normalizzaNodo(precedente, indice),
    nome: clean(precedente.nome) || clean(device.name),
    stato: clean(stato?.entity_id) || clean(precedente.stato),
    cpu: clean(percentuale("cpu")?.entity_id) || clean(precedente.cpu),
    ram: clean(percentuale("ram")?.entity_id) || clean(precedente.ram),
    disco: clean(percentuale("disco")?.entity_id) || clean(precedente.disco),
    temperatura: clean(gradi?.entity_id) || clean(precedente.temperatura),
  };
}
