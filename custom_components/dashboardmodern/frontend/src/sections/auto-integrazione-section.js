/* L'auto entra dal menu delle integrazioni, come gli elettrodomestici.
 *
 * «Vogliamo cercare di fare la stessa cosa integrazione anche su auto, cosi'
 * viene piu' pulita.» E' lo stesso giro degli apparecchi e dei robot, e la
 * finestra e' letteralmente la stessa: cambia solo cosa si legge del
 * dispositivo, che e' l'unico pezzo diverso fra le sezioni.
 *
 * La scheda dell'auto pero' non e' di un modulo: la disegna il documento
 * vendorizzato, con il suo campo del nome e il suo elenco. Quindi qui non si
 * riscrive niente — si appende un invito in cima, sopra le caselle, come la
 * tendina del motore si appende sotto il nome.
 */
import { legaLAutoAlDispositivo } from "../core/auto-device-binding.js";
import { apriMenuIntegrazioni } from "./appliance-integration-section.js";
import { profiles, salvaAuto } from "./ev-section.js";
import { etichettaDellaCasella } from "./auto-termica-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AUTO_INTEGRAZIONE__";
const state = (root[KEY] ||= { installed: false });

const TAB = "sez2";

/* Quale scheda e' aperta lo dice la linguetta accesa, non una variabile del
 * guscio: e' la stessa domanda che si fanno gli altri editor, e la stessa
 * risposta. */
const attiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab) === TAB;

/* ── l'anteprima ──────────────────────────────────────────────────────── */

/* Quello che il dispositivo ha lasciato capire, prima di confermare.
 *
 * Si dice quante caselle si riempiono e quali: una vettura porta venti
 * entita', e l'elenco intero non entra in una finestra. Le prime si vedono per
 * nome — sono quelle che uno riconosce — e delle altre si dice il numero. */
export function anteprimaAuto({ device, entities }) {
  const { mappa, tipo } = legaLAutoAlDispositivo({ entities, states: allStates() });
  const voci = Object.entries(mappa);
  const riga = (etichetta, valore) =>
    `<div class="dm-integ-casella"><span>${esc(etichetta)}</span><b class="mono">${esc(valore) || "—"}</b></div>`;
  const PRIME = ["dm.ev_batteria_auto", "dm.ev_carburante", "dm.ev_autonomia", "dm.ev_odometro"];
  const inTesta = PRIME.filter((ref) => mappa[ref]);
  const restanti = voci.filter(([ref]) => !PRIME.includes(ref));
  return {
    etichetta:
      tipo === "termica"
        ? t("Auto a benzina", "Petrol car")
        : tipo === "ibrida"
          ? t("Auto ibrida", "Hybrid car")
          : t("Auto elettrica", "Electric car"),
    corpo: `<div class="dm-integ-caselle">
        ${inTesta.map((ref) => riga(etichettaDellaCasella(ref), mappa[ref])).join("")}
        ${riga(
          t("Altre caselle riconosciute", "Other fields recognised"),
          restanti.length
            ? `${restanti.length} — ${restanti.map(([ref]) => etichettaDellaCasella(ref)).join(", ")}`
            : "",
        )}
      </div>`,
  };
}

/* ── la nascita ───────────────────────────────────────────────────────── */

/* L'auto nuova, nata dal dispositivo scelto.
 *
 * Le caselle di una vettura non stanno in un campo suo: stanno negli
 * `overrides`, che e' la stessa strada di chi le compila a mano. Il motore lo
 * dicono le entita' — un serbatoio senza batteria e' benzina — e si scrive
 * dov'e' sempre stato.
 */
export async function creaAutoDaDispositivo({ device, entities, integration }) {
  const { mappa, tipo } = legaLAutoAlDispositivo({ entities, states: allStates() });
  if (!Object.keys(mappa).length) {
    root.alert?.(
      t(
        "Da questo dispositivo non si riconosce nessuna casella dell'auto.",
        "No car field could be recognised from this device.",
      ),
    );
    return;
  }
  const auto = profiles();
  const nome = clean(device?.name) || t("Auto", "Car");
  const nata = {
    name: nome,
    tipo,
    ov: mappa,
    overrides: mappa,
  };
  salvaAuto([...auto, nata]);
  const daChi = clean(integration?.name) || t("un'integrazione", "an integration");
  root.edToast?.(`${nome} — ${t("aggiunta da", "added from")} ${daChi}`);
  /* La scheda si ridisegna da se' al giro dopo: qui si chiede solo che ci
   * pensi, senza sapere come lo fa. */
  try {
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:editor-rendered", { detail: {} }));
  } catch (_error) {}
}

/* ── l'invito nella scheda ────────────────────────────────────────────── */

export function ensureInvitoAuto() {
  if (!doc || !attiva()) return false;
  const nome = doc.getElementById("ed-evcar-name");
  const riga = nome?.parentElement;
  if (!riga) return false;
  if (doc.querySelector("#ed-body [data-auto-integ]")) return true;
  const invito = doc.createElement("div");
  invito.className = "dm-auto-invito";
  invito.innerHTML = `<button type="button" class="ed-btn-add dm-auto-integ" data-auto-integ>🔗 ${esc(
    t("Aggiungi da un'integrazione", "Add from an integration"),
  )}</button>
    <small>${esc(
      t(
        "Hyundai, Tesla, Renault, BMW… scegli il dispositivo e l'auto arriva già fatta: batteria o serbatoio, autonomia, contachilometri, portiere e il resto. Oppure, qui sotto, una casella alla volta.",
        "Hyundai, Tesla, Renault, BMW… pick the device and the car arrives ready-made: battery or tank, range, odometer, doors and the rest. Or, below, one field at a time.",
      ),
    )}</small>`;
  riga.before(invito);
  return true;
}

async function onClick(event) {
  if (!doc || !attiva()) return;
  if (!event.target?.closest?.("[data-auto-integ]")) return;
  event.preventDefault();
  apriMenuIntegrazioni({
    titolo: t("Aggiungi un'auto da un'integrazione", "Add a car from an integration"),
    intro: t(
      "Le integrazioni di Home Assistant, ufficiali o da HACS, con i dispositivi che portano. Scegli la tua auto: batteria o serbatoio, autonomia, contachilometri, portiere e il resto entrano da soli.",
      "Home Assistant integrations, official or from HACS, with the devices they bring. Pick your car: battery or tank, range, odometer, doors and the rest come along by themselves.",
    ),
    anteprima: anteprimaAuto,
    onScelto: (scelta) =>
      creaAutoDaDispositivo(scelta).catch((errore) =>
        root.alert?.(`${t("Salvataggio fallito: ", "Save failed: ")}${errore?.message || errore}`),
      ),
  });
}

function installStyles() {
  installStyle(
    "dm-auto-integrazione-style",
    `
      #ed-body .dm-auto-invito{display:grid;gap:6px;margin:0 0 14px}
      #ed-body .dm-auto-invito small{color:var(--secondary-text-color,#64748b);font-size:11px;line-height:1.45}
    `,
  );
}

export function installAutoIntegrazione() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmAutoIntegrazione", () =>
    root.queueMicrotask?.(ensureInvitoAuto),
  );
  onEditorRedraw("__dmAutoIntegrazione", () => root.queueMicrotask?.(ensureInvitoAuto));
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:editor-rendered",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureInvitoAuto));
  ensureInvitoAuto();
}
