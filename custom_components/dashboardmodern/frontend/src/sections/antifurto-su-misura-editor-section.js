/* I tasti d'inserimento per chi una centrale non ce l'ha (#413).
 *
 * «Possibilita' di configurare i comandi di inserimento e modalita' sia nel
 * comando da lanciare che nel nome icona. Utilizzando un dispositivo tramite
 * esphome non ho il classico control_panel_alarm.»
 *
 * La fila della Sicurezza la disegna la centrale: `supported_features` dice
 * quali inserimenti accetta, e i tasti chiamano i servizi di
 * `alarm_control_panel`. Chi l'antifurto se l'e' fatto con ESPHome quell'entita'
 * non ce l'ha — ha uno script che inserisce, un `input_select` con le modalita',
 * un paio di `switch` — e la fila restava quella finta di ripiego, con due tasti
 * che chiamavano servizi inesistenti.
 *
 * Qui i tasti li scrive chi ha la casa: un nome, un'icona del catalogo, l'entita'
 * da chiamare e — se serve — dove leggere se quella modalita' e' inserita adesso.
 * Il blocco sta sotto la casella della centrale, nella scheda Sicurezza, accanto
 * a quello delle modalita' da mostrare; la regola di cosa fanno sta in
 * `core/antifurto-su-misura.js`, qui c'e' solo il modo di dirla.
 */
import {
  CHIAVE_ANTIFURTO_SU_MISURA,
  normalizzaModoSuMisura,
  vuoleUnOpzione,
} from "../core/antifurto-su-misura.js";
import { casellaDellaCentrale } from "./alarm-modes-editor-section.js";
import { openIconPicker } from "./icon-engine-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  tieniIlBloccoNellaScheda,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ANTIFURTO_SU_MISURA_EDITOR__";
const STYLE_ID = "dm-antifurto-su-misura-style";
const BLOCK_ID = "dm-antifurto-su-misura";
const state = (root[KEY] ||= { installed: false });

const ICONA_DI_SERIE = "mdi:shield-home";

/* Le righe come stanno scritte, senza toglierne nessuna: una riga appena
 * aggiunta e' vuota, e la normalizzazione — che scarta chi non ha un'entita' —
 * la farebbe sparire prima di poterla compilare. A scartare pensa chi legge per
 * disegnare la fila. */
function grezze() {
  const stored = readJson(CHIAVE_ANTIFURTO_SU_MISURA, []);
  return Array.isArray(stored) ? stored : [];
}

function salva(modi) {
  writeJsonIfChanged(CHIAVE_ANTIFURTO_SU_MISURA, modi);
  try {
    root.renderSecurity?.();
    root.render?.();
  } catch (_error) {}
}

function nomeDi(modo, indice) {
  return clean(modo?.nome) || clean(modo?.entita) || `${t("Tasto", "Button")} ${indice + 1}`;
}

