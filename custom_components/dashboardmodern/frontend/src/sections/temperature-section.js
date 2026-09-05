// DM-FIX-20260815A
import { directEmoji, roomGlyph } from "../core/personalization-catalog.js";
import { temperatureEntries } from "../core/room-overview.js";
import {
  allStates,
  applyTemperatureReading,
  clean,
  comfortBadgeText,
  dashboardStore,
  doc,
  english,
  installStyle,
  root,
  section,
  t,
  temperatureCardLabels,
} from "./shared.js";

root.__DM_20260815C__ = true;
const KEY = "__DASHBOARDMODERN_TEMPERATURE_SECTION__";
const state = (root[KEY] ||= {
  installed: false,
  listeners: false,
  storeUnsubscribe: null,
  signature: "",
});
root.__DM_FIX_20260815A__ = true;

function glyph(icon) {
  return directEmoji(icon) || roomGlyph(icon);
}

function rooms() {
  const values = section("rooms", []);
  return Array.isArray(values) ? values : [];
}

/* Una voce per SONDA, non per stanza.
 *
 * «Se nella stessa stanza metto più rilevatori di temperature ne fa vedere
 * solo uno»: le associazioni oltre la prima esistono gia' — vivono in
 * `metadata.temperature_entries`, e il trend e la pagina Stanze le usano — ma
 * questa pagina leggeva solo `room.temp`, la prima coppia. Qui si appiattisce:
 * ogni associazione con un sensore di temperatura diventa una card sua, e
 * `quante` dice se il titolo deve distinguere le sorelle. */
function roomEntries() {
  const voci = [];
  for (const room of rooms()) {
    const entries = temperatureEntries(room).filter((entry) => clean(entry.temp));
    for (const entry of entries) voci.push({ room, entry, quante: entries.length });
  }
  return voci;
}

function eventEntityIds(event) {
  const values = event?.detail?.entity_ids || [event?.detail?.entity_id];
  return new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean));
}

function temperatureEntityIds() {
  const ids = new Set();
  roomEntries().forEach((voce) => {
    const temperature = clean(voce.entry.temp);
    const humidity = entryHumidity(voce.entry);
    if (temperature) ids.add(temperature);
    if (humidity) ids.add(humidity);
  });
  return ids;
}

export function stateChangeAffectsTemperature(event) {
  const changed = eventEntityIds(event);
  if (!changed.size) return false;
  const configured = temperatureEntityIds();
  return [...changed].some((id) => configured.has(id));
}

function exactState(entity) {
  return allStates()[clean(entity)] || null;
}

function numericState(entity) {
  const value = Number.parseFloat(exactState(entity)?.state);
  return Number.isFinite(value) ? value : null;
}

function comfortLabel(temperature) {
  if (temperature == null) return t("Non disponibile", "Unavailable");
  if (temperature < 18) return t("Freddo", "Cold");
  if (temperature > 26) return t("Caldo", "Hot");
  return "Comfort";
}

function safeId(entity) {
  return clean(entity).replace(/[.\-]/g, "_");
}

function entryHumidity(entry) {
  const scelta = clean(entry?.hum);
  if (scelta) return scelta;
  /* Senza entita' scelta si prova la gemella per nome. Ma solo se il nome
   * cambia davvero: su un id senza «_temperature» il replace restituiva lo
   * STESSO id, e la card mostrava la temperatura una seconda volta col «%»
   * addosso (#242). Un'umidita' non configurata e non indovinabile e' vuota,
   * e la card non ne parla. */
  const temp = clean(entry?.temp);
  const indovinata = temp.replace("_temperature", "_humidity");
  return indovinata !== temp ? indovinata : "";
}

/* Il titolo della card: la stanza, e — quando le sonde sono piu' d'una — quale
 * sonda, perche' due card entrambe «Salone» non si distinguono. */
function cardTitle(voce) {
  const base = clean(voce.room.name) || t("Stanza", "Room");
  if (voce.quante <= 1) return base;
  const nome =
    clean(voce.entry.name) || clean(exactState(voce.entry.temp)?.attributes?.friendly_name);
  // «Cameretta · Cameretta» non distingue niente: il suffisso serve solo
  // quando dice qualcosa in piu' della stanza.
  if (!nome || nome.toLowerCase() === base.toLowerCase()) return base;
  return `${base} · ${nome}`;
}

