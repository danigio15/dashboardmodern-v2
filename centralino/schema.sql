-- Il centralino tiene due cose e nient'altro: chi ha scritto, e cosa.
--
-- Nessuna email, nessun account, nessun indirizzo, nessun identificativo del
-- Home Assistant. Una casa e' un numero casuale che si e' fabbricata da sola;
-- se sparisce, non resta niente da ricollegare a nessuno.
--
-- Le case qui si chiamano «linee» perche' `case` e' una parola riservata di
-- SQL, e perche' a un centralino e' quello che sono: una linea aperta, con una
-- casa da una parte e una persona dall'altra.

CREATE TABLE IF NOT EXISTS linee (
  -- 128 bit di caso, generati nella casa. Non dice niente di nessuno.
  id            TEXT    PRIMARY KEY,
  -- L'impronta del segreto, mai il segreto: chi legge questo archivio non puo'
  -- scrivere a nome di nessuno.
  segreto       TEXT    NOT NULL,
  -- Come si fa chiamare, se ha voluto dirlo. Campo libero, puo' restare vuoto.
  nome          TEXT    NOT NULL DEFAULT '',
  -- Le tre cose che servono a capire una domanda senza doverle chiedere.
  versione      TEXT    NOT NULL DEFAULT '',
  ha            TEXT    NOT NULL DEFAULT '',
  lingua        TEXT    NOT NULL DEFAULT '',
  aperta_il     INTEGER NOT NULL,
  vista_il      INTEGER NOT NULL,
  -- Fin dove ha letto la casa e fin dove ha letto la console: due segnalibri
  -- sullo stesso filo, uno per sportello.
  letto_casa    INTEGER NOT NULL DEFAULT 0,
  letto_console INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messaggi (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  linea      TEXT    NOT NULL,
  -- 'casa' oppure 'console'. Due valori, e nessun terzo.
  da         TEXT    NOT NULL,
  testo      TEXT    NOT NULL,
  scritto_il INTEGER NOT NULL
);

-- Le due letture che si fanno davvero: «i messaggi di questa linea dopo il
-- numero N» e «quali linee hanno parlato per ultime».
CREATE INDEX IF NOT EXISTS messaggi_per_linea ON messaggi (linea, id);
CREATE INDEX IF NOT EXISTS linee_per_visita ON linee (vista_il DESC);
