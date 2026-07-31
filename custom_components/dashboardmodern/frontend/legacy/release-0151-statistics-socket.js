/* DashboardModern 0.14.11: resilient statistics transport over the authenticated HA bridge. */
const REQUEST_TIMEOUT = 8000;
const client = {
  socket: null,
  connection: null,
  authenticated: false,
  nextId: 1,
  pending: new Map(),
};

function websocketUrl() {
  const configured = [
    globalThis.DASHBOARDMODERN_WS_URL,
    globalThis.HA_WS_URL,
    globalThis.wsUrl,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  if (configured) {
    if (/^wss?:\/\//i.test(configured)) return configured;
    if (/^https?:\/\//i.test(configured)) {
      return `${configured.replace(/^http/i, "ws").replace(/\/$/, "")}/api/websocket`;
    }
  }
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/websocket`;
}

function accessToken() {
  const direct = [
    globalThis.DASHBOARDMODERN_AUTH_TOKEN,
    globalThis.HA_TOKEN,
    globalThis.haToken,
    globalThis.authToken,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  if (direct) return direct;
  for (const storage of [globalThis.sessionStorage, globalThis.localStorage]) {
    if (!storage) continue;
    for (const key of ["dashboardmodern_ha_token", "ha_token", "home_assistant_token"]) {
      try {
        const value = String(storage.getItem(key) || "").trim();
        if (value) return value;
      } catch (_error) {}
    }
  }
  return "";
}

function rejectPending(error) {
  client.pending.forEach(({ reject, timer }) => {
    clearTimeout(timer);
    reject(error);
  });
  client.pending.clear();
}

function reset(error) {
  const socket = client.socket;
  client.socket = null;
  client.connection = null;
  client.authenticated = false;
  if (error) rejectPending(error);
  try {
    if (socket?.readyState === 1) socket.close();
  } catch (_error) {}
}

function handleMessage(event, resolveConnection, rejectConnection) {
  let message;
  try {
    message = JSON.parse(event?.data || event);
  } catch (_error) {
    return;
  }
  if (message.type === "auth_required") {
    client.socket?.send(JSON.stringify({ type: "auth", access_token: accessToken() }));
    return;
  }
  if (message.type === "auth_ok") {
    client.authenticated = true;
    resolveConnection(client.socket);
    return;
  }
  if (message.type === "auth_invalid") {
    const error = new Error(message.message || "Autenticazione Home Assistant non valida");
    rejectConnection(error);
    reset(error);
    return;
  }
  if (message.type !== "result" || message.id == null) return;
  const pending = client.pending.get(message.id);
  if (!pending) return;
  client.pending.delete(message.id);
  clearTimeout(pending.timer);
  if (message.success === false) {
    pending.reject(new Error(message.error?.message || message.error?.code || "Statistiche non disponibili"));
  } else {
    pending.resolve(message.result || {});
  }
}

function connect() {
  if (client.authenticated && client.socket?.readyState === 1) {
    return Promise.resolve(client.socket);
  }
  if (client.connection) return client.connection;
  client.connection = new Promise((resolve, reject) => {
    let settled = false;
    const done = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      const error = new Error("Timeout connessione statistiche Home Assistant");
      done(reject, error);
      reset(error);
    }, REQUEST_TIMEOUT);
    try {
      const socket = new WebSocket(websocketUrl());
      client.socket = socket;
      socket.onmessage = (event) => handleMessage(
        event,
        (value) => done(resolve, value),
        (error) => done(reject, error),
      );
      socket.onerror = () => {
        const error = new Error("Connessione statistiche Home Assistant non disponibile");
        done(reject, error);
        reset(error);
      };
      socket.onclose = () => {
        const error = new Error("Connessione statistiche Home Assistant chiusa");
        done(reject, error);
        reset(error);
      };
    } catch (error) {
      done(reject, error);
      reset(error);
    }
  }).finally(() => {
    client.connection = null;
  });
  return client.connection;
}

async function requestOverSocket(ids, start, end, period) {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("WebSocket Home Assistant non disponibile");
  }
  const socket = await connect();
  const id = client.nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.pending.delete(id);
      reject(new Error("Timeout richiesta statistiche Home Assistant"));
    }, REQUEST_TIMEOUT);
    client.pending.set(id, { resolve, reject, timer });
    try {
      socket.send(JSON.stringify({
        id,
        type: "recorder/statistics_during_period",
        start_time: start,
        end_time: end,
        statistic_ids: ids,
        period,
        units: {},
        types: ["change", "sum", "state", "mean"],
      }));
    } catch (error) {
      clearTimeout(timer);
      client.pending.delete(id);
      reject(error);
    }
  });
}

function isConnectionError(error) {
  return /websocket|socket|connect|connession|disconness|closed|chiusa/i.test(
    String(error?.message || error || ""),
  );
}

export async function fetchEnergyStatistics0151(ids, start, end, period) {
  const runtimeFetch = globalThis.fetchHAStatistics;
  if (typeof runtimeFetch === "function") {
    try {
      return await runtimeFetch(ids, start, end, period);
    } catch (error) {
      if (!isConnectionError(error)) throw error;
    }
  }
  return requestOverSocket(ids, start, end, period);
}
