/*
 * Il relay delle segnalazioni.
 *
 * Riceve i ticket che le plance scrivono, li conserva, e li fa rileggere alla
 * console del manutentore. E' l'unico pezzo del sistema che non gira in casa
 * di chi usa la plancia, e per questo e' anche l'unico che deve difendersi:
 * l'indirizzo sta dentro codice sorgente pubblico, quindi e' pubblico, e chi
 * lo chiama puo' non essere una plancia affatto.
 *
 * Quattro percorsi.
 *
 *   POST /ticket   pubblico   una segnalazione nuova           -> { id }
 *   POST /sync     pubblico   lo stato dei PROPRI ticket       -> { tickets }
 *   POST /queue    con chiave la coda del manutentore          -> { tickets }
 *   POST /answer   con chiave stato, risposta, promozione      -> { ok }
 *
 * «I propri» in /sync non e' un modo di dire ed e' la regola piu' importante
 * del file: la richiesta porta l'identificativo dell'installazione, e la
 * risposta contiene solo i ticket di quella. Senza quel vincolo chiunque
 * conoscesse un identificativo — o li tirasse a indovinare — leggerebbe le
 * segnalazioni degli altri, comprese le richieste di assistenza, che sono
 * quelle che portano il nome delle stanze e le foto di casa.
 */

import {
  chiaveCorrisponde,
  chiaveDaIntestazione,
  corpoIssue,
  normalizzaIds,
  normalizzaRisposta,
  normalizzaTicket,
  titoloIssue,
} from "./validate.js";

/* Il corpo piu' grande che si accetta di leggere. Un ticket valido sta
 * ampiamente sotto: il tetto serve a chi non manda un ticket valido. */
const MAX_BODY_BYTES = 64 * 1024;

/* Quante segnalazioni all'ora, per installazione e per rete. La prima ferma
 * una plancia che sbaglia, la seconda chi ci prova apposta. */
const MAX_PER_INSTALLATION_HOUR = 6;
const MAX_PER_IP_HOUR = 20;
const ORA_MS = 60 * 60 * 1000;

const GITHUB_API = "https://api.github.com";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      /* Nessuna intestazione CORS, ed e' voluto: questo servizio lo chiama il
       * backend di Home Assistant, non un browser. Senza CORS una pagina
       * qualsiasi non puo' leggerne le risposte. */
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

const errore = (codice, status) => json({ error: codice }, status);

async function leggiCorpo(request) {
  const dichiarata = Number(request.headers.get("content-length") || 0);
  if (dichiarata > MAX_BODY_BYTES) return null;
  const testo = await request.text();
  if (testo.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(testo || "{}");
  } catch (_error) {
    return null;
  }
}

/* L'indirizzo non si conserva: se ne conserva un'impronta, che basta a
 * contare le richieste della stessa rete e non basta a risalire alla casa. Il
 * sale e' un segreto del servizio, altrimenti l'impronta di un indirizzo la
 * ricalcolerebbe chiunque. */
