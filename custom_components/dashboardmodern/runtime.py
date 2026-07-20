"""Runtime container for DashboardModern config entries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .domain import DashboardRegistry
from .persistence import DashboardRepository, HomeAssistantDashboardRepository

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


@dataclass(slots=True)
class DashboardModernRuntime:
    """Minimal per-entry runtime container for DashboardModern."""

    hass: HomeAssistant
    entry_id: str
    repository: DashboardRepository
    dashboards: DashboardRegistry = field(default_factory=DashboardRegistry)


async def async_create_runtime(
    hass: HomeAssistant, entry_id: str
) -> DashboardModernRuntime:
    """Create one runtime repository for the entry and load persisted dashboards."""
    repository = HomeAssistantDashboardRepository(hass, entry_id)
    runtime = DashboardModernRuntime(
        hass=hass,
        entry_id=entry_id,
        repository=repository,
    )
    for dashboard in await repository.async_load_all():
        runtime.dashboards.add(dashboard)
    return runtime
