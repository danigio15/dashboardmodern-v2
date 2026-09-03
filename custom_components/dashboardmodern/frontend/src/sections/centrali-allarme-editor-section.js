/* Le aree d'allarme nella scheda Sicurezza (#285).
 *
 * «Nella sezione sicurezza si può inserire soltanto un alarm_control_panel, ma
 * se si hanno 2 aree la pagina ne gestisce una sola. Sarebbe funzionale poter
 * mettere più pannelli, come l'inserimento di telecamere.»
 *
 * Una centrale che spezza la casa in aree — zona giorno e zona notte, casa e
 * capannone — in Home Assistant sono due entità distinte, ognuna con i suoi
 * inserimenti e il suo stato. La plancia ne leggeva una sola perché la centrale
 * viveva in una mappatura sola, che è anche quella da cui il tastierino manda
 * il comando.
 *
 * Finché ce n'è una sola qui non c'è niente: c'è la casella «Centrale allarme»
 * del guscio, quella di sempre, e sotto un tasto. Premendolo, quella che c'è
 * passa in elenco così com'è e accanto ne nasce una seconda — non si sposta
 * niente. Da lì in poi la lista è la padrona, e la casella del guscio si toglie
 * di mezzo: due porte per lo stesso dato sono il modo di avere due risposte
 * diverse.
 *
 * Quella che si comanda è sempre quella scritta nella mappatura: portare in
 * pagina un'altra area vuol dire scriverci la sua, e il tastierino, il servizio
 * che parte e la tessera della Home continuano a leggere l'unico posto che
 * hanno sempre letto. La regola sta in `core/piu-di-uno.js`.
 */
import {
  CHIAVE_CENTRALE_SCELTA,
  CHIAVE_CENTRALI,
  PRIMA_CENTRALE,
  RIF_CENTRALE,
  centraliAllarme,
  entitaDellaCentrale,
  nomeDellaCentrale,
  overridesPerCentrale,
} from "../core/alarm-panel.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  righeDelDocumento,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CENTRALI_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

const SCHEDA = "sez4";
const BLOCCO = "dm-aree-blocco";

const schedaAttiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);

function centrali() {
  return centraliAllarme(
    readJson(CHIAVE_CENTRALI, []),
    readJson("cd_entity_overrides", {}),
    clean(root.localStorage?.getItem?.(CHIAVE_CENTRALE_SCELTA)),
  );
}

/* La casella del guscio: è l'unica con questo riferimento, e si riconosce da
 * quello e non dal titolo, che cambia con la lingua. */
function casellaDelGuscio() {
  const campo = doc?.querySelector?.(`#ed-body [data-ref="${RIF_CENTRALE}"]`);
  return campo?.closest?.(".ed-slot, .dm-slot, .ed-form-row, .dm-entity-picker-row") || null;
}

function salva(lista, scelta) {
  const righe = (Array.isArray(lista) ? lista : []).map((riga) => ({
    id: clean(riga?.id),
    nome: clean(riga?.nome),
    caselle: { [RIF_CENTRALE]: clean(riga?.caselle?.[RIF_CENTRALE]) },
  }));
  writeJsonIfChanged(CHIAVE_CENTRALI, righe);
  const quale = clean(scelta) || clean(righe[0]?.id);
  const accesa = righe.find((riga) => riga.id === quale) || righe[0] || null;
  if (accesa) {
    root.localStorage?.setItem?.(CHIAVE_CENTRALE_SCELTA, accesa.id);
    const prossime = overridesPerCentrale(readJson("cd_entity_overrides", {}), accesa);
    writeJsonIfChanged("cd_entity_overrides", prossime);
    /* Il guscio tiene la sua copia in memoria, ed è quella che il proxy degli
     * stati consulta a ogni lettura. */
    try {
      root.cdApplyCanonicalOverrides?.(prossime);
    } catch (_error) {}
  }
  try {
    root.render?.();
  } catch (_error) {}
}

