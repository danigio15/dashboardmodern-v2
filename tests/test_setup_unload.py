"""Setup/unload lifecycle for the HTML-serving integration."""

from __future__ import annotations

import pytest
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
