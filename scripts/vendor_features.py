# ruff: noqa: E501
"""Feature patches for the vendored dashboard.

Kept separate from vendor_legacy.py so the JavaScript snippets can be written as
plain raw strings without a second layer of escaping. Each entry is
(label, anchor, replacement): the anchor must appear exactly once in the source
and is replaced by the replacement.

Current feature: a shared room registry usable in every section. The rooms
already live in cd_stanze; this adds a reusable helper to build a room <select>,
a room field on the appliance editor, and persistence of the chosen room. The
same helper (cdRoomOptions / cdRoomOf) is meant to be reused for lights, climate
and cameras next, so a room means the same thing everywhere.
"""

from __future__ import annotations

# A reusable room helper, injected just before getAppliances so it is defined
# before anything that renders.
ROOM_HELPER_ANCHOR = "function getAppliances(){"
ROOM_HELPER_REPLACEMENT = (
    "function cdRoomList(){ try { if (typeof getStanze === 'function') { var g = getStanze(); if (Array.isArray(g)) return g; } var r = cdCfg('cd_stanze'); return Array.isArray(r)?r:[]; } catch(e){ return []; } }\n"
    "function cdRoomOptions(sel){ var rooms = cdRoomList(); var o = '<option value=\"\">\u2014 Nessuna stanza \u2014</option>'; rooms.forEach(function(r){ var nm=(r&&r.name)?String(r.name):''; if(!nm) return; var s=(String(sel||'')===nm)?' selected':''; var safe=nm.replace(/&/g,'&amp;').replace(/\"/g,'&quot;'); o += '<option value=\"'+safe+'\"'+s+'>'+((r.icon?r.icon+' ':'')+nm)+'</option>'; }); return o; }\n"
    "function cdRoomOf(item){ return (item && item.room) ? String(item.room) : ''; }\n"
    "function getAppliances(){"
)

# A room dropdown in the appliance editor, injected right after the name input.
# The anchor is language-independent: the hidden icon input follows the name in
# both the Italian and English variants.
APPLIANCE_FORM_ANCHOR = (
    '<input type="hidden" id="appl-icon" value="\'+curIcon+\'"></div>\''
)
APPLIANCE_FORM_REPLACEMENT = (
    '<input type="hidden" id="appl-icon" value="\'+curIcon+\'"></div>\''
    ' +\'<div style="margin-bottom:8px;"><label style="font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8);display:block;margin-bottom:4px;">STANZA</label><select id="appl-room" class="ed-input" style="margin:0;width:100%;">\'+cdRoomOptions(editing?ed.room:\'\')+\'</select></div>\''
)

# Persist the chosen room when saving an appliance.
APPLIANCE_SAVE_ANCHOR = "const item={ id:'appl_'+Date.now().toString(36), name:name||cdApplianceName(icon), icon, entities, threshold_run:isNaN(thr)?5:thr, threshold_standby:1 };"
APPLIANCE_SAVE_REPLACEMENT = "const roomSel=(document.getElementById('appl-room')||{}).value||''; const item={ id:'appl_'+Date.now().toString(36), name:name||cdApplianceName(icon), icon, entities, room:roomSel, threshold_run:isNaN(thr)?5:thr, threshold_standby:1 };"

# Climate: the same room dropdown, reading the same registry.
# Climate: a plain <select> in the static form; populated by the hook below.
CLIMATE_FORM_ANCHOR = '<button class="ed-btn-add" onclick="edAddClima()">'
CLIMATE_FORM_REPLACEMENT = '<select id="ed-cl-room" class="ed-input" style="margin-bottom:6px;width:100%;"></select><button class="ed-btn-add" onclick="edAddClima()">'

# Cameras: a plain <select> in the static form; populated by the hook below.
CAMERA_FORM_ANCHOR = '<button class="ed-btn-add" onclick="edAddCamera()">'
CAMERA_FORM_REPLACEMENT = '<select id="ed-cam-room" class="ed-input" style="margin-bottom:6px;width:100%;"></select><button class="ed-btn-add" onclick="edAddCamera()">'

# A hook in editorSwitch fills any room <select> with the registry each time the
# editor renders, so the static forms show the current rooms without inline JS.
POPULATE_ANCHOR = "function editorSwitch(tab) {\n    EDITOR_TAB = tab;"
POPULATE_REPLACEMENT = "function editorSwitch(tab) {\n    EDITOR_TAB = tab;\n    try { setTimeout(function(){ ['ed-cl-room','ed-cam-room','ed-lu-room'].forEach(function(id){ var el=document.getElementById(id); if(el && !el.dataset.dmFilled){ el.innerHTML = cdRoomOptions(''); el.dataset.dmFilled='1'; } }); }, 0); } catch(e){}"

