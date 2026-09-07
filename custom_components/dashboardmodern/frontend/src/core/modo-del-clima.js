/* La modalita' del riscaldamento, quando a dirla e' un'entita' a parte (#362).
 *
 * «In genere i termostati smart espongono una o piu' entita' che indicano la
 * modalita' del riscaldamento. Io ho TADO e due modalita' HOME e AWAY ma altri
 * potrebbero avere altre modalita', tipo HOLIDAY, BOOST ecc. Nella sezione
 * clima aggiungere un campo dove inserire questo tipo di entita'.»
 *
 * La card del clima dice target e ambiente. Non dice se la casa e' in CASA o
 * FUORI, ed e' la prima cosa da sapere: un termosifone a 17 gradi con la casa
 * in FUORI sta facendo il suo lavoro, lo stesso termosifone con la casa in CASA
 * e' un termosifone che non scalda.
 *
 * Le modalita' non sono un elenco chiuso — ognuno ha le sue — quindi qui non
 * si decide COSA puo' esistere: si legge quello che c'e' e, quando si
 * riconosce, gli si da' il vestito giusto. Una modalita' mai vista si mostra
 * lo stesso, col suo nome: meglio una parola che non conosciamo che nessuna.
 *
 * Nucleo puro: niente documento, niente servizi. Il comando da chiamare si
 * DESCRIVE qui e lo esegue chi ha la connessione, cosi' «cosa succede se tocco
 * questa pastiglia» si prova a tavolino.
 */

const pulito = (valore) => String(valore ?? "").trim();
const inglese = (locale) =>
  !String(locale ?? "it")
    .toLowerCase()
    .startsWith("it");
const scegli = (it, en, locale) => (inglese(locale) ? en : it);

/* Gli stati che vogliono dire «non lo so»: non sono una modalita', sono il
 * silenzio di un'integrazione che non ha ancora risposto. */
const MUTI = new Set(["unknown", "unavailable", "none", "null", ""]);

/* Le famiglie che si sanno vestire, con le parole che le nominano.
 *
 * Le parole sono quelle che si trovano davvero in giro: TADO scrive HOME e
 * AWAY, le integrazioni italiane scrivono Casa e Fuori, i termostati europei
 * usano i preset di Home Assistant (`comfort`, `eco`, `away`, `sleep`,
 * `boost`). Non e' un elenco chiuso: e' quello che si riconosce. */
const FAMIGLIE = Object.freeze([
  {
    famiglia: "home",
    glifo: "🏠",
    nome: ["In casa", "Home"],
    parole: ["home", "casa", "in casa", "at_home", "athome", "presente", "present", "occupied"],
  },
  {
    famiglia: "away",
    glifo: "🚪",
    nome: ["Fuori casa", "Away"],
    parole: [
      "away",
      "fuori",
      "fuori casa",
      "not_home",
      "nothome",
      "assente",
      "absent",
      "unoccupied",
    ],
  },
  {
    famiglia: "holiday",
    glifo: "🧳",
    nome: ["Vacanza", "Holiday"],
    parole: ["holiday", "vacanza", "vacanze", "ferie", "vacation", "urlaub", "away_long"],
  },
  {
    famiglia: "boost",
    glifo: "🚀",
    nome: ["Boost", "Boost"],
    parole: ["boost", "turbo", "power", "rapido", "quick", "party"],
  },
  {
    famiglia: "sleep",
    glifo: "🌙",
    nome: ["Notte", "Sleep"],
    parole: ["sleep", "notte", "night", "nacht", "dormire"],
  },
  {
    famiglia: "eco",
    glifo: "🌿",
    nome: ["Eco", "Eco"],
    parole: ["eco", "economy", "risparmio", "saving", "energy_saving"],
  },
  {
    famiglia: "comfort",
    glifo: "🛋️",
    nome: ["Comfort", "Comfort"],
    parole: ["comfort", "comfortable", "giorno", "day"],
  },
  {
    famiglia: "frost",
    glifo: "🧊",
    nome: ["Antigelo", "Frost guard"],
    parole: ["frost", "antigelo", "frost_protection", "antifreeze", "protezione"],
  },
  {
    famiglia: "auto",
    glifo: "🗓️",
    nome: ["Programma", "Schedule"],
    parole: ["auto", "schedule", "programma", "programmato", "smart", "automatic"],
  },
  {
    famiglia: "manual",
    glifo: "✋",
    nome: ["Manuale", "Manual"],
    parole: ["manual", "manuale", "override", "temporary", "temporaneo"],
  },
  {
    famiglia: "off",
    glifo: "⏻",
    nome: ["Spento", "Off"],
    parole: ["off", "spento", "none", "no_frost"],
  },
]);

const PER_PAROLA = new Map();
for (const voce of FAMIGLIE) for (const parola of voce.parole) PER_PAROLA.set(parola, voce);

/* Le lettere accentate e i separatori non devono decidere niente: «Fuori casa»,
 * «fuori_casa» e «FUORI-CASA» sono la stessa modalita'. */
function piatto(valore) {
  return pulito(valore)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-.]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** La famiglia di una modalita', o `""` se non la si riconosce. */
export function famigliaDelModo(valore) {
  const chiave = piatto(valore);
  if (!chiave || MUTI.has(chiave)) return "";
  const diretta = PER_PAROLA.get(chiave);
  if (diretta) return diretta.famiglia;
  // Con lo spazio al posto del trattino basso: «not home», «in casa».
  const conSpazi = PER_PAROLA.get(chiave.replaceAll("_", " "));
  return conSpazi ? conSpazi.famiglia : "";
}

const PER_FAMIGLIA = new Map(FAMIGLIE.map((voce) => [voce.famiglia, voce]));

