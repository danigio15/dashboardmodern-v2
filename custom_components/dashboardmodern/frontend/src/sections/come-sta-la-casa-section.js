/* La riga sotto il meteo, e la posta che arriva (#356, #357).
 *
 * «Una barra sotto la parte meteo che mostra le indicazioni principali. Icona
 * + organico. Lampadina con luci accese. Tapparella con tapparelle aperte
 * ecc.» (#356)
 *
 * «Animazione quando arriva Posta attivato da un sensore contact.» (#357)
 *
 * Sono due richieste della stessa persona e sono la stessa cosa: una fila di
 * pastiglie sotto il meteo che dice quello che conta adesso. Il ritiro di
 * stasera, le luci rimaste accese, le finestre aperte — e la posta, che e' la
 * sola voce con un'animazione, perche' e' la sola che annuncia un fatto
 * appena successo invece di descrivere come sta la casa.
 *
 * Qui non si contano entita': i conti li ha gia' fatti la griglia delle
 * tessere, e arrivano da la' col giro di disegno che li ha appena prodotti
 * (`renderHomeWidgets` chiama `disegnaComeStaLaCasa`). Quali pastiglie
 * escono lo decide il nucleo, che si prova senza un documento; qui si
 * scrivono le parole, si disegna, e si tiene la memoria della cassetta.
 *
 * Il posto e' subito sotto il meteo e SOPRA le pastiglie di stato del guscio:
 * quelle sono il punto da cui l'ordine dei blocchi (`home-blocchi-section`)
 * riparte a impaginare la Home, e una riga infilata sotto di loro finirebbe
 * spinta in fondo alla pagina al primo riordino.
 */
import {
  VOCI_DELLA_BARRA,
  normalizzaBarra,
  passoDellaPosta,
  pastiglieDellaCasa,
  postaRitirata,
} from "../core/come-sta-la-casa.js";
import { windowOpenFromState } from "../core/shutter-window.js";
import { CHIAVE_VERSI, apertaSecondoVerso, insiemeInvertiti } from "../core/verso-aperture.js";
import { parolaDelQuando } from "./rifiuti-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_COME_STA_LA_CASA__";
const state = (root[KEY] ||= { installed: false, firma: "" });

/** Quali voci si vedono, e da quale contatto arriva la posta. */
export const CHIAVE_BARRA = "cd_barra_casa";

/* Cosa sa questo dispositivo della cassetta: com'era l'ultima volta che l'ha
 * guardata, quando e' arrivata la posta e quando qualcuno l'ha ritirata.
 *
 * Non viaggia con la configurazione, ed e' voluto due volte. Lo scatto di
 * prima e' quello che permette di accorgersi di un'apertura avvenuta mentre
 * non si guardava: se fosse condiviso, il tablet acceso in cucina se ne
 * accorgerebbe per primo, aggiornerebbe lo scatto per tutti, e il telefono
 * ripreso in mano dopo non avrebbe piu' niente da confrontare. E il «vista»
 * e' di chi guarda: chi ritira la posta la ritira, chi non l'ha ancora vista
 * deve poterla vedere. */
const CHIAVE_POSTA = "cd_posta_stato";

/* ── le letture ─────────────────────────────────────────────────────────── */

function configurazione() {
  return normalizzaBarra(readJson(CHIAVE_BARRA, {}));
}

function memoriaDellaPosta() {
  const dato = readJson(CHIAVE_POSTA, {});
  return dato && typeof dato === "object" && !Array.isArray(dato) ? dato : {};
}

/* Il contatto della cassetta com'e' adesso.
 *
 * Il verso lo dice la stessa casella che lo dice a tutte le altre aperture
 * (#244): ci sono contatti che stanno a ON quando sono CHIUSI, e chi ne ha
 * uno l'ha gia' dichiarato una volta per tutta la plancia. */
function letturaDellaCassetta(entity, states) {
  const id = clean(entity);
  if (!id) return null;
  const risolta = clean(root.resolveEntity?.(id) || id);
  const stato = states?.[risolta] || states?.[id];
  if (!stato) return null;
  const girati = insiemeInvertiti(readJson(CHIAVE_VERSI, []));
  const aperto = apertaSecondoVerso(
    windowOpenFromState(stato.state),
    girati.has(risolta) || girati.has(id),
  );
  if (aperto === null) return null;
  const quando = Date.parse(stato.last_changed || stato.last_updated || "");
  return { aperto, cambiatoIl: Number.isFinite(quando) ? quando : Date.now() };
}

