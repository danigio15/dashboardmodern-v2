/* Dove si dichiara la raccolta differenziata (#293).
 *
 * «Sarebbe carino anche integrare un sistema per la raccolta differenziata
 * rifiuti.»
 *
 * Una riga per materiale: il bidone — plastica, carta, vetro, organico, quel
 * che il comune separa — un nome se si vuole, e il sensore o il calendario che
 * dice quando passa il ritiro. Le integrazioni della raccolta rifiuti
 * espongono di solito un sensore per materiale con la prossima data: quello.
 * Chi ha un calendario solo con un evento per ritiro lo mette nella casella
 * in fondo, e la pagina dice qual e' il prossimo evento.
 *
 * Le righe si compilano qui e si salvano con un tasto solo: aggiungere un
 * bidone non deve scrivere niente finche' non si e' finito.
 */
import {
  CHIAVE_RIFIUTI,
  GIORNI_DEL_TURNO,
  MASSIMO_RIGHE,
  MATERIALI,
  caselleDelTurno,
  leggiData,
  materialeDiSerie,
  normalizzaRifiuti,
  normalizzaTurno,
  turnoConfigurato,
} from "../core/rifiuti-model.js";
import {
  apriIlFoglioDiScelta,
  chiudiIlFoglioDiScelta,
} from "./foglio-di-scelta-section.js";
import { renderHomeWidgets } from "./home-widgets-section.js";
import { nomeDelMateriale, renderRifiuti } from "./rifiuti-section.js";
import {
  activeLocale,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";
import { disegnoDelBidone } from "../core/disegni-rifiuti.js";

const KEY = "__DASHBOARDMODERN_RIFIUTI_EDITOR__";
const state = (root[KEY] ||= { installed: false, bozza: null, contatore: 0 });

export const RIFIUTI_EDITOR_TAB = "rifiuti";

/* La chiave con cui la sezione si accende e si spegne: la stessa che legge la
 * pagina dei rifiuti. */
const CHIAVE_SEZIONE = "rifiuti";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function configurazione() {
  return normalizzaRifiuti(readJson(CHIAVE_RIFIUTI, {}));
}

function salva(config) {
  const pulita = normalizzaRifiuti(config);
  writeJsonIfChanged(CHIAVE_RIFIUTI, pulita);
  try {
    renderRifiuti();
  } catch (_error) {}
  try {
    renderHomeWidgets();
  } catch (_error) {}
  return pulita;
}

/* La bozza: le righe come stanno nella scheda, salvate o no. Si riparte
 * dalla configurazione ogni volta che la scheda si apre. */
function bozza() {
  if (!state.bozza) state.bozza = configurazione();
  return state.bozza;
}

function nuovaRiga(materiale = "plastica") {
  state.contatore += 1;
  const voce = materialeDiSerie(materiale);
  return { id: `nuova-${Date.now()}-${state.contatore}`, materiale: voce.chiave, nome: "", entity: "" };
}

/* ── il disegno ───────────────────────────────────────────────────────── */

/* La tendina dei materiali. Dentro un <option> ci sta solo testo — niente
 * disegno — quindi qui l'emoji non si sostituisce: si toglie. Il bidone
 * disegnato sta accanto, nella testa della riga, e il colore ce l'ha gia'. */
function materialiMarkup(scelto) {
  return MATERIALI.map(
    (voce) =>
      `<option value="${esc(voce.chiave)}"${voce.chiave === scelto ? " selected" : ""}>${esc(
        nomeDelMateriale(voce.chiave),
      )}</option>`,
  ).join("");
}

function rigaMarkup(riga, indice) {
  const voce = materialeDiSerie(riga.materiale);
  const id = `dm-rifiuti-entity-${indice}`;
  return `<article class="ed-row dm-todo-ed-row dm-rifiuti-ed-riga" data-open="true" data-dm-rifiuti-riga="${esc(riga.id)}" style="--dm-bidone:${esc(voce.colore)}">
    <div class="dm-rifiuti-ed-testa">
      <span class="dm-rifiuti-ed-ic" aria-hidden="true">${disegnoDelBidone(voce.chiave, voce.colore, 32)}</span>
      <select class="ed-input dm-rifiuti-ed-materiale" data-dm-rifiuti-campo="materiale" aria-label="${esc(t("Materiale", "Material"))}">${materialiMarkup(voce.chiave)}</select>
      <button type="button" class="ed-del" data-dm-rifiuti-togli="${esc(riga.id)}" title="${esc(t("Togli", "Remove"))}" aria-label="${esc(t("Togli", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body">
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Nome (facoltativo)", "Name (optional)"))}</span>
        <span class="ed-form-row"><input class="ed-input" data-dm-rifiuti-campo="nome" value="${esc(riga.nome)}" placeholder="${esc(nomeDelMateriale(voce.chiave))}"></span></label>
      <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Sensore o calendario del ritiro", "Collection sensor or calendar"))}</span>
        <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-rifiuti-campo="entity" value="${esc(riga.entity)}" placeholder="sensor.raccolta_${esc(voce.chiave)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-rifiuti-pick="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
        <small>${esc(
          t(
            "Un sensore con la prossima data (nello stato o negli attributi), o un calendar.* con un evento per ritiro.",
            "A sensor with the next date (in its state or attributes), or a calendar.* with one event per collection.",
          ),
        )}</small></label>
      ${
        clean(riga.entity)
          ? ""
          : `<small class="dm-rifiuti-ed-muta">${esc(
              t(
                "Senza entità questa riga non si vede da nessuna parte: né nella pagina Rifiuti, né nella tessera in Home. Scegline una, oppure — se il calendario non ce l'hai — scrivi il turno di casa qui sotto, che non vuole nessuna entità.",
                "Without an entity this row is nowhere to be seen: not on the Waste page, not on the Home tile. Pick one, or — if you have no calendar — write the two-week rota below, which needs no entity at all.",
              ),
            )}</small>`
      }
    </div>
  </article>`;
}

/* ── il calendario di casa: due settimane scritte a mano (#366) ────────── */

/* «Vorrei che ci fosse la possibilita' di un menu a tendina per le 2 settimane
 * cosi uno sceglie il rifiuto, senza dover creare o modificare il calendario
 * di home assistant.»
 *
 * Quattordici caselle, due file da sette come un calendario da parete: e' il
 * modo in cui uno guarda il foglietto sul frigo. La tendina di ogni giorno e'
 * il foglio di scelta che la plancia usa gia' altrove, coi materiali da
 * accendere: un giorno puo' averne piu' d'uno, e capita.
 */

/** Il lunedi' di questa settimana, che e' l'inizio giusto per quasi tutti. */
function lunediDiOggi() {
  const oggi = new Date();
  const indietro = (oggi.getDay() + 6) % 7;
  const lunedi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - indietro);
  const due = (numero) => String(numero).padStart(2, "0");
  return `${lunedi.getFullYear()}-${due(lunedi.getMonth() + 1)}-${due(lunedi.getDate())}`;
}

