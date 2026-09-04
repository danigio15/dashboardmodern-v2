/* Cosa sta facendo, in parole.
 *
 * Dal campo: «le card si devono riadattare in base alle informazioni presenti
 * nell'integrazione importata: la lavatrice deve fornire lo stato in corso,
 * esempio lavaggio, con temperatura lavaggio eccetera».
 *
 * Una card che dice IN FUNZIONE e 1180 W dice la verita' e non dice niente:
 * quei watt li fa anche un forno. Un elettrodomestico collegato a
 * un'integrazione sa molto di piu' di se stesso — a che punto e' il
 * programma, quale programma, a che gradi, a quanti giri — e sono le stesse
 * quattro cose che uno guarda sull'oblo'. Questo modulo le tira fuori.
 *
 * Le parole delle fasi sono quelle che le integrazioni pubblicano davvero, e
 * arrivano crude: `washing`, `spin`, `weighting`. Qui diventano Lavaggio,
 * Centrifuga, Pesatura — la tabella e' il vocabolario, e un valore che non
 * conosce lo lascia passare ripulito invece di nasconderlo, perche' «steam
 * ready» detto male e' comunque meglio di niente.
 *
 * Niente DOM: entita' e stati dentro, fatti fuori.
 */
import { pick } from "./i18n.js";

const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
const nudo = (value) => lower(value).replace(/[\s_\-.]+/g, "");

/* Le fasi di un ciclo, come le scrivono hOn, Home Connect, Miele e
 * SmartThings, e come si leggono sull'oblo'. `chiave` e' il valore nudo. */
export const FASI_DEL_CICLO = Object.freeze([
  { chiave: "washing", it: "Lavaggio", en: "Washing", glifo: "🌀" },
  { chiave: "wash", it: "Lavaggio", en: "Washing", glifo: "🌀" },
  { chiave: "mainwash", it: "Lavaggio", en: "Washing", glifo: "🌀" },
  { chiave: "prewash", it: "Prelavaggio", en: "Pre-wash", glifo: "🫧" },
  { chiave: "soak", it: "Ammollo", en: "Soak", glifo: "🫧" },
  { chiave: "rinse", it: "Risciacquo", en: "Rinse", glifo: "💧" },
  { chiave: "rinsing", it: "Risciacquo", en: "Rinse", glifo: "💧" },
  { chiave: "spin", it: "Centrifuga", en: "Spin", glifo: "💫" },
  { chiave: "spinning", it: "Centrifuga", en: "Spin", glifo: "💫" },
  { chiave: "drainspin", it: "Scarico e centrifuga", en: "Drain and spin", glifo: "💫" },
  { chiave: "drying", it: "Asciugatura", en: "Drying", glifo: "☀️" },
  { chiave: "dry", it: "Asciugatura", en: "Drying", glifo: "☀️" },
  { chiave: "tumbling", it: "Antipiega", en: "Tumbling", glifo: "🔄" },
  { chiave: "refresh", it: "Rinfresco", en: "Refresh", glifo: "🌬️" },
  { chiave: "steam", it: "Vapore", en: "Steam", glifo: "♨️" },
  { chiave: "weighting", it: "Pesatura", en: "Weighing", glifo: "⚖️" },
  { chiave: "weightsensing", it: "Pesatura", en: "Weighing", glifo: "⚖️" },
  { chiave: "sensing", it: "Rilevamento", en: "Sensing", glifo: "⚖️" },
  { chiave: "heating", it: "Riscaldamento", en: "Heating", glifo: "🔥" },
  { chiave: "preheating", it: "Preriscaldamento", en: "Preheating", glifo: "🔥" },
  { chiave: "preheat", it: "Preriscaldamento", en: "Preheating", glifo: "🔥" },
  { chiave: "cooking", it: "Cottura", en: "Cooking", glifo: "🔥" },
  { chiave: "baking", it: "Cottura", en: "Cooking", glifo: "🔥" },
  { chiave: "cooling", it: "Raffreddamento", en: "Cooling", glifo: "❄️" },
  { chiave: "defrosting", it: "Scongelamento", en: "Defrosting", glifo: "❄️" },
  { chiave: "cleaning", it: "Pulizia", en: "Cleaning", glifo: "🧽" },
  { chiave: "autoclean", it: "Autopulizia", en: "Self-clean", glifo: "🧽" },
  /* Lo stato macchina, per chi non ha un sensore di fase a parte. */
  { chiave: "running", it: "In funzione", en: "Running", glifo: "🌀" },
  { chiave: "run", it: "In funzione", en: "Running", glifo: "🌀" },
  { chiave: "inuse", it: "In funzione", en: "Running", glifo: "🌀" },
  { chiave: "ending", it: "Sta finendo", en: "Ending", glifo: "🏁" },
  { chiave: "aborting", it: "Annullamento", en: "Aborting", glifo: "✋" },
  { chiave: "pause", it: "In pausa", en: "Paused", glifo: "⏸️" },
  { chiave: "paused", it: "In pausa", en: "Paused", glifo: "⏸️" },
  { chiave: "rinsehold", it: "Fermo in acqua", en: "Rinse hold", glifo: "⏸️" },
  { chiave: "scheduled", it: "Programmata", en: "Scheduled", glifo: "⏰" },
  { chiave: "programmed", it: "Programmata", en: "Scheduled", glifo: "⏰" },
  { chiave: "delayedstart", it: "Avvio ritardato", en: "Delayed start", glifo: "⏰" },
  { chiave: "waitingtostart", it: "In attesa di partire", en: "Waiting to start", glifo: "⏰" },
  { chiave: "dooropen", it: "Oblò aperto", en: "Door open", glifo: "🚪" },
  { chiave: "error", it: "Errore", en: "Error", glifo: "⚠️" },
  { chiave: "ready", it: "Pronta", en: "Ready", glifo: "✓" },
  { chiave: "readytostart", it: "Pronta", en: "Ready", glifo: "✓" },
  { chiave: "end", it: "Finita", en: "Finished", glifo: "✓" },
  { chiave: "ended", it: "Finita", en: "Finished", glifo: "✓" },
  { chiave: "finished", it: "Finita", en: "Finished", glifo: "✓" },
  { chiave: "programended", it: "Finita", en: "Finished", glifo: "✓" },
  { chiave: "off", it: "Spenta", en: "Switched off", glifo: "○" },
  { chiave: "standby", it: "Ferma", en: "Idle", glifo: "○" },
  { chiave: "idle", it: "Ferma", en: "Idle", glifo: "○" },
]);

