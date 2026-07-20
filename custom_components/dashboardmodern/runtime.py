"""Runtime container for DashboardModern config entries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .application import DashboardApplicationService
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
    application: DashboardApplicationService = field(init=False)

    def __post_init__(self) -> None:
        """Create the per-runtime application service."""
        self.application = DashboardApplicationService(self.dashboards, self.repository)


async def async_create_runtime(
    hass: HomeAssistant, entry_id: str
) -> DashboardModernRuntime:
    """Create one runtime repository for the entry and load persisted dashboards."""
    repository = HomeAssistantDashboardRepository(hass, entry_id)
    dashboards = DashboardRegistry()
    for dashboard in await repository.async_load_all():
        dashboards.add(dashboard)
    return DashboardModernRuntime(
        hass=hass,
        entry_id=entry_id,
        repository=repository,
        dashboards=dashboards,
    )
