// DM-FIX-20260812B
/* Pure period/statistics service. */
import { runtimeMetrics } from "./runtime-metrics.js";

export const PERIOD_SOURCES = Object.freeze([
  {
    key: "house",
    group: "house",
    totalKey: "total_energy",
    periodKeys: { day: "daily_energy", month: "monthly_energy", year: "annual_energy" },
    slots: {
      day: "dm.energy_consumo_casa_oggi",
      month: "dm.energy_consumo_casa_mese",
      year: "dm.energy_consumo_casa_anno",
    },
  },
  {
    key: "gridImport",
    group: "grid",
    totalKey: "total_import_energy",
    periodKeys: {
      day: "daily_import_energy",
      month: "monthly_import_energy",
      year: "annual_import_energy",
    },
    slots: {
      day: "dm.energy_energia_prelevata_oggi",
      month: "dm.energy_rete_acquistata_mese",
      year: "dm.energy_rete_acquistata_anno",
    },
  },
  {
    key: "gridExport",
    group: "grid",
    totalKey: "total_export_energy",
    periodKeys: {
      day: "daily_export_energy",
      month: "monthly_export_energy",
      year: "annual_export_energy",
    },
    slots: {
      day: "dm.energy_energia_immessa_oggi",
      month: "dm.energy_rete_venduta_mese",
      year: "dm.energy_rete_venduta_anno",
    },
  },
  {
    key: "solar",
    group: "solar",
    totalKey: "total_energy",
    periodKeys: { day: "daily_energy", month: "monthly_energy", year: "annual_energy" },
    slots: {
      day: "dm.energy_produzione_solare_oggi",
      month: "dm.energy_produzione_solare_mese",
      year: "dm.energy_produzione_solare_anno",
    },
  },
  {
    key: "batteryCharged",
    group: "battery",
    totalKey: "total_charged_energy",
    periodKeys: {
      day: "daily_charged_energy",
      month: "monthly_charged_energy",
      year: "annual_charged_energy",
    },
    slots: {
      day: "dm.energy_batteria_caricata_oggi",
      month: "dm.energy_batteria_caricata_mese",
      year: "dm.energy_batteria_caricata_anno",
    },
  },
  {
    key: "batteryDischarged",
    group: "battery",
    totalKey: "total_discharged_energy",
    periodKeys: {
      day: "daily_discharged_energy",
      month: "monthly_discharged_energy",
      year: "annual_discharged_energy",
    },
    slots: {
      day: "dm.energy_batteria_scaricata_oggi",
      month: "dm.energy_batteria_usata_mese",
      year: "dm.energy_batteria_usata_anno",
    },
  },
]);

const finite = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function rowTimestamp(row) {
  const raw = row?.start ?? row?.end ?? row?.last_updated ?? row?.timestamp ?? 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}

export function cumulativeValue(row) {
  return finite(row?.sum);
}

/**
 * Return the energy consumed in a period.
 * A single lifetime sample is deliberately not treated as a period value.
 */
export function periodConsumption(rows = [], baseline = null) {
  const ordered = (Array.isArray(rows) ? rows : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => rowTimestamp(left) - rowTimestamp(right));

  const values = ordered.map(cumulativeValue).filter((value) => value != null);
  const first = cumulativeValue(baseline);
  if (first != null && values.length) values.unshift(first);
  if (values.length < 2) return null;

  // Recorder's sum is already unit-normalized and reset-aware. Re-applying
  // counter reset logic here would count the same reset twice.
  return Math.max(0, values.at(-1) - values[0]);
}

/* Il consumo di ogni intervallo, dalla crescita del contatore del Recorder.
 *
 * ── Il primo intervallo di un'entita' nata da poco ───────────────────────
 *
 * «L'entita' della wallbox e' iniziata quest'anno e calcola male i valori.»
 *
 * Il consumo di un intervallo e' la differenza fra il suo contatore e quello
 * di prima, e per il primo intervallo il «quello di prima» lo porta la
 * `baseline`: chi chiede le statistiche ne pesca apposta una che sta subito
 * fuori dalla finestra. Ma un'entita' nata dentro la finestra una baseline
 * non ce l'ha — prima di lei non c'era niente da pescare — e allora il primo
 * intervallo restava senza predecessore e veniva BUTTATO VIA. Su una wallbox
 * accesa a meta' anno, il mese in cui e' entrata in funzione spariva da ogni
 * conto: dal totale dell'anno, dal grafico, dal riepilogo del dispositivo.
 *
 * Il valore giusto ce l'ha addosso. Il contatore del Recorder parte da zero
 * quando le statistiche di quell'entita' cominciano — e' cosi' che Home
 * Assistant tratta un contatore che cresce — quindi per il primo intervallo
 * di una serie il contatore E' il consumo di quell'intervallo.
 *
 * Vale solo quando la baseline manca DAVVERO, cioe' quando prima non c'era
 * niente. Con una baseline in mano non cambia niente: la si usa, come sempre.
 * La distinzione conta, perche' prendere il contatore per consumo in mezzo a
 * una serie vorrebbe dire scambiare il totale di sempre per il consumo di un
 * mese — l'errore opposto, e piu' grosso.
 *
 * ── Il contatore che riparte da zero ────────────────────────────────────
 *
 * C'e' un secondo momento in cui il contatore E' il consumo, e si riconosce
 * senza ambiguita': quando SCENDE. Un contatore che cresce non torna mai
 * indietro; se il valore di oggi e' piu' piccolo di quello di ieri, in mezzo
 * c'e' stato un azzeramento — un contatore mensile che gira, l'apparecchio
 * che riparte — e da li' il valore conta da capo. Il consumo di quel giorno
 * e' quello che il contatore segna adesso.
 *
 * Prima quella differenza negativa veniva schiacciata a zero, e il giorno
 * dell'azzeramento spariva: su un contatore mensile era il primo di ogni
 * mese, dodici giorni all'anno, e per una colonnina che carica di notte non
 * e' affatto poco.
 *
 * ── Scendere non basta: di quanto e' sceso ──────────────────────────────
 *
 * «Sceso vuol dire azzerato» era troppo poco, e mi e' costato un giro: il
 * Recorder ritocca all'indietro le sue somme, di pochissimo — 1300,0 che
 * diventa 1299,2 — e leggere quel ritocco come un azzeramento vuol dire
 * contare tutta la cumulata di sempre, mille e trecento, come consumo di un
 * secchiello. Non e' un caso di scuola: e' quello che faceva l'anno della
 * plancia sul contatore di rete importata.
 *
 * Le due cose si distinguono da QUANTO e' sceso, non dal fatto che sia
 * sceso. Un azzeramento riporta il contatore a zero e da li' riparte da
 * capo: il salto indietro e' grande, e quello che resta e' una frazione di
 * quello che c'era. Una correzione lima: toglie briciole, e quello che resta
 * e' praticamente tutto. Fra le due non c'e' zona grigia — un ritocco del
 * Recorder vale per mille, un riavvio vale per meta' — e la soglia sta in
 * mezzo, larga: se il contatore ha perso piu' di un decimo di se' e'
 * ripartito, altrimenti e' stato corretto e il secchiello non ha consumato.
 *
 * La direzione dell'errore e' scelta apposta. Prendere un riavvio per una
 * correzione costa un secchiello di consumo; prendere una correzione per un
 * riavvio costa gli anni di storia del contatore, scritti sullo schermo come
 * se fossero di oggi.
 */
