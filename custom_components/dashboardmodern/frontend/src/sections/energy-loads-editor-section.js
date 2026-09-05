// DM-FIX-20260817B
/* The Loads editor, rebuilt around the stage it configures.
 *
 * The old panel asked for the same load twice: once as one of five fixed
 * "circles under Home" (name, icon, colour, and a dropdown pointing at a
 * group), and once as the group holding its appliances. Keeping the two halves
 * pointing at each other was manual, and the flow only ever had room for five.
 *
 * The stage is now drawn from the loads, so this panel is the same list: one
 * card per circle, in the order they appear under Home, each one carrying its
 * own appliances. The card opens with a preview of the bubble it draws — same
 * icon, same name, same colour — so the config and the picture read alike.
 *
 * Every write goes through the canonical `loads` section; the legacy popup keys
 * are re-derived from it on save. Event driven: no polling, no observer.
 */
import { openIconPicker } from "./icon-engine-section.js";
import { applianceArtwork } from "../core/appliance-artwork.js";
import { IMPIANTO_SCELTO_KEY, PRIMO_IMPIANTO, plantAt, plantLabel } from "../core/energy-plants.js";
import { createEntityPickerField } from "../core/renderers.js";
import {
  MAX_FLOW_LOADS,
  MAX_SUBLOADS,
  emptyLoad,
  emptySubload,
  loadConfigSummary,
  loadConfigWarnings,
  loadsConfigModel,
  loadsConfigToSections,
  moveLoad,
  normalizeChild,
} from "../core/energy-loads-config.js";
import {
  activeLocale,
  clean,
  dashboardStore,
  doc,
  english,
  installStyle,
  readJson,
  root,
  section,
  t,
  writeIconGlyph,
  writeJsonIfChanged,
} from "./shared.js";

root.__DM_20260817B__ = true;
const KEY = "__DASHBOARDMODERN_ENERGY_LOADS_EDITOR__";
const state = (root[KEY] ||= { installed: false, model: null, open: new Set(), dirty: false });

const PANEL = '[data-energy-panel="loads"]';

function configuredLoads() {
  const value = section("loads", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_loads", []);
  return Array.isArray(stored) ? stored : [];
}

/* Quale impianto sta configurando questa maschera.
 *
 * La stessa linguetta che sceglie il misuratore in cima alla sezione sceglie
 * anche i cerchi: si configura un impianto per volta, com'e' per il resto
 * dell'Energia. Con un impianto solo — chiunque non abbia chiesto il secondo —
 * qui esce il primo, e non cambia niente di niente. */
function impiantoAperto() {
  const scelto = clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));
  return plantAt(section("energy", {}) || {}, scelto);
}

/* Read once, from wherever the configuration currently lives, and keep editing
 * that model until it is saved. */
function readModel() {
  const { plant, index } = impiantoAperto();
  return loadsConfigModel({
    plant,
    plantIndex: index,
    loads: configuredLoads(),
    appliances: Array.isArray(section("appliances", null))
      ? section("appliances", [])
      : readJson("cd_appliances", []),
    flowNodes: readJson("cd_flow_nodes", null),
    groups: readJson("cd_subload_groups", []),
    subloads: readJson("cd_subloads_extra", null),
  });
}

/* La chiave dell'impianto che la maschera sta mostrando, per le bozze. */
function chiaveImpianto() {
  return clean(impiantoAperto()?.plant?.id);
}

function model() {
  if (!state.model) {
    state.model = readModel();
    state.impianto = chiaveImpianto();
  }
  return state.model;
}

function markDirty(panel) {
  state.dirty = true;
  render(panel);
}

/* Sporco senza ridisegnare.
 *
 * Le caselle delle entita' non possono chiamare `markDirty`: quello rifa'
 * l'intero pannello, e rifarlo mentre si sta scrivendo in un campo porta via
 * quello che si sta scrivendo. Per questo scrivevano solo `state.dirty = true`
 * — ma il tasto «Salva carichi» il suo `disabled` se l'era gia' preso al
 * disegno precedente, e nessuno glielo toglieva piu'.
 *
 * Cosi' svuotare la «Potenza istantanea» col cestino non si poteva salvare: il
 * tasto restava spento, e riaprendo la configurazione l'entita' era ancora li'.
 * «Io elimino l'entita' inserita per far usare il calcolo ma non la elimina.»
 * Qui si aggiornano i soli comandi, che e' tutto quello che cambia. */
function segnaSporco(panel) {
  state.dirty = true;
  const host = panel || doc?.querySelector?.('[data-energy-panel="loads"]');
  const save = host?.querySelector?.("[data-dm-loads-save]");
  if (save) save.disabled = false;
  const actions = save?.closest?.(".ed-action-bar");
  if (actions) actions.dataset.state = "dirty";
  const status = host?.querySelector?.("[data-dm-loads-status]");
  if (status) status.textContent = t("Modifiche non salvate", "Unsaved changes");
}

