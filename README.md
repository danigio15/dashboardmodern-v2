# DashboardModern v2

Home Assistant custom integration that installs and exposes the original **Dashboard Modern** interface as a native sidebar panel.

The production panel now uses the real Italian dashboard from [`danigio15/dashboardmodern`](https://github.com/danigio15/dashboardmodern), rather than the temporary generic renderer/editor prototype.

## Install and update with HACS

1. Open **HACS** in Home Assistant.
2. Open the three-dot menu and select **Custom repositories**.
3. Add `https://github.com/danigio15/dashboardmodern-v2`.
4. Select **Integration**.
5. Download **DashboardModern v2**.
6. Restart Home Assistant.
7. Go to **Settings → Devices & services → Add integration** and add **DashboardModern v2**.

After installation, HACS owns `custom_components/dashboardmodern`. Do not mix HACS updates with manual copies in that directory.

## What version 0.2.0 changes

- The Home Assistant sidebar panel loads the original `dashboard.html` design and runtime.
- The original dashboard is served from the integration's versioned static directory, so HACS updates invalidate the complete frontend cache.
- The page runs on the same Home Assistant origin. Existing `cd_*` localStorage configuration from the legacy `/local/...` dashboard therefore remains available in the same browser/profile.
- Cameras, fullscreen mode, external chart libraries, the original wizard, editor, auto-detection and all existing dashboard sections remain part of the original runtime.
- The panel exposes a same-origin `__DASHBOARDMODERN_HOST__` bridge containing the current authenticated Home Assistant frontend object for the gradual migration away from the legacy token/WebSocket layer.

The experimental v2 dashboard aggregate, WebSocket API and persistence code remain in the repository for later migration work, but they are no longer the default user interface.

## Source synchronization

The vendored runtime is stored under:

```text
custom_components/dashboardmodern/frontend/legacy/
```

`.github/workflows/sync-original-dashboard.yml` copies the root runtime files from the original repository and records the exact source commit in `SOURCE.md`. This keeps the visual dashboard source auditable while allowing the integration to be installed and updated entirely through HACS.

## Development checks

Frontend tests:

```bash
npm run test:frontend
```

Home Assistant validation is performed by the repository's hassfest and HACS workflows.