function rigaMarkup(voce, indice) {
  const aperto = state.aperto === indice;
  const entita = entitaDellaCentrale(voce);
  const id = `dm-area-${indice}-entity`;
  return `<article class="ed-row dm-todo-ed-row dm-area-row" data-area-index="${indice}" data-open="${aperto}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">🛡️</span>
      <span class="ed-row-main"><strong class="ed-row-new">${esc(
        nomeDellaCentrale(voce, indice, t("Area", "Area")),
      )}</strong><small class="ed-row-old mono">${
        voce?.corrente
          ? esc(t("in pagina adesso", "on the page now"))
          : esc(entita || t("nessuna entità", "no entity"))
      }</small></span>
      ${
        voce?.corrente
          ? ""
          : `<button type="button" class="ed-del" data-area-mostra aria-label="${t("Mostra in pagina", "Show on the page")}" title="${t("Mostra in pagina", "Show on the page")}">👁️</button>`
      }
      <button type="button" class="ed-del dm-todo-ed-edit" data-area-edit aria-label="${t("Modifica", "Edit")}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-area-del aria-label="${t("Elimina", "Remove")}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperto ? "" : " hidden"}>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Nome", "Name")}</span><span class="ed-form-row"><input class="ed-input" data-area-nome value="${esc(clean(voce?.nome))}" placeholder="${esc(t("Zona notte", "Night zone"))}"></span></label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${t("Centrale allarme", "Alarm panel")}</span>
        <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-area-entity value="${esc(entita)}" placeholder="alarm_control_panel.zona_notte" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-area-pick="${id}" aria-label="${t("Scegli entità", "Choose entity")}">🔍</button></span>
        <small>${esc(t("Un'entità alarm_control_panel.*: la pagina legge da lei gli inserimenti che accetta e ci manda i comandi.", "An alarm_control_panel.* entity: the page reads the arming modes it accepts from it and sends the commands to it."))}</small></label>
      <output class="dm-todo-ed-error" data-area-error></output>
      <button type="button" class="ed-save-btn" data-area-save>💾 ${esc(t("Salva area", "Save area"))}</button>
    </div>
  </article>`;
}

function corpoMarkup() {
  const lista = centrali();
  const inElenco = readJson(CHIAVE_CENTRALI, []);
  if (!Array.isArray(inElenco) || !inElenco.length) {
    return `<button type="button" class="ed-btn-add" data-area-add>＋ ${esc(
      t("Aggiungi una seconda area d'allarme", "Add a second alarm area"),
    )}</button>
    <div class="ed-intro">${esc(
      t(
        "Se la centrale spezza la casa in aree — zona giorno e zona notte, casa e capannone — aggiungi qui la seconda: quella che hai adesso passa in elenco così com'è, e in pagina compare la fila per passare dall'una all'altra, con lo stato di ognuna.",
        "If the panel splits the house into areas — day zone and night zone, house and workshop — add the second one here: the one you have now moves into the list exactly as it is, and the page grows a row to switch between them, each with its own state.",
      ),
    )}</div>`;
  }
  return `<div class="ed-sec-title">🛡️ ${esc(t("Le tue aree d'allarme", "Your alarm areas"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Ogni area è una centrale di Home Assistant, con i suoi inserimenti. Quella segnata «in pagina adesso» è quella che il quadrante e il tastierino stanno comandando: l'occhio accanto a un'altra la porta a schermo al posto suo.",
      "Every area is a Home Assistant panel of its own, with its own arming modes. The one marked “on the page now” is what the dial and the keypad are commanding: the eye beside another one brings it on screen in its place.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list dm-area-list">${lista
    .map((voce, indice) => rigaMarkup(voce, indice))
    .join("")}</div>
  <button type="button" class="ed-btn-add" data-area-add>＋ ${esc(t("Aggiungi area", "Add area"))}</button>`;
}

/* Quello che una riga dice adesso, non quello che diceva al disegno. */
function leggiRiga(riga, voce) {
  const nome = riga.querySelector("[data-area-nome]");
  const entita = riga.querySelector("[data-area-entity]");
  return {
    ...voce,
    nome: nome ? clean(nome.value) : clean(voce?.nome),
    caselle: { [RIF_CENTRALE]: entita ? clean(entita.value) : entitaDellaCentrale(voce) },
  };
}

const accesa = (lista) => clean(lista.find((riga) => riga?.corrente)?.id);

export function ensureAreeEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SCHEDA) return false;
  const casella = casellaDelGuscio();
  const inElenco = readJson(CHIAVE_CENTRALI, []);
  const pieno = Array.isArray(inElenco) && inElenco.length > 0;
  /* Con la lista, la casella del guscio si toglie di mezzo: da quel momento è
   * la stessa dell'area in pagina. */
  const accordion = casella?.closest?.("details.ed-acc") || null;
  const suo = casella?.closest?.(".ed-slot, .dm-slot") || casella;
  if (suo) suo.hidden = pieno;
  let blocco = body.querySelector(`.${BLOCCO}`);
  if (!blocco) {
    blocco = doc.createElement("div");
    blocco.className = BLOCCO;
    const dove = accordion?.querySelector?.(".ed-acc-body") || accordion || body;
    dove.append(blocco);
  }
  const firma = JSON.stringify([state.aperto, centrali()]);
  if (blocco.dataset.dmFirma === firma) return true;
  blocco.dataset.dmFirma = firma;
  blocco.innerHTML = corpoMarkup();
  return true;
}