async function persist(panel) {
  const previous = configuredLoads();
  const { plant, list } = impiantoAperto();
  const chiave = plant ? (clean(plant.id) === PRIMO_IMPIANTO ? "" : clean(plant.id)) : null;
  const { loads, groups, subloads, flowNodes } = loadsConfigToSections(model(), previous, chiave);
  const store = dashboardStore();
  if (store?.replaceSection) await store.replaceSection("loads", loads);
  else writeJsonIfChanged("cd_loads", loads, { sync: false });
  /* Gli specchi legacy — il popup degli elettrodomestici li legge diretti —
   * si riscrivono interi con un impianto solo, com'e' sempre stato. Con piu'
   * di un impianto no: questa maschera ne ha mostrato uno, e riscriverli
   * interi cancellerebbe i gruppi dell'altro. Quelli che questo giro non ha
   * toccato restano dove sono. */
  const piuCase = list.length > 1;
  const gruppiPrima = piuCase ? readJson("cd_subload_groups", []) : [];
  const nomiNuovi = new Set(groups.map((voce) => clean(voce?.id)));
  const gruppiFinali = piuCase
    ? [
        ...(Array.isArray(gruppiPrima) ? gruppiPrima : []).filter(
          (voce) => !nomiNuovi.has(clean(voce?.id)),
        ),
        ...groups,
      ]
    : groups;
  const sottoPrima = piuCase ? readJson("cd_subloads_extra", null) : null;
  const sottoFinali =
    piuCase && sottoPrima && typeof sottoPrima === "object" && !Array.isArray(sottoPrima)
      ? { ...sottoPrima, ...subloads }
      : subloads;
  writeJsonIfChanged("cd_subload_groups", gruppiFinali, { sync: false });
  writeJsonIfChanged("cd_subloads_extra", sottoFinali, { sync: false });
  /* Lo specchio dei cerchi ha caselle posizionali — «boiler», «wb», «clima» —
   * e con due impianti i cerchi dell'uno e dell'altro chiedono le stesse:
   * scrivendolo a ogni salvataggio, l'ultimo impianto salvato dava il proprio
   * nome ai cerchi del primo. Non e' una casella per impianto, e non lo puo'
   * diventare: appartiene al primo, e salvando un altro impianto si lascia
   * dov'e'. */
  if (!piuCase || chiave === "" || chiave === null) writeJsonIfChanged("cd_flow_nodes", flowNodes);
  state.dirty = false;
  state.model = null;
  state.bozze?.delete?.(chiaveImpianto());
  root.dmRefreshEnergyFlows?.();
  root.render?.();
  render(panel);
  return true;
}

/* Gli elettrodomestici della loro sezione, letti da dove stanno.
 *
 * Non è una copia dei carichi: sono i dispositivi configurati sotto
 * Elettrodomestici, e questo editor li tocca in un punto solo — il metadato
 * che li mette dentro un cerchio. Tutto il resto resta di là. */
function elettrodomestici() {
  const stored = section("appliances", null);
  if (Array.isArray(stored)) return stored.slice();
  const legacy = readJson("cd_appliances", []);
  return Array.isArray(legacy) ? legacy : [];
}

/* Quelli che un carico può ancora adottare: configurati, con un nome, e non
 * già dentro un cerchio. L'indice è quello della lista salvata, perché la
 * scelta riscrive esattamente quella riga. */
function elettrodomesticiLiberi() {
  return elettrodomestici()
    .map((device, index) => ({ device, index }))
    .filter(
      ({ device }) => device && clean(device.name) && !clean(device.metadata?.beta27_subload_group),
    );
}

/* Se questo carico sta nell'impianto principale. Gli elettrodomestici non
 * hanno un campo impianto: appartengono tutti alla prima casa, e proporli per
 * un cerchio di un'altra li farebbe contare due volte dalla parte sbagliata. */
function caricoDelPrimoImpianto(load) {
  const suo = clean(load?.plant);
  return !suo || suo === PRIMO_IMPIANTO;
}

/* La scelta dal pulsante «Scegli da Elettrodomestici»: si scrive il metadato
 * sull'elettrodomestico e si salva la SUA sezione, per lo stesso percorso che
 * usa la modale dell'editor Elettrodomestici. Il carico non si sporca: la riga
 * che compare qui sotto è già persistita di là. */
/* La sezione Elettrodomestici riscritta: la stessa strada per chi entra in un
 * cerchio e per chi ne esce. */
