/* L'auto che va a benzina, nella pagina Auto (#208).
 *
 * «Ho la mia auto che ha i sensori di livello carburante, odometro, autonomia
 * e portiere: e' possibile scegliere a monte se visualizzare un'auto elettrica
 * o classica con i sensori disponibili?» E dal campo: «anche lo stato dei
 * finestrini e la pressione dei pneumatici».
 *
 * Tre cose, e nessuna rifa' quello che la pagina Auto sa gia' fare.
 *
 * La prima e' la scelta «a monte»: nella scheda dell'auto, sotto il nome, una
 * tendina dice se il motore e' elettrico, termico o ibrido. Vale per QUELLA
 * vettura — in un garage possono starci tutte e due — e la salva la stessa
 * mano che salva il resto della scheda.
 *
 * La seconda sono le caselle: carburante, motore, portiere, finestrini,
 * allarme, batteria di servizio, olio, temperatura esterna, ultimo viaggio,
 * carburante consumato, pneumatici. Sono `dm.ev_*` come tutte le altre della
 * pagina Auto, e si aggiungono all'elenco che il guscio gia' disegna: entrano
 * nel profilo per la stessa strada, con la stessa lente e lo stesso cestino.
 *
 * La terza e' il quadro. Con un'auto termica la pagina non mostra piu' la
 * ricarica — batteria, wallbox, sessione, target — che per lei non vuol dire
 * niente, e al loro posto c'e' il serbatoio, con intorno le cose che uno
 * guarda di un'auto ferma in garage: se e' chiusa, se il motore gira, quanto
 * puo' fare. Un'ibrida tiene tutti e due i quadri, perche' li ha tutti e due.
 */
import { CASELLE_TERMICHE, RIFERIMENTI_TERMICI, letturaTermica } from "../core/auto-termica.js";
import { TIPI_MOTORE, tipoMotore } from "../core/vehicle-model.js";
import { activeVehicle, bozzaAperta, editedVehicle } from "./ev-section.js";
import { registraTitoloDiPagina, renderPageMastheads } from "./page-masthead-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  lexicalGlobal,
  onEditorRedraw,
  root,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AUTO_TERMICA__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

const ARC_RADIUS = 50;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

/* ── le parole ────────────────────────────────────────────────────────── */

/* L'intestazione della pagina dice di che auto parla: «Carica · Autonomia ·
 * Wallbox» sopra un serbatoio sarebbe una bugia. */
export function titoloDellaPagina(tipo = tipoMotore(activeVehicle()?.tipo)) {
  if (tipo === "termica")
    return {
      title: t("Auto", "Car"),
      subtitle: t("Carburante · Autonomia · Portiere", "Fuel · Range · Doors"),
    };
  if (tipo === "ibrida")
    return {
      title: t("Auto ibrida", "Hybrid car"),
      subtitle: t("Carica · Carburante · Autonomia", "Charge · Fuel · Range"),
    };
  return null;
}

export function nomeDelMotore(tipo) {
  if (tipo === "termica") return t("Termica (benzina, diesel, GPL)", "Combustion (petrol, diesel, LPG)");
  if (tipo === "ibrida") return t("Ibrida plug-in", "Plug-in hybrid");
  return t("Elettrica", "Electric");
}

/* L'etichetta di ogni casella, come compare nella scheda. Il riferimento e'
 * la chiave, cosi' chi la rinomina dalla scheda la ritrova con il suo nome. */
export function etichettaDellaCasella(ref) {
  switch (ref) {
    case "dm.ev_carburante":
      return t("Livello carburante (%)", "Fuel level (%)");
    case "dm.ev_motore":
      return t("Motore (acceso/spento)", "Engine (running/off)");
    case "dm.ev_portiere":
      return t("Portiere (bloccate/aperte)", "Doors (locked/open)");
    case "dm.ev_finestrini":
      return t("Finestrini (aperti/chiusi)", "Windows (open/closed)");
    case "dm.ev_allarme":
      return t("Allarme dell'auto", "Car alarm");
    case "dm.ev_batteria_servizio":
      return t("Batteria di servizio 12 V (%)", "Service battery 12 V (%)");
    case "dm.ev_temperatura_olio":
      return t("Temperatura olio", "Oil temperature");
    case "dm.ev_temperatura_esterna":
      return t("Temperatura esterna", "Outside temperature");
    case "dm.ev_ultimo_viaggio":
      return t("Ultimo viaggio (km)", "Last trip (km)");
    case "dm.ev_carburante_totale":
      return t("Carburante consumato in totale (L)", "Total fuel used (L)");
    case "dm.ev_pneumatici":
      return t("Pressione pneumatici", "Tyre pressure");
    default:
      return clean(ref);
  }
}

