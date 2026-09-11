/* Quali sensori guarda ogni telecamera, e l'automazione da incollare (#394).
 *
 * «Io utilizzo reolink, mi piacerebbe appunto una volta che io imposto persona,
 * animale, veicolo e movimento — perche' reolink ti sgancia questi sensori —
 * che la Dashboard metta l'avviso con il fotogramma e in contemporanea arriva
 * una notifica da home assistant.»
 *
 * Il blocco sta nella scheda Sicurezza, sotto le telecamere, perche' parla
 * delle telecamere che ci sono li' sopra: una riga per ognuna, quattro caselle.
 *
 * **Le caselle si riempiono da sole.** Chi ha una Reolink ha
 * `binary_sensor.ingresso_person` accanto a `camera.ingresso`, e chiedergli di
 * ricopiare quattro entita' per telecamera sarebbe chiedergli di battere a
 * macchina una cosa che e' gia' scritta. Il riconoscimento sta in
 * `core/rilevamenti-telecamera.js`; qui si propone, e quello che si propone si
 * puo' correggere — e' la ragione per cui le caselle sono caselle e non una
 * spunta.
 *
 * **L'automazione del telefono esce di qui gia' scritta.** Il push lo manda
 * Home Assistant, non la plancia (la ragione sta nel modulo di sopra): quello
 * che si puo' fare bene e' consegnare il documento con dentro le entita' che
 * sono state scelte, e un tasto che lo copia.
 */