async function scriviElettrodomestici(list) {
  const store = dashboardStore();
  if (store?.replaceSection) await store.replaceSection("appliances", list);
  else {
    writeJsonIfChanged("cd_appliances", list);
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  root.renderAppliances?.();
  root.renderApplianceSection?.(true);
  root.dmRefreshEnergyFlows?.();
}

/* Togliere un elettrodomestico dal cerchio non vuol dire cancellarlo.
 *
 * «Dalla sezione energia carichi non si possono eliminare gli elettrodomestici
 * inseriti in un carico»: il cestino mancava del tutto sulle righe «da
 * Elettrodomestici», e l'assegnazione era a senso unico. Quello che si toglie
 * è il cartellino che lo lega a questo cerchio — l'apparecchio resta
 * configurato nella sua sezione, con i suoi sensori, e torna disponibile per
 * un altro cerchio. Cancellarlo davvero è un gesto della sua sezione, non di
 * questa. */
async function togliElettrodomestico(panel, load, child, index) {
  const list = elettrodomestici();
  const at = list.findIndex(
    (device) =>
      device &&
      (clean(device.id) === clean(child.id) ||
        (!clean(device.id) && clean(device.name) === clean(child.name))),
  );
  if (at >= 0) {
    const { beta27_subload_group: _via, ...resto } = list[at].metadata || {};
    list[at] = { ...list[at], metadata: resto };
    await scriviElettrodomestici(list);
  }
  /* La riga se ne va anche dal modello che si ha in mano: una rilettura non la
   * rimetterebbe, ma con modifiche non salvate la rilettura non si fa. */
  const suo = load.children.indexOf(child);
  load.children.splice(suo < 0 ? index : suo, 1);
  if (!state.dirty) state.model = null;
  render(panel);
  return true;
}

async function assegnaElettrodomestico(panel, load, index) {
  if (load.children.length >= MAX_SUBLOADS) return false;
  const list = elettrodomestici();
  const device = list[index];
  if (!device) return false;
  const group = clean(load.group) || clean(load.id);
  list[index] = {
    ...device,
    metadata: { ...(device.metadata || {}), beta27_subload_group: group },
  };
  await scriviElettrodomestici(list);
  state.picking = "";
  if (state.dirty) {
    /* Un modello con modifiche in mano non si butta: la riga nuova si aggiunge
     * dove una rilettura l'avrebbe messa, nella stessa forma. */
    load.children.push(normalizeChild(list[index], load.children.length, "appliance"));
  } else {
    state.model = null;
  }
  render(panel);
  return true;
}

/* Il cerchio puo' essere una stanza intera: «flussi raggruppati per stanza,
 * cerchio = stanza col totale». La scelta vive in `metadata.flow_room` sul
 * carico canonico e si scrive subito, come l'assegnazione di un
 * elettrodomestico: gli apparecchi della stanza entrano da soli, anche
 * quelli configurati domani. */
function carichiCanonici() {
  const stored = section("loads", null);
  if (Array.isArray(stored)) return stored.slice();
  const legacy = readJson("cd_loads", []);
  return Array.isArray(legacy) ? legacy : [];
}

function stanzaDelCerchio(load) {
  const canonico = carichiCanonici().find((voce) => clean(voce.id) === clean(load.id));
  return clean(canonico?.metadata?.flow_room);
}

async function impostaStanzaDelCerchio(load, roomId) {
  const lista = carichiCanonici();
  const at = lista.findIndex((voce) => clean(voce.id) === clean(load.id));
  if (at < 0) return false;
  lista[at] = {
    ...lista[at],
    metadata: { ...(lista[at].metadata || {}), flow_room: clean(roomId) },
  };
  const store = dashboardStore();
  if (store?.replaceSection) await store.replaceSection("loads", lista);
  else {
    writeJsonIfChanged("cd_loads", lista);
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  }
  root.dmRefreshEnergyFlows?.();
  return true;
}

function stanzeDiCasa() {
  const stored = section("rooms", null);
  const lista = Array.isArray(stored) && stored.length ? stored : readJson("cd_stanze", []);
  return (Array.isArray(lista) ? lista : []).filter((voce) => clean(voce?.name));
}

function element(tag, className = "", text = "") {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function iconInto(target, icon) {
  writeIconGlyph(target, icon, { size: 24, kind: "load" });
}

/* The bubble this card will draw. Same icon, name and colour as the stage, so
 * a change here is recognisable there without saving first. */
function preview(load, index) {
  const node = element("div", "dm-loads-preview");
  node.style.setProperty("--dm-loads-color", load.color);
  node.dataset.dmLoadsVisible = load.visible ? "true" : "false";
  const bubble = element("span", "dm-loads-preview-bubble");
  iconInto(bubble, load.icon);
  const text = element("span", "dm-loads-preview-text");
  text.append(
    element("b", "", load.name),
    element("small", "", loadConfigSummary(load, activeLocale())),
  );
  node.append(element("span", "dm-loads-preview-index", String(index + 1)), bubble, text);
  return node;
}

function textField(
  label,
  value,
  onChange,
  { className = "ed-input", type = "text", hook = "" } = {},
) {
  const field = element("label", "ed-slot");
  field.append(element("span", "ed-slot-lbl", label));
  const input = doc.createElement("input");
  input.className = className;
  input.type = type;
  if (hook) input.dataset[hook] = "true";
  input.value = value || "";
  input.addEventListener("change", () => onChange(clean(input.value)));
  field.append(input);
  return field;
}

function entityField(id, label, value, hint, onChange) {
  const field = element("label", "ed-slot");
  const caption = element("span", "ed-slot-lbl", label);
  field.append(caption);
  if (hint) field.append(element("span", "ed-hint", hint));
  const { field: picker } = createEntityPickerField(doc, {
    id,
    value,
    label,
    locale: activeLocale(),
    placeholder: "sensor.entity",
    onPick: (input) => root.wzPickEntity?.(input),
    onChange,
  });
  field.append(picker);
  return field;
}

function warnings(load) {
  const messages = loadConfigWarnings(load, activeLocale());
  if (!messages.length) return null;
  const list = element("ul", "dm-loads-warnings");
  for (const message of messages) list.append(element("li", "", message));
  return list;
}

function subloadRow(panel, load, child, index) {
  const row = element("article", "ed-row dm-loads-subload");
  row.dataset.dmSubload = child.id;
  row.dataset.dmSubloadSource = child.source || "load";
  /* Lo stesso elettrodomestico, disegnato allo stesso modo.
   *
   * Qui usciva il carattere scritto nel campo — un'emoji — mentre la sezione
   * Elettrodomestici disegna il ritratto del catalogo. La stessa lavatrice
   * aveva due facce a seconda di dove la si guardava, e chi configura non ha
   * modo di sapere che sono la stessa. Quando il tipo si conosce si chiede il
   * ritratto a chi lo possiede; per tutto il resto resta il carattere. */
  const main = element("div", "ed-row-main");
  const title = element("div", "ed-row-new");
  const ritratto = child.visual ? applianceArtwork(child.visual, 26) : "";
  if (ritratto) {
    const segno = element("span", "dm-loads-subload-art");
    segno.innerHTML = ritratto;
    title.append(segno, doc.createTextNode(` ${child.name}`));
  } else {
    title.textContent = `${child.icon || "🔌"} ${child.name}`;
  }
  const detail = element("div", "ed-row-old mono");
  detail.textContent =
    [child.power, child.daily, child.monthly, child.total].filter(Boolean).join(" · ") ||
    t("nessuna entità", "no entity yet");
  main.append(title, detail);
  row.append(main);

  /* Assigned from the Appliances editor: it counts in the circle and shows in
   * the popup, but it is configured there, so this row only reports it. */
  if (child.source === "appliance") {
    detail.textContent =
      [child.power, child.daily, child.total].filter(Boolean).join(" · ") ||
      t("nessuna entità", "no entity yet");
    row.append(element("span", "dm-loads-source-tag", t("da Elettrodomestici", "from Appliances")));
    /* Si può anche toglierlo. Non si può modificarlo — quello si fa nella sua
     * sezione, ed è il senso del cartellino qui accanto — ma restare
     * incastrato nel cerchio in cui è finito non era una scelta di nessuno. */
    const stacca = element("button", "ed-del", "🗑️");
    stacca.type = "button";
    stacca.dataset.dmSubloadUnassign = "true";
    stacca.title = t("Togli dal carico", "Remove from the load");
    stacca.setAttribute(
      "aria-label",
      t(`Togli ${child.name} dal carico`, `Remove ${child.name} from the load`),
    );
    stacca.addEventListener("click", () => {
      const domanda = t(
        `Tolgo "${child.name}" da questo carico? Resta configurato in Elettrodomestici.`,
        `Remove "${child.name}" from this load? It stays configured under Appliances.`,
      );
      if (root.confirm && !root.confirm(domanda)) return;
      togliElettrodomestico(panel, load, child, index);
    });
    row.append(stacca);
    return [row];
  }

  const edit = element("button", "ed-del", "✏️");
  edit.type = "button";
  edit.dataset.dmSubloadEdit = "true";
  edit.title = t("Modifica", "Edit");
  edit.addEventListener("click", () => {
    state.editing = state.editing === child.id ? "" : child.id;
    render(panel);
  });
  const remove = element("button", "ed-del", "🗑️");
  remove.type = "button";
  remove.dataset.dmSubloadDelete = "true";
  remove.title = t("Elimina", "Delete");
  remove.addEventListener("click", () => {
    load.children.splice(index, 1);
    markDirty(panel);
  });
  row.append(edit, remove);

  if (state.editing !== child.id) return [row];

  const form = element("div", "ed-form dm-loads-subload-form");
  form.append(
    textField(
      t("Nome", "Name"),
      child.name,
      (value) => {
        child.name = value;
        markDirty(panel);
      },
      { hook: "dmSubloadName" },
    ),
    textField(
      t("Icona", "Icon"),
      child.icon,
      (value) => {
        child.icon = value;
        markDirty(panel);
      },
      { className: "ed-input ed-icon-input" },
    ),
    entityField(`dm-loads-${child.id}-power`, t("Potenza", "Power"), child.power, "", (value) => {
      child.power = value;
      segnaSporco(panel);
    }),
    entityField(
      `dm-loads-${child.id}-total`,
      t("Contatore totale", "Total meter"),
      child.total,
      t("Da qui si calcolano giorno e mese.", "Day and month are calculated from this one."),
      (value) => {
        child.total = value;
        segnaSporco(panel);
      },
    ),
  );
  const done = element("button", "ed-btn-secondary", t("Chiudi", "Close"));
  done.type = "button";
  done.dataset.dmSubloadDone = "true";
  done.addEventListener("click", () => {
    state.editing = "";
    render(panel);
  });
  form.append(done);
  return [row, form];
}

function loadCard(panel, load, index, total) {
  const card = element("details", "ed-acc dm-loads-card");
  card.dataset.dmLoad = load.id;
  card.open = state.open.has(load.id);
  card.addEventListener("toggle", () => {
    if (card.open) state.open.add(load.id);
    else state.open.delete(load.id);
  });

  const head = element("summary", "ed-acc-head");
  head.append(preview(load, index));
  const controls = element("span", "dm-loads-card-controls");
  for (const [symbol, delta, label] of [
    ["▲", -1, t("Sposta su", "Move up")],
    ["▼", 1, t("Sposta giù", "Move down")],
  ]) {
    const button = element("button", "ed-del", symbol);
    button.type = "button";
    button.title = label;
    button.disabled = (delta < 0 && index === 0) || (delta > 0 && index === total - 1);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.model = moveLoad(model(), load.id, delta);
      markDirty(panel);
    });
    controls.append(button);
  }
  const remove = element("button", "ed-del", "🗑️");
  remove.type = "button";
  remove.title = t("Elimina carico", "Delete load");
  remove.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.model = model().filter((item) => clean(item.id) !== clean(load.id));
    markDirty(panel);
  });
  controls.append(remove);
  head.append(controls);
  card.append(head);

  const body = element("div", "ed-acc-body");

  /* Name, icon and colour each get their own labelled row. Squeezed side by
   * side and unlabelled they were unreadable on a phone: the fields were there
   * but nothing said what they were, or that the icon could be picked. */
  const identity = element("section", "dm-loads-identity");

  /* La via rapida sta in cima, non in fondo.
   *
   * «Il menu a tendina cerchio = stanza va spostato in alto quando si sceglie
   * il nome del carico»: è la domanda che viene prima di tutte — questo
   * cerchio è una stanza, o è una linea? — e stava sotto l'elenco dei
   * dispositivi, dove la trovava solo chi scorreva fino in fondo. Chi sceglie
   * una stanza si è già dato il nome del carico, quindi il nome lo prende da
   * lì: era la seconda metà della stessa richiesta. */
  const stanze = stanzeDiCasa();
  const nameField = element("label", "ed-slot dm-loads-field");
  nameField.append(element("span", "ed-slot-lbl", t("Nome del carico", "Load name")));
  const name = doc.createElement("input");
  name.className = "ed-input";
  name.dataset.dmLoadName = "true";
  name.value = load.name;
  name.placeholder = t("Es. Cucina", "e.g. Kitchen");
  name.addEventListener("change", () => {
    load.name = clean(name.value);
    markDirty(panel);
  });
  nameField.append(name);

  let roomField = null;
  if (stanze.length && caricoDelPrimoImpianto(load)) {
    const riga = element("label", "ed-slot dm-loads-field dm-loads-room-circle");
    riga.append(element("span", "ed-slot-lbl", `🛋️ ${t("Cerchio = stanza", "Circle = room")}`));
    const scelta = doc.createElement("select");
    scelta.className = "ed-input";
    scelta.dataset.dmLoadRoom = "true";
    const salvata = stanzaDelCerchio(load);
    scelta.append(new Option(`— ${t("Nessuna", "None")} —`, ""));
    for (const stanza of stanze) {
      const valore = clean(stanza.id || stanza.name);
      scelta.append(new Option(stanza.name, valore, false, valore === salvata));
    }
    scelta.addEventListener("change", async () => {
      await impostaStanzaDelCerchio(load, scelta.value);
      /* Il cerchio è quella stanza: il nome è quello della stanza. Togliendo
       * la scelta il nome resta com'è — è già il nome di qualcosa. */
      const scelto = stanze.find((stanza) => clean(stanza.id || stanza.name) === scelta.value);
      if (!scelto) return;
      load.name = clean(scelto.name);
      name.value = load.name;
      /* Ridisegnare va bene: la scelta è già stata scritta, e il titolo della
       * scheda e la bolla di anteprima portano il nome nuovo. */
      markDirty(panel);
    });
    riga.append(scelta);
    riga.append(
      element(
        "small",
        "",
        t(
          "Gli elettrodomestici di quella stanza entrano nel cerchio da soli, anche quelli configurati domani; chi sta già in un altro cerchio non si conta due volte.",
          "The appliances of that room join the circle on their own, future ones included; anything already inside another circle is not counted twice.",
        ),
      ),
    );
    roomField = riga;
  }

  const iconField = element("label", "ed-slot dm-loads-field");
  iconField.append(element("span", "ed-slot-lbl", t("Icona", "Icon")));
  const iconRow = element("span", "dm-loads-icon-row");
  const icon = doc.createElement("input");
  icon.className = "ed-input dm-loads-icon-input";
  icon.id = `dm-loads-${load.id}-icon`;
  icon.dataset.dmLoadIcon = "true";
  icon.dataset.iconCategory = "load";
  icon.value = load.icon;
  icon.placeholder = "🍳 / mdi:stove";
  icon.addEventListener("input", () => iconInto(pick, clean(icon.value)));
  icon.addEventListener("change", () => {
    load.icon = clean(icon.value);
    markDirty(panel);
  });
  /* The canonical picker is opened directly instead of through the legacy
   * `.dm-icon-picker` hook: that class is decorated by another owner, which
   * repaints the button with its own preview markup and zeroes the font size,
   * so the button came out blank. Opening the picker by hand keeps the same
   * catalogue — it writes the glyph into this input and fires `change` — while
   * the button stays ours to draw. */
  const pick = element("button", "dm-loads-icon-btn");
  pick.type = "button";
  pick.dataset.dmLoadIconPick = "true";
  pick.title = t("Scegli icona", "Choose icon");
  pick.setAttribute("aria-label", t("Scegli icona", "Choose icon"));
  iconInto(pick, load.icon);
  pick.addEventListener("click", (event) => {
    event.preventDefault();
    openIconPicker(icon, "load");
  });
  iconRow.append(icon, pick);
  iconField.append(iconRow);
  iconField.append(
    element(
      "span",
      "ed-hint",
      t(
        "Un'emoji o un'icona mdi:. Tocca il riquadro accanto per sceglierla dal catalogo dei carichi.",
        "An emoji or an mdi: icon. Tap the box beside it to pick one from the load catalogue.",
      ),
    ),
  );

  const colorField = element("label", "ed-slot dm-loads-field dm-loads-color-field");
  colorField.append(element("span", "ed-slot-lbl", t("Colore", "Colour")));
  const color = doc.createElement("input");
  color.className = "dm-loads-color";
  color.type = "color";
  color.dataset.dmLoadColor = "true";
  color.value = load.color;
  color.addEventListener("change", () => {
    load.color = clean(color.value);
    markDirty(panel);
  });
  colorField.append(color);

  /* Il nome, la stanza quando c'è, poi icona e colore. */
  identity.append(nameField);
  if (roomField) identity.append(roomField);
  identity.append(iconField, colorField);
  body.append(identity);

  const visible = element("label", "dm-loads-switch");
  const toggle = doc.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = load.visible;
  toggle.dataset.dmLoadVisible = "true";
  toggle.addEventListener("change", () => {
    load.visible = toggle.checked;
    markDirty(panel);
  });
  visible.append(toggle, element("span", "", t("Mostra nel flusso", "Show in the flow")));
  body.append(visible);

  body.append(
    entityField(
      `dm-loads-${load.id}-power`,
      t("Potenza istantanea", "Instant power"),
      load.power,
      load.children.length && !clean(load.power)
        ? t(
            "Lascia vuoto e il cerchio vale la somma dei dispositivi qui sotto. Compilalo solo se hai una pinza amperometrica sull'intera linea.",
            "Leave it empty and the circle is the total of the appliances below. Fill it in only if a clamp meter covers the whole line.",
          )
        : t("Il valore della vista Istantaneo.", "What the Instant view shows."),
      (value) => {
        load.power = value;
        segnaSporco(panel);
      },
    ),
    entityField(
      `dm-loads-${load.id}-total`,
      t("Contatore energia totale", "Total energy meter"),
      load.total,
      t(
        "Cumulativo. Giorno e Mese si calcolano da qui come differenza Recorder, quindi non serve un sensore per periodo.",
        "Cumulative. Day and Month are calculated from it as a Recorder difference, so no per-period sensor is needed.",
      ),
      (value) => {
        load.total = value;
        segnaSporco(panel);
      },
    ),
  );

  const optional = element("details", "ed-acc dm-loads-optional");
  const optionalHead = element("summary", "ed-acc-head");
  optionalHead.append(
    element("span", "", t("Sensori di periodo (facoltativi)", "Period sensors (optional)")),
  );
  optional.append(optionalHead);
  const optionalBody = element("div", "ed-acc-body");
  optionalBody.append(
    element(
      "div",
      "ed-hint",
      t(
        "Solo se hai già un helper che misura il periodo. Senza, il periodo viene dal contatore totale.",
        "Only if you already have a helper measuring the period. Without one, the period comes from the total meter.",
      ),
    ),
    entityField(
      `dm-loads-${load.id}-daily`,
      t("Energia oggi", "Energy today"),
      load.daily,
      "",
      (value) => {
        load.daily = value;
        segnaSporco(panel);
      },
    ),
    entityField(
      `dm-loads-${load.id}-monthly`,
      t("Energia mese", "Energy this month"),
      load.monthly,
      "",
      (value) => {
        load.monthly = value;
        segnaSporco(panel);
      },
    ),
  );
  optional.append(optionalBody);
  body.append(optional);

  const notes = warnings(load);
  if (notes) body.append(notes);

  const children = element("section", "dm-loads-children");
  children.append(
    element("div", "ed-sec-title", t("Dispositivi dentro il carico", "Appliances inside the load")),
    element(
      "div",
      "ed-hint",
      t(
        "Sono le card del popup che si apre cliccando il cerchio nel flusso, e la somma di cui il cerchio è il totale. Un elettrodomestico assegnato a questo carico dall'editor Elettrodomestici compare qui da solo.",
        "These are the cards of the popup opened by clicking the circle in the flow, and the total the circle shows. An appliance assigned to this load from the Appliances editor appears here on its own.",
      ),
    ),
  );
  const list = element("div", "ed-list");
  if (!load.children.length)
    list.append(element("div", "ed-empty", t("Nessun dispositivo.", "No appliance yet.")));
  load.children.forEach((child, childIndex) =>
    list.append(...subloadRow(panel, load, child, childIndex)),
  );
  children.append(list);
  const addChild = element(
    "button",
    "ed-btn-add",
    `＋ ${t("Aggiungi dispositivo", "Add appliance")}`,
  );
  addChild.type = "button";
  addChild.dataset.dmSubloadAdd = "true";
  addChild.disabled = load.children.length >= MAX_SUBLOADS;
  addChild.addEventListener("click", () => {
    const child = emptySubload(load, activeLocale());
    load.children.push(child);
    state.editing = child.id;
    markDirty(panel);
  });
  const addRow = element("div", "dm-loads-add-row");
  addRow.append(addChild);

  if (!caricoDelPrimoImpianto(load)) {
    /* Un cerchio di un altro impianto non ha elettrodomestici da scegliere, e
     * un pulsante muto sembrerebbe rotto: al suo posto c'è il perché. */
    children.append(addRow);
    children.append(
      element(
        "div",
        "ed-hint dm-loads-pick-foreign",
        t(
          "Gli elettrodomestici non hanno un campo impianto: si possono scegliere solo per i carichi dell'impianto principale.",
          "Appliances carry no plant field: they can only be picked for the loads of the main plant.",
        ),
      ),
    );
    body.append(children);
    card.append(body);
    return card;
  }

  const pieno = load.children.length >= MAX_SUBLOADS;
  const scegli = element(
    "button",
    "ed-btn-add",
    pieno
      ? t(
          `Carico pieno: massimo ${MAX_SUBLOADS} dispositivi`,
          `Load full: at most ${MAX_SUBLOADS} appliances`,
        )
      : `＋ ${t("Scegli da Elettrodomestici", "Pick from Appliances")}`,
  );
  scegli.type = "button";
  scegli.dataset.dmSubloadPick = "true";
  /* Il tetto non si tronca in silenzio: a carico pieno il pulsante lo dice. */
  scegli.disabled = pieno;
  scegli.addEventListener("click", () => {
    state.picking = state.picking === load.id ? "" : load.id;
    render(panel);
  });
  addRow.append(scegli);
  children.append(addRow);

  if (state.picking === load.id && !pieno) {
    const picker = element("div", "ed-list dm-loads-appliance-picker");
    picker.dataset.dmAppliancePicker = "true";
    picker.append(
      element(
        "div",
        "ed-hint",
        t(
          "La scelta assegna l'elettrodomestico a questo carico: resta configurato nella sua sezione, e qui compare come riga «da Elettrodomestici».",
          "Choosing assigns the appliance to this load: it stays configured in its own section, and shows up here as a “from Appliances” row.",
        ),
      ),
    );
    const liberi = elettrodomesticiLiberi();
    if (!liberi.length)
      picker.append(
        element(
          "div",
          "ed-empty",
          t(
            "Nessun elettrodomestico libero: sono già tutti dentro un carico, o non ce n'è di configurati.",
            "No free appliance: they are all inside a load already, or none is configured.",
          ),
        ),
      );
    for (const { device, index: at } of liberi) {
      const choice = element("button", "ed-row dm-loads-appliance-choice");
      choice.type = "button";
      choice.dataset.dmApplianceChoice = String(at);
      const visual = clean(device.visual_key || device.device_type || device.icon);
      const ritratto = visual ? applianceArtwork(visual, 26) : "";
      if (ritratto) {
        const segno = element("span", "dm-loads-subload-art");
        segno.innerHTML = ritratto;
        choice.append(segno, element("span", "", clean(device.name)));
      } else {
        choice.textContent = `🔌 ${clean(device.name)}`;
      }
      choice.addEventListener("click", () => {
        void assegnaElettrodomestico(panel, load, at).catch((error) => {
          console.error("[DashboardModern] unable to assign the appliance", error);
        });
      });
      picker.append(choice);
    }
    children.append(picker);
  }

  body.append(children);

  card.append(body);
  return card;
}

