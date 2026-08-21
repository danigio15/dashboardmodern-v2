import assert from "node:assert/strict";
import test from "node:test";

import {
  breadcrumbFrom,
  browseMessage,
  fileNameFor,
  imageServeUrl,
  isImageEntry,
  isMediaSourceId,
  normalizeBrowseResult,
  resolveMessage,
  unsignedPath,
} from "../src/core/media-picker.js";
import { resolveVehicleAsset } from "../src/sections/ev-section.js";

test("la richiesta della radice non nomina nessuna cartella", () => {
  assert.deepEqual(browseMessage(7), { id: 7, type: "media_source/browse_media" });
  assert.deepEqual(browseMessage(7, "  "), { id: 7, type: "media_source/browse_media" });
  assert.deepEqual(browseMessage(7, "media-source://media_source/local/auto"), {
    id: 7,
    type: "media_source/browse_media",
    media_content_id: "media-source://media_source/local/auto",
  });
});

test("l'indirizzo si chiede con una scadenza esplicita", () => {
  assert.deepEqual(resolveMessage(3, "media-source://x", 60), {
    id: 3,
    type: "media_source/resolve_media",
    media_content_id: "media-source://x",
    expires: 60,
  });
});

test("una cartella elenca prima le cartelle e poi le sole foto", () => {
  const folder = normalizeBrowseResult({
    media_content_id: "media-source://media_source",
    title: "Media",
    children: [
      { media_content_id: "f1", title: "Auto", can_expand: true },
      { media_content_id: "i1", title: "auto.png", media_class: "image", can_play: true },
      { media_content_id: "m1", title: "brano.mp3", media_class: "music", can_play: true },
      { media_content_id: "i2", title: "senza-classe.JPG", can_play: true },
    ],
  });
  assert.deepEqual(
    folder.folders.map((entry) => entry.title),
    ["Auto"],
  );
  assert.deepEqual(
    folder.images.map((entry) => entry.title),
    ["auto.png", "senza-classe.JPG"],
  );
  // Quello che resta fuori si dice, invece di far credere che non ci sia.
  assert.equal(folder.skipped, 1);
});

test("una cartella non e' mai una foto, comunque si chiami", () => {
  assert.equal(isImageEntry({ title: "foto.png", expandable: true }), false);
  assert.equal(isImageEntry({ title: "foto", kind: "image/jpeg" }), true);
  assert.equal(isImageEntry({ title: "appunti.txt" }), false);
});

test("le briciole di pane tengono anche la radice, che non ha indirizzo", () => {
  assert.deepEqual(breadcrumbFrom([{ id: "", title: "Cartelle" }, { id: "a", title: "Auto" }]), [
    { id: "", title: "Cartelle", depth: 0 },
    { id: "a", title: "Auto", depth: 1 },
  ]);
});

test("l'archivio immagini da' un indirizzo stabile", () => {
  assert.equal(imageServeUrl({ id: "abc123" }), "/api/image/serve/abc123/original");
  assert.equal(imageServeUrl({}), "");
});

test("l'indirizzo dell'archivio e' gia' servibile cosi' com'e'", () => {
  // Nessun /local davanti: e' una cartella che Home Assistant serve da sola.
  assert.equal(
    resolveVehicleAsset("/api/image/serve/abc123/original"),
    "/api/image/serve/abc123/original",
  );
});

test("il nome del file si ricava dall'indirizzo firmato", () => {
  assert.equal(fileNameFor("/media/local/auto%20blu.png?authSig=xyz"), "auto blu.png");
  assert.equal(fileNameFor("/media/local/cartella/"), "foto.png");
  assert.equal(fileNameFor("", "mia.png"), "mia.png");
});

test("la firma non entra in configurazione", () => {
  assert.equal(unsignedPath("/media/local/auto.png?authSig=xyz"), "/media/local/auto.png");
  assert.equal(isMediaSourceId("media-source://media_source/local"), true);
  assert.equal(isMediaSourceId("/local/auto.png"), false);
});
