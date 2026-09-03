"""Setup/unload lifecycle for the HTML-serving integration."""

from __future__ import annotations

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import async_unload_entry
from custom_components.dashboardmodern.const import DOMAIN, OPTION_CHECK_UPDATES


@pytest.mark.asyncio
async def test_setup_registers_the_frontend(
    hass: HomeAssistant,
    enable_custom_integrations: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Setup registers the panel that serves the HTML dashboard.

    L'avvio lo chiede a Home Assistant, non si chiama la funzione a mano: da
    quando c'e' l'avviso di aggiornamento il setup monta una piattaforma, e una
    piattaforma si monta solo su una voce che Home Assistant sta davvero
    avviando. Chiamata a mano, la voce resta «non caricata» e il montaggio
    viene rifiutato — che e' quello che succedeva qui.

    Serve anche `enable_custom_integrations`: nelle prove le integrazioni
    personalizzate non si vedono se non lo si chiede, e senza quello il setup
    non trova se stesso.

    L'avviso di aggiornamento si spegne dalle opzioni: guarda in rete se c'e'
    una versione nuova, e queste due prove parlano del pannello e dello
    schedario, non di lui.
    """
    registered: list[str] = []

    async def fake_register(_hass: HomeAssistant, entry_id: str) -> None:
        registered.append(entry_id)

    import custom_components.dashboardmodern.frontend as frontend_module

    monkeypatch.setattr(frontend_module, "async_register_frontend", fake_register)

    entry = MockConfigEntry(
        domain=DOMAIN, entry_id="entry-1", options={OPTION_CHECK_UPDATES: False}
    )
    entry.add_to_hass(hass)

    assert await hass.config_entries.async_setup(entry.entry_id) is True
    await hass.async_block_till_done()
    assert registered == ["entry-1"]


@pytest.mark.asyncio
async def test_unload_removes_the_frontend(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unload removes this entry's panel registration."""
    removed: list[str] = []

    async def fake_unregister(_hass: HomeAssistant, entry_id: str) -> None:
        removed.append(entry_id)

    import custom_components.dashboardmodern.frontend as frontend_module

    monkeypatch.setattr(
        frontend_module, "async_unregister_frontend_entry", fake_unregister
    )

    entry = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    entry.add_to_hass(hass)

    assert await async_unload_entry(hass, entry) is True
    assert removed == ["entry-1"]


@pytest.mark.asyncio
async def test_admin_only_option_hides_the_panel(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With admin_only set, the panel is registered as admin-only."""
    from custom_components.dashboardmodern import frontend as frontend_module
    from custom_components.dashboardmodern.config_flow import OPTION_ADMIN_ONLY

    captured: dict[str, object] = {}

    def fake_register(
        _hass: object,
        entry: object,
        _url_path: str,
        *,
        update: bool,
        asset_version: str,
        static_url_path: str,
        variants: list[str] | None = None,
    ) -> None:
        captured["admin_only"] = bool(entry.options.get(OPTION_ADMIN_ONLY, False))

    monkeypatch.setattr(frontend_module, "_register_or_update_panel", fake_register)
    monkeypatch.setattr(frontend_module, "_ensure_static_registered", _async_noop)
    monkeypatch.setattr(
        frontend_module, "_ensure_dashboard_card_registered", lambda *_args: None
    )

    entry = MockConfigEntry(
        domain=DOMAIN, entry_id="entry-1", options={OPTION_ADMIN_ONLY: True}
    )
    entry.add_to_hass(hass)

    await frontend_module.async_register_frontend(hass, "entry-1")

    assert captured["admin_only"] is True


async def _async_noop(*_args: object, **_kwargs: object) -> None:
    """No-op async stub."""
    return None


async def test_multiple_plance_have_own_paths(hass: HomeAssistant) -> None:
    """The primary keeps the historic URL; a second plancia gets its own."""
    from custom_components.dashboardmodern import frontend as frontend_module

    primary = MockConfigEntry(
        domain=DOMAIN,
        entry_id="entry-a",
        title="Casa",
        data={"name": "Casa", "primary": True},
    )
    primary.add_to_hass(hass)
    second = MockConfigEntry(
        domain=DOMAIN,
        entry_id="entry-b",
        title="Mare",
        data={"name": "Mare", "primary": False},
    )
    second.add_to_hass(hass)

    taken: set[str] = set()
    p1 = frontend_module._panel_url_path(hass, primary, taken)
    taken.add(p1)
    p2 = frontend_module._panel_url_path(hass, second, taken)

    assert p1 == frontend_module.PANEL_URL_PATH
    assert p2 != p1 and p2.startswith(frontend_module.PANEL_URL_PATH + "-")
    assert "mare" in p2

    cfg = frontend_module._panel_config(hass, second)
    assert cfg["entry_ids"] == ["entry-b"]
    assert cfg["instance_id"] == "entry-b"
    assert cfg["primary"] is False


@pytest.mark.asyncio
async def test_unload_scarica_la_piattaforma_solo_da_chi_l_ha_montata(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """L'erede della primaria non ha mai montato l'avviso di aggiornamento.

    Quando la primaria veniva tolta, l'erede ripartiva scoprendosi primaria e
    allo scarico chiedeva di smontare una piattaforma mai montata: Home
    Assistant rispondeva «Config entry was never loaded!» nel registro.
    """
    import custom_components.dashboardmodern.frontend as frontend_module
    from custom_components.dashboardmodern import DATA_UPDATE_ENTRY

    async def fake_unregister(_hass: HomeAssistant, _entry_id: str) -> None:
        return None

    monkeypatch.setattr(
        frontend_module, "async_unregister_frontend_entry", fake_unregister
    )
    scaricate: list[str] = []

    async def fake_unload(entry: MockConfigEntry, _platforms: list[str]) -> bool:
        scaricate.append(entry.entry_id)
        return True

    monkeypatch.setattr(hass.config_entries, "async_unload_platforms", fake_unload)

    entry = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    entry.add_to_hass(hass)
    # Primaria per identificativo, ma la piattaforma non l'ha montata nessuno.
    assert await async_unload_entry(hass, entry) is True
    assert scaricate == []

    # Chi l'ha montata la scarica, e il segno se ne va con lei.
    hass.data.setdefault(DOMAIN, {})[DATA_UPDATE_ENTRY] = "entry-1"
    assert await async_unload_entry(hass, entry) is True
    assert scaricate == ["entry-1"]
    assert DATA_UPDATE_ENTRY not in hass.data[DOMAIN]


@pytest.mark.asyncio
async def test_le_plance_legacy_si_leggono_fuori_dal_loop(hass: HomeAssistant) -> None:
    """`is_dir` e `glob` sono disco: si leggono nell'executor e si passano giu'."""
    import inspect

    from custom_components.dashboardmodern import frontend as frontend_module

    entry = MockConfigEntry(
        domain=DOMAIN, entry_id="entry-a", title="Casa", data={"primary": True}
    )
    entry.add_to_hass(hass)
    cfg = frontend_module._panel_config(hass, entry, variants=["dashboard.html"])
    assert cfg["legacy_variants"] == ["dashboard.html"]
    sorgente = inspect.getsource(frontend_module)
    assert "variants = await hass.async_add_executor_job(legacy_variants)" in sorgente
