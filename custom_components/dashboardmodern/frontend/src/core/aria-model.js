/* Com'e' l'aria di casa, dai sensori che Home Assistant gia' dichiara.
 *
 * «Mi piacerebbe ci fosse un widget come quello luci che segni la qualita'
 * dell'aria relativa a un sensore» (#321).
 *
 * Non c'e' niente da configurare, come per il fumo e per gli allagamenti: un
 * sensore dell'aria si riconosce da quello che Home Assistant dice di lui —
 * `device_class: pm25`, `carbon_dioxide`, `volatile_organic_compounds`… — e
 * chi ne ha uno se lo ritrova in Home senza aprire nessuna scheda.
 *
 * La parte che serve pensarla e' un'altra: un numero da solo non dice niente.
 * «847 ppm» e' un dato; «l'aria e' discreta, apri una finestra» e' una
 * risposta. Qui ogni misura ha la sua scala — quelle delle polveri sottili
 * vengono dalle soglie dell'Agenzia europea dell'ambiente, quella
 * dell'anidride carbonica dalla norma sulla ventilazione degli ambienti
 * chiusi — e la tessera dice il giudizio peggiore fra quelli letti: l'aria di
 * una casa e' buona quando lo sono tutte le sue misure, non in media.
 *
 * Le soglie sono quattro gradini e non un indice unico: un indice sarebbe una
 * formula da spiegare, quattro parole no.
 */

import { pick } from "./i18n.js";

const clean = (valore) => String(valore ?? "").trim();

/** I quattro gradini, dal migliore al peggiore. */
export const GRADI = Object.freeze(["buona", "discreta", "scarsa", "cattiva"]);

const PAROLE = Object.freeze({
  buona: (locale) => pick("Buona", "Good", locale),
  discreta: (locale) => pick("Discreta", "Fair", locale),
  scarsa: (locale) => pick("Scarsa", "Poor", locale),
  cattiva: (locale) => pick("Cattiva", "Bad", locale),
});

/** La parola del giudizio, nella lingua della plancia. */
export function parolaDelGrado(grado, locale = "it") {
  return (PAROLE[clean(grado)] || PAROLE.buona)(locale);
}

/* Le misure che sappiamo leggere, con i tre confini fra i quattro gradini.
 *
 * Ogni misura ha la sua unita' di riferimento — `unita` — e le soglie sono
 * scritte in quella. Un sensore pero' puo' pubblicare in un'altra: il
 * monossido di carbonio arriva in µg/m³ da una stazione esterna, in mg/m³ da
 * un rilevatore domestico, in ppm da un altro ancora, e sono numeri che
 * differiscono di mille volte. Le soglie del monossido erano in ppm e si
 * applicavano a qualunque numero arrivasse: «Outdoor Environment CO = 156
 * µg/m³ … lo classifica come ARIA CATTIVA e come la peggiore delle 15
 * misure» (#340). Centocinquantasei microgrammi sono 0,14 ppm — aria buona —
 * letti come se fossero cento volte peggio. Adesso il valore si porta
 * nell'unita' di riferimento PRIMA di confrontarlo con le soglie, e quello che
 * si mostra resta nell'unita' in cui e' arrivato: l'unita' scritta accanto al
 * numero e' quella che il sensore ha letto, sempre.
 *
 * Da dove vengono i confini:
 * - PM2.5, PM10, NO₂, O₃, SO₂: le fasce dell'indice europeo dell'Agenzia
 *   europea dell'ambiente (buona/discreta/moderata/scarsa), in µg/m³;
 * - CO₂: le categorie di qualita' dell'aria interna della norma sulla
 *   ventilazione (EN 16798-1), in ppm;
 * - CO: le linee guida OMS 2021 — 4 mg/m³ sulle 24 ore, 10 mg/m³ sulle 8 ore
 *   (che e' anche il valore limite della direttiva europea 2008/50/CE) — e i
 *   30 mg/m³ sull'ora delle linee guida OMS del 2000. In mg/m³, perche' e'
 *   l'unita' in cui quei documenti li scrivono: 4 mg/m³ sono 4000 µg/m³, e
 *   circa 3,5 ppm.
 *
 * `perUnita` resta per i composti organici volatili: non sono UNA sostanza,
 * e fra microgrammi e parti per miliardo non c'e' una massa molare che
 * permetta di passare dall'una all'altra — hanno due scale, e basta.
 */
