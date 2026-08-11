import { installStyle } from "./shared.js";

// The beta11 compatibility layer intentionally performs one last room-row repair
// 80ms after the editor renders. It preserves data-room-icon, so beta12 can use
// that stable semantic token as the visual owner and cannot regress to a blue
// outline even when the delayed compatibility pass rewrites the child markup.
const STYLE_ID = "dm-beta12-room-color-lock-style";

installStyle(STYLE_ID, `
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]{
    position:relative!important;display:grid!important;place-items:center!important;
    color:initial!important;overflow:visible!important
  }
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]>*{display:none!important}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon]::before{
    content:"🏠";display:grid!important;place-items:center!important;width:100%!important;height:100%!important;
    font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif!important;font-size:31px!important;
    font-style:normal!important;font-weight:400!important;line-height:1!important;color:initial!important;
    filter:drop-shadow(0 5px 8px rgba(15,23,42,.12))!important
  }
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:sofa"]::before{content:"🛋️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:stove"]::before{content:"🍳"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:bed-king-outline"]::before{content:"🛏️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:teddy-bear"]::before{content:"🧸"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:baby-face-outline"]::before{content:"👶"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:shower"]::before{content:"🚿"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:toilet"]::before{content:"🚽"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:table-chair"]::before{content:"🍽️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:desk"]::before{content:"💻"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:account-group-outline"]::before{content:"🛏️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:door-open"]::before,
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:door"]::before{content:"🚪"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:washing-machine"]::before{content:"🧺"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:food-variant"]::before{content:"🥫"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:hanger"]::before{content:"👗"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:archive-outline"]::before{content:"📦"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:balcony"]::before{content:"🌇"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:patio-heater"]::before{content:"🌤️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:garage"]::before{content:"🚗"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:glass-wine"]::before{content:"🍷"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:home-roof"]::before{content:"🏠"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:tools"]::before{content:"🛠️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:dumbbell"]::before{content:"🏋️"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:movie-open-outline"]::before{content:"🎬"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:flower"]::before{content:"🌿"}
  #editor-modal #ed-body .dm-room-list-icon[data-room-icon="mdi:pool"]::before{content:"🏊"}
`);
