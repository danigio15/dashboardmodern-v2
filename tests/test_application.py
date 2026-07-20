"""Tests for the DashboardModern application use-case layer."""

from __future__ import annotations

import asyncio
from dataclasses import FrozenInstanceError, dataclass, field

import pytest

from custom_components.dashboardmodern.application import (
    CreateDashboardCommand,
    DashboardAlreadyExistsError,
    DashboardApplicationService,
    DashboardNotFoundError,
    DashboardPersistenceSyncError,
    DeleteDashboardCommand,
    ReplaceDashboardCommand,
)
from custom_components.dashboardmodern.domain import Dashboard, DashboardRegistry
from custom_components.dashboardmodern.domain.exceptions import ValidationError
from custom_components.dashboardmodern.domain.models import DashboardId

from .helpers import dashboard


@dataclass(slots=True)
class ControllableRepository:
    """Repository test double with controllable replace-all failures."""

    dashboards: tuple[Dashboard, ...] = ()
    fail_replace_all: bool = False
    replace_all_calls: list[tuple[Dashboard, ...]] = field(default_factory=list)

    async def async_load_all(self) -> tuple[Dashboard, ...]:
        """Load stored dashboards."""
        await asyncio.sleep(0)
        return self.dashboards

    async def async_save(self, dashboard: Dashboard) -> None:
        """Save one dashboard for protocol completeness."""
        await self.async_replace_all(
            (
                *tuple(item for item in self.dashboards if item.id != dashboard.id),
                dashboard,
            )
        )

    async def async_delete(self, dashboard_id) -> None:  # noqa: ANN001
        """Delete one dashboard for protocol completeness."""
        await self.async_replace_all(
            tuple(item for item in self.dashboards if item.id != dashboard_id)
        )

    async def async_replace_all(self, dashboards: tuple[Dashboard, ...]) -> None:
        """Replace all dashboards or fail on demand."""
        await asyncio.sleep(0)
        if self.fail_replace_all:
            raise RuntimeError("storage unavailable")
        self.dashboards = dashboards
        self.replace_all_calls.append(dashboards)


def _service(
    *dashboards: Dashboard, repository: ControllableRepository | None = None
) -> tuple[DashboardApplicationService, DashboardRegistry, ControllableRepository]:
    """Create a service with a seeded registry and repository."""
    registry = DashboardRegistry()
    registry.replace_all(dashboards)
    repo = repository or ControllableRepository(dashboards)
    return DashboardApplicationService(registry, repo), registry, repo


def test_create_dashboard_command_rejects_non_dashboard() -> None:
    """Create commands accept only Dashboard payloads."""
    with pytest.raises(TypeError):
        CreateDashboardCommand("not-a-dashboard")


def test_replace_dashboard_command_rejects_non_dashboard() -> None:
    """Replace commands accept only Dashboard payloads."""
    with pytest.raises(TypeError):
        ReplaceDashboardCommand("not-a-dashboard")


def test_delete_dashboard_command_normalizes_raw_string() -> None:
    """Delete commands normalize raw dashboard id strings."""
    command = DeleteDashboardCommand("dashboard-1")

    assert command.dashboard_id == DashboardId("dashboard-1")


def test_delete_dashboard_command_rejects_invalid_ids() -> None:
    """Delete commands reject invalid dashboard ids during construction."""
    with pytest.raises(ValidationError):
        DeleteDashboardCommand(" ")


def test_command_instances_are_immutable() -> None:
    """Command dataclasses cannot be mutated after construction."""
    create = CreateDashboardCommand(dashboard())
    replace = ReplaceDashboardCommand(dashboard())
    delete = DeleteDashboardCommand("dashboard-1")

    with pytest.raises(FrozenInstanceError):
        create.dashboard = dashboard("dashboard-2")
    with pytest.raises(FrozenInstanceError):
        replace.dashboard = dashboard("dashboard-2")
    with pytest.raises(FrozenInstanceError):
        delete.dashboard_id = DashboardId("dashboard-2")


@pytest.mark.asyncio
async def test_list_empty() -> None:
    """Listing an empty registry returns an immutable tuple."""
    service, _, _ = _service()

    assert await service.async_list_dashboards() == ()


@pytest.mark.asyncio
async def test_list_existing_dashboards_preserves_order() -> None:
    """Listing dashboards preserves deterministic registry order."""
    first = dashboard("dashboard-1")
    second = dashboard("dashboard-2")
    service, _, _ = _service(first, second)

    assert await service.async_list_dashboards() == (first, second)


@pytest.mark.asyncio
async def test_get_existing() -> None:
    """Getting an existing dashboard returns it."""
    item = dashboard()
    service, _, _ = _service(item)

    assert await service.async_get_dashboard(item.id) == item


@pytest.mark.asyncio
async def test_get_missing() -> None:
    """Getting a missing dashboard raises an application error."""
    service, _, _ = _service()

    with pytest.raises(DashboardNotFoundError):
        await service.async_get_dashboard(dashboard().id)


