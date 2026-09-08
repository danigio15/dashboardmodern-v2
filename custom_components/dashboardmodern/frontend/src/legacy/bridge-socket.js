/*
 * A WebSocket that never carries a credential.
 *
 * The first version of this bridge handed the hosted dashboard a Home Assistant
 * access token, which it stored in localStorage so its existing bootstrap could
 * use it unchanged. That was wrong. The hosted page loaded three scripts from a
 * public CDN — Chart.js, hls.js, panzoom — and any script running in a page can
 * read that page's localStorage. Nothing suggests those libraries do anything
 * of the sort, but putting a working Home Assistant credential within reach of
 * third-party code is an exposure with no upside, and the whole point of the
 * integration was to stop tokens existing.
 *
 * Those libraries now ship with the integration and are served from the same
 * origin as everything else — panzoom is gone entirely, nothing ever used it.
 * That removes the third party, not the reasoning: a credential the page never
 * holds is a credential nothing in the page can read.
 *
 * So no token crosses over. Instead the panel installs this shim in place of
 * the hosted document's WebSocket constructor. The hosted code still calls
 * `new WebSocket(...)`, still sends the same messages and still receives the
 * same replies — but the messages are forwarded through the panel's own
 * authenticated connection, which lives in the parent document where the CDN
 * scripts are not running.
 *
 * The shim is the enforcement point: it forwards a fixed set of message types
 * and refuses the rest. Anything running inside the hosted page can therefore
 * do exactly what the dashboard needs and nothing else, which is a stronger
 * guarantee than the token ever gave.
 */

export const ALLOWED_MESSAGE_TYPES = Object.freeze([
  "get_states",
  "call_service",
  "subscribe_events",
  "unsubscribe_events",
  "get_config",
  "get_services",
  "config/area_registry/list",
  "config/floor_registry/list",
  "history/history_during_period",
  "history/stream",
  "recorder/statistics_during_period",
  "config/device_registry/list",
  "config/entity_registry/list",
  "recorder/list_statistic_ids",
  "camera/stream",
  "camera_thumbnail",
  // Il video vero delle telecamere (#294): il WebRTC come lo parla Home
  // Assistant. L'offerta e' una sottoscrizione — session, answer, candidate
  // arrivano come eventi sullo stesso id — e il ponte la consegna cosi'.
  // Senza queste quattro voci, dentro il pannello (e da Nabu Casa) il popup
  // moriva con «Message type not permitted through the bridge».
  "camera/webrtc/offer",
  "camera/webrtc/candidate",
  "camera/webrtc/get_client_config",
  "camera/web_rtc_offer",
  "frontend/get_user_data",
  "frontend/set_user_data",
  // Shared plancia configuration. frontend/*_user_data stays allowed only so
  // the per-user copy it used to write can be migrated into the shared store.
  "dashboardmodern/config/get",
  "dashboardmodern/config/set",
  "dashboardmodern/config/restore",
  // Sfogliare le cartelle per la foto dell'auto. La finestra «Scegli la foto»
  // chiede questi tre e basta: senza, nel pannello di Home Assistant rispondeva
  // «Message type not permitted through the bridge» e non apriva niente,
  // mentre sulla pagina legacy — che il ponte non ce l'ha — funzionava.
  "media_source/browse_media",
  "media_source/resolve_media",
  "dashboardmodern/www/list",
  // Il caricamento «Dal dispositivo»: la foto viaggia sul socket perche' la
  // plancia servita dall'integrazione non possiede nessun token e ogni
  // chiamata REST del browser risponde 401.
  "dashboardmodern/www/upload",
  // Il menu delle integrazioni: la lavatrice di hOn, il forno di Home Connect,
  // con tutte le loro entita'. Il backend legge i registri e li rimette nella
  // forma di un menu; di qui passa la domanda, e la risposta.
  "dashboardmodern/integrations/catalog",
  // Il calendario si guarda e si tocca (#259): l'elenco degli eventi viene
  // dalla porta HTTP firmata, ma segnare, spostare e cancellare un impegno
  // sono tre messaggi sul socket. Senza, dentro il pannello di Home Assistant
  // rispondevano «Message type not permitted through the bridge» e la matita
  // non faceva niente — mentre sulla pagina legacy, che il ponte non ce l'ha,
  // funzionava.
  "calendar/event/create",
  "calendar/event/update",
  "calendar/event/delete",
  // Le segnalazioni. Stessa ragione dell'upload, e una in piu': la chiave del
  // manutentore sta nelle opzioni del config entry e la chiamata verso il
  // relay la fa il backend, quindi qui passa la domanda e non il segreto.
  "dashboardmodern/tickets/list",
  "dashboardmodern/tickets/create",
  "dashboardmodern/tickets/delete",
  "dashboardmodern/tickets/sync",
  "dashboardmodern/tickets/queue",
  "dashboardmodern/tickets/answer",
  "dashboardmodern/tickets/thread",
  "dashboardmodern/tickets/reply",
  "dashboardmodern/tickets/take",
  "dashboardmodern/tickets/unread",
  "dashboardmodern/tickets/auth/start",
  "dashboardmodern/tickets/auth/poll",
  "dashboardmodern/tickets/auth/forget",
  // La chat di assistenza. Stessa forma delle segnalazioni e stessa ragione:
  // il segreto della casa e la chiave della console stanno nel backend, e di
  // qui passano solo parole scritte da una persona.
  "dashboardmodern/chat/state",
  "dashboardmodern/chat/thread",
  "dashboardmodern/chat/send",
  "dashboardmodern/chat/forget",
  "dashboardmodern/chat/queue",
  "dashboardmodern/chat/open",
  "dashboardmodern/chat/answer",
  "dashboardmodern/chat/drop",
  // Assist (#360). Dal campo, con la schermata allegata: «impostato
  // conversation gemini e openai ma non funziona, sbaglio io qualcosa?», e
  // dentro il riquadro rosso c'era la nostra risposta — «Message type not
  // permitted through the bridge: conversation/process». Non sbagliava
  // niente: Assist manda quel messaggio e basta, e di qui non passava.
  //
  // Si vedeva solo dentro il pannello di Home Assistant e da Nabu Casa, cioe'
  // da dove la plancia si guarda normalmente: sulla pagina legacy, che il
  // ponte non ce l'ha, la stessa domanda arrivava e la casa rispondeva. E'
  // la stessa dimenticanza del calendario e delle foto dell'auto, ed e' la
  // ragione per cui la prova qui accanto elenca cosa deve passare invece di
  // fidarsi che qualcuno se ne ricordi.
  "conversation/process",
  // L'accensione temporizzata del Clima (#364). Trovati dalla stessa prova
  // appena le si e' tolto il buco: sono tre comandi del backend, registrati
  // la' e negati qui, e come Assist funzionavano solo sulla pagina legacy.
  "dashboardmodern/clima/timer/list",
  "dashboardmodern/clima/timer/set",
  "dashboardmodern/clima/timer/clear",
  "auth/sign_path",
]);

