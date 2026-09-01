// DM-FIX-20260817D
/* The popup renderer against a minimal DOM shim: the heading names the circle
 * that was clicked, as the stage resolved it, and `mdi:` tokens are drawn as
 * glyphs rather than printed as text. */
import assert from "node:assert/strict";
import test from "node:test";

class ClassList {
  constructor(node) {
    this.node = node;
  }
  #set() {
    return new Set(String(this.node.className || "").split(/\s+/).filter(Boolean));
  }
  add(...names) {
    const set = this.#set();
    names.forEach((name) => set.add(name));
    this.node.className = [...set].join(" ");
  }
  toggle(name, force) {
    const set = this.#set();
    if (force) set.add(name);
    else set.delete(name);
    this.node.className = [...set].join(" ");
  }
  contains(name) {
    return this.#set().has(name);
  }
}

/* `data-dm-subload-card` → `dmSubloadCard`, come fa il browser. */
const datasetKey = (attributo) =>
  attributo.replace(/^data-/, "").replace(/-([a-z0-9])/g, (_intero, lettera) => lettera.toUpperCase());

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.classList = new ClassList(this);
    this.style = { values: new Map(), setProperty(k, v) { this.values.set(k, String(v)); }, getPropertyValue(k) { return this.values.get(k) || ""; }, getPropertyPriority() { return ""; }, removeProperty(k) { this.values.delete(k); } };
    this.id = "";
    this.hidden = false;
    this.textContent = "";
    this._html = "";
    this.listeners = new Map();
  }
  /* `append` di un nodo che sta gia' da qualche parte lo SPOSTA, non lo copia:
   * e' su questo che il popup rimette le carte in classifica senza rifarle. Un
   * finto DOM che invece lo duplicasse racconterebbe una bugia comoda. */
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement)
        node.parentElement.children = node.parentElement.children.filter((altro) => altro !== node);
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const node of this.children) node.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }
  /* Il browser ce l'ha, e adesso il popup lo usa: una carta che se ne va se ne
   * va da sola, senza portarsi dietro le altre. Un finto DOM senza `remove`
   * farebbe passare per buona proprio la riga che non funziona. */
  remove() {
    const padre = this.parentElement;
    if (!padre) return;
    padre.children = padre.children.filter((nodo) => nodo !== this);
    this.parentElement = null;
  }
  addEventListener(name, handler) {
    this.listeners.set(name, handler);
  }
  set innerHTML(value) {
    this._html = value;
  }
  get innerHTML() {
    return this._html;
  }
  descendants(out = []) {
    for (const child of this.children) {
      out.push(child);
      child.descendants(out);
    }
    return out;
  }
  /* Classi e attributi `data-*`. Gli attributi servono davvero: il popup
   * cerca le carte con `[data-dm-subload-card]` per travasarci dentro i valori
   * nuovi, e un finto DOM che li ignorasse restituirebbe sempre la lista vuota
   * — cioe' non farebbe mai passare la strada veloce, che e' proprio quella
   * che queste prove devono guardare. */
  matches(selector) {
    const attributo = selector.match(/^\[([a-z0-9-]+)\]$/i);
    if (attributo) return datasetKey(attributo[1]) in this.dataset;
    return this.classList.contains(selector.replace(/^\./, ""));
  }
  querySelector(selector) {
    return this.descendants().find((node) => node.matches(selector)) || null;
  }
  querySelectorAll(selector) {
    return this.descendants().filter((node) => node.matches(selector));
  }
}

const body = new Element("body");
const list = new Element("div");
list.id = "subloads-list";
const title = new Element("h3");
title.id = "subloads-title";
title.textContent = "CARICHI";
/* La finestra vera: chi ridisegna a sveglia suonata guarda se e' in scena, e
 * ridisegnare una finestra chiusa e' lavoro buttato. */
const modale = new Element("div");
modale.id = "subloads-modal";
modale.classList.add("show");
body.append(title, list, modale);

globalThis.document = {
  documentElement: Object.assign(new Element("html"), { lang: "it" }),
  head: new Element("head"),
  body,
  createElement: (tag) => new Element(tag),
  getElementById: (id) => body.descendants().find((node) => node.id === id) || null,
  querySelector: () => null,
  addEventListener() {},
};

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

