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
    "function cdRoomOf(item){ return (item && item.room) ? String(item.room) : ''; }\nfunction cdFloorNames(){ var fl=[]; try{ fl=JSON.parse(localStorage.getItem('cd_floors'))||[]; }catch(e){} var seen={}; var outv=[]; fl.forEach(function(f){ f=String(f); if(f&&!seen[f]){ seen[f]=1; outv.push(f); } }); cdRoomList().forEach(function(r){ if(r&&r.floor){ var f=String(r.floor); if(!seen[f]){ seen[f]=1; outv.push(f); } } }); return outv; }\nfunction cdFloorSelOptions(cur){ var o='<option value=\"\">— Nessun piano —</option>'; cdFloorNames().forEach(function(f){ o+='<option value=\"'+f+'\"'+(cur===f?' selected':'')+'>🏢 '+f+'</option>'; }); return o; }\nfunction cdFloorRowsHtml(){ var names=cdFloorNames(); var rows = names.length ? names.map(function(f,i){ return '<div class=\"ed-row\" style=\"align-items:center;\"><div class=\"ed-row-main\"><div class=\"ed-row-new\">🏢 '+f+'</div></div><div class=\"ed-del\" onclick=\"edFloorDel('+i+')\">🗑️</div></div>'; }).join('') : '<div class=\"ed-intro\">Nessun piano. Aggiungine uno qui sotto.</div>'; return '<div class=\"ed-intro\" style=\"margin-top:16px;\">Gestisci qui i <b>piani</b>. Ogni piano creato qui compare nel menù a tendina delle stanze.</div>'+rows+'<div style=\"display:flex;gap:8px;margin:8px 0;\"><input id=\"ed-floor-name\" class=\"ed-input\" style=\"flex:1;\" placeholder=\"Nome piano (es. Piano terra)\"><button class=\"ed-btn-add\" style=\"flex:0 0 auto;\" onclick=\"edFloorAdd()\">＋ Aggiungi piano</button></div>'; }\nfunction edFloorAdd(){ var n=(document.getElementById('ed-floor-name').value||'').trim(); if(!n) return; var fl=[]; try{ fl=JSON.parse(localStorage.getItem('cd_floors'))||[]; }catch(e){} if(fl.indexOf(n)<0) fl.push(n); localStorage.setItem('cd_floors', JSON.stringify(fl)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} editorSwitch('stanze'); }\nfunction edFloorDel(i){ var names=cdFloorNames(); var n=names[i]; if(!n) return; var fl=[]; try{ fl=JSON.parse(localStorage.getItem('cd_floors'))||[]; }catch(e){} fl=fl.filter(function(x){ return x!==n; }); localStorage.setItem('cd_floors', JSON.stringify(fl)); var rooms=cdRoomList().slice(); var ch=false; rooms.forEach(function(r){ if(r&&r.floor===n){ delete r.floor; ch=true; } }); if(ch) localStorage.setItem('cd_stanze', JSON.stringify(rooms)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} editorSwitch('stanze'); }\n"
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
    '+\'<div style="display:flex;gap:8px;margin-bottom:8px;"><input id="ed-room-icon" class="ed-input" style="flex:0 0 60px;text-align:center;" placeholder="🏠" value="🏠"><input id="ed-room-name" class="ed-input" style="flex:1;" placeholder="Nome stanza (es. Cucina)"></div><select id="ed-room-floor" class="ed-input" style="margin-bottom:8px;">\'+cdFloorSelOptions()+\'</select>\''
    "+'<button class=\"ed-btn-add\" onclick=\"edStanzaRoomAdd()\">＋ Aggiungi stanza</button>'+cdFloorRowsHtml()+''"
    "+'</div>'; } "
    "function edStanzaRoomAdd(){ var name=(document.getElementById('ed-room-name').value||'').trim(); "
    "if(!name){ alert('Inserisci il nome della stanza'); return; } "
    "var icon=(document.getElementById('ed-room-icon').value||'🏠').trim(); "
    "var floor=(document.getElementById('ed-room-floor').value||'').trim(); if(floor==='__new__') floor=''; "
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
VERSION_REPLACEMENT = "const DASHBOARD_VERSION = '0.12.3-int';"

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
    "function e2Gen(v){ return String(v||'').replace(/'/g,'&#39;'); } "
    "function cdGenHtml(){ var br=cdCfg('cd_branding')||{}; var cn2=cdCfg('cd_connection')||{}; var adm=(cn2.admin_users&&cn2.admin_users[0])||''; "
    "return \"<div class='ed-intro'><b>Generali</b>: nome della dashboard e utente amministratore.</div>\" "
    "+\"<input id='ed-gen-title' class='ed-input' style='margin-bottom:8px;' placeholder='Nome dashboard (es. SMART HOME)' value='\"+e2Gen(br.title)+\"'>\" "
    "+\"<input id='ed-gen-sub' class='ed-input' style='margin-bottom:8px;' placeholder='Sottotitolo' value='\"+e2Gen(br.subtitle)+\"'>\" "
    "+\"<input id='ed-gen-admin' class='ed-input' style='margin-bottom:8px;' placeholder='Utente admin (vuoto = Config visibile a tutti)' value='\"+e2Gen(adm)+\"'>\" "
    "+\"<button class='ed-btn-add' style='width:100%;margin-bottom:16px;' onclick='edSaveGeneral()'>💾 Salva generali</button>\"; } "
    "function edSaveGeneral(){ var t=(document.getElementById('ed-gen-title').value||'').trim(); var st2=(document.getElementById('ed-gen-sub').value||'').trim(); var a=(document.getElementById('ed-gen-admin').value||'').trim(); var br=cdCfg('cd_branding')||{}; if(t) br.title=t; else delete br.title; if(st2) br.subtitle=st2; else delete br.subtitle; localStorage.setItem('cd_branding', JSON.stringify(br)); var cn=cdCfg('cd_connection')||{}; cn.admin_users = a ? [a] : []; localStorage.setItem('cd_connection', JSON.stringify(cn)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} try{ edToast('Salvato'); }catch(e){} setTimeout(function(){ location.reload(); }, 700); } "
    "function editorRenderVisib(){ var sez=cdVisibSez(); var cur=cdCfg('cd_sections')||{}; "
    "var rows=sez.map(function(x,idx){ var k=x[0]; var on=(cur[k]!==false); "
    'return \'<div class="ed-row" style="align-items:center;"><div class="ed-row-main">'
    "<div class=\"ed-row-new\">'+x[1]+' '+x[2]+'</div>"
    "<div class=\"ed-row-old\">'+x[3]+'</div></div>"
    '<div onclick="edVisibToggle(\'+idx+\')" style="cursor:pointer;flex:0 0 52px;height:30px;'
    "border-radius:15px;background:'+(on?'#0ea5e9':'#cbd5e1')+';position:relative;transition:.2s;\">"
    "<div style=\"position:absolute;top:3px;'+(on?'right:3px':'left:3px')+';width:24px;height:24px;"
    "border-radius:50%;background:#fff;\"></div></div></div>'; }).join(''); "
    'return cdGenHtml()+\'<div class="ed-intro">Attiva o disattiva intere <b>sezioni</b> della dashboard. '
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
REST_TOKEN_REPLACEMENT = "const LONG_LIVED_TOKEN = window.__DASHBOARDMODERN_HOSTED__ ? (window.__DASHBOARDMODERN_REAL_TOKEN__ || '') : _CONN.token ||"

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
    '<button class="ed-tab" data-tab="visib" onclick="editorSwitch(\'visib\')">'
    "\u2699\ufe0f Impostazioni</button>\n          "
    '<button class="ed-tab" data-tab="sezioni" onclick="editorSwitch(\'sezioni\')">'
)

RILEVA_SWITCH_ANCHOR = "if (tab === 'sezioni') body.innerHTML = editorRenderSezioni();"
RILEVA_SWITCH_REPLACEMENT = (
    "if (tab === 'rileva') body.innerHTML = editorRenderRileva();\n    "
    "if (tab === 'sezioni') body.innerHTML = editorRenderSezioni();"
)

