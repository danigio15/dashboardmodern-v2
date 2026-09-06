/* La plancia non riparte da zero ogni volta che si torna.
 *
 * Home Assistant e' una pagina sola: andare sulle Impostazioni e tornare
 * indietro toglieva il pannello dal documento e con lui la cornice, cioe' la
 * plancia intera. Il ritorno era un avvio completo — runtime riletto, stati
 * richiesti di nuovo, pacchetto dell'Energia, storico dei widget, miniature
 * delle telecamere — ed e' il «si carica lentamente» che si sente tornando.
 *
 * Qui si difende il parcheggio: la cornice si mette da parte viva, e al
 * ritorno un pannello nuovo se la riprende invece di costruirne un'altra.
 *
 * Che il documento dentro la cornice sopravviva davvero allo spostamento e'
 * una cosa del browser, e la prova sta nel giro e2e
 * (`la-plancia-resta-viva-fra-le-pagine.spec.js`): qui si prova la regola —
 * chi si parcheggia, con che chiave ci si riprende, e cosa succede quando lo
 * spostamento atomico non c'e'.
 */
import assert from "node:assert/strict";
import test from "node:test";

/* ── un documento quel tanto che basta ───────────────────────────────────── */

class NodoFinto {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.style = { cssText: "", setProperty() {}, getPropertyValue: () => "" };
    this.contentWindow = finestraFiglia();
  }
  get isConnected() {
    let nodo = this;
    while (nodo.parentNode) nodo = nodo.parentNode;
    return nodo.__radice === true;
  }
  setAttribute(nome, valore) {
    this.attributes[nome] = String(valore);
  }
  getAttribute(nome) {
    return this.attributes[nome];
  }
  addEventListener(tipo, handler) {
    this.listeners[tipo] = handler;
  }
  append(...nodi) {
    for (const nodo of nodi) {
      nodo.parentNode?.children?.splice(nodo.parentNode.children.indexOf(nodo), 1);
      nodo.parentNode = this;
      this.children.push(nodo);
    }
  }
  replaceChildren(...nodi) {
    for (const vecchio of this.children) vecchio.parentNode = null;
    this.children = [];
    this.append(...nodi);
  }
  remove() {
    this.rimosso = true;
    this.parentNode?.children?.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
  /* Lo spostamento atomico: qui e' un `append` che tiene la finestra figlia,
   * che e' esattamente quello che il browser garantisce. */
  moveBefore(nodo) {
    this.append(nodo);
  }
  querySelectorAll() {
    return [];
  }
}

/* La finestra dentro la cornice: quel poco che l'host le dice e le chiede. */
function finestraFiglia() {
  const eventi = [];
  return {
    eventi,
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    dispatchEvent(evento) {
      eventi.push(evento.type);
      return true;
    },
    dmReleaseOwnerDocument() {
      eventi.push("rilascio");
    },
    /* Un documento vivo: un corpo con qualcosa dentro e il marchio della
     * plancia — e' cosi' che l'host riconosce una cornice che ha perso il suo
     * documento da una che ce l'ha ancora. */
    document: { body: { firstElementChild: {} } },
    __DASHBOARDMODERN_STORAGE_NS__: "cd_prova_",
  };
}

function documentoFinto() {
  const body = new NodoFinto("body");
  const documento = {
    __radice: true,
    body,
    createElement: (tag) => new NodoFinto(tag),
    getElementById(id) {
      const cerca = (nodo) =>
        nodo.attributes?.id === id || nodo.id === id
          ? nodo
          : nodo.children.reduce((trovato, figlio) => trovato || cerca(figlio), null);
      return cerca(body);
    },
    querySelectorAll: () => [],
  };
  body.parentNode = documento;
  documento.children = [body];
  return documento;
}

/* ── l'ambiente, prima di importare i moduli ─────────────────────────────── */

