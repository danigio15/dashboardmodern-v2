/* Le persone di casa, in cima alla Home.
 *
 * Home Assistant sa gia' chi c'e' e chi no: `person.*` cambia zona, si porta
 * dietro la foto del profilo e spesso la batteria del telefono. La plancia
 * pero' non lo mostrava da nessuna parte. Qui ogni persona configurata ha la
 * sua card sotto il meteo: il ritratto — foto vera o avatar scelto
 * nell'editor — con l'anello del colore di dove si trova, la zona, da quanto
 * tempo, e la batteria del telefono nell'angolo.
 *
 * La card e' solo lettura: dice dove sono le persone, non le sposta. Chi le
 * configura passa dall'editor (people-editor-section), che scrive `cd_people`;
 * qui si legge quella chiave e la si disegna.
 */
import { fermaRitrattiPersi, installAvatar3dStyle, ritrattoVivo } from "./person-avatar-section.js";
import { normalizePeople, personViewModel } from "../core/person-model.js";
import { allStates, clean, doc, esc, formatNumber, installStyle, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_PEOPLE__";
const state = (root[KEY] ||= { installed: false, listeners: false, frame: 0, clock: 0 });

export function configuredPeople() {
  return normalizePeople(readJson("cd_people", []));
}

/* Quanto tempo fa, come lo direbbe una persona: l'unita' piu' grande che
 * abbia senso, e «adesso» al posto dei secondi. */
export function elapsedLabel(elapsed) {
  if (!elapsed) return "";
  const value = elapsed.value;
  if (elapsed.unit === "now") return t("adesso", "just now");
  if (elapsed.unit === "minute") return t(`${value} min fa`, `${value} min ago`);
  if (elapsed.unit === "hour") return t(`${value} ore fa`, `${value} h ago`);
  return t(`${value} giorni fa`, `${value} d ago`);
}

function presenceLabel(view) {
  if (view.presence === "home") return t("Casa", "Home");
  if (view.presence === "zone") return view.zone;
  return view.known ? t("Fuori", "Away") : t("Sconosciuto", "Unknown");
}

function presenceIcon(view) {
  if (view.presence === "home") return "🏠";
  if (view.presence === "zone") return "📍";
  return view.known ? "🚶" : "❔";
}

function batteryIcon(battery) {
  if (battery === null) return "";
  if (battery <= 20) return "🪫";
  return "🔋";
}

/* L'attivita' della Companion App, disegnata: sta nel pallino di stato del
 * ritratto, che quando la persona si muove smette di essere un pallino e
 * dice come si sta muovendo. */
const ACTIVITY_EMOJI = Object.freeze({
  automotive: "🚗",
  cycling: "🚴",
  running: "🏃",
  walking: "🚶",
  still: "🧍",
});

/* Il ritratto: la foto quando c'e', altrimenti l'avatar — l'emoji scelta, o le
 * iniziali sul colore scelto. La foto rotta ricade sull'avatar da sola, cosi'
 * un file rinominato in config/www non lascia un'icona spezzata. */
function portraitMarkup(view) {
  /* Il ritratto sceglie in ordine: quello costruito, l'emoji, le iniziali.
   * Il primo non si puo' stampare qui — e' una tela che va composta da due
   * immagini e poi tenuta viva — quindi si lascia il posto vuoto e ci pensa
   * `ritrattoVivo` appena la card e' a schermo. */
  const avatar = `<span class="dm-person-avatar"${view.avatar.face ? ' data-ritratto="true"' : ""} style="--dm-person-color:${esc(view.avatar.color)}">${
    view.avatar.face
      ? ""
      : view.avatar.emoji
        ? esc(view.avatar.emoji)
        : `<b>${esc(view.initials)}</b>`
  }</span>`;
  const photo = view.photo
    ? `<img class="dm-person-photo" src="${esc(view.photo)}" alt="" loading="lazy" data-person-img>`
    : "";
  const activity = ACTIVITY_EMOJI[view.activity] || "";
  const dot = activity
    ? `<i class="dm-person-dot" data-activity="true" aria-hidden="true">${activity}</i>`
    : `<i class="dm-person-dot" aria-hidden="true"></i>`;
  return `<span class="dm-person-portrait">${avatar}${photo}${dot}</span>`;
}

function distanceLabel(distance) {
  return `${formatNumber(distance.value, distance.value % 1 ? 1 : 0)} ${distance.unit}`;
}

/* Il viaggio di chi e' fuori: la distanza — con la freccia quando si sa in
 * che direzione va — e il tempo per tornare. Due pastiglie del colore di
 * presenza, sotto la zona. */
function tripMarkup(view) {
  const parts = [];
  if (view.distance) {
    const arrow =
      view.direction === "towards" ? " →🏠" : view.direction === "away" ? " ←🏠" : "";
    const title =
      view.direction === "towards"
        ? t("Si sta avvicinando a casa", "Approaching home")
        : view.direction === "away"
          ? t("Si sta allontanando da casa", "Moving away from home")
          : t("Distanza da casa", "Distance from home");
    parts.push(
      `<span title="${esc(title)}">🧭 ${esc(distanceLabel(view.distance))}${arrow}</span>`,
    );
  }
  if (view.travel !== null)
    parts.push(
      `<span title="${t("Tempo di rientro", "Time to home")}">⏱ ${view.travel} min</span>`,
    );
  if (!parts.length) return "";
  return `<div class="dm-person-trip">${parts.join("")}</div>`;
}

/* La fascia in fondo alla card: batteria e «da quanto», uno accanto
 * all'altro, divisi da un filetto. Sta in fondo qualunque altezza abbia la
 * card, cosi' una fila di persone ha i piedi allineati. */
function footMarkup(view) {
  const parts = [];
  if (view.battery !== null)
    parts.push(
      `<span class="dm-person-batt${view.batteryLow ? " low" : ""}" title="${view.charging ? t("In carica", "Charging") : ""}">${batteryIcon(view.battery)} ${Math.round(view.battery)}%${view.charging ? '<b class="dm-person-bolt">⚡</b>' : ""}</span>`,
    );
  if (view.watch !== null)
    parts.push(
      `<span class="dm-person-watch${view.watchLow ? " low" : ""}" title="${t("Batteria orologio", "Watch battery")}">⌚ ${Math.round(view.watch)}%</span>`,
    );
  if (view.wifi)
    parts.push(
      `<span class="dm-person-wifi" title="${t("Rete WiFi", "WiFi network")}: ${esc(view.wifi)}">📶 ${esc(view.wifi)}</span>`,
    );
  const ago = elapsedLabel(view.elapsed);
  if (ago) parts.push(`<span class="dm-person-ago">🕐 ${esc(ago)}</span>`);
  if (!parts.length) return "";
  return `<div class="dm-person-foot">${parts.join("")}</div>`;
}

/* La card: il ritratto e chi e' su una riga sola, le letture in un riquadro
 * sotto.
 *
 * Prima era una colonna centrata — ritratto grande, nome, pastiglia, e i dati
 * in una fascia attaccata al bordo. In fila diventava alta e stretta, e il
 * nome finiva lontano dalla faccia. Adesso la faccia e il nome stanno vicini,
 * come su un citofono, e quello che il telefono racconta — la carica, la
 * carica dell'orologio, da quanto non si fa sentire — sta in un riquadro suo,
 * che si legge come un gruppo invece che come una striscia. */
function cardMarkup(view) {
  return `<article class="dm-person-card" data-person-id="${esc(view.id)}" data-presence="${esc(view.presence)}"${view.known ? "" : ' data-unknown="true"'}>
    <div class="dm-person-testa">
      ${portraitMarkup(view)}
      <div class="dm-person-chi">
        <strong class="dm-person-name">${esc(view.name)}</strong>
        <span class="dm-person-zone">${presenceIcon(view)} ${esc(presenceLabel(view))}</span>
      </div>
    </div>
    ${view.address ? `<small class="dm-person-address" title="${esc(view.address)}">${esc(view.address)}</small>` : ""}
    ${tripMarkup(view)}
    ${footMarkup(view)}
  </article>`;
}

/* ── Il popup della persona ────────────────────────────────────────────────
 *
 * La card in Home e' il riassunto; toccarla apre la scheda intera: il
 * ritratto grande con l'anello del colore di presenza, la zona, l'indirizzo
 * con «Apri in mappa», e ogni dato del telefono come mattonella. Non e' una
 * fotografia: finche' e' aperto si ridisegna a ogni cambio di stato, e con
 * piu' persone le frecce passano dall'una all'altra. */

const ACTIVITY_LABELS = Object.freeze({
  automotive: ["In auto", "Driving"],
  cycling: ["In bici", "Cycling"],
  running: ["Di corsa", "Running"],
  walking: ["A piedi", "Walking"],
  still: ["Fermo", "Still"],
});

function popupTile(icon, label, value, extra = "") {
  return `<div class="dm-person-pop-tile${extra}"><span class="dm-person-pop-tile-icon">${icon}</span><span class="dm-person-pop-tile-copy"><small>${esc(label)}</small><b>${value}</b></span></div>`;
}

function popupTiles(view) {
  const tiles = [];
  if (view.battery !== null)
    tiles.push(
      popupTile(
        batteryIcon(view.battery),
        t("Batteria telefono", "Phone battery"),
        `${Math.round(view.battery)}%${view.charging ? ' <i class="dm-person-bolt">⚡</i>' : ""}`,
        view.batteryLow ? " low" : "",
      ),
    );
  if (view.watch !== null)
    tiles.push(popupTile("⌚", t("Batteria orologio", "Watch battery"), `${Math.round(view.watch)}%`, view.watchLow ? " low" : ""));
  if (view.wifi) tiles.push(popupTile("📶", t("Rete WiFi", "WiFi network"), esc(view.wifi)));
  const activity = ACTIVITY_LABELS[view.activity];
  if (activity && view.presence !== "home")
    tiles.push(popupTile(ACTIVITY_EMOJI[view.activity] || "🧍", t("Attività", "Activity"), esc(t(activity[0], activity[1]))));
  if (view.distance) {
    const arrow = view.direction === "towards" ? " →🏠" : view.direction === "away" ? " ←🏠" : "";
    tiles.push(popupTile("🧭", t("Distanza da casa", "Distance from home"), `${esc(distanceLabel(view.distance))}${arrow}`));
  }
  if (view.travel !== null)
    tiles.push(popupTile("⏱", t("Tempo di rientro", "Time to home"), `${view.travel} min`));
  const ago = elapsedLabel(view.elapsed);
  if (ago) tiles.push(popupTile("🕐", t("Ultimo aggiornamento", "Last update"), esc(ago)));
  return tiles.join("");
}

function popupBodyMarkup(view, people) {
  const molte = people.length > 1;
  const mapUrl = view.address
    ? `https://maps.google.com/?q=${encodeURIComponent(view.address)}`
    : "";
  return `
    <button type="button" class="dm-person-pop-close" data-person-pop-close aria-label="${t("Chiudi", "Close")}">✕</button>
    ${molte ? `<button type="button" class="dm-person-pop-nav" data-person-pop-nav="-1" aria-label="${t("Persona precedente", "Previous person")}">‹</button><button type="button" class="dm-person-pop-nav dm-next" data-person-pop-nav="1" aria-label="${t("Persona successiva", "Next person")}">›</button>` : ""}
    <div class="dm-person-pop-hero">
      ${portraitMarkup(view)}
      <strong>${esc(view.name)}</strong>
      <span class="dm-person-zone">${presenceIcon(view)} ${esc(presenceLabel(view))}</span>
      ${view.address ? `<small class="dm-person-pop-address">${esc(view.address)}</small>` : ""}
      ${mapUrl ? `<a class="dm-person-pop-map" href="${esc(mapUrl)}" target="_blank" rel="noopener">🗺 ${t("Apri in mappa", "Open in map")}</a>` : ""}
    </div>
    <div class="dm-person-pop-tiles">${popupTiles(view)}</div>`;
}

function paintPersonPopup() {
  const overlay = doc?.getElementById("dm-person-popup");
  if (!overlay || !state.popupId) return false;
  const people = configuredPeople();
  const person = people.find((entry) => entry.id === state.popupId) || null;
  if (!person) {
    closePersonPopup();
    return false;
  }
  const view = personViewModel(person, allStates(), Date.now());
  const card = overlay.querySelector(".dm-person-pop-card");
  card.dataset.presence = view.presence;
  if (view.known) delete card.dataset.unknown;
  else card.dataset.unknown = "true";
  card.innerHTML = popupBodyMarkup(view, people);
  card.querySelector("[data-person-img]")?.addEventListener(
    "error",
    (event) => event.target.remove(),
    { once: true },
  );
  /* Anche il ritratto grande del popup e' vivo: sarebbe strano che la
   * persona sbatta le ciglia nella card e resti di marmo qui dentro. */
  const ritratto = card.querySelector(".dm-person-avatar[data-ritratto]");
  if (ritratto && person.avatar?.face)
    ritrattoVivo(ritratto, person.avatar.face, view.presence === "home" ? "contento" : "sveglio");
  return true;
}

function closePersonPopup() {
  state.popupId = "";
  const overlay = doc?.getElementById("dm-person-popup");
  if (overlay) {
    overlay.classList.remove("show");
    root.setTimeout?.(() => overlay.remove(), 220);
  }
}

export function openPersonPopup(id) {
  const people = configuredPeople();
  if (!people.some((entry) => entry.id === id)) return false;
  state.popupId = id;
  let overlay = doc.getElementById("dm-person-popup");
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay.id = "dm-person-popup";
    overlay.className = "dm-person-pop-overlay";
    overlay.innerHTML = `<div class="dm-person-pop-card" role="dialog" aria-modal="true"></div>`;
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-person-pop-close]")) {
        closePersonPopup();
        return;
      }
      const nav = event.target.closest("[data-person-pop-nav]");
      if (nav) {
        const people2 = configuredPeople();
        const at = people2.findIndex((entry) => entry.id === state.popupId);
        const next = people2[(at + Number(nav.dataset.personPopNav) + people2.length) % people2.length];
        if (next) {
          state.popupId = next.id;
          paintPersonPopup();
        }
      }
    });
    doc.body.append(overlay);
  }
  paintPersonPopup();
  root.requestAnimationFrame?.(() => overlay.classList.add("show"));
  if (!overlay.classList.contains("show")) overlay.classList.add("show");
  return true;
}

