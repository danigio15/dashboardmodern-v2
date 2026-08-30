"""Il riavvio che completa l'aggiornamento, dal posto standard.

Il tasto «Installa» mette a terra i file nuovi ma non puo' ricaricare il
Python in esecuzione: serve il riavvio di Home Assistant. Chi arrivava da
HACS lo chiedeva dalla Riparazione col suo tasto — premi, confermi, riparte —
e con la sola notifica testuale quel tasto non lo trovava piu' da nessuna
parte. Questa e' quella Riparazione: la apre `update.py` a installazione
riuscita, e la conferma riavvia davvero.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.repairs import RepairsFlow
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult


class RiavvioRichiestoFlow(RepairsFlow):
    """Conferma e riavvia: due passi, come il flusso di HACS."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Il primo passo e' direttamente la conferma."""
        return await self.async_step_confirm()

    async def async_step_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Alla conferma si riavvia; la Riparazione si chiude da sola."""
        if user_input is not None:
            await self.hass.services.async_call(
                "homeassistant", "restart", blocking=False
            )
            return self.async_create_entry(title="", data={})
        return self.async_show_form(step_id="confirm")


async def async_create_fix_flow(
    hass: HomeAssistant, issue_id: str, data: dict[str, Any] | None
) -> RepairsFlow:
    """L'unica riparazione di questa integrazione e' il riavvio."""
    return RiavvioRichiestoFlow()