function cardSignature(values = roomEntries()) {
  return values
    .map((voce) =>
      [
        clean(voce.room.id),
        clean(voce.entry.id),
        clean(voce.room.name),
        clean(voce.entry.name),
        clean(voce.room.icon),
        clean(voce.room.floor),
        clean(voce.entry.temp),
        entryHumidity(voce.entry),
      ].join("|"),
    )
    .join(";");
}

function makeText(className, value) {
  const node = doc.createElement("span");
  node.className = className;
  node.textContent = value;
  return node;
}

function openHistory(event, entity, name) {
  if (!entity) return;
  root.apriStorico?.(event, entity, name);
}

function createTemperatureCard(voce) {
  const { room, entry } = voce;
  const temperature = clean(entry.temp);
  const humidity = entryHumidity(entry);
  const tid = safeId(temperature);
  const hid = safeId(humidity);

  const card = doc.createElement("article");
  card.className = "temp-card cp-card dm-temperature-card";
  card.dataset.roomId = clean(room.id);
  card.dataset.temperatureId = clean(entry.id) || "primary";
  card.dataset.dmTemperatureCanonical = "true";
  card.style.setProperty("--cp-rgb", "148, 163, 184");
  card.addEventListener("click", (event) => openHistory(event, temperature, cardTitle(voce)));

  const header = doc.createElement("div");
  header.className = "cp-header temp-card-header";
  const title = doc.createElement("div");
  title.className = "cp-title-wrap";
  const icon = doc.createElement("div");
  icon.className = "cp-icon temp-room-icon";
  icon.dataset.roomIcon = clean(room.icon || "mdi:home");
  icon.append(makeText("dm-temperature-icon-fallback", glyph(room.icon)));
  const name = doc.createElement("div");
  name.className = "cp-name temp-room-name";
  name.textContent = cardTitle(voce);
  title.append(icon, name);
  const badge = doc.createElement("div");
  badge.className = "cp-badge temp-comfort-badge";
  badge.id = `tc_${tid}`;
  header.append(title, badge);

  const body = doc.createElement("div");
  body.className = "cp-body temp-card-body";
  const current = doc.createElement("div");
  current.className = "cp-temp-current-wrap";
  const labels = temperatureCardLabels(room, entry);
  current.append(
    makeText("cp-temp-current-lbl", labels.temperature),
    makeText("cp-temp-current temp-value", "—"),
  );
  current.lastElementChild.id = `tv_${tid}`;

  /* Niente entita', niente casella: chi ha lasciato vuota l'umidita' l'ha
   * fatto apposta, e un «—%» fisso e' solo una domanda senza risposta. */
  if (humidity) {
    const humidityBox = doc.createElement("div");
    humidityBox.className = "cp-temp-target";
    humidityBox.append(
      makeText("lbl", `💧 ${labels.humidity}`),
      makeText("val temp-hum-val", "—%"),
    );
    humidityBox.lastElementChild.id = `hv_${hid}`;
    humidityBox.addEventListener("click", (event) => {
      event.stopPropagation();
      openHistory(event, humidity, `${cardTitle(voce)} ${t("Umidità", "Humidity")}`);
    });
    body.append(current, humidityBox);
  } else {
    body.append(current);
  }
  card.append(header, body);
  return card;
}

function updateCard(card, voce) {
  if (!card || !voce) return;
  const { room, entry } = voce;
  const temperature = numericState(entry.temp);
  const humidity = numericState(entryHumidity(entry));
  const value = card.querySelector(".temp-value");
  const humidityValue = card.querySelector(".temp-hum-val");
  const comfort = card.querySelector(".temp-comfort-badge");
  const icon = card.querySelector(".cp-icon,.temp-room-icon");
  const name = card.querySelector(".cp-name,.temp-room-name");

  if (value) value.textContent = temperature == null ? "—" : temperature.toFixed(1);
  if (humidityValue)
    humidityValue.textContent = humidity == null ? "—%" : `${humidity.toFixed(0)}%`;
  applyTemperatureReading(card, temperature, humidity);
  if (comfort) {
    const label = comfortLabel(temperature);
    comfort.textContent = comfortBadgeText(label);
    comfort.title = label;
    comfort.setAttribute("aria-label", label);
    comfort.dataset.comfort = label.toLowerCase().replaceAll(" ", "-");
  }
  if (icon) {
    icon.dataset.roomIcon = clean(room.icon || "mdi:home");
    const fallback =
      icon.querySelector(".dm-temperature-icon-fallback") ||
      makeText("dm-temperature-icon-fallback", "");
    fallback.textContent = glyph(room.icon);
    if (!fallback.parentElement) icon.replaceChildren(fallback);
  }
  if (name) name.textContent = cardTitle(voce);
}

