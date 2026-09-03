/* Il centralino: la buca delle lettere fra una casa e chi mantiene la plancia.
 *
 * Due sportelli e nient'altro. Da una parte una casa — anonima, riconosciuta
 * da un segreto che si e' fabbricata da sola — che scrive e legge il proprio
 * filo. Dall'altra la console, che con una chiave sola vede tutte le linee e
 * risponde.
 *
 * Quello che questo servizio NON fa e' la parte importante: non sa chi sia
 * nessuno, non tiene indirizzi, non guarda dentro le case. Sa solo che la linea
 * `casa_9f3a…` ha scritto «non mi si vede la temperatura» alle 14:02.
 *
 * Il progetto sta in `docs/CHAT.md`.
 */

const LIMITI = Object.freeze({
  /* Un messaggio piu' lungo di cosi' non e' una domanda, e' un incollaggio. */
  testo: 4000,
  nome: 60,
  etichetta: 40,
  /* Chi ne scrive piu' di venti in un'ora non sta chiedendo aiuto. */
  alOra: 20,
  /* Una chat di assistenza non e' un archivio: oltre questi, i piu' vecchi se
   * ne vanno. */
  storia: 200,
  /* Quanti ne torna una lettura, al massimo. */
  pagina: 100,
  /* Una linea ferma da sei mesi si cancella, conversazione compresa. */
  silenzio: 180 * 24 * 60 * 60 * 1000,
});

const ORA = 60 * 60 * 1000;

/* ─── Le risposte ────────────────────────────────────────────────────────── */

const json = (corpo, stato = 200) =>
  new Response(JSON.stringify(corpo), {
    status: stato,
    headers: {
      "content-type": "application/json; charset=utf-8",
      /* Il browser qui non ci arriva mai: parla Python, dal backend di Home
       * Assistant. Niente CORS da concedere, quindi non se ne concede. */
      "cache-control": "no-store",
    },
  });

const male = (stato, perche) => json({ errore: perche }, stato);

/* ─── Le cose che arrivano da fuori ──────────────────────────────────────── */

const testoPulito = (valore, massimo) =>
  typeof valore === "string" ? valore.trim().slice(0, massimo) : "";

/* Un identificativo di linea e' esattamente quello che la casa si fabbrica:
 * `casa_` e trentadue cifre esadecimali. Tutto il resto non e' una linea, e non
 * vale la pena chiederlo al database. */
const LINEA_VALIDA = /^casa_[0-9a-f]{32}$/;

/* Il segreto non si confronta mai con `===`: due stringhe si confrontano in un
 * tempo che dipende da quanto si somigliano, e da quel tempo si ricava il
 * segreto una lettera per volta. */
function stessoSegreto(uno, due) {
  const a = new TextEncoder().encode(String(uno || ""));
  const b = new TextEncoder().encode(String(due || ""));
  if (a.length !== b.length) return false;
  let differenza = 0;
  for (let i = 0; i < a.length; i += 1) differenza |= a[i] ^ b[i];
  return differenza === 0;
}

