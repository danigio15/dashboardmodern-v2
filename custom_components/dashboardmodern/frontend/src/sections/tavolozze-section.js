/* Le tavolozze in piu' (#436).
 *
 * «Quando e' possibile avere qualche tema in piu', grazie.»
 *
 * I temi erano due — chiaro e scuro — piu' «auto», che segue il dispositivo.
 * Non era pigrizia: finche' meta' delle regole non passava dai token (la
 * famiglia di difetti della #425) un tema nuovo sarebbe stato un tema nuovo
 * per meta' schermo, e l'altra meta' sarebbe rimasta vestita da ieri. Adesso i
 * colori passano tutti di li', e una tavolozza e' un elenco di valori.
 *
 * ── La famiglia resta, la tavolozza si aggiunge ─────────────────────────────
 *
 * Il guscio scrive `data-theme="dark"` o `"light"`, e su quel marcatore
 * poggiano centinaia di regole del foglio storico. Una tavolozza che si
 * scrivesse li' dentro le perderebbe tutte in un colpo. Percio' la famiglia
 * resta quella — chiaro o scuro, e comanda tutto quello che comandava — e la
 * tavolozza si scrive accanto, in `data-dm-tavolozza`: stesso peso, ma dopo,
 * quindi riscrive i token senza dover gridare con «important».
 *
 * ── Chi scrive cosa ─────────────────────────────────────────────────────────
 *
 * I tre tasti storici restano quelli del guscio e chiamano `setTheme`. Toccarli
 * vuol dire «nessuna tavolozza», e infatti la spengono. I tasti nuovi non
 * passano da li': scrivono la tavolozza e la sua famiglia, e poi chiedono al
 * guscio di rivestire il documento. Cosi' c'e' un padrone solo per il vestito,
 * ed e' sempre `applyTheme`.
 *
 * La scelta sta su questo dispositivo e non viaggia, come il tema e la barra:
 * il tablet in cucina puo' stare sul chiaro mentre il telefono sta sul notte.
 */
