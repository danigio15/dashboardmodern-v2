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

The Home Assistant frontend entry point is `custom_components/dashboardmodern/frontend/panel.js`. The custom panel creates the Phase 6 shell from `src/app.js`, which binds the dashboard list, JSON editor, and create/save/delete buttons without redesigning the page. Runtime state is centralized in `DashboardModernStore` and contains one source of truth for the config entry id, dashboard list, active dashboard id, active dashboard JSON, loading state, saving state, deleting state, and error state.

Home Assistant communication is isolated in `src/ws-client.js`. UI code calls this module instead of scattering raw WebSocket messages through DOM handlers. The panel adapter receives Home Assistant's authenticated `hass.connection` from the supported custom panel host and passes its `sendMessagePromise` transport to the client; the frontend does not open a second WebSocket and does not depend on undocumented `window.hass`, `home-assistant`, or `hass.configEntries.dashboardmodern` globals.

Config entry discovery is driven by backend panel configuration. The integration registers the panel with the currently loaded DashboardModern entry ids, updates that panel configuration as entries are loaded/unloaded/reloaded, and the panel auto-selects the only entry or requires an `entry_id` URL parameter when multiple loaded entries exist. Development-only mock data can be injected explicitly through the store's `developmentFallback` option in tests or local harnesses.

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

Phase 6 exposes the frontend through Home Assistant's integration lifecycle instead of requiring users to open files from `custom_components`. `async_setup_entry` creates and stores the runtime first, then registers/updates frontend membership only after runtime setup succeeds; if frontend registration fails, setup rolls back the newly stored runtime.

The frontend registrar serves static assets from `/dashboardmodern_static` once and registers the `dashboardmodern` sidebar panel through Home Assistant's panel registry. Static paths and panel visibility have separate lifecycle state: `static_registered` is preserved because Home Assistant does not provide static-path unregistering, while `panel_registered` and `panel_entry_ids` track the currently visible panel and loaded entries. When the final entry unloads, DashboardModern removes the panel and clears panel state; a later reload re-adds the panel without duplicating static registration.

Panel membership updates use fresh panel configuration snapshots rather than mutating a previously registered Python list. The real panel registry is tested for the sequence `["entry-1"]`, `["entry-1", "entry-2"]`, `["entry-2"]`, and `["entry-1", "entry-2"]` across setup, second setup, unload, and reload.

The panel web component (`dashboardmodern-panel`) receives Home Assistant's authenticated `hass` object from the supported custom panel host. `panel.js` adapts `hass.connection` into the transport expected by `src/ws-client.js`; the WebSocket client itself remains transport-only and does not know about Home Assistant panel globals.

The Phase 6 panel is intentionally a backend-connected shell with a JSON editor. It is not presented as the final visual DashboardModern editor, and migrating any richer visual dashboard UI remains future work. The frontend still treats dashboard payloads as JSON and does not introduce Lovelace or YAML conversion.

## Phase 7 visual dashboard renderer

Phase 7 makes the custom DashboardModern panel visual by default. The browser still uses the authenticated Home Assistant `hass.connection` WebSocket path to call DashboardModern's application service, and the backend still owns validation, persistence, and business rules for Dashboard, View, Section, and Card configuration. The frontend rendering layer in `frontend/src/render/` accepts plain serialized dashboard payloads from the centralized store and never opens its own WebSocket, calls REST endpoints, talks to the Home Assistant Store, or uses Lovelace/YAML concepts.

The frontend now separates responsibilities as follows:

- `ws-client.js`: DashboardModern WebSocket transport only.
- `state.js`: centralized backend state plus presentation state such as `activeViewId`, visual/debug mode, and render errors.
- `app.js`: shell creation and DOM event/controller wiring.
- `render/dashboard-renderer.js`, `render/view-renderer.js`, `render/section-renderer.js`, and `render/card-renderer.js`: read-only visual rendering from serialized configuration.

Configuration state and presentation state are intentionally distinct. Selecting a view updates only `activeViewId` in frontend state; it does not mutate or save the backend DashboardModern dashboard. When a dashboard is refreshed, the previous active view is preserved if the backend payload still contains it; otherwise the first valid backend-ordered view is selected deterministically.

DashboardModern configuration remains separate from live Home Assistant entity state. Phase 7 does not render entity-specific cards because the current domain/API payload does not formalize any entity card discriminator or entity-id config field. A future typed card contract should define how supported cards may reference live Home Assistant state before the renderer displays those values.

Cards are rendered through an extensible registry keyed by the serialized card `type`. Phase 7 registers no built-in typed card contracts because the backend currently exposes only an open Card `config` mapping. Unknown or malformed cards produce local visible fallback cards so the rest of the dashboard can continue rendering, and generic cards may safely show configuration key names without interpreting those keys as business semantics.

The current backend Card schema defines `id`, `title`, `type`, and an open JSON-compatible `config` mapping, but it does not define typed card-specific configuration contracts. Phase 7 therefore does not add permanent frontend-only business rules for text, markdown, info, entity, entity-state, or any specific `config` fields. The smallest future domain extension is a typed card configuration/discriminator contract that formalizes supported card types and their required config fields in the domain/API schema.

