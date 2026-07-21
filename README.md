# dashboardmodern-v2
Dashboard for Home assistant 

## Frontend development

DashboardModern's frontend is plain HTML/CSS/JavaScript under `custom_components/dashboardmodern/frontend`. It talks to Home Assistant only through the authenticated frontend WebSocket connection and the DashboardModern commands documented in `ARCHITECTURE.md`; it does not use Lovelace YAML or direct Home Assistant Store access.

Run frontend tests with:

```bash
npm run test:frontend
```

### Phase 7 visual renderer

DashboardModern now opens to a visual, read-only dashboard renderer instead of the raw JSON editor. The panel renders the selected DashboardModern dashboard title, description, ordered views, ordered sections, and ordered cards from the serialized configuration returned by the existing WebSocket-backed application layer.

View selection is presentation state (`activeViewId`) held in the frontend store. Switching views does not save or mutate the dashboard configuration. Refreshing the same dashboard preserves the selected view when it still exists and otherwise falls back to the first valid view in backend order.

Live Home Assistant entity state remains separate from DashboardModern configuration. Phase 7 does not display entity-specific cards yet because no formal domain/API card contract defines entity references. When that contract exists, entity state should come from the `hass` object supplied to the custom panel and must not be persisted as dashboard data.

Cards use a frontend renderer registry keyed by the backend payload's card `type`, but Phase 7 intentionally registers no authoritative typed card contracts. Unknown card types and malformed card payloads render visible local fallback cards rather than crashing the entire dashboard. Because the current Card model exposes only `id`, `title`, `type`, and a generic `config` mapping, typed text/entity rendering is blocked until a future domain/API extension formalizes supported card types and config fields.

The former JSON editor remains available through the **Debug JSON** mode as a development/configuration view. It is clearly labelled, is not the default dashboard screen, and still saves through the centralized DashboardModern store.