const documento = documentoFinto();
globalThis.document = documento;
globalThis.window = { location: { href: "" }, addEventListener() {} };
globalThis.location = { pathname: "/dashboardmodern" };
globalThis.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = new NodoFinto("shadow-root");
    /* La radice ombra sta dentro il pannello: quello che ci si attacca e'
     * attaccato quanto lo e' il pannello. */
    this.shadowRoot.parentNode = this;
    this.children = [this.shadowRoot];
    return this.shadowRoot;
  }
  get isConnected() {
    let nodo = this;
    while (nodo.parentNode) nodo = nodo.parentNode;
    return nodo.__radice === true;
  }
  get style() {
    return (this._style ||= {});
  }
};
globalThis.customElements = { get: () => undefined, define: () => {} };

const { DashboardModernPanel, profiloDellaPlancia } = await import("../panel.js");
const { mountLegacyHost } = await import("../src/legacy/host.js");

const connection = { sendMessagePromise: async () => ({}) };
const hass = { locale: { language: "it" }, user: { id: "u1" }, connection };
const panelInfo = {
  url_path: "dashboardmodern",
  config: {
    entry_ids: ["entry-1"],
    static_base: "/dashboardmodern_static/abc",
    legacy_variants: ["dashboard.html", "dashboard-en.html"],
    config_profile: "casa",
  },
};

/** Un pannello attaccato al documento, come lo attacca Home Assistant. */
function montaIlPannello(info = panelInfo) {
  const contenitore = new NodoFinto("ha-panel-custom");
  documento.body.append(contenitore);
  const pannello = new DashboardModernPanel();
  contenitore.append(pannello);
  pannello.parentNode = contenitore;
  pannello.panel = info;
  pannello.hass = hass;
  return { pannello, contenitore };
}

function ricoveroDelDocumento() {
  return documento.getElementById("dashboardmodern-ricovero");
}

/* ── la cornice si mette da parte, non si butta ──────────────────────────── */

test("chi parcheggia sposta la cornice nel ricovero e avvisa la plancia", () => {
  const container = new NodoFinto("div");
  documento.body.append(container);
  const host = mountLegacyHost(container, {
    hass,
    connection,
    staticBase: "/dashboardmodern_static/abc",
    documentRef: documento,
    hostWindow: globalThis.window,
  });
  const figlia = host.frame.contentWindow;
  const ricovero = new NodoFinto("div");
  documento.body.append(ricovero);

  assert.equal(host.parcheggia(ricovero), true);
  assert.equal(host.frame.parentNode, ricovero, "la cornice sta nel ricovero");
  assert.equal(host.frame.rimosso, undefined, "e non e' stata rimossa: sarebbe morta");
  /* Il velo del chiosco addosso al documento di Home Assistant se ne va: la
   * cornice esce di scena, anche se non muore. */
  assert.equal(figlia.eventi.includes("rilascio"), true);
  assert.equal(figlia[/* PARK_FLAG */ "__DASHBOARDMODERN_PARCHEGGIATA__"], true);
  assert.equal(figlia.eventi.includes("dashboardmodern:parcheggio"), true);

  const nuovo = new NodoFinto("div");
  documento.body.append(nuovo);
  assert.equal(host.riprendi(nuovo), true);
  assert.equal(host.frame.parentNode, nuovo);
  assert.equal(figlia.__DASHBOARDMODERN_PARCHEGGIATA__, false);
  /* Al ritorno la plancia si comporta come una pagina riaperta: e' l'avviso
   * che ogni sezione gia' ascolta per ridipingere con quello che c'e' adesso,
   * ed e' quello che rimette il chiosco addosso al documento ospite. */
  assert.equal(figlia.eventi.includes("pageshow"), true);
  /* Il ponte torna al suo posto nella finestra figlia. */
  assert.equal(figlia.__DASHBOARDMODERN_BRIDGED__, true);
  host.destroy();
});

test("senza spostamento atomico non si parcheggia niente", () => {
  /* Un browser senza `moveBefore` non sa spostare una cornice senza
   * ricaricarla: meglio dire di no e smontare come si e' sempre fatto, che
   * ritrovarsi una plancia bianca. */
  const container = new NodoFinto("div");
  documento.body.append(container);
  const host = mountLegacyHost(container, {
    hass,
    connection,
    staticBase: "/dashboardmodern_static/abc",
    documentRef: documento,
    hostWindow: globalThis.window,
  });
  const vecchio = { append: () => {} };
  assert.equal(host.parcheggia(vecchio), false);
  assert.equal(host.frame.parentNode, container, "la cornice non si e' mossa");
  host.destroy();
});

