/* Il periodo di uno storico: quanto indietro guardare, e da quando a quando.
 *
 * «Nella scheda temperatura il grafico permette solo di scegliere 24h/7g.
 * Inserire la possibilita' di inserire data inizio e data fine oltre a piu'
 * periodi predefiniti (1 ora, 5 ore, 10 ore, 1 mese, 2 mesi…).» E la stessa
 * cosa in ogni finestra dove si vede uno storico: il popup delle misure, il
 * grafico della stanza, la cronologia della connettivita'.
 *
 * Il periodo e' un dato — un inizio e una fine in millisecondi — e questo
 * modulo lo produce da quello che uno sceglie: un numero di ore, un nome di
 * serie («7g»), o due istanti scritti a mano. Il futuro non ha storia, e un
 * intervallo lungo un anno e' il massimo che ha senso chiedere al Recorder.
 * Le parole per dirlo stanno in `it`/`en` accanto a ogni periodo di serie:
 * chi disegna le passa a `t`.
 */

const ORA = 3_600_000;
const pulito = (valore) => String(valore ?? "").trim();

export const PERIODI = Object.freeze([
  Object.freeze({ chiave: "1h", ore: 1, it: "1 ora", en: "1 hour" }),
  Object.freeze({ chiave: "5h", ore: 5, it: "5 ore", en: "5 hours" }),
  Object.freeze({ chiave: "10h", ore: 10, it: "10 ore", en: "10 hours" }),
  Object.freeze({ chiave: "24h", ore: 24, it: "24 ore", en: "24 hours" }),
  Object.freeze({ chiave: "7g", ore: 168, it: "7 giorni", en: "7 days" }),
  Object.freeze({ chiave: "1m", ore: 720, it: "1 mese", en: "1 month" }),
  Object.freeze({ chiave: "2m", ore: 1440, it: "2 mesi", en: "2 months" }),
]);

export const ORE_DI_SERIE = 24;
/** Un anno: oltre, il Recorder non ha quasi mai niente e la domanda pesa. */
export const ORE_MASSIME = 24 * 366;
/** Meno di un minuto non e' un intervallo. */
export const MINIMO_MS = 60_000;

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

function istante(valore) {
  if (valore instanceof Date) return valore.getTime();
  if (typeof valore === "number") return Number.isFinite(valore) ? valore : NaN;
  const testo = pulito(valore);
  if (!testo) return NaN;
  if (/^\d{10,}$/.test(testo)) return Number(testo);
  return Date.parse(testo);
}

/** Il periodo di serie con queste ore, se c'e'. */
export function periodoDaOre(ore) {
  const n = numero(ore);
  return PERIODI.find((periodo) => periodo.ore === n) || null;
}

/** Le ultime N ore, fino ad adesso. */
export function intervalloDaOre(ore, adesso = Date.now()) {
  const n = numero(ore);
  if (n === null || n <= 0) return null;
  const durata = Math.min(n, ORE_MASSIME) * ORA;
  return { start: adesso - durata, end: adesso, ore: durata / ORA, personalizzato: false };
}

/**
 * Da quando a quando, scritto a mano.
 *
 * Una fine mancante e' adesso; una fine nel futuro si riporta ad adesso; un
 * inizio troppo lontano si avvicina alla fine di un anno. Un inizio che non
 * si legge, o che viene dopo la fine, non e' un intervallo: `null`.
 */
export function intervalloPersonalizzato(inizio, fine, adesso = Date.now()) {
  let start = istante(inizio);
  let end = istante(fine);
  if (!Number.isFinite(start)) return null;
  if (!Number.isFinite(end)) end = adesso;
  if (end > adesso) end = adesso;
  if (end - start < MINIMO_MS) return null;
  if (end - start > ORE_MASSIME * ORA) start = end - ORE_MASSIME * ORA;
  return { start, end, ore: (end - start) / ORA, personalizzato: true };
}

/**
 * L'intervallo da una scelta qualunque: un numero di ore, la chiave di un
 * periodo di serie, un oggetto `{ start, end }` o `{ ore }`, o un intervallo
 * gia' fatto. `null` quando non se ne ricava niente.
 */
