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
import { haOggettoWidget, oggettoWidget } from "../core/oggetti-widget.js";
import { windowOpenFromState } from "../core/shutter-window.js";
import { iconGlyphMarkup } from "./icon-engine-section.js";
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
/* La parola del conto, senza il numero dentro.
 *
 * Qui c'era `t(`${conto} luci accese`, ...)`, e il numero dentro la frase la
 * rompeva due volte. Una a schermo: «2 luci accese» tutto della stessa
 * grandezza, quando il resto della plancia il numero lo dice grosso e la parola
 * piccola. E una nei cataloghi: una chiave costruita con un valore dentro
 * cambia a ogni conto — «2 luci accese», «3 luci accese» — e nessuna di quelle
 * chiavi sta in nessuno dei tredici cataloghi. In italiano non si vedeva
 * perche' l'italiano e' la lingua sorgente; in tutte le altre quelle frasi non
 * sono mai state tradotte.
 *
 * Il numero esce dalla frase e resta un numero. Le parole diventano quattordici
 * chiavi ferme, che si traducono una volta e valgono per ogni conto.
 */
function parolaDelConto(chiave, conto) {
  const uno = conto === 1;
  if (chiave === "luci") return uno ? t("luce accesa", "light on") : t("luci accese", "lights on");
  if (chiave === "tapparelle")
    return uno ? t("finestra aperta", "window open") : t("finestre aperte", "windows open");
  if (chiave === "clima") return uno ? t("unità accesa", "unit on") : t("unità accese", "units on");
  if (chiave === "prese")
    return uno ? t("presa accesa", "socket on") : t("prese accese", "sockets on");
  return uno ? t("in riproduzione", "playing") : t("in riproduzione", "playing");
}

/** Cosa c'e' scritto sulla pastiglia, e cosa dice per esteso a chi si ferma. */
function paroleDellaPastiglia(pastiglia) {
  if (pastiglia.chiave === "posta") {
    const testo = t("È arrivata la posta", "The mail has arrived");
    return {
      numero: "",
      testo,
      titolo: `${testo} — ${t("tocca per dire che l'hai ritirata", "tap to say you have collected it")}`,
    };
  }
  if (pastiglia.chiave === "rifiuti") {
    const quando = parolaDelQuando(pastiglia);
    const testo = pastiglia.nome ? `${pastiglia.nome} · ${quando}` : quando;
    return { numero: "", testo, titolo: testo };
  }
  if (pastiglia.chiave === "sicurezza")
    return { numero: "", testo: pastiglia.valore, titolo: pastiglia.valore };
  const parola = parolaDelConto(pastiglia.chiave, pastiglia.conto);
  const numero = String(pastiglia.conto);
  const nomi = (pastiglia.nomi || []).join(" · ");
  const disteso = `${numero} ${parola}`;
  return { numero, testo: parola, titolo: nomi ? `${disteso}: ${nomi}` : disteso };
}

/* ── il disegno ─────────────────────────────────────────────────────────── */

/* La faccia della pastiglia: lo stesso disegno della sua tessera.
 *
 * Le pastiglie mostravano l'emoji di sistema, che cambia faccia da un telefono
 * a un altro e stava sopra una fila di tessere disegnate: due stili nella
 * stessa schermata, a tre dita di distanza. Si chiede lo stesso disegno che
 * chiede la tessera — `oggettoWidget` per le sezioni che ce l'hanno, il motore
 * delle icone per le altre — e l'emoji resta il ripiego di chi non ha nessuna
 * delle due. */
function facciaDellaPastiglia(pastiglia) {
  const chiave = clean(pastiglia?.chiave);
  if (haOggettoWidget(chiave)) return oggettoWidget(chiave);
  const nome = clean(pastiglia?.mdi);
  if (nome) return iconGlyphMarkup("action", nome, { size: 16 });
  return `<span class="dm-casa-emoji">${esc(String(pastiglia?.icona ?? ""))}</span>`;
}

/* Una pastiglia nuova, ancora senza parole: le mette `vestiLaPastiglia`. */
function nuovaPastiglia(chiave) {
  const nodo = doc.createElement("button");
  nodo.type = "button";
  nodo.className = "dm-casa-pastiglia";
  nodo.dataset.dmCasa = chiave;
  nodo.innerHTML = `<span class="dm-casa-chip" aria-hidden="true"></span>
    <span class="dm-casa-testo"><b class="dm-casa-num"></b><span class="dm-casa-txt"></span></span>`;
  return nodo;
}