const RIMASTO_DOPO_UN_RIAVVIO = 0.9;
export function recorderBucketConsumptions(rows = [], baseline = null) {
  const partenza = baseline && cumulativeValue(baseline) != null ? baseline : null;
  const ordered = [partenza, ...(Array.isArray(rows) ? rows : [])]
    .filter((row) => row && cumulativeValue(row) != null)
    .sort((left, right) => rowTimestamp(left) - rowTimestamp(right));
  const intervalli = partenza ? ordered.slice(1) : ordered;
  /* Il riferimento si porta avanti riga per riga, e non e' sempre la riga
   * precedente: dopo una correzione resta quello di PRIMA della correzione.
   * Altrimenti gli otto decimi tolti dal Recorder tornerebbero indietro come
   * consumo al secchiello dopo, e l'arco crescerebbe di quanto era stato
   * limato. Dopo un riavvio, invece, il riferimento e' il valore nuovo: da li'
   * il contatore conta davvero da capo. */
  let riferimento = partenza ? cumulativeValue(partenza) : null;
  return intervalli.map((row) => {
    const adesso = cumulativeValue(row);
    if (riferimento === null) {
      riferimento = adesso;
      return Object.freeze({ ...row, change: Math.max(0, adesso) });
    }
    const cresciuto = adesso - riferimento;
    if (cresciuto >= 0) {
      riferimento = adesso;
      return Object.freeze({ ...row, change: cresciuto });
    }
    if (adesso < riferimento * RIMASTO_DOPO_UN_RIAVVIO) {
      riferimento = adesso;
      return Object.freeze({ ...row, change: Math.max(0, adesso) });
    }
    return Object.freeze({ ...row, change: 0 });
  });
}

/* I mesi, contati sommando i giorni invece di sottrarre due contatori.
 *
 * «I dati della wallbox sono ancora sbagliati: il totale consumato da inizio
 *  anno e' 1440,76 kWh.» La plancia ne diceva 546.
 *
 * Il consumo di un mese si puo' ricavare in due modi. Sottraendo il contatore
 * di fine mese da quello del mese prima: giusto, e in una riga sola, FINCHE'
 * il contatore e' quello di sempre e non torna mai indietro. Oppure sommando
 * la crescita dei suoi giorni: sempre giusto.
 *
 * La differenza si vede su un contatore che si azzera ogni mese — una wallbox
 * col suo contatore mensile e' esattamente questo. Li' il contatore di fine
 * settembre non e' piu' grande di quello di fine agosto: e' il totale di
 * settembre contro il totale di agosto, due numeri che non stanno su nessuna
 * scala comune. La sottrazione da il DIVARIO fra due mesi al posto del consumo
 * di uno, e con lo zero come pavimento — un mese piu' magro del precedente
 * vale zero — l'anno viene fuori una frazione di quello vero.
 *
 * Sommare i giorni costa una domanda piu' grossa al Recorder e non sbaglia in
 * nessuno dei due casi: su un contatore di sempre da lo stesso identico
 * numero della sottrazione, su uno che si azzera perde al massimo il giorno in
 * cui l'azzeramento capita — il primo del mese, quando la colonnina ha appena
 * cominciato.
 *
 * E' puro: le righe arrivano gia' con la loro crescita, e i mesi si ricavano
 * dalla data di ogni giorno nel fuso di chi guarda.
 */
export function mesiDaiGiorni(righe = []) {
  const perMese = new Map();
  for (const riga of Array.isArray(righe) ? righe : []) {
    const istante = rowTimestamp(riga);
    if (!istante) continue;
    const quando = new Date(istante);
    const chiave = `${quando.getFullYear()}-${quando.getMonth()}`;
    const crescita = finite(riga?.change) || 0;
    const gia = perMese.get(chiave);
    if (!gia) {
      perMese.set(chiave, {
        start: new Date(quando.getFullYear(), quando.getMonth(), 1).toISOString(),
        change: Math.max(0, crescita),
        sum: cumulativeValue(riga),
        ultimo: istante,
      });
      continue;
    }
    gia.change += Math.max(0, crescita);
    /* Il contatore del mese e' quello dell'ultimo giorno che c'e': chi legge
     * `sum` invece di `change` deve trovarci l'ultimo valore, non il primo. */
    if (istante >= gia.ultimo) {
      gia.ultimo = istante;
      const contatore = cumulativeValue(riga);
      if (contatore != null) gia.sum = contatore;
    }
  }
  return [...perMese.values()]
    .sort((sinistra, destra) => Date.parse(sinistra.start) - Date.parse(destra.start))
    .map(({ ultimo: _ultimo, ...mese }) => Object.freeze(mese));
}

function endOfClosedRange(nextBoundary, now) {
  if (nextBoundary > now) return new Date(now);
  return new Date(nextBoundary);
}

/* Su quanti giorni si divide, per dire «media al giorno».
 *
 * Su un mese finito sono i suoi giorni: trenta a settembre, e non c'e' altro
 * da chiedersi. Sul mese in corso no — i giorni che non sono ancora arrivati
 * non hanno consumato niente, e metterli al denominatore non fa una media:
 * fa una previsione, e per difetto. Il 9 settembre con 68,1 kWh la plancia
 * diceva 2,27 kWh al giorno (68,1 diviso trenta) mentre il vero era 7,57
 * (68,1 diviso nove): chi lo leggeva vedeva un terzo del suo consumo.
 *
 * Un mese futuro non ha nemmeno un giorno passato: non si divide per zero e
 * non si inventa un numero, si risponde zero e chi scrive dira' «—».
 *
 * Il guscio storico questo conto lo faceva giusto. E' la nostra passata
 * canonica, che gli e' passata sopra, ad averlo perso: e' per questo che la
 * regola sta qui adesso, dove una prova la puo' tenere ferma.
 */
/* Il giorno che ha consumato piu' di tutti, e quanto.
 *
 * Il picco del mese lo scriveva il guscio storico con `toFixed(2)`, che non sa
 * in che lingua si parla: nello stesso riquadro si leggeva «26.37 kWh» accanto
 * a «68,1 kWh» e «47,7 kWh da FV» — un punto in mezzo a delle virgole. Il
 * numero era giusto, la lingua no, e non e' un dettaglio: un punto decimale
 * dove si aspetta una virgola si legge come un separatore delle migliaia.
 *
 * Qui esce il dato, non la scritta: il valore e la data del giorno. Le cifre e
 * il separatore li mette chi disegna, con lo stesso formattatore di tutti gli
 * altri numeri della card.
 */
export function ilGiornoDelPicco(giorni = []) {
  let picco = null;
  for (const giorno of Array.isArray(giorni) ? giorni : []) {
    const quanto = Number(giorno?.change);
    if (!Number.isFinite(quanto) || quanto <= 0) continue;
    if (picco && quanto <= picco.quanto) continue;
    const quando = new Date(rowTimestamp(giorno));
    picco = { quanto, quando: Number.isFinite(quando.getTime()) ? quando : null };
  }
  return picco;
}

export function giorniPerLaMedia(anno, mese, adesso = new Date()) {
  const anni = Number(anno);
  const mesi = Number(mese);
  if (!Number.isFinite(anni) || !Number.isFinite(mesi)) return 0;
  const oggi = new Date(adesso);
  const nelMeseInCorso = anni === oggi.getFullYear() && mesi === oggi.getMonth() + 1;
  if (nelMeseInCorso) return oggi.getDate();
  /* Il giorno zero del mese dopo e' l'ultimo di questo. */
  const ultimo = new Date(anni, mesi, 0);
  if (ultimo.getTime() > oggi.getTime()) return 0;
  return ultimo.getDate();
}

