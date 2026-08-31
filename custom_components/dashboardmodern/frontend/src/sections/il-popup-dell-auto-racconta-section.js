/* Il popup dell'Auto dice quando finisce, e parla in parole.
 *
 * Dal campo: «poca analisi, l'ora di fine carica, e stati grezzi — lo stato
 * C del cavo». Il guscio nel popup dell'auto dice il tempo che manca («2H
 * 15M RIM.») ma non l'ora a cui si arriva; e dove il codice IEC del cavo
 * non e' fra quelli previsti (minuscole, parole di evcc) le caselle
 * stampano il codice cosi' com'e' — «C», che non dice niente.
 *
 * Questo modulo lavora sopra il disegno del guscio: accanto al tempo che
 * manca scrive l'ora («· verso le 10:46») e le caselle che mostrano un
 * codice nudo lo ricevono in parole. La frase d'analisi NON sta qui: «l'analisi
 * non va nel popup auto ma nel popup widget» — e nel popup dei widget c'e'
 * gia'. La formula del tempo resta quella del guscio — qui la si legge, non
 * la si rifa' — cosi' i due posti dicono la stessa ora.
 */
import { clean, doc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_POPUP_AUTO_RACCONTA__";
const state = (root[KEY] ||= { installed: false });

/** Lo stato del cavo in parole, qualunque dialetto parli il caricatore:
 * codici IEC 61851 (A..F), parole di evcc, maiuscole o no. */
export function statoUmanoEV(codice) {
  const voce = clean(codice).toLowerCase();
  if (!voce || voce === "—") return "";
  if (["a", "disconnected", "idle", "not_connected", "unplugged"].includes(voce))
    return t("Scollegata", "Unplugged");
  if (["b", "connected", "plugged", "plugged_in", "waiting", "wait_for_car"].includes(voce))
    return t("Collegata, in attesa", "Plugged in, waiting");
  if (voce === "c" || voce === "d" || voce.startsWith("charging"))
    return t("In carica", "Charging");
  if (["e", "f", "error", "fault"].includes(voce)) return t("Errore", "Error");
  return "";
}

/** L'ora a cui si arriva, letta dal testo del guscio («2H 15M RIM.»).
 * La formula resta una sola — la sua — e qui la si mette sull'orologio. */
export function oraDiFineCarica(testo, adesso = Date.now()) {
  const preso = clean(testo).match(/(\d+)\s*H\s+(\d+)\s*M/i);
  if (!preso) return "";
  const fine = new Date(adesso + (Number(preso[1]) * 60 + Number(preso[2])) * 60000);
  return `${fine.getHours()}:${String(fine.getMinutes()).padStart(2, "0")}`;
}

/* L'ora accanto al tempo che manca. Il guscio riscrive quel testo a ogni
 * giro, portandosi via l'aggiunta: la si rimette, solo se manca. */
function aggiungiOra() {
  const nodo = doc?.getElementById?.("v-ev-remain-popup");
  if (!nodo || nodo.querySelector(".dm-ev-verso")) return;
  const ora = oraDiFineCarica(nodo.textContent);
  if (!ora) return;
  const verso = doc.createElement("span");
  verso.className = "dm-ev-verso";
  verso.textContent = ` · ${t(`verso le ${ora}`, `around ${ora}`)}`;
  nodo.append(verso);
}

/* Le caselle che mostrano il codice nudo lo ricevono in parole. */
function umanizzaCaselle() {
  const nodi = [
    ...(doc?.querySelectorAll?.(".v-ev-stato-all") || []),
    doc?.getElementById?.("lm-stato-txt"),
  ].filter(Boolean);
  for (const nodo of nodi) {
    const testo = clean(nodo.textContent);
    if (testo.length > 2) continue; /* gia' in parole (o vuoto: «—» resta) */
    const parole = statoUmanoEV(testo);
    if (parole && nodo.textContent !== parole) nodo.textContent = parole;
  }
}

function rivesti() {
  try {
    aggiungiOra();
    umanizzaCaselle();
  } catch (_errore) {}
}

/* Il guscio riscrive i suoi nodi a ogni giro del disegno, non solo sui
 * nostri eventi: l'osservatore sta SOLO sul testo del tempo rimanente — un
 * nodo, niente document — e riporta l'ora appena il guscio la cancella. */
function osserva() {
  const nodo = doc?.getElementById?.("v-ev-remain-popup");
  if (!nodo || state.osservato) return;
  state.osservato = true;
  new MutationObserver(() => rivesti()).observe(nodo, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

const STILE = `
#v-ev-remain-popup .dm-ev-verso{opacity:.75;font-weight:700}
`;

export function installPopupAutoRacconta() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-popup-auto-racconta-style", STILE);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
  ]) {
    root.addEventListener?.(evento, () => {
      osserva();
      rivesti();
    });
  }
  osserva();
  rivesti();
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installPopupAutoRacconta, { once: true });
} else {
  installPopupAutoRacconta();
}