/* Le parole addosso a una pastiglia che c'e' gia'.
 *
 * Si scrive solo quello che e' cambiato davvero. Riscrivere un attributo col
 * valore che aveva gia' non e' gratis: `data-avviso` e `data-dm-casa` sono i
 * ganci con cui lo stile accende l'animazione della posta, e toccarli la fa
 * ripartire da capo. */
function vestiLaPastiglia(nodo, pastiglia) {
  const { numero, testo, titolo } = paroleDellaPastiglia(pastiglia);
  const scrivi = (elemento, campo, valore) => {
    if (elemento && elemento[campo] !== valore) elemento[campo] = valore;
  };
  const attributo = (nome, valore) => {
    if (nodo.getAttribute(nome) !== valore) nodo.setAttribute(nome, valore);
  };
  attributo("data-tessera", pastiglia.tessera || "");
  attributo("data-avviso", String(Boolean(pastiglia.avviso)));
  attributo("title", titolo);
  attributo("aria-label", titolo);
  /* La tinta e' quella della tessera che racconta la stessa cosa per esteso:
   * si scrive sulla pastiglia come variabile, e lo stile la usa per il
   * riquadro del disegno. */
  const tinta = clean(pastiglia.tinta);
  if (tinta && nodo.style.getPropertyValue("--dm-casa-tinta") !== tinta)
    nodo.style.setProperty("--dm-casa-tinta", tinta);
  const chip = nodo.querySelector(".dm-casa-chip");
  const faccia = facciaDellaPastiglia(pastiglia);
  if (chip && chip.innerHTML !== faccia) chip.innerHTML = faccia;
  scrivi(nodo.querySelector(".dm-casa-num"), "textContent", numero);
  scrivi(nodo.querySelector(".dm-casa-txt"), "textContent", testo);
}

/* Le pastiglie si aggiornano al loro posto, una per una.
 *
 * Riscrivere tutta la riga a ogni cambiamento farebbe rinascere anche le
 * pastiglie che non c'entrano niente: si accende una luce, il conto passa da 2
 * a 3, e la posta — che e' la sola voce animata — ricomincia a sbattere lo
 * sportello da capo, come se fosse appena arrivata. Ognuna e' riconosciuta
 * dalla sua chiave: quelle che restano cambiano solo le parole, quelle nuove
 * nascono al loro posto, quelle che non hanno piu' niente da dire se ne vanno.
 */
function aggiornaLePastiglie(riga, pastiglie) {
  const vive = new Map();
  for (const nodo of riga.querySelectorAll(":scope > [data-dm-casa]"))
    vive.set(nodo.dataset.dmCasa, nodo);
  let posto = riga.firstElementChild;
  for (const pastiglia of pastiglie) {
    const gia = vive.get(pastiglia.chiave);
    vive.delete(pastiglia.chiave);
    const nodo = gia || nuovaPastiglia(pastiglia.chiave);
    vestiLaPastiglia(nodo, pastiglia);
    if (nodo === posto) posto = posto.nextElementSibling;
    else riga.insertBefore(nodo, posto);
  }
  for (const nodo of vive.values()) nodo.remove();
}

/* Cosa dice la riga adesso, in una riga di testo: serve solo a saltare il giro
 * quando non e' cambiato niente. */
