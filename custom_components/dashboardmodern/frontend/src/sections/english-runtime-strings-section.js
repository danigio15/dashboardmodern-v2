/* Le parole italiane rimaste nel guscio inglese.
 *
 * Il runtime vendorizzato della variante EN porta ancora una manciata di
 * stringhe italiane cablate: le etichette della centrale («ARMATO · FUORI»,
 * «DISARMATO»), la tessera a colpo d'occhio («Antifurto», «TOTALE», «IN
 * USCITA»), i toast di salvataggio («Sezione salvata», «Luce aggiunta»...),
 * la pillola d'attesa dell'auto e le etichette del solare nell'editor. La
 * correzione vera sta a monte, nel repo del guscio; finche' non ci arriva,
 * questo modulo se ne fa padrone qui: traduce i toast alla fonte avvolgendo
 * `edToast`, e per il resto ripassa i sottoalberi giusti a ogni evento di
 * ridisegno del guscio, sostituendo SOLO le corrispondenze esatte del
 * dizionario qui sotto.
 *
 * Il dizionario e' volutamente chiuso e letterale: niente regex, niente
 * sottostringhe — un nodo o e' identico a una voce, o non si tocca. L'unico
 * falso positivo possibile e' un'entita' che l'utente abbia battezzato
 * esattamente come una di queste parole («Antifurto») sulla plancia inglese:
 * accettato, e' comunque la parola che il guscio scriverebbe da se'.
 */
export const RUNTIME_EN = Object.freeze({
  DISARMATO: "DISARMED",
  "ARMATO · FUORI": "ARMED · AWAY",
  "ARMATO · NOTTE": "ARMED · NIGHT",
  "ARMATO · CASA": "ARMED · HOME",
  "ARMATO · PARZIALE": "ARMED · PARTIAL",
  "ARMATO · VACANZA": "ARMED · VACATION",
  Antifurto: "Alarm",
  TOTALE: "AWAY",
  NOTTE: "NIGHT",
  CASA: "HOME",
  "IN USCITA": "ARMING",
  "In attesa...": "Waiting...",
  "Sostituzione aggiunta": "Override added",
  "Nodi mappa salvati": "Flow nodes saved",
  "Sezione salvata": "Section saved",
  "Luce aggiunta": "Light added",
  "Piscina salvata": "Pool saved",
  "Impostazioni irrigazione salvate": "Irrigation settings saved",
  "Avviso tapparella aggiunto": "Shutter alert added",
  "Avviso aggiunto": "Alert added",
  "Azione aggiunta": "Action added",
  "Apri l'accordion Rooms per modificare": "Open the Rooms accordion to edit",
  "Produzione solare oggi (kWh)": "Solar production today (kWh)",
  "Produzione solare anno (kWh)": "Solar production year (kWh)",
  "Produzione solare mese (kWh)": "Solar production month (kWh)",
  "Nessuna entità EV mappata da salvare: mappa prima le entità della sezione Auto":
    "No EV entity mapped to save: map the Car section entities first",
});

const MARCHIO = "__dmEnglishRuntimeStrings";

/* Le frasi che portano un numero dietro — «Attivo da 1 min», «✅ Rilevate: 3»
 * — si traducono per prefisso, con le unita' della coda. */
const PREFISSI = [
  ["✅ Rilevate: ", "✅ Detected: "],
  ["Attivo da ", "Active for "],
];
const UNITA = [
  [" ore", " hours"],
  [" ora", " hour"],
  [" giorni", " days"],
  [" giorno", " day"],
];

/** La voce tradotta, o il testo com'era. */
export function traduciTesto(testo) {
  const secco = String(testo ?? "");
  const chiave = secco.trim();
  if (RUNTIME_EN[chiave]) return secco.replace(chiave, RUNTIME_EN[chiave]);
  for (const [it, en] of PREFISSI) {
    if (!chiave.startsWith(it)) continue;
    let coda = chiave.slice(it.length);
    for (const [uIt, uEn] of UNITA) coda = coda.replace(uIt, uEn);
    return secco.replace(chiave, en + coda);
  }
  return secco;
}

/** Percorre i nodi di testo di un sottoalbero e applica il dizionario. */
export function traduciAlbero(radice, doc = globalThis.document) {
  if (!radice) return;
  if (radice.nodeType === 3) {
    const dopo = traduciTesto(radice.data);
    if (dopo !== radice.data) radice.data = dopo;
    return;
  }
  if (radice.nodeType !== 1 && radice.nodeType !== 11) return;
  const giro = doc.createTreeWalker(radice, 4 /* NodeFilter.SHOW_TEXT */);
  for (let nodo = giro.nextNode(); nodo; nodo = giro.nextNode()) {
    const dopo = traduciTesto(nodo.data);
    if (dopo !== nodo.data) nodo.data = dopo;
  }
}

/** Vero solo sul guscio inglese: e' l'unico posto dove c'e' da tradurre. */
export function guscioInglese(doc = globalThis.document) {
  if (!doc) return false;
  return (doc.documentElement?.getAttribute("lang") || "").toLowerCase().startsWith("en");
}

export function installEnglishRuntimeStrings(root = globalThis, doc = globalThis.document) {
  if (!guscioInglese(doc)) return;
  if (root[MARCHIO]) return;
  root[MARCHIO] = true;

  /* I toast si correggono alla fonte: ogni messaggio passa da `edToast`. */
  const avvolgi = () => {
    const originale = root.edToast;
    if (typeof originale === "function" && !originale[MARCHIO]) {
      const tradotto = (messaggio, ...resto) => originale.call(root, traduciTesto(messaggio), ...resto);
      tradotto[MARCHIO] = true;
      root.edToast = tradotto;
    }
  };
  avvolgi();
  /* Il runtime definisce `edToast` al suo passo: se non c'e' ancora, si
   * riprova quando il guscio annuncia di esserci. */
  root.addEventListener?.("dashboardmodern:legacy-ready", avvolgi, { once: false });

  /* Tutto il resto — centrale, tessera a colpo d'occhio, pillola d'attesa,
   * etichette dell'editor — arriva al DOM quando il guscio ridisegna: si
   * ascoltano i suoi eventi e si traducono i sottoalberi giusti, senza
   * osservatori (il grafo di produzione li conta, e il tetto e' gia' pieno). */
  const radici = () => [
    doc.getElementById("alarm-stage"),
    doc.getElementById("page-security"),
    doc.getElementById("glance-alarm") || doc.querySelector("[data-glance-alarm]"),
    doc.getElementById("page-home"),
    doc.getElementById("page-ev"),
    doc.getElementById("ed-body"),
  ];
  const ripassa = () => {
    for (const radice of radici()) traduciAlbero(radice, doc);
  };
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:editor-rendered",
  ])
    root.addEventListener?.(evento, ripassa);
  ripassa();

  /* Il palco dell'allarme il runtime EN lo ridisegna a ogni tick, con le sue
   * parole: gli eventi non bastano, serve un battito — mirato ai due nodi
   * dell'allarme, e muto quando la pagina non si vede. */
  const battito = () => {
    if (doc.visibilityState === "hidden") return;
    traduciAlbero(doc.getElementById("alarm-stage"), doc);
    traduciAlbero(doc.getElementById("glance-alarm") || doc.querySelector("[data-glance-alarm]"), doc);
  };
  root.setInterval?.(battito, 400);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => installEnglishRuntimeStrings(), {
      once: true,
    });
  else installEnglishRuntimeStrings();
}
