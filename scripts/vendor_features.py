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
    "function cdRoomOf(item){ return (item && item.room) ? String(item.room) : ''; }\nfunction cdFloorDatalist(){ var fl={}; cdRoomList().forEach(function(r){ if(r&&r.floor) fl[String(r.floor)]=1; }); return '<datalist id=\"ed-floor-list\">'+Object.keys(fl).map(function(f){ return '<option value=\"'+f+'\">'; }).join('')+'</datalist>'; }\n"
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
POPULATE_REPLACEMENT = "function editorSwitch(tab) {\n    EDITOR_TAB = tab;\n    try { setTimeout(function(){ ['ed-cl-room','ed-cam-room','ed-lu-room','ed-st2-name'].forEach(function(id){ var els=document.querySelectorAll('select#'+id+', select[id=\"'+id+'\"]'); els.forEach(function(el){ if(el){ var cur=el.value||''; el.innerHTML = cdRoomOptions(cur); } }); }); }, 0); } catch(e){}"

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
    "+'</div>'+(r.floor?'<div class=\"ed-row-old\">🏢 '+r.floor+'</div>':'')+'</div>'"
    '+\'<div class="ed-del" onclick="edStanzaRoomDel(\'+i+\')" title="Elimina">🗑️</div></div>\'; '
    "}).join('') || '<div class=\"ed-empty\">Nessuna stanza. Aggiungine una qui sotto.</div>'; "
    "return '<div class=\"ed-intro\">Gestisci qui le tue <b>stanze</b>. Ogni stanza creata qui compare nel menù a tendina di elettrodomestici, clima e telecamere. Per i sensori di temperatura usa la sezione dedicata.</div>'"
    "+'<div class=\"ed-list\">'+rowsHtml+'</div>'"
    "+'<div class=\"ed-form\">'"
    '+\'<div style="display:flex;gap:8px;margin-bottom:8px;"><input id="ed-room-icon" class="ed-input" style="flex:0 0 60px;text-align:center;" placeholder="🏠" value="🏠"><input id="ed-room-name" class="ed-input" style="flex:1;" placeholder="Nome stanza (es. Cucina)"></div><input id="ed-room-floor" class="ed-input" style="margin-bottom:8px;" list="ed-floor-list" placeholder="Piano (es. Piano terra)">\'+cdFloorDatalist()+\'\''
    '+\'<button class="ed-btn-add" onclick="edStanzaRoomAdd()">＋ Aggiungi stanza</button>\''
    "+'</div>'; } "
    "function edStanzaRoomAdd(){ var name=(document.getElementById('ed-room-name').value||'').trim(); "
    "if(!name){ alert('Inserisci il nome della stanza'); return; } "
    "var icon=(document.getElementById('ed-room-icon').value||'🏠').trim(); "
    "var floor=(document.getElementById('ed-room-floor').value||'').trim(); "
    "var rooms=(typeof getStanze==='function'?getStanze():[]).slice(); "
    "var r={ name:name, icon:icon }; if(floor) r.floor=floor; rooms.push(r); "
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


# ── Temperature section: rename to "Temperatura" and use a room dropdown ──
# The section titled "Stanze (temperature)" assigns temp/humidity sensors to a
# room. Its name field becomes a dropdown of existing rooms, and the title is
# forced to "Temperatura". Both title and field appear twice in the source
# (two render paths), so both are replaced.
TEMP_NAME_ANCHOR_IT = '<input id="ed-st2-name" class="ed-input" style="flex:1;" placeholder="Nome stanza">'
TEMP_NAME_ANCHOR_EN = (
    '<input id="ed-st2-name" class="ed-input" style="flex:1;" placeholder="Room name">'
)
TEMP_NAME_REPLACEMENT = (
    '<select id="ed-st2-name" class="ed-input" style="flex:1;"></select>'
)
TEMP_TITLE_ANCHOR_EN = "🌡️ Rooms (temperatures) "
TEMP_TITLE_ANCHOR = "🌡️ Stanze (temperature) "
TEMP_TITLE_REPLACEMENT = "🌡️ Temperatura "