/* Il nome del giorno della casella, che dipende da quando comincia il turno:
 * chi parte di mercoledi' deve leggere «mer» nella prima casella, non «lun». */
function nomeDelGiorno(inizio, indice) {
  const partenza = leggiData(inizio);
  if (!partenza) return "";
  const quando = new Date(partenza.getTime() + indice * 86400000 + 12 * 3600000);
  try {
    return quando.toLocaleDateString(activeLocale() || "it", { weekday: "short" });
  } catch (_error) {
    return "";
  }
}

function bidoniDellaCasella(giorno) {
  if (!giorno.length) return `<span class="dm-turno-vuoto">—</span>`;
  return giorno
    .map((materiale) => {
      const voce = materialeDiSerie(materiale);
      return `<span>${disegnoDelBidone(voce.chiave, voce.colore, 22)}</span>`;
    })
    .join("");
}

function turnoMarkup(dato) {
  const turno = normalizzaTurno(dato.turno);
  const inizio = turno.inizio || lunediDiOggi();
  const oggi = turnoConfigurato(turno) ? caselleDelTurno(turno, Date.now()) : -1;
  const caselle = turno.giorni
    .map((giorno, indice) => {
      const titolo = giorno.length
        ? giorno.map((materiale) => nomeDelMateriale(materiale)).join(" · ")
        : t("Nessun ritiro", "No collection");
      return `${indice === 0 || indice === 7 ? `<div class="dm-turno-sett">${esc(indice === 0 ? t("Settimana 1", "Week 1") : t("Settimana 2", "Week 2"))}</div>` : ""}
      <button type="button" class="dm-turno-giorno" data-dm-turno-giorno="${indice}"
        ${indice === oggi ? 'data-oggi="true"' : ""} title="${esc(titolo)}" aria-label="${esc(titolo)}">
        <span class="dm-turno-gg">${esc(nomeDelGiorno(inizio, indice))}</span>
        <span class="dm-turno-bidoni">${bidoniDellaCasella(giorno)}</span>
      </button>`;
    })
    .join("");
  return `<div class="dm-turno">
    <div class="ed-sec-title">🗓️ ${esc(t("Il calendario di casa", "Your own rota"))}</div>
    <div class="ed-intro">${esc(
      t(
        "Due settimane che si ripetono, scritte a mano: tocca un giorno e scegli cosa esce. Non serve nessun sensore e nessun calendario di Home Assistant — la pagina e la tessera in Home leggono questo esattamente come leggerebbero un'integrazione. Un materiale che ha già il suo sensore qui sopra non si ripete: comanda il sensore.",
        "Two weeks that repeat, written by hand: tap a day and pick what goes out. No sensor and no Home Assistant calendar needed — the page and the Home tile read this exactly as they would read an integration. A material that already has its own sensor above is not repeated: the sensor wins.",
      ),
    )}</div>
    <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("La prima settimana comincia il", "The first week starts on"))}</span>
      <input class="ed-input" type="date" data-dm-turno-inizio value="${esc(inizio)}"></label>
    <div class="dm-turno-griglia">${caselle}</div>
  </div>`;
}

