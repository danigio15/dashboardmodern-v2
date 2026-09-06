/* La sezione degli animali di casa (#358).
 *
 * «Sarebbe utile ed interessante avere una nuova sezione per chi ha animali
 * domestici… in modo da tenere sotto controllo cio' che li riguarda: lettiera,
 * livello del distributore di cibo e cosi' via.»
 *
 * Una scheda per bestia, con la sua foto come le auto hanno la loro, e sotto
 * quello che la riguarda: la ciotola, la lettiera, l'acqua, la porta col
 * microchip, il collare. In cima la cosa che serve a colpo d'occhio — il cibo
 * che sta finendo, la lettiera da pulire, il filtro a fine corsa — perche' e'
 * per quella che si apre la pagina, non per leggere dodici numeri.
 *
 * La pagina e la sua voce nella barra non esistono nel documento vendorizzato
 * e non si possono aggiungere li': si costruiscono qui, accanto alle altre,
 * con le stesse classi — cosi' la barra, le intestazioni e la visibilita' delle
 * sezioni le trattano come trattano tutte le altre.
 *
 * I conti non stanno qui: quello che una lettura vuol dire e quando c'e' da
 * allarmarsi lo decide `core/animali-model.js`, che e' puro e si prova a
 * secco. Qui c'e' il disegno e le parole.
 */
