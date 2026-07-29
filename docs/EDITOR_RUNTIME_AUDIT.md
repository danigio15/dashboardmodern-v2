# Editor runtime audit — baseline `f64c906` (post PR #21)

Audit performed before the 0.14.0 implementation. The deployed panel is not the
top-level `frontend/index.html`: `panel.js` creates an iframe whose `src` is the
locale-dependent vendored file (`legacy/dashboard.html` or
`legacy/dashboard-en.html`). Those documents still own `editorSwitch`, most
markup, direct `localStorage` writes and inline event handlers. They then import
`legacy/modules-entry.js`, which installs `DashboardStore` and overrides only a
subset of editor paths. Consequently a missing/old module, a different locale
variant, or a failed module import silently selects legacy behavior. This is the
root cause of changes present in main not necessarily reaching Home Assistant;
cache is only one possible cause.

## Pre-refactor decision table

| Function | Legacy system | Canonical system | Used at runtime on `f64c906` | Keep | Remove |
|---|---|---|---|---|---|
| `editorSwitch` | navigation **and** render/mount/refresh | `renderEditorTab` registry dispatch | Yes, always | navigation shim only | render branches and refresh calls |
| `editorRenderSezioni` | one monolithic renderer for Home/Energy/EV/Solar/Security/Cameras/MiniPC/Temperature/Actions/Climate | per-tab registry descriptors | Yes | no | yes |
| `editorRenderLoad` | `cd_subloads_extra` + `cd_report_devices` CRUD | canonical `loads`/`appliances` | fallback if modules absent | no | yes |
| `mountLoadsEditor` | one form with a text-only `mode` variation | distinct loads and report renderers | Yes when module import succeeds | split replacement | combined renderer |
| `edAddLoad` / `edDelLoad` | direct legacy load storage | store `addItem`/`removeItem` | reachable through fallback/exported globals | no | yes |
| `edAddReportDevice` / `edDelReportDevice` | direct report storage | report projection on canonical items | reachable through fallback/wizard | no | yes |
| `createEntityPickerField` | none | component-created input/picker/listeners | Energy flows only | rename/extend as `createEntityField` | duplicate factories |
| `mountEntityPickers` | appends buttons after arbitrary markup | component owns its picker | Yes, after every module mount | assertion only | DOM augmentation |
| inline `onclick="wzPickEntity(...)"` | vendored render strings | `createEntityField` | Yes in almost every legacy tab | no in migrated editor | yes |
| direct `localStorage.setItem` saves | section-specific mutation/sync/refresh | `DashboardStore.transact` | Yes in most tabs | migration projection only | runtime CRUD |
| `createRenderCoordinator` | mixed calls to public and editor render functions | one targeted render + mount | Yes, alongside manual renders | yes, simplified | competing manual refreshes |

## Effective runtime map

`DS` means `DashboardStore`; `LS` means direct `localStorage`. Visibility is
legacy `cdSec*`/`cdApplyNavVis` unless stated otherwise.

