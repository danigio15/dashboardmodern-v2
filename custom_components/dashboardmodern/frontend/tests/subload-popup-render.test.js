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
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
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
body.append(title, list);

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
