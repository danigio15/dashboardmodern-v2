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

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Create a DashboardModern config entry."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is None:
            return self.async_show_form(step_id="user", data_schema=None, errors={})

        return self.async_create_entry(title=NAME, data={})

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