const MISURE = Object.freeze({
  pm25: { glifo: "🌫️", nome: ["PM2.5", "PM2.5"], unita: "µg/m³", soglie: [15, 25, 50] },
  pm10: { glifo: "🌫️", nome: ["PM10", "PM10"], unita: "µg/m³", soglie: [25, 50, 90] },
  pm1: { glifo: "🌫️", nome: ["PM1", "PM1"], unita: "µg/m³", soglie: [10, 20, 40] },
  carbon_dioxide: {
    glifo: "🫁",
    nome: ["Anidride carbonica", "Carbon dioxide"],
    unita: "ppm",
    massaMolare: 44.01,
    soglie: [800, 1000, 1400],
  },
  carbon_monoxide: {
    glifo: "☠️",
    nome: ["Monossido di carbonio", "Carbon monoxide"],
    unita: "mg/m³",
    massaMolare: 28.01,
    soglie: [4, 10, 30],
  },
  volatile_organic_compounds: {
    glifo: "🧪",
    nome: ["Composti organici volatili", "Volatile organic compounds"],
    unita: "µg/m³",
    soglie: [300, 1000, 3000],
    /* In parti per miliardo i numeri sono altri: stessa sostanza, altra scala. */
    perUnita: { ppb: [65, 220, 660], ppm: [0.065, 0.22, 0.66] },
  },
  volatile_organic_compounds_parts: {
    glifo: "🧪",
    nome: ["Composti organici volatili", "Volatile organic compounds"],
    unita: "ppb",
    soglie: [65, 220, 660],
    perUnita: { ppm: [0.065, 0.22, 0.66] },
  },
  nitrogen_dioxide: {
    glifo: "🏭",
    nome: ["Biossido di azoto", "Nitrogen dioxide"],
    unita: "µg/m³",
    massaMolare: 46.01,
    soglie: [40, 90, 120],
  },
  ozone: {
    glifo: "🌬️",
    nome: ["Ozono", "Ozone"],
    unita: "µg/m³",
    massaMolare: 48.0,
    soglie: [100, 130, 240],
  },
  sulphur_dioxide: {
    glifo: "🏭",
    nome: ["Biossido di zolfo", "Sulphur dioxide"],
    unita: "µg/m³",
    massaMolare: 64.07,
    soglie: [100, 200, 350],
  },
  aqi: {
    glifo: "📈",
    nome: ["Indice di qualità dell'aria", "Air quality index"],
    unita: "",
    soglie: [50, 100, 150],
  },
});

/* ── le unita' ────────────────────────────────────────────────────────── */

/* Le due famiglie in cui si misura un gas: per massa in un volume d'aria, o
 * per parti in volume. Dentro una famiglia si passa da un'unita' all'altra
 * con un fattore fisso; fra le due famiglie serve la massa molare della
 * sostanza, e il volume che una mole occupa. */
const PER_MASSA = Object.freeze({ "ng/m³": 0.001, "µg/m³": 1, "mg/m³": 1000, "g/m³": 1e6 });
const PER_PARTI = Object.freeze({ ppb: 0.001, ppm: 1, "%": 10000 });

/* Il volume di una mole di gas a 25 °C e 1 atm, in litri: e' la convenzione
 * con cui EPA e OMS scrivono le conversioni ppm ↔ mg/m³, e la stessa che usano
 * le integrazioni quando le fanno loro (mg/m³ = ppm × M / 24,45). */
const VOLUME_MOLARE = 24.45;

/* L'unita' come la scrive Home Assistant, ripulita: «ug/m3», «μg/m³» e
 * «µg/m³» sono la stessa cosa scritta con tre tastiere diverse. */
export function normalizzaUnita(unita) {
  return clean(unita)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/μ/g, "µ")
    .replace(/^u(?=g\/m)/, "µ")
    .replace(/m3$/, "m³");
}

/* Un valore nell'unita' di riferimento della misura.
 *
 * Torna il numero convertito, oppure il numero com'e' quando l'unita' non si
 * conosce o non c'e': un sensore senza unita' si legge come si e' sempre
 * letto, nella scala delle soglie, perche' e' l'unica ipotesi che non inventa
 * niente. */
export function nellUnitaDiRiferimento(valore, unita, misura) {
  const da = normalizzaUnita(unita);
  const a = normalizzaUnita(misura?.unita);
  if (!da || !a || da === a) return valore;
  const massa = PER_MASSA[da] != null;
  const parti = PER_PARTI[da] != null;
  if (!massa && !parti) return valore;
  const versoMassa = PER_MASSA[a] != null;
  const versoParti = PER_PARTI[a] != null;
  if (!versoMassa && !versoParti) return valore;
  /* Prima in µg/m³ o in ppm, poi — se serve — dall'una all'altra famiglia. */
  let base = valore * (massa ? PER_MASSA[da] : PER_PARTI[da]);
  if (massa && versoParti) {
    if (!misura?.massaMolare) return valore;
    base = (base * VOLUME_MOLARE) / (misura.massaMolare * 1000);
  } else if (parti && versoMassa) {
    if (!misura?.massaMolare) return valore;
    base = (base * misura.massaMolare * 1000) / VOLUME_MOLARE;
  }
  return base / (versoMassa ? PER_MASSA[a] : PER_PARTI[a]);
}

/** Le classi che questa lettura sa interpretare. */
export const CLASSI_ARIA = Object.freeze(Object.keys(MISURE));

const numero = (valore) => {
  const grezzo = clean(valore).replace(",", ".");
  const n = Number.parseFloat(grezzo);
  return Number.isFinite(n) ? n : null;
};

/** Se un'entita' e' una misura dell'aria: lo dice Home Assistant, non il nome. */
export function eUnaMisuraDellAria(entity, stato) {
  if (!clean(entity).startsWith("sensor.")) return false;
  return Boolean(MISURE[clean(stato?.attributes?.device_class)]);
}

