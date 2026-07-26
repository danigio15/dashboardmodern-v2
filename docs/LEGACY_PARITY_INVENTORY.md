# DashboardModern v2 Legacy Parity Inventory

Reference repository inspected: `https://github.com/danigio15/dashboardmodern` (`dashboard.html`, `dashboard-en.html`, `config.example.js`, `README.md`, screenshots, setup wizard and editor views). v2 mapping: Frontend → authenticated Home Assistant WebSocket API → Application Service → Domain → Home Assistant JSON Store.

| Component | Legacy source location | Legacy behavior | Visual characteristics | Required configuration | HA data/entities | Proposed v2 shell/card/plugin | Status | Missing work | Test requirements |
|---|---|---|---|---|---|---|---|---|---|
| Application shell | `dashboard.html`, `dashboard-en.html`, screenshots `home-dark.png`, `home-light.png` | Main premium dashboard container, sections, edit flow | Sculpted gradient/mesh background, glass cards, rounded header | dashboard config, theme, sections | HA auth/session | app shell + tokens | Foundation implemented | deeper page parity | shell responsive tests |
| Branding/header | `config.example.js`, README | Custom title/logo/subtitle | Large uppercase title, compact menu/status | title, subtitle, logo, accent | none | dashboard config branding contract | Foundation implemented | logo picker | persistence tests |
| Connection status | dashboard scripts | Shows connection state | Green pill | none | websocket state | shell status pill | Foundation implemented | reconnect details | render state tests |
| Navigation/tabs | dashboards | Tabbed pages | pill navigation | views metadata | none | View model | Existing | legacy icons | navigation tests |
| Home weather hero | home screenshots | Current weather and forecast summary | large temperature hero, soft green surface | weather, temp, humidity, wind | weather + sensors | `weather-hero` | Implemented foundation | forecast service modes | state tests |
| Alert summary | home screenshots | Counts active home alerts | compact tiles | presets/custom conditions | lights, climate, binary_sensors, batteries | `alert-summary` | Implemented foundation | entity selectors | calculation tests |
| Quick actions | home screenshots/config | One tap service shortcuts | icon action cards | service/action targets | services/entities/devices/areas | `quick-action` | Implemented foundation | confirmation modal | payload tests |
| Rooms/floors | editor screenshots | Organized room sections | room cards/floor grouping | room/floor metadata | areas/floors/entities | section metadata contract | Contracted | cards | hierarchy tests |
| Lights | `config.example.js`, lights screenshots | Toggle/dim lights | glow icons/sliders | entity mappings | light entities | device-control + future room plugin | Partial existing | popups | service tests |
| Climate | dashboard/config | HVAC status/control | temperature cards | climate entities | climate | climate-control + alert preset | Partial | advanced modes | service tests |
| Covers | dashboard/config | Open/close covers | directional controls | cover entities | cover | cover-control | Partial | grouping | service tests |
| Alarm/security | dashboard/config | Arm/disarm/security states | protected card controls | alarm/lock/binary | alarm_control_panel, lock | alarm-control/alert | Partial | keypad | service tests |
| Appliances | config/screens | appliance status/action | premium device tiles | per-device entities/actions | sensors/switches | `generic-appliance` | Implemented foundation | detail popup | mapping tests |
| Energy flow | `screenshots/energia.png` | Solar/grid/battery/load flow | animated energy diagram | nodes/tariffs | sensor entities | energy plugins | Partial existing | modular nodes | renderer tests |
| Load groups | config | group load consumption | grouped metrics | group definitions | sensors | energy contract | Contracted | UI | aggregation tests |
| Tariffs | config | cost/tariff display | badges/charts | tariff sensors | sensors | energy contract | Contracted | editor | calculation tests |
| Cameras | dashboard/config | camera status/previews | media tiles | camera entities | camera | camera-status | Partial | streaming popup | safe rendering tests |
| Boiler/solar thermal | config | thermal status | appliance/energy card | entities/actions | sensors/switches | generic appliance/energy node | Contracted | specialized visuals | mapping tests |
| EV/wallbox | config | charging status/control | energy/device card | vehicle/wallbox entities | sensors/switches | generic appliance + energy node | Contracted | multi-vehicle detail | action tests |
| Server/system | dashboard/config | system stats | metric cards | system sensors | sensors | sensor-status | Partial | grouped system plugin | state tests |
| Charts/history | dashboard | trend charts | compact line/bar charts | history entities | recorder/statistics | future chart plugin | Not started | HA history API | chart tests |
| Setup wizard | README/screens | guided setup | stepper wizard | onboarding answers | discovery | future setup module | Not started | full wizard | E2E tests |
| Entity discovery/search | wizard/editor | find entities | search/select UI | domains/selectors | HA states/registries | editor schema selectors | Contracted | HA selectors | editor tests |
| Editor | screenshots | visual config editing | polished forms/tree | plugin schemas | dashboard store | plugin-driven schemas | Foundation existing | avoid technical labels in visual | schema tests |
| Themes | screenshots | light/dark | green accent/glass | mode/accent | none | theme tokens/contract | Implemented foundation | runtime switcher | token tests |
| Responsive behavior | screenshots | desktop/mobile | adaptive grids/cards | layout per breakpoint | none | card layout contract | Existing + tokens | final breakpoints | layout tests |
| Multilingual support | `dashboard-en.html`, README | Italian/English dashboards | localized labels | locale/messages | HA locale | locale runtime contract | Contracted | translations | locale tests |

## Future functional-domain roadmap

DashboardModern v2 will grow from the Home foundation into configurable functional sections. Each section will use the section contract (`id`, `type`, `title`, `subtitle`, `icon`, `enabled`, `visibleInNavbar`, `order`, `accent`, `badge`, `visibility`, `pluginConfig`, and future layout metadata). Bottom navigation will be derived from enabled sections that opt into navbar visibility rather than from hard-coded UI labels.

Planned section domains: Home, Rooms, Lights, Climate, Covers, Energy, Appliances, Irrigation, Pool, Security, Cameras, Vehicles, Server, Media, People, Statistics, and Configuration.
