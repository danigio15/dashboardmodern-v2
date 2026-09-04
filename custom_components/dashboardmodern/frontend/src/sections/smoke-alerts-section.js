/* Il fumo, accanto agli altri avvisi — e le aperture che arrivano dopo (#238).
 *
 * Chi monta un rilevatore di fumo non deve configurarlo: e' un `binary_sensor`
 * che Home Assistant dichiara `device_class: smoke`, e chiederlo a mano quando
 * lo si sa gia' sarebbe solo lavoro in piu'. Qui il fumo diventa una lista
 * sorvegliata come le altre — la sua voce nella configurazione, le sue righe
 * con il cestino — e in piu' un blocco nella pagina Sicurezza, fra le Aperture
 * e le Telecamere, che dice sensore per sensore se l'aria e' pulita.
 *
 * A differenza dell'allagamento, il rilevamento non si ferma al primo avvio:
 * e' CONTINUO. Un rilevatore montato il mese prossimo entra da solo, perche'
 * il registro dei gia' visti (`cd_fumo_rilevato`) non e' un interruttore ma un
 * elenco: si confronta cio' che c'e' in casa con cio' che si e' gia' visto, e
 * solo il nuovo si aggiunge. Chi toglie un sensore lo ritrova tolto — il
 * registro se lo ricorda — ed e' la stessa regola delle altre liste.
 */
