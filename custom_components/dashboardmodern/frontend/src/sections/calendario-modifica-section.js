/* Il calendario si tocca, non si guarda soltanto (#259).
 *
 * «Il popup del widget deve dare la possibilita' di modificare e di interagire
 * con il calendario.»
 *
 * Un'agenda che si legge e basta e' mezza agenda: quello che si vuole fare
 * guardandola e' segnare la cena di sabato, spostare il dentista, cancellare
 * la riunione saltata. Qui c'e' quel pezzo — il modulo, i tasti, e i tre
 * comandi che scrivono in Home Assistant.
 *
 * Sta in un modulo suo e non dentro la finestra della Home perche' i posti da
 * cui si scrive sono due — la finestra della tessera e la pagina — e sono
 * esattamente gli stessi gesti. Due copie sarebbero due modi di segnare un
 * impegno, e uno dei due prima o poi si dimenticherebbe di un fuso.
 *
 * Cosa NON si fa: non si offre un tasto che poi risponde «non supportato».
 * Home Assistant dichiara nei bit di `supported_features` se un calendario
 * accetta eventi nuovi, modifiche e cancellazioni — quello delle festivita'
 * non accetta niente, Google accetta ma non tutto — e i tasti seguono quello.
 * Nemmeno si tocca un evento senza `uid`: senza quello non c'e' modo di dire
 * a Home Assistant QUALE evento si intende.
 */
import {
  bozzaDaEvento,
  bozzaNuova,
  capacitaDelCalendario,
  eventoCancellabile,
  eventoModificabile,
  messaggioDellEvento,
} from "../core/calendario-model.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CALENDARIO_MODIFICA__";
const state = (root[KEY] ||= {
  installed: false,
  /* La bozza aperta, se ce n'e' una. Sta qui e non nel documento perche' il
   * corpo della finestra si riscrive a ogni giro di stati: una parola scritta
   * a meta' che vivesse solo nel documento sparirebbe sotto le dita. */
  bozza: null,
  errore: "",
  inCorso: false,
  /* Chi ridisegna quando qualcosa cambia. Ci si iscrivono la finestra della
   * tessera e la pagina: questo modulo non sa dove sta il suo modulo, e non
   * deve saperlo. */
  ospiti: new Set(),
});

/** Un ospite dice come si ridisegna, e questo modulo lo richiama quando serve. */
export function registraOspiteCalendario(ridisegna) {
  if (typeof ridisegna === "function") state.ospiti.add(ridisegna);
}

function ridisegnaOspiti() {
  for (const ospite of state.ospiti) {
    try {
      ospite();
    } catch (_error) {}
  }
}

/* ── cosa questo calendario si lascia fare ────────────────────────────── */

export function capacitaDi(entity) {
  return capacitaDelCalendario(allStates()?.[clean(entity)]);
}

/** Se almeno uno dei calendari scelti accetta impegni nuovi. */
export function qualcunoAccettaEventi(calendari) {
  return (Array.isArray(calendari) ? calendari : []).some((voce) => capacitaDi(voce.entity).crea);
}

/* ── i tasti su una riga ──────────────────────────────────────────────── */

/**
 * La matita e il cestino, ma solo dove hanno un senso.
 *
 * Su un calendario di sola lettura non compaiono; su un evento senza `uid` —
 * quelli letti dal servizio invece che dalla porta HTTP — nemmeno, perche'
 * non ci sarebbe modo di dire a Home Assistant quale evento si sta toccando.
 */
export function azioniDellEventoMarkup(evento, chiave) {
  const capacita = capacitaDi(evento?.entity);
  const puoiModificare = eventoModificabile(evento, capacita);
  const puoiCancellare = eventoCancellabile(evento, capacita);
  if (!puoiModificare && !puoiCancellare) return "";
  const riferimento = esc(clean(chiave));
  return `<span class="dm-calm-azioni">${
    puoiModificare
      ? `<button type="button" class="dm-calm-tasto" data-dm-calm-modifica="${riferimento}"
          title="${esc(t("Modifica", "Edit"))}" aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>`
      : ""
  }${
    puoiCancellare
      ? `<button type="button" class="dm-calm-tasto" data-dm-calm-elimina="${riferimento}"
          title="${esc(t("Elimina", "Delete"))}" aria-label="${esc(t("Elimina", "Delete"))}">🗑️</button>`
      : ""
  }</span>`;
}

