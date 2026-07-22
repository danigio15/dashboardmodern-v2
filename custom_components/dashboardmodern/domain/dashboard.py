"""Dashboard aggregate root."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from types import MappingProxyType
from typing import Any, Self

from .cards import Card, _freeze_mapping, _thaw_value, _hashable_value
from .exceptions import InvalidHierarchyError, ValidationError
from .models import DashboardId
from .sections import Section
from .validation import (
    ensure_all_referenced,
    ensure_non_empty_hierarchy,
    ensure_references_exist,
    ensure_unique_ids,
)
from .views import View


@dataclass(frozen=True, slots=True)
class Dashboard:
    """Immutable strict aggregate containing only fully referenced children."""

    id: DashboardId
    title: str
    views: tuple[View, ...]
    sections: tuple[Section, ...]
    cards: tuple[Card, ...]
    config: MappingProxyType[str, Any] = field(default_factory=lambda: _freeze_mapping(None))

    def __post_init__(self) -> None:
        """Validate dashboard fields and hierarchy."""
        if not self.title.strip():
            msg = "Dashboard title is required"
            raise ValidationError(msg)
        object.__setattr__(self, "views", tuple(self.views))
        object.__setattr__(self, "sections", tuple(self.sections))
        object.__setattr__(self, "cards", tuple(self.cards))
        object.__setattr__(self, "config", _freeze_mapping(dict(self.config)))
        self.validate()

    @classmethod
    def create(
        cls,
        id: str | DashboardId,
        title: str,
        views: tuple[View, ...],
        sections: tuple[Section, ...],
        cards: tuple[Card, ...],
        config: dict[str, Any] | None = None,
    ) -> Self:
        """Create a dashboard from primitive values and domain children."""
        return cls(DashboardId.from_raw(id), title, views, sections, cards, _freeze_mapping(config))

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Create a dashboard from a serialized dictionary."""
        return cls.create(
            id=data["id"],
            title=data["title"],
            views=tuple(View.from_dict(item) for item in data.get("views", ())),
            sections=tuple(
                Section.from_dict(item) for item in data.get("sections", ())
            ),
            cards=tuple(Card.from_dict(item) for item in data.get("cards", ())),
            config=data.get("config"),
        )

    def validate(self) -> None:
        """Validate duplicate ids, references, and hierarchy."""
        ensure_unique_ids((view.id for view in self.views), "view")
        ensure_unique_ids((section.id for section in self.sections), "section")
        ensure_unique_ids((card.id for card in self.cards), "card")
        ensure_non_empty_hierarchy(
            view_count=len(self.views),
            section_count=len(self.sections),
            card_count=len(self.cards),
        )
        section_ids = tuple(section.id for section in self.sections)
        card_ids = tuple(card.id for card in self.cards)
        referenced_section_ids = []
        referenced_card_ids = []
        for view in self.views:
            ensure_unique_ids(view.section_ids, f"section reference in view {view.id}")
            ensure_references_exist(view.section_ids, section_ids, "section")
            if not view.section_ids:
                msg = f"View has no sections: {view.id}"
                raise InvalidHierarchyError(msg)
            referenced_section_ids.extend(view.section_ids)
        for section in self.sections:
            ensure_unique_ids(
                section.card_ids, f"card reference in section {section.id}"
            )
            ensure_references_exist(section.card_ids, card_ids, "card")
            has_widgets = bool(section.config.get("widgets"))
            if not section.card_ids and not has_widgets:
                msg = f"Section has no cards or widgets: {section.id}"
                raise InvalidHierarchyError(msg)
            referenced_card_ids.extend(section.card_ids)
        ensure_all_referenced(section_ids, referenced_section_ids, "section")
        ensure_all_referenced(card_ids, referenced_card_ids, "card")

    def to_dict(self) -> dict[str, Any]:
        """Serialize this dashboard into plain Python values."""
        return {
            "id": str(self.id),
            "title": self.title,
            "views": [view.to_dict() for view in self.views],
            "sections": [section.to_dict() for section in self.sections],
            "cards": [card.to_dict() for card in self.cards],
            **({"config": _thaw_value(self.config)} if self.config else {}),
        }

    def __hash__(self) -> int:
        """Return a hash value compatible with dashboard equality."""
        return hash((self.id, self.title, self.views, self.sections, self.cards, _hashable_value(self.config)))

    def copy_with(self, **changes: Any) -> Self:
        """Return a validated copy with selected fields replaced."""
        if "id" in changes:
            changes["id"] = DashboardId.from_raw(changes["id"])
        if "config" in changes:
            changes["config"] = _freeze_mapping(changes["config"])
        return replace(self, **changes)
