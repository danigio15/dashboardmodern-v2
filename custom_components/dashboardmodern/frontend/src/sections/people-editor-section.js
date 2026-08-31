/* La configurazione delle persone.
 *
 * La scheda non esiste nel documento vendorizzato: si aggiunge qui, accanto
 * alle altre, e si comporta come le altre — l'elenco di chi c'e', la matita
 * per aprire una riga, un salvataggio per persona.
 *
 * Ogni persona ha un'entita' (`person.*`, o `device_tracker.*` per chi non ha
 * creato le persone in Home Assistant) e un ritratto. Il ritratto si sceglie
 * in due modi: una foto vera — presa dalle cartelle di Home Assistant o
 * caricata dal telefono, con lo stesso selettore della foto dell'auto — oppure
 * un avatar fatto qui: un'emoji o le iniziali, su un colore a scelta. Quando
 * la foto c'e', vince lei; togliendola ricompare l'avatar.
 *
 * Il pulsante «importa» evita di scrivere a mano cio' che Home Assistant sa
 * gia': prende ogni `person.*` non ancora in elenco, col suo nome e la sua
 * foto del profilo.
 */
import {
  BARBE,
  CAPELLI,
  CARNAGIONI,
  COLLANE,
  COLORI_BARBA,
  COLORI_CAPELLI,
  COLORI_OCCHI,
  COLORI_VESTITO,
  OCCHIALI,
  PERSONE,
  VESTITI,
  avatar3dACaso,
  normalizeAvatar3d,
  personaHaCapelli,
  vestitoRicolorabile,
} from "../core/avatar-3d.js";
import {
  AVATAR_COLORS,
  detectCompanionSensors,
  normalizePeople,
  personInitials,
  suggestPeople,
} from "../core/person-model.js";
import { pickMediaImage } from "./media-picker-section.js";
import { installAvatar3dStyle, ritrattoFermo, ritrattoVivo } from "./person-avatar-section.js";
import {
  allStates,
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

const KEY = "__DASHBOARDMODERN_PEOPLE_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

/* Le facce tra cui scegliere l'avatar. Il picker delle icone della plancia
 * parla di prese e lampadine: per una persona servono persone. Curate a mano,
 * per categorie: espressioni, gente di casa, mestieri, e qualche animale per
 * chi non si prende sul serio. */
export const AVATAR_EMOJI = Object.freeze([
  "😀",
  "😊",
  "😎",
  "🥰",
  "😇",
  "🤓",
  "🥳",
  "😴",
  "🤠",
  "🥸",
  "🤗",
  "😜",
  "👨",
  "👩",
  "🧑",
  "👦",
  "👧",
  "👶",
  "👴",
  "👵",
  "🧔",
  "👱‍♀️",
  "👱‍♂️",
  "🧑‍🦰",
  "👨‍🦱",
  "👩‍🦱",
  "👨‍🦳",
  "👩‍🦳",
  "👨‍🦲",
  "🧑‍🦱",
  "👩‍🦰",
  "🧕",
  "👳‍♂️",
  "👲",
  "🧒",
  "🧓",
  "👨‍💻",
  "👩‍💻",
  "👨‍🍳",
  "👩‍🍳",
  "👨‍⚕️",
  "👩‍⚕️",
  "👨‍🏫",
  "👩‍🏫",
  "👷‍♂️",
  "👷‍♀️",
  "👮‍♂️",
  "👮‍♀️",
  "👨‍🔧",
  "👩‍🔧",
  "👨‍🚒",
  "👩‍🚒",
  "👨‍✈️",
  "👩‍✈️",
  "👨‍🎨",
  "👩‍🎨",
  "🧑‍🌾",
  "🧑‍🎓",
  "🦸‍♂️",
  "🦸‍♀️",
  "🐱",
  "🐶",
  "🦊",
  "🐼",
  "🐨",
  "🦁",
  "🐯",
  "🐸",
  "🐧",
  "🦄",
  "🐢",
  "🦉",
]);

export const PEOPLE_EDITOR_TAB = "people";
const ENTITY_RE = /^(person|device_tracker)\.[a-z0-9_]+$/i;

function lista() {
  return normalizePeople(readJson("cd_people", []));
}

function salva(people) {
  writeJsonIfChanged("cd_people", normalizePeople(people));
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function nomeDi(person, index) {
  return clean(person.name) || clean(person.entity) || `${t("Persona", "Person")} ${index + 1}`;
}

/* Lo stesso ritratto della card, in piccolo: quello che si sta scegliendo si
 * vede qui, non dopo aver chiuso l'editor. */
function ritratto(person) {
  const avatar = `<span class="dm-people-ed-avatar"${person.avatar.face ? ' data-ritratto="true"' : ""} style="--dm-person-color:${esc(person.avatar.color)}">${
    person.avatar.face
      ? ""
      : person.avatar.emoji
        ? esc(person.avatar.emoji)
        : `<b>${esc(personInitials(person.name))}</b>`
  }</span>`;
  const photo = person.photo ? `<img src="${esc(person.photo)}" alt="">` : "";
  return `<span class="dm-people-ed-portrait" data-person-portrait>${avatar}${photo}</span>`;
}

/* Il campo di un'entita' e' una casella e basta: la veste — la pastiglia
 * «Scegli entità», la matita — gliela mette la passata che uniforma tutti i
 * campi dell'editor. Un pulsante nostro accanto sarebbe un secondo modo di
 * fare la stessa cosa, vestito diverso. */
function campoEntita(id, field, label, value, placeholder, hint) {
  return `<label class="ed-slot dm-people-field"><span class="ed-slot-lbl">${esc(label)}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" data-person-field="${esc(field)}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"></span>
    ${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
}

/* ── Il costruttore della faccia ──────────────────────────────────────────
 *
 * Come i Memoji: si parte da una faccia di default e si cambia un pezzo alla
 * volta — carnagione, taglio e colore dei capelli, occhi, bocca, barba,
 * occhiali — con l'anteprima che respira davanti. Ogni pezzo e' una fila di
 * campioncini: i colori come pastiglie, i tagli e i lineamenti come mini
 * facce, disegnate dallo stesso motore della card cosi' quello che si sceglie
 * e' esattamente quello che si vedra'. */

/* ── Il costruttore del ritratto ──────────────────────────────────────────
 *
 * Le file del ritratto, nell'ordine in cui si legge una persona: chi sei,
 * che taglio porti, la barba, i colori, gli occhi, gli accessori, la
 * carnagione, il vestito e il suo colore. Ogni pastiglia non e' un'icona:
 * e' il TUO ritratto con quel pezzo addosso, composto dallo stesso motore
 * che disegna la card. Quello che scegli e' esattamente quello che vedrai.
 *
 * Tre eccezioni, tutte volute:
 *  - le file «a teste nude» (persona, capelli, carnagione) mostrano render
 *    semplici, senza il vestito corrente: si sta scegliendo una testa, e
 *    trentacinque cuochi diversi solo per il cranio confondono l'occhio;
 *  - «Colore barba» compare solo con una barba addosso, e «Colore vestito»
 *    solo sui busti che si lasciano ricolorare: una fila senza effetto e'
 *    una bugia disegnata;
 *  - «Colore occhi» e' una fila di cerchi, come lo sfondo: un'iride in una
 *    pastiglia da quarantasei pixel non si vedrebbe.
 *
 * Le pastiglie si riempiono dopo, quando le immagini sono arrivate: comporre
 * ottanta ritratti mentre la scheda sta comparendo vorrebbe dire una scheda
 * che si apre in ritardo, e non vale.
 */
function fileRitratto(face) {
  const conCapelli = personaHaCapelli(face.persona);
  return [
    {
      k: "persona",
      label: t("Persona", "Person"),
      valori: [...PERSONE],
      nomi: NOMI_PERSONE,
      nudo: true,
    },
    ...(conCapelli
      ? [
          {
            k: "capelli",
            label: t("Capelli", "Hair"),
            valori: [...CAPELLI],
            nomi: NOMI_CAPELLI,
            nudo: true,
          },
        ]
      : []),
    { k: "barba", label: t("Barba", "Beard"), valori: [...BARBE], nomi: NOMI_BARBE },
    ...(conCapelli
      ? [
          {
            k: "coloreCapelli",
            label: t("Colore capelli", "Hair color"),
            valori: [...COLORI_CAPELLI],
            nomi: NOMI_COLORI_CAPELLI,
          },
        ]
      : []),
    ...(face.barba !== "nessuna"
      ? [
          {
            k: "coloreBarba",
            label: t("Colore barba", "Beard color"),
            valori: [...COLORI_BARBA],
            nomi: NOMI_COLORI_BARBA,
          },
        ]
      : []),
    {
      k: "occhi",
      label: t("Colore occhi", "Eye color"),
      valori: [...COLORI_OCCHI],
      nomi: NOMI_OCCHI,
      cerchi: OCCHI_CERCHI,
    },
    { k: "occhiali", label: t("Occhiali", "Glasses"), valori: [...OCCHIALI], nomi: NOMI_OCCHIALI },
    { k: "collana", label: t("Collana", "Necklace"), valori: [...COLLANE], nomi: NOMI_COLLANE },
    {
      k: "carnagione",
      label: t("Carnagione", "Skin tone"),
      valori: [...CARNAGIONI],
      nomi: NOMI_CARNAGIONI,
      nudo: true,
    },
    { k: "vestito", label: t("Vestito", "Outfit"), valori: [...VESTITI], nomi: NOMI_VESTITI },
    ...(vestitoRicolorabile(face.vestito)
      ? [
          {
            k: "coloreVestito",
            label: t("Colore vestito", "Outfit color"),
            valori: [...COLORI_VESTITO],
            nomi: NOMI_COLORI_VESTITO,
          },
        ]
      : []),
  ];
}

const NOMI_PERSONE = () => ({
  uomo: t("Uomo", "Man"),
  donna: t("Donna", "Woman"),
  neutro: t("Neutro", "Neutral"),
  ragazzo: t("Ragazzo", "Boy"),
  ragazza: t("Ragazza", "Girl"),
  anziano: t("Anziano", "Old man"),
  anziana: t("Anziana", "Old woman"),
});
const NOMI_CAPELLI = () => ({
  lisci: t("Lisci", "Straight"),
  ricci: t("Ricci", "Curly"),
  calvo: t("Calvo", "Bald"),
});
const NOMI_BARBE = () => ({
  nessuna: t("Nessuna", "None"),
  rasata: t("Rasata", "Stubble"),
  corta: t("Corta", "Short"),
  lunga: t("Lunga", "Long"),
});
const NOMI_COLORI_CAPELLI = () => ({
  naturale: t("Naturale", "Natural"),
  biondo: t("Biondo", "Blonde"),
  rosso: t("Rosso", "Red"),
  bianco: t("Bianco", "White"),
  castano: t("Castano", "Brown"),
  rame: t("Rame", "Copper"),
  grigio: t("Grigio", "Gray"),
  rosa: t("Rosa", "Pink"),
});
const NOMI_COLORI_BARBA = () => ({
  naturale: t("Naturale", "Natural"),
  grigia: t("Grigia", "Gray"),
  bionda: t("Bionda", "Blonde"),
  rame: t("Rame", "Copper"),
  castana: t("Castana", "Brown"),
});
const NOMI_OCCHI = () => ({
  marrone: t("Marroni", "Brown"),
  verde: t("Verdi", "Green"),
  azzurro: t("Azzurri", "Blue"),
  grigio: t("Grigi", "Gray"),
  nero: t("Neri", "Black"),
});
/* I cerchi della fila «Colore occhi»: l'iride, non una pastiglia-ritratto. */
const OCCHI_CERCHI = Object.freeze({
  marrone: "#5b4132",
  verde: "#3a6b48",
  azzurro: "#3f74b5",
  grigio: "#7d8794",
  nero: "#26221f",
});
const NOMI_OCCHIALI = () => ({
  nessuno: t("Nessuno", "None"),
  tondi: t("Tondi", "Round"),
  quadrati: t("Quadrati", "Square"),
  sole: t("Da sole", "Sunglasses"),
});
const NOMI_COLLANE = () => ({
  nessuna: t("Nessuna", "None"),
  catenina: t("Catenina", "Chain"),
  pendente: t("Pendente", "Pendant"),
});
const NOMI_COLORI_VESTITO = () => ({
  blu: t("Blu", "Blue"),
  verde: t("Verde", "Green"),
  rosso: t("Rosso", "Red"),
  giallo: t("Giallo", "Yellow"),
  viola: t("Viola", "Purple"),
  grigio: t("Grigio", "Gray"),
});
const NOMI_CARNAGIONI = () => ({
  chiara: t("Chiara", "Light"),
  chiara2: t("Chiara+", "Light+"),
  media: t("Media", "Medium"),
  ambrata: t("Ambrata", "Tan"),
  scura: t("Scura", "Dark"),
});
const NOMI_VESTITI = () => ({
  nessuno: t("Nessuno", "None"),
  ufficio: t("Ufficio", "Office"),
  medico: t("Medico", "Doctor"),
  cuoco: t("Cuoco", "Chef"),
  smoking: t("Smoking", "Tuxedo"),
  velo: t("Velo", "Veil"),
  pompiere: t("Pompiere", "Firefighter"),
  poliziotto: t("Poliziotto", "Police"),
  muratore: t("Muratore", "Builder"),
  operaio: t("Operaio", "Worker"),
  meccanico: t("Meccanico", "Mechanic"),
  contadino: t("Contadino", "Farmer"),
  pilota: t("Pilota", "Pilot"),
  astronauta: t("Astronauta", "Astronaut"),
  giudice: t("Giudice", "Judge"),
  supereroe: t("Supereroe", "Superhero"),
  scienziato: t("Scienziato", "Scientist"),
  insegnante: t("Insegnante", "Teacher"),
  studente: t("Studente", "Student"),
  informatico: t("Informatico", "Technologist"),
  artista: t("Artista", "Artist"),
  cantante: t("Cantante", "Singer"),
  guardia: t("Guardia", "Guard"),
  detective: t("Detective", "Detective"),
  turbante: t("Turbante", "Turban"),
  supercattivo: t("Supercattivo", "Supervillain"),
  mago: t("Mago", "Mage"),
  fata: t("Fata", "Fairy"),
  vampiro: t("Vampiro", "Vampire"),
  elfo: t("Elfo", "Elf"),
  casual: t("Casual", "Casual"),
  saluto: t("Saluto", "Wave"),
  polo: t("Polo", "Polo"),
  camicia: t("Camicia", "Shirt"),
  attesa: t("In attesa", "Expecting"),
});

function builderMarkup(person) {
  const face = person.avatar.face;
  if (!face)
    return `<button type="button" class="ed-btn-add dm-face-create" data-face-create>🧑‍🎨 ${t("Crea il ritratto", "Create the portrait")}</button>
      <small>${t("Oppure scrivi un'emoji qui sotto — o lascia vuoto per le iniziali del nome.", "Or type an emoji below — or leave it empty for the initials of the name.")}</small>`;
  const righe = fileRitratto(face)
    .map(({ k, label, valori, nomi, nudo, cerchi }) => {
      const etichette = nomi();
      const opzioni = valori
        .map((valore) => {
          if (cerchi)
            /* Un cerchio pieno, come la fila dello sfondo: la scelta e' un
             * colore, non un ritratto. */
            return `<button type="button" class="dm-people-color dm-face-dot${face[k] === valore ? " on" : ""}" data-face-k="${k}" data-face-v="${esc(valore)}" style="--dm-person-color:${esc(cerchi[valore])}" aria-label="${esc(`${label}: ${etichette[valore] || valore}`)}"></button>`;
          /* Le file «a teste nude» mostrano la testa che si sta scegliendo,
           * senza il vestito corrente addosso; le altre restano il ritratto
           * intero con quel pezzo cambiato. */
          const scelta = nudo
            ? { ...face, [k]: valore, vestito: "nessuno" }
            : { ...face, [k]: valore };
          return `<button type="button" class="dm-face-opt${face[k] === valore ? " on" : ""}" data-face-k="${k}" data-face-v="${esc(valore)}" data-face-anteprima="${esc(JSON.stringify(scelta))}" aria-label="${esc(`${label}: ${etichette[valore] || valore}`)}"><span class="dm-face-opt-img"></span><i>${esc(etichette[valore] || valore)}</i></button>`;
        })
        .join("");
      return `<div class="dm-face-row"><span class="dm-face-row-lbl">${esc(label)}<b>${valori.length}</b></span><span class="dm-face-row-opts${cerchi ? " dm-face-row-dots" : ""}">${opzioni}</span></div>`;
    })
    .join("");
  return `<div class="dm-face-workbench">
      <span class="dm-face-preview" data-face-anteprima-viva style="--dm-person-color:${esc(clean(person.avatar.color) || "#0ea5e9")}"></span>
      <div class="dm-face-side">
        <button type="button" class="ed-btn-add dm-face-dice" data-face-random>🎲 ${t("Sorteggia", "Shuffle")}</button>
        <small>${t(
          "Qualunque testa su qualunque vestito: i pezzi si combinano liberamente.",
          "Any head on any outfit: the pieces combine freely.",
        )}</small>
      </div>
    </div>
    <div class="dm-face-rows">${righe}</div>
    <button type="button" class="dm-face-remove" data-face-clear>✕ ${t("Togli il ritratto (torna a emoji o iniziali)", "Remove the portrait (back to emoji or initials)")}</button>`;
}

/* I sensori facoltativi del telefono, con le parole dell'editor: etichetta e
 * un esempio come segnaposto. L'ordine e' quello in cui compaiono. */
function sensoriCampi(index, person) {
  const campi = [
    ["batteryState", t("In carica", "Charging"), "sensor.telefono_battery_state"],
    ["watch", t("Batteria orologio", "Watch battery"), "sensor.watch_battery_level"],
    ["distance", t("Distanza da casa", "Distance from home"), "sensor.telefono_distance"],
    ["travel", t("Tempo di rientro", "Time to home"), "sensor.waze_casa"],
    ["direction", t("Direzione", "Direction"), "sensor.home_direction_of_travel"],
    [
      "address",
      t("Posizione (indirizzo)", "Location (address)"),
      "sensor.telefono_geocoded_location",
    ],
    ["activity", t("Attività", "Activity"), "sensor.telefono_activity"],
    ["wifi", t("Rete WiFi", "WiFi network"), "sensor.telefono_wifi_connection"],
  ];
  return campi
    .map(([field, label, placeholder]) =>
      campoEntita(
        `dm-person-${index}-${field}`,
        field,
        label,
        person[field] || "",
        placeholder,
        "",
      ),
    )
    .join("");
}

function rigaMarkup(person, index) {
  const aperto = state.aperto === index;
  const colori = AVATAR_COLORS.map(
    (color) =>
      `<button type="button" class="dm-people-color${person.avatar.color === color ? " on" : ""}" data-person-color="${esc(color)}" style="--dm-person-color:${esc(color)}" aria-label="${esc(color)}"></button>`,
  ).join("");
  return `<article class="ed-row dm-people-row" data-person-index="${index}" data-open="${aperto}">
    <div class="dm-people-row-head">
      ${ritratto(person)}
      <span class="ed-row-main"><strong class="ed-row-new">${esc(nomeDi(person, index))}</strong><small class="ed-row-old mono">${esc(clean(person.entity) || t("nessuna entità", "no entity"))}</small></span>
      <button type="button" class="ed-del" data-person-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del" data-person-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-people-row-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-people-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-person-${index}-name" class="ed-input" data-person-field="name" value="${esc(clean(person.name))}" placeholder="${t("Chi è, col suo nome di casa", "Who this is, by their home name")}"></span></label>
      ${campoEntita(`dm-person-${index}-entity`, "entity", t("Entità persona", "Person entity"), person.entity, "person.nome", t("È l'entità person.* di Home Assistant, oppure un device_tracker.*.", "The person.* entity from Home Assistant, or a device_tracker.*."))}
      ${campoEntita(`dm-person-${index}-battery`, "battery", t("Batteria (facoltativa)", "Battery (optional)"), person.battery, "sensor.telefono_battery_level", t("Il sensore di batteria del telefono. Senza, la card usa quella che l'entità conosce già.", "The phone battery sensor. Without it, the card uses what the entity already knows."))}
      <details class="ed-acc dm-people-sensors"><summary class="ed-acc-head">📡 ${t("Sensori del telefono", "Phone sensors")}</summary><div class="ed-acc-body">
        <small class="dm-people-sensors-intro">${t(
          "I sensori della Companion App, di Waze o di Proximity: compila quelli che hai, oppure lasciali trovare al pulsante. Il viaggio e l'indirizzo compaiono sulla card solo quando la persona è fuori.",
          "The Companion App, Waze or Proximity sensors: fill the ones you have, or let the button find them. The journey and the address only appear on the card when the person is away.",
        )}</small>
        <button type="button" class="ed-btn-add dm-people-detect" data-person-detect>🪄 ${t("Rileva dal telefono", "Detect from the phone")}</button>
        ${sensoriCampi(index, person)}
      </div></details>
      <div class="ed-slot dm-people-field"><span class="ed-slot-lbl">${t("Foto", "Photo")}</span>
        <input type="hidden" data-person-field="photo" value="${esc(person.photo)}">
        <span class="ed-form-row dm-people-photo-row">
          <button type="button" class="ed-btn-add dm-people-photo-btn" data-person-photo>📁 ${t("Scegli la foto", "Choose the photo")}</button>
          <button type="button" class="ed-btn-add dm-people-photo-btn dm-people-photo-clear" data-person-photo-clear${person.photo ? "" : " hidden"}>✕ ${t("Togli la foto", "Remove the photo")}</button>
        </span>
        <small>${t("Con una foto l'avatar non si vede: la foto vince.", "With a photo the avatar is not shown: the photo wins.")}</small>
      </div>
      <div class="ed-slot dm-people-field"><span class="ed-slot-lbl">${t("Avatar (senza foto)", "Avatar (without a photo)")}</span>
        <input type="hidden" data-person-field="color" value="${esc(person.avatar.color)}">
        <input type="hidden" data-person-field="face" value="${esc(person.avatar.face ? JSON.stringify(person.avatar.face) : "")}">
        <div class="dm-face-builder" data-face-builder>${builderMarkup(person)}</div>
        <span class="ed-form-row"><input id="dm-person-${index}-emoji" class="ed-input dm-people-emoji" data-person-field="emoji" value="${esc(person.avatar.emoji)}" placeholder="${t("Vuoto: le iniziali del nome", "Empty: the initials of the name")}" autocomplete="off" spellcheck="false"><button type="button" class="dm-people-pick" data-person-emoji="dm-person-${index}-emoji" aria-label="${t("Scegli un'emoji", "Choose an emoji")}">😀</button></span>
        <span class="dm-face-row-lbl">${t("Sfondo", "Background")}</span>
        <span class="dm-people-colors">${colori}</span>
      </div>
      <output class="dm-people-error" data-person-error></output>
      <button type="button" class="ed-save-btn" data-person-save>💾 ${t("Salva persona", "Save person")}</button>
    </div>
  </article>`;
}

function bodyMarkup(people) {
  return `<div class="ed-intro">${t(
    "Le persone di casa: dove sono, da quanto tempo, e la batteria del telefono. Ogni persona ha la sua card in cima alla Home, con una foto vera o un avatar.",
    "The people of the house: where they are, for how long, and their phone battery. Each person gets a card at the top of Home, with a real photo or an avatar.",
  )}</div>
    <div class="ed-list dm-people-list">${
      people.length
        ? people.map((person, index) => rigaMarkup(person, index)).join("")
        : `<div class="ed-empty">${t("Nessuna persona configurata", "No people configured")}</div>`
    }</div>
    <div class="ed-form-row dm-people-actions">
      <button type="button" class="ed-btn-add" data-person-add>＋ ${t("Aggiungi persona", "Add person")}</button>
      <button type="button" class="ed-btn-add dm-people-import" data-person-import>⤵️ ${t("Importa da Home Assistant", "Import from Home Assistant")}</button>
    </div>`;
}

/* Quello che c'e' scritto adesso in TUTTE le righe.
 *
 * Serve a due gesti diversi, e per lo stesso motivo: perche' subito dopo la
 * scheda si ridisegna, e il ridisegno riscrive le caselle con quello che c'e'
 * in memoria. Chi non ha ancora detto la sua la perde.
 *
 * Le righe si prendono solo se l'entita' regge: sostituire una scelta buona
 * con una casella svuotata per sbaglio sarebbe peggio del silenzio. La riga su
 * cui si sta agendo la legge chi chiama, che sa anche come dirle di no. */
function raccogliRighe(body, people, esclusa = -1) {
  const next = people.slice();
  for (const riga of body?.querySelectorAll?.("[data-person-index]") || []) {
    const posizione = Number(riga.dataset.personIndex);
    if (!Number.isFinite(posizione) || !people[posizione] || posizione === esclusa) continue;
    const bozza = leggiRiga(riga, people[posizione]);
    /* La bozza vince se la sua entita' regge — o se quella salvata non c'era
     * comunque: la persona APPENA creata, ancora senza entita', non deve
     * perdere il nome appena scritto solo perche' l'entita' arriva dopo. */
    if (ENTITY_RE.test(bozza.entity) || !clean(people[posizione].entity)) next[posizione] = bozza;
  }
  return next;
}

function leggiRiga(riga, person) {
  const next = { ...person, avatar: { ...person.avatar } };
  for (const input of riga.querySelectorAll("[data-person-field]")) {
    const field = clean(input.dataset.personField);
    const value = clean(input.value);
    if (field === "emoji") next.avatar.emoji = value;
    else if (field === "color") next.avatar.color = value;
    else if (field === "face") {
      try {
        next.avatar.face = value ? normalizeAvatar3d(JSON.parse(value)) : null;
      } catch (_error) {
        next.avatar.face = null;
      }
    } else next[field] = value;
  }
  return next;
}

export function ensurePeopleEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== PEOPLE_EDITOR_TAB) return false;
  const people = lista();
  const firma = [
    state.aperto,
    ...people.map(
      (person) =>
        `${person.id}~${person.name}~${person.entity}~${person.photo}~${person.avatar.emoji}~${person.avatar.color}~${JSON.stringify(person.avatar.face)}~${person.battery}~${person.batteryState}~${person.watch}~${person.distance}~${person.travel}~${person.address}~${person.activity}~${person.wifi}~${person.direction}`,
    ),
  ].join("|");
  if (body.dataset.dmPeopleEditor === firma && body.querySelector(".dm-people-list")) return true;
  body.dataset.dmPeopleEditor = firma;
  body.innerHTML = bodyMarkup(people);
  body.dataset.renderer = PEOPLE_EDITOR_TAB;
  dipingiAnteprime();
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmPeopleEditor;
  ensurePeopleEditor();
}

/* Un frame di respiro fra una composizione e l'altra: ottanta ritratti in
 * fila, incollati microtask a microtask, affamano i frame — su webkit la
 * pagina restava decine di secondi senza un solo requestAnimationFrame,
 * quindi niente scroll fluido sotto le dita e ogni attesa basata sui frame
 * (la stabilita' dei click nelle prove compresa) appesa per l'intera
 * ricomposizione. La rete del setTimeout copre chi i frame li sospende del
 * tutto (una scheda in secondo piano). */
function respiro() {
  return new Promise((via) => {
    let fatto = false;
    const ok = () => {
      if (!fatto) {
        fatto = true;
        via();
      }
    };
    if (typeof root.requestAnimationFrame === "function") root.requestAnimationFrame(ok);
    root.setTimeout?.(ok, 50);
  });
}

/* Le anteprime si riempiono dopo: comporre quaranta ritratti mentre la
 * scheda sta comparendo vorrebbe dire una scheda che si apre in ritardo. */
async function dipingiAnteprime() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return;
  for (const host of body.querySelectorAll("[data-ritratto]")) {
    const riga = host.closest(".dm-people-row");
    const face = riga && rigaFace(riga);
    if (face) ritrattoVivo(host, face, "sveglio");
  }
  for (const riga of body.querySelectorAll(".dm-people-row")) {
    const face = rigaFace(riga);
    const grande = riga.querySelector("[data-face-anteprima-viva]");
    if (face && grande) ritrattoVivo(grande, face, "sveglio");
    for (const bottone of riga.querySelectorAll("[data-face-anteprima]")) {
      const posto = bottone.querySelector(".dm-face-opt-img");
      if (!posto) continue;
      /* Una pastiglia gia' composta per QUESTA anteprima non si rifa'; una
       * superata (il banco aggiornato in loco le cambia l'anteprima sotto)
       * tiene il disegno vecchio finche' il nuovo non e' pronto. */
      const attesa = bottone.dataset.faceAnteprima || "";
      if (!attesa) continue;
      if (posto.dataset.dmComposta === attesa && posto.firstElementChild) continue;
      if (posto.dataset.dmInViaggio === attesa) continue;
      posto.dataset.dmInViaggio = attesa;
      let scelta = null;
      try {
        scelta = JSON.parse(attesa);
      } catch (_errore) {
        continue;
      }
      const url = await ritrattoFermo(scelta);
      if (posto.dataset.dmInViaggio === attesa) delete posto.dataset.dmInViaggio;
      if (!url || !posto.isConnected) continue;
      /* Nel frattempo un altro tocco puo' aver cambiato di nuovo l'anteprima:
       * un disegno gia' vecchio non si mette. */
      if ((bottone.dataset.faceAnteprima || "") !== attesa) continue;
      const img = doc.createElement("img");
      img.src = url;
      img.alt = "";
      posto.replaceChildren(img);
      posto.dataset.dmComposta = attesa;
      await respiro();
    }
  }
}

/* La faccia scritta nella casella nascosta della riga, gia' normalizzata. */
function rigaFace(riga) {
  const campo = riga.querySelector('[data-person-field="face"]');
  try {
    return campo?.value ? normalizeAvatar3d(JSON.parse(campo.value)) : null;
  } catch (_error) {
    return null;
  }
}

/* Scrive la faccia nella riga e ridisegna solo il costruttore e il ritratto:
 * il resto della riga — nome, entita', sensori scritti a meta' — non si
 * tocca, che e' il motivo per cui non si passa dal ridisegno intero. */
function scriviFace(riga, people, index, face) {
  const campo = riga.querySelector('[data-person-field="face"]');
  if (campo) campo.value = face ? JSON.stringify(face) : "";
  const builder = riga.querySelector("[data-face-builder]");
  if (builder && people[index]) {
    const colore =
      clean(riga.querySelector('[data-person-field="color"]')?.value) || people[index].avatar.color;
    aggiornaBuilder(
      builder,
      builderMarkup({
        ...people[index],
        avatar: { ...people[index].avatar, face, color: colore },
      }),
    );
  }
  aggiornaAnteprima(riga, people, index);
  dipingiAnteprime();
}

/* Il banco del ritratto si aggiorna in loco, non si ricostruisce.
 *
 * Rifare `innerHTML` a ogni scelta buttava via ottanta pastiglie composte e
 * le ricomponeva tutte da capo: su una macchina lenta il banco restava in
 * subbuglio per decine di secondi dopo OGNI tocco — caselle vuote che si
 * riempivano una alla volta — e la prova su webkit non trovava mai un
 * bottone fermo da premere. Qui si copia sui bottoni che gia' esistono solo
 * cio' che e' cambiato (la spunta, l'anteprima da comporre, l'etichetta
 * della fila); le file nuove entrano vergini, quelle sparite se ne vanno, e
 * ogni pastiglia superata tiene il disegno vecchio finche' quello nuovo non
 * e' pronto. */
function aggiornaBuilder(builder, markup) {
  const nuovo = doc.createElement("div");
  nuovo.innerHTML = markup;
  const fileNuove = nuovo.querySelector(".dm-face-rows");
  const fileVecchie = builder.querySelector(".dm-face-rows");
  /* Da o verso lo stato senza ritratto (Crea/Togli): struttura diversa,
   * la ricostruzione intera resta la strada onesta. */
  if (!fileNuove || !fileVecchie) {
    builder.innerHTML = markup;
    return;
  }
  const viva = builder.querySelector("[data-face-anteprima-viva]");
  const vivaNuova = nuovo.querySelector("[data-face-anteprima-viva]");
  if (viva && vivaNuova && viva.getAttribute("style") !== vivaNuova.getAttribute("style"))
    viva.setAttribute("style", vivaNuova.getAttribute("style"));
  const chiaveDi = (fila) => fila.querySelector("[data-face-k]")?.dataset.faceK || "";
  const nuove = [...fileNuove.querySelectorAll(".dm-face-row")];
  const chiaviNuove = new Set(nuove.map(chiaveDi));
  const vecchiePerChiave = new Map();
  for (const fila of [...fileVecchie.querySelectorAll(".dm-face-row")]) {
    /* Le file sparite se ne vanno PRIMA del riordino: cosi' il cursore
     * scorre solo sulle vive e le file ferme restano ferme davvero, senza
     * stacca-e-riattacca di passaggio. */
    if (!chiaviNuove.has(chiaveDi(fila))) {
      fila.remove();
      continue;
    }
    vecchiePerChiave.set(chiaveDi(fila), fila);
  }
  let cursore = fileVecchie.firstElementChild;
  for (const filaNuova of nuove) {
    const chiave = chiaveDi(filaNuova);
    let fila = vecchiePerChiave.get(chiave) || null;
    if (fila) {
      const bottoniNuovi = [...filaNuova.querySelectorAll("[data-face-k]")];
      const bottoni = [...fila.querySelectorAll("[data-face-k]")];
      if (
        bottoni.length !== bottoniNuovi.length ||
        bottoni.some((b, i) => b.dataset.faceV !== bottoniNuovi[i].dataset.faceV)
      ) {
        /* La fila ha cambiato le sue voci: si cede il passo alla nuova. */
        if (fila === cursore) cursore = filaNuova;
        fila.replaceWith(filaNuova);
        fila = filaNuova;
      } else {
        const lbl = fila.querySelector(".dm-face-row-lbl");
        const lblNuova = filaNuova.querySelector(".dm-face-row-lbl");
        if (lbl && lblNuova && lbl.innerHTML !== lblNuova.innerHTML)
          lbl.innerHTML = lblNuova.innerHTML;
        bottoni.forEach((bottone, i) => {
          const atteso = bottoniNuovi[i];
          if (bottone.className !== atteso.className) bottone.className = atteso.className;
          for (const attributo of ["data-face-anteprima", "style", "aria-label"]) {
            const valore = atteso.getAttribute(attributo);
            if (bottone.getAttribute(attributo) === valore) continue;
            if (valore === null) bottone.removeAttribute(attributo);
            else bottone.setAttribute(attributo, valore);
          }
        });
      }
    } else {
      fila = filaNuova;
    }
    if (fila === cursore) cursore = cursore.nextElementSibling;
    else fileVecchie.insertBefore(fila, cursore);
  }
}

/* L'anteprima del ritratto segue le mani: si cambia emoji o colore e lo si
 * vede nella riga, senza dover salvare per scoprire com'e' venuto. */
function aggiornaAnteprima(riga, people, index) {
  const testa = riga.querySelector("[data-person-portrait]");
  if (!testa || !people[index]) return;
  const bozza = normalizePeople([leggiRiga(riga, people[index])])[0];
  if (bozza) testa.outerHTML = ritratto(bozza);
}

async function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== PEOPLE_EDITOR_TAB || !body.contains(event.target)) return;
  const people = lista();

  if (event.target.closest("[data-person-add]")) {
    event.preventDefault();
    state.aperto = people.length;
    /* Prima si mette al sicuro quello che c'e' scritto ADESSO nelle righe:
     * «se mentre si sta creando una persona si preme Aggiungi, deve salvare
     * la persona corrente» — il ridisegno che segue riscrive le caselle, e
     * senza questa raccolta la persona a meta' spariva.
     *
     * Una persona senza nome ne' entita' non e' una persona e la
     * normalizzazione la scarterebbe: la riga nuova nasce con un nome
     * provvisorio, che e' anche quello che si vede finche' non lo si cambia. */
    salva([
      ...raccogliRighe(body, people),
      {
        id: `person-${Date.now().toString(36)}`,
        name: `${t("Persona", "Person")} ${people.length + 1}`,
        entity: "",
      },
    ]);
    ridisegna();
    return;
  }
  if (event.target.closest("[data-person-import]")) {
    event.preventDefault();
    const states = allStates();
    /* Ogni persona importata arriva gia' con i sensori del suo telefono:
     * quello che il pulsante «rileva» fa su una riga, l'importazione lo fa
     * per tutte. */
    const proposte = suggestPeople(states, people);
    const nuove = proposte.map((persona) => ({
      ...persona,
      /* L'anagrafe conta persone gia' salvate E persone in arrivo: il
       * «candidato unico» non deve regalare lo stesso telefono a due. */
      ...detectCompanionSensors(states, persona.entity, [...people, ...proposte]),
    }));
    if (!nuove.length) {
      root.edToast?.(t("Nessuna nuova persona da importare", "No new people to import"));
      return;
    }
    /* Anche qui: quello che c'e' scritto nelle righe si salva, non si butta. */
    salva([...raccogliRighe(body, people), ...nuove]);
    state.aperto = -1;
    ridisegna();
    root.edToast?.(t(`${nuove.length} persone importate`, `${nuove.length} people imported`));
    return;
  }
  const emojiPick = event.target.closest("[data-person-emoji]");
  if (emojiPick) {
    event.preventDefault();
    apriAvatarPicker(clean(emojiPick.dataset.personEmoji));
    return;
  }
  const riga = event.target.closest("[data-person-index]");
  if (!riga) return;
  const index = Number(riga.dataset.personIndex);
  if (!Number.isFinite(index) || !people[index]) return;

  if (event.target.closest("[data-person-detect]")) {
    event.preventDefault();
    /* Si parte dall'entita' scritta nella casella, non da quella salvata:
     * chi ha appena scelto la persona vuole i sensori di quella. I campi gia'
     * compilati non si toccano — il pulsante riempie, non riscrive. */
    const entita = clean(riga.querySelector('[data-person-field="entity"]')?.value);
    /* Senza l'entita' il rilevamento non sa di chi cercare i sensori: dirlo
     * e' piu' utile di un «niente trovato» che suona come un guasto. */
    if (!entita) {
      root.edToast?.(t("Prima scegli l'entità della persona", "Choose the person entity first"));
      return;
    }
    const trovati = detectCompanionSensors(allStates(), entita, people);
    let riempiti = 0;
    for (const [field, sensore] of Object.entries(trovati)) {
      const campo = riga.querySelector(`[data-person-field="${field}"]`);
      if (campo && !clean(campo.value)) {
        campo.value = sensore;
        /* Il campo decorato e' nascosto dietro la pastiglia, e la pastiglia
         * si ridipinge solo sugli eventi del campo: un .value assegnato in
         * silenzio riempiva l'input invisibile e lasciava a video «Scegli
         * entità» — sei sensori trovati e nessuno da vedere. */
        campo.dispatchEvent(new Event("input", { bubbles: true }));
        campo.dispatchEvent(new Event("change", { bubbles: true }));
        riempiti += 1;
      }
    }
    root.edToast?.(
      riempiti
        ? t(`${riempiti} sensori rilevati`, `${riempiti} sensors detected`)
        : t("Nessun sensore riconosciuto", "No sensor recognized"),
    );
    return;
  }
  if (event.target.closest("[data-person-photo-clear]")) {
    event.preventDefault();
    const campo = riga.querySelector('[data-person-field="photo"]');
    if (campo) campo.value = "";
    event.target.closest("[data-person-photo-clear]").hidden = true;
    aggiornaAnteprima(riga, people, index);
    return;
  }
  if (event.target.closest("[data-person-photo]")) {
    event.preventDefault();
    const url = clean(await pickMediaImage());
    if (!url) return;
    const campo = riga.querySelector('[data-person-field="photo"]');
    if (campo) campo.value = url;
    const togli = riga.querySelector("[data-person-photo-clear]");
    if (togli) togli.hidden = false;
    aggiornaAnteprima(riga, people, index);
    return;
  }
  const colore = event.target.closest("[data-person-color]");
  if (colore) {
    event.preventDefault();
    const campo = riga.querySelector('[data-person-field="color"]');
    if (campo) campo.value = clean(colore.dataset.personColor);
    riga
      .querySelectorAll("[data-person-color]")
      .forEach((button) => button.classList.toggle("on", button === colore));
    riga
      .querySelector(".dm-face-preview")
      ?.style?.setProperty("--dm-person-color", clean(colore.dataset.personColor));
    aggiornaAnteprima(riga, people, index);
    return;
  }
  if (event.target.closest("[data-face-create]")) {
    event.preventDefault();
    scriviFace(riga, people, index, normalizeAvatar3d({}));
    return;
  }
  if (event.target.closest("[data-face-random]")) {
    event.preventDefault();
    scriviFace(riga, people, index, avatar3dACaso());
    return;
  }
  if (event.target.closest("[data-face-clear]")) {
    event.preventDefault();
    scriviFace(riga, people, index, null);
    return;
  }
  const pezzo = event.target.closest("[data-face-k]");
  if (pezzo) {
    event.preventDefault();
    const face = rigaFace(riga) || normalizeAvatar3d({});
    face[clean(pezzo.dataset.faceK)] = clean(pezzo.dataset.faceV);
    scriviFace(riga, people, index, normalizeAvatar3d(face));
    return;
  }
  if (event.target.closest("[data-person-edit]")) {
    event.preventDefault();
    /* Aprire un'altra riga non butta via quello che si stava scrivendo in
     * questa: la matita ridisegna la scheda, e il ridisegno riscrive le
     * caselle con quello che c'e' in memoria. Prima di ridisegnare, quindi, in
     * memoria ci si mette quello che c'e' scritto. */
    salva(raccogliRighe(body, people));
    state.aperto = state.aperto === index ? -1 : index;
    ridisegna();
    return;
  }
  if (event.target.closest("[data-person-del]")) {
    event.preventDefault();
    const domanda = t(
      `Elimino "${nomeDi(people[index], index)}"?`,
      `Remove "${nomeDi(people[index], index)}"?`,
    );
    if (root.confirm && !root.confirm(domanda)) return;
    state.aperto = -1;
    salva(people.filter((_person, position) => position !== index));
    ridisegna();
    return;
  }
  if (event.target.closest("[data-person-save]")) {
    event.preventDefault();
    /* Il salvataggio per riga non e' piu' un gesto per riga: il tasto unico in
     * fondo alla scheda preme quei bottoni uno dopo l'altro. Il primo salva e
     * ridisegna, e il ridisegno riscrive le caselle delle righe dopo con
     * quello che c'e' in memoria: quando arrivava il loro turno non avevano
     * piu' niente da dire. Si leggono tutte prima di scrivere. */
    const next = raccogliRighe(body, people, index);
    next[index] = leggiRiga(riga, people[index]);
    const errore = riga.querySelector("[data-person-error]");
    /* Un'entita' che non sa dire dove sta una persona non fa una card: la
     * si rifiuta subito, spiegando cosa serve. */
    if (!ENTITY_RE.test(next[index].entity)) {
      if (errore)
        errore.textContent = t(
          "Serve un'entità person.* o device_tracker.* valida.",
          "A valid person.* or device_tracker.* entity is required.",
        );
      return;
    }
    if (errore) errore.textContent = "";
    salva(next);
    ridisegna();
    root.edToast?.(t("💾 Persona salvata", "💾 Person saved"));
  }
}

/* L'emoji scelta dal picker arriva come evento `change` sulla casella: e' il
 * momento giusto per aggiornare il ritratto della riga. */
function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== PEOPLE_EDITOR_TAB || !body.contains(event.target)) return;
  if (!event.target?.matches?.("[data-person-field]")) return;
  const riga = event.target.closest("[data-person-index]");
  const index = Number(riga?.dataset?.personIndex);
  const people = lista();
  if (riga && Number.isFinite(index) && people[index]) aggiornaAnteprima(riga, people, index);
}

/* Il picker dell'avatar: la stessa finestra del picker icone della plancia,
 * ma con le facce. Quello di serie parla di prese e lampadine — per una
 * persona servono persone. La scelta finisce nella casella e spara `change`,
 * che e' l'evento da cui l'anteprima del ritratto si aggiorna. */
function apriAvatarPicker(inputId) {
  if (!doc) return;
  doc.getElementById("dm-avatar-picker")?.remove();
  const overlay = doc.createElement("div");
  overlay.id = "dm-avatar-picker";
  /* Non un <header>: quello di pagina ha uno stile suo — padding, colonna,
   * ombra — e se lo porterebbe dentro alla finestra. */
  overlay.innerHTML = `<div class="dm-avatar-sheet" role="dialog" aria-modal="true">
    <div class="dm-avatar-head"><strong>😊 ${t("Scegli l'avatar", "Choose the avatar")}</strong><button type="button" data-close aria-label="${t("Chiudi", "Close")}">✕</button></div>
    <div class="dm-avatar-grid">${AVATAR_EMOJI.map(
      (emoji) => `<button type="button" data-avatar-emoji="${esc(emoji)}">${esc(emoji)}</button>`,
    ).join("")}</div>
  </div>`;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-close]")) {
      overlay.remove();
      return;
    }
    const scelta = event.target.closest("[data-avatar-emoji]");
    if (!scelta) return;
    const input = doc.getElementById(inputId);
    if (input) {
      input.value = clean(scelta.dataset.avatarEmoji);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    overlay.remove();
  });
  doc.body.append(overlay);
}

/* La voce nella barra della configurazione: le voci sono scritte nel documento
 * vendorizzato e questa non c'e', quindi si aggiunge accanto alle altre con lo
 * stesso gestore. */
export function ensurePeopleEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${PEOPLE_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = PEOPLE_EDITOR_TAB;
  tab.textContent = `👥 ${t("Persone", "People")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(PEOPLE_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

function installStyles() {
  installAvatar3dStyle();
  installStyle(
    "dm-people-editor-style",
    `
      #ed-body .dm-people-list{display:grid;gap:8px;margin-bottom:10px}
      #ed-body .dm-people-row{display:block!important;padding:0!important;overflow:hidden}
      #ed-body .dm-people-row-head{display:flex;align-items:center;gap:10px;padding:10px 12px}
      #ed-body .dm-people-row-head .ed-row-main{display:grid;gap:2px;min-width:0}
      #ed-body .dm-people-ed-portrait{position:relative;width:40px;height:40px;flex:0 0 auto}
      #ed-body .dm-people-ed-portrait img,#ed-body .dm-people-ed-avatar{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover}
      #ed-body .dm-people-ed-avatar{display:grid;place-items:center;font-size:20px;background:color-mix(in srgb,var(--dm-person-color,#0ea5e9) 18%,var(--card-bg,#fff));color:var(--dm-person-color,#0ea5e9)}
      #ed-body .dm-people-ed-avatar b{font-size:14px;font-weight:900}
      #ed-body .dm-people-row-body{display:grid;gap:8px;padding:0 12px 12px}
      #ed-body .dm-people-row-body[hidden]{display:none!important}
      #ed-body .dm-people-field{display:grid;gap:4px;margin:0}
      #ed-body .dm-people-field .ed-form-row{display:flex;gap:8px;min-width:0}
      #ed-body .dm-people-field .ed-form-row>input{flex:1 1 auto;min-width:0}
      #ed-body .dm-people-pick{flex:0 0 38px;height:38px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;font-size:14px;cursor:pointer}
      #ed-body .dm-people-photo-row{flex-wrap:wrap}
      #ed-body .dm-people-photo-btn{flex:1 1 auto;margin:0}
      #ed-body .dm-people-photo-clear{background:rgba(148,163,184,.18);color:var(--text,#0f172a)}
      #ed-body .dm-people-colors{display:flex;flex-wrap:wrap;gap:6px;padding-top:2px}
      #ed-body .dm-people-color{width:26px;height:26px;border-radius:50%;border:2px solid transparent;background:var(--dm-person-color);cursor:pointer;padding:0}
      #ed-body .dm-people-color.on{border-color:var(--text,#0f172a);box-shadow:0 0 0 2px var(--card-bg,#fff) inset}
      #dm-avatar-picker{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px}
      #dm-avatar-picker .dm-avatar-sheet{background:var(--card-bg,#fff);border-radius:18px;max-width:440px;width:100%;max-height:70vh;overflow:auto;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
      #dm-avatar-picker .dm-avatar-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
      #dm-avatar-picker .dm-avatar-head strong{font-weight:900;font-size:15px;color:var(--text,#0f172a)}
      #dm-avatar-picker [data-close]{border:none;background:rgba(148,163,184,.15);border-radius:50%;width:32px;height:32px;font-size:15px;cursor:pointer;color:var(--text,#0f172a)}
      #dm-avatar-picker .dm-avatar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:4px}
      #dm-avatar-picker [data-avatar-emoji]{font-size:23px;padding:8px 0;border:none;background:transparent;border-radius:10px;cursor:pointer}
      #dm-avatar-picker [data-avatar-emoji]:hover{background:rgba(14,165,233,.12)}
      #ed-body .dm-face-builder{display:grid;gap:8px;margin:2px 0 6px}
      #ed-body .dm-face-create{margin:0}
      #ed-body .dm-face-builder>small{color:var(--secondary-text-color,#64748b);font-size:12px}
      #ed-body .dm-face-workbench{display:flex;gap:14px;align-items:flex-start}
      #ed-body .dm-face-preview{flex:0 0 108px;width:108px;height:108px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--dm-person-color,#0ea5e9) 10%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-person-color,#0ea5e9) 30%,var(--card-bg,#fff)));box-shadow:0 10px 22px -10px rgba(15,23,42,.45)}
      #ed-body .dm-face-modes{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:var(--surface-2,#f1f5f9);border:1px solid var(--card-border,#e2e8f0);justify-self:start}
      #ed-body .dm-face-mode{display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;border-radius:999px;padding:5px 13px;font:inherit;font-size:12px;font-weight:800;color:var(--secondary-text-color,#64748b);cursor:pointer;transition:background .18s ease,color .18s ease}
      #ed-body .dm-face-mode.on{background:var(--card-bg,#fff);color:var(--primary-text-color,#0f172a);box-shadow:0 2px 6px -2px rgba(15,23,42,.3)}
      #ed-body .dm-face-preview img{width:100%;height:100%;display:block;object-fit:cover}
      #ed-body .dm-face-side{flex:1 1 auto;min-width:0}
      #ed-body .dm-face-side small{display:block;color:var(--secondary-text-color,#64748b);font-size:11px;margin-top:7px;line-height:1.45}
      #ed-body .dm-face-dice{margin:0}
      #ed-body .dm-face-rows{display:grid;gap:11px;margin:4px 0 8px}
      #ed-body .dm-face-row{display:grid;gap:5px}
      #ed-body .dm-face-row-lbl{display:flex;justify-content:space-between;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      #ed-body .dm-face-row-lbl b{color:var(--info-color,#0ea5e9)}
      #ed-body .dm-face-row-opts{display:flex;flex-wrap:wrap;gap:6px}
      #ed-body .dm-face-row-dots{align-items:center;padding:3px 0}
      #ed-body .dm-face-opt{width:58px;border:2px solid transparent;background:var(--surface-2,#f1f5f9);border-radius:14px;padding:2px 2px 4px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font:inherit;transition:border-color .18s ease,background .18s ease}
      #ed-body .dm-face-opt.on{border-color:var(--info-color,#0ea5e9);background:color-mix(in srgb,var(--info-color,#0ea5e9) 12%,transparent)}
      #ed-body .dm-face-opt-img{width:46px;height:46px;display:block}
      #ed-body .dm-face-opt-img img{width:100%;height:100%;display:block;object-fit:contain}
      #ed-body .dm-face-opt i{font-style:normal;font-size:8.5px;font-weight:700;color:var(--secondary-text-color,#64748b);line-height:1.15;text-align:center}
      #ed-body .dm-face-remove{border:none;background:transparent;color:var(--secondary-text-color,#64748b);font:inherit;font-size:12px;font-weight:750;cursor:pointer;justify-self:start;padding:2px 0}
      #ed-body .dm-face-remove:hover{color:var(--error-color,#dc2626)}
      @media(max-width:560px){#ed-body .dm-face-workbench{flex-direction:column;align-items:center;text-align:center}#ed-body .dm-face-side{width:100%}}
      #ed-body .dm-people-sensors{margin:2px 0}
      #ed-body .dm-people-sensors .ed-acc-body{display:grid;gap:8px}
      #ed-body .dm-people-sensors-intro{color:var(--secondary-text-color,#64748b);font-size:12px;line-height:1.45}
      #ed-body .dm-people-detect{margin:0}
      #ed-body .dm-people-actions{display:flex;gap:8px;flex-wrap:wrap}
      #ed-body .dm-people-actions .ed-btn-add{flex:1 1 auto;margin:0}
      #ed-body .dm-people-error:not(:empty){color:var(--error-color,#dc2626);font-size:12px;font-weight:800}
    `,
  );
}

export function installPeopleEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensurePeopleEditorTab();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  onEditorRedraw("__dmPeopleEditor", () => {
    root.queueMicrotask?.(() => {
      ensurePeopleEditorTab();
      ensurePeopleEditor();
    });
  });
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(event, () => {
      root.queueMicrotask?.(() => {
        ensurePeopleEditorTab();
        ensurePeopleEditor();
      });
    });
  ensurePeopleEditor();
}
