"""View domain model."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Self

from .exceptions import ValidationError
from .models import SectionId, ViewId
from .sections import Section


@dataclass(frozen=True, slots=True)
class View:
    """A dashboard view containing ordered section references."""

    id: ViewId
    title: str
    section_ids: tuple[SectionId, ...] = ()

    def __post_init__(self) -> None:
        """Validate and normalize view fields."""
        if not self.title.strip():
            msg = "View title is required"
            raise ValidationError(msg)
        object.__setattr__(
            self,
            "section_ids",
            tuple(SectionId.from_raw(section_id) for section_id in self.section_ids),
        )

    @classmethod
    def create(
        cls,
        id: str | ViewId,
        title: str,
        section_ids: tuple[str | SectionId, ...] = (),
    ) -> Self:
        """Create a view from primitive values."""
        return cls(
            ViewId.from_raw(id),
            title,
            tuple(SectionId.from_raw(i) for i in section_ids),
        )

    @classmethod
    def from_sections(
        cls, id: str | ViewId, title: str, sections: tuple[Section, ...]
    ) -> Self:
        """Create a view that references the supplied sections."""
        return cls.create(id, title, tuple(section.id for section in sections))

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Create a view from a serialized dictionary."""
        return cls.create(data["id"], data["title"], tuple(data.get("section_ids", ())))

    def to_dict(self) -> dict[str, Any]:
        """Serialize this view into plain Python values."""
        return {
            "id": str(self.id),
            "title": self.title,
            "section_ids": [str(section_id) for section_id in self.section_ids],
        }

    def copy_with(self, **changes: Any) -> Self:
        """Return a copy with selected fields replaced."""
        if "id" in changes:
            changes["id"] = ViewId.from_raw(changes["id"])
        if "section_ids" in changes:
            changes["section_ids"] = tuple(
                SectionId.from_raw(i) for i in changes["section_ids"]
            )
        return replace(self, **changes)
