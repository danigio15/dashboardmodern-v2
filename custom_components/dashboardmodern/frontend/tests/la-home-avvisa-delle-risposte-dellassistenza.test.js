/* «Gestisci una sorta di widget avviso che, se si ricevono messaggi nella
 *  chat assistenza, compare nella home.»
 *
 * La chat sta dietro una card della Configurazione: una risposta arrivata
 * mentre nessuno guardava li' era un pallino su una pagina che non si apre
 * tutti i giorni. Adesso e' una tessera in Home, che compare con la prima
 * risposta da leggere e se ne va quando la finestra si apre. E il pallino, che
 * si spegneva da solo a ogni ricarica della pagina, adesso resta acceso finche'
 * qualcuno legge davvero.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const magazzino = new Map();
globalThis.localStorage = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.document = undefined;

const {
  ANTEPRIMA_MAX,
  CHIAVE_TESSERA,
  EVENTO_DI_CASA,
  EVENTO_STATO,
  anteprima,
  eUnEventoDellaChat,
  paroleDelleRisposte,
  statoDellaChat,
  tesseraDellaChat,
} = await import("../src/core/avviso-chat.js");
const { ALLOWED_MESSAGE_TYPES } = await import("../src/legacy/bridge-socket.js");
const assistenza = await import("../src/sections/assistenza-section.js");
const { applyWidgetPreferences, widgetPreferences } = await import(
  "../src/sections/home-widgets-section.js"
);

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const leggi = (relativo) => readFileSync(join(RADICE, relativo), "utf8");

test("la tessera c'e' solo con una risposta da leggere, e chiede attenzione", () => {
  assert.equal(tesseraDellaChat({ enabled: true, unread: 0 }), null);
  assert.equal(tesseraDellaChat({ enabled: false, unread: 3 }), null, "chat spenta: niente tessera");
  assert.equal(tesseraDellaChat(null), null);
  const una = tesseraDellaChat({
    enabled: true,
    unread: 1,
    preview: "Prova ad alzare la soglia.",
    written_at: 1725400000000,
  });
  assert.equal(una.label, "Assistenza");
  assert.equal(una.key, CHIAVE_TESSERA);
  assert.equal(una.key, "assistenza");
  assert.equal(una.value, "1");
  assert.equal(una.caption, "Prova ad alzare la soglia.");
  assert.equal(una.alert, true, "e' un avviso: si accende e sta fra chi chiede attenzione");
  assert.equal(una.attiva, true);
  assert.equal(una.risposte, 1);
  assert.equal(una.anteprima, "Prova ad alzare la soglia.");
  assert.equal(una.scrittoIl, 1725400000000);
  assert.equal(una.icon, "💬");
});

test("senza anteprima la didascalia conta le risposte, al singolare e al plurale", () => {
  assert.equal(tesseraDellaChat({ enabled: true, unread: 1 }).caption, "1 risposta nuova");
  assert.equal(tesseraDellaChat({ enabled: true, unread: 4 }).caption, "4 risposte nuove");
  assert.equal(paroleDelleRisposte(0), "0 risposte nuove");
  assert.equal(paroleDelleRisposte("2"), "2 risposte nuove");
});

test("l'anteprima sta su una riga e si chiude coi puntini", () => {
  assert.equal(anteprima("  Ciao,\n\n  ho  guardato. "), "Ciao, ho guardato.");
  assert.equal(anteprima("abcdefgh", 5), "abcd…");
  assert.equal(anteprima("abcde", 5), "abcde");
  assert.equal(anteprima("a".repeat(ANTEPRIMA_MAX + 10)).length, ANTEPRIMA_MAX);
  assert.equal(anteprima(null), "");
});

test("lo stato del backend si legge ripulito, e senza risposte non porta ne' frase ne' ora", () => {
  assert.deepEqual(statoDellaChat({ enabled: true, unread: "2", preview: " ciao ", written_at: "7" }), {
    enabled: true,
    unread: 2,
    preview: "ciao",
    writtenAt: 7,
  });
  assert.deepEqual(statoDellaChat({ enabled: true, unread: 0, preview: "vecchia", written_at: 9 }), {
    enabled: true,
    unread: 0,
    preview: "",
    writtenAt: 0,
  });
  assert.deepEqual(statoDellaChat({ enabled: 1, unread: -3 }), {
    enabled: true,
    unread: 0,
    preview: "",
    writtenAt: 0,
  });
  assert.equal(statoDellaChat(undefined).enabled, false);
});

test("l'evento e' quello che il backend spara sul bus di casa, e la risposta «sottoscritto» non lo e'", () => {
  assert.equal(EVENTO_DI_CASA, "dashboardmodern_chat");
  const costanti = leggi("../const.py");
  assert.match(costanti, /EVENT_CHAT_MESSAGE = f"\{DOMAIN\}_chat"/);
  assert.equal(eUnEventoDellaChat({ id: 3, type: "event", event: { event_type: "dashboardmodern_chat" } }), true);
  assert.equal(eUnEventoDellaChat({ id: 3, type: "result", success: true, result: null }), false);
  assert.equal(eUnEventoDellaChat({ id: 3, type: "event", event: { event_type: "state_changed" } }), false);
  assert.equal(eUnEventoDellaChat(null), false);
  /* La sottoscrizione passa dal ponte del pannello come le altre. */
  assert.ok(ALLOWED_MESSAGE_TYPES.includes("subscribe_events"));
});

