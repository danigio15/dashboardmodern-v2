"""Shared test helpers for DashboardModern tests."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from custom_components.dashboardmodern.domain import Card, Dashboard, Section, View


@dataclass(slots=True)
class MemoryStorageBackend:
    """Focused in-memory storage backend for repository unit tests."""

    data: object | None = None
    saves: list[object] = field(default_factory=list)

    async def async_load(self) -> object | None:
        """Load raw stored data."""
        await asyncio.sleep(0)
        return self.data

    async def async_save(self, data: object) -> None:
        """Save raw stored data."""
        await asyncio.sleep(0)
        self.data = data
        self.saves.append(data)


class HomeAssistantHarness:
    """Small hass object for lifecycle tests when HA test libs are unavailable."""

    def __init__(self) -> None:
        """Initialize Home Assistant-like state used by setup/unload."""
        self.data: dict[str, Any] = {}

    async def async_block_till_done(self) -> None:
        """Mirror the Home Assistant test helper synchronization method."""
        await asyncio.sleep(0)


class MockConfigEntry:
    """Config-entry helper matching the lifecycle attributes under test."""

    def __init__(self, entry_id: str) -> None:
        """Initialize the config entry helper."""
        self.entry_id = entry_id
        self.runtime_data: Any = None


def dashboard(id_: str = "dashboard-1", title: str = "Main") -> Dashboard:
    """Create a valid dashboard."""
    card = Card.create(f"{id_}-card", "Weather", "weather", {"unit": "c"})
    section = Section.from_cards(f"{id_}-section", "Overview", (card,))
    view = View.from_sections(f"{id_}-view", "Home", (section,))
    return Dashboard.create(id_, title, (view,), (section,), (card,))
