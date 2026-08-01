# DashboardModern 0.14.12 acceptance checklist

This release corrects the real Home Assistant regressions visible after 0.14.11.

## Temperature

- The editor only associates an existing canonical room with temperature and optional humidity entities.
- The room name and icon remain owned by Rooms.
- The legacy `Simbolo` control is not visible or focusable.
- Saving copies the selected room icon internally without exposing a duplicate icon editor.
- The form uses the same card, spacing, entity picker and primary action conventions as the other editors.

## Appliances

- Fridge and water-heater fallbacks use dedicated filled artwork rather than the old thin outline SVGs.
- Artwork remains centered, contained and responsive inside the same media viewport used by the oven card.
- User-provided images continue to take precedence over fallback artwork.

## Energy totals and Report

- `recorder/statistics_during_period` is sent through the authenticated Home Assistant bridge.
- Invalid `change` entries are not sent in the `types` request field.
- A single lifetime `sum`/`state` row is never displayed as a day, month or year value.
- Day, selected month and year are calculated from Recorder changes or a real baseline delta.
- Derived values are written to the legacy `CD_PERIOD` registry actually used by the Energy maps, as well as the runtime state registries.
- An unavailable historical month remains a local Report error and does not change the global Home Assistant connection state.

## Report and branding regression checks

- Appliance Report options/previews retain their icon or image and never expose raw `mdi:*` tokens.
- Local Home Assistant/HACS branding remains present in `custom_components/dashboardmodern/brand/`.
- HACS, hassfest, unit tests and Browser E2E must all be green before merge.