| Section | Tab | Markup / mount / save | Read → write | DS / direct LS | Post-mutation renderer | Visibility | Picker | Competing legacy path |
|---|---|---|---|---|---|---|---|---|
| Impostazioni | `rileva`, `sost`, `visib`, `testi`, `hide`, `export` | `editorRenderRileva/Sost/Visib/Testi/Hide/Export`; `mountCurrentEditor`; individual `ed*` saves | many `cd_*` → same | no / yes | `editorSwitch` | `edSecToggle`, `cdApplyNavVis` | inline + augmentation | monolithic settings switch |
| Home | `sez0` | `editorRenderSezioni` + `edFilterSez`; `edSaveSezione` | overrides/config → `cd_entity_overrides` | no / yes | `editorSwitch('sezioni')` | `cdSecLS` | inline/`edSetSlot` | section renderer plus module mount |
| Energia | `sez1` then inner tabs | `mountEnergyEditor`/`renderEnergyEditor`; per-input `onChange`, legacy `edSaveCosti` | `energy`, `loads`, `appliances`; tariff LS → DS + LS | mixed | coordinator plus legacy render | DS only for `energy`/`loads` | factory + augmentation | `editorRenderSezioni`, `editorRenderLoad` |
| EV | `sez2` | `editorRenderSezioni`; `edSaveSezione` | `cd_entity_overrides`, `cd_ev_*` → same | partial / yes | section switch | not triggered by overrides | inline + augmentation | no canonical slot section |
| Solare | `sez3` | same monolith | overrides → overrides | no / yes | section switch | legacy | inline | duplicated energy fields |
| Sicurezza | `sez4` | same monolith | overrides → overrides | no / yes | section switch | legacy | inline | camera editor nested here |
| Telecamere | `sez4` | `editorRenderSezioni`; `edAddCamera`, `edSaveSezione` | cameras → cameras | yes when module loaded / fallback LS | coordinator or switch | DS `cameras→security` | inline + augmentation | locale HTML and module paths can diverge |
| MiniPC | `sez5` | monolith; `edSaveSezione` | overrides → overrides | no / yes | section switch | not triggered by overrides | inline | legacy slot map |
| Temperature | `sez6` | monolith; `edAddStanza2` | `cd_stanze` → same | bridge reconciliation / yes | `editorSwitch` | indirect | inline | separate Rooms CRUD |
| Azioni | `sez7` | monolith; `edAddQA` | `cd_quick_actions` → same | no / yes | `editorSwitch` | legacy | inline | wizard duplicate |
| Clima | `sez8` | monolith; `edAddClima` | `cd_clima_units`, overrides → same | bridge / yes | `editorSwitch` | DS after bridge | inline | boiler slot direct LS |
| Piscina | `pool` | `editorRenderPiscina`; `edPoolSaveCfg` | `cd_piscina` → same | bridge / yes | manual public render + switch | DS after bridge | escaped inline markup + augmentation | JSON-escaped string fragments |
| Irrigazione | `irr` | `editorRenderIrrigazione`; `edIrr*` | `cd_irrigazione` → same | bridge / yes | manual public render + switch | DS after bridge | escaped inline markup + augmentation | JSON-escaped string fragments |
| Tapparelle | `tapp` | `editorRenderTapparelle`; `edTapp*` | `cd_tapparelle` → same | bridge / yes | manual public render + switch | DS after bridge | inline + augmentation | refresh by navigation |
| Stanze | `stanze` | `editorRenderStanze`; `edStanzaRoom*`, `edFloor*` | `cd_stanze`, `cd_floors` → same | partial / yes | switch + selectors | none | icon text popup | older `edAddStanza*` and Lights room functions |
| Luci | `luci` | `editorRenderLuci`; `edAddLuce`, `edDelLuce` | `cd_luci` → same | bridge / yes | section switch | DS after bridge | inline + augmentation | Lights-owned room CRUD |
| Elettrodomestici | `appliances` | `editorRenderAppliances`; `edApplSave/Del` | `cd_appliances` → DS (fallback LS) | yes / fallback | coordinator | DS | mixed manual fields | standalone Lavatrice overrides |
| Avvisi | `avvisi` | `editorRenderAvvisi`; `edAdd/DelAvviso*` | alert/group `cd_*` → same | no / yes | switch | legacy | inline | multiple alert shapes |

## Confirmed root causes

1. **Runtime identity is unknowable:** the UI exposed only
   `DASHBOARD_VERSION`; it did not show manifest, module, schema, exact URLs,
   locale variant, asset hash, or build provenance.
2. **Camera Save discrepancy:** the button exists only in the recently modified
   vendored HTML renderer. Home Assistant selects either Italian or English
   HTML through `panel.js`, and each file then independently imports the module.
   A stale/mismatched variant or module-import failure leaves a different
   renderer active without reporting it. The legacy fallback makes this look
   successful instead of failing loudly.
3. **Loads equals Report:** both inner tabs call `mountLoadsEditor`; `mode`
   changes introductory copy but renders the same three accordions and full
   CRUD form.
4. **Schema-3 users miss migrations:** washer/load import lives only in
   `readLegacyState`, which runs only when `dm_dashboard_state` is absent.
5. **EV/Energy visibility:** entity mappings remain in
   `cd_entity_overrides`, absent from `SECTION_KEYS`; therefore store
   transactions and `ensureSectionVisibleForData` never run.
