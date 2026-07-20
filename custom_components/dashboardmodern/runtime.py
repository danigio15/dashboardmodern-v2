"""Runtime container for DashboardModern config entries."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

from homeassistant.core import CALLBACK_TYPE, HomeAssistant

from .coordinator import DashboardModernCoordinator
from .models import RuntimeOptions
from .storage import DashboardModernStorage


@dataclass(slots=True)
class DashboardModernRuntime:
    """Per-entry runtime container for DashboardModern."""

    hass: HomeAssistant
    entry_id: str
    storage: DashboardModernStorage
    coordinator: DashboardModernCoordinator
    options: RuntimeOptions = field(default_factory=RuntimeOptions)
    _unsubscribers: list[CALLBACK_TYPE] = field(default_factory=list)

    def add_unsubscriber(self, unsubscribe: Callable[[], None]) -> None:
        """Register a callback to execute during unload."""
        self._unsubscribers.append(unsubscribe)

    async def async_setup(self) -> None:
        """Set up runtime-owned resources."""
        await self.storage.async_setup()
        await self.coordinator.async_setup()

    async def async_unload(self) -> None:
        """Unload runtime-owned resources."""
        while self._unsubscribers:
            self._unsubscribers.pop()()
        await self.coordinator.async_unload()
        await self.storage.async_unload()


def create_runtime(hass: HomeAssistant, entry_id: str) -> DashboardModernRuntime:
    """Create a runtime container for a config entry."""
    return DashboardModernRuntime(
        hass=hass,
        entry_id=entry_id,
        storage=DashboardModernStorage(hass, entry_id),
        coordinator=DashboardModernCoordinator(hass, entry_id),
    )
