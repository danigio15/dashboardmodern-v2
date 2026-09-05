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
import { legaLaWallboxAlDispositivo } from "../core/wallbox-device-binding.js";
import { apriMenuIntegrazioni } from "./appliance-integration-section.js";
import { letturaMetadata, profiles, salvaAuto } from "./ev-section.js";
import { nuovoVeicolo } from "../core/vehicle-model.js";
import { etichettaDellaCasella } from "./auto-termica-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
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
  /* L'identita' gliela da' `nuovoVeicolo`, come a un'auto nata dal ＋.
   *
   * Qui si consegnava una riga senza uid, e uno gliene toccava dopo, ricavato
   * dal POSTO che occupava nell'elenco. Un'identita' che dipende dalla
   * posizione cambia quando l'elenco si riordina o qualcuno cancella una
   * vettura — e da quell'identita' dipendono l'auto in mostra e l'auto aperta
   * in configurazione. Il segno che non scende mai e' l'unico posto da cui
   * un'auto puo' prendere il suo nome interno. */
  const nata = {
    ...nuovoVeicolo(auto, nome, letturaMetadata()),
    tipo,
    ov: mappa,
    overrides: mappa,
  };
  salvaAuto([...auto, nata]);
  /* La prima auto e' anche quella in uso.
   *
   * Le caselle di una vettura vivono nel suo profilo; quelle da cui il disegno
   * legge sono le mappature globali, e a travasarle e' il gesto di mettere in
   * uso. Con una macchina sola quel gesto non lo fa nessuno: la vettura appena
   * importata usciva senza un dato — batteria vuota, autonomia vuota — finche'
   * uno non premeva «Usa» su una scheda dove c'era una macchina sola da usare.
   * Si passa dalla stessa strada del tasto, non da una copia. */
  if (!auto.length) {
    try {
      root.cdEvApplyCar?.(0);
    } catch (_error) {}
  }
  const daChi = clean(integration?.name) || t("un'integrazione", "an integration");
  root.edToast?.(`${nome} — ${t("aggiunta da", "added from")} ${daChi}`);
  /* La scheda si ridisegna da se' al giro dopo: qui si chiede solo che ci
   * pensi, senza sapere come lo fa. */
  try {
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:editor-rendered", { detail: {} }));
  } catch (_error) {}
}

/* ── la colonnina ─────────────────────────────────────────────────────── */

/* Le etichette delle caselle della colonnina, per l'anteprima. Sono otto e si
 * dicono per intero: chi guarda deve poter riconoscere le sue. */
const NOMI_WALLBOX = () => ({
  "dm.ev_potenza_wallbox": t("Potenza", "Power"),
  "dm.ev_energia_wallbox_oggi": t("Energia oggi", "Energy today"),
  "dm.ev_energia_wallbox_mese": t("Energia mese", "Energy this month"),
  "dm.ev_tensione_wallbox": t("Tensione", "Voltage"),
  "dm.ev_temperatura_wallbox": t("Temperatura", "Temperature"),
  "dm.ev_modalita_ricarica_evcc": t("Modalità di ricarica", "Charge mode"),
  "dm.ev_energia_sessione": t("Energia della sessione", "Session energy"),
  "dm.ev_percentuale_solare_sessione": t("Quota di sole", "Solar share"),
});

export function anteprimaWallbox({ entities }) {
  const { mappa, evcc } = legaLaWallboxAlDispositivo({ entities, states: allStates() });
  const nomi = NOMI_WALLBOX();
  const riga = (etichetta, valore) =>
    `<div class="dm-integ-casella"><span>${esc(etichetta)}</span><b class="mono">${esc(valore) || "—"}</b></div>`;
  return {
    etichetta: evcc ? "evcc" : t("Colonnina", "Charger"),
    corpo: `<div class="dm-integ-caselle">
        ${Object.entries(nomi)
          .filter(([ref]) => mappa[ref])
          .map(([ref, etichetta]) => riga(etichetta, mappa[ref]))
          .join("")}
      </div>`,
  };
}

/* La colonnina si scrive nelle caselle della CASA, non dentro un'auto.
 *
 * Chi ha due vetture ha una colonnina sola: la potenza che sta erogando e' la
 * stessa qualunque macchina sia attaccata, e metterla nel profilo di una
 * vorrebbe dire riscriverla anche nell'altra e vederla cambiare a ogni «Usa». */
export function collegaLaWallbox({ device, entities, integration }) {
  const { mappa } = legaLaWallboxAlDispositivo({ entities, states: allStates() });
  if (!Object.keys(mappa).length) {
    root.alert?.(
      t(
        "Da questo dispositivo non si riconosce nessuna casella della colonnina.",
        "No charger field could be recognised from this device.",
      ),
    );
    return false;
  }
  const salvate = readJson("cd_entity_overrides", {}) || {};
  const prossime = { ...salvate, ...mappa };
  writeJsonIfChanged("cd_entity_overrides", prossime);
  try {
    root.cdApplyCanonicalOverrides?.(prossime);
  } catch (_error) {}
  const nome = clean(device?.name) || clean(integration?.name) || t("Colonnina", "Charger");
  root.edToast?.(
    `${nome} — ${Object.keys(mappa).length} ${t("caselle collegate", "fields connected")}`,
  );
  try {
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:state-changed"));
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:editor-rendered", { detail: {} }));
  } catch (_error) {}
  return true;
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
    )}</small>
    <button type="button" class="ed-btn-add dm-auto-integ" data-wallbox-integ>🔌 ${esc(
      t("Collega la colonnina o evcc", "Connect the charger or evcc"),
    )}</button>
    <small>${esc(
      t(
        "La colonnina è della casa, non di una macchina: si collega una volta e vale per tutte le vetture. Da evcc arrivano anche la modalità di ricarica e la quota di sole della sessione.",
        "The charger belongs to the house, not to one car: connect it once and it counts for every vehicle. From evcc the charge mode and the session's solar share come along too.",
      ),
    )}</small>`;
  riga.before(invito);
  return true;
}

async function onClick(event) {
  if (!doc || !attiva()) return;
  if (event.target?.closest?.("[data-wallbox-integ]")) {
    event.preventDefault();
    apriMenuIntegrazioni({
      titolo: t("Collega la colonnina o evcc", "Connect the charger or evcc"),
      intro: t(
        "Le integrazioni che portano una colonnina: evcc, go-e, Easee, KEBA, Wallbox, openWB, Zaptec, Tesla. Scegli il dispositivo e le caselle della ricarica si riempiono da sole — potenza, energia, tensione, e da evcc anche la modalità e la quota di sole.",
        "The integrations that bring a charger: evcc, go-e, Easee, KEBA, Wallbox, openWB, Zaptec, Tesla. Pick the device and the charging fields fill in by themselves — power, energy, voltage, and from evcc the mode and the solar share too.",
      ),
      anteprima: anteprimaWallbox,
      onScelto: (scelta) => collegaLaWallbox(scelta),
    });
    return;
  }
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
