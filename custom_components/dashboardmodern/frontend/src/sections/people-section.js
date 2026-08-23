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
  const avatar = `<span class="dm-person-avatar" style="--dm-person-color:${esc(view.avatar.color)}">${
    view.avatar.emoji ? esc(view.avatar.emoji) : `<b>${esc(view.initials)}</b>`
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

function cardMarkup(view) {
  return `<article class="dm-person-card" data-person-id="${esc(view.id)}" data-presence="${esc(view.presence)}"${view.known ? "" : ' data-unknown="true"'}>
    ${portraitMarkup(view)}
    <strong class="dm-person-name">${esc(view.name)}</strong>
    <span class="dm-person-zone">${presenceIcon(view)} ${esc(presenceLabel(view))}</span>
    ${view.address ? `<small class="dm-person-address" title="${esc(view.address)}">${esc(view.address)}</small>` : ""}
    ${tripMarkup(view)}
    ${footMarkup(view)}
  </article>`;
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
  installStyle(
    "dm-people-style",
    `
    #dm-people .dm-people-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
    #dm-people .dm-person-card{--dm-presence:148,163,184;position:relative;display:flex;flex-direction:column;align-items:center;gap:0;padding:26px 14px 0;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e8edf3);border-radius:26px;box-shadow:var(--shadow-sculpted,0 4px 14px rgba(15,23,42,.08));transition:var(--transition,.3s);overflow:hidden}
    /* L'alone del colore di presenza, morbido dietro al ritratto: e' lui a
     * dire da lontano chi e' a casa e chi no, prima ancora di leggere. */
    #dm-people .dm-person-card::before{content:"";position:absolute;top:-52px;left:50%;transform:translateX(-50%);width:170%;height:150px;background:radial-gradient(closest-side,rgba(var(--dm-presence),.22),transparent 72%);pointer-events:none}
    #dm-people .dm-person-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-hover,0 10px 25px rgba(15,23,42,.14));border-color:rgba(var(--dm-presence),.35)}
    #dm-people .dm-person-card[data-presence="home"]{--dm-presence:22,163,74}
    #dm-people .dm-person-card[data-presence="zone"]{--dm-presence:14,165,233}
    #dm-people .dm-person-card[data-unknown="true"] .dm-person-portrait,#dm-people .dm-person-card[data-unknown="true"] .dm-person-name{opacity:.65;filter:saturate(.4)}
    #dm-people .dm-person-portrait{position:relative;width:92px;height:92px;flex:0 0 auto;margin-bottom:12px}
    /* L'anello e' un gradiente conico del colore di presenza, ritagliato a
     * corona con una maschera: piu' vivo di un bordo piatto, e la luce colorata
     * sotto al ritratto lo stacca dalla card. */
    #dm-people .dm-person-portrait::before{content:"";position:absolute;inset:-7px;border-radius:50%;background:conic-gradient(from 215deg,rgb(var(--dm-presence)),color-mix(in srgb,rgb(var(--dm-presence)) 25%,var(--card-bg,#fff)) 52%,rgb(var(--dm-presence)));-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 4px),#000 calc(100% - 3.4px));mask:radial-gradient(farthest-side,#0000 calc(100% - 4px),#000 calc(100% - 3.4px))}
    #dm-people .dm-person-photo,#dm-people .dm-person-avatar{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover;box-shadow:0 12px 26px -12px rgba(var(--dm-presence),.75)}
    #dm-people .dm-person-avatar{display:grid;place-items:center;font-size:44px;background:radial-gradient(circle at 32% 26%,color-mix(in srgb,var(--dm-person-color,#0ea5e9) 10%,var(--card-bg,#fff)),color-mix(in srgb,var(--dm-person-color,#0ea5e9) 30%,var(--card-bg,#fff)));color:var(--dm-person-color,#0ea5e9)}
    #dm-people .dm-person-avatar b{font-size:31px;font-weight:900;letter-spacing:.5px;text-shadow:0 1px 0 color-mix(in srgb,#fff 55%,transparent)}
    #dm-people .dm-person-dot{position:absolute;right:2px;bottom:2px;width:18px;height:18px;border-radius:50%;background:rgb(var(--dm-presence));border:3px solid var(--card-bg,#fff);z-index:1;box-shadow:0 2px 6px rgba(var(--dm-presence),.5)}
    /* Quando la persona si muove il pallino diventa il badge dell'attivita':
     * l'auto, la bici, i passi. Fermo, torna un pallino. */
    #dm-people .dm-person-dot[data-activity]{width:26px;height:26px;right:-3px;bottom:-1px;display:grid;place-items:center;font-size:13px;font-style:normal;background:var(--card-bg,#fff);border:2.5px solid rgb(var(--dm-presence))}
    #dm-people .dm-person-name{font-size:15.5px;font-weight:900;letter-spacing:-.3px;color:var(--text,#0f172a);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* La zona e' una pastiglia piena del colore di presenza: la cosa piu'
     * importante della card, vestita come tale. Di un ignoto non si colora
     * niente: la pastiglia resta un contorno tratteggiato. */
    #dm-people .dm-person-zone{margin-top:7px;font-size:11px;font-weight:900;letter-spacing:.3px;color:#fff;background:linear-gradient(135deg,rgb(var(--dm-presence)),color-mix(in srgb,rgb(var(--dm-presence)) 72%,#0f172a));border-radius:999px;padding:4px 13px;max-width:calc(100% - 8px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 5px 12px -5px rgba(var(--dm-presence),.7)}
    #dm-people .dm-person-card[data-unknown="true"] .dm-person-zone{background:transparent;color:var(--text-dim,#64748b);border:1px dashed rgba(148,163,184,.6);box-shadow:none}
    /* Dove si trova, scritto per esteso: la via sotto la zona, in piccolo. */
    #dm-people .dm-person-address{margin-top:7px;font-size:10.5px;font-weight:750;color:var(--text-dim,#64748b);max-width:calc(100% - 10px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    /* Il viaggio: distanza (con la freccia della direzione) e tempo di
     * rientro, come pastiglie leggere del colore di presenza. */
    #dm-people .dm-person-trip{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:9px;max-width:100%}
    #dm-people .dm-person-trip>span{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:900;font-variant-numeric:tabular-nums;padding:3px 10px;border-radius:999px;color:rgb(var(--dm-presence));background:rgba(var(--dm-presence),.1);border:1px solid rgba(var(--dm-presence),.25);white-space:nowrap}
    /* La fascia sta in fondo qualunque altezza abbia la card: una fila di
     * persone ha i piedi allineati anche quando una sola ha il viaggio. */
    #dm-people .dm-person-foot{width:100%;margin-top:auto;padding:8px 8px 9px;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:3px 13px;border-top:1px solid color-mix(in srgb,rgb(var(--dm-presence)) 14%,var(--card-border,#e8edf3));background:color-mix(in srgb,rgb(var(--dm-presence)) 4%,transparent)}
    #dm-people .dm-person-card> :nth-last-child(2){margin-bottom:14px}
    #dm-people .dm-person-card:not(:has(.dm-person-foot)){padding-bottom:20px}
    #dm-people .dm-person-foot>*{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:850;font-variant-numeric:tabular-nums;color:var(--text-dim,#64748b);white-space:nowrap;max-width:100%}
    #dm-people .dm-person-batt.low,#dm-people .dm-person-watch.low{color:#dc2626}
    #dm-people .dm-person-bolt{font-size:10px;font-style:normal;color:#f59e0b;margin-left:1px;animation:dmPersonBolt 2.2s ease-in-out infinite}
    @keyframes dmPersonBolt{0%,100%{opacity:1}50%{opacity:.35}}
    #dm-people .dm-person-wifi{max-width:112px;overflow:hidden}
    #dm-people .dm-person-wifi,#dm-people .dm-person-ago{text-overflow:ellipsis}
    @media(max-width:480px){#dm-people .dm-people-grid{grid-template-columns:repeat(2,1fr);gap:10px}#dm-people .dm-person-card{padding:20px 10px 0;border-radius:22px}#dm-people .dm-person-portrait{width:78px;height:78px;margin-bottom:10px}#dm-people .dm-person-avatar{font-size:36px}#dm-people .dm-person-avatar b{font-size:26px}#dm-people .dm-person-name{font-size:14px}#dm-people .dm-person-foot{margin-top:12px}}
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
      },
      true,
    );
    doc.addEventListener("visibilitychange", () => schedule());
  }
  state.installed = true;
  return true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installPeopleSection, { once: true });
else installPeopleSection();
