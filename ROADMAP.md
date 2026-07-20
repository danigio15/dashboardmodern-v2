# DashboardModern v2 Roadmap

This roadmap describes the planned delivery phases for the DashboardModern v2 greenfield Home Assistant custom integration.

## Phase 0: Architecture

### Goals

- Define the integration architecture before implementation.
- Establish backend, frontend, storage, and communication boundaries.
- Document major design decisions.

### Deliverables

- Architecture specification.
- Architecture decision records.
- Initial roadmap.
- Contribution standards.

### Success Criteria

- Architecture is approved before implementation begins.
- No implementation code exists in this phase.
- Core design choices are documented and reviewable.

## Phase 1: Foundation

### Goals

- Create the minimal Home Assistant integration skeleton.
- Establish development tooling and quality gates.
- Prepare the repository for iterative implementation.

### Deliverables

- Integration manifest and package structure.
- Empty platform/lifecycle modules as needed.
- Test framework configuration.
- Linting and formatting configuration.
- Frontend build tooling plan.

### Success Criteria

- The integration can be discovered by Home Assistant.
- Basic setup tests can run.
- Tooling commands are documented.
- No dashboard behavior is implemented yet.

## Phase 2: Core

### Goals

- Implement core backend lifecycle and runtime foundations.
- Add storage abstraction and initial schema.
- Add coordinator foundations.

### Deliverables

- Config entry setup and unload lifecycle.
- Runtime container.
- Storage manager.
- Initial versioned storage schema.
- Initial coordinators.
- Diagnostics baseline.

### Success Criteria

- Config entries can be created, loaded, unloaded, and reloaded.
- Storage can load, save, and migrate versioned documents.
- Coordinators expose predictable runtime data.
- Unit tests cover lifecycle and storage behavior.

## Phase 3: Communication

### Goals

- Establish backend communication surfaces.
- Add service and WebSocket APIs.
- Define stable frontend/backend contracts.

### Deliverables

- WebSocket bootstrap command.
- Dashboard read APIs.
- Mutation API prototypes.
- Service registration.
- Event emission for dashboard changes.
- API contract tests.

### Success Criteria

- Frontend clients can bootstrap dashboard state.
- Mutations are validated and persisted through backend abstractions.
- WebSocket errors are structured and test-covered.
- Services can be used from Home Assistant automations and scripts.

## Phase 4: Frontend Integration

### Goals

- Add the dashboard frontend shell.
- Register a Home Assistant panel.
- Connect frontend state to backend APIs.

### Deliverables

- Frontend build configuration.
- Panel registration.
- Application shell.
- WebSocket API client.
- Initial stores.
- Basic read-only dashboard rendering.

### Success Criteria

- The custom panel loads in Home Assistant.
- The frontend can call the bootstrap API.
- The frontend can render dashboard data without direct backend coupling.
- Build artifacts are reproducible.

## Phase 5: Dashboard Editor

### Goals

- Enable user-driven dashboard customization.
- Support dashboard, view, and card mutations.
- Preserve a polished graphical user experience.

### Deliverables

- Dashboard editor UI.
- View creation, editing, deletion, and ordering.
- Card creation, editing, deletion, and ordering.
- Layout persistence.
- Multi-client update behavior.

### Success Criteria

- Users can customize dashboards through the UI.
- Changes persist across reloads.
- Multiple open dashboard sessions remain consistent.
- Invalid edits are rejected with clear messages.

## Phase 6: Testing

### Goals

- Harden backend, frontend, and integration contracts.
- Add broad automated test coverage.
- Validate accessibility and responsive behavior.

### Deliverables

- Config flow tests.
- Lifecycle tests.
- Storage migration tests.
- Coordinator tests.
- Service tests.
- WebSocket tests.
- Frontend unit and component tests.
- Accessibility checks.

### Success Criteria

- Core behavior is covered by automated tests.
- Storage migrations are tested from every supported version.
- WebSocket contracts are stable and verified.
- Frontend components pass accessibility expectations.

## Phase 7: Optimization

### Goals

- Improve performance for large Home Assistant installations.
- Reduce unnecessary refreshes and renders.
- Tune frontend loading and runtime behavior.

### Deliverables

- Coordinator debouncing and incremental summary updates.
- Frontend lazy loading where appropriate.
- Rendering performance improvements.
- Storage write debouncing.
- Performance diagnostics.

### Success Criteria

- Large entity registries remain responsive.
- High-frequency state changes do not overwhelm the dashboard.
- Initial dashboard load time meets defined performance targets.
- Performance regressions are measurable.

## Phase 8: Stable Release

### Goals

- Prepare the integration for stable public use.
- Finalize documentation and compatibility guarantees.
- Establish release and support processes.

### Deliverables

- Stable release notes.
- User guide.
- Developer guide.
- Troubleshooting guide.
- Compatibility matrix.
- Final quality review.

### Success Criteria

- Installation and configuration are documented.
- Known limitations are documented.
- Public APIs and storage schemas are versioned.
- Stable release criteria are met.