/* Cosa dice la cassetta, e cosa se ne ricorda questo dispositivo.
 *
 * La memoria si riscrive solo quando e' cambiata davvero: questa funzione gira
 * a ogni giro di disegno della Home, cioe' molte volte al minuto. */
function laPostaAdesso(config, states) {
  const passo = passoDellaPosta(memoriaDellaPosta(), letturaDellaCassetta(config.posta, states));
  if (passo.cambiata) writeJsonIfChanged(CHIAVE_POSTA, passo.memoria, { sync: false });
  return passo;
}

/* ── le parole ──────────────────────────────────────────────────────────── */

/* La frase di una pastiglia che conta. Singolare e plurale separati: «1 luci
 * accese» e' il genere di sciatteria che si nota subito. */
function fraseDelConto(chiave, conto) {
  if (chiave === "luci")
    return conto === 1
      ? t("1 luce accesa", "1 light on")
      : t(`${conto} luci accese`, `${conto} lights on`);
  if (chiave === "tapparelle")
    return conto === 1
      ? t("1 finestra aperta", "1 window open")
      : t(`${conto} finestre aperte`, `${conto} windows open`);
  if (chiave === "clima")
    return conto === 1
      ? t("1 unità accesa", "1 unit on")
      : t(`${conto} unità accese`, `${conto} units on`);
  if (chiave === "prese")
    return conto === 1
      ? t("1 presa accesa", "1 socket on")
      : t(`${conto} prese accese`, `${conto} sockets on`);
  return conto === 1
    ? t("1 in riproduzione", "1 playing")
    : t(`${conto} in riproduzione`, `${conto} playing`);
}

/** Cosa c'e' scritto sulla pastiglia, e cosa dice per esteso a chi si ferma. */
function paroleDellaPastiglia(pastiglia) {
  if (pastiglia.chiave === "posta") {
    const testo = t("È arrivata la posta", "The mail has arrived");
    return { testo, titolo: `${testo} — ${t("tocca per dire che l'hai ritirata", "tap to say you have collected it")}` };
  }
  if (pastiglia.chiave === "rifiuti") {
    const quando = parolaDelQuando(pastiglia);
    const testo = pastiglia.nome ? `${pastiglia.nome} · ${quando}` : quando;
    return { testo, titolo: testo };
  }
  if (pastiglia.chiave === "sicurezza")
    return { testo: pastiglia.valore, titolo: pastiglia.valore };
  const testo = fraseDelConto(pastiglia.chiave, pastiglia.conto);
  const nomi = (pastiglia.nomi || []).join(" · ");
  return { testo, titolo: nomi ? `${testo}: ${nomi}` : testo };
}

/* ── il disegno ─────────────────────────────────────────────────────────── */

function pastigliaMarkup(pastiglia) {
  const { testo, titolo } = paroleDellaPastiglia(pastiglia);
  return `<button type="button" class="dm-casa-pastiglia" data-dm-casa="${esc(pastiglia.chiave)}"
      data-tessera="${esc(pastiglia.tessera || "")}" data-avviso="${Boolean(pastiglia.avviso)}"
      title="${esc(titolo)}" aria-label="${esc(titolo)}">
      <span class="dm-casa-ic" aria-hidden="true">${esc(pastiglia.icona)}</span>
      <span class="dm-casa-txt">${esc(testo)}</span>
    </button>`;
}

/* La riga sta subito sotto il meteo. Nasce solo quando c'e' qualcosa da dire e
 * se ne va quando non ce n'e' piu': una fascia vuota sotto il meteo sarebbe
 * spazio speso per niente. */
