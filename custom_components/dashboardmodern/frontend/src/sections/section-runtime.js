import { applianceArtwork, canonicalArtworkType } from "../core/appliance-artwork.js";
import { applianceHeroArtwork } from "../core/appliance-hero-artwork.js";
import { createApplianceViewModel } from "../core/appliance-view-model.js";
import { installStateEventGate } from "../core/state-event-gate.js";
import { installHostedBridgeGuard } from "../transport/hosted-bridge-guard.js";
import { installI18nSection } from "./i18n-section.js";
import { installThemeFoundationSection } from "./theme-foundation-section.js";
import { installIconeLeggibiliSection } from "./icone-leggibili-section.js";
import { installDataContractsSection } from "./data-contracts-section.js";
import { installEnergyCalculationsSection } from "./energy-calculations-section.js";
import { installEnergyServicesSection } from "./energy-services-section.js";
import { installEnergySection } from "./energy-section.js";
import { installEnergySignedSection } from "./energy-signed-section.js";
import { installEnergyRefreshSection } from "./energy-refresh-section.js";
import { installEnergyLegacyGuardSection } from "./energy-legacy-guard-section.js";
import { installEnergyStabilitySection } from "./energy-stability-section.js";
import { installEnergyGuidanceSection } from "./energy-guidance-section.js";
import { installEnergyFlowSection } from "./energy-flow-section.js";
import { installEnergyLoadsEditor } from "./energy-loads-editor-section.js";
import { installSubloadPopupSection } from "./subload-popup-section.js";
import { installApplianceDetailPopupSection } from "./appliance-detail-popup-section.js";
import { installEnergyAnalysisSection } from "./energy-analysis-section.js";
import { installHistorySection } from "./history-section.js";
import { installTemperatureSection } from "./temperature-section.js";
import { installTemperatureLayoutSection } from "./temperature-layout-section.js";
import { installTemperatureTrendSection } from "./temperature-trend-section.js";
import { installAppliancesSection } from "./appliances-section.js";
import { installApplianceLayoutSection } from "./appliance-layout-section.js";
import { installBeta27ReleaseStability } from "./beta27-release-stability-section.js";
import { installApplianceShowcaseSection } from "./appliance-showcase-section.js";
import { installApplianceEditorSection } from "./appliance-editor-section.js";
import { installLightsAlertsSection } from "./lights-alerts-section.js";
import { installLightsSceneSection } from "./lights-scene-section.js";
import { installLightsPageSection } from "./lights-page-section.js";
import { installAlertsSection } from "./alerts-section.js";
import { installFloodAlertsSection } from "./flood-alerts-section.js";
import { installSmokeAlertsSection } from "./smoke-alerts-section.js";
import { installEnglishRuntimeStrings } from "./english-runtime-strings-section.js";
import { installLiveUiSection } from "./live-ui-section.js";
import { installConnectionRecoverySection } from "./connection-recovery-section.js";
import { installAlarmModesEditorSection } from "./alarm-modes-editor-section.js";
import { installQuickClimateEditorSection } from "./quick-climate-editor-section.js";
import { installSecurityShowcaseSection } from "./security-showcase-section.js";
import { installSecurityDoorsSection } from "./security-doors-section.js";
import { installSecurityDoorsEditorSection } from "./security-doors-editor-section.js";
import { installTelecameraRtsp } from "./telecamera-rtsp-section.js";
import { installCentraliAllarmeEditor } from "./centrali-allarme-editor-section.js";
import { installOrologio } from "./orologio-section.js";
import { installTelecameraVivo } from "./telecamera-vivo-section.js";
import { installClimateThermalSection } from "./climate-thermal-section.js";
import { installTermicoDelCaldo } from "./termico-del-caldo-section.js";
import { installPopupClimaDistingue } from "./il-popup-del-clima-distingue-section.js";
import { installPopupAutoRacconta } from "./il-popup-dell-auto-racconta-section.js";
import { installPopupLavatrice } from "./il-popup-della-lavatrice-section.js";
import { installNavigationSection } from "./navigation-section.js";
import { installUnifiedEditorsSection } from "./unified-editors-section.js";
import { installEntitySearchSection } from "./entity-search-section.js";
import { installEntityAutodetectSection } from "./entity-autodetect-section.js";
import { installEditorCrudSection } from "./editor-crud-section.js";
import { installEditorContractsSection } from "./editor-contracts-section.js";
import { installReportEditorSection } from "./report-editor-section.js";
import { installShutterSection } from "./shutter-section.js";
import { installPageMastheadSection } from "./page-masthead-section.js";
import { installAzioniRapideVassoio } from "./azioni-rapide-vassoio-section.js";
import { installAzioniServizioGiusto } from "./azioni-servizio-giusto-section.js";
import { installFoglioDelGuscio } from "./foglio-del-guscio-section.js";
import { installStrisceDiLinguette } from "./le-strisce-di-linguette-section.js";
import { installWeatherInMasthead } from "./weather-in-masthead-section.js";
import { installShutterSceneSection } from "./shutter-scene-section.js";
import { installClimatePowerSection } from "./climate-power-section.js";
import { installShutterSkySection } from "./shutter-sky-section.js";
import { installShutterWindowSection } from "./shutter-window-section.js";
import { installPoolIrrigationSceneSection } from "./pool-irrigation-scene-section.js";
import { installPoolExtraSection } from "./pool-extra-section.js";
import { installPoolEditorSection } from "./pool-editor-section.js";
import { installRobotSection } from "./robot-section.js";
import { installPreseSection } from "./prese-section.js";
import { installEnergyPlantsSection } from "./energy-plants-section.js";
import { installRoomAssignSection } from "./room-assign-section.js";
import { installRoomsPageSection } from "./rooms-page-section.js";
import { installRoomsOrderEditor } from "./rooms-order-editor-section.js";
import { installRobotEditorSection } from "./robot-editor-section.js";
import { installEditorEntrySection } from "./editor-entry-section.js";
import { installEvSection } from "./ev-section.js";
import { installMediaPickerSection } from "./media-picker-section.js";
import { installPeopleSection } from "./people-section.js";
import { installPeopleEditorSection } from "./people-editor-section.js";
import { installBackupEditorSection } from "./backup-editor-section.js";
import { installHomeWidgetsSection } from "./home-widgets-section.js";
import { installTodoEditorSection } from "./todo-editor-section.js";
import { installWidgetEntityChoiceSection } from "./widget-entity-choice-section.js";
import { installEvShowcaseSection } from "./ev-showcase-section.js";
import { installEditorSlotsSection } from "./editor-slots-section.js";
import { installConfigUniformitySection } from "./config-uniformity-section.js";
import { installSolarThermalDesignSection } from "./solar-thermal-design-section.js";
import { installImpiantiTermiciSection } from "./impianti-termici-section.js";
import { installImpiantiTermiciEditor } from "./impianti-termici-editor-section.js";
import { installUpsSection } from "./ups-section.js";
import { installCalendarioSection } from "./calendario-section.js";
import { installUpsEditor } from "./ups-editor-section.js";
import { installAgendaEditorSection } from "./agenda-editor-section.js";
import { installLinguaSection } from "./lingua-section.js";
import { installSezioniMie } from "./sezioni-mie-section.js";
import { installSezioniMieEditor } from "./sezioni-mie-editor-section.js";
import { installEntitaMie } from "./entita-mie-section.js";
import { installEntitaMieEditor } from "./entita-mie-editor-section.js";
import { installRadarMeteo } from "./radar-meteo-section.js";
import { installMinipcShowcaseSection } from "./minipc-showcase-section.js";
import { installLegacySections, LEGACY_SECTION_KEYS } from "./legacy-sections-registry.js";
import { activeLocale, allStates, clean, english, section, t, wrapFunction } from "./shared.js";

