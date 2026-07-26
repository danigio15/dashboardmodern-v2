# DashboardModern v2

A Home Assistant custom integration that provides the DashboardModern panel.

Install it, restart, add the integration, and the dashboard is in your sidebar.
There is no HTML file to download and place, no iframe panel to configure, and
no long-lived token to create: the panel hands the dashboard an
already-authenticated Home Assistant session.

## Install with HACS

1. Open **HACS** → three-dot menu → **Custom repositories**.
2. Add `https://github.com/danigio15/dashboardmodern-v2` with category
   **Integration**.
3. Open **DashboardModern v2** and choose **Download**.
4. **Restart Home Assistant.** Custom integrations load at startup.
5. Go to **Settings → Devices & services → Add integration** and search for
   **DashboardModern v2**.

**DashboardModern** then appears in the sidebar.

Let HACS own `custom_components/dashboardmodern`. Copying files into it by hand
leaves the directory in a state updates cannot reconcile.

Requires Home Assistant 2025.1.0 or newer. That is the version the test suite
runs against; older releases may work but nothing verifies it.

## What it does

**Finds your entities.** The integration reads the entity, device and area
registries directly and proposes rooms and sections. Suggestions are ranked on
device class, unit of measurement, naming in Italian or English, which device an
entity belongs to and which area it is in — and each suggestion carries the
reasons behind it, so a wrong one can be understood rather than only overridden.
Correct a suggestion and the correction is remembered: it outranks every other
signal the next time, on every device.

Weak matches are withheld rather than guessed. An empty slot you can fill is
better than a confident wrong answer you have to find.

**Shares your configuration.** Everything is stored server-side in Home
Assistant, so it is in your backups and identical on every phone, tablet and
browser profile. Editing from two devices at once is detected and refused
rather than one change silently overwriting the other.

**Reads live state honestly.** Cards bind entities by role. Not configured,
entity missing, unavailable, unknown and stale are all distinguished, and a
missing reading is never drawn as a zero — a dishwasher using no power and a
dishwasher whose sensor dropped off must not look identical.

## Configuration

Rooms are configured once, in one place, and referenced everywhere. Import them
from your Home Assistant areas and adjust: several areas can be one room, and
any entity can be assigned to a room explicitly when Home Assistant places it
somewhere you disagree with.

Reading configuration is available to any Home Assistant user, so everyone in
the house sees the dashboard. Changing it requires an administrator.

## Development

The frontend is plain ES modules with no build step. Both suites must pass
before a pull request; CI runs the same commands:

```bash
python -m pip install -r requirements_test.txt
python -m pytest
ruff check .
ruff format --check .
npm run test:frontend
```

`docs/SECTION_ROADMAP.md` records what each section is built from and what is
still missing. `docs/LEGACY_HOSTING.md` explains how the legacy dashboard is
hosted and how it is being migrated section by section.

## License

MIT.