function parolaDellePortiere(codice) {
  if (codice === "bloccate") return t("Portiere bloccate", "Doors locked");
  if (codice === "sbloccate") return t("Portiere sbloccate", "Doors unlocked");
  if (codice === "aperte") return t("Portiere aperte", "Doors open");
  return t("Portiere chiuse", "Doors closed");
}

function parolaDellAllarme(codice) {
  if (codice === "scattato") return t("Allarme scattato", "Alarm triggered");
  if (codice === "inserito") return t("Allarme inserito", "Alarm armed");
  return t("Allarme disinserito", "Alarm disarmed");
}

/* ── le caselle nella scheda ──────────────────────────────────────────── */

/* Le caselle entrano nell'elenco del guscio, che e' `const` nel suo script:
 * si raggiunge con l'eval indiretto e si allunga. Da li' in poi il guscio le
 * disegna, le salva col profilo e le rilegge come tutte le altre — e il
 * modulo delle caselle mette loro la lente e il cestino. */
export function mettiLeCaselle() {
  const slots = lexicalGlobal("CD_SLOTS");
  if (!slots || typeof slots !== "object") return false;
  const sezione = Object.values(slots).find(
    (voce) => Array.isArray(voce?.slots) && voce.slots.some((slot) => slot?.ref === "dm.ev_batteria_auto"),
  );
  if (!sezione) return false;
  /* La scheda si chiama «Auto», non «Auto elettrica»: da qui passano anche
   * le vetture a benzina, e il titolo della pagina dice la stessa cosa. */
  if (/auto elettrica|electric/i.test(String(sezione.label || ""))) sezione.label = `🚗 ${t("Auto", "Car")}`;
  let aggiunte = 0;
  for (const voce of CASELLE_TERMICHE) {
    if (sezione.slots.some((slot) => slot?.ref === voce.ref)) continue;
    sezione.slots.push({ ref: voce.ref, lbl: etichettaDellaCasella(voce.ref) });
    aggiunte += 1;
  }
  const refs = lexicalGlobal("CD_SLOT_REFS");
  if (refs && typeof refs.add === "function") for (const ref of RIFERIMENTI_TERMICI) refs.add(ref);
  return aggiunte > 0;
}

/* ── la tendina del motore, nella scheda dell'auto ────────────────────── */

function tendina() {
  return doc?.querySelector?.("#ed-body select[data-ev-tipo]") || null;
}

/* La tendina dice dell'auto aperta: alla matita si riallinea, al «＋» torna
 * elettrica. Una scelta fatta e non ancora salvata non si riscrive sotto le
 * dita: si riallinea solo quando cambia l'auto di cui si parla. */
function sincronizzaTendina() {
  const select = tendina();
  if (!select) return false;
  const auto = bozzaAperta() ? null : editedVehicle();
  const chiave = auto ? clean(auto.uid) || "senza-uid" : "bozza";
  if (select.dataset.dmPer === chiave) return true;
  select.dataset.dmPer = chiave;
  select.value = tipoMotore(auto?.tipo);
  return true;
}

export function ensureTendinaMotore() {
  const nome = doc?.getElementById?.("ed-evcar-name");
  const riga = nome?.parentElement;
  if (!riga) return false;
  let casella = doc.querySelector("#ed-body [data-ev-tipo-riga]");
  if (!casella) {
    casella = doc.createElement("label");
    casella.className = "ed-slot dm-termica-tipo";
    casella.dataset.evTipoRiga = "true";
    casella.innerHTML = `<span class="ed-slot-lbl">${esc(t("Motore", "Engine"))}</span>
      <select class="ed-input" data-ev-tipo>${TIPI_MOTORE.map(
        (tipo) =>
          `<option value="${tipo === "elettrica" ? "" : esc(tipo)}">${esc(nomeDelMotore(tipo))}</option>`,
      ).join("")}</select>
      <small>${esc(
        t(
          "Termica: la pagina mostra il serbatoio, le portiere e il motore al posto della ricarica. Ibrida: tutti e due. Le caselle del carburante stanno qui sotto, fra le entità dell'auto.",
          "Combustion: the page shows the tank, the doors and the engine instead of charging. Hybrid: both. The fuel fields are below, among the car's entities.",
        ),
      )}</small>`;
    riga.after(casella);
  }
  sincronizzaTendina();
  return true;
}

