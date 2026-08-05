import { installHostedBridgeGuard } from "../transport/hosted-bridge-guard.js";
import { installEnergySection } from "./energy-section.js";
import { installTemperatureSection } from "./temperature-section.js";
import { installAppliancesSection } from "./appliances-section.js";
import { installLightsAlertsSection } from "./lights-alerts-section.js";
import { installEditorCrudSection } from "./editor-crud-section.js";

const root = globalThis;

export function installSectionRuntime() {
  installHostedBridgeGuard();
  installEnergySection();
  installTemperatureSection();
  installAppliancesSection();
  installLightsAlertsSection();
  installEditorCrudSection();
  root.__DASHBOARDMODERN_SECTION_RUNTIME__ = Object.freeze({
    installed: true,
    sections: ["energy", "temperature", "appliances", "lights-alerts", "editor-crud"],
  });
  return root.__DASHBOARDMODERN_SECTION_RUNTIME__;
}

installSectionRuntime();