function ospite() {
  const pagina = doc?.getElementById?.("page-home");
  if (!pagina) return null;
  const gia = doc.getElementById("dm-casa-riga");
  if (gia?.parentElement === pagina) return gia;
  const riga = gia || doc.createElement("div");
  riga.id = "dm-casa-riga";
  riga.className = "dm-casa-riga";
  /* Sotto il meteo vuol dire due posti diversi, e sono lo stesso posto: quando
   * il meteo sta ancora nella pagina, subito dopo di lui; quando invece e'
   * salito nella testata — la fascia in cima, che sta fuori dalla pagina — il
   * primo posto della Home E' quello sotto il meteo. */
  const meteo = pagina.querySelector(":scope > .weather-widget");
  if (meteo) meteo.after(riga);
  else pagina.prepend(riga);
  return riga;
}

/**
 * Disegna la riga con i modelli delle tessere di questo giro.
 *
 * La chiama `renderHomeWidgets`, che i modelli li ha appena fatti. Si riscrive
 * solo quando cambia qualcosa: la Home si ridisegna a ogni evento di stato, e
 * rifare il markup a ogni giro vorrebbe dire far ripartire l'animazione della
 * posta due volte al secondo.
 */
export function disegnaComeStaLaCasa(modelli, states) {
  if (!doc) return false;
  const config = configurazione();
  const posta = laPostaAdesso(config, states || {});
  const pastiglie = pastiglieDellaCasa(modelli, { barra: config, posta });
  const riga = pastiglie.length ? ospite() : doc.getElementById("dm-casa-riga");
  if (!riga) return false;
  if (!pastiglie.length) {
    riga.remove();
    state.firma = "";
    return false;
  }
  const markup = pastiglie.map(pastigliaMarkup).join("");
  if (state.firma !== markup || !riga.firstElementChild) {
    state.firma = markup;
    riga.innerHTML = markup;
  }
  return true;
}

/* ── il tocco ───────────────────────────────────────────────────────────── */

/* La posta si spegne toccandola — «l'ho ritirata» — e ogni altra pastiglia
 * apre la tessera che racconta la stessa cosa per esteso. Se quella tessera e'
 * nascosta non succede niente: la pastiglia resta una notizia, non una porta
 * che si apre sul vuoto. */
function onClick(event) {
  const pastiglia = event.target?.closest?.("#dm-casa-riga [data-dm-casa]");
  if (!pastiglia) return;
  event.preventDefault();
  if (clean(pastiglia.dataset.dmCasa) === "posta") {
    writeJsonIfChanged(CHIAVE_POSTA, postaRitirata(memoriaDellaPosta(), Date.now()), {
      sync: false,
    });
    /* Via subito: la Home si ridisegna al prossimo evento di stato, che con
     * una casa ferma puo' voler dire fra un minuto. */
    pastiglia.remove();
    state.firma = "";
    if (!doc.querySelector("#dm-casa-riga [data-dm-casa]"))
      doc.getElementById("dm-casa-riga")?.remove();
    return;
  }
  const tessera = clean(pastiglia.dataset.tessera);
  if (tessera) doc.querySelector(`#dm-widgets [data-dm-widget="${CSS.escape(tessera)}"]`)?.click();
}

/* ── la scheda: dove si sceglie cosa si vede ────────────────────────────── */

/* La barra si configura nella scheda Home dell'editor, dove si configura il
 * resto della Home: l'ordine dei blocchi sta li' sopra, e chi cerca cosa si
 * vede in Home lo cerca in Home. */
const SCHEDA_HOME = "sez0";

function schedaAperta() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* I nomi delle voci. Sono gli stessi delle tessere che le raccontano — chi
 * legge «Finestre» nella scheda ritrova «Finestre» in Home — e la posta e' la
 * sola che una tessera non ce l'ha. */
const NOMI_DELLE_VOCI = () => ({
  posta: ["📬", t("Posta", "Mail")],
  rifiuti: ["♻️", t("Rifiuti", "Waste")],
  sicurezza: ["🛡️", t("Sicurezza", "Security")],
  luci: ["💡", t("Luci", "Lights")],
  tapparelle: ["🪟", t("Finestre", "Windows")],
  clima: ["❄️", t("Clima", "Climate")],
  prese: ["🔌", t("Prese", "Sockets")],
  media: ["🔊", t("Musica", "Media")],
});

