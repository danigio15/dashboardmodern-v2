/* La pagina delle allerte (#296).
 *
 * «Presenza di allerte varie: terremoti INGV, thermal comfort zona,
 * concentrazione pollini, concentrazione fulmini zona, avvisi protezione
 * civile, Flightradar24 di zona.»
 *
 * Sei fonti che parlano sei lingue, e una domanda sola: c'e' qualcosa per cui
 * alzare la testa? Il modello in `core/allerte-model.js` le riduce a un
 * livello — quiete, nota, attenzione, allarme — e a poche righe che lo
 * spiegano. Qui si disegna: in cima il riassunto, sotto una tessera per fonte,
 * col colore del suo livello. Una fonte che non risponde lo dice, e non conta
 * come quiete.
 *
 * La voce nella barra compare solo quando almeno una fonte e' configurata:
 * portare a una pagina vuota e' peggio che non offrirla. Qui non si scrive
 * niente in Home Assistant: si legge e si disegna.
 */
import {
  CHIAVE_ALLERTE,
  IGNOTO,
  allerteAttive,
  categorieConfigurate,
  letturaAllerte,
  livelloMassimo,
} from "../core/allerte-model.js";
import { valeLaPenaAprirla, vociDelDettaglio } from "../core/dettaglio-allerta.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  locale,
  paginaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ALLERTE__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const ALLERTE_PAGE_ID = "page-allerte";
export const ALLERTE_TAB = "allerte";

/* ── cosa c'e' da guardare ────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_ALLERTE, {});
}

/** Se almeno una fonte e' stata dichiarata: senza, la pagina non ha niente da dire. */
export function allerteConfigurate() {
  return categorieConfigurate(configurazione()).length > 0;
}

export function lettureAllerte() {
  return letturaAllerte(configurazione(), allStates(), root.resolveEntity || ((value) => value));
}

/* ── le parole ────────────────────────────────────────────────────────── */

/* Nome, simbolo e la frase di quiete di ogni fonte. Il simbolo e' quello che
 * la tessera in Home e la barra useranno: una famiglia sola. */
export function categoriaDelleAllerte(chiave) {
  const voci = {
    terremoti: {
      icona: "🌍",
      nome: t("Terremoti", "Earthquakes"),
      quiete: t("Nessuna scossa rilevante", "No notable quake"),
    },
    meteo: {
      icona: "⚠️",
      nome: t("Protezione civile", "Civil protection"),
      quiete: t("Nessun avviso in corso", "No warning in force"),
    },
    fulmini: {
      icona: "⚡",
      nome: t("Fulmini", "Lightning"),
      quiete: t("Nessun fulmine vicino", "No lightning nearby"),
    },
    pollini: {
      icona: "🌼",
      nome: t("Pollini", "Pollen"),
      quiete: t("Concentrazione bassa", "Low concentration"),
    },
    comfort: {
      icona: "🌡️",
      nome: t("Comfort termico", "Thermal comfort"),
      quiete: t("Si sta bene", "Comfortable"),
    },
    voli: {
      icona: "✈️",
      nome: t("Voli sopra casa", "Flights overhead"),
      quiete: t("Cielo libero", "Clear sky"),
    },
    scioperi: {
      icona: "🪧",
      nome: t("Scioperi", "Strikes"),
      quiete: t("Nessuno sciopero in vista", "No strike ahead"),
    },
    treni: {
      icona: "🚆",
      nome: t("Treni", "Trains"),
      quiete: t("In orario", "On time"),
    },
  };
  return voci[chiave] || { icona: "•", nome: clean(chiave), quiete: "" };
}

export function parolaDelLivello(livello) {
  if (livello === "quiete") return t("Tranquillo", "Calm");
  if (livello === "nota") return t("Da notare", "Worth noting");
  if (livello === "attenzione") return t("Attenzione", "Warning");
  if (livello === "allarme") return t("Allarme", "Alarm");
  return t("Non risponde", "Not answering");
}

/* Le parole di Thermal Comfort, dette in italiano: «quite_uncomfortable» non
 * e' una frase che uno legge volentieri sul muro di casa. */