// The dashboard's canonical mdi renderer; the popup must go through it.
globalThis.cdIconMarkup = (icon, size) => `<svg data-icon="${icon}" data-size="${size}"></svg>`;

const sections = { loads: [], appliances: [] };
globalThis.DashboardModernModules = { store: { getSection: (name) => sections[name] } };
globalThis.__HASS__ = { states: {} };

const popup = await import("../src/sections/subload-popup-section.js");
const { resetRunHolds } = await import("../src/core/appliance-view-model.js");

function configure({ loads = [], appliances = [], states = {}, flowNodes = null } = {}) {
  sections.loads = loads;
  sections.appliances = appliances;
  globalThis.__HASS__ = { states };
  storage.clear();
  if (flowNodes) storage.set("cd_flow_nodes", JSON.stringify(flowNodes));
}

const KITCHEN = [
  { id: "cucina", name: "Cucina", icon: "🍳", order: 0 },
  {
    id: "forno",
    name: "Forno",
    power_entity: "sensor.forno_power",
    metadata: { beta27_subload_group: "cucina" },
  },
];

test("the heading names the circle that was clicked, with its period", () => {
  configure({ loads: KITCHEN, states: { "sensor.forno_power": { state: "1800" } } });
  assert.equal(popup.renderSubloadPopup("cucina"), true);

  assert.equal(title.dataset.dmSubloadTitle, "cucina");
  const name = title.querySelector(".dm-subload-title-name");
  assert.equal(name.textContent, "CUCINA");
  assert.equal(title.querySelector(".dm-subload-title-period").textContent, "ISTANTANEO");

  // The period views open the same circle with a suffixed group.
  popup.renderSubloadPopup("cucina_month");
  assert.equal(title.querySelector(".dm-subload-title-period").textContent, "MESE");
});

test("a circle renamed by a saved flow-node customization keeps that name in the popup", () => {
  // The stage shows `override.name` before the customization has been folded
  // into the load; the popup must not head with the canonical name instead.
  configure({
    loads: KITCHEN,
    flowNodes: { boiler: { name: "Cucina di sotto", icon: "🔥" } },
    states: {},
  });
  popup.renderSubloadPopup("cucina");
  assert.equal(title.querySelector(".dm-subload-title-name").textContent, "CUCINA DI SOTTO");
  assert.equal(title.querySelector(".dm-subload-title-icon").textContent, "🔥");
});

test("an mdi token is drawn as a glyph, in the title and in every card", () => {
  configure({
    loads: [
      { id: "cucina", name: "Cucina", icon: "mdi:stove", order: 0 },
      {
        id: "forno",
        name: "Forno",
        icon: "mdi:toaster-oven",
        power_entity: "sensor.forno_power",
        metadata: { beta27_subload_group: "cucina" },
      },
    ],
    states: { "sensor.forno_power": { state: "1800" } },
  });
  popup.renderSubloadPopup("cucina");

  const titleIcon = title.querySelector(".dm-subload-title-icon");
  assert.equal(titleIcon.textContent, "", "the token is not printed as text");
  assert.match(titleIcon.innerHTML, /data-icon="mdi:stove"/);
  assert.match(list.querySelector(".dm-subload-summary-icon").innerHTML, /mdi:stove/);
  assert.match(list.querySelector(".dm-subload-icon").innerHTML, /mdi:toaster-oven/);
});

test("where the icon engine is installed, it is what resolves an mdi token", () => {
  // `<ha-icon>` is the fallback, not the first choice: on the device it paints
  // an empty box, so the popup must draw the glyph the picker showed.
  const asked = [];
  globalThis.DashboardModernIconEngine = {
    render: (target, kind, value, options) => {
      asked.push([kind, value, options?.size]);
      target.innerHTML = '<span class="dm-icon-engine-glyph">🚘</span>';
      return true;
    },
  };
  try {
    configure({
      loads: [
        { id: "cucina", name: "Cucina", icon: "mdi:car-electric", order: 0 },
        {
          id: "forno",
          name: "Forno",
          power_entity: "sensor.forno_power",
          metadata: { beta27_subload_group: "cucina" },
        },
      ],
      states: { "sensor.forno_power": { state: "1800" } },
    });
    popup.renderSubloadPopup("cucina");

    const icon = title.querySelector(".dm-subload-title-icon");
    assert.deepEqual(asked[0], ["load", "mdi:car-electric", 24]);
    assert.match(icon.innerHTML, /🚘/);
    assert.doesNotMatch(icon.innerHTML, /data-icon=/, "the legacy markup is not used");
  } finally {
    delete globalThis.DashboardModernIconEngine;
  }
});

