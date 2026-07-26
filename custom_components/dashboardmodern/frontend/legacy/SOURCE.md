# Vendored original dashboard

Source repository: <https://github.com/danigio15/dashboardmodern>

These files are produced by `scripts/vendor_legacy.py`, not copied by hand and
not copied by a workflow. The script applies a small set of anchored patches —
the bridge prelude, the wizard connection step, the bake-download control, and
four confirmed upstream bug fixes — and each one must match exactly once or the
run fails rather than shipping an unverified vendor.

`VENDOR.json` records the upstream commit, the sha256 of each unpatched source
file, and which fixes are still carried locally. That list is how you tell
whether a fix has landed upstream yet.

To update:

```bash
python scripts/vendor_legacy.py --ref <tag>
npm run test:frontend
python -m pytest
```

Do not copy files into this directory by any other route. A copy that skips the
script produces a dashboard with no bridge — it will ask for a long-lived token
— and silently reintroduces the camera configuration data loss.

`config.js` is optional and loaded with an `onerror` fallback; the dashboard
runs without it.