export function intervalloDa(scelta, adesso = Date.now()) {
  if (scelta && typeof scelta === "object" && !(scelta instanceof Date)) {
    /* Un intervallo gia' fatto ripassa uguale: non si riconta niente. */
    if (
      typeof scelta.personalizzato === "boolean" &&
      Number.isFinite(scelta.start) &&
      Number.isFinite(scelta.end) &&
      Number.isFinite(scelta.ore)
    )
      return {
        start: scelta.start,
        end: scelta.end,
        ore: scelta.ore,
        personalizzato: scelta.personalizzato,
      };
    if (scelta.start !== undefined || scelta.end !== undefined)
      return intervalloPersonalizzato(scelta.start, scelta.end, adesso);
    if (scelta.ore !== undefined) return intervalloDaOre(scelta.ore, adesso);
    return null;
  }
  const preset = PERIODI.find((periodo) => periodo.chiave === pulito(scelta));
  if (preset) return intervalloDaOre(preset.ore, adesso);
  return intervalloDaOre(scelta, adesso);
}

/** La chiave con cui una risposta si tiene in memoria: le ore, o i due istanti. */
export function chiaveDellIntervallo(intervallo) {
  if (!intervallo) return "";
  if (!intervallo.personalizzato) return `${intervallo.ore}h`;
  return `${Math.floor(intervallo.start / MINIMO_MS)}-${Math.floor(intervallo.end / MINIMO_MS)}`;
}

/** Quanto fine e' l'asse del tempo per questo intervallo. */
/* Le ore di un intervallo, o di una finestra del grafico che le chiama `hours`. */
const oreDi = (intervallo) => numero(intervallo?.ore ?? intervallo?.hours) ?? ORE_DI_SERIE;

export function granularita(intervallo) {
  const ore = oreDi(intervallo);
  if (ore <= 48) return "ore";
  if (ore <= 24 * 14) return "giorni-ore";
  return "giorni";
}

/** Ogni quanto mettere una tacca sull'asse del tempo, in millisecondi. */
export function passoDelleTacche(intervallo) {
  const ore = oreDi(intervallo);
  if (ore <= 12) return ORA;
  if (ore <= 48) return 6 * ORA;
  if (ore <= 24 * 14) return 24 * ORA;
  if (ore <= 24 * 62) return 7 * 24 * ORA;
  return 14 * 24 * ORA;
}

/** Un istante scritto sull'asse, nella lingua giusta e con la grana giusta. */
export function etichettaDelTempo(ms, grana = "ore", lingua = "it") {
  const data = new Date(ms);
  if (!Number.isFinite(data.getTime())) return "";
  try {
    if (grana === "ore")
      return data.toLocaleTimeString(lingua, { hour: "2-digit", minute: "2-digit" });
    if (grana === "giorni-ore")
      return data.toLocaleString(lingua, { weekday: "short", hour: "2-digit", minute: "2-digit" });
    return data.toLocaleDateString(lingua, { day: "numeric", month: "short" });
  } catch (_error) {
    return data.toISOString();
  }
}

/** Il nome del periodo: quello di serie, o «dal … al …». */
export function nomeDelPeriodo(intervallo, lingua = "it") {
  if (!intervallo) return "";
  const preset = intervallo.personalizzato ? null : periodoDaOre(intervallo.ore);
  if (preset) return lingua.toLowerCase().startsWith("it") ? preset.it : preset.en;
  const scrivi = (ms) => {
    try {
      return new Date(ms).toLocaleString(lingua, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_error) {
      return new Date(ms).toISOString();
    }
  };
  return `${scrivi(intervallo.start)} → ${scrivi(intervallo.end)}`;
}

/* Le caselle `datetime-local` parlano ora locale senza fuso: si scrive e si
 * legge in quella forma, che e' quella che uno intende. */
export function perInputLocale(ms) {
  const data = new Date(ms);
  if (!Number.isFinite(data.getTime())) return "";
  const due = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${due(data.getMonth() + 1)}-${due(data.getDate())}T${due(data.getHours())}:${due(data.getMinutes())}`;
}

export function daInputLocale(testo) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(pulito(testo));
  if (!m) return null;
  const ms = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  return Number.isFinite(ms) ? ms : null;
}