const OPEN = 1;
const CLOSED = 3;
const MODERN_PERSISTENCE_ID_MIN = 700000;
const DASHBOARD_CONFIG_KEY_PREFIX = "dashboardmodern_integration_config";

/**
 * The vendored runtime still contains its historical flat user_data sync.
 * Modern persistence uses request ids >= 700000 and an envelope
 * `{version, updated_at, values}`. Both used to write the same HA key, so a
 * phone and a desktop could alternately overwrite it with incompatible shapes.
 * The hosted bridge is early enough to stop the old writer before modules load.
 */
export function isLegacyDashboardPersistenceMessage(message = {}) {
  const type = String(message?.type || "");
  if (type !== "frontend/get_user_data" && type !== "frontend/set_user_data") return false;
  if (!String(message?.key || "").startsWith(DASHBOARD_CONFIG_KEY_PREFIX)) return false;
  const id = Number(message?.id);
  return !Number.isFinite(id) || id < MODERN_PERSISTENCE_ID_MIN;
}

/**
 * Create the shim class.
 *
 * `connection` is the panel's authenticated Home Assistant connection.
 * `onDenied` is called with any message type the shim refuses, so a denial is
 * visible during development instead of looking like a silent failure.
 */
export function createBridgeSocket({
  connection,
  onDenied = () => {},
  allowed = ALLOWED_MESSAGE_TYPES,
} = {}) {
  if (!connection?.sendMessagePromise) {
    throw new Error("An authenticated Home Assistant connection is required.");
  }
  const permitted = new Set(allowed);

  /* La presa segue la connessione del pannello.
   *
   * Il ponte diceva `auth_ok` appena costruito e non chiudeva mai: il pallino
   * restava verde anche con Home Assistant scollegato, e quando il telefono
   * tornava dal sonno la plancia teneva gli stati di prima — quelli cambiati
   * nel frattempo restavano vecchi finche' non cambiavano di nuovo — perche'
   * nessuno le dava una ragione per richiedere l'istantanea. Una presa vera
   * cade quando cade la linea, e il guscio sa gia' cosa fare a quel punto:
   * riapre, richiede `get_states`, si riabbona. Qui si fa la stessa cosa: le
   * prese aperte cadono quando il pannello perde la connessione, e una presa
   * costruita mentre la connessione manca si apre quando torna. */
  const aperte = new Set();
  const inAttesa = new Set();
  const collegata = () => connection.connected !== false;
  connection.addEventListener?.("disconnected", () => {
    for (const socket of [...aperte]) socket._lineaCaduta();
  });
  connection.addEventListener?.("ready", () => {
    for (const socket of [...inAttesa]) socket._apri();
  });

  /* Una sottoscrizione per tipo di evento, per tutte le prese.
   *
   * Il guscio si abbona a `state_changed` sulla sua presa e il broker dei
   * moduli sulla sua: due prese, e prima erano due sottoscrizioni sul server —
   * Home Assistant serializzava e spediva ogni cambio di stato di ogni entita'
   * due volte alla stessa plancia. Qui il ponte tiene UNA sottoscrizione per
   * tipo e la distribuisce alle prese che l'hanno chiesta, ognuna col suo id;
   * si chiude quando l'ultima presa la lascia. */
  const condivise = new Map();
  const lasciaLaSottoscrizione = (eventType, ascolto) => {
    const voce = condivise.get(eventType);
    if (!voce) return;
    voce.ascolti.delete(ascolto);
    if (voce.ascolti.size) return;
    condivise.delete(eventType);
    /* Chiudere una sottoscrizione a linea caduta puo' fallire: e' gia' morta. */
    Promise.resolve()
      .then(() => voce.unsubscribe?.())
      .catch(() => {});
  };
  const prendiLaSottoscrizione = async (eventType, ascolto) => {
    let voce = condivise.get(eventType);
    if (!voce) {
      voce = { ascolti: new Set(), unsubscribe: null, pronta: null };
      condivise.set(eventType, voce);
      voce.pronta = connection
        .subscribeEvents((event) => {
          for (const { socket, id } of [...voce.ascolti])
            socket._deliver({ id, type: "event", event });
        }, eventType)
        .then((unsubscribe) => {
          voce.unsubscribe = unsubscribe;
        })
        .catch((error) => {
          if (condivise.get(eventType) === voce) condivise.delete(eventType);
          throw error;
        });
    }
    voce.ascolti.add(ascolto);
    try {
      await voce.pronta;
    } catch (error) {
      voce.ascolti.delete(ascolto);
      throw error;
    }
    return () => lasciaLaSottoscrizione(eventType, ascolto);
  };

  /* L'istantanea di tutti gli stati, una volta per tutti.
   *
   * `get_states` e' la risposta piu' grossa che Home Assistant serializza, e
   * la chiedono in tanti a pochi secondi di distanza: la presa del guscio
   * all'avvio, e le prese temporanee del selettore delle entita'. Chi la
   * chiede mentre e' in viaggio riceve la stessa risposta; chi la chiede
   * subito dopo la trova ancora buona. */
  const ISTANTANEA_BUONA_PER_MS = 5000;
  let istantanea = null;
  const leggiGliStati = () => {
    const adesso = Date.now();
    if (istantanea && adesso - istantanea.da < ISTANTANEA_BUONA_PER_MS) return istantanea.promessa;
    const promessa = connection.sendMessagePromise({ type: "get_states" }).catch((error) => {
      if (istantanea?.promessa === promessa) istantanea = null;
      throw error;
    });
    istantanea = { da: adesso, promessa };
    return promessa;
  };

  return class BridgeSocket {
    /* Le costanti del WebSocket vero, sulla classe.
     *
     * Nel documento ospitato QUESTA classe e' `window.WebSocket`, e il guscio
     * confronta `ws.readyState !== WebSocket.OPEN` prima di chiedere un
     * flusso HLS. Senza le statiche il confronto era `1 !== undefined` —
     * sempre vero — e l'HLS veniva scartato prima ancora di mandare
     * `camera/stream`: nessuna telecamera del pannello si svegliava mai, e
     * le cam in cloud (Ring, Arlo) restavano sulle istantanee vecchie. */
    static CONNECTING = 0;
    static OPEN = OPEN;
    static CLOSING = 2;
    static CLOSED = CLOSED;

    constructor() {
      this.readyState = collegata() ? OPEN : 0;
      this.onmessage = null;
      this.onopen = null;
      this.onclose = null;
      this.onerror = null;
      this._subscriptions = new Map();

      // The hosted bootstrap waits for auth_ok before it does anything. There
      // is nothing to authenticate — the parent connection already is — so the
      // handshake is completed as soon as that connection is up and the auth
      // message it would send is discarded.
      if (collegata()) queueMicrotask(() => this._apri());
      else inAttesa.add(this);
    }

    _apri() {
      inAttesa.delete(this);
      if (this.readyState === CLOSED) return;
      this.readyState = OPEN;
      aperte.add(this);
      this.onopen?.({});
      this._deliver({ type: "auth_ok" });
    }

    _lineaCaduta() {
      this._lasciaTutto();
      aperte.delete(this);
      this.readyState = CLOSED;
      this.onclose?.({ code: 1006, reason: "Home Assistant connection lost" });
    }

    _deliver(payload) {
      this.onmessage?.({ data: JSON.stringify(payload) });
    }

    _reply(id, result) {
      this._deliver({ id, type: "result", success: true, result });
    }

    _fail(id, code, message) {
      this._deliver({
        id,
        type: "result",
        success: false,
        error: { code, message },
      });
    }

    async send(raw) {
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      const { id, type } = message;
      if (type === "auth") return;

      if (!permitted.has(type)) {
        onDenied(type);
        this._fail(id, "not_allowed", `Message type not permitted through the bridge: ${type}`);
        return;
      }

      // The classic runtime executes before deferred ES modules, therefore
      // merely replacing cdSyncPush later is not enough: its auth_ok handler can
      // already have issued a flat get/set_user_data request. A harmless success
      // reply keeps that old code from hanging while guaranteeing only the
      // canonical modern owner reaches Home Assistant for this config key.
      if (isLegacyDashboardPersistenceMessage(message)) {
        this._reply(id, type === "frontend/get_user_data" ? { value: null } : null);
        return;
      }

      if (type === "subscribe_events") {
        await this._subscribe(message);
        return;
      }
      if (type === "unsubscribe_events") {
        this._unsubscribe(message);
        return;
      }
      if (type === "camera/webrtc/offer") {
        await this._subscribeMessage(message);
        return;
      }

      try {
        const { id: _ignored, ...payload } = message;
        this._reply(
          id,
          type === "get_states"
            ? await leggiGliStati()
            : await connection.sendMessagePromise(payload),
        );
      } catch (error) {
        this._fail(id, error?.code || "bridge_error", error?.message || String(error));
      }
    }

    async _subscribe(message) {
      const { id, event_type: eventType } = message;
      try {
        const lascia = await prendiLaSottoscrizione(eventType, { socket: this, id });
        this._subscriptions.set(id, lascia);
        this._reply(id, null);
      } catch (error) {
        this._fail(id, "subscribe_failed", error?.message || String(error));
      }
    }

    /* Le sottoscrizioni di questa presa, lasciate tutte: alla chiusura e
     * alla caduta della linea. */
    _lasciaTutto() {
      for (const lascia of this._subscriptions.values()) {
        Promise.resolve()
          .then(() => lascia())
          .catch(() => {});
      }
      this._subscriptions.clear();
    }

    /* Una sottoscrizione a un comando: la risposta e' `success` e poi gli
     * eventi arrivano con lo stesso id finche' qualcuno non la chiude. E'
     * quello che fa il frontend di Home Assistant per il WebRTC, e il guscio
     * lo aspetta cosi' — il suo gestore porta `keepAlive`. */
    async _subscribeMessage(message) {
      const { id, ...payload } = message;
      if (typeof connection.subscribeMessage !== "function") {
        this._fail(id, "unsupported", "The panel connection cannot subscribe to messages.");
        return;
      }
      try {
        const unsubscribe = await connection.subscribeMessage(
          (event) => this._deliver({ id, type: "event", event }),
          payload,
        );
        this._subscriptions.set(id, unsubscribe);
        this._reply(id, null);
      } catch (error) {
        this._fail(id, error?.code || "subscribe_failed", error?.message || String(error));
      }
    }

    _unsubscribe(message) {
      const target = message.subscription;
      const unsubscribe = this._subscriptions.get(target);
      if (unsubscribe) {
        unsubscribe();
        this._subscriptions.delete(target);
      }
      this._reply(message.id, null);
    }

    close() {
      // Subscriptions outlive the socket unless they are released here, and a
      // hosted document that reloads would otherwise leak one per reload.
      this._lasciaTutto();
      aperte.delete(this);
      inAttesa.delete(this);
      this.readyState = CLOSED;
      this.onclose?.({});
    }
  };
}

/** Install the shim into a hosted document's window. */
export function installBridgeSocket(targetWindow, options) {
  const BridgeSocket = createBridgeSocket(options);
  targetWindow.WebSocket = BridgeSocket;
  targetWindow.__DASHBOARDMODERN_BRIDGED__ = true;
  return BridgeSocket;
}
