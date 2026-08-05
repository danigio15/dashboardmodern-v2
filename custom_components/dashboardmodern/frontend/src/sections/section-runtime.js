import { installHostedBridgeGuard } from "../transport/hosted-bridge-guard.js";
import { installEnergySection } from "./energy-section.js";
import { installTemperatureSection } from "./temperature-section.js";
import { installAppliancesSection } from "./appliances-section.js";
import { installLightsAlertsSection } from "./lights-alerts-section.js";
import { installEditorCrudSection } from "./editor-crud-section.js";
import { installDataContractsSection } from "./data-contracts-section.js";
import { installEditorContractsSection } from "./editor-contracts-section.js";
import { installShutterSection } from "./shutter-section.js";

const root = globalThis;

export function installSectionRuntime() {
  installHostedBridgeGuard();
  installDataContractsSection();
  installEnergySection();
  installTemperatureSection();
  installAppliancesSection();
  installLightsAlertsSection();
  installEditorCrudSection();
  installEditorContractsSection();
  installShutterSection();
  root.__DASHBOARDMODERN_SECTION_RUNTIME__ = Object.freeze({
    installed: true,
    sections: [
      "data-contracts",
      "energy",
      "temperature",
      "appliances",
      "lights-alerts",
      "editor-crud",
      "editor-contracts",
      "shutters",
    ],
  });
  return root.__DASHBOARDMODERN_SECTION_RUNTIME__;
}

installSectionRuntime();