/* La sezione vive tra le pillole di stato e il Quadro Avvisi: e' la prima
 * cosa che si guarda rientrando in casa. Senza persone configurate non lascia
 * ne' titolo ne' vuoto. */
function ensureHost() {
  const page = doc?.getElementById?.("page-home");
  if (!page) return null;
  let host = doc.getElementById("dm-people");
  if (host) return host;
  host = doc.createElement("div");
  host.id = "dm-people";
  host.innerHTML = `<h3 class="section-title dm-people-title">${t("Persone", "People")}</h3><div class="dm-people-grid"></div>`;
  const anchor = doc.getElementById("dashboard-pills-row");
  if (anchor?.parentElement === page) anchor.after(host);
  else page.prepend(host);
  return host;
}

export function renderPeopleSection() {
  const people = configuredPeople();
  if (!people.length) {
    doc?.getElementById?.("dm-people")?.remove();
    return false;
  }
  const host = ensureHost();
  if (!host) return false;
  const states = allStates();
  const now = Date.now();
  const grid = host.querySelector(".dm-people-grid");
  grid.innerHTML = people.map((person) => cardMarkup(personViewModel(person, states, now))).join("");
  host.querySelector(".dm-people-title").textContent = t("Persone", "People");
  /* La foto che non si carica non deve restare come icona rotta sopra
   * l'avatar: sparisce lei e resta lui. */
  grid.querySelectorAll("[data-person-img]").forEach((img) =>
    img.addEventListener("error", () => img.remove(), { once: true }),
  );
  /* I ritratti si compongono e si animano dopo che la card e' comparsa:
   * nessuno aspetta davanti a un buco. L'espressione la decide quello che la
   * plancia sa gia' — chi e' a casa e' contento, chi ha il telefono fermo da
   * ore o la batteria agli sgoccioli ha le palpebre pesanti. */
  fermaRitrattiPersi();
  const perId = new Map(people.map((persona) => [persona.id, persona]));
  for (const host of grid.querySelectorAll(".dm-person-avatar[data-ritratto]")) {
    const card = host.closest("[data-person-id]");
    const persona = perId.get(card?.dataset?.personId);
    if (!persona?.avatar?.face) continue;
    const vista = personViewModel(persona, states, now);
    const stanco =
      (vista.battery !== null && vista.battery <= 15 && !vista.charging) ||
      (vista.elapsed?.unit === "hour" && vista.elapsed.value >= 6) ||
      vista.elapsed?.unit === "day";
    const espressione = stanco ? "assonnato" : vista.presence === "home" ? "contento" : "sveglio";
    ritrattoVivo(host, persona.avatar.face, espressione);
  }
  if (state.popupId) paintPersonPopup();
  return true;
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      renderPeopleSection();
      syncPeopleClock();
    }) || 0;
  if (!state.frame) {
    renderPeopleSection();
    syncPeopleClock();
  }
}

