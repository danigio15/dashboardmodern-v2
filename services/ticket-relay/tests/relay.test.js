/*
 * Il relay: cosa accetta, cosa rifiuta, e cosa non lascia leggere.
 *
 * Il Worker si esercita con un D1 finto — una manciata di righe in memoria che
 * risponde alle stesse quattro interrogazioni — perche' quello che conta qui
 * non e' SQLite: e' che `/sync` non risponda mai con la segnalazione di un
 * altro, che il limite scatti, e che la chiave non si possa indovinare
 * misurando i tempi.
 */

import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";
import {
  chiaveCorrisponde,
  chiaveDaIntestazione,
  corpoIssue,
  normalizzaDiagnostica,
  normalizzaIds,
  normalizzaRisposta,
  normalizzaTicket,
  titoloIssue,
} from "../src/validate.js";

/* ─── Il D1 finto ──────────────────────────────────────────────────────── */

class FakeDb {
  constructor(righe = []) {
    this.righe = righe;
    this.scritte = [];
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async first() {
    if (this.sql.startsWith("SELECT COUNT(*)")) {
      const [chiave, da] = this.args;
      const campo = this.sql.includes("installation = ?") ? "installation" : "ip_hash";
      const n = this.db.righe.filter(
        (riga) => riga[campo] === chiave && riga.created_at > da,
      ).length;
      return { n };
    }
    if (this.sql.startsWith("SELECT * FROM tickets WHERE id = ?")) {
      return this.db.righe.find((riga) => riga.id === this.args[0]) || null;
    }
    return null;
  }

  async all() {
    if (this.sql.includes("WHERE installation = ? AND id IN")) {
      const [installation, ...ids] = this.args;
      return {
        results: this.db.righe.filter(
          (riga) => riga.installation === installation && ids.includes(riga.id),
        ),
      };
    }
    return { results: [...this.db.righe] };
  }

  async run() {
    this.db.scritte.push({ sql: this.sql, args: this.args });
    if (this.sql.startsWith("INSERT INTO tickets")) {
      const [
        id,
        installation,
        type,
        title,
        body,
        contact,
        diagnostics,
        created_at,
        updated_at,
        ip_hash,
      ] = this.args;
      this.db.righe.push({
        id,
        installation,
        type,
        title,
        body,
        contact,
        diagnostics,
        state: "inviato",
        reply: "",
        issue_url: "",
        created_at,
        updated_at,
        ip_hash,
      });
    }
    if (this.sql.startsWith("UPDATE tickets SET")) {
      const [state, reply, issue_url, updated_at, id] = this.args;
      const riga = this.db.righe.find((voce) => voce.id === id);
      if (riga) Object.assign(riga, { state, reply, issue_url, updated_at });
    }
    return { success: true };
  }
}

const INSTALLAZIONE = "a".repeat(32);
const ALTRA = "b".repeat(32);

function ambiente(righe = [], extra = {}) {
  return {
    DB: new FakeDb(righe),
    MAINTAINER_TOKEN: "chiave-del-manutentore",
    IP_SALT: "sale",
    GITHUB_REPO: "danigio15/dashboardmodern-v2",
    DISABLED: "0",
    ...extra,
  };
}

function richiesta(percorso, corpo, { token = "", ip = "203.0.113.7" } = {}) {
  const headers = { "content-type": "application/json" };
  if (ip) headers["cf-connecting-ip"] = ip;
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`https://relay.example.com${percorso}`, {
    method: "POST",
    headers,
    body: JSON.stringify(corpo),
  });
}

const TICKET = {
  installation: INSTALLAZIONE,
  type: "bug",
  title: "Le tapparelle non si fermano",
  body: "Premo stop e continuano a scendere.",
  contact: "",
  diagnostics: { ha_version: "2026.8.0" },
};