# ── Never show the token wizard when hosted by the integration ─────────────
# The hosted dashboard gets its connection from the authenticated bridge, so
# the long-lived-token wizard must never open — not on load, and not after a
# "reset all". Standalone use is unaffected.
WIZARD_TRIGGER_ANCHOR = "if (!LONG_LIVED_TOKEN) document.addEventListener('DOMContentLoaded', () => { if (typeof apriSetupWizard === 'function') apriSetupWizard(); });"
WIZARD_TRIGGER_REPLACEMENT = "if (!LONG_LIVED_TOKEN && !window.__DASHBOARDMODERN_HOSTED__) document.addEventListener('DOMContentLoaded', () => { if (typeof apriSetupWizard === 'function') apriSetupWizard(); });"

# apriSetupWizard itself: bail out immediately when hosted, in case anything
# else calls it (e.g. the reset flow).
WIZARD_STEP_ANCHOR = "WIZ = { step: 1,"
WIZARD_STEP_REPLACEMENT = "WIZ = { step: (window.__DASHBOARDMODERN_HOSTED__ ? 2 : 1),"


# ── Visible build marker: prove the served HTML actually updated ───────────
VERSION_ANCHOR = "const DASHBOARD_VERSION = '0.11.1';"
VERSION_REPLACEMENT = "const DASHBOARD_VERSION = '0.11.1-int';"

# ── Temperature section: the Piano (floor) fields are hidden via CSS below ─

LOGO_MARK_ANCHOR = 'const mark = `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex:0 0 auto; display:block;">\n        <defs><linearGradient id="${uid}" x1="0" y1="0" x2="48" y2="48"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0369a1"/></linearGradient></defs>\n        <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#${uid})"/>\n        <path d="M13 24.5 L24 15 L35 24.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>\n        <path d="M15.8 23 V34 H32.2 V23" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>\n        <path d="M25 23.5 L20.5 30.8 H24 L23 35 L28.8 27.2 H24.9 Z" fill="#fde047"/>\n    </svg>`;'
LOGO_MARK_REPLACEMENT = 'const mark = \'<img src="./logo.png" alt="Dashboard Modern" width="\'+size+\'" height="\'+size+\'" style="flex:0 0 auto;display:block;object-fit:contain;border-radius:12px;" onerror="this.style.display=&#39;none&#39;">\';'


# ── Remove the duplicate old room form in the temperature section ──────────
TEMP_DUP_ANCHOR = 'onclick="edAddStanza2()">＋ Aggiungi stanza</button></div>\n          <div class="ed-form">'
TEMP_DUP_REPLACEMENT = 'onclick="edAddStanza2()">＋ Aggiungi stanza</button></div>\n          <div class="ed-form" style="display:none;">'


# ── A dedicated "Visibility" tab: show/hide whole sections ─────────────────
# The wizard already toggles which sections appear; this exposes the same
# control in the editor as its own tab, writing the same cd_sections store.
VIS_TAB_ANCHOR = (
    '<button class="ed-tab" data-tab="luci"  onclick="editorSwitch(\'luci\')">'
)
VIS_TAB_REPLACEMENT = '<button class="ed-tab" data-tab="visib" onclick="editorSwitch(\'visib\')">👁️ Sezioni</button>\n          <button class="ed-tab" data-tab="luci"  onclick="editorSwitch(\'luci\')">'

VIS_SWITCH_ANCHOR = "if (tab === 'luci')   body.innerHTML = editorRenderLuci();"
VIS_SWITCH_REPLACEMENT = "if (tab === 'visib') body.innerHTML = editorRenderVisib();\n    if (tab === 'luci')   body.innerHTML = editorRenderLuci();"

