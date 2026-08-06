import { installHostedBridgeGuard } from "../transport/hosted-bridge-guard.js";
import { installDataContractsSection } from "./data-contracts-section.js";
import { installEnergySection } from "./energy-section.js";
import { installEnergyStabilitySection } from "./energy-stability-section.js";
import { installEnergyGuidanceSection } from "./energy-guidance-section.js";
import { installEnergyConfigSection } from "./energy-config-section.js";
import { installEnergyFlowSection } from "./energy-flow-section.js";
import { installTemperatureSection } from "./temperature-section.js";
import { installTemperatureLayoutSection } from "./temperature-layout-section.js";
import { installAppliancesSection } from "./appliances-section.js";
import { installApplianceLayoutSection } from "./appliance-layout-section.js";
import { installApplianceEditorSection } from "./appliance-editor-section.js";
import { installLightsAlertsSection } from "./lights-alerts-section.js";
import { installAlertsSection } from "./alerts-section.js";
import { installUnifiedEditorsSection } from "./unified-editors-section.js";
import { installEditorCrudSection } from "./editor-crud-section.js";
import { installEditorContractsSection } from "./editor-contracts-section.js";
import { installReportEditorSection } from "./report-editor-section.js";
import { installShutterSection } from "./shutter-section.js";
import { installShutterAlertLayoutSection } from "./shutter-alert-layout-section.js";
import { installEvSection } from "./ev-section.js";

const root = globalThis;
const RUNTIME_KEY = "__DASHBOARDMODERN_SECTION_RUNTIME__";
const INSTALLING_KEY = "__DASHBOARDMODERN_SECTION_RUNTIME_INSTALLING__";

export function installSectionRuntime() {
  if (root[RUNTIME_KEY]?.installed) return root[RUNTIME_KEY];
  if (root[INSTALLING_KEY]) return root[RUNTIME_KEY] || null;

  root[INSTALLING_KEY] = true;
  try {
    installHostedBridgeGuard();
    installDataContractsSection();
    installEnergySection();
    installEnergyStabilitySection();
    installEnergyGuidanceSection();
    installEnergyConfigSection();
    installEnergyFlowSection();
    installTemperatureSection();
    installTemperatureLayoutSection();
    installAppliancesSection();
    installApplianceLayoutSection();
    installApplianceEditorSection();
    installLightsAlertsSection();
    installAlertsSection();
    installUnifiedEditorsSection();
    installEditorCrudSection();
    installEditorContractsSection();
    installReportEditorSection();
    installShutterSection();
    installShutterAlertLayoutSection();
    installEvSection();

    root[RUNTIME_KEY] = Object.freeze({
      installed: true,
      sections: [
        "data-contracts",
        "energy",
        "energy-stability",
        "energy-guidance",
        "energy-config",
        "energy-flow",
        "temperature",
        "temperature-layout",
        "appliances",
        "appliance-layout",
        "appliance-editor",
        "lights",
        "alerts",
        "unified-editors",
        "editor-crud",
        "editor-contracts",
        "report-editor",
        "shutters",
        "shutter-alert-layout",
        "ev",
      ],
    });
    return root[RUNTIME_KEY];
  } finally {
    delete root[INSTALLING_KEY];
  }
}

installSectionRuntime();