function vocePerCard(values, card) {
  return values.find(
    (voce) =>
      clean(voce.room.id) === clean(card.dataset.roomId) &&
      (clean(voce.entry.id) || "primary") === (clean(card.dataset.temperatureId) || "primary"),
  );
}

export function normalizeTemperatureCards() {
  const grid = doc?.getElementById("temp-grid");
  if (!grid) return false;
  const values = roomEntries();
  for (const card of grid.querySelectorAll(".temp-card[data-room-id]")) {
    const voce = vocePerCard(values, card);
    if (voce) updateCard(card, voce);
  }
  return values.length > 0;
}

export function renderTemperatureCards({ force = false } = {}) {
  const grid = doc?.getElementById("temp-grid");
  if (!grid) return false;
  const values = roomEntries();
  const signature = cardSignature(values);

  if (
    !force &&
    signature === state.signature &&
    grid.querySelectorAll(".temp-card[data-dm-temperature-canonical='true']").length ===
      values.length
  ) {
    normalizeTemperatureCards();
    return values.length > 0;
  }

  state.signature = signature;
  if (!values.length) {
    const empty = doc.createElement("div");
    empty.className = "dm-temperature-empty";
    empty.textContent = t("Nessuna stanza ha ancora un sensore temperatura configurato.", "No room has a temperature sensor configured yet.");
    grid.replaceChildren(empty);
    return false;
  }

  const cards = values.map((voce) => {
    const card = createTemperatureCard(voce);
    updateCard(card, voce);
    return card;
  });
  grid.replaceChildren(...cards);
  grid.dataset.dmTemperatureRenderer = "canonical";
  return true;
}

function temperatureEditMode(form) {
  const title = clean(
    form?.querySelector("[data-temperature-form-title]")?.textContent,
  ).toLowerCase();
  return /^(modifica|edit)\b/.test(title);
}

function syncEditRoomPresentation(form, roomId) {
  const room = rooms().find((item) => clean(item.id) === clean(roomId));
  const floor = form?.querySelector("[data-temperature-floor]");
  const icon = form?.querySelector("#dm-temperature-icon");
  if (floor) floor.textContent = room?.floor ? `🏢 ${room.floor}` : "";
  if (icon) icon.value = clean(room?.icon || "mdi:thermometer");
}

function resetTemperatureReassignment(form) {
  if (!form) return;
  delete form.dataset.dmOriginalRoom;
  const select = form.querySelector("#dm-temperature-room");
  if (select) delete select.dataset.dmTemperatureRoomEditable;
}