VIS_RENDER_ANCHOR = "function editorRenderLuci()"
VIS_RENDER_REPLACEMENT = (
    "function cdVisibSez(){ return [['home','🏠','Home','Meteo, avvisi, azioni rapide'],"
    "['energy','⚡','Energia','Fotovoltaico e consumi'],"
    "['ev','🚗','Auto elettrica','EV + wallbox (EVCC)'],"
    "['boiler','🌞','Solare termico','Boiler solare'],"
    "['clima','❄️','Clima','Condizionatori e riscaldamento'],"
    "['temp','🌡️','Temperatura','Temperature e umidità'],"
    "['security','🛡️','Sicurezza','Telecamere e allarme'],"
    "['server','🖥️','MiniPC','Monitoraggio server']]; } "
    "function editorRenderVisib(){ var sez=cdVisibSez(); var cur=cdCfg('cd_sections')||{}; "
    "var rows=sez.map(function(x,idx){ var k=x[0]; var on=(cur[k]!==false); "
    'return \'<div class="ed-row" style="align-items:center;"><div class="ed-row-main">'
    "<div class=\"ed-row-new\">'+x[1]+' '+x[2]+'</div>"
    "<div class=\"ed-row-old\">'+x[3]+'</div></div>"
    '<div onclick="edVisibToggle(\'+idx+\')" style="cursor:pointer;flex:0 0 52px;height:30px;'
    "border-radius:15px;background:'+(on?'#0ea5e9':'#cbd5e1')+';position:relative;transition:.2s;\">"
    "<div style=\"position:absolute;top:3px;'+(on?'right:3px':'left:3px')+';width:24px;height:24px;"
    "border-radius:50%;background:#fff;\"></div></div></div>'; }).join(''); "
    'return \'<div class="ed-intro">Attiva o disattiva intere <b>sezioni</b> della dashboard. '
    "Le sezioni disattivate spariscono dalla vista.</div><div class=\"ed-list\">'+rows+'</div>'; } "
    "function edVisibToggle(idx){ var sez=cdVisibSez(); var x=sez[idx]; if(!x) return; var k=x[0]; "
    "var cur=cdCfg('cd_sections')||{}; cur[k]=(cur[k]===false); "
    "localStorage.setItem('cd_sections', JSON.stringify(cur)); "
    "try { cdMarkDirty(); cdSyncPush(); } catch(e){} "
    "try { if(typeof render==='function') render(); } catch(e){} editorSwitch('visib'); } "
    "function editorRenderLuci()"
)


# ── Hide the Piano (floor) fields in the temperature section via CSS ───────
TEMP_FLOOR_CSS_ANCHOR = "<head>"
TEMP_FLOOR_CSS_REPLACEMENT = "<head><style>#ed-st2-floor,#ed-st2-flicon,#ed-st2-icon,button[onclick=\"wzPickIcon('#ed-st2-icon')\"],button[onclick=\"wzPickIcon('#ed-st2-flicon')\"]{display:none !important;}</style>"


# ── Remove the old "Nascondi/Hide" tab ─────────────────────────────────────
HIDE_TAB_IT_ANCHOR = '<button class="ed-tab" data-tab="hide"  onclick="editorSwitch(\'hide\')">👁️ Nascondi</button>'
HIDE_TAB_EN_ANCHOR = '<button class="ed-tab" data-tab="hide"  onclick="editorSwitch(\'hide\')">👁️ Hide</button>'
HIDE_TAB_REPLACEMENT = ""


# ── Hosted: use the real token for REST, and open the editor from Configura ─
# The placeholder token is fine for the WebSocket shim but invalid for the REST
# calls, which made Home Assistant log failed logins. When hosted, prefer the
# real access token the host injected in memory.
REST_TOKEN_ANCHOR = "const LONG_LIVED_TOKEN = _CONN.token ||"
REST_TOKEN_REPLACEMENT = (
    "const LONG_LIVED_TOKEN = (window.__DASHBOARDMODERN_REAL_TOKEN__) || _CONN.token ||"
)