/* ── il quadro nella pagina ───────────────────────────────────────────── */

function arco(percentuale) {
  const valore = Number.isFinite(percentuale) ? Math.max(0, Math.min(100, percentuale)) : 0;
  const pieno = (valore / 100) * ARC_LENGTH;
  return `${pieno.toFixed(1)} ${(ARC_LENGTH - pieno).toFixed(1)}`;
}

function pillola(glifo, testo, tono) {
  return `<span class="dm-termica-pillola" data-tono="${esc(tono)}"><i aria-hidden="true">${glifo}</i>${esc(testo)}</span>`;
}

function misura(glifo, etichetta, valore, unita, ref, cifre = 0) {
  if (valore === null || valore === undefined) return "";
  return `<button type="button" class="dm-termica-misura" data-dm-storico="${esc(ref)}" data-dm-nome="${esc(etichetta)}">
    <i aria-hidden="true">${glifo}</i>
    <span class="dm-termica-misura-testo"><small>${esc(etichetta)}</small><b>${esc(formatNumber(valore, cifre))}<em>${esc(unita)}</em></b></span>
  </button>`;
}

function quadroMarkup(lettura, tipo) {
  const pillole = [];
  if (lettura.motore === true || lettura.motore === false)
    pillole.push(
      pillola("🔑", lettura.motore ? t("Motore acceso", "Engine running") : t("Motore spento", "Engine off"), lettura.motore ? "acceso" : "spento"),
    );
  if (lettura.portiere)
    pillole.push(
      pillola("🚪", parolaDellePortiere(lettura.portiere), lettura.portiere === "bloccate" || lettura.portiere === "chiuse" ? "bene" : "attento"),
    );
  if (lettura.finestrini)
    pillole.push(
      pillola("🪟", lettura.finestrini === "aperti" ? t("Finestrini aperti", "Windows open") : t("Finestrini chiusi", "Windows closed"), lettura.finestrini === "aperti" ? "attento" : "bene"),
    );
  if (lettura.allarme)
    pillole.push(
      pillola("🚨", parolaDellAllarme(lettura.allarme), lettura.allarme === "scattato" ? "male" : lettura.allarme === "inserito" ? "bene" : "spento"),
    );
  const carburante = lettura.carburante;
  const serbatoio =
    carburante === null || carburante === undefined
      ? ""
      : `<div class="dm-termica-serbatoio" data-riserva="${carburante <= 10}">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="dm-termica-arc-track" cx="60" cy="60" r="${ARC_RADIUS}" fill="none" stroke-width="9"/>
        <circle class="dm-termica-arc" cx="60" cy="60" r="${ARC_RADIUS}" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${arco(carburante)}"/>
      </svg>
      <b>${esc(formatNumber(carburante, 0))}<i>%</i></b>
      <span>${esc(carburante <= 10 ? t("In riserva", "Reserve") : t("Carburante", "Fuel"))}</span>
    </div>`;
  const righe = [
    misura("🛣️", t("Autonomia", "Range"), lettura.autonomia, ` ${lettura.autonomiaUnita}`, "dm.ev_autonomia"),
    misura("🧭", t("Odometro", "Odometer"), lettura.odometro, ` ${lettura.odometroUnita}`, "dm.ev_odometro"),
    misura("🧭", t("Ultimo viaggio", "Last trip"), lettura.ultimoViaggio, " km", "dm.ev_ultimo_viaggio", 1),
  ].join("");
  const pneumatici = lettura.pneumatici;
  const tessere = [
    misura("🔋", t("Batteria 12 V", "12 V battery"), lettura.batteriaServizio, "%", "dm.ev_batteria_servizio"),
    misura("🛢️", t("Olio", "Oil"), lettura.olio, "°", "dm.ev_temperatura_olio"),
    misura("🌡️", t("Esterna", "Outside"), lettura.esterna, "°", "dm.ev_temperatura_esterna"),
    misura("⛽", t("Consumato in totale", "Total fuel used"), lettura.carburanteTotale, " L", "dm.ev_carburante_totale"),
    pneumatici
      ? pneumatici.pressione !== null
        ? misura("🛞", t("Pneumatici", "Tyres"), pneumatici.pressione, ` ${pneumatici.unita}`, "dm.ev_pneumatici", 1)
        : pillola("🛞", pneumatici.avviso ? t("Pneumatici da controllare", "Check the tyres") : t("Pneumatici a posto", "Tyres fine"), pneumatici.avviso ? "attento" : "bene")
      : "",
  ].join("");
  const vuoto =
    !serbatoio && !righe && !tessere && !pillole.length
      ? `<div class="dm-termica-vuoto">${esc(
          t(
            "Compila le caselle dell'auto — carburante, autonomia, portiere, motore — dalla scheda Auto della configurazione.",
            "Fill in the car's fields — fuel, range, doors, engine — from the Car tab in the settings.",
          ),
        )}</div>`
      : "";
  return `<div class="dm-termica-testa">
      <span class="dm-termica-titolo">${esc(tipo === "ibrida" ? t("Motore termico", "Combustion engine") : t("L'auto", "The car"))}</span>
      <div class="dm-termica-pillole">${pillole.join("")}</div>
    </div>
    <div class="dm-termica-quadro">${serbatoio}<div class="dm-termica-righe">${righe}</div></div>
    ${tessere ? `<div class="dm-termica-griglia">${tessere}</div>` : ""}
    ${vuoto}`;
}

