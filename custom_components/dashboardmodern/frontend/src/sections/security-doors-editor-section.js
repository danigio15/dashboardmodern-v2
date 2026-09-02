/* La configurazione delle aperture (#195).
 *
 * La scheda non esiste nel documento vendorizzato: si aggiunge accanto alle
 * altre, come quella dei robot e delle persone. Ogni riga e' una porta — nome,
 * entita' che la apre, icona, PIN facoltativo — e viaggia in
 * `cd_security_doors`, nella configurazione condivisa fra i dispositivi.
 */
import {
  SECURITY_DOOR_DOMAINS,
  doorsSenzaOccupate,
  isDoorEntity,
  normalizeDoorPin,
} from "../core/security-door-model.js";
import { entitaDellePrese, iconaPortaMarkup } from "./security-doors-section.js";
import { openIconPicker } from "./icon-engine-section.js";
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

const KEY = "__DASHBOARDMODERN_SECURITY_DOORS_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

export const DOORS_EDITOR_TAB = "doors";
const CONFIG_KEY = "cd_security_doors";

/* L'icona di serie di una porta e' quella del CATALOGO di casa, non un'emoji
 * di sistema: «anche in primo inserimento, sulla riga icona vedo una porta che
 * non appartiene al catalogo nostro». Il token lo disegna il motore. */
const ICONA_PORTA = "mdi:door-closed";

/* L'editor lavora sulle righe grezze: una porta appena aggiunta e' vuota, e la
 * normalizzazione — che le righe non valide le scarta — la farebbe sparire
 * prima che si possa compilarla. A normalizzare ci pensa chi legge per
 * disegnare (`security-doors-section.js`). */
