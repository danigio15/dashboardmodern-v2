# Contributing to DashboardModern v2

Thank you for contributing to DashboardModern v2. This project is a greenfield Home Assistant custom integration. Contributions should preserve the architectural separation between backend lifecycle, storage, coordinators, services, WebSocket APIs, entities, and frontend rendering.

## Coding Conventions

### General

- Keep changes focused and reviewable.
- Prefer small modules with clear responsibilities.
- Do not mix implementation concerns across layers.
- Add or update tests for behavior changes.
- Update documentation when public behavior changes.

### Python

- Follow modern Home Assistant custom integration patterns.
- Use asynchronous Home Assistant APIs.
- Avoid blocking I/O in the event loop.
- Use type hints for new code.
- Keep config entry lifecycle code thin.
- Keep entities coordinator-backed where possible.
- Do not use global mutable runtime state.
- Do not wrap imports in `try`/`except` blocks.
- Validate external input at API and service boundaries.

### Frontend

- Use plain ES modules for frontend source; the shipped frontend has no build step.
- Keep data access in API or store layers.
- Keep rendering components data-driven.
- Use CSS custom properties for theme integration.
- Preserve keyboard accessibility and responsive behavior.
- Do not couple visual components directly to backend internals.

### Running the tests

Both suites must pass before a pull request is opened; CI runs the same commands.

```bash
python -m pip install -r requirements_test.txt
python -m pytest
ruff check .
ruff format --check .
npm run test:frontend
```

### Documentation

- Keep architectural documents current.
- Document new public services, WebSocket commands, storage fields, and user-facing behavior.
- Add Architecture Decision Records for significant design changes.

## Branch Naming

Use descriptive branch names with one of the following prefixes:

```text
feature/<short-description>
fix/<short-description>
docs/<short-description>
test/<short-description>
refactor/<short-description>
chore/<short-description>
```

Examples:

```text
docs/project-foundation
feature/websocket-bootstrap
fix/storage-migration-error
test/config-flow-coverage
```

These prefixes are enforced by the `branch-creation-policy` repository ruleset:
pushing a branch with any other name is rejected. See
[docs/REPOSITORY_PROTECTION.md](docs/REPOSITORY_PROTECTION.md) for the ruleset
definitions and how they are applied.

## Commit Conventions

Use concise, imperative commit messages.

Preferred format:

```text
<type>: <summary>
```

Accepted types:

- `docs`
- `feat`
- `fix`
- `test`
- `refactor`
- `chore`
- `build`
- `ci`

Examples:

```text
docs: add project foundation documents
feat: add config entry runtime container
fix: validate dashboard card identifiers
test: cover storage schema migrations
```

Commit guidelines:

- Keep commits logically scoped.
- Avoid unrelated changes in the same commit.
- Explain non-obvious design decisions in the commit body.
- Do not commit generated artifacts unless they are required for distribution.

## Licensing of Contributions

This project is proprietary source-available software; see [`LICENSE`](LICENSE).
Forking the repository is permitted only as the technical step needed to open a
pull request, and the fork should be deleted once the pull request is merged or
closed. Publishing a fork as an independent copy of the project is not allowed.

By submitting a pull request you grant the owner a perpetual, worldwide,
irrevocable, royalty-free and sublicensable license to use, modify, publish and
distribute your contribution as part of the project, under the project license
or any other license the owner chooses, and you confirm that you have the right
to grant it.

## Pull Request Requirements

Every pull request should include:

- A clear title.
- A summary of changes.
- Testing performed.
- Documentation updates, when applicable.
- Screenshots for visible frontend changes.
- Notes about breaking changes, migrations, or compatibility impacts.

Pull requests should not:

- Mix unrelated backend and frontend rewrites.
- Introduce public API changes without documentation.
- Introduce storage schema changes without migration tests.
- Add new architectural patterns without an ADR.

## Testing Requirements

Before opening a pull request, run the relevant checks for the changed area.

Recommended backend checks:

```text
ruff check custom_components tests
ruff format --check custom_components tests
mypy custom_components/dashboardmodern
pytest tests
```

Recommended frontend checks:

```text
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Testing expectations:

- Config flow changes require config flow tests.
- Storage changes require migration and validation tests.
- WebSocket command changes require contract tests.
- Service changes require schema and behavior tests.
- Entity changes require unique ID, availability, and state tests.
- Frontend UI changes require component tests or screenshots when practical.

## Documentation Requirements

Documentation must be updated when a change affects:

- Installation.
- Configuration.
- Services.
- WebSocket commands.
- Storage schema.
- Frontend behavior.
- User-visible dashboard behavior.
- Architecture or extension points.

Significant design choices should be recorded in `DECISIONS.md` as Architecture Decision Records.