# "Configura la dashboard" should open the editor directly when hosted, not the
# token wizard. The button is identified by its unique box-shadow.
CONFIG_BTN_ANCHOR = 'box-shadow:0 6px 16px rgba(2,132,199,0.35);">⚙️ '
CONFIG_BTN_ONCLICK_ANCHOR = 'onclick="apriSetupWizard()" style="margin'
CONFIG_BTN_ONCLICK_REPLACEMENT = 'onclick="(window.__DASHBOARDMODERN_HOSTED__ ? apriConfigEntita : apriSetupWizard)()" style="margin'


# ── Remove the 7-tap setup trigger and its mentions ────────────────────────
# Hosted, setup is opened from Configura (the editor). The hidden 7-tap gesture
# and the banner/summary lines that advertise it are removed.
SEVENTAP_HANDLER_ANCHOR = "if (taps >= 7) {"
SEVENTAP_HANDLER_REPLACEMENT = "if (false && taps >= 7) {"

SEVENTAP_BANNER_IT_ANCHOR = (
    "In alternativa: 7 tap veloci sul titolo, oppure aggiungi <b>#setup</b> all\\'URL."
)
SEVENTAP_BANNER_EN_ANCHOR = (
    "Alternatively: 7 quick taps on the title, or add <b>#setup</b> to the URL."
)
SEVENTAP_BANNER_REPLACEMENT = ""

SEVENTAP_SUMMARY_IT_ANCHOR = (
    " • Oppure <b>7 tap veloci sul titolo</b> in alto nella Home<br>"
)
SEVENTAP_SUMMARY_EN_ANCHOR = (
    " • Or <b>7 quick taps on the title</b> at the top of Home<br>"
)
SEVENTAP_SUMMARY_REPLACEMENT = ""


# Room rows: no 'undefined' when a room has no temperature sensor.
TEMP_ROW_UNDEF_ANCHOR = '<div class="ed-row-old mono">${r.temp}</div>'
TEMP_ROW_UNDEF_REPLACEMENT = '<div class="ed-row-old mono">${r.temp || ""}</div>'


# The auto-detection from the wizard, exposed as the FIRST editor tab.
RILEVA_TAB_ANCHOR = (
    '<button class="ed-tab" data-tab="sezioni" onclick="editorSwitch(\'sezioni\')">'
)
RILEVA_TAB_REPLACEMENT = (
    '<button class="ed-tab" data-tab="rileva" onclick="editorSwitch(\'rileva\')">'
    "\U0001fa84 Rileva</button>\n          "
    '<button class="ed-tab" data-tab="sezioni" onclick="editorSwitch(\'sezioni\')">'
)

RILEVA_SWITCH_ANCHOR = "if (tab === 'sezioni') body.innerHTML = editorRenderSezioni();"
RILEVA_SWITCH_REPLACEMENT = (
    "if (tab === 'rileva') body.innerHTML = editorRenderRileva();\n    "
    "if (tab === 'sezioni') body.innerHTML = editorRenderSezioni();"
)

