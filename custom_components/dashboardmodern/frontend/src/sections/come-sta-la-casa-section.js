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
import { durataDellaDeriva, spazioDaPercorrere } from "../core/la-fascia-deriva.js";
import { haOggettoWidget, oggettoWidget } from "../core/oggetti-widget.js";
import { windowOpenFromState } from "../core/shutter-window.js";
import { iconGlyphMarkup } from "./icon-engine-section.js";
import { CHIAVE_VERSI, apertaSecondoVerso, insiemeInvertiti } from "../core/verso-aperture.js";
import { parolaDelQuando } from "./rifiuti-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
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

/* Le due misure scelte a mano, com'e' adesso ognuna (#461).
 *
 * «Ho un sensore esterno all'abitazione con cui mi regolo con i clima interni»:
 * il sensore lo sceglie chi abita la casa, e qui si legge quello e basta.
 * L'unita' la dichiara Home Assistant — °C o °F, % — e riscriverla a mano
 * vorrebbe dire dire gradi centigradi a chi li ha in Fahrenheit. Il nome serve
 * a chi si ferma sopra: nella pastiglia non ci sta, nel titolo si'.
 *
 * Una misura che non si sa non e' una misura a zero: torna `null`, e la
 * pastiglia semplicemente non compare. */
function letturaDellaMisura(entity, states) {
  const id = clean(entity);
  if (!id) return null;
  const risolta = clean(root.resolveEntity?.(id) || id);
  const stato = states?.[risolta] || states?.[id];
  if (!stato) return null;
  const valore = Number.parseFloat(String(stato.state ?? "").replace(",", "."));
  if (!Number.isFinite(valore)) return null;
  return {
    valore,
    unita: clean(stato.attributes?.unit_of_measurement),
    nome: clean(stato.attributes?.friendly_name) || id,
  };
}

/** Le misure della barra, gia' lette: il nucleo non guarda nessuna entita'. */
function leMisureAdesso(config, states) {
  return {
    temperatura: letturaDellaMisura(config.temperatura, states),
    umidita: letturaDellaMisura(config.umidita, states),
    pioggia: letturaDellaMisura(config.pioggia, states),
    pioggiaOggi: letturaDellaMisura(config.pioggiaOggi, states),
  };
}

/* Le due letture della pioggia, per chi le chiede da fuori (#478).
 *
 * L'irrigazione le legge da qui invece di avere due caselle sue: chi ha una
 * stazione meteo l'ha gia' dichiarata una volta, e due caselle per lo stesso
 * pluviometro sono due caselle che possono discordare. */
export function letturePioggia(states = allStates()) {
  const config = configurazione();
  return {
    intensita: letturaDellaMisura(config.pioggia, states),
    oggi: letturaDellaMisura(config.pioggiaOggi, states),
  };
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
  if (chiave === "porte") return uno ? t("porta aperta", "door open") : t("porte aperte", "doors open");
  if (chiave === "varchi") return uno ? t("varco aperto", "opening open") : t("varchi aperti", "openings open");
  return uno ? t("in riproduzione", "playing") : t("in riproduzione", "playing");
}

/**
 * Le due righe di una voce, e cosa dice per esteso a chi si ferma.
 *
 * `testa` e' la parola grossa — il numero, il nome del ritiro, come sta
 * l'antifurto — e `coda` la micro-etichetta maiuscola che la qualifica. Sono la
 * stessa coppia con cui parla il resto della plancia: il numero grande e sotto
 * la parolina spaziata, come sulle tessere e sul carico del MiniPC. Averla
 * uguale per tutte le voci e' quello che fa sembrare la fascia una cosa sola
 * invece di sei etichette diverse messe in fila.
 */