function bindTemperatureRoomReassignment(form) {
  const select = form?.querySelector("#dm-temperature-room");
  if (!select) return false;

  if (temperatureEditMode(form)) {
    form.dataset.dmOriginalRoom ||= clean(select.value);
    select.disabled = false;
    select.dataset.dmTemperatureRoomEditable = "true";
  } else if (form.dataset.dmOriginalRoom) {
    resetTemperatureReassignment(form);
  }

  if (select.dataset.dmTemperatureReassignBound !== "true") {
    select.dataset.dmTemperatureReassignBound = "true";
    select.addEventListener(
      "change",
      (event) => {
        if (!form.dataset.dmOriginalRoom) return;
        event.stopImmediatePropagation();
        syncEditRoomPresentation(form, select.value);
      },
      true,
    );
  }

  if (form.dataset.dmTemperatureReassignSubmit !== "true") {
    form.dataset.dmTemperatureReassignSubmit = "true";
    form.addEventListener(
      "submit",
      async (event) => {
        const originalId = clean(form.dataset.dmOriginalRoom);
        if (!originalId) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        const targetId = clean(select.value);
        const temp = clean(form.querySelector("#ed-pl-temp")?.value);
        const hum = clean(form.querySelector("#dm-humidity-new")?.value);
        if (!targetId || !temp.includes(".")) {
          root.alert?.(
            t("Seleziona una stanza e un'entità temperatura valida.", "Select a room and a valid temperature entity."),
          );
          return;
        }

        const store = dashboardStore();
        const currentRooms = store?.getSection?.("rooms") || [];
        const target = currentRooms.find((room) => clean(room.id) === targetId);
        if (!target) return;
        const conflict = targetId !== originalId && (clean(target.temp) || clean(target.hum));
        if (conflict) {
          root.alert?.(
            t("La stanza selezionata ha già sensori temperatura configurati.", "The selected room already has temperature sensors configured."),
          );
          return;
        }

        const next = currentRooms.map((room) => {
          const id = clean(room.id);
          if (id === originalId && originalId !== targetId) return { ...room, temp: "", hum: "" };
          if (id === targetId) return { ...room, temp, hum };
          return room;
        });
        try {
          await store?.replaceSection?.("rooms", next);
          resetTemperatureReassignment(form);
          state.signature = "";
          renderTemperatureCards({ force: true });
          root.setTimeout?.(() => root.editorSwitch?.("sez7"), 0);
        } catch (error) {
          root.console?.error?.("[DashboardModern] temperature room reassignment", error);
        }
      },
      true,
    );
  }
  return true;
}

export function normalizeTemperatureConfiguredRows() {
  const values = rooms();
  let normalized = false;
  doc?.querySelectorAll?.("#editor-modal [data-temperature-room][data-room-id]").forEach((row) => {
    const room = values.find((item) => clean(item?.id) === clean(row.dataset.roomId));
    const name =
      clean(room?.name) ||
      clean(row.dataset.roomName) ||
      clean(row.dataset.roomId) ||
      (t("Stanza", "Room"));
    let main = row.querySelector(".ed-row-main");
    if (!main) {
      main = doc.createElement("div");
      main.className = "ed-row-main";
      row.querySelector(".dm-temperature-card-icon")?.after(main);
      if (!main.parentElement) row.prepend(main);
    }
    let primary = main.querySelector(".ed-row-new");
    if (!primary) {
      primary = doc.createElement("div");
      primary.className = "ed-row-new";
      main.prepend(primary);
    }
    let secondary = main.querySelector(".ed-row-old");
    if (!secondary) {
      secondary = doc.createElement("div");
      secondary.className = "ed-row-old";
      main.append(secondary);
    }
    primary.textContent = name;
    primary.title = name;
    normalized = true;
    if (room) {
      const sensors = [clean(room.temp), clean(room.hum)].filter(Boolean).join(" · ");
      if (sensors) {
        secondary.textContent = sensors;
        secondary.title = sensors;
      }
    }
    row.dataset.dmTemperatureNameVisible = "true";
  });
  return normalized;
}

function normalizeTemperatureEditor() {
  normalizeTemperatureConfiguredRows();
  const form = doc?.querySelector("#editor-modal [data-temperature-form]");
  if (!form) return false;
  const intro = form.parentElement?.querySelector("[data-temperature-editor]");
  if (intro) {
    intro.textContent = t("Seleziona una stanza esistente e associa i sensori di temperatura e umidità. In modifica puoi anche spostare i sensori in un'altra stanza. Nome e icona si modificano in Stanze.", "Select an existing room and associate its temperature and humidity sensors. You can also move the sensors to another room while editing. Edit room name and icon in Rooms.");
  }
  const iconInput = form.querySelector("#dm-temperature-icon");
  if (iconInput) {
    iconInput.type = "hidden";
    iconInput.hidden = true;
    const label = iconInput.closest("label.ed-slot");
    if (label && label !== form) {
      iconInput.remove();
      label.remove();
      form.append(iconInput);
    } else {
      iconInput.closest("[data-icon-field]")?.remove();
      form.append(iconInput);
    }
    const sync = () => {
      const roomId = clean(form.querySelector("#dm-temperature-room")?.value);
      const room = rooms().find((item) => clean(item.id) === roomId);
      iconInput.value = clean(room?.icon || "mdi:thermometer");
    };
    if (form.dataset.dmTemperatureIconBound !== "true") {
      form.dataset.dmTemperatureIconBound = "true";
      form.querySelector("#dm-temperature-room")?.addEventListener("change", sync);
      form.addEventListener("submit", sync, true);
    }
    sync();
  }
  bindTemperatureRoomReassignment(form);
  return true;
}

