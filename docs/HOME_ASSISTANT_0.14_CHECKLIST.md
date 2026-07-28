# Home Assistant authenticated verification — 0.14.0

The PR must remain a draft until every item below has evidence attached. CI is
necessary but is not release approval.

- [ ] Open **Editor → Runtime**, capture manifest/module/schema/asset hash/build commit, and verify it matches the PR artifact.
- [ ] Capture Energy → Flows, Loads and Report; confirm Loads and Report differ and Report has no full load form.
- [ ] Capture Cameras and persist a change with **Salva sezione**; confirm the card updates without navigation/reload.
- [ ] Capture Appliances showing the migrated Lavatrice and its original `lavatrice` visual.
- [ ] Populate the real `dm.ev_*` editor mappings; confirm EV navbar visibility and hidden-section banner update immediately.
- [ ] Populate real `dm.energy_*` mappings; confirm Energy visibility updates immediately.
- [ ] Save and rerender twenty times; confirm every entity input retains exactly one picker.
- [ ] Add three lights consecutively and delete one; confirm immediate DOM updates.
- [ ] Search the Rooms icon catalog and attach the result screenshot.
- [ ] Confirm Pool/Irrigation contain no escaped JSON fragments.
- [ ] Attach desktop/mobile Editor screenshots.
- [ ] Attach browser console output with no errors and Network output with no 404s.
- [ ] Compare the public desktop/mobile baseline; navbar, header, typography, colors, and layout must be unchanged.
