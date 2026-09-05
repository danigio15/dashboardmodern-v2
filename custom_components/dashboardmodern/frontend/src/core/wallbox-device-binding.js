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
]);

const DELLA_WALLBOX = new Set(CASELLE_DELLA_WALLBOX);

/** Se questa casella e' della colonnina, e quindi della casa. */
export function eDellaWallbox(ref) {
  return DELLA_WALLBOX.has(clean(ref));
}

/* Le parole con cui le integrazioni chiamano le cose di una colonnina.
 *
 * Sono quelle di evcc, go-e, Easee, KEBA, Wallbox Pulsar, openWB, Zaptec e
 * del Tesla Wall Connector: gli otto che si incontrano davvero. Le lingue sono
 * quelle in cui quelle integrazioni pubblicano — inglese e tedesco fanno la
 * parte del leone, evcc e openWB sono tedeschi. */
const PAROLE = Object.freeze({
  colonnina:
    /\b(wallbox|charger|charging station|ladestation|loadpoint|ladepunkt|evse|go-?e|easee|keba|zaptec|openwb|pulsar|wall connector|colonnina)\b/i,
  sessione: /\b(session|sessione|charged energy|geladene energie|energia caricata)\b/i,
  oggi: /\b(today|oggi|daily|giornaliera|heute|t[äa]glich|hoy)\b/i,
  mese: /\b(month|mese|monthly|mensile|monat|mes)\b/i,
  sole: /\b(solar|pv|autarky|autarkie|autarchia|self.?consumption|sonne)\b/i,
  modalita: /\b(mode|modus|modalit[àa]|charge mode|lademodus)\b/i,
  totale: /\b(total|totale|gesamt|lifetime|cumulat)\b/i,
});

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
  const prendi = (ref, domanda) => {
    if (mappa[ref]) return false;
    for (const voce of elenco) {
      const id = clean(voce.entity_id);
      if (!libere.has(id) || SOLO_IMPOSTAZIONE(voce)) continue;
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

  /* La modalita' e' di evcc, ed e' l'unica cosa che si riconosce dal dominio
   * prima che dalle parole: una tendina su un dispositivo di ricarica e'
   * quella, e le sue voci le legge il guscio. */
  prendi(
    "dm.ev_modalita_ricarica_evcc",
    (voce) => ["select", "input_select"].includes(dominio(voce)) && dice("modalita")(voce),
  );
  prendi("dm.ev_modalita_ricarica_evcc", (voce) => dominio(voce) === "select");

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

  return { mappa, evcc: Boolean(mappa["dm.ev_modalita_ricarica_evcc"]) };
}
