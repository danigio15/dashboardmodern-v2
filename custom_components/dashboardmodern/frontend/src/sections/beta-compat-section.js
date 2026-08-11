import { doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA_COMPAT__";
const state = (root[KEY] ||= { installed: false });

const ROOM_PICKER = Object.freeze([
  ["🏠", "casa home ingresso entrance"],
  ["🛏️", "camera bedroom letto bed matrimoniale"],
  ["🛋️", "salone soggiorno living lounge sofa"],
  ["🍳", "cucina kitchen cook stove"],
  ["🛁", "bagno bathroom bath doccia shower"],
  ["💻", "studio office ufficio smartworking"],
  ["🚗", "garage box auto car"],
  ["🌇", "balcone terrazza balcony terrace"],
  ["🧺", "lavanderia laundry washing"],
  ["🧸", "cameretta bambini kids child nursery"],
  ["🍽️", "sala pranzo dining table"],
  ["🚪", "corridoio disimpegno hallway corridor"],
  ["👗", "cabina armadio guardaroba wardrobe closet"],
  ["📦", "ripostiglio dispensa storage pantry"],
  ["🍷", "cantina cellar wine"],
  ["🏡", "mansarda soffitta attic loft"],
  ["🌳", "giardino garden yard"],
  ["🏊", "piscina pool"],
  ["🛠️", "locale tecnico utility tools server"],
]);

function closeCanonicalRoomPicker() {
  doc.getElementById("dm-icon-picker")?.remove();
}

function openCanonicalRoomPicker(input) {
  if (!input) return;
  closeCanonicalRoomPicker();
  const english = doc.documentElement.lang === "en";
  const modal = doc.createElement("div");
  modal.id = "dm-icon-picker";
  modal.className = "dm-section-modal";
  modal.innerHTML = `<section class="dm-section-dialog" role="dialog" aria-modal="true"><header><strong>🎨 ${english ? "Choose room icon" : "Scegli icona stanza"}</strong><button type="button" data-close aria-label="${english ? "Close icon picker" : "Chiudi selettore icone"}">✕</button></header><div style="padding:14px 18px 6px"><input id="dm-icon-search" class="ed-input" type="search" placeholder="🔎 ${english ? "Search…" : "Cerca…"}"></div><div id="dm-icon-grid" class="dm-beta-room-grid">${ROOM_PICKER.map(([icon, keywords]) => `<button type="button" data-icon="${icon}" data-keywords="${keywords}">${icon}</button>`).join("")}</div></section>`;
  doc.body.append(modal);
  const close = () => modal.remove();
  modal.querySelector("[data-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  modal.querySelector("#dm-icon-search")?.addEventListener("input", (event) => {
    const query = String(event.target.value || "").trim().toLowerCase();
    modal.querySelectorAll("#dm-icon-grid button").forEach((button) => {
      button.hidden = Boolean(query) && !String(button.dataset.keywords || "").includes(query);
    });
  });
  modal.querySelectorAll("#dm-icon-grid button").forEach((button) => button.addEventListener("click", () => {
    input.value = button.dataset.icon || "🏠";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }));
  root.setTimeout?.(() => modal.querySelector("#dm-icon-search")?.focus(), 20);
}

function install() {
  if (!doc || state.installed) return;
  state.installed = true;

  // The legacy KPI updater still reads this historical global flag. v1 beta
  // does not fabricate estimated Overview history, so the safe value is false.
  if (typeof root.consStimato === "undefined") root.consStimato = false;

  // Preserve the long-standing Rooms/Temperature picker contract while the
  // richer SVG catalog is used by the dedicated room edit modal.
  doc.addEventListener("click", (event) => {
    const button = event.target?.closest?.(
      '.dm-icon-picker[data-icon-category="rooms"],.dm-icon-picker[data-dm-room-catalog="true"],button[title="Selettore icone"],button[title="Icon picker"],button[onclick*="dmIconPicker"]',
    );
    if (!button) return;
    const targetId = button.dataset.iconTarget || button.closest(".dm-icon-field")?.querySelector("input")?.id || button.previousElementSibling?.id;
    const input = targetId ? doc.getElementById(targetId) : button.previousElementSibling;
    if (!(input instanceof HTMLInputElement)) return;
    const category = button.dataset.iconCategory || input.dataset.iconCategory || "";
    const looksLikeRoom = category === "rooms" || /room|stanza|icon/i.test(input.id || "") || button.title === "Selettore icone" || button.title === "Icon picker";
    if (!looksLikeRoom) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openCanonicalRoomPicker(input);
  }, true);

  const style = doc.createElement("style");
  style.id = "dm-beta-room-picker-style";
  style.textContent = `.dm-beta-room-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:10px;padding:12px 18px 20px;max-height:55vh;overflow:auto}.dm-beta-room-grid button{min-height:62px;border:1px solid var(--divider-color,#dbe4ee);border-radius:15px;background:var(--card-background-color,#fff);font-size:28px;cursor:pointer}.dm-beta-room-grid button:hover{border-color:var(--primary-color,#0ea5e9);transform:translateY(-1px)}.dm-beta-room-grid button[hidden]{display:none!important}#ed-body:has(>[data-ev-appearance]){display:flex!important;flex-direction:column!important}#ed-body:has(>[data-ev-appearance])>[data-ev-appearance]{order:-10000!important}`;
  doc.head?.append(style);
}

install();