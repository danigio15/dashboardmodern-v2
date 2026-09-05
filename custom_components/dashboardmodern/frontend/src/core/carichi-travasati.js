/* Il sensore di una casa finito nei carichi dell'altra.
 *
 * Lo specchio posizionale `cd_flow_nodes` ha cinque caselle con un nome fisso,
 * una per cerchio, nate quando gli impianti erano uno solo. Con due impianti i
 * cerchi del secondo occupavano le stesse caselle del primo, e quelle caselle
 * portano anche l'entita' della potenza: la maschera dei carichi mostrava il
 * sensore dell'altra casa, e «Salva carichi» glielo scriveva addosso. Da li' in
 * poi il travaso stava nella configurazione, non solo sullo schermo.
 *
 * La perdita e' stata fermata dove nasceva. Qui si guarda cosa e' rimasto
 * scritto — e si guarda con una regola sola: non si cancella niente che non si
 * sappia dimostrare.
 *
 * ── perche' non basta trovare il doppione ───────────────────────────────────
 *
 * Due carichi di due impianti con lo stesso sensore: uno dei due e' la copia,
 * ma QUALE non e' scritto da nessuna parte. Lo specchio veniva riscritto da chi
 * salvava per ultimo, quindi il travaso e' andato in tutte e due le direzioni a
 * seconda dell'ordine in cui uno ha aperto le maschere. Nome, icona, colore e
 * posizione della copia diventano identici a quelli dell'originale: al momento
 * del salvataggio i due sono indistinguibili.
 *
 * Una cosa pero' lo specchio NON la portava: le altre entita' dell'energia —
 * il totale, quella di oggi, quella del mese. Quelle il carico se le e' tenute
 * sue. Ed e' li' che si vede chi e' la vittima: un carico che ha il contatore
 * `sensor.pompa_kwh` e la potenza `sensor.boiler_w` sta raccontando due
 * macchine diverse, e la potenza non e' la sua.
 *
 * Quando quel segno non c'e' — un carico con la sola potenza compilata — non si
 * tocca niente e lo si dice: chi configura sa in quale appartamento sta il
 * sensore, la plancia no. Cancellare dalla parte sbagliata sarebbe peggio del
 * difetto, perche' butterebbe via la meta' buona.
 */

const clean = (value) => String(value ?? "").trim();

/* Le cinque caselle dello specchio, nell'ordine in cui stavano. */
const CASELLE = Object.freeze(["boiler", "wb", "clima", "lav", "cuc"]);

/* Le code che dicono COSA misura un'entita', non DI CHI e'.
 *
 * `sensor.boiler_potenza` e `sensor.boiler_kwh` sono due misure della stessa
 * macchina: togliendo la coda restano lo stesso nome, ed e' quello il segno
 * che le lega. Sono in due lingue perche' in due lingue le scrivono le
 * integrazioni e chi si fa i template a mano. */
const CODE = [
  "power",
  "potenza",
  "energy",
  "energia",
  "consumo",
  "consumption",
  "today",
  "oggi",
  "daily",
  "giornaliera",
  "giornaliero",
  "month",
  "mese",
  "monthly",
  "mensile",
  "total",
  "totale",
  "lifetime",
  "kwh",
  "wh",
  "w",
];

/** Di quale macchina parla un'entita', a giudicare dal nome. */
export function radiceDellEntita(entity) {
  const testo = clean(entity).toLowerCase();
  const oggetto = testo.includes(".") ? testo.slice(testo.indexOf(".") + 1) : testo;
  const pezzi = oggetto.split("_").filter(Boolean);
  while (pezzi.length > 1 && CODE.includes(pezzi[pezzi.length - 1])) pezzi.pop();
  return pezzi.join("_");
}

const impiantoDi = (load) => clean(load?.plant);

/* Le altre entita' dell'energia di un carico: quelle che lo specchio non
 * toccava, e che quindi sono rimaste sue. */
