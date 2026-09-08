/* La porta e il cancello sono due cose diverse.
 *
 * Segnalato con una schermata: nelle Azioni rapide «Door Piscina Spa» aveva
 * l'icona del cancello, identica a quella del cancello vero due riquadri piu'
 * in la'. «L'icona della porta non compare piu'» — ed era esattamente cosi':
 * non c'era. Nel catalogo esisteva solo il cancello, e si teneva l'emoji della
 * porta, 🚪. Chi configurava una porta finiva sul cancello, che e' l'unica cosa
 * che quel simbolo sapesse trovare.
 *
 * La prova sorveglia due cose che devono restare vere insieme: che la porta
 * esista e si disegni, e che nessun altro comando le riprenda il simbolo. La
 * seconda conta quanto la prima — un catalogo dove due comandi diversi
 * rispondono allo stesso simbolo e' esattamente il difetto di partenza, e si
 * ripresenta la prossima volta che qualcuno aggiunge un portone.
 *
 * Le stanze, arrivate dopo nello stesso catalogo, hanno un patto loro: l'emoji
 * per loro e' solo un ripiego, e il ripiego non si deve vedere mai.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_ICON_CATALOG,
  actionCatalogMatch,
} from "../src/core/personalization-catalog.js";
import {
  chiaveDelDisegno,
  chiaviDaProvare,
  disegnoDelCatalogo,
} from "../src/core/catalogo-disegni.js";
import { canonicalArtworkType } from "../src/core/appliance-artwork.js";

const voce = (id) => ACTION_ICON_CATALOG.find((item) => item.id === id);

test("la porta c'e', e si chiama porta", () => {
  const porta = voce("door");
  assert.ok(porta, "il catalogo delle azioni non ha la porta");
  assert.equal(porta.it, "Porta");
  assert.equal(porta.en, "Door");
});

test("il cancello non tiene piu' per se' il simbolo della porta", () => {
  assert.equal(voce("door").glyph, "🚪");
  assert.notEqual(
    voce("gate").glyph,
    "🚪",
    "con lo stesso simbolo su due voci vince la prima, e chi cerca una porta trova un cancello",
  );
});

test("nessun comando delle azioni divide il simbolo con un altro", () => {
  const doppi = [];
  const visti = new Map();
  for (const item of ACTION_ICON_CATALOG.filter((voce) => voce.group !== "room")) {
    if (visti.has(item.glyph)) doppi.push(`${item.glyph}: ${visti.get(item.glyph)} e ${item.id}`);
    visti.set(item.glyph, item.id);
  }
  /* Il gruppo di luci e la luce sono la stessa lampadina di proposito: e' un
   * gruppo di quella cosa li', non un'altra cosa. */
  assert.deepEqual(
    doppi.filter((riga) => !riga.includes("lights-group")),
    [],
    `due voci rispondono allo stesso simbolo:\n  ${doppi.join("\n  ")}`,
  );
});

/* Le stanze, entrate nelle azioni per la richiesta «vorrei poter associare una
 * luce a un'icona che mi ricordi una stanza», l'emoji ce l'hanno solo come
 * ripiego, e qualcuna la divide per forza con un comando: la camera e il letto
 * sono lo stesso letto. Il patto non e' quindi che i simboli siano tutti
 * diversi — e' che il ripiego non si veda mai, perche' ogni stanza il suo
 * disegno di casa ce l'ha. */
test("ogni stanza fra le azioni si disegna, senza ripiegare sull'emoji", () => {
  const stanze = ACTION_ICON_CATALOG.filter((voce) => voce.group === "room");
  assert.ok(stanze.length >= 20, `le stanze non sono arrivate nelle azioni: ${stanze.length}`);
  const senza = stanze
    .filter(
      (voce) =>
        !chiaviDaProvare("action", voce.mdi, actionCatalogMatch(voce.mdi)).some(
          (chiave) => canonicalArtworkType(chiave) || disegnoDelCatalogo(chiave, 36),
        ),
    )
    .map((voce) => `${voce.id} (${voce.mdi})`);
  assert.deepEqual(senza, [], `stanze senza disegno:\n  ${senza.join("\n  ")}`);
});

test("la porta si disegna, comunque la si chiami", () => {
  for (const nome of ["door", "porta", "mdi:door", "mdi:door-closed", "ingresso"])
    assert.equal(chiaveDelDisegno(nome), "door", `«${nome}» non arriva alla porta`);
  assert.match(disegnoDelCatalogo("porta"), /<svg/);
});

test("il cancello resta il cancello", () => {
  /* Chi aveva gia' un cancello configurato non deve ritrovarsi una porta. */
  for (const nome of ["gate", "cancello", "mdi:gate"])
    assert.equal(chiaveDelDisegno(nome), "gate", `«${nome}» non arriva piu' al cancello`);
  assert.notEqual(disegnoDelCatalogo("porta"), disegnoDelCatalogo("cancello"));
});