const PER_CHIAVE = new Map(FASI_DEL_CICLO.map((riga) => [riga.chiave, riga]));

/* I valori che non dicono niente: non vale la pena disegnarli. */
const MUTI = new Set([
  "",
  "unknown",
  "unavailable",
  "none",
  "null",
  "noprogram",
  "nostate",
  "notconnected",
  "nosteam",
  "nan",
]);

const muto = (value) => MUTI.has(nudo(value));

/* Un valore crudo reso leggibile: via i prefissi che le integrazioni
 * appiccicano ai programmi, gli underscore diventano spazi, la prima lettera
 * si alza. «All in One 59'», che e' gia' scritto da persone, resta com'e'. */
export function inParole(value) {
  const grezzo = clean(value);
  if (!grezzo) return "";
  if (/[A-Z ]/.test(grezzo) && !grezzo.includes("_")) return grezzo;
  const senzaPrefisso = grezzo.replace(/^(iot_wash_|iot_|wash_|program_)/i, "");
  const parole = senzaPrefisso.replaceAll(/[_\-.]+/g, " ").trim();
  return parole ? parole.charAt(0).toUpperCase() + parole.slice(1) : grezzo;
}

/** Una parola di stato in parole, o niente se non dice nulla. */
export function faseInParole(value, locale = "it") {
  if (muto(value)) return null;
  const riga = PER_CHIAVE.get(nudo(value));
  if (riga)
    return { chiave: riga.chiave, label: pick(riga.it, riga.en, locale), glifo: riga.glifo };
  /* Sconosciuta: si dice com'e', ripulita. Meglio «Steam ready» che niente. */
  return { chiave: nudo(value), label: inParole(value), glifo: "•" };
}

/* Le entita' su cui cercare: quelle del dispositivo collegato piu' le caselle
 * che chi configura ha scritto a mano. */
function entitaDiCasa(device = {}) {
  const viste = new Set();
  const elenco = [];
  const aggiungi = (voce) => {
    const id = clean(typeof voce === "string" ? voce : voce?.entity || voce?.entity_id);
    if (!id || !id.includes(".") || viste.has(id)) return;
    viste.add(id);
    elenco.push(id);
  };
  for (const voce of device?.device_entities || []) aggiungi(voce);
  for (const voce of device?.entities || []) aggiungi(voce);
  aggiungi(device?.state_entity);
  return elenco;
}

function indizi(id, states) {
  const coda = lower(id).split(".").slice(1).join(" ");
  const nome = lower(states?.[id]?.attributes?.friendly_name);
  return ` ${`${coda} ${nome}`.replaceAll(/[_\-.]+/g, " ")} `;
}

const numero = (states, id) => {
  const grezzo = clean(states?.[id]?.state).replace(",", ".");
  const valore = Number.parseFloat(grezzo);
  return Number.isFinite(valore) && /^-?\d+(\.\d+)?$/.test(grezzo) ? valore : null;
};

/* Chi cerca cosa. `serve` guarda gli indizi, e i sensori vengono prima dei
 * menu: un sensore dice cosa sta succedendo, un menu dice cosa e' stato
 * scelto, e a ciclo avviato sono la stessa cosa — ma se il sensore tace, il
 * menu risponde lo stesso. E' il caso vero di hOn, dove
 * `sensor.lavatrice_programma` dice «No Program» mentre
 * `select.lavatrice_programma` sa che gira «All in One 59'». */