function ridisegna() {
  const blocco = doc?.querySelector?.(`.${BLOCCO}`);
  if (blocco) delete blocco.dataset.dmFirma;
  ensureAreeEditor();
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SCHEDA || !body.contains(event.target)) return;

  if (event.target.closest("[data-area-add]")) {
    event.preventDefault();
    const lista = centrali();
    const prima = lista.length
      ? lista.map((riga) => ({ id: riga.id, nome: riga.nome, caselle: riga.caselle }))
      : [
          {
            id: PRIMA_CENTRALE,
            nome: "",
            caselle: { [RIF_CENTRALE]: clean(readJson("cd_entity_overrides", {})[RIF_CENTRALE]) },
          },
        ];
    state.aperto = prima.length;
    salva(
      [...prima, { id: `${PRIMA_CENTRALE}-${Date.now().toString(36)}`, nome: "", caselle: {} }],
      clean(root.localStorage?.getItem?.(CHIAVE_CENTRALE_SCELTA)) || prima[0].id,
    );
    ridisegna();
    return;
  }
  const pick = event.target.closest("[data-area-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.areaPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const riga = event.target.closest("[data-area-index]");
  if (!riga) return;
  const lista = centrali();
  const indice = Number(riga.dataset.areaIndex);
  if (!Number.isFinite(indice) || !lista[indice]) return;

  if (event.target.closest("[data-area-edit]")) {
    event.preventDefault();
    salva(righeDelDocumento(body, "data-area-index", lista, leggiRiga), accesa(lista));
    state.aperto = state.aperto === indice ? -1 : indice;
    ridisegna();
    return;
  }
  if (event.target.closest("[data-area-mostra]")) {
    event.preventDefault();
    salva(righeDelDocumento(body, "data-area-index", lista, leggiRiga), lista[indice].id);
    ridisegna();
    root.edToast?.(t("🛡️ Area in pagina", "🛡️ Area on the page"));
    return;
  }
  if (event.target.closest("[data-area-del]")) {
    event.preventDefault();
    const nome = nomeDellaCentrale(lista[indice], indice, t("Area", "Area"));
    if (root.confirm && !root.confirm(t(`Tolgo "${nome}"?`, `Remove "${nome}"?`))) return;
    const restano = lista.filter((_voce, posto) => posto !== indice);
    state.aperto = -1;
    /* Rimasta una sola, la lista non serve più: la sua entità è già nella
     * mappatura, ed è esattamente da dove si era partiti. */
    if (restano.length <= 1) {
      const sola = restano[0] || lista[indice === 0 ? 1 : 0];
      salva(sola ? [sola] : [], sola?.id);
      writeJsonIfChanged(CHIAVE_CENTRALI, []);
    } else {
      salva(restano, lista[indice].corrente ? restano[0].id : accesa(lista));
    }
    ridisegna();
    return;
  }
  if (event.target.closest("[data-area-save]")) {
    event.preventDefault();
    const prossime = righeDelDocumento(body, "data-area-index", lista, leggiRiga);
    prossime[indice] = leggiRiga(riga, lista[indice]);
    const errore = riga.querySelector("[data-area-error]");
    const entita = clean(prossime[indice].caselle[RIF_CENTRALE]);
    /* Un'entità che non è una centrale non ha inserimenti da dichiarare, e la
     * pagina resterebbe con un quadrante che non risponde. */
    if (entita && !/^alarm_control_panel\.[a-z0-9_]+$/i.test(entita)) {
      if (errore)
        errore.textContent = t(
          "Serve un'entità alarm_control_panel.* valida.",
          "A valid alarm_control_panel.* entity is required.",
        );
      return;
    }
    if (errore) errore.textContent = "";
    state.aperto = -1;
    salva(prossime, accesa(lista));
    ridisegna();
    root.edToast?.(t("💾 Area salvata", "💾 Area saved"));
  }
}

function installStyles() {
  installStyle("dm-centrali-editor", `#ed-body .${BLOCCO}{margin-top:10px}`);
}

/* La scheda Sicurezza non finisce di disegnarsi in un colpo solo: le righe
 * delle entità le posa chi le decora, dopo che la linguetta è cambiata. Un
 * passaggio solo arriverebbe prima di loro e troverebbe una scheda a metà —
 * è la stessa insistenza della scheda Gestione termica, e per la stessa
 * ragione. */
function ripassa() {
  root.queueMicrotask?.(() => ensureAreeEditor());
  for (const attesa of [120, 420, 900]) root.setTimeout?.(() => ensureAreeEditor(), attesa);
}

export function installCentraliAllarmeEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmCentraliEditor", ripassa);
  onEditorRedraw("__dmCentraliEditorGiro", ripassa);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, ripassa);
  ripassa();
  return true;
}
