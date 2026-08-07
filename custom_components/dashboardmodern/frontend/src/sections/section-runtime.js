import { installHostedBridgeGuard } from "../transport/hosted-bridge-guard.js";
import { installStateEventGate } from "../core/state-event-gate.js";
import { installDataContractsSection } from "./data-contracts-section.js";
import { installEnergyCalculationsSection } from "./energy-calculations-section.js";
import { installEnergyServicesSection } from "./energy-services-section.js";
import { installEnergySection } from "./energy-section.js";
import { installEnergyStabilitySection } from "./energy-stability-section.js";
import { installEnergyGuidanceSection } from "./energy-guidance-section.js";
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
import { installHomeSection } from "./home-section.js";
import { installClimateSection } from "./climate-section.js";
import { installSecuritySection } from "./security-section.js";
import { installSolarThermalSection } from "./solar-thermal-section.js";
import { installPoolSection } from "./pool-section.js";
import { installIrrigationSection } from "./irrigation-section.js";
import { installMiniPcSection } from "./minipc-section.js";

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
    installHomeSection();
    installEnergyCalculationsSection();
    installEnergyServicesSection();
    installEnergySection();
    // Energy starts the Home Assistant broker asynchronously. Install the gate
    // immediately afterwards, before the get_states snapshot can be ingested.
    installStateEventGate(root.DashboardModernEnergyService?.broker, root);
    installEnergyStabilitySection();
    installEnergyGuidanceSection();
    installEnergyFlowSection();
    installTemperatureSection();
    installTemperatureLayoutSection();
    installAppliancesSection();
    installApplianceLayoutSection();
    installApplianceEditorSection();
    installLightsAlertsSection();
    installAlertsSection();
    installClimateSection();
    installSecuritySection();
    installSolarThermalSection();
    installPoolSection();
    installIrrigationSection();
    installMiniPcSection();
    installUnifiedEditorsSection();
    installEditorCrudSection();
    installEditorContractsSection();
    installReportEditorSection();
    installShutterSection();
    installShutterAlertLayoutSection();
    installEvSection();

    root[RUNTIME_KEY] = Object.freeze({
      installed: true,
      sections: Object.freeze([
        "data-contracts",
        "home",
        "energy-calculations",
        "energy-services",
        "energy",
        "state-event-gate",
        "energy-stability",
        "energy-guidance",
        "energy-flow",
        "temperature",
        "temperature-layout",
        "appliances",
        "appliance-layout",
        "appliance-editor",
        "lights",
        "alerts",
        "climate",
        "security",
        "solar-thermal",
        "pool",
        "irrigation",
        "minipc",
        "unified-editors",
        "editor-crud",
        "editor-contracts",
        "report-editor",
        "shutters",
        "shutter-alert-layout",
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
