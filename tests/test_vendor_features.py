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
        assert "room_id:roomSel" in html, name
        assert "getElementById('ed-cl-room')" in html, name
        assert "getElementById('ed-cam-room')" in html, name
        # The static climate/camera forms use a plain <select> populated by the
        # editor hook; inline concat there would render as literal text. Inline
        # concat inside JS render functions (rooms, tapparelle) is fine.
        assert "ed-cl-room\">'+cdRoomOptions" not in html, name
        assert "ed-cam-room\">'+cdRoomOptions" not in html, name
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
        assert "0.13.2" in html, name
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
        # The auto-detection lives inside the Impostazioni tab now.
        assert "function editorRenderRileva()" in html, name
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
        # The settings tab is first; Rileva and Sezioni tabs are gone —
        # autodetect+reset live inside Impostazioni, sections have own tabs.
        assert "⚙️ Impostazioni" in html, name
        assert 'data-tab="rileva"' not in html, name
        assert 'data-tab="sezioni"' not in html, name
        assert 'data-tab="sez0"' in html and 'data-tab="sez9"' in html, name
        assert "function edFilterSez(" in html, name
        assert "Rilevamento e manutenzione" in html, name
        # Bugfix guards: sync loop-guard, hosted update-check, version bump.
        assert "cd_sync_rl2" in html, name
        assert "0.13.2" in html and "0.11.1-int" not in html, name
        # Tapparelle: open/close-all buttons and open-shutter alerts.
        assert "Apri tutte" in html and "Chiudi tutte" in html, name
        assert "tapp-avvisi" in html, name
        # Round 18 field fixes: Impostazioni button restored, update-check
        # path guard, live EV capture with same-name update and edit
        # dropdown, hidden Home quick-action slots, per-tab saves, and the
        # energy-cost block relocated to the Energia tab.
        assert 'data-tab="visib" onclick="editorSwitch(\'visib\')">' in html, name
        assert "location.pathname.indexOf('/dashboardmodern_static')" in html, name
        assert "cars[found]={ name:n" in html, name
        assert "function cdEvCarSelEd(" in html, name
        assert "dm.home_interruttore_antifurto" in html, name
        assert "function edSecSave()" in html, name
        assert "function edCostSplit(" in html, name
        assert "edCostSplit(body,'hide')" in html, name
        # Round 19: appliance save, tapparelle alert group, cams in security,
        # navbar ordering from Impostazioni.
        assert "editorRenderAppliances() + '<button" in html, name
        assert 'value="tapp">🪟 Tapparelle (cover)' in html, name
        assert "grp === 'tapp'" in html, name
        assert "alsoN=(n===4)?10:-1" in html, name
        assert 'data-tab="sez10"' not in html, name
        assert "function cdApplyNavOrder()" in html, name
        assert "function cdNavOrderHtml()" in html, name
        assert "'cd_navbar_order','cd_floors'" in html, name
        # Every entity field uses the magnifier picker, no native datalist.
        assert 'list="ed-entity-list"' not in html, name
        assert "ref.nodeType === 1" in html, name
        # Clima cards are grouped by floor -> room via the shared helper.
        assert "function cdGroupCards(" in html, name
        assert "cdGroupCards(uFreddo, card)" in html, name
        assert "cdGroupCards(uCaldo, card)" in html, name
        # Temperature cards share the clima cp-card structure, ids intact.
        assert "temp-card tc2" not in html, name
        assert 'class="cp-badge temp-comfort-badge" id="tc_${tid}"' in html, name
        assert 'id="tv_${tid}"' in html, name
        assert 'id="hv_${hid}"' in html, name
        # Lights popup gains a floor level; appliances group with indexes kept.
        assert "_fi(cdRoomFloorOf(a)) - _fi(cdRoomFloorOf(b))" in html, name
        assert "cdGroupCards(list.map((a,_ai)=>" in html, name
        assert "const i=a._idx;" in html, name
        # Appliances can be assigned a room from the editor, persisted.
        assert 'id="appl-room"' in html, name
        assert "if(_rm) item.room_id=_rm;" in html, name
        # The lights room list offers registry rooms so floors resolve.
        assert "!set.includes(r.name)) set.push(r.name)" in html, name
        # Appliances with an energy sensor auto-populate the Report.
        assert "function cdApplReportEntries(" in html, name
        assert ".concat(cdApplReportEntries(" in html, name
        # The Tapparelle section: page, navbar, runtime, editor, sync.
        assert 'id="page-tapparelle"' in html, name
        assert 'id="tab-tapparelle"' in html, name
        assert "function renderTapparelle()" in html, name
        assert "function editorRenderTapparelle()" in html, name
        assert ".tapp-shutter" in html, name
        # Irrigazione: page, navbar, runtime with rain-aware scheduler,
        # editor, and sync (which also carries the tapparelle/floors keys).
        assert 'id="page-irrigazione"' in html, name
        assert 'id="tab-irrigazione"' in html, name
        assert "function renderIrrigazione()" in html, name
        assert "function editorRenderIrrigazione()" in html, name
        assert "cd_irr_lastrun" in html, name
        assert ".irr-drops" in html, name
        # Piscina: page, navbar, temp-based auto filtration, editor, sync.
        assert 'id="page-piscina"' in html, name
        assert 'id="tab-piscina"' in html, name
        assert "function renderPiscina()" in html, name
        assert "function editorRenderPiscina()" in html, name
        assert "cdPoolTargetHours" in html, name
        assert "cd_pool_lastrun" in html, name
        # Multiple EV cars: profiles, page dropdown, editor manager, sync.
        assert 'id="ev-car-picker"' in html, name
        assert "function cdEvApplyCar(" in html, name
        assert "function cdEvCarsHtml()" in html, name
        # EV cars and Energia views render inside their own tabs now.
        assert "extra+=cdEvCarsHtml()" in html, name
        assert "renderSettings: (settings)" in (
            VENDORED / "modules-entry.js"
        ).read_text(encoding="utf-8")
        # Energia: per-view toggles and a flow that degrades without PV.
        assert "function cdApplyEnergyViews()" in html, name
        assert "function cdApplyFlowMinimal()" in html, name
        assert "function cdEnViewsHtml()" in html, name
        assert "'cd_ev_cars','cd_energy_views','cd_navbar_order'" in html, name
        # Multi-plancia: the sync key gains an instance suffix for secondary
        # panels; the primary keeps the historical key.
        assert html.count("__DASHBOARDMODERN_PRIMARY__ === false") == 4, name
        # Round 21: registry-driven autodetect and hidden-by-default sections.
        assert "function cdRegEnrich(" in html, name
        assert "config/floor_registry/list" in html, name
        assert "function cdSecShow(" in html, name
        # Navbar engine v3: no boot flag (reset-proof), all sections in the
        # map, toggles on every section tab. Behavior is covered by the node
        # tests in navbar-visibility.test.js against the vendored file.
        assert "cd_sections_boot" not in html, name
        assert "function cdSecBoot()" in html, name
        assert "function cdNavVisMap()" in html, name
        assert "'appliances-main'" in html or "appliances-main" in html, name
        assert "cdSecToggleHtml('tapparelle')" in html, name
        assert "cdSecToggleHtml('irrigazione')" in html, name
        assert "cdSecToggleHtml('piscina')" in html, name
        assert "cdSecToggleHtml('appliances')" in html, name
        assert "cdSecShowByRef(ref)" in html, name
        assert "cdRegEnrich(function(){" in html, name
        # The Rileva tab carries a diagnostic status line.
        assert "function cdDbgStatus()" in html, name
        # The user_data sync key is namespaced when hosted.
        assert "dashboardmodern_integration_config" in html, name
        assert "key: 'dashboard_modern_config'" not in html, name
        # Temperature rows have no delete button; rooms live in the Rooms tab.
        assert "edDelStanza(${i})" not in html, name