/* La tendina di un giorno: i materiali da accendere, uno o piu'. */
function apriLaTendinaDelGiorno(indice) {
  const dato = bozza();
  const turno = normalizzaTurno(dato.turno);
  const scelti = new Set(turno.giorni[indice] || []);
  const corpo = apriIlFoglioDiScelta({
    titolo: t("Cosa esce questo giorno", "What goes out this day"),
    id: "dm-rifiuti-turno",
  });
  if (!corpo) return;
  corpo.className = "dm-foglio-scelta-corpo dm-turno-menu";
  for (const materiale of MATERIALI) {
    const riga = doc.createElement("button");
    riga.type = "button";
    riga.className = "dm-turno-voce";
    riga.dataset.dmTurnoVoce = materiale.chiave;
    riga.setAttribute("aria-pressed", scelti.has(materiale.chiave) ? "true" : "false");
    riga.innerHTML = `<span aria-hidden="true">${disegnoDelBidone(materiale.chiave, materiale.colore, 26)}</span><span>${esc(nomeDelMateriale(materiale.chiave))}</span>`;
    riga.addEventListener("click", () => {
      const acceso = riga.getAttribute("aria-pressed") === "true";
      riga.setAttribute("aria-pressed", acceso ? "false" : "true");
      if (acceso) scelti.delete(materiale.chiave);
      else scelti.add(materiale.chiave);
    });
    corpo.append(riga);
  }
  const fatto = doc.createElement("button");
  fatto.type = "button";
  fatto.className = "dm-turno-fatto";
  fatto.textContent = t("Fatto", "Done");
  fatto.addEventListener("click", () => {
    const giorni = turno.giorni.map((giorno, dove) =>
      dove === indice ? [...scelti] : giorno.slice(),
    );
    state.bozza = { ...bozza(), turno: { inizio: inizioScritto() || turno.inizio, giorni } };
    chiudiIlFoglioDiScelta();
    ridisegna();
  });
  corpo.append(fatto);
}

/** La data d'inizio come sta nel campo adesso. */
function inizioScritto() {
  return clean(doc?.querySelector?.("[data-dm-turno-inizio]")?.value);
}

