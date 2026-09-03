/* Dove si dichiarano i lettori multimediali (#269).
 *
 * «Sarebbe carino una sezione dedicata ai dispositivi Media Player.»
 *
 * Un lettore è quattro cose: quale entità, come si chiama, in che stanza sta
 * e con che segno compare quando non c'è una copertina da mostrare. Tutto il
 * resto — che tasti sa eseguire, che sorgenti ha, che volume tiene — lo dice
 * Home Assistant, e chiederlo qui vorrebbe dire farlo scrivere a mano a chi
 * lo sa già.
 */
import { CHIAVE_MEDIA, ridisegnaMediaPlayer } from "./media-player-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  righeDelDocumento,
  roomOptionsMarkup,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_MEDIA_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperta: -1 });

export const MEDIA_EDITOR_TAB = "media";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* Si lavora sulle righe grezze: una riga appena aggiunta non ha ancora
 * un'entità, e la normalizzazione la scarterebbe prima di poterla compilare. */
function lettori() {
  const grezzo = readJson(CHIAVE_MEDIA, []);
  return Array.isArray(grezzo) ? grezzo : [];
}

function salva(lista) {
  writeJsonIfChanged(CHIAVE_MEDIA, lista);
  ridisegnaMediaPlayer();
}

/* La fascia del guscio, come le altre schede: spegne la voce nella barra senza
 * cancellare quello che è stato configurato. */
function fasciaMarkup() {
  try {
    return root.cdSecToggleHtml?.(MEDIA_EDITOR_TAB) || "";
  } catch (_error) {
    return "";
  }
}

function sezioneNascosta() {
  try {
    return root.cdCfg?.("cd_sections")?.[MEDIA_EDITOR_TAB] === false;
  } catch (_error) {
    return false;
  }
}

function rigaMarkup(voce, indice) {
  const aperta = state.aperta === indice;
  const id = `dm-mp-ed-${indice}`;
  const nome = clean(voce?.nome) || clean(voce?.entity) || t("Lettore nuovo", "New player");
  return `<article class="ed-row dm-todo-ed-row dm-mp-ed-riga" data-mp-voce="${indice}" data-open="${aperta}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">${esc(clean(voce?.icona) || "🔊")}</span>
      <span class="ed-row-main">
        <strong class="ed-row-new">${esc(nome)}</strong>
        <small class="ed-row-old mono">${esc(clean(voce?.entity))}</small>
      </span>
      <button type="button" class="ed-del dm-todo-ed-edit" data-mp-edit
        aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-mp-del
        aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperta ? "" : " hidden"}>
      <div class="dm-mp-ed-testa">
        <input class="ed-input dm-mp-ed-icona" data-mp-campo="icona" value="${esc(
          clean(voce?.icona),
        )}" placeholder="🔊" aria-label="${esc(t("Icona", "Icon"))}" maxlength="4">
        <input class="ed-input" data-mp-campo="nome" value="${esc(clean(voce?.nome))}"
          placeholder="${esc(t("Nome (facoltativo)", "Name (optional)"))}">
      </div>
      <label class="ed-slot dm-mp-ed-campo"><span class="ed-slot-lbl">${esc(
        t("Entità", "Entity"),
      )}</span><span class="ed-form-row"><input id="${id}" class="ed-input mono"
        data-mp-campo="entity" value="${esc(clean(voce?.entity))}"
        placeholder="media_player.salotto" autocomplete="off" spellcheck="false"
        ><button type="button" class="dm-entity-picker" data-mp-pick="${id}"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>
      <label class="ed-slot dm-mp-ed-campo"><span class="ed-slot-lbl">${esc(
        t("Stanza", "Room"),
      )}</span><span class="ed-form-row"><select id="${id}-room" class="ed-input"
        data-mp-campo="room_id">${roomOptionsMarkup(
          clean(voce?.room_id),
          t("Nessuna stanza", "No room"),
        )}</select></span></label>
      <button type="button" class="ed-save-btn" data-mp-save>💾 ${esc(
        t("Salva lettore", "Save player"),
      )}</button>
    </div>
  </article>`;
}

