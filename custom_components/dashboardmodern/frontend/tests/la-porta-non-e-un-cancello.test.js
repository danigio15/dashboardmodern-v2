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
 * esista e si disegni, e che nessun altro le riprenda il simbolo. La seconda
 * conta quanto la prima — un catalogo dove due voci diverse rispondono allo
 * stesso simbolo e' esattamente il difetto di partenza, e si ripresenta la
 * prossima volta che qualcuno aggiunge un portone.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ACTION_ICON_CATALOG } from "../src/core/personalization-catalog.js";
import { chiaveDelDisegno, disegnoDelCatalogo } from "../src/core/catalogo-disegni.js";

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

test("nessuna voce delle azioni divide il simbolo con un'altra", () => {
  const doppi = [];
  const visti = new Map();
  for (const item of ACTION_ICON_CATALOG) {
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