const root = globalThis;
const RUNTIME_KEY = "__DASHBOARDMODERN_SECTION_RUNTIME__";
const INSTALLING_KEY = "__DASHBOARDMODERN_SECTION_RUNTIME_INSTALLING__";
const APPLIANCE_PICKER_LAYER_STYLE_ID = "dm-appliance-picker-layer-style";
const APPLIANCE_DAILY_POPUP_STYLE_ID = "dm-appliance-daily-dashboard-style";
const APPLIANCE_KPI_POPUP_STYLE_ID = "dm-appliance-kpi-popup-style";
const APPLIANCE_KPI_STATE_KEY = "__DASHBOARDMODERN_APPLIANCE_KPI_POPUPS__";

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
        align-items:center!important;
        justify-content:center!important;
        padding:14px!important;
      }
      #dm-appliance-daily-popup .dm-appliance-daily-dialog {
        width:min(620px,calc(100vw - 28px))!important;
        max-height:min(82vh,720px)!important;
        border-radius:32px!important;
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
        padding:0 18px 18px!important;
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

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applianceKpiModels() {
  const appliances = section("appliances", []);
  if (!Array.isArray(appliances)) return [];
  const rooms = section("rooms", []);
  const states = allStates();
  const locale = activeLocale();
  return appliances.map((device) => createApplianceViewModel(device, states, rooms, locale));
}

function applianceKpiCard(kind) {
  const doc = root.document;
  const grid = doc?.getElementById("appl-kpi-grid");
  if (!grid) return null;
  const mounted = grid.querySelector(`[data-dm-appliance-kpi="${kind}"]`);
  if (mounted) return mounted;
  const patterns = {
    running:
      /dispositivi\s+accesi|devices\s+on|active\s+devices|powered\s+on|in\s+funzione|running/i,
    power: /consumo\s+istantaneo|instant(?:aneous)?\s+(?:power|consumption)|power\s+now/i,
    daily: /energia\s+giornaliera|daily\s+energy/i,
    alerts: /avvisi|alerts|warnings/i,
  };
  const pattern = patterns[kind];
  if (!pattern) return null;
  return (
    [...grid.querySelectorAll(".glance-card")].find((card) =>
      pattern.test(clean(card.textContent)),
    ) || null
  );
}

function applianceKpiLabelNode(card, kind) {
  if (!card) return null;
  const patterns = {
    running:
      /dispositivi\s+accesi|devices\s+on|active\s+devices|powered\s+on|in\s+funzione|running/i,
    power: /consumo\s+istantaneo|instant(?:aneous)?\s+(?:power|consumption)|power\s+now/i,
  };
  const preferred = card.querySelector(".g-label,.glance-label,[data-glance-label]");
  if (preferred) return preferred;
  const pattern = patterns[kind];
  return (
    [...card.querySelectorAll("span,small,div")].find(
      (node) => node.childElementCount === 0 && pattern?.test(clean(node.textContent)),
    ) || null
  );
}

function formatApplianceWatts(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "— W";
  const watts = Math.max(0, numeric);
  if (watts >= 1000) {
    const digits = watts >= 10000 ? 1 : 2;
    return `${(watts / 1000).toFixed(digits).replace(/0+$/, "").replace(/\.$/, "")} kW`;
  }
  if (watts > 0 && watts < 10) return `${watts.toFixed(1).replace(/\.0$/, "")} W`;
  return `${Math.round(watts)} W`;
}

