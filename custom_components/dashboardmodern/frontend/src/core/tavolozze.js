/* Le tavolozze della plancia (#436).
 *
 * «Quando è possibile avere qualche tema in più, grazie.»
 *
 * Fino a ieri i temi erano due — chiaro e scuro — piu' «auto», che segue il
 * dispositivo. Non era pigrizia: fino alla correzione dei colori (#425) meta'
 * delle regole non passava dai token, quindi un tema nuovo sarebbe stato un
 * tema nuovo per meta' dello schermo. Adesso i colori passano tutti di qui, e
 * una tavolozza e' esattamente quello che deve essere: un elenco di valori.
 *
 * ── Famiglia e tavolozza sono due cose diverse ──────────────────────────────
 *
 * Il guscio scrive `data-theme="dark"` o `"light"` sul documento, e su quel
 * marcatore poggiano centinaia di regole del foglio storico. Una tavolozza
 * nuova che si scrivesse li' dentro — `data-theme="notte"` — le perderebbe
 * tutte in un colpo, e mezzo schermo resterebbe vestito da giorno.
 *
 * Percio' una tavolozza NON sostituisce la famiglia: la accompagna. La
 * famiglia resta chiaro o scuro e continua a comandare tutto quello che c'era
 * prima; la tavolozza si scrive accanto, in `data-dm-tavolozza`, e riscrive
 * solo i token. Chi sceglie «Notte blu» sceglie una casa scura con un altro
 * blu, non un terzo mondo dove le regole dello scuro non valgono piu'.
 *
 * ── Perche' i valori stanno qui e le parole no ──────────────────────────────
 *
 * Questo modulo e' puro e non sa che lingua si parla: porta le chiavi, la
 * famiglia, il glifo e i token. Il nome che ogni tavolozza mostra a schermo lo
 * mette la sezione, come fa gia' la pagina Stanze coi suoi blocchi.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* I token che una tavolozza DEVE riempire, tutti.
 *
 * Non e' pignoleria: una tavolozza che ne dimentica uno lo eredita dalla
 * famiglia, e il caso brutto e' proprio quello — un fondo nuovo con sopra il
 * testo del fondo vecchio. Il guardiano in `tests/` non lascia passare una
 * tavolozza incompleta, e per la stessa ragione ne misura il contrasto. */
export const TOKEN_DI_UNA_TAVOLOZZA = Object.freeze([
  "--bg-sculpted",
  "--bg-1",
  "--card-bg",
  "--card-glass",
  "--card-border",
  "--surface-2",
  "--surface-3",
  "--text",
  "--text-dim",
  "--accent",
  "--accent-rgb",
]);

const ombreChiare = Object.freeze({
  "--shadow-sculpted": "0 4px 20px rgba(15,23,42,.08),0 1px 4px rgba(15,23,42,.05)",
  "--shadow-hover": "0 12px 35px rgba(15,23,42,.14),0 2px 8px rgba(15,23,42,.08)",
  "--shadow-glass": "0 8px 30px rgba(15,23,42,.08)",
  "--shadow-glass-strong": "0 12px 34px rgba(15,23,42,.16)",
});

const ombreScure = Object.freeze({
  "--shadow-sculpted": "0 4px 20px rgba(0,0,0,.45),0 1px 4px rgba(0,0,0,.35)",
  "--shadow-hover": "0 12px 35px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4)",
  "--shadow-glass": "0 8px 30px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.06)",
  "--shadow-glass-strong": "0 14px 40px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.07)",
});

/* Le tavolozze in piu'. Chiaro e scuro non stanno qui: sono la famiglia, e
 * sceglierli vuol dire «nessuna tavolozza». */
