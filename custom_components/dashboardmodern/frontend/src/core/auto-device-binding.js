/* L'auto che arriva da un'integrazione, gia' fatta.
 *
 * «Vogliamo cercare di fare la stessa cosa integrazione anche su auto, cosi'
 * viene piu' pulita.» E' il giro degli elettrodomestici e dei robot: si sceglie
 * l'integrazione, si sceglie il dispositivo, e la vettura nasce con le caselle
 * gia' piene invece di battere venti entity_id a mano.
 *
 * Chi guida l'assegnazione e' il `device_class` quando c'e' — e' quello che
 * Home Assistant dichiara, non quello che si indovina — e solo dove non basta
 * si guardano le parole. Le parole si guardano in tutte le lingue che le
 * integrazioni delle auto usano davvero: il costruttore coreano scrive
 * «Fuel level», quello tedesco «Reichweite», quello italiano «Autonomia».
 *
 * Una casella la si riempie una volta sola: la stessa entita' non puo' essere
 * insieme l'odometro e l'ultimo viaggio, e la prima domanda che se la prende
 * la toglie dal mazzo per le successive.
 */
/* Il nucleo non importa il guscio: una riga sola, come fanno le sorelle. */
const clean = (value) => String(value ?? "").trim();

/* ── i vocabolari ─────────────────────────────────────────────────────── */

/* Ogni voce e' una domanda sola, e l'ordine conta: si chiede prima quello che
 * si riconosce con certezza. */
const PAROLE = Object.freeze({
  batteria:
    /\b(soc|state of charge|batteria(?! di servizio| 12)|battery(?! voltage| 12)|hv batt|traction batt)\b/i,
  batteriaServizio:
    /\b(12\s?v|aux(iliary)? batt|batteria (di )?servizio|starter batt|bordbatterie)\b/i,
  carburante:
    /\b(fuel|carburante|benzina|gasolio|diesel|tank|serbatoio|kraftstoff|combustible|niveau de carburant)\b/i,
  autonomia: /\b(range|autonomia|reichweite|autonomie|autonom[ií]a|dte|distance to empty)\b/i,
  odometro: /\b(odometer|odometro|contachilometri|kilometerstand|kilometraje|totalizzatore)\b/i,
  ultimoViaggio: /\b(last trip|ultimo viaggio|trip distance|letzte fahrt|dernier trajet)\b/i,
  carburanteTotale:
    /\b(fuel (used|consumed)|carburante (consumato|totale)|verbrauch(t)?|consommation totale)\b/i,
  ricarica:
    /\b(charging|charge state|stato (di )?ricarica|ladezustand|estado de carga|en charge|plug|cavo|cable)\b/i,
  potenza: /\b(charg\w* power|potenza (di )?ricarica|ladeleistung|puissance)\b/i,
  target: /\b(target|limite|soglia|ladeziel|objetivo)\b/i,
  motore: /\b(engine|motore|ignition|quadro|z[üu]ndung|encendido|moteur)\b/i,
  /* Le portiere si chiedono in due tempi: prima «e' chiusa a chiave?», che e'
   * il riepilogo che la card vuole (bloccate/aperte), e solo dopo la singola
   * porta. Su un'auto vera ci sono quattro `Door ...` e una `Locked`: senza
   * questa distinzione la card raccontava lo sportello del guidatore. */
  serratura: /\b(lock(ed)?|serratur|bloccat|verrouill|verriegel|cerrad)\b/i,
  portiere: /\b(door|portier|porte|t[üu]r|puerta)\b/i,
  finestrini: /\b(window|finestrin|fenster|ventana|vitre)\b/i,
  bagagliaio: /\b(trunk|boot|bagagliaio|kofferraum|maletero|coffre|tailgate|hatch|liftgate)\b/i,
  cofano: /\b(hood|bonnet|cofano|motorhaube|cap[óo]|capot|frunk)\b/i,
  allarme: /\b(alarm|allarm|antifurt|alarma|alarme)\b/i,
  olio: /\b(oil|olio|[öo]l\b|aceite|huile)\b/i,
  esterna: /\b(outside|external|ambient|esterna|au(ss|ß)en|exterior|ext[ée]rieur)\b/i,
  pneumatici: /\b(tyre|tire|pneumatic|pneumatici|reifen|neum[áa]tic|pneu)\b/i,
});