6. **Picker loss/duplication:** fields come from three ownership models—the
   component factory, post-render `mountEntityPickers`, and inline handlers.
7. **Stale CRUD DOM:** legacy add/delete calls navigation as a refresh while
   the coordinator also performs targeted rendering; failures and race order
   are hidden by empty `catch` blocks.

## Canonical target

`dashboard*.html` remains the public shell. `modules-entry.js` owns a single
`EDITOR_REGISTRY` and `renderEditorTab(tab)` lifecycle. Core editor writes go
through `DashboardStore`; legacy keys are migration inputs/projections only.
The sequence is navigation → render → mount → interaction → store transaction
→ optimistic targeted render → mount → backend sync. There is no silent
fallback to an alternative core editor.

## 0.14.0 convergence status after PR #22 review

### Energy editor → public consumer matrix

Fields without a concrete public consumer are deliberately not exposed by the
canonical editor. The remaining mappings are:

| Editor field | Canonical slot | Public consumer | Visible surface |
|---|---|---|---|
| `house.power` | `dm.energy_potenza_consumo_casa` | `render()` / `getDisplay()` | Flow map Home node and history popup |
| `house.daily_energy`, `house.monthly_energy`, `house.annual_energy` | `dm.energy_consumo_casa_{oggi,mese,anno}` | `cdTotalsRun()`, `render()`, period engine | Daily flow, Energy KPIs and annual analysis |
| `grid.power` | `dm.energy_potenza_scambio_rete` | `render()` / `getDisplay()` | Flow map Grid node and history popup |
| `grid.daily_import_energy`, `grid.daily_export_energy` | `dm.energy_energia_{prelevata,immessa}_oggi` | `render()`, `cdRefreshPeriodDeltas()` | Daily Grid flow and period report |
| `grid.monthly_import_energy`, `grid.monthly_export_energy` | `dm.energy_rete_{acquistata,venduta}_mese` | `cdRefreshPeriodDeltas()` | Monthly financial/report calculations |
| `solar.power` | `dm.energy_potenza_fotovoltaico` | `render()` / `getDisplay()` | Flow map Solar node and history popup |
| `solar.daily_energy`, `solar.monthly_energy`, `solar.annual_energy` | `dm.energy_produzione_solare_{oggi,mese,anno}` | `cdTotalsRun()`, `render()`, period engine | Daily flow, production KPIs and annual analysis |
| `battery.power`, `battery.soc` | `dm.energy_{potenza_batteria,stato_carica_batteria}` | `render()` / `getDisplay()` | Battery flow node, SOC and history popup |
| `battery.daily_charged_energy`, `battery.monthly_charged_energy` | `dm.energy_batteria_caricata_{oggi,mese}` | `render()`, `cdRefreshPeriodDeltas()` | Daily Battery flow and period report |

Lifetime-only House/Solar fields, separate Grid import/export power fields and
unused total Battery counters were removed from the editor because the public
dashboard has no distinct visual consumer for them.

| Area | Status | Evidence / remaining work |
|---|---|---|
| Runtime diagnostics | PARTIAL | The tab is part of both templates and the legacy script now exposes an explicit DOM/API readiness boundary; the four browser jobs must confirm it. |
| Energy | PARTIAL | `sez1` resolves to `energy`, uses a draft plus one Save transaction and preserves its inner tab; browser and Home Assistant evidence remain required. |
| Loads | PASS | Registry dispatch performs one render and one mount; canonical store CRUD only. |
| Report | PASS | Draft form, one Save transaction, status lifecycle, rollback, report-only order, canonical pickers and explicit manual rows. |
| Settings, Home, EV, Solar, Security, MiniPC, Temperature, Actions, Climate | PARTIAL | Tab IDs resolve canonically, but their renderers remain legacy. |
| Pool, Irrigation, Covers, Rooms, Lights, Appliances, Alerts | PARTIAL | Still rebuilt by the compatibility coordinator/global renderers. |
| Browser evidence | FAIL | The last remote run reached Chromium but failed before readiness because the Chart mock lacked `Chart.defaults`. The runtime guard and mock are now corrected, but a new green workflow artifact is still required. |

