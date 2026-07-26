"""Config flow for the DashboardModern integration."""

from __future__ import annotations

from typing import Any

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, NAME


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