/** Il glifo di quella famiglia; senza famiglia, il termometro generico. */
export function glifoDelModo(famiglia) {
  return PER_FAMIGLIA.get(pulito(famiglia))?.glifo || "🌡️";
}

/* Il nome scritto a mano quando non si riconosce niente.
 *
 * `night_time` diventa «Night time», non resta `night_time`: la card e' fatta
 * per essere letta, e un identificatore in mezzo alle parole si vede. */
function nomeAlNaturale(valore) {
  const grezzo = pulito(valore).replaceAll("_", " ").trim();
  if (!grezzo) return "";
  return grezzo.charAt(0).toUpperCase() + grezzo.slice(1);
}

/** Come si chiama questa modalita', nella lingua della casa. */
export function nomeDelModo(valore, locale = "it") {
  const famiglia = famigliaDelModo(valore);
  const voce = PER_FAMIGLIA.get(famiglia);
  if (voce) return scegli(voce.nome[0], voce.nome[1], locale);
  return nomeAlNaturale(valore);
}

const dominio = (id) => {
  const testo = pulito(id);
  const punto = testo.indexOf(".");
  return punto > 0 ? testo.slice(0, punto).toLowerCase() : "";
};

/* Chi sa cambiare modalita', e con quale chiamata.
 *
 * Tre modi, e sono i tre che esistono davvero:
 *   select / input_select — l'elenco sta in `options`, e ognuno ha il suo
 *     servizio (`select.select_option`, `input_select.select_option`);
 *   climate               — le modalita' sono i preset del termostato;
 *   tutto il resto        — si legge e basta. Un sensore che dice HOME non si
 *     puo' mettere su AWAY, e fingere che si possa vorrebbe dire una pastiglia
 *     che si preme e non fa niente.
 */
function comandoPer(id, attributi) {
  const dom = dominio(id);
  if (dom === "select" || dom === "input_select") {
    const scelte = Array.isArray(attributi?.options) ? attributi.options : [];
    return { servizio: `${dom}.select_option`, campo: "option", scelte };
  }
  if (dom === "climate") {
    const scelte = Array.isArray(attributi?.preset_modes) ? attributi.preset_modes : [];
    return { servizio: "climate.set_preset_mode", campo: "preset_mode", scelte };
  }
  return null;
}

/* Qual e' il valore da leggere.
 *
 * Su un `select` o un sensore la modalita' e' lo STATO. Su un `climate` lo
 * stato e' «heat» — cioe' cosa sta facendo — mentre la modalita' e' il preset:
 * puntare un termostato nella casella della modalita' e vedersi scritto
 * «Heat» sarebbe la risposta a un'altra domanda. */
function valoreDelModo(id, stato) {
  if (dominio(id) === "climate") return pulito(stato?.attributes?.preset_mode);
  return pulito(stato?.state);
}

/**
 * Cosa dice l'entita' della modalita', pronta da disegnare.
 *
 * `stato` e' lo stato di Home Assistant per quell'entita', com'e'. Se non c'e'
 * — o se dice `unknown` — torna `disponibile: false`: la pastiglia non si
 * disegna, invece di scrivere «Unknown» sulla card.
 */
export function letturaDelModo(id, stato, locale = "it") {
  const entita = pulito(id);
  if (!entita) return { disponibile: false };
  const valore = valoreDelModo(entita, stato);
  if (!valore || MUTI.has(piatto(valore))) {
    return { disponibile: false, entita, motivo: stato ? "muto" : "assente" };
  }
  const famiglia = famigliaDelModo(valore);
  const comando = comandoPer(entita, stato?.attributes);
  const scelte = (comando?.scelte || [])
    .map((voce) => pulito(voce))
    .filter(Boolean)
    .map((voce) => ({
      valore: voce,
      nome: nomeDelModo(voce, locale),
      glifo: glifoDelModo(famigliaDelModo(voce)),
      attuale: piatto(voce) === piatto(valore),
    }));
  return {
    disponibile: true,
    entita,
    valore,
    famiglia,
    nome: nomeDelModo(valore, locale),
    glifo: glifoDelModo(famiglia),
    /* Si puo' cambiare solo se c'e' piu' di una scelta: un elenco con dentro
     * quella attuale e basta e' un elenco che non porta da nessuna parte. */
    cambiabile: Boolean(comando) && scelte.length > 1,
    scelte,
    servizio: comando?.servizio || "",
    campo: comando?.campo || "",
  };
}

/**
 * La chiamata che mette quella modalita', o `null` se non si puo'.
 *
 * Torna la chiamata DESCRITTA — servizio e dati — non la esegue: eseguirla e'
 * di chi ha la connessione, e cosi' questa decisione si prova senza casa.
 */
export function chiamataDelModo(lettura, valore) {
  const scelto = pulito(valore);
  if (!lettura?.cambiabile || !scelto || !lettura.servizio) return null;
  const esiste = (lettura.scelte || []).some((voce) => piatto(voce.valore) === piatto(scelto));
  if (!esiste) return null;
  const [dominioServizio, servizio] = lettura.servizio.split(".");
  return {
    dominio: dominioServizio,
    servizio,
    dati: { entity_id: lettura.entita, [lettura.campo]: scelto },
  };
}

/**
 * La modalita' successiva nel giro, per chi tocca la pastiglia senza aprire
 * niente: due modalita' — ed e' il caso di TADO — vogliono un tocco, non un
 * menu con due voci dentro.
 */
export function prossimoModo(lettura) {
  const scelte = lettura?.scelte || [];
  if (!lettura?.cambiabile || scelte.length < 2) return "";
  const dove = scelte.findIndex((voce) => voce.attuale);
  return scelte[(dove + 1) % scelte.length]?.valore || "";
}
