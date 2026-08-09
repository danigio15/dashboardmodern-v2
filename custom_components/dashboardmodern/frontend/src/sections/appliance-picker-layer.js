const STYLE_ID = "dm-appliance-picker-layer-style";

export function installAppliancePickerLayer(doc = globalThis.document) {
  if (!doc?.head) return false;
  if (doc.getElementById(STYLE_ID)) return true;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* The canonical appliance picker may be opened from inside the Edit modal.
       Keep it above every editor overlay so its visible options also own pointer events. */
    #dm-applpick.dm-appliance-type-picker {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
    }
    #dm-applpick .dm-appliance-type-picker-dialog,
    #dm-applpick .dm-appliance-type-grid,
    #dm-applpick .dm-appliance-type-option {
      pointer-events: auto !important;
    }
  `;
  doc.head.append(style);
  return true;
}