RILEVA_RENDER_ANCHOR = "function editorRenderLuci()"
RILEVA_RENDER_REPLACEMENT = (
    "function editorRenderRileva(){"
    ' return \'<div class="ed-intro">\U0001fa84 <b>Autorilevamento</b>:'
    " analizza tutte le entit\u00e0 di Home Assistant e compila da solo luci,"
    " clima, stanze, telecamere e collegamenti. Puoi correggere tutto dopo"
    " nelle altre schede.</div>'"
    '+\'<button class="ed-btn-add" style="width:100%;"'
    ' onclick="edAutoRileva()">\U0001fa84 Avvia autorilevamento</button>\''
    '+\'<div id="ed-rileva-out" style="margin-top:10px;"></div>\'; } '
    "function edAutoRilevaLog(t){ var o=document.getElementById('ed-rileva-out');"
    " if(o) o.innerHTML='<div class=\"ed-intro\">'+t+'</div>'; } "
    "function edAutoRileva(){"
    " try { apriSetupWizard(); var wz=document.getElementById('setup-wizard');"
    " if(wz) wz.remove(); } catch(e){}"
    " edAutoRilevaLog('\u23f3 Carico tutte le entit\u00e0 da Home Assistant\u2026');"
    " try { wzLoadAllEntities(); } catch(e){}"
    " var tries=0; var t=setInterval(function(){ tries++;"
    " if (typeof WIZ!=='undefined' && WIZ && WIZ.allMeta && WIZ.allMeta.length){"
    " clearInterval(t);"
    " try { wzAutoDetect(); } catch(e){ edAutoRilevaLog('\u274c '+e.message); return; }"
    " try {"
    " if (WIZ.luci && Object.keys(WIZ.luci).length)"
    " localStorage.setItem('cd_luci', JSON.stringify(WIZ.luci));"
    " if (WIZ.stanze && WIZ.stanze.length)"
    " localStorage.setItem('cd_stanze', JSON.stringify(WIZ.stanze));"
    " if (WIZ.climaUnits && WIZ.climaUnits.length)"
    " localStorage.setItem('cd_clima_units', JSON.stringify(WIZ.climaUnits));"
    " if (WIZ.cameras && WIZ.cameras.length)"
    " localStorage.setItem('cd_cameras', JSON.stringify(WIZ.cameras));"
    " if (WIZ.entities && Object.keys(WIZ.entities).length){"
    " var ov={}; try{ ov=JSON.parse(localStorage.getItem('cd_entity_overrides'))||{};"
    " }catch(e){}"
    " Object.keys(WIZ.entities).forEach(function(k){ ov[k]=WIZ.entities[k]; });"
    " localStorage.setItem('cd_entity_overrides', JSON.stringify(ov)); }"
    " try{ cdMarkDirty(); cdSyncPush(); }catch(e){}"
    " edAutoRilevaLog('\u2705 Rilevate: '"
    "+Object.keys(WIZ.luci||{}).length+' luci \u00b7 '"
    "+(WIZ.stanze||[]).length+' stanze \u00b7 '"
    "+(WIZ.climaUnits||[]).length+' clima \u00b7 '"
    "+(WIZ.cameras||[]).length+' camere \u00b7 '"
    "+Object.keys(WIZ.entities||{}).length+' entit\u00e0.<br>Ricarico\u2026');"
    " setTimeout(function(){ location.reload(); }, 1400);"
    " } catch(e){ edAutoRilevaLog('\u274c '+e.message); }"
    " } else if (tries>40){ clearInterval(t);"
    " edAutoRilevaLog('\u274c Timeout nel caricamento entit\u00e0. Riprova.'); }"
    " }, 500); } "
    "function editorRenderLuci()"
)