export const TAVOLOZZE = Object.freeze([
  Object.freeze({
    chiave: "notte",
    famiglia: "scuro",
    glifo: "🌌",
    token: Object.freeze({
      ...ombreScure,
      "--bg-sculpted": "#070d1c",
      "--bg-1": "#0b142b",
      "--card-bg": "#111d3b",
      "--card-glass": "rgba(17,29,59,.88)",
      "--card-border": "#1f3260",
      "--surface-2": "#152b52",
      "--surface-3": "#1b2f5c",
      "--text": "#e8eefc",
      "--text-dim": "#93a6cf",
      "--accent": "#60a5fa",
      "--accent-rgb": "96,165,250",
    }),
  }),
  Object.freeze({
    chiave: "grafite",
    famiglia: "scuro",
    glifo: "🪨",
    token: Object.freeze({
      ...ombreScure,
      "--bg-sculpted": "#0e0e10",
      "--bg-1": "#151517",
      "--card-bg": "#1c1c1f",
      "--card-glass": "rgba(28,28,31,.88)",
      "--card-border": "#2e2e33",
      "--surface-2": "#232326",
      "--surface-3": "#2a2a2e",
      "--text": "#ededef",
      "--text-dim": "#a1a1a8",
      "--accent": "#f59e0b",
      "--accent-rgb": "245,158,11",
    }),
  }),
  Object.freeze({
    chiave: "bosco",
    famiglia: "scuro",
    glifo: "🌲",
    token: Object.freeze({
      ...ombreScure,
      "--bg-sculpted": "#071410",
      "--bg-1": "#0b1e18",
      "--card-bg": "#102a22",
      "--card-glass": "rgba(16,42,34,.88)",
      "--card-border": "#1d4438",
      "--surface-2": "#143429",
      "--surface-3": "#1a4034",
      "--text": "#e6f4ec",
      "--text-dim": "#93bfa9",
      "--accent": "#34d399",
      "--accent-rgb": "52,211,153",
    }),
  }),
  Object.freeze({
    chiave: "sabbia",
    famiglia: "chiaro",
    glifo: "🏜️",
    token: Object.freeze({
      ...ombreChiare,
      "--bg-sculpted": "#f5efe4",
      "--bg-1": "#fffdf8",
      "--card-bg": "#fffdf8",
      "--card-glass": "rgba(255,253,248,.85)",
      "--card-border": "#e7dcc8",
      "--surface-2": "#faf5ea",
      "--surface-3": "#f2e9d8",
      "--text": "#3b2f1d",
      "--text-dim": "#7a6a52",
      "--accent": "#b45309",
      "--accent-rgb": "180,83,9",
    }),
  }),
  Object.freeze({
    chiave: "menta",
    famiglia: "chiaro",
    glifo: "🌿",
    token: Object.freeze({
      ...ombreChiare,
      "--bg-sculpted": "#eaf4f0",
      "--bg-1": "#fbfffd",
      "--card-bg": "#fbfffd",
      "--card-glass": "rgba(251,255,253,.85)",
      "--card-border": "#d3e6de",
      "--surface-2": "#f2faf6",
      "--surface-3": "#e6f2ec",
      "--text": "#12332a",
      "--text-dim": "#5b7a70",
      "--accent": "#0f766e",
      "--accent-rgb": "15,118,110",
    }),
  }),
  Object.freeze({
    chiave: "ardesia",
    famiglia: "chiaro",
    glifo: "🩶",
    token: Object.freeze({
      ...ombreChiare,
      "--bg-sculpted": "#e9edf2",
      "--bg-1": "#fbfcfe",
      "--card-bg": "#fbfcfe",
      "--card-glass": "rgba(251,252,254,.85)",
      "--card-border": "#d6dde6",
      "--surface-2": "#f2f5f9",
      "--surface-3": "#e6ebf2",
      "--text": "#1d2733",
      "--text-dim": "#61707f",
      "--accent": "#475569",
      "--accent-rgb": "71,85,105",
    }),
  }),
]);

/** La tavolozza con quella chiave, o `null` se non ne esiste una. */
export function tavolozzaDi(chiave) {
  const voluta = pulito(chiave);
  return TAVOLOZZE.find((voce) => voce.chiave === voluta) || null;
}

/**
 * La famiglia con cui vestire il documento.
 *
 * Una tavolozza porta la sua; senza tavolozza comanda la preferenza del
 * guscio, e «auto» la decide il dispositivo — che qui arriva gia' risolto,
 * perche' questo modulo non guarda niente.
 */
export function famigliaDaVestire(chiave, famigliaDiSistema = "chiaro") {
  const voce = tavolozzaDi(chiave);
  if (voce) return voce.famiglia;
  return famigliaDiSistema === "scuro" ? "scuro" : "chiaro";
}

/* Il foglio di stile delle tavolozze, scritto una volta.
 *
 * Ogni blocco pesa quanto quello della famiglia — un attributo su `html` — e
 * viene DOPO, quindi vince a parita' di peso. E' l'unico motivo per cui una
 * tavolozza puo' riscrivere il testo dello scuro senza dover gridare con
 * `!important`. */
export function foglioDelleTavolozze(tavolozze = TAVOLOZZE) {
  return tavolozze
    .map((voce) => {
      const righe = Object.entries(voce.token)
        .map(([nome, valore]) => `${nome}:${valore}`)
        .join(";");
      const schema = voce.famiglia === "scuro" ? "dark" : "light";
      return `html[data-dm-tavolozza="${voce.chiave}"]{${righe};color-scheme:${schema}}`;
    })
    .join("\n");
}
