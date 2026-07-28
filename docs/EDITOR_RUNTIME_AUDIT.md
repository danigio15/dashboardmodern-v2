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
