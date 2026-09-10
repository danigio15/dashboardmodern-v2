/* «Sarebbe utile poter configurare più di un mini pc in modo da monitorare più
 * nodi, comodo per chi ha, ad esempio, un cluster proxmox.» (#470)
 *
 * La pagina Server aveva una scheda sola, ed è quella del computer su cui gira
 * Home Assistant: le sue barre sono cablate nel documento. Chi ha un cluster
 * però ha altri nodi, e di quelli la plancia vedeva le macchine (#382) ma non
 * il ferro che le regge.
 *
 * Gli entity_id qui sotto sono quelli che pubblica l'integrazione Proxmox VE.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  CAMPI_DEL_NODO,
  CHIAVE_NODI,
  NODI_MASSIMI,
  SOGLIE,
  bindNodoToDevice,
  entitaDeiNodi,
  letturaDelNodo,
  lettureDeiNodi,
  livelloDella,
  normalizzaNodi,
  normalizzaNodo,
  riassuntoDeiNodi,
} from "../src/core/nodi-del-cluster.js";

const stato = (state, attributes = {}) => ({ state, attributes });

const CLUSTER = {
  "binary_sensor.pve2_status": stato("on", {
    friendly_name: "pve2 Status",
    device_class: "connectivity",
  }),
  "sensor.pve2_cpu_used": stato("23.5", {
    friendly_name: "pve2 CPU used",
    unit_of_measurement: "%",
  }),
  "sensor.pve2_memory_used_percentage": stato("71", {
    friendly_name: "pve2 Memory used percentage",
    unit_of_measurement: "%",
  }),
  "sensor.pve2_disk_used_percentage": stato("93", {
    friendly_name: "pve2 Disk used percentage",
    unit_of_measurement: "%",
  }),
  "sensor.pve2_temperatura": stato("68", {
    friendly_name: "pve2 Temperatura",
    unit_of_measurement: "°C",
    device_class: "temperature",
  }),
  "binary_sensor.pve3_status": stato("off", { friendly_name: "pve3 Status" }),
};

test("dal dispositivo Proxmox escono le cinque caselle del nodo", () => {
  const entities = Object.keys(CLUSTER)
    .filter((id) => id.includes("pve2"))
    .map((entity_id) => ({ entity_id }));
  const nato = bindNodoToDevice({ device: { name: "pve2" }, entities, states: CLUSTER });
  assert.equal(nato.nome, "pve2");
  assert.equal(nato.stato, "binary_sensor.pve2_status");
  assert.equal(nato.cpu, "sensor.pve2_cpu_used");
  assert.equal(nato.ram, "sensor.pve2_memory_used_percentage");
  assert.equal(nato.disco, "sensor.pve2_disk_used_percentage");
  assert.equal(nato.temperatura, "sensor.pve2_temperatura");
});

test("un dispositivo che non è un nodo non porta niente", () => {
  const nato = bindNodoToDevice({
    device: { name: "Lampada" },
    entities: [{ entity_id: "light.salotto" }],
    states: {},
  });
  assert.deepEqual(
    CAMPI_DEL_NODO.filter((campo) => nato[campo]),
    [],
  );
});

test("il carico dice quando smette di essere normale", () => {
  /* Settanta è un nodo che lavora, novanta è un nodo senza più margine — ed è
   * lì che una migrazione fallisce. */
  assert.equal(SOGLIE.carico.alto, 70);
  assert.equal(SOGLIE.carico.critico, 90);
  assert.equal(livelloDella(23.5), "ok");
  assert.equal(livelloDella(71), "alto");
  assert.equal(livelloDella(93), "critico");
  /* Senza numero non c'è livello: una barra che non si sa non è una barra
   * verde. */
  assert.equal(livelloDella(null), "");
  assert.equal(livelloDella("non un numero"), "");
  /* I gradi hanno le loro soglie: settanta è caldo per un mini PC in un
   * mobile, ottantacinque è dove i processori si rallentano da soli. */
  assert.equal(livelloDella(68, SOGLIE.temperatura), "ok");
  assert.equal(livelloDella(88, SOGLIE.temperatura), "critico");
});

test("la lettura di un nodo porta nome, stato e le sue barre", () => {
  const nodo = normalizzaNodo({
    nome: "pve2",
    stato: "binary_sensor.pve2_status",
    cpu: "sensor.pve2_cpu_used",
    ram: "sensor.pve2_memory_used_percentage",
    disco: "sensor.pve2_disk_used_percentage",
    temperatura: "sensor.pve2_temperatura",
  });
  const lettura = letturaDelNodo(nodo, CLUSTER);
  assert.equal(lettura.nome, "pve2");
  assert.equal(lettura.acceso, true);
  assert.equal(lettura.muto, false);
  assert.equal(lettura.cpu.valore, 23.5);
  assert.equal(lettura.cpu.livello, "ok");
  assert.equal(lettura.disco.livello, "critico");
  assert.equal(lettura.temperatura.unita, "°C");
  /* Una casella vuota è una barra che non c'è, non una barra a zero. */
  const scarno = letturaDelNodo(normalizzaNodo({ nome: "pve3" }), CLUSTER);
  assert.equal(scarno.cpu, null);
  assert.equal(scarno.ram, null);
});

