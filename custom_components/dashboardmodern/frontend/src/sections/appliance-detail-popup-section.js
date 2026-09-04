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
import { deviceEntityGroups } from "../core/appliance-device-binding.js";
import { entitaDelDispositivo } from "./appliance-integration-section.js";
import {
  activeLocale,
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_DETAIL_POPUP__";
const state = (root[KEY] ||= { installed: false, aperto: null });

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
  const tutte = clean(nome)
    .replaceAll(/[_\-.]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const pulito = tutte
    .filter((pezzo) => !via.has(pezzo.toLowerCase()))
    .join(" ")
    .trim();
  if (pulito) return pulito;
  /* Non e' rimasto niente perche' l'entita' si chiama come l'apparecchio: e'
   * l'interruttore principale, quello che hOn e Home Connect battezzano col
   * nome della macchina. Home Assistant ci mette davanti anche il nome del
   * dispositivo, e la finestra scriveva «Lavatrice Lavatrice». Si dice una
   * volta sola. */
  const senzaDoppioni = tutte.filter(
    (pezzo, i) => i === 0 || pezzo.toLowerCase() !== tutte[i - 1].toLowerCase(),
  );
  return senzaDoppioni.join(" ") || clean(nome);
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
  state.aperto = indice;
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
  try {
    vesteIntegrazione(lista, appliance, entita(appliance), titoletto);
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] dettaglio integrazione", errore);
  }
  return true;
}

/* Tutte le entita' del dispositivo, per chi arriva da un'integrazione.
 *
 * «Ogni elettrodomestico avra' sicuramente tutte le sue informazioni.» La
 * parte curata qui sopra legge le caselle della card; questa legge il
 * dispositivo intero — dal catalogo se e' gia' arrivato, altrimenti dalla
 * memoria presa al momento del collegamento — e lo divide in quattro: lo
 * stato, le letture, i comandi con i loro tasti veri (interruttori, menu,
 * numeri, pulsanti) e in fondo la diagnostica, chiusa, perche' la potenza
 * del Wi-Fi non e' una notizia sulla lavatrice. Quello che la parte curata
 * mostra gia' non si ripete. */
function comanda(payload) {
  return chiediAHomeAssistant({ type: "call_service", ...payload }).catch((error) =>
    root.console?.warn?.("[DashboardModern] comando integrazione", error),
  );
}

function tastoDelComando(voce) {
  const controllo = voce.control;
  if (!controllo) return null;
  const [domain] = voce.entity.split(".");
  if (controllo.kind === "select") {
    const menu = doc.createElement("select");
    menu.className = "dm-apde-menu";
    menu.setAttribute("aria-label", voce.name);
    for (const opzione of controllo.options) {
      const riga = doc.createElement("option");
      riga.value = opzione;
      riga.textContent = opzione.replaceAll("_", " ");
      riga.selected = opzione === controllo.current;
      menu.append(riga);
    }
    menu.addEventListener("change", () =>
      comanda({
        domain: "select",
        service: "select_option",
        target: { entity_id: voce.entity },
        service_data: { option: menu.value },
      }),
    );
    return menu;
  }
  if (controllo.kind === "number") {
    const campo = doc.createElement("input");
    campo.type = "number";
    campo.className = "dm-apde-numero";
    campo.setAttribute("aria-label", voce.name);
    if (controllo.min != null) campo.min = controllo.min;
    if (controllo.max != null) campo.max = controllo.max;
    if (controllo.step != null) campo.step = controllo.step;
    campo.value = controllo.current;
    campo.addEventListener("change", () => {
      const valore = Number(campo.value);
      if (!Number.isFinite(valore)) return;
      comanda({
        domain: "number",
        service: "set_value",
        target: { entity_id: voce.entity },
        service_data: { value: valore },
      });
    });
    return campo;
  }
  const tasto = doc.createElement("button");
  tasto.type = "button";
  if (controllo.kind === "press") {
    tasto.className = "dm-apde-tasto";
    tasto.textContent = "▶";
    tasto.setAttribute("aria-label", `${t("Esegui", "Run")} ${voce.name}`);
    tasto.addEventListener("click", (event) => {
      event.stopPropagation();
      comanda({ domain, service: "press", target: { entity_id: voce.entity } });
    });
    return tasto;
  }
  tasto.className = `dm-apde-tasto${controllo.on ? " on" : ""}`;
  tasto.textContent = controllo.on ? "OFF" : "ON";
  tasto.setAttribute("aria-label", voce.name);
  tasto.addEventListener("click", (event) => {
    event.stopPropagation();
    root.cdApplEntTog?.(voce.entity, tasto);
  });
  return tasto;
}

