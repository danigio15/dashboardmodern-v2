/* Chi resta fuori da una tessera della Home, e da quale.
 *
 * «se la finestra e configurata nella sezione finestre e no nei varchi la
 *  segnalazione resta in finestre non deve scomparire»
 *
 * Un contatto di una finestra sta scritto in due posti: nelle Finestre, che lo
 * mostrano accanto alla tapparella, e nei Varchi, che tengono il conto di cosa
 * e' aperto. Sono due sezioni e due tessere, e chi le configura le ha volute
 * tutte e due. Poi in Home ne bastava una — «nei Varchi no, nelle Finestre
 * si'» — e l'interruttore accanto alla riga spegneva l'entita', non la riga:
 * toccarlo nei Varchi la faceva sparire anche dalle Finestre, dove nessuno
 * aveva chiesto niente.
 *
 * La scelta non riguarda un'entita': riguarda un'entita' DENTRO una tessera.
 * Qui c'e' quella regola, e nient'altro.
 *
 * ── Come e' scritta ─────────────────────────────────────────────────────
 *
 * L'elenco e' sempre lo stesso, `cd_widgets.excluded`, e le sue voci adesso
 * sono di due specie:
 *
 *   «light.cucina»            — fuori da tutte le tessere
 *   «varchi|binary_sensor.x»  — fuori dalla tessera dei Varchi, e basta
 *
 * Le voci nude sono quelle che la gente ha gia' in configurazione, e valgono
 * quello che valevano: chi aveva tolto qualcosa dalla Home non se lo ritrova
 * tornato. Le scelte nuove nascono con la tessera scritta dentro. Nessuna
 * migrazione, nessuna configurazione persa — e la prima volta che si rimette
 * dentro e si ritoglie una voce nuda, quella voce diventa da se' una voce con
 * la sua tessera.
 *
 * ── Quando la tessera non si sa ─────────────────────────────────────────
 *
 * Non tutte le schede della configurazione parlano di UNA tessera: gli Avvisi
 * ne servono tre (fumo, allagamenti, quelli su misura) sulla stessa pagina.
 * Li' la tessera non si puo' indovinare, e non la si indovina: la voce si
 * scrive nuda, che e' esattamente quello che succedeva prima. Meglio una
 * scelta che vale ovunque di una scelta che vale nel posto sbagliato.
 *
 * E' puro: nessun DOM, nessuna memoria, nessun orologio.
 */

/** Il segno che divide la tessera dall'entita' dentro una voce. */
export const SEPARATORE = "|";

const pulito = (valore) => String(valore ?? "").trim();

/** Le due meta' di una voce: la tessera (o «») e l'entita'. */
export function leggiLaVoce(voce) {
  const testo = pulito(voce);
  if (!testo) return null;
  const taglio = testo.indexOf(SEPARATORE);
  if (taglio < 0) return { chiave: "", entita: testo };
  const chiave = pulito(testo.slice(0, taglio));
  const entita = pulito(testo.slice(taglio + SEPARATORE.length));
  if (!chiave || !entita) return null;
  return { chiave, entita };
}

/** Come si scrive la scelta: nuda se la tessera non si sa, con la tessera se si sa. */
export function scriviLaVoce(chiave, entita) {
  const id = pulito(entita);
  if (!id) return "";
  const tessera = pulito(chiave);
  return tessera ? `${tessera}${SEPARATORE}${id}` : id;
}

/**
 * Le entita' che questa tessera non mostra.
 *
 * Ci finiscono le voci nude — che valgono per tutte — e quelle scritte per
 * questa tessera. Quelle scritte per un'altra restano fuori dal conto: e'
 * tutto il senso della faccenda.
 */
/* Come si chiamava prima la tessera che adesso si chiama cosi'.
 *
 * Le porte e i cancelli stavano dentro la tessera della Sicurezza, e
 * l'interruttore accanto a ogni apertura scriveva «sicurezza|...». Adesso
 * hanno tessera loro (#457), ma quelle voci sono gia' scritte in casa di chi
 * le ha spente: senza questa riga un'apertura tolta dalla Home ci tornerebbe
 * da sola al primo aggiornamento — cioe' una scelta cancellata in silenzio,
 * che e' esattamente la cosa che questo modulo esiste per non fare.
 *
 * Vale in lettura, e vale finche' nessuno cambia idea: rimettere dentro
 * un'apertura porta via anche la voce vecchia, e le scelte nuove nascono col
 * nome nuovo. */
export const NOMI_DI_PRIMA = Object.freeze({ porte: ["sicurezza"] });

/** Questa tessera e i nomi che aveva prima. */
function eISuoiNomiDiPrima(tessera) {
  return new Set([tessera, ...(NOMI_DI_PRIMA[tessera] || [])]);
}

export function escluseDellaTessera(elenco, chiave = "") {
  const tessera = pulito(chiave);
  const nomi = eISuoiNomiDiPrima(tessera);
  const fuori = new Set();
  for (const voce of Array.isArray(elenco) ? elenco : []) {
    const letta = leggiLaVoce(voce);
    if (!letta) continue;
    if (!letta.chiave || nomi.has(letta.chiave)) fuori.add(letta.entita);
  }
  return fuori;
}