export function periodRange(kind, selected = new Date(), now = new Date()) {
  const date = new Date(selected);
  const current = new Date(now);
  let start;
  let next;
  let period;

  if (kind === "day") {
    start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next = new Date(start);
    next.setDate(next.getDate() + 1);
    period = "hour";
  } else if (kind === "year") {
    start = new Date(date.getFullYear(), 0, 1);
    next = new Date(date.getFullYear() + 1, 0, 1);
    /* A GIORNI, non a mesi, ed e' la correzione che mancava.
     *
     * «I dati della wallbox sono ancora sbagliati: il totale consumato da
     *  inizio anno e' 1440,76 kWh» — e la plancia ne diceva 546, per tre
     *  rilasci di fila.
     *
     * Su un contatore che si azzera ogni mese — e quello mensile di una
     * wallbox e' esattamente questo — i secchielli MENSILI del Recorder
     * portano il totale DI QUEL MESE: dodici numeri che non stanno su nessuna
     * scala comune. Da quella risposta il consumo dell'anno non si ricava
     * piu', qualunque conto ci si faccia sopra: l'informazione non c'e'.
     * `mesiDaiGiorni` lo diceva gia', ed era stato messo su un'altra porta —
     * `statisticsWithGrowth` — che questo percorso non attraversa.
     *
     * Costa una domanda piu' grossa: trecentosessantacinque righe invece di
     * dodici, per entita'. Ma l'anno si chiede in due archi — i mesi chiusi e
     * il mese aperto (`archiDellAnno`) — e quello dei mesi chiusi non cambia
     * mai piu', quindi la sua risposta si tiene. E su un contatore di sempre
     * il numero che ne esce e' identico a prima. */
    period = "day";
  } else {
    start = new Date(date.getFullYear(), date.getMonth(), 1);
    next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    period = "day";
  }

  return {
    start,
    end: endOfClosedRange(next, current),
    next,
    period,
    kind,
  };
}

/* Il giorno in corso si chiede in due archi, non in uno.
 *
 * Le statistiche dell'ora si compilano a ora finita: dentro l'ora aperta non
 * c'e' ancora nessuna riga, e la Giornaliera restava indietro fino a
 * sessanta minuti. Chiedere tutto il giorno a cinque minuti lo risolveva, ma
 * sono 288 righe per ogni entita' a ogni giro invece di 26 — per ogni fonte,
 * ogni dispositivo e ogni carico, su un Recorder che gia' arranca.
 *
 * Le ore chiuse non cambiano piu': si chiedono a ore, e la loro risposta si
 * tiene per tutta l'ora. A cinque minuti si chiede solo l'ora aperta, che
 * sono dodici righe. La crescita del giorno e' la somma delle due, ed e' lo
 * stesso conto di prima: differenza fra la prima e l'ultima lettura. */
export function archiDelPeriodo(kind, selected = new Date(), now = new Date()) {
  const range = periodRange(kind, selected, now);
  if (kind !== "day" || range.end <= range.start) return [range];
  const oraAperta = new Date(range.end);
  oraAperta.setMinutes(0, 0, 0);
  /* Appena passata la mezzanotte non c'e' nessuna ora chiusa da chiedere, e a
   * giorno finito non c'e' nessuna ora aperta. */
  if (oraAperta <= range.start) return [{ ...range, period: "5minute" }];
  if (oraAperta >= range.end) return [range];
  return [
    { ...range, end: oraAperta, next: oraAperta },
    { ...range, start: oraAperta, period: "5minute" },
  ];
}

export function baselineRange(kind, start) {
  const baselineStart = new Date(start);
  if (kind === "day") baselineStart.setHours(baselineStart.getHours() - 2);
  else if (kind === "year") baselineStart.setMonth(baselineStart.getMonth() - 1);
  else baselineStart.setDate(baselineStart.getDate() - 2);
  return { start: baselineStart, end: new Date(start) };
}

export function resolveEntity(reference, resolver = globalThis.resolveEntity) {
  const original = String(reference || "").trim();
  if (!original) return "";
  try {
    return String(resolver?.(original) || original).trim();
  } catch (_error) {
    return original;
  }
}

/* «E' un contatore totale?» — la domanda si fa in un posto solo.
 *
 * Da questa risposta dipende tutto il calcolo dell'energia: si parte da un
 * contatore che sale e non torna mai indietro, e giorno, mese e anno si
 * ricavano dalla differenza fra due letture. Se si sbaglia a riconoscerlo, i
 * numeri non sono un po' storti: sono un'altra cosa.
 *
 * La domanda era scritta due volte, in due moduli, con lo stesso nome e regole
 * diverse — ed e' proprio il genere di cosa che non deve poter divergere.
 * Ognuna delle due aveva ragione su una meta':
 *
 * - Una guardava solo il nome. Cosi' un sensore di *potenza* chiamato
 *   `sensor.total_power`, che sta in watt, passava per contatore totale: si
 *   prendeva la differenza fra due watt e la si chiamava energia. Numeri
 *   inventati. Lo stesso valeva per un contatore dell'acqua in litri marcato
 *   `total_increasing`.
 * - L'altra controllava di avere davvero un'entita' di energia, ma il suo
 *   elenco di parole era piu' corto: non conosceva «counter», e non guardava
 *   mai il nome amichevole. Un `sensor.energy_counter` in kWh, o un sensore
 *   che si chiama `sensor.dm_0154` ma che in casa si legge «Contatore
 *   energia», non li riconosceva nessuno dei due posti dove serviva.
 *
 * Qui c'e' l'unione delle due meta' giuste: prima si controlla che sia energia
 * — e in watt non lo e' mai — poi si accetta il vocabolario piu' largo. Un
 * sensore di cui non e' ancora arrivato nessun attributo passa lo stesso: al
 * primo disegno la casa e' ancora vuota, e rifiutarlo li' vorrebbe dire aprire
 * la plancia con l'energia in bianco.
 */
const UNITA_DI_POTENZA = /^(w|kw|mw)$/;
const UNITA_DI_ENERGIA = /^(wh|kwh|mwh)$/;
const PAROLE_DA_CONTATORE = /(^|[\s._-])(total|totale|lifetime|counter|contatore|meter)([\s._-]|$)/;

export function isCumulativeEnergyEntity(entityId, states = {}, resolver = (value) => value) {
  const original = String(entityId || "").trim();
  if (!original) return false;
  const resolved = resolveEntity(original, resolver);
  const state = states?.[resolved] || states?.[original] || null;
  const attributes = state?.attributes || {};

  const unita = String(attributes.unit_of_measurement || "")
    .trim()
    .toLowerCase();
  // I watt non sono energia: sono quanto sta consumando adesso.
  if (UNITA_DI_POTENZA.test(unita)) return false;
  const classe = String(attributes.device_class || "")
    .trim()
    .toLowerCase();
  // Con gli attributi in mano si pretende che parlino di energia: senza questo
  // un contatore dell'acqua in litri diventava un contatore della corrente.
  if (Object.keys(attributes).length && !UNITA_DI_ENERGIA.test(unita) && classe !== "energy")
    return false;

  const stateClass = String(attributes.state_class || "").toLowerCase();
  if (stateClass === "total" || stateClass === "total_increasing") return true;
  const testo = `${original} ${resolved} ${attributes.friendly_name || ""}`.toLowerCase();
  return PAROLE_DA_CONTATORE.test(testo);
}