export function renderEnergyLoadsEditor(panel = doc?.querySelector?.(PANEL)) {
  if (!panel || !doc) return false;
  if (state.rendering) return false;
  state.rendering = true;
  try {
    panel.dataset.dmLoadsEditor = "true";
    let host = panel.querySelector(":scope > [data-dm-loads-host]");
    if (!host) {
      host = doc.createElement("section");
      host.dataset.dmLoadsHost = "true";
      panel.append(host);
    }
    // Another renderer may have written the panel before standing down; this
    // owner is the only one allowed to describe a load.
    for (const node of [...panel.children]) if (node !== host) node.remove();
    host.replaceChildren();

    const values = model();
    host.append(
      element(
        "div",
        "ed-intro",
        t(
          "Ogni carico qui sotto è un cerchio del flusso Energia, sotto Casa, nell'ordine di questa lista. Quello che scrivi qui è quello che vedi nel flusso, e i dispositivi che gli assegni sono quelli che compaiono toccando il cerchio.",
          "Every load below is a circle of the Energy flow, under Home, in the order of this list. What you write here is what the flow shows, and the devices you file under it are the ones that appear when you tap the circle.",
        ),
      ),
    );

    /* Con due impianti la maschera ne mostra uno: lo dice, o un cerchio
     * aggiunto qui sembrerebbe sparito quando si torna sull'altra casa. */
    const { plant, list: impianti } = impiantoAperto();
    if (impianti.length > 1 && plant) {
      const quale = plantLabel(plant, impianti.indexOf(plant), t("Impianto", "Plant"));
      host.append(
        element(
          "div",
          "ed-hint dm-loads-plant",
          `${t("Carichi di", "Loads of")} ${quale} — ${t(
            "gli altri impianti hanno i loro, e questo salvataggio non li tocca",
            "the other plants have their own, and this save does not touch them",
          )}`,
        ),
      );
    }

    if (!values.length)
      host.append(
        element(
          "div",
          "ed-empty",
          t(
            "Nessun carico configurato: il flusso mostra solo Casa, Solare, Rete e Batteria.",
            "No load configured: the flow only shows Home, Solar, Grid and Battery.",
          ),
        ),
      );

    const list = element("div", "ed-list dm-loads-list");
    values.forEach((load, index) => list.append(loadCard(panel, load, index, values.length)));
    host.append(list);

    const add = element("button", "ed-btn-add", `＋ ${t("Aggiungi carico", "Add load")}`);
    add.type = "button";
    add.disabled = values.length >= MAX_FLOW_LOADS;
    add.dataset.dmLoadAdd = "true";
    add.addEventListener("click", () => {
      if (model().length >= MAX_FLOW_LOADS) return;
      const { plant } = impiantoAperto();
      const suo = plant && clean(plant.id) !== PRIMO_IMPIANTO ? clean(plant.id) : "";
      const load = emptyLoad(model(), activeLocale(), suo);
      state.model = [...model(), load];
      state.open.add(load.id);
      markDirty(panel);
    });
    host.append(add);
    if (values.length >= MAX_FLOW_LOADS)
      host.append(
        element(
          "div",
          "ed-hint",
          t(
            `Massimo ${MAX_FLOW_LOADS} carichi nel flusso.`,
            `At most ${MAX_FLOW_LOADS} loads fit in the flow.`,
          ),
        ),
      );

    const actions = element("div", "ed-action-bar");
    actions.dataset.state = state.dirty ? "dirty" : "clean";
    const save = element("button", "ed-save-btn", `💾 ${t("Salva carichi", "Save loads")}`);
    save.type = "button";
    save.dataset.dmLoadsSave = "true";
    save.disabled = !state.dirty;
    const status = doc.createElement("output");
    status.dataset.dmLoadsStatus = "true";
    status.textContent = state.dirty
      ? t("Modifiche non salvate", "Unsaved changes")
      : t("Tutto salvato", "All saved");
    save.addEventListener("click", () => {
      void persist(panel).catch((error) => {
        status.textContent = t("Salvataggio non riuscito", "Save failed");
        console.error("[DashboardModern] unable to save loads", error);
      });
    });
    actions.append(save, status);
    host.append(actions);
  } finally {
    state.rendering = false;
  }
  return true;
}