function dipingi() {
  const page = doc?.getElementById?.("page-ev");
  const hero = doc?.getElementById?.("lm-hero-card");
  if (!page || !hero) return;
  const auto = activeVehicle();
  const tipo = tipoMotore(auto?.tipo);
  const motore = tipo || "elettrica";
  if (page.dataset.dmMotore !== motore) {
    page.dataset.dmMotore = motore;
    try {
      renderPageMastheads();
    } catch (_error) {}
  }
  let blocco = page.querySelector(":scope .dm-termica");
  if (!tipo) {
    if (blocco) blocco.remove();
    state.firma = "";
    return;
  }
  const lettura = letturaTermica(auto?.ov || auto?.overrides || {}, allStates(), root.resolveEntity);
  const firma = JSON.stringify([tipo, lettura]);
  if (state.firma === firma && blocco) return;
  state.firma = firma;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.className = "dm-termica";
    hero.insertAdjacentElement("afterend", blocco);
  }
  blocco.dataset.attenzione = String(Boolean(lettura.attenzione));
  blocco.innerHTML = quadroMarkup(lettura, tipo);
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] auto termica", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderAutoTermica() {
  state.firma = "";
  schedule();
}

function evVisible() {
  return Boolean(doc?.getElementById("page-ev")?.classList.contains("active"));
}

function onClick(event) {
  const misuraToccata = event.target?.closest?.(".dm-termica-misura[data-dm-storico]");
  if (misuraToccata) {
    event.preventDefault();
    try {
      root.apriStorico?.(event, clean(misuraToccata.dataset.dmStorico), clean(misuraToccata.dataset.dmNome));
    } catch (_error) {}
    return;
  }
  /* La matita e il «＋» cambiano l'auto di cui la scheda parla; la tendina si
   * riallinea un istante dopo, quando il modulo dell'auto ha fatto il suo. */
  if (event.target?.closest?.("[data-ev-edit],[data-ev-add-new]"))
    root.queueMicrotask?.(sincronizzaTendina);
  if (event.target?.closest?.('.dm-vehicle-profile-card,[data-tab="ev"],#ev-car-sel'))
    root.queueMicrotask?.(schedule);
}