@pytest.mark.asyncio
async def test_create_dashboard() -> None:
    """Creating persists the intended state then updates the registry."""
    item = dashboard()
    service, registry, repo = _service()

    assert await service.async_create_dashboard(CreateDashboardCommand(item)) == item

    assert registry.list() == (item,)
    assert repo.dashboards == registry.list()


@pytest.mark.asyncio
async def test_create_duplicate_rejected() -> None:
    """Creating an existing id does not silently replace it."""
    item = dashboard()
    service, registry, repo = _service(item)

    with pytest.raises(DashboardAlreadyExistsError):
        await service.async_create_dashboard(CreateDashboardCommand(item))

    assert registry.list() == (item,)
    assert repo.replace_all_calls == []


@pytest.mark.asyncio
async def test_replace_dashboard() -> None:
    """Replacing an existing dashboard persists and updates one item."""
    original = dashboard()
    updated = dashboard(title="Updated")
    service, registry, repo = _service(original)

    assert (
        await service.async_replace_dashboard(ReplaceDashboardCommand(updated))
        == updated
    )

    assert registry.list() == (updated,)
    assert repo.dashboards == registry.list()


@pytest.mark.asyncio
async def test_replace_missing_rejected() -> None:
    """Replacing a missing dashboard raises an application error."""
    item = dashboard()
    service, registry, repo = _service()

    with pytest.raises(DashboardNotFoundError):
        await service.async_replace_dashboard(ReplaceDashboardCommand(item))

    assert registry.list() == ()
    assert repo.replace_all_calls == []


@pytest.mark.asyncio
async def test_delete_dashboard() -> None:
    """Deleting an existing dashboard persists and removes it from memory."""
    first = dashboard("dashboard-1")
    second = dashboard("dashboard-2")
    service, registry, repo = _service(first, second)

    await service.async_delete_dashboard(DeleteDashboardCommand(first.id))

    assert registry.list() == (second,)
    assert repo.dashboards == registry.list()


@pytest.mark.asyncio
async def test_delete_missing_rejected() -> None:
    """Deleting a missing dashboard raises an application error."""
    item = dashboard()
    service, registry, repo = _service(item)

    with pytest.raises(DashboardNotFoundError):
        await service.async_delete_dashboard(DeleteDashboardCommand("missing"))

    assert registry.list() == (item,)
    assert repo.replace_all_calls == []


@pytest.mark.asyncio
async def test_registry_unchanged_when_persistence_fails_during_create() -> None:
    """Create leaves memory unchanged when persistence fails."""
    existing = dashboard("dashboard-1")
    repo = ControllableRepository((existing,), fail_replace_all=True)
    service, registry, _ = _service(existing, repository=repo)

    with pytest.raises(DashboardPersistenceSyncError) as exc_info:
        await service.async_create_dashboard(
            CreateDashboardCommand(dashboard("dashboard-2"))
        )

    assert isinstance(exc_info.value.__cause__, RuntimeError)
    assert registry.list() == (existing,)


@pytest.mark.asyncio
async def test_registry_unchanged_when_persistence_fails_during_replace() -> None:
    """Replace leaves memory unchanged when persistence fails."""
    existing = dashboard()
    repo = ControllableRepository((existing,), fail_replace_all=True)
    service, registry, _ = _service(existing, repository=repo)

    with pytest.raises(DashboardPersistenceSyncError):
        await service.async_replace_dashboard(
            ReplaceDashboardCommand(dashboard(title="Updated"))
        )

    assert registry.list() == (existing,)


@pytest.mark.asyncio
async def test_registry_unchanged_when_persistence_fails_during_delete() -> None:
    """Delete leaves memory unchanged when persistence fails."""
    existing = dashboard()
    repo = ControllableRepository((existing,), fail_replace_all=True)
    service, registry, _ = _service(existing, repository=repo)

    with pytest.raises(DashboardPersistenceSyncError):
        await service.async_delete_dashboard(DeleteDashboardCommand(existing.id))

    assert registry.list() == (existing,)


@pytest.mark.asyncio
async def test_persisted_state_matches_registry_after_successful_mutations() -> None:
    """Every successful mutation replaces persistence with registry state."""
    first = dashboard("dashboard-1")
    second = dashboard("dashboard-2")
    service, registry, repo = _service(first)

    await service.async_create_dashboard(CreateDashboardCommand(second))
    assert repo.dashboards == registry.list()

    await service.async_replace_dashboard(
        ReplaceDashboardCommand(second.copy_with(title="Updated"))
    )
    assert repo.dashboards == registry.list()

    await service.async_delete_dashboard(DeleteDashboardCommand(first.id))
    assert repo.dashboards == registry.list()


@pytest.mark.asyncio
async def test_concurrent_creates_do_not_lose_updates() -> None:
    """Application mutation locking keeps concurrent creates from losing updates."""
    service, registry, repo = _service()
    items = tuple(dashboard(f"dashboard-{idx}") for idx in range(10))

    await asyncio.gather(
        *(
            service.async_create_dashboard(CreateDashboardCommand(item))
            for item in items
        )
    )

    assert registry.list() == items
    assert repo.dashboards == items