function applianceKpiArtwork(model) {
  const visual = model?.visual || {};
  if (visual.kind === "image" && clean(visual.value)) {
    const name = htmlEscape(model.name);
    const source = htmlEscape(visual.value);
    return `<span class="dm-appliance-kpi-image-wrap"><img class="dm-appliance-kpi-image" src="${source}" alt="${name}"></span>`;
  }
  const fallback = clean(
    visual.value ||
      model?.device?.visual_key ||
      model?.device?.device_type ||
      model?.device?.type ||
      model?.device?.icon ||
      model?.name,
  );
  const kind = canonicalArtworkType(fallback);
  /* Lo stesso disegno della scheda, non un secondo disegno.
   *
   * Il popup usava l'illustrazione piatta: una sagoma azzurra uguale per tutti
   * gli elettrodomestici, e ferma anche mentre l'elettrodomestico lavorava.
   * Adesso mostra il disegno della scheda, quello con le parti mobili, e la
   * riga porta lo stato: se sta lavorando, il meccanismo gira anche qui. */
  return (
    (kind && (applianceHeroArtwork(kind, 56) || applianceArtwork(kind, 72))) ||
    '<span class="dm-appliance-kpi-fallback">⚡</span>'
  );
}

function ensureApplianceKpiPopup(kind) {
  const doc = root.document;
  if (!doc?.body) return null;
  const id = `dm-appliance-${kind}-popup`;
  let popup = doc.getElementById(id);
  if (popup) return popup;
  const isRunning = kind === "running";
  const title = isRunning
    ? t("Elettrodomestici in funzione", "Appliances running")
    : t("Consumo istantaneo", "Instant power");
  const summaryLabel = isRunning
    ? t("In funzione adesso", "Currently running")
    : t("Potenza misurata", "Measured power");
  popup = doc.createElement("div");
  popup.id = id;
  popup.className = `dm-appliance-kpi-overlay dm-appliance-kpi-${kind}`;
  popup.hidden = true;
  popup.innerHTML = `<div class="dm-appliance-kpi-dialog" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
    <div class="dm-appliance-kpi-head">
      <div><small>${t("ADESSO", "NOW")}</small><h3 id="${id}-title">${title}</h3></div>
      <button type="button" data-dm-appliance-kpi-close aria-label="${t("Chiudi", "Close")}">✕</button>
    </div>
    <div class="dm-appliance-kpi-summary">
      <span class="dm-appliance-kpi-summary-icon">${isRunning ? "●" : "⚡"}</span>
      <span class="dm-appliance-kpi-summary-copy"><small>${summaryLabel}</small><strong data-dm-appliance-kpi-summary>—</strong></span>
    </div>
    <div class="dm-appliance-kpi-list" data-dm-appliance-kpi-list></div>
  </div>`;
  const close = () => {
    popup.hidden = true;
    popup.classList.remove("show");
  };
  popup.addEventListener("click", (event) => {
    if (event.target === popup) close();
  });
  popup.querySelector("[data-dm-appliance-kpi-close]")?.addEventListener("click", close);
  doc.body.append(popup);
  return popup;
}

function applianceKpiRow(model, kind, totalWatts = 0) {
  const room = clean(model?.room?.name);
  const watts = Number(model?.watts);
  const measurable = Number.isFinite(watts);
  const right =
    kind === "running"
      ? `<strong>${measurable ? formatApplianceWatts(watts) : htmlEscape(model.label)}</strong><small>${htmlEscape(model.label)}</small>`
      : `<strong>${formatApplianceWatts(watts)}</strong><small>${totalWatts > 0 ? `${Math.round((Math.max(0, watts) / totalWatts) * 100)}%` : "0%"}</small>`;
  return `<div class="dm-appliance-kpi-row" data-appliance-id="${htmlEscape(model.id)}">
    <span class="dm-appliance-kpi-visual dm-ap-mech is-${htmlEscape(model?.mode === "running" ? "run" : model?.mode === "standby" ? "standby" : "off")}">${applianceKpiArtwork(model)}</span>
    <span class="dm-appliance-kpi-row-main"><strong>${htmlEscape(model.name)}</strong>${room ? `<small>🏠 ${htmlEscape(room)}</small>` : ""}</span>
    <span class="dm-appliance-kpi-row-value">${right}</span>
  </div>`;
}

function renderApplianceKpiPopup(kind) {
  const popup = ensureApplianceKpiPopup(kind);
  if (!popup) return;
  const summary = popup.querySelector("[data-dm-appliance-kpi-summary]");
  const list = popup.querySelector("[data-dm-appliance-kpi-list]");
  if (!summary || !list) return;
  const models = applianceKpiModels();
  if (kind === "running") {
    const running = models.filter((model) => model.mode === "running");
    summary.textContent = String(running.length);
    list.innerHTML = running.length
      ? running.map((model) => applianceKpiRow(model, kind)).join("")
      : `<div class="dm-appliance-kpi-empty">${t("Nessun elettrodomestico è in funzione in questo momento.", "No appliance is running right now.")}</div>`;
    return;
  }
  const consuming = models
    .filter((model) => Number.isFinite(model.watts) && model.watts > 0.05)
    .sort((left, right) => right.watts - left.watts);
  const totalWatts = consuming.reduce((sum, model) => sum + Math.max(0, model.watts), 0);
  summary.textContent = formatApplianceWatts(totalWatts);
  list.innerHTML = consuming.length
    ? consuming.map((model) => applianceKpiRow(model, kind, totalWatts)).join("")
    : `<div class="dm-appliance-kpi-empty">${t("Nessun consumo istantaneo misurabile dagli elettrodomestici.", "No measurable instant appliance consumption.")}</div>`;
}

