/* La wallbox e evcc, che non sono l'auto.
 *
 * «Aggiungere anche evcc e la wallbox.» La sezione Auto conosceva la vettura —
 * batteria, autonomia, contachilometri — e la colonnina la si mappava a mano,
 * casella per casella, nella scheda Entita'. Ma la colonnina e' un dispositivo
 * di Home Assistant come gli altri: la porta un'integrazione, pubblica le sue
 * entita', e non c'e' ragione perche' venti caselle si scrivano a mano.
 *
 * E c'e' una differenza che conta: la wallbox e' DELLA CASA, l'auto e' UNA
 * DELLE AUTO. Chi ha due vetture ha una colonnina sola, e la potenza che sta
 * erogando e' la stessa qualunque macchina sia attaccata. Per questo le sue
 * caselle stanno qui, separate, invece di viaggiare dentro il profilo di una
 * vettura: quel profilo cambia quando si cambia auto, e la colonnina no.
 *
 * evcc merita una riga sua. Non e' una wallbox: e' il regolatore che ci sta
 * davanti, e pubblica per ogni «loadpoint» la modalita' (spento, solare, min+
 * solare, veloce), l'energia della sessione e la quota di sole che c'e'
 * dentro. Sono le tre cose che la card gia' sa disegnare e che nessuno
 * riusciva a collegare senza saperne gli entity_id a memoria.
 *
 * Il modulo e' puro: entrano le entita' di un dispositivo, esce una mappa
 * `ref → entity_id`. Non salva niente e non guarda il DOM.
 */

const clean = (value) => String(value ?? "").trim();

/* Le caselle che appartengono alla colonnina e non alla vettura.
 *
 * Serve a due cose. Riempirle dall'integrazione, che e' il motivo per cui
 * questo file esiste; e non farsele portare via quando si cambia auto —
 * mettere in uso una vettura riscrive TUTTE le `dm.ev_*` con quelle del suo
 * profilo, e una colonnina mappata a mano spariva al primo cambio di
 * macchina. */
export const CASELLE_DELLA_WALLBOX = Object.freeze([
  "dm.ev_potenza_wallbox",
  "dm.ev_energia_wallbox_oggi",
  "dm.ev_energia_wallbox_mese",
  "dm.ev_tensione_wallbox",
  "dm.ev_temperatura_wallbox",
  "dm.ev_modalita_ricarica_evcc",
  "dm.ev_energia_sessione",
  "dm.ev_percentuale_solare_sessione",
  /* Il cavo: e' la colonnina a sapere se e' dentro. */
  "dm.ev_cavo_collegato",
]);

const DELLA_WALLBOX = new Set(CASELLE_DELLA_WALLBOX);

/** Se questa casella e' della colonnina, e quindi della casa. */
export function eDellaWallbox(ref) {
  return DELLA_WALLBOX.has(clean(ref));
}

/* Il limite di carica: della casa quando e' quello che comanda.
 *
 * Il target lo portano in due. L'auto lo pubblica quasi sempre come sensore di
 * sola lettura, o come limite che vive nel cloud del costruttore; evcc lo
 * pubblica come `number`, e quello lo si comanda davvero — e' proprio la
 * regola che il collegamento di evcc applica gia' quando riempie la casella:
 * un comando scalza una lettura.
 *
 * Solo che poi mettere in uso una vettura riversa il suo profilo nelle
 * mappature globali e si riprendeva la casella. Da fuori si vede cosi': la
 * tendina della percentuale mostra le voci giuste, si sceglie 90, e Home
 * Assistant risponde «Leapmotor remote control result failed: Token is
 * invalid» — perche' il comando e' andato al limite dell'AUTO, nel cloud del
 * costruttore, mentre quello che governa la carica e' `number.evcc_*_limit_soc`
 * ed e' li' a due passi. Dalla plancia falliva, dall'integrazione no.
 *
 * Quindi: se la casa tiene un target COMANDABILE, quello non se lo porta via
 * nessun cambio d'auto. Se la casa non ce l'ha, o e' una lettura, il profilo
 * della vettura resta padrone come e' sempre stato. */
const COMANDABILE = /^(select|input_select|number|input_number)\./;

export function eTargetDiCasa(ref, valore) {
  return clean(ref) === "dm.ev_target_soc" && COMANDABILE.test(clean(valore));
}

/* Le parole con cui le integrazioni chiamano le cose di una colonnina.
 *
 * Sono quelle di evcc, go-e, Easee, KEBA, Wallbox Pulsar, openWB, Zaptec e
 * del Tesla Wall Connector: gli otto che si incontrano davvero. Le lingue sono
 * quelle in cui quelle integrazioni pubblicano — inglese e tedesco fanno la
 * parte del leone, evcc e openWB sono tedeschi. */
