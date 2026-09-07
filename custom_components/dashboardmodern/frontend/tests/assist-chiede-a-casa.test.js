/* «Vorrei avere la possibilità di aprire assist per chiedere delle cose sia
 * scrivendo che parlando.» (#360)
 *
 * La plancia non rifà un assistente — sarebbe un secondo assistente da tenere
 * allineato al primo — ma gli parla: la frase parte da qui, la capisce Home
 * Assistant, la risposta torna indietro.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CONVERSAZIONE_MS,
  assistAcceso,
  domandaPerHomeAssistant,
  filoDaMandare,
  filoDaRiannodare,
  linguaPerIlMicrofono,
  normalizzaAssist,
  rispostaDi,
} from "../src/core/assist-model.js";

test("la domanda è quella che Home Assistant si aspetta", () => {
  assert.deepEqual(
    domandaPerHomeAssistant({ testo: "accendi la luce", lingua: "it", conversazione: "abc" }),
    {
      type: "conversation/process",
      text: "accendi la luce",
      language: "it",
      conversation_id: "abc",
    },
  );
  // Le caselle vuote non si mandano: un agent_id vuoto non è «quello di serie».
  assert.deepEqual(domandaPerHomeAssistant({ testo: "ciao" }), {
    type: "conversation/process",
    text: "ciao",
  });
  assert.equal(domandaPerHomeAssistant({ testo: "   " }), null, "una frase vuota non è una domanda");
  assert.equal(domandaPerHomeAssistant({}), null);
});

test("l'assistente scelto viaggia con la domanda", () => {
  const richiesta = domandaPerHomeAssistant({
    testo: "che ore sono",
    agente: "conversation.openai",
  });
  assert.equal(richiesta.agent_id, "conversation.openai");
});

test("le tre cose che Assist sa dire non sono la stessa cosa", () => {
  /* Ha FATTO qualcosa, ha RISPOSTO a una domanda, oppure non ha capito: la
   * terza si disegna diversa, perché è l'unica in cui vale la pena riprovare. */
  const fatto = rispostaDi({
    conversation_id: "c1",
    response: { response_type: "action_done", speech: { plain: { speech: "Accesa" } } },
  });
  assert.deepEqual(fatto, {
    testo: "Accesa",
    tipo: "action_done",
    errore: false,
    conversazione: "c1",
    muta: false,
  });
  const risposta = rispostaDi({
    response: { response_type: "query_answer", speech: { plain: { speech: "Sono 21 gradi" } } },
  });
  assert.equal(risposta.tipo, "query_answer");
  const sbagliata = rispostaDi({
    response: { response_type: "error", speech: { plain: { speech: "Non ho capito" } } },
  });
  assert.equal(sbagliata.errore, true);
});

test("un comando riuscito in silenzio si dice lo stesso", () => {
  /* Senza parole non c'è niente da mostrare: lo si dice invece di lasciare una
   * riga vuota. */
  const muta = rispostaDi({ response: { response_type: "action_done" } });
  assert.equal(muta.muta, true);
  assert.equal(muta.testo, "");
  assert.equal(rispostaDi(null).muta, true);
  assert.equal(rispostaDi(undefined).tipo, "action_done");
});

test("il filo della conversazione dura cinque minuti", () => {
  /* Mandare un conversation_id scaduto vuol dire chiedere a Home Assistant di
   * ricordarsi una cosa che ha già buttato. */
  const inizio = 1_000_000;
  assert.equal(filoDaRiannodare(inizio, inizio + CONVERSAZIONE_MS - 1), false);
  assert.equal(filoDaRiannodare(inizio, inizio + CONVERSAZIONE_MS + 1), true);
  assert.equal(filoDaMandare("abc", inizio, inizio + 60_000), "abc");
  assert.equal(filoDaMandare("abc", inizio, inizio + 10 * 60_000), "");
  // Senza un «prima» si ricomincia.
  assert.equal(filoDaRiannodare(null, inizio), true);
  assert.equal(filoDaMandare("abc", 0, inizio), "");
});

test("la configurazione ha i valori giusti quando nessuno l'ha toccata", () => {
  const vuota = normalizzaAssist(null);
  assert.equal(vuota.agente, "", "vuoto vuol dire «quello di serie»");
  assert.equal(vuota.voce, false, "la voce è spenta: chi apre Assist di notte non vuole sentirla");
  assert.equal(vuota.tasto, true, "il tasto c'è: una funzione che non si trova non c'è");
  assert.equal(normalizzaAssist({ voce: true, tasto: false }).voce, true);
  assert.equal(normalizzaAssist({ tasto: false }).tasto, false);
  // I nomi inglesi si leggono lo stesso: è il formato che scrive il backend.
  assert.equal(normalizzaAssist({ agent_id: "conversation.x" }).agente, "conversation.x");
});

test("il microfono vuole la lingua per esteso", () => {
  /* «Sonoff» detto in italiano non è «Sonoff» detto in inglese. */
  assert.equal(linguaPerIlMicrofono("it"), "it-IT");
  assert.equal(linguaPerIlMicrofono("en"), "en-US");
  assert.equal(linguaPerIlMicrofono("pt-BR"), "pt-BR", "chi la scrive già per esteso la tiene");
  assert.equal(linguaPerIlMicrofono(""), "it-IT");
  assert.equal(linguaPerIlMicrofono("xx"), "xx", "una lingua che non conosciamo si passa com'è");
});

/* «Assist inoltre non è possibile disattivare da nessuna parte.»
 *
 * Spegnerlo si poteva, ma da una casella che si chiamava «il tasto in basso a
 * destra». Adesso lo dice l'elenco delle sezioni, come per ogni altra sezione
 * della plancia — e la casella di prima continua a contare per chi l'aveva già
 * tolta e non ha ancora toccato la fascia. */
test("Assist si spegne dall'elenco delle sezioni", () => {
  assert.equal(assistAcceso({}, {}), true, "di serie è acceso: si trova, quindi c'è");
  assert.equal(assistAcceso({ assist: false }, {}), false, "spento dalla fascia");
  assert.equal(assistAcceso({ assist: true }, {}), true);
  assert.equal(assistAcceso(undefined, undefined), true, "senza niente scritto, acceso");
});

test("chi aveva tolto il tasto resta senza Assist finché non dice altro", () => {
  // La scelta vecchia diceva la stessa cosa: vale finché la nuova non c'è.
  assert.equal(assistAcceso({}, { tasto: false }), false);
  // E la fascia la scavalca, in tutte e due i versi.
  assert.equal(assistAcceso({ assist: true }, { tasto: false }), true);
  assert.equal(assistAcceso({ assist: false }, { tasto: true }), false);
});