import {
  CHIAVE_RILEVAMENTI,
  TIPI_RILEVAMENTO,
  automazioneDiHomeAssistant,
  normalizzaRilevamenti,
  parolaDelTipo,
  segnoDelTipo,
  sensoriDellaTelecamera,
} from "../core/rilevamenti-telecamera.js";
import { securityCameras } from "./security-showcase-section.js";
import {
  activeLocale,
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  tieniIlBloccoNellaScheda,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_RILEVAMENTI_EDITOR__";
const STYLE_ID = "dm-rilevamenti-style";
const BLOCK_ID = "dm-rilevamenti";
const state = (root[KEY] ||= { installed: false });

function scelte() {
  return normalizzaRilevamenti(readJson(CHIAVE_RILEVAMENTI, {}));
}

function salva(prossime) {
  writeJsonIfChanged(CHIAVE_RILEVAMENTI, prossime);
  try {
    root.render?.();
  } catch (_errore) {}
}

/* Le telecamere configurate, con il nome che hanno nella loro scheda. */
function telecamere() {
  return securityCameras()
    .map((camera) => ({
      entity: clean(camera?.entity),
      name: clean(camera?.name) || clean(camera?.entity),
    }))
    .filter((camera) => camera.entity.includes("."));
}

/* Cosa mostrare in una casella: quello che e' stato scritto, e se non c'e'
 * niente quello che si e' trovato da soli — come suggerimento, non come
 * scelta. Un suggerimento scritto dentro il valore diventerebbe una scelta di
 * chi non ha scelto. */
function propostaDi(camera, tipo, trovati) {
  return clean(trovati?.[tipo]);
}

function rigaMarkup(camera, voci, trovati) {
  const caselle = TIPI_RILEVAMENTO.map((tipo) => {
    const scritto = clean(voci?.[tipo]);
    const proposta = propostaDi(camera.entity, tipo, trovati);
    const id = `dm-ril-${camera.entity.replaceAll(".", "-")}-${tipo}`;
    return `<label class="ed-slot dm-ril-slot">
      <span class="ed-slot-lbl"><span aria-hidden="true">${segnoDelTipo(tipo)}</span> ${esc(
        parolaDelTipo(tipo, activeLocale()),
      )}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono"
        data-dm-ril-camera="${esc(camera.entity)}" data-dm-ril-tipo="${esc(tipo)}"
        value="${esc(scritto)}" placeholder="${esc(proposta || "binary_sensor.…")}"
        autocomplete="off" spellcheck="false"><button type="button"
        class="dm-entity-picker" data-dm-ril-pick="${id}"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
    </label>`;
  }).join("");
  const quanti = TIPI_RILEVAMENTO.filter((tipo) => clean(voci?.[tipo])).length;
  const proposti = TIPI_RILEVAMENTO.filter((tipo) => trovati?.[tipo] && !clean(voci?.[tipo]));
  return `<article class="ed-row dm-ril-row" data-dm-ril-riga="${esc(camera.entity)}">
    <div class="dm-ril-head">
      <strong class="ed-row-new">${esc(camera.name)}</strong>
      <small class="ed-row-old mono">${esc(camera.entity)}${quanti ? ` · ${quanti}` : ""}</small>
      ${
        proposti.length
          ? `<button type="button" class="dm-ril-prendi" data-dm-ril-prendi="${esc(
              camera.entity,
            )}">${esc(t("Prendi i suoi", "Take its own"))}</button>`
          : ""
      }
    </div>
    ${caselle}
  </article>`;
}

function markup(camere, tutte) {
  if (!camere.length)
    return `<div class="ed-slot-lbl dm-ril-titolo">${esc(
      t("Rilevamenti delle telecamere", "Camera detections"),
    )}</div>
    <div class="ed-intro">${esc(
      t(
        "Configura prima una telecamera qui sopra: i rilevamenti sono suoi.",
        "Configure a camera above first: the detections belong to it.",
      ),
    )}</div>`;
  const yaml = automazioneDiHomeAssistant(scelte(), {
    telecamere: camere,
    locale: activeLocale(),
  });
  return `<div class="ed-slot-lbl dm-ril-titolo">${esc(
    t("Rilevamenti delle telecamere", "Camera detections"),
  )}</div>
    <div class="ed-intro">${esc(
      t(
        "Chi scatta, e per cosa: persona, animale, veicolo, movimento. Quando uno di questi si accende, la tessera Telecamere in Home lo dice — con il nome della telecamera e l'ora — e il fotogramma è lì dentro. Le caselle sono già compilate con i sensori che stanno accanto a ogni telecamera: correggile se ha sbagliato, svuotale per non guardarle.",
        "What trips, and for what: person, animal, vehicle, motion. When one of them turns on, the Cameras tile on the Home says so — with the camera name and the time — and the frame is right there. The boxes are prefilled with the sensors sitting next to each camera: correct them if it got it wrong, empty them to stop watching.",
      ),
    )}</div>
    ${camere.map((camera) => rigaMarkup(camera, tutte[camera.entity], sensoriDellaTelecamera(camera.entity, allStates()))).join("")}
    ${
      yaml
        ? `<div class="dm-ril-yaml">
      <div class="dm-ril-yaml-testa">
        <strong>${esc(t("La notifica sul telefono", "The phone notification"))}</strong>
        <button type="button" class="dm-ril-copia" data-dm-ril-copia>${esc(
          t("Copia", "Copy"),
        )}</button>
      </div>
      <small>${esc(
        t(
          "Il push lo manda Home Assistant, non la plancia: gira sul server, quindi arriva anche quando questa pagina è chiusa. Questa automazione è già scritta con le tue entità — incollala in Impostazioni → Automazioni → ⋮ → Modifica in YAML, e cambia il servizio con quello del tuo telefono.",
          "The push comes from Home Assistant, not the dashboard: it runs on the server, so it arrives even when this page is closed. This automation is already written with your entities — paste it under Settings → Automations → ⋮ → Edit in YAML, and change the service to your phone's.",
        ),
      )}</small>
      <pre class="dm-ril-codice" data-dm-ril-codice>${esc(yaml)}</pre>
    </div>`
        : ""
    }`;
}

function firmaDelle(camere, tutte) {
  return [
    activeLocale(),
    ...camere.map(
      (camera) =>
        `${camera.entity}~${camera.name}~${TIPI_RILEVAMENTO.map(
          (tipo) => clean(tutte[camera.entity]?.[tipo]) || ".",
        ).join(",")}`,
    ),
  ].join("|");
}

/* La casella delle telecamere nella scheda Sicurezza: e' quella sotto cui va
 * messo il blocco, perche' e' di quelle telecamere che si sta parlando. */
function casellaDelleTelecamere() {
  const slot = doc?.querySelector?.('[data-ref="cd_cameras"], [data-editor="cameras"]');
  return slot?.closest?.(".ed-slot") || slot || null;
}

export function ensureRilevamentiBlock() {
  const casella = casellaDelleTelecamere();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!casella) {
    blocco?.remove();
    return false;
  }
  const camere = telecamere();
  const tutte = scelte();
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-ril";
    casella.after(blocco);
  } else if (blocco.previousElementSibling !== casella) {
    casella.after(blocco);
  }
  const firma = firmaDelle(camere, tutte);
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup(camere, tutte);
  return true;
}

function ridisegna() {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (blocco) delete blocco.dataset.firma;
  ensureRilevamentiBlock();
}

/* Quello che c'e' nelle caselle, messo al sicuro: un valore vuoto toglie il
 * sensore invece di lasciarlo scritto a meta'. */
function raccogli(blocco) {
  const prossime = {};
  for (const campo of blocco?.querySelectorAll?.("[data-dm-ril-camera]") || []) {
    const camera = clean(campo.dataset.dmRilCamera);
    const tipo = clean(campo.dataset.dmRilTipo);
    const entity = clean(campo.value);
    if (!camera || !tipo || !entity.includes(".")) continue;
    prossime[camera] ||= {};
    prossime[camera][tipo] = entity;
  }
  return prossime;
}

function onCambio(event) {
  const campo = event.target?.closest?.("[data-dm-ril-camera]");
  if (!campo) return;
  const blocco = campo.closest(`#${BLOCK_ID}`);
  if (!blocco) return;
  salva(raccogli(blocco));
  /* Non si ridisegna: si sta scrivendo in una casella, e rifare il blocco
   * porterebbe via il cursore. La firma si aggiorna al giro dopo. */
  blocco.dataset.firma = "";
}