function fasciaMarkup() {
  try {
    /* La chiave scritta per esteso: e' quella che la prova della barra legge
     * per sapere che questa voce ha il suo interruttore. */
    return root.cdSecToggleHtml?.("rifiuti") || "";
  } catch (_error) {
    return "";
  }
}

function sezioneNascosta() {
  try {
    return root.cdCfg?.("cd_sections")?.[CHIAVE_SEZIONE] === false;
  } catch (_error) {
    return false;
  }
}

function corpoMarkup() {
  const dato = bozza();
  const piene = dato.righe.length >= MASSIMO_RIGHE;
  return `${fasciaMarkup()}<div class="dm-rifiuti-ed">
  <div class="ed-sec-title">♻️ ${esc(t("Raccolta differenziata", "Recycling collection"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Un bidone per materiale, e per ognuno il sensore che dice quando passa il ritiro: la pagina risponde alla domanda della sera — cosa metto fuori stasera — e la tessera in Home si accende il giorno prima. Chi ha un calendario solo, con un evento per ritiro, lo mette nella casella in fondo.",
      "One bin per material, and for each the sensor that says when the collection comes: the page answers the evening question — what do I put out tonight — and the Home tile lights up the day before. Whoever has a single calendar, with one event per collection, puts it in the box at the bottom.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">
    ${dato.righe.map(rigaMarkup).join("")}
    <button type="button" class="ed-btn-add dm-rifiuti-ed-aggiungi" data-dm-rifiuti-aggiungi${piene ? " disabled" : ""}>＋ ${esc(
      t("Aggiungi materiale", "Add material"),
    )}</button>
    <label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(t("Calendario o sensore unico (facoltativo)", "Single calendar or sensor (optional)"))}</span>
      <span class="ed-form-row"><input id="dm-rifiuti-calendario" class="ed-input mono" data-dm-rifiuti-calendario value="${esc(dato.calendario)}" placeholder="calendar.raccolta_rifiuti o sensor.prossimi_ritiri" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-rifiuti-pick="dm-rifiuti-calendario" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
      <small>${esc(
        t(
          "Se i ritiri stanno in un posto solo, mettilo qui: un calendar.* con un evento per ritiro, oppure un sensor.* che porta l'elenco dei prossimi ritiri negli attributi. Ogni voce diventa una riga, col materiale indovinato dal nome.",
          "If the collections live in one place, put it here: a calendar.* with one event per collection, or a sensor.* carrying the list of upcoming collections in its attributes. Each entry becomes a row, with the material guessed from its name.",
        ),
      )}</small></label>
    ${turnoMarkup(dato)}
    <button type="button" class="ed-save-btn" data-dm-rifiuti-save>💾 ${esc(t("Salva rifiuti", "Save waste"))}</button>
  </div></div>`;
}

export function ensureRifiutiEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== RIFIUTI_EDITOR_TAB) {
    /* Fuori dalla scheda la bozza si butta: alla prossima apertura si riparte
     * da quello che e' salvato, non da meta' modifica di un'altra volta. */
    if (schedaAttiva() !== RIFIUTI_EDITOR_TAB) state.bozza = null;
    return false;
  }
  const firma = `${JSON.stringify(bozza())}|${sezioneNascosta()}`;
  if (body.dataset.dmRifiutiEditor === firma && body.querySelector(".dm-rifiuti-ed")) return true;
  body.dataset.dmRifiutiEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "rifiuti";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmRifiutiEditor;
  ensureRifiutiEditor();
}