export function sourcePlans(
  energy = {},
  kind = "month",
  states = {},
  overrides = {},
  resolver = (value) => value,
) {
  return PERIOD_SOURCES.flatMap((definition) => {
    const group = energy?.[definition.group] || {};
    const explicitKey = definition.periodKeys[kind];
    const explicit = String(group?.[explicitKey] || "").trim();
    const total = String(group?.[definition.totalKey] || "").trim();
    const legacy = String(overrides?.[definition.slots[kind]] || "").trim();
    const resolvedExplicit = resolveEntity(explicit, resolver);
    const resolvedTotal = resolveEntity(total, resolver);
    const explicitAliasesTotal = Boolean(
      explicit && total && resolvedExplicit && resolvedExplicit === resolvedTotal,
    );

    // A real period helper is authoritative for the current period even when
    // Home Assistant marks it total/total_increasing (utility_meter does this).
    // Migrations historically mirrored the lifetime Total sensor into the
    // annual field for compatibility. When both fields resolve to the same
    // entity it is still a lifetime counter and must be derived with Recorder,
    // never read directly as the current year's consumption.
    if (explicit && !explicitAliasesTotal) {
      const plans = [
        {
          ...definition,
          kind,
          slot: definition.slots[kind],
          entity: resolvedExplicit,
          source: explicit,
          direct: true,
          reason: "explicit-period",
        },
      ];
      // Direct helpers are not authoritative for a previous period. Prefer the
      // configured lifetime counter there. If no dedicated lifetime counter is
      // available, a cumulative explicit helper may still provide reset-aware
      // Recorder growth for historical periods.
      const historicalSource =
        total || (isCumulativeEnergyEntity(explicit, states, resolver) ? explicit : "");
      if (historicalSource) {
        plans.push({
          ...definition,
          kind,
          slot: definition.slots[kind],
          entity: resolveEntity(historicalSource, resolver),
          source: historicalSource,
          direct: false,
          fallback: true,
          reason: total ? "canonical-total-fallback" : "explicit-cumulative-fallback",
        });
      }
      return plans;
    }

    const source = total || explicit || legacy;
    if (!source) return [];
    if (!total && !explicit && !isCumulativeEnergyEntity(legacy, states, resolver)) return [];
    return [
      {
        ...definition,
        kind,
        slot: definition.slots[kind],
        entity: resolveEntity(source, resolver),
        source,
        direct: false,
        reason: explicitAliasesTotal
          ? "period-aliases-total"
          : total
            ? "canonical-total"
            : "legacy-cumulative",
      },
    ];
  });
}

/* I piani che si leggono dallo stato, e quelli che li deve ricavare il
 * Recorder. */
export function smistaIPiani(plans = [], selected, states = {}) {
  const valori = new Map();
  const direct = plans.filter((plan) => plan.direct);
  const selectedDate = new Date(selected);
  const today = new Date();
  const directIsCurrent = (kind) =>
    kind === "day"
      ? selectedDate.toDateString() === today.toDateString()
      : kind === "year"
        ? selectedDate.getFullYear() === today.getFullYear()
        : selectedDate.getFullYear() === today.getFullYear() &&
          selectedDate.getMonth() === today.getMonth();
  direct
    .filter((plan) => directIsCurrent(plan.kind))
    .forEach((plan) => {
      const value = readDirectState(plan.entity, states);
      if (value != null) valori.set(plan.key, value);
    });

  /* Nel periodo corrente l'entita' di periodo configurata e' l'unica
   * autorita': il ripiego dal contatore totale serve ai mesi passati, non a
   * sostituirla quando il suo stato non e' ancora arrivato. Lasciarlo
   * subentrare dipingeva un numero diverso (e sbagliato) per un giro, poi il
   * giro dopo arrivava quello vero — il valore che balla. Meglio nessun
   * valore per un attimo (la casella resta segnata come mancante) che un
   * valore sporco. */
  const currentDirectKeys = new Set(
    direct.filter((plan) => directIsCurrent(plan.kind)).map((plan) => plan.key),
  );
  const daRicavare = plans.filter(
    (plan) => !plan.direct && !(plan.fallback && currentDirectKeys.has(plan.key)),
  );
  return { valori, daRicavare };
}

/* Il nome di un arco: due archi con lo stesso nome sono la stessa domanda. */
export function chiaveDellArco(range) {
  return `${range.kind}|${range.period}|${range.start.getTime()}|${range.end.getTime()}`;
}

/* La crescita di un'entita' dentro un arco, dalle righe gia' in mano.
 *
 * Le righe arrivano da una domanda sola per tutti quelli che condividono
 * l'arco: qui si taglia il pezzo che riguarda questo arco — l'ultima lettura
 * prima del confine fa da partenza — e si prende la differenza. */
export function crescitaNellArco(righe = [], range, { continuazione = false } = {}) {
  const inizio = range.start.getTime();
  const fine = range.end.getTime();
  const ordinate = (Array.isArray(righe) ? righe : [])
    .slice()
    .sort((sinistra, destra) => rowTimestamp(sinistra) - rowTimestamp(destra));
  const prima = ordinate.filter((riga) => rowTimestamp(riga) < inizio);
  const dentro = ordinate.filter(
    (riga) => rowTimestamp(riga) >= inizio && rowTimestamp(riga) < fine,
  );
  const partenza =
    prima.at(-1) || (continuazione ? null : contatoreNatoDentro(prima, dentro, inizio));
  if (!dentro.length) return null;
  /* Senza un predecessore, la prima riga di dentro E' il punto di partenza:
   * vale zero, non se stessa.
   *
   * E' la cautela che teneva `periodConsumption`, e ci sono cascato dentro
   * riscrivendo questo conto: sommando i secchielli senza baseline, il primo
   * porta `max(0, adesso)`, cioe' tutto il contatore. Su un contatore di vita
   * di cui semplicemente non sono state chieste le righe precedenti vorrebbe
   * dire leggere una cumulata vecchia di anni come il consumo di quest'anno —
   * sbagliare in quel verso e' molto peggio che non rispondere.
   *
   * Quando invece il contatore e' nato DENTRO l'arco lo si sa, e allora
   * `contatoreNatoDentro` ha gia' messo una partenza a zero: li' il primo
   * secchiello vale quello che dice, ed e' giusto. */
  if (!partenza && dentro.length < 2) return null;
  const base = partenza || dentro[0];
  const secchielli = partenza ? dentro : dentro.slice(1);
  /* La SOMMA delle crescite dei secchielli, non la differenza fra il primo e
   * l'ultimo.
   *
   * Sul contatore di sempre sono lo stesso numero: le differenze si annullano
   * a catena e resta ultimo meno primo. Su uno che si azzera no — e li' solo
   * la somma e' vera, perche' ogni azzeramento lo vede il secchiello in cui
   * cade invece di mangiarsi tutto quello che c'era prima.
   *
   * Il conto per secchielli c'era gia' e lo usava chi disegna i grafici
   * (`recorderBucketConsumptions`): erano due modi di misurare la stessa cosa,
   * uno giusto sempre e uno giusto quasi sempre, e a comandare qui era il
   * secondo. Adesso ce n'e' uno. */
  return recorderBucketConsumptions(secchielli, base).reduce(
    (somma, riga) => somma + Math.max(0, Number(riga.change) || 0),
    0,
  );
}

/* Un contatore che a inizio periodo non c'era ancora parte da zero.
 *
 * La crescita si misura dall'ultima riga PRIMA dell'arco. Per un contatore
 * acceso dentro l'arco quella riga non esiste, e allora si partiva dalla prima
 * riga di dentro — buttando via tutto quello che quella riga stessa aveva gia'
 * accumulato. Dal campo: una wallbox installata quest'anno, contatore di vita a
 * 1440,76 kWh e tutto il consumo del 2026, e il Report ne mostrava 445,6.
 * Mancava il primo secchiello, cioe' il mese in cui la wallbox e' nata.
 *
 * Prima di quel periodo il contatore non aveva consumato niente: la partenza
 * giusta e' zero, non il suo primo valore. La `sum` del Recorder e' un totale
 * SUO — parte da zero alla prima statistica e si porta dietro i reset del
 * contatore fisico — quindi zero e' esattamente il punto in cui comincia.
 *
 * Si dice «nato dentro» solo quando il segno c'e': niente righe prima
 * dell'arco, e la prima riga di dentro che arriva DOPO il confine. Se la prima
 * riga sta proprio sul confine non si sa se il contatore e' nato li' o se le
 * righe di prima non sono state chieste, e allora non si tocca niente: sbagliare
 * in questo verso vorrebbe dire prendere una cumulata vecchia di anni per il
 * consumo di quest'anno.
 *
 * E lo si dice solo al PRIMO arco del periodo. Un periodo si chiede in piu'
 * archi — il giorno in ore chiuse piu' l'ora aperta, l'anno in mesi chiusi piu'
 * il mese aperto — e le crescite si sommano. Nell'arco che continua, «nessuna
 * riga prima del mio confine» non vuol dire niente: il pezzo di tempo prima del
 * confine se l'e' gia' preso l'arco davanti, che il contatore l'aveva visto
 * eccome. Senza questa regola l'ora aperta di un contatore con le righe rade
 * si prendeva tutta la sua vita per il consumo di un'ora: dalla prova del
 * giorno, 100,05 kWh in un'ora invece di 0,05. */