function corpoMarkup() {
  const lista = lettori();
  return `${fasciaMarkup()}<div class="dm-mp-ed">
  <div class="ed-sec-title">🔊 ${esc(t("Musica", "Media"))}</div>
  <div class="ed-intro">${esc(
    t(
      "I lettori che dichiari qui hanno una scheda tutta loro, e come sfondo la copertina di quello che stanno suonando. I tasti che compaiono sono quelli che il lettore sa eseguire davvero: se non ha il brano successivo, quel tasto non viene disegnato. Puoi anche metterli fra le Azioni rapide della Home: lì il tasto prende la copertina come sfondo, e premerlo mette in pausa o fa ripartire.",
      "The players you declare here get a page of their own, with the artwork of whatever they are playing as the background. The buttons that show up are the ones the player can really do: no next track, no next-track button. You can also put them among the Home quick actions: there the tile takes the artwork as its background, and tapping it pauses or resumes.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">${
    lista.length
      ? lista.map((voce, indice) => rigaMarkup(voce, indice)).join("")
      : `<div class="ed-empty">${esc(
          t("Nessun lettore configurato.", "No media player configured."),
        )}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-mp-add>＋ ${esc(
    t("Aggiungi lettore", "Add player"),
  )}</button>
  </div>`;
}

export function ensureMediaEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== MEDIA_EDITOR_TAB) return false;
  const firma = `${JSON.stringify(lettori())}|${state.aperta}|${sezioneNascosta()}`;
  if (body.dataset.dmMediaEditor === firma && body.querySelector(".dm-mp-ed")) return true;
  body.dataset.dmMediaEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = MEDIA_EDITOR_TAB;
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmMediaEditor;
  ensureMediaEditor();
}

function leggiLaRiga(riga) {
  const letto = { ...(lettori()[Number(riga.dataset.mpVoce)] || {}) };
  for (const campo of riga.querySelectorAll("[data-mp-campo]"))
    letto[clean(campo.dataset.mpCampo)] = clean(campo.value);
  if (!clean(letto.id)) letto.id = `lettore-${Date.now().toString(36)}`;
  return letto;
}

/* La fascia «Salva sezione» preme il salvataggio di ogni riga una dopo
 * l'altra: il primo scrive e ridisegna, e il ridisegno stacca gli altri
 * bottoni dal documento. Chi scrive per primo scrive per tutti. */
function righeDalDocumento(body) {
  return righeDelDocumento(body, "data-mp-voce", lettori(), (riga) => leggiLaRiga(riga));
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== MEDIA_EDITOR_TAB || !body.contains(event.target)) return;

  if (event.target.closest("[data-mp-add]")) {
    event.preventDefault();
    const lista = lettori().slice();
    lista.push({ id: `lettore-${Date.now().toString(36)}`, entity: "", nome: "", icona: "" });
    state.aperta = lista.length - 1;
    salva(lista);
    ridisegna();
    return;
  }

  const riga = event.target.closest("[data-mp-voce]");
  if (!riga) return;
  const indice = Number(riga.dataset.mpVoce);

  const pick = event.target.closest("[data-mp-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.mpPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }

  if (event.target.closest("[data-mp-edit]")) {
    event.preventDefault();
    state.aperta = state.aperta === indice ? -1 : indice;
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mp-del]")) {
    event.preventDefault();
    const lista = lettori().slice();
    lista.splice(indice, 1);
    state.aperta = -1;
    salva(lista);
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mp-save]")) {
    event.preventDefault();
    const lista = righeDalDocumento(body);
    lista[indice] = leggiLaRiga(riga);
    salva(lista);
    ridisegna();
    root.edToast?.(t("💾 Lettore salvato", "💾 Player saved"));
  }
}

export function ensureMediaTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${MEDIA_EDITOR_TAB}"]`))
    return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = MEDIA_EDITOR_TAB;
  linguetta.textContent = `🔊 ${t("Musica", "Media")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(MEDIA_EDITOR_TAB));
  const prima =
    linguette.querySelector('.ed-tab[data-tab="luci"]')?.nextSibling ||
    linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) linguette.insertBefore(linguetta, prima);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-media-editor",
    `
      #ed-body .dm-mp-ed-testa{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;margin-bottom:10px}
      #ed-body .dm-mp-ed-icona{text-align:center;font-size:18px}
      #ed-body .dm-mp-ed-campo{margin:0 0 10px}
      #ed-body .dm-mp-ed-riga .ed-row-main{display:block;min-width:0}
      #ed-body .dm-mp-ed-riga .ed-row-new,
      #ed-body .dm-mp-ed-riga .ed-row-old{display:block;overflow:hidden;text-overflow:ellipsis}
      #ed-body .dm-mp-ed-riga .ed-row-old{margin-top:3px;color:var(--text-dim,#64748b)}
      @media(max-width:560px){
        #ed-body .dm-mp-ed-testa{grid-template-columns:52px minmax(0,1fr);gap:6px}
      }
    `,
  );
}

export function installMediaEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmMediaEditor", () => {
    ensureMediaTab();
    ensureMediaEditor();
  });
  ensureMediaTab();
  onEditorRedraw("__dmMediaEditor", () => {
    root.queueMicrotask?.(() => {
      ensureMediaTab();
      ensureMediaEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureMediaTab();
        ensureMediaEditor();
      });
    });
  ensureMediaEditor();
  return true;
}