The Phase 6 JSON editor remains available as a clearly labelled configuration/debug view. It is not the default primary screen, it uses the existing centralized store for saves, and invalid JSON is represented as a frontend render/validation error rather than a backend API error.

## Phase 8 Visual Dashboard Editor

The frontend now has three explicit modes: **Dashboard**, **Edit**, and **Debug JSON**. Dashboard mode is read-only and renders persisted state. Edit mode is a separate editor layer under `frontend/src/editor`, distinct from WebSocket transport, read-only renderers, presentation selectors, centralized persisted state, and DOM shell/controller code. Debug JSON is secondary development tooling.

Editor state is centralized separately from persisted dashboard state. It tracks whether editing is active, dirty status, a `draftDashboard`, id-based selected node state, validation errors, save errors, and saving/debug details. Entering Edit clones the selected dashboard into this draft. Cancelling clears the draft. A successful save replaces persisted `activeDashboard` with the backend response through `DashboardModernStore.replaceDashboard`; failed saves leave the dirty draft intact. Frontend presentation state such as `activeViewId` remains separate from editor selection.

Editor command modules are pure hierarchy operations. They update dashboard metadata, add/update/remove/move views, add/update/remove/move sections within a view, and add/update/remove/move cards within a section. Commands preserve ordered id arrays, collision-check generated ids, avoid duplicate ids, avoid changing unrelated objects, and cascade deletion through the aggregate hierarchy so removing a view removes owned sections and cards and removing a section removes owned cards.

Identifier generation is injectable and deterministic in tests. Generated ids are collision-checked against all ids in the dashboard aggregate and are stable data ids, not array indexes. DOM rendering still uses the existing `safeDomId` transformation before ids are placed in DOM id attributes.

Unsaved-change protection is an injectable confirmation policy rather than hidden command-module `window.confirm` calls. It applies before switching dashboards, leaving Edit, deleting the active dashboard, or replacing the active draft with a fresh backend load. Edit and Debug JSON share the same draft: valid Debug JSON parses into the draft, while invalid Debug JSON stays local and leaves the last valid draft untouched.

The visual editor exposes only currently supported dashboard fields (`title` and existing `description` where present), view/section titles and descriptions, and the generic Card schema (`title`, opaque `type`, and object `config`). It intentionally does not create Lovelace, YAML, entity-specific cards, frontend-owned business validation, or permanent typed Card schemas. Backend/domain validation remains authoritative.

The editing preview is generated by the existing read-only renderer from the draft payload. Preview rendering cannot write to the backend, cannot use a second renderer contract, and malformed individual cards remain locally isolated by existing renderer fallbacks.

### Phase 8 review hardening

All draft-sensitive navigation is owned by `EditorController`. The store remains the persisted-state and WebSocket persistence path, but application handlers route dashboard switching, active-dashboard deletion, edit entry, and mode changes through controller methods that run the injectable unsaved-change guard before delegating to store operations. Entering Edit is idempotent: if a draft already exists, the controller keeps that draft and only ensures Edit mode is active.

Editor hierarchy commands now validate parent existence before creating child nodes, collision-check explicit ids and generated ids against the aggregate, and fail before cloning/mutating when a command would create an orphan. Debug JSON also performs minimal structural draft checks before replacing the current draft: root object shape, collection arrays, usable unique ids, valid references, no duplicate references/orphans, and object-only Card config. These checks protect local draft coherence while leaving domain/business validation authoritative on the backend.

Editor saves expose `editor.saving`, reject duplicate concurrent saves, leave dirty draft data intact during the backend call, and clear dirty/editor state only after a successful backend response. Failed saves reset `editor.saving`, preserve the draft, and display the backend error separately from local draft validation.

### Phase 8 form and confirmation completion

At the application boundary, the default unsaved-change adapter asks the user before discarding dirty drafts and fails closed when no browser confirmation API is available. Command and editor-state modules remain free of `window.confirm`; production wiring injects the confirmation policy into `EditorController`.

The structured editor now renders separated Dashboard, View, Section, and Card forms. Selected View and Section forms edit title and description; the generic Card form edits title, opaque type, and formatted JSON-object config. Invalid Card config syntax, `null`, arrays, or primitives are field-level local validation errors and do not replace the previous valid draft config.

Debug JSON structural validation enforces single-parent ownership in addition to prior integrity checks: a Section may be referenced by exactly one View, and a Card may be referenced by exactly one Section.

### Phase 8 editor interaction stability

Editable controls carry stable semantic `data-editor-field` identifiers such as `dashboard.title`, `view:<id>:title`, `section:<id>:title`, and `card:<id>:config`. The visual editor captures the active field and selection before rerendering the draft-driven editor panel and restores focus, caret, and selection to the matching field after render. This preserves continuous typing while still updating `draftDashboard` and preview state on each valid field update.

Invalid Card config edits are kept as editor-local field text keyed by `card:<id>:config`. They remain visible across rerenders and do not replace the previous valid `draftDashboard.cards[].config` until the JSON parses to an object.
