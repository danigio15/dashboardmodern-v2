-- Il deposito delle segnalazioni.
--
-- Una tabella sola: un ticket e' una riga, e non ha figli. La risposta del
-- manutentore sta nella riga stessa perche' e' una sola — se un giorno
-- servisse un carteggio, quello sara' una tabella nuova, non una colonna piu'
-- lunga.
--
-- Dell'indirizzo di rete si conserva un'impronta, mai l'indirizzo: serve a
-- contare le richieste della stessa rete, e non a risalire alla casa.

CREATE TABLE IF NOT EXISTS tickets (
  id           TEXT PRIMARY KEY,
  installation TEXT    NOT NULL,
  type         TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  contact      TEXT    NOT NULL DEFAULT '',
  diagnostics  TEXT    NOT NULL DEFAULT '{}',
  state        TEXT    NOT NULL DEFAULT 'inviato',
  reply        TEXT    NOT NULL DEFAULT '',
  issue_url    TEXT    NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  ip_hash      TEXT    NOT NULL DEFAULT ''
);

-- Le due domande che il limite fa a ogni segnalazione in arrivo: quante ne ha
-- mandate questa installazione nell'ultima ora, e quante questa rete.
CREATE INDEX IF NOT EXISTS tickets_installation
  ON tickets (installation, created_at);
CREATE INDEX IF NOT EXISTS tickets_ip
  ON tickets (ip_hash, created_at);

-- L'ordine in cui la console li guarda: prima quelli che nessuno ha ancora
-- toccato.
CREATE INDEX IF NOT EXISTS tickets_state ON tickets (state, created_at);
