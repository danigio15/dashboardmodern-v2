# Architecture Decision Records

This file records major architectural decisions for DashboardModern v2.

## ADR-0001: Complete Rewrite Instead of Migration

### Status

Accepted

### Context

DashboardModern v2 is intended to be a complete redesign. The previous project exists only as a functional reference for the desired final user experience and graphical dashboard. Reusing the previous architecture would risk preserving constraints that may no longer fit modern Home Assistant development practices.

### Decision

DashboardModern v2 will be implemented as a complete rewrite rather than a migration or refactor of the previous project.

### Consequences

- The implementation can follow current Home Assistant best practices from the beginning.
- Architecture can be optimized for long-term maintainability.
- No previous internal implementation details are assumed.
- Functional parity must be intentionally reintroduced through product requirements and tests.

## ADR-0002: Per-Entry Runtime Container

### Status

Accepted

### Context

Home Assistant integrations can have multiple config entries. Shared global mutable state makes unload, reload, testing, and multi-entry behavior harder to reason about.

### Decision

Each config entry will have a dedicated runtime container stored under the integration domain data registry.

### Consequences

- Runtime dependencies are grouped in one predictable location.
- Unload and reload can clean up entry-specific state deterministically.
- Tests can instantiate isolated runtime contexts.
- Services and WebSocket handlers can resolve dependencies by config entry.

## ADR-0003: Storage Abstraction

### Status

Accepted

### Context

DashboardModern needs to persist layout and preference data. Direct storage access spread across modules would make validation, migration, debouncing, and error handling inconsistent.

### Decision

All integration-owned persistent dashboard data will be accessed through a storage abstraction.

### Consequences

- Storage schema changes are centralized.
- Validation and migration behavior is consistent.
- High-frequency frontend edits can be debounced safely.
- Other layers do not need to know storage implementation details.

## ADR-0004: Coordinator Architecture

### Status

Accepted

### Context

DashboardModern needs derived state from Home Assistant registries, entity states, storage data, and runtime health. Recomputing this independently for entities, services, and WebSocket requests would be inefficient and error-prone.

### Decision

DashboardModern will use coordinator-style architecture for shared refreshes and derived summaries.

### Consequences

- Entities can consume shared coordinator state.
- Expensive computations can be batched and debounced.
- Runtime health and summaries have a consistent source.
- Frontend subscriptions can receive updates from the same derived data model.

## ADR-0005: WebSocket-First Communication

### Status

Accepted

### Context

The dashboard frontend needs structured, low-latency communication with the backend. It also needs live updates for dashboard configuration, runtime health, and summarized data.

### Decision

Dashboard-specific frontend/backend communication will be WebSocket-first. Native Home Assistant services remain the preferred path for controlling Home Assistant entities.

### Consequences

- The frontend can bootstrap and subscribe through a single communication model.
- Backend commands can enforce validation and permissions.
- Multi-client dashboard updates can be synchronized.
- API contracts must be versioned and tested.

## ADR-0006: Frontend and Backend Separation

### Status

Accepted

### Context

A dashboard integration has two distinct concerns: Home Assistant backend orchestration and frontend user experience. Mixing these concerns would make the project harder to test and evolve.

### Decision

The backend and frontend will be developed as separate layers with a versioned contract between them.

### Consequences

- The frontend can evolve visual components without changing backend storage internals.
- The backend can evolve coordinators and storage without forcing UI rewrites.
- Contract tests become important.
- Shared assumptions must be documented explicitly.

## ADR-0007: Typed Models

### Status

Accepted

### Context

Dashboard configuration, WebSocket responses, storage documents, and derived summaries are complex enough that untyped dictionaries would increase maintenance risk.

### Decision

DashboardModern will use typed internal models and typed API contracts.

### Consequences

- Refactoring is safer.
- Validation boundaries are clearer.
- Frontend and backend contracts are easier to document and test.
- Contributors can understand expected data shapes more easily.

## ADR-0008: Versioned Storage

### Status

Accepted

### Context

Dashboard layout and preference data must survive upgrades. Without versioning, future schema changes would risk data loss or incompatible runtime behavior.

### Decision

DashboardModern storage documents will include explicit version metadata and migration routines.

### Consequences

- Storage migrations can be tested independently.
- Upgrade behavior is predictable.
- Failed migrations can produce repair issues.
- Future schema evolution can happen without abandoning existing user dashboards.