function firmaDellaRiga(pastiglie) {
  return pastiglie
    .map((pastiglia) => {
      const { numero, testo } = paroleDellaPastiglia(pastiglia);
      return `${pastiglia.chiave}~${pastiglia.icona}~${pastiglia.tinta}~${numero}~${testo}~${Boolean(pastiglia.avviso)}`;
    })
    .join("|");
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
 * La chiama `renderHomeWidgets`, che i modelli li ha appena fatti. Si tocca
 * solo quando cambia qualcosa: la Home si ridisegna a ogni evento di stato, e
 * rifare il disegno a ogni giro vorrebbe dire far ripartire l'animazione della
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
  const attuale = firmaDellaRiga(pastiglie);
  if (state.firma !== attuale || riga.childElementCount !== pastiglie.length) {
    state.firma = attuale;
    aggiornaLePastiglie(riga, pastiglie);
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
    /* La riga va a capo, non fuori pagina (#400).
       «Nella home in alto quando fa vedere le cose accese o attive va oltre
       pagina a destra e devi scorrere per vederle. Sarebbe carino che andasse
       a capo e utilizzasse X righe che servono per far vedere.»

       Era un nastro che scorreva di lato, senza andare a capo. Uno
       scorrimento orizzontale in cima a una pagina che scorre in verticale non
       lo trova nessuno — non c'era nemmeno la barra, nascosta apposta — e
       quello che stava oltre il bordo destro era, di fatto, quello che non
       esisteva. Il riepilogo di cosa e' acceso in casa e' la prima cosa che si
       guarda: nasconderne meta' e' peggio che tenerlo alto due righe.

       Le pastiglie adesso possono anche stringersi: il testo
       taglia gia' con i puntini, e cosi' ne sta di piu' per riga invece di
       andare a capo dopo la prima. */
    #dm-casa-riga{
      display:flex;flex-wrap:wrap;gap:7px;margin:0 0 16px;padding:2px 0 4px}
    #dm-casa-riga:empty{display:none}

    /* Mini-tessere, non pastiglie grigie.
       Erano ovali piatti con dentro un'emoji e una frase tutta della stessa
       grandezza: sopra una fila di tessere bianche col disegno nel riquadro,
       il numero grosso e la parola piccola, sembravano tasti spenti di
       un'altra plancia. Adesso parlano la stessa lingua di quello che hanno
       sotto — stesso fondo, stesso bordo, stesso riquadro tinto per il
       disegno, stessa gerarchia fra numero e parola — e restano tonde quel
       tanto che basta a dire che si toccano una per una. */
    .dm-casa-pastiglia{
      --dm-casa-tinta:#64748b;
      display:inline-flex;align-items:center;gap:8px;flex:0 1 auto;min-width:0;
      padding:5px 13px 5px 5px;border-radius:14px;cursor:pointer;
      border:1px solid var(--card-border,rgba(15,23,42,.08));
      background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;
      box-shadow:0 1px 2px rgba(15,23,42,.05);
      max-width:min(72vw,340px);
      transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .dm-casa-pastiglia:hover{box-shadow:0 4px 12px rgba(15,23,42,.09)}
    .dm-casa-pastiglia:active{transform:scale(.97)}
    .dm-casa-chip{
      display:grid;place-items:center;flex:0 0 auto;width:25px;height:25px;
      border-radius:9px;line-height:1;
      background:color-mix(in srgb,var(--dm-casa-tinta) 15%,transparent);
      color:var(--dm-casa-tinta)}
    .dm-casa-chip svg{width:16px;height:16px;display:block}
    .dm-casa-emoji{font-size:15px;line-height:1}
    .dm-casa-testo{display:inline-flex;align-items:baseline;gap:5px;min-width:0}
    .dm-casa-num{
      font-size:14.5px;font-weight:800;line-height:1.1;letter-spacing:-.01em;
      font-variant-numeric:tabular-nums;flex:0 0 auto}
    .dm-casa-num:empty{display:none}
    .dm-casa-txt{
      font-size:12px;font-weight:600;line-height:1.25;
      color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    /* La posta e l'antifurto che suona sono notizie, non descrizioni: si
       accendono di colore e la posta si muove finche' non la si tocca. */
    .dm-casa-pastiglia[data-avviso="true"]{
      --dm-casa-tinta:#dc2626;
      border-color:rgba(220,38,38,.35);background:rgba(220,38,38,.08)}
    .dm-casa-pastiglia[data-avviso="true"] .dm-casa-num,
    .dm-casa-pastiglia[data-avviso="true"] .dm-casa-txt{color:#b91c1c}
    .dm-casa-pastiglia[data-dm-casa="posta"]{
      border-color:rgba(37,99,235,.35);background:rgba(37,99,235,.08);
      animation:dmPostaChiama 2.4s ease-in-out infinite}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-txt{color:#1d4ed8}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-chip{
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
    @media (prefers-reduced-motion:reduce){
      .dm-casa-pastiglia[data-dm-casa="posta"],
      .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-chip{animation:none}}
    html[data-theme="dark"] .dm-casa-pastiglia{
      box-shadow:none;border-color:var(--card-border,rgba(148,163,184,.18))}
    html[data-theme="dark"] .dm-casa-pastiglia[data-avviso="true"] .dm-casa-num,
    html[data-theme="dark"] .dm-casa-pastiglia[data-avviso="true"] .dm-casa-txt{color:#fca5a5}
    html[data-theme="dark"] .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-txt{color:#93c5fd}
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