function render(panel) {
  renderEnergyLoadsEditor(panel);
}

function installStyles() {
  installStyle(
    "dm-energy-loads-editor-style",
    `
    /* The display rule must not defeat the panel's own hidden attribute: the
       editor set it once and the section then showed under Flows too. */
    [data-energy-panel="loads"][data-dm-loads-editor="true"]:not([hidden]){display:block!important}
    /* An mdi icon is resolved by the engine into its own glyph span: it takes
       the size of the box it sits in, so preview and button stay as drawn. */
    .dm-loads-preview-bubble .dm-icon-engine-glyph,.dm-loads-icon-btn .dm-icon-engine-glyph{font-size:inherit!important}
    .dm-loads-list{display:grid;gap:10px}
    .dm-loads-card>.ed-acc-head{display:flex;align-items:center;gap:10px;justify-content:space-between}
    .dm-loads-preview{display:flex;align-items:center;gap:10px;min-width:0}
    .dm-loads-preview-index{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--divider-color,#e2e8f0);color:var(--muted,#64748b);font-size:12px;font-weight:800}
    .dm-loads-preview-bubble{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;font-size:21px;background:color-mix(in srgb,var(--dm-loads-color,#0ea5e9) 16%,transparent);border:2px solid var(--dm-loads-color,#0ea5e9)}
    .dm-loads-preview[data-dm-loads-visible="false"] .dm-loads-preview-bubble{opacity:.42;border-style:dashed}
    .dm-loads-preview-text{display:flex;flex-direction:column;min-width:0}
    .dm-loads-preview-text b{color:var(--text,#0f172a);font-size:15px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-loads-preview-text small{color:var(--muted,#64748b);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-loads-card-controls{display:flex;gap:6px;flex:none}
    .dm-loads-card-controls button[disabled]{opacity:.35;pointer-events:none}
    .dm-loads-identity{display:grid;gap:12px;margin-bottom:4px}
    .dm-loads-field{display:grid;gap:6px;min-width:0}
    .dm-loads-field .ed-slot-lbl{color:var(--text,#0f172a);font-size:13px;font-weight:800;letter-spacing:.2px}
    .dm-loads-field .ed-input{width:100%;min-width:0;min-height:46px;box-sizing:border-box}
    .dm-loads-icon-row{display:grid!important;grid-template-columns:minmax(0,1fr) 56px!important;gap:10px!important;align-items:center!important}
    .dm-loads-icon-input{width:100%!important;min-width:0!important;flex:none!important;text-align:left!important;font-size:18px!important;color:var(--text,#0f172a)!important}
    .dm-loads-icon-btn{display:grid!important;place-items:center!important;width:56px!important;height:46px!important;padding:0!important;border:1px solid var(--border,rgba(15,23,42,.14))!important;border-radius:14px!important;background:var(--card-bg,#fff)!important;font-size:22px!important;line-height:1!important;color:var(--text,#0f172a)!important;cursor:pointer}
    .dm-loads-icon-btn svg,.dm-loads-icon-btn img{width:26px!important;height:26px!important}
    .dm-loads-color-field{grid-template-columns:minmax(0,1fr) 64px;align-items:center}
    .dm-loads-color{width:64px;height:46px;padding:2px;border:1px solid var(--border,rgba(15,23,42,.14));border-radius:12px;background:var(--card-bg,#fff)}
    .dm-loads-switch{display:flex;align-items:center;gap:9px;margin:10px 0;color:var(--text,#0f172a);font-weight:700}
    .dm-loads-warnings{margin:10px 0 0;padding-left:18px;color:var(--muted,#64748b);font-size:13px;line-height:1.45}
    .dm-loads-children{margin-top:14px}
    .dm-loads-subload[data-dm-subload-source="appliance"]{opacity:.9}
    /* Il ritratto dell'elettrodomestico sta sulla riga come ci stava l'emoji:
       alto quanto il testo, allineato con lui. */
    .dm-loads-subload-art{display:inline-grid;place-items:center;width:26px;height:26px;vertical-align:-6px}
    .dm-loads-subload-art svg{display:block;width:100%;height:100%}
    .dm-loads-source-tag{flex:none;padding:4px 10px;border-radius:999px;background:var(--divider-color,#e2e8f0);color:var(--muted,#64748b);font-size:11px;font-weight:800;letter-spacing:.3px}
    .dm-loads-subload-form{margin:0 0 10px;padding:12px;border-radius:14px;background:color-mix(in srgb,var(--card-bg,#fff) 92%,var(--divider-color,#e2e8f0))}
    /* I due modi di aggiungere stanno fianco a fianco, e vanno a capo dove il
       telefono non ha posto per tutti e due. */
    .dm-loads-add-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .dm-loads-add-row .ed-btn-add[disabled]{opacity:.55;cursor:default}
    .dm-loads-appliance-picker{margin-top:8px;padding:10px;border:1px solid var(--divider-color,#e2e8f0);border-radius:14px;background:color-mix(in srgb,var(--card-bg,#fff) 92%,var(--divider-color,#e2e8f0))}
    .dm-loads-appliance-choice{display:flex;align-items:center;gap:8px;width:100%;text-align:left;cursor:pointer;color:var(--text,#0f172a)}
    .dm-loads-pick-foreign{margin-top:6px}
    /* The phone is exactly where the three squeezed fields were unreadable, so
       there is no narrow variant that puts them back side by side. */
    /* Sullo stretto il riquadro dell'icona va sopra, largo quanto la riga.
       Accanto alla casella era un quadratino di cinquanta pixel, e con i
       caratteri grandi di sistema finiva schiacciato contro la pastiglia del
       colore: il dito mirava all'icona che vedeva e non trovava il tasto —
       «non si può cambiare icona del carico, non esce il catalogo». Adesso
       quello che si vede e' il tasto, e la casella per scriverla a mano sta
       sotto. */
    @media(max-width:640px){
      .dm-loads-color-field{grid-template-columns:minmax(0,1fr) 56px}
      .dm-loads-icon-row{grid-template-columns:minmax(0,1fr)!important;gap:8px!important}
      .dm-loads-icon-btn{grid-row:1!important;width:100%!important;height:52px!important;font-size:26px!important}
      .dm-loads-icon-input{grid-row:2!important}
    }
  `,
  );
}

