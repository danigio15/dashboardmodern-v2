"""Typed models for DashboardModern runtime contracts."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True, frozen=True)
class RuntimeOptions:
    """Runtime options for one DashboardModern config entry."""

    panel_enabled: bool = False