/* Le righe come stanno nella scheda adesso, lette dai campi. */
function raccogli(body) {
  const dato = bozza();
  const righe = [...body.querySelectorAll("[data-dm-rifiuti-riga]")].map((nodo, indice) => {
    const id = clean(nodo.dataset.dmRifiutiRiga);
    const prima = dato.righe.find((riga) => riga.id === id) || { id: id || `riga-${indice + 1}` };
    const leggi = (campo) => clean(nodo.querySelector(`[data-dm-rifiuti-campo="${campo}"]`)?.value);
    const materiale = leggi("materiale") || prima.materiale;
    /* Cambiato il materiale, via l'icona e il colore ricavati da quello di
     * prima: la normalizzazione li prenderebbe per scelte fatte apposta, e una
     * riga passata dalla plastica alla carta restava gialla col suo sacchetto.
     * Questa scheda non fa scegliere icona e colore: si ricalcolano. */
    const base =
      materiale === prima.materiale
        ? prima
        : Object.fromEntries(
            Object.entries(prima).filter(([campo]) => campo !== "icona" && campo !== "colore"),
          );
    return { ...base, materiale, nome: leggi("nome"), entity: leggi("entity") };
  });
  /* Il turno vive nella bozza — le caselle si toccano, non si scrivono — e da
   * qui si prende solo la data d'inizio, che invece e' un campo. */
  const turno = normalizzaTurno(dato.turno);
  return {
    calendario: clean(body.querySelector("[data-dm-rifiuti-calendario]")?.value),
    righe,
    turno: { ...turno, inizio: inizioScritto() || turno.inizio },
  };
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== RIFIUTI_EDITOR_TAB || !body.contains(event.target)) return;
  const giorno = event.target.closest("[data-dm-turno-giorno]");
  if (giorno) {
    event.preventDefault();
    /* Prima di aprire si tiene quello che c'e' scritto nei campi: la tendina
     * ridisegna la scheda, e senza questo un nome appena battuto in una riga
     * qui sopra se ne andava. */
    state.bozza = raccogli(body);
    apriLaTendinaDelGiorno(Number(giorno.dataset.dmTurnoGiorno) || 0);
    return;
  }
  const pick = event.target.closest("[data-dm-rifiuti-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.dmRifiutiPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  if (event.target.closest("[data-dm-rifiuti-aggiungi]")) {
    event.preventDefault();
    const adesso = raccogli(body);
    if (adesso.righe.length >= MASSIMO_RIGHE) return;
    /* Il materiale di serie e' il primo che manca: chi ha gia' la plastica
     * vuole probabilmente la carta, non una seconda plastica. */
    const presi = new Set(adesso.righe.map((riga) => riga.materiale));
    const libero = MATERIALI.find((voce) => !presi.has(voce.chiave)) || MATERIALI[0];
    state.bozza = { ...adesso, righe: [...adesso.righe, nuovaRiga(libero.chiave)] };
    ridisegna();
    return;
  }
  const togli = event.target.closest("[data-dm-rifiuti-togli]");
  if (togli) {
    event.preventDefault();
    const adesso = raccogli(body);
    const id = clean(togli.dataset.dmRifiutiTogli);
    state.bozza = { ...adesso, righe: adesso.righe.filter((riga) => riga.id !== id) };
    ridisegna();
    return;
  }
  if (event.target.closest("[data-dm-rifiuti-save]")) {
    event.preventDefault();
    state.bozza = salva(raccogli(body));
    ridisegna();
    root.edToast?.(t("💾 Rifiuti salvati", "💾 Waste saved"));
  }
}

/* Cambiare materiale cambia subito colore e simbolo della riga: e' il modo di
 * vedere cosa si e' scelto senza salvare. */
function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== RIFIUTI_EDITOR_TAB || !body.contains(event.target)) return;
  /* Cambiata la data d'inizio cambiano i nomi dei giorni: chi parte di
   * mercoledi' deve leggere «mer» nella prima casella, non «lun». Si ridisegna
   * tenendo quello che c'e' scritto nelle righe qui sopra. */
  if (event.target.closest("[data-dm-turno-inizio]")) {
    state.bozza = raccogli(body);
    ridisegna();
    return;
  }
  const select = event.target.closest('[data-dm-rifiuti-campo="materiale"]');
  if (!select) return;
  const riga = select.closest("[data-dm-rifiuti-riga]");
  const voce = materialeDiSerie(select.value);
  if (!riga) return;
  riga.style.setProperty("--dm-bidone", voce.colore);
  const icona = riga.querySelector(".dm-rifiuti-ed-ic");
  if (icona) icona.innerHTML = disegnoDelBidone(voce.chiave, voce.colore, 32);
  const nome = riga.querySelector('[data-dm-rifiuti-campo="nome"]');
  if (nome) nome.placeholder = nomeDelMateriale(voce.chiave);
}