# Ordered list of (label, anchor, replacement) applied by vendor_legacy.py.
FEATURE_PATCHES: tuple[tuple[str, str, str], ...] = (
    ("rileva-tab", RILEVA_TAB_ANCHOR, RILEVA_TAB_REPLACEMENT),
    ("rileva-switch", RILEVA_SWITCH_ANCHOR, RILEVA_SWITCH_REPLACEMENT),
    ("rileva-render", RILEVA_RENDER_ANCHOR, RILEVA_RENDER_REPLACEMENT),
    ("temp-row-undef?", TEMP_ROW_UNDEF_ANCHOR, TEMP_ROW_UNDEF_REPLACEMENT),
    ("room-helper", ROOM_HELPER_ANCHOR, ROOM_HELPER_REPLACEMENT),
    ("appliance-room-field", APPLIANCE_FORM_ANCHOR, APPLIANCE_FORM_REPLACEMENT),
    ("appliance-room-save", APPLIANCE_SAVE_ANCHOR, APPLIANCE_SAVE_REPLACEMENT),
    ("climate-room-field", CLIMATE_FORM_ANCHOR, CLIMATE_FORM_REPLACEMENT),
    ("climate-room-save", CLIMATE_SAVE_ANCHOR, CLIMATE_SAVE_REPLACEMENT),
    ("camera-room-field", CAMERA_FORM_ANCHOR, CAMERA_FORM_REPLACEMENT),
    ("room-select-populate", POPULATE_ANCHOR, POPULATE_REPLACEMENT),
    ("visib-tab", VIS_TAB_ANCHOR, VIS_TAB_REPLACEMENT),
    ("visib-switch", VIS_SWITCH_ANCHOR, VIS_SWITCH_REPLACEMENT),
    ("visib-render", VIS_RENDER_ANCHOR, VIS_RENDER_REPLACEMENT),
    ("rooms-tab", ROOMS_TAB_ANCHOR, ROOMS_TAB_REPLACEMENT),
    ("rooms-switch", ROOMS_SWITCH_ANCHOR, ROOMS_SWITCH_REPLACEMENT),
    ("rooms-render", ROOMS_RENDER_ANCHOR, ROOMS_RENDER_REPLACEMENT),
    ("lights-room-field", LIGHTS_FORM_ANCHOR, LIGHTS_FORM_REPLACEMENT),
    ("lights-room-save", LIGHTS_SAVE_ANCHOR, LIGHTS_SAVE_REPLACEMENT),
    ("temp-title-it?", TEMP_TITLE_ANCHOR, TEMP_TITLE_REPLACEMENT),
    ("temp-title-en?", TEMP_TITLE_ANCHOR_EN, TEMP_TITLE_REPLACEMENT),
    ("temp-name-it?", TEMP_NAME_ANCHOR_IT, TEMP_NAME_REPLACEMENT),
    ("temp-name-en?", TEMP_NAME_ANCHOR_EN, TEMP_NAME_REPLACEMENT),
    ("wizard-trigger-guard", WIZARD_TRIGGER_ANCHOR, WIZARD_TRIGGER_REPLACEMENT),
    ("wizard-skip-token-step", WIZARD_STEP_ANCHOR, WIZARD_STEP_REPLACEMENT),
    ("version-marker", VERSION_ANCHOR, VERSION_REPLACEMENT),
    ("rest-token-hosted", REST_TOKEN_ANCHOR, REST_TOKEN_REPLACEMENT),
    (
        "configura-opens-editor",
        CONFIG_BTN_ONCLICK_ANCHOR,
        CONFIG_BTN_ONCLICK_REPLACEMENT,
    ),
    ("disable-7tap", SEVENTAP_HANDLER_ANCHOR, SEVENTAP_HANDLER_REPLACEMENT),
    ("banner-7tap-it?", SEVENTAP_BANNER_IT_ANCHOR, SEVENTAP_BANNER_REPLACEMENT),
    ("banner-7tap-en?", SEVENTAP_BANNER_EN_ANCHOR, SEVENTAP_BANNER_REPLACEMENT),
    ("summary-7tap-it?", SEVENTAP_SUMMARY_IT_ANCHOR, SEVENTAP_SUMMARY_REPLACEMENT),
    ("summary-7tap-en?", SEVENTAP_SUMMARY_EN_ANCHOR, SEVENTAP_SUMMARY_REPLACEMENT),
    ("temp-hide-floor-css", TEMP_FLOOR_CSS_ANCHOR, TEMP_FLOOR_CSS_REPLACEMENT),
    ("remove-hide-tab-it?", HIDE_TAB_IT_ANCHOR, HIDE_TAB_REPLACEMENT),
    ("remove-hide-tab-en?", HIDE_TAB_EN_ANCHOR, HIDE_TAB_REPLACEMENT),
    ("brand-logo", LOGO_MARK_ANCHOR, LOGO_MARK_REPLACEMENT),
    ("temp-hide-duplicate-form?", TEMP_DUP_ANCHOR, TEMP_DUP_REPLACEMENT),
    ("camera-room-save", CAMERA_SAVE_ANCHOR, CAMERA_SAVE_REPLACEMENT),
)
