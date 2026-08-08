import { installHostedBridgeGuard } from "../transport/hosted-bridge-guard.js";
import { installStateEventGate } from "../core/state-event-gate.js";
import { installDataContractsSection } from "./data-contracts-section.js";
import { installEnergyCalculationsSection } from "./energy-calculations-section.js";
import { installEnergyServicesSection } from "./energy-services-section.js";
import { installEnergySection } from "./energy-section.js";
import { installEnergyLegacyGuardSection } from "./energy-legacy-guard-section.js";
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
    installStateEventGate(root.DashboardModernEnergyService?.broker, root);
    installEnergyLegacyGuardSection();
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
        "state-event-gate",
        "energy-legacy-guard",
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
