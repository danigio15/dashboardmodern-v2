import { el } from "../render/dom.js";
let activeClose=null, seq=0;
function focusables(panel){return [...panel.querySelectorAll?.("button,input,select,textarea,a,[tabindex]")||[]].filter((n)=>!n.disabled&&n.getAttribute?.("aria-disabled")!=="true"&&n.getAttribute?.("aria-hidden")!=="true"&&n.getAttribute?.("hidden")===undefined&&n.getAttribute?.("tabindex")!=="-1"&&(n.tagName!=="a"||n.getAttribute?.("href")));}
export function openSharedDetailPanel({ render, trigger=null, label="Detail panel" }={}){
  activeClose?.();
  const doc=globalThis.document;
  let host=doc?.querySelector?.("[data-dashboardmodern-detail-host]");
  if(!host){host=el("div",{className:"dm-detail-host dm-detail-modal-overlay",attrs:{"data-dashboardmodern-detail-host":"",role:"presentation","data-detail-mode":"modal-overlay"}});doc?.body?.append?.(host);}
  let closed=false;
  const id=`dm-detail-panel-${++seq}`;
  const close=()=>{if(closed)return;closed=true;panel?.cleanup?.();host.replaceChildren?.();host.remove?.();doc?.removeEventListener?.("keydown",onGlobalKey);host?.removeEventListener?.("click",onBackdrop);if(activeClose===close)activeClose=null;trigger?.focus?.();};
  const onBackdrop=(event)=>{if(event.target===host)close();};
  const onGlobalKey=(event)=>{if(event.key==="Escape"){event.preventDefault?.();close();}};
  const panel=render({ close, id });
  panel?.setAttribute?.("role",panel.getAttribute?.("role")||"dialog");
  panel?.setAttribute?.("aria-modal",panel.getAttribute?.("aria-modal")||"true");
  panel?.setAttribute?.("aria-label",panel.getAttribute?.("aria-label")||label);
  panel?.setAttribute?.("data-shared-detail-panel",id);
  panel?.addEventListener?.("keydown",(event)=>{if(event.key!=="Tab")return;const f=focusables(panel);if(!f.length)return;const first=f[0],last=f.at(-1),active=doc?.activeElement;if(event.shiftKey&&active===first){event.preventDefault?.();last.focus?.();}else if(!event.shiftKey&&active===last){event.preventDefault?.();first.focus?.();}});
  host.replaceChildren?.(panel);
  doc?.addEventListener?.("keydown",onGlobalKey);
  host?.addEventListener?.("click",onBackdrop);
  activeClose=close;
  (focusables(panel)[0]||panel)?.focus?.();
  return { host, panel, close };
}
export function closeSharedDetailPanel(){activeClose?.();}