test("an emoji is still written as text, not through the mdi renderer", () => {
  configure({ loads: KITCHEN, states: {} });
  popup.renderSubloadPopup("cucina");
  const icon = title.querySelector(".dm-subload-title-icon");
  assert.equal(icon.textContent, "🍳");
  assert.equal(icon.innerHTML, "");
});

/* ── il travaso non deve mentire ────────────────────────────────────────────
 *
 * Il popup si aggiorna in due modi: rifacendo la lista, o travasando i valori
 * nei nodi che ci sono gia' (e' quello che ha tolto lo sfarfallio). Il travaso
 * pero' tocca solo quello che ha davanti: se cambia la FORMA — una riga che
 * compare, un cerchio che cambia nome — travasare lascia sullo schermo una
 * cosa vecchia. Queste due prove sono i due casi trovati.
 */
const CUCINA_CON_GIORNO = [
  { id: "cucina", name: "Cucina", icon: "🍳", order: 0 },
  {
    id: "forno",
    name: "Forno",
    power_entity: "sensor.forno_power",
    daily_energy_entity: "sensor.forno_oggi",
    metadata: { beta27_subload_group: "cucina" },
  },
];

test("la riga dei kWh di oggi compare e sparisce davvero", () => {
  configure({
    loads: CUCINA_CON_GIORNO,
    states: { "sensor.forno_power": { state: "1800" } },
  });
  popup.renderSubloadPopup("cucina");
  assert.equal(list.querySelector(".dm-subload-daily"), null, "senza dato, nessuna riga");

  /* Il dato arriva a popup aperto: la carta deve guadagnare la riga. */
  globalThis.__HASS__ = {
    states: { "sensor.forno_power": { state: "1800" }, "sensor.forno_oggi": { state: "2.4" } },
  };
  popup.renderSubloadPopup("cucina");
  const riga = list.querySelector(".dm-subload-daily");
  assert.ok(riga, "col dato, la riga c'e'");
  assert.match(riga.textContent, /2[.,]4/);

  /* E se il sensore smette di rispondere la riga se ne va, invece di restare
   * li' col numero di prima. */
  globalThis.__HASS__ = { states: { "sensor.forno_power": { state: "1800" } } };
  popup.renderSubloadPopup("cucina");
  assert.equal(list.querySelector(".dm-subload-daily"), null, "senza dato la riga sparisce");
});

/* ── il lampo bianco del filmato ────────────────────────────────────────────
 *
 * A finestra aperta e ferma, la griglia delle carte spariva per un fotogramma
 * solo e tornava: sei volte in dieci secondi, al passo degli aggiornamenti che
 * arrivano da casa. In mezzo restava la sola fascia del totale sul bianco.
 *
 * Il lampo e' quello che si vede in mezzo a un `replaceChildren` sulla lista:
 * la finestra sta dentro un velo sfocato, che sul telefono e' un livello a se',
 * e finche' il livello non e' ridipinto resta il bianco del foglio. Sul
 * computer non si vede — ridipinge in tempo — ed e' per questo che il difetto
 * e' sempre sembrato «solo del telefono».
 *
 * A far rifare la lista bastava la riga dei kWh di oggi che appariva o
 * spariva. Queste prove marcano i nodi e pretendono di ritrovare GLI STESSI —
 * non copie appena stampate.
 */
const marca = (dove) => {
  const carte = dove.querySelectorAll("[data-dm-subload-card]");
  carte.forEach((nodo) => {
    nodo.__segno = true;
  });
  return carte.length;
};
const superstiti = (dove) =>
  dove.querySelectorAll("[data-dm-subload-card]").filter((nodo) => nodo.__segno === true).length;