RILEVA_RENDER_ANCHOR = "function editorRenderLuci()"
RILEVA_RENDER_REPLACEMENT = (
    "function cdDbgStatus(){ try { return '<div class=\"ed-intro mono\" style=\"font-size:11px;opacity:0.75;\">v'+(typeof DASHBOARD_VERSION==='undefined'?'?':DASHBOARD_VERSION)+' | hosted:'+(window.__DASHBOARDMODERN_HOSTED__?1:0)+' | bridge:'+(window.__DASHBOARDMODERN_BRIDGED__?1:0)+' | token:'+(window.__DASHBOARDMODERN_REAL_TOKEN__?1:0)+' | sync:'+(localStorage.getItem('cd_sync_ts')||0)+'</div>'; } catch(e){ return ''; } } function editorRenderRileva(){ var st=cdDbgStatus();"
    ' return st+\'<div class="ed-intro">\U0001fa84 <b>Autorilevamento</b>:'
    " analizza tutte le entit\u00e0 di Home Assistant e compila da solo luci,"
    " clima, stanze, telecamere e collegamenti. Puoi correggere tutto dopo"
    " nelle altre schede.</div>'"
    '+\'<button class="ed-btn-add" style="width:100%;"'
    ' onclick="edAutoRileva()">\U0001fa84 Avvia autorilevamento</button>\''
    '+\'<div id="ed-rileva-out" style="margin-top:10px;"></div>\''
    '+\'<div style="margin-top:22px;border-top:1px solid rgba(220,38,38,0.3);padding-top:12px;"><button class="ed-btn-add" style="width:100%;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;" onclick="wzResetAll()">🗑️ Reset totale configurazione</button></div>\'; } '
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


# Hosted: dedicated user_data sync key, never shared with a standalone plancia.
SYNC_KEY_ANCHOR = "'dashboard_modern_config'"
SYNC_KEY_REPLACEMENT = (
    "(window.__DASHBOARDMODERN_HOSTED__"
    " ? 'dashboardmodern_integration_config'"
    " : 'dashboard' + '_modern_config')"
)

# ── Temperature rows: rooms are managed only from the Rooms tab ────────────
TEMP_DEL_ED_ANCHOR = '<div class="ed-del" onclick="edDelStanza(${i})">🗑️</div>'
TEMP_DEL_WZ_ANCHOR = (
    '<div class="ed-del" onclick="WIZ.stanze.splice(${i},1); wzRender();">🗑️</div>'
)
TEMP_DEL_REPLACEMENT = ""


# Temperature rows are display-only: no edit pencil in either render path.
TEMP_PEN_ED_ANCHOR = (
    '<div class="ed-del" style="background:rgba(14,165,233,0.12);"'
    ' onclick="edEditStanza2(${i})">✏️</div>'
)
TEMP_PEN_WZ_ANCHOR = (
    '<div class="ed-del" style="background:rgba(14,165,233,0.12);"'
    ' onclick="wzEditStanza(${i})">✏️</div>'
)
TEMP_PEN_REPLACEMENT = ""

# Adding with an existing room selected updates that room instead of
# duplicating it — the dropdown is the only way to reference rooms now.
TEMP_MERGE_ANCHOR = (
    "edSaveFloorIcon(floor);\n"
    "    rooms.push(r);\n"
    "    localStorage.setItem('cd_stanze', JSON.stringify(rooms));"
)
TEMP_MERGE_REPLACEMENT = (
    "edSaveFloorIcon(floor);\n"
    "    var _ex = -1;"
    " for (var _q = 0; _q < rooms.length; _q++) {"
    " if (rooms[_q] && rooms[_q].name === name) { _ex = _q; break; } }\n"
    "    if (_ex >= 0) { rooms[_ex].temp = temp;"
    " if (hum) rooms[_ex].hum = hum; else delete rooms[_ex].hum;"
    " if (floor) rooms[_ex].floor = floor;"
    " } else { rooms.push(r); }\n"
    "    localStorage.setItem('cd_stanze', JSON.stringify(rooms));"
)


# The temperature section lists only rooms that HAVE a temperature sensor;
# the registry itself lives in the Rooms tab. The original index is kept, so
# the reorder arrows still address the right cd_stanze entries.
TEMP_ROWS_ED_ANCHOR = "const stanzeRows = stanze.map((r, i) => `"
TEMP_ROWS_ED_REPLACEMENT = (
    "const stanzeRows = stanze.map((r, i) => !(r && r.temp) ? '' : `"
)

TEMP_ROWS_WZ_ANCHOR = '${(WIZ.stanze||[]).map((r, i) => `<div class="ed-row">'
TEMP_ROWS_WZ_REPLACEMENT = (
    "${(WIZ.stanze||[]).map((r, i) => !(r && r.temp) ? '' : `<div class=\"ed-row\">"
)

# The dashboard navbar names the section for what it shows.
NAV_TEMP_IT_ANCHOR = (
    'data-tab="temp"><span class="icon">🌡️</span><span class="text">Stanze</span>'
)
NAV_TEMP_IT_REPLACEMENT = (
    'data-tab="temp"><span class="icon">🌡️</span><span class="text">Temperatura</span>'
)
NAV_TEMP_EN_ANCHOR = (
    'data-tab="temp"><span class="icon">🌡️</span><span class="text">Rooms</span>'
)
NAV_TEMP_EN_REPLACEMENT = (
    'data-tab="temp"><span class="icon">🌡️</span><span class="text">Temperature</span>'
)


# The navbar tab for the temperature section says Temperatura, not Stanze.

# The temperature section lists only rooms that actually have a temperature
# sensor; registry-only rooms live in the Rooms tab. The original array index
# is preserved so the reorder arrows keep pointing at the right entry.


# The empty-state banner re-checks after connection: the cloud restore can
# land after the one-shot boot check, leaving a connected-but-unconfigured
# dashboard with no way in. cdEmptyStateCheck is idempotent.
BANNER_ON_CONNECT_ANCHOR = "setTimeout(cdTotalsRun, 2500);"
BANNER_ON_CONNECT_REPLACEMENT = (
    "setTimeout(cdTotalsRun, 2500);"
    " try { setTimeout(cdEmptyStateCheck, 1200);"
    " setTimeout(cdEmptyStateCheck, 4000); } catch(e) {}"
)

# The wizard is retired from the UI: its card leaves the Config page and
# its entry leaves the app menu. apriSetupWizard stays defined because the
# Rileva flow initializes WIZ through it, invisibly.
WIZ_CARD_IT_ANCHOR = '<!-- Setup Wizard -->\n      <div class="cfg-card" onclick="apriSetupWizard()">\n        <div class="cfg-card-ico" style="--cc-rgb: 14,165,233;">🧙</div>\n        <div class="cfg-card-txt">\n          <div class="cfg-card-nm">Setup Wizard</div>\n          <div class="cfg-card-ds">Configurazione guidata: connessione, nome, sezioni, luci, entità e telecamere</div>\n        </div>\n        <div class="cfg-card-arrow">›</div>\n      </div>'
WIZ_CARD_EN_ANCHOR = '<!-- Setup Wizard -->\n      <div class="cfg-card" onclick="apriSetupWizard()">\n        <div class="cfg-card-ico" style="--cc-rgb: 14,165,233;">🧙</div>\n        <div class="cfg-card-txt">\n          <div class="cfg-card-nm">Setup Wizard</div>\n          <div class="cfg-card-ds">Guided setup: connection, name, sections, lights, entities and cameras</div>\n        </div>\n        <div class="cfg-card-arrow">›</div>\n      </div>'
WIZ_CARD_REPLACEMENT = ""

WIZ_MENU_IT_ANCHOR = (
    "card.appendChild(mkItem('\U0001f9d9', 'Riconfigura (wizard)',"
    " () => apriSetupWizard()));"
)
WIZ_MENU_EN_ANCHOR = (
    "card.appendChild(mkItem('\U0001f9d9', 'Reconfigure (wizard)',"
    " () => apriSetupWizard()));"
)
WIZ_MENU_REPLACEMENT = ""

# The reset confirm no longer promises a wizard.
RESET_TXT_IT_ANCHOR = "Dovrai rifare il wizard."
RESET_TXT_IT_REPLACEMENT = "Poi riconfiguri tutto dal pannello Config."
RESET_TXT_EN_ANCHOR = "You will need to run the wizard again."
RESET_TXT_EN_REPLACEMENT = "Then reconfigure from the editor."

# Every entity field uses the magnifier picker, like the temperature
# section: the native datalist dropdown is removed and a search button
# (wzPickEntity) is added, wrapped in a flex row.
LENS_1_A = '<input id="ed-ov-old" list="ed-entity-list" class="ed-input mono" placeholder="Entità attuale (in dashboard)">'
LENS_1_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-ov-old" style="flex:1;" class="ed-input mono" placeholder="Entità attuale (in dashboard)"><button type="button" onclick="wzPickEntity(\'#ed-ov-old\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_2_A = '<input id="ed-ov-new" list="ed-entity-list" class="ed-input mono" placeholder="Nuova entità (sostituto)">'
LENS_2_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-ov-new" style="flex:1;" class="ed-input mono" placeholder="Nuova entità (sostituto)"><button type="button" onclick="wzPickEntity(\'#ed-ov-new\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_3_A = '<input id="ed-load-pwr" list="ed-entity-list" class="ed-input mono" placeholder="sensor.tostapane_power">'
LENS_3_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-load-pwr" style="flex:1;" class="ed-input mono" placeholder="sensor.tostapane_power"><button type="button" onclick="wzPickEntity(\'#ed-load-pwr\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_4_A = '<input id="ed-st-temp" list="ed-entity-list" class="ed-input mono" placeholder="sensor.temperatura_x (temperatura)">'
LENS_4_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-st-temp" style="flex:1;" class="ed-input mono" placeholder="sensor.temperatura_x (temperatura)"><button type="button" onclick="wzPickEntity(\'#ed-st-temp\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_5_A = '<input id="ed-st-hum" list="ed-entity-list" class="ed-input mono" placeholder="sensor.umidita_x (facoltativo — auto se vuoto)">'
LENS_5_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-st-hum" style="flex:1;" class="ed-input mono" placeholder="sensor.umidita_x (facoltativo — auto se vuoto)"><button type="button" onclick="wzPickEntity(\'#ed-st-hum\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_6_A = '<input id="ed-cl-ent" list="ed-entity-list" class="ed-input mono" placeholder="climate.studio">'
LENS_6_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-cl-ent" style="flex:1;" class="ed-input mono" placeholder="climate.studio"><button type="button" onclick="wzPickEntity(\'#ed-cl-ent\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_7_A = '<input id="ed-cam-ent" list="ed-entity-list" class="ed-input mono" placeholder="camera.giardino">'
LENS_7_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-cam-ent" style="flex:1;" class="ed-input mono" placeholder="camera.giardino"><button type="button" onclick="wzPickEntity(\'#ed-cam-ent\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_8_A = '<input id="ed-ov-old" list="ed-entity-list" class="ed-input mono" placeholder="Entità attuale (in dashboard)">'
LENS_8_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-ov-old" style="flex:1;" class="ed-input mono" placeholder="Entità attuale (in dashboard)"><button type="button" onclick="wzPickEntity(\'#ed-ov-old\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_9_A = '<input id="ed-ov-new" list="ed-entity-list" class="ed-input mono" placeholder="Nuova entità (sostituto)">'
LENS_9_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-ov-new" style="flex:1;" class="ed-input mono" placeholder="Nuova entità (sostituto)"><button type="button" onclick="wzPickEntity(\'#ed-ov-new\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_10_A = '<input id="ed-load-pwr" list="ed-entity-list" class="ed-input mono" placeholder="sensor.tostapane_power">'
LENS_10_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-load-pwr" style="flex:1;" class="ed-input mono" placeholder="sensor.tostapane_power"><button type="button" onclick="wzPickEntity(\'#ed-load-pwr\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_11_A = '<input id="ed-st-temp" list="ed-entity-list" class="ed-input mono" placeholder="sensor.temperature_x (temperatura)">'
LENS_11_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-st-temp" style="flex:1;" class="ed-input mono" placeholder="sensor.temperature_x (temperatura)"><button type="button" onclick="wzPickEntity(\'#ed-st-temp\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_12_A = '<input id="ed-st-hum" list="ed-entity-list" class="ed-input mono" placeholder="sensor.umidita_x (optional — auto if empty)">'
LENS_12_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-st-hum" style="flex:1;" class="ed-input mono" placeholder="sensor.umidita_x (optional — auto if empty)"><button type="button" onclick="wzPickEntity(\'#ed-st-hum\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_13_A = '<input id="ed-cl-ent" list="ed-entity-list" class="ed-input mono" placeholder="climate.studio">'
LENS_13_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-cl-ent" style="flex:1;" class="ed-input mono" placeholder="climate.studio"><button type="button" onclick="wzPickEntity(\'#ed-cl-ent\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
LENS_14_A = '<input id="ed-cam-ent" list="ed-entity-list" class="ed-input mono" placeholder="camera.giardino">'
LENS_14_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-cam-ent" style="flex:1;" class="ed-input mono" placeholder="camera.giardino"><button type="button" onclick="wzPickEntity(\'#ed-cam-ent\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'

# The entity picker also accepts a DOM element as its target: slot inputs
# have no id, so their magnifier passes the input element itself; a change
# event is dispatched so edSetSlot persists the choice.
EPCHOOSE_ANCHOR = "function cdEpChoose(id) {\n    const ref = window._cdEpRef;\n    document.getElementById('cd-entpick')?.remove();\n    if (ref"
EPCHOOSE_REPLACEMENT = "function cdEpChoose(id) {\n    const ref = window._cdEpRef;\n    document.getElementById('cd-entpick')?.remove();\n    if (ref && ref.nodeType === 1) { ref.value = id; try { ref.dispatchEvent(new Event('change')); } catch(e) {} return; } if (ref"

SLOT_1_A = '<input class="ed-input mono ed-slot-in" list="ed-entity-list" data-ref="switch.caldaia"\n                     value="${ENTITY_OVERRIDES[\'switch.caldaia\'] || \'\'}" placeholder="es. dm.core_049" onchange="edSetSlot(this)">'
SLOT_1_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input style="flex:1;" class="ed-input mono ed-slot-in" data-ref="switch.caldaia"\n                     value="${ENTITY_OVERRIDES[\'switch.caldaia\'] || \'\'}" placeholder="es. dm.core_049" onchange="edSetSlot(this)"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'
SLOT_2_A = '<input class="ed-input mono ed-slot-in" list="ed-entity-list" data-ref="switch.caldaia" value="${ENTITY_OVERRIDES[\'switch.caldaia\'] || \'\'}" placeholder="switch.caldaia" onchange="edSetSlot(this)">'
SLOT_2_R = '<div style="display:flex; gap:8px; margin-bottom:6px;"><input style="flex:1;" class="ed-input mono ed-slot-in" data-ref="switch.caldaia" value="${ENTITY_OVERRIDES[\'switch.caldaia\'] || \'\'}" placeholder="switch.caldaia" onchange="edSetSlot(this)"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'

# Floor->room grouping: shared helper plus grouped Clima grids. Items with
# a room are sorted by registry-floor order, then room, and full-width
# headers are inserted whenever the (floor, room) pair changes.
GROUP_HELPER_ANCHOR = "function buildClimaCards() {"
GROUP_HELPER_REPLACEMENT = "function cdRoomFloorOf(roomName){ if(!roomName) return ''; var rs=(typeof getStanze==='function'?getStanze():[]); for(var i=0;i<rs.length;i++){ if(rs[i]&&rs[i].name===roomName) return rs[i].floor||''; } return ''; } function cdGroupCards(items, cardFn){ try { var anyRoom=false; items.forEach(function(u){ if(u&&u.room) anyRoom=true; }); if(!anyRoom) return items.map(cardFn).join(''); var floors=(typeof cdFloorNames==='function'?cdFloorNames():[]); function fIdx(f){ var i=floors.indexOf(f); return i<0?9999:i; } var sorted=items.slice().sort(function(a,b){ var fa=cdRoomFloorOf(a.room), fb=cdRoomFloorOf(b.room); if(fIdx(fa)!==fIdx(fb)) return fIdx(fa)-fIdx(fb); var ra=a.room||'zzzz', rb=b.room||'zzzz'; if(ra!==rb) return ra<rb?-1:1; return 0; }); var out=''; var lastKey=null; sorted.forEach(function(u){ var f=cdRoomFloorOf(u.room); var key=(f||'')+'|'+(u.room||''); if(key!==lastKey){ lastKey=key; var lbl = u.room ? ((f?('🏢 '+f+' · '):'')+'🏠 '+u.room) : '🏠 Senza stanza'; out += '<div style=\"grid-column:1/-1; font-weight:800; opacity:0.75; font-size:13px; letter-spacing:0.5px; padding:8px 2px 0;\">'+lbl+'</div>'; } out += cardFn(u); }); return out; } catch(e){ return items.map(cardFn).join(''); } } function buildClimaCards() {"

CLIMA_GROUP_F_ANCHOR = "gF.innerHTML = uFreddo.map(card).join('') ||"
CLIMA_GROUP_F_REPLACEMENT = "gF.innerHTML = cdGroupCards(uFreddo, card) ||"
CLIMA_GROUP_C_ANCHOR = "gC.innerHTML = uCaldo.map(card).join('') ||"
CLIMA_GROUP_C_REPLACEMENT = "gC.innerHTML = cdGroupCards(uCaldo, card) ||"

TEMPCARD_1_A = 'return `<div class="temp-card tc2" style="--tc-rgb:${rgb};" onclick="apriStorico(event, \'${temp}\', \'${nm}\')">\n          <span class="temp-comfort-badge tc2-badge" id="tc_${tid}">—</span>\n          <div class="tc2-head">\n            <div class="tc2-ico">${r.icon||\'🏠\'}</div>\n            <div class="tc2-name">${r.name}</div>\n          </div>\n          <div class="tc2-body">\n            <div class="tc2-temp"><span class="temp-value" id="tv_${tid}">—</span><span class="tc2-deg">°C</span></div>\n            <div class="tc2-hum" onclick="event.stopPropagation(); apriStorico(event, \'${hum}\', \'${nm} Umidità\')">💧 <span class="temp-hum-val" id="hv_${hid}">—%</span></div>\n          </div>\n        </div>`;'
TEMPCARD_1_R = 'return `<div class="cp-card" onclick="apriStorico(event, \'${temp}\', \'${nm}\')" style="--cp-rgb: 148, 163, 184;"> <div class="cp-header"> <div class="cp-title-wrap"><div class="cp-icon">${r.icon||\'🏠\'}</div><div class="cp-name">${r.name}</div></div> <div class="cp-badge temp-comfort-badge" id="tc_${tid}">—</div> </div> <div class="cp-body"> <div class="cp-temp-target" onclick="event.stopPropagation(); apriStorico(event, \'${hum}\', \'${nm} Umidità\')"><span class="lbl">💧 Umidità</span><span class="val temp-hum-val" id="hv_${hid}">—%</span></div> <div class="cp-temp-current-wrap"><span class="cp-temp-current-lbl">Temperatura</span><span class="cp-temp-current temp-value" id="tv_${tid}">—</span></div> </div> </div>`;'

TEMPCARD_2_A = 'return `<div class="temp-card tc2" style="--tc-rgb:${rgb};" onclick="apriStorico(event, \'${temp}\', \'${nm}\')">\n          <span class="temp-comfort-badge tc2-badge" id="tc_${tid}">—</span>\n          <div class="tc2-head">\n            <div class="tc2-ico">${r.icon||\'🏠\'}</div>\n            <div class="tc2-name">${r.name}</div>\n          </div>\n          <div class="tc2-body">\n            <div class="tc2-temp"><span class="temp-value" id="tv_${tid}">—</span><span class="tc2-deg">°C</span></div>\n            <div class="tc2-hum" onclick="event.stopPropagation(); apriStorico(event, \'${hum}\', \'${nm} Umidità\')">💧 <span class="temp-hum-val" id="hv_${hid}">—%</span></div>\n          </div>\n        </div>`;'
TEMPCARD_2_R = 'return `<div class="cp-card" onclick="apriStorico(event, \'${temp}\', \'${nm}\')" style="--cp-rgb: 148, 163, 184;"> <div class="cp-header"> <div class="cp-title-wrap"><div class="cp-icon">${r.icon||\'🏠\'}</div><div class="cp-name">${r.name}</div></div> <div class="cp-badge temp-comfort-badge" id="tc_${tid}">—</div> </div> <div class="cp-body"> <div class="cp-temp-target" onclick="event.stopPropagation(); apriStorico(event, \'${hum}\', \'${nm} Humidity\')"><span class="lbl">💧 Humidity</span><span class="val temp-hum-val" id="hv_${hid}">—%</span></div> <div class="cp-temp-current-wrap"><span class="cp-temp-current-lbl">Temperature</span><span class="cp-temp-current temp-value" id="tv_${tid}">—</span></div> </div> </div>`;'

# Floor level in the lights popup and grouped appliances.
LUCI_FLOOR_HEAD_ANCHOR = "const singole = [];"
LUCI_FLOOR_HEAD_REPLACEMENT = "const singole = [];\n        let _lastFloor = null;\n        try { if (typeof cdRoomFloorOf === 'function' && typeof cdFloorNames === 'function') {\n          const _fl = cdFloorNames();\n          const _fi = (f) => { const x = _fl.indexOf(f); return x < 0 ? 9999 : x; };\n          const _pos = {}; ordine.forEach((z, ix) => { _pos[z] = ix; });\n          ordine.sort((a, b) => {\n            const d = _fi(cdRoomFloorOf(a)) - _fi(cdRoomFloorOf(b));\n            return d !== 0 ? d : (_pos[a] - _pos[b]);\n          });\n        } } catch(e) {}"
LUCI_FLOOR_ZONA_ANCHOR = 'html += `<div class="lgx-zona">${zona.toUpperCase()}</div>`;'
LUCI_FLOOR_ZONA_REPLACEMENT = 'try { const _f = cdRoomFloorOf(zona); if (_f && _f !== _lastFloor) { _lastFloor = _f; html += `<div class="lgx-zona" style="opacity:0.7; font-size:12px; letter-spacing:1.2px;">🏢 ${_f.toUpperCase()}</div>`; } } catch(e) {}\n        html += `<div class="lgx-zona">${zona.toUpperCase()}</div>`;'
APPL_GROUP_HEAD_ANCHOR = (
    "grid.innerHTML=list.map((a,i)=>{\n    const s=cdApplStatus(a);"
)
APPL_GROUP_HEAD_REPLACEMENT = "grid.innerHTML=cdGroupCards(list.map((a,_ai)=>Object.assign({},a,{_idx:_ai})), (a)=>{\n    const i=a._idx;\n    const s=cdApplStatus(a);"
APPL_GROUP_TAIL_ANCHOR = "+'<div class=\"appl-st '+s.cls+'\">'+s.label+'</div></div>';\n  }).join('');\n}\nfunction apriApplianceDetail"
APPL_GROUP_TAIL_REPLACEMENT = "+'<div class=\"appl-st '+s.cls+'\">'+s.label+'</div></div>';\n  });\n}\nfunction apriApplianceDetail"

# Room assignment for appliances in the editor, and the lights room list
# offers the registry rooms so names match and floors resolve.
APPL_ROOM_FORM_ANCHOR = 'id="appl-icon" value="\'+curIcon+\'"></div>\''
APPL_ROOM_FORM_REPLACEMENT = (
    APPL_ROOM_FORM_ANCHOR  # select duplicato rimosso: resta quello etichettato STANZA
)
APPL_ROOM_SAVE_ANCHOR = "const item={ id:'appl_'+Date.now().toString(36), name:name||cdApplianceName(icon), icon, entities, threshold_run:isNaN(thr)?5:thr, threshold_standby:1 };"
APPL_ROOM_SAVE_REPLACEMENT = "const item={ id:'appl_'+Date.now().toString(36), name:name||cdApplianceName(icon), icon, entities, threshold_run:isNaN(thr)?5:thr, threshold_standby:1 }; const _rm=((document.getElementById('appl-room')||{}).value||'').trim(); if(_rm) item.room=_rm;"
LUCI_ROOMS_REGISTRY_ANCHOR = "=> { const r = cdLightRoom(id); if (r && !set.includes(r)) set.push(r); });\n    return set;"
LUCI_ROOMS_REGISTRY_REPLACEMENT = "=> { const r = cdLightRoom(id); if (r && !set.includes(r)) set.push(r); });\n    try { (typeof getStanze==='function'?getStanze():[]).forEach(r => { if (r && r.name && !set.includes(r.name)) set.push(r.name); }); } catch(e) {} return set;"

# Appliances feed the Report (panoramica + analisi) automatically: any
# appliance whose entities include an energy sensor (device_class energy
# or a kWh/Wh unit) yields a report entry, appended after the manual ones
# and deduped by entity and name. The rebuild re-runs after connection so
# STATES attributes are available for the detection.
REP_HELPER_ANCHOR = "function cdRebuildReportDevices() {"
REP_HELPER_REPLACEMENT = "function cdApplReportEntries(manual){ try { var used = {}; (manual||[]).forEach(function(d){ if(d){ if(d.entity) used[d.entity]=1; if(d.name) used['n:'+d.name]=1; } }); var em = {lavatrice:'🧺', lavastoviglie:'🍽️', asciugatrice:'🌀', forno:'🍕', microonde:'⚡', frigo:'🧊', freezer:'❄️', tv:'📺', pc:'🖥️', caffe:'☕', friggitrice:'🍟', boiler:'🌞', phon:'💨', stufa:'🔥'}; var outv = []; (typeof getAppliances==='function'?getAppliances():[]).forEach(function(a){ if(!a || !a.entities || !a.entities.length || used['n:'+a.name]) return; var ent = null; (a.entities||[]).forEach(function(e){ if(ent) return; var id = (typeof e==='string')?e:(e&&e.entity); if(!id) return; var st = (typeof STATES!=='undefined') ? STATES[id] : null; var at = (st&&st.attributes)||{}; var u = String(at.unit_of_measurement||'').toLowerCase(); if (at.device_class==='energy' || u==='kwh' || u==='wh') ent = id; }); if(!ent || used[ent]) return; used[ent]=1; outv.push({ name: a.name, icon: em[a.icon] || '🔌', entity: ent }); }); return outv; } catch(e){ return []; } } function cdRebuildReportDevices() {"
REP_CONCAT_ANCHOR = "const _repDevs = cdCfgList('cd_report_devices');"
REP_CONCAT_REPLACEMENT = (
    "const _repDevs = cdCfgList('cd_report_devices')"
    ".concat(cdApplReportEntries(cdCfgList('cd_report_devices')));"
)
REP_RERUN_ANCHOR = "setTimeout(cdTotalsRun, 2500);"
REP_RERUN_REPLACEMENT = (
    "setTimeout(cdTotalsRun, 2500);"
    " try { setTimeout(function(){ try{ cdRebuildReportDevices();"
    " buildReportSelect(); }catch(e2){} }, 2600); } catch(e) {}"
)

# Tapparelle: full new section (page, navbar, editor, sync).
TAPP_1_A = "<head>"
TAPP_1_R = "<head><style>.tapp-card{background:var(--card-bg,#fff);border-radius:16px;padding:12px;box-shadow:0 4px 14px rgba(15,23,42,0.08);display:flex;flex-direction:column;gap:8px}.tapp-head{display:flex;justify-content:space-between;align-items:center;gap:6px}.tapp-name{font-weight:800;font-size:14px}.tapp-state{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(100,116,139,0.15)}.tapp-st-open{background:rgba(16,185,129,0.18);color:#059669}.tapp-st-closed{background:rgba(100,116,139,0.22);color:#475569}.tapp-st-opening,.tapp-st-closing{background:rgba(14,165,233,0.18);color:#0284c7}.tapp-win{position:relative;height:110px;border:3px solid #64748b;border-radius:8px;overflow:hidden;background:linear-gradient(180deg,#bae6fd,#e0f2fe)}.tapp-glass{position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.35),transparent 60%)}.tapp-shutter{position:absolute;left:0;right:0;top:0;overflow:hidden;transition:height 1s ease;display:flex;flex-direction:column;justify-content:flex-end}.tapp-shutter i{display:block;flex:0 0 12px;height:12px;border-bottom:2px solid rgba(51,65,85,0.55);background:linear-gradient(180deg,#cbd5e1,#94a3b8)}.tapp-shutter.opening i,.tapp-shutter.closing i{animation:tappSlat 0.7s linear infinite}@keyframes tappSlat{0%{filter:brightness(1)}50%{filter:brightness(1.22)}100%{filter:brightness(1)}}.tapp-pos{font-size:11px;text-align:center;opacity:0.7;min-height:14px}.tapp-ctl{display:flex;gap:6px}.tapp-btn{flex:1;height:34px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;font-size:14px;cursor:pointer}</style>"
TAPP_2_A = '<section class="page" id="page-server">'
TAPP_2_R = '<section class="page" id="page-tapparelle">\n  <div style="max-width:1000px;margin:0 auto;">\n    <div id="tapp-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;padding:10px 4px;"></div>\n  </div>\n  </section>\n\n  <section class="page" id="page-server">'
TAPP_3_A = "function toggleVentola()"
TAPP_3_R = "function getTapparelle(){ try { return JSON.parse(localStorage.getItem('cd_tapparelle'))||[]; } catch(e){ return []; } } function cdTappCmd(btn){ try { if(navigator.vibrate) navigator.vibrate(15); var card=btn.closest('[data-tapp]'); var ent=card&&card.getAttribute('data-tapp'); var svc=btn.getAttribute('data-svc'); if(!ent||!svc||!ws||ws.readyState!==1) return; ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'cover', service:svc, target:{ entity_id: ent } })); } catch(e){} } function cdTappCard(t){ var st=(typeof STATES!=='undefined'&&STATES[t.entity])?STATES[t.entity]:null; var state=st?String(st.state):'unknown'; var hasPos=!!(st&&st.attributes&&st.attributes.current_position!=null); var pos=hasPos?Math.max(0,Math.min(100,+st.attributes.current_position)):(state==='open'?100:(state==='closed'?0:50)); var moving=(state==='opening'||state==='closing'); var lbl=state==='open'?'Aperta':state==='closed'?'Chiusa':state==='opening'?'In apertura':state==='closing'?'In chiusura':'—'; var shutterH=100-pos; var nm=String(t.name||t.entity).replace(/</g,'&lt;'); return '<div class=\"tapp-card\" data-tapp=\"'+t.entity+'\">'+'<div class=\"tapp-head\"><span class=\"tapp-name\">'+nm+'</span>'+'<span class=\"tapp-state tapp-st-'+state+'\">'+lbl+'</span></div>'+'<div class=\"tapp-win\"><div class=\"tapp-glass\"></div>'+'<div class=\"tapp-shutter'+(state==='opening'?' opening':'')+(state==='closing'?' closing':'')+'\" style=\"height:'+shutterH+'%;\">'+'<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>'+'<div class=\"tapp-pos\">'+(hasPos?(pos+'%'):'')+'</div>'+'<div class=\"tapp-ctl\">'+'<button class=\"tapp-btn\" data-svc=\"open_cover\" onclick=\"cdTappCmd(this)\">▲</button>'+'<button class=\"tapp-btn\" data-svc=\"stop_cover\" onclick=\"cdTappCmd(this)\">■</button>'+'<button class=\"tapp-btn\" data-svc=\"close_cover\" onclick=\"cdTappCmd(this)\">▼</button>'+'</div></div>'; } function renderTapparelle(){ var grid=document.getElementById('tapp-grid'); if(!grid) return; var list=getTapparelle(); var tab=document.getElementById('tab-tapparelle'); if(tab) tab.style.display=list.length?'':'none'; if(!list.length){ grid.innerHTML='<div class=\"ed-empty\" style=\"grid-column:1/-1;\">Nessuna tapparella configurata</div>'; return; } grid.innerHTML=cdGroupCards(list, cdTappCard); } setInterval(function(){ try { var tab=document.getElementById('tab-tapparelle'); if(tab) tab.style.display=getTapparelle().length?'':'none'; var pg=document.getElementById('page-tapparelle'); if(pg && pg.offsetParent!==null) renderTapparelle(); } catch(e){} }, 2000); function toggleVentola()"
TAPP_4_A = "if (t.dataset.tab === 'temp') renderTemperature();"
TAPP_4_R = "if (t.dataset.tab === 'temp') renderTemperature(); if (t.dataset.tab === 'tapparelle') renderTapparelle();"
TAPP_5_A = 'data-tab="temp"><span class="icon">🌡️</span><span class="text">Temperatura</span></button>'
TAPP_5_R = 'data-tab="temp"><span class="icon">🌡️</span><span class="text">Temperatura</span></button>\n    <button class="tab" data-tab="tapparelle" id="tab-tapparelle" style="display: none;"><span class="icon">🪟</span><span class="text">Tapparelle</span></button>'
TAPP_6_A = 'data-tab="temp"><span class="icon">🌡️</span><span class="text">Temperature</span></button>'
TAPP_6_R = 'data-tab="temp"><span class="icon">🌡️</span><span class="text">Temperature</span></button>\n    <button class="tab" data-tab="tapparelle" id="tab-tapparelle" style="display: none;"><span class="icon">🪟</span><span class="text">Tapparelle</span></button>'
TAPP_7_A = (
    '<button class="ed-tab" data-tab="stanze" onclick="editorSwitch(\'stanze\')">'
)
TAPP_7_R = '<button class="ed-tab" data-tab="tapp" onclick="editorSwitch(\'tapp\')">🪟 Tapparelle</button>\n          <button class="ed-tab" data-tab="stanze" onclick="editorSwitch(\'stanze\')">'
TAPP_8_A = "if (tab === 'stanze') body.innerHTML = editorRenderStanze();"
TAPP_8_R = "if (tab === 'tapp') body.innerHTML = editorRenderTapparelle();\n    if (tab === 'stanze') body.innerHTML = editorRenderStanze();"
TAPP_9_A = "function editorRenderStanze(){"
TAPP_9_R = "function editorRenderTapparelle(){ var list=getTapparelle(); var rows = list.length ? list.map(function(t,i){ var fl=cdRoomFloorOf(t.room||''); return '<div class=\"ed-row\" style=\"align-items:center;\"><div class=\"ed-row-main\"><div class=\"ed-row-new\">🪟 '+String(t.name||t.entity).replace(/</g,'&lt;')+'</div><div class=\"ed-row-old\">'+((t.room?('🏠 '+t.room):'')+(fl?(' · 🏢 '+fl):''))+'</div></div><div class=\"ed-del\" onclick=\"edTappDel('+i+')\">🗑️</div></div>'; }).join('') : '<div class=\"ed-intro\">Nessuna tapparella. Aggiungine una qui sotto.</div>'; return '<div class=\"ed-intro\">Gestisci le <b>tapparelle</b> (entità cover). Compaiono nella pagina 🪟 Tapparelle, raggruppate per piano e stanza.</div>'+rows+'<input id=\"ed-tp-name\" class=\"ed-input\" style=\"margin:8px 0;\" placeholder=\"Nome (es. Tapparella salone)\">'+'<div style=\"display:flex; gap:8px; margin-bottom:8px;\"><input id=\"ed-tp-ent\" class=\"ed-input mono\" autocomplete=\"off\" style=\"flex:1;\" placeholder=\"cover.tapparella_x\"><button type=\"button\" onclick=\"wzPickEntity(this.previousElementSibling)\" style=\"flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;\">🔍</button></div>'+'<select id=\"ed-tp-room\" class=\"ed-input\" style=\"margin-bottom:8px;\">'+cdRoomOptions('')+'</select>'+'<button class=\"ed-btn-add\" style=\"width:100%;\" onclick=\"edTappAdd()\">＋ Aggiungi tapparella</button>'; } function edTappAdd(){ var n=(document.getElementById('ed-tp-name').value||'').trim(); var e=(document.getElementById('ed-tp-ent').value||'').trim(); var r=(document.getElementById('ed-tp-room').value||'').trim(); if(!e || e.indexOf('.')<0){ alert('Inserisci una entità cover valida'); return; } var list=getTapparelle().slice(); var it={ name: n||e, entity: e }; if(r) it.room=r; list.push(it); localStorage.setItem('cd_tapparelle', JSON.stringify(list)); try{ cdMarkDirty(); cdSyncPush(); }catch(ex){} try{ renderTapparelle(); }catch(ex){} editorSwitch('tapp'); } function edTappDel(i){ var list=getTapparelle().slice(); list.splice(i,1); localStorage.setItem('cd_tapparelle', JSON.stringify(list)); try{ cdMarkDirty(); cdSyncPush(); }catch(ex){} try{ renderTapparelle(); }catch(ex){} editorSwitch('tapp'); } function editorRenderStanze(){"
TAPP_10_A = "'cd_report_devices','cd_slot_labels'"
TAPP_10_R = "'cd_report_devices','cd_tapparelle','cd_floors','cd_slot_labels'"

# Irrigazione: full new section with a rain-aware daily program.
IRR_1_A = "<head>"
IRR_1_R = "<head><style>.irr-card{background:var(--card-bg,#fff);border-radius:16px;padding:12px;box-shadow:0 4px 14px rgba(15,23,42,0.08);display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden}.irr-head2{display:flex;justify-content:space-between;align-items:center;gap:6px}.irr-name{font-weight:800;font-size:14px}.irr-chip{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(100,116,139,0.15)}.irr-run .irr-chip{background:rgba(14,165,233,0.2);color:#0284c7}.irr-bar{height:6px;border-radius:3px;background:rgba(100,116,139,0.18);overflow:hidden}.irr-bar b{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#0369a1);transition:width 1s linear}.irr-ctl{display:flex;gap:6px}.irr-btn{flex:1;height:34px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;font-size:14px;cursor:pointer}.irr-btn.stop{background:linear-gradient(135deg,#94a3b8,#64748b)}.irr-drops{position:absolute;inset:0;pointer-events:none;display:none}.irr-run .irr-drops{display:block}.irr-drops b{position:absolute;top:-12px;width:4px;height:12px;border-radius:3px;background:rgba(56,189,248,0.75);animation:irrDrop 1.1s linear infinite}.irr-drops b:nth-child(1){left:22%}.irr-drops b:nth-child(2){left:52%;animation-delay:0.35s}.irr-drops b:nth-child(3){left:78%;animation-delay:0.7s}@keyframes irrDrop{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(150px);opacity:0}}.irr-prog{background:var(--card-bg,#fff);border-radius:16px;padding:12px;box-shadow:0 4px 14px rgba(15,23,42,0.08);margin:0 4px 12px;display:flex;flex-direction:column;gap:8px}.irr-meteo{font-size:13px;opacity:0.85}.irr-skip{font-size:13px;font-weight:700;color:#b45309;background:rgba(245,158,11,0.15);padding:8px 10px;border-radius:10px}</style>"
IRR_2_A = '<section class="page" id="page-tapparelle">'
IRR_2_R = '<section class="page" id="page-irrigazione">\n  <div style="max-width:1000px;margin:0 auto;">\n    <div id="irr-head"></div>\n    <div id="irr-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;padding:0 4px 10px;"></div>\n  </div>\n  </section>\n\n  <section class="page" id="page-tapparelle">'
IRR_3_A = "function toggleVentola()"
IRR_3_R = "function getIrr(){ var o={}; try { o=JSON.parse(localStorage.getItem('cd_irrigazione'))||{}; } catch(e){} if(!o.zones) o.zones=[]; if(o.rainThr==null) o.rainThr=60; if(!o.time) o.time='06:30'; return o; } function saveIrr(o){ localStorage.setItem('cd_irrigazione', JSON.stringify(o)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} } var CD_IRR = { seq:[], cur:-1, until:0, skip:'' }; function cdIrrCmd(ent,on){ try { if(!ent||!ws||ws.readyState!==1) return; var d=String(ent).split('.')[0]; var dom, svc; if(d==='valve'){ dom='valve'; svc=on?'open_valve':'close_valve'; } else { dom='homeassistant'; svc=on?'turn_on':'turn_off'; } ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:dom, service:svc, target:{ entity_id: ent } })); } catch(e){} } function cdIrrRain(){ var o=getIrr(); if(!o.rainEnt) return null; var st=(typeof STATES!=='undefined')?STATES[o.rainEnt]:null; if(!st) return null; var v=parseFloat(st.state); return isNaN(v)?null:v; } function cdIrrStartSeq(seq){ var o=getIrr(); if(!seq.length) return; CD_IRR.skip=''; CD_IRR.seq=seq.slice(); CD_IRR.cur=-1; cdIrrNext(); } function cdIrrNext(){ var o=getIrr(); if(CD_IRR.cur>=0){ var pz=o.zones[CD_IRR.seq[CD_IRR.cur]]; if(pz) cdIrrCmd(pz.entity,false); } CD_IRR.cur++; if(CD_IRR.cur>=CD_IRR.seq.length){ CD_IRR.seq=[]; CD_IRR.cur=-1; CD_IRR.until=0; renderIrrigazione(); return; } var z=o.zones[CD_IRR.seq[CD_IRR.cur]]; if(!z){ cdIrrNext(); return; } cdIrrCmd(z.entity,true); var m=parseFloat(z.mins); if(isNaN(m)||m<=0) m=10; CD_IRR.until=Date.now()+m*60000; renderIrrigazione(); } function cdIrrStopAll(){ var o=getIrr(); o.zones.forEach(function(z){ if(z) cdIrrCmd(z.entity,false); }); CD_IRR.seq=[]; CD_IRR.cur=-1; CD_IRR.until=0; renderIrrigazione(); } function cdIrrProgram(force){ var o=getIrr(); if(!o.zones.length) return; var pr=cdIrrRain(); if(!force && o.rainEnt && pr!=null && pr>=(+o.rainThr||60)){ CD_IRR.skip='🌧️ Pioggia prevista '+Math.round(pr)+'% — programma saltato'; renderIrrigazione(); return; } cdIrrStartSeq(o.zones.map(function(_z,i){ return i; })); } function cdIrrBtn(btn){ try { if(navigator.vibrate) navigator.vibrate(15); var act=btn.getAttribute('data-act'); var idx=parseInt(btn.getAttribute('data-idx')||'-1',10); if(act==='zstart'){ cdIrrStartSeq([idx]); } else if(act==='pstart'){ cdIrrProgram(false); } else if(act==='pforce'){ cdIrrProgram(true); } else { cdIrrStopAll(); } } catch(e){} } function cdIrrCard(z){ var o=getIrr(); var i=z._idx; var running=(CD_IRR.cur>=0 && CD_IRR.seq[CD_IRR.cur]===i); var m=parseFloat(z.mins); if(isNaN(m)||m<=0) m=10; var nm=String(z.name||z.entity).replace(/</g,'&lt;'); var chip='Pronta · '+m+' min'; var barw=0; if(running){ var left=Math.max(0,CD_IRR.until-Date.now()); var mm=Math.floor(left/60000), ss=Math.floor(left%60000/1000); chip='💦 '+mm+':'+(ss<10?'0':'')+ss; barw=Math.round(100-(left/(m*60000))*100); } return '<div class=\"irr-card'+(running?' irr-run':'')+'\">'+'<div class=\"irr-drops\"><b></b><b></b><b></b></div>'+'<div class=\"irr-head2\"><span class=\"irr-name\">🌱 '+nm+'</span>'+'<span class=\"irr-chip\">'+chip+'</span></div>'+'<div class=\"irr-bar\"><b style=\"width:'+barw+'%\"></b></div>'+'<div class=\"irr-ctl\">'+'<button class=\"irr-btn\" data-act=\"zstart\" data-idx=\"'+i+'\" onclick=\"cdIrrBtn(this)\">▶</button>'+'<button class=\"irr-btn stop\" data-act=\"stop\" onclick=\"cdIrrBtn(this)\">⏹</button>'+'</div></div>'; } function renderIrrigazione(){ var head=document.getElementById('irr-head'); var grid=document.getElementById('irr-grid'); var o=getIrr(); var tab=document.getElementById('tab-irrigazione'); if(tab) tab.style.display=o.zones.length?'':'none'; if(!head||!grid) return; if(!o.zones.length){ head.innerHTML=''; grid.innerHTML='<div class=\"ed-empty\" style=\"grid-column:1/-1;\">Nessuna zona configurata</div>'; return; } var met=''; if(o.weatherEnt && typeof STATES!=='undefined' && STATES[o.weatherEnt]){ var w=STATES[o.weatherEnt]; met+='⛅ '+String(w.state)+((w.attributes&&w.attributes.temperature!=null)?(' · '+w.attributes.temperature+'°'):''); } var pr=cdIrrRain(); if(pr!=null) met+=(met?' · ':'')+'🌧️ Prob. pioggia '+Math.round(pr)+'% (soglia '+(+o.rainThr||60)+'%)'; var runP=(CD_IRR.cur>=0 && CD_IRR.seq.length>1); head.innerHTML='<div class=\"irr-prog\">'+'<div class=\"irr-head2\"><span class=\"irr-name\">💧 Programma irrigazione</span><span class=\"irr-chip\">'+(o.enabled?('⏰ ogni giorno alle '+o.time):'spento')+'</span></div>'+(met?('<div class=\"irr-meteo\">'+met+'</div>'):'')+(CD_IRR.skip?('<div class=\"irr-skip\">'+CD_IRR.skip+'</div>'):'')+'<div class=\"irr-ctl\">'+'<button class=\"irr-btn\" data-act=\"pstart\" onclick=\"cdIrrBtn(this)\">▶ Avvia programma</button>'+'<button class=\"irr-btn\" data-act=\"pforce\" onclick=\"cdIrrBtn(this)\">⚡ Forza (ignora pioggia)</button>'+'<button class=\"irr-btn stop\" data-act=\"stop\" onclick=\"cdIrrBtn(this)\">⏹ Stop</button>'+'</div></div>'; grid.innerHTML=cdGroupCards(o.zones.map(function(z,i){ return Object.assign({},z,{_idx:i}); }), cdIrrCard); } setInterval(function(){ try { if(CD_IRR.cur>=0 && Date.now()>CD_IRR.until) cdIrrNext(); var tab=document.getElementById('tab-irrigazione'); if(tab) tab.style.display=getIrr().zones.length?'':'none'; var pg=document.getElementById('page-irrigazione'); if(pg && pg.offsetParent!==null) renderIrrigazione(); } catch(e){} }, 1000); setInterval(function(){ try { var o=getIrr(); if(!o.enabled || !o.zones.length || CD_IRR.cur>=0) return; var d=new Date(); var hm=(d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes(); if(hm!==o.time) return; var today=d.toDateString(); if(localStorage.getItem('cd_irr_lastrun')===today) return; localStorage.setItem('cd_irr_lastrun', today); cdIrrProgram(false); } catch(e){} }, 30000); function toggleVentola()"
IRR_4_A = "t.dataset.tab === 'tapparelle') renderTapparelle();"
IRR_4_R = "t.dataset.tab === 'tapparelle') renderTapparelle(); if (t.dataset.tab === 'irrigazione') renderIrrigazione();"
IRR_5_A = '<span class="text">Tapparelle</span></button>'
IRR_5_R = '<span class="text">Tapparelle</span></button>\n    <button class="tab" data-tab="irrigazione" id="tab-irrigazione" style="display: none;"><span class="icon">💧</span><span class="text">Irrigazione</span></button>'
IRR_6_A = '<button class="ed-tab" data-tab="tapp" onclick="editorSwitch(\'tapp\')">'
IRR_6_R = '<button class="ed-tab" data-tab="irr" onclick="editorSwitch(\'irr\')">💧 Irrigazione</button>\n          <button class="ed-tab" data-tab="tapp" onclick="editorSwitch(\'tapp\')">'
IRR_7_A = "if (tab === 'tapp') body.innerHTML = editorRenderTapparelle();"
IRR_7_R = "if (tab === 'irr') body.innerHTML = editorRenderIrrigazione();\n    if (tab === 'tapp') body.innerHTML = editorRenderTapparelle();"
IRR_8_A = "function editorRenderTapparelle(){"
IRR_8_R = 'function editorRenderIrrigazione(){ var o=getIrr(); var rows = o.zones.length ? o.zones.map(function(z,i){ var fl=cdRoomFloorOf(z.room||\'\'); return \'<div class="ed-row" style="align-items:center;"><div class="ed-row-main"><div class="ed-row-new">🌱 \'+String(z.name||z.entity).replace(/</g,\'&lt;\')+\' · \'+(parseFloat(z.mins)||10)+\' min</div><div class="ed-row-old">\'+((z.room?(\'🏠 \'+z.room):\'\')+(fl?(\' · 🏢 \'+fl):\'\'))+\'</div></div><div class="ed-del" onclick="edIrrDel(\'+i+\')">🗑️</div></div>\'; }).join(\'\') : \'<div class="ed-intro">Nessuna zona. Aggiungine una qui sotto.</div>\'; return \'<div class="ed-intro">Zone di <b>irrigazione</b> (switch o valve). Il programma le avvia in sequenza, ognuna per la sua durata, e salta quando la probabilità di pioggia supera la soglia.</div>\'+rows+\'<input id="ed-irr-name" class="ed-input" style="margin:8px 0;" placeholder="Nome zona (es. Prato davanti)">\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id=\\\\"ed-irr-ent\\\\" class=\\\\"ed-input mono\\\\" autocomplete=\\\\"off\\\\" style=\\\\"flex:1;\\\\" placeholder=\\\\"switch.irrigazione_zona1\\\\"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><select id="ed-irr-room" class="ed-input" style="flex:1; margin:0;">\'+cdRoomOptions(\'\')+\'</select><input id="ed-irr-min" type="number" min="1" max="180" value="10" class="ed-input" style="flex:0 0 90px; margin:0;" title="Durata (minuti)"></div>\'+\'<button class="ed-btn-add" style="width:100%; margin-bottom:16px;" onclick="edIrrAddZone()">＋ Aggiungi zona</button>\'+\'<div class="ed-intro"><b>Meteo e programma</b>: sensore % pioggia, soglia, meteo (facoltativo) e orario di avvio.</div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id=\\\\"ed-irr-rain\\\\" class=\\\\"ed-input mono\\\\" autocomplete=\\\\"off\\\\" style=\\\\"flex:1;\\\\" placeholder=\\\\"sensor.prob_pioggia_oggi (%)\\\\" value=\\\\"\'+String(o.rainEnt||\'\')+\'\\\\"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id=\\\\"ed-irr-weather\\\\" class=\\\\"ed-input mono\\\\" autocomplete=\\\\"off\\\\" style=\\\\"flex:1;\\\\" placeholder=\\\\"weather.casa (facoltativo)\\\\" value=\\\\"\'+String(o.weatherEnt||\'\')+\'\\\\"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-irr-thr" type="number" min="0" max="100" value="\'+(+o.rainThr||60)+\'" class="ed-input" style="flex:1; margin:0;" title="Soglia pioggia %"><input id="ed-irr-time" type="time" value="\'+(o.time||\'06:30\')+\'" class="ed-input" style="flex:1; margin:0;"></div>\'+\'<label class="ed-intro" style="display:flex; gap:8px; align-items:center;"><input id="ed-irr-en" type="checkbox" \'+(o.enabled?\'checked\':\'\')+\'> Programma attivo (ogni giorno, col tablet acceso)</label>\'+\'<button class="ed-btn-add" style="width:100%;" onclick="edIrrSaveCfg()">💾 Salva impostazioni</button>\'; } function edIrrAddZone(){ var n=(document.getElementById(\'ed-irr-name\').value||\'\').trim(); var e=(document.getElementById(\'ed-irr-ent\').value||\'\').trim(); var r=(document.getElementById(\'ed-irr-room\').value||\'\').trim(); var m=parseFloat(document.getElementById(\'ed-irr-min\').value); if(!e || e.indexOf(\'.\')<0){ alert(\'Inserisci una entità valida (switch o valve)\'); return; } var o=getIrr(); var z={ name:n||e, entity:e, mins:(isNaN(m)||m<=0)?10:m }; if(r) z.room=r; o.zones.push(z); saveIrr(o); try{ renderIrrigazione(); }catch(ex){} editorSwitch(\'irr\'); } function edIrrDel(i){ var o=getIrr(); o.zones.splice(i,1); saveIrr(o); try{ renderIrrigazione(); }catch(ex){} editorSwitch(\'irr\'); } function edIrrSaveCfg(){ var o=getIrr(); o.rainEnt=(document.getElementById(\'ed-irr-rain\').value||\'\').trim(); o.weatherEnt=(document.getElementById(\'ed-irr-weather\').value||\'\').trim(); var t=parseFloat(document.getElementById(\'ed-irr-thr\').value); o.rainThr=(isNaN(t)||t<0)?60:Math.min(100,t); o.time=(document.getElementById(\'ed-irr-time\').value||\'06:30\'); o.enabled=!!document.getElementById(\'ed-irr-en\').checked; saveIrr(o); try{ renderIrrigazione(); }catch(ex){} try{ edToast(\'Impostazioni irrigazione salvate\'); }catch(ex){} editorSwitch(\'irr\'); } function editorRenderTapparelle(){'
IRR_9_A = "'cd_tapparelle','cd_floors'"
IRR_9_R = "'cd_tapparelle','cd_irrigazione','cd_floors'"

# Piscina: hero, quality, temp-based auto filtration, editor, sync.
POOL_1_A = "<head>"
POOL_1_R = "<head><style>.pool-hero{position:relative;overflow:hidden;border-radius:16px;padding:16px 14px 26px;margin:0 4px 12px;color:#fff;background:linear-gradient(180deg,#38bdf8,#0369a1);box-shadow:0 6px 18px rgba(3,105,161,0.35)}.pool-temp{font-size:38px;font-weight:900;line-height:1}.pool-sub{font-size:12px;opacity:0.9;margin-top:2px}.pool-wave{position:absolute;left:-60px;right:-60px;height:24px;bottom:-8px;background:radial-gradient(circle at 14px -8px,transparent 14px, rgba(255,255,255,0.28) 15px) repeat-x;background-size:32px 24px;animation:poolWave 5s linear infinite}.pool-wave.w2{bottom:-14px;opacity:0.6;animation-duration:8s;animation-direction:reverse}@keyframes poolWave{to{transform:translateX(32px)}}.pool-chips{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.pool-tg{border:none;border-radius:12px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;background:rgba(255,255,255,0.22);color:#fff}.pool-tg.on{background:#fff;color:#0369a1}.pool-card{background:var(--card-bg,#fff);border-radius:16px;padding:12px;box-shadow:0 4px 14px rgba(15,23,42,0.08);margin:0 4px 12px;display:flex;flex-direction:column;gap:8px}.pool-row{display:flex;justify-content:space-between;align-items:center;gap:8px}.pool-k{font-weight:800;font-size:14px}.pool-v{font-family:monospace;font-size:15px;font-weight:700}.pool-badge{font-size:11px;font-weight:800;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.18);color:#059669}.pool-badge.warn{background:rgba(245,158,11,0.2);color:#b45309}.pool-bar{height:6px;border-radius:3px;background:rgba(100,116,139,0.18);overflow:hidden}.pool-bar b{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#0369a1);transition:width 1s linear}.pool-btn{flex:1;height:34px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;font-size:13px;font-weight:700;cursor:pointer}.pool-btn.stop{background:linear-gradient(135deg,#94a3b8,#64748b)}</style>"
POOL_2_A = '<section class="page" id="page-irrigazione">'
POOL_2_R = '<section class="page" id="page-piscina">\n  <div style="max-width:1000px;margin:0 auto;" id="pool-wrap"></div>\n  </section>\n\n  <section class="page" id="page-irrigazione">'
POOL_3_A = "function toggleVentola()"
POOL_3_R = "function getPool(){ var o={}; try { o=JSON.parse(localStorage.getItem('cd_piscina'))||{}; } catch(e){} if(o.phMin==null) o.phMin=7.0; if(o.phMax==null) o.phMax=7.6; if(!o.filterStart) o.filterStart='09:00'; if(o.filterHours==null) o.filterHours=8; if(o.autoHours==null) o.autoHours=true; return o; } function savePool(o){ localStorage.setItem('cd_piscina', JSON.stringify(o)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} } var CD_POOL = { stopAt:0 }; function cdPoolNum(ent){ if(!ent) return null; var st=(typeof STATES!=='undefined')?STATES[ent]:null; if(!st) return null; var v=parseFloat(st.state); return isNaN(v)?null:v; } function cdPoolOn(ent){ if(!ent) return false; var st=(typeof STATES!=='undefined')?STATES[ent]:null; return !!(st && st.state==='on'); } function cdPoolSvc(ent,svc){ try { if(!ent||!ws||ws.readyState!==1) return; ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'homeassistant', service:svc, target:{ entity_id: ent } })); } catch(e){} } function cdPoolTargetHours(){ var o=getPool(); if(o.autoHours){ var t=cdPoolNum(o.tempEnt); if(t!=null){ var h=t/2; if(h<2) h=2; if(h>12) h=12; return Math.round(h*2)/2; } } var f=parseFloat(o.filterHours); return (isNaN(f)||f<=0)?8:f; } function cdPoolRunToday(){ var r={}; try { r=JSON.parse(localStorage.getItem('cd_pool_run'))||{}; } catch(e){} var today=(new Date()).toDateString(); if(r.d!==today){ r={ d:today, s:0 }; } return r; } function cdPoolStartFilter(){ var o=getPool(); if(!o.pumpEnt) return; var target=cdPoolTargetHours()*3600; var run=cdPoolRunToday(); var remaining=target-run.s; if(remaining<60){ remaining=60; } cdPoolSvc(o.pumpEnt,'turn_on'); CD_POOL.stopAt=Date.now()+remaining*1000; renderPiscina(); } function cdPoolStopFilter(){ var o=getPool(); if(o.pumpEnt) cdPoolSvc(o.pumpEnt,'turn_off'); CD_POOL.stopAt=0; renderPiscina(); } function cdPoolBtn(btn){ try { if(navigator.vibrate) navigator.vibrate(15); var act=btn.getAttribute('data-act'); var o=getPool(); if(act==='fstart'){ cdPoolStartFilter(); } else if(act==='fstop'){ cdPoolStopFilter(); } else if(act==='pump'){ cdPoolSvc(o.pumpEnt,'toggle'); } else if(act==='heat'){ cdPoolSvc(o.heatEnt,'toggle'); } else if(act==='light'){ cdPoolSvc(o.lightEnt,'toggle'); } setTimeout(renderPiscina, 600); } catch(e){} } function cdPoolQualRow(lbl, val, mn, mx, unit){ if(val==null) return ''; var bad = (mn!=null && !isNaN(mn) && val<mn) ? 'basso' : (mx!=null && !isNaN(mx) && val>mx) ? 'alto' : ''; return '<div class=\"pool-row\"><span class=\"pool-k\">'+lbl+'</span>'+'<span><span class=\"pool-v\">'+val+(unit||'')+'</span> '+'<span class=\"pool-badge'+(bad?' warn':'')+'\">'+(bad?('⚠️ '+bad):'ok')+'</span></span></div>'; } function renderPiscina(){ var wrap=document.getElementById('pool-wrap');  var o=getPool(); var configured=!!(o.tempEnt||o.pumpEnt||o.phEnt); var tab=document.getElementById('tab-piscina'); if(tab) tab.style.display=configured?'':'none'; if(!wrap) return; if(!configured){ wrap.innerHTML='<div class=\"ed-empty\">Nessuna piscina configurata</div>'; return; } var t=cdPoolNum(o.tempEnt); var chips=''; if(o.pumpEnt) chips+='<button class=\"pool-tg'+(cdPoolOn(o.pumpEnt)?' on':'')+'\" data-act=\"pump\" onclick=\"cdPoolBtn(this)\">⚙️ Pompa</button>'; if(o.heatEnt) chips+='<button class=\"pool-tg'+(cdPoolOn(o.heatEnt)?' on':'')+'\" data-act=\"heat\" onclick=\"cdPoolBtn(this)\">🔥 Riscaldamento</button>'; if(o.lightEnt) chips+='<button class=\"pool-tg'+(cdPoolOn(o.lightEnt)?' on':'')+'\" data-act=\"light\" onclick=\"cdPoolBtn(this)\">💡 Luce</button>'; var html='<div class=\"pool-hero\">'+'<div class=\"pool-temp\">'+(t!=null?(t+'°'):'—')+'</div>'+'<div class=\"pool-sub\">Temperatura acqua</div>'+'<div class=\"pool-chips\">'+chips+'</div>'+'<div class=\"pool-wave\"></div><div class=\"pool-wave w2\"></div></div>'; var ph=cdPoolNum(o.phEnt); var cl=cdPoolNum(o.clEnt); var qual=cdPoolQualRow('pH', ph, parseFloat(o.phMin), parseFloat(o.phMax), '')+cdPoolQualRow('Cloro/Redox', cl, parseFloat(o.clMin), parseFloat(o.clMax), ''); if(qual) html+='<div class=\"pool-card\">'+'<div class=\"pool-k\">🧪 Qualità acqua</div>'+qual+'</div>'; if(o.pumpEnt){ var target=cdPoolTargetHours(); var run=cdPoolRunToday(); var doneH=Math.round(run.s/360)/10; var pct=Math.min(100, Math.round(run.s/(target*36))); var pumpOn=cdPoolOn(o.pumpEnt); html+='<div class=\"pool-card\">'+'<div class=\"pool-row\"><span class=\"pool-k\">🌀 Filtrazione</span><span class=\"pool-badge'+(pumpOn?'':' warn')+'\">'+(pumpOn?'in funzione':'ferma')+'</span></div>'+'<div class=\"pool-sub\" style=\"color:inherit;opacity:0.75;font-size:12px;\">Oggi '+doneH+'h su '+target+'h'+(o.autoHours?' (auto: temperatura/2)':'')+(o.enabled?(' · ⏰ avvio '+o.filterStart):'')+'</div>'+'<div class=\"pool-bar\"><b style=\"width:'+pct+'%\"></b></div>'+'<div class=\"pool-row\" style=\"gap:6px;\">'+'<button class=\"pool-btn\" data-act=\"fstart\" onclick=\"cdPoolBtn(this)\">▶ Avvia filtrazione</button>'+'<button class=\"pool-btn stop\" data-act=\"fstop\" onclick=\"cdPoolBtn(this)\">⏹ Stop</button>'+'</div></div>'; } wrap.innerHTML=html; } setInterval(function(){ try { if(CD_POOL.stopAt && Date.now()>CD_POOL.stopAt){ cdPoolStopFilter(); } var tab=document.getElementById('tab-piscina'); if(tab){ var o=getPool(); tab.style.display=(o.tempEnt||o.pumpEnt||o.phEnt)?'':'none'; } var pg=document.getElementById('page-piscina'); if(pg && pg.offsetParent!==null) renderPiscina(); } catch(e){} }, 2000); setInterval(function(){ try { var o=getPool(); if(o.pumpEnt && cdPoolOn(o.pumpEnt)){ var r=cdPoolRunToday(); r.s+=30; localStorage.setItem('cd_pool_run', JSON.stringify(r)); } if(!o.enabled || !o.pumpEnt || CD_POOL.stopAt) return; var d=new Date(); var hm=(d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes(); if(hm!==o.filterStart) return; var today=d.toDateString(); if(localStorage.getItem('cd_pool_lastrun')===today) return; localStorage.setItem('cd_pool_lastrun', today); cdPoolStartFilter(); } catch(e){} }, 30000); function toggleVentola()"
POOL_4_A = "t.dataset.tab === 'irrigazione') renderIrrigazione();"
POOL_4_R = "t.dataset.tab === 'irrigazione') renderIrrigazione(); if (t.dataset.tab === 'piscina') renderPiscina();"
POOL_5_A = '<span class="text">Irrigazione</span></button>'
POOL_5_R = '<span class="text">Irrigazione</span></button>\n    <button class="tab" data-tab="piscina" id="tab-piscina" style="display: none;"><span class="icon">🏊</span><span class="text">Piscina</span></button>'
POOL_6_A = '<button class="ed-tab" data-tab="irr" onclick="editorSwitch(\'irr\')">'
POOL_6_R = '<button class="ed-tab" data-tab="pool" onclick="editorSwitch(\'pool\')">🏊 Piscina</button>\n          <button class="ed-tab" data-tab="irr" onclick="editorSwitch(\'irr\')">'
POOL_7_A = "if (tab === 'irr') body.innerHTML = editorRenderIrrigazione();"
POOL_7_R = "if (tab === 'pool') body.innerHTML = editorRenderPiscina();\n    if (tab === 'irr') body.innerHTML = editorRenderIrrigazione();"
POOL_8_A = "function editorRenderIrrigazione(){"
POOL_8_R = 'function editorRenderPiscina(){ var o=getPool(); return \'<div class="ed-intro">Gestione <b>piscina</b>: sensori, comandi e filtrazione automatica giornaliera. In modalità auto le ore di filtrazione sono temperatura/2 (min 2, max 12).</div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-temp" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="sensor.piscina_temperatura" value="\'+String(o.tempEnt||\'\')+\'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-ph" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="sensor.piscina_ph (facoltativo)" value="\'+String(o.phEnt||\'\')+\'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-cl" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="sensor.piscina_cloro (facoltativo)" value="\'+String(o.clEnt||\'\')+\'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-pump" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="switch.pompa_piscina" value="\'+String(o.pumpEnt||\'\')+\'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-heat" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="switch.riscaldamento_piscina (facoltativo)" value="\'+String(o.heatEnt||\'\')+\'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-light" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="light.piscina (facoltativo)" value="\'+String(o.lightEnt||\'\')+\'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>\'+\'<div class="ed-intro">Soglie qualità (avvisi) e filtrazione.</div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-phmin" type="number" step="0.1" class="ed-input" style="flex:1; margin:0;" title="pH minimo" value="\'+(o.phMin!=null?o.phMin:7.0)+\'"><input id="ed-pl-phmax" type="number" step="0.1" class="ed-input" style="flex:1; margin:0;" title="pH massimo" value="\'+(o.phMax!=null?o.phMax:7.6)+\'"></div>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-clmin" type="number" step="0.1" class="ed-input" style="flex:1; margin:0;" title="Cloro minimo" placeholder="Cloro min" value="\'+(o.clMin!=null?o.clMin:\'\')+\'"><input id="ed-pl-clmax" type="number" step="0.1" class="ed-input" style="flex:1; margin:0;" title="Cloro massimo" placeholder="Cloro max" value="\'+(o.clMax!=null?o.clMax:\'\')+\'"></div>\'+\'<label class="ed-intro" style="display:flex; gap:8px; align-items:center;"><input id="ed-pl-auto" type="checkbox" \'+(o.autoHours?\'checked\':\'\')+\'> Ore automatiche (temperatura/2)</label>\'+\'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-hours" type="number" min="1" max="24" class="ed-input" style="flex:1; margin:0;" title="Ore fisse" value="\'+(+o.filterHours||8)+\'"><input id="ed-pl-time" type="time" class="ed-input" style="flex:1; margin:0;" value="\'+(o.filterStart||\'09:00\')+\'"></div>\'+\'<label class="ed-intro" style="display:flex; gap:8px; align-items:center;"><input id="ed-pl-en" type="checkbox" \'+(o.enabled?\'checked\':\'\')+\'> Filtrazione giornaliera attiva (col tablet acceso)</label>\'+\'<button class="ed-btn-add" style="width:100%;" onclick="edPoolSaveCfg()">💾 Salva piscina</button>\'; } function edPoolSaveCfg(){ var o=getPool(); o.tempEnt=(document.getElementById(\'ed-pl-temp\').value||\'\').trim(); o.phEnt=(document.getElementById(\'ed-pl-ph\').value||\'\').trim(); o.clEnt=(document.getElementById(\'ed-pl-cl\').value||\'\').trim(); o.pumpEnt=(document.getElementById(\'ed-pl-pump\').value||\'\').trim(); o.heatEnt=(document.getElementById(\'ed-pl-heat\').value||\'\').trim(); o.lightEnt=(document.getElementById(\'ed-pl-light\').value||\'\').trim(); var a=parseFloat(document.getElementById(\'ed-pl-phmin\').value); o.phMin=isNaN(a)?7.0:a; var b=parseFloat(document.getElementById(\'ed-pl-phmax\').value); o.phMax=isNaN(b)?7.6:b; var c=parseFloat(document.getElementById(\'ed-pl-clmin\').value); o.clMin=isNaN(c)?null:c; var d2=parseFloat(document.getElementById(\'ed-pl-clmax\').value); o.clMax=isNaN(d2)?null:d2; o.autoHours=!!document.getElementById(\'ed-pl-auto\').checked; var h=parseFloat(document.getElementById(\'ed-pl-hours\').value); o.filterHours=(isNaN(h)||h<=0)?8:h; o.filterStart=(document.getElementById(\'ed-pl-time\').value||\'09:00\'); o.enabled=!!document.getElementById(\'ed-pl-en\').checked; savePool(o); try{ renderPiscina(); }catch(ex){} try{ edToast(\'Piscina salvata\'); }catch(ex){} editorSwitch(\'pool\'); } function editorRenderIrrigazione(){'
POOL_9_A = "'cd_tapparelle','cd_irrigazione','cd_floors'"
POOL_9_R = "'cd_tapparelle','cd_irrigazione','cd_piscina','cd_floors'"

# Multiple EV cars: profiles of dm.ev_* mappings, page dropdown.
EVCARS_1_A = "function toggleVentola()"
EVCARS_1_R = "function getEvCars(){ try { return JSON.parse(localStorage.getItem('cd_ev_cars'))||[]; } catch(e){ return []; } } function saveEvCars(a){ localStorage.setItem('cd_ev_cars', JSON.stringify(a)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} } function cdEvActive(){ var v=parseInt(localStorage.getItem('cd_ev_car_active')||'-1',10); return isNaN(v)?-1:v; } function cdEvCaptureProfile(){ var ov={}; try { var cur=JSON.parse(localStorage.getItem('cd_entity_overrides'))||{}; Object.keys(cur).forEach(function(k){ if(k.indexOf('dm.ev_')===0) ov[k]=cur[k]; }); } catch(e){} var img=''; try { var v=cdCfg('cd_ev_image'); img=(typeof v==='string')?v:((v&&v.url)||''); } catch(e){} return { ov: ov, img: img }; } function cdEvApplyCar(i){ var cars=getEvCars(); var c=cars[i]; if(!c) return; var ov={}; try { ov=JSON.parse(localStorage.getItem('cd_entity_overrides'))||{}; } catch(e){} Object.keys(ov).forEach(function(k){ if(k.indexOf('dm.ev_')===0) delete ov[k]; }); Object.keys(c.ov||{}).forEach(function(k){ ov[k]=c.ov[k]; }); localStorage.setItem('cd_entity_overrides', JSON.stringify(ov)); try { Object.keys(ENTITY_OVERRIDES).forEach(function(k){ if(k.indexOf('dm.ev_')===0) delete ENTITY_OVERRIDES[k]; }); Object.keys(c.ov||{}).forEach(function(k){ ENTITY_OVERRIDES[k]=c.ov[k]; }); } catch(e){} if(c.img!=null){ localStorage.setItem('cd_ev_image', JSON.stringify(c.img||'')); try { var im=document.getElementById('ev-mod-car-img'); if(im && c.img){ delete im.dataset.evFailed; im.src=c.img; } } catch(e){} } localStorage.setItem('cd_ev_car_active', String(i)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} try{ if(typeof render==='function') render(); }catch(e){} cdEvCarsRefresh(); } function cdEvCarSel(sel){ var i=parseInt(sel.value,10); if(!isNaN(i)) cdEvApplyCar(i); } function cdEvCarsRefresh(){ var box=document.getElementById('ev-car-picker'); var sel=document.getElementById('ev-car-sel'); if(!box||!sel) return; var cars=getEvCars(); box.style.display = cars.length>1 ? '' : 'none'; if(cars.length<2) return; var act=cdEvActive(); sel.innerHTML = cars.map(function(c,i){ return '<option value=\"'+i+'\"'+(i===act?' selected':'')+'>🚗 '+String(c.name||('Auto '+(i+1))).replace(/</g,'&lt;')+'</option>'; }).join(''); } setInterval(function(){ try { cdEvCarsRefresh(); } catch(e){} }, 2000); function toggleVentola()"
EVCARS_2_A = 'id="page-ev">'
EVCARS_2_R = 'id="page-ev">\n  <div style="max-width:1000px;margin:0 auto;" id="ev-car-picker" style-note="" >\n    <select id="ev-car-sel" class="ed-input" style="width:100%; margin:0 0 8px;" onchange="cdEvCarSel(this)"></select>\n  </div>'
EVCARS_3_A = "function edSaveGeneral(){"
EVCARS_3_R = "function cdEvCarsHtml(){ var cars=getEvCars(); var act=cdEvActive(); var rows = cars.length ? cars.map(function(c,i){ return '<div class=\"ed-row\" style=\"align-items:center;\"><div class=\"ed-row-main\"><div class=\"ed-row-new\">🚗 '+String(c.name||('Auto '+(i+1))).replace(/</g,'&lt;')+(i===act?' <span class=\"pool-badge\">✓ attiva</span>':'')+'</div><div class=\"ed-row-old\">'+Object.keys(c.ov||{}).length+' entità mappate</div></div><button class=\"ed-btn-add\" style=\"flex:0 0 auto; margin-right:6px;\" data-act=\"use\" data-idx=\"'+i+'\" onclick=\"cdEvCarBtn(this)\">Usa</button><div class=\"ed-del\" data-act=\"del\" data-idx=\"'+i+'\" onclick=\"cdEvCarBtn(this)\">🗑️</div></div>'; }).join('') : '<div class=\"ed-intro\">Nessun profilo auto salvato.</div>'; return '<div class=\"ed-intro\" style=\"margin-top:16px;\">🚗 <b>Auto elettriche</b>: mappa le entità EV come sempre, poi salvale come profilo. Con due o più profili, nella pagina Auto compare la tendina per scegliere quale vedere.</div>'+rows+'<div style=\"display:flex; gap:8px; margin:8px 0 16px;\"><input id=\"ed-evcar-name\" class=\"ed-input\" style=\"flex:1; margin:0;\" placeholder=\"Nome auto (es. Leapmotor B10)\"><button class=\"ed-btn-add\" style=\"flex:0 0 auto;\" onclick=\"edEvCarAdd()\">＋ Salva attuale</button></div>'; } function edEvCarAdd(){ var n=(document.getElementById('ed-evcar-name').value||'').trim(); if(!n){ alert('Dai un nome al profilo auto'); return; } var prof=cdEvCaptureProfile(); if(!Object.keys(prof.ov).length){ alert('Nessuna entità EV mappata da salvare: mappa prima le entità della sezione Auto'); return; } var cars=getEvCars(); cars.push({ name:n, ov:prof.ov, img:prof.img }); saveEvCars(cars); localStorage.setItem('cd_ev_car_active', String(cars.length-1)); editorSwitch('visib'); } function cdEvCarBtn(btn){ try { var act=btn.getAttribute('data-act'); var i=parseInt(btn.getAttribute('data-idx')||'-1',10); if(act==='use'){ cdEvApplyCar(i); } else { var cars=getEvCars(); cars.splice(i,1); saveEvCars(cars); var a=cdEvActive(); if(a===i) localStorage.setItem('cd_ev_car_active','-1'); else if(a>i) localStorage.setItem('cd_ev_car_active', String(a-1)); } editorSwitch('visib'); } catch(e){} } function edSaveGeneral(){"
EVCARS_4_A = "return cdGenHtml()+"
EVCARS_4_R = "return cdGenHtml()+cdEvCarsHtml()+"
EVCARS_5_A = "'cd_piscina','cd_floors'"
EVCARS_5_R = "'cd_piscina','cd_ev_cars','cd_floors'"

# Energia: per-view visibility and a PV-less degrading flow map.
ENVIEW_1_A = "function toggleVentola()"
ENVIEW_1_R = "function getEnViews(){ try { return JSON.parse(localStorage.getItem('cd_energy_views'))||{}; } catch(e){ return {}; } } function cdEnList(){ return [['ist','⚡','Istantanea (mappa flussi)'],['day','📅','Giornaliera'],['month','📆','Mensile'],['panoramica','📊','Report (elettrodomestici e analisi)'],['temp','🌡️','Temperature inverter']]; } function cdMappedKey(k){ try { return !!(ENTITY_OVERRIDES && ENTITY_OVERRIDES[k]); } catch(e){ return true; } } function cdApplyFlowMinimal(){ try { var noSolar=!cdMappedKey('dm.energy_potenza_fotovoltaico'); var noBatt=!cdMappedKey('dm.energy_potenza_batteria'); function hide(id,h){ var el=document.getElementById(id); if(el) el.style.display=h?'none':''; } hide('n-solar', noSolar); hide('n-battery', noBatt); ['line-solar-home','line-solar-grid','m-line-solar-home','m-line-solar-grid','line-solar-home-day','line-solar-grid-day','m-line-solar-home-day','m-line-solar-grid-day'].forEach(function(id){ hide(id, noSolar); }); ['line-battery-home','m-line-battery-home','line-battery-home-day','m-line-battery-home-day'].forEach(function(id){ hide(id, noBatt); }); ['line-solar-battery','m-line-solar-battery','line-solar-battery-day','m-line-solar-battery-day'].forEach(function(id){ hide(id, noSolar||noBatt); }); } catch(e){} } function cdEnergyOpen(k){ try { document.querySelectorAll('.sub-tab-btn').forEach(function(b){ b.classList.remove('active'); var m=String(b.getAttribute('onclick')||'').match(/switchEnergyView\\('(\\w+)'\\)/); if(m && m[1]===k) b.classList.add('active'); }); document.querySelectorAll('.flow-view').forEach(function(pv){ pv.classList.remove('active'); }); var panel=document.getElementById('view-'+k); if(panel) panel.classList.add('active'); if(k==='panoramica'){ try{ renderEnergyDashboard(); }catch(e2){} } if(k==='temp'){ try{ renderInverterTemp(); }catch(e2){} } } catch(e){} } function cdApplyEnergyViews(){ try { var v=getEnViews(); var firstOn=null; var activeHidden=false; document.querySelectorAll('.sub-tab-btn').forEach(function(b){ var m=String(b.getAttribute('onclick')||'').match(/switchEnergyView\\('(\\w+)'\\)/); if(!m) return; var k=m[1]; var on=(v[k]!==false); b.style.display=on?'':'none'; if(on && !firstOn) firstOn=k; if(!on && b.classList.contains('active')) activeHidden=true; }); if(activeHidden && firstOn) cdEnergyOpen(firstOn); cdApplyFlowMinimal(); } catch(e){} } setTimeout(cdApplyEnergyViews, 1800); function toggleVentola()"
ENVIEW_2_A = "function edSaveGeneral(){"
ENVIEW_2_R = "function cdEnViewsHtml(){ var lst=cdEnList(); var cur=getEnViews(); var rows=lst.map(function(x,idx){ var k=x[0]; var on=(cur[k]!==false); return '<div class=\"ed-row\" style=\"align-items:center;\"><div class=\"ed-row-main\"><div class=\"ed-row-new\">'+x[1]+' '+x[2]+'</div></div><div onclick=\"edEnViewToggle('+idx+')\" style=\"cursor:pointer;flex:0 0 52px;height:30px;border-radius:15px;background:'+(on?'#0ea5e9':'#cbd5e1')+';position:relative;transition:.2s;\"><div style=\"position:absolute;top:3px;'+(on?'right:3px':'left:3px')+';width:24px;height:24px;border-radius:50%;background:#fff;\"></div></div></div>'; }).join(''); return '<div class=\"ed-intro\" style=\"margin-top:16px;\">⚡ <b>Sezione Energia</b>: scegli quali viste mostrare. Chi non ha il fotovoltaico può tenere solo il Report; con la sola pinza sui consumi la mappa flussi nasconde da sola solare e batteria non mappati.</div>'+rows; } function edEnViewToggle(idx){ var lst=cdEnList(); var x=lst[idx]; if(!x) return; var k=x[0]; var cur=getEnViews(); cur[k]=(cur[k]===false); localStorage.setItem('cd_energy_views', JSON.stringify(cur)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} try{ cdApplyEnergyViews(); }catch(e){} editorSwitch('visib'); } function edSaveGeneral(){"
ENVIEW_3_A = "return cdGenHtml()+cdEvCarsHtml()+"
ENVIEW_3_R = "return cdGenHtml()+cdEvCarsHtml()+cdEnViewsHtml()+"
ENVIEW_4_A = "'cd_ev_cars','cd_floors'"
ENVIEW_4_R = "'cd_ev_cars','cd_energy_views','cd_floors'"

# Round 17: loop guards, per-section editor tabs, tapparelle extras.
R17_1_A = "if (n > 0) { sessionStorage.setItem('cd_sync_reloading', '1'); console.log('[Sync] config più recente da HA — ricarico'); location.reload(); }"
R17_1_R = "if (n > 0) { if (sessionStorage.getItem('cd_sync_rl2')) { console.log('[Sync] applicato senza reload (loop-guard)'); try { if (typeof render === 'function') render(); } catch(e2) {} } else { sessionStorage.setItem('cd_sync_rl2', '1'); sessionStorage.setItem('cd_sync_reloading', '1'); console.log('[Sync] config più recente da HA — ricarico'); location.reload(); } }"
R17_2_A = "if (n > 0) { sessionStorage.setItem('cd_sync_reloading', '1'); console.log('[Sync] config più recente da HA — ricarico'); location.reload(); }"
R17_2_R = "if (n > 0) { if (sessionStorage.getItem('cd_sync_rl2')) { console.log('[Sync] applicato senza reload (loop-guard)'); try { if (typeof render === 'function') render(); } catch(e2) {} } else { sessionStorage.setItem('cd_sync_rl2', '1'); sessionStorage.setItem('cd_sync_reloading', '1'); console.log('[Sync] config più recente da HA — ricarico'); location.reload(); } }"
R17_3_A = "function cdCheckUpdate(isBoot) {\n    try {"
R17_3_R = "function cdCheckUpdate(isBoot) {\n    if (window.__DASHBOARDMODERN_HOSTED__) { try { if (isBoot) cdHideBoot(); } catch(e) {} return; }\n    try {"
R17_4_A = "DASHBOARD_VERSION = '0.11.1-int'"
R17_4_R = "DASHBOARD_VERSION = '0.12.0-int'"
R17_5_A = "v0.11.1"
R17_5_R = "v0.12.0-int"
R17_6_A = '<button class="ed-tab" data-tab="sezioni" onclick="editorSwitch(\'sezioni\')">📑 Sezioni</button>\n          '
R17_6_R = ""
R17_7_A = '<button class="ed-tab" data-tab="sezioni" onclick="editorSwitch(\'sezioni\')">📑 Sections</button>\n          '
R17_7_R = ""
R17_8_A = '<button class="ed-tab" data-tab="load"'
R17_8_R = '<button class="ed-tab" data-tab="sez0" onclick="editorSwitch(\'sez0\')">🏠 Home</button>\n          <button class="ed-tab" data-tab="sez1" onclick="editorSwitch(\'sez1\')">⚡ Energia</button>\n          <button class="ed-tab" data-tab="sez2" onclick="editorSwitch(\'sez2\')">🚗 EV</button>\n          <button class="ed-tab" data-tab="sez3" onclick="editorSwitch(\'sez3\')">🌞 Solare</button>\n          <button class="ed-tab" data-tab="sez4" onclick="editorSwitch(\'sez4\')">🛡️ Sicurezza</button>\n          <button class="ed-tab" data-tab="sez5" onclick="editorSwitch(\'sez5\')">🧺 Lavatrice</button>\n          <button class="ed-tab" data-tab="sez6" onclick="editorSwitch(\'sez6\')">🖥️ MiniPC</button>\n          <button class="ed-tab" data-tab="sez7" onclick="editorSwitch(\'sez7\')">🌡️ Temperatura</button>\n          <button class="ed-tab" data-tab="sez8" onclick="editorSwitch(\'sez8\')">⚡ Azioni</button>\n          <button class="ed-tab" data-tab="sez9" onclick="editorSwitch(\'sez9\')">❄️ Clima</button>\n          <button class="ed-tab" data-tab="sez10" onclick="editorSwitch(\'sez10\')">📷 Telecamere</button>\n          <button class="ed-tab" data-tab="load"'
R17_9_A = "if (tab === 'sezioni') body.innerHTML = editorRenderSezioni();"
R17_9_R = "if (tab.indexOf('sez') === 0 && tab !== 'sezioni') { body.innerHTML = editorRenderSezioni(); edFilterSez(body, parseInt(tab.slice(3), 10)); }"
R17_10_A = "function edSaveGeneral(){"
R17_10_R = "function cdSecKeyByOrd(n){ return ['home','energy','ev','boiler','security','','server','temp','','clima',''][n]||''; } function cdSecToggleHtml(k){ if(!k) return ''; var cur=cdCfg('cd_sections')||{}; var on=(cur[k]!==false); return '<button class=\"ed-btn-add\" style=\"width:100%; margin:10px 0; background:'+(on?'linear-gradient(135deg,#10b981,#047857)':'linear-gradient(135deg,#94a3b8,#64748b)')+'; color:#fff;\" data-key=\"'+k+'\" onclick=\"edSecTog(this)\">'+(on?'🟢 Sezione visibile in dashboard — tocca per nascondere':'⚪ Sezione nascosta — tocca per mostrare')+'</button>'; } function edSecTog(btn){ try { var k=btn.getAttribute('data-key'); var sez=cdVisibSez(); var idx=-1; for(var i=0;i<sez.length;i++){ if(sez[i][0]===k){ idx=i; break; } } if(idx>=0) edVisibToggle(idx); } catch(e){} } function edFilterSez(el, n){ try { var ds=el.querySelectorAll('details.ed-acc'); for (var i=0;i<ds.length;i++){ if(i===n){ ds[i].open=true; } else { ds[i].style.display='none'; } } var it=el.querySelector('.ed-intro'); if(it && !it.closest('details')) it.style.display='none'; var extra=''; var k=cdSecKeyByOrd(n); if(k) extra+=cdSecToggleHtml(k); if(n===2){ try { extra+=cdEvCarsHtml(); } catch(e2){} } if(n===1){ try { extra+=cdEnViewsHtml(); } catch(e2){} } if(extra){ var w=document.createElement('div'); w.innerHTML=extra; el.insertBefore(w, el.firstChild); } } catch(e){} } function edSaveGeneral(){"
R17_11_A = "editorSwitch('visib')"
R17_11_R = "editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib')"
R17_12_A = "return cdGenHtml()+cdEvCarsHtml()+cdEnViewsHtml()+"
R17_12_R = "var _rl2=''; try { _rl2=editorRenderRileva(); } catch(e) {} return cdGenHtml()+'<div class=\"ed-intro\" style=\"margin-top:18px;\"><b>Rilevamento e manutenzione</b>: autorilevamento entità e reset.</div>'+_rl2+'<div style=\"display:none;\">'+"
R17_13_A = "var card=btn.closest('[data-tapp]');"
R17_13_R = "if(btn.getAttribute('data-all')){ var svc2=btn.getAttribute('data-svc'); getTapparelle().forEach(function(t){ try { ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'cover', service:svc2, target:{ entity_id: t.entity } })); } catch(e2){} }); return; } var card=btn.closest('[data-tapp]');"
R17_14_A = "grid.innerHTML=cdGroupCards(list, cdTappCard);"
R17_14_R = 'grid.innerHTML=\'<div style="grid-column:1/-1; display:flex; gap:8px;">\'+\'<button class="tapp-btn" data-all="1" data-svc="open_cover" onclick="cdTappCmd(this)">▲ Apri tutte</button>\'+\'<button class="tapp-btn" data-all="1" data-svc="close_cover" onclick="cdTappCmd(this)">▼ Chiudi tutte</button>\'+\'</div>\'+cdGroupCards(list, cdTappCard);'
R17_15_A = "var pg=document.getElementById('page-tapparelle');"
R17_15_R = "var w2=document.getElementById('glance-custom-wrap'); if(w2){ var opens=getTapparelle().filter(function(t){ var st=(typeof STATES!=='undefined')?STATES[t.entity]:null; return st && st.state==='open'; }); var tv=document.getElementById('tapp-avvisi'); if(opens.length){ if(!tv){ tv=document.createElement('div'); tv.id='tapp-avvisi'; w2.appendChild(tv); } tv.innerHTML=opens.map(function(t){ return '<div class=\"irr-skip\" style=\"margin:6px 0;\">🪟 '+String(t.name||t.entity).replace(/</g,'&lt;')+' aperta</div>'; }).join(''); } else if(tv){ tv.remove(); } } var pg=document.getElementById('page-tapparelle');"

# Round 18: field-test fixes.
R18_1_A = "data-tab=\"visib\" onclick=\"editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib')\">"
R18_1_R = 'data-tab="visib" onclick="editorSwitch(\'visib\')">'
R18_2_A = "if (window.__DASHBOARDMODERN_HOSTED__) { try { if (isBoot) cdHideBoot(); } catch(e) {} return; }"
R18_2_R = "if (window.__DASHBOARDMODERN_HOSTED__ || location.pathname.indexOf('/dashboardmodern_static') !== -1) { try { if (isBoot) cdHideBoot(); } catch(e) {} return; }"
R18_3_A = "function cdEvCaptureProfile(){ var ov={}; try { var cur=JSON.parse(localStorage.getItem('cd_entity_overrides'))||{}; Object.keys(cur).forEach(function(k){ if(k.indexOf('dm.ev_')===0) ov[k]=cur[k]; }); } catch(e){}"
R18_3_R = "function cdEvCaptureProfile(){ var ov={}; try { document.querySelectorAll('input.ed-slot-in[data-ref^=\"dm.ev_\"]').forEach(function(el){ try { edSetSlot(el); } catch(e3){} }); } catch(e2){} try { Object.keys(ENTITY_OVERRIDES||{}).forEach(function(k){ if(k.indexOf('dm.ev_')===0) ov[k]=ENTITY_OVERRIDES[k]; }); } catch(e){}"
R18_4_A = "var cars=getEvCars(); cars.push({ name:n, ov:prof.ov, img:prof.img }); saveEvCars(cars); localStorage.setItem('cd_ev_car_active', String(cars.length-1));"
R18_4_R = "var cars=getEvCars(); var found=-1; for(var ci=0;ci<cars.length;ci++){ if(cars[ci] && cars[ci].name===n){ found=ci; break; } } if(found>=0){ cars[found]={ name:n, ov:prof.ov, img:prof.img }; localStorage.setItem('cd_ev_car_active', String(found)); } else { cars.push({ name:n, ov:prof.ov, img:prof.img }); localStorage.setItem('cd_ev_car_active', String(cars.length-1)); } saveEvCars(cars);"
R18_5_A = 'return \'<div class="ed-intro" style="margin-top:16px;">🚗'
R18_5_R = "var sel2 = cars.length ? '<select class=\"ed-input\" style=\"width:100%; margin:8px 0;\" onchange=\"cdEvCarSelEd(this)\">'+'<option value=\"\">— Scegli un profilo da modificare —</option>'+cars.map(function(c,i){ return '<option value=\"'+i+'\"'+(i===act?' selected':'')+'>🚗 '+String(c.name||('Auto '+(i+1))).replace(/</g,'&lt;')+'</option>'; }).join('')+'</select>' : ''; return sel2+'<div class=\"ed-intro\" style=\"margin-top:16px;\">🚗"
R18_6_A = "function cdEvCarBtn(btn){"
R18_6_R = "function cdEvCarSelEd(sel){ try { var i=parseInt(sel.value,10); if(isNaN(i)) return; cdEvApplyCar(i); try { editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'sez2'); } catch(e2){} } catch(e){} } function cdEvCarBtn(btn){"
R18_7_A = "function edFilterSez(el, n){ try {"
R18_7_R = "function edSecSave(){ try { cdMarkDirty(); cdSyncPush(); } catch(e){} try { edToast('Sezione salvata'); } catch(e){} } function edCostSplit(el, mode){ try { var kids=Array.prototype.slice.call(el.children); var start=-1; for(var i=0;i<kids.length;i++){ var t=(kids[i].textContent||''); if(t.indexOf('Costo energia')!==-1||t.indexOf('Energy cost')!==-1){ start=i; break; } } if(start<0) return null; if(mode==='hide'){ for(var j=start;j<kids.length;j++) kids[j].style.display='none'; return null; } var frag=document.createElement('div'); for(var k2=start;k2<kids.length;k2++) frag.appendChild(kids[k2]); return frag; } catch(e){ return null; } } function edFilterSez(el, n){ try {"
R18_8_A = " if(extra){ var w=document.createElement('div'); w.innerHTML=extra; el.insertBefore(w, el.firstChild); }"
R18_8_R = " if(extra){ var w=document.createElement('div'); w.innerHTML=extra; el.insertBefore(w, el.firstChild); } if(n===0){ ['dm.home_interruttore_antifurto','dm.home_script_apertura_cancello'].forEach(function(rf){ var inp=el.querySelector('input[data-ref=\"'+rf+'\"]'); var blk=inp && (inp.closest('.ed-slot')||inp.parentElement); if(blk) blk.style.display='none'; }); } if(n===1){ try { var tmp=document.createElement('div'); tmp.innerHTML=editorRenderLoad(); var frag=edCostSplit(tmp,'move'); if(frag) el.appendChild(frag); } catch(e4){} } if(n>=7){ var sv=document.createElement('div'); sv.innerHTML='<button class=\"ed-btn-add\" style=\"width:100%; margin-top:10px;\" onclick=\"edSecSave()\">💾 Salva sezione</button>'; el.appendChild(sv); }"
R18_9_A = "if (tab === 'load')   body.innerHTML = editorRenderLoad();"
R18_9_R = "if (tab === 'load') { body.innerHTML = editorRenderLoad(); edCostSplit(body,'hide'); }"

# Round 19: appliance save, tapparelle alerts, cams merge, nav order.
R19_1_A = "if (tab === 'appliances') { body.innerHTML = editorRenderAppliances();"
R19_1_R = 'if (tab === \'appliances\') { body.innerHTML = editorRenderAppliances() + \'<button class="ed-btn-add" style="width:100%; margin-top:10px;" onclick="edSecSave()">💾 Salva sezione</button>\';'
R19_2_A = '<option value="custom"'
R19_2_R = '<option value="tapp">🪟 Tapparelle (cover)</option><option value="custom"'
R19_3_A = "const grp = document.getElementById('ed-avv-grp').value;"
R19_3_R = "const grp = document.getElementById('ed-avv-grp').value; if (grp === 'tapp') { const entT = (document.getElementById('ed-avv-ent').value||'').trim(); const nmT = (document.getElementById('ed-avv-name').value||'').trim(); if (!entT.includes('.')) { alert('Inserisci una entità cover valida'); return; } const itemT = { entities:[entT], name: nmT || entT, icon:'🪟', cond:'eq', value:'open' }; const listT = cdCfgList('cd_avvisi_custom'); listT.push(itemT); localStorage.setItem('cd_avvisi_custom', JSON.stringify(listT)); try { cdMarkDirty(); cdSyncPush(); } catch(e){} editorSwitch('avvisi'); edToast('Avviso tapparella aggiunto'); return; }"
R19_4_A = "if(i===n){ ds[i].open=true; } else { ds[i].style.display='none'; }"
R19_4_R = "var alsoN=(n===4)?10:-1; if(i===n||i===alsoN){ ds[i].open=true; } else { ds[i].style.display='none'; }"
R19_5_A = '<button class="ed-tab" data-tab="sez10" onclick="editorSwitch(\'sez10\')">📷 Telecamere</button>\n          '
R19_5_R = ""
R19_6_A = "function toggleVentola()"
R19_6_R = "function cdNavOrder(){ try { var v=JSON.parse(localStorage.getItem('cd_navbar_order'))||[]; return Array.isArray(v)?v:[]; } catch(e){ return []; } } function cdNavTabs(){ var out=[]; document.querySelectorAll('.tab[data-tab]').forEach(function(b){ var t=(b.textContent||'').trim(); out.push({ k:b.getAttribute('data-tab'), lbl:t }); }); return out; } function cdNavKeys(){ var tabs=cdNavTabs(); var ord=cdNavOrder(); var keys=[]; ord.forEach(function(k){ if(tabs.some(function(t){ return t.k===k; }) && keys.indexOf(k)<0) keys.push(k); }); tabs.forEach(function(t){ if(keys.indexOf(t.k)<0) keys.push(t.k); }); return keys; } function cdApplyNavOrder(){ try { var ord=cdNavOrder(); if(!ord.length) return; var btns=document.querySelectorAll('.tab[data-tab]'); if(!btns.length) return; var nav=btns[0].parentElement; var map={}; btns.forEach(function(b){ map[b.getAttribute('data-tab')]=b; }); cdNavKeys().forEach(function(k){ if(map[k]) nav.appendChild(map[k]); }); } catch(e){} } setTimeout(function(){ try { cdApplyNavOrder(); } catch(e){} }, 1200); function toggleVentola()"
R19_7_A = "function edSaveGeneral(){"
R19_7_R = "function cdNavOrderHtml(){ try { var tabs=cdNavTabs(); if(!tabs.length) return ''; var lbl={}; tabs.forEach(function(t){ lbl[t.k]=t.lbl; }); var keys=cdNavKeys(); var rows=keys.map(function(k,i){ return '<div class=\"ed-row\" style=\"align-items:center;\"><div style=\"display:flex; gap:4px;\"><div class=\"ed-del\" style=\"'+(i===0?'opacity:0.25;pointer-events:none;':'')+'\" data-i=\"'+i+'\" data-d=\"-1\" onclick=\"edNavMove(this)\">▲</div><div class=\"ed-del\" style=\"'+(i===keys.length-1?'opacity:0.25;pointer-events:none;':'')+'\" data-i=\"'+i+'\" data-d=\"1\" onclick=\"edNavMove(this)\">▼</div></div><div class=\"ed-row-main\"><div class=\"ed-row-new\">'+String(lbl[k]||k).replace(/</g,'&lt;')+'</div></div></div>'; }).join(''); return '<div class=\"ed-intro\" style=\"margin-top:16px;\"><b>Ordine navbar</b>: disponi le sezioni della barra come preferisci.</div>'+rows; } catch(e){ return ''; } } function edNavMove(btn){ try { var i=parseInt(btn.getAttribute('data-i'),10); var d=parseInt(btn.getAttribute('data-d'),10); var keys=cdNavKeys(); var j=i+d; if(isNaN(i)||isNaN(d)||j<0||j>=keys.length) return; var t=keys[i]; keys[i]=keys[j]; keys[j]=t; localStorage.setItem('cd_navbar_order', JSON.stringify(keys)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} cdApplyNavOrder(); editorSwitch('visib'); } catch(e){} } function edSaveGeneral(){"
R19_8_A = (
    'return cdGenHtml()+\'<div class="ed-intro" style="margin-top:18px;"><b>Rilevamento'
)
R19_8_R = 'return cdGenHtml()+cdNavOrderHtml()+\'<div class="ed-intro" style="margin-top:18px;"><b>Rilevamento'
R19_9_A = "'cd_piscina','cd_ev_cars','cd_energy_views','cd_floors'"
R19_9_R = "'cd_piscina','cd_ev_cars','cd_energy_views','cd_navbar_order','cd_floors'"

# Multi-plancia: secondary panels use an instance-suffixed cloud-sync
# key; the primary keeps the historical key so upgrades lose nothing.
SYNC_KEY_MULTI_A = "'dashboardmodern_integration_config'"
SYNC_KEY_MULTI_R = (
    "('dashboardmodern_integration_config' +"
    " (window.__DASHBOARDMODERN_PRIMARY__ === false"
    " && window.__DASHBOARDMODERN_INSTANCE__"
    " ? '__' + String(window.__DASHBOARDMODERN_INSTANCE__)"
    ".replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) : ''))"
)

# Round 21: registry-driven autodetect and hidden-by-default sections.
R21_1_A = "function toggleVentola()"
R21_1_R = "function cdSecShow(k){ try { if(!k) return; var cur=cdCfg('cd_sections')||{}; if(cur[k]===false){ cur[k]=true; localStorage.setItem('cd_sections', JSON.stringify(cur)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { if(typeof updateEditButtonVisibility==='function') updateEditButtonVisibility(); } catch(e2){} try { if(typeof render==='function') render(); } catch(e2){} } } catch(e){} } function cdSecShowByRef(ref){ try { var r=String(ref||''); var mapp=[['dm.energy_','energy'],['dm.ev_','ev'],['dm.boiler_','boiler'],['dm.security_','security'],['dm.server_','server'],['dm.home_','home']]; for(var i=0;i<mapp.length;i++){ if(r.indexOf(mapp[i][0])===0){ cdSecShow(mapp[i][1]); return; } } } catch(e){} } (function(){ try { if(!window.__DASHBOARDMODERN_HOSTED__) return; if(localStorage.getItem('cd_sections')) return; if(localStorage.getItem('cd_sections_boot')) return; var noCfg = !Object.keys(cdCfg('cd_entity_overrides')||{}).length && !(cdCfgList('cd_stanze')).length && !(cdCfgList('cd_clima_units')).length && !Object.keys(cdCfg('cd_luci')||{}).length; if(!noCfg) return; localStorage.setItem('cd_sections_boot','1'); localStorage.setItem('cd_sections', JSON.stringify({ energy:false, ev:false, boiler:false, clima:false, temp:false, security:false, server:false })); } catch(e){} })(); function toggleVentola()"
R21_4_A = "function toggleVentola()"
R21_4_R = "function cdRegEnrich(done){ try { var fin=false; var to=setTimeout(function(){ if(!fin){ fin=true; done(); } }, 9000); var so=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/websocket'); var mid=1; var want={}; var out={ floors:null, areas:null, ents:null, devs:null }; function fire(type,slot){ var id=mid++; want[id]=slot; so.send(JSON.stringify({ id:id, type:type })); } function finish(){ if(fin) return; fin=true; clearTimeout(to); try { so.close(); } catch(e2){} try { cdRegApply(out); } catch(e2){} done(); } so.onerror=function(){ finish(); }; so.onmessage=function(ev){ try { var m=JSON.parse(ev.data); if(m.type==='auth_required'){ so.send(JSON.stringify({ type:'auth', access_token:(window.__DASHBOARDMODERN_REAL_TOKEN__||'') })); return; } if(m.type==='auth_ok'){ fire('config/floor_registry/list','floors'); fire('config/area_registry/list','areas'); fire('config/entity_registry/list','ents'); fire('config/device_registry/list','devs'); return; } if(m.type==='result' && want[m.id]){ out[want[m.id]] = m.success ? (m.result||[]) : []; delete want[m.id]; if(out.floors&&out.areas&&out.ents&&out.devs) finish(); } } catch(e3){} }; } catch(e){ done(); } } function cdRegApply(o){ try { var floors=(o.floors||[]).slice().sort(function(a,b){ return (a.level||0)-(b.level||0); }); var fName={}; floors.forEach(function(f){ fName[f.floor_id]=f.name; }); if(floors.length){ localStorage.setItem('cd_floors', JSON.stringify(floors.map(function(f){ return f.name; }))); } var aName={}; var aFloor={}; (o.areas||[]).forEach(function(a){ aName[a.area_id]=a.name; aFloor[a.area_id]=fName[a.floor_id]||''; }); if((o.areas||[]).length){ var st=cdCfgList('cd_stanze').slice(); (o.areas||[]).forEach(function(a){ var ex=null; for(var i=0;i<st.length;i++){ if(st[i]&&st[i].name===a.name){ ex=st[i]; break; } } if(ex){ if(!ex.floor && aFloor[a.area_id]) ex.floor=aFloor[a.area_id]; } else { var r={ name:a.name, icon:'🏠' }; if(aFloor[a.area_id]) r.floor=aFloor[a.area_id]; st.push(r); } }); localStorage.setItem('cd_stanze', JSON.stringify(st)); } var devArea={}; (o.devs||[]).forEach(function(d){ if(d.area_id) devArea[d.id]=d.area_id; }); var entArea={}; (o.ents||[]).forEach(function(e){ var ar=e.area_id||devArea[e.device_id]; if(ar) entArea[e.entity_id]=aName[ar]||''; }); var rooms={}; try { rooms=cdCfg('cd_luci_rooms')||{}; } catch(e2){} var ch=false; Object.keys(cdCfg('cd_luci')||{}).forEach(function(id){ if(!rooms[id] && entArea[id]){ rooms[id]=entArea[id]; ch=true; } }); if(ch) localStorage.setItem('cd_luci_rooms', JSON.stringify(rooms)); var units=getClimaUnits().slice(); var uc=false; units.forEach(function(u){ if(u && !u.room && entArea[u.entity]){ u.room=entArea[u.entity]; uc=true; } }); if(uc) localStorage.setItem('cd_clima_units', JSON.stringify(units)); var cams=cdCfgList('cd_cameras').slice(); var cc=false; cams.forEach(function(c){ var ce=c&&(c.entity||c.cam); if(c && !c.room && ce && entArea[ce]){ c.room=entArea[ce]; cc=true; } }); if(cc) localStorage.setItem('cd_cameras', JSON.stringify(cams)); try { if((cdCfgList('cd_stanze')||[]).some(function(r){ return r&&r.temp; })) cdSecShow('temp'); if(getClimaUnits().length) cdSecShow('clima'); if(cdCfgList('cd_cameras').length) cdSecShow('security'); var ov=cdCfg('cd_entity_overrides')||{}; Object.keys(ov).forEach(function(k){ cdSecShowByRef(k); }); } catch(e4){} try { cdMarkDirty(); cdSyncPush(); } catch(e5){} } catch(e){} } function toggleVentola()"
R21_5_A = "setTimeout(function(){ location.reload(); }, 1400); }"
R21_5_R = (
    "cdRegEnrich(function(){ setTimeout(function(){ location.reload(); }, 400); }); }"
)

R21S_it_A = "rn; }\n    localStorage.setItem('cd_entity_overrides', JSON.stringify(ENTITY_OVERRIDES));\n    try { cdMarkDirty(); cdSyncPush(); } catch(e){}"
R21S_it_R = "rn; }\n    localStorage.setItem('cd_entity_overrides', JSON.stringify(ENTITY_OVERRIDES));\n    try { cdMarkDirty(); cdSyncPush(); } catch(e){} try { cdSecShowByRef(ref); } catch(e){}"
R21C_it_A = "e });\n    localStorage.setItem('cd_clima_units', JSON.stringify(units));\n    buildClimaCards();"
R21C_it_R = "e });\n    localStorage.setItem('cd_clima_units', JSON.stringify(units));\n    try { cdSecShow('clima'); } catch(e){} buildClimaCards();"
R21S_en_A = "rn; }\n    localStorage.setItem('cd_entity_overrides', JSON.stringify(ENTITY_OVERRIDES));\n    try { cdMarkDirty(); cdSyncPush(); } catch(e){}"
R21S_en_R = "rn; }\n    localStorage.setItem('cd_entity_overrides', JSON.stringify(ENTITY_OVERRIDES));\n    try { cdMarkDirty(); cdSyncPush(); } catch(e){} try { cdSecShowByRef(ref); } catch(e){}"
R21C_en_A = "e });\n    localStorage.setItem('cd_clima_units', JSON.stringify(units));\n    buildClimaCards();"
R21C_en_R = "e });\n    localStorage.setItem('cd_clima_units', JSON.stringify(units));\n    try { cdSecShow('clima'); } catch(e){} buildClimaCards();"

# Round 22: navbar visibility engine and instance diagnostics.
R22_1_A = "function toggleVentola()"
R22_1_R = "function cdApplyNavVis(){ try { var cur=cdCfg('cd_sections')||{}; ['home','energy','ev','boiler','clima','temp','security','server'].forEach(function(k){ var b=document.querySelector('.tab[data-tab=\"'+k+'\"]'); if(b) b.style.display=(cur[k]===false)?'none':''; }); } catch(e){} } try { cdApplyNavVis(); } catch(e) {} setTimeout(function(){ try { cdApplyNavVis(); } catch(e) {} }, 1500); setInterval(function(){ try { cdApplyNavVis(); } catch(e) {} }, 3000); function toggleVentola()"
R22_2_A = "function edVisibToggle(idx){ var sez=cdVisibSez(); var x=sez[idx]; if(!x) return; var k=x[0];"
R22_2_R = "function edVisibToggle(idx){ var sez=cdVisibSez(); var x=sez[idx]; if(!x) return; var k=x[0]; setTimeout(function(){ try { cdApplyNavVis(); } catch(e){} }, 50);"
R22_3_A = "function cdSecShow(k){ try { if(!k) return;"
R22_3_R = "function cdSecShow(k){ try { if(!k) return; setTimeout(function(){ try { cdApplyNavVis(); } catch(e2){} }, 60);"
R22_4_A = "+' | sync:'+(localStorage.getItem('cd_sync_ts')||0)"
R22_4_R = "+' | sync:'+(localStorage.getItem('cd_sync_ts')||0)+' | inst:'+String(window.__DASHBOARDMODERN_STORAGE_NS__||'-').slice(0,10)+' | prim:'+(window.__DASHBOARDMODERN_PRIMARY__===false?0:1)+' | q:'+String(location.search||'').slice(0,18)+' | key:'+(('dashboardmodern_integration_config' + (window.__DASHBOARDMODERN_PRIMARY__===false && window.__DASHBOARDMODERN_INSTANCE__ ? '__'+String(window.__DASHBOARDMODERN_INSTANCE__).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,16) : ''))).slice(-14)"

# The reset reload keeps the frame query: dmi/dmp carry the instance.
RESET_KEEP_QUERY_A = "location.replace(location.pathname), 450)"
RESET_KEEP_QUERY_R = (
    "location.replace(location.pathname + (location.search || '')), 450)"
)

# Boot section defaults, dependency-free: first boot with no saved
# choices scans real content — populated sections visible, empty hidden.
SECBOOT_A = "(function(){ try { if(!window.__DASHBOARDMODERN_HOSTED__) return; if(localStorage.getItem('cd_sections')) return; if(localStorage.getItem('cd_sections_boot')) return; var noCfg = !Object.keys(cdCfg('cd_entity_overrides')||{}).length && !(cdCfgList('cd_stanze')).length && !(cdCfgList('cd_clima_units')).length && !Object.keys(cdCfg('cd_luci')||{}).length; if(!noCfg) return; localStorage.setItem('cd_sections_boot','1'); localStorage.setItem('cd_sections', JSON.stringify({ energy:false, ev:false, boiler:false, clima:false, temp:false, security:false, server:false })); } catch(e){} })();"
SECBOOT_R = "function cdSecLS(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } } function cdSecHasContent(k){ try { var ov=cdSecLS('cd_entity_overrides')||{}; var oks=Object.keys(ov); function pref(p){ for(var i=0;i<oks.length;i++){ if(oks[i].indexOf(p)===0) return true; } return false; } if(k==='energy') return pref('dm.energy_'); if(k==='ev') return pref('dm.ev_'); if(k==='boiler') return pref('dm.boiler_'); if(k==='server') return pref('dm.server_'); if(k==='security') return pref('dm.security_') || ((cdSecLS('cd_cameras')||[]).length>0); if(k==='clima') return (cdSecLS('cd_clima_units')||[]).length>0; if(k==='temp'){ var st=cdSecLS('cd_stanze')||[]; for(var i2=0;i2<st.length;i2++){ if(st[i2]&&st[i2].temp) return true; } return false; } return true; } catch(e){ return true; } } function cdSecBoot(){ try { if(!window.__DASHBOARDMODERN_HOSTED__) return; if(localStorage.getItem('cd_sections_boot')) return; if(localStorage.getItem('cd_sections')) { localStorage.setItem('cd_sections_boot','1'); return; } var out={}; ['energy','ev','boiler','clima','temp','security','server'].forEach(function(k){ out[k]=cdSecHasContent(k)?true:false; }); localStorage.setItem('cd_sections', JSON.stringify(out)); localStorage.setItem('cd_sections_boot','1'); try { cdApplyNavVis(); } catch(e2){} try { if(typeof render==='function') render(); } catch(e2){} } catch(e){} } cdSecBoot(); setTimeout(cdSecBoot, 1200); "

# Round 25: navbar engine v3 — reset-proof, complete, toggled.
R25_1_A = "function cdApplyNavVis(){ try { var cur=cdCfg('cd_sections')||{}; ['home','energy','ev','boiler','clima','temp','security','server'].forEach(function(k){ var b=document.querySelector('.tab[data-tab=\"'+k+'\"]'); if(b) b.style.display=(cur[k]===false)?'none':''; }); } catch(e){} } try { cdApplyNavVis(); } catch(e) {} setTimeout(function(){ try { cdApplyNavVis(); } catch(e) {} }, 1500); setInterval(function(){ try { cdApplyNavVis(); } catch(e) {} }, 3000); "
R25_1_R = "function cdNavVisMap(){ return { home:'home', energy:'energy', appliances:'appliances-main', ev:'ev', boiler:'boiler', clima:'clima', temp:'temp', security:'security', server:'server', tapparelle:'tapparelle', irrigazione:'irrigazione', piscina:'piscina' }; } function cdApplyNavVis(){ try { var cur=cdCfg('cd_sections')||{}; var mp=cdNavVisMap(); Object.keys(mp).forEach(function(k){ var b=document.querySelector('.tab[data-tab=\"'+mp[k]+'\"]'); if(b) b.style.display=(cur[k]===false)?'none':''; }); } catch(e){} } try { cdApplyNavVis(); } catch(e) {} setTimeout(function(){ try { cdApplyNavVis(); } catch(e) {} }, 1500); setInterval(function(){ try { cdApplyNavVis(); } catch(e) {} }, 3000); "
R25_2_A = "function cdSecLS(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } } function cdSecHasContent(k){ try { var ov=cdSecLS('cd_entity_overrides')||{}; var oks=Object.keys(ov); function pref(p){ for(var i=0;i<oks.length;i++){ if(oks[i].indexOf(p)===0) return true; } return false; } if(k==='energy') return pref('dm.energy_'); if(k==='ev') return pref('dm.ev_'); if(k==='boiler') return pref('dm.boiler_'); if(k==='server') return pref('dm.server_'); if(k==='security') return pref('dm.security_') || ((cdSecLS('cd_cameras')||[]).length>0); if(k==='clima') return (cdSecLS('cd_clima_units')||[]).length>0; if(k==='temp'){ var st=cdSecLS('cd_stanze')||[]; for(var i2=0;i2<st.length;i2++){ if(st[i2]&&st[i2].temp) return true; } return false; } return true; } catch(e){ return true; } } function cdSecBoot(){ try { if(!window.__DASHBOARDMODERN_HOSTED__) return; if(localStorage.getItem('cd_sections_boot')) return; if(localStorage.getItem('cd_sections')) { localStorage.setItem('cd_sections_boot','1'); return; } var out={}; ['energy','ev','boiler','clima','temp','security','server'].forEach(function(k){ out[k]=cdSecHasContent(k)?true:false; }); localStorage.setItem('cd_sections', JSON.stringify(out)); localStorage.setItem('cd_sections_boot','1'); try { cdApplyNavVis(); } catch(e2){} try { if(typeof render==='function') render(); } catch(e2){} } catch(e){} } cdSecBoot(); setTimeout(cdSecBoot, 1200); "
R25_2_R = "function cdSecLS(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } } function cdSecHasContent(k){ try { var ov=cdSecLS('cd_entity_overrides')||{}; var oks=Object.keys(ov); function pref(p){ for(var i=0;i<oks.length;i++){ if(oks[i].indexOf(p)===0) return true; } return false; } if(k==='energy') return pref('dm.energy_'); if(k==='ev') return pref('dm.ev_'); if(k==='boiler') return pref('dm.boiler_'); if(k==='server') return pref('dm.server_'); if(k==='security') return pref('dm.security_') || ((cdSecLS('cd_cameras')||[]).length>0); if(k==='clima') return (cdSecLS('cd_clima_units')||[]).length>0; if(k==='temp'){ var st=cdSecLS('cd_stanze')||[]; for(var i2=0;i2<st.length;i2++){ if(st[i2]&&st[i2].temp) return true; } return false; } if(k==='appliances') return (cdSecLS('cd_appliances')||[]).length>0; if(k==='tapparelle') return (cdSecLS('cd_tapparelle')||[]).length>0; if(k==='irrigazione'){ var irr=cdSecLS('cd_irrigazione')||{}; return ((irr.zones)||[]).length>0; } if(k==='piscina'){ var pc=cdSecLS('cd_piscina')||{}; return Object.keys(pc).length>0; } return true; } catch(e){ return true; } } function cdSecBoot(){ try { if(!window.__DASHBOARDMODERN_HOSTED__) return; if(localStorage.getItem('cd_sections')) return; var out={}; ['energy','appliances','ev','boiler','clima','temp','security','server','tapparelle','irrigazione','piscina'].forEach(function(k){ out[k]=cdSecHasContent(k)?true:false; }); localStorage.setItem('cd_sections', JSON.stringify(out)); try { cdApplyNavVis(); } catch(e2){} try { if(typeof render==='function') render(); } catch(e2){} } catch(e){} } cdSecBoot(); setTimeout(cdSecBoot, 1200); "
R25_3_A = "function edSecTog(btn){ try { var k=btn.getAttribute('data-key'); var sez=cdVisibSez(); var idx=-1; for(var i=0;i<sez.length;i++){ if(sez[i][0]===k){ idx=i; break; } } if(idx>=0) edVisibToggle(idx); } catch(e){} } "
R25_3_R = "function edSecTog(btn){ try { var k=btn.getAttribute('data-key'); if(!k) return; var cur=cdCfg('cd_sections')||{}; cur[k]=(cur[k]===false); localStorage.setItem('cd_sections', JSON.stringify(cur)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { cdApplyNavVis(); } catch(e2){} try { if(typeof render==='function') render(); } catch(e2){} editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib'); } catch(e){} } "
R25_4_A = "if (tab === 'appliances') { body.innerHTML = editorRenderAppliances()"
R25_4_R = "if (tab === 'appliances') { body.innerHTML = cdSecToggleHtml('appliances') + editorRenderAppliances()"
R25_5_A = "if (tab === 'tapp') body.innerHTML = editorRenderTapparelle();"
R25_5_R = "if (tab === 'tapp') body.innerHTML = cdSecToggleHtml('tapparelle') + editorRenderTapparelle();"
R25_6_A = "if (tab === 'irr') body.innerHTML = editorRenderIrrigazione();"
R25_6_R = "if (tab === 'irr') body.innerHTML = cdSecToggleHtml('irrigazione') + editorRenderIrrigazione();"
R25_7_A = "if (tab === 'pool') body.innerHTML = editorRenderPiscina();"
R25_7_R = "if (tab === 'pool') body.innerHTML = cdSecToggleHtml('piscina') + editorRenderPiscina();"

# cd_sections maps written by older engines lack the newer section
# keys (appliances, tapparelle, irrigazione, piscina): fill only the
# missing ones from content, never touching existing choices.
SECMIG_A = "if(localStorage.getItem('cd_sections')) return;"
SECMIG_R = "var _cs=localStorage.getItem('cd_sections'); if(_cs){ try { var cur2=JSON.parse(_cs)||{}; var ch2=false; ['energy','appliances','ev','boiler','clima','temp','security','server','tapparelle','irrigazione','piscina'].forEach(function(k){ if(!(k in cur2)){ cur2[k]=cdSecHasContent(k)?true:false; ch2=true; } }); if(ch2){ localStorage.setItem('cd_sections', JSON.stringify(cur2)); try { cdApplyNavVis(); } catch(e3){} } } catch(e4){} return; }"

# Round 26: field bugfixes (temp grid, room select, toggles, lights).
R26_1_A = "const _rooms = getStanze();"
R26_1_R = "const _rooms = getStanze().filter(function(r){ return r && r.temp; });"
R26_2_A = "function toggleVentola()"
R26_2_R = "function cdApplEntTog(en, btn){ try { if(navigator.vibrate) navigator.vibrate(12); var dom=String(en).split('.')[0]; var cur=(STATES[en]&&STATES[en].state)||'off'; var svc=(cur==='on')?'turn_off':'turn_on'; ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain: dom, service: svc, target:{ entity_id: en } })); if(btn){ btn.style.opacity='0.45'; setTimeout(function(){ try { btn.style.opacity=''; var st2=(STATES[en]&&STATES[en].state)||''; btn.classList.toggle('on', st2==='on'); } catch(e2){} }, 900); } } catch(e){} } function toggleVentola()"
R26_3_A = " style=\"font-weight:800;color:#0ea5e9;\">'+val+' '+unit+'</div></div>';"
R26_3_R = " style=\"font-weight:800;color:#0ea5e9;\">'+val+' '+unit+'</div>'+((/^(switch|light|input_boolean|fan)\\./.test(en))?('<button class=\"ed-ord-btn'+(((STATES[en]&&STATES[en].state)==='on')?' on':'')+'\" style=\"flex:0 0 auto; margin-left:8px; width:44px; height:30px; border:none; border-radius:9px; cursor:pointer; font-size:15px; background:rgba(14,165,233,0.16);\" onclick=\"event.stopPropagation(); cdApplEntTog(\\''+en+'\\', this)\">\\u23fb</button>'):'')+'</div>';"
R26_4_A = "function edSaveGeneral(){"
R26_4_R = "function cdLuceRen(id){ try { var luci=cdCfg('cd_luci')||{}; var cur=luci[id]||id; var n=prompt('Nome luce', cur); if(n===null) return; n=String(n).trim(); if(!n) return; luci[id]=n; localStorage.setItem('cd_luci', JSON.stringify(luci)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { if(typeof updateGestioneLuci==='function') updateGestioneLuci(); } catch(e2){} editorSwitch('luci'); } catch(e){} } function cdLuceDel(id){ try { if(!confirm('Rimuovere questa luce dalla dashboard?')) return; var luci=cdCfg('cd_luci')||{}; delete luci[id]; localStorage.setItem('cd_luci', JSON.stringify(luci)); var rooms=cdCfg('cd_luci_rooms')||{}; if(rooms[id]!==undefined){ delete rooms[id]; localStorage.setItem('cd_luci_rooms', JSON.stringify(rooms)); } try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { if(typeof updateGestioneLuci==='function') updateGestioneLuci(); } catch(e2){} editorSwitch('luci'); } catch(e){} } function edSaveGeneral(){"
R26_5_A = (
    "onchange=\"cdLuciSetRoom('${id}', this.value)\">${roomOptions(room)}</select>"
)
R26_5_R = 'onchange="cdLuciSetRoom(\'${id}\', this.value)">${roomOptions(room)}</select> <button class="ed-ord-btn" title="Rinomina" onclick="cdLuceRen(\'${id}\')" style="width:26px; height:22px; border:none; border-radius:6px; background:rgba(14,165,233,0.15); cursor:pointer; font-size:11px;">\\u270f\\ufe0f</button> <button class="ed-ord-btn" title="Elimina" onclick="cdLuceDel(\'${id}\')" style="width:26px; height:22px; border:none; border-radius:6px; background:rgba(239,68,68,0.15); cursor:pointer; font-size:11px;">\\U0001f5d1\\ufe0f</button>'

# Round 27: appliances page, used rooms, lens guarantee, report hook.
R27_3_A = "t.dataset.tab === 'piscina') renderPiscina();"
R27_3_R = "t.dataset.tab === 'piscina') renderPiscina(); if (t.dataset.tab === 'appliances-main') { try { renderAppliances(); } catch(eA){} }"
R27_4_A = "function cdRoomOptions(sel){ var rooms = cdRoomList();"
R27_4_R = "function cdRoomsUsed(){ try { var all=cdRoomList(); var used={}; all.forEach(function(r){ if(r&&r.temp&&r.name) used[r.name]=1; }); var lr=cdCfg('cd_luci_rooms')||{}; Object.keys(lr).forEach(function(k){ if(lr[k]) used[lr[k]]=1; }); try { getClimaUnits().forEach(function(u){ if(u&&u.room) used[u.room]=1; }); } catch(e2){} try { cdCfgList('cd_appliances').forEach(function(a){ if(a&&a.room) used[a.room]=1; }); } catch(e2){} try { (cdCfgList('cd_tapparelle')||[]).forEach(function(t){ if(t&&t.room) used[t.room]=1; }); } catch(e2){} var out=all.filter(function(r){ return r&&r.name&&used[r.name]; }); return out.length?out:all; } catch(e){ return cdRoomList(); } } function cdRoomOptions(sel){ var rooms = cdRoomsUsed();"
R27_5_A = " if(n>=7){ var sv=document.createElement('div');"
R27_5_R = " try { el.querySelectorAll('input.ed-slot-in').forEach(function(inp){ var nx=inp.nextElementSibling; if(nx && nx.tagName==='BUTTON') return; var b=document.createElement('button'); b.type='button'; b.textContent='🔍'; b.style.cssText='flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#38bdf8,#0284c7); cursor:pointer; font-size:15px;'; b.onclick=function(){ try { wzPickEntity(inp.getAttribute('data-ref')||inp); } catch(e2){} }; var par=inp.parentElement; if(par){ par.style.display='flex'; par.style.gap='6px'; inp.style.flex='1'; } inp.insertAdjacentElement('afterend', b); }); } catch(eL){} if(n>=7){ var sv=document.createElement('div');"
R27_7_A = (
    "function edApplEdit(i){ const a=getAppliances()[i]; if(!a) return; _applEditIdx=i;"
)
R27_7_R = "function edApplEdit(i){ const a=getAppliances()[i]; if(!a) return; _applEditIdx=i; try { edToast('Modifica: '+(a.name||'elettrodomestico')); } catch(eT){} setTimeout(function(){ try { var f=document.getElementById('appl-name')||document.getElementById('appl-ent'); if(f){ f.scrollIntoView({behavior:'smooth', block:'center'}); f.focus(); } } catch(e2){} }, 250);"
R27_8_A = "function edApplDel(i){ const list=getAppliances();"
R27_8_R = "function edApplDel(i){ if(!confirm('Eliminare questo elettrodomestico?')) return; const list=getAppliances();"

R27H_it_A = '<h3 class="section-title" id="appliances-title" style="display:none;">Elettrodomestici</h3>\n    <div class="appliances-grid" id="appliances-grid"><!-- v0.11.0: elettrodomestici (cd_appliances) --></div>'
R27H_it_R = ""
R27H_en_A = '<h3 class="section-title" id="appliances-title" style="display:none;">Appliances</h3>\n    <div class="appliances-grid" id="appliances-grid"></div>'
R27H_en_R = ""

R27RPT_it_A = "edToast(item?'Elettrodomestico salvato':'Aggiunto');"
R27RPT_it_R = "try { if(typeof cdApplReportEntries==='function') cdApplReportEntries(); } catch(eR){} edToast(item?'Elettrodomestico salvato':'Aggiunto');"
R27RPT_en_A = "edToast(item?'Appliance saved':'Added');"
R27RPT_en_R = "try { if(typeof cdApplReportEntries==='function') cdApplReportEntries(); } catch(eR){} edToast(item?'Appliance saved':'Added');"


R28NV_A = "var b=document.querySelector('.tab[data-tab=\"'+mp[k]+'\"]'); if(b) b.style.display=(cur[k]===false)?'none':'';"
R28NV_R = "document.querySelectorAll('.tab[data-tab=\"'+mp[k]+'\"]').forEach(function(b){ if(cur[k]===false) b.style.setProperty('display','none','important'); else b.style.removeProperty('display'); });"

# Round 29: kill the v262 physical remover; ON/OFF text; temp render.
R29_1_A = "if (tab) tab.remove();   // v262: rimozione fisica — nessun CSS può farlo riapparire\n                if (page) page.remove();"
R29_1_R = "/* v262 neutralizzato: la visibilità è di cdApplyNavVis, le pagine restano nel DOM */"
R29_2_A = "onclick=\"event.stopPropagation(); cdApplEntTog(\\''+en+'\\', this)\">\\u23fb</button>'):'')"
R29_2_R = "onclick=\"event.stopPropagation(); cdApplEntTog(\\''+en+'\\', this)\">'+(((STATES[en]&&STATES[en].state)==='on')?'OFF':'ON')+'</button>'):'')"
R29_3_A = "if(btn){ btn.style.opacity='0.45'; setTimeout(function(){ try { btn.style.opacity=''; var st2=(STATES[en]&&STATES[en].state)||''; btn.classList.toggle('on', st2==='on'); } catch(e2){} }, 900); }"
R29_3_R = "if(btn){ btn.style.opacity='0.45'; setTimeout(function(){ try { btn.style.opacity=''; var st2=(STATES[en]&&STATES[en].state)||''; btn.textContent=(st2==='on')?'OFF':'ON'; btn.classList.toggle('on', st2==='on'); } catch(e2){} }, 900); }"
R29_4_A = "function toggleVentola()"
R29_4_R = "setTimeout(function(){ try { buildTempCards(); } catch(e){} }, 2200); function toggleVentola()"
R29_5_A = " try { if(typeof render==='function') render(); } catch(e2){} editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib'); } catch(e){} } "
R29_5_R = " try { if(typeof render==='function') render(); } catch(e2){} try { buildTempCards(); } catch(e2){} editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib'); } catch(e){} } "

R29B_it_A = "if (tab) tab.style.display = 'none';\n            if (page) page.remove();"
R29B_it_R = "/* remover secondario neutralizzato (cdApplyNavVis comanda) */"
R29B_en_A = "if (tab) tab.style.display = 'none';\n            if (page) page.remove();"
R29B_en_R = "/* remover secondario neutralizzato (cdApplyNavVis comanda) */"

# Round 30: provable build marker, run counters, one-tap nav diagnosis.
R30_1_A = "'0.12.0-int'"
R30_1_R = "'0.12.1-int'"
R30_2_A = "function cdApplyNavVis(){ try {"
R30_2_R = "window.__CD_NVRUN=(window.__CD_NVRUN||0); function cdApplyNavVis(){ try { window.__CD_NVRUN++;"
R30_3_A = "function cdSecBoot(){ try {"
R30_3_R = "function cdSecBoot(){ try { window.__CD_SBRUN=(window.__CD_SBRUN||0)+1;"
R30_4_A = "function editorRenderRileva(){ var st=cdDbgStatus();"
R30_4_R = "function cdNavDiag(){ try { var mp=cdNavVisMap(); var cur=cdCfg('cd_sections')||{}; var L=[]; L.push('ver=0.12.1-int url='+location.pathname.slice(-46)); L.push('inst='+String(window.__DASHBOARDMODERN_STORAGE_NS__||'-').slice(0,12)+' prim='+(window.__DASHBOARDMODERN_PRIMARY__===false?0:1)); L.push('secboot='+(window.__CD_SBRUN||0)+' navvis='+(window.__CD_NVRUN||0)); L.push('cd_sections='+String(localStorage.getItem('cd_sections'))); Object.keys(mp).forEach(function(k){ var sel='.tab[data-tab=\"'+mp[k]+'\"]'; var els=document.querySelectorAll(sel); var pg=document.getElementById('page-'+mp[k]); var st=els.length?getComputedStyle(els[0]).display:'-'; L.push(k+': cfg='+String(cur[k])+' tabs='+els.length+' disp='+st+' page='+(pg?1:0)); }); var rep=L.join('\\n'); try { console.log('[NavDiag]\\n'+rep); } catch(e2){} prompt('Diagnosi navbar (tieni premuto per copiare)', rep); } catch(e){ alert('diag err: '+e.message); } } function editorRenderRileva(){ var st=cdDbgStatus(); st+='<button class=\"ed-btn-add\" style=\"width:100%; margin:6px 0 10px;\" onclick=\"cdNavDiag()\">🧪 Diagnosi navbar</button>';"

R31K_1_A = "var tab=document.getElementById('tab-tapparelle'); if(tab) tab.style.display=list.length?'':'none';"
R31K_1_R = ""
R31K_2_A = "var tab=document.getElementById('tab-tapparelle'); if(tab) tab.style.display=getTapparelle().length?'':'none';"
R31K_2_R = ""
R31K_3_A = "var tab=document.getElementById('tab-irrigazione'); if(tab) tab.style.display=o.zones.length?'':'none';"
R31K_3_R = ""
R31K_4_A = "var tab=document.getElementById('tab-irrigazione'); if(tab) tab.style.display=getIrr().zones.length?'':'none';"
R31K_4_R = ""
R31K_5_A = "var tab=document.getElementById('tab-piscina'); if(tab) tab.style.display=configured?'':'none';"
R31K_5_R = ""
R31K_6_A = "var tab=document.getElementById('tab-piscina'); if(tab){ var o=getPool(); tab.style.display=(o.tempEnt||o.pumpEnt||o.phEnt)?'':'none'; }"
R31K_6_R = ""
R31D_A = "var rep=L.join('\\n');"
R31D_R = "try { var st3=cdSecLS('cd_stanze')||[]; var wt=st3.filter(function(r){ return r&&r.temp; }); L.push('stanze='+st3.length+' con-temp='+wt.length+' CD_TEMP_FLOOR='+String(typeof CD_TEMP_FLOOR!=='undefined'?CD_TEMP_FLOOR:'?')); var g3=document.getElementById('temp-grid'); var errT=''; try { buildTempCards(); } catch(eT){ errT=eT.message; } L.push('temp-grid='+(g3?g3.children.length:'assente')+(errT?' ERR='+errT:'')); } catch(eX){ L.push('temp-diag-err'); } try { var ap3=cdCfgList('cd_appliances'); ap3.forEach(function(a){ if(!a) return; var ents=(a.entities||[]); var hasE=false; ents.forEach(function(en2){ var s4=STATES[en2]||{}; var at=(s4.attributes||{}); if(at.device_class==='energy'||/wh$/i.test(String(at.unit_of_measurement||''))) hasE=true; }); L.push('appl '+(a.name||'?')+': ents='+ents.length+' kwh='+(hasE?1:0)); }); } catch(eY){ L.push('appl-diag-err'); } var rep=L.join('\\n');"

R32_1_A = "function cdRoomOptions(sel){ var rooms = cdRoomsUsed();"
R32_1_R = "function cdRoomOptions(sel){ var rooms = cdRoomList();"
R32_2_A = "function edSaveGeneral(){"
R32_2_R = "function cdLuceAdd(){ try { var e1=document.getElementById('luce-add-ent'); var n1=document.getElementById('luce-add-name'); var ent=(e1&&e1.value||'').trim(); if(ent.indexOf('.')<0){ alert('Inserisci una entità light/switch valida'); return; } var nm=(n1&&n1.value||'').trim()||ent.split('.')[1]; var luci=cdCfg('cd_luci')||{}; luci[ent]=nm; localStorage.setItem('cd_luci', JSON.stringify(luci)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { cdSecShow('home'); } catch(e2){} editorSwitch('luci'); edToast('Luce aggiunta'); } catch(e){} } function edSaveGeneral(){"
R32_3_A = "Nessuna luce configurata."
R32_3_R = '<div style="display:flex; gap:6px; margin:10px 0;"><input id="luce-add-ent" class="ed-input mono" style="flex:1;" placeholder="light.salone o switch.lampada" autocomplete="off"><button type="button" onclick="wzPickEntity(\'#luce-add-ent\')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#38bdf8,#0284c7); cursor:pointer; font-size:15px;">🔍</button></div><input id="luce-add-name" class="ed-input" style="width:100%; margin-bottom:8px;" placeholder="Nome luce (facoltativo)"><button class="ed-btn-add" style="width:100%;" onclick="cdLuceAdd()">+ Aggiungi luce</button>Nessuna luce configurata.'

R33_1_A = "function toggleVentola()"
R33_1_R = "function cdApplBridge(){ try { if(typeof APPLIANCES==='undefined') return; var list=cdCfgList('cd_appliances'); if(!list.length) return; APPLIANCES.length=0; list.forEach(function(a){ if(!a) return; var ents=a.entities||[]; var pw=null, sw=null, en2=null; ents.forEach(function(e){ var d=String(e).split('.')[0]; if(d==='switch'&&!sw) sw=e; else if(/energy|kwh/i.test(e)&&!en2) en2=e; else if(d==='sensor'&&!pw) pw=e; }); APPLIANCES.push({ name:a.name||'?', icon:a.icon||'\\ud83e\\uddfa', category:String(a.room||'altro').toLowerCase(), power:pw, energy:en2, duration:null, switch:sw, history:pw||en2 }); }); try { if(typeof renderApplianceSection==='function') renderApplianceSection(true); } catch(e2){} } catch(e){} } setTimeout(cdApplBridge, 2600); setInterval(cdApplBridge, 15000); function toggleVentola()"
R33_2_A = "grid.innerHTML ="
R33_2_R = "if(!visible.length){ grid.innerHTML='<div style=\"text-align:center; padding:30px; color:var(--text-dim); font-weight:700;\">Nessuna stanza con sensore — aggiungila nel tab Temperatura dell&#39;editor</div>'; return; } grid.innerHTML ="

R34_1_A = "\\U0001f5d1\\ufe0f</button>"
R34_1_R = "🗑️</button>"
R34_2_A = "if (_hasFloors) {"
R34_2_R = "if (_rooms.length) {"
R34_3_A = "const f = r.floor || 'Altro';"
R34_3_R = "const f = r.floor || r.name || 'Altro';"
R34_4_A = "(r.floor || 'Altro') === CD_TEMP_FLOOR"
R34_4_R = "(r.floor || r.name || 'Altro') === CD_TEMP_FLOOR"
R34_5_A = " try { if(typeof renderApplianceSection==='function') renderApplianceSection(true); } catch(e2){}"
R34_5_R = " try { var pg=document.getElementById('page-appliances-main'); var bar=pg&&pg.querySelector('.sub-tabs-energy'); if(bar){ var cats=[]; APPLIANCES.forEach(function(a){ if(a.category&&cats.indexOf(a.category)<0) cats.push(a.category); }); var bh='<button class=\"sub-tab-btn appl-section-tab active\" onclick=\"switchApplianceView(\\'overview\\', event)\">📊 Panoramica</button>'; cats.forEach(function(c){ var lb=c.charAt(0).toUpperCase()+c.slice(1); bh+='<button class=\"sub-tab-btn appl-section-tab\" onclick=\"switchApplianceView(\\''+c+'\\', event)\">🏠 '+lb+'</button>'; }); bar.innerHTML=bh; } if(pg){ pg.querySelectorAll('button').forEach(function(b){ var t=(b.textContent||''); if(t.indexOf('CONFIGURA')>=0||t.indexOf('Configura')>=0){ var card=b.closest('div'); if(card&&card.parentElement) card.parentElement.style.display='none'; } }); } } catch(e3){} try { if(typeof renderApplianceSection==='function') renderApplianceSection(true); } catch(e2){}"

R35_1_A = "(r.floor || 'Altro') === f)"
R35_1_R = "(r.floor || r.name || 'Altro') === f)"
R35_2_A = "'0.12.1-int'"
R35_2_R = "'0.12.3-int'"

R36_A = "function cdApplEntity"
R36_R = "function cdApplEntity(a, keys){ var v=cdApplEntityOrig(a, keys); if(v) return v; try { var ents=(a&&a.entities||[]).map(function(e){ return typeof e==='string'?e:e.entity; }).filter(Boolean); var k=String(keys&&keys[0]||''); function dom(d){ for(var i=0;i<ents.length;i++){ if(ents[i].indexOf(d+'.')===0) return ents[i]; } return null; } if(k.indexOf('switch')===0) return dom('switch')||dom('light')||dom('input_boolean'); if(k.indexOf('energy')===0){ for(var j=0;j<ents.length;j++){ if(/energy|kwh/i.test(ents[j])) return ents[j]; } return null; } if(k.indexOf('power')===0||k.indexOf('history')===0||k.indexOf('duration')===0&&false) return dom('sensor'); } catch(e){} return null; } function cdApplEntityOrig"

# Ordered list of (label, anchor, replacement) applied by vendor_legacy.py.
FEATURE_PATCHES: tuple[tuple[str, str, str], ...] = (
    ("report-appl-helper", REP_HELPER_ANCHOR, REP_HELPER_REPLACEMENT),
    ("report-appl-concat", REP_CONCAT_ANCHOR, REP_CONCAT_REPLACEMENT),
    ("report-appl-rerun", REP_RERUN_ANCHOR, REP_RERUN_REPLACEMENT),
    ("appl-room-form", APPL_ROOM_FORM_ANCHOR, APPL_ROOM_FORM_REPLACEMENT),
    ("appl-room-save", APPL_ROOM_SAVE_ANCHOR, APPL_ROOM_SAVE_REPLACEMENT),
    (
        "luci-rooms-registry",
        LUCI_ROOMS_REGISTRY_ANCHOR,
        LUCI_ROOMS_REGISTRY_REPLACEMENT,
    ),
    ("luci-floor-head", LUCI_FLOOR_HEAD_ANCHOR, LUCI_FLOOR_HEAD_REPLACEMENT),
    ("luci-floor-zona", LUCI_FLOOR_ZONA_ANCHOR, LUCI_FLOOR_ZONA_REPLACEMENT),
    ("appl-group-head", APPL_GROUP_HEAD_ANCHOR, APPL_GROUP_HEAD_REPLACEMENT),
    ("appl-group-tail", APPL_GROUP_TAIL_ANCHOR, APPL_GROUP_TAIL_REPLACEMENT),
    ("group-helper", GROUP_HELPER_ANCHOR, GROUP_HELPER_REPLACEMENT),
    ("clima-group-freddo", CLIMA_GROUP_F_ANCHOR, CLIMA_GROUP_F_REPLACEMENT),
    ("clima-group-caldo", CLIMA_GROUP_C_ANCHOR, CLIMA_GROUP_C_REPLACEMENT),
    ("temp-card-cp-it?", TEMPCARD_1_A, TEMPCARD_1_R),
    ("temp-card-cp-en?", TEMPCARD_2_A, TEMPCARD_2_R),
    ("picker-element-ref", EPCHOOSE_ANCHOR, EPCHOOSE_REPLACEMENT),
    ("lens-slot-1?", SLOT_1_A, SLOT_1_R),
    ("lens-slot-2?", SLOT_2_A, SLOT_2_R),
    ("lens-ed-ov-old-it?", LENS_1_A, LENS_1_R),
    ("lens-ed-ov-new-it?", LENS_2_A, LENS_2_R),
    ("lens-ed-load-pwr-it?", LENS_3_A, LENS_3_R),
    ("lens-ed-st-temp-it?", LENS_4_A, LENS_4_R),
    ("lens-ed-st-hum-it?", LENS_5_A, LENS_5_R),
    ("lens-ed-cl-ent-it?", LENS_6_A, LENS_6_R),
    ("lens-ed-cam-ent-it?", LENS_7_A, LENS_7_R),
    ("lens-ed-ov-old-en?", LENS_8_A, LENS_8_R),
    ("lens-ed-ov-new-en?", LENS_9_A, LENS_9_R),
    ("lens-ed-load-pwr-en?", LENS_10_A, LENS_10_R),
    ("lens-ed-st-temp-en?", LENS_11_A, LENS_11_R),
    ("lens-ed-st-hum-en?", LENS_12_A, LENS_12_R),
    ("lens-ed-cl-ent-en?", LENS_13_A, LENS_13_R),
    ("lens-ed-cam-ent-en?", LENS_14_A, LENS_14_R),
    ("banner-on-connect", BANNER_ON_CONNECT_ANCHOR, BANNER_ON_CONNECT_REPLACEMENT),
    ("wizard-card-it?", WIZ_CARD_IT_ANCHOR, WIZ_CARD_REPLACEMENT),
    ("wizard-card-en?", WIZ_CARD_EN_ANCHOR, WIZ_CARD_REPLACEMENT),
    ("wizard-menu-it?", WIZ_MENU_IT_ANCHOR, WIZ_MENU_REPLACEMENT),
    ("wizard-menu-en?", WIZ_MENU_EN_ANCHOR, WIZ_MENU_REPLACEMENT),
    ("reset-text-it?", RESET_TXT_IT_ANCHOR, RESET_TXT_IT_REPLACEMENT),
    ("reset-text-en?", RESET_TXT_EN_ANCHOR, RESET_TXT_EN_REPLACEMENT),
    ("nav-temp-it?", NAV_TEMP_IT_ANCHOR, NAV_TEMP_IT_REPLACEMENT),
    ("nav-temp-en?", NAV_TEMP_EN_ANCHOR, NAV_TEMP_EN_REPLACEMENT),
    ("temp-rows-editor", TEMP_ROWS_ED_ANCHOR, TEMP_ROWS_ED_REPLACEMENT),
    ("temp-rows-wizard", TEMP_ROWS_WZ_ANCHOR, TEMP_ROWS_WZ_REPLACEMENT),
    ("temp-pencil-editor?", TEMP_PEN_ED_ANCHOR, TEMP_PEN_REPLACEMENT),
    ("temp-pencil-wizard?", TEMP_PEN_WZ_ANCHOR, TEMP_PEN_REPLACEMENT),
    ("temp-add-merges", TEMP_MERGE_ANCHOR, TEMP_MERGE_REPLACEMENT),
    ("sync-key-hosted?", SYNC_KEY_ANCHOR, SYNC_KEY_REPLACEMENT),
    ("temp-del-editor?", TEMP_DEL_ED_ANCHOR, TEMP_DEL_REPLACEMENT),
    ("temp-del-wizard?", TEMP_DEL_WZ_ANCHOR, TEMP_DEL_REPLACEMENT),
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
    ("tapp-css", TAPP_1_A, TAPP_1_R),
    ("tapp-page", TAPP_2_A, TAPP_2_R),
    ("tapp-js", TAPP_3_A, TAPP_3_R),
    ("tapp-nav-switch", TAPP_4_A, TAPP_4_R),
    ("tapp-nav-it?", TAPP_5_A, TAPP_5_R),
    ("tapp-nav-en?", TAPP_6_A, TAPP_6_R),
    ("tapp-ed-tab", TAPP_7_A, TAPP_7_R),
    ("tapp-ed-switch", TAPP_8_A, TAPP_8_R),
    ("tapp-ed-render", TAPP_9_A, TAPP_9_R),
    ("tapp-sync-key?", TAPP_10_A, TAPP_10_R),
    ("irr-css", IRR_1_A, IRR_1_R),
    ("irr-page", IRR_2_A, IRR_2_R),
    ("irr-js", IRR_3_A, IRR_3_R),
    ("irr-nav-switch", IRR_4_A, IRR_4_R),
    ("irr-nav-tab", IRR_5_A, IRR_5_R),
    ("irr-ed-tab", IRR_6_A, IRR_6_R),
    ("irr-ed-switch", IRR_7_A, IRR_7_R),
    ("irr-ed-render", IRR_8_A, IRR_8_R),
    ("irr-sync-key?", IRR_9_A, IRR_9_R),
    ("pool-css", POOL_1_A, POOL_1_R),
    ("pool-page", POOL_2_A, POOL_2_R),
    ("pool-js", POOL_3_A, POOL_3_R),
    ("pool-nav-switch", POOL_4_A, POOL_4_R),
    ("pool-nav-tab", POOL_5_A, POOL_5_R),
    ("pool-ed-tab", POOL_6_A, POOL_6_R),
    ("pool-ed-switch", POOL_7_A, POOL_7_R),
    ("pool-ed-render", POOL_8_A, POOL_8_R),
    ("pool-sync-key?", POOL_9_A, POOL_9_R),
    ("evcars-js", EVCARS_1_A, EVCARS_1_R),
    ("evcars-picker", EVCARS_2_A, EVCARS_2_R),
    ("evcars-ed-fns", EVCARS_3_A, EVCARS_3_R),
    ("evcars-ed-hook", EVCARS_4_A, EVCARS_4_R),
    ("evcars-sync?", EVCARS_5_A, EVCARS_5_R),
    ("enviews-js", ENVIEW_1_A, ENVIEW_1_R),
    ("enviews-ed-fns", ENVIEW_2_A, ENVIEW_2_R),
    ("enviews-ed-hook", ENVIEW_3_A, ENVIEW_3_R),
    ("enviews-sync?", ENVIEW_4_A, ENVIEW_4_R),
    ("sync-loop-guard-it?", R17_1_A, R17_1_R),
    ("sync-loop-guard-en?", R17_2_A, R17_2_R),
    ("update-check-hosted", R17_3_A, R17_3_R),
    ("version-bump", R17_4_A, R17_4_R),
    ("version-bump-txt?", R17_5_A, R17_5_R),
    ("rm-tab-sezioni-it?", R17_6_A, R17_6_R),
    ("rm-tab-sezioni-en?", R17_7_A, R17_7_R),
    ("sez-tabs", R17_8_A, R17_8_R),
    ("sez-switch", R17_9_A, R17_9_R),
    ("sez-filter-fns", R17_10_A, R17_10_R),
    ("vistoggle-current?", R17_11_A, R17_11_R),
    ("visib-restructure", R17_12_A, R17_12_R),
    ("tapp-cmd-all", R17_13_A, R17_13_R),
    ("tapp-all-buttons", R17_14_A, R17_14_R),
    ("tapp-avvisi", R17_15_A, R17_15_R),
    ("fix-visib-tab-onclick", R18_1_A, R18_1_R),
    ("update-check-path-guard", R18_2_A, R18_2_R),
    ("evcars-capture-live", R18_3_A, R18_3_R),
    ("evcars-add-updates", R18_4_A, R18_4_R),
    ("evcars-tab-dropdown", R18_5_A, R18_5_R),
    ("evcars-seled-fn", R18_6_A, R18_6_R),
    ("filter-extras", R18_7_A, R18_7_R),
    ("filter-body-extras", R18_8_A, R18_8_R),
    ("load-hide-cost", R18_9_A, R18_9_R),
    ("appl-save-btn", R19_1_A, R19_1_R),
    ("avvisi-tapp-option?", R19_2_A, R19_2_R),
    ("avvisi-tapp-handler", R19_3_A, R19_3_R),
    ("cams-in-security", R19_4_A, R19_4_R),
    ("rm-cams-tab?", R19_5_A, R19_5_R),
    ("nav-order-js", R19_6_A, R19_6_R),
    ("nav-order-ed-fns", R19_7_A, R19_7_R),
    ("nav-order-hook", R19_8_A, R19_8_R),
    ("nav-order-sync?", R19_9_A, R19_9_R),
    ("sync-key-multi?", SYNC_KEY_MULTI_A, SYNC_KEY_MULTI_R),
    ("sec-show-engine", R21_1_A, R21_1_R),
    ("reg-enrich-js", R21_4_A, R21_4_R),
    ("rileva-enrich-hook", R21_5_A, R21_5_R),
    ("sec-show-on-slot-it?", R21S_it_A, R21S_it_R),
    ("sec-show-on-clima-it?", R21C_it_A, R21C_it_R),
    ("sec-show-on-slot-en?", R21S_en_A, R21S_en_R),
    ("sec-show-on-clima-en?", R21C_en_A, R21C_en_R),
    ("nav-vis-engine", R22_1_A, R22_1_R),
    ("nav-vis-on-toggle", R22_2_A, R22_2_R),
    ("nav-vis-on-show", R22_3_A, R22_3_R),
    ("status-instance", R22_4_A, R22_4_R),
    ("reset-keep-query?", RESET_KEEP_QUERY_A, RESET_KEEP_QUERY_R),
    ("secboot-v2", SECBOOT_A, SECBOOT_R),
    ("navvis-v3", R25_1_A, R25_1_R),
    ("secboot-v3", R25_2_A, R25_2_R),
    ("edsectog-v3", R25_3_A, R25_3_R),
    ("toggle-appliances", R25_4_A, R25_4_R),
    ("toggle-tapp", R25_5_A, R25_5_R),
    ("toggle-irr", R25_6_A, R25_6_R),
    ("toggle-pool", R25_7_A, R25_7_R),
    ("secboot-migrate-keys", SECMIG_A, SECMIG_R),
    ("temp-rooms-filter", R26_1_A, R26_1_R),
    ("appl-ent-toggle-fn", R26_2_A, R26_2_R),
    ("appl-ent-toggle-row", R26_3_A, R26_3_R),
    ("luci-ren-del-fns", R26_4_A, R26_4_R),
    ("luci-ren-del-row", R26_5_A, R26_5_R),
    ("appl-tab-render", R27_3_A, R27_3_R),
    ("rooms-used", R27_4_A, R27_4_R),
    ("lens-everywhere", R27_5_A, R27_5_R),
    ("appl-edit-feedback", R27_7_A, R27_7_R),
    ("appl-del-confirm", R27_8_A, R27_8_R),
    ("appl-off-home-it?", R27H_it_A, R27H_it_R),
    ("appl-off-home-en?", R27H_en_A, R27H_en_R),
    ("report-refresh-on-save-it?", R27RPT_it_A, R27RPT_it_R),
    ("report-refresh-on-save-en?", R27RPT_en_A, R27RPT_en_R),
    ("navvis-hardened", R28NV_A, R28NV_R),
    ("kill-section-remover", R29_1_A, R29_1_R),
    ("toggle-text-onoff", R29_2_A, R29_2_R),
    ("toggle-text-feedback", R29_3_A, R29_3_R),
    ("temp-render-hooks", R29_4_A, R29_4_R),
    ("temp-render-on-show", R29_5_A, R29_5_R),
    ("kill-section-remover-2-it?", R29B_it_A, R29B_it_R),
    ("kill-section-remover-2-en?", R29B_en_A, R29B_en_R),
    ("ver-0121", R30_1_A, R30_1_R),
    ("nav-counters", R30_2_A, R30_2_R),
    ("boot-counter", R30_3_A, R30_3_R),
    ("nav-diag-fn", R30_4_A, R30_4_R),
    ("kill-tab-writer-1?", R31K_1_A, R31K_1_R),
    ("kill-tab-writer-2?", R31K_2_A, R31K_2_R),
    ("kill-tab-writer-3?", R31K_3_A, R31K_3_R),
    ("kill-tab-writer-4?", R31K_4_A, R31K_4_R),
    ("kill-tab-writer-5?", R31K_5_A, R31K_5_R),
    ("kill-tab-writer-6?", R31K_6_A, R31K_6_R),
    ("diag-temp-report", R31D_A, R31D_R),
    ("rooms-full-list", R32_1_A, R32_1_R),
    ("luci-add-fn", R32_2_A, R32_2_R),
    ("luci-add-form?", R32_3_A, R32_3_R),
    ("appl-bridge", R33_1_A, R33_1_R),
    ("temp-empty-hint?", R33_2_A, R33_2_R),
    ("luci-trash-glyph", R34_1_A, R34_1_R),
    ("temp-tabs-gate", R34_2_A, R34_2_R),
    ("temp-tabs-fallback", R34_3_A, R34_3_R),
    ("temp-filter-fallback", R34_4_A, R34_4_R),
    ("appl-bridge-v2", R34_5_A, R34_5_R),
    ("temp-avg-fallback?", R35_1_A, R35_1_R),
    ("ver-0122?", R35_2_A, R35_2_R),
    ("appl-entity-fallback", R36_A, R36_R),
)
