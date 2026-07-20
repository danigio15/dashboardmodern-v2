# DashboardModern v2 Architecture

DashboardModern v2 is a greenfield Home Assistant custom integration focused on providing a modern, maintainable dashboard experience. The existing project is treated only as a functional reference for the desired user experience; no previous implementation architecture is assumed.

## Architectural Goals

- Follow modern Home Assistant custom integration patterns.
- Keep backend lifecycle, storage, services, WebSocket APIs, and entities separated.
- Keep frontend rendering and backend domain logic independent.
- Use typed contracts between layers.
- Support long-term storage migrations and future extension points.
- Prefer event-driven updates over polling.
- Make testing possible at every architectural boundary.

## Overall Architecture

```text
Home Assistant Core
        |
        v
Config Entry Lifecycle
        |
        v
Per-Entry Runtime Container
        |
        +-- Storage Layer
        +-- Coordinator Layer
        +-- Entity Layer
        +-- Service Layer
        +-- WebSocket/API Layer
        +-- Event Layer
        +-- Frontend Panel Registration
                  |
                  v
          Dashboard Frontend
```

The integration backend acts as a Home Assistant-native orchestration layer. The frontend acts as a client that renders dashboard state and sends user-driven commands through Home Assistant-approved APIs.

## Layer Responsibilities

### Config Entry Lifecycle Layer

Responsible for integration startup, unload, reload, and platform forwarding.

Responsibilities:

- Initialize the integration for each config entry.
- Create the per-entry runtime container.
- Load persistent dashboard configuration.
- Register coordinators.
- Register services and WebSocket commands.
- Register the dashboard panel.
- Forward setup to entity platforms.
- Clean up listeners and runtime state on unload.

Non-responsibilities:

- Persisting dashboard data directly.
- Rendering frontend UI.
- Performing card layout calculations directly inside lifecycle functions.

### Runtime Container Layer

The runtime container is the dependency boundary for one config entry.

Responsibilities:

- Hold references to storage managers, coordinators, listeners, and runtime options.
- Avoid global mutable state.
- Provide a single lookup point through Home Assistant's domain data registry.
- Support deterministic cleanup.

### Storage Layer

Responsible for integration-owned persistent state.

Responsibilities:

- Load and save dashboard layout data.
- Own schema versioning and migrations.
- Validate persisted dashboard documents.
- Debounce high-frequency layout writes.
- Preserve unknown future-safe fields when possible.

Non-responsibilities:

- Duplicating Home Assistant entity states.
- Replacing the entity registry, device registry, or area registry.
- Storing authentication or permission data.

### Coordinator Layer

Responsible for shared backend state refresh and derived summaries.

Responsibilities:

- Aggregate dashboard runtime state.
- Build Home Assistant registry-derived summaries.
- Create dashboard-optimized state summaries.
- Debounce expensive computations.
- Notify entities and subscribers when derived data changes.

### Entity Layer

Responsible for exposing selected integration state as Home Assistant entities.

Responsibilities:

- Provide diagnostic and control entities where useful.
- Use stable unique IDs.
- Reflect coordinator state.
- Keep entity classes small and platform-specific.

### Service Layer

Responsible for automation-friendly dashboard actions.

Responsibilities:

- Register Home Assistant services.
- Validate service payloads.
- Execute dashboard mutations through domain managers.
- Emit events after successful mutations.
- Return structured service responses where supported.

### WebSocket/API Layer

Responsible for frontend-facing commands and subscriptions.

Responsibilities:

- Register custom WebSocket commands.
- Validate request payloads.
- Check permissions.
- Return versioned structured responses.
- Provide subscriptions for dashboard events and summaries.

### Event Layer

Responsible for decoupled notifications.

Responsibilities:

- Emit Home Assistant bus events for user-visible changes.
- Use internal dispatch signals for entity/runtime updates.
- Include config entry IDs and correlation IDs in mutation events.

### Frontend Layer

Responsible for rendering and user interaction.

Responsibilities:

- Render dashboard views, cards, settings, and editor surfaces.
- Maintain frontend-only UI state.
- Communicate with the backend through WebSocket commands and native Home Assistant services.
- Subscribe to Home Assistant state changes and dashboard-specific events.

## Runtime Lifecycle

