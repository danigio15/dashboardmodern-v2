/* Canonical store fixes layered after release-0147-fixes.js. */
const STATE_KEY = "__DASHBOARDMODERN_0147_STORE_FIXES__";
const copy = () => document.documentElement.lang === "en";
const clean = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function store() {
  return globalThis.DashboardModernModules?.store || null;
}

function canonicalCovers() {
  return store()?.getSection?.("covers") || [];
}

function legacyCovers() {
  return canonicalCovers().map((item) => {
    const cover = {
      name: item.name || item.entity,
      entity: item.entity || item.entities?.[0] || "",
    };
    if (item.room_id) cover.room = item.room_id;
    return cover;
  });
}

function entityField({ id, label, value = "", placeholder = "cover.entity" }) {
  return (
    globalThis.DashboardModernModules?.render?.createEntityField?.({
      id,
      label,
      value,
      placeholder,
      domain: "cover",
      optional: false,
    }) ||
    `<label class="ed-slot dm-entity-field" data-entity-field><span class="ed-slot-lbl">${clean(label)}</span><span class="ed-form-row"><input id="${clean(id)}" class="ed-input ed-slot-in mono" value="${clean(value)}" placeholder="${clean(placeholder)}"><button type="button" class="dm-entity-picker" data-entity-target="${clean(id)}">🔍</button></span></label>`
  );
}

function installCoverEditor() {
  if (globalThis[STATE_KEY]?.installed) return true;
  if (!globalThis.__DASHBOARDMODERN_0147_FIXES__?.patched || !store()) return false;

  const state = { installed: true, editId: "" };
  globalThis[STATE_KEY] = state;
  globalThis.getTapparelle = legacyCovers;

  globalThis.editorRenderTapparelle = function editorRenderTapparelle0147() {
    const list = canonicalCovers();
    const current = list.find((item) => item.id === state.editId) || null;
    const rows =
      list
        .map(
          (item) => `<div class="ed-row" data-tapp-id="${clean(item.id)}">
            <div class="ed-row-main">
              <div class="ed-row-new">🪟 ${clean(item.name || item.entity)}</div>
              <div class="ed-row-old mono">${clean(item.entity || item.entities?.[0] || "")}</div>
            </div>
            <div class="dm-row-actions">
              <button type="button" class="ed-del" data-tapp-edit="${clean(item.id)}" onclick="edTappEdit('${clean(item.id)}')" title="${copy() ? "Edit" : "Modifica"}">✏️</button>
              <button type="button" class="ed-del" onclick="edTappDel('${clean(item.id)}')" title="${copy() ? "Delete" : "Elimina"}">🗑️</button>
            </div>
          </div>`,
        )
        .join("") ||
      `<div class="ed-empty">${copy() ? "No shutters configured." : "Nessuna tapparella configurata."}</div>`;

    return `<div class="ed-intro">${copy() ? "Edit an existing shutter or add a Home Assistant cover entity." : "Modifica una tapparella esistente o aggiungi una entità cover di Home Assistant."}</div>
      <div class="ed-list">${rows}</div>
      <div class="ed-form dm-tapp-form" data-tapp-form>
        <div class="ed-sec-title">${current ? (copy() ? "Edit shutter" : "Modifica tapparella") : copy() ? "Add shutter" : "Aggiungi tapparella"}</div>
        <label class="ed-slot"><span class="ed-slot-lbl">${copy() ? "Name" : "Nome"}</span><input id="ed-tp-name" class="ed-input" value="${clean(current?.name || "")}"></label>
        ${entityField({ id: "ed-tp-ent", label: copy() ? "Cover entity" : "Entità cover", value: current?.entity || current?.entities?.[0] || "", placeholder: "cover.tapparella_salone" })}
        <label class="ed-slot"><span class="ed-slot-lbl">${copy() ? "Room" : "Stanza"}</span><select id="ed-tp-room" class="ed-input">${globalThis.cdRoomOptions?.(current?.room_id || "") || ""}</select></label>
        <div class="dm-temperature-actions">
          <button type="button" class="ed-btn-add" onclick="edTappAdd()">${current ? (copy() ? "💾 Save changes" : "💾 Salva modifiche") : copy() ? "＋ Add shutter" : "＋ Aggiungi tapparella"}</button>
          ${current ? `<button type="button" class="ed-btn-secondary" onclick="edTappCancelEdit()">${copy() ? "Cancel" : "Annulla"}</button>` : ""}
        </div>
      </div>`;
  };

  globalThis.edTappEdit = function edTappEdit0147(idOrIndex) {
    const list = canonicalCovers();
    const numeric = Number(idOrIndex);
    state.editId = list.some((item) => item.id === String(idOrIndex))
      ? String(idOrIndex)
      : Number.isInteger(numeric) && list[numeric]
        ? list[numeric].id
        : "";
    globalThis.editorSwitch?.("tapp");
  };

  globalThis.edTappCancelEdit = function edTappCancelEdit0147() {
    state.editId = "";
    globalThis.editorSwitch?.("tapp");
  };

  globalThis.edTappAdd = async function edTappAdd0147() {
    const name = document.getElementById("ed-tp-name")?.value.trim() || "";
    const entity = document.getElementById("ed-tp-ent")?.value.trim() || "";
    const roomId = document.getElementById("ed-tp-room")?.value.trim() || "";
    if (!/^cover\.[a-z0-9_]+$/i.test(entity)) {
      globalThis.alert?.(copy() ? "Enter a valid cover entity." : "Inserisci una entità cover valida.");
      return;
    }
    const value = {
      name: name || entity,
      entity,
      entities: [entity],
      room_id: roomId,
      enabled: true,
    };
    try {
      if (state.editId) await store().updateItem("covers", state.editId, value);
      else await store().addItem("covers", value);
      state.editId = "";
      globalThis.renderTapparelle?.();
      globalThis.render?.();
      globalThis.editorSwitch?.("tapp");
    } catch (error) {
      globalThis.alert?.(error?.message || String(error));
    }
  };

  globalThis.edTappDel = async function edTappDel0147(idOrIndex) {
    const list = canonicalCovers();
    const numeric = Number(idOrIndex);
    const id = list.some((item) => item.id === String(idOrIndex))
      ? String(idOrIndex)
      : Number.isInteger(numeric) && list[numeric]
        ? list[numeric].id
        : "";
    if (!id) return;
    try {
      await store().removeItem("covers", id);
      if (state.editId === id) state.editId = "";
      globalThis.editorSwitch?.("tapp");
    } catch (error) {
      globalThis.alert?.(error?.message || String(error));
    }
  };

  return true;
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (installCoverEditor() || attempts > 120) window.clearInterval(timer);
  }, 100);
  window.addEventListener("dashboardmodern:legacy-ready", installCoverEditor);
}