import {
  activeLocale,
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  onEditorRedraw,
  readJson,
  root,
  scriviSeCambia,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SMOKE_ALERTS__";
const STYLE_ID = "dm-smoke-alerts-style";
const state = (root[KEY] ||= { installed: false, frame: 0, deleteBound: false, signature: "" });

/** La chiave del gruppo: la stessa nel quadro, nell'editor e nella configurazione. */
export const SMOKE_GROUP = "fumo";
export const SMOKE_ICON = "💨";

/* Le classi che questo rilevamento riconosce. Il numero 238 chiedeva il
 * fumo; dal campo poi e' arrivato il resto della famiglia — «rilevatori
 * fumo/gas in config sicurezza» — e Home Assistant li dichiara tutti con lo
 * stesso vocabolario: `gas` e il monossido (`carbon_monoxide`) entrano
 * nella stessa lista sorvegliata, stesso registro, stesso blocco. */
export const SMOKE_DEVICE_CLASSES = Object.freeze(["smoke", "gas", "carbon_monoxide"]);

/* Il registro dei gia' visti. Non e' l'interruttore «ho gia' guardato» degli
 * allagamenti: e' l'elenco dei sensori incontrati almeno una volta, perche'
 * il rilevamento continuo deve distinguere «nuovo» da «tolto apposta». La
 * chiave viaggia con la configurazione (revisione 13), cosi' un sensore visto
 * sul telefono non si ripropone sul tablet. */
export const SMOKE_SEEN_KEY = "cd_fumo_rilevato";

const smokeName = () => t("Rilevatori fumo e gas", "Smoke & gas detectors");

/** Un rilevatore di fumo, come lo dichiara Home Assistant. */
export function isSmokeSensor(entityId, stato) {
  if (!clean(entityId).startsWith("binary_sensor.")) return false;
  return SMOKE_DEVICE_CLASSES.includes(clean(stato?.attributes?.device_class).toLowerCase());
}

/** In allarme o tranquillo: `on` e' fumo rilevato, come per ogni binary_sensor. */
export const smokeIsAlarm = (stato) => clean(stato?.state).toLowerCase() === "on";

/** Quanti stanno suonando adesso. */
export function countAlarmed(entities = [], states = {}) {
  return entities.reduce((numero, id) => numero + (smokeIsAlarm(states[id]) ? 1 : 0), 0);
}

/**
 * Le entita' del gruppo e cosa c'e' di nuovo da segnare.
 *
 * `dichiarate` e' la lista dell'utente (`cd_gruppi_extra.fumo`); `daSegnare`
 * sono i sensori mai visti prima, che vanno nel registro comunque vada;
 * `nuovi` sono quelli fra loro che entrano davvero nel gruppo — non tolti
 * dall'utente e non gia' dichiarati. La funzione e' pura: legge e non scrive,
 * cosi' si prova a tavolino.
 */
export function smokeEntities(extras = {}, removed = {}, states = {}, visti = []) {
  const tolte = new Set((removed[SMOKE_GROUP] || []).map(clean).filter(Boolean));
  const giaVisti = new Set((Array.isArray(visti) ? visti : []).map(clean).filter(Boolean));
  const dichiarate = Array.isArray(extras[SMOKE_GROUP])
    ? extras[SMOKE_GROUP].map(clean).filter(Boolean)
    : [];
  const daSegnare = Object.entries(states)
    .filter(([id, stato]) => isSmokeSensor(id, stato))
    .map(([id]) => clean(id))
    .filter((id) => id && !giaVisti.has(id));
  const nuovi = daSegnare.filter((id) => !tolte.has(id) && !dichiarate.includes(id));
  const viste = new Set();
  const entities = [];
  for (const id of [...dichiarate, ...nuovi]) {
    if (!id || tolte.has(id) || viste.has(id)) continue;
    viste.add(id);
    entities.push(id);
  }
  return { entities, nuovi, daSegnare };
}

/* Le liste sorvegliate del runtime: una `const` nell'ambiente lessicale della
 * pagina, la stessa strada dell'allagamento. */
function watchedGroups() {
  const groups = lexicalGlobal("GRUPPI_MONITORAGGIO");
  return groups && typeof groups === "object" ? groups : null;
}

/* Rilevare e leggere restano due mestieri diversi, come per l'allagamento: la
 * lettura capita a ogni ridisegno e non deve scrivere niente; il rilevamento
 * scrive, ma solo nei giri che lo chiedono (`rileva: true`). Qui pero' non c'e'
 * la trappola del «segnato prima che gli stati arrivino»: il registro cresce
 * solo di sensori realmente visti, e con gli stati ancora vuoti non c'e'
 * niente da vedere ne' da segnare. */
/** Allinea la lista del runtime e, nei giri di rilevamento, il registro. */
export function syncSmokeGroup({ rileva = false } = {}) {
  const groups = watchedGroups();
  if (!groups) return null;
  const extras = readJson("cd_gruppi_extra", {}) || {};
  const removed = readJson("cd_gruppi_removed", {}) || {};
  const visti = readJson(SMOKE_SEEN_KEY, []) || [];
  const states = allStates();
  const { entities, nuovi, daSegnare } = smokeEntities(extras, removed, states, visti);
  if (rileva && daSegnare.length) {
    if (nuovi.length) {
      const lista = Array.isArray(extras[SMOKE_GROUP])
        ? extras[SMOKE_GROUP].map(clean).filter(Boolean)
        : [];
      writeJsonIfChanged(
        "cd_gruppi_extra",
        { ...extras, [SMOKE_GROUP]: [...new Set([...lista, ...nuovi])] },
        { sync: false },
      );
    }
    const registro = (Array.isArray(visti) ? visti : []).map(clean).filter(Boolean);
    writeJsonIfChanged(SMOKE_SEEN_KEY, [...new Set([...registro, ...daSegnare])], { sync: false });
  }
  groups[SMOKE_GROUP] = entities;
  return entities;
}

/* Le aperture che arrivavano dopo non arrivano piu'.
 *
 * Qui c'era il gemello del rilevamento del fumo: porte e finestre scoperte
 * dopo il primo avvio entravano da sole nel gruppo `win`, che alimentava la
 * tessera d'avviso Porte/Finestre. Quella tessera non c'e' piu' — «viene gia'
 * gestito da Finestre, se li si mette il sensore finestra dice quale e'
 * aperto, quindi e' un duplicato» — e riempire una lista che nessuno legge
 * costava un giro del documento a ogni cambio di stato, per niente.
 *
 * Il rilevamento del fumo resta: quello una tessera ce l'ha, e una pagina. */

/* ── la voce nella configurazione ────────────────────────────────────────── */

/* I due elenchi a tendina del runtime — procedura guidata ed editor — sono
 * stampati con le loro voci di serie: la voce del fumo si aggiunge, come fa
 * l'allagamento con la sua. Chi salva scrive nella casella del gruppo che gli
 * arriva, quindi la voce basta. */
function ensureGroupOption(select) {
  if (!select || select.querySelector(`option[value="${SMOKE_GROUP}"]`)) return false;
  const option = doc.createElement("option");
  option.value = SMOKE_GROUP;
  option.textContent = `${SMOKE_ICON} ${smokeName()}`;
  const custom = select.querySelector('option[value="custom"]');
  if (custom) custom.before(option);
  else select.append(option);
  return true;
}

function ensureGroupOptions() {
  let aggiunte = 0;
  for (const id of ["wz-av-grp", "ed-avv-grp"]) {
    if (ensureGroupOption(doc?.getElementById(id))) aggiunte += 1;
  }
  return aggiunte;
}

/* Le righe nella configurazione: la fisarmonica del fumo dopo le altre, con le
 * stesse classi e lo stesso cestino del runtime — `edDelAvviso`, che sa gia'
 * distinguere una voce aggiunta da una arrivata da sola. */
function ensureSmokeEditorRows() {
  const body = doc?.getElementById("ed-body");
  // La scheda degli avvisi si riconosce dal suo elenco a tendina dei gruppi.
  if (!body || !doc.getElementById("ed-avv-grp")) return false;
  const entities = syncSmokeGroup() || [];
  const esistente = body.querySelector("[data-dm-smoke-acc]");
  if (!entities.length) {
    esistente?.remove();
    return false;
  }
  const nomi = readJson("cd_avvisi_names_extra", {}) || {};
  const states = allStates();
  const acc = esistente || doc.createElement("details");
  if (!esistente) {
    acc.className = "ed-acc";
    acc.dataset.dmSmokeAcc = "true";
    /* Dopo l'ultima fisarmonica che c'e' gia' — comprese quelle degli
     * allagamenti — cosi' l'ordine delle voci e' quello delle tendine. */
    const gruppi = [...body.querySelectorAll("details.ed-acc")].filter(
      (nodo) => !nodo.dataset.dmSmokeAcc,
    );
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo) ultimo.after(acc);
    else body.append(acc);
  }
  const righe = entities
    .map((id) => {
      const nome = nomeDelRilevatore(id, nomi, states);
      return (
        `<div class="ed-row" data-dm-smoke-row="${esc(id)}">` +
        `<div class="ed-row-main"><div class="ed-row-new">${esc(nome)}</div>` +
        `<div class="ed-row-old mono">${esc(id)}</div></div>` +
        `<div class="ed-del" data-dm-smoke-del="${esc(id)}">🗑️</div></div>`
      );
    })
    .join("");
  const markup =
    `<summary class="ed-acc-head">${SMOKE_ICON} ${esc(smokeName())} ` +
    `<span class="ed-acc-n">${entities.length}</span></summary>` +
    `<div class="ed-acc-body"><div class="ed-list">${righe}</div></div>`;
  scriviSeCambia(acc, markup);
  return true;
}