/**
 * La lettura di un sensore: quanto, in che unita', e come sta.
 *
 * Torna `null` per quello che non si sa leggere — un sensore non disponibile,
 * o una classe che non e' dell'aria — perche' una casella vuota in mezzo alle
 * altre e' peggio di una casella in meno.
 */
export function letturaDellAria(entity, stato, locale = "it") {
  const classe = clean(stato?.attributes?.device_class);
  const misura = MISURE[classe];
  if (!misura) return null;
  const valore = numero(stato?.state);
  if (valore === null) return null;
  const unita = clean(stato?.attributes?.unit_of_measurement);
  /* Una scala tutta sua per quell'unita' (i composti organici volatili), o le
   * soglie di riferimento con il valore portato nella loro unita'. In tutti e
   * due i casi si confronta un numero con soglie scritte nella SUA unita':
   * era l'errore del #340, e non si rifa'. */
  const propria = misura.perUnita?.[normalizzaUnita(unita)];
  const soglie = propria || misura.soglie;
  const confronto = propria ? valore : nellUnitaDiRiferimento(valore, unita, misura);
  const grado =
    confronto <= soglie[0]
      ? "buona"
      : confronto <= soglie[1]
        ? "discreta"
        : confronto <= soglie[2]
          ? "scarsa"
          : "cattiva";
  return {
    entity: clean(entity),
    classe,
    glifo: misura.glifo,
    misura: pick(misura.nome[0], misura.nome[1], locale),
    /* Il numero e l'unita' come sono arrivati: sono quelli che si mostrano. */
    valore,
    unita,
    /* E come sono stati giudicati: il valore nella scala delle soglie. */
    confronto,
    unitaDiRiferimento: propria ? unita : misura.unita,
    grado,
    /* Quanto e' lontana dal primo gradino, in centesimi, per l'anello della
     * tessera: pieno vuol dire «guarda qui», non «va tutto bene». */
    quanto: Math.max(0, Math.min(100, Math.round((confronto / (soglie[2] || 1)) * 100))),
  };
}

/* Il tono della finestra: verde quando va bene, ambra quando c'e' da tenere
 * d'occhio, rosso quando c'e' da fare qualcosa. Sono i tre che la plancia usa
 * ovunque; i gradini sono quattro perche' «discreta» e «scarsa» dicono due
 * cose diverse a chi legge, anche se il colore e' lo stesso. */
export const TONO_DEL_GRADO = Object.freeze({
  buona: "bene",
  discreta: "corso",
  scarsa: "corso",
  cattiva: "guarda",
});

/**
 * Cosa c'e' da sapere, in una frase.
 *
 * Il numero da solo non dice niente: dice qualcosa quando gli si mette accanto
 * quale sostanza e', dov'e' misurata, e — dove la risposta e' ovvia — cosa
 * farci. Sull'anidride carbonica la risposta e' sempre la stessa e la sa
 * chiunque abbia mai avuto sonno in una stanza chiusa: aprire una finestra.
 */
export function fraseDellAria(giudizio, locale = "it") {
  if (!giudizio?.peggiore) return "";
  const { peggiore, quante } = giudizio;
  const dove = clean(peggiore.name);
  /* La sostanza, quanto, e in che unita': senza il numero la frase diceva
   * «la peggiore e' Anidride carbonica ppm», che non e' una frase. */
  const quanto = peggiore.valore.toLocaleString(locale || "it", {
    maximumFractionDigits: peggiore.valore >= 100 ? 0 : 1,
  });
  const misura = `${peggiore.misura} ${quanto}${peggiore.unita ? ` ${peggiore.unita}` : ""}`;
  const testa =
    quante > 1
      ? pick(
          `Fra ${quante} misure, la peggiore e' ${misura}${dove ? ` (${dove})` : ""}.`,
          `Of ${quante} readings, the worst is ${misura}${dove ? ` (${dove})` : ""}.`,
          locale,
        )
      : pick(
          `${misura}${dove ? ` (${dove})` : ""}.`,
          `${misura}${dove ? ` (${dove})` : ""}.`,
          locale,
        );
  if (
    peggiore.classe === "carbon_dioxide" &&
    (peggiore.grado === "scarsa" || peggiore.grado === "cattiva")
  )
    return `${testa} ${pick("Aprire una finestra la fa scendere in fretta.", "Opening a window brings it down quickly.", locale)}`;
  if (peggiore.grado === "buona")
    return `${testa} ${pick("Non c'e' niente da fare.", "Nothing to do.", locale)}`;
  return testa;
}

/** Il giudizio di un insieme di letture: il peggiore, perche' l'aria non e' una media. */
export function giudizioDellAria(letture = []) {
  const buone = (Array.isArray(letture) ? letture : []).filter(Boolean);
  if (!buone.length) return null;
  const peggiore = buone.reduce((peggio, voce) =>
    GRADI.indexOf(voce.grado) > GRADI.indexOf(peggio.grado) ? voce : peggio,
  );
  return { grado: peggiore.grado, peggiore, quante: buone.length };
}
