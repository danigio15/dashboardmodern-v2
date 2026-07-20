"""Shared test configuration."""

from __future__ import annotations

import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class _ConfigEntry:
    """Minimal ConfigEntry test double for package imports."""

    def __class_getitem__(cls, item: object) -> type[_ConfigEntry]:
        """Support Home Assistant's generic ConfigEntry type annotation."""
        return cls


class _HomeAssistant:
    """Minimal HomeAssistant test double for package imports."""


homeassistant = types.ModuleType("homeassistant")
config_entries = types.ModuleType("homeassistant.config_entries")
core = types.ModuleType("homeassistant.core")
config_entries.ConfigEntry = _ConfigEntry
core.HomeAssistant = _HomeAssistant
sys.modules.setdefault("homeassistant", homeassistant)
sys.modules.setdefault("homeassistant.config_entries", config_entries)
sys.modules.setdefault("homeassistant.core", core)
