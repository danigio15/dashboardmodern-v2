/* «Le icone sono poco leggibili, troppo chiare.»
 *
 * Detto della barra in basso e della colonna della configurazione, ed erano
 * due difetti diversi con lo stesso aspetto.
 *
 * Il primo non era chiarezza: era che meta' dei disegni non c'era. Ogni
 * oggetto si porta dentro le proprie sfumature, e disegni uguali ripetono gli
 * stessi identificatori. In una pagina pero' a un identificatore ripetuto
 * risponde sempre il primo che lo porta, in ordine di documento — e il primo,
 * per meta' di quei disegni, sta dentro una voce di barra che la
 * configurazione tiene a `display:none`. Una sfumatura in un ramo non
 * disegnato non dipinge: il lampadario, il termometro, il fulmine e la goccia
 * restavano l'ombra grigia sotto e nient'altro. Il rimedio e' nel nucleo — un
 * foglio unico di definizioni — e qui c'e' il gesto che lo mette in cima al
 * documento, dove vince per tutti.
 *
 * Il secondo e' proprio un velo, ed e' doppio — due sbiadimenti che si
 * moltiplicano sulle voci a riposo della barra. Quello si ripara dove e'
 * scritto, nel foglio della navigazione, perche' a ogni regola il suo
 * padrone: qui resta il nome nella colonna della configurazione, che era di
 * un grigio troppo tenue per la carta quasi bianca su cui sta.
 */
import { ID_FOGLIO_OGGETTI, foglioDegliOggetti } from "../core/oggetti-widget.js";
import { doc, installStyle, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_ICONE_LEGGIBILI__";
const STYLE_ID = "dm-icone-leggibili-style";
const state = (root[KEY] ||= { installed: false });

/**
 * Mette il foglio delle sfumature per primo nel corpo della pagina.
 *
 * «Per primo» non e' un vezzo: e' l'unica posizione in cui vince, perche' a
 * un identificatore ripetuto risponde il primo che lo porta. E non va
 * nascosto con `display:none`, o si ricadrebbe nel difetto che ripara: e'
 * largo zero e non prende il dito, ma resta disegnato.
 */
export function installaFoglioDegliOggetti() {
  const body = doc?.body;
  if (!body) return false;
  const gia = doc.getElementById(ID_FOGLIO_OGGETTI);
  /* Se c'e' gia' ed e' gia' il primo, non si tocca: rimetterlo a ogni giro
   * vorrebbe dire buttare via e ricreare trenta sfumature per niente. */
  if (gia && gia === body.firstElementChild) return false;
  gia?.remove();
  const guscio = doc.createElement("div");
  guscio.innerHTML = foglioDegliOggetti();
  const foglio = guscio.firstElementChild;
  if (!foglio) return false;
  body.prepend(foglio);
  return true;
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
      /* ── la colonna della configurazione ────────────────────────────────
       *
       * Qui i disegni sono interi (ci pensa il foglio): resta il nome, che era
       * "--text-dim" su carta quasi bianca. Stesso grigio della barra, stesso
       * conto. La voce aperta tiene il suo azzurro. */
      #editor-modal .ed-tab:not(.active){color:#3d4d66!important}
      html[data-theme="dark"] #editor-modal .ed-tab:not(.active),
      #editor-modal[data-dm-editor-theme="dark"] .ed-tab:not(.active){color:#b9c7dc!important}
    `,
  );
}

export function installIconeLeggibiliSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  installaFoglioDegliOggetti();
  /* Il corpo della pagina puo' nascere dopo di noi, e il guscio lo riscrive
   * ai suoi passaggi: il foglio si rimette quando serve, e la guardia qui
   * sopra fa si' che «quando serve» voglia dire quasi mai. */
  for (const evento of [
    "DOMContentLoaded",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ]) {
    root.addEventListener?.(evento, installaFoglioDegliOggetti);
  }
  return true;
}

installIconeLeggibiliSection();
