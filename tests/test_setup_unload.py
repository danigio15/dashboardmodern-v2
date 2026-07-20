"""Tests for DashboardModern setup and unload lifecycle."""

from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path


class _HomeAssistant:
    """Minimal HomeAssistant test double."""

    def __init__(self) -> None:
        """Initialize Home Assistant state."""
        self.data: dict[str, object] = {}


class _ConfigEntry:
    """Minimal ConfigEntry test double."""

    def __init__(self, entry_id: str) -> None:
        """Initialize the entry double."""
        self.entry_id = entry_id
        self.runtime_data = None

    def __class_getitem__(cls, item: object) -> type[_ConfigEntry]:
        """Support Home Assistant's generic ConfigEntry type annotation."""
        return cls


def _install_homeassistant_stubs() -> None:
    """Install minimal Home Assistant modules required for lifecycle imports."""
    homeassistant = types.ModuleType("homeassistant")
    config_entries = types.ModuleType("homeassistant.config_entries")
    core = types.ModuleType("homeassistant.core")

    config_entries.ConfigEntry = _ConfigEntry
    core.CALLBACK_TYPE = types.FunctionType
    core.HomeAssistant = _HomeAssistant

    sys.modules.setdefault("homeassistant", homeassistant)
    sys.modules.setdefault("homeassistant.config_entries", config_entries)
    sys.modules.setdefault("homeassistant.core", core)


def test_config_entry_setup_and_unload() -> None:
    """Set up and unload a config entry without leaving domain runtime data."""
    _install_homeassistant_stubs()
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

    from custom_components.dashboardmodern import async_setup_entry, async_unload_entry
    from custom_components.dashboardmodern.const import DOMAIN

    hass = _HomeAssistant()
    entry = _ConfigEntry("test-entry")

    assert asyncio.run(async_setup_entry(hass, entry)) is True
    assert entry.runtime_data is not None
    assert hass.data[DOMAIN][entry.entry_id] is entry.runtime_data

    assert asyncio.run(async_unload_entry(hass, entry)) is True
    assert DOMAIN not in hass.data