function contatoreNatoDentro(prima, dentro, inizio) {
  if (prima.length || !dentro.length) return null;
  if (rowTimestamp(dentro[0]) <= inizio) return null;
  return { start: new Date(inizio).toISOString(), sum: 0 };
}

function readDirectState(entity, states = {}) {
  const state = states?.[entity];
  const value = finite(state?.state);
  return value == null ? null : Math.max(0, value);
}

/* Quanto tempo dare a una domanda di statistiche.
 *
 * Non tutte pesano uguale: un giorno per ora sono ventiquattro righe, un mese
 * per giorno una trentina, ma un anno intero sono centinaia di secchielli che
 * il Recorder deve rileggere. Con un tempo unico per tutte — dodici secondi —
 * la domanda leggera lo sprecava e quella pesante non ce la faceva mai su una
 * macchina piccola: «la sezione energia non carica».
 *
 * Il tempo cresce con l'arco chiesto, e si ferma: oltre il minuto non e' piu'
 * attesa, e' una pagina che sembra rotta. */
export const TEMPO_MASSIMO_STATISTICHE = 60000;

/* Quante domande pesanti il Recorder riceve insieme. */
export const CORSIE_DEL_RECORDER = 2;

/* Le domande che pesano sul database: al Recorder si fanno poche per volta. */
export const PESANTI_PER_IL_RECORDER = Object.freeze(
  new Set(["recorder/statistics_during_period", "history/history_during_period"]),
);

/* Ogni quanto Home Assistant compila le statistiche.
 *
 * E' il numero da cui dipendono quasi tutte le attese di qui: il Recorder
 * mette insieme i secchielli da cinque minuti (e a ora finita quelli dell'ora)
 * ogni cinque minuti. Prima che quel giro passi, la stessa domanda porta a
 * casa le stesse identiche righe: richiederla e' lavoro sul server — la CPU
 * del mini PC — in cambio di niente. */
export const PASSO_DELLE_STATISTICHE_MS = 5 * 60_000;

/* Per quanto, dopo un timeout, il Recorder si considera in affanno: e' il
 * passo con cui le statistiche si compilano, quindi prima non c'e' niente di
 * nuovo da leggere comunque. */
export const AFFANNO_DEL_RECORDER_MS = PASSO_DELLE_STATISTICHE_MS;

/* Quante risposte del Recorder si tengono da parte.
 *
 * La cache non buttava mai via niente: su una plancia accesa giorno e notte —
 * che e' il caso vero, il tablet appeso al muro — ogni giro lasciava dentro
 * una voce nuova e nessuna usciva mai. Si tengono le ultime, e le scadute se
 * ne vanno da sole: sono le uniche due ragioni per cui una risposta serve
 * ancora. */
export const VOCI_TENUTE_IN_CACHE = 64;

/* Se un arco di tempo e' finito, cioe' se dentro non puo' piu' entrare niente.
 *
 * Un mese chiuso non cambia piu': la sua risposta vale finche' si vuole. Un
 * arco che finisce adesso invece cresce, e va riletto. Il confine e' il passo
 * con cui le statistiche si compilano: quando la fine e' piu' vecchia di
 * quello, tutte le righe che potevano entrarci sono gia' state scritte. */
export function arcoChiuso(fine, adesso = Date.now()) {
  const a = momentoDi(fine);
  return a != null && a <= adesso - PASSO_DELLE_STATISTICHE_MS;
}

/* Un momento, comunque sia scritto: data, millisecondi o testo ISO. */
function momentoDi(valore) {
  if (valore instanceof Date) return valore.getTime();
  const numero = typeof valore === "number" ? valore : Date.parse(valore);
  return Number.isFinite(numero) ? numero : null;
}

/* La fine di un arco, come entra nella chiave della cache.
 *
 * Era la fine al millisecondo, e siccome per il periodo corrente la fine e'
 * «adesso», ogni giro nasceva una chiave nuova: la cache non ha mai risposto
 * a nessuno, e ogni aggiornamento tornava dritto sul Recorder. Un arco chiuso
 * porta la sua fine esatta; uno aperto la porta arrotondata al passo con cui
 * le statistiche si compilano, che e' quanto quella risposta resta buona. */
export function fineDaChiave(fine, adesso = Date.now()) {
  const a = momentoDi(fine);
  if (a == null) return String(fine);
  if (arcoChiuso(a, adesso)) return new Date(a).toISOString();
  return new Date(
    Math.floor(a / PASSO_DELLE_STATISTICHE_MS) * PASSO_DELLE_STATISTICHE_MS,
  ).toISOString();
}

/* Quanto si aspetta l'istantanea di tutti gli stati.
 *
 * `get_states` e' la risposta piu' grossa che Home Assistant manda: ogni
 * entita' della casa con tutti i suoi attributi, megabyte interi su una casa
 * grande. Dal telefono, attraverso Nabu Casa, dodici secondi non bastavano:
 * la domanda scadeva, il flusso degli stati moriva li' e la Home restava sui
 * numeri dell'avvio — «sezione aperta ma i dati non si caricano». */
export const TEMPO_PER_L_ISTANTANEA = 60_000;

/* Da quanto riparte la ripresa del flusso dopo un tentativo andato male, e
 * fino a quanto si allarga: si riprova sempre, mai piu' spesso di cosi'. */
export const RIPRESA_DEL_FLUSSO_MS = 1000;
export const RIPRESA_DEL_FLUSSO_MASSIMA_MS = 30_000;

export function tempoPerLeStatistiche(start, end, base = 12000) {
  const da = Date.parse(start);
  const a = Date.parse(end);
  if (!Number.isFinite(da) || !Number.isFinite(a) || a <= da) return base;
  const giorni = (a - da) / 86400000;
  /* Fino a due giorni vale il tempo di sempre; poi mezzo secondo per giorno,
   * che su un anno fa tre minuti teorici e si ferma al tetto. */
  const cresciuto = giorni <= 2 ? base : base + Math.round((giorni - 2) * 500);
  return Math.min(TEMPO_MASSIMO_STATISTICHE, Math.max(base, cresciuto));
}

/* Se questo errore vuol dire «non conosco quel campo».
 *
 * Home Assistant risponde con un messaggio, non con un codice: si guarda cosa
 * dice. Un timeout e una connessione caduta NON sono di compatibilita', e
 * rifare la domanda non li aggiusta — li raddoppia. */
export function eUnErroreDiCompatibilita(errore) {
  const testo = String(errore?.message || errore || "").toLowerCase();
  if (!testo) return false;
  if (/timeout|socket|connection|closed|network|abort/.test(testo)) return false;
  return /unit|unknown|invalid|unsupported|not a valid|extra keys|required key/.test(testo);
}