/** Il tasto per segnare un impegno nuovo, dove qualcuno lo accetta. */
export function tastoNuovoMarkup(calendari, giorno = "") {
  if (!qualcunoAccettaEventi(calendari)) return "";
  return `<button type="button" class="dm-calm-nuovo" data-dm-calm-nuovo="${esc(clean(giorno))}">＋ ${esc(
    t("Nuovo impegno", "New event"),
  )}</button>`;
}

/* ── il modulo ────────────────────────────────────────────────────────── */

/** La bozza aperta adesso, o niente. La leggono gli ospiti per disegnarla. */
export function bozzaAperta() {
  return state.bozza;
}

const campo = (nome, etichetta, dentro, aiuto = "") =>
  `<label class="dm-calm-campo" data-dm-calm-campo="${esc(nome)}">
    <span class="dm-calm-lbl">${esc(etichetta)}</span>
    ${dentro}
    ${aiuto ? `<small>${esc(aiuto)}</small>` : ""}
  </label>`;

/**
 * Il modulo con cui si segna o si corregge un impegno.
 *
 * L'ordine e' quello in cui si pensa un appuntamento: cosa, quando, dove. Il
 * calendario si sceglie solo quando ce n'e' piu' d'uno E si sta segnando
 * qualcosa di nuovo: spostare un evento da un calendario all'altro non e' una
 * modifica, e' una cancellazione piu' una creazione, e fingere il contrario
 * perderebbe l'originale.
 */
