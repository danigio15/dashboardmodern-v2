/* Le prese di casa.
 *
 * «Cosa ne pensi di inserire una sezione dedicata a prese generiche, tipo TV
 * Salotto, TV letto, Presa Firestick?»
 *
 * Quelle cose la plancia le sapeva gia' accendere e spegnere: la scheda Luci
 * accetta anche `switch.`, e una presa configurata li' funziona. Solo che si
 * chiama luce. Finisce nell'elenco delle luci, si conta nel «3 accese» del
 * salone, e «spegni tutte le luci» le spegne — cosa che per la presa della TV
 * puo' anche andare, e per quella del modem no. Il difetto non era che non si
 * potesse fare: era che si doveva chiamarla col nome di un'altra cosa.
 *
 * Una presa ha esattamente le stesse quattro cose di una luce — un nome,
 * un'entita', una stanza, un'icona — e si accende allo stesso modo. Quindi qui
 * non c'e' nessun motore nuovo: c'e' solo la forma di una presa, che e' cio'
 * che serve per tenerne un elenco proprio. Ad accenderla ci pensa lo stesso
 * `lightCommand` che accende tutto il resto, e a disegnarla la stessa scheda:
 * un interruttore e' un interruttore, ovunque stia.
 *
 * Il modulo e' puro: entra quello che c'e' salvato, esce un elenco in ordine.
 */

const pulito = (valore) => String(valore ?? "").trim();

const chiave = (valore) =>
  pulito(valore)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* I domini che sono una presa.
 *
 * `switch` e' il caso normale. `input_boolean` c'e' perche' molte prese sono
 * comandate da un interruttore virtuale, e `light` perche' certi adattatori
 * intelligenti si presentano come luci anche quando dietro c'e' una TV: chi
 * sa cosa ci ha attaccato e' chi configura, non noi. */
export const DOMINI_PRESA = Object.freeze(["switch", "input_boolean", "light", "fan"]);

/** Se questa e' un'entita' che una presa puo' avere. */
export function eEntitaDiPresa(valore) {
  const testo = pulito(valore).toLowerCase();
  return DOMINI_PRESA.some((dominio) => new RegExp(`^${dominio}\\.[a-z0-9_]+$`).test(testo));
}

/* Il nome che si legge quando chi configura non ne ha scritto uno: meglio
 * `tv_salotto` letto male che una riga vuota, perche' almeno si riconosce. */
function nomeDiRipiego(entity, indice) {
  const coda = pulito(entity).split(".")[1];
  if (!coda) return `Presa ${indice + 1}`;
  return coda.replaceAll("_", " ").replace(/^\p{Ll}/u, (lettera) => lettera.toUpperCase());
}

function normalizzata(voce, indice) {
  const entity = pulito(voce?.entity || voce?.entita || voce?.entity_id);
  const name = pulito(voce?.name || voce?.nome) || nomeDiRipiego(entity, indice);
  return {
    ...voce,
    id: pulito(voce?.id) || `presa-${chiave(name) || indice + 1}`,
    name,
    entity,
    icon: pulito(voce?.icon) || "🔌",
    /* La stanza sta sulla presa, non in una mappa a parte: e' una cosa sola da
     * leggere, e cambiare il nome della stanza non la scollega perche' dentro
     * ci va l'identificativo. */
    room_id: pulito(voce?.room_id || voce?.roomId || voce?.room),
    order: Number.isFinite(+voce?.order) ? +voce.order : indice,
  };
}

/** L'elenco delle prese, in ordine, comunque fosse scritto. */
export function normalizzaPrese(grezzo) {
  const voci = Array.isArray(grezzo) ? grezzo.filter(Boolean) : [];
  return voci
    .map((voce, indice) => normalizzata(voce, indice))
    .sort((sinistra, destra) => sinistra.order - destra.order)
    .map((voce, indice) => ({ ...voce, order: indice }));
}

/** Le prese che hanno davvero un'entita' dietro: le altre non si disegnano. */
export function preseConfigurate(grezzo) {
  return normalizzaPrese(grezzo).filter((presa) => eEntitaDiPresa(presa.entity));
}

/* Le prese raccolte per stanza, nell'ordine delle stanze configurate.
 *
 * L'ordine delle stanze e' quello della sezione Stanze — e' l'ordine in cui chi
 * abita la casa ci gira dentro, e vale ovunque. Quelle senza stanza vanno in
 * fondo, in un gruppo che si chiama come si chiamano dappertutto: le parole non
 * stanno qui, questo modulo non sa che lingua si parla, e chi chiama passa la
 * sua. */
export function presePerStanza(grezzo, stanze = [], senzaStanza = "") {
  const prese = preseConfigurate(grezzo);
  const elenco = Array.isArray(stanze) ? stanze.filter(Boolean) : [];
  const gruppi = [];
  const posto = new Map();
  for (const stanza of elenco) {
    const id = pulito(stanza?.id);
    const nome = pulito(stanza?.name);
    if (!id && !nome) continue;
    const gruppo = { room: nome || id, roomId: id, prese: [] };
    gruppi.push(gruppo);
    if (id) posto.set(chiave(id), gruppo);
    if (nome) posto.set(chiave(nome), gruppo);
  }
  const orfane = { room: senzaStanza, roomId: "", prese: [] };
  for (const presa of prese) {
    const gruppo = posto.get(chiave(presa.room_id)) || orfane;
    gruppo.prese.push(presa);
  }
  if (orfane.prese.length) gruppi.push(orfane);
  return gruppi.filter((gruppo) => gruppo.prese.length);
}
