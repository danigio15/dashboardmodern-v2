/* Il popup dell'elettrodomestico, rivestito da progetto.
 *
 * «Quando clicco su un elettrodomestico si apre questo popup orrendo: crealo
 * piu' bello, stile widget, che ti fa anche l'analisi.» Il guscio elencava
 * OGNI entita' del dispositivo con lo slug sotto il nome e il valore a
 * destra: tredici righe da leggere per capire se il condizionatore stava
 * lavorando. Qui la finestra parla come i popup dei widget: il verdetto e la
 * frase in cima, le letture a caselle sotto «Le misure», gli acceso/spento a
 * pillole sotto «Lo stato», e sotto «Comandi» i tasti veri — interruttori e
 * script. Ogni casella resta cliccabile e apre lo storico, come prima.
 *
 * Il guscio disegna la sua lista e questo modulo la riveste subito dopo:
 * stessa finestra, stesso apri e chiudi, nessun secondo padrone.
 */
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_DETAIL_POPUP__";
const state = (root[KEY] ||= { installed: false });

const STATI_MUTI = /^(unknown|unavailable|none|)$/i;
const DOMINI_INTERRUTTORE = /^(switch|light|input_boolean|fan)\./;
const DOMINI_AZIONE = /^(script|scene|button)\./;

function entita(appliance) {
  return (appliance?.entities || [])
    .map((voce) => (typeof voce === "string" ? voce : voce?.entity))
    .map(clean)
    .filter(Boolean);
}

function nomeDi(states, entity) {
  return (
    clean(states?.[entity]?.attributes?.friendly_name) ||
    entity.split(".")[1]?.replaceAll("_", " ") ||
    entity
  );
}

/* Il glifo della casella, indovinato da entita' e unita': sono letture di
 * elettrodomestici, e nessuna porta un'icona scritta da qualche parte. */
function glifoDellaLettura(entity, unit) {
  const token = `${entity} ${unit}`.toLowerCase();
  if (/temperatur|°/.test(token)) return "🌡️";
  if (/umidit|humidity/.test(token)) return "💧";
  if (/kwh|energy|energia/.test(token)) return "🔋";
  if (/\bw\b|watt|power|potenza/.test(token)) return "⚡";
  if (/corrente|current|\ba\b/.test(token)) return "🔌";
  if (/volt|tension/.test(token)) return "🎚️";
  return "📈";
}

/* Le quattro famiglie della finestra, da un giro solo sulle entita'. */
function famiglie(appliance) {
  const states = allStates();
  const misure = [];
  const pillole = [];
  const comandi = [];
  for (const entity of entita(appliance)) {
    const stato = states?.[entity];
    const grezzo = clean(stato?.state);
    const nome = nomeDi(states, entity);
    if (DOMINI_AZIONE.test(entity)) {
      comandi.push({ entity, nome, azione: true, acceso: false });
      continue;
    }
    if (DOMINI_INTERRUTTORE.test(entity)) {
      const acceso = grezzo.toLowerCase() === "on";
      pillole.push({ entity, nome, acceso, valore: acceso ? t("Acceso", "On") : t("Spento", "Off") });
      comandi.push({ entity, nome, azione: false, acceso });
      continue;
    }
    if (STATI_MUTI.test(grezzo)) continue;
    const numero = Number.parseFloat(grezzo.replace(",", "."));
    if (Number.isFinite(numero)) {
      const unit = clean(stato?.attributes?.unit_of_measurement);
      misure.push({
        entity,
        nome,
        glifo: glifoDellaLettura(entity, unit),
        valore: `${grezzo}${unit ? ` ${unit}` : ""}`,
      });
      continue;
    }
    const acceso = /^(on|open|aperto|running|cleaning|heat|cool)$/i.test(grezzo);
    pillole.push({ entity, nome, acceso, valore: grezzo });
  }
  return { misure: misure.slice(0, 12), pillole: pillole.slice(0, 12), comandi };
}