import { TAVOLOZZE, foglioDelleTavolozze, tavolozzaDi } from "../core/tavolozze.js";
import { clean, doc, esc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TAVOLOZZE_SECTION__";
const MARKER = "__dmTavolozze";
const CHIAVE = "cd_tavolozza";
const state = (root[KEY] ||= { installed: false });

/* Le parole non stanno nel nucleo, che non sa che lingua si parla. */
const NOMI = Object.freeze({
  notte: ["Notte blu", "Blue night"],
  grafite: ["Grafite", "Graphite"],
  bosco: ["Bosco", "Forest"],
  sabbia: ["Sabbia", "Sand"],
  menta: ["Menta", "Mint"],
  ardesia: ["Ardesia", "Slate"],
});

const nomeDi = (chiave) => {
  const voce = NOMI[chiave];
  return voce ? t(voce[0], voce[1]) : chiave;
};

/** La tavolozza scelta su questo dispositivo, o `""` se nessuna. */
export function tavolozzaScelta() {
  try {
    return clean(root.localStorage?.getItem(CHIAVE));
  } catch (_error) {
    return "";
  }
}

/**
 * Sceglie una tavolozza, o la toglie con `""`.
 *
 * Scrive anche la famiglia, perche' una tavolozza scura su una casa chiara
 * sarebbe un fondo notturno con dentro tutte le regole del giorno. Poi lascia
 * vestire il guscio: il padrone del vestito resta uno.
 */
export function impostaTavolozza(chiave) {
  const voce = tavolozzaDi(chiave);
  try {
    if (voce) {
      root.localStorage?.setItem(CHIAVE, voce.chiave);
      root.localStorage?.setItem("cd_theme", voce.famiglia === "scuro" ? "dark" : "light");
    } else {
      root.localStorage?.removeItem(CHIAVE);
    }
  } catch (_error) {
    /* Un vetro che non lascia scrivere non e' una ragione per non vestirsi. */
  }
  root.navigator?.vibrate?.(8);
  root.applyTheme?.();
  return Boolean(voce);
}

/* Il vestito, dopo che il guscio ha messo il suo.
 *
 * Una tavolozza che non esiste piu' — un salvataggio vecchio, un nome scritto
 * a mano — non lascia il documento con un attributo che nessuno definisce: si
 * toglie, e resta la famiglia. */
function vestiIlDocumento() {
  const radice = doc?.documentElement;
  if (!radice) return false;
  const voce = tavolozzaDi(tavolozzaScelta());
  if (voce) {
    radice.setAttribute("data-dm-tavolozza", voce.chiave);
    radice.setAttribute("data-theme", voce.famiglia === "scuro" ? "dark" : "light");
  } else {
    radice.removeAttribute("data-dm-tavolozza");
  }
  segnaIlTastoAcceso(voce?.chiave || "");
  return true;
}

/* Quale tasto e' acceso. I tre storici li accende il guscio, e quando c'e' una
 * tavolozza vanno spenti tutti: la famiglia c'e' ancora, ma non e' lei che si
 * e' scelta. */
function segnaIlTastoAcceso(chiave) {
  doc?.querySelectorAll?.("[data-dm-tavolozza-opt]").forEach((tasto) => {
    tasto.classList.toggle("active", tasto.dataset.dmTavolozzaOpt === chiave);
  });
  if (!chiave) return;
  doc?.querySelectorAll?.(".theme-opt[data-theme]").forEach((tasto) => {
    tasto.classList.remove("active");
  });
}

/* I tasti, sotto i tre del guscio. Si mettono una volta sola: il riquadro del
 * tema sta nel documento dall'inizio e non viene ridisegnato. */
function vestiIlSelettore() {
  const seg = doc?.getElementById?.("theme-seg");
  if (!seg || seg.parentElement?.querySelector?.("[data-dm-tavolozza-opt]")) return false;
  const riga = doc.createElement("div");
  riga.className = "theme-seg dm-tavolozza-seg";
  riga.dataset.dmTavolozze = "true";
  riga.innerHTML = TAVOLOZZE.map(
    (voce) =>
      `<button type="button" class="theme-opt" data-dm-tavolozza-opt="${esc(voce.chiave)}" data-dm-famiglia="${esc(voce.famiglia)}"><span class="theme-opt-ico">${esc(voce.glifo)}</span><span>${esc(nomeDi(voce.chiave))}</span></button>`,
  ).join("");
  seg.after(riga);
  segnaIlTastoAcceso(tavolozzaScelta());
  return true;
}

function installStyles() {
  installStyle(
    "dm-tavolozze-style",
    `${foglioDelleTavolozze()}
    /* La seconda riga sta sotto la prima e si comporta uguale: stesse
       pastiglie, stesso spazio. Va a capo da sola, che su un telefono sono sei
       voci e in una riga sola non ci starebbero mai. */
    .dm-tavolozza-seg{margin-top:8px;flex-wrap:wrap}
    .dm-tavolozza-seg .theme-opt{flex:1 1 30%}
    /* La pastiglia porta addosso il colore che promette: un quadratino del
       fondo di quella tavolozza, cosi' si sceglie guardando invece di
       provando. */
    .dm-tavolozza-seg .theme-opt-ico{
      display:inline-grid;place-items:center;width:18px;height:18px;border-radius:6px;
      box-shadow:inset 0 0 0 1px rgba(148,163,184,.35)}
    ${TAVOLOZZE.map(
      (voce) =>
        `.dm-tavolozza-seg [data-dm-tavolozza-opt="${voce.chiave}"] .theme-opt-ico{background:${voce.token["--bg-sculpted"]}}`,
    ).join("\n    ")}`,
  );
  return true;
}

export function installTavolozzeSection() {
  if (state.installed) return false;
  state.installed = true;
  installStyles();

  /* Il guscio veste, noi rivestiamo. `wrapFunction` si rifiuta di avvolgere
   * due volte, quindi il contrassegno basta a non impilare. */
  const avvolto = root.applyTheme;
  if (typeof avvolto === "function" && !avvolto[MARKER]) {
    function vestito(...argomenti) {
      const risposta = avvolto.apply(this, argomenti);
      vestiIlDocumento();
      return risposta;
    }
    Object.assign(vestito, avvolto);
    vestito[MARKER] = true;
    root.applyTheme = vestito;
  }

  /* I tre tasti storici spengono la tavolozza: sceglierli vuol dire «voglio
   * quello di serie», e lasciargliela addosso sarebbe non rispondere al dito. */
  const scelto = root.setTheme;
  if (typeof scelto === "function" && !scelto[MARKER]) {
    function sceltaStorica(...argomenti) {
      try {
        root.localStorage?.removeItem(CHIAVE);
      } catch (_error) {
        /* niente da fare */
      }
      return scelto.apply(this, argomenti);
    }
    Object.assign(sceltaStorica, scelto);
    sceltaStorica[MARKER] = true;
    root.setTheme = sceltaStorica;
  }

  doc?.addEventListener?.("click", (evento) => {
    const tasto = evento.target?.closest?.("[data-dm-tavolozza-opt]");
    if (!tasto) return;
    evento.preventDefault();
    impostaTavolozza(tasto.dataset.dmTavolozzaOpt);
  });

  vestiIlSelettore();
  vestiIlDocumento();
  /* Il riquadro del tema puo' nascere dopo di noi — la pagina Config si apre
   * quando la si apre — e allora i tasti si rimettono quando compare. */
  for (const evento of ["dashboardmodern:editor-rendered", "dashboardmodern:page-changed"])
    root.addEventListener?.(evento, () => vestiIlSelettore());
  return true;
}