async function impronta(segreto) {
  const dati = new TextEncoder().encode(String(segreto || ""));
  const somma = await crypto.subtle.digest("SHA-256", dati);
  return [...new Uint8Array(somma)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function chiaveDellaRichiesta(richiesta) {
  const intestazione = richiesta.headers.get("authorization") || "";
  const trovato = /^Bearer\s+(.+)$/i.exec(intestazione.trim());
  return trovato ? trovato[1].trim() : "";
}

/* ─── Chi bussa allo sportello della casa ────────────────────────────────── */

/* Riconoscere una linea, e aprirla la prima volta che qualcuno scrive.
 *
 * Una linea nasce **solo con un messaggio**, mai con una lettura. Se nascesse
 * leggendo, chiunque potrebbe fabbricarne un milione con un milione di GET
 * senza aver mai detto niente, e il centralino sarebbe pieno di stanze vuote.
 * Cosi' invece per aprirne una bisogna scrivere, e da li' in poi vale il limite
 * dei venti messaggi all'ora.
 *
 * Chi arrivasse per secondo su un identificativo gia' preso trova la porta
 * chiusa, ed e' giusto cosi': quell'identificativo e' 128 bit di caso, e chi lo
 * indovina non lo ha indovinato.
 *
 * Torna `null` se il segreto non e' quello, `"assente"` se la linea non c'e'
 * ancora. */
async function riconosci(env, id, segreto) {
  const esistente = await env.DB.prepare("SELECT segreto FROM linee WHERE id = ?")
    .bind(id)
    .first();
  if (!esistente) return "assente";
  return stessoSegreto(esistente.segreto, await impronta(segreto)) ? "aperta" : null;
}

async function apriLaLinea(env, id, segreto, note) {
  const adesso = Date.now();
  await env.DB.prepare(
    `INSERT INTO linee (id, segreto, nome, versione, ha, lingua, aperta_il, vista_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, await impronta(segreto), note.nome, note.versione, note.ha, note.lingua, adesso, adesso)
    .run();
}

/* Le tre note si riscrivono a ogni giro: la plancia si aggiorna, e una
 * conversazione che dice «1.4.2» quando la casa e' alla 1.4.5 fa perdere tempo
 * a tutti e due. Il nome si riscrive solo se e' stato dato: un campo lasciato
 * vuoto non cancella quello di ieri. */
async function aggiornaLeNote(env, id, note) {
  await env.DB.prepare(
    `UPDATE linee SET vista_il = ?, versione = ?, ha = ?, lingua = ?,
       nome = CASE WHEN ? <> '' THEN ? ELSE nome END
     WHERE id = ?`,
  )
    .bind(Date.now(), note.versione, note.ha, note.lingua, note.nome, note.nome, id)
    .run();
}

async function troppiMessaggi(env, id) {
  const da = Date.now() - ORA;
  const riga = await env.DB.prepare(
    "SELECT COUNT(*) AS quanti FROM messaggi WHERE linea = ? AND da = 'casa' AND scritto_il > ?",
  )
    .bind(id, da)
    .first();
  return Number(riga?.quanti || 0) >= LIMITI.alOra;
}

/* La storia si accorcia da sola, e si accorcia qui invece che in un giro
 * notturno: il momento in cui una conversazione diventa troppo lunga e' il
 * momento in cui le si aggiunge una riga. */
async function sfoltisci(env, id) {
  await env.DB.prepare(
    `DELETE FROM messaggi WHERE linea = ? AND id NOT IN (
       SELECT id FROM messaggi WHERE linea = ? ORDER BY id DESC LIMIT ?
     )`,
  )
    .bind(id, id, LIMITI.storia)
    .run();
}

async function scrivi(env, id, da, testo) {
  const adesso = Date.now();
  const messo = await env.DB.prepare(
    "INSERT INTO messaggi (linea, da, testo, scritto_il) VALUES (?, ?, ?, ?) RETURNING id",
  )
    .bind(id, da, testo, adesso)
    .first();
  await sfoltisci(env, id);
  return { id: Number(messo?.id || 0), da, testo, scritto_il: adesso };
}

async function messaggiDopo(env, id, dopo) {
  const righe = await env.DB.prepare(
    "SELECT id, da, testo, scritto_il FROM messaggi WHERE linea = ? AND id > ? ORDER BY id LIMIT ?",
  )
    .bind(id, dopo, LIMITI.pagina)
    .all();
  return righe?.results || [];
}

/* ─── Lo sportello della casa ────────────────────────────────────────────── */

async function sportelloDellaCasa(richiesta, env, url) {
  const id = testoPulito(richiesta.headers.get("x-casa"), 64);
  if (!LINEA_VALIDA.test(id)) return male(400, "linea non valida");
  const segreto = chiaveDellaRichiesta(richiesta);
  if (segreto.length < 32) return male(401, "segreto mancante");

  let corpo = {};
  if (richiesta.method === "POST") {
    try {
      corpo = await richiesta.json();
    } catch {
      return male(400, "corpo illeggibile");
    }
  }

  const note = {
    nome: testoPulito(corpo?.nome ?? richiesta.headers.get("x-nome"), LIMITI.nome),
    versione: testoPulito(richiesta.headers.get("x-versione"), LIMITI.etichetta),
    ha: testoPulito(richiesta.headers.get("x-ha"), LIMITI.etichetta),
    lingua: testoPulito(richiesta.headers.get("x-lingua"), 12),
  };

  const stato = await riconosci(env, id, segreto);
  if (stato === null) return male(403, "segreto sbagliato");

  if (richiesta.method === "POST") {
    const testo = testoPulito(corpo?.testo, LIMITI.testo);
    if (!testo) return male(400, "messaggio vuoto");
    if (stato === "assente") await apriLaLinea(env, id, segreto, note);
    else {
      if (await troppiMessaggi(env, id)) return male(429, "troppi messaggi in un'ora");
      await aggiornaLeNote(env, id, note);
    }
    const messaggio = await scrivi(env, id, "casa", testo);
    return json({ messaggio });
  }

  /* Da qui in giu' la linea deve esserci gia': non si legge e non si cancella
   * una conversazione che nessuno ha ancora aperto. */
  if (stato === "assente") return json({ messaggi: [], aperta: false });

  /* Cancellare vuol dire cancellare: la linea sparisce dal centralino, non solo
   * dallo schermo di chi l'ha chiesto. */
  if (richiesta.method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM messaggi WHERE linea = ?").bind(id),
      env.DB.prepare("DELETE FROM linee WHERE id = ?").bind(id),
    ]);
    return json({ cancellata: true });
  }

  if (richiesta.method !== "GET") return male(405, "metodo non previsto");

  await aggiornaLeNote(env, id, note);
  const dopo = Number(url.searchParams.get("dopo") || 0) || 0;
  const messaggi = await messaggiDopo(env, id, dopo);
  /* Leggere e' aver letto: chi apre la propria conversazione ha visto quello
   * che c'era, e il pallino si spegne qui invece che con una chiamata in piu'. */
  const ultimo = messaggi.length ? messaggi[messaggi.length - 1].id : 0;
  if (ultimo) {
    await env.DB.prepare("UPDATE linee SET letto_casa = MAX(letto_casa, ?) WHERE id = ?")
      .bind(ultimo, id)
      .run();
  }
  return json({ messaggi, aperta: true });
}

/* ─── Lo sportello della console ─────────────────────────────────────────── */

async function sportelloDellaConsole(richiesta, env, url) {
  const chiave = chiaveDellaRichiesta(richiesta);
  if (!env.CHIAVE_CONSOLE || !stessoSegreto(chiave, env.CHIAVE_CONSOLE)) {
    return male(403, "chiave sbagliata");
  }

  const pezzi = url.pathname.split("/").filter(Boolean);
  const linea = pezzi[2] ? testoPulito(pezzi[2], 64) : "";

  /* L'elenco: una riga per linea, con l'ultima cosa detta e quante non lette.
   * Il testo intero non serve a decidere quale aprire, il primo pezzo si'. */
  if (!linea) {
    const righe = await env.DB.prepare(
      `SELECT l.id, l.nome, l.versione, l.ha, l.lingua, l.aperta_il, l.vista_il,
              l.letto_console,
              (SELECT COUNT(*) FROM messaggi m
                WHERE m.linea = l.id AND m.da = 'casa' AND m.id > l.letto_console) AS non_letti,
              (SELECT m.testo FROM messaggi m
                WHERE m.linea = l.id ORDER BY m.id DESC LIMIT 1) AS ultimo,
              (SELECT m.scritto_il FROM messaggi m
                WHERE m.linea = l.id ORDER BY m.id DESC LIMIT 1) AS ultimo_il
         FROM linee l
        ORDER BY ultimo_il DESC NULLS LAST
        LIMIT ?`,
    )
      .bind(LIMITI.pagina)
      .all();
    const conversazioni = (righe?.results || []).map((riga) => ({
      ...riga,
      ultimo: testoPulito(riga.ultimo, 160),
    }));
    return json({ conversazioni });
  }

  if (!LINEA_VALIDA.test(linea)) return male(400, "linea non valida");

  if (richiesta.method === "POST") {
    let corpo = {};
    try {
      corpo = await richiesta.json();
    } catch {
      return male(400, "corpo illeggibile");
    }
    const testo = testoPulito(corpo?.testo, LIMITI.testo);
    if (!testo) return male(400, "messaggio vuoto");
    const esiste = await env.DB.prepare("SELECT id FROM linee WHERE id = ?").bind(linea).first();
    if (!esiste) return male(404, "linea sconosciuta");
    const messaggio = await scrivi(env, linea, "console", testo);
    return json({ messaggio });
  }

  if (richiesta.method !== "GET") return male(405, "metodo non previsto");

  const dopo = Number(url.searchParams.get("dopo") || 0) || 0;
  const messaggi = await messaggiDopo(env, linea, dopo);
  const ultimo = messaggi.length ? messaggi[messaggi.length - 1].id : 0;
  if (ultimo) {
    await env.DB.prepare("UPDATE linee SET letto_console = MAX(letto_console, ?) WHERE id = ?")
      .bind(ultimo, linea)
      .run();
  }
  return json({ messaggi });
}

/* ─── La porta ───────────────────────────────────────────────────────────── */

export default {
  async fetch(richiesta, env) {
    const url = new URL(richiesta.url);
    try {
      if (url.pathname === "/salute") return json({ vivo: true });
      if (url.pathname === "/casa/messaggi") return await sportelloDellaCasa(richiesta, env, url);
      if (url.pathname === "/console/conversazioni" || url.pathname.startsWith("/console/conversazioni/")) {
        return await sportelloDellaConsole(richiesta, env, url);
      }
      return male(404, "non c'e' niente qui");
    } catch (errore) {
      /* Il motivo vero resta nei log del Worker: quello che esce di qui non
       * deve raccontare com'e' fatto il database a chi bussa a caso. */
      console.error("centralino", errore?.stack || String(errore));
      return male(500, "il centralino non ce l'ha fatta");
    }
  },

  /* Le linee che non parlano da sei mesi se ne vanno, e con loro tutto quello
   * che avevano detto. Tenere per sempre le parole di chi non torna piu' non
   * serve a nessuno dei due. */
  async scheduled(_evento, env) {
    const limite = Date.now() - LIMITI.silenzio;
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM messaggi WHERE linea IN (SELECT id FROM linee WHERE vista_il < ?)",
      ).bind(limite),
      env.DB.prepare("DELETE FROM linee WHERE vista_il < ?").bind(limite),
    ]);
  },
};

export const perLeProve = { LIMITI, LINEA_VALIDA, impronta, stessoSegreto, testoPulito };