export class HomeAssistantBroker {
  /* La risposta del periodo corrente vale quanto dura il dato: cinque minuti.
   *
   * Era un minuto, ed era gia' un compromesso; ma il minuto non lo vedeva
   * nessuno, perche' la chiave della cache portava la fine dell'arco al
   * millisecondo — cioe' «adesso» — e ogni giro nasceva una chiave nuova:
   * nessuna risposta e' mai stata riusata, e ogni aggiornamento tornava sul
   * Recorder (dal campo: la CPU del mini PC). Adesso la chiave e' arrotondata
   * al passo con cui le statistiche si compilano, e il tempo che si tiene e'
   * lo stesso passo: prima di allora la stessa domanda porta le stesse righe. */
  constructor({
    timeout = 12000,
    cacheCurrentMs = PASSO_DELLE_STATISTICHE_MS,
    cacheHistoricalMs = 600000,
    ripresaDelFlussoMs = RIPRESA_DEL_FLUSSO_MS,
  } = {}) {
    this.timeout = timeout;
    this.cacheCurrentMs = cacheCurrentMs;
    this.cacheHistoricalMs = cacheHistoricalMs;
    this.ripresaDelFlussoMs = ripresaDelFlussoMs;
    /* Il flusso degli stati che qualcuno ha chiesto di tenere vivo (vedi
     * `keepStateFeedAlive`): cosa vuole, e il timer della prossima ripresa. */
    this.flussoVoluto = null;
    this.ripresaDelFlusso = 0;
    this.tentativiDelFlusso = 0;
    /* La fila davanti al Recorder, e da quando arranca (vedi `request`). */
    this.inFilaAlRecorder = [];
    this.inCorsoAlRecorder = 0;
    this.recorderLentoDa = 0;
    this.socket = null;
    this.connection = null;
    this.authenticated = false;
    this.nextId = 150000;
    this.pending = new Map();
    this.inflight = new Map();
    this.cache = new Map();
    this.subscription = 0;
    this.statesStarted = false;
  }

  /* Il flusso degli stati si tiene vivo da solo.
   *
   * Prima si partiva una volta, all'avvio, e se quell'unico tentativo andava
   * male — l'istantanea scaduta, la presa non ancora aperta — nessuno
   * riprovava: niente sottoscrizione, niente eventi, la Home ferma sui numeri
   * dell'avvio finche' non si ricaricava la pagina. Qui si riprova finche'
   * non riesce, con una pausa che si allarga, e si riparte da capo ogni volta
   * che la presa cade (`reset`): e' quello che fa una presa vera. */
  keepStateFeedAlive({ snapshot = true, onReady = () => {}, onError = () => {} } = {}) {
    this.flussoVoluto = { snapshot, onReady, onError };
    this.tentativiDelFlusso = 0;
    return this.riprendiIlFlusso();
  }

  async riprendiIlFlusso() {
    const voluto = this.flussoVoluto;
    if (!voluto || this.ripresaDelFlusso) return false;
    if (this.statesStarted && this.subscription) return true;
    try {
      await this.startStateFeed({ snapshot: voluto.snapshot });
      this.tentativiDelFlusso = 0;
      voluto.onReady();
      return true;
    } catch (error) {
      voluto.onError(error);
      this.tentativiDelFlusso += 1;
      const attesa = Math.min(
        RIPRESA_DEL_FLUSSO_MASSIMA_MS,
        this.ripresaDelFlussoMs * 2 ** Math.min(10, this.tentativiDelFlusso - 1),
      );
      this.programmaLaRipresa(attesa);
      return false;
    }
  }

  programmaLaRipresa(attesa) {
    if (!this.flussoVoluto || this.ripresaDelFlusso) return;
    this.ripresaDelFlusso =
      globalThis.setTimeout?.(() => {
        this.ripresaDelFlusso = 0;
        this.riprendiIlFlusso();
      }, attesa) || 0;
  }

  token() {
    const values = [
      globalThis.DASHBOARDMODERN_AUTH_TOKEN,
      globalThis.__DASHBOARDMODERN_REAL_TOKEN__,
      globalThis.LONG_LIVED_TOKEN,
      globalThis.HA_TOKEN,
    ];
    try {
      const config = JSON.parse(globalThis.localStorage?.getItem("cd_connection") || "{}");
      values.push(config.token, config.access_token);
    } catch (_error) {}
    return values.map((value) => String(value || "").trim()).find(Boolean) || "";
  }