function pannelloMarkup() {
  const config = configurazione();
  const nomi = NOMI_DELLE_VOCI();
  const righe = VOCI_DELLA_BARRA.map((voce) => {
    const [icona, etichetta] = nomi[voce.chiave] || ["", voce.chiave];
    return `<label class="ed-row dm-casa-ed-riga">
      <span class="dm-casa-ed-ic" aria-hidden="true">${icona}</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(etichetta)}</strong></span>
      <input type="checkbox" data-dm-casa-voce="${esc(voce.chiave)}"${
        config.voci[voce.chiave] ? " checked" : ""
      }>
    </label>`;
  }).join("");
  return `<div class="ed-sec-title">🏠 ${esc(t("Barra sotto il meteo", "Bar under the weather"))}</div>
    <div class="ed-intro">${esc(
      t(
        "Una riga di pastiglie sotto il meteo, con quello che conta adesso: il ritiro di oggi o domani, quante luci sono rimaste accese, quante finestre sono aperte. Compare solo quello che ha qualcosa da dire — nessuna luce accesa, nessuna pastiglia — e toccando una pastiglia si apre la tessera che racconta il resto.",
        "A row of pills under the weather, with what matters right now: today's or tomorrow's collection, how many lights were left on, how many windows are open. Only what has something to say shows up — no lights on, no pill — and tapping a pill opens the tile that tells the rest.",
      ),
    )}</div>
    <div class="dm-casa-ed-list">${righe}</div>
    <label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(
      t("Sensore della cassetta della posta", "Mailbox contact sensor"),
    )}</span>
      <span class="ed-form-row"><input id="dm-casa-posta" class="ed-input mono" data-dm-casa-posta value="${esc(
        config.posta,
      )}" placeholder="binary_sensor.cassetta_posta" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-casa-pick aria-label="${esc(
        t("Scegli entità", "Choose entity"),
      )}">🔍</button></span>
      <small>${esc(
        t(
          "Un contatto sulla cassetta: quando il postino apre lo sportello la pastiglia della posta compare, si muove per farsi notare e resta lì finché qualcuno non la tocca. La posta arriva mentre non si guarda, quindi non basta un lampo di due secondi.",
          "A contact on the mailbox: when the postman opens the flap the mail pill appears, moves to be noticed and stays there until somebody taps it. Mail arrives while nobody is looking, so a two-second flash is no use.",
        ),
      )}</small></label>
    <button type="button" class="ed-save-btn" data-dm-casa-salva>💾 ${esc(
      t("Salva la barra", "Save the bar"),
    )}</button>`;
}

/** Il pannello in fondo alla scheda Home dell'editor, quando e' quella aperta. */
export function ensurePannelloDellaBarra(body = doc?.getElementById?.("ed-body")) {
  if (!body) return false;
  let pannello = body.querySelector(":scope > [data-dm-casa-pannello]");
  if (schedaAperta() !== SCHEDA_HOME) {
    pannello?.remove();
    return false;
  }
  const firma = JSON.stringify(configurazione());
  if (pannello && pannello.dataset.dmFirma === firma) return true;
  if (!pannello) {
    pannello = doc.createElement("div");
    pannello.className = "dm-casa-ed";
    pannello.dataset.dmCasaPannello = "true";
  }
  pannello.dataset.dmFirma = firma;
  pannello.innerHTML = pannelloMarkup();
  /* Si aggiunge in fondo, ma non si PRETENDE il fondo: l'ultimo posto e' del
   * «Salva sezione», che a ogni passata torna a prenderselo. Chiederlo tutti e
   * due vorrebbe dire due moduli che si scambiano l'ultima riga per sempre. */
  if (pannello.parentElement !== body) body.append(pannello);
  return true;
}

/* Il salvataggio legge tutte le caselle in una volta: la scheda si ridisegna
 * appena scritto, e leggerle una per una vorrebbe dire leggerne meta' da un
 * documento che non c'e' piu'. */