/* Le quattro ruote, e le parole con cui le integrazioni le distinguono. */
const RUOTE = Object.freeze([
  [
    "dm.ev_pneumatico_ant_sx",
    /\b(front[- _]?left|ant\w*[- _]?(sx|sinistr)|vorne links|avant gauche|fl)\b/i,
  ],
  [
    "dm.ev_pneumatico_ant_dx",
    /\b(front[- _]?right|ant\w*[- _]?(dx|destr)|vorne rechts|avant droit|fr)\b/i,
  ],
  [
    "dm.ev_pneumatico_post_sx",
    /\b(rear[- _]?left|post\w*[- _]?(sx|sinistr)|hinten links|arri[èe]re gauche|rl)\b/i,
  ],
  [
    "dm.ev_pneumatico_post_dx",
    /\b(rear[- _]?right|post\w*[- _]?(dx|destr)|hinten rechts|arri[èe]re droit|rr)\b/i,
  ],
]);

/* Le impostazioni del dispositivo non sono l'auto.
 *
 * Home Assistant marca da se' cosa e' configurazione e cosa e' diagnostica: il
 * volume dell'avvisatore e la versione del firmware stanno nel pannello del
 * dispositivo, non sulla card di chi guarda quanta benzina ha. La diagnostica
 * pero' NON si scarta del tutto: parecchie integrazioni ci mettono dentro la
 * batteria di servizio e la pressione delle gomme, che sulla card servono. */
const SOLO_IMPOSTAZIONE = (voce) => clean(voce?.category).toLowerCase() === "config";

/* ── gli attrezzi ─────────────────────────────────────────────────────── */

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

/* ── il legame ────────────────────────────────────────────────────────── */

/**
 * Le caselle `dm.ev_*` che questo dispositivo sa riempire.
 *
 * Torna una mappa ref → entity_id, piu' il tipo di motore che le entita'
 * lasciano capire. Non salva niente: chi chiama decide cosa farne, e la
 * scheda dell'auto la disegna qualcun altro.
 */
