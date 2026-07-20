"""Domain exceptions for DashboardModern."""

from __future__ import annotations


class DomainError(Exception):
    """Base exception for domain-layer errors."""


class ValidationError(DomainError, ValueError):
    """Raised when a domain object violates validation rules."""


class DuplicateIdError(ValidationError):
    """Raised when two objects share an identifier that must be unique."""


class MissingReferenceError(ValidationError):
    """Raised when an object references another object that does not exist."""


class InvalidHierarchyError(ValidationError):
    """Raised when domain objects are arranged in an invalid hierarchy."""


class RegistryError(DomainError):
    """Base exception for registry errors."""


class DashboardNotFoundError(RegistryError, KeyError):
    """Raised when a dashboard cannot be found in a registry."""


class DashboardAlreadyExistsError(RegistryError, KeyError):
    """Raised when adding a dashboard with an id that already exists."""