function panelNode() {
  return doc?.querySelector?.(PANEL) || null;
}

function scheduleRender() {
  root.queueMicrotask?.(() => {
    const panel = panelNode();
    // A pending edit must survive background re-renders triggered by unrelated
    // runtime work; only a clean panel is rebuilt from storage.
    if (panel && !state.dirty) {
      state.model = null;
      render(panel);
    } else if (panel) render(panel);
  });
}

export function installEnergyLoadsEditor() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  root.dmRenderEnergyLoadsEditor = (target) => renderEnergyLoadsEditor(target || undefined);
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-energy-tab],.ed-inner-tab,[data-tab='sez1']"))
        scheduleRender();
    },
    true,
  );
  for (const name of ["dashboardmodern:runtime-ready", "dashboardmodern:legacy-ready"])
    root.addEventListener?.(name, scheduleRender);
  /* Cambiato impianto, cambiano i carichi (#292, dal campo): «passando da un
   * impianto all'altro con la scheda Carichi aperta si vedono ancora i carichi
   * dell'impianto precedente». Il modello in mano era di quell'altro impianto:
   * si butta — salvarlo adesso vorrebbe dire scriverlo nell'impianto sbagliato
   * — e si rilegge quello giusto. */
  root.addEventListener?.("dashboardmodern:energy-plant-changed", () => {
    /* Le modifiche non ancora salvate non si perdono (revisione della 1.4.7):
     * la bozza dell'impianto che si lascia si mette da parte, e tornandoci si
     * ritrova com'era — col tasto «Salva carichi» ancora acceso. */
    const adesso = chiaveImpianto();
    state.bozze ||= new Map();
    if (state.dirty && state.model && state.impianto !== undefined)
      state.bozze.set(state.impianto, state.model);
    const bozza = state.bozze.get(adesso) || null;
    state.bozze.delete(adesso);
    state.model = bozza;
    state.dirty = Boolean(bozza);
    state.impianto = adesso;
    scheduleRender();
  });
  scheduleRender();
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyLoadsEditor, { once: true });
else installEnergyLoadsEditor();
