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
  avatarSvg,
  FACE_AGES,
  FACE_BEARD_COLORS,
  FACE_BEARDS,
  FACE_BROWS,
  FACE_BUILDS,
  FACE_EARS,
  FACE_EYE_COLORS,
  FACE_EYES,
  FACE_GLASSES,
  FACE_HAIR_COLORS,
  FACE_HAIRS,
  FACE_HATS,
  FACE_LIP_COLORS,
  FACE_MARKS,
  FACE_MOUTHS,
  FACE_NOSES,
  FACE_OUTFIT_COLORS,
  FACE_OUTFITS,
  FACE_SHAPES,
  FACE_SKINS,
  normalizeFace,
} from "../core/person-avatar.js";
import {
  AVATAR_COLORS,
  detectCompanionSensors,
  normalizePeople,
  personInitials,
  suggestPeople,
} from "../core/person-model.js";
import { pickMediaImage } from "./media-picker-section.js";
import { allStates, clean, doc, esc, installStyle, onEditorRedraw, readJson, root, t, writeJsonIfChanged } from "./shared.js";

const KEY = "__DASHBOARDMODERN_PEOPLE_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

/* Le facce tra cui scegliere l'avatar. Il picker delle icone della plancia
 * parla di prese e lampadine: per una persona servono persone. Curate a mano,
 * per categorie: espressioni, gente di casa, mestieri, e qualche animale per
 * chi non si prende sul serio. */