const DUE_IN_CUCINA = [
  { id: "cucina", name: "Cucina", icon: "🍳", order: 0 },
  {
    id: "forno",
    name: "Forno",
    power_entity: "sensor.forno_power",
    daily_energy_entity: "sensor.forno_oggi",
    metadata: { beta27_subload_group: "cucina" },
  },
  {
    id: "lavastoviglie",
    name: "Lavastoviglie",
    power_entity: "sensor.lav_power",
    daily_energy_entity: "sensor.lav_oggi",
    metadata: { beta27_subload_group: "cucina" },
  },
];

test("un contatore giornaliero che sparisce non porta giu' tutte le carte", () => {
  configure({
    loads: DUE_IN_CUCINA,
    states: {
      "sensor.forno_power": { state: "1800" },
      "sensor.forno_oggi": { state: "2.4" },
      "sensor.lav_power": { state: "60" },
      "sensor.lav_oggi": { state: "0.9" },
    },
  });
  popup.renderSubloadPopup("cucina");
  assert.equal(marca(list), 2, "le due carte ci sono");

  /* Il contatore del forno risponde «non disponibile» per un giro: la riga dei
   * kWh sparisce da quella carta, e basta. */
  globalThis.__HASS__ = {
    states: {
      "sensor.forno_power": { state: "1800" },
      "sensor.lav_power": { state: "60" },
      "sensor.lav_oggi": { state: "0.9" },
    },
  };
  popup.renderSubloadPopup("cucina");
  assert.equal(superstiti(list), 2, "le carte sono state buttate via e ristampate: e' il lampo");
  assert.equal(
    list.querySelectorAll("[data-dm-subload-card]").length,
    2,
    "e nemmeno se ne sono aggiunte",
  );

  /* E quando il dato torna, la riga si rimette senza rifare niente. */
  globalThis.__HASS__ = {
    states: {
      "sensor.forno_power": { state: "1800" },
      "sensor.forno_oggi": { state: "2.6" },
      "sensor.lav_power": { state: "60" },
      "sensor.lav_oggi": { state: "0.9" },
    },
  };
  popup.renderSubloadPopup("cucina");
  assert.equal(superstiti(list), 2, "al ritorno del dato le carte si sono rifatte");
});

test("nemmeno la fascia del totale si rifa', e il totale nuovo c'e' lo stesso", () => {
  /* Nel filmato la fascia resta e sparisce la sola griglia, perche' il velo
   * sfocato ridipinge prima il pezzo piccolo. Ma a rifarsi erano tutt'e due:
   * qui si guarda la fascia mentre cambia la forma delle carte, che e' il caso
   * in cui prima si buttava via tutto. */
  configure({
    loads: DUE_IN_CUCINA,
    states: {
      "sensor.forno_power": { state: "1800" },
      "sensor.forno_oggi": { state: "2.4" },
      "sensor.lav_power": { state: "60" },
    },
  });
  popup.renderSubloadPopup("cucina");
  const fascia = list.querySelector(".dm-subload-summary");
  assert.ok(fascia, "la fascia c'e'");
  fascia.__segno = true;

  /* Alla lavastoviglie arriva il suo contatore giornaliero: la sua carta
   * guadagna una riga, e prima questo bastava a ristampare tutto. */
  globalThis.__HASS__ = {
    states: {
      "sensor.forno_power": { state: "1500" },
      "sensor.forno_oggi": { state: "2.4" },
      "sensor.lav_power": { state: "0" },
      "sensor.lav_oggi": { state: "0.3" },
    },
  };
  popup.renderSubloadPopup("cucina");
  assert.equal(
    list.querySelector(".dm-subload-summary").__segno,
    true,
    "la fascia e' stata rifatta",
  );
  assert.match(
    list.querySelector(".dm-subload-total-value").textContent,
    /1[.,]?5/,
    "ma il totale nuovo ci deve essere lo stesso",
  );
  assert.equal(
    list.querySelectorAll(".dm-subload-daily").length,
    2,
    "e la riga nuova e' comparsa dove serviva",
  );
});

