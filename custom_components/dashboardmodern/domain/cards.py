"""Card domain model."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from types import MappingProxyType
from typing import Any, Self

from .exceptions import ValidationError
from .models import CardId


def _freeze_value(value: Any) -> Any:
    """Recursively freeze JSON-compatible container values."""
    if isinstance(value, Mapping):
        return _freeze_mapping(value)
    if isinstance(value, list | tuple):
        return tuple(_freeze_value(item) for item in value)
    if isinstance(value, set | frozenset):
        msg = "Card config values must be JSON-compatible; sets are not supported"
        raise ValidationError(msg)
    return value


def _freeze_mapping(value: Mapping[str, Any] | None) -> MappingProxyType[str, Any]:
    """Return an immutable recursive copy of a JSON-compatible mapping."""
    return MappingProxyType(
        {key: _freeze_value(item) for key, item in (value or {}).items()}
    )


def _thaw_value(value: Any) -> Any:
    """Recursively serialize frozen containers into JSON-compatible values."""
    if isinstance(value, Mapping):
        return {key: _thaw_value(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_thaw_value(item) for item in value]
    if isinstance(value, frozenset):
        return sorted(_thaw_value(item) for item in value)
    return value


def _hashable_value(value: Any) -> object:
    """Return a hashable representation of a frozen value."""
    if isinstance(value, MappingProxyType):
        return tuple(
            sorted((key, _hashable_value(item)) for key, item in value.items())
        )
    if isinstance(value, tuple):
        return tuple(_hashable_value(item) for item in value)
    if isinstance(value, frozenset):
        return frozenset(_hashable_value(item) for item in value)
    return value


@dataclass(frozen=True, slots=True)
class Card:
    """Dashboard card independent of storage, UI, and Home Assistant concerns."""

    id: CardId
    title: str
    type: str
    config: MappingProxyType[str, Any] = field(
        default_factory=lambda: _freeze_mapping(None)
    )

    def __post_init__(self) -> None:
        """Validate and normalize card fields."""
        if not self.title.strip():
            msg = "Card title is required"
            raise ValidationError(msg)
        if not self.type.strip():
            msg = "Card type is required"
            raise ValidationError(msg)
        object.__setattr__(self, "config", _freeze_mapping(dict(self.config)))

    @classmethod
    def create(
        cls,
        id: str | CardId,
        title: str,
        type: str,
        config: Mapping[str, Any] | None = None,
    ) -> Self:
        """Create a card from primitive values."""
        return cls(CardId.from_raw(id), title, type, _freeze_mapping(config))

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Self:
        """Create a card from a serialized dictionary."""
        return cls.create(
            id=data["id"],
            title=data["title"],
            type=data["type"],
            config=data.get("config"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize this card into plain Python values."""
        return {
            "id": str(self.id),
            "title": self.title,
            "type": self.type,
            "config": _thaw_value(self.config),
        }

    def __hash__(self) -> int:
        """Return a hash value compatible with card equality."""
        return hash((self.id, self.title, self.type, _hashable_value(self.config)))

    def copy_with(self, **changes: Any) -> Self:
        """Return a copy with selected fields replaced."""
        if "id" in changes:
            changes["id"] = CardId.from_raw(changes["id"])
        if "config" in changes:
            changes["config"] = _freeze_mapping(changes["config"])
        return replace(self, **changes)
