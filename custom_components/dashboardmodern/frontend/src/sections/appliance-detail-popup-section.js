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
import { allStates, clean, doc, esc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_DETAIL_POPUP__";
const state = (root[KEY] ||= { installed: false });

const STATI_MUTI = /^(unknown|unavailable|none|)$/i;
const DOMINI_INTERRUTTORE = /^(switch|light|input_boolean|fan)\./;
const DOMINI_AZIONE = /^(script|scene|button)\./;

/* Le entita' dell'apparecchio, comprese quelle scritte nelle caselle proprie.
 *
 * La finestra leggeva soltanto la lista `entities`: chi aveva messo
 * l'interruttore nella sua casella — «Entita' comando» dell'editor, che e'
 * dove il campo si compila — non vedeva ne' la pillola acceso/spento ne' il
 * tasto. «Scompare il pulsante per comandare lo switch»: non era sparito, non
 * era mai arrivato. Le caselle proprie entrano per prime, senza doppioni. */
const CASELLE_PROPRIE = Object.freeze([
  "control_entity",
  "switch_entity",
  "switch",
  "light",
  "fan",
  "power_entity",
  "temperature_entity",
]);

function entita(appliance) {
  const viste = new Set();
  const elenco = [];
  const aggiungi = (voce) => {
    const id = clean(typeof voce === "string" ? voce : voce?.entity || voce?.entity_id);
    if (!id || !id.includes(".") || viste.has(id)) return;
    viste.add(id);
    elenco.push(id);
  };
  for (const casella of CASELLE_PROPRIE) aggiungi(appliance?.[casella]);
  for (const voce of appliance?.entities || []) aggiungi(voce);
  return elenco;
}

function nomeDi(states, entity) {
  return (
    clean(states?.[entity]?.attributes?.friendly_name) ||
    entity.split(".")[1]?.replaceAll("_", " ") ||
    entity
  );
}

/* Il glifo della casella, indovinato da entita' e unita': sono letture di
 * elettrodomestici, e nessuna porta un'icona scritta da qualche parte.
 * L'energia in kWh usciva con la batteria (🔋) addosso — «non ha senso il
 * simbolo batteria» — che qui non c'entra niente: e' consumo contato, non
 * carica. Il grafico dice quello che e': una quantita' che si accumula. */
function glifoDellaLettura(entity, unit) {
  /* L'unita' comanda: c'e' chi chiama il sensore di potenza «w_kwh_frigo»,
   * e a leggere solo il nome i watt uscirebbero vestiti da energia. */
  const unita = clean(unit).toLowerCase();
  if (unita === "w" || unita === "kw") return "⚡";
  if (unita === "kwh" || unita === "wh") return "📊";
  const token = `${entity} ${unit}`.toLowerCase();
  if (/temperatur|°/.test(token)) return "🌡️";
  if (/umidit|humidity/.test(token)) return "💧";
  if (/kwh|energy|energia/.test(token)) return "📊";
  if (/\bw\b|watt|power|potenza/.test(token)) return "⚡";
  if (/corrente|current|\ba\b/.test(token)) return "🔌";
  if (/volt|tension/.test(token)) return "🎚️";
  return "📈";
}

/* Il nome della casella, in parole.
 *
 * I sensori arrivano spesso col friendly name uguale allo slug —
 * «w_kwh_frigo», «energy_oggi_frigo» — e la casella li stampava tali e
 * quali: «si capisce poco cosi'». Una lettura pero' si riconosce da unita' e
 * indizi nel nome: qui diventa la SUA parola — Potenza, Energia oggi,
 * Energia del mese, Contatore totale — e quando due letture cadrebbero sulla
 * stessa parola la seconda tiene le sue, ripulite: underscore in spazi e il
 * nome dell'elettrodomestico tolto di mezzo, perche' in quella finestra c'e'
 * scritto gia' in cima di chi si parla. */
function nomeDellaLettura(entity, nome, unit, tokenElettrodomestico, usate) {
  const token = `${entity} ${nome} ${unit}`.toLowerCase();
  const unita = clean(unit).toLowerCase();
  /* L'unita' comanda sul nome: «w_kwh_frigo» con unita' W e' potenza, non
   * energia, per quanto il suo slug giuri il contrario. */
  const kwh = unita === "kwh" || unita === "wh" || (!unita && /kwh/.test(token));
  let parola = "";
  if (unita === "w" || unita === "kw") parola = t("Potenza", "Power");
  else if (kwh && /oggi|today|daily|giorn/.test(token)) parola = t("Energia oggi", "Energy today");
  else if (kwh && /mese|month/.test(token)) parola = t("Energia del mese", "Energy this month");
  else if (kwh && /anno|year|annual/.test(token))
    parola = t("Energia dell'anno", "Energy this year");
  else if (kwh && /total|lifetime|somma/.test(token)) parola = t("Contatore totale", "Total meter");
  else if (kwh) parola = t("Energia", "Energy");
  else if (/temperatur|°/.test(token)) parola = t("Temperatura", "Temperature");
  else if (/umidit|humidity/.test(token)) parola = t("Umidità", "Humidity");
  else if (unita === "a") parola = t("Corrente", "Current");
  else if (unita === "v") parola = t("Tensione", "Voltage");
  if (parola && !usate.has(parola)) {
    usate.add(parola);
    return parola;
  }
  /* Niente parola canonica (o gia' presa): le sue, ripulite. */
  return nomeInParole(nome, tokenElettrodomestico);
}

/* Lo slug in parole: underscore e trattini in spazi, e il nome
 * dell'elettrodomestico tolto — la finestra dice gia' in cima di chi parla. */
function nomeInParole(nome, tokenElettrodomestico) {
  const via = new Set(tokenElettrodomestico);
  const parole = clean(nome)
    .replaceAll(/[_\-.]+/g, " ")
    .split(/\s+/)
    .filter((pezzo) => pezzo && !via.has(pezzo.toLowerCase()));
  const pulito = parole.join(" ").trim();
  return pulito || clean(nome);
}

/* Le parole del nome dell'elettrodomestico, per toglierle dalle etichette. */
function tokenDi(appliance) {
  const nome = clean(root.cdApplianceDisplayName?.(appliance)) || clean(appliance?.name) || "";
  return nome.toLowerCase().split(/\s+/).filter(Boolean);
}

/* Le quattro famiglie della finestra, da un giro solo sulle entita'. */
function famiglie(appliance) {
  const states = allStates();
  const token = tokenDi(appliance);
  const usate = new Set();
  const misure = [];
  const pillole = [];
  const comandi = [];
  /* «Senza tasto Accendi/Spegni»: l'interruttore resta in lettura — la
   * pillola dice acceso o spento — ma il tasto non si offre, o il frigo
   * protetto dalla card restava spegnibile dalla sua finestra. */
  const senzaTasto = appliance?.switch_disabled === true;
  for (const entity of entita(appliance)) {
    const stato = states?.[entity];
    const grezzo = clean(stato?.state);
    const nome = nomeDi(states, entity);
    if (DOMINI_AZIONE.test(entity)) {
      comandi.push({ entity, nome: nomeInParole(nome, token), azione: true, acceso: false });
      continue;
    }
    if (DOMINI_INTERRUTTORE.test(entity)) {
      const acceso = grezzo.toLowerCase() === "on";
      const parole = nomeInParole(nome, token);
      pillole.push({
        entity,
        nome: parole,
        acceso,
        valore: acceso ? t("Acceso", "On") : t("Spento", "Off"),
      });
      if (!senzaTasto) comandi.push({ entity, nome: parole, azione: false, acceso });
      continue;
    }
    if (STATI_MUTI.test(grezzo)) continue;
    const numero = Number.parseFloat(grezzo.replace(",", "."));
    if (Number.isFinite(numero)) {
      const unit = clean(stato?.attributes?.unit_of_measurement);
      misure.push({
        entity,
        nome: nomeDellaLettura(entity, nome, unit, token, usate),
        glifo: glifoDellaLettura(entity, unit),
        valore: `${grezzo}${unit ? ` ${unit}` : ""}`,
      });
      continue;
    }
    const acceso = /^(on|open|aperto|running|cleaning|heat|cool)$/i.test(grezzo);
    pillole.push({ entity, nome: nomeInParole(nome, token), acceso, valore: grezzo });
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
  const codaOggi = oggi
    ? t(`; oggi ha fatto ${oggi.valore}.`, `; today it did ${oggi.valore}.`)
    : ".";
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
