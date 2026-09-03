/* Un D1 finto, che parla SQL vero.
 *
 * Il Worker si prova con `node:sqlite`, che c'e' dentro Node dalla 22: le
 * stesse query, lo stesso dialetto, la stessa `RETURNING`. Un finto che
 * risponde a mano invece che eseguire le query proverebbe che il Worker chiama
 * le funzioni giuste — non che le query dicono la verita', che e' l'unica cosa
 * che qui puo' rompersi in silenzio.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");

class Preparata {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.parametri = [];
  }
  bind(...valori) {
    this.parametri = valori;
    return this;
  }
  async first() {
    return this.db.prepare(this.sql).get(...this.parametri) ?? null;
  }
  async all() {
    return { results: this.db.prepare(this.sql).all(...this.parametri) };
  }
  async run() {
    /* `RETURNING` fa di una INSERT una query che restituisce righe, e
     * `.run()` di node:sqlite su quelle si rifiuta di lavorare. */
    if (/returning/i.test(this.sql)) return { results: this.db.prepare(this.sql).all(...this.parametri) };
    this.db.prepare(this.sql).run(...this.parametri);
    return { success: true };
  }
}

export function d1Finto() {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  return {
    prepare: (sql) => new Preparata(db, sql),
    batch: async (preparate) => {
      const esiti = [];
      for (const preparata of preparate) esiti.push(await preparata.run());
      return esiti;
    },
    /* Solo per le prove: guardare dentro senza passare dal Worker. */
    interroga: (sql, ...parametri) => db.prepare(sql).all(...parametri),
  };
}