function installSmokeDeleteHandler() {
  if (state.deleteBound) return false;
  state.deleteBound = true;
  doc?.addEventListener("click", (event) => {
    const cestino = event.target?.closest?.("[data-dm-smoke-del]");
    if (!cestino) return;
    event.preventDefault();
    event.stopPropagation();
    const id = clean(cestino.dataset.dmSmokeDel);
    if (!id) return;
    root.edDelAvviso?.(SMOKE_GROUP, id);
    syncSmokeGroup();
    root.editorSwitch?.("avvisi");
    root.setTimeout?.(ensureSmokeEditorRows, 0);
    root.setTimeout?.(schedule, 0);
  });
  return true;
}

/* ── il blocco nella pagina Sicurezza ────────────────────────────────────── */

function smokeStateLabel(stato) {
  if (smokeIsAlarm(stato)) return t("FUMO RILEVATO", "SMOKE DETECTED");
  const raw = clean(stato?.state).toLowerCase();
  if (!raw || raw === "unavailable" || raw === "unknown")
    return t("Non disponibile", "Unavailable");
  return t("Aria pulita", "Air clear");
}

function smokeRowMarkup(id, nome) {
  return `<div class="dm-smoke-row" data-dm-smoke="${esc(id)}">
      <span class="dm-smoke-ic" aria-hidden="true">${SMOKE_ICON}</span>
      <span class="dm-smoke-copy">
        <strong class="dm-smoke-name">${esc(nome)}</strong>
        <span class="dm-smoke-state" data-dm-smoke-state></span>
      </span>
    </div>`;
}

/* Come si chiama un rilevatore.
 *
 * Il nome scelto se c'e', altrimenti quello che dice Home Assistant. E se non
 * lo dice — capita: un'entita' senza nome suo e senza dispositivo — si legge
 * l'ultima parte dell'identificativo, come fa la stessa Home Assistant:
 * «binary_sensor.salotto_fumo» diventa «Salotto fumo». Prima al suo posto
 * finiva l'identificativo intero, stampato a lettere maiuscole in mezzo alla
 * card: «BINARY_SENSOR.S…». */
export function nomeDelRilevatore(id, nomi = {}, states = {}) {
  const scelto = clean(nomi[id]);
  if (scelto) return scelto;
  const daCasa = clean(states[id]?.attributes?.friendly_name);
  if (daCasa) return daCasa;
  const coda = clean(id).split(".").slice(1).join(".").replaceAll("_", " ").trim();
  if (!coda) return clean(id);
  return coda.charAt(0).toUpperCase() + coda.slice(1);
}

