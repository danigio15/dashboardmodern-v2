# Legacy Dashboard Inventory — Phase 9

Source of truth inspected: `danigio15/dashboardmodern/dashboard.html` at the repository root of the legacy project. This document summarizes structure and migration targets without copying the full legacy file.

## Inventory

| Area | Classification | Legacy notes | Migration target |
| --- | --- | --- | --- |
| Global app shell | visual-only / navigation | Single-page smart-home dashboard with animated mesh-like background, centered content, large rounded surfaces, pills, tabs, and responsive mobile viewport constraints. | `AppShell`, design tokens, shell CSS. |
| Header | visual-only | Brand/title area with high-contrast display typography and status/action affordances. | DashboardModern shell header. |
| Home Assistant sidebar/menu button | navigation | Explicit HA menu boundary/launcher affordance rather than a generic admin sidebar. | Shell menu boundary placeholder; no legacy iframe. |
| Connection status | infrastructure/debug | WebSocket status and debug panel updates surface connection state. | Runtime context connection status pill. |
| Horizontal section navigation | navigation | Tab-like horizontal sections with active state and mobile overflow. | Persisted `Dashboard.views` as tabs. |
| Home page | entity-state display / interactive control | Weather, quick status, presence, climate, lights, summary cards. | Phase 10 cards. |
| Energy page | entity-state display / chart/history | Solar, grid, battery, power flow, consumption summaries and charts. | Phase 11 energy cards and history adapters. |
| Rooms/devices pages | entity-state display / interactive control | Room tiles, lights, switches, covers, scenes, climate controls. | Phase 12 control cards. |
| EV/charging page | entity-state display / interactive control | Charger state, charging targets, EV telemetry and service calls. | Phase 13 EV cards. |
| Security/camera page | media/camera / interactive control | Alarm/security state, camera streams, HLS lifecycle, popups. | Phase 14 media and security cards. |
| Server/appliance pages | entity-state display / infrastructure/debug | Server metrics, appliances, diagnostics and remaining detailed panels. | Phase 15 cards. |
| Entity reads | entity-state display | Many `hass.states[...]` / entity id reads are embedded in page rendering functions. | Injected runtime context entity accessor. |
| Service calls | interactive control | Calls through HA WebSocket/service adapter for lights, switches, covers, climate, EV and security actions. | Runtime service-call adapter; no calls in Phase 9 static card. |
| Charts | chart/history | Chart.js runtime dependency used for history and energy visualizations. | Later chart plugin using injected history/runtime APIs. |
| Camera/HLS behavior | media/camera | HLS.js/camera stream setup, teardown and modal viewing behavior. | Later media plugin with explicit lifecycle. |
| Dialogs/popups | interactive control | Modal panels for details, confirmations, camera, debug and settings-like interactions. | Dialog primitives in later phases. |
| History interactions | chart/history | History fetching and graph updates for energy/sensors. | Later history adapter behind runtime boundary. |
| Responsive/mobile behavior | visual-only | Mobile-first viewport settings, horizontally scrollable tabs, condensed controls. | `responsive.css` and shell/nav structure. |
| Theme/dark mode | visual-only | Dark-compatible visual language with light sculpted cards and semantic colors. | CSS custom properties in token layer. |
| Third-party runtime deps | infrastructure/debug | Google Fonts (Inter, Oswald, Share Tech Mono), Chart.js, HLS.js and optional local `config.js`. | Fonts degrade gracefully; Chart/HLS deferred to later plugins. |
| Global JavaScript state | infrastructure/debug | Large global state for HA connection, entity cache, charts, streams, tabs, popups and debug. | Decompose into runtime context, plugins and application service boundaries. |
| Functions to decompose | infrastructure/debug | Connection bootstrap, entity update/render functions, service helpers, chart lifecycle, HLS lifecycle, dialog handlers, tab navigation and debug updating. | Incremental component/plugin migration. |

## Migration matrix

| Legacy feature | Source location | Proposed component/plugin | Required card config | HA runtime dependency | Migration phase | Parity status |
| --- | --- | --- | --- | --- | --- | --- |
| Shell/background/header | `dashboard.html` document shell and CSS | App shell + design system | Dashboard title/description | Connection status only | 9 | Foundation implemented |
| Section tabs | navigation handlers/classes | View tab renderer | Persisted `View` titles/order | None | 9 | Foundation implemented |
| Generic legacy panel surface | card CSS primitives | `legacy-panel` | `subtitle`, `status`, `accent`, `body` | Injected context only | 9 | Foundation implemented |
| Weather/home summary | home render functions | Weather/home cards | Entity ids, labels, units | Entity reads | 10 | Planned |
| Energy flow | energy render/chart functions | Energy flow card | Solar/grid/battery entity ids | Entity reads/history | 11 | Planned |
| Consumption charts | Chart.js setup/update | History chart card | Series definitions | History API | 11/15 | Planned |
| Room controls | room/device handlers | Room/device control cards | Entity ids/actions | Entity reads/service calls | 12 | Planned |
| EV charging | EV controls/functions | EV charging cards | Charger/vehicle entities | Entity reads/service calls | 13 | Planned |
| Alarm/security | security handlers | Security card | Alarm/camera entities | Entity reads/service calls | 14 | Planned |
| Camera streams | HLS/camera modal functions | Camera/HLS card | Camera entity/stream options | Stream URL + HLS runtime | 14 | Planned |
| Server/appliance diagnostics | server/appliance sections | Diagnostic/appliance cards | Metric entity ids | Entity reads/history | 15 | Planned |
| Debug panel | debug functions | Debug mode panel | None | Store/runtime status | 15 | Partial |
