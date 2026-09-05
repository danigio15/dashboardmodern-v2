/* Quello che si configura qui si ritrova di la'.
 *
 * La configurazione della plancia vive in localStorage e viaggia fra i
 * dispositivi solo se la sua casella sta nell'elenco `CONFIG_KEYS`. Chi
 * aggiunge una sezione scrive la propria casella e si dimentica l'elenco: la
 * cosa funziona benissimo sul dispositivo dove e' stata configurata, e non
 * esiste su tutti gli altri. Non da' errore, non si vede in nessuna prova, e
 * salta fuori mesi dopo come «l'ho messo sul telefono e sul tablet non c'e'».
 *
 * Contando chi scrive cosa ne sono uscite tre: le icone degli avvisi, le
 * entita' assegnate a mano a una stanza, e il segno progressivo delle auto —
 * quest'ultimo la guardia contro gli identificativi riusati, che senza
 * viaggiare non guardava niente.
 *
 * Questa prova legge i sorgenti, trova ogni casella che qualcuno scrive
 * davvero, e pretende che ognuna stia o nell'elenco che viaggia o nell'elenco
 * qui sotto — quello di cio' che e' giusto resti su un dispositivo solo, con
 * scritto accanto il perche'. Aggiungere una casella nuova senza decidere dove
 * sta fa cadere questa prova.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const RADICE = fileURLToPath(new URL("../", import.meta.url));

/* Cio' che resta su un dispositivo solo, e perche'. */
const SOLO_DI_QUESTO_DISPOSITIVO = Object.freeze({
  cd_connection: "le credenziali di questo dispositivo",
  cd_theme: "il tema scelto qui (la barra invece viaggia: e' una scelta della plancia)",
  cd_energy_plant: "quale impianto e' aperto adesso, non cosa e' configurato",
  cd_ev_image: "il disegno dell'auto attiva qui: viaggia dentro cd_ev_cars",
  cd_ev_photos_moved: "segno che la migrazione delle foto e' gia' passata",
  cd_allag_rilevato: "segno che il giro sugli allagamenti e' gia' passato",
  cd_carichi_travasati_puliti:
    "segno che il giro sul sensore travasato fra due impianti e' gia' passato",
  cd_irr_lastrun: "quando ha girato l'irrigazione su questo dispositivo",
  cd_pool_run: "il conteggio della pompa in corso qui",
  cd_pool_lastrun: "quando ha girato la pompa su questo dispositivo",
  cd_open_editor_after_reload: "riapri la configurazione dopo il ricaricamento",
  cd_sync_reloading: "guardia contro il ricaricamento a ciclo",
  cd_sync_rl2: "guardia contro il ricaricamento a ciclo",
  cd_sync_ts: "orologio della vecchia sincronizzazione, disinnescata",
  cd_sync_dirty: "segno della vecchia sincronizzazione, disinnescata",
  dm_fresh_start: "segno che la plancia e' appena stata svuotata",
  dm_persistence_meta: "cosa sa questo dispositivo dell'ultimo salvataggio",
});

function tuttiIFile(cartella, out = []) {
  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) tuttiIFile(percorso, out);
    else if (percorso.endsWith(".js")) out.push(percorso);
  }
  return out;
}

const SCRITTURE = [
  /writeJson(?:IfChanged)?\(\s*["'`]((?:cd|dm)_[a-zA-Z0-9_.-]+)["'`]/g,
  /setItem\(\s*["'`]((?:cd|dm)_[a-zA-Z0-9_.-]+)["'`]/g,
];
const DICHIARAZIONE = /\b(?:export\s+)?const\s+([A-Z][A-Z_0-9]*)\s*=\s*["'`]((?:cd|dm)_[a-zA-Z0-9_.-]+)["'`]/g;

function chiaviScritte() {
  const file = [
    ...tuttiIFile(join(RADICE, "src")),
    ...tuttiIFile(join(RADICE, "legacy")),
  ];
  const sorgenti = new Map(file.map((percorso) => [percorso, readFileSync(percorso, "utf8")]));

  /* Le costanti viaggiano fra i file: una sezione importa la chiave da core/.
   * Quelle dichiarate nel file stesso vincono, perche' piu' moduli chiamano
   * CONFIG_KEY la propria. */
  const globali = new Map();
  for (const testo of sorgenti.values())
    for (const m of testo.matchAll(DICHIARAZIONE)) globali.set(m[1], m[2]);

  const scritte = new Map();
  for (const [percorso, originale] of sorgenti) {
    const proprie = new Map([...originale.matchAll(DICHIARAZIONE)].map((m) => [m[1], m[2]]));
    let testo = originale;
    for (const [simbolo, valore] of new Map([...globali, ...proprie]))
      testo = testo.replace(new RegExp(`\\b${simbolo}\\b`, "g"), `"${valore}"`);
    for (const espressione of SCRITTURE)
      for (const m of testo.matchAll(espressione)) {
        if (!scritte.has(m[1])) scritte.set(m[1], new Set());
        scritte
          .get(m[1])
          .add(
            relative(RADICE, percorso).replace(
              /legacy\/dashboard-runtime-(it|en)\.js/,
              "legacy/dashboard-runtime.js",
            ),
          );
      }
  }
  return scritte;
}

function chiaviCheViaggiano() {
  const sorgente = readFileSync(
    join(RADICE, "src/sections/config-persistence-section.js"),
    "utf8",
  );
  const apertura = sorgente.indexOf("export const CONFIG_KEYS = Object.freeze([");
  const blocco = sorgente.slice(apertura, sorgente.indexOf("]);", apertura));
  return new Set([...blocco.matchAll(/"((?:cd|dm)_[a-zA-Z0-9_.-]+)"/g)].map((m) => m[1]));
}

test("ogni casella scritta o viaggia, o e' dichiarata di questo dispositivo", () => {
  const viaggiano = chiaviCheViaggiano();
  const senzaPosto = [];
  for (const [chiave, chi] of chiaviScritte()) {
    if (viaggiano.has(chiave)) continue;
    if (Object.prototype.hasOwnProperty.call(SOLO_DI_QUESTO_DISPOSITIVO, chiave)) continue;
    senzaPosto.push(`${chiave} (scritta da ${[...chi].sort().join(", ")})`);
  }
  assert.deepEqual(
    senzaPosto,
    [],
    `Queste caselle non viaggiano e non sono dichiarate di questo dispositivo.\n` +
      `Vanno messe in CONFIG_KEYS (e la revisione va alzata), oppure in\n` +
      `SOLO_DI_QUESTO_DISPOSITIVO con scritto il perche':\n  ${senzaPosto.join("\n  ")}`,
  );
});

test("l'elenco di cio' che resta qui non elenca cose che viaggiano", () => {
  const viaggiano = chiaviCheViaggiano();
  const doppie = Object.keys(SOLO_DI_QUESTO_DISPOSITIVO).filter((chiave) => viaggiano.has(chiave));
  assert.deepEqual(doppie, [], `Dichiarate in due posti: ${doppie.join(", ")}`);
});