  url() {
    const protocol = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${globalThis.location?.host || "dashboardmodern-bridge"}/api/websocket`;
  }

  reset(error = null) {
    const socket = this.socket;
    this.socket = null;
    this.connection = null;
    this.authenticated = false;
    this.subscription = 0;
    this.statesStarted = false;
    /* Presa caduta: il flusso riparte sulla prossima, se qualcuno lo vuole. */
    if (this.flussoVoluto) this.programmaLaRipresa(this.ripresaDelFlussoMs);
    if (error) {
      this.pending.forEach(({ reject, timer }) => {
        globalThis.clearTimeout?.(timer);
        reject(error);
      });
      this.pending.clear();
      this.inflight.clear();
    }
    try {
      if (socket?.readyState === 1) socket.close();
    } catch (_error) {}
  }

  ingestState(state, { emitEvent = true } = {}) {
    const id = String(state?.entity_id || "").trim();
    if (!id) return false;
    const copy = { ...state, attributes: { ...(state.attributes || {}) } };
    const registries = [];
    try {
      if (typeof _RAW_STATES !== "undefined" && _RAW_STATES) registries.push(_RAW_STATES);
    } catch (_error) {}
    try {
      if (typeof STATES !== "undefined" && STATES) registries.push(STATES);
    } catch (_error) {}
    globalThis._RAW_STATES ||= {};
    globalThis.STATES ||= {};
    registries.push(globalThis._RAW_STATES, globalThis.STATES);
    [...new Set(registries)].forEach((registry) => {
      registry[id] = copy;
    });
    if (
      emitEvent &&
      !copy.attributes?.dashboardmodern_derived &&
      typeof globalThis.CustomEvent === "function"
    ) {
      globalThis.dispatchEvent?.(
        new globalThis.CustomEvent("dashboardmodern:state-changed", {
          detail: { entity_id: id, state: copy },
        }),
      );
    }
    return true;
  }

  handleMessage(event, resolveConnection, rejectConnection) {
    let message;
    try {
      message = JSON.parse(event?.data || event);
    } catch (_error) {
      return;
    }

    if (message.type === "auth_required") {
      const token = this.token();
      if (!token) {
        rejectConnection(new Error("Home Assistant token missing"));
        return;
      }
      this.socket?.send(JSON.stringify({ type: "auth", access_token: token }));
      return;
    }
    if (message.type === "auth_ok") {
      this.authenticated = true;
      resolveConnection(this.socket);
      return;
    }
    if (message.type === "auth_invalid") {
      rejectConnection(new Error(message.message || "Invalid Home Assistant authentication"));
      return;
    }
    if (message.type === "event" && message.id === this.subscription) {
      this.ingestState(message.event?.data?.new_state);
      return;
    }
    if (message.type !== "result" || message.id == null) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    globalThis.clearTimeout?.(pending.timer);
    if (message.success === false)
      pending.reject(new Error(message.error?.message || "HA request failed"));
    else pending.resolve(message.result ?? null);
  }

  connect() {
    if (this.authenticated && this.socket?.readyState === 1) return Promise.resolve(this.socket);
    if (this.connection) return this.connection;
    if (typeof globalThis.WebSocket !== "function") {
      return Promise.reject(new Error("WebSocket unavailable"));
    }

    this.connection = new Promise((resolve, reject) => {
      let settled = false;
      let timer = 0;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout?.(timer);
        callback(value);
      };
      timer = globalThis.setTimeout?.(() => {
        /* Una presa che non si e' aperta in tempo non si lascia in giro: da
         * sola si aprirebbe piu' tardi, con nessuno ad ascoltarla. */
        try {
          if (this.socket) this.socket.close();
        } catch (_error) {}
        finish(reject, new Error("Home Assistant connection timeout"));
      }, this.timeout);
      try {
        const socket = new globalThis.WebSocket(this.url());
        this.socket = socket;
        socket.onmessage = (event) =>
          this.handleMessage(
            event,
            (value) => finish(resolve, value),
            (error) => finish(reject, error),
          );
        socket.onerror = () => finish(reject, new Error("Home Assistant connection unavailable"));
        socket.onclose = () => {
          if (this.socket === socket) this.reset();
        };
      } catch (error) {
        finish(reject, error);
      }
    })
      .catch((error) => {
        this.reset(error);
        throw error;
      })
      .finally(() => {
        this.connection = null;
      });
    return this.connection;
  }

  /* `timeout` e' per le domande che si sa che pesano — un mese di storico da
   * un Recorder lento, attraverso Nabu Casa — e non deve cambiare il tempo di
   * tutte le altre. Senza, e' quello del broker. */
  /* Al Recorder si chiedono al massimo due cose per volta.
   *
   * Un aggiornamento dell'Energia lancia sette domande insieme — giorno,
   * mese, anno, i dispositivi per ognuno, i carichi — e ognuna e' una lettura
   * delle statistiche sul database. Su un server piccolo si contendono il
   * disco a vicenda: tutte rallentano, qualcuna scade, e la pagina resta sul
   * velo o su «0 kWh · timeout» (dal campo: il mini PC). In fila nessuna
   * domanda aspetta le altre mentre il suo cronometro corre: il tempo concesso
   * parte quando la domanda parte davvero, non quando si mette in fila.
   *
   * Una per volta (1.4.11) era troppo poco: sette domande in fila su un
   * Recorder da due secondi sono quattordici secondi prima del primo numero,
   * «devi velocizzare il caricamento dei dati energia». Due corsie dimezzano
   * l'attesa e restano lontane dalle sette di prima. */
  async request(payload, timeout = this.timeout) {
    if (!PESANTI_PER_IL_RECORDER.has(payload?.type)) return this.spedisci(payload, timeout);
    return new Promise((resolve, reject) => {
      this.inFilaAlRecorder.push(() =>
        this.spedisci(payload, timeout)
          .then(resolve, reject)
          .finally(() => {
            this.inCorsoAlRecorder -= 1;
            this.avanzaLaFila();
          }),
      );
      this.avanzaLaFila();
    });
  }

  /* La fila va avanti anche quando una domanda cade: chi viene dopo non
   * eredita il fallimento di chi lo precedeva. */
  avanzaLaFila() {
    while (this.inCorsoAlRecorder < CORSIE_DEL_RECORDER && this.inFilaAlRecorder.length) {
      this.inCorsoAlRecorder += 1;
      this.inFilaAlRecorder.shift()();
    }
  }

  /** Se il Recorder ha appena fatto scadere una domanda: chi aggiorna rallenta. */
  recorderInAffanno(adesso = Date.now()) {
    return this.recorderLentoDa > 0 && adesso - this.recorderLentoDa < AFFANNO_DEL_RECORDER_MS;
  }

  async spedisci(payload, timeout = this.timeout) {
    const socket = await this.connect();
    const id = ++this.nextId;
    const perIlRecorder = payload?.type === "recorder/statistics_during_period";
    if (perIlRecorder) runtimeMetrics.increment("recorderRequests");
    const attesa =
      Number.isFinite(Number(timeout)) && Number(timeout) > 0 ? Number(timeout) : this.timeout;
    return new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout?.(() => {
        this.pending.delete(id);
        if (perIlRecorder) this.recorderLentoDa = Date.now();
        reject(new Error("Home Assistant response timeout"));
      }, attesa);
      this.pending.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, ...payload }));
      } catch (error) {
        globalThis.clearTimeout?.(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async cachedRequest(payload, cacheKey, maxAge = 0, timeout = 0) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < maxAge) {
      /* Riusata vuol dire viva: torna in fondo alla fila, cosi' quando si pota
       * escono le risposte che non serviva piu' a nessuno. */
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.value;
    }
    if (this.inflight.has(cacheKey)) return this.inflight.get(cacheKey);
    const promise = this.request(payload, timeout)
      .then((value) => {
        if (maxAge > 0) {
          this.cache.set(cacheKey, { at: Date.now(), fino: Date.now() + maxAge, value });
          this.potaLaCache();
        }
        return value;
      })
      .finally(() => this.inflight.delete(cacheKey));
    this.inflight.set(cacheKey, promise);
    return promise;
  }

  /* La cache non cresce per sempre.
   *
   * Prima nessuna voce ne usciva mai: su una plancia accesa giorno e notte —
   * il tablet appeso al muro — la memoria del browser saliva e basta. Escono
   * le scadute, che non risponderebbero piu' a nessuno, e poi le piu' vecchie
   * finche' non si sta dentro il numero di voci che si tengono. */
  potaLaCache(adesso = Date.now(), tenute = VOCI_TENUTE_IN_CACHE) {
    for (const [chiave, voce] of this.cache) {
      if (Number(voce?.fino) > adesso) continue;
      this.cache.delete(chiave);
    }
    for (const chiave of this.cache.keys()) {
      if (this.cache.size <= tenute) break;
      this.cache.delete(chiave);
    }
    return this.cache.size;
  }

  async statistics(ids, start, end, period = "day") {
    const originals = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!originals.length) return {};
    const mapped = new Map(originals.map((id) => [id, resolveEntity(id)]));
    const statisticIds = [...new Set([...mapped.values()].filter(Boolean))];
    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();
    const historical = arcoChiuso(endIso);
    /* La chiave porta la fine arrotondata, non quella al millisecondo: due
     * domande dello stesso arco corrente dentro lo stesso passo di
     * compilazione sono la stessa domanda, e la seconda si serve da qui. */
    const key = `statistics|${period}|${startIso}|${fineDaChiave(endIso)}|${statisticIds.join(",")}`;
    const payload = {
      type: "recorder/statistics_during_period",
      start_time: startIso,
      end_time: endIso,
      statistic_ids: statisticIds,
      period,
      types: ["sum"],
      units: { energy: "kWh" },
    };
    const eta = this.cacheHistoricalMs;
    const attesa = tempoPerLeStatistiche(startIso, endIso, this.timeout);
    let result;
    try {
      result = await this.cachedRequest(
        payload,
        key,
        historical ? eta : this.cacheCurrentMs,
        attesa,
      );
    } catch (error) {
      /* La seconda domanda serve a UNA cosa sola: le versioni di Home
       * Assistant che non conoscono `units` rispondono con un errore, e a
       * quelle si richiede senza.
       *
       * Prima si rifaceva la domanda per QUALUNQUE errore, timeout compreso.
       * Su un Recorder lento — che e' esattamente il caso in cui il timeout
       * scatta — voleva dire chiedergli una seconda volta la stessa cosa
       * pesante mentre stava ancora arrancando sulla prima: il doppio del
       * carico proprio sulla cosa che era gia' troppo lenta, e ventiquattro
       * secondi di attesa invece di dodici prima di dirlo a chi guarda.
       *
       * Un timeout, o una connessione caduta, non si ricadono: si lasciano
       * uscire, cosi' il giro di riprova di sopra li vede e aspetta il suo
       * turno invece di raddoppiare. */
      if (!eUnErroreDiCompatibilita(error)) throw error;
      const compatiblePayload = { ...payload };
      delete compatiblePayload.units;
      const compatibleKey = `${key}|compat`;
      result = await this.cachedRequest(
        compatiblePayload,
        compatibleKey,
        historical ? eta : this.cacheCurrentMs,
        attesa,
      );
    }
    return Object.fromEntries(
      originals.map((id) => [id, result?.[mapped.get(id)] || result?.[id] || []]),
    );
  }

  /* Chi si legge dallo stato e chi lo deve ricavare il Recorder.
   *
   * La scelta e' la stessa per chiunque chieda dei valori — l'Energia, gli
   * elettrodomestici, i carichi — e per questo sta scritta una volta sola. */
  async valuesForPlans(plans, selected, states = globalThis.STATES || {}) {
    const { valori, daRicavare } = smistaIPiani(plans, selected, states);
    if (!daRicavare.length) return valori;
    const kind = daRicavare[0].kind;
    const { caduti } = await this.valoriPerArchi(
      archiDelPeriodo(kind, selected).map((range) => ({ plans: daRicavare, range })),
      valori,
    );
    /* Chi chiama da solo si aspetta che una domanda caduta si veda: e' chi
     * legge piu' archi insieme (l'Energia) a decidere cosa farne. */
    if (caduti.length && !valori.size) throw caduti[0].errore;
    return valori;
  }

  /* Piu' archi in una volta: UNA domanda al Recorder per arco.
   *
   * Un aggiornamento dell'Energia erano sette letture delle statistiche —
   * giorno, mese, anno, i dispositivi per ognuno, i carichi — e due di quelle
   * coprivano tredici mesi. Le fonti, i dispositivi e i carichi dello stesso
   * arco chiedono le stesse righe allo stesso pezzo di database: messi
   * insieme sono una domanda sola con piu' entita' dentro, che per il
   * Recorder e' quasi lo stesso lavoro di una (dal campo, la #333: aprendo
   * il Report «il Recorder e' lento» e tutti i valori a zero).
   *
   * E un piano che compare in DUE archi vale la somma delle sue crescite: e'
   * cosi' che l'anno costa poco — i mesi chiusi non cambiano piu', la loro
   * risposta si tiene, e del mese aperto si rilegge solo quello, che e'
   * l'arco che si stava gia' chiedendo per la Mensile.
   *
   * Un arco che cade non porta giu' gli altri: quello che e' arrivato si
   * tiene, e chi ha chiesto decide (vedi il pacchetto parziale dell'Energia). */
  /* I giorni, per chi li chiede.
   *
   * La domanda al Recorder torna GIA' a giorni — `period` di un arco mensile
   * e' `day` — e qui si riducevano a un totale, buttando la serie. Il picco
   * del mese e' il massimo di quella serie: senza tenerla si doveva chiedere
   * di nuovo, e una seconda domanda per un dato che era gia' arrivato e' un
   * giro di Recorder regalato.
   *
   * Si tiene solo per chi mette `conIGiorni` nella richiesta: tenerla per
   * tutte vorrebbe dire portarsi dietro trecento righe per ogni misura di
   * ogni periodo, e a novantanove di quelle non serve nessuno.
   */
  async valoriPerArchi(richieste = [], valori = new Map(), alPasso = () => {}, giorni = new Map()) {
    const perArco = new Map();
    /* Chi comincia il suo periodo e chi lo continua: della stessa misura — la
     * stessa `plan.key` — puo' esserci un arco a ore chiuse e uno a cinque
     * minuti, e solo quello che parte prima puo' aver visto nascere il
     * contatore (vedi `contatoreNatoDentro`). */
    const primoArco = new Map();
    for (const { plans = [], range, conIGiorni = false } of richieste) {
      if (!range || !plans.length || range.end <= range.start) continue;
      const chiave = chiaveDellArco(range);
      const gruppo = perArco.get(chiave) || { range, chiave, plans: [], conIGiorni: false };
      gruppo.plans.push(...plans);
      if (conIGiorni) gruppo.conIGiorni = true;
      perArco.set(chiave, gruppo);
      const quando = range.start.getTime();
      for (const plan of plans) {
        if (!plan?.key) continue;
        const visto = primoArco.get(plan.key);
        if (visto == null || quando < visto) primoArco.set(plan.key, quando);
      }
    }
    const caduti = [];
    /* Quante domande sono state fatte, di quante: e' la riga che si legge
     * sopra i numeri mentre si aspetta. */
    const gruppi = [...perArco.values()];
    let fatte = 0;
    alPasso(fatte, gruppi.length);
    await Promise.all(
      gruppi.map(async ({ range, chiave, plans, conIGiorni }) => {
        try {
          const ids = [...new Set(plans.map((plan) => plan.entity).filter(Boolean))];
          if (!ids.length) return;
          const baseline = baselineRange(range.kind, range.start);
          // One Recorder request contains both the sample immediately before the
          // boundary and all samples in the requested period. This is the same data
          // contract used for Energy: growth = final sum - initial sum.
          const righe = await this.statistics(ids, baseline.start, range.end, range.period);
          for (const plan of plans) {
            const continuazione =
              (primoArco.get(plan.key) ?? range.start.getTime()) < range.start.getTime();
            const crescita = crescitaNellArco(righe[plan.entity], range, { continuazione });
            if (crescita == null) continue;
            const arrotondata = Math.round(crescita * 1000) / 1000;
            valori.set(plan.key, (valori.get(plan.key) ?? 0) + arrotondata);
            if (conIGiorni) {
              const dentro = (righe[plan.entity] || []).filter((riga) => {
                const quando = rowTimestamp(riga);
                return quando >= range.start.getTime() && quando < range.end.getTime();
              });
              const prima = (righe[plan.entity] || []).filter(
                (riga) => rowTimestamp(riga) < range.start.getTime(),
              );
              giorni.set(plan.key, recorderBucketConsumptions(dentro, prima.at(-1) || null));
            }
          }
        } catch (errore) {
          /* Chi e' caduto si dice con nome e cognome: chi aspettava proprio
           * quell'arco lo sa, e chi aspettava un altro non ne paga il prezzo. */
          caduti.push({ chiave, errore });
        } finally {
          fatte += 1;
          alPasso(fatte, gruppi.length);
        }
      }),
    );
    return { valori, caduti, giorni };
  }

  async valuesForEntities(ids, kind, selected) {
    const plans = [...new Set((ids || []).map(String).filter(Boolean))].map((entity) => ({
      key: entity,
      entity: resolveEntity(entity),
      source: entity,
      kind,
      direct: false,
    }));
    return this.valuesForPlans(plans, selected);
  }

  /* Il flusso degli stati: prima la sottoscrizione, poi l'istantanea.
   *
   * Prima era il contrario, e l'istantanea era anche una domanda in piu':
   * il guscio della plancia chiede gia' `get_states` sulla sua presa e
   * riempie i registri che leggono tutti (`STATES`, `_RAW_STATES`), e qui se
   * ne chiedeva un'altra uguale — due volte tutta la casa a ogni avvio,
   * sulla stessa connessione — con dodici secondi di tempo. Sul telefono
   * scadeva, e con lei moriva la sottoscrizione che veniva dopo. Adesso la
   * sottoscrizione parte subito, che e' leggera e non dipende da niente, e
   * l'istantanea si chiede solo a chi non ha un guscio che la porta
   * (`snapshot: false` quando c'e'). */
  async startStateFeed({ snapshot = true } = {}) {
    if (this.statesStarted && this.subscription) return true;
    this.statesStarted = true;
    try {
      await this.subscribeToStates();
      if (snapshot) await this.snapshotStates();
      return true;
    } catch (error) {
      this.statesStarted = false;
      throw error;
    }
  }

  async subscribeToStates() {
    const socket = await this.connect();
    if (this.subscription && this.socket === socket) return this.subscription;
    const id = ++this.nextId;
    await new Promise((resolve, reject) => {
      const timer = globalThis.setTimeout?.(() => {
        this.pending.delete(id);
        reject(new Error("State subscription timeout"));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, type: "subscribe_events", event_type: "state_changed" }));
    });
    this.subscription = id;
    return id;
  }

  /* Tutti gli stati in una volta, nei registri, senza un evento per ognuno. */
  async snapshotStates() {
    const states = await this.cachedRequest(
      { type: "get_states" },
      "get_states",
      5000,
      TEMPO_PER_L_ISTANTANEA,
    );
    (Array.isArray(states) ? states : []).forEach((state) =>
      this.ingestState(state, { emitEvent: false }),
    );
    return Array.isArray(states) ? states.length : 0;
  }
}