export function ensureRifiutiEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${RIFIUTI_EDITOR_TAB}"]`))
    return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = RIFIUTI_EDITOR_TAB;
  linguetta.textContent = `♻️ ${t("Rifiuti", "Waste")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(RIFIUTI_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-rifiuti-editor-style",
    `
      #ed-body .dm-rifiuti-ed-riga{display:block;border-left:5px solid var(--dm-bidone,#0ea5e9)}
      #ed-body .dm-rifiuti-ed-muta{display:block;margin-top:8px;padding:8px 10px;border-radius:10px;
        font-size:11.5px;line-height:1.45;font-weight:700;color:#92400e;
        background:color-mix(in srgb,#f59e0b 14%,transparent)}
      #ed-body .dm-rifiuti-ed-testa{display:flex;align-items:center;gap:8px;margin:0 0 6px}
      /* Il disegno del bidone ha gia' il suo pannello: dietro non ci va altro. */
      #ed-body .dm-rifiuti-ed-ic{display:grid;place-items:center;width:32px;height:32px;flex:0 0 auto}
      #ed-body .dm-rifiuti-ed-ic .dm-appliance-art{display:block;line-height:0}
      .dm-turno-voce .dm-appliance-art,#ed-body .dm-turno-casella .dm-appliance-art{display:block;line-height:0}
      #ed-body .dm-rifiuti-ed-materiale{flex:1 1 auto;min-width:0;margin:0}
      #ed-body .dm-rifiuti-ed-aggiungi{width:100%;margin:6px 0 12px}
      /* Il calendario di casa (#366): due file da sette, come un calendario da
       * parete — e' il modo in cui uno guarda il foglietto sul frigo. */
      #ed-body .dm-turno{margin:14px 0 4px}
      #ed-body .dm-turno-griglia{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:10px}
      #ed-body .dm-turno-sett{grid-column:1/-1;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--secondary-text-color,#64748b);margin:4px 0 0}
      #ed-body .dm-turno-giorno{display:grid;gap:3px;justify-items:center;padding:9px 2px;border:1px solid var(--divider-color,#dbe4ee);border-radius:12px;background:var(--card-background-color,#fff);cursor:pointer;min-height:56px}
      #ed-body .dm-turno-giorno[data-oggi="true"]{border-color:var(--primary-color,#0ea5e9);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary-color,#0ea5e9) 22%,transparent)}
      #ed-body .dm-turno-gg{font-size:10.5px;font-weight:800;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      #ed-body .dm-turno-bidoni{display:flex;flex-wrap:wrap;justify-content:center;gap:1px;font-size:15px;line-height:1.1}
      #ed-body .dm-turno-vuoto{color:var(--secondary-text-color,#94a3b8);font-size:13px}
      .dm-turno-menu{display:grid;gap:7px}
      .dm-turno-voce{display:flex;align-items:center;gap:10px;padding:11px 13px;border:1px solid var(--divider-color,#dbe4ee);border-radius:13px;background:var(--card-background-color,#fff);color:var(--text,#0f172a);font-size:14px;font-weight:750;text-align:left;cursor:pointer}
      .dm-turno-voce[aria-pressed="true"]{border-color:transparent;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff}
      .dm-turno-fatto{margin-top:4px;padding:13px;border:none;border-radius:14px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-size:14px;font-weight:850;cursor:pointer}
    `,
  );
}

export function installRifiutiEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  wrapFunction("apriConfigEntita", "__dmRifiutiEditor", () => {
    ensureRifiutiEditorTab();
    ensureRifiutiEditor();
  });
  ensureRifiutiEditorTab();
  onEditorRedraw("__dmRifiutiEditor", () => {
    root.queueMicrotask?.(() => {
      ensureRifiutiEditorTab();
      ensureRifiutiEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureRifiutiEditorTab();
        ensureRifiutiEditor();
      });
    });
  ensureRifiutiEditor();
  return true;
}

installRifiutiEditor();
