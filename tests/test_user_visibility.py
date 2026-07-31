"""Per-user and Lovelace companion configuration tests."""

from __future__ import annotations

import pytest

pytest.importorskip(
    "homeassistant", reason="Home Assistant test dependency is not installed"
)

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.dashboardmodern.config_flow import (
    OPTION_ALLOWED_USERS,
    OPTION_REGISTER_LOVELACE,
)
from custom_components.dashboardmodern.const import DOMAIN
from custom_components.dashboardmodern.frontend import _panel_config


def test_panel_config_exposes_user_allow_list_and_companion_dashboard(
    hass: HomeAssistant,
) -> None:
    """The frontend gets the exact users and a stable Lovelace path."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        entry_id="0123456789abcdef",
        title="Casa",
        data={"name": "Casa", "primary": True},
        options={
            OPTION_ALLOWED_USERS: ["giovanni", "donato"],
            OPTION_REGISTER_LOVELACE: True,
        },
    )
    entry.add_to_hass(hass)

    config = _panel_config(hass, entry)

    assert config["allowed_user_ids"] == ["giovanni", "donato"]
    assert config["register_lovelace_dashboard"] is True
    assert config["lovelace_url_path"] == "dashboardmodern-01234567"
    assert config["dashboard_card_module"].endswith("/dashboard-card.js")
