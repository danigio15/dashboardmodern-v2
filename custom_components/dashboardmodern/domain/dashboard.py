"""Dashboard aggregate root."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Self

from .cards import Card
from .exceptions import ValidationError
from .models import DashboardId
from .sections import Section
from .validation import (
    ensure_non_empty_hierarchy,
    ensure_references_exist,
    ensure_unique_ids,
)
from .views import View


@dataclass(frozen=True, slots=True)
class Dashboard:
    """Immutable dashboard aggregate containing views, sections, and cards."""

    id: DashboardId
    title: str
    views: tuple[View, ...]
    sections: tuple[Section, ...]
    cards: tuple[Card, ...]

    def __post_init__(self) -> None:
        """Validate dashboard fields and hierarchy."""
        if not self.title.strip():
            msg = "Dashboard title is required"
            raise ValidationError(msg)
        object.__setattr__(self, "views", tuple(self.views))
        object.__setattr__(self, "sections", tuple(self.sections))
        object.__setattr__(self, "cards", tuple(self.cards))
        self.validate()

    @classmethod
    def create(
        cls,
        id: str | DashboardId,
        title: str,
        views: tuple[View, ...],
        sections: tuple[Section, ...],
        cards: tuple[Card, ...],
    ) -> Self:
        """Create a dashboard from primitive values and domain children."""
        return cls(DashboardId.from_raw(id), title, views, sections, cards)

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
        for view in self.views:
            ensure_references_exist(view.section_ids, section_ids, "section")
            if not view.section_ids:
                msg = f"View has no sections: {view.id}"
                raise ValidationError(msg)
        for section in self.sections:
            ensure_references_exist(section.card_ids, card_ids, "card")
            if not section.card_ids:
                msg = f"Section has no cards: {section.id}"
                raise ValidationError(msg)

    def to_dict(self) -> dict[str, Any]:
        """Serialize this dashboard into plain Python values."""
        return {
            "id": str(self.id),
            "title": self.title,
            "views": [view.to_dict() for view in self.views],
            "sections": [section.to_dict() for section in self.sections],
            "cards": [card.to_dict() for card in self.cards],
        }

    def copy_with(self, **changes: Any) -> Self:
        """Return a validated copy with selected fields replaced."""
        if "id" in changes:
            changes["id"] = DashboardId.from_raw(changes["id"])
        return replace(self, **changes)
