/* Una stanza e tutto quello che ci sta dentro.
 *
 * «Sarebbe carino avere una sezione dove vedere le entita' raggruppate per
 * stanze, tipo una sezione divisa a pagine dove ogni pagina e' una stanza con
 * tutte le entita' della stessa.»
 *
 * La plancia sa gia' a che stanza appartiene ogni cosa: luci, clima, tapparelle,
 * elettrodomestici, telecamere, carichi la portano scritta addosso — `room_id`
 * per il modello canonico, il nome della stanza per chi arriva da una
 * configurazione piu' vecchia. Quello che mancava non era il dato: era il verso
 * in cui leggerlo. Ogni sezione lo legge per tipo — tutte le luci, tutte le
 * tapparelle — e nessuna lo legge per stanza.
 *
 * Qui si gira. Non si sposta niente e non si riscrive niente: si prende cio' che
 * c'e' e lo si raccoglie per stanza, con in coda un raccoglitore per le cose che
 * una stanza non ce l'hanno — che e' anche il modo di accorgersi di averla
 * dimenticata, senza andarla a cercare sezione per sezione.
 *
 * Il modulo e' puro: entra un oggetto, esce un oggetto. Niente DOM, niente
 * localStorage, niente stati letti di nascosto.
 */

const clean = (value) => String(value ?? "").trim();

const lower = (value) => clean(value).toLowerCase();