/* «16 ore fa» invecchia anche se non succede niente, e su una plancia a muro
 * nessuno tocca mai la pagina. Il timer segue la disciplina delle telecamere:
 * armato solo con la Home sullo schermo, la scheda visibile e almeno una
 * persona configurata; spento in ogni altro momento. Un minuto basta, perche'
 * i minuti sono l'unita' piu' fine che si mostra. */
const CLOCK_MS = 60000;

function homeVisible() {
  return Boolean(doc?.getElementById?.("page-home")?.classList?.contains("active"));
}

function stopPeopleClock() {
  if (!state.clock) return;
  root.clearInterval?.(state.clock);
  state.clock = 0;
}

export function syncPeopleClock() {
  const wanted = homeVisible() && doc?.visibilityState !== "hidden" && configuredPeople().length > 0;
  if (!wanted) {
    stopPeopleClock();
    return false;
  }
  if (state.clock) return true;
  state.clock =
    root.setInterval?.(() => {
      if (!homeVisible() || doc?.visibilityState === "hidden") {
        stopPeopleClock();
        return;
      }
      renderPeopleSection();
    }, CLOCK_MS) || 0;
  return Boolean(state.clock);
}

function installStyles() {
  /* La faccia respira. Le animazioni stanno qui e non nel modulo che disegna,
   * cosi' l'SVG resta puro; e stanno in un foglio non ancorato a #dm-people,
   * cosi' l'anteprima dell'editor respira con le stesse regole. Il battito di
   * palpebre e' un attimo ogni pochi secondi; chi e' fuori guarda in giro; di
   * chi non si sa niente, la faccia dorme. `dm-face-still` spegne tutto: e'
   * la classe dei campioncini dell'editor, che sono decine. */
  installAvatar3dStyle();
  installStyle(
    "dm-person-face-style",
    `
    .dm-person-avatar .dm-face-svg,.dm-face-thumb .dm-face-svg,.dm-face-preview .dm-face-svg{width:100%;height:100%;display:block}
    .dm-face-svg .f-all{transform-origin:60px 64px;animation:dmFaceBreathe 5.4s ease-in-out infinite}
    .dm-face-svg .f-head{transform-origin:60px 62px;animation:dmFaceTilt 7.6s ease-in-out infinite}
    .dm-face-svg .f-eyes{transform-box:fill-box;transform-origin:center;animation:dmFaceBlink 4.6s linear infinite}
    @keyframes dmFaceBreathe{0%,100%{transform:translateY(0)}50%{transform:translateY(1.5px)}}
    @keyframes dmFaceTilt{0%,100%{transform:rotate(0deg)}32%{transform:rotate(-2.2deg)}68%{transform:rotate(1.8deg)}}
    @keyframes dmFaceBlink{0%,90.5%,100%{transform:scaleY(1)}93%,95%{transform:scaleY(.08)}}
    #dm-people .dm-person-card[data-presence="away"] .f-eyes{animation:dmFaceLook 7.5s ease-in-out infinite}
    @keyframes dmFaceLook{0%,50%,100%{transform:translateX(0) scaleY(1)}10%,26%{transform:translateX(2.6px)}32%,34%{transform:translateX(2.6px) scaleY(.08)}62%,84%{transform:translateX(-2.4px)}}
    #dm-people .dm-person-card[data-unknown="true"] .f-eyes{animation:none;transform:scaleY(.1)}
    .dm-face-still .f-all,.dm-face-still .f-head,.dm-face-still .f-eyes{animation:none!important}
    `,
  );
  installStyle(
    "dm-people-style",
    `
    #dm-people .dm-people-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(224px,1fr));gap:14px}
    #dm-people .dm-person-card{--dm-presence:148,163,184;position:relative;display:flex;flex-direction:column;align-items:stretch;gap:0;padding:14px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e8edf3);border-radius:24px;box-shadow:var(--shadow-sculpted,0 4px 14px rgba(15,23,42,.08));transition:var(--transition,.3s);overflow:hidden}
    /* Il ritratto e chi e', su una riga: la faccia e il nome vicini. */
    #dm-people .dm-person-testa{display:flex;align-items:center;gap:13px;min-width:0}
    /* La colonna prende quello che resta della riga: senza, la pastiglia della
       zona si stringe sul nome — «Andrea» corto, e «Atos» diventava «…». */
    #dm-people .dm-person-chi{flex:1 1 auto;display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-width:0;max-width:100%}
    /* L'alone del colore di presenza, morbido dietro al ritratto: e' lui a
     * dire da lontano chi e' a casa e chi no, prima ancora di leggere. */
    #dm-people .dm-person-card::before{content:"";position:absolute;top:-56px;left:-40px;width:190px;height:160px;background:radial-gradient(closest-side,rgba(var(--dm-presence),.22),transparent 72%);pointer-events:none}
    #dm-people .dm-person-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-hover,0 10px 25px rgba(15,23,42,.14));border-color:rgba(var(--dm-presence),.35)}
    #dm-people .dm-person-card[data-presence="home"]{--dm-presence:22,163,74}
    #dm-people .dm-person-card[data-presence="zone"]{--dm-presence:14,165,233}
    #dm-people .dm-person-card[data-unknown="true"] .dm-person-portrait,#dm-people .dm-person-card[data-unknown="true"] .dm-person-name{opacity:.65;filter:saturate(.4)}
    #dm-people .dm-person-portrait{position:relative;width:64px;height:64px;flex:0 0 auto}
    /* L'anello e' un gradiente conico del colore di presenza, ritagliato a
     * corona con una maschera: piu' vivo di un bordo piatto, e la luce colorata
     * sotto al ritratto lo stacca dalla card. */
    #dm-people .dm-person-portrait::before{content:"";position:absolute;inset:-7px;border-radius:50%;background:conic-gradient(from 215deg,rgb(var(--dm-presence)),color-mix(in srgb,rgb(var(--dm-presence)) 25%,var(--card-bg,#fff)) 52%,rgb(var(--dm-presence)));-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 4px),#000 calc(100% - 3.4px));mask:radial-gradient(farthest-side,#0000 calc(100% - 4px),#000 calc(100% - 3.4px))}
    #dm-people .dm-person-photo,#dm-people .dm-person-avatar{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover;box-shadow:0 12px 26px -12px rgba(var(--dm-presence),.75)}
    #dm-people .dm-person-avatar{display:grid;place-items:center;font-size:31px;background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--dm-person-color,#0ea5e9) 10%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-person-color,#0ea5e9) 30%,var(--card-bg,#fff)));color:var(--dm-person-color,#0ea5e9)}
    #dm-people .dm-person-avatar b{font-size:22px;font-weight:900;letter-spacing:.5px;text-shadow:0 1px 0 color-mix(in srgb,#fff 55%,transparent)}
    #dm-people .dm-person-dot{position:absolute;right:0;bottom:0;width:15px;height:15px;border-radius:50%;background:rgb(var(--dm-presence));border:3px solid var(--card-bg,#fff);z-index:1;box-shadow:0 2px 6px rgba(var(--dm-presence),.5)}
    /* Quando la persona si muove il pallino diventa il badge dell'attivita':
     * l'auto, la bici, i passi. Fermo, torna un pallino. */
    #dm-people .dm-person-dot[data-activity]{width:23px;height:23px;right:-3px;bottom:-2px;display:grid;place-items:center;font-size:12px;font-style:normal;background:var(--card-bg,#fff);border:2.5px solid rgb(var(--dm-presence))}
    #dm-people .dm-person-name{font-size:16px;font-weight:900;letter-spacing:-.3px;color:var(--text,#0f172a);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* La zona e' una pastiglia piena del colore di presenza: la cosa piu'
     * importante della card, vestita come tale. Di un ignoto non si colora
     * niente: la pastiglia resta un contorno tratteggiato. */
    #dm-people .dm-person-zone{font-size:11px;font-weight:900;letter-spacing:.3px;color:#fff;background:linear-gradient(135deg,rgb(var(--dm-presence)),color-mix(in srgb,rgb(var(--dm-presence)) 72%,#0f172a));border-radius:999px;padding:4px 13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 5px 12px -5px rgba(var(--dm-presence),.7)}
    #dm-people .dm-person-card[data-unknown="true"] .dm-person-zone{background:transparent;color:var(--text-dim,#64748b);border:1px dashed rgba(148,163,184,.6);box-shadow:none}
    /* Dove si trova, scritto per esteso: la via sotto la zona, in piccolo. */
    #dm-people .dm-person-address{margin-top:10px;font-size:10.5px;font-weight:750;color:var(--text-dim,#64748b);max-width:calc(100% - 10px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* Il viaggio: distanza (con la freccia della direzione) e tempo di
     * rientro, come pastiglie leggere del colore di presenza. */
    #dm-people .dm-person-trip{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:6px;margin-top:10px;max-width:100%}
    #dm-people .dm-person-trip>span{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:900;font-variant-numeric:tabular-nums;padding:3px 10px;border-radius:999px;color:rgb(var(--dm-presence));background:rgba(var(--dm-presence),.1);border:1px solid rgba(var(--dm-presence),.25);white-space:nowrap}
    /* La fascia sta in fondo qualunque altezza abbia la card: una fila di
     * persone ha i piedi allineati anche quando una sola ha il viaggio. */
    /* Le letture in un riquadro loro, staccato dai bordi: si leggono come un
       gruppo invece che come una striscia attaccata al fondo. Resta in fondo
       qualunque altezza abbia la card, cosi' una fila di persone ha i piedi
       allineati anche quando una sola ha il viaggio. */
    #dm-people .dm-person-foot{width:100%;margin-top:auto;padding:9px 10px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 14px;border-radius:15px;border:1px solid color-mix(in srgb,rgb(var(--dm-presence)) 12%,var(--card-border,#e8edf3));background:color-mix(in srgb,rgb(var(--dm-presence)) 5%,var(--surface-2,#f8fafc))}
    #dm-people .dm-person-card>.dm-person-testa:not(:last-child){margin-bottom:12px}
    #dm-people .dm-person-card>.dm-person-address+.dm-person-foot,
    #dm-people .dm-person-card>.dm-person-trip+.dm-person-foot{margin-top:12px}
    #dm-people .dm-person-foot>*{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:850;font-variant-numeric:tabular-nums;color:var(--text-dim,#64748b);white-space:nowrap;max-width:100%}
    #dm-people .dm-person-batt.low,#dm-people .dm-person-watch.low{color:#dc2626}
    #dm-people .dm-person-bolt{font-size:10px;font-style:normal;color:#f59e0b;margin-left:1px;animation:dmPersonBolt 2.2s ease-in-out infinite}
    @keyframes dmPersonBolt{0%,100%{opacity:1}50%{opacity:.35}}
    #dm-people .dm-person-wifi{max-width:112px;overflow:hidden}
    #dm-people .dm-person-wifi,#dm-people .dm-person-ago{text-overflow:ellipsis}
    #dm-people .dm-person-card{cursor:pointer}
    /* Sotto i 480 le colonne diventano una: due card affiancate a questa
       larghezza spezzerebbero la riga del ritratto e del nome, che e' proprio
       quello che questa card vuole tenere insieme. */
    @media(max-width:480px){#dm-people .dm-people-grid{grid-template-columns:1fr;gap:10px}#dm-people .dm-person-card{padding:13px;border-radius:22px}#dm-people .dm-person-portrait{width:58px;height:58px}#dm-people .dm-person-avatar{font-size:28px}#dm-people .dm-person-avatar b{font-size:20px}#dm-people .dm-person-name{font-size:15px}}

    /* Il popup: overlay sfumato, card che sale, e dentro le stesse classi
     * della card cosi' ritratto, anello e pastiglia vestono uguale. */
    .dm-person-pop-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:18px;background:rgba(9,14,24,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .22s ease}
    .dm-person-pop-overlay.show{opacity:1;pointer-events:auto}
    .dm-person-pop-card{--dm-presence:148,163,184;position:relative;width:min(420px,100%);max-height:88dvh;overflow:auto;padding:30px 22px 22px;border-radius:30px;border:1px solid color-mix(in srgb,rgb(var(--dm-presence)) 30%,var(--card-border,#e8edf3));background:radial-gradient(140% 90% at 50% -10%,rgba(var(--dm-presence),.16),transparent 55%),var(--card-bg,#fff);box-shadow:0 30px 70px -30px rgba(9,14,24,.8);transform:translateY(18px) scale(.97);transition:transform .24s cubic-bezier(.2,.9,.3,1.2)}
    .dm-person-pop-overlay.show .dm-person-pop-card{transform:translateY(0) scale(1)}
    .dm-person-pop-card[data-presence="home"]{--dm-presence:22,163,74}
    .dm-person-pop-card[data-presence="zone"]{--dm-presence:14,165,233}
    .dm-person-pop-close{position:absolute;top:12px;right:12px;z-index:2;width:36px;height:36px;border-radius:50%;border:1px solid var(--card-border,#e8edf3);background:var(--card-bg,#fff);color:var(--text-dim,#64748b);font-size:15px;font-weight:900;cursor:pointer}
    .dm-person-pop-nav{position:absolute;top:96px;z-index:2;width:38px;height:38px;left:10px;border-radius:50%;border:1px solid rgba(var(--dm-presence),.35);background:color-mix(in srgb,rgb(var(--dm-presence)) 8%,var(--card-bg,#fff));color:rgb(var(--dm-presence));font-size:22px;font-weight:900;line-height:1;cursor:pointer}
    .dm-person-pop-nav.dm-next{left:auto;right:10px}
    .dm-person-pop-hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:0}
    .dm-person-pop-hero .dm-person-portrait{position:relative;width:118px;height:118px;margin-bottom:14px}
    .dm-person-pop-hero .dm-person-portrait::before{content:"";position:absolute;inset:-8px;border-radius:50%;background:conic-gradient(from 215deg,rgb(var(--dm-presence)),color-mix(in srgb,rgb(var(--dm-presence)) 25%,var(--card-bg,#fff)) 52%,rgb(var(--dm-presence)));-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 5px),#000 calc(100% - 4.2px));mask:radial-gradient(farthest-side,#0000 calc(100% - 5px),#000 calc(100% - 4.2px))}
    .dm-person-pop-hero .dm-person-photo,.dm-person-pop-hero .dm-person-avatar{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover}
    .dm-person-pop-hero .dm-person-avatar{display:grid;place-items:center;font-size:56px;background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--dm-person-color,#0ea5e9) 10%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-person-color,#0ea5e9) 30%,var(--card-bg,#fff)));color:var(--dm-person-color,#0ea5e9)}
    .dm-person-pop-hero .dm-person-avatar b{font-size:40px;font-weight:900}
    .dm-person-pop-hero .dm-person-dot{position:absolute;right:4px;bottom:4px;width:22px;height:22px;border-radius:50%;background:rgb(var(--dm-presence));border:3.5px solid var(--card-bg,#fff)}
    .dm-person-pop-hero .dm-person-dot[data-activity]{width:32px;height:32px;right:-2px;bottom:0;display:grid;place-items:center;font-size:16px;font-style:normal;background:var(--card-bg,#fff);border:3px solid rgb(var(--dm-presence))}
    .dm-person-pop-hero strong{font-size:21px;font-weight:900;letter-spacing:-.4px;color:var(--text,#0f172a)}
    .dm-person-pop-hero .dm-person-zone{margin-top:8px;font-size:12px;font-weight:900;color:#fff;background:linear-gradient(135deg,rgb(var(--dm-presence)),color-mix(in srgb,rgb(var(--dm-presence)) 72%,#0f172a));border-radius:999px;padding:5px 16px;box-shadow:0 6px 14px -6px rgba(var(--dm-presence),.7)}
    .dm-person-pop-card[data-unknown="true"] .dm-person-zone{background:transparent;color:var(--text-dim,#64748b);border:1px dashed rgba(148,163,184,.6);box-shadow:none}
    .dm-person-pop-address{margin-top:9px;font-size:12px;font-weight:700;color:var(--text-dim,#64748b);line-height:1.4;max-width:100%}
    .dm-person-pop-map{margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;border:1px solid rgba(var(--dm-presence),.35);background:rgba(var(--dm-presence),.1);color:rgb(var(--dm-presence));font-size:12px;font-weight:900;text-decoration:none}
    .dm-person-pop-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:18px}
    .dm-person-pop-tile{display:flex;align-items:center;gap:10px;min-width:0;padding:11px 12px;border-radius:16px;border:1px solid color-mix(in srgb,rgb(var(--dm-presence)) 14%,var(--card-border,#e8edf3));background:color-mix(in srgb,rgb(var(--dm-presence)) 4%,var(--card-bg,#fff))}
    .dm-person-pop-tile-icon{flex:0 0 auto;font-size:19px;line-height:1}
    .dm-person-pop-tile-copy{display:grid;gap:1px;min-width:0}
    .dm-person-pop-tile-copy small{font-size:8.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--text-dim,#94a3b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dm-person-pop-tile-copy b{font-size:13.5px;font-weight:900;font-variant-numeric:tabular-nums;color:var(--text,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dm-person-pop-tile.low .dm-person-pop-tile-copy b{color:#dc2626}
    @media(prefers-reduced-motion:reduce){.dm-person-pop-overlay,.dm-person-pop-card{transition:none}}
    `,
  );
}

export function installPeopleSection() {
  if (!doc) return false;
  installStyles();
  renderPeopleSection();
  if (!state.listeners) {
    state.listeners = true;
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:states-ready",
      "dashboardmodern:state-changed",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:config-reset",
    ])
      root.addEventListener?.(eventName, schedule);
    doc.addEventListener(
      "click",
      (event) => {
        if (event.target?.closest?.(".tab[data-tab]")) schedule();
        const card = event.target?.closest?.("#dm-people .dm-person-card[data-person-id]");
        if (card) openPersonPopup(card.dataset.personId);
      },
      true,
    );
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.popupId) closePersonPopup();
    });
    doc.addEventListener("visibilitychange", () => schedule());
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installPeopleSection, { once: true });
else installPeopleSection();
