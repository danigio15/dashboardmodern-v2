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
        for field in (
            'id="appl-room"',
            'id="ed-cl-room"',
            'id="ed-cam-room"',
            'id="ed-lu-room"',
        ):
            assert field in html, f"{name} missing {field}"
        # And each persists the chosen room.
        assert "room:roomSel" in html, name
        assert "getElementById('ed-cl-room')" in html, name
        assert "getElementById('ed-cam-room')" in html, name
        # The static climate/camera forms use a plain <select> populated by the
        # editor hook, never inline JS injected into static HTML (which would
        # render as literal text and break the form).
        assert "cdRoomOptions('')+'</select>" not in html, f"{name} broken inline JS"
        assert "querySelectorAll" in html, name
        # A dedicated Rooms tab manages the registry.
        assert 'data-tab="stanze"' in html, name
        # The temperature section is renamed and its name field is a dropdown.
        assert "🌡️ Temperatura" in html, name
        assert "Stanze (temperature)" not in html, name
        assert "Rooms (temperatures)" not in html, name
        assert '<select id="ed-st2-name"' in html, name
        assert '<input id="ed-st2-name"' not in html, name
        # The token wizard never opens when hosted by the integration.
        assert "!window.__DASHBOARDMODERN_HOSTED__" in html, name
        assert "step: (window.__DASHBOARDMODERN_HOSTED__ ? 2 : 1)" in html, name
        # The build marker proves the served HTML updated.
        assert "0.11.1-int" in html, name
        # The repository logo is used, not the inline SVG mark.
        assert 'src="./logo.png"' in html, name
        # The Piano field is hidden in the temperature section.
        assert "#ed-st2-floor,#ed-st2-flicon{display:none" in html, name
        assert "function editorRenderStanze(" in html, name
        assert "function edStanzaRoomAdd(" in html, name
        # The dedicated Rooms section is registry-only (name + icon); the
        # temperature sensor stays in the separate temperature section.
        assert "ed-room-temp" not in html, name


def test_the_room_helper_reads_the_same_cascade_as_the_temperature_section() -> None:
    """The dropdown must see rooms from config.js too, not only localStorage."""
    from vendor_features import ROOM_HELPER_REPLACEMENT

    # Deferring to getStanze picks up the wizard/localStorage/config.js cascade,
    # which is why the dropdown was empty when rooms lived only in config.js.
    assert "getStanze" in ROOM_HELPER_REPLACEMENT


def test_the_room_helper_reads_the_existing_registry() -> None:
    """Rooms come from cd_stanze, not a new parallel store."""
    from vendor_features import ROOM_HELPER_REPLACEMENT

    assert "cdCfg('cd_stanze')" in ROOM_HELPER_REPLACEMENT
    # The helper is reusable, so lights/climate/cameras can call the same thing.
    assert "function cdRoomOptions(" in ROOM_HELPER_REPLACEMENT
    assert "function cdRoomOf(" in ROOM_HELPER_REPLACEMENT


def test_rooms_management_is_separated_from_temperatures() -> None:
    """The temperature section is renamed; a separate Rooms tab manages rooms."""
    for name in vendor_legacy.VARIANTS:
        html = (VENDORED / name).read_text(encoding="utf-8")
        # The old conflated titles are gone in favour of "Temperatura".
        assert "Stanze (temperature)" not in html, name
        assert "Rooms (temperatures)" not in html, name
        assert "🌡️ Temperatura" in html, name
        # A dedicated Rooms tab exists for managing the registry.
        assert 'data-tab="stanze"' in html, name
        # A Visibility tab toggles whole sections.
        assert 'data-tab="visib"' in html, name
        assert "function editorRenderVisib(" in html, name
        assert "function edVisibToggle(" in html, name
        # The old Hide/Nascondi tab is gone.
        assert 'data-tab="hide"' not in html, name
        # Rooms can be assigned a floor.
        assert 'id="ed-room-floor"' in html, name
