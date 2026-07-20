"""Strongly typed primitives shared by the DashboardModern domain model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Self

from .exceptions import ValidationError


@dataclass(frozen=True, slots=True)
class _StringId:
    """Immutable base class for typed string identifiers."""

    value: str

    def __post_init__(self) -> None:
        """Validate identifier content."""
        if not self.value.strip():
            msg = f"{type(self).__name__} value is required"
            raise ValidationError(msg)

    @classmethod
    def from_raw(cls, value: str | Self) -> Self:
        """Create an identifier from a raw string or return an existing id."""
        if isinstance(value, cls):
            return value
        return cls(value)

    def __str__(self) -> str:
        """Return the raw string value."""
        return self.value


@dataclass(frozen=True, slots=True)
class DashboardId(_StringId):
    """Typed dashboard identifier."""


@dataclass(frozen=True, slots=True)
class ViewId(_StringId):
    """Typed view identifier."""


@dataclass(frozen=True, slots=True)
class SectionId(_StringId):
    """Typed section identifier."""


@dataclass(frozen=True, slots=True)
class CardId(_StringId):
    """Typed card identifier."""