function paroleDellaPastiglia(pastiglia) {
  if (pastiglia.chiave === "posta") {
    const coda = t("è arrivata", "has arrived");
    return {
      testa: t("Posta", "Mail"),
      coda,
      titolo: `${t("È arrivata la posta", "The mail has arrived")} — ${t("tocca per dire che l'hai ritirata", "tap to say you have collected it")}`,
    };
  }
  if (pastiglia.chiave === "rifiuti") {
    const quando = parolaDelQuando(pastiglia);
    const testa = pastiglia.nome || t("Ritiro", "Collection");
    return { testa, coda: quando, titolo: `${testa} · ${quando}` };
  }
  if (pastiglia.chiave === "sicurezza")
    return {
      testa: pastiglia.valore,
      coda: t("antifurto", "alarm"),
      titolo: pastiglia.valore,
    };
  if (pastiglia.chiave === "pioggia" || pastiglia.chiave === "pioggiaOggi") {
    /* La pioggia si scrive col decimo: fra zero e 0,4 mm all'ora c'e' la
     * differenza fra «piove» e «non piove», e arrotondare la cancella. */
    const testa = `${formatNumber(pastiglia.valore, 1)}${pastiglia.unita ? ` ${pastiglia.unita}` : ""}`;
    const coda =
      pastiglia.chiave === "pioggia" ? t("pioggia", "rain") : t("oggi", "today");
    return {
      testa,
      coda,
      titolo: pastiglia.nome ? `${pastiglia.nome} · ${testa}` : `${testa} ${coda}`,
    };
  }
  if (pastiglia.chiave === "temperatura" || pastiglia.chiave === "umidita") {
    /* La temperatura si scrive col decimo — fra 21 e 21,5 c'e' la differenza
     * per cui uno guarda il sensore — l'umidita' no: mezzo punto percentuale
     * non cambia niente a nessuno. */
    const decimali = pastiglia.chiave === "temperatura" ? 1 : 0;
    const testa = `${formatNumber(pastiglia.valore, decimali)}${pastiglia.unita ? ` ${pastiglia.unita}` : ""}`;
    const coda =
      pastiglia.chiave === "temperatura"
        ? t("temperatura", "temperature")
        : t("umidità", "humidity");
    /* Il nome del sensore nel titolo: nella pastiglia non ci starebbe, e sapere
     * QUALE sensore e' l'unica cosa che il numero da solo non dice. */
    return { testa, coda, titolo: pastiglia.nome ? `${pastiglia.nome} · ${testa}` : `${testa} ${coda}` };
  }
  const parola = parolaDelConto(pastiglia.chiave, pastiglia.conto);
  const testa = String(pastiglia.conto);
  const nomi = (pastiglia.nomi || []).join(" · ");
  const disteso = `${testa} ${parola}`;
  return { testa, coda: parola, titolo: nomi ? `${disteso}: ${nomi}` : disteso };
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
    <span class="dm-casa-testo"><b class="dm-casa-testa"></b><small class="dm-casa-coda"></small></span>`;
  return nodo;
}

/* Le parole addosso a una pastiglia che c'e' gia'.
 *
 * Si scrive solo quello che e' cambiato davvero. Riscrivere un attributo col
 * valore che aveva gia' non e' gratis: `data-avviso` e `data-dm-casa` sono i
 * ganci con cui lo stile accende l'animazione della posta, e toccarli la fa
 * ripartire da capo. */
function vestiLaPastiglia(nodo, pastiglia) {
  const { testa, coda, titolo } = paroleDellaPastiglia(pastiglia);
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
  scrivi(nodo.querySelector(".dm-casa-testa"), "textContent", testa);
  scrivi(nodo.querySelector(".dm-casa-coda"), "textContent", coda);
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
      const { testa, coda } = paroleDellaPastiglia(pastiglia);
      return `${pastiglia.chiave}~${pastiglia.icona}~${pastiglia.tinta}~${testa}~${coda}~${Boolean(pastiglia.avviso)}`;
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
  /* Le pastiglie stanno su un nastro, e la fascia lo ritaglia: e' il nastro a
   * scorrere, non lo scorrimento della fascia. Cosi' il movimento lo fa il
   * compositore e non c'e' nessun timer che sposti niente. */
  if (!riga.querySelector(":scope > .dm-casa-nastro")) {
    const nastro = doc.createElement("div");
    nastro.className = "dm-casa-nastro";
    riga.append(nastro);
  }
  /* Sotto il meteo vuol dire due posti diversi, e sono lo stesso posto: quando
   * il meteo sta ancora nella pagina, subito dopo di lui; quando invece e'
   * salito nella testata — la fascia in cima, che sta fuori dalla pagina — il
   * primo posto della Home E' quello sotto il meteo. */
  const meteo = pagina.querySelector(":scope > .weather-widget");
  if (meteo) meteo.after(riga);
  else pagina.prepend(riga);
  return riga;
}

/* ── la deriva della fascia ──────────────────────────────────────────────── */

/* Quanta strada c'e' da fare, detta al foglio di stile una volta per disegno.
 *
 * Il foglio sa animare, ma non sa quanto sono larghe le pastiglie: quella
 * misura la puo' prendere solo chi ha il documento in mano, e la prende quando
 * il disegno e' appena finito — non a ogni fotogramma. Da qui in poi si muove
 * tutto da solo.
 *
 * `data-dm-deriva` accende l'animazione e le sfumature ai bordi: senza di lui
 * una fascia che ci sta tutta resterebbe ferma ma sfumata, cioe' direbbe che
 * c'e' altro quando non c'e'. */
/* Quanto misura il bordo interno della fascia, che il nastro non ha.
 *
 * E' l'unica cosa che sa il documento e non sa `spazioDaPercorrere`: la
 * misura si prende una volta per disegno, come le altre di qui, non a ogni
 * fotogramma. */
function imbottituraDellaFascia(riga) {
  const stile = root.getComputedStyle?.(riga);
  return (parseFloat(stile?.paddingLeft) || 0) + (parseFloat(stile?.paddingRight) || 0);
}

function tieniLaFasciaInMovimento(riga) {
  const nastro = riga?.querySelector(":scope > .dm-casa-nastro");
  if (!nastro) return false;
  const strada = spazioDaPercorrere({
    scrollWidth: nastro.scrollWidth,
    clientWidth: riga.clientWidth,
    imbottitura: imbottituraDellaFascia(riga),
  });
  if (!strada) {
    delete riga.dataset.dmDeriva;
    riga.style.removeProperty("--dm-casa-strada");
    riga.style.removeProperty("--dm-casa-durata");
    return false;
  }
  riga.style.setProperty("--dm-casa-strada", `${strada}px`);
  riga.style.setProperty("--dm-casa-durata", `${durataDellaDeriva(strada)}s`);
  riga.dataset.dmDeriva = "true";
  return true;
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
  const pastiglie = pastiglieDellaCasa(modelli, {
    barra: config,
    posta,
    misure: leMisureAdesso(config, states || {}),
  });
  const riga = pastiglie.length ? ospite() : doc.getElementById("dm-casa-riga");
  if (!riga) return false;
  if (!pastiglie.length) {
    riga.remove();
    state.firma = "";
    return false;
  }
  const nastro = riga.querySelector(":scope > .dm-casa-nastro") || riga;
  const attuale = firmaDellaRiga(pastiglie);
  if (state.firma !== attuale || nastro.childElementCount !== pastiglie.length) {
    state.firma = attuale;
    aggiornaLePastiglie(nastro, pastiglie);
  }
  /* Dopo il disegno, non prima: quante pastiglie ci stanno lo si sa solo a
   * fascia piena. */
  tieniLaFasciaInMovimento(riga);
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
  porte: ["🚪", t("Porte", "Doors")],
  varchi: ["🚪", t("Varchi", "Openings")],
  luci: ["💡", t("Luci", "Lights")],
  tapparelle: ["🪟", t("Finestre", "Windows")],
  clima: ["❄️", t("Clima", "Climate")],
  prese: ["🔌", t("Prese", "Sockets")],
  media: ["🔊", t("Musica", "Media")],
  temperatura: ["🌡️", t("Temperatura", "Temperature")],
  umidita: ["💧", t("Umidità", "Humidity")],
  pioggia: ["🌧️", t("Pioggia adesso", "Rain now")],
  pioggiaOggi: ["☔", t("Pioggia di oggi", "Rain today")],
});

/* Una casella per un sensore della barra: le due misure hanno la stessa forma
 * di quella della posta, e scriverla tre volte vorrebbe dire tre caselle che
 * col tempo diventano diverse. */
function campoDellaMisura(chiave, valore, etichetta, esempio) {
  return `<label class="ed-slot dm-casa-ed-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
      <span class="ed-form-row"><input class="ed-input mono" data-dm-casa-misura="${esc(chiave)}" value="${esc(
        valore,
      )}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-casa-pick-misura="${esc(
        chiave,
      )}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>`;
}

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
    ${campoDellaMisura(
      "temperatura",
      config.temperatura,
      t("Sensore della temperatura", "Temperature sensor"),
      "sensor.temperatura_esterna",
    )}
    ${campoDellaMisura(
      "umidita",
      config.umidita,
      t("Sensore dell'umidità", "Humidity sensor"),
      "sensor.umidita_esterna",
    )}
    ${campoDellaMisura(
      "pioggia",
      config.pioggia,
      t("Intensità della pioggia", "Rain rate"),
      "sensor.stazione_rain_rate",
    )}
    ${campoDellaMisura(
      "pioggiaOggi",
      config.pioggiaOggi,
      t("Pioggia caduta oggi", "Rain fallen today"),
      "sensor.stazione_pioggia_giornaliera",
    )}
    <div class="ed-intro">${esc(
      t(
        "Quattro sensori scelti da te: quelli che leggi per decidere, non una media della casa. Il tipico è quello fuori, con cui ci si regola per i clima interni. L'unità la dice Home Assistant, e un sensore che non indichi è una pastiglia che non compare.",
        "Four sensors of your choosing: the ones you actually read to decide, not a house average. The typical one is outdoors, the one you go by for the indoor units. The unit comes from Home Assistant, and a sensor you do not name is a pill that does not show up.",
      ),
    )}</div>
    <div class="ed-intro">${esc(
      t(
        "I due della pioggia servono a chi ha una stazione meteo: quanto sta venendo giù adesso e quanti millimetri sono caduti oggi. Sono anche quelli che guarda l'irrigazione — se il terreno l'ha già bagnato la pioggia, la pagina Irrigazione lo dice e propone di saltare il giro — quindi si scrivono qui una volta sola.",
        "The two rain ones are for those with a weather station: how hard it is coming down now, and how many millimetres fell today. They are also the ones irrigation looks at — if the rain has already watered the ground, the Irrigation page says so and offers to skip the run — so you name them here once.",
      ),
    )}</div>
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
  const scegliMisura = event.target.closest("[data-dm-casa-pick-misura]");
  if (scegliMisura) {
    event.preventDefault();
    const chiave = clean(scegliMisura.dataset.dmCasaPickMisura);
    root.wzPickEntity?.(
      pannello.querySelector(`[data-dm-casa-misura="${CSS.escape(chiave)}"]`),
    );
    return;
  }
  if (!event.target.closest("[data-dm-casa-salva]")) return;
  event.preventDefault();
  const voci = {};
  for (const casella of pannello.querySelectorAll("[data-dm-casa-voce]"))
    voci[clean(casella.dataset.dmCasaVoce)] = casella.checked;
  const posta = clean(pannello.querySelector("[data-dm-casa-posta]")?.value);
  const misure = {};
  for (const casella of pannello.querySelectorAll("[data-dm-casa-misura]"))
    misure[clean(casella.dataset.dmCasaMisura)] = clean(casella.value);
  const prima = configurazione();
  writeJsonIfChanged(CHIAVE_BARRA, normalizzaBarra({ voci, posta, ...misure }));
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
    /* Una fascia sola, non sei etichette in fila.
       «La barra dei dispositivi sotto meteo non mi convince proprio.» Erano
       ovali sciolti sul fondo della pagina, sotto una card del meteo che e'
       un rettangolo bianco pieno: sembravano avanzi, non una parte.
       Adesso e' una fascia come quella — stesso bianco, stesso raggio, stessa
       ombra — e le voci ci stanno dentro come le pastiglie del meteo stanno
       dentro la sua. Due fasce una sopra l'altra, e si leggono come una cosa
       sola.

       ── Una riga sola, che scorre da sola ────────────────────────────────
       «La barra sotto al meteo deve essere su una riga: da smartphone, se non
       entra, la devi rendere scorrevole o che scorre lei automaticamente.»

       E' la marcia indietro sulla #400 — «va oltre pagina a destra e devi
       scorrere per vederle, sarebbe carino che andasse a capo» — e non e' un
       ripensamento a vuoto: l'obiezione di allora era che uno scorrimento
       orizzontale, in cima a una pagina che scorre in verticale, non lo trova
       nessuno, e quello che stava oltre il bordo era di fatto quello che non
       esisteva. Adesso quell'obiezione cade, perche' non c'e' piu' niente da
       trovare: se le pastiglie non entrano, la fascia deriva da sola avanti e
       indietro e te le porta davanti una per una.

       La deriva si ferma appena qualcuno la tocca — chi ha preso in mano la
       fascia comanda lui — e non parte affatto per chi ha chiesto meno
       animazioni. Il velo sul bordo dice che c'e' altro anche da ferma. */
    #dm-casa-riga{
      display:block;overflow:hidden;
      /* Stretta quanto quello che dice: una casa tranquilla ha due voci, e una
         fascia larga tutta la pagina con due voci dentro e' mezza fascia
         vuota. Cresce con quello che ha da dire, e al massimo arriva al bordo
         come la card del meteo. */
      width:fit-content;max-width:100%;
      margin:0 0 18px;padding:6px;
      border-radius:20px;
      border:1px solid var(--card-border,rgba(15,23,42,.07));
      background:var(--card-bg,#fff);
      box-shadow:0 6px 18px -12px rgba(15,23,42,.28)}
    #dm-casa-riga:not(:has([data-dm-casa])){display:none}
    /* Il nastro: le pastiglie in fila, larghe quanto vogliono. E' lui che si
       muove, e lo muove il foglio — nessun timer sposta niente. */
    .dm-casa-nastro{
      display:flex;flex-wrap:nowrap;align-items:stretch;gap:2px;width:max-content}
    /* Va avanti e torna, e si ferma un attimo ai due capi: alternate piu' la
       curva morbida. La strada e il tempo li ha misurati la sezione — il foglio
       non sa quanto sono larghe le pastiglie. */
    #dm-casa-riga[data-dm-deriva="true"] .dm-casa-nastro{
      animation:dm-casa-deriva var(--dm-casa-durata,12s) ease-in-out infinite alternate}
    @keyframes dm-casa-deriva{
      from{translate:0}
      to{translate:calc(-1 * var(--dm-casa-strada,0px))}}
    /* Chi ci mette il dito o il puntatore sopra comanda lui: la fascia si ferma
       e si legge. Riprende quando lo si toglie. */
    #dm-casa-riga:hover .dm-casa-nastro,
    #dm-casa-riga:active .dm-casa-nastro,
    #dm-casa-riga:focus-within .dm-casa-nastro{animation-play-state:paused}
    /* Le sfumature ai due bordi dicono «continua»: si accendono solo quando
       c'e' davvero qualcosa fuori. */
    #dm-casa-riga[data-dm-deriva="true"]{
      mask-image:linear-gradient(to right,transparent 0,#000 22px,#000 calc(100% - 22px),transparent 100%);
      -webkit-mask-image:linear-gradient(to right,transparent 0,#000 22px,#000 calc(100% - 22px),transparent 100%)}
    @media (prefers-reduced-motion:reduce){
      /* Chi ha chiesto meno animazioni si trascina la fascia a mano: e' l'unico
         caso in cui torna a scorrere invece di derivare. */
      #dm-casa-riga[data-dm-deriva="true"] .dm-casa-nastro{animation:none}
      #dm-casa-riga[data-dm-deriva="true"]{overflow-x:auto;scrollbar-width:none}
      #dm-casa-riga[data-dm-deriva="true"]::-webkit-scrollbar{display:none}}

    /* Ogni voce: il disegno nel suo riquadro tinto, la parola grossa e sotto
       la micro-etichetta maiuscola spaziata. E' la coppia con cui parla tutta
       la plancia — il numero grande e la parolina sotto, come sulle tessere e
       sul carico del MiniPC — e averla uguale per tutte e' quello che tiene
       insieme la fascia. */
    .dm-casa-pastiglia{
      --dm-casa-tinta:#64748b;
      display:inline-flex;align-items:center;gap:10px;flex:0 1 auto;min-width:0;
      padding:7px 14px 7px 8px;border-radius:15px;cursor:pointer;
      border:0;background:transparent;color:var(--text,#0f172a);font:inherit;
      text-align:left;max-width:min(70vw,300px);
      transition:background-color .18s ease,transform .18s ease}
    .dm-casa-pastiglia:hover{
      background:color-mix(in srgb,var(--dm-casa-tinta) 9%,transparent)}
    .dm-casa-pastiglia:active{transform:scale(.97)}
    .dm-casa-chip{
      display:grid;place-items:center;flex:0 0 auto;width:32px;height:32px;
      border-radius:11px;line-height:1;
      background:color-mix(in srgb,var(--dm-casa-tinta) 14%,transparent);
      color:var(--dm-casa-tinta)}
    .dm-casa-chip svg{width:19px;height:19px;display:block}
    .dm-casa-emoji{font-size:17px;line-height:1}
    .dm-casa-testo{display:flex;flex-direction:column;gap:1px;min-width:0}
    .dm-casa-testa{
      font-size:16px;font-weight:800;line-height:1.15;letter-spacing:-.015em;
      font-variant-numeric:tabular-nums;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-casa-coda{
      font-size:9.5px;font-weight:800;line-height:1.2;
      letter-spacing:.11em;text-transform:uppercase;
      color:var(--text-dim,#94a3b8);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    /* La posta e l'antifurto che suona sono notizie, non descrizioni: si
       accendono di colore e la posta si muove finche' non la si tocca. */
    .dm-casa-pastiglia[data-avviso="true"]{
      --dm-casa-tinta:#dc2626;
      background:color-mix(in srgb,#dc2626 10%,transparent)}
    .dm-casa-pastiglia[data-avviso="true"] .dm-casa-testa{color:#b91c1c}
    .dm-casa-pastiglia[data-avviso="true"] .dm-casa-coda{color:#dc2626}
    .dm-casa-pastiglia[data-dm-casa="posta"]{
      --dm-casa-tinta:#2563eb;
      background:color-mix(in srgb,#2563eb 10%,transparent);
      animation:dmPostaChiama 2.4s ease-in-out infinite}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-testa{color:#1d4ed8}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-coda{color:#2563eb}
    .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-chip{
      animation:dmPostaSbatte 2.4s ease-in-out infinite}
    @keyframes dmPostaChiama{
      0%,72%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}
      82%{box-shadow:0 0 0 6px rgba(37,99,235,.16)}
      92%{box-shadow:0 0 0 11px rgba(37,99,235,0)}}
    @keyframes dmPostaSbatte{
      0%,66%,100%{transform:translateY(0) rotate(0)}
      74%{transform:translateY(-3px) rotate(-11deg)}
      82%{transform:translateY(-3px) rotate(11deg)}
      90%{transform:translateY(0) rotate(0)}}
    @media (prefers-reduced-motion:reduce){
      .dm-casa-pastiglia[data-dm-casa="posta"],
      .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-chip{animation:none}}
    html[data-theme="dark"] #dm-casa-riga{
      box-shadow:none;border-color:var(--card-border,rgba(148,163,184,.16))}
    html[data-theme="dark"] .dm-casa-pastiglia[data-avviso="true"] .dm-casa-testa{color:#fca5a5}
    html[data-theme="dark"] .dm-casa-pastiglia[data-avviso="true"] .dm-casa-coda{color:#f87171}
    html[data-theme="dark"] .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-testa{color:#bfdbfe}
    html[data-theme="dark"] .dm-casa-pastiglia[data-dm-casa="posta"] .dm-casa-coda{color:#93c5fd}
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