function slug(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** La chiave con cui una stanza si riconosce, comunque sia stata scritta. */
export const roomKey = (value) => slug(value).replace(/^room-/, "");

/* I tipi di cosa che una stanza puo' contenere, nell'ordine in cui si leggono.
 *
 * L'ordine non e' alfabetico ne' casuale: e' quello con cui si guarda una
 * stanza entrandoci. Prima che aria fa, poi se c'e' luce, poi com'e' messa la
 * finestra, e solo dopo gli oggetti. */
/* Le parole non stanno qui.
 *
 * Questo modulo e' puro e non sa che lingua si parla; il nome che ogni blocco
 * porta a schermo lo mette la sezione, insieme all'icona. Qui c'e' solo il
 * legame fra il blocco e la sezione da cui pesca. */
/* Dove sta scritto che un'entita' appartiene a una stanza, quando la sua
 * scheda non lo chiede. Una casella sola, `entita' -> stanza`: cambiare il
 * nome di una stanza non la rompe, perche' dentro ci va l'id. */
export const ROOM_ASSIGN_KEY = "cd_stanze_entita";

export const ROOM_BLOCKS = Object.freeze([
  { key: "clima", section: "climate" },
  { key: "luci", section: "lights" },
  { key: "coperture", section: "covers" },
  { key: "elettrodomestici", section: "appliances" },
  { key: "telecamere", section: "cameras" },
  { key: "carichi", section: "loads" },
  { key: "robot", section: "robots" },
  { key: "irrigazione", section: "irrigation" },
  /* Tutto il resto della casa.
   *
   * Le sezioni qui sopra la stanza ce l'hanno addosso perche' la loro scheda
   * la chiede. Ce ne sono altre che non la chiedono e non e' detto che
   * debbano: un sensore di allagamento, una sonda di temperatura, la finestra
   * di un avviso, la pompa della piscina. Senza di loro la pagina di una
   * stanza racconta meta' della stanza.
   *
   * Per quelle c'e' una assegnazione a mano, entita' per entita', che si fa
   * dalla riga in cui l'entita' e' gia' scritta — in qualunque scheda si
   * trovi. Sta in fondo perche' e' quello che avanza dopo aver guardato le
   * cose che una stanza ce l'hanno per mestiere. */
  { key: "altro", section: "assigned" },
]);

/* La stanza di una voce, comunque sia scritta.
 *
 * Il modello canonico scrive `room_id`; le configurazioni piu' vecchie — e
 * quelle scritte a mano — scrivono il nome nella casella `room`. Aspirapolvere e
 * zone d'irrigazione hanno solo quella. Si accettano tutte e tre, e si
 * risolvono contro l'elenco vero delle stanze: senza, «Salone» e «salone » sono
 * due stanze diverse, ed e' esattamente il modo in cui una sezione del genere
 * diventa inutile.
 */
export function roomRefOf(item = {}) {
  return clean(item.room_id || item.roomId || item.room || "");
}

/** Se questa voce appartiene a questa stanza. */
export function belongsToRoom(item, room) {
  const riferimento = roomRefOf(item);
  if (!riferimento) return false;
  const chiave = roomKey(riferimento);
  return (
    riferimento === clean(room?.id) ||
    lower(riferimento) === lower(room?.name) ||
    (Boolean(chiave) && (chiave === roomKey(room?.id) || chiave === roomKey(room?.name)))
  );
}

const array = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

/* Le luci arrivano in due forme.
 *
 * Il modello canonico ne fa un elenco di dispositivi con `room_id`; la
 * configurazione storica e' una mappa entita' → nome, con le stanze in una
 * mappa a parte. Chi chiama passa quello che ha, e qui si normalizza — perche'
 * a saperlo deve essere un posto solo. */
export function lightItems(lights, assignments = {}) {
  /* La stanza di una luce non sta sulla luce.
   *
   * Le altre sezioni scrivono la stanza sul dispositivo; le luci no: la
   * scheda Luci tiene le assegnazioni in una mappa a parte, entita' → stanza,
   * e il dispositivo canonico ne esce senza. Chi guarda solo il dispositivo
   * vede una luce senza stanza anche quando la stanza gliel'hanno data. */
  const stanzaDi = (entity, item) =>
    clean(item?.room_id || item?.roomId || item?.room) || clean(assignments?.[entity]);
  if (Array.isArray(lights))
    return lights.map((light) => {
      const entity = clean(light.entity || light.entities?.[0] || light.id);
      return { ...light, entity, room: stanzaDi(entity, light) };
    });
  return Object.entries(lights || {}).map(([entity, name]) => ({
    id: entity,
    entity: clean(entity),
    name: clean(name),
    room: stanzaDi(clean(entity)),
  }));
}

/* Le zone d'irrigazione stanno dentro un oggetto, non in un elenco. */
const irrigationZones = (irrigation) => array(irrigation?.zones ?? irrigation);

/**
 * Le stanze con dentro tutto quello che le appartiene, piu' il raccoglitore di
 * cio' che non appartiene a nessuna. Una stanza senza niente resta nell'elenco:
 * e' configurata, e sparire sarebbe sembrare cancellata.
 */
export function roomOverviewModel(input = {}) {
  const stanze = array(input.rooms)
    .map((room, index) => ({
      id: clean(room.id) || `room-${roomKey(room.name) || index + 1}`,
      name: clean(room.name) || `Stanza ${index + 1}`,
      icon: clean(room.icon),
      floor: clean(room.floor),
      temp: clean(room.temp),
      hum: clean(room.hum),
      /* Le sonde in piu' viaggiano con la stanza.
       *
       * Una stanza puo' avere piu' di una coppia di sensori — il comodino, il
       * termostato a muro, la sonda della veranda — e le associazioni oltre la
       * prima stanno in `metadata.temperature_entries`. Questa proiezione le
       * lasciava fuori, cosi' chi disegna la pagina Stanze poteva vedere solo
       * la prima coppia per quante ne fossero configurate: la pagina non aveva
       * modo di sapere che le altre esistevano. Il nome della prima sta in
       * `temp_name`, e senza di lui tre righe uguali non si distinguono. */
      temp_name: clean(room.temp_name),
      metadata: {
        temperature_entries: array(room?.metadata?.temperature_entries),
      },
      rgb: clean(room.rgb),
      order: Number.isFinite(+room.order) ? +room.order : index,
    }))
    .filter((room) => room.name)
    .sort((a, b) => a.order - b.order);

  const sorgenti = {
    climate: array(input.climate),
    lights: lightItems(input.lights, input.lightRooms),
    covers: array(input.covers),
    appliances: array(input.appliances),
    cameras: array(input.cameras),
    loads: array(input.loads),
    robots: array(input.robots),
    irrigation: irrigationZones(input.irrigation),
    assigned: array(input.assigned),
  };

  const assegnate = new Set();
  const pagine = stanze.map((room) => {
    const blocchi = ROOM_BLOCKS.map((blocco) => {
      const voci = sorgenti[blocco.section].filter((item) => {
        /* Due stanze con lo stesso nome sono un errore di configurazione, ma
         * non e' una ragione per far comparire la stessa luce due volte: la
         * prima che la reclama se la tiene, e la seconda resta vuota — che e'
         * anche il modo in cui il doppione si nota. */
        if (assegnate.has(item)) return false;
        if (!belongsToRoom(item, room)) return false;
        assegnate.add(item);
        return true;
      });
      return { ...blocco, voci };
    });
    return {
      ...room,
      senzaStanza: false,
      blocchi,
      /* Il conteggio sulla pillola: quante cose ci sono, non quanti blocchi.
       * I sensori della stanza — temperatura e umidita' — non si contano: sono
       * la stanza, non una cosa dentro la stanza. */
      count: blocchi.reduce((totale, blocco) => totale + blocco.voci.length, 0),
    };
  });

  /* Cio' che una stanza non ce l'ha, o ce l'ha ma punta a una stanza che non
   * esiste piu'. Non e' un errore da nascondere: e' la sola occasione di
   * accorgersene. */
  const orfane = ROOM_BLOCKS.map((blocco) => ({
    ...blocco,
    voci: sorgenti[blocco.section].filter((item) => !assegnate.has(item)),
  }));
  const quanteOrfane = orfane.reduce((totale, blocco) => totale + blocco.voci.length, 0);
  if (quanteOrfane)
    pagine.push({
      id: "dm-senza-stanza",
      name: "",
      icon: "📦",
      floor: "",
      temp: "",
      hum: "",
      temp_name: "",
      metadata: { temperature_entries: [] },
      rgb: "",
      order: pagine.length,
      senzaStanza: true,
      blocchi: orfane,
      count: quanteOrfane,
    });

  return pagine;
}

/** La pagina scelta, o la prima che c'e'. */
export function pickRoomPage(pagine = [], scelta = "") {
  const chiave = clean(scelta);
  return pagine.find((pagina) => pagina.id === chiave) || pagine[0] || null;
}

/* Le entita' che una scena di stanza puo' accendere e spegnere.
 *
 * «Accendi tutto» in una stanza vuol dire la luce. Non il condizionatore, non
 * la tapparella: quelli hanno un verso loro — freddo o caldo, su o giu' — e
 * decidere al posto di chi guarda quale sia «acceso» sarebbe inventare. Le
 * prese comandate stanno dentro perche' sulla plancia sono luci a tutti gli
 * effetti: la sezione Luci accetta `switch.*` da sempre.
 */
export function roomSceneEntities(pagina = null) {
  const luci = pagina?.blocchi?.find((blocco) => blocco.key === "luci")?.voci || [];
  return luci
    .map((luce) => clean(luce.entity || luce.id))
    .filter((entity) => /^(light|switch)\./i.test(entity));
}

/** Quante ne sono accese, su quante ce ne sono. */
export function roomSceneSummary(pagina = null, states = {}) {
  const entita = roomSceneEntities(pagina);
  const accese = entita.filter((entity) => lower(states?.[entity]?.state) === "on").length;
  return { totale: entita.length, accese };
}