import { eUnaLettera } from "./stato-della-ricarica.js";

/* Se un nome parla del CAVO.
 *
 * Sta fuori dal vocabolario della colonnina perche' lo legge anche l'auto: il
 * cavo lo sa la colonnina, ma lo sa pure la vettura — quasi tutte le
 * integrazioni delle auto pubblicano il loro «charger connected» — e una
 * plancia con l'auto collegata e nessuna wallbox non aveva nessuno che glielo
 * dicesse. Un vocabolario solo, due lettori.
 *
 * Le parole del cavo e quelle della carica si sfiorano, e la regola non e' «se
 * dice carica non e' un cavo»: quella buttava via proprio «CHARGER connected»,
 * che e' il nome piu' comune di tutti. Vale la parola piu' forte — un
 * «connected», un «plugged», un «collegato» dicono il cavo e basta — e solo
 * quando quella non c'e' si guarda se il nome parla di una carica in corso,
 * che allora e' della carica che parla. */
const PAROLE_DEL_CAVO =
  /\b(connected|connection|plugged|plug|cavo|cable|collegat\w*|vehicle status|angeschlossen|conectad\w*)\b/i;
const CONNESSIONE_DETTA =
  /\b(connected|connection|plugged|collegat\w*|attaccat\w*|angeschlossen|conectad\w*)\b/i;
const CARICA_IN_CORSO =
  /\b(charging|in carica|ricarica in corso|l[\u00e4a]dt|cargando|en charge)\b/i;

export function parlaDelCavo(nome) {
  const testo = String(nome ?? "");
  if (!PAROLE_DEL_CAVO.test(testo)) return false;
  return CONNESSIONE_DETTA.test(testo) || !CARICA_IN_CORSO.test(testo);
}

const PAROLE = Object.freeze({
  colonnina:
    /\b(wallbox|charger|charging station|ladestation|loadpoint|ladepunkt|evse|go-?e|easee|keba|zaptec|openwb|pulsar|wall connector|colonnina)\b/i,
  sessione: /\b(session|sessione|charged energy|geladene energie|energia caricata)\b/i,
  oggi: /\b(today|oggi|daily|giornaliera|heute|t[äa]glich|hoy)\b/i,
  mese: /\b(month|mese|monthly|mensile|monat|mes)\b/i,
  sole: /\b(solar|pv|autarky|autarkie|autarchia|self.?consumption|sonne)\b/i,
  modalita: /\b(mode|modus|modalit[àa]|charge mode|lademodus)\b/i,
  totale: /\b(total|totale|gesamt|lifetime|cumulat)\b/i,
  /* Il limite di carica: evcc lo chiama «limit SoC», altri «target» o
   * «charge limit». Non «effective» ne' «vehicle», che sono le copie di sola
   * lettura, e non «min», che e' l'altro limite. */
  target:
    /\b(limit ?soc|limitsoc|soc ?limit|target ?soc|targetsoc|target|charg\w* ?limit|ladelimit|ladeziel|limite (di )?(ri)?carica)\b/i,
  nonTarget: /\b(effective|vehicle|min(imum)?|plan\w*|phase\w*|current|corrente)\b/i,
});

/* Le entita' a cui si puo' dare un ordine: una tendina o un numero. */
const COMANDABILI = new Set(["select", "input_select", "number", "input_number"]);

const SOLO_IMPOSTAZIONE = (voce) => clean(voce?.category).toLowerCase() === "config";

const dominio = (voce) => clean(voce?.entity_id).split(".")[0];

const parole = (voce, states) =>
  `${clean(voce?.entity_id)} ${clean(voce?.name)} ${clean(
    states?.[clean(voce?.entity_id)]?.attributes?.friendly_name,
  )}`.replace(/_/g, " ");

const classe = (voce, states) =>
  clean(
    voce?.device_class || states?.[clean(voce?.entity_id)]?.attributes?.device_class,
  ).toLowerCase();

const unita = (voce, states) =>
  clean(voce?.unit || states?.[clean(voce?.entity_id)]?.attributes?.unit_of_measurement);

/**
 * Le caselle della colonnina che questo dispositivo sa riempire.
 *
 * Torna la mappa `ref → entity_id` e se il dispositivo sembra evcc: evcc
 * porta la modalita' di ricarica, che una wallbox nuda non ha, e dirlo
 * permette all'anteprima di chiamare le cose col loro nome.
 */
