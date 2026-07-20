"""Reusable DashboardModern domain layer."""

from __future__ import annotations

from .cards import Card
from .dashboard import Dashboard
from .exceptions import (
    DashboardAlreadyExistsError,
    DashboardNotFoundError,
    DomainError,
    DuplicateIdError,
    InvalidHierarchyError,
    MissingReferenceError,
    RegistryError,
    ValidationError,
)
from .models import CardId, DashboardId, SectionId, ViewId
from .registry import DashboardRegistry
from .sections import Section
from .views import View

__all__ = [
    "Card",
    "CardId",
    "Dashboard",
    "DashboardAlreadyExistsError",
    "DashboardId",
    "DashboardNotFoundError",
    "DashboardRegistry",
    "DomainError",
    "DuplicateIdError",
    "InvalidHierarchyError",
    "MissingReferenceError",
    "RegistryError",
    "Section",
    "SectionId",
    "ValidationError",
    "View",
    "ViewId",
]
