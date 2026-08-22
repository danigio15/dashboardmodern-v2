import { ACTION_ICON_CATALOG, actionVisual } from "../core/personalization-catalog.js";
import { allStates, clean, doc, esc, installStyle, onEditorRedraw, readJson, root, t, wrapFunction } from "./shared.js";

const KEY = "__DASHBOARDMODERN_BETA6_FEEDBACK__";
const state = (root[KEY] ||= { installed: false, frame: 0, lightSignature: "" });

const QA_DEFAULTS = Object.freeze({
  luci_group:{glyph:"💡",mdi:"mdi:lightbulb-group"}, builtin_luci:{glyph:"💡",mdi:"mdi:lightbulb-group"},
  builtin_clima:{glyph:"❄️",mdi:"mdi:snowflake"}, builtin_antifurto:{glyph:"🛡️",mdi:"mdi:shield-home"},
  builtin_lavatrice:{glyph:"🧺",mdi:"mdi:washing-machine"}, toggle:{glyph:"🔀",mdi:"mdi:toggle-switch-outline"},
  script:{glyph:"▶️",mdi:"mdi:script-text-play"}, scene:{glyph:"🎬",mdi:"mdi:movie-open"},
});
const RGB_MODES = new Set(["hs","xy","rgb","rgbw","rgbww"]);
const BRIGHTNESS_MODES = new Set(["brightness","color_temp","hs","xy","rgb","rgbw","rgbww"]);

const qaDefault = (type) => QA_DEFAULTS[clean(type)] || { glyph:"⭐", mdi:"mdi:star" };
const qaByMdi = (value) => ACTION_ICON_CATALOG.find((item) => item.mdi === clean(value)) || null;
const qaByGlyph = (value) => ACTION_ICON_CATALOG.find((item) => item.glyph === clean(value)) || null;
function qaPortable(value, type) {
  const token = clean(value), fallback = qaDefault(type);
  if (!token || token === "⚡") return fallback.glyph;
  return token.startsWith("mdi:") ? (qaByMdi(token)?.glyph || fallback.glyph) : token;
}
function qaMdi(value, type) {
  const token = clean(value), fallback = qaDefault(type);
  if (token.startsWith("mdi:")) return token;
  if (!token || token === fallback.glyph || token === "⚡") return fallback.mdi;
  return qaByGlyph(token)?.mdi || fallback.mdi;
}
function qaType(action = {}) { return action.type === "builtin" ? `builtin_${clean(action.builtin)}` : clean(action.type); }
function qaMarkup(value, type, size = 32) {
  const mdi = qaMdi(value, type);
  const canonical = root.DashboardModernIconEngine?.markup?.("action", mdi, { size });
  if (clean(canonical)) return canonical;
  return actionVisual(mdi, size) || esc(qaPortable(value, type));
}

function closeQaPicker() {
  root.DashboardModernIconEngine?.closePicker?.();
}
function openQaPicker(input) {
  return Boolean(
    root.DashboardModernIconEngine?.openPicker?.(input, "action", { autofocus: false }),
  );
}

function polishQaEditor() {
  const input = doc?.getElementById?.("ed-qa-icon"), type = doc?.getElementById?.("ed-qa-type");
  if (!input || !type) return false;
  const row = input.closest?.(".ed-form-row") || input.parentElement; if (!row) return false;
  row.dataset.dmBeta6QuickAction = "true";
  let preview = row.querySelector(".dm-beta6-qa-icon-trigger");
  if (!preview) {
    preview = doc.createElement("button"); preview.type="button"; preview.className="dm-beta6-qa-icon-trigger";
    preview.setAttribute("aria-label",t("Scegli icona azione","Choose action icon")); input.insertAdjacentElement("afterend",preview);
    preview.addEventListener("click",(event)=>{event.preventDefault();openQaPicker(input,preview);});
    input.addEventListener("input",()=>{preview.innerHTML=qaMarkup(input.value,type.value,32);});
  }
  const fallback = qaDefault(type.value), current = clean(input.value), normalized = qaPortable(current,type.value);
  if (normalized !== current) input.value = normalized;
  if (!input.dataset.dmBeta7DefaultGlyph) input.dataset.dmBeta7DefaultGlyph = fallback.glyph;
  input.classList.add("dm-beta6-qa-icon-value"); preview.innerHTML = qaMarkup(input.value,type.value,32);
  if (type.dataset.dmBeta7IconBound !== "true") {
    type.dataset.dmBeta7IconBound="true";
    type.addEventListener("change",()=>{
      const previous=clean(input.dataset.dmBeta7DefaultGlyph), next=qaDefault(type.value);
      if (!clean(input.value) || clean(input.value)===previous || clean(input.value)==="⚡") input.value=next.glyph;
      input.dataset.dmBeta7DefaultGlyph=next.glyph; input.dispatchEvent(new Event("input",{bubbles:true}));
    });
  }
  return true;
}
function polishQaCards() {
  return Boolean(root.DashboardModernIconEngine?.syncQuickActions?.());
}
function installQaRenderer() {
  polishQaCards();
  return true;
}