function blockMarkup(entities, nomi, states) {
  const righe = entities
    .map((id) => smokeRowMarkup(id, nomeDelRilevatore(id, nomi, states)))
    .join("");
  return `<div class="dm-sec-smoke-head">
      <span class="dm-sec-smoke-ic" aria-hidden="true">${SMOKE_ICON}</span>
      <h3>${esc(smokeName())}</h3>
      <span class="dm-sec-smoke-hint" data-dm-smoke-hint></span>
    </div>
    <div class="dm-smoke-grid">${righe}</div>`;
}

/* Il posto del blocco: fra le Aperture e le Telecamere. Le Aperture si
 * mettono davanti alle Telecamere per conto loro, quindi «subito prima delle
 * Telecamere» e' sempre «dopo le Aperture» — e se le Aperture arrivano dopo
 * di noi, la passata successiva ci rimette al nostro posto. */
function ensureBlock(shell) {
  let block = shell.querySelector(":scope > .dm-sec-smoke");
  const cctv = shell.querySelector(":scope > .dm-sec-cctv");
  if (!block) {
    block = doc.createElement("section");
    block.className = "dm-sec-smoke";
    if (cctv) shell.insertBefore(block, cctv);
    else shell.append(block);
  } else if (cctv && block.nextElementSibling !== cctv) {
    shell.insertBefore(block, cctv);
  }
  return block;
}

export function renderSmokeBlock() {
  const shell = doc?.querySelector?.("#page-security .dm-sec-shell");
  if (!shell) return false;
  const entities = syncSmokeGroup() || [];
  if (!entities.length) {
    shell.querySelector(":scope > .dm-sec-smoke")?.remove();
    state.signature = "";
    return true;
  }
  const nomi = readJson("cd_avvisi_names_extra", {}) || {};
  const states = allStates();
  const block = ensureBlock(shell);
  /* La firma e' il blocco disegnato.
   *
   * Era l'elenco delle entita' col nome scelto — e il nome che si vede non e'
   * quello: quando manca lo dice Home Assistant, e all'avvio Home Assistant
   * non ha ancora detto niente. Il blocco nasceva con l'identificativo al
   * posto del nome, gli stati arrivavano un istante dopo, la firma non
   * cambiava di una virgola e quell'identificativo restava li' per sempre.
   * Confrontando il disegno il caso non esiste piu': se il nome cambia,
   * cambia il disegno. */
  const disegno = blockMarkup(entities, nomi, states);
  const signature = `${activeLocale()}|${disegno}`;
  if (state.signature !== signature || !block.querySelector(".dm-smoke-grid")) {
    state.signature = signature;
    block.innerHTML = disegno;
  }
  /* Gli stati si scrivono sulle righe che ci sono gia', come per le porte:
   * l'allarme e' rosso nativo, senza rifare il blocco a ogni cambio. */
  let allarmi = 0;
  for (const id of entities) {
    const row = block.querySelector(`[data-dm-smoke="${CSS.escape(id)}"]`);
    const label = row?.querySelector("[data-dm-smoke-state]");
    if (!label) continue;
    const inAllarme = smokeIsAlarm(states[id]);
    if (inAllarme) allarmi += 1;
    const testo = smokeStateLabel(states[id]);
    if (label.textContent !== testo) label.textContent = testo;
    row.classList.toggle("is-alarm", inAllarme);
  }
  const hint = block.querySelector("[data-dm-smoke-hint]");
  if (hint) {
    const testo = allarmi
      ? t(`${allarmi} in allarme`, `${allarmi} alarming`)
      : t("Tutto tranquillo", "All quiet");
    if (hint.textContent !== testo) hint.textContent = testo;
    hint.classList.toggle("is-alarm", allarmi > 0);
  }
  return true;
}

