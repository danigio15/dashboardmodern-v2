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
        assert "#ed-st2-floor,#ed-st2-flicon,#ed-st2-icon" in html, name
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
        # Hosted: Configura opens the editor, and REST uses the real token.
        assert "apriConfigEntita : apriSetupWizard" in html, name
        assert "? (window.__DASHBOARDMODERN_REAL_TOKEN__ ||" in html, name
        # The 7-tap setup gesture and its mentions are gone.
        assert "if (false && taps >= 7)" in html, name
        assert "7 tap veloci sul titolo, oppure" not in html, name
        assert "7 quick taps on the title, or" not in html, name
        # The auto-detection lives in the editor as the first tab.
        assert 'data-tab="rileva"' in html, name
        assert "function editorRenderRileva(" in html, name
        assert "function edAutoRileva(" in html, name
        # The Temperatura icon pickers are hidden; icons come from the registry.
        assert "#ed-st2-icon" in html, name
        # Floors are offered as a dropdown of existing floors.
        assert "cdFloorSelOptions" in html, name
        # Floors are managed like rooms: registry rows + add/delete.
        assert "function edFloorAdd(" in html, name
        assert "function edFloorDel(" in html, name
        assert "cdFloorRowsHtml" in html, name
        # Temperature rows are display-only: no pencil, no delete.
        assert "edEditStanza2(${i})" not in html, name
        assert "wzEditStanza(${i})" not in html, name
        # The temp section lists only rooms with a temperature sensor.
        assert "!(r && r.temp) ? '' : " in html, name
        # The navbar tab is labelled Temperatura/Temperature, not Stanze/Rooms.
        assert '<span class="text">Stanze</span>' not in html, name
        assert '<span class="text">Rooms</span>' not in html, name
        # The hamburger keeps its original behavior (HA sidebar in kiosk).
        assert "if (window.parent === window) { cdOpenAppMenu(); return; }" in html, (
            name
        )
        # A full reset lives in the Rileva tab and never reopens the wizard.
        assert 'onclick="wzResetAll()"' in html, name
        # The empty-state banner re-checks after connection.
        assert "setTimeout(cdEmptyStateCheck, 1200)" in html, name
        # The wizard is gone from the Config page and the app menu.
        assert "<!-- Setup Wizard -->" not in html, name
        assert "Riconfigura (wizard)" not in html, name
        assert "Reconfigure (wizard)" not in html, name
        # General settings (name, subtitle, admin) live in the editor.
        assert "function edSaveGeneral()" in html, name
        assert "return cdGenHtml()+" in html, name
        # The settings tab is first and labelled Impostazioni.
        assert html.find('data-tab="visib"') < html.find('data-tab="rileva"'), name
        assert "⚙️ Impostazioni" in html, name
        # Every entity field uses the magnifier picker, no native datalist.
        assert 'list="ed-entity-list"' not in html, name
        assert "ref.nodeType === 1" in html, name
        # The Rileva tab carries a diagnostic status line.
        assert "function cdDbgStatus()" in html, name
        # The user_data sync key is namespaced when hosted.
        assert "dashboardmodern_integration_config" in html, name
        assert "key: 'dashboard_modern_config'" not in html, name
        # Temperature rows have no delete button; rooms live in the Rooms tab.
        assert "edDelStanza(${i})" not in html, name
