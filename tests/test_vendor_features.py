"""The room-registry feature must survive every re-vendoring."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

_spec = importlib.util.spec_from_file_location(
    "vendor_legacy", SCRIPTS / "vendor_legacy.py"
)
assert _spec and _spec.loader
vendor_legacy = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vendor_legacy)

VENDORED = Path(__file__).resolve().parents[1] / (
    "custom_components/dashboardmodern/frontend/legacy"
)


def test_the_room_field_is_present_in_every_section_and_language() -> None:
    """Appliances, climate and cameras all gain the same room dropdown."""
    for name in vendor_legacy.VARIANTS:
        html = (VENDORED / name).read_text(encoding="utf-8")
        assert "function cdRoomOptions(" in html, name
        # The same registry-backed dropdown appears in every section.
        for field in ('id="appl-room"', 'id="ed-cl-room"', 'id="ed-cam-room"'):
            assert field in html, f"{name} missing {field}"
        # And each persists the chosen room.
        assert "room:roomSel" in html, name
        assert "getElementById('ed-cl-room')" in html, name
        assert "getElementById('ed-cam-room')" in html, name


def test_the_room_helper_reads_the_existing_registry() -> None:
    """Rooms come from cd_stanze, not a new parallel store."""
    from vendor_features import ROOM_HELPER_REPLACEMENT

    assert "cdCfg('cd_stanze')" in ROOM_HELPER_REPLACEMENT
    # The helper is reusable, so lights/climate/cameras can call the same thing.
    assert "function cdRoomOptions(" in ROOM_HELPER_REPLACEMENT
    assert "function cdRoomOf(" in ROOM_HELPER_REPLACEMENT