function riga(overrides = {}) {
  return {
    id: "c".repeat(32),
    installation: INSTALLAZIONE,
    type: "bug",
    title: "Una segnalazione",
    body: "Il corpo.",
    contact: "",
    diagnostics: "{}",
    state: "inviato",
    reply: "",
    issue_url: "",
    created_at: Date.now(),
    updated_at: Date.now(),
    ip_hash: "",
    ...overrides,
  };
}

/* ─── Il percorso pubblico ─────────────────────────────────────────────── */

test("una segnalazione valida entra e torna col suo numero", async () => {
  const env = ambiente();
  const risposta = await worker.fetch(richiesta("/ticket", TICKET), env);
  assert.equal(risposta.status, 200);
  const letta = await risposta.json();
  assert.match(letta.id, /^[0-9a-f]{32}$/);
  assert.equal(env.DB.righe.length, 1);
});

test("l'indirizzo di rete non viene conservato", async () => {
  const env = ambiente();
  await worker.fetch(richiesta("/ticket", TICKET, { ip: "203.0.113.7" }), env);
  const [salvata] = env.DB.righe;
  /* L'impronta si', l'indirizzo no: serve a contare, non a risalire. */
  assert.match(salvata.ip_hash, /^[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(env.DB.righe).includes("203.0.113.7"));
});

test("un tipo inventato non entra", async () => {
  const env = ambiente();
  const risposta = await worker.fetch(
    richiesta("/ticket", { ...TICKET, type: "reclamo" }),
    env,
  );
  assert.equal(risposta.status, 400);
  assert.deepEqual(await risposta.json(), { error: "type" });
});

test("un'installazione che non e' esadecimale non entra", async () => {
  const env = ambiente();
  const risposta = await worker.fetch(
    richiesta("/ticket", { ...TICKET, installation: "'; DROP TABLE tickets; --" }),
    env,
  );
  assert.equal(risposta.status, 400);
  assert.equal(env.DB.righe.length, 0);
});

test("il limite per installazione scatta alla settima nell'ora", async () => {
  const adesso = Date.now();
  const gia = Array.from({ length: 6 }, (_, indice) =>
    riga({ id: `${indice}`.repeat(32).slice(0, 32), created_at: adesso - 1000 }),
  );
  const env = ambiente(gia);
  const risposta = await worker.fetch(richiesta("/ticket", TICKET), env);
  assert.equal(risposta.status, 429);
  assert.deepEqual(await risposta.json(), { error: "rate_limited" });
});

test("una segnalazione di un'ora fa non conta piu'", async () => {
  const vecchie = Array.from({ length: 6 }, (_, indice) =>
    riga({
      id: `${indice}`.repeat(32).slice(0, 32),
      created_at: Date.now() - 2 * 60 * 60 * 1000,
    }),
  );
  const risposta = await worker.fetch(richiesta("/ticket", TICKET), ambiente(vecchie));
  assert.equal(risposta.status, 200);
});

/* ─── Il vincolo che regge tutto il percorso pubblico ──────────────────── */

test("la sync risponde solo con i ticket dell'installazione che chiede", async () => {
  const mia = riga({ id: "1".repeat(32), reply: "Riprodotta." });
  const altrui = riga({
    id: "2".repeat(32),
    installation: ALTRA,
    reply: "Il salotto e la camera di Bruno",
  });
  const env = ambiente([mia, altrui]);
  const risposta = await worker.fetch(
    richiesta("/sync", {
      installation: INSTALLAZIONE,
      /* Chiesti tutti e due, compreso quello di un altro. */
      ids: [mia.id, altrui.id],
    }),
    env,
  );
  const letta = await risposta.json();
  assert.deepEqual(
    letta.tickets.map((ticket) => ticket.remote_id),
    [mia.id],
  );
  assert.ok(!JSON.stringify(letta).includes("Bruno"));
});

test("la sync non restituisce mai il contatto ne' il corpo", async () => {
  const env = ambiente([
    riga({ id: "1".repeat(32), contact: "anna@example.com", body: "Il mio impianto" }),
  ]);
  const risposta = await worker.fetch(
    richiesta("/sync", { installation: INSTALLAZIONE, ids: ["1".repeat(32)] }),
    env,
  );
  const testo = JSON.stringify(await risposta.json());
  assert.ok(!testo.includes("anna@example.com"));
  assert.ok(!testo.includes("Il mio impianto"));
});

/* ─── La console ───────────────────────────────────────────────────────── */

test("senza chiave la coda non si apre", async () => {
  const risposta = await worker.fetch(richiesta("/queue", {}), ambiente([riga()]));
  assert.equal(risposta.status, 401);
});

test("con una chiave sbagliata la coda non si apre", async () => {
  const risposta = await worker.fetch(
    richiesta("/queue", {}, { token: "chiave-del-manutentorX" }),
    ambiente([riga()]),
  );
  assert.equal(risposta.status, 401);
});

test("con la chiave giusta la coda si legge", async () => {
  const risposta = await worker.fetch(
    richiesta("/queue", {}, { token: "chiave-del-manutentore" }),
    ambiente([riga({ title: "Una segnalazione" })]),
  );
  assert.equal(risposta.status, 200);
  const letta = await risposta.json();
  assert.equal(letta.tickets[0].title, "Una segnalazione");
});

test("rispondere cambia stato e testo", async () => {
  const env = ambiente([riga({ id: "1".repeat(32) })]);
  const risposta = await worker.fetch(
    richiesta(
      "/answer",
      { remote_id: "1".repeat(32), state: "in-carico", reply: "Ci sto lavorando." },
      { token: "chiave-del-manutentore" },
    ),
    env,
  );
  assert.equal(risposta.status, 200);
  assert.equal(env.DB.righe[0].state, "in-carico");
  assert.equal(env.DB.righe[0].reply, "Ci sto lavorando.");
});

test("uno stato inventato non passa", async () => {
  const risposta = await worker.fetch(
    richiesta(
      "/answer",
      { remote_id: "1".repeat(32), state: "archiviato" },
      { token: "chiave-del-manutentore" },
    ),
    ambiente([riga({ id: "1".repeat(32) })]),
  );
  assert.equal(risposta.status, 400);
});

test("una richiesta di assistenza non diventa mai una issue pubblica", async () => {
  /* E' la ragione per cui i tre tipi non sono la stessa cosa con un'etichetta
   * diversa: l'assistenza porta il nome delle stanze e le foto di casa. */
  const env = ambiente([riga({ id: "1".repeat(32), type: "assistenza" })], {
    GITHUB_TOKEN: "token-che-non-va-usato",
  });
  const risposta = await worker.fetch(
    richiesta(
      "/answer",
      { remote_id: "1".repeat(32), promote: true },
      { token: "chiave-del-manutentore" },
    ),
    env,
  );
  assert.equal(risposta.status, 200);
  assert.equal((await risposta.json()).issue_url, "");
});

test("un ticket gia' promosso non apre una seconda issue", async () => {
  const esistente = "https://github.com/danigio15/dashboardmodern-v2/issues/9";
  const env = ambiente([riga({ id: "1".repeat(32), issue_url: esistente })], {
    GITHUB_TOKEN: "token-che-non-va-usato",
  });
  const risposta = await worker.fetch(
    richiesta(
      "/answer",
      { remote_id: "1".repeat(32), promote: true },
      { token: "chiave-del-manutentore" },
    ),
    env,
  );
  assert.equal((await risposta.json()).issue_url, esistente);
});

/* ─── Il resto ─────────────────────────────────────────────────────────── */

test("l'interruttore generale spegne tutto", async () => {
  const risposta = await worker.fetch(
    richiesta("/ticket", TICKET),
    ambiente([], { DISABLED: "1" }),
  );
  assert.equal(risposta.status, 503);
});

test("una GET non e' una richiesta valida", async () => {
  const risposta = await worker.fetch(
    new Request("https://relay.example.com/queue", { method: "GET" }),
    ambiente(),
  );
  assert.equal(risposta.status, 405);
});

test("un percorso sconosciuto non racconta niente", async () => {
  const risposta = await worker.fetch(richiesta("/admin", {}), ambiente());
  assert.equal(risposta.status, 404);
});

test("un corpo che non e' JSON non fa cadere il servizio", async () => {
  const risposta = await worker.fetch(
    new Request("https://relay.example.com/ticket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{non json",
    }),
    ambiente(),
  );
  assert.equal(risposta.status, 400);
});