function vesteIntegrazione(lista, appliance, giaMostrate, titoletto) {
  const deviceId = clean(appliance?.device_id);
  const memoria = Array.isArray(appliance?.device_entities) ? appliance.device_entities : [];
  if (!deviceId && !memoria.length) return;
  const catalogo = deviceId ? entitaDelDispositivo(deviceId) : null;
  const records = catalogo || memoria.map((entity_id) => ({ entity_id: clean(entity_id) }));
  const gruppi = deviceEntityGroups(records, allStates(), {
    mapped: giaMostrate,
    locale: activeLocale(),
    readOnly: false,
  });
  const nuove = (voci) => voci.filter((voce) => !voce.mapped);
  const stato = nuove(gruppi.state);
  const letture = nuove(gruppi.readings);
  const comandi = gruppi.controls.filter((voce) => !voce.mapped || voce.control?.kind !== "toggle");
  const diagnostica = gruppi.diagnostics;
  if (!stato.length && !letture.length && !comandi.length && !diagnostica.length) return;

  const testa = doc.createElement("section");
  testa.className = "dm-apde-integrazione";
  testa.dataset.dmApdeSource = catalogo ? "catalogo" : "memoria";
  const nome = clean(appliance.integration_name) || clean(appliance.integration);
  const chi = [appliance.device_manufacturer, appliance.device_model]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  testa.innerHTML = `<strong>🔗 ${esc(t("Dall'integrazione", "From the integration"))}${nome ? ` ${esc(nome)}` : ""}</strong>${chi ? `<span>${esc(chi)}</span>` : ""}`;
  lista.append(testa);

  if (stato.length) {
    lista.append(titoletto(t("Lo stato del dispositivo", "The device state")));
    const fila = doc.createElement("div");
    fila.className = "dm-apde-pillole";
    for (const voce of stato) {
      const nodo = doc.createElement("button");
      nodo.type = "button";
      nodo.className = "dm-apde-pillola";
      nodo.dataset.acceso = voce.on ? "true" : "false";
      nodo.dataset.dmApdeEntity = voce.entity;
      nodo.innerHTML = `${esc(voce.name)} <b>${esc(voce.value)}</b>`;
      nodo.addEventListener("click", (event) => apriStorico(event, voce.entity, voce.name));
      fila.append(nodo);
    }
    lista.append(fila);
  }
  if (letture.length) {
    lista.append(titoletto(t("Le letture del dispositivo", "The device readings")));
    const griglia = doc.createElement("div");
    griglia.className = "dm-apde-caselle";
    for (const voce of letture) {
      const casella = doc.createElement("button");
      casella.type = "button";
      casella.className = "dm-apde-casella hist-clickable";
      casella.dataset.dmApdeEntity = voce.entity;
      casella.innerHTML = `<span class="dm-apde-casella-ic" aria-hidden="true">📈</span><b>${esc(voce.value)}</b><span>${esc(voce.name)}</span>`;
      casella.addEventListener("click", (event) => apriStorico(event, voce.entity, voce.name));
      griglia.append(casella);
    }
    lista.append(griglia);
  }
  const rigaDiComando = (voce) => {
    const riga = doc.createElement("div");
    riga.className = "dm-apde-comando";
    riga.dataset.dmApdeEntity = voce.entity;
    const etichetta = doc.createElement("span");
    etichetta.className = "dm-apde-comando-nome";
    etichetta.textContent = voce.name;
    riga.append(etichetta);
    const tasto = tastoDelComando(voce);
    if (tasto) riga.append(tasto);
    return riga;
  };
  if (comandi.length) {
    lista.append(titoletto(t("I comandi del dispositivo", "The device controls")));
    for (const voce of comandi) lista.append(rigaDiComando(voce));
  }
  if (diagnostica.length) {
    const cassetto = doc.createElement("details");
    cassetto.className = "dm-apde-diagnostica";
    const sommario = doc.createElement("summary");
    sommario.textContent = `${t("Diagnostica", "Diagnostics")} · ${diagnostica.length}`;
    cassetto.append(sommario);
    for (const voce of diagnostica) {
      if (voce.control) {
        cassetto.append(rigaDiComando(voce));
        continue;
      }
      const riga = doc.createElement("button");
      riga.type = "button";
      riga.className = "dm-apde-pillola";
      riga.dataset.acceso = voce.on ? "true" : "false";
      riga.dataset.dmApdeEntity = voce.entity;
      riga.innerHTML = `${esc(voce.name)} <b>${esc(voce.value)}</b>`;
      riga.addEventListener("click", (event) => apriStorico(event, voce.entity, voce.name));
      cassetto.append(riga);
    }
    lista.append(cassetto);
  }
}

/* Il catalogo arriva dopo la finestra: se e' ancora aperta, si riveste. */
function alCatalogo() {
  if (state.aperto == null) return;
  const modal = doc?.getElementById?.("details-modal");
  if (!modal?.classList?.contains("show")) return;
  try {
    riveste(state.aperto);
  } catch (_errore) {}
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
    #details-list .dm-apde-integrazione{
      display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:18px 0 2px;
      padding:10px 12px;border-radius:14px;
      border:1px solid color-mix(in srgb,#0ea5e9 30%,transparent);
      background:color-mix(in srgb,#0ea5e9 7%,transparent)}
    #details-list .dm-apde-integrazione strong{font-size:12.5px;font-weight:900;color:#0369a1}
    #details-list .dm-apde-integrazione span{font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8)}
    #details-list .dm-apde-menu,#details-list .dm-apde-numero{
      flex:0 1 55%;min-width:0;max-width:220px;height:32px;padding:0 8px;border-radius:10px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc);
      color:var(--text,#0f172a);font:inherit;font-size:12px;font-weight:700}
    #details-list .dm-apde-numero{flex-basis:96px;text-align:right;font-variant-numeric:tabular-nums}
    #details-list .dm-apde-diagnostica{
      margin:14px 0 0;padding:0 12px 6px;border-radius:14px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc)}
    #details-list .dm-apde-diagnostica>summary{
      padding:10px 0;cursor:pointer;list-style:none;font-size:9.5px;font-weight:900;
      letter-spacing:1.7px;text-transform:uppercase;color:var(--text-dim,#94a3b8)}
    #details-list .dm-apde-diagnostica>summary::-webkit-details-marker{display:none}
    #details-list .dm-apde-diagnostica>.dm-apde-pillola{margin:0 6px 6px 0}
    #details-list .dm-apde-diagnostica>.dm-apde-comando{margin:0 0 6px}
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
  root.addEventListener?.("dashboardmodern:integrations-catalog", alCatalogo);
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installApplianceDetailPopupSection, { once: true });
} else {
  installApplianceDetailPopupSection();
}