test("un apparecchio che se ne va se ne va da solo", () => {
  configure({
    loads: DUE_IN_CUCINA,
    states: { "sensor.forno_power": { state: "1800" }, "sensor.lav_power": { state: "60" } },
  });
  popup.renderSubloadPopup("cucina");
  assert.equal(marca(list), 2);

  sections.loads = DUE_IN_CUCINA.filter((voce) => voce.id !== "lavastoviglie");
  popup.renderSubloadPopup("cucina");
  const rimaste = list.querySelectorAll("[data-dm-subload-card]");
  assert.equal(rimaste.length, 1, "ne resta una");
  assert.equal(rimaste[0].dataset.dmSubloadCard, "forno");
  assert.equal(rimaste[0].__segno, true, "e quella che resta e' lo stesso nodo di prima");
});

test("il tasto dello storico segue il sensore, anche se cambia a finestra aperta", () => {
  /* L'ascoltatore del clic si mette una volta e resta. Se si tenesse stretto
   * l'apparecchio com'era il giorno in cui la carta e' stata stampata, un
   * sensore cambiato — un salvataggio nell'editor, una configurazione arrivata
   * da un altro dispositivo — lascerebbe la carta a mostrare il valore nuovo e
   * ad aprire lo storico di quello vecchio. */
  configure({
    loads: [
      { id: "cucina", name: "Cucina", icon: "🍳", order: 0 },
      {
        id: "forno",
        name: "Forno",
        power_entity: "sensor.forno_power",
        metadata: { beta27_subload_group: "cucina" },
      },
    ],
    states: { "sensor.forno_power": { state: "1800" } },
  });
  popup.renderSubloadPopup("cucina");
  const carta = list.querySelector("[data-dm-subload-card]");
  const chiesti = [];
  const primaApriStorico = globalThis.apriStorico;
  globalThis.apriStorico = (_evento, entita, nome) => chiesti.push([entita, nome]);
  try {
    carta.listeners.get("click")({});
    assert.deepEqual(chiesti.at(-1), ["sensor.forno_power", "Forno"]);

    /* Cambia il sensore, non l'identificativo: la carta e' la stessa e si
     * aggiorna dov'e'. */
    sections.loads[1] = {
      id: "forno",
      name: "Forno nuovo",
      power_entity: "sensor.forno_power_2",
      metadata: { beta27_subload_group: "cucina" },
    };
    globalThis.__HASS__ = { states: { "sensor.forno_power_2": { state: "1500" } } };
    popup.renderSubloadPopup("cucina");
    assert.equal(
      list.querySelector("[data-dm-subload-card]"),
      carta,
      "la carta e' stata ristampata: la prova non guarda piu' il caso giusto",
    );
    carta.listeners.get("click")({});
    assert.deepEqual(
      chiesti.at(-1),
      ["sensor.forno_power_2", "Forno nuovo"],
      "il tasto apre lo storico del sensore di prima",
    );
  } finally {
    globalThis.apriStorico = primaApriStorico;
  }
});

test("la sveglia del ritardo di fine ciclo ridisegna la finestra aperta", () => {
  /* Il ritardo di fine ciclo scade da solo, e quando scade nessuno manda
   * niente: la lavastoviglie che ha finito di asciugare non cambia stato in
   * Home Assistant, e' il tempo che passa. Senza iscriversi alla sveglia, una
   * finestra lasciata aperta resta ferma a quello che diceva. */
  resetRunHolds();
  globalThis.__DASHBOARDMODERN_SUBLOAD_POPUP__.group = "cucina";
  const carico = [
    { id: "cucina", name: "Cucina", icon: "🍳", order: 0 },
    {
      id: "lavastoviglie",
      name: "Lavastoviglie",
      power_entity: "sensor.lav_power",
      off_delay_minutes: 30,
      metadata: { beta27_subload_group: "cucina" },
    },
  ];
  const conWatt = (valore) => ({
    "sensor.lav_power": { state: String(valore), attributes: { unit_of_measurement: "W" } },
  });
  configure({ loads: carico, states: conWatt(900) });
  popup.renderSubloadPopup("cucina");

  const primaSetTimeout = globalThis.setTimeout;
  const sveglie = [];
  globalThis.setTimeout = (callback) => {
    sveglie.push(callback);
    return sveglie.length;
  };
  try {
    // Smette di consumare: il ritardo parte e mette la sua sveglia.
    globalThis.__HASS__ = { states: conWatt(0) };
    popup.renderSubloadPopup("cucina");
    assert.equal(list.querySelector(".dm-subload-power").textContent, "0 W");
    assert.ok(sveglie.length > 0, "il ritardo in corso non ha messo nessuna sveglia");

    /* Fra la sveglia messa e la sveglia che suona i watt cambiano, e nessuno
     * ridisegna: e' quello che succede a una finestra lasciata aperta. */
    globalThis.__HASS__ = { states: conWatt(900) };
    assert.equal(list.querySelector(".dm-subload-power").textContent, "0 W");

    sveglie[0]();
    assert.equal(
      list.querySelector(".dm-subload-power").textContent,
      "900 W",
      "alla sveglia la finestra non si e' ridisegnata",
    );
  } finally {
    globalThis.setTimeout = primaSetTimeout;
    resetRunHolds();
    globalThis.__DASHBOARDMODERN_SUBLOAD_POPUP__.group = "";
  }
});

