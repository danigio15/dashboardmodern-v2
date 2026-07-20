const COMMANDS = Object.freeze({
  list: "dashboardmodern/dashboard/list",
  get: "dashboardmodern/dashboard/get",
  create: "dashboardmodern/dashboard/create",
  replace: "dashboardmodern/dashboard/replace",
  delete: "dashboardmodern/dashboard/delete",
});

const KNOWN_ERROR_MESSAGES = Object.freeze({
  entry_not_found: "DashboardModern config entry was not found.",
  entry_not_loaded: "DashboardModern config entry is not loaded yet.",
  dashboard_not_found: "The selected dashboard was not found.",
  dashboard_already_exists: "A dashboard with this id already exists.",
  dashboard_persistence_error: "Home Assistant could not persist the dashboard.",
  invalid_dashboard: "The dashboard JSON is invalid.",
  unauthorized: "Administrator privileges are required for this action.",
  dashboardmodern_error: "DashboardModern could not complete the request.",
  invalid_format: "DashboardModern returned an invalid response.",
});

export class DashboardModernApiError extends Error {
  constructor(code, message, cause) {
    super(message || KNOWN_ERROR_MESSAGES[code] || "DashboardModern request failed.");
    this.name = "DashboardModernApiError";
    this.code = code || "dashboardmodern_error";
    this.cause = cause;
  }
}

function mapError(error) {
  const code = error?.code || error?.error?.code || "dashboardmodern_error";
  const message = KNOWN_ERROR_MESSAGES[code] || error?.message || error?.error?.message;
  return new DashboardModernApiError(code, message, error);
}

function assertObject(value, code = "invalid_format") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DashboardModernApiError(code, KNOWN_ERROR_MESSAGES[code]);
  }
  return value;
}

function assertDashboard(value) {
  const dashboard = assertObject(value);
  if (typeof dashboard.id !== "string" || typeof dashboard.title !== "string") {
    throw new DashboardModernApiError("invalid_format", KNOWN_ERROR_MESSAGES.invalid_format);
  }
  return dashboard;
}

export function createDashboardModernClient(connection) {
  if (!connection || typeof connection.sendMessagePromise !== "function") {
    throw new DashboardModernApiError(
      "invalid_format",
      "Home Assistant WebSocket connection is unavailable.",
    );
  }

  async function sendMessage(message) {
    try {
      return await connection.sendMessagePromise(message);
    } catch (error) {
      throw mapError(error);
    }
  }

  return Object.freeze({
    async listDashboards(entryId) {
      const response = assertObject(await sendMessage({ type: COMMANDS.list, entry_id: entryId }));
      if (!Array.isArray(response.dashboards)) {
        throw new DashboardModernApiError("invalid_format", KNOWN_ERROR_MESSAGES.invalid_format);
      }
      return response.dashboards.map(assertDashboard);
    },
    async getDashboard(entryId, dashboardId) {
      const response = assertObject(
        await sendMessage({ type: COMMANDS.get, entry_id: entryId, dashboard_id: dashboardId }),
      );
      return assertDashboard(response.dashboard);
    },
    async createDashboard(entryId, dashboard) {
      const response = assertObject(
        await sendMessage({ type: COMMANDS.create, entry_id: entryId, dashboard }),
      );
      return assertDashboard(response.dashboard);
    },
    async replaceDashboard(entryId, dashboard) {
      const response = assertObject(
        await sendMessage({ type: COMMANDS.replace, entry_id: entryId, dashboard }),
      );
      return assertDashboard(response.dashboard);
    },
    async deleteDashboard(entryId, dashboardId) {
      const response = assertObject(
        await sendMessage({ type: COMMANDS.delete, entry_id: entryId, dashboard_id: dashboardId }),
      );
      if (response.deleted !== true || response.dashboard_id !== dashboardId) {
        throw new DashboardModernApiError("invalid_format", KNOWN_ERROR_MESSAGES.invalid_format);
      }
      return response;
    },
  });
}

export { COMMANDS, KNOWN_ERROR_MESSAGES };
