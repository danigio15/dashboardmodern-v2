# DashboardModern v2 Future Modules

DashboardModern v2 modules are functional-domain plugins backed by the approved architecture: Frontend → authenticated Home Assistant WebSocket API → Application Service → Domain → Home Assistant JSON Store. Modules register section metadata, card/widget schemas, entity mappings, actions, visibility conditions, and navigation contributions. The normal dashboard consumes enabled sections; it does not hard-code module labels.

## Section and navigation architecture

A section represents one functional domain and persists metadata using the section contract:

- `id`
- `type`
- `title`
- `subtitle`
- `icon`
- `enabled`
- `visibleInNavbar`
- `order`
- `accent`
- `badge`
- `visibility`
- `pluginConfig`
- future layout metadata

Bottom navigation is built from enabled sections with `visibleInNavbar !== false`, sorted by `order`, and decorated from section `icon`, `accent`, `badge`, and `visibility`. Plugins contribute navigation entries by registering a section type and exposing defaults plus an editor schema; the shell renders only the resulting navigation contract.

## Modules

| Module | Purpose | Expected entities | Configurable widgets | Future editor support | Navigation integration |
|---|---|---|---|---|---|
| Home | Premium landing surface with weather, alerts, quick actions, and summary cards. | weather, sensors, binary sensors, lights, climate, buttons/scripts/scenes | weather hero, alert summary, quick action, summary metrics | structured Home wizard and card schemas | default `home` section, first in navbar |
| Rooms | Floor and room organization for grouped control. | areas, floors, lights, climate, covers, sensors | room cards, floor overview, room detail popups | room/floor picker, per-room card ordering | `rooms` section with room badges |
| Lights | Whole-home and room-level lighting control. | light groups, light entities, scenes | light grid, dimmer, color/temperature, scenes | selectors for lights/scenes and behavior presets | `lights` section with active-count badge |
| Climate | HVAC and indoor comfort control. | climate entities, temperature/humidity sensors | thermostat, zone summary, schedules | HVAC mode/action schema and safety limits | `climate` section with active/target badge |
| Covers | Blinds, shutters, gates, and covers. | cover entities, binary sensors | cover controls, position group, safety status | open/close/stop action mappings | `covers` section with open-count badge |
| Energy | Legacy energy overview parity. | grid, solar, battery, consumption, tariff sensors | flow diagram, production/usage tiles, tariff cards | entity mapping wizard and units validation | `energy` section with current power badge |
| Generic Energy Nodes | Extensible energy-node graph beyond fixed solar/grid/battery assumptions. | arbitrary power/energy sensors | node card, edge/flow card, group totals | node schema editor and visual graph builder | contributes cards to Energy or custom sections |
| Generic Appliances | Reusable appliance cards for washer/dryer/dishwasher/oven/fridge/freezer/vacuum/pool/irrigation/generic devices. | state, power, energy, progress, remaining time sensors plus actions | appliance status card, action strip, detail popup | appliance type presets and status mapping editor | `appliances` section with running-count badge |
| Irrigation | Garden watering control and schedules. | switches, valves, moisture sensors, weather/rain sensors | zone card, schedule summary, moisture tile | valve/zone mapping and automation actions | `irrigation` section with active zone badge |
| Pool | Pool equipment and water monitoring. | pump, heater, cover, pH/ORP/temp sensors | pool status, pump/heater controls, chemistry cards | equipment mapping and safe action presets | `pool` section with mode/status badge |
| Security | Alarm, locks, openings, occupancy/security status. | alarm_control_panel, locks, binary sensors, persons/device trackers | alarm panel, lock grid, opening summary | secure action options and confirmation policies | `security` section with alert badge |
| Cameras | Camera status and previews without unsafe iframes. | camera/image entities, motion sensors | camera tile, motion summary, detail viewer | camera selector and privacy options | `cameras` section with motion badge |
| Vehicles | EV and wallbox management, multi-vehicle ready. | vehicle sensors, chargers, switches, power/energy sensors | vehicle card, charging status, wallbox card | vehicle/appliance presets and charge actions | `vehicles` section with charging badge |
| Server | Home Assistant host/system monitoring. | systemmonitor sensors, update entities, backups | system health, updates, resource tiles | sensor groups and severity thresholds | `server` section with health badge |
| Media | Media players and entertainment controls. | media_player, remotes, scripts/scenes | now-playing, room media card, scene shortcuts | media entity selector and supported-feature mapping | `media` section with playing-count badge |
| Statistics | Trends, history, and analytics. | recorder/statistics sensors, utility meters | charts, comparisons, trend cards | chart builder and time-range presets | `statistics` section, optional navbar item |