export const AVATAR_EMOJI = Object.freeze([
  "😀", "😊", "😎", "🥰", "😇", "🤓", "🥳", "😴", "🤠", "🥸", "🤗", "😜",
  "👨", "👩", "🧑", "👦", "👧", "👶", "👴", "👵", "🧔", "👱‍♀️", "👱‍♂️", "🧑‍🦰",
  "👨‍🦱", "👩‍🦱", "👨‍🦳", "👩‍🦳", "👨‍🦲", "🧑‍🦱", "👩‍🦰", "🧕", "👳‍♂️", "👲", "🧒", "🧓",
  "👨‍💻", "👩‍💻", "👨‍🍳", "👩‍🍳", "👨‍⚕️", "👩‍⚕️", "👨‍🏫", "👩‍🏫", "👷‍♂️", "👷‍♀️", "👮‍♂️", "👮‍♀️",
  "👨‍🔧", "👩‍🔧", "👨‍🚒", "👩‍🚒", "👨‍✈️", "👩‍✈️", "👨‍🎨", "👩‍🎨", "🧑‍🌾", "🧑‍🎓", "🦸‍♂️", "🦸‍♀️",
  "🐱", "🐶", "🦊", "🐼", "🐨", "🦁", "🐯", "🐸", "🐧", "🦄", "🐢", "🦉",
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
  const avatar = `<span class="dm-people-ed-avatar" style="--dm-person-color:${esc(person.avatar.color)}">${
    person.avatar.face
      ? avatarSvg(person.avatar.face, { animated: false })
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

/* I tratti, raccolti per gruppi: un pannello con venti file aperte tutte
 * insieme non si legge, e chi cerca gli occhiali non deve scorrere la barba.
 * Il primo gruppo e' aperto, gli altri si aprono quando servono. */
function faceGroups(face, colore) {
  return [
    {
      titolo: t("Viso", "Face"),
      rows: [
        { k: "shape", label: t("Forma del viso", "Face shape"), keys: Object.keys(FACE_SHAPES) },
        { k: "skin", label: t("Carnagione", "Skin tone"), keys: Object.keys(FACE_SKINS), swatch: (key) => FACE_SKINS[key].base },
        { k: "age", label: t("Età", "Age"), keys: [...FACE_AGES] },
        { k: "ears", label: t("Orecchie", "Ears"), keys: [...FACE_EARS] },
        { k: "marks", label: t("Segni particolari", "Distinctive marks"), keys: [...FACE_MARKS] },
      ],
    },
    {
      titolo: t("Occhi", "Eyes"),
      rows: [
        { k: "eyes", label: t("Occhi", "Eyes"), keys: [...FACE_EYES] },
        { k: "eyeColor", label: t("Colore occhi", "Eye color"), keys: Object.keys(FACE_EYE_COLORS), swatch: (key) => FACE_EYE_COLORS[key] },
        { k: "brows", label: t("Sopracciglia", "Eyebrows"), keys: [...FACE_BROWS] },
      ],
    },
    {
      titolo: t("Capelli e barba", "Hair and beard"),
      rows: [
        { k: "hair", label: t("Capelli", "Hair"), keys: [...FACE_HAIRS] },
        { k: "hairColor", label: t("Colore capelli", "Hair color"), keys: Object.keys(FACE_HAIR_COLORS), swatch: (key) => FACE_HAIR_COLORS[key] },
        { k: "beard", label: t("Barba", "Beard"), keys: [...FACE_BEARDS] },
        /* «Come i capelli» non ha un colore suo: il campioncino mostra quello
         * che erediterebbe, cosi' la fila non parte con una pastiglia vuota. */
        { k: "beardColor", label: t("Colore barba", "Beard color"), keys: Object.keys(FACE_BEARD_COLORS), swatch: (key) => FACE_BEARD_COLORS[key] || FACE_HAIR_COLORS[face.hairColor] },
      ],
    },
    {
      titolo: t("Naso e bocca", "Nose and mouth"),
      rows: [
        { k: "nose", label: t("Naso", "Nose"), keys: [...FACE_NOSES] },
        { k: "mouth", label: t("Bocca", "Mouth"), keys: [...FACE_MOUTHS] },
        { k: "lips", label: t("Labbra", "Lips"), keys: Object.keys(FACE_LIP_COLORS), swatch: (key) => FACE_LIP_COLORS[key] },
      ],
    },
    {
      titolo: t("Corpo e vestiti", "Body and clothes"),
      rows: [
        { k: "build", label: t("Corporatura", "Build"), keys: [...FACE_BUILDS] },
        { k: "outfit", label: t("Abbigliamento", "Clothing"), keys: [...FACE_OUTFITS] },
        { k: "outfitColor", label: t("Colore vestito", "Clothing color"), keys: Object.keys(FACE_OUTFIT_COLORS), swatch: (key) => FACE_OUTFIT_COLORS[key] || colore },
        { k: "glasses", label: t("Occhiali", "Glasses"), keys: [...FACE_GLASSES] },
        { k: "hat", label: t("Copricapo", "Headwear"), keys: [...FACE_HATS] },
      ],
    },
  ];
}

/* Quello che copre il tratto che si sta scegliendo, nel campioncino si toglie:
 * la barba sopra la bocca, gli occhiali sopra gli occhi, il cappello sopra i
 * capelli. Il resto della faccia resta la propria — un paio di occhiali si
 * giudica sulla propria faccia, non su quella di un altro. */
const COPERTURE = Object.freeze({
  mouth: { beard: "nessuna" },
  lips: { beard: "nessuna" },
  nose: { beard: "nessuna", glasses: "nessuno" },
  eyes: { glasses: "nessuno" },
  eyeColor: { glasses: "nessuno" },
  brows: { glasses: "nessuno", hat: "nessuno" },
  hair: { hat: "nessuno" },
  hairColor: { hat: "nessuno" },
  shape: { hat: "nessuno" },
  ears: { hat: "nessuno" },
  age: { beard: "nessuna", glasses: "nessuno" },
});

function faceThumb(face, k, key, colore) {
  return avatarSvg(
    { ...face, ...(COPERTURE[k] || {}), [k]: key },
    { animated: false, shirt: colore },
  );
}

function builderMarkup(person) {
  const face = person.avatar.face;
  if (!face)
    return `<button type="button" class="ed-btn-add dm-face-create" data-face-create>🧑‍🎨 ${t("Crea l'avatar", "Create the avatar")}</button>
      <small>${t("Oppure scrivi un'emoji qui sotto — o lascia vuoto per le iniziali del nome.", "Or type an emoji below — or leave it empty for the initials of the name.")}</small>`;
  const colore = clean(person.avatar.color) || "#0ea5e9";
  const gruppi = faceGroups(face, colore)
    .map(({ titolo, rows }, indice) => {
      const righe = rows
        .map(({ k, label, keys, swatch }) => {
          const options = keys
            .map((key) => {
              const selected = face[k] === key ? " on" : "";
              const nome = `${label}: ${key}`;
              if (swatch)
                return `<button type="button" class="dm-face-opt dm-face-swatch${selected}" data-face-k="${k}" data-face-v="${esc(key)}" style="--dm-face-swatch:${swatch(key)}" aria-label="${esc(nome)}"></button>`;
              return `<button type="button" class="dm-face-opt dm-face-thumb${selected}" data-face-k="${k}" data-face-v="${esc(key)}" aria-label="${esc(nome)}">${faceThumb(face, k, key, colore)}</button>`;
            })
            .join("");
          return `<div class="dm-face-row"><span class="dm-face-row-lbl">${esc(label)}</span><span class="dm-face-row-opts">${options}</span></div>`;
        })
        .join("");
      return `<details class="dm-face-group"${indice ? "" : " open"}><summary class="dm-face-group-head">${esc(titolo)}</summary><div class="dm-face-rows">${righe}</div></details>`;
    })
    .join("");
  return `<div class="dm-face-workbench">
      <span class="dm-face-preview" style="--dm-person-color:${esc(colore)}">${avatarSvg(face)}</span>
      <div class="dm-face-groups">${gruppi}</div>
    </div>
    <div class="dm-face-tools">
      <button type="button" class="ed-btn-add dm-face-dice" data-face-random>🎲 ${t("Sorteggia una faccia", "Shuffle a face")}</button>
      <button type="button" class="dm-face-remove" data-face-clear>✕ ${t("Togli la faccia (torna a emoji o iniziali)", "Remove the face (back to emoji or initials)")}</button>
    </div>`;
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
    ["address", t("Posizione (indirizzo)", "Location (address)"), "sensor.telefono_geocoded_location"],
    ["activity", t("Attività", "Activity"), "sensor.telefono_activity"],
    ["wifi", t("Rete WiFi", "WiFi network"), "sensor.telefono_wifi_connection"],
  ];
  return campi
    .map(([field, label, placeholder]) =>
      campoEntita(`dm-person-${index}-${field}`, field, label, person[field] || "", placeholder, ""),
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

function leggiRiga(riga, person) {
  const next = { ...person, avatar: { ...person.avatar } };
  for (const input of riga.querySelectorAll("[data-person-field]")) {
    const field = clean(input.dataset.personField);
    const value = clean(input.value);
    if (field === "emoji") next.avatar.emoji = value;
    else if (field === "color") next.avatar.color = value;
    else if (field === "face") {
      try {
        next.avatar.face = value ? normalizeFace(JSON.parse(value)) : null;
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
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmPeopleEditor;
  ensurePeopleEditor();
}

/* Una faccia sorteggiata: venti tratti da scegliere sono tanti, e partire da
 * qualcuno che non sia sempre lo stesso e' il modo piu' veloce di capire cosa
 * c'e' dentro. I copricapi restano fuori dal sorteggio: un cappello a caso
 * copre il taglio appena estratto. */
function facciaACaso() {
  const uno = (catalogo) => {
    const keys = Array.isArray(catalogo) ? catalogo : Object.keys(catalogo);
    return keys[Math.floor(Math.random() * keys.length)];
  };
  return normalizeFace({
    shape: uno(FACE_SHAPES),
    skin: uno(FACE_SKINS),
    age: uno(FACE_AGES),
    ears: uno(FACE_EARS),
    marks: uno(FACE_MARKS),
    eyes: uno(FACE_EYES),
    eyeColor: uno(FACE_EYE_COLORS),
    brows: uno(FACE_BROWS),
    hair: uno(FACE_HAIRS),
    hairColor: uno(FACE_HAIR_COLORS),
    beard: uno(FACE_BEARDS),
    beardColor: uno(FACE_BEARD_COLORS),
    nose: uno(FACE_NOSES),
    mouth: uno(FACE_MOUTHS),
    lips: uno(FACE_LIP_COLORS),
    build: uno(FACE_BUILDS),
    outfit: uno(FACE_OUTFITS),
    outfitColor: uno(FACE_OUTFIT_COLORS),
    glasses: uno(FACE_GLASSES),
  });
}

/* La faccia scritta nella casella nascosta della riga, gia' normalizzata. */
function rigaFace(riga) {
  const campo = riga.querySelector('[data-person-field="face"]');
  try {
    return campo?.value ? normalizeFace(JSON.parse(campo.value)) : null;
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
    /* Quali gruppi erano aperti: si sceglie un tratto e il pannello si
     * ridisegna — se i gruppi tornassero chiusi, ogni scelta riporterebbe le
     * mani in cima all'elenco. */
    const aperti = [...builder.querySelectorAll("details.dm-face-group")].map((g) => g.open);
    builder.innerHTML = builderMarkup({
      ...people[index],
      avatar: { ...people[index].avatar, face, color: colore },
    });
    builder.querySelectorAll("details.dm-face-group").forEach((gruppo, i) => {
      if (aperti.length > i) gruppo.open = aperti[i];
    });
  }
  aggiornaAnteprima(riga, people, index);
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
    /* Una persona senza nome ne' entita' non e' una persona e la
     * normalizzazione la scarterebbe: la riga nuova nasce con un nome
     * provvisorio, che e' anche quello che si vede finche' non lo si cambia. */
    salva([
      ...people,
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
    salva([...people, ...nuove]);
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
    riga.querySelectorAll("[data-person-color]").forEach((button) =>
      button.classList.toggle("on", button === colore),
    );
    riga
      .querySelector(".dm-face-preview")
      ?.style?.setProperty("--dm-person-color", clean(colore.dataset.personColor));
    aggiornaAnteprima(riga, people, index);
    return;
  }
  if (event.target.closest("[data-face-create]")) {
    event.preventDefault();
    scriviFace(riga, people, index, normalizeFace({}));
    return;
  }
  if (event.target.closest("[data-face-random]")) {
    event.preventDefault();
    scriviFace(riga, people, index, facciaACaso());
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
    const face = rigaFace(riga) || normalizeFace({});
    face[clean(pezzo.dataset.faceK)] = clean(pezzo.dataset.faceV);
    scriviFace(riga, people, index, normalizeFace(face));
    return;
  }
  if (event.target.closest("[data-person-edit]")) {
    event.preventDefault();
    state.aperto = state.aperto === index ? -1 : index;
    ridisegna();
    return;
  }
  if (event.target.closest("[data-person-del]")) {
    event.preventDefault();
    const domanda = t(`Elimino "${nomeDi(people[index], index)}"?`, `Remove "${nomeDi(people[index], index)}"?`);
    if (root.confirm && !root.confirm(domanda)) return;
    state.aperto = -1;
    salva(people.filter((_person, position) => position !== index));
    ridisegna();
    return;
  }
  if (event.target.closest("[data-person-save]")) {
    event.preventDefault();
    const next = people.slice();
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
      #ed-body .dm-face-groups{flex:1 1 auto;min-width:0;display:grid;gap:5px}
      #ed-body .dm-face-group{border:1px solid var(--card-border,#e2e8f0);border-radius:14px;background:var(--surface-2,#f8fafc);overflow:hidden}
      #ed-body .dm-face-group-head{list-style:none;cursor:pointer;padding:7px 11px;font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--secondary-text-color,#64748b);display:flex;align-items:center;gap:7px}
      #ed-body .dm-face-group-head::-webkit-details-marker{display:none}
      #ed-body .dm-face-group-head::before{content:"▸";font-size:11px;transition:transform .18s ease;color:var(--info-color,#0ea5e9)}
      #ed-body .dm-face-group[open]>.dm-face-group-head::before{transform:rotate(90deg)}
      #ed-body .dm-face-group[open]>.dm-face-group-head{color:var(--primary-text-color,#0f172a);border-bottom:1px solid var(--card-border,#e2e8f0)}
      #ed-body .dm-face-tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
      #ed-body .dm-face-dice{margin:0}
      #ed-body .dm-face-rows{flex:1 1 auto;min-width:0;display:grid;gap:7px;padding:8px 10px 10px}
      #ed-body .dm-face-row{display:grid;gap:3px}
      #ed-body .dm-face-row-lbl{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      #ed-body .dm-face-row-opts{display:flex;flex-wrap:wrap;gap:5px}
      #ed-body .dm-face-opt{border:2px solid transparent;background:transparent;padding:0;cursor:pointer;border-radius:50%}
      #ed-body .dm-face-opt.on{border-color:var(--info-color,#0ea5e9);box-shadow:0 0 0 2px color-mix(in srgb,var(--info-color,#0ea5e9) 30%,transparent)}
      /* Il filo scuro attorno: un bianco o un ghiaccio su fondo chiaro,
       * senza, non si vede che c'e' una pastiglia. */
      #ed-body .dm-face-swatch{width:26px;height:26px;background:var(--dm-face-swatch);box-shadow:inset 0 0 0 1px rgba(15,23,42,.18)}
      #ed-body .dm-face-thumb{width:42px;height:42px;overflow:hidden;background:#e8edf4}
      #ed-body .dm-face-remove{border:none;background:transparent;color:var(--secondary-text-color,#64748b);font:inherit;font-size:12px;font-weight:750;cursor:pointer;justify-self:start;padding:2px 0}
      #ed-body .dm-face-remove:hover{color:var(--error-color,#dc2626)}
      @media(max-width:560px){#ed-body .dm-face-workbench{flex-direction:column;align-items:center}#ed-body .dm-face-groups{width:100%}}
      @media(prefers-reduced-motion:reduce){#ed-body .dm-face-group-head::before{transition:none}}
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