function syncApplianceKpis() {
  const doc = root.document;
  const grid = doc?.getElementById("appl-kpi-grid");
  if (!grid) return false;
  /* Due numeri non valgono tutti i modelli della casa a ogni giro di stati.
   *
   * `applianceKpiModels()` costruisce il modello di OGNI elettrodomestico —
   * stati, unita', soglie, storia — due volte al secondo, anche con la pagina
   * chiusa e nessun popup aperto: per scrivere «in funzione: 3» e i watt di
   * una casella che nessuno sta guardando. Con la pagina chiusa si sta fermi;
   * il tocco su una linguetta rimette in moto (vedi installApplianceKpiPopup). */
  const popupAperto = ["running", "power"].some((kind) => {
    const popup = doc.getElementById(`dm-appliance-${kind}-popup`);
    return popup && !popup.hidden;
  });
  const inScena = Boolean(grid.closest?.(".page.active")) || Boolean(grid.offsetParent);
  if (!inScena && !popupAperto) return false;
  const models = applianceKpiModels();
  const running = models.filter((model) => model.mode === "running");
  const totalWatts = models.reduce(
    (sum, model) => sum + (Number.isFinite(model.watts) ? Math.max(0, model.watts) : 0),
    0,
  );

  const runningCard = applianceKpiCard("running");
  if (runningCard) {
    runningCard.dataset.dmApplianceKpi = "running";
    runningCard.setAttribute("role", "button");
    runningCard.tabIndex = 0;
    runningCard.setAttribute(
      "aria-label",
      t("Apri elettrodomestici in funzione", "Open appliances running"),
    );
    const label = applianceKpiLabelNode(runningCard, "running");
    if (label) label.textContent = t("IN FUNZIONE", "RUNNING");
    const value = runningCard.querySelector(".g-val");
    if (value) value.textContent = String(running.length);
  }

  const powerCard = applianceKpiCard("power");
  if (powerCard) {
    powerCard.dataset.dmApplianceKpi = "power";
    powerCard.setAttribute("role", "button");
    powerCard.tabIndex = 0;
    powerCard.setAttribute(
      "aria-label",
      t("Apri consumo istantaneo elettrodomestici", "Open instant appliance power"),
    );
    const value = powerCard.querySelector(".g-val");
    if (value) value.textContent = formatApplianceWatts(totalWatts);
  }

  const daily = applianceKpiCard("daily");
  if (daily) daily.dataset.dmApplianceKpi = "daily";

  const alerts = applianceKpiCard("alerts");
  if (alerts) alerts.remove();

  for (const kind of ["running", "power"]) {
    const popup = doc.getElementById(`dm-appliance-${kind}-popup`);
    if (popup && !popup.hidden) renderApplianceKpiPopup(kind);
  }
  return true;
}