export function legaLAutoAlDispositivo({ entities = [], states = {} } = {}) {
  const elenco = (Array.isArray(entities) ? entities : []).filter(
    (voce) => voce && !voce.disabled && clean(voce.entity_id).includes("."),
  );
  const libere = new Set(elenco.map((voce) => clean(voce.entity_id)));
  const mappa = {};

  /* Prende la prima entita' che risponde alla domanda, e la toglie dal mazzo:
   * una casella riempita non si riempie due volte, e un'entita' presa non
   * finisce anche altrove. */
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
  const conParola = (chiave, dom) => (voce) =>
    (!dom || dominio(voce) === dom) && PAROLE[chiave].test(parole(voce, states));
  const percentuale = (voce) => unita(voce, states) === "%";

  /* La posizione: un `device_tracker` e' esattamente quello, e non serve
   * chiedersi come si chiama. */
  prendi("dm.ev_posizione", (voce) => dominio(voce) === "device_tracker");

  /* Le due batterie, nell'ordine che conta: prima quella di servizio, che si
   * riconosce dalle parole, o la sua percentuale si prenderebbe il posto della
   * batteria di trazione. */
  prendi(
    "dm.ev_batteria_servizio",
    (voce) => percentuale(voce) && PAROLE.batteriaServizio.test(parole(voce, states)),
  );
  prendi("dm.ev_batteria_auto", (voce) => conClasse("battery")(voce) && dominio(voce) === "sensor");
  prendi("dm.ev_batteria_auto", (voce) => percentuale(voce) && conParola("batteria")(voce));

  /* Il serbatoio: una percentuale che parla di carburante. Un sensore in litri
   * e' il consumo totale, non il livello, e sta in un'altra casella. */
  prendi(
    "dm.ev_carburante",
    (voce) => percentuale(voce) && PAROLE.carburante.test(parole(voce, states)),
  );

  prendi("dm.ev_autonomia", (voce) => conClasse("distance")(voce) && conParola("autonomia")(voce));
  prendi("dm.ev_autonomia", conParola("autonomia", "sensor"));
  prendi("dm.ev_odometro", conParola("odometro", "sensor"));
  prendi("dm.ev_ultimo_viaggio", conParola("ultimoViaggio", "sensor"));
  prendi("dm.ev_carburante_totale", conParola("carburanteTotale", "sensor"));

  /* La ricarica: lo stato, la potenza e il traguardo.
   *
   * Anche qui si chiede in due tempi. Un'auto pubblica sia «Charging» sia
   * «Battery Charging»: dicono la stessa cosa, ma la prima e' il nome che uno
   * riconosce sulla card, e senza un ordine vinceva quella che capitava prima
   * nell'elenco. «Discharging» non e' «charging» e non entra: fra «dis» e
   * «charging» non c'e' confine di parola. */
  const nuda = (voce) => !/\bbatter/i.test(clean(voce?.name));
  prendi(
    "dm.ev_stato_ricarica",
    (voce) => conParola("ricarica")(voce) && nuda(voce) && dominio(voce) !== "sensor",
  );
  prendi("dm.ev_stato_ricarica", (voce) => conParola("ricarica")(voce) && nuda(voce));
  prendi(
    "dm.ev_stato_ricarica",
    (voce) => conParola("ricarica")(voce) && dominio(voce) !== "sensor",
  );
  prendi("dm.ev_stato_ricarica", conParola("ricarica", "sensor"));
  prendi(
    "dm.ev_potenza_ricarica",
    (voce) => conClasse("power")(voce) && conParola("potenza")(voce),
  );
  prendi("dm.ev_potenza_ricarica", conParola("potenza", "sensor"));
  prendi("dm.ev_target_soc", (voce) => percentuale(voce) && conParola("target")(voce));

  /* Le aperture e i comandi: le classi di Home Assistant per prime. */
  prendi("dm.ev_portiere", (voce) => dominio(voce) === "lock");
  prendi("dm.ev_portiere", (voce) => classe(voce, states) === "lock");
  prendi("dm.ev_portiere", conParola("serratura"));
  prendi("dm.ev_portiere", (voce) => classe(voce, states) === "door");
  prendi("dm.ev_portiere", conParola("portiere"));
  prendi("dm.ev_finestrini", (voce) => classe(voce, states) === "window");
  prendi("dm.ev_finestrini", conParola("finestrini"));
  prendi("dm.ev_bagagliaio", conParola("bagagliaio"));
  prendi("dm.ev_cofano", conParola("cofano"));
  prendi("dm.ev_allarme", conParola("allarme"));
  prendi("dm.ev_motore", conParola("motore"));

  /* Le temperature: l'olio e quella di fuori sono due gradi diversi. */
  prendi(
    "dm.ev_temperatura_olio",
    (voce) => conClasse("temperature")(voce) && conParola("olio")(voce),
  );
  prendi(
    "dm.ev_temperatura_esterna",
    (voce) => conClasse("temperature")(voce) && conParola("esterna")(voce),
  );

  /* Le gomme: prima le quattro ruote per nome, poi quella riepilogativa con
   * quello che resta. */
  for (const [ref, ruota] of RUOTE)
    prendi(
      ref,
      (voce) => PAROLE.pneumatici.test(parole(voce, states)) && ruota.test(parole(voce, states)),
    );
  prendi("dm.ev_pneumatici", conParola("pneumatici"));

  return { mappa, tipo: motoreDalleCaselle(mappa) };
}

/**
 * Che auto e', a giudicare da quello che pubblica.
 *
 * Il serbatoio da solo dice benzina; la batteria di trazione con la ricarica
 * dice elettrica; tutte e due dicono ibrida. Quando non si capisce si tace —
 * `""` e' «elettrica», che e' il valore di sempre — perche' dichiarare un
 * motore sbagliato nasconde meta' della pagina a chi apre la card.
 */
export function motoreDalleCaselle(mappa = {}) {
  const serbatoio = Boolean(clean(mappa["dm.ev_carburante"]));
  const batteria = Boolean(clean(mappa["dm.ev_batteria_auto"]));
  if (serbatoio && batteria) return "ibrida";
  if (serbatoio) return "termica";
  return "";
}