```text
Home Assistant starts
        |
        v
Integration manifest is discovered
        |
        v
Config entry setup begins
        |
        +-- Load options
        +-- Load storage
        +-- Create runtime container
        +-- Create coordinators
        +-- Register services if needed
        +-- Register WebSocket commands if needed
        +-- Register panel if enabled
        +-- Forward entity platforms
        v
Integration is ready
        |
        +-- Respond to frontend WebSocket requests
        +-- Process service calls
        +-- Refresh coordinators
        +-- Emit dashboard events
        |
        v
Config entry unload/reload
        |
        +-- Unsubscribe listeners
        +-- Unload platforms
        +-- Stop subscriptions
        +-- Remove runtime container
```

## Backend to Frontend Communication

Backend and frontend communication is WebSocket-first for dashboard-specific data and native Home Assistant service-first for entity actions.

```text
Dashboard Frontend
        |
        +-- Custom WebSocket commands for dashboard configuration
        +-- Custom WebSocket subscriptions for dashboard events
        +-- Native Home Assistant service calls for entity control
        +-- Native Home Assistant state updates for entity state
        |
        v
Home Assistant Backend
```

Communication principles:

- The frontend must not directly mutate storage.
- The backend must validate all frontend requests.
- Entity control should prefer native Home Assistant services.
- Dashboard configuration should use custom WebSocket commands.
- API responses should be versioned.
- Frontend/backend contracts should be tested.

## Storage Architecture

```text
Storage Manager
        |
        +-- Current storage document
        +-- Schema version metadata
        +-- Migration functions
        +-- Validation routines
        +-- Debounced save queue
```

Storage document categories:

- Dashboard profiles.
- Views.
- Cards.
- Layout preferences.
- Hidden or pinned entities.
- User-facing dashboard preferences.
- Feature flags that are specific to dashboard behavior.

Storage rules:

- Use explicit schema versions.
- Migrations must be idempotent.
- Writes should happen through storage abstractions only.
- Storage failures should surface through logs, diagnostics, and repairs.
- Runtime state should not be treated as persisted state.

## Event Flow

```text
Mutation source
(service, WebSocket, options flow, system task)
        |
        v
Domain manager validates and applies change
        |
        v
Storage manager persists if needed
        |
        v
Coordinator invalidates or refreshes derived data
        |
        +-- Internal dispatcher signal
        +-- Home Assistant event bus event
        |
        v
Entities and frontend subscriptions update
```

Event payloads should include:

- `config_entry_id`
- `dashboard_id`, when applicable
- `changed_by`
- `correlation_id`
- `timestamp`
- Minimal change metadata

## WebSocket Architecture

WebSocket command groups:

```text
Bootstrap
  dashboardmodern/bootstrap
  dashboardmodern/get_runtime_info
  dashboardmodern/get_capabilities

Dashboard CRUD
  dashboardmodern/dashboard/list
  dashboardmodern/dashboard/get
  dashboardmodern/dashboard/create
  dashboardmodern/dashboard/update
  dashboardmodern/dashboard/delete

View CRUD
  dashboardmodern/view/create
  dashboardmodern/view/update
  dashboardmodern/view/delete
  dashboardmodern/view/reorder

Card CRUD
  dashboardmodern/card/create
  dashboardmodern/card/update
  dashboardmodern/card/delete
  dashboardmodern/card/reorder

Metadata
  dashboardmodern/areas/list
  dashboardmodern/entities/list_supported
  dashboardmodern/devices/list_supported
  dashboardmodern/suggestions/build

Subscriptions
  dashboardmodern/subscribe_dashboard_events
  dashboardmodern/subscribe_runtime_health
  dashboardmodern/subscribe_summaries
```

Response shape principles:

- Include an API contract version.
- Include data and warnings separately.
- Include a correlation ID for traceability.
- Return structured error codes.
- Avoid leaking internal stack traces or sensitive data.

## Component Dependency Diagrams

### Backend Dependency Direction

```text
Lifecycle
  |
  +-- Runtime Container
  |     +-- Storage
  |     +-- Coordinators
  |     +-- Event Dispatcher
  |
  +-- Services -----> Runtime Container
  +-- WebSocket API -> Runtime Container
  +-- Entity Platforms -> Coordinators
  +-- Panel Registration
```

### Frontend Dependency Direction

```text
Frontend Entry Point
        |
        v
Application Shell
        |
        +-- API Clients
        +-- Stores
        +-- Layouts
        +-- Cards
        +-- Shared Components
        +-- Theme Tokens
```

