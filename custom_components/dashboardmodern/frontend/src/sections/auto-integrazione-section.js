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
import {
  letturaMetadata,
  mostraLeCaselleDellaColonnina,
  profiles,
  salvaAuto,
} from "./ev-section.js";
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
  /* Il secondo dispositivo si aggiunge al primo, non lo scalza.
   *
   * «Devo associare sia colonnina che evcc entrambi.» Sono due dispositivi e
   * portano cose diverse: evcc la modalita', la sessione e la quota di sole;
   * la colonnina quello che misura. Ma una casella la sanno riempire tutti e
   * due — la potenza — e sovrascrivere di forza voleva dire che il secondo
   * collegamento buttava fuori un pezzo del primo, senza dirlo.
   *
   * La regola e' una: una casella gia' occupata da un ALTRO dispositivo resta
   * dov'e'; una vuota si riempie; una che porta gia' un'entita' DI QUESTO
   * dispositivo si riscrive, che e' il modo di rifare un collegamento
   * sbagliato. Chi vuole cambiarne una a mano la svuota nel campo, che adesso
   * si vede. */
  const sue = new Set(
    (Array.isArray(entities) ? entities : []).map((voce) => clean(voce?.entity_id)).filter(Boolean),
  );
  const tenute = [];
  const prossime = { ...salvate };
  /* Con un'eccezione: un COMANDO scalza una lettura. Il target di carica lo
   * portano in due — l'auto come sensore di sola lettura, evcc come numero o
   * tendina — e tenere il sensore perche' e' arrivato prima vorrebbe dire una
   * tendina che non comanda niente. */
  const comanda = (id) => /^(select|input_select|number|input_number)\./.test(id);
  const legge = (id) => /^(sensor|binary_sensor)\./.test(id);
  for (const [ref, entita] of Object.entries(mappa)) {
    const gia = clean(prossime[ref]);
    if (gia && gia !== entita && !sue.has(gia) && !(comanda(entita) && legge(gia))) {
      tenute.push(ref);
      continue;
    }
    prossime[ref] = entita;
  }
  writeJsonIfChanged("cd_entity_overrides", prossime);
  try {
    root.cdApplyCanonicalOverrides?.(prossime);
  } catch (_error) {}
  /* E si vedono, subito, nei campi della scheda.
   *
   * «Si collega ma faccio salva e non vedo le entita'.» Scrivere la mappa non
   * bastava: i campi disegnati restavano vuoti, quindi la colonnina non si
   * vedeva da nessuna parte — e il salvataggio dell'auto, che rilegge i campi
   * e cancella le caselle di quelli vuoti, se la portava via. */
  mostraLeCaselleDellaColonnina(prossime);
  const nome = clean(device?.name) || clean(integration?.name) || t("Colonnina", "Charger");
  const collegate = Object.keys(mappa).length - tenute.length;
  root.edToast?.(
    `${nome} — ${collegate} ${t("caselle collegate", "fields connected")}${
      tenute.length
        ? ` · ${tenute.length} ${t(
            "già di un altro dispositivo, lasciate com'erano",
            "already from another device, left as they were",
          )}`
        : ""
    }`,
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
    <button type="button" class="ed-btn-add dm-auto-integ" data-wallbox-integ="colonnina">🔌 ${esc(
      t("Collega la colonnina", "Connect the charger"),
    )}</button>
    <small>${esc(
      t(
        "La colonnina è della casa, non di una macchina: si collega una volta e vale per tutte le vetture. Porta quello che misura: potenza, energia, tensione, temperatura, il cavo.",
        "The charger belongs to the house, not to one car: connect it once and it counts for every vehicle. It brings what it measures: power, energy, voltage, temperature, the cable.",
      ),
    )}</small>
    <button type="button" class="ed-btn-add dm-auto-integ" data-wallbox-integ="evcc">☀️ ${esc(
      t("Collega evcc", "Connect evcc"),
    )}</button>
    <small>${esc(
      t(
        "evcc è il regolatore davanti alla colonnina: da lui arrivano la modalità di ricarica, il limite di carica che si comanda, la sessione e la quota di sole. Si collega insieme alla colonnina, e nessuno dei due porta via le caselle dell'altro.",
        "evcc is the controller in front of the charger: it brings the charge mode, the charge limit you can command, the session and the solar share. Connect it alongside the charger, and neither takes the other's fields away.",
      ),
    )}</small>`;
  riga.before(invito);
  return true;
}

/* evcc si riconosce dal nome dell'integrazione: il dominio della sua
 * integrazione HACS e' `evcc_intg`, quello di altre `evcc`. */
export function eEvcc(integrazione) {
  return /evcc/i.test(`${clean(integrazione?.domain)} ${clean(integrazione?.name)}`);
}

async function onClick(event) {
  if (!doc || !attiva()) return;
  const tasto = event.target?.closest?.("[data-wallbox-integ]");
  if (tasto) {
    event.preventDefault();
    /* Due tasti, due menu: chi preme «evcc» vede evcc e basta, chi preme «la
     * colonnina» vede le colonnine. «Devono essere due per selezionare le
     * cose.» Quello che si collega poi e' lo stesso giro, e i due si sommano. */
    const perEvcc = clean(tasto.dataset.wallboxInteg) === "evcc";
    apriMenuIntegrazioni({
      titolo: perEvcc ? t("Collega evcc", "Connect evcc") : t("Collega la colonnina", "Connect the charger"),
      intro: perEvcc
        ? t(
            "Scegli il loadpoint di evcc: arrivano la modalità di ricarica, il limite di carica, la sessione e la quota di sole. La colonnina si collega dall'altro tasto, e le caselle si sommano.",
            "Pick the evcc loadpoint: the charge mode, the charge limit, the session and the solar share come along. The charger connects from the other button, and the fields add up.",
          )
        : t(
            "Le integrazioni che portano una colonnina: go-e, Easee, KEBA, Wallbox, openWB, Zaptec, Tesla. Scegli il dispositivo e le caselle della ricarica si riempiono da sole — potenza, energia, tensione, temperatura, il cavo.",
            "The integrations that bring a charger: go-e, Easee, KEBA, Wallbox, openWB, Zaptec, Tesla. Pick the device and the charging fields fill in by themselves — power, energy, voltage, temperature, the cable.",
          ),
      filtra: (integrazione) => eEvcc(integrazione) === perEvcc,
      vuoto: perEvcc
        ? t(
            "Non trovo evcc fra le integrazioni con dispositivi: serve l'integrazione di evcc per Home Assistant (HACS), con almeno un loadpoint.",
            "evcc is not among the integrations with devices: the evcc integration for Home Assistant (HACS) is needed, with at least one loadpoint.",
          )
        : t(
            "Non trovo una colonnina fra le integrazioni con dispositivi: qui ci sono solo quelle di evcc, che si collega dall'altro tasto.",
            "No charger among the integrations with devices: only evcc's are here, and evcc connects from the other button.",
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