import {
  CHIAVE_ANIMALI,
  animaliDisegnabili,
  vistaAnimale,
} from "../core/animali-model.js";
import {
  allStates,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  roomLabel,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ANIMALI__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const ANIMALI_PAGE_ID = "page-animali";
export const ANIMALI_TAB = "animali";

/** Gli animali configurati, come li salva la scheda della configurazione. */
export function animaliConfigurati() {
  return animaliDisegnabili(readJson(CHIAVE_ANIMALI, []));
}

/* ── la pagina e la sua voce nella barra ─────────────────────────────────
 *
 * La pagina va dove stanno le altre pagine: in fondo al documento c'e' altro
 * — la barra, le finestre, il piede — e una sezione messa li' esiste, e'
 * larga, e' alta, e non si vede. Si aggancia all'ultima sorella, che e'
 * l'unico posto in cui una pagina e' una pagina. */
function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureAnimaliPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(ANIMALI_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = ANIMALI_PAGE_ID;
  pagina.innerHTML = `<div class="dm-animali-wrap" id="animali-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureAnimaliTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${ANIMALI_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = ANIMALI_TAB;
  voce.id = `tab-${ANIMALI_TAB}`;
  voce.innerHTML = `<span class="icon">🐾</span><span class="text">${esc(t("Animali", "Pets"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da se'.
   * Fa la stessa identica cosa, perche' due modi di cambiare pagina sarebbero
   * due pagine attive quando non tornano. */
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureAnimaliPage()?.classList.add("active");
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  /* Accanto alle Persone quando ci sono: chi sta in casa e chi ci abita a
   * quattro zampe si guardano nello stesso momento. */
  const dopo =
    barra.querySelector('.tab[data-tab="persone"]') || barra.querySelector('.tab[data-tab="home"]');
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

/* La voce si nasconde come tutte le altre.
 *
 * `cdApplyNavVis` accende e spegne le voci leggendo `cd_sections`, e sa quali
 * esistono da una mappa sua. Una voce che non e' in quella mappa resta sempre
 * accesa, qualunque cosa dica la configurazione: si aggiunge alla mappa,
 * invece di nasconderla per conto nostro e avere due padroni sulla stessa
 * voce. */
function insegnaLaVisibilita() {
  const precedente = root.cdNavVisMap;
  if (typeof precedente !== "function" || precedente.__dmAnimali) return;
  const avvolta = function cdNavVisMap(...args) {
    const mappa = precedente.apply(this, args) || {};
    return { ...mappa, [ANIMALI_TAB]: ANIMALI_TAB };
  };
  avvolta.__dmAnimali = true;
  avvolta.__dmPrevious = precedente;
  root.cdNavVisMap = avvolta;
}

/* ── le parole ───────────────────────────────────────────────────────────
 *
 * Le chiavi arrivano dal modulo puro, che di lingue non sa niente. Qui
 * diventano parole, una per una, scritte per esteso: e' l'unica forma che il
 * raccoglitore delle traduzioni sa leggere. */
function parolaSpecie(specie) {
  if (specie === "gatto") return t("Gatto", "Cat");
  if (specie === "cane") return t("Cane", "Dog");
  return t("Animale", "Pet");
}

function parolaCasella(chiave) {
  switch (chiave) {
    case "cibo_livello":
      return t("Cibo", "Food");
    case "cibo_ultima":
      return t("Ultima erogazione", "Last meal");
    case "cibo_porzioni":
      return t("Porzioni oggi", "Portions today");
    case "lettiera_riempimento":
      return t("Lettiera", "Litter box");
    case "lettiera_ultima":
      return t("Ultima pulizia", "Last cleaned");
    case "lettiera_visite":
      return t("Visite oggi", "Visits today");
    case "acqua_livello":
      return t("Acqua", "Water");
    case "acqua_filtro":
      return t("Filtro", "Filter");
    case "porta":
      return t("Porta", "Pet door");
    case "collare_batteria":
      return t("Batteria del collare", "Collar battery");
    case "collare_posizione":
      return t("Posizione", "Location");
    case "peso":
      return t("Peso", "Weight");
    default:
      return chiave;
  }
}

function parolaAvviso(chiave) {
  switch (chiave) {
    case "cibo_scarso":
      return t("Cibo in esaurimento", "Food running low");
    case "acqua_scarsa":
      return t("Acqua quasi finita", "Water almost gone");
    case "filtro_finito":
      return t("Filtro dell'acqua a fine corsa", "Water filter worn out");
    case "lettiera_piena":
      return t("Lettiera piena", "Litter box full");
    case "lettiera_da_pulire":
      return t("Lettiera da pulire", "Litter box needs cleaning");
    case "collare_scarico":
      return t("Collare quasi scarico", "Collar battery low");
    default:
      return chiave;
  }
}

function simboloGruppo(gruppo) {
  switch (gruppo) {
    case "ciotola":
      return "🍽️";
    case "lettiera":
      return "🚽";
    case "acqua":
      return "💧";
    case "porta":
      return "🚪";
    case "collare":
      return "📡";
    default:
      return "🐾";
  }
}

/* «Due ore fa», senza mai infilare un numero dentro `t()`: una chiamata con un
 * pezzo calcolato dentro non entra in nessun catalogo, e tredici lingue la
 * leggerebbero in inglese. */
function quantoFa(minuti) {
  if (!Number.isFinite(minuti)) return "";
  if (minuti < 1) return t("adesso", "just now");
  if (minuti < 60) return `${minuti} ${t("min fa", "min ago")}`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? t("ora fa", "hour ago") : t("ore fa", "hours ago")}`;
  const giorni = Math.floor(ore / 24);
  return `${giorni} ${giorni === 1 ? t("giorno fa", "day ago") : t("giorni fa", "days ago")}`;
}

/** Il testo di una lettura: la parola giusta per la forma che quella ha. */
function testoLettura(voce) {
  /* Il trattino non e' una parola: non passa da `t()`, che vuole due lingue
   * diverse e un catalogo che le tenga. */
  if (!voce || voce.muto) return "—";
  if (voce.chiave === "porta" || voce.chiave === "collare_posizione") {
    if (voce.dentro === true) return t("In casa", "Inside");
    if (voce.dentro === false) return t("Fuori", "Outside");
    return voce.stato;
  }
  if (voce.minuti !== null) return quantoFa(voce.minuti);
  if (voce.valore !== null) {
    const numero = Math.round(voce.valore * 10) / 10;
    return voce.unita ? `${numero} ${voce.unita}` : String(numero);
  }
  return voce.stato;
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function ritrattoMarkup(vista) {
  if (vista.foto)
    return `<span class="dm-animale-ritratto" data-dm-animale-foto><img src="${esc(vista.foto)}" alt="" loading="lazy" decoding="async"></span>`;
  return `<span class="dm-animale-ritratto dm-vuoto" aria-hidden="true">${vista.icona}</span>`;
}

function avvisiMarkup(vista) {
  if (!vista.avvisi.length) return "";
  return `<ul class="dm-animale-avvisi">${vista.avvisi
    .map(
      (avviso) =>
        `<li data-dm-animale-avviso="${esc(avviso.chiave)}" data-gravita="${esc(avviso.gravita)}">
          <span aria-hidden="true">${avviso.gravita === "urgente" ? "🔴" : "🟠"}</span>${esc(parolaAvviso(avviso.chiave))}
        </li>`,
    )
    .join("")}</ul>`;
}

/** La barra di una quota: si disegna solo quando la quota e' in centesimi. */
function barraMarkup(voce) {
  if (!voce.quota || voce.valore === null || voce.unita !== "%") return "";
  const quota = Math.max(0, Math.min(100, Math.round(voce.valore)));
  /* La lettiera si riempie, il resto si svuota: la stessa barra al novanta per
   * cento e' un guaio nella prima e una tranquillita' nelle altre. */
  const pieno = voce.chiave === "lettiera_riempimento";
  const male = pieno ? quota >= 80 : quota <= 20;
  return `<span class="dm-animale-barra" data-male="${male}"><b style="width:${quota}%"></b></span>`;
}

function lettureMarkup(vista) {
  const voci = Object.values(vista.letture).filter((voce) => voce && !voce.muto);
  if (!voci.length)
    return `<p class="dm-animale-nulla">${esc(t("Nessuna entità collegata: apri la configurazione e scegli il dispositivo.", "No entity linked yet: open the settings and pick the device."))}</p>`;
  return `<div class="dm-animale-letture">${voci
    .map(
      (voce) => `<div class="dm-animale-lettura" data-dm-animale-lettura="${esc(voce.chiave)}">
        <span class="dm-animale-lettura-ic" aria-hidden="true">${simboloGruppo(voce.gruppo)}</span>
        <span class="dm-animale-lettura-lbl">${esc(parolaCasella(voce.chiave))}</span>
        <span class="dm-animale-lettura-val">${esc(testoLettura(voce))}</span>
        ${barraMarkup(voce)}
      </div>`,
    )
    .join("")}</div>`;
}

function pastigliaMarkup(vista) {
  if (vista.dentro === null) return "";
  return `<span class="dm-animale-dove" data-dentro="${vista.dentro}">${esc(vista.dentro ? t("In casa", "Inside") : t("Fuori", "Outside"))}</span>`;
}

function schedaMarkup(vista) {
  const sotto = [parolaSpecie(vista.specie), roomLabel(vista.stanza)].filter(Boolean).join(" · ");
  const nome = vista.nome || parolaSpecie(vista.specie);
  return `<article class="dm-animale-card" data-dm-animale="${esc(vista.id)}" data-gravita="${esc(vista.gravita)}">
    <div class="dm-animale-head">
      ${ritrattoMarkup(vista)}
      <span class="dm-animale-titolo">
        <strong>${esc(nome)}</strong>
        ${sotto ? `<small>${esc(sotto)}</small>` : ""}
      </span>
      ${pastigliaMarkup(vista)}
    </div>
    ${avvisiMarkup(vista)}
    ${lettureMarkup(vista)}
  </article>`;
}

function vuotoMarkup() {
  return `<div class="ed-empty dm-animale-vuoto">${esc(t("Nessun animale configurato", "No pet configured"))}</div>`;
}

/* La firma del disegno: quello che cambia la forma della scheda, non quello
 * che cambia dentro una casella. Un numero che scende non rifa' il markup —
 * lo riscrive `sincronizza` — ma una casella che compare si'. */
function firmaDi(viste) {
  return viste
    .map((vista) =>
      [
        vista.id,
        vista.nome,
        vista.specie,
        vista.foto ? "foto" : "",
        roomLabel(vista.stanza),
        vista.dentro === null ? "" : String(vista.dentro),
        vista.avvisi.map((avviso) => `${avviso.chiave}:${avviso.gravita}`).join("+"),
        Object.values(vista.letture)
          .filter((voce) => voce && !voce.muto)
          .map((voce) => voce.chiave)
          .join("+"),
      ].join("~"),
    )
    .join("|");
}

function sincronizza(card, vista) {
  card.dataset.gravita = vista.gravita;
  for (const voce of Object.values(vista.letture)) {
    if (!voce || voce.muto) continue;
    const riga = card.querySelector(`[data-dm-animale-lettura="${CSS.escape(voce.chiave)}"]`);
    if (!riga) continue;
    const valore = riga.querySelector(".dm-animale-lettura-val");
    const testo = testoLettura(voce);
    if (valore && valore.textContent !== testo) valore.textContent = testo;
    const barra = riga.querySelector(".dm-animale-barra b");
    if (barra && voce.valore !== null && voce.unita === "%")
      barra.style.width = `${Math.max(0, Math.min(100, Math.round(voce.valore)))}%`;
  }
}

export function renderAnimali() {
  const pagina = ensureAnimaliPage();
  const wrap = pagina?.querySelector("#animali-wrap");
  if (!wrap) return false;
  /* Il giro di disegno passa di qui a ogni ridisegno, perche' e' quello che
   * tiene allineate le voci della barra. Rifare le schede di una pagina che
   * nessuno sta guardando e' lavoro buttato — e su un telefono si sente. */
  if (!pagina.classList.contains("active")) return true;
  const states = allStates();
  const adesso = Date.now();
  const viste = animaliConfigurati().map((animale) => vistaAnimale(animale, states, adesso));

  if (!viste.length) {
    if (state.firma !== "vuoto") {
      state.firma = "vuoto";
      wrap.innerHTML = vuotoMarkup();
    }
    return true;
  }

  const firma = firmaDi(viste);
  if (state.firma !== firma || !wrap.querySelector("[data-dm-animale]")) {
    state.firma = firma;
    wrap.innerHTML = viste.map(schedaMarkup).join("");
  }
  for (const vista of viste) {
    const card = wrap.querySelector(`[data-dm-animale="${CSS.escape(vista.id)}"]`);
    if (card) sincronizza(card, vista);
  }
  return true;
}

function paint() {
  state.frame = 0;
  insegnaLaVisibilita();
  renderAnimali();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(paint) || root.setTimeout?.(paint, 0) || 0;
}

function installStyles() {
  installStyle(
    "dm-animali-section-style",
    `
      /* La larghezza non se la sceglie questa sezione: sta in un posto solo,
       * --dm-page-room, e tutte le pagine la seguono insieme. */
      #page-animali .dm-animali-wrap{box-sizing:border-box;width:100%;max-width:var(--dm-page-room,none);margin:0 auto;padding:0 4px 18px;display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
      #page-animali .dm-animale-card{display:grid;align-content:start;gap:12px;padding:14px;border:1px solid var(--divider-color,#dbe4ee);border-radius:20px;background:var(--card-bg,#fff);box-shadow:0 18px 34px -28px rgba(15,23,42,.55)}
      #page-animali .dm-animale-card[data-gravita="attenzione"]{border-color:color-mix(in srgb,#f59e0b 55%,transparent)}
      #page-animali .dm-animale-card[data-gravita="urgente"]{border-color:color-mix(in srgb,#dc2626 55%,transparent)}
      #page-animali .dm-animale-head{display:flex;align-items:center;gap:11px;min-width:0}
      #page-animali .dm-animale-ritratto{flex:0 0 52px;width:52px;height:52px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--secondary-background-color,#eef3f8);font-size:26px}
      #page-animali .dm-animale-ritratto img{width:100%;height:100%;object-fit:cover;display:block}
      #page-animali .dm-animale-titolo{display:grid;min-width:0;flex:1 1 auto}
      #page-animali .dm-animale-titolo strong{font-size:15px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #page-animali .dm-animale-titolo small{color:var(--secondary-text-color,#64748b);font-size:11.5px;font-weight:700}
      #page-animali .dm-animale-dove{flex:0 0 auto;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;background:var(--secondary-background-color,#eef3f8);color:var(--secondary-text-color,#64748b)}
      #page-animali .dm-animale-dove[data-dentro="true"]{background:color-mix(in srgb,#10b981 18%,transparent);color:#047857}
      #page-animali .dm-animale-dove[data-dentro="false"]{background:color-mix(in srgb,#0ea5e9 18%,transparent);color:#0369a1}
      /* Quello che serve a colpo d'occhio sta in cima, sopra i numeri: e' per
         questo che si apre la pagina. */
      #page-animali .dm-animale-avvisi{margin:0;padding:0;list-style:none;display:grid;gap:6px}
      #page-animali .dm-animale-avvisi li{display:flex;align-items:center;gap:7px;padding:7px 10px;border-radius:11px;font-size:12px;font-weight:800;background:color-mix(in srgb,#f59e0b 12%,transparent);color:#b45309}
      #page-animali .dm-animale-avvisi li[data-gravita="urgente"]{background:color-mix(in srgb,#dc2626 12%,transparent);color:#b91c1c}
      #page-animali .dm-animale-letture{display:grid;gap:7px}
      #page-animali .dm-animale-lettura{display:grid;grid-template-columns:20px 1fr auto;align-items:center;gap:8px;font-size:12px}
      #page-animali .dm-animale-lettura-ic{font-size:14px;text-align:center}
      #page-animali .dm-animale-lettura-lbl{color:var(--secondary-text-color,#64748b);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #page-animali .dm-animale-lettura-val{font-weight:900;text-align:right;white-space:nowrap}
      #page-animali .dm-animale-barra{grid-column:2/-1;position:relative;height:6px;border-radius:999px;background:var(--secondary-background-color,#eef3f8);overflow:hidden}
      #page-animali .dm-animale-barra b{display:block;height:100%;border-radius:999px;background:#10b981;transition:width .4s ease}
      #page-animali .dm-animale-barra[data-male="true"] b{background:#dc2626}
      #page-animali .dm-animale-nulla{margin:0;font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}
      #page-animali .dm-animale-vuoto{grid-column:1/-1}
      @media(prefers-reduced-motion:reduce){#page-animali .dm-animale-barra b{transition:none}}
    `,
  );
}

export function installAnimaliSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureAnimaliPage();
  insegnaLaVisibilita();
  ensureAnimaliTab();
  for (const nome of ["render", "cdApplyNavVis"]) wrapFunction(nome, "__dmAnimaliSection", schedule);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
}
