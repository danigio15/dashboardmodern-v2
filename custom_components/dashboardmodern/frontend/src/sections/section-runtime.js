import { installHostedBridgeGuard } from "../transport/hosted-bridge-guard.js";
import { installStateEventGate } from "../core/state-event-gate.js";
import { installDataContractsSection } from "./data-contracts-section.js";
import { installEnergyCalculationsSection } from "./energy-calculations-section.js";
import { installEnergyServicesSection } from "./energy-services-section.js";
import { installEnergySection } from "./energy-section.js";
import { installEnergyRefreshSection } from "./energy-refresh-section.js";
import { installEnergyLegacyGuardSection } from "./energy-legacy-guard-section.js";
import { installEnergyStabilitySection } from "./energy-stability-section.js";
import { installEnergyGuidanceSection } from "./energy-guidance-section.js";
import { installEnergyFlowSection } from "./energy-flow-section.js";
import { installEnergyAnalysisSection } from "./energy-analysis-section.js";
import { installHistorySection } from "./history-section.js";
import { installTemperatureSection } from "./temperature-section.js";
import { installTemperatureLayoutSection } from "./temperature-layout-section.js";
import { installAppliancesSection } from "./appliances-section.js";
import { installApplianceLayoutSection } from "./appliance-layout-section.js";
import { installApplianceEditorSection } from "./appliance-editor-section.js";
import { installLightsAlertsSection } from "./lights-alerts-section.js";
import { installAlertsSection } from "./alerts-section.js";
import { installLiveUiSection } from "./live-ui-section.js";
import { installNavigationSection } from "./navigation-section.js";
import { installUnifiedEditorsSection } from "./unified-editors-section.js";
import { installEditorCrudSection } from "./editor-crud-section.js";
import { installEditorContractsSection } from "./editor-contracts-section.js";
import { installReportEditorSection } from "./report-editor-section.js";
import { installShutterSection } from "./shutter-section.js";
import { installEvSection } from "./ev-section.js";
import { installLegacySections, LEGACY_SECTION_KEYS } from "./legacy-sections-registry.js";

const root = globalThis;
const RUNTIME_KEY = "__DASHBOARDMODERN_SECTION_RUNTIME__";
const INSTALLING_KEY = "__DASHBOARDMODERN_SECTION_RUNTIME_INSTALLING__";
const APPLIANCE_PICKER_LAYER_STYLE_ID = "dm-appliance-picker-layer-style";
const APPLIANCE_DAILY_POPUP_STYLE_ID = "dm-appliance-daily-dashboard-style";