CLIMATE_SAVE_ANCHOR = "units.push({ name, entity: ent, type });"
CLIMATE_SAVE_REPLACEMENT = "units.push({ name, entity: ent, type, room:(document.getElementById('ed-cl-room')||{}).value||'' });"

# Cameras: the same room dropdown, reading the same registry.
CAMERA_SAVE_ANCHOR = "const nuova = { name, entity: ent };"
CAMERA_SAVE_REPLACEMENT = "const nuova = { name, entity: ent, room:(document.getElementById('ed-cam-room')||{}).value||'' };"


# ── Rename: separate "manage rooms" from "temperatures" ──────────────────
# The editor accordion where rooms are created becomes "Gestione Stanze"; the
# dashboard temperature view drops the word "Stanze" and is just "Temperature".
# Labels differ by language and some appear more than once, so these are applied
# as plain replace-all (label-only, safe) rather than the exact-once patches.
RENAME_PATCHES: tuple[tuple[str, str], ...] = (
    ("\U0001f321\ufe0f Stanze (temperature)", "\U0001f3e0 Gestione Stanze"),
    ("\U0001f321\ufe0f Rooms (temperatures)", "\U0001f3e0 Manage Rooms"),
    ("\U0001f321\ufe0f Temperature Stanze", "\U0001f321\ufe0f Temperature"),
)

# ── A dedicated "Rooms" tab in the editor ──────────────────────────────────
# A clean place to manage the room registry (add / rename / delete), separate
# from the temperature section. The temperature sensor is optional here, so a
# room can exist just to organise devices. Everything reads and writes the same
# cd_stanze registry, so rooms created here appear in every section's dropdown.

# 1. A tab button in the editor bar, before Lights.
ROOMS_TAB_ANCHOR = (
    '<button class="ed-tab" data-tab="luci"  onclick="editorSwitch(\'luci\')">'
)
ROOMS_TAB_REPLACEMENT = '<button class="ed-tab" data-tab="stanze" onclick="editorSwitch(\'stanze\')">🚪 Stanze</button>\n          <button class="ed-tab" data-tab="luci"  onclick="editorSwitch(\'luci\')">'

# 2. A branch in editorSwitch to render it.
ROOMS_SWITCH_ANCHOR = "if (tab === 'luci')   body.innerHTML = editorRenderLuci();"
ROOMS_SWITCH_REPLACEMENT = "if (tab === 'stanze') body.innerHTML = editorRenderStanze();\n    if (tab === 'luci')   body.innerHTML = editorRenderLuci();"

# 3. The render function itself, defined just before editorRenderLuci.
ROOMS_RENDER_ANCHOR = "function editorRenderLuci()"
ROOMS_RENDER_REPLACEMENT = (
    "function editorRenderStanze(){ "
    "var rooms = (typeof getStanze==='function'?getStanze():[])||[]; "
    "var esc=function(x){return String(x==null?'':x).replace(/\"/g,'&quot;');}; "
    "var rowsHtml = rooms.map(function(r,i){ "
    'return \'<div class="ed-row"><div class="ed-row-main"><div class="ed-row-new">\''
    "+((r.icon?r.icon+' ':'🏠 ')+(r.name||'Stanza'))"
    "+'</div></div>'"
    '+\'<div class="ed-del" onclick="edStanzaRoomDel(\'+i+\')" title="Elimina">🗑️</div></div>\'; '
    "}).join('') || '<div class=\"ed-empty\">Nessuna stanza. Aggiungine una qui sotto.</div>'; "
    "return '<div class=\"ed-intro\">Gestisci qui le tue <b>stanze</b>. Ogni stanza creata qui compare nel menù a tendina di elettrodomestici, clima e telecamere. Per i sensori di temperatura usa la sezione dedicata.</div>'"
    "+'<div class=\"ed-list\">'+rowsHtml+'</div>'"
    "+'<div class=\"ed-form\">'"
    '+\'<div style="display:flex;gap:8px;margin-bottom:8px;"><input id="ed-room-icon" class="ed-input" style="flex:0 0 60px;text-align:center;" placeholder="🏠" value="🏠"><input id="ed-room-name" class="ed-input" style="flex:1;" placeholder="Nome stanza (es. Cucina)"></div>\''
    '+\'<button class="ed-btn-add" onclick="edStanzaRoomAdd()">＋ Aggiungi stanza</button>\''
    "+'</div>'; } "
    "function edStanzaRoomAdd(){ var name=(document.getElementById('ed-room-name').value||'').trim(); "
    "if(!name){ alert('Inserisci il nome della stanza'); return; } "
    "var icon=(document.getElementById('ed-room-icon').value||'🏠').trim(); "
    "var rooms=(typeof getStanze==='function'?getStanze():[]).slice(); "
    "var existing=rooms.filter(function(x){return x&&x.name;}); var r={ name:name, icon:icon }; rooms.push(r); "
    "localStorage.setItem('cd_stanze', JSON.stringify(rooms)); "
    "try { cdMarkDirty(); cdSyncPush(); } catch(e){} "
    "try { buildTempCards(); } catch(e){} editorSwitch('stanze'); } "
    "function edStanzaRoomDel(i){ var rooms=(typeof getStanze==='function'?getStanze():[]).slice(); "
    "rooms.splice(i,1); localStorage.setItem('cd_stanze', JSON.stringify(rooms)); "
    "try { cdMarkDirty(); cdSyncPush(); } catch(e){} "
    "try { buildTempCards(); } catch(e){} editorSwitch('stanze'); } "
    "function editorRenderLuci()"
)


