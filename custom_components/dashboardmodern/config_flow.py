"""Config flow for the DashboardModern integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, NAME

# When true, only administrators see the dashboard panel. Home Assistant offers
# no per-user panel visibility, so admin-only is the finest control available —
# useful when the dashboard should not appear for guest or child accounts.
OPTION_ADMIN_ONLY = "admin_only"


class DashboardModernConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a DashboardModern config flow."""

    VERSION = 2

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Create a DashboardModern config entry (one per plancia)."""
        if user_input is not None:
            name = (user_input.get("name") or NAME).strip() or NAME
            # The first plancia ever created is the primary one: it keeps the
            # historical panel URL and the historical cloud-sync key, so
            # existing installations upgrade without losing anything.
            primary = not self._async_current_entries()
            return self.async_create_entry(
                title=name, data={"name": name, "primary": primary}
            )

        schema = vol.Schema({vol.Required("name", default=NAME): str})
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> DashboardModernOptionsFlow:
        """Return the options flow for visibility settings."""
        return DashboardModernOptionsFlow()


class DashboardModernOptionsFlow(config_entries.OptionsFlow):
    """Options: who can see the dashboard panel."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Let the user restrict the panel to administrators."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = self.config_entry.options.get(OPTION_ADMIN_ONLY, False)
        schema = vol.Schema({vol.Optional(OPTION_ADMIN_ONLY, default=current): bool})
        return self.async_show_form(step_id="init", data_schema=schema)
