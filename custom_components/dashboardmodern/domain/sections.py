"""Section domain model."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from types import MappingProxyType
from typing import Any, Self

from .cards import Card, _freeze_mapping, _thaw_value, _hashable_value
from .exceptions import ValidationError
from .models import CardId, SectionId


@dataclass(frozen=True, slots=True)
class Section:
    """A dashboard section containing ordered card references."""

    id: SectionId
    title: str
    card_ids: tuple[CardId, ...] = ()
    config: MappingProxyType[str, Any] = field(default_factory=lambda: _freeze_mapping(None))

    def __post_init__(self) -> None:
        """Validate and normalize section fields."""
        if not self.title.strip():
            msg = "Section title is required"
            raise ValidationError(msg)
        object.__setattr__(
            self,
            "card_ids",
            tuple(CardId.from_raw(card_id) for card_id in self.card_ids),
        )
        object.__setattr__(self, "config", _freeze_mapping(dict(self.config)))

    @classmethod
    def create(
        cls,
        id: str | SectionId,
        title: str,
        card_ids: tuple[str | CardId, ...] = (),
        config: dict[str, Any] | None = None,
    ) -> Self:
        """Create a section from primitive values."""
        return cls(
            SectionId.from_raw(id), title, tuple(CardId.from_raw(i) for i in card_ids), _freeze_mapping(config)
        )

    @classmethod
    def from_cards(
        cls, id: str | SectionId, title: str, cards: tuple[Card, ...]
    ) -> Self:
        """Create a section that references the supplied cards."""
        return cls.create(id, title, tuple(card.id for card in cards))

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Create a section from a serialized dictionary."""
        return cls.create(data["id"], data["title"], tuple(data.get("card_ids", ())), data.get("config"))

    def to_dict(self) -> dict[str, Any]:
        """Serialize this section into plain Python values."""
        return {
            "id": str(self.id),
            "title": self.title,
            "card_ids": [str(card_id) for card_id in self.card_ids],
            **({"config": _thaw_value(self.config)} if self.config else {}),
        }

    def __hash__(self) -> int:
        """Return a hash value compatible with section equality."""
        return hash((self.id, self.title, self.card_ids, _hashable_value(self.config)))

    def copy_with(self, **changes: Any) -> Self:
        """Return a copy with selected fields replaced."""
        if "id" in changes:
            changes["id"] = SectionId.from_raw(changes["id"])
        if "card_ids" in changes:
            changes["card_ids"] = tuple(CardId.from_raw(i) for i in changes["card_ids"])
        if "config" in changes:
            changes["config"] = _freeze_mapping(changes["config"])
        return replace(self, **changes)