function rigaMarkup(modo, indice) {
  const entita = clean(modo?.entita);
  const buona = Boolean(normalizzaModoSuMisura(modo, indice));
  return `<article class="ed-row dm-suo-row" data-suo-index="${indice}">
    <div class="dm-suo-head">
      <strong class="ed-row-new">${esc(nomeDi(modo, indice))}</strong>
      <button type="button" class="ed-del" data-suo-del aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Nome del tasto", "Button name"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-nome" class="ed-input" data-suo-field="nome"
        value="${esc(clean(modo?.nome))}" placeholder="${esc(t("Fuori casa", "Away"))}"></span></label>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Icona", "Icon"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-icona" class="ed-input" data-suo-field="icona"
        value="${esc(clean(modo?.icona) || ICONA_DI_SERIE)}" maxlength="40"><button type="button"
        class="dm-suo-icona" data-suo-icona="dm-suo-${indice}-icona"
        aria-label="${esc(t("Scegli icona", "Choose icon"))}">🎨</button></span></label>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Cosa premere", "What to press"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-entita" class="ed-input mono" data-suo-field="entita"
        value="${esc(entita)}" placeholder="script.inserisci_antifurto" autocomplete="off"
        spellcheck="false"><button type="button" class="dm-entity-picker" data-suo-pick="dm-suo-${indice}-entita"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
      <small>${esc(
        t(
          "Lo script, la scena, il pulsante, l'interruttore o l'elenco che inserisce: il servizio giusto lo sceglie la plancia dal dominio dell'entità.",
          "The script, scene, button, switch or select that arms it: the dashboard picks the right service from the entity domain.",
        ),
      )}</small></label>
    ${
      vuoleUnOpzione(entita)
        ? `<label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Quale voce dell'elenco", "Which option"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-opzione" class="ed-input" data-suo-field="opzione"
        value="${esc(clean(modo?.opzione))}" placeholder="${esc(t("Fuori casa", "Away"))}"></span>
      <small>${esc(t("Scritta come Home Assistant la elenca, lettera per lettera.", "Spelled the way Home Assistant lists it, letter for letter."))}</small></label>`
        : ""
    }
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Dove si legge se è inserito", "Where to read if it is armed"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-stato" class="ed-input mono" data-suo-field="stato"
        value="${esc(clean(modo?.stato))}" placeholder="${esc(entita || "sensor.antifurto")}" autocomplete="off"
        spellcheck="false"><button type="button" class="dm-entity-picker" data-suo-pick="dm-suo-${indice}-stato"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Il valore che vuol dire «inserito»", "The value that means “armed”"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-valore" class="ed-input" data-suo-field="valore"
        value="${esc(clean(modo?.valore))}" placeholder="on"></span>
      <small>${esc(
        t(
          "Vuoto vuol dire «on». Senza questo il tasto funziona lo stesso: semplicemente non resta acceso.",
          "Empty means “on”. Without it the button still works: it simply does not stay lit.",
        ),
      )}</small></label>
    ${
      buona
        ? ""
        : `<output class="dm-suo-muto">${esc(
            t(
              "Finché non scegli cosa premere questo tasto non compare.",
              "Until you pick what to press this button does not appear.",
            ),
          )}</output>`
    }
    <button type="button" class="ed-save-btn" data-suo-save>💾 ${esc(t("Salva il tasto", "Save the button"))}</button>
  </article>`;
}