function installRenderOwner(name) {
  const current = root[name];
  if (current?.__dmCanonicalTemperatureOwner) return false;
  function canonicalTemperatureRender() {
    return renderTemperatureCards();
  }
  canonicalTemperatureRender.__dmCanonicalTemperatureOwner = true;
  canonicalTemperatureRender.__dmPrevious = current;
  root[name] = canonicalTemperatureRender;
  return true;
}

function installEditorNormalizerOwner() {
  const current = root.editorSwitch;
  if (typeof current !== "function" || current.__dmCanonicalTemperatureEditor) return false;
  function canonicalTemperatureEditorSwitch(...args) {
    const result = current.apply(this, args);
    normalizeTemperatureEditor();
    return result;
  }
  canonicalTemperatureEditorSwitch.__dmCanonicalTemperatureEditor = true;
  canonicalTemperatureEditorSwitch.__dmPrevious = current;
  root.editorSwitch = canonicalTemperatureEditorSwitch;
  return true;
}

function installOwners() {
  installRenderOwner("buildTempCards");
  installRenderOwner("renderTemperature");
  installEditorNormalizerOwner();
}

function subscribeStore() {
  if (state.storeUnsubscribe) return;
  const store = dashboardStore();
  if (typeof store?.subscribe !== "function") return;
  state.storeUnsubscribe = store.subscribe((change) => {
    if (change?.section !== "rooms" && change?.section !== "snapshot") return;
    state.signature = "";
    renderTemperatureCards({ force: true });
    root.queueMicrotask?.(normalizeTemperatureConfiguredRows);
  });
}