test("«spento» e «non risponde» sono due cose diverse, e «non si sa» è una terza", () => {
  const spento = letturaDelNodo({ stato: "binary_sensor.pve3_status" }, CLUSTER);
  assert.equal(spento.acceso, false);
  assert.equal(spento.muto, false);
  /* Un'entità che Home Assistant non conosce: è un problema di rete o di
   * configurazione, non un nodo che qualcuno ha fermato. */
  const muto = letturaDelNodo({ stato: "binary_sensor.mai_vista" }, CLUSTER);
  assert.equal(muto.acceso, null);
  assert.equal(muto.muto, true);
  /* E un nodo di cui nessuno ha indicato lo stato non è un nodo spento: è un
   * nodo di cui non lo si è chiesto, e dipingerlo di rosso sarebbe un allarme
   * inventato. */
  const senza = letturaDelNodo({ cpu: "sensor.pve2_cpu_used" }, CLUSTER);
  assert.equal(senza.acceso, null);
  assert.equal(senza.muto, false);
});

test("l'elenco tiene otto nodi, e una riga appena aggiunta non si butta via", () => {
  const troppi = Array.from({ length: 12 }, (_, i) => ({ nome: `pve${i}`, cpu: `sensor.c${i}` }));
  assert.equal(normalizzaNodi(troppi).length, NODI_MASSIMI);
  /* Due righe vuote restano tutt'e due: sono due righe aperte e non ancora
   * compilate, e buttarne via una vorrebbe dire che premere «Aggiungi» non fa
   * niente. */
  assert.equal(normalizzaNodi([{ nome: "" }, { nome: "" }]).length, 2);
  /* Lo stesso nodo due volte no. */
  assert.equal(normalizzaNodi([{ cpu: "sensor.a" }, { cpu: "sensor.a" }]).length, 1);
});

test("si disegnano solo i nodi che hanno almeno un'entità", () => {
  const letture = lettureDeiNodi(
    [{ nome: "vuoto" }, { nome: "pve2", cpu: "sensor.pve2_cpu_used" }],
    CLUSTER,
  );
  assert.equal(letture.length, 1);
  assert.equal(letture[0].nome, "pve2");
  /* E le entità da tenere d'occhio sono le sue: se il carico cambia e nessuno
   * le guarda, la fascia resta ferma su quello di prima. */
  assert.deepEqual(entitaDeiNodi([{ cpu: "sensor.a", ram: "sensor.b" }]), [
    "sensor.a",
    "sensor.b",
  ]);
});

test("il riassunto dice come sta il cluster, e il peggiore è quello che conta", () => {
  const letture = lettureDeiNodi(
    [
      { nome: "pve2", stato: "binary_sensor.pve2_status", cpu: "sensor.pve2_cpu_used" },
      { nome: "pve3", stato: "binary_sensor.pve3_status" },
      { nome: "pve4", stato: "binary_sensor.mai_vista" },
    ],
    CLUSTER,
  );
  const riassunto = riassuntoDeiNodi(letture);
  assert.equal(riassunto.quanti, 3);
  assert.equal(riassunto.accesi, 1);
  assert.equal(riassunto.spenti, 1);
  assert.equal(riassunto.muti, 1);
  assert.equal(riassunto.peggiore, 23.5);
  /* Senza nessun carico letto non si inventa uno zero. */
  assert.equal(riassuntoDeiNodi([]).peggiore, null);
});

test("la fascia sta sulla pagina Server, e la scheda dentro quella del MiniPC", async () => {
  const sezione = await readFile(
    new URL("../src/sections/nodi-section.js", import.meta.url),
    "utf8",
  );
  /* Prima il ferro, poi quello che ci gira sopra: i nodi vanno sopra le fasce
   * delle macchine. */
  assert.match(sezione, /insertBefore\(dove, macchine\)/);
  /* E senza nodi configurati la fascia non esiste: una pagina non spiega come
   * si configura la pagina. */
  assert.match(sezione, /if \(!letture\.length\)/);

  const editor = await readFile(
    new URL("../src/sections/nodi-editor-section.js", import.meta.url),
    "utf8",
  );
  /* «sez6» è la scheda del server, quella che porta già le macchine. */
  assert.match(editor, /dataset\?\.tab\) === "sez6"/);
  assert.match(editor, /data-dm-nodo-integ/);
  assert.match(editor, /apriMenuIntegrazioni\(/);
  /* Quello che è nelle caselle si mette al sicuro prima di ridisegnare: è la
   * lezione della #439. */
  assert.match(editor, /const prossima = lista\.slice\(\);\s*\n\s*prossima\[indice\] = leggiLaRiga/);

  /* E la chiave è nell'elenco di quelle che viaggiano con la casa. */
  const chiavi = await readFile(
    new URL("../src/core/chiavi-di-configurazione.js", import.meta.url),
    "utf8",
  );
  assert.match(chiavi, /"cd_nodi"/);
  assert.equal(CHIAVE_NODI, "cd_nodi");
});