function lightState(id){return allStates()?.[id]||root.currentEntity?.(id)||root.haState?.(id)||null;}
function configuredLights(){const names=readJson("cd_luci",{});return Object.keys(names||{}).filter((id)=>/^light\./i.test(id)).map((id)=>({id,name:clean(names[id])||clean(lightState(id)?.attributes?.friendly_name)||id}));}
function modes(entity){const raw=entity?.attributes?.supported_color_modes;return new Set((Array.isArray(raw)?raw:[]).map((v)=>clean(v).toLowerCase()).filter(Boolean));}
function supportsBrightness(entity){const m=modes(entity);return entity?.attributes?.brightness!=null||[...m].some((v)=>BRIGHTNESS_MODES.has(v));}
function supportsRgb(entity){return [...modes(entity)].some((v)=>RGB_MODES.has(v));}
function rgbToHex(rgb){const values=Array.isArray(rgb)?rgb.slice(0,3):[];if(values.length<3)return"#ffffff";return`#${values.map((v)=>Math.max(0,Math.min(255,Number(v)||0)).toString(16).padStart(2,"0")).join("")}`;}
function hexToRgb(hex){const v=clean(hex).replace(/^#/,"");return/^[0-9a-f]{6}$/i.test(v)?[0,2,4].map((o)=>Number.parseInt(v.slice(o,o+2),16)):[255,255,255];}
function callLight(id,data){const payload={entity_id:id,...data};try{if(typeof root.cdCallServiceJson==="function")return root.cdCallServiceJson("light","turn_on",JSON.stringify(payload));if(typeof root.callService==="function")return root.callService("light","turn_on",payload);const hass=root.hass||root._hass||doc?.querySelector?.("home-assistant")?.hass;return hass?.callService?.("light","turn_on",payload);}catch(error){root.console?.warn?.("[DashboardModern] light control failed",error);}}
function lightSignature(lights){return lights.map(({id})=>{const e=lightState(id)||{},a=e.attributes||{};return[id,e.state,a.brightness,(a.rgb_color||[]).join(","),(a.supported_color_modes||[]).join(",")].join("|");}).join(";");}
function renderLightControls(){
  const list=doc?.getElementById?.("wz-lights-list");if(!list)return false;const popup=list.closest?.(".wz-popup,.popup,.modal,.wz-modal")||list.parentElement;if(!popup)return false;
  const lights=configuredLights().filter(({id})=>{const e=lightState(id);return e&&(supportsBrightness(e)||supportsRgb(e));});let panel=popup.querySelector?.(".dm-beta6-light-advanced");
  if(!lights.length){panel?.remove();state.lightSignature="";return false;}const signature=lightSignature(lights);if(panel&&state.lightSignature===signature)return true;state.lightSignature=signature;
  if(!panel){panel=doc.createElement("section");panel.className="dm-beta6-light-advanced";list.insertAdjacentElement("afterend",panel);}panel.innerHTML=`<header><strong>${t("Dimmer e colori","Dimmer & colors")}</strong><span>${t("Solo per luci compatibili","Compatible lights only")}</span></header><div class="dm-beta6-light-control-list"></div>`;const body=panel.querySelector(".dm-beta6-light-control-list");
  lights.forEach(({id,name})=>{const e=lightState(id)||{},a=e.attributes||{},dim=supportsBrightness(e),rgb=supportsRgb(e),brightness=Math.round((Math.max(0,Math.min(255,Number(a.brightness)||0))/255)*100),row=doc.createElement("article");row.className="dm-beta6-light-control";row.innerHTML=`<div class="dm-beta6-light-head"><span class="dm-beta6-light-dot ${e.state==="on"?"is-on":""}"></span><div><strong>${esc(name)}</strong><small>${esc(id)}</small></div></div><div class="dm-beta6-light-tools">${dim?`<label class="dm-beta6-dimmer"><span>${t("Luminosità","Brightness")}</span><output>${brightness}%</output><input type="range" min="1" max="100" value="${Math.max(1,brightness||1)}" data-brightness></label>`:""}${rgb?`<label class="dm-beta6-color"><span>RGB</span><input type="color" value="${rgbToHex(a.rgb_color)}" data-color></label>`:""}</div>`;body.append(row);const slider=row.querySelector("[data-brightness]"),output=row.querySelector("output");if(slider){let timer=0;slider.addEventListener("input",()=>{if(output)output.value=`${slider.value}%`;root.clearTimeout?.(timer);timer=root.setTimeout?.(()=>callLight(id,{brightness_pct:Number(slider.value)}),120)||0;});slider.addEventListener("change",()=>callLight(id,{brightness_pct:Number(slider.value)}));}row.querySelector("[data-color]")?.addEventListener("change",(event)=>callLight(id,{rgb_color:hexToRgb(event.target.value)}));});return true;
}

function run(){state.frame=0;installQaRenderer();polishQaEditor();polishQaCards();renderLightControls();}
function schedule(){if(state.frame)return;state.frame=root.requestAnimationFrame?.(run)||root.setTimeout?.(run,0)||0;}
function installOwners(){wrapFunction("wzOpenLightsPopup","__dmBeta7Lights",schedule);onEditorRedraw("__dmBeta7QuickActions",schedule);wrapFunction("edQaTypeChanged","__dmBeta7QuickActions",schedule);wrapFunction("edAddQA","__dmBeta7QuickActions",schedule);installQaRenderer();}
function installStyles(){installStyle("dm-beta6-feedback-style",`
.ed-form-row[data-dm-beta6-quick-action="true"]{display:grid!important;grid-template-columns:minmax(150px,1.25fr) 58px minmax(130px,1fr)!important;gap:8px!important;width:100%!important}.ed-form-row[data-dm-beta6-quick-action="true"] #ed-qa-type,.ed-form-row[data-dm-beta6-quick-action="true"] #ed-qa-name{width:100%!important;min-width:0!important;margin:0!important}#ed-qa-icon.dm-beta6-qa-icon-value{display:none!important}.dm-beta6-qa-icon-trigger{display:grid!important;place-items:center!important;width:58px!important;min-width:58px!important;max-width:58px!important;min-height:52px!important;margin:0!important;padding:8px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:16px!important;background:var(--card-background-color,#fff)!important;color:var(--info-color,#0284c7)!important}.dm-beta6-qa-icon-trigger ha-icon,.dm-beta6-quick-icon-grid ha-icon,#qa-grid .qa-btn .icon ha-icon{display:inline-flex!important}.dm-beta6-qa-icon-trigger ha-icon{--mdc-icon-size:30px!important}.dm-beta6-quick-icon-grid .dm-picker-option{min-height:104px!important}.dm-beta6-quick-icon-grid ha-icon{--mdc-icon-size:38px!important}#qa-grid .qa-btn .icon ha-icon{--mdc-icon-size:30px!important}
#ed-daily-chart{overflow:hidden!important}#ed-daily-chart .ed-chart-wrap{box-sizing:border-box!important;height:clamp(250px,52vw,320px)!important;max-height:320px!important;margin:8px 0 0!important;padding:0 8px 8px!important;overflow:hidden!important}#ed-daily-chart .ed-chart-wrap canvas{width:100%!important;height:100%!important;max-height:100%!important}
.dm-beta6-light-advanced{display:grid!important;gap:10px!important;margin:14px 0 0!important;padding:14px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:18px!important;background:var(--card-background-color,#fff)!important}.dm-beta6-light-advanced>header{display:flex!important;justify-content:space-between!important;gap:12px!important}.dm-beta6-light-advanced>header span,.dm-beta6-light-head small{font-size:11px!important;color:var(--secondary-text-color,#64748b)!important}.dm-beta6-light-control-list{display:grid!important;gap:10px!important}.dm-beta6-light-control{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(220px,1.4fr)!important;align-items:center!important;gap:14px!important;padding:12px!important;border-radius:15px!important;background:var(--card-background-color,#fff)!important}.dm-beta6-light-head{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important}.dm-beta6-light-dot{width:10px!important;height:10px!important;border-radius:50%!important;background:#94a3b8!important}.dm-beta6-light-dot.is-on{background:#f59e0b!important}.dm-beta6-light-tools{display:grid!important;grid-template-columns:minmax(160px,1fr) auto!important;gap:12px!important}.dm-beta6-dimmer{display:grid!important;grid-template-columns:1fr auto!important;gap:6px 10px!important}.dm-beta6-dimmer input{grid-column:1/-1!important;width:100%!important}.dm-beta6-color{display:grid!important;place-items:center!important;gap:5px!important}.dm-beta6-color input{width:42px!important;height:34px!important;border-radius:10px!important}
@media(max-width:760px){.ed-form-row[data-dm-beta6-quick-action="true"]{grid-template-columns:minmax(0,1fr) 56px!important}.ed-form-row[data-dm-beta6-quick-action="true"] #ed-qa-name{grid-column:1/-1!important}.dm-beta6-qa-icon-trigger{width:56px!important;min-width:56px!important;max-width:56px!important}.dm-beta6-quick-icon-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}#ed-daily-chart .ed-chart-wrap{height:252px!important;max-height:252px!important;padding:0 4px 6px!important}.dm-beta6-light-control{grid-template-columns:1fr!important}.dm-beta6-light-tools{grid-template-columns:minmax(0,1fr) 48px!important}}
`);}

export function installBeta6FeedbackSection(){if(!doc||state.installed)return;state.installed=true;installStyles();installOwners();root.addEventListener?.("dashboardmodern:legacy-ready",()=>{installOwners();schedule();});root.addEventListener?.("dashboardmodern:runtime-ready",()=>{installOwners();schedule();});doc.addEventListener("change",(event)=>{if(event.target?.id==="ed-qa-type"||event.target?.id==="ed-qa-icon")schedule();},true);doc.addEventListener("click",(event)=>{if(event.target?.closest?.('.ed-tab[data-tab="sez8"],#btn-lights,.dm-beta6-qa-icon-trigger'))root.setTimeout?.(schedule,0);},true);schedule();}
installBeta6FeedbackSection();