### Contract Boundary

```text
Backend typed models
        |
        v
Versioned WebSocket schema
        |
        v
Frontend TypeScript types
        |
        v
Rendered dashboard components
```

## Maintainability Rules

- Keep lifecycle code thin.
- Keep storage writes behind one abstraction.
- Keep entities thin and coordinator-backed.
- Keep frontend components data-driven.
- Keep API contracts versioned.
- Avoid global mutable state.
- Avoid coupling storage shape directly to visual component internals.
- Add tests before expanding public contracts.

## Phase 6 frontend WebSocket architecture

DashboardModern remains a custom HTML/CSS/JavaScript dashboard. `Dashboard`, `View`, `Section`, and `Card` are backend configuration payloads only; the frontend treats them as JSON and does not convert them into Lovelace, dashboard YAML, entities cards, or server-rendered UI.

The frontend entry point is `custom_components/dashboardmodern/frontend/index.html`. It loads `src/app.js`, which binds the existing dashboard list, JSON editor, and create/save/delete buttons without redesigning the page. Runtime state is centralized in `DashboardModernStore` and contains one source of truth for the config entry id, dashboard list, active dashboard id, active dashboard JSON, loading state, saving state, deleting state, and error state.

Home Assistant communication is isolated in `src/ws-client.js`. UI code calls this module instead of scattering raw WebSocket messages through DOM handlers. The client uses the authenticated Home Assistant frontend connection's `sendMessagePromise` method and intentionally does not open a second WebSocket. The current resolver checks, in order:

1. `entry_id` or `config_entry_id` in the page URL.
2. A DOM element with `data-dashboardmodern-entry-id`.
3. A single `dashboardmodern` entry exposed on `hass.configEntries`.

If none of those sources yields an id, initialization fails with a user-facing error instead of silently falling back to mock data. Development-only mock data can be injected explicitly through the store's `developmentFallback` option in tests or local harnesses.

### Supported frontend WebSocket commands

The frontend API layer wraps the Phase 5 commands exactly as JSON payloads:

- `dashboardmodern/dashboard/list`
- `dashboardmodern/dashboard/get`
- `dashboardmodern/dashboard/create`
- `dashboardmodern/dashboard/replace`
- `dashboardmodern/dashboard/delete`

Mutation responses are copied back into `DashboardModernStore`, and the dashboard list is refreshed after create, replace, and delete. The active dashboard is preserved when the backend list still contains its id; otherwise the first returned dashboard is selected.

### Frontend error handling

Home Assistant WebSocket errors are mapped to `DashboardModernApiError` while preserving the original error code for debugging. The UI renders a concise status message for known codes:

- `entry_not_found`
- `entry_not_loaded`
- `dashboard_not_found`
- `dashboard_already_exists`
- `dashboard_persistence_error`
- `invalid_dashboard`
- `unauthorized`
- `dashboardmodern_error`
- `invalid_format`

Malformed backend responses are treated as `invalid_format`. Failed operations update the centralized error state and do not crash DOM event handlers.

### Running frontend tests

Frontend tests use Node's built-in `node:test` runner to keep Phase 6 lightweight and avoid adding a bundler or browser test framework before the plain JavaScript frontend needs one.

Run:

```bash
npm run test:frontend
```

### Home Assistant panel registration

Phase 6 exposes the frontend through Home Assistant's integration lifecycle instead of requiring users to open files from `custom_components`. `async_setup_entry` registers the WebSocket API and calls the DashboardModern frontend registrar. The registrar serves static assets from `/dashboardmodern_static`, registers a `dashboardmodern` sidebar panel with `panel_custom.async_register_panel`, and keeps a sorted `entry_ids` list in Home Assistant domain data for deterministic entry selection across one entry, multiple entries, unload, and reload.

The panel web component (`dashboardmodern-panel`) receives Home Assistant's authenticated `hass` object from the supported custom panel host. `panel.js` adapts `hass.connection` into the transport expected by `src/ws-client.js`; the WebSocket client itself remains transport-only and does not know about Home Assistant panel globals.

The Phase 6 panel is intentionally a backend-connected shell with a JSON editor. It is not presented as the final visual DashboardModern editor, and migrating any richer visual dashboard UI remains future work. The frontend still treats dashboard payloads as JSON and does not introduce Lovelace or YAML conversion.
