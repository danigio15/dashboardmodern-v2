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
 * `unita` distingue i casi in cui la stessa sostanza si misura in due modi: i
 * composti organici volatili si pubblicano in microgrammi al metro cubo o in
 * parti per miliardo, e sono numeri che differiscono di un fattore mille —
 * usare le soglie sbagliate direbbe «cattiva» a un'aria buona.
 */
const MISURE = Object.freeze({
  pm25: { glifo: "🌫️", nome: ["PM2.5", "PM2.5"], soglie: [15, 25, 50] },
  pm10: { glifo: "🌫️", nome: ["PM10", "PM10"], soglie: [25, 50, 90] },
  pm1: { glifo: "🌫️", nome: ["PM1", "PM1"], soglie: [10, 20, 40] },
  carbon_dioxide: {
    glifo: "🫁",
    nome: ["Anidride carbonica", "Carbon dioxide"],
    soglie: [800, 1000, 1400],
  },
  carbon_monoxide: {
    glifo: "☠️",
    nome: ["Monossido di carbonio", "Carbon monoxide"],
    soglie: [4.4, 9.4, 12.4],
  },
  volatile_organic_compounds: {
    glifo: "🧪",
    nome: ["Composti organici volatili", "Volatile organic compounds"],
    soglie: [300, 1000, 3000],
    /* In parti per miliardo i numeri sono altri: stessa sostanza, altra scala. */
    perUnita: { ppb: [65, 220, 660], ppm: [0.065, 0.22, 0.66] },
  },
  volatile_organic_compounds_parts: {
    glifo: "🧪",
    nome: ["Composti organici volatili", "Volatile organic compounds"],
    soglie: [65, 220, 660],
    perUnita: { ppm: [0.065, 0.22, 0.66] },
  },
  nitrogen_dioxide: {
    glifo: "🏭",
    nome: ["Biossido di azoto", "Nitrogen dioxide"],
    soglie: [40, 90, 120],
  },
  ozone: { glifo: "🌬️", nome: ["Ozono", "Ozone"], soglie: [100, 130, 240] },
  sulphur_dioxide: {
    glifo: "🏭",
    nome: ["Biossido di zolfo", "Sulphur dioxide"],
    soglie: [100, 200, 350],
  },
  aqi: {
    glifo: "📈",
    nome: ["Indice di qualità dell'aria", "Air quality index"],
    soglie: [50, 100, 150],
  },
});

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
  const soglie = misura.perUnita?.[unita.toLowerCase()] || misura.soglie;
  const grado =
    valore <= soglie[0]
      ? "buona"
      : valore <= soglie[1]
        ? "discreta"
        : valore <= soglie[2]
          ? "scarsa"
          : "cattiva";
  return {
    entity: clean(entity),
    classe,
    glifo: misura.glifo,
    misura: pick(misura.nome[0], misura.nome[1], locale),
    valore,
    unita,
    grado,
    /* Quanto e' lontana dal primo gradino, in centesimi, per l'anello della
     * tessera: pieno vuol dire «guarda qui», non «va tutto bene». */
    quanto: Math.max(0, Math.min(100, Math.round((valore / (soglie[2] || 1)) * 100))),
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