/* ── e il pannello che torna se la riprende ──────────────────────────────── */

test("tornando sulla plancia il pannello nuovo riprende quella di prima", () => {
  const primo = montaIlPannello();
  const cornice = primo.pannello.host.frame;
  assert.ok(cornice, "la plancia si e' montata");

  /* Home Assistant annuncia il cambio di pagina e poi toglie il pannello. */
  globalThis.location.pathname = "/config/dashboard";
  assert.equal(primo.pannello.parcheggia(), true);
  primo.contenitore.remove();
  assert.equal(primo.pannello.host, null, "il pannello non tiene piu' la plancia");
  assert.equal(cornice.parentNode, ricoveroDelDocumento(), "la cornice e' al riparo");
  assert.equal(ricoveroDelDocumento().style.display, "none");
  assert.equal(cornice.rimosso, undefined, "e non e' stata rimossa");

  /* Al ritorno Home Assistant costruisce un pannello NUOVO: quello ritrova la
   * plancia di prima invece di farne un'altra. */
  globalThis.location.pathname = "/dashboardmodern";
  const secondo = montaIlPannello();
  assert.equal(secondo.pannello.host.frame, cornice, "e' la stessa cornice di prima");
  assert.equal(cornice.parentNode.tagName, "DIV");
  assert.equal(cornice.isConnected, true, "ed e' di nuovo in scena");
  secondo.pannello.resetHost();
  secondo.contenitore.remove();
});

test("un'altra plancia non si riprende quella parcheggiata", () => {
  const primo = montaIlPannello();
  const cornice = primo.pannello.host.frame;
  globalThis.location.pathname = "/config/dashboard";
  primo.pannello.parcheggia();
  primo.contenitore.remove();

  /* Un altro entry e' un'altra plancia: quella da parte si smonta davvero,
   * perche' due cornici vive vorrebbero dire due plance che parlano con Home
   * Assistant per un pannello solo. */
  globalThis.location.pathname = "/dashboardmodern";
  const secondo = montaIlPannello({
    ...panelInfo,
    config: { ...panelInfo.config, entry_ids: ["entry-2"] },
  });
  assert.notEqual(secondo.pannello.host.frame, cornice);
  assert.equal(cornice.rimosso, true, "la plancia di prima e' stata smontata");
  secondo.pannello.resetHost();
  secondo.contenitore.remove();
});

test("una connessione nuova non si riprende la plancia di prima", () => {
  /* Il ponte della plancia parcheggiata parla con LA connessione con cui e'
   * nata. Se Home Assistant ne mette un'altra — una sessione nuova — quella
   * plancia parlerebbe con una presa che non c'e' piu': si ricostruisce. */
  const primo = montaIlPannello();
  const cornice = primo.pannello.host.frame;
  globalThis.location.pathname = "/config/dashboard";
  primo.pannello.parcheggia();
  primo.contenitore.remove();

  globalThis.location.pathname = "/dashboardmodern";
  const contenitore = new NodoFinto("ha-panel-custom");
  documento.body.append(contenitore);
  const pannello = new DashboardModernPanel();
  contenitore.append(pannello);
  pannello.parentNode = contenitore;
  pannello.panel = panelInfo;
  pannello.hass = { ...hass, connection: { sendMessagePromise: async () => ({}) } };
  assert.notEqual(pannello.host.frame, cornice);
  assert.equal(cornice.rimosso, true);
  pannello.resetHost();
  contenitore.remove();
});

test("il cambio d'indirizzo che resta sulla plancia non parcheggia niente", () => {
  const primo = montaIlPannello();
  const cornice = primo.pannello.host.frame;
  const dove = cornice.parentNode;
  globalThis.location.pathname = "/dashboardmodern/energia";
  /* E' il giro che il modulo fa a ogni `location-changed`: qui la pagina e'
   * ancora la nostra, quindi non si tocca niente. */
  assert.equal(primo.pannello.host.frame.parentNode, dove);
  assert.equal(
    profiloDellaPlancia(panelInfo, "dashboard.html", panelInfo.config.static_base),
    primo.pannello.chiave,
  );
  primo.pannello.resetHost();
  primo.contenitore.remove();
});
