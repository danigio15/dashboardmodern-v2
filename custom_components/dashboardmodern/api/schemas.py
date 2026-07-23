"""Voluptuous schemas for the DashboardModern WebSocket API."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from custom_components.dashboardmodern.const import (
    WS_TYPE_DASHBOARD_CREATE,
    WS_TYPE_DASHBOARD_DELETE,
    WS_TYPE_DASHBOARD_GET,
    WS_TYPE_DASHBOARD_LIST,
    WS_TYPE_DASHBOARD_REPLACE,
)

_NON_EMPTY_STRING = vol.All(str, vol.Length(min=1))

CARD_SCHEMA = vol.Schema(
    {
        vol.Required("id"): _NON_EMPTY_STRING,
        vol.Required("title"): _NON_EMPTY_STRING,
        vol.Required("type"): _NON_EMPTY_STRING,
        vol.Optional("config", default=dict): dict,
    },
    extra=vol.PREVENT_EXTRA,
)

SECTION_SCHEMA = vol.Schema(
    {
        vol.Required("id"): _NON_EMPTY_STRING,
        vol.Required("title"): _NON_EMPTY_STRING,
        vol.Optional("type"): _NON_EMPTY_STRING,
        vol.Optional("config", default=dict): dict,
        vol.Optional("card_ids", default=list): [str],
    },
    extra=vol.PREVENT_EXTRA,
)

VIEW_SCHEMA = vol.Schema(
    {
        vol.Required("id"): _NON_EMPTY_STRING,
        vol.Required("title"): _NON_EMPTY_STRING,
        vol.Optional("section_ids", default=list): [str],
    },
    extra=vol.PREVENT_EXTRA,
)

DASHBOARD_SCHEMA = vol.Schema(
    {
        vol.Required("id"): _NON_EMPTY_STRING,
        vol.Required("title"): _NON_EMPTY_STRING,
        vol.Required("views"): [VIEW_SCHEMA],
        vol.Required("sections"): [SECTION_SCHEMA],
        vol.Required("cards"): [CARD_SCHEMA],
        vol.Optional("config", default=dict): dict,
    },
    extra=vol.PREVENT_EXTRA,
)

ENTRY_ID = vol.Required("entry_id")
DASHBOARD_ID = vol.Required("dashboard_id")
DASHBOARD = vol.Required("dashboard")

LIST_COMMAND = {
    vol.Required("type"): WS_TYPE_DASHBOARD_LIST,
    ENTRY_ID: _NON_EMPTY_STRING,
}
GET_COMMAND = {
    vol.Required("type"): WS_TYPE_DASHBOARD_GET,
    ENTRY_ID: _NON_EMPTY_STRING,
    DASHBOARD_ID: _NON_EMPTY_STRING,
}
CREATE_COMMAND = {
    vol.Required("type"): WS_TYPE_DASHBOARD_CREATE,
    ENTRY_ID: _NON_EMPTY_STRING,
    DASHBOARD: DASHBOARD_SCHEMA,
}
REPLACE_COMMAND = {
    vol.Required("type"): WS_TYPE_DASHBOARD_REPLACE,
    ENTRY_ID: _NON_EMPTY_STRING,
    DASHBOARD: DASHBOARD_SCHEMA,
}
DELETE_COMMAND = {
    vol.Required("type"): WS_TYPE_DASHBOARD_DELETE,
    ENTRY_ID: _NON_EMPTY_STRING,
    DASHBOARD_ID: _NON_EMPTY_STRING,
}

DashboardMessage = dict[str, Any]