test("rinominare il cerchio a popup aperto cambia la testata", () => {
  configure({ loads: KITCHEN, states: { "sensor.forno_power": { state: "1800" } } });
  popup.renderSubloadPopup("cucina");
  assert.equal(title.querySelector(".dm-subload-title-name").textContent, "CUCINA");

  /* Gli apparecchi non cambiano: cambia solo il nome. Con la firma che
   * guardava i soli identificativi, il travaso saltava la testata e la
   * finestra restava intestata «CUCINA» fino alla riapertura. */
  storage.set("cd_flow_nodes", JSON.stringify({ boiler: { name: "Cucina nuova", icon: "🔥" } }));
  popup.renderSubloadPopup("cucina");
  assert.equal(title.querySelector(".dm-subload-title-name").textContent, "CUCINA NUOVA");
  assert.equal(title.querySelector(".dm-subload-title-icon").textContent, "🔥");
});

/* ── il «fleak» del video ───────────────────────────────────────────────────
 *
 * Il guscio ha un suo disegnatore, `renderSubLoads`, che fa una cosa sola:
 * `subloads-list.innerHTML = html`. E il battito degli stati lo richiama a
 * popup aperto, a ogni giro. Le carte moderne venivano spazzate via e rimesse
 * subito dopo: nel video la griglia sparisce e torna, e in mezzo resta la sola
 * fascia del totale sul bianco. Rimetterle dopo non basta — fra lo strappo e
 * il rimedio ci sta un fotogramma. Qui si pretende che lo strappo non avvenga.
 */
test("il disegnatore del guscio non svuota piu' la lista a ogni battito", () => {
  configure({ loads: KITCHEN, states: { "sensor.forno_power": { state: "1800" } } });

  let scrittureDelGuscio = 0;
  globalThis.renderSubLoads = function () {
    scrittureDelGuscio += 1;
    list.replaceChildren();
  };
  /* La sezione si e' gia' installata: si riapre la porta per farle agganciare
   * il disegnatore appena definito, come fa la plancia quando il guscio
   * arriva dopo i moduli. */
  globalThis.__DASHBOARDMODERN_SUBLOAD_POPUP__.installed = false;
  popup.installSubloadPopupSection();
  popup.renderSubloadPopup("cucina");
  const prima = list.children.length;
  assert.ok(prima > 0, "le carte moderne ci sono");

  /* Il battito degli stati: il guscio chiama il suo disegnatore. */
  globalThis.renderSubLoads("cucina");
  assert.equal(scrittureDelGuscio, 0, "il guscio non ha scritto: la finestra e' nostra");
  assert.equal(
    list.children.length,
    prima,
    "e la lista e' rimasta piena, senza sparire e ricomparire",
  );

  /* Un tipo di sotto-carichi che non e' nostro resta al guscio, come prima. */
  globalThis.renderSubLoads("un_gruppo_che_non_esiste");
  assert.equal(scrittureDelGuscio, 1, "quello che non sappiamo disegnare lo disegna il guscio");
});