function onClickPannello(event) {
  const pannello = event.target?.closest?.("[data-dm-casa-pannello]");
  if (!pannello) return;
  if (event.target.closest("[data-dm-casa-pick]")) {
    event.preventDefault();
    root.wzPickEntity?.(pannello.querySelector("[data-dm-casa-posta]"));
    return;
  }
  if (!event.target.closest("[data-dm-casa-salva]")) return;
  event.preventDefault();
  const voci = {};
  for (const casella of pannello.querySelectorAll("[data-dm-casa-voce]"))
    voci[clean(casella.dataset.dmCasaVoce)] = casella.checked;
  const posta = clean(pannello.querySelector("[data-dm-casa-posta]")?.value);
  const prima = configurazione();
  writeJsonIfChanged(CHIAVE_BARRA, normalizzaBarra({ voci, posta }));
  /* Cassetta cambiata: la memoria di quella di prima non vuol dire piu'
   * niente, e tenerla vorrebbe dire annunciare come «posta arrivata» il primo
   * scatto del contatto nuovo. Si riparte dal primo sguardo. */
  if (posta !== prima.posta) writeJsonIfChanged(CHIAVE_POSTA, {}, { sync: false });
  ensurePannelloDellaBarra();
  root.edToast?.(t("💾 Barra salvata", "💾 Bar saved"));
}

/* ── stile ──────────────────────────────────────────────────────────────── */

function stile() {
  return `
    #dm-casa-riga{
      display:flex;flex-wrap:nowrap;gap:8px;margin:0 0 18px;padding:2px 0 4px;
      overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch}
    #dm-casa-riga::-webkit-scrollbar{display:none}
    #dm-casa-riga:empty{display:none}
    .dm-casa-pastiglia{
      display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;
      padding:7px 13px;border-radius:100px;cursor:pointer;
      border:1px solid var(--card-border,rgba(0,0,0,.08));background:var(--surface-3,rgba(0,0,0,.04));
      color:var(--text,#111);font:inherit;font-size:12.5px;font-weight:650;line-height:1.2;
      max-width:min(70vw,320px);transition:transform .18s ease,box-shadow .18s ease}
    .dm-casa-pastiglia:active{transform:scale(.97)}
    .dm-casa-ic{font-size:15px;line-height:1;flex:0 0 auto}
    .dm-casa-txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* La posta e l'antifurto che suona sono notizie, non descrizioni: si
       accendono di colore e la posta si muove finche' non la si tocca. */
    .dm-casa-pastiglia[data-avviso="true"]{
      border-color:rgba(239,68,68,.42);background:rgba(239,68,68,.14);color:#b91c1c}
    .dm-casa-pastiglia[data-dm-casa="posta"]{
      border-color:rgba(37,99,235,.42);background:rgba(37,99,235,.14);color:#1d4ed8;
      animation:dmPostaChiama 2.4s ease-in-out infinite}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-ic{
      animation:dmPostaSbatte 2.4s ease-in-out infinite}
    @keyframes dmPostaChiama{
      0%,72%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}
      82%{box-shadow:0 0 0 7px rgba(37,99,235,.16)}
      92%{box-shadow:0 0 0 12px rgba(37,99,235,0)}}
    @keyframes dmPostaSbatte{
      0%,66%,100%{transform:translateY(0) rotate(0)}
      74%{transform:translateY(-3px) rotate(-11deg)}
      82%{transform:translateY(-3px) rotate(11deg)}
      90%{transform:translateY(0) rotate(0)}}
    html[data-theme="dark"] .dm-casa-pastiglia[data-avviso="true"]{color:#fca5a5}
    html[data-theme="dark"] .dm-casa-pastiglia[data-dm-casa="posta"]{color:#93c5fd}
    #ed-body .dm-casa-ed{display:block;margin-top:18px}
    #ed-body .dm-casa-ed-list{display:grid;gap:6px;margin-bottom:12px}
    #ed-body .dm-casa-ed-riga{display:flex!important;align-items:center;gap:10px;padding:8px 12px!important;cursor:pointer}
    #ed-body .dm-casa-ed-ic{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:0 0 24px;font-size:17px}
    #ed-body .dm-casa-ed-campo{display:block;margin-bottom:12px}
  `;
}

export function installComeStaLaCasa() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle("dm-come-sta-la-casa", stile());
  doc.addEventListener("click", onClick);
  doc.addEventListener("click", onClickPannello);
  onEditorRedraw("__dmComeStaLaCasa", () => ensurePannelloDellaBarra());
  return true;
}