export function moduloMarkup(calendari) {
  const bozza = state.bozza;
  if (!bozza) return "";
  const nuovo = !clean(bozza.uid);
  const scelta = (Array.isArray(calendari) ? calendari : []).filter(
    (voce) => capacitaDi(voce.entity).crea,
  );
  return `<form class="dm-calm-modulo" data-dm-calm-modulo data-nuovo="${nuovo}">
    <div class="dm-calm-testa">
      <strong>${esc(nuovo ? t("Nuovo impegno", "New event") : t("Modifica impegno", "Edit event"))}</strong>
      <button type="button" class="dm-calm-chiudi" data-dm-calm-annulla
        aria-label="${esc(t("Annulla", "Cancel"))}">✕</button>
    </div>
    ${
      nuovo && scelta.length > 1
        ? campo(
            "entity",
            t("Calendario", "Calendar"),
            `<select class="dm-calm-input" data-dm-calm-campo-valore="entity">${scelta
              .map(
                (voce) =>
                  `<option value="${esc(voce.entity)}"${
                    voce.entity === bozza.entity ? " selected" : ""
                  }>${esc(clean(voce.name) || voce.entity)}</option>`,
              )
              .join("")}</select>`,
          )
        : ""
    }
    ${campo(
      "summary",
      t("Titolo", "Title"),
      `<input type="text" class="dm-calm-input" data-dm-calm-campo-valore="summary"
        value="${esc(bozza.summary)}" maxlength="200" autocomplete="off"
        placeholder="${esc(t("Cena dai nonni", "Dinner at the grandparents"))}">`,
    )}
    <label class="dm-calm-tutto">
      <input type="checkbox" data-dm-calm-campo-valore="tuttoIlGiorno"${
        bozza.tuttoIlGiorno ? " checked" : ""
      }>
      <span>${esc(t("Tutto il giorno", "All day"))}</span>
    </label>
    <div class="dm-calm-quando">
      ${campo(
        "giornoInizio",
        t("Inizio", "Starts"),
        `<span class="dm-calm-coppia"><input type="date" class="dm-calm-input" data-dm-calm-campo-valore="giornoInizio" value="${esc(bozza.giornoInizio)}">${
          bozza.tuttoIlGiorno
            ? ""
            : `<input type="time" class="dm-calm-input dm-calm-ora" data-dm-calm-campo-valore="oraInizio" value="${esc(bozza.oraInizio)}">`
        }</span>`,
      )}
      ${campo(
        "giornoFine",
        t("Fine", "Ends"),
        `<span class="dm-calm-coppia"><input type="date" class="dm-calm-input" data-dm-calm-campo-valore="giornoFine" value="${esc(bozza.giornoFine)}">${
          bozza.tuttoIlGiorno
            ? ""
            : `<input type="time" class="dm-calm-input dm-calm-ora" data-dm-calm-campo-valore="oraFine" value="${esc(bozza.oraFine)}">`
        }</span>`,
      )}
    </div>
    ${campo(
      "location",
      t("Luogo", "Location"),
      `<input type="text" class="dm-calm-input" data-dm-calm-campo-valore="location"
        value="${esc(bozza.location)}" maxlength="200" autocomplete="off"
        placeholder="${esc(t("Via Roma 12", "12 Main Street"))}">`,
    )}
    ${campo(
      "description",
      t("Note", "Notes"),
      `<textarea class="dm-calm-input dm-calm-note" rows="2" maxlength="500"
        data-dm-calm-campo-valore="description">${esc(bozza.description)}</textarea>`,
    )}
    <output class="dm-calm-errore">${esc(state.errore)}</output>
    <div class="dm-calm-fondo">
      <button type="button" class="dm-calm-annulla" data-dm-calm-annulla>${esc(t("Annulla", "Cancel"))}</button>
      <button type="button" class="dm-calm-salva" data-dm-calm-salva${state.inCorso ? " disabled" : ""}>${esc(
        state.inCorso ? t("Salvo…", "Saving…") : t("Salva", "Save"),
      )}</button>
    </div>
  </form>`;
}

/* ── aprire e chiudere ────────────────────────────────────────────────── */

export function apriNuovoEvento(calendari, giorno = "") {
  const scelta = (Array.isArray(calendari) ? calendari : []).filter(
    (voce) => capacitaDi(voce.entity).crea,
  );
  if (!scelta.length) return false;
  const bozza = bozzaNuova(scelta[0].entity);
  /* Aprendolo da un giorno della fascia, l'impegno nasce in quel giorno: chi
   * ha appena toccato sabato non vuole scriverne uno per oggi. */
  if (clean(giorno)) {
    bozza.giornoInizio = clean(giorno);
    bozza.giornoFine = clean(giorno);
  }
  state.bozza = bozza;
  state.errore = "";
  ridisegnaOspiti();
  return true;
}

export function apriModificaEvento(evento) {
  if (!eventoModificabile(evento, capacitaDi(evento?.entity))) return false;
  state.bozza = bozzaDaEvento(evento);
  state.errore = "";
  ridisegnaOspiti();
  return true;
}

export function chiudiModulo() {
  if (!state.bozza) return false;
  state.bozza = null;
  state.errore = "";
  ridisegnaOspiti();
  return true;
}

/* Le caselle si rileggono dal documento prima di ogni giro: il modulo si
 * ridisegna quando cambia lo stato, e quello che si sta scrivendo deve
 * sopravvivere al ridisegno. */
function leggiCaselle(dentro) {
  const modulo = dentro?.closest?.("[data-dm-calm-modulo]") || doc?.querySelector?.("[data-dm-calm-modulo]");
  if (!modulo || !state.bozza) return;
  for (const casella of modulo.querySelectorAll("[data-dm-calm-campo-valore]")) {
    const nome = clean(casella.dataset.dmCalmCampoValore);
    if (!nome) continue;
    state.bozza[nome] = casella.type === "checkbox" ? casella.checked === true : clean(casella.value);
  }
}