function salva(doors) {
  writeJsonIfChanged(CONFIG_KEY, doors);
  root.renderSecurity?.();
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function nomeDi(door, index) {
  return clean(door.name) || clean(door.entity) || `${t("Porta", "Door")} ${index + 1}`;
}

function rigaMarkup(door, index) {
  const aperto = state.aperto === index;
  return `<article class="ed-row dm-door-ed-row" data-door-index="${index}" data-open="${aperto}">
    <div class="dm-door-ed-head">
      <span class="dm-door-ed-icon" aria-hidden="true">${iconaPortaMarkup(door.icon)}</span>
      <span class="ed-row-main dm-door-ed-testo"><strong class="ed-row-new">${esc(nomeDi(door, index))}</strong><small class="ed-row-old mono">${esc(clean(door.entity) || t("nessuna entità", "no entity"))}${door.pin ? " · 🔒 PIN" : ""}</small>${
        clean(door.entity)
          ? ""
          : `<small class="dm-door-ed-muta">${esc(
              t(
                "Finché non scegli l'entità questa apertura non si vede: né nella sezione, né nella tessera, e l'interruttore «nel widget» non compare.",
                "Until you pick the entity this opening is nowhere to be seen: not in the section, not on the tile, and the “in the widget” switch does not appear.",
              ),
            )}</small>`
      }</span>
      <button type="button" class="ed-del dm-door-ed-edit" data-door-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-door-ed-del" data-door-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-door-ed-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-door-ed-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input id="dm-door-${index}-name" class="ed-input" data-door-field="name" value="${esc(clean(door.name))}" placeholder="${t("Portone condominio", "Building front door")}"></span></label>
      <label class="ed-slot dm-door-ed-field"><span class="ed-slot-lbl">${t("Entità che apre", "Opening entity")}</span>
        <span class="ed-form-row"><input id="dm-door-${index}-entity" class="ed-input mono" data-door-field="entity" value="${esc(door.entity)}" placeholder="lock.portone" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-door-pick="dm-door-${index}-entity" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>
        <small>${t("Serratura, pulsante, relè, cancello o script: lock.*, button.*, switch.*, cover.*, script.*…", "Lock, button, relay, gate or script: lock.*, button.*, switch.*, cover.*, script.*…")}</small></label>
      <label class="ed-slot dm-door-ed-field"><span class="ed-slot-lbl">${t("Icona", "Icon")}</span><span class="ed-form-row"><input id="dm-door-${index}-icon" class="ed-input" data-door-field="icon" value="${esc(door.icon || ICONA_PORTA)}" maxlength="24"><button type="button" class="dm-door-icon-btn" data-door-icon-pick="dm-door-${index}-icon" aria-label="${t("Scegli icona", "Choose icon")}">🎨</button></span></label>
      <label class="ed-slot dm-door-ed-field"><span class="ed-slot-lbl">${t("PIN (facoltativo)", "PIN (optional)")}</span><span class="ed-form-row"><input id="dm-door-${index}-pin" class="ed-input mono" data-door-field="pin" value="${esc(door.pin)}" inputmode="numeric" autocomplete="off" placeholder="1234"></span>
        <small>${t("Da 4 a 8 cifre: prima di aprire viene chiesto il codice, contro i tocchi accidentali. Vuoto = solo conferma.", "4 to 8 digits: the code is asked before opening, against accidental taps. Empty = confirm only.")}</small></label>
      <output class="dm-door-ed-error" data-door-error></output>
      <button type="button" class="ed-save-btn" data-door-save>💾 ${t("Salva porta", "Save door")}</button>
    </div>
  </article>`;
}

function bodyMarkup(doors) {
  return `<div class="ed-intro">${t(
    "Le aperture della sezione Sicurezza: portone, porta di casa, cancello. Ogni porta ha la sua card; il tocco chiede conferma e, se imposti un PIN, il codice.",
    "The openings of the Security section: front door, house door, gate. Each door gets its own card; a tap asks to confirm and, with a PIN set, asks for the code.",
  )}</div>
  <div class="ed-list dm-door-ed-list">${
    doors.length
      ? doors.map((door, index) => rigaMarkup(door, index)).join("")
      : `<div class="ed-empty">${t("Nessuna apertura configurata", "No opening configured")}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-door-add>＋ ${t("Aggiungi apertura", "Add opening")}</button>`;
}

function leggiRiga(riga, door) {
  const next = { ...door };
  for (const input of riga.querySelectorAll("[data-door-field]"))
    next[clean(input.dataset.doorField)] = clean(input.value);
  return next;
}

export function ensureDoorsEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== DOORS_EDITOR_TAB) return false;
  const doors = grezze();
  const firma = [
    state.aperto,
    ...doors.map((door) => `${door?.id}~${door?.name}~${door?.entity}~${door?.icon}~${door?.pin}`),
  ].join("|");
  if (body.dataset.dmDoorsEditor === firma && body.querySelector(".dm-door-ed-list")) return true;
  body.dataset.dmDoorsEditor = firma;
  body.innerHTML = bodyMarkup(doors);
  body.dataset.renderer = "doors";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmDoorsEditor;
  ensureDoorsEditor();
}

function grezze() {
  const stored = readJson(CONFIG_KEY, []);
  const righe = Array.isArray(stored) ? stored : [];
  /* Le entita' delle Prese non sono porte: se la configurazione condivisa se
   * le e' portate qui dentro (viste dal campo: switch.lavatrice fra le
   * aperture), si scartano E si ripulisce la lista salvata, cosi' il macello
   * non torna dagli altri dispositivi. Le righe vuote in compilazione restano. */
  const pulite = doorsSenzaOccupate(righe, entitaDellePrese());
  if (pulite.length !== righe.length) writeJsonIfChanged(CONFIG_KEY, pulite);
  return pulite;
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== DOORS_EDITOR_TAB || !body.contains(event.target)) return;

  if (event.target.closest("[data-door-add]")) {
    event.preventDefault();
    /* La riga nuova nasce vuota e quindi non normalizzabile: si scrive grezza,
     * la normalizzazione la faranno il salvataggio e la sezione. */
    const raw = grezze();
    state.aperto = raw.length;
    writeJsonIfChanged(CONFIG_KEY, [
      ...raw,
      { id: `door-${Date.now().toString(36)}`, name: "", entity: "", icon: ICONA_PORTA, pin: "" },
    ]);
    ridisegna();
    return;
  }
  const pick = event.target.closest("[data-door-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.doorPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  /* L'icona si sceglie dal catalogo, non si scrive a mano: e' lo stesso
   * selettore delle icone degli avvisi — porte, cancelli e serrature ci sono
   * gia' — col titolo suo. Il campo resta scrivibile per chi vuole un'emoji
   * che nel catalogo non c'e'. */
  const pickIcona = event.target.closest("[data-door-icon-pick]");
  if (pickIcona) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pickIcona.dataset.doorIconPick))}`);
    if (input) openIconPicker(input, "action");
    return;
  }
  const riga = event.target.closest("[data-door-index]");
  if (!riga) return;
  const index = Number(riga.dataset.doorIndex);
  const raw = grezze();
  if (!Number.isFinite(index) || !raw[index]) return;

  if (event.target.closest("[data-door-edit]")) {
    event.preventDefault();
    state.aperto = state.aperto === index ? -1 : index;
    ridisegna();
    return;
  }
  if (event.target.closest("[data-door-del]")) {
    event.preventDefault();
    const nome = nomeDi(raw[index], index);
    const domanda = t(`Elimino "${nome}"?`, `Remove "${nome}"?`);
    if (root.confirm && !root.confirm(domanda)) return;
    state.aperto = -1;
    writeJsonIfChanged(
      CONFIG_KEY,
      raw.filter((_door, position) => position !== index),
    );
    root.renderSecurity?.();
    ridisegna();
    return;
  }
  if (event.target.closest("[data-door-save]")) {
    event.preventDefault();
    salvaTutte(body);
  }
}