test("nessuna risposta apre le porte a un browser qualsiasi", async () => {
  /* Il servizio lo chiama il backend di Home Assistant. Senza intestazioni
   * CORS una pagina qualunque non ne puo' leggere la risposta. */
  const risposta = await worker.fetch(richiesta("/ticket", TICKET), ambiente());
  assert.equal(risposta.headers.get("access-control-allow-origin"), null);
});

/* ─── Le decisioni pure ────────────────────────────────────────────────── */

test("la diagnostica in arrivo e' una lista chiusa anche qui", () => {
  const pulita = normalizzaDiagnostica({
    ha_version: "2026.8.0",
    ha_url: "https://casa.example.com",
    token: "segreto",
  });
  assert.deepEqual(pulita, { ha_version: "2026.8.0" });
});

test("un titolo su piu' righe diventa una riga sola", () => {
  const esito = normalizzaTicket({ ...TICKET, title: "prima\nseconda" });
  assert.ok(esito.ok);
  assert.ok(!esito.ticket.title.includes("\n"));
});

test("il testo si taglia alla misura dichiarata", () => {
  const esito = normalizzaTicket({ ...TICKET, body: "c".repeat(9000) });
  assert.equal(esito.ticket.body.length, 4000);
});

test("gli identificativi della sync sono esadecimali e senza doppioni", () => {
  assert.deepEqual(normalizzaIds(["a".repeat(32), "a".repeat(32), "non-valido", 42]), [
    "a".repeat(32),
  ]);
});

