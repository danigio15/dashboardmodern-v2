"""Config flow for the DashboardModern integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.selector import (
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import DOMAIN, NAME, OPTION_CHECK_UPDATES, OPTION_TICKETS_ENABLED

OPTION_ADMIN_ONLY = "admin_only"
OPTION_ALLOWED_USERS = "allowed_users"
OPTION_REGISTER_LOVELACE = "register_lovelace_dashboard"


class DashboardModernConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a DashboardModern config flow."""

    VERSION = 2

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Create a DashboardModern config entry (one per plancia)."""
        if user_input is not None:
            name = (user_input.get("name") or NAME).strip() or NAME
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
    """Configure panel visibility and its companion Lovelace dashboard."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Choose who can open this plancia and register it as a dashboard."""
        if user_input is not None:
            user_input[OPTION_ALLOWED_USERS] = list(
                dict.fromkeys(user_input.get(OPTION_ALLOWED_USERS, []))
            )
            return self.async_create_entry(title="", data=user_input)

        current_users = list(self.config_entry.options.get(OPTION_ALLOWED_USERS, []))
        users = await self.hass.auth.async_get_users()
        options: list[SelectOptionDict] = [
            SelectOptionDict(label=user.name or user.id, value=user.id)
            for user in users
            if user.is_active and not user.system_generated
        ]
        known = {option["value"] for option in options}
        options.extend(
            SelectOptionDict(label=user_id, value=user_id)
            for user_id in current_users
            if user_id not in known
        )

        schema = vol.Schema(
            {
                vol.Optional(
                    OPTION_ALLOWED_USERS,
                    description={"suggested_value": current_users},
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=options,
                        multiple=True,
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Optional(
                    OPTION_REGISTER_LOVELACE,
                    default=self.config_entry.options.get(
                        OPTION_REGISTER_LOVELACE, True
                    ),
                ): bool,
                vol.Optional(
                    OPTION_ADMIN_ONLY,
                    default=self.config_entry.options.get(OPTION_ADMIN_ONLY, False),
                ): bool,
            }
        )
        # L'avviso di aggiornamento e' dell'integrazione, non della singola
        # plancia: lo porta una sola, quella venuta per prima, ed e' la sua
        # opzione a contare. Mostrarlo anche sulle altre voleva dire offrire un
        # interruttore che non comanda niente — spento su una plancia
        # secondaria, la richiesta a GitHub partiva lo stesso — e su una scelta
        # che riguarda la riservatezza non e' un dettaglio. Quindi compare dove
        # ha effetto.
        #
        # Acceso di suo: chi non lo vuole lo spegne, e la plancia torna a non
        # parlare con nessuno fuori di casa.
        from . import _primary_entry

        if _primary_entry(self.hass, self.config_entry):
            schema = schema.extend(
                {
                    vol.Optional(
                        OPTION_CHECK_UPDATES,
                        default=self.config_entry.options.get(
                            OPTION_CHECK_UPDATES, True
                        ),
                    ): bool,
                    # Le segnalazioni valgono per l'installazione, quindi
                    # stanno accanto al controllo aggiornamenti e per la stessa
                    # ragione: sono le due sole cose che parlano fuori di casa,
                    # e chi non le vuole le spegne nello stesso posto.
                    vol.Optional(
                        OPTION_TICKETS_ENABLED,
                        default=self.config_entry.options.get(
                            OPTION_TICKETS_ENABLED, True
                        ),
                    ): bool,
                }
            )
        return self.async_show_form(step_id="init", data_schema=schema)