function installStyles() {
  installStyle(
    "dm-temperature-section-style",
    `
    /* One surface token for the whole card: --ha-card-background only exists
       inside Home Assistant, so every mix has to fall back to the dashboard own
       --card-bg, or the card paints white under light text in dark theme. */
    #page-temp #temp-grid,.temp-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(268px,332px))!important;justify-content:start!important;align-items:start!important;gap:16px!important;width:100%!important;margin:16px 0 0!important;padding:0 18px 28px!important}
    #page-temp .temp-card,#temp-grid .temp-card{--dm-temp-surface:var(--ha-card-background,var(--card-bg,#fff));--dm-temp-accent:100,116,139;position:relative!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;box-sizing:border-box!important;aspect-ratio:auto!important;width:100%!important;max-width:332px!important;min-height:132px!important;margin:0!important;padding:15px 16px 18px 19px!important;border:1px solid color-mix(in srgb,rgb(var(--dm-temp-accent)) 17%,var(--card-border,var(--divider-color,#e2e8f0)))!important;border-radius:22px!important;gap:13px!important;overflow:hidden!important;background:radial-gradient(118% 82% at 100% 0%,color-mix(in srgb,rgb(var(--dm-temp-accent)) 9%,transparent) 0%,transparent 64%),linear-gradient(180deg,var(--dm-temp-surface) 0%,color-mix(in srgb,rgb(var(--dm-temp-accent)) 3.5%,var(--dm-temp-surface)) 100%)!important;box-shadow:0 14px 30px -18px color-mix(in srgb,rgb(var(--dm-temp-accent)) 34%,rgba(15,23,42,.3))!important;transition:transform .16s ease,box-shadow .16s ease!important}
    /* The comfort state colours the whole tile, so a room reads at a glance. */
    #temp-grid .temp-card:has(.temp-comfort-badge[data-comfort="freddo"]),#temp-grid .temp-card:has(.temp-comfort-badge[data-comfort="cold"]){--dm-temp-accent:14,165,233}
    #temp-grid .temp-card:has(.temp-comfort-badge[data-comfort="comfort"]){--dm-temp-accent:16,185,129}
    #temp-grid .temp-card:has(.temp-comfort-badge[data-comfort="caldo"]),#temp-grid .temp-card:has(.temp-comfort-badge[data-comfort="hot"]){--dm-temp-accent:239,68,68}
    @media(hover:hover) and (pointer:fine){#temp-grid .temp-card:hover{transform:translateY(-2px)!important;box-shadow:0 20px 38px -18px color-mix(in srgb,rgb(var(--dm-temp-accent)) 52%,rgba(15,23,42,.34))!important}}
    #page-temp .temp-card::before,#temp-grid .temp-card::before{content:""!important;position:absolute!important;inset:0 auto 0 0!important;width:4px!important;background:linear-gradient(180deg,rgb(var(--dm-temp-accent)),color-mix(in srgb,rgb(var(--dm-temp-accent)) 28%,transparent))!important;opacity:.92!important}
    /* The comfort scale at the foot of the card: cold to hot from left to right,
       with the reading punched out of it as a notch. It is drawn from the
       --dm-temp-pos variable the updaters set, so no renderer grows markup. */
    #temp-grid .temp-card::after{content:""!important;position:absolute!important;inset:auto 0 0 4px!important;height:5px!important;background-image:linear-gradient(90deg,transparent calc(var(--dm-temp-pos,50) * 1% - 1px),color-mix(in srgb,var(--text,#0f172a) 62%,transparent) calc(var(--dm-temp-pos,50) * 1% - 1px) calc(var(--dm-temp-pos,50) * 1% + 1px),transparent calc(var(--dm-temp-pos,50) * 1% + 1px)),linear-gradient(90deg,transparent calc(var(--dm-temp-pos,50) * 1% - 3.5px),var(--dm-temp-surface) calc(var(--dm-temp-pos,50) * 1% - 3.5px) calc(var(--dm-temp-pos,50) * 1% + 3.5px),transparent calc(var(--dm-temp-pos,50) * 1% + 3.5px)),linear-gradient(90deg,rgb(14,165,233) 0%,rgb(16,185,129) 40%,rgb(250,204,21) 62%,rgb(239,68,68) 100%)!important;opacity:.82!important}
    #temp-grid .temp-card[data-dm-reading="off"]::after{background-image:linear-gradient(90deg,color-mix(in srgb,var(--text-dim,#64748b) 22%,transparent),transparent)!important;opacity:.5!important}
    #page-temp .temp-card-header,#temp-grid .temp-card-header{display:flex!important;min-width:0!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-height:40px!important;margin:0!important;padding:0!important}
    #page-temp .cp-title-wrap,#temp-grid .cp-title-wrap{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important;flex:1 1 0!important}
    #page-temp .cp-icon,#temp-grid .cp-icon{display:grid!important;place-items:center!important;flex:0 0 40px!important;width:40px!important;height:40px!important;margin:0!important;border:1px solid color-mix(in srgb,rgb(var(--dm-temp-accent)) 24%,transparent)!important;border-radius:14px!important;background:color-mix(in srgb,rgb(var(--dm-temp-accent)) 12%,var(--dm-temp-surface))!important;box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 20%,transparent)!important;font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important}
    #page-temp .cp-name,#temp-grid .cp-name{flex:1 1 0!important;min-width:0!important;margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:15.5px!important;font-weight:850!important;letter-spacing:-.2px!important;line-height:1.15!important;color:var(--text,#0f172a)!important}
    #page-temp .temp-comfort-badge,#temp-grid .temp-comfort-badge{position:static!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;min-width:58px!important;max-width:none!important;min-height:24px!important;padding:4px 9px!important;border:1px solid color-mix(in srgb,currentColor 22%,transparent)!important;border-radius:999px!important;font-size:8.5px!important;font-weight:900!important;letter-spacing:.06em!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;transform:none!important;box-shadow:none!important}
    #temp-grid .temp-comfort-badge[data-comfort="freddo"],#temp-grid .temp-comfort-badge[data-comfort="cold"]{background:color-mix(in srgb,var(--info-color,#0ea5e9) 16%,var(--dm-temp-surface))!important;color:color-mix(in srgb,var(--info-color,#0ea5e9) 72%,var(--text,#0f172a))!important}
    #temp-grid .temp-comfort-badge[data-comfort="comfort"]{background:color-mix(in srgb,var(--success-color,#10b981) 16%,var(--dm-temp-surface))!important;color:color-mix(in srgb,var(--success-color,#10b981) 70%,var(--text,#0f172a))!important}
    #temp-grid .temp-comfort-badge[data-comfort="caldo"],#temp-grid .temp-comfort-badge[data-comfort="hot"]{background:color-mix(in srgb,var(--error-color,#ef4444) 15%,var(--dm-temp-surface))!important;color:color-mix(in srgb,var(--error-color,#ef4444) 74%,var(--text,#0f172a))!important}
    #temp-grid .temp-comfort-badge[data-comfort="non-disponibile"],#temp-grid .temp-comfort-badge[data-comfort="unavailable"]{background:color-mix(in srgb,var(--text-dim,#64748b) 14%,var(--dm-temp-surface))!important;color:var(--text-dim,#64748b)!important}
    #page-temp .temp-card-body,#temp-grid .temp-card-body{display:grid!important;grid-template-columns:minmax(0,1.15fr) minmax(88px,.85fr)!important;align-items:end!important;gap:12px!important;width:100%!important;margin:0!important;padding:0!important}
    #page-temp .cp-temp-current-wrap,#temp-grid .cp-temp-current-wrap{display:grid!important;gap:3px!important;min-width:0!important}
    #temp-grid .cp-temp-current-lbl{margin:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:8px!important;font-weight:900!important;letter-spacing:.12em!important;line-height:1.2!important;text-transform:uppercase!important;color:var(--text-dim,var(--secondary-text-color,#64748b))!important}
    #page-temp .cp-temp-current,#temp-grid .cp-temp-current{display:block!important;margin:0!important;font-size:38px!important;font-weight:850!important;line-height:.92!important;letter-spacing:-1.4px!important;font-variant-numeric:tabular-nums!important;white-space:nowrap!important;color:var(--text,#0f172a)!important}
    /* The reading is a temperature: the degree mark is drawn here so no renderer
       has to change, and it goes away on the card that has nothing to show. */
    #temp-grid .cp-temp-current::after{content:"°"!important;margin-left:2px!important;font-size:.46em!important;font-weight:800!important;letter-spacing:0!important;vertical-align:.52em!important;color:color-mix(in srgb,var(--text,#0f172a) 55%,transparent)!important}
    #temp-grid .temp-card:has(.temp-comfort-badge[data-comfort="non-disponibile"]) .cp-temp-current::after,#temp-grid .temp-card:has(.temp-comfort-badge[data-comfort="unavailable"]) .cp-temp-current::after{content:""!important}
    #page-temp .cp-temp-target,#temp-grid .cp-temp-target{position:relative!important;display:grid!important;align-content:end!important;gap:5px!important;min-width:0!important;margin:0!important;padding:5px 0 9px 13px!important;border-left:1px solid transparent!important;border-image:linear-gradient(180deg,transparent 4%,color-mix(in srgb,rgb(var(--dm-temp-accent)) 32%,var(--card-border,var(--divider-color,#dbe4ee))) 44%,transparent 100%) 1!important;text-align:left!important}
    /* How full the air is, at a glance: the bar fills to the humidity reading. */
    #temp-grid .cp-temp-target::after{content:""!important;position:absolute!important;left:13px!important;right:0!important;bottom:0!important;height:3px!important;border-radius:999px!important;background:linear-gradient(90deg,rgb(56,189,248) 0 calc(var(--dm-hum,0) * 1%),color-mix(in srgb,var(--text-dim,#64748b) 18%,transparent) 0)!important}
    #temp-grid .temp-card[data-dm-humidity="off"] .cp-temp-target::after{background:color-mix(in srgb,var(--text-dim,#64748b) 14%,transparent)!important}
    #temp-grid .cp-temp-target .lbl{overflow:hidden!important;text-overflow:ellipsis!important;font-size:8px!important;font-weight:900!important;letter-spacing:.08em!important;text-transform:uppercase!important;white-space:nowrap!important;color:var(--text-dim,var(--secondary-text-color,#64748b))!important}
    #temp-grid .cp-temp-target .val{font-size:23px!important;font-weight:850!important;line-height:1!important;letter-spacing:-.4px!important;font-variant-numeric:tabular-nums!important;white-space:nowrap!important;color:var(--text-dim,var(--secondary-text-color,#64748b))!important}
    #temp-grid .dm-temperature-icon-fallback{display:block!important;font-size:24px!important;line-height:1!important}
    #temp-grid .dm-temperature-empty{grid-column:1/-1!important;box-sizing:border-box!important;width:100%!important;padding:28px 20px!important;border:1px dashed var(--card-border,var(--divider-color,#dbe4ee))!important;border-radius:22px!important;background:var(--ha-card-background,var(--card-bg,#fff))!important;color:var(--text-dim,#64748b)!important;text-align:center!important;font-weight:750!important}
    #editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main{display:block!important;visibility:visible!important;opacity:1!important;min-width:0!important;align-self:center!important;overflow:hidden!important}
    #editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main>.ed-row-new{display:block!important;visibility:visible!important;opacity:1!important;color:var(--text,#0f172a)!important;font-weight:900!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #editor-modal [data-temperature-room][data-dm-temperature-name-visible="true"]>.ed-row-main>.ed-row-old{display:block!important;visibility:visible!important;opacity:1!important;margin-top:3px!important;color:var(--secondary-text-color,var(--text-dim,#64748b))!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #editor-modal [data-temperature-form] #dm-temperature-icon,#editor-modal [data-temperature-form] [data-icon-field],#editor-modal [data-temperature-form] label.ed-slot:has(#dm-temperature-icon){display:none!important}
    #editor-modal [data-temperature-form] .dm-temperature-actions button{min-height:44px!important}
    #editor-modal [data-temperature-form] #dm-temperature-room[data-dm-temperature-room-editable="true"]{border-color:var(--primary-color,#0ea5e9)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,transparent)!important}
    @media(max-width:680px){#page-temp #temp-grid,.temp-grid{grid-template-columns:minmax(0,360px)!important;justify-content:center!important;gap:13px!important;margin-top:12px!important;padding:0 14px 22px!important}#page-temp .temp-card,#temp-grid .temp-card{width:100%!important;max-width:360px!important;min-height:124px!important;padding:13px 14px 16px 17px!important;border-radius:20px!important;gap:11px!important}#page-temp .cp-temp-current,#temp-grid .cp-temp-current{font-size:36px!important}#temp-grid .cp-temp-target .val{font-size:22px!important}}
  `,
  );
}