function installApplianceKpiPopupStyle() {
  const doc = root.document;
  if (!doc?.head || doc.getElementById(APPLIANCE_KPI_POPUP_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = APPLIANCE_KPI_POPUP_STYLE_ID;
  style.textContent = `
    #appl-kpi-grid [data-dm-appliance-kpi="running"],
    #appl-kpi-grid [data-dm-appliance-kpi="power"]{cursor:pointer!important;outline-offset:3px}
    #appl-kpi-grid [data-dm-appliance-kpi="running"]:active,
    #appl-kpi-grid [data-dm-appliance-kpi="power"]:active{transform:scale(.985)}
    .dm-appliance-kpi-overlay[hidden]{display:none!important}
    .dm-appliance-kpi-overlay{position:fixed!important;inset:0!important;z-index:2147483000!important;display:grid!important;place-items:center!important;padding:18px!important;background:rgba(30,41,59,.42)!important;backdrop-filter:blur(15px) saturate(120%)!important;-webkit-backdrop-filter:blur(15px) saturate(120%)!important}
    .dm-appliance-kpi-dialog{width:min(620px,100%)!important;max-height:min(80vh,720px)!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;border:1px solid rgba(148,163,184,.24)!important;border-radius:34px!important;background:radial-gradient(circle at 8% 2%,rgba(125,211,252,.24),transparent 33%),radial-gradient(circle at 94% 18%,rgba(167,243,208,.18),transparent 30%),linear-gradient(180deg,rgba(255,255,255,.99),rgba(244,249,255,.98))!important;color:#111827!important;box-shadow:0 26px 80px rgba(15,23,42,.30)!important}
    .dm-appliance-kpi-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:16px!important;padding:26px 26px 15px!important}.dm-appliance-kpi-head small{display:inline-flex!important;align-items:center!important;min-height:28px!important;padding:0 12px!important;border:1px solid rgba(14,165,233,.18)!important;border-radius:999px!important;background:rgba(224,242,254,.72)!important;color:#0284c7!important;font-size:10px!important;font-weight:900!important;letter-spacing:2px!important}.dm-appliance-kpi-head h3{margin:8px 0 0!important;color:#111827!important;font-size:clamp(24px,4vw,32px)!important;font-weight:950!important;line-height:1.04!important;letter-spacing:1px!important;text-transform:uppercase!important}.dm-appliance-kpi-head button{width:48px!important;height:48px!important;flex:0 0 48px!important;border:1px solid rgba(148,163,184,.18)!important;border-radius:17px!important;background:rgba(248,250,252,.92)!important;color:#0f172a!important;box-shadow:0 8px 24px rgba(15,23,42,.07)!important;font-size:21px!important;cursor:pointer!important}
    .dm-appliance-kpi-summary{min-height:108px!important;margin:0 26px 18px!important;padding:18px 22px!important;display:flex!important;align-items:center!important;gap:18px!important;border:1px solid rgba(14,165,233,.18)!important;border-radius:26px!important;background:linear-gradient(135deg,rgba(224,242,254,.96),rgba(240,249,255,.84))!important;box-shadow:0 13px 34px rgba(14,165,233,.10)!important}.dm-appliance-kpi-running .dm-appliance-kpi-summary{border-color:rgba(16,185,129,.18)!important;background:linear-gradient(135deg,rgba(209,250,229,.88),rgba(240,253,250,.90))!important}.dm-appliance-kpi-summary-icon{width:58px!important;height:58px!important;flex:0 0 58px!important;display:grid!important;place-items:center!important;border:1px solid rgba(14,165,233,.16)!important;border-radius:19px!important;background:rgba(255,255,255,.82)!important;color:#0284c7!important;font-size:30px!important;box-shadow:0 8px 24px rgba(14,165,233,.10)!important}.dm-appliance-kpi-running .dm-appliance-kpi-summary-icon{color:#10b981!important;font-size:42px!important}.dm-appliance-kpi-summary-copy{display:flex!important;flex-direction:column!important;gap:4px!important;min-width:0!important}.dm-appliance-kpi-summary-copy small{color:#64748b!important;font-size:12px!important;font-weight:900!important;letter-spacing:1.5px!important;text-transform:uppercase!important}.dm-appliance-kpi-summary-copy strong{color:#0797d5!important;font-size:clamp(30px,5vw,40px)!important;font-weight:950!important;line-height:1!important}.dm-appliance-kpi-running .dm-appliance-kpi-summary-copy strong{color:#059669!important}
    .dm-appliance-kpi-list{overflow:auto!important;display:grid!important;gap:11px!important;padding:0 26px 26px!important}.dm-appliance-kpi-row{min-height:92px!important;padding:13px 16px!important;display:grid!important;grid-template-columns:62px minmax(0,1fr) auto!important;align-items:center!important;gap:14px!important;border:1px solid rgba(148,163,184,.20)!important;border-radius:24px!important;background:rgba(255,255,255,.92)!important;box-shadow:0 10px 30px rgba(15,23,42,.07)!important}.dm-appliance-kpi-visual{width:58px!important;height:58px!important;display:grid!important;place-items:center!important;overflow:hidden!important;border-radius:18px!important;background:linear-gradient(145deg,#e0f2fe,#f0f9ff)!important}.dm-appliance-kpi-visual .dm-appliance-art,.dm-appliance-kpi-visual svg{width:56px!important;height:56px!important;max-width:56px!important;max-height:56px!important}.dm-appliance-kpi-image-wrap,.dm-appliance-kpi-image{display:block!important;width:100%!important;height:100%!important}.dm-appliance-kpi-image{object-fit:cover!important;object-position:center!important;border-radius:16px!important}.dm-appliance-kpi-fallback{font-size:27px!important}.dm-appliance-kpi-row-main,.dm-appliance-kpi-row-value{display:flex!important;flex-direction:column!important;min-width:0!important}.dm-appliance-kpi-row-main{gap:4px!important}.dm-appliance-kpi-row-main>strong{overflow:hidden!important;color:#111827!important;font-size:17px!important;font-weight:900!important;line-height:1.15!important;text-overflow:ellipsis!important;white-space:nowrap!important}.dm-appliance-kpi-row-main>small{overflow:hidden!important;color:#64748b!important;font-size:11px!important;font-weight:800!important;letter-spacing:.7px!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-transform:uppercase!important}.dm-appliance-kpi-row-value{align-items:flex-end!important;gap:5px!important;flex:0 0 auto!important}.dm-appliance-kpi-row-value>strong{color:#078dc7!important;font-size:18px!important;font-weight:950!important;white-space:nowrap!important}.dm-appliance-kpi-row-value>small{padding:4px 8px!important;border-radius:999px!important;background:#e0f2fe!important;color:#0369a1!important;font-size:10px!important;font-weight:900!important;white-space:nowrap!important}.dm-appliance-kpi-running .dm-appliance-kpi-row-value>small{background:#d1fae5!important;color:#047857!important}.dm-appliance-kpi-empty{padding:28px 20px!important;text-align:center!important;border:1px solid rgba(148,163,184,.18)!important;border-radius:22px!important;background:rgba(255,255,255,.76)!important;color:#64748b!important;font-size:14px!important;font-weight:800!important}
    @media(max-width:700px){#appl-kpi-grid [data-dm-appliance-kpi="daily"]{grid-column:1/-1!important}}
    @media(max-width:520px){.dm-appliance-kpi-overlay{place-items:center!important;padding:14px!important}.dm-appliance-kpi-dialog{width:min(620px,calc(100vw - 28px))!important;max-height:min(82vh,700px)!important;border-radius:30px!important}.dm-appliance-kpi-head{padding:22px 18px 13px!important}.dm-appliance-kpi-head h3{font-size:25px!important}.dm-appliance-kpi-head button{width:46px!important;height:46px!important;flex-basis:46px!important}.dm-appliance-kpi-summary{min-height:94px!important;margin:0 18px 14px!important;padding:16px 18px!important;border-radius:23px!important}.dm-appliance-kpi-summary-icon{width:52px!important;height:52px!important;flex-basis:52px!important}.dm-appliance-kpi-list{gap:9px!important;padding:0 18px 18px!important}.dm-appliance-kpi-row{min-height:82px!important;padding:11px 12px!important;grid-template-columns:54px minmax(0,1fr) auto!important;gap:11px!important;border-radius:21px!important}.dm-appliance-kpi-visual{width:50px!important;height:50px!important;border-radius:16px!important}.dm-appliance-kpi-visual .dm-appliance-art,.dm-appliance-kpi-visual svg{width:48px!important;height:48px!important;max-width:48px!important;max-height:48px!important}.dm-appliance-kpi-row-main>strong{font-size:15.5px!important}.dm-appliance-kpi-row-main>small{font-size:9.5px!important}.dm-appliance-kpi-row-value>strong{font-size:16px!important}}
  `;
  doc.head.append(style);
}

function installApplianceKpiPopups() {
  const doc = root.document;
  if (!doc) return;
  const state = (root[APPLIANCE_KPI_STATE_KEY] ||= { installed: false, frame: 0 });
  if (state.installed) return;
  state.installed = true;
  installApplianceKpiPopupStyle();
  ensureApplianceKpiPopup("running");
  ensureApplianceKpiPopup("power");
  const schedule = () => {
    if (state.frame) return;
    const run = () => {
      state.frame = 0;
      syncApplianceKpis();
    };
    state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
  };
  for (const name of ["renderAppliances", "renderApplianceSection", "render"]) {
    wrapFunction(name, "__dmApplianceKpiPopups", schedule);
  }
  doc.addEventListener(
    "click",
    (event) => {
      const card = event.target?.closest?.(
        '#appl-kpi-grid [data-dm-appliance-kpi="running"],#appl-kpi-grid [data-dm-appliance-kpi="power"]',
      );
      if (card) {
        const kind = card.dataset.dmApplianceKpi;
        const popup = ensureApplianceKpiPopup(kind);
        renderApplianceKpiPopup(kind);
        if (popup) {
          popup.hidden = false;
          popup.classList.add("show");
        }
        return;
      }
      if (
        event.target?.closest?.(
          "[data-tab='appliances-main'],[data-tab='appliances'],.tab[data-tab='appliances-main']",
        )
      ) {
        root.queueMicrotask?.(schedule);
      }
    },
    true,
  );
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target?.closest?.(
      '#appl-kpi-grid [data-dm-appliance-kpi="running"],#appl-kpi-grid [data-dm-appliance-kpi="power"]',
    );
    if (!card) return;
    event.preventDefault();
    const kind = card.dataset.dmApplianceKpi;
    const popup = ensureApplianceKpiPopup(kind);
    renderApplianceKpiPopup(kind);
    if (popup) {
      popup.hidden = false;
      popup.classList.add("show");
    }
  });
  root.addEventListener?.("dashboardmodern:state-changed", schedule);
  root.addEventListener?.("dashboardmodern:legacy-ready", schedule);
  /* La pagina che si apre: i numeri stavano fermi mentre era chiusa, e al
   * tocco della linguetta devono essere subito quelli di adesso. */
  doc?.addEventListener?.(
    "click",
    (evento) => {
      if (evento.target?.closest?.(".tab,[data-tab]")) schedule();
    },
    true,
  );
  root.queueMicrotask?.(schedule);
}

