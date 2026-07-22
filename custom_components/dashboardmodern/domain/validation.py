"""Validation helpers for DashboardModern domain objects."""

from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

from .exceptions import DuplicateIdError, InvalidHierarchyError, MissingReferenceError
from .models import _StringId

IdT = TypeVar("IdT", bound=_StringId)


def ensure_unique_ids(ids: Iterable[IdT], label: str) -> None:  # noqa: UP047
    """Raise when identifiers contain duplicates."""
    seen: set[IdT] = set()
    for item_id in ids:
        if item_id in seen:
            msg = f"Duplicate {label} id: {item_id}"
            raise DuplicateIdError(msg)
        seen.add(item_id)


def ensure_references_exist(  # noqa: UP047
    references: Iterable[IdT], available: Iterable[IdT], label: str
) -> None:  # noqa: UP047
    """Raise when a reference points to an unavailable identifier."""
    available_ids = set(available)
    for reference in references:
        if reference not in available_ids:
            msg = f"Missing {label} reference: {reference}"
            raise MissingReferenceError(msg)


def ensure_all_referenced(  # noqa: UP047
    required: Iterable[IdT], references: Iterable[IdT], label: str
) -> None:  # noqa: UP047
    """Raise when an aggregate child is not part of the hierarchy."""
    referenced_ids = set(references)
    for required_id in required:
        if required_id not in referenced_ids:
            msg = f"Unreferenced {label} is not allowed: {required_id}"
            raise InvalidHierarchyError(msg)


def ensure_non_empty_hierarchy(
    *, view_count: int, section_count: int, card_count: int
) -> None:
    """Raise when a dashboard hierarchy has no usable content."""
    if view_count == 0:
        msg = "Dashboard must contain at least one view"
        raise InvalidHierarchyError(msg)
    if section_count == 0:
        msg = "Dashboard must contain at least one section"
        raise InvalidHierarchyError(msg)
    # Widget-provided sections may legitimately have no cards. Per-section
    # validation decides whether each section has card or widget content.
