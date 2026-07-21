# Legacy dashboard inventory

## Phase 10 — Home and weather parity slice

Source inspected: `danigio15/dashboardmodern/dashboard.html` at `/tmp/dashboardmodern-legacy/dashboard.html`. The legacy repository was cloned read-only for inspection and was not modified.

Phase 10 intentionally implements a **Home and weather parity slice**. It does not claim complete Home parity for every legacy Home element; it migrates the weather hero/forecast and the Home `Quadro Avvisi` summary cards into explicit Phase 9 card plugins.

### Home DOM and widget hierarchy audited

- `section#page-home.page.active`
  - `div.weather-widget` clickable via `apriMeteo()`.
    - `div.w-left` → `div#w-icon.w-icon`, `div.w-temp-wrap`, `span#w-temp.w-temp`, `span#w-state.w-state`.
    - `div.w-right` → two `div.w-detail` rows for humidity and wind.
  - `div#dashboard-pills-row.dashboard-pills-row` containing conditional boiler and alarm pills.
  - `h3.section-title` with `Quadro Avvisi`.
  - `div#glance-grid.glance-grid` containing alert cards for lights, climate, heating, openings, low batteries, plus a custom wrapper.
  - `h3.section-title` with `Azioni Rapide Premium` and generated quick actions.
  - Optional custom device and appliance grids.

### Weather data and fallback logic audited

- Legacy weather resolves the first mapped state from `dm.core_055`, `weather.home`, then `dm.home_meteo`.
- If required mapping is enabled and the weather state is unmapped, the widget is hidden; otherwise unavailable values render as `--`.
- Current fields: state condition, `attributes.temperature`, `attributes.humidity`, `attributes.wind_speed`, and `last_updated` for freshness/debug contexts.
- Forecast fields: `forecast[].datetime`, `forecast[].condition`, `forecast[].templow`, `forecast[].temperature`, and hourly `forecast[].precipitation`.
- Forecast retrieval first calls `weather.get_forecasts` with `daily`; if that fails, legacy falls back to state `attributes.forecast`, then hourly-derived daily samples.

### Icons and labels audited

- Legacy condition concepts: clear night, cloudy, fog/hail, lightning/storm, partly cloudy, pouring/rainy, snowy/snowy-rainy, sunny, windy/windy variant.
- Phase 10 maps those concepts to controlled local icon ids: `moon`, `cloud`, `fog`, `storm`, `rain`, `snow`, `sun`, and `wind`; no emoji, remote icon URLs, or HTML icon snippets are accepted from persisted config.
- Italian labels preserved: Sereno (Notte), Nuvoloso, Nebbia, Grandine, Fulmini, Temporale, Poco Nuvoloso, Acquazzone, Pioggia, Neve, Nevischio, Soleggiato, Ventoso, Vento Forte.

### Interactions and refresh behavior audited

- Weather hero click opens the forecast modal; forecast day click opens hourly forecast. Phase 10 routes equivalent weather opening through the injected `runtime.interactions.openWeather` adapter where available.
- Glance cards call details/history helpers in legacy; Phase 10 routes entity history through `runtime.interactions.openHistory` only for available configured metrics.
- Legacy updates on its global render after HA WebSocket state changes. Phase 10 cards read only live `getEntityState()` from the injected runtime and introduce no polling or backend render calls.

### Layout, theme, animation, localization audited

- Desktop: weather hero is a two-column flex card with sculpted radius/elevation; glance cards use an auto-fit grid with `minmax(190px, 1fr)`.
- Tablet/mobile: weather padding/radius/type scales down and stacks compactly; glance cards reduce padding and radius.
- Dark mode: weather uses a dark blue gradient and token-compatible borders/text.
- Animations are restrained: rotating weather mesh, floating weather icon, glance pulse/scan, all disabled under reduced motion.
- Legacy locale is Italian (`it-IT`) for weekday/day and weather labels; Phase 10 helpers accept runtime locale for number/date formatting while preserving legacy Italian condition labels.

### Implemented in Phase 10

- `weather-current` card plugin: legacy weather hero hierarchy, current temperature/condition/humidity/wind, controlled local SVG icon ids, unavailable/missing/malformed states, structured entity editor, validator, keyboard-accessible interaction adapter.
- `weather-forecast` card plugin: legacy forecast row treatment using normalized `attributes.forecast`, configurable item count from 1–10, local SVG condition icons, fallback state when no forecast exists.
- `home-summary` card plugin: `Quadro Avvisi` heading, glance grid/card hierarchy, configurable metrics, controlled icon registry, controlled accent registry, pure metric normalization, structured item-row editor, and history adapter routing.
- Runtime boundary: plugins use only injected runtime capabilities and do not import websocket client, store, persistence, domain, application service, migrations, or backend modules.

### Partially implemented in Phase 10

- Weather forecast modal behavior is represented by adapter routing and the forecast card, not by recreating the full legacy modal stack in card code.
- Legacy fog/hail animated HTML icon treatment is replaced by controlled local SVG `fog` icon styling for safety and deterministic rendering.
- Legacy Home summary visibility used to hide zero-count cards; Phase 10 keeps configured cards visible so unavailable/missing/malformed states are explicit and not misleading.

### Deferred from this parity slice

- Legacy greeting/title/date/time/house status content beyond the audited weather and `Quadro Avvisi` slice.
- Boiler and alarm status pills.
- Quick actions, custom devices, appliances, Energy, EV, Security, Camera, and Server features.
- Legacy hourly forecast modal internals and direct `weather.get_forecasts` service retrieval during render; no polling/backend calls are introduced in card plugins.

### Parity checklist

- [x] Dedicated `weather-current` plugin with renderer, structured editor, defaults, validator, fallback renderer, legacy CSS, and narrow runtime access.
- [x] Dedicated `weather-forecast` plugin with controlled forecast rendering and safe count range of 1–10.
- [x] Dedicated `home-summary` plugin for the `Quadro Avvisi` hierarchy instead of one generic whole-page card.
- [x] Controlled local SVG icon ids; no remote icon URLs, emoji icons, arbitrary HTML, or persisted executable markup.
- [x] Unknown/unavailable/missing/malformed weather states render distinct legacy-styled empty states without throwing.
- [x] Home summary metric normalization handles numeric, decimal, zero, unknown, unavailable, malformed, and missing entity states without silently converting unavailable states to zero.
- [x] Live metrics come only from configured entity ids through `getEntityState()` and are not persisted.
- [x] Rendering does not call backend, ws-client, store, persistence, domain, application service, or `runtime.hass`.
- [x] Legacy desktop/tablet/mobile/dark/reduced-motion styling added to existing CSS modules.
- [x] Structured editors and plugin validators cover required entity ids, stable item keys, labels, controlled icons, controlled accents, booleans, forecast count, strings, and executable-template rejection.
- [x] Frontend tests cover default configs, missing required ids blocking Save, icon registry safety, remote icon rejection, normalizers, unavailable states, structured item editor operations, Advanced JSON validation, correction enabling Save, activeDashboard immutability before Save, render/backend boundaries, no iframe/arbitrary HTML, and safe text rendering.