test("la sezione della chat espone lo stato alla Home e lo annuncia quando cambia", () => {
  assert.deepEqual(assistenza.statoDellaChat(), { enabled: false, unread: 0, preview: "", writtenAt: 0 });
  assert.equal(assistenza.inAscolto(), false, "senza il socket del guscio non si ascolta");
  const sorgente = leggi("src/sections/assistenza-section.js");
  assert.equal(EVENTO_STATO, "dashboardmodern:chat-stato");
  assert.match(sorgente, /new CustomEvent\(EVENTO_STATO, \{ detail: adesso \}\)/);
  assert.match(sorgente, /if \(firma === ultimoAnnuncio\) return false;/, "una volta per cambiamento");
  assert.match(sorgente, /type: "subscribe_events", event_type: EVENTO_DI_CASA/);
  assert.match(sorgente, /gestore\.keepAlive = true;/);
  assert.match(sorgente, /"dashboardmodern:state-changed", controllaLOrecchio/, "l'orecchio si ricontrolla dopo una riconnessione");
  assert.match(sorgente, /closest\?\.\("\[data-dm-apri-chat\]"\)\) apri\(\);/, "la porta dalla Home apre la finestra");
});

test("all'avvio si legge lo stato, non il filo: leggere il filo e' averlo letto", () => {
  const sorgente = leggi("src/sections/assistenza-section.js");
  const install = sorgente.slice(sorgente.indexOf("export function installAssistenzaSection"));
  const prova = /const prova = \(\) => \{([\s\S]*?)\};/.exec(install)?.[1] || "";
  assert.match(prova, /ricaricaStato\(\);/);
  assert.doesNotMatch(prova, /\bricarica\(\)/, "il filo si legge quando la finestra si apre");
  assert.doesNotMatch(prova, /caricaFilo/);
  /* Aprire la finestra invece legge davvero, e il backend sposta il segnalibro. */
  assert.match(sorgente, /export function apri\(\) \{[\s\S]*?ricarica\(\);/);
  assert.match(sorgente, /async function ricarica\(\) \{\s*await ricaricaStato\(\);/);
  /* Il backend da' anche l'ultima risposta non letta, senza toccare il segnalibro. */
  const chat = leggi("../chat.py");
  assert.match(chat, /"preview": str\(ultima\.get\("testo"\) or ""\)\.strip\(\)\[:200\],/);
  assert.match(chat, /"written_at": int\(ultima\.get\("scritto_il"\) or 0\),/);
});

test("la Home disegna la tessera, la ridisegna all'annuncio, e la sua finestra porta alla chat", () => {
  const home = leggi("src/sections/home-widgets-section.js");
  assert.match(home, /function chatModel\(\) \{\s*return tesseraDellaChat\(statoDellaChat\(\)\);/);
  /* Per prima: e' una risposta a chi ha chiesto aiuto. */
  assert.match(home, /chatModel\(\),\s*\.\.\.evidenzaModels\(states\),\s*segnalazioniModel\(\),/);
  assert.match(home, /"dashboardmodern:chat-stato",\s*\]\)\s*root\.addEventListener\?\.\(eventName, schedule\);/);
  assert.match(home, /if \(widget\.key === "assistenza"\) return chatDetail\(widget\);/);
  assert.match(home, /class="dm-w-porta" data-dm-apri-chat/);
  /* Il popup della tessera si chiude quando si apre la chat: stanno sullo
   * stesso piano, e la piu' giovane coprirebbe l'altra. */
  assert.match(home, /closest\?\.\("\[data-dm-apri-cruscotto\],\[data-dm-apri-chat\]"\)\) chiudiPopup\(\);/);
  /* Si ordina e si nasconde dalla scheda Widget come le altre. */
  const editor = leggi("src/sections/todo-editor-section.js");
  assert.match(editor, /return \[\s*(?:\/\*[\s\S]*?\*\/\s*)?\["assistenza", "💬", t\("Assistenza", "Support"\)\],\s*\["evidenza"/);
  magazzino.set("cd_widgets", JSON.stringify({ hidden: ["assistenza"] }));
  const tessera = tesseraDellaChat({ enabled: true, unread: 1 });
  assert.deepEqual(applyWidgetPreferences([tessera, { key: "luci" }]).map((w) => w.key), ["luci"]);
  magazzino.delete("cd_widgets");
  assert.deepEqual(applyWidgetPreferences([tessera, { key: "luci" }]).map((w) => w.key), ["assistenza", "luci"]);
});

test("di serie sta per prima, anche per chi aveva gia' salvato un ordine senza di lei", () => {
  const tessera = tesseraDellaChat({ enabled: true, unread: 1 });
  magazzino.set("cd_widgets", JSON.stringify({ order: ["luci", "clima"] }));
  /* L'ordine salvato resta com'e': e' il rango a metterla davanti. */
  assert.deepEqual(widgetPreferences().order, ["luci", "clima"]);
  assert.deepEqual(
    applyWidgetPreferences([{ key: "clima" }, { key: "luci" }, tessera]).map((w) => w.key),
    ["assistenza", "luci", "clima"],
  );
  /* Chi la sposta apposta viene ascoltato. */
  magazzino.set("cd_widgets", JSON.stringify({ order: ["luci", "assistenza", "clima"] }));
  assert.deepEqual(widgetPreferences().order, ["luci", "assistenza", "clima"]);
  assert.deepEqual(
    applyWidgetPreferences([{ key: "clima" }, { key: "luci" }, tessera]).map((w) => w.key),
    ["luci", "assistenza", "clima"],
  );
  magazzino.delete("cd_widgets");
  assert.deepEqual(widgetPreferences().order, []);
});