function onClick(event) {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (!blocco || !blocco.contains(event.target)) return;

  const prendi = event.target.closest("[data-dm-ril-prendi]");
  if (prendi) {
    event.preventDefault();
    const camera = clean(prendi.dataset.dmRilPrendi);
    const trovati = sensoriDellaTelecamera(camera, allStates());
    const prossime = { ...scelte() };
    prossime[camera] = { ...trovati, ...(prossime[camera] || {}) };
    salva(prossime);
    ridisegna();
    return;
  }

  const copia = event.target.closest("[data-dm-ril-copia]");
  if (copia) {
    event.preventDefault();
    const codice = blocco.querySelector("[data-dm-ril-codice]")?.textContent || "";
    /* Se gli appunti non ci sono — succede fuori da https — si seleziona il
     * testo: copiare resta a chi guarda, ma almeno non si perde a cercarne
     * l'inizio e la fine. */
    try {
      root.navigator?.clipboard?.writeText?.(codice);
      copia.textContent = t("Copiato", "Copied");
      root.setTimeout?.(() => {
        copia.textContent = t("Copia", "Copy");
      }, 1600);
    } catch (_errore) {
      const nodo = blocco.querySelector("[data-dm-ril-codice]");
      const scelta = root.getSelection?.();
      const campo = doc.createRange();
      if (nodo && scelta) {
        campo.selectNodeContents(nodo);
        scelta.removeAllRanges();
        scelta.addRange(campo);
      }
    }
    return;
  }

  const pick = event.target.closest("[data-dm-ril-pick]");
  if (pick) {
    event.preventDefault();
    const campo = doc.getElementById(clean(pick.dataset.dmRilPick));
    /* Il cercatore delle entita' e' quello del guscio: una porta sola per una
     * domanda sola. */
    try {
      root.openEntityPicker?.(campo);
    } catch (_errore) {}
  }
}

function css() {
  return `
    #ed-body .dm-ril{display:block;margin:12px 0 0}
    #ed-body .dm-ril-titolo{margin:0 2px 6px}
    #ed-body .dm-ril-row{margin:8px 0 0}
    #ed-body .dm-ril-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
    #ed-body .dm-ril-head .ed-row-old{opacity:.7}
    #ed-body .dm-ril-prendi{
      margin-left:auto;padding:0 10px;height:28px;border-radius:9px;cursor:pointer;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-background-color,#fff);
      font:inherit;font-size:11.5px;font-weight:800;color:var(--primary-color,#0ea5e9)}
    /* Le quattro caselle stanno su due colonne dove c'e' posto e in colonna sul
       telefono: sono quattro domande corte, e una per riga sprecherebbe mezzo
       schermo per dire quattro parole. */
    #ed-body .dm-ril-row{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
    #ed-body .dm-ril-head{grid-column:1/-1}
    #ed-body .dm-ril-yaml{margin:14px 2px 0}
    #ed-body .dm-ril-yaml-testa{display:flex;align-items:center;gap:8px;margin-bottom:4px}
    #ed-body .dm-ril-copia{
      margin-left:auto;padding:0 12px;height:30px;border-radius:9px;cursor:pointer;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-background-color,#fff);
      font:inherit;font-size:12px;font-weight:800;color:var(--primary-color,#0ea5e9)}
    /* Il documento si legge e si scorre: e' YAML, e a capo automatico
       diventerebbe un altro documento. */
    #ed-body .dm-ril-codice{
      margin:8px 0 0;padding:10px 12px;border-radius:12px;overflow-x:auto;
      background:var(--bg-sculpted,#0f172a);color:#e2e8f0;
      font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.5;
      white-space:pre;max-height:280px;overflow-y:auto}
  `;
}

export function installRilevamentiEditorSection() {
  if (!doc || state.installed) return false;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick);
  /* In cattura: il selettore 🔍 scrive nel campo e annuncia con un `change`
   * che non sale, e un ascoltatore in bolla non lo sentirebbe mai. */
  doc.addEventListener("change", onCambio, true);
  doc.addEventListener("input", onCambio, true);
  tieniIlBloccoNellaScheda("dmRilevamenti", ensureRilevamentiBlock);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:persistence-restored"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureRilevamentiBlock));
  state.installed = true;
  return true;
}