function installAppliancePickerLayer() {
  const doc = root.document;
  if (!doc?.head || doc.getElementById(APPLIANCE_PICKER_LAYER_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = APPLIANCE_PICKER_LAYER_STYLE_ID;
  style.textContent = `
    /* The canonical appliance picker may be opened from inside the Edit modal.
       Keep it above every editor overlay so visible options also own pointer input. */
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
}

function installApplianceDailyPopupStyle() {
  const doc = root.document;
  if (!doc?.head || doc.getElementById(APPLIANCE_DAILY_POPUP_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = APPLIANCE_DAILY_POPUP_STYLE_ID;
  style.textContent = `
    /* Daily appliance breakdown follows the same soft cards and cyan accents
       used by the Appliances dashboard. Technical entity/source labels stay
       available to the runtime but are deliberately not visible to the user. */
    #dm-appliance-daily-popup.dm-appliance-daily-overlay {
      background:rgba(30,41,59,.42)!important;
      backdrop-filter:blur(15px) saturate(120%)!important;
      -webkit-backdrop-filter:blur(15px) saturate(120%)!important;
      padding:18px!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-dialog {
      width:min(620px,100%)!important;
      max-height:min(82vh,760px)!important;
      border:1px solid rgba(148,163,184,.24)!important;
      border-radius:34px!important;
      background:
        radial-gradient(circle at 8% 2%,rgba(125,211,252,.24),transparent 33%),
        radial-gradient(circle at 94% 18%,rgba(167,243,208,.18),transparent 30%),
        linear-gradient(180deg,rgba(255,255,255,.99),rgba(244,249,255,.98))!important;
      box-shadow:0 26px 80px rgba(15,23,42,.30)!important;
      overflow:hidden!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-head {
      padding:26px 26px 15px!important;
      align-items:flex-start!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-head small {
      display:inline-flex!important;
      align-items:center!important;
      min-height:28px!important;
      padding:0 12px!important;
      border:1px solid rgba(14,165,233,.18)!important;
      border-radius:999px!important;
      background:rgba(224,242,254,.72)!important;
      color:#0284c7!important;
      font-size:10px!important;
      font-weight:900!important;
      letter-spacing:2px!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-head h3 {
      margin:8px 0 0!important;
      color:#111827!important;
      font-size:clamp(24px,4vw,32px)!important;
      font-weight:950!important;
      line-height:1.04!important;
      letter-spacing:1.1px!important;
      text-transform:uppercase!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-head button {
      width:48px!important;
      height:48px!important;
      flex:0 0 48px!important;
      border:1px solid rgba(148,163,184,.18)!important;
      border-radius:17px!important;
      background:rgba(248,250,252,.92)!important;
      color:#0f172a!important;
      box-shadow:0 8px 24px rgba(15,23,42,.07)!important;
      font-size:21px!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-total {
      position:relative!important;
      min-height:108px!important;
      margin:0 26px 18px!important;
      padding:22px 24px 22px 92px!important;
      overflow:hidden!important;
      border:1px solid rgba(14,165,233,.18)!important;
      border-radius:26px!important;
      background:linear-gradient(135deg,rgba(224,242,254,.96),rgba(240,249,255,.84))!important;
      box-shadow:0 13px 34px rgba(14,165,233,.10)!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-total::before {
      content:"⚡";
      position:absolute;
      left:22px;
      top:50%;
      width:54px;
      height:54px;
      transform:translateY(-50%);
      display:grid;
      place-items:center;
      border:1px solid rgba(14,165,233,.16);
      border-radius:19px;
      background:rgba(255,255,255,.78);
      box-shadow:0 8px 24px rgba(14,165,233,.10);
      font-size:30px;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-total span {
      color:#64748b!important;
      font-size:12px!important;
      font-weight:900!important;
      letter-spacing:1.6px!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-total strong {
      color:#0797d5!important;
      font-size:clamp(27px,5vw,38px)!important;
      font-weight:950!important;
      letter-spacing:-1px!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-list {
      gap:12px!important;
      padding:0 26px 26px!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row {
      position:relative!important;
      min-height:92px!important;
      padding:17px 18px 17px 88px!important;
      overflow:hidden!important;
      border:1px solid rgba(148,163,184,.20)!important;
      border-radius:24px!important;
      background:rgba(255,255,255,.90)!important;
      box-shadow:0 10px 30px rgba(15,23,42,.07)!important;
      transition:transform .16s ease,box-shadow .16s ease!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row::before {
      content:"⚡";
      position:absolute;
      left:18px;
      top:50%;
      width:54px;
      height:54px;
      transform:translateY(-50%);
      display:grid;
      place-items:center;
      border-radius:18px;
      background:linear-gradient(145deg,#e0f2fe,#f0f9ff);
      color:#0284c7;
      box-shadow:inset 0 0 0 1px rgba(14,165,233,.12),0 8px 22px rgba(14,165,233,.09);
      font-size:25px;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row:hover {
      transform:translateY(-1px)!important;
      box-shadow:0 14px 34px rgba(15,23,42,.10)!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row-main {
      gap:0!important;
      justify-content:center!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row-main strong {
      color:#111827!important;
      font-size:18px!important;
      font-weight:900!important;
      line-height:1.15!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row-main small {
      display:none!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row-value {
      gap:4px!important;
      justify-content:center!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row-value strong {
      color:#078dc7!important;
      font-size:19px!important;
      font-weight:950!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-row-value small {
      min-width:45px!important;
      padding:4px 8px!important;
      border-radius:999px!important;
      background:#e0f2fe!important;
      color:#0369a1!important;
      font-size:10px!important;
      font-weight:900!important;
      text-align:center!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-empty {
      margin-bottom:4px!important;
      border:1px solid rgba(148,163,184,.18)!important;
      border-radius:22px!important;
      background:rgba(255,255,255,.76)!important;
      color:#64748b!important;
    }
    #dm-appliance-daily-popup .dm-appliance-daily-note {
      display:none!important;
    }
    @media(max-width:520px) {
      #dm-appliance-daily-popup.dm-appliance-daily-overlay {
        align-items:flex-end!important;
        padding:10px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-dialog {
        max-height:86vh!important;
        border-radius:32px 32px 22px 22px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-head {
        padding:22px 18px 13px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-head h3 {
        font-size:27px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-head button {
        width:46px!important;
        height:46px!important;
        flex-basis:46px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-total {
        min-height:96px!important;
        margin:0 18px 14px!important;
        padding:18px 18px 18px 82px!important;
        border-radius:23px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-total::before {
        left:17px;
        width:50px;
        height:50px;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-list {
        gap:10px!important;
        padding:0 18px max(20px,env(safe-area-inset-bottom))!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-row {
        min-height:84px!important;
        padding:14px 14px 14px 78px!important;
        border-radius:21px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-row::before {
        left:14px;
        width:50px;
        height:50px;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-row-main strong {
        font-size:17px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-row-value strong {
        font-size:17px!important;
      }
    }
  `;
  doc.head.append(style);
}

export function installSectionRuntime() {
  if (root[RUNTIME_KEY]?.installed) return root[RUNTIME_KEY];
  if (root[INSTALLING_KEY]) return root[RUNTIME_KEY] || null;

  root[INSTALLING_KEY] = true;
  try {
    installHostedBridgeGuard();
    installLegacySections();
    installDataContractsSection();
    installEnergyCalculationsSection();
    installEnergyServicesSection();
    installEnergySection();
    installEnergyRefreshSection();
    installStateEventGate(root.DashboardModernEnergyService?.broker, root);
    installEnergyLegacyGuardSection();
    installEnergyStabilitySection();
    installEnergyGuidanceSection();
    installEnergyFlowSection();
    installEnergyAnalysisSection();
    installHistorySection();
    installTemperatureSection();
    installTemperatureLayoutSection();
    installAppliancesSection();
    installApplianceLayoutSection();
    installApplianceDailyPopupStyle();
    installAppliancePickerLayer();
    installApplianceEditorSection();
    installLightsAlertsSection();
    installAlertsSection();
    installLiveUiSection();
    installNavigationSection();
    installUnifiedEditorsSection();
    installEditorCrudSection();
    installEditorContractsSection();
    installReportEditorSection();
    installShutterSection();
    installEvSection();

    root[RUNTIME_KEY] = Object.freeze({
      installed: true,
      sections: Object.freeze([
        "data-contracts",
        ...LEGACY_SECTION_KEYS,
        "energy-calculations",
        "energy-services",
        "energy",
        "energy-refresh",
        "state-event-gate",
        "energy-legacy-guard",
        "energy-stability",
        "energy-guidance",
        "energy-flow",
        "energy-analysis",
        "history",
        "temperature",
        "temperature-layout",
        "appliances",
        "appliance-layout",
        "appliance-editor",
        "lights",
        "alerts",
        "live-ui",
        "navigation",
        "unified-editors",
        "editor-crud",
        "editor-contracts",
        "report-editor",
        "shutters",
        "ev",
      ]),
      registry: root.__DASHBOARDMODERN_SECTIONS__,
      energyServices: root.__DASHBOARDMODERN_ENERGY_SERVICES__,
    });
    return root[RUNTIME_KEY];
  } finally {
    delete root[INSTALLING_KEY];
  }
}

installSectionRuntime();
