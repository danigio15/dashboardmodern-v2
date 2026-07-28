# Unified dashboard model audit — 0.13.0

## Reproduction baseline

The defects were reproduced against the vendored DOM by executing the real inline CRUD and renderer functions in `legacy-functional.test.js`, with instrumented storage, sync, and DOM targets. The common cause was split ownership: editors mutated a legacy key while cards retained their previous signature and visibility/navigation were refreshed by unrelated global render calls.

| Area | Function before | Legacy storage | Model/DOM before | Why refresh was needed | After |
| --- | --- | --- | --- | --- | --- |
| Appliances | `edApplSave`, `edApplDel` | `cd_appliances` | ad-hoc objects; card signature could retain the old name/icon | persistence, section rendering and report rendering were separate calls | canonical transaction persists, syncs, then publishes a targeted change |
| Cameras | `dmSaveCameras` | `cd_cameras` | editor array and camera grid signature were separate state | grid signature/card list was not invalidated consistently | canonical replace plus immediate signature invalidation and card refresh |
| Visibility | `cdEnsureSectionVisible` | `cd_sections` | each editor decided whether to show a tab | navbar was not a store dependency | zero-to-one transitions call `ensureSectionVisibleForData` in the store |
| Energy | report helpers | `cd_report_devices`, `cd_appliances` | names/icons were assembled by individual views | reports did not share presentation rules | report/editor consume canonical name, visual and appliance records |
| Lights/rooms | `cdLuciAddRoom`, `cdLuciRenameRoom`, `cdLuciDeleteRoom` | `cd_luci_rooms`, `cd_luci_room_order`, `cd_stanze` | lights duplicated room lifecycle controls | room names were treated as relationships | lifecycle UI removed from Lights; selectors use stable room ids |

## Canonical schema

`schema_version: 2` stores sections containing devices with stable `id`, `section`, `name`, `icon`, `image`, `room_id`, `entities`, `enabled`, `order`, and `metadata`. Appliances additionally expose the seven energy/control entity fields and `device_type`. Updates explicitly retain the existing id.

Migration is idempotent, creates `dm_dashboard_backup_v<old-version>`, maps legacy room names to ids, separates icon/type, removes sentinel names (`generico`, `OTHER`), carries `image_url`, flattens legacy entity objects, and writes the canonical state once through the persistence adapter.

## DOM/event flow

`action → DashboardStore transaction → canonical persistence/legacy projection → backend sync → dashboardmodern change event → section renderer → dependent energy/room renderers → navbar only when visibility changed`.

A failed sync restores the prior model and persisted projection and emits an error status rather than a stale render notification.

## Screenshots

The changed editor is hosted inside an authenticated Home Assistant iframe, which is unavailable in this repository-only environment. The DOM behavior is therefore captured programmatically in the frontend functional tests; no synthetic screenshot is presented as a real Home Assistant reproduction.

## Phase 2 hardening

The store now emits `optimistic` before awaiting backend synchronization, followed by `success`; a failed synchronization restores the snapshot, persists it, and emits `rollback` so the same coordinator reverses the DOM update. Legacy `cd_*` writes are outbound projections; the compatibility write bridge reconciles unavoidable old writers into `dm_dashboard_state`.

Migrations are section-specific (`migrateRooms`, `migrateCameras`, `migrateAppliances`, `migrateLights`, `migrateClimate`, `migrateEv`, `migrateCovers`, `migratePool`, `migrateIrrigation`, and `migrateEnergy`). Energy, pool, and irrigation retain object schemas. Room ids use deterministic floor/name slugs with deterministic collision suffixes.

Visual regression coverage records navbar/page/card class and section-order snapshots and byte-for-byte hashes of every global layout stylesheet. No global CSS, navbar, card layout, desktop layout, or mobile layout file changed during this phase. Browser screenshots remain blocked because no browser binary is installed and the package registry rejects Playwright installation (HTTP 403); the authenticated Home Assistant iframe is also unavailable.
