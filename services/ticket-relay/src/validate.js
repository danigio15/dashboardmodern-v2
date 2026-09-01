/*
 * Quello che il relay accetta, e quello che rifiuta.
 *
 * Sta in un file suo perche' e' la parte che va provata: il resto e' D1 e
 * routing, che senza un runtime Workers non si esercita. Qui invece ci sono le
 * decisioni — cosa e' un ticket valido, quanto puo' essere lungo, come si
 * confronta una chiave — e si provano con `node --test` e basta.
 *
 * I tetti sono gli stessi di `ticket_store.py`. Ripetuti apposta: il relay non
 * si fida del fatto che dall'altra parte ci sia una plancia che li rispetta.
 * L'endpoint sta dentro codice sorgente pubblico, quindi e' pubblico, e chi lo
 * chiama puo' non essere una plancia affatto.
 */

export const LIMITI = Object.freeze({
  installation: 64,
  type: 16,
  title: 120,
  body: 4000,
  contact: 190,
  reply: 4000,
  diagnosticKey: 40,
  diagnosticValue: 190,
  diagnosticKeys: 12,
  syncIds: 200,
});

export const TIPI = Object.freeze(["bug", "feature", "assistenza"]);
export const STATI = Object.freeze(["inviato", "in-carico", "risolto", "chiuso"]);

/* La stessa lista chiusa del backend. Una chiave che l'integrazione non manda
 * non deve poter entrare comunque da qui: chi chiama non e' per forza una
 * plancia, e questo e' il punto in cui una fantasia diventa una riga nel
 * database del manutentore. */
export const DIAGNOSTIC_KEYS = Object.freeze([
  "ha_version",
  "installation_method",
  "integration_version",
  "locale",
  "panel_section",
  "user_agent",
]);

function testo(valore, tetto) {
  if (typeof valore !== "string") return "";
  const pulito = [...valore].filter((ch) => ch >= " " || ch === "\n").join("");
  return pulito.trim().slice(0, tetto);
}

function unaRiga(valore, tetto) {
  return testo(valore, tetto).replaceAll("\n", " ");
}

export function normalizzaDiagnostica(grezza) {
  if (!grezza || typeof grezza !== "object" || Array.isArray(grezza)) return {};
  const pulita = {};
  for (const chiave of DIAGNOSTIC_KEYS) {
    if (!(chiave in grezza)) continue;
    const valore = unaRiga(String(grezza[chiave] ?? ""), LIMITI.diagnosticValue);
    if (valore) pulita[chiave] = valore;
    if (Object.keys(pulita).length >= LIMITI.diagnosticKeys) break;
  }
  return pulita;
}

/**
 * Un ticket in arrivo, ridotto a quello che il relay conserva.
 *
 * Torna `{ ok: true, ticket }` oppure `{ ok: false, errore }`: il chiamante
 * non deve indovinare guardando i campi.
 */
export function normalizzaTicket(grezzo) {
  if (!grezzo || typeof grezzo !== "object" || Array.isArray(grezzo)) {
    return { ok: false, errore: "payload" };
  }
  const installation = unaRiga(grezzo.installation, LIMITI.installation);
  /* Solo esadecimale: e' quello che l'integrazione genera (`uuid4().hex`), e
   * tenerlo stretto vuol dire che nessuno usa questo campo per infilare
   * qualcos'altro dentro le chiavi del limite. */
  if (!/^[0-9a-f]{8,64}$/.test(installation)) {
    return { ok: false, errore: "installation" };
  }
  const type = unaRiga(grezzo.type, LIMITI.type);
  if (!TIPI.includes(type)) return { ok: false, errore: "type" };
  const title = unaRiga(grezzo.title, LIMITI.title);
  if (!title) return { ok: false, errore: "title" };
  const body = testo(grezzo.body, LIMITI.body);
  if (!body) return { ok: false, errore: "body" };
  return {
    ok: true,
    ticket: {
      installation,
      type,
      title,
      body,
      contact: unaRiga(grezzo.contact, LIMITI.contact),
      diagnostics: normalizzaDiagnostica(grezzo.diagnostics),
    },
  };
}

/** Gli identificativi di cui una plancia puo' chiedere lo stato. */
export function normalizzaIds(grezzi) {
  if (!Array.isArray(grezzi)) return [];
  const visti = new Set();
  for (const grezzo of grezzi) {
    const id = unaRiga(grezzo, 64);
    if (/^[0-9a-f]{8,64}$/.test(id)) visti.add(id);
    if (visti.size >= LIMITI.syncIds) break;
  }
  return [...visti];
}

/** Una risposta del manutentore: stato, testo, e se promuoverla a issue. */
export function normalizzaRisposta(grezza) {
  if (!grezza || typeof grezza !== "object") return { ok: false, errore: "payload" };
  const remoteId = unaRiga(grezza.remote_id, 64);
  if (!/^[0-9a-f]{8,64}$/.test(remoteId)) return { ok: false, errore: "remote_id" };
  const stato = unaRiga(grezza.state, 32);
  if (stato && !STATI.includes(stato)) return { ok: false, errore: "state" };
  return {
    ok: true,
    risposta: {
      remoteId,
      stato,
      reply: testo(grezza.reply, LIMITI.reply),
      promote: grezza.promote === true,
    },
  };
}

/**
 * Confronto che non racconta dov'e' la prima differenza.
 *
 * Un `===` fra stringhe esce al primo carattere diverso, e chi misura i tempi
 * puo' ricostruire la chiave un carattere per volta. Qui il costo non dipende
 * dal contenuto, solo dalla lunghezza — che di per se' non e' un segreto.
 */
export function chiaveCorrisponde(offerta, attesa) {
  if (typeof offerta !== "string" || typeof attesa !== "string") return false;
  if (!attesa) return false;
  if (offerta.length !== attesa.length) return false;
  let differenza = 0;
  for (let indice = 0; indice < attesa.length; indice += 1) {
    differenza |= offerta.charCodeAt(indice) ^ attesa.charCodeAt(indice);
  }
  return differenza === 0;
}

/** La chiave portata dall'intestazione, senza il prefisso. */
export function chiaveDaIntestazione(intestazione) {
  if (typeof intestazione !== "string") return "";
  const trovata = /^Bearer\s+(\S+)$/.exec(intestazione.trim());
  return trovata ? trovata[1] : "";
}

/**
 * Il corpo della issue pubblica, quando un ticket viene promosso.
 *
 * Il contatto non c'e', e non e' una dimenticanza: chi ha scritto il proprio
 * indirizzo lo ha scritto a una persona, non a un tracker indicizzato dai
 * motori di ricerca. Nemmeno l'identificativo dell'installazione: in pubblico
 * non serve a niente e lega fra loro segnalazioni che chi le ha aperte non ha
 * chiesto di legare.
 */
export function corpoIssue(ticket) {
  const righe = [ticket.body || "", ""];
  const diagnostica = ticket.diagnostics || {};
  const voci = Object.entries(diagnostica).filter(([, valore]) => valore);
  if (voci.length) {
    righe.push("<details><summary>Diagnostica</summary>", "");
    for (const [chiave, valore] of voci) righe.push(`- **${chiave}**: ${valore}`);
    righe.push("", "</details>", "");
  }
  righe.push(`_Aperta dalla plancia · ${ticket.id || ""}_`);
  return righe.join("\n");
}

/** Il titolo della issue, col prefisso che i template gia' usano. */
export function titoloIssue(ticket) {
  const prefisso = ticket.type === "feature" ? "[Feature]" : "[Bug]";
  return `${prefisso}: ${ticket.title}`.slice(0, 240);
}