/** Se questa entita' e' fuori da questa tessera. */
export function eFuori(elenco, chiave, entita) {
  return escluseDellaTessera(elenco, chiave).has(pulito(entita));
}

/**
 * Toglie un'entita' da una tessera.
 *
 * Se c'e' gia' una voce nuda quell'entita' e' fuori da tutte, e aggiungerne
 * una per questa tessera direbbe due volte la stessa cosa: l'elenco resta
 * com'e'.
 */
export function togliDallaTessera(elenco, chiave, entita) {
  const id = pulito(entita);
  const voci = (Array.isArray(elenco) ? elenco : []).map(pulito).filter(Boolean);
  if (!id) return voci;
  if (eFuori(voci, chiave, id)) return voci;
  return [...voci, scriviLaVoce(chiave, id)];
}

/**
 * Rimette un'entita' dentro una tessera.
 *
 * Se ne va la voce di questa tessera e se ne va quella nuda — che teneva
 * l'entita' fuori da tutte, e che chi tocca l'interruttore adesso ha appena
 * smentito. Le voci scritte per ALTRE tessere restano dove sono: chi ha
 * spento questa finestra nei Varchi non ha detto niente sulle Finestre, e
 * rimetterla nelle Finestre non deve riaccenderla nei Varchi.
 */
export function rimettiNellaTessera(elenco, chiave, entita) {
  const id = pulito(entita);
  const tessera = pulito(chiave);
  const voci = (Array.isArray(elenco) ? elenco : []).map(pulito).filter(Boolean);
  if (!id) return voci;
  return voci.filter((voce) => {
    const letta = leggiLaVoce(voce);
    if (!letta || letta.entita !== id) return true;
    /* Senza tessera non c'e' un «qui» da cui rimettere dentro: si rimette
     * dentro dappertutto, che e' l'unica cosa che l'interruttore possa
     * promettere quando non sa di che tessera sta parlando. */
    if (!tessera) return false;
    /* Anche la voce col nome di prima se ne va: e' la stessa scelta, scritta
     * quando questa tessera si chiamava in un altro modo, e chi tocca
     * l'interruttore l'ha appena smentita. Senza questo, un'apertura spenta
     * ai tempi della Sicurezza non si sarebbe piu' potuta riaccendere. */
    const nomi = eISuoiNomiDiPrima(tessera);
    return letta.chiave !== "" && !nomi.has(letta.chiave);
  });
}

/* ── di quale tessera parla una riga della configurazione ──────────────── */

/* Il marchio che una scheda del Config si mette addosso per dire di quale
 * tessera sta parlando. Lo scrivono i moduli che disegnano una scheda propria
 * dentro la linguetta di un'altra sezione — la VMC nel Clima, le macchine nel
 * MiniPC, lo scaldabagno e la caldaia nel Solare — perche' li' la linguetta da
 * sola direbbe la tessera sbagliata. */
export const MARCHIO_TESSERA = "data-dm-tessera";

/**
 * La tessera di una linguetta del Config, quando ne serve una sola.
 *
 * Ci sono soltanto le linguette che parlano di UNA tessera. Quelle che ne
 * servono piu' d'una — gli Avvisi (fumo, allagamenti, quelli su misura), le
 * liste con le evidenze — non ci sono apposta: li' la scelta resta nuda e
 * vale ovunque, che e' quello che faceva prima.
 */
export const TESSERE_PER_SCHEDA = Object.freeze({
  luci: "luci",
  tapp: "tapparelle",
  pool: "piscina",
  irr: "irrigazione",
  appliances: "elettrodomestici",
  robot: "robot",
  ups: "ups",
  prese: "prese",
  media: "media",
  batterie: "batterie",
  varchi: "varchi",
  presenza: "presenza",
  stampanti: "stampanti",
  rifiuti: "rifiuti",
  /* Le porte e i cancelli si configurano in una scheda loro e adesso hanno
   * anche la loro tessera (#457): prima si mostravano dentro la Sicurezza, e
   * l'interruttore accanto a ogni apertura parlava di quella. */
  doors: "porte",
  allerte: "allerte",
});

/**
 * La tessera di un blocco delle linguette «sezN», per posto in fila.
 *
 * Le linguette `sez0`…`sez9` disegnano tutte lo stesso elenco di blocchi e poi
 * ne lasciano aperto uno: e' il guscio a contarli, con `cdSecKeyByOrd`, e la
 * Sicurezza ne apre due — il suo e quello delle Telecamere. Quindi la
 * linguetta non basta, e il posto in fila si', perche' e' lo stesso numero che
 * usa il guscio per decidere cosa mostrare.
 *
 * I posti che mancano non hanno una tessera: la Home, l'Energia, le azioni
 * rapide.
 */
export const TESSERE_PER_BLOCCO = Object.freeze({
  2: "ev",
  3: "solare",
  4: "sicurezza",
  6: "minipc",
  7: "temperatura",
  9: "clima",
  10: "telecamere",
});

/** La tessera di una linguetta, o «» se quella linguetta ne serve piu' d'una. */
export function tesseraDellaScheda(scheda) {
  return TESSERE_PER_SCHEDA[pulito(scheda)] || "";
}

/** La tessera del blocco che sta in questo posto, o «» se non ne ha una. */
export function tesseraDelBlocco(posto) {
  return TESSERE_PER_BLOCCO[Number(posto)] || "";
}