/* Il salvataggio legge TUTTE le righe prima di scrivere, come le Persone.
 *
 * Il tasto «Salva sezione» preme i salvataggi nascosti di ogni riga, uno
 * dietro l'altro; ma il salvataggio per-riga ridisegnava l'editor, e i bottoni
 * delle righe dopo restavano staccati dal documento: il gestore delegato li
 * ignorava e si salvava SOLO la prima porta — le altre perdevano l'entita'
 * appena scelta e la pagina Sicurezza non le mostrava. Un gesto solo che
 * raccoglie ogni riga e scrive una volta non ha un secondo bottone da perdere.
 */
function salvaTutte(body) {
  const raw = grezze();
  const next = raw.slice();
  const righe = body.querySelectorAll("[data-door-index]");
  const errori = new Map();
  for (const riga of righe) {
    const index = Number(riga.dataset.doorIndex);
    if (!Number.isFinite(index) || !next[index]) continue;
    next[index] = leggiRiga(riga, next[index]);
    const porta = next[index];
    const vuota = !clean(porta.name) && !clean(porta.entity) && !clean(porta.pin);
    if (vuota) {
      /* La riga appena aggiunta e mai compilata non diventa una «Porta 2»
       * fantasma che gira in configurazione: sparisce in silenzio. */
      next[index] = null;
      continue;
    }
    if (!isDoorEntity(porta.entity)) {
      const domini = SECURITY_DOOR_DOMAINS.join(", ");
      /* La riga resta scritta com'e' — grezza, non renderizzabile — cosi'
       * quello che l'utente ha battuto non si perde mentre la completa. */
      errori.set(
        clean(porta.id),
        t(
          `Serve un'entità che sappia aprire: ${domini}.`,
          `An entity that can open is required: ${domini}.`,
        ),
      );
      continue;
    }
    const pin = clean(porta.pin);
    if (pin && !normalizeDoorPin(pin))
      errori.set(clean(porta.id), t("Il PIN è di 4-8 cifre.", "The PIN is 4-8 digits."));
  }
  const salvate = next.filter(Boolean);
  /* La riga da completare resta aperta, con l'errore in vista; a lavoro
   * finito le teste si chiudono. */
  state.aperto = salvate.findIndex((porta) => errori.has(clean(porta.id)));
  salva(salvate);
  ridisegna();
  for (const [id, testo] of errori) {
    const posizione = salvate.findIndex((porta) => clean(porta.id) === id);
    const errore = body.querySelector(`[data-door-index="${posizione}"] [data-door-error]`);
    if (errore) errore.textContent = testo;
  }
  root.edToast?.(
    errori.size
      ? t("💾 Salvate — una porta è da completare", "💾 Saved — one door needs finishing")
      : t("💾 Porta salvata", "💾 Door saved"),
  );
}

