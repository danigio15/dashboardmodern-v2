# Legacy dashboard inventory

## Phase 10 — Home and Weather parity

Source inspected: `danigio15/dashboardmodern/dashboard.html` at `/tmp/dashboardmodern-legacy/dashboard.html`. The legacy repository was cloned read-only for inspection and was not modified.

### Home DOM and widget hierarchy

- `section#page-home.page.active`
  - `div.weather-widget` clickable via `apriMeteo()`.
    - `div.w-left` → `div#w-icon.w-icon`, `div.w-temp-wrap`, `span#w-temp.w-temp`, `span#w-state.w-state`.
    - `div.w-right` → two `div.w-detail` rows for humidity and wind.
  - `div#dashboard-pills-row.dashboard-pills-row` containing the conditional boiler and alarm pills.
  - `h3.section-title` with `Quadro Avvisi`.
  - `div#glance-grid.glance-grid` containing hidden-until-active alert cards: lights, climate, heating, openings, low batteries, plus a custom wrapper.
  - `h3.section-title` with `Azioni Rapide Premium` and generated quick actions.

### Weather data and fallback logic

- Legacy weather resolves the first mapped state from `dm.core_055`, `weather.home`, then `dm.home_meteo`.
- If required mapping is enabled and the weather state is unmapped, the widget is hidden; otherwise unavailable values render as `--`.
- Current fields: state condition, `attributes.temperature`, `attributes.humidity`, `attributes.wind_speed`, and `last_updated` for freshness/debug contexts.
- Forecast fields: `forecast[].datetime`, `forecast[].condition`, `forecast[].templow`, `forecast[].temperature`, and hourly `forecast[].precipitation`.
- Forecast retrieval first calls `weather.get_forecasts` with `daily`; if that fails, legacy falls back to state `attributes.forecast`, then hourly-derived daily samples.

### Icons and labels

- Controlled condition map: `clear-night` 🌙, `cloudy` ☁️, `fog`/`hail` animated fog legacy treatment, `lightning`/`lightning-rainy` ⛈️, `partlycloudy` ⛅, `pouring`/`rainy` 🌧️, `snowy` ❄️, `snowy-rainy` 🌨️, `sunny` ☀️, `windy`/`windy-variant` 💨.
- Italian labels: Sereno (Notte), Nuvoloso, Nebbia, Grandine, Fulmini, Temporale, Poco Nuvoloso, Acquazzone, Pioggia, Neve, Nevischio, Soleggiato, Ventoso, Vento Forte.

### Interactions and refresh behavior

- Weather hero click opens the forecast modal; forecast day click opens hourly forecast. Phase 10 routes equivalent actions through the injected `runtime.interactions` adapter where available.
- Glance cards call details/history helpers in legacy; Phase 10 routes entity history through `runtime.interactions.openHistory`.
- Legacy updates on its global render after HA WebSocket state changes. Phase 10 cards read only live `getEntityState()` from the injected runtime and introduce no polling or backend render calls.

### Layout, theme, animation, localization

- Desktop: weather hero is a two-column flex card with sculpted radius/elevation; glance cards use an auto-fit grid with `minmax(190px, 1fr)`.
- Tablet/mobile: weather padding/radius/type scales down and stacks compactly; glance cards reduce padding and radius.
- Dark mode: weather uses a dark blue gradient and token-compatible borders/text.
- Animations are restrained: rotating weather mesh, floating weather icon, glance pulse/scan, all disabled under reduced motion.
- Legacy locale is Italian (`it-IT`) for weekday/day and weather labels; Phase 10 helpers accept runtime locale for number/date formatting while preserving legacy Italian condition labels.

### Parity checklist

- [x] Dedicated `weather-current` plugin with renderer, structured editor, defaults, validator, fallback renderer, legacy CSS, and narrow runtime access.
- [x] Dedicated `weather-forecast` plugin with controlled forecast rendering and safe count range of 1–10.
- [x] Dedicated `home-summary` plugin for the Quadro Avvisi hierarchy instead of one generic whole-page card.
- [x] Controlled icon/label mapping; no remote icon URLs or persisted executable markup.
- [x] Unknown/unavailable/malformed weather states render clear legacy-styled empty states without throwing.
- [x] Live metrics come only from configured entity ids through `getEntityState()` and are not persisted.
- [x] Rendering does not call backend, ws-client, store, persistence, domain, application service, or `runtime.hass`.
- [x] Legacy desktop/tablet/mobile/dark/reduced-motion styling added to existing CSS modules.
- [x] Structured editors and plugin validators cover required entity ids, booleans, forecast count, and strings.
- [x] Frontend tests cover weather rendering, forecast rendering, unavailable/malformed states, icon mapping, locale formatting, home summary rendering, plugin validation, runtime state use, architecture boundaries, no iframe/arbitrary HTML, and safe text rendering.