export function legaLaWallboxAlDispositivo({ entities = [], states = {} } = {}) {
  const elenco = (Array.isArray(entities) ? entities : []).filter(
    (voce) => voce && !voce.disabled && clean(voce.entity_id).includes("."),
  );
  const libere = new Set(elenco.map((voce) => clean(voce.entity_id)));
  const mappa = {};

  /* Come per l'auto: la prima che risponde alla domanda, e poi esce dal mazzo.
   * Una casella non si riempie due volte e un'entita' non finisce in due
   * caselle — con «energia oggi» e «energia mese» che si somigliano tanto,
   * senza questa regola la stessa entita' andava in tutte e due. */
  const prendi = (ref, domanda, { ancheImpostazioni = false } = {}) => {
    if (mappa[ref]) return false;
    for (const voce of elenco) {
      const id = clean(voce.entity_id);
      if (!libere.has(id) || (SOLO_IMPOSTAZIONE(voce) && !ancheImpostazioni)) continue;
      if (!domanda(voce)) continue;
      mappa[ref] = id;
      libere.delete(id);
      return true;
    }
    return false;
  };

  const conClasse = (nome) => (voce) => classe(voce, states) === nome;
  const dice = (chiave) => (voce) => PAROLE[chiave].test(parole(voce, states));
  const percentuale = (voce) => unita(voce, states) === "%";
  const energia = (voce) => conClasse("energy")(voce) || /kwh/i.test(unita(voce, states));

  /* La modalita' di ricarica: una tendina che dice di esserlo.
   *
   * C'era anche un ripiego che prendeva la PRIMA tendina qualunque, e non
   * andava bene: una colonnina ne pubblica anche altre — il blocco del cavo,
   * la scelta delle fasi — e prendendo quella la plancia accendeva i tasti
   * della modalita' e ci mandava dentro «pv» o «now». Cioe' un comando vero,
   * a un selettore che parla di un'altra cosa. Meglio la console spenta che
   * quattro tasti che comandano il blocco del cavo. */
  prendi(
    "dm.ev_modalita_ricarica_evcc",
    (voce) => ["select", "input_select"].includes(dominio(voce)) && dice("modalita")(voce),
  );

  /* La potenza: quella che sta erogando adesso. */
  prendi(
    "dm.ev_potenza_wallbox",
    (voce) => conClasse("power")(voce) && (dice("colonnina")(voce) || dominio(voce) === "sensor"),
  );

  /* Le energie, nell'ordine in cui si distinguono: prima la sessione — che ha
   * una parola sua — poi oggi, poi il mese. L'ordine conta perche' «energia
   * caricata» senza altre parole e' la sessione, e se la prendesse «oggi»
   * resterebbe la sessione vuota. */
  prendi("dm.ev_energia_sessione", (voce) => energia(voce) && dice("sessione")(voce));
  prendi(
    "dm.ev_energia_wallbox_oggi",
    (voce) => energia(voce) && dice("oggi")(voce) && !dice("mese")(voce),
  );
  prendi("dm.ev_energia_wallbox_mese", (voce) => energia(voce) && dice("mese")(voce));

  /* La quota di sole della sessione: evcc la pubblica come percentuale. */
  prendi("dm.ev_percentuale_solare_sessione", (voce) => percentuale(voce) && dice("sole")(voce));

  /* Tensione e temperatura: le dice la classe, e non serve chiedere altro. */
  prendi("dm.ev_tensione_wallbox", conClasse("voltage"));
  prendi("dm.ev_temperatura_wallbox", conClasse("temperature"));

  /* Il target di carica, ma solo se si puo' COMANDARE. «Il menu a tendina
   * della percentuale di ricarica evcc non funziona»: nella casella c'era il
   * target che l'auto pubblica, un sensore di sola lettura, e la tendina
   * mandava ordini nel vuoto. evcc pubblica il suo limite come numero o
   * tendina, ed e' quello che la plancia deve comandare. */
  prendi(
    "dm.ev_target_soc",
    (voce) => COMANDABILI.has(dominio(voce)) && dice("target")(voce) && !dice("nonTarget")(voce),
    /* Un limite e' un'impostazione per definizione, e le integrazioni lo
     * marcano cosi': qui e' proprio quello che si cerca. */
    { ancheImpostazioni: true },
  );

  /* Il cavo: il sensore che dice se e' dentro. E' la risposta esatta alla
   * domanda che la foto e la pastiglia si fanno, e finora si indovinava dalle
   * parole dello stato o dalla potenza. Un «charging» acceso o spento non e'
   * un cavo: si esclude. */
  prendi(
    "dm.ev_cavo_collegato",
    (voce) =>
      parlaDelCavo(parole(voce, states)) &&
      !dice("nonTarget")(voce) &&
      (dominio(voce) === "binary_sensor" || eUnaLettera(states?.[clean(voce?.entity_id)]?.state)),
  );

  return { mappa, evcc: Boolean(mappa["dm.ev_modalita_ricarica_evcc"]) };
}