function altreEntita(load) {
  return [
    load?.total_energy_entity,
    /* `energy_entity` e' il contatore di sempre, quello che una configurazione
     * vera ha compilato quasi certamente: dimenticarlo qui vorrebbe dire non
     * riconoscere quasi nessuna vittima. */
    load?.energy_entity,
    load?.history_entity,
    load?.daily_energy_entity,
    load?.monthly_energy_entity,
  ]
    .map(clean)
    .filter(Boolean);
}

/** Se questo carico riconosce come sua la macchina di quell'entita'. */
function laRiconosce(load, entity) {
  const radice = radiceDellEntita(entity);
  if (!radice) return false;
  return altreEntita(load).some((altra) => radiceDellEntita(altra) === radice);
}

/**
 * I carichi che portano il sensore di un altro impianto.
 *
 * Torna una voce per carico coinvolto: quale entita', di quale impianto e'
 * l'altro, e se si puo' dimostrare che questo e' la copia (`certo`). Non
 * cambia niente: chi chiama decide cosa farne, e la differenza fra `certo` e
 * no e' esattamente la differenza fra correggere e chiedere.
 */
export function carichiTravasati({ loads = [], flowNodes = null } = {}) {
  const elenco = Array.isArray(loads) ? loads.filter(Boolean) : [];
  /* Solo le entita' che lo specchio poteva iniettare: e' il vettore del
   * travaso, e un doppione che non passa di li' e' una scelta di chi
   * configura, non un difetto. */
  const dalloSpecchio = new Set();
  if (flowNodes && typeof flowNodes === "object" && !Array.isArray(flowNodes))
    for (const casella of CASELLE) {
      const potenza = clean(flowNodes?.[casella]?.pwr);
      if (potenza) dalloSpecchio.add(potenza);
    }
  if (!dalloSpecchio.size) return [];

  /* Chi porta quale potenza, per entita'. */
  const perEntita = new Map();
  for (const load of elenco) {
    const potenza = clean(load?.power_entity);
    if (!potenza || !dalloSpecchio.has(potenza)) continue;
    if (!perEntita.has(potenza)) perEntita.set(potenza, []);
    perEntita.get(potenza).push(load);
  }

  const trovati = [];
  for (const [entita, portatori] of perEntita) {
    /* Lo stesso sensore su due impianti diversi: e' il doppione. Sullo stesso
     * impianto due cerchi possono guardare la stessa presa, ed e' una scelta. */
    const impianti = new Set(portatori.map(impiantoDi));
    if (impianti.size < 2) continue;
    const riconoscono = portatori.filter((load) => laRiconosce(load, entita));
    for (const load of portatori) {
      /* Vittima dimostrata: questo carico non riconosce quella macchina — i
       * suoi contatori parlano d'altro — e un altro sì. */
      const certo = riconoscono.length > 0 && !laRiconosce(load, entita);
      trovati.push({
        id: clean(load?.id),
        impianto: impiantoDi(load),
        entita,
        certo,
        altri: [...impianti].filter((voce) => voce !== impiantoDi(load)),
      });
    }
  }
  return trovati;
}

/**
 * L'elenco ripulito di quello che si sa dimostrare.
 *
 * Si toglie la sola potenza, e solo dai carichi `certo`: il nome e l'icona
 * travasati restano: sono parole, si correggono guardandole, e cancellare un
 * nome che magari uno aveva scelto davvero sarebbe la stessa presunzione che
 * questo file esiste per evitare.
 */
export function togliLePotenzeTravasate(loads = [], flowNodes = null) {
  const lista = Array.isArray(loads) ? loads : [];
  const daPulire = new Set(
    carichiTravasati({ loads: lista, flowNodes })
      .filter((voce) => voce.certo)
      .map((voce) => voce.id),
  );
  if (!daPulire.size) return lista;
  return lista.map((load) =>
    daPulire.has(clean(load?.id)) ? { ...load, power_entity: "" } : load,
  );
}
