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
import { allStates, clean, doc, esc, installStyle, readJson, root, t } from "./shared.js";

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
  return `<span class="dm-person-portrait">${avatar}${photo}<i class="dm-person-dot" aria-hidden="true"></i></span>`;
}

function cardMarkup(view) {
  const battery = view.battery === null
    ? ""
    : `<span class="dm-person-batt${view.batteryLow ? " low" : ""}">${batteryIcon(view.battery)} ${Math.round(view.battery)}%</span>`;
  const ago = elapsedLabel(view.elapsed);
  return `<article class="dm-person-card" data-person-id="${esc(view.id)}" data-presence="${esc(view.presence)}"${view.known ? "" : ' data-unknown="true"'}>
    ${battery}
    ${portraitMarkup(view)}
    <strong class="dm-person-name">${esc(view.name)}</strong>
    <span class="dm-person-zone">${presenceIcon(view)} ${esc(presenceLabel(view))}</span>
    ${ago ? `<small class="dm-person-ago">${esc(ago)}</small>` : ""}
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
    #dm-people .dm-people-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
    #dm-people .dm-person-card{--dm-presence:148,163,184;position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;padding:22px 12px 16px;background:var(--card-bg,#fff);border:1px solid var(--card-border,#e8edf3);border-radius:28px;box-shadow:var(--shadow-sculpted,0 4px 14px rgba(15,23,42,.08));transition:var(--transition,.3s);overflow:hidden}
    #dm-people .dm-person-card::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,rgba(var(--dm-presence),.14) 0%,transparent 62%);pointer-events:none}
    #dm-people .dm-person-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-hover,0 10px 25px rgba(15,23,42,.14))}
    #dm-people .dm-person-card[data-presence="home"]{--dm-presence:22,163,74}
    #dm-people .dm-person-card[data-presence="zone"]{--dm-presence:14,165,233}
    #dm-people .dm-person-card[data-unknown="true"]{opacity:.72}
    #dm-people .dm-person-batt{position:absolute;top:10px;right:12px;z-index:1;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums;color:var(--text-dim,#64748b);background:rgba(148,163,184,.14);border-radius:999px;padding:3px 8px}
    #dm-people .dm-person-batt.low{color:#dc2626;background:rgba(220,38,38,.12)}
    #dm-people .dm-person-portrait{position:relative;width:86px;height:86px;flex:0 0 auto}
    #dm-people .dm-person-portrait::before{content:"";position:absolute;inset:-5px;border-radius:50%;border:3px solid rgb(var(--dm-presence));opacity:.85}
    #dm-people .dm-person-photo,#dm-people .dm-person-avatar{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover}
    #dm-people .dm-person-avatar{display:grid;place-items:center;font-size:40px;background:color-mix(in srgb,var(--dm-person-color,#0ea5e9) 18%,var(--card-bg,#fff));color:var(--dm-person-color,#0ea5e9)}
    #dm-people .dm-person-avatar b{font-size:30px;font-weight:900;letter-spacing:.5px}
    #dm-people .dm-person-dot{position:absolute;right:1px;bottom:1px;width:16px;height:16px;border-radius:50%;background:rgb(var(--dm-presence));border:3px solid var(--card-bg,#fff);z-index:1}
    #dm-people .dm-person-name{font-size:14.5px;font-weight:900;letter-spacing:-.2px;color:var(--text,#0f172a);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px}
    #dm-people .dm-person-zone{font-size:11.5px;font-weight:850;color:rgb(var(--dm-presence));background:rgba(var(--dm-presence),.12);border-radius:999px;padding:3px 10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #dm-people .dm-person-ago{font-size:10.5px;font-weight:750;color:var(--text-dim,#64748b)}
    @media(max-width:480px){#dm-people .dm-people-grid{grid-template-columns:repeat(2,1fr);gap:10px}#dm-people .dm-person-card{padding:18px 8px 13px;border-radius:22px}#dm-people .dm-person-portrait{width:72px;height:72px}#dm-people .dm-person-avatar{font-size:33px}#dm-people .dm-person-avatar b{font-size:25px}}
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