/* La frase: cosa sta facendo, quanto tira, e quanto ha fatto oggi. */
function racconto(appliance, misure) {
  const stato = root.cdApplStatus?.(appliance) || { cls: "off", label: "", w: null };
  const nome = clean(root.cdApplianceDisplayName?.(appliance)) || clean(appliance?.name) || "";
  const oggi = misure.find(
    (m) => /oggi|today|daily|giorn/i.test(`${m.entity} ${m.nome}`) && /kwh/i.test(m.valore),
  );
  const codaOggi = oggi ? t(`; oggi ha fatto ${oggi.valore}.`, `; today it did ${oggi.valore}.`) : ".";
  if (stato.cls === "run") {
    return {
      tono: "corso",
      parola: t("In corso", "Running"),
      frase:
        (stato.w != null
          ? t(
              `${nome} è in funzione e sta tirando ${Math.round(stato.w)} W`,
              `${nome} is running and drawing ${Math.round(stato.w)} W`,
            )
          : t(`${nome} è in funzione`, `${nome} is running`)) + codaOggi,
    };
  }
  if (stato.cls === "standby") {
    return {
      tono: "bene",
      parola: t("Tutto regolare", "All good"),
      frase:
        t(
          `${nome} è in standby${stato.w != null ? ` a ${Math.round(stato.w)} W` : ""}`,
          `${nome} is on standby${stato.w != null ? ` at ${Math.round(stato.w)} W` : ""}`,
        ) + codaOggi,
    };
  }
  return {
    tono: "bene",
    parola: t("Tutto regolare", "All good"),
    frase: t(`${nome} è spento`, `${nome} is off`) + codaOggi,
  };
}

function apriStorico(event, entity, nome) {
  try {
    root.apriStorico?.(event, entity, nome);
  } catch (_errore) {}
}

function riveste(indice) {
  const lista = doc?.getElementById?.("details-list");
  const appliance = root.getAppliances?.()?.[indice];
  if (!lista || !appliance) return false;
  const { misure, pillole, comandi } = famiglie(appliance);
  const storia = racconto(appliance, misure);

  lista.replaceChildren();
  lista.dataset.dmApdeOwner = "moduli";

  const testa = doc.createElement("section");
  testa.className = "dm-apde-racconto";
  testa.dataset.dmVerdetto = storia.tono;
  testa.innerHTML = `<span class="dm-apde-verdetto">${esc(storia.parola)}</span>
    <p class="dm-apde-frase">${esc(storia.frase)}</p>`;
  lista.append(testa);

  const titoletto = (parole) => {
    const nodo = doc.createElement("h4");
    nodo.className = "dm-apde-titoletto";
    nodo.textContent = parole;
    return nodo;
  };

  if (misure.length) {
    lista.append(titoletto(t("Le misure", "The readings")));
    const griglia = doc.createElement("div");
    griglia.className = "dm-apde-caselle";
    for (const misura of misure) {
      const casella = doc.createElement("button");
      casella.type = "button";
      casella.className = "dm-apde-casella hist-clickable";
      casella.innerHTML = `<span class="dm-apde-casella-ic" aria-hidden="true">${misura.glifo}</span>
        <b>${esc(misura.valore)}</b><span>${esc(misura.nome)}</span>`;
      casella.addEventListener("click", (event) => apriStorico(event, misura.entity, misura.nome));
      griglia.append(casella);
    }
    lista.append(griglia);
  }

  if (pillole.length) {
    lista.append(titoletto(t("Lo stato", "The state")));
    const fila = doc.createElement("div");
    fila.className = "dm-apde-pillole";
    for (const pillola of pillole) {
      const nodo = doc.createElement("button");
      nodo.type = "button";
      nodo.className = "dm-apde-pillola";
      nodo.dataset.acceso = pillola.acceso ? "true" : "false";
      nodo.innerHTML = `${esc(pillola.nome)} <b>${esc(pillola.valore)}</b>`;
      nodo.addEventListener("click", (event) => apriStorico(event, pillola.entity, pillola.nome));
      fila.append(nodo);
    }
    lista.append(fila);
  }

  if (comandi.length) {
    lista.append(titoletto(t("Comandi", "Controls")));
    for (const comando of comandi) {
      const riga = doc.createElement("div");
      riga.className = "dm-apde-comando";
      riga.dataset.dmApdeEntity = comando.entity;
      const nome = doc.createElement("span");
      nome.className = "dm-apde-comando-nome";
      nome.textContent = comando.nome;
      const tasto = doc.createElement("button");
      tasto.type = "button";
      tasto.className = `dm-apde-tasto${comando.acceso ? " on" : ""}`;
      tasto.textContent = comando.azione ? "▶" : comando.acceso ? "OFF" : "ON";
      tasto.setAttribute(
        "aria-label",
        comando.azione ? `${t("Esegui", "Run")} ${comando.nome}` : comando.nome,
      );
      tasto.addEventListener("click", (event) => {
        event.stopPropagation();
        /* La strada e' quella del guscio: domain.turn_on/turn_off, che per
         * gli script e' «esegui». */
        root.cdApplEntTog?.(comando.entity, comando.azione ? null : tasto);
      });
      riga.append(nome, tasto);
      lista.append(riga);
    }
  }
  return true;
}