/* «La plancia e' dipinta»: la bandiera che il guscio aspetta prima di
 * sciogliere il velo. Due fotogrammi dopo l'installazione — il primo per le
 * rAF che i moduli hanno appena messo in coda, il secondo per il disegno che
 * ne esce. Senza requestAnimationFrame (o in un test) si alza subito. */
export const DIPINTA_KEY = "__DASHBOARDMODERN_PLANCIA_DIPINTA__";

function dichiaraDipinta() {
  const alza = () => {
    root[DIPINTA_KEY] = true;
    try {
      root.dispatchEvent?.(new CustomEvent("dashboardmodern:plancia-dipinta", { detail: {} }));
    } catch (_errore) {}
  };
  const frame = root.requestAnimationFrame;
  if (typeof frame !== "function") {
    alza();
    return;
  }
  frame(() => frame(alza));
}

export function installSectionRuntime() {
  if (root[RUNTIME_KEY]?.installed) return root[RUNTIME_KEY];
  if (root[INSTALLING_KEY]) return root[RUNTIME_KEY] || null;
  /* Fine dell'avvio a pezzi.
   *
   * Quasi nessun modulo dipinge dentro `install()`: chiama `schedule()`, cioe'
   * un requestAnimationFrame. Il velo pero' cadeva appena `installed` diventava
   * vero — nello stesso fotogramma — e i quaranta ridisegni pendenti finivano
   * sotto gli occhi: il meteo che salta nell'intestazione, le azioni rapide che
   * entrano nel loro ripiano, le pagine riscritte. «Il caricamento e' lentissimo
   * e poi va a pezzi, non carica tutto insieme.»
   *
   * Due fotogrammi di pazienza: il primo lascia girare le rAF che i moduli
   * hanno appena messo in coda, il secondo lascia dipingere il risultato. Solo
   * allora la plancia si dichiara dipinta e il guscio scioglie il velo. */

  root[INSTALLING_KEY] = true;
  try {
    // Language first: every section below reads its copy while it renders, so
    // the locale has to be settled before the first of them runs.
    installI18nSection();
    installThemeFoundationSection();
    /* Subito dopo le fondamenta del tema e prima di ogni disegno: il foglio
     * delle sfumature deve stare in cima al documento gia' al primo giro, o
     * i disegni nascono mezzi e si riparano solo al secondo. */
    installIconeLeggibiliSection();
    installHostedBridgeGuard();
    installLegacySections();
    installDataContractsSection();
    installEnergyCalculationsSection();
    installEnergyServicesSection();
    installEnergySignedSection();
    installEnergySection();
    installEnergyRefreshSection();
    installStateEventGate(root.DashboardModernEnergyService?.broker, root);
    installEnergyLegacyGuardSection();
    installEnergyStabilitySection();
    installEnergyGuidanceSection();
    installEnergyFlowSection();
    installEnergyLoadsEditor();
    installSubloadPopupSection();
    installApplianceDetailPopupSection();
    installEnergyAnalysisSection();
    installHistorySection();
    installTemperatureSection();
    installTemperatureLayoutSection();
    installTemperatureTrendSection();
    installAppliancesSection();
    installApplianceLayoutSection();
    // The showcase renderer must install before the KPI popups wrap
    // renderApplianceSection, so the popup sync keeps firing after every
    // showcase render.
    installApplianceShowcaseSection();
    installApplianceDailyPopupStyle();
    installApplianceKpiPopups();
    installAppliancePickerLayer();
    installApplianceEditorSection();
    installLightsAlertsSection();
    // The editor owns the light list and the rooms; the scene owns the popup
    // that controls them, so it installs after the model it reads.
    installLightsSceneSection();
    // La pagina Luci legge lo stesso modello e apre la stessa scheda controlli
    // del popup: si installa dopo chi la possiede.
    installLightsPageSection();
    installAlertsSection();
    /* L'allagamento e' una lista sorvegliata come le altre: si installa dove si
     * installano gli avvisi, subito dopo chi possiede il loro editor. */
    installFloodAlertsSection();
    /* Il fumo segue l'allagamento — stessa famiglia, stesso posto — e in piu'
     * porta il suo blocco nella pagina Sicurezza e il rilevamento continuo
     * delle aperture nuove. */
    installSmokeAlertsSection();
    /* Sul guscio inglese, le parole italiane rimaste nel runtime vendorizzato
     * si traducono qui, finche' la correzione non arriva a monte. */
    installEnglishRuntimeStrings();
    // The redesigned Security page must own #cam-grid before the live-ui camera
    // owner starts filling the thumbnails, so the first paint is already the new
    // wall instead of the legacy cards.
    installSecurityShowcaseSection();
    /* Le aperture stanno fra la centrale e le telecamere: si installano dopo
     * la vetrina che costruisce lo scheletro in cui si inseriscono. */
    installSecurityDoorsSection();
    installSecurityDoorsEditorSection();
    /* L'indirizzo RTSP nella scheda delle telecamere: si mette accanto al
     * campo del flusso, che e' del guscio, e va installato dopo di lui. */
    installTelecameraRtsp();
    installTelecameraVivo();
    installCentraliAllarmeEditor();
    installOrologio();
    /* La scelta dei tasti dell'antifurto chiede alla vetrina quali la centrale
     * accetta: si installa dopo di lei, che quella risposta la pubblica. */
    installAlarmModesEditorSection();
    installClimateThermalSection();
    /* Le voci termiche del popup Caldo: dopo chi disegna il popup, cosi' il
     * pannello passa di mano una volta sola. */
    installTermicoDelCaldo();
    /* Il popup Clima attivi separa caldo e freddo e dice da quanto: legge
     * le righe che il guscio ha appena disegnato. */
    installPopupClimaDistingue();
    /* Il popup dell'Auto: l'ora di fine carica accanto al tempo che manca,
     * la frase d'analisi, i codici del cavo in parole. */
    installPopupAutoRacconta();
    /* Il popup della lavatrice: programmi configurabili, immagine della
     * sezione, veste di casa. */
    installPopupLavatrice();
    /* I parametri del tasto Clima rapido chiedono alle unita' cosa accettano:
     * si installano dopo chi quelle unita' le tiene. */
    installQuickClimateEditorSection();
    installLiveUiSection();
    installConnectionRecoverySection();
    installNavigationSection();
    installUnifiedEditorsSection();
    installEntitySearchSection();
    installEntityAutodetectSection();
    installEditorCrudSection();
    installEditorContractsSection();
    // Readable entity rows for every section tab of the editor.
    installEditorSlotsSection();
    // One section per tab, one switch, one save — installed after the editors
    // that print those parts, so it reconciles what they left behind.
    installConfigUniformitySection();
    installReportEditorSection();
    installShutterSection();
    installShutterSceneSection();
    installShutterWindowSection();
    // Il cielo si installa dopo chi disegna la finestra: ridefinisce solo le
    // variabili del fondo, e le trova gia' al loro posto.
    installClimatePowerSection();
    installShutterSkySection();
    installPageMastheadSection();
    /* Il meteo si accoda al nome della casa nell'intestazione: si installa
     * dopo le intestazioni di pagina, che dell'intestazione della plancia non
     * si occupano, ma e' li' che si va a cercarle. */
    installWeatherInMasthead();
    /* Le azioni rapide entrano nel loro ripiano: si installa dopo chi disegna
     * la Home, perche' il ripiano si mette attorno a una griglia che deve
     * gia' esistere. */
    installAzioniRapideVassoio();
    installAzioniServizioGiusto();
    installFoglioDelGuscio();
    installStrisceDiLinguette();
    installPoolIrrigationSceneSection();
    installPoolExtraSection();
    installPoolEditorSection();
    installRobotSection();
    installPreseSection();
    installRobotEditorSection();
    /* Le Stanze leggono le assegnazioni di tutte le altre sezioni e
     * riusano la card della pagina Luci: si installano dopo di lei. */
    installRoomsPageSection();
    /* L'ordine delle stanze si cambia in configurazione: le frecce si
     * appoggiano alle righe che disegna il documento vendorizzato. */
    installRoomsOrderEditor();
    /* L'assegnatore va dopo la pagina Stanze: le chiede quali entita' una
     * stanza ce l'hanno gia' per mestiere, e su quelle non mette niente. */
    installRoomAssignSection();
    /* Le linguette degli impianti leggono la sezione Energia e le si
     * posano sopra: si installano dopo di lei. */
    installEnergyPlantsSection();
    installEditorEntrySection();
    installMediaPickerSection();
    /* Le persone leggono `cd_people` e basta; il loro editor usa il selettore
     * foto, quindi si installano dopo di lui. */
    installPeopleSection();
    installPeopleEditorSection();
    /* Il ponte dei widget sta sotto le persone in Home: si installa dopo,
     * cosi' trova gia' il suo ancoraggio. */
    installHomeWidgetsSection();
    installTodoEditorSection();
    installWidgetEntityChoiceSection();
    /* Il backup arriva per ultimo fra le schede: raccoglie le chiavi che gli
     * altri editor scrivono, non ne possiede nessuna. */
    installBackupEditorSection();
    installEvSection();
    // The skin installs after the EV owner so the vehicle picker it restyles is
    // already mounted, and re-renders itself on the same runtime events.
    installEvShowcaseSection();
    installSolarThermalDesignSection();
    /* Dopo il disegno del solare: le linguette e le due scene nuove gli si
     * mettono accanto, e per farlo devono trovarlo gia' al suo posto. */
    installImpiantiTermiciSection();
    installImpiantiTermiciEditor();
    /* Il gruppo di continuita' (#256) ha una pagina sua, come le altre
     * macchine della casa, e una scheda sua nella configurazione: era una coda
     * della scheda «Energia», e li' non la trovava nessuno. La pagina prima
     * della scheda, cosi' la scheda trova gia' cosa ridisegnare quando salva. */
    installUpsSection();
    installUpsEditor();
    /* Il calendario (#259) ha una pagina sua accanto alla Home, e con le liste
     * ToDo una scheda sola nella configurazione: sono la stessa pagina, e chi
     * le configura le pensa nello stesso momento. */
    installCalendarioSection();
    installAgendaEditorSection();
    /* La lingua si sceglie fra le Impostazioni (#263): il motore c'era gia',
     * mancava la riga da cui dirlo. */
    installLinguaSection();
    /* Le sezioni che si fa l'utente: la pagina prima della sua scheda, come
     * per la Continuita' — la scheda chiama la pagina per ridisegnarla. */
    installSezioniMie();
    installSezioniMieEditor();
    /* Le entita' che uno si aggiunge dove vuole (#271): il disegno prima
     * della scheda che lo compila, come per le sezioni proprie. */
    installEntitaMie();
    installEntitaMieEditor();
    /* Il radar meteo dentro la finestra delle previsioni: si aggancia al
     * guscio che quella finestra la disegna gia'. */
    installRadarMeteo();
    // The MiniPC skin owns the presentation of #page-server: it reads the bars,
    // the temperature arc and the status badges the legacy render loop writes.
    installMinipcShowcaseSection();
    installBeta27ReleaseStability();

    root[RUNTIME_KEY] = Object.freeze({
      installed: true,
      sections: Object.freeze([
        "i18n",
        "data-contracts",
        ...LEGACY_SECTION_KEYS,
        "energy-calculations",
        "energy-services",
        "energy-signed",
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
        "appliance-showcase",
        "appliance-editor",
        "lights",
        "lights-scene",
        "lights-page",
        "alerts",
        "flood-alerts",
        "smoke-alerts",
        "english-runtime-strings",
        "theme-foundation",
        "security-showcase",
        "security-doors",
        "security-doors-editor",
        "climate-thermal",
        "live-ui",
        "navigation",
        "unified-editors",
        "entity-search",
        "entity-autodetect",
        "editor-crud",
        "editor-contracts",
        "editor-slots",
        "report-editor",
        "shutters",
        "pool-irrigation-scene",
        "pool-extra",
        "pool-editor",
        "robot",
        "robot-editor",
        "editor-entry",
        "media-picker",
        "people",
        "people-editor",
        "home-widgets",
        "todo-editor",
        "widget-entity-choice",
        "backup-editor",
        "ev",
        "ev-showcase",
        "solar-thermal-design",
        "minipc-showcase",
        "beta27-release-stability",
      ]),
      registry: root.__DASHBOARDMODERN_SECTIONS__,
      energyServices: root.__DASHBOARDMODERN_ENERGY_SERVICES__,
      /* Il guscio, per togliere il velo, non deve fidarsi di `installed`: dice
       * che i moduli sono INSTALLATI, non che hanno DIPINTO. Chi sa aspettare
       * la dipintura lo dichiara qui. */
      dipinge: true,
    });
    /* L'annuncio che sessantanove moduli aspettavano.
     *
     * `dashboardmodern:runtime-ready` non lo emetteva nessuno: chi si era
     * agganciato solo a lui non si svegliava mai, e chi aveva aggiunto
     * `legacy-ready` come rete di sicurezza faceva il lavoro due volte. Ora
     * l'annuncio parte davvero, e parte QUI: sotto il velo, prima che la
     * plancia si dichiari dipinta. */
    try {
      root.dispatchEvent?.(new CustomEvent("dashboardmodern:runtime-ready", { detail: {} }));
    } catch (_errore) {}
    dichiaraDipinta();
    return root[RUNTIME_KEY];
  } finally {
    delete root[INSTALLING_KEY];
  }
}

installSectionRuntime();