export function installTemperatureSection() {
  if (!doc) return;
  installStyles();
  installOwners();
  subscribeStore();
  renderTemperatureCards();
  normalizeTemperatureEditor();
  if (!state.listeners) {
    state.listeners = true;
    root.addEventListener?.("dashboardmodern:state-changed", (event) => {
      if (stateChangeAffectsTemperature(event)) normalizeTemperatureCards();
    });
    for (const eventName of [
      "dashboardmodern:legacy-ready",
      "dashboardmodern:runtime-ready",
      "dashboardmodern:persistence-restored",
      "dashboardmodern:temperature-editor-rendered",
    ]) {
      root.addEventListener?.(eventName, () => {
        installOwners();
        subscribeStore();
        state.signature = "";
        renderTemperatureCards({ force: true });
        normalizeTemperatureConfiguredRows();
      });
    }
    root.addEventListener?.("dashboardmodern:config-reset", () => {
      state.signature = "";
      renderTemperatureCards({ force: true });
    });
    doc.addEventListener(
      "click",
      (event) => {
        const cancel = event.target?.closest?.("[data-temperature-cancel]");
        if (cancel) resetTemperatureReassignment(cancel.closest("[data-temperature-form]"));
        if (
          event.target?.closest?.(
            "[data-tab='temp'],[data-tab='temperature'],.ed-tab[data-tab='sez7'],[data-temperature-edit]",
          )
        )
          root.queueMicrotask?.(() => {
            installOwners();
            renderTemperatureCards();
            normalizeTemperatureEditor();
          });
      },
      true,
    );
  }
  state.installed = true;
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installTemperatureSection, { once: true });
else installTemperatureSection();
