/* La lingua della plancia, scelta qui (#263).
 *
 * «Poter modificare la lingua dalle impostazioni senza ereditare
 * necessariamente quella di HA. Io ho HA in inglese perche' mi aiuta per lo
 * sviluppo, ma la plancia la vorrei in italiano per renderla fruibile agli
 * altri componenti della famiglia.»
 *
 * Il motore c'era gia' tutto — `setLocale` scrive la scelta e ricarica il
 * catalogo, `detectLocale` legge in ordine la scelta salvata e poi la lingua
 * del documento che Home Assistant inietta — e in `i18n-section.js` c'e'
 * perfino scritto «cosi' la pagina delle impostazioni puo' cambiare lingua
 * senza ricaricare». Mancava la pagina delle impostazioni.
 *
 * La voce «Lingua di Home Assistant» non e' una quattordicesima lingua: e'
 * l'assenza di scelta. Sceglierla cancella la preferenza salvata, e da quel
 * momento la plancia torna a seguire il documento — che e' esattamente il
 * comportamento di chi non ha mai toccato niente.
 */
import {
  LOCALE_STORAGE_KEY,
  detectLocale,
  getLocale,
  hostLocale,
  localeInfo,
  resetLocale,
  setLocale,
  supportedLocales,
} from "../core/i18n.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_LINGUA__";
const state = (root[KEY] ||= { installed: false });

const SCHEDA = "visib";
const AUTO = "auto";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/** La scelta salvata, se c'e': altrimenti si segue Home Assistant. */
export function linguaScelta() {
  try {
    return clean(root.localStorage?.getItem?.(LOCALE_STORAGE_KEY)) || AUTO;
  } catch (_error) {
    return AUTO;
  }
}

/* Le lingue in ordine alfabetico del loro nome, non dell'ordine in cui sono
 * state aggiunte al registro: chi cerca «Polski» lo cerca fra la P. */
export function lingueInElenco() {
  return supportedLocales()
    .map((code) => ({ code, nome: clean(localeInfo(code)?.nativeName) || code }))
    .sort((sinistra, destra) => sinistra.nome.localeCompare(destra.nome));
}

function rigaMarkup() {
  const scelta = linguaScelta();
  /* Il nome accanto a «Lingua di Home Assistant» e' quella di Home Assistant,
   * non quella che si sta guardando: scegliendo il francese, l'etichetta deve
   * continuare a dire a cosa si tornerebbe. */
  const seguita = localeInfo(hostLocale() || detectLocale());
  const opzioni = [
    `<option value="${AUTO}"${scelta === AUTO ? " selected" : ""}>${esc(
      t("Lingua di Home Assistant", "Home Assistant language"),
    )}${seguita ? ` — ${esc(seguita.nativeName)}` : ""}</option>`,
    ...lingueInElenco().map(
      ({ code, nome }) =>
        `<option value="${esc(code)}"${scelta === code ? " selected" : ""}>${esc(nome)}</option>`,
    ),
  ].join("");
  return `<div class="ed-slot dm-lingua" data-dm-lingua>
    <div class="ed-slot-lbl">🌍 ${esc(t("Lingua della plancia", "Dashboard language"))}</div>
    <div class="dm-lingua-nota">${esc(
      t(
        "Lasciandola sulla lingua di Home Assistant la plancia segue il profilo di chi guarda. Sceglierne una la fissa per questa dashboard, anche se Home Assistant parla un'altra lingua.",
        "Left on the Home Assistant language the dashboard follows the profile of whoever is looking. Picking one pins it for this dashboard, even when Home Assistant speaks another language.",
      ),
    )}</div>
    <select class="ed-input" data-dm-lingua-scelta>${opzioni}</select>
  </div>`;
}

