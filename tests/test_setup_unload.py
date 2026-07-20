"""Lightweight unit tests for DashboardModern setup and unload.

These tests intentionally use minimal Home Assistant test doubles because the
Phase 1 repository does not yet depend on pytest-homeassistant-custom-component.
They verify only the local runtime bookkeeping performed by the integration
lifecycle functions.
"""

from __future__ import annotations

import asyncio
import importlib
import sys
import types
from pathlib import Path

import pytest


class _HomeAssistant:
    """Minimal HomeAssistant test double."""

    def __init__(self) -> None:
        """Initialize Home Assistant state."""
        self.data: dict[str, dict[str, object]] = {}


class _ConfigEntry:
    """Minimal ConfigEntry test double."""

    def __init__(self, entry_id: str) -> None:
        """Initialize the entry double."""
        self.entry_id = entry_id
        self.runtime_data: object | None = None

    def __class_getitem__(cls, item: object) -> type[_ConfigEntry]:
        """Support Home Assistant's generic ConfigEntry type annotation."""
        return cls


@pytest.fixture
def integration_module(monkeypatch: pytest.MonkeyPatch) -> types.ModuleType:
    """Import the integration with scoped Home Assistant test doubles."""
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1]))

    homeassistant = types.ModuleType("homeassistant")
    config_entries = types.ModuleType("homeassistant.config_entries")
    core = types.ModuleType("homeassistant.core")

    config_entries.ConfigEntry = _ConfigEntry
    core.HomeAssistant = _HomeAssistant

    monkeypatch.setitem(sys.modules, "homeassistant", homeassistant)
    monkeypatch.setitem(sys.modules, "homeassistant.config_entries", config_entries)
    monkeypatch.setitem(sys.modules, "homeassistant.core", core)

    for module_name in list(sys.modules):
        if module_name.startswith("custom_components.dashboardmodern"):
            monkeypatch.delitem(sys.modules, module_name, raising=False)

    return importlib.import_module("custom_components.dashboardmodern")


def test_config_entry_setup_stores_runtime(
    integration_module: types.ModuleType,
) -> None:
    """Set up a config entry and store runtime data consistently."""
    hass = _HomeAssistant()
    entry = _ConfigEntry("test-entry")

    assert asyncio.run(integration_module.async_setup_entry(hass, entry)) is True

    runtime = entry.runtime_data
    assert runtime is not None
    assert hass.data[integration_module.DOMAIN][entry.entry_id] is runtime
    assert runtime.hass is hass
    assert runtime.entry_id == entry.entry_id


def test_config_entry_unload_clears_runtime(
    integration_module: types.ModuleType,
) -> None:
    """Unload a config entry and clear runtime data consistently."""
    hass = _HomeAssistant()
    entry = _ConfigEntry("test-entry")

    assert asyncio.run(integration_module.async_setup_entry(hass, entry)) is True
    assert asyncio.run(integration_module.async_unload_entry(hass, entry)) is True

    assert entry.runtime_data is None
    assert integration_module.DOMAIN not in hass.data