/* ── i tre comandi che scrivono ───────────────────────────────────────── */

function lamenti() {
  return {
    titolo: t("Serve un titolo.", "A title is required."),
    quando: t("La data non è valida.", "That date is not valid."),
    ordine: t("L'impegno finisce prima di cominciare.", "The event ends before it starts."),
    calendario: t("Scegli un calendario.", "Pick a calendar."),
  };
}

async function salva() {
  if (state.inCorso || !state.bozza) return;
  const { evento, errore } = messaggioDellEvento(state.bozza, lamenti());
  if (errore) {
    state.errore = errore;
    ridisegnaOspiti();
    return;
  }
  const bozza = state.bozza;
  const nuovo = !clean(bozza.uid);
  state.inCorso = true;
  state.errore = "";
  ridisegnaOspiti();
  try {
    /* I due tipi si scrivono per intero e non con una scelta a mezz'aria: la
     * guardia del ponte cerca le stringhe nel codice, e un `tipo ? a : b` le
     * nasconderebbe a lei — cioe' passerebbe la prova e poi, dentro Home
     * Assistant, il messaggio verrebbe respinto. */
    await chiediAHomeAssistant(
      nuovo
        ? { type: "calendar/event/create", entity_id: bozza.entity, event: evento }
        : {
            type: "calendar/event/update",
            entity_id: bozza.entity,
            uid: bozza.uid,
            /* La ripetizione si tocca una volta sola: senza `recurrence_id` si
             * modificherebbero tutti i martedi' invece di questo. */
            ...(clean(bozza.recurrenceId)
              ? { recurrence_id: bozza.recurrenceId, recurrence_range: "" }
              : {}),
            event: evento,
          },
    );
    state.inCorso = false;
    state.bozza = null;
    root.edToast?.(nuovo ? t("📅 Impegno segnato", "📅 Event added") : t("📅 Impegno aggiornato", "📅 Event updated"));
    rileggi();
  } catch (guaio) {
    state.inCorso = false;
    /* Il messaggio di Home Assistant e' la sola spiegazione che chi guarda
     * puo' capire: «il calendario e' di sola lettura» dice cosa fare, «errore»
     * no. */
    state.errore = clean(guaio?.message) || t("Non è riuscito.", "It did not work.");
  }
  ridisegnaOspiti();
}

async function elimina(evento) {
  if (!eventoCancellabile(evento, capacitaDi(evento?.entity))) return;
  const nome = clean(evento.summary) || t("questo impegno", "this event");
  const domanda = t(`Elimino "${nome}"?`, `Delete "${nome}"?`);
  if (root.confirm && !root.confirm(domanda)) return;
  try {
    await chiediAHomeAssistant({
      type: "calendar/event/delete",
      entity_id: evento.entity,
      uid: evento.uid,
      ...(clean(evento.recurrenceId)
        ? { recurrence_id: evento.recurrenceId, recurrence_range: "" }
        : {}),
    });
    root.edToast?.(t("🗑️ Impegno eliminato", "🗑️ Event deleted"));
    rileggi();
  } catch (guaio) {
    root.edToast?.(clean(guaio?.message) || t("Non è riuscito.", "It did not work."));
  }
  ridisegnaOspiti();
}

/* Dopo aver scritto si rilegge, e non si finge.
 *
 * Segnare l'evento a mano nell'elenco darebbe una riga che sembra vera e non
 * lo e' ancora: se Home Assistant la rifiuta di la', qui resterebbe. Il
 * calendario locale risponde in un lampo, e il giro di lettura e' quello di
 * sempre — chi lo possiede e' il filo della Home. */
const RILETTURE = new Set();

export function registraRilettura(rileggi) {
  if (typeof rileggi === "function") RILETTURE.add(rileggi);
}

