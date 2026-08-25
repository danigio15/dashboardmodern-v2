/* Una porta per la configurazione che c'e' sempre.
 *
 * Alla configurazione si arriva dalla voce Config nella barra in fondo, o dal
 * cartello che compare quando la plancia e' ancora vuota. Il cartello sparisce
 * appena si collega la prima entita' — ha finito il suo lavoro — e da quel
 * momento resta solo la barra; che sul computer sta a riposo fuori dallo
 * schermo, e in qualche finestra non si lascia trovare affatto. Chi si e'
 * trovato in quella condizione ha dovuto disinstallare e rimettere
 * l'integrazione per rivedere il cartello: era l'unico modo che aveva.
 *
 * L'ingranaggio in cima non si nasconde e non aspetta niente. E' la stessa
 * configurazione che aprono la voce e il cartello — nessuna seconda strada da
 * tenere allineata, solo un'altra maniglia sulla stessa porta.
 */
import { SOURCE_LOCALE, pick } from "../core/i18n.js";
import { activeLocale, clean, doc, esc, installStyle, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_EDITOR_ENTRY__";
const state = (root[KEY] ||= { installed: false });

export const ENTRY_ID = "dm-editor-entry";

function apriConfigurazione() {
  try {
    if (typeof root.apriConfigEntita === "function") {
      root.apriConfigEntita();
      return true;
    }
  } catch (_error) {}
  /* Se la configurazione non risponde, la voce nella barra e' l'altra porta
   * sulla stessa stanza: meglio portarci che non fare niente. */
  try {
    doc?.querySelector?.('.tab[data-tab="config"]')?.click();
    return true;
  } catch (_error) {}
  return false;
}

/** Mette l'ingranaggio in cima, se non c'e' gia'. */
export function ensureEditorEntry() {
  if (!doc) return false;
  if (doc.getElementById(ENTRY_ID)) return true;
  const header = doc.querySelector("header");
  if (!header) return false;
  const button = doc.createElement("button");
  button.type = "button";
  button.id = ENTRY_ID;
  button.className = "dm-editor-entry";
  const label = t("Configurazione", "Configuration");
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<span aria-hidden="true">⚙️</span>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (root.navigator?.vibrate) root.navigator.vibrate(8);
    apriConfigurazione();
  });
  /* Accanto allo stato della connessione, che e' l'altra cosa che questa
   * intestazione dice sempre. */
  const pill = header.querySelector(".status-pill");
  if (pill) pill.after(button);
  else header.append(button);
  return true;
}

function installStyles() {
  installStyle(
    "dm-editor-entry-style",
    `
      /* L'intestazione distribuisce i suoi figli agli estremi: con
         l'ingranaggio in fondo, lo stato della connessione restava sospeso in
         mezzo al vuoto. Lo spazio libero va tutto alla sua sinistra, cosi'
         pillola e ingranaggio stanno insieme, dalla parte della rotella. */
      html body header .status-pill{margin-left:auto!important}
      html body header .dm-editor-entry{
        display:inline-flex!important;align-items:center!important;justify-content:center!important;
        flex:0 0 auto!important;width:40px!important;height:40px!important;margin-left:10px!important;
        padding:0!important;border:1px solid var(--divider-color,rgba(15,23,42,.12))!important;border-radius:14px!important;
        background:var(--card-bg,#fff)!important;color:var(--text,#0f172a)!important;font-size:18px!important;
        cursor:pointer!important;box-shadow:0 8px 18px -14px rgba(15,23,42,.6)!important
      }
      html body header .dm-editor-entry:hover{border-color:var(--info-color,#0ea5e9)!important}
      html body header .dm-editor-entry:active{transform:scale(.94)!important}
      /* Su schermi stretti l'intestazione e' gia' piena: l'ingranaggio si
         stringe ma non se ne va, perche' e' l'unica porta che non si nasconde. */
      @media(max-width:520px){
        html body header .dm-editor-entry{width:34px!important;height:34px!important;margin-left:6px!important;font-size:16px!important}
      }
      @media(prefers-reduced-motion:reduce){html body header .dm-editor-entry:active{transform:none!important}}
    `,
  );
}

export function installEditorEntrySection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureEditorEntry();
  /* L'intestazione la ridisegnano in parecchi — il marchio, la connessione, il
   * tema — e l'ingranaggio se ne andrebbe con lei. */
  for (const name of ["render", "cdApplyBranding", "cdApplyNavVis"])
    wrapFunction(name, "__dmEditorEntry", () => {
      root.queueMicrotask?.(ensureEditorEntry);
    });
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:states-ready", "pageshow"])
    root.addEventListener?.(event, () => ensureEditorEntry());
  if (doc.readyState === "loading")
    doc.addEventListener("DOMContentLoaded", () => ensureEditorEntry(), { once: true });
}

/* Il nome della porta, per chi la cerca da fuori.
 *
 * Era un booleano "inglese si'/no": chiamata da un utente spagnolo tornava
 * italiano. `true` resta inglese, perche' e' cosi' che la chiamava chi c'era
 * prima, ma senza argomenti risponde nella lingua attiva. */
export const editorEntryLabel = (locale = activeLocale()) =>
  clean(
    esc(
      pick(
        "Configurazione",
        "Configuration",
        locale === true ? "en" : locale === false ? SOURCE_LOCALE : locale,
      ),
    ),
  );
