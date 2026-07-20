"""Unit tests for the reusable DashboardModern domain layer."""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from custom_components.dashboardmodern.domain import (
    Card,
    CardId,
    Dashboard,
    DashboardAlreadyExistsError,
    DashboardId,
    DashboardNotFoundError,
    DashboardRegistry,
    DuplicateIdError,
    InvalidHierarchyError,
    MissingReferenceError,
    Section,
    ValidationError,
    View,
)


def _dashboard() -> Dashboard:
    """Create a valid dashboard fixture."""
    card = Card.create("card-1", "Weather", "weather", {"unit": "c"})
    section = Section.from_cards("section-1", "Overview", (card,))
    view = View.from_sections("view-1", "Home", (section,))
    return Dashboard.create("dashboard-1", "Main", (view,), (section,), (card,))


def test_identifiers_are_typed_hashable_and_validate_empty_values() -> None:
    """Identifiers are value objects, hashable, and reject blank values."""
    assert DashboardId("main") == DashboardId.from_raw("main")
    assert {CardId("card-1")} == {CardId("card-1")}
    assert hash(_dashboard()) == hash(Dashboard.from_dict(_dashboard().to_dict()))

    with pytest.raises(ValidationError):
        DashboardId(" ")


def test_domain_objects_are_immutable_and_serializable() -> None:
    """Domain aggregates serialize to plain data and round-trip back."""
    dashboard = _dashboard()

    with pytest.raises(FrozenInstanceError):
        dashboard.title = "changed"

    serialized = dashboard.to_dict()
    assert serialized == {
        "id": "dashboard-1",
        "title": "Main",
        "views": [{"id": "view-1", "title": "Home", "section_ids": ["section-1"]}],
        "sections": [{"id": "section-1", "title": "Overview", "card_ids": ["card-1"]}],
        "cards": [
            {
                "id": "card-1",
                "title": "Weather",
                "type": "weather",
                "config": {"unit": "c"},
            }
        ],
    }
    assert Dashboard.from_dict(serialized) == dashboard


def test_copy_helpers_return_updated_validated_objects() -> None:
    """copy_with helpers preserve immutability and run validation."""
    dashboard = _dashboard()
    updated_card = dashboard.cards[0].copy_with(title="Forecast")
    updated_section = dashboard.sections[0].copy_with(card_ids=(updated_card.id,))
    updated = dashboard.copy_with(cards=(updated_card,), sections=(updated_section,))

    assert updated is not dashboard
    assert updated.cards[0].title == "Forecast"
    assert dashboard.cards[0].title == "Weather"

    with pytest.raises(MissingReferenceError):
        dashboard.copy_with(
            sections=(Section.create("section-1", "Broken", ("missing",)),)
        )


def test_validation_detects_duplicate_ids() -> None:
    """Duplicate child ids are invalid."""
    card = Card.create("card-1", "Weather", "weather")
    section = Section.create("section-1", "Overview", (card.id,))
    view = View.create("view-1", "Home", (section.id,))

    with pytest.raises(DuplicateIdError):
        Dashboard.create("dashboard-1", "Main", (view,), (section,), (card, card))


def test_validation_detects_missing_references() -> None:
    """Missing section and card references are invalid."""
    card = Card.create("card-1", "Weather", "weather")
    section = Section.create("section-1", "Overview", ("missing-card",))
    view = View.create("view-1", "Home", (section.id,))

    with pytest.raises(MissingReferenceError):
        Dashboard.create("dashboard-1", "Main", (view,), (section,), (card,))

    with pytest.raises(MissingReferenceError):
        Dashboard.create(
            "dashboard-1",
            "Main",
            (View.create("view-1", "Home", ("missing-section",)),),
            (Section.create("section-1", "Overview", (card.id,)),),
            (card,),
        )


def test_validation_detects_invalid_hierarchy_and_empty_required_fields() -> None:
    """Invalid hierarchy and blank required fields are rejected."""
    card = Card.create("card-1", "Weather", "weather")
    section = Section.create("section-1", "Overview", (card.id,))

    with pytest.raises(InvalidHierarchyError):
        Dashboard.create("dashboard-1", "Main", (), (section,), (card,))
    with pytest.raises(ValidationError):
        Card.create("card-1", " ", "weather")
    with pytest.raises(ValidationError):
        Dashboard.create("dashboard-1", " ", (), (), ())
    with pytest.raises(ValidationError):
        Dashboard.create(
            "dashboard-1",
            "Main",
            (View.create("view-1", "Home", ()),),
            (section,),
            (card,),
        )


def test_registry_adds_finds_lists_and_removes_dashboards() -> None:
    """Registry provides in-memory dashboard management only."""
    dashboard = _dashboard()
    registry = DashboardRegistry()

    registry.add(dashboard)
    assert registry.find("dashboard-1") == dashboard
    assert registry.get(DashboardId("dashboard-1")) == dashboard
    assert registry.list() == (dashboard,)

    with pytest.raises(DashboardAlreadyExistsError):
        registry.add(dashboard)

    assert registry.remove("dashboard-1") == dashboard
    assert registry.find("dashboard-1") is None

    with pytest.raises(DashboardNotFoundError):
        registry.remove("dashboard-1")