function installStyles() {
  installStyle(
    STYLE_ID,
    `
.dm-sec-smoke{display:flex;flex-direction:column;gap:12px}
.dm-sec-smoke-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 4px}
.dm-sec-smoke-ic{font-size:20px}
.dm-sec-smoke-head h3{
  margin:0;font-family:'Oswald',sans-serif;font-weight:700;font-size:17px;
  letter-spacing:2.2px;text-transform:uppercase}
.dm-sec-smoke-hint{font-size:11.5px;font-weight:600;color:var(--dm-sec-dim,#64748b)}
.dm-sec-smoke-hint.is-alarm{color:var(--error-color,#dc2626)}
.dm-smoke-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.dm-smoke-row{
  display:flex;align-items:center;gap:12px;padding:14px 16px;min-height:64px;
  border:1px solid var(--dm-sec-border,var(--card-border,#e8edf3));border-radius:18px;
  background:var(--dm-sec-card,var(--card-bg,#fff));color:var(--dm-sec-text,var(--text,#0f172a));
  box-shadow:0 10px 26px rgba(15,23,42,.07);
  transition:border-color .25s ease,box-shadow .25s ease}
.dm-smoke-ic{
  width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;font-size:22px;
  border-radius:13px;background:var(--surface-3,#f1f5f9);
  box-shadow:inset 0 0 0 1px var(--dm-sec-border,#e8edf3)}
.dm-smoke-copy{min-width:0;flex:1;display:grid;gap:2px}
.dm-smoke-name{
  font-size:13px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-smoke-state{font-size:11.5px;font-weight:600;color:var(--dm-sec-dim,#64748b)}
.dm-smoke-row.is-alarm{
  border-color:var(--error-color,#dc2626);
  background:color-mix(in srgb,var(--error-color,#dc2626) 9%,var(--dm-sec-card,var(--card-bg,#fff)));
  box-shadow:0 10px 26px rgba(220,38,38,.18)}
.dm-smoke-row.is-alarm .dm-smoke-state{color:var(--error-color,#dc2626);font-weight:800}
.dm-smoke-row.is-alarm .dm-smoke-ic{animation:dmSmokePulse 1.1s ease-in-out infinite}
@keyframes dmSmokePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
`,
  );
}

/* ── il giro che guarda ──────────────────────────────────────────────────── */

export function refreshSmokeAlerts({ rileva = false } = {}) {
  installSmokeDeleteHandler();
  ensureGroupOptions();
  if (rileva) {
    syncSmokeGroup({ rileva: true });
  }
  ensureSmokeEditorRows();
  return renderSmokeBlock();
}

/* L'avvio, e ogni volta che gli stati arrivano o cambiano: il rilevamento e'
 * continuo, quindi ogni passata di questo giro confronta col registro. La
 * navigazione dell'editor invece legge e basta. */
const rilevaEDisegna = () => refreshSmokeAlerts({ rileva: true });

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    try {
      rilevaEDisegna();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] smoke alerts", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

export function installSmokeAlertsSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* Chi ridisegna il pannello di configurazione e' `editorSwitch`: e' la
   * stessa maniglia degli avvisi e degli allagamenti. */
  onEditorRedraw("__dmSmokeAlerts", refreshSmokeAlerts);
  /* Ma la scheda degli avvisi non vive piu' in una linguetta sua: e' ospite di
   * quella dei widget, che la stampa chiedendo il disegno a
   * `editorRenderAvvisi` e poi lo posa nel corpo. Quel giro non passa da
   * `editorSwitch` ne' annuncia un evento: l'unico segno onesto che la scheda
   * sta per esserci e' la chiamata stessa, e ci si aggancia li' — la passata
   * parte a disegno posato, perche' il gancio corre dietro al risultato. */
  const agganciaAvvisi = () => wrapFunction("editorRenderAvvisi", "__dmSmokeAlerts", schedule);
  agganciaAvvisi();
  /* La vetrina della Sicurezza rifa' lo scheletro a ogni suo render: il blocco
   * si rimette al suo posto agganciandosi allo stesso `renderSecurity`. */
  const agganciaRender = () => {
    wrapFunction("renderSecurity", "__dmSmokeAlerts", schedule);
    agganciaAvvisi();
  };
  agganciaRender();
  rilevaEDisegna();
  for (const eventName of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    "pageshow",
  ]) {
    root.addEventListener?.(eventName, () => {
      agganciaRender();
      schedule();
    });
  }
  /* I cambi di stato sono il battito del rilevamento continuo: si guarda
   * sempre — un sensore nuovo si annuncia proprio cosi' — ma senza fretta,
   * dentro lo stesso giro raggruppato dal frame. */
  root.addEventListener?.("dashboardmodern:state-changed", schedule);
  /* Aprire la configurazione ridisegna le tendine: la voce va rimessa, o
   * sparisce appena si cambia scheda. E il tocco sulla linguetta della
   * Sicurezza ridisegna il blocco appena la pagina e' in scena. */
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.(".ed-tab,.ed-acc-head,[data-tab],[data-page]")) {
        root.setTimeout?.(schedule, 0);
      }
    },
    true,
  );
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installSmokeAlertsSection, { once: true });
else installSmokeAlertsSection();