export function ensureLingua() {
  const corpo = doc?.getElementById("ed-body");
  if (!corpo || schedaAttiva() !== SCHEDA) return false;
  /* L'ancora e' il tasto del guscio che chiude il blocco «Generali»: la lingua
   * e' una preferenza generale, e sta con le altre invece che in fondo alla
   * scheda dopo il reset totale. Si riconosce dal gestore, non dalla scritta,
   * che cambia con la lingua — proprio quella che questa riga governa. */
  const salva = corpo.querySelector('[onclick*="edSaveGeneral"]');
  if (!salva) return false;
  const gia = corpo.querySelector("[data-dm-lingua]");
  if (gia) {
    /* Ridisegnata la scheda, la scelta puo' essere cambiata da un'altra
     * finestra o da un ripristino: si riscrive solo se dice altro. */
    const scelta = gia.querySelector("[data-dm-lingua-scelta]");
    if (scelta && clean(scelta.value) !== linguaScelta()) scelta.value = linguaScelta();
    return true;
  }
  const guscio = doc.createElement("div");
  guscio.innerHTML = rigaMarkup();
  const riga = guscio.firstElementChild;
  if (!riga) return false;
  salva.after(riga);
  installStile();
  return true;
}

function installStile() {
  installStyle(
    "dm-lingua-style",
    `
      /* La nota ha la voce di una nota: spiega la tendina qui sotto, non
         apre un capitolo. */
      #ed-body .dm-lingua-nota{
        margin:2px 0 8px;font-size:12px;line-height:1.4;
        color:var(--secondary-text-color,#64748b)}
      #ed-body .dm-lingua{margin-bottom:16px}
    `,
  );
}

/* Cambiare lingua non ricarica la pagina: il catalogo arriva e chi disegna si
 * ridisegna da solo sull'evento della lingua. */
async function scegli(codice) {
  if (codice === AUTO) {
    try {
      root.localStorage?.removeItem?.(LOCALE_STORAGE_KEY);
    } catch (_error) {}
    resetLocale();
  }
  /* Si passa dallo switch pubblico, non da `setLocale` diretto.
   *
   * `dashboardModernSetLocale` fa una cosa in piu' che serve proprio qui:
   * rimette in moto la passata sul DOM, quella che traduce il testo che il
   * guscio vendorizzato ha gia' stampato. Chiamando `setLocale` e basta, le
   * nostre parole cambiavano lingua e quelle del guscio — «Ordine navbar»,
   * «Generali» — restavano com'erano, sulla stessa schermata.
   *
   * Tornando all'automatico si applica la lingua dell'OSPITE e non quella che
   * `detectLocale` direbbe: quest'ultima guarda anche `documentElement.lang`,
   * che nel frattempo abbiamo scritto noi con la scelta da cancellare, e ci si
   * ritroverebbe la stessa lingua di prima con la preferenza sparita. */
  const bersaglio = codice === AUTO ? hostLocale() || detectLocale() : codice;
  if (typeof root.dashboardModernSetLocale === "function")
    await root.dashboardModernSetLocale(bersaglio);
  else await setLocale(bersaglio, { persist: codice !== AUTO });
  /* Chi ha scelto l'automatico non deve ritrovarsi la scelta riscritta: lo
   * switch pubblico persiste sempre, quindi la si ricancella dopo. */
  if (codice === AUTO) {
    try {
      root.localStorage?.removeItem?.(LOCALE_STORAGE_KEY);
    } catch (_error) {}
  }
  try {
    root.render?.();
  } catch (_error) {}
  return getLocale();
}

function onChange(evento) {
  const scelta = evento.target?.closest?.("[data-dm-lingua-scelta]");
  if (!scelta) return;
  const codice = clean(scelta.value) || AUTO;
  scegli(codice).then(() => {
    /* La scheda si ridisegna con le parole nuove, e la riga si rimette da
     * sola: qui si aggiorna solo l'etichetta «segue Home Assistant», che porta
     * dentro il nome della lingua seguita. */
    const corpo = doc?.getElementById("ed-body");
    corpo?.querySelector?.("[data-dm-lingua]")?.remove?.();
    ensureLingua();
  });
}

export function installLinguaSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  doc.addEventListener("change", onChange);
  wrapFunction("apriConfigEntita", "__dmLingua", () => ensureLingua());
  onEditorRedraw("__dmLingua", () => {
    root.queueMicrotask?.(() => ensureLingua());
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => ensureLingua());
    });
  ensureLingua();
  return true;
}

installLinguaSection();