test("una risposta senza remote_id valido non passa", () => {
  assert.equal(normalizzaRisposta({ remote_id: "../../etc" }).ok, false);
});

test("il confronto della chiave non dipende dal contenuto", () => {
  assert.equal(chiaveCorrisponde("abc", "abc"), true);
  assert.equal(chiaveCorrisponde("abd", "abc"), false);
  assert.equal(chiaveCorrisponde("ab", "abc"), false);
  /* Una chiave non configurata non deve corrispondere a una richiesta senza
   * chiave: sarebbe una console aperta a tutti. */
  assert.equal(chiaveCorrisponde("", ""), false);
});

test("la chiave si legge solo dal prefisso Bearer", () => {
  assert.equal(chiaveDaIntestazione("Bearer segreta"), "segreta");
  assert.equal(chiaveDaIntestazione("Basic segreta"), "");
  assert.equal(chiaveDaIntestazione(null), "");
});

test("la issue pubblica non porta il contatto ne' l'installazione", () => {
  const corpo = corpoIssue({
    id: "c".repeat(32),
    type: "bug",
    title: "Titolo",
    body: "Il corpo.",
    contact: "anna@example.com",
    installation: INSTALLAZIONE,
    diagnostics: { ha_version: "2026.8.0" },
  });
  assert.ok(!corpo.includes("anna@example.com"));
  assert.ok(!corpo.includes(INSTALLAZIONE));
  assert.ok(corpo.includes("2026.8.0"));
});

test("il titolo della issue porta il prefisso dei template", () => {
  assert.equal(titoloIssue({ type: "bug", title: "Rotto" }), "[Bug]: Rotto");
  assert.equal(titoloIssue({ type: "feature", title: "Idea" }), "[Feature]: Idea");
});
