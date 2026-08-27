/* Extracted from dashboard-en.html; feature changes belong in src/sections. */
/* ═══════════════════════════════════════════════════════════════════
   v255: CONFIGURATION PERMANENTE (baked nel file) + override locale
   Le personalizzazioni fatte dall'editor vengono "cotte" qui dentro al
   momento del download HTML → valgono su TUTTI i dispositivi.
   localStorage (se presente) ha priorità, così puoi ancora testare in locale.
   ─────────────────────────────────────────────────────────────────── */
/* ═══ v258: VERSIONE — visibile in console, wizard e pagina Config ═══ */
const DASHBOARD_VERSION = '0.14.0';
globalThis.DASHBOARD_VERSION = DASHBOARD_VERSION;
console.log('%c🏠 Dashboard Modern v' + DASHBOARD_VERSION, 'font-size:14px; font-weight:bold; color:#0ea5e9;');

/* CD_BAKED_START */
window.CD_BAKED_CONFIG = {
  cd_connection: {},
  cd_branding: {},
  cd_sections: {},
  cd_section_names: {},
  cd_luci: {},
  cd_stanze: [],
  cd_cameras: [],
  cd_appliances: [],
  cd_clima_units: [],
  cd_devices: [],
  cd_quick_actions: null,
  cd_ev_image: "",
  cd_entity_overrides: {},
  cd_subloads_extra: {},
  cd_gruppi_extra: {},
  cd_gruppi_removed: {},
  cd_avvisi_names_extra: {},
  cd_avvisi_custom: [],
  cd_text_overrides: {},
  cd_hidden_elements: {}
};
/* CD_BAKED_END */
/* Helper: legge la config preferendo localStorage, poi il baked del file */
let _dmNoBaked = false;
try { _dmNoBaked = !!localStorage.getItem('dm_fresh_start'); } catch(e) {}
function cdCfg(key) {
  try { const ls = localStorage.getItem(key); if (ls) return JSON.parse(ls); } catch(e) {}
  if (_dmNoBaked) return {};
  try {
    const B = window.CD_BAKED_CONFIG;
    if (B) {
      if (B[key] !== undefined) return B[key];
      // v0.10.9: supporta anche config con chiavi brevi (luci, branding, sezioni…) senza prefisso cd_
      const shortKey = key.replace(/^cd_/, '');
      if (B[shortKey] !== undefined) return B[shortKey];
    }
  } catch(e) {}
  return {};
}
/* v294 (issue #4): per le chiavi-lista cdCfg può restituire {} (default) — questo
   helper garantisce sempre un array, evitando .map/.forEach su oggetti. */
function cdCfgList(key) {
  const v = cdCfg(key);
  return Array.isArray(v) ? v : [];
}

/* v0.9.8: Searchable ICON PICKER (for custom alerts and other sections) */
const DM_ICONS = [
  {e:'⚠️',k:'warning avviso attenzione allarme alert generico'},
  {e:'🔔',k:'campana notifica avviso bell'},
  {e:'🚨',k:'allarme sirena emergenza alarm'},
  {e:'💧',k:'acqua perdita allagamento water leak umidita goccia'},
  {e:'🌊',k:'acqua allagamento flood onda'},
  {e:'🔥',k:'fuoco incendio caldo fire heat fiamma'},
  {e:'🌡️',k:'temperatura termometro temperature clima'},
  {e:'❄️',k:'freddo gelo neve cold snow condizionatore'},
  {e:'💨',k:'vento gas fumo aria wind soffio'},
  {e:'🚪',k:'porta apertura door ingresso'},
  {e:'🪟',k:'finestra window'},
  {e:'🔋',k:'batteria battery carica'},
  {e:'🔌',k:'presa spina corrente plug power energia'},
  {e:'💡',k:'luce lampadina light illuminazione'},
  {e:'🏃',k:'movimento presenza motion presence corsa'},
  {e:'👤',k:'presenza persona presence person'},
  {e:'🚶',k:'movimento persona motion walk'},
  {e:'🌫️',k:'fumo nebbia smoke fog gas'},
  {e:'🛡️',k:'sicurezza antifurto allarme security shield scudo'},
  {e:'🔒',k:'serratura chiuso lock bloccato'},
  {e:'🔓',k:'aperto sblocco unlock'},
  {e:'📹',k:'telecamera camera videocamera tvcc'},
  {e:'🎥',k:'video telecamera camera'},
  {e:'🔊',k:'audio suono volume sound alto'},
  {e:'🔇',k:'muto silenzio mute'},
  {e:'🏠',k:'casa home abitazione'},
  {e:'🚗',k:'auto macchina car veicolo'},
  {e:'🌙',k:'notte luna night'},
  {e:'☀️',k:'sole giorno sun day'},
  {e:'⚡',k:'energia corrente potenza power fulmine'},
  {e:'🔆',k:'luminosita brightness luce'},
  {e:'📶',k:'segnale wifi rete signal network'},
  {e:'📡',k:'antenna segnale signal'},
  {e:'🌧️',k:'pioggia rain meteo'},
  {e:'🧊',k:'ghiaccio congelatore freezer ice frigo'},
  {e:'♨️',k:'caldaia boiler vapore heat termosifone'},
  {e:'🚿',k:'doccia acqua shower bagno'},
  {e:'🛁',k:'vasca bagno bath'},
  {e:'🍳',k:'cucina fornello kitchen stove'},
  {e:'🧺',k:'lavanderia bucato laundry cesto'},
  {e:'🧯',k:'estintore fire extinguisher sicurezza'},
  {e:'⏰',k:'sveglia allarme timer alarm orologio'},
  {e:'✅',k:'ok attivo verde active check'},
  {e:'❌',k:'errore no rosso error croce'},
  {e:'❗',k:'importante attenzione exclamation'},
  {e:'🟢',k:'verde acceso attivo green'},
  {e:'🔴',k:'rosso spento allarme red'},
  {e:'🟡',k:'giallo attenzione yellow'},
  {e:'🐶',k:'cane animale dog pet'},
  {e:'🐱',k:'gatto animale cat pet'},
  {e:'🌱',k:'pianta giardino irrigazione plant garden'},
  {e:'💦',k:'acqua irrigazione water spruzzi'},
  {e:'🌬️',k:'ventilatore aria fan air'},
  {e:'📬',k:'posta cassetta mailbox lettera'},
  {e:'🔦',k:'torcia luce flashlight'},
  {e:'📈',k:'grafico consumo salita graph up'},
  {e:'📉',k:'grafico discesa graph down'},
  {e:'🅿️',k:'parcheggio garage parking'},
  {e:'🚰',k:'acqua rubinetto water tap'},
  {e:'🔧',k:'manutenzione chiave tool riparazione'}
];
const DM_ROOM_ICONS = [
  {e:'🛏️',k:'letto camera bedroom bed'}, {e:'🛋️',k:'soggiorno salone living sofa'},
  {e:'🍳',k:'cucina kitchen'}, {e:'🛁',k:'bagno bathroom shower'},
  {e:'🍽️',k:'sala pranzo dining room'}, {e:'🧸',k:'cameretta bambini kids nursery'},
  {e:'💻',k:'ufficio studio office'}, {e:'🚗',k:'garage auto car parking'},
  {e:'🌇',k:'terrazza balcone terrace balcony'}, {e:'🌿',k:'giardino garden yard'},
  {e:'🚪',k:'corridoio ingresso hallway entrance'}, {e:'🧺',k:'lavanderia laundry'},
  {e:'📦',k:'ripostiglio deposito storage closet'}, {e:'🏠',k:'mansarda attico casa attic roof'},
  {e:'🍷',k:'cantina cellar basement'}, {e:'🏋️',k:'palestra gym'},
  {e:'🎬',k:'cinema theater'}, {e:'🛠️',k:'locale tecnico tools utility'},
  {e:'🏊',k:'piscina pool acqua water'}
];
function dmIconPicker(targetSel, category) {
    const ov = document.createElement('div');
    ov.id = 'dm-iconpick';
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:100001; display:flex; align-items:center; justify-content:center; padding:16px;';
    ov.innerHTML = `<div style="background:var(--card-bg,#fff); border-radius:22px; padding:18px; width:min(420px,100%); max-height:78vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.35);">
        <div style="font-weight:900; font-size:14.5px; margin-bottom:8px; color:var(--text,#0f172a);">😀 Pick the icon</div>
        <input id="dm-icon-search" class="ed-input" style="margin-bottom:8px;" placeholder="🔍 Search (e.g. water, door, fire)…" oninput="dmIconFilter(this.value)">
        <div id="dm-icon-grid" style="overflow-y:auto; flex:1; display:grid; grid-template-columns:repeat(auto-fill,minmax(46px,1fr)); gap:6px;"></div>
        <button type="button" data-icon-picker-close aria-label="Close icon picker" style="margin-top:10px; padding:11px; border:none; border-radius:12px; background:#94a3b8; color:#fff; font-weight:800; cursor:pointer;" onclick="document.getElementById('dm-iconpick').remove()">Close</button>
      </div>`;
    document.body.appendChild(ov);
    window._dmIconTarget = targetSel;
    window._dmIconDataset = category === 'rooms' ? DM_ROOM_ICONS : DM_ICONS;
    dmIconFilter('');
    setTimeout(() => document.getElementById('dm-icon-search')?.focus(), 60);
}
function dmIconFilter(q) {
    q = (q || '').trim().toLowerCase();
    const grid = document.getElementById('dm-icon-grid');
    if (!grid) return;
    const dataset = window._dmIconDataset || DM_ICONS;
    const rows = q ? dataset.filter(x => x.k.includes(q) || x.e === q) : dataset;
    grid.innerHTML = rows.map(x => `<button type="button" onclick="dmIconChoose('${x.e}')" style="font-size:24px; padding:8px 0; border:1px solid var(--card-border,#e2e8f0); border-radius:12px; background:rgba(148,163,184,0.08); cursor:pointer;">${x.e}</button>`).join('') || '<div style="grid-column:1/-1; text-align:center; padding:16px; color:var(--text-dim); font-weight:700;">No icon</div>';
}
function dmIconChoose(e) {
    const sel = window._dmIconTarget;
    const ov = document.getElementById('dm-iconpick');
    if (ov) ov.remove();
    if (sel && sel.startsWith('#')) { const el = document.getElementById(sel.slice(1)); if (el) el.value = e; }
}

/* v0.9.7 (#6): brand logo (inline SVG, no external assets) for wizard and config */
/* v0.10.9: setter di testo null-safe. L'auto-hide RIMUOVE fisicamente pagine/sezioni non
   configurate dal DOM; senza questo, render() andava in TypeError su elementi assenti. */
function setTxt(id, v) { try { const e = document.getElementById(id); if (e) e.textContent = v; } catch(_) {} }
function setHtml(id, v) { try { const e = document.getElementById(id); if (e) e.innerHTML = v; } catch(_) {} }
/* ═══════════════ v0.11.0: APPLIANCES (generic section) ═══════════════
   Multiple configurable appliances, 1+ entities each, status derived from
   power draw (Watts) → works with NON-wifi appliances via a smart plug.
   Built-in standard icons/images (inline SVG, dashboard style). */
const DM_APPLIANCES = [
  {t:'lavatrice',n:'Washing machine'},{t:'lavastoviglie',n:'Dishwasher'},{t:'asciugatrice',n:'Dryer'},
  {t:'forno',n:'Oven'},{t:'microonde',n:'Microwave'},{t:'frigo',n:'Fridge'},{t:'congelatore',n:'Freezer'},
  {t:'piano_cottura',n:'Cooktop'},{t:'cappa',n:'Range hood'},{t:'ferro',n:'Iron'},
  {t:'aspirapolvere',n:'Vacuum'},{t:'robot',n:'Robot vacuum'},{t:'condizionatore',n:'Air conditioner'},
  {t:'ventilatore',n:'Fan'},{t:'scaldabagno',n:'Water heater'},{t:'tv',n:'TV'},
  {t:'caffe',n:'Coffee machine'},{t:'tostapane',n:'Toaster'},{t:'bollitore',n:'Kettle'},{t:'generico',n:'Other'}
];
function cdApplianceIcon(type, size) {
  size = size || 42;
  const A = 'width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    lavatrice:'<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><circle cx="12" cy="14" r="4.3"/><circle cx="12" cy="14" r="1.5"/><circle cx="6.8" cy="5.4" r="0.5" fill="currentColor"/><circle cx="9.2" cy="5.4" r="0.5" fill="currentColor"/>',
    lavastoviglie:'<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="15.5" x2="17" y2="15.5"/><line x1="7" y1="19" x2="17" y2="19"/>',
    asciugatrice:'<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><circle cx="12" cy="14" r="4.3"/><path d="M10 12.6c1-1 3-1 4 0M10 15.4c1 1 3 1 4 0"/><circle cx="6.8" cy="5.4" r="0.5" fill="currentColor"/>',
    forno:'<rect x="3.5" y="3" width="17" height="18" rx="2"/><line x1="3.5" y1="8.5" x2="20.5" y2="8.5"/><rect x="6" y="11" width="12" height="8" rx="1"/><line x1="6.5" y1="5.7" x2="9" y2="5.7"/>',
    microonde:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><rect x="4.5" y="7" width="10" height="10" rx="1"/><circle cx="17.7" cy="9" r="0.6" fill="currentColor"/><line x1="17" y1="12" x2="19" y2="12"/><line x1="17" y1="14" x2="19" y2="14"/>',
    frigo:'<rect x="5" y="2.5" width="14" height="19" rx="2"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="8" y1="5" x2="8" y2="7.5"/><line x1="8" y1="12.5" x2="8" y2="16"/>',
    congelatore:'<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M12 6v9M8.5 8l7 5M15.5 8l-7 5"/>',
    piano_cottura:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="2.1"/><circle cx="15.5" cy="9.5" r="2.1"/><circle cx="8.5" cy="15.5" r="2.1"/><circle cx="15.5" cy="15.5" r="2.1"/>',
    cappa:'<path d="M3 8l3-3h12l3 3v2H3z"/><path d="M6 10v3a6 6 0 0 0 12 0v-3"/>',
    ferro:'<path d="M3 15c0-4 4-7 9-7h8l-2 5H4z"/><line x1="6" y1="18" x2="16" y2="18"/>',
    aspirapolvere:'<circle cx="9" cy="15" r="5.3"/><circle cx="9" cy="15" r="1.5"/><path d="M13.5 12l5-6 2 1.5"/>',
    robot:'<circle cx="12" cy="13" r="8"/><circle cx="12" cy="13" r="2"/><path d="M12 5V3M6.5 8l3 2"/>',
    condizionatore:'<rect x="2.5" y="5.5" width="19" height="8" rx="2"/><line x1="5" y1="11" x2="19" y2="11"/><path d="M6.5 16c0 1.5 1 2.5 2.5 2.5M12 16c0 2 1.2 3 3 3M17.5 16c0 1.5-1 2.5-2.5 2.5"/>',
    ventilatore:'<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4-1-6-3-6s-2 3 0 5M14 12c4 0 6-1 6-3s-3-2-5 0M12 14c0 4 1 6 3 6s2-3 0-5M10 12c-4 0-6 1-6 3s3 2 5 0"/>',
    scaldabagno:'<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 13c1.5-1.5 1.5-3 0-4.5C10.5 10 10.5 11.5 12 13z"/><circle cx="12" cy="17" r="1.2"/>',
    tv:'<rect x="2.5" y="4" width="19" height="12" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/>',
    caffe:'<path d="M6 8h11v4a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2"/><line x1="9" y1="3.5" x2="9" y2="5.5"/><line x1="13" y1="3.5" x2="13" y2="5.5"/>',
    tostapane:'<rect x="3.5" y="9" width="17" height="9" rx="3"/><path d="M8 9V7M12 9V6.5M16 9V7"/><line x1="17" y1="13" x2="17" y2="15"/>',
    bollitore:'<path d="M6 10h9l1.3 9H4.7z"/><path d="M15 11l4-2v3"/><path d="M9 7c0-1.5 3-1.5 3 0"/>',
    generico:'<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="12" cy="13" r="4"/><line x1="7" y1="6.5" x2="10" y2="6.5"/>'
  };
  return '<svg '+A+'>'+(I[type]||I.generico)+'</svg>';
}
function cdApplianceName(type){ const x=DM_APPLIANCES.find(a=>a.t===type); return x?x.n:'Appliance'; }
function cdApplianceDisplayName(a){ const api=window.DashboardModernModules&&DashboardModernModules.data; return api&&api.applianceName?api.applianceName(a,STATES,'Appliance'):(String(a&&a.name||'').trim()||'Appliance'); }
function cdIconMarkup(icon,size){ icon=String(icon||''); size=size||30; if(icon.indexOf('mdi:')===0) return '<ha-icon icon="'+icon.replace(/"/g,'&quot;')+'" style="--mdc-icon-size:'+size+'px;width:'+size+'px;height:'+size+'px"></ha-icon>'; return icon; }
function cdApplianceType(a){
  const raw=String((a&&(a.device_type||a.type||a.icon))||'generico').toLowerCase();
  const aliases={frigorifero:'frigo',caffettiera:'caffe',televisore:'tv'};
  const type=aliases[raw]||raw;
  return DM_APPLIANCES.some(x=>x.t===type)?type:'generico';
}
function cdApplianceImageFallback(img,type,size){
  if(img&&img.parentElement) img.outerHTML=cdApplianceIcon(type||'generico',size||96);
}
function cdApplianceVisual(a,size){
  const api=window.DashboardModernModules&&DashboardModernModules.data;
  const media=api&&api.applianceMedia?api.applianceMedia(a):{kind:'fallback',value:cdApplianceType(a)};
  const type=cdApplianceType(a);
  if(media.kind==='image') {
    const src=String(media.value).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    return '<img src="'+src+'" alt="'+String(a&&a.name||'Appliance').replace(/"/g,'&quot;')+'" style="display:block;width:'+size+'px;height:'+size+'px;max-width:100%;object-fit:contain" onerror="cdApplianceImageFallback(this,\''+type+'\','+size+')">';
  }
  const integrated=String(media.value||type);
  return integrated.indexOf('mdi:')===0?cdIconMarkup(integrated,size):cdApplianceIcon(integrated,size);
}
function cdEnsureSectionVisible(section){ var aliases={cameras:'security',lights:'home'}; var key=aliases[section]||section; var cfg=cdCfg('cd_sections')||{}; if(cfg[key]===false){ cfg[key]=true; localStorage.setItem('cd_sections',JSON.stringify(cfg)); try{cdMarkDirty();cdSyncPush();}catch(e){} try{cdApplyNavVis();}catch(e){} try{render();}catch(e){} } }
function cdRoomList(){ try { var raw=(typeof getStanze==='function'?getStanze():cdCfg('cd_stanze'))||[]; var api=window.DashboardModernModules&&DashboardModernModules.data; return api?api.normalizeRooms(raw):raw.map(function(r,i){ return Object.assign({},r,{id:String(r.id||r.room_id||('room-'+i))}); }); } catch(e){ return []; } }
function cdRoomsUsed(){ try { var all=cdRoomList(); var used={}; all.forEach(function(r){ if(r&&r.temp&&r.name) used[r.name]=1; }); var lr=cdCfg('cd_luci_rooms')||{}; Object.keys(lr).forEach(function(k){ if(lr[k]) used[lr[k]]=1; }); try { getClimaUnits().forEach(function(u){ if(u&&u.room) used[u.room]=1; }); } catch(e2){} try { cdCfgList('cd_appliances').forEach(function(a){ if(a&&a.room) used[a.room]=1; }); } catch(e2){} try { (cdCfgList('cd_tapparelle')||[]).forEach(function(t){ if(t&&t.room) used[t.room]=1; }); } catch(e2){} var out=all.filter(function(r){ return r&&r.name&&used[r.name]; }); return out.length?out:all; } catch(e){ return cdRoomList(); } } function cdRoomOptions(sel){ var rooms=cdRoomList(); var o='<option value="">— No room —</option>'; rooms.forEach(function(r){ var id=String(r.id||''); var selected=String(sel||'')===id||String(sel||'')===String(r.name||''); o+='<option value="'+id.replace(/"/g,'&quot;')+'"'+(selected?' selected':'')+'>'+String((r.icon&&r.icon.indexOf('mdi:')!==0?r.icon+' ':'')+(r.name||id)).replace(/</g,'&lt;')+'</option>'; }); return o; }
function cdRoomOf(item){ return (item && item.room) ? String(item.room) : ''; }
function cdFloorNames(){ var fl=[]; try{ fl=JSON.parse(localStorage.getItem('cd_floors'))||[]; }catch(e){} var seen={}; var outv=[]; fl.forEach(function(f){ f=String(f); if(f&&!seen[f]){ seen[f]=1; outv.push(f); } }); cdRoomList().forEach(function(r){ if(r&&r.floor){ var f=String(r.floor); if(!seen[f]){ seen[f]=1; outv.push(f); } } }); return outv; }
function cdFloorSelOptions(cur){ var o='<option value="">— Nessun piano —</option>'; cdFloorNames().forEach(function(f){ o+='<option value="'+f+'"'+(cur===f?' selected':'')+'>🏢 '+f+'</option>'; }); return o; }
function cdFloorRowsHtml(){ var names=cdFloorNames(); var rows = names.length ? names.map(function(f,i){ return '<div class="ed-row" style="align-items:center;"><div class="ed-row-main"><div class="ed-row-new">🏢 '+f+'</div></div><div class="ed-del" onclick="edFloorDel('+i+')">🗑️</div></div>'; }).join('') : '<div class="ed-intro">Nessun piano. Aggiungine uno qui sotto.</div>'; return '<div class="ed-intro" style="margin-top:16px;">Gestisci qui i <b>piani</b>. Ogni piano creato qui compare nel menù a tendina delle stanze.</div>'+rows+'<div style="display:flex;gap:8px;margin:8px 0;"><input id="ed-floor-name" class="ed-input" style="flex:1;" placeholder="Nome piano (es. Piano terra)"><button class="ed-btn-add" style="flex:0 0 auto;" onclick="edFloorAdd()">＋ Aggiungi piano</button></div>'; }
function edFloorAdd(){ var n=(document.getElementById('ed-floor-name').value||'').trim(); if(!n) return; var fl=[]; try{ fl=JSON.parse(localStorage.getItem('cd_floors'))||[]; }catch(e){} if(fl.indexOf(n)<0) fl.push(n); localStorage.setItem('cd_floors', JSON.stringify(fl)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} editorSwitch('stanze'); }
function edFloorDel(i){ var names=cdFloorNames(); var n=names[i]; if(!n) return; var fl=[]; try{ fl=JSON.parse(localStorage.getItem('cd_floors'))||[]; }catch(e){} fl=fl.filter(function(x){ return x!==n; }); localStorage.setItem('cd_floors', JSON.stringify(fl)); var rooms=cdRoomList().slice(); var ch=false; rooms.forEach(function(r){ if(r&&r.floor===n){ delete r.floor; ch=true; } }); if(ch) localStorage.setItem('cd_stanze', JSON.stringify(rooms)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} editorSwitch('stanze'); }
function getAppliances(){ const a=cdCfg('cd_appliances'); return Array.isArray(a)?a:[]; }

/* Stato ricavato dalle entità: numeriche = potenza (W), on/heat/playing = acceso */
function cdApplStatus(a){
  const api=window.DashboardModernModules&&DashboardModernModules.data;
  if(api&&api.applianceState){ const r=api.applianceState(a,STATES); return r.state==='running'?{label:'RUNNING',cls:'run',w:r.watts}:r.state==='standby'?{label:'STANDBY',cls:'standby',w:r.watts}:{label:'OFF',cls:'off',w:r.watts}; }
  return {label:'Off',cls:'off',w:null};
}
function renderAppliances(){
  const grid=document.getElementById('appliances-grid'); const title=document.getElementById('appliances-title');
  if(!grid) return;
  const list=getAppliances();
  if(title) title.style.display=list.length?'':'none';
  const sig=list.map((a,i)=>{const s=cdApplStatus(a);return i+':'+s.cls+':'+(s.w==null?'x':Math.round(s.w));}).join('|');
  if(grid._sig===sig) return; grid._sig=sig;
  grid.innerHTML=cdGroupCards(list.map((a,_ai)=>Object.assign({},a,{_idx:_ai})), (a)=>{
    const i=a._idx;
    const s=cdApplStatus(a);
    const nm=String(typeof cdApplianceDisplayName==='function'?cdApplianceDisplayName(a):(a&&a.name?a.name:cdApplianceName(a.icon))).replace(/</g,'&lt;');
    const pwr=(s.w!=null)?('<span class="appl-pwr">'+Math.round(s.w)+' W</span>'):'';
    return '<div class="appl-card '+(s.cls==='run'?'on':'')+'" onclick="apriApplianceDetail('+i+')">'
      +'<div class="appl-top"><span class="appl-ic">'+cdApplianceVisual(a,30)+'</span>'+pwr+'</div>'
      +'<div class="appl-name">'+nm+'</div>'
      +'<div class="appl-st '+s.cls+'">'+s.label+'</div></div>';
  });
}
function apriApplianceDetail(i){
  if(navigator.vibrate) navigator.vibrate(10);
  const a=getAppliances()[i]; if(!a) return;
  currentPopupType='appliance_view';
  const ents=(a.entities||[]).map(e=>typeof e==='string'?e:e.entity).filter(Boolean);
  const s=cdApplStatus(a);
  document.getElementById('details-title').innerHTML='<span style="display:inline-flex;vertical-align:middle;color:#0ea5e9;">'+cdApplianceVisual(a,22)+'</span> '+String(cdApplianceDisplayName(a)).toUpperCase();
  const list=document.getElementById('details-list');
  const badge='<div style="text-align:center;margin-bottom:14px;"><span class="appl-st '+s.cls+'" style="display:inline-block;padding:7px 16px;font-size:13px;">'+s.label+(s.w!=null?' · '+Math.round(s.w)+' W':'')+'</span></div>';
  const rows=ents.map(en=>{ const st=STATES[en]; const nm=(st&&st.attributes&&st.attributes.friendly_name)||en; const val=st?String(st.state):'—';
    const unit=(st&&st.attributes&&st.attributes.unit_of_measurement)||'';
    return '<div class="detail-row hist-clickable" onclick="apriStorico(event, \''+en+'\', \''+String(nm).replace(/'/g,'&#39;')+'\')"><div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;overflow:hidden;"><div class="d-info" style="min-width:0;flex:1;overflow:hidden;"><div class="d-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;">'+nm+'</div><div class="d-state"><span style="font-family:monospace;font-size:11px;color:var(--text-dim,#64748b);">'+en+'</span></div></div></div><div class="d-val" style="font-weight:800;color:#0ea5e9;">'+val+' '+unit+'</div>'+((/^(switch|light|input_boolean|fan)\./.test(en))?('<button class="ed-ord-btn'+(((STATES[en]&&STATES[en].state)==='on')?' on':'')+'" style="flex:0 0 auto; margin-left:8px; width:44px; height:30px; border:none; border-radius:9px; cursor:pointer; font-size:15px; background:rgba(14,165,233,0.16);" onclick="event.stopPropagation(); cdApplEntTog(\''+en+'\', this)">'+(((STATES[en]&&STATES[en].state)==='on')?'OFF':'ON')+'</button>'):'')+'</div>';
  }).join('') || '<div style="text-align:center;padding:20px;color:var(--text-dim);font-weight:700;">No entity</div>';
  list.innerHTML=badge+rows;
  document.getElementById('details-modal').classList.add('show');
}


function cdApplEntity(a, keys){ var v=cdApplEntityOrig(a, keys); if(v) return v; try { var ents=(a&&a.entities||[]).map(function(e){ return typeof e==='string'?e:e.entity; }).filter(Boolean); var k=String(keys&&keys[0]||''); function dom(d){ for(var i=0;i<ents.length;i++){ if(ents[i].indexOf(d+'.')===0) return ents[i]; } return null; } if(k.indexOf('switch')===0) return dom('switch')||dom('light')||dom('input_boolean'); if(k.indexOf('energy')===0){ for(var j=0;j<ents.length;j++){ if(/energy|kwh/i.test(ents[j])) return ents[j]; } return null; } if(k.indexOf('power')===0||k.indexOf('history')===0||k.indexOf('duration')===0&&false) return dom('sensor'); } catch(e){} return null; } function cdApplEntityOrig(a, keys) {
  for (const k of keys) {
    const v = a && a[k];
    if (typeof v === 'string' && v.includes('.')) return v;
    if (v && typeof v.entity === 'string' && v.entity.includes('.')) return v.entity;
  }
  return null;
}
function cdApplVal(en, fallback) { const st = en && STATES[en]; if (!st) return fallback; const u = (st.attributes && st.attributes.unit_of_measurement) || ''; return String(st.state) + (u ? ' ' + u : ''); }
function cdApplNum(en) { const st = en && STATES[en]; if (!st) return 0; const n = parseFloat(st.state); return isNaN(n) ? 0 : n; }
function cdApplCategory(a) {
  const c = String((a && a.category) || 'other').toLowerCase();
  if (c === 'cucina') return 'kitchen';
  if (c === 'lavanderia') return 'laundry';
  if (c === 'casa') return 'home';
  if (c === 'altro') return 'other';
  return ['kitchen','laundry','home','other'].includes(c) ? c : 'other';
}
function cdApplConfiguredEntities(a) {
  return [].concat(a && a.entities || [], [a && a.power, a && a.power_entity, a && a.energy, a && a.energy_today, a && a.daily_energy, a && a.duration, a && a.duration_entity, a && a.switch, a && a.switch_entity, a && a.history, a && a.history_entity])
    .map(e => typeof e === 'string' ? e : (e && e.entity))
    .filter(Boolean);
}
function cdApplMainCard(a) {
  const st = cdApplStatus(a);
  const p = cdApplEntity(a, ['power_entity','power']);
  const e = cdApplEntity(a, ['daily_energy_entity','energy_today','energy_entity','energy']);
  const d = cdApplEntity(a, ['duration_entity','duration']);
  const h = cdApplEntity(a, ['history_entity','history']) || e || p;
  const api=window.DashboardModernModules&&DashboardModernModules.data;
  const sw=(api&&api.controllableEntity(a))||cdApplEntity(a,['control_entity','switch_entity','switch','light']);
  const rooms=typeof cdRoomList==='function'?cdRoomList():[];
  const room=rooms.find(r=>String(r.id)===String(a.room_id)||String(r.name)===String(a.room));
  const roomValid=room && (!api?.isConfiguredRoom || api.isConfiguredRoom(room));
  const nm=String(typeof cdApplianceDisplayName==='function'?cdApplianceDisplayName(a):(a&&a.name?a.name:cdApplianceName(a.icon))).replace(/</g,'&lt;');
  const metrics=[];
  const powerValue=p?cdApplVal(p,''):(st.w!=null?Math.round(st.w)+' W':'');
  if(powerValue) metrics.push('<div class="appl-primary"><span>⚡ Power</span><strong>'+powerValue+'</strong></div>');
  if(e) metrics.push('<span class="appl-mini">🔋 '+cdApplVal(e,'')+'</span>');
  if(d) metrics.push('<span class="appl-mini">⏱ '+cdApplVal(d,'')+'</span>');
  return `<article class="appl-wide-card dm-control-device ${st.cls==='run'?'on':''}" data-appliance-id="${a.id||''}">
    <div class="appl-visual"><span class="appl-ic">${cdApplianceVisual(a,76)}</span></div>
    <div class="appl-info"><div class="appl-heading"><div><div class="appl-wide-name">${nm}</div>${roomValid?`<div class="appl-wide-cat dm-room-label">🏠 ${String(room.name).replace(/</g,'&lt;')}</div>`:''}</div><span class="appl-st ${st.cls}">● ${st.label}</span></div>
    <div class="appl-live">${metrics.join('')}</div>
    ${h?'<div class="appl-spark" aria-label="Historical data available"><i></i><i></i><i></i><i></i><i></i></div>':''}
    <div class="appl-actions">${sw?`<button class="appl-action-btn ${((STATES[sw]&&STATES[sw].state)==='on')?'on':''}" onclick="event.stopPropagation();cdApplEntTog('${sw}',this)">⏻</button>`:''}${h?`<button class="appl-action-btn" onclick="apriStorico(event,'${h}','${nm.replace(/'/g,'&#39;')}')">📈 History</button>`:`<button class="appl-action-btn" disabled aria-disabled="true">📈 History</button>`}</div></div>
  </article>`;
}
function switchApplianceView(view, ev) {
  if (navigator.vibrate) navigator.vibrate(5);
  document.querySelectorAll('.appl-section-tab').forEach(b => b.classList.remove('active'));
  if (ev && ev.currentTarget) ev.currentTarget.classList.add('active');
  document.querySelectorAll('.appl-main-view').forEach(v => v.classList.remove('active'));
  document.getElementById('appl-view-' + view)?.classList.add('active');
  renderApplianceSection(true);
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function renderApplianceSection(force) {
  const host = document.getElementById('appl-kpi-grid');
  if (!host) return;
  const list = getAppliances();
  const dataApi=window.DashboardModernModules&&DashboardModernModules.data;
  const grouped=dataApi?dataApi.applianceGroups(list,cdRoomList()):{groups:[],unassigned:list,all:list};
  if(window._dmApplRoom===undefined) window._dmApplRoom='all';
  const tabBar=document.querySelector('#page-appliances-main .sub-tabs-energy');
  if(tabBar){ const tabs=[['all','📊 Overview']].concat(grouped.groups.map(g=>[g.room.id,(g.room.icon||'🏠')+' '+g.room.name])); if(grouped.unassigned.length) tabs.push(['unassigned','❓ No room']); tabBar.innerHTML=tabs.map(t=>'<button class="sub-tab-btn appl-section-tab'+(window._dmApplRoom===t[0]?' active':'')+'" onclick="window._dmApplRoom=\''+t[0]+'\';renderApplianceSection(true)">'+t[1]+'</button>').join(''); }
  const roomList=window._dmApplRoom==='all'?list:(window._dmApplRoom==='unassigned'?grouped.unassigned:((grouped.groups.find(g=>g.room.id===window._dmApplRoom)||{}).appliances||[]));
  const sig = list.map(a => { const st = cdApplStatus(a); return [a.id, a.name, a.icon, cdApplCategory(a), st.cls, Math.round(st.w || 0), cdApplConfiguredEntities(a).map(en => en + ':' + (STATES[en] && STATES[en].state || '')).join(',')].join('|'); }).join('||');
  const active = document.querySelector('.appl-main-view.active')?.id || 'appl-view-overview';
  const fullSig = active + '::' + sig;
  if (!force && host._sig === fullSig) return;
  host._sig = fullSig;
  const labs = ['Powered on','Instant consumption','Daily energy','Alerts'];
  const on = list.filter(a => cdApplStatus(a).cls === 'run').length;
  const watts = list.reduce((t, a) => t + (cdApplStatus(a).w || 0), 0);
  const day = list.reduce((t, a) => t + cdApplNum(cdApplEntity(a, ['energy_today','daily_energy'])), 0);
  const alerts = list.filter(a => !cdApplConfiguredEntities(a).length).length;
  setHtml('appl-kpi-grid', [[labs[0], on, '🟢'], [labs[1], Math.round(watts) + ' W', '⚡'], [labs[2], (day ? day.toFixed(1) : '—') + ' kWh', '📅'], [labs[3], alerts, '⚠️']].map(x => `<div class="glance-card" style="--g-rgb:14,165,233;display:flex;"><div class="g-info"><span class="g-name">${x[0]}</span><span class="g-val">${x[1]}</span></div><div class="g-icon-wrap">${x[2]}</div></div>`).join(''));
  setTxt('appl-main-sub', list.length ? '' : 'No appliances configured.');
  const cats = {
    overview: roomList,
    kitchen: list.filter(a => cdApplCategory(a) === 'kitchen'),
    laundry: list.filter(a => cdApplCategory(a) === 'laundry'),
    home: list.filter(a => cdApplCategory(a) === 'home'),
    other: list.filter(a => cdApplCategory(a) === 'other')
  };
  Object.entries(cats).forEach(([k, arr]) => setHtml('appl-grid-' + k, arr.length ? arr.map(cdApplMainCard).join('') : `<div class="appl-empty">🧺 No appliance in this category</div>`));
  const max = Math.max(1, ...list.map(a => cdApplStatus(a).w || 0));
  setHtml('appl-consumption-list', list.length ? list.map(a => { const st = cdApplStatus(a), w = st.w || 0, nm = String(a.name || cdApplianceName(a.icon)).replace(/</g,'&lt;'); return `<div class="appl-cons-row"><div><div class="appl-wide-name">${nm}</div><div class="appl-cons-bar"><div class="appl-cons-fill" style="width:${Math.min(100, w / max * 100)}%"></div></div></div><div class="appl-pwr">${Math.round(w)} W</div></div>`; }).join('') : `<div class="appl-empty">No appliance configured</div>`);
  const autos = list.filter(a => Array.isArray(a.automations) && a.automations.length);
  setHtml('appl-grid-automations', autos.length ? autos.map(a => `<div class="appl-wide-card"><div class="appl-wide-name">🤖 ${a.name || cdApplianceName(a.icon)}</div><div class="appl-wide-cat">${a.automations.map(x => x.name || x.entity || x).join(' · ')}</div></div>`).join('') : `<div class="appl-empty">🤖 No automation configured</div>`);
}

/* ───────── EDITOR: tab Elettrodomestici ───────── */
let _applEnts=[]; let _applEditIdx=null;
function editorRenderAppliances(){
  const list=getAppliances();
  const rows=list.map((a,i)=>{
    const ents=(a.entities||[]).map(e=>typeof e==='string'?e:e.entity);
    return '<div class="ed-row"><div class="ed-row-main"><div class="ed-row-new"><span style="display:inline-flex;vertical-align:middle;color:#0ea5e9;">'+cdApplianceIcon(a.icon,18)+'</span> '+(a&&a.name?a.name:cdApplianceName(a.icon))+' <span style="color:var(--text-dim,#94a3b8);font-size:11px;font-weight:700;">· '+ents.length+' entities</span></div><div class="ed-row-old mono">'+ents.join(', ')+'</div></div><div class="ed-del" onclick="edApplEdit('+i+')" style="color:#0ea5e9;" title="Modifica">✏️</div><div class="ed-del" onclick="edApplDel('+i+')" title="Elimina">🗑️</div></div>';
  }).join('') || '<div class="ed-empty">No appliance configured</div>';
  const editing=(_applEditIdx!=null && list[_applEditIdx]);
  const ed=editing?list[_applEditIdx]:{};
  const esc=x=>String(x==null?'':x).replace(/"/g,'&quot;');
  const curIcon=editing?(ed.icon||'generico'):'generico';
  return '<div class="ed-intro">Add your appliances (washing machine, dishwasher, oven, microwave…). You can link <b>one or more entities</b> to each; the status (Running / Standby / Off) is derived from <b>power draw in Watts</b>, so it works even with <b>non-wifi</b> appliances via a smart plug.</div>'
    +'<div class="ed-list">'+rows+'</div>'
    +'<div class="ed-form">'
    +'<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;"><button type="button" id="appl-icon-btn" onclick="dmAppliancePicker()" style="flex:0 0 54px;height:54px;border:1px solid var(--card-border);border-radius:14px;background:linear-gradient(135deg,#e0f2fe,#bae6fd);color:#0369a1;cursor:pointer;display:flex;align-items:center;justify-content:center;">'+cdApplianceIcon(curIcon,30)+'</button><input id="appl-name" class="ed-input" style="flex:1;margin:0;" value="'+(editing?esc(ed.name):'')+'" placeholder="Name (e.g. Washing machine, Kitchen oven…)"><input type="hidden" id="appl-icon" value="'+curIcon+'"></div>' +'<div style="margin-bottom:8px;"><label style="font-size:11px;font-weight:700;color:var(--text-dim,#94a3b8);display:block;margin-bottom:4px;">ROOM</label><select id="appl-room" class="ed-input" style="margin:0;width:100%;">'+cdRoomOptions(editing?(ed.room_id||ed.room):'')+'</select></div>'
    +'<div style="display:flex;gap:6px;"><input id="appl-ent" class="ed-input mono" data-entity-input autocomplete="off" style="flex:1;" placeholder="sensor.oven_power (W) or switch.oven"><button type="button" class="dm-entity-picker" data-entity-target="appl-ent" aria-label="Select entity_id">🔍</button></div>'
    +'<button type="button" class="ed-btn-add" style="background:linear-gradient(135deg,#0ea5e9,#0369a1);margin-bottom:8px;" onclick="edApplAddEntity()">＋ Add this entity</button>'
    +'<div id="appl-ents" style="margin-bottom:8px;"></div>'
    +'<input id="appl-thr" class="ed-input" type="number" value="'+(editing&&ed.threshold_run!=null?ed.threshold_run:5)+'" placeholder="Running threshold (Watts)">'
    +'<div style="font-size:11px;color:var(--text-dim);margin:-4px 2px 8px;font-weight:700;">Above this power = Running. For non-wifi appliances set ~5 W.</div>'
    +'<button class="ed-btn-add" onclick="edApplSave()">'+(editing?'💾 Save changes':'＋ Add appliance')+'</button>'
    +(editing?'<button type="button" class="ed-btn-add" style="background:#94a3b8;margin-top:6px;" onclick="edApplCancel()">✖ Cancel edit</button>':'')
    +'</div>';
}
function edApplRenderEnts(){
  const box=document.getElementById('appl-ents'); if(!box) return;
  if(!_applEnts.length){ box.innerHTML='<div style="font-size:11px;color:var(--text-dim);font-weight:700;padding:2px 2px 0;">No entity added — type/pick and press ➕</div>'; return; }
  box.innerHTML=_applEnts.map((en,i)=>'<span style="display:inline-flex;align-items:center;gap:7px;background:rgba(14,165,233,0.12);color:#0369a1;border-radius:100px;padding:5px 11px;font-size:11.5px;font-weight:800;margin:0 6px 6px 0;font-family:monospace;">'+en+'<span onclick="edApplRemoveEntity('+i+')" style="cursor:pointer;font-weight:900;font-family:sans-serif;">✕</span></span>').join('');
}
function edApplAddEntity(){ const inp=document.getElementById('appl-ent'); const v=((inp&&inp.value)||'').trim(); if(!v.includes('.')){alert('Enter a valid entity');return;} if(!_applEnts.includes(v))_applEnts.push(v); if(inp)inp.value=''; edApplRenderEnts(); }
function edApplRemoveEntity(i){ _applEnts.splice(i,1); edApplRenderEnts(); }
function edApplFinalizeSave(){
  _applEnts=[]; _applEditIdx=null; editorSwitch('appliances');
  globalThis.renderAppliances?.(); globalThis.renderApplianceSection?.(true);
  globalThis.cdRebuildReportDevices?.(); globalThis.buildReportSelect?.();
  edToast('Appliance saved');
}
async function edApplSave(){
  const name=(document.getElementById('appl-name').value||'').trim();
  const icon=(document.getElementById('appl-icon').value||'generico');
  const thr=parseFloat(document.getElementById('appl-thr').value); 
  const typed=(document.getElementById('appl-ent').value||'').trim();
  const entities=_applEnts.slice(); if(typed.includes('.')&&!entities.includes(typed)) entities.push(typed);
  if(!entities.length){ alert('Add at least one entity (press ➕)'); return; }
  const roomSel=(document.getElementById('appl-room')||{}).value||''; const previous=(_applEditIdx!=null&&getAppliances()[_applEditIdx])?getAppliances()[_applEditIdx]:{}; const item={ id:'appl_'+Date.now().toString(36), name:name||cdApplianceDisplayName(Object.assign({},previous,{name:'',entities:entities}))||'Appliance', icon, entities, room_id:roomSel, threshold_run:isNaN(thr)?5:thr, threshold_standby:1 }; ['image','image_url','type','device_type'].forEach(function(k){ if(previous[k]!=null) item[k]=previous[k]; }); const _rm=((document.getElementById('appl-room')||{}).value||'').trim(); if(_rm) item.room_id=_rm;
  const list=getAppliances();
  if(_applEditIdx!=null&&list[_applEditIdx]){ item.id=list[_applEditIdx].id||item.id; list[_applEditIdx]=item; } else list.push(item);
  var store=globalThis.DashboardModernModules&&DashboardModernModules.store;
  if(store){ try { await store.replaceSection('appliances',list); edApplFinalizeSave(); } catch(error){ alert('Save failed: '+error.message); } return; }
  localStorage.setItem('cd_appliances',JSON.stringify(list)); cdEnsureSectionVisible('appliances');
  try{ cdMarkDirty(); cdSyncPush(); }catch(_error){}
  edApplFinalizeSave();
}
function edApplEdit(i){ const a=getAppliances()[i]; if(!a) return; _applEditIdx=i; try { edToast('Modifica: '+(a.name||'elettrodomestico')); } catch(eT){} setTimeout(function(){ try { var f=document.getElementById('appl-name')||document.getElementById('appl-ent'); if(f){ f.scrollIntoView({behavior:'smooth', block:'center'}); f.focus(); } } catch(e2){} }, 250); _applEnts=(a.entities||[]).map(e=>typeof e==='string'?e:e.entity).filter(Boolean); editorSwitch('appliances'); }
function edApplDel(i){
  if(!confirm('Delete this appliance?')) return;
  const list=getAppliances(); if(i<0||i>=list.length) return;
  var store=globalThis.DashboardModernModules&&DashboardModernModules.store;
  if(store){
    store.removeItem('appliances',list[i].id).then(function(){
      globalThis.cdRebuildReportDevices?.(); globalThis.buildReportSelect?.();
      editorSwitch('appliances'); globalThis.renderAppliances?.(); globalThis.renderApplianceSection?.(true);
    }).catch(function(error){ alert('Delete failed: '+error.message); });
    return;
  }
  list.splice(i,1); localStorage.setItem('cd_appliances',JSON.stringify(list));
  globalThis.renderAppliances?.(); globalThis.renderApplianceSection?.(true);
  globalThis.cdRebuildReportDevices?.(); globalThis.buildReportSelect?.();
}
function edApplCancel(){ _applEditIdx=null; _applEnts=[]; editorSwitch('appliances'); }

/* Picker degli elettrodomestici con immagini standard */
function dmAppliancePicker(){
  const ov=document.createElement('div'); ov.id='dm-applpick';
  ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:100002;display:flex;align-items:center;justify-content:center;padding:16px;';
  ov.onclick=e=>{ if(e.target===ov) ov.remove(); };
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  ov.innerHTML='<div style="background:'+(dark?'#0f172a':'#fff')+';color:'+(dark?'#e2e8f0':'#0f172a')+';border-radius:22px;padding:18px;width:min(460px,100%);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.35);">'
    +'<div style="font-weight:900;font-size:14.5px;margin-bottom:10px;">Choose the appliance</div>'
    +'<div style="overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;">'
    +DM_APPLIANCES.map(a=>'<button type="button" onclick="dmApplianceChoose(\''+a.t+'\')" style="display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 4px;border:1px solid var(--card-border,#e2e8f0);border-radius:14px;background:rgba(148,163,184,0.07);color:inherit;cursor:pointer;"><span style="color:#0ea5e9;">'+cdApplianceIcon(a.t,30)+'</span><span style="font-size:10px;font-weight:700;text-align:center;line-height:1.15;">'+a.n+'</span></button>').join('')
    +'</div><button type="button" style="margin-top:10px;padding:11px;border:none;border-radius:12px;background:#94a3b8;color:#fff;font-weight:800;cursor:pointer;" onclick="document.getElementById(\'dm-applpick\').remove()">Chiudi</button></div>';
  document.body.appendChild(ov);
}
function dmApplianceChoose(t){
  const ov=document.getElementById('dm-applpick'); if(ov) ov.remove();
  const h=document.getElementById('appl-icon'); if(h) h.value=t;
  const b=document.getElementById('appl-icon-btn'); if(b) b.innerHTML=cdApplianceIcon(t,30);
  const nm=document.getElementById('appl-name'); if(nm && !nm.value.trim()) nm.value=cdApplianceName(t);
}

function cdBrandLogo(size, withWordmark) {
    size = size || 44;
    const uid = 'cdlg' + Math.random().toString(36).slice(2, 7);
    const mark = '<img src="./logo.png" alt="Dashboard Modern" width="'+size+'" height="'+size+'" style="flex:0 0 auto;display:block;object-fit:contain;border-radius:12px;" onerror="this.style.display=&#39;none&#39;">';
    if (!withWordmark) return mark;
    const fs = Math.round(size * 0.42);
    return `<div style="display:flex; align-items:center; gap:12px;">${mark}<div style="display:flex; flex-direction:column; line-height:1.05;"><span style="font-family:'Oswald',sans-serif; font-weight:700; font-size:${fs}px; letter-spacing:0.5px; color:var(--text,#0f172a);">Dashboard</span><span style="font-family:'Oswald',sans-serif; font-weight:700; font-size:${fs}px; letter-spacing:2.5px; color:#0ea5e9;">MODERN</span></div></div>`;
}

/* v0.9.7 (#4): custom alerts — condition label, evaluation, render in the Alerts Panel */
function cdAvvisoCondLabel(a) {
    const v = (a && a.value != null) ? a.value : '';
    switch (a && a.cond) {
        case 'off': return 'off';
        case 'eq':  return '= ' + v;
        case 'neq': return '≠ ' + v;
        case 'gt':  return '> ' + v;
        case 'lt':  return '< ' + v;
        default:    return 'active';
    }
}
function cdAvvisoActive(a, stateObj) {
    if (!a || !stateObj) return false;
    const st = String(stateObj.state), stl = st.toLowerCase();
    const num = parseFloat(st), val = parseFloat(a.value);
    switch (a.cond) {
        case 'off': return ['off','closed','false','no','0','unavailable','unknown','idle','standby'].includes(stl);
        case 'eq':  return stl === String(a.value).toLowerCase();
        case 'neq': return stl !== String(a.value).toLowerCase();
        case 'gt':  return !isNaN(num) && !isNaN(val) && num > val;
        case 'lt':  return !isNaN(num) && !isNaN(val) && num < val;
        default:    return ['on','open','opened','true','yes','home','detected','heat','heating','cool','cooling','playing','active','armed','wet','motion','occupied','running'].includes(stl);
    }
}
function cdRenderCustomAvvisi() {
    const wrap = document.getElementById('glance-custom-wrap');
    if (!wrap) return;
    const active = [];
    cdCfgList('cd_avvisi_custom').forEach((a, idx) => {
        const ents = a.entities || (a.entity ? [a.entity] : []);
        const matches = ents.filter(en => { const s = STATES[en]; return s && cdAvvisoActive(a, s); });
        if (matches.length) active.push({ a, idx, count: matches.length });
    });
    const sig = active.map(x => x.idx + ':' + x.count + ':' + (x.a.icon || '') + ':' + (x.a.name || '')).join('|');
    if (wrap._sig === sig) return;
    wrap._sig = sig;
    wrap.innerHTML = active.map(({ a, idx, count }) => {
        const nm = String(a.name || 'Alert').replace(/</g, '&lt;');
        const ic = a.icon || '⚠️';
        return `<div class="glance-card" style="--g-rgb: 245,158,11; display:flex;" onclick="apriAvvisoCustom(${idx})"><div class="g-info"><span class="g-name">${nm}</span><span class="g-val">${count}</span></div><div class="g-icon-wrap anim-ping" style="color:#f59e0b;">${ic}</div></div>`;
    }).join('');
}
/* v0.10.2: popup listing WHICH entities are active — refreshes live without going empty */
function apriAvvisoCustom(idx) {
    if (navigator.vibrate) navigator.vibrate(10);
    const a = cdCfgList('cd_avvisi_custom')[idx];
    if (!a) return;
    currentPopupType = 'avviso_custom';
    window._avvPopupIdx = idx;
    document.getElementById('details-modal').classList.add('show');
    _avvRenderPopup(a, idx, true);
}
function updateAvvisoCustom() {
    const idx = window._avvPopupIdx;
    const a = cdCfgList('cd_avvisi_custom')[idx];
    if (a) _avvRenderPopup(a, idx, false);
}
function _avvRenderPopup(a, idx, force) {
    const list = document.getElementById('details-list');
    if (!list) return;
    const ents = a.entities || (a.entity ? [a.entity] : []);
    const matches = ents.filter(en => { const s = STATES[en]; return s && cdAvvisoActive(a, s); });
    document.getElementById('details-title').innerHTML = (a.icon || '⚠️') + ' ' + String(a.name || 'Alert').toUpperCase();
    const sig = 'avv' + idx + '|' + matches.map(en => en + ':' + (STATES[en] && STATES[en].state)).join(',');
    if (!force && list._avvSig === sig) return;
    list._avvSig = sig;
    if (!matches.length) {
        list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-dim); font-weight:800; text-transform:uppercase; letter-spacing:1px; font-size:13px;">No active entity</div>';
        return;
    }
    list.innerHTML = matches.map(en => {
        const s = STATES[en];
        const nm = (s && s.attributes && s.attributes.friendly_name) || en;
        const st = s ? String(s.state).toUpperCase() : '—';
        return `<div class="detail-row"><div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;overflow:hidden;"><div class="d-icon" style="flex-shrink:0;">${a.icon || '⚠️'}</div><div class="d-info" style="min-width:0;flex:1;overflow:hidden;"><div class="d-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;">${nm}</div><div class="d-state"><span style="font-family:monospace; font-size:11px; color:var(--text-dim,#64748b);">${en}</span> · <span style="font-weight:900; color:#f59e0b;">${st}</span></div></div></div></div>`;
    }).join('');
}

/* ═══ v254: SISTEMA OVERRIDE ENTITÀ (configurabile da UI, solo admin) ═══ */
let ENTITY_OVERRIDES = cdCfg('cd_entity_overrides');
window.cdApplyCanonicalOverrides = function(overrides) { ENTITY_OVERRIDES = Object.assign({}, overrides || {}); };
function resolveEntity(id) { return ENTITY_OVERRIDES[id] || id; }

const _RAW_STATES = {};
/* v270: oggetto "fantasma" per i riferimenti non mappati — evita che un singolo
   accesso a .state/.attributes interrompa l'aggiornamento dell'intera dashboard. */
const CD_GHOST = Object.freeze({ state: 'unavailable', attributes: Object.freeze({}), entity_id: 'dm.unmapped' });
let STATES = new Proxy(_RAW_STATES, {
    get(target, key) {
        if (typeof key !== 'string') return target[key];
        if (ENTITY_OVERRIDES[key]) return target[ENTITY_OVERRIDES[key]];
        // v270: build pubblica — ref dm.* non mappato → stato fantasma sicuro (mai crash)
        if (typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING) {
            if (key.startsWith('dm.')) return CD_GHOST;
            if (typeof CD_SLOT_REFS !== 'undefined' && CD_SLOT_REFS.has(key)) return CD_GHOST;
        }
        return target[key];
    },
    set(target, key, value) { target[key] = value; return true; },
    has(target, key) { return (typeof key === 'string' ? (ENTITY_OVERRIDES[key] || key) : key) in target; },
    deleteProperty(target, key) { delete target[key]; return true; }
});
let ws = null;
let msgId = 1;
let HA_API_URL = '';
let HA_HTTP_URL = ''; 
let currentPopupType = null; 
let pendingWsCallbacks = {};
window.dmCallHaService = function dmCallHaService(domain, service, serviceData) {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            reject(new Error(document.documentElement.lang === 'en' ? 'Home Assistant is not connected' : 'Home Assistant non connesso'));
            return;
        }
        const id = msgId++;
        pendingWsCallbacks[id] = (message) => {
            if (message.success === false) {
                reject(new Error((message.error && message.error.message) || 'Service call failed'));
                return;
            }
            resolve(message.result);
        };
        ws.send(JSON.stringify({
            id,
            type: 'call_service',
            domain,
            service,
            service_data: serviceData
        }));
    });
};
let currentWeatherEntity = null;
let currentActiveCam = null;
let currentHistEntity = null;
let currentHistName = null;
let hlsInstance = null; 
let isPseudoFullscreen = false; // Gestione Fullscreen per iOS su flussi MJPEG

/* v281: la dashboard deve vivere anche se il CDN di Chart.js non è raggiungibile
   (tablet offline, reti filtrate): senza questa guardia un CDN mancante uccideva
   l'intera inizializzazione — wizard, tap sul titolo, configurazione. */
if (typeof Chart !== 'undefined' && Chart.defaults) {
    Chart.defaults.color = '#5c6c81';
    Chart.defaults.font ||= {};
    Chart.defaults.font.family = "'Inter', sans-serif";
}
let storicChartInstance = null;

/* ═══ v256: CONNESSIONE — priorità: wizard UI (localStorage/baked) → config.js → default ═══ */
const _CFG = window.DASHBOARD_CONFIG || {};
const _CONN = (window.__DASHBOARDMODERN_HOSTED__ && window.__DASHBOARDMODERN_CONNECTION__) || (typeof cdCfg === 'function' ? cdCfg('cd_connection') : {}) || {};
const LONG_LIVED_TOKEN = window.__DASHBOARDMODERN_HOSTED__ ? (window.__DASHBOARDMODERN_REAL_TOKEN__ || '') : _CONN.token || ((typeof _dmNoBaked === 'undefined' || !_dmNoBaked) && _CFG.connection && _CFG.connection.token) || ""; 
const NABU_CASA_URL = _CONN.remote_url || (_CFG.connection && _CFG.connection.remote_url) || ""; 
const LOCAL_IP = _CONN.local_ip || (_CFG.connection && _CFG.connection.local_ip) || (location.host || "homeassistant.local:8123");
const DASHBOARD_PATH = _CONN.dashboard_path || (_CFG.connection && _CFG.connection.dashboard_path) || "/lovelace/0?disable_km=";
if (!LONG_LIVED_TOKEN && !window.__DASHBOARDMODERN_HOSTED__) document.addEventListener('DOMContentLoaded', () => { if (typeof apriSetupWizard === 'function') apriSetupWizard(); });

const LUCI_NAMES = {};

const SUBLOADS_CONFIG = {
  'cucina': { title: 'Cucina Istantaneo', icon: '🍳', items: [] },
  'lavanderia': { title: 'Lavanderia Istantaneo', icon: '🧺', items: [] },
  'cucina_day': { title: 'Cucina Giornaliero', icon: '🍳', items: [] },
  'lavanderia_day': { title: 'Lavanderia Giornaliero', icon: '🧺', items: [] },
  'cucina_month': { title: 'Cucina Mensile', icon: '🍳', items: [] },
  'lavanderia_month': { title: 'Lavanderia Mensile', icon: '🧺', items: [] }
};

/* ═══ v256: APPLICATORE CONFIG UTENTE ═══
   Applica window.DASHBOARD_CONFIG (da config.js): branding, luci custom, sezioni on/off, entità. */
function cdOnReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
}
(function applyUserConfig() {
    const C = window.DASHBOARD_CONFIG || {};
    // v256: il wizard UI (localStorage/baked) ha priorità sul config.js
    const wBrand = cdCfg('cd_branding'), wSect = cdCfg('cd_sections'), wLuci = cdCfg('cd_luci');
    const brand = Object.keys(wBrand||{}).length ? wBrand : (C.branding || {});
    const sect  = Object.keys(wSect||{}).length ? wSect : (C.sections || null);
    const luci  = Object.keys(wLuci||{}).length ? wLuci : (C.luci || null);
    // ── Branding: titolo pagina + header ──
    if (brand.title) {
        document.title = brand.title + ' — Smart Home';
        cdOnReady(() => {
            const h1 = document.querySelector('header h1');
            if (h1) h1.textContent = brand.title;
            const p = document.querySelector('header h1 + p');
            if (p && brand.subtitle) p.textContent = brand.subtitle;
        });
    }
    // ── Luci: se fornite, sostituiscono completamente quelle di default ──
    if (luci && typeof luci === 'object' && Object.keys(luci).length) {
        Object.keys(LUCI_NAMES).forEach(k => delete LUCI_NAMES[k]);
        Object.assign(LUCI_NAMES, luci);
    }
    // ── Carichi custom da config.js: si sommano ai SUBLOADS ──
    if (C.carichi && typeof C.carichi === 'object') {
        Object.entries(C.carichi).forEach(([k, items]) => {
            if (SUBLOADS_CONFIG[k] && Array.isArray(items)) SUBLOADS_CONFIG[k].items.push(...items);
        });
    }
    // ── Sezioni on/off: nasconde tab della nav + pagina ──
    if (sect) {
        cdOnReady(() => {
            Object.entries(sect).forEach(([sec, enabled]) => {
                if (enabled !== false) return;
                const tab = document.querySelector(`.tab[data-tab="${sec}"]`);
                const page = document.getElementById('page-' + sec);
                /* v262 neutralizzato: la visibilità è di cdApplyNavVis, le pagine restano nel DOM */
            });
        });
    }
})();

/* v254: nomi puliti per il popup Avvisi (Aperture + Batterie) */
const AVVISI_NAMES = {};

const GRUPPI_MONITORAGGIO = {
  'luci': Object.keys(LUCI_NAMES),
  'clima': [],
  'risc': [],
  'win': [],
  'batt': [],
};

/* Beta 31: a monitoring list is built from several sources that can name the
   same entity — the lights of the Lights tab also land in cd_gruppi_extra.luci,
   which synchronizeLightAlerts keeps in step — and concatenating them without a
   filter listed every light twice in the ACTIVE LIGHTS popup and counted it
   twice in the alerts board, while the editor kept showing it once. Every
   addition goes through here: build order is kept, duplicates never enter. */
function cdGruppoMerge(grp, ids) {
  const target = GRUPPI_MONITORAGGIO[grp];
  if (!Array.isArray(target) || !Array.isArray(ids)) return;
  ids.forEach(id => { if (id && !target.includes(id)) target.push(id); });
}

/* ═══ v254: ESTENSIONI UTENTE (aggiunte da UI Configure Entities, solo admin) ═══
   - cd_subloads_extra: { "cucina": [{name, pwr, icon, bin?, pwrLive?}, ...], "lavanderia": [...] }
   - cd_gruppi_extra:   { "win": ["binary_sensor.x", ...], "batt": [...], "luci": [...] }
   - cd_avvisi_names_extra: { "entity_id": "Nome Pulito" }  */
try {
  /* v0.7.3 fix (#4): custom groups MUST be merged into SUBLOADS_CONFIG on EVERY load —
     this block was lost, so the select/popups only saw Kitchen/Laundry. */
  cdCfgList('cd_subload_groups').forEach(g => {
    if (g && g.id && !SUBLOADS_CONFIG[g.id]) SUBLOADS_CONFIG[g.id] = { title: g.name, icon: g.icon || '🔌', items: [], custom: true };
  });
  const extSub = cdCfg('cd_subloads_extra');
  Object.entries(extSub).forEach(([k, items]) => {
    if (SUBLOADS_CONFIG[k] && Array.isArray(items)) SUBLOADS_CONFIG[k].items.push(...items);
  });
} catch(e) { console.warn('[Config Entità] subloads_extra malformato:', e); }

/* v0.7.3 fix (#4): custom load group cards in the Energy section — the function
   was called but never defined in the published file (ReferenceError). */
function buildCustomLoadCards() {
    /* v0.7.4: cards under the map removed — groups open from the flow-map nodes */
    const host = document.getElementById('custom-loads-grid');
    if (host) { host.style.display = 'none'; host.innerHTML = ''; }
}
document.addEventListener('DOMContentLoaded', buildCustomLoadCards);
try {
  const extGrp = cdCfg('cd_gruppi_extra');
  Object.entries(extGrp).forEach(([k, ids]) => {
    cdGruppoMerge(k, ids);
  });
} catch(e) { console.warn('[Config Entità] gruppi_extra malformato:', e); }
try {
  const extNames = cdCfg('cd_avvisi_names_extra');
  Object.assign(AVVISI_NAMES, extNames);
} catch(e) { console.warn('[Config Entità] avvisi_names_extra malformato:', e); }

/* v256: avvisi custom dal config.js utente (si sommano ai default) */
try {
  const C = window.DASHBOARD_CONFIG || {};
  if (C.avvisi && typeof C.avvisi === 'object') {
    Object.entries(C.avvisi).forEach(([grp, ids]) => {
      cdGruppoMerge(grp, ids);
    });
  }
  if (C.avvisi_names && typeof C.avvisi_names === 'object') Object.assign(AVVISI_NAMES, C.avvisi_names);
  if (C.entities && typeof C.entities === 'object') {
    // Le entità dal config hanno priorità PIÙ BASSA di quelle in localStorage (editor locale)
    Object.entries(C.entities).forEach(([o, n]) => { if (!(o in ENTITY_OVERRIDES)) ENTITY_OVERRIDES[o] = n; });
  }
} catch(e) { console.warn('[Config] merge avvisi/entities fallito:', e); }

/* v272: i gruppi clima/riscaldamento del Quadro Avvisi derivano dalle unità clima
   configurate (se i gruppi sono vuoti) — il contatore "Clima attivi" conta le TUE unità. */
try {
    if (!(GRUPPI_MONITORAGGIO['clima'] || []).length && !(GRUPPI_MONITORAGGIO['risc'] || []).length) {
        const units = (typeof getClimaUnits === 'function') ? getClimaUnits() : [];
        GRUPPI_MONITORAGGIO['clima'] = units.filter(u => u.type !== 'termo').map(u => u.entity);
        GRUPPI_MONITORAGGIO['risc']  = units.filter(u => u.type === 'termo').map(u => u.entity);
    }
} catch(e) {}


/* v258: rimozioni utente dal Quadro Avvisi (vale anche per le voci di default) */
try {
  const removed = cdCfg('cd_gruppi_removed');
  Object.entries(removed || {}).forEach(([grp, ids]) => {
    if (GRUPPI_MONITORAGGIO[grp] && Array.isArray(ids)) {
      GRUPPI_MONITORAGGIO[grp] = GRUPPI_MONITORAGGIO[grp].filter(id => !ids.includes(id));
    }
  });
} catch(e) { console.warn('[Config] rimozioni avvisi fallite:', e); }

function switchEnergyView(view) {
  if(navigator.vibrate) navigator.vibrate(5);
  // Solo le linguette delle viste, non tutte quelle della plancia.
  // Spegnendole tutte si spegneva anche l'impianto scelto qui sopra --
  // e le stanze degli elettrodomestici -- che con la vista non c'entrano:
  // scegliere Giornaliera lasciava la riga degli impianti senza nessuno acceso.
  document.querySelectorAll('#page-energy .sub-tabs-container .sub-tab-btn')
    .forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.flow-view').forEach(v => v.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('view-' + view).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
  // Carica la dashboard energia completa solo quando si apre quel tab
  if (view === 'panoramica') {
      renderEnergyDashboard();
  }
  if (view === 'temp') {
      renderInverterTemp();
  }
}

// ════════════════════════════════════════════════════════════════════
// TEMPERATURE INVERTER + BATTERIA + VENTOLA — rendering
// ════════════════════════════════════════════════════════════════════
function renderInverterTemp() {
  const ENTITIES = {
    ac:  'dm.energy_temperatura_ac_inverter',
    dc:  'dm.energy_temperatura_dc_inverter',
    bat: 'dm.energy_temperatura_batteria',
    fanP:'dm.energy_potenza_ventola_inverter',
    fanS:'dm.energy_interruttore_ventola_inverter'
  };

  const acT  = parseFloat(getRawState(ENTITIES.ac));
  const dcT  = parseFloat(getRawState(ENTITIES.dc));
  const batT = parseFloat(getRawState(ENTITIES.bat));
  const fanP = parseFloat(getRawState(ENTITIES.fanP)) || 0;
  const fanS = getRawState(ENTITIES.fanS) === 'on';

  // Funzione per determinare colore + stato in base alla temperatura
  // Per inverter (AC/DC): range tipici 25-80°C
  // Per batteria (LiFePO4): range tipici 10-45°C
  function classify(temp, kind) {
    if (isNaN(temp)) return { rgb: '148,163,184', stato: '—', max: 80 };
    if (kind === 'bat') {
      // Batteria
      if (temp < 10)  return { rgb: '14,165,233',  stato: 'Fredda',    max: 50 };
      if (temp < 30)  return { rgb: '16,185,129',  stato: 'Ottimale',  max: 50 };
      if (temp < 38)  return { rgb: '245,158,11',  stato: 'Tiepida',   max: 50 };
      if (temp < 45)  return { rgb: '249,115,22',  stato: 'Calda',     max: 50 };
      return                  { rgb: '220,38,38',  stato: 'CRITICA',   max: 50 };
    } else {
      // Inverter (AC o DC)
      if (temp < 30)  return { rgb: '14,165,233',  stato: 'Fredda',    max: 80 };
      if (temp < 50)  return { rgb: '16,185,129',  stato: 'Normale',   max: 80 };
      if (temp < 60)  return { rgb: '245,158,11',  stato: 'Tiepida',   max: 80 };
      if (temp < 70)  return { rgb: '249,115,22',  stato: 'Calda',     max: 80 };
      return                  { rgb: '220,38,38',  stato: 'CRITICA',   max: 80 };
    }
  }

  function renderCard(cardId, gaugeId, valId, statusId, temp, info) {
    const card = document.getElementById(cardId);
    const fill = document.getElementById(gaugeId);
    const valEl = document.getElementById(valId);
    const statEl = document.getElementById(statusId);
    if (!card || !fill || !valEl || !statEl) return;
    card.style.setProperty('--c-rgb', info.rgb);
    if (isNaN(temp)) {
      valEl.textContent = '—';
      statEl.textContent = '—';
      fill.style.strokeDashoffset = 126;
      return;
    }
    valEl.textContent = temp.toFixed(1);
    statEl.textContent = info.stato;
    // Gauge: arc da 0 a max, lunghezza 126 (circa π × 40)
    const ratio = Math.min(1, Math.max(0, temp / info.max));
    const dashOffset = 126 * (1 - ratio);
    fill.style.strokeDashoffset = dashOffset;
  }

  // Render 3 card
  renderCard('tmp-card-ac',  'tmp-gauge-fill-ac',  'tmp-val-ac',  'tmp-status-ac',  acT,  classify(acT,  'inv'));
  renderCard('tmp-card-dc',  'tmp-gauge-fill-dc',  'tmp-val-dc',  'tmp-status-dc',  dcT,  classify(dcT,  'inv'));
  renderCard('tmp-card-bat', 'tmp-gauge-fill-bat', 'tmp-val-bat', 'tmp-status-bat', batT, classify(batT, 'bat'));

  // Stato generale (mostra il "peggiore" tra i 3, e indica QUALE dispositivo)
  const allTemps = [
    { v: acT,  i: classify(acT,  'inv'), nome: 'Inverter AC' },
    { v: dcT,  i: classify(dcT,  'inv'), nome: 'Inverter DC' },
    { v: batT, i: classify(batT, 'bat'), nome: 'Batteria' }
  ];
  const pill = document.getElementById('tmp-status-pill');
  const pillTxt = document.getElementById('tmp-status-text');
  if (pill && pillTxt) {
    pill.classList.remove('warning', 'alert');
    // Trova lo stato peggiore (priorità: CRITICA > Calda > Tiepida > Normale/Ottimale > Fredda)
    const priorita = { 'CRITICA': 4, 'Calda': 3, 'Tiepida': 2, 'Normale': 1, 'Ottimale': 1, 'Fredda': 0, '—': -1 };
    const validi = allTemps.filter(t => !isNaN(t.v));
    if (validi.length === 0) {
      pillTxt.textContent = 'In attesa...';
    } else {
      // Trova il dispositivo con stato peggiore
      validi.sort((a, b) => (priorita[b.i.stato] || 0) - (priorita[a.i.stato] || 0));
      const peggio = validi[0];
      const peggioP = priorita[peggio.i.stato] || 0;
      // Conta quanti hanno stato Calda/CRITICA per dare un messaggio coerente
      const numCaldi  = validi.filter(t => priorita[t.i.stato] >= 3).length;
      const numTiepidi = validi.filter(t => priorita[t.i.stato] === 2).length;

      if (peggioP === 4) {
        // C'è almeno una CRITICA
        pill.classList.add('alert');
        pillTxt.textContent = `⚠ ${peggio.nome}: critica`;
      } else if (peggioP === 3) {
        // C'è almeno una Calda
        pill.classList.add('warning');
        pillTxt.textContent = numCaldi > 1 ? `${numCaldi} dispositivi caldi` : `${peggio.nome}: calda`;
      } else if (peggioP === 2) {
        // Solo Tiepide
        pill.classList.add('warning');
        pillTxt.textContent = numTiepidi > 1 ? `${numTiepidi} dispositivi tiepidi` : `${peggio.nome}: tiepida`;
      } else {
        // Tutto Normale/Ottimale/Freddo
        pillTxt.textContent = 'Sistema OK';
      }
    }
  }

  // ─── Card VENTOLA ───
  const fanCard = document.getElementById('fan-card');
  const fanStat = document.getElementById('fan-status-txt');
  const fanPow  = document.getElementById('fan-power-val');
  if (fanCard) fanCard.classList.toggle('on', fanS);
  if (fanStat) fanStat.textContent = fanS ? 'On' : 'Off';
  if (fanPow)  fanPow.textContent  = fanP.toFixed(1);
}

// Toggle dello switch ventola
function getTapparelle(){ try { return JSON.parse(localStorage.getItem('cd_tapparelle'))||[]; } catch(e){ return []; } } function cdTappCmd(btn){ try { if(navigator.vibrate) navigator.vibrate(15); if(btn.getAttribute('data-all')){ var svc2=btn.getAttribute('data-svc'); getTapparelle().forEach(function(t){ try { ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'cover', service:svc2, target:{ entity_id: t.entity } })); } catch(e2){} }); return; } var card=btn.closest('[data-tapp]'); var ent=card&&card.getAttribute('data-tapp'); var svc=btn.getAttribute('data-svc'); if(!ent||!svc||!ws||ws.readyState!==1) return; ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'cover', service:svc, target:{ entity_id: ent } })); } catch(e){} } function cdTappCard(t){ var st=(typeof STATES!=='undefined'&&STATES[t.entity])?STATES[t.entity]:null; var state=st?String(st.state):'unknown'; var hasPos=!!(st&&st.attributes&&st.attributes.current_position!=null); var pos=hasPos?Math.max(0,Math.min(100,+st.attributes.current_position)):(state==='open'?100:(state==='closed'?0:50)); var moving=(state==='opening'||state==='closing'); var lbl=state==='open'?'Aperta':state==='closed'?'Chiusa':state==='opening'?'In apertura':state==='closing'?'In chiusura':'—'; var shutterH=100-pos; var nm=String(t.name||t.entity).replace(/</g,'&lt;'); return '<div class="tapp-card" data-tapp="'+t.entity+'">'+'<div class="tapp-head"><span class="tapp-name">'+nm+'</span>'+'<span class="tapp-state tapp-st-'+state+'">'+lbl+'</span></div>'+'<div class="tapp-win"><div class="tapp-glass"></div>'+'<div class="tapp-shutter'+(state==='opening'?' opening':'')+(state==='closing'?' closing':'')+'" style="height:'+shutterH+'%;">'+'<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>'+'<div class="tapp-pos">'+(hasPos?(pos+'%'):'')+'</div>'+'<div class="tapp-ctl">'+'<button class="tapp-btn" data-svc="open_cover" onclick="cdTappCmd(this)">▲</button>'+'<button class="tapp-btn" data-svc="stop_cover" onclick="cdTappCmd(this)">■</button>'+'<button class="tapp-btn" data-svc="close_cover" onclick="cdTappCmd(this)">▼</button>'+'</div></div>'; } function renderTapparelle(){ var grid=document.getElementById('tapp-grid'); if(!grid) return; var list=getTapparelle();  if(!list.length){ grid.innerHTML='<div class="ed-empty" style="grid-column:1/-1;">Nessuna tapparella configurata</div>'; return; } grid.innerHTML='<div style="grid-column:1/-1; display:flex; gap:8px;">'+'<button class="tapp-btn" data-all="1" data-svc="open_cover" onclick="cdTappCmd(this)">▲ Apri tutte</button>'+'<button class="tapp-btn" data-all="1" data-svc="close_cover" onclick="cdTappCmd(this)">▼ Chiudi tutte</button>'+'</div>'+cdGroupCards(list, cdTappCard); } /* Home alert owned exclusively by runtime-hotfix.js. */ setInterval(function(){ try {  var pg=document.getElementById('page-tapparelle'); if(pg && pg.offsetParent!==null) renderTapparelle(); } catch(e){} }, 2000); function getIrr(){ var o={}; try { o=JSON.parse(localStorage.getItem('cd_irrigazione'))||{}; } catch(e){} if(!o.zones) o.zones=[]; if(o.rainThr==null) o.rainThr=60; if(!o.time) o.time='06:30'; return o; } function saveIrr(o){ localStorage.setItem('cd_irrigazione', JSON.stringify(o)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} } var CD_IRR = { seq:[], cur:-1, until:0, skip:'' }; function cdIrrCmd(ent,on){ try { if(!ent||!ws||ws.readyState!==1) return; var d=String(ent).split('.')[0]; var dom, svc; if(d==='valve'){ dom='valve'; svc=on?'open_valve':'close_valve'; } else { dom='homeassistant'; svc=on?'turn_on':'turn_off'; } ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:dom, service:svc, target:{ entity_id: ent } })); } catch(e){} } function cdIrrRain(){ var o=getIrr(); if(!o.rainEnt) return null; var st=(typeof STATES!=='undefined')?STATES[o.rainEnt]:null; if(!st) return null; var v=parseFloat(st.state); return isNaN(v)?null:v; } function cdIrrStartSeq(seq){ var o=getIrr(); if(!seq.length) return; CD_IRR.skip=''; CD_IRR.seq=seq.slice(); CD_IRR.cur=-1; cdIrrNext(); } function cdIrrNext(){ var o=getIrr(); if(CD_IRR.cur>=0){ var pz=o.zones[CD_IRR.seq[CD_IRR.cur]]; if(pz) cdIrrCmd(pz.entity,false); } CD_IRR.cur++; if(CD_IRR.cur>=CD_IRR.seq.length){ CD_IRR.seq=[]; CD_IRR.cur=-1; CD_IRR.until=0; renderIrrigazione(); return; } var z=o.zones[CD_IRR.seq[CD_IRR.cur]]; if(!z){ cdIrrNext(); return; } cdIrrCmd(z.entity,true); var m=parseFloat(z.mins); if(isNaN(m)||m<=0) m=10; CD_IRR.until=Date.now()+m*60000; renderIrrigazione(); } function cdIrrStopAll(){ var o=getIrr(); o.zones.forEach(function(z){ if(z) cdIrrCmd(z.entity,false); }); CD_IRR.seq=[]; CD_IRR.cur=-1; CD_IRR.until=0; renderIrrigazione(); } function cdIrrProgram(force){ var o=getIrr(); if(!o.zones.length) return; var pr=cdIrrRain(); if(!force && o.rainEnt && pr!=null && pr>=(+o.rainThr||60)){ CD_IRR.skip='🌧️ Pioggia prevista '+Math.round(pr)+'% — programma saltato'; renderIrrigazione(); return; } cdIrrStartSeq(o.zones.map(function(_z,i){ return i; })); } function cdIrrBtn(btn){ try { if(navigator.vibrate) navigator.vibrate(15); var act=btn.getAttribute('data-act'); var idx=parseInt(btn.getAttribute('data-idx')||'-1',10); if(act==='zstart'){ cdIrrStartSeq([idx]); } else if(act==='pstart'){ cdIrrProgram(false); } else if(act==='pforce'){ cdIrrProgram(true); } else { cdIrrStopAll(); } } catch(e){} } function cdIrrCard(z){ var o=getIrr(); var i=z._idx; var running=(CD_IRR.cur>=0 && CD_IRR.seq[CD_IRR.cur]===i); var m=parseFloat(z.mins); if(isNaN(m)||m<=0) m=10; var nm=String(z.name||z.entity).replace(/</g,'&lt;'); var chip='Pronta · '+m+' min'; var barw=0; if(running){ var left=Math.max(0,CD_IRR.until-Date.now()); var mm=Math.floor(left/60000), ss=Math.floor(left%60000/1000); chip='💦 '+mm+':'+(ss<10?'0':'')+ss; barw=Math.round(100-(left/(m*60000))*100); } return '<div class="irr-card'+(running?' irr-run':'')+'">'+'<div class="irr-drops"><b></b><b></b><b></b></div>'+'<div class="irr-head2"><span class="irr-name">🌱 '+nm+'</span>'+'<span class="irr-chip">'+chip+'</span></div>'+'<div class="irr-bar"><b style="width:'+barw+'%"></b></div>'+'<div class="irr-ctl">'+'<button class="irr-btn" data-act="zstart" data-idx="'+i+'" onclick="cdIrrBtn(this)">▶</button>'+'<button class="irr-btn stop" data-act="stop" onclick="cdIrrBtn(this)">⏹</button>'+'</div></div>'; } function renderIrrigazione(){ var head=document.getElementById('irr-head'); var grid=document.getElementById('irr-grid'); var o=getIrr();  if(!head||!grid) return; if(!o.zones.length){ head.innerHTML=''; grid.innerHTML='<div class="ed-empty" style="grid-column:1/-1;">Nessuna zona configurata</div>'; return; } var met=''; if(o.weatherEnt && typeof STATES!=='undefined' && STATES[o.weatherEnt]){ var w=STATES[o.weatherEnt]; met+='⛅ '+String(w.state)+((w.attributes&&w.attributes.temperature!=null)?(' · '+w.attributes.temperature+'°'):''); } var pr=cdIrrRain(); if(pr!=null) met+=(met?' · ':'')+'🌧️ Prob. pioggia '+Math.round(pr)+'% (soglia '+(+o.rainThr||60)+'%)'; var runP=(CD_IRR.cur>=0 && CD_IRR.seq.length>1); head.innerHTML='<div class="irr-prog">'+'<div class="irr-head2"><span class="irr-name">💧 Programma irrigazione</span><span class="irr-chip">'+(o.enabled?('⏰ ogni giorno alle '+o.time):'spento')+'</span></div>'+(met?('<div class="irr-meteo">'+met+'</div>'):'')+(CD_IRR.skip?('<div class="irr-skip">'+CD_IRR.skip+'</div>'):'')+'<div class="irr-ctl">'+'<button class="irr-btn" data-act="pstart" onclick="cdIrrBtn(this)">▶ Avvia programma</button>'+'<button class="irr-btn" data-act="pforce" onclick="cdIrrBtn(this)">⚡ Forza (ignora pioggia)</button>'+'<button class="irr-btn stop" data-act="stop" onclick="cdIrrBtn(this)">⏹ Stop</button>'+'</div></div>'; grid.innerHTML=cdGroupCards(o.zones.map(function(z,i){ return Object.assign({},z,{_idx:i}); }), cdIrrCard); } setInterval(function(){ try { if(CD_IRR.cur>=0 && Date.now()>CD_IRR.until) cdIrrNext();  var pg=document.getElementById('page-irrigazione'); if(pg && pg.offsetParent!==null) renderIrrigazione(); } catch(e){} }, 1000); setInterval(function(){ try { var o=getIrr(); if(!o.enabled || !o.zones.length || CD_IRR.cur>=0) return; var d=new Date(); var hm=(d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes(); if(hm!==o.time) return; var today=d.toDateString(); if(localStorage.getItem('cd_irr_lastrun')===today) return; localStorage.setItem('cd_irr_lastrun', today); cdIrrProgram(false); } catch(e){} }, 30000); function getPool(){ var o={}; try { o=JSON.parse(localStorage.getItem('cd_piscina'))||{}; } catch(e){} if(o.phMin==null) o.phMin=7.0; if(o.phMax==null) o.phMax=7.6; if(!o.filterStart) o.filterStart='09:00'; if(o.filterHours==null) o.filterHours=8; if(o.autoHours==null) o.autoHours=true; return o; } function savePool(o){ localStorage.setItem('cd_piscina', JSON.stringify(o)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} } var CD_POOL = { stopAt:0 }; function cdPoolNum(ent){ if(!ent) return null; var st=(typeof STATES!=='undefined')?STATES[ent]:null; if(!st) return null; var v=parseFloat(st.state); return isNaN(v)?null:v; } function cdPoolOn(ent){ if(!ent) return false; var st=(typeof STATES!=='undefined')?STATES[ent]:null; return !!(st && st.state==='on'); } function cdPoolSvc(ent,svc){ try { if(!ent||!ws||ws.readyState!==1) return; ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'homeassistant', service:svc, target:{ entity_id: ent } })); } catch(e){} } function cdPoolTargetHours(){ var o=getPool(); if(o.autoHours){ var t=cdPoolNum(o.tempEnt); if(t!=null){ var h=t/2; if(h<2) h=2; if(h>12) h=12; return Math.round(h*2)/2; } } var f=parseFloat(o.filterHours); return (isNaN(f)||f<=0)?8:f; } function cdPoolRunToday(){ var r={}; try { r=JSON.parse(localStorage.getItem('cd_pool_run'))||{}; } catch(e){} var today=(new Date()).toDateString(); if(r.d!==today){ r={ d:today, s:0 }; } return r; } function cdPoolStartFilter(){ var o=getPool(); if(!o.pumpEnt) return; var target=cdPoolTargetHours()*3600; var run=cdPoolRunToday(); var remaining=target-run.s; if(remaining<60){ remaining=60; } cdPoolSvc(o.pumpEnt,'turn_on'); CD_POOL.stopAt=Date.now()+remaining*1000; renderPiscina(); } function cdPoolStopFilter(){ var o=getPool(); if(o.pumpEnt) cdPoolSvc(o.pumpEnt,'turn_off'); CD_POOL.stopAt=0; renderPiscina(); } function cdPoolBtn(btn){ try { if(navigator.vibrate) navigator.vibrate(15); var act=btn.getAttribute('data-act'); var o=getPool(); if(act==='fstart'){ cdPoolStartFilter(); } else if(act==='fstop'){ cdPoolStopFilter(); } else if(act==='pump'){ cdPoolSvc(o.pumpEnt,'toggle'); } else if(act==='heat'){ cdPoolSvc(o.heatEnt,'toggle'); } else if(act==='light'){ cdPoolSvc(o.lightEnt,'toggle'); } setTimeout(renderPiscina, 600); } catch(e){} } function cdPoolQualRow(lbl, val, mn, mx, unit){ if(val==null) return ''; var bad = (mn!=null && !isNaN(mn) && val<mn) ? 'basso' : (mx!=null && !isNaN(mx) && val>mx) ? 'alto' : ''; return '<div class="pool-row"><span class="pool-k">'+lbl+'</span>'+'<span><span class="pool-v">'+val+(unit||'')+'</span> '+'<span class="pool-badge'+(bad?' warn':'')+'">'+(bad?('⚠️ '+bad):'ok')+'</span></span></div>'; } function renderPiscina(){ var wrap=document.getElementById('pool-wrap');  var o=getPool(); var configured=!!(o.tempEnt||o.pumpEnt||o.phEnt);  if(!wrap) return; if(!configured){ wrap.innerHTML='<div class="ed-empty">Nessuna piscina configurata</div>'; return; } var t=cdPoolNum(o.tempEnt); var chips=''; if(o.pumpEnt) chips+='<button class="pool-tg'+(cdPoolOn(o.pumpEnt)?' on':'')+'" data-act="pump" onclick="cdPoolBtn(this)">⚙️ Pompa</button>'; if(o.heatEnt) chips+='<button class="pool-tg'+(cdPoolOn(o.heatEnt)?' on':'')+'" data-act="heat" onclick="cdPoolBtn(this)">🔥 Riscaldamento</button>'; if(o.lightEnt) chips+='<button class="pool-tg'+(cdPoolOn(o.lightEnt)?' on':'')+'" data-act="light" onclick="cdPoolBtn(this)">💡 Luce</button>'; var html='<div class="pool-hero">'+'<div class="pool-temp">'+(t!=null?(t+'°'):'—')+'</div>'+'<div class="pool-sub">Temperatura acqua</div>'+'<div class="pool-chips">'+chips+'</div>'+'<div class="pool-wave"></div><div class="pool-wave w2"></div></div>'; var ph=cdPoolNum(o.phEnt); var cl=cdPoolNum(o.clEnt); var qual=cdPoolQualRow('pH', ph, parseFloat(o.phMin), parseFloat(o.phMax), '')+cdPoolQualRow('Cloro/Redox', cl, parseFloat(o.clMin), parseFloat(o.clMax), ''); if(qual) html+='<div class="pool-card">'+'<div class="pool-k">🧪 Qualità acqua</div>'+qual+'</div>'; if(o.pumpEnt){ var target=cdPoolTargetHours(); var run=cdPoolRunToday(); var doneH=Math.round(run.s/360)/10; var pct=Math.min(100, Math.round(run.s/(target*36))); var pumpOn=cdPoolOn(o.pumpEnt); html+='<div class="pool-card">'+'<div class="pool-row"><span class="pool-k">🌀 Filtrazione</span><span class="pool-badge'+(pumpOn?'':' warn')+'">'+(pumpOn?'in funzione':'ferma')+'</span></div>'+'<div class="pool-sub" style="color:inherit;opacity:0.75;font-size:12px;">Oggi '+doneH+'h su '+target+'h'+(o.autoHours?' (auto: temperatura/2)':'')+(o.enabled?(' · ⏰ avvio '+o.filterStart):'')+'</div>'+'<div class="pool-bar"><b style="width:'+pct+'%"></b></div>'+'<div class="pool-row" style="gap:6px;">'+'<button class="pool-btn" data-act="fstart" onclick="cdPoolBtn(this)">▶ Avvia filtrazione</button>'+'<button class="pool-btn stop" data-act="fstop" onclick="cdPoolBtn(this)">⏹ Stop</button>'+'</div></div>'; } wrap.innerHTML=html; } setInterval(function(){ try { if(CD_POOL.stopAt && Date.now()>CD_POOL.stopAt){ cdPoolStopFilter(); }  var pg=document.getElementById('page-piscina'); if(pg && pg.offsetParent!==null) renderPiscina(); } catch(e){} }, 2000); setInterval(function(){ try { var o=getPool(); if(o.pumpEnt && cdPoolOn(o.pumpEnt)){ var r=cdPoolRunToday(); r.s+=30; localStorage.setItem('cd_pool_run', JSON.stringify(r)); } if(!o.enabled || !o.pumpEnt || CD_POOL.stopAt) return; var d=new Date(); var hm=(d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes(); if(hm!==o.filterStart) return; var today=d.toDateString(); if(localStorage.getItem('cd_pool_lastrun')===today) return; localStorage.setItem('cd_pool_lastrun', today); cdPoolStartFilter(); } catch(e){} }, 30000); function getEvCars(){ try { return JSON.parse(localStorage.getItem('cd_ev_cars'))||[]; } catch(e){ return []; } } function saveEvCars(a){ localStorage.setItem('cd_ev_cars', JSON.stringify(a)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} } function cdEvActive(){ var v=parseInt(localStorage.getItem('cd_ev_car_active')||'-1',10); return isNaN(v)?-1:v; } function cdEvCaptureProfile(){ var ov={}; try { document.querySelectorAll('input.ed-slot-in[data-ref^="dm.ev_"]').forEach(function(el){ try { edSetSlot(el); } catch(e3){} }); } catch(e2){} try { Object.keys(ENTITY_OVERRIDES||{}).forEach(function(k){ if(k.indexOf('dm.ev_')===0) ov[k]=ENTITY_OVERRIDES[k]; }); } catch(e){} var img=''; try { var v=cdCfg('cd_ev_image'); img=(typeof v==='string')?v:((v&&v.url)||''); } catch(e){} return { ov: ov, img: img }; } function cdEvApplyCar(i){ var cars=getEvCars(); var c=cars[i]; if(!c) return; var ov={}; try { ov=JSON.parse(localStorage.getItem('cd_entity_overrides'))||{}; } catch(e){} Object.keys(ov).forEach(function(k){ if(k.indexOf('dm.ev_')===0) delete ov[k]; }); Object.keys(c.ov||{}).forEach(function(k){ ov[k]=c.ov[k]; }); localStorage.setItem('cd_entity_overrides', JSON.stringify(ov)); try { Object.keys(ENTITY_OVERRIDES).forEach(function(k){ if(k.indexOf('dm.ev_')===0) delete ENTITY_OVERRIDES[k]; }); Object.keys(c.ov||{}).forEach(function(k){ ENTITY_OVERRIDES[k]=c.ov[k]; }); } catch(e){} if(c.img!=null){ localStorage.setItem('cd_ev_image', JSON.stringify(c.img||'')); try { var im=document.getElementById('ev-mod-car-img'); if(im && c.img){ delete im.dataset.evFailed; im.src=c.img; } } catch(e){} } localStorage.setItem('cd_ev_car_active', String(i)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} try{ if(typeof render==='function') render(); }catch(e){} cdEvCarsRefresh(); } function cdEvCarSel(sel){ var i=parseInt(sel.value,10); if(!isNaN(i)) cdEvApplyCar(i); } function cdEvCarsRefresh(){ var box=document.getElementById('ev-car-picker'); var sel=document.getElementById('ev-car-sel'); if(!box||!sel) return; var cars=getEvCars(); box.style.display = cars.length>1 ? '' : 'none'; if(cars.length<2) return; var act=cdEvActive(); sel.innerHTML = cars.map(function(c,i){ return '<option value="'+i+'"'+(i===act?' selected':'')+'>🚗 '+String(c.name||('Auto '+(i+1))).replace(/</g,'&lt;')+'</option>'; }).join(''); } setInterval(function(){ try { cdEvCarsRefresh(); } catch(e){} }, 2000); function getEnViews(){ try { return JSON.parse(localStorage.getItem('cd_energy_views'))||{}; } catch(e){ return {}; } } function cdEnList(){ return [['ist','⚡','Istantanea (mappa flussi)'],['day','📅','Giornaliera'],['month','📆','Mensile'],['panoramica','📊','Report (elettrodomestici e analisi)'],['temp','🌡️','Temperature inverter']]; } function cdMappedKey(k){ try { return !!(ENTITY_OVERRIDES && ENTITY_OVERRIDES[k]); } catch(e){ return true; } } function cdApplyFlowMinimal(){ try { var noSolar=!cdMappedKey('dm.energy_potenza_fotovoltaico'); var noBatt=!cdMappedKey('dm.energy_potenza_batteria'); function hide(id,h){ var el=document.getElementById(id); if(el) el.style.display=h?'none':''; } hide('n-solar', noSolar); hide('n-battery', noBatt); ['line-solar-home','line-solar-grid','m-line-solar-home','m-line-solar-grid','line-solar-home-day','line-solar-grid-day','m-line-solar-home-day','m-line-solar-grid-day'].forEach(function(id){ hide(id, noSolar); }); ['line-battery-home','m-line-battery-home','line-battery-home-day','m-line-battery-home-day'].forEach(function(id){ hide(id, noBatt); }); ['line-solar-battery','m-line-solar-battery','line-solar-battery-day','m-line-solar-battery-day'].forEach(function(id){ hide(id, noSolar||noBatt); }); } catch(e){} } function cdEnergyOpen(k){ try { document.querySelectorAll('.sub-tab-btn').forEach(function(b){ b.classList.remove('active'); var m=String(b.getAttribute('onclick')||'').match(/switchEnergyView\('(\w+)'\)/); if(m && m[1]===k) b.classList.add('active'); }); document.querySelectorAll('.flow-view').forEach(function(pv){ pv.classList.remove('active'); }); var panel=document.getElementById('view-'+k); if(panel) panel.classList.add('active'); if(k==='panoramica'){ try{ renderEnergyDashboard(); }catch(e2){} } if(k==='temp'){ try{ renderInverterTemp(); }catch(e2){} } } catch(e){} } function cdApplyEnergyViews(){ try { var v=getEnViews(); var firstOn=null; var activeHidden=false; document.querySelectorAll('.sub-tab-btn').forEach(function(b){ var m=String(b.getAttribute('onclick')||'').match(/switchEnergyView\('(\w+)'\)/); if(!m) return; var k=m[1]; var on=(v[k]!==false); b.style.display=on?'':'none'; if(on && !firstOn) firstOn=k; if(!on && b.classList.contains('active')) activeHidden=true; }); if(activeHidden && firstOn) cdEnergyOpen(firstOn); cdApplyFlowMinimal(); } catch(e){} } setTimeout(cdApplyEnergyViews, 1800); function cdNavOrder(){ try { var v=JSON.parse(localStorage.getItem('cd_navbar_order'))||[]; return Array.isArray(v)?v:[]; } catch(e){ return []; } } function cdNavTabs(){ var out=[]; document.querySelectorAll('.tab[data-tab]').forEach(function(b){ var t=(b.textContent||'').trim(); out.push({ k:b.getAttribute('data-tab'), lbl:t }); }); return out; } function cdNavKeys(){ var tabs=cdNavTabs(); var ord=cdNavOrder(); var keys=[]; ord.forEach(function(k){ if(tabs.some(function(t){ return t.k===k; }) && keys.indexOf(k)<0) keys.push(k); }); tabs.forEach(function(t){ if(keys.indexOf(t.k)<0) keys.push(t.k); }); return keys; } function cdApplyNavOrder(){ try { var ord=cdNavOrder(); if(!ord.length) return; var btns=document.querySelectorAll('.tab[data-tab]'); if(!btns.length) return; var nav=btns[0].parentElement; var map={}; btns.forEach(function(b){ map[b.getAttribute('data-tab')]=b; }); cdNavKeys().forEach(function(k){ if(map[k]) nav.appendChild(map[k]); }); } catch(e){} } setTimeout(function(){ try { cdApplyNavOrder(); } catch(e){} }, 1200); function cdSecShow(k){ try { if(!k) return; setTimeout(function(){ try { cdApplyNavVis(); } catch(e2){} }, 60); var cur=cdCfg('cd_sections')||{}; if(cur[k]===false){ cur[k]=true; localStorage.setItem('cd_sections', JSON.stringify(cur)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { if(typeof updateEditButtonVisibility==='function') updateEditButtonVisibility(); } catch(e2){} try { if(typeof render==='function') render(); } catch(e2){} } } catch(e){} } function cdSecShowByRef(ref){ try { var r=String(ref||''); var mapp=[['dm.energy_','energy'],['dm.ev_','ev'],['dm.boiler_','boiler'],['dm.security_','security'],['dm.server_','server'],['dm.home_','home']]; for(var i=0;i<mapp.length;i++){ if(r.indexOf(mapp[i][0])===0){ cdSecShow(mapp[i][1]); return; } } } catch(e){} } function cdSecLS(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } } function cdSecHasContent(k){ try { var ov=cdSecLS('cd_entity_overrides')||{}; var oks=Object.keys(ov); function pref(p){ for(var i=0;i<oks.length;i++){ if(oks[i].indexOf(p)===0) return true; } return false; } if(k==='energy') return pref('dm.energy_'); if(k==='ev') return pref('dm.ev_'); if(k==='boiler') return pref('dm.boiler_'); if(k==='server') return pref('dm.server_'); if(k==='security') return pref('dm.security_') || ((cdSecLS('cd_cameras')||[]).length>0); if(k==='clima') return (cdSecLS('cd_clima_units')||[]).length>0; if(k==='temp'){ var st=cdSecLS('cd_stanze')||[]; for(var i2=0;i2<st.length;i2++){ if(st[i2]&&st[i2].temp) return true; } return false; } if(k==='appliances') return (cdSecLS('cd_appliances')||[]).length>0; if(k==='tapparelle') return (cdSecLS('cd_tapparelle')||[]).length>0; if(k==='irrigazione'){ var irr=cdSecLS('cd_irrigazione')||{}; return ((irr.zones)||[]).length>0; } if(k==='piscina'){ var pc=cdSecLS('cd_piscina')||{}; return Object.keys(pc).length>0; } return true; } catch(e){ return true; } } function cdSecBoot(){ try { window.__CD_SBRUN=(window.__CD_SBRUN||0)+1; if(!window.__DASHBOARDMODERN_HOSTED__) return; var _cs=localStorage.getItem('cd_sections'); if(_cs){ try { var cur2=JSON.parse(_cs)||{}; var ch2=false; ['energy','appliances','ev','boiler','clima','temp','security','server','tapparelle','irrigazione','piscina'].forEach(function(k){ if(!(k in cur2)){ cur2[k]=cdSecHasContent(k)?true:false; ch2=true; } }); if(ch2){ localStorage.setItem('cd_sections', JSON.stringify(cur2)); try { cdApplyNavVis(); } catch(e3){} } } catch(e4){} return; } var out={}; ['energy','appliances','ev','boiler','clima','temp','security','server','tapparelle','irrigazione','piscina'].forEach(function(k){ out[k]=cdSecHasContent(k)?true:false; }); localStorage.setItem('cd_sections', JSON.stringify(out)); try { cdApplyNavVis(); } catch(e2){} try { if(typeof render==='function') render(); } catch(e2){} } catch(e){} } cdSecBoot(); setTimeout(cdSecBoot, 1200);  function cdRegEnrich(done){ try { var fin=false; var to=setTimeout(function(){ if(!fin){ fin=true; done(); } }, 9000); var so=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/websocket'); var mid=1; var want={}; var out={ floors:null, areas:null, ents:null, devs:null }; function fire(type,slot){ var id=mid++; want[id]=slot; so.send(JSON.stringify({ id:id, type:type })); } function finish(){ if(fin) return; fin=true; clearTimeout(to); try { so.close(); } catch(e2){} try { cdRegApply(out); } catch(e2){} done(); } so.onerror=function(){ finish(); }; so.onmessage=function(ev){ try { var m=JSON.parse(ev.data); if(m.type==='auth_required'){ so.send(JSON.stringify({ type:'auth', access_token:(window.__DASHBOARDMODERN_REAL_TOKEN__||'') })); return; } if(m.type==='auth_ok'){ fire('config/floor_registry/list','floors'); fire('config/area_registry/list','areas'); fire('config/entity_registry/list','ents'); fire('config/device_registry/list','devs'); return; } if(m.type==='result' && want[m.id]){ out[want[m.id]] = m.success ? (m.result||[]) : []; delete want[m.id]; if(out.floors&&out.areas&&out.ents&&out.devs) finish(); } } catch(e3){} }; } catch(e){ done(); } } function cdRegApply(o){ try { var floors=(o.floors||[]).slice().sort(function(a,b){ return (a.level||0)-(b.level||0); }); var fName={}; floors.forEach(function(f){ fName[f.floor_id]=f.name; }); if(floors.length){ localStorage.setItem('cd_floors', JSON.stringify(floors.map(function(f){ return f.name; }))); } var aName={}; var aFloor={}; (o.areas||[]).forEach(function(a){ aName[a.area_id]=a.name; aFloor[a.area_id]=fName[a.floor_id]||''; }); if((o.areas||[]).length){ var st=cdCfgList('cd_stanze').slice(); (o.areas||[]).forEach(function(a){ var ex=null; for(var i=0;i<st.length;i++){ if(st[i]&&st[i].name===a.name){ ex=st[i]; break; } } if(ex){ if(!ex.floor && aFloor[a.area_id]) ex.floor=aFloor[a.area_id]; } else { var r={ name:a.name, icon:'🏠' }; if(aFloor[a.area_id]) r.floor=aFloor[a.area_id]; st.push(r); } }); localStorage.setItem('cd_stanze', JSON.stringify(st)); } var devArea={}; (o.devs||[]).forEach(function(d){ if(d.area_id) devArea[d.id]=d.area_id; }); var entArea={}; (o.ents||[]).forEach(function(e){ var ar=e.area_id||devArea[e.device_id]; if(ar) entArea[e.entity_id]=aName[ar]||''; }); var rooms={}; try { rooms=cdCfg('cd_luci_rooms')||{}; } catch(e2){} var ch=false; Object.keys(cdCfg('cd_luci')||{}).forEach(function(id){ if(!rooms[id] && entArea[id]){ rooms[id]=entArea[id]; ch=true; } }); if(ch) localStorage.setItem('cd_luci_rooms', JSON.stringify(rooms)); var units=getClimaUnits().slice(); var uc=false; units.forEach(function(u){ if(u && !u.room && entArea[u.entity]){ u.room=entArea[u.entity]; uc=true; } }); if(uc) localStorage.setItem('cd_clima_units', JSON.stringify(units)); var cams=cdCfgList('cd_cameras').slice(); var cc=false; cams.forEach(function(c){ var ce=c&&(c.entity||c.cam); if(c && !c.room && ce && entArea[ce]){ c.room=entArea[ce]; cc=true; } }); if(cc) localStorage.setItem('cd_cameras', JSON.stringify(cams)); try { if((cdCfgList('cd_stanze')||[]).some(function(r){ return r&&r.temp; })) cdSecShow('temp'); if(getClimaUnits().length) cdSecShow('clima'); if(cdCfgList('cd_cameras').length) cdSecShow('security'); var ov=cdCfg('cd_entity_overrides')||{}; Object.keys(ov).forEach(function(k){ cdSecShowByRef(k); }); } catch(e4){} try { cdMarkDirty(); cdSyncPush(); } catch(e5){} } catch(e){} } function cdNavVisMap(){ return { home:'home', energy:'energy', appliances:'appliances-main', ev:'ev', boiler:'boiler', clima:'clima', temp:'temp', security:'security', server:'server', tapparelle:'tapparelle', irrigazione:'irrigazione', piscina:'piscina' }; } window.__CD_NVRUN=(window.__CD_NVRUN||0); function cdApplyNavVis(){ try { window.__CD_NVRUN++; var cur=cdCfg('cd_sections')||{}; var mp=cdNavVisMap(); Object.keys(mp).forEach(function(k){ document.querySelectorAll('.tab[data-tab="'+mp[k]+'"]').forEach(function(b){ if(cur[k]===false) b.style.setProperty('display','none','important'); else b.style.removeProperty('display'); }); }); } catch(e){} } try { cdApplyNavVis(); } catch(e) {} setTimeout(function(){ try { cdApplyNavVis(); } catch(e) {} }, 1500); setInterval(function(){ try { cdApplyNavVis(); } catch(e) {} }, 3000); function cdApplEntTog(en, btn){ try { if(navigator.vibrate) navigator.vibrate(12); var dom=String(en).split('.')[0]; var cur=(STATES[en]&&STATES[en].state)||'off'; var svc=(cur==='on')?'turn_off':'turn_on'; ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain: dom, service: svc, target:{ entity_id: en } })); if(btn){ btn.style.opacity='0.45'; setTimeout(function(){ try { btn.style.opacity=''; var st2=(STATES[en]&&STATES[en].state)||''; btn.textContent=(st2==='on')?'OFF':'ON'; btn.classList.toggle('on', st2==='on'); } catch(e2){} }, 900); } } catch(e){} } setTimeout(function(){ try { buildTempCards(); } catch(e){} }, 2200); function cdApplBridge(){ try { if(typeof APPLIANCES==='undefined') return; var list=cdCfgList('cd_appliances'); if(!list.length) return; APPLIANCES.length=0; list.forEach(function(a){ if(!a) return; var ents=a.entities||[]; var pw=null, sw=null, en2=null; ents.forEach(function(e){ var d=String(e).split('.')[0]; if(d==='switch'&&!sw) sw=e; else if(/energy|kwh/i.test(e)&&!en2) en2=e; else if(d==='sensor'&&!pw) pw=e; }); APPLIANCES.push({ name:a.name||'?', icon:a.icon||'\ud83e\uddfa', category:String(a.room||'altro').toLowerCase(), power:pw, energy:en2, duration:null, switch:sw, history:pw||en2 }); }); try { var pg=document.getElementById('page-appliances-main'); var bar=pg&&pg.querySelector('.sub-tabs-energy'); if(bar){ var cats=[]; APPLIANCES.forEach(function(a){ if(a.category&&cats.indexOf(a.category)<0) cats.push(a.category); }); var bh='<button class="sub-tab-btn appl-section-tab active" onclick="switchApplianceView(\'overview\', event)">📊 Overview</button>'; cats.forEach(function(c){ var lb=c.charAt(0).toUpperCase()+c.slice(1); bh+='<button class="sub-tab-btn appl-section-tab" onclick="switchApplianceView(\''+c+'\', event)">🏠 '+lb+'</button>'; }); bar.innerHTML=bh; } if(pg){ pg.querySelectorAll('button').forEach(function(b){ var t=(b.textContent||''); if(t.indexOf('CONFIGURA')>=0||t.indexOf('Configura')>=0){ var card=b.closest('div'); if(card&&card.parentElement) card.parentElement.style.display='none'; } }); } } catch(e3){} try { if(typeof renderApplianceSection==='function') renderApplianceSection(true); } catch(e2){} } catch(e){} } setTimeout(cdApplBridge, 2600); setInterval(cdApplBridge, 15000); function toggleVentola() {
  if (navigator.vibrate) navigator.vibrate(30);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    id: msgId++,
    type: 'call_service',
    domain: 'switch',
    service: 'toggle',
    target: { entity_id: 'dm.energy_interruttore_ventola_inverter' }
  }));
}

// Refresh periodico delle temperature inverter quando la view è attiva
setInterval(() => {
  const view = document.getElementById('view-temp');
  if (view && view.classList.contains('active')) {
    renderInverterTemp();
  }
}, 2000);

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    if(navigator.vibrate) navigator.vibrate(5);
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('page-' + t.dataset.tab).classList.add('active');

    const mainHeader = document.querySelector('header');
    if (mainHeader) {
      if (t.dataset.tab === 'home') {
        mainHeader.style.display = 'flex';
      } else {
        mainHeader.style.display = 'none';
      }
    }

    // Scroll to top quando si cambia sezione
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    // Carica temperature al click sul tab stanze
    if (t.dataset.tab === 'temp') renderTemperature(); if (t.dataset.tab === 'tapparelle') renderTapparelle(); if (t.dataset.tab === 'irrigazione') renderIrrigazione(); if (t.dataset.tab === 'piscina') renderPiscina(); if (t.dataset.tab === 'appliances-main') { try { renderAppliances(); } catch(eA){} }
    if (t.dataset.tab === 'appliances-main') renderApplianceSection();
  });
});

// Inserisce il pulsante "← Home" all'inizio di ogni pagina TRANNE la home
(function injectBackHomeButtons() {
  document.querySelectorAll('.page').forEach(page => {
    if (page.id === 'page-home') return;
    if (page.querySelector(':scope > .back-home-btn')) return; // già presente
    const btn = document.createElement('button');
    btn.className = 'back-home-btn';
    btn.innerHTML = '<span class="bh-icon">←</span><span>Home</span>';
    btn.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate(5);
      const homeTab = document.querySelector('[data-tab="home"]');
      if (homeTab) homeTab.click();
    });
    page.insertBefore(btn, page.firstChild);
  });
})();

async function connect() {
  let token = window.__DASHBOARDMODERN_HOSTED__ ? '__dashboardmodern_hosted__' : LONG_LIVED_TOKEN; let host = location.host; let proto = location.protocol === 'https:' ? 'wss:' : 'ws:'; let httpProto = location.protocol === 'https:' ? 'https:' : 'http:'; 
  let safeNabu = NABU_CASA_URL.replace('https://', '').replace('http://', '').replace(/\/$/, ''); let safeLocal = LOCAL_IP.replace('https://', '').replace('http://', '').replace(/\/$/, '');
  if (!host || host === "" || host === "localhost" || location.protocol === 'file:') {
    if (safeNabu && !safeNabu.includes("INSERISCI_QUI")) { host = safeNabu; proto = 'wss:'; httpProto = 'https:'; } 
    else { host = safeLocal; proto = 'ws:'; httpProto = 'http:'; }
  }

  HA_API_URL = proto + '//' + host; HA_HTTP_URL = httpProto + '//' + host; 
  try { ws = new WebSocket(proto + '//' + host + '/api/websocket'); } catch(e) { return; }

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendingWsCallbacks[m.id]) { pendingWsCallbacks[m.id](m); delete pendingWsCallbacks[m.id]; }
    
    if(m.type === 'auth_required') ws.send(JSON.stringify({type:'auth', access_token:token}));
    if(m.type === 'auth_ok') {
      setTxt('conn-text', 'Connesso');
      document.getElementById('live-dot').classList.add('connected');
      // v290: la configurazione salvata su HA (per-utente) viene propagata a questo dispositivo
      window._cdSyncReqId = msgId;
      ws.send(JSON.stringify({id:msgId++, type:'frontend/get_user_data', key:(window.__DASHBOARDMODERN_HOSTED__ ? ('dashboardmodern_integration_config' + (window.__DASHBOARDMODERN_PRIMARY__ === false && window.__DASHBOARDMODERN_INSTANCE__ ? '__' + String(window.__DASHBOARDMODERN_INSTANCE__).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) : '')) : 'dashboard' + '_modern_config')}));
      setTimeout(cdTotalsRun, 2500); try { setTimeout(cdEmptyStateCheck, 1200); setTimeout(cdEmptyStateCheck, 4000); } catch(e) {} try { setTimeout(function(){ try{ cdRebuildReportDevices(); buildReportSelect(); }catch(e2){} }, 2600); } catch(e) {}
      if (!window._cdTotalsTimer) window._cdTotalsTimer = setInterval(cdTotalsRun, 30 * 60 * 1000);
      ws.send(JSON.stringify({id:msgId++, type:'get_states'}));
      ws.send(JSON.stringify({id:msgId++, type:'subscribe_events', event_type:'state_changed'}));
      refreshCameras(); 
    }
    if (m.type === 'result' && cdTotalsHandle(m)) return;
    if (m.type === 'result' && m.id === window._cdSyncReqId) {
      try {
        const v = m.result && m.result.value;
        const localTs = parseInt(localStorage.getItem('cd_sync_ts') || '0');
        if (localStorage.getItem('cd_sync_dirty')) { try { cdSyncPush(); } catch(e){} return; } // v299: prima invio le mie
        if (v && v.__ts && v.__ts > localTs && !sessionStorage.getItem('cd_sync_reloading')) {
          const n = cdSyncApply(v);
          localStorage.setItem('cd_sync_ts', String(v.__ts));
          if (n > 0) { if (sessionStorage.getItem('cd_sync_rl2')) { console.log('[Sync] applicato senza reload (loop-guard)'); try { if (typeof render === 'function') render(); } catch(e2) {} } else { sessionStorage.setItem('cd_sync_rl2', '1'); sessionStorage.setItem('cd_sync_reloading', '1'); console.log('[Sync] config più recente da HA — ricarico'); location.reload(); } }
        } else { sessionStorage.removeItem('cd_sync_reloading'); }
      } catch(e) { console.warn('[Sync] pull check:', e); }
      return;
    }
    if(m.type === 'result' && Array.isArray(m.result)) { m.result.forEach(s => STATES[s.entity_id] = s); render(); }
    if(m.type === 'event' && m.event.event_type === 'state_changed') { 
        if(m.event.data.new_state) STATES[m.event.data.entity_id] = m.event.data.new_state; else delete STATES[m.event.data.entity_id];
        render(); 
        // v240/v241/v244: aggiorna popup clima rapido se aperto
        const eid = m.event.data.entity_id;
        if (eid && document.getElementById('quick-clima-modal')?.classList.contains('show')) {
          if (eid.startsWith('climate.') || eid.startsWith('input_boolean.')) {
            renderQuickClima();
          }
          // Switch termici → re-render pannello stato (visibile solo in modalità caldo)
          if (eid === 'switch.caldaia' || eid === 'dm.core_053' || eid === 'dm.core_047') {
            if (currentClimaMode === 'caldo') renderThermalPanel();
          }
        }
        // v240: aggiorna popup antifurto se aperto e l'entità cambiata è l'alarm panel
        if (eid === 'dm.security_centrale_allarme' && document.getElementById('quick-alarm-modal')?.classList.contains('show')) {
          renderQuickAntifurto();
        }
    }
  };
  ws.onclose = () => { document.getElementById('live-dot').classList.remove('connected'); setTxt('conn-text', 'Riconnessione...'); setTimeout(connect, 5000); };
}

function toggle(eid) {
  if(!ws) return;
  if(navigator.vibrate) navigator.vibrate(10);
  eid = resolveEntity(eid);  // v254: applica eventuale override
  ws.send(JSON.stringify({ id: msgId++, type: 'call_service', domain: eid.split('.')[0], service: 'toggle', service_data: { entity_id: eid } }));
}

function setEVMode(mode) {
  if(!ws) return;
  if(navigator.vibrate) navigator.vibrate(10);
  document.querySelectorAll('.evcc-mode-btn').forEach(btn => btn.classList.remove('active'));
  const btnMod = document.getElementById('m-btn-' + mode);
  const btnPopup = document.getElementById('p-btn-' + mode);
  if(btnMod) btnMod.classList.add('active');
  if(btnPopup) btnPopup.classList.add('active');
  // La chiamata viaggia sull'entita' mappata, non sul riferimento dm.*:
  // senza risolverlo Home Assistant rifiutava sempre e i pulsanti sembravano
  // morti (l'active ottimista veniva rispento dal render successivo).
  const modeEid = resolveEntity('dm.ev_modalita_ricarica_evcc');
  if (!modeEid || modeEid.indexOf('dm.') === 0) return;
  ws.send(JSON.stringify({ id: msgId++, type: 'call_service', domain: modeEid.split('.')[0], service: 'select_option', service_data: { entity_id: modeEid, option: mode } }));
}

window.changeSelect = function(entityId, value) {
  if(!ws) return;
  if(navigator.vibrate) navigator.vibrate(10);
  // Il riferimento dm.* si traduce nell'entita' mappata e il dominio si legge
  // da quella: prima partiva una chiamata su un dominio inesistente e il
  // target non cambiava mai. Un'entita' number si comanda con set_value.
  const eid = resolveEntity(entityId);
  if (!eid || eid.indexOf('dm.') === 0 || eid.indexOf('input_dm.') === 0) return;
  const domain = eid.split('.')[0];
  const call = (domain === 'number' || domain === 'input_number')
    ? { domain: domain, service: 'set_value', service_data: { entity_id: eid, value: parseFloat(value) } }
    : { domain: domain, service: 'select_option', service_data: { entity_id: eid, option: value } };
  ws.send(JSON.stringify(Object.assign({ id: msgId++, type: 'call_service' }, call)));
};

// I km al limite di carica: il sensore dedicato se c'e', altrimenti il conto
// autonomia attuale / batteria attuale x target — cosi' cambiando il target
// il numero si muove anche senza un sensore template scritto a mano.
function dmEvKmAlTarget() {
  const lim = parseFloat(getRawState('dm.ev_target_soc'));
  const range = parseFloat(getRawState('dm.ev_autonomia'));
  const soc = parseFloat(getRawState('dm.ev_batteria_auto'));
  if (isFinite(range) && isFinite(soc) && soc > 0 && isFinite(lim)) return Math.round((range / soc) * lim);
  const dedicato = parseFloat(getRawState('dm.ev_autonomia_al_limite_di_carica'));
  return isFinite(dedicato) ? Math.round(dedicato) : null;
}

function apriPopup() {
    document.getElementById('ev-popup').classList.add('show');
    // Aggiorna subito la barra batteria con il valore corrente
    const socNum = parseFloat(getRawState('dm.ev_batteria_auto')) || 0;
    const battSvg = document.getElementById('ev-mod-batt-fill-popup-svg');
    if (battSvg && socNum > 0) {
        battSvg.style.width = socNum.toFixed(1) + '%';
        battSvg.style.background = socNum > 70 ? '#10b981' : socNum > 30 ? '#f59e0b' : '#ef4444';
    }
    document.querySelectorAll('.v-ev-soc-txt').forEach(el => el.textContent = socNum + '%');
}
function apriPopupLavatrice() { if(navigator.vibrate) navigator.vibrate(10); document.getElementById('lavatrice-modal').classList.add('show'); }

/* v254: utility per ottenere l'utente HA loggato (la dashboard è caricata in iframe, accediamo via parent) */
function getCurrentHassUser() {
    try {
        if (window.parent === window) return '';
        const haEl = window.parent.document.querySelector('home-assistant');
        return (haEl && haEl.hass && haEl.hass.user && haEl.hass.user.name) || '';
    } catch(e) { return ''; }
}

/* v254: handler click sul pulsante Editor Plancia.
   - Su PC web: lascia il default <a target=_top> agire (naviga la finestra HA con ?disable_km=)
   - Su mobile companion app: intercetta (preventDefault) e mostra modal con istruzioni manuali
     (perché il sandbox dell'iframe blocca QUALSIASI navigation della finestra parent,
     e <a target=_top> verrebbe interpretato come "apri in browser esterno") */
function handleEditClick(e) {
    if(navigator.vibrate) navigator.vibrate(15);
    
    // Detect companion app (Android externalApp, iOS webkit, UA HomeAssistant/)
    const checkUA = (ua) => /HomeAssistant\//i.test(ua || '');
    let parentUA = '', hasExternalApp = false, hasWebkitBus = false;
    try { parentUA = (window.parent.navigator && window.parent.navigator.userAgent) || ''; } catch(err) {}
    try { hasExternalApp = typeof window.externalApp !== 'undefined' || typeof window.parent.externalApp !== 'undefined'; } catch(err) {}
    try { 
        hasWebkitBus = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.externalBus)
                   || !!(window.parent.webkit && window.parent.webkit.messageHandlers && window.parent.webkit.messageHandlers.externalBus);
    } catch(err) {}
    const isCompanionApp = checkUA(navigator.userAgent) || checkUA(parentUA) || hasExternalApp || hasWebkitBus;
    console.log('[Editor Plancia] Ambiente:', isCompanionApp ? 'App Companion' : 'Browser web');
    
    if (isCompanionApp) {
        // Su app companion: intercetto e mostro modal istruzioni
        e.preventDefault();
        e.stopPropagation();
        mostraModalEditPlancia();
        return false;
    }
    
    // Su PC web: lascia agire il <a target=_top> standard
    console.log('[Editor Plancia] [Web] navigo via <a target=_top>');
    return true;
}

/* v254: modal con istruzioni per modificare la plancia nell'app companion.
   Le strategie automatiche non funzionano per il sandbox iframe, quindi guido l'utente. */
function mostraModalEditPlancia() {
    const fullUrl = window.location.origin + DASHBOARD_PATH;
    
    // Rimuove eventuale modal precedente
    const old = document.getElementById('edit-plancia-modal');
    if (old) old.remove();
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'edit-plancia-modal';
    modal.className = 'modal-wrapper show';
    modal.style.cssText = 'opacity:1; visibility:visible; pointer-events:auto;';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 480px; padding: 28px 24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid var(--card-border);">
            <div style="font-family:'Oswald',sans-serif; font-size:20px; font-weight:700; color:var(--text);">✏️ MODIFICA PLANCIA</div>
            <div onclick="document.getElementById('edit-plancia-modal').remove()" style="cursor:pointer; width:32px; height:32px; border-radius:50%; background: var(--surface-3); display:flex; align-items:center; justify-content:center; font-size:14px; color:var(--text-dim);">✕</div>
          </div>
          <div style="font-size:14px; color:var(--text); line-height:1.6; margin-bottom:18px;">
            Sei nell'<b>app HA Companion</b>. Per modificare la plancia hai 2 opzioni:
          </div>
          <div style="background: var(--surface-2); border:1px solid var(--card-border); border-radius:16px; padding:16px; margin-bottom:14px;">
            <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#0369a1; margin-bottom:8px;">🅰️ Opzione 1 - Da app</div>
            <ol style="margin:0; padding-left:18px; font-size:13px; line-height:1.7; color:var(--text);">
              <li>Tocca l'icona <b>profilo utente</b> in basso a destra dell'app HA</li>
              <li>Tocca <b>"Impostazioni"</b></li>
              <li><b>"Dashboards"</b> → seleziona la plancia → <b>Modifica</b></li>
            </ol>
          </div>
          <div style="background:#f0f9ff; border:1px solid rgba(14,165,233,0.25); border-radius:16px; padding:16px; margin-bottom:18px;">
            <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#0369a1; margin-bottom:8px;">🅱️ Opzione 2 - Da browser</div>
            <div style="font-size:13px; line-height:1.6; color:var(--text); margin-bottom:10px;">
              Apri questo URL in Chrome (esci dall'app):
            </div>
            <div style="background: var(--card-bg); border:1px solid var(--card-border); border-radius:10px; padding:10px 12px; font-family:monospace; font-size:11px; word-break:break-all; color:var(--text-dim);">${fullUrl}</div>
          </div>
          <div style="display:flex; gap:10px;">
            <button onclick="copyEditUrl()" style="flex:1; padding:13px 14px; border:none; border-radius:14px; background:linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%); color:#0369a1; font-weight:800; font-size:13px; letter-spacing:0.5px; text-transform:uppercase; cursor:pointer;">📋 Copia URL</button>
            <button onclick="document.getElementById('edit-plancia-modal').remove()" style="flex:1; padding:13px 14px; border:none; border-radius:14px; background: var(--surface-3); color:var(--text); font-weight:800; font-size:13px; letter-spacing:0.5px; text-transform:uppercase; cursor:pointer;">CHIUDI</button>
          </div>
        </div>
    `;
    document.body.appendChild(modal);
}

/* ═══════════════════════════════════════════════════════════════════
   v255: EDITOR VISUALE DASHBOARD (solo admin)
   Editor a tab: Sostituzioni · Carichi · Avvisi · Testi · Nascondi · Esporta
   Tutte le modifiche → localStorage (anteprima immediata) + Esporta JSON per
   rendere permanente nell'HTML tramite Claude.
   ═══════════════════════════════════════════════════════════════════ */

let EDITOR_TAB = 'sost';

function apriConfigEntita() {
    if(navigator.vibrate) navigator.vibrate(15);
    const old = document.getElementById('editor-modal');
    if (old) old.remove();

    const allEntities = Object.keys(_RAW_STATES).sort();
    const datalist = '<datalist id="ed-entity-list">' + allEntities.map(e => `<option value="${e}">`).join('') + '</datalist>';

    const modal = document.createElement('div');
    modal.id = 'editor-modal';
    modal.className = 'modal-wrapper show';
    modal.style.cssText = 'opacity:1; visibility:visible; pointer-events:auto;';
    modal.innerHTML = datalist + `
      <div class="modal-card ed-shell">
        <div class="ed-head">
          <div class="ed-head-title">${cdBrandLogo(40)} EDITOR DASHBOARD</div>
          ${window.__DASHBOARDMODERN_HOSTED__ ? '' : '<div class="ed-head-close" title="Download the dashboard with token and configuration baked in" onclick="cdBakeDownload()">💾</div>'}<div class="ed-head-close" onclick="document.getElementById('editor-modal').remove()">✕</div>
        </div>
        <div class="ed-tabs">
          <button class="ed-tab" data-tab="visib" onclick="editorSwitch('visib')">⚙️ Impostazioni</button>
          <button class="ed-tab" data-tab="sost"  onclick="editorSwitch('sost')">🔁 Overrides</button>
          <button class="ed-tab" data-tab="sez0" onclick="editorSwitch('sez0')">🏠 Home</button>
          <button class="ed-tab" data-tab="sez1" onclick="editorSwitch('sez1')">⚡ Energy</button>
          <button class="ed-tab" data-tab="sez2" onclick="editorSwitch('sez2')">🚗 EV</button>
          <button class="ed-tab" data-tab="sez3" onclick="editorSwitch('sez3')">🌞 Solare</button>
          <button class="ed-tab" data-tab="sez4" onclick="editorSwitch('sez4')">🛡️ Sicurezza</button>
          <button class="ed-tab" data-tab="sez6" onclick="editorSwitch('sez6')">🖥️ MiniPC</button>
          <button class="ed-tab" data-tab="sez7" onclick="editorSwitch('sez7')">🌡️ Temperatura</button>
          <button class="ed-tab" data-tab="sez8" onclick="editorSwitch('sez8')">⚡ Azioni</button>
          <button class="ed-tab" data-tab="sez9" onclick="editorSwitch('sez9')">❄️ Clima</button>
          <button class="ed-tab" data-tab="pool" onclick="editorSwitch('pool')">🏊 Piscina</button>
          <button class="ed-tab" data-tab="irr" onclick="editorSwitch('irr')">💧 Irrigazione</button>
          <button class="ed-tab" data-tab="tapp" onclick="editorSwitch('tapp')">🪟 Tapparelle</button>
          <button class="ed-tab" data-tab="stanze" onclick="editorSwitch('stanze')">🚪 Rooms</button>
          <button class="ed-tab" data-tab="luci"  onclick="editorSwitch('luci')">💡 Lights</button>
          <button class="ed-tab" data-tab="appliances" onclick="editorSwitch('appliances')">🧺 Appliances</button>
          <button class="ed-tab" data-tab="avvisi" onclick="editorSwitch('avvisi')">🔔 Alerts</button>
          <button class="ed-tab" data-tab="testi" onclick="editorSwitch('testi')">✏️ Texts</button>
          
          <button class="ed-tab" data-tab="runtime" onclick="editorSwitch('runtime')">🩺 Runtime</button>
          <button class="ed-tab" data-tab="export" onclick="editorSwitch('export')">📤 Export</button>
        </div>
        <div class="ed-body" id="ed-body"></div>
      </div>`;
    document.body.appendChild(modal);
    globalThis.DashboardModernModules?.registerEditorTabs?.(document);
    editorSwitch(EDITOR_TAB);
}

function editorSwitch(tab) {
    EDITOR_TAB = tab;
    if (globalThis.DashboardModernModules?.renderEditorTab?.(tab)) return;
    try { setTimeout(function(){ ['ed-cl-room','ed-cam-room','ed-lu-room','ed-st2-name'].forEach(function(id){ var els=document.querySelectorAll('select#'+id+', select[id="'+id+'"]'); els.forEach(function(el){ if(el){ var cur=el.value||''; el.innerHTML = cdRoomOptions(cur); } }); }); }, 0); } catch(e){}
    document.querySelectorAll('.ed-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const body = document.getElementById('ed-body');
    if (!body) return;
    if (tab === 'rileva') body.innerHTML = editorRenderRileva();
    if (tab.indexOf('sez') === 0 && tab !== 'sezioni') { body.innerHTML = editorRenderSezioni(); edFilterSez(body, parseInt(tab.slice(3), 10)); }
    if (tab === 'sost')   body.innerHTML = editorRenderSost();
    if (tab === 'load') { var dmLoad=globalThis.DashboardModernModules; if(dmLoad&&dmLoad.render&&dmLoad.render.mountLoadsEditor) dmLoad.render.mountLoadsEditor(body); else throw new Error('Editor canonico Carichi non caricato'); }
    if (tab === 'visib') body.innerHTML = editorRenderVisib();
    if (tab === 'pool') body.innerHTML = cdSecToggleHtml('piscina') + editorRenderPiscina();
    if (tab === 'irr') body.innerHTML = cdSecToggleHtml('irrigazione') + editorRenderIrrigazione();
    if (tab === 'tapp') body.innerHTML = cdSecToggleHtml('tapparelle') + editorRenderTapparelle();
    if (tab === 'stanze') body.innerHTML = editorRenderStanze();
    if (tab === 'luci')   body.innerHTML = editorRenderLuci();
    if (tab === 'appliances') { body.innerHTML = cdSecToggleHtml('appliances') + editorRenderAppliances() + '<button class="ed-btn-add" style="width:100%; margin-top:10px;" onclick="edSecSave()">💾 Salva sezione</button>'; try { edApplRenderEnts(); } catch(e){} }
    if (tab === 'avvisi') { body.innerHTML = editorRenderAvvisi(); try { edAvvRenderEnts(); } catch(e){} }
    if (tab === 'testi')  body.innerHTML = editorRenderTesti();
    if (tab === 'hide')   body.innerHTML = editorRenderHide();
    if (tab === 'export') body.innerHTML = editorRenderExport();
    try { var dmMount=globalThis.DashboardModernModules; if(dmMount&&dmMount.render) dmMount.render.mountCurrentEditor(tab, body); } catch(e){}
}

/* ─────────── TAB 1: SOSTITUZIONI (override entity) ─────────── */
function editorRenderSost() {
    const rows = Object.entries(ENTITY_OVERRIDES).map(([o, n]) => `
      <div class="ed-row">
        <div class="ed-row-main">
          <div class="ed-row-old">${o}</div>
          <div class="ed-row-new">→ ${n}</div>
        </div>
        <div class="ed-del" onclick="edDelOverride('${o}')">🗑️</div>
      </div>`).join('') || '<div class="ed-empty">Nessuna sostituzione attiva</div>';
    return `
      <div class="ed-intro">Sostituisci un'entità usata dalla dashboard con un'altra, ovunque essa compaia (card, popup, storico, comandi). Utile se cambi una presa smart o un sensore.</div>
      <div class="ed-list">${rows}</div>
      <div class="ed-form">
        <div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-ov-old" style="flex:1;" class="ed-input mono" placeholder="Entità attuale (in dashboard)"><button type="button" onclick="wzPickEntity('#ed-ov-old')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>
        <div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-ov-new" style="flex:1;" class="ed-input mono" placeholder="Nuova entità (sostituto)"><button type="button" onclick="wzPickEntity('#ed-ov-new')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>
        <button class="ed-btn-add" onclick="edAddOverride()">＋ Aggiungi sostituzione</button>
      </div>`;
}
function edAddOverride() {
    const o = (document.getElementById('ed-ov-old').value||'').trim();
    const n = (document.getElementById('ed-ov-new').value||'').trim();
    if (!o.includes('.') || !n.includes('.')) { alert('Inserisci due entity_id validi (dominio.nome)'); return; }
    ENTITY_OVERRIDES[o] = n;
    localStorage.setItem('cd_entity_overrides', JSON.stringify(ENTITY_OVERRIDES));
    editorSwitch('sost');
    edToast('Sostituzione aggiunta');
}
function edDelOverride(o) {
    delete ENTITY_OVERRIDES[o];
    localStorage.setItem('cd_entity_overrides', JSON.stringify(ENTITY_OVERRIDES));
    editorSwitch('sost');
}

/* ─────────── TAB 2: CARICHI ─────────── */
function edGetExtra(key) { return cdCfg(key); }
/* v295: le voci del Report Analisi vengono dalla lista libera dell'utente */
function buildReportSelect() {
    const sel = document.getElementById('ed-dev-selector');
    if (!sel) return;
    if (typeof ED_DEVICES !== 'undefined' && ED_DEVICES.length) {
        sel.innerHTML = ED_DEVICES.map(d => `<option value="${d.sensor}">${d.icon || '⚡'} ${d.name}</option>`).join('');
        return;
    }
    const runtimeError = window.__DM_REPORT_RUNTIME_ERROR__;
    sel.innerHTML = `<option value="">${runtimeError ? '⚠️ ' + runtimeError : '— No Report items configured —'}</option>`;
}
document.addEventListener('DOMContentLoaded', buildReportSelect);


/* Legacy Loads/Report CRUD removed in 0.14.0; migration is in migrations.js. */
function edAddLuce() {
    var _luRoomEl = document.getElementById('ed-lu-room'); var _luRoom = _luRoomEl ? (_luRoomEl.value||'').trim() : ''; var _luName = (document.getElementById('ed-lu-name').value || '').trim(); const nm = (_luRoom && _luName && _luName.indexOf(' - ')===-1) ? (_luRoom + ' - ' + _luName) : _luName;
    const id = (document.getElementById('ed-lu-ent').value || '').trim();
    if (!nm || !/^(light|switch|group|input_boolean|fan)\./.test(id)) { alert('Enter a name and a valid entity (e.g. light.living or switch.kitchen)'); return; }
    let L = {}; try { L = JSON.parse(localStorage.getItem('cd_luci')) || {}; } catch(e) {}
    L[id] = nm;
    localStorage.setItem('cd_luci', JSON.stringify(L));
    try { LUCI_NAMES[id] = nm; if (GRUPPI_MONITORAGGIO.luci && !GRUPPI_MONITORAGGIO.luci.includes(id)) GRUPPI_MONITORAGGIO.luci.push(id); } catch(e) {}
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('sezioni');
    edToast('Light added');
}

function edDelLuce(id) {
    let L = {}; try { L = JSON.parse(localStorage.getItem('cd_luci')) || {}; } catch(e) {}
    delete L[id];
    localStorage.setItem('cd_luci', JSON.stringify(L));
    try { delete LUCI_NAMES[id]; if (GRUPPI_MONITORAGGIO.luci) GRUPPI_MONITORAGGIO.luci = GRUPPI_MONITORAGGIO.luci.filter(x => x !== id); } catch(e) {}
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('sezioni');
    edToast('Light removed');
}

function edMoveStanza(i, dir) {
    const rooms = getStanze().slice(); // v305: la lista mostrata (anche baked/sync), non solo localStorage
    const j = i + dir;
    if (j < 0 || j >= rooms.length) return;
    [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
    localStorage.setItem('cd_stanze', JSON.stringify(rooms));
    try { cdMarkDirty(); } catch(e){}
    buildTempCards();
    editorSwitch('sezioni');
}

function edEditStanza2(i) {
    const r = getStanze()[i]; // v305: coerente con la lista mostrata
    if (!r) return;
    if (!document.getElementById('ed-st2-name')) { alert('Apri l\'accordion Rooms per modificare'); return; }
    document.getElementById('ed-st2-name').value = r.name || '';
    document.getElementById('ed-st2-icon').value = r.icon || '';
    document.getElementById('ed-st2-floor').value = r.floor || '';
    try { const _fm = cdCfg('cd_floor_icons'); const _fi = document.getElementById('ed-st2-flicon'); if (_fi) _fi.value = (r.floor && _fm[r.floor]) || ''; } catch(e) {}
    document.getElementById('ed-st2-temp').value = r.temp || '';
    document.getElementById('ed-st2-hum').value = r.hum || '';
    window._edEditStanzaIdx = i;
    const btn = document.getElementById('ed-st2-btn') || document.querySelector('[onclick="edAddStanza2()"]');
    if (btn) btn.textContent = '💾 Save changes';
    const inp = document.getElementById('ed-st2-name');
    if (inp) { const det = inp.closest('details'); if (det) det.open = true; try { inp.scrollIntoView({ block: 'center' }); } catch(e) {} try { inp.focus(); } catch(e) {} }
}

function edDelStanza2(i) {
    const rooms = getStanze().slice();
    rooms.splice(i, 1);
    localStorage.setItem('cd_stanze', JSON.stringify(rooms));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    buildTempCards();
    editorSwitch('sezioni');
    edToast('Room removed');
}

function edAddStanza2() {
    if (typeof window._edEditStanzaIdx === 'number') {
        const rooms = getStanze().slice();
        const r = rooms[window._edEditStanzaIdx];
        if (r) {
            r.name = (document.getElementById('ed-st2-name').value || r.name).trim();
            r.icon = (document.getElementById('ed-st2-icon').value || r.icon).trim();
            r.temp = (document.getElementById('ed-st2-temp').value || r.temp).trim();
            const h = (document.getElementById('ed-st2-hum').value || '').trim();
            if (h) r.hum = h; else delete r.hum;
            const fl = (document.getElementById('ed-st2-floor').value || '').trim();
            if (fl) r.floor = fl; else delete r.floor;
            edSaveFloorIcon(fl);
            localStorage.setItem('cd_stanze', JSON.stringify(rooms));
        }
        delete window._edEditStanzaIdx;
        try { cdMarkDirty(); cdSyncPush(); } catch(e){}
        buildTempCards();
        editorSwitch('sezioni');
        edToast('Room updated');
        return;
    }
    const name = (document.getElementById('ed-st2-name').value || '').trim();
    const icon = (document.getElementById('ed-st2-icon').value || '🌡️').trim();
    const temp = (document.getElementById('ed-st2-temp').value || '').trim();
    const hum = (document.getElementById('ed-st2-hum').value || '').trim();
    const floor = (document.getElementById('ed-st2-floor').value || '').trim();
    if (!name || !temp.includes('.')) { alert('Enter a name and temperature sensor'); return; }
    const rooms = cdCfgList('cd_stanze');
    const r = { name, icon, temp };
    if (hum) r.hum = hum;
    if (floor) r.floor = floor;
    edSaveFloorIcon(floor);
    var _ex = -1; for (var _q = 0; _q < rooms.length; _q++) { if (rooms[_q] && rooms[_q].name === name) { _ex = _q; break; } }
    if (_ex >= 0) { rooms[_ex].temp = temp; if (hum) rooms[_ex].hum = hum; else delete rooms[_ex].hum; if (floor) rooms[_ex].floor = floor; } else { rooms.push(r); }
    localStorage.setItem('cd_stanze', JSON.stringify(rooms));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    buildTempCards();
    editorSwitch('sezioni');
    edToast('Room added');
}

function edAddReportDevice2() {
    const name = (document.getElementById('ed-rep2-name').value || '').trim();
    const icon = (document.getElementById('ed-rep2-icon').value || '⚡').trim();
    const ent = (document.getElementById('ed-rep2-ent').value || '').trim();
    if (!name || !ent.includes('.')) { alert('Enter a name and entity'); return; }
    const devs = cdCfgList('cd_report_devices');
    devs.push({ name, icon, entity: ent });
    localStorage.setItem('cd_report_devices', JSON.stringify(devs));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    buildReportSelect();
    try { cdRebuildReportDevices(); } catch(e){}
    editorSwitch('sezioni');
    edToast('Report entry added');
}

function edDelReportDevice(i) {
    const devs = cdCfgList('cd_report_devices');
    devs.splice(i, 1);
    localStorage.setItem('cd_report_devices', JSON.stringify(devs));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    buildReportSelect();
    try { cdRebuildReportDevices(); } catch(e){}
    editorSwitch('load');
    edToast('Report entry removed');
}

function edSaveFlowNodes() {
    const fn = {};
    ['lav','cuc','boiler','wb','clima'].forEach(k => {
        const icon = (document.getElementById('ed-fn-'+k+'-icon').value || '').trim();
        const name = (document.getElementById('ed-fn-'+k+'-name').value || '').trim();
        const group = document.getElementById('ed-fn-'+k+'-group').value;
        const pwr = (document.getElementById('ed-fn-'+k+'-pwr').value || '').trim();
        if (icon || name || pwr || group) fn[k] = { icon, name, group, pwr };
    });
    localStorage.setItem('cd_flow_nodes', JSON.stringify(fn));
    try { cdMarkDirty(); } catch(e){}
    edToast('Nodi mappa salvati');
}

function edAddLoadGroup() {
    const name = (document.getElementById('ed-lg-name').value || '').trim();
    const icon = (document.getElementById('ed-lg-icon').value || '🔌').trim();
    if (!name) { alert('Name the group'); return; }
    const groups = cdCfgList('cd_subload_groups');
    const id = 'cl_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (groups.some(g => g.id === id) || SUBLOADS_CONFIG[id]) { alert('A group with this name already exists'); return; }
    groups.push({ id, name, icon });
    localStorage.setItem('cd_subload_groups', JSON.stringify(groups));
    SUBLOADS_CONFIG[id] = { title: name, icon, items: [], custom: true };
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    buildCustomLoadCards();
    editorSwitch('load');
    edToast('Group created — now add loads below');
}

function edDelLoadGroup(i) {
    const groups = cdCfgList('cd_subload_groups');
    const g = groups[i];
    if (!g) return;
    if (!confirm('Delete group "' + g.name + '" and its loads?')) return;
    groups.splice(i, 1);
    localStorage.setItem('cd_subload_groups', JSON.stringify(groups));
    const ext = edGetExtra('cd_subloads_extra');
    delete ext[g.id];
    localStorage.setItem('cd_subloads_extra', JSON.stringify(ext));
    delete SUBLOADS_CONFIG[g.id];
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    buildCustomLoadCards();
    editorSwitch('load');
    edToast('Group deleted');
}

function edDelLoad(grp, i) {
    const ext = edGetExtra('cd_subloads_extra');
    if (ext[grp]) { ext[grp].splice(i,1); localStorage.setItem('cd_subloads_extra', JSON.stringify(ext)); }
    editorSwitch('load');
}

/* ─────────── TAB 3: AVVISI ─────────── */
/* ═══════════════════ TAB LUCI — stanze + raggruppamento + riordino (v0.9.0) ═══════════════════ */
/* Modello dati:
   cd_luci            {id: nome}                        (esistente)
   cd_luci_rooms      {id: "NomeStanza"}                (assegnazione luce → stanza)
   cd_luci_order      {stanza: [id, id, ...]}           (ordine luci dentro ogni stanza)
   cd_luci_room_order ["Room1","Room2",...]         (ordine delle stanze)
   Le luci senza stanza finiscono nel gruppo speciale "Altre zone". */

function cdLuciRoomsCfg()  { try { return JSON.parse(localStorage.getItem('cd_luci_rooms'))  || {}; } catch(e) { return {}; } }
function cdLuciOrderCfg()  { try { return JSON.parse(localStorage.getItem('cd_luci_order'))  || {}; } catch(e) { return {}; } }
function cdLuciRoomOrder() { try { return JSON.parse(localStorage.getItem('cd_luci_room_order')) || []; } catch(e) { return []; } }

/* Room assegnata a una luce: esplicita (cd_luci_rooms) o dedotta dal prefisso "Room - " */
function cdLightRoom(id) {
    const rooms = cdLuciRoomsCfg();
    if (rooms[id]) return rooms[id];
    const nm = (cdCfg('cd_luci') || {})[id] || (STATES[id] && STATES[id].attributes && STATES[id].attributes.friendly_name) || id;
    const di = nm.indexOf(' - ');
    return di > -1 ? nm.substring(0, di).trim() : '';
}

/* Elenco stanze note (ordine salvato + eventuali nuove), sempre con "Altre zone" in coda */
function cdLuciRoomList() {
    const set = [];
    cdLuciRoomOrder().forEach(r => { if (r && !set.includes(r)) set.push(r); });
    const rooms = cdLuciRoomsCfg();
    Object.values(rooms).forEach(r => { if (r && !set.includes(r)) set.push(r); });
    Object.keys(cdCfg('cd_luci') || {}).forEach(id => { const r = cdLightRoom(id); if (r && !set.includes(r)) set.push(r); });
    try { (typeof getStanze==='function'?getStanze():[]).forEach(r => { if (r && r.name && !set.includes(r.name)) set.push(r.name); }); } catch(e) {} return set;
}

function cdDbgStatus(){ try { return '<div class="ed-intro mono" style="font-size:11px;opacity:0.75;">v'+(typeof DASHBOARD_VERSION==='undefined'?'?':DASHBOARD_VERSION)+' | hosted:'+(window.__DASHBOARDMODERN_HOSTED__?1:0)+' | bridge:'+(window.__DASHBOARDMODERN_BRIDGED__?1:0)+' | token:'+(window.__DASHBOARDMODERN_REAL_TOKEN__?1:0)+' | sync:'+(localStorage.getItem('cd_sync_ts')||0)+' | inst:'+String(window.__DASHBOARDMODERN_STORAGE_NS__||'-').slice(0,10)+' | prim:'+(window.__DASHBOARDMODERN_PRIMARY__===false?0:1)+' | q:'+String(location.search||'').slice(0,18)+' | key:'+(('dashboardmodern_integration_config' + (window.__DASHBOARDMODERN_PRIMARY__===false && window.__DASHBOARDMODERN_INSTANCE__ ? '__'+String(window.__DASHBOARDMODERN_INSTANCE__).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,16) : ''))).slice(-14)+'</div>'; } catch(e){ return ''; } } function cdNavDiag(){ try { var mp=cdNavVisMap(); var cur=cdCfg('cd_sections')||{}; var L=[]; L.push('ver=0.12.1-int url='+location.pathname.slice(-46)); L.push('inst='+String(window.__DASHBOARDMODERN_STORAGE_NS__||'-').slice(0,12)+' prim='+(window.__DASHBOARDMODERN_PRIMARY__===false?0:1)); L.push('secboot='+(window.__CD_SBRUN||0)+' navvis='+(window.__CD_NVRUN||0)); L.push('cd_sections='+String(localStorage.getItem('cd_sections'))); Object.keys(mp).forEach(function(k){ var sel='.tab[data-tab="'+mp[k]+'"]'; var els=document.querySelectorAll(sel); var pg=document.getElementById('page-'+mp[k]); var st=els.length?getComputedStyle(els[0]).display:'-'; L.push(k+': cfg='+String(cur[k])+' tabs='+els.length+' disp='+st+' page='+(pg?1:0)); }); try { var st3=cdSecLS('cd_stanze')||[]; var wt=st3.filter(function(r){ return r&&r.temp; }); L.push('stanze='+st3.length+' con-temp='+wt.length+' CD_TEMP_FLOOR='+String(typeof CD_TEMP_FLOOR!=='undefined'?CD_TEMP_FLOOR:'?')); var g3=document.getElementById('temp-grid'); var errT=''; try { buildTempCards(); } catch(eT){ errT=eT.message; } L.push('temp-grid='+(g3?g3.children.length:'assente')+(errT?' ERR='+errT:'')); } catch(eX){ L.push('temp-diag-err'); } try { var ap3=cdCfgList('cd_appliances'); ap3.forEach(function(a){ if(!a) return; var ents=(a.entities||[]); var hasE=false; ents.forEach(function(en2){ var s4=STATES[en2]||{}; var at=(s4.attributes||{}); if(at.device_class==='energy'||/wh$/i.test(String(at.unit_of_measurement||''))) hasE=true; }); L.push('appl '+(a.name||'?')+': ents='+ents.length+' kwh='+(hasE?1:0)); }); } catch(eY){ L.push('appl-diag-err'); } var rep=L.join('\n'); try { console.log('[NavDiag]\n'+rep); } catch(e2){} prompt('Diagnosi navbar (tieni premuto per copiare)', rep); } catch(e){ alert('diag err: '+e.message); } } function editorRenderRileva(){ var st=cdDbgStatus(); st+='<button class="ed-btn-add" style="width:100%; margin:6px 0 10px;" onclick="cdNavDiag()">🧪 Diagnosi navbar</button>'; return st+'<div class="ed-intro">🪄 <b>Autorilevamento</b>: analizza tutte le entità di Home Assistant e compila da solo luci, clima, stanze, telecamere e collegamenti. Puoi correggere tutto dopo nelle altre schede.</div>'+'<button class="ed-btn-add" style="width:100%;" onclick="edAutoRileva()">🪄 Avvia autorilevamento</button>'+'<div id="ed-rileva-out" style="margin-top:10px;"></div>'+'<div style="margin-top:22px;border-top:1px solid rgba(220,38,38,0.3);padding-top:12px;"><button class="ed-btn-add" style="width:100%;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;" onclick="wzResetAll()">🗑️ Reset totale configurazione</button></div>'; } function edAutoRilevaLog(t){ var o=document.getElementById('ed-rileva-out'); if(o) o.innerHTML='<div class="ed-intro">'+t+'</div>'; } function edAutoRileva(){ try { apriSetupWizard(); var wz=document.getElementById('setup-wizard'); if(wz) wz.remove(); } catch(e){} edAutoRilevaLog('⏳ Carico tutte le entità da Home Assistant…'); try { wzLoadAllEntities(); } catch(e){} var tries=0; var t=setInterval(function(){ tries++; if (typeof WIZ!=='undefined' && WIZ && WIZ.allMeta && WIZ.allMeta.length){ clearInterval(t); try { wzAutoDetect(); } catch(e){ edAutoRilevaLog('❌ '+e.message); return; } try { if (WIZ.luci && Object.keys(WIZ.luci).length) localStorage.setItem('cd_luci', JSON.stringify(WIZ.luci)); if (WIZ.stanze && WIZ.stanze.length) localStorage.setItem('cd_stanze', JSON.stringify(WIZ.stanze)); if (WIZ.climaUnits && WIZ.climaUnits.length) localStorage.setItem('cd_clima_units', JSON.stringify(WIZ.climaUnits)); if (WIZ.cameras && WIZ.cameras.length) localStorage.setItem('cd_cameras', JSON.stringify(WIZ.cameras)); if (WIZ.entities && Object.keys(WIZ.entities).length){ var ov={}; try{ ov=JSON.parse(localStorage.getItem('cd_entity_overrides'))||{}; }catch(e){} Object.keys(WIZ.entities).forEach(function(k){ ov[k]=WIZ.entities[k]; }); localStorage.setItem('cd_entity_overrides', JSON.stringify(ov)); } try{ cdMarkDirty(); cdSyncPush(); }catch(e){} edAutoRilevaLog('✅ Rilevate: '+Object.keys(WIZ.luci||{}).length+' luci · '+(WIZ.stanze||[]).length+' stanze · '+(WIZ.climaUnits||[]).length+' clima · '+(WIZ.cameras||[]).length+' camere · '+Object.keys(WIZ.entities||{}).length+' entità.<br>Ricarico…'); cdRegEnrich(function(){ setTimeout(function(){ location.reload(); }, 400); }); } catch(e){ edAutoRilevaLog('❌ '+e.message); } } else if (tries>40){ clearInterval(t); edAutoRilevaLog('❌ Timeout nel caricamento entità. Riprova.'); } }, 500); } function cdVisibSez(){ return [['home','🏠','Home','Meteo, avvisi, azioni rapide'],['energy','⚡','Energy','Fotovoltaico e consumi'],['ev','🚗','Auto elettrica','EV + wallbox (EVCC)'],['boiler','🌞','Solare termico','Boiler solare'],['clima','❄️','Clima','Condizionatori e riscaldamento'],['temp','🌡️','Temperatura','Temperature e umidità'],['security','🛡️','Sicurezza','Cameras e allarme'],['server','🖥️','MiniPC','Monitoraggio server']]; } function e2Gen(v){ return String(v||'').replace(/'/g,'&#39;'); } function cdGenHtml(){ var br=cdCfg('cd_branding')||{}; var cn2=cdCfg('cd_connection')||{}; var adm=(cn2.admin_users&&cn2.admin_users[0])||''; return "<div class='ed-intro'><b>Generali</b>: nome della dashboard e utente amministratore.</div>" +"<input id='ed-gen-title' class='ed-input' style='margin-bottom:8px;' placeholder='Nome dashboard (es. SMART HOME)' value='"+e2Gen(br.title)+"'>" +"<input id='ed-gen-sub' class='ed-input' style='margin-bottom:8px;' placeholder='Sottotitolo' value='"+e2Gen(br.subtitle)+"'>" +"<input id='ed-gen-admin' class='ed-input' style='margin-bottom:8px;' placeholder='Utente admin (vuoto = Config visibile a tutti)' value='"+e2Gen(adm)+"'>" +"<button class='ed-btn-add' style='width:100%;margin-bottom:16px;' onclick='edSaveGeneral()'>💾 Salva generali</button>"; } function cdEvCarsHtml(){ var cars=getEvCars(); var act=cdEvActive(); var rows = cars.length ? cars.map(function(c,i){ return '<div class="ed-row" style="align-items:center;"><div class="ed-row-main"><div class="ed-row-new">🚗 '+String(c.name||('Auto '+(i+1))).replace(/</g,'&lt;')+(i===act?' <span class="pool-badge">✓ attiva</span>':'')+'</div><div class="ed-row-old">'+Object.keys(c.ov||{}).length+' entità mappate</div></div><button class="ed-btn-add" style="flex:0 0 auto; margin-right:6px;" data-act="use" data-idx="'+i+'" onclick="cdEvCarBtn(this)">Usa</button><div class="ed-del" data-act="del" data-idx="'+i+'" onclick="cdEvCarBtn(this)">🗑️</div></div>'; }).join('') : '<div class="ed-intro">Nessun profilo auto salvato.</div>'; var sel2 = cars.length ? '<select class="ed-input" style="width:100%; margin:8px 0;" onchange="cdEvCarSelEd(this)">'+'<option value="">— Scegli un profilo da modificare —</option>'+cars.map(function(c,i){ return '<option value="'+i+'"'+(i===act?' selected':'')+'>🚗 '+String(c.name||('Auto '+(i+1))).replace(/</g,'&lt;')+'</option>'; }).join('')+'</select>' : ''; return sel2+'<div class="ed-intro" style="margin-top:16px;">🚗 <b>Auto elettriche</b>: mappa le entità EV come sempre, poi salvale come profilo. Con due o più profili, nella pagina Auto compare la tendina per scegliere quale vedere.</div>'+rows+'<div style="display:flex; gap:8px; margin:8px 0 16px;"><input id="ed-evcar-name" class="ed-input" style="flex:1; margin:0;" placeholder="Nome auto (es. Leapmotor B10)"><button class="ed-btn-add" style="flex:0 0 auto;" onclick="edEvCarAdd()">＋ Salva attuale</button></div>'; } function edEvCarAdd(){ var n=(document.getElementById('ed-evcar-name').value||'').trim(); if(!n){ alert('Dai un nome al profilo auto'); return; } var prof=cdEvCaptureProfile(); if(!Object.keys(prof.ov).length){ alert('Nessuna entità EV mappata da salvare: mappa prima le entità della sezione Auto'); return; } var cars=getEvCars(); var found=-1; for(var ci=0;ci<cars.length;ci++){ if(cars[ci] && cars[ci].name===n){ found=ci; break; } } if(found>=0){ cars[found]={ name:n, ov:prof.ov, img:prof.img }; localStorage.setItem('cd_ev_car_active', String(found)); } else { cars.push({ name:n, ov:prof.ov, img:prof.img }); localStorage.setItem('cd_ev_car_active', String(cars.length-1)); } saveEvCars(cars); editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib'); } function cdEvCarSelEd(sel){ try { var i=parseInt(sel.value,10); if(isNaN(i)) return; cdEvApplyCar(i); try { editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'sez2'); } catch(e2){} } catch(e){} } function cdEvCarBtn(btn){ try { var act=btn.getAttribute('data-act'); var i=parseInt(btn.getAttribute('data-idx')||'-1',10); if(act==='use'){ cdEvApplyCar(i); } else { var cars=getEvCars(); cars.splice(i,1); saveEvCars(cars); var a=cdEvActive(); if(a===i) localStorage.setItem('cd_ev_car_active','-1'); else if(a>i) localStorage.setItem('cd_ev_car_active', String(a-1)); } editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib'); } catch(e){} } function cdEnViewsHtml(){ var lst=cdEnList(); var cur=getEnViews(); var rows=lst.map(function(x,idx){ var k=x[0]; var on=(cur[k]!==false); return '<div class="ed-row" style="align-items:center;"><div class="ed-row-main"><div class="ed-row-new">'+x[1]+' '+x[2]+'</div></div><div onclick="edEnViewToggle('+idx+')" style="cursor:pointer;flex:0 0 52px;height:30px;border-radius:15px;background:'+(on?'#0ea5e9':'#cbd5e1')+';position:relative;transition:.2s;"><div style="position:absolute;top:3px;'+(on?'right:3px':'left:3px')+';width:24px;height:24px;border-radius:50%;background:#fff;"></div></div></div>'; }).join(''); return '<div class="ed-intro" style="margin-top:16px;">⚡ <b>Sezione Energy</b>: scegli quali viste mostrare. Chi non ha il fotovoltaico può tenere solo il Report; con la sola pinza sui consumi la mappa flussi nasconde da sola solare e batteria non mappati.</div>'+rows; } function edEnViewToggle(idx){ var lst=cdEnList(); var x=lst[idx]; if(!x) return; var k=x[0]; var cur=getEnViews(); cur[k]=(cur[k]===false); localStorage.setItem('cd_energy_views', JSON.stringify(cur)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} try{ cdApplyEnergyViews(); }catch(e){} editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib'); } function cdSecKeyByOrd(n){ return ['home','energy','ev','boiler','security','','server','temp','','clima',''][n]||''; } function cdSecToggleHtml(k){ if(!k) return ''; var cur=cdCfg('cd_sections')||{}; var on=(cur[k]!==false); return '<button class="ed-btn-add" style="width:100%; margin:10px 0; background:'+(on?'linear-gradient(135deg,#10b981,#047857)':'linear-gradient(135deg,#94a3b8,#64748b)')+'; color:#fff;" data-key="'+k+'" onclick="edSecTog(this)">'+(on?'🟢 Sezione visibile in dashboard — tocca per nascondere':'⚪ Sezione nascosta — tocca per mostrare')+'</button>'; } function edSecTog(btn){ try { var k=btn.getAttribute('data-key'); if(!k) return; var cur=cdCfg('cd_sections')||{}; cur[k]=(cur[k]===false); localStorage.setItem('cd_sections', JSON.stringify(cur)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { cdApplyNavVis(); } catch(e2){} try { if(typeof render==='function') render(); } catch(e2){} try { buildTempCards(); } catch(e2){} editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib'); } catch(e){} } function edSecSave(){ try { cdMarkDirty(); cdSyncPush(); } catch(e){} try { edToast('Sezione salvata'); } catch(e){} } function edCostSplit(el, mode){ try { var kids=Array.prototype.slice.call(el.children); var start=-1; for(var i=0;i<kids.length;i++){ var t=(kids[i].textContent||''); if(t.indexOf('Costo energia')!==-1||t.indexOf('Energy cost')!==-1){ start=i; break; } } if(start<0) return null; if(mode==='hide'){ for(var j=start;j<kids.length;j++) kids[j].style.display='none'; return null; } var frag=document.createElement('div'); for(var k2=start;k2<kids.length;k2++) frag.appendChild(kids[k2]); return frag; } catch(e){ return null; } } function edFilterSez(el, n){ try { var ds=el.querySelectorAll('details.ed-acc'); for (var i=0;i<ds.length;i++){ var alsoN=(n===4)?10:-1; if(i===n||i===alsoN){ ds[i].open=true; } else { ds[i].style.display='none'; } } var it=el.querySelector('.ed-intro'); if(it && !it.closest('details')) it.style.display='none'; var extra=''; var k=cdSecKeyByOrd(n); if(k) extra+=cdSecToggleHtml(k); if(n===2){ try { extra+=cdEvCarsHtml(); } catch(e2){} }  if(extra){ var w=document.createElement('div'); w.innerHTML=extra; el.insertBefore(w, el.firstChild); } if(n===0){ ['dm.home_interruttore_antifurto','dm.home_script_apertura_cancello'].forEach(function(rf){ var inp=el.querySelector('input[data-ref="'+rf+'"]'); var blk=inp && (inp.closest('.ed-slot')||inp.parentElement); if(blk) blk.style.display='none'; }); }  try { el.querySelectorAll('input.ed-slot-in').forEach(function(inp){ var nx=inp.nextElementSibling; if(nx && nx.tagName==='BUTTON') return; var b=document.createElement('button'); b.type='button'; b.textContent='🔍'; b.className='dm-entity-picker'; b.onclick=function(){ try { wzPickEntity(inp.getAttribute('data-ref')||inp); } catch(e2){} }; var par=inp.parentElement; if(par){ par.style.display='flex'; par.style.gap='6px'; inp.style.flex='1'; } inp.insertAdjacentElement('afterend', b); }); } catch(eL){} if(n>=7){ var sv=document.createElement('div'); sv.innerHTML='<button class="ed-btn-add" style="width:100%; margin-top:10px;" onclick="edSecSave()">💾 Salva sezione</button>'; el.appendChild(sv); } } catch(e){} } function cdNavOrderHtml(){ try { var tabs=cdNavTabs(); if(!tabs.length) return ''; var lbl={}; tabs.forEach(function(t){ lbl[t.k]=t.lbl; }); var keys=cdNavKeys(); var rows=keys.map(function(k,i){ return '<div class="ed-row" style="align-items:center;"><div style="display:flex; gap:4px;"><div class="ed-del" style="'+(i===0?'opacity:0.25;pointer-events:none;':'')+'" data-i="'+i+'" data-d="-1" onclick="edNavMove(this)">▲</div><div class="ed-del" style="'+(i===keys.length-1?'opacity:0.25;pointer-events:none;':'')+'" data-i="'+i+'" data-d="1" onclick="edNavMove(this)">▼</div></div><div class="ed-row-main"><div class="ed-row-new">'+String(lbl[k]||k).replace(/</g,'&lt;')+'</div></div></div>'; }).join(''); return '<div class="ed-intro" style="margin-top:16px;"><b>Ordine navbar</b>: disponi le sezioni della barra come preferisci.</div>'+rows; } catch(e){ return ''; } } function edNavMove(btn){ try { var i=parseInt(btn.getAttribute('data-i'),10); var d=parseInt(btn.getAttribute('data-d'),10); var keys=cdNavKeys(); var j=i+d; if(isNaN(i)||isNaN(d)||j<0||j>=keys.length) return; var t=keys[i]; keys[i]=keys[j]; keys[j]=t; localStorage.setItem('cd_navbar_order', JSON.stringify(keys)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} cdApplyNavOrder(); editorSwitch('visib'); } catch(e){} } function cdLuceRen(id){ try { var luci=cdCfg('cd_luci')||{}; var cur=luci[id]||id; var n=prompt('Nome luce', cur); if(n===null) return; n=String(n).trim(); if(!n) return; luci[id]=n; localStorage.setItem('cd_luci', JSON.stringify(luci)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { if(typeof updateGestioneLuci==='function') updateGestioneLuci(); } catch(e2){} editorSwitch('luci'); } catch(e){} } function cdLuceDel(id){ try { if(!confirm('Rimuovere questa luce dalla dashboard?')) return; var luci=cdCfg('cd_luci')||{}; delete luci[id]; localStorage.setItem('cd_luci', JSON.stringify(luci)); var rooms=cdCfg('cd_luci_rooms')||{}; if(rooms[id]!==undefined){ delete rooms[id]; localStorage.setItem('cd_luci_rooms', JSON.stringify(rooms)); } try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { if(typeof updateGestioneLuci==='function') updateGestioneLuci(); } catch(e2){} editorSwitch('luci'); } catch(e){} } function cdLuceAdd(){ try { var e1=document.getElementById('luce-add-ent'); var n1=document.getElementById('luce-add-name'); var ent=(e1&&e1.value||'').trim(); if(ent.indexOf('.')<0){ alert('Inserisci una entità light/switch valida'); return; } var nm=(n1&&n1.value||'').trim()||ent.split('.')[1]; var luci=cdCfg('cd_luci')||{}; luci[ent]=nm; localStorage.setItem('cd_luci', JSON.stringify(luci)); try { cdMarkDirty(); cdSyncPush(); } catch(e2){} try { cdSecShow('home'); } catch(e2){} editorSwitch('luci'); edToast('Luce aggiunta'); } catch(e){} } function edSaveGeneral(){ var t=(document.getElementById('ed-gen-title').value||'').trim(); var st2=(document.getElementById('ed-gen-sub').value||'').trim(); var a=(document.getElementById('ed-gen-admin').value||'').trim(); var br=cdCfg('cd_branding')||{}; if(t) br.title=t; else delete br.title; if(st2) br.subtitle=st2; else delete br.subtitle; localStorage.setItem('cd_branding', JSON.stringify(br)); var cn=cdCfg('cd_connection')||{}; cn.admin_users = a ? [a] : []; localStorage.setItem('cd_connection', JSON.stringify(cn)); try{ cdMarkDirty(); cdSyncPush(); }catch(e){} try{ edToast('Salvato'); }catch(e){} setTimeout(function(){ location.reload(); }, 700); } function editorRenderVisib(){ var sez=cdVisibSez(); var cur=cdCfg('cd_sections')||{}; var rows=sez.map(function(x,idx){ var k=x[0]; var on=(cur[k]!==false); return '<div class="ed-row" style="align-items:center;"><div class="ed-row-main"><div class="ed-row-new">'+x[1]+' '+x[2]+'</div><div class="ed-row-old">'+x[3]+'</div></div><div onclick="edVisibToggle('+idx+')" style="cursor:pointer;flex:0 0 52px;height:30px;border-radius:15px;background:'+(on?'#0ea5e9':'#cbd5e1')+';position:relative;transition:.2s;"><div style="position:absolute;top:3px;'+(on?'right:3px':'left:3px')+';width:24px;height:24px;border-radius:50%;background:#fff;"></div></div></div>'; }).join(''); var _rl2=''; try { _rl2=editorRenderRileva(); } catch(e) {} return cdGenHtml()+cdNavOrderHtml()+'<div class="ed-intro" style="margin-top:18px;"><b>Rilevamento e manutenzione</b>: autorilevamento entità e reset.</div>'+_rl2+'<div style="display:none;">'+'<div class="ed-intro">Attiva o disattiva intere <b>sezioni</b> della dashboard. Le sezioni disattivate spariscono dalla vista.</div><div class="ed-list">'+rows+'</div>'; } function edVisibToggle(idx){ var sez=cdVisibSez(); var x=sez[idx]; if(!x) return; var k=x[0]; setTimeout(function(){ try { cdApplyNavVis(); } catch(e){} }, 50); var cur=cdCfg('cd_sections')||{}; cur[k]=(cur[k]===false); localStorage.setItem('cd_sections', JSON.stringify(cur)); try { cdMarkDirty(); cdSyncPush(); } catch(e){} try { if(typeof render==='function') render(); } catch(e){} editorSwitch((typeof EDITOR_TAB !== 'undefined' && EDITOR_TAB) ? EDITOR_TAB : 'visib'); } function editorRenderPiscina(){ var o=getPool(); return '<div class="ed-intro">Gestione <b>piscina</b>: sensori, comandi e filtrazione automatica giornaliera. In modalità auto le ore di filtrazione sono temperatura/2 (min 2, max 12).</div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-temp" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="sensor.piscina_temperatura" value="'+String(o.tempEnt||'')+'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-ph" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="sensor.piscina_ph (facoltativo)" value="'+String(o.phEnt||'')+'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-cl" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="sensor.piscina_cloro (facoltativo)" value="'+String(o.clEnt||'')+'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-pump" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="switch.pompa_piscina" value="'+String(o.pumpEnt||'')+'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-heat" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="switch.riscaldamento_piscina (facoltativo)" value="'+String(o.heatEnt||'')+'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-light" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="light.piscina (facoltativo)" value="'+String(o.lightEnt||'')+'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div class="ed-intro">Soglie qualità (avvisi) e filtrazione.</div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-phmin" type="number" step="0.1" class="ed-input" style="flex:1; margin:0;" title="pH minimo" value="'+(o.phMin!=null?o.phMin:7.0)+'"><input id="ed-pl-phmax" type="number" step="0.1" class="ed-input" style="flex:1; margin:0;" title="pH massimo" value="'+(o.phMax!=null?o.phMax:7.6)+'"></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-clmin" type="number" step="0.1" class="ed-input" style="flex:1; margin:0;" title="Cloro minimo" placeholder="Cloro min" value="'+(o.clMin!=null?o.clMin:'')+'"><input id="ed-pl-clmax" type="number" step="0.1" class="ed-input" style="flex:1; margin:0;" title="Cloro massimo" placeholder="Cloro max" value="'+(o.clMax!=null?o.clMax:'')+'"></div>'+'<label class="ed-intro" style="display:flex; gap:8px; align-items:center;"><input id="ed-pl-auto" type="checkbox" '+(o.autoHours?'checked':'')+'> Ore automatiche (temperatura/2)</label>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-pl-hours" type="number" min="1" max="24" class="ed-input" style="flex:1; margin:0;" title="Ore fisse" value="'+(+o.filterHours||8)+'"><input id="ed-pl-time" type="time" class="ed-input" style="flex:1; margin:0;" value="'+(o.filterStart||'09:00')+'"></div>'+'<label class="ed-intro" style="display:flex; gap:8px; align-items:center;"><input id="ed-pl-en" type="checkbox" '+(o.enabled?'checked':'')+'> Filtrazione giornaliera attiva (col tablet acceso)</label>'+'<button class="ed-btn-add" style="width:100%;" onclick="edPoolSaveCfg()">💾 Salva piscina</button>'; } function edPoolSaveCfg(){ var o=getPool(); o.tempEnt=(document.getElementById('ed-pl-temp').value||'').trim(); o.phEnt=(document.getElementById('ed-pl-ph').value||'').trim(); o.clEnt=(document.getElementById('ed-pl-cl').value||'').trim(); o.pumpEnt=(document.getElementById('ed-pl-pump').value||'').trim(); o.heatEnt=(document.getElementById('ed-pl-heat').value||'').trim(); o.lightEnt=(document.getElementById('ed-pl-light').value||'').trim(); var a=parseFloat(document.getElementById('ed-pl-phmin').value); o.phMin=isNaN(a)?7.0:a; var b=parseFloat(document.getElementById('ed-pl-phmax').value); o.phMax=isNaN(b)?7.6:b; var c=parseFloat(document.getElementById('ed-pl-clmin').value); o.clMin=isNaN(c)?null:c; var d2=parseFloat(document.getElementById('ed-pl-clmax').value); o.clMax=isNaN(d2)?null:d2; o.autoHours=!!document.getElementById('ed-pl-auto').checked; var h=parseFloat(document.getElementById('ed-pl-hours').value); o.filterHours=(isNaN(h)||h<=0)?8:h; o.filterStart=(document.getElementById('ed-pl-time').value||'09:00'); o.enabled=!!document.getElementById('ed-pl-en').checked; savePool(o); try{ renderPiscina(); }catch(ex){} try{ edToast('Piscina salvata'); }catch(ex){} editorSwitch('pool'); } function editorRenderIrrigazione(){ var o=getIrr(); var rows = o.zones.length ? o.zones.map(function(z,i){ var fl=cdRoomFloorOf(z.room||''); return '<div class="ed-row" style="align-items:center;"><div class="ed-row-main"><div class="ed-row-new">🌱 '+String(z.name||z.entity).replace(/</g,'&lt;')+' · '+(parseFloat(z.mins)||10)+' min</div><div class="ed-row-old">'+((z.room?('🏠 '+z.room):'')+(fl?(' · 🏢 '+fl):''))+'</div></div><div class="ed-del" onclick="edIrrDel('+i+')">🗑️</div></div>'; }).join('') : '<div class="ed-intro">Nessuna zona. Aggiungine una qui sotto.</div>'; return '<div class="ed-intro">Zone di <b>irrigazione</b> (switch o valve). Il programma le avvia in sequenza, ognuna per la sua durata, e salta quando la probabilità di pioggia supera la soglia.</div>'+rows+'<input id="ed-irr-name" class="ed-input" style="margin:8px 0;" placeholder="Nome zona (es. Prato davanti)">'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-irr-ent" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="switch.irrigazione_zona1"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><select id="ed-irr-room" class="ed-input" style="flex:1; margin:0;">'+cdRoomOptions('')+'</select><input id="ed-irr-min" type="number" min="1" max="180" value="10" class="ed-input" style="flex:0 0 90px; margin:0;" title="Duration (minuti)"></div>'+'<button class="ed-btn-add" style="width:100%; margin-bottom:16px;" onclick="edIrrAddZone()">＋ Aggiungi zona</button>'+'<div class="ed-intro"><b>Meteo e programma</b>: sensore % pioggia, soglia, meteo (facoltativo) e orario di avvio.</div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-irr-rain" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="sensor.prob_pioggia_oggi (%)\\" value="'+String(o.rainEnt||'')+'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-irr-weather" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="weather.casa (facoltativo)\\" value="'+String(o.weatherEnt||'')+'"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-irr-thr" type="number" min="0" max="100" value="'+(+o.rainThr||60)+'" class="ed-input" style="flex:1; margin:0;" title="Soglia pioggia %"><input id="ed-irr-time" type="time" value="'+(o.time||'06:30')+'" class="ed-input" style="flex:1; margin:0;"></div>'+'<label class="ed-intro" style="display:flex; gap:8px; align-items:center;"><input id="ed-irr-en" type="checkbox" '+(o.enabled?'checked':'')+'> Programma attivo (ogni giorno, col tablet acceso)</label>'+'<button class="ed-btn-add" style="width:100%;" onclick="edIrrSaveCfg()">💾 Salva impostazioni</button>'; } function edIrrAddZone(){ var n=(document.getElementById('ed-irr-name').value||'').trim(); var e=(document.getElementById('ed-irr-ent').value||'').trim(); var r=(document.getElementById('ed-irr-room').value||'').trim(); var m=parseFloat(document.getElementById('ed-irr-min').value); if(!e || e.indexOf('.')<0){ alert('Inserisci una entità valida (switch o valve)'); return; } var o=getIrr(); var z={ name:n||e, entity:e, mins:(isNaN(m)||m<=0)?10:m }; if(r) z.room=r; o.zones.push(z); saveIrr(o); try{ renderIrrigazione(); }catch(ex){} editorSwitch('irr'); } function edIrrDel(i){ var o=getIrr(); o.zones.splice(i,1); saveIrr(o); try{ renderIrrigazione(); }catch(ex){} editorSwitch('irr'); } function edIrrSaveCfg(){ var o=getIrr(); o.rainEnt=(document.getElementById('ed-irr-rain').value||'').trim(); o.weatherEnt=(document.getElementById('ed-irr-weather').value||'').trim(); var t=parseFloat(document.getElementById('ed-irr-thr').value); o.rainThr=(isNaN(t)||t<0)?60:Math.min(100,t); o.time=(document.getElementById('ed-irr-time').value||'06:30'); o.enabled=!!document.getElementById('ed-irr-en').checked; saveIrr(o); try{ renderIrrigazione(); }catch(ex){} try{ edToast('Impostazioni irrigazione salvate'); }catch(ex){} editorSwitch('irr'); } function editorRenderTapparelle(){ var list=getTapparelle(); var rows = list.length ? list.map(function(t,i){ var fl=cdRoomFloorOf(t.room||''); return '<div class="ed-row" style="align-items:center;"><div class="ed-row-main"><div class="ed-row-new">🪟 '+String(t.name||t.entity).replace(/</g,'&lt;')+'</div><div class="ed-row-old">'+((t.room?('🏠 '+t.room):'')+(fl?(' · 🏢 '+fl):''))+'</div></div><div class="ed-del" onclick="edTappDel('+i+')">🗑️</div></div>'; }).join('') : '<div class="ed-intro">Nessuna tapparella. Aggiungine una qui sotto.</div>'; return '<div class="ed-intro">Gestisci le <b>tapparelle</b> (entità cover). Compaiono nella pagina 🪟 Tapparelle, raggruppate per piano e stanza.</div>'+rows+'<input id="ed-tp-name" class="ed-input" style="margin:8px 0;" placeholder="Nome (es. Tapparella salone)">'+'<div style="display:flex; gap:8px; margin-bottom:8px;"><input id="ed-tp-ent" class="ed-input mono" autocomplete="off" style="flex:1;" placeholder="cover.tapparella_x"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>'+'<select id="ed-tp-room" class="ed-input" style="margin-bottom:8px;">'+cdRoomOptions('')+'</select>'+'<button class="ed-btn-add" style="width:100%;" onclick="edTappAdd()">＋ Aggiungi tapparella</button>'; } function edTappAdd(){ var n=(document.getElementById('ed-tp-name').value||'').trim(); var e=(document.getElementById('ed-tp-ent').value||'').trim(); var r=(document.getElementById('ed-tp-room').value||'').trim(); if(!e || e.indexOf('.')<0){ alert('Inserisci una entità cover valida'); return; } var list=getTapparelle().slice(); var it={ name: n||e, entity: e }; if(r) it.room=r; list.push(it); localStorage.setItem('cd_tapparelle', JSON.stringify(list)); try{ cdMarkDirty(); cdSyncPush(); }catch(ex){} try{ renderTapparelle(); }catch(ex){} editorSwitch('tapp'); } function edTappDel(i){ var list=getTapparelle().slice(); list.splice(i,1); localStorage.setItem('cd_tapparelle', JSON.stringify(list)); try{ cdMarkDirty(); cdSyncPush(); }catch(ex){} try{ renderTapparelle(); }catch(ex){} editorSwitch('tapp'); } function editorRenderStanze(){ var rooms = (typeof getStanze==='function'?getStanze():[])||[]; var esc=function(x){return String(x==null?'':x).replace(/"/g,'&quot;');}; var rowsHtml = rooms.map(function(r,i){ return '<div class="ed-row"><div class="ed-row-main"><div class="ed-row-new">'+((r.icon?cdIconMarkup(r.icon,22)+' ':'🏠 ')+(r.name||'Room'))+'</div>'+(r.floor?'<div class="ed-row-old">🏢 '+r.floor+'</div>':'')+'</div>'+'<div class="ed-del" onclick="edStanzaRoomDel('+i+')" title="Elimina">🗑️</div></div>'; }).join('') || '<div class="ed-empty">No room. Aggiungine una qui sotto.</div>'; return '<div class="ed-intro">Gestisci qui le tue <b>stanze</b>. Ogni stanza creata qui compare nel menù a tendina di elettrodomestici, clima e telecamere. Per i sensori di temperatura usa la sezione dedicata.</div>'+'<div class="ed-list">'+rowsHtml+'</div>'+'<div class="ed-form">'+'<div style="display:flex;gap:8px;margin-bottom:8px;"><span id="ed-room-icon-preview" style="flex:0 0 34px;display:flex;align-items:center;justify-content:center;">🏠</span><input id="ed-room-icon" class="ed-input" style="flex:0 0 120px;text-align:center;" placeholder="mdi:sofa / 🏠" value="🏠" oninput="document.getElementById(&quot;ed-room-icon-preview&quot;).innerHTML=cdIconMarkup(this.value,26)"><button type="button" onclick="dmIconPicker(&quot;#ed-room-icon&quot;, &quot;rooms&quot;)" title="Selettore icone" style="flex:0 0 38px;border:0;border-radius:10px;cursor:pointer;">🎨</button><input id="ed-room-name" class="ed-input" style="flex:1;" placeholder="Nome stanza (es. Cucina)"></div><select id="ed-room-floor" class="ed-input" style="margin-bottom:8px;">'+cdFloorSelOptions()+'</select>'+'<button class="ed-btn-add" onclick="edStanzaRoomAdd()">＋ Aggiungi stanza</button>'+cdFloorRowsHtml()+''+'</div>'; } function edStanzaRoomAdd(){ var name=(document.getElementById('ed-room-name').value||'').trim(); if(!name){ alert('Inserisci il nome della stanza'); return; } var icon=(document.getElementById('ed-room-icon').value||'🏠').trim(); var floor=(document.getElementById('ed-room-floor').value||'').trim(); if(floor==='__new__') floor=''; var rooms=(typeof getStanze==='function'?getStanze():[]).slice(); var r={ id:'room_'+Date.now().toString(36), name:name, icon:icon }; if(floor) r.floor=floor; rooms.push(r); localStorage.setItem('cd_stanze', JSON.stringify(rooms)); try { cdMarkDirty(); cdSyncPush(); } catch(e){} try { buildTempCards(); } catch(e){} editorSwitch('stanze'); } function edStanzaRoomDel(i){ var rooms=(typeof getStanze==='function'?getStanze():[]).slice(); rooms.splice(i,1); localStorage.setItem('cd_stanze', JSON.stringify(rooms)); try { cdMarkDirty(); cdSyncPush(); } catch(e){} try { buildTempCards(); } catch(e){} editorSwitch('stanze'); } function editorRenderLuci() {
    const luci = cdCfg('cd_luci') || {};
    const ids = Object.keys(luci);
    if (!ids.length) {
        return `<div style="padding:20px; text-align:center; color:var(--text-dim,#64748b); font-size:13px;">
            💡 No lights configured.<br>Add lights from the setup wizard ("Lights" step), then come back here to organize them into rooms.
          </div>`;
    }
    const rooms = cdLuciRoomList();

    // raggruppo le luci per stanza rispettando l'ordine salvato
    const grouped = {};
    rooms.forEach(r => grouped[r] = []);
    grouped['__altre__'] = [];
    ids.forEach(id => { const r = cdLightRoom(id); (grouped[r] ? grouped[r] : grouped['__altre__']).push(id); });
    // ordino dentro ogni stanza
    const ord = cdLuciOrderCfg();
    Object.keys(grouped).forEach(r => {
        const savedOrder = ord[r === '__altre__' ? 'Altre zone' : r] || [];
        grouped[r].sort((a, b) => {
            const ia = savedOrder.indexOf(a), ib = savedOrder.indexOf(b);
            if (ia === -1 && ib === -1) return (luci[a]||'').localeCompare(luci[b]||'');
            if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
        });
    });

    const roomOptions = (sel) => ['<option value="">— Other zones —</option>']
        .concat(rooms.map(r => `<option value="${r.replace(/"/g,'&quot;')}" ${r === sel ? 'selected' : ''}>${r}</option>`))
        .join('');

    const lightRow = (id, room, idx, count) => {
        const nm = luci[id] || id;
        const dett = (() => { const di = nm.indexOf(' - '); return di > -1 ? nm.substring(di+3) : nm; })();
        return `<div class="ed-lrow" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:12px; background:rgba(148,163,184,0.07); margin-bottom:6px;">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <button class="ed-ord-btn" ${idx===0?'disabled':''} onclick="cdLuciMove('${id}', -1)" style="width:26px; height:22px; border:none; border-radius:6px; background:rgba(148,163,184,0.18); cursor:pointer; font-size:11px; ${idx===0?'opacity:0.3;':''}">▲</button>
              <button class="ed-ord-btn" ${idx===count-1?'disabled':''} onclick="cdLuciMove('${id}', 1)" style="width:26px; height:22px; border:none; border-radius:6px; background:rgba(148,163,184,0.18); cursor:pointer; font-size:11px; ${idx===count-1?'opacity:0.3;':''}">▼</button>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:800; font-size:12.5px; color:var(--text,#0f172a); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">💡 ${dett}</div>
              <div style="font-family:monospace; font-size:9.5px; color:var(--text-dim,#94a3b8); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${id}</div>
            </div>
            <select class="ed-input" style="flex:0 0 40%; font-size:11.5px; padding:6px;" onchange="cdLuciSetRoom('${id}', this.value)">${roomOptions(room)}</select> <button class="ed-ord-btn" title="Rinomina" onclick="cdLuceRen('${id}')" style="width:26px; height:22px; border:none; border-radius:6px; background:rgba(14,165,233,0.15); cursor:pointer; font-size:11px;">\u270f\ufe0f</button> <button class="ed-ord-btn" title="Elimina" onclick="cdLuceDel('${id}')" style="width:26px; height:22px; border:none; border-radius:6px; background:rgba(239,68,68,0.15); cursor:pointer; font-size:11px;">🗑️</button>
          </div>`;
    };

    let html = `<div style="font-size:12px; color:var(--text-dim,#64748b); margin-bottom:12px; line-height:1.5;">
        💡 Assign each light to a room and reorder with the arrows. Rooms and order are reflected in the <b>Lights</b> popup.
      </div>`;

    // Rooms are managed exclusively by the Rooms editor. Qui si salva solo
    // l’ordine di visualizzazione e l’assegnazione tramite room_id.
    html += `<div class="ed-intro dm-lights-room-notice">🏠 Create, rename and delete rooms only in the <b>Rooms</b> section. Here you can assign and reorder lights.</div>`;

    // Luci raggruppate
    rooms.forEach(r => {
        const list = grouped[r] || [];
        html += `<div style="margin-bottom:14px;">
            <div style="font-weight:900; font-size:12px; letter-spacing:0.5px; text-transform:uppercase; color:#0369a1; margin-bottom:6px;">🏠 ${r} <span style="color:var(--text-dim,#94a3b8); font-weight:700;">· ${list.length}</span></div>
            ${list.length ? list.map((id, i) => lightRow(id, r, i, list.length)).join('') : '<div style="font-size:11px; color:var(--text-dim,#94a3b8); padding:4px 10px;">No lights in this room.</div>'}
          </div>`;
    });
    // Altre zone
    const altre = grouped['__altre__'] || [];
    if (altre.length) {
        html += `<div style="margin-bottom:14px;">
            <div style="font-weight:900; font-size:12px; letter-spacing:0.5px; text-transform:uppercase; color:var(--text-dim,#64748b); margin-bottom:6px;">📦 Other zones <span style="font-weight:700;">· ${altre.length}</span></div>
            ${altre.map((id, i) => lightRow(id, '', i, altre.length)).join('')}
          </div>`;
    }

    html += `<button class="ed-save-btn" onclick="edToast('💾 Lights layout saved — reload to apply'); cdSyncPush && cdSyncPush();">💾 Save lights layout</button>`;
    html += `<div class="ed-form dm-light-add-form"><div class="ed-sec-title">＋ ADD LIGHT</div><div class="ed-form-row"><input id="luce-add-ent" class="ed-input mono" placeholder="light.living_room"><button type="button" class="dm-entity-picker" data-entity-target="luce-add-ent">🔍</button></div><input id="luce-add-name" class="ed-input" placeholder="Light name (optional)"><button class="ed-btn-add" onclick="cdLuceAdd()">＋ Add light</button></div>`;
    return html;
}

function cdLuciAddRoom() {
    const inp = document.getElementById('ed-new-luci-room');
    const name = (inp && inp.value || '').trim();
    if (!name) return;
    const order = cdLuciRoomOrder();
    if (!order.includes(name)) order.push(name);
    localStorage.setItem('cd_luci_room_order', JSON.stringify(order));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('luci');
}
function cdLuciRenameRoom(oldName, newName) {
    newName = (newName || '').trim();
    if (!newName || newName === oldName) return;
    const rooms = cdLuciRoomsCfg(); Object.keys(rooms).forEach(id => { if (rooms[id] === oldName) rooms[id] = newName; });
    localStorage.setItem('cd_luci_rooms', JSON.stringify(rooms));
    const order = cdLuciRoomOrder().map(r => r === oldName ? newName : r);
    localStorage.setItem('cd_luci_room_order', JSON.stringify(order));
    const ord = cdLuciOrderCfg(); if (ord[oldName]) { ord[newName] = ord[oldName]; delete ord[oldName]; localStorage.setItem('cd_luci_order', JSON.stringify(ord)); }
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('luci');
}
function cdLuciDeleteRoom(name) {
    const rooms = cdLuciRoomsCfg(); Object.keys(rooms).forEach(id => { if (rooms[id] === name) delete rooms[id]; });
    localStorage.setItem('cd_luci_rooms', JSON.stringify(rooms));
    localStorage.setItem('cd_luci_room_order', JSON.stringify(cdLuciRoomOrder().filter(r => r !== name)));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('luci');
}
function cdLuciRoomMove(idx, dir) {
    const order = cdLuciRoomList();
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    localStorage.setItem('cd_luci_room_order', JSON.stringify(order));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('luci');
}
function cdLuciSetRoom(id, room) {
    const rooms = cdLuciRoomsCfg();
    if (room) rooms[id] = room; else delete rooms[id];
    localStorage.setItem('cd_luci_rooms', JSON.stringify(rooms));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('luci');
}
function cdLuciMove(id, dir) {
    const room = cdLightRoom(id) || 'Altre zone';
    const key = room;
    // ricostruisco l'ordine attuale del gruppo di questa luce
    const luci = cdCfg('cd_luci') || {};
    const same = Object.keys(luci).filter(x => (cdLightRoom(x) || 'Altre zone') === (cdLightRoom(id) || 'Altre zone'));
    const ord = cdLuciOrderCfg();
    let cur = (ord[key] || []).filter(x => same.includes(x));
    same.forEach(x => { if (!cur.includes(x)) cur.push(x); });
    const i = cur.indexOf(id), j = i + dir;
    if (i === -1 || j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    ord[key] = cur;
    localStorage.setItem('cd_luci_order', JSON.stringify(ord));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('luci');
}



let _avvNewEntities = [];
let _avvEditIdx = null;
function editorRenderAvvisi() {
    const extN = edGetExtra('cd_avvisi_names_extra');
    const GRP_LBL = { win: '🚪 Aperture', batt: '🔋 Batterie', luci: '💡 Luci', clima: '❄️ Clima', risc: '🔥 Riscaldamento' };
    let rows = '';
    Object.entries(GRP_LBL).forEach(([grp, glbl]) => {
        (GRUPPI_MONITORAGGIO[grp] || []).forEach(id => {
            const nm = extN[id] || AVVISI_NAMES[id] || (STATES[id]?.attributes?.friendly_name) || id;
            rows += `<div class="ed-row">
              <div class="ed-row-main">
                <div class="ed-row-new">${nm}</div>
                <div class="ed-row-old mono">${glbl} · ${id}</div>
              </div>
              <div class="ed-del" onclick="edDelAvviso('${grp}','${id}')">🗑️</div>
            </div>`;
        });
    });
    /* v0.10.0 (#4): CUSTOM alerts — multiple entities, edit and manual state */
    const customList = cdCfgList('cd_avvisi_custom');
    if (customList.length) {
        const cinner = customList.map((a, i) => {
            const ents = a.entities || (a.entity ? [a.entity] : []);
            return `<div class="ed-row"><div class="ed-row-main"><div class="ed-row-new">${a.icon||'⚠️'} ${(a.name||ents[0]||'')} <span style="color:var(--text-dim,#94a3b8); font-size:11px; font-weight:700;">· ${cdAvvisoCondLabel(a)}${ents.length>1?' · '+ents.length+' entities':''}</span></div><div class="ed-row-old mono">${ents.join(', ')}</div></div><div class="ed-del" onclick="edEditAvvisoCustom(${i})" style="color:#0ea5e9;" title="Edit">✏️</div><div class="ed-del" onclick="edDelAvvisoCustom(${i})" title="Delete">🗑️</div></div>`;
        }).join('');
        rows += `<details class="ed-acc" open><summary class="ed-acc-head">⭐ Custom <span class="ed-acc-n">${customList.length}</span></summary><div class="ed-acc-body"><div class="ed-list">${cinner}</div></div></details>`;
    }
    if (!rows) rows = '<div class="ed-empty">No alerts configured</div>';
    const editing = (_avvEditIdx !== null && customList[_avvEditIdx]);
    const ed = editing ? customList[_avvEditIdx] : {};
    const esc = (x) => String(x == null ? '' : x).replace(/"/g, '&quot;');
    const cOpt = (v, l) => `<option value="${v}"${(editing && ed.cond === v) ? ' selected' : ''}>${l}</option>`;
    const showVal = editing && ['eq','neq','gt','lt'].includes(ed.cond);
    return `
      <div class="ed-intro">Add sensors to the Alerts Panel with a clean name, or create a <b>⭐ Custom</b> alert on one or <b>more entities</b>, with a condition, <b>manual state/value</b> and a chosen icon. Use ✏️ to <b>edit</b> an existing alert.</div>
      <div class="ed-list">${rows}</div>
      <div class="ed-form">
        <select id="ed-avv-grp" class="ed-input" onchange="var c=document.getElementById('ed-avv-custom'); if(c) c.style.display = this.value==='custom' ? 'block' : 'none';">
          <option value="win">🚪 Aperture (contact)</option>
          <option value="batt">🔋 Batterie (%)</option>
          <option value="luci">💡 Luci</option>
          <option value="clima">❄️ Climate</option>
          <option value="risc">🔥 Heating</option>
          <option value="tapp">🪟 Tapparelle (cover)</option><option value="custom"${editing ? ' selected' : ''}>⭐ Custom</option>
        </select>
        <div style="display:flex; gap:6px;"><input id="ed-avv-ent" class="ed-input mono" style="flex:1;" autocomplete="off" placeholder="binary_sensor.finestra_x_contact"><button type="button" onclick="wzPickEntity('#ed-avv-ent')" style="flex:0 0 40px; height:40px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
        <input id="ed-avv-name" class="ed-input" value="${editing ? esc(ed.name) : ''}" placeholder="Alert name (e.g. Open windows)">
        <div id="ed-avv-custom" style="display:${editing ? 'block' : 'none'};">
          <button type="button" class="ed-btn-add" style="background:linear-gradient(135deg,#0ea5e9,#0369a1); margin-bottom:8px;" onclick="edAvvAddEntity()">＋ Add this entity to the list</button>
          <div id="ed-avv-ents" style="margin-bottom:8px;"></div>
          <select id="ed-avv-cond" class="ed-input" onchange="var v=document.getElementById('ed-avv-val'); if(v) v.style.display = ['on','off'].includes(this.value) ? 'none' : 'block';">
            ${cOpt('on','On / Active / Open (on)')}
            ${cOpt('off','Off / Closed (off)')}
            ${cOpt('eq','Equal to… (manual state)')}
            ${cOpt('neq','Different from…')}
            ${cOpt('gt','Greater than…')}
            ${cOpt('lt','Less than…')}
          </select>
          <input id="ed-avv-val" class="ed-input" value="${editing ? esc(ed.value) : ''}" placeholder="manual state or value (e.g. heat, 23.5, open)" style="display:${showVal ? 'block' : 'none'};">
          <div style="display:flex; gap:6px;"><input id="ed-avv-icon" class="ed-input" style="flex:1;" value="${editing ? esc(ed.icon || '⚠️') : '⚠️'}" placeholder="Icon (e.g. ⚠️ 💧 🌡️)"><button type="button" onclick="dmIconPicker('#ed-avv-icon')" style="flex:0 0 40px; height:40px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
        </div>
        <button class="ed-btn-add" onclick="edAddAvviso()">${editing ? '💾 Save changes' : '＋ Add alert'}</button>
        ${editing ? '<button type="button" class="ed-btn-add" style="background:#94a3b8; margin-top:6px;" onclick="edAvvCancelEdit()">✖ Cancel edit</button>' : ''}
      </div>`;
}

function edAddAvviso() {
    const grp = document.getElementById('ed-avv-grp').value; if (grp === 'tapp') { const entT = (document.getElementById('ed-avv-ent').value||'').trim(); const nmT = (document.getElementById('ed-avv-name').value||'').trim(); if (!entT.includes('.')) { alert('Inserisci una entità cover valida'); return; } const itemT = { entities:[entT], name: nmT || entT, icon:'🪟', cond:'eq', value:'open' }; const listT = cdCfgList('cd_avvisi_custom'); listT.push(itemT); localStorage.setItem('cd_avvisi_custom', JSON.stringify(listT)); try { cdMarkDirty(); cdSyncPush(); } catch(e){} editorSwitch('avvisi'); edToast('Avviso tapparella aggiunto'); return; }
    const ent = (document.getElementById('ed-avv-ent').value||'').trim();
    const name = (document.getElementById('ed-avv-name').value||'').trim();
    if (grp === 'custom') {
        const cond  = (document.getElementById('ed-avv-cond') || {}).value || 'on';
        const value = ((document.getElementById('ed-avv-val') || {}).value || '').trim();
        const icon  = (((document.getElementById('ed-avv-icon') || {}).value) || '⚠️').trim() || '⚠️';
        const entities = _avvNewEntities.slice();
        if (ent.includes('.') && !entities.includes(ent)) entities.push(ent);
        if (!entities.length) { alert('Add at least one entity (press ➕ Add this entity to the list)'); return; }
        if (['eq','neq','gt','lt'].includes(cond) && value === '') { alert('Enter the state/value for the chosen condition'); return; }
        const item = { entities, name: name || entities[0], icon, cond, value };
        const list = cdCfgList('cd_avvisi_custom');
        const wasEdit = (_avvEditIdx !== null && list[_avvEditIdx]);
        if (wasEdit) list[_avvEditIdx] = item; else list.push(item);
        localStorage.setItem('cd_avvisi_custom', JSON.stringify(list));
        try { cdMarkDirty(); cdSyncPush(); } catch(e){}
        _avvEditIdx = null; _avvNewEntities = [];
        editorSwitch('avvisi');
        edToast(wasEdit ? 'Alert updated' : 'Custom alert added');
        return;
    }
    if (!ent.includes('.')) { alert('Enter a valid entity'); return; }
    const extG = edGetExtra('cd_gruppi_extra');
    if (!extG[grp]) extG[grp] = [];
    if (!extG[grp].includes(ent)) extG[grp].push(ent);
    localStorage.setItem('cd_gruppi_extra', JSON.stringify(extG));
    // v292 (issue #3): valido subito anche nel runtime — niente reload per vederlo
    if (GRUPPI_MONITORAGGIO[grp] && !GRUPPI_MONITORAGGIO[grp].includes(ent)) GRUPPI_MONITORAGGIO[grp].push(ent);
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    if (name) { const extN = edGetExtra('cd_avvisi_names_extra'); extN[ent] = name; localStorage.setItem('cd_avvisi_names_extra', JSON.stringify(extN)); }
    editorSwitch('avvisi');
    edToast('Avviso aggiunto');
}
function edDelAvviso(grp, id) {
    // Rimuovi dalle aggiunte utente se presente
    const extG = edGetExtra('cd_gruppi_extra');
    if (extG[grp] && extG[grp].includes(id)) {
        extG[grp] = extG[grp].filter(x => x !== id);
        if (!extG[grp].length) delete extG[grp];
        localStorage.setItem('cd_gruppi_extra', JSON.stringify(extG));
        if (GRUPPI_MONITORAGGIO[grp]) GRUPPI_MONITORAGGIO[grp] = GRUPPI_MONITORAGGIO[grp].filter(x => x !== id);
    } else {
        // È una voce di default: segna come rimossa
        const rem = edGetExtra('cd_gruppi_removed');
        if (!rem[grp]) rem[grp] = [];
        if (!rem[grp].includes(id)) rem[grp].push(id);
        localStorage.setItem('cd_gruppi_removed', JSON.stringify(rem));
    }
    // Applica subito in memoria
    if (GRUPPI_MONITORAGGIO[grp]) GRUPPI_MONITORAGGIO[grp] = GRUPPI_MONITORAGGIO[grp].filter(x => x !== id);
    editorSwitch('avvisi');
    edToast('Alert removed');
}
function edDelAvvisoCustom(i) {
    const list = cdCfgList('cd_avvisi_custom');
    if (i < 0 || i >= list.length) return;
    list.splice(i, 1);
    localStorage.setItem('cd_avvisi_custom', JSON.stringify(list));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    editorSwitch('avvisi');
    edToast('Alert removed');
}
function edAvvRenderEnts() {
    const box = document.getElementById('ed-avv-ents');
    if (!box) return;
    if (!_avvNewEntities.length) { box.innerHTML = '<div style="font-size:11px; color:var(--text-dim); font-weight:700; padding:2px 2px 0;">No entities in the list — type/pick an entity and press ➕</div>'; return; }
    box.innerHTML = _avvNewEntities.map((en, i) => `<span style="display:inline-flex; align-items:center; gap:7px; background:rgba(14,165,233,0.12); color:#0369a1; border-radius:100px; padding:5px 11px; font-size:11.5px; font-weight:800; margin:0 6px 6px 0; font-family:monospace;">${en}<span onclick="edAvvRemoveEntity(${i})" style="cursor:pointer; font-weight:900; font-family:sans-serif;">✕</span></span>`).join('');
}
function edAvvAddEntity() {
    const inp = document.getElementById('ed-avv-ent');
    const v = ((inp && inp.value) || '').trim();
    if (!v.includes('.')) { alert('Enter a valid entity'); return; }
    if (!_avvNewEntities.includes(v)) _avvNewEntities.push(v);
    if (inp) inp.value = '';
    edAvvRenderEnts();
}
function edAvvRemoveEntity(i) { _avvNewEntities.splice(i, 1); edAvvRenderEnts(); }
function edEditAvvisoCustom(i) {
    const list = cdCfgList('cd_avvisi_custom');
    const a = list[i]; if (!a) return;
    _avvEditIdx = i;
    _avvNewEntities = (a.entities || (a.entity ? [a.entity] : [])).slice();
    editorSwitch('avvisi');
    setTimeout(() => { const el = document.getElementById('ed-avv-cond'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 90);
}
function edAvvCancelEdit() { _avvEditIdx = null; _avvNewEntities = []; editorSwitch('avvisi'); }

/* ─────────── TAB 4: TESTI (rinomina qualsiasi etichetta visibile) ─────────── */
function editorRenderTesti() {
    const ext = edGetExtra('cd_text_overrides');
    const rows = Object.entries(ext).map(([o, n]) => `
      <div class="ed-row">
        <div class="ed-row-main">
          <div class="ed-row-old" style="text-decoration:line-through;">${o}</div>
          <div class="ed-row-new">→ ${n}</div>
        </div>
        <div class="ed-del" onclick="edDelText('${encodeURIComponent(o)}')">🗑️</div>
      </div>`).join('') || '<div class="ed-empty">Nessun testo modificato</div>';
    return `
      <div class="ed-intro">Rinomina qualsiasi etichetta/testo visibile nella dashboard. Scrivi il testo <b>esatto</b> attuale e il nuovo. Applica a tutte le occorrenze di quel testo.</div>
      <div class="ed-list">${rows}</div>
      <div class="ed-form">
        <input id="ed-txt-old" class="ed-input" placeholder="Testo attuale (esatto, es. Friggitrice)">
        <input id="ed-txt-new" class="ed-input" placeholder="Nuovo testo">
        <button class="ed-btn-add" onclick="edAddText()">＋ Rinomina</button>
      </div>`;
}
function edAddText() {
    const o = (document.getElementById('ed-txt-old').value||'').trim();
    const n = (document.getElementById('ed-txt-new').value||'').trim();
    if (!o || !n) { alert('Compila entrambi i campi'); return; }
    const ext = edGetExtra('cd_text_overrides');
    ext[o] = n;
    localStorage.setItem('cd_text_overrides', JSON.stringify(ext));
    applyTextOverrides();
    editorSwitch('testi');
    edToast('Testo rinominato');
}
function edDelText(oEnc) {
    const o = decodeURIComponent(oEnc);
    const ext = edGetExtra('cd_text_overrides');
    delete ext[o];
    localStorage.setItem('cd_text_overrides', JSON.stringify(ext));
    editorSwitch('testi');
    edToast('Rimosso — ricarica per ripristinare il testo originale');
}
/* Applica i rename testuali camminando i nodi di testo del DOM */
function applyTextOverrides() {
    const ext = edGetExtra('cd_text_overrides');
    const entries = Object.entries(ext);
    if (!entries.length) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
        // salta i nodi dentro l'editor stesso
        if (node.parentElement && node.parentElement.closest('#editor-modal')) return;
        let txt = node.nodeValue;
        entries.forEach(([o, n]) => { if (txt.includes(o)) txt = txt.split(o).join(n); });
        if (txt !== node.nodeValue) node.nodeValue = txt;
    });
}

/* ─────────── TAB 5: NASCONDI (toggle visibilità sezioni/card) ─────────── */
const EDITOR_HIDEABLE = [
    { sel: '#page-home .quadro-avvisi',        label: 'Home · Quadro Avvisi' },
    { sel: '#page-home .azioni-rapide',        label: 'Home · Azioni Rapide' },
    { sel: '#page-home .weather-hero',         label: 'Home · Meteo' },
    { sel: '#page-server .srv-tel-card',       label: 'MiniPC · Card Download/Upload' },
    { sel: '.temp-grid',                       label: 'Temperature · Griglia stanze' },
    { sel: '.ed-kpi-banner',                   label: 'Energy · Banner KPI' },
];
function editorRenderHide() {
    const hidden = edGetExtra('cd_hidden_elements');  // { sel: true }
    const rows = EDITOR_HIDEABLE.map(h => {
        const isHidden = !!hidden[h.sel];
        return `<div class="ed-row">
          <div class="ed-row-main"><div class="ed-row-new">${h.label}</div><div class="ed-row-old mono">${h.sel}</div></div>
          <div class="ed-toggle ${isHidden?'off':'on'}" onclick="edToggleHide('${encodeURIComponent(h.sel)}')">${isHidden?'Nascosto':'Visibile'}</div>
        </div>`;
    }).join('');
    return `
      <div class="ed-intro">Mostra o nascondi intere sezioni/card. Utile per semplificare la dashboard su alcuni dispositivi.</div>
      <div class="ed-list">${rows}</div>
      <div class="ed-note">Aggiungere altri elementi nascondibili richiede una piccola modifica al file (chiedi a Claude indicando quale sezione).</div>`;
}
function edToggleHide(selEnc) {
    const sel = decodeURIComponent(selEnc);
    const hidden = edGetExtra('cd_hidden_elements');
    if (hidden[sel]) delete hidden[sel]; else hidden[sel] = true;
    localStorage.setItem('cd_hidden_elements', JSON.stringify(hidden));
    applyHiddenElements();
    editorSwitch('hide');
}
function applyHiddenElements() {
    const hidden = edGetExtra('cd_hidden_elements');
    // prima ripristina tutto ciò che era marcato
    document.querySelectorAll('[data-ed-hidden="1"]').forEach(el => { el.style.display = ''; el.removeAttribute('data-ed-hidden'); });
    Object.keys(hidden).forEach(sel => {
        document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; el.setAttribute('data-ed-hidden','1'); });
    });
}

/* ─────────── TAB 6: ESPORTA / IMPORTA ─────────── */
function editorGetFullConfig() {
    return {
        entity_overrides:   edGetExtra('cd_entity_overrides'),
        subloads_extra:     edGetExtra('cd_subloads_extra'),
        gruppi_extra:       edGetExtra('cd_gruppi_extra'),
        avvisi_names_extra: edGetExtra('cd_avvisi_names_extra'),
        text_overrides:     edGetExtra('cd_text_overrides'),
        hidden_elements:    edGetExtra('cd_hidden_elements'),
    };
}

/* v255: scarica l'HTML con le personalizzazioni "cotte" dentro (permanenti, multi-dispositivo).
   Fa il fetch del file sorgente ORIGINALE (pulito), sostituisce il blocco CD_BAKED_CONFIG,
   e triggera il download con nome versione successiva. */
async function edDownloadHTML() { return cdBakeDownload(); } /* v0.8.8: unificata su cdBakeDownload (la vecchia regex poteva corrompere il file) */
function editorRenderExport() {
    const cfg = editorGetFullConfig();
    const json = JSON.stringify(cfg, null, 2);
    const count = Object.values(cfg).reduce((a,o)=>a+Object.keys(o||{}).length,0);
    return `
      <div class="ed-dl-hero">
        <div class="ed-dl-hero-txt">
          <div class="ed-dl-hero-title">💾 Download modified HTML</div>
          <div class="ed-dl-hero-sub">Genera il file con le tue <b>${count}</b> customizations permanently baked in. Then upload it to Home Assistant replacing the current file.</div>
        </div>
        <button class="ed-dl-btn" onclick="edDownloadHTML()">⬇ DOWNLOAD</button>
      </div>
      <div class="ed-intro" style="margin-top:18px;">In alternativa puoi copiare la configurazione come testo (JSON) e incollarla a Claude, oppure importarla su un altro dispositivo.</div>
      <textarea id="ed-export-box" class="ed-export" readonly>${json}</textarea>
      <div class="ed-form-row">
        <button class="ed-btn-add" style="flex:1;" onclick="edCopyExport()">📋 Copy configuration</button>
        <button class="ed-btn-reset" onclick="edResetAll()">Reset all</button>
      </div>
      <div class="ed-imp-title">🧙 Guided setup</div>
      <button class="ed-btn-add" style="margin-bottom:18px; width:100%;" onclick="document.getElementById('editor-modal').remove(); apriSetupWizard();">Reopen the Setup Wizard (connection · name · sections · lights)</button>
      <div class="ed-imp-title">📥 Import configuration</div>
      <textarea id="ed-import-box" class="ed-export" placeholder="Incolla qui un JSON di configurazione e premi Importa..."></textarea>
      <button class="ed-btn-add" onclick="edImport()">Import and apply</button>`;
}
function edCopyExport() {
    const box = document.getElementById('ed-export-box');
    box.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch(e){}
    if (!ok && navigator.clipboard) { navigator.clipboard.writeText(box.value).then(()=>edToast('Copiato!')).catch(()=>{}); }
    else edToast('Copiato negli appunti!');
}
function edImport() {
    const raw = (document.getElementById('ed-import-box').value||'').trim();
    if (!raw) { alert('Incolla prima un JSON'); return; }
    let cfg;
    try { cfg = JSON.parse(raw); } catch(e) { alert('JSON non valido: ' + e.message); return; }
    const map = {
        entity_overrides:'cd_entity_overrides', subloads_extra:'cd_subloads_extra', subload_groups:'cd_subload_groups', report_devices:'cd_report_devices', slot_labels:'cd_slot_labels', flow_nodes:'cd_flow_nodes',
        gruppi_extra:'cd_gruppi_extra', avvisi_names_extra:'cd_avvisi_names_extra',
        text_overrides:'cd_text_overrides', hidden_elements:'cd_hidden_elements'
    };
    Object.entries(map).forEach(([k, lsKey]) => { if (cfg[k]) localStorage.setItem(lsKey, JSON.stringify(cfg[k])); });
    edToast('Importato! Ricarico...');
    setTimeout(()=>location.reload(), 800);
}
function edResetAll() {
    if (!confirm('Rimuovere TUTTE le personalizzazioni di questo dispositivo?')) return;
    ['cd_connection','cd_branding','cd_sections','cd_section_names','cd_luci','cd_luci_rooms','cd_luci_order','cd_luci_room_order','cd_stanze','cd_cameras','cd_appliances','cd_clima_units','cd_quick_actions','cd_devices','cd_ev_image','cd_entity_overrides','cd_subloads_extra','cd_subload_groups','cd_report_devices','cd_tapparelle','cd_irrigazione','cd_piscina','cd_ev_cars','cd_energy_views','cd_navbar_order','cd_floors','cd_slot_labels','cd_flow_nodes','cd_gruppi_extra','cd_gruppi_removed','cd_avvisi_names_extra','cd_text_overrides','cd_hidden_elements'].forEach(k=>localStorage.removeItem(k));
    location.reload();
}

/* ─────────── Toast ─────────── */
let _cdSyncT = null;
function edToast(msg) {
    // v270: ogni modifica dall'editor viene sincronizzata su HA (debounce 2s)
    clearTimeout(_cdSyncT);
    try { cdMarkDirty(); } catch(e){}
    _cdSyncT = setTimeout(() => { try { cdSyncPush(); } catch(e){} }, 2000);
    let t = document.getElementById('ed-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ed-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'show';
    clearTimeout(window._edToastT);
    window._edToastT = setTimeout(()=>{ t.className = ''; }, 2200);
}

/* Applica testi e visibilità all'avvio (dopo il primo render) */
setTimeout(() => { try { applyTextOverrides(); applyHiddenElements(); } catch(e){} }, 1500);
setTimeout(() => { try { applyTextOverrides(); applyHiddenElements(); } catch(e){} }, 4000);
/* ═══════════════════════════════════════════════════════════════════
   v256: SETUP WIZARD — configurazione guidata da UI al primo avvio
   Step: 1 Connessione (token+test) · 2 Branding · 3 Sezioni · 4 Luci · Fine
   Salva in localStorage (cd_connection/cd_branding/cd_sections/cd_luci);
   il download HTML dall'editor le rende poi permanenti nel file.
   ═══════════════════════════════════════════════════════════════════ */
let WIZ = { step: (window.__DASHBOARDMODERN_HOSTED__ ? 2 : 1), token: '', title: '', subtitle: '', sections: {}, luci: {}, entities: [] };

function apriSetupWizard() {
    const old = document.getElementById('setup-wizard');
    if (old) old.remove();
    // Precompila con valori esistenti
    const conn = cdCfg('cd_connection'), brand = cdCfg('cd_branding'), sect = cdCfg('cd_sections'), luci = cdCfg('cd_luci');
    WIZ = {
        // Integration-hosted: the connection step has nothing left to ask,
        // so start at the first step that still needs the user.
        step: window.__DASHBOARDMODERN_HOSTED__ && conn.token ? 2 : 1,
        token: conn.token || (typeof LONG_LIVED_TOKEN !== 'undefined' ? LONG_LIVED_TOKEN : '') || '',
        remoteUrl: conn.remote_url || '',
        remoteUrl: conn.remote_url || '',
        title: brand.title || 'My Home',
        subtitle: brand.subtitle || 'Smart Home Dashboard',
        sections: Object.keys(sect||{}).length ? sect : { home:true, energy:true, ev:true, boiler:true, clima:true, temp:true, security:true, server:true },
        luci: Object.assign({}, Object.keys(luci||{}).length ? luci : (typeof LUCI_NAMES !== 'undefined' ? LUCI_NAMES : {})),
        entities: {},
        cameras: getCameras().slice(),
        climaUnits: getClimaUnits().slice(),
        stanze: getStanze().slice(),
        devices: getDevices().slice(),
        stanze: getStanze().slice(),
        devices: getDevices().slice(),
        quickActions: getQuickActions().slice(),
        sectionNames: cdCfg('cd_section_names') || {},
        evImage: (function(){ const v = cdCfg('cd_ev_image'); return (typeof v === 'string' ? v : (v && v.url) || ''); })()
    };
    const w = document.createElement('div');
    w.id = 'setup-wizard';
    w.innerHTML = '<div class="wz-card" id="wz-card"></div>';
    document.body.appendChild(w);
    wzRender();
}

function wzRender() {
    const card = document.getElementById('wz-card');
    if (!card) return;
    const steps = ['Connessione', 'Nome', 'Sezioni', 'Luci', 'Entità', 'Fine'];
    const dots = steps.map((s, i) => `<div class="wz-dot ${i+1 === WIZ.step ? 'active' : ''} ${i+1 < WIZ.step ? 'done' : ''}"></div>`).join('');
    let body = '';

    if (WIZ.step === 1) body = `
        <div class="wz-title">🔌 Connect Home Assistant</div>
        <div class="wz-sub">You need a <b>long-lived access token</b>:<br>
        1. Open HA → click your <b>user profile</b> (bottom left)<br>
        2. <b>Security</b> tab → at the bottom <b>"Long-lived access tokens"</b><br>
        3. <b>Createte token</b>, name it (e.g. "Dashboard") and paste it here:</div>
        <textarea id="wz-token" class="wz-input" rows="4" placeholder="Paste your token here (starts with eyJ...)">${WIZ.token}</textarea>
        <input id="wz-remote" class="wz-input mono" style="font-family:monospace; font-size:12px;" placeholder="Optional remote URL (e.g. https://xxxx.ui.nabu.casa)" value="${WIZ.remoteUrl||''}">
        <input id="wz-remote" class="wz-input" value="${WIZ.remoteUrl||''}" placeholder="URL remoto (opzionale, es. https://xxxx.ui.nabu.casa)" onchange="WIZ.remoteUrl=this.value.trim().replace(/\/$/,'');">
        <div id="wz-test-result"></div>
        <button class="wz-btn" onclick="wzTestToken()">Test connection →</button>`;

    if (WIZ.step === 2) body = `
        <div class="wz-title">🏠 What is your home called?</div>
        <div class="wz-sub">The name appears in the dashboard header.</div>
        <input id="wz-title-in" class="wz-input" value="${WIZ.title}" placeholder="My Home">
        <input id="wz-sub-in" class="wz-input" value="${WIZ.subtitle}" placeholder="Smart Home Dashboard">
        <div class="wz-sub" style="margin-top:8px;">👤 <b>Utente amministratore</b> (optional): solo questo utente HA vedrà la pagina ⚙️ Configurazione. Lascia vuoto per mostrarla a tutti.</div>
        <input id="wz-admin-in" class="wz-input" value="${WIZ.admin || getCurrentHassUser() || ''}" placeholder="es. Mario">
        <button class="wz-btn" onclick="WIZ.title=document.getElementById('wz-title-in').value.trim()||'My Home'; WIZ.subtitle=document.getElementById('wz-sub-in').value.trim(); WIZ.admin=document.getElementById('wz-admin-in').value.trim(); WIZ.step=3; wzRender();">Next →</button>`;

    if (WIZ.step === 3) {
        const sezioni = [
            ['home','🏠','Home','Weather, alerts, quick actions'], ['energy','⚡','Energy','Solar PV and consumption'],
            ['ev','🚗','Electric car','EV + wallbox (EVCC)'], ['boiler','🌞','Solar thermal','Solar water heater'],
            ['clima','❄️','Clima','Air conditioning and heating'], ['temp','🌡️','Rooms','Temperature and humidity'],
            ['security','🛡️','Security','Cameras and alarm'], ['server','🖥️','MiniPC','Server monitoring']
        ];
        body = `
        <div class="wz-title">📑 Which sections do you need?</div>
        <div class="wz-sub">Enable only the ones relevant to your home — you can change them later.</div>
        <div class="wz-sect-grid">${sezioni.map(([k,ic,nm,ds]) => `
          <div class="wz-sect ${WIZ.sections[k] !== false ? 'on' : ''}">
            <div class="wz-sect-ico" onclick="WIZ.sections['${k}'] = !(WIZ.sections['${k}'] !== false); wzRender();">${ic}</div>
            <div class="wz-sect-txt">
              ${WIZ.sections[k] !== false
                ? `<input class="wz-sect-rename" value="${(WIZ.sectionNames && WIZ.sectionNames[k]) || nm}" data-def="${nm}" onchange="if(!WIZ.sectionNames)WIZ.sectionNames={}; const v=this.value.trim(); if(v && v!==this.dataset.def) WIZ.sectionNames['${k}']=v; else delete WIZ.sectionNames['${k}'];">`
                : `<div class="wz-sect-nm">${nm}</div>`}
              <div class="wz-sect-ds">${ds}</div>
            </div>
            <div class="wz-check" onclick="WIZ.sections['${k}'] = !(WIZ.sections['${k}'] !== false); wzRender();">${WIZ.sections[k] !== false ? '✓' : ''}</div>
          </div>`).join('')}</div>
        <div style="margin-top:12px; padding:12px 14px; background:rgba(148,163,184,0.08); border-radius:14px;">
          <div style="font-weight:800; font-size:13px; margin-bottom:8px;">📌 Navigation bar</div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="wz-btn" style="flex:1; font-size:12.5px; ${(localStorage.getItem('cd_navbar_mode')||'auto') !== 'fixed' ? '' : 'background:#94a3b8;'}" onclick="wzSetNavMode('auto')">👆 Auto-hide</button>
            <button type="button" class="wz-btn" style="flex:1; font-size:12.5px; ${(localStorage.getItem('cd_navbar_mode')||'auto') === 'fixed' ? '' : 'background:#94a3b8;'}" onclick="wzSetNavMode('fixed')">📌 Always visible</button>
          </div>
          <div style="font-size:11px; color:var(--text-dim); margin-top:6px;">Auto-hide: appears with a swipe/tap on the handle. Fixed: always in view.</div>
        </div>
        <button class="wz-btn" style="background:linear-gradient(135deg,#059669,#10b981);" onclick="wzFinishV7(true)">🪄 Detect everything and open the editor →</button>
        <button class="wz-btn" style="background:#94a3b8; margin-top:8px;" onclick="wzFinishV7(false)">Skip detection →</button>
        <div style="font-size:11px; color:var(--text-dim); margin-top:8px; text-align:center;">The wizard ends here: lights, entities, rooms and everything else are configured in the editor — the same tool you will use for every future change.</div>`;
    }

    if (WIZ.step === 4) {
        const sel = Object.keys(WIZ.luci);
        body = `
        <div class="wz-title">💡 Choose your lights</div>
        <div class="wz-sub">Select the lights to manage and give each a name in the format <b>"Room - Dettaglio"</b> (enables automatic room grouping). <b>${sel.length}</b> selected.</div>
        <input class="wz-input" style="margin-bottom:8px;" placeholder="🔍 Search light… (name or entity)" value="${WIZ.lightsFilter||''}" oninput="WIZ.lightsFilter = this.value.trim().toLowerCase(); wzRenderLights();">
        <div class="wz-lights" id="wz-lights"><div class="wz-loading">Loading lights from your HA…</div></div>
        <button class="wz-btn" onclick="WIZ.step=5; wzRender();">Next →</button>`;
    }

    if (WIZ.step === 5) {
        // v258: configurazione entità per le sezioni ATTIVE, con etichette umane
        const active = Object.entries(CD_SLOTS).filter(([k]) => k === 'lavatrice' ? (WIZ.sections['home'] !== false) : (WIZ.sections[k] !== false));
        const acc = active.map(([key, sec]) => {
            const rows = sec.slots.map(sl => {
                const cur = (WIZ.entities && WIZ.entities[sl.ref]) || ENTITY_OVERRIDES[sl.ref] || '';
                const auto = WIZ.autoDetected && WIZ.autoDetected[sl.ref];
                return `<div class="ed-slot"><div class="ed-slot-lbl"><input class="wz-lbl-edit" value="${(cdCfg('cd_slot_labels')[sl.ref] || sl.lbl).replace(/"/g,'&quot;')}" onchange="wzRenameSlot('${sl.ref}', this.value)" title="Tap to rename">${auto ? ' <span style=\"background:#dcfce7; color:#15803d; font-size:9.5px; font-weight:800; padding:1px 7px; border-radius:8px; vertical-align:1px;\">🪄 auto</span>' : ''}</div>
                  <div style="display:flex; gap:6px; align-items:center;">
                    <input class="wz-input mono" style="margin-bottom:0; flex:1; font-family:monospace; font-size:11.5px; ${auto ? 'background:#f0fdf4; border-color:#86efac;' : ''}" autocomplete="off"
                           data-ref="${sl.ref}" value="${cur}" placeholder="es. dm.core_039" onchange="wzSetSlot(this); if(WIZ.autoDetected) delete WIZ.autoDetected[this.dataset.ref];">
                    <button type="button" onclick="wzPickEntity('${sl.ref}')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button>
                  </div></div>`;
            }).join('');
            const evImg = key === 'ev' ? `<div class="ed-slot"><div class="ed-slot-lbl">🖼️ Car image URL (e.g. /local/my_car.png)</div>
                  <input class="wz-input mono" style="margin-bottom:0; font-family:monospace; font-size:11.5px;" value="${WIZ.evImage||''}" placeholder="/local/mia_auto.png" onchange="WIZ.evImage = this.value.trim();"></div>` : '';
            const done = sec.slots.filter(sl => (WIZ.entities && WIZ.entities[sl.ref]) || ENTITY_OVERRIDES[sl.ref]).length;
            return `<details class="ed-acc"><summary class="ed-acc-head">${sec.label} <span class="ed-acc-n" style="${done ? 'background:#dcfce7; color:#166534;' : ''}">${done}/${sec.slots.length} linked</span></summary><div class="ed-acc-body">${rows}${evImg}</div></details>`;
        }).join('');
        const dl = '<datalist id="wz-entity-list">' + (WIZ.allEntities||[]).map(e => `<option value="${e}">`).join('') + '</datalist>';
        body = `
        <div class="wz-title">🧩 Link your entities</div>
        <button id="wz-autodetect" class="wz-btn" style="width:100%; margin-bottom:10px; background:linear-gradient(135deg,#10b981,#047857); color:#ffffff; font-weight:800; text-shadow:0 1px 2px rgba(0,0,0,0.25); border:none;" onclick="wzAutoDetect()" ${(WIZ.allMeta && WIZ.allMeta.length) ? '' : 'disabled style="width:100%; margin-bottom:10px; background:#94a3b8; color:#ffffff; font-weight:800; border:none;"'}>🪄 Auto-detect my entities</button>
        <div class="wz-sub">For each item enter <b>your</b> HA entity (autocomplete enabled). You can skip this step and finish later from <b>⚙️ Configurazione → Configure Entities → 📑 Sections</b>. Empty items will show "—".</div>
        ${dl}
        <div style="max-height:46vh; overflow-y:auto; margin-bottom:14px;">${acc}${WIZ.sections['home'] !== false ? `
        <details class="ed-acc"><summary class="ed-acc-head">⚡ Quick actions <span class="ed-acc-n">${(WIZ.quickActions||[]).length}</span></summary>
          <div class="ed-acc-body">
            ${(WIZ.quickActions||[]).map((a, i) => `<div class="ed-row"><div style="font-size:15px;">${a.icon||'⚡'}</div><div class="ed-row-main"><div class="ed-row-new">${a.name||a.builtin||'?'}</div><div class="ed-row-old mono">${a.type === 'luci_group' ? '💡 ' + ((a.lights||[]).length) + ' lights' : a.type}</div></div>${a.type === 'luci_group' ? `<div class="ed-del" style="background:rgba(14,165,233,0.12);" onclick="wzEditLightGroup(${i})">✏️</div>` : ''}<div class="ed-del" onclick="WIZ.quickActions.splice(${i},1); wzRender();">🗑️</div></div>`).join('')}
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <select id="wz-qa-type" class="wz-input" style="margin-bottom:0; flex:0 0 44%;" onchange="wzQaTypeChanged()">
                <option value="luci_group">💡 Lights popup — YOU pick the lights</option>
                <option value="builtin_luci">💡 Popup ALL lights</option><option value="builtin_clima">❄️ Popup Clima</option>
                <option value="builtin_antifurto">🛡️ Popup Antifurto</option><option value="builtin_lavatrice">🧺 Popup Lavatrice</option>
                <option value="toggle">🔀 Toggle entità</option><option value="script">📜 Script</option><option value="scene">🎬 Scena</option>
              </select>
              <input id="wz-qa-name" class="wz-input" style="margin-bottom:0; flex:1;" placeholder="Nome">
            </div>
            <div id="wz-qa-ent-row" style="display:none; gap:6px; margin-bottom:8px;">
              <input id="wz-qa-ent" class="wz-input mono" autocomplete="off" placeholder="dm.core_054 — the entity to control" style="margin-bottom:0; flex:1; font-family:monospace;">
              <button type="button" onclick="wzPickEntity('__qa__')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button>
            </div>
            <div id="wz-qa-hint" style="font-size:11.5px; color:var(--text-dim); margin-bottom:8px; padding:0 2px;">💡 Give it a name (e.g. "Ground Floor") and press Add: you will pick the lights from a searchable list.</div>
            <button class="ed-btn-add" style="width:100%;" onclick="wzAddQA()">＋ Aggiungi azione</button>
          </div>
        </details>` : ''}${WIZ.sections['home'] !== false ? `
        <details class="ed-acc"><summary class="ed-acc-head">🔔 Alerts Panel <span class="ed-acc-n">${(GRUPPI_MONITORAGGIO['win']||[]).length + (GRUPPI_MONITORAGGIO['batt']||[]).length + cdCfgList('cd_avvisi_custom').length}</span></summary>
          <div class="ed-acc-body">
            <div class="ed-slot-lbl" style="margin-bottom:4px;">Openings (doors/windows) and batteries monitored on Home. With <b>⭐ Custom</b> you can create an alert on any entity, with your own name, condition and icon.</div>
            ${['win','batt'].map(grp => (GRUPPI_MONITORAGGIO[grp]||[]).map(id => {
                const nm = cdCfg('cd_avvisi_names_extra')[id] || AVVISI_NAMES[id] || id;
                return `<div class="ed-row"><div style="font-size:15px;">${grp==='win'?'🚪':'🔋'}</div><div class="ed-row-main"><div class="ed-row-new">${nm}</div><div class="ed-row-old mono">${id}</div></div><div class="ed-del" onclick="wzDelAvviso('${grp}','${id}')">🗑️</div></div>`;
            }).join('')).join('')}
            ${cdCfgList('cd_avvisi_custom').map((a, i) => `<div class="ed-row"><div style="font-size:15px;">${a.icon||'⚠️'}</div><div class="ed-row-main"><div class="ed-row-new">${(a.name||a.entity)} <span style="font-weight:700; color:var(--text-dim,#94a3b8); font-size:10.5px;">· ${cdAvvisoCondLabel(a)}</span></div><div class="ed-row-old mono">${a.entity}</div></div><div class="ed-del" onclick="wzDelAvvisoCustom(${i})">🗑️</div></div>`).join('')}
            <div style="display:flex; gap:8px; margin-bottom:8px; margin-top:6px;">
              <select id="wz-av-grp" class="wz-input" style="margin-bottom:0; flex:0 0 46%;" onchange="var c=document.getElementById('wz-av-custom'); if(c) c.style.display = this.value==='custom' ? 'block' : 'none';"><option value="win">🚪 Opening</option><option value="batt">🔋 Battery</option><option value="tapp">🪟 Tapparelle (cover)</option><option value="custom">⭐ Custom</option></select>
              <input id="wz-av-name" class="wz-input" style="margin-bottom:0; flex:1;" placeholder="Name (e.g. Water leak)">
            </div>
            <div style="display:flex; gap:6px; margin-bottom:8px;"><input id="wz-av-ent" class="wz-input mono" autocomplete="off" placeholder="binary_sensor.finestra_studio_contact" style="margin-bottom:0; flex:1; font-family:monospace;"><button type="button" onclick="wzPickEntity('#wz-av-ent')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
            <div id="wz-av-custom" style="display:none; background:rgba(148,163,184,0.09); border-radius:12px; padding:10px; margin-bottom:8px;">
              <div class="ed-slot-lbl" style="margin-bottom:6px;">Show the alert when the entity is…</div>
              <div style="display:flex; gap:8px;">
                <select id="wz-av-cond" class="wz-input" style="margin-bottom:0; flex:1;" onchange="var v=document.getElementById('wz-av-val'); if(v) v.style.display = ['on','off'].includes(this.value) ? 'none' : 'block';">
                  <option value="on">On / Active / Open (on)</option>
                  <option value="off">Off / Closed (off)</option>
                  <option value="eq">Equal to…</option>
                  <option value="neq">Different from…</option>
                  <option value="gt">Greater than…</option>
                  <option value="lt">Less than…</option>
                </select>
                <input id="wz-av-val" class="wz-input" style="margin-bottom:0; flex:0 0 34%; display:none;" placeholder="value">
              </div>
              <div style="display:flex; gap:8px; margin-top:8px; align-items:center;">
                <span class="ed-slot-lbl" style="margin:0;">Icon</span>
                <input id="wz-av-icon" class="wz-input" style="margin-bottom:0; flex:0 0 74px; text-align:center; font-size:16px;" value="⚠️" placeholder="⚠️">
              </div>
            </div>
            <button class="ed-btn-add" style="width:100%;" onclick="wzAddAvviso()">＋ Add to Alerts Panel</button>
          </div>
        </details>` : ''}${WIZ.sections['home'] !== false ? `
        <details class="ed-acc"><summary class="ed-acc-head">🔌 Appliances (dishwasher, stove…) <span class="ed-acc-n">${(WIZ.devices||[]).length}</span></summary>
          <div class="ed-acc-body">
            ${(WIZ.devices||[]).map((d, i) => `<div class="ed-row"><div style="font-size:15px;">${d.icon||'🔌'}</div><div class="ed-row-main"><div class="ed-row-new">${d.name}</div><div class="ed-row-old mono">${[d.switch,d.power,d.sensor].filter(Boolean).join(' · ')}</div></div><div class="ed-del" onclick="WIZ.devices.splice(${i},1); wzRender();">🗑️</div></div>`).join('')}
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <input id="wz-dev-icon" class="wz-input" style="margin-bottom:0; flex:0 0 64px; text-align:center;" placeholder="🧺" maxlength="4">
              <input id="wz-dev-name" class="wz-input" style="margin-bottom:0; flex:1;" placeholder="Name (e.g. Dishwasher)">
            </div>
            <div style="display:flex; gap:6px; margin-bottom:8px;"><input id="wz-dev-sw" class="wz-input mono" autocomplete="off" placeholder="dm.core_052 (optional)" style="margin-bottom:0; flex:1; font-family:monospace;"><button type="button" onclick="wzPickEntity('#wz-dev-sw')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
            <div style="display:flex; gap:6px; margin-bottom:8px;"><input id="wz-dev-pw" class="wz-input mono" autocomplete="off" placeholder="dm.core_040 (optional)" style="margin-bottom:0; flex:1; font-family:monospace;"><button type="button" onclick="wzPickEntity('#wz-dev-pw')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
            <div style="display:flex; gap:6px; margin-bottom:8px;"><input id="wz-dev-sv" class="wz-input mono" autocomplete="off" placeholder="dm.core_038 (optional)" style="margin-bottom:0; flex:1; font-family:monospace;"><button type="button" onclick="wzPickEntity('#wz-dev-sv')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
            <button class="ed-btn-add" style="width:100%;" onclick="wzAddDevice()">＋ Add appliance</button>
          </div>
        </details>` : ''}${WIZ.sections['energy'] !== false ? `
        <details class="ed-acc"><summary class="ed-acc-head">📊 Analysis Report (per-device consumption) <span class="ed-acc-n">${(WIZ.reportDevices||[]).length}</span></summary>
          <div class="ed-acc-body">
            <div class="ed-slot-lbl" style="margin-bottom:6px;">The monthly Report entries in Energy → Analysis: name, icon and entity (monthly kWh) of your choice.</div>
            ${(WIZ.reportDevices||[]).map((d, i) => `<div class="ed-row"><div style="font-size:15px;">${d.icon||'⚡'}</div><div class="ed-row-main"><div class="ed-row-new">${d.name}</div><div class="ed-row-old mono">${d.entity}</div></div><div class="ed-del" onclick="WIZ.reportDevices.splice(${i},1); wzRender();">🗑️</div></div>`).join('')}
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <input id="wz-rep-icon" class="wz-input" style="flex:0 0 64px; margin-bottom:0;" placeholder="⚡" maxlength="4">
              <input id="wz-rep-name" class="wz-input" style="flex:1; margin-bottom:0;" placeholder="Name (e.g. Pool)">
            </div>
            <div style="display:flex; gap:6px; margin-bottom:8px;">
              <input id="wz-rep-ent" class="wz-input mono" autocomplete="off" placeholder="dm.core_028 (kWh)" style="margin-bottom:0; flex:1; font-family:monospace;">
              <button type="button" onclick="wzPickEntity('#wz-rep-ent')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button>
            </div>
            <button class="ed-btn-add" style="width:100%;" onclick="wzAddReportDevice()">＋ Add to Report</button>
          </div>
        </details>` : ''}${WIZ.sections['temp'] !== false ? `
        <details class="ed-acc"><summary class="ed-acc-head">🌡️ Temperatura <span class="ed-acc-n">${(WIZ.stanze||[]).length}</span></summary>
          <div class="ed-acc-body">
            ${(WIZ.stanze||[]).map((r, i) => !(r && r.temp) ? '' : `<div class="ed-row"><div style="display:flex; flex-direction:column; gap:2px;"><div class="ed-del" style="width:24px; height:20px; font-size:10px; ${i===0?'opacity:0.25; pointer-events:none;':''}" onclick="wzMoveStanza(${i},-1)">▲</div><div class="ed-del" style="width:24px; height:20px; font-size:10px; ${i===WIZ.stanze.length-1?'opacity:0.25; pointer-events:none;':''}" onclick="wzMoveStanza(${i},1)">▼</div></div><div style="font-size:15px;">${r.icon||'🏠'}</div><div class="ed-row-main"><div class="ed-row-new">${r.name}</div><div class="ed-row-old mono">${r.temp || ""}</div></div></div>`).join('')}
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <input id="wz-st-icon" class="wz-input" style="margin-bottom:0; flex:0 0 64px; text-align:center;" placeholder="🛋️" maxlength="4">
              <input id="wz-st-name" class="wz-input" style="margin-bottom:0; flex:1;" placeholder="Room name (es. Salone)">
              <input id="wz-st-floor" class="wz-input" style="margin-bottom:0; flex:0 0 34%;" placeholder="Floor (opt.)" autocomplete="off">
            </div>
            <div style="display:flex; gap:6px; margin-bottom:8px;"><input id="wz-st-temp" class="wz-input mono" autocomplete="off" placeholder="sensor.temperatura_salone (temperatura)" style="margin-bottom:0; flex:1; font-family:monospace;"><button type="button" onclick="wzPickEntity('#wz-st-temp')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
            <div style="display:flex; gap:6px; margin-bottom:8px;"><input id="wz-st-hum" class="wz-input mono" autocomplete="off" placeholder="sensor.umidita_salone (optional)" style="margin-bottom:0; flex:1; font-family:monospace;"><button type="button" onclick="wzPickEntity('#wz-st-hum')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
            <button class="ed-btn-add" style="width:100%;" onclick="wzAddStanza()" id="wz-st-add-btn">＋ Add room</button>
          </div>
        
          <div style="display:flex; gap:8px; margin:10px 0 8px;">
            <input id="ed-st2-icon" class="ed-input" style="flex:0 0 56px;" placeholder="🌡️" maxlength="4">
            <select id="ed-st2-name" class="ed-input" style="flex:1;"></select>
            <input id="ed-st2-floor" class="ed-input" style="flex:0 0 32%;" placeholder="Floor (opt.)"><input id="ed-st2-flicon" class="ed-input" style="flex:0 0 52px;" placeholder="🏢" maxlength="4" title="Floor icon"><button type="button" onclick="wzPickIcon('#ed-st2-flicon')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; font-size:16px; cursor:pointer;">😀</button>
          </div>
          <div style="display:flex; gap:6px; margin-bottom:6px;">
            <input id="ed-st2-temp" class="ed-input mono" autocomplete="off" placeholder="sensor.temperature_x" style="flex:1; font-family:monospace;">
            <button type="button" onclick="wzPickEntity('#ed-st2-temp')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button>
          </div>
          <div style="display:flex; gap:6px; margin-bottom:8px;">
            <input id="ed-st2-hum" class="ed-input mono" autocomplete="off" placeholder="sensor.umidita_x (optional)" style="flex:1; font-family:monospace;">
            <button type="button" onclick="wzPickEntity('#ed-st2-hum')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button>
          </div>
          <button class="ed-btn-add" style="width:100%;" onclick="edAddStanza2()">＋ Add room</button>
        </details>` : ''}${WIZ.sections['clima'] !== false ? `
        <details class="ed-acc"><summary class="ed-acc-head">❄️ Climate units <span class="ed-acc-n">${(WIZ.climaUnits||[]).length}</span></summary>
          <div class="ed-acc-body">
            ${(WIZ.climaUnits||[]).map((u, i) => `<div class="ed-row"><div style="font-size:15px;">${u.type==='termo'?'🔥':'❄️'}</div><div class="ed-row-main"><div class="ed-row-new">${u.name}</div><div class="ed-row-old mono">${u.entity}</div></div><div class="ed-del" onclick="WIZ.climaUnits.splice(${i},1); wzRender();">🗑️</div></div>`).join('')}
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <select id="wz-cl-type" class="wz-input" style="margin-bottom:0; flex:0 0 46%;"><option value="clima">❄️ Air conditioner</option><option value="termo">🔥 Radiator</option></select>
              <input id="wz-cl-name" class="wz-input" style="margin-bottom:0; flex:1;" placeholder="Name (e.g. Office)">
            </div>
            <div style="display:flex; gap:6px; margin-bottom:8px;"><input id="wz-cl-ent" class="wz-input mono" autocomplete="off" placeholder="climate.studio" style="margin-bottom:0; flex:1; font-family:monospace;"><button type="button" onclick="wzPickEntity('#wz-cl-ent')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
            <button class="ed-btn-add" style="width:100%;" onclick="wzAddClima()">＋ Add unit</button>
            <div class="ed-slot" style="margin-top:12px;"><div class="ed-slot-lbl">🔥 Boiler entity (switch — optional)</div><div style="display:flex;gap:6px;"><input id="wz-boiler-ent" class="wz-input mono" style="margin-bottom:0; font-family:monospace; font-size:11.5px;" autocomplete="off"
                     data-ref="switch.caldaia" value="${(WIZ.entities && WIZ.entities['switch.caldaia']) || ENTITY_OVERRIDES['switch.caldaia'] || ''}" placeholder="switch.caldaia" onchange="wzSetSlot(this)"><button type="button" onclick="wzPickEntity('#wz-boiler-ent')" style="flex:0 0 40px;height:40px;border:none;border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;cursor:pointer;">🔍</button></div></div></div></details>` : ''}${WIZ.sections['security'] !== false ? `
      <details class="ed-acc"><summary class="ed-acc-head">📹 Cameras <span class="ed-acc-n">${(WIZ.cameras||[]).length}</span></summary>
          <div class="ed-acc-body">
            ${(WIZ.cameras||[]).map((cam, i) => `<div class="ed-row"><div class="ed-row-main"><div class="ed-row-new">${cam.name}</div><div class="ed-row-old mono">${cam.entity}</div></div><div class="ed-del" onclick="WIZ.cameras.splice(${i},1); wzRender();">🗑️</div></div>`).join('')}
            <input id="wz-cam-name" class="wz-input" placeholder="Name (e.g. Garden)" style="margin-bottom:8px;">
            <div style="display:flex; gap:6px; margin-bottom:8px;"><input id="wz-cam-ent" class="wz-input mono" autocomplete="off" placeholder="camera.giardino" style="margin-bottom:0; flex:1; font-family:monospace;"><button type="button" onclick="wzPickEntity('#wz-cam-ent')" style="flex:0 0 40px; height:40px; border:none; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:15px; cursor:pointer;">🔍</button></div>
            <input id="wz-cam-stream" class="wz-input mono" placeholder="Stream go2rtc (optional)" style="margin-bottom:8px; font-family:monospace;">
            <button class="ed-btn-add" style="width:100%;" onclick="wzAddCamera()">＋ Add camera</button>
          </div>
        </details>` : ''}</div>
        <button class="wz-btn" onclick="WIZ.step=6; wzRender();">Next →</button>`;
        if (!WIZ.allEntities || !WIZ.allEntities.length) wzLoadAllEntities();
    }

    if (WIZ.step === 6) body = `
        <div class="wz-title">🎉 All set!</div>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:14px; padding:12px 16px; margin-bottom:12px; font-size:12.5px; color:#166534; line-height:1.7;">
          📋 <b>Summary:</b>
          🧩 ${Object.keys(WIZ.entities||{}).length + Object.keys(ENTITY_OVERRIDES||{}).length} entities ·
          💡 ${Object.keys(WIZ.luci||{}).length} lights ·
          🌡️ ${(WIZ.stanze||[]).length} rooms ·
          ❄️ ${(WIZ.climaUnits||[]).length} climate ·
          📹 ${(WIZ.cameras||[]).length} cameras ·
          ⚡ ${(WIZ.quickActions||[]).length} actions
        </div>
        <div class="wz-sub">Configuration is saved <b>on this device</b> (with HACS it survives updates).<br><br>
        📌 <b>To reopen configuration at any time:</b><br>
        • The <b>⚙️ Config</b> page in the menu (visible to admins)<br>
       <br>
        To make the config multi-device: ⚙️ → Configure Entities → 📤 Export.</div>
        <button class="wz-btn wz-btn-green" onclick="wzFinish()">Save and launch dashboard ✓</button>`;

    card.innerHTML = `<div class="wz-ver">v${DASHBOARD_VERSION}</div><div class="wz-logo-wrap" style="display:flex; justify-content:center; margin-bottom:16px;">${cdBrandLogo(46, true)}</div><div class="wz-dots">${dots}</div>${body}
        ${WIZ.step > 1 && WIZ.step < 6 ? '<div class="wz-back" onclick="WIZ.step--; wzRender();">← Back</div>' : ''}
        <div class="wz-skip" onclick="document.getElementById('setup-wizard').remove()">Close without saving</div>
        <div class="wz-skip" style="color:#fca5a5;" onclick="wzResetAll()">🗑️ Full configuration reset (this device)</div>`;
    if (WIZ.step === 4) wzRenderLights();
}


/* ═══ v270: SINCRONIZZAZIONE MULTI-DISPOSITIVO ═══
   La configurazione viene salvata anche nell'archivio utente di Home Assistant
   (frontend user_data): configuri una volta, la ritrovi su ogni dispositivo. */
/* v301: cd_theme e cd_navbar_mode NON sono sincronizzati — sono preferenze del singolo dispositivo */
const CD_SYNC_KEYS = ['dm_dashboard_state','cd_connection','cd_branding','cd_sections','cd_section_names','cd_luci','cd_luci_rooms','cd_stanze','cd_cameras','cd_appliances','cd_loads','cd_energy_model','cd_clima_units','cd_quick_actions','cd_devices','cd_ev_image','cd_entity_overrides','cd_tapparelle','cd_irrigazione','cd_piscina','cd_ev_cars','cd_energy_views','cd_navbar_order','cd_floors','cd_slot_labels','cd_flow_nodes','cd_avvisi_custom','cd_text_overrides','cd_hidden_elements'];

function cdSyncCollect() {
    const out = { _savedAt: Date.now() };
    CD_SYNC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) out[k] = v; });
    return out;
}
function cdSyncApply(data) {
    if (!data) return 0;
    let n = 0;
    if (data.dm_dashboard_state !== undefined) { localStorage.setItem('dm_dashboard_state', data.dm_dashboard_state); window.DashboardModernModules?.store?.applySnapshot(data.dm_dashboard_state); n++; } CD_SYNC_KEYS.filter(k => k !== 'dm_dashboard_state').forEach(k => { if (data[k] !== undefined) { localStorage.setItem(k, data[k]); n++; } });
    return n;
}
/* Push sul WS principale (dashboard già connessa) */
/* v293 (issue #5): ogni modifica locale marca SUBITO il timestamp — così il pull
   all'avvio non può sovrascrivere modifiche fatte un attimo prima del reload. */
function cdMarkDirty() {
    localStorage.setItem('cd_sync_ts', String(Date.now()));
    localStorage.setItem('cd_sync_dirty', '1'); // v299: modifiche locali non ancora inviate
}

/* ═══ v0.7.0 "Totali intelligenti" (richiesta utenti): chi ha solo i sensori TOTALI
   cumulativi (gli stessi della dashboard Energy di HA) mappa quelli, e la dashboard
   calcola da sola oggi/mese/anno usando le statistiche a lungo termine di HA — che
   conservano lo storico per sempre, senza helper e senza perdere nulla. ═══ */
const CD_TOTALS_MAP = Object.freeze({});
function cdTotalsRun() { return window.DashboardModernEnergyService?.refresh?.(); }
function cdTotalsInject() {}
function cdTotalsHandle() { return false; }

function cdSyncPush(silent = true) {
    try {
        if (!ws || ws.readyState !== 1) return;
        const payload = cdSyncCollect();
        payload.__ts = Date.now();
        localStorage.setItem('cd_sync_ts', String(payload.__ts));
        localStorage.removeItem('cd_sync_dirty'); // inviate: non più dirty
        ws.send(JSON.stringify({ id: msgId++, type: 'frontend/set_user_data', key: (window.__DASHBOARDMODERN_HOSTED__ ? ('dashboardmodern_integration_config' + (window.__DASHBOARDMODERN_PRIMARY__ === false && window.__DASHBOARDMODERN_INSTANCE__ ? '__' + String(window.__DASHBOARDMODERN_INSTANCE__).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) : '')) : 'dashboard' + '_modern_config'), value: payload }));
        if (!silent && typeof edToast === 'function') edToast('☁️ Configuration saved to Home Assistant');
        console.log('[Sync] configurazione inviata a HA');
    } catch(e) { console.warn('[Sync] push fallito:', e); }
}
/* Pull con WS dedicato (usato dal wizard, dove serve il token appena inserito) */
function cdSyncPull(token, cb) {
    try {
        const _ha = cdResolveHaWs();
        const tws = new WebSocket(_ha.ws || ((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/websocket'));
        let mid = 1;
        const timer = setTimeout(() => { try { tws.close(); } catch(e){}; cb(null); }, 6000);
        tws.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.type === 'auth_required') tws.send(JSON.stringify({ type: 'auth', access_token: token }));
            if (m.type === 'auth_ok') tws.send(JSON.stringify({ id: mid++, type: 'frontend/get_user_data', key: (window.__DASHBOARDMODERN_HOSTED__ ? ('dashboardmodern_integration_config' + (window.__DASHBOARDMODERN_PRIMARY__ === false && window.__DASHBOARDMODERN_INSTANCE__ ? '__' + String(window.__DASHBOARDMODERN_INSTANCE__).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) : '')) : 'dashboard' + '_modern_config') }));
            if (m.type === 'result') { clearTimeout(timer); try { tws.close(); } catch(e){}; cb(m.result && m.result.value ? m.result.value : null); }
        };
        tws.onerror = () => { clearTimeout(timer); cb(null); };
    } catch(e) { cb(null); }
}

/* v0.8.7 (#10): l'host di Home Assistant NON è location.host quando il file è aperto
   da un download (githubusercontent, file://, o un web server diverso da HA). Questo helper
   ricava l'URL HA reale dai campi del wizard o dalla connessione salvata. */
function cdResolveHaWs() {
    let url = '';
    try {
        const r = document.getElementById('wz-remote'); const l = document.getElementById('wz-local');
        url = (r && r.value.trim()) || (l && l.value.trim()) || '';
    } catch(e) {}
    if (!url) { try { const conn = JSON.parse(localStorage.getItem('cd_connection') || '{}'); url = conn.remote_url || conn.local_ip || ''; } catch(e) {} }
    const host = location.host;
    const onHA = host && location.protocol !== 'file:' && !/githubusercontent|github\.io|githubassets/i.test(host);
    if (!url && onHA) return { ws: (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + host + '/api/websocket', ok: true };
    if (!url) return { ws: '', ok: false, needUrl: true };
    let u = url.replace(/\/$/, '');
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const wsBase = u.replace(/^http/i, 'ws');
    return { ws: wsBase + '/api/websocket', ok: true, base: u };
}

function wzTestToken() {
    WIZ.remoteUrl = (document.getElementById('wz-remote') ? document.getElementById('wz-remote').value.trim() : WIZ.remoteUrl || '');
    const tk = (document.getElementById('wz-token').value || '').trim();
    const res = document.getElementById('wz-test-result');
    if (!tk || !tk.startsWith('eyJ')) { res.innerHTML = '<div class="wz-err">⚠️ The token looks invalid (it must start with eyJ)</div>'; return; }
    res.innerHTML = '<div class="wz-info">⏳ Checking…</div>';
    const _ha = cdResolveHaWs();
    if (!_ha.ok) { res.innerHTML = '<div class="wz-err">⚠️ Enter your Home Assistant URL (field above) before verifying — this file is opened outside HA.</div>'; return; }
    try {
        const tws = new WebSocket(_ha.ws);
        let done = false;
        tws.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.type === 'auth_required') tws.send(JSON.stringify({ type: 'auth', access_token: tk }));
            if (m.type === 'auth_ok') { done = true; WIZ.token = tk; res.innerHTML = '<div class="wz-ok">✅ Connected to Home Assistant!</div>'; tws.close();
                // v270: config trovata su HA (da un altro dispositivo)? Proponi l'importazione
                cdSyncPull(tk, (data) => {
                    // v301: l'import automatico avviene SOLO se questo dispositivo è vergine.
                    // Prima scattava a OGNI apertura del wizard: import + reload = wizard inutilizzabile
                    // e preferenze locali (tema, barra) sovrascritte in continuazione.
                    const _hasLocalCfg = !!(localStorage.getItem('cd_entity_overrides') || localStorage.getItem('cd_luci') || localStorage.getItem('cd_sections'));
                    if (data && data.cd_sections && !_hasLocalCfg) {
                        {
                            const n = cdSyncApply(data);
                            try { const conn = JSON.parse(localStorage.getItem('cd_connection') || '{}'); conn.token = tk; if (!window.__DASHBOARDMODERN_HOSTED__) localStorage.setItem('cd_connection', JSON.stringify(conn)); } catch(e) { localStorage.setItem('cd_connection', JSON.stringify({ token: tk })); }
                            alert('✅ Imported ' + n + ' settings. The dashboard will reload.');
                            document.getElementById('setup-wizard')?.remove();
                            location.reload();
                            return;
                        }
                    }
                    setTimeout(() => { WIZ.step = 2; wzRender(); }, 300);
                });
            }
            if (m.type === 'auth_invalid') { done = true; res.innerHTML = '<div class="wz-err">❌ Token rejected by HA. Make sure you copied it entirely.</div>'; tws.close(); }
        };
        tws.onerror = () => { if (!done) res.innerHTML = '<div class="wz-err">❌ Cannot reach HA at ' + (_ha.base || location.host) + '.<br>Check the URL and that HA is reachable from this device. If the file was opened from a download, the URL above is required.</div>'; };
        setTimeout(() => { if (!done) { res.innerHTML = '<div class="wz-err">❌ Timeout. Try again.</div>'; try{tws.close();}catch(e){} } }, 8000);
    } catch(e) { res.innerHTML = '<div class="wz-err">❌ ' + e.message + '</div>'; }
}

function wzLoadLights() {
    wzRender();
    // Connessione temporanea per leggere le entità light/switch
    const _ha = cdResolveHaWs();
    const tws = new WebSocket(_ha.ws || ((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/websocket'));
    let mid = 1;
    tws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === 'auth_required') tws.send(JSON.stringify({ type: 'auth', access_token: WIZ.token }));
        if (m.type === 'auth_ok') tws.send(JSON.stringify({ id: mid++, type: 'get_states' }));
        if (m.type === 'result' && Array.isArray(m.result)) {
            WIZ.allLights = m.result.filter(s => s.entity_id.startsWith('light.') || s.entity_id.startsWith('switch.'))
                .map(s => ({ id: s.entity_id, name: (s.attributes && s.attributes.friendly_name) || s.entity_id }));
            tws.close();
            wzRenderLights();
        }
    };
}

function wzRenderLights() {
    const box = document.getElementById('wz-lights');
    if (!box) return;
    if (!WIZ.allLights || !WIZ.allLights.length) { box.innerHTML = '<div class="wz-loading">Loading lights from your HA…</div>'; return; }
    box.innerHTML = WIZ.allLights.filter(e => !WIZ.lightsFilter || (e.id + ' ' + (e.name||'')).toLowerCase().includes(WIZ.lightsFilter)).map(e => {
        const checked = e.id in WIZ.luci;
        const nome = WIZ.luci[e.id] || e.name;
        return `<div class="wz-light ${checked ? 'on' : ''}">
          <div class="wz-check" onclick="wzToggleLight('${e.id}', '${(e.name||'').replace(/'/g, "\\'")}')">${checked ? '✓' : ''}</div>
          <div class="wz-light-id" onclick="wzToggleLight('${e.id}', '${(e.name||'').replace(/'/g, "\\'")}')">${e.id}</div>
          ${checked ? `<input class="wz-light-nm" value="${nome}" onchange="WIZ.luci['${e.id}'] = this.value.trim() || '${e.id}'">` : ''}
        </div>`;
    }).join('');
}
function wzToggleLight(id, defName) {
    if (id in WIZ.luci) delete WIZ.luci[id]; else WIZ.luci[id] = defName;
    wzRenderLights();
    const sub = document.querySelector('#wz-card .wz-sub b:last-of-type');
    if (sub) sub.textContent = Object.keys(WIZ.luci).length;
}


function wzRenameSlot(ref, val) {
    const L = cdCfg('cd_slot_labels');
    val = (val || '').trim();
    if (val) L[ref] = val; else delete L[ref];
    localStorage.setItem('cd_slot_labels', JSON.stringify(L));
    try { cdMarkDirty(); } catch(e){}
}

function wzSetSlot(input) {
    if (!WIZ.entities || Array.isArray(WIZ.entities)) WIZ.entities = {};
    const ref = input.dataset.ref;
    const val = (input.value || '').trim();
    if (!val || val === ref) delete WIZ.entities[ref];
    else if (val.includes('.')) WIZ.entities[ref] = val;
}
function wzLoadAllEntities() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
        const tws = new WebSocket(`${proto}//${location.host}/api/websocket`);
        let mid = 1;
        tws.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.type === 'auth_required') tws.send(JSON.stringify({ type: 'auth', access_token: WIZ.token }));
            if (m.type === 'auth_ok') {
                tws.send(JSON.stringify({ id: mid++, type: 'get_states' }));
                // v290: registri ufficiali HA — aree, dispositivi, entità (per il rilevamento per stanza)
                WIZ._ridArea = mid; tws.send(JSON.stringify({ id: mid++, type: 'config/area_registry/list' }));
                WIZ._ridDev  = mid; tws.send(JSON.stringify({ id: mid++, type: 'config/device_registry/list' }));
                WIZ._ridEnt  = mid; tws.send(JSON.stringify({ id: mid++, type: 'config/entity_registry/list' }));
            }
            if (m.type === 'result' && m.id === WIZ._ridArea && Array.isArray(m.result)) {
                WIZ.areaNames = {}; m.result.forEach(a => WIZ.areaNames[a.area_id] = a.name); return;
            }
            if (m.type === 'result' && m.id === WIZ._ridDev && Array.isArray(m.result)) {
                WIZ.devArea = {}; m.result.forEach(d => { if (d.area_id) WIZ.devArea[d.id] = d.area_id; }); return;
            }
            if (m.type === 'result' && m.id === WIZ._ridEnt && Array.isArray(m.result)) {
                WIZ.entReg = {}; m.result.forEach(e => WIZ.entReg[e.entity_id] = { a: e.area_id, d: e.device_id }); return;
            }
            if (m.type === 'result' && Array.isArray(m.result)) {
                WIZ.allEntities = m.result.map(s => s.entity_id).sort();
                // v265: metadati per l'auto-rilevamento
                /* v0.9.6: metadati ARRICCHITI per un rilevamento molto più preciso —
                   dominio, stato, device_class, unit, state_class, area (dai registri HA). */
                WIZ.allMeta = m.result.map(s => {
                    const at = s.attributes || {};
                    const dom = s.entity_id.split('.')[0];
                    const reg = (WIZ.entReg && WIZ.entReg[s.entity_id]) || {};
                    let areaId = reg.a || (reg.d && WIZ.devArea && WIZ.devArea[reg.d]) || '';
                    const areaName = (areaId && WIZ.areaNames && WIZ.areaNames[areaId]) || '';
                    return {
                        id: s.entity_id,
                        name: at.friendly_name || s.entity_id,
                        dc: at.device_class || '',
                        unit: at.unit_of_measurement || '',
                        sc: at.state_class || '',
                        dom: dom,
                        state: s.state,
                        area: areaName,
                        dcat: at.device_category || ''
                    };
                });
                tws.close();
                const dl = document.getElementById('wz-entity-list');
                if (dl) dl.innerHTML = WIZ.allEntities.map(e => `<option value="${e}">`).join('');
                const btn = document.getElementById('wz-autodetect');
                if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
            }
        };
    } catch(e) {}
}





function wzQaTypeChanged() {
    const t = document.getElementById('wz-qa-type')?.value || '';
    const entRow = document.getElementById('wz-qa-ent-row');
    const hint = document.getElementById('wz-qa-hint');
    const needsEntity = ['toggle','script','scene'].includes(t);
    if (entRow) entRow.style.display = needsEntity ? 'flex' : 'none';
    if (hint) {
        hint.textContent = t === 'luci_group'
            ? '💡 Give it a name (e.g. "Ground Floor") and press Add: you will pick the lights from a searchable list.'
            : (needsEntity ? '🔀 Type or pick with 🔍 the entity to control.' : '✨ This popup is ready: just name it (optional) and press Add.');
    }
}

function wzAddQA() {
    const tsel = document.getElementById('wz-qa-type').value;
    const name = (document.getElementById('wz-qa-name').value || '').trim();
    const ent = (document.getElementById('wz-qa-ent').value || '').trim();
    if (!WIZ.quickActions) WIZ.quickActions = [];
    if (tsel.startsWith('builtin_')) {
        const a = { type: 'builtin', builtin: tsel.replace('builtin_','') };
        if (name) a.name = name;
        WIZ.quickActions.push(a);
    } else if (tsel === 'luci_group') {
        if (!name) { alert('Name the group (es. Piano Terra)'); return; }
        cdPickLights(name, (lights) => {
            WIZ.quickActions.push({ type: 'luci_group', name, icon: '💡', lights });
            wzRender();
        });
        return;
    } else {
        if (!name || !ent.includes('.')) { alert('Enter a name and entity'); return; }
        WIZ.quickActions.push({ type: tsel, name, entity: ent });
    }
    wzRender();
}

/* ═══ v282: PICKER ENTITÀ — lista completa di HA con ricerca, selezione a tap.
   Alternativa mobile-friendly all'autocomplete per lo step "Collega le tue entità". ═══ */
/* ═══ v0.7.4: ICON PICKER — emoji grid for icon fields (no more keyboard hunting) ═══ */
const CD_EMOJI_SET = ['🔌','⚡','💡','🔦','🔋','🪫','☀️','🌞','🌡️','❄️','🔥','💧','🌊','💨','🌀','🍳','🍞','☕','🫖','🍽️','🥘','🧊','🍟','🍕','🥩','🍷','🧃','🧺','🧼','🧽','🧹','🪣','🚿','🛁','🚽','🪥','🛋️','🛏️','🪑','🚪','🪟','🖼️','🪞','🧯','🛠️','🔧','🔨','⚙️','🪛','🧰','📺','💻','🖥️','🖨️','📱','📡','🎮','🕹️','🎵','🔊','🎧','📷','🎥','🌴','🌳','🌵','🌻','🪴','🌱','🍀','🏊','⛱️','🏖️','🏠','🏡','🏢','🚗','🚙','🏍️','🛵','🚲','🛴','🛻','🚜','⛽','🅿️','🐕','🐈','🐟','🐦','🏋️','🧘','⚽','🏀','🎾','🛎️','🔔','⏰','🕰️','💤','🌙','⭐','✨','🎄','🎁','🧸','👕','👖','🧦','👟','🧥','💼','📦','🗄️','🗑️','📚','✏️','🖊️','📌','🔒','🔓','🔑','🗝️','🚨','📣','🧲','💶','💰','🪙','📈','📉','📊'];
function wzPickIcon(sel) {
    let ov = document.getElementById('cd-icon-picker');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'cd-icon-picker';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.innerHTML = `<div style="background:var(--card-bg,#fff);border-radius:18px;max-width:440px;width:100%;max-height:70vh;overflow:auto;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,0.35);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="font-weight:900;font-size:15px;">😀 Choose an icon</div>
        <button type="button" onclick="document.getElementById('cd-icon-picker').remove()" style="border:none;background:rgba(148,163,184,0.15);border-radius:50%;width:32px;height:32px;font-size:15px;cursor:pointer;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:4px;">
      ${CD_EMOJI_SET.map(e => `<button type="button" style="font-size:23px;padding:8px 0;border:none;background:transparent;border-radius:10px;cursor:pointer;" onclick="cdSetIcon('${sel}','${e}')">${e}</button>`).join('')}
      </div></div>`;
    ov.addEventListener('click', ev => { if (ev.target === ov) ov.remove(); });
    document.body.appendChild(ov);
}
function cdSetIcon(sel, e) {
    const el = document.querySelector(sel);
    if (el) { el.value = e; try { el.dispatchEvent(new Event('change')); } catch(_) {} }
    const ov = document.getElementById('cd-icon-picker'); if (ov) ov.remove();
}

/* v0.9.7 (#9): in the editor the picker only saw entities tracked by the dashboard
   (_RAW_STATES, a few dozen). Here we load the FULL entity list from HA via a
   dedicated get_states and cache it, so search covers ALL available entities. */
let CD_PICKER_META = [];
function cdLoadAllEntitiesForPicker(onReady) {
    if (CD_PICKER_META && CD_PICKER_META.length) { if (onReady) onReady(CD_PICKER_META); return; }
    let token = '';
    try { token = (typeof WIZ !== 'undefined' && WIZ && WIZ.token) || (JSON.parse(localStorage.getItem('cd_connection') || '{}').token) || (typeof LONG_LIVED_TOKEN !== 'undefined' ? LONG_LIVED_TOKEN : ''); } catch(e) {}
    const ha = (typeof cdResolveHaWs === 'function') ? cdResolveHaWs() : { ws: '', ok: false };
    if (!ha.ok || !ha.ws || !token) { if (onReady) onReady(null); return; }
    try {
        const tws = new WebSocket(ha.ws);
        let mid = 1;
        tws.onmessage = (ev) => {
            let m; try { m = JSON.parse(ev.data); } catch(_) { return; }
            if (m.type === 'auth_required') { tws.send(JSON.stringify({ type: 'auth', access_token: token })); return; }
            if (m.type === 'auth_ok')       { tws.send(JSON.stringify({ id: mid++, type: 'get_states' })); return; }
            if (m.type === 'result' && Array.isArray(m.result)) {
                CD_PICKER_META = m.result
                    .map(s => ({ id: s.entity_id, name: (s.attributes && s.attributes.friendly_name) || s.entity_id }))
                    .sort((a, b) => a.id.localeCompare(b.id));
                try { tws.close(); } catch(_) {}
                if (onReady) onReady(CD_PICKER_META);
            }
        };
        tws.onerror = () => { if (onReady) onReady(null); };
    } catch(e) { if (onReady) onReady(null); }
}

function wzPickEntity(ref) {
    let M = (WIZ.allMeta && WIZ.allMeta.length) ? WIZ.allMeta
          : (CD_PICKER_META && CD_PICKER_META.length) ? CD_PICKER_META
          : (WIZ.allEntities || []).map(id => ({ id, name: id }));
    // v302: in the editor (outside the wizard) entities come from the dashboard live states
    if (!M.length) {
        try { M = Object.keys(_RAW_STATES).sort().map(id => ({ id, name: (_RAW_STATES[id].attributes && _RAW_STATES[id].attributes.friendly_name) || id })); } catch(e) {}
    }
    if (!M.length) { alert('Wait for entities to load…'); return; }
    const ov = document.createElement('div');
    ov.id = 'cd-entpick';
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:100000; display:flex; align-items:center; justify-content:center; padding:16px;';
    ov.innerHTML = `<div style="background:var(--card-bg,#fff); border-radius:22px; padding:18px; width:min(460px,100%); max-height:82vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.35);">
        <div style="font-weight:900; font-size:14.5px; margin-bottom:8px; color:var(--text,#0f172a);">🧩 Pick the entity</div>
        <input id="cd-ep-search" class="wz-input" style="margin-bottom:8px;" placeholder="🔍 Search… (name or entity)" autofocus
               oninput="cdEpFilter(this.value)">
        <div id="cd-ep-list" style="overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:4px;"></div>
        <button class="wz-btn" style="margin-top:10px; background:#94a3b8;" onclick="document.getElementById('cd-entpick').remove()">Cancel</button>
      </div>`;
    document.body.appendChild(ov);
    window._cdEpAll = M;
    window._cdEpRef = ref;
    cdEpFilter('');
    setTimeout(() => document.getElementById('cd-ep-search')?.focus(), 60);
    if (!(WIZ.allMeta && WIZ.allMeta.length)) {
        cdLoadAllEntitiesForPicker((full) => {
            if (full && full.length && document.getElementById('cd-entpick')) {
                window._cdEpAll = full;
                const q = document.getElementById('cd-ep-search');
                cdEpFilter(q ? q.value : '');
            }
        });
    }
}
function cdEpFilter(q) {
    q = (q || '').trim().toLowerCase();
    const list = document.getElementById('cd-ep-list');
    if (!list) return;
    const M = window._cdEpAll || [];
    let rows;
    if (!q) {
        rows = M.slice(0, 300);
    } else {
        const terms = q.split(/\s+/).filter(Boolean);
        const scored = [];
        for (const e of M) {
            const idl = e.id.toLowerCase(), nml = (e.name || '').toLowerCase();
            const hay = idl + ' ' + nml;
            if (!terms.every(t => hay.includes(t))) continue;
            let score = 0;
            if (idl.startsWith(q) || nml.startsWith(q)) score += 100;
            if (idl.includes(q)  || nml.includes(q))  score += 30;
            score -= Math.min(idl.length, 60) * 0.1;
            scored.push([score, e]);
        }
        scored.sort((a, b) => b[0] - a[0]);
        rows = scored.slice(0, 300).map(s => s[1]);
    }
    const head = `<div style="font-size:10.5px; color:var(--text-dim,#64748b); font-weight:700; padding:1px 4px 5px;">${M.length} entities available${q ? ' · ' + rows.length + ' results' : ''}</div>`;
    list.innerHTML = head + (rows.map(e => `
      <div onclick="cdEpChoose('${e.id}')" style="padding:9px 12px; border-radius:12px; background:rgba(148,163,184,0.08); cursor:pointer; font-size:12.5px; color:var(--text,#0f172a);">
        <b>${e.name}</b><br><span style="font-family:monospace; font-size:10px; color:var(--text-dim,#64748b);">${e.id}</span>
      </div>`).join('') || '<div style="text-align:center; padding:20px; color:var(--text-dim); font-weight:700;">No results</div>');
}
function cdEpChoose(id) {
    const ref = window._cdEpRef;
    document.getElementById('cd-entpick')?.remove();
    if (ref && ref.nodeType === 1) { ref.value = id; try { ref.dispatchEvent(new Event('change')); } catch(e) {} return; } if (ref && ref.startsWith('#')) { const el = document.getElementById(ref.slice(1)); if (el) el.value = id; return; }
    if (ref === '__qa__') { const qa = document.getElementById('wz-qa-ent'); if (qa) qa.value = id; return; }
    if (ref === '__ed_qa__') { const qa = document.getElementById('ed-qa-ent'); if (qa) qa.value = id; return; }
    const inp = document.querySelector(`input[data-ref="${ref}"]`);
    if (inp) { inp.value = id; wzSetSlot(inp); if (WIZ.autoDetected) delete WIZ.autoDetected[ref]; }
    wzRender();
}

/* ═══ v268: selettore luci per i gruppi (issue #2) — checkbox con ricerca ═══ */
function wzEditLightGroup(i) {
    const a = (WIZ.quickActions || [])[i];
    if (!a || a.type !== 'luci_group') return;
    cdPickLights(a.name || 'Gruppo', (lights) => {
        a.lights = lights;
        wzRender();
    }, a.lights || []);
}

function cdPickLights(groupName, onDone, preselected) {
    const all = Object.keys(cdCfg('cd_luci') || {}).length ? cdCfg('cd_luci') : (WIZ && WIZ.luci) || {};
    const ids = Object.keys(all);
    if (!ids.length) { alert('First select your lights in the Lights step (or wizard).'); return; }
    const ov = document.createElement('div');
    ov.id = 'cd-lightpick';
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:99999; display:flex; align-items:center; justify-content:center; padding:18px;';
    ov.innerHTML = `<div style="background:var(--card-bg,#fff); border-radius:22px; padding:20px; width:min(430px,100%); max-height:80vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="font-weight:900; font-size:15px; margin-bottom:4px; color:var(--text,#0f172a);">💡 Lights in group "${groupName}"</div>
        <div style="font-size:11.5px; color:var(--text-dim,#64748b); margin-bottom:10px;">Tick the lights this popup should show.</div>
        <input id="cd-lp-search" class="wz-input" style="margin-bottom:8px;" placeholder="🔍 Search…" oninput="document.querySelectorAll('#cd-lp-list > label').forEach(l => { l.style.display = l.textContent.toLowerCase().includes(this.value.toLowerCase()) ? '' : 'none'; })">
        <div id="cd-lp-list" style="overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:4px;">
          ${ids.map(id => `<label style="display:flex; gap:10px; align-items:center; padding:8px 10px; border-radius:12px; background:rgba(148,163,184,0.08); cursor:pointer; font-size:12.5px; color:var(--text,#0f172a);"><input type="checkbox" value="${id}" ${(preselected||[]).includes(id) ? 'checked' : ''} style="width:17px; height:17px; accent-color:#0ea5e9;"> <span><b>${all[id]}</b><br><span style="font-family:monospace; font-size:10px; color:var(--text-dim,#64748b);">${id}</span></span></label>`).join('')}
        </div>
        <div style="display:flex; gap:10px; margin-top:12px;">
          <button class="wz-btn" style="flex:1; background:#94a3b8;" onclick="document.getElementById('cd-lightpick').remove()">Cancel</button>
          <button class="wz-btn" style="flex:1;" onclick="const sel=[...document.querySelectorAll('#cd-lp-list input:checked')].map(i=>i.value); if(!sel.length){alert('Select at least one light');return;} document.getElementById('cd-lightpick').remove(); window._cdLpDone(sel);">Confirm ✓</button>
        </div>
      </div>`;
    window._cdLpDone = onDone;
    document.body.appendChild(ov);
}



/* ═══ v267: AUTO-RILEVAMENTO v3 — scoring intelligente con sinonimi e vincoli di unità.
   Tutto resta modificabile: sono solo proposte pre-compilate. ═══ */
/* v290: nome dell'area (stanza) ufficiale di un'entità, se assegnata in HA */
function wzAreaOf(entityId) {
    try {
        const r = WIZ.entReg && WIZ.entReg[entityId];
        if (!r) return null;
        const areaId = r.a || (r.d && WIZ.devArea && WIZ.devArea[r.d]) || null;
        return (areaId && WIZ.areaNames && WIZ.areaNames[areaId]) || null;
    } catch(e) { return null; }
}

function wzAutoDetect() {
    if (!WIZ.allMeta || !WIZ.allMeta.length) { alert('Wait for entities to load…'); return; }
    const M = WIZ.allMeta;
    let nClima = 0, nCam = 0, nStanze = 0, nAvvisi = 0, nSlot = 0, nLuci = 0;

    // — Luci: se non selezionate nello step precedente, proponi tutte le light.*
    if (!Object.keys(WIZ.luci || {}).length) {
        M.filter(e => e.id.startsWith('light.')).forEach(e => {
            if (!WIZ.luci) WIZ.luci = {};
            const area = wzAreaOf(e.id);
            WIZ.luci[e.id] = area && !e.name.toLowerCase().includes(area.toLowerCase()) ? area + ' - ' + e.name : e.name;
            nLuci++;
        });
    }

    // — Unità clima
    if (!(WIZ.climaUnits || []).length) {
        WIZ.climaUnits = M.filter(e => e.id.startsWith('climate.')).map(e => {
            let nm = e.name.replace(/termosifone|radiator|thermostat|condizionatore|clima/gi, '').trim() || e.name;
            const area = wzAreaOf(e.id);
            if (area && !nm.toLowerCase().includes(area.toLowerCase())) nm = area;
            return { name: nm, entity: e.id, type: /termo|radiat|riscald|heat|valve|trv/i.test(e.id + ' ' + e.name) ? 'termo' : 'clima' };
        });
        nClima = WIZ.climaUnits.length;
    }

    // — Cameras
    if (!(WIZ.cameras || []).length) {
        WIZ.cameras = M.filter(e => e.id.startsWith('camera.')).map(e => {
            const area = wzAreaOf(e.id);
            return { name: area && !e.name.toLowerCase().includes(area.toLowerCase()) ? area + ' - ' + e.name : e.name, entity: e.id };
        });
        nCam = WIZ.cameras.length;
    }

    // — Rooms: temperatura + umidità gemella
    if (!(WIZ.stanze || []).length) {
        const temps = M.filter(e => e.id.startsWith('sensor.') && (e.dc === 'temperature' || /temperatur/i.test(e.id)) && (e.unit || '').includes('°'));
        // v290: prima le AREE ufficiali di HA — una stanza per area, col suo sensore
        const byArea = {};
        temps.forEach(e => { const a = wzAreaOf(e.id); if (a && !byArea[a]) byArea[a] = e; });
        const used = new Set();
        WIZ.stanze = Object.entries(byArea).slice(0, 14).map(([areaName, e]) => {
            used.add(e.id);
            const r = { name: areaName, icon: '🌡️', temp: e.id };
            const hums = M.filter(h => h.id.startsWith('sensor.') && (h.dc === 'humidity' || /umidit|humidity/i.test(h.id)) && wzAreaOf(h.id) === areaName);
            if (hums.length) r.hum = hums[0].id;
            return r;
        });
        // fallback per i sensori senza area: euristica sul nome (come prima)
        temps.filter(e => !used.has(e.id) && !wzAreaOf(e.id)).slice(0, Math.max(0, 14 - WIZ.stanze.length)).forEach(e => {
            const r = { name: e.name.replace(/temperatura|temperature|sensore?/gi, '').trim() || e.name, icon: '🌡️', temp: e.id };
            const base = e.id.replace(/_?temperatur[ae]?/i, '');
            const hum = M.find(h => h.id.startsWith('sensor.') && (h.dc === 'humidity' || /umidit|humidity/i.test(h.id)) && h.id.replace(/_?(umidita|humidity)/i, '') === base);
            if (hum) r.hum = hum.id;
            WIZ.stanze.push(r);
        });
        nStanze = WIZ.stanze.length;
    }

    // — v0.9.7: AZIONI RAPIDE automatiche da script, scene e input_boolean
    //   (interroga TUTTO il motore HA: non solo sensori, ma anche entità azionabili)
    if (!(WIZ.quickActions || []).length) {
        WIZ.quickActions = [];
        const _acts = M.filter(e => /^(script|scene)\./.test(e.id)).slice(0, 12);
        _acts.forEach(e => {
            const area = wzAreaOf(e.id);
            const nm = e.name && e.name !== e.id ? e.name : e.id.split('.')[1].replace(/_/g, ' ');
            WIZ.quickActions.push({ type: e.id.startsWith('scene.') ? 'scene' : 'script', name: area && !nm.toLowerCase().includes(area.toLowerCase()) ? area + ' - ' + nm : nm, entity: e.id });
        });
    }

    // — Quadro avvisi
    const extG = cdCfg('cd_gruppi_extra');
    let extGChanged = false;
    if (!(GRUPPI_MONITORAGGIO['win'] || []).length) {
        const wins = M.filter(e => e.id.startsWith('binary_sensor.') && !/bypass/i.test(e.id + ' ' + e.name) && (['door','window','opening','garage_door'].includes(e.dc) || /finestra|porta|window|door|contact/i.test(e.id))).slice(0, 80);
        if (wins.length) { extG['win'] = wins.map(e => e.id); wins.forEach(e => GRUPPI_MONITORAGGIO['win'].push(e.id)); nAvvisi += wins.length; extGChanged = true; }
    }
    if (!(GRUPPI_MONITORAGGIO['batt'] || []).length) {
        const batts = M.filter(e => e.id.startsWith('sensor.') && e.dc === 'battery' && e.unit === '%').slice(0, 80);
        if (batts.length) { extG['batt'] = batts.map(e => e.id); batts.forEach(e => GRUPPI_MONITORAGGIO['batt'].push(e.id)); nAvvisi += batts.length; extGChanged = true; }
    }
    /* v0.8.3: domain/class detection also for lights, climate and heating */
    if (!(GRUPPI_MONITORAGGIO['luci'] || []).length) {
        const ls = M.filter(e => e.id.startsWith('light.'));
        if (ls.length) { GRUPPI_MONITORAGGIO['luci'] = GRUPPI_MONITORAGGIO['luci'] || []; extG['luci'] = ls.map(e => e.id); ls.forEach(e => GRUPPI_MONITORAGGIO['luci'].push(e.id)); nAvvisi += ls.length; extGChanged = true; }
    }
    if (!(GRUPPI_MONITORAGGIO['clima'] || []).length) {
        const cl = M.filter(e => e.id.startsWith('climate.') && !/termo|radiat|trv|valve/i.test(e.id + ' ' + e.name)).slice(0, 60);
        if (cl.length) { GRUPPI_MONITORAGGIO['clima'] = GRUPPI_MONITORAGGIO['clima'] || []; extG['clima'] = cl.map(e => e.id); cl.forEach(e => GRUPPI_MONITORAGGIO['clima'].push(e.id)); nAvvisi += cl.length; extGChanged = true; }
    }
    if (!(GRUPPI_MONITORAGGIO['risc'] || []).length) {
        const rs = M.filter(e => e.id.startsWith('climate.') && /termo|radiat|trv|valve/i.test(e.id + ' ' + e.name)).slice(0, 60);
        if (rs.length) { GRUPPI_MONITORAGGIO['risc'] = GRUPPI_MONITORAGGIO['risc'] || []; extG['risc'] = rs.map(e => e.id); rs.forEach(e => GRUPPI_MONITORAGGIO['risc'].push(e.id)); nAvvisi += rs.length; extGChanged = true; }
    }
    if (extGChanged) localStorage.setItem('cd_gruppi_extra', JSON.stringify(extG));

    // — SLOT: scoring v3 — parole temporali distintive, peso maggiore ai match nell'ID, tie-break intelligente
    if (!WIZ.entities || Array.isArray(WIZ.entities)) WIZ.entities = {};
    const STOP = new Set(['casa','stato','testo','entita','interruttore','sensore','della','delle','dallo','dalla','dall','alla','sull','contatore','centrale','tutte','solo','con','per','del','dei','nel','una','the','and','for','di','al']);
    const SYN = {
        'oggi': ['daily','today','giornalier'], 'mese': ['month','mensile'], 'anno': ['year','annual','annuale'],
        'meteo': ['weather'], 'allarme': ['alarm','antifurto'], 'antifurto': ['alarm','allarme'],
        'produzione': ['production','yield','generated','generation','fotovoltaico'],
        'consumo': ['consumption','load','used','usage'], 'consumi': ['consumption','load'],
        'prelevata': ['bought','import','purchased','from_grid'], 'immessa': ['sold','export','to_grid','feed'],
        'batteria': ['battery','batt','soc','accumulo'], 'caricata': ['charge'], 'scaricata': ['discharge'],
        'usata': ['discharge','used'], 'carica': ['charge','soc','charging'], 'potenza': ['power'],
        'rete': ['grid'], 'acquistata': ['bought','import','purchased'], 'venduta': ['sold','export'],
        'temperatura': ['temperature','temp'], 'scambio': ['grid','exchange','external'],
        'autonomia': ['range','autonomy'], 'odometro': ['odometer','mileage'], 'limite': ['limit','target'],
        'pressione': ['pressure'], 'caldaia': ['boiler','heater'], 'lavatrice': ['washing','washer'],
        'cancello': ['gate'], 'solare': ['solar','pv','fotovoltaico'], 'fotovoltaico': ['pv','solar','photovoltaic'],
        'auto': ['car','vehicle'], 'wallbox': ['wallbox','charger','evse'],
        'sessione': ['session','charged'], 'percentuale': ['percentage','percent'],
        'inverter': ['inverter'], 'ventola': ['fan'], 'memoria': ['memory','ram','mem'],
        'disco': ['disk','storage'], 'processore': ['cpu'], 'condizionatori': ['clima','hvac','condizionator'],
        'termosifoni': ['radiator','heating','termosifon'], 'aperture': ['window','door','opening','finestre','aperte'],
        'luci': ['light','luci'], 'on': ['on','count'], 'accesi': ['accesi','count'], 'finestre': ['window','opening','aperte','finestre'],
        'internet': ['internet','wan','ping','online','connectivity'], 'pompa': ['pump','pompa'],
        'ricircolo': ['recirculation','circulation','ricircolo'], 'valvola': ['valve','valvola'],
        'sonda': ['probe','sonoff','ds18b20'], 'boiler': ['boiler','water_heater'],
        'target': ['target','setpoint'], 'modalita': ['mode'], 'ricarica': ['charge','charging','ricarica'],
        'prelievo': ['consumption','energy','prelievo','totale'], 'tensione': ['voltage','tensione'],
        'somma': ['sum','total','somma'], 'cucina': ['kitchen','cucin'], 'lavanderia': ['laundry','lavanderia'],
        'istantanea': ['power','instant','istantane'], 'delta': ['delta','diff'], 'sicurezza': ['safety','security'],
        'aspiratore': ['fan','exhaust','aspiratore'], 'canna': ['flue','chimney','canna'],
        'fumaria': ['flue','chimney','fumaria'], 'termocamino': ['fireplace','termocamino','stove'],
        'boost': ['boost'],
        'centralina': ['controller','centralina'], 'termico': ['thermal','termico'],
        'rapido': ['quick','rapid','fast'], 'misto': ['mixed','misto'], 'colorati': ['color'],
        'avvio': ['start','power'], 'ciclo': ['cycle','wash'], 'presa': ['plug','socket','switch'],
        'dispositivo': ['device'], 'tempo': ['time','remaining'], 'select': [], 'calore': ['heat','calore'], 'resistenza': ['element','resist'],
        'scariche': ['low','scarich'], 'batterie': ['batter'], 'elettrodomestici': ['appliance','elettrodomestic'],
        'download': ['download'], 'upload': ['upload'], 'ping': ['ping'], 'uptime': ['uptime'],
        /* v0.8.0: brand e integrazioni comuni per il rilevamento automatico */
        'produzione': ['production','yield','generated','pv','solar','solarman','fronius','growatt','solaredge','huawei','sofar','zcs','goodwe','sungrow','victron','enphase','sma'],
        'batteria': ['battery','soc','storage','accumulo','pylontech','bms','powerwall','sonnen'],
        'wallbox': ['wallbox','charger','evse','evcc','ocpp','keba','wattpilot','easee','zappi','goe','go_e'],
        'clima': ['climate','ac','air_conditioner','hvac','daikin','mitsubishi','samsung','split','condizionatore','melcloud','sensibo'],
        'boiler': ['boiler','water_heater','acs','dhw','scaldabagno','termoaccumulo','puffer'],
        'consumo': ['consumption','load','house','home','used','assorbimento'],
        'rete': ['grid','mains','net','import','export'],
        'telecamera': ['camera','cam','ipcam','reolink','tapo','hikvision','dahua','frigate','ezviz'],
        'luce': ['light','lamp','led','hue','shelly','dimmer','strip'],
        'cancello': ['gate','garage','door_opener','sliding'],
        'speedtest': ['speedtest','download','upload','ping','fastcom'],
        'potenza': ['power','watt','watts','active_power'],
        'script': ['script'], 'apertura': ['open','apri'], 'stato': [], 'decodificato': ['decoded','stato'],
        'fase': ['phase','fase','cycle'], 'corrente': ['current'], 'rimanente': ['remaining','left'],
        'programma': ['program','course'], 'centrifuga': ['spin','centrifuga'],
    };
    const UNIT_HINTS = [
        [/kwh|energia|produzione|consumo|prelevata|immessa|acquistata|venduta|caricata|scaricata|usata|sessione|somma.*(oggi|mese)/i, ['kWh','Wh','MWh']],
        [/potenza|istantanea/i, ['W','kW']],
        [/temperatur/i, ['°C','°F']],
        [/soc|\(%\)|percentuale/i, ['%']],
        [/pressione/i, ['bar','psi','hPa']],
        [/autonomia|odometro|km/i, ['km','mi']],
        [/download|upload/i, ['Mbit/s','Mbps']],
        [/\bping\b/i, ['ms']],
    ];
    const PERIODS = { d: ['daily','today','oggi','giornalier'], m: ['month','mensile','mese'], y: ['year','annual','anno','annuale'] };
    function periodOf(str) {
        for (const [p, kws] of Object.entries(PERIODS)) { if (kws.some(k => str.includes(k))) return p; }
        return null;
    }
    const usedIds = new Set(Object.values(WIZ.entities).concat(Object.values(ENTITY_OVERRIDES || {})));
    Object.values(CD_SLOTS).forEach(sec => sec.slots.forEach(sl => {
        if (WIZ.entities[sl.ref] || ENTITY_OVERRIDES[sl.ref]) return;
        const dom = sl.ref.startsWith('dm.') ? '' : sl.ref.split('.')[0];
        const lblLow = sl.lbl.toLowerCase();
        const words = lblLow.replace(/\([^)]*\)/g, '').split(/[^a-zà-ù]+/).filter(w => w.length >= 3 && !STOP.has(w));
        if (!words.length) return;
        const keyLists = words.map(w => [w].concat(SYN[w] || []));
        const lblPeriod = periodOf(lblLow);
        let units = null;
        for (const [rx, u] of UNIT_HINTS) { if (rx.test(sl.lbl)) { units = u; break; } }
        const scored = [];
        M.forEach(e => {
            if (dom && !e.id.startsWith(dom + '.')) return;
            if (usedIds.has(e.id)) return;
            const idLow = e.id.toLowerCase(), nameLow = e.name.toLowerCase();
            // Conflitto di periodo: "oggi" non può matchare un sensore "mensile" e viceversa
            const entPeriod = periodOf(idLow + ' ' + nameLow);
            if (lblPeriod && entPeriod && lblPeriod !== entPeriod) return;
            // Match per TOKEN: parola intera, o prefisso per chiavi >= 4 caratteri
            const idTok = idLow.split(/[^a-z0-9]+/), nameTok = nameLow.split(/[^a-z0-9]+/);
            const tokMatch = (toks, k) => toks.some(t => t === k || (k.length >= 4 && t.startsWith(k)));
            let score = 0, idHits = 0, listsMatched = 0;
            keyLists.forEach(list => {
                if (list.some(k => tokMatch(idTok, k))) { score += 3; idHits++; listsMatched++; }
                else if (list.some(k => tokMatch(nameTok, k))) { score += 2; listsMatched++; }
            });
            if (listsMatched < Math.max(1, Math.ceil(keyLists.length * 0.6))) return;
            if (units) { if (units.includes(e.unit)) score += 3; else if (e.unit) score -= 2; }
            /* v0.9.6: boost forte quando la CLASSE dell'entità combacia con lo slot — molto più
               affidabile del nome. Es. slot "Temperatura" + device_class:temperature = match sicuro. */
            const _slotDC = { temperatura:'temperature', umidita:'humidity', pressione:'pressure',
                              potenza:'power', energia:'energy', tensione:'voltage', corrente:'current',
                              batteria:'battery', illuminamento:'illuminance' };
            for (const [kw, dcv] of Object.entries(_slotDC)) {
                if (lblLow.includes(kw) && e.dc === dcv) { score += 5; break; }
            }
            // slot energetici (kWh, _oggi/_mese): premia i sensori con state_class total/total_increasing
            if (units && units.includes('kWh') && (e.sc === 'total' || e.sc === 'total_increasing')) score += 3;
            // se lo slot e l'entità sono nella STESSA area HA, piccolo bonus
            if (e.area && lblLow.includes(e.area.toLowerCase())) score += 2;
            if (score > 0) scored.push({ e, score, idHits, len: e.id.length });
        });
        if (!scored.length) return;
        scored.sort((a, b) => b.score - a.score || b.idHits - a.idHits || a.len - b.len);
        const best = scored[0];
        const minScore = keyLists.length === 1 ? 3 : Math.max(5, keyLists.length * 2);
        if (best.score < minScore) return;
        if (scored.length > 1 && scored[1].score === best.score && scored[1].idHits === best.idHits && Math.abs(scored[1].len - best.len) < 3) return;
        WIZ.entities[sl.ref] = best.e.id;
        if (!WIZ.autoDetected) WIZ.autoDetected = {};
        WIZ.autoDetected[sl.ref] = true;
        usedIds.add(best.e.id);
        nSlot++;
    }));

    // — Caldaia (campo dedicato)
    if (!WIZ.entities['switch.caldaia'] && !ENTITY_OVERRIDES['switch.caldaia']) {
        const cands = M.filter(e => e.id.startsWith('switch.') && /caldaia|boiler|heater|heating/i.test(e.id + ' ' + e.name));
        if (cands.length === 1) { WIZ.entities['switch.caldaia'] = cands[0].id; if (!WIZ.autoDetected) WIZ.autoDetected = {}; WIZ.autoDetected['switch.caldaia'] = true; nSlot++; }
    }

    wzRender();
    const _counts = { nSlot, nLuci, nClima, nCam, nStanze, nAvvisi };
    if (!WIZ._silentDetect) alert('🪄 Detection complete!\n\n' +
        (nSlot ? '🧩 ' + nSlot + ' entities linked\n' : '') +
        (nLuci ? '💡 ' + nLuci + ' lights\n' : '') +
        (nClima ? '❄️ ' + nClima + ' climate units\n' : '') +
        (nCam ? '📹 ' + nCam + ' cameras\n' : '') +
        (nStanze ? '🌡️ ' + nStanze + ' rooms\n' : '') +
        (nAvvisi ? '🔔 ' + nAvvisi + ' alerts\n' : '') +
        '\nReview the proposals in the accordions: you can freely edit or remove anything.');
    return _counts;
}

function wzAddDevice() {
    const icon = (document.getElementById('wz-dev-icon').value || '🔌').trim();
    const name = (document.getElementById('wz-dev-name').value || '').trim();
    const sw = (document.getElementById('wz-dev-sw').value || '').trim();
    const pw = (document.getElementById('wz-dev-pw').value || '').trim();
    const sv = (document.getElementById('wz-dev-sv').value || '').trim();
    if (!name || (!sw && !pw && !sv)) { alert('Enter a name and at least one entity'); return; }
    if (!WIZ.devices) WIZ.reportDevices = cdCfgList('cd_report_devices');
    WIZ.devices = [];
    const d = { name, icon };
    if (sw.includes('.')) d.switch = sw;
    if (pw.includes('.')) d.power = pw;
    if (sv.includes('.')) d.sensor = sv;
    WIZ.devices.push(d);
    wzRender();
}
/* v299 (richiesta community): riordino e modifica delle stanze senza cancellare */
function wzMoveStanza(i, dir) {
    const a = WIZ.stanze;
    const j = i + dir;
    if (!a || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    wzRender();
}

function wzEditStanza(i) {
    const s = (WIZ.stanze || [])[i];
    if (!s) return;
    document.getElementById('wz-st-name').value = s.name || '';
    document.getElementById('wz-st-icon').value = s.icon || '';
    document.getElementById('wz-st-temp').value = s.temp || '';
    document.getElementById('wz-st-hum').value = s.hum || '';
    const flEl = document.getElementById('wz-st-floor'); if (flEl) flEl.value = s.floor || '';
    WIZ._editStanza = i;
    const btn = document.getElementById('wz-st-add-btn');
    if (btn) btn.textContent = '💾 Save changes';
    document.getElementById('wz-st-name')?.focus();
}

function wzAddReportDevice() {
    const name = (document.getElementById('wz-rep-name').value || '').trim();
    const icon = (document.getElementById('wz-rep-icon').value || '⚡').trim();
    const ent = (document.getElementById('wz-rep-ent').value || '').trim();
    if (!name || !ent.includes('.')) { alert('Enter a name and entity'); return; }
    if (!WIZ.reportDevices) WIZ.reportDevices = [];
    WIZ.reportDevices.push({ name, icon, entity: ent });
    wzRender();
}

function wzAddAvviso() {
    const grp = document.getElementById('wz-av-grp').value;
    const name = (document.getElementById('wz-av-name').value || '').trim();
    const ent = (document.getElementById('wz-av-ent').value || '').trim();
    if (!ent.includes('.')) { alert('Enter a valid entity'); return; }
    if (grp === 'custom') {
        const cond  = (document.getElementById('wz-av-cond') || {}).value || 'on';
        const value = ((document.getElementById('wz-av-val') || {}).value || '').trim();
        const icon  = (((document.getElementById('wz-av-icon') || {}).value) || '⚠️').trim() || '⚠️';
        if (['eq','neq','gt','lt'].includes(cond) && value === '') { alert('Enter the value for the chosen condition'); return; }
        const list = cdCfgList('cd_avvisi_custom');
        list.push({ entity: ent, name: name || ent, icon, cond, value });
        localStorage.setItem('cd_avvisi_custom', JSON.stringify(list));
        try { cdMarkDirty(); cdSyncPush && cdSyncPush(); } catch(e){}
        wzRender();
        return;
    }
    const extG = cdCfg('cd_gruppi_extra');
    if (!extG[grp]) extG[grp] = [];
    if (!extG[grp].includes(ent)) extG[grp].push(ent);
    localStorage.setItem('cd_gruppi_extra', JSON.stringify(extG));
    try { cdMarkDirty(); } catch(e){}
    if (name) {
        const extN = cdCfg('cd_avvisi_names_extra');
        extN[ent] = name;
        localStorage.setItem('cd_avvisi_names_extra', JSON.stringify(extN));
    }
    if (GRUPPI_MONITORAGGIO[grp] && !GRUPPI_MONITORAGGIO[grp].includes(ent)) GRUPPI_MONITORAGGIO[grp].push(ent);
    wzRender();
}
function wzDelAvvisoCustom(i) {
    const list = cdCfgList('cd_avvisi_custom');
    if (i < 0 || i >= list.length) return;
    list.splice(i, 1);
    localStorage.setItem('cd_avvisi_custom', JSON.stringify(list));
    try { cdMarkDirty(); cdSyncPush && cdSyncPush(); } catch(e){}
    wzRender();
}
function wzDelAvviso(grp, id) {
    const extG = cdCfg('cd_gruppi_extra');
    if (extG[grp] && extG[grp].includes(id)) {
        extG[grp] = extG[grp].filter(x => x !== id);
        if (!extG[grp].length) delete extG[grp];
        localStorage.setItem('cd_gruppi_extra', JSON.stringify(extG));
        if (GRUPPI_MONITORAGGIO[grp]) GRUPPI_MONITORAGGIO[grp] = GRUPPI_MONITORAGGIO[grp].filter(x => x !== id);
    } else {
        const rem = cdCfg('cd_gruppi_removed');
        if (!rem[grp]) rem[grp] = [];
        if (!rem[grp].includes(id)) rem[grp].push(id);
        localStorage.setItem('cd_gruppi_removed', JSON.stringify(rem));
    }
    if (GRUPPI_MONITORAGGIO[grp]) GRUPPI_MONITORAGGIO[grp] = GRUPPI_MONITORAGGIO[grp].filter(x => x !== id);
    wzRender();
}
function wzAddStanza() {
    if (typeof WIZ._editStanza === 'number') {
        const s = WIZ.stanze[WIZ._editStanza];
        if (s) {
            s.name = (document.getElementById('wz-st-name').value || s.name).trim();
            s.icon = (document.getElementById('wz-st-icon').value || s.icon).trim();
            s.temp = (document.getElementById('wz-st-temp').value || s.temp).trim();
            const h = (document.getElementById('wz-st-hum').value || '').trim();
            if (h) s.hum = h; else delete s.hum;
            const fl2 = (document.getElementById('wz-st-floor')?.value || '').trim();
            if (fl2) s.floor = fl2; else delete s.floor;
        }
        delete WIZ._editStanza;
        wzRender();
        return;
    }
    const icon = (document.getElementById('wz-st-icon').value || '🏠').trim();
    const name = (document.getElementById('wz-st-name').value || '').trim();
    const temp = (document.getElementById('wz-st-temp').value || '').trim();
    const hum = (document.getElementById('wz-st-hum').value || '').trim();
    if (!name || !temp.includes('.')) { alert('Enter a name and temperature sensor'); return; }
    if (!WIZ.stanze) WIZ.stanze = [];
    const r = { name, icon, temp };
    if (hum.includes('.')) r.hum = hum;
    WIZ.stanze.push(r);
    wzRender();
}

function wzAddStanza() {
    const icon = (document.getElementById('wz-st-icon').value || '🏠').trim();
    const name = (document.getElementById('wz-st-name').value || '').trim();
    const temp = (document.getElementById('wz-st-temp').value || '').trim();
    const hum = (document.getElementById('wz-st-hum').value || '').trim();
    if (!name || !temp.includes('.')) { alert('Enter a name and temperature sensor'); return; }
    if (!WIZ.stanze) WIZ.stanze = [];
    const r = { name, icon, temp };
    if (hum.includes('.')) r.hum = hum;
    WIZ.stanze.push(r);
    wzRender();
}
function wzAddClima() {
    const type = document.getElementById('wz-cl-type').value;
    const name = (document.getElementById('wz-cl-name').value || '').trim();
    const ent = (document.getElementById('wz-cl-ent').value || '').trim();
    if (!name || !ent.includes('.')) { alert('Enter a name and entity'); return; }
    if (!WIZ.climaUnits) WIZ.climaUnits = [];
    WIZ.climaUnits.push({ name, entity: ent, type });
    wzRender();
}
function wzAddCamera() {
    const name = (document.getElementById('wz-cam-name').value || '').trim();
    const ent = (document.getElementById('wz-cam-ent').value || '').trim();
    const stream = (document.getElementById('wz-cam-stream').value || '').trim();
    if (!name || !ent.includes('.')) { alert('Enter a name and camera entity'); return; }
    if (!WIZ.cameras) WIZ.cameras = [];
    const cam = { name, entity: ent };
    if (stream) cam.stream = stream;
    WIZ.cameras.push(cam);
    wzRender();
}
function wzResetAll() {
    if (!confirm('Delete ALL saved configuration?\n\n⚠️ The config is synced through Home Assistant: it will be removed from ALL linked devices. You will have to run the wizard again.')) return;
    window._cdResetting = true;   // stop render loops during teardown (no null errors)
    // 1) clear the copy on Home Assistant so sync won't restore it on reload
    try { if (typeof ws !== 'undefined' && ws && ws.readyState === 1) ws.send(JSON.stringify({ id: msgId++, type: 'frontend/set_user_data', key: (window.__DASHBOARDMODERN_HOSTED__ ? ('dashboardmodern_integration_config' + (window.__DASHBOARDMODERN_PRIMARY__ === false && window.__DASHBOARDMODERN_INSTANCE__ ? '__' + String(window.__DASHBOARDMODERN_INSTANCE__).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) : '')) : 'dashboard' + '_modern_config'), value: { __ts: Date.now() } })); } catch(e) {}
    // 2) clear all local keys + sync state
    const keys = (typeof CD_SYNC_KEYS !== 'undefined' ? CD_SYNC_KEYS.slice() : []).concat(['cd_theme','cd_navbar_mode','cd_sync_ts','cd_sync_dirty']);
    keys.forEach(k => { try { localStorage.removeItem(k); } catch(e) {} });
    // 3) reload clean (no hash, to avoid a loop with #reset)
    try { localStorage.setItem('dm_fresh_start', '1'); } catch(e) {}
    setTimeout(() => location.replace(location.pathname + (location.search || '')), 450);
}
/* v298: applica la modalità barra fissa a livello CSS — funziona ovunque */
function cdApplyNavFixedBody() {
    const fixed = localStorage.getItem('cd_navbar_mode') === 'fixed';
    document.body.classList.toggle('cd-nav-fixed', fixed);
    // v303: evidenzia la scelta attiva nella card di Config
    const a = document.getElementById('nav-opt-auto'), f = document.getElementById('nav-opt-fixed');
    if (a) a.classList.toggle('active', !fixed);
    if (f) f.classList.toggle('active', fixed);
}
document.addEventListener('DOMContentLoaded', cdApplyNavFixedBody);
/* E anche subito, senza aspettare il documento.
 *
 * Questo script si carica in fondo alla pagina: se il documento e' gia' pronto
 * quel listener non scatta mai piu', e la classe non la mette nessuno. La
 * barra restava «a scomparsa» finche' il modulo della navigazione non si
 * installava e la rimetteva ferma: in mezzo c'era una finestra in cui la
 * maniglia compariva e spariva da sola. */
try { cdApplyNavFixedBody(); } catch (e) {}
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('cd_open_editor_after_reload')) {
        sessionStorage.removeItem('cd_open_editor_after_reload');
        setTimeout(() => { try { apriConfigEntita(); editorSwitch('sezioni'); } catch(e) { console.warn('[v0.7] apertura editor:', e); } }, 900);
    }
});

function wzSetNavMode(mode) {
    localStorage.setItem('cd_navbar_mode', mode);
    try { cdMarkDirty(); } catch(e){}
    cdApplyNavFixedBody();
    if (window.cdApplyNavMode) window.cdApplyNavMode();
    // v297: wzRender solo se il wizard è aperto (dalla Config il wizard non c'è)
    if (document.getElementById('wz-overlay')) { try { wzRender(); } catch(e){} }
}

/* ═══ v0.7.0 "One Editor": il wizard si ferma alle sezioni. Rilevamento automatico
   integrato, poi salvataggio e apertura diretta dell'editor (unico luogo di configurazione). ═══ */
async function wzFinishV7(withDetect) {
    if (withDetect) {
        /* v0.8.3: se le entità non sono ancora arrivate le carico e ASPETTO (fino a 15s),
           invece di fermarmi con "Attendi il caricamento…" */
        if (!WIZ.allMeta || !WIZ.allMeta.length) {
            wzShowWait('⏳ Reading all entities from Home Assistant…');
            try { wzLoadAllEntities(); } catch(e) {}
            const t0 = Date.now();
            while ((!WIZ.allMeta || !WIZ.allMeta.length) && Date.now() - t0 < 15000) {
                await new Promise(r => setTimeout(r, 400));
            }
            wzHideWait();
        }
        if (!WIZ.allMeta || !WIZ.allMeta.length) {
            alert('⚠️ I cannot read entities from Home Assistant.\nCheck URL and token in the connection step, then retry.');
            return;
        }
        let counts = null;
        WIZ._silentDetect = true;
        try { counts = wzAutoDetect(); } catch(e) { console.warn('[wizard] auto-detect:', e); }
        WIZ._silentDetect = false;
        wzShowDetectSummary(counts || {});
        return; /* wzFinish parte dal bottone del riepilogo */
    }
    sessionStorage.setItem('cd_open_editor_after_reload', '1');
    wzFinish();
}

function wzShowWait(txt) {
    let ov = document.getElementById('cd-wz-wait'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'cd-wz-wait';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.innerHTML = '<div style="background:var(--card-bg,#fff);border-radius:20px;padding:26px 30px;font-weight:900;font-size:15px;box-shadow:0 20px 60px rgba(0,0,0,0.4);">' + txt + '</div>';
    document.body.appendChild(ov);
}
function wzHideWait() { const ov = document.getElementById('cd-wz-wait'); if (ov) ov.remove(); }

/* v0.8.3: RIEPILOGO RILEVAMENTO — quante entità e DOVE sono state assegnate */
function wzShowDetectSummary(n) {
    const rows = [
        ['🧩', 'Section entities (Energy, Boiler, EV, MiniPC…)', n.nSlot],
        ['💡', 'Lights', n.nLuci],
        ['❄️', 'Climate units', n.nClima],
        ['📹', 'Cameras', n.nCam],
        ['🌡️', 'Rooms (temperature + humidity)', n.nStanze],
        ['🔔', 'Alerts board (openings, batteries, lights, climate)', n.nAvvisi],
    ].filter(r => r[2] > 0);
    const tot = rows.reduce((s, r) => s + r[2], 0);
    let ov = document.getElementById('cd-wz-summary'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'cd-wz-summary';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:20px;';
    /* v0.8.4: on an already-configured system detection adds no duplicates — say it. */
    let existing = [];
    if (!tot) {
        try {
            const ov = Object.keys(cdCfg('cd_entity_overrides')).length;
            const st = cdCfgList('cd_stanze').length, lu = Object.keys(cdCfg('cd_luci')).length;
            const cl = cdCfgList('cd_clima_units').length, cam = cdCfgList('cd_cameras').length;
            if (ov) existing.push('🧩 ' + ov + ' entities');
            if (lu) existing.push('💡 ' + lu + ' lights');
            if (cl) existing.push('❄️ ' + cl + ' climate');
            if (cam) existing.push('📹 ' + cam + ' cameras');
            if (st) existing.push('🌡️ ' + st + ' rooms');
        } catch(e) {}
    }
    let already = 0;
    try { already = Object.keys(cdCfg('cd_entity_overrides')).length + cdCfgList('cd_stanze').length + cdCfgList('cd_clima_units').length + cdCfgList('cd_cameras').length + Object.keys(cdCfg('cd_luci')).length; } catch(e) {}
    const body = tot
        ? rows.map(r => `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;background:rgba(148,163,184,0.10);"><span style="font-size:20px;">${r[0]}</span><span style="flex:1;font-weight:800;font-size:13px;">${r[1]}</span><span style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:#059669;">${r[2]}</span></div>`).join('')
        : (existing.length
            ? '<div style="padding:14px;border-radius:14px;background:rgba(16,185,129,0.10);color:#047857;font-weight:800;font-size:13px;">✅ Everything already configured (' + existing.join(' · ') + ').<br>Detection only adds what is missing: no duplicates.</div>'
            : (already > 0 ? '<div style="padding:14px;border-radius:14px;background:rgba(16,185,129,0.12);color:#047857;font-weight:800;font-size:13px;">✅ Everything already configured (' + already + ' active items): nothing new to add — detection only proposes what is missing.</div>' : '<div style="padding:14px;border-radius:14px;background:rgba(245,158,11,0.12);color:#b45309;font-weight:800;font-size:13px;">😕 No entities recognized automatically: you can assign them manually from the editor with 🔍 search.</div>'));
    ov.innerHTML = `<div style="background:var(--card-bg,#fff);border-radius:24px;padding:24px;width:min(460px,100%);max-height:82vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:8px;">
        <div style="font-weight:900;font-size:18px;margin-bottom:4px;">🪄 Detection complete</div>
        ${tot ? '<div style="font-weight:800;font-size:13px;color:var(--text-dim,#64748b);margin-bottom:6px;">' + tot + ' elementi assegnati automaticamente:</div>' : ''}
        ${body}
        <div style="font-size:12px;color:var(--text-dim,#64748b);font-weight:700;margin-top:6px;">You can review, fix or remove every proposal from the editor.</div>
        <button class="ed-save-btn" style="margin-top:10px;" onclick="sessionStorage.setItem('cd_open_editor_after_reload','1'); document.getElementById('cd-wz-summary').remove(); wzFinish();">✅ Great, open the editor →</button>
    </div>`;
    document.body.appendChild(ov);
}

function wzFinish() {
    if (!window.__DASHBOARDMODERN_HOSTED__) localStorage.setItem('cd_connection', JSON.stringify({ token: WIZ.token, admin_users: WIZ.admin ? [WIZ.admin] : [], remote_url: WIZ.remoteUrl || '' }));
    localStorage.setItem('cd_branding', JSON.stringify({ title: WIZ.title, subtitle: WIZ.subtitle }));
    localStorage.setItem('cd_sections', JSON.stringify(WIZ.sections));
    if (WIZ.sectionNames && Object.keys(WIZ.sectionNames).length) localStorage.setItem('cd_section_names', JSON.stringify(WIZ.sectionNames));
    else localStorage.removeItem('cd_section_names');
    if (Object.keys(WIZ.luci).length) localStorage.setItem('cd_luci', JSON.stringify(WIZ.luci));
    if (WIZ.cameras) localStorage.setItem('cd_cameras', JSON.stringify(WIZ.cameras));
    if (WIZ.climaUnits) localStorage.setItem('cd_clima_units', JSON.stringify(WIZ.climaUnits));
    if (WIZ.stanze) localStorage.setItem('cd_stanze', JSON.stringify(WIZ.stanze));
    if (WIZ.devices) localStorage.setItem('cd_devices', JSON.stringify(WIZ.devices));
    if (WIZ.reportDevices) localStorage.setItem('cd_report_devices', JSON.stringify(WIZ.reportDevices));
    if (WIZ.stanze) localStorage.setItem('cd_stanze', JSON.stringify(WIZ.stanze));
    if (WIZ.devices) localStorage.setItem('cd_devices', JSON.stringify(WIZ.devices));
    if (WIZ.reportDevices) localStorage.setItem('cd_report_devices', JSON.stringify(WIZ.reportDevices));
    if (WIZ.quickActions) localStorage.setItem('cd_quick_actions', JSON.stringify(WIZ.quickActions));
    if (WIZ.evImage !== undefined) localStorage.setItem('cd_ev_image', JSON.stringify(WIZ.evImage || ''));
    if (WIZ.entities && Object.keys(WIZ.entities).length) {
        const cur = cdCfg('cd_entity_overrides');
        Object.assign(cur, WIZ.entities);
        localStorage.setItem('cd_entity_overrides', JSON.stringify(cur));
    }
    // v290: la config del wizard viene salvata su HA prima del reload (sync multi-dispositivo)
    try { cdMarkDirty(); cdSyncPush(); } catch(e) {}
    setTimeout(() => location.reload(), 600);
}

/* ═══ v257: REGISTRY SLOT — entità di riferimento per sezione, con etichette umane.
   Il configuratore UI (tab Sezioni dell'editor) le presenta come form: l'utente
   sceglie la propria entità e il sistema salva un override. Il motore non cambia. ═══ */
const CD_SLOTS = {
    home: { label: '🏠 Home', slots: [
        { ref: 'dm.home_meteo',                 lbl: 'Meteo (entità weather)' },
        { ref: 'dm.home_meteo_temperatura', lbl: 'Weather station: outdoor temperature (sensor)' },
        { ref: 'dm.home_meteo_umidita', lbl: 'Weather station: humidity (sensor)' },
        { ref: 'dm.home_meteo_percepita', lbl: 'Weather station: feels-like temperature (sensor)' },
        { ref: 'dm.home_meteo_vento', lbl: 'Weather station: wind speed (sensor)' },
        { ref: 'dm.home_meteo_vento_direzione', lbl: 'Weather station: wind direction (sensor)' },
        { ref: 'dm.security_centrale_allarme', lbl: 'Allarme (alarm_control_panel)' },
        { ref: 'dm.home_interruttore_antifurto',     lbl: 'Interruttore antifurto (switch)' },
        { ref: 'dm.home_script_apertura_cancello',         lbl: 'Script apertura cancello' },
    ]},
    energy: { label: '⚡ Energy', slots: [
        { ref: 'dm.energy_produzione_solare_oggi',        lbl: 'Produzione solare oggi (kWh)' },
        { ref: 'dm.energy_consumo_casa_oggi',  lbl: 'Consumo casa oggi (kWh)' },
        { ref: 'dm.energy_energia_prelevata_oggi',     lbl: 'Energy prelevata oggi (kWh)' },
        { ref: 'dm.energy_energia_immessa_oggi',       lbl: 'Energy immessa oggi (kWh)' },
        { ref: 'dm.energy_batteria_caricata_oggi',    lbl: 'Batteria caricata oggi (kWh)' },
        { ref: 'dm.energy_batteria_scaricata_oggi', lbl: 'Batteria scaricata oggi (kWh)' },
        { ref: 'dm.energy_stato_carica_batteria',             lbl: 'Stato carica batteria (%)' },
        { ref: 'dm.energy_potenza_batteria',           lbl: 'Power batteria (W)' },
        { ref: 'dm.energy_potenza_consumo_casa',           lbl: 'Power consumo casa (W)' },
        { ref: 'dm.energy_potenza_scambio_rete',    lbl: 'Power scambio rete (W)' },
        { ref: 'dm.energy_potenza_fotovoltaico',       lbl: 'Power fotovoltaico (W)' },
        { ref: 'dm.energy_stato_rete',   lbl: 'Stato rete (on/off-grid)' },
        { ref: 'dm.energy_temperatura_dc_inverter',          lbl: 'Temperatura DC inverter (°C)' },
        { ref: 'dm.energy_temperatura_ac_inverter',          lbl: 'Temperatura AC inverter (°C)' },
        { ref: 'dm.energy_temperatura_batteria',     lbl: 'Temperatura batteria (°C)' },
        { ref: 'dm.energy_produzione_solare_anno',                lbl: 'Produzione solare anno (kWh)' },
        { ref: 'dm.energy_consumo_casa_anno',                lbl: 'Consumo casa anno (kWh)' },
        { ref: 'dm.energy_produzione_solare_mese',      lbl: 'Produzione solare mese (kWh)' },
        { ref: 'dm.energy_consumo_casa_mese',           lbl: 'Consumo casa mese (kWh)' },
        { ref: 'dm.energy_rete_acquistata_mese',   lbl: 'Rete acquistata mese (kWh)' },
        { ref: 'dm.energy_rete_venduta_mese',     lbl: 'Rete venduta mese (kWh)' },
        { ref: 'dm.energy_batteria_caricata_mese', lbl: 'Batteria caricata mese (kWh)' },
        { ref: 'dm.energy_batteria_usata_mese',    lbl: 'Batteria usata mese (kWh)' },
        { ref: 'dm.energy_potenza_carichi_nodo_2_cucina', lbl: 'Power carichi — nodo 2/Cucina (W)' },
        { ref: 'dm.energy_somma_cucina_oggi',lbl: 'Somma cucina oggi (kWh)' },
        { ref: 'dm.energy_somma_cucina_mese',    lbl: 'Somma cucina mese (kWh)' },
        { ref: 'dm.energy_potenza_carichi_nodo_1_lavanderia',     lbl: 'Power carichi — nodo 1/Lavanderia (W)' },
        { ref: 'dm.energy_somma_lavanderia_oggi',    lbl: 'Somma lavanderia oggi (kWh)' },
        { ref: 'dm.energy_somma_lavanderia_mese',        lbl: 'Somma lavanderia mese (kWh)' },
        { ref: 'dm.energy_condizionatori_oggi',       lbl: 'Condizionatori oggi (kWh)' },
        { ref: 'dm.energy_condizionatori_mese',       lbl: 'Condizionatori mese (kWh)' },
        { ref: 'dm.energy_potenza_condizionatori',           lbl: 'Power condizionatori (W)' },
        { ref: 'dm.energy_boiler_oggi',   lbl: 'Boiler oggi (kWh)' },
        { ref: 'dm.energy_boiler_mese',   lbl: 'Boiler mese (kWh)' },
        { ref: 'dm.energy_potenza_ventola_inverter', lbl: 'Power ventola inverter (W)' },
        { ref: 'dm.energy_interruttore_ventola_inverter',       lbl: 'Interruttore ventola inverter' },
    ]},
    ev: { label: '🚗 Electric car', slots: [
        { ref: 'dm.ev_batteria_auto',  lbl: 'Batteria auto (%)' },
        { ref: 'dm.ev_autonomia',    lbl: 'Autonomia (km)' },
        { ref: 'dm.ev_odometro', lbl: 'Odometro (km)' },
        { ref: 'dm.ev_autonomia_al_limite_di_carica',  lbl: 'Autonomia al limite di carica (km)' },
        { ref: 'dm.ev_km_dall_ultima_ricarica', lbl: 'Km dall\'ultima ricarica' },
        { ref: 'dm.ev_stato_ricarica',   lbl: 'Stato ricarica (testo)' },
        { ref: 'dm.ev_cavo_collegato',   lbl: 'Cable connected (binary_sensor)' },
        { ref: 'dm.ev_modalita_ricarica_evcc',        lbl: 'Modalità ricarica EVCC (select)' },
        { ref: 'dm.ev_target_soc',           lbl: 'Target SOC (select)' },
        { ref: 'dm.ev_energia_sessione',           lbl: 'Energy sessione (kWh)' },
        { ref: 'dm.ev_percentuale_solare_sessione', lbl: 'Percentuale solare sessione (%)' },
        { ref: 'dm.ev_potenza_wallbox',       lbl: 'Power wallbox (W)' },
        { ref: 'dm.ev_temperatura_wallbox',   lbl: 'Temperatura wallbox (°C)' },
        { ref: 'dm.ev_tensione_wallbox',      lbl: 'Tensione wallbox (V)' },
        { ref: 'dm.ev_prelievo_ac_totale_auto', lbl: 'Prelievo AC totale auto (kWh)' },
        { ref: 'dm.ev_energia_wallbox_oggi',  lbl: 'Energy wallbox oggi (kWh)' },
        { ref: 'dm.ev_energia_wallbox_mese',  lbl: 'Energy wallbox mese (kWh)' },
    ]},
    boiler: { label: '🌞 Solare termico', slots: [
        { ref: 'dm.boiler_potenza_resistenza_boiler',                lbl: 'Power resistenza boiler (W)' },
        { ref: 'dm.boiler_interruttore_boiler',                      lbl: 'Interruttore boiler' },
        { ref: 'dm.boiler_interruttore_solare_termico',              lbl: 'Interruttore solare termico' },
        { ref: 'dm.boiler_centralina_solare_termico',   lbl: 'Centralina solare termico' },
        { ref: 'dm.boiler_pompa_solare',    lbl: 'Pompa solare (manuale)' },
        { ref: 'dm.boiler_stato_pompa_solare', lbl: 'Stato pompa solare' },
        { ref: 'dm.boiler_sensore_pompa_solare',        lbl: 'Sensore pompa solare' },
        { ref: 'dm.boiler_delta_temperatura', lbl: 'Delta temperatura (°C)' },
        { ref: 'dm.boiler_pressione_acqua',             lbl: 'Pressione acqua (bar)' },
        { ref: 'dm.boiler_valvola_di_sicurezza',         lbl: 'Valvola di sicurezza (cover)' },
        { ref: 'dm.boiler_sonda_temperatura_1', lbl: 'Sonda temperatura 1 (°C)' },
        { ref: 'dm.boiler_sonda_temperatura_2', lbl: 'Sonda temperatura 2 (°C)' },
        { ref: 'dm.boiler_sonda_temperatura_3', lbl: 'Sonda temperatura 3 (°C)' },
    ]},
    security: { label: '🛡️ Sicurezza', slots: [
        { ref: 'dm.security_centrale_allarme', lbl: 'Centrale allarme' },
    ]},
    lavatrice: { label: '🧺 Lavatrice', slots: [
        { ref: 'dm.lavatrice_presa_avvio_lavatrice',                lbl: 'Presa/avvio lavatrice (switch)' },
        { ref: 'dm.lavatrice_potenza_presa_lavatrice_per_lavatrici_no', lbl: 'Washer plug power (W) — for non-smart washers: >5W = running' },
        { ref: 'dm.lavatrice_avvio_ciclo',      lbl: 'Avvio ciclo (switch dispositivo)' },
        { ref: 'dm.lavatrice_fase_corrente',           lbl: 'Fase corrente (testo)' },
        { ref: 'dm.lavatrice_tempo_rimanente',lbl: 'Tempo rimanente' },
        { ref: 'dm.lavatrice_programma',      lbl: 'Programma (select)' },
        { ref: 'dm.lavatrice_temperatura',    lbl: 'Temperatura (select)' },
        { ref: 'dm.lavatrice_centrifuga',     lbl: 'Centrifuga (select)' },
        { ref: 'dm.lavatrice_script_programma_rapido_14',           lbl: 'Script programma rapido 14\'' },
        { ref: 'dm.lavatrice_script_programma_30',           lbl: 'Script programma 30\'' },
        { ref: 'dm.lavatrice_script_programma_59',           lbl: 'Script programma 59\'' },
        { ref: 'dm.lavatrice_script_programma_misto_colorati', lbl: 'Script programma misto/colorati' },
    ]},
    server: { label: '🖥️ MiniPC', slots: [
        { ref: 'dm.server_cpu',    lbl: 'CPU (%)' },
        { ref: 'dm.server_ram',   lbl: 'RAM (%)' },
        { ref: 'dm.server_disco',   lbl: 'Disco (%)' },
        { ref: 'dm.server_uptime_minipc',       lbl: 'Uptime MiniPC' },
        { ref: 'dm.server_temperatura_cpu', lbl: 'Temperatura CPU (°C)' },
        { ref: 'dm.server_uptime_home_assistant',              lbl: 'Uptime Home Assistant' },
        { ref: 'dm.server_potenza_raspberry_server', lbl: 'Power Raspberry/server (W)' },
        { ref: 'dm.server_stato_internet',        lbl: 'Stato Internet (binary)' },
        { ref: 'dm.server_ping_internet',   lbl: 'Ping Internet (binary)' },
        { ref: 'dm.server_raggiungibilita_google',      lbl: 'Raggiungibilità Google (binary)' },
        { ref: 'dm.server_internet_lavanderia', lbl: 'Internet lavanderia (binary)' },
        { ref: 'dm.server_speedtest_download',  lbl: 'Speedtest Download (Mbit/s)' },
        { ref: 'dm.server_speedtest_upload',    lbl: 'Speedtest Upload (Mbit/s)' },
        { ref: 'dm.server_speedtest_ping',      lbl: 'Speedtest Ping (ms)' },
    ]},
};

/* v259: se true (build pubblica), gli slot NON mappati dall'utente non leggono i ref di
   default — mostrano "—" anche se un'entità con quel nome esiste nell'HA dell'utente. */
const CD_REQUIRE_MAPPING = true;
const CD_SLOT_REFS = new Set();
Object.values(CD_SLOTS).forEach(sec => sec.slots.forEach(sl => CD_SLOT_REFS.add(sl.ref)));

function editorRenderSezioni() {
    const allSections = Object.entries(CD_SLOTS);
    const stanze = getStanze();
    const stanzeRows = stanze.map((r, i) => !(r && r.temp) ? '' : `
        <div class="ed-row">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div class="ed-del" style="width:24px; height:20px; font-size:10px; ${i===0?'opacity:0.25; pointer-events:none;':''}" onclick="edMoveStanza(${i},-1)">▲</div>
            <div class="ed-del" style="width:24px; height:20px; font-size:10px; ${i===stanze.length-1?'opacity:0.25; pointer-events:none;':''}" onclick="edMoveStanza(${i},1)">▼</div>
          </div>
          <div style="font-size:17px; flex-shrink:0;">${r.icon||'🌡️'}</div>
          <div class="ed-row-main">
            <div class="ed-row-new">${r.name}${r.floor ? ' <span style="font-size:10px; color:var(--text-dim); font-weight:800;">· 🏢 ' + r.floor + '</span>' : ''}</div>
            <div class="ed-row-old mono">${r.temp || ""}</div>
          </div>
          
          
        </div>`).join('');

    const sezAccordions = allSections.map(([key, sec]) => {
        const rows = sec.slots.map(sl => {
            const cur = ENTITY_OVERRIDES[sl.ref] || '';
            const lbl = (cdCfg('cd_slot_labels')[sl.ref] || sl.lbl);
            return `<div class="ed-slot">
              <div class="ed-slot-lbl"><input class="wz-lbl-edit" value="${lbl.replace(/"/g,'&quot;')}" onchange="wzRenameSlot('${sl.ref}', this.value)" title="Tap to rename the label"></div>
              <div style="display:flex; gap:6px;">
                <input class="ed-input mono ed-slot-in" autocomplete="off" style="flex:1;"
                       data-ref="${sl.ref}" value="${cur}" placeholder="es. dm.core_039"
                       onchange="edSetSlot(this)">
                <button type="button" onclick="wzPickEntity('${sl.ref}')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button>
              </div>
            </div>`;
        }).join('');
        const evImgEd = key === 'ev' ? `<div class="ed-slot"><div class="ed-slot-lbl">🖼️ Car image URL (e.g. /local/my_car.png)</div>
            <input class="ed-input mono" value="${(function(){ const v = cdCfg('cd_ev_image'); return (typeof v === 'string' ? v : (v && v.url) || ''); })()}" placeholder="/local/mia_auto.png"
                   onchange="localStorage.setItem('cd_ev_image', JSON.stringify(this.value.trim())); edToast('Image saved — reload to apply');"></div>` : '';
        return `<details class="ed-acc"><summary class="ed-acc-head">${sec.label} <span class="ed-acc-n">${sec.slots.length} entities</span></summary>
            <div class="ed-acc-body">${rows}${evImgEd}<button type="button" class="ed-save-btn" onclick="edSaveSezione(this)">💾 Save section</button></div></details>`;
    }).join('');

    return `
      <div class="ed-intro">Configure each section with <b>your</b> HA entities. Leave empty to keep the default reference (if it does not exist in your HA, the card shows "—").</div>
      ${sezAccordions}

      <details class="ed-acc"><summary class="ed-acc-head">🌡️ Temperatura <span class="ed-acc-n">${stanze.length} rooms</span></summary>
        <div class="ed-acc-body">
          <div class="ed-list">${stanzeRows}
          <div style="display:flex; gap:8px; margin:10px 0 8px;">
            <input id="ed-st2-icon" class="ed-input" style="flex:0 0 56px;" placeholder="🌡️" maxlength="4">
            <select id="ed-st2-name" class="ed-input" style="flex:1;"></select>
            <input id="ed-st2-floor" class="ed-input" style="flex:0 0 30%;" placeholder="Floor (opt.)"><input id="ed-st2-flicon" class="ed-input" style="flex:0 0 52px;" placeholder="🏢" maxlength="4" title="Floor icon"><button type="button" onclick="wzPickIcon('#ed-st2-flicon')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; font-size:16px; cursor:pointer;">😀</button>
          </div>
          <div style="display:flex; gap:6px; margin-bottom:6px;">
            <input id="ed-st2-temp" class="ed-input mono" autocomplete="off" placeholder="sensor.temperature_x" style="flex:1; font-family:monospace;">
            <button type="button" onclick="wzPickEntity('#ed-st2-temp')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button>
          </div>
          <div style="display:flex; gap:6px; margin-bottom:8px;">
            <input id="ed-st2-hum" class="ed-input mono" autocomplete="off" placeholder="sensor.umidita_x (optional)" style="flex:1; font-family:monospace;">
            <button type="button" onclick="wzPickEntity('#ed-st2-hum')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button>
          </div>
          <button class="ed-btn-add" id="ed-st2-btn" style="width:100%;" onclick="edAddStanza2()">＋ Add room</button></div>
          <div class="ed-form">
            <div class="ed-form-row">
              <input id="ed-st-icon" class="ed-input ed-icon-input" placeholder="🛋️" maxlength="4">
              <input id="ed-st-name" class="ed-input" placeholder="Room name" style="flex:1;">
            </div>
            <div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-st-temp" style="flex:1;" class="ed-input mono" placeholder="sensor.temperature_x (temperatura)"><button type="button" onclick="wzPickEntity('#ed-st-temp')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>
            <div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-st-hum" style="flex:1;" class="ed-input mono" placeholder="sensor.umidita_x (optional — auto if empty)"><button type="button" onclick="wzPickEntity('#ed-st-hum')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>
            <button class="ed-btn-add" onclick="edAddStanza()">＋ Add room</button>
          </div>
        </div>
      </details>
        <details class="ed-acc"><summary class="ed-acc-head">⚡ Quick actions (Home) <span class="ed-acc-n">${getQuickActions().length} actions</span></summary>
        <div class="ed-acc-body">
          <div class="ed-list">${getQuickActions().map((a, i) => {
            const b = a.type === 'builtin' ? CD_QA_BUILTINS[a.builtin] : null;
            return `<div class="ed-row">
              <div style="font-size:16px; flex-shrink:0;">${a.icon || (b && b.icon) || '⚡'}</div>
              <div class="ed-row-main">
                <div class="ed-row-new">${a.name || (b && b.name) || '?'}</div>
                <div class="ed-row-old mono">${a.type === 'builtin' ? 'popup nativo: ' + a.builtin : (a.type === 'luci_group' ? '💡 gruppo · ' + ((a.lights||[]).length) + ' lights' : a.type + ' · ' + (a.entity||''))}</div>
              </div>
              ${a.type === 'luci_group' ? `<div class="ed-del" style="background:rgba(14,165,233,0.12);" onclick="edEditLightGroup(${i})">✏️</div>` : ''}
              <div class="ed-del" onclick="edDelQA(${i})">🗑️</div>
            </div>`;
          }).join('')}</div>
          <div class="ed-form">
            <div class="ed-form-row">
              <select id="ed-qa-type" class="ed-input" style="flex:0 0 40%;" onchange="edQaTypeChanged()">
                <option value="luci_group">💡 Lights popup — YOU pick the lights</option>
                <option value="builtin_luci">💡 Popup ALL lights</option>
                <option value="builtin_clima">❄️ Popup Clima</option>
                <option value="builtin_antifurto">🛡️ Popup Antifurto</option>
                <option value="builtin_lavatrice">🧺 Popup Lavatrice</option>
                <option value="toggle">🔀 Toggle entità</option>
                <option value="script">📜 Script</option>
                <option value="scene">🎬 Scena</option>
              </select>
              <input id="ed-qa-icon" class="ed-input ed-icon-input" placeholder="⚡" maxlength="4">
              <input id="ed-qa-name" class="ed-input" placeholder="Nome azione" style="flex:1;">
            </div>
            <div id="ed-qa-ent-row" style="display:none; gap:6px;"><input id="ed-qa-ent" autocomplete="off" class="ed-input mono" placeholder="dm.core_054 / dm.core_023 / scene.x (non serve per i popup)"><button type="button" onclick="wzPickEntity('__ed_qa__')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>
              <div id="ed-qa-hint" style="font-size:11px; color:var(--text-dim); padding:0 2px;">💡 Give it a name and press Add: you will pick the lights from a searchable list.</div>
            <input id="ed-qa-confirm" class="ed-input" placeholder="Messaggio di conferma (facoltativo, es. Sei sicuro?)">
            <button class="ed-btn-add" onclick="edAddQA()">＋ Add quick action</button>
          </div>
        </div>
      </details>
      <details class="ed-acc"><summary class="ed-acc-head">❄️ Climate units <span class="ed-acc-n">${getClimaUnits().length} units</span></summary>
        <div class="ed-acc-body">
          <div class="ed-list">${getClimaUnits().map((u, i) => `
            <div class="ed-row">
              <div style="font-size:16px; flex-shrink:0;">${u.type === 'termo' ? '🔥' : '❄️'}</div>
              <div class="ed-row-main">
                <div class="ed-row-new">${u.name} <span style="font-weight:600; color:var(--text-dim); font-size:10px;">(${u.type === 'termo' ? 'termosifone' : 'condizionatore'})</span></div>
                <div class="ed-row-old mono">${u.entity}</div>
              </div>
              <div class="ed-del" onclick="edDelClima(${i})">🗑️</div>
            </div>`).join('')}</div>
          <div class="ed-form">
            <div class="ed-form-row">
              <select id="ed-cl-type" class="ed-input" style="flex:0 0 46%;"><option value="clima">❄️ Air conditioner</option><option value="termo">🔥 Radiator</option></select>
              <input id="ed-cl-name" class="ed-input" placeholder="Name (e.g. Office)" style="flex:1;">
            </div>
            <div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-cl-ent" style="flex:1;" class="ed-input mono" placeholder="climate.studio"><button type="button" onclick="wzPickEntity('#ed-cl-ent')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>
            <select id="ed-cl-room" class="ed-input" style="margin-bottom:6px;width:100%;"></select><button class="ed-btn-add" onclick="edAddClima()">＋ Add climate unit</button>
            <div class="ed-slot" style="margin-top:10px;"><div class="ed-slot-lbl">🔥 Boiler entity (switch — optional)</div>
              <div style="display:flex; gap:8px; margin-bottom:6px;"><input style="flex:1;" class="ed-input mono ed-slot-in" data-ref="switch.caldaia" value="${ENTITY_OVERRIDES['switch.caldaia'] || ''}" placeholder="switch.caldaia" onchange="edSetSlot(this)"><button type="button" onclick="wzPickEntity(this.previousElementSibling)" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div></div>
          </div>
        </div>
      </details>
      <details class="ed-acc"><summary class="ed-acc-head">📹 Cameras <span class="ed-acc-n">${getCameras().length} cameras</span></summary>
        <div class="ed-acc-body">
          <div class="ed-list">${getCameras().map((cam, i) => `
            <div class="ed-row">
              <div class="ed-row-main">
                <div class="ed-row-new">${cam.name}</div>
                <div class="ed-row-old mono">${cam.entity}${cam.stream ? ' · stream: ' + cam.stream : ''}</div>
              </div>
              <div class="ed-del" onclick="edEditCamera(${i})">✏️</div><div class="ed-del" onclick="edDelCamera(${i})">🗑️</div>
            </div>`).join('')}</div>
          <div class="ed-form">
            <input id="ed-cam-name" class="ed-input" placeholder="Name (e.g. Garden)">
            <div style="display:flex; gap:8px; margin-bottom:6px;"><input id="ed-cam-ent" style="flex:1;" class="ed-input mono" placeholder="camera.giardino"><button type="button" onclick="wzPickEntity('#ed-cam-ent')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button></div>
            <input id="ed-cam-stream" class="ed-input mono" placeholder="go2rtc stream name (optional, for WebRTC)">
            <select id="ed-cam-room" class="ed-input" style="margin-bottom:6px;width:100%;"></select><button class="ed-btn-add" onclick="edAddCamera()">＋ Add camera</button><button type="button" class="ed-save-btn" onclick="edSaveSezione(this)">💾 Save section</button>
          </div>
        </div>
      </details>
      <details class="ed-acc"><summary class="ed-acc-head">💡 Luci <span class="ed-acc-n">${Object.keys((function(){ try { return JSON.parse(localStorage.getItem('cd_luci')) || {}; } catch(e) { return {}; } })()).length}</span></summary>
        <div class="ed-acc-body">
          <div class="ed-slot-lbl" style="margin-bottom:6px;">The lights managed by the dashboard. Name them "Room - Detail" for automatic grouping.</div>
          ${(function(){ let L = {}; try { L = JSON.parse(localStorage.getItem('cd_luci')) || {}; } catch(e) {} return Object.entries(L).map(([id, nm]) => `<div class="ed-row"><div style="font-size:15px;">💡</div><div class="ed-row-main"><div class="ed-row-new">${nm}</div><div class="ed-row-old mono">${id}</div></div><div class="ed-del" onclick="edDelLuce('${id}')">🗑️</div></div>`).join('') || '<div class="ed-empty">No lights configured</div>'; })()}
          <div style="display:flex; gap:8px; margin:10px 0 8px;">
            <input id="ed-lu-name" class="ed-input" style="flex:1;" placeholder="Name (e.g. Living Room - Floor lamp)">
          </div>
          <div style="display:flex; gap:6px; margin-bottom:8px;">
            <input id="ed-lu-ent" class="ed-input mono" autocomplete="off" placeholder="dm.core_022" style="flex:1; font-family:monospace;">
            <button type="button" onclick="wzPickEntity('#ed-lu-ent')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button>
          </div>
          <select id="ed-lu-room" class="ed-input" style="margin-bottom:6px;width:100%;"></select><button class="ed-btn-add" style="width:100%;" onclick="edAddLuce()">＋ Add light</button>
        </div>
      </details>
      <details class="ed-acc"><summary class="ed-acc-head">📊 Report Analisi <span class="ed-acc-n">${cdCfgList('cd_report_devices').length} entries</span></summary>
        <div class="ed-acc-body">
          <div class="ed-slot-lbl" style="margin-bottom:6px;">The monthly Report entries (Energy → Analysis): free name, icon and entity.</div>
          ${cdCfgList('cd_report_devices').map((d, ri) => `<div class="ed-row"><div style="font-size:15px;">${d.icon||'⚡'}</div><div class="ed-row-main"><div class="ed-row-new">${d.name}</div><div class="ed-row-old mono">${d.entity}</div></div><div class="ed-del" onclick="edDelReportDevice(${ri})">🗑️</div></div>`).join('') || '<div class="ed-empty">No entries</div>'}
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <input id="ed-rep2-icon" class="ed-input" style="flex:0 0 60px;" placeholder="⚡" maxlength="4"><button type="button" onclick="wzPickIcon('#ed-rep2-icon')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; font-size:16px; cursor:pointer;">😀</button>
            <input id="ed-rep2-name" class="ed-input" style="flex:1;" placeholder="Name (e.g. Pool)">
          </div>
          <div style="display:flex; gap:6px; margin-bottom:8px;">
            <input id="ed-rep2-ent" class="ed-input mono" autocomplete="off" placeholder="dm.core_028" style="flex:1; font-family:monospace;">
            <button type="button" onclick="wzPickEntity('#ed-rep2-ent')" style="flex:0 0 38px; height:38px; border:none; border-radius:10px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:14px; cursor:pointer;">🔍</button>
          </div>
          <button class="ed-btn-add" style="width:100%;" onclick="edAddReportDevice2()">＋ Add Report entry</button>
        </div>
      </details>`;
}



function edQaTypeChanged() {
    const t = document.getElementById('ed-qa-type')?.value || '';
    const entRow = document.getElementById('ed-qa-ent-row');
    const hint = document.getElementById('ed-qa-hint');
    const needsEntity = ['toggle','script','scene'].includes(t);
    if (entRow) entRow.style.display = needsEntity ? 'flex' : 'none';
    if (hint) hint.textContent = t === 'luci_group'
        ? '💡 Give it a name and press Add: you will pick the lights from a searchable list.'
        : (needsEntity ? '🔀 Type or pick with 🔍 the entity to control.' : '✨ Popup ready: optional name and press Add.');
}

function edEditLightGroup(i) {
    const acts = getQuickActions().slice();
    const a = acts[i];
    if (!a || a.type !== 'luci_group') return;
    cdPickLights(a.name || 'Gruppo', (lights) => {
        a.lights = lights;
        localStorage.setItem('cd_quick_actions', JSON.stringify(acts));
        buildQuickActions();
        editorSwitch('sezioni');
        edToast('Light group updated');
    }, a.lights || []);
}

function edAddQA() {
    const tsel = document.getElementById('ed-qa-type').value;
    const icon = (document.getElementById('ed-qa-icon').value || '').trim();
    const name = (document.getElementById('ed-qa-name').value || '').trim();
    const ent = (document.getElementById('ed-qa-ent').value || '').trim();
    const conf = (document.getElementById('ed-qa-confirm').value || '').trim();
    const list = getQuickActions().slice();
    if (tsel === 'luci_group') {
        const name = (document.getElementById('ed-qa-name').value || '').trim();
        if (!name) { alert('Name the group (es. Piano Terra)'); return; }
        cdPickLights(name, (lights) => {
            const acts = getQuickActions().slice();
            acts.push({ type: 'luci_group', name, icon: '💡', lights });
            localStorage.setItem('cd_quick_actions', JSON.stringify(acts));
            buildQuickActions();
            editorSwitch('sezioni');
            edToast('Light group created');
        });
        return;
    }
    if (tsel.startsWith('builtin_')) {
        const b = tsel.replace('builtin_','');
        const a = { type: 'builtin', builtin: b };
        if (name) a.name = name;
        if (icon) a.icon = icon;
        list.push(a);
    } else {
        if (!name || !ent.includes('.')) { alert('Enter a name and entity valida'); return; }
        const a = { type: tsel, name, entity: ent };
        if (icon) a.icon = icon;
        if (conf) a.confirm = conf;
        list.push(a);
    }
    localStorage.setItem('cd_quick_actions', JSON.stringify(list));
    buildQuickActions();
    editorSwitch('sezioni');
    edToast('Azione aggiunta');
}
function edDelQA(i) {
    const list = getQuickActions().slice();
    list.splice(i, 1);
    localStorage.setItem('cd_quick_actions', JSON.stringify(list));   // [] = nessuna azione, blocco nascosto
    buildQuickActions();
    editorSwitch('sezioni');
}

function edAddDevice() {
    const icon = (document.getElementById('ed-dev-icon').value || '🔌').trim();
    const name = (document.getElementById('ed-dev-name').value || '').trim();
    const sw = (document.getElementById('ed-dev-sw').value || '').trim();
    const pw = (document.getElementById('ed-dev-pw').value || '').trim();
    const sv = (document.getElementById('ed-dev-sv').value || '').trim();
    if (!name || (!sw && !pw && !sv)) { alert('Enter a name and at least one entity'); return; }
    const devs = getDevices().slice();
    const d = { name, icon };
    if (sw.includes('.')) d.switch = sw;
    if (pw.includes('.')) d.power = pw;
    if (sv.includes('.')) d.sensor = sv;
    devs.push(d);
    localStorage.setItem('cd_devices', JSON.stringify(devs));
    buildDeviceCards();
    editorSwitch('sezioni');
    edToast('Appliance added');
}
function edDelDevice(i) {
    const devs = getDevices().slice();
    devs.splice(i, 1);
    localStorage.setItem('cd_devices', JSON.stringify(devs));
    buildDeviceCards();
    editorSwitch('sezioni');
}
function edAddClima() {
    const type = document.getElementById('ed-cl-type').value;
    const name = (document.getElementById('ed-cl-name').value || '').trim();
    const ent = (document.getElementById('ed-cl-ent').value || '').trim();
    if (!name || !ent.includes('.')) { alert('Enter a name and a valid climate entity'); return; }
    const units = getClimaUnits().slice();
    units.push({ name, entity: ent, type, room:(document.getElementById('ed-cl-room')||{}).value||'' });
    localStorage.setItem('cd_clima_units', JSON.stringify(units));
    buildClimaCards();
    buildDeviceCards();
    editorSwitch('sezioni');
    edToast('Climate unit added');
}
function edDelClima(i) {
    const units = getClimaUnits().slice();
    units.splice(i, 1);
    localStorage.setItem('cd_clima_units', JSON.stringify(units));
    buildClimaCards();
    editorSwitch('sezioni');
}
let _dmCameraEditIndex=null;
function edEditCamera(i){ var c=getCameras()[i]; if(!c)return; _dmCameraEditIndex=i; document.getElementById('ed-cam-name').value=c.name||''; document.getElementById('ed-cam-ent').value=c.entity||''; document.getElementById('ed-cam-stream').value=c.stream||''; var room=document.getElementById('ed-cam-room'); if(room) room.value=c.room_id||c.room||''; }
function dmSaveCameras(cams){ var store=globalThis.DashboardModernModules&&DashboardModernModules.store; if(store) return store.replaceSection('cameras',cams).catch(function(e){ alert('Camera save failed: '+e.message); }); localStorage.setItem('cd_cameras',JSON.stringify(cams)); try{cdMarkDirty();cdSyncPush();}catch(e){} var grid=document.getElementById('cam-grid'); if(grid)grid._sig=''; buildCamCards(); refreshCameras(); try{render();}catch(e){} }
function edAddCamera() { const name=(document.getElementById('ed-cam-name').value||'').trim(), ent=(document.getElementById('ed-cam-ent').value||'').trim(), stream=(document.getElementById('ed-cam-stream').value||'').trim(); if(!name||!/^camera\.[a-z0-9_]+$/i.test(ent)){alert('Invalid camera');return;} const cams=getCameras().slice(); const nuova={id:(_dmCameraEditIndex!=null&&cams[_dmCameraEditIndex]&&cams[_dmCameraEditIndex].id)||('camera_'+Date.now().toString(36)),name:name,entity:ent,stream:stream,room_id:(document.getElementById('ed-cam-room')||{}).value||''}; if(_dmCameraEditIndex==null)cams.push(nuova);else cams[_dmCameraEditIndex]=nuova; _dmCameraEditIndex=null; dmSaveCameras(cams); if(!globalThis.DashboardModernModules) editorSwitch('sezioni'); edToast('Camera added'); }
function edDelCamera(i) { const cams=getCameras().slice(); cams.splice(i,1); _dmCameraEditIndex=null; dmSaveCameras(cams); if(!globalThis.DashboardModernModules) editorSwitch('sezioni'); }

function edSetSlot(input) {
    const ref = input.dataset.ref;
    const val = (input.value || '').trim();
    if (!val || val === ref) delete ENTITY_OVERRIDES[ref];
    else if (val.includes('.')) ENTITY_OVERRIDES[ref] = val;
    else { edToast('Invalid entity'); return; }
    localStorage.setItem('cd_entity_overrides', JSON.stringify(ENTITY_OVERRIDES));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){} try { cdSecShowByRef(ref); } catch(e){} try { cdSecShowByRef(ref); } catch(e){}
    edToast('Saved — reload to apply');
}

/* v0.7.5: SAVE SECTION — on mobile the change event may never fire (open keyboard,
   popup closing): this button collects and saves ALL fields in the section. */
async function cdBakeDownload() {
    try {
        const res = await fetch(location.pathname + '?_=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        let html = await res.text();
        const cfg = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.indexOf('cd_') === 0) { try { cfg[k] = JSON.parse(localStorage.getItem(k)); } catch(_) { cfg[k] = localStorage.getItem(k); } }
        }
        /* v0.8.8 fix (#10): uso i marker REALI del file (CD_BAKED_START/END), costruiti
           spezzati così non compaiono mai come stringa intera nel codice di questa funzione
           (era la causa del file corrotto: prima cercavo marker inesistenti e iniettavo un
           SECONDO blocco config in conflitto col primo). */
        const A = '/* CD_' + 'BAKED_START */', B = '/* CD_' + 'BAKED_END */';
        const block = A + '\nwindow.CD_BAKED_CONFIG = ' + JSON.stringify(cfg, null, 2).replace(/<\/(script)/gi, '<\\/$1') + ';\n' + B;
        const iA = html.indexOf(A), iB = html.indexOf(B);
        if (iA < 0 || iB < 0 || iB < iA) throw new Error('marcatori CD_BAKED non trovati nel file');
        html = html.slice(0, iA) + block + html.slice(iB + B.length);
        let fname = (location.pathname.split('/').pop() || 'dashboard.html');
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        document.body.appendChild(a); a.click();
        setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(a.href); } catch(e){} }, 1000);
        edToast('💾 File scaricato — sostituisci quello in /config/www: token e configurazione inclusi');
    } catch(e) { alert('Download non riuscito: ' + e.message + '\n\nRiapri la dashboard da dentro Home Assistant (/local/...) e riprova.'); }
}

function edSaveSezione(btn) {
    const body = btn.closest('.ed-acc-body');
    if (!body) return;
    let n = 0, bad = 0;
    body.querySelectorAll('.ed-slot-in').forEach(inp => {
        const ref = inp.dataset.ref;
        const val = (inp.value || '').trim();
        if (!val || val === ref) { if (ENTITY_OVERRIDES[ref]) { delete ENTITY_OVERRIDES[ref]; n++; } }
        else if (val.includes('.')) { if (ENTITY_OVERRIDES[ref] !== val) n++; ENTITY_OVERRIDES[ref] = val; }
        else bad++;
    });
    localStorage.setItem('cd_entity_overrides', JSON.stringify(ENTITY_OVERRIDES));
    try { cdMarkDirty(); cdSyncPush(); } catch(e){}
    try { cdAutoHide(); } catch(e){}
    edToast(bad ? ('⚠️ ' + bad + ' invalid entities skipped — the rest is saved') : (n ? '💾 Section saved (' + n + ' changes) — reload to apply' : '💾 Section saved'));
}

function edAddStanza() {
    const icon = (document.getElementById('ed-st-icon').value || '🏠').trim();
    const name = (document.getElementById('ed-st-name').value || '').trim();
    const temp = (document.getElementById('ed-st-temp').value || '').trim();
    const hum = (document.getElementById('ed-st-hum').value || '').trim();
    if (!name || !temp.includes('.')) { alert('Enter a name and temperature sensor'); return; }
    const stanze = getStanze().slice();
    const nuova = { name, icon, temp };
    if (hum.includes('.')) nuova.hum = hum;
    stanze.push(nuova);
    localStorage.setItem('cd_stanze', JSON.stringify(stanze));
    buildTempCards();
    editorSwitch('sezioni');
    edToast('Room added');
}
function edDelStanza(i) {
    const stanze = getStanze().slice();
    stanze.splice(i, 1);
    localStorage.setItem('cd_stanze', JSON.stringify(stanze));
    buildTempCards();
    editorSwitch('sezioni');
}

function copyEditUrl() {
    const url = window.location.origin + DASHBOARD_PATH;
    let copied = false;
    try { 
        if (navigator.clipboard) { 
            navigator.clipboard.writeText(url).then(() => { 
                const btn = event && event.target;
                if (btn) { const old = btn.textContent; btn.textContent = '✓ COPIATO'; setTimeout(() => btn.textContent = old, 2000); }
            }).catch(() => {}); 
            copied = true; 
        }
    } catch(e) {}
    if (!copied) {
        // Fallback: selezione testo + execCommand
        try {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            alert('URL copiato negli appunti');
        } catch(e) { alert(url); }
    }
}

/* v254: mostra le card "Editor Plancia" e "Configure Entities" solo agli admin. */
/* ═══ v256: GESTIONE TEMA (chiaro / scuro / auto) ═══
   Salvato in localStorage 'cd_theme','cd_navbar_mode'. 'auto' segue prefers-color-scheme del dispositivo. */
function getThemePref() { try { return localStorage.getItem('cd_theme') || 'auto'; } catch(e) { return 'auto'; } }

function applyTheme() {
    const pref = getThemePref();
    let dark = false;
    if (pref === 'dark') dark = true;
    else if (pref === 'auto') dark = window.matchMedia && (window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener: function(){} }).matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    // Aggiorna il selettore se visibile
    // v304: tocca SOLO i bottoni del tema (quelli della barra di navigazione hanno la loro logica)
    document.querySelectorAll('.theme-opt[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === pref));
}

function setTheme(pref) {
    if(navigator.vibrate) navigator.vibrate(8);
    try { localStorage.setItem('cd_theme', pref); } catch(e) {}
    applyTheme();
}

/* Applica subito (prima del render per evitare flash) + segui i cambi di sistema in modalità auto */
applyTheme();
if (window.matchMedia) {
    try {
        (window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener: function(){} }).addEventListener('change', () => {
            if (getThemePref() === 'auto') applyTheme();
        });
    } catch(e) {}
}
document.addEventListener('DOMContentLoaded', applyTheme);

function updateEditButtonVisibility() {
    const user = getCurrentHassUser();
    // v256: lista admin configurabile (wizard/config.js).
    // Se la lista è vuota [], la pagina Config è visibile a TUTTI gli utenti.
    const admins = (cdCfg('cd_connection').admin_users)
                || ((window.DASHBOARD_CONFIG || {}).admin_users)
                || [];
    const isAdmin = !Array.isArray(admins) || admins.length === 0
                 || (user && admins.some(a => user.toLowerCase().includes(String(a).toLowerCase())));
    // v256: le card vivono nella pagina Configurazione; qui mostro/nascondo il TAB
    const tabCfg = document.getElementById('tab-config');
    if (tabCfg) tabCfg.style.display = isAdmin ? '' : 'none';
}
/* Tentativo all'avvio + ritentativi (perché hass arriva async) */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateEditButtonVisibility);
} else {
    updateEditButtonVisibility();
}
setTimeout(updateEditButtonVisibility, 1000);
setTimeout(updateEditButtonVisibility, 3000);
setTimeout(updateEditButtonVisibility, 6000);

function apriMenuLaterale() {
    if(navigator.vibrate) navigator.vibrate(10);
    // Standalone (file aperto direttamente, non dentro un pannello HA): apri il menu Dashboard Modern
    if (window.parent === window) { cdOpenAppMenu(); return; }
    // Dentro Home Assistant come pannello/iframe: toggola la sidebar nativa di HA
    try {
        const ParentCustomEvent = window.parent.CustomEvent || CustomEvent;
        const toggleEvent = new ParentCustomEvent('hass-toggle-menu', { bubbles: true, composed: true });
        const pDoc = window.parent.document;
        const haElement = pDoc.querySelector('home-assistant');
        if (haElement) {
            haElement.dispatchEvent(toggleEvent);
            if (haElement.shadowRoot) { const main = haElement.shadowRoot.querySelector('home-assistant-main'); if (main) main.dispatchEvent(toggleEvent); }
        } else {
            pDoc.body.dispatchEvent(toggleEvent);
            cdOpenAppMenu();   // fallback: nessuna sidebar HA trovata -> menu DM
        }
    } catch(err) {
        cdOpenAppMenu();       // cross-origin: non possiamo toccare l'iframe padre -> menu DM
    }
}
/* v0.10.7 (issue #11): menu accessibile dall'hamburger con accesso SEMPRE garantito a config/wizard/reset */
function cdOpenAppMenu() {
    const ex = document.getElementById('cd-app-menu');
    if (ex) { ex.remove(); return; }
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const ov = document.createElement('div');
    ov.id = 'cd-app-menu';
    ov.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(15,23,42,0.5); display:flex; align-items:flex-end; justify-content:center;';
    const close = () => ov.remove();
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    const card = document.createElement('div');
    card.style.cssText = 'width:100%; max-width:480px; border-radius:24px 24px 0 0; padding:10px 8px 22px; box-shadow:0 -10px 40px rgba(0,0,0,0.3); animation:cdMenuUp .28s cubic-bezier(0.16,1,0.3,1); background:' + (dark ? '#0f172a' : '#fff') + '; color:' + (dark ? '#e2e8f0' : '#0f172a') + ';';
    const mkItem = (icon, label, fn, color) => {
        const btn = document.createElement('button');
        btn.style.cssText = 'display:flex; align-items:center; gap:14px; width:100%; padding:15px 18px; border:none; background:transparent; color:' + (color || 'inherit') + '; font-size:15px; font-weight:800; cursor:pointer; text-align:left;';
        btn.innerHTML = '<span style="font-size:20px; width:24px; text-align:center;">' + icon + '</span>' + label;
        btn.addEventListener('click', () => { close(); try { fn(); } catch(e) {} });
        return btn;
    };
    const grip = document.createElement('div');
    grip.style.cssText = 'width:42px; height:4px; border-radius:99px; background:rgba(148,163,184,0.4); margin:8px auto 12px;';
    card.appendChild(grip);
    card.appendChild(mkItem('⚙️', 'Configuration / Editor', () => apriConfigEntita()));
    
    card.appendChild(mkItem('🔄', 'Full reset', () => wzResetAll(), '#dc2626'));
    card.appendChild(mkItem('✕', 'Close', () => {}, 'opacity:0.55'));
    const st = document.createElement('style');
    st.textContent = '@keyframes cdMenuUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}';
    card.appendChild(st);
    ov.appendChild(card);
    document.body.appendChild(ov);
}

// ================= GESTIONE MODALS E PULIZIA RISORSE ================= //
function forceClose(id) { 
  document.getElementById(id).classList.remove('show'); 
  if(id === 'details-modal') {
      try { dmCamCleanup(); } catch(e) {}
      currentPopupType = null; 
      currentActiveCam = null;
      
      // Distruggi l'iframe video per fermare il flusso e liberare RAM e Banda
      const container = document.getElementById('video-iframe-container') || document.querySelector('.cam-zoom-container');
      if(container) {
          const iframe = container.querySelector('iframe');
          if(iframe) iframe.src = ''; // Stacca la connessione WebRTC
          
          // Reset del Fullscreen se rimasto attivo chiudendo il popup
          container.style.position = 'relative';
          container.style.width = '100%'; 
          container.style.height = 'auto';
          container.style.zIndex = '1';
          container.style.paddingTop = '56.25%';
          isPseudoFullscreen = false;
      }
  }
}
function closeModal(e, id) { if (e && e.target.id === id) forceClose(id); }

// v254: Modal conferma azione generico riutilizzabile
// Uso: confermaAzione({ icon: '⛩️', iconRgb: '16,185,129', title: 'Apri Cancello', message: 'Sei sicuro?', confirmLabel: 'Sì, apri', onConfirm: () => toggle('dm.home_script_apertura_cancello') })
function confermaAzione(opts) {
  if (navigator.vibrate) navigator.vibrate(10);
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;
  
  // Imposta contenuti
  setTxt('confirm-icon', opts.icon || '⚠️');
  setTxt('confirm-title', opts.title || 'Conferma azione');
  setTxt('confirm-message', opts.message || 'Procedere?');
  
  // Imposta colore brand (per icona + bottone OK) via CSS variable
  const card = modal.querySelector('.confirm-card');
  card.style.setProperty('--cf-rgb', opts.iconRgb || '14, 165, 233');
  card.style.setProperty('--cf-text-rgb', opts.textRgb || '3, 105, 161');
  
  // Imposta label bottoni
  document.querySelector('.confirm-btn-cancel').textContent = opts.cancelLabel || 'Cancel';
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = opts.confirmLabel || 'Conferma';
  
  // Sostituisco l'event listener (rimuovendo eventuali precedenti)
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  newOkBtn.addEventListener('click', () => {
    forceClose('confirm-modal');
    if (typeof opts.onConfirm === 'function') {
      setTimeout(opts.onConfirm, 100);
    }
  });
  
  modal.classList.add('show');
}

function apriSubLoads(type) {
    if(navigator.vibrate) navigator.vibrate(10);
    currentPopupType = 'subloads_' + type;
    renderSubLoads(type);
    document.getElementById('subloads-modal').classList.add('show');
}

function renderSubLoads(type) {
    const conf = SUBLOADS_CONFIG[type];
    if(!conf) return;
    document.getElementById('subloads-title').innerHTML = `<span style="font-size:24px;">${conf.icon}</span> ${conf.title}`;
    
    let html = '';
    conf.items.forEach(item => {
        // v254: bin opzionale — se assente, lo stato deriva dalla potenza istantanea (pwrLive o pwr) > 5W
        let isOn;
        if (item.bin) {
            isOn = getRawState(item.bin) === 'on';
        } else {
            const liveP = parseFloat(getRawState(item.pwrLive || item.pwr)) || 0;
            isOn = liveP > 5;
        }
        const pwrVal = getDisplay(item.pwr);
        const bg = isOn ? '#10b981' : '#e11d48';
        const txt = isOn ? 'IN FUNZIONE' : 'OFF';
        
        html += `
        <div class="s-load-card hist-clickable" onclick="apriStorico(event, '${item.pwr}', '${item.name}')">
            <div class="s-load-top" style="background:${bg};">
                <div class="s-load-icon">${item.icon}</div>
                <div>${item.name}<br><span style="font-size:10px; opacity:0.9;">${txt}</span></div>
            </div>
            <div class="s-load-bot">
                <div class="s-load-val">${pwrVal}</div>
            </div>
        </div>`;
    });
    document.getElementById('subloads-list').innerHTML = html;
}

/* v0.10.8: elenco luci = chiavi cd_luci (QUALSIASI dominio: light., switch., group., …) unite
   al gruppo autodetect. Così le luci comandate da switch e quelle del config.js compaiono. */
function cdLightList() {
    try {
        const cfg = Object.keys(cdCfg('cd_luci') || {});
        if (!GRUPPI_MONITORAGGIO.luci) GRUPPI_MONITORAGGIO.luci = [];
        cfg.forEach(id => { if (!GRUPPI_MONITORAGGIO.luci.includes(id)) GRUPPI_MONITORAGGIO.luci.push(id); });
        return GRUPPI_MONITORAGGIO.luci.slice();
    } catch(e) { return (GRUPPI_MONITORAGGIO.luci || []).slice(); }
}
function apriGestioneLuci(isClick = false, luciFilter = null, customTitle = null) {
  window._luciPopupFilter = luciFilter || null;
  window._luciPopupTitle = customTitle || null;
  if(isClick && navigator.vibrate) navigator.vibrate(10);
  currentPopupType = 'gestione_luci';
  const list = document.getElementById('details-list');
  const scrollTop = list.scrollTop;
  document.getElementById('details-title').innerHTML = window._luciPopupTitle ? ('💡 ' + window._luciPopupTitle.toUpperCase()) : '💡 LIGHTS';

  // v255: raggruppo per stanza usando il pattern "Room - Dettaglio"
  let onCount = 0;
  const gruppi = {};   // { 'Salone': [{id, dett, isOn}], ... }
  const ordine = [];   // ordine di prima apparizione
  // v0.9.0: se l'utente ha organizzato le luci in stanze (tab Luci dell'editor) uso quelle;
  //         l'ordine delle stanze e delle luci segue cd_luci_room_order / cd_luci_order.
  const _hasRooms = (typeof cdLuciRoomsCfg === 'function') && (Object.keys(cdLuciRoomsCfg()).length || cdLuciRoomOrder().length);
  const _roomOrder = _hasRooms ? cdLuciRoomList() : [];
  const _lightOrder = _hasRooms ? cdLuciOrderCfg() : {};
  (window._luciPopupFilter || cdLightList()).forEach(id => {
    const sObj = STATES[id]; if(!sObj) return;
    let nm = LUCI_NAMES[id] || sObj.attributes?.friendly_name || id;
    let zona = nm, dett = '';
    const di = nm.indexOf(' - ');
    if (di > -1) { zona = nm.substring(0, di).trim(); dett = nm.substring(di + 3).trim(); }
    if (_hasRooms) {
        const r = (typeof cdLightRoom === 'function') && cdLightRoom(id);
        zona = r || 'Altre zone';
        if (di === -1) dett = nm;
    }
    const isOn = sObj.state === 'on';
    if (isOn) onCount++;
    if (!gruppi[zona]) { gruppi[zona] = []; ordine.push(zona); }
    gruppi[zona].push({ id, dett: dett || nm, isOn });
  });
  // riordino stanze e luci secondo la configurazione dell'utente
  if (_hasRooms) {
    ordine.sort((a, b) => {
        if (a === 'Altre zone') return 1; if (b === 'Altre zone') return -1;
        const ia = _roomOrder.indexOf(a), ib = _roomOrder.indexOf(b);
        if (ia === -1 && ib === -1) return 0; if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
    });
    Object.keys(gruppi).forEach(z => {
        const so = _lightOrder[z] || [];
        gruppi[z].sort((x, y) => { const ix = so.indexOf(x.id), iy = so.indexOf(y.id); if (ix === -1 && iy === -1) return 0; if (ix === -1) return 1; if (iy === -1) return -1; return ix - iy; });
    });
  }


  // Card luce verticale compatta (griglia 2 colonne)
  // showZona: nelle card delle stanze mono-luce mostro la zona come nome principale
  const cardHtml = (l, showZona) => `
    <div class="lgx-card ${l.isOn ? 'is-on' : ''}" data-luce="${l.id}" onclick="toggle('${l.id}')">
      <div class="lgx-glow"></div>
      <div class="lgx-row-top">
        <div class="lgx-orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/></svg></div>
        <div class="lgx-led ${l.isOn ? 'on' : ''}"></div>
      </div>
      <div class="lgx-name">${showZona ? l.zona : l.dett}</div>
      ${showZona && l.dett && l.dett !== l.zona ? `<div class="lgx-sub">${l.dett}</div>` : ''}
      <div class="lgx-state">${l.isOn ? 'ON' : 'OFF'}</div>
    </div>`;

  let html = `<div class="lgx-bar">
      <div class="lgx-bar-l"><span class="lgx-dot ${onCount>0?'active':''}"></span>${onCount>0 ? '<b>'+onCount+'</b><span>'+(onCount===1?'on':'on')+'</span>' : '<span>All off</span>'}</div>
      ${onCount>0 ? '<div class="lgx-alloff" onclick="event.stopPropagation(); luciTutteOff()">Turn all off</div>' : ''}
    </div>`;

  // v255b: le stanze con 2+ luci hanno header + griglia; le stanze mono-luce
  // vengono raccolte in un'unica griglia condivisa (niente card full-width, lista più corta)
  const singole = [];
        let _lastFloor = null;
        try { if (typeof cdRoomFloorOf === 'function' && typeof cdFloorNames === 'function') {
          const _fl = cdFloorNames();
          const _fi = (f) => { const x = _fl.indexOf(f); return x < 0 ? 9999 : x; };
          const _pos = {}; ordine.forEach((z, ix) => { _pos[z] = ix; });
          ordine.sort((a, b) => {
            const d = _fi(cdRoomFloorOf(a)) - _fi(cdRoomFloorOf(b));
            return d !== 0 ? d : (_pos[a] - _pos[b]);
          });
        } } catch(e) {}
  ordine.forEach(zona => {
    const luci = gruppi[zona];
    if (luci.length === 1) { singole.push({ ...luci[0], zona }); return; }
    try { const _f = cdRoomFloorOf(zona); if (_f && _f !== _lastFloor) { _lastFloor = _f; html += `<div class="lgx-zona" style="opacity:0.7; font-size:12px; letter-spacing:1.2px;">🏢 ${_f.toUpperCase()}</div>`; } } catch(e) {}
        html += `<div class="lgx-zona">${zona.toUpperCase()}</div>`;
    html += `<div class="lgx-grid">${luci.map(l => cardHtml(l, false)).join('')}</div>`;
  });
  if (singole.length) {
    html += `<div class="lgx-zona">OTHER AREAS</div>`;
    html += `<div class="lgx-grid">${singole.map(l => cardHtml(l, true)).join('')}</div>`;
  }

  list.innerHTML = html;
  list.scrollTop = scrollTop;
  document.getElementById('details-modal').classList.add('show');
}

/* v0.9.7 (#8): incremental refresh of the lights popup — no more full innerHTML
   rebuild on every tick (which made cards "flicker"). Only the on/LED/state
   of existing cards and the top bar are touched. */
function updateGestioneLuci() {
  const modal = document.getElementById('details-modal');
  if (!modal || !modal.classList.contains('show') || currentPopupType !== 'gestione_luci') return;
  const list = document.getElementById('details-list');
  if (!list) return;
  const cards = list.querySelectorAll('.lgx-card[data-luce]');
  if (!cards.length) { apriGestioneLuci(false, window._luciPopupFilter, window._luciPopupTitle); return; }
  let onCount = 0;
  cards.forEach(card => {
    const id = card.getAttribute('data-luce');
    const s = STATES[id];
    const isOn = !!(s && s.state === 'on');
    if (isOn) onCount++;
    card.classList.toggle('is-on', isOn);
    const led = card.querySelector('.lgx-led');
    if (led) led.classList.toggle('on', isOn);
    const st = card.querySelector('.lgx-state');
    if (st) { const t = isOn ? 'ON' : 'OFF'; if (st.textContent !== t) st.textContent = t; }
  });
  const bar = list.querySelector('.lgx-bar');
  if (bar) {
    const newBar = `<div class="lgx-bar-l"><span class="lgx-dot ${onCount>0?'active':''}"></span>${onCount>0 ? '<b>'+onCount+'</b><span>on</span>' : '<span>All off</span>'}</div>${onCount>0 ? '<div class="lgx-alloff" onclick="event.stopPropagation(); luciTutteOff()">Turn all off</div>' : ''}`;
    if (bar.innerHTML !== newBar) bar.innerHTML = newBar;
  }
}

// v255: spegni tutte le luci accese in un colpo
function luciTutteOff() {
  if(navigator.vibrate) navigator.vibrate(15);
  (window._luciPopupFilter || cdLightList()).forEach(id => {
    const s = STATES[id];
    if (s && s.state === 'on') {
      const eid = resolveEntity(id);
      if (ws) ws.send(JSON.stringify({ id: msgId++, type: 'call_service', domain: eid.split('.')[0], service: 'turn_off', service_data: { entity_id: eid } }));
    }
  });
}

// ================= GESTORE TELECAMERE (BLINDATO - AUTOSWITCH HLS/MJPEG) =================
// Rileva iOS (iPhone/iPad) — la Fullscreen API non funziona bene su Safari iOS
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

window.toggleFullScreenCam = function() {
    const container = document.getElementById('video-iframe-container');
    if (!container) return;
    const closeBtn = document.getElementById('close-fullscreen-btn');

    // Se non siamo in fullscreen, entriamo
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !isPseudoFullscreen) {
        // Su iOS la Fullscreen API è bacata sui div → usa SEMPRE pseudo-fullscreen
        if (IS_IOS) {
            activatePseudoFullscreen(container);
        } else if (container.requestFullscreen) {
            container.requestFullscreen().catch(() => activatePseudoFullscreen(container));
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else {
            activatePseudoFullscreen(container);
        }
        if (closeBtn) closeBtn.style.display = 'flex';
    } else {
        // Se siamo già in fullscreen, usciamo
        if (isPseudoFullscreen) {
            deactivatePseudoFullscreen(container);
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
        if (closeBtn) closeBtn.style.display = 'none';
    }
};

// Nasconde TUTTI gli elementi HA (sidebar + toolbar header) durante il fullscreen
function hideHaSidebar() {
    try {
        const win = window.top || window.parent || window;
        const haRoot = win.document.querySelector('home-assistant');
        if (!haRoot || !haRoot.shadowRoot) return;

        // Helper ricorsivo: cerca un selettore attraverso shadow DOM nidificati
        function deepFind(selector, root, maxDepth = 8) {
            if (!root || maxDepth < 0) return null;
            try {
                const direct = root.querySelector(selector);
                if (direct) return direct;
                const candidates = root.querySelectorAll('*');
                for (const el of candidates) {
                    if (el.shadowRoot) {
                        const result = deepFind(selector, el.shadowRoot, maxDepth - 1);
                        if (result) return result;
                    }
                }
            } catch (e) {}
            return null;
        }

        // Elementi HA da nascondere: sidebar + header/toolbar + drawer aside
        const selectorsToHide = [
            'ha-sidebar',
            'app-header',
            'app-toolbar',
            'ha-menu-button',
            '.header',
            '.toolbar'
        ];

        window._haHiddenEls = [];
        for (const sel of selectorsToHide) {
            const el = deepFind(sel, haRoot.shadowRoot);
            if (el && el.style.display !== 'none') {
                window._haHiddenEls.push({ el, originalDisplay: el.style.display });
                el.style.display = 'none';
            }
        }

        // Drawer aside (interno a ha-drawer)
        const drawer = deepFind('ha-drawer', haRoot.shadowRoot);
        if (drawer && drawer.shadowRoot) {
            const aside = drawer.shadowRoot.querySelector('aside');
            if (aside) {
                window._haHiddenEls.push({ el: aside, originalDisplay: aside.style.display });
                aside.style.display = 'none';
            }
        }

        // Forza il main content a full width senza margini
        const partial = deepFind('partial-panel-resolver', haRoot.shadowRoot);
        if (partial) {
            window._haPartialAdjusted = partial;
            partial._orig = { left: partial.style.left, width: partial.style.width, marginLeft: partial.style.marginLeft };
            partial.style.left = '0';
            partial.style.width = '100%';
            partial.style.marginLeft = '0';
        }

        // Rimuove padding-top dal contenuto Lovelace (dove sta la dashboard)
        const huiRoot = deepFind('hui-root', haRoot.shadowRoot);
        if (huiRoot && huiRoot.shadowRoot) {
            const view = huiRoot.shadowRoot.querySelector('#view') || 
                         huiRoot.shadowRoot.querySelector('hui-view') ||
                         huiRoot.shadowRoot.querySelector('.view');
            if (view) {
                window._haViewAdjusted = view;
                view._orig = { paddingTop: view.style.paddingTop, marginTop: view.style.marginTop };
                view.style.paddingTop = '0';
                view.style.marginTop = '0';
            }
        }
    } catch (e) { /* cross-origin o struttura HA diversa */ }
}

function showHaSidebar() {
    try {
        if (window._haHiddenEls && window._haHiddenEls.length) {
            for (const item of window._haHiddenEls) {
                item.el.style.display = item.originalDisplay || '';
            }
            window._haHiddenEls = [];
        }
        if (window._haPartialAdjusted) {
            const p = window._haPartialAdjusted;
            if (p._orig) {
                p.style.left = p._orig.left || '';
                p.style.width = p._orig.width || '';
                p.style.marginLeft = p._orig.marginLeft || '';
            }
            delete window._haPartialAdjusted;
        }
        if (window._haViewAdjusted) {
            const v = window._haViewAdjusted;
            if (v._orig) {
                v.style.paddingTop = v._orig.paddingTop || '';
                v.style.marginTop = v._orig.marginTop || '';
            }
            delete window._haViewAdjusted;
        }
    } catch (e) {}
}

// Forza unmute + fullscreen NATIVO iOS sul <video> dentro l'iframe WebRTC
// Su iOS è l'unico modo per nascondere completamente il chrome del browser/HA
function unmuteWebrtcVideo() {
    const iframe = document.querySelector('#video-iframe-container iframe');
    if (!iframe) return;

    // Tentativo postMessage (cross-origin safe)
    try {
        iframe.contentWindow.postMessage({ type: 'unmute', volume: 1 }, '*');
        iframe.contentWindow.postMessage({ type: 'volume', value: 1 }, '*');
    } catch (e) {}

    // Helper ricorsivo per trovare un <video> attraverso shadow DOM nidificati
    function deepFindVideo(root, maxDepth = 6) {
        if (!root || maxDepth < 0) return null;
        try {
            const v = root.querySelector ? root.querySelector('video') : null;
            if (v) return v;
            const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
            for (const el of all) {
                if (el.shadowRoot) {
                    const found = deepFindVideo(el.shadowRoot, maxDepth - 1);
                    if (found) return found;
                }
            }
        } catch (e) {}
        return null;
    }

    const tryUnmuteAndFullscreen = () => {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (!doc) return false;

            // Cerca <video> direttamente o in shadow DOM (AlexxIT WebRTC usa custom element)
            let video = doc.querySelector('video');
            if (!video) video = deepFindVideo(doc);
            if (!video) return false;

            // Unmute + volume max
            video.muted = false;
            video.volume = 1.0;
            video.removeAttribute('muted');

            // Tenta play (può fallire silenziosamente)
            const playPromise = video.play();
            if (playPromise && playPromise.catch) playPromise.catch(() => {});

            // Su iOS: vero fullscreen nativo del <video> (rimuove TUTTO il chrome incluso toolbar HA)
            if (IS_IOS && video.webkitEnterFullscreen) {
                try { video.webkitEnterFullscreen(); } catch (e) {}
            }
            return true;
        } catch (e) { /* cross-origin */ }
        return false;
    };

    // Più tentativi nel tempo, il video può tardare ad essere disponibile
    setTimeout(tryUnmuteAndFullscreen, 100);
    setTimeout(tryUnmuteAndFullscreen, 400);
    setTimeout(tryUnmuteAndFullscreen, 900);
    setTimeout(tryUnmuteAndFullscreen, 1800);
    setTimeout(tryUnmuteAndFullscreen, 3000);
}

// Attiva pseudo-fullscreen: sposta il container nel body per evitare
// lo stacking context del modal-wrapper (backdrop-filter su iOS lo intrappola)
function activatePseudoFullscreen(container) {
    // Nasconde la sidebar HA (utile in landscape iPhone)
    hideHaSidebar();

    // Salva posizione originale per ripristinarla all'uscita
    container._originalParent = container.parentNode;
    container._originalNext   = container.nextSibling;
    document.body.appendChild(container);

    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.width = '100vw';
    // Cascata fallback: 100vh → -webkit-fill-available → 100dvh (più recente, gestisce rotazione iOS)
    container.style.height = '100vh';
    container.style.height = '-webkit-fill-available';
    container.style.height = '100dvh';
    container.style.zIndex = '999999';
    container.style.backgroundColor = '#000';
    container.style.paddingTop = '0';
    container.style.borderRadius = '0';
    container.style.border = 'none';
    isPseudoFullscreen = true;

    container.offsetHeight; // forza reflow
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    // Su iOS, attiva audio direttamente sfruttando il gesto utente che ci porta qui
    if (IS_IOS) unmuteWebrtcVideo();
}

function deactivatePseudoFullscreen(container) {
    if (!container) return;
    // Ripristina nella posizione originale dentro il modal
    if (container._originalParent) {
        if (container._originalNext && container._originalNext.parentNode === container._originalParent) {
            container._originalParent.insertBefore(container, container._originalNext);
        } else {
            container._originalParent.appendChild(container);
        }
        delete container._originalParent;
        delete container._originalNext;
    }
    container.style.position = 'relative';
    container.style.top = '';
    container.style.left = '';
    container.style.right = '';
    container.style.bottom = '';
    container.style.width = '100%';
    container.style.height = 'auto';
    container.style.zIndex = '1';
    container.style.paddingTop = '56.25%';
    container.style.borderRadius = '22px';
    container.style.border = '1px solid rgba(255,255,255,0.1)';
    isPseudoFullscreen = false;

    window.removeEventListener('orientationchange', handleOrientationChange);
    window.removeEventListener('resize', handleOrientationChange);

    // Ripristina la sidebar HA
    showHaSidebar();
}

function handleOrientationChange() {
    if (!isPseudoFullscreen) return;
    const c = document.getElementById('video-iframe-container');
    if (!c) return;
    setTimeout(() => {
        c.style.height = '100vh';
        c.style.height = '-webkit-fill-available';
        c.style.height = '100dvh';
        // RI-nasconde la sidebar HA: dopo rotazione iPhone, HA ri-renderizza il layout
        // e potrebbe rendere la sidebar nuovamente visibile.
        hideHaSidebar();
    }, 100);
    // Secondo tentativo dopo 400ms (per layout che si stabilizzano lentamente)
    setTimeout(() => { if (isPseudoFullscreen) hideHaSidebar(); }, 400);
}

// 🤖 GESTORE DI SICUREZZA PER USCITE NATIVE (Tasto Esc, Swipe laterali Android/iOS)
function syncFullscreenExitState() {
    const container = document.getElementById('video-iframe-container');
    const closeBtn = document.getElementById('close-fullscreen-btn');
    
    // Se il browser rileva che non siamo più in modalità schermo intero hardware
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !isPseudoFullscreen) {
        if (closeBtn) closeBtn.style.display = 'none';
        if (container) {
            container.style.position = 'relative';
            container.style.width = '100%'; 
            container.style.height = 'auto';
            container.style.zIndex = '1';
            container.style.paddingTop = '56.25%';
        }
    }
}
document.addEventListener('fullscreenchange', syncFullscreenExitState);
document.addEventListener('webkitfullscreenchange', syncFullscreenExitState);



/* ═══ v261: AZIONI RAPIDE dinamiche — configurabili da UI (cd_quick_actions) ═══
   Tipi: builtin (popup nativi), toggle (switch/light), script, scene. */
const CD_QA_BUILTINS = {
    luci:      { name: 'Gestione Luci', icon: '💡', color: '#f59e0b', fn: () => apriGestioneLuci(true) },
    clima:     { name: 'Clima',         icon: '❄️', color: '#0ea5e9', fn: () => apriQuickClima() },
    antifurto: { name: 'Antifurto',     icon: '🛡️', color: '#7c3aed', fn: () => apriQuickAntifurto() },
    lavatrice: { name: 'Lavatrice',     icon: '🧺', color: '#0ea5e9', fn: () => apriPopupLavatrice() },
};
const CD_QA_DEFAULT = [];
function getQuickActions() {
    const w = cdCfg('cd_quick_actions');
    if (Array.isArray(w)) return w;   // anche [] esplicito = nessuna azione
    const C = (window.DASHBOARD_CONFIG || {});
    if (Array.isArray(C.quick_actions)) return C.quick_actions;
    return CD_QA_DEFAULT;
}
function qaRun(i) {
    const _a = getQuickActions()[i];
    if (_a && _a.type === 'luci_group') {
        apriGestioneLuci(true, _a.lights || [], _a.name || 'Luci');
        return;
    }
    const a = getQuickActions()[i];
    if (!a) return;
    if (navigator.vibrate) navigator.vibrate(10);
    if (a.type === 'builtin' && CD_QA_BUILTINS[a.builtin]) { CD_QA_BUILTINS[a.builtin].fn(); return; }
    const eid = resolveEntity(a.entity || '');
    if (!eid || !eid.includes('.')) return;
    const doCall = () => {
        const domain = a.type === 'script' ? 'script' : a.type === 'scene' ? 'scene' : eid.split('.')[0];
        const service = a.type === 'script' ? 'turn_on' : a.type === 'scene' ? 'turn_on' : 'toggle';
        if (ws) ws.send(JSON.stringify({ id: msgId++, type: 'call_service', domain, service, service_data: { entity_id: eid } }));
    };
    if (a.confirm) {
        confermaAzione({ icon: a.icon || '⚡', title: a.name, message: a.confirm, confirmText: 'CONFERMA', onConfirm: doCall });
    } else doCall();
}
function buildQuickActions() {
    const grid = document.getElementById('qa-grid');
    if (!grid) return;
    const actions = getQuickActions();
    // v261: nessuna azione configurata → l'intero blocco sparisce dalla home
    const wrap = grid.closest('section') ? grid : grid;
    if (!actions.length) { grid.style.display = 'none'; const t = grid.previousElementSibling; if (t && /azioni/i.test(t.textContent||'')) t.style.display = 'none'; return; }
    grid.style.display = '';
    grid.innerHTML = actions.map((a, i) => {
        const b = a.type === 'builtin' ? CD_QA_BUILTINS[a.builtin] : null;
        const name = a.name || (b && b.name) || '?';
        const icon = a.icon || (b && b.icon) || '⚡';
        const color = a.color || (b && b.color) || '#0ea5e9';
        return `<div class="qa-btn" onclick="qaRun(${i})">
        <div class="icon" style="filter: drop-shadow(0 6px 12px ${color}66); color: ${color};">${icon}</div>
        ${name}
      </div>`;
    }).join('');
}
document.addEventListener('DOMContentLoaded', buildQuickActions);

/* ═══ v260: UNITÀ CLIMA dinamiche — configurabili da UI (cd_clima_units) ═══ */
const CD_CLIMA_DEFAULT = [];
function getClimaUnits() {
    const w = cdCfg('cd_clima_units');
    if (Array.isArray(w) && w.length) return w;
    const C = (window.DASHBOARD_CONFIG || {});
    if (Array.isArray(C.clima_units) && C.clima_units.length) return C.clima_units;
    return CD_CLIMA_DEFAULT;
}

/* ═══ v274: aggiornamento card clima AUTONOMO — proprio try/catch, chiamato dal render,
   dopo ogni rigenerazione delle card e periodicamente come rete di sicurezza. ═══ */
/* v290: stato visivo di un nodo dei flussi energia:
   - entità non configurata → nodo e linea rimossi dalla vista
   - configurata ma ~0 W → nodo attenuato e flusso fermo */
/* v300: personalizzazione nome/icona per i nodi con popup nativo (boiler/wallbox/clima);
   il click passa a un gruppo carichi solo se l'utente ne sceglie uno. */
function cdApplyFlowNodeLite(nodeId, conf, defIcon, defName) {
    try {
        const node = document.getElementById(nodeId);
        if (!node) return;
        const name = (conf && conf.name) || defName;
        const icon = (conf && conf.icon) || defIcon;
        const lbl = node.querySelector('.node-label');
        const ico = node.querySelector('.node-icon');
        if (lbl && lbl.textContent !== name) lbl.textContent = name;
        if (ico && ico.textContent !== icon) ico.textContent = icon;
        if (conf && conf.group) node.setAttribute('onclick', "apriSubLoads('" + conf.group + "')");
    } catch(e) {}
}

function cdApplyFlowNode(nodeId, conf, defGroup, defIcon, defName) {
    try {
        const node = document.getElementById(nodeId);
        if (!node) return;
        const name = (conf && conf.name) || defName;
        const icon = (conf && conf.icon) || defIcon;
        const group = (conf && conf.group) || defGroup;
        const lbl = node.querySelector('.node-label');
        const ico = node.querySelector('.node-icon');
        if (lbl && lbl.textContent !== name) lbl.textContent = name;
        if (ico && ico.textContent !== icon) ico.textContent = icon;
        if (group) node.setAttribute('onclick', "apriSubLoads('" + group + "')");
        else if (conf && conf.pwr) node.setAttribute('onclick', "apriStorico(event, '" + conf.pwr + "', '" + name.replace(/'/g,'') + "')");
    } catch(e) {}
}

/* v296: nodo flusso — se rimappato su un gruppo custom, il valore è la somma
   delle potenze dei suoi membri; altrimenti comportamento standard. */
function cdUpdateFlowNode(nodeId, lineId, valId, defaultRef) {
    const node = document.getElementById(nodeId);
    if (!node) return;
    const gid = node.dataset.customGroup;
    if (gid && SUBLOADS_CONFIG[gid]) {
        const items = SUBLOADS_CONFIG[gid].items || [];
        let tot = 0, any = false;
        items.forEach(it => {
            const w = parseFloat(STATES[it.pwrLive || it.pwr]?.state);
            if (!isNaN(w)) { tot += w; any = true; }
        });
        const valEl = document.getElementById(valId);
        if (valEl) valEl.textContent = any ? Math.round(tot) + ' W' : '—';
        const line = document.getElementById(lineId);
        node.style.display = ''; if (line) line.style.display = '';
        const idle = !any || Math.abs(tot) < 3;
        node.style.opacity = idle ? '0.42' : '1';
        if (line) { line.style.opacity = idle ? '0.15' : '1'; line.style.animationPlayState = idle ? 'paused' : 'running'; }
        return;
    }
    cdEnergyNodeState(nodeId, lineId, defaultRef);
}

function cdEnergyNodeState(nodeId, lineId, ref) {
    try {
        const node = document.getElementById(nodeId);
        const line = document.getElementById(lineId);
        if (!node) return;
        const s = STATES[ref];
        const ghost = !s || s.entity_id === 'dm.unmapped';
        const unmapped = (typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING) && ghost;
        node.style.display = unmapped ? 'none' : '';
        if (line) line.style.display = unmapped ? 'none' : '';
        if (unmapped) return;
        const w = parseFloat(s && s.state);
        const idle = isNaN(w) || Math.abs(w) < 3;
        node.style.opacity = idle ? '0.42' : '1';
        if (line) { line.style.opacity = idle ? '0.15' : '1'; line.style.animationPlayState = idle ? 'paused' : 'running'; }
    } catch(e) {}
}

/* ═══ v0.7.4: potenza live di un nodo carico ═══
   Priorità: 1) sensore impostato dall'utente sul nodo → quello;
             2) nessun sensore ma gruppo con sottocarichi → SOMMA automatica delle loro potenze;
             3) altrimenti l'entità predefinita del nodo. */
function cdNodeLive(key, defEntity) {
    const n = (cdCfg('cd_flow_nodes') || {})[key] || {};
    if (n.pwr) {
        const s = STATES[n.pwr];
        const ghost = !s || s.entity_id === 'dm.unmapped';
        return { disp: getDisplay(n.pwr), w: Math.abs(getPowerInWatts(n.pwr)), mapped: !ghost };
    }
    if (n.group && SUBLOADS_CONFIG[n.group] && (SUBLOADS_CONFIG[n.group].items || []).length) {
        let tot = 0, any = false;
        SUBLOADS_CONFIG[n.group].items.forEach(it => {
            const id = it.pwrLive || it.pwr;
            const s = STATES[id];
            let w = parseFloat(s && s.state);
            if (!isNaN(w)) {
                if (s.attributes && (s.attributes.unit_of_measurement || '').toLowerCase() === 'kw') w *= 1000;
                tot += w; any = true;
            }
        });
        return { disp: any ? Math.round(Math.abs(tot)) + ' W' : '—', w: any ? Math.abs(tot) : 0, mapped: true };
    }
    const s = STATES[defEntity];
    const ghost = !s || s.entity_id === 'dm.unmapped';
    const unmapped = (typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING) && ghost;
    return { disp: getDisplay(defEntity), w: Math.abs(getPowerInWatts(defEntity)), mapped: !unmapped };
}
function cdUpdateLoadNode(nodeId, lineId, valId, key, defEntity) {
    const node = document.getElementById(nodeId);
    if (!node) return { w: 0, mapped: false };
    const line = document.getElementById(lineId);
    const live = cdNodeLive(key, defEntity);
    if (!live.mapped) { node.style.display = 'none'; if (line) line.style.display = 'none'; return live; }
    node.style.display = ''; if (line) line.style.display = '';
    const valEl = document.getElementById(valId);
    if (valEl) valEl.textContent = live.disp;
    const idle = live.w < 3;
    node.style.opacity = idle ? '0.42' : '1';
    if (line) { line.style.opacity = idle ? '0.15' : '1'; line.style.animationPlayState = idle ? 'paused' : 'running'; }
    return live;
}

/* v292: primo stato REALMENTE mappato di una lista di riferimenti — i "ghost"
   (ref non configurati) non devono cortocircuitare i fallback. */
function cdRefMapped(ref) {
    if (!ref) return false;
    if (typeof ENTITY_OVERRIDES !== 'undefined' && ENTITY_OVERRIDES[ref]) return true;
    const s = STATES[ref];
    return !!(s && s.entity_id && s.entity_id !== 'dm.unmapped');
}
function cdSetPeriodLoad(base, mapped) {
    ['n-' + base + '-day', 'n-' + base + '-month',
     'line-home-' + base + '-day', 'line-home-' + base + '-month',
     'm-line-home-' + base + '-day', 'm-line-home-' + base + '-month'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = mapped ? '' : 'none';
    });
}
function cdFirstMapped() {
    for (let i = 0; i < arguments.length; i++) {
        const s = STATES[arguments[i]];
        if (s && s.entity_id !== 'dm.unmapped') return s;
    }
    return null;
}

/* ═══ v0.7.0: DERIVAZIONE AUTOMATICA da entità TOTALI cumulative ═══
   L'utente collega i totali "lifetime" (gli stessi del tab Energy di HA);
   la dashboard calcola oggi / mese / anno leggendo la cronologia: valore attuale
   meno il valore a inizio periodo. Niente utility_meter, storico intatto.
   I valori derivati riempiono SOLO gli slot che l'utente non ha mappato. */
const CD_TOTAL_DERIVATIONS = [
    { total: 'dm.core_026',  daily: 'dm.energy_produzione_solare_oggi',       monthly: 'dm.energy_produzione_solare_mese',    yearly: 'dm.energy_produzione_solare_anno' },
    { total: 'dm.core_025', daily: 'dm.energy_consumo_casa_oggi', monthly: 'dm.energy_consumo_casa_mese',         yearly: 'dm.energy_consumo_casa_anno' },
    { total: 'dm.core_024',      daily: 'dm.energy_energia_prelevata_oggi',    monthly: 'dm.energy_rete_acquistata_mese', yearly: null },
    { total: 'dm.core_027',        daily: 'dm.energy_energia_immessa_oggi',      monthly: 'dm.energy_rete_venduta_mese',   yearly: null },
];

async function cdDeriveFromTotals() {
    if (window._cdResetting) return;
    try {
        if (typeof HA_HTTP_URL === 'undefined' || typeof LONG_LIVED_TOKEN === 'undefined' || !LONG_LIVED_TOKEN) return;
        const now = new Date();
        const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        for (const d of CD_TOTAL_DERIVATIONS) {
            const src = ENTITY_OVERRIDES[d.total];
            if (!src) continue; // totale non collegato
            const cur = parseFloat(STATES[d.total]?.state);
            if (isNaN(cur)) continue;

            // Prima lettura del periodo (dall'inizio anno copro anche mese e giorno)
            const start = (d.yearly ? yearStart : monthStart).toISOString();
            let arr = [];
            try {
                const res = await fetch(`${HA_HTTP_URL}/api/history/period/${start}?filter_entity_id=${src}&minimal_response&no_attributes`,
                    { headers: { 'Authorization': `Bearer ${LONG_LIVED_TOKEN}` } });
                if (!res.ok) continue;
                arr = (await res.json())[0] || [];
            } catch(e) { continue; }
            if (!arr.length) continue;

            const firstAfter = (t) => {
                for (const p of arr) {
                    if (p.state === 'unknown' || p.state === 'unavailable') continue;
                    if (new Date(p.last_changed || p.last_updated) >= t) return parseFloat(p.state);
                }
                return NaN;
            };
            const baseDay = firstAfter(dayStart);
            const baseMonth = firstAfter(monthStart);
            const baseYear = d.yearly ? firstAfter(yearStart) : NaN;

            const put = (ref, v) => {
                if (!ref || isNaN(v) || v < 0) return;
                if (ENTITY_OVERRIDES[ref]) return; // slot già mappato dall'utente: non tocco
                _RAW_STATES[ref] = { entity_id: ref, state: v.toFixed(1), attributes: { unit_of_measurement: 'kWh', friendly_name: ref, cd_derived: true } };
            };
            put(d.daily, cur - baseDay);
            put(d.monthly, cur - baseMonth);
            put(d.yearly, cur - baseYear);
        }
        if (typeof render === 'function') { try { render(); } catch(e) {} }
    } catch(e) { console.warn('[Totali] derivazione:', e); }
}
// al load (dopo la connessione) e ogni 10 minuti
setTimeout(cdDeriveFromTotals, 4000);
setInterval(cdDeriveFromTotals, 10 * 60 * 1000);

function updateClimaCards() {
    try {
        const climas = getClimaUnits().map(u => u.entity);
        
        climas.forEach(id => {
            const s = STATES[id];
            if(!s) return;
            
            const htmlId = id.replace('.', '-'); 
            const card = document.getElementById('card-' + htmlId);
            if(!card) return; 
            
            const badge = card.querySelector('.cp-badge');
            const cur = card.querySelector('.cp-temp-current');
            const tgt = card.querySelector('.cp-temp-target .val');
            const icon = card.querySelector('.cp-icon');
            
            const isOn = s.state !== 'off' && s.state !== 'unavailable';
            
            card.classList.remove('active');
            card.style.setProperty('--cp-rgb', '148, 163, 184'); 
            
            if(isOn) {
                card.classList.add('active');
                
                if(s.state === 'cool') {
                    card.style.setProperty('--cp-rgb', '14, 165, 233'); // Azzurro Condizionatori
                    if(icon) icon.textContent = '❄️';
                } else if(s.state === 'heat' || s.state === 'heating') {
                    card.style.setProperty('--cp-rgb', '234, 88, 12'); // Arancione Termosifoni
                    if(icon) icon.textContent = '🔥';
                } else {
                    card.style.setProperty('--cp-rgb', '16, 185, 129'); // Verde
                    if(icon) icon.textContent = '🌬️';
                }
                
                badge.textContent = s.state.toUpperCase();
                
            } else {
                badge.textContent = 'OFF';
                if(icon) icon.textContent = id.includes('termosifone') ? '🔥' : '❄️';
            }
            
            cur.textContent = (s.attributes.current_temperature || '--') + '°';
            tgt.textContent = (s.attributes.temperature || '--') + '°';
        });
    } catch (err) { console.error('[clima]', err); }
}
setInterval(() => { try { if (Object.keys(_RAW_STATES).length) updateClimaCards(); } catch(e) {} }, 20000);

/* ═══ v280: DISPOSITIVI PERSONALIZZATI — lavastoviglie, asciugatrice, stufa a pellet,
   irrigazione, scaldino… Ogni dispositivo: nome, icona, switch (opzionale),
   sensore potenza (stato da soglia 5W) e/o sensore valore (livello, temperatura…). ═══ */
const CD_DEVICES_DEFAULT = [];
function getDevices() {
    const w = cdCfg('cd_devices');
    if (Array.isArray(w) && w.length) return w;
    const C = (window.DASHBOARD_CONFIG || {});
    if (Array.isArray(C.devices) && C.devices.length) return C.devices;
    return CD_DEVICES_DEFAULT;
}
function buildDeviceCards() {
    const grid = document.getElementById('dev-grid');
    const title = document.getElementById('dev-title');
    if (!grid) return;
    const devs = getDevices();
    if (title) title.style.display = devs.length ? '' : 'none';
    grid.style.display = devs.length ? '' : 'none';
    if (!devs.length) { grid.innerHTML = ''; grid.style.display = 'none'; if (title) title.style.display = 'none'; return; } grid.style.display = ''; if (title) title.style.display = '';
    grid.innerHTML = devs.map((d, i) => {
        const nm = (d.name || '').replace(/'/g, '&#39;');
        return `<div class="dev-card" id="dev-card-${i}" onclick="devCardTap(${i})">
            ${d.switch ? `<button class="dev-pwr" onclick="event.stopPropagation(); toggle('${d.switch}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg></button>` : ''}
            <div class="dev-ico">${d.icon || '🔌'}</div>
            <div class="dev-nm">${nm}</div>
            <div class="dev-st" id="dev-st-${i}">—</div>
            <div class="dev-val" id="dev-val-${i}"></div>
        </div>`;
    }).join('');
    try { if (Object.keys(_RAW_STATES).length) updateDeviceCards(); } catch(e) {}
}
function updateDeviceCards() {
    try {
        getDevices().forEach((d, i) => {
            const card = document.getElementById('dev-card-' + i);
            if (!card) return;
            const stEl = document.getElementById('dev-st-' + i);
            const valEl = document.getElementById('dev-val-' + i);
            const sw = d.switch ? STATES[d.switch] : null;
            const pw = d.power ? parseFloat(STATES[d.power]?.state) : NaN;
            const sv = d.sensor ? STATES[d.sensor] : null;
            // Stato: potenza > 5W → IN FUNZIONE; altrimenti switch on/off
            let on = false, st = '—';
            if (!isNaN(pw)) { on = pw > 5; st = on ? 'Running' : (sw ? (sw.state === 'on' ? 'Ready' : 'Off') : 'Off'); }
            else if (sw) { on = sw.state === 'on'; st = on ? 'On' : 'Off'; }
            card.classList.toggle('on', on);
            if (stEl) stEl.textContent = st;
            let val = '';
            if (!isNaN(pw) && pw > 5) val = Math.round(pw) + ' W';
            if (sv && sv.state !== undefined && sv.state !== 'unavailable' && sv.entity_id !== 'dm.unmapped') {
                const u = sv.attributes?.unit_of_measurement || '';
                val = (val ? val + ' · ' : '') + sv.state + (u ? ' ' + u : '');
            }
            if (valEl) valEl.textContent = val;
        });
    } catch (err) { console.error('[dispositivi]', err); }
}
function devCardTap(i) {
    const d = getDevices()[i];
    if (!d) return;
    if (d.sensor) { apriStorico(event, d.sensor, d.name); return; }
    if (d.power) { apriStorico(event, d.power, d.name); return; }
    if (d.switch) toggle(d.switch);
}
document.addEventListener('DOMContentLoaded', buildDeviceCards);
setInterval(() => { try { if (Object.keys(_RAW_STATES).length) updateDeviceCards(); } catch(e) {} }, 20000);

function cdRoomFloorOf(roomName){ if(!roomName) return ''; var rs=(typeof getStanze==='function'?getStanze():[]); for(var i=0;i<rs.length;i++){ if(rs[i]&&rs[i].name===roomName) return rs[i].floor||''; } return ''; } function cdGroupCards(items, cardFn){ try { var anyRoom=false; items.forEach(function(u){ if(u&&u.room) anyRoom=true; }); if(!anyRoom) return items.map(cardFn).join(''); var floors=(typeof cdFloorNames==='function'?cdFloorNames():[]); function fIdx(f){ var i=floors.indexOf(f); return i<0?9999:i; } var sorted=items.slice().sort(function(a,b){ var fa=cdRoomFloorOf(a.room), fb=cdRoomFloorOf(b.room); if(fIdx(fa)!==fIdx(fb)) return fIdx(fa)-fIdx(fb); var ra=a.room||'zzzz', rb=b.room||'zzzz'; if(ra!==rb) return ra<rb?-1:1; return 0; }); var out=''; var lastKey=null; sorted.forEach(function(u){ var f=cdRoomFloorOf(u.room); var key=(f||'')+'|'+(u.room||''); if(key!==lastKey){ lastKey=key; var lbl = u.room ? ((f?('🏢 '+f+' · '):'')+'🏠 '+u.room) : '🏠 Senza stanza'; out += '<div style="grid-column:1/-1; font-weight:800; opacity:0.75; font-size:13px; letter-spacing:0.5px; padding:8px 2px 0;">'+lbl+'</div>'; } out += cardFn(u); }); return out; } catch(e){ return items.map(cardFn).join(''); } } function buildClimaCards() {
    const gF = document.getElementById('clima-grid-freddo');
    const gC = document.getElementById('clima-grid-caldo');
    if (!gF && !gC) return;
    const card = (u) => {
        const htmlId = u.entity.replace(/\./g, '-');
        const nm = (u.name || '').replace(/'/g, '&#39;');
        const icon = u.type === 'termo' ? '🔥' : '❄️';
        return `<div class="cp-card" id="card-${htmlId}" onclick="apriClimaPopup('${u.entity}', event)" style="--cp-rgb: 148, 163, 184;">
           <div class="cp-header">
              <div class="cp-title-wrap"><div class="cp-icon">${icon}</div><div class="cp-name">${u.name}</div></div>
              <div class="cp-badge">OFF</div>
           </div>
           <div class="cp-body">
              <div class="cp-temp-target"><span class="lbl">Target</span><span class="val">--°</span></div>
              <div class="cp-temp-current-wrap"><span class="cp-temp-current-lbl">Room</span><span class="cp-temp-current">--°</span></div>
           </div>
           <div class="cp-controls">
              <button class="cp-btn" onclick="event.stopPropagation(); setTemp('${u.entity}', 'down')">➖</button>
              <button class="cp-btn cp-pwr" onclick="event.stopPropagation(); toggleClima('${u.entity}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg></button>
              <button class="cp-btn" onclick="event.stopPropagation(); setTemp('${u.entity}', 'up')">➕</button>
           </div>
        </div>`;
    };
    const units = getClimaUnits();
    const uFreddo = units.filter(u => u.type !== 'termo');
    const uCaldo  = units.filter(u => u.type === 'termo');
    if (gF) gF.innerHTML = cdGroupCards(uFreddo, card) || '<div class="ed-empty" style="grid-column:1/-1; justify-content:center; flex-wrap:wrap;">No air conditioner configured</div>';
    if (gC) gC.innerHTML = cdGroupCards(uCaldo, card) || '<div class="ed-empty" style="grid-column:1/-1; justify-content:center; flex-wrap:wrap;">No radiator configured</div>';
    /* v0.9.7: if only one type is configured, no tabs — the right zone opens directly */
    try {
        const sw = document.querySelector('.clima-page-mode-switch');
        if (uFreddo.length && !uCaldo.length)      { if (sw) sw.style.display = 'none'; setClimaPageMode('freddo', true); }
        else if (uCaldo.length && !uFreddo.length) { if (sw) sw.style.display = 'none'; setClimaPageMode('caldo',  true); }
        else if (sw) sw.style.display = '';
    } catch(e) {}
    try { if (Object.keys(_RAW_STATES).length) updateClimaCards(); } catch(e) {}
}
document.addEventListener('DOMContentLoaded', () => {
    buildClimaCards();
    // v270 (issue #1): se gli stati sono già arrivati prima della costruzione delle card, applicali subito
    try { if (Object.keys(_RAW_STATES).length) render(); } catch(e) {}
});

/* ═══ v263: AUTO-AGGIORNAMENTO — dopo un update HACS la dashboard si ricarica da sola.
   Al load (e ogni 6h) legge il proprio sorgente dal server con cache disabilitata:
   se la versione sul disco è diversa da quella in esecuzione, ricarica con ?v=nuova
   (query diversa = il browser scarica il file fresco). L'URL della plancia non cambia mai. ═══ */
let _cdBootDone = false;
function cdHideBoot() {
    window.__DASHBOARDMODERN_READY__ = true;
    if (window.__DASHBOARDMODERN_BOOT_TIMEOUT__) clearTimeout(window.__DASHBOARDMODERN_BOOT_TIMEOUT__);
    if (_cdBootDone) return; _cdBootDone = true;
    const o = document.getElementById('cd-boot-overlay');
    if (o) { o.style.opacity = '0'; setTimeout(() => { if (o.parentNode) o.remove(); }, 260); }
}
async function cdCheckUpdate(isBoot) {
    if (window.__DASHBOARDMODERN_HOSTED__ || location.pathname.indexOf('/dashboardmodern_static') !== -1) { try { if (isBoot) cdHideBoot(); } catch(e) {} return; }
    try {
        const resp = await fetch(location.pathname + '?_upd=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) { if (isBoot) cdHideBoot(); return; }
        const src = await resp.text();
        const m = src.match(/const\s+DASHBOARD_VERSION\s*=\s*'([^']+)'/);
        if (!m || m[1] === DASHBOARD_VERSION) { if (isBoot) cdHideBoot(); return; }
        const target = m[1];
        const params = new URLSearchParams(location.search);
        if (params.get('v') === target) {
            console.warn('[Dashboard] New version ' + target + ' but the cache is not updating. Clear the browser/app cache.');
            if (isBoot) cdHideBoot();
            return;
        }
        console.log('[Dashboard] Updating ' + DASHBOARD_VERSION + ' \u2192 ' + target + ': reloading\u2026');
        if (!isBoot && !document.getElementById('cd-boot-overlay')) cdShowUpdateOverlay(target);
        params.set('v', target);
        location.replace(location.pathname + '?' + params.toString() + location.hash);
    } catch(e) { if (isBoot) cdHideBoot(); }
}
function cdShowUpdateOverlay(target) {
    if (document.getElementById('cd-update-overlay') || document.getElementById('cd-boot-overlay')) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const o = document.createElement('div');
    o.id = 'cd-update-overlay';
    o.style.cssText = 'position:fixed; inset:0; z-index:2147483647; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; font-family:Oswald,sans-serif; background:' + (dark ? 'rgba(8,12,22,0.94)' : 'rgba(232,237,243,0.97)') + '; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);';
    o.innerHTML = '<div style="width:46px; height:46px; border:4px solid ' + (dark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.22)') + '; border-top-color:#0ea5e9; border-radius:50%; animation:cdSpin 0.8s linear infinite;"></div><div style="font-size:15px; font-weight:800; letter-spacing:1px; color:' + (dark ? '#7dd3fc' : '#0369a1') + '; text-transform:uppercase;">Updating to v' + target + '\u2026</div>';
    document.body.appendChild(o);
}
/* immediate check on open: content stays covered by the boot overlay until we know whether to update, so the change is never visible */
cdCheckUpdate(true);
document.addEventListener('DOMContentLoaded', () => setTimeout(cdHideBoot, 2500));
setInterval(() => cdCheckUpdate(false), 6 * 3600 * 1000);


/* ═══ v260: AUTO-HIDE (build pubblica) — gli elementi le cui entità di sezione
   non sono state mappate dall'utente vengono nascosti dalla dashboard. ═══ */
function cdAutoHide() {
    if (typeof CD_REQUIRE_MAPPING === 'undefined' || !CD_REQUIRE_MAPPING) return;
    const CARD_SEL = '.cp-card, .lm-kpi-card, .lm-stat-card, .srv-status-card, .qa-btn, .ns-thermal-row, .ev-kpi, .recap-card, .hist-clickable, [data-cd-card]';
    document.querySelectorAll('[onclick]').forEach(el => {
        const oc = el.getAttribute('onclick') || '';
        const refs = oc.match(/dm\.[a-z0-9_]+/g);
        if (!refs || !refs.length) return;
        /* v0.8.2: a ref is covered also when the period engine derives it from the twin field (day←month) */
        const allUnmapped = refs.every(r => !ENTITY_OVERRIDES[r] && (typeof CD_PERIOD === 'undefined' || CD_PERIOD[r] === undefined));
        if (allUnmapped) {
            const card = el.closest(CARD_SEL) || el;
            card.style.display = 'none';
        }
    });
}
document.addEventListener('DOMContentLoaded', () => setTimeout(cdAutoHide, 300));
setInterval(() => { try { cdAutoHide(); } catch(e){} }, 60000);

/* v264: se la dashboard è "vuota" (nessuna entità configurata) guida l'utente al wizard
   invece di mostrare pagine deserte. Solo build pubblica. */
function cdEmptyStateCheck() {
    if (typeof CD_REQUIRE_MAPPING === 'undefined' || !CD_REQUIRE_MAPPING) return;
    const noSlots = !Object.keys(ENTITY_OVERRIDES || {}).length;
    const noRooms = !(cdCfgList('cd_stanze')).length;
    const noClima = !(cdCfgList('cd_clima_units')).length;
    const noLights = !Object.keys(cdCfg('cd_luci') || {}).length;
    if (!(noSlots && noRooms && noClima && noLights)) return;
    const home = document.getElementById('page-home');
    if (!home || document.getElementById('cd-empty-banner')) return;
    const b = document.createElement('div');
    b.id = 'cd-empty-banner';
    b.style.cssText = 'margin:14px 0; padding:18px 20px; border-radius:20px; background:linear-gradient(135deg,#e0f2fe,#bae6fd); border:1px solid #7dd3fc; color:#0c4a6e; font-size:13.5px; line-height:1.65; box-shadow:0 4px 14px rgba(2,132,199,0.12);';
    b.innerHTML = '<b style="font-size:15px;">👋 Your dashboard is almost ready!</b><br>You have not linked your entities yet, so the cards are hidden.<br><button onclick="(window.__DASHBOARDMODERN_HOSTED__ ? apriConfigEntita : apriSetupWizard)()" style="margin-top:12px; width:100%; padding:13px; border:none; border-radius:14px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-weight:800; font-size:14px; letter-spacing:0.5px; cursor:pointer; box-shadow:0 6px 16px rgba(2,132,199,0.35);">⚙️ Set up the dashboard</button><br><span style="opacity:0.75; font-size:12px; display:block; margin-top:8px;"></span>';
    home.insertBefore(b, home.firstChild);
}
document.addEventListener('DOMContentLoaded', () => setTimeout(cdEmptyStateCheck, 500));
/* v262: ri-applico l'occultamento sezioni anche dopo load (doppia sicurezza) */
window.addEventListener('load', () => {
    try {
        const wSect = cdCfg('cd_sections');
        const sect = Object.keys(wSect||{}).length ? wSect : ((window.DASHBOARD_CONFIG||{}).sections || null);
        if (!sect) return;
        Object.entries(sect).forEach(([sec, enabled]) => {
            if (enabled !== false) return;
            const tab = document.querySelector(`.tab[data-tab="${sec}"]`);
            const page = document.getElementById('page-' + sec);
            /* remover secondario neutralizzato (cdApplyNavVis comanda) */
        });
    } catch(e) {}
});


/* ═══ v258: TELECAMERE dinamiche — configurabili da UI (cd_cameras) ═══ */
const CD_CAMERAS_DEFAULT = [];
function getCameras() { var raw=cdCfgList('cd_cameras'); var api=window.DashboardModernModules&&DashboardModernModules.data; return api?api.normalizeCameras(raw):raw.map(function(c,i){ return Object.assign({},c,{id:c.id||('camera-'+i),name:c.name||c.entity||c.camera_entity,entity:c.entity||c.camera_entity||c.cam||'',stream:c.stream||c.stream_url||c.url||''}); });
}
function camSlug(cam, i) { return 'cam-' + (cam.entity ? cam.entity.split('.')[1] : 'x' + i); }
function buildCamCards() {
    const grid = document.getElementById('cam-grid');
    if (!grid) return;
    grid.innerHTML = getCameras().map((cam, i) => {
        const slug = camSlug(cam, i);
        const nm = (cam.name || cam.entity || '').toUpperCase().replace(/'/g, '&#39;');
        const title = 'CAM ' + String(i+1).padStart(2,'0') + ' // ' + nm;
        return `<div class="cam-card" onclick="apriCamera('${slug}', '${title}')"><div class="cam-overlay-top"><span class="cam-name">${title}</span><span class="cam-rec">REC</span></div><div class="cam-feed"><img id="${slug}" src=""></div><div class="cam-overlay-bottom"><span class="cam-time" id="time-${slug.replace('cam-','')}">--:--:--</span><span style="color:#06b6d4;">CH${i+1}</span></div></div>`;
    }).join('');
}
document.addEventListener('DOMContentLoaded', buildCamCards);
/* v259: nomi sezioni personalizzati applicati ai tab */
document.addEventListener('DOMContentLoaded', () => {
    try {
        const names = cdCfg('cd_section_names');
        Object.entries(names || {}).forEach(([sec, nm]) => {
            const t = document.querySelector(`.tab[data-tab="${sec}"] .text`);
            if (t && nm) t.textContent = nm;
        });
    } catch(e) {}
});
/* v258: immagine auto configurabile (cd_ev_image = URL) */
let CD_EV_IMAGE = '';
document.addEventListener('DOMContentLoaded', () => {
    try {
        const img = cdCfg('cd_ev_image');
        const url = (typeof img === 'string' && img) ? img : (img && img.url) || '';
        CD_EV_IMAGE = url || '';
        if (url) ['ev-mod-car-img','ev-new-car-img'].forEach(id => { const el = document.getElementById(id); if (el) el.src = url; });
    } catch(e) {}
});


function apriCamera(camId, title) {
    if (navigator.vibrate) navigator.vibrate(10);
    currentPopupType = 'camera_view';
    const list = document.getElementById('details-list');
    document.getElementById('details-title').innerHTML = '📹 ' + title;
    document.getElementById('details-modal').classList.add('show');
    let cam = null;
    getCameras().forEach((c, i) => { if (camSlug(c, i) === camId) cam = c; });
    if (!cam) { list.innerHTML = '<div class="cam-popup-error">⚠️ Camera not found</div>'; return; }
    dmCamOpen(cam, title, list);
}

/* ═══ v0.9.8: MULTI-STRATEGY CAMERA ENGINE (from Casa Donato) ═══
   Cascade native WebRTC → HLS → MJPEG → Polling snapshot, with automatic
   fallback, audio, fullscreen and iOS WebView-compatible refresh.
   Reuses Modern primitives: ws, msgId, pendingWsCallbacks, STATES,
   LONG_LIVED_TOKEN, HA_HTTP_URL, toggleFullScreenCam. */
let _dmCurrentCam = null, _dmPc = null, _dmWs = null, _dmHls = null;
let _dmPollInt = null, _dmPollBlob = null, _dmPollFail = 0;
const _dmCamBlobs = {};
function dmIsWebRTC() { return typeof RTCPeerConnection !== 'undefined'; }

function dmStreamName(cam) { return cam.stream || (cam.entity ? cam.entity.split('.')[1] : ''); }

async function dmCamOpen(cam, title, content) {
    dmCamCleanup();
    _dmCurrentCam = cam;
    const streamName = dmStreamName(cam);
    if (!streamName) { content.innerHTML = '<div class="cam-popup-error">⚠️ Stream not configured for this camera</div>'; return; }
    const camState = STATES[cam.entity] && STATES[cam.entity].state;
    if (camState === 'unavailable' || camState === 'unknown') {
        content.innerHTML = `<div class="cam-popup-error">⚠️ Camera offline<br><span style="font-weight:500;opacity:.85;font-size:12px;text-transform:none;letter-spacing:0;">${cam.entity} not responding (state: ${camState || 'sconosciuto'})</span></div>`;
        return;
    }
    const strategies = [];
    if (dmIsWebRTC()) strategies.push({ name: 'WebRTC', run: () => dmCamWebRTC(cam, streamName, content) });
    strategies.push({ name: 'HLS',     run: () => dmCamHLS(cam, content) });
    strategies.push({ name: 'MJPEG',   run: () => dmCamMJPEG(cam, content) });
    strategies.push({ name: 'Polling', run: () => Promise.resolve(dmCamPolling(cam, content)) });
    for (const st of strategies) {
        try { await st.run(); console.log('[Cam] ✓ ' + st.name); return; }
        catch (err) { console.warn('[Cam] ' + st.name + ' fallito:', err && err.message || err); dmCleanupWebRTC(); dmCleanupHLS(); }
    }
    content.innerHTML = '<div class="cam-popup-error">⚠️ Unable to open camera<br><span style="font-weight:500;opacity:.85;font-size:12px;text-transform:none;letter-spacing:0;">No streaming strategy worked</span></div>';
}

const _DM_FS_BTNS = `<button id="close-fullscreen-btn" class="close-fullscreen-btn" style="display:none; position:absolute; top:16px; right:16px; z-index:99999; background:rgba(15,23,42,0.85); border:2px solid rgba(255,255,255,0.4); color:#fff; border-radius:50%; width:52px; height:52px; font-size:22px; font-weight:bold; cursor:pointer; align-items:center; justify-content:center; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); box-shadow:0 10px 25px rgba(0,0,0,0.6);" onclick="toggleFullScreenCam()">✕</button>`;

async function dmCamWebRTC(cam, streamName, content) {
    content.innerHTML = `<div class="cam-popup-body"><div id="video-iframe-container" class="cam-zoom-container" style="position:relative; padding-top:56.25%;"><video id="cam-video" autoplay playsinline></video><div id="cam-audio-mini" class="cam-audio-mini-banner" onclick="dmUnlockAudioWebRTC()">🔇 Tap per audio</div><div id="cam-video-loader" class="cam-video-loader-overlay"><div class="cam-popup-spinner"></div><div>Connecting WebRTC…</div></div>${_DM_FS_BTNS}</div><button id="toggle-fs-main-btn" class="cam-fs-btn" onclick="toggleFullScreenCam()">🔲 Fullscreen</button></div>`;
    const videoEl = document.getElementById('cam-video');
    const loaderEl = document.getElementById('cam-video-loader');
    videoEl.volume = 1.0; videoEl.muted = false;
    const started = new Promise((resolve, reject) => {
        let done = false;
        const ok = () => { if (done) return; done = true; if (loaderEl) loaderEl.classList.add('hidden'); resolve(); };
        videoEl.addEventListener('playing', ok, { once: true });
        videoEl.addEventListener('loadeddata', ok, { once: true });
        setTimeout(() => { if (done) return; done = true; reject(new Error('WebRTC video did not start within 3s')); }, 3000);
    });
    await dmStartWebRTC(streamName, videoEl);
    await started;
}

async function dmCamHLS(cam, content) {
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('HA WebSocket not active');
    const reqId = msgId++;
    const hlsUrl = await new Promise((resolve, reject) => {
        const tid = setTimeout(() => { if (pendingWsCallbacks[reqId]) { delete pendingWsCallbacks[reqId]; reject(new Error('Timeout HLS')); } }, 5000);
        pendingWsCallbacks[reqId] = (m) => { clearTimeout(tid); if (m.success && m.result && m.result.url) resolve(m.result.url); else reject(new Error((m.error && m.error.message) || 'HLS not available')); };
        ws.send(JSON.stringify({ id: reqId, type: 'camera/stream', entity_id: cam.entity, format: 'hls' }));
    });
    content.innerHTML = `<div class="cam-popup-body"><div id="video-iframe-container" class="cam-zoom-container" style="position:relative; padding-top:56.25%;"><video id="cam-hls" autoplay playsinline controls></video><div id="cam-audio-mini" class="cam-audio-mini-banner" onclick="dmUnlockAudio()">🔇 Tap per audio</div><div id="cam-video-loader" class="cam-video-loader-overlay"><div class="cam-popup-spinner"></div><div>Connecting…</div></div>${_DM_FS_BTNS}</div><button id="toggle-fs-main-btn" class="cam-fs-btn" onclick="toggleFullScreenCam()">🔲 Fullscreen</button><div id="cam-audio-panel" class="cam-audio-panel"><div class="cam-audio-panel-row"><div id="cam-audio-status" class="cam-audio-status muted">🔊 Audio</div><button class="cam-audio-toggle-btn" onclick="dmToggleAudio()" title="Mute/unmute">🔊</button><input id="cam-audio-volume" class="cam-audio-volume" type="range" min="0" max="100" value="100" oninput="dmSetVolume(this.value)"><button class="cam-audio-info-btn" onclick="dmToggleDiag(this)" title="Diagnostics">ℹ</button></div><div id="cam-audio-diag" class="cam-audio-diag">Waiting…</div></div></div>`;
    const videoEl = document.getElementById('cam-hls');
    const loaderEl = document.getElementById('cam-video-loader');
    videoEl.volume = 1.0; videoEl.muted = false;
    const supportsNative = videoEl.canPlayType('application/vnd.apple.mpegurl') !== '';
    if (supportsNative) { videoEl.src = hlsUrl; }
    else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        _dmHls = new Hls({ lowLatencyMode: true, backBufferLength: 10, maxBufferLength: 8 });
        _dmHls.loadSource(hlsUrl); _dmHls.attachMedia(videoEl);
        _dmHls.on(Hls.Events.MANIFEST_PARSED, () => dmTryPlayUnmuted(videoEl));
        _dmHls.on(Hls.Events.ERROR, (e, data) => console.error('[HLS]', data));
    } else { throw new Error('HLS not supported and hls.js missing'); }
    dmTryPlayUnmuted(videoEl);
    await new Promise((resolve, reject) => {
        let done = false;
        const onReady = () => { if (done) return; done = true; if (loaderEl) loaderEl.classList.add('hidden');
            const iv = setInterval(() => { if (!document.getElementById('cam-hls')) { clearInterval(iv); return; } dmUpdateAudioStatus(); }, 500);
            dmUpdateAudioStatus(); resolve(); };
        ['loadedmetadata','canplay','loadeddata','playing'].forEach(ev => videoEl.addEventListener(ev, onReady, { once: true }));
        videoEl.addEventListener('error', () => { if (done) return; done = true; reject(new Error('Video error')); }, { once: true });
        setTimeout(() => { if (done) return; done = true; reject(new Error('HLS: no frame within 10s')); }, 10000);
    });
}

async function dmCamMJPEG(cam, content) {
    let streamUrl = null;
    const state = STATES[cam.entity];
    if (state && state.attributes && state.attributes.entity_picture) {
        streamUrl = state.attributes.entity_picture.replace('/api/camera_proxy/', '/api/camera_proxy_stream/');
    }
    if (!streamUrl) {
        try { streamUrl = await dmGetSignedPath('/api/camera_proxy_stream/' + cam.entity, 14400); }
        catch (e) { throw new Error('No MJPEG URL: ' + (e.message || e)); }
    }
    content.innerHTML = `<div class="cam-popup-body"><div id="video-iframe-container" class="cam-zoom-container" style="position:relative; padding-top:56.25%;"><img id="cam-mjpeg" src="${streamUrl}" alt="${cam.entity}"><div id="cam-video-loader" class="cam-video-loader-overlay"><div class="cam-popup-spinner"></div><div>Connecting stream…</div></div>${_DM_FS_BTNS}</div><button id="toggle-fs-main-btn" class="cam-fs-btn" onclick="toggleFullScreenCam()">🔲 Fullscreen</button><div class="cam-popup-hint"><span class="cam-mode-badge mjpeg">MJPEG</span> Continuous live stream</div></div>`;
    const mjpegEl = document.getElementById('cam-mjpeg');
    const loaderEl = document.getElementById('cam-video-loader');
    await new Promise((resolve, reject) => {
        let done = false;
        mjpegEl.onload = () => { if (done) return; done = true; if (loaderEl) loaderEl.classList.add('hidden'); resolve(); };
        mjpegEl.onerror = () => { if (done) return; done = true; reject(new Error('MJPEG load error')); };
        setTimeout(() => { if (done) return; done = true; reject(new Error('MJPEG: no frame within 3s')); }, 3000);
    });
}

async function dmCamPolling(cam, content) {
    const buildUrl = () => {
        const state = STATES[cam.entity];
        if (!state || !state.attributes || !state.attributes.entity_picture) return null;
        const path = state.attributes.entity_picture;
        return path + (path.includes('?') ? '&' : '?') + 't=' + Date.now();
    };
    if (!buildUrl()) { content.innerHTML = `<div class="cam-popup-error">⚠️ Stream unavailable<br><span style="font-weight:500;opacity:.85;font-size:12px;text-transform:none;letter-spacing:0;">Camera ${cam.entity} does not expose snapshots</span></div>`; return; }
    const slug = camSlug(cam, 0);
    content.innerHTML = `<div class="cam-popup-body"><div id="video-iframe-container" class="cam-zoom-container" style="position:relative; padding-top:56.25%;"><img id="cam-polling" alt="${cam.entity}"><div id="cam-video-loader" class="cam-video-loader-overlay"><div class="cam-popup-spinner"></div><div>Loading…</div></div>${_DM_FS_BTNS}</div><button id="toggle-fs-main-btn" class="cam-fs-btn" onclick="toggleFullScreenCam()">🔲 Fullscreen</button><button id="cam-audio-activate-btn" class="cam-audio-btn" onclick="dmAttivaAudio()">🔊 Attiva audio</button><div class="cam-popup-hint"><span class="cam-mode-badge polling">SNAPSHOT</span> Preview ~2 fps · Tap "Enable audio" for audio + video</div></div>`;
    const imgEl = document.getElementById('cam-polling');
    const loaderEl = document.getElementById('cam-video-loader');
    if (_dmPollInt) clearInterval(_dmPollInt);
    _dmPollFail = 0;
    const loadFrame = async () => {
        if (!document.getElementById('cam-polling')) { clearInterval(_dmPollInt); _dmPollInt = null; return; }
        if (_dmPollFail >= 5) { clearInterval(_dmPollInt); _dmPollInt = null; content.innerHTML = '<div class="cam-popup-error">⚠️ Camera not responding<br><span style="font-weight:500;opacity:.85;font-size:12px;text-transform:none;letter-spacing:0;">5 attempts failed — check the camera connection</span></div>'; return; }
        const url = buildUrl(); if (!url) return;
        const blob = await dmLoadImageBlob(url);
        if (!blob || !imgEl.isConnected) { _dmPollFail++; return; }
        _dmPollFail = 0;
        if (_dmPollBlob && _dmPollBlob.startsWith('blob:')) URL.revokeObjectURL(_dmPollBlob);
        _dmPollBlob = blob; imgEl.src = blob;
        if (loaderEl) loaderEl.classList.add('hidden');
    };
    await loadFrame();
    _dmPollInt = setInterval(loadFrame, 500);
}

async function dmStartWebRTC(streamName, videoEl) {
    dmCleanupWebRTC();
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], bundlePolicy: 'max-bundle' });
    _dmPc = pc;
    pc.ontrack = (e) => { if (videoEl.srcObject !== e.streams[0]) videoEl.srcObject = e.streams[0]; dmTryPlayUnmuted(videoEl); };
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let signedPath;
    try { signedPath = await dmGetSignedPath('/api/webrtc/ws?url=' + encodeURIComponent(streamName), 60); }
    catch (e) { dmCleanupWebRTC(); throw new Error('Unable to sign WebRTC URL: ' + (e.message || e)); }
    const camWs = new WebSocket(`${wsProto}//${location.host}${signedPath}`);
    _dmWs = camWs;
    pc.onicecandidate = (e) => { if (camWs.readyState === WebSocket.OPEN) camWs.send(JSON.stringify({ type: 'webrtc/candidate', value: e.candidate ? e.candidate.candidate : '' })); };
    return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (err) => { if (settled) return; settled = true; clearTimeout(tid); reject(err); };
        const done = () => { if (settled) return; settled = true; clearTimeout(tid); resolve(pc); };
        const tid = setTimeout(() => fail(new Error('WebRTC timeout (10s)')), 10000);
        camWs.onopen = async () => { try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); camWs.send(JSON.stringify({ type: 'webrtc/offer', value: offer.sdp })); } catch (err) { fail(err); } };
        camWs.onmessage = async (ev) => {
            let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (msg.type === 'webrtc/answer') { try { await pc.setRemoteDescription({ type: 'answer', sdp: msg.value }); done(); } catch (err) { fail(err); } }
            else if (msg.type === 'webrtc/candidate') { if (msg.value) { try { await pc.addIceCandidate({ candidate: msg.value, sdpMid: '0' }); } catch (err) {} } }
            else if (msg.type === 'error') { fail(new Error(msg.value || 'WebRTC server error')); }
        };
        camWs.onerror = () => fail(new Error('WebRTC WebSocket unreachable'));
        camWs.onclose = (e) => { if (!settled) { if (e.code === 4401 || e.code === 4403) fail(new Error('WebRTC auth rejected')); else fail(new Error('WS chiusa prima dell handshake (code ' + e.code + ')')); } };
    });
}

function dmGetSignedPath(unsignedPath, expires = 60) {
    return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) { reject(new Error('HA WebSocket not active')); return; }
        const reqId = msgId++;
        const tid = setTimeout(() => { if (pendingWsCallbacks[reqId]) { delete pendingWsCallbacks[reqId]; reject(new Error('Sign path timeout')); } }, 4000);
        pendingWsCallbacks[reqId] = (m) => { clearTimeout(tid); if (m.success && m.result && m.result.path) resolve(m.result.path); else reject(new Error((m.error && m.error.message) || 'sign_path failed')); };
        ws.send(JSON.stringify({ id: reqId, type: 'auth/sign_path', path: unsignedPath, expires: expires }));
    });
}

async function dmLoadImageBlob(path, timeoutMs = 3000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const resp = await fetch(path, { credentials: 'include', headers: { 'Authorization': 'Bearer ' + LONG_LIVED_TOKEN }, signal: ctrl.signal });
        if (!resp.ok) return null;
        return URL.createObjectURL(await resp.blob());
    } catch (e) { return null; } finally { clearTimeout(timer); }
}

function dmTryPlayUnmuted(videoEl) {
    if (!videoEl) return;
    videoEl.muted = false; videoEl.volume = 1.0;
    const pp = videoEl.play();
    if (pp && typeof pp.then === 'function') {
        pp.then(() => dmHideAudioMini()).catch(() => { videoEl.muted = true; videoEl.play().catch(() => {}); dmShowAudioMini(); });
    }
}
function dmShowAudioMini() { const b = document.getElementById('cam-audio-mini'); if (!b) return; b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 6000); }
function dmHideAudioMini() { const b = document.getElementById('cam-audio-mini'); if (b) { b.classList.remove('show'); clearTimeout(b._t); } }
function dmUpdateAudioStatus() {
    const v = document.getElementById('cam-hls'), st = document.getElementById('cam-audio-status'), dg = document.getElementById('cam-audio-diag');
    if (!v || !st) return;
    let tracks = 'n/a';
    try { if (v.audioTracks) tracks = v.audioTracks.length; else if (_dmHls && _dmHls.audioTracks) tracks = _dmHls.audioTracks.length; } catch (e) {}
    const vol = Math.round(v.volume * 100);
    if (v.muted || vol === 0) { st.textContent = '🔇 Muto'; st.className = 'cam-audio-status muted'; }
    else if (tracks === 0) { st.textContent = '⚠ No audio'; st.className = 'cam-audio-status no-track'; }
    else { st.textContent = '🔊 ' + vol + '%'; st.className = 'cam-audio-status active'; }
    if (dg) dg.textContent = 'Tracks: ' + tracks + ' · muted=' + v.muted + ' · vol=' + vol + '% · state=' + v.readyState;
}

window.dmUnlockAudio = function () { const v = document.getElementById('cam-hls'); if (v) { v.muted = false; v.volume = 1.0; v.play().catch(() => {}); } dmHideAudioMini(); if (navigator.vibrate) navigator.vibrate(20); dmUpdateAudioStatus(); };
window.dmUnlockAudioWebRTC = function () { const v = document.getElementById('cam-video'); if (v) { v.muted = false; v.volume = 1.0; v.play().catch(() => {}); } dmHideAudioMini(); if (navigator.vibrate) navigator.vibrate(20); };
window.dmToggleAudio = function () { const v = document.getElementById('cam-hls'); if (!v) return; v.muted = !v.muted; if (!v.muted && v.volume === 0) v.volume = 1.0; v.play().catch(() => {}); if (!v.muted) dmHideAudioMini(); dmUpdateAudioStatus(); };
window.dmSetVolume = function (val) { const v = document.getElementById('cam-hls'); if (!v) return; const x = Math.max(0, Math.min(100, parseInt(val, 10) || 0)) / 100; v.volume = x; v.muted = (x === 0); v.play().catch(() => {}); dmUpdateAudioStatus(); };
window.dmToggleDiag = function (btn) { const p = document.getElementById('cam-audio-panel'); if (!p) return; const ex = p.classList.toggle('expanded'); if (btn) btn.classList.toggle('active', ex); };
window.dmAttivaAudio = async function () {
    const cam = _dmCurrentCam; if (!cam) return;
    if (navigator.vibrate) navigator.vibrate(15);
    if (_dmPollInt) { clearInterval(_dmPollInt); _dmPollInt = null; }
    if (_dmPollBlob && _dmPollBlob.startsWith('blob:')) { URL.revokeObjectURL(_dmPollBlob); _dmPollBlob = null; }
    const content = document.getElementById('details-list'); if (!content) return;
    content.innerHTML = '<div class="cam-popup-body"><div class="cam-zoom-container" style="position:relative;padding-top:56.25%;"><div class="cam-video-loader-overlay"><div class="cam-popup-spinner"></div><div>Starting HLS audio…</div></div></div></div>';
    try { await dmCamHLS(cam, content); const v = document.getElementById('cam-hls'); if (v) { v.muted = false; v.volume = 1.0; await v.play().catch(() => {}); } }
    catch (e) { content.innerHTML = `<div class="cam-popup-error">⚠️ Audio unavailable<br><span style="font-weight:500;opacity:.85;font-size:12px;text-transform:none;letter-spacing:0;">${e.message || e}</span></div>`; setTimeout(() => { const c = document.getElementById('details-list'); if (c) dmCamPolling(cam, c); }, 3500); }
};

function dmCleanupWebRTC() { if (_dmPc) { try { _dmPc.close(); } catch (e) {} _dmPc = null; } if (_dmWs) { try { _dmWs.close(); } catch (e) {} _dmWs = null; } }
function dmCleanupHLS() { if (_dmHls) { try { _dmHls.destroy(); } catch (e) {} _dmHls = null; } }
function dmCamCleanup() {
    dmCleanupWebRTC(); dmCleanupHLS();
    const mj = document.getElementById('cam-mjpeg'); if (mj) mj.src = '';
    const hv = document.getElementById('cam-hls'); if (hv) { hv.removeAttribute('src'); try { hv.load(); } catch (e) {} }
    const wv = document.getElementById('cam-video'); if (wv) { try { wv.srcObject = null; } catch (e) {} }
    if (_dmPollInt) { clearInterval(_dmPollInt); _dmPollInt = null; }
    if (_dmPollBlob && _dmPollBlob.startsWith('blob:')) { URL.revokeObjectURL(_dmPollBlob); _dmPollBlob = null; }
    const pl = document.getElementById('cam-polling'); if (pl) pl.src = '';
    _dmCurrentCam = null;
}

function renderVideoHls(url) {
    const video = document.getElementById('popup-cam-video');
    const fallbackImg = document.getElementById('popup-cam-fallback-img');
    const instr = document.getElementById('cam-instr');
    if(!video) return;

    // A. CONFIGURATION AUDIO FORZATA
    video.muted = false; 
    video.volume = 1.0;

    video.onplaying = () => {
        if(fallbackImg) fallbackImg.style.display = 'none';
        video.style.display = 'block';
        
        // B. BLINDATURA AUDIO PER IOS/ANDROID
        video.muted = false;
        video.volume = 1.0;
        
        if(instr) instr.innerHTML = `<span style="color:#10b981;">✔️ Flusso Diretto con Audio Attivo</span>`;
    };

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        if(hlsInstance) hlsInstance.destroy();
        hlsInstance = new Hls({ 
            manifestLoadingTimeOut: 20000, 
            enableWorker: true,
            // Importante: forza la gestione del codec audio
            audioCodec: 'aac' 
        });
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
            video.muted = false;
            video.play().catch(e => console.log("Autoplay bloccato dal browser, premi Play", e));
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.muted = false; // Forza l'audio per Safari nativo
        video.play().catch(e => console.log("Autoplay bloccato", e));
    }
}
function renderFallbackMjpeg() {
    const video = document.getElementById('popup-cam-video');
    const fallbackImg = document.getElementById('popup-cam-fallback-img');
    const instr = document.getElementById('cam-instr');

    if(video) video.style.display = 'none'; 
    if(fallbackImg) fallbackImg.style.display = 'block'; 
    
    if(instr) instr.innerHTML = `<span style="color:#10b981;">✔️ Stream Diretto MJPEG a latenza zero</span>`;
}

function updateCamClocks() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('it-IT', { hour12: false });
    document.querySelectorAll('.cam-time').forEach(el => { el.textContent = timeStr; });
}
setInterval(updateCamClocks, 1000);
updateCamClocks();

async function apriMeteo() {
  if(navigator.vibrate) navigator.vibrate(10);
  document.getElementById('weather-modal').classList.add('show');
  const list = document.getElementById('weather-forecast-list');
  list.innerHTML = '<div style="text-align:center; padding: 30px; font-weight:800; color:var(--text-dim);">Caricamento Previsioni...</div>';
  let entityId = (typeof resolveEntity === 'function' ? resolveEntity('dm.core_055') : 'dm.core_055');
  try { const _w = cdFirstMapped('dm.core_055', 'weather.home', 'dm.home_meteo'); if (_w && _w.entity_id && _w.entity_id !== 'dm.unmapped') entityId = _w.entity_id; } catch(e) {}
  currentWeatherEntity = entityId;

  if (ws && ws.readyState === WebSocket.OPEN) {
      const reqId = msgId++;
      pendingWsCallbacks[reqId] = (m) => {
          if (m.success && m.result && m.result.response && m.result.response[entityId]) {
              renderForecasts(m.result.response[entityId].forecast || []);
          } else if (STATES[entityId] && STATES[entityId].attributes && STATES[entityId].attributes.forecast) {
              renderForecasts(STATES[entityId].attributes.forecast);
          } else {
              const reqId2 = msgId++;
              pendingWsCallbacks[reqId2] = (m2) => {
                  if (m2.success && m2.result && m2.result.response && m2.result.response[entityId]) {
                       const hourly = m2.result.response[entityId].forecast || [];
                       const dailyFromHourly = hourly.filter((_, i) => i % 24 === 0);
                       renderForecasts(dailyFromHourly);
                  } else {
                       list.innerHTML = `<div style="text-align:center; padding: 20px; color:#e11d48; font-weight:800;">Nessuna previsione disponibile per ${entityId}</div>`;
                  }
              };
              ws.send(JSON.stringify({ id: reqId2, type: "call_service", domain: "weather", service: "get_forecasts", service_data: { type: "hourly" }, target: { entity_id: entityId }, return_response: true }));
          }
      };
      ws.send(JSON.stringify({ id: reqId, type: "call_service", domain: "weather", service: "get_forecasts", service_data: { type: "daily" }, target: { entity_id: entityId }, return_response: true }));
  }
}

function renderForecasts(forecasts) {
  const list = document.getElementById('weather-forecast-list');
  if(!forecasts || forecasts.length === 0) { list.innerHTML = '<div style="text-align:center; padding: 20px; font-weight:800; color:#e11d48;">Nessuna previsione disponibile</div>'; return; }
  const wMap = { 'clear-night': '🌙', 'cloudy': '☁️', 'fog': '<div class=\"w-fog-anim\"><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div></div>', 'hail': '<div class=\"w-fog-anim\"><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div></div>', 'lightning': '⛈️', 'lightning-rainy': '⛈️', 'partlycloudy': '⛅', 'pouring': '🌧️', 'rainy': '🌧️', 'snowy': '❄️', 'snowy-rainy': '🌨️', 'sunny': '☀️', 'windy': '💨', 'windy-variant': '💨' };
  let fHtml = '';
  forecasts.slice(0, 7).forEach(f => {
      let d = new Date(f.datetime); let day = d.toLocaleDateString('it-IT', {weekday:'long', day:'numeric'}).toUpperCase(); let icon = wMap[f.condition] || '☀️';
      fHtml += `<div class="detail-row" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="apriMeteoOrario('${f.datetime}')">
          <div style="display:flex; align-items:center; gap:18px;"><div style="font-size:32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">${icon}</div><div style="font-weight:800; font-size:13px; color:var(--text-dim); letter-spacing:0.5px;">${day}</div></div>
          <div style="font-family:'Oswald', sans-serif; font-size:22px; font-weight:700;">${f.templow !== undefined ? `<span style="color:#0ea5e9;">${f.templow}°</span>` : ''} <span style="color:#e11d48; margin-left:12px;">${f.temperature}°</span></div></div>`;
  });
  list.innerHTML = fHtml;
}

function apriMeteoOrario(targetDateStr) {
  if(navigator.vibrate) navigator.vibrate(10);
  document.getElementById('weather-hourly-modal').classList.add('show');
  let dateObj = new Date(targetDateStr); let dayName = dateObj.toLocaleDateString('it-IT', {weekday:'long'}).toUpperCase();
  setTxt('weather-hourly-date', dayName);
  const list = document.getElementById('weather-hourly-list'); list.innerHTML = '<div style="text-align:center; padding: 30px; font-weight:800; color:var(--text-dim);">Caricamento Ore...</div>';
  if (!currentWeatherEntity) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
      const reqId = msgId++;
      pendingWsCallbacks[reqId] = (m) => {
          let hourly = [];
          if (m.success && m.result && m.result.response && m.result.response[currentWeatherEntity]) { hourly = m.result.response[currentWeatherEntity].forecast || []; } 
          else if (STATES[currentWeatherEntity] && STATES[currentWeatherEntity].attributes && STATES[currentWeatherEntity].attributes.forecast) { hourly = STATES[currentWeatherEntity].attributes.forecast; }
          const targetDay = targetDateStr.substring(0, 10);
          const filtered = hourly.filter(h => h.datetime.startsWith(targetDay));
          renderHourlyForecasts(filtered);
      };
      ws.send(JSON.stringify({ id: reqId, type: "call_service", domain: "weather", service: "get_forecasts", service_data: { type: "hourly" }, target: { entity_id: currentWeatherEntity }, return_response: true }));
  }
}

function renderHourlyForecasts(forecasts) {
  const list = document.getElementById('weather-hourly-list');
  if(!forecasts || forecasts.length === 0) { list.innerHTML = '<div style="text-align:center; padding: 20px; font-weight:800; color:#e11d48;">Nessun dato orario disponibile per questo giorno.</div>'; return; }
  const wMap = { 'clear-night': '🌙', 'cloudy': '☁️', 'fog': '<div class=\"w-fog-anim\"><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div></div>', 'hail': '<div class=\"w-fog-anim\"><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div></div>', 'lightning': '⛈️', 'lightning-rainy': '⛈️', 'partlycloudy': '⛅', 'pouring': '🌧️', 'rainy': '🌧️', 'snowy': '❄️', 'snowy-rainy': '🌨️', 'sunny': '☀️', 'windy': '💨', 'windy-variant': '💨' };
  let fHtml = '';
  forecasts.forEach(f => {
      let d = new Date(f.datetime); let hour = d.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'}); let icon = wMap[f.condition] || '☀️';
      fHtml += `<div class="detail-row" style="padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:18px;"><div style="font-size:26px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">${icon}</div><div style="font-weight:800; font-size:15px; color:var(--text); letter-spacing:0.5px;">${hour}</div></div>
          <div style="font-family:'Oswald', sans-serif; font-size:20px; font-weight:700; color:#e11d48;">${f.temperature}°${f.precipitation ? `<span style="font-size:12px; color:#0ea5e9; margin-left:8px; font-family:'Inter', sans-serif;">💧 ${f.precipitation}mm</span>` : ''}</div></div>`;
  });
  list.innerHTML = fHtml;
}

function cambiaTempoStorico(hours) {
    if(!currentHistEntity) return;
    apriStorico(null, currentHistEntity, currentHistName, hours);
}

async function apriStorico(e, entityId, name, hours = 24) {
    // v300: entità non configurata → nessuna azione (evita popup incoerenti)
    { const _e = arguments[1]; const _s = STATES[_e]; if (!_s || _s.entity_id === 'dm.unmapped') return; }
  if(e) e.stopPropagation(); if(e && navigator.vibrate) navigator.vibrate(15);
  entityId = resolveEntity(entityId);  // v254: applica eventuale override
  
  currentHistEntity = entityId;
  currentHistName = name || entityId;
  
  document.getElementById('history-modal').classList.add('show');
  setTxt('hist-title', currentHistName);
  
  document.querySelectorAll('.hist-time-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.hist-time-btn[data-hours="${hours}"]`);
  if(activeBtn) activeBtn.classList.add('active');

  document.getElementById('hist-loading').style.display = 'flex';
  document.getElementById('hist-canvas-container').style.display = 'none';
  if (storicChartInstance) { storicChartInstance.destroy(); }
  
  try {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const res = await fetch(`${HA_HTTP_URL}/api/history/period/${startTime}?filter_entity_id=${entityId}&minimal_response`, { headers: { "Authorization": `Bearer ${LONG_LIVED_TOKEN}`, "Content-Type": "application/json" } });
    
    if (!res.ok) throw new Error("API Error"); 
    const json = await res.json(); 
    const data = json[0];
    
    if (!data || data.length === 0) { document.getElementById('hist-loading').innerHTML = '<div style="font-size:32px; margin-bottom:6px;">📭</div>Nessun dato registrato'; return; }

    let labels = []; let values = []; let isCategorical = false;
    data.forEach(d => {
      if (d.state !== 'unknown' && d.state !== 'unavailable') {
        const date = new Date(d.last_changed);
        labels.push(date.getHours().toString().padStart(2,'0') + ':' + date.getMinutes().toString().padStart(2,'0'));
        let val = parseFloat(d.state);
        if (isNaN(val)) { val = (['on','open','armed_away','armed_night'].includes(d.state)) ? 1 : 0; isCategorical = true; }
        values.push(val);
      }
    });

    document.getElementById('hist-loading').style.display = 'none';
    document.getElementById('hist-canvas-container').style.display = 'block';
    const ctx = document.getElementById('hist-canvas').getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 320); gradient.addColorStop(0, 'rgba(2, 132, 199, 0.6)'); gradient.addColorStop(1, 'rgba(2, 132, 199, 0.0)');
    storicChartInstance = new Chart(ctx, {
      type: 'line', data: { labels: labels, datasets: [{ label: name, data: values, borderColor: '#0284c7', backgroundColor: gradient, borderWidth: 3, fill: true, pointRadius: 0, pointHoverRadius: 7, tension: isCategorical ? 0 : 0.45, stepped: isCategorical }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { ticks: { maxTicksLimit: 8 }, grid: { color: 'rgba(0,0,0,0.04)' } }, y: { grid: { color: 'rgba(0,0,0,0.04)' } } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', titleColor: '#0a0e17', bodyColor: '#0284c7', borderColor: '#e2e8f0', borderWidth: 1, cornerRadius: 14, padding: 12, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' } } }
    });
  } catch(e) { document.getElementById('hist-loading').innerHTML = '<div style="font-size:32px; margin-bottom:6px; color:#e11d48;">⚠️</div>Errore caricamento storico'; }
}

function apriDettagli(e, tipo) {
  if(e) e.stopPropagation(); if(e && navigator.vibrate) navigator.vibrate(10);
  currentPopupType = tipo;
  const list = document.getElementById('details-list'); const scrollTop = list.scrollTop;
  let html = ''; let items = [];
  const map = {'luci':'💡 LUCI ATTIVE', 'clima':'❄️ CLIMA ATTIVI', 'risc':'🔥 RISCALDAMENTO', 'win':'🚪 APERTURE', 'batt':'🔋 BATTERIE'};
  document.getElementById('details-title').innerHTML = map[tipo] || 'DETTAGLI';

  (GRUPPI_MONITORAGGIO[tipo] || []).forEach(id => {
    const sObj = STATES[id]; if(!sObj) return; const st = sObj.state; let nm = AVVISI_NAMES[id] || LUCI_NAMES[id] || sObj.attributes?.friendly_name || id;
    if(tipo === 'luci' && st === 'on') items.push({ id, nm, st: 'ON', icon: '💡', canOff: true });
    else if(tipo === 'clima' && !['off', 'unavailable', 'unknown'].includes(st)) items.push({ id, nm, st: st.toUpperCase(), icon: '❄️', canOff: true });
    else if(tipo === 'risc' && ['heat', 'heating', 'on'].includes(st)) items.push({ id, nm, st: 'ACCESO', icon: '🔥', canOff: true });
    else if(tipo === 'win' && st === 'on') {
      // v296: SOLO le aperture aperte (coerente col contatore)
      const winIcon = /porta/i.test(nm) ? '🚪' : '🪟';
      items.push({ id, nm, st: 'OPEN', icon: winIcon, canOff: false });
    }
    else if(tipo === 'batt') {
      // v296: SOLO le batterie scariche (≤20%)
      let v = parseFloat(st);
      if(!isNaN(v) && v <= 20) items.push({ id, nm, st: v + '%', icon: '🪫', canOff: false, ord: v });
    }
  });
  if (tipo === 'batt') items.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));

  if(items.length === 0) { html = '<div style="text-align:center; padding: 30px; color:var(--text-dim); font-weight:800; text-transform:uppercase; letter-spacing:1px; font-size:13px;">Nessun elemento attivo.</div>'; } 
  else { items.forEach(it => {
    if (it.hdr) { html += `<div style="font-size:11px; font-weight:900; letter-spacing:1.2px; color:var(--text-dim); padding:12px 4px 6px; text-transform:uppercase;">${it.hdr}</div>`; return; }
    const isClima = (tipo === 'clima' || tipo === 'risc');
    let btnHtml = '';
    if (isClima) {
      btnHtml = `<div class="d-btn-row">
        <button class="d-ctrl" title="Controlla" onclick="event.stopPropagation(); apriClimaFromModal('${it.id}');"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
        <button class="d-action" title="Spegni" onclick="spegniEntitaDettaglio('${it.id}');"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg></button>
      </div>`;
    } else if (it.canOff) {
      btnHtml = `<button class="d-action" title="Spegni" onclick="spegniEntitaDettaglio('${it.id}');"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg></button>`;
    }
    const modeIT = { 'COOL':'❄️ Raffresca', 'HEAT':'🔥 Riscalda', 'FAN_ONLY':'💨 Ventola',
                       'DRY':'💧 Deumidifica', 'AUTO':'⚙️ Auto', 'HEAT_COOL':'🔄 Auto' };
    const stateDisplay = modeIT[it.st] || it.st;
    const stStyle = it.ok === true ? 'opacity:0.55;' : (it.ok === false ? 'color:#dc2626; font-weight:900;' : '');
    html += `<div class="detail-row"><div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;overflow:hidden;"><div class="d-icon" style="flex-shrink:0;${it.icon === '💡' ? 'background:#fef08a;border-color:#fde047;' : it.icon === '❄️' ? 'background:#e0f2fe;' : it.icon === '🔥' ? 'background:#fff7ed;' : ''}">${it.icon}</div><div class="d-info" style="min-width:0;flex:1;overflow:hidden;"><div class="d-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;">${it.nm}</div><div class="d-state"><span style="${stStyle}">${stateDisplay}</span></div></div></div>${btnHtml}</div>`;
  }); }
  list.innerHTML = html; list.scrollTop = scrollTop; document.getElementById('details-modal').classList.add('show');
}

function spegniEntitaDettaglio(id) {
   if(!ws) return; if(navigator.vibrate) navigator.vibrate(10);
   ws.send(JSON.stringify({ id: msgId++, type: 'call_service', domain: id.split('.')[0], service: 'turn_off', service_data: { entity_id: id } }));
}

let currentPin = ''; let targetAlarmService = '';
function updatePinDisplay() { for(let i=1; i<=4; i++) { const dot = document.getElementById('dot-'+i); if(i <= Math.min(currentPin.length, 4)) dot.classList.add('filled'); else dot.classList.remove('filled'); } }
function kp(num) { if(navigator.vibrate) navigator.vibrate(15); if(currentPin.length < 8) { currentPin += num; updatePinDisplay(); } }
function kpDel() { if(navigator.vibrate) navigator.vibrate(10); if(currentPin.length > 0) { currentPin = currentPin.slice(0, -1); updatePinDisplay(); } }
function kpOk() { if(!ws) return; if(navigator.vibrate) navigator.vibrate([15, 30, 15]); callAlarmService(targetAlarmService, currentPin.length > 0 ? currentPin : ''); forceClose('custom-keypad'); }
/* Chiama la centrale, con il codice se il tastierino ne ha raccolto uno. */
function callAlarmService(service, code) {
    if(!ws) return;
    let data = { entity_id: (typeof resolveEntity === 'function' ? resolveEntity('dm.security_centrale_allarme') : 'dm.security_centrale_allarme') };
    if(code) data.code = code;
    ws.send(JSON.stringify({ id: msgId++, type: 'call_service', domain: 'alarm_control_panel', service: service, service_data: data }));
}
/* Il tastierino compare se la centrale un codice ce l'ha davvero.
 *
 * Chi non ne pubblica nessuno — Ring via ring-mqtt, per dirne una — lo
 * faceva comparire lo stesso: si premeva OK a vuoto e il comando partiva
 * uguale. Un lucchetto che si apre senza chiave non e' un lucchetto, e' un
 * passaggio in piu'. Chi il codice ce l'ha continua a vederselo chiedere.
 * La regola sta in core/alarm-panel.js: qui si domanda soltanto. */
function promptPinAndSet(service) {
    if(navigator.vibrate) navigator.vibrate(15);
    let serve = true;
    try { if (typeof dmAlarmCodeNeeded === 'function') serve = !!dmAlarmCodeNeeded(service); } catch(e) {}
    if (!serve) { callAlarmService(service); return; }
    currentPin = ''; targetAlarmService = service; updatePinDisplay();
    const labels = { 'alarm_arm_home': 'Arm Home', 'alarm_arm_away': 'Arm Away', 'alarm_arm_night': 'Arm Night', 'alarm_arm_vacation': 'Arm Vacation', 'alarm_arm_custom_bypass': 'Arm Partial', 'alarm_disarm': 'Disarm Alarm' };
    setTxt('keypad-action-name', labels[service] || 'Action');
    document.getElementById('custom-keypad').classList.add('show');
}

const errorImgSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225'><rect width='400' height='225' fill='%23f0f4f8'/><text x='50%' y='50%' fill='%23a1a1a1' font-family='sans-serif' font-weight='800' font-size='20' text-anchor='middle' dominant-baseline='middle'>NESSUN SEGNALE</text></svg>";

// Assicuriamoci di non duplicare i timer se ricarichiamo lo script
if(window.camInterval) clearInterval(window.camInterval);

function refreshCameras() {
    if (window._cdResetting) return;
  // Il setTimeout risolve il bug del click sul menu in basso
  setTimeout(() => {
    { const _sp = document.getElementById('page-security'); if (!_sp || !_sp.classList.contains('active')) return; }
    
    // Nomi Entità corretti e allineati con quelli funzionanti dei popup
    const camMappings = getCameras().map((cam, i) => ({ id: camSlug(cam, i), entity: cam.entity }));
    
    const ts = Date.now();
    
    camMappings.forEach(cam => {
      const state = STATES[cam.entity]; 
      const imgEl = document.getElementById(cam.id);
      if (!imgEl) return;

      if (state && state.attributes && state.attributes.entity_picture) { 
          let path = state.attributes.entity_picture; 
          let sep = path.includes('?') ? '&' : '?'; 
          let newSrc = HA_HTTP_URL + path + sep + 't=' + ts;
          
          // TRUCCO PRE-LOADER: Previene lo schermo grigio
          // Scarica l'immagine in background e la inserisce solo quando è pronta
          let tempImg = new Image();
          tempImg.onload = function() {
              imgEl.src = this.src; 
          };
          tempImg.onerror = function() {
              if (!imgEl.src.includes('data:image')) imgEl.src = errorImgSvg;
          };
          tempImg.src = newSrc;
          
      } else { 
          if (!imgEl.src.includes('data:image')) imgEl.src = errorImgSvg; 
      }
    });
  }, 50);
}

// Scendiamo a 4 secondi per un aggiornamento visivo più reattivo
window.camInterval = setInterval(refreshCameras, 4000);


const getPowerInWatts = (id) => { const s = STATES[id]; if (!s || s.state === undefined || s.state === 'unknown' || s.state === 'unavailable') return 0; let val = parseFloat(s.state) || 0; if (s.attributes && s.attributes.unit_of_measurement && s.attributes.unit_of_measurement.toLowerCase() === 'kw') { val *= 1000; } return val; };
const getRawState = (id) => { const s = STATES[id]; if (s && s.state !== undefined && s.state !== 'unknown' && s.state !== 'unavailable') { let val = s.state; let numVal = parseFloat(val); if (!isNaN(numVal) && val.toString().includes('.')) { return Number(numVal.toFixed(2)); } return val; } return '—'; };
const getDisplay = (id) => { const s = STATES[id]; if(s && s.state !== undefined && s.state !== 'unknown' && s.state !== 'unavailable') { const unit = (s.attributes && s.attributes.unit_of_measurement) ? s.attributes.unit_of_measurement : ''; let val = s.state; let numVal = parseFloat(val); if (!isNaN(numVal) && val.toString().includes('.')) { val = Number(numVal.toFixed(2)); } if(!unit && (id.includes('power') || id.includes('potenza'))) return val + ' W'; return val + (unit ? ' ' + unit : ''); } return '—'; };
function getTempColor(val) { if (val === '—') return '#cbd5e1'; let t = parseFloat(val); if (t >= 65) return '#e11d48'; if (t >= 50) return '#ea580c'; if (t >= 35) return '#f59e0b'; return '#0284c7'; }
const setLine = (id, active) => { const el = document.getElementById(id); if(el) el.classList.toggle('active', active); const elm = document.getElementById('m-' + id); if(elm) elm.classList.toggle('active', active); };
const setNode = (id, active) => { const el = document.getElementById(id); if(el) el.classList.toggle('active', active); };
const updateSelectOptions = (entityId, elementId) => { const s = STATES[entityId]; const el = document.getElementById(elementId); if(s && s.attributes && s.attributes.options && el) { if(el.children.length === 0 || el.dataset.populated !== "true") { el.innerHTML = ''; s.attributes.options.forEach(opt => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; el.appendChild(o); }); el.dataset.populated = "true"; } el.value = s.state; } };

function render() {
    if (window._cdResetting) return;
  if (Object.keys(STATES).length === 0) return;
  if (!render._perKick) { render._perKick = 1; setTimeout(() => { try { cdRefreshPeriodDeltas(true); } catch(e){} }, 1500); }
  try {
      // v244: aggiorna pillola "Caldaia accesa" sotto il meteo
      renderCaldaiaBanner();
      // v245: aggiorna pillola "Antifurto" sotto il meteo (visibile se ≠ disarmed)
      renderAllarmeBanner();
      // Temperature stanze
      if (document.getElementById('page-temp')?.classList.contains('active')) renderTemperature();
      // Aggiorna SOLO i testi KPI — grafico e lista si aggiornano solo all'apertura del tab
      const panoramicaView = document.getElementById('view-panoramica');
      if (panoramicaView && panoramicaView.classList.contains('active')) {
          edUpdateKpiOnly();
      }
      const weatherEnt = cdFirstMapped('dm.core_055', 'weather.home', 'dm.home_meteo');
      /* #205: la stazione meteo personale. Ogni sensore mappato (Ecowitt e
         simili) vince sull'attributo dell'entità weather; la direzione del
         vento in gradi diventa una rosa a 16 punte, un testo resta testo. */
      const cdMeteoStazione = (ref) => {
          const st = STATES[ref];
          if (!st || st.entity_id === 'dm.unmapped') return null;
          const v = parseFloat(st.state);
          if (!isFinite(v)) return null;
          return { v: Math.round(v * 10) / 10, unit: (st.attributes && st.attributes.unit_of_measurement) || '' };
      };
      const wsTemp = cdMeteoStazione('dm.home_meteo_temperatura');
      const wsHum = cdMeteoStazione('dm.home_meteo_umidita');
      const wsFeel = cdMeteoStazione('dm.home_meteo_percepita');
      const wsWind = cdMeteoStazione('dm.home_meteo_vento');
      let wsDir = '';
      (function(){
          const st = STATES['dm.home_meteo_vento_direzione'];
          if (!st || st.entity_id === 'dm.unmapped') return;
          const raw = String(st.state || '');
          if (!raw || raw === 'unknown' || raw === 'unavailable') return;
          const deg = parseFloat(raw);
          if (isFinite(deg)) {
              const rosa = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
              wsDir = rosa[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
          } else { wsDir = raw; }
      })();
      const wStation = !!(wsTemp || wsHum || wsFeel || wsWind || wsDir);
      /* v273: meteo non configurato → widget nascosto del tutto (nessun return: siamo dentro render)
         — ma la stazione personale basta da sola a farlo vivere (#205). */
      let wUnmapped = false;
      if (typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING) {
          wUnmapped = (!weatherEnt || weatherEnt.entity_id === 'dm.unmapped') && !wStation;
          const wWidget = document.querySelector('.weather-widget');
          if (wWidget) wWidget.style.display = wUnmapped ? 'none' : '';
      }
      const wFeelRow = document.getElementById('w-feel-row');
      if (wFeelRow) wFeelRow.style.display = wsFeel && !wUnmapped ? '' : 'none';
      if ((weatherEnt || wStation) && !wUnmapped) {
        const wAttr = (weatherEnt && weatherEnt.attributes) || {};
        setTxt('w-temp', wsTemp ? wsTemp.v + (wsTemp.unit || '°C') : (wAttr.temperature !== undefined ? wAttr.temperature : '--') + '°C');
        setTxt('w-hum', wsHum ? wsHum.v + (wsHum.unit || '%') : (wAttr.humidity !== undefined ? wAttr.humidity : '--') + '%');
        const windTxt = wsWind ? wsWind.v + ' ' + (wsWind.unit || 'km/h') : (wAttr.wind_speed !== undefined ? wAttr.wind_speed : '--') + ' km/h';
        setTxt('w-wind', wsDir ? windTxt + ' · ' + wsDir : windTxt);
        if (wsFeel) setTxt('w-feel', wsFeel.v + (wsFeel.unit || '°C'));
        if (!weatherEnt || weatherEnt.entity_id === 'dm.unmapped') setTxt('w-state', '');
      }
      if(weatherEnt && !wUnmapped) {
        const wLangMap = { 'clear-night': 'Sereno (Notte)', 'cloudy': 'Nuvoloso', 'fog': 'Nebbia', 'hail': 'Grandine', 'lightning': 'Fulmini', 'lightning-rainy': 'Temporale', 'partlycloudy': 'Poco Nuvoloso', 'pouring': 'Acquazzone', 'rainy': 'Pioggia', 'snowy': 'Neve', 'snowy-rainy': 'Nevischio', 'sunny': 'Soleggiato', 'windy': 'Ventoso', 'windy-variant': 'Vento Forte' };
        setTxt('w-state', wLangMap[weatherEnt.state] || weatherEnt.state.replace('-', ' '));
        const wMap = { 'clear-night': '🌙', 'cloudy': '☁️', 'fog': '<div class=\"w-fog-anim\"><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div></div>', 'hail': '<div class=\"w-fog-anim\"><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div><div class=\"fog-line\"></div></div>', 'lightning': '⛈️', 'lightning-rainy': '⛈️', 'partlycloudy': '⛅', 'pouring': '🌧️', 'rainy': '🌧️', 'snowy': '❄️', 'snowy-rainy': '🌨️', 'sunny': '☀️', 'windy': '💨', 'windy-variant': '💨' };
        setHtml('w-icon', wMap[weatherEnt.state] || '☀️');
      }

      const updateGlance = (id, sensor) => { let val = parseInt(getRawState(sensor)) || 0; let el = document.getElementById(id); if(el) { el.style.display = val > 0 ? 'flex' : 'none'; const valEl = document.getElementById(id.replace('glance-', 'g-val-')); if(valEl) valEl.textContent = val; } };
      /* v273 (coerenza definitiva): i contatori del Quadro Avvisi sono calcolati dagli
         STESSI gruppi che alimentano i popup — numero e lista combaciano sempre. */
      const cdCount = (grp, pred) => (GRUPPI_MONITORAGGIO[grp] || []).reduce((n, id) => {
          const s = STATES[id]; return n + (s && pred(s) ? 1 : 0);
      }, 0);
      const setGlance = (key, v) => {
          const card = document.getElementById('glance-' + key);
          const val = document.getElementById('g-val-' + key);
          if (val) val.textContent = v;
          if (card) card.style.display = v > 0 ? 'flex' : 'none';
      };
      try { cdLightList(); } catch(e) {}
      try { renderAppliances(); renderApplianceSection(); } catch(e) {}
      setGlance('luci',  cdCount('luci',  s => s.state === 'on'));
      setGlance('clima', cdCount('clima', s => !['off','unavailable','unknown'].includes(s.state)));
      setGlance('risc',  cdCount('risc',  s => ['heat','heating','on'].includes(s.state)));
      setGlance('win',   cdCount('win',   s => s.state === 'on'));
      setGlance('batt',  cdCount('batt',  s => { const v = parseFloat(s.state); return !isNaN(v) && v <= 20; }));
      try { cdRenderCustomAvvisi(); } catch(e) {}
      
      // ── Card Antifurto: stile coerente con altre card Quadro Avvisi ──
      // Logica: dm.home_interruttore_antifurto = ON → priorità ALLARME SCATTATO (rosso, urgente)
      //         altrimenti dm.security_centrale_allarme → modalità (NOTTE/CASA/TOTALE)
      (function() {
        const alarmTriggered = (getRawState('dm.home_interruttore_antifurto') || '').toLowerCase() === 'on';
        const alarmHomeState = getRawState('dm.security_centrale_allarme');
        const alarmStateObj  = STATES['dm.security_centrale_allarme'];
        const triggerObj     = STATES['dm.home_interruttore_antifurto'];
        
        const glanceAlarm    = document.getElementById('glance-alarm');
        const gValAlarm      = document.getElementById('g-val-alarm');
        const gNameAlarm     = document.getElementById('g-name-alarm');
        const gIconAlarm     = document.getElementById('g-icon-alarm');
        const gTimeAlarm     = document.getElementById('g-time-alarm');
        if (!glanceAlarm || !gValAlarm) return;
        
        // Reset stili eventualmente impostati in precedenza
        glanceAlarm.style.animation = '';
        glanceAlarm.style.border    = '';
        
        let show = false, modeText = '', name = 'Antifurto', rgb = '124,58,237', icon = '🛡️';
        let sourceObj = alarmStateObj;
        
        // PRIORITÀ 1: allarme scattato (switch acceso)
        if (alarmTriggered) {
          show = true; modeText = 'ALLARME'; rgb = '220,38,38'; icon = '🚨'; name = 'ALLARME!';
          sourceObj = triggerObj || alarmStateObj;
          // Stile critico: lampeggio + bordo rosso solo in stato urgente
          glanceAlarm.style.animation = 'alarmTriggeredPulse 0.7s ease-in-out infinite';
          glanceAlarm.style.border    = '2px solid rgba(220,38,38,0.7)';
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        }
        // PRIORITÀ 2: modalità armata normale (stile soft come altre card)
        else if (alarmHomeState === 'armed_away') {
          show = true; modeText = 'TOTALE';    rgb = '225,29,72';  icon = '🛡️'; name = 'Antifurto';
        } else if (alarmHomeState === 'armed_night') {
          show = true; modeText = 'NOTTE';     rgb = '124,58,237'; icon = '🌙'; name = 'Antifurto';
        } else if (alarmHomeState === 'armed_home') {
          show = true; modeText = 'CASA';      rgb = '6,182,212';  icon = '🏡'; name = 'Antifurto';
        } else if (alarmHomeState === 'pending' || alarmHomeState === 'arming') {
          show = true; modeText = 'IN USCITA'; rgb = '245,158,11'; icon = '⏳'; name = 'Antifurto';
        }
        
        glanceAlarm.style.display = show ? 'flex' : 'none';
        if (show) {
          gValAlarm.textContent  = modeText;
          gNameAlarm.textContent = name;
          glanceAlarm.style.setProperty('--g-rgb', rgb);
          gValAlarm.style.color  = `rgb(${rgb})`;
          if (gIconAlarm) gIconAlarm.textContent = icon;
          
          // Timer "da X minuti" sotto la modalità
          if (gTimeAlarm && sourceObj && sourceObj.last_changed) {
            const since = new Date(sourceObj.last_changed).getTime();
            const elapsed = Math.max(0, Date.now() - since);
            const mins  = Math.floor(elapsed / 60000);
            const hours = Math.floor(mins / 60);
            const days  = Math.floor(hours / 24);
            let label;
            if (days > 0)       label = `Da ${days}g ${hours % 24}h`;
            else if (hours > 0) label = `Da ${hours}h ${mins % 60}m`;
            else if (mins > 0)  label = `Da ${mins} min`;
            else                label = 'Ora';
            gTimeAlarm.textContent = label;
          } else if (gTimeAlarm) {
            gTimeAlarm.textContent = '';
          }
        }
      })();

      /* v290: nodi subload — nascosti se l'entità non è configurata, attenuati se a riposo */
      const _fn0 = cdCfg('cd_flow_nodes') || {};
      cdApplyFlowNodeLite('n-boiler', _fn0.boiler, '🌞', 'Boiler');
      cdApplyFlowNodeLite('n-wb', _fn0.wb, '🚗', 'Wallbox');
      cdApplyFlowNodeLite('n-clima', _fn0.clima, '❄️', 'Clima');
      const _nBoiler = cdUpdateLoadNode('n-boiler', 'line-home-boiler', 'v-boiler-p', 'boiler', 'dm.boiler_potenza_resistenza_boiler');
      const _nWb = cdUpdateLoadNode('n-wb', 'line-home-wb', 'v-wb-p', 'wb', 'dm.ev_potenza_wallbox');
      const _nClima = cdUpdateLoadNode('n-clima', 'line-home-clima', 'v-clima-p', 'clima', 'dm.energy_potenza_condizionatori');
      /* v296: i due nodi sotto la casa sono personalizzabili (nome, icona, gruppo, sensore) */
      const _fn = cdCfg('cd_flow_nodes') || {};
      cdApplyFlowNode('n-lav', _fn.lav, 'lavanderia', '🧺', 'Lavanderia');
      cdApplyFlowNode('n-cuc', _fn.cuc, 'cucina', '🍳', 'Cucina');
      const _nLav = cdUpdateLoadNode('n-lav', 'line-home-lav', 'v-lav-p', 'lav', 'dm.energy_potenza_carichi_nodo_1_lavanderia');
      const _nCuc = cdUpdateLoadNode('n-cuc', 'line-home-cuc', 'v-cuc-p', 'cuc', 'dm.energy_potenza_carichi_nodo_2_cucina');
      /* v293: contatore attivi sulle card dei gruppi carico personalizzati */
      (cdCfgList('cd_subload_groups')).forEach(g => {
          const el = document.getElementById('cl-count-' + g.id);
          if (!el) return;
          const items = (SUBLOADS_CONFIG[g.id] && SUBLOADS_CONFIG[g.id].items) || [];
          let on = 0;
          items.forEach(it => {
              const w = parseFloat(STATES[it.pwrLive || it.pwr]?.state);
              const b = STATES[it.bin]?.state;
              if (b === 'on' || (!isNaN(w) && w > 5)) on++;
          });
          el.textContent = items.length ? (on + ' active / ' + items.length) : 'empty — add loads';
      });
      setTxt('v-solar', getDisplay('dm.energy_potenza_fotovoltaico')); setTxt('v-grid', getDisplay('dm.energy_potenza_scambio_rete')); setTxt('v-battery', getDisplay('dm.energy_potenza_batteria')); setTxt('v-battery-soc', getDisplay('dm.energy_stato_carica_batteria')); setTxt('v-home', getDisplay('dm.energy_potenza_consumo_casa')); 
      const pwrSol = getPowerInWatts('dm.energy_potenza_fotovoltaico'); const pwrGri = getPowerInWatts('dm.energy_potenza_scambio_rete'); const pwrBat = getPowerInWatts('dm.energy_potenza_batteria'); const pwrWb = _nWb.w; const pwrBoiler = _nBoiler.w; const pwrClima = _nClima.w; const pwrLav = _nLav.w; const pwrCuc = _nCuc.w;
      setNode('n-solar', pwrSol > 20); setNode('n-grid', Math.abs(pwrGri) > 20); setNode('n-battery', Math.abs(pwrBat) > 20); setNode('n-home', true); setNode('n-wb', pwrWb > 5); setNode('n-boiler', pwrBoiler > 5); setNode('n-clima', pwrClima > 5); setNode('n-lav', pwrLav > 5); setNode('n-cuc', pwrCuc > 5);
      setLine('line-solar-home', pwrSol > 20); setLine('line-grid-home', pwrGri > 20); setLine('line-solar-grid', pwrGri < -20); setLine('line-battery-home', pwrBat > 20); setLine('line-solar-battery', pwrBat < -20); setLine('line-home-wb', pwrWb > 5); setLine('line-home-boiler', pwrBoiler > 5); setLine('line-home-clima', pwrClima > 5); setLine('line-home-lav', pwrLav > 5); setLine('line-home-cuc', pwrCuc > 5);

      const dSol = cdPNum('dm.energy_produzione_solare_oggi'); const dHome = cdPNum('dm.energy_consumo_casa_oggi'); const dBoiler = cdPNum('dm.energy_boiler_oggi'); const dWb = cdPNum('dm.ev_energia_wallbox_oggi'); const dClima = cdPNum('dm.energy_condizionatori_oggi'); const dLav = cdPNum('dm.energy_somma_lavanderia_oggi'); const dCuc = cdPNum('dm.energy_somma_cucina_oggi'); const dGridB = cdPRaw('dm.energy_energia_prelevata_oggi'); const dGridS = cdPRaw('dm.energy_energia_immessa_oggi'); const dBatC = cdPRaw('dm.energy_batteria_caricata_oggi'); const dBatD = cdPRaw('dm.energy_batteria_scaricata_oggi');
      setTxt('v-solar-day', cdPVal('dm.energy_produzione_solare_oggi')); setTxt('v-home-day', cdPVal('dm.energy_consumo_casa_oggi')); setTxt('v-boiler-day', cdPVal('dm.energy_boiler_oggi')); setTxt('v-wb-day', cdPVal('dm.ev_energia_wallbox_oggi')); setTxt('v-clima-day', cdPVal('dm.energy_condizionatori_oggi')); setTxt('v-lav-day', cdPVal('dm.energy_somma_lavanderia_oggi')); setTxt('v-cuc-day', cdPVal('dm.energy_somma_cucina_oggi')); setHtml('v-grid-day', `<span style="color:#e11d48">↓ ${dGridB !== '—' ? dGridB : 0} kWh</span><br><span style="color:#10b981">↑ ${dGridS !== '—' ? dGridS : 0} kWh</span>`); setHtml('v-battery-day', `<span style="color:#10b981">↓ ${dBatC !== '—' ? dBatC : 0} kWh</span><br><span style="color:#e11d48">↑ ${dBatD !== '—' ? dBatD : 0} kWh</span>`);
      /* v0.8.4 (#6): HOME as in HA's Energy dashboard — balance of the displayed flows:
         solar − exported + imported + battery discharged − battery charged. The map now
         always adds up; the mapped entity remains the fallback when pieces are missing. */
      try {
          const _n = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
          const _gb = _n(dGridB), _gs = _n(dGridS), _bc = _n(dBatC), _bd = _n(dBatD);
          if (dSol > 0 || _gb !== null) {
              const bal = dSol - (_gs || 0) + (_gb || 0) + (_bd || 0) - (_bc || 0);
              if (bal >= 0) setTxt('v-home-day', (bal >= 100 ? bal.toFixed(1) : bal.toFixed(2)) + ' kWh');
          }
      } catch(e) {}
      setNode('n-solar-day', dSol > 0.1); setNode('n-grid-day', parseFloat(dGridB) > 0.1 || parseFloat(dGridS) > 0.1); setNode('n-battery-day', parseFloat(dBatC) > 0.1 || parseFloat(dBatD) > 0.1); setNode('n-home-day', true); setNode('n-wb-day', dWb > 0.1); setNode('n-boiler-day', dBoiler > 0.1); setNode('n-clima-day', dClima > 0.1); setNode('n-lav-day', dLav > 0.1); setNode('n-cuc-day', dCuc > 0.1); setLine('line-solar-home-day', dSol > 0.1); setLine('line-grid-home-day', parseFloat(dGridB) > 0.1); setLine('line-solar-grid-day', parseFloat(dGridS) > 0.1); setLine('line-battery-home-day', parseFloat(dBatD) > 0.1); setLine('line-solar-battery-day', parseFloat(dBatC) > 0.1); setLine('line-home-wb-day', dWb > 0.1); setLine('line-home-boiler-day', dBoiler > 0.1); setLine('line-home-clima-day', dClima > 0.1); setLine('line-home-lav-day', dLav > 0.1); setLine('line-home-cuc-day', dCuc > 0.1);

      const mSol = cdPNum('dm.energy_produzione_solare_mese'); const mHome = cdPNum('dm.energy_consumo_casa_mese'); const mBoiler = cdPNum('dm.energy_boiler_mese'); const mWb = cdPNum('dm.ev_energia_wallbox_mese'); const mClima = cdPNum('dm.energy_condizionatori_mese'); const mLav = cdPNum('dm.energy_somma_lavanderia_mese'); const mCuc = cdPNum('dm.energy_somma_cucina_mese'); const mGridB = cdPRaw('dm.energy_rete_acquistata_mese'); const mGridS = cdPRaw('dm.energy_rete_venduta_mese'); const mBatC = cdPRaw('dm.energy_batteria_caricata_mese'); const mBatD = cdPRaw('dm.energy_batteria_usata_mese');
      setTxt('v-solar-month', cdPVal('dm.energy_produzione_solare_mese')); setTxt('v-home-month', cdPVal('dm.energy_consumo_casa_mese')); setTxt('v-boiler-month', cdPVal('dm.energy_boiler_mese')); setTxt('v-wb-month', cdPVal('dm.ev_energia_wallbox_mese')); setTxt('v-clima-month', cdPVal('dm.energy_condizionatori_mese')); setTxt('v-lav-month', cdPVal('dm.energy_somma_lavanderia_mese')); setTxt('v-cuc-month', cdPVal('dm.energy_somma_cucina_mese')); setHtml('v-grid-month', `<span style="color:#e11d48">↓ ${mGridB !== '—' ? mGridB : 0} kWh</span><br><span style="color:#10b981">↑ ${mGridS !== '—' ? mGridS : 0} kWh</span>`); setHtml('v-battery-month', `<span style="color:#10b981">↓ ${mBatC !== '—' ? mBatC : 0} kWh</span><br><span style="color:#e11d48">↑ ${mBatD !== '—' ? mBatD : 0} kWh</span>`);
      /* v0.8.4 (#6): HOME as in HA's Energy dashboard — balance of the displayed flows:
         solar − exported + imported + battery discharged − battery charged. The map now
         always adds up; the mapped entity remains the fallback when pieces are missing. */
      try {
          const _n = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
          const _gb = _n(mGridB), _gs = _n(mGridS), _bc = _n(mBatC), _bd = _n(mBatD);
          if (mSol > 0 || _gb !== null) {
              const bal = mSol - (_gs || 0) + (_gb || 0) + (_bd || 0) - (_bc || 0);
              if (bal >= 0) setTxt('v-home-month', (bal >= 100 ? bal.toFixed(1) : bal.toFixed(2)) + ' kWh');
          }
      } catch(e) {}
      setNode('n-solar-month', mSol > 0.1); setNode('n-grid-month', parseFloat(mGridB) > 0.1 || parseFloat(mGridS) > 0.1); setNode('n-battery-month', parseFloat(mBatC) > 0.1 || parseFloat(mBatD) > 0.1); setNode('n-home-month', true); setNode('n-wb-month', mWb > 0.1); setNode('n-boiler-month', mBoiler > 0.1); setNode('n-clima-month', mClima > 0.1); setNode('n-lav-month', mLav > 0.1); setNode('n-cuc-month', mCuc > 0.1); setLine('line-solar-home-month', mSol > 0.1); setLine('line-grid-home-month', parseFloat(mGridB) > 0.1); setLine('line-solar-grid-month', parseFloat(mGridS) > 0.1); setLine('line-battery-home-month', parseFloat(mBatD) > 0.1); setLine('line-solar-battery-month', parseFloat(mBatC) > 0.1); setLine('line-home-wb-month', mWb > 0.1); setLine('line-home-boiler-month', mBoiler > 0.1); setLine('line-home-clima-month', mClima > 0.1); setLine('line-home-lav-month', mLav > 0.1); setLine('line-home-cuc-month', mCuc > 0.1);
      try {
          const _lm = (inst, dRef, mRef) => inst || cdRefMapped(dRef) || cdRefMapped(mRef) || cdPNum(dRef) > 0.001 || cdPNum(mRef) > 0.001;
          cdSetPeriodLoad('boiler', _lm(_nBoiler.mapped, 'dm.energy_boiler_oggi', 'dm.energy_boiler_mese'));
          cdSetPeriodLoad('wb',     _lm(_nWb.mapped, 'dm.ev_energia_wallbox_oggi', 'dm.ev_energia_wallbox_mese'));
          cdSetPeriodLoad('clima',  _lm(_nClima.mapped, 'dm.energy_condizionatori_oggi', 'dm.energy_condizionatori_mese'));
          cdSetPeriodLoad('lav',    _lm(_nLav.mapped, 'dm.energy_somma_lavanderia_oggi', 'dm.energy_somma_lavanderia_mese'));
          cdSetPeriodLoad('cuc',    _lm(_nCuc.mapped, 'dm.energy_somma_cucina_oggi', 'dm.energy_somma_cucina_mese'));
      } catch(e) {}
      const statiEV = {'A':'Non Connessa','B':'🔌 Collegata','C':'⚡ In Carica','D':'⚡ In Carica','F':'⚠️ Errore'}; 
      const codeEV = getRawState('dm.ev_stato_ricarica'); 
      const socCarNum = parseFloat(getRawState('dm.ev_batteria_auto')) || 0; 
      const isCharging = (codeEV === 'C' || codeEV === 'D');
      // ── EV valori dettaglio wallbox ──────────────────────
      const voltRaw   = getRawState('dm.ev_tensione_wallbox');
      const kmRicRaw  = getRawState('dm.ev_km_dall_ultima_ricarica');
      const odoRaw    = getRawState('dm.ev_odometro');
      const acTotRaw  = getRawState('dm.ev_prelievo_ac_totale_auto');
      const tempWbRaw = getRawState('dm.ev_temperatura_wallbox');
      document.querySelectorAll('.v-ev-volt').forEach(el => el.textContent = voltRaw !== '—' ? parseFloat(voltRaw).toFixed(1)+' V' : '—');
      document.querySelectorAll('.v-ev-km-ric').forEach(el => el.textContent = kmRicRaw !== '—' ? kmRicRaw+' km' : '—');
      document.querySelectorAll('.v-ev-odo').forEach(el => el.textContent = odoRaw !== '—' ? parseFloat(odoRaw).toFixed(0)+' km' : '—');
      document.querySelectorAll('.v-ev-ac-tot').forEach(el => el.textContent = acTotRaw !== '—' ? parseFloat(acTotRaw).toFixed(2)+' kWh' : '—');
      document.querySelectorAll('.v-ev-temp-wb').forEach(el => el.textContent = tempWbRaw !== '—' ? parseFloat(tempWbRaw).toFixed(1)+' °C' : '—');
      const autoLimKm = dmEvKmAlTarget();
      document.querySelectorAll('.v-auto-limite').forEach(el => el.textContent = autoLimKm != null ? autoLimKm+' km' : '—');
      // Modo EVCC
      const evccModeRaw = getRawState('dm.ev_modalita_ricarica_evcc');
      document.querySelectorAll('.lm-evcc-btn').forEach(b => b.classList.remove('active'));
      const modeMap2 = { 'off':'m-btn-off','pv':'m-btn-pv','minpv':'m-btn-minpv','now':'m-btn-now' };
      const activeM = modeMap2[evccModeRaw?.toLowerCase()];
      if (activeM) { const el = document.getElementById(activeM); if(el) el.classList.add('active'); }
      // Target SoC select
      const tSocSel = document.getElementById('sel-target-soc');
      const tSocVal = getRawState('dm.ev_target_soc');
      if (tSocSel && tSocSel.options.length === 0) {
          const opts = STATES['dm.ev_target_soc']?.attributes?.options || ['60','70','80','90','100'];
          opts.forEach(o => { const opt = document.createElement('option'); opt.value=o; opt.textContent=o+'%'; tSocSel.appendChild(opt); });
      }
      if (tSocSel && tSocVal !== '—') tSocSel.value = tSocVal; 
      const energyKwhRaw = getRawState('dm.ev_energia_sessione');
      const solarMixRaw = getRawState('dm.ev_percentuale_solare_sessione'); 
      
      document.querySelectorAll('.v-ev-solar-mix').forEach(el => {
          el.textContent = solarMixRaw !== '—' ? Math.round(parseFloat(solarMixRaw)) + '%' : '—';
      });
      
      const mixBar = document.getElementById('ev-mix-bar');
      if (mixBar && solarMixRaw !== '—') {
          let mixValue = parseFloat(solarMixRaw);
          mixBar.style.width = mixValue + '%';
          mixBar.style.background = mixValue > 50 ? '#10b981' : '#f59e0b'; 
      }
      
      document.querySelectorAll('.v-ev-stato-all').forEach(el => el.textContent = statiEV[codeEV] || codeEV || '—');
      // Badge stato unificato
      const badgeTxtEl = document.getElementById('lm-stato-txt');
      const badgeDotEl = document.getElementById('lm-dot');
      const badgeBox   = document.getElementById('lm-charge-badge');
      if (badgeTxtEl) badgeTxtEl.textContent = statiEV[codeEV] || codeEV || '—';
      // Colori badge per stato: A=grigio, B=arancio (collegata), C/D=ciano (in carica), F=rosso
      const bdCol = isCharging ? '#06b6d4' : codeEV==='B' ? '#f59e0b' : codeEV==='A' ? '#94a3b8' : codeEV==='F' ? '#ef4444' : '#10b981';
      const bdBg  = isCharging ? 'rgba(6,182,212,0.25)' : codeEV==='B' ? 'rgba(245,158,11,0.25)' : 'rgba(0,0,0,0.4)';
      if (badgeDotEl) badgeDotEl.style.background = bdCol;
      if (badgeBox) { badgeBox.style.background = bdBg; badgeBox.style.borderColor = bdCol+'66'; } 
      document.querySelectorAll('.v-ev-energy-all').forEach(el => el.textContent = energyKwhRaw !== '—' ? energyKwhRaw + ' kWh' : '—'); 
      document.querySelectorAll('.v-ev-soc-txt').forEach(el => el.textContent = socCarNum + '%');
      
      const imgContainer = document.getElementById('ev-img-container'); if(imgContainer) imgContainer.classList.toggle('is-charging', isCharging);
      const battFill = document.getElementById('ev-mod-batt-fill');
      if(battFill) {
          battFill.style.width = socCarNum + '%';
          // v254: colore basato sul livello SOC (rosso < 20%, arancio < 40%, verde >= 40%)
          // Solo quando in carica attiva si usa azzurro per indicarla
          let battCol = '#10b981';        // verde default (>= 40%)
          if (isCharging)              battCol = '#06b6d4';   // azzurro charging attivo
          else if (socCarNum < 20)     battCol = '#ef4444';   // rosso basso
          else if (socCarNum < 40)     battCol = '#f59e0b';   // arancio medio
          battFill.style.setProperty('--batt-col', battCol);
          battFill.className = 'lm-batt-fill' + (socCarNum < 20 ? ' low' : socCarNum < 40 ? ' mid' : '');
      }
      // Cerchio SVG batteria nel popup
      const battSvg = document.getElementById('ev-mod-batt-fill-popup-svg');
      if(battSvg) {
          battSvg.style.width = socCarNum.toFixed(1) + '%';
          battSvg.style.background = socCarNum > 70 ? '#0ea5e9' : socCarNum > 30 ? '#f59e0b' : '#ef4444';
      }
      // Testo % nel popup
      document.querySelectorAll('.v-ev-soc-txt').forEach(el => el.textContent = socCarNum + '%');
      // Dot stato hero
      const lmDot = document.getElementById('lm-dot');
      if (lmDot) {
          const isCharg = ['charging','charging_solar','charging_min_pv'].some(s => (codeEV||'').includes(s));
          lmDot.className = 'lm-status-dot' + (isCharg ? ' charging' : '');
      }
      // Barra solare nelle card sessione
      document.querySelectorAll('.v-ev-solar-fill').forEach(el => {
          el.style.width = (parseFloat(solarMixRaw) || 0) + '%';
      }); 
      
      const battFillSvg = document.getElementById('ev-mod-batt-fill-popup-svg');
      if(battFillSvg) battFillSvg.style.width = socCarNum + '%';

      const evPopupBadge = document.getElementById('ev-popup-badge');
      if(evPopupBadge) {
          if (codeEV === 'C' || codeEV === 'D') {
              evPopupBadge.innerHTML = '⚡ IN CARICA';
              evPopupBadge.style.background = '#fef3c7';
              evPopupBadge.style.color = '#d97706';
              evPopupBadge.style.borderColor = '#fde68a';
          } else if (codeEV === 'B') {
              evPopupBadge.innerHTML = '🔵 COLLEGATA (IN ATTESA)';
              evPopupBadge.style.background = '#e0f2fe';
              evPopupBadge.style.color = '#0284c7';
              evPopupBadge.style.borderColor = '#bae6fd';
          } else if (codeEV === 'F') {
              evPopupBadge.innerHTML = '🔴 ERRORE';
              evPopupBadge.style.background = '#ffe4e6';
              evPopupBadge.style.color = '#e11d48';
              evPopupBadge.style.borderColor = '#fecaca';
          } else {
              evPopupBadge.innerHTML = '⚪ SCOLLEGATA';
              evPopupBadge.style.background = '#f1f5f9';
              evPopupBadge.style.color = '#64748b';
              evPopupBadge.style.borderColor = '#e2e8f0';
          }
      }
      
      let targetSocStr = getRawState('dm.ev_target_soc');
      let targetSoc = parseInt(targetSocStr);
      if (isNaN(targetSoc)) targetSoc = 100;
      
      let lblRemainPop = document.getElementById('lbl-ev-remain-popup');
      if(lblRemainPop) lblRemainPop.innerHTML = `⏱️ TEMPO AL ${targetSoc}%`;

      let remainText = "IN ATTESA"; 
      if (socCarNum >= targetSoc) {
          remainText = "TARGET RAGGIUNTO";
      } else if (isCharging && pwrWb > 0) { 
          let kw = (pwrWb > 100) ? pwrWb/1000 : pwrWb; 
          let energyNeeded = (targetSoc - socCarNum) * 70 / 100; 
          let hours = energyNeeded / kw; 
          let h = Math.floor(hours); 
          let m = Math.floor((hours - h) * 60); 
          remainText = `${h}H ${m}M RIM.`; 
      } else if (socCarNum === 100) { 
          remainText = "CARICA COMPLETA"; 
      }
      
      document.querySelectorAll('.v-ev-remain').forEach(el => el.textContent = remainText); 
      const remainPop = document.getElementById('v-ev-remain-popup'); 
      if (remainPop) remainPop.textContent = remainText;

      const heroCard = document.getElementById('lm-hero-card');
      const carImg  = document.getElementById('ev-mod-car-img');
      const canvas  = document.getElementById('lm-charge-canvas');
      const isChargingEV = ['B','C','D'].includes(codeEV);
      if (heroCard) heroCard.classList.toggle('lm-charging', isChargingEV);
      // Cambia foto idle ↔ plugged
      if (carImg) {
          if (CD_EV_IMAGE) {
              const custPart = CD_EV_IMAGE.split('/').pop();
              if (!carImg.src.endsWith(custPart)) { carImg.style.opacity = '1'; carImg.src = CD_EV_IMAGE; }
          } else if (!carImg.dataset.evFailed) {
              // v0.10.7: se le immagini di default /local/ev/*.png non esistono, dopo il primo 404
              // l'onerror marca evFailed e non riproviamo più (niente spam di 404 in console)
              const newSrc = isChargingEV ? '/local/ev/plugged_black.png' : '/local/ev/idle.png';
              if (carImg.src !== newSrc && !carImg.src.endsWith(newSrc.split('/').pop())) {
                  carImg.style.opacity = '0';
                  setTimeout(() => { if (!carImg.dataset.evFailed) { carImg.src = newSrc; carImg.style.opacity = '1'; } }, 400);
              }
          }
      }
      // Canvas particelle
      if (canvas) {
          if (isChargingEV && !canvas._animRunning) {
              canvas._animRunning = true;
              lmStartParticles(canvas);
          } else if (!isChargingEV) {
              canvas._animRunning = false;
          }
      }
      let stateColor = '#5c6c81'; let stateRgb = '92,108,129'; if (codeEV === 'B') { stateColor = '#f59e0b'; stateRgb = '245,158,11'; } if (isCharging) { stateColor = '#06b6d4'; stateRgb = '6,182,212'; } if (codeEV === 'F') { stateColor = '#e11d48'; stateRgb = '225,29,72'; }
      const rootMod = document.getElementById('ev-mod-root'); if(rootMod) rootMod.style.setProperty('--state-color', stateColor);
      
      
      // ── MiniPC barre CPU/RAM/Disco colorate ──
      // ── MiniPC: tutte le variabili PRIMA di usarle ──────────
      const cpuVal  = parseFloat(getRawState('dm.server_cpu'))  || 0;
      const ramVal  = parseFloat(getRawState('dm.server_ram')) || 0;
      const ramS    = STATES['dm.server_ram'];
      const ramTot  = parseFloat(ramS?.attributes?.total) || 0;
      const diskVal = parseFloat(getRawState('dm.server_disco')) || 0;
      const tempVal = parseFloat(getRawState('dm.server_temperatura_cpu')) || 0;
      /* v0.8.1: DYNAMIC RAM — % sensors show %, value sensors (MB/GB) show the value
         with their unit; with a total attribute the % is computed. */
      const ramUnit = ((ramS && ramS.attributes && ramS.attributes.unit_of_measurement) || '').trim();
      let ramPct = 0, ramText = '—', ramUnitTxt = '%';
      if (ramVal > 0) {
          if (ramUnit === '%' || (ramTot === 0 && !ramUnit && ramVal <= 100)) { ramPct = Math.min(100, ramVal); ramText = ramVal.toFixed(0); }
          else if (ramTot > 0) { ramPct = Math.min(100, (ramVal / ramTot) * 100); ramText = ramPct.toFixed(0); }
          else if (/mb|mib/i.test(ramUnit) || (!ramUnit && ramVal > 1024)) { ramText = (ramVal / 1024).toFixed(1); ramUnitTxt = 'GB'; }
          else { ramText = ramVal >= 100 ? ramVal.toFixed(0) : ramVal.toFixed(1); ramUnitTxt = ramUnit || ''; }
      }
      window._cdRamPct = ramPct;

      // Valori testuali nei ring
      const cpuEl  = document.getElementById('v-srv-cpu');
      const ramEl  = document.getElementById('v-srv-ram');
      const diskEl = document.getElementById('v-srv-disk');
      if (cpuEl)  cpuEl.textContent  = cpuVal  > 0 ? cpuVal.toFixed(1)  : getDisplay('dm.server_cpu').replace('%','').trim() || '—';
      if (ramEl) { ramEl.textContent = ramText; const _u = document.getElementById('u-srv-ram'); if (_u) _u.textContent = ramUnitTxt; }
      if (diskEl) diskEl.textContent = diskVal > 0 ? diskVal.toFixed(0) : getDisplay('dm.server_disco').replace('%','').trim() || '—';

      // Ring animati SVG  — circonferenza r=42: 2π×42 ≈ 264
      const circ264 = 2 * Math.PI * 42;
      const setRing = (id, pct, col) => {
          const ring = document.getElementById(id);
          if (!ring) return;
          const p    = Math.min(100, Math.max(0, pct));
          const dash = (p / 100) * circ264;
          ring.setAttribute('stroke-dasharray', dash.toFixed(1) + ' ' + circ264.toFixed(1));
          ring.setAttribute('stroke', p > 85 ? '#ef4444' : p > 65 ? '#f59e0b' : col);
          const card = ring.closest('.srv-ring-card');
          if (card) {
              card.classList.toggle('warn', p > 80);
              card.classList.add('loaded');
              card.style.setProperty('--ring-pct', (p / 100).toFixed(3));
          }
      };
      setRing('srv-cpu-ring',  cpuVal,  '#06b6d4');
      setRing('srv-ram-ring',  ramPct,  '#7c3aed');
      setRing('srv-disk-ring', diskVal, '#10b981');



      // Ring temperatura
      if (tempVal > 0) {
          const tempPct = Math.min(100, (tempVal - 20) / 80 * 100);
          const circ    = 2 * Math.PI * 36; // ~226
          const dash    = (tempPct / 100) * circ;
          const ring    = document.getElementById('srv-temp-circle');
          if (ring) {
              ring.setAttribute('stroke-dasharray', dash.toFixed(1) + ' ' + circ.toFixed(1));
              ring.setAttribute('stroke', tempVal > 75 ? '#ef4444' : tempVal > 55 ? '#f59e0b' : '#7c3aed');
          }
          const stEl = document.getElementById('v-srv-temp-status');
          if (stEl) stEl.textContent = tempVal > 75 ? '🔴 Alta — Controllare' : tempVal > 55 ? '🟡 Nella norma' : '🟢 Ottimale';
      }

      document.querySelectorAll('.v-ev-pow').forEach(el => el.textContent = getDisplay('dm.ev_potenza_wallbox')); document.querySelectorAll('.v-ev-volt').forEach(el => el.textContent = getDisplay('dm.ev_tensione_wallbox')); document.querySelectorAll('.v-ev-range').forEach(el => el.textContent = getDisplay('dm.ev_autonomia')); document.querySelectorAll('.v-ev-km-ric').forEach(el => el.textContent = getDisplay('dm.ev_km_dall_ultima_ricarica')); document.querySelectorAll('.v-ev-odo').forEach(el => el.textContent = getDisplay('dm.ev_odometro')); document.querySelectorAll('.v-ev-ac-tot').forEach(el => el.textContent = getDisplay('dm.ev_prelievo_ac_totale_auto')); document.querySelectorAll('.v-ev-temp-wb').forEach(el => el.textContent = getDisplay('dm.ev_temperatura_wallbox'));
      updateSelectOptions('dm.ev_target_soc', 'sel-target-soc'); updateSelectOptions('dm.ev_target_soc', 'sel-target-soc-popup'); (function(){ const km = dmEvKmAlTarget(); document.querySelectorAll('.v-auto-limite').forEach(el => el.textContent = km != null ? km+' km' : '—'); })();
      const evccMode = getRawState('dm.ev_modalita_ricarica_evcc'); document.querySelectorAll('.evcc-mode-btn').forEach(btn => btn.classList.remove('active')); if(evccMode && evccMode !== '—') { const md = evccMode.toLowerCase(); const b1 = document.getElementById('m-btn-' + md); if(b1) b1.classList.add('active'); const b2 = document.getElementById('p-btn-' + md); if(b2) b2.classList.add('active'); }

      if(currentPopupType && currentPopupType.startsWith('subloads_')) { renderSubLoads(currentPopupType.replace('subloads_', '')); }
      if(currentPopupType === 'gestione_luci' && document.getElementById('details-modal').classList.contains('show')) { updateGestioneLuci(); }

      if(document.getElementById('lavatrice-modal')?.classList.contains('show')) {
          updateSelectOptions('dm.lavatrice_programma', 'sel-lav-prog'); updateSelectOptions('dm.lavatrice_temperatura', 'sel-lav-temp'); updateSelectOptions('dm.lavatrice_centrifuga', 'sel-lav-cent');
          /* v271 (issue #2): lavatrici non smart — se la fase non è disponibile ma c'è la
             potenza della presa, lo stato è derivato dalla soglia (>5W = in funzione) */
          let lavFase = getDisplay('dm.lavatrice_fase_corrente');
          const lavPw = parseFloat(STATES['dm.lavatrice_potenza_presa_lavatrice_per_lavatrici_no']?.state);
          if ((lavFase === '—' || lavFase === '--' || !lavFase) && !isNaN(lavPw)) {
              lavFase = lavPw > 5 ? '🌀 Running (' + Math.round(lavPw) + ' W)' : 'Off';
          }
          setTxt('v-lav-fase', lavFase); setTxt('v-lav-tempo', getDisplay('dm.lavatrice_tempo_rimanente'));
          /* v274 (issue #2): lavatrici non smart — nascondi i controlli programma/centrifuga/temperatura
             se le relative select non sono configurate; il popup resta con stato + presa */
          if (typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING) {
              [['dm.lavatrice_programma','lav-row-programma'],['dm.lavatrice_centrifuga','lav-row-centrifuga'],['dm.lavatrice_temperatura','lav-row-temperatura'],['dm.lavatrice_tempo_rimanente','v-lav-tempo']].forEach(([ent, elId]) => {
                  const s = STATES[ent];
                  const ghost = !s || s.entity_id === 'dm.unmapped';
                  const el = document.getElementById(elId);
                  if (el) { const row = el.closest('.lav-ctrl-row, .lav-row, .d-row') || el; row.style.display = ghost ? 'none' : ''; }
              });
          }
          const elPwrLav = document.getElementById('v-lav-power-w'); if(elPwrLav) elPwrLav.textContent = getDisplay('dm.core_037');
          const mainPwrSwitch = STATES['dm.lavatrice_presa_avvio_lavatrice']; const btnMainPwr = document.getElementById('lav-btn-power'); const txtMainPwr = document.getElementById('lav-txt-power');
          if (btnMainPwr && mainPwrSwitch) { const isOn = mainPwrSwitch.state === 'on'; btnMainPwr.classList.toggle('active', isOn); txtMainPwr.textContent = isOn ? 'ON' : 'OFF'; btnMainPwr.querySelector('.icon').textContent = isOn ? '⚡' : '🔌'; if(isOn) { btnMainPwr.style.setProperty('--btn-col', '#0ea5e9'); btnMainPwr.style.setProperty('--btn-bg', '#e0f2fe'); } else { btnMainPwr.style.setProperty('--btn-col', '#64748b'); btnMainPwr.style.setProperty('--btn-bg', '#fff'); } }
          const playSwitch = STATES['dm.lavatrice_avvio_ciclo']; const btnPlay = document.getElementById('lav-txt-play');
          if (btnPlay && playSwitch) { const isPlaying = playSwitch.state === 'on'; btnPlay.classList.toggle('active', isPlaying); btnPlay.textContent = isPlaying ? 'IN CORSO' : 'PAUSA'; btnPlay.querySelector('.icon').textContent = isPlaying ? '🔄' : '▶️'; if(isPlaying) { btnPlay.style.setProperty('--btn-col', '#ea580c'); btnPlay.style.setProperty('--btn-bg', '#ffedd5'); } else { btnPlay.style.setProperty('--btn-col', '#10b981'); btnPlay.style.setProperty('--btn-bg', '#d1fae5'); } }
          const acLav = STATES['dm.core_001']; const imgLav = document.getElementById('img-lavatrice'); if(imgLav && acLav && acLav.entity_id && acLav.entity_id !== 'dm.unmapped' && imgLav.style.display !== 'none') { imgLav.src = acLav.state === 'on' ? '/local/foto-pkg/lavatrice_on.gif' : '/local/foto-pkg/lavatrice_off.png'; }
      }

      const tAlto = getRawState('dm.boiler_sonda_temperatura_3'); const tBasso = getRawState('dm.boiler_sonda_temperatura_2'); setTxt('syn-v-pannello', getDisplay('dm.boiler_sonda_temperatura_1')); setTxt('syn-v-balto', tAlto !== '—' ? tAlto + ' °C' : '—'); setTxt('syn-v-bbasso', tBasso !== '—' ? tBasso + ' °C' : '—'); setTxt('syn-v-delta', getDisplay('dm.boiler_delta_temperatura')); setTxt('syn-v-press', getDisplay('dm.boiler_pressione_acqua')); setTxt('syn-v-power', getDisplay('dm.boiler_potenza_resistenza_boiler')); document.documentElement.style.setProperty('--tank-top', getTempColor(tAlto)); document.documentElement.style.setProperty('--tank-bottom', getTempColor(tBasso));
      const setActiveState = (id, isActive) => { const el = document.getElementById(id); if(el) el.classList.toggle('active', isActive); };
      const updateBoilerBtn = (id, isActive, tOn='ON', tOff='OFF') => { const el = document.getElementById(id); if(el) { el.classList.toggle('active', isActive); const st = el.querySelector('.state'); if(st) st.textContent = isActive ? tOn : tOff; } };
      const isPompaSolActive = getRawState('dm.boiler_stato_pompa_solare') === 'on'; setActiveState('syn-p-solare', isPompaSolActive); updateBoilerBtn('b-c-pompasol', isPompaSolActive); const sun = document.getElementById('syn-sun'); if(sun) sun.classList.toggle('active', isPompaSolActive); setLine('flow-sol-hot', isPompaSolActive); setLine('flow-sol-cold', isPompaSolActive);
      const isPannelloSolActive = getRawState('dm.boiler_interruttore_solare_termico') === 'on'; const sPanel = document.querySelector('.syn-solar-panel'); if(sPanel) sPanel.classList.toggle('active', isPannelloSolActive);
      const isRicircoloActive = getRawState('dm.core_051') === 'on'; setActiveState('syn-p-ricircolo', isRicircoloActive); updateBoilerBtn('b-c-ricircolo', isRicircoloActive); setLine('flow-ricircolo', isRicircoloActive); 
      const chiaveState = getRawState('valve.chiave_solare_termico'); const isChiaveOpen = chiaveState === 'open'; setActiveState('syn-v-chiave', isChiaveOpen); updateBoilerBtn('b-c-valvola', isChiaveOpen, 'OPEN', 'CHIUSA'); setTxt('txt-chiave', isChiaveOpen ? 'OPEN' : 'CHIUSA');
      const isCtrlSolareActive = getRawState('dm.boiler_interruttore_solare_termico') === 'on'; updateBoilerBtn('b-c-solare', isCtrlSolareActive); 
      let isCoverOpen = false; let coverPos = 0; const coverObj = STATES['dm.boiler_valvola_di_sicurezza']; if(coverObj && coverObj.attributes) { coverPos = coverObj.attributes.current_position; if(coverPos !== undefined && coverPos > 0) isCoverOpen = true; } const synSafety = document.getElementById('syn-safety-icon'); if(synSafety) synSafety.classList.toggle('active', isCoverOpen); const synFaucet = document.getElementById('syn-faucet-wrap'); if(synFaucet) synFaucet.classList.toggle('open', isCoverOpen); const sBtn = document.getElementById('b-c-sicurezza'); if(sBtn) { sBtn.classList.toggle('active', isCoverOpen); const stNode = sBtn.querySelector('.state'); if(stNode) stNode.textContent = isCoverOpen ? `${coverPos}%` : 'CHIUSA'; }
      updateBoilerBtn('b-c-centralina', getRawState('dm.boiler_centralina_solare_termico') === 'on'); updateBoilerBtn('b-c-boiler', getRawState('dm.boiler_interruttore_boiler') === 'on'); updateBoilerBtn('b-c-pdc', getRawState('dm.core_050') === 'on'); updateBoilerBtn('b-c-boost', getRawState('dm.core_048') === 'on');

      // ═══════ AGGIORNAMENTO PANNELLO ANTIFURTO PREMIUM ═══════
      (function() {
        const alarmState     = getRawState('dm.security_centrale_allarme');
        const alarmTriggered = (getRawState('dm.home_interruttore_antifurto') || '').toLowerCase() === 'on';
        const alarmStateObj  = STATES['dm.security_centrale_allarme'];
        const triggerObj     = STATES['dm.home_interruttore_antifurto'];
        const alStage  = document.getElementById('alarm-stage');
        const alTextEl = document.getElementById('alarm-state-text-new');
        const alIconEl = document.getElementById('alarm-icon-new');
        const alTimer  = document.getElementById('alarm-state-timer');
        if (!alStage || !alTextEl) return;

        // v274 (issue #2): allarme non configurato → l'intero blocco sparisce dalla pagina Sicurezza
        if (typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING) {
            const alGhost = (!alarmStateObj || alarmStateObj.entity_id === 'dm.unmapped') && (!triggerObj || triggerObj.entity_id === 'dm.unmapped');
            alStage.style.display = alGhost ? 'none' : '';
            const alWrap = document.querySelector('.alarm-modes, #alarm-modes, .alarm-mode-row');
            if (alWrap) alWrap.style.display = alGhost ? 'none' : '';
            if (alGhost) return;
        }
        
        // Reset stati card e bottoni
        alStage.classList.remove('armed','triggered');
        document.querySelectorAll('.alarm-mode-btn').forEach(b => b.classList.remove('active'));
        
        // Determina stato visivo
        let color = '#059669', rgb = '5,150,105', text = 'DISARMATO', icon = '🔓', activeBtn = 'disarm', isArmed = false, sourceObj = alarmStateObj;
        
        if (alarmTriggered) {
          // PRIORITÀ MASSIMA: allarme scattato
          color = '#dc2626'; rgb = '220,38,38'; text = 'ALLARME!'; icon = '🚨';
          activeBtn = ''; sourceObj = triggerObj || alarmStateObj;
          alStage.classList.add('triggered');
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        } else if (alarmState === 'armed_away') {
          color = '#e11d48'; rgb = '225,29,72'; text = 'ARMATO · FUORI'; icon = '🛡️'; activeBtn = 'away'; isArmed = true;
        } else if (alarmState === 'armed_night') {
          color = '#7c3aed'; rgb = '124,58,237'; text = 'ARMATO · NOTTE'; icon = '🌙'; activeBtn = 'night'; isArmed = true;
        } else if (alarmState === 'armed_home') {
          color = '#06b6d4'; rgb = '6,182,212';  text = 'ARMATO · CASA';  icon = '🏡'; activeBtn = 'home'; isArmed = true;
        } else if (alarmState === 'armed_custom_bypass') {
          color = '#e11d48'; rgb = '225,29,72'; text = 'ARMATO · PARZIALE'; icon = '🎚️'; activeBtn = 'custom'; isArmed = true;
        } else if (alarmState === 'armed_vacation') {
          color = '#e11d48'; rgb = '225,29,72'; text = 'ARMATO · VACANZA'; icon = '✈️'; activeBtn = 'vacation'; isArmed = true;
        } else if (alarmState === 'pending' || alarmState === 'arming') {
          color = '#f59e0b'; rgb = '245,158,11'; text = 'IN USCITA...';   icon = '⏳'; activeBtn = ''; isArmed = true;
        } else if (alarmState === 'disarmed') {
          color = '#059669'; rgb = '5,150,105';  text = 'DISARMATO';      icon = '🔓'; activeBtn = 'disarm';
        }
        
        // Applica colori e classi
        alStage.style.setProperty('--al-col', color);
        alStage.style.setProperty('--al-rgb', rgb);
        alStage.style.setProperty('--al-soft', `rgba(${rgb}, 0.10)`);
        alTextEl.textContent = text;
        if (alIconEl) alIconEl.textContent = icon;
        if (isArmed) alStage.classList.add('armed');
        
        // Marca pulsante modalità attivo
        /* Quale tasto corrisponde a questo stato lo sa core/alarm-panel.js, che
           sa anche quali tasti la centrale ha davvero: se Casa non c'e', si
           accende l'inserimento totale invece di lasciare la fila spenta. */
        try { if (activeBtn && typeof dmAlarmActiveMode === 'function') activeBtn = dmAlarmActiveMode(alarmState) || activeBtn; } catch(e) {}
        if (activeBtn) {
          const btn = document.querySelector(`.alarm-mode-btn[data-mode="${activeBtn}"]`);
          if (btn) btn.classList.add('active');
        }
        
        // Timer "Attivo da X" — visibile solo se armato o allarme
        if (alTimer) {
          alTimer.classList.remove('show');
          if ((isArmed || alarmTriggered) && sourceObj && sourceObj.last_changed) {
            const since = new Date(sourceObj.last_changed).getTime();
            const elapsed = Math.max(0, Date.now() - since);
            const mins  = Math.floor(elapsed / 60000);
            const hours = Math.floor(mins / 60);
            const days  = Math.floor(hours / 24);
            let label;
            if (alarmTriggered) {
              label = `⚠️ Scattato ${mins > 0 ? mins + ' min fa' : 'ora'}`;
            } else if (alarmState === 'pending' || alarmState === 'arming') {
              label = 'Inserimento in corso...';
            } else if (days > 0)       label = `Attivo da ${days}g ${hours % 24}h`;
            else if (hours > 0) label = `Attivo da ${hours}h ${mins % 60}m`;
            else if (mins > 0)  label = `Attivo da ${mins} min`;
            else                label = 'Attivato ora';
            alTimer.textContent = label;
            alTimer.classList.add('show');
          }
        }
      })();

      const lights = ['dm.core_021', 'dm.core_018', 'dm.core_017', 'dm.core_020', 'dm.core_019']; lights.forEach(l => { const el = document.getElementById('t-' + l.replace('.', '-')); if(el) el.classList.toggle('on', getRawState(l) === 'on'); });

      // CPU gestita sopra

      // RAM + temperatura display
      // ram display gestito nel ring JS
      setTxt('v-srv-cputemp', (parseFloat(getRawState('dm.server_temperatura_cpu')) || 0).toFixed(0));
      // disk display gestito nel ring JS
      setTxt('v-srv-pwr', getDisplay('dm.server_potenza_raspberry_server'));
      setTxt('v-srv-dl', getDisplay('dm.server_speedtest_download'));
      setTxt('v-srv-ul', getDisplay('dm.server_speedtest_upload'));

      // Uptime — gestito nel blocco MiniPC sotto
      // (aggiornato dalla IIFE sotto)

      // ── MiniPC barre colorate + ring temperatura ──
      (function() {
          const cpuPct  = parseFloat(getRawState('dm.server_cpu'))    || 0;
          const ramMb   = parseFloat(getRawState('dm.server_ram'))   || 0;
          const ramTot  = parseFloat(STATES['dm.server_ram']?.attributes?.total) || 16000;
          const diskPct = parseFloat(getRawState('dm.server_disco'))   || 0;
          const tempC   = parseFloat(getRawState('dm.server_temperatura_cpu')) || 0;

          const colorCls = p => p < 60 ? 'low' : p < 80 ? 'medium' : 'high';
          const setBar = (id, pct) => {
              const el = document.getElementById(id);
              if (el) { el.style.width = Math.min(100, pct) + '%'; }
          };
          setBar('srv-fill-cpu',  cpuPct);
          setBar('srv-fill-ram',  (window._cdRamPct !== undefined ? window._cdRamPct : (ramTot > 0 ? ramMb / ramTot * 100 : 0)));
          setBar('srv-fill-disk', diskPct);

          if (tempC > 0) {
              const circ = 2 * Math.PI * 36;
              const dash = Math.min(1, (tempC - 20) / 80) * circ;
              const ring = document.getElementById('srv-temp-circle');
              if (ring) {
                  ring.setAttribute('stroke-dasharray', dash.toFixed(1) + ' ' + circ.toFixed(1));
                  ring.setAttribute('stroke', tempC > 75 ? '#ef4444' : tempC > 55 ? '#f59e0b' : '#7c3aed');
              }
              const stEl = document.getElementById('v-srv-temp-status');
              if (stEl) stEl.textContent = tempC > 75 ? '🔴 Alta — Controllare' : tempC > 55 ? '🟡 Nella norma' : '🟢 Ottimale';
          }
      })(); // fine IIFE MiniPC metriche

      // Uptime — dm.server_uptime_home_assistant (Glances) restituisce datetime ISO del boot
          // Es: "2026-06-09T21:59:23+00:00"
          (function() {
              const raw = STATES['dm.server_uptime_home_assistant'];
              if (!raw || !raw.state) return;
              const upEl  = document.getElementById('v-srv-uptime');
              const subEl = document.getElementById('v-srv-uptime-sub');
              if (!upEl || !subEl) return;
              const bootDate = new Date(raw.state);
              if (isNaN(bootDate.getTime())) return;
              const diffMs = Date.now() - bootDate.getTime();
              const diffM  = Math.floor(diffMs / 60000);
              const diffH  = Math.floor(diffMs / 3600000);
              const diffD  = Math.floor(diffMs / 86400000);
              if (diffD > 0)      upEl.textContent = diffD + 'g ' + (diffH % 24) + 'h';
              else if (diffH > 0) upEl.textContent = diffH + 'h ' + (diffM % 60) + 'm';
              else                upEl.textContent = diffM + 'min';
              const bootLocal = bootDate.toLocaleDateString('it-IT', {day:'numeric', month:'short'})
                              + ' ' + bootDate.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
              const lastSeen = new Date(raw.last_updated);
              const staleM   = Math.round((Date.now() - lastSeen.getTime()) / 60000);
              const staleStr = staleM <= 10 ? '' : staleM < 60 ? ' · agg. ' + staleM + 'min fa' : ' · agg. ' + Math.floor(staleM/60) + 'h fa';
              subEl.textContent = 'Riavviato: ' + bootLocal + staleStr;
          })();
      // Rete
      // Connettività: dm.server_raggiungibilita_google (confermato dall'utente)
      const netStat    = getRawState('dm.server_raggiungibilita_google');
      const netEntityId = 'dm.server_raggiungibilita_google';
      const netText = document.getElementById('v-srv-net-text');
      const netText2 = document.getElementById('v-srv-net-text2');
      const netStatus = document.getElementById('v-srv-net-status');
      const netStatus2 = document.getElementById('v-srv-net-status2');
      const netBadge = document.getElementById('waw-net-badge');
      const isOnline = netStat === 'on';
      const netLabel = isOnline ? 'CONNESSO' : 'NON CONNESSO';
      // netText rimosso (era duplicato)
      if (netText2)   netText2.textContent   = netLabel;
      if (netStatus)  netStatus.textContent  = isOnline ? 'ONLINE' : 'OFFLINE';
      if (netStatus2) netStatus2.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
      if (netBadge) {
          netBadge.className = 'srv-status-badge ' + (isOnline ? 'online' : 'offline');
          const ind = netBadge.querySelector('.srv-status-indicator');
          if (ind) ind.style.background = isOnline ? '#10b981' : '#ef4444';
      }

      // Inverter — v254 fix: distingue correttamente ON-GRID da OFF-GRID
      // (Bug precedente: includes('grid') matchava entrambi perché "off-grid" contiene "grid")
      const invStat = getRawState('dm.energy_stato_rete');
      const invText  = document.getElementById('v-srv-inv-text');
      const invStatus = document.getElementById('v-srv-inv-status');
      const invBadge  = document.getElementById('waw-inv-badge');
      const sLow = (invStat || '').toString().toLowerCase();
      const isOffGrid = sLow.includes('off');  // "off-grid", "off grid", "off"
      const isGrid = !isOffGrid && (sLow.includes('on-grid') || sLow.includes('ongrid') || sLow === 'on' || sLow === 'connected' || sLow === '1');
      if (invText)   invText.textContent   = isGrid ? 'ON-GRID' : 'OFF-GRID';
      if (invStatus) invStatus.textContent = isGrid ? 'ON-GRID' : 'ALERT';
      if (invBadge)  invBadge.className    = 'srv-status-badge ' + (isGrid ? 'online' : 'offline');
      
      if(currentPopupType && document.getElementById('details-modal').classList.contains('show') && !currentPopupType.startsWith('subloads_') && currentPopupType !== 'gestione_luci' && currentPopupType !== 'camera_view' && currentPopupType !== 'avviso_custom') { apriDettagli(null, currentPopupType); }
      else if(currentPopupType === 'avviso_custom' && document.getElementById('details-modal').classList.contains('show')) { updateAvvisoCustom(); }

      updateClimaCards(); // v274: autonomo — si aggiorna anche se altre sezioni falliscono
      updateDeviceCards(); // v280: dispositivi personalizzati
  } catch (err) { console.error("Errore UI:", err); }
}

function setTemp(entity, direction) {
    if(!ws) return;
    if(navigator.vibrate) navigator.vibrate(10);
    const s = STATES[entity];
    if(!s || !s.attributes || s.attributes.temperature === undefined) return;
    // v253: step 1 grado intero (era 0.5). Math.round per evitare drift da 23.5
    let curr = Math.round(parseFloat(s.attributes.temperature));
    let newTemp = direction === 'up' ? curr + 1 : curr - 1;
    ws.send(JSON.stringify({ id: msgId++, type: 'call_service', domain: 'climate', service: 'set_temperature', service_data: { entity_id: entity, temperature: newTemp } }));
}

// v254: gestione modalità Freddo/Caldo nella pagina Clima
let currentClimaPageMode = 'freddo';
function setClimaPageMode(mode, silent) {
    if (mode !== 'freddo' && mode !== 'caldo') return;
    if (!silent && navigator.vibrate) navigator.vibrate(8);
    currentClimaPageMode = mode;
    const btnFreddo = document.getElementById('clima-page-mode-freddo');
    const btnCaldo  = document.getElementById('clima-page-mode-caldo');
    if (btnFreddo) btnFreddo.classList.toggle('active-freddo', mode === 'freddo');
    if (btnCaldo)  btnCaldo.classList.toggle('active-caldo',  mode === 'caldo');
    document.querySelector('.clima-zone-freddo')?.classList.toggle('show', mode === 'freddo');
    document.querySelector('.clima-zone-caldo')?.classList.toggle('show', mode === 'caldo');
}

function toggleClima(entity) {
    if(!ws) return;
    if(navigator.vibrate) navigator.vibrate(15);
    const s = STATES[entity];
    if(!s) return;
    const service = s.state === 'off' ? 'turn_on' : 'turn_off';
    ws.send(JSON.stringify({ id: msgId++, type: 'call_service', domain: 'climate', service: service, service_data: { entity_id: entity } }));
}

// ================= POPUP CLIMA RAPIDO (stile NSPanel) =================
// v240: griglia bottoni quadrati + logica 3-step (set_hvac_mode → set_temperature → set_fan_mode)
// v241: aggiunto switch FREDDO/CALDO. Stessa lista stanze, lo switch decide se
//       il tap accende il condizionatore (climate.*) o il termosifone (input_boolean.*)
const QUICK_STANZE = [
  { nome: 'Matrimoniale', icona: '🛌', clima: 'dm.core_002', term: 'dm.core_014' },
  { nome: 'Cameretta',    icona: '🛏️', clima: 'dm.core_003',       term: 'dm.core_015' },
  { nome: 'Cucina',       icona: '🍽️', clima: 'dm.core_004',          term: 'dm.core_012' },
  { nome: 'Salone',       icona: '🛋️', clima: 'dm.core_005',          term: null },
  { nome: 'Bagno',        icona: '🛁', clima: null,                       term: 'dm.core_013' },
  { nome: 'Studio',       icona: '💼', clima: null,                       term: 'dm.core_016' }
];

// Modalità corrente del popup: 'freddo' (default) o 'caldo'
let currentClimaMode = 'freddo';

function apriQuickClima() {
    if(navigator.vibrate) navigator.vibrate(10);
    document.getElementById('quick-clima-modal').classList.add('show');
    renderQuickClima();
}

function setQuickClimaMode(mode) {
    if (mode !== 'freddo' && mode !== 'caldo') return;
    if (navigator.vibrate) navigator.vibrate(8);
    currentClimaMode = mode;
    // Toggle classi attive dei due bottoni dello switch
    document.getElementById('ns-mode-freddo').classList.toggle('active-freddo', mode === 'freddo');
    document.getElementById('ns-mode-caldo').classList.toggle('active-caldo',  mode === 'caldo');
    // Aggiorna titolo + hint
    const titleEl = document.getElementById('quick-clima-title');
    const hintEl  = document.getElementById('quick-clima-hint');
    if (titleEl) titleEl.textContent = mode === 'freddo' ? '❄️ CLIMA · FREDDO' : '🔥 CLIMA · CALDO';
    if (hintEl) {
        // Quello che il tasto fara' davvero, non un esempio: i tre passi li
        // sceglie la configurazione, e la scritta li legge dalla stessa fonte.
        var detto = null;
        try { detto = window.dmQuickClimateHint && window.dmQuickClimateHint(null); } catch (e) { detto = null; }
        hintEl.textContent = mode === 'freddo'
            ? (detto || 'Tocca per accendere · raffrescamento 26°C · ventola auto')
            : 'Tocca una stanza per accendere il termosifone';
    }

    // v244: mostra/nasconde pannello termico (caldaia, termocamino, aspiratore)
    const thermalPanel = document.getElementById('ns-thermal-panel');
    if (thermalPanel) thermalPanel.classList.toggle('show', mode === 'caldo');

    renderQuickClima();
    if (mode === 'caldo') renderThermalPanel();
}

// v244: scorciatoia per aprire direttamente il popup in modalità Caldo (richiamata dalla pillola "Caldaia accesa")
function apriQuickClimaCaldo() {
    apriQuickClima();
    setQuickClimaMode('caldo');
}

// v244: render del pannello termico (caldaia/termocamino/aspiratore canna fumaria)
function renderThermalPanel() {
    const map = [
      { entityId: 'switch.caldaia',                   rowEl: 'ns-thermal-row-caldaia',     stateEl: 'ns-thermal-caldaia',     textEl: 'ns-thermal-caldaia-text' },
      { entityId: 'dm.core_053',               rowEl: 'ns-thermal-row-termocamino', stateEl: 'ns-thermal-termocamino', textEl: 'ns-thermal-termocamino-text' }
    ];
    map.forEach(m => {
      const s = STATES[m.entityId];
      const stato = s?.state;
      const row = document.getElementById(m.rowEl);
      const el = document.getElementById(m.stateEl);
      const txt = document.getElementById(m.textEl);
      if (!el || !txt) return;
      el.classList.remove('on', 'off', 'unavail');
      if (row) row.classList.remove('is-on', 'is-unavail');
      if (stato === 'on')        { el.classList.add('on');      txt.textContent = 'ATTIVA'; if (row) row.classList.add('is-on'); }
      else if (stato === 'off')  { el.classList.add('off');     txt.textContent = 'OFF'; }
      else                        { el.classList.add('unavail'); txt.textContent = 'N/D';   if (row) row.classList.add('is-unavail'); }
    });
    // Aspiratore (riga cliccabile)
    const aspiratore = STATES['dm.core_047'];
    const aspRow = document.getElementById('ns-thermal-row-aspiratore');
    const aspBtn = document.getElementById('ns-thermal-aspiratore-btn');
    const aspText = document.getElementById('ns-thermal-aspiratore-text');
    if (aspBtn && aspText) {
      aspBtn.classList.remove('on', 'off', 'unavail');
      if (aspRow) aspRow.classList.remove('is-on', 'is-unavail');
      if (aspiratore?.state === 'on') {
        aspBtn.classList.add('on');
        aspText.textContent = 'ACCESO';
        if (aspRow) aspRow.classList.add('is-on');
      } else if (aspiratore?.state === 'unavailable') {
        aspBtn.classList.add('unavail');
        aspText.textContent = 'N/D';
        if (aspRow) aspRow.classList.add('is-unavail');
      } else {
        aspBtn.classList.add('off');
        aspText.textContent = 'OFF';
      }
    }
}

// v244: toggle dell'aspiratore canna fumaria
function toggleAspiratoreCF() {
    if (!ws) return;
    if (navigator.vibrate) navigator.vibrate(15);
    const cur = STATES['dm.core_047']?.state;
    const service = (cur === 'on') ? 'turn_off' : 'turn_on';
    ws.send(JSON.stringify({
      id: msgId++, type: 'call_service', domain: 'switch', service: service,
      service_data: { entity_id: 'dm.core_047' }
    }));
    setTimeout(renderThermalPanel, 300);
}

// v244: aggiorna la pillola "Caldaia accesa" sotto il meteo (chiamata dal render globale)
function renderCaldaiaBanner() {
    const banner = document.getElementById('caldaia-banner');
    if (!banner) return;
    const stato = STATES['switch.caldaia']?.state;
    banner.classList.toggle('show', stato === 'on');
}

// v245: aggiorna la pillola "Antifurto" sotto il meteo
// Visibile per qualsiasi stato diverso da disarmed/unknown/unavailable
function renderAllarmeBanner() {
    const banner = document.getElementById('allarme-banner');
    if (!banner) return;
    const iconEl = document.getElementById('allarme-banner-icon');
    const textEl = document.getElementById('allarme-banner-text');
    const _alarmObj = cdFirstMapped('dm.security_centrale_allarme');
    const _trigObj  = cdFirstMapped('dm.home_interruttore_antifurto');
    const stato  = _alarmObj?.state;
    const triggerOn = _trigObj?.state === 'on';

    // v300 (segnalazione Dima): antifurto NON configurato → banner rimosso.
    // Il vecchio check confrontava con undefined, ma il ghost restituisce 'unavailable':
    // il banner restava visibile (e con stati anomali mostrava perfino "Allarme!").
    if (typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING && !_alarmObj && !_trigObj) {
        banner.remove();
        return;
    }

    // v269 (issue #2): antifurto non configurato → il banner viene rimosso dalla Home
    if (typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING && stato === undefined && !triggerOn) {
        banner.remove();
        return;
    }

    // Reset classi stato
    banner.classList.remove('triggered');

    // Logica priorità: triggered > armed_* > pending/arming > altro
    let show = false, icon = '🛡️', text = 'Antifurto', rgb = '124,58,237', textRgb = '91,33,182';

    if (triggerOn) {
      show = true;
      icon = '🚨';
      text = 'Allarme!';
      rgb = '220,38,38';
      textRgb = '153,27,27';
      banner.classList.add('triggered');
    } else if (stato === 'armed_away') {
      show = true; icon = '🛡️'; text = 'Antifurto · Total'; rgb = '225,29,72';  textRgb = '157,23,53';
    } else if (stato === 'armed_night') {
      show = true; icon = '🌙'; text = 'Antifurto · Notte';  rgb = '124,58,237'; textRgb = '91,33,182';
    } else if (stato === 'armed_home') {
      show = true; icon = '🏡'; text = 'Antifurto · Casa';   rgb = '6,182,212';  textRgb = '14,116,144';
    } else if (stato === 'armed_custom_bypass') {
      show = true; icon = '🛡️'; text = 'Antifurto · Parziale'; rgb = '225,29,72'; textRgb = '157,23,53';
    } else if (stato === 'pending' || stato === 'arming') {
      show = true; icon = '⏳'; text = 'Antifurto · In uscita'; rgb = '245,158,11'; textRgb = '154,87,4';
    }

    banner.classList.toggle('show', show);
    if (show) {
      if (iconEl) iconEl.textContent = icon;
      if (textEl) textEl.textContent = text;
      banner.style.setProperty('--pill-rgb', rgb);
      banner.style.setProperty('--pill-text-rgb', textRgb);
    }
}

function renderQuickClima() {
    // La scritta sotto al titolo dice cosa fara' il tasto, e la scelta puo'
    // essere cambiata mentre il popup e' chiuso: si rilegge a ogni disegno,
    // non solo quando si passa da freddo a caldo.
    try {
        const hint = document.getElementById('quick-clima-hint');
        if (hint && currentClimaMode === 'freddo' && window.dmQuickClimateHint) {
            const detto = window.dmQuickClimateHint(null);
            if (detto) hint.textContent = detto;
        }
    } catch (e) {}
    const grid = document.getElementById('quick-clima-grid');
    if (!grid) return;
    grid.innerHTML = '';

    QUICK_STANZE.forEach(s => {
      // Quale entità usare a seconda della modalità
      const entityId = currentClimaMode === 'freddo' ? s.clima : s.term;

      // v242: se la stanza non ha dispositivo per la modalità selezionata, salta del tutto il bottone
      if (!entityId) return;

      const stateObj = STATES[entityId];
      const stato    = stateObj?.state;
      const isOn     = stato && stato !== 'off' && stato !== 'unavailable' && stato !== 'unknown';

      // Temperatura badge (solo per modalità freddo: target temp se acceso, current temp altrimenti)
      let tempLabel = '';
      if (currentClimaMode === 'freddo' && stateObj) {
        const targetTemp = stateObj.attributes?.temperature;
        const currTemp   = stateObj.attributes?.current_temperature;
        tempLabel = isOn && targetTemp !== undefined
          ? `${targetTemp}°`
          : (currTemp !== undefined ? `${Math.round(currTemp)}°` : '');
      }

      const btn = document.createElement('button');
      btn.className = 'ns-clima-btn' + (isOn ? (currentClimaMode === 'freddo' ? ' on-clima' : ' on-heat') : '');
      btn.setAttribute('data-entity', entityId);
      btn.onclick = () => {
        if (currentClimaMode === 'freddo') nsToggleClima(entityId);
        else                                nsToggleTerm(entityId);
      };
      btn.innerHTML = `
        ${tempLabel ? `<span class="ns-clima-btn-temp">${tempLabel}</span>` : ''}
        <span class="ns-clima-btn-icon">${s.icona}</span>
        <span class="ns-clima-btn-name">${s.nome}</span>
      `;
      grid.appendChild(btn);
    });
}

// Logica clima a 3 step (come NSPanel): accensione → cool, temp 26, fan auto. Spegnimento → off
function nsToggleClima(entityId) {
    if (!ws) return;
    if (navigator.vibrate) navigator.vibrate(15);
    const cur = STATES[entityId]?.state;

    if (cur === 'off' || !cur || cur === 'unavailable' || cur === 'unknown') {
      // I passi li decide la configurazione, non questa riga: modalita',
      // temperatura e ventola si scelgono nella scheda Clima, e una casella
      // lasciata vuota vuol dire «non toccare». Se il modulo che li traduce non
      // c'e', si accende come si e' sempre acceso.
      var passi;
      try { passi = window.dmQuickClimateSteps && window.dmQuickClimateSteps(); } catch (e) { passi = null; }
      if (!passi || !passi.length) passi = [
        { service: 'set_hvac_mode', data: { hvac_mode: 'cool' } },
        { service: 'set_temperature', data: { temperature: 26 } },
        { service: 'set_fan_mode', data: { fan_mode: 'auto' } }
      ];
      // Distanziati nel tempo come prima: mandare la temperatura a un
      // condizionatore ancora spento la fa cadere nel vuoto.
      passi.forEach(function (passo, indice) {
        var manda = function () {
          ws.send(JSON.stringify({
            id: msgId++, type: 'call_service', domain: 'climate', service: passo.service,
            service_data: passo.data, target: { entity_id: entityId }
          }));
        };
        if (indice === 0) manda(); else setTimeout(manda, indice * 700);
      });
    } else {
      // Spegnimento
      ws.send(JSON.stringify({
        id: msgId++, type: 'call_service', domain: 'climate', service: 'set_hvac_mode',
        service_data: { hvac_mode: 'off' }, target: { entity_id: entityId }
      }));
    }
    // Refresh ottimistico — lo stato vero arriva via WS state_changed
    setTimeout(renderQuickClima, 500);
}

// v241: toggle del termosifone (input_boolean → turn_on/turn_off)
// L'automazione lato HA collegata a questo input_boolean fa scattare il termosifone fisico
function nsToggleTerm(entityId) {
    if (!ws) return;
    if (navigator.vibrate) navigator.vibrate(15);
    const cur = STATES[entityId]?.state;
    const service = (cur === 'on') ? 'turn_off' : 'turn_on';
    ws.send(JSON.stringify({
      id: msgId++, type: 'call_service', domain: 'input_boolean', service: service,
      service_data: { entity_id: entityId }
    }));
    setTimeout(renderQuickClima, 300);
}

// ================= POPUP ANTIFURTO RAPIDO (v240) =================
// Apre un popup con 3 bottoni (Total/Notte/Sblocca). Riusa promptPinAndSet
// che già gestisce il keypad PIN e chiama il servizio alarm_control_panel.
function apriQuickAntifurto() {
    if(navigator.vibrate) navigator.vibrate(10);
    document.getElementById('quick-alarm-modal').classList.add('show');
    renderQuickAntifurto();
}

function renderQuickAntifurto() {
    const stateObj = STATES['dm.security_centrale_allarme'];
    const cur = stateObj?.state || 'unknown';

    // Aggiorna banner stato in cima al popup
    const dotEl  = document.getElementById('qa-alarm-dot');
    const textEl = document.getElementById('qa-alarm-state-text');
    if (dotEl && textEl) {
      let label = '—', dotClass = '';
      switch (cur) {
        case 'armed_away':    label = 'TOTALE';      dotClass = 'armed';   break;
        case 'armed_night':   label = 'NOTTE';       dotClass = 'night';   break;
        case 'armed_home':    label = 'CASA';        dotClass = 'armed';   break;
        case 'armed_custom_bypass': label = 'PARZIALE'; dotClass = 'armed'; break;
        case 'disarmed':      label = 'DISINSERITO'; dotClass = 'disarm';  break;
        case 'pending':       label = 'IN ATTESA';   dotClass = 'armed';   break;
        case 'arming':        label = 'INSERIMENTO'; dotClass = 'armed';   break;
        case 'triggered':     label = 'ALLARME!';    dotClass = 'trigger'; break;
        case 'unavailable':
        case 'unknown':       label = 'NON DISPONIBILE'; break;
        default:              label = cur.toUpperCase();
      }
      textEl.textContent = label;
      dotEl.className = 'qa-alarm-status-dot' + (dotClass ? ' ' + dotClass : '');
    }

    /* Prima di tutto: quali tasti questa centrale ha davvero.
       Ring non ha la modalita' Notte, e un tasto che chiama un servizio che la
       centrale non conosce e' un tasto che chiede il PIN e poi non fa niente. */
    const allBtns = document.querySelectorAll('#qa-alarm-grid .qa-alarm-btn');
    let disponibili = null;
    try { if (typeof dmAlarmModes === 'function') disponibili = dmAlarmModes(); } catch(e) {}
    allBtns.forEach(b => {
      const suo = b.getAttribute('data-mode');
      const c1 = !disponibili || disponibili.indexOf(suo) >= 0;
      b.style.display = c1 ? '' : 'none';
      b.hidden = !c1;
    });
    /* E la riga del PIN si accende solo se un PIN c'e'. */
    const pinHint = document.getElementById('qa-alarm-pin-hint');
    if (pinHint) {
      let chiede = true;
      try { if (typeof dmAlarmCodeNeeded === 'function') chiede = !!dmAlarmCodeNeeded('alarm_disarm'); } catch(e) {}
      pinHint.style.display = chiede ? '' : 'none';
    }

    // Highlight bottone attivo
    allBtns.forEach(b => b.classList.remove('active'));
    let activeMode = null;
    /* Stessa regola della pagina Sicurezza, e uno solo che la scrive. */
    try { if (typeof dmAlarmActiveMode === 'function') activeMode = dmAlarmActiveMode(cur) || null; } catch(e) {}
    if (!activeMode) {
      if (cur === 'armed_away' || cur === 'armed_custom_bypass') activeMode = 'away';
      else if (cur === 'armed_night') activeMode = 'night';
      else if (cur === 'disarmed')    activeMode = 'disarm';
    }
    if (activeMode) {
      const btn = document.querySelector(`#qa-alarm-grid .qa-alarm-btn[data-mode="${activeMode}"]`);
      if (btn) btn.classList.add('active');
    }
}


// ================= TITANICO MOTORE DI CALCOLO E HISTORICAL DRILL-DOWN =================

let recapChartInstance = null;
let activeRecapDeviceKey = null;

// ============================================================
//  DASHBOARD ENERGIA MENSILE — Motore completo
// ============================================================

// Sensori MESE CORRENTE (lettura diretta da STATES)
const ED_SENSORS_CURR = {
    prod:       'dm.energy_produzione_solare_mese',
    cons:       'dm.energy_consumo_casa_mese',
    immesso:    'dm.energy_rete_venduta_mese',
    prelevato:  'dm.energy_rete_acquistata_mese',
    batCarico:  'dm.energy_batteria_caricata_mese',
    batScarico: 'dm.energy_batteria_usata_mese',
    wbOn:       'dm.ev_energia_wallbox_mese',
    wbKwPeak:   'dm.ev_potenza_wallbox',
    solarPrev:  'dm.energy_produzione_solare_anno',
    consPrev:   'dm.energy_consumo_casa_anno',
};

// Sensori dispositivi mese corrente → usati anche per mesi precedenti via History
const ED_DEV_SENSORS_CURR = {
    wallbox:      'dm.ev_energia_wallbox_mese',
    asciugatrice: 'dm.core_029',
    frigo:        'dm.core_032',
    lavastoviglie:'dm.core_034',
    lavatrice:    'dm.core_035',
    forno:        'dm.core_030',
    friggitrice:  'dm.core_031',
    caffe:         'dm.core_033',
    microonde:    'dm.core_036',
    boiler:       'dm.energy_boiler_mese',
};

const ED_DEVICES = [];

/* v0.7.3 fix (#6): now a callable function — adding an entry from the editor
   updates the Report IMMEDIATELY, no page reload needed. */
function cdRebuildReportDevices() {
  const modules = window.DashboardModernModules;
  ED_DEVICES.length = 0;
  if (!modules || !modules.store || !modules.data.canonicalReportDevices) {
    window.__DM_REPORT_RUNTIME_ERROR__ = 'Canonical Report runtime unavailable';
    buildReportSelect();
    return false;
  }
  window.__DM_REPORT_RUNTIME_ERROR__ = '';
  const devices = modules.data.canonicalReportDevices(
    modules.store.getSection('appliances'), modules.store.getSection('loads'));
  const palette = ['#06b6d4','#7c3aed','#e11d48','#059669','#f59e0b','#0ea5e9'];
  ED_DEVICES.length = 0;
  devices.forEach(function(device, index) {
    ED_DEVICES.push({ key: device.key, name: device.name, icon: device.icon,
      sensor: device.entity, history: device.history,
      color: palette[index % palette.length], bg: 'rgba(14,165,233,0.1)' });
  });
}
cdRebuildReportDevices();

const COSTO_KWH  = 0.25;
const VALORE_CO2 = 0.4;
let edDailyChart  = null;

// Aggiornamento leggero: solo i valori numerici, niente grafico né lista
function edUpdateKpiOnly() {
    if (Object.keys(STATES).length === 0) return;
    // Aggiorna orologio header (sempre)
    const now = new Date();
    const gg  = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
    const mm  = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
    const dateStr = gg[now.getDay()] + ' ' + now.getDate() + ' ' + mm[now.getMonth()];
    const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
    edSetText('ed-datetime', dateStr + ' • ' + timeStr);
    edSetText('ed-clock', now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0'));
    
    // ⚠️ IMPORTANTE: se l'utente sta visualizzando un mese passato, NON sovrascrivere
    // il banner/finanziarie con i dati del mese corrente (sarebbe sbagliato!)
    const selMonthEl = document.getElementById('ed-sel-month');
    const selYearEl  = document.getElementById('ed-sel-year');
    if (selMonthEl && selYearEl) {
        const selMonth = parseInt(selMonthEl.value, 10);
        const selYear  = parseInt(selYearEl.value, 10);
        const isCurrentMonth = (selMonth === now.getMonth() + 1) && (selYear === now.getFullYear());
        if (!isCurrentMonth) return; // skip: lascia i valori del mese passato già calcolati da renderEnergyDashboard
    }
    
    /* v0.8.6: STESSE regole del badge/mappa — il motore periodi (delta del mese) invece del
       valore grezzo del contatore, così PRODUZIONE FV non mostra più il totale lifetime (es. 11400). */
    const prod      = cdPNum(ED_SENSORS_CURR.prod);
    const cons      = cdPNum(ED_SENSORS_CURR.cons);
    const immesso   = cdPNum(ED_SENSORS_CURR.immesso);
    const prelevato = cdPNum(ED_SENSORS_CURR.prelevato);
    const batCar    = cdPNum(ED_SENSORS_CURR.batCarico);
    const batScar   = cdPNum(ED_SENSORS_CURR.batScarico);
    const wbOn      = cdPNum(ED_SENSORS_CURR.wbOn);

    const auto      = cons > 0 ? Math.min(100, Math.round(((cons - prelevato) / cons) * 100)) : 0;
    const autoconsumo = Math.max(0, prod - immesso);
    const batEff    = batCar > 0 ? Math.round((batScar / batCar) * 100) : 0;

    // Banner KPI verde
    edSetText('ed-kpi-prod', prod.toFixed(0) + ' <small>kWh</small>');
    edSetText('ed-kpi-cons', (consStimato ? '≈' : '') + cons.toFixed(0) + ' <small>kWh</small>');
    edSetText('ed-kpi-auto', auto + ' <small>%</small>');

    // Griglia finanziaria — logica narrativa: senza FV → costo reale → risparmio → venduto → CO₂
    const senzaFV     = cons * COSTO_KWH;                     // quanto avresti speso senza fotovoltaico
    const costoReale  = prelevato * COSTO_KWH;                // quanto hai pagato davvero (solo dalla rete)
    const risparmio   = Math.max(0, senzaFV - costoReale);    // differenza = quanto ti ha fatto risparmiare il FV
    const guadagnoGSE = immesso * 0.10;                        // stima 0.10€/kWh per energia immessa (GSE)
    
    edSetText('ed-fin-pagato', senzaFV.toFixed(2) + ' €');
    edSetText('ed-fin-pagato-sub', cons.toFixed(0) + ' kWh × 0.25€');
    edSetText('ed-fin-costo',  costoReale.toFixed(2) + ' €');
    edSetText('ed-fin-costo-sub', prelevato.toFixed(1) + ' kWh × 0.25€');
    edSetText('ed-fin-risp',   risparmio.toFixed(2) + ' €');
    edSetText('ed-fin-risp-sub', 'Grazie al fotovoltaico');
    edSetText('ed-fin-imm',    guadagnoGSE.toFixed(2) + ' €');
    edSetText('ed-fin-imm-sub', immesso.toFixed(1) + ' kWh × 0.10€');
    edSetText('ed-fin-co2',    (prod * VALORE_CO2).toFixed(0) + ' kg');
    edSetText('ed-fin-co2-sub', '≈ ' + Math.round((prod * VALORE_CO2) / 22) + ' alberi/anno');

    // Ring autosufficienza
    const circ = 2 * Math.PI * 32;
    const dash = (auto / 100) * circ;
    const circle = document.getElementById('ed-auto-circle');
    if (circle) circle.setAttribute('stroke-dasharray', dash.toFixed(1) + ' ' + circ.toFixed(1));
    edSetText('ed-auto-ring-val', auto + '%');
    edSetText('ed-auto-big', auto + '%');

    // Wallbox
    edSetText('ed-wb-on',  wbOn.toFixed(1) + ' kWh');
    const kwNowKpi  = parseFloat(getRawState(ED_SENSORS_CURR.wbKwPeak)) || 0;
    const kwPeakKpi = kwNowKpi > 0.5 ? kwNowKpi : (wbOn > 10 ? 6.0 : 0);
    edSetText('ed-wb-kwpeak', kwPeakKpi > 0 ? kwPeakKpi.toFixed(1) : '—');
    edSetText('ed-wb-kwmed',  kwPeakKpi > 0 ? (kwPeakKpi * 0.55).toFixed(1) : '—');
    edSetText('ed-wb-sess', wbOn > 5 ? Math.round(wbOn / 7) + '' : '—');
}

// ─────────────────────────────────────────────────────────────────────
// Calcola il bilancio annuale: totale € pagati e € risparmiati dall'inizio dell'anno
// Usa le Long-Term Statistics per sommare cons + prelevato di tutti i mesi dell'anno
// ─────────────────────────────────────────────────────────────────────
async function edCalcolaBilancioAnno(selYear) {
    const yearLbl   = document.getElementById('ed-year-summary-year');
    const pagatoEl  = document.getElementById('ed-year-pagato');
    const pagatoSub = document.getElementById('ed-year-pagato-sub');
    const rispEl    = document.getElementById('ed-year-risparmio');
    const rispSub   = document.getElementById('ed-year-risparmio-sub');
    if (!pagatoEl) return;
    
    if (yearLbl) yearLbl.textContent = selYear;
    pagatoEl.textContent = '⏳ —';
    rispEl.textContent   = '⏳ —';
    
    const now = new Date();
    const isCurrentYear = selYear === now.getFullYear();
    
    // Periodo: dal 1° gennaio dell'anno selezionato al 1° gennaio dell'anno successivo
    const tStart = new Date(selYear, 0, 1).toISOString();
    const tEnd   = isCurrentYear
        ? now.toISOString()
        : new Date(selYear + 1, 0, 1).toISOString();
    
    let consAnno = 0, prelevatoAnno = 0;
    
    try {
        // Chiedo dati MESE per MESE, prendo il 'change' di ciascuno (delta del periodo) e sommo
        /* v0.8.1: all year sensors; if consumption is missing, estimate it from the energy balance */
        const S = ED_SENSORS_CURR;
        const sensors = [S.cons, S.prelevato, S.prod, S.immesso, S.batCarico, S.batScarico];
        const stats   = await fetchHAStatistics(sensors, tStart, tEnd, 'month');
        
        const sumChange = (sensorId) => {
            const arr = stats[sensorId];
            if (!Array.isArray(arr) || arr.length === 0) return 0;
            let total = 0;
            arr.forEach(item => {
                // Priorità: change (delta del periodo), poi max, poi state
                let v = 0;
                if (item.change !== null && item.change !== undefined && !isNaN(item.change)) v = item.change;
                else if (item.max !== null && item.max !== undefined && !isNaN(item.max)) v = item.max;
                else if (item.state !== null && item.state !== undefined && !isNaN(item.state)) v = item.state;
                if (v > 0) total += v;
            });
            return total;
        };
        consAnno      = sumChange(ED_SENSORS_CURR.cons);
        prelevatoAnno = sumChange(ED_SENSORS_CURR.prelevato);
        if (consAnno <= 0) {
            const stima = sumChange(S.prod) - sumChange(S.immesso) + prelevatoAnno + sumChange(S.batScarico) - sumChange(S.batCarico);
            if (stima > 0.5) consAnno = Math.round(stima * 10) / 10;
        }
    } catch(e) {
        console.warn('[ED] Bilancio anno - statistics non disponibile:', e.message);
    }

    /* v0.8.1: if yearly statistics yield nothing but the current month does (period engine),
       the year starts at least from current-month data instead of "No data". */
    if (isCurrentYear && consAnno <= 0 && prelevatoAnno <= 0) {
        try {
            prelevatoAnno = cdPNum(ED_SENSORS_CURR.prelevato) || 0;
            const _c = cdPNum(ED_SENSORS_CURR.cons) || 0;
            if (_c > 0) consAnno = _c;
        } catch(e) {}
    }
    
    // Calcoli economici
    const pagatoAnno    = prelevatoAnno * COSTO_KWH;
    const senzaFvAnno   = consAnno * COSTO_KWH;
    const risparmioAnno = Math.max(0, senzaFvAnno - pagatoAnno);
    
    if (pagatoAnno > 0 || risparmioAnno > 0) {
        pagatoEl.textContent  = pagatoAnno.toFixed(2) + ' €';
        pagatoSub.textContent = prelevatoAnno.toFixed(0) + ' kWh dalla rete';
        rispEl.textContent    = risparmioAnno.toFixed(2) + ' €';
        rispSub.textContent   = 'su ' + consAnno.toFixed(0) + ' kWh consumati';
    } else {
        pagatoEl.textContent  = '— €';
        pagatoSub.textContent = 'Dati non disponibili';
        rispEl.textContent    = '— €';
        rispSub.textContent   = '';
    }
}

async function edAggiornaCipYoY(selMonth, selYear, prodCorrente, consCorrente, prelevato) {
    const yoyEl = document.getElementById('ed-yoy-chips');
    if (!yoyEl) return;

    // Mostra subito il prelevato (non richiede History)
    const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                        'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    const labelMesePrec = monthNames[selMonth - 1] + ' ' + (selYear - 1);

    // Segnaposto durante il caricamento
    yoyEl.innerHTML = `<span class="ed-yoy-chip solar" style="opacity:0.5;">☀️ ...</span>
                       <span class="ed-yoy-chip home" style="opacity:0.5;">🏠 ...</span>` +
                      (prelevato > 0 ? `<span class="ed-yoy-chip grid">⚡ ${prelevato.toFixed(0)} kWh Rete</span>` : '');

    try {
        // Stesso mese dell'anno precedente
        const tStart = new Date(selYear - 1, selMonth - 1, 1).toISOString();
        const tEnd   = new Date(selYear - 1, selMonth, 1).toISOString();
        const sensors = ED_SENSORS_CURR.prod + ',' + ED_SENSORS_CURR.cons;

        const res = await fetch(
            `${HA_HTTP_URL}/api/history/period/${tStart}?filter_entity_id=${sensors}&minimal_response&end_time=${tEnd}`,
            { headers: { 'Authorization': `Bearer ${LONG_LIVED_TOKEN}` } }
        );

        let prodPrec = 0, consPrec = 0;

        if (res.ok) {
            const json = await res.json();
            // Prende l'ultimo valore disponibile del periodo (cumulativo fine mese)
            const lastVal = (arr) => {
                if (!arr || arr.length === 0) return 0;
                const last = [...arr].reverse().find(d => d.state !== 'unknown' && d.state !== 'unavailable');
                return last ? (parseFloat(last.state) || 0) : 0;
            };
            prodPrec = lastVal(json[0]);
            consPrec = lastVal(json[1]);
        }

        let chips = '';

        // Chip produzione solare
        if (prodPrec > 0) {
            const diff = ((prodCorrente - prodPrec) / prodPrec * 100).toFixed(0);
            chips += `<span class="ed-yoy-chip solar">☀️ ${diff > 0 ? '+' : ''}${diff}% vs ${labelMesePrec}</span>`;
        } else if (prodCorrente > 0) {
            chips += `<span class="ed-yoy-chip solar">☀️ ${prodCorrente.toFixed(0)} kWh</span>`;
        }

        // Chip consumo
        if (consPrec > 0) {
            const diff = ((consCorrente - consPrec) / consPrec * 100).toFixed(0);
            chips += `<span class="ed-yoy-chip home">🏠 ${diff > 0 ? '+' : ''}${diff}% Consumo</span>`;
        } else if (consCorrente > 0) {
            chips += `<span class="ed-yoy-chip home">🏠 ${consCorrente.toFixed(0)} kWh</span>`;
        }

        // Chip rete
        if (prelevato > 0) {
            chips += `<span class="ed-yoy-chip grid">⚡ ${prelevato.toFixed(0)} kWh da Rete</span>`;
        }

        yoyEl.innerHTML = chips || '';

    } catch(e) {
        console.warn('YoY fetch error:', e.message);
        // Fallback senza confronto
        let chips = '';
        if (prodCorrente > 0) chips += `<span class="ed-yoy-chip solar">☀️ ${prodCorrente.toFixed(0)} kWh prodotti</span>`;
        if (prelevato > 0)    chips += `<span class="ed-yoy-chip grid">⚡ ${prelevato.toFixed(0)} kWh da Rete</span>`;
        yoyEl.innerHTML = chips;
    }
}

async function edCalcolaSettimanale(selMonth, selYear, isCurrentMonth) {
    /* v0.7.5: "this week / last week" only makes sense in the current month —
       for past months the card showed 0.0/0.0: it is now hidden. */
    const wkCard = document.querySelector('.ed-weekly-card');
    if (wkCard) wkCard.style.display = isCurrentMonth ? '' : 'none';
    if (!isCurrentMonth) return;
    // Imposta label caricamento
    edSetText('ed-w-prev-val', '...');
    edSetText('ed-w-curr-val', '...');

    // Calcola date: questa settimana (lun-oggi) e settimana scorsa (lun-dom precedente)
    const now       = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=lun, 7=dom
    const lunedi    = new Date(now); lunedi.setDate(now.getDate() - dayOfWeek + 1); lunedi.setHours(0,0,0,0);
    const lunediPrec = new Date(lunedi); lunediPrec.setDate(lunedi.getDate() - 7);
    const domenicaPrec = new Date(lunedi); domenicaPrec.setDate(lunedi.getDate() - 1); domenicaPrec.setHours(23,59,59,0);

    // Per mesi precedenti usa l'ultimo giorno del mese come riferimento
    const refDate = isCurrentMonth ? now : new Date(selYear, selMonth, 0); // ultimo giorno del mese

    // Ricalcola le settimane rispetto al mese selezionato
    const refDay    = refDate.getDay() === 0 ? 7 : refDate.getDay();
    const refLun    = new Date(refDate); refLun.setDate(refDate.getDate() - refDay + 1); refLun.setHours(0,0,0,0);
    const refLunPre = new Date(refLun); refLunPre.setDate(refLun.getDate() - 7);
    const refDomPre = new Date(refLun); refDomPre.setDate(refLun.getDate() - 1); refDomPre.setHours(23,59,59,0);

    /* v299 (issue #6): il sensore passa dalle sostituzioni dell'utente; se la produzione
       non è configurata si usa il consumo giornaliero; se nulla è configurato → "—". */
    const _cands = ['dm.energy_produzione_solare_oggi', 'dm.energy_consumo_casa_oggi'];
    let sensor = null;
    for (const _r of _cands) {
        const _m = (typeof ENTITY_OVERRIDES !== 'undefined' && ENTITY_OVERRIDES[_r]) || null;
        if (_m) { sensor = _m; break; }
        if (!(typeof CD_REQUIRE_MAPPING !== 'undefined' && CD_REQUIRE_MAPPING)) { sensor = _r; break; }
    }
    if (!sensor) { edSetText('ed-w-prev-val', '—'); edSetText('ed-w-curr-val', '—'); return; }

    // Somma kWh di un periodo da History
    const sumPeriod = async (start, end) => {
        try {
            const res = await fetch(
                `${HA_HTTP_URL}/api/history/period/${start.toISOString()}?filter_entity_id=${sensor}&minimal_response&end_time=${end.toISOString()}`,
                { headers: { 'Authorization': `Bearer ${LONG_LIVED_TOKEN}` } }
            );
            if (!res.ok) return null;
            const json = await res.json();
            const arr  = json[0] || [];
            // Ogni giorno: prendi il valore max (cumulativo fine giornata)
            const byDay = {};
            arr.forEach(d => {
                if (d.state === 'unknown' || d.state === 'unavailable') return;
                const day = new Date(d.last_changed).toDateString();
                const v   = parseFloat(d.state) || 0;
                if (!byDay[day] || v > byDay[day]) byDay[day] = v;
            });
            return Object.values(byDay).reduce((s, v) => s + v, 0);
        } catch(e) { return null; }
    };

    const [wCurr, wPrev] = await Promise.all([
        sumPeriod(refLun,    refDate),
        sumPeriod(refLunPre, refDomPre)
    ]);

    const safeWCurr = wCurr ?? 0;
    const safeWPrev = wPrev ?? 0;
    const wMax = Math.max(safeWPrev, safeWCurr, 1);
    const wPrevPct = (safeWPrev / wMax * 100).toFixed(1);
    const wCurrPct = (safeWCurr / wMax * 100).toFixed(1);

    edSetText('ed-w-prev-val', safeWPrev.toFixed(1) + ' kWh');
    edSetText('ed-w-curr-val', safeWCurr.toFixed(1) + ' kWh');

    const prevBar = document.getElementById('ed-w-prev-bar');
    const currBar = document.getElementById('ed-w-curr-bar');
    if (prevBar) prevBar.dataset.w = wPrevPct;
    if (currBar) currBar.dataset.w = wCurrPct;

    // Anima se il pane è visibile
    const anaPane = document.getElementById('ed-pane-analisi');
    if (anaPane && anaPane.style.display !== 'none') {
        setTimeout(() => {
            if (prevBar) prevBar.style.width = wPrevPct + '%';
            if (currBar) currBar.style.width = wCurrPct + '%';
        }, 60);
    }

    const wDiff   = safeWPrev > 0 ? ((safeWCurr - safeWPrev) / safeWPrev * 100).toFixed(1) : null;
    const wDiffEl = document.getElementById('ed-w-diff');
    if (wDiffEl) {
        if (wDiff !== null) {
            wDiffEl.className   = 'ed-weekly-diff ' + (parseFloat(wDiff) >= 0 ? 'pos' : 'neg');
            wDiffEl.textContent = (parseFloat(wDiff) >= 0 ? '+' : '') + wDiff + '%';
        } else {
            wDiffEl.className   = 'ed-weekly-diff';
            wDiffEl.textContent = '—';
        }
    }

    // Mostra anche la riga "Scorsa: X kWh" sotto la barra
    const prevNote = document.getElementById('ed-w-prev-note');
    if (prevNote && safeWPrev > 0) prevNote.textContent = 'Scorsa ' + safeWPrev.toFixed(1) + ' kWh';
}

function edSwitchTab(tab) {
    const isPan = tab === 'panoramica';
    document.getElementById('ed-pane-panoramica').style.display = isPan ? 'block' : 'none';
    document.getElementById('ed-pane-analisi').style.display    = isPan ? 'none'  : 'block';
    document.getElementById('ed-tab-pan').classList.toggle('active', isPan);
    document.getElementById('ed-tab-ana').classList.toggle('active', !isPan);
    // Quando si apre Analisi, anima tutte le barre con i valori già salvati in dataset.w
    if (!isPan) {
        setTimeout(() => {
            document.querySelectorAll('[data-w]').forEach(bar => {
                if (bar.dataset.w) bar.style.width = bar.dataset.w + '%';
            });
        }, 60);
    }
}

function edSetText(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

async function renderEnergyDashboard() {
    if (Object.keys(STATES).length === 0) return;

    const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                        'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

    // Inizializza select al mese/anno corrente la prima volta
    const selMonthEl = document.getElementById('ed-sel-month');
    const selYearEl  = document.getElementById('ed-sel-year');
    if (selMonthEl && !selMonthEl.dataset.init) {
        selMonthEl.value = new Date().getMonth() + 1;
        selYearEl.value  = new Date().getFullYear();
        selMonthEl.dataset.init = '1';
    }

    const selMonth    = parseInt(selMonthEl?.value || new Date().getMonth() + 1);
    const selYear     = parseInt(selYearEl?.value  || new Date().getFullYear());
    const nowMonth    = new Date().getMonth() + 1;
    const nowYear     = new Date().getFullYear();
    const isCurrentMonth = (selMonth === nowMonth && selYear === nowYear);
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();

    edSetText('ed-month-title', monthNames[selMonth - 1] + ' ' + selYear);

    // Periodo label per dispositivi
    const periodLabel = isCurrentMonth ? 'Mese in corso' : monthNames[selMonth-1] + ' ' + selYear;
    edSetText('ed-dev-period-label', periodLabel);

    let prod=0, cons=0, immesso=0, prelevato=0, batCar=0, batScar=0, wbOn=0;

    if (isCurrentMonth) {
        // ── CURRENT MONTH: period engine (delta from the 1st) ──
        // v0.9.3 FIX: if the period engine hasn't computed consumption yet (CD_PERIOD empty on
        // first load), force it and WAIT — otherwise cdPNum would fall back to the raw filtered
        // counter value, giving a number different from the map (e.g. 393 instead of 464).
        if (typeof CD_PERIOD !== 'undefined' && CD_PERIOD[ED_SENSORS_CURR.cons] === undefined) {
            try {
                await cdRefreshPeriodDeltas(true);
                let _w = 0;
                while (CD_PERIOD[ED_SENSORS_CURR.cons] === undefined && _w < 6000) { await new Promise(r => setTimeout(r, 300)); _w += 300; }
            } catch(e) {}
        }
        prod      = cdPNum(ED_SENSORS_CURR.prod);
        cons      = cdPNum(ED_SENSORS_CURR.cons);
        immesso   = cdPNum(ED_SENSORS_CURR.immesso);
        prelevato = cdPNum(ED_SENSORS_CURR.prelevato);
        batCar    = cdPNum(ED_SENSORS_CURR.batCarico);
        batScar   = cdPNum(ED_SENSORS_CURR.batScarico);
        wbOn      = cdPNum(ED_SENSORS_CURR.wbOn);
    } else {
        // ── MESE PRECEDENTE: usa Long-Term Statistics (i dati persistono per anni, non purgati) ─
        const tStart = new Date(selYear, selMonth-1, 1).toISOString();
        const tEnd   = new Date(selYear, selMonth, 1).toISOString();   // primo del mese dopo
        const allSensorsList = [
            ED_SENSORS_CURR.prod, ED_SENSORS_CURR.cons,
            ED_SENSORS_CURR.immesso, ED_SENSORS_CURR.prelevato,
            ED_SENSORS_CURR.batCarico, ED_SENSORS_CURR.batScarico,
            ED_SENSORS_CURR.wbOn
        ];
        
        // Mostra stato di caricamento
        edSetText('ed-kpi-prod', '⏳ <small>kWh</small>');
        edSetText('ed-kpi-cons', '⏳ <small>kWh</small>');
        
        let statsOk = false;
        
        // ── METODO 1: Long-Term Statistics — strategia per utility_meter mensili ──
        // Per sensori utility_meter (state_class:total con last_reset), HA registra:
        //   - 'change' = delta del periodo (es. consumo/produzione del mese) ← QUESTO È IL VALORE CORRETTO
        //   - 'state'  = ultimo valore registrato
        //   - 'sum'    = somma cumulativa LIFETIME (cresce sempre, NON usabile direttamente)
        //   - 'max'    = massimo raggiunto (utile come fallback)
        try {
            // v0.9.4: period:'day' con finestra che parte 1 GIORNO PRIMA del mese, così ho
            // il valore cumulativo di partenza. L'energia del mese = (sum ultimo giorno) − (sum
            // del giorno prima dell'inizio). È il metodo del pannello Energy di HA, esatto sui
            // contatori totali. period:'month' dava valori dimezzati/errati su alcuni contatori.
            const tStartBase = new Date(selYear, selMonth-1, 1);
            tStartBase.setDate(tStartBase.getDate() - 2);
            const stats = await fetchHAStatistics(allSensorsList, tStartBase.toISOString(), tEnd, 'day');
            const _monthStartMs = new Date(selYear, selMonth-1, 1).getTime();
            const _monthEndMs   = new Date(selYear, selMonth, 1).getTime();
            
            /* v0.9.2 FIX DEFINITIVO per contatori TOTALI cumulativi.
               HA registra per ogni bucket orario: sum = valore CUMULATIVO del contatore a fine ora.
               L'energia del mese = (sum dell'ultima ora del mese) − (sum PRIMA dell'inizio mese).
               Questo è ESATTAMENTE come il pannello Energy di HA calcola i totali, e con contatori
               che crescono sempre dà il valore giusto e diverso per ogni mese.
               Fallback: somma dei 'change' (per utility_meter mensili), poi differenza di 'state'. */
            /* v0.9.2: con period:'month' HA restituisce UN bucket per il mese con
               change = energia del mese (delta già calcolato). Per contatori TOTALI cumulativi
               questo è il valore corretto. Se arrivano più bucket, uso la differenza dei 'sum'
               cumulativi (ultimo − primo bucket) che equivale all'energia del periodo. */
            /* v0.9.4: energia del mese = differenza dei valori CUMULATIVI (sum) tra l'ultimo
               e il primo bucket giornaliero che ricadono nel mese selezionato. Con contatori
               TOTALI che crescono sempre questo dà il delta esatto del mese (come il pannello HA).
               Fallback progressivi: somma dei change nel mese, poi differenza di state. */
            const getStatVal = (sensorId) => {
                const arr = stats[sensorId];
                if (!Array.isArray(arr) || arr.length === 0) return 0;
                const tms = (p) => (typeof p.start === 'number' ? p.start : Date.parse(p.start));
                // punti dal giorno-baseline (subito prima del mese) fino a fine mese
                const pts = arr.filter(p => { const t = tms(p); return !isNaN(t) && t < _monthEndMs; })
                               .sort((a,b) => tms(a) - tms(b));
                if (!pts.length) return 0;
                // baseline = ultimo sum PRIMA dell'inizio mese (o il primo disponibile)
                const before = pts.filter(p => tms(p) < _monthStartMs);
                const inMonth = pts.filter(p => tms(p) >= _monthStartMs);
                const sumOf = (p) => (p && p.sum !== null && p.sum !== undefined && !isNaN(p.sum)) ? parseFloat(p.sum) : null;
                // 1) differenza dei sum cumulativi
                const baseP = before.length ? before[before.length-1] : (inMonth.length ? inMonth[0] : null);
                const lastP = inMonth.length ? inMonth[inMonth.length-1] : null;
                const sBase = sumOf(baseP), sLast = sumOf(lastP);
                if (sBase !== null && sLast !== null) { const d = sLast - sBase; if (d >= 0 && d < 100000) return Math.round(d*10)/10; }
                // 2) somma dei change dei soli bucket nel mese
                let tot = 0, any = false;
                inMonth.forEach(p => { if (p.change !== null && p.change !== undefined && !isNaN(p.change)) { tot += p.change; any = true; } });
                if (any && tot >= 0) return Math.round(tot*10)/10;
                // 3) differenza di state
                const st = inMonth.map(p => parseFloat(p.state)).filter(v => !isNaN(v));
                if (st.length >= 2) { const d = st[st.length-1] - st[0]; return d > 0 ? Math.round(d*10)/10 : 0; }
                return 0;
            };
            prod      = getStatVal(ED_SENSORS_CURR.prod);
            cons      = getStatVal(ED_SENSORS_CURR.cons);
            immesso   = getStatVal(ED_SENSORS_CURR.immesso);
            prelevato = getStatVal(ED_SENSORS_CURR.prelevato);
            batCar    = getStatVal(ED_SENSORS_CURR.batCarico);
            batScar   = getStatVal(ED_SENSORS_CURR.batScarico);
            wbOn      = getStatVal(ED_SENSORS_CURR.wbOn);
            /* v0.9.2: le statistiche sono valide solo se danno numeri plausibili.
               Se prod/cons sono 0 o palesemente fuori scala (>20000 kWh/mese = errore di lettura
               del cumulativo), lascio statsOk=false così parte il fallback History col delta. */
            const _plausibile = (v) => v > 0 && v < 20000;
            statsOk   = (_plausibile(prod) || _plausibile(cons)) && prod < 20000 && cons < 20000;
        } catch(e) {
            console.warn('[ED] Statistics fallita:', e.message);
        }
        
        // ── METODO 2: History API (fallback - max ultimi 10 giorni) ──
        if (!statsOk) {
            const allSensors = allSensorsList.map(r => { try { return resolveEntity(r); } catch(e) { return r; } }).join(',');
            try {
                // v0.9.4: parto qualche ora PRIMA del mese per avere il valore cumulativo di partenza
                const _histStart = new Date(selYear, selMonth-1, 1);
                _histStart.setHours(_histStart.getHours() - 6);
                const res = await fetch(
                    `${HA_HTTP_URL}/api/history/period/${_histStart.toISOString()}?filter_entity_id=${allSensors}&minimal_response&end_time=${tEnd}`,
                    { headers: { "Authorization": `Bearer ${LONG_LIVED_TOKEN}` } }
                );
                if (res.ok) {
                    const json = await res.json();
                    /* v0.9.2 FIX: per contatori TOTALI cumulativi l'energia del mese è
                       (ultimo valore del mese) − (primo valore del mese), NON l'ultimo valore
                       (che è il cumulativo lifetime). Il vecchio codice prendeva solo l'ultimo
                       → valori enormi/raddoppiati. */
                    const deltaVal = (arr) => {
                        if (!arr || arr.length === 0) return 0;
                        const valid = arr.filter(d => d.state !== 'unknown' && d.state !== 'unavailable' && !isNaN(parseFloat(d.state)));
                        if (valid.length === 0) return 0;
                        const first = parseFloat(valid[0].state);
                        const last  = parseFloat(valid[valid.length - 1].state);
                        const d = last - first;
                        return (d >= 0 && d < 100000) ? d : 0;
                    };
                    // la History può restituire i sensori in ordine diverso: mappo per entity_id
                    const byId = {};
                    (json || []).forEach(arr => { if (arr && arr[0] && arr[0].entity_id) byId[arr[0].entity_id] = arr; });
                    const dv = (ref) => deltaVal(byId[resolveEntity(ref)] || []);
                    prod      = dv(ED_SENSORS_CURR.prod);
                    cons      = dv(ED_SENSORS_CURR.cons);
                    immesso   = dv(ED_SENSORS_CURR.immesso);
                    prelevato = dv(ED_SENSORS_CURR.prelevato);
                    batCar    = dv(ED_SENSORS_CURR.batCarico);
                    batScar   = dv(ED_SENSORS_CURR.batScarico);
                    wbOn      = dv(ED_SENSORS_CURR.wbOn);
                    statsOk   = (prod > 0 || cons > 0);
                }
            } catch(e) { console.error('History fetch error:', e); }
        }
    }

    /* v0.9.5 DEFINITIVE FIX: HOME as HA's Energy panel and the Monthly map.
       Home consumption = solar − exported + imported + battery discharged − battery charged.
       The direct sensor often measures only part of the circuits: the energy balance gives the
       real TOTAL consumption, identical to HA. Balance used when main pieces exist; sensor is fallback. */
    try {
        if (prod > 0 || prelevato > 0 || immesso > 0) {
            const _bal = prod - immesso + prelevato + batScar - batCar;
            if (_bal >= 0 && _bal < 100000) cons = Math.round(_bal * 10) / 10;
        }
    } catch(e) {}

    /* v0.7.5 (#6): DATA COHERENCE — if total consumption is unavailable but the rest is,
       derive it from the energy balance:
       consumption = produced − exported + imported + battery discharged − battery charged.
       This makes self-sufficiency, "Without PV", savings and the ☀️/🔌 device split
       coherent instead of staying at zero. */
    let consStimato = false;
    if (cons <= 0 && (prod > 0 || prelevato > 0)) {
        const stima = prod - immesso + prelevato + batScar - batCar;
        if (stima > 0.5) { cons = Math.round(stima * 10) / 10; consStimato = true; }
    }

    // ── Calcoli derivati ─────────────────────────────────────────
    const autosufficienza = cons > 0 ? Math.min(100, Math.round(((cons - prelevato) / cons) * 100)) : 0;
    const autoconsumo     = Math.max(0, prod - immesso);     // kWh solari usati in casa
    const senzaFV         = cons * COSTO_KWH;                // € che avresti pagato senza FV
    const costoEffettivo  = prelevato * COSTO_KWH;           // € pagati realmente alla rete
    const risparmio       = Math.max(0, senzaFV - costoEffettivo);  // € risparmiati = senzaFV - costoReale
    const co2             = prod * VALORE_CO2;
    const batEff          = batCar > 0 ? Math.round((batScar / batCar) * 100) : 0;

    // Banner KPI verde
    edSetText('ed-kpi-prod', prod.toFixed(0) + ' <small>kWh</small>');
    edSetText('ed-kpi-cons', (consStimato ? '≈' : '') + cons.toFixed(0) + ' <small>kWh</small>');
    edSetText('ed-kpi-auto', autosufficienza  + ' <small>%</small>');

    // Griglia finanziaria — ordine narrativo: senza FV → costo reale → risparmio → venduto → CO₂
    edSetText('ed-fin-pagato', senzaFV.toFixed(2) + ' €');
    edSetText('ed-fin-pagato-sub', cons.toFixed(0) + ' kWh × 0.25€');
    edSetText('ed-fin-costo',  costoEffettivo.toFixed(2) + ' €');
    edSetText('ed-fin-costo-sub', prelevato.toFixed(1) + ' kWh × 0.25€');
    edSetText('ed-fin-risp',   risparmio.toFixed(2) + ' €');
    edSetText('ed-fin-risp-sub', 'Grazie al fotovoltaico');
    edSetText('ed-fin-imm',    (immesso * 0.10).toFixed(2) + ' €');
    edSetText('ed-fin-imm-sub', immesso.toFixed(1) + ' kWh × 0.10€');
    edSetText('ed-fin-co2',    co2.toFixed(0) + ' kg');
    edSetText('ed-fin-co2-sub', '≈ ' + Math.round(co2 / 22) + ' alberi/anno');

    // Ring autosufficienza
    const circumference = 2 * Math.PI * 32;
    const dash = (autosufficienza / 100) * circumference;
    const circle = document.getElementById('ed-auto-circle');
    if (circle) circle.setAttribute('stroke-dasharray', dash.toFixed(1) + ' ' + circumference.toFixed(1));
    edSetText('ed-auto-ring-val', autosufficienza + '%');
    edSetText('ed-auto-big', autosufficienza + '%');

    // ── Chip confronto mese precedente anno scorso ─────────────
    edAggiornaCipYoY(selMonth, selYear, prod, cons, prelevato);
    
    // ── Bilancio Anno: totale pagato + risparmiato dall'inizio dell'anno ──
    edCalcolaBilancioAnno(selYear);

    // ── Badge ────────────────────────────────────────────────────
    const badgesEl = document.getElementById('ed-badges');
    if (badgesEl) {
        const deficit = Math.max(0, cons - prod).toFixed(0);
        badgesEl.innerHTML =
            `<span class="ed-badge green">✅ ${autosufficienza}% Autosufficiente</span>` +
            (parseFloat(deficit) > 0
                ? `<span class="ed-badge red">⚠️ -${deficit} kWh deficit</span>`
                : `<span class="ed-badge green">🎯 Zero deficit</span>`) +
            `<span class="ed-badge blue">⚡ ${prod.toFixed(0)} kWh prodotti</span>`;
        /* v0.8.1: past month with no statistics at all → honest note instead of confident zeros */
        if (!isCurrentMonth && prod <= 0 && cons <= 0 && prelevato <= 0) {
            badgesEl.innerHTML = '<span class="ed-badge" style="background:rgba(245,158,11,0.14); color:#b45309;">⚠️ No statistics available for this month</span>';
        }
    }

    // ── Wallbox ──────────────────────────────────────────────────
    edSetText('ed-wb-on',  wbOn.toFixed(1) + ' kWh');
    // kW picco: potenza attuale se sta caricando, altrimenti stima da kWh mensili
    const kwNow  = isCurrentMonth ? (parseFloat(getRawState(ED_SENSORS_CURR.wbKwPeak)) || 0) : 0;
    // Stima picco: per una Wallbox 7.4kW, la sessione media è ~6kW
    const kwPeak = kwNow > 0.5 ? kwNow : (wbOn > 10 ? 6.0 : 0);
    edSetText('ed-wb-kwpeak', kwPeak > 0 ? kwPeak.toFixed(1) : '—');
    edSetText('ed-wb-kwmed',  kwPeak > 0 ? (kwPeak * 0.55).toFixed(1) : '—');
    // Sessioni: stima ~7 kWh per sessione (ricarica media da 20% a 80% su ~40kWh)
    edSetText('ed-wb-sess', wbOn > 5 ? Math.round(wbOn / 7) + '' : '—');

    // ── Confronto settimanale via History API ───────────────────
    edCalcolaSettimanale(selMonth, selYear, isCurrentMonth);

    // ── Lista dispositivi ────────────────────────────────────────
    await renderEdDeviceList(selMonth, selYear, isCurrentMonth, cons, prelevato, prod);

    // ── Grafico giornaliero ──────────────────────────────────────
    await renderEdDailyChart(daysInMonth, selMonth, selYear, isCurrentMonth, prod, cons);
    
    // ── Aggiorna dispositivo selezionato (tab Analisi) ──────────
    // Se un dispositivo è già stato selezionato, ricarica i suoi dati per il nuovo periodo
    const devSel = document.getElementById('ed-dev-selector');
    if (devSel && devSel.value) {
        edCaricaDettaglio();
    }
}

async function renderEdDeviceList(selMonth, selYear, isCurrentMonth, cons = 0, prelevato = 0, prodM = 0) {
    const list = document.getElementById('ed-device-list');
    if (!list) return;

    // % di autoconsumo della casa (es. 99% = quasi tutto da FV, 1% da rete)
    // La stessa proporzione si applica per stima a tutti i dispositivi
    const autoconsumoPct = cons > 0 ? Math.max(0, Math.min(1, (cons - prelevato) / cons)) : 1;
    const retePct        = 1 - autoconsumoPct;
    
    let devValues = {};

    if (isCurrentMonth) {
        // Lettura diretta da STATES
        /* v304: il valore del mese è il DELTA dall'inizio del mese, non lo stato attuale.
           Con entità mensili (che ripartono da ~0) il risultato è identico a prima;
           con entità TOTALI cumulative diventa finalmente corretto. */
        if (!ED_DEVICES.length) {
            list.innerHTML = '<div style="text-align:center; padding:26px; color:var(--text-dim); font-weight:800;">📊 Aggiungi i tuoi dispositivi da ⚙️ → Configure Entities → Carichi → "Report Analisi — voci"<br><span style="font-weight:600; font-size:12px;">You can use monthly entities or cumulative TOTALS: months are computed automatically.</span></div>';
            return;
        }
        ED_DEVICES.forEach(d => { devValues[d.key] = parseFloat(getRawState(d.sensor)) || 0; });
        try {
            const mStart = new Date(selYear, selMonth-1, 1).toISOString();
            const ids = ED_DEVICES.map(d => d.sensor).join(',');
            const res = await fetch(`${HA_HTTP_URL}/api/history/period/${mStart}?filter_entity_id=${ids}&minimal_response&no_attributes`,
                { headers: { 'Authorization': `Bearer ${LONG_LIVED_TOKEN}` } });
            if (res.ok) {
                const json = await res.json();
                const baseOf = {};
                (json || []).forEach(arr => {
                    const first = (arr || []).find(x => x.state !== 'unknown' && x.state !== 'unavailable');
                    if (first && arr[0]) baseOf[arr[0].entity_id] = parseFloat(first.state);
                });
                ED_DEVICES.forEach(d => {
                    const base = baseOf[d.sensor];
                    const cur = devValues[d.key];
                    if (!isNaN(base) && base >= 0 && cur >= base) devValues[d.key] = +(cur - base).toFixed(1);
                });
            }
        } catch(e) { console.warn('[Report] delta mese:', e); }
    } else {
        // Mese passato: provo Long-Term Statistics (non purgate), poi history come fallback
        const tStart = new Date(selYear, selMonth-1, 1).toISOString();
        const tEnd   = new Date(selYear, selMonth, 1).toISOString();
        const sensorIds = ED_DEVICES.map(d => d.sensor);
        list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-dim);font-weight:800;">⏳ Caricamento dati storici...</div>';
        
        let statsOk = false;
        
        // ── METODO 1: Long-Term Statistics ──
        try {
            const stats = await fetchHAStatistics(sensorIds, tStart, tEnd, 'month');
            const getStatVal = (id) => {
                const arr = stats[id];
                if (!Array.isArray(arr) || arr.length === 0) return 0;
                let v = 0;
                arr.forEach(item => {
                    if (item.change !== null && item.change !== undefined && !isNaN(item.change) && item.change > v) v = item.change;
                    else if (v === 0 && item.max !== null && item.max !== undefined && !isNaN(item.max)) v = item.max;
                    else if (v === 0 && item.state !== null && item.state !== undefined && !isNaN(item.state)) v = item.state;
                });
                return v;
            };
            ED_DEVICES.forEach(d => devValues[d.key] = getStatVal(d.sensor));
            statsOk = Object.values(devValues).some(v => v > 0);
        } catch(e) {
            console.warn('[ED Device List] Statistics fallita:', e.message);
        }
        
        // ── METODO 2: History API (fallback - max 10 giorni) ──
        if (!statsOk) {
            const sensors = sensorIds.join(',');
            try {
                const res = await fetch(
                    `${HA_HTTP_URL}/api/history/period/${tStart}?filter_entity_id=${sensors}&minimal_response&end_time=${tEnd}`,
                    { headers: { "Authorization": `Bearer ${LONG_LIVED_TOKEN}` } }
                );
                if (res.ok) {
                    const json = await res.json();
                    ED_DEVICES.forEach((d, i) => {
                        const arr = json[i] || [];
                        const valid = arr.filter(x => x.state !== 'unknown' && x.state !== 'unavailable');
                        const last = valid[valid.length - 1], first = valid[0];
                        // v304: delta nel mese (corretto anche per entità TOTALI cumulative)
                        const lv = last ? parseFloat(last.state) : NaN, fv = first ? parseFloat(first.state) : NaN;
                        devValues[d.key] = !isNaN(lv) ? (!isNaN(fv) && lv >= fv ? +(lv - fv).toFixed(1) : lv) : 0;
                    });
                }
            } catch(e) {
                console.error('[ED Device List] History error:', e);
                ED_DEVICES.forEach(d => devValues[d.key] = 0);
            }
        }
    }

    let maxVal = 0;
    const devData = ED_DEVICES.map(d => {
        const v = devValues[d.key] || 0;
        if (v > maxVal) maxVal = v;
        // Calcoli per ogni carico
        const kwhFV     = v * autoconsumoPct;
        const kwhRete   = v * retePct;
        const costoRete = kwhRete * COSTO_KWH;        // € pagati per questo carico (solo quota rete)
        const risparmio = kwhFV * COSTO_KWH;          // € risparmiati grazie al FV su questo carico
        return { ...d, val: v, cost: +(v * COSTO_KWH).toFixed(2), kwhFV, kwhRete, costoRete, risparmio };
    }).sort((a, b) => b.val - a.val);

    const totalKwh    = devData.reduce((s, d) => s + d.val, 0);
    const totalEur    = devData.reduce((s, d) => s + d.cost, 0);
    edSetText('ed-dev-total', totalKwh.toFixed(1) + ' kWh &nbsp;|&nbsp; € ' + totalEur.toFixed(2));

    /* v0.7.5: if the selected month has neither production nor main consumption but device
       meters report energy, flag it: those deltas may include earlier periods. */
    const _warn = (!isCurrentMonth && cons <= 0 && prodM <= 0 && totalKwh > 0)
        ? '<div style="padding:10px 14px; margin-bottom:8px; border-radius:14px; background:rgba(245,158,11,0.12); color:#b45309; font-size:11.5px; font-weight:700;">⚠️ Main production and consumption unavailable for this month: the values below come from meter history and may include earlier periods.</div>'
        : '';
    list.innerHTML = _warn + devData.map(d => {
        const pct = maxVal > 0 ? (d.val / maxVal * 100).toFixed(1) : 0;
        return `
        <div class="ed-device-row" onclick="apriStorico(event,'${d.sensor}','${d.name}')">
            <div class="ed-dev-icon" style="background:${d.bg};">${d.icon}</div>
            <div class="ed-dev-name">
              ${d.name}
              <div style="font-size:10px; font-weight:700; color:var(--text-dim); margin-top:2px; letter-spacing:0;">
                <span style="color:#059669;">☀️ ${d.kwhFV.toFixed(1)} kWh</span> &nbsp;<span style="color:#dc2626;">🔌 ${d.kwhRete.toFixed(1)} kWh</span>
              </div>
            </div>
            <div class="ed-dev-bar-wrap">
              <div class="ed-dev-bar" style="width:0%; background:${d.color};" data-w="${pct}"></div>
            </div>
            <div class="ed-dev-stats">
                <div class="ed-dev-kwh">${d.val.toFixed(1)} <small style="font-size:10px;">kWh</small></div>
            </div>
        </div>`;
    }).join('');
    if (totalKwh <= 0 && ED_DEVICES.length) {
        list.innerHTML += '<div style="padding:10px 14px; margin-top:8px; border-radius:14px; background:rgba(14,165,233,0.08); color:#0369a1; font-size:11.5px; font-weight:700;">ℹ️ The Report reads Home Assistant <b>Long-Term Statistics</b>. If values stay at zero, make sure the entities have <code>state_class: total_increasing</code> (or <code>total</code>): Developer Tools → Statistics.</div>';
    }

    setTimeout(() => {
        list.querySelectorAll('.ed-dev-bar').forEach(bar => {
            bar.style.width = bar.dataset.w + '%';
        });
    }, 80);
}

/* ═══ v0.8.0: PERIOD ENGINE ═══
   Puoi mappare nei campi "oggi"/"mese" anche sensori TOTALI cumulativi (contatori lifetime):
   i valori di giornaliera, mensile e Report vengono RICOSTRUITI come delta del periodo
   tramite le Long-Term Statistics di HA. Con entità che si azzerano da sole il delta
   coincide col valore attuale, quindi il motore è universale. */
const CD_PERIOD = window.CD_PERIOD ||= {};
async function cdRefreshPeriodDeltas() { return window.DashboardModernEnergyService?.refresh?.(); }

/* Valore numerico del periodo: statistica se disponibile, altrimenti stato grezzo */
function cdPNum(ref) {
    if (CD_PERIOD[ref] !== undefined) return CD_PERIOD[ref];
    return parseFloat(getRawState(ref)) || 0;
}
/* Stato "grezzo" del periodo come stringa (per i nodi ↓↑ rete/batteria) */
function cdPRaw(ref) {
    if (CD_PERIOD[ref] !== undefined) { const v = CD_PERIOD[ref]; return v >= 100 ? v.toFixed(0) : v.toFixed(1); }
    return getRawState(ref);
}
/* Display formattato del periodo (per i nodi delle mappe) */
function cdPVal(ref) {
    if (CD_PERIOD[ref] !== undefined) { const v = CD_PERIOD[ref]; return (v >= 100 ? v.toFixed(1) : v.toFixed(2)) + ' kWh'; }
    return getDisplay(ref);
}

// Helper: legge le Long-Term Statistics tramite WebSocket
// HA mantiene queste statistiche per anni (non vengono purgate come la cronologia dettagliata)
function fetchHAStatistics(entityIds, startISO, endISO, period = 'day') {
    const service = window.DashboardModernEnergyService;
    if (!service) return Promise.reject(new Error('Canonical Energy service unavailable'));
    return service.statisticsWithGrowth(entityIds, startISO, endISO, period);
}

async function renderEdDailyChart(daysInMonth, selMonth, selYear, isCurrentMonth, prodMese, consMese) {
    const loading = document.getElementById('ed-chart-loading');
    const canvas  = document.getElementById('ed-daily-canvas');
    if (!loading || !canvas) return;

    if (edDailyChart) { edDailyChart.destroy(); edDailyChart = null; }
    loading.style.display = 'flex';
    loading.innerHTML = '<span style="animation:spinAnim 1s linear infinite;display:inline-block;">⏳</span>&nbsp;Caricamento storico...';
    canvas.style.display = 'none';

    let prodData = [], consData = [], labels = [];
    let fetchOk = false;
    const lastDay = isCurrentMonth ? new Date().getDate() : daysInMonth;
    const tStart = new Date(selYear, selMonth - 1, 1).toISOString();
    const tEnd   = isCurrentMonth
        ? new Date().toISOString()
        : new Date(selYear, selMonth, 1).toISOString();

    // ── METODO 1: Long-Term Statistics (mantiene dati per anni, non purgato) ──
    try {
        const prodId = 'dm.energy_produzione_solare_oggi';
        const consId = 'dm.energy_consumo_casa_oggi';
        const stats = await fetchHAStatistics([prodId, consId], tStart, tEnd, 'day');
        const prodStats = stats[prodId] || [];
        const consStats = stats[consId] || [];

        if (prodStats.length > 0 || consStats.length > 0) {
            // Costruisco mappa giorno → valore (uso 'max' = valore massimo del giorno per sensori daily che si azzerano)
            const prodMap = {};
            const consMap = {};
            prodStats.forEach(s => {
                const day = new Date(s.start).getDate();
                const v = s.max !== null && s.max !== undefined ? s.max : (s.change || 0);
                if (v > 0) prodMap[day] = v;
            });
            consStats.forEach(s => {
                const day = new Date(s.start).getDate();
                const v = s.max !== null && s.max !== undefined ? s.max : (s.change || 0);
                if (v > 0) consMap[day] = v;
            });

            for (let d = 1; d <= lastDay; d++) {
                labels.push(d + '');
                prodData.push(prodMap[d] ?? null);
                consData.push(consMap[d] ?? null);
            }
            fetchOk = labels.length > 0 && (prodData.some(v => v !== null && v > 0) || consData.some(v => v !== null && v > 0));
        }
    } catch(e) {
        console.warn('Statistics API non disponibile, provo history:', e.message);
    }

    // ── METODO 2: History API (fallback - solo ultimi 10 giorni di default) ──
    if (!fetchOk) {
        try {
            const sensors = 'dm.energy_produzione_solare_oggi,dm.energy_consumo_casa_oggi';
            const res = await fetch(
                `${HA_HTTP_URL}/api/history/period/${tStart}?filter_entity_id=${sensors}&minimal_response&end_time=${tEnd}`,
                { headers: { 'Authorization': `Bearer ${LONG_LIVED_TOKEN}` } }
            );

            if (res.ok) {
                const json = await res.json();
                const byDay = (arr) => {
                    const map = {};
                    (arr || []).forEach(d => {
                        if (d.state === 'unknown' || d.state === 'unavailable') return;
                        const day = new Date(d.last_changed).getDate();
                        const v   = parseFloat(d.state) || 0;
                        if (!map[day] || v > map[day]) map[day] = v;
                    });
                    return map;
                };
                const prodMap = byDay(json[0]);
                const consMap = byDay(json[1]);

                labels = []; prodData = []; consData = [];
                for (let d = 1; d <= lastDay; d++) {
                    labels.push(d + '');
                    prodData.push(prodMap[d] ?? null);
                    consData.push(consMap[d] ?? null);
                }
                fetchOk = labels.length > 0 && prodData.some(v => v !== null && v > 0);
            }
        } catch(e) {
            console.warn('History API non raggiungibile:', e.message);
        }
    }

    // ── METODO 3: Fallback stimato dai totali mensili (solo se proprio non c'è nulla) ──
    if (!fetchOk && prodMese > 0) {
        const avg  = prodMese / daysInMonth;
        const avgC = consMese / daysInMonth;
        labels = []; prodData = []; consData = [];
        for (let d = 1; d <= daysInMonth; d++) {
            labels.push(d + '');
            const s = Math.sin(d * 0.5) * 0.28;
            prodData.push(+(avg  * (0.78 + s)).toFixed(1));
            consData.push(+(avgC * (0.82 + Math.cos(d * 0.42) * 0.12)).toFixed(1));
        }
    }

    // Se non abbiamo proprio niente da mostrare
    if (labels.length === 0) {
        loading.innerHTML = '📭 Nessun dato disponibile per questo periodo';
        return;
    }

    loading.style.display = 'none';
    canvas.style.display  = 'block';

    const ctx = canvas.getContext('2d');
    const gP  = ctx.createLinearGradient(0, 0, 0, 200);
    gP.addColorStop(0, 'rgba(16,185,129,0.4)'); gP.addColorStop(1, 'rgba(16,185,129,0)');
    const gC  = ctx.createLinearGradient(0, 0, 0, 200);
    gC.addColorStop(0, 'rgba(14,165,233,0.25)'); gC.addColorStop(1, 'rgba(14,165,233,0)');

    edDailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label:'Produzione', data:prodData, borderColor:'#10b981', backgroundColor:gP,
                  borderWidth:3, fill:true, pointRadius:0, pointHoverRadius:5, tension:0.4, spanGaps:true },
                { label:'Consumo',    data:consData, borderColor:'#0ea5e9', backgroundColor:gC,
                  borderWidth:2, fill:true, pointRadius:0, pointHoverRadius:5, tension:0.4, spanGaps:true }
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            interaction:{ mode:'index', intersect:false },
            scales:{
                x:{ grid:{display:false}, ticks:{ font:{weight:'bold', size:10}, maxTicksLimit:12 } },
                y:{ grid:{color:'rgba(0,0,0,0.04)'}, beginAtZero:true,
                    ticks:{ font:{weight:'bold', size:10} } }
            },
            plugins:{
                legend:{ display:false },
                tooltip:{
                    backgroundColor:'#fff', titleColor:'#0f172a',
                    bodyColor:'#0f172a',
                    borderColor:'#e2e8f0', borderWidth:1,
                    cornerRadius:14, padding:12,
                    displayColors: true,
                    boxPadding: 6,
                    callbacks:{
                        title: items => 'Giorno ' + items[0].label,
                        label: item  => ' ' + item.dataset.label + ': ' + ((item.raw ?? 0).toFixed(1)) + ' kWh'
                    },
                    titleFont:{ size:12, weight:'bold' },
                    bodyFont:{ size:13, weight:'bold' }
                }
            }
        }
    });
}



// ── TEMPERATURE STANZE ─────────────────────────────────────────
/* ═══ v257: STANZE dinamiche — configurabili da UI (cd_stanze) ═══ */
const CD_STANZE_DEFAULT = [];
const STANZE_RGB_PALETTE = ['14,165,233','124,58,237','236,72,153','6,182,212','34,197,94','20,184,166','249,115,22','100,116,139','217,70,239','245,158,11'];

function getStanze() {
    // Priorità: wizard/editor (localStorage/baked) → config.js → default interni
    const w = cdCfg('cd_stanze');
    if (Array.isArray(w) && w.length) return w;
    const C = (window.DASHBOARD_CONFIG || {});
    if (Array.isArray(C.stanze) && C.stanze.length) return C.stanze;
    return CD_STANZE_DEFAULT;
}

/* v0.8.1: salva l'icona del piano (mappa cd_floor_icons: nome piano → emoji) */
function edSaveFloorIcon(floorName) {
    try {
        const el = document.getElementById('ed-st2-flicon');
        const ico = (el && el.value || '').trim();
        if (!floorName) return;
        const fm = cdCfg('cd_floor_icons');
        if (ico) fm[floorName] = ico; else delete fm[floorName];
        localStorage.setItem('cd_floor_icons', JSON.stringify(fm));
    } catch(e) {}
}
let CD_TEMP_FLOOR = null;
function buildTempCards() {
    const grid = document.getElementById('temp-grid');
    if (!grid) return;
    /* v0.7.4: i piani sono TAB in alto (con temperatura media); si vede un piano alla volta */
    const _rooms = getStanze().filter(function(r){ return r && r.temp; });
    const _hasFloors = _rooms.some(r => r.floor);
    let tabs = '';
    let visible = _rooms;
    if (_rooms.length) {
        const floors = [];
        _rooms.forEach(r => { const f = r.floor || r.name || 'Altro'; if (!floors.includes(f)) floors.push(f); });
        if (!CD_TEMP_FLOOR || !floors.includes(CD_TEMP_FLOOR)) CD_TEMP_FLOOR = floors[0];
        tabs = '<div style="grid-column:1/-1; justify-content:center; flex-wrap:wrap; display:flex; gap:10px; overflow-x:auto; padding:4px 2px 10px; -webkit-overflow-scrolling:touch;">' + floors.map((f, fi) => {
            const act = f === CD_TEMP_FLOOR;
            const fEsc = f.replace(/"/g, '&quot;');
            const fIco = (cdCfg('cd_floor_icons') || {})[f] || '🏢';
            return `<button type="button" class="sub-tab-btn${act ? ' active' : ''}" data-floor="${fEsc}" onclick="cdSetTempFloor(this.dataset.floor)" style="display:flex; align-items:center; gap:9px; flex:0 0 auto; font-family:inherit;">
              <span>${fIco} ${f}</span><span class="tfl-avg" data-floor="${fEsc}" style="font-family:'Oswald',sans-serif; font-size:15px; font-weight:700; letter-spacing:0;">—°</span>
            </button>`;
        }).join('') + '</div>';
        visible = _rooms.filter(r => (r.floor || r.name || 'Altro') === CD_TEMP_FLOOR);
    }
    if(!visible.length){ grid.innerHTML='<div style="text-align:center; padding:30px; color:var(--text-dim); font-weight:700;">No room con sensore — aggiungila nel tab Temperatura dell&#39;editor</div>'; return; } grid.innerHTML = tabs + visible.map(r => {
        const i = _rooms.indexOf(r);
        const temp = r.temp;
        const hum = r.hum || temp.replace('_temperature', '_humidity');
        const tid = temp.replace(/\./g,'_').replace(/-/g,'_');
        const hid = hum.replace(/\./g,'_').replace(/-/g,'_');
        const rgb = r.rgb || STANZE_RGB_PALETTE[i % STANZE_RGB_PALETTE.length];
        const nm = (r.name||'').replace(/'/g, '&#39;');
        return `<article class="temp-card" onclick="apriStorico(event, '${temp}', '${nm}')" style="--cp-rgb: 148, 163, 184;"> <div class="temp-card-header"><div class="cp-title-wrap"><div class="cp-icon">${typeof cdIconMarkup === 'function' ? cdIconMarkup(r.icon||'mdi:home', 30) : (r.icon||'🏠')}</div><div class="cp-name">${r.name}</div></div><div class="cp-badge temp-comfort-badge" id="tc_${tid}">—</div></div><div class="temp-card-body"><div class="cp-temp-current-wrap"><span class="cp-temp-current-lbl">Temperatura</span><span class="cp-temp-current temp-value" id="tv_${tid}">—</span></div><div class="cp-temp-target" onclick="event.stopPropagation(); apriStorico(event, '${hum}', '${nm} Umidità')"><span class="lbl">💧 Umidità</span><span class="val temp-hum-val" id="hv_${hid}">—%</span></div></div></article>`;
    }).join('');
}
function cdSetTempFloor(f) {
    CD_TEMP_FLOOR = f;
    if (navigator.vibrate) navigator.vibrate(8);
    buildTempCards();
    try { renderTemperature(); } catch(e) {}
}
document.addEventListener('DOMContentLoaded', buildTempCards);
document.addEventListener('DOMContentLoaded', () => { const v = document.getElementById('cfg-ver'); if (v) v.textContent = 'v' + DASHBOARD_VERSION; });

/* ═══ v258: ACCESSO RAPIDO AL WIZARD — 7 tap veloci sul titolo dell'header ═══ */
(function initSecretTap() {
    let taps = 0, timer = null;
    function attach() {
        const h1 = document.querySelector('header h1');
        if (!h1) return;
        h1.style.cursor = 'default';
        h1.addEventListener('click', () => {
            taps++;
            clearTimeout(timer);
            timer = setTimeout(() => { taps = 0; }, 2500);
            if (taps === 5 && navigator.vibrate) navigator.vibrate(30);
            if (false && taps >= 7) {
                taps = 0;
                if (navigator.vibrate) navigator.vibrate([50,50,50]);
                try { apriSetupWizard(); } catch(e) { console.error(e); }
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
})();

/* v258: accesso di emergenza alla configurazione — aggiungi #setup all'URL e ricarica */
document.addEventListener('DOMContentLoaded', () => {
    if (location.hash === '#setup') setTimeout(() => { try { apriSetupWizard(); } catch(e) {} }, 600);
    if (location.hash === '#reset') setTimeout(() => { try { wzResetAll(); } catch(e) {} }, 600);
});

function renderTemperature() {
    const ROOMS = getStanze().map(r => [r.temp, r.name, r.hum]);

    /* v0.7.4: average temperature of each floor in the tabs */
    try {
        document.querySelectorAll('.tfl-avg').forEach(el => {
            const f = el.dataset.floor;
            const ts = getStanze().filter(r => (r.floor || r.name || 'Altro') === f)
                .map(r => parseFloat(getRawState(r.temp))).filter(v => !isNaN(v));
            el.textContent = ts.length ? (ts.reduce((a,b) => a+b, 0) / ts.length).toFixed(1) + '°' : '—°';
        });
    } catch(e) {}

    const now = new Date().toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const upd = document.getElementById('temp-last-update');
    if (upd) upd.textContent = 'Aggiornato alle ' + now;

    const MIN_T = 10, MAX_T = 35;

    ROOMS.forEach(([tempSensor, room, humCustom]) => {
        const humSensor = humCustom || tempSensor.replace('_temperature', '_humidity');
        const tid = tempSensor.replace(/\./g,'_').replace(/-/g,'_');
        const hid = humSensor.replace(/\./g,'_').replace(/-/g,'_');

        // ── Temperatura ──────────────────────────────────────
        const temp = parseFloat(getRawState(tempSensor));
        const tvEl  = document.getElementById('tv_' + tid);
        const tbEl  = document.getElementById('tb_' + tid);
        const tblEl = document.getElementById('tbl_' + tid);
        const tcEl  = document.getElementById('tc_' + tid);

        if (tvEl) {
            if (isNaN(temp)) {
                tvEl.textContent = '—';
                if (tbEl)  tbEl.style.width = '0%';
                if (tblEl) tblEl.textContent = '—°';
                if (tcEl)  tcEl.textContent  = '—';
            } else {
                tvEl.textContent = temp.toFixed(1);
                const pctT = Math.min(100, Math.max(0, ((temp - MIN_T) / (MAX_T - MIN_T)) * 100));
                if (tbEl)  tbEl.style.width = pctT + '%';
                if (tblEl) tblEl.textContent = temp.toFixed(1) + '°';

                // Badge comfort - solo emoji nel cerchietto, etichetta nel tooltip
                let badge = '🟢', label = 'Comfort';
                if      (temp < 16) { badge = '❄️'; label = 'Freddo'; }
                else if (temp < 19) { badge = '🔵'; label = 'Fresco'; }
                else if (temp > 27) { badge = '🔥'; label = 'Caldo'; }
                else if (temp > 24) { badge = '🟡'; label = 'Tiepido'; }
                if (tcEl) { tcEl.textContent = badge; tcEl.setAttribute('title', label); }
            }
        }

        // ── Umidità ──────────────────────────────────────────
        const hum = parseFloat(getRawState(humSensor));
        const hvEl  = document.getElementById('hv_' + hid);
        const hbEl  = document.getElementById('hb_' + hid);
        const hblEl = document.getElementById('hbl_' + hid);

        if (hvEl) {
            if (isNaN(hum)) {
                hvEl.innerHTML = '—<span style="font-size:14px;opacity:0.75;">%</span>';
                if (hbEl)  hbEl.style.width = '0%';
                if (hblEl) hblEl.textContent = '—%';
            } else {
                hvEl.innerHTML = hum.toFixed(0) + '<span style="font-size:14px;opacity:0.75;">%</span>';
                if (hbEl)  hbEl.style.width = Math.min(100, hum) + '%';
                if (hblEl) hblEl.textContent = hum.toFixed(0) + '%';
            }
        }
    });
}


// ── Canvas particelle ricarica EV ──────────────────────
function lmStartParticles(canvas) {
    const ctx = canvas.getContext('2d');
    const particles = [];
    const colors = ['#10b981','#34d399','#6ee7b7','#a7f3d0','#f59e0b'];

    function resize() {
        canvas.width  = canvas.offsetWidth  || canvas.parentElement.offsetWidth  || 480;
        canvas.height = canvas.offsetHeight || canvas.parentElement.offsetHeight || 200;
    }
    resize();

    function spawn() {
        const side = Math.random() < 0.5 ? 'left' : 'bottom';
        particles.push({
            x:    side === 'left' ? 0 : Math.random() * canvas.width,
            y:    side === 'left' ? Math.random() * canvas.height : canvas.height,
            vx:   side === 'left' ? 1.5 + Math.random() * 2 : (Math.random() - 0.5) * 1.5,
            vy:   side === 'left' ? (Math.random() - 0.5) * 1.5 : -1.5 - Math.random() * 2,
            r:    1.5 + Math.random() * 2.5,
            life: 0,
            maxL: 80 + Math.random() * 80,
            col:  colors[Math.floor(Math.random() * colors.length)],
            trail: []
        });
    }
    for (let i = 0; i < 12; i++) spawn();

    function frame() {
        if (!canvas._animRunning) { ctx.clearRect(0,0,canvas.width,canvas.height); return; }
        resize();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (Math.random() < 0.18) spawn();

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.trail.push({x: p.x, y: p.y});
            if (p.trail.length > 10) p.trail.shift();
            p.x += p.vx; p.y += p.vy; p.life++;

            const alpha = Math.min(1, (p.maxL - p.life) / 30) * 0.85;
            if (alpha <= 0 || p.life > p.maxL) { particles.splice(i,1); continue; }

            // Scia
            if (p.trail.length > 2) {
                ctx.beginPath();
                ctx.moveTo(p.trail[0].x, p.trail[0].y);
                p.trail.forEach(pt => ctx.lineTo(pt.x, pt.y));
                ctx.strokeStyle = p.col + Math.floor(alpha * 80).toString(16).padStart(2,'0');
                ctx.lineWidth = p.r * 0.7;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            // Punto
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.col + Math.floor(alpha * 255).toString(16).padStart(2,'0');
            ctx.fill();
            // Glow
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2.5);
            g.addColorStop(0, p.col + Math.floor(alpha*100).toString(16).padStart(2,'0'));
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fill();
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}


// ── Popup storico stati connettività / inverter ──────────────
function chiudiSrvHistory(event) {
    if (event && event.target !== document.getElementById('srv-hist-overlay')) return;
    document.getElementById('srv-hist-overlay').classList.remove('show');
}

async function apriSrvHistory(tipo) {
    if (navigator.vibrate) navigator.vibrate(8);
    const overlay   = document.getElementById('srv-hist-overlay');
    const titleEl   = document.getElementById('srv-hist-title');
    const subtitleEl = document.getElementById('srv-hist-subtitle');
    const currValEl = document.getElementById('srv-hist-curr-val');
    const currBadge = document.getElementById('srv-hist-curr-badge');
    const timeline  = document.getElementById('srv-hist-timeline');

    // Config per tipo
    const config = {
        connettivita: {
            sensor: 'dm.server_raggiungibilita_google',
            title:    '📡 Connettività',
            subtitle: 'Internet · Ultimi 7 giorni',
            stateMap: {
                'on':          { label: '🟢 Online',      cls: 'connected',    col: '#10b981' },
                'off':         { label: '🔴 Offline',     cls: 'disconnected', col: '#ef4444' },
                'unavailable': { label: '⚫ Non disp.',   cls: 'unknown',      col: '#94a3b8' },
            },
            currState: () => getRawState('dm.server_raggiungibilita_google'),
        },
        inverter: {
            sensor:   'dm.energy_stato_rete',
            title:    '⚡ Inverter Fotovoltaico',
            subtitle: 'Stato griglia · Ultimi 7 giorni',
            stateMap: {
                'on':          { label: '🟢 On-Grid',     cls: 'ongrid',       col: '#10b981' },
                'on-grid':     { label: '🟢 On-Grid',     cls: 'ongrid',       col: '#10b981' },
                'on_grid':     { label: '🟢 On-Grid',     cls: 'ongrid',       col: '#10b981' },
                'off':         { label: '🟡 Off-Grid',    cls: 'offgrid',      col: '#f59e0b' },
                'off-grid':    { label: '🟡 Off-Grid',    cls: 'offgrid',      col: '#f59e0b' },
                'off_grid':    { label: '🟡 Off-Grid',    cls: 'offgrid',      col: '#f59e0b' },
                'unavailable': { label: '⚫ Non disp.',   cls: 'unknown',      col: '#94a3b8' },
            },
            currState: () => getRawState('dm.energy_stato_rete'),
        }
    };

    const cfg = config[tipo];
    if (!cfg) return;

    // Apri overlay e mostra loading
    titleEl.textContent    = cfg.title;
    subtitleEl.textContent = cfg.subtitle;
    timeline.innerHTML     = '<div class="srv-hist-loading"><div class="srv-hist-spinner"></div>Caricamento storico...</div>';

    // Stato attuale
    const currRaw  = cfg.currState();
    const currInfo = cfg.stateMap[currRaw?.toLowerCase()] || { label: currRaw || '—', col: '#64748b', cls: 'unknown' };
    currValEl.textContent   = currInfo.label;
    currValEl.style.color   = currInfo.col;
    currBadge.innerHTML     = '';

    overlay.classList.add('show');

    try {
        const tStart = new Date(Date.now() - 7 * 86400000).toISOString();
        const tEnd   = new Date().toISOString();
        // Senza minimal_response e con significant_changes_only=false per avere TUTTI gli eventi
        const url = `${HA_HTTP_URL}/api/history/period/${tStart}?filter_entity_id=${cfg.sensor}&end_time=${tEnd}&significant_changes_only=false`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${LONG_LIVED_TOKEN}` } });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + url);
        const json   = await res.json();
        const events = json[0] || [];

        if (events.length === 0) {
            timeline.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-dim);font-weight:800;font-size:12px;">Nessun dato storico trovato per ' + cfg.sensor + '</div>';
            return;
        }

        // Mostra TUTTI i cambi di stato senza deduplicazione aggressiva
        const changes = [];
        let lastState = null;
        events.forEach(ev => {
            const s = (ev.state || ev.s || '').toLowerCase();
            const t = ev.last_changed || ev.last_updated;
            if (!s || !t) return;
            if (s !== lastState) {
                changes.push({ state: s, time: new Date(t) });
                lastState = s;
            }
        });

        // Mostra in ordine inverso (più recente prima)
        const reversed = changes.reverse().slice(0, 30);

        const formatTime = dt => dt.toLocaleDateString('it-IT', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit'
        });

        const formatDuration = (from, to) => {
            const ms = to - from;
            const m = Math.floor(ms / 60000);
            const h = Math.floor(m / 60);
            const d = Math.floor(h / 24);
            if (d > 0) return `${d}g ${h % 24}h`;
            if (h > 0) return `${h}h ${m % 60}m`;
            return `${m}m`;
        };

        let html = '';
        reversed.forEach((ev, i) => {
            const info      = cfg.stateMap[ev.state?.toLowerCase()] || { label: ev.state, cls: 'unknown', col: '#94a3b8' };
            const nextEvent = reversed[i - 1]; // in ordine inverso, "prossimo" è il precedente temporale
            const duration  = nextEvent ? formatDuration(ev.time, nextEvent.time) : null;
            const isLast    = i === reversed.length - 1;

            html += `
            <div class="srv-history-event">
              <div class="srv-event-dot-wrap">
                <div class="srv-event-dot ${info.cls}" style="background:${info.col};box-shadow:0 0 0 1.5px ${info.col};"></div>
                ${!isLast ? '<div class="srv-event-line"></div>' : ''}
              </div>
              <div class="srv-event-info">
                <div class="srv-event-state" style="color:${info.col}">${info.label}</div>
                <div class="srv-event-time">${formatTime(ev.time)}</div>
                ${duration ? `<div class="srv-event-duration">Duration: ${duration}</div>` : ''}
              </div>
            </div>`;
        });

        timeline.innerHTML = html || '<div style="text-align:center;padding:24px;color:var(--text-dim)">Nessun cambio di stato</div>';

    } catch(e) {
        console.error('SrvHistory error:', e);
        timeline.innerHTML = `<div style="text-align:center;padding:24px;color:#ef4444;font-weight:800;font-size:12px;">❌ History non disponibile<br><span style="color:var(--text-dim);font-size:10px;">${e.message}</span></div>`;
    }
}

// ─── POPUP CONTROLLO CLIMA ───────────────────────────────────
let cpCurrentEntity = null;

function apriClimaFromModal(entity) {
    // Chiude il modal lista e apre il popup controllo singolo clima
    forceClose('details-modal');
    // Piccolo delay per evitare conflitti di animazioni tra i due overlay
    setTimeout(() => apriClimaPopup(entity, null), 200);
}

function apriClimaPopup(entity, event) {
    // Evita di aprire il popup se il click è su un bottone figlio
    if (event && event.target.closest('.cp-btn, .cp-controls')) return;
    if (!ws) return;
    cpCurrentEntity = entity;
    const s = STATES[entity];
    if (!s) return;

    const isTermo   = entity.includes('termosifone');
    const stateStr  = s.state; // off | cool | heat | fan_only | dry | auto
    const temp      = s.attributes?.temperature ?? '--';
    const currTemp  = s.attributes?.current_temperature ?? '--';
    const fanMode   = s.attributes?.fan_mode ?? 'auto';
    const hvacMode  = s.attributes?.hvac_mode ?? s.state;
    const names     = {
        'dm.core_005':                    ['❄️ Air conditioner','Salone'],
        'dm.core_004':                    ['❄️ Air conditioner','Cucina'],
        'dm.core_002':           ['❄️ Air conditioner','Camera da Letto'],
        'dm.core_003':                 ['❄️ Air conditioner','Cameretta'],
        'dm.core_010':        ['🔥 Radiator','Salone'],
        'dm.core_009':        ['🔥 Radiator','Cucina'],
        'dm.core_007':['🔥 Radiator','Camera da Letto'],
        'dm.core_008':     ['🔥 Radiator','Cameretta'],
        'dm.core_006':         ['🔥 Radiator','Bagno'],
        'dm.core_011':        ['🔥 Radiator','Studio'],
    };
    const [room, name] = names[entity] || ['🌡️ Clima', entity.split('.')[1]];

    setTxt('cp-room', room);
    setTxt('cp-name', name);
    setTxt('cp-temp-val', temp !== '--' ? temp + '°' : '--°');
    setTxt('cp-temp-curr', currTemp !== '--' ? 'Ambiente: ' + currTemp + '°' : 'Ambiente: --°');

    // Sezioni visibili in base al tipo
    document.getElementById('cp-mode-section').style.display = isTermo ? 'none' : 'block';
    document.getElementById('cp-fan-section').style.display  = isTermo ? 'none' : 'block';

    // Modalità attiva
    document.querySelectorAll('.clima-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === hvacMode);
    });

    // Ventola: genera pulsanti in base ai fan_modes disponibili
    const fanModes    = s.attributes?.fan_modes ?? ['auto','low','medium','high'];
    const fanLabels   = { auto:'Auto', low:'Min', medium:'Med', medium_low:'M-Low',
                          medium_high:'M-High', high:'Max', turbo:'Turbo',
                          quiet:'Quiet', '1':'Vel.1', '2':'Vel.2', '3':'Vel.3',
                          '4':'Vel.4', '5':'Vel.5', on:'On', off:'Off' };
    const fanGrid = document.getElementById('cp-fan-grid');
    if (fanGrid) {
        fanGrid.innerHTML = fanModes.map(fm =>
            `<div class="clima-fan-btn${fm === fanMode ? ' active' : ''}"
                  data-fan="${fm}" onclick="cpSetFan('${fm}')">${fanLabels[fm] || fm}</div>`
        ).join('');
    }

    // Pulsanti power
    const isOff = stateStr === 'off';
    document.getElementById('cp-btn-on').style.opacity  = isOff ? '1' : '0.4';
    document.getElementById('cp-btn-off').style.opacity = isOff ? '0.4' : '1';

    document.getElementById('clima-popup-overlay').classList.add('show');
    if (navigator.vibrate) navigator.vibrate(8);
}

function chiudiClimaPopup(event) {
    if (event && event.target !== document.getElementById('clima-popup-overlay')) return;
    document.getElementById('clima-popup-overlay').classList.remove('show');
    cpCurrentEntity = null;
}

function cpSetTemp(delta) {
    if (!cpCurrentEntity || !ws) return;
    if (navigator.vibrate) navigator.vibrate(8);
    const s = STATES[cpCurrentEntity];
    if (!s) return;
    const curr = parseFloat(s.attributes?.temperature ?? 20);
    const newT  = Math.round((curr + delta) * 2) / 2; // step 0.5
    const clamped = Math.min(35, Math.max(10, newT));
    ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'climate',
        service:'set_temperature', service_data:{ entity_id: cpCurrentEntity, temperature: clamped } }));
    setTxt('cp-temp-val', clamped + '°');
}

function cpSetMode(mode) {
    if (!cpCurrentEntity || !ws) return;
    if (navigator.vibrate) navigator.vibrate(8);
    ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'climate',
        service:'set_hvac_mode', service_data:{ entity_id: cpCurrentEntity, hvac_mode: mode } }));
    document.querySelectorAll('.clima-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode));
}

function cpSetFan(speed) {
    if (!cpCurrentEntity || !ws) return;
    if (navigator.vibrate) navigator.vibrate(8);
    ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'climate',
        service:'set_fan_mode', service_data:{ entity_id: cpCurrentEntity, fan_mode: speed } }));
    document.querySelectorAll('.clima-fan-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.fan === speed));
}

function cpPower(state) {
    if (!cpCurrentEntity || !ws) return;
    if (navigator.vibrate) navigator.vibrate(12);
    const service = state === 'on' ? 'turn_on' : 'turn_off';
    ws.send(JSON.stringify({ id: msgId++, type:'call_service', domain:'climate',
        service, service_data:{ entity_id: cpCurrentEntity } }));
    const isOff = state === 'off';
    document.getElementById('cp-btn-on').style.opacity  = isOff ? '1' : '0.4';
    document.getElementById('cp-btn-off').style.opacity = isOff ? '0.4' : '1';
}

// ─── DETTAGLIO DISPOSITIVO ENERGIA ───────────────────────────
let edDevChart = null;

// ─────────────────────────────────────────────────────────────────────
// Calcola risparmiato/speso ANNO per il dispositivo selezionato in Analisi
// Somma il consumo del dispositivo per tutti i mesi dell'anno + 
// proietta l'autoconsumo medio annuale della casa per dare lo split FV/Rete
// ─────────────────────────────────────────────────────────────────────
async function edCalcolaTotaliAnnoDispositivo(sensor, selYear) {
    const yearLbl     = document.getElementById('ed-dkpi-year-lbl');
    const rispEur     = document.getElementById('ed-dkpi-anno-risp-eur');
    const rispKwh     = document.getElementById('ed-dkpi-anno-risp-kwh');
    const costoEur    = document.getElementById('ed-dkpi-anno-costo-eur');
    const costoKwh    = document.getElementById('ed-dkpi-anno-costo-kwh');
    if (!rispEur || !costoEur) return;
    
    if (yearLbl) yearLbl.textContent = selYear;
    rispEur.textContent  = '⏳ —';
    costoEur.textContent = '⏳ —';
    
    const now = new Date();
    const isCurrentYear = selYear === now.getFullYear();
    const tStart = new Date(selYear, 0, 1).toISOString();
    const tEnd   = isCurrentYear ? now.toISOString() : new Date(selYear + 1, 0, 1).toISOString();
    
    let kwhDevAnno = 0, consCasaAnno = 0, prelevatoCasaAnno = 0;
    
    try {
        const stats = await fetchHAStatistics(
            [sensor, ED_SENSORS_CURR.cons, ED_SENSORS_CURR.prelevato],
            tStart, tEnd, 'month'
        );
        const sumChange = (id) => {
            const arr = stats[id];
            if (!Array.isArray(arr) || arr.length === 0) return 0;
            let total = 0;
            arr.forEach(item => {
                let v = 0;
                if (item.change !== null && item.change !== undefined && !isNaN(item.change)) v = item.change;
                else if (item.max !== null && item.max !== undefined && !isNaN(item.max)) v = item.max;
                else if (item.state !== null && item.state !== undefined && !isNaN(item.state)) v = item.state;
                if (v > 0) total += v;
            });
            return total;
        };
        kwhDevAnno        = sumChange(sensor);
        consCasaAnno      = sumChange(ED_SENSORS_CURR.cons);
        prelevatoCasaAnno = sumChange(ED_SENSORS_CURR.prelevato);
    } catch(e) {
        console.warn('[ED Dev Anno] Statistics fallita:', e.message);
    }
    
    // Split FV/Rete sull'anno
    const autoPctAnno  = consCasaAnno > 0 ? Math.max(0, Math.min(1, (consCasaAnno - prelevatoCasaAnno) / consCasaAnno)) : 1;
    const kwhFVanno    = kwhDevAnno * autoPctAnno;
    const kwhReteAnno  = kwhDevAnno * (1 - autoPctAnno);
    const rispEurAnno  = kwhFVanno * COSTO_KWH;
    const costoEurAnno = kwhReteAnno * COSTO_KWH;
    
    if (kwhDevAnno > 0) {
        rispEur.textContent  = '+ ' + rispEurAnno.toFixed(2) + ' €';
        rispKwh.textContent  = kwhFVanno.toFixed(1) + ' kWh da FV';
        costoEur.textContent = '- ' + costoEurAnno.toFixed(2) + ' €';
        costoKwh.textContent = kwhReteAnno.toFixed(1) + ' kWh dalla rete';
    } else {
        rispEur.textContent  = '— €';
        rispKwh.textContent  = 'Dati non disponibili';
        costoEur.textContent = '— €';
        costoKwh.textContent = '';
    }
}

async function edCaricaDettaglio() {
    const sel     = document.getElementById('ed-dev-selector');
    const sensor  = sel?.value;
    const msgEl   = document.getElementById('ed-dev-chart-msg');
    const canvas  = document.getElementById('ed-dev-chart-canvas');
    const wbGrid  = document.getElementById('ed-bottom-grid');
    
    // Mostra la sezione Wallbox SOLO se il dispositivo selezionato è la wallbox
    const isWallbox = sensor === 'dm.ev_energia_wallbox_mese';
    if (wbGrid) wbGrid.style.display = isWallbox ? 'grid' : 'none';
    
    if (!sensor) {
        if (msgEl) { msgEl.style.display='flex'; msgEl.textContent='☝️ Seleziona un dispositivo'; }
        if (canvas) canvas.style.display='none';
        return;
    }
    if (msgEl) { msgEl.style.display='flex'; msgEl.innerHTML='<span style="animation:spinAnim 1s linear infinite;display:inline-block">⏳</span>&nbsp;Caricamento...'; }
    if (canvas) canvas.style.display='none';

    // ── Periodo selezionato dall'utente ──
    const selMonthEl = document.getElementById('ed-sel-month');
    const selYearEl  = document.getElementById('ed-sel-year');
    const selMonth   = parseInt(selMonthEl?.value || new Date().getMonth()+1);
    const selYear    = parseInt(selYearEl?.value  || new Date().getFullYear());
    const now        = new Date();
    const isCurrentMonth = (selMonth === now.getMonth()+1) && (selYear === now.getFullYear());
    const tStart     = new Date(selYear, selMonth-1, 1).toISOString();
    const tEnd       = isCurrentMonth ? now.toISOString() : new Date(selYear, selMonth, 1).toISOString();

    // ── Reset stato visuale prima del fetch ──
    setTxt('ed-dkpi-mese', '⏳ —');
    setTxt('ed-dkpi-mese-eur', '— €');
    setTxt('ed-dkpi-media', '— kWh');
    
    // ── Recupero valori per il PERIODO SELEZIONATO (non sempre mese corrente!) ──
    let valMese = 0, consCasa = 0, prelevatoRete = 0;
    
    if (isCurrentMonth) {
        // v0.8.6: mese corrente dal motore periodi (delta del mese), coerente col resto —
        // vale anche se il sensore del dispositivo selezionato è un contatore TOTALE.
        valMese       = (typeof CD_PERIOD !== 'undefined' && CD_PERIOD[sensor] !== undefined) ? CD_PERIOD[sensor] : (parseFloat(getRawState(sensor)) || 0);
        consCasa      = cdPNum(ED_SENSORS_CURR.cons);
        prelevatoRete = cdPNum(ED_SENSORS_CURR.prelevato);
    } else {
        // Mese passato: usa le Long-Term Statistics
        try {
            const stats = await fetchHAStatistics(
                [sensor, ED_SENSORS_CURR.cons, ED_SENSORS_CURR.prelevato],
                tStart, tEnd, 'month'
            );
            const getStatVal = (id) => {
                const arr = stats[id];
                if (!Array.isArray(arr) || arr.length === 0) return 0;
                let v = 0;
                arr.forEach(item => {
                    if (item.change !== null && item.change !== undefined && !isNaN(item.change) && item.change > v) v = item.change;
                    else if (v === 0 && item.max !== null && item.max !== undefined && !isNaN(item.max)) v = item.max;
                    else if (v === 0 && item.state !== null && item.state !== undefined && !isNaN(item.state)) v = item.state;
                });
                return v;
            };
            valMese       = getStatVal(sensor);
            consCasa      = getStatVal(ED_SENSORS_CURR.cons);
            prelevatoRete = getStatVal(ED_SENSORS_CURR.prelevato);
        } catch(e) {
            console.warn('[ED] Detail device statistics failed:', e.message);
        }
    }

    // ── Calcoli ──
    const daysElapsed = isCurrentMonth ? now.getDate() : new Date(selYear, selMonth, 0).getDate();
    const media       = daysElapsed > 0 ? (valMese / daysElapsed).toFixed(2) : '--';
    
    // Split FV / Rete in base all'autoconsumo % del periodo
    const autoPct      = consCasa > 0 ? Math.max(0, Math.min(1, (consCasa - prelevatoRete) / consCasa)) : 1;
    const kwhFVdev     = valMese * autoPct;
    const kwhReteDev   = valMese * (1 - autoPct);
    const rispEurDev   = kwhFVdev * COSTO_KWH;
    const costoEurDev  = kwhReteDev * COSTO_KWH;

    // ── Aggiorno UI ──
    setTxt('ed-dkpi-mese', valMese.toFixed(1) + ' kWh');
    setTxt('ed-dkpi-mese-eur', '€ ' + (valMese * COSTO_KWH).toFixed(2));
    setTxt('ed-dkpi-media', media + ' kWh');
    setTxt('ed-dkpi-media-sub', 'Media/giorno');
    
    const rispEurEl  = document.getElementById('ed-dkpi-risp-eur');
    const rispKwhEl  = document.getElementById('ed-dkpi-risp-kwh');
    const costoEurEl = document.getElementById('ed-dkpi-costo-eur');
    const costoKwhEl = document.getElementById('ed-dkpi-costo-kwh');
    if (rispEurEl)  rispEurEl.textContent  = '+ ' + rispEurDev.toFixed(2) + ' €';
    if (rispKwhEl)  rispKwhEl.textContent  = kwhFVdev.toFixed(1) + ' kWh da FV';
    if (costoEurEl) costoEurEl.textContent = '- ' + costoEurDev.toFixed(2) + ' €';
    if (costoKwhEl) costoKwhEl.textContent = kwhReteDev.toFixed(1) + ' kWh dalla rete';

    // ── Totali ANNO per questo dispositivo (somma di tutti i mesi dell'anno corrente) ──
    edCalcolaTotaliAnnoDispositivo(sensor, selYear);

    // ── History giornaliero del periodo selezionato ──
    try {
        // Variabili periodo già definite sopra (selMonth, selYear, tStart, tEnd, isCurrentMonth)
        const daysInMonth = new Date(selYear, selMonth, 0).getDate();
        const lastDay     = isCurrentMonth ? now.getDate() : daysInMonth;
        
        const labels = [], values = [];
        let piccoVal = 0, piccoDay = '--';
        let fetchOk = false;
        
        // ── METODO 1: Long-Term Statistics con period:'day' ──
        // Funziona anche per mesi passati (i dati non sono purgati come per l'history)
        // Per ogni giorno, 'change' = delta del giorno (consumo o produzione di quel giorno)
        try {
            const stats = await fetchHAStatistics([sensor], tStart, tEnd, 'day');
            const arr   = stats[sensor];
            if (Array.isArray(arr) && arr.length > 0) {
                const byDayChange = {};
                arr.forEach(item => {
                    const day = new Date(item.start).getDate();
                    let v = 0;
                    if (item.change !== null && item.change !== undefined && !isNaN(item.change)) v = item.change;
                    else if (item.max !== null && item.max !== undefined && !isNaN(item.max)) v = item.max;
                    if (v > 0) byDayChange[day] = v;
                });
                
                for (let d = 1; d <= lastDay; d++) {
                    const dayVal = byDayChange[d] ?? 0;
                    labels.push(d+'');
                    values.push(parseFloat(dayVal.toFixed(3)));
                    if (dayVal > piccoVal) { piccoVal = dayVal; piccoDay = d+'/'+selMonth; }
                }
                fetchOk = values.some(v => v > 0);
            }
        } catch(e) {
            console.warn('[ED Device] Statistics fallita, provo history:', e.message);
        }
        
        // ── METODO 2: History API (fallback per ultimi 10 giorni) ──
        if (!fetchOk) {
            const res = await fetch(
                `${HA_HTTP_URL}/api/history/period/${tStart}?filter_entity_id=${sensor}&minimal_response&end_time=${tEnd}`,
                { headers: { 'Authorization': `Bearer ${LONG_LIVED_TOKEN}` } }
            );
            if (!res.ok) throw new Error('API error');
            const json = await res.json();
            const arr  = json[0] || [];

            // ── Raggruppa per giorno ──────────────────────────────────
            // Teniamo MIN e MAX per ogni giorno per rilevare se il sensore è cumulativo o giornaliero
            const byDayMax = {}, byDayMin = {}, byDayLast = {};
            arr.forEach(d => {
                if (d.state === 'unknown' || d.state === 'unavailable') return;
                const day = new Date(d.last_changed).getDate();
                const v   = parseFloat(d.state);
                if (isNaN(v)) return;
                if (byDayMax[day] === undefined || v > byDayMax[day]) byDayMax[day] = v;
                if (byDayMin[day] === undefined || v < byDayMin[day]) byDayMin[day] = v;
                byDayLast[day] = v;
            });

            // Rileva se è un sensore CUMULATIVO MENSILE o GIORNALIERO (reset a mezzanotte)
            const hasDayReset = Object.keys(byDayMax).length > 1 &&
                Object.entries(byDayMin).some(([d,v]) => parseInt(d) > 1 && v < 0.5);
            const isCumulative = !hasDayReset;

            // Svuota e ricalcola
            labels.length = 0; values.length = 0;
            piccoVal = 0; piccoDay = '--';

            if (isCumulative) {
                const d1Reset = byDayMax[1] !== undefined && byDayMin[1] !== undefined &&
                                (byDayMax[1] - byDayMin[1]) > byDayMax[1] * 0.5;
                let prevLast = d1Reset ? 0 : (byDayMin[1] ?? 0);
                for (let d = 1; d <= lastDay; d++) {
                    const dayLast = byDayLast[d] ?? prevLast;
                    let effPrev = prevLast;
                    if (byDayMin[d] !== undefined && byDayMin[d] < prevLast * 0.5 && prevLast > 1) effPrev = 0;
                    const dayConsume = Math.max(0, parseFloat((dayLast - effPrev).toFixed(3)));
                    labels.push(d+'');
                    values.push(dayConsume);
                    if (dayConsume > piccoVal) { piccoVal = dayConsume; piccoDay = d+'/'+selMonth; }
                    if (byDayLast[d] !== undefined) prevLast = byDayLast[d];
                }
            } else {
                for (let d = 1; d <= lastDay; d++) {
                    const dayVal = byDayMax[d] ?? 0;
                    labels.push(d+'');
                    values.push(parseFloat(dayVal.toFixed(3)));
                    if (dayVal > piccoVal) { piccoVal = dayVal; piccoDay = d+'/'+selMonth; }
                }
            }
        }

        setTxt('ed-dkpi-picco', piccoVal > 0 ? piccoVal.toFixed(2)+' kWh' : '—');
        setTxt('ed-dkpi-picco-sub', piccoDay !== '--' ? 'Giorno '+piccoDay : '—');

        if (edDevChart) { edDevChart.destroy(); edDevChart = null; }
        if (msgEl) msgEl.style.display = 'none';
        if (canvas) canvas.style.display = 'block';

        // Colore dal dispositivo selezionato
        const devInfo  = ED_DEVICES.find(d => d.sensor === sensor);
        const barColor = devInfo ? devInfo.color : '#16a34a';

        const ctx = canvas.getContext('2d');
        edDevChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label:'kWh', data:values, backgroundColor: barColor+'99',
                    borderColor: barColor, borderWidth: 2, borderRadius: 6 }]
            },
            options: {
                responsive:true, maintainAspectRatio:false,
                plugins: {
                    legend:{display:false},
                    tooltip:{
                        backgroundColor:'#fff', titleColor:'#0f172a', bodyColor:barColor,
                        borderColor:'#e2e8f0', borderWidth:1, cornerRadius:12, padding:10,
                        callbacks:{
                            title: i => 'Giorno ' + i[0].label,
                            label: i => ' ' + i.raw.toFixed(2) + ' kWh'
                        }
                    }
                },
                scales:{
                    x:{ grid:{display:false}, ticks:{font:{weight:'bold',size:10},maxTicksLimit:12} },
                    y:{ grid:{color:'rgba(0,0,0,0.04)'}, beginAtZero:true,
                        ticks:{font:{weight:'bold',size:10}} }
                }
            }
        });

    } catch(e) {
        console.warn('edCaricaDettaglio error:', e);
        setTxt('ed-dkpi-picco', '—');
        setTxt('ed-dkpi-picco-sub', 'History N/D');
        if (msgEl) { msgEl.style.display='flex'; msgEl.textContent='❌ History non disponibile'; }
    }
}

// ================= GESTIONE BARRA INFERIORE SU MOBILE (HIDE/SHOW CON GESTO) ================= //
(function setupBottomNavMobile() {
    // Si attiva su smartphone in portrait (≤768px largo) OPPURE in landscape (altezza ≤500px)
    function isTouchCapable() {
        return Boolean(navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    }
    if (isTouchCapable()) document.documentElement.classList.add('dm-touch-navigation');
    function isMobileLayout() {
        if (isTouchCapable()) return true;
        if (!window.matchMedia) return window.innerWidth <= 768;
        return window.matchMedia('(max-width: 768px)').matches ||
               (window.matchMedia('(orientation: landscape)').matches &&
                window.matchMedia('(max-height: 500px)').matches) ||
               window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    }
    if (!isMobileLayout()) return;
    
    const nav = document.querySelector('nav.bottom-nav-bar');
    const handle = document.getElementById('bottomNavHandle');
    if (!nav || !handle) return;
    
    let autoHideTimer = null;
    const AUTO_HIDE_MS = 4000; // Auto-nascondi dopo 4 secondi di inattività

    /* v294: modalità barra fissa (richiesta utenti) — sempre visibile, niente auto-hide */
    const cdNavFixed = () => { const v = localStorage.getItem('cd_navbar_mode'); return (typeof v === 'string' ? v : 'auto') === 'fixed'; };
    window.cdApplyNavMode = function() {
        if (cdNavFixed()) { nav.classList.add('visible'); document.body.classList.add('nav-visible'); clearTimeout(autoHideTimer); }
        else { nav.classList.remove('visible'); document.body.classList.remove('nav-visible'); }
    };
    if (cdNavFixed()) setTimeout(() => window.cdApplyNavMode(), 300);
    setTimeout(() => {
        const cur = cdNavFixed() ? 'nav-opt-fixed' : 'nav-opt-auto';
        document.getElementById(cur)?.classList.add('nav-active');
    }, 400);

    function showNav() {
        nav.classList.add('visible');
        document.body.classList.add('nav-visible');
        if (!cdNavFixed()) scheduleAutoHide();
        if (navigator.vibrate) navigator.vibrate(15);
    }
    
    function hideNav() {
        if (cdNavFixed()) return; // fissa: mai nascondere
        nav.classList.remove('visible');
        document.body.classList.remove('nav-visible');
        clearTimeout(autoHideTimer);
    }
    
    function toggleNav() {
        if (nav.classList.contains('visible')) hideNav();
        else showNav();
    }
    
    function scheduleAutoHide() {
        clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(hideNav, AUTO_HIDE_MS);
    }
    
    // -------- Tap sulla maniglia --------
    handle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNav();
    });
    
    // -------- Swipe UP dal bordo inferiore dello schermo --------
    let edgeTouchStartY = null;
    let edgeTouchStartX = null;
    
    document.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        // Area di rilevamento ampia: ultimi 100px dal fondo (per evitare gesture bar Android)
        if (t.clientY > window.innerHeight - 100) {
            edgeTouchStartY = t.clientY;
            edgeTouchStartX = t.clientX;
        }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (edgeTouchStartY === null) return;
        const t = e.touches[0];
        const dy = edgeTouchStartY - t.clientY;
        const dx = Math.abs(t.clientX - edgeTouchStartX);
        // Swipe up di almeno 20px e prevalentemente verticale (soglia ridotta)
        if (dy > 20 && dx < 60) {
            if (!nav.classList.contains('visible')) showNav();
            edgeTouchStartY = null;
        }
    }, { passive: true });
    
    document.addEventListener('touchend', () => { edgeTouchStartY = null; }, { passive: true });
    
    // -------- Swipe UP partendo dalla maniglia stessa --------
    let handleTouchStartY = null;
    handle.addEventListener('touchstart', (e) => {
        handleTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    handle.addEventListener('touchmove', (e) => {
        if (handleTouchStartY === null) return;
        const dy = handleTouchStartY - e.touches[0].clientY;
        if (dy > 15) {
            if (!nav.classList.contains('visible')) showNav();
            handleTouchStartY = null;
        }
    }, { passive: true });
    
    handle.addEventListener('touchend', () => { handleTouchStartY = null; }, { passive: true });
    
    // -------- Swipe DOWN sulla nav per chiuderla --------
    let navTouchStartY = null;
    nav.addEventListener('touchstart', (e) => {
        navTouchStartY = e.touches[0].clientY;
        scheduleAutoHide(); // resetta timer su interazione
    }, { passive: true });
    
    nav.addEventListener('touchmove', (e) => {
        if (navTouchStartY === null) return;
        const dy = e.touches[0].clientY - navTouchStartY;
        if (dy > 40) {
            hideNav();
            navTouchStartY = null;
        }
    }, { passive: true });
    
    nav.addEventListener('touchend', () => { navTouchStartY = null; }, { passive: true });
    
    // -------- Tap su una tab → nascondi dopo poco --------
    nav.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Aspetta un attimo che la transizione di pagina parta, poi nascondi
            setTimeout(hideNav, 800);
        });
    });
    
    // -------- Tap fuori dalla nav la chiude --------
    document.addEventListener('click', (e) => {
        if (!nav.classList.contains('visible')) return;
        if (nav.contains(e.target) || handle.contains(e.target)) return;
        hideNav();
    });
})();

connect();

// Explicit boundary between parsing the large legacy script and consumers of
// its public API.  Do not expose readiness until lexical declarations, public
// editor functions and the DOM are all usable.
(function signalDashboardModernLegacyReady() {
    function ready() {
        if (globalThis.__DASHBOARDMODERN_LEGACY_READY__) return;
        if (typeof EDITOR_TAB === 'undefined' ||
            typeof editorSwitch !== 'function' ||
            typeof apriConfigEntita !== 'function') return;
        globalThis.__DASHBOARDMODERN_LEGACY_READY__ = true;
        globalThis.dispatchEvent(new CustomEvent('dashboardmodern:legacy-ready'));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
    else ready();
})();
