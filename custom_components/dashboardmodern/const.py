"""Constants for the DashboardModern integration."""

from __future__ import annotations

DOMAIN = "dashboardmodern"
NAME = "DashboardModern v2"

DATA_RUNTIMES = "runtimes"
DATA_WEBSOCKET_REGISTERED = "websocket_registered"

WS_TYPE_DASHBOARD_LIST = "dashboardmodern/dashboard/list"
WS_TYPE_DASHBOARD_GET = "dashboardmodern/dashboard/get"
WS_TYPE_DASHBOARD_CREATE = "dashboardmodern/dashboard/create"
WS_TYPE_DASHBOARD_REPLACE = "dashboardmodern/dashboard/replace"
WS_TYPE_DASHBOARD_DELETE = "dashboardmodern/dashboard/delete"

ERR_DASHBOARD_ALREADY_EXISTS = "dashboard_already_exists"
ERR_DASHBOARD_NOT_FOUND = "dashboard_not_found"
ERR_DASHBOARD_PERSISTENCE = "dashboard_persistence_error"
ERR_INVALID_DASHBOARD = "invalid_dashboard"
ERR_ENTRY_NOT_FOUND = "entry_not_found"
ERR_ENTRY_NOT_LOADED = "entry_not_loaded"
ERR_UNAUTHORIZED = "unauthorized"
ERR_DASHBOARDMODERN = "dashboardmodern_error"
