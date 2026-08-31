/* Il popup «Clima attivi» distingue chi scalda da chi raffresca, e dice da quanto.
 *
 * Dal campo: «il popup widget non distingue caldo/freddo, mostra tutto
 * insieme, e deve dire da quanto tempo i clima sono accesi». Il guscio
 * elenca le entita' del gruppo clima una sotto l'altra, condizionatori in
 * raffrescamento e pompe in riscaldamento mescolati: d'inverno, con tre
 * split in heat e uno in cool, la lista non racconta niente.
 *
 * Il guscio disegna la sua lista e questo modulo la sistema subito dopo:
 * le righe in heat finiscono sotto la testata «Riscaldano», le altre sotto
 * «Raffrescano» (le testate compaiono solo quando i due mondi convivono), e
 * ogni riga — anche nel popup Riscaldamento — dice da quanto tempo e' cosi',
 * letta dal last_changed che Home Assistant gia' manda.
 */
import { allStates, clean, doc, installStyle, root, t } from "./shared.js";
import { daQuanto } from "./termico-del-caldo-section.js";

const KEY = "__DASHBOARDMODERN_POPUP_CLIMA_DISTINGUE__";
const state = (root[KEY] ||= { installed: false });

const CALDI = /^(heat|heating|heat_cool)$/i;

/* In `heat_cool`/`auto` lo stato dice solo il modo scelto: cosa sta facendo
 * ADESSO lo dice `hvac_action` (heating/cooling/idle). Un'unita' automatica
 * che raffresca finiva sotto «Riscaldano»: l'azione, quando parla, comanda. */
function scaldaAdesso(stato) {
  const azione = clean(stato?.attributes?.hvac_action).toLowerCase();
  if (azione === "heating") return true;
  if (azione === "cooling") return false;
  return CALDI.test(clean(stato?.state));
}

/* L'entita' della riga sta solo negli onclick dei suoi tasti. */
function entitaDellaRiga(riga) {
  for (const bottone of riga.querySelectorAll("button[onclick]")) {
    const preso = (bottone.getAttribute("onclick") || "").match(/'([a-z_0-9]+\.[^']+)'/i);
    if (preso) return preso[1];
  }
  return "";
}

function testata(parole) {
  const nodo = doc.createElement("div");
  nodo.className = "dm-clpd-testata";
  nodo.textContent = parole;
  return nodo;
}

export function decora(tipo) {
  if (tipo !== "clima" && tipo !== "risc") return false;
  const lista = doc?.getElementById?.("details-list");
  if (!lista) return false;
  const righe = [...lista.querySelectorAll(".detail-row")];
  if (!righe.length) return false;
  const freddo = [];
  const caldo = [];
  for (const riga of righe) {
    const entity = entitaDellaRiga(riga);
    const stato = allStates()?.[entity];
    const da = daQuanto(stato?.last_changed);
    const dove = riga.querySelector(".d-state");
    if (da && dove && !dove.querySelector(".dm-clpd-da")) {
      const nodo = doc.createElement("span");
      nodo.className = "dm-clpd-da";
      nodo.textContent = ` · ${t(`acceso da ${da}`, `on for ${da}`)}`;
      dove.append(nodo);
    }
    (scaldaAdesso(stato) ? caldo : freddo).push(riga);
  }
  /* Le testate solo quando i due mondi convivono: una lista tutta di un
   * colore non ha bisogno di dirselo. */
  if (tipo === "clima" && caldo.length && freddo.length) {
    lista.append(testata(t("❄️ Raffrescano", "❄️ Cooling")), ...freddo);
    lista.append(testata(t("🔥 Riscaldano", "🔥 Heating")), ...caldo);
  }
  return true;
}

function aggancia() {
  const originale = root.apriDettagli;
  if (typeof originale !== "function" || originale.__dmClpdVestito) return false;
  function vestito(evento, tipo, ...resto) {
    const esito = originale.call(this, evento, tipo, ...resto);
    try {
      decora(tipo);
    } catch (_errore) {}
    return esito;
  }
  Object.assign(vestito, originale);
  vestito.__dmClpdVestito = true;
  vestito.__dmPrevious = originale;
  root.apriDettagli = vestito;
  return true;
}

const STILE = `
#details-list .dm-clpd-testata{
  font-size:10px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;
  color:var(--text-dim,#94a3b8);padding:12px 4px 6px}
#details-list .dm-clpd-testata:first-child{padding-top:2px}
#details-list .dm-clpd-da{opacity:.7;font-weight:700}
`;

export function installPopupClimaDistingue() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-popup-clima-distingue-style", STILE);
  aggancia();
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(evento, aggancia);
  }
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installPopupClimaDistingue, { once: true });
} else {
  installPopupClimaDistingue();
}
