/* Il ritratto in tre dimensioni: la scultura e il rasterizzatore.
 *
 * Sono i due moduli piu' «da laboratorio» del progetto, e per questo sono
 * puri: nessuno dei due tocca il documento, e si provano qui a tavolino.
 * Quello che si inchioda e' cio' che, sbagliato, si vede subito addosso a
 * una faccia — l'ordine dei triangoli, le maschere che stanno al loro posto
 * su tutte le forme del viso, il ritratto che non cambia da solo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { CRANI, MATERIALI, NASI, buildHeadMesh, rgb } from "../src/core/face-mesh.js";
import { renderMesh } from "../src/core/face-raster.js";
import { CAPELLI_3D, faceToTratti, renderFace } from "../src/core/person-avatar-3d.js";
import { FACE_HAIRS, FACE_RENDERS, normalizeFace } from "../src/core/person-avatar.js";

test("il disegno resta la scelta di sempre, il 3D si chiede", () => {
  assert.equal(FACE_RENDERS[0], "disegno");
  assert.equal(normalizeFace({}).render, "disegno");
  assert.equal(normalizeFace({ render: "3d" }).render, "3d");
  assert.equal(normalizeFace({ render: "olografico" }).render, "disegno");
});

test("ogni taglio di capelli sa costruirsi in tre dimensioni", () => {
  /* Un taglio senza maschera uscirebbe come una testa pelata, senza dire
   * niente: meglio saperlo qui che davanti alla card. */
  for (const taglio of FACE_HAIRS)
    assert.ok(taglio in CAPELLI_3D, `il taglio ${taglio} non esiste in 3D`);
  assert.equal(CAPELLI_3D.calvo, null, "il calvo e' l'unico senza capelli");
});

test("la maglia e' chiusa, e i triangoli guardano tutti in fuori", () => {
  const maglia = buildHeadMesh(faceToTratti({}), { righe: 24, colonne: 32 });
  assert.ok(maglia.tri.length > 0);
  assert.equal(maglia.pos.length, maglia.nor.length);
  assert.equal(maglia.pos.length, maglia.col.length);
  assert.equal(maglia.mat.length, maglia.pos.length / 3);
  /* La prova del verso: la normale di un punto sulla fronte deve puntare
   * verso chi guarda. Girata, si vedrebbe la testa da dentro — un uovo
   * liscio con la luce dalla parte sbagliata, ed e' successo davvero. */
  let davanti = -1;
  for (let i = 0; i < maglia.pos.length / 3; i += 1) {
    const z = maglia.pos[i * 3 + 2];
    const y = maglia.pos[i * 3 + 1];
    if (z > 0.7 && Math.abs(y - 0.3) < 0.12 && Math.abs(maglia.pos[i * 3]) < 0.05) davanti = i;
  }
  assert.ok(davanti >= 0, "nessun punto sulla fronte");
  assert.ok(maglia.nor[davanti * 3 + 2] > 0.4, "la fronte deve guardare avanti");
});

test("ogni materiale sa come reagisce alla luce", () => {
  for (const m of MATERIALI) {
    assert.equal(typeof m.spec, "number");
    assert.ok(m.lucido > 0, "un esponente speculare nullo accende tutto");
  }
});

test("stesse scelte, stessa fotografia — e facce diverse, fotografie diverse", () => {
  const uno = renderFace({ skin: "f2" }, { size: 48, ss: 1 });
  const due = renderFace({ skin: "f2" }, { size: 48, ss: 1 });
  assert.deepEqual([...uno.data], [...due.data], "il ritratto deve essere deterministico");
  const altra = renderFace({ skin: "f5" }, { size: 48, ss: 1 });
  assert.notDeepEqual([...uno.data], [...altra.data]);
});

test("il fondo resta trasparente: la card ci mette il suo cerchio sotto", () => {
  const { data, size } = renderFace({}, { size: 48, ss: 1 });
  assert.equal(data[3], 0, "l'angolo in alto a sinistra non puo' essere dipinto");
  let dipinti = 0;
  for (let i = 0; i < size * size; i += 1) if (data[i * 4 + 3] > 0) dipinti += 1;
  assert.ok(dipinti > size * size * 0.15, "una testa che copre meno di un sesto non e' una testa");
});

test("le maschere restano al loro posto su tutte le forme del viso", () => {
  /* Le labbra, le sopracciglia e il taglio degli occhi sono scritti nelle
   * coordinate di un viso ovale. Su un viso lungo o largo i punti arrivano
   * gia' scolpiti, e senza tornare indietro gli occhi finirebbero sulla
   * fronte. La prova: su ogni forma, la testa disegna qualcosa di diverso ma
   * il ritratto non si svuota mai. */
  for (const shape of Object.keys(CRANI)) {
    const { data, size } = renderFace({ shape }, { size: 40, ss: 1 });
    let dipinti = 0;
    for (let i = 0; i < size * size; i += 1) if (data[i * 4 + 3] > 0) dipinti += 1;
    assert.ok(dipinti > size * size * 0.15, `la forma ${shape} non disegna una testa`);
  }
});

test("il rasterizzatore non chiede niente al documento", () => {
  /* Nessun `document`, nessun `window`: e' per questo che questi due moduli
   * si provano qui invece che con un browser acceso. */
  const maglia = buildHeadMesh(
    { ...faceToTratti({}), naso: NASI.largo, pelle: rgb("#e8b88a") },
    { righe: 20, colonne: 24 },
  );
  const { data, size } = renderMesh(maglia, { size: 32, ss: 1 });
  assert.equal(size, 32);
  assert.equal(data.length, 32 * 32 * 4);
});
