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
helpers = types.ModuleType("homeassistant.helpers")
storage = types.ModuleType("homeassistant.helpers.storage")
homeassistant.config_entries = config_entries
homeassistant.core = core
homeassistant.helpers = helpers
config_entries.ConfigEntry = _ConfigEntry
core.HomeAssistant = _HomeAssistant


class _Store:
    """Placeholder Store patched by persistence tests."""

    def __init__(self, *args: object, **kwargs: object) -> None:
        """Reject unpatched use."""
        raise RuntimeError("Store must be patched in tests")


storage.Store = _Store
helpers.storage = storage
sys.modules.setdefault("homeassistant", homeassistant)
sys.modules.setdefault("homeassistant.config_entries", config_entries)
sys.modules.setdefault("homeassistant.core", core)
sys.modules.setdefault("homeassistant.helpers", helpers)
sys.modules.setdefault("homeassistant.helpers.storage", storage)


def pytest_pyfunc_call(pyfuncitem: object) -> bool:
    """Run async tests without requiring an external pytest plugin."""
    import asyncio
    import inspect

    test_function = pyfuncitem.obj
    if not inspect.iscoroutinefunction(test_function):
        return False
    funcargs = {
        name: pyfuncitem.funcargs[name] for name in pyfuncitem._fixtureinfo.argnames
    }
    asyncio.run(test_function(**funcargs))
    return True