async function improntaIp(request, sale) {
  const indirizzo = request.headers.get("cf-connecting-ip") || "";
  if (!indirizzo) return "";
  const dati = new TextEncoder().encode(`${sale}:${indirizzo}`);
  const digest = await crypto.subtle.digest("SHA-256", dati);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function troppoSpesso(db, { installation, ipHash }) {
  const da = Date.now() - ORA_MS;
  const perInstallazione = await db
    .prepare("SELECT COUNT(*) AS n FROM tickets WHERE installation = ? AND created_at > ?")
    .bind(installation, da)
    .first();
  if ((perInstallazione?.n || 0) >= MAX_PER_INSTALLATION_HOUR) return true;
  if (!ipHash) return false;
  const perRete = await db
    .prepare("SELECT COUNT(*) AS n FROM tickets WHERE ip_hash = ? AND created_at > ?")
    .bind(ipHash, da)
    .first();
  return (perRete?.n || 0) >= MAX_PER_IP_HOUR;
}

async function creaTicket(request, env) {
  const grezzo = await leggiCorpo(request);
  if (grezzo === null) return errore("payload", 400);
  const esito = normalizzaTicket(grezzo);
  if (!esito.ok) return errore(esito.errore, 400);
  const { ticket } = esito;
  const ipHash = await improntaIp(request, env.IP_SALT || "");
  if (await troppoSpesso(env.DB, { installation: ticket.installation, ipHash })) {
    return errore("rate_limited", 429);
  }
  const id = crypto.randomUUID().replaceAll("-", "");
  const adesso = Date.now();
  await env.DB.prepare(
    `INSERT INTO tickets
       (id, installation, type, title, body, contact, diagnostics,
        state, reply, issue_url, created_at, updated_at, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'inviato', '', '', ?, ?, ?)`,
  )
    .bind(
      id,
      ticket.installation,
      ticket.type,
      ticket.title,
      ticket.body,
      ticket.contact,
      JSON.stringify(ticket.diagnostics),
      adesso,
      adesso,
      ipHash,
    )
    .run();
  return json({ id });
}

async function sincronizza(request, env) {
  const grezzo = await leggiCorpo(request);
  if (grezzo === null) return errore("payload", 400);
  const installation = String(grezzo.installation || "");
  if (!/^[0-9a-f]{8,64}$/.test(installation)) return errore("installation", 400);
  const ids = normalizzaIds(grezzo.ids);
  if (!ids.length) return json({ tickets: [] });
  const segnaposto = ids.map(() => "?").join(",");
  /* `installation = ?` e' il vincolo che rende questo percorso pubblico senza
   * renderlo una finestra sulle segnalazioni altrui. */
  const risultato = await env.DB.prepare(
    `SELECT id, state, reply, issue_url FROM tickets
      WHERE installation = ? AND id IN (${segnaposto})`,
  )
    .bind(installation, ...ids)
    .all();
  return json({
    tickets: (risultato?.results || []).map((riga) => ({
      remote_id: riga.id,
      state: riga.state,
      reply: riga.reply || "",
      issue_url: riga.issue_url || "",
    })),
  });
}

function autorizzato(request, env) {
  return chiaveCorrisponde(
    chiaveDaIntestazione(request.headers.get("authorization")),
    env.MAINTAINER_TOKEN || "",
  );
}

async function coda(request, env) {
  const risultato = await env.DB.prepare(
    `SELECT id, installation, type, title, body, contact, diagnostics,
            state, reply, issue_url, created_at, updated_at
       FROM tickets
      ORDER BY (state = 'inviato') DESC, created_at DESC
      LIMIT 200`,
  ).all();
  return json({
    tickets: (risultato?.results || []).map((riga) => ({
      remote_id: riga.id,
      installation: riga.installation,
      type: riga.type,
      title: riga.title,
      body: riga.body,
      contact: riga.contact || "",
      diagnostics: leggiDiagnostica(riga.diagnostics),
      state: riga.state,
      reply: riga.reply || "",
      issue_url: riga.issue_url || "",
      created_at: riga.created_at,
      updated_at: riga.updated_at,
    })),
  });
}

function leggiDiagnostica(grezza) {
  try {
    const letta = JSON.parse(grezza || "{}");
    return letta && typeof letta === "object" ? letta : {};
  } catch (_error) {
    return {};
  }
}

async function apriIssue(env, riga) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return "";
  const ticket = {
    id: riga.id,
    type: riga.type,
    title: riga.title,
    body: riga.body,
    diagnostics: leggiDiagnostica(riga.diagnostics),
  };
  const risposta = await fetch(`${GITHUB_API}/repos/${env.GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "content-type": "application/json",
      "user-agent": "dashboardmodern-ticket-relay",
    },
    body: JSON.stringify({
      title: titoloIssue(ticket),
      body: corpoIssue(ticket),
      labels: [ticket.type === "feature" ? "enhancement" : "bug"],
    }),
  });
  if (!risposta.ok) return "";
  const creata = await risposta.json();
  return typeof creata?.html_url === "string" ? creata.html_url : "";
}

async function rispondi(request, env) {
  const grezzo = await leggiCorpo(request);
  if (grezzo === null) return errore("payload", 400);
  const esito = normalizzaRisposta(grezzo);
  if (!esito.ok) return errore(esito.errore, 400);
  const { remoteId, stato, reply, promote } = esito.risposta;
  const riga = await env.DB.prepare("SELECT * FROM tickets WHERE id = ?")
    .bind(remoteId)
    .first();
  if (!riga) return errore("not_found", 404);

  /* La promozione non si ripete: una issue aperta due volte per lo stesso
   * ticket e' rumore per chi legge il tracker, e la seconda non si puo'
   * togliere. */
  let issueUrl = riga.issue_url || "";
  if (promote && !issueUrl && riga.type !== "assistenza") {
    issueUrl = await apriIssue(env, riga);
  }
  await env.DB.prepare(
    `UPDATE tickets SET state = ?, reply = ?, issue_url = ?, updated_at = ?
      WHERE id = ?`,
  )
    .bind(
      stato || riga.state,
      reply || riga.reply || "",
      issueUrl,
      Date.now(),
      remoteId,
    )
    .run();
  return json({ ok: true, issue_url: issueUrl });
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return errore("method", 405);
    /* L'interruttore generale: si spegne tutto senza ridistribuire
     * l'integrazione a nessuno. */
    if (env.DISABLED === "1") return errore("disabled", 503);
    const percorso = new URL(request.url).pathname.replace(/\/+$/, "");
    try {
      if (percorso === "/ticket") return await creaTicket(request, env);
      if (percorso === "/sync") return await sincronizza(request, env);
      if (percorso === "/queue" || percorso === "/answer") {
        if (!autorizzato(request, env)) return errore("unauthorized", 401);
        return percorso === "/queue"
          ? await coda(request, env)
          : await rispondi(request, env);
      }
    } catch (_error) {
      /* Il motivo vero non esce di qui: dice a chi sonda com'e' fatto dentro,
       * e a chi ha aperto la segnalazione non serve. */
      return errore("server", 500);
    }
    return errore("not_found", 404);
  },
};
