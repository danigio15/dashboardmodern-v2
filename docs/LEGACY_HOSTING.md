# Hosting the legacy dashboard inside the integration

## Goal

Users install one integration and get the dashboard. They never download an HTML
file, never paste a long-lived token, never edit `configuration.yaml`, and never
add an iframe panel by hand. Updates arrive through the integration like any
other HACS integration update.

The legacy dashboard stays useful the whole time. Sections move to native
DashboardModern modules one at a time, and when the last one lands the vendored
file is deleted.

## How the pieces fit

```
HACS installs the integration
  └─ custom_components/dashboardmodern/
       ├─ frontend.py                 registers the panel + versioned static mount
       ├─ frontend/panel.js           the custom panel element (gets `hass`)
       ├─ frontend/src/legacy/host.js mounts the hosted dashboard, publishes the session
       └─ frontend/legacy/            vendored dashboard.html + bridge-prelude.js
```

Both documents are served by Home Assistant, so they are same-origin. That is
the whole trick: the panel can hand the hosted dashboard an already-authenticated
session, and the hosted dashboard's existing bootstrap picks it up unchanged.

## The auth bridge

The legacy dashboard resolves its connection from `localStorage.cd_connection`
via `cdCfg()`, then authenticates its own WebSocket with that token. It does not
need to know where the token came from.

1. `host.js` publishes `window.__DASHBOARDMODERN_BRIDGE__ = { token, host }` on
   the frontend window, reading the token from `hass.auth`.
2. `bridge-prelude.js` runs as the hosted document's first script, reads
   `window.parent.__DASHBOARDMODERN_BRIDGE__`, and writes `cd_connection`.
3. The legacy bootstrap proceeds exactly as it always has.

Two consequences worth stating plainly. The setup wizard's connection step
disappears, because there is nothing left for the user to enter. And no token is
ever stored in a file or typed into a form, which removes the class of accident
that put a long-lived token into a shared file once already.

Home Assistant rotates frontend access tokens. `host.update(hass)` republishes
the new one, and the single patched line in `connect()` reads the live bridge
value instead of the constant captured at parse time, so a reconnect after
rotation succeeds without a reload.

Standalone use is unaffected. With no bridge present the prelude is a no-op and
the wizard runs as before, so the legacy repo keeps working for existing users.

## Vendoring

`scripts/vendor_legacy.py --ref vX.Y.Z` clones the pinned tag from
`danigio15/dashboardmodern`, applies exactly two patches, and writes
`VENDOR.json` recording the ref, commit and upstream sha256.

The patches total 194 characters against ~899,000: one `<script>` tag in
`<head>`, and one line in `connect()`. Both use anchors that must match exactly
once; if upstream changes, vendoring fails loudly rather than silently producing
a broken dashboard. The legacy repository stays the source of truth and needs no
changes.

Vendored files are committed so HACS ships them.

## Cache correctness

`_frontend_asset_version()` hashes the content of every shipped `.js`, `.css`,
`.json` and `.html` asset, and the static mount is versioned with that digest.
Vendoring a new dashboard changes the digest, which changes the URL, which means
users get the update on next load. No hard refresh, no incognito, no version
bump required — which removes the recurring "the screenshot shows the old file"
problem.

## Migration path

The host is deliberately ignorant of the hosted dashboard's internals, so moving
a section to a native module never touches `host.js`.

Per section: build the native module, add a navigation entry for it beside
the hosted view, and let both exist. Users see the native section appear; the
legacy one stays until the native one is at parity. When the last section lands,
delete `frontend/legacy/`, `scripts/vendor_legacy.py`, and this document.

Configuration is the one piece that needs deliberate work. The legacy dashboard
keeps ~133 `localStorage` keys. The subset that is dashboard content (see
`CONFIG_KEYS` in `src/sections/config-persistence-section.js`) is synchronized
through the integration's own shared store — `config_store.py`, exposed as
`dashboardmodern/config/{get,set,restore}` — which replaced the per-user
`frontend/set_user_data` copy earlier releases used. One installation therefore
has one configuration, shared by every user and device, keyed by a profile name
that does not contain the `entry_id`, so re-adding the integration finds it
again. The per-user copy is still read once, to migrate it.

Two invariants live in the store rather than in the client, because a client that
cannot read cannot be trusted to decide: a snapshot with no configured content
never overwrites a configured plancia unless it is flagged as an explicit reset,
and the last five configured revisions are kept so an installation emptied by an
earlier version repairs itself. Conflicts are resolved on the store's monotonic
revision, never on a device clock.

Native modules read DashboardModern's own storage. A one-way importer that reads
the legacy keys and writes DashboardModern configuration should land before the
first native section replaces a legacy one, so users do not reconfigure anything
twice.

## Status

Implemented and tested: the bridge (`bridge-prelude.js`), the host
(`src/legacy/host.js`), the vendoring script, and `.html` participation in the
asset version.

Not yet done: mounting the host from `panel.js` behind a mode toggle, running
`vendor_legacy.py` to commit the vendored files, and the configuration importer.