This is not a release candidate. Remaining PARTIAL rows must be migrated and the
manual Home Assistant checklist completed before release readiness can be claimed.
# Runtime data path audit (shutters, Temperature, appliances and Report)

The authoritative path is now:

1. The real Editor writes through `DashboardModernModules.store` (appliances call
   `replaceSection("appliances", list)`; Temperature calls `updateItem("rooms", id,
   patch)`). Temperature therefore enriches an existing stable room and never
   constructs a second room.
2. `DashboardStore.persist()` serializes the complete schema-4 snapshot to
   `dm_dashboard_state`, then projects compatibility keys such as `cd_stanze` and
   `cd_appliances` while its projection guard prevents a write loop.
3. `installLegacyWriteBridge()` is only the reverse compatibility path: a legacy
   writer is reconciled into the canonical section. It is not a second source of
   truth.
4. `createRenderCoordinator()` reacts to the optimistic transaction and refreshes
   the public appliance renderer, active editor, Report projection and selectors.
5. The public Energy Report is rebuilt from `canonicalReportDevices(appliances,
   loads, STATES)`. It does not persist a competing `cd_report_devices` model.

The appliance form actually persists a generic `entities` array of strings (for
example `["sensor.forno_power", "sensor.forno_energy"]`). Normalization also
accepts legacy entity objects. Explicit `power_entity`, `energy_entity`,
`daily_energy_entity`, `report_entity`, and `history_entity` remain empty unless
they existed in migrated data; `show_in_report` defaults to true; `device_type`
comes from the selected appliance visual; and `visual_type`/`visual_key` are
preserved by normalization. Report inference must consequently inspect the real
generic array and Home Assistant units, preferring Wh/kWh and rejecting W/kW.

The former shutter warning was an isolated two-second inline renderer. It counted
only the literal `open` state, emitted bespoke markup with the count inside the
title, and installed no click handler or popup. The canonical runtime repair now
derives count, card, and popup from one `openShutters()` list and refreshes an open
popup as state changes.

The previous Temperature renderer exposed editable room name/floor fields and its
Add action constructed `room-${Date.now()}`. That made the Temperature tab a
second room creator. Its saved cards also used a different fieldset layout. The
shared form now selects a stable canonical room id, derives floor, uses the icon
and HA entity pickers, and clears only `temp`/`hum` on deletion.

Earlier Report tests stayed green because they directly inserted an idealized
Forno object containing explicit energy fields and manually invoked both Report
rebuild functions. Such a test skipped the appliance form, store normalization,
legacy projection, reactive coordinator, navigation, and reload that expose the
runtime defect.

## PR #31 browser follow-up

The room loss observed by the browser matrix was an E2E bootstrap error caused by
`storage-namespace.js`. The test wrote `dm_dashboard_state` in `addInitScript`,
before the namespacing shim existed, so it populated the global key. The runtime
then mapped its reads to `cd_<instance>_dm_dashboard_state` and correctly found no
canonical data. Browser fixtures now navigate with an explicit `dmi`, wait for
the real shim, seed through the public `localStorage` API, and reload. The former
blanket guard against reconciling `cd_stanze=[]` was removed because it prevented
the legacy Rooms editor from legitimately deleting the final room.

The legacy shutter interval no longer renders `#tapp-avvisi`; it only refreshes
the dedicated shutter page. `runtime-hotfix.js` is therefore the sole owner of
the Home warning, count and open popup, with one guarded interval and page-hide
cleanup. `real-shutters-appliance-report.spec.js` covers the real shutter Editor
flow and live popup, while its Forno scenario covers the appliance Editor,
canonical persistence, Energy Report/Analysis navigation and full reload.

The image loading regression uses the existing, checked-in
`custom_components/dashboardmodern/frontend/legacy/logo.png` as a deterministic
technical fixture only. It is not presented as the final appliance artwork. The
browser test validates decoded natural dimensions,
visible dimensions, containment, centering, overflow and absence of glyph
replacement in Chromium desktop/mobile and WebKit/iPad. Final visual acceptance
remains open until the user-provided appliance reference asset is integrated.
