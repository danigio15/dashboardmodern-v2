/* L'elenco delle sezioni: cosa c'è, dove si configura, e se si vede.
 *
 * «Per cortesia mi organizzi le sezioni del config con criterio, vedo cose
 *  mischiate in sezioni che non c'entrano nulla.»
 * «Dove posso inserire i binary sensor di porte e finestre? Non trovo più la
 *  sezione dove inserirli.» (#399)
 *
 * La seconda è la prima vista da chi la usa. Le sezioni della plancia sono
 * venticinque, ognuna con la sua scheda nel Config e il suo interruttore, e
 * l'interruttore stava DENTRO la scheda: per sapere se una sezione era accesa
 * bisognava aprirla, e per sapere quali esistevano bisognava aprirle tutte.
 * Chi cercava i Varchi non li trovava perché non c'era nessun posto dove
 * guardare l'elenco di quello che c'è.
 *
 * Questo è quell'elenco. Dice, per ogni sezione: come si chiama, in quale
 * scheda del Config si configura, e con quale chiave di `cd_sections` si
 * accende. Da qui lo leggono in due — chi disegna la fascia dentro una
 * scheda e chi disegna l'elenco unico — e prima erano due elenchi.
 *
 * ── Perché la chiave e la scheda sono due cose diverse ───────────────────
 *
 * La scheda è dove si configura («sez3»), la chiave è cosa si accende
 * («boiler»). Non coincidono quasi mai, e nessuna delle due si può inventare:
 * la scheda la conoscono le prove e i collegamenti che la gente si è salvata,
 * la chiave la legge il guscio in `cd_sections`. Scriverne una diversa vuol
 * dire una preferenza che nessuno legge — è già successo, ed è il motivo per
 * cui questa mappa esiste invece di essere dedotta.
 *
 * È puro: nessun DOM, nessuna memoria, nessun orologio.
 */

import { FAMIGLIE, famigliaDellaScheda } from "./alberatura-del-config.js";
import { TITOLI_TERMICI } from "./impianti-termici.js";

const pulito = (valore) => String(valore ?? "").trim();

/**
 * Le sezioni della plancia: scheda del Config, chiave di `cd_sections`, nome.
 *
 * L'ordine qui dentro non conta — a metterle in fila ci pensa l'alberatura,
 * che sa già in che ordine si leggono le schede.
 */
export const SEZIONI = Object.freeze(
  [
    { scheda: "sez0", chiave: "home", glifo: "🏠", it: "Home", en: "Home" },
    { scheda: "sez1", chiave: "energy", glifo: "⚡", it: "Energia", en: "Energy" },
    { scheda: "sez2", chiave: "ev", glifo: "🚗", it: "Auto elettrica", en: "Electric car" },
    /* Il nome non si riscrive qui: e' quello che il modulo degli impianti
     * termici mette sulla linguetta al posto di «Solare», e scriverne un altro
     * vorrebbe dire un elenco che chiama una scheda in un modo e la scheda che
     * si chiama in un altro. Il glifo resta quello del guscio: la linguetta
     * cambia la parola, non il disegno. */
    {
      scheda: "sez3",
      chiave: "boiler",
      glifo: "🌞",
      it: TITOLI_TERMICI.sezione[0],
      en: TITOLI_TERMICI.sezione[1],
    },
    { scheda: "sez4", chiave: "security", glifo: "🛡️", it: "Sicurezza", en: "Security" },
    {
      scheda: "sez6",
      chiave: "server",
      glifo: "🖥️",
      it: "Server e rete",
      en: "Machines and network",
    },
    { scheda: "sez7", chiave: "temp", glifo: "🌡️", it: "Temperature", en: "Temperatures" },
    { scheda: "sez9", chiave: "clima", glifo: "❄️", it: "Clima", en: "Climate" },
    { scheda: "tapp", chiave: "tapparelle", glifo: "🪟", it: "Finestre", en: "Windows" },
    { scheda: "pool", chiave: "piscina", glifo: "🏊", it: "Piscina", en: "Pool" },
    { scheda: "irr", chiave: "irrigazione", glifo: "💧", it: "Irrigazione", en: "Irrigation" },
    {
      scheda: "appliances",
      chiave: "appliances",
      /* La pagina non si chiama come la chiave: e' «appliances-main», e chi
       * mette i disegni nella barra guarda il nome della pagina. Scriverlo qui
       * costa una riga; non scriverlo costa una voce nuda nella barra, che e'
       * il difetto tornato quattro volte. */
      pagina: "appliances-main",
      glifo: "🧺",
      it: "Elettrodomestici",
      en: "Appliances",
    },
    { scheda: "robot", chiave: "robot", glifo: "🤖", it: "Aspirapolvere", en: "Vacuum" },
    { scheda: "animali", chiave: "animali", glifo: "🐾", it: "Animali", en: "Pets" },
    { scheda: "luci", chiave: "luci", glifo: "💡", it: "Luci", en: "Lights" },
    { scheda: "stanze", chiave: "stanze", glifo: "🛋️", it: "Stanze", en: "Rooms" },
    { scheda: "agenda", chiave: "calendario", glifo: "📅", it: "Agenda", en: "Calendar" },
    { scheda: "ups", chiave: "ups", glifo: "🔌", it: "UPS", en: "UPS" },
    { scheda: "allerte", chiave: "allerte", glifo: "⛈️", it: "Allerte", en: "Alerts" },
    { scheda: "rifiuti", chiave: "rifiuti", glifo: "🗑️", it: "Rifiuti", en: "Waste" },
    /* I varchi (#367, #377): i contatti di porte e finestre. È la sezione che
     * in #399 non si trovava — sta nella famiglia della Sicurezza, e da qui
     * adesso si vede senza doverla cercare. */
    { scheda: "varchi", chiave: "varchi", glifo: "🚪", it: "Varchi", en: "Openings" },
    /* La presenza (#432): i sensori di movimento e di presenza. Sta accanto ai
     * varchi perché è la stessa domanda — cosa succede in casa adesso — fatta
     * su un'altra famiglia di sensori. */
    { scheda: "presenza", chiave: "presenza", glifo: "🏃", it: "Presenza", en: "Presence" },
    {
      scheda: "doors",
      chiave: "porte",
      /* Anche qui pagina e chiave si chiamano diverso: si accende «porte», si
       * apre «aperture». */
      pagina: "aperture",
      glifo: "🔓",
      it: "Porte e cancelli",
      en: "Doors and gates",
    },
    { scheda: "media", chiave: "media", glifo: "🎵", it: "Musica", en: "Music" },
    { scheda: "batterie", chiave: "batterie", glifo: "🔋", it: "Batterie", en: "Batteries" },
    /* Le sezioni che uno si fa da se' non hanno UNA pagina: ne hanno una per
     * sezione creata, e ognuna si porta il simbolo che l'utente ha scelto. La
     * scheda del Config invece e' una sola, ed e' quella. */
    {
      scheda: "mie",
      chiave: "mie",
      pagina: null,
      glifo: "⭐",
      it: "Le tue sezioni",
      en: "Your sections",
    },
  ].map((voce) => Object.freeze(voce)),
);

