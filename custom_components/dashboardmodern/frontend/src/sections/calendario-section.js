/* La pagina del calendario (#259).
 *
 * «Possibilita' di visualizzare gli eventi del calendario che ho gia'
 * configurato in HA. Magari visualizzando gli ultimi 2 eventi su widget che
 * cliccandoci si apre una lista giorni/giorno e un elenco tipo come gia'
 * esistente "Da Fare".»
 *
 * La tessera e la sua finestra rispondono alla domanda di sfuggita — cosa ho
 * adesso, cosa viene dopo. Questa pagina risponde all'altra, quella che si fa
 * quando ci si siede: come e' fatta la settimana. In cima la fascia dei sette
 * giorni, con quanti impegni ha ciascuno e il pallino dei calendari che lo
 * riguardano; sotto l'agenda, giorno per giorno, e l'ora in colonna sua —
 * incolonnata si legge di sfuggita, in mezzo al titolo va cercata.
 *
 * Gli eventi NON si rileggono qui: li chiede gia' il filo della Home, una
 * volta per calendario, e questa pagina guarda la stessa memoria. Due padroni
 * per la stessa richiesta vorrebbero dire due richieste, e due risposte che
 * ogni tanto non si assomigliano.
 *
 * La voce nella barra compare solo quando un calendario e' scelto: portare a
 * una pagina vuota e' peggio che non offrirla.
 */
import {
  agendaPerGiorno,
  chiaveDelGiorno,
  etichettaDelGiorno,
  eventiDaQui,
  inCorso,
  oraDellEvento,
} from "../core/calendario-model.js";
import {
  aggiornaCalendari,
  bloccoDaFareMarkup,
  calendariConfigurati,
  configuredTodoLists,
  eventiDeiCalendari,
  scadenzeDaFare,
  segnaFatta,
} from "./home-widgets-section.js";
import {
  azioniDellEventoMarkup,
  bozzaAperta,
  chiaveDellEvento,
  dichiaraCalendari,
  moduloMarkup,
  registraOspiteCalendario,
  tastoNuovoMarkup,
} from "./calendario-modifica-section.js";
import { clean, doc, esc, installStyle, locale, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_CALENDARIO_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "", giorno: "" });

export const CALENDARIO_PAGE_ID = "page-calendario";
export const CALENDARIO_TAB = "calendario";

/* Quanti giorni si mostrano di fila. Trenta e' la finestra che il filo chiede;
 * qui si disegna quello che c'e' dentro, e chi non ha niente per tre settimane
 * vede tre settimane vuote in meno, non tre settimane di righe vuote. */
const GIORNI_IN_AGENDA = 30;
/* La fascia in cima e' una settimana: e' l'unita' con cui si ragiona quando si
 * chiede «come sono messo». */
const GIORNI_NELLA_FASCIA = 7;

/* I colori con cui si distinguono i calendari quando ce n'e' piu' d'uno. Chi
 * ne sceglie uno suo in configurazione tiene il suo; agli altri se ne da' uno
 * per ordine, sempre lo stesso, cosi' il «lavoro» resta del colore di ieri. */
const TINTE = Object.freeze(["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6"]);

export function calendariConTinta() {
  return calendariConfigurati().map((voce, indice) => ({
    ...voce,
    tinta: clean(voce.colore) || TINTE[indice % TINTE.length],
  }));
}

/* La pagina c'e' se c'e' almeno una delle due cose.
 *
 * «Devono essere un'unica sezione»: qui dentro stanno gli impegni E le cose da
 * fare, e chi ha solo le liste — senza nessun calendario — ha comunque una
 * pagina da aprire. Prima le cose da fare vivevano soltanto in Home. */