function parolaDelComfort(codice) {
  const voci = {
    /* Le parole che dicono «c'e' disagio» e prima non venivano lette (#355):
     * la zona del simmer index, il conto dell'humidex, e il contatto di chi
     * il sensore se l'e' scritto in casa. */
    on: t("Disagio termico", "Thermal discomfort"),
    off: t("Nessun disagio", "No discomfort"),
    no_discomfort: t("Nessun disagio", "No discomfort"),
    slightly_uncomfortable: t("Leggero disagio", "Slight discomfort"),
    some_discomfort: t("Un po' di disagio", "Some discomfort"),
    great_discomfort: t("Molto disagio", "Great discomfort"),
    extreme_danger_of_heatstroke: t("Rischio colpo di calore", "Heatstroke danger"),
    heat_stroke_imminent: t("Pericolo immediato", "Immediate danger"),
    dangerous: t("Pericoloso", "Dangerous"),
    hot: t("Caldo", "Hot"),
    very_hot: t("Molto caldo", "Very hot"),
    sweltering: t("Caldo soffocante", "Sweltering"),
    muggy: t("Afoso", "Muggy"),
    dry: t("Aria secca", "Dry air"),
    very_comfortable: t("Molto confortevole", "Very comfortable"),
    comfortable: t("Confortevole", "Comfortable"),
    ok_but_humid: t("Bene, ma umido", "Fine, but humid"),
    somewhat_uncomfortable: t("Un po' afoso", "Somewhat muggy"),
    quite_uncomfortable: t("Afoso", "Muggy"),
    extremely_uncomfortable: t("Molto afoso", "Very muggy"),
    severely_high: t("Pericoloso", "Dangerous"),
    cool: t("Fresco", "Cool"),
    slightly_cool: t("Leggermente fresco", "Slightly cool"),
    slightly_warm: t("Leggermente caldo", "Slightly warm"),
    increasing_discomfort: t("Disagio in aumento", "Increasing discomfort"),
    extremely_warm: t("Molto caldo", "Extremely warm"),
    danger_of_heatstroke: t("Rischio colpo di calore", "Heatstroke danger"),
    extremely_dangerous: t("Estremamente pericoloso", "Extremely dangerous"),
    circulatory_collapse_imminent: t("Pericolo immediato", "Immediate danger"),
    no_risk: t("Nessun rischio di gelo", "No frost risk"),
    unlikely: t("Gelo improbabile", "Frost unlikely"),
    probable: t("Gelo probabile", "Frost probable"),
    high: t("Rischio di gelo alto", "High frost risk"),
  };
  return voci[clean(codice)] || clean(codice).replaceAll("_", " ");
}

function parolaDeiPollini(parola) {
  const voce = clean(parola).toLowerCase();
  if (/very|molto|extreme|estrem/.test(voce)) return t("Molto alta", "Very high");
  if (/high|alt|elevat/.test(voce)) return t("Alta", "High");
  if (/moder|medi/.test(voce)) return t("Media", "Moderate");
  if (/low|bass/.test(voce)) return t("Bassa", "Low");
  if (/none|nessun|assente/.test(voce)) return t("Assente", "None");
  return clean(parola);
}

function oraDi(istante) {
  const quando = istante instanceof Date ? istante : new Date(istante);
  if (!Number.isFinite(quando.getTime())) return "";
  try {
    return quando.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  } catch (_error) {
    return "";
  }
}