/**
 * La chiave di `cd_sections` che governa una scheda del Config.
 *
 * È la mappa che la fascia verde dentro ogni scheda usava per conto suo. Sta
 * qui perché adesso la leggono in due, e due copie della stessa mappa vogliono
 * dire che prima o poi una delle due impara una sezione e l'altra no.
 */
export const CHIAVI_PER_SCHEDA = Object.freeze(
  Object.fromEntries(SEZIONI.map((voce) => [voce.scheda, voce.chiave])),
);

/** La sezione che si configura in questa scheda, o `null`. */
export function sezioneDellaScheda(scheda) {
  const id = pulito(scheda);
  return SEZIONI.find((voce) => voce.scheda === id) || null;
}

/**
 * Se una sezione si vede nella plancia.
 *
 * Il guscio scrive `false` per nascondere e non scrive niente per mostrare:
 * quello che non è mai stato toccato è acceso, ed è la regola giusta — una
 * sezione nuova deve comparire a chi aggiorna, non restare spenta in attesa
 * che qualcuno la scopra.
 */
export function sezioneAccesa(sezioni, chiave) {
  return sezioni?.[pulito(chiave)] !== false;
}

/** Quante sono accese e quante in tutto, per dirlo in una riga. */
export function quanteAccese(sezioni, elenco = SEZIONI) {
  const tutte = elenco.length;
  return { accese: elenco.filter((voce) => sezioneAccesa(sezioni, voce.chiave)).length, tutte };
}

/**
 * Le sezioni raggruppate per famiglia, nell'ordine dell'alberatura.
 *
 * È lo stesso raggruppamento delle linguette, e non per simmetria: chi guarda
 * l'elenco e poi apre il Config deve ritrovare le stesse sette insegne nello
 * stesso ordine, o sono due mappe della stessa casa disegnate da due persone
 * che non si sono parlate.
 *
 * Una famiglia senza sezioni non compare.
 */
export function sezioniPerFamiglia(elenco = SEZIONI) {
  const perFamiglia = new Map();
  for (const voce of elenco) {
    const chiave = famigliaDellaScheda(voce.scheda);
    if (!perFamiglia.has(chiave)) perFamiglia.set(chiave, []);
    perFamiglia.get(chiave).push(voce);
  }
  return FAMIGLIE.filter((famiglia) => perFamiglia.get(famiglia.chiave)?.length).map(
    (famiglia) => ({
      ...famiglia,
      sezioni: perFamiglia.get(famiglia.chiave),
    }),
  );
}

/**
 * La pagina della plancia che apre questa sezione, o `null` se non ne ha una.
 *
 * Quasi sempre la pagina si chiama come la chiave — «luci» si accende e «luci»
 * si apre — e le tre eccezioni stanno scritte nell'elenco. Serve a chi mette i
 * disegni di casa nella barra in basso: quella tabella è indicizzata sul nome
 * della pagina, e chi aggiunge una sezione conosce la chiave, non la pagina.
 */
export function paginaDellaSezione(voce) {
  if (!voce) return null;
  if (voce.pagina === null) return null;
  return pulito(voce.pagina) || pulito(voce.chiave) || null;
}
