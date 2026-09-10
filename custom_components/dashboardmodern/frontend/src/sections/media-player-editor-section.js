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
import { bindLettoreToDevice } from "../core/media-player.js";
import { comandiVicini, elencoComandi, genereDelComando } from "../core/comandi-accanto.js";
import { elencoLetture, lettureVicine } from "../core/letture-accanto.js";
import { ESITI_ELENCO, conLaVoce, tettoDellElenco } from "../core/robot-model.js";
import { nomeAccantoAlDispositivo } from "../core/nome-accanto-al-dispositivo.js";
import { apriMenuIntegrazioni } from "./appliance-integration-section.js";
import {
  allStates,
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

/* Le due liste che un lettore si porta dietro (#451).
 *
 * «Le TV dove vanno messe?» Qui, e con quello che l'integrazione pubblica
 * accanto: l'interruttore dell'alimentazione, la tendina della sorgente, i
 * sensori del canale e del volume. Sono le stesse due liste del robot e degli
 * elettrodomestici, e passano dallo stesso sportello — `conLaVoce` — perché il
 * tetto sia detto e non taciuto. */
const LISTE = Object.freeze({
  comandi: {
    elenco: elencoComandi,
    vicine: comandiVicini,
    segnaposto: "switch.tv_alimentazione",
    etichetta: () => t("Altri comandi", "Other commands"),
    vuoto: () =>
      t(
        "Nessun comando in più: la scheda ha i tasti del lettore e basta.",
        "No extra command: the card carries the player's own buttons and nothing else.",
      ),
    aiuto: () =>
      t(
        "Quello che l'integrazione pubblica accanto al lettore — l'interruttore dell'alimentazione di una TV, la tendina della sorgente, una scena: entità button.*, select.*, switch.* (e input_*, script.*, scene.*). Compaiono sulla scheda sotto i comandi del brano.",
        "What the integration publishes next to the player — a TV's power switch, the input dropdown, a scene: button.*, select.*, switch.* entities (plus input_*, script.*, scene.*). They appear on the card under the playback controls.",
      ),
  },
  letture: {
    elenco: elencoLetture,
    vicine: lettureVicine,
    segnaposto: "sensor.tv_canale",
    etichetta: () => t("Altre letture", "Other readings"),
    vuoto: () =>
      t(
        "Nessuna lettura in più: la scheda dice cosa sta suonando e basta.",
        "No extra reading: the card says what is playing and nothing else.",
      ),
    aiuto: () =>
      t(
        "I sensori che stanno accanto al lettore — il canale, la sorgente, il volume, il consumo di una TV: entità sensor.*, binary_sensor.*, number.*. Compaiono in fondo alla scheda, col loro nome e la loro unità.",
        "The sensors next to the player — a TV's channel, input, volume, power draw: sensor.*, binary_sensor.*, number.* entities. They appear at the bottom of the card, with their own name and unit.",
      ),
  },
});

function spiegazione(esito, tipo) {
  if (esito === ESITI_ELENCO.gia)
    return tipo === "letture"
      ? t("Questa lettura c'è già.", "That reading is already there.")
      : t("Questo comando c'è già.", "That command is already there.");
  if (esito === ESITI_ELENCO.pieno)
    return tipo === "letture"
      ? t(
          "La scheda tiene dieci letture, e ci sono tutte: togline una per farci stare questa.",
          "The card holds ten readings and they are all taken: remove one to make room.",
        )
      : t(
          "La scheda tiene dodici comandi, e ci sono tutti: togline uno per farci stare questo.",
          "The card holds twelve commands and they are all taken: remove one to make room.",
        );
  return tipo === "letture"
    ? t(
        "Serve un'entità sensor.*, binary_sensor.* o number.* — oppure input_number, input_text.",
        "A sensor.*, binary_sensor.* or number.* entity is required — or input_number, input_text.",
      )
    : t(
        "Serve un'entità button.*, select.* o switch.* — oppure input_button, input_select, input_boolean, script, scene.",
        "A button.*, select.* or switch.* entity is required — or input_button, input_select, input_boolean, script, scene.",
      );
}

function pastigliaMarkup(entity, tipo, azione, segno, voce, states) {
  return `<button type="button" class="dm-mp-chip" data-mp-chip-${esc(azione)}="${esc(entity)}" data-mp-chip-tipo="${esc(tipo)}" data-genere="${esc(genereDelComando(entity) || "lettura")}" title="${esc(entity)}"><span>${esc(nomeAccantoAlDispositivo(entity, voce, states))}</span><i aria-hidden="true">${segno}</i></button>`;
}

function listaMarkup(tipo, voce, indice) {
  const states = allStates();
  const regola = LISTE[tipo];
  const tetto = tettoDellElenco(tipo);
  const scelte = regola.elenco(voce?.[tipo]);
  const proposte = regola.vicine(voce, states).slice(0, 24);
  return `<div class="ed-slot dm-mp-ed-campo dm-mp-lista" data-mp-lista="${esc(tipo)}">
    <span class="ed-slot-lbl">${esc(regola.etichetta())} <b class="dm-mp-quanti"${scelte.length >= tetto ? ' data-pieno="true"' : ""}>${esc(String(scelte.length))}/${esc(String(tetto))}</b></span>
    <input type="hidden" data-mp-campo="${esc(tipo)}" value="${esc(scelte.join(","))}">
    <div class="dm-mp-chips">${
      scelte.length
        ? scelte.map((entity) => pastigliaMarkup(entity, tipo, "del", "✕", voce, states)).join("")
        : `<small class="dm-mp-chips-vuoto">${esc(regola.vuoto())}</small>`
    }</div>
    <span class="ed-form-row"><input id="dm-mp-ed-${indice}-${esc(tipo)}" class="ed-input mono" data-mp-chip-nuovo placeholder="${esc(regola.segnaposto)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-mp-pick="dm-mp-ed-${indice}-${esc(tipo)}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button><button type="button" class="dm-entity-picker dm-mp-aggiungi" data-mp-chip-add="${esc(tipo)}" aria-label="${esc(t("Aggiungi", "Add"))}" title="${esc(t("Aggiungi", "Add"))}">＋</button></span>
    ${
      proposte.length
        ? `<small>${esc(t("Trovate accanto al lettore — un tocco le aggiunge:", "Found next to the player — one tap adds them:"))}</small>
    <div class="dm-mp-chips dm-mp-proposte">${proposte.map((entity) => pastigliaMarkup(entity, tipo, "sug", "＋", voce, states)).join("")}</div>`
        : ""
    }
    <small>${esc(regola.aiuto())}</small>
  </div>`;
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
      ${listaMarkup("comandi", voce, indice)}
      ${listaMarkup("letture", voce, indice)}
      <output class="dm-mp-ed-errore" data-mp-errore></output>
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
  <div class="dm-mp-invito">
    <button type="button" class="ed-btn-add dm-mp-integ" data-mp-integ>🔗 ${esc(
      t("Aggiungi da un'integrazione", "Add from an integration"),
    )}</button>
    <small>${esc(
      t(
        "SmartThings, Sonos, Chromecast, AirPlay… scegli il dispositivo e il lettore arriva già fatto: la sua entità, i comandi che l'integrazione pubblica accanto — l'interruttore di una TV, la tendina della sorgente — e le sue letture. Oppure, qui sotto, una casella alla volta.",
        "SmartThings, Sonos, Chromecast, AirPlay… pick the device and the player arrives ready-made: its entity, the controls the integration publishes next to it — a TV's power switch, the input dropdown — and its readings. Or, below, one field at a time.",
      ),
    )}</small>
  </div>
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

/* Cosa il dispositivo ha lasciato capire, prima di confermare.
 *
 * La finestra delle integrazioni è la stessa degli elettrodomestici e del
 * robot — le integrazioni, i dispositivi, la ricerca sono uguali per chiunque
 * colleghi qualcosa — e questo è l'unico pezzo che sa di lettori. */
function anteprimaLettore({ device, entities }) {
  const states = allStates();
  const nato = bindLettoreToDevice({ device, entities, states });
  const casella = (etichetta, valore) =>
    `<div class="dm-integ-casella"><span>${esc(etichetta)}</span><b class="mono">${esc(valore) || "—"}</b></div>`;
  const nomi = (voci) =>
    voci.length
      ? `${voci.length} — ${voci.map((voce) => nomeAccantoAlDispositivo(voce, nato, states)).join(", ")}`
      : "";
  return {
    etichetta: t("Lettore", "Player"),
    corpo: `<div class="dm-integ-caselle">
        ${casella(t("Entità", "Entity"), nato.entity)}
        ${casella(t("Altri comandi", "Other commands"), nomi(nato.comandi))}
        ${casella(t("Altre letture", "Other readings"), nomi(nato.letture))}
      </div>`,
  };
}

/* Il lettore nuovo, nato dal dispositivo scelto: si salva e si apre, così chi
 * l'ha appena creato vede subito cosa gli è stato assegnato. */
function creaDaDispositivo({ device, entities, integration }) {
  const lista = lettori().slice();
  const nato = bindLettoreToDevice({
    device,
    entities,
    states: allStates(),
    indice: lista.length,
  });
  /* Un dispositivo che un lettore non ce l'ha non diventa un lettore: la
   * finestra mostra TUTTI i dispositivi, e da lì può arrivare un termostato. */
  if (!clean(nato.entity)) {
    root.alert?.(
      t(
        "Da questo dispositivo non si riconosce nessun lettore: serve un'entità media_player.*.",
        "No media player can be recognised from this device: a media_player.* entity is needed.",
      ),
    );
    return;
  }
  /* La stanza la sa già Home Assistant: se l'area del dispositivo ha lo stesso
   * nome di una stanza configurata, il lettore ci va dentro da solo. */
  const stanze = readJson("cd_stanze", []);
  const area = clean(device?.area);
  const stanza = (Array.isArray(stanze) ? stanze : []).find(
    (voce) => clean(voce?.name).toLowerCase() === area.toLowerCase(),
  );
  if (stanza) nato.room_id = clean(stanza.id) || clean(stanza.name);
  state.aperta = lista.length;
  salva([...lista, nato]);
  ridisegna();
  const daChi = clean(integration?.name) || t("un'integrazione", "an integration");
  root.edToast?.(`${nato.nome || device.name} — ${t("aggiunto da", "added from")} ${daChi}`);
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== MEDIA_EDITOR_TAB || !body.contains(event.target)) return;

  if (event.target.closest("[data-mp-integ]")) {
    event.preventDefault();
    apriMenuIntegrazioni({
      titolo: t("Aggiungi un lettore da un'integrazione", "Add a player from an integration"),
      intro: t(
        "Le integrazioni di Home Assistant, ufficiali o da HACS, con i dispositivi che portano. Scegli la tua TV o il tuo diffusore: la sua entità, i comandi che l'integrazione pubblica accanto e le sue letture entrano da soli.",
        "Home Assistant integrations, official or from HACS, with the devices they bring. Pick your TV or speaker: its entity, the controls the integration publishes next to it and its readings come along by themselves.",
      ),
      anteprima: anteprimaLettore,
      onScelto: (scelta) => creaDaDispositivo(scelta),
    });
    return;
  }
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

  /* Le due liste (#451): aggiungere una proposta, aggiungere quella scritta
   * nella casella, toglierne una scelta. Si salva subito — con quello che c'è
   * scritto nelle altre caselle, così un nome battuto e non ancora salvato non
   * va perso — e la scheda del lettore cambia mentre si guarda. */
  const proposta = event.target.closest("[data-mp-chip-sug]");
  const togli = event.target.closest("[data-mp-chip-del]");
  const aggiungi = event.target.closest("[data-mp-chip-add]");
  if (proposta || togli || aggiungi) {
    event.preventDefault();
    const tocco = proposta || togli || aggiungi;
    const tipo = clean(tocco.dataset.mpChipTipo || tocco.dataset.mpChipAdd);
    if (!LISTE[tipo]) return;
    const casella = tocco.closest(`[data-mp-lista="${CSS.escape(tipo)}"]`);
    const errore = riga.querySelector("[data-mp-errore]");
    const letta = leggiLaRiga(riga);
    let elenco = LISTE[tipo].elenco(letta[tipo]);
    if (togli) {
      elenco = elenco.filter((entity) => entity !== clean(togli.dataset.mpChipDel));
    } else {
      const nuovo = proposta
        ? clean(proposta.dataset.mpChipSug)
        : clean(casella?.querySelector("[data-mp-chip-nuovo]")?.value);
      const esito = conLaVoce(elenco, nuovo, tipo);
      if (esito.esito !== ESITI_ELENCO.aggiunto) {
        if (errore) errore.textContent = spiegazione(esito.esito, tipo);
        return;
      }
      elenco = esito.elenco;
    }
    if (errore) errore.textContent = "";
    const lista = righeDalDocumento(body);
    lista[indice] = { ...letta, [tipo]: elenco };
    salva(lista);
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
      /* Le due liste (#451): pastiglie, quelle scelte con la croce e quelle
         proposte col piu'; la tendina si riconosce dal bordo tratteggiato. */
      #ed-body .dm-mp-lista{display:grid;gap:5px}
      #ed-body .dm-mp-lista .ed-form-row{display:flex;gap:8px;min-width:0}
      #ed-body .dm-mp-lista .ed-form-row>input{flex:1 1 auto;min-width:0}
      #ed-body .dm-mp-lista small{font-size:11px;line-height:1.45;color:var(--text-dim,#64748b);font-weight:600}
      #ed-body .dm-mp-chips{display:flex;flex-wrap:wrap;gap:6px}
      #ed-body .dm-mp-chip{
        display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:5px 10px;
        border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;
        background:var(--card-bg,#fff);font:inherit;font-size:12px;font-weight:800;
        color:var(--text,#0f172a);cursor:pointer}
      #ed-body .dm-mp-chip>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #ed-body .dm-mp-chip>i{font-style:normal;opacity:.7}
      #ed-body .dm-mp-chip[data-genere="tendina"]{border-style:dashed}
      #ed-body .dm-mp-proposte .dm-mp-chip{border-color:#8b5cf6;color:#6d28d9}
      #ed-body .dm-mp-chips-vuoto{opacity:.75}
      #ed-body .dm-mp-quanti{margin-left:6px;font-size:10.5px;font-weight:900;opacity:.6;font-variant-numeric:tabular-nums}
      #ed-body .dm-mp-quanti[data-pieno="true"]{opacity:1;color:var(--warning-color,#f59e0b)}
      #ed-body .dm-mp-aggiungi{background:linear-gradient(135deg,#10b981,#047857)}
      #ed-body .dm-mp-ed-errore:not(:empty){color:var(--error-color,#dc2626);font-size:12px;font-weight:800}
      #ed-body .dm-mp-invito{display:grid;gap:6px;margin:0 0 12px;padding:12px;border-radius:14px;border:1px dashed color-mix(in srgb,#8b5cf6 45%,transparent);background:color-mix(in srgb,#8b5cf6 7%,transparent)}
      #ed-body .dm-mp-invito .dm-mp-integ{margin:0!important;background:linear-gradient(135deg,#6d28d9,#4c1d95)!important;color:#fff!important}
      #ed-body .dm-mp-invito small{font-size:11px;line-height:1.45;color:var(--text-dim,#64748b);font-weight:600}
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