function markup(modi) {
  return `<div class="ed-slot-lbl dm-suo-titolo">${esc(t("Tasti d'inserimento su misura", "Custom arming buttons"))}</div>
  <p class="ed-intro dm-suo-intro">${esc(
    t(
      "Serve a chi una centrale non ce l'ha: un antifurto fatto con ESPHome, con gli script o con un elenco di modalità. Ogni tasto qui sotto compare nella sezione Sicurezza e nella tessera della Home, accanto a quelli della centrale — e se una centrale non c'è, al posto loro.",
      "For those without a panel: an alarm built with ESPHome, with scripts or with a list of modes. Each button below shows up in the Security section and on the Home tile, next to the panel's own — and when there is no panel, in their place.",
    ),
  )}</p>
  <div class="ed-list dm-suo-list">${
    modi.length
      ? modi.map((modo, indice) => rigaMarkup(modo, indice)).join("")
      : `<div class="ed-empty">${esc(t("Nessun tasto su misura", "No custom button"))}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-suo-add>＋ ${esc(t("Aggiungi un tasto", "Add a button"))}</button>`;
}

function firmaDelle(modi) {
  return modi
    .map(
      (modo) =>
        `${clean(modo?.nome)}~${clean(modo?.icona)}~${clean(modo?.entita)}~${clean(modo?.opzione)}~${clean(modo?.stato)}~${clean(modo?.valore)}`,
    )
    .join("|");
}

export function ensureAntifurtoSuMisuraBlock() {
  const casella = casellaDellaCentrale();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!casella) {
    blocco?.remove();
    return false;
  }
  const modi = grezze();
  /* Sotto il blocco delle modalita' quando c'e', altrimenti sotto la casella:
   * sono due cose della stessa fila, e vanno lette una dopo l'altra. */
  const sopra = doc?.getElementById?.("dm-alarm-modes") || casella;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-suo";
    sopra.after(blocco);
  } else if (blocco.previousElementSibling !== sopra) {
    sopra.after(blocco);
  }
  const firma = firmaDelle(modi);
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup(modi);
  return true;
}

function ridisegna() {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (blocco) delete blocco.dataset.firma;
  ensureAntifurtoSuMisuraBlock();
}

function leggiRiga(riga, modo) {
  const next = { ...modo };
  for (const campo of riga.querySelectorAll("[data-suo-field]"))
    next[clean(campo.dataset.suoField)] = clean(campo.value);
  return next;
}

function onClick(event) {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (!blocco || !blocco.contains(event.target)) return;

  if (event.target.closest("[data-suo-add]")) {
    event.preventDefault();
    salva([...grezze(), { icona: ICONA_DI_SERIE }]);
    ridisegna();
    return;
  }
  const riga = event.target.closest("[data-suo-index]");
  if (!riga) return;
  const indice = Number(riga.dataset.suoIndex);
  const modi = grezze();
  if (!Number.isInteger(indice) || !modi[indice]) return;

  if (event.target.closest("[data-suo-del]")) {
    event.preventDefault();
    salva(modi.filter((_voce, quale) => quale !== indice));
    ridisegna();
    root.edToast?.(t("🛡️ Tasto eliminato", "🛡️ Button removed"));
    return;
  }
  const icona = event.target.closest("[data-suo-icona]");
  if (icona) {
    event.preventDefault();
    const campo = doc.getElementById(clean(icona.dataset.suoIcona));
    if (campo) openIconPicker(campo, "action");
    return;
  }
  const cerca = event.target.closest("[data-suo-pick]");
  if (cerca) {
    event.preventDefault();
    const campo = doc.getElementById(clean(cerca.dataset.suoPick));
    if (campo) root.wzPickEntity?.(campo);
    return;
  }
  if (event.target.closest("[data-suo-save]")) {
    event.preventDefault();
    const prossimi = modi.slice();
    prossimi[indice] = leggiRiga(riga, modi[indice]);
    salva(prossimi);
    ridisegna();
    root.edToast?.(
      normalizzaModoSuMisura(prossimi[indice], indice)
        ? t("🛡️ Tasto salvato", "🛡️ Button saved")
        : t("Scegli cosa deve premere", "Pick what it has to press"),
    );
  }
}

function css() {
  return `
  #${BLOCK_ID}{display:block;margin:10px 0 0}
  #${BLOCK_ID} .dm-suo-titolo{margin:0 0 4px}
  #${BLOCK_ID} .dm-suo-intro{margin:0 0 8px}
  #${BLOCK_ID} .dm-suo-list{display:flex;flex-direction:column;gap:8px}
  #${BLOCK_ID} .dm-suo-row{display:flex;flex-direction:column;gap:6px}
  #${BLOCK_ID} .dm-suo-head{display:flex;align-items:center;gap:8px}
  #${BLOCK_ID} .dm-suo-head .ed-row-new{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
  #${BLOCK_ID} .dm-suo-icona{border:0;background:transparent;font-size:18px;cursor:pointer;line-height:1;padding:0 6px}
  #${BLOCK_ID} .dm-suo-muto{display:block;font-size:11px;opacity:.75}
  `;
}

export function installAntifurtoSuMisuraEditorSection() {
  if (!doc || state.installed) return false;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick);
  /* «Non fa inserire altri tasti oltre al primo» (#431).
   *
   * Aggiungere un tasto salva, salvare rifa' la scheda, e il blocco se ne
   * andava con lei: il secondo «＋» non c'era piu' da premere. I tre annunci
   * qui sotto non parlano di quel ridisegno — nessuno lo annuncia — e il
   * blocco delle modalita', che sta due righe sopra, se l'era gia' risolto per
   * conto suo. Adesso la meccanica e' una sola e la usano tutti e due. */
  tieniIlBloccoNellaScheda("dmAntifurtoSuMisura", ensureAntifurtoSuMisuraBlock);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureAntifurtoSuMisuraBlock));
  state.installed = true;
  return true;
}