export function ensureDoorsEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${DOORS_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = DOORS_EDITOR_TAB;
  /* Nel menu della configurazione le voci stanno in colonna e strette: il nome
   * per esteso — quello che sta in testa alla sezione — si troncava a meta'
   * parola. Qui va la stessa cosa detta corta, come «Elettrodom.» sta per
   * «Elettrodomestici». */
  tab.textContent = `🚪 ${t("Apri porte/cancelli", "Door & gate openers")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(DOORS_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

function installStyles() {
  installStyle(
    "dm-door-editor-style",
    `
      #ed-body .dm-door-ed-list{display:grid;gap:8px;margin-bottom:10px}
      #ed-body .dm-door-ed-row{display:block!important;padding:0!important;overflow:hidden}
      #ed-body .dm-door-ed-head{display:flex;align-items:center;gap:10px;padding:10px 12px}
      /* Il nome e l'entita' erano incollati: «dopo salvato, nome porta e'
       * troppo attaccato a nome entita'». Vanno su due righe loro. */
      #ed-body .dm-door-ed-testo{display:grid!important;gap:3px!important;min-width:0}
      #ed-body .dm-door-ed-testo .ed-row-new{line-height:1.25}
      #ed-body .dm-door-ed-testo .ed-row-old{opacity:.72;font-size:11.5px;line-height:1.3}
      /* L'apertura senza entita' non e' un dettaglio grigio come gli altri:
         e' una riga che non comparira' da nessuna parte, e finora lo diceva
         con la stessa voce con cui si dice tutto il resto. */
      #ed-body .dm-door-ed-muta{
        display:block;font-size:11.5px;line-height:1.35;font-weight:700;
        color:var(--warning-color,#b45309)}
      #ed-body .dm-door-ed-icon{font-size:18px}
      #ed-body .dm-door-ed-body{display:grid;gap:8px;padding:0 12px 12px}
      #ed-body .dm-door-ed-body[hidden]{display:none!important}
      #ed-body .dm-door-ed-field{display:grid;gap:4px;margin:0}
      #ed-body .dm-door-ed-field .ed-form-row{display:flex;gap:8px;min-width:0}
      #ed-body .dm-door-ed-field .ed-form-row>input{flex:1 1 auto;min-width:0}
      /* Il tasto del catalogo icone veste come la lente delle entita' ma ha
       * una classe tutta sua: .dm-entity-picker accanto a un input marca il
       * campo come entita' (la guardia apriva la ricerca delle entita' sopra
       * al catalogo), e button.dm-icon-picker e' il gancio dell'icon engine
       * (apriva «Scegli icona azione»). Ogni classe condivisa qui e' un
       * gestore in piu' che ruba il click. */
      #ed-body .dm-door-icon-btn{display:inline-grid!important;place-items:center!important;flex:0 0 50px!important;width:50px!important;min-width:50px!important;height:50px!important;min-height:50px!important;padding:0!important;border:0!important;border-radius:13px!important;background:linear-gradient(145deg,#12aee4,#047faf)!important;color:#fff!important;font-size:16px!important;cursor:pointer!important}
      @media(max-width:600px){#ed-body .dm-door-icon-btn{flex-basis:46px!important;width:46px!important;min-width:46px!important;height:46px!important;min-height:46px!important}}
      #ed-body .dm-door-ed-error:not(:empty){color:var(--error-color,#dc2626);font-size:12px;font-weight:800}
    `,
  );
}

export function installSecurityDoorsEditorSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureDoorsEditorTab();
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmDoorsEditor", () => {
    root.queueMicrotask?.(() => {
      ensureDoorsEditorTab();
      ensureDoorsEditor();
    });
  });
  for (const event of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(event, () => {
      root.queueMicrotask?.(() => {
        ensureDoorsEditorTab();
        ensureDoorsEditor();
      });
    });
  ensureDoorsEditor();
}

installSecurityDoorsEditorSection();