function rileggi() {
  for (const giro of RILETTURE) {
    try {
      giro({ force: true });
    } catch (_error) {}
  }
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

/* Gli eventi che i due ospiti disegnano, per chiave: la riga porta solo un
 * riferimento, e l'oggetto vero si ritrova qui. Passarlo nel documento
 * vorrebbe dire un JSON dentro un attributo, che si rompe al primo apostrofo
 * in un titolo. */
const VISTI = new Map();

/** Un ospite registra l'evento che sta disegnando e riceve la sua chiave. */
export function chiaveDellEvento(evento) {
  const chiave = `${clean(evento?.entity)}|${clean(evento?.uid)}|${evento?.inizio}`;
  VISTI.set(chiave, evento);
  return chiave;
}

function onClick(event) {
  const bersaglio = event.target;
  if (!bersaglio?.closest) return;

  const nuovo = bersaglio.closest("[data-dm-calm-nuovo]");
  if (nuovo) {
    event.preventDefault();
    event.stopPropagation();
    apriNuovoEvento(calendariDelMomento(), clean(nuovo.dataset.dmCalmNuovo));
    return;
  }
  const modifica = bersaglio.closest("[data-dm-calm-modifica]");
  if (modifica) {
    event.preventDefault();
    event.stopPropagation();
    apriModificaEvento(VISTI.get(clean(modifica.dataset.dmCalmModifica)));
    return;
  }
  const cancella = bersaglio.closest("[data-dm-calm-elimina]");
  if (cancella) {
    event.preventDefault();
    event.stopPropagation();
    elimina(VISTI.get(clean(cancella.dataset.dmCalmElimina)));
    return;
  }
  if (bersaglio.closest("[data-dm-calm-annulla]")) {
    event.preventDefault();
    event.stopPropagation();
    chiudiModulo();
    return;
  }
  if (bersaglio.closest("[data-dm-calm-salva]")) {
    event.preventDefault();
    event.stopPropagation();
    leggiCaselle(bersaglio);
    salva();
    return;
  }
  /* Un tocco dentro il modulo non deve arrivare a chi sta sotto: nella
   * finestra della tessera il velo si chiude al primo clic fuori dalle righe,
   * e scrivere un titolo lo chiuderebbe a meta' parola. */
  if (bersaglio.closest("[data-dm-calm-modulo]")) event.stopPropagation();
}

/* La spunta «tutto il giorno» cambia la forma del modulo — le ore spariscono —
 * e va riletta subito, non al salvataggio. */
function onChange(event) {
  const casella = event.target?.closest?.("[data-dm-calm-campo-valore]");
  if (!casella || !state.bozza) return;
  leggiCaselle(casella);
  if (clean(casella.dataset.dmCalmCampoValore) === "tuttoIlGiorno") ridisegnaOspiti();
}

/* Chi sono i calendari, adesso.
 *
 * Il tasto «nuovo impegno» sta in due posti e in tutti e due l'elenco e' lo
 * stesso: lo chiede l'ospite che l'ha disegnato per ultimo, e chi disegna lo
 * dichiara qui invece di farselo passare in un attributo. */
let CALENDARI = [];

export function dichiaraCalendari(elenco) {
  CALENDARI = Array.isArray(elenco) ? elenco : [];
}

function calendariDelMomento() {
  return CALENDARI;
}

function installStyles() {
  installStyle(
    "dm-calendario-modifica-style",
    `
    .dm-calm-azioni{display:inline-flex;gap:2px;align-self:center;flex:0 0 auto}
    .dm-calm-tasto{
      display:grid;place-items:center;width:30px;height:30px;padding:0;border:0;cursor:pointer;
      border-radius:9px;background:transparent;font-size:14px;line-height:1;opacity:.55;
      transition:opacity .18s ease,background .18s ease}
    .dm-calm-tasto:hover{opacity:1;background:color-mix(in srgb,currentColor 10%,transparent)}
    .dm-calm-nuovo{
      display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border:0;cursor:pointer;
      border-radius:999px;font-size:12.5px;font-weight:800;color:#fff;
      background:linear-gradient(135deg,#818cf8,#4f46e5);
      box-shadow:0 8px 20px -8px rgba(79,70,229,.8)}
    .dm-calm-nuovo:hover{filter:brightness(1.06)}

    /* Il modulo: una scheda a se', dentro il posto che lo ospita. Le stesse
       forme delle altre schede della plancia — angolo largo, ombra bassa —
       perche' e' la stessa casa. */
    .dm-calm-modulo{
      display:grid;gap:11px;padding:16px 16px 14px;margin:2px 0 12px;border-radius:20px;
      background:var(--card-bg,#fff);border:1px solid var(--card-border,#e2e8f0);
      box-shadow:0 14px 34px -18px rgba(15,23,42,.5)}
    .dm-calm-testa{display:flex;align-items:center;gap:10px}
    .dm-calm-testa strong{flex:1;font-size:13.5px;font-weight:900}
    .dm-calm-chiudi{
      flex:0 0 auto;width:28px;height:28px;padding:0;border:0;border-radius:9px;cursor:pointer;
      background:transparent;font-size:14px;opacity:.5}
    .dm-calm-chiudi:hover{opacity:1}
    .dm-calm-campo{display:grid;gap:4px;min-width:0}
    .dm-calm-lbl{
      font-size:10px;font-weight:900;letter-spacing:.9px;text-transform:uppercase;
      color:var(--secondary-text-color,#94a3b8)}
    .dm-calm-campo small{
      font-size:11px;font-weight:700;color:var(--secondary-text-color,#94a3b8)}
    .dm-calm-input{
      width:100%;min-width:0;box-sizing:border-box;padding:9px 12px;border-radius:12px;
      font:inherit;font-size:13px;font-weight:700;color:var(--text-color,#0f172a);
      background:var(--surface-3,#f8fafc);border:1px solid var(--card-border,#e2e8f0)}
    .dm-calm-input:focus{outline:2px solid color-mix(in srgb,#6366f1 55%,transparent);outline-offset:1px}
    .dm-calm-note{resize:vertical;line-height:1.4;font-weight:600}
    /* Giorno e ora sulla stessa riga: sono una data sola, e separarle su due
       righe fa sembrare che siano due domande. */
    .dm-calm-coppia{display:flex;gap:8px;min-width:0}
    .dm-calm-coppia .dm-calm-ora{flex:0 0 108px}
    .dm-calm-quando{display:grid;gap:11px;grid-template-columns:1fr 1fr}
    .dm-calm-tutto{display:flex;align-items:center;gap:9px;font-size:12.5px;font-weight:800}
    .dm-calm-tutto input{width:17px;height:17px;flex:0 0 17px}
    .dm-calm-errore:empty{display:none}
    .dm-calm-errore{
      display:block;padding:8px 12px;border-radius:11px;font-size:12px;font-weight:800;
      color:#b91c1c;background:color-mix(in srgb,#ef4444 12%,transparent)}
    .dm-calm-fondo{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
    .dm-calm-fondo button{
      padding:9px 18px;border:0;border-radius:999px;cursor:pointer;font-size:12.5px;font-weight:800}
    .dm-calm-annulla{background:var(--surface-3,#f1f5f9);color:var(--text-color,#0f172a)}
    .dm-calm-salva{
      color:#fff;background:linear-gradient(135deg,#818cf8,#4f46e5);
      box-shadow:0 8px 20px -8px rgba(79,70,229,.8)}
    .dm-calm-salva[disabled]{opacity:.6;cursor:default}

    @media (max-width:560px){
      .dm-calm-quando{grid-template-columns:1fr}
    }
    `,
  );
}

export function installCalendarioModifica() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* In cattura: la finestra della tessera chiude al primo clic che non
   * riconosce, e i tasti del modulo devono arrivare prima di quella regola. */
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("change", onChange, true);
  doc.addEventListener("input", onChange, true);
  return true;
}

installCalendarioModifica();