function giornoEOraDi(testo) {
  /* Un istante puo' arrivare come testo (la data del terremoto) o come numero
   * di millisecondi (l'inizio di uno sciopero, che il modello ha gia' letto):
   * tutti e due sono un momento, e si scrivono allo stesso modo. */
  const quando = typeof testo === "number" ? new Date(testo) : new Date(clean(testo));
  if (!Number.isFinite(quando.getTime())) return clean(testo);
  try {
    return quando.toLocaleString(locale(), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_error) {
    return clean(testo);
  }
}

/** La frase grande della tessera: cosa sta succedendo, in una riga. */
export function fraseDellAllerta(lettura) {
  if (!lettura) return "";
  if (lettura.livello === IGNOTO)
    return t("Il sensore non risponde", "The sensor is not answering");
  const categoria = categoriaDelleAllerte(lettura.chiave);
  switch (lettura.chiave) {
    case "terremoti": {
      if (lettura.magnitudo != null) {
        const pezzi = [`M ${formatNumber(lettura.magnitudo, 1)}`];
        if (lettura.luogo) pezzi.push(lettura.luogo);
        return pezzi.join(" · ");
      }
      if (lettura.conteggio > 0)
        return lettura.conteggio === 1
          ? t("1 evento recente", "1 recent event")
          : t(`${lettura.conteggio} eventi recenti`, `${lettura.conteggio} recent events`);
      return categoria.quiete;
    }
    case "meteo":
      if (lettura.livello === "quiete") return categoria.quiete;
      return lettura.evento || parolaDelLivello(lettura.livello);
    case "fulmini": {
      if (lettura.livello === "quiete") return categoria.quiete;
      const quanti =
        lettura.conteggio === 1
          ? t("1 fulmine", "1 strike")
          : t(`${lettura.conteggio} fulmini`, `${lettura.conteggio} strikes`);
      if (lettura.distanza != null) {
        const km = formatNumber(lettura.distanza, lettura.distanza < 10 ? 1 : 0);
        return `${quanti} · ${t(`a ${km} km`, `${km} km away`)}`;
      }
      return quanti;
    }
    case "pollini":
      if (lettura.parola) return parolaDeiPollini(lettura.parola);
      if (lettura.indice != null)
        return `${formatNumber(lettura.indice, 0)}${lettura.unita ? ` ${lettura.unita}` : ""}`;
      return categoria.quiete;
    case "comfort":
      if (lettura.codice) return parolaDelComfort(lettura.codice);
      if (lettura.gradi != null) return `${formatNumber(lettura.gradi, 1)}${lettura.unita || "°"}`;
      return categoria.quiete;
    case "voli":
      if (!lettura.conteggio) return categoria.quiete;
      return lettura.conteggio === 1
        ? t("1 volo in zona", "1 flight in the area")
        : t(`${lettura.conteggio} voli in zona`, `${lettura.conteggio} flights in the area`);
    case "scioperi": {
      if (!lettura.conteggio) return categoria.quiete;
      /* Uno sciopero che comincia oggi si dice per primo: e' quello che
       * cambia la giornata di chi legge. */
      const adesso = (lettura.voci || []).find((voce) => voce.oggi);
      if (adesso)
        return adesso.settore
          ? t(`Oggi sciopero: ${adesso.settore}`, `Strike today: ${adesso.settore}`)
          : t("Sciopero oggi", "Strike today");
      return lettura.conteggio === 1
        ? t("1 sciopero in programma", "1 strike scheduled")
        : t(`${lettura.conteggio} scioperi in programma`, `${lettura.conteggio} strikes scheduled`);
    }
    case "treni":
      if (lettura.soppresso) return t("Treno soppresso", "Train cancelled");
      if (lettura.ritardo == null) return categoria.quiete;
      if (lettura.ritardo <= 0) return categoria.quiete;
      return t(
        `${formatNumber(lettura.ritardo, 0)} minuti di ritardo`,
        `${formatNumber(lettura.ritardo, 0)} minutes late`,
      );
    default:
      return parolaDelLivello(lettura.livello);
  }
}

/** Le righe sotto la frase: i dettagli che ci sono, e solo quelli. */
export function righeDellAllerta(lettura) {
  if (!lettura || lettura.livello === IGNOTO) return [];
  const righe = [];
  const metti = (nome, valore) => {
    if (valore !== null && valore !== undefined && clean(valore) !== "")
      righe.push({ nome, valore: clean(valore) });
  };
  switch (lettura.chiave) {
    case "terremoti":
      if (lettura.distanza != null)
        metti(t("Distanza", "Distance"), `${formatNumber(lettura.distanza, 0)} km`);
      if (lettura.quando) metti(t("Quando", "When"), giornoEOraDi(lettura.quando));
      if (lettura.conteggio != null && lettura.magnitudo != null)
        metti(t("Eventi", "Events"), formatNumber(lettura.conteggio, 0));
      break;
    case "meteo":
      if (lettura.testo) metti(t("Avviso", "Notice"), lettura.testo.slice(0, 180));
      break;
    case "fulmini":
      if (lettura.quando != null) metti(t("Ultimo", "Last"), oraDi(lettura.quando));
      if (lettura.conteggio != null && lettura.livello === "quiete" && lettura.conteggio > 0)
        metti(t("Contati", "Counted"), formatNumber(lettura.conteggio, 0));
      break;
    case "scioperi":
      /* Di ogni sciopero: quando comincia, il settore e dove. Il mezzo e i
       * sindacati quando l'integrazione li dice. */
      for (const voce of lettura.voci || []) {
        const nome = voce.settore || t("Sciopero", "Strike");
        const dettagli = [
          voce.oggi ? t("oggi", "today") : voce.inizio ? giornoEOraDi(voce.inizio) : "",
          voce.zona,
          voce.mezzo,
          voce.sindacati,
        ].filter(Boolean);
        metti(nome, dettagli.join(" · ") || "—");
      }
      break;
    case "treni":
      if (lettura.treno) metti(t("Treno", "Train"), lettura.treno);
      if (lettura.destinazione) metti(t("Destinazione", "Destination"), lettura.destinazione);
      if (lettura.partenza) metti(t("Partenza", "Departure"), lettura.partenza);
      if (lettura.stazione) metti(t("Stazione", "Station"), lettura.stazione);
      if (lettura.orario) metti(t("Orario", "Time"), lettura.orario);
      if (lettura.binario) metti(t("Binario", "Platform"), lettura.binario);
      if (lettura.ritardo != null && lettura.ritardo > 0)
        metti(t("Ritardo", "Delay"), `${formatNumber(lettura.ritardo, 0)} min`);
      break;
    case "voli":
      /* Prima la tratta, che e' la cosa che si vuole sapere di un aereo che
       * passa sopra casa; poi che aereo e', e da ultimo quanto e' alto (#334).
       * Con un capo solo — succede: l'integrazione non sempre sa da dove
       * viene — si dice quello, senza freccia verso il nulla. */
      for (const volo of lettura.voci || []) {
        const nome = [volo.numero, volo.compagnia].filter(Boolean).join(" · ");
        const tratta =
          volo.da && volo.a
            ? `${volo.da} → ${volo.a}`
            : volo.a
              ? `${t("verso", "to")} ${volo.a}`
              : volo.da
                ? `${t("da", "from")} ${volo.da}`
                : "";
        const dettagli = [
          tratta,
          [volo.aereo, volo.targa].filter(Boolean).join(" "),
          volo.quota != null ? `${formatNumber(volo.quota, 0)} ft` : "",
        ].filter(Boolean);
        if (nome) metti(nome, dettagli.join(" · ") || "—");
      }
      break;
    default:
      break;
  }
  return righe;
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureAllertePage() {
  if (!doc) return null;
  let pagina = doc.getElementById(ALLERTE_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = ALLERTE_PAGE_ID;
  pagina.innerHTML = `<div class="dm-allerte-wrap" id="allerte-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureAllerteTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${ALLERTE_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto alla Sicurezza: le allerte sono la sicurezza di fuori casa, e chi
   * le cerca le cerca li' vicino. */
  const dopo = barra.querySelector('.tab[data-tab="security"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = ALLERTE_TAB;
  voce.id = `tab-${ALLERTE_TAB}`;
  voce.innerHTML = `<span class="icon">⚠️</span><span class="text">${esc(t("Allerte", "Alerts"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da se'. */
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureAllertePage()?.classList.add("active");
    const testata = doc.querySelector("header");
    if (testata) testata.style.display = "none";
    root.scrollTo?.({ top: 0, behavior: "instant" });
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

/* La voce si governa da se', come la Continuita': la stessa configurazione
 * che legge il guscio, letta qui, senza due padroni sulla stessa riga. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[ALLERTE_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureAllerteTab();
  if (!voce) return;
  const serve = allerteConfigurate() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  /* Il livello piu' alto si porta sulla voce: un pallino rosso nella barra
   * dice «guarda qui» prima ancora di aprire la pagina. */
  const livello = serve ? livelloMassimo(lettureAllerte()) : "quiete";
  if (voce.dataset.dmLivello !== livello) voce.dataset.dmLivello = livello;
  const pagina = doc.getElementById(ALLERTE_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function riassuntoMarkup(letture) {
  const attive = allerteAttive(letture);
  const livello = livelloMassimo(letture);
  const mute = letture.filter((voce) => voce.livello === IGNOTO).length;
  const titolo = !attive.length
    ? t("Tutto tranquillo", "All quiet")
    : attive.length === 1
      ? t("1 allerta in corso", "1 alert in force")
      : t(`${attive.length} allerte in corso`, `${attive.length} alerts in force`);
  const fonti =
    letture.length === 1
      ? t("1 fonte", "1 source")
      : t(`${letture.length} fonti`, `${letture.length} sources`);
  const sotto = mute
    ? `${fonti} · ${mute === 1 ? t("1 non risponde", "1 not answering") : t(`${mute} non rispondono`, `${mute} not answering`)}`
    : attive.length
      ? `${fonti} · ${attive.map((voce) => categoriaDelleAllerte(voce.chiave).nome).join(", ")}`
      : fonti;
  return `<div class="dm-allerte-riassunto" data-livello="${esc(livello)}">
    <span class="dm-allerte-riassunto-ic" aria-hidden="true">${livello === "quiete" ? "🛡️" : "⚠️"}</span>
    <div class="dm-allerte-riassunto-testo"><strong>${esc(titolo)}</strong><small>${esc(sotto)}</small></div>
  </div>`;
}

/* ── il dettaglio, quando la si apre (#422) ───────────────────────────── */

const POPUP_ID = "dm-allerta-dettaglio";

/** Quello che Home Assistant dice dell'entita' di questa allerta. */
function attributiDi(entity) {
  const id = clean(entity);
  if (!id) return {};
  const stato = allStates()?.[id];
  return stato?.attributes && typeof stato.attributes === "object" ? stato.attributes : {};
}

function chiudiIlDettaglio() {
  doc?.getElementById?.(POPUP_ID)?.classList?.remove("show");
}

/* La finestra e' una sola e si riempie ogni volta: le allerte sono al massimo
 * otto, e tenerne otto costruite per mostrarne una alla volta e' ingombro
 * senza motivo. */
function ensureDettaglio() {
  let modal = doc?.getElementById?.(POPUP_ID);
  if (modal) return modal;
  if (!doc?.body) return null;
  modal = doc.createElement("div");
  modal.id = POPUP_ID;
  modal.className = "modal-wrapper";
  modal.innerHTML = `<div class="modal-card dm-allerta-dettaglio" role="dialog" aria-modal="true" aria-labelledby="${POPUP_ID}-titolo">
      <header class="dm-allerta-dettaglio-testa">
        <span class="dm-allerta-dettaglio-ic" data-dm-ic aria-hidden="true"></span>
        <span class="dm-allerta-dettaglio-nome" id="${POPUP_ID}-titolo" data-dm-nome></span>
        <span class="dm-allerta-dettaglio-livello" data-dm-livello></span>
        <button type="button" class="dm-allerta-dettaglio-chiudi" data-dm-chiudi aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
      </header>
      <div class="dm-allerta-dettaglio-corpo" data-dm-corpo></div>
    </div>`;
  /* Fuori dalla scheda si chiude, come in ogni altra finestra della plancia. */
  modal.addEventListener("click", (evento) => {
    if (evento.target === modal || evento.target?.closest?.("[data-dm-chiudi]"))
      chiudiIlDettaglio();
  });
  doc.body.append(modal);
  return modal;
}

/* Il corpo: la frase per intero, le righe della tessera, e poi tutto quello
 * che l'integrazione scrive. I paragrafi vanno sotto al loro nome, i dati
 * accanto: e' la differenza fra un avviso della protezione civile e una
 * severita' di una parola. */
function corpoDelDettaglio(lettura) {
  const pezzi = [];
  /* La frase, ma non quando dice quello che dice gia' la pastiglia del livello.
   * A quiete la frase E' la parola del livello — «Da notare» — e scriverla
   * anche qui vuol dire aprire una finestra per rileggere l'intestazione. */
  const frase = fraseDellAllerta(lettura);
  const livello = parolaDelLivello(lettura.livello);
  if (frase && frase.trim().toLowerCase() !== livello.trim().toLowerCase())
    pezzi.push(`<p class="dm-allerta-dettaglio-frase">${esc(frase)}</p>`);
  const righe = righeDellAllerta(lettura);
  if (righe.length)
    pezzi.push(
      `<ul class="dm-allerta-righe">${righe
        .map((riga) => `<li><span>${esc(riga.nome)}</span><b>${esc(riga.valore)}</b></li>`)
        .join("")}</ul>`,
    );
  const voci = vociDelDettaglio(attributiDi(lettura.entity));
  if (voci.length)
    pezzi.push(
      `<dl class="dm-allerta-voci">${voci
        .map(
          (voce) =>
            `<div class="dm-allerta-voce${voce.lungo ? " dm-allerta-voce-lunga" : ""}"><dt>${esc(voce.titolo)}</dt><dd>${esc(voce.istante ? giornoEOraDi(voce.valore) : voce.valore)}</dd></div>`,
        )
        .join("")}</dl>`,
    );
  /* L'entita' in fondo, in piccolo: quando un valore non torna, la prima
   * domanda e' «da dove viene questo numero», e la risposta e' qui. */
  if (clean(lettura.entity))
    pezzi.push(`<p class="dm-allerta-dettaglio-fonte mono">${esc(lettura.entity)}</p>`);
  return pezzi.join("");
}

function apriIlDettaglio(chiave) {
  const lettura = lettureAllerte().find((voce) => voce.chiave === chiave);
  if (!lettura) return false;
  const modal = ensureDettaglio();
  if (!modal) return false;
  const categoria = categoriaDelleAllerte(lettura.chiave);
  const dentro = (selettore) => modal.querySelector(selettore);
  const testa = modal.querySelector(".dm-allerta-dettaglio");
  if (testa) testa.dataset.livello = lettura.livello;
  const icona = dentro("[data-dm-ic]");
  if (icona) icona.textContent = categoria.icona;
  const nome = dentro("[data-dm-nome]");
  if (nome) nome.textContent = lettura.nome || categoria.nome;
  const livello = dentro("[data-dm-livello]");
  if (livello) livello.textContent = parolaDelLivello(lettura.livello);
  const corpo = dentro("[data-dm-corpo]");
  if (corpo) corpo.innerHTML = corpoDelDettaglio(lettura);
  modal.classList.add("show");
  if (root.navigator?.vibrate) root.navigator.vibrate(8);
  return true;
}

function tesseraMarkup(lettura) {
  const categoria = categoriaDelleAllerte(lettura.chiave);
  const righe = righeDellAllerta(lettura);
  /* Apribile solo se dentro c'e' qualcosa in piu' di quello che si vede gia'.
   *
   * Un riquadro che sembra premibile e non fa niente e' peggio di uno fermo:
   * la seconda volta non si prova piu' nemmeno dove invece funzionava. */
  const apribile = valeLaPenaAprirla(lettura, attributiDi(lettura.entity));
  const invito = apribile
    ? ` role="button" tabindex="0" aria-haspopup="dialog" data-dm-allerta-apri aria-label="${esc(
        `${lettura.nome || categoria.nome}: ${t("apri il dettaglio", "open the detail")}`,
      )}"`
    : "";
  return `<article class="dm-allerta${apribile ? " dm-allerta-apribile" : ""}"${invito} data-livello="${esc(lettura.livello)}" data-chiave="${esc(lettura.chiave)}">
    <header class="dm-allerta-testa">
      <span class="dm-allerta-ic" aria-hidden="true">${categoria.icona}</span>
      <span class="dm-allerta-nome">${esc(lettura.nome || categoria.nome)}</span>
      <span class="dm-allerta-livello">${esc(parolaDelLivello(lettura.livello))}</span>
    </header>
    <div class="dm-allerta-frase">${esc(fraseDellAllerta(lettura))}</div>
    ${
      righe.length
        ? `<ul class="dm-allerta-righe">${righe
            .map((riga) => `<li><span>${esc(riga.nome)}</span><b>${esc(riga.valore)}</b></li>`)
            .join("")}</ul>`
        : ""
    }
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-allerte-vuoto">
    <strong>${esc(t("Nessuna allerta configurata", "No alert configured"))}</strong>
    <span>${esc(
      t(
        "Aggiungile dalla scheda Allerte della configurazione: terremoti, avvisi della protezione civile, fulmini, pollini, comfort termico e voli sopra casa, ognuno dal sensore della sua integrazione.",
        "Add them from the Alerts tab in the settings: earthquakes, civil protection warnings, lightning, pollen, thermal comfort and flights overhead, each from the sensor of its integration.",
      ),
    )}</span>
  </div>`;
}

function dipingi() {
  const pagina = ensureAllertePage();
  const dove = pagina?.querySelector?.("#allerte-wrap");
  if (!dove) return;
  /* Le letture di ogni fonte e la loro impronta in JSON si facevano a ogni
   * mazzetto di stati, anche a pagina chiusa. Il pallino del livello sulla
   * voce della barra resta acceso comunque: quello si vede da fuori
   * (`accendiLaVoce`, che gira prima di questo giro). */
  if (!paginaVisibile(ALLERTE_PAGE_ID)) return;
  if (!allerteConfigurate()) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      dove.innerHTML = vuotoMarkup();
    }
    return;
  }
  const letture = lettureAllerte();
  const firma = JSON.stringify(letture);
  if (state.firma === firma && dove.firstElementChild) return;
  state.firma = firma;
  dove.innerHTML = `${riassuntoMarkup(letture)}<div class="dm-allerte-griglia">${letture
    .map(tesseraMarkup)
    .join("")}</div>`;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] allerte", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

export function renderAllerte() {
  state.firma = "";
  schedule();
}

function installStyles() {
  const P = `#${ALLERTE_PAGE_ID}`;
  installStyle(
    "dm-allerte-section-style",
    `
    ${P} .dm-allerte-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-allerte-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-allerte-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-allerte-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* Il riassunto: una riga sola, col colore del livello piu' alto. */
    ${P} .dm-allerte-riassunto{
      display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:20px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-allerte-riassunto-ic{
      display:grid;place-items:center;width:46px;height:46px;border-radius:14px;font-size:22px;
      background:color-mix(in srgb,var(--dm-allerta-colore,#22c55e) 16%,transparent)}
    ${P} .dm-allerte-riassunto-testo{display:grid;gap:2px;min-width:0}
    ${P} .dm-allerte-riassunto strong{font-size:16px;font-weight:900;color:var(--text,#0f172a)}
    ${P} .dm-allerte-riassunto small{font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}

    ${P} .dm-allerte-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
    ${P} .dm-allerta{
      position:relative;display:grid;gap:8px;padding:14px 16px;border-radius:18px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06));overflow:hidden}
    /* Una tessera che si apre lo dice al dito prima che al dito serva saperlo:
       il cursore, e un sollevamento appena percettibile. Chi non ha niente
       dentro non riceve niente di tutto questo: lo decide valeLaPenaAprirla. */
    ${P} .dm-allerta-apribile{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}
    ${P} .dm-allerta-apribile:hover{transform:translateY(-1px);
      box-shadow:var(--shadow-glass-strong,0 12px 34px rgba(0,0,0,.10))}
    ${P} .dm-allerta-apribile:focus-visible{
      outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 45%,transparent);
      outline-offset:3px}
    /* La striscia a sinistra e' il livello, detto col colore prima che con la parola. */
    ${P} .dm-allerta::before{
      content:"";position:absolute;left:0;top:0;bottom:0;width:5px;
      background:var(--dm-allerta-colore,#94a3b8)}
    /* Il nome della fonte si legge intero: «Protezione civile» e «Voli sopra
       casa» vanno su due righe piuttosto che finire in «PROTE…». */
    ${P} .dm-allerta-testa{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
    ${P} .dm-allerta-ic{font-size:18px;flex:0 0 auto}
    ${P} .dm-allerta-nome{
      flex:1 1 90px;min-width:0;font-size:12px;font-weight:900;letter-spacing:.04em;line-height:1.15;
      text-transform:uppercase;color:var(--text,#0f172a);overflow-wrap:anywhere}
    ${P} .dm-allerta-livello{
      flex:0 0 auto;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;
      padding:3px 8px;border-radius:999px;color:#fff;background:var(--dm-allerta-colore,#94a3b8)}
    ${P} .dm-allerta-frase{font-size:17px;font-weight:800;line-height:1.25;color:var(--text,#0f172a)}
    ${P} .dm-allerta-righe{list-style:none;margin:0;padding:0;display:grid;gap:4px}
    ${P} .dm-allerta-righe li{
      display:flex;justify-content:space-between;gap:10px;font-size:12px;
      color:var(--text-dim,#64748b)}
    ${P} .dm-allerta-righe li b{font-weight:800;color:var(--text,#0f172a);text-align:right;min-width:0}

    /* I quattro colori, piu' il grigio di chi non risponde. Stanno in una
       variabile perche' li usano tre pezzi — striscia, pastiglia, alone — e un
       colore scritto tre volte e' un colore che prima o poi diverge. */
    ${P} [data-livello="quiete"]{--dm-allerta-colore:#22c55e}
    ${P} [data-livello="nota"]{--dm-allerta-colore:#0ea5e9}
    ${P} [data-livello="attenzione"]{--dm-allerta-colore:#f59e0b}
    ${P} [data-livello="allarme"]{--dm-allerta-colore:#ef4444}
    ${P} [data-livello="ignoto"]{--dm-allerta-colore:#94a3b8}
    ${P} .dm-allerta[data-livello="allarme"]{
      box-shadow:0 0 0 1px rgba(239,68,68,.35),0 14px 34px -14px rgba(239,68,68,.6)}
    ${P} .dm-allerta[data-livello="ignoto"] .dm-allerta-frase{color:var(--text-dim,#64748b);font-weight:700}

    /* Il pallino sulla voce della barra, quando c'e' qualcosa. */
    nav.tabs .tab[data-tab="${ALLERTE_TAB}"]{position:relative}
    nav.tabs .tab[data-tab="${ALLERTE_TAB}"][data-dm-livello="attenzione"] .icon::after,
    nav.tabs .tab[data-tab="${ALLERTE_TAB}"][data-dm-livello="allarme"] .icon::after{
      content:"";position:absolute;top:6px;right:calc(50% - 16px);width:9px;height:9px;border-radius:50%;
      background:#ef4444;box-shadow:0 0 0 2px var(--card-bg,#fff)}
    nav.tabs .tab[data-tab="${ALLERTE_TAB}"][data-dm-livello="attenzione"] .icon::after{background:#f59e0b}

    @media (max-width:640px){
      ${P} .dm-allerte-griglia{grid-template-columns:1fr}
      ${P} .dm-allerta-frase{font-size:16px}
    }
    
    /* ── la finestra del dettaglio (#422) ─────────────────────────────────
       La veste — sfondo, bordo, angoli, entrata — la mette il foglio del
       guscio, che e' l'unico posto dove sta: qui c'e' solo quello che dentro
       questa finestra e' diverso dalle altre. */
    #dm-allerta-dettaglio .dm-allerta-dettaglio{
      display:grid;gap:0;max-width:560px;width:min(560px,92vw);
      max-height:min(80vh,720px);overflow:hidden;grid-template-rows:auto minmax(0,1fr)}
    #dm-allerta-dettaglio .dm-allerta-dettaglio-testa{
      display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:10px;
      padding:16px 18px 12px;border-bottom:1px solid var(--card-border,#e2e8f0)}
    #dm-allerta-dettaglio .dm-allerta-dettaglio-ic{font-size:26px;line-height:1}
    #dm-allerta-dettaglio .dm-allerta-dettaglio-nome{
      font-size:17px;font-weight:900;letter-spacing:-.01em;
      color:var(--primary-text-color,#0f172a);min-width:0;overflow-wrap:anywhere}
    /* Il livello si colora come la striscia della tessera da cui si e' entrati:
       aprendola non si cambia mondo. */
    #dm-allerta-dettaglio .dm-allerta-dettaglio-livello{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      padding:4px 10px;border-radius:999px;white-space:nowrap;color:#fff;
      background:var(--dm-allerta-colore,#94a3b8)}
    #dm-allerta-dettaglio .dm-allerta-dettaglio-chiudi{
      border:0;background:transparent;cursor:pointer;font-size:18px;line-height:1;
      padding:6px 4px;color:var(--text-dim,#64748b)}
    #dm-allerta-dettaglio .dm-allerta-dettaglio-corpo{
      padding:14px 18px 18px;overflow:auto;display:grid;gap:14px;align-content:start}
    #dm-allerta-dettaglio .dm-allerta-dettaglio-frase{
      margin:0;font-size:14px;line-height:1.45;color:var(--primary-text-color,#0f172a)}
    /* Le voci dell'integrazione. Un dato sta accanto al suo nome; un paragrafo
       — l'avviso della protezione civile e' questo — va sotto, e per intero:
       nella tessera lo si taglia a centottanta caratteri, qui no. */
    #dm-allerta-dettaglio .dm-allerta-voci{margin:0;display:grid;gap:8px}
    #dm-allerta-dettaglio .dm-allerta-voce{
      display:grid;grid-template-columns:minmax(90px,38%) minmax(0,1fr);gap:10px;align-items:baseline;
      padding-top:8px;border-top:1px solid var(--card-border,#eef2f7)}
    /* Il filo separa due voci: sopra la prima non separa niente, e resta un
       trattino sospeso sotto l'intestazione. */
    #dm-allerta-dettaglio .dm-allerta-voce:first-child{padding-top:0;border-top:0}
    #dm-allerta-dettaglio .dm-allerta-voce-lunga{grid-template-columns:minmax(0,1fr)}
    #dm-allerta-dettaglio .dm-allerta-voce dt{
      font-size:10.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;
      color:var(--text-dim,#94a3b8)}
    #dm-allerta-dettaglio .dm-allerta-voce dd{
      margin:0;font-size:13.5px;line-height:1.45;overflow-wrap:anywhere;
      color:var(--primary-text-color,#0f172a)}
    #dm-allerta-dettaglio .dm-allerta-dettaglio-fonte{
      margin:0;font-size:11px;color:var(--text-dim,#94a3b8);overflow-wrap:anywhere}
`,
  );
}

export function installAllerte() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureAllertePage();
  ensureAllerteTab();
  /* Il guscio ridisegna la Home a ogni giro e riapplica la visibilita' delle
   * voci ogni tre secondi: agganciarsi li' vuol dire seguire la plancia. */
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmAllerte) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmAllerte = true;
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
  /* Il tocco sulla tessera. Agganciato al documento e non a ogni riquadro: le
   * tessere si rifanno a ogni ridisegno, e un gestore per tessera sarebbe da
   * riattaccare ogni volta — cioe' da dimenticare una volta. */
  doc.addEventListener("click", (evento) => {
    const tessera = evento.target?.closest?.("[data-dm-allerta-apri]");
    if (!tessera) return;
    evento.preventDefault();
    apriIlDettaglio(clean(tessera.dataset.chiave));
  });
  /* Con la tastiera si apre come ogni altro tasto, e si chiude con Esc: la
   * tessera dichiara `role="button"`, e un bottone che risponde solo al dito
   * e' un bottone a meta'. */
  doc.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      chiudiIlDettaglio();
      return;
    }
    if (evento.key !== "Enter" && evento.key !== " ") return;
    const tessera = evento.target?.closest?.("[data-dm-allerta-apri]");
    if (!tessera) return;
    evento.preventDefault();
    apriIlDettaglio(clean(tessera.dataset.chiave));
  });
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

installAllerte();
