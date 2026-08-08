"""Setup/unload lifecycle for the HTML-serving integration."""

from __future__ import annotations

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern import async_setup_entry, async_unload_entry
from custom_components.dashboardmodern.const import DOMAIN


@pytest.mark.asyncio
async def test_setup_registers_the_frontend(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Setup registers the panel that serves the HTML dashboard."""
    registered: list[str] = []

    async def fake_register(_hass: HomeAssistant, entry_id: str) -> None:
        registered.append(entry_id)

    import custom_components.dashboardmodern.frontend as frontend_module

    monkeypatch.setattr(frontend_module, "async_register_frontend", fake_register)

    entry = MockConfigEntry(domain=DOMAIN, entry_id="entry-1")
    entry.add_to_hass(hass)

    assert await async_setup_entry(hass, entry) is True
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
    ) -> None:
        captured["admin_only"] = bool(entry.options.get(OPTION_ADMIN_ONLY, False))

    monkeypatch.setattr(frontend_module, "_register_or_update_panel", fake_register)
    monkeypatch.setattr(frontend_module, "_ensure_static_registered", _async_noop)

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