function aggancia() {
  const originale = root.apriApplianceDetail;
  if (typeof originale !== "function" || originale.__dmApdeVestito) return false;
  function vestito(indice, ...resto) {
    const esito = originale.call(this, indice, ...resto);
    try {
      riveste(Number(indice));
    } catch (_errore) {}
    return esito;
  }
  Object.assign(vestito, originale);
  vestito.__dmApdeVestito = true;
  vestito.__dmPrevious = originale;
  root.apriApplianceDetail = vestito;
  return true;
}

function css() {
  return `
    #details-list[data-dm-apde-owner="moduli"]{display:grid;gap:0}
    #details-list .dm-apde-racconto{
      display:grid;gap:10px;margin:0 0 16px;padding:14px 15px 13px;border-radius:16px;
      border:1px solid color-mix(in srgb,var(--dm-verdetto,#10b981) 24%,transparent);
      background:linear-gradient(160deg,
        color-mix(in srgb,var(--dm-verdetto,#10b981) 11%,var(--card-bg,#fff)),
        var(--card-bg,#fff) 72%)}
    #details-list .dm-apde-racconto[data-dm-verdetto="bene"]{--dm-verdetto:#10b981}
    #details-list .dm-apde-racconto[data-dm-verdetto="corso"]{--dm-verdetto:#f59e0b}
    #details-list .dm-apde-verdetto{
      justify-self:start;display:inline-flex;align-items:center;gap:6px;
      padding:4px 10px;border-radius:999px;font-size:10px;font-weight:900;
      letter-spacing:1.6px;text-transform:uppercase;
      background:color-mix(in srgb,var(--dm-verdetto,#10b981) 16%,transparent);
      color:color-mix(in srgb,var(--dm-verdetto,#10b981) 80%,#0f172a)}
    #details-list .dm-apde-verdetto::before{
      content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
    #details-list .dm-apde-frase{margin:0;font-size:14.5px;font-weight:700;line-height:1.45;color:var(--text,#0f172a)}
    #details-list .dm-apde-titoletto{
      margin:16px 0 8px;font-size:9.5px;font-weight:900;letter-spacing:1.7px;
      text-transform:uppercase;color:var(--text-dim,#94a3b8)}
    #details-list .dm-apde-caselle{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    #details-list .dm-apde-casella{
      display:grid;gap:2px;padding:10px 11px;border-radius:14px;text-align:left;cursor:pointer;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);color:inherit;font:inherit}
    #details-list .dm-apde-casella-ic{font-size:15px;line-height:1}
    #details-list .dm-apde-casella b{
      font-family:'Oswald',system-ui,sans-serif;font-weight:400;font-size:18px;line-height:1.1;
      color:var(--text,#0f172a);font-variant-numeric:tabular-nums;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #details-list .dm-apde-casella>span:last-child{
      font-size:8.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase;
      color:var(--text-dim,#94a3b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #details-list .dm-apde-pillole{display:flex;flex-wrap:wrap;gap:6px}
    #details-list .dm-apde-pillola{
      display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;
      font-size:10.5px;font-weight:800;cursor:pointer;font-family:inherit;
      border:1px solid var(--card-border,#e2e8f0);
      background:var(--surface-2,#f8fafc);color:var(--text-dim,#94a3b8)}
    #details-list .dm-apde-pillola::before{
      content:"";width:5px;height:5px;border-radius:50%;background:currentColor}
    #details-list .dm-apde-pillola[data-acceso="true"]{
      border-color:color-mix(in srgb,#10b981 34%,transparent);
      background:color-mix(in srgb,#10b981 12%,transparent);
      color:color-mix(in srgb,#10b981 76%,#0f172a)}
    #details-list .dm-apde-pillola b{font-weight:900;color:inherit}
    #details-list .dm-apde-comando{
      display:flex;align-items:center;justify-content:space-between;gap:10px;
      margin:0 0 8px;padding:10px 12px;border-radius:14px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    #details-list .dm-apde-comando-nome{
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:13px;font-weight:800;color:var(--text,#0f172a)}
    #details-list .dm-apde-tasto{
      flex:0 0 auto;min-width:48px;height:32px;border:0;border-radius:10px;cursor:pointer;
      font-size:12px;font-weight:900;background:rgba(14,165,233,.14);color:#0284c7}
    #details-list .dm-apde-tasto.on{background:#0ea5e9;color:#fff}
    @media(max-width:420px){#details-list .dm-apde-caselle{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
}

export function installApplianceDetailPopupSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-appliance-detail-popup-style", css());
  aggancia();
  for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(eventName, aggancia);
  }
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installApplianceDetailPopupSection, { once: true });
} else {
  installApplianceDetailPopupSection();
}
