/* Il popup dell'Auto dice quando finisce, e parla in parole.
 *
 * Dal campo: «poca analisi, l'ora di fine carica, e stati grezzi — lo stato
 * C del cavo». Il guscio nel popup dell'auto dice il tempo che manca («2H
 * 15M RIM.») ma non l'ora a cui si arriva; e dove il codice IEC del cavo
 * non e' fra quelli previsti (minuscole, parole di evcc) le caselle
 * stampano il codice cosi' com'e' — «C», che non dice niente.
 *
 * Questo modulo lavora sopra il disegno del guscio: accanto al tempo che
 * manca scrive l'ora («· verso le 10:46»), sotto il nome dell'auto mette la
 * frase d'analisi come nei popup dei widget, e le caselle che mostrano un
 * codice nudo lo ricevono in parole. La formula del tempo resta quella del
 * guscio — qui la si legge, non la si rifa' — cosi' i due posti dicono la
 * stessa ora.
 */
import { allStates, clean, doc, installStyle, readJson, root, section, t } from "./shared.js";

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

/* Il riferimento si scioglie come lo scioglie la plancia: prima le chiavi
 * globali (l'auto «in uso»), e se li' non c'e' niente si guarda nella
 * mappatura dei profili — e' la stessa che «Usa» copia nelle globali. */
function sciogli(riferimento) {
  const globale = clean(root.resolveEntity?.(riferimento) || riferimento);
  if (globale && !globale.startsWith("dm.")) return globale;
  const vetture = section("ev", readJson("cd_ev_cars", []));
  for (const auto of Array.isArray(vetture) ? vetture : []) {
    const mappa = auto?.ov || auto?.overrides || {};
    const entity = clean(mappa[riferimento]);
    if (entity) return entity;
  }
  return globale;
}

function lettura(riferimento) {
  const grezzo = clean(allStates()?.[sciogli(riferimento)]?.state);
  return ["unknown", "unavailable", "none"].includes(grezzo.toLowerCase()) ? "" : grezzo;
}

function inCarica() {
  const codice = clean(lettura("dm.ev_stato_ricarica")).toLowerCase();
  return codice === "c" || codice === "d" || codice.startsWith("charging");
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

/* La frase d'analisi sotto il nome, come nei popup dei widget. */
function frase() {
  const testa = doc?.querySelector?.("#ev-popup .ev-popup-header-info");
  if (!testa) return;
  let nodo = testa.querySelector("[data-dm-ev-frase]");
  if (!nodo) {
    nodo = doc.createElement("p");
    nodo.className = "dm-ev-frase";
    nodo.dataset.dmEvFrase = "";
    testa.append(nodo);
  }
  const soc = Number.parseFloat(lettura("dm.ev_batteria_auto"));
  const socTxt = Number.isFinite(soc) ? Math.round(soc) : null;
  let parole = "";
  if (inCarica()) {
    const grezza = Number.parseFloat(lettura("dm.ev_potenza_wallbox"));
    const kw = Number.isFinite(grezza) ? (grezza > 100 ? grezza / 1000 : grezza) : null;
    const kwTxt = kw ? t(` a ${kw.toFixed(1)} kW`, ` at ${kw.toFixed(1)} kW`) : "";
    const target = Number.parseInt(lettura("dm.ev_target_soc"), 10) || 100;
    const ora = oraDiFineCarica(doc.getElementById("v-ev-remain-popup")?.textContent);
    parole =
      socTxt == null
        ? t(`In carica${kwTxt}.`, `Charging${kwTxt}.`)
        : ora
          ? t(
              `In carica al ${socTxt}%${kwTxt}: di questo passo il ${target}% arriva verso le ${ora}.`,
              `Charging at ${socTxt}%${kwTxt}: at this pace ${target}% lands around ${ora}.`,
            )
          : t(`In carica al ${socTxt}%${kwTxt}.`, `Charging at ${socTxt}%${kwTxt}.`);
  } else if (
    statoUmanoEV(lettura("dm.ev_stato_ricarica")) ===
    t("Collegata, in attesa", "Plugged in, waiting")
  ) {
    parole =
      socTxt == null
        ? t("Collegata e in attesa di corrente.", "Plugged in and waiting for power.")
        : t(
            `Collegata e in attesa di corrente; batteria al ${socTxt}%.`,
            `Plugged in and waiting for power; battery at ${socTxt}%.`,
          );
  } else if (socTxt != null) {
    parole = t(`Scollegata; batteria al ${socTxt}%.`, `Unplugged; battery at ${socTxt}%.`);
  }
  if (nodo.textContent !== parole) nodo.textContent = parole;
}

function rivesti() {
  try {
    aggiungiOra();
    umanizzaCaselle();
    frase();
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
#ev-popup .dm-ev-frase{margin:6px 0 0;font-size:12px;font-weight:700;line-height:1.4;color:var(--text-dim,#64748b)}
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