# ── Lights: room dropdown that feeds the "Room - Detail" naming convention ──
LIGHTS_FORM_ANCHOR = (
    '<button class="ed-btn-add" style="width:100%;" onclick="edAddLuce()">'
)
LIGHTS_FORM_REPLACEMENT = '<select id="ed-lu-room" class="ed-input" style="margin-bottom:6px;width:100%;"></select><button class="ed-btn-add" style="width:100%;" onclick="edAddLuce()">'

# When a room is picked, prepend "Room - " to the light name so the existing
# grouping (which parses the text before " - ") keeps working.
LIGHTS_SAVE_ANCHOR = (
    "const nm = (document.getElementById('ed-lu-name').value || '').trim();"
)
LIGHTS_SAVE_REPLACEMENT = "var _luRoomEl = document.getElementById('ed-lu-room'); var _luRoom = _luRoomEl ? (_luRoomEl.value||'').trim() : ''; var _luName = (document.getElementById('ed-lu-name').value || '').trim(); const nm = (_luRoom && _luName && _luName.indexOf(' - ')===-1) ? (_luRoom + ' - ' + _luName) : _luName;"


# Ordered list of (label, anchor, replacement) applied by vendor_legacy.py.
FEATURE_PATCHES: tuple[tuple[str, str, str], ...] = (
    ("room-helper", ROOM_HELPER_ANCHOR, ROOM_HELPER_REPLACEMENT),
    ("appliance-room-field", APPLIANCE_FORM_ANCHOR, APPLIANCE_FORM_REPLACEMENT),
    ("appliance-room-save", APPLIANCE_SAVE_ANCHOR, APPLIANCE_SAVE_REPLACEMENT),
    ("climate-room-field", CLIMATE_FORM_ANCHOR, CLIMATE_FORM_REPLACEMENT),
    ("climate-room-save", CLIMATE_SAVE_ANCHOR, CLIMATE_SAVE_REPLACEMENT),
    ("camera-room-field", CAMERA_FORM_ANCHOR, CAMERA_FORM_REPLACEMENT),
    ("room-select-populate", POPULATE_ANCHOR, POPULATE_REPLACEMENT),
    ("rooms-tab", ROOMS_TAB_ANCHOR, ROOMS_TAB_REPLACEMENT),
    ("rooms-switch", ROOMS_SWITCH_ANCHOR, ROOMS_SWITCH_REPLACEMENT),
    ("rooms-render", ROOMS_RENDER_ANCHOR, ROOMS_RENDER_REPLACEMENT),
    ("lights-room-field", LIGHTS_FORM_ANCHOR, LIGHTS_FORM_REPLACEMENT),
    ("lights-room-save", LIGHTS_SAVE_ANCHOR, LIGHTS_SAVE_REPLACEMENT),
    ("camera-room-save", CAMERA_SAVE_ANCHOR, CAMERA_SAVE_REPLACEMENT),
)