export function calendarioConfigurato() {
  return calendariConfigurati().length > 0 || configuredTodoLists().length > 0;
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureCalendarioPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(CALENDARIO_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = CALENDARIO_PAGE_ID;
  pagina.innerHTML = `<div class="dm-calp-wrap" id="calendario-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureCalendarioTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${CALENDARIO_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Subito dopo la Home: e' la pagina del «cosa succede oggi», ed e' li' che
   * si guarda per prima cosa la mattina. */
  const dopo = barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = CALENDARIO_TAB;
  voce.id = `tab-${CALENDARIO_TAB}`;
  voce.innerHTML = `<span class="icon">📅</span><span class="text">${esc(t("Agenda", "Agenda"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da se'.
   * Fa la stessa identica cosa, perche' due modi di cambiare pagina sarebbero
   * due pagine attive quando non tornano. */
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureCalendarioPage()?.classList.add("active");
    const testata = doc.querySelector("header");
    if (testata) testata.style.display = "none";
    root.scrollTo?.({ top: 0, behavior: "instant" });
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    /* Aprendo la pagina si chiede subito quello che c'e': l'elenco vecchio di
     * cinque minuti va bene per una mattonella di passaggio, non per l'agenda
     * che si e' appena aperta apposta. */
    aggiornaCalendari({ force: true });
    schedule();
  });
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

/* Quando la voce si vede, e chi lo decide.
 *
 * Come per la pagina della continuita': `cdApplyNavVis` del guscio, per ogni
 * voce che conosce, TOGLIE la riga di stile — e insegnargli anche la nostra
 * vorrebbe dire lui che la cancella ogni tre secondi e noi che la riscriviamo
 * al giro dopo, con la voce che lampeggia nel mezzo. Questa voce l'abbiamo
 * creata noi e la governiamo noi, leggendo la stessa configurazione che legge
 * lui. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[CALENDARIO_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureCalendarioTab();
  if (!voce) return;
  const serve = calendarioConfigurato() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(CALENDARIO_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── il disegno ───────────────────────────────────────────────────────── */

/* Le parole del calendario, dette qui e non nel nucleo: il raccoglitore delle
 * traduzioni guarda le sezioni, e una `t()` scritta dentro `src/core` non
 * finirebbe nei cataloghi — «Oggi» resterebbe italiano per tutti. */
function paroleDelCalendario() {
  return {
    oggi: t("Oggi", "Today"),
    domani: t("Domani", "Tomorrow"),
    tuttoIlGiorno: t("Tutto il giorno", "All day"),
    daFare: t("Da fare", "To-do"),
    inRitardo: t("In ritardo", "Overdue"),
  };
}


/* Il colore fisso delle scadenze: non appartengono a un calendario, e dargli
 * quello del primo le farebbe sembrare roba sua. */
const TINTA_SCADENZA = "#0ea5e9";

function tintaDi(evento, calendari) {
  if (evento?.tipo === "scadenza") return TINTA_SCADENZA;
  const suo = calendari.find(
    (voce) => voce.entity === evento.entity || voce.name === evento.calendario,
  );
  return suo?.tinta || TINTE[0];
}

/* La fascia dei sette giorni: quanto e' pieno ciascuno, in un colpo d'occhio.
 *
 * Non e' un calendario da sfogliare — per quello c'e' l'applicazione del
 * telefono — e' la risposta a «come sono messo questa settimana». I pallini
 * sono gli impegni: fino a tre si contano, oltre si dice il numero, perche'
 * otto pallini in fila non si contano piu' e diventano una macchia. */
function fasciaMarkup(giorni, adesso, lingua, calendari) {
  const perChiave = new Map(giorni.map((voce) => [voce.giorno, voce.eventi]));
  const celle = [];
  for (let passo = 0; passo < GIORNI_NELLA_FASCIA; passo += 1) {
    const quando = adesso + passo * 86400000;
    const chiave = chiaveDelGiorno(quando);
    const eventi = perChiave.get(chiave) || [];
    const data = new Date(quando);
    let settimana = "";
    try {
      settimana = data.toLocaleDateString(lingua || undefined, { weekday: "short" });
    } catch (_error) {
      settimana = "";
    }
    const pallini =
      eventi.length > 3
        ? `<b class="dm-calp-tanti">${eventi.length}</b>`
        : eventi
            .map(
              (evento) =>
                `<i style="background:${esc(tintaDi(evento, calendari))}"></i>`,
            )
            .join("");
    celle.push(`<button type="button" class="dm-calp-cella" data-dm-calp-giorno="${esc(chiave)}"
      data-oggi="${passo === 0}" data-vuoto="${eventi.length === 0}"
      data-scelto="${state.giorno === chiave}">
      <span class="dm-calp-sett">${esc(settimana)}</span>
      <b class="dm-calp-numero">${esc(String(data.getDate()))}</b>
      <span class="dm-calp-punti">${pallini}</span>
    </button>`);
  }
  return `<div class="dm-calp-fascia">${celle.join("")}</div>`;
}

/* Una riga dell'agenda: un appuntamento o una scadenza.
 *
 * Sono due cose diverse e si vedono diverse. L'appuntamento porta la sua ora,
 * la stecca del suo calendario e i tasti per spostarlo; la scadenza porta la
 * casella da spuntare, perche' una cosa da fare non si sposta: si fa. */
function eventoMarkup(evento, adesso, lingua, calendari, piuCalendari) {
  if (evento.tipo === "scadenza")
    return `<li class="dm-calp-evento" data-scadenza="true" style="--dm-calp-tinta:${TINTA_SCADENZA}">
      <span class="dm-calp-ora">${esc(oraDellEvento(evento, paroleDelCalendario(), lingua))}</span>
      <button type="button" class="dm-todo-check" data-dm-todo-check
        data-dm-todo-list="${esc(evento.listaId)}" data-dm-todo-uid="${esc(evento.uid)}"
        data-dm-todo-summary="${esc(evento.summary)}"
        aria-label="${esc(segnaFatta(evento.summary))}"></button>
      <span class="dm-calp-corpo">
        <b>${esc(evento.summary || t("Senza titolo", "Untitled"))}</b>
        <small>${esc(evento.lista)}</small>
      </span>
    </li>`;
  const ora = inCorso(evento, adesso);
  const sotto = [piuCalendari ? evento.calendario : "", evento.location].filter(Boolean).join(" · ");
  return `<li class="dm-calp-evento" data-adesso="${ora}"
      style="--dm-calp-tinta:${esc(tintaDi(evento, calendari))}">
    <span class="dm-calp-ora">${esc(oraDellEvento(evento, paroleDelCalendario(), lingua))}</span>
    <span class="dm-calp-corpo">
      <b>${esc(evento.summary || t("Senza titolo", "Untitled"))}</b>
      ${sotto ? `<small>${esc(sotto)}</small>` : ""}
      ${
        /* La descrizione solo se c'e', e senza tagliarla a meta': in agenda
         * l'indirizzo della riunione o il numero della prenotazione sono la
         * ragione per cui si apre la pagina invece della mattonella. */
        clean(evento.description)
          ? `<span class="dm-calp-nota">${esc(clean(evento.description))}</span>`
          : ""
      }
    </span>
    ${ora ? `<span class="dm-calp-adesso">${esc(t("Adesso", "Now"))}</span>` : ""}
    ${azioniDellEventoMarkup(evento, chiaveDellEvento(evento))}
  </li>`;
}

function vuotoMarkup() {
  return `<div class="dm-calp-vuoto">
    <strong>${esc(t("Nessun calendario scelto", "No calendar selected"))}</strong>
    <span>${esc(
      t(
        "Scegli i calendari dalla scheda Widget della configurazione: quelli che hai già in Home Assistant compaiono da soli con «Rileva».",
        "Pick the calendars from the Widgets tab in the settings: the ones you already have in Home Assistant appear on their own with «Detect».",
      ),
    )}</span>
  </div>`;
}

function dipingi() {
  const pagina = ensureCalendarioPage();
  const dove = pagina?.querySelector?.("#calendario-wrap");
  if (!dove) return;
  const calendari = calendariConTinta();
  /* Senza calendari ma con le liste la pagina non e' vuota: mostra le cose da
   * fare e basta, che e' meta' agenda ma e' un'agenda. */
  if (!calendari.length) {
    const soleCose = bloccoDaFareMarkup();
    const firmaVuota = soleCose ? `cose:${soleCose}` : "vuoto";
    if (state.firma === firmaVuota && dove.firstElementChild) return;
    state.firma = firmaVuota;
    dove.innerHTML = soleCose
      ? `<section class="dm-calp-cose">
          <h3 class="dm-calp-titolo">✅ ${esc(t("Da fare", "To-do"))}</h3>
          ${soleCose}
        </section>`
      : vuotoMarkup();
    return;
  }
  const { eventi, inArrivo } = eventiDeiCalendari();
  const adesso = Date.now();
  const restano = eventiDaQui(eventi, adesso);
  /* Le scadenze delle liste entrano nell'agenda, nel loro giorno (#259): una
   * cosa da fare con una data E' un impegno di quel giorno, e tenerla in fondo
   * alla pagina vuol dire guardare giovedi' senza vedere cosa scade giovedi'. */
  const scadenze = scadenzeDaFare();
  const insieme = agendaPerGiorno(restano, scadenze, adesso);
  const arretrati = insieme.ritardo;
  const giorni = insieme.giorni.slice(0, GIORNI_IN_AGENDA);
  const lingua = locale();
  const piuCalendari = calendari.length > 1;

  /* Il giorno scelto nella fascia filtra l'agenda; senza scelta si vede tutto,
   * che e' quello che si vuole aprendo la pagina. */
  const mostrati = state.giorno ? giorni.filter((voce) => voce.giorno === state.giorno) : giorni;

  /* Le cose da fare stanno sotto gli impegni, in un blocco loro: un
   * appuntamento succede a un'ora e non si spunta, una cosa da fare si spunta
   * e un'ora non ce l'ha. Mescolarle in un elenco solo darebbe righe che si
   * somigliano e non fanno la stessa cosa. */
  const daFare = bloccoDaFareMarkup();
  const cose = daFare
    ? `<section class="dm-calp-cose">
        <h3 class="dm-calp-titolo">✅ ${esc(t("Da fare", "To-do"))}</h3>
        ${daFare}
      </section>`
    : "";

  const firma = JSON.stringify([
    state.giorno,
    inArrivo,
    daFare,
    /* Il modulo aperto fa parte di quello che si vede: senza, chi tocca la
     * matita non vedrebbe comparire niente finche' non cambia uno stato. */
    bozzaAperta(),
    calendari.map((voce) => [voce.entity, voce.tinta]),
    restano.map((evento) => [evento.entity, evento.inizio, evento.fine, evento.summary]),
    scadenze.map((voce) => [voce.uid, voce.inizio, voce.summary]),
    chiaveDelGiorno(adesso),
  ]);
  if (state.firma === firma && dove.firstElementChild) return;
  state.firma = firma;

  /* Quello che e' scaduto sta in cima, in un blocco suo: appartiene ad adesso,
   * non al martedi' in cui e' passato. */
  const ritardoMarkup =
    arretrati.length && !state.giorno
      ? `<section class="dm-calp-giorno" data-dm-ritardo="true">
          <h3 class="dm-calp-titolo">⚠️ ${esc(paroleDelCalendario().inRitardo)}</h3>
          <ul class="dm-calp-lista">${arretrati
            .map((evento) => eventoMarkup(evento, adesso, lingua, calendari, piuCalendari))
            .join("")}</ul>
        </section>`
      : "";

  const agenda = mostrati.length
    ? mostrati
        .map(
          ({ giorno, eventi: dentro }) => `<section class="dm-calp-giorno">
        <h3 class="dm-calp-titolo">${esc(etichettaDelGiorno(giorno, adesso, paroleDelCalendario(), lingua))}</h3>
        <ul class="dm-calp-lista">${dentro
          .map((evento) => eventoMarkup(evento, adesso, lingua, calendari, piuCalendari))
          .join("")}</ul>
      </section>`,
        )
        .join("")
    : `<p class="dm-calp-niente">${esc(
        inArrivo
          ? t("Caricamento…", "Loading…")
          : state.giorno
            ? t("Niente in programma questo giorno", "Nothing scheduled that day")
            : t("✨ Niente in programma", "✨ Nothing scheduled"),
      )}</p>`;

  /* Nella legenda entra anche «Da fare», ma solo se qualche scadenza c'e'
   * davvero: una voce che spiega un colore assente e' una riga in piu' da
   * leggere per niente. */
  const vociLegenda = [
    ...(piuCalendari ? calendari.map((voce) => [voce.tinta, clean(voce.name) || voce.entity]) : []),
    ...(scadenze.length ? [[TINTA_SCADENZA, t("Da fare", "To-do")]] : []),
  ];
  const legenda = vociLegenda.length
    ? `<div class="dm-calp-legenda">${vociLegenda
        .map(
          ([tinta, nome]) =>
            `<span class="dm-calp-voce"><i style="background:${esc(tinta)}"></i>${esc(nome)}</span>`,
        )
        .join("")}</div>`
    : "";

  /* Il modulo sa quali calendari ci sono da chi lo disegna: e' lo stesso
   * elenco in Home e qui. */
  dichiaraCalendari(calendari);
  const modulo = moduloMarkup(calendari);
  /* Il tasto nasce sul giorno scelto: chi ha appena toccato sabato nella
   * fascia non vuole segnare un impegno per oggi. */
  const nuovo = bozzaAperta() ? "" : tastoNuovoMarkup(calendari, state.giorno);

  dove.innerHTML = `${fasciaMarkup(giorni, adesso, lingua, calendari)}${legenda}
    ${
      state.giorno
        ? `<button type="button" class="dm-calp-tutto" data-dm-calp-tutto>↩ ${esc(
            t("Tutti i giorni", "All days"),
          )}</button>`
        : ""
    }
    ${nuovo ? `<div class="dm-calp-nuovo-riga">${nuovo}</div>` : ""}
    ${modulo}
    <div class="dm-calp-agenda">${ritardoMarkup}${agenda}</div>
    ${cose}`;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] calendario", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderCalendarioSection() {
  state.firma = "";
  schedule();
}

function onClick(event) {
  const cella = event.target?.closest?.("[data-dm-calp-giorno]");
  if (cella) {
    event.preventDefault();
    const chiave = clean(cella.dataset.dmCalpGiorno);
    // Ritoccare il giorno gia' scelto lo deseleziona: la fascia e' un filtro,
    // e un filtro che non si toglie e' una trappola.
    state.giorno = state.giorno === chiave ? "" : chiave;
    state.firma = "";
    dipingi();
    return;
  }
  if (event.target?.closest?.("[data-dm-calp-tutto]")) {
    event.preventDefault();
    state.giorno = "";
    state.firma = "";
    dipingi();
  }
}

function installStyles() {
  const P = `#${CALENDARIO_PAGE_ID}`;
  installStyle(
    "dm-calendario-section-style",
    `
    ${P} .dm-calp-wrap{display:grid;gap:16px;padding:0 0 24px}
    ${P} .dm-calp-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-calp-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-calp-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* ── la fascia della settimana ─────────────────────────────────────── */
    ${P} .dm-calp-fascia{
      display:grid;grid-template-columns:repeat(7,1fr);gap:8px;padding:14px;
      border-radius:22px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-calp-cella{
      display:grid;gap:4px;justify-items:center;padding:10px 4px 8px;border:0;cursor:pointer;
      border-radius:16px;background:transparent;transition:background .2s ease,transform .15s ease}
    ${P} .dm-calp-cella:hover{background:color-mix(in srgb,var(--primary-color,#6366f1) 8%,transparent)}
    ${P} .dm-calp-sett{
      font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;
      color:var(--secondary-text-color,#94a3b8)}
    ${P} .dm-calp-numero{
      font-family:'Oswald',sans-serif;font-size:22px;font-weight:500;line-height:1.1;
      font-variant-numeric:tabular-nums;color:var(--text-color,#0f172a)}
    /* Oggi porta il cerchio pieno: e' il giorno da cui si conta tutto il
       resto, e cercarlo fra sette numeri uguali costa uno sguardo di troppo. */
    ${P} .dm-calp-cella[data-oggi="true"] .dm-calp-numero{
      display:grid;place-items:center;width:34px;height:34px;border-radius:50%;color:#fff;
      background:linear-gradient(135deg,#818cf8,#4f46e5)}
    ${P} .dm-calp-cella[data-scelto="true"]{
      background:color-mix(in srgb,var(--primary-color,#6366f1) 14%,transparent);
      box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--primary-color,#6366f1) 45%,transparent)}
    ${P} .dm-calp-punti{display:flex;gap:3px;min-height:8px;align-items:center}
    ${P} .dm-calp-punti i{display:block;width:6px;height:6px;border-radius:50%}
    ${P} .dm-calp-tanti{
      font-size:10px;font-weight:900;color:var(--secondary-text-color,#64748b);
      font-variant-numeric:tabular-nums}

    ${P} .dm-calp-legenda{display:flex;flex-wrap:wrap;gap:6px 16px;padding:0 4px}
    ${P} .dm-calp-voce{
      display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:800;
      color:var(--secondary-text-color,#64748b)}
    ${P} .dm-calp-voce i{display:block;width:9px;height:9px;border-radius:50%}

    ${P} .dm-calp-tutto{
      justify-self:start;padding:8px 16px;border:0;border-radius:999px;cursor:pointer;
      font-size:12px;font-weight:800;color:var(--text-color,#0f172a);
      background:var(--card-bg,#fff);box-shadow:0 6px 16px rgba(0,0,0,.08)}

    /* ── l'agenda ──────────────────────────────────────────────────────── */
    ${P} .dm-calp-nuovo-riga{display:flex;justify-content:flex-start}
    /* Una scadenza dentro l'agenda (#259): la casella al posto dei tasti, e la
       parola «Da fare» dove gli altri hanno l'ora. */
    ${P} .dm-calp-evento[data-scadenza="true"] .dm-calp-ora{color:var(--dm-calp-tinta,#0ea5e9)}
    ${P} .dm-calp-evento[data-scadenza="true"] .dm-todo-check{
      flex:0 0 19px;width:19px;height:19px;margin-top:2px}
    ${P} .dm-calp-giorno[data-dm-ritardo="true"] .dm-calp-titolo{color:#b91c1c}
    ${P} .dm-calp-giorno[data-dm-ritardo="true"] .dm-calp-evento{border-left-color:#ef4444}
    ${P} .dm-calp-giorno[data-dm-ritardo="true"] .dm-calp-ora{color:#b91c1c}
    /* Le cose da fare: stessa scheda dei giorni, cosi' i due blocchi si
       leggono come due parti della stessa pagina e non come due pagine. */
    ${P} .dm-calp-cose{
      padding:16px 18px;border-radius:22px;border:1px solid var(--card-border,#e2e8f0);
      background:var(--card-bg,#fff);box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-calp-cose .dm-w-block + .dm-w-block{margin-top:14px}
    ${P} .dm-calp-cose .dm-w-block-title{
      display:block;margin-bottom:8px;font-size:11px;font-weight:900;letter-spacing:1px;
      text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
    ${P} .dm-calp-agenda{display:grid;gap:12px}
    ${P} .dm-calp-giorno{
      padding:16px 18px;border-radius:22px;border:1px solid var(--card-border,#e2e8f0);
      background:var(--card-bg,#fff);box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-calp-titolo{
      margin:0 0 12px;font-size:11px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;
      color:var(--secondary-text-color,#64748b)}
    ${P} .dm-calp-lista{list-style:none;margin:0;padding:0;display:grid;gap:10px}
    /* Ogni riga porta a sinistra la stecca del suo calendario: con due agende
       nello stesso giorno, il colore dice di chi e' l'impegno senza leggere. */
    ${P} .dm-calp-evento{
      display:flex;align-items:flex-start;gap:13px;min-width:0;padding-left:12px;
      border-left:3px solid var(--dm-calp-tinta,#6366f1);border-radius:2px}
    ${P} .dm-calp-ora{
      flex:0 0 auto;min-width:96px;padding-top:1px;font-size:12px;font-weight:800;line-height:1.5;
      font-variant-numeric:tabular-nums;color:var(--secondary-text-color,#64748b)}
    ${P} .dm-calp-corpo{display:grid;gap:2px;min-width:0;flex:1}
    ${P} .dm-calp-corpo b{font-size:14px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}
    ${P} .dm-calp-corpo small{
      font-size:11.5px;font-weight:700;color:var(--secondary-text-color,#94a3b8);
      overflow-wrap:anywhere}
    ${P} .dm-calp-nota{
      margin-top:3px;font-size:12px;font-weight:600;line-height:1.45;
      color:var(--secondary-text-color,#64748b);overflow-wrap:anywhere;white-space:pre-line}
    ${P} .dm-calp-evento[data-adesso="true"] .dm-calp-ora,
    ${P} .dm-calp-evento[data-adesso="true"] .dm-calp-corpo b{color:var(--dm-calp-tinta,#6366f1)}
    ${P} .dm-calp-adesso{
      flex:0 0 auto;align-self:center;padding:4px 10px;border-radius:999px;color:#fff;
      font-size:9.5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;
      background:var(--dm-calp-tinta,#6366f1)}
    ${P} .dm-calp-niente{
      margin:0;padding:26px 18px;text-align:center;border-radius:22px;
      border:1px dashed var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);
      font-size:13px;font-weight:800;color:var(--secondary-text-color,#64748b)}

    @media (max-width:640px){
      ${P} .dm-calp-fascia{gap:4px;padding:10px 8px}
      ${P} .dm-calp-numero{font-size:18px}
      ${P} .dm-calp-cella[data-oggi="true"] .dm-calp-numero{width:29px;height:29px}
      ${P} .dm-calp-ora{min-width:74px;font-size:11px}
      ${P} .dm-calp-evento{gap:10px;padding-left:10px}
    }
    `,
  );
}

export function installCalendarioSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* Il modulo del calendario ci fa ridisegnare quando si apre, si chiude o si
   * lamenta: e' lui che sa quando qualcosa e' cambiato, non noi. */
  registraOspiteCalendario(() => renderCalendarioSection());
  ensureCalendarioPage();
  ensureCalendarioTab();
  doc.addEventListener("click", onClick);
  /* Il guscio ridisegna la Home a ogni giro e riapplica la visibilita' delle
   * voci ogni tre secondi: agganciarsi li' vuol dire seguire la plancia invece
   * di interrogarla con un timer nostro. */
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmCalendarioSection) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmCalendarioSection = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
  return true;
}

installCalendarioSection();