const CERCATORI = Object.freeze({
  fase: {
    serve: (clues) => /\b(fase|phase)\b/.test(clues),
    escludi: (clues) => /\b(rimanente|remaining|durata|duration)\b/.test(clues),
  },
  programma: {
    serve: (clues) => /\b(programma|program|programme|ciclo|cycle|modalita|mode)\b/.test(clues),
    escludi: (clues) =>
      /\b(fase|phase|rimanente|remaining|durata|duration|progress|avanzamento|energia|energy|tempo|time)\b/.test(
        clues,
      ),
  },
  temperatura: {
    serve: (clues) => /\b(temperatura|temperature|temp)\b/.test(clues),
    escludi: (clues) => /\b(ambiente|ambient|esterna|external|target|obiettivo)\b/.test(clues),
    numerico: true,
  },
  centrifuga: {
    serve: (clues) => /\b(centrifuga|spin|giri|rpm)\b/.test(clues),
    escludi: (clues) => /\b(livello|level)\b/.test(clues),
    numerico: true,
  },
});

function cerca(chiave, ids, states, considerate = null) {
  const cercatore = CERCATORI[chiave];
  const buoni = ids.filter((id) => {
    const clues = indizi(id, states);
    return cercatore.serve(clues) && !cercatore.escludi?.(clues);
  });
  /* Solo i sensori: un menu e' un comando, e un comando non si nasconde
   * perche' il suo valore e' scritto anche in cima. */
  if (considerate) for (const id of buoni) if (id.startsWith("sensor.")) considerate.push(id);
  const ordinati = [
    ...buoni.filter((id) => id.startsWith("sensor.")),
    ...buoni.filter((id) => !id.startsWith("sensor.")),
  ];
  for (const id of ordinati) {
    if (cercatore.numerico) {
      const valore = numero(states, id);
      if (valore != null)
        return {
          entity: id,
          valore,
          unita: clean(states?.[id]?.attributes?.unit_of_measurement),
        };
      continue;
    }
    const grezzo = clean(states?.[id]?.state);
    if (!muto(grezzo)) return { entity: id, valore: grezzo, unita: "" };
  }
  return null;
}

/**
 * Cosa sta facendo l'apparecchio, dalle entita' che l'integrazione espone.
 *
 * `phase` e' la risposta alla domanda «e adesso?»; `chips` sono i numeri che
 * uno legge sull'oblo': gradi, giri, programma. A macchina spenta la fase non
 * si disegna — una lavatrice ferma non sta lavando — ma i numeri restano,
 * perche' dicono cosa partira'.
 */
export function programFacts(device = {}, states = {}, { locale = "it", mode = "" } = {}) {
  const ids = entitaDiCasa(device);
  if (!ids.length) return { phase: null, chips: [] };

  /* I sensori che la striscia guarda, vinti o no: quello che finisce in cima
   * non va ripetuto sotto, e nemmeno il suo doppione muto — hOn pubblica sia
   * `sensor.lavatrice_programma`, che dice «No Program», sia
   * `select.lavatrice_programma`, che sa che gira «All in One 59'». I menu
   * invece restano: sono i comandi con cui il programma si cambia. */
  const considerate = [];
  const guarda = (chiave) => {
    const trovato = cerca(chiave, ids, states, considerate);
    return trovato;
  };

  const fase = guarda("fase");
  const stato = clean(states?.[clean(device?.state_entity)]?.state);
  const parola = fase ? faseInParole(fase.valore, locale) : null;
  /* Senza un sensore di fase parla lo stato macchina, che e' la stessa
   * domanda con meno dettaglio. */
  const grezza = parola || faseInParole(stato, locale);
  const phase = grezza ? { ...grezza, entity: fase?.entity || clean(device?.state_entity) } : null;

  const chips = [];
  const gradi = guarda("temperatura");
  if (gradi) {
    const unita = gradi.unita || "°C";
    chips.push({
      key: "temperatura",
      entity: gradi.entity,
      glifo: "🌡️",
      /* Zero gradi su una lavatrice non e' un termometro rotto: e' il
       * lavaggio a freddo, e cosi' c'e' scritto sulla manopola. */
      label: gradi.valore === 0 ? pick("Freddo", "Cold", locale) : `${gradi.valore} ${unita}`,
    });
  }
  const giri = guarda("centrifuga");
  if (giri && giri.valore > 0)
    chips.push({
      key: "centrifuga",
      entity: giri.entity,
      glifo: "💫",
      label: `${giri.valore} ${giri.unita || "rpm"}`,
    });
  const programma = guarda("programma");
  if (programma)
    chips.push({
      key: "programma",
      entity: programma.entity,
      glifo: "📋",
      label: inParole(programma.valore),
    });

  return {
    phase: mode === "running" || mode === "standby" ? phase : null,
    chips,
    considerate,
  };
}