function installStyles() {
  installStyle(
    "dm-auto-termica-style",
    `
    /* Con un'auto termica la ricarica non si disegna: batteria, wallbox,
       sessione e target parlano di un cavo che quest'auto non ha. */
    #page-ev[data-dm-motore="termica"] .dm-evv-power,
    #page-ev[data-dm-motore="termica"] .lm-kpi-row,
    #page-ev[data-dm-motore="termica"] .lm-session-card,
    #page-ev[data-dm-motore="termica"] .lm-stats-grid,
    #page-ev[data-dm-motore="termica"] .lm-target-card,
    #page-ev[data-dm-motore="termica"] .lm-evcc-card,
    #page-ev[data-dm-motore="termica"] .lm-batt-section,
    #page-ev[data-dm-motore="termica"] #lm-charge-badge{display:none!important}

    #page-ev .dm-termica{
      display:grid;gap:14px;margin:14px 0 0;padding:16px 18px;border-radius:24px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    #page-ev .dm-termica[data-attenzione="true"]{box-shadow:0 0 0 1px rgba(245,158,11,.4),0 14px 34px -14px rgba(245,158,11,.6)}
    #page-ev .dm-termica-testa{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    #page-ev .dm-termica-titolo{
      font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-pillole{display:flex;flex-wrap:wrap;gap:6px}
    #page-ev .dm-termica-pillola{
      display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;
      font-size:11.5px;font-weight:800;background:var(--surface-3,#f1f5f9);color:var(--text,#0f172a)}
    #page-ev .dm-termica-pillola i{font-style:normal}
    #page-ev .dm-termica-pillola[data-tono="acceso"]{background:#dcfce7;color:#166534}
    #page-ev .dm-termica-pillola[data-tono="bene"]{background:#dcfce7;color:#166534}
    #page-ev .dm-termica-pillola[data-tono="attento"]{background:#fef3c7;color:#b45309}
    #page-ev .dm-termica-pillola[data-tono="male"]{background:#fee2e2;color:#b91c1c}
    #page-ev .dm-termica-pillola[data-tono="spento"]{color:var(--text-dim,#64748b)}

    #page-ev .dm-termica-quadro{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center}
    #page-ev .dm-termica-serbatoio{
      position:relative;width:140px;height:140px;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:2px;text-align:center}
    #page-ev .dm-termica-serbatoio svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
    #page-ev .dm-termica-arc-track{stroke:var(--surface-3,#e2e8f0)}
    #page-ev .dm-termica-arc{stroke:#f59e0b;transition:stroke-dasharray .8s cubic-bezier(.16,1,.3,1)}
    #page-ev .dm-termica-serbatoio[data-riserva="true"] .dm-termica-arc{stroke:#ef4444}
    #page-ev .dm-termica-serbatoio b{
      position:relative;font-family:'Oswald',sans-serif;font-size:32px;font-weight:500;line-height:1;
      color:var(--text,#0f172a);font-variant-numeric:tabular-nums}
    #page-ev .dm-termica-serbatoio b i{font-style:normal;font-size:.5em;margin-left:1px;opacity:.75}
    #page-ev .dm-termica-serbatoio span{
      position:relative;font-size:9.5px;font-weight:900;letter-spacing:.08em;
      text-transform:uppercase;color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-serbatoio[data-riserva="true"] span{color:#dc2626}
    #page-ev .dm-termica-righe{display:grid;gap:6px;min-width:0}
    #page-ev .dm-termica-misura{
      display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;text-align:left;
      border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc);cursor:pointer;
      font:inherit;color:var(--text,#0f172a);min-width:0}
    #page-ev .dm-termica-misura i{font-style:normal;font-size:16px;flex:0 0 auto}
    #page-ev .dm-termica-misura-testo{display:grid;gap:1px;min-width:0}
    #page-ev .dm-termica-misura small{
      font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-misura b{font-size:17px;font-weight:900;line-height:1.1;font-variant-numeric:tabular-nums}
    #page-ev .dm-termica-misura b em{font-style:normal;font-size:.7em;font-weight:800;opacity:.75}
    #page-ev .dm-termica-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
    #page-ev .dm-termica-vuoto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b);text-align:center;padding:6px}

    #ed-body .dm-termica-tipo{display:block;margin:0 0 10px}
    #ed-body .dm-termica-tipo small{
      display:block;margin:4px 2px 0;font-size:11px;line-height:1.45;color:var(--text-dim,#64748b)}

    @media (max-width:640px){
      #page-ev .dm-termica-quadro{grid-template-columns:1fr;justify-items:center}
      #page-ev .dm-termica-righe{width:100%}
    }
    `,
  );
}

export function installAutoTermica() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  registraTitoloDiPagina("page-ev", () => titoloDellaPagina());
  mettiLeCaselle();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmAutoTermica", () => {
    mettiLeCaselle();
    ensureTendinaMotore();
  });
  onEditorRedraw("__dmAutoTermica", () => {
    root.queueMicrotask?.(ensureTendinaMotore);
  });
  /* Il cambio d'auto passa da qui: dopo, il quadro e' di un'altra vettura. */
  wrapFunction("cdEvApplyCar", "__dmAutoTermica", () => root.queueMicrotask?.(renderAutoTermica));
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:editor-rendered",
  ])
    root.addEventListener?.(evento, () => {
      mettiLeCaselle();
      root.queueMicrotask?.(ensureTendinaMotore);
      renderAutoTermica();
    });
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    if (evVisible()) schedule();
  });
  ensureTendinaMotore();
  schedule();
  return true;
}

installAutoTermica();
