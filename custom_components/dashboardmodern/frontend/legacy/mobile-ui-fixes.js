/* Runtime follow-up fixes shared by the hosted legacy dashboards. */

export function isGeneratedRoomName(value = "") {
  return /^room[-_][a-z0-9]{6,}$/i.test(String(value).trim());
}

function slug(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function inferApplianceEntity(device = {}, states = {}, kind = "energy") {
  const candidates = [
    device[`${kind}_entity`],
    device[`${kind}_today`],
    device.daily_energy_entity,
    device.monthly_energy_entity,
    device.total_energy_entity,
    ...(device.entities || []),
  ]
    .map((entry) => (typeof entry === "string" ? entry : entry?.entity))
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  const expected = kind === "power" ? /^(w|kw)$/i : /^(wh|kwh)$/i;
  const named =
    kind === "power"
      ? /power|potenza|watt/i
      : /energy|energia|kwh|consum|total|totale|mese|month/i;
  return (
    candidates.find((entityId) =>
      expected.test(String(states?.[entityId]?.attributes?.unit_of_measurement || "").trim()),
    ) ||
    candidates.find((entityId) => named.test(entityId)) ||
    ""
  );
}

function installBrowserFixes() {
  if (globalThis.__DASHBOARDMODERN_MOBILE_FOLLOWUP__) return;
  globalThis.__DASHBOARDMODERN_MOBILE_FOLLOWUP__ = true;

  let passQueued = false;
  let roomListSource = null;
  let entitySource = null;

  const getStoreSection = (section) => {
    try {
      return globalThis.DashboardModernModules?.store?.getSection?.(section) || [];
    } catch (_error) {
      return [];
    }
  };

  function currentAppliances() {
    const canonical = getStoreSection("appliances");
    if (Array.isArray(canonical) && canonical.length) return canonical;
    try {
      const legacy = globalThis.getAppliances?.();
      if (Array.isArray(legacy)) return legacy;
    } catch (_error) {}
    return [];
  }

  function applianceType(device) {
    try {
      return globalThis.cdApplianceType?.(device) || "generico";
    } catch (_error) {
      return String(device?.device_type || device?.type || device?.icon || "generico");
    }
  }

  function applianceMarkup(device, size = 52) {
    try {
      const markup = globalThis.cdApplianceVisual?.(device, size);
      if (markup) return markup;
    } catch (_error) {}
    try {
      return globalThis.cdApplianceIcon?.(applianceType(device), size) || "⚙️";
    } catch (_error) {
      return "⚙️";
    }
  }

  function restoreApplianceVisuals() {
    const appliances = currentAppliances();
    const cards = document.querySelectorAll("#page-appliances-main .appl-wide-card");
    cards.forEach((card, index) => {
      const id = card.dataset.applianceId;
      const name = String(card.querySelector(".appl-wide-name")?.textContent || "")
        .trim()
        .toLowerCase();
      const device =
        appliances.find((item) => id && String(item.id) === id) ||
        appliances.find((item) => String(item.name || "").trim().toLowerCase() === name) ||
        appliances[index];
      const visual = card.querySelector(".appl-ic");
      if (!device || !visual) return;
      const type = applianceType(device);
      const signature = [
        device.id,
        type,
        device.image || device.image_url || "",
        device.visual_type || "",
        device.visual_key || "",
        device.icon || "",
      ].join("|");
      if (visual.dataset.dmMediaSignature === signature) return;
      visual.dataset.dmMediaSignature = signature;
      visual.innerHTML = `<span class="dm-appliance-glyph dm-appliance-media" data-media-type="${type}">${applianceMarkup(device, 52)}<span class="dm-visually-hidden">${type}</span></span>`;
    });
  }

  function installRoomFilter() {
    const current = globalThis.cdLuciRoomList;
    if (typeof current !== "function" || current.__dmGhostRoomFilter) return;
    roomListSource = current;
    const wrapped = function () {
      const names = roomListSource.apply(this, arguments) || [];
      return [...new Set(names)].filter(
        (name) => !isGeneratedRoomName(name) && !isGeneratedRoomName(slug(name)),
      );
    };
    wrapped.__dmGhostRoomFilter = true;
    globalThis.cdLuciRoomList = wrapped;
  }

  function hideRenderedGhostRooms() {
    const body = document.getElementById("ed-body");
    if (!body || document.querySelector(".ed-tab.active")?.dataset?.tab !== "luci") return;
    [...body.children].forEach((section) => {
      const heading = section.firstElementChild;
      const text = String(heading?.textContent || "")
        .trim()
        .split(/\s+·/)[0]
        .replace(/^🏠\s*/, "");
      if (isGeneratedRoomName(text)) section.remove();
    });
  }

  function installEntityInference() {
    const current = globalThis.cdApplEntity;
    if (typeof current !== "function" || current.__dmUnitInference) return;
    entitySource = current;
    const wrapped = function (device, keys) {
      const existing = entitySource.apply(this, arguments);
      if (existing) return existing;
      const key = String(keys?.[0] || "");
      if (/energy/i.test(key))
        return inferApplianceEntity(device, globalThis.STATES || {}, "energy") || null;
      if (/power/i.test(key))
        return inferApplianceEntity(device, globalThis.STATES || {}, "power") || null;
      return null;
    };
    wrapped.__dmUnitInference = true;
    globalThis.cdApplEntity = wrapped;
  }

  function markActiveEditor() {
    const body = document.getElementById("ed-body");
    if (!body) return;
    const tab = document.querySelector(".ed-tab.active")?.dataset?.tab;
    body.classList.toggle("dm-lights-editor", tab === "luci");
  }

  function injectStyles() {
    if (document.getElementById("dm-mobile-readability-fixes")) return;
    const style = document.createElement("style");
    style.id = "dm-mobile-readability-fixes";
    style.textContent = `
      .dm-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      #page-appliances-main .dm-appliance-media{display:grid!important;place-items:center;width:52px;height:52px;line-height:1}
      #page-appliances-main .dm-appliance-media svg,#page-appliances-main .dm-appliance-media img,#page-appliances-main .dm-appliance-media ha-icon{display:block!important;width:52px!important;height:52px!important;max-width:100%;max-height:100%;object-fit:contain;visibility:visible!important;opacity:1!important;--mdc-icon-size:52px}
      @media(max-width:760px){
        #editor-modal .ed-head{padding:14px 14px 10px!important}
        #editor-modal .ed-tabs{overflow-x:auto!important;overflow-y:hidden!important;flex-wrap:nowrap!important;gap:3px!important;padding:7px 8px!important;scrollbar-width:none}
        #editor-modal .ed-tabs::-webkit-scrollbar{display:none}
        #editor-modal .ed-tab{flex:0 0 auto!important;min-width:max-content!important;padding:9px 10px!important;font-size:10.5px!important;white-space:nowrap!important}
        #editor-modal .ed-body{padding:12px 10px max(30px,env(safe-area-inset-bottom))!important}
        #editor-modal [data-editor="energy"] .ed-inner-tabs{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important;margin-bottom:12px!important;padding:4px!important}
        #editor-modal [data-editor="energy"] .ed-inner-tab{min-width:0!important;padding:9px 5px!important;font-size:9.5px!important;line-height:1.15!important;white-space:normal!important}
        #editor-modal [data-editor="energy"] .ed-acc{margin-bottom:9px!important;border-radius:15px!important}
        #editor-modal [data-editor="energy"] .ed-acc-head{padding:11px 12px!important;font-size:12px!important;gap:8px!important}
        #editor-modal [data-editor="energy"] .ed-acc-body{padding:10px!important;gap:8px!important}
        #editor-modal [data-editor="energy"] .ed-slot{gap:3px!important}
        #editor-modal [data-editor="energy"] .ed-slot-lbl{font-size:10.5px!important;line-height:1.25!important;display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:4px!important}
        #editor-modal [data-editor="energy"] .ed-hint{display:none!important}
        #editor-modal [data-editor="energy"] .ed-input{min-height:40px!important;padding:9px 10px!important;font-size:11px!important}
        #editor-modal [data-editor="energy"] .dm-entity-field{gap:3px!important;margin-bottom:3px!important}
        #editor-modal .dm-lights-editor>div:first-child,#editor-modal .dm-lights-editor .dm-lights-room-notice{font-size:11px!important;line-height:1.4!important;padding:9px 10px!important;margin-bottom:10px!important}
        #editor-modal .dm-lights-editor .ed-lrow{gap:6px!important;padding:8px!important;margin-bottom:6px!important}
        #editor-modal .dm-lights-editor .ed-lrow select.ed-input{flex-basis:38%!important;min-width:112px!important;padding:7px 6px!important;font-size:10.5px!important}
        #editor-modal .dm-lights-editor .ed-form{padding:12px!important;border-radius:15px!important}
        #editor-modal .dm-lights-editor .ed-input{min-height:40px!important;font-size:11px!important}
        #ed-pane-analisi .ed-weekly-card,#ed-pane-analisi .ed-devices-card{padding:16px 14px!important;border-radius:20px!important;margin-bottom:14px!important}
        #ed-pane-analisi .ed-weekly-title,#ed-pane-analisi .ed-devices-title{font-size:11px!important;letter-spacing:.8px!important;line-height:1.25!important}
        #ed-pane-analisi .ed-weekly-row{gap:7px!important}
        #ed-pane-analisi .ed-weekly-lbl{width:68px!important;font-size:10px!important}
        #ed-pane-analisi .ed-weekly-val{width:58px!important;font-size:10px!important}
        #ed-pane-analisi .ed-weekly-diff{padding:3px 6px!important;font-size:9px!important}
        #ed-pane-analisi .ed-devices-header{gap:8px!important;margin-bottom:12px!important;flex-wrap:wrap!important}
        #ed-pane-analisi .ed-devices-subtitle{font-size:9.5px!important}
        #ed-pane-analisi .ed-dev-select-wrap{display:grid!important;grid-template-columns:1fr!important;gap:5px!important;width:100%!important}
        #ed-pane-analisi .ed-dev-select{width:100%!important;min-width:0!important;padding:9px 10px!important;font-size:11px!important;text-overflow:ellipsis!important}
        #ed-pane-analisi .ed-dev-kpi-row{gap:6px!important}
        #ed-pane-analisi .ed-dev-kpi-box{min-width:0!important;padding:10px 5px!important;border-radius:13px!important}
        #ed-pane-analisi .ed-dev-kpi-box-val{font-size:17px!important}
        #ed-pane-analisi .ed-dev-kpi-box-lbl{font-size:8px!important;line-height:1.15!important;letter-spacing:.5px!important}
        #ed-pane-analisi .ed-dev-kpi-box-sub{font-size:9px!important}
        #page-appliances-main .dm-appliance-media,#page-appliances-main .dm-appliance-media svg,#page-appliances-main .dm-appliance-media img,#page-appliances-main .dm-appliance-media ha-icon{width:42px!important;height:42px!important;--mdc-icon-size:42px}
      }
      @media(max-width:420px){
        #editor-modal .dm-lights-editor .ed-lrow{flex-wrap:wrap!important}
        #editor-modal .dm-lights-editor .ed-lrow>div:nth-child(2){flex:1 1 calc(100% - 42px)!important}
        #editor-modal .dm-lights-editor .ed-lrow select.ed-input{order:5!important;flex:1 1 100%!important;width:100%!important;min-width:0!important;margin-left:34px!important}
      }
    `;
    document.head.append(style);
  }

  function runPass() {
    passQueued = false;
    installRoomFilter();
    installEntityInference();
    markActiveEditor();
    hideRenderedGhostRooms();
    restoreApplianceVisuals();
  }

  function queuePass() {
    if (passQueued) return;
    passQueued = true;
    setTimeout(runPass, 0);
  }

  injectStyles();
  new MutationObserver(queuePass).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  try {
    globalThis.DashboardModernModules?.store?.subscribe?.(queuePass);
  } catch (_error) {}
  queuePass();
  const timer = setInterval(() => {
    queuePass();
    if (
      globalThis.cdLuciRoomList?.__dmGhostRoomFilter &&
      globalThis.cdApplEntity?.__dmUnitInference
    ) {
      clearInterval(timer);
    }
  }, 150);
  setTimeout(() => clearInterval(timer), 10000);
}

if (typeof window !== "undefined" && typeof document !== "undefined") installBrowserFixes();
